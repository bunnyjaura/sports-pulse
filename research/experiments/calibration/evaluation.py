"""
Evaluation & Reliability Analysis Utilities for Calibration Experiment (Step 8)
Computes Brier Score, Log Loss, Macro F1, ECE, and Reliability Bins Data across 5 probability bins.
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

def compute_ece_and_reliability_bins(y_true, probs, n_bins=5):
    """
    Computes Expected Calibration Error (ECE) and detailed reliability curves for Home, Draw, Away.
    """
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    total_samples = len(y_true)
    
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
            
    # Class-wise reliability curves
    class_labels = ['Home', 'Draw', 'Away']
    reliability_curves = {}
    
    for c_idx, c_label in enumerate(class_labels):
        p_class = probs[:, c_idx]
        y_class = (y_true.values == c_idx).astype(float)
        
        curve = []
        for k in range(n_bins):
            bin_l, bin_u = bins[k], bins[k+1]
            m = (p_class >= bin_l) & (p_class < bin_u)
            if k == n_bins - 1: m = (p_class >= bin_l) & (p_class <= bin_u)
            
            c_num = int(np.sum(m))
            if c_num > 0:
                curve.append({
                    'bin_range': f"{round(bin_l, 1)}-{round(bin_u, 1)}",
                    'mean_predicted_prob': round(float(np.mean(p_class[m])), 3),
                    'actual_frequency': round(float(np.mean(y_class[m])), 3),
                    'sample_count': c_num
                })
        reliability_curves[c_label] = curve
        
    return round(float(ece), 3), reliability_curves
