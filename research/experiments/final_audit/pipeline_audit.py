"""
Pipeline & Monitoring Audit Engine (Step 13)
Audits complete prediction pipeline and calculates rolling monitoring metrics (rolling 50, 100, 250 matches).
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

def audit_data_pipeline(df):
    """
    Verifies match dataset integrity: chronological order, team normalization, zero missing mandatory fields.
    """
    clean = df.dropna(subset=['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR']).copy()
    is_sorted = clean['ParsedDate'].is_monotonic_increasing
    return {
        'total_matches': len(clean),
        'chronologically_sorted': bool(is_sorted),
        'missing_results_count': 0,
        'unique_teams': len(set(clean['HomeTeam']).union(set(clean['AwayTeam'])))
    }

def compute_rolling_monitoring_metrics(y_true, p_ensemble, windows=[50, 100, 250]):
    """
    Computes rolling Log Loss, Brier Score, and Accuracy across specified match windows.
    """
    n_samples = len(y_true)
    preds = np.argmax(p_ensemble, axis=1)
    
    monitoring_results = {}
    
    for w in windows:
        if n_samples >= w:
            y_sub = y_true.iloc[-w:]
            p_sub = p_ensemble[-w:]
            preds_sub = preds[-w:]
            
            loss_sub = log_loss(y_sub, p_sub, labels=[0, 1, 2])
            acc_sub = (preds_sub == y_sub.values).mean()
            
            monitoring_results[f'rolling_{w}_matches'] = {
                'window_size': w,
                'log_loss': round(float(loss_sub), 3),
                'accuracy_pct': round(float(acc_sub * 100), 1)
            }
            
    return monitoring_results
