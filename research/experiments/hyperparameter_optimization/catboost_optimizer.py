"""
CatBoost Nested Hyperparameter Optimization Engine (Step 12)
Searches depth, learning_rate, iterations, and l2_leaf_reg on inner chronological validation data.
Zero test leakage.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss
from catboost import CatBoostClassifier

def get_catboost_grid():
    grid = []
    depths = [3, 4, 5, 6]
    lrs = [0.01, 0.03, 0.05, 0.08]
    iters = [150, 200, 300]
    l2s = [3, 5, 10]
    
    for d in depths:
        for lr in lrs:
            for it in iters:
                for l2 in l2s:
                    grid.append({
                        'depth': d,
                        'learning_rate': lr,
                        'iterations': it,
                        'l2_leaf_reg': l2,
                        'random_seed': 42,
                        'verbose': 0
                    })
    return grid

def optimize_catboost_inner(inner_train_df, inner_val_df, feature_cols):
    """
    Fits candidate configurations on inner train, evaluates on inner val.
    Returns best configuration based on inner val Log Loss.
    """
    grid = get_catboost_grid()
    
    # Baseline default configuration
    default_cfg = {'depth': 4, 'learning_rate': 0.03, 'iterations': 200, 'l2_leaf_reg': 5, 'random_seed': 42, 'verbose': 0}
    
    m_def = CatBoostClassifier(**default_cfg)
    m_def.fit(inner_train_df[feature_cols], inner_train_df['Target'])
    p_val_def = m_def.predict_proba(inner_val_df[feature_cols])
    best_loss = log_loss(inner_val_df['Target'], p_val_def, labels=[0, 1, 2])
    best_cfg = default_cfg
    
    # Controlled subset search (20 random configs) to maintain runtime efficiency
    np.random.seed(42)
    sample_indices = np.random.choice(len(grid), size=min(20, len(grid)), replace=False)
    
    for idx in sample_indices:
        cfg = grid[idx]
        m = CatBoostClassifier(**cfg)
        m.fit(inner_train_df[feature_cols], inner_train_df['Target'])
        p_val = m.predict_proba(inner_val_df[feature_cols])
        loss = log_loss(inner_val_df['Target'], p_val, labels=[0, 1, 2])
        
        if loss < best_loss:
            best_loss = loss
            best_cfg = cfg
            
    return best_cfg, round(float(best_loss), 4)
