"""
Ensemble Weight Optimization Engine (Step 9)
Uses scipy.optimize.minimize to solve non-negative log-loss weight optimization:
  min LogLoss(y_true, sum(w_k * P_k))
  subject to sum(w_k) = 1, w_k >= 0.
Includes expanding fold training and conservative weight regularization.
"""

import numpy as np
from scipy.optimize import minimize
from sklearn.metrics import log_loss

def optimize_ensemble_weights(preds_list, y_true, regularized=False, min_w=0.0):
    """
    preds_list: list of np.ndarray of shape (N, 3), one per model candidate
    y_true: np.ndarray of shape (N,) target integers 0, 1, 2
    regularized: if True, applies min_w constraint to prevent single-model takeover
    """
    n_models = len(preds_list)
    if n_models == 1:
        return np.array([1.0])
        
    init_weights = np.ones(n_models) / n_models
    bounds = [(min_w if regularized else 0.0, 1.0) for _ in range(n_models)]
    constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0})
    
    def objective(weights):
        # Normalize weights safely
        w_norm = weights / np.sum(weights)
        ens_p = np.zeros_like(preds_list[0])
        for k in range(n_models):
            ens_p += w_norm[k] * preds_list[k]
            
        # Ensure row sums = 1
        sums = np.sum(ens_p, axis=1, keepdims=True)
        sums[sums == 0] = 1.0
        ens_p /= sums
        
        loss = log_loss(y_true, ens_p, labels=[0, 1, 2])
        if regularized:
            # L2 penalty to encourage model diversity
            penalty = 0.01 * np.sum(w_norm ** 2)
            loss += penalty
        return loss

    res = minimize(objective, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
    opt_w = res.x
    opt_w = np.clip(opt_w, 0.0, 1.0)
    opt_w /= np.sum(opt_w)
    return np.round(opt_w, 3)

def combine_probabilities(preds_list, weights):
    weights = np.array(weights)
    weights /= np.sum(weights)
    ens_p = np.zeros_like(preds_list[0])
    for k in range(len(preds_list)):
        ens_p += weights[k] * preds_list[k]
    sums = np.sum(ens_p, axis=1, keepdims=True)
    sums[sums == 0] = 1.0
    return ens_p / sums
