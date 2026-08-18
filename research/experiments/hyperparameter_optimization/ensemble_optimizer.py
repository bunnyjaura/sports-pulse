"""
Ensemble Weight Optimization Engine (Step 12)
Searches CatBoost weight w_cb in [0.25, 0.40, 0.50, 0.60, 0.75] using inner validation predictions.
"""

import numpy as np
from sklearn.metrics import log_loss

def optimize_ensemble_weight_inner(p_val_cb, p_val_dc, y_val):
    w_candidates = [0.25, 0.40, 0.50, 0.60, 0.75]
    best_w = 0.50 # Default baseline
    best_loss = 999.0
    
    for w in w_candidates:
        p_ens = w * p_val_cb + (1.0 - w) * p_val_dc
        p_ens /= np.sum(p_ens, axis=1, keepdims=True)
        loss = log_loss(y_val, p_ens, labels=[0, 1, 2])
        if loss < best_loss:
            best_loss = loss
            best_w = w
            
    return best_w, round(float(best_loss), 4)
