"""
Evaluation Utilities for Step 16 Value-Bet Decision Experiment
Computes Log Loss, Brier Score, ECE, Accuracy %, and Macro F1.
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
            
    return round(float(ece), 3)
