#!/usr/bin/env python3
"""Rebuild the public storytelling site's aggregate model scores from versioned evidence.

Uses only the two published metrics CSVs and the L40 table in README.md.
No private OOF rows, IDs, hidden y, raw rasters or final target forecasts are read.
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site/data/results.json"
FRESH = ROOT / "results/comparison_97_41/v1/metrics.csv"
CURRENT = ROOT / "results/current_champions/v1/metrics.csv"
README = ROOT / "README.md"
MODELS = ("Reference26", "Compact14", "B1", "L40", "CT3")
PROTOCOLS = (
    ("fresh_97_41", "16 particiones de 97 parcelas de entrenamiento y 41 de evaluación. Promedio de RMSE por partición; reutiliza las mismas 138 etiquetas."),
    ("random", "50 folds aleatorios (10 repeticiones). Cada repetición reúne predicciones fuera de muestra sobre las 138 etiquetas; se promedian métricas por repetición."),
    ("climate_profile", "5 folds por perfil climático. Se excluyen perfiles para examinar diferencias en condiciones agroclimáticas; las métricas corresponden al protocolo original."),
    ("municipality", "5 folds agrupados por municipio. Excluir municipios completos evalúa un tipo distinto de transferencia territorial."),
    ("spatial", "5 folds agrupados por bloques espaciales. Es un ensayo más estricto de transferencia a ubicaciones no representadas en el entrenamiento."),
)


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def _l40() -> dict[str, dict[str, float]]:
    """Read the explicitly printed L40 RMSE/R² table; do not invent MAE."""
    rows = [s.strip() for s in README.read_text(encoding="utf-8").splitlines()]
    line = next((s for s in rows if s.startswith("| L40 / Local04D |")), None)
    if line is None:
        raise ValueError("README no longer contains the canonical L40 comparison table")
    cells = [v.strip() for v in line.strip("|").split("|")]
    if len(cells) != 5:
        raise ValueError("Unexpected L40 markdown table structure")
    result = {}
    for (protocol, _), cell in zip(PROTOCOLS[1:], cells[1:]):
        rmse, r2 = (float(p.strip().replace("−", "-")) for p in cell.split("/"))
        result[protocol] = {"id": "L40", "rmse": rmse, "r2": r2, "mae": None}
    return result


def produce() -> dict:
    fresh = _read(FRESH)
    current = _read(CURRENT)
    l40 = _l40()
    parsed = []
    for protocol, description in PROTOCOLS:
        source = fresh if protocol == "fresh_97_41" else current
        rows = [r for r in source if r["protocol"] == protocol and r["experiment"] in MODELS]
        by_name = {r["experiment"]: r for r in rows}
        if protocol != "fresh_97_41":
            by_name["L40"] = l40[protocol]
        if set(by_name) != set(MODELS):
            raise ValueError(f"Missing/duplicate models in {protocol}: {set(MODELS) ^ set(by_name)}")
        values = []
        for model in MODELS:
            row = by_name[model]
            values.append({
                "id": model,
                "rmse": float(row["rmse"]),
                "r2": float(row["r2"]),
                "mae": None if row["mae"] is None else float(row["mae"]),
            })
        parsed.append({"id": protocol, "description": description, "results": values})
    return {
        "schema_version": 1,
        "units": "t/ha for RMSE and MAE; R² unitless",
        "aggregation": "Mean per split/repeat; not pooled predictions across differing protocols",
        "methodological_limit": "Exploratory. The same 138 reported yields were repeatedly studied; 59 hidden yields unavailable.",
        "sources": [
            "results/comparison_97_41/v1/metrics.csv",
            "results/current_champions/v1/metrics.csv",
            "README.md: Comparación reciente compatible, L40 / Local04D row",
        ],
        "protocols": parsed,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = json.dumps(produce(), ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(content, encoding="utf-8", newline="\n")
        print("Wrote", OUT.relative_to(ROOT))
    elif not OUT.is_file() or OUT.read_text(encoding="utf-8") != content:
        raise SystemExit("Site metrics are stale: run python scripts/sync_story_data.py --write")
    else:
        print("Public site metrics match the versioned source data")


if __name__ == "__main__":
    main()