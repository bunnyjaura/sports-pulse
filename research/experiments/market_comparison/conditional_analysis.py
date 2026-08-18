"""
Conditional Performance & Draw Analysis Utilities (Step 10)
Evaluates conditional Log Loss by Market Confidence, Disagreement Quantiles, and Outcome Class (Home, Draw, Away).
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, precision_score, recall_score

def compute_outcome_class_metrics(y_true, probs):
    """
    Computes class-specific log loss, Brier contribution, precision, and recall.
    """
    n_samples = len(y_true)
    preds = np.argmax(probs, axis=1)
    
    class_metrics = {}
    class_names = ['Home', 'Draw', 'Away']
    
    for k in range(3):
        y_k = (y_true.values == k).astype(int)
        p_k = probs[:, k]
        pred_k = (preds == k).astype(int)
        
        # Binary cross entropy for class k
        p_k_clip = np.clip(p_k, 1e-6, 1.0 - 1e-6)
        bce = -np.mean(y_k * np.log(p_k_clip) + (1 - y_k) * np.log(1 - p_k_clip))
        brier_k = np.mean((p_k - y_k) ** 2)
        
        prec = precision_score(y_k, pred_k, zero_division=0)
        rec = recall_score(y_k, pred_k, zero_division=0)
        
        class_metrics[class_names[k]] = {
            'class_log_loss': round(float(bce), 3),
            'brier_contribution': round(float(brier_k), 3),
            'precision': round(float(prec), 3),
            'recall': round(float(rec), 3),
            'mean_predicted_prob': round(float(np.mean(p_k)), 3),
            'actual_class_frequency': round(float(np.mean(y_k)), 3)
        }
        
    return class_metrics

def compute_draw_specific_analysis(y_true, p_market_draw, p_catboost_draw, p_dc_draw, p_ens_draw):
    """
    Dedicated analysis of Draw outcomes across models.
    """
    y_draw = (y_true.values == 1).astype(int)
    act_freq = float(np.mean(y_draw))
    
    models_p = {
        'Market': p_market_draw,
        'CatBoost': p_catboost_draw,
        'Dixon-Coles': p_dc_draw,
        'CatBoost_DC_5050': p_ens_draw
    }
    
    draw_summary = {'actual_draw_frequency': round(act_freq, 3)}
    
    for m_name, p_d in models_p.items():
        p_d_clip = np.clip(p_d, 1e-6, 1.0 - 1e-6)
        bce = -np.mean(y_draw * np.log(p_d_clip) + (1 - y_draw) * np.log(1 - p_d_clip))
        brier = np.mean((p_d - y_draw) ** 2)
        
        draw_summary[m_name] = {
            'draw_log_loss': round(float(bce), 3),
            'draw_brier': round(float(brier), 3),
            'mean_predicted_draw_prob': round(float(np.mean(p_d)), 3)
        }
        
    return draw_summary
