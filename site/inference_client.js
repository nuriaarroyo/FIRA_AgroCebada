/* GitHub Pages -> public FastAPI. No fabricated predictions and no leaked labels.
 * The 26 entered values are sent only after explicit user click.
 */
"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const status = $("#api-status");
  const ownButton = $("#predict-real");
  const existingButton = $("#predict-existing");
  const apiInput = $("#api-override");
  let activeBase = "";
  let modelInfo = null;

  function baseUrl(value) {
    const raw = String(value || "").trim().replace(/\/+$/, "");
    if (!raw) return "";
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw Error("Introduce sólo la dirección principal del servicio, sin ruta ni credenciales.");
    if (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      throw Error("La API pública debe utilizar HTTPS.");
    return url.origin;
  }
  async function fetchJson(path, options) {
    const response = await fetch(activeBase + path, {cache: "no-store", ...options});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      let detail = typeof data.detail === "string" ? data.detail : "La API no respondió correctamente.";
      if(response.status === 503)detail += " Comprueba que los tres archivos del modelo están disponibles.";
      throw Error(detail);
    }
    return data;
  }
  async function connect(raw) {
    ownButton.disabled = true;
    existingButton.disabled = true;
    modelInfo = null;
    try {
      activeBase = baseUrl(raw);
      if (!activeBase) {
        status.textContent = "El servicio aún no está configurado. La página sigue disponible para simulaciones y descarga de indicadores.";
        return;
      }
      status.textContent = "Comprobando la reproducción del modelo final…";
      const data = await fetchJson("/api/health");
      if (!data.ready || data.model !== "Reference26" || data.reproduced_59_aggregate !== true)
        throw Error(data.error || "La API no confirmó el modelo final ni la reproducción de las 59 estimaciones.");
      modelInfo = data;
      ownButton.disabled = !data.new_parcels_supported;
      existingButton.disabled = false;
      status.textContent = data.new_parcels_supported
        ? "Servicio conectado: Reference26 auténtico, 138 cosechas de entrenamiento y paridad verificada para las 59 estimaciones. Se admiten parcelas nuevas."
        : "Servicio conectado y verificado para las 59 parcelas originales. La predicción de parcelas nuevas está bloqueada hasta validar la geometría.";
    } catch (error) {
      status.textContent = "No se pudo conectar: " + error.message;
    }
  }

  $("#api-check").addEventListener("click", () => connect(apiInput.value));

  async function send(path, payload) {
    return fetchJson(path, {method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)});
  }
  ownButton.addEventListener("click", async () => {
    const result = $("#live-result");
    result.textContent = "";
    if (!modelInfo?.new_parcels_supported) {
      result.textContent = "La API no confirmó que pueda recibir nuevas parcelas.";
      return;
    }
    const inputs = [...document.querySelectorAll("#parcel-input-groups input[name]")];
    if (inputs.length !== 26) {
      result.textContent = "No se ha cargado el inventario completo de 26 variables.";
      return;
    }
    const values = {};
    for (const field of inputs) {
      const raw = field.value.trim();
      const n = Number(raw);
      if(raw !== "" && (!Number.isFinite(n) ||
        (field.min !== "" && n < Number(field.min)) ||
        (field.max !== "" && n > Number(field.max)))) {
        result.textContent = "Hay valores numéricos fuera de rango. Revisa " + field.name;
        return;
      }
      values[field.name] = raw === "" ? null : n;
    }
    if(values.base_centroid_lat == null || values.base_centroid_lon == null) {
      result.textContent = "Para calcular distancias geográficas reales debes introducir la latitud y la longitud.";
      return;
    }
    ownButton.disabled = true;
    result.textContent = "Calculando con los regresores entrenados…";
    try {
      const response = await send("/api/predict", {features: values});
      if (!response.is_real_model || response.model !== "Reference26" ||
        !Number.isFinite(response.predicted_t_ha))
        throw Error("La respuesta no corresponde a Reference26.");
      result.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = response.predicted_t_ha.toFixed(3) + " t/ha";
      result.append(heading);
      const note = document.createElement("p");
      note.textContent = "Predicción calculada por Reference26 entrenado con las 138 cosechas. " +
        (response.notes || []).join(" ");
      result.append(note);
    } catch (error) {
      result.textContent = "No se pudo obtener la predicción real: " + error.message;
    } finally {
      ownButton.disabled = !modelInfo?.new_parcels_supported;
    }
  });
  existingButton.addEventListener("click", async () => {
    const node = $("#existing-result");
    const parcel_id = $("#existing-id").value.trim();
    if (!parcel_id) {
      node.textContent = "Introduce el ID exacto de una de las 59 parcelas.";
      return;
    }
    node.textContent = "Consultando la estimación archivada…";
    existingButton.disabled = true;
    try {
      const result = await send("/api/predict-existing", {parcel_id});
      if (!result.is_real_model || !Number.isFinite(result.predicted_t_ha))
        throw Error("Respuesta no verificada.");
      node.textContent = "Rendimiento estimado de " + parcel_id + ": " +
        result.predicted_t_ha.toFixed(4) + " t/ha (modelo real Reference26).";
    } catch (error) {
      node.textContent = "No se obtuvo la estimación: " + error.message;
    } finally {
      existingButton.disabled = modelInfo === null;
    }
  });
  fetch("./data/inference_config.json", {cache: "no-store"})
    .then(response => {
      if(!response.ok) throw Error("Falta la configuración de inferencia.");
      return response.json();
    })
    .then(config => {
      const base = config.api_base_url || "";
      if (base) apiInput.value = base;
      return connect(base);
    })
    .catch(error => {
      status.textContent = "No se pudo leer la configuración de la API: " + error.message;
    });
})();
