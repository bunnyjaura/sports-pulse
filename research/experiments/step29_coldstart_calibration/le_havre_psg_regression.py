import unittest
import json
import os

class TestLeHavrePsgRegression(unittest.TestCase):
    def setUp(self):
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "le_havre_psg.json")
        with open(fixture_path, "r") as f:
            self.fixture = json.load(f)

    def test_fixture_integrity(self):
        self.assertEqual(self.fixture["homeTeam"], "Le Havre")
        self.assertEqual(self.fixture["awayTeam"], "Paris Saint-Germain")
        self.assertEqual(self.fixture["kickoffAt"], "2026-08-14T18:45:00.000Z")
        self.assertEqual(self.fixture["expectedIntegrity"]["directH2HCount"], 6)
        self.assertTrue(self.fixture["expectedIntegrity"]["bothTeamEvidence"])
        self.assertEqual(self.fixture["expectedIntegrity"]["configuredWeights"]["homeAway"], 0.12)
        self.assertEqual(self.fixture["expectedIntegrity"]["configuredWeights"]["opponentAdjusted"], 0.16)

if __name__ == "__main__":
    unittest.main()
