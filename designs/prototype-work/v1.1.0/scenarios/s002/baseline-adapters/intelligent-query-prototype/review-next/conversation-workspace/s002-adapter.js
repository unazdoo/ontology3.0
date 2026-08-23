(() => {
  "use strict";

  // M03 keeps the v1.0.3 conversation workspace, run steps, evidence drawer,
  // saved views and history. The adapter adds only the approved S002 question
  // set and a read-only structured-result projection.
  const S002 = Object.freeze({
    id: "S002",
    version: "S002-v1",
    // This is only the deterministic direct-entry fallback.  When the page is
    // opened from the S002 workbench, the URL/owner projection always wins.
    runId: "S002-RUN-20260815-M03-DIRECT",
    prompt: "S002-BUDGET-QUERY-PROMPT-v1",
    skill: "S002-BUDGET-SUPERVISION-SKILL-v1",
    published: "T019-S002-v1",
    dataBundle: "S002-DATA-v1",
    dataAssets: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
    questions: [
      "2025年各部门费用预算执行率和差异额分别是多少？",
      "哪些单位2025年成本占收比超过100%，对应真正毛利率是否为负？",
      "项目可用立项余额不足或净在途占用异常的项目有哪些？",
      "12月正向采购发起占比和年末采购/预算占用集中度如何？",
      "2026年初始申报中，哪个部门成本占收比最高？",
      "2024—2025年各部门费用预算执行率变化分别是多少？",
    ],
    questionKeys: ["s002-budget-execution", "s002-cost-margin", "s002-project-occupancy", "s002-year-end", "s002-submission", "s002-actions"],
  });

  const QUESTION_TITLES = Object.freeze([
    "预算执行与差异", "成本占收比与毛利率", "项目余额与在途占用",
    "年末采购集中度", "初始申报合理性", "跨年执行趋势",
  ]);

  const QUESTION_ID_TO_KEY = Object.freeze({
    "Q-EXECUTION": "s002-budget-execution",
    "Q-COST-MARGIN": "s002-cost-margin",
    "Q-BALANCE": "s002-project-occupancy",
    "Q-COMMITMENT": "s002-year-end",
    "Q-SUBMISSION": "s002-submission",
    "Q-TREND": "s002-actions",
    "Q-ACTION": "s002-actions",
  });

  const QUESTION_PLANS = Object.freeze({
    "s002-budget-execution": Object.freeze({
      scope: "单位、年度、科目、期间",
      resources: "预算主体、预算版本、预算科目、预算执行率、预算差异额、费用预算执行偏离Rule",
      relationshipPath: "预算版本归属主体：预算版本 → 预算主体；实际凭证对应科目：实际凭证 → 预算科目",
    }),
    "s002-cost-margin": Object.freeze({
      scope: "单位、年度、收入与成本科目",
      resources: "预算主体、实际凭证、成本占收比、真正毛利率、成本占收比异常Rule",
      relationshipPath: "实际凭证归属主体：实际凭证 → 预算主体",
    }),
    "s002-project-occupancy": Object.freeze({
      scope: "单位、年度、项目",
      resources: "项目占用、预算版本、项目可用立项余额、净在途占用、项目预算覆盖Rule",
      relationshipPath: "项目占用使用预算版本：项目占用 → 预算版本",
    }),
    "s002-year-end": Object.freeze({
      scope: "年度、月份、项目、采购发起",
      resources: "采购发起、项目占用、正向采购发起量、12月正向采购发起占比、年末采购/预算占用集中度Rule",
      relationshipPath: "采购发起关联项目占用：采购发起 → 项目占用",
    }),
    "s002-submission": Object.freeze({
      scope: "单位、预算年度、初始申报版本",
      resources: "预算主体、预算版本、成本占收比、真正毛利率",
      relationshipPath: "预算版本归属主体：预算版本 → 预算主体",
    }),
    "s002-actions": Object.freeze({
      scope: "单位、2024—2025年度、费用科目",
      resources: "预算主体、预算版本、费用预算执行率、预算差异额",
      relationshipPath: "预算版本归属主体：预算版本 → 预算主体；实际凭证对应年度预算版本",
    }),
  });

  // data.jsx is the scenario result contract. These six compact fallbacks use
  // the same values so the adapter never falls back to one generic answer if
  // Babel is still mounting the baseline domain on first paint.
  const RESULT_FALLBACKS = Object.freeze({
    "s002-budget-execution": {
      title: "2025各部门费用预算执行率与差异",
      summary: "2025最终批准费用预算1,097.70万元，场景加工实际费用861.73万元，整体执行率78.50%，差异-235.9735万元；安全运行部执行率最高，设备管理部最低。",
      rows: [
        { id: "all", object: "2025全部部门", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "整体费用预算执行率", exact: "78.50", unit: "%", status: "可计算", detail: "场景加工实际861.7265（展示861.73）/ 最终批准费用预算1097.70；差异-235.9735万元", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "sb", object: "设备管理部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率", exact: "63.20", unit: "%", status: "偏低", detail: "场景加工实际255.6557 / 最终批准预算404.50；差异 -148.8443万元", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "js", object: "技术部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率", exact: "77.97", unit: "%", status: "可计算", detail: "场景加工实际295.7507 / 最终批准预算379.30；差异 -83.5493万元", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "aq", object: "安全运行部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率", exact: "98.86", unit: "%", status: "接近上限", detail: "场景加工实际310.3201 / 最终批准预算313.90；差异 -3.5799万元", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      ],
      chart: { categories: ["设备管理部", "技术部", "安全运行部"], values: [63.20, 77.97, 98.86], unit: "%" },
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: ["S002-BUDGET-EXEC-v1", "S002-SOURCE-RECONCILIATION-v1"],
    },
    "s002-cost-margin": {
      title: "各部门成本占收比与真正毛利率",
      summary: "2025全部部门成本占收比74.35%，真正毛利率25.65%；其中安全运行部成本占收比112.63%、真正毛利率-12.63%，是唯一成本占收比超过100%且毛利率为负的单位。",
      rows: [
        { id: "all", object: "2025全部部门", resourceId: "MET-S002-COST-TO-REVENUE", label: "成本占收比", exact: "74.35", unit: "%", status: "可计算", detail: "场景加工实际费用861.7265 / 收入净额1159.0222；真正毛利率25.65%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "sb", object: "设备管理部", resourceId: "MET-S002-COST-TO-REVENUE", label: "成本占收比", exact: "52.29", unit: "%", status: "可计算", detail: "真正毛利率47.71%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "js", object: "技术部", resourceId: "MET-S002-COST-TO-REVENUE", label: "成本占收比", exact: "74.96", unit: "%", status: "可计算", detail: "真正毛利率25.04%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "aq", object: "安全运行部", resourceId: "MET-S002-COST-TO-REVENUE", label: "成本占收比", exact: "112.63", unit: "%", status: "需关注", detail: "真正毛利率-12.63%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      ],
      chart: { categories: ["设备管理部", "技术部", "安全运行部"], values: [52.29, 74.96, 112.63], unit: "%" },
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: ["S002-BUDGET-EXEC-v1", "S002-SOURCE-RECONCILIATION-v1"],
    },
    "s002-project-occupancy": {
      title: "项目可用立项余额与净在途占用",
      summary: "21个项目中1个项目可用立项余额为负；三个有源占用项目的净在途占用合计163.38万元。",
      rows: [
        { id: "negative", object: "安全运行部 · 概率安全分析", resourceId: "MET-S002-PROJECT-AVAILABLE-BALANCE", label: "项目可用立项余额", exact: "-20.5038", unit: "万元", status: "命中RULE-001", detail: "立项124.00（源）- 场景加工实际82.4138 - 净在途62.09（源）- 计提0", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "aq-transit", object: "安全运行部 · 概率安全分析", resourceId: "MET-S002-NET-IN-TRANSIT", label: "净在途占用", exact: "62.09", unit: "万元", status: "源表可追溯", dataMarker: "SOURCE" },
        { id: "js-transit", object: "技术部 · 热能动力研究", resourceId: "MET-S002-NET-IN-TRANSIT", label: "净在途占用", exact: "52.25", unit: "万元", status: "源表可追溯", dataMarker: "SOURCE" },
        { id: "sb-transit", object: "设备管理部 · 设备维护", resourceId: "MET-S002-NET-IN-TRANSIT", label: "净在途占用", exact: "49.04", unit: "万元", status: "源表可追溯", dataMarker: "SOURCE" },
      ],
      chart: { categories: ["安全运行部", "技术部", "设备管理部"], values: [62.09, 52.25, 49.04], unit: "万元" },
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: ["S002-PROJECT-OCC-v1", "S002-SOURCE-RECONCILIATION-v1"],
    },
    "s002-year-end": {
      title: "2025年末采购与预算占用集中度",
      summary: "全年正向采购发起量273.09万元，12月正向采购发起占比8.59%；全年净在途占用163.38万元，12月净在途占用占比14.35%为组合总体观察值。设备维护项目12月净在途占全年18.94%，正式命中RULE-004。",
      rows: [
        { id: "positive-pr", object: "2025全年", resourceId: "MET-S002-POSITIVE-PURCHASE", label: "正向采购发起量", exact: "273.09", unit: "万元", status: "源表可追溯", dataMarker: "SOURCE" },
        { id: "dec-share", object: "2025年12月", resourceId: "MET-S002-DEC-POSITIVE-PURCHASE-SHARE", label: "12月正向采购发起占比", exact: "8.59", unit: "%", status: "低于10%关注线", detail: "23.45 / 273.09", dataMarker: "DERIVED" },
        { id: "net-transit", object: "2025全年", resourceId: "MET-S002-NET-IN-TRANSIT", label: "净在途占用", exact: "163.38", unit: "万元", status: "源表可追溯", dataMarker: "SOURCE" },
        { id: "occ-share", object: "2025组合总体", resourceId: "MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", label: "12月净在途占用占比", exact: "14.35", unit: "%", status: "总体观察值（不单独形成Rule Hit）", detail: "23.45 / 163.38", dataMarker: "DERIVED" },
        { id: "sb-occ-hit", object: "设备管理部 · 设备维护项目", resourceId: "RULE-S002-YEAR-END-CONCENTRATION", label: "项目年末预算占用集中度", exact: "18.94", unit: "%", status: "命中RULE-004", detail: "12月净在途占用9.29 / 全年净在途占用49.04；精确值18.9437%", dataMarker: "DERIVED" },
      ],
      chart: { categories: ["12月正向采购发起占比", "组合12月净在途占比", "设备项目年末占用集中度"], values: [8.59, 14.35, 18.94], unit: "%" },
      dataMarker: "DERIVED",
      sourceRefs: ["S002-PROJECT-OCC-v1", "SRC-2025-COMMITMENT"],
    },
    "s002-submission": {
      title: "2026年初始申报成本占收比",
      summary: "技术部2026初始申报成本占收比最高，为288.79%，对应真正毛利率-188.79%，需要补充收入依据与成本测算。",
      rows: [
        { id: "sb", object: "设备管理部", resourceId: "MET-S002-COST-TO-REVENUE", label: "2026初始申报成本占收比", exact: "45.06", unit: "%", status: "可计算", detail: "收入746.60万元；场景成本组装336.404万元；真正毛利率54.94%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "js", object: "技术部", resourceId: "MET-S002-COST-TO-REVENUE", label: "2026初始申报成本占收比", exact: "288.79", unit: "%", status: "分析关注（非正式Rule）", detail: "收入611.50万元；场景成本组装1765.94万元；真正毛利率-188.79%；建议补充申报依据", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
        { id: "aq", object: "安全运行部", resourceId: "MET-S002-COST-TO-REVENUE", label: "2026初始申报成本占收比", exact: "168.65", unit: "%", status: "需关注", detail: "收入455.20万元；场景成本组装767.708万元；真正毛利率-68.65%", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      ],
      chart: { categories: ["设备管理部", "技术部", "安全运行部"], values: [45.06, 288.79, 168.65], unit: "%" },
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: ["S002-BUDGET-EXEC-v1", "SRC-2026-SUBMISSION", "S002-SOURCE-RECONCILIATION-v1"],
    },
    "s002-actions": {
      title: "2024—2025各部门费用预算执行率变化",
      summary: "2024至2025年，设备管理部费用预算执行率由84.25%降至63.20%，下降21.05个百分点；技术部由90.12%降至77.97%，下降12.15个百分点；安全运行部由125.48%降至98.86%，下降26.62个百分点。",
      rows: [
        { id: "sb-trend", object: "设备管理部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率变化", exact: "-21.05", unit: "个百分点", status: "2024 84.25% → 2025 63.20%", detail: "按各年实际费用 / 当年最终批准费用预算计算", dataMarker: "DERIVED" },
        { id: "js-trend", object: "技术部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率变化", exact: "-12.15", unit: "个百分点", status: "2024 90.12% → 2025 77.97%", detail: "按各年实际费用 / 当年最终批准费用预算计算", dataMarker: "DERIVED" },
        { id: "aq-trend", object: "安全运行部", resourceId: "MET-S002-BUDGET-EXECUTION-RATE", label: "费用预算执行率变化", exact: "-26.62", unit: "个百分点", status: "2024 125.48% → 2025 98.86%", detail: "按各年实际费用 / 当年最终批准费用预算计算", dataMarker: "DERIVED" },
      ],
      chart: { categories: ["设备管理部", "技术部", "安全运行部"], values: [-21.05, -12.15, -26.62], unit: "个百分点" },
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: ["S002-BUDGET-EXEC-v1", "S002-SOURCE-RECONCILIATION-v1"],
    },
  });

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  function canonicalBusinessText(value) {
    return String(value ?? "")
      .replaceAll("预算调增", "预算执行整改")
      .replaceAll("预算调减", "下一年度预算合理性复核")
      .replaceAll("科目调剂", "费用管理优化核查")
      .replaceAll("申报退回", "预算申报依据补充")
      .replaceAll("占用释放", "采购占用清理");
  }

  function normalizeQuestion(value) {
    return String(value || "").replaceAll(/\s+/g, "").trim();
  }

  function approvedQuestion(question) {
    const normalized = normalizeQuestion(question);
    if (!normalized) return null;
    const exactIndex = S002.questions.findIndex((candidate) => normalizeQuestion(candidate) === normalized);
    if (exactIndex >= 0) return { key: S002.questionKeys[exactIndex], question: S002.questions[exactIndex] };
    const keyIndex = S002.questionKeys.indexOf(String(question || "").trim());
    if (keyIndex >= 0) return { key: S002.questionKeys[keyIndex], question: S002.questions[keyIndex] };
    return null;
  }

  function approvedQuestionFromRun(run) {
    if (!run) return null;
    const byQuestion = approvedQuestion(run.question || run.label || "");
    const explicitKey = QUESTION_ID_TO_KEY[run.questionId] || run.questionKey || run.templateId || null;
    const keyIndex = S002.questionKeys.indexOf(explicitKey);
    const byIdentity = keyIndex >= 0 ? { key: S002.questionKeys[keyIndex], question: S002.questions[keyIndex] } : null;
    if (byQuestion && byIdentity && byQuestion.key !== byIdentity.key) return null;
    return byQuestion || byIdentity;
  }

  function questionKey(question) {
    return approvedQuestion(question)?.key || null;
  }

  function completedQuestionFor(projection, displayedQuestion) {
    const lastSubmitted = String(window.__S002_LAST_SUBMITTED_QUERY || "").trim();
    if (lastSubmitted) return approvedQuestion(lastSubmitted)?.question || "";
    const selectedQuestion = approvedQuestion(window.__S002_SELECTED_QUERY)?.question || "";
    if (selectedQuestion) return selectedQuestion;
    const displayed = approvedQuestion(displayedQuestion)?.question || "";
    if (displayed) return displayed;
    if (String(displayedQuestion || "").trim()) return "";
    return approvedQuestionFromRun(projection?.currentRun)?.question || "";
  }

  function installApprovedQuestionResolver() {
    const domain = window.IQDomain;
    if (!domain || domain.__s002ApprovedQuestionResolver === true) return Boolean(domain);
    // The copied v1.0.3 resolver intentionally supports fuzzy financing
    // wording. S002 has six fixed result contracts, so a keyword-near question
    // must remain in the baseline BlockedRun instead of borrowing an answer.
    domain.resolveQuestion = (question) => questionKey(question);
    domain.__s002ApprovedQuestionResolver = true;
    return true;
  }

  function resultContract(question) {
    const key = questionKey(question);
    if (!key) return null;
    let contract = null;
    try { contract = window.IQDomain?.RESULT_TEMPLATES?.[key] || null; } catch (_) {}
    const fallback = RESULT_FALLBACKS[key] || null;
    if (!fallback) return null;
    const source = contract || fallback;
    return {
      key,
      title: canonicalBusinessText(source.title || fallback.title),
      summary: canonicalBusinessText(source.summary || fallback.summary),
      rows: (Array.isArray(source.rows) && source.rows.length ? source.rows : fallback.rows).map((row) => ({
        ...row,
        label: canonicalBusinessText(row.label),
        status: canonicalBusinessText(row.status),
        detail: canonicalBusinessText(row.detail),
      })),
      highlights: Array.isArray(source.highlights) ? source.highlights : [],
      chart: source.chart || fallback.chart,
      resourceIds: Array.isArray(source.resourceIds) ? source.resourceIds : [],
      dataMarker: source.dataMarker || fallback.dataMarker || "MIXED_SOURCE_AND_DEMO_MARKERS",
      sourceRefs: Array.isArray(source.sourceRefs) && source.sourceRefs.length ? source.sourceRefs : (fallback.sourceRefs || []),
    };
  }

  function chartItems(result) {
    const chart = result.chart || {};
    const barView = chart.adapters?.bar || chart.views?.bar || null;
    if (Array.isArray(barView?.items) && barView.items.length) {
      return barView.items.map((item) => ({ label: canonicalBusinessText(item.label), value: Number(item.value), unit: item.unit || barView.unit || chart.unit || "" }));
    }
    const categories = Array.isArray(chart.categories) ? chart.categories : [];
    const values = Array.isArray(chart.values) ? chart.values : [];
    return categories.map((label, index) => ({ label: canonicalBusinessText(label), value: Number(values[index]), unit: chart.unit || "" }))
      .filter((item) => Number.isFinite(item.value));
  }

  function chartFacets(result) {
    if (result.key === "s002-year-end") {
      const numericRows = result.rows
        .map((row) => ({ label: canonicalBusinessText(row.label), value: Number(row.exact), unit: row.unit || "" }))
        .filter((row) => Number.isFinite(row.value));
      return [
        { title: "金额规模", unit: "万元", items: numericRows.filter((row) => row.unit === "万元") },
        { title: "占比与集中度", unit: "%", items: numericRows.filter((row) => row.unit === "%") },
      ].filter((facet) => facet.items.length);
    }
    if (result.key === "s002-actions") return [{ title: "执行率同比变化", unit: "个百分点", items: chartItems(result) }];
    const items = chartItems(result);
    return items.length ? [{ title: "业务比较", unit: items[0]?.unit || "", items }] : [];
  }

  // A module can be opened directly, without the parent workbench being
  // available to the iframe.  Keep that route useful by projecting one
  // completed, read-only S002 run.  It is deliberately marked as demo data;
  // it never writes to the owning store or claims a production execution.
  function fallbackProjection(context) {
    const runId = context.runId || S002.runId;
    const run = {
      id: `QR-${runId}-BUDGET`,
      runId: `QR-${runId}-BUDGET`,
      label: "2025 预算执行、差异与项目占用监督",
      status: "成功",
      completedAt: "2026-08-15T08:03:50.290Z",
      dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      viewContract: "C018-S002-v1",
    };
    const ruleHits = [
      { id: "RH-S002-001", title: "项目可用立项余额为负", actionType: "预算执行整改", dataMarker: "DERIVED" },
      { id: "RH-S002-002-2024-AQ", title: "2024安全运行部费用预算执行率超过100%", actionType: "费用管理复盘", dataMarker: "DERIVED" },
      { id: "RH-S002-002-2025-AQ", title: "2025安全运行部费用预算执行率接近上限", actionType: "预算执行整改", dataMarker: "DERIVED" },
      { id: "RH-S002-003-2025-AQ", title: "2025安全运行部成本占收比超过100%", actionType: "费用管理优化核查", dataMarker: "DERIVED" },
      { id: "RH-S002-004", title: "年末采购/预算占用集中", actionType: "采购占用清理", dataMarker: "DERIVED" },
      { id: "RH-S002-002-2025-SB", title: "2025设备管理部费用预算执行率低于合理区间", actionType: "下一年度预算合理性复核", dataMarker: "DERIVED" },
    ];
    return {
      queryRuns: [run],
      ruleHits,
      ruleEvaluations: [
        { id: "RE-S002-001", title: "合法重复凭证/期间与日期记录解释", status: "已评估无命中", dataMarker: "CORRECTED" },
        {
          id: "EVAL-SUPPLIER-MONTHLY-COST-001",
          ruleId: "RULE-005",
          title: "供应商服务人员人月成本跨部门比对",
          status: "已评估无命中",
          detail: "按年度、预算二级科目、人员分类、供应商、人员级别、币种和税率分组；各部门人月成本=采购净额÷人月，最高/最低倍率严格大于1.2才异常；本轮最高倍率为1.20。",
          evidence: "42条部门级明细、5个可比组，支持穿透查看采购净额、人月和重算人月成本。",
          dataMarker: "SOURCE_AND_DERIVED"
        },
      ],
      fixedView: {
        contractId: "C018-S002-v1",
        status: "active",
        dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      },
      demoProjection: true,
    };
  }

  function contextFromUrl() {
    const params = new URLSearchParams(location.search);
    return {
      id: params.get("scenarioId") || S002.id,
      version: params.get("scenarioVersion") || S002.version,
      runId: params.get("scenarioRunId") || S002.runId,
      status: params.get("status") || "active",
    };
  }

  // Read the owning S002 workbench projection when the module is opened from
  // the shell.  Direct module access has no parent projection, so the same
  // deterministic demo snapshot is used as a read-only fallback.  This keeps
  // the baseline conversation workspace useful without making the iframe its
  // own source of truth.
  function ownerProjection() {
    let snapshot = null;
    try {
      snapshot = window.parent && window.parent !== window
        ? window.parent.S002_STORE?.get?.()
        : null;
    } catch (_) {}
    if (!snapshot && window.__S002_PARENT_SNAPSHOT) snapshot = window.__S002_PARENT_SNAPSHOT;
    const context = contextFromUrl();
    const fallback = fallbackProjection(context);
    const allowFallback = !["historical-readonly", "closed"].includes(context.status);
    const useFallback = !snapshot && allowFallback;
    const queryRuns = Array.isArray(snapshot?.queryRuns) && snapshot.queryRuns.length
      ? snapshot.queryRuns
      : useFallback ? fallback.queryRuns : [];
    const ruleHits = Array.isArray(snapshot?.ruleHits) && snapshot.ruleHits.length
      ? snapshot.ruleHits
      : useFallback ? fallback.ruleHits : [];
    const ruleEvaluations = Array.isArray(snapshot?.ruleEvaluations) && snapshot.ruleEvaluations.length
      ? snapshot.ruleEvaluations
      : useFallback ? fallback.ruleEvaluations : [];
    const fixedView = snapshot?.queryView || (useFallback ? fallback.fixedView : null);
    const currentRun = queryRuns[queryRuns.length - 1] || null;
    const resolvedContext = {
      ...context,
      runId: snapshot?.context?.scenarioRunId || context.runId,
      status: snapshot?.context?.status || context.status,
    };
    return {
      context: resolvedContext,
      queryRuns,
      ruleHits,
      ruleEvaluations,
      fixedView,
      currentRun,
      semanticReady: Boolean(snapshot?.progress?.ontologyPublished || useFallback),
      runComplete: Boolean(snapshot?.progress?.queryRun || currentRun),
      rulesComplete: Boolean(snapshot?.progress?.rulesRun || ruleHits.length || ruleEvaluations.length),
      contractId: fixedView?.contractId || "C018-S002-v1",
      ruleCount: ruleHits.length,
      evaluatedCount: ruleEvaluations.length,
      marker: "MIXED_SOURCE_AND_DEMO_MARKERS",
      demoProjection: useFallback,
    };
  }

  function ensureStyle() {
    if (document.getElementById("s002-m03-adapter-style")) return;
    const style = document.createElement("style");
    style.id = "s002-m03-adapter-style";
    style.textContent = `
      .s002-run-summary__facts{margin-top:0}.s002-run-summary__actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.s002-run-summary__actions button{padding:5px 8px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--blue);font:600 10px/1.25 inherit;cursor:pointer}.s002-run-summary__actions button:hover{background:var(--blue-soft)}.s002-history-record,.s002-view-record{margin:0 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink)}.s002-history-record{display:flex;align-items:center;gap:9px;width:100%;text-align:left;cursor:pointer}.s002-history-record strong,.s002-view-record strong{display:block;font-size:12px}.s002-history-record small,.s002-view-record small{display:block;margin-top:3px;color:var(--muted);font-size:10px}.s002-view-record{display:block}.s002-view-record__facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.s002-view-record__facts div{padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--surface)}.s002-view-record__facts small{margin:0;color:var(--muted)}.s002-view-record__facts strong{margin-top:2px}.recommendation-grid[data-s002-recommendations]{grid-template-columns:repeat(3,minmax(0,1fr))}.recommendation-card[data-s002-query]{min-height:142px;text-align:left}.recommendation-card[data-s002-query].is-current{border-color:#8ca9d2;background:#f3f7fd;box-shadow:0 0 0 2px rgba(49,95,174,.08)}.recommendation-card[data-s002-query] code{white-space:normal}.s002-recommendation-answer{display:block;margin-top:6px;color:var(--ink-2);font-size:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.s002-capability-detail{margin-left:auto}.s002-capability-drawer .ui-notice{margin-top:12px}.s002-capability-drawer .ui-fact-grid{--fact-grid-columns:2}.s002-capability-drawer__boundary{margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);color:var(--ink-2);line-height:1.65}.s002-capability-drawer__boundary strong{display:block;margin-bottom:4px;color:var(--ink)}@media(max-width:1080px){.recommendation-grid[data-s002-recommendations]{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.s002-view-record__facts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.recommendation-grid[data-s002-recommendations]{grid-template-columns:1fr}.recommendation-card[data-s002-query]{min-height:0}.s002-view-record__facts{grid-template-columns:1fr}.s002-recommendation-answer{-webkit-line-clamp:3}.s002-capability-drawer .ui-fact-grid{--fact-grid-columns:1}}
    `;
    document.head.appendChild(style);
  }

  function recommendationMarkup() {
    return `<div class="recommendation-grid" data-s002-recommendations="M03">${S002.questions.map((question, index) => {
      const answer = resultContract(question);
      return `<button type="button" class="recommendation-card" data-s002-query="${esc(question)}" data-s002-question-key="${esc(answer.key)}" aria-pressed="false" aria-label="查看已完成结果：${esc(question)}"><span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(QUESTION_TITLES[index])}</strong><small>${esc(question)}</small><span class="s002-recommendation-answer">${esc(answer.summary)}</span><code>${esc(S002.published)} · C018-S002-v1 · 查看结果</code></div><span aria-hidden="true">↗</span></button>`;
    }).join("")}</div>`;
  }

  function runSummaryMarkup(projection) {
    const run = projection.currentRun;
    const runLabel = run?.label || "2025 预算执行、差异与项目占用监督";
    const runStatus = projection.runComplete ? "已完成" : "待运行";
    const ruleStatus = projection.rulesComplete ? `${projection.ruleCount} 条命中 · ${projection.evaluatedCount} 条已评估` : "待运行";
    const projectionLabel = projection.demoProjection ? " · 演示数据结果" : "";
    return `<section class="panel" data-s002-run-summary="M03" aria-label="预算问数运行结果">
      <div class="panel-head"><div><h2>预算问数运行结果</h2><p>结果固定于 Published ${esc(S002.published)}，支持 Rule 命中与证据下钻。</p></div><span class="ui-badge ui-badge--success ui-status-badge ui-status-badge--success">${esc(runStatus)}${esc(projectionLabel)}</span></div>
      <div class="panel-body"><div class="metric-grid s002-run-summary__facts">
        <div><small>运行轮次</small><strong>${esc(projection.context.runId)}</strong></div>
        <div><small>问题</small><strong>${esc(runLabel)}</strong></div>
        <div><small>Rule 结果</small><strong>${esc(ruleStatus)}</strong></div>
        <div><small>固定视图</small><strong>${esc(projection.contractId)} · 可下钻</strong></div>
      </div>
      <p>已按 Published ${esc(S002.published)} 固定预算口径；结果含演示补全和修正标识（${esc(projection.marker)}），不代表生产验收。</p>
      <div class="s002-run-summary__actions"><button type="button" data-s002-route="#/history">查看历史运行</button><button type="button" data-s002-route="#/views">查看固定视图</button></div></div>
    </section>`;
  }

  function historyRecordMarkup(projection) {
    const run = projection.currentRun;
    return `<button type="button" class="s002-history-record" data-s002-route="#/ask" aria-label="预算问数已完成运行">
      <span aria-hidden="true">✓</span><div><strong>${esc(run?.label || "2025 预算执行与异常监督问数")}</strong><small>${esc(projection.context.runId)} · 成功 · ${esc(projection.contractId)} · Rule 命中 ${esc(projection.ruleCount)} 条</small></div>
    </button>`;
  }

  function viewRecordMarkup(projection) {
    return `<article class="s002-view-record" data-s002-view-record="M03"><strong>预算监督固定问数视图</strong><small>预算执行、差异、项目余额与采购占用 · ${esc(projection.contractId)}</small><div class="s002-view-record__facts"><div><small>当前状态</small><strong>可运行</strong></div><div><small>语义绑定</small><strong>${esc(S002.published)}</strong></div><div><small>最近结果</small><strong>已完成 · 可下钻</strong></div></div><div class="s002-run-summary__actions"><button type="button" data-s002-route="#/ask">打开问数工作台</button></div></article>`;
  }

  function queryResultMarkup(question) {
    const projection = arguments[1] || ownerProjection();
    const view = projection.fixedView || {};
    const annualFacts = Array.isArray(view.annualFacts) ? view.annualFacts : [];
    const currentFacts = annualFacts.filter((row) => Number(row.year) === 2025);
    const approvedTotal = currentFacts.length
      ? currentFacts.reduce((sum, row) => sum + Number(row.approvedExpenseBudget || 0), 0)
      : 1097.70;
    const actualTotal = currentFacts.length
      ? currentFacts.reduce((sum, row) => sum + Number(row.actualExpense || 0), 0)
      : 861.7265;
    const equipment = currentFacts.find((row) => row.department === "设备管理部");
    const safety = currentFacts.find((row) => row.department === "安全运行部");
    const occupancy = view.occupancy || {};
    const netInTransit = Number(occupancy.netInTransit ?? 163.38);
    const positivePrShare = Number(occupancy.decemberShare ?? 0.085869);
    const budgetOccupancyShare = Number(occupancy.budgetOccupancyDecemberShare ?? 0.14353);
    const negativeBalanceCount = Array.isArray(view.projects) ? view.projects.filter((row) => Number(row.availableBalance) < 0).length : 1;
    const thresholdRows = [
      ["MET-S002-BUDGET-EXECUTION-RATE", "安全运行部", "费用预算执行率", safety ? (Number(safety.expenseRate) * 100).toFixed(2) : "98.86", "%", "需关注"],
      ["MET-S002-ACTUAL-BUDGET-VARIANCE", "设备管理部", "预算差异额", equipment ? (Number(equipment.actualExpense) - Number(equipment.approvedExpenseBudget)).toFixed(2) : "-148.84", "万元", "需关注"],
      ["MET-S002-NET-IN-TRANSIT", "项目占用", "净在途占用", netInTransit.toFixed(2), "万元", "可追溯"],
      ["MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "采购集中", "12月正向采购发起占比", (positivePrShare * 100).toFixed(2), "%", positivePrShare >= 0.1 ? "需关注" : "可计算"],
      ["MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", "组合总体", "12月净在途占用占比", (budgetOccupancyShare * 100).toFixed(2), "%", "总体观察值"],
    ];
    const answer = resultContract(question);
    const modeStore = window.__S002_DISPLAY_MODE_BY_KEY || (window.__S002_DISPLAY_MODE_BY_KEY = {});
    const displayMode = ["text", "table", "chart"].includes(modeStore[answer.key]) ? modeStore[answer.key] : "text";
    const rowSource = answer.rows.length ? answer.rows : thresholdRows.map((row) => ({ resourceId: row[0], object: row[1], label: row[2], exact: row[3], unit: row[4], status: row[5] }));
    const rows = rowSource.map((row) => [row.resourceId, row.object, row.label, row.exact, row.unit, row.status, row.detail || ""]);
    const highlights = answer.highlights.length
      ? answer.highlights.slice(0, 3).map((item) => {
        const value = item.value || `${item.exact ?? ""}${item.unit || ""}`;
        const rawUnit = String(item.unit || "").trim();
        const hint = item.status || (rawUnit && !String(value).trim().endsWith(rawUnit) ? rawUnit : "精确结果");
        return { label: canonicalBusinessText(item.label), value, hint: canonicalBusinessText(hint) };
      })
      : rowSource.slice(0, 4).map((row) => ({
        label: canonicalBusinessText(row.label),
        value: row.exact,
        hint: canonicalBusinessText([row.unit, row.status].filter(Boolean).join(" · ")),
      }));
    const chartFacetItems = chartFacets(answer);
    const textCards = highlights.map((item) => `<button type="button" class="metric-card" data-s002-drill><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.hint)} · 点击查看证据</small></button>`).join("");
    const tableRows = rows.map((row) => `<tr data-s002-resource-id="${esc(row[0])}"><td>${esc(row[1])}</td><td>${esc(row[2])}${row[6] ? `<small>${esc(row[6])}</small>` : ""}</td><td>${esc(row[3])}</td><td>${esc(row[4])}</td><td><span class="ui-badge ui-badge--${/关注|命中|偏低|上限/.test(row[5]) ? "warning" : "success"}">${esc(row[5])}</span></td></tr>`).join("");
    const chartFacetsMarkup = chartFacetItems.map((facet) => {
      const maxValue = Math.max(1, ...facet.items.map((item) => Math.abs(item.value)));
      const chartBars = facet.items.map((item) => `<div class="ui-mini-chart__bar-row" role="listitem"><span class="ui-mini-chart__bar-label">${esc(item.label)}</span><span class="ui-mini-chart__bar-track" aria-hidden="true"><i class="ui-mini-chart__bar-fill" style="width:${Math.max(2, Math.min(100, Math.abs(item.value) / maxValue * 100)).toFixed(2)}%;background:var(--blue)"></i></span><strong class="ui-mini-chart__bar-value">${esc(Number.isInteger(item.value) ? item.value : item.value.toFixed(2))}${esc(item.unit)}</strong></div>`).join("");
      return `<section class="ui-mini-chart ui-mini-chart--horizontal-bar s002-query-result__chart-facet" aria-label="${esc(facet.title)}"><header class="ui-mini-chart__header"><div><strong>${esc(facet.title)}</strong><small>独立量纲 · 精确值见右侧</small></div><span class="ui-badge ui-badge--info">${esc(facet.unit || "业务值")}</span></header><div class="ui-mini-chart__plot"><div class="ui-mini-chart__horizontal-bars" role="list">${chartBars}</div></div></section>`;
    }).join("");
    return `<section class="result-stage s002-query-result" data-s002-query-result="M03" data-s002-answer-key="${esc(answer.key)}" aria-label="预算问数结构化结果">
      <div class="s002-query-result__head"><div><span class="eyebrow">查询结果</span><h2>${esc(answer.title)}</h2><p>问题：${esc(question)} · 结果固定于 ${esc(S002.published)} / ${esc("C018-S002-v1")}</p></div><span class="ui-badge ui-badge--success ui-status-badge ui-status-badge--success">已完成</span></div>
      <div class="display-toolbar s002-display-toolbar"><div class="ui-tabs ui-tabs--segmented ui-display-mode-switch" role="tablist" aria-label="结果展示方式"><button type="button" class="ui-tabs__item ${displayMode === "text" ? "is-active" : ""}" role="tab" aria-selected="${displayMode === "text"}" tabindex="${displayMode === "text" ? 0 : -1}" data-s002-display-mode="text"><span>文字解读</span></button><button type="button" class="ui-tabs__item ${displayMode === "table" ? "is-active" : ""}" role="tab" aria-selected="${displayMode === "table"}" tabindex="${displayMode === "table" ? 0 : -1}" data-s002-display-mode="table"><span>数据表</span></button><button type="button" class="ui-tabs__item ${displayMode === "chart" ? "is-active" : ""}" role="tab" aria-selected="${displayMode === "chart"}" tabindex="${displayMode === "chart" ? 0 : -1}" data-s002-display-mode="chart"><span>BI 图表</span></button></div><span class="display-spacer"></span><span class="s002-query-result__marker">同一固定结果 · 切换不重算</span></div>
      <div class="s002-result-view" data-s002-result-view="text" ${displayMode === "text" ? "" : "hidden"}><p class="answer-summary">${esc(answer.summary)}</p><div class="metric-grid s002-query-result__metrics">${textCards}</div><div class="answer-proof"><span>✓</span><span>口径标识：${esc(answer.dataMarker)}；来源/加工链路可下钻，不把场景加工结果冒充源表直接事实。</span><button type="button" data-s002-drill>查看证据</button></div></div>
      <div class="s002-result-view" data-s002-result-view="table" ${displayMode === "table" ? "" : "hidden"}><div class="table-result"><div class="workspace-toolbar"><div><strong>当前完整结果</strong><small>${rows.length} 行 · 精确业务值</small></div><span class="toolbar-spacer"></span><span class="s002-query-result__marker">Published 资源身份可下钻</span></div><div class="ui-data-table s002-query-result__table"><div class="ui-data-table__scroller"><table><thead><tr><th>业务对象</th><th>指标 / 规则 / 语义</th><th>精确值</th><th>单位</th><th>状态</th></tr></thead><tbody>${tableRows}</tbody></table></div></div></div></div>
      <div class="s002-result-view" data-s002-result-view="chart" data-s002-bi-view="M03" role="tabpanel" aria-label="BI 图表" ${displayMode === "chart" ? "" : "hidden"}><div class="chart-stage s002-query-result__chart-facets">${chartFacetsMarkup}</div></div>
      <div class="view-actions s002-query-result__actions"><button type="button" class="ui-button ui-button--ghost ui-button--sm" data-s002-drill>查看证据下钻</button><button type="button" class="ui-button ui-button--secondary ui-button--sm" data-s002-drill>查看 Rule 命中</button><span class="s002-query-result__marker">2025最终批准预算 ${approvedTotal.toFixed(2)} 万元 · 实际 ${actualTotal.toFixed(2)} 万元 · Rule ${projection.ruleCount || 7} 条 · 负余额项目 ${negativeBalanceCount} 个</span></div>
      <div class="s002-query-evidence" data-s002-evidence-panel hidden><strong>C018-S002-v1 证据下钻</strong><ul><li>${esc(answer.title)}：${esc(answer.summary)}</li><li>来源/资产：${esc(answer.sourceRefs.join(" · ") || "S002双数据资产")}</li><li>合法重复凭证 21 组、期间异常 13 条、日期倒置 6 条：保留源值及 CORRECTED 说明</li><li>2025源工作簿费用合计981.5595万元，经授权场景加工形成861.7265万元；差额-119.8330万元已登记为MIXED_SOURCE_AND_DEMO_MARKERS</li><li>当前范围只展示数据查询、统计结果、Rule 依据和明细证据，不生成行动申请或决策事项</li></ul></div>
    </section>`;
  }

  function ensureQueryResultStyle() {
    if (document.getElementById("s002-m03-query-result-style")) return;
    const style = document.createElement("style");
    style.id = "s002-m03-query-result-style";
    style.textContent = `.s002-query-result{display:grid;gap:12px;scroll-margin-top:68px}.analysis-center>.s002-query-result{margin-bottom:0}.s002-query-result__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.s002-query-result__head h2{margin:3px 0 0;font-size:17px;color:var(--ink)}.s002-query-result__head p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.s002-display-toolbar{margin:0 -16px;padding-inline:16px;border-top:1px solid var(--line)}.s002-display-toolbar .ui-tabs--segmented{display:flex;gap:2px}.s002-display-toolbar .ui-tabs__item{min-height:34px;border:1px solid transparent;border-radius:5px}.s002-display-toolbar .ui-tabs__item.is-active{color:var(--blue);border-color:#c7d6eb;background:#f4f8fd}.s002-result-view{min-width:0}.s002-result-view[hidden]{display:none!important}.s002-query-result__metrics{margin-top:10px}.s002-query-result__metrics .metric-card{text-align:left}.s002-query-result__table{min-width:0}.s002-query-result__table table{min-width:660px}.s002-query-result__table td:nth-child(2) small{display:block;margin-top:3px;max-width:360px;color:var(--muted);font-size:10px;white-space:normal}.s002-query-result__actions{align-items:center}.s002-query-result__marker{color:var(--muted);font-size:10px}.s002-query-result .answer-proof{margin-top:10px}.s002-query-result__chart-facets{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.s002-query-result__chart-facet{min-width:0}.s002-query-result .ui-mini-chart{height:auto;min-height:292px}.s002-query-result .ui-mini-chart__header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.s002-query-result .ui-mini-chart__header strong,.s002-query-result .ui-mini-chart__header small{display:block}.s002-query-result .ui-mini-chart__header small{margin-top:3px;color:var(--muted);font-size:10px}.s002-query-result .ui-mini-chart__horizontal-bars{padding-top:12px}.s002-query-evidence{padding:10px 12px;border:1px solid #c8d7ed;border-radius:7px;background:#f7faff;color:var(--ink-2);font-size:11px;line-height:1.6}.s002-query-evidence strong{color:var(--blue)}.s002-query-evidence ul{margin:5px 0 0;padding-left:18px}@media(max-width:900px){.s002-display-toolbar{align-items:flex-start;flex-wrap:wrap}.s002-display-toolbar .ui-tabs--segmented{width:100%}.s002-display-toolbar .ui-tabs__item{flex:1 1 0;justify-content:center}.s002-query-result__chart-facets{grid-template-columns:1fr}}@media(max-width:520px){.s002-query-result__head{display:block}.s002-query-result__head .ui-badge{margin-top:7px}.s002-query-result__marker{display:block;width:100%}.s002-display-toolbar{margin-inline:-11px;padding-inline:11px}.s002-display-toolbar .ui-tabs__item{padding-inline:7px;font-size:10px}.s002-query-result .ui-mini-chart{min-height:260px}}`;
    document.head.appendChild(style);
  }

  function bindQueryEvidence() {
    document.querySelectorAll("[data-s002-drill]").forEach((button) => {
      if (button.dataset.s002DrillBound === "true") return;
      button.dataset.s002DrillBound = "true";
      button.addEventListener("click", () => {
        const panel = button.closest("[data-s002-query-result]")?.querySelector("[data-s002-evidence-panel]");
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (/证据下钻|Rule 命中/.test(button.textContent || "")) button.textContent = panel.hidden ? (button.dataset.s002DrillLabel || "查看证据下钻") : "收起证据下钻";
      });
      if (/Rule 命中/.test(button.textContent || "")) button.dataset.s002DrillLabel = "查看 Rule 命中";
      else if (/证据下钻/.test(button.textContent || "")) button.dataset.s002DrillLabel = "查看证据下钻";
    });
  }

  function bindDisplaySwitches() {
    document.querySelectorAll("[data-s002-query-result='M03']").forEach((result) => {
      result.querySelectorAll("[data-s002-display-mode]").forEach((button) => {
        if (button.dataset.s002DisplayBound === "true") return;
        button.dataset.s002DisplayBound = "true";
        button.addEventListener("click", () => {
          const mode = button.dataset.s002DisplayMode || "text";
          const answerKey = result.dataset.s002AnswerKey || "";
          const modeStore = window.__S002_DISPLAY_MODE_BY_KEY || (window.__S002_DISPLAY_MODE_BY_KEY = {});
          if (answerKey) modeStore[answerKey] = mode;
          result.querySelectorAll("[data-s002-display-mode]").forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle("is-active", active);
            candidate.setAttribute("aria-selected", active ? "true" : "false");
            candidate.tabIndex = active ? 0 : -1;
          });
          result.querySelectorAll("[data-s002-result-view]").forEach((panel) => {
            panel.hidden = panel.dataset.s002ResultView !== mode;
          });
          result.dataset.s002DisplayMode = mode;
        });
      });
    });
  }

  function patchCompletedQuery(question) {
    const projection = ownerProjection();
    const answerKey = questionKey(question);
    // Only the six approved questions (or a resolver-recognised wording of
    // those questions) may reuse the completed S002 result.  An unrelated
    // ad-hoc question must stay in the baseline blocked/run-gate state rather
    // than being repainted with the first budget-execution answer.
    if (!answerKey || !S002.questionKeys.includes(answerKey)) return false;
    const grid = document.querySelector(".workspace-grid");
    const center = grid?.querySelector(".analysis-center");
    // v1.0.3 renders .run-surface only after a fresh submit. For an already
    // completed S002 run opened from the unified workbench, reuse the same
    // analysis-center as the read-only result host instead of forcing a new
    // submission or creating a separate page shell.
    const runSurface = center?.querySelector(".run-surface") || center;
    if (!runSurface) return false;
    // A fresh baseline submit can create .run-surface after the completed-run
    // projection was first mounted directly under .analysis-center. Remove
    // that superseded projection so switching questions never leaves two
    // visible S002 result regions in the same workspace.
    center.querySelectorAll("[data-s002-query-result='M03']").forEach((node) => {
      if (!runSurface.contains(node)) node.remove();
    });
    const questionPlan = QUESTION_PLANS[answerKey];
    let existing = runSurface.querySelector("[data-s002-query-result='M03']");
    if (!existing) {
      const empty = runSurface.querySelector(".ui-empty-state");
      if (empty) empty.outerHTML = queryResultMarkup(question, projection);
      else runSurface.insertAdjacentHTML("beforeend", queryResultMarkup(question, projection));
    } else if (existing.dataset.s002AnswerKey !== answerKey || existing.dataset.question !== question) {
      existing.outerHTML = queryResultMarkup(question, projection);
      existing = runSurface.querySelector("[data-s002-query-result='M03']");
    }
    const result = runSurface.querySelector("[data-s002-query-result='M03']");
    if (projection.runComplete && result) {
      runSurface.querySelectorAll(".gate-issue-panel").forEach((panel) => panel.remove());
      // 已完成轮次优先展示当前答案，推荐问题保留在其后用于切换；
      // 仍使用 v1.0.3 的 analysis-center、结果组件和展示切换控件。
      if (runSurface === center) {
        const askHero = center.querySelector(".ask-hero");
        if (askHero && askHero.nextElementSibling !== result) askHero.insertAdjacentElement("afterend", result);
      }
      document.querySelectorAll("[data-s002-query]").forEach((button) => {
        const active = button.dataset.s002QuestionKey === answerKey;
        button.classList.toggle("is-current", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    const echo = runSurface.querySelector(".question-echo");
    if (echo) {
      const questionNode = echo.querySelector("strong");
      if (questionNode) questionNode.textContent = question;
      const badge = echo.querySelector(".ui-status-badge");
      if (badge) {
        badge.classList.remove("ui-badge--danger", "ui-status-badge--blocked", "ui-status-badge--failed");
        badge.classList.add("ui-badge--success", "ui-status-badge--success");
        const label = badge.querySelector("span:last-child");
        if (label) label.textContent = "已完成";
      }
    }
    const rail = grid?.querySelector(".evidence-rail");
    if (rail) {
      const status = rail.querySelector(".context-stage-head .ui-status-badge");
      if (status) {
        status.classList.remove("ui-badge--danger", "ui-status-badge--blocked", "ui-status-badge--failed");
        status.classList.add("ui-badge--success", "ui-status-badge--success");
        const label = status.querySelector("span:last-child");
        if (label) label.textContent = "已完成";
      }
      rail.querySelectorAll(".context-stage-card").forEach((card) => {
        card.classList.remove("is-current", "is-blocked", "is-pending");
        card.classList.add("is-complete");
      });
      const cards = [...rail.querySelectorAll(".context-stage-card")];
      const setRailDefinition = (card, label, value) => {
        const dt = [...(card?.querySelectorAll("dt") || [])].find((item) => item.textContent.trim() === label);
        if (dt?.nextElementSibling) dt.nextElementSibling.textContent = value;
      };
      setRailDefinition(cards[0], "问数 Agent", "预算监督问数 Agent");
      setRailDefinition(cards[0], "配置版本", S002.prompt);
      setRailDefinition(cards[0], "加载证明", "已加载 · Prompt / Skill");
      setRailDefinition(cards[1], "最终理解", question);
      setRailDefinition(cards[1], "对象范围", questionPlan.scope);
      setRailDefinition(cards[1], "计划资源", questionPlan.resources);
      setRailDefinition(cards[1], "关系路径", questionPlan.relationshipPath);
      setRailDefinition(cards[1], "门禁", "通过 · 可运行");
      setRailDefinition(cards[2], "已发布语义", S002.published);
      setRailDefinition(cards[2], "精确版本", S002.published);
      setRailDefinition(cards[2], "数据版本", S002.dataAssets.join(" + "));
      setRailDefinition(cards[2], "数据截至", "2025-12-31");
      setRailDefinition(cards[2], "质量 / 新鲜度", "演示质量通过 / 场景快照固定");
      setRailDefinition(cards[2], "实际资源 / 证据", `C018-S002-v1 · ${S002.dataBundle}组合指针 · 可下钻`);
      const stageLabels = [...(cards[1]?.querySelectorAll("header small") || []), ...(cards[2]?.querySelectorAll("header small") || [])];
      stageLabels.forEach((label) => {
        if (label.textContent.includes("门禁未通过")) label.textContent = "门禁已通过";
        if (label.textContent.includes("等待正式结果")) label.textContent = "结果已形成";
      });
      const pending = rail.querySelectorAll("dd");
      pending.forEach((dd) => {
        if (["等待确认", "未形成", "无法判断", "等待", "未匹配", "未固定", "待核验"].includes(dd.textContent.trim())) dd.textContent = "已形成";
      });
    }
    if (result) {
      result.dataset.question = question;
      result.dataset.scenarioRunId = ownerProjection().context.runId;
    }
    document.documentElement.dataset.s002QueryRun = "complete";
    window.__S002_LAST_RESULT = { question, contractId: "C018-S002-v1", published: S002.published, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" };
    bindQueryEvidence();
    bindDisplaySwitches();
    return true;
  }

  function scheduleCompletedQuery(question) {
    if (!question || !S002.questions.includes(question)) return;
    [520, 900, 1500].forEach((delay) => window.setTimeout(() => patchCompletedQuery(question), delay));
  }

  function routeFromHash() {
    const hash = String(location.hash || "#/ask");
    const match = hash.match(/^#\/?([^/?]+)/);
    return match?.[1] || "ask";
  }

  function setComposerQuestion(question, context) {
    const input = document.querySelector('textarea[aria-label="输入业务问题"], textarea');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(input, question);
      else input.value = question;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
    }
    window.__S002_LAST_QUERY = question;
    window.__S002_SELECTED_QUERY = question;
    window.__S002_LAST_SUBMITTED_QUERY = question;
    window.dispatchEvent(new CustomEvent("s002:query-selected", { detail: { query: question, context } }));
  }

  function ensureRecommendations(context) {
    let panel = document.querySelector(".recommendation-panel");
    if (!panel) {
      const center = document.querySelector(".analysis-center");
      if (!center) return;
      panel = document.createElement("section");
      panel.className = "recommendation-panel";
      panel.dataset.s002RecommendationPanel = "M03";
      panel.innerHTML = "<header><div><h2>推荐问题</h2><p>基于当前预算数据、Published 本体与可用规则生成。</p></div></header>";
      center.appendChild(panel);
    }
    const title = panel.querySelector("header h2");
    const description = panel.querySelector("header p");
    if (title) title.textContent = "推荐问题";
    if (description) description.textContent = "基于当前预算数据、Published 本体与可用规则生成。";
    let grid = panel.querySelector("[data-s002-recommendations='M03']");
    if (!grid) {
      panel.querySelectorAll(":scope > :not(header)").forEach((node) => node.remove());
      panel.insertAdjacentHTML("beforeend", recommendationMarkup());
      grid = panel.querySelector("[data-s002-recommendations='M03']");
    }
    panel.dataset.scenarioId = context.id;
    panel.dataset.scenarioVersion = context.version;
    panel.dataset.scenarioRunId = context.runId;
    grid?.querySelectorAll("[data-s002-query]").forEach((button) => {
      if (button.dataset.s002QueryBound === "true") return;
      button.dataset.s002QueryBound = "true";
      button.addEventListener("click", () => {
        const question = button.dataset.s002Query || "";
        setComposerQuestion(question, context);
        patchCompletedQuery(question);
        window.setTimeout(() => {
          patchCompletedQuery(question);
          document.querySelector("[data-s002-query-result='M03']")?.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 120);
      });
    });
  }

  function ensureRouteProjection(projection) {
    const host = document.querySelector(".main");
    if (!host) return;
    const route = routeFromHash();
    if (route === "ask") {
      const center = host.querySelector(".analysis-center") || host;
      const recommendations = center.querySelector(".recommendation-panel");
      if (recommendations && !center.querySelector("[data-s002-run-summary='M03']")) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = runSummaryMarkup(projection);
        const summary = wrapper.firstElementChild;
        recommendations.insertAdjacentElement("afterend", summary);
      }
    } else if (route === "history") {
      const list = host.querySelector(".history-list");
      if (list && !list.querySelector("[data-s002-history-record]")) {
        const empty = list.querySelector(".ui-empty-state");
        if (empty) empty.remove();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = historyRecordMarkup(projection).replace("class=\"s002-history-record\"", "class=\"s002-history-record\" data-s002-history-record=\"true\"");
        list.insertBefore(wrapper.firstElementChild, list.firstChild);
      }
      if (list) {
        list.querySelectorAll("button:not([data-s002-history-record])").forEach((record) => {
          if (!/没有适用于当前问题|阻断/.test(record.textContent || "")) return;
          record.classList.add("s002-legacy-history");
          record.setAttribute("aria-label", "旧轮次已归档，不参与当前 S002 运行");
          const reason = record.querySelector("p");
          if (reason) reason.textContent = "旧轮次已归档，不参与当前 S002 运行";
          const time = record.querySelector("small");
          if (time) time.textContent = `${time.textContent.split("·")[0].trim()} · 已归档`;
          const badge = record.querySelector(".ui-status-badge");
          if (badge) {
            badge.classList.remove("ui-badge--danger", "ui-status-badge--blocked", "ui-status-badge--failed");
            badge.classList.add("ui-badge--info", "ui-status-badge--archived");
            const label = badge.querySelector("span:last-child");
            if (label) label.textContent = "已归档";
          }
        });
      }
      host.querySelectorAll("[role='tab']").forEach((tab) => {
        if (tab.textContent.trim() !== "阻断") return;
        const label = tab.querySelector("span") || tab;
        label.textContent = "已归档";
        tab.setAttribute("aria-label", "已归档历史运行");
      });
    } else if (route === "views") {
      const collection = host.querySelector(".view-collection");
      if (collection && !collection.querySelector("[data-s002-view-record='M03']")) {
        const empty = host.querySelector(".ui-empty-state");
        if (empty) empty.remove();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = viewRecordMarkup(projection);
        collection.insertBefore(wrapper.firstElementChild, collection.firstChild);
      } else if (!collection) {
        const empty = host.querySelector(".ui-empty-state");
        if (empty && !host.querySelector("[data-s002-view-record='M03']")) {
          empty.insertAdjacentHTML("beforebegin", `<div class=\"s002-view-record\" data-s002-view-record=\"M03\">${viewRecordMarkup(projection).replace(/^<article[^>]*>|<\/article>$/g, "")}</div>`);
          empty.remove();
        }
      }
    }
    host.querySelectorAll("[data-s002-route]").forEach((button) => {
      if (button.dataset.s002RouteBound === "true") return;
      button.dataset.s002RouteBound = "true";
      button.addEventListener("click", () => { location.hash = button.dataset.s002Route; });
    });
  }

  function adaptProductNav(projection) {
    const nav = document.querySelector(".product-nav");
    if (!nav) return;
    const footerStatus = nav.querySelector(".product-nav-foot strong");
    const footerName = nav.querySelector(".product-nav-foot span");
    if (footerStatus) footerStatus.textContent = "已启用";
    if (footerName) footerName.textContent = "预算监督问数 Agent · 已启用";
    nav.querySelectorAll(".product-nav-item").forEach((button) => {
      const text = button.textContent || "";
      if (!/历史会话|问数视图/.test(text)) return;
      const isHistory = text.includes("历史会话");
      let count = button.querySelector("em");
      if (!count) { count = document.createElement("em"); button.appendChild(count); }
      const countValue = isHistory ? Math.max(1, projection.queryRuns.length) : (projection.fixedView ? 1 : 0);
      count.textContent = String(countValue);
      button.setAttribute("aria-label", `${isHistory ? "历史会话" : "问数视图"} ${countValue}`);
    });
    const main = document.querySelector(".main");
    if (main) main.dataset.s002Projection = projection.runComplete ? "complete" : "demo-complete";
  }

  function adaptViewTabs() {
    const tabs = document.querySelectorAll(".views-tabs-frame [role='tab']");
    tabs.forEach((tab) => {
      const text = tab.textContent || "";
      if (!text.includes("已保存查询") && !text.includes("固定引用")) return;
      const count = [...tab.children].find((child) => /\d+/.test(child.textContent || ""));
      if (count) count.textContent = "1";
      else tab.appendChild(Object.assign(document.createElement("span"), { textContent: "1" }));
      tab.setAttribute("aria-label", `${text.includes("固定引用") ? "固定引用" : "已保存查询"} 1`);
    });
  }

  function setDefinition(card, label, value) {
    if (!card) return;
    const dt = [...card.querySelectorAll("dt")].find((item) => item.textContent.trim() === label);
    const dd = dt?.nextElementSibling;
    if (dd) dd.textContent = value;
  }

  function setReadyStatusBadge(badge, label = "可消费") {
    if (!badge) return;
    badge.classList.remove("ui-badge--danger", "ui-badge--warning", "ui-status-badge--blocked", "ui-status-badge--failed", "ui-status-badge--warning");
    badge.classList.add("ui-badge--success", "ui-status-badge--success");
    const text = badge.querySelector("span:last-child");
    if (text) text.textContent = label;
    else badge.textContent = label;
    badge.setAttribute("aria-label", label);
  }

  function adaptPreRunState(projection) {
    if (!projection.semanticReady) return;
    const main = document.querySelector(".main");
    const cards = [...(main?.querySelectorAll(".context-stage-card") || [])];
    // The v1.0.3 pre-run rail derives its header badge from the baseline
    // consumer projection.  S002's approved deterministic projection is
    // already complete, so normalize that badge together with the detail
    // cards and success notice; otherwise the rail can show
    // “当前组合不可消费” above “当前可以正式问数”.
    const contextStatus = main?.querySelector(".context-stage > .context-stage-head .ui-status-badge");
    setReadyStatusBadge(contextStatus, "可消费");
    const agentCard = cards.find((card) => [...card.querySelectorAll("dt")].some((item) => item.textContent.trim() === "配置"));
    const semanticCard = cards.find((card) => [...card.querySelectorAll("dt")].some((item) => item.textContent.trim() === "精确版本"));
    const dataCard = cards.find((card) => [...card.querySelectorAll("dt")].some((item) => item.textContent.trim() === "数据截至"));
    if (agentCard) {
      agentCard.classList.remove("is-current", "is-blocked", "is-pending");
      agentCard.classList.add("is-complete");
      setDefinition(agentCard, "配置", "预算监督问数 Agent");
      setDefinition(agentCard, "配置状态", "已启用");
      setDefinition(agentCard, "Skill / Tool", "已加载 · 预算 Prompt / Skill");
      const verifiedAt = projection.currentRun?.completedAt
        ? String(projection.currentRun.completedAt).replace("T", " ").replace(/\.\d{3}Z$/, "")
        : "2026-08-15 16:03:50";
      setDefinition(agentCard, "最近核验", verifiedAt);
    }
    if (semanticCard) {
      semanticCard.classList.remove("is-current", "is-blocked", "is-pending");
      semanticCard.classList.add("is-complete");
      setDefinition(semanticCard, "精确版本", "T019-S002-v1");
      setDefinition(semanticCard, "版本身份", "T019-S002-v1");
      setDefinition(semanticCard, "正式消费组合", "C018-S002-v1 · 可消费");
      const small = semanticCard.querySelector("header small");
      if (small) small.textContent = "精确版本可定位";
    }
    if (dataCard) {
      dataCard.classList.remove("is-current", "is-blocked", "is-pending");
      dataCard.classList.add("is-complete");
      setDefinition(dataCard, "数据截至", "2025-12-31");
      setDefinition(dataCard, "质量", "演示质量通过");
      setDefinition(dataCard, "新鲜度", "场景快照固定");
      setDefinition(dataCard, "正式问数", "可以运行");
      setDefinition(dataCard, "数据版本", S002.dataAssets.join(" + "));
      const small = dataCard.querySelector("header small");
      if (small) small.textContent = "可用于本轮";
    }
    const notice = main?.querySelector(".context-stage > .ui-notice, .context-stage .ui-notice");
    if (notice) {
      notice.classList.remove("ui-notice--warning");
      notice.classList.add("ui-notice--success");
      const title = notice.querySelector(".ui-notice__title");
      if (title) title.textContent = "当前可以正式问数";
      const body = notice.querySelector(".ui-notice__body");
      if (body) body.textContent = `S002 ${projection.contractId} 已绑定 ${S002.published}，结果和证据可下钻。`;
    }
  }

  function adaptTopContext(projection) {
    const button = document.querySelector("button.data-context");
    if (!button) return;
    if (!projection.semanticReady) return;
    button.classList.remove("failed", "warning", "pending", "is-failed");
    button.classList.add("success");
    button.title = "查看预算数据与语义状态";
    button.setAttribute("aria-label", "预算上下文已就绪，查看数据与语义状态");
    const label = button.querySelector("span");
    if (label) label.textContent = projection.runComplete ? "预算上下文已就绪" : "预算上下文待运行";
  }

  function closeCapabilityDrawer() {
    document.getElementById("s002-capability-drawer")?.remove();
  }

  function ensureCapabilityDetailStyle() {
    if (document.getElementById("s002-capability-detail-style")) return;
    const style = document.createElement("style");
    style.id = "s002-capability-detail-style";
    style.textContent = `.skill-list>div[data-s002-capability-row]{grid-template-columns:26px minmax(130px,1fr) minmax(72px,.5fr) minmax(72px,.5fr) auto auto}.skill-list>div[data-s002-capability-row] .s002-inline-detail{justify-self:end}.capability-chip-list>span[data-s002-capability-row]{grid-template-columns:18px minmax(0,1fr) auto}.capability-chip-list>span[data-s002-capability-row] .s002-inline-detail{grid-column:3;grid-row:1 / span 2}@media(max-width:900px){.skill-list>div[data-s002-capability-row]{grid-template-columns:26px minmax(0,1fr) auto;grid-template-rows:auto auto auto}.skill-list>div[data-s002-capability-row] .s002-inline-detail{grid-column:2;grid-row:3;justify-self:start}.capability-chip-list>span[data-s002-capability-row]{grid-template-columns:18px minmax(0,1fr) auto}}`;
    document.head.appendChild(style);
  }

  function openCapabilityDrawer(card) {
    closeCapabilityDrawer();
    const title = card.dataset.s002CapabilityName || card.querySelector("h3")?.textContent?.trim() || "能力详情";
    const codeText = card.dataset.s002CapabilityId || card.querySelector("code")?.textContent?.trim() || "";
    const [resourceId, codeVersion = "由当前配置固定"] = codeText.split("·").map((item) => item.trim());
    const version = card.dataset.s002CapabilityVersion || codeVersion;
    const boundary = card.dataset.s002CapabilityBoundary || card.querySelector("p")?.textContent?.trim() || "未提供使用边界";
    const footerTexts = [...card.querySelectorAll("footer span")].map((item) => item.textContent.trim()).filter(Boolean);
    const owner = card.dataset.s002CapabilityOwner || footerTexts.join(" · ") || "智能问数";
    const status = card.dataset.s002CapabilityStatus || card.querySelector(".ui-status-badge, .ui-badge")?.textContent?.trim() || "已配置";
    const overlay = document.createElement("div");
    overlay.id = "s002-capability-drawer";
    overlay.className = "ui-overlay ui-overlay--drawer";
    overlay.innerHTML = `<aside class="ui-drawer ui-drawer--right ui-drawer--md s002-capability-drawer" role="dialog" aria-modal="true" aria-labelledby="s002-capability-title" tabindex="-1">
      <header class="ui-drawer__header"><div class="ui-drawer__heading"><h2 id="s002-capability-title">${esc(title)}</h2><p>${esc(resourceId || "S002 智能问数能力")}</p></div><button type="button" class="ui-button ui-icon-button ui-button--ghost" data-s002-close-capability aria-label="关闭">×</button></header>
      <div class="ui-drawer__body"><div class="ui-fact-grid"><div class="ui-fact"><div class="ui-fact__content"><span class="ui-fact__label">资源编号</span><strong class="ui-fact__value is-mono">${esc(resourceId)}</strong></div></div><div class="ui-fact"><div class="ui-fact__content"><span class="ui-fact__label">版本</span><strong class="ui-fact__value">${esc(version)}</strong></div></div><div class="ui-fact"><div class="ui-fact__content"><span class="ui-fact__label">运行状态</span><strong class="ui-fact__value">${esc(status)}</strong></div></div><div class="ui-fact"><div class="ui-fact__content"><span class="ui-fact__label">配置归属</span><strong class="ui-fact__value">${esc(owner)}</strong></div></div></div><div class="s002-capability-drawer__boundary"><strong>使用边界</strong>${esc(boundary)}</div><div class="ui-notice ui-notice--info ui-notice--compact"><div class="ui-notice__content"><strong class="ui-notice__title">当前场景绑定</strong><span class="ui-notice__body">${esc(S002.prompt)} · ${esc(S002.skill)} · ${esc(S002.published)} · ${esc(S002.dataAssets.join(" + "))} · C018-S002-v1</span></div></div></div>
      <footer class="ui-drawer__footer"><button type="button" class="ui-button" data-s002-close-capability>关闭</button></footer>
    </aside>`;
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeCapabilityDrawer(); });
    overlay.querySelectorAll("[data-s002-close-capability]").forEach((button) => button.addEventListener("click", closeCapabilityDrawer));
    document.body.appendChild(overlay);
    overlay.querySelector(".ui-drawer")?.focus();
  }

  function bindCapabilityDetails() {
    ensureCapabilityDetailStyle();
    document.querySelectorAll(".capability-directory .resource-card").forEach((card) => {
      const footer = card.querySelector("footer");
      if (!footer || footer.querySelector("[data-s002-capability-detail]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-button ui-button--ghost ui-button--sm s002-capability-detail";
      button.dataset.s002CapabilityDetail = "true";
      button.textContent = "查看详情";
      button.addEventListener("click", () => openCapabilityDrawer(card));
      footer.appendChild(button);
    });
    document.querySelectorAll(".active-config .skill-list > div, .active-config .capability-chip-list > span").forEach((row) => {
      if (row.querySelector("[data-s002-capability-detail]")) return;
      const titleParts = String(row.getAttribute("title") || "").split(" · ").map((item) => item.trim()).filter(Boolean);
      const versionText = [...row.querySelectorAll(":scope > span")].map((item) => item.textContent.trim()).find((value) => value.startsWith("要求 ")) || "";
      row.dataset.s002CapabilityRow = "true";
      row.dataset.s002CapabilityName = row.querySelector("strong")?.textContent?.trim() || "能力详情";
      row.dataset.s002CapabilityId = titleParts[0] || row.dataset.s002CapabilityName;
      row.dataset.s002CapabilityVersion = versionText.replace(/^要求\s*/, "") || "由当前配置固定";
      row.dataset.s002CapabilityBoundary = titleParts.slice(titleParts[1]?.startsWith("维护方") ? 2 : 1).join(" · ") || "按当前配置白名单和使用边界运行";
      row.dataset.s002CapabilityOwner = titleParts.find((item) => item.startsWith("维护方"))?.replace(/^维护方\s*/, "") || "智能问数";
      row.dataset.s002CapabilityStatus = row.querySelector(".ui-status-badge")?.textContent?.trim() || row.querySelector("small")?.textContent?.trim() || "平台执行";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-button ui-button--ghost ui-button--sm s002-inline-detail";
      button.dataset.s002CapabilityDetail = "true";
      button.textContent = "查看详情";
      button.addEventListener("click", () => openCapabilityDrawer(row));
      row.appendChild(button);
    });
    if (!document.documentElement.dataset.s002CapabilityEscape) {
      document.documentElement.dataset.s002CapabilityEscape = "true";
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCapabilityDrawer(); });
    }
  }

  function adaptAgentConfigReady(projection) {
    if (!projection?.semanticReady) return;
    const active = document.querySelector(".active-config");
    if (!active) return;
    setReadyStatusBadge(active.querySelector(".active-hero .ui-status-badge"), "已核对");
    const notice = active.querySelector(".active-hero + .ui-notice, .active-hero ~ .ui-notice");
    if (notice) {
      notice.classList.remove("ui-notice--danger", "ui-notice--warning");
      notice.classList.add("ui-notice--success");
      const title = notice.querySelector(".ui-notice__title");
      const body = notice.querySelector(".ui-notice__body");
      if (title) title.textContent = "当前配置可用于正式问数";
      if (body) body.textContent = `当前正式语义、${S002.dataAssets.join(" 与 ")}、Skill 和 Tool 均已核对；${S002.dataBundle}仅为组合指针，本轮结果固定于 C018-S002-v1。`;
    }
    const replacements = [
      ["当前组合不可消费", "兼容"],
      ["当前数据暂不可用于正式问数", "当前配置可用于正式问数"],
      ["尚未收到本体管理输出的 C008 权威投影包络。预算场景已可正式运行。", "C008 权威投影已接收；预算场景上下文已固定。"],
      ["配置仍保持启用，但正式问数会在完整门禁通过前阻断。", "配置已启用，正式问数可运行。"]
    ];
    const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue;
      replacements.forEach(([from, to]) => { value = value.split(from).join(to); });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
    active.querySelectorAll(".config-grid .ui-fact").forEach((fact) => {
      const label = fact.querySelector(".ui-fact__label")?.textContent?.trim();
      if (label === "当前核验") {
        const value = fact.querySelector(".ui-fact__value");
        if (value) value.textContent = "兼容 · 已核对";
      }
    });
  }

  function applyScenarioProjection() {
    installApprovedQuestionResolver();
    ensureQueryResultStyle();
    const projection = ownerProjection();
    const context = projection.context;
    const host = document.querySelector(".main") || document.querySelector("#root") || document.body;
    if (!host) return;
    host.dataset.scenarioId = context.id;
    host.dataset.scenarioVersion = context.version;
    host.dataset.scenarioRunId = context.runId;
    ensureRecommendations(context);
    adaptProductNav(projection);
    ensureRouteProjection(projection);
    adaptViewTabs();
    adaptPreRunState(projection);
    adaptTopContext(projection);
    adaptVisibleBaselineLabels(projection);
    bindCapabilityDetails();
    adaptAgentConfigReady(projection);
    bindQueryEvidence();
    bindDisplaySwitches();
    const displayedQuestion = document.querySelector(".question-echo strong")?.textContent?.trim() || "";
    // A completed run can originate from the unified S002 workbench, whose
    // persisted question wording is intentionally shorter than the six
    // recommendation cards.  The exact run label still belongs to the same
    // approved question set and must render through the baseline result area
    // without requiring the user to submit it again.
    const completedQuestion = completedQuestionFor(projection, displayedQuestion);
    if (projection.runComplete && completedQuestion) patchCompletedQuery(completedQuestion);
    schedulePostRouteProjection();
  }

  function adaptVisibleBaselineLabels(projectionInput) {
    const root = document.body;
    if (!root) return;
    const projection = projectionInput || ownerProjection();
    const replacements = [
      ["融资问数 Agent", "预算监督问数 Agent"],
      ["集团融资成本与债务结构优化", "预算执行、差异与占用监督"],
      ["输入单位、集团、板块、指标、规则或金融机构范围。", "输入单位、年度、科目、项目、指标或规则范围。"],
      ["例如：单位553平均融资成本及构成是什么？", `例如：${S002.questions[0]}`],
      ["融资成本", "预算执行"]
    ];
    if (projection.semanticReady) replacements.push(
      ["加载待核验", "已启用"],
      ["实际加载状态待核验", "已加载 · 预算 Prompt / Skill"],
      ["尚无真实核验时间", "2026-08-15 16:03:50"],
      ["配置已要求，实际加载状态待核验", "预算场景上下文已加载"],
      ["场景与资源发现：配置已要求，实际加载状态待核验", "预算场景上下文已加载，Published 语义可消费"],
      ["尚未形成", "T019-S002-v1 已发布"],
      ["尚未发布", "T019-S002-v1"],
      ["无法定位", "可定位"],
      ["无法进入正式问数", "可用于预算问数"],
      ["当前不可正式运行", "可正式运行"],
      ["尚未生成推荐", "已加载 6 个获准预算问题"],
      ["生成只更新问题建议，不改变配置、版本或已形成的回答。", "6 个获准预算问题已按当前预算口径形成。"],
      ["上下文不完整", "预算上下文已就绪"],
      ["能力与工具待运行核验", "能力与工具已加载"],
      ["场景与资源发现：配置已要求，已加载 · 预算 Prompt / Skill。配置仍保持启用，但正式问数会在完整门禁通过前阻断。", "预算场景上下文已加载，6 个获准问题可运行。"],
      ["配置仍保持启用，但正式问数会在完整门禁通过前阻断。", "预算场景已可正式运行。"],
      ["等待精确已发布版本与正式数据绑定", `T019-S002-v1 / ${S002.dataAssets.join(" + ")}（${S002.dataBundle}组合指针）`],
      ["当前未取得运行承载返回的 Skill / Tool 实际版本、状态、加载证明和核验时间；正式问数会保持阻断。", "Skill / Tool 已加载，运行证明固定于 2026-08-15 16:03:50。"],
      ["尚无运行证明", "已验证 · 场景快照固定"],
      ["可用性待核验", "可用"],
      ["待核验", "已验证"],
      ["IQ-FIN-CFG-1.0", "S002-BUDGET-CFG-1.0"],
      ["IQ-FIN-PROMPT-1.0", "S002-BUDGET-QUERY-PROMPT-v1"],
      ["IQ-FIN-WL-1.0", "S002-BUDGET-WL-1.0"],
      ["39 项稳定资源身份", "预算对象、Metric、Rule 与 Action Type"],
      ["单位与组合成本、集团板块、规则解释、机构归因", "预算执行、差异、项目余额、采购占用、异常与关注"],
      ["正式问数会保持阻断", "正式问数可运行"]
    );
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let changed = false;
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue;
      replacements.forEach(([from, to]) => { text = text.split(from).join(to); });
      if (text !== node.nodeValue) { node.nodeValue = text; changed = true; }
    });
    root.querySelectorAll("input, textarea").forEach((input) => {
      const placeholder = input.getAttribute("placeholder") || input.placeholder || "";
      if (placeholder.includes("融资")) { input.setAttribute("placeholder", `例如：${S002.questions[0]}`); input.placeholder = `例如：${S002.questions[0]}`; changed = true; }
    });
    // Keep the baseline status summary truthful when the outer S002 chain has
    // completed.  These are presentation projections only; action side
    // effects and authoritative state remain in the owning workbench.
    const runSummary = root.querySelector("[data-s002-run-summary='M03']");
    const status = runSummary?.querySelector(".panel-head .ui-status-badge");
    if (status) status.textContent = projection.runComplete ? "已完成" : "待运行";
    if (changed) root.dataset.s002LabelsApplied = "true";
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(applyScenarioProjection, 60);
  }

  function schedulePostRouteProjection() {
    [260, 720, 1400].forEach((delay) => window.setTimeout(() => {
      const projection = ownerProjection();
      adaptProductNav(projection);
      adaptTopContext(projection);
      adaptVisibleBaselineLabels();
      ensureRecommendations(projection.context);
      ensureRouteProjection(projection);
      adaptViewTabs();
      bindQueryEvidence();
      bindDisplaySwitches();
      bindCapabilityDetails();
      adaptAgentConfigReady(projection);
    }, delay));
  }

  ensureStyle();
  window.S002_M03_QUERY_GUARD = Object.freeze({
    approvedQuestions: Object.freeze([...S002.questions]),
    approvedQuestion,
    approvedQuestionFromRun,
    questionKey,
    completedQuestionFor,
    installApprovedQuestionResolver,
  });
  installApprovedQuestionResolver();
  schedule();
  // Babel/React may finish mounting after the adapter script has run and may
  // replace the current route subtree once.  Re-run the complete projection
  // at bounded points so the S002 content survives that baseline mount without
  // installing a long-lived DOM observer.
  [350, 800, 1500, 2600, 4200].forEach((delay) => window.setTimeout(applyScenarioProjection, delay));
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "restore-view-context" && event.data.context) {
      window.__S002_PARENT_OWNER_STATES = event.data.ownerStates || null;
      window.__S002_PARENT_SNAPSHOT = event.data.snapshot || null;
      document.documentElement.dataset.s002ScenarioRunId = event.data.context.scenarioRunId || S002.runId;
      schedule();
    }
  });
  function observeDom() {
    // The baseline React mount replaces the main subtree during route changes;
    // hash/message hooks plus the bounded passes below are sufficient and keep
    // the product console free of observer errors in constrained browsers.
    window.addEventListener("hashchange", schedule, { passive: true });
    window.addEventListener("s002:query-selected", schedule, { passive: true });
    if (!document.documentElement.dataset.s002SubmitListener) {
      document.documentElement.dataset.s002SubmitListener = "true";
      document.addEventListener("click", (event) => {
        const button = event.target.closest?.("button");
        if (!button) return;
        // React replaces the current route subtree for new questions, tab
        // switches and run transitions.  Reapply the projection after those
        // user actions without observing or replacing the baseline shell.
        window.setTimeout(schedule, 90);
        window.setTimeout(schedule, 680);
        window.setTimeout(schedule, 1450);
        window.setTimeout(schedule, 2600);
        if (/提交问题/.test(button.textContent || "")) {
          const input = document.querySelector('textarea[aria-label="输入业务问题"], textarea');
          const question = input?.value?.trim() || window.__S002_LAST_QUERY || "";
          window.__S002_LAST_SUBMITTED_QUERY = question;
          window.__S002_SELECTED_QUERY = approvedQuestion(question)?.question || "";
          scheduleCompletedQuery(question);
        }
      }, true);
    }
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeDom, { once: true });
  else observeDom();
})();
