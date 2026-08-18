"""
Final Evaluation Engine (Step 13)
Evaluates Approved 50/50 Football Ensemble vs Historical Class Frequency, Always Home, CatBoost Alone, Dixon-Coles Alone, and Market Benchmark.
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

def evaluate_baseline_benchmarks(y_true):
    """
    1. Historical Class Frequency Baseline (P_H=0.45, P_D=0.25, P_A=0.30)
    2. Always Home Baseline (P_H=1.0, P_D=0, P_A=0)
    """
    n_samples = len(y_true)
    
    # 1. Historical Class Frequency
    p_freq = np.tile([0.45, 0.25, 0.30], (n_samples, 1))
    loss_freq = log_loss(y_true, p_freq, labels=[0, 1, 2])
    brier_freq = compute_brier_score(y_true, p_freq)
    acc_freq = (np.argmax(p_freq, axis=1) == y_true.values).mean()
    
    # 2. Always Home
    p_home = np.tile([0.98, 0.01, 0.01], (n_samples, 1))
    loss_home = log_loss(y_true, p_home, labels=[0, 1, 2])
    brier_home = compute_brier_score(y_true, p_home)
    acc_home = (y_true.values == 0).mean()
    
    return {
        'Historical_Class_Frequency': {
            'log_loss': round(float(loss_freq), 3),
            'brier_score': round(float(brier_freq), 3),
            'accuracy_pct': round(float(acc_freq * 100), 1)
        },
        'Always_Home_Baseline': {
            'log_loss': round(float(loss_home), 3),
            'brier_score': round(float(brier_home), 3),
            'accuracy_pct': round(float(acc_home * 100), 1)
        }
    }
