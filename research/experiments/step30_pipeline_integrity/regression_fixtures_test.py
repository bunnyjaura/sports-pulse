import unittest
import json
import os

class TestRegressionFixtures(unittest.TestCase):
    def setUp(self):
        self.fixture_dir = os.path.join(os.path.dirname(__file__), "fixtures")

    def test_betis_girona_fixture(self):
        with open(os.path.join(self.fixture_dir, "betis_girona.json")) as f:
            data = json.load(f)
        self.assertEqual(data["homeTeam"], "Real Betis")
        self.assertEqual(data["expectedPipelineChecks"]["probabilityIntegrity"], "PASS")

    def test_man_utd_fulham_fixture(self):
        with open(os.path.join(self.fixture_dir, "man_utd_fulham.json")) as f:
            data = json.load(f)
        self.assertEqual(data["homeTeam"], "Manchester United")
        self.assertEqual(data["expectedPipelineChecks"]["fallbackPrediction"], "NOT_USED")

    def test_le_havre_psg_fixture(self):
        with open(os.path.join(self.fixture_dir, "le_havre_psg.json")) as f:
            data = json.load(f)
        self.assertEqual(data["homeTeam"], "Le Havre")
        self.assertEqual(data["expectedPipelineChecks"]["weightContract"], "PASS")

    def test_bilbao_getafe_fixture(self):
        with open(os.path.join(self.fixture_dir, "bilbao_getafe.json")) as f:
            data = json.load(f)
        self.assertEqual(data["homeTeam"], "Athletic Bilbao")
        self.assertEqual(data["expectedPipelineChecks"]["featureConnectivity"], "PASS")

if __name__ == "__main__":
    unittest.main()
