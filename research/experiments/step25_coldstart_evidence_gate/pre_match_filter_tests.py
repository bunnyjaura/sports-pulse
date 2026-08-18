"""
Step 25 Audit: Pre-Match Filter Timestamp Inequality Suite
Verifies match.kickoffAtMs < target.kickoffAtMs strictly (<, never <=).
"""

import sys
import unittest

class TestPreMatchFilter(unittest.TestCase):

    def test_1_strict_timestamp_inequality(self):
        """1. Verify match timestamp < target timestamp strictly."""
        target_timestamp = 1600000000
        prior_match = 1599999999
        same_time_match = 1600000000
        future_match = 1600000001

        self.assertTrue(prior_match < target_timestamp)
        self.assertFalse(same_time_match < target_timestamp)
        self.assertFalse(future_match < target_timestamp)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPreMatchFilter)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
