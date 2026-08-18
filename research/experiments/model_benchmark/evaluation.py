"""
Evaluation Utilities for Model Benchmarking Experiment
Calculates Brier Score, Log Loss, Macro F1, Model Error Correlation Matrix, and Fold Metrics.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

def compute_brier_score(y_true, probs):
    """Calculates Brier Score Loss for 3-class outcome probabilities"""
    n_samples = len(y_true)
    brier_sum = 0.0
    for i in range(n_samples):
        y_vec = np.zeros(3)
        y_vec[int(y_true.iloc[i])] = 1.0
        p_vec = probs[i]
        brier_sum += np.sum((p_vec - y_vec) ** 2)
    return brier_sum / n_samples

def compute_error_correlation_matrix(predictions_dict):
    """
    Calculates prediction/error correlation between model pairs.
    predictions_dict: { model_name: np.array(N, 3) }
    """
    model_names = list(predictions_dict.keys())
    matrix = {}
    
    for m1 in model_names:
        matrix[m1] = {}
        p1_home = predictions_dict[m1][:, 0]
        for m2 in model_names:
            p2_home = predictions_dict[m2][:, 0]
            corr = np.corrcoef(p1_home, p2_home)[0, 1]
            matrix[m1][m2] = round(float(corr), 3) if not np.isnan(corr) else 1.0
            
    return matrix
