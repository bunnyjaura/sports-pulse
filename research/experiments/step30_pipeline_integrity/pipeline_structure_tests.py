import unittest
import os

class TestPipelineStructure(unittest.TestCase):
    def test_pipeline_module_exists(self):
        pipeline_path = "src/utils/coldStartPredictionPipeline.js"
        self.assertTrue(os.path.exists(pipeline_path), "Canonical prediction pipeline JS module missing.")

    def test_probability_integrity_module_exists(self):
        integrity_path = "src/utils/probabilityIntegrity.js"
        self.assertTrue(os.path.exists(integrity_path), "Probability integrity JS module missing.")

if __name__ == "__main__":
    unittest.main()
