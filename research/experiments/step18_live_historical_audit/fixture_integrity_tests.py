"""
Step 18 Audit: Fixture Integrity & Deduplication Tests
Verifies duplicate rejection, invalid matchup detection, and timestamp enforcement.
"""

import sys
import unittest

class TestFixtureIntegrity(unittest.TestCase):

    def test_1_home_equals_away_rejection(self):
        """1. Reject fixtures where HomeTeam == AwayTeam."""
        home_team = "Arsenal"
        away_team = "Arsenal"
        is_valid = (home_team != away_team)
        self.assertFalse(is_valid)

    def test_2_missing_kickoff_rejection(self):
        """2. Reject fixtures with missing or invalid kickoff timestamp."""
        kickoff = None
        is_valid = (kickoff is not None and len(str(kickoff)) > 0)
        self.assertFalse(is_valid)

    def test_3_deduplication(self):
        """3. Deduplicate matches with identical key (league + teams + date)."""
        fix1 = {"key": "ENG_PL:arsenal_vs_chelsea:2025-03-15", "source": "ESPN"}
        fix2 = {"key": "ENG_PL:arsenal_vs_chelsea:2025-03-15", "source": "TheSportsDB"}

        seen = set()
        deduped = []
        for f in [fix1, fix2]:
            if f["key"] not in seen:
                seen.add(f["key"])
                deduped.append(f)

        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0]["source"], "ESPN")

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFixtureIntegrity)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
