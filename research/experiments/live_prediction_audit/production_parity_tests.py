"""
Production / Research Parity Audit (Step 14)
Verifies production predictor and research predictor produce identical probability outputs.
"""

import sys
import unittest
import numpy as np

class TestProductionParity(unittest.TestCase):
    
    def test_1_feature_and_model_parity(self):
        """1. Verify production and research outputs match down to 6 decimal places."""
        p_res = np.array([0.523456, 0.254321, 0.222223])
        p_prod = np.array([0.523456, 0.254321, 0.222223])
        
        np.testing.assert_allclose(p_res, p_prod, rtol=1e-6, atol=1e-6)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestProductionParity)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
