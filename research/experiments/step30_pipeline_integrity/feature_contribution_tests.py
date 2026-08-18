import unittest

class TestFeatureContribution(unittest.TestCase):
    def test_feature_contribution_product(self):
        eff_weight = 0.31
        raw_val = 0.15
        c_home = eff_weight * raw_val
        c_draw = eff_weight * 0.005
        c_away = eff_weight * 0.01

        self.assertAlmostEqual(c_home, 0.0465, delta=1e-6)
        self.assertGreater(c_home, 0)
        self.assertGreater(c_draw, 0)

if __name__ == "__main__":
    unittest.main()
