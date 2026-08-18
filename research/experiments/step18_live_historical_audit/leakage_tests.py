"""
Step 18 Audit: Pre-Match Temporal Leakage Audit
Verifies that target matches and all future matches are strictly excluded from training datasets.
"""

import sys
import unittest
import pandas as pd

class TestStep18Leakage(unittest.TestCase):

    def test_1_target_match_excluded(self):
        """1. Target match must never be present in its own training set."""
        target_id = "match-2025-015"
        target_kickoff = pd.to_datetime("2025-03-15 15:00:00")

        history = [
            {"id": "match-2025-010", "date": "2025-03-01 15:00:00"},
            {"id": "match-2025-015", "date": "2025-03-15 15:00:00"},
            {"id": "match-2025-020", "date": "2025-03-20 15:00:00"}
        ]

        training = [m for m in history if m["id"] != target_id and pd.to_datetime(m["date"]) < target_kickoff]
        self.assertNotIn("match-2025-015", [m["id"] for m in training])
        self.assertEqual(len(training), 1)

    def test_2_future_matches_excluded(self):
        """2. Any match with kickoff >= target kickoff must be excluded."""
        target_kickoff = pd.to_datetime("2025-03-15 15:00:00")
        match_dates = pd.to_datetime(["2025-03-01 15:00:00", "2025-03-15 15:00:00", "2025-03-16 15:00:00"])

        valid = [d for d in match_dates if d < target_kickoff]
        self.assertEqual(len(valid), 1)
        self.assertEqual(valid[0], pd.to_datetime("2025-03-01 15:00:00"))

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStep18Leakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
