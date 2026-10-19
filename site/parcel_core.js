/* Pure arithmetic used by the public illustration. It is NOT an inference model. */
(function (global) {
  "use strict";
  const assertNumber = (v, name) => {
    if (typeof v !== "number" || !Number.isFinite(v)) throw Error(name + " must be finite");
  };
  function combine(climate, local, localWeight, correction, supported) {
    for (const [value, name] of [[climate,"climate"],[local,"local"],[localWeight,"weight"],[correction,"correction"]])
      assertNumber(value,name);
    if (climate < 0 || climate > 12 || local < 0 || local > 12)
      throw RangeError("Fictional climate and local inputs must be 0..12 t/ha");
    if (localWeight < 0 || localWeight > 1)
      throw RangeError("Mixture weight must be 0..1");
    if (correction < -0.25 || correction > 0.25)
      throw RangeError("Bounded residual correction must be -0.25..0.25 t/ha");
    if (typeof supported !== "boolean") throw TypeError("Missingness support must be boolean");
    const base = climate * (1-localWeight) + local * localWeight;
    const applied = supported ? correction : 0;
    return Object.freeze({base, correction: applied, predictedExample: base+applied, climatePart: climate*(1-localWeight), localPart: local*localWeight});
  }
  function relativeRmse(rmse, reference) {
    assertNumber(rmse, "rmse");
    assertNumber(reference,"reference");
    if (rmse < 0 || reference <= 0) throw RangeError("Invalid denominator or negative RMSE");
    return 100 * rmse / reference;
  }
  global.ParcelMath = Object.freeze({combine,relativeRmse});
})(window);
