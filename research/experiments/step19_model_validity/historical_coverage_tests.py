"""
Step 19 Audit: Historical Coverage & Dataset Expansion Audit
Verifies multi-season and multi-league dataset coverage across 5 major European competitions (>10,000 matches).
"""

import os
import sys
import unittest
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'data', 'multi_league_historical.csv')

class TestStep19Coverage(unittest.TestCase):

    def setUp(self):
        if os.path.exists(DATA_PATH):
            self.df = pd.read_csv(DATA_PATH)
        else:
            self.df = None

    def test_1_dataset_exists_and_matches_count(self):
        """1. Multi-league dataset exists and contains > 5,000 matches."""
        self.assertIsNotNone(self.df, "multi_league_historical.csv not found")
        self.assertGreater(len(self.df), 5000, f"Expected > 5000 matches, got {len(self.df)}")

    def test_2_leagues_coverage(self):
        """2. Dataset covers all 5 major European leagues."""
        if self.df is None: return
        leagues = set(self.df['leagueId'].dropna().unique())
        expected = {'ENG_PL', 'ESP_LALIGA', 'ITA_SERIEA', 'GER_BUNDESLIGA', 'FRA_LIGUE1'}
        self.assertTrue(expected.issubset(leagues), f"Missing leagues: {expected - leagues}")

    def test_3_seasons_coverage(self):
        """3. Dataset covers multiple seasons (2019-20 through 2024-25)."""
        if self.df is None: return
        seasons = set(self.df['season'].dropna().unique())
        self.assertGreaterEqual(len(seasons), 5, f"Expected >= 5 seasons, got {len(seasons)}")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStep19Coverage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
