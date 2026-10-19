"""Run only after installing API requirements and mounting the three verified files.

This uses the exact 197-row feature frame and geographic geometry and checks
a held-out parcel through the NEW-PARCEL path against the saved 59-point path.
"""
from __future__ import annotations

import numpy as np
from deployment.inference_api import load_runtime, _existing, _custom, FeatureInput


def main():
    rt = load_runtime()  # SHA-256, shapes, and six aggregate statistics checked.
    print("Model: Reference26, 138 training yields, 59 stored held-out estimates.")
    print("Final 59 aggregate replay:", rt["parity"])
    if rt["km_scale"] is None:
        raise AssertionError(
            "El modelo reproduce las 59 parcelas, pero la geometría normalizada "
            "no coincide con las coordenadas. Aún no habilitar predicciones nuevas."
        )
    features = rt["features"]
    frame = rt["frame"]
    for i in (138, 159, 196):
        pid = str(frame.iloc[i]["ID_POLIGONO"])
        values = {}
        for feature in features:
            value = frame.iloc[i][feature]
            values[feature] = None if not np.isfinite(float(value)) else float(value)
        original = _existing(rt, pid)
        recomputed, notes = _custom(rt, FeatureInput(features=values))
        if not np.isclose(original, recomputed, atol=2e-5, rtol=0):
            raise AssertionError(
                f"Local geographic distance parity failed for parcel position {i}: "
                f"saved={original:.9f}, new_query={recomputed:.9f}"
            )
        print("PASS", i, pid, f"{original:.6f}", f"new={recomputed:.6f}", notes)
    print("PASS: original 59 aggregate, 3 fresh-feature parity comparisons and geometry.")


if __name__ == "__main__":
    main()
