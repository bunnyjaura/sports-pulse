"""
Prediction Integrity & Schema Validator (Step 15)
Validates live prediction schema, probability sum-to-1, model versioning, duplicate prevention, and fail-safe behavior.
"""

import numpy as np
import pandas as pd

class IntegrityValidator:
    def __init__(self, model_version="football-ensemble-v1"):
        self.model_version = model_version
        self.prediction_store = set()

    def validate_live_prediction(self, prediction_dict):
        required_fields = ['fixture_id', 'home_team', 'away_team', 'kickoff_at', 'pred_generated_at', 'model_version', 'probabilities']
        for f in required_fields:
            if f not in prediction_dict or prediction_dict[f] is None:
                return {'valid': False, 'reason': f'Missing required field: {f}'}
                
        if prediction_dict['model_version'] != self.model_version:
            return {'valid': False, 'reason': f'Model version mismatch: expected {self.model_version}'}
            
        p_home = prediction_dict['probabilities'].get('home')
        p_draw = prediction_dict['probabilities'].get('draw')
        p_away = prediction_dict['probabilities'].get('away')
        
        if p_home is None or p_draw is None or p_away is None:
            return {'valid': False, 'reason': 'Missing outcome probability'}
            
        probs = np.array([p_home, p_draw, p_away])
        if np.isnan(probs).any() or np.isinf(probs).any():
            return {'valid': False, 'reason': 'NaN or Infinity in probabilities'}
            
        if np.any(probs < 0.0) or np.any(probs > 1.0):
            return {'valid': False, 'reason': 'Probabilities out of bounds [0, 1]'}
            
        if abs(np.sum(probs) - 1.0) > 1e-4:
            return {'valid': False, 'reason': f'Probabilities do not sum to 1.0 (Sum={np.sum(probs)})'}
            
        pred_time = pd.to_datetime(prediction_dict['pred_generated_at'])
        kickoff = pd.to_datetime(prediction_dict['kickoff_at'])
        if pred_time >= kickoff:
            return {'valid': False, 'reason': 'Prediction generated after kickoff'}
            
        key = (prediction_dict['fixture_id'], prediction_dict['model_version'])
        if key in self.prediction_store:
            return {'valid': False, 'reason': 'Duplicate prediction for fixture'}
            
        self.prediction_store.add(key)
        return {'valid': True, 'reason': 'OK'}
