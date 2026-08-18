import unittest
import numpy as np

class TestCalibrationAnalysis(unittest.TestCase):
    def test_calibration_metrics(self):
        # Simulated holdout predictions & outcomes
        y_true = np.array([1, 0, 0, 1, 0, 1, 1, 0, 1, 0]) # 1 for Home Win
        p_pred = np.array([0.70, 0.30, 0.40, 0.65, 0.20, 0.80, 0.60, 0.25, 0.75, 0.15])

        accuracy = np.mean((p_pred >= 0.5) == y_true)
        brier = np.mean((p_pred - y_true) ** 2)
        log_loss = -np.mean(y_true * np.log(p_pred) + (1 - y_true) * np.log(1 - p_pred))

        self.assertGreaterEqual(accuracy, 0.70)
        self.assertLess(brier, 0.25)
        self.assertLess(log_loss, 0.60)

if __name__ == "__main__":
    unittest.main()
