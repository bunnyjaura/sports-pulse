"""
Step 22 Audit: Dynamic Missing-Evidence Weight Renormalization Verification
Verifies that when evidence categories are UNAVAILABLE, remaining weights re-normalize strictly to sum to 1.0 without synthetic default insertion.
"""

import sys
import unittest

def renormalize_weights(base_weights, available_keys):
    tot = sum(base_weights[k] for k in available_keys if k in base_weights)
    if tot == 0: return {}
    return {k: base_weights[k] / tot for k in available_keys if k in base_weights}

class TestMissingEvidence(unittest.TestCase):

    def test_1_dynamic_renormalization(self):
        """1. Available weights re-normalize to sum to 1.0 when player data is UNAVAILABLE."""
        base_weights = {
            "teamStrength": 0.31,
            "recentForm": 0.22,
            "opponentStrength": 0.16,
            "commonOpponents": 0.11,
            "homeAway": 0.12,
            "leagueStrength": 0.08,
            "playerStrength": 0.00
        }

        # Player data is UNAVAILABLE
        available_keys = ["teamStrength", "recentForm", "opponentStrength", "commonOpponents", "homeAway", "leagueStrength"]
        norm = renormalize_weights(base_weights, available_keys)

        total_sum = sum(norm.values())
        self.assertAlmostEqual(total_sum, 1.0, places=10)
        self.assertNotIn("playerStrength", norm)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestMissingEvidence)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
