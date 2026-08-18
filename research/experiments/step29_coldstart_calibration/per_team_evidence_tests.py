import unittest

def evaluate_both_team_evidence(team_a_count, team_b_count):
    if team_a_count == 0 or team_b_count == 0:
        return {"status": "UNAVAILABLE", "reasonCode": "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE", "probabilities": None}
    return {"status": "ELIGIBLE", "reasonCode": "BOTH_TEAMS_EVIDENCE_AVAILABLE"}

class TestPerTeamEvidenceGate(unittest.TestCase):
    def test_both_teams_present(self):
        res = evaluate_both_team_evidence(10, 15)
        self.assertEqual(res["status"], "ELIGIBLE")

    def test_one_team_missing(self):
        res = evaluate_both_team_evidence(0, 15)
        self.assertEqual(res["status"], "UNAVAILABLE")
        self.assertIsNone(res["probabilities"])

if __name__ == "__main__":
    unittest.main()
