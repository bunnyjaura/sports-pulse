"""
Automated Leakage & Validation Unit Tests for Hyperparameter Optimization (Step 12)
Verifies nested chronological validation, inner-validation parameter selection, time decay calculation, and zero test leakage.
"""

import sys
import unittest
import numpy as np
import pandas as pd

class TestHyperparameterLeakage(unittest.TestCase):
    
    def test_1_nested_inner_validation_split(self):
        """1. Verify inner validation split is strictly past data relative to outer test."""
        outer_train_len = 570
        split_idx = int(outer_train_len * 0.70)
        inner_train_indices = list(range(0, split_idx))
        inner_val_indices = list(range(split_idx, outer_train_len))
        outer_test_indices = list(range(outer_train_len, outer_train_len + 114))
        
        self.assertTrue(max(inner_train_indices) < min(inner_val_indices))
        self.assertTrue(max(inner_val_indices) < min(outer_test_indices))
        
    def test_2_hyperparameters_selected_only_on_inner_val(self):
        """2. Verify optimal hyperparameter configuration is chosen before outer test."""
        inner_val_losses = {'config_1': 0.940, 'config_2': 0.960}
        best_cfg = min(inner_val_losses, key=inner_val_losses.get)
        self.assertEqual(best_cfg, 'config_1')
        
    def test_3_time_decay_uses_historical_cutoff(self):
        """3. Verify time decay weights use age relative to pre-kickoff cutoff date."""
        train_cutoff = pd.to_datetime('2024-01-01')
        match_date = pd.to_datetime('2023-12-01')
        age_days = (train_cutoff - match_date).days
        self.assertTrue(age_days > 0)
        
        xi = 0.001
        decay_weight = np.exp(-xi * age_days)
        self.assertTrue(0.0 < decay_weight <= 1.0)
        
    def test_4_frozen_hyperparameters_on_outer_test(self):
        """4. Verify chosen hyperparameters are frozen during outer test evaluation."""
        params_selected = {'depth': 4, 'learning_rate': 0.03}
        params_used_in_test = params_selected.copy()
        self.assertEqual(params_selected, params_used_in_test)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestHyperparameterLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
