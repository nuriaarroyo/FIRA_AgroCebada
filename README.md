# AgroCebada FIRA 2026 · fira_nuria

**Sitio de divulgación del fork:** [Historia de Reference26](site/) · [fuentes y auditoría](site/README.md). El sitio presenta métricas agregadas; GitHub Pages requiere configuración en Settings → Pages. La investigación upstream contiene nuevos [contrastes de las cuatro señales C-T3](results/core4_relevance/v1/README.md) y [evidencia de los componentes Reference26](results/reference26_component_evidence/v1/README.md).


**El propósito del proyecto es desarrollar y validar un modelo que estime el rendimiento de cebada, en toneladas por hectárea, para las parcelas sin rendimiento conocido del Reto AgroCebada FIRA 2026.** La investigación de variables y algoritmos sirve para elegir y explicar esa solución; no es un objetivo independiente ni una búsqueda del menor error sin considerar su uso.

Trabajamos con **197 parcelas de Hidalgo, Puebla y Tlaxcala**, ciclo 2025: **138 con rendimiento conocido** para desarrollo y validación, y **59 por estimar**. Integramos señales climáticas, satelitales, históricas, topográficas y cartográficas. El rendimiento de las 59 no está disponible: el error reportado corresponde a validación de las 138, no al resultado real de la entrega.

La finalidad práctica es apoyar la estimación de productividad y aportar información para decisiones agropecuarias y financieras. Este estudio no valida un sistema automático de otorgamiento de crédito, una relación causal agronómica ni la transferencia a cualquier región o año.

**Etapa actual: champions Reference26 y Compact14**, con C-T3 como control y B1 como sensibilidad. L40 se conserva como benchmark fuerte del equipo; queda fuera del reentrenamiento propio, no de la comparación. [Resultados: validación y predicciones finales](results/README.md) · [Reproducción](documentation/current_champions_reproduction.md).

## Propósito y entregables según los lineamientos

Los [lineamientos del reto](docs/guidelines/Lineamientos%20y%20Gui%CC%81a%20de%20Registro%20de%20Proyectos_.pdf), páginas 3–4, piden explicar fuentes, preparación, variables, metodología, resultados, limitaciones y utilidad para el sector. También solicitan una demostración práctica, bibliografía, transparencia sobre IA generativa y una tabla final de identificador y rendimiento predicho por parcela. El README orienta la lectura; no reemplaza esos entregables ni acredita que el proyecto esté publicado.

Objetivos de trabajo:

1. Construir características comparables por parcela y auditar su soporte espacial y temporal.
2. Evaluar modelos con exclusión de etiquetas y selección interna de hiperparámetros.
3. Comparar precisión, errores grandes, complejidad y estabilidad territorial.
4. Seleccionar explícitamente la receta final, producir sus 59 estimaciones y explicar sus límites.

La [matriz de entregables y evidencia](documentation/project_scope_and_guidelines.md) distingue lo disponible de lo pendiente.

## Qué modelo es cuál y cuál es su estado

**La etapa actual conserva dos champions: Reference26 y Compact14**, por decisión explícita del responsable del proyecto después de las comparaciones. El de 26 prioriza precisión y equilibrio territorial; el de 14 prioriza simplicidad de fuentes con desempeño próximo. C-T3 es el control compacto y B1 una sensibilidad. Ambos champions ya tienen ajuste final con138 rendimientos y59 predicciones incorporadas a la comparación existente.

`A_CURRENT_CH_H_T` conserva el nombre de modelo histórico TOP20/TOP15 y su entrega previa: no es el champion actual26. El estado y las rutas están en el [registro de modelos](documentation/model_registry.md), la [etapa vigente](configs/current_stage.json) y la [ruta reproducible actual](documentation/current_champions_reproduction.md).

| Modelo | Qué hace | Estado y motivo de conservarlo |
|---|---|---|
| **Reference26 · champion actual** | C-T3 + experto local7, compuerta geológica y corrector R3 | Seleccionado por precisión y equilibrio de validación; OOF reproducibles y ajuste final138 con59 predicciones |
| **Compact14 · champion actual compacto** | C-T3 + experto local5, peso global y R3; sin Planet ni compuerta geológica | Seleccionado por simplificación y desempeño próximo; OOF reproducibles y ajuste final138 con59 predicciones |
| **C-T3 / CT3** | Elastic Net global con lluvia total, fracción temprana, concentración mensual y NDVI de mayo | Control compacto de 4 entradas; tiene ajuste final y59 predicciones en la entrega histórica |
| **B1** | Mezcla aprendida internamente entre C-T3 y26 | Sensibilidad: pequeña ventaja municipal, deterioro espacial; no recomendada para sustituir26 |
| **L40 / Local04D** | PCA20 de C4 (2082 variables) + Ridge local24 geográfico | Benchmark fuerte externo del equipo; no es champion actual de este repositorio |
| **modelo histórico TOP20/TOP15** `A_CURRENT_CH_H_T` | Base climática Elastic Net, corrección histórica XGBoost y corrección topográfica Ridge | Referencia histórica; tiene entrega59. No es el modelo26 |
| **EQUAL3** | Promedio fijo C-T3 + GPR F5-01 + CatBoost F7-00 | Ensamble histórico con entrega59; no es B1 ni mezcla con L40 |
| **F5/F6/F7 y otras variantes** | GPR, bagging, boosting, correcciones y ablaciones | Investigación y controles; ver el índice. La propuesta F8 no prueba una ejecución F8 |

Las14/26 son **entradas derivadas**, no números de coeficientes globales. L40/Local04D pertenece a GeoC y se conserva en las tablas como benchmark externo fuerte del equipo. No se reentrena dentro del paquete propio. Cada modelo tiene una [ficha completa](documentation/models/README.md), con variables, función de sus bloques, origen, ventajas y límites. Los [documentos históricos](documentation/model_status_history.md) se distinguen de la selección vigente.

## Comparación reciente compatible

RMSE en t/ha / R². Mismos65 folds externos y138 rendimientos; métricas sobre OOF completas por repetición y después promedio. Esta tabla compara los champions actuales, el control, la sensibilidad y L40 sobre evaluación compatible; no es el error desconocido de las 59.

| Modelo | Aleatoria | Perfil climático | Municipal | Espacial |
|---|---|---|---|---|
| L40 / Local04D | .4930 / .6619 | .5031 / .6481 | .7602 / .1964 | .9794 / −.3337 |
| C-T3 | .5116 / .6361 | .5206 / .6232 | .5813 / .5302 | .6788 / .3594 |
| Reference26 | .4748 / .6865 | .4774 / .6831 | .5752 / .5400 | .6333 / .4423 |
| Compact14 | .4773 / .6832 | .4793 / .6805 | .5755 / .5395 | .6431 / .4250 |
| B1 | .4755 / .6856 | .4839 / .6744 | .5681 / .5513 | .6813 / .3546 |

La diferencia26–14 es pequeña y no demuestra equivalencia estadística. Ambos se conservan como champions con prioridades distintas; no se afirma un mínimo universal de todos los experimentos históricos. Los [resultados actuales versionados](results/current_champions/v1/README.md) incluyen C-T3,26,14 y B1, sin L40, con RMSE/R²/MAE, sesgo y diagnósticos agregados. Las OOF por parcela permanecen locales.

La evaluación es exploratoria después de amplia reutilización de las mismas etiquetas. El banco adicional97/41 se conserva separado: cambia las particiones, no aporta rendimientos independientes. Declarar champions expresa una decisión del proyecto y no una superioridad estadística universal.

<!-- comparison97:start -->
### Banco adicional97/41 — comparación separada

**16 particiones con97 parcelas de entrenamiento y41 de evaluación**, sobre las mismas138 conocidas. Media de métricas por partición; no es una muestra independiente ni el error real de las59.

| Modelo | RMSE t/ha ↓ | R² ↑ | MAE t/ha ↓ |
|---|---|---|---|
| CT3 | 0.4918 | 0.6571 | 0.3642 |
| L40 | 0.4893 | 0.6621 | 0.3552 |
| Reference26 | 0.4625 | 0.6971 | 0.3387 |
| Compact14 | 0.4661 | 0.6933 | 0.3398 |
| B1 | 0.4622 | 0.6975 | 0.3373 |

[Resultados de los10 modelos disponibles y metodología](results/comparison_97_41/v1/README.md). No se mezclan con la tabla de los65 folds originales ni con los checkpoints propios de GeoC.
<!-- comparison97:end -->

**Relevancia del núcleo C-T3:** [contrastes de asociación y ablaciones reajustadas](results/core4_relevance/v1/README.md). Evidencia exploratoria, con resultados favorables para algunas señales y límites explícitos para HHI; no certifica significancia de las26 entradas.

**Componentes de26:** [evidencia recuperada por función y variable](results/reference26_component_evidence/v1/README.md), con ablaciones existentes, interacciones, dependencias de calibración y límites.

## Cómo leer y reproducir

Empieza por el [mapa de documentación](documentation/README.md), el [índice de experimentos](documentation/experiment_index.md) y las [convenciones de evaluación](documentation/model_comparison_convention.md).

Clonar el repositorio **no descarga los datos, los modelos ni las predicciones**. Antes de ejecutar hacen falta los insumos locales y los artefactos previos que indique cada receta. Consulta [entorno y dependencias](environments/README.md) y [reproducibilidad y versionado](documentation/reproducibility.md).

```powershell
# Desde la raíz, con Python y los insumos locales disponibles:
python scripts/520_validate_repository_documentation.py

# Reconstruye las 81 particiones guardadas con el bundle local actual, sin L40:
python scripts/521_current_champions.py replay

# Reentrena las recetas congeladas. Costoso; requiere el mismo bundle local:
python scripts/521_current_champions.py refit --folds all --output outputs/research/current_champions/v1/refit_full
```

La [reproducción actual](documentation/current_champions_reproduction.md) distingue bundle de entrada, reconstrucción con modelos guardados y reentrenamiento desde las 26 entradas sin cachés históricos. No requiere acceso al otro repositorio una vez preparado el bundle. La [batería anterior de mezclas](documentation/four_expert_combinations_reproduction.md) se conserva como historial, no como punto de entrada actual. No ejecutar todos los scripts por numeración.

## Estructura y política de publicación

| Ruta | Contenido | Git |
|---|---|---|
| `src/` | Implementación de variables, modelos y validación | Sí |
| `scripts/` | Preparación, ejecución, auditoría y entrega por etapa | Sí |
| `tests/` | Pruebas de implementaciones e integridad | Sí |
| `configs/` | Registro, especificaciones exportadas, particiones posicionales y procedencia | Sí; sin rendimientos ni matrices |
| `environments/` | Versiones observadas y límites de instalación | Sí |
| `results/` | Métricas y auditorías agregadas de los modelos actuales, sin registros por parcela | Sí |
| `documentation/` | Documentación propia, índices, resultados interpretados e inventario de IA | Sí |
| `docs/guidelines/` | Lineamientos y diccionarios proporcionados | Sí |
| `docs/resources/` | Referencias externas descargadas | No |
| `data/` | Datos originales, externos y procesados | No |
| `outputs/` | Modelos, OOF, predicciones, figuras y checkpoints | No |

Los enlaces a `outputs/` funcionan con la copia local de artefactos; no estarán disponibles en un clon que sólo tenga Git. La [política de datos](documentation/git_data_policy.md) explica esta separación. Se conserva la numeración histórica y no se mueven los experimentos para evitar romper sus rutas.

## Uso de inteligencia artificial generativa

Se utilizó asistencia de IA en diseño y revisión de experimentos, programación, interpretación de resultados y documentación. El [inventario de IA generativa](documentation/ai_usage.md) contiene prompts recuperables, finalidad, herramienta, fuentes y límites de trazabilidad. Distingue solicitudes de ejecuciones y no atribuye a una IA mediciones, datos o validaciones que deban sustentarse con artefactos. Este inventario complementa la bibliografía; no la sustituye.

**Predicciones finales disponibles:** los dos champions se ajustaron con138 rendimientos y se incorporaron a la comparación existente de59. [Comparación entre predicciones](results/current_champions_final/v1/README.md); no se conoce aún su error real.
