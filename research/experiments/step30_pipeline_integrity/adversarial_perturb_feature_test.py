import unittest

class TestAdversarialPerturbFeature(unittest.TestCase):
    def test_perturb_single_feature_delta(self):
        base_p = [0.45, 0.25, 0.30]
        perturbed_p = [0.52, 0.23, 0.25]
        
        delta = sum(abs(a - b) for a, b in zip(base_p, perturbed_p))
        self.assertGreater(delta, 1e-4)

if __name__ == "__main__":
    unittest.main()
