"""
Data Freshness & Stale Data Tracker (Step 15)
Tracks historical dataset age, prediction lead time, and flags stale data before prediction generation.
"""

import pandas as pd

class DataFreshnessTracker:
    def __init__(self, max_stale_days=14):
        self.max_stale_days = max_stale_days
        
    def check_freshness(self, latest_historical_date, pred_generated_at, kickoff_at):
        latest_d = pd.to_datetime(latest_historical_date)
        pred_d = pd.to_datetime(pred_generated_at)
        kickoff_d = pd.to_datetime(kickoff_at)
        
        data_age_days = (pred_d - latest_d).days
        lead_time_mins = (kickoff_d - pred_d).total_seconds() / 60.0
        
        is_stale = data_age_days > self.max_stale_days
        is_past_kickoff = lead_time_mins <= 0
        
        return {
            'data_age_days': data_age_days,
            'prediction_lead_time_mins': round(lead_time_mins, 1),
            'is_stale': bool(is_stale),
            'is_past_kickoff': bool(is_past_kickoff),
            'status': 'STALE_DATA' if is_stale else ('PAST_KICKOFF' if is_past_kickoff else 'FRESH')
        }
