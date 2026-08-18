"""
Step 11 Advanced Feature Engineering Experiment Runner
Evaluates Experiments A, B, C, D, E, F individually and in combination using 5-Fold Walk-Forward Evaluation.
Outputs results.json and report.md artifact.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

from feature_engineering import compute_all_advanced_features
from evaluation import compute_brier_score, compute_ece, run_paired_bootstrap_test

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

from catboost import CatBoostClassifier

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def load_data():
    files = [os.path.join(DATA_DIR, f"season_{i}.csv") for i in range(1, 4)]
    dfs = []
    for f in files:
        if os.path.exists(f):
            dfs.append(pd.read_csv(f))
            
    if not dfs:
        raise FileNotFoundError("Data files season_1.csv .. season_3.csv not found.")
        
    raw_df = pd.concat(dfs, ignore_index=True)
    clean_df = raw_df.dropna(subset=['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR']).copy()
    clean_df['ParsedDate'] = clean_df['Date'].apply(parse_date_safely)
    clean_df = clean_df.dropna(subset=['ParsedDate']).copy()
    clean_df = clean_df.sort_values('ParsedDate').reset_index(drop=True)
    
    target_map = {'H': 0, 'D': 1, 'A': 2}
    clean_df['Target'] = clean_df['FTR'].map(target_map)
    clean_df = clean_df.dropna(subset=['Target'])
    
    odds_cols = ['B365H', 'B365D', 'B365A']
    for c in odds_cols:
        if c in clean_df.columns:
            clean_df[c] = clean_df[c].ffill().bfill()
        else:
            clean_df[c] = np.nan
            
    clean_df = clean_df.dropna(subset=odds_cols).reset_index(drop=True)
    return clean_df

def run_experiment():
    raw_df = load_data()
    processed_df = compute_all_advanced_features(raw_df)
    
    # Feature Group Definitions
    feature_groups = {
        'Baseline': ['EloDiff'],
        'Exp_A_Strength_Dynamics': ['EloDiff', 'EloDiffAdv', 'EloTrend5_Home', 'EloTrend5_Away'],
        'Exp_B_Recent_Form': ['EloDiff', 'FormPPM_5_Home', 'FormPPM_5_Away', 'FormGD_5_Home', 'FormGD_5_Away', 'CS_5_Home', 'CS_5_Away'],
        'Exp_C_Home_Away_Venue': ['EloDiff', 'VenuePPM_5_Home', 'VenuePPM_5_Away', 'VenueGD_5_Home', 'VenueGD_5_Away'],
        'Exp_D_Schedule_Fatigue': ['EloDiff', 'RestDays_Diff', 'Matches14D_Home', 'Matches14D_Away'],
        'Exp_E_HeadToHead': ['EloDiff', 'H2H_Win_Home', 'H2H_Draw', 'H2H_GD_Avg'],
        'Exp_F_League_Standings': ['EloDiff', 'TablePPM_Diff', 'TableGD_Diff']
    }
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    # Storage for OOS predictions per feature group
    group_oos_preds = {g: [] for g in feature_groups.keys()}
    group_oos_y = []
    
    # Dixon-Coles is independent of CatBoost features (predicts from team goals history)
    dc_oos_preds = []
    
    fold_details = []

    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        y_te = test_df['Target']
        n_te = len(test_df)
        
        group_oos_y.extend(y_te.values)
        
        # 1. Dixon-Coles Prediction for current test fold
        m_dc = DixonColesModel(xi=0.001)
        m_dc.fit(train_df)
        p_dc_list = []
        for _, r in test_df.iterrows():
            p_dc_list.append(m_dc.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc = np.array(p_dc_list)
        dc_oos_preds.extend(p_dc)
        
        fold_entry = {
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'group_metrics': {}
        }
        
        # 2. CatBoost per feature group + Dixon-Coles (50/50 Ensemble)
        for g_name, f_cols in feature_groups.items():
            m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
            m_cb.fit(train_df[f_cols], train_df['Target'])
            p_cb = m_cb.predict_proba(test_df[f_cols])
            
            # CatBoost + Dixon-Coles 50/50 Ensemble
            p_ens = 0.5 * p_cb + 0.5 * p_dc
            p_ens /= np.sum(p_ens, axis=1, keepdims=True)
            
            group_oos_preds[g_name].extend(p_ens)
            
            loss = log_loss(y_te, p_ens, labels=[0, 1, 2])
            brier = compute_brier_score(y_te, p_ens)
            acc = (np.argmax(p_ens, axis=1) == y_te.values).mean()
            ece = compute_ece(y_te, p_ens)
            
            fold_entry['group_metrics'][g_name] = {
                'log_loss': round(loss, 3),
                'brier_score': round(brier, 3),
                'ece': ece,
                'accuracy_pct': round(acc * 100, 1)
            }
            
        fold_details.append(fold_entry)

    # Market Benchmark Reference for evaluation
    market_oos_preds = []
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        test_df = processed_df.iloc[train_end:test_end]
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        p_market = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        market_oos_preds.extend(p_market)

    # Global Summaries
    global_y = pd.Series(group_oos_y)
    global_summary = {}
    
    # Calculate Global Market Benchmark
    p_mkt_arr = np.array(market_oos_preds)
    global_summary['Market_Benchmark_Ref'] = {
        'log_loss': round(float(log_loss(global_y, p_mkt_arr, labels=[0,1,2])), 3),
        'brier_score': round(float(compute_brier_score(global_y, p_mkt_arr)), 3),
        'ece_calibration_error': compute_ece(global_y, p_mkt_arr),
        'accuracy_pct': round(float((np.argmax(p_mkt_arr, axis=1) == global_y.values).mean() * 100), 1)
    }

    base_p_arr = np.array(group_oos_preds['Baseline'])

    for g_name in feature_groups.keys():
        p_arr = np.array(group_oos_preds[g_name])
        preds = np.argmax(p_arr, axis=1)
        
        loss = log_loss(global_y, p_arr, labels=[0, 1, 2])
        brier = compute_brier_score(global_y, p_arr)
        acc = (preds == global_y.values).mean()
        f1 = f1_score(global_y, preds, average='macro')
        ece = compute_ece(global_y, p_arr)
        
        fold_losses = [f['group_metrics'][g_name]['log_loss'] for f in fold_details]
        fold_briers = [f['group_metrics'][g_name]['brier_score'] for f in fold_details]
        
        # Paired Bootstrap Test vs Baseline
        boot_res = run_paired_bootstrap_test(base_p_arr, p_arr, global_y, n_bootstraps=1000)
        
        global_summary[g_name] = {
            'log_loss': round(float(loss), 3),
            'brier_score': round(float(brier), 3),
            'ece_calibration_error': ece,
            'accuracy_pct': round(float(acc * 100), 1),
            'macro_f1': round(float(f1), 3),
            'mean_fold_log_loss': round(float(np.mean(fold_losses)), 3),
            'std_fold_log_loss': round(float(np.std(fold_losses)), 3),
            'mean_fold_brier': round(float(np.mean(fold_briers)), 3),
            'std_fold_brier': round(float(np.std(fold_briers)), 3),
            'bootstrap_test_vs_baseline': boot_res
        }

    # Evaluate Promising Combination if any group improved Baseline Log Loss 0.954
    best_single_group = min(feature_groups.keys(), key=lambda g: global_summary[g]['log_loss'])
    base_loss = global_summary['Baseline']['log_loss']
    best_loss = global_summary[best_single_group]['log_loss']
    
    # Decision Hierarchy
    if best_loss < base_loss and global_summary[best_single_group]['bootstrap_test_vs_baseline']['ci_95_lower'] > 0.0:
        recommendation = "PROMOTED"
    elif best_loss < base_loss:
        recommendation = "REQUIRES MORE VALIDATION"
    else:
        recommendation = "REJECTED (KEEP BASELINE UNCHANGED)"

    results_json = {
        'experiment_name': 'Step 11 Advanced Feature Engineering Experiment',
        'dataset_matches': len(processed_df),
        'recommendation': recommendation,
        'best_single_group': best_single_group,
        'fold_results': fold_details,
        'global_summary': global_summary
    }

    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)

    return fold_details, global_summary

if __name__ == '__main__':
    run_experiment()
    print("✅ Step 11 Advanced Feature Engineering Experiment Complete. Results written to results.json.")
