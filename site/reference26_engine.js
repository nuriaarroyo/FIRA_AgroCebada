/* Reference26 browser inference.
   Deterministic port of the saved sklearn (ElasticNet/transformers/KMeans)
   and the 24-neighbor weighted local Ridge sufficient-statistics solver.
   No CDN, no Python, no training, no server, no invented coefficients.
*/
(function (global) {
  "use strict";
  const finite = Number.isFinite;
  function check(ok,message) {if(!ok)throw Error(message);}
  function num(v) {return v === null || v === undefined || v === "" ? NaN : Number(v);}
  function clip(x,a,b){return Math.max(a,Math.min(b,x));}
  function dot(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
  function transform(x,recipe) {
    const output=[];
    const support=recipe.support||recipe.inner_support;
    const cols=recipe.cols;
    for(let j=0;j<cols.length;j++) {
      if(!support[j])continue;
      let value=num(x[cols[j]]);
      if(!finite(value))value=recipe.median[j];
      output.push((value-recipe.mean[j])/recipe.scale[j]);
    }
    return output;
  }
  function linear(x,model) {
    const z=transform(x,model.transform);
    check(z.length===model.coef.length,"Dimensiones inconsistentes en Elastic Net.");
    return model.intercept+dot(z,model.coef);
  }
  function geology(x,model) {
    const z=[];
    for(let i=0;i<model.columns.length;i++){
      let v=num(x[model.columns[i]]);
      if(!finite(v))v=model.medians[i];
      check(v>=-1e-7 && v<=1+1e-7,"Las participaciones geológicas deben estar entre cero y uno.");
      z.push((Math.sqrt(clip(v,0,1))-model.mean[i])/model.scale[i]/model.norm);
    }
    let nearest=Infinity,label=-1;
    for(let k=0;k<model.centers.length;k++){
      const d=model.centers[k].reduce((a,c,i)=>a+(z[i]-c)*(z[i]-c),0);
      if(d<nearest){nearest=d;label=k;}
    }
    check(label>=0 && finite(model.weights[label]),"K-means no pudo asignar el terreno.");
    return {cluster:label,weight:model.weights[label]};
  }
  function standardized(x,rep) {
    const out=[];
    for(let i=0;i<rep.cols.length;i++){
      if(!rep.support[i])continue;
      let value=num(x[rep.cols[i]]);
      if(!finite(value))value=rep.med[i];
      out.push((value-rep.mean[i])/rep.scale[i]);
    }
    return out;
  }
  // Solve (X^T W X + alpha I) beta = X^T W (y - weighted_mean_y),
  // with X centered at its weighted mean (same sufficient stats as Python).
  function solve(A,b) {
    const n=b.length;
    const L=Array.from({length:n},()=>new Float64Array(n));
    for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
      let val=A[i][j];
      for(let k=0;k<j;k++)val-=L[i][k]*L[j][k];
      if(i===j){
        check(val>0&&finite(val),"La matriz Ridge no es definida positiva.");
        L[i][j]=Math.sqrt(val);
      }else L[i][j]=val/L[j][j];
    }
    const y=new Float64Array(n),x=new Float64Array(n);
    for(let i=0;i<n;i++){
      let v=b[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];
      y[i]=v/L[i][i];
    }
    for(let i=n-1;i>=0;i--){
      let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];
      x[i]=v/L[i][i];
    }
    return x;
  }
  function ridge(x,distances,local) {
    check(Array.isArray(distances)&&distances.length>=138,"Se requieren 138 distancias del entrenamiento.");
    const candidates=local.train_positions.map((v,j)=>({i:Number(v), d:num(distances[Number(v)]), y:local.targets[j]}))
      .filter(a=>finite(a.d)).sort((a,b)=>a.d-b.d);
    if(candidates.length<3) {
      return local.targets.reduce((a,b)=>a+b,0)/local.targets.length;
    }
    const chosen=candidates.slice(0,Math.min(local.neighbors,candidates.length));
    const n=x.length;
    check(n===local.standardized[0].length,"La representación local no coincide.");
    let sum=0, ym=0;
    const xm=new Float64Array(n);
    for(const c of chosen){
      const w=1/(c.d+1e-6);
      check(w>0&&finite(w),"Distancia local no positiva.");
      c.w=w;sum+=w;ym+=w*c.y;
      const z=local.standardized[c.i];
      for(let j=0;j<n;j++)xm[j]+=w*z[j];
    }
    ym/=sum;
    for(let j=0;j<n;j++)xm[j]/=sum;
    const A=Array.from({length:n},()=>new Float64Array(n));
    const b=new Float64Array(n);
    for(const c of chosen){
      const z=local.standardized[c.i];
      for(let j=0;j<n;j++){
        const dz=z[j]-xm[j];
        b[j]+=c.w*dz*(c.y-ym);
        for(let k=0;k<=j;k++)A[j][k]+=c.w*dz*(z[k]-xm[k]);
      }
    }
    for(let j=0;j<n;j++){
      for(let k=0;k<j;k++)A[k][j]=A[j][k];
      A[j][j]+=local.ridge_alpha;
    }
    const coef=solve(A,b);
    const intercept=ym-dot(xm,coef);
    return intercept+dot(x,coef);
  }
  function haversineDistances(x,geography) {
    check(geography.new_parcels_supported&&finite(geography.km_per_unit),
      "No se verificó la escala geográfica necesaria para parcelas nuevas.");
    const lat=num(x.base_centroid_lat),lon=num(x.base_centroid_lon);
    check(finite(lat)&&finite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180,
      "Para una parcela nueva se necesitan latitud y longitud válidas.");
    const r=Math.PI/180, la=lat*r,lo=lon*r;
    return geography.train_coords.map(([a,b])=>{
      const phi=a*r,lam=b*r;
      const h=Math.pow(Math.sin((la-phi)/2),2)+
        Math.cos(phi)*Math.cos(la)*Math.pow(Math.sin((lo-lam)/2),2);
      return geography.earth_radius_km*2*Math.asin(Math.sqrt(clip(h,0,1))) /
        geography.km_per_unit;
    });
  }
  function correction(x,cfg) {
    for(const key of cfg.cols){
      if(!finite(num(x[key])))return {enabled:false,value:0};
    }
    const z=[];
    for(let j=0;j<cfg.cols.length;j++){
      if(!cfg.support[j])continue;
      let value=num(x[cfg.cols[j]]);
      if(!finite(value))value=cfg.med[j];
      z.push((value-cfg.mean[j])/cfg.scale[j]);
    }
    const inner=[];
    for(let i=0;i<z.length;i++){
      if(!cfg.inner_support[i])continue;
      let v=z[i];
      if(!finite(v))v=cfg.inner_median[i];
      inner.push((v-cfg.inner_mean[i])/cfg.inner_scale[i]);
    }
    check(inner.length===cfg.coef.length,"Error en las tres señales de R3.");
    const raw=cfg.intercept+dot(inner,cfg.coef);
    return {enabled:true,value:cfg.strength*cfg.amplitude*clip(raw,-cfg.clip,cfg.clip)};
  }
  function run(runtime,x,distances) {
    check(runtime?.schema_version===1&&runtime.model==="Reference26","Modelo no reconocido.");
    check(runtime.local?.targets?.length===138,"El modelo local requiere 138 cosechas.");
    const expected=runtime.feature_names;
    check(expected.length===26,"El modelo no contiene las 26 entradas.");
    for(const key of Object.keys(x)){
      check(expected.includes(key),"Indicador desconocido: "+key);
    }
    const c=linear(x,runtime.climate);
    const r=runtime.local;
    const z=standardized(x,r);
    const d=distances||haversineDistances(x,runtime.geography);
    const local=ridge(z,d,r);
    const adjustment=linear(x,runtime.internal)*runtime.internal.amplitude;
    const expert=local+adjustment;
    const group=geology(x,runtime.geology);
    const blended=c+group.weight*(expert-c);
    const residual=correction(x,runtime.correction);
    const y=blended+residual.value;
    check(finite(y),"La predicción del modelo no es un número finito.");
    return {predicted_t_ha:y,model:"Reference26",climate:c,local,
      internal_adjustment:adjustment,expert,geology_group:group.cluster,
      local_weight:group.weight,base:blended,
      residual_adjustment:residual.value,has_r3_support:residual.enabled};
  }
  function parity(runtime,tol=1e-7) {
    check(runtime.existing_59.length===59,"Se esperan 59 verificaciones independientes.");
    let maxError=0, mean=0;
    for(const entry of runtime.existing_59){
      const y=run(runtime,entry.x,entry.distances).predicted_t_ha;
      const err=Math.abs(y-entry.expected);
      maxError=Math.max(err,maxError);mean+=y;
    }
    mean/=59;
    check(maxError<=tol,"JavaScript difiere de Python: discrepancia máxima "+maxError);
    check(Math.abs(mean-runtime.aggregate_parity.mean)<=tol,"La media de la reproducción no coincide.");
    return {max_abs_difference:maxError, mean, tested:59};
  }
  global.Reference26Browser=Object.freeze({run,parity,haversineDistances});
})(typeof window === "undefined" ? globalThis : window);
