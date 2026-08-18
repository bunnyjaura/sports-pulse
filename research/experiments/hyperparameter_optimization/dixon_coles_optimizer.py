"""
Dixon-Coles Time Decay Optimization Engine (Step 12)
Evaluates xi in [0.0, 0.0005, 0.001, 0.002, 0.005] using inner chronological validation.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

def optimize_dixon_coles_inner(inner_train_df, inner_val_df):
    xi_candidates = [0.0, 0.0005, 0.001, 0.002, 0.005]
    best_xi = 0.001 # Default baseline
    best_loss = 999.0
    
    for xi in xi_candidates:
        m_dc = DixonColesModel(xi=xi)
        m_dc.fit(inner_train_df)
        
        p_val_list = []
        for _, r in inner_val_df.iterrows():
            p_val_list.append(m_dc.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_val = np.array(p_val_list)
        
        loss = log_loss(inner_val_df['Target'], p_val, labels=[0, 1, 2])
        if loss < best_loss:
            best_loss = loss
            best_xi = xi
            
    return best_xi, round(float(best_loss), 4)
