import unittest
import os
import re

class TestNoDefaultProbabilities(unittest.TestCase):
    def test_no_hardcoded_priors_or_fallbacks(self):
        pipeline_path = "src/utils/coldStartPredictionPipeline.js"
        with open(pipeline_path, "r") as f:
            content = f.read()

        forbidden_patterns = [
            r"0\.581",
            r"0\.159",
            r"DEFAULT_PROBABILITIES",
            r"probabilities\s*\?\?",
            r"homeProbability\s*\?\?"
        ]

        for pat in forbidden_patterns:
            matches = re.findall(pat, content)
            self.assertEqual(len(matches), 0, f"Found forbidden hardcoded/fallback pattern '{pat}' in pipeline: {matches}")

if __name__ == "__main__":
    unittest.main()
