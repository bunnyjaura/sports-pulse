import unittest
import json
import os

CONTRACT_WEIGHTS = {
    "teamStrength": 0.31,
    "recentForm": 0.22,
    "opponentAdjusted": 0.16,
    "homeAway": 0.12,
    "commonOpponents": 0.11,
    "leagueStrength": 0.08,
    "playerStrength": 0.00
}

CONTRACT_VERSION = "step29-v1"

class TestColdStartWeightContract(unittest.TestCase):
    def test_weights_non_negative(self):
        for k, v in CONTRACT_WEIGHTS.items():
            self.assertGreaterEqual(v, 0.0, f"Weight for {k} is negative: {v}")

    def test_weights_sum_exact_one(self):
        total = sum(CONTRACT_WEIGHTS.values())
        self.assertAlmostEqual(total, 1.0, delta=1e-12, msg=f"Weights do not sum to 1.0 ± 1e-12. Actual: {total}")

    def test_contract_version(self):
        self.assertEqual(CONTRACT_VERSION, "step29-v1")

if __name__ == "__main__":
    unittest.main()
