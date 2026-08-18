"""
Step 7 Goal Modeling Experiment Runner (Poisson + Dixon-Coles)
Evaluates Independent Poisson and Dixon-Coles models across 5 expanding walk-forward folds without using bookmaker odds.
Outputs results.json and report.md artifact.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

from poisson_model import IndependentPoissonModel
from dixon_coles_model import DixonColesModel
from evaluation import compute_brier_score, compute_ece, compute_goal_diagnostics

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
    clean_df = clean_df.dropna(subset=['Target']).reset_index(drop=True)
    
    return clean_df

def run_experiment():
    processed_df = load_data()
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    fold_results_table = []
    
    # Store out-of-sample predictions
    out_of_sample_y = []
    out_of_sample_fthg = []
    out_of_sample_ftag = []
    
    out_of_sample_poisson_probs = []
    out_of_sample_poisson_lam_h = []
    out_of_sample_poisson_lam_a = []
    
    out_of_sample_dc_probs = []
    out_of_sample_dc_lam_h = []
    out_of_sample_dc_lam_a = []
    
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        n_te = len(test_df)
        
        # 1. Fit Independent Poisson Model
        model_poisson = IndependentPoissonModel()
        model_poisson.fit(train_df)
        
        # 2. Fit Dixon-Coles Model
        model_dc = DixonColesModel(xi=0.001)
        model_dc.fit(train_df)
        
        fold_poisson_probs = []
        fold_dc_probs = []
        
        for idx, row in test_df.iterrows():
            h, a = row['HomeTeam'], row['AwayTeam']
            
            p_res = model_poisson.predict_probabilities(h, a)
            dc_res = model_dc.predict_probabilities(h, a)
            
            fold_poisson_probs.append(p_res['probabilities'])
            out_of_sample_poisson_lam_h.append(p_res['expected_goals_home'])
            out_of_sample_poisson_lam_a.append(p_res['expected_goals_away'])
            
            fold_dc_probs.append(dc_res['probabilities'])
            out_of_sample_dc_lam_h.append(dc_res['expected_goals_home'])
            out_of_sample_dc_lam_a.append(dc_res['expected_goals_away'])
            
        probs_p = np.array(fold_poisson_probs)
        preds_p = np.argmax(probs_p, axis=1)
        y_te = test_df['Target']
        
        loss_p = log_loss(y_te, probs_p, labels=[0, 1, 2])
        brier_p = compute_brier_score(y_te, probs_p)
        acc_p = (preds_p == y_te.values).mean()
        f1_p = f1_score(y_te, preds_p, average='macro')
        
        probs_dc = np.array(fold_dc_probs)
        preds_dc = np.argmax(probs_dc, axis=1)
        
        loss_dc = log_loss(y_te, probs_dc, labels=[0, 1, 2])
        brier_dc = compute_brier_score(y_te, probs_dc)
        acc_dc = (preds_dc == y_te.values).mean()
        f1_dc = f1_score(y_te, preds_dc, average='macro')
        
        out_of_sample_y.extend(y_te.values)
        out_of_sample_fthg.extend(test_df['FTHG'].values)
        out_of_sample_ftag.extend(test_df['FTAG'].values)
        
        out_of_sample_poisson_probs.extend(probs_p)
        out_of_sample_dc_probs.extend(probs_dc)
        
        fold_results_table.append({
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'poisson': {
                'log_loss': round(loss_p, 3),
                'brier_score': round(brier_p, 3),
                'accuracy_pct': round(acc_p * 100, 1),
                'macro_f1': round(f1_p, 3)
            },
            'dixon_coles': {
                'log_loss': round(loss_dc, 3),
                'brier_score': round(brier_dc, 3),
                'accuracy_pct': round(acc_dc * 100, 1),
                'macro_f1': round(f1_dc, 3)
            }
        })

    # Global Out-of-Sample Results
    global_y = pd.Series(out_of_sample_y)
    
    global_probs_p = np.array(out_of_sample_poisson_probs)
    global_preds_p = np.argmax(global_probs_p, axis=1)
    
    global_probs_dc = np.array(out_of_sample_dc_probs)
    global_preds_dc = np.argmax(global_probs_dc, axis=1)
    
    loss_p_glob = log_loss(global_y, global_probs_p, labels=[0, 1, 2])
    brier_p_glob = compute_brier_score(global_y, global_probs_p)
    acc_p_glob = (global_preds_p == global_y.values).mean()
    f1_p_glob = f1_score(global_y, global_preds_p, average='macro')
    ece_p_glob = compute_ece(global_y, global_probs_p)
    
    loss_dc_glob = log_loss(global_y, global_probs_dc, labels=[0, 1, 2])
    brier_dc_glob = compute_brier_score(global_y, global_probs_dc)
    acc_dc_glob = (global_preds_dc == global_y.values).mean()
    f1_dc_glob = f1_score(global_y, global_preds_dc, average='macro')
    ece_dc_glob = compute_ece(global_y, global_probs_dc)
    
    # Diagnostics
    diag_p = compute_goal_diagnostics(out_of_sample_fthg, out_of_sample_ftag, out_of_sample_poisson_lam_h, out_of_sample_poisson_lam_a)
    diag_dc = compute_goal_diagnostics(out_of_sample_fthg, out_of_sample_ftag, out_of_sample_dc_lam_h, out_of_sample_dc_lam_a)
    
    # Model Diversity (Correlation between Poisson and Dixon-Coles Home Win Probabilities)
    corr_p_dc = float(np.corrcoef(global_probs_p[:, 0], global_probs_dc[:, 0])[0, 1])
    
    global_summary = {
        'Independent_Poisson': {
            'log_loss': round(loss_p_glob, 3),
            'brier_score': round(brier_p_glob, 3),
            'accuracy_pct': round(acc_p_glob * 100, 1),
            'macro_f1': round(f1_p_glob, 3),
            'ece_calibration_error': ece_p_glob,
            'diagnostics': diag_p
        },
        'Dixon_Coles': {
            'log_loss': round(loss_dc_glob, 3),
            'brier_score': round(brier_dc_glob, 3),
            'accuracy_pct': round(acc_dc_glob * 100, 1),
            'macro_f1': round(f1_dc_glob, 3),
            'ece_calibration_error': ece_dc_glob,
            'diagnostics': diag_dc
        },
        'poisson_vs_dixon_coles_correlation': round(corr_p_dc, 3)
    }
    
    results_json = {
        'experiment_name': 'Step 7 Goal Modeling Experiment (Poisson + Dixon-Coles)',
        'dataset_matches': len(processed_df),
        'fold_results': fold_results_table,
        'global_out_of_sample_summary': global_summary
    }
    
    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)
        
    return fold_results_table, global_summary

if __name__ == '__main__':
    run_experiment()
    print("✅ Goal Modeling Execution Complete. Results written to results.json.")
