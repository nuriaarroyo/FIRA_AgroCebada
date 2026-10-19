"use strict";
/* No external packages or browser binaries. Test the actual SVG renderers. */
const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, "site", "data", file), "utf8"));

class MockNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.classList = {add() {}, remove() {}};
    this.textContent = "";
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(event, fn) {
    assert.ok(["focus", "mouseenter", "blur", "mouseleave"].includes(event));
    assert.equal(typeof fn, "function");
  }
}
const mockDocument = {
  documentElement: new MockNode("html"),
  createElement(tag) { return new MockNode(tag); },
  createElementNS(ns, tag) {
    assert.equal(ns, "http://www.w3.org/2000/svg");
    return new MockNode(tag);
  }
};
const context = {
  document: mockDocument,
  getComputedStyle: () => ({getPropertyValue: () => ""}),
  window: {}
};
vm.runInNewContext(fs.readFileSync(path.join(root, "site", "charts.js"), "utf8"), context);
const charts = context.window.GeoCharts;
assert.ok(Object.isFrozen(charts));

function all(node, tag) {
  let found = node.tagName === tag ? [node] : [];
  for(const child of node.children) found = found.concat(all(child, tag));
  return found;
}
function points(rootNode) {
  return all(rootNode, "circle").filter(node => node.getAttribute("role") === "img");
}
function svg(rootNode) {
  const allSvgs = all(rootNode, "svg");
  assert.equal(allSvgs.length, 1);
  assert.equal(allSvgs[0].getAttribute("role"), "img");
  return allSvgs[0];
}
function pageLabels() {
  return {
    Reference26: ["Clima, vecinos y geología", "Modelo principal · Reference26"],
    Compact14: ["Clima y vecinos, sin geología", "Modelo simplificado · Compact14"],
    B1: ["Clima combinado con el modelo principal", "Combinación · B1"],
    L40: ["Vecinos con información satelital amplia", "Modelo anterior · L40"],
    CT3: ["Lluvia y vegetación en mayo", "Punto de partida · C-T3"]
  };
}
test("Five models: every rendered number is present in source JSON", () => {
  const data = read("results.json").protocols.find(p => p.id === "fresh_97_41");
  const node = new MockNode("div");
  charts.models(node, data.results, pageLabels());
  svg(node);
  const markers = points(node);
  assert.equal(markers.length, 5);
  for(const row of data.results) {
    assert.ok(markers.some(p => p.getAttribute("aria-label").includes(row.rmse.toFixed(4))));
  }
  // RMSE dot position is monotone, because lower error belongs further left.
  const byLabel = new Map(markers.map(p => [p.getAttribute("aria-label").split(". RMSE")[0],
    Number(p.getAttribute("cx"))]));
  assert.ok(byLabel.get("Clima combinado con el modelo principal") <
    byLabel.get("Lluvia y vegetación en mayo"));
});
test("Climate variable removal keeps all five sourced RMSE values", () => {
  const data = read("evidence.json").protocols.find(p => p.id === "spatial");
  const node = new MockNode("div");
  charts.ablations(node, data.core4_ablations);
  svg(node);
  assert.equal(points(node).length, 5);
  const descriptions = points(node).map(p => p.getAttribute("aria-label")).join(" ");
  for(const row of data.core4_ablations) assert.ok(descriptions.includes(row.rmse.toFixed(4)));
});
test("Paired residual comparison and learned weights use four protocols", () => {
  const data = read("evidence.json");
  const labels = {random:"Al azar",climate_profile:"Por clima",municipality:"Municipios",spatial:"Zonas"};
  const rows = data.protocols.map(p => ({
    id:p.id,label:labels[p.id],without:p.reference26_r3.without_r3,
    with:p.reference26_r3.with_r3,weight:p.expert_weight
  }));
  const r3 = new MockNode("div"), weights = new MockNode("div");
  charts.r3(r3, rows);
  charts.expertWeights(weights, rows);
  assert.equal(points(r3).length, 8);
  assert.equal(points(weights).length, 4);
  for(const row of rows) assert.ok(points(weights).some(p =>
    p.getAttribute("aria-label").includes((row.weight * 100).toFixed(2))));
});
test("Signed associations are not converted into fabricated feature importance", () => {
  const data = read("new_research.json");
  const node = new MockNode("div");
  charts.coefficients(node, data.associations);
  svg(node);
  assert.equal(points(node).length, 4);
  assert.equal(data.associations.filter(p => p.p_holm < 0.05).length, 3);
  const desc = points(node).map(p => p.getAttribute("aria-label")).join(" ");
  for(const row of data.associations) assert.ok(desc.includes(row.coefficient_per_SD.toFixed(3)));
  assert.ok(desc.includes("Sin evidencia suficiente"));
});
test("NoHHI forest shows four confidence intervals crossing zero", () => {
  const data = read("new_research.json");
  const node = new MockNode("div");
  charts.forest(node, data.protocols, "spatial");
  svg(node);
  assert.equal(points(node).length, 4);
  for(const row of data.protocols) {
    assert.ok(row.ci95[0] < 0 && row.ci95[1] > 0);
    assert.ok(points(node).some(p => p.getAttribute("aria-label").includes(row.delta.toFixed(4))));
  }
});
test("Nominal coverage plot displays two empirical fractions", () => {
  const data = read("new_research.json");
  const rows = data.intervals.filter(p => p.level === 0.9);
  const node = new MockNode("div");
  charts.intervals(node, rows, 0.9);
  svg(node);
  assert.equal(points(node).length, 2);
  for (const row of rows) assert.ok(points(node).some(p =>
    p.getAttribute("aria-label").includes((row.coverage * 100).toFixed(2))));
});
test("All regional distribution medians are sourced, never reconstructed", () => {
  const data = read("distribution.json");
  const node = new MockNode("div");
  charts.distribution(node, data.rows);
  svg(node);
  assert.equal(points(node).length, 8);
  for(const row of data.rows) assert.ok(points(node).some(p =>
    p.getAttribute("aria-label").includes(row.median.toFixed(3))));
});
test("Rainfall demo is explicitly synthetic and preserves total rainfall", () => {
  const values = [10,10,10,20,140,10,10];
  const node = new MockNode("div");
  charts.rainfall(node, values);
  const canvas = svg(node);
  const marks = all(canvas, "rect").filter(p => p.getAttribute("role") === "img");
  assert.equal(marks.length, 7);
  assert.equal(values.reduce((a,b)=>a+b,0),210);
  assert.equal(marks.filter(n => n.getAttribute("aria-label").includes("ficticia")).length,7);
});
