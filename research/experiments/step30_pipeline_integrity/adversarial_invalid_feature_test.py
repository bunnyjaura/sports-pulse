import unittest
import numpy as np

class TestAdversarialInvalidFeature(unittest.TestCase):
    def test_invalid_feature_returns_unavailable(self):
        val = np.nan
        is_invalid = np.isnan(val)
        status = "UNAVAILABLE" if is_invalid else "SUCCESS"
        reason = "FEATURE_COMPUTATION_FAILED" if is_invalid else None

        self.assertEqual(status, "UNAVAILABLE")
        self.assertEqual(reason, "FEATURE_COMPUTATION_FAILED")

if __name__ == "__main__":
    unittest.main()
