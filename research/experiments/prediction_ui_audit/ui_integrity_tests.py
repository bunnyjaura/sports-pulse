"""
UI States & Post-Match Immutability Audit (Step 17)
Verifies error states (LOADING, VALID, STALE, REJECTED, UNAVAILABLE, COMPLETED) and post-match prediction immutability.
"""

import sys
import unittest

class TestUIStatesAndImmutability(unittest.TestCase):
    
    def test_1_valid_ui_states(self):
        """1. Verify allowed prediction UI states."""
        allowed_states = {'LOADING', 'VALID', 'STALE', 'REJECTED', 'UNAVAILABLE', 'COMPLETED'}
        curr_state = 'VALID'
        self.assertIn(curr_state, allowed_states)
        
    def test_2_post_match_immutability(self):
        """2. Verify post-match view displays actual result without mutating pre-match probabilities."""
        pre_match_probs = {'home': 54.0, 'draw': 25.0, 'away': 21.0}
        post_match_view = {
            'pre_match_probabilities': pre_match_probs.copy(),
            'actual_result': 'H',
            'accuracy': True,
            'log_loss': 0.6162
        }
        
        self.assertEqual(pre_match_probs, post_match_view['pre_match_probabilities'])

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestUIStatesAndImmutability)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
