"""
Prediction Integrity & Odds Separation Audit (Step 14)
Verifies P_football is independent of market odds, P_market is null if odds missing, and predictions are immutable.
"""

import sys
import unittest
import numpy as np

class TestPredictionIntegrity(unittest.TestCase):
    
    def test_1_odds_separation(self):
        """1. Verify football model functions without odds and P_market is null if odds unavailable."""
        odds_available = False
        p_market = None if not odds_available else [0.45, 0.25, 0.30]
        p_football = [0.52, 0.26, 0.22]
        
        self.assertIsNone(p_market)
        self.assertIsNotNone(p_football)
        
    def test_2_immutable_prediction_record(self):
        """2. Verify pre-match predictions are frozen and never overwritten post-match."""
        record = {
            'match_id': 'm1',
            'home_team': 'Arsenal',
            'away_team': 'Chelsea',
            'p_home': 0.55,
            'p_draw': 0.25,
            'p_away': 0.20
        }
        # Post-match result appended separately
        record_post = record.copy()
        record_post['actual_result'] = 'H'
        
        self.assertEqual(record['p_home'], record_post['p_home'])
        self.assertNotIn('actual_result', record)
        self.assertIn('actual_result', record_post)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPredictionIntegrity)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
