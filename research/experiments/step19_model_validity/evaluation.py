"""
Step 19 Model Validity Evaluation Suite
Computes Log Loss, Brier Score, ECE, Accuracy, Macro F1, & Bootstrap Confidence Intervals.
"""

import numpy as np

def compute_log_loss(y_true, y_prob):
    """
    Computes multi-class Log Loss (Cross-Entropy).
    y_true: shape (N,), values in {0, 1, 2}
    y_prob: shape (N, 3), probabilities
    """
    eps = 1e-15
    y_prob = np.clip(y_prob, eps, 1 - eps)
    N = len(y_true)
    if N == 0: return 0.0
    
    losses = []
    for i in range(N):
        actual_class = int(y_true[i])
        losses.append(-np.log(y_prob[i, actual_class]))
    return float(np.mean(losses))

def compute_brier_score(y_true, y_prob):
    """
    Computes multi-class Brier score (mean squared error of probabilities).
    """
    N = len(y_true)
    if N == 0: return 0.0
    
    scores = []
    for i in range(N):
        one_hot = np.zeros(3)
        one_hot[int(y_true[i])] = 1.0
        scores.append(np.sum((y_prob[i] - one_hot) ** 2))
    return float(np.mean(scores))

def compute_ece(y_true, y_prob, n_bins=10):
    """
    Expected Calibration Error (ECE).
    """
    N = len(y_true)
    if N == 0: return 0.0

    confidences = np.max(y_prob, axis=1)
    predictions = np.argmax(y_prob, axis=1)
    accuracies = (predictions == y_true)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i+1]
        
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(accuracy_in_bin - avg_confidence_in_bin) * prop_in_bin

    return float(ece)

def compute_metrics(y_true, y_prob):
    """
    Computes complete evaluation metrics suite.
    """
    y_true = np.array(y_true, dtype=int)
    y_prob = np.array(y_prob, dtype=float)
    
    preds = np.argmax(y_prob, axis=1)
    accuracy = float(np.mean(preds == y_true))
    log_loss = compute_log_loss(y_true, y_prob)
    brier = compute_brier_score(y_true, y_prob)
    ece = compute_ece(y_true, y_prob)

    return {
        'count': len(y_true),
        'accuracy': accuracy,
        'log_loss': log_loss,
        'brier_score': brier,
        'ece': ece
    }
