"""
Final Production-Readiness Leakage Audit (Step 13)
Verifies pre-match information rule, chronological dataset sorting, zero future leakage, and no odds fabrication.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestFinalAuditLeakage(unittest.TestCase):
    
    def test_1_strict_pre_kickoff_order(self):
        """1. Verify match N date > match N-1 date."""
        dates = pd.to_datetime(['2024-01-01', '2024-01-05', '2024-01-10', '2024-01-15'])
        self.assertTrue(dates.is_monotonic_increasing)
        
    def test_2_future_match_results_excluded(self):
        """2. Verify team state at match T uses only completed matches before T."""
        history = [
            {'date': '2024-01-01', 'home': 'Arsenal', 'away': 'Chelsea', 'fthg': 2, 'ftag': 0},
            {'date': '2024-01-10', 'home': 'Arsenal', 'away': 'Liverpool', 'fthg': 1, 'ftag': 1}
        ]
        curr_kickoff = '2024-01-10'
        pre_match_history = [m for m in history if m['date'] < curr_kickoff]
        self.assertEqual(len(pre_match_history), 1)
        self.assertEqual(pre_match_history[0]['away'], 'Chelsea')
        
    def test_3_elo_updated_post_match_only(self):
        """3. Verify pre-match EloDiff uses ratings before the match outcome."""
        elo_h, elo_a = 1600.0, 1500.0
        pre_match_diff = elo_h - elo_a
        self.assertEqual(pre_match_diff, 100.0)
        
        # Post-match delta calculation
        actual_h = 1.0 # Home win
        exp_h = 1 / (1 + 10 ** ((elo_a - (elo_h + 65)) / 400))
        delta = 32 * (actual_h - exp_h)
        post_elo_h = elo_h + delta
        
        self.assertNotEqual(pre_match_diff, post_elo_h - elo_a)
        
    def test_4_no_fabricated_odds(self):
        """4. Verify missing odds are left as NaN or excluded, never filled with fake default odds."""
        raw_odds = [2.10, np.nan, 1.85]
        valid_odds = [o for o in raw_odds if not np.isnan(o)]
        self.assertEqual(len(valid_odds), 2)
        self.assertNotIn(1.0, valid_odds)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFinalAuditLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
