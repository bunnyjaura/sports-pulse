"""
Market Blend & Shrinkage Experiment (Step 10)
Evaluates fixed market/football blends and expanding chronological optimal shrinkage alpha.
Formulation: P_final = alpha * P_football + (1 - alpha) * P_market.
"""

import numpy as np
from sklearn.metrics import log_loss
from evaluation import compute_brier_score, compute_ece

def evaluate_fixed_blends(p_market, p_football, y_true):
    blends = [
        ('95_Market_5_Football', 0.05),
        ('90_Market_10_Football', 0.10),
        ('85_Market_15_Football', 0.15),
        ('80_Market_20_Football', 0.20),
        ('75_Market_25_Football', 0.25),
        ('70_Market_30_Football', 0.30),
        ('50_Market_50_Football', 0.50)
    ]
    
    results = {}
    for label, alpha in blends:
        p_blend = alpha * p_football + (1.0 - alpha) * p_market
        p_blend /= np.sum(p_blend, axis=1, keepdims=True)
        
        preds = np.argmax(p_blend, axis=1)
        loss = log_loss(y_true, p_blend, labels=[0, 1, 2])
        brier = compute_brier_score(y_true, p_blend)
        acc = (preds == y_true.values).mean()
        ece = compute_ece(y_true, p_blend)
        
        results[label] = {
            'alpha': alpha,
            'log_loss': round(float(loss), 3),
            'brier_score': round(float(brier), 3),
            'ece_calibration_error': ece,
            'accuracy_pct': round(float(acc * 100), 1)
        }
        
    return results

def find_optimal_alpha_historical(p_market_hist, p_football_hist, y_true_hist, alpha_grid=None):
    if alpha_grid is None:
        alpha_grid = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]
        
    best_alpha = 0.0
    best_loss = 999.0
    
    for alpha in alpha_grid:
        p_blend = alpha * p_football_hist + (1.0 - alpha) * p_market_hist
        p_blend /= np.sum(p_blend, axis=1, keepdims=True)
        loss = log_loss(y_true_hist, p_blend, labels=[0, 1, 2])
        
        if loss < best_loss:
            best_loss = loss
            best_alpha = alpha
            
    return best_alpha
