"""
Statistical Significance & Bootstrap Analysis Utilities for Value Strategy (Step 16)
Calculates 1000-sample bootstrap 95% CI for realized ROI and evaluates Hypothesis H0 vs H1.
"""

import numpy as np

def run_roi_bootstrap_test(trades_list, n_bootstraps=1000, seed=42):
    """
    Computes 95% Confidence Interval for Realized ROI across qualified value opportunities.
    """
    if len(trades_list) < 10:
        return {
            'mean_roi_pct': 0.0,
            'ci_95_lower_pct': 0.0,
            'ci_95_upper_pct': 0.0,
            'prob_roi_positive': 0.0,
            'hypothesis_verdict': 'REJECT VALUE STRATEGY (Insufficient Sample Size)'
        }
        
    np.random.seed(seed)
    profits = np.array([t['realized_profit'] for t in trades_list])
    n_trades = len(profits)
    
    boot_rois = []
    for _ in range(n_bootstraps):
        idx = np.random.choice(n_trades, size=n_trades, replace=True)
        boot_profit = np.sum(profits[idx])
        boot_roi = (boot_profit / n_trades) * 100.0
        boot_rois.append(boot_roi)
        
    ci_lower = np.percentile(boot_rois, 2.5)
    ci_upper = np.percentile(boot_rois, 97.5)
    prob_pos = np.mean(np.array(boot_rois) > 0.0)
    mean_roi = np.mean(boot_rois)
    
    if ci_lower > 0.0 and prob_pos >= 0.95:
        verdict = "KEEP AS RESEARCH CANDIDATE (H1 Supported: Statistically Significant Positive ROI)"
    elif mean_roi > 0.0 or prob_pos > 0.50:
        verdict = "CANDIDATE FOR FURTHER VALIDATION (CI Spans Zero)"
    else:
        verdict = "REJECT VALUE STRATEGY (H0 Supported: No Actionable Value Beyond Market)"
        
    return {
        'total_trades': n_trades,
        'mean_roi_pct': round(float(mean_roi), 2),
        'ci_95_lower_pct': round(float(ci_lower), 2),
        'ci_95_upper_pct': round(float(ci_upper), 2),
        'prob_roi_positive': round(float(prob_pos), 3),
        'hypothesis_verdict': verdict
    }
