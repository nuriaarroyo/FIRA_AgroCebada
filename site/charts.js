/* GeoCebada: source-backed interactive SVG figures.
 * No external chart library, tracking, public parcel records, or hidden predictions.
 * Every tooltip describes a numeric value present in the published aggregate snapshots.
 */
(function (global) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const WIDTH = 1000;
  const $ = (selector) => document.querySelector(selector);
  const fmt = (value, places) => Number(value).toFixed(places == null ? 4 : places);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const interpolate = (n, domain, range) => range[0] +
    (n - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]);
  const palette = () => {
    const css = getComputedStyle(document.documentElement);
    const color = (v, fallback) => css.getPropertyValue(v).trim() || fallback;
    return {
      forest: color("--forest", "#10372f"),
      jade: color("--jade", "#39765e"),
      gold: color("--gold", "#dfb977"),
      ink: color("--ink", "#18382f"),
      muted: color("--muted", "#64766d"),
      rule: color("--rule", "#d7dfd4"),
      paper: color("--paper", "#fffef9"),
      sans: color("--sans", "'Segoe UI', sans-serif"),
      soft: "#a0b6a3",
      cool: "#668a87"
    };
  };
  function svg(tag, attributes, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function textNode(canvas, value, x, y, options) {
    const o = options || {};
    const node = svg("text", {
      x, y, fill: o.color || palette().ink,
      "font-size": o.size || 13,
      "font-weight": o.weight || 500,
      "font-family": palette().sans,
      "text-anchor": o.anchor || "start",
      "dominant-baseline": "middle",
      "font-variant-numeric": "tabular-nums"
    }, value);
    canvas.appendChild(node);
    return node;
  }
  function line(canvas, x1, y1, x2, y2, options) {
    const o = options || {};
    canvas.appendChild(svg("line", {
      x1, y1, x2, y2,
      stroke: o.color || palette().rule,
      "stroke-width": o.width || 1,
      "stroke-dasharray": o.dash || "none",
      "stroke-linecap": "round"
    }));
  }
  function start(target, title, height, minWidth) {
    target.replaceChildren();
    target.classList.add("figure-host");
    const wrap = document.createElement("div");
    wrap.className = "figure-scroll";
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", title + ". Puedes desplazarte horizontalmente en pantallas pequeñas.");
    const canvas = svg("svg", {
      viewBox: "0 0 " + WIDTH + " " + height,
      role: "img", "aria-label": title,
      preserveAspectRatio: "xMinYMin meet"
    });
    canvas.classList.add("research-svg");
    canvas.style.minWidth = (minWidth || 740) + "px";
    canvas.appendChild(svg("title", {}, title));
    const tip = document.createElement("p");
    tip.className = "figure-reading";
    tip.setAttribute("aria-live", "polite");
    tip.textContent = "Pasa el cursor o utiliza Tab para consultar los valores exactos.";
    wrap.appendChild(canvas);
    target.append(wrap, tip);
    return {canvas, tip, colors: palette()};
  }
  function interactive(node, detail, tip) {
    node.classList.add("figure-point");
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", detail);
    node.appendChild(svg("title", {}, detail));
    const active = () => { tip.textContent = detail; node.classList.add("is-focused"); };
    const idle = () => node.classList.remove("is-focused");
    node.addEventListener("focus", active);
    node.addEventListener("mouseenter", active);
    node.addEventListener("blur", idle);
    node.addEventListener("mouseleave", idle);
  }
  function ticks(canvas, domain, xrange, y, values, format) {
    for (const x of values) {
      const xx = interpolate(x, domain, xrange);
      line(canvas, xx, 30, xx, y - 17, {color: "#dce6d9"});
      textNode(canvas, format(x), xx, y + 10, {color: palette().muted, size: 12, anchor: "middle"});
    }
  }
  function descriptiveLabel(canvas, label, subtitle, y, left) {
    textNode(canvas, label, left || 8, y - (subtitle ? 10 : 0), {size: 14, weight: 650});
    if (subtitle) textNode(canvas, subtitle, left || 8, y + 11, {size: 11, color: palette().muted});
  }
  function dotRows(target, options) {
    const o = options;
    const height = o.rows.length * 62 + 90;
    const {canvas, tip, colors} = start(target, o.title, height);
    const domain = o.domain;
    const xr = [365, 850], first = 65, bottom = 50 + o.rows.length * 62;
    ticks(canvas, domain, xr, bottom + 12, o.ticks, o.axisFormat || ((x) => fmt(x, 2)));
    if (o.baseline != null) {
      const x = interpolate(o.baseline, domain, xr);
      line(canvas, x, 22, x, bottom - 9, {color: colors.gold, width: 2, dash: "5 6"});
    }
    o.rows.forEach((row, i) => {
      const y = first + i * 62;
      const x = interpolate(row.value, domain, xr);
      descriptiveLabel(canvas, row.label, row.subtitle, y);
      line(canvas, xr[0], y + 20, xr[1], y + 20, {color: colors.rule});
      const circle = svg("circle", {
        cx: x, cy: y, r: 8,
        fill: row.color || colors.jade,
        stroke: colors.paper, "stroke-width": 3
      });
      canvas.appendChild(circle);
      interactive(circle, row.detail || row.label + ": " + fmt(row.value) + " " + (o.unit || ""), tip);
      textNode(canvas, row.format ? row.format(row.value) : fmt(row.value),
        871, y, {size: 15, weight: 730, color: colors.ink});
    });
    const caption = document.createElement("p");
    caption.className = "figure-axis-note";
    caption.textContent = o.note || "Comparación en una misma escala. Consulta los números exactos en cada punto.";
    target.append(caption);
  }
  function performance(target, protocols) {
    dotRows(target, {
      title: "Error RMSE de la regresión local con mezcla geológica por tipo de evaluación",
      rows: protocols.map((p) => ({
        label: p.label,
        subtitle: p.description,
        value: p.rmse,
        color: palette().jade,
        detail: p.label + ". RMSE " + fmt(p.rmse) +
          " t/ha, MAE " + fmt(p.mae) +
          " t/ha y R cuadrada " + fmt(p.r2) + "."
      })),
      domain: [0.40, 0.72], ticks: [0.4, 0.5, 0.6, 0.7],
      note: "El eje RMSE comienza en 0.40 t/ha. Estas evaluaciones retienen parcelas de manera distinta: no son cinco estimaciones de una misma incertidumbre."
    });
  }
  const MODEL_COLORS = {Reference26: "jade", Compact14: "forest", B1: "gold", L40: "cool", CT3: "soft"};
  function models(target, data, labelMap) {
    const sorted = data.slice().sort((a, b) => a.rmse - b.rmse);
    dotRows(target, {
      title: "Error RMSE de cinco modelos, en toneladas por hectárea",
      rows: sorted.map((row) => ({
        label: labelMap[row.id][0],
        subtitle: labelMap[row.id][1],
        value: row.rmse,
        color: palette()[MODEL_COLORS[row.id]],
        detail: labelMap[row.id][0] + ". RMSE " + fmt(row.rmse) +
          " toneladas por hectárea. R cuadrada " + fmt(row.r2) + "."
      })),
      domain: [0.35, 1.08], ticks: [0.4, 0.6, 0.8, 1.0],
      unit: "t/ha",
      note: "Escala de puntos: el eje empieza en 0.35 t/ha (no en cero). Menor RMSE significa menor error."
    });
  }
  function ablations(target, entries) {
    const labels = {
      FULL4: "Las cuatro medidas",
      DROP_compact_precip_total: "Sin lluvia acumulada",
      DROP_compact_early_fraction: "Sin lluvia temprana",
      DROP_compact_concentration_hhi: "Sin concentración mensual",
      DROP_S2_ndvi_month_05: "Sin verdor de mayo"
    };
    const baseline = entries.find((x) => x.id === "FULL4").rmse;
    dotRows(target, {
      title: "Error del modelo climático al retirar cada medida",
      rows: entries.map((row) => ({
        label: labels[row.id],
        subtitle: row.id === "FULL4" ? "Modelo original" : "Se vuelve a entrenar sin esta medida",
        value: row.rmse,
        color: row.id === "FULL4" ? palette().forest : palette().gold,
        detail: labels[row.id] + ". RMSE " + fmt(row.rmse) + " t/ha." +
          (row.id === "FULL4" ? " Es el punto de referencia." :
          " Cambio frente al original: " + fmt(row.rmse - baseline) + " t/ha.")
      })),
      baseline, domain: [0.45, 1.10], ticks: [0.5, 0.7, 0.9, 1.1],
      unit: "t/ha",
      note: "La línea mostaza señala el error del modelo con sus cuatro medidas. El eje no comienza en cero."
    });
  }
  function r3(target, rows) {
    const {canvas, tip, colors} = start(target, "Error del modelo con y sin corrección final", 366);
    const xr = [320, 850], domain = [0.42, 0.74];
    ticks(canvas, domain, xr, 321, [0.45, 0.55, 0.65, 0.70], (v) => fmt(v, 2));
    const order = ["random", "climate_profile", "municipality", "spatial"];
    order.forEach((id, i) => {
      const row = rows.find((x) => x.id === id), y = 65 + i * 66;
      const a = interpolate(row.without, domain, xr);
      const b = interpolate(row.with, domain, xr);
      descriptiveLabel(canvas, row.label, "", y, 15);
      line(canvas, Math.min(a, b), y, Math.max(a, b), y, {color: colors.soft, width: 5});
      for (const [value, cx, color, label] of [[row.without, a, colors.gold, "Sin corrección"], [row.with, b, colors.jade, "Con corrección"]]) {
        const point = svg("circle", {cx, cy: y, r: 8, fill: color, stroke: colors.paper, "stroke-width": 2});
        canvas.appendChild(point);
        interactive(point, row.label + ": " + label.toLowerCase() + ", RMSE " + fmt(value) + " t/ha", tip);
      }
      textNode(canvas, fmt(row.with), 880, y, {weight: 730, size: 15});
    });
    const note = document.createElement("p");
    note.className = "figure-axis-note";
    note.textContent = "Verde: con corrección final. Mostaza: sin corrección. El punto final derecho muestra el RMSE con corrección; el eje empieza en 0.42 t/ha.";
    target.append(note);
  }
  function expertWeights(target, rows) {
    dotRows(target, {
      title: "Peso medio de la estimación local en cuatro evaluaciones",
      rows: rows.map((row) => ({
        label: row.label,
        value: row.weight,
        color: palette().jade,
        subtitle: "Peso medio aprendido",
        format: (x) => fmt(x * 100, 1) + " %",
        detail: row.label + ": peso medio del modelo basado en parcelas cercanas " +
          fmt(row.weight * 100, 2) + " por ciento."
      })),
      domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1],
      axisFormat: (x) => fmt(x * 100, 0) + "%",
      note: "No representa cuánto del rendimiento causa la cercanía. Es el peso medio de mezcla aprendido en cada evaluación."
    });
  }
  function coefficients(target, entries) {
    const {canvas, tip, colors} = start(target, "Asociaciones ajustadas por estado con los rendimientos", 380);
    const domain = [-0.42, 0.42], xr = [385, 833], zero = interpolate(0, domain, xr);
    ticks(canvas, domain, xr, 325, [-0.4, -0.2, 0, 0.2, 0.4], (x) => x === 0 ? "0" : fmt(x, 1));
    line(canvas, zero, 23, zero, 314, {color: colors.ink, width: 2});
    entries.forEach((row, i) => {
      const y = 64 + i * 67, x = interpolate(row.coefficient_per_SD, domain, xr);
      descriptiveLabel(canvas, row.label, "", y);
      line(canvas, zero, y, x, y, {color: row.p_holm < 0.05 ? colors.jade : colors.soft, width: 4});
      const circle = svg("circle", {cx: x, cy: y, r: 8, stroke: colors.paper, "stroke-width": 2,
        fill: row.p_holm < 0.05 ? colors.jade : colors.gold});
      canvas.appendChild(circle);
      const detail = row.label + ": coeficiente ajustado " + fmt(row.coefficient_per_SD, 3) +
        ", p corregida por Holm " + fmt(row.p_holm, 6) +
        (row.p_holm < 0.05 ? ". Evidencia de asociación estadística." : ". Sin evidencia suficiente de asociación en este contraste.");
      interactive(circle, detail, tip);
      textNode(canvas, "p " + (row.p_holm < 0.001 ? row.p_holm.toExponential(1) : fmt(row.p_holm, 3)),
        864, y, {size: 12, weight: 650});
    });
    target.append(Object.assign(document.createElement("p"), {
      className: "figure-axis-note",
      textContent: "El eje horizontal representa coeficientes de una regresión diagnóstica, no efectos causales. El color identifica si p corregida es menor que 0.05; no son importancias del modelo final."
    }));
  }
  function forest(target, rows, highlighted) {
    const {canvas, tip, colors} = start(target, "Cambios del RMSE al quitar la concentración mensual de lluvia, con intervalos del 95 %", 395);
    const domain = [-0.30, 0.12], xr = [300, 835], zero = interpolate(0, domain, xr);
    ticks(canvas, domain, xr, 350, [-0.3, -0.2, -0.1, 0, 0.1], (x) => fmt(x, 1));
    line(canvas, zero, 27, zero, 339, {color: colors.ink, width: 2, dash: "5 5"});
    rows.forEach((row, i) => {
      const y = 66 + i * 72;
      const [low, high] = row.ci95;
      const x1 = interpolate(low, domain, xr), x2 = interpolate(high, domain, xr);
      const mid = interpolate(row.delta, domain, xr);
      const selected = highlighted === row.id, tint = selected ? colors.jade : colors.cool;
      if (selected) {
        canvas.appendChild(svg("rect", {x: 0, y: y - 26, width: 985, height: 53, rx: 5, fill: "#e3ece0"}));
        line(canvas, zero, y - 26, zero, y + 26, {color: colors.ink, width: 2, dash: "5 5"});
      }
      descriptiveLabel(canvas, row.label, row.groups + " grupos", y, 10);
      line(canvas, x1, y, x2, y, {color: tint, width: selected ? 5 : 3});
      line(canvas, x1, y - 10, x1, y + 10, {color: tint, width: 2});
      line(canvas, x2, y - 10, x2, y + 10, {color: tint, width: 2});
      const point = svg("circle", {cx: mid, cy: y, r: selected ? 10 : 8, fill: selected ? colors.forest : colors.gold,
        stroke: colors.paper, "stroke-width": 2});
      canvas.appendChild(point);
      interactive(point, row.label + ". Cambio RMSE sin índice menos con índice " + fmt(row.delta, 4) +
        " t/ha. Intervalo 95 % [" + fmt(low, 4) + ", " + fmt(high, 4) +
        "]. p ajustada " + fmt(row.p_holm, 4) + ".", tip);
      textNode(canvas, (row.delta > 0 ? "+" : "") + fmt(row.delta, 3),
        866, y - 3, {size: 15, weight: selected ? 800 : 600});
      textNode(canvas, "p=" + fmt(row.p_holm, 3), 866, y + 14, {size: 11, color: colors.muted});
    });
    target.append(Object.assign(document.createElement("p"), {
      className: "figure-axis-note",
      textContent: "A la izquierda de cero: menor error sin el índice. A la derecha: mayor error. Todos los intervalos incluyen el cero; ninguna diferencia supera Holm."
    }));
  }
  function intervals(target, rows, nominal) {
    const {canvas, tip, colors} = start(target, "Cobertura observada frente a cobertura nominal de los intervalos", 245);
    const domain = [0.5, 1.0], xr = [305, 835];
    ticks(canvas, domain, xr, 206, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], (x) => Math.round(x * 100) + "%");
    const nom = interpolate(nominal, domain, xr);
    line(canvas, nom, 25, nom, 194, {color: colors.gold, width: 3, dash: "6 5"});
    rows.forEach((row, i) => {
      const y = 75 + i * 80;
      const label = row.model === "Reference26" ? "Clima, vecinos y geología" : "Clima y vecinos, sin geología";
      descriptiveLabel(canvas, label, "Anchura media: " + fmt(row.width, 3) + " t/ha", y);
      const x = interpolate(row.coverage, domain, xr);
      const point = svg("circle", {cx: x, cy: y, r: 9, fill: i ? colors.forest : colors.jade,
        stroke: colors.paper, "stroke-width": 2});
      canvas.appendChild(point);
      interactive(point, label + ": cobertura observada " + fmt(row.coverage * 100, 2) +
        " %. Nivel nominal " + fmt(nominal * 100, 0) + "%. Anchura media " +
        fmt(row.width, 3) + " t/ha.", tip);
      textNode(canvas, fmt(row.coverage * 100, 1) + " %", 865, y, {size: 15, weight: 750});
    });
    target.append(Object.assign(document.createElement("p"), {
      className: "figure-axis-note",
      textContent: "Línea mostaza: cobertura nominal. Círculos: cobertura observada en evaluación aleatoria. No es una garantía para las 59 parcelas."
    }));
  }
  function distribution(target, rows) {
    const {canvas, tip, colors} = start(target,
      "Resumen de rendimientos observados y rendimientos estimados por estado: mediana e intervalos entre percentiles", 570, 780);
    const xr = [280, 854], domain = [1.5, 6.0];
    ticks(canvas, domain, xr, 521, [2, 3, 4, 5, 6], (x) => fmt(x, 0));
    const regions = [{id:"all", name:"Las tres entidades"}, {id:"Hidalgo",name:"Hidalgo"},
      {id:"Puebla",name:"Puebla"}, {id:"Tlaxcala",name:"Tlaxcala"}];
    regions.forEach((region, i) => {
      const top = 84 + i * 109;
      if (i) line(canvas, 10, top - 47, 980, top - 47, {color: colors.rule});
      textNode(canvas, region.name, 15, top, {size: 15, weight: 750});
      const group = rows.filter((row) => row.region === region.id);
      for (const [index, kind, label, color] of [[0, "Observed138", "Cosechas conocidas", colors.jade],
        [1, "Predicted59", "Estimaciones del modelo", colors.gold]]) {
        const row = group.find((x) => x.cohort === kind);
        if (!row) continue;
        const y = top - 20 + index * 34;
        const x10 = interpolate(row.p10, domain, xr), x90 = interpolate(row.p90, domain, xr);
        const x25 = interpolate(row.q25, domain, xr), x75 = interpolate(row.q75, domain, xr);
        const median = interpolate(row.median, domain, xr);
        line(canvas, x10, y, x90, y, {color, width: 3});
        line(canvas, x25, y, x75, y, {color, width: 12});
        const dot = svg("circle", {cx: median, cy: y, r: 8, fill: colors.paper, stroke: color, "stroke-width": 3});
        canvas.appendChild(dot);
        interactive(dot, region.name + ", " + label.toLowerCase() + ": " + row.n +
          " parcelas, mediana " + fmt(row.median, 3) + " t/ha; entre percentiles 25–75 [" +
          fmt(row.q25, 3) + ", " + fmt(row.q75, 3) + "]; entre 10–90 [" +
          fmt(row.p10, 3) + ", " + fmt(row.p90, 3) + "].", tip);
        textNode(canvas, label, 876, y, {size: 10, color: colors.muted});
      }
    });
    target.append(Object.assign(document.createElement("p"), {
      className: "figure-axis-note",
      textContent: "La línea fina marca los percentiles 10 y 90; la gruesa, 25 y 75; el círculo es la mediana. Son grupos de parcelas distintos, no errores de predicción. Eje en t/ha."
    }));
  }
  function rainfall(target, values) {
    const {canvas, tip, colors} = start(target, "Distribución ficticia de 210 mm de lluvia entre abril y octubre", 290, 610);
    const months = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"];
    const domain = [0, 150], bottom = 233, top = 26;
    for(const mm of [0, 50, 100, 150]) {
      const y = interpolate(mm, domain, [bottom, top]);
      line(canvas, 83, y, 958, y, {color: colors.rule});
      textNode(canvas, mm + " mm", 14, y, {size: 11, color: colors.muted});
    }
    values.forEach((value, i) => {
      const x = 116 + i * 122, y = interpolate(value, domain, [bottom, top]);
      const height = bottom - y;
      const bar = svg("rect", {x, y, width: 72, height, rx: 4,
        fill: i < 3 ? colors.jade : colors.gold});
      canvas.append(bar);
      interactive(bar, months[i] + ": " + value + " mm de lluvia ficticia.", tip);
      textNode(canvas, value + " mm", x + 36, Math.max(y - 10, 12), {size: 12, weight: 740, anchor: "middle"});
      textNode(canvas, months[i], x + 36, 251, {size: 12, anchor: "middle"});
    });
  }
  global.GeoCharts = Object.freeze({models, performance, ablations, r3, expertWeights, coefficients, forest, intervals, distribution, rainfall});
})(window);
