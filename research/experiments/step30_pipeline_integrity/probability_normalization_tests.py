import unittest
import numpy as np

def softmax_normalize(scores):
    m = np.max(scores)
    exp_s = np.exp(scores - m)
    sum_e = np.sum(exp_s)
    if sum_e == 0 or not np.isfinite(sum_e):
        return None
    return exp_s / sum_e

class TestProbabilityNormalization(unittest.TestCase):
    def test_softmax_normalization_sum_and_bounds(self):
        scores = np.array([0.45, 0.10, 0.25])
        p = softmax_normalize(scores)

        self.assertIsNotNone(p)
        self.assertAlmostEqual(np.sum(p), 1.0, delta=1e-12)
        for val in p:
            self.assertGreaterEqual(val, 0.0)
            self.assertLessEqual(val, 1.0)

    def test_nan_or_inf_scores(self):
        scores = np.array([np.nan, 0.10, 0.25])
        p = softmax_normalize(scores)
        self.assertIsNone(p)

if __name__ == "__main__":
    unittest.main()
