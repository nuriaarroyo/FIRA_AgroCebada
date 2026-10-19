"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),
  fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const context={};
vm.runInNewContext(fs.readFileSync(path.join(root,"site/reference26_engine.js"),"utf8"),context);
const engine=context.Reference26Browser;
test("Reference26 inference is pure local JavaScript with no network or external math",()=>{
  assert.equal(typeof engine.run,"function");
  assert.equal(typeof engine.parity,"function");
  const source=fs.readFileSync(path.join(root,"site/reference26_engine.js"),"utf8");
  assert.ok(source.includes("function ridge"));
  assert.ok(source.includes("function geology"));
  assert.ok(source.includes("function correction"));
  assert.ok(!source.includes("fetch("));
  assert.ok(!source.includes("Math.random"));
});
test("weighted local Ridge and mixture match an independent one-dimensional solution",()=>{
  const feat=Array.from({length:26},(_,i)=>"f"+i);
  const xs=Array.from({length:138},(_,i)=>[i<24?i:0]);
  const targets=Array.from({length:138},(_,i)=>i<24?1+.3*i:1);
  const model={
    schema_version:1,model:"Reference26",feature_names:feat,
    climate:{transform:{cols:["f0"],median:[0],mean:[0],scale:[1],support:[true]},coef:[1],intercept:0},
    local:{cols:["f1"],med:[0],mean:[0],scale:[1],support:[true],
      train_positions:Array.from({length:138},(_,i)=>i),
      standardized:xs,targets,neighbors:24,ridge_alpha:30},
    internal:{transform:{cols:["f0"],median:[0],mean:[0],scale:[1],support:[true]},
      coef:[0],intercept:0,amplitude:0},
    geology:{columns:["f2"],medians:[0],mean:[0],scale:[1],norm:1,
      centers:[[0],[1]],weights:[.4,.8]},
    correction:{cols:["f3"],med:[0],mean:[0],scale:[1],support:[true],
      inner_median:[0],inner_mean:[0],inner_scale:[1],inner_support:[true],
      coef:[1],intercept:0,offset:0,amplitude:.5,clip:.5,strength:1}
  };
  const row=Object.fromEntries(feat.map(x=>[x,0]));
  row.f0=4;row.f1=2;row.f2=0;row.f3=1;
  const distance=Array.from({length:138},()=>1);
  // 24 equally weighted observations, one-dimensional weighted centering:
  const xx=Array.from({length:24},(_,i)=>i);
  const xmean=xx.reduce((a,b)=>a+b,0)/24;
  const S=xx.reduce((a,b)=>a+(b-xmean)**2,0);
  const w=1/(1+1e-6);  // exact frozen inverse-distance regularization
  const coefficient=.3*S*w/(S*w+30);
  const local=1+.3*xmean+(2-xmean)*coefficient;
  const result=engine.run(model,row,distance);
  assert.ok(Math.abs(result.local-local)<1e-10);
  const expected=4+.4*(local-4)+.25;
  assert.ok(Math.abs(result.predicted_t_ha-expected)<1e-10);
  assert.equal(result.geology_group,0);
  assert.equal(result.has_r3_support,true);
  row.f3=null;
  const masked=engine.run(model,row,distance);
  assert.equal(masked.residual_adjustment,0);
  assert.ok(Math.abs(masked.predicted_t_ha-(expected-.25))<1e-10);
});

const file=path.join(root,"site/data/reference26_runtime.json");
if(fs.existsSync(file)) {
  const model=JSON.parse(fs.readFileSync(file,"utf8"));
  test("all 59 archived parcels match Python predictions within 1e-7 t/ha",()=>{
    const result=engine.parity(model,1e-7);
    assert.equal(result.tested,59);
    assert.ok(result.max_abs_difference<=1e-7);
    console.log("59 Reference26 Python-to-JavaScript maximum absolute difference:",result.max_abs_difference,"t/ha");
    assert.ok(Math.abs(result.mean-3.956432328667021)<1e-5);
  });
  test("new parcel coordinates use frozen normalized Haversine scale",()=>{
    if(!model.geography.new_parcels_supported)return;
    const sample=model.existing_59[0];
    const distances=engine.haversineDistances(sample.x,model.geography);
    assert.equal(distances.length,138);
    const errors=distances.map((value,i)=>Math.abs(value-sample.distances[i]));
    assert.ok(Math.max(...errors)<=3e-6);
    const predicted=engine.run(model,sample.x).predicted_t_ha;
    assert.ok(Math.abs(predicted-sample.expected)<1e-7);
  });
  test("final R3 correction follows missing indicator mask",()=>{
    const sample=model.existing_59.find(s =>
      model.correction.cols.every(col=>s.x[col]!=null));
    assert.ok(sample);
    const original=engine.run(model,sample.x,sample.distances);
    assert.equal(original.has_r3_support,true);
    const incomplete={...sample.x,[model.correction.cols[0]]:null};
    const without=engine.run(model,incomplete,sample.distances);
    assert.equal(without.has_r3_support,false);
    assert.equal(without.residual_adjustment,0);
  });
} else {
  test("without exported model, the site must not claim authentic fitted inference",()=>{
    const site=fs.readFileSync(path.join(root,"site/browser_inference.js"),"utf8");
    assert.ok(site.includes('ready(null)'));
    assert.ok(site.includes('!response.ok'));
    assert.ok(site.includes('Reference26Browser.parity'));
  });
}
