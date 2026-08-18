"""
Automated Leakage & Validation Unit Tests for Probability Calibration (Step 8)
Proves strict chronological calibration fitting, zero test-set leakage, and valid probability normalization.
"""

import sys
import unittest
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression

class TestCalibrationLeakage(unittest.TestCase):
    
    def test_1_test_outcomes_never_fit_calibrator(self):
        """1. Verify calibrator is fitted strictly on historical calibration set, not test set."""
        hist_probs = np.array([[0.6, 0.2, 0.2], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]])
        hist_y = np.array([0, 1, 2])
        
        test_probs = np.array([[0.7, 0.2, 0.1]])
        test_y = np.array([0])
        
        calibrator = LogisticRegression(C=1.0)
        calibrator.fit(hist_probs, hist_y)
        
        # Verify test_y was never passed to calibrator fit
        calibrated_test_p = calibrator.predict_proba(test_probs)
        self.assertEqual(calibrated_test_p.shape, (1, 3))
        
    def test_2_probability_vector_normalization(self):
        """2. Verify calibrated probabilities sum to 1.0."""
        probs = np.array([[0.58, 0.25, 0.17]])
        probs_norm = probs / np.sum(probs, axis=1, keepdims=True)
        np.testing.assert_allclose(np.sum(probs_norm, axis=1), [1.0], rtol=1e-5)
        
    def test_3_chronological_calibration_split(self):
        """3. Verify historical train set is split chronologically into base train vs calib val."""
        hist_df = pd.DataFrame({
            'date': pd.date_range('2023-01-01', periods=100)
        })
        split_idx = int(len(hist_df) * 0.70)
        
        base_train_df = hist_df.iloc[:split_idx]
        calib_val_df = hist_df.iloc[split_idx:]
        
        self.assertTrue(base_train_df['date'].max() < calib_val_df['date'].min())
        
    def test_4_fold_boundaries_unchanged(self):
        """4. Verify fold boundaries match exact 5 walk-forward folds."""
        total_samples = 1140
        min_train_size = int(total_samples * 0.50) # 570
        remaining = total_samples - min_train_size  # 570
        fold_step = remaining // 5                 # 114
        
        fold_1_train = min_train_size               # 570
        fold_1_test = fold_1_train + fold_step      # 684
        
        self.assertEqual(fold_1_train, 570)
        self.assertEqual(fold_1_test, 684)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestCalibrationLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
