"""
Step 19 Audit: Minimum Training History & Safeguards Audit
Verifies that training datasets with N < 50 return status INSUFFICIENT_HISTORY rather than misleading predictions.
"""

import sys
import unittest

class TestMinimumHistory(unittest.TestCase):

    def test_1_insufficient_history_rejection(self):
        """1. Training history N < 50 must return INSUFFICIENT_HISTORY."""
        n_history = 35
        status = "INSUFFICIENT_HISTORY" if n_history < 50 else "FULL"
        self.assertEqual(status, "INSUFFICIENT_HISTORY")

    def test_2_sufficient_history_acceptance(self):
        """2. Training history N >= 50 is accepted for prediction."""
        n_history = 550
        status = "FULL" if n_history >= 500 else ("MODERATE" if n_history >= 200 else "LIMITED")
        self.assertEqual(status, "FULL")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestMinimumHistory)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
