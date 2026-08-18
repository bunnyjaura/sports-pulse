"""
Leakage-Safe Feature Engineering Engine (Step 11)
Calculates pre-match features for Experiments A–F strictly prior to kickoff.
Zero future data leakage.
"""

import numpy as np
import pandas as pd

def compute_all_advanced_features(df):
    clean_df = df.copy()
    clean_df = clean_df.sort_values('ParsedDate').reset_index(drop=True)
    
    n_matches = len(clean_df)
    
    # Pre-allocate feature arrays
    elo_home = np.zeros(n_matches)
    elo_away = np.zeros(n_matches)
    elo_diff = np.zeros(n_matches)
    elo_diff_adv = np.zeros(n_matches)
    elo_trend5_h = np.zeros(n_matches)
    elo_trend5_a = np.zeros(n_matches)
    
    # Form B
    ppm_5_h = np.zeros(n_matches)
    ppm_5_a = np.zeros(n_matches)
    gd_5_h = np.zeros(n_matches)
    gd_5_a = np.zeros(n_matches)
    cs_5_h = np.zeros(n_matches)
    cs_5_a = np.zeros(n_matches)
    fts_5_h = np.zeros(n_matches)
    fts_5_a = np.zeros(n_matches)
    
    # Venue C
    venue_ppm_5_h = np.zeros(n_matches)
    venue_ppm_5_a = np.zeros(n_matches)
    venue_gd_5_h = np.zeros(n_matches)
    venue_gd_5_a = np.zeros(n_matches)
    
    # Schedule D
    rest_days_h = np.zeros(n_matches)
    rest_days_a = np.zeros(n_matches)
    rest_days_diff = np.zeros(n_matches)
    matches_14d_h = np.zeros(n_matches)
    matches_14d_a = np.zeros(n_matches)
    
    # H2H E
    h2h_win_h = np.zeros(n_matches)
    h2h_draw = np.zeros(n_matches)
    h2h_gd_avg = np.zeros(n_matches)
    
    # Standings F
    table_pts_diff = np.zeros(n_matches)
    table_pos_diff = np.zeros(n_matches)
    table_ppm_diff = np.zeros(n_matches)
    table_gd_diff = np.zeros(n_matches)
    
    # State tracking
    elos = {}
    elo_history = {} # team -> list of Elo historical values
    match_history = {} # team -> list of match dicts
    venue_history = {} # (team, venue) -> list of match dicts
    
    K = 32
    HOME_ADV = 65
    
    for i, row in clean_df.iterrows():
        h = str(row['HomeTeam'])
        a = str(row['AwayTeam'])
        m_date = row['ParsedDate']
        
        if h not in elos: 
            elos[h] = 1500.0
            elo_history[h] = [1500.0]
            match_history[h] = []
            
        if a not in elos: 
            elos[a] = 1500.0
            elo_history[a] = [1500.0]
            match_history[a] = []
            
        if (h, 'H') not in venue_history: venue_history[(h, 'H')] = []
        if (a, 'A') not in venue_history: venue_history[(a, 'A')] = []
            
        r_h_pre = elos[h]
        r_a_pre = elos[a]
        
        elo_home[i] = r_h_pre
        elo_away[i] = r_a_pre
        elo_diff[i] = r_h_pre - r_a_pre
        elo_diff_adv[i] = (r_h_pre + HOME_ADV) - r_a_pre
        
        # Elo Trend (last 5 matches)
        h_elo_hist = elo_history[h]
        a_elo_hist = elo_history[a]
        elo_trend5_h[i] = r_h_pre - h_elo_hist[-min(6, len(h_elo_hist))]
        elo_trend5_a[i] = r_a_pre - a_elo_hist[-min(6, len(a_elo_hist))]
        
        # --- Experiment B: Recent Form Quality (last 5 overall matches) ---
        h_m5 = match_history[h][-5:]
        a_m5 = match_history[a][-5:]
        
        if len(h_m5) > 0:
            ppm_5_h[i] = sum(m['pts'] for m in h_m5) / len(h_m5)
            gd_5_h[i] = sum(m['gf'] - m['ga'] for m in h_m5) / len(h_m5)
            cs_5_h[i] = sum(1 for m in h_m5 if m['ga'] == 0) / len(h_m5)
            fts_5_h[i] = sum(1 for m in h_m5 if m['gf'] == 0) / len(h_m5)
        else:
            ppm_5_h[i], gd_5_h[i], cs_5_h[i], fts_5_h[i] = 1.35, 0.0, 0.25, 0.25
            
        if len(a_m5) > 0:
            ppm_5_a[i] = sum(m['pts'] for m in a_m5) / len(a_m5)
            gd_5_a[i] = sum(m['gf'] - m['ga'] for m in a_m5) / len(a_m5)
            cs_5_a[i] = sum(1 for m in a_m5 if m['ga'] == 0) / len(a_m5)
            fts_5_a[i] = sum(1 for m in a_m5 if m['gf'] == 0) / len(a_m5)
        else:
            ppm_5_a[i], gd_5_a[i], cs_5_a[i], fts_5_a[i] = 1.35, 0.0, 0.25, 0.25
            
        # --- Experiment C: Venue Specific Strength ---
        h_v5 = venue_history.get((h, 'H'), [])[-5:]
        a_v5 = venue_history.get((a, 'A'), [])[-5:]
        
        if len(h_v5) > 0:
            venue_ppm_5_h[i] = sum(m['pts'] for m in h_v5) / len(h_v5)
            venue_gd_5_h[i] = sum(m['gf'] - m['ga'] for m in h_v5) / len(h_v5)
        else:
            venue_ppm_5_h[i], venue_gd_5_h[i] = 1.5, 0.2
            
        if len(a_v5) > 0:
            venue_ppm_5_a[i] = sum(m['pts'] for m in a_v5) / len(a_v5)
            venue_gd_5_a[i] = sum(m['gf'] - m['ga'] for m in a_v5) / len(a_v5)
        else:
            venue_ppm_5_a[i], venue_gd_5_a[i] = 1.2, -0.2
            
        # --- Experiment D: Schedule / Fatigue ---
        if len(match_history[h]) > 0:
            last_date_h = match_history[h][-1]['date']
            rest_days_h[i] = min((m_date - last_date_h).days, 30)
            matches_14d_h[i] = sum(1 for m in match_history[h] if (m_date - m['date']).days <= 14)
        else:
            rest_days_h[i], matches_14d_h[i] = 7, 1
            
        if len(match_history[a]) > 0:
            last_date_a = match_history[a][-1]['date']
            rest_days_a[i] = min((m_date - last_date_a).days, 30)
            matches_14d_a[i] = sum(1 for m in match_history[a] if (m_date - m['date']).days <= 14)
        else:
            rest_days_a[i], matches_14d_a[i] = 7, 1
            
        rest_days_diff[i] = rest_days_h[i] - rest_days_a[i]
        
        # --- Experiment E: Head-to-Head ---
        # Search past matches where Home team faced Away team
        past_h2h = [m for m in match_history[h] if m['opp'] == a]
        if len(past_h2h) > 0:
            h2h_win_h[i] = sum(1 for m in past_h2h if m['pts'] == 3) / len(past_h2h)
            h2h_draw[i] = sum(1 for m in past_h2h if m['pts'] == 1) / len(past_h2h)
            h2h_gd_avg[i] = sum(m['gf'] - m['ga'] for m in past_h2h) / len(past_h2h)
        else:
            h2h_win_h[i], h2h_draw[i], h2h_gd_avg[i] = 0.40, 0.25, 0.0
            
        # --- Experiment F: Pre-Match League Standings ---
        # Calculate pre-match points and goals for all teams up to m_date
        pts_h = sum(m['pts'] for m in match_history[h])
        gp_h = len(match_history[h])
        ppm_h = pts_h / gp_h if gp_h > 0 else 1.35
        gd_tot_h = sum(m['gf'] - m['ga'] for m in match_history[h])
        
        pts_a = sum(m['pts'] for m in match_history[a])
        gp_a = len(match_history[a])
        ppm_a = pts_a / gp_a if gp_a > 0 else 1.35
        gd_tot_a = sum(m['gf'] - m['ga'] for m in match_history[a])
        
        table_pts_diff[i] = pts_h - pts_a
        table_ppm_diff[i] = ppm_h - ppm_a
        table_gd_diff[i] = gd_tot_h - gd_tot_a
        
        # --- UPDATE POST-MATCH STATE (AFTER Kickoff) ---
        h_goals, a_goals = int(row['FTHG']), int(row['FTAG'])
        h_pts = 3 if h_goals > a_goals else (1 if h_goals == a_goals else 0)
        a_pts = 3 if a_goals > h_goals else (1 if h_goals == a_goals else 0)
        
        # Update Elo
        eff_home = r_h_pre + HOME_ADV
        exp_home = 1 / (1 + 10 ** ((r_a_pre - eff_home) / 400))
        actual_home = 1.0 if h_goals > a_goals else (0.5 if h_goals == a_goals else 0.0)
        diff = abs(h_goals - a_goals)
        mult = 1.25 if diff == 2 else (1.5 if diff >= 3 else 1.0)
        delta = int(K * mult * (actual_home - exp_home))
        
        elos[h] = r_h_pre + delta
        elos[a] = r_a_pre - delta
        elo_history[h].append(elos[h])
        elo_history[a].append(elos[a])
        
        # Update match histories
        h_record = {'date': m_date, 'opp': a, 'pts': h_pts, 'gf': h_goals, 'ga': a_goals}
        a_record = {'date': m_date, 'opp': h, 'pts': a_pts, 'gf': a_goals, 'ga': h_goals}
        
        match_history[h].append(h_record)
        match_history[a].append(a_record)
        venue_history[(h, 'H')].append(h_record)
        venue_history[(a, 'A')].append(a_record)
        
    # Attach feature groups to DataFrame
    clean_df['EloHome'] = elo_home
    clean_df['EloAway'] = elo_away
    clean_df['EloDiff'] = elo_diff
    clean_df['EloDiffAdv'] = elo_diff_adv
    clean_df['EloTrend5_Home'] = elo_trend5_h
    clean_df['EloTrend5_Away'] = elo_trend5_a
    
    clean_df['FormPPM_5_Home'] = ppm_5_h
    clean_df['FormPPM_5_Away'] = ppm_5_a
    clean_df['FormGD_5_Home'] = gd_5_h
    clean_df['FormGD_5_Away'] = gd_5_a
    clean_df['CS_5_Home'] = cs_5_h
    clean_df['CS_5_Away'] = cs_5_a
    clean_df['FTS_5_Home'] = fts_5_h
    clean_df['FTS_5_Away'] = fts_5_a
    
    clean_df['VenuePPM_5_Home'] = venue_ppm_5_h
    clean_df['VenuePPM_5_Away'] = venue_ppm_5_a
    clean_df['VenueGD_5_Home'] = venue_gd_5_h
    clean_df['VenueGD_5_Away'] = venue_gd_5_a
    
    clean_df['RestDays_Home'] = rest_days_h
    clean_df['RestDays_Away'] = rest_days_a
    clean_df['RestDays_Diff'] = rest_days_diff
    clean_df['Matches14D_Home'] = matches_14d_h
    clean_df['Matches14D_Away'] = matches_14d_a
    
    clean_df['H2H_Win_Home'] = h2h_win_h
    clean_df['H2H_Draw'] = h2h_draw
    clean_df['H2H_GD_Avg'] = h2h_gd_avg
    
    clean_df['TablePts_Diff'] = table_pts_diff
    clean_df['TablePPM_Diff'] = table_ppm_diff
    clean_df['TableGD_Diff'] = table_gd_diff
    
    return clean_df
