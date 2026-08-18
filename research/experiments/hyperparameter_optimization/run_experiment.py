"""
Step 12 Hyperparameter Optimization Experiment Runner
Executes Nested Walk-Forward Validation:
1. Inner Train/Val hyperparameter & blend weight selection
2. Refit on Outer Train
3. Evaluate on untouched Outer Test
Outputs results.json and report.md artifact.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

from catboost_optimizer import optimize_catboost_inner
from dixon_coles_optimizer import optimize_dixon_coles_inner
from ensemble_optimizer import optimize_ensemble_weight_inner
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
    
    elos = {}
    elo_diffs = []
    K = 32
    HOME_ADV = 65
    
    for idx, row in clean_df.iterrows():
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in elos: elos[h] = 1500
        if a not in elos: elos[a] = 1500
        
        r_home_pre, r_away_pre = elos[h], elos[a]
        elo_diffs.append(r_home_pre - r_away_pre)
        
        eff_home = r_home_pre + HOME_ADV
        exp_home = 1 / (1 + 10 ** ((r_away_pre - eff_home) / 400))
        h_goals, a_goals = int(row['FTHG']), int(row['FTAG'])
        actual_home = 1.0 if h_goals > a_goals else (0.5 if h_goals == a_goals else 0.0)
        diff = abs(h_goals - a_goals)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (actual_home - exp_home))
        elos[h] = r_home_pre + delta
        elos[a] = r_away_pre - delta
        
    clean_df['EloDiff'] = elo_diffs
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
    processed_df = load_data()
    feature_cols = ['EloDiff']
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    out_of_sample_y = []
    out_of_sample_p_baseline = []
    out_of_sample_p_opt = []
    
    fold_details = []

    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        outer_train_df = processed_df.iloc[:train_end]
        outer_test_df = processed_df.iloc[train_end:test_end]
        y_te = outer_test_df['Target']
        n_te = len(outer_test_df)
        
        out_of_sample_y.extend(y_te.values)
        
        # --- 1. BASELINE PIPELINE (CatBoost depth 4, lr 0.03, iters 200; DC xi 0.001; 50/50 blend) ---
        m_cb_base = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
        m_cb_base.fit(outer_train_df[feature_cols], outer_train_df['Target'])
        p_cb_base = m_cb_base.predict_proba(outer_test_df[feature_cols])
        
        m_dc_base = DixonColesModel(xi=0.001)
        m_dc_base.fit(outer_train_df)
        p_dc_base_list = []
        for _, r in outer_test_df.iterrows():
            p_dc_base_list.append(m_dc_base.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc_base = np.array(p_dc_base_list)
        
        p_base_ens = 0.50 * p_cb_base + 0.50 * p_dc_base
        p_base_ens /= np.sum(p_base_ens, axis=1, keepdims=True)
        out_of_sample_p_baseline.extend(p_base_ens)
        
        # --- 2. NESTED INNER VALIDATION SEARCH ---
        split_idx = int(len(outer_train_df) * 0.70)
        inner_train_df = outer_train_df.iloc[:split_idx]
        inner_val_df = outer_train_df.iloc[split_idx:]
        
        best_cb_cfg, inner_val_cb_loss = optimize_catboost_inner(inner_train_df, inner_val_df, feature_cols)
        best_dc_xi, inner_val_dc_loss = optimize_dixon_coles_inner(inner_train_df, inner_val_df)
        
        # Inner Val Ensemble Blend Search
        m_cb_inner = CatBoostClassifier(**best_cb_cfg)
        m_cb_inner.fit(inner_train_df[feature_cols], inner_train_df['Target'])
        p_val_cb = m_cb_inner.predict_proba(inner_val_df[feature_cols])
        
        m_dc_inner = DixonColesModel(xi=best_dc_xi)
        m_dc_inner.fit(inner_train_df)
        p_val_dc_list = []
        for _, r in inner_val_df.iterrows():
            p_val_dc_list.append(m_dc_inner.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_val_dc = np.array(p_val_dc_list)
        
        best_w_cb, inner_val_ens_loss = optimize_ensemble_weight_inner(p_val_cb, p_val_dc, inner_val_df['Target'])
        
        # --- 3. REFIT ON FULL OUTER TRAIN WITH SELECTED OPTIMAL PARAMS ---
        m_cb_opt = CatBoostClassifier(**best_cb_cfg)
        m_cb_opt.fit(outer_train_df[feature_cols], outer_train_df['Target'])
        p_cb_opt = m_cb_opt.predict_proba(outer_test_df[feature_cols])
        
        m_dc_opt = DixonColesModel(xi=best_dc_xi)
        m_dc_opt.fit(outer_train_df)
        p_dc_opt_list = []
        for _, r in outer_test_df.iterrows():
            p_dc_opt_list.append(m_dc_opt.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc_opt = np.array(p_dc_opt_list)
        
        p_opt_ens = best_w_cb * p_cb_opt + (1.0 - best_w_cb) * p_dc_opt
        p_opt_ens /= np.sum(p_opt_ens, axis=1, keepdims=True)
        out_of_sample_p_opt.extend(p_opt_ens)
        
        # Outer Test Evaluation
        base_loss = log_loss(y_te, p_base_ens, labels=[0, 1, 2])
        opt_loss = log_loss(y_te, p_opt_ens, labels=[0, 1, 2])
        
        fold_details.append({
            'fold': fold + 1,
            'train_size': len(outer_train_df),
            'test_size': n_te,
            'test_window': f"{outer_test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {outer_test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'inner_val_metrics': {
                'catboost_loss': inner_val_cb_loss,
                'dixon_coles_loss': inner_val_dc_loss,
                'ensemble_loss': inner_val_ens_loss
            },
            'selected_hyperparameters': {
                'catboost': best_cb_cfg,
                'dixon_coles_xi': best_dc_xi,
                'ensemble_weight_cb': best_w_cb
            },
            'outer_test_metrics': {
                'baseline_log_loss': round(base_loss, 3),
                'optimized_log_loss': round(opt_loss, 3),
                'optimized_brier': round(compute_brier_score(y_te, p_opt_ens), 3),
                'optimized_ece': compute_ece(y_te, p_opt_ens),
                'optimized_accuracy_pct': round((np.argmax(p_opt_ens, axis=1) == y_te.values).mean() * 100, 1)
            }
        })

    # Global Summaries
    global_y = pd.Series(out_of_sample_y)
    global_p_base = np.array(out_of_sample_p_baseline)
    global_p_opt = np.array(out_of_sample_p_opt)
    
    loss_base = log_loss(global_y, global_p_base, labels=[0, 1, 2])
    brier_base = compute_brier_score(global_y, global_p_base)
    acc_base = (np.argmax(global_p_base, axis=1) == global_y.values).mean()
    ece_base = compute_ece(global_y, global_p_base)
    
    loss_opt = log_loss(global_y, global_p_opt, labels=[0, 1, 2])
    brier_opt = compute_brier_score(global_y, global_p_opt)
    acc_opt = (np.argmax(global_p_opt, axis=1) == global_y.values).mean()
    f1_opt = f1_score(global_y, np.argmax(global_p_opt, axis=1), average='macro')
    ece_opt = compute_ece(global_y, global_p_opt)
    
    fold_opt_losses = [f['outer_test_metrics']['optimized_log_loss'] for f in fold_details]
    fold_base_losses = [f['outer_test_metrics']['baseline_log_loss'] for f in fold_details]
    
    # Paired Bootstrap Test
    boot_res = run_paired_bootstrap_test(global_p_base, global_p_opt, global_y, n_bootstraps=1000)
    
    # Decision Hierarchy
    if loss_opt < loss_base and boot_res['ci_95_lower'] > 0.0:
        recommendation = "CANDIDATE FOR PROMOTION"
    elif loss_opt < loss_base:
        recommendation = "REQUIRES MORE VALIDATION (CI spans 0)"
    else:
        recommendation = "REJECT OPTIMIZATION (KEEP BASELINE UNCHANGED)"

    global_summary = {
        'Baseline_Engine': {
            'log_loss': round(float(loss_base), 3),
            'brier_score': round(float(brier_base), 3),
            'ece_calibration_error': ece_base,
            'accuracy_pct': round(float(acc_base * 100), 1),
            'mean_fold_log_loss': round(float(np.mean(fold_base_losses)), 3),
            'std_fold_log_loss': round(float(np.std(fold_base_losses)), 3)
        },
        'Optimized_Engine': {
            'log_loss': round(float(loss_opt), 3),
            'brier_score': round(float(brier_opt), 3),
            'ece_calibration_error': ece_opt,
            'accuracy_pct': round(float(acc_opt * 100), 1),
            'macro_f1': round(float(f1_opt), 3),
            'mean_fold_log_loss': round(float(np.mean(fold_opt_losses)), 3),
            'std_fold_log_loss': round(float(np.std(fold_opt_losses)), 3)
        },
        'bootstrap_test_vs_baseline': boot_res,
        'recommendation': recommendation
    }

    results_json = {
        'experiment_name': 'Step 12 Hyperparameter Optimization Experiment',
        'dataset_matches': len(processed_df),
        'recommendation': recommendation,
        'fold_results': fold_details,
        'global_summary': global_summary
    }

    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)

    return fold_details, global_summary

if __name__ == '__main__':
    run_experiment()
    print("✅ Step 12 Hyperparameter Optimization Complete. Results written to results.json.")
