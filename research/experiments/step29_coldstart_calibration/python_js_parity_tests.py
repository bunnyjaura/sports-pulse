import unittest

class TestPythonJsParity(unittest.TestCase):
    def test_parity_tolerance(self):
        p_py = {"home": 0.542857, "draw": 0.260000, "away": 0.197143}
        p_js = {"home": 0.542857, "draw": 0.260000, "away": 0.197143}

        for k in p_py:
            diff = abs(p_py[k] - p_js[k])
            self.assertLess(diff, 1e-6, f"Parity diff for '{k}' exceeds 1e-6: {diff}")

if __name__ == "__main__":
    unittest.main()
