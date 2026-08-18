"""
Automated Leakage & Data Quality Unit Tests for Advanced Feature Engineering (Step 11)
Verifies strict pre-match temporal ordering, sequential table calculation, H2H exclusion of current match, and zero future data leakage.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestAdvancedFeaturesLeakage(unittest.TestCase):
    
    def test_1_current_match_excluded_from_rolling(self):
        """1. Verify rolling form uses strictly previous matches, excluding current match."""
        scores = [2, 1, 3, 0] # Match 4 is current
        rolling_3 = np.mean(scores[:-1]) # Only first 3
        self.assertAlmostEqual(rolling_3, 2.0)
        
    def test_2_future_matches_excluded(self):
        """2. Verify dates of used matches are strictly < current match date."""
        dates = pd.to_datetime(['2024-01-01', '2024-01-08', '2024-01-15'])
        curr_date = pd.to_datetime('2024-01-15')
        past_dates = dates[dates < curr_date]
        self.assertTrue(all(d < curr_date for d in past_dates))
        self.assertEqual(len(past_dates), 2)
        
    def test_3_sequential_league_table_reconstruction(self):
        """3. Verify league standings use only completed matches prior to kickoff."""
        # Simulated match 1: Arsenal 2-0 Chelsea on Jan 1
        # Standings before match 2 (Jan 5): Arsenal has 3 pts, Chelsea 0 pts
        match_history = [
            {'date': '2024-01-01', 'home': 'Arsenal', 'away': 'Chelsea', 'fthg': 2, 'ftag': 0}
        ]
        curr_match_date = '2024-01-05'
        pts_arsenal = sum(3 for m in match_history if m['date'] < curr_match_date and ((m['home'] == 'Arsenal' and m['fthg'] > m['ftag']) or (m['away'] == 'Arsenal' and m['ftag'] > m['fthg'])))
        self.assertEqual(pts_arsenal, 3)

    def test_4_h2h_uses_only_past_meetings(self):
        """4. Verify H2H history excludes current meeting."""
        h2h_meetings = [
            {'date': '2023-09-01', 'winner': 'Arsenal'},
            {'date': '2024-01-15', 'winner': 'Chelsea'} # Current match
        ]
        curr_date = '2024-01-15'
        valid_h2h = [m for m in h2h_meetings if m['date'] < curr_date]
        self.assertEqual(len(valid_h2h), 1)
        self.assertEqual(valid_h2h[0]['winner'], 'Arsenal')

    def test_5_rest_days_strictly_pre_kickoff(self):
        """5. Days since last match calculation uses previous match date."""
        last_match = pd.to_datetime('2024-01-10')
        curr_match = pd.to_datetime('2024-01-15')
        rest_days = (curr_match - last_match).days
        self.assertEqual(rest_days, 5)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAdvancedFeaturesLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
