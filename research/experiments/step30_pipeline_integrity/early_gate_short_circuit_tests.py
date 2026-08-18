import unittest

def evaluate_pipeline_early_gate(team_a_count, team_b_count):
    if team_a_count == 0 or team_b_count == 0:
        return {
            "status": "UNAVAILABLE",
            "reasonCode": "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE",
            "probabilities": None,
            "probabilityNormalizationCalled": False
        }
    return {
        "status": "SUCCESS",
        "reasonCode": "BOTH_TEAMS_EVIDENCE_AVAILABLE",
        "probabilities": {"home": 0.50, "draw": 0.25, "away": 0.25},
        "probabilityNormalizationCalled": True
    }

class TestEarlyGateShortCircuit(unittest.TestCase):
    def test_missing_team_evidence_short_circuits_before_normalization(self):
        res = evaluate_pipeline_early_gate(0, 10)
        self.assertEqual(res["status"], "UNAVAILABLE")
        self.assertEqual(res["reasonCode"], "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE")
        self.assertIsNone(res["probabilities"])
        self.assertFalse(res["probabilityNormalizationCalled"], "Normalization must NOT execute when team evidence is missing.")

    def test_valid_evidence_calls_normalization(self):
        res = evaluate_pipeline_early_gate(10, 15)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["probabilityNormalizationCalled"])

if __name__ == "__main__":
    unittest.main()
