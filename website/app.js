/* Standalone presentation logic; only local, public aggregate CSV files. */
"use strict";

const DATA_ROOT = "./data/";
const MODELS = ["Reference26", "Compact14", "B1", "CT3", "L40"];
const PROTOCOLS = {
  fresh_97_41: {
    label: "97/41",
    description: "En 16 pruebas se usan 97 parcelas para entrenar y 41 para evaluar. Los resultados son promedios de esas pruebas sobre 138 cosechas conocidas."
  },
  random: {
    label: "Aleatoria",
    description: "Se repite la evaluación con parcelas elegidas al azar. Cada una se evalúa separada del grupo utilizado para entrenar el modelo."
  },
  climate_profile: {
    label: "Perfil climático",
    description: "En cada prueba dejamos fuera grupos con condiciones climáticas similares y evaluamos las predicciones para esos grupos."
  },
  municipality: {
    label: "Municipal",
    description: "Dejamos municipios completos fuera del entrenamiento para comprobar cómo funcionan las estimaciones en municipios que el modelo no utilizó al entrenar."
  },
  spatial: {
    label: "Espacial",
    description: "Separamos las parcelas por zonas geográficas y dejamos algunas zonas fuera del entrenamiento."
  }
};
const LABELS = {
  Reference26: "Clima, vecinos y geología",
  Compact14: "Clima y vecinos, sin geología",
  B1: "Clima combinado con el modelo principal",
  CT3: "Lluvia y vegetación en mayo",
  L40: "Vecinos con información satelital amplia"
};
const ROLES = {
  Reference26: "Seleccionado · 26 indicadores · Reference26",
  Compact14: "Seleccionado · 14 indicadores · Compact14",
  B1: "Combinación adicional · B1",
  CT3: "Primer modelo · 4 indicadores · C-T3",
  L40: "Modelo anterior · Local04D"
};
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function csvParse(text) {
  const records = [];
  let line = [], field = "", quote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quote && text[i + 1] === '"') { field += '"'; i++; }
      else quote = !quote;
    } else if (char === "," && !quote) {
      line.push(field); field = "";
    } else if ((char === "\r" || char === "\n") && !quote) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      line.push(field); field = "";
      if (line.some(value => value.length)) records.push(line);
      line = [];
    } else {
      field += char;
    }
  }
  line.push(field);
  if (line.some(value => value.length)) records.push(line);
  if (records.length < 2) throw new Error("CSV vacío.");
  const headers = records.shift().map(s => s.replace(/^\uFEFF/, "").trim());
  return records.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] || ""])));
}
async function loadCSV(filename) {
  const response = await fetch(DATA_ROOT + filename, { cache: "no-store" });
  if (!response.ok) throw new Error(filename + ": HTTP " + response.status);
  return csvParse(await response.text());
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function fmt(value) { return Number(value).toFixed(4); }

function initMenu() {
  const button = $("#menu-toggle");
  const links = $("#nav-links");
  if (!button || !links) return;
  button.addEventListener("click", () => {
    const opened = links.classList.toggle("open");
    button.setAttribute("aria-expanded", String(opened));
  });
  links.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    });
  });
}

function initRainfall() {
  const scenarios = {
    uniform: [20, 20, 20, 20, 20, 20, 20],
    early: [50, 40, 30, 10, 5, 3, 2],
    late: [2, 3, 5, 10, 30, 40, 50]
  };
  const chart = $("#rain-chart");
  if (!chart) return;
  function render(name) {
    const values = scenarios[name];
    const total = values.reduce((a, b) => a + b, 0);
    const early = values.slice(0, 3).reduce((a, b) => a + b, 0) / total;
    const hhi = values.reduce((sum, mm) => sum + (mm / total) ** 2, 0);
    chart.replaceChildren();
    values.forEach((mm, i) => {
      const bar = element("div", "rain-bar");
      bar.style.height = (mm / 60 * 100).toFixed(2) + "%";
      bar.append(element("span", "", String(mm)));
      bar.setAttribute("aria-label", ["Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre"][i] + ": " + mm + " mm");
      chart.append(bar);
    });
    chart.setAttribute("aria-label", "Lluvia mensual sintética: " + values.join(", ") + " milímetros; total " + total + " mm");
    $("#rain-total").textContent = total + " mm";
    $("#rain-early").textContent = early.toFixed(3);
    $("#rain-hhi").textContent = hhi.toFixed(3);
    $$("[data-scenario]").forEach(button => {
      const active = button.dataset.scenario === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  $$("[data-scenario]").forEach(button => button.addEventListener("click", () => render(button.dataset.scenario)));
  render("uniform");
}

function initNeighbors() {
  const svg = $("#neighbor-svg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const samples = Array.from({ length: 46 }, (_, i) => ({
    x: 30 + ((i * 79 + i * i * 11) % 454),
    y: 24 + ((i * 41 + i * i * 17) % 275),
    i
  }));
  const positions = { one: [174, 142], two: [393, 215] };
  function shape(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => n.setAttribute(key, String(value)));
    return n;
  }
  function render(name) {
    const [x, y] = positions[name];
    const selected = new Set(samples
      .map(p => ({ i: p.i, distance: (p.x - x) ** 2 + (p.y - y) ** 2 }))
      .sort((a, b) => a.distance - b.distance || a.i - b.i)
      .slice(0, 24).map(p => p.i));
    svg.replaceChildren();
    for (let i = 1; i <= 5; i++) {
      svg.append(shape("line", { x1: i * 86, y1: 0, x2: i * 86, y2: 330, stroke: "#dde9dd", "stroke-width": 1 }));
    }
    for (let i = 1; i <= 3; i++) {
      svg.append(shape("line", { x1: 0, y1: i * 83, x2: 520, y2: i * 83, stroke: "#dde9dd", "stroke-width": 1 }));
    }
    samples.filter(p => selected.has(p.i)).forEach(p => {
      svg.append(shape("line", { x1: x, y1: y, x2: p.x, y2: p.y, stroke: "#79aa9a", "stroke-width": 1, "stroke-opacity": .31 }));
    });
    samples.forEach(p => {
      svg.append(shape("circle", {
        cx: p.x, cy: p.y, r: selected.has(p.i) ? 5.1 : 3.6,
        fill: selected.has(p.i) ? "#2b8774" : "#b9cac2",
        stroke: selected.has(p.i) ? "#e9f7e8" : "none", "stroke-width": 1
      }));
    });
    svg.append(shape("circle", { cx: x, cy: y, r: 17, fill: "none", stroke: "#c39245", "stroke-width": 2, "stroke-dasharray": "3 4" }));
    svg.append(shape("circle", { cx: x, cy: y, r: 7.5, fill: "#c39245", stroke: "#fff8e7", "stroke-width": 2 }));
    svg.setAttribute("aria-label", "Esquema artificial. Consulta " + (name === "one" ? "A" : "B") + ": 24 vecinos de 46 puntos sintéticos.");
    $("#neighbor-caption").textContent = "Consulta " + (name === "one" ? "A" : "B") + ": 24 vecinos geográficos ilustrativos; sin datos ni coordenadas reales.";
    $$("[data-query]").forEach(button => {
      const active = button.dataset.query === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  $$("[data-query]").forEach(button => button.addEventListener("click", () => render(button.dataset.query)));
  render("one");
}

async function initComparison() {
  const chart = $("#comparison-chart");
  const tbody = $("#comparison-table");
  if (!chart || !tbody) return;
  try {
    const [mainRows, freshRows, l40Rows] = await Promise.all([
      loadCSV("current_champions_metrics.csv"),
      loadCSV("fresh_97_41_metrics.csv"),
      loadCSV("l40_protocols.csv")
    ]);
    const all = new Map();
    for (const name of Object.keys(PROTOCOLS)) all.set(name, new Map());
    for (const row of mainRows) {
      if (all.has(row.protocol)) all.get(row.protocol).set(row.experiment, row);
    }
    for (const row of freshRows) {
      if (all.has(row.protocol)) all.get(row.protocol).set(row.experiment, row);
    }
    for (const row of l40Rows) {
      if (all.has(row.protocol)) all.get(row.protocol).set("L40", { ...row, experiment: "L40" });
    }
    for (const [protocol, rows] of all) {
      if (!MODELS.every(name => rows.has(name) && Number.isFinite(Number(rows.get(name).rmse)) && Number.isFinite(Number(rows.get(name).r2)))) {
        throw new Error("Faltan modelos o métricas de " + protocol);
      }
    }
    function render(protocol) {
      const rows = [...all.get(protocol).values()].filter(row => MODELS.includes(row.experiment));
      rows.sort((a, b) => Number(a.rmse) - Number(b.rmse));
      chart.replaceChildren();
      tbody.replaceChildren();
      rows.forEach(row => {
        const name = row.experiment;
        const barRow = element("div", "chart-row");
        if (name === "Reference26" || name === "Compact14") barRow.classList.add("champion");
        if (name === "L40") barRow.classList.add("reference");
        if (name === "B1") barRow.classList.add("b1");
        const track = element("div", "chart-track");
        const fill = element("div", "chart-fill");
        fill.style.width = (Math.min(100, Number(row.rmse) / 1.05 * 100)).toFixed(2) + "%";
        track.append(fill);
        const label = element("div", "chart-label");
        label.append(element("strong", "", LABELS[name]), element("small", "", ROLES[name]));
        barRow.append(label, track, element("span", "chart-value", fmt(row.rmse)));
        chart.append(barRow);

        const tr = document.createElement("tr");
        if (name === "Reference26" || name === "Compact14") tr.className = "is-champion";
        [LABELS[name], fmt(row.rmse), fmt(row.r2), ROLES[name]].forEach(value => tr.append(element("td", "", value)));
        tbody.append(tr);
      });
      $("#protocol-description").textContent = PROTOCOLS[protocol].description;
      $("#comparison-caption").textContent = "RMSE y R² por modelo — " + PROTOCOLS[protocol].label;
      $$("[data-protocol]").forEach(button => {
        const active = button.dataset.protocol === protocol;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }
    $$("[data-protocol]").forEach(button => button.addEventListener("click", () => render(button.dataset.protocol)));
    render("fresh_97_41");
  } catch (error) {
    console.error("No se pudieron cargar las métricas agregadas:", error);
    chart.replaceChildren(element("p", "", "No se pudieron cargar las métricas. Consulta los CSV originales vinculados en las fuentes."));
    $("#protocol-description").textContent = "Tabla estática de respaldo: 97/41. Para otros protocolos, consulta los resultados originales.";
  }
}

initMenu();
initRainfall();
initNeighbors();
initComparison();
