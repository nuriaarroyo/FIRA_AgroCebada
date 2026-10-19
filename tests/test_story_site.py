"""Site is now a documented single-model explainer, never a leaderboard."""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class StorySiteTest(unittest.TestCase):
    def test_model_story_is_sourced(self):
        run = subprocess.run([sys.executable, str(ROOT / "scripts/check_model_story.py")],
                             capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + "\n" + run.stderr)

    def test_original_results_remain_unchanged_and_sourced(self):
        subprocess.run([sys.executable, str(ROOT / "scripts/sync_story_data.py"), "--check"],
                       check=True, capture_output=True, text=True)
        results = json.loads((SITE / "data/results.json").read_text(encoding="utf-8"))
        row = next(x for x in results["protocols"][0]["results"]
                   if x["id"] == "Reference26")
        self.assertAlmostEqual(row["rmse"], 0.4624789693727327)
        self.assertAlmostEqual(row["r2"], 0.6971349735771638)

    def test_teaching_values_are_not_parcel_predictions(self):
        html = (SITE / "index.html").read_text(encoding="utf-8")
        js = (SITE / "model.js").read_text(encoding="utf-8")
        self.assertIn("simulación educativa", html)
        self.assertIn("inventado", html)
        self.assertIn("uniform: [30,30,30,30,30,30,30]", js)
        self.assertIn("concentrated: [10,10,10,20,140,10,10]", js)
        self.assertIn("aria-pressed", js)
        self.assertIn("LOOCV", html)
        self.assertIn("Parcela de clima", (SITE / "predictor.js").read_text(encoding="utf-8"))
        self.assertIn("PREDICCIÓN REAL · EN TU NAVEGADOR", html)
        self.assertIn("id=\"predict-real\"", html)
        self.assertIn("prefers-reduced-motion", (SITE / "model.css").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
