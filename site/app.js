/* Small, accessible teaching demos. No analytics, external JS or predictions. */
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const navigation = $("#nav-links");
const menu = $("#menu-toggle");
menu.addEventListener("click", () => {
  const expanded = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!expanded));
  navigation.classList.toggle("open", !expanded);
});
$$("#nav-links a").forEach((link) => link.addEventListener("click", () => {
  navigation.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
}));

let progressQueued = false;
window.addEventListener("scroll", () => {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(() => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    $("#read-progress").style.width = total > 0 ? `${Math.max(0, Math.min(100, 100 * scrollY / total))}%` : "0%";
    progressQueued = false;
  });
}, { passive: true });

// Two synthetic rainfall patterns have identical total rainfall (210 mm).
const RAIN = {
  uniform: [30, 30, 30, 30, 30, 30, 30],
  concentrated: [10, 10, 10, 20, 140, 10, 10]
};
function showRainfall(kind) {
  const values = RAIN[kind];
  if (!values) return;
  const sum = values.reduce((a, b) => a + b, 0);
  const early = values.slice(0, 3).reduce((a, b) => a + b, 0) / sum;
  const hhi = values.reduce((acc, v) => acc + (v / sum) ** 2, 0);
  window.GeoCharts.rainfall($("#rain-bars"), values);
  $("#rain-total").textContent = sum + " mm";
  $("#rain-early").textContent = (early * 100).toFixed(1) + " %";
  $("#rain-hhi").textContent = hhi.toFixed(3);
  $$("[data-rain]").forEach((button) => {
    const active = button.dataset.rain === kind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
$$("[data-rain]").forEach(button => button.addEventListener("click", () => showRainfall(button.dataset.rain)));
showRainfall("uniform");

// Deterministic, fictional points. Nearest points are chosen by 2D screen distance.
const svgNS = "http://www.w3.org/2000/svg";
const points = Array.from({length: 38}, (_, i) => {
  const theta = i * 2.399963229728653;
  const radius = 39 + 141 * Math.sqrt((i + 0.5) / 38);
  const x = 230 + radius * Math.cos(theta) * 1.07;
  const y = 207 + radius * Math.sin(theta) * 0.95;
  return { x, y, radius, i };
}).sort((a, b) => a.radius - b.radius);
function svgElement(tag, attrs) {
  const element = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  return element;
}
function showNeighbors(k) {
  const lines = $("#neighbor-connections"), dots = $("#neighbor-points");
  lines.replaceChildren(); dots.replaceChildren();
  points.forEach((point, i) => {
    const selected = i < k;
    if (selected) lines.appendChild(svgElement("line", {
      x1: 230, y1: 207, x2: point.x, y2: point.y,
      stroke: "#8dbb91", "stroke-opacity": "0.40", "stroke-width": "1.1"
    }));
    dots.appendChild(svgElement("circle", {
      cx: point.x, cy: point.y, r: selected ? 5.3 : 4.3,
      fill: selected ? "#42845e" : "#b9cab8",
      "fill-opacity": selected ? 1 : .85
    }));
  });
  $("#neighbor-k-value").textContent = String(k);
  $("#neighbor-svg").setAttribute("aria-label", `Diagrama ficticio: una consulta central y ${k} vecinos más cercanos seleccionados de 38 puntos`);
}
$("#neighbor-k").addEventListener("input", (event) => showNeighbors(Number(event.target.value)));
showNeighbors(24);

// Usar nombres legibles en los resultados; conservar el identificador del repositorio debajo.
const LABELS = {
  "Reference26": ["Clima, vecinos y geología", "Modelo principal · Reference26 · 26 indicadores"],
  "Compact14": ["Clima y vecinos, sin geología", "Modelo simplificado · Compact14 · 14 indicadores"],
  "B1": ["Clima combinado con el modelo principal", "Prueba de combinación · B1 · no seleccionado"],
  "L40": ["Vecinos con información satelital amplia", "Modelo anterior · Local04D · 2,082 variables derivadas"],
  "CT3": ["Lluvia y vegetación en mayo", "Punto de partida · C-T3 · 4 indicadores"]
};
const ORDER = ["Reference26", "Compact14", "B1", "L40", "CT3"];
let protocols = null;
function setProtocol(id) {
  if (!protocols) return;
  const info = protocols.find((item) => item.id === id);
  if (!info) return;
  $$("[data-protocol]").forEach((button) => {
    const active = button.dataset.protocol === id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#protocol-caption").textContent = info.description;
  const rows = ORDER.map((name) => {
    const metric = info.results.find((entry) => entry.id === name);
    if (!metric) throw Error("Faltan resultados de " + name);
    return metric;
  });
  window.GeoCharts.models($("#results-chart"), rows, LABELS);
}
$$("[data-protocol]").forEach((button) => button.addEventListener("click", () => setProtocol(button.dataset.protocol)));
(async function loadEvidence() {
  try {
    const response = await fetch("./data/results.json", {cache: "no-store"});
    if (!response.ok) throw Error("No se encontró el archivo de métricas");
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.protocols) || data.protocols.length !== 5) throw Error("Esquema inesperado");
    for (const protocol of data.protocols) {
      if (ORDER.some((name) => !protocol.results.some((row) => row.id === name && Number.isFinite(row.rmse) && row.rmse > 0))) throw Error("Resultados incompletos");
    }
    protocols = data.protocols;
    setProtocol("fresh_97_41");
  } catch (error) {
    console.error("Datos de evaluación no disponibles:", error);
    $("#protocol-caption").textContent = "No se pudieron cargar los resultados. Consulta las fuentes en GitHub.";
    $("#results-chart").textContent = "Las métricas están disponibles en los resultados versionados del repositorio.";
  }
})();

// Source-backed interpretability evidence. The four original protocols are
// distinct from the later 97/41 benchmark and from parcel-level explanations.
const EVIDENCE_NAMES = {
  random: "Parcelas al azar", climate_profile: "Perfiles climáticos", municipality: "Municipios", spatial: "Bloques geográficos"
};
const ABLATION_NOTES = {
  random: "Con parcelas elegidas al azar, el error aumenta al quitar la lluvia total, la lluvia temprana o la vegetación de mayo. La concentración de lluvia cambia poco el resultado.",
  climate_profile: "Al evaluar perfiles climáticos no utilizados para entrenar, el modelo con las cuatro señales obtiene menos error que cualquiera de las versiones reducidas.",
  municipality: "Al evaluar municipios completos que quedaron fuera del entrenamiento, quitar la proporción de lluvia temprana aumenta bastante el error. No demuestra causalidad.",
  spatial: "Al evaluar zonas geográficas que quedaron fuera del entrenamiento, quitar el indicador de concentración mensual de la lluvia reduce el error del primer modelo. Eso no basta para retirar HHI del modelo completo; hay que volver a ajustar y comprobar todas sus partes."
};
let componentProtocols = null;
function evidenceElement(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function renderAblations(id) {
  if (!componentProtocols) return;
  const p = componentProtocols.find((row) => row.id === id);
  if (!p) return;
  $$("[data-ablation-protocol]").forEach((button) => {
    const active = button.dataset.ablationProtocol === id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  window.GeoCharts.ablations($("#ablation-chart"), p.core4_ablations);
  $("#ablation-insight").textContent = ABLATION_NOTES[id];
}
function renderComponentEvidence() {
  const rows = componentProtocols.map((p) => ({
    id: p.id, label: EVIDENCE_NAMES[p.id],
    without: p.reference26_r3.without_r3, with: p.reference26_r3.with_r3,
    weight: p.expert_weight
  }));
  window.GeoCharts.r3($("#r3-comparison"), rows);
  window.GeoCharts.expertWeights($("#expert-weights"), rows);
}
$$("[data-ablation-protocol]").forEach((button) => button.addEventListener("click", () => {
  renderAblations(button.dataset.ablationProtocol);
}));
(async function loadComponentEvidence() {
  const chart = $("#ablation-chart");
  const r3 = $("#r3-comparison");
  const weights = $("#expert-weights");
  try {
    const response = await fetch("./data/evidence.json", { cache: "no-store" });
    if (!response.ok) throw Error("No se pudo cargar evidencia.json");
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.protocols) || data.protocols.length !== 4) {
      throw Error("Esquema de evidencia inesperado");
    }
    if (data.protocols.some((p) => !EVIDENCE_NAMES[p.id] || p.core4_ablations.length !== 5 ||
      p.core4_ablations.some((x) => !Number.isFinite(x.rmse)) ||
      !Number.isFinite(p.reference26_r3.without_r3) || !Number.isFinite(p.reference26_r3.with_r3) ||
      !Number.isFinite(p.expert_weight) || p.expert_weight < 0 || p.expert_weight > 1)) {
      throw Error("Datos de componentes incompletos");
    }
    componentProtocols = data.protocols;
    renderAblations("random");
    renderComponentEvidence();
  } catch (error) {
    console.error("No se cargó evidencia de componentes:", error);
    for (const node of [chart, r3, weights]) {
      node.textContent = "No se pudo cargar la evidencia. Consulta los CSV agregados en GitHub.";
    }
  }
})();

(async function loadPublishedDistributions() {
  const target = $("#distribution-quantiles");
  if (!target) return;
  try {
    const response = await fetch("./data/distribution.json", {cache: "no-store"});
    if (!response.ok) throw Error("No se cargó el resumen de rendimientos");
    const data = await response.json();
    if (data.schema_version !== 1 || data.rows.length !== 8) throw Error("Resumen estadístico incompleto");
    window.GeoCharts.distribution(target, data.rows);
  } catch (error) {
    console.error("No fue posible dibujar la distribución:", error);
    target.textContent = "Consulta la figura original y sus estadísticas en el repositorio.";
  }
})();
