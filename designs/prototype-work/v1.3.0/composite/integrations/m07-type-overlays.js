(function installM07TypeOverlays(global) {
  "use strict";

  const types = global.M07Core?.TYPE_META;
  if (!types) return;
  Object.assign(types, {
    "m01.object-type.budget-context": { label: "预算监测上下文", icon: "clipboard-check" },
    "m01.object-type.budget-unit": { label: "预算单元", icon: "landmark" },
    "m01.object-type.loan-assessment-context": { label: "贷前评估上下文", icon: "clipboard-check" },
    "m01.object-type.loan-applicant": { label: "借款主体", icon: "building-2" }
  });
})(window);
