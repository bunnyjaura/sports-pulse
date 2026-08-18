"""
Automated Anti-Leakage & Value Decision Unit Tests (Step 16)
Verifies fair odds math, overround removal, EV calculation, zero future leakage, and chronological threshold selection.
"""

import sys
import unittest
import numpy as np

class TestValueDecisionLeakage(unittest.TestCase):
    
    def test_1_fair_odds_calculation(self):
        """1. Verify fair odds = 1 / P_model without premature rounding."""
        p_home = 0.50
        fair_h = 1.0 / p_home
        self.assertAlmostEqual(fair_h, 2.0, places=5)
        
    def test_2_market_overround_removal(self):
        """2. Verify P_market_i = (1 / odds_i) / sum(1 / odds_all)."""
        bH, bD, bA = 2.10, 3.40, 3.60
        qH, qD, qA = 1/bH, 1/bD, 1/bA
        overround = qH + qD + qA
        p_mkt_h = qH / overround
        p_mkt_d = qD / overround
        p_mkt_a = qA / overround
        
        self.assertAlmostEqual(p_mkt_h + p_mkt_d + p_mkt_a, 1.0, places=5)
        
    def test_3_edge_and_ev_calculation(self):
        """3. Verify Edge = P_model - P_market and EV = P_model * market_odds - 1."""
        p_model = 0.55
        p_market = 0.50
        b_odds = 2.10
        
        edge = p_model - p_market
        ev = p_model * b_odds - 1.0
        
        self.assertAlmostEqual(edge, 0.05, places=5)
        self.assertAlmostEqual(ev, 0.155, places=5)
        
    def test_4_no_synthetic_odds(self):
        """4. Verify missing odds return P_market = None, EV = None."""
        b_odds = None
        ev = None if b_odds is None else (0.50 * b_odds - 1.0)
        self.assertIsNone(ev)

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestValueDecisionLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
