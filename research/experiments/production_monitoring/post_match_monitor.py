"""
Post-Match Monitoring Engine (Step 15)
Calculates Log Loss, Brier Score, and Accuracy when actual match outcomes become available without mutating pre-match probabilities.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

def evaluate_post_match_prediction(pre_match_record, actual_result):
    """
    pre_match_record: dict containing immutable pre-match probabilities
    actual_result: 'H', 'D', or 'A'
    """
    target_map = {'H': 0, 'D': 1, 'A': 2}
    y_true = target_map[actual_result]
    
    p_h = pre_match_record['probabilities']['home']
    p_d = pre_match_record['probabilities']['draw']
    p_a = pre_match_record['probabilities']['away']
    probs = np.array([p_h, p_d, p_a])
    
    p_act = np.clip(probs[y_true], 1e-6, 1.0)
    loss = -np.log(p_act)
    
    y_vec = np.zeros(3)
    y_vec[y_true] = 1.0
    brier = np.sum((probs - y_vec) ** 2)
    
    pred_class = np.argmax(probs)
    is_correct = bool(pred_class == y_true)
    
    # Store immutable record + evaluation separately
    eval_record = pre_match_record.copy()
    eval_record['evaluation'] = {
        'actual_result': actual_result,
        'log_loss': round(float(loss), 4),
        'brier_score': round(float(brier), 4),
        'is_correct': is_correct
    }
    return eval_record
