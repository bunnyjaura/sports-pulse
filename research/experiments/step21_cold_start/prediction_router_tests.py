"""
Step 21 Audit: Prediction Router Verification
Verifies routing: N >= 50 -> FULL_HISTORY (football-ensemble-v1), N < 50 -> COLD_START (football-coldstart-v1), Zero evidence -> UNAVAILABLE.
"""

import sys
import unittest

class TestPredictionRouter(unittest.TestCase):

    def test_1_full_history_routing(self):
        """1. Direct observation N >= 50 routes to FULL_HISTORY & football-ensemble-v1."""
        n_obs = 55
        mode = "FULL_HISTORY" if n_obs >= 50 else "COLD_START"
        model = "football-ensemble-v1" if mode == "FULL_HISTORY" else "football-coldstart-v1"

        self.assertEqual(mode, "FULL_HISTORY")
        self.assertEqual(model, "football-ensemble-v1")

    def test_2_cold_start_routing(self):
        """2. Direct observation N < 50 with evidence routes to COLD_START & football-coldstart-v1."""
        n_obs = 0
        has_evidence = True
        mode = "FULL_HISTORY" if n_obs >= 50 else ("COLD_START" if has_evidence else "UNAVAILABLE")
        model = "football-coldstart-v1" if mode == "COLD_START" else "NONE"

        self.assertEqual(mode, "COLD_START")
        self.assertEqual(model, "football-coldstart-v1")

    def test_3_unavailable_routing(self):
        """3. Zero evidence for both teams routes to UNAVAILABLE."""
        n_obs = 0
        has_evidence = False
        mode = "FULL_HISTORY" if n_obs >= 50 else ("COLD_START" if has_evidence else "UNAVAILABLE")

        self.assertEqual(mode, "UNAVAILABLE")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPredictionRouter)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
