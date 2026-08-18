import unittest
import numpy as np

class TestConfidenceBucketAnalysis(unittest.TestCase):
    def test_high_confidence_bucket(self):
        # Filter P >= 0.65
        p_high = np.array([0.70, 0.65, 0.80, 0.75])
        y_high = np.array([1, 1, 1, 0])

        accuracy = np.mean(y_high == 1)
        mean_conf = np.mean(p_high)
        gap = abs(mean_conf - accuracy)

        self.assertLess(gap, 0.20, f"Calibration gap for high confidence is too high: {gap}")

if __name__ == "__main__":
    unittest.main()
