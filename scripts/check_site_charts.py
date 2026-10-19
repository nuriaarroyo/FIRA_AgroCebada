#!/usr/bin/env python3
"""Check that every value in the interactive distribution is sourced upstream."""
from __future__ import annotations

import csv
import json
import math
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
CSV_PATH = "results/reference26_distribution/v1/descriptive_global_state.csv"
NUMERIC = (
    "n", "mean", "median", "p10", "q25", "q75",
    "p90", "minimum", "maximum",
)


class PageHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "script" and "src" in attrs:
            self.scripts.append(attrs["src"])


def main():
    snapshot = json.loads((SITE / "data/distribution.json").read_text(encoding="utf-8"))
    assert snapshot["schema_version"] == 1
    assert snapshot["source"] == CSV_PATH
    with (ROOT / CSV_PATH).open(encoding="utf-8", newline="") as handle:
        source = list(csv.DictReader(handle))
    assert len(source) == len(snapshot["rows"]) == 8
    expected = {(s["region"], s["cohort"]): s for s in source}
    actual = {(s["region"], s["cohort"]): s for s in snapshot["rows"]}
    assert len(expected) == len(actual) == 8
    assert expected.keys() == actual.keys()
    for key, row in actual.items():
        orig = expected[key]
        assert row.keys() == {"region", "cohort", *NUMERIC}
        for name in NUMERIC:
            assert math.isclose(
                float(row[name]), float(orig[name]), rel_tol=0, abs_tol=1e-12
            ), (key, name)
        assert row["minimum"] <= row["p10"] <= row["q25"]
        assert row["q25"] <= row["median"] <= row["q75"]
        assert row["q75"] <= row["p90"] <= row["maximum"]
        assert row["n"] > 0
    assert sum(actual[("all", "Observed138")]["n"] for _ in [1]) == 138
    assert actual[("all", "Predicted59")]["n"] == 59

    html = (SITE / "index.html").read_text(encoding="utf-8")
    parser = PageHTML()
    parser.feed(html)
    for name in ("performance-chart", "association-chart",
                 "hhi-forest", "interval-results", "rain-chart",
                 "distribution-quantiles", "r3-comparison", "expert-weights"):
        assert name in parser.ids
    assert parser.scripts == ["./charts.js", "./model.js", "./parcel_core.js", "./predictor.js", "./reference26_engine.js", "./browser_inference.js"]
    assert (SITE / "charts.css").is_file()
    assert "originales del estudio" in html or "curvas acumuladas originales" in html.lower()

    for path in ("charts.js", "model.js", "parcel_core.js", "predictor.js", "reference26_engine.js", "browser_inference.js"):
        text = (SITE / path).read_text(encoding="utf-8")
        assert "https://cdn." not in text
        assert "LOOCV" not in text
    assert "GeoCharts.distribution" in (SITE / "model.js").read_text(encoding="utf-8")
    assert "GeoCharts.forest" in (SITE / "model.js").read_text(encoding="utf-8")
    assert "GeoCharts.r3" in (SITE / "model.js").read_text(encoding="utf-8")
    assert "GeoCharts.coefficients" in (SITE / "model.js").read_text(encoding="utf-8")
    assert "GeoCharts.performance" in (SITE / "model.js").read_text(encoding="utf-8")
    print("PASS: all 8 distribution rows and 9 chart mounts match their published sources.")


if __name__ == "__main__":
    main()
