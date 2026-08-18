import unittest
import os
import re

class TestWeightConfigurationDrift(unittest.TestCase):
    def test_zero_weight_configuration_drift(self):
        js_contract_path = "src/utils/coldStartWeightContract.js"
        self.assertTrue(os.path.exists(js_contract_path), "ColdStartWeightContract JS module missing.")

        with open(js_contract_path, "r") as f:
            content = f.read()

        self.assertIn("version: 'step29-v1'", content)
        self.assertIn("teamStrength: 0.31", content)
        self.assertIn("recentForm: 0.22", content)
        self.assertIn("opponentAdjusted: 0.16", content)
        self.assertIn("homeAway: 0.12", content)
        self.assertIn("commonOpponents: 0.11", content)
        self.assertIn("leagueStrength: 0.08", content)

if __name__ == "__main__":
    unittest.main()
