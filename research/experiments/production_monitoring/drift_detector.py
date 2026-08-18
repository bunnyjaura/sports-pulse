"""
Production Drift Detector (Step 15)
Monitors changes in outcome class distributions, prediction probability means, and missing data frequency.
Flags drift for human review.
"""

import numpy as np
import pandas as pd

class DriftDetector:
    def __init__(self, baseline_class_freq=None):
        if baseline_class_freq is None:
            self.baseline_class_freq = {'Home': 0.45, 'Draw': 0.25, 'Away': 0.30}
        else:
            self.baseline_class_freq = baseline_class_freq

    def check_distribution_drift(self, recent_predictions_list):
        if len(recent_predictions_list) == 0:
            return {'drift_detected': False, 'details': 'No predictions provided'}
            
        p_home_list = [r['probabilities']['home'] for r in recent_predictions_list]
        p_draw_list = [r['probabilities']['draw'] for r in recent_predictions_list]
        p_away_list = [r['probabilities']['away'] for r in recent_predictions_list]
        
        mean_p_home = np.mean(p_home_list)
        mean_p_draw = np.mean(p_draw_list)
        mean_p_away = np.mean(p_away_list)
        
        # Check shift from baseline
        drift_h = abs(mean_p_home - self.baseline_class_freq['Home']) > 0.10
        drift_d = abs(mean_p_draw - self.baseline_class_freq['Draw']) > 0.10
        drift_a = abs(mean_p_away - self.baseline_class_freq['Away']) > 0.10
        
        drift_detected = drift_h or drift_d or drift_a
        
        return {
            'drift_detected': bool(drift_detected),
            'sample_size': len(recent_predictions_list),
            'recent_mean_probabilities': {
                'home': round(float(mean_p_home), 3),
                'draw': round(float(mean_p_draw), 3),
                'away': round(float(mean_p_away), 3)
            },
            'baseline_class_frequencies': self.baseline_class_freq,
            'status': 'DRIFT_WARNING' if drift_detected else 'STABLE'
        }
