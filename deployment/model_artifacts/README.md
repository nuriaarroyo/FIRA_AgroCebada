# Artefactos binarios de Reference26

Los tres archivos originales **aún no forman parte de este commit**.
La persona responsable del repositorio puede decidir publicarlos explícitamente aquí,
o montarlos en un servicio privado definiendo `GEOCEBADA_ARTIFACT_DIR`.

Archivos esperados en esta carpeta:

- `final_train138.joblib` — modelo ajustado original (Reference26 y Compact14).
- `features197.parquet` — 197 filas; **incluye los 138 rendimientos observados**.
- `distance197.npy` — distancias normalizadas de 197 × 197 parcelas.

Nunca cargar un `.joblib` de procedencia desconocida: deserializarlo puede ejecutar código.
La API verifica los hashes de los tres archivos **antes** de deserializar.

La publicación en un repositorio de GitHub **hace visibles las características, los IDs y
los 138 rendimientos** de entrenamiento. La aprobación de compartir los archivos
no elimina las condiciones de derechos sobre los datos y la competencia.

La API comprueba que la media, mediana, mínimos, máximos y cuartiles de las 59
predicciones reconstruidas coincidan con el reporte público congelado. No se
autoriza una predicción arbitraria nueva si no se puede reproducir el sistema de
distancias a partir de las coordenadas sin cambiar la escala original.
