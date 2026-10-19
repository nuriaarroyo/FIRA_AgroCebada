# Predicciones reales de Reference26

Esta implementación prepara **inferencia del ajuste entrenado real**, no un nuevo
modelo ni una fórmula ilustrativa. El frente sigue en GitHub Pages. La API Python
ejecuta el `joblib` original mediante
`src/current_champions.py:predict_saved`, junto con las 26 columnas
correctas, el entrenamiento local y la geometría congelada.

## Estado de la instalación

- API: `deployment/inference_api.py` (FastAPI).
- Despliegue sugerido: Render con `render.yaml`.
- Front-end: `site/inference_client.js` y `site/data/inference_config.json`.
- **Falta subir o montar los tres archivos binarios** y conectar el servicio
  externo. Mientras tanto la página mantiene desactivada la predicción real.
- No se publicará una cifra de rendimiento si la API no confirma el modelo
  Reference26 y su reproducción de las 59 estimaciones finales.

## 1. Copiar los tres artefactos

Desde PowerShell, en la raíz de `todoseboso`, después de actualizar `main`:

~~~powershell
git pull --ff-only
New-Item -ItemType Directory -Force deployment\model_artifacts | Out-Null
Copy-Item outputs\modeling\current_champions_final\v1\final_train138.joblib deployment\model_artifacts\
Copy-Item outputs\modeling\current_champions_final\v1\features197.parquet deployment\model_artifacts\
Copy-Item outputs\modeling\current_champions_final\v1\distance197.npy deployment\model_artifacts\
Get-FileHash deployment\model_artifacts\final_train138.joblib -Algorithm SHA256
Get-FileHash deployment\model_artifacts\features197.parquet -Algorithm SHA256
Get-FileHash deployment\model_artifacts\distance197.npy -Algorithm SHA256
~~~

**Advertencia de publicación:** `features197.parquet` contiene IDs y las
138 cosechas observadas. Si los tres binarios se suben al repositorio
**público**, cualquiera podrá descargarlos. La inclusión de estos archivos
se autorizó expresamente para este despliegue, pero revisa los permisos
del concurso antes de hacer el commit.

Si estás de acuerdo con publicar estos tres archivos concretos:

~~~powershell
git add deployment/model_artifacts/final_train138.joblib deployment/model_artifacts/features197.parquet deployment/model_artifacts/distance197.npy
git diff --cached --stat
git commit -m "Include verified Reference26 inference artifacts"
git push origin main
~~~

El `.gitignore` conserva la exclusión completa de `outputs/` y permite sólo
el modelo del directorio anterior. No uses `git add -f`. Los tres SHA-256
esperados están fijados en `deployment/inference_api.py`. Si alguno difiere,
la API bloquea su carga.

Una alternativa más privada es montar los tres archivos en un servicio
seguro y definir `GEOCEBADA_ARTIFACT_DIR`, sin versionarlos.

## 2. Probar el modelo de verdad antes de desplegar

Con un entorno nuevo de Python 3.11 y los archivos copiados:

~~~powershell
python -m pip install -r deployment/requirements-api.txt
python scripts/check_inference_runtime.py
~~~

El script debe verificar:

- hashes de los tres archivos, versiones y estructura 197 × 197;
- ajuste entrenado sobre 138 etiquetas y exclusión de las 59;
- reconstrucción de las 59 predicciones y paridad numérica con el
  resumen público (media, mediana, cuartiles y extremos);
- coincidencia de tres estimaciones generadas por un recorrido de **entrada
  nueva** frente al recorrido que usa la fila y distancia original;
- normalización de distancias por la mediana del vecino más cercano de
  los 138 predictores históricos; si no reproduce la geometría,
  la API bloquea parcelas nuevas.

No hay un nuevo entrenamiento. El `joblib` serializado procede de
scikit-learn 1.7.2, por lo que se fija esa versión para reducir
incompatibilidades de serialización.

Para iniciar localmente:

~~~powershell
python -m uvicorn deployment.inference_api:app --host 127.0.0.1 --port 8000
~~~

En otra ventana:

~~~powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
~~~

El resultado deberá incluir `ready: true`,
`reproduced_59_aggregate: true` y, si se verificó la geometría,
`new_parcels_supported: true`.

## 3. Desplegar el servicio Python

GitHub Pages sólo sirve HTML, CSS y JavaScript: **no ejecuta archivos
`.joblib` ni Python de servidor**.

Una solución sencilla es conectar el repositorio a
[Render](https://render.com/docs/deploy-fastapi). El archivo
`render.yaml` define el servicio y su comando de arranque. Selecciona
el plan que corresponda al uso previsto; el gratuito puede suspenderse
tras inactividad y no es un servicio de alta disponibilidad.

El despliegue externo requiere iniciar sesión y aprobar explícitamente
la conexión del repositorio. No es posible completar esa parte con un
commit de GitHub, y el URL concreto del servicio no se presupone.

Al obtener el URL HTTPS de tu API, ponlo en:

`site/data/inference_config.json`

~~~json
{
  "schema_version": 1,
  "api_base_url": "https://URL-REAL-DEL-SERVICIO",
  "status": "deployed",
  "model": "Reference26"
}
~~~

No uses ese ejemplo literalmente: reemplázalo por el URL que te entregue
Render. Guarda el cambio en `main` para que GitHub Pages conecte el
formulario automáticamente.

También puedes introducir temporalmente ese URL en «Dirección del
servicio de inferencia» dentro del laboratorio y pulsar
«Comprobar conexión», sin editar archivos.

## 4. Qué puede calcular

- **Una de las 59 parcelas originales:** `POST /api/predict-existing`
  con `{"parcel_id":"ID_EXACTO"}`. La API encuentra la fila y utiliza
  **exactamente la matriz de distancias congelada**.
- **Una parcela nueva:** `POST /api/predict`
  con `{"features":{"compact_precip_total":100,...}}`. Acepta las 26
  entradas del manifiesto, con valores `null` para datos faltantes,
  siempre que latitud y longitud estén presentes. El servidor construye
  las distancias a las 138 parcelas conocidas con la **misma
  normalización** y ejecuta `predict_saved`.
- Si falta alguno de los tres indicadores R3, la corrección final se
  desactiva como en el modelo original. Las imputaciones de otros
  indicadores son las aprendidas por sus pipelines originales.

Una estimación para un sitio o campaña diferentes sigue siendo
**extrapolación** respecto al conjunto de entrenamiento; el LOOCV no
garantiza un error individual de 0.468186 t/ha.

## 5. Seguridad y comprobaciones

No aceptes `joblib` de terceros: deserializarlo puede ejecutar código.
Sólo se permite el hash exacto ya auditado.

En la API no se devuelve el objetivo de entrenamiento, los datos de
vecinos individuales ni el objeto Python. Sí se devuelven estimaciones
para las 59 parcelas si el solicitante conoce su ID (es un endpoint
público mientras no se añada autenticación).

Para modificar los permisos o limitar las solicitudes públicas, instala
autenticación y cuotas **en el servidor**, nunca en JavaScript con una
clave visible.

La documentación de la arquitectura está en
`documentation/models/Reference26/README.md`.
