"""
Step 9 Probability Ensemble Experiment Runner
Evaluates Standalone Candidates, Fixed Ensembles, and Expanding-Window Optimized Ensembles across 5 Walk-Forward Folds.
Answers: "Does Football add information beyond Market?"
Outputs results.json and report.md artifact.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

# Add imports for goal models and calibration
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'calibration'))
from calibration_methods import PlattCalibrator

from ensemble_optimizer import optimize_ensemble_weights, combine_probabilities
from evaluation import compute_brier_score, compute_ece, compute_error_correlation_matrix

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

def run_experiment():
    processed_df = load_data_and_features()
    feature_cols = ['EloDiff', 'B365H', 'B365D', 'B365A']
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    # Enable OpenMP if needed
    env_dylib = "/opt/homebrew/opt/libomp/lib"
    if os.path.exists(env_dylib):
        os.environ['DYLD_LIBRARY_PATH'] = env_dylib
        
    fold_results = []
    
    out_of_sample_y = []
    out_of_sample_preds = {
        'Market': [], 'CatBoost': [], 'Dixon-Coles': [], 'XGBoost': [], 'LightGBM_Platt': [],
        'Equal_4_Model': [], 'CatBoost_DC': [], 'CatBoost_DC_XGB': [],
        'Market_CatBoost': [], 'Market_DC': [], 'Market_CatBoost_DC': [],
        'Optimized_Football': [], 'Optimized_Market_Football': []
    }
    
    # Store past historical out-of-sample predictions for expanding weight training
    history_oos_y = []
    history_oos_base_preds = {
        'CatBoost': [], 'Dixon-Coles': [], 'XGBoost': [], 'LightGBM_Platt': [], 'Market': []
    }
    
    opt_weights_history_football = []
    opt_weights_history_market_football = []

    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        y_te = test_df['Target']
        n_te = len(test_df)
        
        out_of_sample_y.extend(y_te.values)
        
        # 1. Market Benchmark Probabilities
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        p_market = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        
        # 2. CatBoost Raw
        m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
        m_cb.fit(train_df[feature_cols], train_df['Target'])
        p_cat = m_cb.predict_proba(test_df[feature_cols])
        
        # 3. Dixon-Coles Raw
        m_dc = DixonColesModel(xi=0.001)
        m_dc.fit(train_df)
        p_dc_list = []
        for _, r in test_df.iterrows():
            p_dc_list.append(m_dc.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc = np.array(p_dc_list)
        
        # 4. XGBoost Raw
        m_xgb = XGBClassifier(objective='multi:softprob', num_class=3, learning_rate=0.03, n_estimators=200, max_depth=3, min_child_weight=5, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, random_state=42)
        m_xgb.fit(train_df[feature_cols], train_df['Target'])
        p_xgb = m_xgb.predict_proba(test_df[feature_cols])
        
        # 5. LightGBM + Platt Calibration
        split_idx = int(len(train_df) * 0.70)
        calib_base_tr, calib_val = train_df.iloc[:split_idx], train_df.iloc[split_idx:]
        m_lgb_cal = LGBMClassifier(objective='multiclass', num_class=3, learning_rate=0.03, n_estimators=200, num_leaves=15, max_depth=4, min_child_samples=30, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, random_state=42, verbose=-1)
        m_lgb_cal.fit(calib_base_tr[feature_cols], calib_base_tr['Target'])
        calib_val_lgb_p = m_lgb_cal.predict_proba(calib_val[feature_cols])
        
        platt_lgb = PlattCalibrator().fit(calib_val_lgb_p, calib_val['Target'].values)
        
        m_lgb_full = LGBMClassifier(objective='multiclass', num_class=3, learning_rate=0.03, n_estimators=200, num_leaves=15, max_depth=4, min_child_samples=30, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, random_state=42, verbose=-1)
        m_lgb_full.fit(train_df[feature_cols], train_df['Target'])
        p_lgb_raw = m_lgb_full.predict_proba(test_df[feature_cols])
        p_lgb_platt = platt_lgb.calibrate(p_lgb_raw)
        
        # Store Standalone Out-of-Sample Predictions
        out_of_sample_preds['Market'].extend(p_market)
        out_of_sample_preds['CatBoost'].extend(p_cat)
        out_of_sample_preds['Dixon-Coles'].extend(p_dc)
        out_of_sample_preds['XGBoost'].extend(p_xgb)
        out_of_sample_preds['LightGBM_Platt'].extend(p_lgb_platt)
        
        # --- FIXED ENSEMBLES ---
        p_eq4 = combine_probabilities([p_cat, p_dc, p_xgb, p_lgb_platt], [0.25, 0.25, 0.25, 0.25])
        p_cb_dc = combine_probabilities([p_cat, p_dc], [0.50, 0.50])
        p_cb_dc_xgb = combine_probabilities([p_cat, p_dc, p_xgb], [1/3, 1/3, 1/3])
        
        p_mkt_cb = combine_probabilities([p_market, p_cat], [0.50, 0.50])
        p_mkt_dc = combine_probabilities([p_market, p_dc], [0.50, 0.50])
        p_mkt_cb_dc = combine_probabilities([p_market, p_cat, p_dc], [1/3, 1/3, 1/3])
        
        out_of_sample_preds['Equal_4_Model'].extend(p_eq4)
        out_of_sample_preds['CatBoost_DC'].extend(p_cb_dc)
        out_of_sample_preds['CatBoost_DC_XGB'].extend(p_cb_dc_xgb)
        out_of_sample_preds['Market_CatBoost'].extend(p_mkt_cb)
        out_of_sample_preds['Market_DC'].extend(p_mkt_dc)
        out_of_sample_preds['Market_CatBoost_DC'].extend(p_mkt_cb_dc)
        
        # --- OPTIMIZED ENSEMBLES (EXPANDING WEIGHT TRAINING) ---
        if fold == 0:
            # Initial fold equal weights
            w_fb = np.array([0.25, 0.25, 0.25, 0.25])
            w_mkt_fb = np.array([0.333, 0.333, 0.334])
        else:
            # Optimize weights strictly on historical OOS predictions accumulated from past folds
            past_y = np.array(history_oos_y)
            
            past_fb_preds = [
                np.array(history_oos_base_preds['CatBoost']),
                np.array(history_oos_base_preds['Dixon-Coles']),
                np.array(history_oos_base_preds['XGBoost']),
                np.array(history_oos_base_preds['LightGBM_Platt'])
            ]
            w_fb = optimize_ensemble_weights(past_fb_preds, past_y, regularized=True, min_w=0.05)
            
            past_mkt_fb_preds = [
                np.array(history_oos_base_preds['Market']),
                np.array(history_oos_base_preds['CatBoost']),
                np.array(history_oos_base_preds['Dixon-Coles'])
            ]
            w_mkt_fb = optimize_ensemble_weights(past_mkt_fb_preds, past_y, regularized=True, min_w=0.05)
            
        opt_weights_history_football.append(w_fb.tolist())
        opt_weights_history_market_football.append(w_mkt_fb.tolist())
        
        p_opt_fb = combine_probabilities([p_cat, p_dc, p_xgb, p_lgb_platt], w_fb)
        p_opt_mkt_fb = combine_probabilities([p_market, p_cat, p_dc], w_mkt_fb)
        
        out_of_sample_preds['Optimized_Football'].extend(p_opt_fb)
        out_of_sample_preds['Optimized_Market_Football'].extend(p_opt_mkt_fb)
        
        # Accumulate current fold predictions into history for subsequent folds
        history_oos_y.extend(y_te.values)
        history_oos_base_preds['CatBoost'].extend(p_cat)
        history_oos_base_preds['Dixon-Coles'].extend(p_dc)
        history_oos_base_preds['XGBoost'].extend(p_xgb)
        history_oos_base_preds['LightGBM_Platt'].extend(p_lgb_platt)
        history_oos_base_preds['Market'].extend(p_market)
        
        # Fold Evaluation Entry
        fold_eval = {
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'weights_football': w_fb.tolist(),
            'weights_market_football': w_mkt_fb.tolist(),
            'metrics': {}
        }
        
        for ens_k in out_of_sample_preds.keys():
            p_f = np.array(out_of_sample_preds[ens_k][-n_te:])
            preds_f = np.argmax(p_f, axis=1)
            
            loss_f = log_loss(y_te, p_f, labels=[0, 1, 2])
            brier_f = compute_brier_score(y_te, p_f)
            acc_f = (preds_f == y_te.values).mean()
            ece_f = compute_ece(y_te, p_f)
            
            fold_eval['metrics'][ens_k] = {
                'log_loss': round(loss_f, 3),
                'brier_score': round(brier_f, 3),
                'ece': ece_f,
                'accuracy_pct': round(acc_f * 100, 1)
            }
            
        fold_results.append(fold_eval)

    # Global Out-of-Sample Results
    global_y = pd.Series(out_of_sample_y)
    global_summary = {}
    
    valid_predictions_matrix = {}
    
    for ens_k in out_of_sample_preds.keys():
        p_arr = np.array(out_of_sample_preds[ens_k])
        preds_k = np.argmax(p_arr, axis=1)
        
        loss = log_loss(global_y, p_arr, labels=[0, 1, 2])
        brier = compute_brier_score(global_y, p_arr)
        acc = (preds_k == global_y.values).mean()
        f1 = f1_score(global_y, preds_k, average='macro')
        ece = compute_ece(global_y, p_arr)
        
        fold_losses = [f['metrics'][ens_k]['log_loss'] for f in fold_results]
        fold_briers = [f['metrics'][ens_k]['brier_score'] for f in fold_results]
        fold_eces = [f['metrics'][ens_k]['ece'] for f in fold_results]
        
        global_summary[ens_k] = {
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
            'std_fold_ece': round(float(np.std(fold_eces)), 3)
        }
        valid_predictions_matrix[ens_k] = p_arr

    # Model Diversity Correlation Matrix
    error_correlations = compute_error_correlation_matrix({
        'Market': valid_predictions_matrix['Market'],
        'CatBoost': valid_predictions_matrix['CatBoost'],
        'Dixon-Coles': valid_predictions_matrix['Dixon-Coles'],
        'XGBoost': valid_predictions_matrix['XGBoost'],
        'LightGBM_Platt': valid_predictions_matrix['LightGBM_Platt'],
        'Optimized_Market_Football': valid_predictions_matrix['Optimized_Market_Football']
    })
    
    # Check if football adds information beyond market
    mkt_loss = global_summary['Market']['log_loss']
    ens_mkt_fb_loss = global_summary['Market_CatBoost_DC']['log_loss']
    opt_mkt_fb_loss = global_summary['Optimized_Market_Football']['log_loss']
    
    does_football_add_info = "YES" if (ens_mkt_fb_loss < mkt_loss or opt_mkt_fb_loss < mkt_loss) else "NO"
    
    results_json = {
        'experiment_name': 'Step 9 Probability Ensemble Experiment',
        'dataset_matches': len(processed_df),
        'does_football_add_info_beyond_market': does_football_add_info,
        'fold_results': fold_results,
        'global_summary': global_summary,
        'error_correlations': error_correlations
    }
    
    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)
        
    return fold_results, global_summary, error_correlations

if __name__ == '__main__':
    run_experiment()
    print("✅ Ensemble Experiment Execution Complete. Results written to results.json.")
