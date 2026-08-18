"""
Step 6 Model Benchmarking Experiment Runner
Benchmarks HistGradientBoosting, LightGBM, XGBoost, CatBoost, and Market Odds across 5 Walk-Forward Folds.
Outputs results.json and report.md artifact.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

from models import get_benchmark_models
from evaluation import compute_brier_score, compute_error_correlation_matrix

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def load_and_engineer_baseline_data():
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

def run_benchmark_experiment():
    processed_df = load_and_engineer_baseline_data()
    feature_cols = ['EloDiff', 'B365H', 'B365D', 'B365A']
    
    models_dict = get_benchmark_models()
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    fold_results_table = []
    
    # Storage for out-of-sample predictions
    out_of_sample_y = []
    out_of_sample_probs = { m: [] for m in models_dict.keys() }
    out_of_sample_probs['Market'] = []
    
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        
        X_tr, y_tr = train_df[feature_cols], train_df['Target']
        X_te, y_te = test_df[feature_cols], test_df['Target']
        n_te = len(test_df)
        
        # 1. Market Normalized Implied Probabilities
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        probs_market = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        preds_market = np.argmax(probs_market, axis=1)
        
        acc_mkt = (preds_market == y_te.values).mean()
        loss_mkt = log_loss(y_te, probs_market, labels=[0, 1, 2])
        brier_mkt = compute_brier_score(y_te, probs_market)
        f1_mkt = f1_score(y_te, preds_market, average='macro')
        
        out_of_sample_probs['Market'].extend(probs_market)
        if fold == 0:
            out_of_sample_y.extend(y_te.values)
        else:
            out_of_sample_y.extend(y_te.values)
            
        fold_entry = {
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'models': {
                'Market': {
                    'status': 'AVAILABLE',
                    'accuracy_pct': round(acc_mkt * 100, 1),
                    'log_loss': round(loss_mkt, 3),
                    'brier_score': round(brier_mkt, 3),
                    'macro_f1': round(f1_mkt, 3)
                }
            }
        }
        
        # 2. Evaluate ML Models
        for m_name, m_info in models_dict.items():
            if m_info['status'] == 'AVAILABLE':
                model = m_info['instance']
                model.fit(X_tr, y_tr)
                probs = model.predict_proba(X_te)
                preds = np.argmax(probs, axis=1)
                
                acc = (preds == y_te.values).mean()
                loss = log_loss(y_te, probs, labels=[0, 1, 2])
                brier = compute_brier_score(y_te, probs)
                f1 = f1_score(y_te, preds, average='macro')
                
                out_of_sample_probs[m_name].extend(probs)
                
                fold_entry['models'][m_name] = {
                    'status': 'AVAILABLE',
                    'accuracy_pct': round(acc * 100, 1),
                    'log_loss': round(loss, 3),
                    'brier_score': round(brier, 3),
                    'macro_f1': round(f1, 3)
                }
            else:
                fold_entry['models'][m_name] = {
                    'status': 'UNAVAILABLE',
                    'error': m_info.get('error', 'Not installed')
                }
                
        fold_results_table.append(fold_entry)

    # Global Out-of-Sample Results
    global_y = pd.Series(out_of_sample_y)
    global_summary = {}
    
    # Store matrix predictions for correlation calculation
    valid_predictions_matrix = {}
    
    for m_name in ['Market'] + list(models_dict.keys()):
        p_list = out_of_sample_probs[m_name]
        if len(p_list) > 0:
            probs = np.array(p_list)
            preds = np.argmax(probs, axis=1)
            
            loss = log_loss(global_y, probs, labels=[0, 1, 2])
            brier = compute_brier_score(global_y, probs)
            acc = (preds == global_y.values).mean()
            f1 = f1_score(global_y, preds, average='macro')
            
            # Compute fold stability (mean & std across folds)
            fold_losses = [f['models'][m_name]['log_loss'] for f in fold_results_table if f['models'][m_name].get('status') == 'AVAILABLE']
            fold_briers = [f['models'][m_name]['brier_score'] for f in fold_results_table if f['models'][m_name].get('status') == 'AVAILABLE']
            
            global_summary[m_name] = {
                'status': 'AVAILABLE',
                'log_loss': round(loss, 3),
                'brier_score': round(brier, 3),
                'accuracy_pct': round(acc * 100, 1),
                'macro_f1': round(f1, 3),
                'mean_fold_log_loss': round(float(np.mean(fold_losses)), 3),
                'std_fold_log_loss': round(float(np.std(fold_losses)), 3),
                'mean_fold_brier': round(float(np.mean(fold_briers)), 3),
                'std_fold_brier': round(float(np.std(fold_briers)), 3)
            }
            valid_predictions_matrix[m_name] = probs
        else:
            global_summary[m_name] = {
                'status': 'UNAVAILABLE',
                'error': models_dict.get(m_name, {}).get('error', 'Not installed')
            }

    # Model Error Correlation Matrix
    error_correlations = compute_error_correlation_matrix(valid_predictions_matrix)
    
    # Save results.json
    results_json = {
        'experiment_name': 'Step 6 Model Benchmarking Experiment',
        'dataset_matches': len(processed_df),
        'fold_results': fold_results_table,
        'global_out_of_sample_summary': global_summary,
        'error_correlations': error_correlations
    }
    
    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)
        
    return fold_results_table, global_summary, error_correlations

if __name__ == '__main__':
    run_benchmark_experiment()
    print("✅ Model Benchmarking Execution Complete. Results written to results.json.")
