"""
Step 8 Probability Calibration Experiment Runner
Evaluates Raw, Platt (Logistic), and Isotonic calibration across CatBoost, Dixon-Coles, XGBoost, LightGBM.
Outputs results.json and report.md artifact.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

# Ensure imports from research folders
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

from calibration_methods import PlattCalibrator, IsotonicCalibrator
from evaluation import compute_brier_score, compute_ece_and_reliability_bins

# Import tree models
from catboost import CatBoostClassifier
from lightgbm import LGBMClassifier
from xgboost import XGBClassifier

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def load_data_and_features():
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

def get_base_model(model_name):
    if model_name == 'CatBoost':
        return CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
    elif model_name == 'XGBoost':
        return XGBClassifier(objective='multi:softprob', num_class=3, learning_rate=0.03, n_estimators=200, max_depth=3, min_child_weight=5, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, random_state=42)
    elif model_name == 'LightGBM':
        return LGBMClassifier(objective='multiclass', num_class=3, learning_rate=0.03, n_estimators=200, num_leaves=15, max_depth=4, min_child_samples=30, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, random_state=42, verbose=-1)
    elif model_name == 'Dixon-Coles':
        return DixonColesModel(xi=0.001)
    return None

def run_experiment():
    processed_df = load_data_and_features()
    feature_cols = ['EloDiff', 'B365H', 'B365D', 'B365A']
    
    model_names = ['CatBoost', 'Dixon-Coles', 'XGBoost', 'LightGBM']
    methods = ['Raw', 'Platt', 'Isotonic']
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    fold_results = []
    
    out_of_sample_y = []
    out_of_sample_probs = { m: { meth: [] for meth in methods } for m in model_names }
    out_of_sample_market_probs = []
    
    # Environment variable for OpenMP on mac
    env_dylib = "/opt/homebrew/opt/libomp/lib"
    if os.path.exists(env_dylib):
        os.environ['DYLD_LIBRARY_PATH'] = env_dylib
        
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        y_te = test_df['Target']
        n_te = len(test_df)
        
        if fold == 0:
            out_of_sample_y.extend(y_te.values)
        else:
            out_of_sample_y.extend(y_te.values)
            
        # Market benchmark
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        probs_mkt = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        out_of_sample_market_probs.extend(probs_mkt)
        
        # Chronological split of historical train_df for calibration fitting
        # Earlier 70% -> model training, Later 30% -> calibration validation
        split_idx = int(len(train_df) * 0.70)
        calib_base_train = train_df.iloc[:split_idx]
        calib_val = train_df.iloc[split_idx:]
        y_calib_val = calib_val['Target']
        
        fold_entry = {
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'evaluations': {}
        }
        
        for m_name in model_names:
            fold_entry['evaluations'][m_name] = {}
            
            if m_name == 'Dixon-Coles':
                # 1. Fit on calib_base_train to generate out-of-sample calib_val predictions
                m_calib = DixonColesModel(xi=0.001)
                m_calib.fit(calib_base_train)
                
                calib_probs = []
                for _, r in calib_val.iterrows():
                    p_dict = m_calib.predict_probabilities(r['HomeTeam'], r['AwayTeam'])
                    calib_probs.append(p_dict['probabilities'])
                calib_probs = np.array(calib_probs)
                
                # 2. Fit Calibrators on calib_probs
                platt = PlattCalibrator().fit(calib_probs, y_calib_val.values)
                iso = IsotonicCalibrator(min_samples=40).fit(calib_probs, y_calib_val.values)
                
                # 3. Fit base model on FULL train_df & predict test_df
                m_full = DixonColesModel(xi=0.001)
                m_full.fit(train_df)
                
                raw_test_probs = []
                for _, r in test_df.iterrows():
                    p_dict = m_full.predict_probabilities(r['HomeTeam'], r['AwayTeam'])
                    raw_test_probs.append(p_dict['probabilities'])
                raw_test_probs = np.array(raw_test_probs)
                
            else:
                # Tree Models
                m_calib = get_base_model(m_name)
                m_calib.fit(calib_base_train[feature_cols], calib_base_train['Target'])
                calib_probs = m_calib.predict_proba(calib_val[feature_cols])
                
                platt = PlattCalibrator().fit(calib_probs, y_calib_val.values)
                iso = IsotonicCalibrator(min_samples=40).fit(calib_probs, y_calib_val.values)
                
                m_full = get_base_model(m_name)
                m_full.fit(train_df[feature_cols], train_df['Target'])
                raw_test_probs = m_full.predict_proba(test_df[feature_cols])
                
            # Apply Calibrations
            platt_test_probs = platt.calibrate(raw_test_probs)
            iso_test_probs = iso.calibrate(raw_test_probs)
            
            p_dict_test = {
                'Raw': raw_test_probs,
                'Platt': platt_test_probs,
                'Isotonic': iso_test_probs
            }
            
            for meth in methods:
                p_eval = p_dict_test[meth]
                preds = np.argmax(p_eval, axis=1)
                
                loss = log_loss(y_te, p_eval, labels=[0, 1, 2])
                brier = compute_brier_score(y_te, p_eval)
                acc = (preds == y_te.values).mean()
                f1 = f1_score(y_te, preds, average='macro')
                ece, _ = compute_ece_and_reliability_bins(y_te, p_eval)
                
                out_of_sample_probs[m_name][meth].extend(p_eval)
                
                fold_entry['evaluations'][m_name][meth] = {
                    'log_loss': round(loss, 3),
                    'brier_score': round(brier, 3),
                    'ece_calibration_error': ece,
                    'accuracy_pct': round(acc * 100, 1),
                    'macro_f1': round(f1, 3)
                }
                
        fold_results.append(fold_entry)

    # Global Out-of-Sample Summary
    global_y = pd.Series(out_of_sample_y)
    
    global_market_probs = np.array(out_of_sample_market_probs)
    loss_mkt = log_loss(global_y, global_market_probs, labels=[0, 1, 2])
    brier_mkt = compute_brier_score(global_y, global_market_probs)
    acc_mkt = (np.argmax(global_market_probs, axis=1) == global_y.values).mean()
    ece_mkt, _ = compute_ece_and_reliability_bins(global_y, global_market_probs)
    
    global_summary = {
        'Market_Benchmark': {
            'log_loss': round(loss_mkt, 3),
            'brier_score': round(brier_mkt, 3),
            'ece_calibration_error': ece_mkt,
            'accuracy_pct': round(acc_mkt * 100, 1)
        },
        'models': {}
    }
    
    for m_name in model_names:
        global_summary['models'][m_name] = {}
        for meth in methods:
            p_arr = np.array(out_of_sample_probs[m_name][meth])
            preds = np.argmax(p_arr, axis=1)
            
            loss = log_loss(global_y, p_arr, labels=[0, 1, 2])
            brier = compute_brier_score(global_y, p_arr)
            acc = (preds == global_y.values).mean()
            f1 = f1_score(global_y, preds, average='macro')
            ece, rel_curves = compute_ece_and_reliability_bins(global_y, p_arr)
            
            fold_losses = [f['evaluations'][m_name][meth]['log_loss'] for f in fold_results]
            fold_briers = [f['evaluations'][m_name][meth]['brier_score'] for f in fold_results]
            fold_eces = [f['evaluations'][m_name][meth]['ece_calibration_error'] for f in fold_results]
            
            global_summary['models'][m_name][meth] = {
                'log_loss': round(loss, 3),
                'brier_score': round(brier, 3),
                'ece_calibration_error': ece,
                'accuracy_pct': round(acc * 100, 1),
                'macro_f1': round(f1, 3),
                'mean_fold_log_loss': round(float(np.mean(fold_losses)), 3),
                'std_fold_log_loss': round(float(np.std(fold_losses)), 3),
                'mean_fold_brier': round(float(np.mean(fold_briers)), 3),
                'std_fold_brier': round(float(np.std(fold_briers)), 3),
                'mean_fold_ece': round(float(np.mean(fold_eces)), 3),
                'std_fold_ece': round(float(np.std(fold_eces)), 3),
                'reliability_curves': rel_curves
            }
            
    results_json = {
        'experiment_name': 'Step 8 Probability Calibration Experiment',
        'dataset_matches': len(processed_df),
        'fold_results': fold_results,
        'global_summary': global_summary
    }
    
    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)
        
    return fold_results, global_summary

if __name__ == '__main__':
    run_experiment()
    print("✅ Calibration Experiment Complete. Results written to results.json.")
