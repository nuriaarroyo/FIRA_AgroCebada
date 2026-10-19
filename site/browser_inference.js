/* All 59 archived predictions and new-parcel inference run in the visitor's browser.
   Fail closed: nothing is identified as "real" without a 59-parcel Python parity
   check on the exported, hash-verified fitted Reference26 coefficients. */
"use strict";
(() => {
  const $=selector=>document.querySelector(selector);
  let runtime=null;
  const status=$("#api-status");
  const own=$("#predict-real");
  const original=$("#predict-existing");
  function text(node,value){node.textContent=value;}
  function ready(value){
    own.disabled=!value?.geography.new_parcels_supported;
    original.disabled=!value;
  }
  function sourceFeatures(){
    const inputs=[...document.querySelectorAll("#parcel-input-groups input[name]")];
    if(inputs.length!==26)throw Error("Todavía no aparecen los 26 indicadores.");
    const values={};
    for(const node of inputs){
      const raw=node.value.trim();
      if(raw===""){values[node.name]=null;continue;}
      const n=Number(raw);
      if(!Number.isFinite(n))throw Error("Valor no numérico: "+node.name);
      if(node.min!=="" && n<Number(node.min))throw Error("Fuera del mínimo: "+node.name);
      if(node.max!=="" && n>Number(node.max))throw Error("Fuera del máximo: "+node.name);
      values[node.name]=n;
    }
    return values;
  }
  async function initialize(){
    ready(null);
    try{
      text(status,"Cargando el modelo final, que se ejecutará únicamente en este navegador…");
      const response=await fetch("./data/reference26_runtime.json",{cache:"no-store"});
      if(!response.ok)throw Error("Falta exportar y publicar el archivo de inferencia del modelo.");
      const value=await response.json();
      const verification=window.Reference26Browser.parity(value,1e-7);
      runtime=value;
      ready(runtime);
      text(status,"Reference26 cargado y verificado en tu computadora. Reproducidas "+
        verification.tested+" de 59 estimaciones (diferencia máxima "+
        verification.max_abs_difference.toExponential(2)+" t/ha). "+
        (runtime.geography.new_parcels_supported ?
          "Puedes introducir las 26 variables de una parcela nueva." :
          "La geometría de parcelas nuevas todavía no está verificada."));
    } catch (error) {
      text(status,"El motor local todavía no está disponible: "+error.message+
        " Puedes usar las simulaciones educativas y preparar los datos en JSON.");
    }
  }
  own.addEventListener("click",()=>{
    const output=$("#live-result");output.replaceChildren();
    if(!runtime)return text(output,"Primero debe cargarse el motor local verificado.");
    try{
      const values=sourceFeatures();
      const result=window.Reference26Browser.run(runtime,values);
      const top=document.createElement("strong");
      top.textContent=result.predicted_t_ha.toFixed(3)+" t/ha";
      const msg=document.createElement("p");
      msg.textContent="Referencia geológica: grupo "+result.geology_group+
        ". Estimación climática "+result.climate.toFixed(3)+
        " t/ha; experto local "+result.expert.toFixed(3)+
        " t/ha; peso de vecino "+(100*result.local_weight).toFixed(1)+
        " %; corrección residual "+result.residual_adjustment.toFixed(3)+" t/ha. "+
        (result.has_r3_support?"El corrector dispone de los tres indicadores.":
          "El corrector residual se desactivó por falta de soporte.")+
        " Calculado en tu navegador con los parámetros finales (138 cosechas).";
      output.append(top,msg);
    } catch(error) {
      text(output,"No fue posible calcular con este modelo: "+error.message);
    }
  });
  original.addEventListener("click",()=>{
    const output=$("#existing-result");
    const id=$("#existing-id").value.trim();
    if(!runtime)return text(output,"El modelo todavía no se ha cargado.");
    const match=runtime.existing_59.find(x=>x.id===id);
    if(!match)return text(output,"Ese identificador no corresponde a una de las 59 parcelas de evaluación.");
    try{
      const result=window.Reference26Browser.run(runtime,match.x,match.distances);
      const discrepancy=Math.abs(result.predicted_t_ha-match.expected);
      if(discrepancy>1e-7)throw Error("No coincide con Python; se bloqueó la predicción.");
      text(output,"Predicción original de "+id+": "+result.predicted_t_ha.toFixed(4)+
        " t/ha. Resultado calculado localmente con el modelo entrenado.");
    }catch(error){text(output,"La comprobación de esa parcela falló: "+error.message);}
  });
  const trigger=$("#api-check");
  if(trigger){trigger.textContent="Volver a verificar el modelo local";trigger.addEventListener("click",initialize);}
  initialize();
})();
