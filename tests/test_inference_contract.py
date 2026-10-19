"""Source-only checks: no binary training yields required in ordinary site CI."""
from __future__ import annotations

import ast
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class InferenceContractTests(unittest.TestCase):
    def test_api_is_present_and_hash_pinned(self):
        src = (ROOT / "deployment/inference_api.py").read_text(encoding="utf-8")
        ast.parse(src)
        self.assertIn("load_runtime", src)
        self.assertIn("predict_saved", src)
        self.assertIn("verify_artifacts()", src)
        self.assertIn('"Reference26"', src)
        self.assertIn("final_train138.joblib", src)
        self.assertIn("features197.parquet", src)
        self.assertIn("distance197.npy", src)
        self.assertIn("54afbcf81d60623a634b64afb498152b11a0f66ea4c3e21cab2d4939250ac147", src)
        self.assertIn("22a18f9907457dacd91377131ae56e1440ab6f47ca2307f38a498d819d0b2733", src)
        self.assertIn("8f6e62c5967524f6ae3754086a9e2f78615653053c4012865ba2f6da2c8e7113", src)
        self.assertIn("reproduced_59_aggregate", src)
        self.assertIn("new_parcels_supported", src)
        self.assertIn("from src.geoc_local04d_snapshot import haversine_distance_matrix, normalized_distance_matrix", src)
        self.assertIn("np.allclose", src)
        self.assertIn("np.isclose", src)
        self.assertIn("HTTPException(503", src)

    def test_browser_requires_59_reference26_numerical_parity(self):
        html = (SITE / "index.html").read_text(encoding="utf-8")
        browser = (SITE / "browser_inference.js").read_text(encoding="utf-8")
        engine = (SITE / "reference26_engine.js").read_text(encoding="utf-8")
        self.assertIn("./browser_inference.js", html)
        self.assertIn("./reference26_engine.js", html)
        self.assertIn("Reference26Browser.parity", browser)
        self.assertIn("ready(null)", browser)
        self.assertIn("function ridge", engine)
        self.assertIn("function geology", engine)
        self.assertIn("function correction", engine)

    def test_no_fabricated_server_url(self):
        cfg = json.loads((SITE / "data/inference_config.json").read_text(encoding="utf-8"))
        self.assertTrue(cfg["api_base_url"] == "" or cfg["api_base_url"].startswith("https://"))
        self.assertEqual(cfg["model"], "Reference26")
        self.assertIn(cfg["status"], ("pending deployment", "deployed"))
        self.assertTrue((ROOT / "render.yaml").is_file())
        self.assertTrue((ROOT / "deployment/requirements-api.txt").is_file())
        readme = (ROOT / "deployment/README.md").read_text(encoding="utf-8")
        self.assertIn("138 cosechas observadas", readme)
        self.assertIn("scripts/check_inference_runtime.py", readme)


if __name__ == "__main__":
    unittest.main()
