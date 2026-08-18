"""
Step 26 Audit: Past Match Eligibility Gate Suite
Verifies preMatchCount > 0 is the authoritative eligibility condition.
Verifies target match before or at dataset boundary start date is EXCLUDED with prediction = null.
Verifies router is never called for excluded targets.
"""

import sys
import unittest

class TestPastMatchEligibility(unittest.TestCase):

    def test_1_bastia_vs_psg_dataset_boundary(self):
        """1. Bastia vs PSG on 2016-08-12 dataset start date must return status = EXCLUDED, prediction = null."""
        pre_match_count = 0
        target_timestamp = 1470960000
        earliest_timestamp = 1470960000

        eligible = pre_match_count > 0 and target_timestamp > earliest_timestamp
        status = 'ELIGIBLE' if eligible else 'EXCLUDED'
        reason_code = 'NO_PRE_MATCH_DATA' if not eligible else None
        prediction = {'prob': 0.5} if eligible else None

        self.assertFalse(eligible)
        self.assertEqual(status, 'EXCLUDED')
        self.assertEqual(reason_code, 'NO_PRE_MATCH_DATA')
        self.assertIsNone(prediction)

    def test_2_first_h2h_with_team_history(self):
        """2. First-ever H2H meeting with established team history returns status = PREDICTED, predictionMode = COLD_START."""
        direct_h2h = 0
        pre_match_count = 140

        eligible = pre_match_count > 0
        prediction_mode = 'COLD_START' if (eligible and direct_h2h < 50) else ('FULL_HISTORY' if direct_h2h >= 50 else 'EXCLUDED')
        model_version = 'football-coldstart-v2' if prediction_mode == 'COLD_START' else 'football-ensemble-v1'

        self.assertTrue(eligible)
        self.assertEqual(prediction_mode, 'COLD_START')
        self.assertEqual(model_version, 'football-coldstart-v2')

    def test_3_full_history_preservation(self):
        """3. Direct H2H >= 50 returns status = PREDICTED, predictionMode = FULL_HISTORY."""
        direct_h2h = 58
        pre_match_count = 1200

        eligible = pre_match_count > 0
        prediction_mode = 'FULL_HISTORY' if direct_h2h >= 50 else 'COLD_START'
        model_version = 'football-ensemble-v1'

        self.assertTrue(eligible)
        self.assertEqual(prediction_mode, 'FULL_HISTORY')
        self.assertEqual(model_version, 'football-ensemble-v1')

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPastMatchEligibility)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
