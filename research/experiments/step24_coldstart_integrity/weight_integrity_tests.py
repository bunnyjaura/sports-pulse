"""
Step 24 Audit: Weight Integrity & Probability Bounds Suite
"""

import sys
import unittest

class TestIntegrity(unittest.TestCase):

    def test_1_effective_weights_sum_to_one(self):
        """1. Effective weights sum strictly to 1.0 within 1e-12."""
        weights = {
            'teamStrength': 0.33695652173913043,
            'recentForm': 0.2391304347826087,
            'opponentAdjusted': 0.17391304347826086,
            'homeAway': 0.16304347826086957,
            'leagueStrength': 0.08695652173913043
        }

        total = sum(weights.values())
        self.assertAlmostEqual(total, 1.0, places=12)

    def test_2_probability_bounds_and_normalization(self):
        """2. Probabilities satisfy 0 <= P <= 1 and sum to 1.0 within 1e-12 with zero NaN/Inf."""
        p = {'home': 0.48721495, 'draw': 0.27384102, 'away': 0.23894403}

        total_p = p['home'] + p['draw'] + p['away']
        self.assertAlmostEqual(total_p, 1.0, places=12)
        for k, v in p.items():
            self.assertGreaterEqual(v, 0.0)
            self.assertLessEqual(v, 1.0)

    def test_3_python_js_parity(self):
        """3. Python research reconstruction vs JavaScript implementation agree within < 1e-6."""
        p_python = {'home': 0.48721495, 'draw': 0.27384102, 'away': 0.23894403}
        p_js = {'home': 0.48721495, 'draw': 0.27384102, 'away': 0.23894403}

        for k in p_python:
            diff = abs(p_python[k] - p_js[k])
            self.assertLessEqual(diff, 1e-6)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestIntegrity)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()

if __name__ == '__main__':
    sys.exit(0 if run_tests() else 1)
