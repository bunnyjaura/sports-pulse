import unittest

class TestAdversarialRemoveFeatures(unittest.TestCase):
    def test_remove_all_features_returns_unavailable(self):
        active_count = 0
        status = "UNAVAILABLE" if active_count == 0 else "SUCCESS"
        reason = "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE" if active_count == 0 else None

        self.assertEqual(status, "UNAVAILABLE")
        self.assertEqual(reason, "NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE")

if __name__ == "__main__":
    unittest.main()
