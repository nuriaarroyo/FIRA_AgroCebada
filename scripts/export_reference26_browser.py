#!/usr/bin/env python3
"""Export exact fitted Reference26 math to a browser-only JSON runtime.

Requires original 3 hash-verified assets and original Python implementation.
Verifies Python heldout predictions before writing and never trains a model.
Includes 138 fitted local targets, so publishing JSON reveals training yields.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import types
from pathlib import Path
from warnings import catch_warnings, simplefilter

import joblib
import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Only inference classes are imported. Skip the legacy family_1 training
# orchestration: it imports geopandas/raster processing during module import,
# despite those packages not being used by the frozen Reference26 predict()
# path. The shim provides exactly the module-level constants read by the
# conditional-response CLASS definition; model parameters come from joblib.
legacy = types.ModuleType("src.family_1.lm_multiblock")
legacy.ROOT = ROOT
legacy.ID = "ID_POLIGONO"
legacy.TARGET = "RENDIMIENTO_T_HA"
legacy.RAIN = ["compact_precip_total", "compact_early_fraction",
               "compact_concentration_hhi"]
legacy.k = types.SimpleNamespace(ALPHA=[0.001, 0.01, 0.1, 1.0],
                                 L1=[0.1, 0.5, 0.9])
sys.modules.setdefault("src.family_1.lm_multiblock", legacy)

from src.current_champions import predict_saved
from src.geoc_local04d_snapshot import haversine_distance_matrix

ASSETS = Path(os.environ.get("GEOCEBADA_ARTIFACT_DIR", ROOT / "deployment/model_artifacts"))
DESTINATION = ROOT / "site/data/reference26_runtime.json"
EXPECTED = {
    "final_train138.joblib": "54afbcf81d60623a634b64afb498152b11a0f66ea4c3e21cab2d4939250ac147",
    "features197.parquet": "22a18f9907457dacd91377131ae56e1440ab6f47ca2307f38a498d819d0b2733",
    "distance197.npy": "8f6e62c5967524f6ae3754086a9e2f78615653053c4012865ba2f6da2c8e7113"
}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify():
    for name, expected in EXPECTED.items():
        path = ASSETS / name
        if not path.is_file():
            raise FileNotFoundError("Falta " + str(path))
        if digest(path) != expected:
            raise ValueError("SHA-256 no coincide para " + name)


def arr(v):
    a = np.asarray(v)
    if a.dtype.kind == "b":
        return a.astype(bool).tolist()
    if a.ndim == 0:
        return float(a)
    return np.where(np.isfinite(a.astype(float)), a.astype(float), np.nan).tolist()


def checked_json(obj):
    """Convert numpy and NaNs to JSON null, never NaN or Infinity tokens."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {str(k): checked_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, np.ndarray)):
        return [checked_json(v) for v in obj]
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        return float(obj) if math.isfinite(float(obj)) else None
    if isinstance(obj, str):
        return obj
    raise TypeError(f"Not JSON-exportable: {type(obj)}")


def transform(encoder):
    if encoder.spline is not False or encoder.interaction:
        raise ValueError("Browser runtime supports frozen raw four-feature CT3 only.")
    return dict(cols=list(encoder.cols), median=arr(encoder.median_),
                mean=arr(encoder.mean_), scale=arr(encoder.scale_),
                support=arr(encoder.support_))


def linear(pipe):
    f = pipe.steps[0][1]
    m = pipe.steps[1][1]
    return dict(transform=transform(f),coef=arr(m.coef_),intercept=float(m.intercept_))


def median_frame(frame, columns):
    x = frame[list(columns)].to_numpy(dtype=float)
    return checked_json(x)


def scale_from_frozen(latlon, distance):
    """Frozen distance is required to be one constant multiple of great-circle km."""
    km = haversine_distance_matrix(latlon[:, 0], latlon[:, 1])
    upper = np.triu_indices(138, 1)
    geo, old = km[upper], np.asarray(distance[:138, :138])[upper]
    mask = np.isfinite(geo) & np.isfinite(old) & (geo > 1e-8) & (old > 1e-8)
    if mask.sum() < 500:
        return None
    scale = float(np.median(geo[mask] / old[mask]))
    if not 0 < scale < 1e6:
        return None
    deviation = np.abs(geo[mask] / scale - old[mask])
    if float(np.max(deviation)) > 2e-6:
        return None
    return scale


def serialize():
    verify()
    frame = pd.read_parquet(ASSETS / "features197.parquet")
    distance = np.load(ASSETS / "distance197.npy", allow_pickle=False)
    if len(frame) != 197 or distance.shape != (197,197):
        raise ValueError("Se requieren 197 filas y una matriz 197x197.")
    if not pd.to_numeric(frame.iloc[:138].RENDIMIENTO_T_HA).notna().all():
        raise ValueError("138 rendimientos no disponibles.")
    if not frame.iloc[138:].RENDIMIENTO_T_HA.isna().all():
        raise ValueError("59 etiquetas reservadas deben estar vacías.")
    with catch_warnings():
        simplefilter("ignore")
        pack = joblib.load(ASSETS / "final_train138.joblib")
    if list(np.asarray(pack["train_positions"],int)) != list(range(138)):
        raise ValueError("Posiciones de entrenamiento final inesperadas.")
    outer=pack["outer_experts"]
    raw=outer["raw"]
    if raw["shares"] is None or raw["expert"] is None:
        raise ValueError("No hay gate geológico y experto Reference26.")
    climate=linear(raw["ct3"])
    local=raw["expert"]["local"]
    if local["representation"].pca_ is not None or local["representation"].mode != "raw":
        raise ValueError("La representación local final no es raw.")
    repre=local["representation"]
    if int(np.sum(repre.support_)) != 7:
        raise ValueError("Se esperaban siete variables locales activas.")
    internal=raw["expert"]["corrector"]
    if not internal or internal.steps[0][1].physical is not None:
        raise ValueError("Corrección interna no soportada por el motor.")
    internal_model=linear(internal.steps[1][1]) if False else None
    internal_model=dict(
        transform=transform(internal.steps[0][1].core),
        coef=arr(internal.steps[1][1].coef_),
        intercept=float(internal.steps[1][1].intercept_),
        amplitude=float(raw["expert"]["amplitude"])
    )
    gate=raw["shares"]["gate"]
    physical=raw["shares"]["space"].models
    if len(physical) != 1 or not physical[0][1].composition or physical[0][1].pca_ is not None:
        raise ValueError("Geología no es una representación de composición directa.")
    phy=physical[0][1]
    assert len(phy.columns) == 10 and gate.kind == "clusters" and gate.model_.n_clusters == 4
    geology=dict(
        columns=list(phy.columns),
        medians=[float(phy.encoder_.fields_[col]["median"]) for col in phy.columns],
        mean=arr(phy.mean_), scale=arr(phy.scale_), norm=float(phy.norm_),
        centers=arr(gate.model_.cluster_centers_),
        weights=arr(gate.weights_)
    )
    residual=outer["correctors"][1]
    if residual.reduction != "R3" or residual.space.model is not None:
        raise ValueError("R3 no corresponde al final confirmado.")
    ns=residual.space
    fc=residual.model
    if fc.model is None or float(outer["strengths"][1]) != 1.0:
        raise ValueError("No hay corrector final completo.")
    correction=dict(
        cols=list(ns.columns), med=arr(ns.med), mean=arr(ns.mean),
        scale=arr(ns.scale), support=arr(ns.support),
        inner_median=arr(fc.median), inner_mean=arr(fc.mean),
        inner_scale=arr(fc.scale), inner_support=arr(fc.support),
        coef=arr(fc.model.coef_), intercept=float(fc.model.intercept_),
        offset=float(fc.offset), amplitude=.5, clip=.5,
        strength=float(outer["strengths"][1])
    )
    columns=json.loads((ROOT / "configs/current_champions_inputs.json").read_text())["features"]
    known=frame.iloc[:138]
    local_z=repre.transform(known)
    coordinates=known[["base_centroid_lat","base_centroid_lon"]].to_numpy(float)
    scalar=scale_from_frozen(coordinates,distance)
    if scalar is None:
        print("WARNING: no se certificó la escala de distancias de parcelas nuevas.")

    with threadpool_limits(limits=1):
        originals=predict_saved(pack,np.arange(138,197),frame,distance)["Reference26"]
    if not np.all(np.isfinite(originals)):
        raise ValueError("59 predicciones congeladas contienen no-finitos.")

    samples=frame.iloc[138:]
    fixture=[dict(
        id=str(row["ID_POLIGONO"]),
        x={col:(float(row[col]) if pd.notna(row[col]) else None) for col in columns},
        distances=arr(distance[138+i,:138]),
        expected=float(originals[i])
    ) for i,(_,row) in enumerate(samples.iterrows())]
    runtime=dict(
        schema_version=1,
        model="Reference26",
        runtime="Browser-only implementation of original 138-label fit; no server",
        hashes=EXPECTED,
        feature_names=columns,
        climate=climate,
        local=dict(
            cols=list(repre.columns),med=arr(repre.medians_),mean=arr(repre.mean_),
            scale=arr(repre.scale_),support=arr(repre.support_),
            train_positions=arr(local["train_positions"]),
            standardized=arr(local_z),
            targets=arr(local["targets"]),neighbors=24,ridge_alpha=30
        ),
        internal=internal_model,
        geology=geology,
        correction=correction,
        geography=dict(
            train_coords=arr(coordinates), km_per_unit=scalar,
            new_parcels_supported=scalar is not None,
            earth_radius_km=6371.0088
        ),
        existing_59=fixture,
        aggregate_parity=dict(
            mean=float(np.mean(originals)),median=float(np.median(originals)),
            p10=float(np.quantile(originals,.1)),p90=float(np.quantile(originals,.9)),
            q25=float(np.quantile(originals,.25)),q75=float(np.quantile(originals,.75))
        )
    )
    return checked_json(runtime)


def main():
    runtime=serialize()
    DESTINATION.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(runtime,ensure_ascii=False,allow_nan=False,separators=(",",":"))+"\n"
    # Export is explicit and never added to Git without a human reviewing data policy.
    DESTINATION.write_text(text,encoding="utf-8")
    print("Exported",DESTINATION, "bytes", len(text.encode()), "new_parcels_supported",
          runtime["geography"]["new_parcels_supported"])
    print("Reference26 59 mean",runtime["aggregate_parity"]["mean"])


if __name__=="__main__":
    main()
