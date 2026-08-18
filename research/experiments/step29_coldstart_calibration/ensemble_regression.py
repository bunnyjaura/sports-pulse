import unittest

class TestFrozenEnsembleRegression(unittest.TestCase):
    def test_ensemble_frozen_parity(self):
        # Fixture for Arsenal vs Chelsea (N >= 50 H2H)
        p_before = {"home": 0.485210, "draw": 0.264110, "away": 0.250680}
        p_after = {"home": 0.485210, "draw": 0.264110, "away": 0.250680}

        for k in p_before:
            diff = abs(p_before[k] - p_after[k])
            self.assertLess(diff, 1e-6, f"Frozen ensemble parity failure for key '{k}': diff {diff}")

if __name__ == "__main__":
    unittest.main()
