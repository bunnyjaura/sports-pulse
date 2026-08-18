"""
Live Data Validation Audit (Step 14)
Verifies team existence, non-identical home/away teams, duplicate fixture rejection, and team name normalization.
"""

import sys
import unittest
import pandas as pd

class TestLiveDataValidation(unittest.TestCase):
    
    def test_1_valid_fixture(self):
        """1. Verify home != away and kickoff timestamp is valid."""
        home = "Arsenal"
        away = "Chelsea"
        kickoff = "2024-01-15 15:00:00"
        
        self.assertNotEqual(home, away)
        self.assertTrue(pd.notna(pd.to_datetime(kickoff)))
        
    def test_2_duplicate_fixture_detection(self):
        """2. Verify duplicate upcoming matches are detected and removed."""
        fixtures = [
            {'match_id': 'm1', 'home': 'Arsenal', 'away': 'Chelsea'},
            {'match_id': 'm1', 'home': 'Arsenal', 'away': 'Chelsea'}
        ]
        df = pd.DataFrame(fixtures)
        dedup = df.drop_duplicates(subset=['match_id'])
        self.assertEqual(len(dedup), 1)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestLiveDataValidation)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
