#!/usr/bin/env python3
"""Audit the public interpretation snapshot against upstream aggregate CSVs.

No private rows, hidden yields, saved models, licensed images or fitted pipelines.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
SOURCES = (
    "results/core4_relevance/v1/metrics.csv",
    "results/reference26_component_evidence/v1/architecture_metrics.csv",
    "results/reference26_component_evidence/v1/component_weights.csv",
)
EXPECTED_PROT = ("random", "climate_profile", "municipality", "spatial")
MODELS = (
    "FULL4", "DROP_compact_precip_total", "DROP_compact_early_fraction",
    "DROP_compact_concentration_hhi", "DROP_S2_ndvi_month_05",
)


def read(path: str) -> list[dict[str, str]]:
    with (ROOT / path).open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def single(rows: list[dict[str, str]], *, experiment: str, protocol: str) -> dict[str, str]:
    found = [r for r in rows if r["experiment"] == experiment and r["protocol"] == protocol]
    if len(found) != 1:
        raise AssertionError("Missing or duplicate source: " + experiment + " / " + protocol)
    return found[0]


def main() -> None:
    out = SITE / "data/evidence.json"
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["schema_version"] == 1
    assert tuple(data["source_files"]) == SOURCES
    assert len(data["protocols"]) == 4
    ablations, architecture, weights = (read(p) for p in SOURCES)
    assert tuple(p["id"] for p in data["protocols"]) == EXPECTED_PROT
    for protocol in data["protocols"]:
        name = protocol["id"]
        assert tuple(x["id"] for x in protocol["core4_ablations"]) == MODELS
        for entry in protocol["core4_ablations"]:
            source = single(ablations, experiment=entry["id"], protocol=name)
            assert math.isclose(entry["rmse"], float(source["rmse"]), abs_tol=1e-12)
        r3 = protocol["reference26_r3"]
        without = single(architecture, experiment="FULL7_ON_RAW_BASE", protocol=name)
        with_r3 = single(architecture, experiment="FULL7_ON_RAW_MASK", protocol=name)
        assert math.isclose(r3["without_r3"], float(without["rmse"]), abs_tol=1e-12)
        assert math.isclose(r3["with_r3"], float(with_r3["rmse"]), abs_tol=1e-12)
        weight = single(weights, experiment="FULL7_ON_RAW_MASK", protocol=name)
        assert math.isclose(protocol["expert_weight"], float(weight["expert_weight"]), abs_tol=1e-12)
        assert 0 <= protocol["expert_weight"] <= 1

    html = (SITE / "index.html").read_text(encoding="utf-8")
    js = (SITE / "model.js").read_text(encoding="utf-8")
    assert "id=\"pruebas\"" in html and "id=\"arquitectura\"" in html
    for item in ("r3-comparison", "expert-weights", "association-chart"):
        assert "id=\"" + item + "\"" in html
    assert "\"evidence.json\"" in js
    assert "corrección final" in html.lower()
    assert "ID_POLIGONO" not in out.read_text(encoding="utf-8")

    # Distribution evidence is public, aggregated and historically frozen.
    descriptive = read("results/reference26_distribution/v1/descriptive_global_state.csv")
    observed = next(x for x in descriptive if x["scope"] == "global"
                    and x["cohort"] == "Observed138")
    predicted = next(x for x in descriptive if x["scope"] == "global"
                     and x["cohort"] == "Predicted59")
    assert int(observed["n"]) == 138 and int(predicted["n"]) == 59
    for row in (observed, predicted):
        assert f"{float(row['mean']):.4f}" in html
        assert float(row["std"]) > 0
    original_figure = ROOT / "results/reference26_distribution/v1/distribution_ECDF.png"
    copied_figure = SITE / "media/distribution_ECDF.png"
    assert original_figure.is_file() and copied_figure.is_file()
    assert original_figure.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert (hashlib.sha256(original_figure.read_bytes()).digest()
            == hashlib.sha256(copied_figure.read_bytes()).digest())
    assert "./media/distribution_ECDF.png" in html
    assert "59 cosechas reales todavía se desconocen" in html.lower()

    print("Public interpretation snapshot PASS: matched three upstream CSVs, four protocols.")


if __name__ == "__main__":
    main()
