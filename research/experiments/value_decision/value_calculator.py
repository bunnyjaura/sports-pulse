"""
Value & Edge Calculation Engine (Step 16)
Calculates fair decimal odds, overround-removed market probabilities, model edge, EV, and decision states.
"""

import numpy as np

def compute_fair_odds_and_value(p_model, odds_market=None, min_edge=0.03, min_ev=0.02):
    """
    p_model: np.ndarray of shape (3,) [P_H, P_D, P_A]
    odds_market: np.ndarray of shape (3,) [bH, bD, bA] or None
    """
    p_h, p_d, p_a = p_model
    fair_odds = [round(1.0 / p_h, 4), round(1.0 / p_d, 4), round(1.0 / p_a, 4)]
    
    if odds_market is None or any(np.isnan(odds_market)) or any(o <= 1.0 for o in odds_market):
        return {
            'fair_odds': fair_odds,
            'market_probabilities': None,
            'edges': None,
            'evs': None,
            'decision_state': 'NO_MARKET',
            'recommended_outcome': None
        }
        
    raw_h = 1.0 / odds_market[0]
    raw_d = 1.0 / odds_market[1]
    raw_a = 1.0 / odds_market[2]
    overround = raw_h + raw_d + raw_a
    
    p_mkt = np.array([raw_h / overround, raw_d / overround, raw_a / overround])
    edges = p_model - p_mkt
    evs = p_model * odds_market - 1.0
    
    max_ev_idx = int(np.argmax(evs))
    best_edge = edges[max_ev_idx]
    best_ev = evs[max_ev_idx]
    
    outcome_names = ['Home', 'Draw', 'Away']
    
    if best_ev >= min_ev and best_edge >= min_edge:
        if best_ev >= 0.05 and best_edge >= 0.05:
            state = 'STRONG_VALUE'
        else:
            state = 'VALUE_CANDIDATE'
        rec_outcome = outcome_names[max_ev_idx]
    elif best_edge > 0.0:
        state = 'LOW_EDGE'
        rec_outcome = None
    else:
        state = 'NO_VALUE'
        rec_outcome = None
        
    return {
        'fair_odds': fair_odds,
        'market_probabilities': [round(float(p), 4) for p in p_mkt],
        'edges': [round(float(e), 4) for e in edges],
        'evs': [round(float(ev), 4) for ev in evs],
        'best_outcome': outcome_names[max_ev_idx],
        'best_edge': round(float(best_edge), 4),
        'best_ev': round(float(best_ev), 4),
        'decision_state': state,
        'recommended_outcome': rec_outcome
    }
