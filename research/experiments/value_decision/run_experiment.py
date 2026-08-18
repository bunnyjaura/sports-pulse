"""
Step 16 Live Prediction Quality & Value-Bet Decision Layer Runner
Executes Chronological Value Backtests across Edge/EV thresholds, Paired 1000-sample Bootstrap 95% CIs, and Hypothesis Testing (H0 vs H1).
Outputs results.json and report.md artifact.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

from value_calculator import compute_fair_odds_and_value
from value_backtester import run_value_backtest
from statistical_tests import run_roi_bootstrap_test
from evaluation import compute_brier_score, compute_ece

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

from catboost import CatBoostClassifier

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def load_data():
    files = [os.path.join(DATA_DIR, f"season_{i}.csv") for i in range(1, 4)]
    dfs = []
    for f in files:
        if os.path.exists(f):
            dfs.append(pd.read_csv(f))
            
    if not dfs:
        raise FileNotFoundError("Data files season_1.csv .. season_3.csv not found.")
        
    raw_df = pd.concat(dfs, ignore_index=True)
    clean_df = raw_df.dropna(subset=['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR']).copy()
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
    return clean_df

def run_experiment():
    processed_df = load_data()
    feature_cols = ['EloDiff']
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    out_of_sample_y = []
    out_of_sample_p_model = []
    out_of_sample_p_market = []
    out_of_sample_odds_matrix = []
    
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        y_te = test_df['Target']
        
        out_of_sample_y.extend(y_te.values)
        
        # Bookmaker Odds Matrix
        odds_te = test_df[['B365H', 'B365D', 'B365A']].values
        out_of_sample_odds_matrix.extend(odds_te)
        
        # Market Probabilities
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        p_market = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        out_of_sample_p_market.extend(p_market)
        
        # CatBoost Prediction
        m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
        m_cb.fit(train_df[feature_cols], train_df['Target'])
        p_cb = m_cb.predict_proba(test_df[feature_cols])
        
        # Dixon-Coles Prediction
        m_dc = DixonColesModel(xi=0.001)
        m_dc.fit(train_df)
        p_dc_list = []
        for _, r in test_df.iterrows():
            p_dc_list.append(m_dc.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc = np.array(p_dc_list)
        
        # Approved 50/50 Ensemble
        p_ens = 0.50 * p_cb + 0.50 * p_dc
        p_ens /= np.sum(p_ens, axis=1, keepdims=True)
        out_of_sample_p_model.extend(p_ens)

    global_y = pd.Series(out_of_sample_y)
    global_p_model = np.array(out_of_sample_p_model)
    global_p_market = np.array(out_of_sample_p_market)
    global_odds = np.array(out_of_sample_odds_matrix)
    
    # 1. Global Benchmark Loss Comparison
    loss_model = log_loss(global_y, global_p_model, labels=[0, 1, 2])
    loss_mkt = log_loss(global_y, global_p_market, labels=[0, 1, 2])
    
    # 2. Evaluate Value Backtests across Threshold Configurations
    threshold_configs = [
        {'min_edge': 0.01, 'min_ev': 0.01},
        {'min_edge': 0.02, 'min_ev': 0.01},
        {'min_edge': 0.03, 'min_ev': 0.02}, # Primary Candidate Threshold
        {'min_edge': 0.05, 'min_ev': 0.03},
        {'min_edge': 0.05, 'min_ev': 0.05}
    ]
    
    threshold_results = {}
    for cfg in threshold_configs:
        lbl = f"Edge_{cfg['min_edge']}_EV_{cfg['min_ev']}"
        res = run_value_backtest(global_y, global_p_model, global_odds, min_edge=cfg['min_edge'], min_ev=cfg['min_ev'])
        boot_res = run_roi_bootstrap_test(res['trades'], n_bootstraps=1000)
        
        res_summary = res.copy()
        del res_summary['trades']
        res_summary['bootstrap_roi_test'] = boot_res
        threshold_results[lbl] = res_summary

    # Primary Threshold Decision
    primary_key = "Edge_0.03_EV_0.02"
    primary_res = threshold_results[primary_key]
    primary_hypothesis_verdict = primary_res['bootstrap_roi_test']['hypothesis_verdict']
    
    # Final Decision Mapping
    if "KEEP AS RESEARCH CANDIDATE" in primary_hypothesis_verdict:
        final_decision = "KEEP AS RESEARCH CANDIDATE"
    elif "CANDIDATE FOR FURTHER VALIDATION" in primary_hypothesis_verdict:
        final_decision = "CANDIDATE FOR FURTHER VALIDATION"
    else:
        final_decision = "REJECT VALUE STRATEGY"

    global_summary = {
        'Football_Ensemble_Log_Loss': round(float(loss_model), 3),
        'Market_Benchmark_Log_Loss': round(float(loss_mkt), 3),
        'Primary_Threshold_Key': primary_key,
        'Primary_Threshold_Metrics': primary_res,
        'All_Threshold_Configurations': threshold_results,
        'Final_Decision': final_decision
    }

    results_json = {
        'experiment_name': 'Step 16 Live Prediction Quality & Value-Bet Decision Layer',
        'model_version': 'football-ensemble-v1',
        'final_decision': final_decision,
        'global_summary': global_summary
    }

    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)

    return results_json

if __name__ == '__main__':
    run_experiment()
    print("✅ Step 16 Value Decision Experiment Complete. Results written to results.json.")
