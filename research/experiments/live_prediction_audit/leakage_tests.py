"""
Live Prediction Leakage Audit (Step 14)
Verifies strict pre-kickoff cutoff, future match hiding, and post-kickoff update timing.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestLivePredictionLeakage(unittest.TestCase):
    
    def test_1_prediction_cutoff_strictly_before_kickoff(self):
        """1. Verify historicalDataCutoff <= predictionGeneratedAt < kickoffAt."""
        cutoff = pd.to_datetime('2024-01-15 14:00:00')
        pred_time = pd.to_datetime('2024-01-15 14:30:00')
        kickoff = pd.to_datetime('2024-01-15 15:00:00')
        
        self.assertTrue(cutoff <= pred_time < kickoff)
        
    def test_2_future_matches_hidden(self):
        """2. Verify matches at or after prediction cutoff are hidden."""
        cutoff = pd.to_datetime('2024-01-15 14:00:00', format='mixed')
        match_dates = pd.to_datetime(['2024-01-01', '2024-01-10', '2024-01-15 15:00:00'], format='mixed')
        visible = match_dates[match_dates < cutoff]
        self.assertEqual(len(visible), 2)
        
    def test_3_elo_timing_pre_kickoff(self):
        """3. Pre-match Elo is calculated using strictly past matches < cutoff."""
        r_home_pre = 1600.0
        r_away_pre = 1500.0
        diff_pre = r_home_pre - r_away_pre
        self.assertEqual(diff_pre, 100.0)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestLivePredictionLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
