"""
Statistical Significance & Paired Bootstrap Analysis Utilities (Step 10)
Calculates per-match loss difference L_market - L_candidate, 1000-sample bootstrap 95% CI, and P(candidate beats market).
"""

import numpy as np
from sklearn.metrics import log_loss

def run_paired_bootstrap_test(p_market, p_candidate, y_true, n_bootstraps=1000, seed=42):
    """
    Computes 95% Confidence Interval for Log Loss Difference (Loss_Market - Loss_Candidate).
    Positive difference means Candidate beats Market.
    """
    np.random.seed(seed)
    n_samples = len(y_true)
    
    # Per-match log loss contributions
    loss_mkt = np.zeros(n_samples)
    loss_cand = np.zeros(n_samples)
    
    for i in range(n_samples):
        act = int(y_true.iloc[i])
        pm = np.clip(p_market[i, act], 1e-6, 1.0)
        pc = np.clip(p_candidate[i, act], 1e-6, 1.0)
        loss_mkt[i] = -np.log(pm)
        loss_cand[i] = -np.log(pc)
        
    diff_arr = loss_mkt - loss_cand
    mean_diff = np.mean(diff_arr)
    median_diff = np.median(diff_arr)
    std_diff = np.std(diff_arr)
    
    # Paired Bootstrap
    boot_diffs = []
    for _ in range(n_bootstraps):
        idx = np.random.choice(n_samples, size=n_samples, replace=True)
        boot_diffs.append(np.mean(diff_arr[idx]))
        
    ci_lower = np.percentile(boot_diffs, 2.5)
    ci_upper = np.percentile(boot_diffs, 97.5)
    prob_beats_market = np.mean(np.array(boot_diffs) > 0.0)
    
    return {
        'mean_loss_diff_market_minus_cand': round(float(mean_diff), 4),
        'median_loss_diff': round(float(median_diff), 4),
        'std_loss_diff': round(float(std_diff), 4),
        'ci_95_lower': round(float(ci_lower), 4),
        'ci_95_upper': round(float(ci_upper), 4),
        'probability_beats_market': round(float(prob_beats_market), 3)
    }
