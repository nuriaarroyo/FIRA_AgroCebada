"""Run the ORIGINAL fitted Reference26 recipe: no approximation or refitting.

The three assets are intentionally not present in the source-only PR.
The repository owner explicitly chooses whether to commit them to a public
repo, or to mount them privately in the service deployment.
"""
from __future__ import annotations

import hashlib
import os
from functools import lru_cache
from pathlib import Path
from threading import RLock
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from threadpoolctl import threadpool_limits

from src.current_champions import predict_saved
from src.geoc_local04d_snapshot import haversine_distance_matrix, normalized_distance_matrix

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("GEOCEBADA_ARTIFACT_DIR", str(ROOT / "deployment/model_artifacts")))
FILES = {
    "final_train138.joblib": "54afbcf81d60623a634b64afb498152b11a0f66ea4c3e21cab2d4939250ac147",
    "features197.parquet": "22a18f9907457dacd91377131ae56e1440ab6f47ca2307f38a498d819d0b2733",
    "distance197.npy": "8f6e62c5967524f6ae3754086a9e2f78615653053c4012865ba2f6da2c8e7113",
}
PUBLIC_MANIFEST = ROOT / "configs/current_champions_inputs.json"
PUBLIC_DISTRIBUTION = ROOT / "site/data/distribution.json"

app = FastAPI(title="GeoCebada · Inferencia Reference26", version="1.0.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://heri-espino.github.io", "http://localhost:8000", "http://127.0.0.1:8000",
                   "http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)
_lock = RLock()


class FeatureInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    features: dict[str, float | None] = Field(min_length=1, max_length=26)


class ExistingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parcel_id: str = Field(min_length=1, max_length=120)


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for part in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def verify_artifacts() -> None:
    for name, expected in FILES.items():
        path = ARTIFACTS / name
        if not path.is_file():
            raise RuntimeError(f"Falta el artefacto {name}. No se puede predecir.")
        if _digest(path) != expected:
            raise RuntimeError(f"El SHA-256 de {name} no coincide con el artefacto entrenado y auditado.")


def _geography_scale(frame: pd.DataFrame, distance: np.ndarray) -> float | None:
    """Guard against silently changing the frozen normalized distance geometry."""
    lat = frame.iloc[:138]["base_centroid_lat"].to_numpy(dtype=float)
    lon = frame.iloc[:138]["base_centroid_lon"].to_numpy(dtype=float)
    if not np.isfinite(lat).all() or not np.isfinite(lon).all():
        return None
    km = haversine_distance_matrix(lat, lon)
    normalized, scale = normalized_distance_matrix(km, reference_positions=np.arange(138))
    if not np.allclose(distance[:138, :138], normalized, rtol=1e-6, atol=1e-8):
        # Existing 59 work with their *saved* distance197 matrix. Do not invent
        # a normalization formula for arbitrary new parcels.
        return None
    return scale


@lru_cache(maxsize=1)
def load_runtime() -> dict[str, Any]:
    # joblib/pickle can execute code when deserialized. Only load files whose
    # full hashes match the project's frozen public provenance.
    verify_artifacts()
    import json
    manifest = json.loads(PUBLIC_MANIFEST.read_text(encoding="utf-8"))
    features = tuple(manifest["features"])
    frame = pd.read_parquet(ARTIFACTS / "features197.parquet")
    distance = np.load(ARTIFACTS / "distance197.npy", allow_pickle=False)
    if len(frame) != 197 or distance.shape != (197, 197) or len(features) != 26:
        raise RuntimeError("Se esperaba un paquete de 197 parcelas y 26 variables.")
    if frame["ID_POLIGONO"].nunique() != 197 or frame.iloc[:138]["RENDIMIENTO_T_HA"].isna().any():
        raise RuntimeError("Los primeros 138 rendimientos deben estar presentes y los ID ser únicos.")
    if frame.iloc[138:]["RENDIMIENTO_T_HA"].notna().any():
        raise RuntimeError("Las 59 parcelas reservadas no deben contener rendimientos conocidos.")
    if any(feature not in frame.columns for feature in features):
        raise RuntimeError("Faltan columnas del manifiesto Reference26.")
    if not np.allclose(distance, distance.T, equal_nan=True, rtol=0, atol=1e-12):
        raise RuntimeError("La matriz geográfica no es simétrica.")
    pack = joblib.load(ARTIFACTS / "final_train138.joblib")
    if "outer_experts" not in pack or list(pack["train_positions"]) != list(range(138)):
        raise RuntimeError("El archivo no contiene el ajuste final Reference26 sobre 138 etiquetas.")
    if "raw" not in pack["outer_experts"] or "shares" not in pack["outer_experts"]["raw"]:
        raise RuntimeError("No se encontraron los regresores finales del modelo.")
    scale = _geography_scale(frame, distance)
    runtime = dict(frame=frame, distance=distance, pack=pack, features=features, km_scale=scale)
    # Independent public aggregate parity; 59 individual predictions are not
    # publicly available for comparison. No target labels are returned by API.
    expected = json.loads(PUBLIC_DISTRIBUTION.read_text(encoding="utf-8"))
    row = next(r for r in expected["rows"] if r["region"] == "all" and r["cohort"] == "Predicted59")
    with threadpool_limits(limits=1):
        values = predict_saved(pack, np.arange(138, 197), frame, distance)["Reference26"]
    if not np.isfinite(values).all() or len(values) != 59:
        raise RuntimeError("La reproducción del modelo final no devolvió 59 predicciones válidas.")
    checks = {"mean": float(np.mean(values)), "median": float(np.median(values)),
              "minimum": float(np.min(values)), "maximum": float(np.max(values)),
              "q25": float(np.quantile(values, .25)), "q75": float(np.quantile(values, .75))}
    for key, value in checks.items():
        if not np.isclose(value, float(row[key]), rtol=0, atol=5e-7):
            raise RuntimeError(f"Fallo de paridad de predicciones finales en {key}: {value} frente a {row[key]}")
    runtime["parity"] = checks
    return runtime


def _existing(rt: dict[str, Any], pid: str) -> float:
    frame = rt["frame"]
    matches = np.flatnonzero(frame["ID_POLIGONO"].astype(str).to_numpy() == pid)
    if len(matches) != 1 or matches[0] < 138:
        raise HTTPException(404, detail="Identificador no encontrado entre las 59 parcelas por estimar.")
    with _lock, threadpool_limits(limits=1):
        result = predict_saved(rt["pack"], matches, frame, rt["distance"])["Reference26"]
    return float(result[0])


def _custom(rt: dict[str, Any], request: FeatureInput) -> tuple[float, list[str]]:
    supplied = request.features
    features = rt["features"]
    if set(supplied) - set(features):
        raise HTTPException(422, detail="Se recibieron variables que no pertenecen al inventario Reference26.")
    latitude = supplied.get("base_centroid_lat")
    longitude = supplied.get("base_centroid_lon")
    if latitude is None or longitude is None or not np.isfinite([latitude, longitude]).all():
        raise HTTPException(422, detail="Para una parcela nueva se requieren latitud y longitud.")
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(422, detail="Las coordenadas están fuera de los rangos terrestres.")
    if rt["km_scale"] is None:
        raise HTTPException(422, detail=(
            "La geometría guardada no coincide con la normalización geográfica derivable de "
            "las coordenadas. Se bloquean predicciones nuevas para evitar distancias erróneas; "
            "las 59 parcelas originales pueden predecirse con la matriz congelada."
        ))
    for col, value in supplied.items():
        if value is not None and (not np.isfinite(value) or
            (col.startswith("geology_physiography::geo250_share__") and not 0 <= value <= 1)):
            raise HTTPException(422, detail=f"Valor numérico o proporción inválida para {col}.")
    original = rt["frame"]
    placeholder = {col: np.nan for col in original.columns}
    placeholder.update({"ID_POLIGONO": "__new_parcel__", "Estado": "Sin estado",
                        "Municipio": "Sin municipio", "climate_profile": "Desconocido"})
    placeholder.update({k: (np.nan if v is None else float(v)) for k, v in supplied.items()})
    frame = pd.concat([original, pd.DataFrame([placeholder])], ignore_index=True)
    lat_all = frame["base_centroid_lat"].to_numpy(dtype=float)
    lon_all = frame["base_centroid_lon"].to_numpy(dtype=float)
    # Only the new query row is used. Existing 197x197 geometry is immutable.
    lat_new, lon_new = np.radians([latitude, longitude])
    lat_ref, lon_ref = np.radians(lat_all[:197]), np.radians(lon_all[:197])
    h = np.sin((lat_ref - lat_new) / 2) ** 2 + (
        np.cos(lat_new) * np.cos(lat_ref) * np.sin((lon_ref - lon_new) / 2) ** 2
    )
    h = np.clip(h, 0, 1)
    new_distances = 6371.0088 * 2 * np.arcsin(np.sqrt(h)) / rt["km_scale"]
    matrix = np.zeros((198, 198), dtype=float)
    matrix[:197, :197] = rt["distance"]
    matrix[197, :197] = new_distances
    matrix[:197, 197] = new_distances
    with _lock, threadpool_limits(limits=1):
        prediction = predict_saved(rt["pack"], np.array([197]), frame, matrix)["Reference26"][0]
    if not np.isfinite(prediction):
        raise HTTPException(422, detail="El modelo no pudo emitir una predicción numérica válida.")
    missing = [name for name in features if name not in supplied or supplied[name] is None]
    notes = [f"{len(missing)} de 26 indicadores faltantes: el preprocesamiento de los regresores aplica sus reglas entrenadas."] if missing else []
    if any(name in missing for name in ("I_history_ndvi_floor", "I_gap_excess_persistence", "I_slope_min")):
        notes.append("La corrección final R3 se desactivó por falta de soporte.")
    return float(prediction), notes


@app.get("/api/health")
def health():
    try:
        rt = load_runtime()
        return {"ready": True, "model": "Reference26", "training_labels": 138,
                "held_out": 59, "new_parcels_supported": rt["km_scale"] is not None,
                "reproduced_59_aggregate": True}
    except Exception as exc:
        raise HTTPException(503, detail="El motor de inferencia no está listo: " + str(exc)[:300]) from exc


@app.post("/api/predict-existing")
def predict_existing(request: ExistingInput):
    try:
        rt = load_runtime()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc)[:300]) from exc
    return {"model": "Reference26", "parcel_id": request.parcel_id,
            "predicted_t_ha": _existing(rt, request.parcel_id), "is_real_model": True}


@app.post("/api/predict")
def predict_features(request: FeatureInput):
    try:
        rt = load_runtime()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc)[:300]) from exc
    result, notes = _custom(rt, request)
    return {"model": "Reference26", "predicted_t_ha": result,
            "is_real_model": True, "notes": notes}
