/* Gráficas explicativas construidas a partir de resultados agregados y verificados.
 * Los controles NO calculan pronósticos, p-valores nuevos ni etiquetas ocultas.
 */
"use strict";
(() => {
  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => Array.from(document.querySelectorAll(selector));
  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const number = (x, decimals = 4) => Number(x).toFixed(decimals);
  const percent = (x) => (100 * x).toFixed(1) + " %";
  const sign = (x, decimals = 4) => (x > 0 ? "+" : "") + Number(x).toFixed(decimals);

  /* Ejemplo ficticio; no usa el modelo ni los datos reales. */
  function updateIllustrativePrediction() {
    const blend = Number(q("#geo-blend").value) / 100;
    const correction = Number(q("#error-correction").value) / 100;
    const result = 4.00 + blend * (4.80 - 4.00) + correction;
    q("#geo-blend-value").textContent = Math.round(blend * 100) + " %";
    q("#error-correction-value").textContent = sign(correction, 2) + " t/ha";
    q("#weight-climate").style.width = (100 * (1 - blend)) + "%";
    q("#weight-local").style.width = (100 * blend) + "%";
    q("#weight-preview").setAttribute("aria-label",
      Math.round((1 - blend) * 100) + " % de peso climático y " +
      Math.round(blend * 100) + " % de peso local");
    q("#calc-result").textContent = number(result, 2);
    q("#calc-equation").textContent = "4.00 + " + number(blend, 2) +
      " × (4.80 − 4.00) " + (correction >= 0 ? "+ " : "− ") +
      number(Math.abs(correction), 2) + " = " + number(result, 2);
  }
  for (const id of ["#geo-blend", "#error-correction"]) {
    q(id).addEventListener("input", updateIllustrativePrediction);
  }
  updateIllustrativePrediction();

  const hhiReadings = {
    random: "Al elegir parcelas al azar, los dos modelos dan prácticamente el mismo RMSE. No se distingue una ventaja.",
    climate_profile: "Al dejar fuera perfiles climáticos, la variante sin HHI mejora ligeramente, pero el intervalo aún incluye cero.",
    municipality: "Al dejar fuera municipios completos, la variante sin HHI tiene mayor error. Quitar una variable no mejora todos los escenarios.",
    spatial: "Por bloques geográficos, el RMSE baja alrededor de 0.10 t/ha. La mejora se concentra en unos bloques, el intervalo incluye cero y sólo hay cinco grupos para inferir."
  };
  let research = null;

  function drawAssociations() {
    window.GeoCharts.coefficients(q("#association-chart"), research.associations);
    const testFamilies = research.architecture_tests;
    const total = Object.values(testFamilies).reduce((acc, x) => acc + x.tests, 0);
    const detected = Object.values(testFamilies).reduce((acc, x) => acc + x.significant_holm, 0);
    q("#holm-zero").textContent = detected + " / " + total;
  }

  function drawHHI(id) {
    if (!research) return;
    const row = research.protocols.find((x) => x.id === id);
    if (!row) return;
    qa("[data-hhi-protocol]").forEach((button) => {
      const selected = button.dataset.hhiProtocol === id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    q("#hhi-caption").textContent = row.label.toUpperCase();
    q("#hhi-observation").textContent = hhiReadings[id];
    q("#hhi-rmse-26").textContent = number(row.reference26);
    q("#hhi-rmse-25").textContent = number(row.without_hhi);
    q("#hhi-bar-26").style.width = Math.min(100, row.reference26 / 1.1 * 100) + "%";
    q("#hhi-bar-25").style.width = Math.min(100, row.without_hhi / 1.1 * 100) + "%";
    q("#hhi-delta").textContent = sign(row.delta) + " t/ha";
    const bound = (x) => Math.max(0, Math.min(100, 100 * (x + 0.3) / 0.6));
    const [low, high] = row.ci95;
    q("#hhi-ci").style.left = bound(low) + "%";
    q("#hhi-ci").style.width = (bound(high) - bound(low)) + "%";
    q("#hhi-ci-point").style.left = bound(row.delta) + "%";
    q("#hhi-ci-values").textContent = "IC 95 % para la diferencia: [" +
      sign(low) + ", " + sign(high) + "] t/ha. " + row.groups +
      " grupos usados para el contraste.";
    q("#hhi-ci-description").setAttribute("aria-label",
      "Diferencia sin HHI menos Reference26: " + sign(row.delta) +
      " t/ha. Intervalo entre " + sign(low) + " y " + sign(high) +
      " t/ha; contiene cero.");
    q("#hhi-p").textContent = number(row.p_holm, 4);
    window.GeoCharts.forest(q("#hhi-forest"), research.protocols, id);
    q("#hhi-significance").textContent = row.p_holm < 0.05 ?
      "Supera el umbral de 0.05 de esta familia; sigue siendo exploratorio." :
      "No supera el umbral de 0.05 después de ajustar por Holm.";
  }
  qa("[data-hhi-protocol]").forEach((button) => {
    button.addEventListener("click", () => drawHHI(button.dataset.hhiProtocol));
  });

  function supportRow(name, count, n) {
    const item = element("div", "support-row");
    const header = element("div", "support-label");
    header.append(element("span", "", name), element("strong", "", String(count)));
    const track = element("div", "support-mini-track");
    const bar = element("span", "");
    bar.style.width = 100 * count / n + "%";
    track.append(bar);
    item.append(header, track);
    return item;
  }
  function drawSupport(id) {
    const source = id === "all" ? research.support :
      research.support_states.find((x) => x.state === id);
    if (!source) return;
    q("#support-total").textContent = source.any_flag + " de " + source.n;
    q("#support-shaded").style.width = 100 * source.any_flag / source.n + "%";
    const target = q("#support-categories");
    target.replaceChildren();
    for (const [label, key] of [
      ["Historia insuficiente para R3", "missing_r3"],
      ["Geografía fuera del rango habitual", "outside_geography"],
      ["Señales climáticas fuera del rango habitual", "outside_climate"],
      ["Señales locales fuera del rango habitual", "outside_local"]
    ]) target.append(supportRow(label, source[key], source.n));
    q(".support-track").setAttribute("aria-label",
      source.any_flag + " de " + source.n + " parcelas con al menos un aviso");
  }
  q("#state-support").addEventListener("change", (event) => drawSupport(event.target.value));

  function drawIntervals(level) {
    if (!research) return;
    qa("[data-interval]").forEach((button) => {
      const active = Number(button.dataset.interval) === level;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    window.GeoCharts.intervals(q("#interval-results"),
      research.intervals.filter((entry) => entry.level === level), level);
  }
  qa("[data-interval]").forEach((button) => {
    button.addEventListener("click", () => drawIntervals(Number(button.dataset.interval)));
  });

  (async () => {
    try {
      const response = await fetch("./data/new_research.json", { cache: "no-store" });
      if (!response.ok) throw Error("No se recuperó la evidencia publicada");
      const data = await response.json();
      const ids = ["random", "climate_profile", "municipality", "spatial"];
      if (data.schema_version !== 1 || data.protocols.length !== 4 ||
        ids.some((id) => !data.protocols.some((r) => r.id === id &&
          Number.isFinite(r.reference26) && Number.isFinite(r.without_hhi) &&
          r.ci95.length === 2 && r.ci95[0] < 0 && r.ci95[1] > 0)) ||
        data.associations.length !== 4 || data.intervals.length !== 4 ||
        data.support_states.length !== 3) {
        throw Error("Esquema de resultados incompleto");
      }
      research = data;
      drawAssociations();
      drawHHI("random");
      drawSupport("all");
      drawIntervals(0.9);
    } catch (error) {
      console.error("No se pudieron cargar los resultados nuevos:", error);
      for (const selector of ["#association-chart", "#hhi-observation", "#support-categories", "#interval-results"]) {
        q(selector).textContent = "No se pudieron cargar las tablas. Puedes consultar los archivos originales en GitHub.";
      }
    }
  })();
})();
