"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const data=JSON.parse(fs.readFileSync(path.join(__dirname,"../site/data/model.json"),"utf8"));
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../site/parcel_core.js"),"utf8"),context);
const math=context.window.ParcelMath;
test("all four real fitted geology weights combine illustrative components correctly",()=>{
  for (const g of data.final_fit.cluster_weights){
    const result=math.combine(4,5,g,.1,true);
    assert.ok(Math.abs(result.base-(4+g))<1e-11);
    assert.ok(Math.abs(result.predictedExample-(4+g+.1))<1e-11);
    assert.ok(Math.abs(result.climatePart+result.localPart-result.base)<1e-11);
    assert.equal(result.correction,.1);
  }
});
test("missing final indicator disables the residual correction, not the base",()=>{
  const a=math.combine(3.9,4.4,.85558,-.20,false);
  const b=math.combine(3.9,4.4,.85558,-.20,true);
  assert.equal(a.correction,0);
  assert.ok(Math.abs(a.predictedExample-b.predictedExample-.20)<1e-12);
  assert.equal(a.base,b.base);
});
test("final correction always remains within trained recipe bounds",()=>{
  assert.equal(math.combine(4,4,.5,.25,true).predictedExample,4.25);
  assert.equal(math.combine(4,4,.5,-.25,true).predictedExample,3.75);
  assert.throws(()=>math.combine(4,4,.5,.251,true),/Bounded residual/);
  assert.throws(()=>math.combine(4,4,1.1,0,true),/weight/);
  assert.throws(()=>math.combine(NaN,4,.5,0,true),/finite/);
});
test("LOOCV relative RMSE is a scale comparison, not individual percentage error",()=>{
  const x=data.loocv;
  assert.equal(x.folds,138);
  assert.equal(x.training_labels_per_fold,137);
  assert.equal(x.rmse_t_ha,.468186);
  assert.ok(Math.abs(math.relativeRmse(x.rmse_t_ha,x.mean_observed_t_ha)-11.836628406735095)<1e-11);
  assert.ok(Math.abs(math.relativeRmse(x.rmse_t_ha,4)-11.70465)<1e-11);
  assert.throws(()=>math.relativeRmse(.468186,0),/denominator/);
});
