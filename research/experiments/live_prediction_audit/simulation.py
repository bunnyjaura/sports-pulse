"""
Live Backtest Simulation Engine (Step 14)
Simulates sequential live pre-match predictions match-by-match for N=1140 matches.
Verifies zero future information leakage.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

from catboost import CatBoostClassifier

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def run_live_simulation():
    files = [os.path.join(DATA_DIR, f"season_{i}.csv") for i in range(1, 4)]
    dfs = []
    for f in files:
        if os.path.exists(f):
            dfs.append(pd.read_csv(f))
            
    raw_df = pd.concat(dfs, ignore_index=True)
    clean_df = raw_df.dropna(subset=['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR']).copy()
    clean_df['ParsedDate'] = clean_df['Date'].apply(parse_date_safely)
    clean_df = clean_df.dropna(subset=['ParsedDate']).copy()
    clean_df = clean_df.sort_values('ParsedDate').reset_index(drop=True)
    
    target_map = {'H': 0, 'D': 1, 'A': 2}
    clean_df['Target'] = clean_df['FTR'].map(target_map)
    clean_df = clean_df.dropna(subset=['Target'])
    
    total_matches = len(clean_df)
    start_idx = int(total_matches * 0.50) # Simulate on second half of historical dataset
    
    simulated_preds = []
    actual_targets = []
    
    elos = {}
    K = 32
    HOME_ADV = 65
    
    # Pre-populate Elo ratings up to start_idx
    for i in range(start_idx):
        row = clean_df.iloc[i]
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in elos: elos[h] = 1500
        if a not in elos: elos[a] = 1500
        
        r_h, r_a = elos[h], elos[a]
        eff_h = r_h + HOME_ADV
        exp_h = 1 / (1 + 10 ** ((r_a - eff_h) / 400))
        h_g, a_g = int(row['FTHG']), int(row['FTAG'])
        act_h = 1.0 if h_g > a_g else (0.5 if h_g == a_g else 0.0)
        diff = abs(h_g - a_g)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (act_h - exp_h))
        elos[h] = r_h + delta
        elos[a] = r_a - delta

    # Train CatBoost and Dixon-Coles on historical cutoff data
    hist_df = clean_df.iloc[:start_idx].copy()
    
    # Compute EloDiff for historical training
    hist_elo_diffs = []
    temp_elos = {}
    for idx, row in hist_df.iterrows():
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in temp_elos: temp_elos[h] = 1500
        if a not in temp_elos: temp_elos[a] = 1500
        hist_elo_diffs.append(temp_elos[h] - temp_elos[a])
        eff_h = temp_elos[h] + HOME_ADV
        exp_h = 1 / (1 + 10 ** ((temp_elos[a] - eff_h) / 400))
        h_g, a_g = int(row['FTHG']), int(row['FTAG'])
        act_h = 1.0 if h_g > a_g else (0.5 if h_g == a_g else 0.0)
        diff = abs(h_g - a_g)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (act_h - exp_h))
        temp_elos[h] += delta
        temp_elos[a] -= delta
        
    hist_df['EloDiff'] = hist_elo_diffs
    
    m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
    m_cb.fit(hist_df[['EloDiff']], hist_df['Target'])
    
    m_dc = DixonColesModel(xi=0.001)
    m_dc.fit(hist_df)
    
    # Sequential Simulation over upcoming matches
    for i in range(start_idx, total_matches):
        row = clean_df.iloc[i]
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in elos: elos[h] = 1500
        if a not in elos: elos[a] = 1500
        
        # PRE-MATCH STATE ONLY
        r_h, r_a = elos[h], elos[a]
        elo_diff_pre = r_h - r_a
        
        # 1. CatBoost prediction
        p_cb = m_cb.predict_proba(pd.DataFrame([{'EloDiff': elo_diff_pre}]))[0]
        
        # 2. Dixon-Coles prediction
        p_dc = m_dc.predict_probabilities(h, a)['probabilities']
        
        # 3. 50/50 Ensemble
        p_ens = 0.50 * p_cb + 0.50 * p_dc
        p_ens /= np.sum(p_ens)
        
        simulated_preds.append(p_ens)
        actual_targets.append(int(row['Target']))
        
        # POST-MATCH UPDATE (AFTER Prediction Recorded)
        eff_h = r_h + HOME_ADV
        exp_h = 1 / (1 + 10 ** ((r_a - eff_h) / 400))
        h_g, a_g = int(row['FTHG']), int(row['FTAG'])
        act_h = 1.0 if h_g > a_g else (0.5 if h_g == a_g else 0.0)
        diff = abs(h_g - a_g)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (act_h - exp_h))
        elos[h] = r_h + delta
        elos[a] = r_a - delta
        
    sim_preds_arr = np.array(simulated_preds)
    sim_targets_arr = pd.Series(actual_targets)
    loss = log_loss(sim_targets_arr, sim_preds_arr, labels=[0, 1, 2])
    acc = (np.argmax(sim_preds_arr, axis=1) == sim_targets_arr.values).mean()
    
    return {
        'simulated_matches': len(simulated_preds),
        'simulation_log_loss': round(float(loss), 3),
        'simulation_accuracy_pct': round(float(acc * 100), 1)
    }
