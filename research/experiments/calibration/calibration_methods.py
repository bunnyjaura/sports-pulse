"""
Multiclass Probability Calibration Methods (Platt / Logistic & Isotonic Regression)
Leakage-safe implementation fitted strictly on historical calibration validation sets.
Includes small sample protection (N < 50) for Isotonic regression.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression

class PlattCalibrator:
    """Multiclass Platt Scaling via Logistic Regression"""
    def __init__(self):
        self.model = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
        self.fitted = False
        
    def fit(self, probs_calib, y_calib):
        if len(y_calib) < 10 or len(set(y_calib)) < 2:
            self.fitted = False
            return self
        try:
            self.model.fit(probs_calib, y_calib)
            self.fitted = True
        except Exception:
            self.fitted = False
        return self
        
    def calibrate(self, probs_test):
        if not self.fitted:
            return probs_test
        try:
            calib_p = self.model.predict_proba(probs_test)
            # Ensure shape is (N, 3) and normalized
            if calib_p.shape[1] == 3:
                sums = np.sum(calib_p, axis=1, keepdims=True)
                sums[sums == 0] = 1.0
                return calib_p / sums
            return probs_test
        except Exception:
            return probs_test

class IsotonicCalibrator:
    """Multiclass 1-vs-Rest Isotonic Regression with Small Sample Protection"""
    def __init__(self, min_samples=50):
        self.min_samples = min_samples
        self.iso_models = [None, None, None]
        self.fitted = False
        
    def fit(self, probs_calib, y_calib):
        if len(y_calib) < self.min_samples or len(set(y_calib)) < 2:
            self.fitted = False
            return self
            
        try:
            for k in range(3):
                y_binary = (y_calib == k).astype(float)
                p_k = probs_calib[:, k]
                iso = IsotonicRegression(out_of_bounds='clip', y_min=0.01, y_max=0.99)
                iso.fit(p_k, y_binary)
                self.iso_models[k] = iso
            self.fitted = True
        except Exception:
            self.fitted = False
        return self
        
    def calibrate(self, probs_test):
        if not self.fitted:
            return probs_test
            
        try:
            calib_p = np.zeros_like(probs_test)
            for k in range(3):
                calib_p[:, k] = self.iso_models[k].predict(probs_test[:, k])
                
            sums = np.sum(calib_p, axis=1, keepdims=True)
            sums[sums == 0] = 1.0
            return calib_p / sums
        except Exception:
            return probs_test
