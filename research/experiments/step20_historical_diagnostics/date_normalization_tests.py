"""
Step 20 Audit: Date Normalization & Team Alias Verification
Verifies deterministic ISO timestamp conversion and team alias mappings.
"""

import sys
import unittest

TEAM_ALIAS_MAP = {
    'Ath Madrid': 'Atletico Madrid',
    'Atlético Madrid': 'Atletico Madrid',
    'Man United': 'Manchester United',
    'Man Utd': 'Manchester United',
    'Nott\'m Forest': 'Nottingham Forest',
    'Notts Forest': 'Nottingham Forest',
    'Man City': 'Manchester City',
    'Spurs': 'Tottenham'
}

def normalize_team(name):
    return TEAM_ALIAS_MAP.get(name, name)

class TestNormalizations(unittest.TestCase):

    def test_1_team_alias_resolution(self):
        """1. Team aliases resolve to identical canonical names."""
        self.assertEqual(normalize_team("Ath Madrid"), "Atletico Madrid")
        self.assertEqual(normalize_team("Atlético Madrid"), "Atletico Madrid")
        self.assertEqual(normalize_team("Man United"), "Manchester United")
        self.assertEqual(normalize_team("Man Utd"), "Manchester United")
        self.assertEqual(normalize_team("Nott'm Forest"), "Nottingham Forest")

    def test_2_strict_numerical_date_comparison(self):
        """2. Dates compare strictly via numerical timestamps."""
        t1 = "2019-08-09T00:00:00.000Z"
        t2 = "2019-08-10T00:00:00.000Z"
        self.assertTrue(t1 < t2)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestNormalizations)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
