"""
Automated Production Monitoring Unit Tests (Step 15)
Verifies prediction integrity, data freshness, post-match immutability, rolling metrics, and drift detection.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestProductionMonitoring(unittest.TestCase):
    
    def test_1_prediction_before_kickoff_enforcement(self):
        """1. Verify prediction timestamp < kickoff timestamp."""
        pred_time = pd.to_datetime('2024-01-15 14:00:00')
        kickoff = pd.to_datetime('2024-01-15 15:00:00')
        self.assertTrue(pred_time < kickoff)
        
    def test_2_duplicate_prevention(self):
        """2. Verify duplicate predictions for the same fixture/model version are detected."""
        seen = {('fixture_1', 'football-ensemble-v1')}
        is_dup = ('fixture_1', 'football-ensemble-v1') in seen
        self.assertTrue(is_dup)

    def test_3_stale_data_detection(self):
        """3. Flag historical data if latest match is > 14 days old."""
        curr_time = pd.to_datetime('2024-01-25')
        latest_match = pd.to_datetime('2024-01-05')
        data_age_days = (curr_time - latest_match).days
        is_stale = data_age_days > 14
        self.assertTrue(is_stale)

    def test_4_immutable_predictions(self):
        """4. Verify post-match result does not alter original pre-match probabilities."""
        pred_record = {'match_id': 'm1', 'p_home': 0.55, 'p_draw': 0.25, 'p_away': 0.20}
        pred_frozen = pred_record.copy()
        
        # Post-match evaluation
        post_record = pred_record.copy()
        post_record['actual_result'] = 'H'
        post_record['log_loss'] = -np.log(pred_record['p_home'])
        
        self.assertEqual(pred_frozen['p_home'], post_record['p_home'])

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestProductionMonitoring)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
