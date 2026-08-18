"""
Research Experiment: Dynamic Rolling Form Features
Evaluates isolated impact of Rolling Form (Global & Venue) across 5 Expanding Walk-Forward Folds.
Outputs results.json and report.md artifact.
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import log_loss, f1_score

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def compute_brier_score(y_true, probs):
    n_samples = len(y_true)
    brier_sum = 0.0
    for i in range(n_samples):
        y_vec = np.zeros(3)
        y_vec[int(y_true.iloc[i])] = 1.0
        p_vec = probs[i]
        brier_sum += np.sum((p_vec - y_vec) ** 2)
    return brier_sum / n_samples

def load_and_preprocess_data():
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
    
    return clean_df

def engineer_all_features(df):
    clean_df = df.copy()
    
    # Track team histories chronologically
    team_history = {}      # team -> list of match objects
    team_home_history = {} # team -> list of home match objects
    team_away_history = {} # team -> list of away match objects
    elos = {}
    
    K = 32
    HOME_ADV = 65
    
    # Feature columns storage
    elo_diffs = []
    
    # Global form lists (3, 5, 10)
    g_form_features = {
        'h_pts_3': [], 'h_pts_5': [], 'h_pts_10': [],
        'a_pts_3': [], 'a_pts_5': [], 'a_pts_10': [],
        'h_gf_3': [], 'h_gf_5': [], 'h_gf_10': [],
        'a_gf_3': [], 'a_gf_5': [], 'a_gf_10': [],
        'h_ga_3': [], 'h_ga_5': [], 'h_ga_10': [],
        'a_ga_3': [], 'a_ga_5': [], 'a_ga_10': [],
        'h_gd_3': [], 'h_gd_5': [], 'h_gd_10': [],
        'a_gd_3': [], 'a_gd_5': [], 'a_gd_10': [],
        
        # Differences
        'pts_diff_3': [], 'pts_diff_5': [], 'pts_diff_10': [],
        'gf_diff_3': [], 'gf_diff_5': [], 'gf_diff_10': [],
        'ga_diff_3': [], 'ga_diff_5': [], 'ga_diff_10': [],
        'gd_diff_3': [], 'gd_diff_5': [], 'gd_diff_10': []
    }
    
    # Venue form lists (last 5)
    v_form_features = {
        'h_pts_home_5': [], 'h_gf_home_5': [], 'h_ga_home_5': [],
        'a_pts_away_5': [], 'a_gf_away_5': [], 'a_ga_away_5': []
    }
    
    for idx, row in clean_df.iterrows():
        h, a = str(row['HomeTeam']), str(row['AwayTeam'])
        if h not in elos: elos[h] = 1500
        if a not in elos: elos[a] = 1500
        if h not in team_history: team_history[h] = []
        if a not in team_history: team_history[a] = []
        if h not in team_home_history: team_home_history[h] = []
        if a not in team_away_history: team_away_history[a] = []
        
        # 1. PRE-MATCH ELO
        r_home_pre, r_away_pre = elos[h], elos[a]
        elo_diffs.append(r_home_pre - r_away_pre)
        
        # 2. PRE-MATCH GLOBAL FORM (Last 3, 5, 10)
        h_hist, a_hist = team_history[h], team_history[a]
        
        for w in [3, 5, 10]:
            h_rec = h_hist[-w:] if len(h_hist) >= w else h_hist
            a_rec = a_hist[-w:] if len(a_hist) >= w else a_hist
            
            h_pts = sum(m['pts'] for m in h_rec) if h_rec else 0
            a_pts = sum(m['pts'] for m in a_rec) if a_rec else 0
            h_gf = sum(m['gf'] for m in h_rec) if h_rec else 0
            a_gf = sum(m['gf'] for m in a_rec) if a_rec else 0
            h_ga = sum(m['ga'] for m in h_rec) if h_rec else 0
            a_ga = sum(m['ga'] for m in a_rec) if a_rec else 0
            h_gd = sum(m['gd'] for m in h_rec) if h_rec else 0
            a_gd = sum(m['gd'] for m in a_rec) if a_rec else 0
            
            g_form_features[f'h_pts_{w}'].append(h_pts)
            g_form_features[f'a_pts_{w}'].append(a_pts)
            g_form_features[f'h_gf_{w}'].append(h_gf)
            g_form_features[f'a_gf_{w}'].append(a_gf)
            g_form_features[f'h_ga_{w}'].append(h_ga)
            g_form_features[f'a_ga_{w}'].append(a_ga)
            g_form_features[f'h_gd_{w}'].append(h_gd)
            g_form_features[f'a_gd_{w}'].append(a_gd)
            
            g_form_features[f'pts_diff_{w}'].append(h_pts - a_pts)
            g_form_features[f'gf_diff_{w}'].append(h_gf - a_gf)
            g_form_features[f'ga_diff_{w}'].append(h_ga - a_ga)
            g_form_features[f'gd_diff_{w}'].append(h_gd - a_gd)
            
        # 3. PRE-MATCH VENUE FORM (Last 5 Home for H, Last 5 Away for A)
        h_v_hist = team_home_history[h][-5:] if len(team_home_history[h]) >= 5 else team_home_history[h]
        a_v_hist = team_away_history[a][-5:] if len(team_away_history[a]) >= 5 else team_away_history[a]
        
        v_form_features['h_pts_home_5'].append(sum(m['pts'] for m in h_v_hist) if h_v_hist else 0)
        v_form_features['h_gf_home_5'].append(sum(m['gf'] for m in h_v_hist) if h_v_hist else 0)
        v_form_features['h_ga_home_5'].append(sum(m['ga'] for m in h_v_hist) if h_v_hist else 0)
        
        v_form_features['a_pts_away_5'].append(sum(m['pts'] for m in a_v_hist) if a_v_hist else 0)
        v_form_features['a_gf_away_5'].append(sum(m['gf'] for m in a_v_hist) if a_v_hist else 0)
        v_form_features['a_ga_away_5'].append(sum(m['ga'] for m in a_v_hist) if a_v_hist else 0)
        
        # 4. OBSERVE MATCH RESULT & UPDATE STATE POST-MATCH
        h_goals, a_goals = int(row['FTHG']), int(row['FTAG'])
        h_pts_m = 3 if h_goals > a_goals else (1 if h_goals == a_goals else 0)
        a_pts_m = 3 if a_goals > h_goals else (1 if a_goals == h_goals else 0)
        
        h_match_obj = {'pts': h_pts_m, 'gf': h_goals, 'ga': a_goals, 'gd': h_goals - a_goals}
        a_match_obj = {'pts': a_pts_m, 'gf': a_goals, 'ga': h_goals, 'gd': a_goals - h_goals}
        
        team_history[h].append(h_match_obj)
        team_history[a].append(a_match_obj)
        team_home_history[h].append(h_match_obj)
        team_away_history[a].append(a_match_obj)
        
        # Elo Update
        eff_home = r_home_pre + HOME_ADV
        exp_home = 1 / (1 + 10 ** ((r_away_pre - eff_home) / 400))
        actual_home = 1.0 if h_goals > a_goals else (0.5 if h_goals == a_goals else 0.0)
        diff = abs(h_goals - a_goals)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (actual_home - exp_home))
        
        elos[h] = r_home_pre + delta
        elos[a] = r_away_pre - delta

    clean_df['EloDiff'] = elo_diffs
    for k, v in g_form_features.items():
        clean_df[k] = v
    for k, v in v_form_features.items():
        clean_df[k] = v
        
    target_map = {'H': 0, 'D': 1, 'A': 2}
    clean_df['Target'] = clean_df['FTR'].map(target_map)
    clean_df = clean_df.dropna(subset=['Target'])
    
    odds_cols = ['B365H', 'B365D', 'B365A']
    for c in odds_cols:
        if c in clean_df.columns:
            clean_df[c] = clean_df[c].ffill().bfill()
        else:
            clean_df[c] = 2.5
            
    clean_df = clean_df.dropna(subset=odds_cols).reset_index(drop=True)
    return clean_df

def run_experiment_evaluation():
    raw_df = load_and_preprocess_data()
    processed_df = engineer_all_features(raw_df)
    
    # Feature configurations
    baseline_features = ['EloDiff', 'B365H', 'B365D', 'B365A']
    
    global_form_features = [
        'h_pts_3', 'h_pts_5', 'h_pts_10', 'a_pts_3', 'a_pts_5', 'a_pts_10',
        'h_gf_3', 'h_gf_5', 'h_gf_10', 'a_gf_3', 'a_gf_5', 'a_gf_10',
        'h_ga_3', 'h_ga_5', 'h_ga_10', 'a_ga_3', 'a_ga_5', 'a_ga_10',
        'h_gd_3', 'h_gd_5', 'h_gd_10', 'a_gd_3', 'a_gd_5', 'a_gd_10',
        'pts_diff_3', 'pts_diff_5', 'pts_diff_10',
        'gf_diff_3', 'gf_diff_5', 'gf_diff_10',
        'ga_diff_3', 'ga_diff_5', 'ga_diff_10',
        'gd_diff_3', 'gd_diff_5', 'gd_diff_10'
    ]
    
    venue_form_features = [
        'h_pts_home_5', 'h_gf_home_5', 'h_ga_home_5',
        'a_pts_away_5', 'a_gf_away_5', 'a_ga_away_5'
    ]
    
    exp_a_features = baseline_features + global_form_features
    exp_b_features = baseline_features + global_form_features + venue_form_features
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    fold_table_a = []
    fold_table_b = []
    
    # Combined Out-of-Sample Predictions across all folds
    out_of_sample_base_y = []
    out_of_sample_base_probs = []
    
    out_of_sample_exp_a_y = []
    out_of_sample_exp_a_probs = []
    
    out_of_sample_exp_b_y = []
    out_of_sample_exp_b_probs = []
    
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        
        y_tr, y_te = train_df['Target'], test_df['Target']
        
        # 1. Baseline Model
        model_base = HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42)
        model_base.fit(train_df[baseline_features], y_tr)
        probs_base = model_base.predict_proba(test_df[baseline_features])
        preds_base = np.argmax(probs_base, axis=1)
        acc_base = (preds_base == y_te.values).mean()
        loss_base = log_loss(y_te, probs_base, labels=[0, 1, 2])
        brier_base = compute_brier_score(y_te, probs_base)
        f1_base = f1_score(y_te, preds_base, average='macro')
        
        # 2. Experiment A (Baseline + Global Form)
        model_a = HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42)
        model_a.fit(train_df[exp_a_features], y_tr)
        probs_a = model_a.predict_proba(test_df[exp_a_features])
        preds_a = np.argmax(probs_a, axis=1)
        acc_a = (preds_a == y_te.values).mean()
        loss_a = log_loss(y_te, probs_a, labels=[0, 1, 2])
        brier_a = compute_brier_score(y_te, probs_a)
        f1_a = f1_score(y_te, preds_a, average='macro')
        
        # 3. Experiment B (Baseline + Global Form + Venue Form)
        model_b = HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42)
        model_b.fit(train_df[exp_b_features], y_tr)
        probs_b = model_b.predict_proba(test_df[exp_b_features])
        preds_b = np.argmax(probs_b, axis=1)
        acc_b = (preds_b == y_te.values).mean()
        loss_b = log_loss(y_te, probs_b, labels=[0, 1, 2])
        brier_b = compute_brier_score(y_te, probs_b)
        f1_b = f1_score(y_te, preds_b, average='macro')
        
        fold_table_a.append({
            'fold': fold + 1,
            'base_loss': round(loss_base, 3), 'exp_a_loss': round(loss_a, 3),
            'base_brier': round(brier_base, 3), 'exp_a_brier': round(brier_a, 3),
            'base_acc': round(acc_base * 100, 1), 'exp_a_acc': round(acc_a * 100, 1),
            'base_f1': round(f1_base, 3), 'exp_a_f1': round(f1_a, 3)
        })
        
        fold_table_b.append({
            'fold': fold + 1,
            'exp_a_loss': round(loss_a, 3), 'exp_b_loss': round(loss_b, 3),
            'exp_a_brier': round(brier_a, 3), 'exp_b_brier': round(brier_b, 3),
            'exp_a_acc': round(acc_a * 100, 1), 'exp_b_acc': round(acc_b * 100, 1),
            'exp_a_f1': round(f1_a, 3), 'exp_b_f1': round(f1_b, 3)
        })
        
        # Accumulate out-of-sample predictions
        out_of_sample_base_y.extend(y_te.values)
        out_of_sample_base_probs.extend(probs_base)
        
        out_of_sample_exp_a_y.extend(y_te.values)
        out_of_sample_exp_a_probs.extend(probs_a)
        
        out_of_sample_exp_b_y.extend(y_te.values)
        out_of_sample_exp_b_probs.extend(probs_b)
        
    # Global Out-of-Sample Results
    global_base_y = pd.Series(out_of_sample_base_y)
    global_base_probs = np.array(out_of_sample_base_probs)
    global_base_preds = np.argmax(global_base_probs, axis=1)
    
    global_a_y = pd.Series(out_of_sample_exp_a_y)
    global_a_probs = np.array(out_of_sample_exp_a_probs)
    global_a_preds = np.argmax(global_a_probs, axis=1)
    
    global_b_y = pd.Series(out_of_sample_exp_b_y)
    global_b_probs = np.array(out_of_sample_exp_b_probs)
    global_b_preds = np.argmax(global_b_probs, axis=1)
    
    global_results = {
        'Baseline': {
            'log_loss': round(log_loss(global_base_y, global_base_probs, labels=[0,1,2]), 3),
            'brier_score': round(compute_brier_score(global_base_y, global_base_probs), 3),
            'accuracy_pct': round((global_base_preds == global_base_y.values).mean() * 100, 1),
            'macro_f1': round(f1_score(global_base_y, global_base_preds, average='macro'), 3)
        },
        'Experiment_A_Global_Form': {
            'log_loss': round(log_loss(global_a_y, global_a_probs, labels=[0,1,2]), 3),
            'brier_score': round(compute_brier_score(global_a_y, global_a_probs), 3),
            'accuracy_pct': round((global_a_preds == global_a_y.values).mean() * 100, 1),
            'macro_f1': round(f1_score(global_a_y, global_a_preds, average='macro'), 3)
        },
        'Experiment_B_Global_Venue_Form': {
            'log_loss': round(log_loss(global_b_y, global_b_probs, labels=[0,1,2]), 3),
            'brier_score': round(compute_brier_score(global_b_y, global_b_probs), 3),
            'accuracy_pct': round((global_b_preds == global_b_y.values).mean() * 100, 1),
            'macro_f1': round(f1_score(global_b_y, global_b_preds, average='macro'), 3)
        }
    }
    
    # Save results.json
    results_json = {
        'experiment_name': 'Dynamic Rolling Form Features Experiment',
        'fold_table_experiment_a': fold_table_a,
        'fold_table_experiment_b': fold_table_b,
        'global_out_of_sample_results': global_results
    }
    
    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)
        
    return fold_table_a, fold_table_b, global_results

if __name__ == '__main__':
    f_a, f_b, g_res = run_experiment_evaluation()
    print("✅ Experiment Execution Complete. Results written to results.json.")
