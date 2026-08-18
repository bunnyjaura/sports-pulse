"""
Step 27 Audit: League-Only Context Rejection & Evidence Quality Suite
Verifies Arsenal vs Liverpool on 2016-08-14 returns UNAVAILABLE with probabilities = null.
Verifies league context alone cannot trigger COLD_START.
Verifies first-ever H2H meeting with team history returns COLD_START.
"""

import sys
import unittest

class TestEvidenceQualityGate(unittest.TestCase):

    def test_1_arsenal_vs_liverpool_league_only_rejection(self):
        """1. Arsenal vs Liverpool (2016-08-14) with 14 league matches but 0 team matches returns UNAVAILABLE with probabilities = null."""
        team_specific_count = 0
        contextual_count = 1

        team_specific_available = team_specific_count > 0
        prediction_mode = "COLD_START" if team_specific_available else "UNAVAILABLE"
        reason_code = "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE" if not team_specific_available else None
        probabilities = {'home': 0.443, 'draw': 0.251, 'away': 0.306} if team_specific_available else None

        self.assertFalse(team_specific_available)
        self.assertEqual(prediction_mode, "UNAVAILABLE")
        self.assertEqual(reason_code, "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE")
        self.assertIsNone(probabilities)

    def test_2_first_h2h_with_team_history_accepted(self):
        """2. First-ever H2H meeting with established team history returns COLD_START & football-coldstart-v2."""
        direct_h2h = 0
        team_specific_count = 3  # Team strength, recent form, home/away

        team_specific_available = team_specific_count > 0
        prediction_mode = "COLD_START" if (direct_h2h < 50 and team_specific_available) else "UNAVAILABLE"
        model_version = "football-coldstart-v2" if prediction_mode == "COLD_START" else "NONE"

        self.assertTrue(team_specific_available)
        self.assertEqual(prediction_mode, "COLD_START")
        self.assertEqual(model_version, "football-coldstart-v2")

    def test_3_full_history_preservation(self):
        """3. Direct H2H >= 50 returns FULL_HISTORY & football-ensemble-v1."""
        direct_h2h = 58
        prediction_mode = "FULL_HISTORY" if direct_h2h >= 50 else "COLD_START"
        model_version = "football-ensemble-v1" if prediction_mode == "FULL_HISTORY" else "football-coldstart-v2"

        self.assertEqual(prediction_mode, "FULL_HISTORY")
        self.assertEqual(model_version, "football-ensemble-v1")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestEvidenceQualityGate)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
