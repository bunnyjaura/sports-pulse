"""
Step 10 Market Comparison & Information-Value Experiment Runner
Executes Overround Analysis, Probability Disagreement Buckets, Conditional Outcome & Draw Analysis,
Fixed/Optimized Market Shrinkage, Paired 1000-sample Bootstrap 95% CIs, and exports report.md & results.json.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, f1_score

# Imports from Step 10 modules
from market_analysis import compute_overround_stats, compute_kl_divergence_and_disagreement, bucket_by_quantiles
from conditional_analysis import compute_outcome_class_metrics, compute_draw_specific_analysis
from blend_experiment import evaluate_fixed_blends, find_optimal_alpha_historical
from statistical_tests import run_paired_bootstrap_test
from evaluation import compute_brier_score, compute_ece

# Imports from research folders
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'goal_models'))
from dixon_coles_model import DixonColesModel

from catboost import CatBoostClassifier

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
EXP_DIR = os.path.dirname(__file__)

def parse_date_safely(date_val):
    if pd.isna(date_val):
        return pd.NaT
    return pd.to_datetime(date_val, dayfirst=True, format='mixed', errors='coerce')

def load_dataset():
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
    processed_df = load_dataset()
    feature_cols = ['EloDiff', 'B365H', 'B365D', 'B365A']
    
    num_folds = 5
    total_samples = len(processed_df)
    min_train_size = int(total_samples * 0.50)
    remaining = total_samples - min_train_size
    fold_step = remaining // num_folds
    
    fold_results = []
    
    out_of_sample_y = []
    out_of_sample_p_market = []
    out_of_sample_p_catboost = []
    out_of_sample_p_dc = []
    out_of_sample_p_football = [] # CatBoost + DC (50/50)
    out_of_sample_p_opt_blend = []
    
    out_of_sample_odds_h = []
    out_of_sample_odds_d = []
    out_of_sample_odds_a = []
    
    # Historical OOS accumulators for expanding alpha selection
    history_y = []
    history_p_market = []
    history_p_football = []
    
    fold_alphas = []
    
    for fold in range(num_folds):
        train_end = min_train_size + (fold * fold_step)
        test_end = min(total_samples, train_end + fold_step)
        
        train_df = processed_df.iloc[:train_end]
        test_df = processed_df.iloc[train_end:test_end]
        y_te = test_df['Target']
        n_te = len(test_df)
        
        out_of_sample_y.extend(y_te.values)
        out_of_sample_odds_h.extend(test_df['B365H'].values)
        out_of_sample_odds_d.extend(test_df['B365D'].values)
        out_of_sample_odds_a.extend(test_df['B365A'].values)
        
        # 1. Market Probabilities
        raw_h = 1.0 / test_df['B365H'].values
        raw_d = 1.0 / test_df['B365D'].values
        raw_a = 1.0 / test_df['B365A'].values
        overround = raw_h + raw_d + raw_a
        p_market = np.column_stack([raw_h / overround, raw_d / overround, raw_a / overround])
        
        # 2. CatBoost Raw
        m_cb = CatBoostClassifier(loss_function='MultiClass', iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42, verbose=0)
        m_cb.fit(train_df[feature_cols], train_df['Target'])
        p_cb = m_cb.predict_proba(test_df[feature_cols])
        
        # 3. Dixon-Coles Raw
        m_dc = DixonColesModel(xi=0.001)
        m_dc.fit(train_df)
        p_dc_list = []
        for _, r in test_df.iterrows():
            p_dc_list.append(m_dc.predict_probabilities(r['HomeTeam'], r['AwayTeam'])['probabilities'])
        p_dc = np.array(p_dc_list)
        
        # 4. Football Ensemble (CatBoost + DC 50/50)
        p_fb = 0.5 * p_cb + 0.5 * p_dc
        p_fb /= np.sum(p_fb, axis=1, keepdims=True)
        
        out_of_sample_p_market.extend(p_market)
        out_of_sample_p_catboost.extend(p_cb)
        out_of_sample_p_dc.extend(p_dc)
        out_of_sample_p_football.extend(p_fb)
        
        # Chronological expanding alpha selection for test fold
        if fold == 0:
            alpha = 0.05 # Conservative initial shrinkage alpha
        else:
            past_y = pd.Series(history_y)
            past_mkt = np.array(history_p_market)
            past_fb = np.array(history_p_football)
            alpha = find_optimal_alpha_historical(past_mkt, past_fb, past_y)
            
        fold_alphas.append(alpha)
        
        p_opt_blend = alpha * p_fb + (1.0 - alpha) * p_market
        p_opt_blend /= np.sum(p_opt_blend, axis=1, keepdims=True)
        out_of_sample_p_opt_blend.extend(p_opt_blend)
        
        # Append fold to history
        history_y.extend(y_te.values)
        history_p_market.extend(p_market)
        history_p_football.extend(p_fb)
        
        # Fold Metrics
        loss_mkt = log_loss(y_te, p_market, labels=[0, 1, 2])
        loss_fb = log_loss(y_te, p_fb, labels=[0, 1, 2])
        loss_blend = log_loss(y_te, p_opt_blend, labels=[0, 1, 2])
        
        fold_results.append({
            'fold': fold + 1,
            'train_size': len(train_df),
            'test_size': n_te,
            'test_window': f"{test_df['ParsedDate'].min().strftime('%Y-%m-%d')} -> {test_df['ParsedDate'].max().strftime('%Y-%m-%d')}",
            'optimal_alpha': alpha,
            'market_log_loss': round(loss_mkt, 3),
            'football_log_loss': round(loss_fb, 3),
            'candidate_blend_log_loss': round(loss_blend, 3),
            'candidate_beats_market': bool(loss_blend < loss_mkt)
        })

    # Global Arrays
    global_y = pd.Series(out_of_sample_y)
    global_mkt = np.array(out_of_sample_p_market)
    global_cb = np.array(out_of_sample_p_catboost)
    global_dc = np.array(out_of_sample_p_dc)
    global_fb = np.array(out_of_sample_p_football)
    global_opt_blend = np.array(out_of_sample_p_opt_blend)
    
    # 1. Overround Stats
    overround_summary = compute_overround_stats(out_of_sample_odds_h, out_of_sample_odds_d, out_of_sample_odds_a)
    
    # Overround Buckets Analysis
    overrounds = overround_summary['overrounds_array']
    ov_b_idx, ov_thresh = bucket_by_quantiles(overrounds, n_buckets=3)
    ov_bucket_labels = ['Low_Overround', 'Medium_Overround', 'High_Overround']
    overround_buckets_analysis = {}
    
    for b_idx in range(3):
        mask = (ov_b_idx == b_idx)
        if np.sum(mask) > 0:
            y_b = global_y.iloc[mask]
            mkt_b = global_mkt[mask]
            fb_b = global_fb[mask]
            
            overround_buckets_analysis[ov_bucket_labels[b_idx]] = {
                'sample_count': int(np.sum(mask)),
                'overround_range': f"{round(float(ov_thresh[b_idx]), 4)} -> {round(float(ov_thresh[b_idx+1]), 4)}",
                'market_log_loss': round(float(log_loss(y_b, mkt_b, labels=[0,1,2])), 3),
                'football_log_loss': round(float(log_loss(y_b, fb_b, labels=[0,1,2])), 3),
                'market_brier': round(float(compute_brier_score(y_b, mkt_b)), 3),
                'football_brier': round(float(compute_brier_score(y_b, fb_b)), 3)
            }

    # 2. Probability Disagreement & KL Divergence
    disagreement_info = compute_kl_divergence_and_disagreement(global_mkt, global_fb)
    max_diffs = disagreement_info['max_abs_diffs']
    
    # Disagreement Buckets Analysis (5 quantiles)
    dis_b_idx, dis_thresh = bucket_by_quantiles(max_diffs, n_buckets=5)
    dis_bucket_labels = ['0-20th_Percentile', '20-40th_Percentile', '40-60th_Percentile', '60-80th_Percentile', '80-100th_Percentile']
    disagreement_buckets_analysis = {}
    
    for b_idx in range(5):
        mask = (dis_b_idx == b_idx)
        if np.sum(mask) > 0:
            y_b = global_y.iloc[mask]
            mkt_b = global_mkt[mask]
            fb_b = global_fb[mask]
            opt_b = global_opt_blend[mask]
            
            disagreement_buckets_analysis[dis_bucket_labels[b_idx]] = {
                'sample_count': int(np.sum(mask)),
                'disagreement_range': f"{round(float(dis_thresh[b_idx]), 3)} -> {round(float(dis_thresh[b_idx+1]), 3)}",
                'market_log_loss': round(float(log_loss(y_b, mkt_b, labels=[0,1,2])), 3),
                'football_log_loss': round(float(log_loss(y_b, fb_b, labels=[0,1,2])), 3),
                'opt_blend_log_loss': round(float(log_loss(y_b, opt_b, labels=[0,1,2])), 3),
                'market_accuracy_pct': round(float((np.argmax(mkt_b, axis=1) == y_b.values).mean() * 100), 1),
                'football_accuracy_pct': round(float((np.argmax(fb_b, axis=1) == y_b.values).mean() * 100), 1)
            }

    # 3. Market Confidence Buckets Analysis
    mkt_conf = np.max(global_mkt, axis=1)
    conf_b_idx, conf_thresh = bucket_by_quantiles(mkt_conf, n_buckets=3)
    conf_bucket_labels = ['Low_Market_Confidence', 'Medium_Market_Confidence', 'High_Market_Confidence']
    market_confidence_analysis = {}
    
    for b_idx in range(3):
        mask = (conf_b_idx == b_idx)
        if np.sum(mask) > 0:
            y_b = global_y.iloc[mask]
            mkt_b = global_mkt[mask]
            fb_b = global_fb[mask]
            opt_b = global_opt_blend[mask]
            
            market_confidence_analysis[conf_bucket_labels[b_idx]] = {
                'sample_count': int(np.sum(mask)),
                'confidence_range': f"{round(float(conf_thresh[b_idx]), 3)} -> {round(float(conf_thresh[b_idx+1]), 3)}",
                'market_log_loss': round(float(log_loss(y_b, mkt_b, labels=[0,1,2])), 3),
                'football_log_loss': round(float(log_loss(y_b, fb_b, labels=[0,1,2])), 3),
                'opt_blend_log_loss': round(float(log_loss(y_b, opt_b, labels=[0,1,2])), 3),
                'market_accuracy_pct': round(float((np.argmax(mkt_b, axis=1) == y_b.values).mean() * 100), 1),
                'football_accuracy_pct': round(float((np.argmax(fb_b, axis=1) == y_b.values).mean() * 100), 1)
            }

    # 4. Outcome Class & Dedicated Draw Analysis
    outcome_class_market = compute_outcome_class_metrics(global_y, global_mkt)
    outcome_class_football = compute_outcome_class_metrics(global_y, global_fb)
    draw_analysis = compute_draw_specific_analysis(global_y, global_mkt[:, 1], global_cb[:, 1], global_dc[:, 1], global_fb[:, 1])

    # 5. Fixed Market Blends Evaluation
    fixed_blends_summary = evaluate_fixed_blends(global_mkt, global_fb, global_y)

    # 6. Statistical Significance & Paired 1000-Sample Bootstrap Test
    bootstrap_market_vs_opt = run_paired_bootstrap_test(global_mkt, global_opt_blend, global_y, n_bootstraps=1000)
    bootstrap_market_vs_fb = run_paired_bootstrap_test(global_mkt, global_fb, global_y, n_bootstraps=1000)

    # Global Summaries
    loss_mkt = log_loss(global_y, global_mkt, labels=[0,1,2])
    brier_mkt = compute_brier_score(global_y, global_mkt)
    acc_mkt = (np.argmax(global_mkt, axis=1) == global_y.values).mean()
    ece_mkt = compute_ece(global_y, global_mkt)
    
    loss_fb = log_loss(global_y, global_fb, labels=[0,1,2])
    brier_fb = compute_brier_score(global_y, global_fb)
    acc_fb = (np.argmax(global_fb, axis=1) == global_y.values).mean()
    ece_fb = compute_ece(global_y, global_fb)
    
    loss_opt = log_loss(global_y, global_opt_blend, labels=[0,1,2])
    brier_opt = compute_brier_score(global_y, global_opt_blend)
    acc_opt = (np.argmax(global_opt_blend, axis=1) == global_y.values).mean()
    ece_opt = compute_ece(global_y, global_opt_blend)

    # Count how many folds candidate beats market
    folds_beating_market = sum(1 for f in fold_results if f['candidate_beats_market'])

    # Final Decision Logic (Section 24 Hierarchy)
    # KEEP if candidate improves Market Log Loss AND supported by CI > 0
    # REQUIRES MORE VALIDATION if candidate improves global metrics but CI includes 0
    # REJECT if Market remains consistently superior
    ci_lower = bootstrap_market_vs_opt['ci_95_lower']
    if loss_opt < loss_mkt and ci_lower > 0.0 and folds_beating_market >= 4:
        decision = "KEEP"
    elif loss_opt <= loss_mkt or bootstrap_market_vs_opt['probability_beats_market'] > 0.40:
        decision = "REQUIRES MORE VALIDATION"
    else:
        decision = "REJECT"

    global_summary = {
        'Market_Benchmark': {
            'log_loss': round(float(loss_mkt), 3),
            'brier_score': round(float(brier_mkt), 3),
            'ece_calibration_error': ece_mkt,
            'accuracy_pct': round(float(acc_mkt * 100), 1)
        },
        'Best_Football_Model_CatBoost_DC': {
            'log_loss': round(float(loss_fb), 3),
            'brier_score': round(float(brier_fb), 3),
            'ece_calibration_error': ece_fb,
            'accuracy_pct': round(float(acc_fb * 100), 1)
        },
        'Best_Optimized_Blend': {
            'log_loss': round(float(loss_opt), 3),
            'brier_score': round(float(brier_opt), 3),
            'ece_calibration_error': ece_opt,
            'accuracy_pct': round(float(acc_opt * 100), 1),
            'mean_optimal_alpha': round(float(np.mean(fold_alphas)), 3)
        },
        'fixed_market_blends': fixed_blends_summary,
        'overround_analysis': {
            'summary_stats': {
                'mean_overround': overround_summary['mean_overround'],
                'median_overround': overround_summary['median_overround'],
                'min_overround': overround_summary['min_overround'],
                'max_overround': overround_summary['max_overround'],
                'std_overround': overround_summary['std_overround']
            },
            'buckets': overround_buckets_analysis
        },
        'disagreement_analysis': {
            'summary_stats': {
                'mean_max_abs_diff': disagreement_info['mean_max_diff'],
                'mean_kl_divergence': disagreement_info['mean_kl_divergence']
            },
            'buckets': disagreement_buckets_analysis
        },
        'market_confidence_analysis': market_confidence_analysis,
        'outcome_class_analysis': {
            'market': outcome_class_market,
            'football_ensemble': outcome_class_football
        },
        'draw_analysis': draw_analysis,
        'bootstrap_significance_test': {
            'market_vs_opt_blend': bootstrap_market_vs_opt,
            'market_vs_football_ensemble': bootstrap_market_vs_fb
        },
        'folds_beating_market_count': folds_beating_market,
        'final_decision': decision
    }

    results_json = {
        'experiment_name': 'Step 10 Market Comparison & Information-Value Experiment',
        'dataset_matches': len(processed_df),
        'fold_results': fold_results,
        'global_summary': global_summary
    }

    with open(os.path.join(EXP_DIR, 'results.json'), 'w') as f:
        json.dump(results_json, f, indent=2)

    return fold_results, global_summary

if __name__ == '__main__':
    run_experiment()
    print("✅ Step 10 Market Comparison Experiment Complete. Results written to results.json.")
