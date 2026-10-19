/* Predicciones ilustrativas (no inferencia) y preparación local de 26 variables.
   No ejecuta el modelo entrenado; no envía datos a servidores. */
"use strict";
(() => {
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  const codeName = "Reference26";
  const presets = [
    {name: "Parcela de clima y terreno moderados",c:4.10,e:4.55,k:0,d:0.10,support:true},
    {name: "Parcela con estimación local alta",c:3.55,e:4.75,k:3,d:-0.12,support:true},
    {name: "Parcela sin soporte para corrección",c:4.50,e:4.00,k:1,d:0.20,support:false}
  ];
  const make = (tag,className,text) => {
    const e = document.createElement(tag);
    if(className)e.className = className;
    if(text !== undefined)e.textContent = text;
    return e;
  };
  const setPressed = (selector,attribute,value) => {
    $$(selector).forEach(b=>{
      const yes=b.dataset[attribute]===value;
      b.classList.toggle("active",yes);
      b.setAttribute("aria-pressed",String(yes));
    });
  };
  $$("[data-predmode]").forEach(b=>b.addEventListener("click",()=>{
    const mode=b.dataset.predmode;
    setPressed("[data-predmode]","predmode",mode);
    $("#fictitious-mode").hidden=mode!=="fictitious";
    $("#own-mode").hidden=mode!=="own";
  }));
  let model;
  function calculate(){
    if(!model)return;
    const c=Number($("#parcel-climate").value), e=Number($("#parcel-local").value);
    const k=Number($("#parcel-geogroup").value),delta=Number($("#parcel-delta").value);
    const support=$("#parcel-r3").checked;
    const valid=[$("#parcel-climate").value,$("#parcel-local").value,
      $("#parcel-delta").value].every(x=>x.trim()!=="") &&
      Number.isFinite(c)&&Number.isFinite(e)&&Number.isFinite(delta) &&
      c>=0&&c<=12&&e>=0&&e<=12&&delta>=-.25&&delta<=.25 &&
      Number.isInteger(k)&&k>=0&&k<4;
    const result=$("#parcel-estimate"),description=$("#parcel-breakdown");
    if(!valid){
      result.textContent="—";
      description.textContent="Introduce estimaciones de 0 a 12 y una corrección entre −0.25 y 0.25 t/ha.";
      $("#parcel-status").textContent="Los valores están fuera de sus rangos ilustrativos.";
      return;
    }
    const g=model.final_fit.cluster_weights[k];
    const {base,correction,predictedExample:total}=window.ParcelMath.combine(c,e,g,delta,support);
    result.textContent=total.toFixed(3);
    description.textContent="Primero se combinan "+c.toFixed(2)+" t/ha de clima y "+
      e.toFixed(2)+" t/ha de la regresión local. El grupo "+k+
      " aporta un peso local de "+(g*100).toFixed(2)+" %. La mezcla es "+
      base.toFixed(3)+" t/ha. La corrección "+(support?"añade ":"se desactiva; añade ")+
      (correction>=0?"+":"")+correction.toFixed(2)+" t/ha.";
    const segments=$$("#parcel-mixbar span");
    segments[0].style.width=((1-g)*100).toFixed(2)+"%";
    segments[1].style.width=(g*100).toFixed(2)+"%";
    $("#parcel-mixbar").setAttribute("aria-label",
      ((1-g)*100).toFixed(1)+" % clima, "+(g*100).toFixed(1)+" % estimación local");
    $("#parcel-status").textContent="Cálculo matemático ilustrativo con entradas ficticias. "+
      "No procede de los coeficientes de Elastic Net y Ridge del modelo entrenado.";
  }
  function choosePreset(i){
    const p=presets[i];
    $("#parcel-climate").value=p.c;
    $("#parcel-local").value=p.e;
    $("#parcel-geogroup").value=p.k;
    $("#parcel-delta").value=p.d;
    $("#parcel-r3").checked=p.support;
    setPressed("[data-preset]","preset",String(i));
    calculate();
  }
  function presetsMenu(){
    const root=$("#fictional-presets");
    presets.forEach((p,i)=>{
      const b=make("button","fictional-choice",p.name);
      b.type="button";b.dataset.preset=String(i);
      b.setAttribute("aria-pressed",String(i===0));
      b.addEventListener("click",()=>choosePreset(i));
      root.append(b);
    });
    choosePreset(0);
  }
  ["parcel-climate","parcel-local","parcel-delta","parcel-geogroup","parcel-r3"].forEach(id=>{
    $("#"+id).addEventListener("input",()=>{
      setPressed("[data-preset]","preset","__manual");
      calculate();
    });
  });

  const inputMap=new Map();
  const featureInput = (feature) => {
    const label=make("label","feature-field");
    const name=make("span","",feature.name+" ("+feature.number+"/26)");
    const input=make("input");
    input.type="number";
    input.step="any";
    input.inputMode="decimal";
    input.placeholder="Dato no disponible";
    input.name=feature.code;
    input.setAttribute("aria-label",feature.name+"; "+feature.code);
    // Raw geologic shares are always proportions in [0,1].
    if(feature.number>=14&&feature.number<=23){input.min="0";input.max="1";}
    if(feature.number===25){input.min="0";input.max="1";}
    if(feature.number===3||feature.number===2){input.min="0";input.max="1";}
    input.addEventListener("input",updateCompleteness);
    const note=make("small","",feature.code);
    label.append(name,input,note);
    inputMap.set(feature.code,input);
    return label;
  };
  function ownForm(){
    const root=$("#parcel-input-groups");
    for(const block of model.features){
      const details=make("details","own-feature-group");
      if(block.key==="clima")details.open=true;
      const summary=make("summary","",block.title+" · "+block.count+" indicadores");
      const intro=make("p","",block.why);
      const inner=make("div","feature-field-grid");
      for(const feature of block.features)inner.append(featureInput(feature));
      details.append(summary,intro,inner);
      root.append(details);
    }
    updateCompleteness();
  }
  function readInputs(){
    const values={};
    for(const [code,input] of inputMap){
      const raw=input.value.trim();
      const n=raw===""?null:Number(raw);
      values[code]=n !== null && Number.isFinite(n)?n:null;
    }
    return values;
  }
  function updateCompleteness(){
    if(!model)return;
    const values=readInputs();
    let count=0,invalid=0;
    for(const [key,input] of inputMap){
      const val=values[key];
      if(val===null){
        if(input.value.trim()!=="")invalid++;
        input.classList.toggle("input-invalid",input.value.trim()!=="");
        continue;
      }
      const tooLow=input.min!==""&&val<Number(input.min);
      const tooHigh=input.max!==""&&val>Number(input.max);
      const bad=tooLow||tooHigh;
      input.classList.toggle("input-invalid",bad);
      if(bad)invalid++;else count++;
    }
    $("#parcel-completeness").textContent=count+" de 26 variables con valores válidos"+
      (invalid?"; "+invalid+" fuera de rango":"");
    const r3=model.features.find(b=>b.key==="correccion").features.map(f=>f.code);
    const ready=r3.every(k=>values[k]!==null&&!inputMap.get(k).classList.contains("input-invalid"));
    $("#own-r3-status").textContent=ready?"Tres indicadores R3 presentes":"Faltan uno o más indicadores R3: se desactivaría la corrección";
    $("#parcel-export").disabled=invalid>0;
  }
  $("#parcel-clear").addEventListener("click",()=>{
    inputMap.forEach(input=>{input.value="";input.classList.remove("input-invalid");});
    updateCompleteness();
  });
  $("#parcel-export").addEventListener("click",()=>{
    const values=readInputs();
    const packet={
      schema_version:1,model_code:codeName,
      record_type:"feature_input_only_not_a_prediction",
      n_features:26,features:values,
      note:"Valores de una parcela proporcionados por la persona usuaria. No son predicciones ni resultados del modelo."
    };
    const blob=new Blob([JSON.stringify(packet,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const anchor=make("a");
    anchor.href=url;anchor.download="parcela_indicadores_26.json";
    document.body.append(anchor);anchor.click();anchor.remove();
    URL.revokeObjectURL(url);
  });
  const referenceSlider=$("#yield-reference");
  function percentage(){
    const value=Number(referenceSlider.value)/100;
    $("#yield-reference-value").textContent=value.toFixed(1)+" t/ha";
    $("#yield-scale-percent").textContent=window.ParcelMath.relativeRmse(0.468186,value).toFixed(2)+" %";
  }
  referenceSlider.addEventListener("input",percentage);
  percentage();
  fetch("./data/model.json",{cache:"no-store"}).then(r=>{
    if(!r.ok)throw Error("Archivo de documentación del modelo no disponible");
    return r.json();
  }).then(data=>{
    if(!data.features||data.features.flatMap(x=>x.features).length!==26 ||
      data.final_fit.cluster_weights.length!==4)throw Error("Modelo documental incompleto");
    model=data;
    presetsMenu();
    ownForm();
  }).catch(err=>{
    console.error(err);
    $("#parcel-status").textContent="No se pudo cargar el archivo documental de la mezcla.";
    $("#parcel-input-groups").textContent="No se pudo cargar el inventario de variables.";
  });
})();