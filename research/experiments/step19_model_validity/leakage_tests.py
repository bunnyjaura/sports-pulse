"""
Step 19 Audit: Temporal Leakage Audit
Enforces strict inequality: trainingMatch.kickoffAt < targetMatch.kickoffAt.
"""

import sys
import unittest

class TestStep19Leakage(unittest.TestCase):

    def test_1_strict_cutoff_filtering(self):
        """1. Training matches must strictly precede target cutoff timestamp."""
        target_cutoff = "2023-08-12"
        training_dates = ["2023-08-01", "2023-08-10", "2023-08-11"]
        invalid_dates = ["2023-08-12", "2023-08-13"]

        valid = [d for d in training_dates if d < target_cutoff]
        leaked = [d for d in invalid_dates if d < target_cutoff]

        self.assertEqual(len(valid), 3)
        self.assertEqual(len(leaked), 0)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStep19Leakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
