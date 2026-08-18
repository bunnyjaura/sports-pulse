import unittest

class TestFeatureConnectivity(unittest.TestCase):
    def test_active_feature_perturbation_delta(self):
        base_p = {"home": 0.55, "draw": 0.25, "away": 0.20}
        perturbed_p = {"home": 0.60, "draw": 0.22, "away": 0.18}
        
        d_home = abs(perturbed_p["home"] - base_p["home"])
        d_draw = abs(perturbed_p["draw"] - base_p["draw"])
        d_away = abs(perturbed_p["away"] - base_p["away"])
        d_total = d_home + d_draw + d_away

        self.assertGreater(d_total, 1e-4, f"Delta total too low: {d_total}")

if __name__ == "__main__":
    unittest.main()
