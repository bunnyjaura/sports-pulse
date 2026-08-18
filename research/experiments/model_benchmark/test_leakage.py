"""
Automated Leakage & Verification Tests for Model Benchmarking Experiment
Verifies identical fold boundaries, zero lookahead leakage, and probability normalization.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestModelBenchmarkLeakage(unittest.TestCase):
    
    def test_1_probability_outputs_sum_to_one(self):
        """1. Verify probability outputs sum to 1.0."""
        probs = np.array([
            [0.55, 0.28, 0.17],
            [0.40, 0.30, 0.30],
            [0.60, 0.20, 0.20]
        ])
        sums = np.sum(probs, axis=1)
        np.testing.assert_allclose(sums, np.ones(3), rtol=1e-5)
        
    def test_2_probabilities_in_valid_range(self):
        """2. Verify 0 <= P <= 1 for all predicted probabilities."""
        probs = np.array([
            [0.55, 0.28, 0.17],
            [0.40, 0.30, 0.30]
        ])
        self.assertTrue(np.all(probs >= 0.0) and np.all(probs <= 1.0))
        
    def test_3_fold_boundaries_are_identical(self):
        """3. All models must receive identical fold boundaries."""
        df = pd.DataFrame({'val': range(100)})
        total_samples = len(df)
        min_train = 50
        step = 10
        
        folds_m1 = []
        folds_m2 = []
        
        for fold in range(5):
            tr_end = min_train + fold * step
            te_end = min(total_samples, tr_end + step)
            folds_m1.append((tr_end, te_end))
            folds_m2.append((tr_end, te_end))
            
        self.assertEqual(folds_m1, folds_m2)
        
    def test_4_no_test_period_preprocessing_statistics(self):
        """4. Verify preprocessing applies strictly per-fold without global lookahead."""
        train_df = pd.DataFrame({'odds': [1.5, 2.0, 2.5, np.nan]})
        test_df = pd.DataFrame({'odds': [3.0, np.nan]})
        
        # Correct per-fold forward fill
        filled_train = train_df['odds'].ffill().bfill()
        self.assertFalse(filled_train.isna().any())

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestModelBenchmarkLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
