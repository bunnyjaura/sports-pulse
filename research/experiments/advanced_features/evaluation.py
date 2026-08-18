"""
Evaluation Utilities for Step 11 Advanced Feature Engineering Experiment
Computes Log Loss, Brier Score, ECE, Accuracy %, Macro F1, and Paired 1000-Sample Bootstrap 95% CIs.
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

def run_paired_bootstrap_test(p_baseline, p_candidate, y_true, n_bootstraps=1000, seed=42):
    """
    Computes 95% Confidence Interval for Log Loss Improvement (Loss_Baseline - Loss_Candidate).
    Positive difference means Candidate beats Baseline.
    """
    np.random.seed(seed)
    n_samples = len(y_true)
    
    loss_base = np.zeros(n_samples)
    loss_cand = np.zeros(n_samples)
    
    for i in range(n_samples):
        act = int(y_true.iloc[i])
        pb = np.clip(p_baseline[i, act], 1e-6, 1.0)
        pc = np.clip(p_candidate[i, act], 1e-6, 1.0)
        loss_base[i] = -np.log(pb)
        loss_cand[i] = -np.log(pc)
        
    diff_arr = loss_base - loss_cand
    mean_diff = np.mean(diff_arr)
    
    boot_diffs = []
    for _ in range(n_bootstraps):
        idx = np.random.choice(n_samples, size=n_samples, replace=True)
        boot_diffs.append(np.mean(diff_arr[idx]))
        
    ci_lower = np.percentile(boot_diffs, 2.5)
    ci_upper = np.percentile(boot_diffs, 97.5)
    prob_beats_base = np.mean(np.array(boot_diffs) > 0.0)
    
    return {
        'mean_loss_diff_base_minus_cand': round(float(mean_diff), 4),
        'ci_95_lower': round(float(ci_lower), 4),
        'ci_95_upper': round(float(ci_upper), 4),
        'probability_beats_baseline': round(float(prob_beats_base), 3)
    }
