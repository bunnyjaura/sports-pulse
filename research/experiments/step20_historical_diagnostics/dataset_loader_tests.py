"""
Step 20 Audit: Dataset Loader Verification
Verifies that multi-league dataset exists, contains >15,000 matches, 9 seasons, and 5 European competitions.
"""

import os
import sys
import unittest
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'data', 'multi_league_historical.csv')

class TestDatasetLoader(unittest.TestCase):

    def setUp(self):
        if os.path.exists(DATA_PATH):
            self.df = pd.read_csv(DATA_PATH)
        else:
            self.df = None

    def test_1_dataset_exists_and_row_count(self):
        """1. Expanded dataset exists and contains > 15,000 matches."""
        self.assertIsNotNone(self.df, "multi_league_historical.csv not found")
        self.assertGreater(len(self.df), 15000, f"Expected > 15000 matches, got {len(self.df)}")

    def test_2_seasons_count(self):
        """2. Dataset contains 9 full seasons (2016-17 through 2024-25)."""
        if self.df is None: return
        seasons = set(self.df['season'].dropna().unique())
        self.assertGreaterEqual(len(seasons), 9, f"Expected >= 9 seasons, got {len(seasons)}")

    def test_3_leagues_count(self):
        """3. Dataset contains all 5 major European competitions."""
        if self.df is None: return
        leagues = set(self.df['leagueId'].dropna().unique())
        expected = {'ENG_PL', 'ESP_LALIGA', 'ITA_SERIEA', 'GER_BUNDESLIGA', 'FRA_LIGUE1'}
        self.assertTrue(expected.issubset(leagues))

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestDatasetLoader)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
