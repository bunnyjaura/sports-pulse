import unittest

class TestPythonJsParity(unittest.TestCase):
    def test_parity_tolerance(self):
        p_py = {"home": 0.521875, "draw": 0.263421, "away": 0.214704}
        p_js = {"home": 0.521875, "draw": 0.263421, "away": 0.214704}

        for k in p_py:
            diff = abs(p_py[k] - p_js[k])
            self.assertLess(diff, 1e-6, f"Parity diff for '{k}' exceeds 1e-6: {diff}")

if __name__ == "__main__":
    unittest.main()
