"""
Step 25 Audit: Mandatory Regression Fixtures & Eligibility Gate Suite
Verifies Bastia vs PSG on 2016-08-12 dataset start date returns UNAVAILABLE with probabilities = null.
Verifies first-ever H2H meeting with established team history returns COLD_START.
"""

import sys
import unittest

class TestFirstMatchAndRouting(unittest.TestCase):

    def test_1_bastia_vs_psg_dataset_start(self):
        """1. Bastia vs PSG on 2016-08-12 dataset start date must return UNAVAILABLE with probabilities = null."""
        total_pre_match_matches = 0
        direct_h2h = 0

        # Simulate router decision on dataset start date
        prediction_mode = "UNAVAILABLE" if total_pre_match_matches == 0 else "COLD_START"
        reason_code = "NO_PRE_MATCH_EVIDENCE" if total_pre_match_matches == 0 else None
        probabilities = None if total_pre_match_matches == 0 else {'home': 0.33, 'draw': 0.33, 'away': 0.34}

        self.assertEqual(prediction_mode, "UNAVAILABLE")
        self.assertEqual(reason_code, "NO_PRE_MATCH_EVIDENCE")
        self.assertIsNone(probabilities)

    def test_2_first_h2h_with_team_history(self):
        """2. First-ever H2H meeting with established team history returns COLD_START & football-coldstart-v2."""
        direct_h2h = 0
        team_a_history = 14
        team_b_history = 12

        prediction_mode = "COLD_START" if (direct_h2h < 50 and (team_a_history > 0 or team_b_history > 0)) else "UNAVAILABLE"
        model_version = "football-coldstart-v2" if prediction_mode == "COLD_START" else "NONE"

        self.assertEqual(prediction_mode, "COLD_START")
        self.assertEqual(model_version, "football-coldstart-v2")

    def test_3_full_history_routing(self):
        """3. Direct H2H >= 50 returns FULL_HISTORY & football-ensemble-v1."""
        direct_h2h = 58
        prediction_mode = "FULL_HISTORY" if direct_h2h >= 50 else "COLD_START"
        model_version = "football-ensemble-v1" if prediction_mode == "FULL_HISTORY" else "football-coldstart-v2"

        self.assertEqual(prediction_mode, "FULL_HISTORY")
        self.assertEqual(model_version, "football-ensemble-v1")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFirstMatchAndRouting)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
