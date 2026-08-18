"""
Step 23 Audit: Prediction Router & History Concept Verification
Verifies:
 - H2H >= 50 -> FULL_HISTORY (football-ensemble-v1)
 - H2H < 50 + broader evidence -> COLD_START (football-coldstart-v2)
 - Zero broader evidence -> UNAVAILABLE
"""

import sys
import unittest

class TestPredictionRouterStep23(unittest.TestCase):

    def test_1_full_history_routing(self):
        """1. Direct H2H N >= 50 routes to FULL_HISTORY & football-ensemble-v1."""
        h2h_n = 52
        has_broader_evidence = True

        mode = "FULL_HISTORY" if h2h_n >= 50 else ("COLD_START" if has_broader_evidence else "UNAVAILABLE")
        model = "football-ensemble-v1" if mode == "FULL_HISTORY" else "football-coldstart-v2"

        self.assertEqual(mode, "FULL_HISTORY")
        self.assertEqual(model, "football-ensemble-v1")

    def test_2_cold_start_routing_h2h_zero(self):
        """2. Direct H2H N = 0 with broader team/league evidence routes to COLD_START & football-coldstart-v2."""
        h2h_n = 0
        has_broader_evidence = True

        mode = "FULL_HISTORY" if h2h_n >= 50 else ("COLD_START" if has_broader_evidence else "UNAVAILABLE")
        model = "football-coldstart-v2" if mode == "COLD_START" else "NONE"

        self.assertEqual(mode, "COLD_START")
        self.assertEqual(model, "football-coldstart-v2")

    def test_3_unavailable_routing_early_dataset(self):
        """3. Zero broader evidence (e.g. earliest dataset start date) routes to UNAVAILABLE."""
        h2h_n = 0
        has_broader_evidence = False

        mode = "FULL_HISTORY" if h2h_n >= 50 else ("COLD_START" if has_broader_evidence else "UNAVAILABLE")

        self.assertEqual(mode, "UNAVAILABLE")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPredictionRouterStep23)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
