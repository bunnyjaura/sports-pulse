"""
Market Implied Probability & Overround Analysis Utilities (Step 10)
Calculates bookmaker overround stats, KL divergence, probability disagreement, and overround quantile buckets.
"""

import numpy as np
import pandas as pd
from scipy.stats import entropy

def compute_overround_stats(odds_h, odds_d, odds_a):
    raw_h = 1.0 / np.array(odds_h)
    raw_d = 1.0 / np.array(odds_d)
    raw_a = 1.0 / np.array(odds_a)
    overrounds = raw_h + raw_d + raw_a
    
    return {
        'mean_overround': round(float(np.mean(overrounds)), 4),
        'median_overround': round(float(np.median(overrounds)), 4),
        'min_overround': round(float(np.min(overrounds)), 4),
        'max_overround': round(float(np.max(overrounds)), 4),
        'std_overround': round(float(np.std(overrounds)), 4),
        'overrounds_array': overrounds
    }

def compute_kl_divergence_and_disagreement(p_market, p_football):
    """
    p_market: (N, 3)
    p_football: (N, 3)
    Returns max_abs_diff and KL divergence per match.
    """
    n_samples = len(p_market)
    abs_diffs = np.abs(p_market - p_football)
    max_diffs = np.max(abs_diffs, axis=1)
    
    kl_divs = np.zeros(n_samples)
    for i in range(n_samples):
        p_m = np.clip(p_market[i], 1e-6, 1.0)
        p_f = np.clip(p_football[i], 1e-6, 1.0)
        p_m /= np.sum(p_m)
        p_f /= np.sum(p_f)
        kl_divs[i] = entropy(p_f, p_m) # KL(Football || Market)
        
    return {
        'max_abs_diffs': max_diffs,
        'kl_divergences': kl_divs,
        'mean_max_diff': round(float(np.mean(max_diffs)), 4),
        'mean_kl_divergence': round(float(np.mean(kl_divs)), 4)
    }

def bucket_by_quantiles(data_array, n_buckets=5):
    quantiles = np.linspace(0, 100, n_buckets + 1)
    thresholds = np.percentile(data_array, quantiles)
    bucket_indices = np.digitize(data_array, thresholds[1:-1])
    return bucket_indices, thresholds
