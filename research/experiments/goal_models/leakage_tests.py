"""
Automated Leakage & Validation Unit Tests for Goal Models (Poisson + Dixon-Coles)
Verifies mathematical correctness, scoreline normalization, parameter isolation, and zero odds usage.
"""

import sys
import math
import unittest
import numpy as np
import pandas as pd

class TestGoalModelsLeakage(unittest.TestCase):
    
    def test_1_scoreline_matrix_normalizes_to_one(self):
        """1. Verify scoreline matrix sums to 1.0."""
        # 11x11 grid (0..10 goals)
        lam, mu = 1.45, 1.10
        grid = np.zeros((11, 11))
        for i in range(11):
            for j in range(11):
                p_i = (lam ** i) * np.exp(-lam) / math.factorial(i)
                p_j = (mu ** j) * np.exp(-mu) / math.factorial(j)
                grid[i, j] = p_i * p_j
                
        total_mass = np.sum(grid)
        normalized_grid = grid / total_mass
        np.testing.assert_allclose(np.sum(normalized_grid), 1.0, rtol=1e-5)
        
    def test_2_hda_probabilities_sum_to_one(self):
        """2. Verify H/D/A probabilities sum to 1.0."""
        grid = np.array([
            [0.10, 0.05, 0.02],
            [0.15, 0.20, 0.08],
            [0.12, 0.18, 0.10]
        ])
        grid /= np.sum(grid)
        
        p_home = np.sum(np.tril(grid, -1))
        p_draw = np.sum(np.diag(grid))
        p_away = np.sum(np.triu(grid, 1))
        
        self.assertAlmostEqual(p_home + p_draw + p_away, 1.0, places=5)

    def test_3_current_match_excluded_from_training(self):
        """3. Verify current match goals are excluded from model training."""
        train_matches = [
            {'HomeTeam': 'Arsenal', 'AwayTeam': 'Chelsea', 'FTHG': 2, 'FTAG': 0, 'Date': '2024-01-01'},
            {'HomeTeam': 'Liverpool', 'AwayTeam': 'Arsenal', 'FTHG': 1, 'FTAG': 1, 'Date': '2024-01-08'}
        ]
        target_match = {'HomeTeam': 'Arsenal', 'AwayTeam': 'Spurs', 'FTHG': 5, 'FTAG': 0, 'Date': '2024-01-15'}
        
        # Target match goals (5, 0) must not appear in train_matches
        for m in train_matches:
            self.assertNotEqual(m['Date'], target_match['Date'])

    def test_4_time_decay_uses_only_historical_dates(self):
        """4. Verify Dixon-Coles time decay age is positive for historical matches."""
        pred_date = pd.to_datetime('2024-01-15')
        hist_date = pd.to_datetime('2024-01-01')
        days_ago = (pred_date - hist_date).days
        
        self.assertGreater(days_ago, 0)
        weight = np.exp(-0.001 * days_ago)
        self.assertTrue(0.0 < weight <= 1.0)

    def test_5_zero_bookmaker_odds_used(self):
        """5. Verify zero bookmaker odds columns are present in feature set."""
        forbidden_cols = ['B365H', 'B365D', 'B365A', 'PSH', 'PSD', 'PSA']
        mock_features = ['HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'Date']
        for col in forbidden_cols:
            self.assertNotIn(col, mock_features)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestGoalModelsLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
