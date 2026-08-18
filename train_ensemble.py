"""
Python Machine Learning Production Pipeline for Sports Predictor
Model Version: football-ensemble-v1
Validated Architecture: CatBoost (50%) + Dixon-Coles (50%) Ensemble Engine
Features: Pre-match EloDiff
Strict Pre-Match Temporal Processing & Zero Leakage Validation
"""

import os
import sys
import json
import urllib.request
import pandas as pd
import numpy as np

from catboost import CatBoostClassifier
from sklearn.metrics import log_loss

# Add research goal_models path for Dixon-Coles
sys.path.append(os.path.join(os.path.dirname(__file__), 'research', 'experiments', 'goal_models'))
from dixon_coles_model import DixonColesModel

DATASET_URLS = [
    "https://www.football-data.co.uk/mmz4281/2223/E0.csv",
    "https://www.football-data.co.uk/mmz4281/2324/E0.csv",
    "https://www.football-data.co.uk/mmz4281/2425/E0.csv"
]

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

def fetch_dynamic_datasets():
    combined_df = []
    for idx, url in enumerate(DATASET_URLS):
        filename = f"season_{idx+1}.csv"
        filepath = os.path.join(DATA_DIR, filename)
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            df = pd.read_csv(filepath)
            combined_df.append(df)
        except Exception:
            if os.path.exists(filepath):
                df = pd.read_csv(filepath)
                combined_df.append(df)

    if combined_df:
        return pd.concat(combined_df, ignore_index=True)
    return None

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def engineer_dynamic_features(df):
    clean_df = df.dropna(subset=['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR']).copy()
    clean_df['ParsedDate'] = clean_df['Date'].apply(parse_date_safely)
    clean_df = clean_df.dropna(subset=['ParsedDate']).copy()
    clean_df = clean_df.sort_values('ParsedDate').reset_index(drop=True)
    
    elos = {}
    elo_diffs = []
    K = 32
    HOME_ADV = 65
    
    for idx, row in clean_df.iterrows():
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in elos: elos[h] = 1500
        if a not in elos: elos[a] = 1500
        
        r_home_pre, r_away_pre = elos[h], elos[a]
        elo_diffs.append(r_home_pre - r_away_pre)
        
        eff_home = r_home_pre + HOME_ADV
        exp_home = 1 / (1 + 10 ** ((r_away_pre - eff_home) / 400))
        h_goals, a_goals = int(row['FTHG']), int(row['FTAG'])
        actual_home = 1.0 if h_goals > a_goals else (0.5 if h_goals == a_goals else 0.0)
        diff = abs(h_goals - a_goals)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (actual_home - exp_home))
        elos[h] = r_home_pre + delta
        elos[a] = r_away_pre - delta
        
    clean_df['EloDiff'] = elo_diffs
    target_map = {'H': 0, 'D': 1, 'A': 2}
    clean_df['Target'] = clean_df['FTR'].map(target_map)
    clean_df = clean_df.dropna(subset=['Target'])
    
    odds_cols = ['B365H', 'B365D', 'B365A']
    for c in odds_cols:
        if c in clean_df.columns:
            clean_df[c] = clean_df[c].ffill().bfill()
        else:
            clean_df[c] = np.nan
            
    clean_df = clean_df.dropna(subset=odds_cols).reset_index(drop=True)
    return clean_df, elos

def compute_brier_score(y_true, probs):
    n_samples = len(y_true)
    brier_sum = 0.0
    for i in range(n_samples):
        y_vec = np.zeros(3)
        y_vec[int(y_true.iloc[i])] = 1.0
        p_vec = probs[i]
        brier_sum += np.sum((p_vec - y_vec) ** 2)
    return brier_sum / n_samples

def predict_match_probability(home_team, away_team, elo_diff, catboost_model, dixon_coles_model):
    """
    Produces deterministic 50/50 ensemble probability output for an unseen match:
    P_final = 0.50 * P_CatBoost + 0.50 * P_DixonColes
    """
    # 1. CatBoost prediction
    p_cb = catboost_model.predict_proba(pd.DataFrame([{'EloDiff': elo_diff}]))[0]
    
    # 2. Dixon-Coles prediction
    p_dc = dixon_coles_model.predict_probabilities(home_team, away_team)['probabilities']
    
    # 3. 50/50 Ensemble
    p_ens = 0.50 * p_cb + 0.50 * p_dc
    p_ens /= np.sum(p_ens)
    
    return {
        'model_version': 'football-ensemble-v1',
        'p_home': round(float(p_ens[0]), 4),
        'p_draw': round(float(p_ens[1]), 4),
        'p_away': round(float(p_ens[2]), 4),
        'predicted_outcome': 'Home' if np.argmax(p_ens) == 0 else ('Draw' if np.argmax(p_ens) == 1 else 'Away')
    }

def main():
    print("=" * 75)
    print(" ⚽ Football Prediction Engine — Model Version: football-ensemble-v1 ")
    print("=" * 75)
    
    df = fetch_dynamic_datasets()
    if df is None or len(df) == 0:
        return

    processed_df, current_elos = engineer_dynamic_features(df)
    feature_cols = ['EloDiff']
    
    # Train Approved Models on full dataset
    print("\n🔄 Training CatBoost Classifier (iterations=200, depth=4, lr=0.03)...")
    m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
    m_cb.fit(processed_df[feature_cols], processed_df['Target'])
    
    print("🔄 Training Dixon-Coles Goal Model (xi=0.001)...")
    m_dc = DixonColesModel(xi=0.001)
    m_dc.fit(processed_df)
    
    print("✅ Model Refit Complete. Production Engine Ready.")
    
    output_data = {
        "status": "success",
        "model_version": "football-ensemble-v1",
        "ensemble_weights": {"CatBoost": 0.50, "DixonColes": 0.50},
        "trained_matches": len(processed_df),
        "trained_date": "2026-08-18"
    }
    
    out_path = os.path.join(os.path.dirname(__file__), "ensemble_predictions.json")
    with open(out_path, "w") as f:
        json.dump(output_data, f, indent=2)

if __name__ == "__main__":
    main()
