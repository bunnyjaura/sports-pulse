import unittest

CONTRACT_WEIGHTS = {
    "teamStrength": 0.31,
    "recentForm": 0.22,
    "opponentAdjusted": 0.16,
    "homeAway": 0.12,
    "commonOpponents": 0.11,
    "leagueStrength": 0.08,
    "playerStrength": 0.00
}

def calculate_effective_weights(available_map):
    available_sum = sum(w for k, w in CONTRACT_WEIGHTS.items() if available_map.get(k, False))
    if available_sum == 0:
        return {k: 0.0 for k in CONTRACT_WEIGHTS}
    return {k: (w / available_sum if available_map.get(k, False) else 0.0) for k, w in CONTRACT_WEIGHTS.items()}

class TestDynamicWeightRenormalization(unittest.TestCase):
    def test_full_availability(self):
        avail = {k: True for k in CONTRACT_WEIGHTS}
        eff = calculate_effective_weights(avail)
        self.assertAlmostEqual(sum(eff.values()), 1.0, delta=1e-12)
        self.assertAlmostEqual(eff["teamStrength"], 0.31, delta=1e-12)
        self.assertAlmostEqual(eff["homeAway"], 0.12, delta=1e-12)

    def test_partial_availability(self):
        avail = {"teamStrength": True, "recentForm": True, "homeAway": True, "leagueStrength": True}
        eff = calculate_effective_weights(avail)
        # Sum of configured = 0.31 + 0.22 + 0.12 + 0.08 = 0.73
        self.assertAlmostEqual(sum(eff.values()), 1.0, delta=1e-12)
        self.assertAlmostEqual(eff["teamStrength"], 0.31 / 0.73, delta=1e-6)
        self.assertEqual(eff["opponentAdjusted"], 0.0)

if __name__ == "__main__":
    unittest.main()
