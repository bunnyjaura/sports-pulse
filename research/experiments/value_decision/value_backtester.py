"""
Chronological Value Backtest Engine (Step 16)
Simulates flat 1-unit stake value betting chronologically over historical OOS predictions.
Tracks qualified opportunities, hit rate, average edge, EV, realized ROI, and maximum drawdown.
"""

import numpy as np
import pandas as pd

def run_value_backtest(y_true, p_model, odds_matrix, min_edge=0.03, min_ev=0.02):
    """
    y_true: Series of actual outcome targets (0=H, 1=D, 2=A)
    p_model: (N, 3) model probabilities
    odds_matrix: (N, 3) bookmaker odds matrix [B365H, B365D, B365A]
    """
    n_samples = len(y_true)
    
    qualified_trades = []
    cum_profit = 0.0
    peak_profit = 0.0
    max_drawdown = 0.0
    losing_streak = 0
    max_losing_streak = 0
    
    for i in range(n_samples):
        pm = p_model[i]
        odds = odds_matrix[i]
        target = int(y_true.iloc[i])
        
        if any(np.isnan(odds)) or any(o <= 1.0 for o in odds):
            continue
            
        raw_h = 1.0 / odds[0]
        raw_d = 1.0 / odds[1]
        raw_a = 1.0 / odds[2]
        overround = raw_h + raw_d + raw_a
        p_mkt = np.array([raw_h / overround, raw_d / overround, raw_a / overround])
        
        edges = pm - p_mkt
        evs = pm * odds - 1.0
        
        best_idx = int(np.argmax(evs))
        best_edge = edges[best_idx]
        best_ev = evs[best_idx]
        
        if best_ev >= min_ev and best_edge >= min_edge:
            is_win = bool(target == best_idx)
            odds_taken = odds[best_idx]
            profit = (odds_taken - 1.0) if is_win else -1.0
            
            cum_profit += profit
            if cum_profit > peak_profit:
                peak_profit = cum_profit
            dd = peak_profit - cum_profit
            if dd > max_drawdown:
                max_drawdown = dd
                
            if not is_win:
                losing_streak += 1
                if losing_streak > max_losing_streak:
                    max_losing_streak = losing_streak
            else:
                losing_streak = 0
                
            qualified_trades.append({
                'match_index': i,
                'outcome_chosen': best_idx,
                'model_prob': round(float(pm[best_idx]), 4),
                'market_prob': round(float(p_mkt[best_idx]), 4),
                'market_odds': round(float(odds_taken), 2),
                'edge': round(float(best_edge), 4),
                'ev': round(float(best_ev), 4),
                'is_win': is_win,
                'realized_profit': round(float(profit), 2)
            })
            
    n_trades = len(qualified_trades)
    if n_trades == 0:
        return {
            'total_opportunities': 0,
            'opportunity_rate_pct': 0.0,
            'hit_rate_pct': 0.0,
            'realized_roi_pct': 0.0,
            'total_profit_units': 0.0,
            'max_drawdown_units': 0.0,
            'max_losing_streak': 0,
            'trades': []
        }
        
    wins = sum(1 for t in qualified_trades if t['is_win'])
    hit_rate = wins / n_trades
    total_profit = sum(t['realized_profit'] for t in qualified_trades)
    roi = (total_profit / n_trades) * 100.0
    
    return {
        'total_opportunities': n_trades,
        'opportunity_rate_pct': round((n_trades / n_samples) * 100.0, 1),
        'hit_rate_pct': round(hit_rate * 100.0, 1),
        'average_edge': round(float(np.mean([t['edge'] for t in qualified_trades])), 4),
        'average_ev': round(float(np.mean([t['ev'] for t in qualified_trades])), 4),
        'realized_roi_pct': round(float(roi), 2),
        'total_profit_units': round(float(total_profit), 2),
        'max_drawdown_units': round(float(max_drawdown), 2),
        'max_losing_streak': max_losing_streak,
        'trades': qualified_trades
    }
