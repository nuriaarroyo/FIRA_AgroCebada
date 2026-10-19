/* Historia documentada de un solo modelo. No se ajustan coeficientes en el navegador. */
"use strict";
(() => {
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const fmt = (n, decimals = 2) => Number(n).toFixed(decimals);
  const activeButtons = (selector, attribute, selected) => {
    $$(selector).forEach((button) => {
      const on = button.dataset[attribute] === String(selected);
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    });
  };
  const menu = $("#menu-toggle");
  const nav = $("#nav-links");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  });
  $$("#nav-links a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  }));

  // Both rainfall scenes are fictional, 210 mm in April–October.
  const RAIN = {
    uniform: [30,30,30,30,30,30,30],
    concentrated: [10,10,10,20,140,10,10]
  };
  const showRain = (id) => {
    const mm = RAIN[id], total = mm.reduce((a, b) => a + b, 0);
    const early = mm.slice(0, 3).reduce((a, b) => a + b, 0) / total;
    const hhi = mm.reduce((sum, v) => sum + (v / total) ** 2, 0);
    if (total !== 210) throw Error("La simulación debe conservar 210 mm");
    window.GeoCharts.rainfall($("#rain-chart"), mm);
    $("#rain-total").textContent = total + " mm";
    $("#rain-early").textContent = fmt(early * 100, 1) + " %";
    $("#rain-hhi").textContent = fmt(hhi, 3);
    activeButtons("[data-rain]", "rain", id);
  };
  $$("[data-rain]").forEach((button) =>
    button.addEventListener("click", () => showRain(button.dataset.rain)));
  showRain("uniform");

  const featureTabs = $$("[data-feature]");
  let model = null, selectedCluster = 0;
  const showFeatures = (id) => {
    if (!model) return;
    const block = model.features.find((x) => x.key === id);
    if (!block) return;
    $("#feature-title").textContent = block.title;
    $("#feature-why").textContent = block.why;
    const table = $("#feature-rows");
    table.replaceChildren();
    for(const item of block.features) {
      const row = el("tr");
      const title = el("td");
      title.append(el("strong", "", item.number + ". " + item.name), el("code", "", item.code));
      row.append(title, el("td", "", item.how), el("td", "", item.interpret));
      table.append(row);
    }
    activeButtons("[data-feature]", "feature", id);
  };
  featureTabs.forEach((button) =>
    button.addEventListener("click", () => showFeatures(button.dataset.feature)));

  function example() {
    if (!model) return;
    const c = Number($("#example-climate").value) / 100;
    const e = Number($("#example-local").value) / 100;
    const delta = Number($("#example-corrector").value) / 100;
    const g = model.final_fit.cluster_weights[selectedCluster];
    if (!(g >= 0 && g <= 1)) throw Error("Peso geológico fuera de [0,1]");
    const result = c + g * (e - c) + delta;
    $("#climate-number").textContent = fmt(c) + " t/ha";
    $("#local-number").textContent = fmt(e) + " t/ha";
    $("#corrector-number").textContent = (delta >= 0 ? "+" : "") + fmt(delta) + " t/ha";
    $("#mix-climate").style.width = (100 * (1 - g)) + "%";
    $("#mix-local").style.width = (100 * g) + "%";
    $("#mix-swatch").setAttribute("aria-label",
      fmt(100 * (1 - g), 1) + " % clima, " + fmt(100 * g, 1) + " % experto local");
    $("#example-result").textContent = fmt(result);
    $("#example-equation").textContent = "La parte climática aporta " +
      fmt(c * (1 - g), 3) + " t/ha y la parte local aporta " +
      fmt(e * g, 3) + " t/ha. La corrección final " +
      (delta >= 0 ? "suma " : "resta ") + fmt(Math.abs(delta), 2) +
      " t/ha. El resultado ilustrativo es " + fmt(result, 3) + " t/ha.";
  }
  ["example-climate", "example-local", "example-corrector"].forEach((id) =>
    $("#" + id).addEventListener("input", example));
  function drawClusters() {
    const root = $("#cluster-list");
    root.replaceChildren();
    model.final_fit.cluster_weights.forEach((weight, index) => {
      const button = el("button", "cluster-choice" + (index === selectedCluster ? " active" : ""));
      button.type = "button";
      button.setAttribute("aria-pressed", String(index === selectedCluster));
      button.setAttribute("aria-label", "Grupo geológico " + index +
        ", peso de experto local " + fmt(100 * weight, 1) + " %");
      const label = el("span", "cluster-description");
      label.append(el("strong", "", "Grupo geológico " + index),
        el("small", "", "Peso para las parcelas cercanas"));
      const meter = el("div", "cluster-meter");
      const fill = el("span", "");
      fill.style.width = 100 * weight + "%";
      meter.append(fill);
      const value = el("strong", "cluster-weight", fmt(weight * 100, 1) + " %");
      button.append(label, meter, value);
      button.addEventListener("click", () => {
        selectedCluster = index;
        drawClusters();
        example();
      });
      root.append(button);
    });
  }

  $$("[data-support]").forEach((button) => button.addEventListener("click", () => {
    const complete = button.dataset.support === "complete";
    activeButtons("[data-support]", "support", button.dataset.support);
    $("#support-formula").textContent = complete ?
      "Mezcla de clima y vecinos + corrección final" : "Mezcla de clima y vecinos + 0";
    $("#support-note").textContent = complete ?
      "Si los tres indicadores existen, la corrección puede sumar o restar hasta 0.25 t/ha." :
      "Si falta cualquiera de los tres, el corrector R3 se desactiva. No se elimina la predicción base.";
  }));

  let research = null;
  function showIntervals(level) {
    if (!research) return;
    activeButtons("[data-level]", "level", level);
    window.GeoCharts.intervals($("#interval-results"),
      research.intervals.filter(x => x.model === "Reference26" && x.level === Number(level)),
      Number(level));
  }
  $$("[data-level]").forEach((button) =>
    button.addEventListener("click", () => showIntervals(button.dataset.level)));

  function showFigures(evidence, results, newResearch, distributions) {
    const ids = ["fresh_97_41", "random", "climate_profile", "municipality", "spatial"];
    const labels = {
      fresh_97_41: ["16 pruebas de 97/41", "97 para entrenar, 41 para evaluar"],
      random: ["Parcelas aleatorias", "Se separan al azar en varias repeticiones"],
      climate_profile: ["Perfiles climáticos", "Se retienen grupos de clima"],
      municipality: ["Municipios completos", "Se retienen municipios completos"],
      spatial: ["Bloques geográficos", "Se retienen zonas geográficas"]
    };
    const performance = ids.map(id => {
      const protocol = results.protocols.find(x => x.id === id);
      const row = protocol && protocol.results.find(x => x.id === "Reference26");
      if (!row || !Number.isFinite(row.rmse)) throw Error("No hay RMSE del modelo en " + id);
      return {id, label: labels[id][0], description: labels[id][1],
        rmse: row.rmse, r2: row.r2, mae: row.mae};
    });
    window.GeoCharts.performance($("#performance-chart"), performance);
    const names = {
      random: "Parcelas aleatorias", climate_profile: "Perfiles climáticos",
      municipality: "Municipios completos", spatial: "Bloques geográficos"
    };
    const components = evidence.protocols.map(p => ({
      id:p.id,label:names[p.id],
      without:p.reference26_r3.without_r3,with:p.reference26_r3.with_r3,
      weight:p.expert_weight
    }));
    window.GeoCharts.r3($("#r3-comparison"), components);
    window.GeoCharts.expertWeights($("#expert-weights"), components);
    window.GeoCharts.coefficients($("#association-chart"), newResearch.associations);
    const sensitivity = newResearch.protocols.map(p => ({
      ...p,label:names[p.id]
    }));
    window.GeoCharts.forest($("#hhi-forest"), sensitivity, "spatial");
    window.GeoCharts.distribution($("#distribution-quantiles"), distributions.rows);
    research = newResearch;
    showIntervals("0.9");
  }
  (async () => {
    try {
      const sources = ["model.json", "evidence.json", "results.json",
        "new_research.json", "distribution.json"];
      const entries = await Promise.all(sources.map(async file => {
        const res = await fetch("./data/" + file, {cache:"no-store"});
        if (!res.ok) throw Error("No se pudo leer " + file);
        return res.json();
      }));
      const [m, evidence, results, newResearch, distributions] = entries;
      if(m.schema_version !== 1 || m.features.length !== 5 ||
        m.features.reduce((sum, group) => sum + group.features.length, 0) !== 26 ||
        m.final_fit.cluster_weights.length !== 4 ||
        evidence.protocols.length !== 4 || results.protocols.length !== 5 ||
        newResearch.protocols.length !== 4 || distributions.rows.length !== 8) {
        throw Error("El esquema de entradas y resultados no coincide con la documentación");
      }
      model = m;
      showFeatures("clima");
      drawClusters();
      example();
      showFigures(evidence, results, newResearch, distributions);
    } catch (error) {
      console.error("Error al cargar el modelo documentado:", error);
      for (const id of ["feature-rows", "cluster-list", "performance-chart",
        "r3-comparison", "expert-weights", "association-chart", "hhi-forest",
        "interval-results", "distribution-quantiles"]) {
        const target = $("#" + id);
        if (target) target.textContent =
          "No se cargaron los datos de esta gráfica. Puedes consultar las tablas originales del repositorio.";
      }
    }
  })();
})();