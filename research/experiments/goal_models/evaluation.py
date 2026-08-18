"""
Evaluation & Calibration Diagnostics for Goal Models (Step 7)
Computes Brier Score, Log Loss, Macro F1, Expected Calibration Error (ECE), and Goal Rate Diagnostics.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

def compute_brier_score(y_true, probs):
    n_samples = len(y_true)
    brier_sum = 0.0
    for i in range(n_samples):
        y_vec = np.zeros(3)
        y_vec[int(y_true.iloc[i])] = 1.0
        p_vec = probs[i]
        brier_sum += np.sum((p_vec - y_vec) ** 2)
    return brier_sum / n_samples

def compute_ece(y_true, probs, n_bins=5):
    """
    Computes Expected Calibration Error (ECE) across n_bins probability bins for 3-class outcomes.
    """
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    total_samples = len(y_true)
    
    # Flatten across all 3 classes
    all_probs = probs.flatten()
    all_targets = np.zeros_like(probs)
    for i in range(total_samples):
        all_targets[i, int(y_true.iloc[i])] = 1.0
    all_targets = all_targets.flatten()
    
    for k in range(n_bins):
        bin_lower = bins[k]
        bin_upper = bins[k+1]
        
        mask = (all_probs >= bin_lower) & (all_probs < bin_upper)
        if k == n_bins - 1:
            mask = (all_probs >= bin_lower) & (all_probs <= bin_upper)
            
        bin_count = np.sum(mask)
        if bin_count > 0:
            avg_prob = np.mean(all_probs[mask])
            avg_acc = np.mean(all_targets[mask])
            ece += (bin_count / len(all_probs)) * abs(avg_prob - avg_acc)
            
    return round(float(ece), 3)

def compute_goal_diagnostics(actual_home_goals, actual_away_goals, pred_lambdas_home, pred_lambdas_away):
    """
    Computes mean predicted goals vs actual goals and goal distribution (0, 1, 2, 3, 4+).
    """
    actual_home = np.array(actual_home_goals)
    actual_away = np.array(actual_away_goals)
    pred_home = np.array(pred_lambdas_home)
    pred_away = np.array(pred_lambdas_away)
    
    def get_dist(arr):
        total = len(arr)
        if total == 0: return {}
        return {
            '0_goals': round(float((arr == 0).mean()), 3),
            '1_goal': round(float((arr == 1).mean()), 3),
            '2_goals': round(float((arr == 2).mean()), 3),
            '3_goals': round(float((arr == 3).mean()), 3),
            '4_plus_goals': round(float((arr >= 4).mean()), 3)
        }
        
    return {
        'mean_actual_home_goals': round(float(np.mean(actual_home)), 3),
        'mean_predicted_home_goals': round(float(np.mean(pred_home)), 3),
        'mean_actual_away_goals': round(float(np.mean(actual_away)), 3),
        'mean_predicted_away_goals': round(float(np.mean(pred_away)), 3),
        'actual_home_distribution': get_dist(actual_home),
        'actual_away_distribution': get_dist(actual_away)
    }
