import unittest

def validate_probabilities(p):
    if not p or not isinstance(p, dict):
        return False
    h, d, a = p.get('home', 0), p.get('draw', 0), p.get('away', 0)
    if any(val < 0 or val > 1 for val in (h, d, a)):
        return False
    return abs((h + d + a) - 1.0) < 1e-12

class TestAdversarialInvalidProbability(unittest.TestCase):
    def test_invalid_sum_122_percent_rejected(self):
        invalid_p = {"home": 0.95, "draw": 0.26, "away": 0.01}
        is_valid = validate_probabilities(invalid_p)

        self.assertFalse(is_valid, "Probabilities summing to 122% must be rejected as invalid.")

    def test_valid_softmax_accepted(self):
        valid_p = {"home": 0.54, "draw": 0.26, "away": 0.20}
        is_valid = validate_probabilities(valid_p)

        self.assertTrue(is_valid)

if __name__ == "__main__":
    unittest.main()
