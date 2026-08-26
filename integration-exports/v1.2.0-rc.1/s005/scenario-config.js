(function initS005ScenarioConfig(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.OFWS005ScenarioConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createS005ScenarioConfig() {
  "use strict";

  const workflow = Object.freeze([
    Object.freeze({ order: 1, id: "sourceBatch", moduleId: "M02", title: "登记来源快照", prerequisite: null }),
    Object.freeze({ order: 2, id: "classification", moduleId: "M01", title: "确认分类与语义", prerequisite: "sourceBatch" }),
    Object.freeze({ order: 3, id: "compliance", moduleId: "M03", title: "观察持续合规", prerequisite: "classification" }),
    Object.freeze({ order: 4, id: "marketPeer", moduleId: "M03", title: "完成市场横评", prerequisite: "compliance" }),
    Object.freeze({ order: 5, id: "selection", moduleId: "M04", title: "复核池内选择", prerequisite: "marketPeer" }),
    Object.freeze({ order: 6, id: "tradingRisk", moduleId: "M05", title: "复盘交易与风险", prerequisite: "selection" }),
    Object.freeze({ order: 7, id: "reportDraft", moduleId: "M06", title: "形成研究报告", prerequisite: "tradingRisk" })
  ]);

  const config = Object.freeze({
    sourceTag: "prototype-v1.1.0-frozen",
    parentVersion: "v1.1.0",
    baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
    targetPrototypeVersion: "v1.2.0-rc.1",
    acceptanceReady: false,
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    namespace: "ofw.s005.research.v1",
    contentEntry: "content.html",
    workflow,
    modules: Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]),
    optionalMounts: Object.freeze({
      M07: Object.freeze({
        routeId: "module/exploration",
        requiredInput: Object.freeze(["scenarioContext", "objectRef", "dataVersionId", "ontologyVersionId", "asOf", "lensIntent"])
      }),
      M08: Object.freeze({
        routeId: "module/modeling",
        requiredInput: Object.freeze(["scenarioContext", "objectRef", "modelingObjectiveRef", "dataVersionId", "ontologyVersionId", "evaluationInputRef", "resultKind"]),
        allowedResultKinds: Object.freeze(["PREDICTED", "SIMULATED"])
      })
    })
  });

  function createShellRegistration(basePath) {
    const prefix = String(basePath || "").replace(/\/$/, "");
    return Object.freeze({
      scenarioId: config.scenarioId,
      scenarioVersion: config.scenarioVersion,
      namespace: config.namespace,
      routeId: "scenario/S005",
      entry: `${prefix ? `${prefix}/` : ""}${config.contentEntry}`,
      mode: "same-origin-content-frame",
      acceptanceReady: false
    });
  }

  return Object.freeze({ config, workflow, createShellRegistration });
});
