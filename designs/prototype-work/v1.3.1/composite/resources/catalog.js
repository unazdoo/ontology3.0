(function installV131Catalog(global) {
  "use strict";

  const base = global.OFW_V130_CATALOG || global.OFW_V120_CATALOG;
  if (!base) throw new Error("The parent resource catalog must load before the v1.3.1 overlay.");

  const s003Overlay = Object.freeze({
    data: {
      name: "债务风险纵向数据构建",
      type: "DataVersionCandidate",
      status: "candidate",
      summary: "构建企业纵向观察、独立 Outcome、现金流、债务到期、事件和关系网络；仅在 M02 校验后冻结。",
      refs: ["CYCLE-S003-CURRENT", "DV-S003-SYN-LONGITUDINAL-20260902-v1"],
      dataVersionId: "DV-S003-SYN-LONGITUDINAL-20260902-v1"
    },
    ontology: {
      name: "债务风险多模型语义合同",
      type: "SemanticContractCandidate",
      status: "candidate",
      summary: "定义企业、风险事件、债务到期、现金流、关系路径及各模型独立结果身份、单位和时间粒度。",
      refs: ["SC-S003-MULTIMODEL-20260902-v1", "MO-S003-DEBT-RISK-PORTFOLIO-v1"],
      ontologyVersionId: "SC-S003-MULTIMODEL-20260902-v1"
    },
    query: {
      name: "债务风险多模型问数",
      type: "ModelResultQueryConsumer",
      status: "available",
      summary: "读取同一多模型结果包络，支持企业、期限、事件、缺口、关系、异常和模型分歧查询。",
      refs: ["RESULT-PACKAGE-S003-CURRENT", "M03_QUERY_READ_ONLY"]
    },
    decision: {
      name: "非正式结果行动边界",
      type: "NonFactDecisionGuard",
      status: "read_only",
      summary: "PREDICTION、SHADOW 和 SIMULATION 均返回 NON_FACT_SOURCE_REJECTED，零行动、审批、提醒、待办、通知和交易。",
      refs: ["NON_FACT_SOURCE_REJECTED", "M04_ZERO_SIDE_EFFECTS"]
    },
    agent: {
      name: "债务风险多模型解释",
      type: "ModelExplanationConsumer",
      status: "available",
      summary: "解释贡献、异常事件、关系传染路径和正式/候选分歧，不重新计算或修改结果。",
      refs: ["RESULT-PACKAGE-S003-CURRENT", "M05_EXPLANATION_READ_ONLY"]
    },
    report: {
      name: "债务风险模型演进报告",
      type: "ModelEvolutionReport",
      status: "candidate",
      summary: "汇总当前周期、历史版本、Benchmark、Shadow、Release、Binding 和回退路径，保持候选章节非正式。",
      refs: ["CYCLE-HISTORY-S003", "M06_MODEL_EVOLUTION_REPORT"]
    },
    m07: {
      name: "债务风险对象、关系与时序探索",
      type: "MultiModelExplorationResource",
      status: "available",
      summary: "按企业下钻正式评分、期限概率、流动性缺口、关系路径、异常事件和模型证据。",
      refs: ["RESULT-PACKAGE-S003-CURRENT", "RELATION-GRAPH-S003-CURRENT"],
      objectRef: { id: "S003-ENT-020", title: "环保测试公司4", objectTypeRef: "Enterprise" },
      dataVersionId: "DV-S003-SYN-LONGITUDINAL-20260902-v1",
      ontologyVersionId: "SC-S003-MULTIMODEL-20260902-v1"
    },
    modeling: {
      name: "债务风险模型组合与持续优化",
      type: "ModelPortfolioOptimizationCenter",
      status: "candidate",
      summary: "以 1.0.2 正式模型为只读基线，运行 Challenger、补充模型、Benchmark、AI 洞察、候选版本、Shadow、Release 和 Binding。",
      refs: ["MO-S003-DEBT-RISK-PORTFOLIO-v1", "S003-M01-DEBT-RISK-PKG@1.0.2", "CYCLE-S003-CURRENT"],
      objectRef: { id: "S003-ENT-020", title: "环保测试公司4", objectTypeRef: "Enterprise" },
      dataVersionId: "DV-S003-SYN-LONGITUDINAL-20260902-v1",
      ontologyVersionId: "SC-S003-MULTIMODEL-20260902-v1",
      modelingObjectiveRef: "MO-S003-DEBT-RISK-PORTFOLIO-v1"
    },
    dashboard: {
      name: "债务风险智能监测驾驶舱",
      type: "MultiModelRiskDashboard",
      status: "candidate",
      summary: "统一展示正式、候选、影子、压力模拟和差异结果，并下钻企业、指标、事件、关系、模型、数据和证据。",
      refs: ["CB-S003-DASHBOARD-MULTIMODEL-v1", "RESULT-PACKAGE-S003-CURRENT"]
    }
  });

  const crossScenarioOverlay = Object.freeze({
    S002: Object.freeze({
      m07: Object.freeze({
        name: "预算对象、关系与时序探索",
        type: "ExplorationResource",
        status: "available",
        summary: "按预算单元查看年度执行、异常事件、关系和时序，并保留数据与语义版本。",
        refs: ["composite/modules/m07/resources/s002.json", "S002-DATA-v1", "S002-ONTO-v1"],
        objectRef: { id: "BudgetUnit-002", title: "信息科技费用", objectTypeRef: "m01.object-type.budget-unit" },
        dataVersionId: "S002-DATA-v1",
        ontologyVersionId: "S002-ONTO-v1"
      })
    }),
    S004: Object.freeze({
      m07: Object.freeze({
        name: "贷前对象、关系与时序探索",
        type: "ExplorationResource",
        status: "available",
        summary: "按借款主体查看资料完整度、复核事件、关系和时序；不形成授信结论。",
        refs: ["composite/modules/m07/resources/s004.json", "DATA-ASSET-S004-20260815-V01", "SEM-S004-PREFLIGHT-V1"],
        objectRef: { id: "LoanApplicant-002", title: "申请主体B", objectTypeRef: "m01.object-type.loan-applicant" },
        dataVersionId: "DATA-ASSET-S004-20260815-V01",
        ontologyVersionId: "SEM-S004-PREFLIGHT-V1"
      })
    })
  });

  function freezeRecord(record) {
    if (Array.isArray(record.refs)) Object.freeze(record.refs);
    if (record.objectRef) Object.freeze(record.objectRef);
    return Object.freeze(record);
  }

  const scenarios = Object.freeze(base.scenarios.map((scenario) => freezeRecord({ ...scenario })));
  const resources = Object.freeze(base.resources.map((resource) => {
    const overlay = resource.scenarioId === "S003" ? s003Overlay[resource.moduleId] : crossScenarioOverlay[resource.scenarioId]?.[resource.moduleId] || null;
    return freezeRecord({
      ...resource,
      id: resource.id.replace("ofw.v120.", "ofw.v131."),
      ...(overlay || {}),
      refs: [...(overlay?.refs || resource.refs || [])],
      ...(overlay?.objectRef ? { objectRef: { ...overlay.objectRef } } : {})
    });
  }));

  function resourcesFor(moduleId) {
    return Object.freeze(resources.filter((item) => item.moduleId === moduleId));
  }

  function scenario(scenarioId) {
    return scenarios.find((item) => item.scenarioId === scenarioId) || null;
  }

  function resource(resourceId) {
    return resources.find((item) => item.id === resourceId) || null;
  }

  const catalog = Object.freeze({ scenarios, resources, resourcesFor, scenario, resource });
  global.OFW_V120_CATALOG = catalog;
  global.OFW_V130_CATALOG = catalog;
  global.OFW_V131_CATALOG = catalog;
})(typeof window !== "undefined" ? window : globalThis);
