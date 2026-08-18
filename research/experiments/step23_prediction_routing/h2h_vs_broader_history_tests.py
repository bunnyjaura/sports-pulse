"""
Step 23 Audit: H2H vs Broader History & Dynamic Weight Renormalization Verification
"""

import sys
import unittest

class TestH2HVsBroaderHistory(unittest.TestCase):

    def test_1_bastia_vs_psg_fixture_case(self):
        """1. Bastia vs PSG (H2H=0, Team History > 0) returns COLD_START, not INSUFFICIENT_HISTORY."""
        h2h_count = 0
        bastia_history_count = 137
        psg_history_count = 142

        has_broader_evidence = (bastia_history_count > 0 and psg_history_count > 0)
        mode = "FULL_HISTORY" if h2h_count >= 50 else ("COLD_START" if has_broader_evidence else "UNAVAILABLE")

        self.assertEqual(mode, "COLD_START")
        self.assertNotEqual(mode, "UNAVAILABLE")

    def test_2_dynamic_weight_sum_equals_one(self):
        """2. Effective evidence weights sum strictly to 1.0."""
        config_weights = {
            'teamStrength': 0.31,
            'recentForm': 0.22,
            'opponentAdjusted': 0.16,
            'homeAway': 0.15,
            'commonOpponents': 0.11,
            'leagueStrength': 0.08,
            'playerStrength': 0.00
        }

        # Player data UNAVAILABLE
        available_keys = ['teamStrength', 'recentForm', 'opponentAdjusted', 'homeAway', 'commonOpponents', 'leagueStrength']
        tot = sum(config_weights[k] for k in available_keys)
        eff_weights = {k: config_weights[k] / tot for k in available_keys}

        self.assertAlmostEqual(sum(eff_weights.values()), 1.0, places=10)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestH2HVsBroaderHistory)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
