# Sitio independiente · AgroCebada, del clima al territorio

Este directorio contiene una **web estática autónoma** que narra cómo el proyecto pasó de C-T3 (cuatro entradas globales) a Reference26 y Compact14. Conserva la identidad editorial de GeoCebada —paleta, composición y tipografía—, pero **no lee código, archivos, métricas o servicios del repositorio GeoC durante su ejecución**.

## Vista local

Desde la raíz del fork:

    python scripts/529_check_story_site.py
    python -m http.server 8000 --directory website

Abrir http://localhost:8000/ . Es necesario un servidor local para que JavaScript pueda cargar CSV; no usar file://.

## Publicación GitHub Pages

El workflow .github/workflows/publish_story_pages.yml valida los archivos en PR y main. Después de aprobar y fusionar el cambio en **main**, publica únicamente website/ mediante GitHub Pages; no ejecuta modelos ni publica archivos privados.

Configurar una vez en **Settings → Pages → Build and deployment → Source: GitHub Actions** dentro de este fork. La dirección prevista **tras el despliegue exitoso** es https://heri-espino.github.io/todoseboso/ .

No se necesita npm, DNS, API, tracking, ni cargar recursos de terceros. Todos los vínculos de evidencia dirigen a documentos de este mismo fork.

## Trazabilidad de métricas

Tres copias estáticas en website/data/ corresponden a información **agregada pública**:

| Copia estática | Fuente versionada |
| --- | --- |
| current_champions_metrics.csv | results/current_champions/v1/metrics.csv |
| fresh_97_41_metrics.csv | results/comparison_97_41/v1/metrics.csv |
| l40_protocols.csv | Fila L40 / Local04D del README principal |

La prueba scripts/529_check_story_site.py valida paridad byte a byte de los dos primeros, coincidencia con la fila L40 y cifras de Reference26, integridad de fuentes y enlaces, y ausencia de identificadores individuales. Cuando cambien resultados canónicos, se deben revisar y sincronizar manualmente las copias; la validación evitará publicar números desincronizados.

Banco adicional: 16 particiones de 97/41, media de métricas por partición. Reference26 RMSE 0.4625 t/ha y R² 0.6971; Compact14 0.4661/0.6933; L40 0.4893/0.6621. El banco original de 65 folds incluye 50 aleatorios, 5 por perfil climático, 5 municipales y 5 espaciales: métricas calculadas sobre OOF completas por repetición, después promediadas.

**Limitaciones:** las 138 etiquetas se reutilizaron ampliamente en la investigación, hay dependencia espacial y optimismo posible por selección histórica. No es confirmación independiente ni evaluación de los rendimientos ocultos de las 59 parcelas. La inclusión de señales no demuestra causas agronómicas.

Los ejemplos de lluvia y los puntos del diagrama de vecinos son **sintéticos**: no son mediciones, posiciones ni predicciones reales. No se publican IDs ni rendimientos individuales.

## Fuentes de arquitectura

- documentation/models/Reference26/README.md: 4 entradas globales + 7 locales + 2 coordenadas + 10 geológicas + 3 de R3.
- documentation/models/Compact14/README.md: cinco locales, dos coordenadas, sin Planet ni compuerta geológica.
- documentation/models/CT3/README.md: tres resúmenes de lluvia y NDVI de mayo.
- documentation/current_champions_reproduction.md: selección, refits y reproducibilidad.
- documentation/ai_usage.md: registro de uso de herramientas de IA.

Este sitio es una presentación, no un sistema de inferencia de nuevas parcelas ni un sustituto del informe técnico o la entrega FIRA.
