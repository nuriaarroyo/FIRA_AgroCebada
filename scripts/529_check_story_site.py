#!/usr/bin/env python3
"""Validate the independent public website without private data or dependencies.

Usage: python scripts/529_check_story_site.py
"""
from __future__ import annotations

import csv
import io
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "website"


class PageAudit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids: set[str] = set()
        self.anchors: list[str] = []
        self.assets: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            key = attrs["id"]
            if key in self.ids:
                raise ValueError(f"Duplicate HTML id: {key}")
            self.ids.add(key)
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.anchors.append(attrs["href"][1:])
        if tag in {"script", "link", "img"}:
            link = attrs.get("src", attrs.get("href", ""))
            if link.startswith(("./", "../")):
                self.assets.append(link)


def read_csv(path: Path) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))


def check_metrics() -> None:
    copies = [
        ("results/current_champions/v1/metrics.csv", "website/data/current_champions_metrics.csv"),
        ("results/comparison_97_41/v1/metrics.csv", "website/data/fresh_97_41_metrics.csv"),
    ]
    for source, snapshot in copies:
        if (ROOT / source).read_bytes() != (ROOT / snapshot).read_bytes():
            raise ValueError(f"Website snapshot differs from canonical aggregate: {snapshot}")
    main = read_csv(SITE / "data/current_champions_metrics.csv")
    fresh = read_csv(SITE / "data/fresh_97_41_metrics.csv")
    l40 = read_csv(SITE / "data/l40_protocols.csv")
    models = {"Reference26", "Compact14", "CT3", "B1"}
    protocols = {"random", "climate_profile", "municipality", "spatial", "fresh_97_41"}
    observed = {(row["experiment"], row["protocol"]) for row in main}
    if observed != {(model, protocol) for model in models for protocol in protocols}:
        raise ValueError("Missing or duplicated champion/protocol result")
    if len(fresh) != 10 or len({row["experiment"] for row in fresh}) != 10:
        raise ValueError("Fresh 97/41 comparison is incomplete")
    for model in models:
        a = next(row for row in main if row["experiment"] == model and row["protocol"] == "fresh_97_41")
        b = next(row for row in fresh if row["experiment"] == model)
        for metric in ("rmse", "r2", "mae"):
            if abs(float(a[metric]) - float(b[metric])) > 1e-12:
                raise ValueError(f"Conflicting fresh result for {model}: {metric}")
    if len(l40) != 4 or {x["protocol"] for x in l40} != protocols - {"fresh_97_41"}:
        raise ValueError("L40 grouped protocol snapshot incomplete")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    match = re.search(r"^\|\s*L40 / Local04D\s*\|(.+)$", readme, re.MULTILINE)
    if not match:
        raise ValueError("L40 compatible benchmark missing from project README")
    cells = [x.strip().replace("−", "-") for x in match.group(1).split("|") if x.strip()]
    if len(cells) != 4:
        raise ValueError("L40 benchmark requires four protocol cells")
    for protocol, cell in zip(("random", "climate_profile", "municipality", "spatial"), cells):
        expected_rmse, expected_r2 = [float(x) for x in cell.split("/")]
        row = next(x for x in l40 if x["protocol"] == protocol)
        if abs(float(row["rmse"]) - expected_rmse) > 1e-12 or abs(float(row["r2"]) - expected_r2) > 1e-12:
            raise ValueError(f"L40 {protocol} does not match documented benchmark")
    winner = next(x for x in fresh if x["experiment"] == "Reference26")
    assert round(float(winner["rmse"]), 4) == 0.4625
    assert round(float(winner["r2"]), 4) == 0.6971
    for path in [SITE / "data/current_champions_metrics.csv", SITE / "data/fresh_97_41_metrics.csv", SITE / "data/l40_protocols.csv"]:
        if "ID_POLIGONO" in path.read_text(encoding="utf-8"):
            raise ValueError(f"Forbidden parcel-level identifier in {path}")


def check_page() -> None:
    html = (SITE / "index.html").read_text(encoding="utf-8")
    audit = PageAudit()
    audit.feed(html)
    for target in audit.anchors:
        if target and target not in audit.ids:
            raise ValueError(f"Broken internal fragment: #{target}")
    for path in audit.assets:
        resolved = (SITE / path).resolve()
        if not resolved.is_relative_to(SITE.resolve()) or not resolved.is_file():
            raise ValueError(f"Missing or outside website asset: {path}")
    for name in ("resultados", "historia", "arquitectura", "vecinos", "clima", "limitaciones", "fuentes"):
        if name not in audit.ids:
            raise ValueError(f"Missing story section: {name}")
    for value in ("0.4625", "0.6971", "97/41", "no miden el error de las 59 parcelas"):
        if value not in html:
            raise ValueError(f"Missing required qualification: {value}")
    if "LOOCV" in html:
        raise ValueError("An unrequested validation topic remains in the public page")
    if "Clima, vecinos y geología" not in html or "Clima y vecinos, sin geología" not in html:
        raise ValueError("Descriptive model labels missing in alternate page")
    if re.search(r"(?:src|href)=['\"]https?://[^'\"]+\.(?:js|css)['\"]", html):
        raise ValueError("Third-party JS/CSS dependency is forbidden")


def main() -> None:
    check_metrics()
    check_page()
    print("Independent website PASS: exact public aggregate snapshots, "
          "L40/README parity, matching folds, internal links and assets, no private IDs.")


if __name__ == "__main__":
    main()
