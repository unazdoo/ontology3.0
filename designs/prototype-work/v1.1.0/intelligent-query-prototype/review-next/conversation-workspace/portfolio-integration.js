(function () {
  "use strict";

  const base = window.IQDomain;
  const registry = window.OFW_COMPOSITE_REGISTRY;
  if (!base || !registry) return;

  const clone = base.clone;
  const sceneById = (scenarioId) => registry.scene(scenarioId);
  const sourceRefs = Object.freeze({
    S001: "runtime-snapshots/S001-RUN-20260816081748567-705ac89fb83a.runtime.json",
    S002: "scenarios/s002/checkpoints/runs/S002-RUN-20260815080000000-6ef5d0ef82f9/evidence/CP04-query-integrated/M03-state-export.json",
    S003: "scenarios/s003/resources/m03/query-results.v2.json"
  });

  const businessCopy = (value) => String(value ?? "")
    .replace(/\bPublished\b/gi, "已发布")
    .replace(/\bC035(?:[-_/][A-Za-z0-9._-]+)?\b/gi, "正式评估结果");

  const sanitizeResultCopy = (result) => {
    if (!result || typeof result !== "object") return result;
    const next = clone(result);
    ["title", "summary", "reason", "recovery"].forEach((key) => {
      if (typeof next[key] === "string") next[key] = businessCopy(next[key]);
    });
    next.rows = (next.rows || []).map((item) => ({
      ...item,
      detail: typeof item.detail === "string" ? businessCopy(item.detail) : item.detail,
      warning: typeof item.warning === "string" ? businessCopy(item.warning) : item.warning
    }));
    next.evidenceReferences = (next.evidenceReferences || []).map((item) => ({
      ...item,
      detail: typeof item.detail === "string" ? businessCopy(item.detail) : item.detail
    }));
    return next;
  };

  const sanitizeRunCopy = (run) => ({
    ...run,
    failure: typeof run?.failure === "string" ? businessCopy(run.failure) : run?.failure,
    recovery: typeof run?.recovery === "string" ? businessCopy(run.recovery) : run?.recovery,
    result: sanitizeResultCopy(run?.result)
  });

  const semanticResource = (scenarioId, type, id, name, props = {}) => ({
    scenarioId,
    businessDomain: sceneById(scenarioId).domain,
    type,
    id,
    name,
    owner: "本体管理",
    status: "已发布",
    lifecycleStatus: "已发布",
    semanticVersion: registry.ontology[scenarioId].publishedVersion,
    semanticVersionId: registry.ontology[scenarioId].pointer,
    dataVersion: props.dataVersion || registry.dataEngineering[scenarioId].combinationAsset || (registry.dataEngineering[scenarioId].assets || [])[0],
    componentDataVersions: clone(registry.dataEngineering[scenarioId].assets || []),
    dataAsOf: sceneById(scenarioId).dataAsOf,
    ...props
  });

  const semanticResources = Object.freeze({
    "S002-OBJ-BUDGET-EXECUTION": semanticResource("S002", "Object Type", "S002-OBJ-BUDGET-EXECUTION", "部门预算执行", { scope: "年度、部门、科目和预算版本", dataVersion: "S002-BUDGET-EXEC-v1" }),
    "S002-OBJ-PROJECT-BUDGET": semanticResource("S002", "Object Type", "S002-OBJ-PROJECT-BUDGET", "项目预算", { scope: "项目立项、余额和采购占用", dataVersion: "S002-PROJECT-OCC-v1" }),
    "S002-MET-BUDGET-EXECUTION-RATE": semanticResource("S002", "Metric", "S002-MET-BUDGET-EXECUTION-RATE", "费用预算执行率", { unit: "%", scope: "年度、部门和费用科目", dataVersion: "S002-BUDGET-EXEC-v1" }),
    "S002-MET-BUDGET-VARIANCE": semanticResource("S002", "Metric", "S002-MET-BUDGET-VARIANCE", "预算差异额", { unit: "万元", scope: "最终批准预算与期间实际", dataVersion: "S002-BUDGET-EXEC-v1" }),
    "S002-MET-PROJECT-BALANCE": semanticResource("S002", "Metric", "S002-MET-PROJECT-BALANCE", "项目可用立项余额", { unit: "万元", scope: "项目立项金额扣减已用和净在途", dataVersion: "S002-PROJECT-OCC-v1" }),
    "S002-MET-YEAR-END-COMMITMENT": semanticResource("S002", "Metric", "S002-MET-YEAR-END-COMMITMENT", "年末采购预算占用集中度", { unit: "%", scope: "项目采购占用", dataVersion: "S002-PROJECT-OCC-v1" }),
    "S002-RULE-BUDGET-COVERAGE": semanticResource("S002", "Rule", "S002-RULE-BUDGET-COVERAGE", "项目预算覆盖不足", { scope: "可用立项余额低于关注线", dataVersion: "S002-PROJECT-OCC-v1" }),
    "S002-RULE-YEAR-END-COMMITMENT": semanticResource("S002", "Rule", "S002-RULE-YEAR-END-COMMITMENT", "年末采购占用集中", { scope: "年末采购发起与预算占用", dataVersion: "S002-PROJECT-OCC-v1" }),
    "S002-ACTION-BUDGET-RECTIFICATION": semanticResource("S002", "Action Type", "S002-ACTION-BUDGET-RECTIFICATION", "预算执行整改", { scope: "单一预算责任主体" }),
    "S002-ACTION-PROCUREMENT-CLEANUP": semanticResource("S002", "Action Type", "S002-ACTION-PROCUREMENT-CLEANUP", "采购占用清理", { scope: "单一项目责任主体" }),

    "S003-OBJ-ENTERPRISE": semanticResource("S003", "Object Type", "S003-OBJ-ENTERPRISE", "债务风险评估企业", { scope: "集团纳入评估的成员企业" }),
    "S003-MET-FINAL-RISK-SCORE": semanticResource("S003", "Metric", "S003-MET-FINAL-RISK-SCORE", "债务风险最终评分", { unit: "分", scope: "单一评估企业" }),
    "S003-MET-ROA-SCORE": semanticResource("S003", "Metric", "S003-MET-ROA-SCORE", "总资产收益率得分", { unit: "分", scope: "单一评估企业" }),
    "S003-MET-AR-TURNOVER-SCORE": semanticResource("S003", "Metric", "S003-MET-AR-TURNOVER-SCORE", "应收账款周转率得分", { unit: "分", scope: "单一评估企业" }),
    "S003-RULE-COMPOSITE-SCORE": semanticResource("S003", "Rule", "S003-RULE-COMPOSITE-SCORE", "综合评分规则", { scope: "原始评分和适用调节因子" }),
    "S003-RULE-RISK-TIER": semanticResource("S003", "Rule", "S003-RULE-RISK-TIER", "风险亮灯分档", { scope: "绿灯、黄灯、红灯和黑灯" }),
    "S003-ACTION-RISK-FOLLOW-UP": semanticResource("S003", "Action Type", "S003-ACTION-RISK-FOLLOW-UP", "债务风险跟进", { scope: "单一风险企业" }),
    "S003-ACTION-SPECIAL-DISPOSAL": semanticResource("S003", "Action Type", "S003-ACTION-SPECIAL-DISPOSAL", "专项风险处置", { scope: "红灯或黑灯企业" })
  });

  const s001LinkContracts = Object.freeze({
    "LINK-ENTITY-FINANCING": {
      allowedDirection: "双向",
      cardinality: "多对一",
      sourceEndpoint: { id: "PROP-FINANCING-DETAIL-ENTITY-CODE", kind: "property", objectId: "OBJ-FINANCING-DETAIL" },
      targetEndpoint: { id: "PROP-FINANCING-ENTITY-UNIT-CODE", kind: "property", objectId: "OBJ-FINANCING-ENTITY" },
      endpointCompatible: true
    },
    "LINK-FINANCING-INSTITUTION": {
      allowedDirection: "正向",
      cardinality: "多对一",
      sourceEndpoint: { id: "PROP-FINANCING-DETAIL-INSTITUTION-CODE", kind: "property", objectId: "OBJ-FINANCING-DETAIL" },
      targetEndpoint: { id: "PROP-FINANCIAL-INSTITUTION-CODE", kind: "property", objectId: "OBJ-FINANCIAL-INSTITUTION" },
      endpointCompatible: true
    },
    "LINK-ENTITY-OWNER": {
      allowedDirection: "正向",
      cardinality: "多对一",
      sourceEndpoint: { id: "PROP-FINANCING-ENTITY-OWNER-ID", kind: "property", objectId: "OBJ-FINANCING-ENTITY" },
      targetEndpoint: { id: "PROP-FINANCING-OWNER-ID", kind: "property", objectId: "OBJ-FINANCING-OWNER" },
      endpointCompatible: true
    }
  });

  function resourcesForScenario(scenarioId) {
    const scene = sceneById(scenarioId);
    const ontology = registry.ontology[scenarioId];
    const data = registry.dataEngineering[scenarioId];
    if (!scene || !ontology || !data) return [];
    const shared = {
      scenarioId,
      businessDomain: scene.domain,
      owner: "本体管理",
      status: "已发布",
      lifecycleStatus: "已发布",
      publicationState: "Published",
      businessValidityState: "有效",
      publishedVersionId: ontology.pointer,
      publishedSemanticVersion: ontology.publishedVersion,
      semanticVersion: ontology.publishedVersion,
      semanticVersionId: ontology.pointer,
      dataVersion: data.combinationAsset || (data.assets || [])[0],
      componentDataVersions: clone(data.assets || []),
      dataAsOf: scene.dataAsOf
    };
    if (scenarioId === "S001") {
      return base.RESOURCES.map((item) => ({ ...clone(item), ...shared, ...(s001LinkContracts[item.id] || {}) }));
    }
    return Object.values(semanticResources).filter((item) => item.scenarioId === scenarioId).map((item) => ({ ...clone(item), ...shared, dataVersion: item.dataVersion || shared.dataVersion }));
  }

  const recommendation = (id, templateId, scenarioId, title, question, category, resources) => ({
    id, templateId, scenarioId, businessDomain: sceneById(scenarioId).domain, title, question, category, theme: category, resources
  });
  const recommendations = Object.freeze([
    recommendation("s001-group-cost", "group-overview", "S001", "集团融资盘面", "集团当前融资余额和平均融资成本分别是多少？", "融资成本", ["MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"]),
    recommendation("s001-sector-rank", "group-overview", "S001", "板块成本梯度", "哪个产业板块平均融资成本最高，和最低板块相差多少？", "融资成本", ["PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-FINANCING-COST"]),
    recommendation("s001-rate-structure", "group-overview", "S001", "利率结构", "集团浮动利率融资占比多高，短期债务占比是多少？", "融资成本", ["MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"]),
    recommendation("s001-553-cost", "unit-cost", "S001", "单位553成本", "单位553平均融资成本、融资余额和高成本融资占比分别是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-HIGH-COST-BALANCE-RATIO"]),
    recommendation("s001-465-561", "pair-cost", "S001", "两家单位对比", "单位465和单位561谁的平均融资成本更高，相差多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
    recommendation("s001-pair", "pair-cost", "S001", "两家综合成本", "单位553和单位465合在一起的融资余额和平均成本是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
    recommendation("s001-triple", "triple-cost", "S001", "三家综合成本", "单位553、单位465和单位561合计融资余额和综合平均成本是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
    recommendation("s001-unit-rank", "triple-cost", "S001", "三家成本排序", "单位553、单位465和单位561的平均融资成本从高到低怎么排？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST"]),
    recommendation("s001-rules", "rule-explain", "S001", "规则命中", "单位553、单位465和单位561各自为什么被关注？", "融资成本", ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"]),
    recommendation("s001-banks", "institution-priority", "S001", "协商优先级", "单位553的成本压力主要来自哪些银行，先谈哪几家？", "融资成本", ["RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"]),
    recommendation("s001-management-structure", "group-overview", "S001", "集团债务结构", "集团当前浮动利率敞口和短期债务结构分别是什么水平？", "融资管理", ["MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"]),
    recommendation("s001-management-banks", "institution-priority", "S001", "机构协商顺序", "单位553应该先和哪三家银行协商，各自涉及多少问题余额？", "融资管理", ["RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"]),
    recommendation("s001-management-rules", "rule-explain", "S001", "结构风险分工", "单位553、单位465和单位561的结构风险分别是什么？", "融资管理", ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"]),
    recommendation("s001-management-units", "triple-cost", "S001", "重点单位比较", "三家重点单位合计融资余额是多少，各自成本怎么排？", "融资管理", ["OBJ-FINANCING-ENTITY", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"]),

    recommendation("s002-execution", "portfolio-s002-execution", "S002", "部门预算执行", "2025年三个部门的费用预算执行率和剩余空间分别是多少？", "融资管理", ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-EXECUTION-RATE", "S002-MET-BUDGET-VARIANCE"]),
    recommendation("s002-execution-gap", "portfolio-s002-execution", "S002", "执行差距", "哪个部门的费用预算最接近用完，另外两个部门还剩多少？", "融资管理", ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-EXECUTION-RATE", "S002-MET-BUDGET-VARIANCE"]),
    recommendation("s002-margin", "portfolio-s002-margin", "S002", "成本占收", "2025年哪个部门成本占收比超过100%，毛利率是多少？", "融资管理", ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-VARIANCE"]),
    recommendation("s002-balance", "portfolio-s002-balance", "S002", "项目预算余额", "哪些项目的可用立项余额不足，净在途占用又比较高？", "融资管理", ["S002-OBJ-PROJECT-BUDGET", "S002-MET-PROJECT-BALANCE", "S002-RULE-BUDGET-COVERAGE"]),
    recommendation("s002-negative-balance", "portfolio-s002-balance", "S002", "负余额项目", "目前哪个项目已经出现负的可用立项余额，差多少？", "融资管理", ["S002-OBJ-PROJECT-BUDGET", "S002-MET-PROJECT-BALANCE", "S002-RULE-BUDGET-COVERAGE"]),
    recommendation("s002-commitment", "portfolio-s002-commitment", "S002", "年末采购占用", "12月采购发起和年末预算占用集中度分别是多少？", "融资管理", ["S002-MET-YEAR-END-COMMITMENT", "S002-RULE-YEAR-END-COMMITMENT"]),
    recommendation("s002-coverage", "portfolio-s002-commitment", "S002", "采购数据覆盖", "年末采购占用结论覆盖了多少项目，使用时有什么限制？", "融资管理", ["S002-MET-YEAR-END-COMMITMENT"]),
    recommendation("s002-submission", "portfolio-s002-submission", "S002", "预算申报压力", "2026年初始申报中，哪个部门的成本占收压力最大？", "融资管理", ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-VARIANCE"]),

    recommendation("s003-tier", "portfolio-s003-tier", "S003", "风险等级分布", "当前21家企业的债务风险等级怎么分布？", "债务风险", ["S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"]),
    recommendation("s003-focus", "portfolio-s003-tier", "S003", "重点关注数量", "黄灯及以上需要关注的企业有多少家，集团平均分是多少？", "债务风险", ["S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"]),
    recommendation("s003-alert", "portfolio-s003-alert", "S003", "红黑灯企业", "哪些企业处于红灯或黑灯，分数分别是多少？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"]),
    recommendation("s003-black-check", "portfolio-s003-alert", "S003", "黑灯核对", "本轮有没有黑灯企业？红灯企业是哪一家？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"]),
    recommendation("s003-lowest", "portfolio-s003-lowest", "S003", "低分指标", "风电测试公司01最弱的三项指标是什么，分别多少分？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE"]),
    recommendation("s003-company", "portfolio-s003-company", "S003", "单户评估", "风电测试公司01本轮最终评分、风险等级和调节结果是什么？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-COMPOSITE-SCORE"]),
    recommendation("s003-adjustment", "portfolio-s003-adjustment", "S003", "调节因子影响", "风电测试公司01的调节因子把原始评分调整了多少？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-RULE-COMPOSITE-SCORE"]),
    recommendation("s003-not-applicable", "portfolio-s003-not-applicable", "S003", "因子不适用", "哪些企业的电价波动率不适用，系统是怎么处理的？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-RULE-COMPOSITE-SCORE"]),
    recommendation("s003-candidates", "portfolio-s003-candidates", "S003", "待确认风险事项", "目前有多少条亮灯风险事项等待成员单位确认？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-ACTION-RISK-FOLLOW-UP", "S003-ACTION-SPECIAL-DISPOSAL"]),
    recommendation("s003-yellow", "portfolio-s003-yellow", "S003", "黄灯企业", "本轮黄灯企业有哪些，各自评分是多少？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"]),
    recommendation("s003-model", "portfolio-s003-company", "S003", "评估模型", "风电测试公司01这次评分使用了哪个模型版本和数据时点？", "债务风险", ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-COMPOSITE-SCORE"]),
    recommendation("s003-action-scope", "portfolio-s003-candidates", "S003", "风险事项分流", "黄灯和红灯事项分别会进入哪类人工确认流程？", "债务风险", ["S003-ACTION-RISK-FOLLOW-UP", "S003-ACTION-SPECIAL-DISPOSAL"]),

  ]);
  const answerCopy = Object.freeze({
    "s001-sector-rank": { title: "产业板块融资成本梯度", summary: "环保产业平均融资成本最高，为2.741%；核能最低，为1.948%，两者相差0.793个百分点。其余依次为产业金融2.614%、数字化2.523%、产业服务2.462%和境内新能源2.286%。" },
    "s001-465-561": { title: "单位465与单位561融资成本对比", summary: "单位561平均融资成本2.228%，高于单位465的2.197%，相差0.031个百分点；两家融资余额合计790.016亿元，按余额加权后的综合平均成本为2.198%。" },
    "s001-unit-rank": { title: "三家单位融资成本排序", summary: "三家平均融资成本从高到低为：单位553 2.881%、单位561 2.228%、单位465 2.197%。单位553比单位465高0.684个百分点，是三家中最需要优先核对成本结构的单位。" },
    "s002-execution": { title: "2025年部门费用预算执行", summary: "安全运行部执行率98.86%，尚余3.5799万元；技术部77.97%，尚余83.5493万元；设备管理部63.20%，尚余148.8443万元。安全运行部最接近预算上限。" },
    "s002-execution-gap": { title: "部门预算剩余空间", summary: "安全运行部最接近用完，执行率98.86%，仅余3.5799万元；技术部尚余83.5493万元，设备管理部尚余148.8443万元。" },
    "s002-negative-balance": { title: "项目预算负余额", summary: "概率安全分析项目可用立项余额为-20.5038万元，已低于0万元关注线；其净在途为62.09万元，占立项金额50.07%。" },
    "s002-coverage": { title: "年末采购占用数据覆盖", summary: "当前年末采购占用结论只覆盖3个有源项目，场景登记共21个项目。8.5869%的12月采购发起占比和14.3530%的年末预算占用集中度，只适用于这3个已覆盖项目，不能外推到全部项目。" },
    "s003-focus": { title: "集团债务风险关注面", summary: "黄灯及以上共有5家，占21家评估企业的23.81%；其中黄灯4家、红灯1家、黑灯0家。集团平均最终评分为52.23分。" },
    "s003-black-check": { title: "黑灯与红灯企业核对", summary: "本轮没有黑灯企业。唯一红灯企业是环保测试公司4，最终评分23.05分，评估时点为2025-12-31。" },
    "s003-model": { title: "风电测试公司01评估版本", summary: "风电测试公司01本轮使用债务风险模型包1.0.2，评估时点为2025-12-31；原始评分84.40分，经-0.30调节后最终评分59.08分，结果版本1.1.0。" },
    "s003-action-scope": { title: "亮灯风险事项分流", summary: "4家黄灯企业进入“债务风险跟进”人工确认，1家红灯企业进入“专项风险处置”人工确认。当前5条均为待确认候选，智能问数不会直接创建行动申请或负责人待办。" },
    "s001-management-structure": { title: "集团债务结构", summary: "集团浮动利率融资占比95.149%，固定利率占比4.851%；短期债务占比0.912%。当前结构风险主要集中在利率重定价敞口，而不是短期到期集中。" },
    "s001-management-banks": { title: "单位553机构协商顺序", summary: "按问题余额排序，应先与欧陆银行沟通99.586亿元，其次是寰宇银行65.494亿元和海联银行58.476亿元；三家合计涉及223.556亿元问题余额。" },
    "s001-management-rules": { title: "重点单位结构风险", summary: "单位553平均融资成本2.881%，高于2.622%的关注线；单位465浮动利率余额占比100.000%，单位561短期债务余额占比93.545%。三家应分别管理成本、利率重定价和到期结构。" },
    "s001-management-units": { title: "三家重点单位融资比较", summary: "三家融资余额合计1,183.150亿元，综合平均成本2.425%。单家成本从高到低为单位553 2.881%、单位561 2.228%、单位465 2.197%。" }
  });

  const evidenceId = (templateId, rowId) => `E-${templateId}-${rowId}`;
  const row = (templateId, id, object, resourceId, label, exact, unit, status, extra) => ({
    id,
    rowId: id,
    evidenceId: evidenceId(templateId, id),
    object,
    resourceId,
    label,
    exact: String(exact),
    unit: unit || "",
    status: status || "可计算",
    ...(extra || {})
  });
  const chartItem = (item) => ({ id: item.id, rowId: item.id, evidenceId: item.evidenceId, label: item.object, value: Number(item.exact), exact: item.exact, unit: item.unit, resourceId: item.resourceId, status: item.status });

  const templates = {
    "portfolio-s002-execution": {
      id: "portfolio-s002-execution",
      title: "2025年部门费用预算执行情况",
      scope: ["设备管理部", "技术部", "安全运行部"],
      resourceIds: ["S002-MET-BUDGET-EXECUTION-RATE", "S002-MET-BUDGET-VARIANCE"],
      summary: "安全运行部费用预算执行率最高，为98.86%，尚余3.5799万元；技术部为77.97%，设备管理部为63.20%。结果使用最终批准预算与期间实际口径。",
      highlights: [
        { id: "highest-rate", label: "最高执行率", value: "98.86%", exact: "98.86", unit: "%", tone: "warning" },
        { id: "remaining", label: "对应预算空间", value: "3.5799 万元", exact: "3.5799", unit: "万元" },
        { id: "department-count", label: "部门范围", value: "3 个部门", exact: "3", unit: "个" }
      ],
      rows: [
        row("portfolio-s002-execution", "dept-equipment", "设备管理部", "S002-MET-BUDGET-EXECUTION-RATE", "费用预算执行率", 63.20, "%", "可计算", { detail: "最终批准预算404.50万元；期间实际255.6557万元；差异-148.8443万元" }),
        row("portfolio-s002-execution", "dept-technology", "技术部", "S002-MET-BUDGET-EXECUTION-RATE", "费用预算执行率", 77.97, "%", "可计算", { detail: "最终批准预算379.30万元；期间实际295.7507万元；差异-83.5493万元" }),
        row("portfolio-s002-execution", "dept-safety", "安全运行部", "S002-MET-BUDGET-EXECUTION-RATE", "费用预算执行率", 98.86, "%", "可计算", { detail: "最终批准预算313.90万元；期间实际310.3201万元；差异-3.5799万元" })
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["项目可用立项余额不足或净在途占用异常的项目有哪些？", "12月正向采购发起占比和年末采购预算占用集中度如何？"]
    },
    "portfolio-s002-balance": {
      id: "portfolio-s002-balance",
      title: "项目预算余额与在途占用异常",
      scope: ["热能动力研究", "概率安全分析"],
      resourceIds: ["S002-MET-PROJECT-BALANCE"],
      summary: "概率安全分析项目可用立项余额为-20.5038万元，已低于0万元关注线；热能动力研究项目余额为34.0092万元，但净在途占比31.67%，需要结合采购进度核对。",
      highlights: [
        { id: "negative-balance", label: "最低可用余额", value: "-20.5038 万元", exact: "-20.5038", unit: "万元", tone: "danger" },
        { id: "alert-projects", label: "关注项目", value: "2 个", exact: "2", unit: "个" }
      ],
      rows: [
        row("portfolio-s002-balance", "project-safety", "概率安全分析", "S002-MET-PROJECT-BALANCE", "项目可用立项余额", -20.5038, "万元", "规则命中", { detail: "净在途62.09万元，占立项金额50.07%；来源 PRJ-AQ-概率-2025-002" }),
        row("portfolio-s002-balance", "project-thermal", "热能动力研究", "S002-MET-PROJECT-BALANCE", "项目可用立项余额", 34.0092, "万元", "分析关注", { detail: "净在途52.25万元，占立项金额31.67%；来源 PRJ-JS-热能-2025-002" })
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["2025年各部门费用预算执行率和差异额分别是多少？"]
    },
    "portfolio-s002-commitment": {
      id: "portfolio-s002-commitment",
      title: "年末采购与预算占用集中度",
      scope: ["2025年项目预算占用"],
      resourceIds: ["S002-MET-YEAR-END-COMMITMENT"],
      summary: "12月正向采购发起占全年正向采购发起的8.5869%，年末采购预算占用集中度为14.3530%。当前源覆盖3/21个项目，结论仅适用于已覆盖项目范围。",
      highlights: [
        { id: "december-pr", label: "12月正向采购发起占比", value: "8.5869%", exact: "8.5869", unit: "%" },
        { id: "occupancy", label: "年末预算占用集中度", value: "14.3530%", exact: "14.3530", unit: "%", tone: "warning" },
        { id: "coverage", label: "来源覆盖", value: "3/21 项目", exact: "3", unit: "个" }
      ],
      rows: [
        row("portfolio-s002-commitment", "december-pr", "2025年项目采购", "S002-MET-YEAR-END-COMMITMENT", "12月正向采购发起占比", 8.5869, "%", "可计算"),
        row("portfolio-s002-commitment", "occupancy", "2025年项目采购", "S002-MET-YEAR-END-COMMITMENT", "年末采购预算占用集中度", 14.3530, "%", "可计算", { detail: "净在途163.38万元；正向采购发起273.09万元" })
      ],
      chart: { recommended: "metric", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["项目可用立项余额不足或净在途占用异常的项目有哪些？"]
    },
    "portfolio-s002-margin": {
      id: "portfolio-s002-margin",
      title: "2025年部门成本占收情况",
      scope: ["安全运行部"],
      resourceIds: ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-VARIANCE"],
      summary: "安全运行部2025年实际收入275.5278万元、实际成本310.3201万元，成本占收比112.63%，对应毛利率-12.63%，是当前三个部门中唯一超过100%的部门。",
      highlights: [
        { id: "cost-rate", label: "成本占收比", value: "112.63%", exact: "112.63", unit: "%", tone: "danger" },
        { id: "gross-margin", label: "毛利率", value: "-12.63%", exact: "-12.63", unit: "%", tone: "danger" },
        { id: "cost", label: "实际成本", value: "310.3201 万元", exact: "310.3201", unit: "万元" }
      ],
      rows: [
        row("portfolio-s002-margin", "cost-rate", "安全运行部", "S002-MET-BUDGET-VARIANCE", "成本占收比", 112.63, "%", "分析关注", { detail: "实际成本310.3201万元 / 实际收入275.5278万元" }),
        row("portfolio-s002-margin", "gross-margin", "安全运行部", "S002-MET-BUDGET-VARIANCE", "毛利率", -12.63, "%", "分析关注"),
        row("portfolio-s002-margin", "revenue", "安全运行部", "S002-OBJ-BUDGET-EXECUTION", "实际收入", 275.5278, "万元", "已发布事实"),
        row("portfolio-s002-margin", "cost", "安全运行部", "S002-OBJ-BUDGET-EXECUTION", "实际成本", 310.3201, "万元", "已发布事实")
      ],
      chart: { recommended: "metric", allowed: ["metric", "table"], adapters: {} },
      nextQuestions: ["2025年三个部门的费用预算执行率和剩余空间分别是多少？"]
    },
    "portfolio-s002-submission": {
      id: "portfolio-s002-submission",
      title: "2026年初始预算申报成本压力",
      scope: ["技术部", "安全运行部", "设备管理部"],
      resourceIds: ["S002-OBJ-BUDGET-EXECUTION", "S002-MET-BUDGET-VARIANCE"],
      summary: "2026年初始申报中，技术部成本占收比最高，为288.79%；安全运行部168.65%，设备管理部45.06%。该结果用于预算申报压力排序，不替代正式预算批复。",
      highlights: [
        { id: "highest", label: "最高成本占收比", value: "288.79%", exact: "288.79", unit: "%", tone: "danger" },
        { id: "negative-count", label: "高于100%的部门", value: "2 个", exact: "2", unit: "个", tone: "warning" }
      ],
      rows: [
        row("portfolio-s002-submission", "technology", "技术部", "S002-MET-BUDGET-VARIANCE", "成本占收比", 288.79, "%", "分析关注"),
        row("portfolio-s002-submission", "safety", "安全运行部", "S002-MET-BUDGET-VARIANCE", "成本占收比", 168.65, "%", "分析关注"),
        row("portfolio-s002-submission", "equipment", "设备管理部", "S002-MET-BUDGET-VARIANCE", "成本占收比", 45.06, "%", "可计算")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["哪个部门的费用预算最接近用完，另外两个部门还剩多少？"]
    },
    "portfolio-s003-tier": {
      id: "portfolio-s003-tier",
      title: "集团债务风险等级分布",
      scope: ["21家评估企业"],
      resourceIds: ["S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"],
      summary: "本轮共评估21家企业：绿灯16家、黄灯4家、红灯1家、黑灯0家，平均最终评分52.23分。结果来自同一已发布风险模型和正式评估结果。",
      highlights: [
        { id: "average-score", label: "平均最终评分", value: "52.23 分", exact: "52.23", unit: "分" },
        { id: "warning-count", label: "黄灯及以上关注", value: "5 家", exact: "5", unit: "家", tone: "warning" },
        { id: "total", label: "评估企业", value: "21 家", exact: "21", unit: "家" }
      ],
      rows: [
        row("portfolio-s003-tier", "green", "绿灯", "S003-RULE-RISK-TIER", "企业数量", 16, "家", "已发布事实"),
        row("portfolio-s003-tier", "yellow", "黄灯", "S003-RULE-RISK-TIER", "企业数量", 4, "家", "已发布事实"),
        row("portfolio-s003-tier", "red", "红灯", "S003-RULE-RISK-TIER", "企业数量", 1, "家", "已发布事实"),
        row("portfolio-s003-tier", "black", "黑灯", "S003-RULE-RISK-TIER", "企业数量", 0, "家", "真实零值")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "donut", "table"], adapters: {} },
      nextQuestions: ["哪些企业处于红灯或黑灯？", "风电测试公司01本轮评分最低的三项指标是什么？"]
    },
    "portfolio-s003-alert": {
      id: "portfolio-s003-alert",
      title: "红灯及黑灯企业清单",
      scope: ["21家评估企业"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"],
      summary: "当前只有环保测试公司4处于红灯，最终评分23.05分；没有黑灯企业。本次问数只返回风险事实，不会自动发起行动或创建待办。",
      highlights: [
        { id: "red-count", label: "红灯企业", value: "1 家", exact: "1", unit: "家", tone: "danger" },
        { id: "black-count", label: "黑灯企业", value: "0 家", exact: "0", unit: "家" },
        { id: "lowest-score", label: "红灯企业评分", value: "23.05 分", exact: "23.05", unit: "分", tone: "danger" }
      ],
      rows: [
        row("portfolio-s003-alert", "enterprise-020", "环保测试公司4", "S003-MET-FINAL-RISK-SCORE", "最终评分", 23.05, "分", "红灯", { detail: "企业身份 S003-ENT-020；评估时点2025-12-31；结果版本1.1.0" })
      ],
      chart: { recommended: "metric", allowed: ["metric", "table"], adapters: {} },
      nextQuestions: ["当前集团各风险等级有多少家企业？"]
    },
    "portfolio-s003-lowest": {
      id: "portfolio-s003-lowest",
      title: "风电测试公司01低分指标",
      scope: ["风电测试公司01"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE"],
      summary: "风电测试公司01最终评分59.08分、风险等级为绿灯。当前最低三项指标依次为总资产收益率、应收账款周转率和销售毛利率。",
      highlights: [
        { id: "final-score", label: "最终评分", value: "59.08 分", exact: "59.08", unit: "分" },
        { id: "risk-tier", label: "风险等级", value: "绿灯", exact: "绿灯", unit: "" },
        { id: "factor-sum", label: "调节因子合计", value: "-0.30", exact: "-0.30", unit: "" }
      ],
      rows: [
        row("portfolio-s003-lowest", "roa", "风电测试公司01", "S003-MET-FINAL-RISK-SCORE", "总资产收益率得分", 35.19, "分", "已发布事实"),
        row("portfolio-s003-lowest", "ar-turnover", "风电测试公司01", "S003-MET-FINAL-RISK-SCORE", "应收账款周转率得分", 36.44, "分", "已发布事实"),
        row("portfolio-s003-lowest", "gross-margin", "风电测试公司01", "S003-MET-FINAL-RISK-SCORE", "销售毛利率得分", 39.46, "分", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["当前集团各风险等级有多少家企业？", "哪些企业处于红灯或黑灯？"]
    },
    "portfolio-s003-company": {
      id: "portfolio-s003-company",
      title: "风电测试公司01本轮风险评估",
      scope: ["风电测试公司01"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-COMPOSITE-SCORE"],
      summary: "风电测试公司01原始评分84.40分，调节因子合计-0.30，综合调整系数0.70，最终评分59.08分，风险等级为绿灯。评估时点为2025-12-31，模型版本1.0.2。",
      highlights: [
        { id: "final", label: "最终评分", value: "59.08 分", exact: "59.08", unit: "分" },
        { id: "raw", label: "原始评分", value: "84.40 分", exact: "84.40", unit: "分" },
        { id: "factor", label: "因子合计", value: "-0.30", exact: "-0.30", unit: "" }
      ],
      rows: [
        row("portfolio-s003-company", "final", "风电测试公司01", "S003-MET-FINAL-RISK-SCORE", "最终评分", 59.08, "分", "绿灯"),
        row("portfolio-s003-company", "raw", "风电测试公司01", "S003-RULE-COMPOSITE-SCORE", "原始评分", 84.40, "分", "已发布事实"),
        row("portfolio-s003-company", "factor", "风电测试公司01", "S003-RULE-COMPOSITE-SCORE", "调节因子合计", -0.30, "", "已发布事实")
      ],
      chart: { recommended: "metric", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["风电测试公司01最弱的三项指标是什么，分别多少分？"]
    },
    "portfolio-s003-adjustment": {
      id: "portfolio-s003-adjustment",
      title: "风电测试公司01调节因子影响",
      scope: ["风电测试公司01"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-RULE-COMPOSITE-SCORE"],
      summary: "本轮因子合计-0.30，其中融资使用率贡献-0.10、未来第一个月资金余缺预警贡献-0.20，其余适用因子为0。原始评分84.40分按0.70系数调整为59.08分。",
      highlights: [
        { id: "factor-sum", label: "因子合计", value: "-0.30", exact: "-0.30", unit: "" },
        { id: "adjustment", label: "综合调整系数", value: "0.70", exact: "0.70", unit: "" },
        { id: "score-change", label: "评分变化", value: "-25.32 分", exact: "-25.32", unit: "分", tone: "warning" }
      ],
      rows: [
        row("portfolio-s003-adjustment", "credit", "融资使用率", "S003-RULE-COMPOSITE-SCORE", "因子系数", -0.10, "", "已应用"),
        row("portfolio-s003-adjustment", "fund-gap", "资金余缺预警", "S003-RULE-COMPOSITE-SCORE", "因子系数", -0.20, "", "已应用"),
        row("portfolio-s003-adjustment", "score-change", "风电测试公司01", "S003-RULE-COMPOSITE-SCORE", "评分变化", -25.32, "分", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["风电测试公司01本轮最终评分、风险等级和调节结果是什么？"]
    },
    "portfolio-s003-not-applicable": {
      id: "portfolio-s003-not-applicable",
      title: "电价波动率不适用企业",
      scope: ["7家企业"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-RULE-COMPOSITE-SCORE"],
      summary: "本轮有7家企业的电价波动率明确标记为不适用：风电测试公司10、11、12及环保测试公司1至4。不存在缺失套零；不适用状态保留为业务事实，系数为0。",
      highlights: [
        { id: "not-applicable", label: "不适用企业", value: "7 家", exact: "7", unit: "家" },
        { id: "defaulted", label: "缺失套零", value: "0 家", exact: "0", unit: "家" }
      ],
      rows: [
        row("portfolio-s003-not-applicable", "wind", "在建风电企业", "S003-RULE-COMPOSITE-SCORE", "不适用企业数量", 3, "家", "不适用"),
        row("portfolio-s003-not-applicable", "environment", "环保企业", "S003-RULE-COMPOSITE-SCORE", "不适用企业数量", 4, "家", "不适用")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["目前有多少条亮灯风险事项等待成员单位确认？"]
    },
    "portfolio-s003-candidates": {
      id: "portfolio-s003-candidates",
      title: "待人工确认的亮灯风险事项",
      scope: ["黄灯和红灯企业"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-ACTION-RISK-FOLLOW-UP", "S003-ACTION-SPECIAL-DISPOSAL"],
      summary: "当前有5条亮灯风险事项等待人工确认：4条黄灯事项进入债务风险跟进，1条红灯事项进入专项风险处置。问数只展示候选事实，不会自动创建行动申请或待办。",
      highlights: [
        { id: "total", label: "待确认事项", value: "5 条", exact: "5", unit: "条", tone: "warning" },
        { id: "follow-up", label: "风险跟进", value: "4 条", exact: "4", unit: "条" },
        { id: "special", label: "专项处置", value: "1 条", exact: "1", unit: "条", tone: "danger" }
      ],
      rows: [
        row("portfolio-s003-candidates", "follow-up", "黄灯企业", "S003-ACTION-RISK-FOLLOW-UP", "待人工确认事项", 4, "条", "待确认"),
        row("portfolio-s003-candidates", "special", "红灯企业", "S003-ACTION-SPECIAL-DISPOSAL", "待人工确认事项", 1, "条", "待确认")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["本轮黄灯企业有哪些，各自评分是多少？"]
    },
    "portfolio-s003-yellow": {
      id: "portfolio-s003-yellow",
      title: "本轮黄灯企业清单",
      scope: ["21家评估企业"],
      resourceIds: ["S003-OBJ-ENTERPRISE", "S003-MET-FINAL-RISK-SCORE", "S003-RULE-RISK-TIER"],
      summary: "本轮共有4家黄灯企业：风电测试公司07为37.75分，环保测试公司1为30.52分、环保测试公司2为33.92分、环保测试公司3为37.31分。",
      highlights: [
        { id: "count", label: "黄灯企业", value: "4 家", exact: "4", unit: "家", tone: "warning" },
        { id: "lowest", label: "最低评分", value: "30.52 分", exact: "30.52", unit: "分", tone: "warning" }
      ],
      rows: [
        row("portfolio-s003-yellow", "wind-07", "风电测试公司07", "S003-MET-FINAL-RISK-SCORE", "最终评分", 37.75, "分", "黄灯"),
        row("portfolio-s003-yellow", "env-01", "环保测试公司1", "S003-MET-FINAL-RISK-SCORE", "最终评分", 30.52, "分", "黄灯"),
        row("portfolio-s003-yellow", "env-02", "环保测试公司2", "S003-MET-FINAL-RISK-SCORE", "最终评分", 33.92, "分", "黄灯"),
        row("portfolio-s003-yellow", "env-03", "环保测试公司3", "S003-MET-FINAL-RISK-SCORE", "最终评分", 37.31, "分", "黄灯")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["目前有多少条亮灯风险事项等待成员单位确认？"]
    },
    "portfolio-s004-loan-room": {
      id: "portfolio-s004-loan-room",
      title: "贷款申请与额度空间",
      scope: ["中国广核贷款申请"],
      resourceIds: ["S004-OBJ-LOAN-APPLICATION", "S004-OBJ-CREDIT-FACILITY", "S004-MET-WORKING-CAPITAL", "S004-RULE-AMOUNT-WITHIN-FUNDING", "S004-RULE-AMOUNT-WITHIN-FACILITY"],
      summary: "本次申请10亿元、期限12个月，用于核电运营日常经营周转，采用信用方式。申请金额低于新增流动资金贷款上限25.7901亿元，也低于可用授信18亿元，两项额度校验均通过。",
      highlights: [
        { id: "request", label: "申请金额", value: "10 亿元", exact: "10", unit: "亿元" },
        { id: "facility-room", label: "授信剩余空间", value: "8 亿元", exact: "8", unit: "亿元" },
        { id: "funding-room", label: "测算剩余空间", value: "15.7901 亿元", exact: "15.7901", unit: "亿元" }
      ],
      rows: [
        row("portfolio-s004-loan-room", "request", "贷款申请", "S004-OBJ-LOAN-APPLICATION", "申请金额", 10, "亿元", "已确认"),
        row("portfolio-s004-loan-room", "facility", "内部授信", "S004-OBJ-CREDIT-FACILITY", "可用授信", 18, "亿元", "额度内"),
        row("portfolio-s004-loan-room", "funding", "资金需求测算", "S004-MET-WORKING-CAPITAL", "新增贷款上限", 25.7901, "亿元", "额度内")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["当前内部授信批了多少、用了多少、还能用多少？"]
    },
    "portfolio-s004-facility": {
      id: "portfolio-s004-facility",
      title: "内部授信额度使用情况",
      scope: ["中国广核"],
      resourceIds: ["S004-OBJ-CREDIT-FACILITY"],
      summary: "截至2026-08-14，内部授信总额30亿元，已使用12亿元，可用18亿元；本次10亿元申请如获批，仍有8亿元授信空间。",
      highlights: [
        { id: "approved", label: "授信总额", value: "30 亿元", exact: "30", unit: "亿元" },
        { id: "used", label: "已使用", value: "12 亿元", exact: "12", unit: "亿元" },
        { id: "available", label: "当前可用", value: "18 亿元", exact: "18", unit: "亿元" }
      ],
      rows: [
        row("portfolio-s004-facility", "approved", "中国广核", "S004-OBJ-CREDIT-FACILITY", "授信总额", 30, "亿元", "已发布事实"),
        row("portfolio-s004-facility", "used", "中国广核", "S004-OBJ-CREDIT-FACILITY", "已使用授信", 12, "亿元", "已发布事实"),
        row("portfolio-s004-facility", "available", "中国广核", "S004-OBJ-CREDIT-FACILITY", "可用授信", 18, "亿元", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["这笔10亿元流动资金贷款申请是否同时满足资金需求和可用授信额度？"]
    },
    "portfolio-s004-solvency": {
      id: "portfolio-s004-solvency",
      title: "2023—2025年偿债指标变化",
      scope: ["中国广核"],
      resourceIds: ["S004-OBJ-BORROWER", "S004-MET-DEBT-ASSET-RATIO", "S004-MET-CURRENT-RATIO"],
      summary: "资产负债率由2023年的60.19%升至2024年的61.20%和2025年的65.15%；同期流动比率由0.94倍降至0.88倍和0.66倍，短期偿债缓冲持续收窄。",
      highlights: [
        { id: "debt-2025", label: "2025资产负债率", value: "65.15%", exact: "65.15", unit: "%", tone: "warning" },
        { id: "current-2025", label: "2025流动比率", value: "0.66 倍", exact: "0.66", unit: "倍", tone: "warning" }
      ],
      rows: [
        row("portfolio-s004-solvency", "debt-2023", "2023年", "S004-MET-DEBT-ASSET-RATIO", "资产负债率", 60.19, "%", "已发布事实"),
        row("portfolio-s004-solvency", "debt-2024", "2024年", "S004-MET-DEBT-ASSET-RATIO", "资产负债率", 61.20, "%", "已发布事实"),
        row("portfolio-s004-solvency", "debt-2025", "2025年", "S004-MET-DEBT-ASSET-RATIO", "资产负债率", 65.15, "%", "已发布事实"),
        row("portfolio-s004-solvency", "current-2023", "2023年", "S004-MET-CURRENT-RATIO", "流动比率", 0.94, "倍", "已发布事实"),
        row("portfolio-s004-solvency", "current-2024", "2024年", "S004-MET-CURRENT-RATIO", "流动比率", 0.88, "倍", "已发布事实"),
        row("portfolio-s004-solvency", "current-2025", "2025年", "S004-MET-CURRENT-RATIO", "流动比率", 0.66, "倍", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["2025年利息保障倍数是多少，和前两年相比稳定吗？"]
    },
    "portfolio-s004-interest": {
      id: "portfolio-s004-interest",
      title: "利息保障倍数",
      scope: ["中国广核"],
      resourceIds: ["S004-OBJ-BORROWER", "S004-MET-INTEREST-COVERAGE"],
      summary: "利息保障倍数2023年为4.56倍、2024年为4.91倍、2025年为4.87倍。2025年较上年小幅回落0.04倍，但三年整体保持在4.5倍以上。",
      highlights: [
        { id: "current", label: "2025年", value: "4.87 倍", exact: "4.87", unit: "倍" },
        { id: "change", label: "同比变化", value: "-0.04 倍", exact: "-0.04", unit: "倍" }
      ],
      rows: [
        row("portfolio-s004-interest", "2023", "2023年", "S004-MET-INTEREST-COVERAGE", "利息保障倍数", 4.56, "倍", "已发布事实"),
        row("portfolio-s004-interest", "2024", "2024年", "S004-MET-INTEREST-COVERAGE", "利息保障倍数", 4.91, "倍", "已发布事实"),
        row("portfolio-s004-interest", "2025", "2025年", "S004-MET-INTEREST-COVERAGE", "利息保障倍数", 4.87, "倍", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["借款人2023到2025年的资产负债率和流动比率怎么变化？"]
    },
    "portfolio-s004-profit": {
      id: "portfolio-s004-profit",
      title: "2025年盈利能力",
      scope: ["中国广核"],
      resourceIds: ["S004-OBJ-BORROWER", "S004-MET-PROFITABILITY"],
      summary: "2025年主营业务利润率30.80%，总资产报酬率4.79%，净资产收益率7.76%；三项指标均低于2024年，盈利能力较上年走弱。",
      highlights: [
        { id: "margin", label: "主营业务利润率", value: "30.80%", exact: "30.80", unit: "%" },
        { id: "roa", label: "总资产报酬率", value: "4.79%", exact: "4.79", unit: "%" },
        { id: "roe", label: "净资产收益率", value: "7.76%", exact: "7.76", unit: "%" }
      ],
      rows: [
        row("portfolio-s004-profit", "margin", "中国广核", "S004-MET-PROFITABILITY", "主营业务利润率", 30.80, "%", "已发布事实"),
        row("portfolio-s004-profit", "roa", "中国广核", "S004-MET-PROFITABILITY", "总资产报酬率", 4.79, "%", "已发布事实"),
        row("portfolio-s004-profit", "roe", "中国广核", "S004-MET-PROFITABILITY", "净资产收益率", 7.76, "%", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["2025年资产、净资产、净利润和销售收入的增长情况怎样？"]
    },
    "portfolio-s004-growth": {
      id: "portfolio-s004-growth",
      title: "2025年成长性指标",
      scope: ["中国广核"],
      resourceIds: ["S004-OBJ-BORROWER", "S004-MET-GROWTH"],
      summary: "2025年总资产增长7.24%，但净资产下降4.20%、净利润下降15.67%、销售收入下降4.11%。资产规模仍在扩大，收益与权益端同步承压。",
      highlights: [
        { id: "assets", label: "总资产增长", value: "7.24%", exact: "7.24", unit: "%" },
        { id: "profit", label: "净利润增长", value: "-15.67%", exact: "-15.67", unit: "%", tone: "danger" },
        { id: "revenue", label: "销售增长", value: "-4.11%", exact: "-4.11", unit: "%", tone: "warning" }
      ],
      rows: [
        row("portfolio-s004-growth", "assets", "中国广核", "S004-MET-GROWTH", "总资产增长率", 7.24, "%", "已发布事实"),
        row("portfolio-s004-growth", "equity", "中国广核", "S004-MET-GROWTH", "净资产增长率", -4.20, "%", "已发布事实"),
        row("portfolio-s004-growth", "profit", "中国广核", "S004-MET-GROWTH", "净利润增长率", -15.67, "%", "已发布事实"),
        row("portfolio-s004-growth", "revenue", "中国广核", "S004-MET-GROWTH", "销售增长率", -4.11, "%", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["借款人2025年的主营业务利润率、总资产报酬率和净资产收益率是多少？"]
    },
    "portfolio-s004-working-capital": {
      id: "portfolio-s004-working-capital",
      title: "流动资金需求测算",
      scope: ["中国广核贷款申请"],
      resourceIds: ["S004-OBJ-LOAN-APPLICATION", "S004-MET-WORKING-CAPITAL"],
      summary: "2025年营运资金周转次数2.2380次，测算营运资金量234.0573亿元，新增流动资金贷款额度上限25.7901亿元；本次申请10亿元，低于测算上限15.7901亿元。",
      highlights: [
        { id: "turnover", label: "周转次数", value: "2.2380 次", exact: "2.2380", unit: "次" },
        { id: "need", label: "营运资金量", value: "234.0573 亿元", exact: "234.0573", unit: "亿元" },
        { id: "maximum", label: "新增贷款上限", value: "25.7901 亿元", exact: "25.7901", unit: "亿元" }
      ],
      rows: [
        row("portfolio-s004-working-capital", "turnover", "中国广核", "S004-MET-WORKING-CAPITAL", "营运资金周转次数", 2.2380, "次", "已发布事实"),
        row("portfolio-s004-working-capital", "need", "中国广核", "S004-MET-WORKING-CAPITAL", "营运资金量", 234.0573, "亿元", "已发布事实"),
        row("portfolio-s004-working-capital", "maximum", "中国广核", "S004-MET-WORKING-CAPITAL", "新增流动资金贷款上限", 25.7901, "亿元", "已发布事实")
      ],
      chart: { recommended: "bar", allowed: ["metric", "bar", "table"], adapters: {} },
      nextQuestions: ["这笔10亿元流动资金贷款申请是否同时满足资金需求和可用授信额度？"]
    }
  };

  Object.values(templates).forEach((template) => {
    const items = template.rows.map(chartItem);
    template.rows.forEach((item) => { item.value = `${item.exact}${item.unit || ""}`; });
    template.evidenceReferences = template.rows.map((item) => ({ evidenceId: item.evidenceId, resultItemId: item.id, resourceId: item.resourceId, object: item.object, label: item.label, exact: item.exact, unit: item.unit, status: item.status, detail: item.detail }));
    template.chart.adapters = {
      metric: { items: [items[0]], unit: items[0]?.unit || "" },
      bar: { items, unit: items.every((item) => item.unit === items[0]?.unit) ? items[0]?.unit : "" },
      table: { items }
    };
    if (template.id === "portfolio-s003-tier") {
      template.chart.adapters.donut = { items, unit: "家", composition: true };
    }
  });
  const queryTemplates = Object.freeze(Object.fromEntries(
    Object.entries(templates).filter(([id]) => !id.startsWith("portfolio-s004-"))
  ));

  const verifiedCapabilities = () => ({
    skills: clone(base.SKILLS),
    tools: clone(base.TOOLS),
    observedSkills: clone(base.SKILLS).map((item) => ({ id: item.id, version: item.version, status: "已加载" })),
    observedTools: clone(base.TOOLS).map((item) => ({ id: item.id, version: item.version, status: "可用" })),
    deterministicCapabilities: clone(base.PLATFORM_CAPABILITIES),
    loadProof: "生产配置核验通过",
    lastRuntimeVerificationAt: "2026-08-22 09:00:00",
    owner: "智能问数"
  });

  const queryableScenarioIds = Object.freeze(["S001", "S002", "S003"]);
  const platformAgentIdentity = Object.freeze({
    id: "IQ-AGENT-PLATFORM-FINANCE",
    name: "智能问数助手",
    version: "IQ-PLATFORM-CFG-2.0",
    promptVersion: "IQ-PLATFORM-PROMPT-2.0",
    whitelistVersion: "IQ-PLATFORM-WL-2.0",
    contentFingerprint: "IQ-PLATFORM-FINANCE-CONTENT-2.0",
    effectiveFrom: "2026-08-23 09:00:00",
    effectiveTo: null,
    scene: "融资成本、预算资金管理与债务风险",
    status: "已启用",
    compatibility: "兼容",
    owner: "智能问数",
    promptPolicy: [
      "先确认业务域、对象范围和时间，再形成查询计划",
      "只解释确定性语义查询结果，不由模型重算指标或判断规则",
      "结论、限制和逐项依据必须引用同一精确运行上下文",
      "上下文缺失、版本错配或质量阻断时明确拒绝并给出恢复入口"
    ],
    guardrails: ["禁止读取工作簿和源字段", "禁止使用候选或同名最新版本替代权威版本", "禁止自动创建行动申请、通知、审批或待办"],
    allowedActions: ["导出当前结果 CSV", "保存问数视图", "固定视图引用", "提交标准 Action Request"],
    ...verifiedCapabilities()
  });
  const agentConfigSeeds = Object.freeze(Object.fromEntries(queryableScenarioIds.map((scenarioId) => {
    const scene = sceneById(scenarioId);
    const ontology = registry.ontology[scenarioId];
    return [scenarioId, {
      ...clone(platformAgentIdentity),
      sceneId: scenarioId,
      sceneVersion: scene.scenarioVersion,
      sceneRunId: scene.scenarioRunId,
      sceneVersionStatus: "已绑定",
      bindingVersion: `${ontology.publishedVersion} · ${ontology.pointer}`,
      bindingVersionId: ontology.pointer,
      semanticVersion: ontology.publishedVersion,
      allowedResources: resourcesForScenario(scenarioId).map((item) => item.id)
    }];
  })));

  function scenarioContext(scenarioId) {
    const scene = sceneById(scenarioId);
    const ontology = registry.ontology[scenarioId];
    const data = registry.dataEngineering[scenarioId];
    if (!scene || !ontology || !data || !queryableScenarioIds.includes(scenarioId)) return null;
    const resources = resourcesForScenario(scenarioId);
    const dataVersion = data.combinationAsset || (data.assets || [])[0];
    const formedAt = String(registry.workflow?.[scenarioId]?.completedAt || "2026-08-22 09:00:00").replace(" ", "T") + (String(registry.workflow?.[scenarioId]?.completedAt || "").includes("Z") ? "" : ".000Z");
    const context = {
      ready: true,
      blocked: false,
      allowConsumption: true,
      status: "可正式问数",
      reason: "已固定该业务域的精确场景轮次、已发布业务定义、数据版本和依据映射。",
      recovery: null,
      ontologyId: `ONT-${scenarioId}`,
      scenarioId: scene.scenarioId,
      scenarioVersion: scene.scenarioVersion,
      scenarioRunId: scene.scenarioRunId,
      scenarioFormedAt: formedAt,
      scenarioStatus: "已完成",
      scenarioReferenceStatus: "已完成",
      scenarioName: scene.name,
      semanticVersion: ontology.publishedVersion,
      versionId: ontology.pointer,
      dataVersion,
      componentDataVersions: clone(data.assets || []),
      asOf: scene.dataAsOf,
      switchedAt: formedAt,
      t019Ref: `${ontology.pointer} / ${dataVersion}`,
      t019EvidenceCode: ontology.pointer,
      t019RecordId: ontology.pointer,
      evidenceComplete: true,
      qualityStatus: data.quality,
      quality: data.quality,
      qualityEvidenceId: `${scenarioId}-QUALITY-${dataVersion}`,
      freshness: "截至时间已确认",
      freshnessStatus: "当前",
      freshnessBasis: `数据截至 ${scene.dataAsOf}`,
      freshnessEvidenceId: `${scenarioId}-ASOF-${scene.dataAsOf}`,
      lastSuccessfulAt: registry.workflow?.[scenarioId]?.completedAt || null,
      dataEligibility: "允许",
      dataTrustFingerprint: JSON.stringify({ scenarioId, scenarioRunId: scene.scenarioRunId, dataVersion, asOf: scene.dataAsOf, quality: data.quality }),
      projectionId: `OFW-COMPOSITE-CURRENT-${scenarioId}`,
      projectionVersion: registry.schemaVersion,
      projectionFormedAt: formedAt,
      resources,
      sourceRef: sourceRefs[scenarioId],
      candidateValidation: true,
      endpointContractFingerprint: `EP-${scenarioId}-${ontology.pointer}`,
      resourceContractFingerprint: base.resourceContractFingerprint(resources),
      evidenceIds: [`${scenarioId}-QUALITY-${dataVersion}`, `${scenarioId}-ASOF-${scene.dataAsOf}`, ontology.pointer]
    };
    context.runtimeContextFingerprint = base.runtimeContextFingerprint(context);
    return context;
  }

  const agentConfigs = Object.freeze(Object.fromEntries(Object.entries(agentConfigSeeds).map(([scenarioId, seed]) => {
    const context = scenarioContext(scenarioId);
    const config = {
      ...clone(seed),
      resourceContractFingerprint: context.resourceContractFingerprint,
      bindingVersion: `${context.semanticVersion} · ${context.versionId}`
    };
    config.c009Validation = {
      owner: "智能问数",
      status: "通过",
      checkedAt: config.lastRuntimeVerificationAt,
      sceneId: context.scenarioId,
      sceneVersion: context.scenarioVersion,
      sceneRunId: context.scenarioRunId,
      versionId: context.versionId,
      semanticVersion: context.semanticVersion,
      dataVersion: context.dataVersion,
      asOf: context.asOf,
      t019EvidenceCode: context.t019EvidenceCode,
      configFingerprint: base.configContractFingerprint(config, context),
      resourceContractFingerprint: context.resourceContractFingerprint,
      runtimeContextFingerprint: context.runtimeContextFingerprint,
      evidenceLocator: `智能问数/${config.id}/${context.scenarioRunId}`
    };
    return [scenarioId, Object.freeze(config)];
  })));
  const platformAgentConfig = Object.freeze({
    ...clone(platformAgentIdentity),
    allowedResources: [...new Set(Object.values(agentConfigs).flatMap((config) => config.allowedResources || []))],
    domainBindings: queryableScenarioIds.map((scenarioId) => {
      const scene = sceneById(scenarioId);
      const config = agentConfigs[scenarioId];
      return {
        scenarioId,
        scenarioName: scene.name,
        businessDomain: scene.domain,
        scenarioVersion: scene.scenarioVersion,
        scenarioRunId: scene.scenarioRunId,
        semanticVersion: config.semanticVersion,
        bindingVersionId: config.bindingVersionId,
        whitelistCount: config.allowedResources.length,
        c009Status: config.c009Validation.status
      };
    }),
    runRecords: [
      { scenarioId: "S001", runId: "RUN-MSVJWKPO-002", status: "成功", completedAt: "2026-08-16 09:28:53" },
      { scenarioId: "S002", runId: "RUN-S002-QUERY-001-PORTFOLIO", status: "成功", completedAt: "2026-08-15 08:00:00" },
      { scenarioId: "S003", runId: "S003-M03-QUERY-RESULTS-20260817-002", status: "成功", completedAt: "2026-08-17 16:34:00" }
    ]
  });

  function s001Question(text) {
    const templateId = base.resolveQuestion(text);
    const template = base.RESULT_TEMPLATES[templateId];
    if (!template || templateId === "trend-blocked") return null;
    return {
      id: `portfolio-s001-${templateId}`,
      templateId,
      scenarioId: "S001",
      businessDomain: "融资管理",
      title: template.title || "融资经营问数",
      question: text,
      theme: "融资经营",
      resources: clone(template.resourceIds || [])
    };
  }

  function bindPortfolioEvidence(result, context, scenarioId, runId) {
    const fixed = sanitizeResultCopy(result);
    const evidenceByRowId = {};
    fixed.rows = (fixed.rows || []).map((item, index) => {
      const evidence = `${scenarioId}-${String(runId).replace(/[^A-Za-z0-9_-]/g, "-")}-E${String(index + 1).padStart(2, "0")}`;
      evidenceByRowId[item.id] = evidence;
      return { ...item, rowId: item.id, evidenceId: evidence, value: item.value || `${item.exact}${item.unit || ""}` };
    });
    const extraEvidence = [];
    fixed.highlights = (fixed.highlights || []).map((item, index) => {
      const source = fixed.rows.find((rowItem) => rowItem.id === item.id || (String(rowItem.exact) === String(item.exact) && rowItem.unit === (item.unit || ""))) || null;
      if (source) return { ...item, rowId: source.id, resourceId: source.resourceId, evidenceId: source.evidenceId };
      const resultItemId = `highlight-${item.id || index + 1}`;
      const evidenceId = `${scenarioId}-${String(runId).replace(/[^A-Za-z0-9_-]/g, "-")}-H${String(index + 1).padStart(2, "0")}`;
      const resourceId = fixed.resourceIds?.[0] || null;
      extraEvidence.push({ evidenceId, resultItemId, resourceId, object: fixed.title, label: item.label, exact: String(item.exact ?? item.value ?? ""), unit: item.unit || "", status: "已核对" });
      return { ...item, rowId: resultItemId, resourceId, evidenceId };
    });
    Object.values(fixed.chart?.adapters || {}).forEach((adapter) => {
      (adapter.items || []).forEach((item) => {
        const source = fixed.rows.find((rowItem) => rowItem.id === (item.rowId || item.id) || rowItem.object === item.label) || null;
        if (!source) return;
        item.rowId = source.id;
        item.resourceId = source.resourceId;
        item.evidenceId = source.evidenceId;
      });
    });
    fixed.evidenceReferences = extraEvidence;
    fixed.fixedResultId = `${scenarioId}-${String(runId).replace(/[^A-Za-z0-9_-]/g, "-")}-RESULT`;
    fixed.generatedAt = base.nowText();
    fixed.sourceRef = sourceRefs[scenarioId];
    fixed.contextIdentity = {
      versionId: context.versionId,
      semanticVersion: context.semanticVersion,
      dataVersion: context.dataVersion,
      asOf: context.asOf,
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId
    };
    fixed.evidenceIds = [...new Set([...fixed.rows.map((item) => item.evidenceId), ...extraEvidence.map((item) => item.evidenceId)])];
    fixed.summaryEvidenceIds = clone(fixed.evidenceIds);
    return fixed;
  }

  const normalizedQuestion = (value) => String(value || "").replace(/[\s，。？！、]/g, "").toLowerCase();
  const exactRecommendation = (value) => recommendations.find((item) => normalizedQuestion(item.question) === normalizedQuestion(value)) || null;
  const applyAnswerCopy = (result, queryContext) => {
    const item = exactRecommendation(queryContext?.originalQuestion || queryContext?.finalQuestion || "");
    const copy = item ? answerCopy[item.id] : null;
    return copy && result ? { ...result, ...copy } : result;
  };

  function materialize(templateId, context, runId, queryContext = null) {
    const scenarioId = context?.scenarioId;
    if (scenarioId === "S001") {
      const result = applyAnswerCopy(sanitizeResultCopy(base.materializeResult(templateId, context, runId, queryContext)), queryContext);
      if (result) result.sourceRef = sourceRefs.S001;
      return result;
    }
    const source = templates[templateId];
    if (!source || !context || !["S002", "S003"].includes(scenarioId)) return null;
    return bindPortfolioEvidence(applyAnswerCopy(clone(source), queryContext), context, scenarioId, runId);
  }

  function matchQuestion(text) {
    const normalized = normalizedQuestion(text);
    const exact = exactRecommendation(text);
    if (exact) return exact;
    const byId = (id) => recommendations.find((item) => item.id === id) || null;
    if (/预算/.test(text) && /执行率|差异额|剩余/.test(text)) return byId("s002-execution");
    if (/项目/.test(text) && /余额|在途/.test(text)) return byId("s002-balance");
    if (/采购|占用/.test(text) && /12月|年末|集中/.test(text)) return byId("s002-commitment");
    if (/风险等级|绿灯|黄灯/.test(text) && /多少|分布|企业/.test(text)) return byId("s003-tier");
    if (/红灯|黑灯/.test(text) && /企业|哪些/.test(text)) return byId("s003-alert");
    if (/风电测试公司01/.test(text) && /最低|低分|弱项/.test(text)) return byId("s003-lowest");
    return s001Question(text);
  }

  function matchAgents(question, configs) {
    if (!question?.scenarioId || question.notApplicable) return [];
    const required = new Set(question.resources || []);
    const config = agentConfigs[question.scenarioId] || null;
    const allowed = new Set(config?.allowedResources || []);
    return config?.status === "已启用" && [...required].every((id) => allowed.has(id))
      ? [{ config, applicable: true, reason: "同一助手按业务域固定唯一 C009 绑定档案" }]
      : [];
  }

  function validateQuestion(question, config, context) {
    const issues = [];
    const scenarioId = question?.scenarioId || context?.scenarioId || config?.sceneId;
    const expected = scenarioContext(scenarioId);
    const scene = sceneById(scenarioId);
    const ontology = registry.ontology[scenarioId];
    const data = registry.dataEngineering[scenarioId];
    const template = scenarioId === "S001" ? base.RESULT_TEMPLATES[question?.templateId] : templates[question?.templateId];
    if (!expected || !scene || !ontology || !data || !template) issues.push("问题所属业务域或固定查询定义不可定位");
    if (!config || config.status !== "已启用" || config.sceneId !== scenarioId) issues.push("没有唯一匹配该业务域的已启用问数配置");
    if (expected && (!context?.ready || context.allowConsumption !== true || !base.runtimeContextMatches(context, expected))) issues.push("本轮上下文与组合注册表中的精确场景轮次不一致");
    if (context && (context.scenarioId !== scene?.scenarioId || context.scenarioVersion !== scene?.scenarioVersion || context.scenarioRunId !== scene?.scenarioRunId)) issues.push("场景身份、版本或运行轮次不一致");
    if (context && (context.versionId !== ontology?.pointer || context.semanticVersion !== ontology?.publishedVersion || context.t019EvidenceCode !== ontology?.pointer)) issues.push("已发布业务定义或正式采用指针不一致");
    const expectedDataVersion = data?.combinationAsset || (data?.assets || [])[0];
    if (context && (context.dataVersion !== expectedDataVersion || context.asOf !== scene?.dataAsOf || JSON.stringify(context.componentDataVersions || []) !== JSON.stringify(data?.assets || []))) issues.push("数据版本、组成资产或数据截至时间不一致");
    const requiredResources = template?.resourceIds || question?.resources || [];
    const contextResources = new Set((context?.resources || []).map((item) => item.id));
    const allowedResources = new Set(config?.allowedResources || []);
    if (requiredResources.some((id) => !contextResources.has(id) || !allowedResources.has(id))) issues.push("当前问题所需的已发布资源或配置白名单不完整");
    if (config && context) {
      const validation = config.c009Validation;
      const configMatches = Boolean(
        config.bindingVersionId === context.versionId && config.semanticVersion === context.semanticVersion &&
        config.resourceContractFingerprint === context.resourceContractFingerprint && config.compatibility === "兼容" &&
        validation?.owner === "智能问数" && validation.status === "通过" &&
        validation.sceneId === context.scenarioId && validation.sceneVersion === context.scenarioVersion && validation.sceneRunId === context.scenarioRunId &&
        validation.versionId === context.versionId && validation.semanticVersion === context.semanticVersion &&
        validation.dataVersion === context.dataVersion && validation.asOf === context.asOf &&
        validation.t019EvidenceCode === context.t019EvidenceCode &&
        validation.configFingerprint === base.configContractFingerprint(config, context) &&
        validation.resourceContractFingerprint === context.resourceContractFingerprint &&
        base.runtimeContextMatches(validation.runtimeContextFingerprint, context)
      );
      if (!configMatches) issues.push("问数配置快照与本轮精确语义、数据或场景轮次不一致");
    }
    return { passed: issues.length === 0, issues: [...new Set(issues)], context: expected, template };
  }

  function verifyResult(result, context, config, question = null) {
    const issues = [...validateQuestion(question || { scenarioId: context?.scenarioId, templateId: result?.id, resources: result?.resourceIds || [] }, config, context).issues];
    if (!result?.fixedResultId || !(result.rows || []).length) issues.push("固定结构化结果不完整");
    const resources = new Set((context?.resources || []).map((item) => item.id));
    const allowed = new Set(config?.allowedResources || []);
    const resultResourceIds = new Set(result?.resourceIds || []);
    (result?.resourceIds || []).forEach((id) => {
      if (!resources.has(id) || !allowed.has(id)) issues.push(`${id} 不在本轮已发布资源或配置白名单中`);
    });
    const allEvidence = [...(result?.rows || []), ...(result?.evidenceReferences || [])];
    const uniqueEvidence = [...new Map(allEvidence.filter((item) => item.evidenceId).map((item) => [item.evidenceId, item])).values()];
    const evidenceIds = uniqueEvidence.map((item) => item.evidenceId);
    if (allEvidence.some((item) => !item.evidenceId || !item.resourceId || !resources.has(item.resourceId) || !allowed.has(item.resourceId))) issues.push("结果存在无法映射到本轮已发布资源的依据项");
    if ((result?.rows || []).some((item) => !item.id || item.exact === undefined || item.status === undefined || !resultResourceIds.has(item.resourceId))) issues.push("结果行缺少稳定身份、精确值、状态或资源范围");
    if (evidenceIds.length !== new Set(result?.evidenceIds || []).size || (result?.evidenceIds || []).some((id) => !evidenceIds.includes(id))) issues.push("逐项依据清单不完整或存在无法定位项");
    if (!(result?.summaryEvidenceIds || []).length || result.summaryEvidenceIds.some((id) => !evidenceIds.includes(id))) issues.push("业务结论没有绑定本轮依据清单");
    const identity = result?.contextIdentity || {};
    ["versionId", "semanticVersion", "dataVersion", "asOf", "scenarioId", "scenarioVersion", "scenarioRunId"].forEach((key) => {
      if (identity[key] !== context?.[key]) issues.push("结果身份与本轮固定上下文不一致");
    });
    if (result?.sourceRef !== sourceRefs[context?.scenarioId]) issues.push("结果来源不能定位到该场景的权威运行记录");
    return { passed: issues.length === 0, issues: [...new Set(issues)] };
  }

  function csvEligibility(run) {
    if (!run?.sourcePortfolioRecord) return base.csvEligibility(run);
    if (run.past || run.context?.past) return { allowed: false, reason: "历史轮次只读；请按当前数据重新运行后导出" };
    if (run.status !== "成功" || !run.result?.rows?.length) return { allowed: false, reason: "只有成功形成的结构化结果可以导出" };
    const current = scenarioContext(run.context?.scenarioId);
    if (!current || !base.runtimeContextMatches(run.context, current)) return { allowed: false, reason: "当前权威上下文已变化，请重新运行后导出" };
    const question = matchQuestion(run.finalQuestion || run.question);
    const verified = verifyResult(run.result, run.context, run.configSnapshot, question);
    if (!verified.passed) return { allowed: false, reason: verified.issues[0] };
    if ((run.result.rows || []).some((item) => /质量失败|无法计算|覆盖不足|映射失败/.test(String(item.status || "")))) return { allowed: false, reason: "当前结果包含不可导出的异常项" };
    return { allowed: true, reason: "" };
  }

  function historyRun(templateId, createdAt) {
    const item = recommendations.find((candidate) => candidate.templateId === templateId);
    const context = scenarioContext(item.scenarioId);
    const id = item.scenarioId === "S002" ? "RUN-S002-QUERY-001-PORTFOLIO" : "S003-M03-QUERY-RESULTS-20260817-002";
    return {
      id,
      question: item.question,
      originalQuestion: item.question,
      finalQuestion: item.question,
      templateId,
      status: "成功",
      createdAt,
      completedAt: createdAt,
      context,
      configSnapshot: clone(agentConfigs[item.scenarioId]),
      result: materialize(templateId, context, id),
      display: { mode: "text", chart: "recommended", selected: null },
      sourcePortfolioRecord: true,
      projectionStatus: "history"
    };
  }

  const importedHistory = Object.freeze([
    historyRun("portfolio-s002-execution", "2026-08-15 08:00:00"),
    historyRun("portfolio-s003-tier", "2026-08-17 16:34:00")
  ]);

  function hydrateState(value) {
    const state = clone(value || {});
    state.activeConfig = clone(agentConfigs.S001);
    const managedScenarioIds = new Set(Object.keys(agentConfigs));
    state.enabledConfigs = [...(state.enabledConfigs || [])].filter((item) => (
      !managedScenarioIds.has(item.sceneId) &&
      !Object.values(agentConfigs).some((config) => config.id === item.id)
    ));
    Object.values(agentConfigs).forEach((config) => {
      if (!state.enabledConfigs.some((item) => item.id === config.id)) state.enabledConfigs.push(clone(config));
    });
    state.liveRuns = [...(state.liveRuns || [])].map(sanitizeRunCopy);
    state.historyRuns = [...(state.historyRuns || [])].map(sanitizeRunCopy);
    importedHistory.forEach((run) => {
      if (![...(state.liveRuns || []), ...state.historyRuns].some((item) => item.id === run.id)) state.historyRuns.push(clone(run));
    });
    const combined = recommendations.map((item) => ({
      ...clone(item),
      resourceLabels: (item.resources || []).map((id) => semanticResources[id]?.name || base.resourceById[id]?.name || id)
    }));
    if (state.recommendations?.status !== "生成中") {
      state.recommendations = { ...(state.recommendations || {}), status: "成功", items: combined, generatedAt: state.recommendations?.generatedAt || "2026-08-22 09:00:00", error: null };
    }
    const current = scenarioContext("S001");
    state.currentScenario = "S001";
    state.scenarioContext = {
      id: current.scenarioId,
      name: current.scenarioName,
      version: current.scenarioVersion,
      runId: current.scenarioRunId,
      formedAt: current.scenarioFormedAt,
      source: "组合运行注册表",
      status: current.scenarioStatus
    };
    const selectedRun = [...state.liveRuns, ...state.historyRuns].find((run) => run.id === state.currentRunId);
    if (selectedRun && (!selectedRun.sourcePortfolioRecord || !String(selectedRun.context?.projectionId || "").startsWith("OFW-COMPOSITE-CURRENT-"))) {
      state.currentRunId = null;
    }
    state.portfolioIntegration = { version: "1.1.0", domains: ["S001", "S002", "S003"], mode: "single-assistant-domain-bindings" };
    return state;
  }

  const extendedDomain = {
    ...base,
    RESOURCES: [...resourcesForScenario("S001"), ...Object.values(semanticResources)],
    resourceById: { ...Object.fromEntries(resourcesForScenario("S001").map((item) => [item.id, item])), ...semanticResources },
    RECOMMENDED_QUESTIONS: recommendations,
    RESULT_TEMPLATES: { ...base.RESULT_TEMPLATES, ...queryTemplates },
    createInitialState: () => hydrateState(base.createInitialState()),
    loadState: (storageKey) => hydrateState(base.loadState(storageKey)),
    resetState: (storageKey, currentState, resetRequest) => hydrateState(base.resetState(storageKey, currentState, resetRequest)),
    resolveQuestion: (text) => matchQuestion(text)?.templateId || base.resolveQuestion(text),
    readRuntimeContext: () => scenarioContext("S001"),
    readOntologyContext: () => scenarioContext("S001"),
    readOntologyBindingContext: () => scenarioContext("S001"),
    readPublishedOntologyContext: () => ({ ...scenarioContext("S001"), semanticReady: true, discoverable: true, formalAnswerable: true, answerabilityStatus: "可正式问数", answerabilityReason: "" }),
    matchApplicableAgents: (text, configs) => matchAgents(matchQuestion(text), configs),
    recommendationEligibility: (question, config, runtime) => {
      const item = typeof question === "string" ? recommendations.find((candidate) => candidate.id === question) : question;
      if (item?.notApplicable) return { eligible: true, reason: "该业务域由报告伴读承接", gate: { passed: true, issues: [] } };
      const matched = item?.scenarioId ? item : item ? { ...item, scenarioId: "S001", templateId: item.templateId || item.id } : null;
      const effectiveConfig = agentConfigs[matched?.scenarioId] || config;
      const gate = matched ? validateQuestion(matched, effectiveConfig, scenarioContext(matched.scenarioId)) : { passed: false, issues: ["问题无法定位"] };
      return { eligible: gate.passed, reason: gate.passed ? "已绑定该业务域的精确运行上下文" : gate.issues[0], gate };
    },
    recommendableQuestions: (config, runtime) => {
      return recommendations.map((item) => ({ ...clone(item), eligibility: extendedDomain.recommendationEligibility(item, agentConfigs[item.scenarioId]) }));
    },
    resourceFromContext: (context, id) => (context?.resources || []).find((item) => item.id === id) || semanticResources[id] || base.resourceFromContext(context, id),
    materializeResult: (templateId, context, runId, queryContext) => ["S001", "S002", "S003"].includes(context?.scenarioId) ? materialize(templateId, context, runId, queryContext) : base.materializeResult(templateId, context, runId, queryContext),
    verifyFixedResult: (result, context, config) => ["S001", "S002", "S003"].includes(context?.scenarioId) ? verifyResult(result, context, config, matchQuestion(result?.question || "") || { scenarioId: context.scenarioId, templateId: result?.id, resources: result?.resourceIds || [] }) : base.verifyFixedResult(result, context, config),
    csvEligibility: (run, scenario) => run?.sourcePortfolioRecord ? csvEligibility(run) : base.csvEligibility(run, scenario)
  };

  function openReportCopilot() {
    const detailRoute = "#/agents/preflight-report-copilot";
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "navigate", module: "agent", route: "#module/agent", innerRoute: detailRoute, source: "M03", businessDomain: "S004" }, "*");
    }
    window.location.href = `../../../agent-application/Agent应用.html${detailRoute}`;
  }

  window.IQDomain = extendedDomain;
  window.IQ_PORTFOLIO = Object.freeze({
    version: "1.0.0",
    recommendations,
    agentConfigs,
    platformAgentConfig,
    sourceRefs,
    semanticResources,
    templates: queryTemplates,
    matchQuestion,
    matchAgents,
    validateQuestion,
    verifyResult,
    csvEligibility,
    sanitizeResultCopy,
    scenarioContext,
    materialize,
    hydrateState,
    hasAvailableDomains: () => true,
    openReportCopilot
  });
})();
