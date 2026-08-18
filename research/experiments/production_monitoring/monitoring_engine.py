"""
Production Monitoring Engine (Step 15)
Integrates Integrity Validator, Freshness Tracker, Post-Match Evaluator, Drift Detector, and Rolling Metrics (25, 50, 100 windows).
"""

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

from integrity_validator import IntegrityValidator
from data_freshness_tracker import DataFreshnessTracker
from post_match_monitor import evaluate_post_match_prediction
from drift_detector import DriftDetector

class ProductionMonitoringEngine:
    def __init__(self, model_version="football-ensemble-v1"):
        self.validator = IntegrityValidator(model_version=model_version)
        self.freshness_tracker = DataFreshnessTracker(max_stale_days=14)
        self.drift_detector = DriftDetector()
        
        self.valid_predictions = []
        self.rejected_predictions = []
        self.evaluated_predictions = []
        
    def process_prediction_request(self, fixture_dict, latest_historical_date):
        # 1. Freshness Check
        freshness = self.freshness_tracker.check_freshness(
            latest_historical_date,
            fixture_dict['pred_generated_at'],
            fixture_dict['kickoff_at']
        )
        
        if freshness['is_stale']:
            record = {
                'fixture_id': fixture_dict.get('fixture_id'),
                'status': 'REJECTED',
                'reason': 'Stale historical dataset'
            }
            self.rejected_predictions.append(record)
            return record
            
        # 2. Integrity Validation
        val_res = self.validator.validate_live_prediction(fixture_dict)
        if not val_res['valid']:
            record = {
                'fixture_id': fixture_dict.get('fixture_id'),
                'status': 'REJECTED',
                'reason': val_res['reason']
            }
            self.rejected_predictions.append(record)
            return record
            
        # Valid Prediction
        record = fixture_dict.copy()
        record['status'] = 'VALID'
        record['freshness'] = freshness
        self.valid_predictions.append(record)
        return record

    def record_post_match_result(self, fixture_id, actual_result):
        # Find matching pre-match record
        target_rec = None
        for r in self.valid_predictions:
            if r['fixture_id'] == fixture_id:
                target_rec = r
                break
                
        if target_rec is not None:
            eval_rec = evaluate_post_match_prediction(target_rec, actual_result)
            self.evaluated_predictions.append(eval_rec)
            return eval_rec
        return None

    def compute_rolling_metrics(self, windows=[25, 50, 100]):
        if len(self.evaluated_predictions) == 0:
            return {'status': 'No post-match evaluations available'}
            
        rolling_summary = {}
        n_eval = len(self.evaluated_predictions)
        
        for w in windows:
            if n_eval >= w:
                sub_evals = self.evaluated_predictions[-w:]
                losses = [e['evaluation']['log_loss'] for e in sub_evals]
                briers = [e['evaluation']['brier_score'] for e in sub_evals]
                accs = [1.0 if e['evaluation']['is_correct'] else 0.0 for e in sub_evals]
                
                rolling_summary[f'rolling_{w}_predictions'] = {
                    'window_size': w,
                    'mean_log_loss': round(float(np.mean(losses)), 3),
                    'mean_brier_score': round(float(np.mean(briers)), 3),
                    'accuracy_pct': round(float(np.mean(accs) * 100), 1)
                }
                
        return rolling_summary
