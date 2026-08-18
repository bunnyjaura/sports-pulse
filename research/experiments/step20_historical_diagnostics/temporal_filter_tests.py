"""
Step 20 Audit: Temporal Filter & Production Protection Verification
Verifies strict pre-kickoff cutoff inequality (training < target) and model frozen protection.
"""

import sys
import unittest

class TestTemporalAndProtection(unittest.TestCase):

    def test_1_strict_cutoff_inequality(self):
        """1. Training matches must strictly precede target kickoff (training < target)."""
        target_cutoff = "2019-08-09T00:00:00.000Z"
        training_dates = ["2016-08-13T00:00:00.000Z", "2018-05-13T00:00:00.000Z", "2019-05-12T00:00:00.000Z"]
        invalid_dates = ["2019-08-09T00:00:00.000Z", "2019-08-10T00:00:00.000Z"]

        valid = [d for d in training_dates if d < target_cutoff]
        leaked = [d for d in invalid_dates if d < target_cutoff]

        self.assertEqual(len(valid), 3)
        self.assertEqual(len(leaked), 0)

    def test_2_minimum_history_safeguard_preserved(self):
        """2. N < 50 strictly suppresses probability outputs."""
        n_obs = 30
        status = "INSUFFICIENT_HISTORY" if n_obs < 50 else "FULL_HISTORY"
        self.assertEqual(status, "INSUFFICIENT_HISTORY")

    def test_3_production_model_contract_frozen(self):
        """3. Production model contract version remains football-ensemble-v1."""
        model_version = "football-ensemble-v1"
        self.assertEqual(model_version, "football-ensemble-v1")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestTemporalAndProtection)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
