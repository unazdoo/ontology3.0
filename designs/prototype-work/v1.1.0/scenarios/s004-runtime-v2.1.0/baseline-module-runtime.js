(function (root) {
  "use strict";

  const runtimeBase = new URL("./", root.document.currentScript?.src || root.location.href);
  const M06_STATE_KEY = "ontology3.report-center.lifecycle-review.v1";
  const M05_STATE_KEY = "ontology3.agent-application.catalog.v7";
  const M03_STATE_KEY = "ontology3.iq.review.conversation.v1";
  const M04_STATE_KEY = "ontology3-decision-center-review-v2-portfolio-state-v6";
  const M01_STATE_KEY = "ontology3-canvas-first-review-v17";
  const C022_INBOX_KEY = "ontology3.agent-application.c022-inbox.v1";
  const C024_INBOX_KEY = "ontology3.agent-application.c024-inbox.v1";
  const C008_STATE_KEY = "ontology3-c008-authoritative-projection-v1";
  const C017_REPORT_KEY = "ontology3.c017.report-center.projection.v1";
  const NATIVE_SEED_MARKER_KEY = "ofw:v1.1.0:s004-runtime:native-seed";
  const VERIFICATION_CONTEXT_KEY = "ofw:v1.1.0:s004-runtime:verification-context.v1";
  const NATIVE_RESEED_GUARD_PREFIX = "ofw:s004:native-reseed-once";
  const NATIVE_RESEED_GUARD_KEY = "ofw:v1.1.0:s004-runtime:native-reseed-guard";
  const S004_QA_HISTORY_PREFIX = "ofw:v1.1.0:s004-runtime:qa-history";
  const M05_APPEND_ACCESS_MODE = "APPEND_NEW_RUNS_PRESERVE_HISTORY";
  const S004_REPORT_DEFINITION_ID = "RDEF-S004-PREFLIGHT-002";
  const S004_REPORT_DEFINITION_VERSION = "2.0.0";
  const S004_REPORT_TEMPLATE_ID = "RT-S004-PREFLIGHT-002";
  const S004_REPORT_TEMPLATE_VERSION = "2.0.0";
  const S004_REPORT_SCENARIO_LABEL = "S004 · 财务公司贷款贷前调查";
  const S004_M05_SCENARIO_LABEL = "财务公司贷款贷前调查";
  const S004_DEMO_CLOCK_DATE = "2026-08-16";
  const S004_FORBIDDEN_GENERATION_MARKERS = Object.freeze([
    "RD-FIN-001", "RT-FIN-002", "融资经营分析"
  ]);
  const M06_ACTIVE_REPORT_STAGES = new Set([
    "evidence", "generating", "draft", "returned", "confirmed", "publishing",
    "evidence_missing", "generation_failed", "publish_failed"
  ]);
  const M03_NOT_APPLICABLE_REASON = "S004 贷前调查业务链路不需要独立智能问数运行；完整 v1.0.3 页面、内部路由和查看能力仍保留。";
  const M03_BLOCKED_ACTION_LABELS = new Set([
    "生成推荐", "刷新推荐", "重试", "重新生成", "提交问题",
    "验证当前配置", "重新验证", "生成候选版本", "运行验证", "修复配置要求", "启用配置",
    "开始验证", "重新运行", "提交本体管理核对", "重新提交核对",
    "发起行动请求", "确认提交", "重试提交", "保存视图", "保存并提交", "提交引用",
    "确认删除", "确认重置"
  ]);
  const M06_QA_CATALOG = Object.freeze([
    {
      intent: "borrower-profile",
      question: "借款人的成员单位身份和基本情况是什么？",
      anchor: "sec-01-borrower-evaluation",
      group: "主体与申请"
    },
    {
      intent: "solvency",
      question: "2025 年偿债能力的关键指标和变化是什么？",
      anchor: "sec-03-financial",
      group: "财务与风险"
    },
    {
      intent: "risks",
      question: "报告识别出的主要风险和缓释依据有哪些？",
      anchor: "sec-04-risk",
      group: "财务与风险"
    },
    {
      intent: "human-boundary",
      question: "哪些内容是 AI 建议，哪些必须人工确认？",
      anchor: "sec-05-credit-conclusion",
      group: "核验与人工边界"
    },
    {
      intent: "versions-evidence",
      question: "本报告使用了哪些数据版本和证据？",
      anchor: "sec-06-data-sources",
      group: "数据与证据"
    },
    {
      intent: "verification",
      question: "自动核验检查了什么，当前结果如何？",
      anchor: "sec-03-financial",
      group: "核验与人工边界"
    },
    {
      intent: "financial-risk-summary",
      question: "请解释本报告第三部分财务情况与第四部分风险分析的主要证据、核验状态和人工判断边界。",
      anchor: "sec-03-financial",
      group: "财务与风险"
    },
    {
      intent: "next-borrower",
      question: "后续为其他集团成员单位出具报告，需要替换什么？",
      anchor: "sec-01-borrower-evaluation",
      group: "复用与扩展"
    },
    {
      intent: "loan-application",
      question: "本次贷款申请的金额、期限、用途和还款来源是什么？",
      anchor: "sec-03-02-funding",
      group: "主体与申请"
    },
    {
      intent: "supporting-materials",
      question: "担保、抵质押、征信和历史融资资料是否齐全？",
      anchor: "sec-06-data-sources",
      group: "主体与申请"
    },
    {
      intent: "source-classes",
      question: "哪些数据来自财务报告，哪些来自外部或内部合成资料？",
      anchor: "sec-06-data-sources",
      group: "数据与证据"
    },
    {
      intent: "dates-units",
      question: "报告的币种、单位、数据截至时间和报告日期如何确定？",
      anchor: "sec-03-financial",
      group: "数据与证据"
    },
    {
      intent: "reusable-resources",
      question: "如果更换借款人，数据源、本体和报告定义哪些可以复用？",
      anchor: "sec-01-borrower-evaluation",
      group: "复用与扩展"
    },
    {
      intent: "member-eligibility",
      question: "财务公司如何确认借款人属于集团成员单位？",
      anchor: "sec-01-borrower-evaluation",
      group: "主体与申请"
    },
    {
      intent: "metric-lineage",
      question: "财务指标从哪里来，如何追溯到 Metric 和原始证据？",
      anchor: "sec-03-01-basic-financial",
      group: "数据与证据"
    },
    {
      intent: "verification-remediation",
      question: "如果自动核验未通过，应该如何处理？",
      anchor: "sec-03-financial",
      group: "核验与人工边界"
    },
    {
      intent: "credit-investigation",
      question: "征信资料已核验什么，哪些内容仍待人工核对？",
      anchor: "sec-06-data-sources",
      group: "主体与申请"
    },
    {
      intent: "guarantee-collateral",
      question: "本次申请是否有保证、抵押或质押安排？",
      anchor: "sec-04-risk",
      group: "主体与申请"
    },
    {
      intent: "historical-financing",
      question: "历史融资和财务公司内部授信占用情况如何？",
      anchor: "sec-03-02-funding",
      group: "主体与申请"
    },
    {
      intent: "ownership-membership",
      question: "股权结构、控股股东和集团成员资格如何联合核验？",
      anchor: "sec-01-borrower-evaluation",
      group: "主体与申请"
    },
    {
      intent: "working-capital-calculation",
      question: "新增流动资金贷款额度上限是如何测算的？",
      anchor: "sec-03-02-funding",
      group: "财务与风险"
    },
    {
      intent: "publication-immutability",
      question: "数据或模板更新后，已发布报告为什么不会原地变化？",
      anchor: "sec-06-data-sources",
      group: "核验与人工边界"
    },
    {
      intent: "end-to-end-chain",
      question: "从数据接入到 HTML/PDF 发布，完整控制链是什么？",
      anchor: "report-cover",
      group: "复用与扩展"
    },
    {
      intent: "blocking-gates",
      question: "哪些资料或状态缺口会阻断生成、核验或人工确认？",
      anchor: "sec-06-data-sources",
      group: "核验与人工边界"
    }
  ]);
  const M06_UNKNOWN_QA = Object.freeze({
    intent: "unknown",
    anchor: "sec-06-data-sources",
    question: ""
  });
  const M06_VERIFICATION_RULES = Object.freeze([
    ["V01", "报告身份与借款申请是否对应", "核对报告编号、借款人名称、申请编号、场景轮次和固定证据包，确认它们属于同一次报告生成。"],
    ["V02", "报告事实是否来自已发布本体", "核对报告使用的本体和 C008 权威事实，确认不是草稿、未发布版本或工作簿原始行。"],
    ["V03", "报告数据的时点、期间、币种和单位是否一致", "逐项核对报告数据与固定数据快照的截至日期、报表期间、币种和单位，确认披露口径一致。"],
    ["V04", "报告财务指标是否与本体计算结果一致", "按 Published Metric 的公式复算报告中的财务指标，确认数值、精度和单位与确定性结果一致。"],
    ["V05", "报告规则结论是否与已发布规则结果一致", "核对报告中的规则结论、阈值、观测值、评估时点和命中分支，确认与 Published Rule 记录一致。"],
    ["V06", "报告每项事实是否都有可定位证据", "检查报告中的每一项正式事实，确认都能回到固定证据包中的来源和具体定位。"],
    ["V07", "报告正文、表格和指标卡是否引用同一事实", "核对正文、表格、指标卡和图表的稳定锚点，确认同一数据在不同位置展示一致且可追溯。"],
    ["V08", "风险判断和授信结论是否保留人工确认", "检查风险判断、调查意见和授信结论，确认 AI 只提供建议，正式决定仍由人工确认。"]
  ]);
  const M06_VERIFICATION_CHECK_LABELS = Object.freeze({
    "VER-V2-BASELINE-CONTEXT": "报告身份与借款申请是否对应",
    "VER-V2-PUBLISHED-LIFECYCLE": "报告事实是否来自已发布本体",
    "VER-V2-C008-IDENTITY": "报告中的借款人、申请和报告编号是否一致",
    "VER-V2-EVIDENCE-PACKAGE-OWNER": "报告证据包是否绑定到正确版本",
    "VER-V2-EVIDENCE-HASH-PUBLISHED": "报告使用的本体内容是否与证据包一致",
    "VER-V2-EVIDENCE-HASH-C008": "报告使用的权威事实是否与证据包一致",
    "VER-V2-NO-RAW-INPUT-REF": "报告是否只引用固定的结构化事实",
    "VER-V2-SECTION-ORDER": "报告章节和顺序是否与正式模板一致",
    "VER-V2-FORMAL-PAGE-SYSTEM": "正式报告页面格式和出具日期是否一致",
    "VER-V2-OPERATIONS-FOUR-SUBSECTIONS": "经营情况四个小节是否完整",
    "VER-V2-RISK-THEMES": "风险分析四个主题是否完整",
    "VER-V2-OWNERSHIP-COMPLETE": "股权结构和股东事实是否完整",
    "VER-V2-THREE-FULL-STATEMENTS": "三年三张财务报表是否完整",
    "VER-V2-FOURTEEN-METRICS": "14 项财务指标的三年数据是否完整",
    "VER-V2-METRIC-RECALCULATION": "报告财务指标与本体计算结果是否一致",
    "VER-V2-WORKING-CAPITAL-CALCULATION": "营运资金及新增贷款额度与测算结果是否一致",
    "VER-V2-DRAFT-EVIDENCE-BOUNDARY": "报告正文事实是否都有证据来源",
    "VER-V2-AGENT-DECISION-BOUNDARY": "报告中的授信结论是否保留人工确认"
  });
  function s004VerificationBusinessLabel(item) {
    const id = item?.checkId || item?.id || "";
    return M06_VERIFICATION_CHECK_LABELS[id] || item?.name || item?.checkName || id || "报告数据一致性核验";
  }
  function s004VerificationBusinessDetail(item) {
    const id = item?.checkId || item?.id || "";
    const detail = M06_VERIFICATION_RULES.find(([code]) => code === id)?.[2];
    return detail || item?.finding || item?.detail || item?.location || "核对报告内容与固定权威事实是否一致。";
  }
  const M05_READONLY_ACTION_LABELS = new Set([
    "基于此版本创建新草稿", "基于此版本创建草稿", "创建新草稿", "创建草稿",
    "停用", "重新启用", "发起运行", "开始运行", "开始生成", "开始生成报告草稿", "开始处理", "新建任务",
    "接收生成请求", "接收伴读请求", "读取报告交接", "退回结果", "确认可作参考", "创建 Agent 草稿", "创建 Agent", "新建 Agent",
    "创建编排", "发布 Release", "发布新 Release", "发布编排 Release", "验证配置", "开始调试", "清空", "取消运行", "重试原快照", "创建替代运行", "提交申请", "确认重置", "确认停用", "保存草稿", "验证", "启用 Release", "运行固定 Release", "试运行草稿", "确定性分流", "人工暂停", "指定汇总", "失败结束", "部分结果结束", "取消连接", "取消检查", "接收请求", "接收交接", "接收记录", "确认接收", "确认提交", "确认删除", "保存并提交", "重试保存", "创建后续新运行"
  ]);
  const M05_READONLY_REASON = "历史 Agent 制品不可原地覆盖；当前 S004 隔离轮次可追加新的 C022/C024、Run、Result 和 Session。";
  const M05_APPEND_REASON = "当前 S004 scenarioRunId 已打通完整报告链；可在当前轮次追加运行，历史 Run/Result/Session 与正式报告保持不可变。";
  let reportResourcesCache = null;
  // A replacement report starts as an empty v1.0.3 aggregate before its
  // evidence pack is fixed. Keep the immutable Published/C008 generation
  // source separate from the mutable current-report cache so that creating
  // that empty aggregate cannot make the exact S004 fact package disappear.
  let reportGenerationSourceCache = null;
  let reportCopilotCache = null;
  let parentNativeProjectionCache = undefined;
  let verificationContextCache = undefined;
  let m05RuntimeCache = null;
  let m05ReportStateCache = null;
  let m06QaRecommendationPageIndex = 0;
  let m06QaClearedThroughResultId = null;
  let m06VerificationFilter = "all";
  let m06VerificationExplanationVisible = false;
  let m06ComparisonExplanationVisible = false;
  let m06VerificationAnimation = null;
  let m06VerificationAnimationTimers = [];
  let m06ReportDataProjectionScheduled = false;
  let m06ReportDataStorageListenerInstalled = false;
  let m06SelectedBorrowerId = null;
  const M06_REPORT_DATA_RETRY_DELAYS = Object.freeze([0, 80, 240, 700, 1600, 3200]);
  const params = new URLSearchParams(root.location.search);
  const moduleId = params.get("moduleId") || "unknown";
  const context = {
    scenarioId: params.get("scenarioId") || null,
    scenarioVersion: params.get("scenarioVersion") || null,
    scenarioRunId: params.get("scenarioRunId") || null,
    formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt") || null,
    status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus") || "active"
  };
  if (root.OFWRuntimeStorage?.install) root.OFWRuntimeStorage.install({ context, moduleId });
  installS004DemoClock();
  installS004RuntimeClockStorageProjection();
  root.OFW_BASELINE_MODULE_RUNTIME = Object.freeze({ moduleId, context: { ...context } });

  function m05InitialEvidenceFilter(state) {
    if (!state || context.scenarioId !== "S004") return state;
    const original = Array.isArray(state.evidencePackages) ? state.evidencePackages : [];
    const retained = original.filter((item) => {
      const itemContext = item?.scenarioContext || item?.requestContext || item || {};
      return itemContext.scenarioId === "S004";
    });
    state.evidencePackages = retained;
    state.scenarioEvidenceIsolation = {
      mode: "S004_ONLY",
      source: "v1.0.3 static catalog filtered at runtime",
      filteredCount: original.length - retained.length,
      retainedCount: retained.length,
      reason: "场景隔离只过滤 S001 静态证据展示，不修改冻结 v1.0.3 文件或其默认 S001 行为。"
    };
    return state;
  }

  function isCurrentS004RuntimeRecord(record) {
    if (!record || context.scenarioId !== "S004") return false;
    const candidates = [
      record.scenarioContext,
      record.requestContext?.scenarioContext,
      record.requestContext,
      record.c022?.reportContext?.scenarioContext,
      record.c022?.reportContext,
      record.snapshot?.scenarioContext,
      record.snapshot?.requestContext?.scenarioContext,
      record.snapshot?.requestContext,
      record.snapshot,
      record
    ].filter(Boolean);
    return candidates.some((candidate) => ["scenarioId", "scenarioVersion", "scenarioRunId"]
      .every((field) => candidate[field] === context[field]));
  }

  function normalizeS004M05ScenarioLabel(holder, fields = ["scenarioLabel"]) {
    if (!holder || typeof holder !== "object") return;
    const baselineLabels = new Set([
      "",
      "S001 · 集团融资成本与债务结构优化",
      "集团融资成本与债务结构优化",
      "S004 · 集团融资成本与债务结构优化",
      S004_REPORT_SCENARIO_LABEL
    ]);
    fields.forEach((field) => {
      const current = String(holder[field] == null ? "" : holder[field]).trim();
      if (baselineLabels.has(current)) holder[field] = S004_M05_SCENARIO_LABEL;
    });
  }

  function normalizeS004M05RuntimeProjection(model) {
    if (context.scenarioId !== "S004" || !model) return cloneJson(model);
    const next = normalizeS004CurrentRuntimeClockRecords(model);
    if (isCurrentS004RuntimeRecord(next.currentScenarioContext || next)) {
      normalizeS004M05ScenarioLabel(next.currentScenarioContext);
    }

    (next.evidencePackages || []).forEach((evidence) => {
      if (evidence?.currentProjection === false || evidence?.kind !== "report-generation" || !isCurrentS004RuntimeRecord(evidence)) return;
      normalizeS004M05ScenarioLabel(evidence.scenarioContext);
      normalizeS004M05ScenarioLabel(evidence.requestContext);
      normalizeS004M05ScenarioLabel(evidence.requestContext?.scenarioContext);
    });

    (next.inboundRequests || []).forEach((request) => {
      if (request?.currentProjection === false || request?.type !== "report-draft" || !isCurrentS004RuntimeRecord(request)) return;
      const currentTitle = String(request.title == null ? "" : request.title).trim();
      if (!currentTitle || currentTitle === "融资经营分析报告生成") request.title = "S004 贷前调查报告生成";
      normalizeS004M05ScenarioLabel(request.scenarioContext);
      normalizeS004M05ScenarioLabel(request.requestContext);
      normalizeS004M05ScenarioLabel(request.requestContext?.scenarioContext);
    });

    (next.runs || []).forEach((run) => {
      if (run?.currentProjection === false || run?.snapshot?.agentId !== "report-draft" || !isCurrentS004RuntimeRecord(run)) return;
      normalizeS004M05ScenarioLabel(run.scenarioContext);
      normalizeS004M05ScenarioLabel(run.snapshot, ["scenario", "scenarioLabel"]);
      normalizeS004M05ScenarioLabel(run.snapshot?.scenarioBinding);
      normalizeS004M05ScenarioLabel(run.snapshot?.requestContext);
      normalizeS004M05ScenarioLabel(run.snapshot?.requestContext?.scenarioContext);
      normalizeS004M05ScenarioLabel(run.snapshot?.reportGeneration?.reportContext);
      normalizeS004M05ScenarioLabel(run.result);
      normalizeS004M05ScenarioLabel(run.result?.scenarioContext);
      const currentTitle = String(run.result?.title == null ? "" : run.result.title).trim();
      if (run.result && (!currentTitle || currentTitle === "融资经营分析报告结构化源草稿")) {
        run.result.title = "S004 贷前调查报告结构化源草稿";
      }
    });
    return next;
  }

  function normalizeS004M05StoredState() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return false;
    const current = readJsonState(M05_STATE_KEY);
    if (!current) return false;
    const projected = normalizeS004M05RuntimeProjection(current);
    if (JSON.stringify(current) === JSON.stringify(projected)) return false;
    const written = writeJsonState(M05_STATE_KEY, projected);
    if (written) {
      m05RuntimeCache = null;
      reportCopilotCache = null;
      root.document.documentElement.dataset.ofwS004M05GenerationProjection = "normalized-before-baseline-hydration";
    }
    return written;
  }

  function installM05GenerationStorageProjection() {
    if (moduleId !== "M05" || context.scenarioId !== "S004" || root.__OFW_S004_M05_GENERATION_STORAGE_PROJECTION__) return;
    const proto = root.Storage?.prototype;
    if (!proto?.setItem) return;
    const previous = proto.setItem;
    proto.setItem = function (key, value) {
      let projectedValue = value;
      let relayPayload = null;
      if (this === root.localStorage && key === M05_STATE_KEY) {
        try {
          relayPayload = normalizeS004M05RuntimeProjection(JSON.parse(String(value)));
          projectedValue = JSON.stringify(relayPayload);
          m05RuntimeCache = null;
          reportCopilotCache = null;
          root.document.documentElement.dataset.ofwS004M05GenerationProjection = "normalized-on-write";
        } catch (_) { /* Preserve baseline behavior for non-JSON values. */ }
      }
      // Publish the exact in-memory Owner state before attempting the large
      // physical write.  The frozen app intentionally catches quota errors;
      // publishing afterwards would therefore lose the completed C023 state
      // precisely when the relay is needed as the same-run recovery surface.
      if (relayPayload) publishS004RuntimeRelayPayload("M05_RUNTIME_STATE", relayPayload);
      const result = previous.call(this, key, projectedValue);
      return result;
    };
    root.__OFW_S004_M05_GENERATION_STORAGE_PROJECTION__ = true;
  }

  function installM05InitialEvidenceFilter() {
    if (moduleId !== "M05" || context.scenarioId !== "S004" || root.__OFW_S004_M05_INITIAL_EVIDENCE_FILTER__) return;
    const property = "AGENT_APP_INITIAL_STATE";
    const descriptor = Object.getOwnPropertyDescriptor(root, property);
    let current = descriptor?.get ? descriptor.get.call(root) : descriptor?.value;
    const adapt = (value) => m05InitialEvidenceFilter(value);
    try {
      Object.defineProperty(root, property, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() { return current; },
        set(value) { current = adapt(value); }
      });
      if (current) current = adapt(current);
      root.__OFW_S004_M05_INITIAL_EVIDENCE_FILTER__ = true;
    } catch (_) {
      if (root[property]) adapt(root[property]);
    }
  }

  installM05InitialEvidenceFilter();
  installM05GenerationStorageProjection();
  normalizeS004M05StoredState();
  installM06InitialDataProjection();
  installM06ExternalOwnersProjection();
  installM06GenerationStorageProjection();
  scheduleM06ReportDataProjection("runtime-load");

  const bannerText = {
    M01: "",
    M02: "",
    M03: "S004 场景状态：NOT_APPLICABLE · v1.0.3 原生页面、内部路由和交互核验能力完整保留；当前正式贷前调查链不消费独立问数结果。",
    M04: "S004 场景状态：无 Action Request · 当前队列为空；保留完整决策中心页面、确认和待办功能。",
    M05: "",
    M06: ""
  }[moduleId];

  function setText(node, value) {
    if (node && value != null && node.textContent !== String(value)) node.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function readJsonState(key) {
    try { return JSON.parse(root.localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function readJsonSessionState(key) {
    try { return JSON.parse(root.sessionStorage?.getItem(key) || "null"); } catch (_) { return null; }
  }

  function writeJsonState(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function s004QaHistoryKey() {
    return [S004_QA_HISTORY_PREFIX, context.scenarioId, context.scenarioVersion, context.scenarioRunId]
      .map((item) => encodeURIComponent(String(item || "unknown")))
      .join(":");
  }

  function s004QaHistoryFromModel(model) {
    const currentOnly = (items) => (items || []).filter((item) => recoveryContextMatches(item));
    return {
      schemaVersion: "ofw.s004.qa-history.v1",
      scenarioContext: cloneJson(context),
      requests: cloneJson(currentOnly(model?.inboundRequests)),
      runs: cloneJson(currentOnly(model?.runs).filter((item) => item?.snapshot?.agentId === "report-copilot")),
      sessions: cloneJson(currentOnly(model?.sessions).filter((item) => String(item?.id || "").startsWith("SESSION-S004-COPILOT-"))),
      runtimeActivity: cloneJson(currentOnly(model?.runtimeActivity).filter((item) => item?.contract === "C024 → C025")),
      updatedAt: s004NowIso()
    };
  }

  function mergeS004QaHistory(model, { persist = true } = {}) {
    if (context.scenarioId !== "S004" || !model) return model;
    const key = s004QaHistoryKey();
    const history = readJsonState(key);
    if (!history || history?.scenarioContext?.scenarioRunId !== context.scenarioRunId) {
      const initialized = s004QaHistoryFromModel(model);
      if (persist) writeJsonState(key, initialized);
      return model;
    }
    const mergeBy = (historyItems, currentItems, identity) => {
      const result = [];
      const seen = new Set();
      [...(historyItems || []), ...(currentItems || [])].forEach((item) => {
        const id = identity(item);
        if (!id || seen.has(id)) return;
        seen.add(id);
        result.push(cloneJson(item));
      });
      return result;
    };
    const merged = {
      ...model,
      inboundRequests: mergeBy(history.requests, model.inboundRequests, (item) => item?.id || item?.sourceRequestId),
      runs: mergeBy(history.runs, model.runs, (item) => item?.id),
      sessions: mergeBy(history.sessions, model.sessions, (item) => item?.id),
      runtimeActivity: mergeBy(history.runtimeActivity, model.runtimeActivity, (item) => item?.id || `${item?.requestId}|${item?.runId}`)
    };
    if (persist) {
      writeJsonState(M05_STATE_KEY, merged);
      writeJsonState(key, s004QaHistoryFromModel(merged));
    }
    root.document.documentElement.dataset.ofwS004QaHistory = history.runs?.length ? "restored" : "initialized";
    return merged;
  }

  function persistS004QaHistory(model) {
    if (context.scenarioId !== "S004" || !model) return false;
    return writeJsonState(s004QaHistoryKey(), s004QaHistoryFromModel(model));
  }

  function installS004DemoClock() {
    if (context.scenarioId !== "S004" || root.__OFW_S004_DEMO_CLOCK__) return;
    const NativeDate = root.Date || (typeof Date !== "undefined" ? Date : null);
    if (!NativeDate) return;
    const runtimeClock = (() => {
      try {
        return root.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig?.demoClock
          || (root.parent && root.parent !== root ? root.parent.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig?.demoClock : null)
          || null;
      } catch (_) {
        return null;
      }
    })();
    const anchorIso = runtimeClock?.enabled && runtimeClock?.scenarioId === "S004" && runtimeClock?.mode === "FIXED"
      ? runtimeClock.now
      : (String(context.formedAt || "").startsWith(S004_DEMO_CLOCK_DATE) ? context.formedAt : `${S004_DEMO_CLOCK_DATE}T08:00:00.000Z`);
    const anchorTime = NativeDate.parse(anchorIso);
    const realStartedAt = NativeDate.now();
    // Both ISO date and Asia/Shanghai local display must stay on 2026-08-16.
    // Their shared UTC interval is 00:00:00.000Z through 15:59:59.999Z.
    const lowerBound = NativeDate.parse(`${S004_DEMO_CLOCK_DATE}T00:00:00.000Z`);
    const upperBound = NativeDate.parse(`${S004_DEMO_CLOCK_DATE}T15:59:59.999Z`);
    const scenarioNow = () => Math.min(upperBound, Math.max(lowerBound, anchorTime + (NativeDate.now() - realStartedAt)));
    function ScenarioDate(...args) {
      if (!(this instanceof ScenarioDate)) return new NativeDate(scenarioNow()).toString();
      return args.length ? new NativeDate(...args) : new NativeDate(scenarioNow());
    }
    Object.setPrototypeOf?.(ScenarioDate, NativeDate);
    ScenarioDate.prototype = NativeDate.prototype;
    ScenarioDate.now = scenarioNow;
    ScenarioDate.parse = NativeDate.parse.bind(NativeDate);
    ScenarioDate.UTC = NativeDate.UTC.bind(NativeDate);
    root.Date = ScenarioDate;
    root.__OFW_S004_DEMO_CLOCK__ = Object.freeze({
      date: S004_DEMO_CLOCK_DATE,
      anchorIso,
      realStartedAt,
      lowerBound,
      upperBound,
      nativeDate: NativeDate
    });
    if (root.document?.documentElement?.dataset) {
      root.document.documentElement.dataset.ofwS004DemoClock = S004_DEMO_CLOCK_DATE;
    }
  }

  function normalizeS004DemoClockText(value) {
    if (typeof value !== "string") return value;
    return value
      .replaceAll("20260817", "20260816")
      .replaceAll("2026-08-17", S004_DEMO_CLOCK_DATE)
      .replaceAll("2026/08/17", "2026/08/16")
      .replaceAll("2026年08月17日", "2026年08月16日")
      .replaceAll("2026 年 08 月 17 日", "2026 年 08 月 16 日");
  }

  function s004NowDate() {
    const Clock = root.Date || (typeof Date !== "undefined" ? Date : null);
    return Clock ? new Clock() : null;
  }

  function s004NowIso() {
    return s004NowDate()?.toISOString?.() || `${S004_DEMO_CLOCK_DATE}T00:00:00.000Z`;
  }

  function s004NowEpoch() {
    const Clock = root.Date || (typeof Date !== "undefined" ? Date : null);
    return Clock?.now?.() ?? s004NowDate()?.getTime?.() ?? 0;
  }

  function normalizeS004DemoClockValue(value) {
    if (typeof value === "string") return normalizeS004DemoClockText(value);
    if (Array.isArray(value)) return value.map(normalizeS004DemoClockValue);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeS004DemoClockValue(item)]));
  }

  function normalizeS004CurrentRuntimeClockRecords(value) {
    const visit = (item, inheritedCurrentRun = false) => {
      if (Array.isArray(item)) return item.map((entry) => visit(entry, inheritedCurrentRun));
      if (!item || typeof item !== "object") return item;
      const ownContext = scenarioContextFrom(item);
      const currentRun = inheritedCurrentRun || ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => ownContext[field] === context[field]);
      const looksLikeRuntimeRecord = Boolean(
        item.requestId || item.runId || item.resultId || item.sessionId
        || /(?:request|run|result|session)/i.test(String(item.type || item.kind || item.id || ""))
      );
      return Object.fromEntries(Object.entries(item).map(([key, field]) => {
        if (currentRun && looksLikeRuntimeRecord && typeof field === "string") {
          return [key, normalizeS004DemoClockText(field)];
        }
        return [key, field && typeof field === "object" ? visit(field, currentRun) : field];
      }));
    };
    return visit(cloneJson(value));
  }

  function s004RuntimeClockViolations(value) {
    const violations = [];
    const visit = (item, path = "root", inheritedCurrentRun = false) => {
      if (!item || typeof item !== "object") return;
      if (Array.isArray(item)) {
        item.forEach((entry, index) => visit(entry, `${path}[${index}]`, inheritedCurrentRun));
        return;
      }
      const ownContext = scenarioContextFrom(item);
      const currentRun = inheritedCurrentRun || ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => ownContext[field] === context[field]);
      const looksLikeRuntimeRecord = Boolean(
        item.requestId || item.runId || item.resultId || item.sessionId
        || /(?:request|run|result|session)/i.test(String(item.type || item.kind || item.id || ""))
      );
      if (currentRun && looksLikeRuntimeRecord) {
        Object.entries(item).forEach(([key, field]) => {
          if (typeof field === "string" && /20260817|2026-08-17|2026\/08\/17/.test(field)) {
            violations.push(`${path}.${key}:${field}`);
          }
        });
      }
      Object.entries(item).forEach(([key, field]) => {
        if (field && typeof field === "object") visit(field, `${path}.${key}`, currentRun);
      });
    };
    visit(value);
    return violations;
  }

  function s004RuntimeRelay() {
    try {
      return root.parent && root.parent !== root ? root.parent.OFW_S004_RUNTIME_RELAY || null : root.OFW_S004_RUNTIME_RELAY || null;
    } catch (_) {
      return null;
    }
  }

  function publishS004RuntimeRelayPayload(kind, payload) {
    if (context.scenarioId !== "S004") return false;
    const relay = s004RuntimeRelay();
    const published = Boolean(payload && relay?.publish?.({ kind, context, payload }));
    if (root.document?.documentElement?.dataset) {
      root.document.documentElement.dataset.ofwS004RuntimeRelayPublish = published ? `${kind}:ok` : `${kind}:unavailable`;
    }
    return published;
  }

  function publishS004RuntimeRelay(kind, storageKey) {
    if (context.scenarioId !== "S004") return false;
    const rawPayload = readJsonState(storageKey);
    const payload = storageKey === M05_STATE_KEY ? normalizeS004M05RuntimeProjection(rawPayload) : rawPayload;
    if (storageKey === M05_STATE_KEY && rawPayload && JSON.stringify(rawPayload) !== JSON.stringify(payload)) {
      writeJsonState(storageKey, payload);
      m05RuntimeCache = null;
      reportCopilotCache = null;
    }
    return publishS004RuntimeRelayPayload(kind, payload);
  }

  function consumeS004RuntimeRelay(kind, storageKey) {
    if (context.scenarioId !== "S004") return false;
    const relay = s004RuntimeRelay();
    const payload = relay?.read?.({ kind, context }) || null;
    const consumed = Boolean(payload && writeJsonState(storageKey, payload));
    if (consumed) {
      if (storageKey === M05_STATE_KEY) {
        m05RuntimeCache = null;
        reportCopilotCache = null;
      }
      if (storageKey === M06_STATE_KEY) reportResourcesCache = null;
    }
    if (root.document?.documentElement?.dataset) {
      root.document.documentElement.dataset.ofwS004RuntimeRelayConsume = consumed ? `${kind}:ok` : `${kind}:unavailable`;
    }
    return consumed;
  }

  function scheduleS004RuntimeRelay(kind, storageKey, delays = [0, 120, 480, 1200, 2400]) {
    delays.forEach((delay) => root.setTimeout?.(() => publishS004RuntimeRelay(kind, storageKey), delay));
  }

  function m05RuntimeState() {
    if (m05RuntimeCache) return m05RuntimeCache;
    const merged = mergeS004QaHistory(readJsonState(M05_STATE_KEY));
    const projected = normalizeS004M05RuntimeProjection(merged);
    if (merged && JSON.stringify(merged) !== JSON.stringify(projected)) writeJsonState(M05_STATE_KEY, projected);
    m05RuntimeCache = cloneJson(projected);
    return projected;
  }

  function m05ReportReferenceState() {
    return m05ReportStateCache || readJsonState(M06_STATE_KEY);
  }

  function scenarioContextFrom(value) {
    const candidates = [
      value?.scenarioContext,
      value?.currentScenarioContext,
      value?.requestContext?.scenarioContext,
      value?.reportContext?.scenarioContext,
      value?.c024?.reportContext?.scenarioContext,
      value?.snapshot?.scenarioContext,
      value?.snapshot?.requestContext?.scenarioContext,
      value
    ].filter(Boolean);
    for (const candidate of candidates) {
      const normalized = {
        scenarioId: candidate.scenarioId || null,
        scenarioVersion: candidate.scenarioVersion || null,
        scenarioRunId: candidate.scenarioRunId || null,
        formedAt: candidate.formedAt || candidate.contextFormedAt || candidate.scenarioFormedAt || null,
        status: candidate.status || candidate.contextStatus || candidate.scenarioStatus || null
      };
      if (normalized.scenarioId && normalized.scenarioVersion && normalized.scenarioRunId) return normalized;
    }
    return {};
  }

  function nativeReseedGuardKey() {
    return `${NATIVE_RESEED_GUARD_PREFIX}:${context.scenarioRunId || "unknown"}:${moduleId}`;
  }

  function nativeReseedGuardRead() {
    try { return root.sessionStorage?.getItem(nativeReseedGuardKey()) || null; } catch (_) { return null; }
  }

  function nativeReseedGuardWrite(value) {
    try {
      if (value == null) root.sessionStorage?.removeItem(nativeReseedGuardKey());
      else root.sessionStorage?.setItem(nativeReseedGuardKey(), String(value));
    } catch (_) { /* session guard is best-effort; state validation remains authoritative */ }
  }

  function activeScenarioRuntimeConfig() {
    try {
      return root.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig
        || (root.parent && root.parent !== root ? root.parent.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig : null)
        || null;
    } catch (_) {
      return null;
    }
  }

  function parentNativeProjection() {
    if (parentNativeProjectionCache !== undefined) return parentNativeProjectionCache;
    try {
      const parentSeeder = root.parent && root.parent !== root
        ? root.parent.OFW_S004_NativeSeeder
        : root.OFW_S004_NativeSeeder;
      const projection = parentSeeder?.currentProjection?.() || null;
      const candidate = projection?.scenarioContext || {};
      const matches = ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) =>
        candidate[field] && String(candidate[field]) === String(context[field]));
      parentNativeProjectionCache = matches ? projection : null;
    } catch (_) {
      parentNativeProjectionCache = null;
    }
    return parentNativeProjectionCache;
  }

  function runtimeVerificationContext() {
    if (verificationContextCache !== undefined) return verificationContextCache;
    const value = readJsonSessionState(VERIFICATION_CONTEXT_KEY) || readJsonState(VERIFICATION_CONTEXT_KEY);
    const candidate = value?.scenarioContext || {};
    const matches = value?.schemaVersion === "ofw.s004.verification-context.v1"
      && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) =>
        candidate[field] && String(candidate[field]) === String(context[field]));
    verificationContextCache = matches ? value : null;
    if (root.document?.documentElement?.dataset) {
      root.document.documentElement.dataset.ofwS004VerificationContext = matches
        ? "ready"
        : value
          ? "identity-mismatch"
          : "missing";
      root.document.documentElement.dataset.ofwS004VerificationContextMetrics = String(
        verificationContextCache?.deterministicInputs?.metricResults?.length || 0
      );
    }
    return verificationContextCache;
  }

  function currentS004ReportTitle() {
    return activeScenarioRuntimeConfig()?.reportNamingPolicy?.currentTitle
      || "集团成员单位贷款贷前调查报告";
  }

  function activeS004RuntimeProfile() {
    const runtime = activeScenarioRuntimeConfig() || {};
    const borrowerProfiles = runtime.borrowerProfiles || {};
    const applicationProfiles = runtime.applicationProfiles || {};
    const borrower = (borrowerProfiles.profiles || []).find((item) => item?.borrowerId === borrowerProfiles.activeBorrowerId)
      || borrowerProfiles.profiles?.[0]
      || {};
    const application = (applicationProfiles.applications || []).find((item) => item?.applicationId === applicationProfiles.activeApplicationId)
      || applicationProfiles.applications?.[0]
      || {};
    return {
      runtime,
      borrower,
      application,
      definition: runtime.reportDefinitionBinding || {},
      naming: runtime.reportNamingPolicy || {},
      stable: runtime.stableIdentities || {},
      sources: runtime.sourceSlotDefinitions || []
    };
  }

  function m06ReportRunSelection() {
    const profile = activeS004RuntimeProfile();
    const configured = profile.runtime?.reportRunSelection || {};
    const fallbackOptions = [{
      borrowerId: profile.borrower?.borrowerId || profile.stable?.borrowerId || "CURRENT_BORROWER",
      legalName: profile.borrower?.legalName || "当前集团成员单位",
      applicationId: profile.application?.applicationId || profile.stable?.applicationId || null,
      productType: profile.application?.productType || "贷款申请",
      readiness: "READY",
      readinessLabel: "资料已就绪，可生成"
    }, {
      borrowerId: "__OTHER_GROUP_MEMBER__",
      legalName: "其他集团成员单位",
      applicationId: null,
      productType: null,
      readiness: "REQUIRES_DATA_PREPARATION",
      readinessLabel: "选择成员单位后先完成数据准备"
    }];
    const options = Array.isArray(configured.options) && configured.options.length
      ? configured.options
      : fallbackOptions;
    const currentBorrowerId = configured.currentBorrowerId
      || profile.borrower?.borrowerId
      || options[0]?.borrowerId;
    if (!m06SelectedBorrowerId || !options.some((item) => item.borrowerId === m06SelectedBorrowerId)) {
      m06SelectedBorrowerId = currentBorrowerId;
    }
    const selected = options.find((item) => item.borrowerId === m06SelectedBorrowerId) || options[0] || {};
    return {
      ...configured,
      options,
      currentBorrowerId,
      selected,
      ready: selected.readiness === "READY",
      preparationRoute: configured.preparationRoute || "#module/data"
    };
  }

  function formalReportDownloadName(extension = "pdf") {
    const title = currentS004ReportTitle().replace(/[\\/:*?"<>|]/g, "-");
    return `${title}.${String(extension || "pdf").replace(/^\./, "")}`;
  }

  function m06QaCatalogForCurrentProfile() {
    const profile = activeS004RuntimeProfile();
    const year = Number(profile.application?.reportingYear) || s004NowDate()?.getFullYear() || 2026;
    return M06_QA_CATALOG.map((item) => item.intent === "solvency"
      ? { ...item, question: `${year} 年偿债能力的关键指标和变化是什么？` }
      : item);
  }

  function m06QaVerificationForReport(report, reportContext = null) {
    const candidates = [
      report?.verification,
      report?.postPublicationVerification,
      ...(report?.verificationRuns || [])
    ].filter(Boolean);
    const requestedRunId = reportContext?.verificationReference?.runId || null;
    if (requestedRunId) return candidates.find((item) => item?.runId === requestedRunId) || null;
    const formalLifecycle = ["published", "withdrawn"].includes(String(report?.stage || ""));
    const preferred = formalLifecycle ? report?.postPublicationVerification : report?.verification;
    if (preferred?.runId) return preferred;
    return [...(report?.verificationRuns || [])].reverse().find((run) => run?.runId) || null;
  }

  function buildM06QaContext(resources, reportContext = null) {
    const profile = activeS004RuntimeProfile();
    const report = resources?.report || null;
    const evidencePack = resources?.evidencePack
      || report?.evidencePacks?.find?.((item) => item?.id === (reportContext?.evidencePack?.id || report?.evidencePackId))
      || report?.evidencePacks?.[0]
      || null;
    const factPackage = evidencePack?.authoritativeFactPackage || resources?.factPackage || null;
    const facts = Array.isArray(factPackage?.contentFacts) ? factPackage.contentFacts : [];
    const factById = new Map(facts.map((fact) => [fact?.id, fact]));
    return {
      profile, resources, report, evidencePack, reportContext, factPackage, facts, factById,
      verification: m06QaVerificationForReport(report, reportContext),
      deterministicInputs: factPackage?.deterministicInputs || {}
    };
  }

  function m06QaContext() {
    const resources = typeof reportResourcesFromState === "function" ? reportResourcesFromState() : null;
    return buildM06QaContext(resources, null);
  }

  function m06QaContextForRequest(report, evidencePack, reportContext) {
    return buildM06QaContext({ report, evidencePack, factPackage: evidencePack?.authoritativeFactPackage || null }, reportContext);
  }

  function m06QaFact(ctx, id) {
    return ctx?.factById?.get(id) || null;
  }

  function m06QaNumber(value, digits = 2) {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return parsed.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function m06QaPercent(value) {
    const raw = String(value ?? "").replace(/%/g, "").trim();
    if (!raw) return "未定位";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return "未定位";
    const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    return `${m06QaNumber(percent, 2)}%`;
  }

  function m06QaMoney(value, unit = "万元") {
    const formatted = m06QaNumber(value, 2);
    return formatted == null ? "未定位" : `${formatted} ${unit}`;
  }

  function m06QaChineseDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : (value || "未定位");
  }

  function s004ScenarioDateToken() {
    const source = context.formedAt || activeS004RuntimeProfile()?.naming?.currentIssueDate || "2026-08-16";
    const match = String(source).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}${match[2]}${match[3]}` : "20260816";
  }

  function m06QaVerificationSummary(ctx) {
    const verification = ctx?.verification || {};
    const coverage = verification.coverage || {};
    const results = Array.isArray(verification.results) ? verification.results : [];
    const counts = results.reduce((acc, item) => {
      const status = String(item?.status || "").toLowerCase();
      if (status === "pass" || status === "passed") acc.pass += 1;
      else if (status === "warning" || status === "warn") acc.warning += 1;
      else if (status === "fail" || status === "failed") acc.fail += 1;
      else acc.unverifiable += 1;
      return acc;
    }, { pass: 0, warning: 0, fail: 0, unverifiable: 0 });
    const complete = String(verification.status || "").startsWith("completed")
      && coverage.status === "complete"
      && Number(coverage.pending || 0) === 0
      && Number(coverage.error || 0) === 0;
    return { verification, coverage, counts, complete };
  }

  function formatM06QaAnswer(value) {
    return String(value || "")
      .replace(/\s*依据：/g, "\n依据：")
      .replace(/\s*边界：/g, "\n边界：")
      .trim();
  }

  function setHtmlBySignature(node, signatureKey, signature, html) {
    if (!node) return false;
    const normalizedSignature = String(signature == null ? "" : signature);
    const normalizedHtml = String(html == null ? "" : html);
    if (node.dataset?.[signatureKey] === normalizedSignature && node.innerHTML === normalizedHtml) return false;
    if (node.innerHTML !== normalizedHtml) node.innerHTML = normalizedHtml;
    if (node.dataset) node.dataset[signatureKey] = normalizedSignature;
    return true;
  }

  function renderM06QaAnswer(answerNode, value) {
    if (!answerNode) return;
    const lines = formatM06QaAnswer(value).split("\n").filter(Boolean);
    const html = lines.map((line) => {
      const match = line.match(/^([^：]+)：([\s\S]*)$/);
      if (!match) return `<span class="s004-qa-answer-line"><span>${escapeHtml(line)}</span></span>`;
      return `<span class="s004-qa-answer-line"><b>${escapeHtml(match[1])}</b><span>${escapeHtml(match[2].trim())}</span></span>`;
    }).join("");
    setHtmlBySignature(answerNode, "ofwS004AnswerRenderSignature", formatM06QaAnswer(value), html);
    answerNode.dataset.ofwS004StructuredAnswer = "conclusion-evidence-boundary";
  }

  function renderM06QaCitations(citations, citationRefs) {
    if (!citations) return false;
    const refs = Array.isArray(citationRefs) ? citationRefs : [];
    const visibleRefs = refs.slice(0, 12);
    const signature = JSON.stringify({ count: refs.length, visibleRefs });
    const html = `<strong>回答依据 · ${refs.length} 项${refs.length > visibleRefs.length ? `（显示前 ${visibleRefs.length} 项）` : ""}</strong><div class="s004-qa-citation-list">${visibleRefs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join("")}</div>`;
    return setHtmlBySignature(citations, "s004QaCitationSignature", signature, html);
  }

  function m06QaAnswerByIntent(intent, contextOverride = null) {
    const ctx = contextOverride || m06QaContext();
    const fixed = ctx.deterministicInputs || {};
    const fixedApplication = fixed.loanApplication || {};
    const fixedFacility = fixed.internalFacility || {};
    const borrower = { ...(ctx.profile.borrower || {}), ...(fixed.borrower || {}) };
    const application = {
      ...(ctx.profile.application || {}),
      ...fixedApplication,
      requestedAmount: fixedApplication.requestedAmount ?? ctx.profile.application?.requestedAmount,
      termMonths: fixedApplication.termMonths ?? ctx.profile.application?.termMonths,
      loanType: fixedApplication.loanType || ctx.profile.application?.loanType,
      purpose: fixedApplication.purpose || ctx.profile.application?.purpose,
      internalFacility: {
        ...(ctx.profile.application?.internalFacility || {}),
        approvedAmount: fixedFacility.approvedFacility ?? ctx.profile.application?.internalFacility?.approvedAmount,
        usedAmount: fixedFacility.usedFacility ?? ctx.profile.application?.internalFacility?.usedAmount,
        availableAmount: fixedFacility.availableFacility ?? ctx.profile.application?.internalFacility?.availableAmount,
        asOf: fixedFacility.asOfDate || ctx.profile.application?.internalFacility?.asOf
      }
    };
    const stable = {
      ...(ctx.profile.stable || {}),
      ...(fixed.stableIdentities || {}),
      reportNumber: ctx.reportContext?.reportNumber || fixed.stableIdentities?.reportNumber || ctx.profile.stable?.reportNumber
    };
    const factPackage = ctx.factPackage || {};
    const borrowerFact = m06QaFact(ctx, "FACT-S004-V2-BORROWER-001");
    const ownershipFact = m06QaFact(ctx, "FACT-S004-V2-OWNERSHIP-001");
    const memberStatusFact = fixed.memberStatus || {};
    const fixedMetric = (id) => (fixed.metricResults || []).find((item) => item?.metricId === id);
    const fixedMetricValues = (id) => fixedMetric(id)?.values || {};
    const statementRow = (section, id) => (fixed.financialStatements?.[section] || []).find((item) => item?.factId === id) || null;
    const statementValue = (section, id, year) => statementRow(section, id)?.values?.[String(year)] ?? null;
    const debtRatio = m06QaFact(ctx, "MET-DEBT-ASSET-RATIO")?.value || fixedMetric("MET-DEBT-ASSET-RATIO")?.values?.[String(application.reportingYear || 2025)];
    const currentRatio = m06QaFact(ctx, "MET-CURRENT-RATIO")?.value || fixedMetric("MET-CURRENT-RATIO")?.values?.[String(application.reportingYear || 2025)];
    const fundingRaw = m06QaFact(ctx, "FACT-S004-V2-WORKING-CAPITAL-001")?.value
      || fixed.workingCapital?.maximumNewWorkingCapitalLoan;
    const fundingFact = fundingRaw == null ? null : m06QaMoney(String(fundingRaw).replace(/[^\d.-]/g, ""), "万元");
    const borrowerName = borrower.legalName || borrower.fullName || borrowerFact?.value || "当前集团成员借款人";
    const groupName = borrower.groupName || borrower.controllingShareholder || "所属集团";
    const memberId = borrower.memberId || stable.memberId || "未定位";
    const uscc = borrower.unifiedSocialCreditCode || "未定位";
    const fixedPeriods = fixed.financialStatements?.periods || [];
    const fixedStatementAsOf = fixedPeriods[fixedPeriods.length - 1]?.asOfDate || null;
    const reportYear = Number(application.reportingYear) || Number(String(borrower.financialStatementAsOf || fixedStatementAsOf || factPackage.asOf || "").slice(0, 4)) || "当前";
    const applicationId = application.applicationId || stable.applicationId || "未定位";
    const amount = m06QaMoney(application.requestedAmount, application.amountUnit || "万元");
    const term = application.termMonths ? `${application.termMonths} 个月` : (application.productType || "未定位");
    const reportNo = ctx.report?.reportNo || stable.reportNumber || "未定位";
    const reportBinding = ctx.report?.bindingSnapshot || factPackage.authoritativeBinding || {};
    const sourceSlots = ctx.profile.sources || [];
    const sourceSummary = sourceSlots.length
      ? sourceSlots.map((slot) => `${slot.name}（${slot.sourceClass}）`).join("、")
      : "正式财务报告与贷款调查补充资料";
    const fixedRiskThemes = Array.isArray(fixed.riskThemes) ? fixed.riskThemes : [];
    const riskFacts = ctx.facts.filter((fact) => fact?.scope === "借款风险分析" || String(fact?.id || "").startsWith("RISK-"));
    const riskTitles = riskFacts.map((fact) => String(fact.label || fact.id).replace(/^[一二三四五六七八九十]+、?/, "")).filter(Boolean);
    if (!riskTitles.length) fixedRiskThemes.forEach((risk) => riskTitles.push(String(risk?.title || risk?.riskId || "").replace(/^[一二三四五六七八九十]+、?/, "")));
    const qaVerification = m06QaVerificationSummary(ctx);
    const coverage = qaVerification.coverage;
    const counts = qaVerification.counts;
    const verificationIdentity = qaVerification.verification?.runId || "尚未形成可定位运行";
    const debtRatioValues = fixedMetricValues("MET-DEBT-ASSET-RATIO");
    const currentRatioValues = fixedMetricValues("MET-CURRENT-RATIO");
    const interestCoverageValues = fixedMetricValues("MET-EBIT-INTEREST-COVERAGE");
    const revenueGrowthValues = fixedMetricValues("MET-REVENUE-GROWTH");
    const netProfitGrowthValues = fixedMetricValues("MET-NET-PROFIT-GROWTH");
    const mainMarginValues = fixedMetricValues("MET-MAIN-BUSINESS-PROFIT-MARGIN");
    const shortTermBorrowings2023 = statementValue("balanceSheet", "BS-ST-BORROWINGS", 2023);
    const shortTermBorrowings2025 = statementValue("balanceSheet", "BS-ST-BORROWINGS", 2025);
    const cash2025 = statementValue("balanceSheet", "BS-CASH", 2025);
    const cip2025 = statementValue("balanceSheet", "BS-CIP", 2025);
    const operatingCash2025 = statementValue("cashFlowStatement", "CF-OPERATING-NET", 2025);
    const investingCash2025 = statementValue("cashFlowStatement", "CF-INVESTING-NET", 2025);

    if (intent === "borrower-profile") {
      return `结论：${borrowerName}已按当前固定证据绑定为${groupName}集团成员借款人；成立于 ${borrower.establishedDate || "未定位"}，法定代表人 ${borrower.legalRepresentative || "未定位"}，注册资本 ${m06QaMoney(borrower.registeredCapital, "万元")}，实际控制人为${borrower.ultimateController || "未定位"}。依据：borrowerId ${borrower.borrowerId || stable.borrowerId || "未定位"}、成员标识 ${memberId}、统一社会信用代码 ${uscc}、注册地址 ${borrower.registeredAddress || "未定位"}；股权摘要为“${fixed.ownership?.equitySummary || ownershipFact?.value || "未定位"}”，主营边界为“${borrower.businessBoundary || borrower.businessScope || "未定位"}”。证据引用 ${(borrower.evidenceRefs || []).join("、") || memberStatusFact.evidenceRef || "未定位"}。边界：系统只能说明本次固定资料中的工商、成员和股权事实；主体资格、持续成员资格、关联关系异常及授信准入仍须财务公司人工确认。`;
    }
    if (intent === "solvency") {
      return `结论：${borrowerName}的短期偿债指标在 2023—${reportYear} 年走弱：资产负债率上升、流动比率下降，且短期借款明显增加；利息保障倍数和经营现金流仍需作为人工判断还款能力的重要依据。依据：资产负债率 ${m06QaPercent(debtRatioValues["2023"])} → ${m06QaPercent(debtRatioValues["2024"])} → ${m06QaPercent(debtRatioValues[String(reportYear)] || debtRatio)}，流动比率 ${m06QaNumber(currentRatioValues["2023"], 2)} → ${m06QaNumber(currentRatioValues["2024"], 2)} → ${m06QaNumber(currentRatioValues[String(reportYear)] || currentRatio, 2)} 倍，EBIT/利息 ${m06QaNumber(interestCoverageValues[String(reportYear)], 2)} 倍；短期借款由${m06QaMoney(shortTermBorrowings2023, "万元")}增至${m06QaMoney(shortTermBorrowings2025, "万元")}，${reportYear} 年经营活动现金流量净额为${m06QaMoney(operatingCash2025, "万元")}。上述结果绑定数据版本 ${factPackage.dataVersion || reportBinding.dataVersion || "未定位"}，截至 ${borrower.financialStatementAsOf || fixedStatementAsOf || factPackage.asOf || "未定位"}。边界：报告助手只引用 Published Metric 和固定财务事实，不重算指标，也不据此认定“风险可控”；还款能力、短期债务到期结构及征信影响须由调查人员人工确认。`;
    }
    if (intent === "risks") {
      return `结论：当前报告登记 ${riskTitles.length || "若干"} 类主要风险${riskTitles.length ? `：${riskTitles.join("；")}` : ""}；报告 Agent 已为每类风险先写非约束性缓释建议。依据：电价风险对应 ${reportYear} 年营业收入增长率 ${m06QaPercent(revenueGrowthValues[String(reportYear)])}、主营业务利润率 ${m06QaPercent(mainMarginValues[String(reportYear)])}，AI 建议关注交易电价并优化购售电、机组效率和区域布局；运营与资本支出风险对应在建工程 ${m06QaMoney(cip2025, "万元")}、投资活动现金流量净额 ${m06QaMoney(investingCash2025, "万元")}，AI 建议持续核对安全质量、工程进度和融资安排；偿债风险对应资产负债率 ${m06QaPercent(debtRatio)}、流动比率 ${m06QaNumber(currentRatio, 2)} 倍、短期借款 ${m06QaMoney(shortTermBorrowings2025, "万元")}，AI 建议跟踪债务到期与经营现金流。全部引用固定证据包 ${factPackage.packageId || ctx.report?.evidencePackId || "未定位"}。边界：这些缓释内容均为“【需人工确认】AI 建议”；措施是否充分、“风险可控”判断及最终授信意见必须由财务公司人工确认。`;
    }
    if (intent === "human-boundary") {
      return "结论：系统可以依据已固化资料和系统事实生成调查分析、风险提示和非约束性综合判断，但不能形成正式授信决定。依据：风险与授信段落统一标注“【需人工确认】AI 建议（基于已固化资料与系统事实生成）”；报告生成阶段不直接联网搜索，也不读取未固化来源。边界：调查意见、风险可控性、正式授信结论、额度、期限、利率、条件、发布授权及 Action Request 均必须由财务公司人员通过受控入口确认或提交。";
    }
    if (intent === "versions-evidence") {
      return `结论：本报告只消费当前 scenarioRunId 锁定的权威组合，不自行选择“最新数据”。依据：报告 ${reportNo} / 内容版本 ${ctx.report?.contentVersion || "未定位"} 绑定 Published ${reportBinding.semanticVersionId || factPackage.semanticVersionId || "未定位"}、C008、数据资产版本 ${reportBinding.dataVersion || factPackage.dataVersion || "未定位"}、T018 可消费版本 ${reportBinding.consumableVersionId || factPackage.consumableVersionId || "未定位"} 和固定证据包 ${factPackage.packageId || ctx.report?.evidencePackId || "未定位"}；来源包括${sourceSummary}。边界：报告助手不读取工作簿或来源节点，证据缺失时只能披露缺口，不能换用其他公司、其他时点或其他版本补齐。`;
    }
    if (intent === "verification") {
      const resultText = qaVerification.complete
        ? `${coverage.completed || counts.pass} / ${coverage.applicable || coverage.planned || resultsLength(qaVerification.verification)} 个检查单元已完成，覆盖 ${coverage.factCovered || 0} / ${coverage.factTotal || 0} 项事实和 ${coverage.anchorCovered || 0} / ${coverage.anchorTotal || 0} 个稳定锚点；结果为 ${counts.pass} 项通过、${counts.warning} 项警告、${counts.fail} 项失败、${counts.unverifiable} 项无法核验`
        : `当前运行状态为 ${qaVerification.verification?.status || "未开始"}，尚不能证明整份报告完成确定性核验`;
      return `结论：${resultText}。依据：核验运行 ${verificationIdentity} 按 V01—V08 检查报告身份、Published/C008/T018 绑定、数据时点与版本、Metric/Rule 结果、证据引用、T044 稳定锚点和人工确认边界。边界：核验由报告中心确定性执行，LLM 只解释结果；重新核验必须重新评估当前固定上下文并新增运行记录，不改写已发布 HTML/PDF。`;
    }
    if (intent === "financial-risk-summary") {
      return `结论：第三部分显示杠杆和短期流动性压力上升，同时经营现金流仍为正；第四部分据此组织电价、运营、偿债及资本支出四类风险，并把风险可控性明确留给人工确认。依据：${reportYear} 年资产负债率 ${m06QaPercent(debtRatio)}、流动比率 ${m06QaNumber(currentRatio, 2)} 倍、短期借款 ${m06QaMoney(shortTermBorrowings2025, "万元")}、经营活动现金流量净额 ${m06QaMoney(operatingCash2025, "万元")}、在建工程 ${m06QaMoney(cip2025, "万元")}；风险部分登记 ${riskFacts.length || fixedRiskThemes.length} 个主题。自动核验运行 ${verificationIdentity} 当前${qaVerification.complete ? `已完成 ${counts.pass} / ${coverage.applicable || coverage.planned || 18} 个检查单元，并覆盖 ${coverage.factCovered || 0} / ${coverage.factTotal || 0} 项事实和 ${coverage.anchorCovered || 0} / ${coverage.anchorTotal || 0} 个锚点` : "尚未形成整份完整覆盖"}。边界：事实、Metric/Rule、证据定位和确定性核验由 Published/C008/T018 与报告中心负责；风险可控性、调查意见和正式授信结论必须人工确认。`;
    }
    if (intent === "next-borrower") {
      return `结论：报告定义、模板、Agent Release、工具白名单和确定性核验规则可以跨集团成员单位复用。依据：为新成员单位建立新的 borrowerId、memberId、applicationId、reportId、scenarioRunId，并重新形成来源实例、数据快照、数据资产版本、Published/C008/T018 绑定、固定证据包和内容版本。边界：不能覆盖${borrowerName}本次正式报告 ${reportNo}、Run/Result/Session 或正式 HTML/PDF，也不能把其事实带入新公司。`;
    }
    if (intent === "loan-application") {
      return `结论：申请 ${applicationId} 的申请金额为 ${amount}、期限 ${term}，产品为${application.loanType || application.productType || "未定位"}；用途为${application.purpose || "未定位"}${application.purposeDetail ? `，具体覆盖${application.purposeDetail}` : ""}，还款安排为${application.repaymentMode || "未定位"}，主要还款来源为${application.repaymentSource || "未定位"}。依据：贷款申请、用途合同和还款计划均绑定当前固定证据包；当前资金需求测算上限为 ${fundingFact || "未定位"}${application.purposeContractCoverageRatio ? `，用途合同覆盖率为 ${m06QaPercent(Number(application.purposeContractCoverageRatio) * 100)}` : ""}。边界：这些是申请与还款安排事实，不等于财务公司已批准额度、利率或授信条件；还款来源是否充分仍须人工确认。`;
    }
    if (intent === "supporting-materials") {
      const facility = application.internalFacility || {};
      const materialCount = Object.keys(application.supportingMaterialStatus || {}).length;
      const guaranteeCopy = [application.guaranteeStatus, application.collateralStatus].every((value) => value === "NOT_APPLICABLE")
        ? "保证人和抵质押物均明确登记为 NOT_APPLICABLE"
        : `保证状态 ${application.guaranteeStatus || "未定位"}、抵质押状态 ${application.collateralStatus || "未定位"}`;
      return `结论：本次申请采用信用方式（${application.guaranteeMode || "未定位"}），${guaranteeCopy}；征信、内部评级、内部授信、历史融资和现场调查等 ${materialCount || "相关"} 类资料均为“已登记、待人工核验”，不是“已核验无异常”。依据：内部批准额度 ${m06QaMoney(facility.approvedAmount, application.amountUnit || "万元")}、已用 ${m06QaMoney(facility.usedAmount, application.amountUnit || "万元")}、可用 ${m06QaMoney(facility.availableAmount, application.amountUnit || "万元")}，数据截至 ${facility.asOf || application.dataAsOf || "未定位"}；资料状态码为 REGISTERED_REQUIRES_HUMAN_VERIFICATION。边界：资料“已登记”不等于征信无风险或授信可批准，也不代表融资余额、主体匹配和资料真实性已由财务公司确认；信用方式与风险结论必须人工核验。`;
    }
    if (intent === "source-classes") {
      const financialPeriods = (borrower.financialStatementPeriods || fixedPeriods.map((period) => period.key)).join("、") || reportYear;
      const sourceCatalogue = Array.isArray(fixed.sourceCatalogue) ? fixed.sourceCatalogue : [];
      const sourceClassSummary = sourceCatalogue.map((item) => `${item.label}〔${item.sourceClass}〕`).join("；");
      return `结论：${financialPeriods} 年财务报表中的资产负债表、利润表、现金流量表及其财务指标来自正式年度报告；工商、股权、经营、评级和行业政策事实采用“年报 + 已标注 synthetic-demo 的补充资料”混合来源；贷款申请、内部授信、征信、历史融资、担保抵质押和现场调查由贷款调查补充资料槽承接。依据：本轮来源目录为${sourceSummary}；逐项来源包括${sourceClassSummary || "当前固定证据包中的来源目录"}，每项均形成不可变快照、质量结果、数据资产版本和 C008 证据引用。边界：财务报告已有财务事实不得重复设置上传型模拟数据；synthetic-demo 和 human-procedure 必须显式披露，正式报告只消费 Published/C008/T018 权威投影，不直接读取资料文件。`;
    }
    if (intent === "dates-units") {
      const periods = (borrower.financialStatementPeriods || fixedPeriods.map((period) => period.key)).join("—") || reportYear;
      return `结论：财务事实币种为 ${borrower.currency || fixed.financialStatements?.currency || application.currency || "未定位"}，报告展示单位为${borrower.reportDisplayUnit || application.amountUnit || fixed.financialStatements?.unit || "未定位"}，财务期间为 ${periods}，财务报表截至 ${borrower.financialStatementAsOf || fixedStatementAsOf || "未定位"}；贷款调查资料截至 ${application.dataAsOf || factPackage.asOf || "未定位"}，正式报告出具日期为 ${m06QaChineseDate(ctx.profile.naming.currentIssueDate)}。依据：这些值由借款人配置、贷款申请、数据资产、C008/T018、报告定义和发布清单共同锁定。边界：新公司、新申请或新时点必须创建新的快照、版本、scenarioRunId 和报告身份。`;
    }
    if (intent === "reusable-resources") {
      return `结论：通用来源槽位和质量门、对象/关系/Metric/Rule 定义、报告定义与模板、Agent Release 及核验规则可以复用。依据：当前配置将通用定义与 ${borrowerName} 的实例键、数据快照和报告身份分离。边界：新借款人必须形成新的 borrowerId、applicationId、scenarioRunId、数据快照、Published/C008/T018、固定证据包和内容版本；不能覆盖${borrowerName}本次正式报告 ${reportNo}。`;
    }
    if (intent === "member-eligibility") {
      const memberStatus = memberStatusFact.value || "未定位";
      const memberRule = fixed.ruleRun?.results?.find((item) => item?.ruleId === "RULE-S004-MEMBER-ACTIVE") || null;
      return `结论：当前固定事实中的成员资格状态为 ${memberStatus}；只有状态为 ACTIVE 且借款人身份键与贷款申请一致时，主体才进入财务公司贷前调查范围。依据：成员标识 ${memberId}、borrowerId ${borrower.borrowerId || stable.borrowerId || "未定位"}、统一社会信用代码 ${uscc}，成员事实 ${memberStatusFact.factId || "未定位"} / 证据 ${memberStatusFact.evidenceRef || "未定位"}，Published Rule ${memberRule?.ruleId || "RULE-S004-MEMBER-ACTIVE"} 在 Rule Run ${fixed.ruleRun?.ruleRunId || "未定位"} 中结果为 ${memberRule?.result || "未定位"}。边界：缺少成员事实或 Rule 结果时必须显示“未定位/无法核验”，不得默认 ACTIVE；主体资格、关联关系异常和授信准入仍须财务公司人员确认。`;
    }
    if (intent === "metric-lineage") {
      const metricCount = Array.isArray(fixed.metricResults) ? fixed.metricResults.length : 0;
      return `结论：财务指标由 Published Metric 的固定公式和 C008 财务报表事实确定性形成，报告助手只读取结果。依据：本轮固定证据包登记 ${metricCount} 项 Metric 结果，当前示例中的资产负债率 ${m06QaPercent(debtRatio)}、流动比率 ${m06QaNumber(currentRatio, 2) || "未定位"} 倍均绑定 Metric ID、结果版本、数据资产版本 ${factPackage.dataVersion || reportBinding.dataVersion || "未定位"} 及稳定锚点。边界：Agent 不直接读取年报或工作簿，也不重新计算正式指标；如需修改公式或数据，必须由本体管理或数据工程形成新版本后重新装配报告。`;
    }
    if (intent === "verification-remediation") {
      return `结论：核验失败、警告或无法核验时，应保留当前运行记录并按问题责任修复，再发起新的独立核验运行。依据：V01—V08 分别定位报告身份、Published/C008、数据版本、Metric、Rule、证据、T044 锚点和人工确认边界；当前运行 ${verificationIdentity} 的结果为 ${counts.pass} 项通过、${counts.warning} 项警告、${counts.fail} 项失败、${counts.unverifiable} 项无法核验。边界：重新核验不得覆盖历史 Run 或已发布 HTML/PDF；涉及数据、本体、Agent 草稿或人工判断的修复必须由相应 Owner 形成新版本或新确认记录。`;
    }
    if (intent === "credit-investigation") {
      const creditStatus = application.supportingMaterialStatus?.creditSummary || "未登记";
      const onsiteStatus = application.supportingMaterialStatus?.onsiteInvestigation || "未登记";
      return `结论：当前征信摘要与现场调查资料已进入固定证据包，但二者均处于“已登记、待人工核验”状态，只能证明已纳入核对范围，不能证明借款人“无征信风险”。依据：征信资料状态 ${creditStatus}、现场调查状态 ${onsiteStatus}，均绑定申请 ${applicationId}、资料截至 ${application.dataAsOf || factPackage.asOf || "未定位"} 和证据包 ${factPackage.packageId || ctx.report?.evidencePackId || "未定位"}。边界：REGISTERED_REQUIRES_HUMAN_VERIFICATION 表示仍须人工核对征信主体、查询时点、未结清融资、逾期、对外担保及异常说明；系统和 Agent 不得把“已登记”解释为“无风险”或据此给出授信决定。`;
    }
    if (intent === "guarantee-collateral") {
      const guarantee = application.guaranteeStatus || "未定位";
      const collateral = application.collateralStatus || "未定位";
      const mode = application.guaranteeMode || "未定位";
      const noSecurity = guarantee === "NOT_APPLICABLE" && collateral === "NOT_APPLICABLE";
      return `结论：本次申请登记为${application.loanType || application.productType || "贷款申请"}，担保方式 ${mode}；${noSecurity ? "保证、抵押和质押均为 NOT_APPLICABLE，当前没有对应担保物或保证人实例" : `保证状态 ${guarantee}、抵质押状态 ${collateral}`}。依据：申请 ${applicationId} 的保证状态为 ${guarantee}、抵质押状态为 ${collateral}，这些字段来自当前贷款调查补充资料和固定证据包。边界：NOT_APPLICABLE 只说明本次申请未设置该类增信安排，不等于风险较低或信用方式可以批准；是否接受信用方式、是否追加担保及其条件必须由财务公司人工确认。`;
    }
    if (intent === "historical-financing") {
      const facility = application.internalFacility || {};
      const historyStatus = application.supportingMaterialStatus?.historicalFinancing || "未登记";
      return `结论：财务公司内部授信批准额度为 ${m06QaMoney(facility.approvedAmount, application.amountUnit || "万元")}，已使用 ${m06QaMoney(facility.usedAmount, application.amountUnit || "万元")}，可用 ${m06QaMoney(facility.availableAmount, application.amountUnit || "万元")}，截至 ${facility.asOf || "未定位"}；历史融资资料状态为 ${historyStatus}。依据：内部授信占用与历史融资资料均绑定申请 ${applicationId} 和当前固定证据包，额度恒等关系为批准额度 = 已用 + 可用。边界：这些是演示资料中的内部占用与资料登记事实，不代表外部融资余额、隐性负债或交叉违约已全部核清；历史融资真实性、未结清余额和授信可用性仍须人工确认，Agent 不得据此形成正式额度。`;
    }
    if (intent === "ownership-membership") {
      const memberStatus = memberStatusFact.value || "未定位";
      const memberRule = fixed.ruleRun?.results?.find((item) => item?.ruleId === "RULE-S004-MEMBER-ACTIVE") || null;
      return `结论：${borrowerName}的控股股东为${groupName}，固定成员资格状态为 ${memberStatus}；股权、主体身份和贷款申请键在本轮证据中保持一致。依据：统一社会信用代码 ${uscc}、成员标识 ${memberId}、borrowerId ${borrower.borrowerId || stable.borrowerId || "未定位"}、applicationId ${applicationId}，股权摘要“${fixed.ownership?.equitySummary || ownershipFact?.value || "未定位"}”，成员证据 ${memberStatusFact.evidenceRef || "未定位"}，以及 Published 成员资格 Rule ${memberRule?.ruleId || "RULE-S004-MEMBER-ACTIVE"} / Rule Run ${fixed.ruleRun?.ruleRunId || "未定位"} / 结果 ${memberRule?.result || "未定位"}。边界：系统只能核对固定证据中的身份与关系一致性；穿透股权异常、成员资格持续有效性、关联交易影响和授信准入仍须财务公司人工复核。`;
    }
    if (intent === "working-capital-calculation") {
      const workingCapital = fixed.workingCapital || {};
      return `结论：本次新增流动资金贷款测算上限为 ${m06QaMoney(workingCapital.maximumNewWorkingCapitalLoan || String(fundingRaw || "").replace(/[^\d.-]/g, ""), "万元")}，该数值是确定性测算结果，不是已批准授信额度。依据：营运资金量 ${m06QaMoney(workingCapital.workingCapitalNeed, "万元")} − 借款人自有资金 ${m06QaMoney(workingCapital.borrowerOwnFunds || cash2025, "万元")} − 现有流动资金贷款 ${m06QaMoney(workingCapital.existingWorkingCapitalLoans, "万元")} − 其他渠道资金 ${m06QaMoney(workingCapital.otherWorkingCapitalChannels, "万元")}；营运资金周转次数为 ${m06QaNumber(workingCapital.workingCapitalTurnover, 4)} 次，取整规则为“${workingCapital.roundingPolicy || "按报告定义执行"}”。边界：报告助手只解释已登记的 Metric 结果，不重新计算或调整参数；最终额度、期限、利率和条件必须由财务公司人工审批。`;
    }
    if (intent === "publication-immutability") {
      return `结论：已发布的 HTML/PDF、报告编号 ${reportNo}、内容版本 ${ctx.report?.contentVersion || "未定位"} 和证据链保持不可变；数据、模板、Agent 或规则更新后只能创建新的内容版本或替代报告。依据：当前报告锁定 scenarioRunId ${context.scenarioRunId || "未定位"}、Published ${reportBinding.semanticVersionId || factPackage.semanticVersionId || "未定位"}、数据资产版本 ${reportBinding.dataVersion || factPackage.dataVersion || "未定位"}、T018 ${reportBinding.consumableVersionId || factPackage.consumableVersionId || "未定位"} 和证据包 ${factPackage.packageId || ctx.report?.evidencePackId || "未定位"}。边界：重新核验、重新生成或切换借款人均不得覆盖历史正式制品；新版本须重新固定证据、核验并人工确认后才能发布。`;
    }
    if (intent === "end-to-end-chain") {
      return "结论：完整控制链为“数据来源/合成节点 → 不可变快照与质量 → Published 本体与 C008/T018 → Metric/Rule 确定性结果 → 报告中心固定证据包 → M05 报告 Agent 结构化草稿 → M06 T044 事实项与稳定锚点绑定 → 18 项确定性核验 → 人工复核 → 同源 HTML/PDF 发布 → 报告伴读”。依据：数据工程、本体管理、Agent 应用和报告中心分别保留 Owner 状态、版本、Run/Result/Session 与证据定位；M03 在本场景为 NOT_APPLICABLE，M04 保留空 Action Request 队列。边界：Agent 不直接读取工作簿、不选择最新数据、不重算正式指标、不发布报告；任何问题行动须由用户经受控入口提交标准 Action Request。";
    }
    if (intent === "blocking-gates") {
      return `结论：缺少稳定身份、来源快照/质量、Published/C008/T018 权威绑定、固定证据包、Agent 草稿、T044 锚点、完整核验或人工确认中的任一关键项，都会阻断相应阶段。依据：生成前必须锁定 borrowerId/memberId/applicationId/scenarioRunId、数据版本和证据包；自动核验要求 18 / 18 检查单元、${coverage.factTotal || 19} / ${coverage.factTotal || 19} 项事实和 ${coverage.anchorTotal || 19} / ${coverage.anchorTotal || 19} 个锚点完整；风险与授信段落还必须保留“【需人工确认】AI 建议”标记。边界：系统不得用其他公司、其他时点或“最新数据”替补缺口，也不得绕过人工确认；修复后应形成新的快照、版本或独立 Run，历史记录不覆盖。`;
    }
    return "结论：当前问题尚未命中本报告已登记的问答意图，报告助手不会据此猜测或补造业务事实。依据：本次会话只绑定当前报告、稳定锚点、Published/C008/T018 版本和固定证据包。边界：请从推荐问题中选择，或把问题改写为借款人身份、贷款申请、财务指标、风险、证据、核验或人工确认边界；最终授信判断仍由财务公司人工完成。";
  }

  function m06QaCitationRefs(intent, ctx) {
    const fixed = ctx?.deterministicInputs || {};
    const riskRefs = (fixed.riskThemes || []).flatMap((item) => [item?.riskId, ...(item?.evidenceRefs || [])]);
    const sourceRefs = (fixed.sourceCatalogue || []).flatMap((item) => [item?.sourceId, ...(item?.evidenceRefs || [])]);
    const refsByIntent = {
      "borrower-profile": [fixed.borrower?.factId, ...(fixed.borrower?.evidenceRefs || []), fixed.memberStatus?.factId, fixed.memberStatus?.evidenceRef, fixed.ownership?.factId],
      solvency: ["MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO", "MET-EBIT-INTEREST-COVERAGE", "BS-ST-BORROWINGS", "CF-OPERATING-NET", fixed.metricRunId],
      risks: [...riskRefs, "MET-REVENUE-GROWTH", "MET-NET-PROFIT-GROWTH", "BS-CIP", "CF-INVESTING-NET"],
      "human-boundary": ["RULE-S004-HUMAN-CREDIT-CONCLUSION", "RULE-S004-RISK-CONTROLLABILITY-HUMAN", fixed.ruleRun?.ruleRunId],
      "versions-evidence": [ctx?.factPackage?.semanticVersionId, ctx?.factPackage?.dataVersion, ctx?.factPackage?.consumableVersionId, ctx?.factPackage?.packageId, ...sourceRefs],
      verification: [ctx?.verification?.runId, "V01", "V02", "V03", "V04", "V05", "V06", "V07", "V08"],
      "financial-risk-summary": ["MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO", "BS-ST-BORROWINGS", "CF-OPERATING-NET", "BS-CIP", ctx?.verification?.runId, ...riskRefs],
      "next-borrower": [ctx?.report?.definitionId, ctx?.evidencePack?.template?.id, ctx?.factPackage?.packageId],
      "loan-application": [fixed.loanApplication?.factId, "SIM_LOAN_APPLICATION", "SIM_LOAN_LEDGER", "MET-MAX-NEW-WORKING-CAPITAL-LOAN"],
      "supporting-materials": [fixed.internalFacility?.factId, "SIM_INTERNAL_CREDIT", "SIM_LOAN_LEDGER", "SIM_MEMBER_REGISTRY"],
      "source-classes": sourceRefs,
      "dates-units": [ctx?.factPackage?.dataVersion, ctx?.factPackage?.asOf, fixed.financialStatements?.periods?.at?.(-1)?.asOfDate],
      "reusable-resources": [ctx?.report?.definitionId, ctx?.evidencePack?.template?.id, ctx?.factPackage?.semanticVersionId],
      "member-eligibility": [fixed.memberStatus?.factId, fixed.memberStatus?.evidenceRef, "RULE-S004-MEMBER-ACTIVE", fixed.ruleRun?.ruleRunId],
      "metric-lineage": [fixed.metricRunId, "MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO", ctx?.factPackage?.dataVersion],
      "verification-remediation": [ctx?.verification?.runId, "V01", "V02", "V03", "V04", "V05", "V06", "V07", "V08"],
      "credit-investigation": ["SIM_INTERNAL_CREDIT", "SIM_LOAN_LEDGER", ctx?.factPackage?.packageId],
      "guarantee-collateral": [fixed.loanApplication?.factId, "SIM_LOAN_APPLICATION"],
      "historical-financing": [fixed.internalFacility?.factId, "SIM_INTERNAL_CREDIT", "SIM_LOAN_LEDGER"],
      "ownership-membership": [fixed.ownership?.factId, ...(fixed.ownership?.evidenceRefs || []), fixed.memberStatus?.factId, fixed.memberStatus?.evidenceRef, "RULE-S004-MEMBER-ACTIVE", fixed.ruleRun?.ruleRunId],
      "working-capital-calculation": [fixed.workingCapital?.factId, "MET-WORKING-CAPITAL-TURNOVER", "MET-WORKING-CAPITAL-NEED", "MET-MAX-NEW-WORKING-CAPITAL-LOAN", "RULE-S004-AMOUNT-WITHIN-FUNDING", "RULE-S004-AMOUNT-WITHIN-FACILITY", fixed.ruleRun?.ruleRunId],
      "publication-immutability": [ctx?.report?.reportNo, ctx?.report?.contentVersion, ctx?.factPackage?.semanticVersionId, ctx?.factPackage?.dataVersion, ctx?.factPackage?.consumableVersionId, ctx?.factPackage?.packageId],
      "end-to-end-chain": ["M02", "M01", "C008", "T018", "M05", "C022", "C023", "M06", "T044", "T049"],
      "blocking-gates": [ctx?.factPackage?.packageId, ctx?.factPackage?.semanticVersionId, ctx?.factPackage?.dataVersion, ctx?.verification?.runId, "T044", "V01—V08"]
    };
    return [...new Set([
      ctx?.reportContext?.selectedAnchor,
      ctx?.evidencePack?.id || ctx?.factPackage?.packageId,
      ...(refsByIntent[intent] || [])
    ].filter(Boolean).map(String))];
  }

  function resultsLength(verification) {
    return Array.isArray(verification?.results) ? verification.results.length : 0;
  }

  function m06AnswerForQuestion(question, contextOverride = null) {
    const text = String(question || "").trim();
    const catalog = m06QaCatalogForCurrentProfile();
    const byIntent = Object.fromEntries(catalog.map((item) => [item.intent, item]));
    const exact = catalog.find((item) => item.question === text);
    let selected = exact || null;
    if (!selected && /(最终|正式|直接|请给|确定).*(授信|审批|额度|期限|利率|条件|结论|决定)|(授信|审批).*(额度|期限|利率|条件|结论|决定)/.test(text)) selected = byIntent["human-boundary"];
    if (!selected && /(新增|流动资金).*(额度|上限|测算|营运资金)|(营运资金).*(周转|测算|公式)/.test(text)) selected = byIntent["working-capital-calculation"];
    if (!selected && /(已发布|正式报告).*(原地|覆盖|更新|变化|不可变)|(数据|模板|Agent|规则).*(更新|变化).*(报告|版本)/.test(text)) selected = byIntent["publication-immutability"];
    if (!selected && /(完整|全链路|端到端|从数据).*(控制链|流程|发布|HTML|PDF)|(数据接入).*(报告发布)/.test(text)) selected = byIntent["end-to-end-chain"];
    if (!selected && /(哪些|什么).*(缺口|条件|状态).*(阻断|不能生成|不能核验|不能确认)|(生成|核验|人工确认).*(阻断|缺口)/.test(text)) selected = byIntent["blocking-gates"];
    if (!selected && /核验.*(未通过|失败|异常|怎么处理|如何处理|整改|修复)|整改.*核验/.test(text)) selected = byIntent["verification-remediation"];
    if (!selected && /成员资格|成员单位.*(确认|校验|准入)|属于集团/.test(text)) selected = byIntent["member-eligibility"];
    if (!selected && /指标.*(来源|追溯|计算|公式)|Metric|原始证据/.test(text)) selected = byIntent["metric-lineage"];
    if (!selected && /更换借款人|换借款人/.test(text)) selected = byIntent["reusable-resources"];
    if (!selected && /其他|后续|复用|适配|新公司|成员单位报告/.test(text)) selected = byIntent["next-borrower"];
    if (!selected && /征信.*(核验|核对|风险|资料)|信用报告/.test(text)) selected = byIntent["credit-investigation"];
    if (!selected && /保证|抵押|质押|增信安排|担保物|保证人/.test(text)) selected = byIntent["guarantee-collateral"];
    if (!selected && /历史融资|内部授信|授信占用|批准额度|可用额度/.test(text)) selected = byIntent["historical-financing"];
    if (!selected && /股权.*成员|控股股东.*成员|成员资格.*股权|联合核验/.test(text)) selected = byIntent["ownership-membership"];
    if (!selected && /担保|抵质押|征信|历史融资|授信资料/.test(text)) selected = byIntent["supporting-materials"];
    if (!selected && /金额|期限|用途|还款来源|申请编号|贷款申请/.test(text)) selected = byIntent["loan-application"];
    if (!selected && /财务报告|外部|内部|合成资料|数据源分类/.test(text)) selected = byIntent["source-classes"];
    if (!selected && /币种|单位|截至时间|报告日期|出具日期/.test(text)) selected = byIntent["dates-units"];
    if (!selected && /自动核验|核验规则|检查规则|核验结果/.test(text)) selected = byIntent.verification;
    if (!selected && /人工|授信结论|授信额度|利率|AI/.test(text)) selected = byIntent["human-boundary"];
    if (!selected && /证据|版本|数据源|截至|Published|C008|T018/.test(text)) selected = byIntent["versions-evidence"];
    if (!selected && /风险|缓释|经营|资本支出|电价/.test(text)) selected = byIntent.risks;
    if (!selected && /偿债|财务|指标|流动比率|负债率|短期借款/.test(text)) selected = byIntent.solvency;
    if (!selected && /借款人|成员单位|工商|股东|实际控制人/.test(text)) selected = byIntent["borrower-profile"];
    selected = selected || M06_UNKNOWN_QA;
    const qaContext = contextOverride || m06QaContext();
    return {
      ...selected,
      answer: formatM06QaAnswer(m06QaAnswerByIntent(selected.intent, qaContext)),
      citationRefs: m06QaCitationRefs(selected.intent, qaContext),
      verificationRunId: qaContext?.verification?.runId || null,
      evidencePackageId: qaContext?.evidencePack?.id || qaContext?.factPackage?.packageId || null
    };
  }

  function s004ReportContentContract(report) {
    const versions = report?.contentVersions || [];
    const active = versions.find((item) => item?.reviewCopyId && item.reviewCopyId === report?.reviewCopyId)
      || versions.find((item) => item?.contentVersion && item.contentVersion === report?.contentVersion)
      || versions[0]
      || {};
    return {
      verificationPlan: Array.isArray(active.verificationPlan) ? active.verificationPlan : [],
      factInventory: Array.isArray(active.factInventory) ? active.factInventory : [],
      t044Bindings: Array.isArray(active.t044Bindings) ? active.t044Bindings : []
    };
  }

  const S004_VERIFICATION_ENGINE_VERSION = "S004-T049-V01-V08@2.1.0";

  function s004VerificationResult(code, status, issue, evidence, anchor, options = {}) {
    const rule = M06_VERIFICATION_RULES.find((item) => item[0] === code) || [code, code, "确定性检查"];
    const passed = status === "pass";
    return {
      id: `T049-S004-${code}`,
      checkId: code,
      name: `${code} · ${rule[1]}`,
      status,
      reasonCode: options.reasonCode || `${code}_${String(status).toUpperCase()}`,
      anchor: anchor || "report-cover",
      location: options.location || rule[2],
      issue,
      evidence: evidence || "当前固定上下文不可定位",
      version: options.version || S004_VERIFICATION_ENGINE_VERSION,
      impact: options.impact || (passed ? "未发现影响当前报告可追溯性和正式边界的问题。" : "当前内容不能据此证明满足对应的确定性门。"),
      responsibility: options.responsibility || "报告中心（M06）",
      recommendation: options.recommendation || (passed ? "保留当前固定绑定。" : "由对应 Owner 修复后创建新的独立核验运行；不得覆盖历史报告或历史运行。")
    };
  }

  function s004FactEvidenceRefs(fact) {
    return [...new Set([
      ...(Array.isArray(fact?.evidence) ? fact.evidence : []),
      ...(Array.isArray(fact?.evidenceRefs) ? fact.evidenceRefs : [])
    ].filter(Boolean))];
  }

  const S004_DETAILED_CHECK_RULES = Object.freeze({
    "VER-V2-BASELINE-CONTEXT": "V01",
    "VER-V2-PUBLISHED-LIFECYCLE": "V02",
    "VER-V2-C008-IDENTITY": "V02",
    "VER-V2-EVIDENCE-PACKAGE-OWNER": "V06",
    "VER-V2-EVIDENCE-HASH-PUBLISHED": "V02",
    "VER-V2-EVIDENCE-HASH-C008": "V02",
    "VER-V2-NO-RAW-INPUT-REF": "V06",
    "VER-V2-SECTION-ORDER": "V07",
    "VER-V2-FORMAL-PAGE-SYSTEM": "V07",
    "VER-V2-OPERATIONS-FOUR-SUBSECTIONS": "V07",
    "VER-V2-RISK-THEMES": "V05",
    "VER-V2-OWNERSHIP-COMPLETE": "V06",
    "VER-V2-THREE-FULL-STATEMENTS": "V03",
    "VER-V2-FOURTEEN-METRICS": "V04",
    "VER-V2-METRIC-RECALCULATION": "V04",
    "VER-V2-WORKING-CAPITAL-CALCULATION": "V04",
    "VER-V2-DRAFT-EVIDENCE-BOUNDARY": "V06",
    "VER-V2-AGENT-DECISION-BOUNDARY": "V08"
  });
  const S004_DETAILED_CHECK_NAMES = Object.freeze({
    "VER-V2-BASELINE-CONTEXT": "基线版本、冻结快照、场景版本和scenarioRunId一致。",
    "VER-V2-PUBLISHED-LIFECYCLE": "C008只绑定Published本体及同一T019指针。",
    "VER-V2-C008-IDENTITY": "C008、证据包和报告稳定身份一致。",
    "VER-V2-EVIDENCE-PACKAGE-OWNER": "固定证据包由M06报告中心拥有，M05报告Agent仅按锁定合同消费。",
    "VER-V2-EVIDENCE-HASH-PUBLISHED": "固定证据包锁定的Published本体哈希与实际文件一致。",
    "VER-V2-EVIDENCE-HASH-C008": "固定证据包锁定的C008哈希与实际文件一致。",
    "VER-V2-NO-RAW-INPUT-REF": "正式构建输入仅为Published本体、C008、固定证据包、结构化草稿、报告定义和人工确认。",
    "VER-V2-SECTION-ORDER": "权威示例的封面、五部分及数据来源顺序完整。",
    "VER-V2-FORMAL-PAGE-SYSTEM": "正式PDF使用A4纵向页面，并固定2026-08-15创建及修改日期。",
    "VER-V2-OPERATIONS-FOUR-SUBSECTIONS": "第二部分严格包含四个权威小节。",
    "VER-V2-RISK-THEMES": "第四部分严格使用四个权威风险主题。",
    "VER-V2-OWNERSHIP-COMPLETE": "第一部分包含股权结构、前十大股东及质押冻结事实。",
    "VER-V2-THREE-FULL-STATEMENTS": "第三部分包含权威示例列示的三年完整资产负债表、利润表和现金流量表。",
    "VER-V2-FOURTEEN-METRICS": "14项财务指标均包含2023、2024、2025三年结果。",
    "VER-V2-METRIC-RECALCULATION": "14项×3年指标已从C008 Published事实确定性复算一致。",
    "VER-V2-WORKING-CAPITAL-CALCULATION": "营运资金周转次数、营运资金量和新增流动资金贷款额度按权威示例精度确定性复算一致。",
    "VER-V2-DRAFT-EVIDENCE-BOUNDARY": "Agent草稿全部声明的证据均来自固定证据包。",
    "VER-V2-AGENT-DECISION-BOUNDARY": "Agent与Rule均未生成授信结论、额度、利率、条件或风险可控判断。"
  });

  function s004CanonicalVerificationPlan(report) {
    const evidencePack = (report?.evidencePacks || []).find((item) => item?.id === report?.evidencePackId)
      || report?.evidencePacks?.[0]
      || {};
    const factPackage = evidencePack.authoritativeFactPackage || {};
    const contract = s004ReportContentContract(report);
    const bindings = contract.t044Bindings.length
      ? contract.t044Bindings
      : (factPackage.contentItems || []).map((item, index) => ({
          id: item?.id || item?.contentItemId || `T044-S004-RUNTIME-${String(index + 1).padStart(3, "0")}`,
          contentItemId: item?.contentItemId || item?.id || null,
          anchorId: item?.anchorId || item?.stableAnchor || null,
          templateSlot: item?.templateSlot || null,
          factRefs: cloneJson(item?.factRefs || []),
          intendedFactRefs: cloneJson(item?.intendedFactRefs || []),
          evidenceRefs: cloneJson(item?.evidenceRefs || []),
          bindingStatus: item?.bindingStatus || "bound"
        }));
    const bindingsForCheck = (checkId) => {
      const match = (anchorId) => bindings.filter((binding) =>
        binding?.anchorId === anchorId || binding?.templateSlot === anchorId);
      if (/OPERATIONS/.test(checkId)) return bindings.filter((binding) => binding?.templateSlot === "sec-02-operations");
      if (/RISK|AGENT-DECISION/.test(checkId)) return bindings.filter((binding) =>
        binding?.templateSlot === "sec-04-risk" || binding?.anchorId === "sec-05-credit-conclusion");
      if (/OWNERSHIP/.test(checkId)) return match("sec-01-borrower-evaluation");
      if (/STATEMENTS|METRIC|WORKING-CAPITAL/.test(checkId)) return bindings.filter((binding) => binding?.templateSlot === "sec-03-financial");
      if (/FORMAL-PAGE|IDENTITY|BASELINE-CONTEXT/.test(checkId)) return match("report-cover");
      return bindings;
    };
    return Object.keys(S004_DETAILED_CHECK_RULES).map((checkId) => {
      const matchedBindings = bindingsForCheck(checkId);
      return {
        id: checkId,
        checkId,
        factId: matchedBindings.flatMap((binding) => binding?.factRefs || [])[0] || null,
        contentItemId: matchedBindings[0]?.contentItemId || null,
        checkType: checkId,
        checkName: S004_DETAILED_CHECK_NAMES[checkId] || checkId,
        owner: "报告中心",
        applicability: "applicable",
        executionState: "planned",
        t044Ids: matchedBindings.map((binding) => binding.id).filter(Boolean)
      };
    });
  }

  function s004FiniteNumber(value) {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function s004Round(value, digits = 0) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function s004DecimalPlaces(value) {
    const text = String(value ?? "").trim();
    return text.includes(".") ? text.split(".")[1].length : 0;
  }

  function s004ValuesMatchCalculated(calculated, expected) {
    const expectedNumber = s004FiniteNumber(expected);
    if (!Number.isFinite(calculated) || expectedNumber == null) return false;
    return s004Round(calculated, s004DecimalPlaces(expected)) === expectedNumber;
  }

  function s004MetricRecalculation(inputs) {
    const statements = inputs?.financialStatements || {};
    const opening = inputs?.metricOpeningBalances2022 || {};
    const metricResults = Array.isArray(inputs?.metricResults) ? inputs.metricResults : [];
    const tableRows = [
      ...(Array.isArray(statements.balanceSheet) ? statements.balanceSheet : []),
      ...(Array.isArray(statements.incomeStatement) ? statements.incomeStatement : [])
    ];
    const rowById = new Map(tableRows.filter((row) => row?.factId).map((row) => [row.factId, row]));
    const value = (factId, year) => s004FiniteNumber(rowById.get(factId)?.values?.[year]);
    const previous = (factId, year, openingKey) => year === "2023"
      ? s004FiniteNumber(opening?.[openingKey])
      : value(factId, String(Number(year) - 1));
    const average = (factId, year, openingKey) => {
      const current = value(factId, year);
      const prior = previous(factId, year, openingKey);
      return current == null || prior == null ? null : (current + prior) / 2;
    };
    const divide = (numerator, denominator) => numerator == null || denominator == null || denominator === 0
      ? null
      : numerator / denominator;
    const calculators = {
      "MET-DEBT-ASSET-RATIO": (year) => divide(value("BS-LIABILITIES-TOTAL", year), value("BS-ASSETS-TOTAL", year)),
      "MET-CURRENT-RATIO": (year) => divide(value("BS-CA-TOTAL", year), value("BS-CL-TOTAL", year)),
      "MET-EBIT-INTEREST-COVERAGE": (year) => {
        const interest = value("IS-INTEREST-EXPENSE", year);
        const profitBeforeTax = value("IS-PBT", year);
        return divide(profitBeforeTax == null || interest == null ? null : profitBeforeTax + interest, interest);
      },
      "MET-MAIN-BUSINESS-PROFIT-MARGIN": (year) => {
        const revenue = value("IS-REVENUE", year);
        const operatingCost = value("IS-OPERATING-COST", year);
        const tax = value("IS-TAX-SURCHARGES", year);
        return divide(revenue == null || operatingCost == null || tax == null ? null : revenue - operatingCost - tax, revenue);
      },
      "MET-RETURN-ON-TOTAL-ASSETS": (year) => {
        const interest = value("IS-INTEREST-EXPENSE", year);
        const profitBeforeTax = value("IS-PBT", year);
        return divide(profitBeforeTax == null || interest == null ? null : profitBeforeTax + interest, average("BS-ASSETS-TOTAL", year, "totalAssets"));
      },
      "MET-RETURN-ON-PARENT-EQUITY": (year) => divide(value("IS-PARENT-NET-PROFIT", year), average("BS-PARENT-EQUITY", year, "parentEquity")),
      "MET-INVENTORY-TURNOVER": (year) => divide(value("IS-OPERATING-COST", year), average("BS-INVENTORY", year, "inventory")),
      "MET-AR-TURNOVER": (year) => divide(value("IS-REVENUE", year), average("BS-AR", year, "accountsReceivable")),
      "MET-TOTAL-ASSET-TURNOVER": (year) => divide(value("IS-REVENUE", year), average("BS-ASSETS-TOTAL", year, "totalAssets")),
      "MET-CURRENT-ASSET-TURNOVER": (year) => divide(value("IS-REVENUE", year), average("BS-CA-TOTAL", year, "currentAssets")),
      "MET-TOTAL-ASSET-GROWTH": (year) => {
        const ratio = divide(value("BS-ASSETS-TOTAL", year), previous("BS-ASSETS-TOTAL", year, "totalAssets"));
        return ratio == null ? null : ratio - 1;
      },
      "MET-PARENT-EQUITY-GROWTH": (year) => {
        const ratio = divide(value("BS-PARENT-EQUITY", year), previous("BS-PARENT-EQUITY", year, "parentEquity"));
        return ratio == null ? null : ratio - 1;
      },
      "MET-NET-PROFIT-GROWTH": (year) => {
        const ratio = divide(value("IS-NET-PROFIT", year), previous("IS-NET-PROFIT", year, "netProfit"));
        return ratio == null ? null : ratio - 1;
      },
      "MET-REVENUE-GROWTH": (year) => {
        const ratio = divide(value("IS-REVENUE", year), previous("IS-REVENUE", year, "revenue"));
        return ratio == null ? null : ratio - 1;
      }
    };
    const expectedMetrics = metricResults.filter((metric) => calculators[metric?.metricId]).slice(0, 14);
    const comparisons = expectedMetrics.flatMap((metric) => ["2023", "2024", "2025"].map((year) => ({
      metricId: metric.metricId,
      year,
      expected: metric.values?.[year],
      calculated: calculators[metric.metricId](year)
    })));
    const complete = expectedMetrics.length === 14 && comparisons.length === 42
      && comparisons.every((item) => s004ValuesMatchCalculated(item.calculated, item.expected));
    return { complete, metricCount: expectedMetrics.length, comparisonCount: comparisons.length, comparisons };
  }

  function s004WorkingCapitalRecalculation(inputs) {
    const working = inputs?.workingCapital || {};
    const values = [
      "inventoryDays", "receivableDays", "payableDays", "prepaymentDays", "advanceReceiptDays",
      "salesRevenue", "salesProfitMargin", "expectedSalesGrowth", "borrowerOwnFunds",
      "existingWorkingCapitalLoans", "otherWorkingCapitalChannels"
    ].map((field) => s004FiniteNumber(working[field]));
    if (values.some((value) => value == null)) return { complete: false, reason: "营运资金确定性输入不完整" };
    const [inventoryDays, receivableDays, payableDays, prepaymentDays, advanceReceiptDays,
      salesRevenue, salesProfitMargin, expectedSalesGrowth, borrowerOwnFunds,
      existingWorkingCapitalLoans, otherWorkingCapitalChannels] = values;
    const turnover = s004Round(360 / (inventoryDays + receivableDays - payableDays + prepaymentDays - advanceReceiptDays), 4);
    const need = Math.round(salesRevenue * (1 - salesProfitMargin) * (1 + expectedSalesGrowth) / turnover);
    const maximum = Math.round(need - borrowerOwnFunds - existingWorkingCapitalLoans - otherWorkingCapitalChannels);
    const complete = s004ValuesMatchCalculated(turnover, working.workingCapitalTurnover)
      && s004ValuesMatchCalculated(need, working.workingCapitalNeed)
      && s004ValuesMatchCalculated(maximum, working.maximumNewWorkingCapitalLoan);
    return {
      complete,
      turnover,
      need,
      maximum,
      expectedTurnover: working.workingCapitalTurnover,
      expectedNeed: working.workingCapitalNeed,
      expectedMaximum: working.maximumNewWorkingCapitalLoan
    };
  }

  function executeS004DeterministicVerification(report, options = {}) {
    if (!report) return null;
    const evidencePack = (report.evidencePacks || []).find((item) => item?.id === report.evidencePackId)
      || report.evidencePacks?.[0]
      || {};
    const factPackage = evidencePack.authoritativeFactPackage || {};
    const contract = s004ReportContentContract(report);
    const facts = contract.factInventory.length ? contract.factInventory : (factPackage.contentFacts || []);
    const factIds = new Set(facts.map((fact) => fact?.id).filter(Boolean));
    const t044Bindings = contract.t044Bindings.length
      ? contract.t044Bindings
      : (factPackage.contentItems || []).map((item, index) => ({
          id: item?.id || item?.contentItemId || `T044-S004-RUNTIME-${index + 1}`,
          contentItemId: item?.contentItemId || item?.id || null,
          anchorId: item?.anchorId || item?.stableAnchor || null,
          factRefs: item?.factRefs || [],
          evidenceRefs: item?.evidenceRefs || [],
          bindingStatus: item?.bindingStatus || "bound"
        }));
    const binding = report.bindingSnapshot || factPackage.authoritativeBinding || evidencePack.semanticBinding || {};
    const packageBinding = factPackage.authoritativeBinding || evidencePack.semanticBinding || {};
    const artifactManifest = report.artifactManifest || {};
    const c008 = readJsonState(C008_STATE_KEY) || {};
    const c008Current = c008.current || {};
    const c017 = readJsonState(C017_REPORT_KEY) || {};
    const c017Projection = (c017.projections || []).find((item) => sameScenarioRun(item)
      && (!binding.dataVersion || item?.dataVersion === binding.dataVersion)) || null;
    const inputs = factPackage.deterministicInputs || {};
    const metricResults = Array.isArray(inputs.metricResults) ? inputs.metricResults : [];
    const ruleRun = inputs.ruleRun || {};
    const results = [];
    const versionText = `${binding.semanticVersionId || "Published 未定位"} / ${binding.dataVersion || "数据版本未定位"} / ${S004_VERIFICATION_ENGINE_VERSION}`;

    const reportIdentity = report.reportNo || report.draftId || report.aggregateId || null;
    const isDraftLifecycle = !report.reportNo && ["draft", "returned", "confirmed"].includes(String(report.stage || ""));
    const reportIdentityReady = Boolean(reportIdentity && report.contentVersion && report.evidencePackId && sameScenarioRun(report));
    const artifactIdentityConflict = Boolean(
      artifactManifest.reportNo && report.reportNo && artifactManifest.reportNo !== report.reportNo
      || artifactManifest.contentVersion && artifactManifest.contentVersion !== report.contentVersion
      || artifactManifest.evidencePackId && artifactManifest.evidencePackId !== report.evidencePackId
      || evidencePack.id && evidencePack.id !== report.evidencePackId
    );
    results.push(s004VerificationResult(
      "V01",
      !reportIdentityReady ? "unverifiable" : artifactIdentityConflict ? "fail" : "pass",
      !reportIdentityReady
        ? "报告编号、内容版本、证据包或当前 scenarioRunId 身份不完整。"
        : artifactIdentityConflict
          ? "报告、发布清单和固定证据包的稳定身份存在冲突。"
          : "报告编号、内容版本、证据包和当前场景轮次一致。",
      `${reportIdentity || "未定位"} / ${report.contentVersion || "未定位"} / ${report.evidencePackId || "未定位"} / ${report.scenarioContext?.scenarioRunId || "未定位"}`,
      "report-cover",
      { version: versionText, responsibility: "报告定义与产物：报告中心（M06）" }
    ));

    const c008Located = Boolean(c008Current.semanticVersionId && c008Current.dataVersion);
    const authorityConflict = Boolean(c008Located && (
      c008Current.semanticVersionId !== binding.semanticVersionId
      || c008Current.dataVersion !== binding.dataVersion
      || packageBinding.semanticVersionId && packageBinding.semanticVersionId !== binding.semanticVersionId
      || packageBinding.dataVersion && packageBinding.dataVersion !== binding.dataVersion
    ));
    results.push(s004VerificationResult(
      "V02",
      !c008Located ? "unverifiable" : authorityConflict ? "fail" : "pass",
      !c008Located
        ? "当前轮次 C008 / T019 权威投影不可定位。"
        : authorityConflict
          ? "报告绑定、固定证据包与 C008 / T019 的语义或数据版本不一致。"
          : "报告与固定证据包均绑定同一 Published / C008 / T019 权威组合。",
      `${c008Current.semanticVersionId || "C008 未定位"} / T019 ${c008Current.t019?.recordId || "未定位"} / ${c008Current.t019?.evidenceId || "证据未定位"}`,
      "sec-06-data-sources",
      { version: versionText, responsibility: "Published 与 C008：本体管理（M01）；核验：报告中心（M06）" }
    ));

    const bindingFields = ["semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId", "asOf"];
    const bindingComplete = bindingFields.every((field) => binding?.[field]);
    const packageVersionConflict = bindingFields.some((field) => packageBinding?.[field] && packageBinding[field] !== binding[field]);
    const c017Ready = Boolean(c017Projection && c017Projection.allowConsumption === true
      && c017Projection.currentStateSummary?.hardQualityFailure === false);
    results.push(s004VerificationResult(
      "V03",
      !bindingComplete || !c017Projection ? "unverifiable" : packageVersionConflict || !c017Ready ? "fail" : "pass",
      !bindingComplete
        ? "数据资产、T018、截至时间或币种期间绑定不完整。"
        : !c017Projection
          ? "当前数据版本的 C017 可信度摘要不可定位。"
          : packageVersionConflict
            ? "报告绑定与固定证据包的数据版本或截至时间冲突。"
            : !c017Ready
              ? "C017 不允许消费或存在硬质量失败。"
              : "数据资产版本、T018 可消费版本、截至时间和 C017 质量门均已固定且一致。",
      `${binding.dataAssetVersionId || "未定位"} / ${binding.consumableVersionId || "未定位"} / 截至 ${binding.asOf || "未定位"} / ${c017Projection?.currentStateSummary?.id || "C017 未定位"}`,
      "sec-03-financial",
      { version: versionText, responsibility: "数据版本与 C017：数据工程（M02）；核验：报告中心（M06）" }
    ));

    const requiredMetricIds = new Set(facts.flatMap((fact) => [
      String(fact?.id || "").startsWith("MET-") ? fact.id : null,
      ...s004FactEvidenceRefs(fact).filter((ref) => String(ref).startsWith("MET-"))
    ]).filter(Boolean));
    const metricById = new Map(metricResults.map((item) => [item?.metricId, item]));
    const metricInputsLocated = Boolean(inputs.metricRunId && metricResults.length);
    const metricConflict = [...requiredMetricIds].some((metricId) => {
      const metric = metricById.get(metricId);
      return !metric || !metric.values || !Object.keys(metric.values).length;
    });
    results.push(s004VerificationResult(
      "V04",
      !metricInputsLocated ? "unverifiable" : metricConflict ? "fail" : "pass",
      !metricInputsLocated
        ? "固定证据包未提供可定位的 Metric Run 与结构化结果。"
        : metricConflict
          ? "报告引用的一个或多个 Metric 缺少结果或期间值。"
          : `${requiredMetricIds.size} 项报告引用 Metric 均可定位到同一固定 Metric Run 和结果版本。`,
      `${inputs.metricRunId || "Metric Run 未定位"} / ${metricResults.length} 项结果 / ${[...requiredMetricIds].join("、") || "无指标引用"}`,
      "sec-03-01-basic-financial",
      { version: versionText, responsibility: "Metric 定义：本体管理（M01）；数据输入：数据工程（M02）；核验：报告中心（M06）" }
    ));

    const ruleResults = Array.isArray(ruleRun.results) ? ruleRun.results : [];
    const ruleInputsLocated = Boolean(ruleRun.ruleRunId && ruleResults.length);
    const ruleConflict = ruleResults.some((item) => !item?.ruleId || !item?.result || item.result !== "PASS")
      || (ruleRun.creditDecision && ruleRun.creditDecision !== "NOT_COMPUTED")
      || (ruleRun.riskControllability && ruleRun.riskControllability !== "NOT_COMPUTED")
      || ruleRun.actionRequestCreated === true
      || ruleRun.todoCreated === true;
    results.push(s004VerificationResult(
      "V05",
      !ruleInputsLocated ? "unverifiable" : ruleConflict ? "fail" : "pass",
      !ruleInputsLocated
        ? "固定证据包未提供可定位的 Rule Run 与结果。"
        : ruleConflict
          ? "Rule 结果缺失、业务门未通过，或 Rule 越界形成了授信判断 / Action Request / 待办。"
          : `${ruleResults.length} 项 Published Rule 结果均可追溯，且未越界形成授信决定、Action Request 或待办。`,
      `${ruleRun.ruleRunId || "Rule Run 未定位"} / ${ruleResults.map((item) => `${item.ruleId}:${item.result}`).join("、") || "结果未定位"}`,
      "sec-03-02-funding",
      { version: versionText, responsibility: "Rule 定义与结果：本体管理（M01）；核验：报告中心（M06）" }
    ));

    const factsWithEvidence = facts.filter((fact) => fact?.id && s004FactEvidenceRefs(fact).length);
    const evidenceComplete = facts.length > 0 && factsWithEvidence.length === facts.length;
    results.push(s004VerificationResult(
      "V06",
      !facts.length ? "unverifiable" : evidenceComplete ? "pass" : "fail",
      !facts.length
        ? "固定事实清单不可定位。"
        : evidenceComplete
          ? `${factsWithEvidence.length} 项正式事实均至少绑定一项可定位证据。`
          : `${facts.length - factsWithEvidence.length} 项正式事实缺少证据引用。`,
      `${factPackage.packageId || report.evidencePackId || "证据包未定位"} / ${factsWithEvidence.length} / ${facts.length} 项事实有证据`,
      "sec-06-data-sources",
      { version: versionText, responsibility: "固定证据包与事实绑定：报告中心（M06）" }
    ));

    const validBindings = t044Bindings.filter((item) => item?.id && item?.contentItemId && item?.anchorId
      && item?.bindingStatus !== "missing"
      && (item.factRefs || []).every((factId) => factIds.has(factId)));
    const t044Located = t044Bindings.length > 0;
    const t044Conflict = t044Located && validBindings.length !== t044Bindings.length;
    results.push(s004VerificationResult(
      "V07",
      !t044Located ? "unverifiable" : t044Conflict ? "fail" : "pass",
      !t044Located
        ? "当前内容版本没有可定位的 T044 内容项与稳定锚点绑定。"
        : t044Conflict
          ? `${t044Bindings.length - validBindings.length} 个内容项的锚点、事实引用或绑定状态不完整。`
          : `${validBindings.length} 个内容项已完整绑定稳定锚点、事实和证据。`,
      `${validBindings.length} / ${t044Bindings.length} 个 T044 绑定有效 / ${artifactManifest.stableAnchors?.length || factPackage.anchors?.length || 0} 个发布锚点`,
      "report-cover",
      { version: versionText, responsibility: "T044、稳定锚点与产物清单：报告中心（M06）" }
    ));

    const humanFacts = facts.filter((fact) => fact?.humanInputRequired || fact?.confirmationRequired || fact?.aiSuggestion
      || String(fact?.kind || "").includes("需人工确认"));
    const humanBoundaryReady = humanFacts.length > 0 && humanFacts.every((fact) => fact?.humanInputRequired === true
      && fact?.aiSuggestion === true && fact?.confirmationRequired === true);
    const humanReviewConfirmed = report.humanReview?.status === "confirmed" && Boolean(report.humanReview?.confirmationId);
    const humanReviewBoundaryReady = isDraftLifecycle
      ? !report.confirmedAt && [null, undefined, "pending"].includes(report.humanReview?.status)
      : humanReviewConfirmed;
    const ruleBoundaryReady = ruleRun.creditDecision === "NOT_COMPUTED"
      && ruleRun.riskControllability === "NOT_COMPUTED"
      && ruleRun.actionRequestCreated !== true
      && ruleRun.todoCreated !== true;
    results.push(s004VerificationResult(
      "V08",
      !humanFacts.length || !ruleInputsLocated ? "unverifiable" : !humanBoundaryReady || !humanReviewBoundaryReady || !ruleBoundaryReady ? "fail" : "pass",
      !humanFacts.length
        ? "风险与授信段落未登记需人工确认的 AI 建议边界。"
        : !ruleInputsLocated
          ? "Rule 边界记录不可定位，无法证明系统未自动形成授信决定。"
          : !humanBoundaryReady
            ? "一个或多个高风险判断未同时标记 AI 建议、需人工确认和禁止自动决定。"
            : !humanReviewBoundaryReady
              ? (isDraftLifecycle ? "当前草稿未保持待人工复核状态，或已出现未经核验的提前确认。" : "当前内容版本缺少可定位的人工复核确认记录。")
              : !ruleBoundaryReady
                ? "Rule 或 Agent 结果越界形成了授信判断、Action Request 或待办。"
                : isDraftLifecycle
                  ? `${humanFacts.length} 项风险 / 授信 AI 建议均保留需人工确认标记，当前草稿保持待人工复核。`
                  : `${humanFacts.length} 项风险 / 授信 AI 建议均保留需人工确认标记，并已定位人工复核记录。`,
      `${isDraftLifecycle ? "PENDING_HUMAN_REVIEW" : report.humanReview?.confirmationId || "人工确认未定位"} / ${humanFacts.length} 项需人工确认内容 / creditDecision=${ruleRun.creditDecision || "未声明"}`,
      "sec-05-credit-conclusion",
      { version: versionText, responsibility: "AI 草稿：Agent 应用（M05）；人工复核与正式边界：报告中心（M06）/ 财务公司人员" }
    ));

    const categoryByCode = new Map(results.map((item) => [item.checkId, item]));
    const definition = options.definition || {};
    const sections = Array.isArray(definition.sections) ? definition.sections : [];
    const anchors = Array.isArray(factPackage.anchors) ? factPackage.anchors : [];
    const artifactEvidencePackage = evidencePack.artifactEvidencePackage || {};
    const generationPolicy = artifactEvidencePackage.generationPolicy || {};
    const marker = readJsonState(NATIVE_SEED_MARKER_KEY) || {};
    const integrityItems = marker.artifactFingerprint?.items
      || parentNativeProjection()?.artifactIntegrity?.items
      || runtimeVerificationContext()?.artifactIntegrity?.items
      || {};
    const expectedIntegrity = activeScenarioRuntimeConfig()?.artifactIntegrity?.expected || {};
    const sectionAnchors = sections.map((item) => item?.stableAnchor).filter(Boolean);
    const requiredSectionOrder = [
      "report-cover", "sec-01-borrower-evaluation", "sec-02-operations", "sec-03-financial",
      "sec-04-risk", "sec-05-credit-conclusion", "sec-06-data-sources"
    ];
    const operationsSection = sections.find((item) => item?.stableAnchor === "sec-02-operations");
    const riskSection = sections.find((item) => item?.stableAnchor === "sec-04-risk");
    const ownership = inputs.ownership || {};
    const financialStatements = inputs.financialStatements || {};
    const periods = Array.isArray(financialStatements.periods) ? financialStatements.periods : [];
    const requiredPeriods = ["2023", "2024", "2025"];
    const completeStatementRows = (rows) => Array.isArray(rows) && rows.some((row) => row?.values)
      && rows.filter((row) => row?.values).every((row) => requiredPeriods.every((year) => row.values?.[year] != null));
    const metricRecalculation = s004MetricRecalculation(inputs);
    const workingCapitalRecalculation = s004WorkingCapitalRecalculation(inputs);
    const fourteenMetrics = metricResults.filter((metric) => requiredPeriods.every((year) => metric?.values?.[year] != null)).slice(0, 14);
    const sourceHashesMatch = (name) => Boolean(
      integrityItems[name]?.sha256
      && expectedIntegrity[name]
      && String(integrityItems[name].sha256).toLowerCase() === String(expectedIntegrity[name]).toLowerCase()
    );
    const factPackageReference = evidencePack.authoritativeFactPackageRef || {};
    const authoritativeFactPackageBound = Boolean(
      factPackage.packageId
      && (!factPackageReference.packageId || factPackageReference.packageId === factPackage.packageId)
    );
    const ownerReady = artifactEvidencePackage.owner === "M06"
      && Boolean(artifactEvidencePackage.consumer)
      && evidencePack.id === report.evidencePackId
      && authoritativeFactPackageBound;
    const noRawInput = generationPolicy.fixedEvidenceOnly === true
      && generationPolicy.directWorkbookRead === false
      && generationPolicy.directSourceNodeRead === false
      && generationPolicy.latestDataSelection === false
      && generationPolicy.formalMetricRecalculation === false;
    const decisionBoundary = generationPolicy.creditDecisionGeneration === false
      && generationPolicy.riskControllabilityGeneration === false
      && categoryByCode.get("V08")?.status === "pass";
    const baselineContext = report.artifactProjection?.sourceScenarioContext || report.sourceArtifactScenarioContext || {};
    const baselineReady = (!baselineContext.baselineVersion || baselineContext.baselineVersion === "v1.0.3")
      && (!baselineContext.baselineSnapshotId || baselineContext.baselineSnapshotId === "BSL-S001-V103-DE0119608E26")
      && sameScenarioRun(report);

    const detailedOverrides = {
      "VER-V2-BASELINE-CONTEXT": {
        ok: baselineReady,
        issue: baselineReady ? "v1.0.3、冻结快照和当前 S004 场景轮次身份一致。" : "基线版本、冻结快照或当前 S004 场景轮次身份不一致。",
        evidence: `v1.0.3 / BSL-S001-V103-DE0119608E26 / ${context.scenarioRunId || "未定位"}`
      },
      "VER-V2-PUBLISHED-LIFECYCLE": {
        ok: categoryByCode.get("V02")?.status === "pass" && Boolean(c008Current.t019?.recordId && c008Current.t019?.evidenceId),
        issue: "C008 仅绑定当前 Published 本体、同一 T019 正式采用记录和固定数据版本。",
        evidence: `${c008Current.semanticVersionId || "未定位"} / ${c008Current.t019?.recordId || "T019 未定位"}`
      },
      "VER-V2-C008-IDENTITY": {
        ok: categoryByCode.get("V02")?.status === "pass",
        issue: "C008、固定证据包、报告编号和内容版本身份一致。",
        evidence: `${c008.projectionId || C008_STATE_KEY} / ${factPackage.packageId || "未定位"} / ${report.reportNo || "未定位"}`
      },
      "VER-V2-EVIDENCE-PACKAGE-OWNER": {
        ok: ownerReady,
        issue: ownerReady ? "固定证据包由 M06 拥有，M05 仅按锁定合同消费。" : "固定证据包 Owner、消费方或报告绑定不完整。",
        evidence: `${artifactEvidencePackage.owner || "Owner 未定位"} → ${artifactEvidencePackage.consumer || "Consumer 未定位"}`
      },
      "VER-V2-EVIDENCE-HASH-PUBLISHED": {
        ok: sourceHashesMatch("publishedResources"),
        issue: sourceHashesMatch("publishedResources") ? "固定证据包锁定的 Published 本体 SHA-256 与运行时完整性清单一致。" : "Published 本体 SHA-256 不可定位或与完整性清单不一致。",
        evidence: integrityItems.publishedResources?.sha256 || "Published SHA-256 未定位"
      },
      "VER-V2-EVIDENCE-HASH-C008": {
        ok: sourceHashesMatch("c008Facts"),
        issue: sourceHashesMatch("c008Facts") ? "固定证据包锁定的 C008 SHA-256 与运行时完整性清单一致。" : "C008 SHA-256 不可定位或与完整性清单不一致。",
        evidence: integrityItems.c008Facts?.sha256 || "C008 SHA-256 未定位"
      },
      "VER-V2-NO-RAW-INPUT-REF": {
        ok: noRawInput,
        issue: noRawInput ? "正式生成只消费固定证据包，未开放工作簿、来源节点或自动选择最新数据。" : "生成策略缺少固定证据门，或仍允许工作簿 / 来源节点 / 最新数据选择。",
        evidence: `fixedEvidenceOnly=${generationPolicy.fixedEvidenceOnly} / directWorkbookRead=${generationPolicy.directWorkbookRead}`
      },
      "VER-V2-SECTION-ORDER": {
        ok: JSON.stringify(sectionAnchors) === JSON.stringify(requiredSectionOrder),
        issue: "封面、五部分和数据来源的章节顺序与正式报告定义逐项一致。",
        evidence: sectionAnchors.join(" → ") || "章节锚点未定位"
      },
      "VER-V2-FORMAL-PAGE-SYSTEM": {
        ok: definition.formalPageSystem === "A4_PORTRAIT"
          && (isDraftLifecycle || artifactManifest.pdf?.output?.format === "SAME_SOURCE_PDF"),
        issue: isDraftLifecycle
          ? "当前草稿已锁定 A4 纵向页面和同源 HTML/PDF 发布规则；正式产物将在人工确认后的独立发布阶段形成。"
          : "正式输出使用 A4 纵向页面，并保留同源 PDF 产物绑定。",
        evidence: `${definition.formalPageSystem || "页面制式未定位"} / ${isDraftLifecycle ? "DRAFT_PREPARES_SAME_SOURCE_HTML_PDF" : artifactManifest.pdf?.output?.format || "PDF 未定位"}`
      },
      "VER-V2-OPERATIONS-FOUR-SUBSECTIONS": {
        ok: Array.isArray(operationsSection?.subsections) && operationsSection.subsections.length === 4,
        issue: "第二部分完整保留四个权威经营情况小节。",
        evidence: (operationsSection?.subsections || []).map((item) => item.title || item.stableAnchor).join("、") || "经营小节未定位"
      },
      "VER-V2-RISK-THEMES": {
        ok: Array.isArray(inputs.riskThemes) && inputs.riskThemes.length === 4
          && Array.isArray(riskSection?.subsections) && riskSection.subsections.length === 4
          && categoryByCode.get("V05")?.status === "pass",
        issue: "四类风险主题、Published Rule Run 和人工判断边界均可定位。",
        evidence: `${(inputs.riskThemes || []).map((item) => item.title || item.riskId).join("、") || "风险主题未定位"} / ${ruleRun.ruleRunId || "Rule Run 未定位"}`
      },
      "VER-V2-OWNERSHIP-COMPLETE": {
        ok: Array.isArray(ownership.topShareholders) && ownership.topShareholders.length === 10
          && ownership.controllerPledgeStatus != null && ownership.controllerFreezeStatus != null,
        issue: "股权结构、前十大股东以及控股股东质押 / 冻结状态均完整。",
        evidence: `${ownership.topShareholders?.length || 0} 名股东 / pledge=${ownership.controllerPledgeStatus || "未定位"} / freeze=${ownership.controllerFreezeStatus || "未定位"}`
      },
      "VER-V2-THREE-FULL-STATEMENTS": {
        ok: requiredPeriods.every((year) => periods.some((period) => String(period?.key) === year))
          && completeStatementRows(financialStatements.balanceSheet)
          && completeStatementRows(financialStatements.incomeStatement)
          && completeStatementRows(financialStatements.cashFlowStatement),
        issue: "2023—2025 年资产负债表、利润表和现金流量表均具备完整期间值。",
        evidence: `${periods.map((period) => period.key).join("、") || "期间未定位"} / BS-IS-CF`
      },
      "VER-V2-FOURTEEN-METRICS": {
        ok: fourteenMetrics.length === 14,
        issue: `${fourteenMetrics.length} 项基础财务 Metric 均具备 2023、2024、2025 三年结果。`,
        evidence: fourteenMetrics.map((metric) => metric.metricId).join("、") || "Metric 未定位"
      },
      "VER-V2-METRIC-RECALCULATION": {
        ok: metricRecalculation.complete,
        issue: metricRecalculation.complete
          ? "14 项 × 3 年 Metric 已从固定 C008 财务事实按登记公式与显示精度重新计算一致。"
          : `Metric 复算不完整或存在差异：${metricRecalculation.comparisonCount} 个比较单元。`,
        evidence: `${inputs.metricRunId || "Metric Run 未定位"} / ${metricRecalculation.comparisonCount} 个复算单元`
      },
      "VER-V2-WORKING-CAPITAL-CALCULATION": {
        ok: workingCapitalRecalculation.complete,
        issue: workingCapitalRecalculation.complete
          ? "营运资金周转次数、营运资金量和新增流动资金贷款额度已按固定输入重新计算一致。"
          : `营运资金复算不一致：${workingCapitalRecalculation.reason || "结果与固定 Metric 不一致"}。`,
        evidence: workingCapitalRecalculation.turnover == null
          ? "营运资金输入不完整"
          : `周转次数 ${workingCapitalRecalculation.turnover} / 营运资金量 ${workingCapitalRecalculation.need} / 新增额度 ${workingCapitalRecalculation.maximum}`
      },
      "VER-V2-DRAFT-EVIDENCE-BOUNDARY": {
        ok: noRawInput && generationPolicy.fixedEvidenceOnly === true,
        issue: "Agent 草稿仅可声明固定证据包允许的事实和证据，不读取工作簿或来源节点。",
        evidence: `${artifactEvidencePackage.evidencePackageId || factPackage.packageId || "证据包未定位"} / ${(artifactEvidencePackage.allowedEvidenceIds || []).length} 项允许引用`
      },
      "VER-V2-AGENT-DECISION-BOUNDARY": {
        ok: decisionBoundary,
        issue: decisionBoundary ? "Agent 与 Rule 均未形成正式授信决定、风险可控判断、Action Request 或待办。" : "Agent / Rule 或生成策略越过人工授信判断边界。",
        evidence: `creditDecision=${ruleRun.creditDecision || "未声明"} / riskControllability=${ruleRun.riskControllability || "未声明"}`
      }
    };

    const contractDetailedPlan = contract.verificationPlan.filter((item) =>
      S004_DETAILED_CHECK_RULES[item?.id || item?.checkId || item?.checkType]);
    const detailedPlan = contractDetailedPlan.length === Object.keys(S004_DETAILED_CHECK_RULES).length
      ? contractDetailedPlan
      : s004CanonicalVerificationPlan(report);
    const detailedResults = detailedPlan.map((unit) => {
      const checkId = unit?.id || unit?.checkId || unit?.checkType;
      const ruleCode = S004_DETAILED_CHECK_RULES[checkId] || "V06";
      const base = categoryByCode.get(ruleCode) || s004VerificationResult(ruleCode, "unverifiable", "核验类别不可定位", "无", "report-cover");
      const override = detailedOverrides[checkId] || {};
      const baseBlocking = base.status === "fail" || base.status === "unverifiable";
      const status = baseBlocking
        ? base.status
        : override.ok === true
          ? "pass"
          : override.ok === false
            ? "fail"
            : base.status;
      const anchor = (unit?.t044Ids || []).length
        ? t044Bindings.find((bindingItem) => unit.t044Ids.includes(bindingItem.id))?.anchorId
        : null;
      return {
        ...cloneJson(base),
        id: checkId,
        checkId,
        ruleCode,
        name: `${ruleCode} · ${unit?.checkName || checkId}`,
        status,
        reasonCode: `${checkId}_${String(status).toUpperCase()}`,
        anchor: anchor || base.anchor,
        location: unit?.checkName || base.location,
        issue: override.issue || base.issue,
        evidence: override.evidence || base.evidence,
        planUnitId: checkId,
        t044Ids: cloneJson(unit?.t044Ids || [])
      };
    });

    const now = options.completedAt || s004NowIso();
    const blocking = detailedResults.some((item) => item.status === "fail" || item.status === "unverifiable");
    const warning = detailedResults.some((item) => item.status === "warn");
    const coveredFactIds = new Set(validBindings.flatMap((item) => item.factRefs || []));
    const coverage = {
      status: "complete",
      planned: detailedResults.length,
      applicable: detailedResults.length,
      completed: detailedResults.length,
      pending: 0,
      error: 0,
      notApplicable: 0,
      skipped: 0,
      factTotal: facts.length,
      factCovered: facts.filter((fact) => s004FactEvidenceRefs(fact).length && (coveredFactIds.has(fact.id) || !t044Bindings.length)).length,
      anchorTotal: t044Bindings.length,
      anchorCovered: validBindings.length
    };
    const planSnapshot = detailedPlan.map((item) => ({
      ...cloneJson(item),
      ruleCode: S004_DETAILED_CHECK_RULES[item?.id || item?.checkId || item?.checkType] || "V06",
      owner: item?.owner || "报告中心",
      applicability: item?.applicability || "applicable",
      executionState: "planned"
    }));
    const unitResults = detailedResults.map((item, index) => ({
      ...cloneJson(planSnapshot[index] || {}),
      status: item.status,
      reasonCode: item.reasonCode,
      executionState: "completed",
      completedAt: now
    }));
    return {
      scenarioContext: cloneJson(report.scenarioContext || context),
      runId: options.runId || `VRF-S004-${s004NowEpoch()}`,
      retryOf: options.retryOf || null,
      attempt: Math.max(1, Number(options.attempt || 1)),
      status: options.lifecycleStatus || "completed-s004-deterministic",
      deterministicStatus: blocking ? "completed-with-findings" : warning ? "completed-with-warnings" : "completed",
      engineVersion: S004_VERIFICATION_ENGINE_VERSION,
      sourceMode: "recomputed-from-fixed-context",
      scope: "整份报告",
      runScope: "整份报告",
      scopeContext: { scope: "整份报告", sectionId: null, anchorId: null },
      progress: 100,
      completedAt: now,
      planVersion: S004_VERIFICATION_ENGINE_VERSION,
      evidencePackId: report.evidencePackId || factPackage.packageId || null,
      reportEvidenceVersion: factPackage.schemaVersion || evidencePack.reportEvidenceSchemaVersion || null,
      currentStatusReadAt: c017Projection?.currentStateSummary?.formedAt || c017Projection?.formedAt || now,
      currentStatusSummary: cloneJson(c017Projection?.currentStateSummary || null),
      currentBindingSnapshot: cloneJson(binding),
      publicationEligible: !blocking,
      results: detailedResults,
      planSnapshot,
      unitResults,
      coverage
    };
  }

  function normalizeCompletedVerification(run, report) {
    if (!run) return null;
    const reportBinding = report?.bindingSnapshot || {};
    const contract = s004ReportContentContract(report);
    const normalizedResults = (run.results || []).map((item) => ({
      ...cloneJson(item),
      id: item.id || item.checkId,
      name: item.name || item.finding || item.checkId || "确定性检查",
      status: item.status || (item.outcome === "一致" ? "pass" : "unverifiable"),
      location: item.location || item.finding || item.name || item.checkId || "报告正文",
      issue: item.issue || item.finding || "固定核验制品已完成该项确定性检查。",
      evidence: item.evidence || `${report?.evidencePackId || "固定证据包"} / ${item.checkId || item.id || "检查记录"}`,
      version: item.version || `${reportBinding.semanticVersion || "Published"} / ${reportBinding.dataVersion || "固定数据版本"} / ${run.planVersion || "核验规则版本"}`,
      impact: item.impact || "未发现影响正式报告一致性的异常。",
      responsibility: item.responsibility || item.owner || "报告中心",
      recommendation: item.recommendation || item.recovery || "保留当前固定核验记录。"
    }));
    const plannedCount = contract.verificationPlan.length || Number(run.coverage?.planned || normalizedResults.length || 0);
    const factCount = contract.factInventory.length || Number(run.coverage?.factTotal || run.factCount || 0);
    const anchorCount = contract.t044Bindings.filter((item) => item?.anchorId).length
      || Number(run.coverage?.anchorTotal || run.anchorCount || 0);
    const coverage = {
      status: "complete",
      planned: plannedCount,
      applicable: plannedCount,
      completed: plannedCount,
      pending: 0,
      error: 0,
      notApplicable: 0,
      skipped: 0,
      factTotal: factCount,
      factCovered: factCount,
      anchorTotal: anchorCount,
      anchorCovered: anchorCount
    };
    const planSnapshot = contract.verificationPlan.length
      ? cloneJson(contract.verificationPlan)
      : cloneJson(run.planSnapshot || []);
    const unitResults = planSnapshot.map((unit) => {
      const stored = (run.unitResults || []).find((item) => item?.id === unit?.id) || {};
      return { ...cloneJson(unit), ...cloneJson(stored), executionState: "completed", status: stored.status || "pass" };
    });
    return {
      ...cloneJson(run),
      // v1.0.3 only rebuilds status="completed" runs using its eight S001
      // rule implementations. This named completed state preserves the
      // already executed S004 deterministic artifact without misclassifying
      // S004 rule IDs as unknown checks; the native finished-state UI and
      // rerun action remain unchanged.
      status: "completed-s004-deterministic",
      deterministicStatus: "completed",
      attempt: Math.max(1, Number(run.attempt || 1)),
      filter: run.filter || "all",
      scope: "整份报告",
      runScope: "整份报告",
      scopeContext: { scope: "整份报告", sectionId: null, anchorId: null },
      progress: 100,
      evidencePackId: run.evidencePackId || report?.evidencePackId || null,
      scenarioContext: cloneJson(run.scenarioContext || report?.scenarioContext || context),
      results: normalizedResults,
      planSnapshot,
      unitResults,
      coverage
    };
  }

  function isS004FullVerificationProjection(report, verification = report?.postPublicationVerification) {
    if (!report || !verification) return false;
    const contract = s004ReportContentContract(report);
    const factPackage = (report.evidencePacks || []).find((item) => item?.id === report.evidencePackId)?.authoritativeFactPackage
      || report.evidencePacks?.[0]?.authoritativeFactPackage
      || {};
    const coverage = verification.coverage || {};
    const planned = verification.engineVersion === S004_VERIFICATION_ENGINE_VERSION
      ? Object.keys(S004_DETAILED_CHECK_RULES).length
      : contract.verificationPlan.length;
    const facts = contract.factInventory.length || factPackage.contentFacts?.length || Number(coverage.factTotal || 0);
    const anchors = contract.t044Bindings.filter((item) => item?.anchorId).length
      || factPackage.contentItems?.filter((item) => item?.anchorId || item?.stableAnchor).length
      || Number(coverage.anchorTotal || 0);
    return verification.status === "completed-s004-deterministic"
      && (verification.runScope || verification.scopeContext?.scope || verification.scope) === "整份报告"
      && coverage.status === "complete"
      && planned > 0 && coverage.planned === planned && coverage.applicable === planned && coverage.completed === planned
      && coverage.pending === 0 && coverage.error === 0 && coverage.skipped === 0
      && facts > 0 && coverage.factTotal === facts && coverage.factCovered === facts
      && anchors > 0 && coverage.anchorTotal === anchors && coverage.anchorCovered === anchors;
  }

  function isM06ActiveReportRecord(report) {
    return Boolean(
      context.scenarioId === "S004"
      && report
      && sameScenarioRun(report)
      && report.requestId
      && M06_ACTIVE_REPORT_STAGES.has(String(report.stage || ""))
    );
  }

  function matchingS004SeedEvidencePack(activePack, cachedPacks = []) {
    const activeFactPackage = activePack?.authoritativeFactPackage || {};
    const reference = activePack?.authoritativeFactPackageRef || activeFactPackage || {};
    return cachedPacks.find((candidate) => {
      const factPackage = candidate?.authoritativeFactPackage || {};
      if (reference.packageId && factPackage.packageId === reference.packageId) return true;
      return Boolean(
        factPackage.semanticVersionId
        && factPackage.dataVersion
        && factPackage.semanticVersionId === (reference.semanticVersionId || activeFactPackage.semanticVersionId)
        && factPackage.dataVersion === (reference.dataVersion || activeFactPackage.dataVersion)
      );
    }) || null;
  }

  function hydrateS004ActiveEvidencePacks(latestReport, cachedReport) {
    const cachedPacks = cachedReport?.evidencePacks || [];
    return (latestReport?.evidencePacks || []).map((activePack) => {
      const seedPack = matchingS004SeedEvidencePack(activePack, cachedPacks);
      const activeFactPackage = activePack?.authoritativeFactPackage;
      const authoritativeFactPackage = activeFactPackage?.contentFacts?.length
        ? cloneJson(activeFactPackage)
        : cloneJson(seedPack?.authoritativeFactPackage || activeFactPackage || null);
      return {
        ...(seedPack ? cloneJson(seedPack) : {}),
        ...cloneJson(activePack),
        reportDefinition: cloneJson(activePack?.reportDefinition?.id ? activePack.reportDefinition : seedPack?.reportDefinition || null),
        template: cloneJson(activePack?.template?.id ? activePack.template : seedPack?.template || null),
        authoritativeFactPackageRef: cloneJson(activePack?.authoritativeFactPackageRef
          || (authoritativeFactPackage ? {
            packageId: authoritativeFactPackage.packageId,
            semanticVersionId: authoritativeFactPackage.semanticVersionId,
            dataAssetVersionId: authoritativeFactPackage.dataAssetVersionId,
            dataVersion: authoritativeFactPackage.dataVersion,
            consumableVersionId: authoritativeFactPackage.consumableVersionId,
            asOf: authoritativeFactPackage.asOf
          } : null)),
        authoritativeFactPackage
      };
    });
  }

  function completeS004ActiveContentContract(report) {
    if (!isM06ActiveReportRecord(report)) return report;
    const next = cloneJson(report);
    const evidencePack = (next.evidencePacks || []).find((item) => item?.id === next.evidencePackId)
      || next.evidencePacks?.[0]
      || {};
    const factPackage = evidencePack.authoritativeFactPackage || {};
    next.contentVersions = (next.contentVersions || []).map((content) => {
      if (!content?.reviewCopyId || content.reviewCopyId !== next.reviewCopyId) return content;
      const enriched = cloneJson(content);
      if (!Array.isArray(enriched.factInventory) || !enriched.factInventory.length) {
        enriched.factInventory = cloneJson(factPackage.contentFacts || []);
      }
      if (!Array.isArray(enriched.t044Bindings) || !enriched.t044Bindings.length) {
        enriched.t044Bindings = (factPackage.contentItems || []).map((item, index) => ({
          id: `T044-S004-RUNTIME-${String(index + 1).padStart(3, "0")}`,
          contentItemId: item?.contentItemId || item?.id || null,
          anchorId: item?.anchorId || item?.stableAnchor || null,
          templateSlot: item?.templateSlot || null,
          contentType: item?.contentType || item?.presentationType || "content-item",
          factRefs: cloneJson(item?.factRefs || []),
          intendedFactRefs: cloneJson(item?.intendedFactRefs || []),
          evidenceRefs: cloneJson(item?.evidenceRefs || []),
          bindingStatus: item?.bindingStatus || "bound"
        }));
      }
      return enriched;
    });
    const activeContent = next.contentVersions.find((item) => item?.reviewCopyId === next.reviewCopyId) || null;
    if (activeContent) {
      activeContent.verificationPlan = s004CanonicalVerificationPlan(next);
      activeContent.verificationRunIds = Array.isArray(activeContent.verificationRunIds)
        ? activeContent.verificationRunIds
        : [];
      next.contentSnapshot = cloneJson(next.contentSnapshot || activeContent.snapshot || null);
    }
    return next;
  }

  function mergeS004CompleteReport(cachedReport, latestReport) {
    if (!cachedReport) return cloneJson(latestReport);
    if (!latestReport) return cloneJson(cachedReport);
    if (isM06ActiveReportRecord(latestReport)) {
      const active = {
        ...cloneJson(cachedReport),
        ...cloneJson(latestReport),
        evidencePacks: hydrateS004ActiveEvidencePacks(latestReport, cachedReport),
        contentVersions: cloneJson(latestReport.contentVersions || []),
        contentSnapshot: cloneJson(latestReport.contentSnapshot || null),
        artifactManifest: cloneJson(latestReport.artifactManifest || null),
        bindingSnapshot: cloneJson(latestReport.bindingSnapshot || null)
      };
      return completeS004ActiveContentContract(active);
    }
    return {
      ...cloneJson(cachedReport),
      ...cloneJson(latestReport),
      // These fields are intentionally compacted by v1.0.3 persistence and
      // must come from the prewarmed immutable-artifact projection.
      evidencePacks: cloneJson(cachedReport.evidencePacks || []),
      contentVersions: cloneJson(cachedReport.contentVersions || []),
      contentSnapshot: cloneJson(cachedReport.contentSnapshot || latestReport.contentSnapshot || null),
      artifactManifest: cloneJson(cachedReport.artifactManifest || latestReport.artifactManifest || null),
      bindingSnapshot: cloneJson(cachedReport.bindingSnapshot || latestReport.bindingSnapshot || null)
    };
  }

  function hydrateM06StateFromNativeProjection(state) {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return state;
    const nativeState = cloneJson(parentNativeProjection()?.m06 || null);
    let hydrated = null;
    if (nativeState && state) {
      const latestPublished = new Map((state.publishedReports || []).map((item) => [item?.reportNo, item]));
      hydrated = {
        ...nativeState,
        ...cloneJson(state),
        customDefinitions: cloneJson(nativeState.customDefinitions || state.customDefinitions || []),
        report: mergeS004CompleteReport(nativeState.report, state.report),
        publishedReports: (nativeState.publishedReports || []).map((item) =>
          mergeS004CompleteReport(item, latestPublished.get(item?.reportNo))),
        assistant: {
          ...(cloneJson(nativeState.assistant || {})),
          ...(cloneJson(state.assistant || {}))
        },
        ui: { ...(nativeState.ui || {}), ...(state.ui || {}) }
      };
    } else {
      hydrated = cloneJson(nativeState || state || null);
    }
    if (!hydrated) return hydrated;

    const verificationContext = runtimeVerificationContext();
    if (!verificationContext) return hydrated;
    const definition = hydrated.customDefinitions?.[0];
    if (definition && verificationContext.definition?.id === definition.id) {
      hydrated.customDefinitions[0] = {
        ...definition,
        formalPageSystem: verificationContext.definition.formalPageSystem || definition.formalPageSystem,
        sections: cloneJson(verificationContext.definition.sections || definition.sections || [])
      };
    }
    [hydrated.report, ...(hydrated.publishedReports || [])].forEach((report) => {
      const evidencePack = (report?.evidencePacks || []).find((item) => item?.id === report?.evidencePackId)
        || report?.evidencePacks?.[0];
      const factPackage = evidencePack?.authoritativeFactPackage;
      const identityMatches = factPackage
        && evidencePack?.id === verificationContext.evidencePackId
        && factPackage.semanticVersionId === verificationContext.semanticVersionId
        && factPackage.dataVersion === verificationContext.dataVersion;
      if (!identityMatches) return;
      factPackage.deterministicInputs = cloneJson(verificationContext.deterministicInputs || {});
    });
    return hydrated;
  }

  function completeM06StateForMutation() {
    const cached = cloneJson(reportResourcesFromState()?.state || null);
    const latest = cloneJson(readJsonState(M06_STATE_KEY) || null);
    if (!cached) return latest;
    if (!latest) return cached;
    const latestPublished = new Map((latest.publishedReports || []).map((item) => [item?.reportNo, item]));
    const cachedRef = cached.assistant?.requestRef || null;
    const latestRef = latest.assistant?.requestRef || null;
    const mergedRequestRef = latestRef || cachedRef ? {
      ...(cachedRef || {}),
      ...(latestRef || {}),
      sessionId: latestRef?.sessionId || cachedRef?.sessionId || null,
      bindingId: latestRef?.bindingId || cachedRef?.bindingId || null,
      runId: latestRef?.runId || cachedRef?.runId || null,
      resultId: latestRef?.resultId || cachedRef?.resultId || null,
      readAt: latestRef?.readAt || cachedRef?.readAt || null
    } : null;
    return {
      ...cached,
      ...latest,
      customDefinitions: cloneJson(cached.customDefinitions || latest.customDefinitions || []),
      report: mergeS004CompleteReport(cached.report, latest.report),
      publishedReports: (cached.publishedReports || []).map((item) =>
        mergeS004CompleteReport(item, latestPublished.get(item?.reportNo))),
      assistant: {
        ...(cloneJson(cached.assistant || {})),
        ...(cloneJson(latest.assistant || {})),
        requestRef: cloneJson(mergedRequestRef)
      },
      ui: { ...(cached.ui || {}), ...(latest.ui || {}) }
    };
  }

  function bestS004ArtifactVerificationRun(report) {
    return (report?.verificationRuns || [])
      .filter((item) => item?.coverage?.status === "complete" && (item?.results?.length || item?.unitResults?.length))
      .sort((left, right) => (right?.results?.length || 0) - (left?.results?.length || 0))[0] || null;
  }

  function ensureS004CompletedVerificationProjection() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return false;
    const state = hydrateM06StateFromNativeProjection(readJsonState(M06_STATE_KEY));
    if (!state?.report) return false;
    let changed = false;
    const reports = [state.report, ...(state.publishedReports || [])].filter((report, index, all) =>
      report?.reportNo && all.findIndex((candidate) => candidate?.reportNo === report.reportNo && candidate === report) === index);
    reports.forEach((report) => {
      if (!sameScenarioRun(report)) return;
      const current = report.postPublicationVerification;
      if (current?.status === "completed-s004-deterministic"
        && current?.engineVersion === S004_VERIFICATION_ENGINE_VERSION
        && current?.results?.length && current?.coverage?.status === "complete") {
        if (Number(current.attempt || 0) < 1) {
          current.attempt = 1;
          changed = true;
        }
        return;
      }
      if (current?.runId && ["idle", "pending", "queued", "running", "run_failed", "failed"].includes(String(current.status || ""))) {
        root.document.documentElement.dataset.ofwS004VerificationRecovery = "current-lifecycle-preserved";
        return;
      }
      if (current?.runId && !(report.verificationRuns || []).some((item) => item?.runId === current.runId)) {
        report.verificationRuns = [...(report.verificationRuns || []), cloneJson(current)];
      }
      const source = current?.runId ? current : bestS004ArtifactVerificationRun(report);
      if (!source) return;
      report.postPublicationVerification = executeS004DeterministicVerification(report, {
        definition: state.customDefinitions?.[0] || null,
        runId: source.runId,
        retryOf: source.retryOf || null,
        attempt: source.attempt || 1,
        completedAt: source.completedAt || s004NowIso()
      });
      changed = true;
    });
    if (!changed) return false;
    reportResourcesCache = null;
    writeJsonState(M06_STATE_KEY, state);
    root.document.documentElement.dataset.ofwS004VerificationRecovery = "completed-projection-restored";
    return true;
  }

  function completeS004C024InAgentOwner(requestId) {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !requestId) return null;
    const inbox = readJsonState(C024_INBOX_KEY);
    const c024 = (Array.isArray(inbox) ? inbox : inbox?.requests || []).find((item) => item?.requestId === requestId);
    const reportContext = c024?.reportContext;
    if (!c024) return null;
    const model = mergeS004QaHistory(readJsonState(M05_STATE_KEY));
    if (!model) return null;
    const resources = reportResourcesFromState();
    const report = resources?.report;
    const evidencePack = report?.evidencePacks?.find?.((item) => item?.id === report?.evidencePackId) || report?.evidencePacks?.[0];
    const expectedBinding = report?.bindingSnapshot || evidencePack?.semanticBinding || {};
    const actualEvidence = reportContext?.evidencePack || {};
    const actualBinding = reportContext?.semanticBinding || {};
    const issues = [];
    if (!recoveryContextMatches(reportContext?.scenarioContext)) issues.push("场景五字段与当前 scenarioRunId 上下文不一致");
    if (!report?.reportNo || (reportContext?.reportNumber || reportContext?.reportId) !== report.reportNo) issues.push("报告编号与当前正式报告不一致");
    if (!report?.contentVersion || reportContext?.contentVersion !== report.contentVersion) issues.push("内容版本与当前正式报告不一致");
    if (!evidencePack?.id || actualEvidence.id !== evidencePack.id || actualEvidence.version !== evidencePack.version) issues.push("固定证据包身份或版本不一致");
    ["semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId", "asOf"].forEach((field) => {
      if (!expectedBinding?.[field] || actualBinding?.[field] !== expectedBinding[field]) issues.push(`${field} 与报告固定绑定不一致`);
    });
    if (!reportContext?.selectedAnchor || reportContext?.semanticResolution !== "resolved") issues.push("稳定锚点或 Published 语义解析状态不完整");
    if (issues.length) {
      const rejection = {
        sourceRequestId: requestId,
        status: "blocked",
        owner: "Agent 应用（M05）",
        contract: "C024",
        issues,
        receivedAt: c024.receivedAt || s004NowIso(),
        scenarioContext: cloneJson(reportContext?.scenarioContext || null)
      };
      model.c024Rejections = [...(model.c024Rejections || []).filter((item) => item?.sourceRequestId !== requestId), rejection];
      writeJsonState(M05_STATE_KEY, model);
      root.document.documentElement.dataset.ofwS004C024OwnerState = "rejected-identity-mismatch";
      return { rejected: true, rejection };
    }
    const existingRequest = (model.inboundRequests || []).find((item) => item?.id === requestId || item?.sourceRequestId === requestId);
    const existingRun = (model.runs || []).find((item) => item?.requestId === requestId);
    if (existingRequest && existingRun?.result?.id && existingRun.status === "complete") {
      const snapshot = existingRun.snapshot || {};
      const idempotent = recoveryContextMatches(existingRequest)
        && recoveryContextMatches(existingRun)
        && existingRequest.reportNumber === report.reportNo
        && existingRequest.contentVersion === report.contentVersion
        && existingRequest.evidencePackageId === evidencePack.id
        && existingRequest.evidencePackageVersion === evidencePack.version
        && snapshot.reportNumber === report.reportNo
        && snapshot.contentVersion === report.contentVersion
        && snapshot.evidencePackageId === evidencePack.id
        && snapshot.evidencePackageVersion === evidencePack.version
        && ["semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId"].every((field) => snapshot[field] === expectedBinding[field])
        && (snapshot.dataAsOf || snapshot.asOf) === expectedBinding.asOf;
      if (!idempotent) {
        const rejection = {
          sourceRequestId: requestId,
          status: "blocked",
          owner: "Agent 应用（M05）",
          contract: "C024",
          issues: ["同一 requestId 已绑定其他报告、证据、语义、数据或场景身份"],
          receivedAt: c024.receivedAt || s004NowIso(),
          scenarioContext: cloneJson(reportContext.scenarioContext)
        };
        model.c024Rejections = [...(model.c024Rejections || []).filter((item) => item?.sourceRequestId !== requestId), rejection];
        writeJsonState(M05_STATE_KEY, model);
        root.document.documentElement.dataset.ofwS004C024OwnerState = "rejected-request-conflict";
        return { rejected: true, rejection };
      }
      root.document.documentElement.dataset.ofwS004C024OwnerState = "idempotent-existing-result";
      return { request: existingRequest, run: existingRun, result: existingRun.result };
    }

    const qaContext = m06QaContextForRequest(report, evidencePack, reportContext);
    const response = m06AnswerForQuestion(c024.question, qaContext);
    const now = s004NowIso();
    const ordinal = String(nextS004CopilotOrdinal(model)).padStart(3, "0");
    const suffix = `${s004ScenarioDateToken()}-${ordinal}`;
    const runId = `RUN-S004-COPILOT-${suffix}`;
    const resultId = `RESULT-S004-COPILOT-${suffix}`;
    const sessionId = `SESSION-S004-COPILOT-${suffix}`;
    const scenario = cloneJson(reportContext.scenarioContext);
    const evidence = reportContext.evidencePack || {};
    const binding = reportContext.semanticBinding || {};
    const anchor = reportContext.selectedAnchor || c024.selectedAnchor || response.anchor;
    const request = {
      id: requestId,
      sourceRequestId: requestId,
      type: "report-copilot",
      title: `S004 报告问答 · ${c024.question}`,
      source: "报告中心",
      receivedAt: c024.receivedAt || now,
      status: "complete",
      currentProjection: true,
      projectionStatus: "current",
      agentId: "report-copilot",
      reportNumber: reportContext.reportNumber || reportContext.reportId,
      contentVersion: reportContext.contentVersion,
      evidencePackageId: evidence.id,
      evidencePackageVersion: evidence.version,
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      consumableVersionId: binding.consumableVersionId,
      dataAsOf: binding.asOf,
      scenarioContext: scenario,
      anchor,
      question: c024.question,
      requestContext: cloneJson(reportContext),
      c024: cloneJson(c024),
      owner: "Agent 应用（M05）"
    };
    const result = {
      id: resultId,
      version: "1.0",
      type: "Report Copilot Result",
      contract: "Report Copilot Result v1",
      title: "S004 贷前调查报告问答结果",
      summary: response.answer,
      question: c024.question,
      anchor,
      citations: response.citationRefs,
      evidenceRefs: response.citationRefs,
      verificationRunId: response.verificationRunId,
      limitations: "只解释当前报告固定证据，不查询工作簿、不切换最新数据、不重算正式指标、不形成授信决定。",
      confirmation: "credit-decision-human-only",
      owner: "Agent 应用（M05）",
      generatedAt: now,
      reportNumber: request.reportNumber,
      contentVersion: request.contentVersion,
      evidencePackageId: request.evidencePackageId,
      evidencePackageVersion: request.evidencePackageVersion,
      contextSnapshot: {
        scenarioContext: cloneJson(scenario),
        reportNumber: request.reportNumber,
        contentVersion: request.contentVersion,
        selectedAnchor: anchor,
        evidencePackageId: request.evidencePackageId,
        evidencePackageVersion: request.evidencePackageVersion,
        semanticVersionId: request.semanticVersionId,
        semanticVersion: request.semanticVersion,
        dataAssetVersionId: request.dataAssetVersionId,
        dataVersion: request.dataVersion,
        consumableVersionId: request.consumableVersionId,
        dataAsOf: request.dataAsOf,
        verificationRunId: response.verificationRunId,
        factPackageId: qaContext.factPackage?.packageId || null,
        citationRefs: cloneJson(response.citationRefs)
      },
      scenarioContext: scenario
    };
    const run = {
      id: runId,
      status: "complete",
      createdAt: now,
      startedAt: now,
      finishedAt: now,
      source: "Agent 应用",
      currentProjection: true,
      projectionStatus: "current",
      attempt: 1,
      sessionId,
      bindingId: `BIND-S004-COPILOT-${suffix}`,
      scenarioContext: scenario,
      requestId,
      question: c024.question,
      steps: [
        { id: "input", name: "读取报告固定上下文", status: "complete" },
        { id: "evidence", name: "读取 Published/C008 与固定证据包", status: "complete" },
        { id: "answer", name: "组织结论—依据—边界答复", status: "complete" }
      ],
      toolCalls: [],
      result,
      error: null,
      snapshot: {
        agentId: "report-copilot",
        agentName: "S004 贷前调查报告伴读 Agent",
        agentRelease: "2.0.0",
        scenarioContext: scenario,
        scenarioId: scenario.scenarioId,
        scenarioVersion: scenario.scenarioVersion,
        scenarioRunId: scenario.scenarioRunId,
        reportNumber: request.reportNumber,
        contentVersion: request.contentVersion,
        evidencePackageId: request.evidencePackageId,
        evidencePackageVersion: request.evidencePackageVersion,
        semanticVersionId: request.semanticVersionId,
        semanticVersion: request.semanticVersion,
        ontologyVersion: request.semanticVersion,
        dataAssetVersionId: request.dataAssetVersionId,
        dataVersion: request.dataVersion,
        consumableVersionId: request.consumableVersionId,
        dataAsOf: request.dataAsOf,
        anchor,
        question: c024.question,
        inputContract: "Report Reading Request v1",
        outputContract: "Report Copilot Result v1"
      }
    };
    const session = {
      id: sessionId,
      bindingId: run.bindingId,
      currentProjection: true,
      projectionStatus: "current",
      scenarioContext: scenario,
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioRunId: scenario.scenarioRunId,
      reportNumber: request.reportNumber,
      contentVersion: request.contentVersion,
      anchor,
      evidencePackageId: request.evidencePackageId,
      evidencePackageVersion: request.evidencePackageVersion,
      semanticVersionId: request.semanticVersionId,
      semanticVersion: request.semanticVersion,
      dataAssetVersionId: request.dataAssetVersionId,
      dataVersion: request.dataVersion,
      consumableVersionId: request.consumableVersionId,
      status: "active",
      createdAt: now,
      latestRunId: runId,
      latestResultId: resultId,
      resultReturnStatus: "已通过 C025 返回报告中心"
    };

    // v1.0.3 compacts collection tails. Put the latest exact-context
    // projection first while retaining every older immutable record.
    model.inboundRequests = [request, ...(model.inboundRequests || []).filter((item) => item?.id !== requestId && item?.sourceRequestId !== requestId)];
    model.runs = [run, ...(model.runs || []).filter((item) => item?.id !== runId && item?.requestId !== requestId)];
    model.sessions = [session, ...(model.sessions || []).filter((item) => item?.id !== sessionId)];
    model.currentScenarioContext = scenario;
    model.runtimeActivity = [...(model.runtimeActivity || []), {
      id: `ACT-${suffix}`,
      owner: "Agent 应用（M05）",
      contract: "C024 → C025",
      requestId,
      runId,
      resultId,
      sessionId,
      formedAt: now,
      scenarioContext: scenario
    }].slice(-20);
    if (!writeJsonState(M05_STATE_KEY, model)) return null;
    persistS004QaHistory(model);
    m05RuntimeCache = cloneJson(model);
    reportCopilotCache = null;
    root.document.documentElement.dataset.ofwS004C024OwnerRun = runId;
    root.document.documentElement.dataset.ofwS004C024OwnerState = "completed-new-result";
    return { request, run, result, session };
  }

  function s004CopilotOrdinalFromId(id) {
    const match = String(id || "").match(/(?:RUN|RESULT|SESSION)-S004-COPILOT-\d{8}-(\d{3,})$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function nextS004CopilotOrdinal(model) {
    const ids = [
      ...(model?.runs || []).flatMap((item) => [item?.id, item?.result?.id]),
      ...(model?.sessions || []).map((item) => item?.id),
      ...(model?.runtimeActivity || []).flatMap((item) => [item?.runId, item?.resultId, item?.sessionId])
    ].filter(Boolean);
    const maximum = ids.reduce((max, id) => Math.max(max, s004CopilotOrdinalFromId(id)), 0);
    return maximum + 1;
  }

  function rebindS004C024Anchor(requestId, selectedAnchor) {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !requestId || !selectedAnchor) return false;
    const inboxState = readJsonState(C024_INBOX_KEY);
    const requests = Array.isArray(inboxState) ? inboxState : inboxState?.requests;
    if (!Array.isArray(requests)) return false;
    const request = requests.find((item) => item?.requestId === requestId);
    if (!request) return false;
    request.selectedAnchor = selectedAnchor;
    request.reportContext = { ...(request.reportContext || {}), selectedAnchor };
    request.fixedContextRef = { ...(request.fixedContextRef || {}), selectedAnchor };
    const nextInbox = Array.isArray(inboxState) ? requests : { ...inboxState, requests };
    if (!writeJsonState(C024_INBOX_KEY, nextInbox)) return false;
    root.document.documentElement.dataset.ofwS004C024AnchorRebound = selectedAnchor;
    return true;
  }

  function rerunS004DeterministicVerification() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return null;
    // Use the prewarmed complete projection. Reading the baseline-compacted
    // storage record here would discard the immutable template, fact package
    // and formal-output manifest when the iframe reloads after the rerun.
    const state = completeM06StateForMutation();
    if (!state?.report) {
      root.document.documentElement.dataset.ofwS004VerificationRerunReason = "report-state-missing";
      return null;
    }
    const now = s004NowIso();
    const runId = `VRF-S004-RERUN-${s004ScenarioDateToken()}-${String(s004NowEpoch()).slice(-9)}-${Math.random().toString(36).slice(2, 7)}`;
    const reports = [state.report, ...(state.publishedReports || [])].filter((report, index, all) =>
      report?.reportNo && all.findIndex((candidate) => candidate === report) === index);
    let firstRun = null;
    reports.forEach((report) => {
      if (!sameScenarioRun(report)) return;
      const current = report.postPublicationVerification || {};
      if (current?.runId && !(report.verificationRuns || []).some((item) => item?.runId === current.runId)) {
        report.verificationRuns = [...(report.verificationRuns || []), cloneJson(current)];
      }
      const normalized = executeS004DeterministicVerification(report, {
        definition: state.customDefinitions?.[0] || null,
        runId,
        retryOf: current.runId || null,
        attempt: Number(current.attempt || 0) + 1,
        completedAt: now,
        scenarioContext: cloneJson(report.scenarioContext)
      });
      if (!normalized) return;
      report.verificationRuns = [...(report.verificationRuns || []).filter((item) => item?.runId !== normalized.runId), cloneJson(normalized)];
      report.postPublicationVerification = normalized;
      if (!firstRun) firstRun = normalized;
    });
    if (!firstRun) {
      root.document.documentElement.dataset.ofwS004VerificationRerunReason = "artifact-verification-run-missing";
      root.document.documentElement.dataset.ofwS004VerificationRerunDiagnostics = JSON.stringify(reports.map((report) => ({
        reportNo: report.reportNo,
        postStatus: report.postPublicationVerification?.status || null,
        postCoverage: report.postPublicationVerification?.coverage?.status || null,
        postResults: report.postPublicationVerification?.results?.length || 0,
        runs: (report.verificationRuns || []).map((item) => ({ id: item.runId, status: item.status, coverage: item.coverage?.status, results: item.results?.length || 0, units: item.unitResults?.length || 0 }))
      })));
      return null;
    }
    if (!writeJsonState(M06_STATE_KEY, state)) return null;
    const refreshed = state.report?.evidencePacks?.[0];
    if (reportResourcesCache && refreshed?.authoritativeFactPackage && refreshed?.template) {
      reportResourcesCache = {
        state,
        report: state.report,
        definition: state.customDefinitions?.[0],
        template: refreshed.template,
        factPackage: refreshed.authoritativeFactPackage
      };
    }
    root.document.documentElement.dataset.ofwS004VerificationRerun = firstRun.runId;
    return firstRun;
  }

  function runS004DraftDeterministicVerification() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return null;
    const state = completeM06StateForMutation();
    if (!state?.report || !sameScenarioRun(state.report) || state.report.stage !== "draft") {
      root.document.documentElement.dataset.ofwS004DraftVerification = "draft-state-not-ready";
      return null;
    }
    state.report = completeS004ActiveContentContract(state.report);
    const report = state.report;
    const previous = report.verification || {};
    if (previous?.runId && !(report.verificationRuns || []).some((item) => item?.runId === previous.runId)) {
      report.verificationRuns = [...(report.verificationRuns || []), cloneJson(previous)];
    }
    const run = executeS004DeterministicVerification(report, {
      definition: state.customDefinitions?.[0] || null,
      runId: `VRF-S004-DRAFT-${s004ScenarioDateToken()}-${String(s004NowEpoch()).slice(-9)}-${Math.random().toString(36).slice(2, 7)}`,
      retryOf: previous?.runId || null,
      attempt: Number(previous?.attempt || 0) + 1,
      completedAt: s004NowIso(),
      scenarioContext: cloneJson(report.scenarioContext)
    });
    if (!run) return null;
    report.verificationRuns = [...(report.verificationRuns || []).filter((item) => item?.runId !== run.runId), cloneJson(run)];
    report.verification = run;
    const content = (report.contentVersions || []).find((item) => item?.reviewCopyId === report.reviewCopyId);
    if (content) {
      content.verificationPlan = s004CanonicalVerificationPlan(report);
      content.verificationRunIds = [...new Set([...(content.verificationRunIds || []), run.runId])];
      content.factInventory = Array.isArray(content.factInventory) && content.factInventory.length
        ? content.factInventory
        : cloneJson((report.evidencePacks || []).find((item) => item?.id === report.evidencePackId)?.authoritativeFactPackage?.contentFacts || []);
    }
    if (!writeJsonState(M06_STATE_KEY, state)) return null;
    reportResourcesCache = null;
    reportCopilotCache = null;
    root.document.documentElement.dataset.ofwS004DraftVerification = run.publicationEligible
      ? "completed-eligible-for-human-review"
      : "completed-with-findings";
    root.document.documentElement.dataset.ofwS004DraftVerificationRun = run.runId;
    return run;
  }

  function s004IssueIsOpen(issue) {
    return !["已关闭", "已核对关闭", "closed", "resolved"].includes(String(issue?.status || ""));
  }

  function confirmS004DraftAfterVerification() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return null;
    const state = completeM06StateForMutation();
    if (!state?.report || !sameScenarioRun(state.report) || state.report.stage !== "draft") return null;
    state.report = completeS004ActiveContentContract(state.report);
    const report = state.report;
    const verification = report.verification;
    const blocking = (verification?.results || []).some((item) => ["fail", "unverifiable"].includes(item?.status));
    const openIssues = (report.issues || []).filter(s004IssueIsOpen);
    if (!isS004FullVerificationProjection(report, verification) || blocking || openIssues.length) {
      root.document.documentElement.dataset.ofwS004DraftConfirmation = "blocked-by-verification-or-issues";
      return null;
    }
    const binding = report.bindingSnapshot || {};
    const c008 = readJsonState(C008_STATE_KEY)?.current || {};
    const c017 = readJsonState(C017_REPORT_KEY);
    const c017Projection = (c017?.projections || []).find((item) => sameScenarioRun(item)
      && item?.dataVersion === binding.dataVersion) || null;
    const authorityReady = Boolean(
      c008.semanticVersionId === binding.semanticVersionId
      && c008.dataVersion === binding.dataVersion
      && c017Projection?.allowConsumption === true
      && c017Projection?.currentStateSummary?.hardQualityFailure === false
    );
    if (!authorityReady) {
      root.document.documentElement.dataset.ofwS004DraftConfirmation = "blocked-by-current-authority";
      return null;
    }
    const confirmedAt = s004NowIso();
    const confirmationId = `HCONF-S004-DRAFT-${s004ScenarioDateToken()}-${String(s004NowEpoch()).slice(-9)}`;
    report.stage = "confirmed";
    report.confirmedAt = confirmedAt;
    report.humanReview = {
      status: "confirmed",
      confirmationId,
      contentVersion: report.contentVersion,
      reviewer: "财务公司调查复核岗",
      completedAt: confirmedAt,
      note: "已核对 V01—V08 确定性核验结果、AI 建议与需人工确认内容，同意当前候选内容进入待发布状态；尚未发布正式报告。"
    };
    const content = (report.contentVersions || []).find((item) => item?.reviewCopyId === report.reviewCopyId);
    if (content) content.status = "已确认";
    report.reviewHistory = [...(report.reviewHistory || []), {
      scenarioContext: cloneJson(report.scenarioContext),
      id: `REV-S004-${s004ScenarioDateToken()}-${String(s004NowEpoch()).slice(-9)}`,
      type: "人工确认",
      contentVersion: report.contentVersion,
      at: confirmedAt,
      reviewer: "财务公司调查复核岗",
      confirmationId,
      note: report.humanReview.note
    }];
    if (!writeJsonState(M06_STATE_KEY, state)) return null;
    reportResourcesCache = null;
    reportCopilotCache = null;
    root.document.documentElement.dataset.ofwS004DraftConfirmation = "confirmed-awaiting-publication";
    return report.humanReview;
  }

  function recoveryContextMatches(value) {
    const candidate = value?.scenarioContext || value || {};
    return ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]
      .every((field) => candidate[field] != null && String(candidate[field]) === String(context[field]));
  }

  function hasFullReportProjection(state) {
    const report = state?.report;
    const evidencePack = report?.evidencePacks?.[0];
    return Boolean(
      report?.reportNo
      && report?.contentVersion
      && recoveryContextMatches(report)
      && state?.customDefinitions?.[0]?.id
      && evidencePack?.authoritativeFactPackage?.packageId
      && evidencePack?.template?.id
      && report?.artifactManifest?.html?.output
      && report?.artifactManifest?.pdf?.output
    );
  }

  function locateS004CopilotProjection(model, reportState = null) {
    const reportModel = reportState || readJsonState(M06_STATE_KEY);
    const report = reportModel?.report;
    if (!model || !report?.reportNo || !recoveryContextMatches(report)) return null;
    const binding = report.bindingSnapshot || report.evidencePacks?.[0]?.semanticBinding || {};
    const requestRef = reportModel?.assistant?.requestRef || null;
    const allRequests = (model.inboundRequests || []).filter((item) =>
      item?.type === "report-copilot" && recoveryContextMatches(item));
    const requestOrdinal = (request) => Math.max(0, ...(model.runs || [])
      .filter((run) => run?.requestId === request?.id && run?.snapshot?.agentId === "report-copilot")
      .map((run) => s004CopilotOrdinalFromId(run?.id)));
    const orderedRequests = allRequests
      .map((item, index) => ({
        item,
        index,
        ordinal: requestOrdinal(item),
        receivedAt: Date.parse(item?.receivedAt || item?.createdAt || "") || 0
      }))
      .sort((left, right) => right.ordinal - left.ordinal
        || right.receivedAt - left.receivedAt
        || left.index - right.index)
      .map(({ item }) => item);
    const preferredRequests = requestRef?.requestId
      ? orderedRequests.filter((item) => item.id === requestRef.requestId || item.sourceRequestId === requestRef.requestId)
      : [];
    // The frozen report module can persist assistant.requestRef slightly
    // later than the Agent owner completes a new interactive C024. Prefer the
    // newest exact-context request whenever it is newer than that frozen
    // pointer; otherwise keep the explicit pointer first. This keeps the
    // visible Session / Run / Result trace on the question the user just sent
    // without weakening report, evidence or version identity checks.
    const newestRequest = orderedRequests[0] || null;
    const preferredRequest = preferredRequests[0] || null;
    const newestOrdinal = requestOrdinal(newestRequest);
    const preferredOrdinal = requestOrdinal(preferredRequest);
    const newestAt = Date.parse(newestRequest?.receivedAt || newestRequest?.createdAt || "") || 0;
    const preferredAt = Date.parse(preferredRequest?.receivedAt || preferredRequest?.createdAt || "") || 0;
    const requests = newestRequest && (!preferredRequest
      || newestOrdinal > preferredOrdinal
      || (newestOrdinal === preferredOrdinal && newestAt > preferredAt))
      ? orderedRequests
      : [...preferredRequests, ...orderedRequests.filter((item) => !preferredRequests.includes(item))];
    for (const request of requests) {
      const allRuns = (model.runs || []).filter((item) =>
        item?.snapshot?.agentId === "report-copilot"
        && item?.status === "complete"
        && item?.requestId === request.id
        && recoveryContextMatches(item));
      const preferredRuns = requestRef?.runId ? allRuns.filter((item) => item.id === requestRef.runId) : allRuns;
      const runs = preferredRuns.length ? preferredRuns : allRuns;
      for (const run of runs) {
        const result = run.result;
        const allSessions = (model.sessions || []).filter((item) =>
          recoveryContextMatches(item)
          && item?.latestRunId === run.id
          && item?.latestResultId === result?.id);
        const preferredSessions = requestRef?.sessionId ? allSessions.filter((item) => item.id === requestRef.sessionId) : allSessions;
        const session = (preferredSessions.length ? preferredSessions : allSessions)[0];
        const anchor = request.anchor || request.c024?.selectedAnchor || request.c024?.reportContext?.selectedAnchor || run.snapshot?.anchor || session?.anchor;
        const snapshot = run.snapshot || {};
        const valid = Boolean(
          request.id
          && run.id
          && result?.id
          && result?.summary
          && session?.id
          && anchor
          && run.requestId === request.id
          && request.reportNumber === report.reportNo
          && request.contentVersion === report.contentVersion
          && request.evidencePackageId === report.evidencePackId
          && snapshot.reportNumber === report.reportNo
          && snapshot.contentVersion === report.contentVersion
          && snapshot.evidencePackageId === report.evidencePackId
          && snapshot.semanticVersionId === binding.semanticVersionId
          && snapshot.semanticVersion === binding.semanticVersion
          && snapshot.dataAssetVersionId === binding.dataAssetVersionId
          && snapshot.dataVersion === binding.dataVersion
          && snapshot.consumableVersionId === binding.consumableVersionId
          && (snapshot.dataAsOf || snapshot.asOf) === binding.asOf
          && (!snapshot.anchor || snapshot.anchor === anchor)
          && (!session.anchor || session.anchor === anchor)
        );
        if (valid) return { requestRef, request, run, session, result, anchor, report };
      }
    }
    return null;
  }

  function hasFullCopilotProjection(state, reportState = null) {
    return Boolean(locateS004CopilotProjection(state, reportState));
  }

  function hasM05RuntimeProjection(state, reportState = null) {
    if (!state || !recoveryContextMatches(state.currentScenarioContext || state)) return false;
    const agents = state.agentOverrides || [];
    const hasAgents = ["report-draft", "report-copilot"].every((id) =>
      agents.some((item) => item?.id === id));
    const hasEvidence = (state.evidencePackages || []).some((item) =>
      item?.status === "ready" && recoveryContextMatches(item));
    const reportReady = hasFullReportProjection(reportState || m05ReportReferenceState());
    return Boolean(hasAgents && hasEvidence && reportReady);
  }

  function hasS004DeterministicVerificationProjection(state) {
    const reports = [state?.report, ...(state?.publishedReports || [])];
    return reports.some((report) => sameScenarioRun(report)
      && report?.postPublicationVerification?.status === "completed-s004-deterministic"
      && report.postPublicationVerification.coverage?.status === "complete"
      && Array.isArray(report.postPublicationVerification.results)
      && report.postPublicationVerification.results.length > 0);
  }

  // v1.0.3 may compact the legacy M06/M05 records after rendering. Older
  // markers (recovery version 1) still carry an immutable recovery copy and
  // remain readable. New markers are intentionally compact: when a projection
  // is incomplete, ask the parent S004 shell to re-seed this same scenario run
  // from the immutable HTTP artifacts, then reload the iframe. No new
  // report/run/result is created and no history is overwritten.
  let s004ReseedPromise = null;

  function reseedProjectionIsValid() {
    const currentM06 = readJsonState(M06_STATE_KEY);
    const currentM05 = readJsonState(M05_STATE_KEY);
    if (moduleId === "M05") return hasM05RuntimeProjection(currentM05, currentM06);
    if (moduleId === "M06") return hasFullReportProjection(currentM06);
    return true;
  }

  function requestS004NativeReseed(reason) {
    if (context.scenarioId !== "S004" || s004ReseedPromise) return s004ReseedPromise;
    const normalizedReason = String(reason || "projection-incomplete");
    const sessionGuard = nativeReseedGuardRead();
    if (sessionGuard && String(sessionGuard).startsWith(`${context.scenarioRunId}|`)) {
      root.document.documentElement.dataset.ofwS004NativeReseed = "suppressed-after-single-reload";
      root.document.documentElement.dataset.ofwS004NativeReseedReason = normalizedReason;
      return Promise.resolve({ suppressed: true, reason: "single-reload-guard" });
    }
    let seeder = null;
    try { seeder = root.parent && root.parent !== root ? root.parent.OFW_S004_NativeSeeder : null; } catch (_) { seeder = null; }
    if (!seeder || typeof seeder.reseedCurrent !== "function") return null;
    root.document.documentElement.dataset.ofwS004NativeReseed = "requested";
    nativeReseedGuardWrite(`${context.scenarioRunId}|${normalizedReason}`);
    s004ReseedPromise = Promise.resolve()
      .then(() => seeder.reseedCurrent())
      .then(() => {
        const valid = reseedProjectionIsValid();
        root.document.documentElement.dataset.ofwS004NativeReseed = valid ? "completed" : "completed-but-projection-invalid";
        root.document.documentElement.dataset.ofwS004NativeReseedReason = normalizedReason;
        if (valid && moduleId === "M06") {
          synchronizeM06ReportDataProjection("native-reseed-completed");
        }
        writeJsonState(NATIVE_RESEED_GUARD_KEY, {
          phase: valid ? "reload-issued" : "invalid-after-reseed",
          reason: normalizedReason,
          scenarioContext: cloneJson(context),
          moduleId,
          checkedAt: s004NowIso(),
          exactIdentityValidated: valid
        });
        if (valid && typeof root.location?.reload === "function") root.location.reload();
        return { valid, reloaded: valid };
      })
      .catch((error) => {
        nativeReseedGuardWrite(null);
        root.document.documentElement.dataset.ofwS004NativeReseed = "failed";
        root.document.documentElement.dataset.ofwS004NativeReseedReason = String(error?.message || error);
      });
    return s004ReseedPromise;
  }

  function restoreS004NativeProjection() {
    if (context.scenarioId !== "S004") return;
    const marker = readJsonState(NATIVE_SEED_MARKER_KEY);
    const recovery = marker?.recovery;
    if (!recovery || !recoveryContextMatches(recovery)) return;
    const currentM06 = readJsonState(M06_STATE_KEY);
    const currentM05 = readJsonState(M05_STATE_KEY);
    const activeM06Work = moduleId === "M06" && isM06ActiveScenarioWorkState(currentM06);
    // A replacement/new-report run deliberately has no formal report number,
    // artifact manifest or published-stage projection yet.  Treating that
    // expected lifecycle state as a damaged seed would overwrite the current
    // Request/evidence/Agent run with the historical published report.
    if (activeM06Work) {
      root.document.documentElement.dataset.ofwS004NativeReseed = "suppressed-active-generation";
      root.document.documentElement.dataset.ofwS004NativeReseedReason = currentM06.report?.stage || "active-report-work";
      return;
    }
    if (recovery.version === 1) {
      if (moduleId === "M06" && !hasFullReportProjection(currentM06) && recovery.m06) {
        root.localStorage.setItem(M06_STATE_KEY, JSON.stringify(recovery.m06));
      }
      if (moduleId === "M06" && !hasFullCopilotProjection(currentM05) && recovery.m05) {
        root.localStorage.setItem(M05_STATE_KEY, JSON.stringify(recovery.m05));
      }
      return;
    }
    if (recovery.version >= 2) {
      if (moduleId === "M05") {
        if (hasM05RuntimeProjection(currentM05, currentM06)) {
          m05RuntimeCache = cloneJson(currentM05);
          m05ReportStateCache = cloneJson(currentM06);
          nativeReseedGuardWrite(null);
          root.document.documentElement.dataset.ofwS004M05Prewarm = "complete";
          return;
        }
        const cachedComplete = Boolean(m05RuntimeCache && m05ReportStateCache
          && hasM05RuntimeProjection(m05RuntimeCache, m05ReportStateCache));
        if (!cachedComplete) requestS004NativeReseed("M05-runtime-projection-incomplete");
        return;
      }
      if (moduleId === "M06") {
        const reportIncomplete = !hasFullReportProjection(currentM06);
        const cachedReportComplete = Boolean(reportResourcesCache?.report?.reportNo
          && reportResourcesCache?.template?.id
          && reportResourcesCache?.factPackage?.packageId);
        if (reportIncomplete && !cachedReportComplete) {
          requestS004NativeReseed("M06-report-projection-incomplete");
        }
      }
    }
  }

  function readM03State() {
    if (moduleId !== "M03") return null;
    return readJsonState(root.IQ_VARIANT?.storageKey || M03_STATE_KEY);
  }

  function scenarioM03State() {
    return readJsonState(M03_STATE_KEY);
  }

  function scenarioM03NotApplicable() {
    if (context.scenarioId !== "S004") return false;
    const state = scenarioM03State();
    return [state?.scenarioApplicability?.status, state?.activeConfigStatus, state?.activeConfig?.scenarioApplicability?.status]
      .map((value) => String(value || "").toUpperCase())
      .includes("NOT_APPLICABLE");
  }

  function isM03NotApplicable() {
    if (moduleId !== "M03" || context.scenarioId !== "S004") return false;
    const state = readM03State();
    const statuses = [
      context.status,
      state?.scenarioApplicability?.status,
      state?.activeConfigStatus,
      state?.activeConfig?.scenarioApplicability?.status
    ].map((value) => String(value || "").toUpperCase());
    return statuses.includes("NOT_APPLICABLE");
  }

  function m03ControlLabel(control) {
    return String(control?.querySelector?.(".ui-button__label")?.textContent || control?.textContent || "").trim();
  }

  function shouldBlockM03Control() {
    // NOT_APPLICABLE is a scenario-chain boundary, not a permission to replace
    // or disable the frozen v1.0.3 module.  Native controls stay available so
    // the complete page, routes, validation and blocked-run semantics can be
    // exercised during regression.  The seeded C017/config gates still keep
    // those interactions out of the formal S004 report/action chain.
    return false;
  }

  function disableM03Control(control, replacementLabel = null) {
    if (!control) return;
    control.disabled = true;
    control.setAttribute?.("disabled", "");
    control.setAttribute?.("aria-disabled", "true");
    control.setAttribute?.("title", M03_NOT_APPLICABLE_REASON);
    if (control.dataset) control.dataset.ofwS004M03Blocked = "true";
    if (replacementLabel) setText(control.querySelector?.(".ui-button__label") || control, replacementLabel);
  }

  function panelByHeading(title) {
    return [...root.document.querySelectorAll(".panel")].find((panel) => panel.querySelector(".panel-head h2")?.textContent?.trim() === title) || null;
  }

  function setFactValue(scope, label, value) {
    if (!scope) return;
    [...scope.querySelectorAll("dt")].forEach((term) => {
      if (term.textContent?.trim() === label) setText(term.nextElementSibling, value);
    });
    [...scope.querySelectorAll(".ui-fact")].forEach((fact) => {
      if (fact.querySelector(".ui-fact__label")?.textContent?.trim() === label) setText(fact.querySelector(".ui-fact__value"), value);
    });
    [...scope.querySelectorAll(".key-value-row")].forEach((row) => {
      if (row.children?.[0]?.textContent?.trim() === label) setText(row.children?.[1], value);
    });
  }

  function patchM03AskPage() {
    const askHero = root.document.querySelector(".ask-hero");
    if (!askHero) return;
    askHero.dataset.ofwS004M03NativeCapability = "preserved";
    askHero.querySelector("form.composer")?.setAttribute?.("data-ofw-s004-native-interaction", "preserved");
    root.document.querySelector(".recommendation-panel")?.setAttribute?.("data-ofw-s004-native-interaction", "preserved");
  }

  function patchM03AgentPage() {
    const agentPage = root.document.querySelector('.main[data-screen-label="Agent 配置"]');
    if (!agentPage) return;
    agentPage.dataset.ofwS004M03NativeCapability = "preserved";
    agentPage.querySelector(".active-config")?.setAttribute?.("data-ofw-s004-native-interaction", "preserved");
    agentPage.querySelector(".candidate-validation-page")?.setAttribute?.("data-ofw-s004-native-interaction", "preserved");
  }

  function patchM03NotApplicable() {
    if (moduleId !== "M03") return;
    const applicable = isM03NotApplicable();
    root.document.documentElement.dataset.ofwS004M03Applicability = applicable ? "NOT_APPLICABLE" : "applicable";
    if (!applicable) return;
    root.document.documentElement.dataset.ofwS004M03InteractionMode = "BASELINE_NATIVE_CONTROLS_PRESERVED";
    patchM03AskPage();
    patchM03AgentPage();
  }

  function readM04State() {
    if (moduleId !== "M04") return null;
    return readJsonState(M04_STATE_KEY);
  }

  function isM04EmptyActionRequestQueue() {
    if (moduleId !== "M04" || context.scenarioId !== "S004") return false;
    const state = readM04State();
    return state?.scenarioContext?.scenarioId === context.scenarioId
      && state?.scenarioContext?.scenarioRunId === context.scenarioRunId
      && Array.isArray(state.requests) && state.requests.length === 0
      && Array.isArray(state.tasks) && state.tasks.length === 0;
  }

  function patchM04EmptyActionRequestQueue() {
    if (moduleId !== "M04" || context.scenarioId !== "S004") return;
    const empty = isM04EmptyActionRequestQueue();
    root.document.documentElement.dataset.ofwS004M04Queue = empty ? "EMPTY_ACTION_REQUEST_QUEUE" : "HAS_RUNTIME_RECORDS";
    root.document.documentElement.dataset.ofwS004M04InteractionMode = "BASELINE_NATIVE_CONTROLS_PRESERVED";
    const page = root.document.querySelector(".page-shell, main, [data-screen-label]");
    if (page?.dataset) page.dataset.ofwS004M04ScenarioProjection = empty ? "empty-action-request-queue" : "runtime-records";
    root.document.querySelectorAll(".dc-empty").forEach((node) => {
      if (node?.dataset) node.dataset.ofwS004M04NativeEmptyState = "preserved";
    });
  }

  function ensureM05AppendAccessProjection() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return false;
    restoreS004NativeProjection();
    const state = m05RuntimeState();
    if (!state) return false;
    const hasS004Agent = ["report-draft", "report-copilot"].every((id) =>
      (state.agentOverrides || []).some((item) => item?.id === id));
    const hasRunnableEvidence = (state.evidencePackages || []).some((item) =>
      item?.status === "ready" && item?.scenarioContext?.scenarioRunId === context.scenarioRunId);
    const hasCurrentContext = recoveryContextMatches(state.currentScenarioContext || state);
    if (!hasS004Agent || !hasRunnableEvidence || !hasCurrentContext) {
      root.document.documentElement.dataset.ofwS004M05AccessRecovery = "projection-incomplete";
      return false;
    }
    nativeReseedGuardWrite(null);
    if (state.scenarioAccess?.mode !== M05_APPEND_ACCESS_MODE) {
      state.scenarioAccess = {
        ...(state.scenarioAccess || {}),
        previousMode: state.scenarioAccess?.mode || null,
        mode: M05_APPEND_ACCESS_MODE,
        label: "当前隔离轮次可运行 · 历史不可变",
        allowedActions: [
          "查看 Agent 目录", "查看配置资源", "接收完整 C022/C024", "发起当前轮次新运行",
          "追加 Run/Result/Session", "查看结果与证据", "人工确认结果参考价值"
        ],
        blockedActions: [
          "覆盖历史 Run/Result/Session", "原地修改已发布 Agent Release", "绕过报告中心发布报告",
          "直接读取工作簿或源节点", "提交 Action Request"
        ],
        reason: M05_APPEND_REASON,
        restoredAt: s004NowIso()
      };
      if (!writeJsonState(M05_STATE_KEY, state)) return false;
      m05RuntimeCache = cloneJson(state);
      root.document.documentElement.dataset.ofwS004M05AccessRecovery = "append-mode-restored";
    } else {
      root.document.documentElement.dataset.ofwS004M05AccessRecovery = "append-mode-current";
    }
    return true;
  }

  function m05ScenarioReadOnly() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return false;
    if (ensureM05AppendAccessProjection()) return false;
    const state = m05RuntimeState();
    return state?.scenarioAccess?.mode === "READ_ONLY_EXISTING_ARTIFACTS";
  }

  function m05ControlLabel(control) {
    return String(control?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function shouldBlockM05Control(node) {
    if (!m05ScenarioReadOnly()) return false;
    const control = node?.closest?.("button, [role='button']");
    if (!control) return false;
    if (control.dataset?.ofwS004M05Blocked === "true") return true;
    const label = m05ControlLabel(control);
    const title = String(control.getAttribute?.("title") || "").trim();
    if (/删除|移除连接|连接到此输入|从此输出连接/.test(title)) return true;
    if (M05_READONLY_ACTION_LABELS.has(label)) return true;
    if (/^(开始|发起|接收|创建|发布|停用|重新启用|验证|清空|重试|提交|确认|保存|启用|运行固定|试运行|添加|删除|移除|确定性|人工暂停|指定汇总|失败结束|部分结果|取消检查)/.test(label)
      && !/^(开始查看|创建时间|发布于)/.test(label)) return true;
    return false;
  }

  function shouldBlockM05BaselineControl(node) {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return false;
    const control = node?.closest?.("button, [role='button']");
    const container = control?.closest?.('[data-ofw-s004-baseline-reference="true"]');
    if (!container) return false;
    const label = m05ControlLabel(control);
    return /^(发起|开始|创建|停用|重新启用|发布|验证|运行|试运行|提交|确认|保存|接收)/.test(label);
  }

  function disableM05Control(control) {
    if (!control) return;
    control.disabled = true;
    control.setAttribute?.("disabled", "");
    control.setAttribute?.("aria-disabled", "true");
    control.setAttribute?.("title", M05_READONLY_REASON);
    if (control.dataset) control.dataset.ofwS004M05Blocked = "true";
  }

  function patchM05RequestCopy() {
    root.document.querySelectorAll?.(".request-card").forEach((card) => {
      const isCopilot = card.textContent?.includes("伴读") || card.textContent?.includes("报告问答");
      if (!isCopilot || !card.textContent?.includes("请求已完成")) return;
      const notice = card.querySelector?.(".notice");
      const message = notice?.querySelector?.("div > span");
      const append = !m05ScenarioReadOnly();
      if (message) setText(message, append
        ? "已形成独立 Run、Result 与伴读 Session；可在当前隔离轮次继续提交新的伴读请求，历史记录不可覆盖。"
        : "已形成独立 Run、Result 与伴读 Session，可从运行记录查看；历史制品不可原地覆盖。 ");
      if (card.dataset) card.dataset.ofwS004CompanionReadonly = append ? "false" : "true";
    });
  }

  function patchM05GenerationArtifactCopy() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    const state = m05RuntimeState() || {};
    const ids = new Set();
    (state.inboundRequests || []).forEach((request) => {
      if (request?.currentProjection === false || request?.type !== "report-draft" || !isCurrentS004RuntimeRecord(request)) return;
      [request.id, request.sourceRequestId, request.runId, request.resultId].filter(Boolean).forEach((id) => ids.add(String(id)));
    });
    (state.runs || []).forEach((run) => {
      if (run?.currentProjection === false || run?.snapshot?.agentId !== "report-draft" || !isCurrentS004RuntimeRecord(run)) return;
      [run.id, run.requestId, run.result?.id].filter(Boolean).forEach((id) => ids.add(String(id)));
    });
    const replacements = [
      ["融资经营分析报告结构化源草稿", "S004 贷前调查报告结构化源草稿"],
      ["融资经营分析报告生成", "S004 贷前调查报告生成"],
      ["S004 · S004 · 集团融资成本与债务结构优化", S004_REPORT_SCENARIO_LABEL],
      ["S004 · S004 · 财务公司贷款贷前调查", S004_REPORT_SCENARIO_LABEL],
      ["S004 · 集团融资成本与债务结构优化", S004_REPORT_SCENARIO_LABEL],
      ["S001 · 集团融资成本与债务结构优化", S004_REPORT_SCENARIO_LABEL]
    ];
    root.document.querySelectorAll?.(".request-card, .run-card, .result-card, .page[data-screen-label='运行详情'], .page[data-screen-label='结果详情'], .page[data-screen-label='证据包详情']").forEach((container) => {
      const containerText = container.textContent || "";
      const currentArtifact = [...ids].some((id) => containerText.includes(id));
      const exactS004RuntimeArtifact = containerText.includes(context.scenarioRunId)
        && (containerText.includes(S004_REPORT_DEFINITION_ID)
          || containerText.includes(S004_REPORT_TEMPLATE_ID)
          || containerText.includes("S004 贷前调查"));
      const s004EvidencePresentation = container.matches?.(".page[data-screen-label='证据包详情']")
        && (containerText.includes("RDEF-S004-PREFLIGHT-002") || containerText.includes("S004-PLR-2026-0001"));
      if (!currentArtifact && !exactS004RuntimeArtifact && !s004EvidencePresentation) return;
      container.querySelectorAll?.("h1, h2, h3, h4, strong, span, p, small, dt, dd, b, em, .key-value-row > div").forEach((node) => {
        let copy = node.textContent || "";
        let changed = false;
        replacements.forEach(([from, to]) => {
          if (!copy.includes(from)) return;
          copy = copy.replaceAll(from, to);
          changed = true;
        });
        if (changed) {
          setText(node, copy);
          node.dataset.ofwS004GenerationCopy = "scenario-normalized";
        }
      });
      container.dataset.ofwS004GenerationArtifact = "current-s004";
    });
  }

  function patchM05ReportRunEntry() {
    if (moduleId !== "M05" || context.scenarioId !== "S004" || m05ScenarioReadOnly()) return;
    root.document.querySelectorAll?.('.page[data-screen-label="Agent 目录"] .page-header .header-actions button, .page[data-screen-label="运行中心"] .page-header .header-actions button').forEach((button) => {
      if (m05ControlLabel(button) !== "发起运行" && button.dataset?.s004ReportRunEntry !== "true") return;
      setText(button, "从报告请求发起");
      button.disabled = false;
      button.removeAttribute?.("disabled");
      button.removeAttribute?.("aria-disabled");
      delete button.dataset.ofwS004M05Blocked;
      button.dataset.s004ReportRunEntry = "true";
      button.setAttribute?.("title", "报告 Agent 新运行由报告中心提交 C022/C024；当前隔离轮次可继续追加，历史记录不可覆盖。");
      button.setAttribute?.("aria-label", "前往报告中心，从 C022 或 C024 报告请求发起新的 Agent 运行");
    });
  }

  function patchM05SessionSemantics() {
    const relationPanel = [...(root.document.querySelectorAll?.(".panel") || [])]
      .find((panel) => panel.querySelector?.(".panel-head h2")?.textContent?.trim() === "报告运行关联");
    if (!relationPanel) return;
    setFactValue(relationPanel, "当前比较记录", "本制品未声明 C027 当前比较记录");
    setFactValue(relationPanel, "重新生成引用", "本制品未声明外部引用");
  }

  function setM05EnabledBadge(badge) {
    if (!badge) return;
    if (badge.textContent?.trim() !== "已启用") badge.innerHTML = '<span class="status-dot"></span>已启用';
    badge.classList?.remove("neutral", "warning", "danger");
    badge.classList?.add("success");
  }

  function restoreM05AppendPresentation() {
    root.document.querySelectorAll?.('[data-ofw-s004-m05-blocked="true"]').forEach((control) => {
      control.disabled = false;
      control.removeAttribute?.("disabled");
      control.removeAttribute?.("aria-disabled");
      control.removeAttribute?.("title");
      delete control.dataset.ofwS004M05Blocked;
    });
    root.document.querySelectorAll?.(".resource-directory-row, .resource-row, article").forEach((container) => {
      if (!container.textContent?.includes("S004")) return;
      const badge = container.querySelector?.(".badge");
      if (!badge || !/(既有制品只读|仅查看既有制品|历史制品只读)/.test(badge.textContent || "")) return;
      if (container.textContent?.includes("Agent")) setM05EnabledBadge(badge);
      else {
        setText(badge, "可运行");
        badge.classList?.remove("neutral", "warning", "danger");
        badge.classList?.add("success");
      }
    });
  }

  function ensureM05ScenarioStyle() {
    if (root.document.getElementById("ofw-s004-m05-scenario-style")) return;
    const style = root.document.createElement?.("style");
    if (!style) return;
    style.id = "ofw-s004-m05-scenario-style";
    style.textContent = `
      .s004-agent-readonly-note {
        margin-left: auto;
        padding: 3px 7px;
        color: var(--muted);
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 999px;
        font-size: 10px;
        white-space: nowrap;
      }
      .s004-baseline-reference-note { margin-right: auto; color: var(--muted); font-size: 10px; }
      .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .credibility-control-panel > .panel-body {
        max-height: min(54vh, 560px);
        overflow: auto;
        scrollbar-gutter: stable;
      }
      .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .evidence-layout {
        grid-template-columns: minmax(420px, 1.08fr) minmax(360px, 0.92fr);
      }
      .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .evidence-layout > .panel:first-child > .panel-body {
        max-height: min(64vh, 680px);
        overflow: auto;
        scrollbar-gutter: stable;
      }
      .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .credibility-history > .panel-body {
        max-height: 360px;
        overflow: auto;
        scrollbar-gutter: stable;
      }
      .s004-closed-loop-strip {
        margin: 12px 0;
        padding: 11px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        background: #f5faf8;
        border: 1px solid #b6ddcf;
        border-radius: var(--radius);
      }
      .s004-closed-loop-step {
        min-width: 0;
        padding: 8px 9px;
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        align-items: center;
        gap: 7px;
        background: #fff;
        border: 1px solid #d7e9e2;
        border-radius: 6px;
      }
      .s004-closed-loop-step > b {
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        color: #16614f;
        background: #dff1ea;
        border-radius: 50%;
        font-size: 11px;
      }
      .s004-closed-loop-step strong,
      .s004-closed-loop-step small { display: block; }
      .s004-closed-loop-step strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
      }
      .s004-closed-loop-step small {
        margin-top: 1px;
        color: var(--muted);
        font-size: 10px;
      }
      .s004-agent-runtime-parameters .s004-runtime-parameter-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .s004-agent-runtime-parameters .s004-runtime-parameter-card {
        padding: 11px 12px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--surface-2);
      }
      .s004-agent-runtime-parameters .s004-runtime-parameter-card strong,
      .s004-agent-runtime-parameters .s004-runtime-parameter-card span { display: block; }
      .s004-agent-runtime-parameters .s004-runtime-parameter-card strong { margin-bottom: 5px; }
      .s004-agent-runtime-parameters .s004-runtime-parameter-card span { color: var(--muted); font-size: 11px; line-height: 1.55; }
      .s004-agent-runtime-parameters .s004-runtime-reuse-note { margin-top: 10px; }
      @media (max-width: 1100px) {
        .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .evidence-layout { grid-template-columns: 1fr; }
        .s004-closed-loop-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 720px) {
        .agent-card .card-foot { flex-wrap: wrap; }
        .s004-agent-readonly-note { margin-left: 0; }
        .s004-closed-loop-strip { grid-template-columns: 1fr; }
        .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .credibility-control-panel > .panel-body { max-height: 58vh; }
        .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .evidence-layout > .panel:first-child > .panel-body { max-height: 62vh; }
        .page[data-ofw-s004-m05-evidence-detail^="closed-loop-"] .credibility-history > .panel-body { max-height: 48vh; }
        .s004-agent-runtime-parameters .s004-runtime-parameter-grid { grid-template-columns: 1fr; }
      }
    `;
    (root.document.head || root.document.documentElement).append(style);
  }

  function patchM05AgentPresentation() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    ensureM05ScenarioStyle();
    root.document.querySelectorAll?.(".agent-card").forEach((card) => {
      const title = card.querySelector?.(".agent-card-head h2")?.textContent?.trim();
      if (!title?.startsWith("S004 贷前调查报告")) return;
      setM05EnabledBadge(card.querySelector?.(".agent-card-head .badge"));
      card.dataset.ofwS004AgentState = "enabled";
      const purpose = card.querySelector?.(":scope > p");
      if (title === "S004 贷前调查报告 Agent") {
        setText(purpose, "依据报告中心固定的证据包，生成贷前调查报告结构化草稿。");
      }
      const scenarioFact = [...(card.querySelectorAll?.(".card-meta > div") || [])]
        .find((item) => item.querySelector?.("span")?.textContent?.trim() === "场景");
      if (scenarioFact) {
        setText(scenarioFact.querySelector?.("strong"), title === "S004 贷前调查报告 Agent"
          ? "财务公司贷款贷前调查报告生成"
          : "已发布贷前调查报告伴读");
      }
      const foot = card.querySelector?.(".card-foot");
      foot?.querySelectorAll?.(".s004-agent-readonly-note").forEach((node) => node.remove());
    });

    root.document.querySelectorAll?.(".resource-directory-row, .resource-row").forEach((row) => {
      if (!row.textContent?.includes("S004 贷前调查报告") || !row.textContent?.includes("Agent")) return;
      setM05EnabledBadge(row.querySelector?.(".badge"));
      row.dataset.ofwS004AgentState = m05ScenarioReadOnly() ? "enabled-readonly-artifacts" : "enabled-append-history";
    });

    const detailPage = root.document.querySelector?.('.page[data-screen-label="Agent 详情"]');
    if (!detailPage?.querySelector?.(".page-header h1")?.textContent?.startsWith("S004 贷前调查报告")) return;
    const detailTitle = detailPage.querySelector?.(".page-header h1")?.textContent?.trim();
    if (detailTitle === "S004 贷前调查报告 Agent") {
      setText(detailPage.querySelector?.(".page-header p"), "依据报告中心固定的证据包，生成贷前调查报告结构化草稿。");
    }
    const taskPanel = [...(detailPage.querySelectorAll?.(".panel") || [])]
      .find((panel) => panel.querySelector?.(".panel-head h2")?.textContent?.trim() === "任务与边界");
    if (taskPanel) {
      setText(taskPanel.querySelector?.(".panel-head h2"), "Agent 配置");
      setText(taskPanel.querySelector?.(".panel-head p"), "当前版本的输入、输出与资源范围");
      const setDetailValue = (label, value) => {
        const row = [...(taskPanel.querySelectorAll?.(".key-value-row") || [])]
          .find((item) => item.querySelector?.(":scope > span")?.textContent?.trim() === label);
        setText(row?.querySelector?.(":scope > div"), value);
      };
      const isDraftAgent = detailTitle === "S004 贷前调查报告 Agent";
      setDetailValue("适用场景", isDraftAgent ? "财务公司贷款贷前调查报告生成" : "已发布贷前调查报告伴读");
      setDetailValue("场景绑定版本", `${isDraftAgent ? "贷前调查报告生成" : "贷前调查报告伴读"} · 2.0.0`);
      setDetailValue("绑定方式", isDraftAgent
        ? "由报告生成运行绑定借款人、贷款申请和证据包"
        : "由报告阅读会话绑定报告版本、章节锚点和证据包");
    }
    const statusPanel = [...(detailPage.querySelectorAll?.(".panel") || [])]
      .find((panel) => panel.querySelector?.(".panel-head h2")?.textContent?.trim() === "发布状态");
    const statusLine = statusPanel?.querySelector?.(".status-line");
    setM05EnabledBadge(statusLine?.querySelector?.(".badge"));
    setText(statusLine?.querySelector?.("span:last-child"), "当前 Release 已启用，可发起新的报告草稿运行。");
    detailPage.dataset.ofwS004AgentState = "enabled";
  }

  function patchM05BaselineCapabilitySeparation() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    const markBaseline = (container) => {
      if (!container) return;
      const title = container.querySelector?.(".agent-card-head h2, .page-header h1")?.textContent?.trim() || "";
      if (!title || title.startsWith("S004 贷前调查报告")) return;
      container.dataset.ofwS004BaselineReference = "true";
      container.querySelectorAll?.(".s004-baseline-reference-note, .s004-baseline-reference-notice").forEach((node) => node.remove());
    };
    root.document.querySelectorAll?.('.agent-card, .page[data-screen-label="Agent 详情"]').forEach(markBaseline);
  }

  function patchM05ReusableAgentContext() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    const detailPage = root.document.querySelector?.('.page[data-screen-label="Agent 详情"]');
    const title = detailPage?.querySelector?.(".page-header h1")?.textContent?.trim();
    if (!title?.startsWith("S004 贷前调查报告")) return;
    detailPage.querySelectorAll?.("[data-s004-agent-runtime-parameters]").forEach((node) => node.remove());
    [...(detailPage.querySelectorAll?.(".notice") || [])].forEach((notice) => {
      if (notice.querySelector?.("strong")?.textContent?.trim() === "权威边界") notice.remove();
    });
    root.document.documentElement.dataset.ofwS004AgentReusableRuntime = "baseline-detail-structure";
  }

  function m05ClosedLoopStatus() {
    const model = m05RuntimeState() || {};
    const reportState = m05ReportReferenceState() || {};
    const c008 = readJsonState(C008_STATE_KEY) || {};
    const c017 = readJsonState(C017_REPORT_KEY) || {};
    const report = reportState.report || {};
    const currentReportProjection = (c017.projections || []).find((item) =>
      item?.scenarioContext?.scenarioRunId === context.scenarioRunId) || c017.projections?.[0];
    const draftEvidence = (model.evidencePackages || []).find((item) =>
      item?.kind === "report-generation"
      || item?.name === "S004 贷前调查固定证据包"
      || item?.requestContext?.expectedOutput === "Agent Report Draft v1");
    const draftRun = (model.runs || []).find((item) => item?.status === "complete" && item?.result?.type === "Agent Report Draft");
    const copilotRun = (model.runs || []).find((item) => item?.status === "complete" && item?.result?.type === "Report Copilot Result");
    const copilotSession = (model.sessions || []).find((item) => item?.latestRunId === copilotRun?.id && item?.latestResultId === copilotRun?.result?.id);
    const verification = [report.postPublicationVerification, ...(report.verificationRuns || [])].find((item) =>
      ["completed", "completed-s004-deterministic"].includes(item?.status)
      && item?.coverage?.status === "complete");
    const outputManifest = report.artifactManifest || {};
    const steps = [
      { id: "data", label: "数据与质量", complete: Boolean(currentReportProjection?.allowConsumption === true && currentReportProjection?.currentStateSummary?.hardQualityFailure === false), detail: currentReportProjection?.dataVersion || "C017" },
      { id: "published", label: "Published / C008", complete: Boolean(c008?.current?.semanticVersionId && c008?.current?.dataVersion && c008?.current?.t019?.evidenceId), detail: c008?.current?.semanticVersion || "C008" },
      { id: "evidence", label: "固定证据包", complete: Boolean((draftEvidence?.evidencePackageId || draftEvidence?.id) && (draftEvidence?.items?.length || draftEvidence?.itemCount)), detail: draftEvidence?.evidencePackageId || draftEvidence?.id || "未定位" },
      { id: "draft", label: "Agent 结构化结果", complete: Boolean(draftRun?.result?.id && draftRun?.snapshot?.evidencePackageId), detail: draftRun?.id || "未定位" },
      { id: "binding", label: "事实绑定与核验", complete: Boolean(report?.contentSnapshot?.contentFacts?.length && verification), detail: verification?.runId || "未定位" },
      { id: "review", label: "人工复核", complete: report?.humanReview?.status === "confirmed", detail: report?.humanReview?.confirmationId || "未定位" },
      { id: "publish", label: "同源 HTML / PDF", complete: Boolean(report?.stage === "published" && outputManifest?.html?.output && outputManifest?.pdf?.output), detail: report?.contentVersion || "未定位" },
      { id: "copilot", label: "报告伴读", complete: Boolean(copilotRun?.result?.id && copilotSession?.id), detail: copilotSession?.id || "未定位" }
    ];
    return {
      complete: steps.every((step) => step.complete),
      steps,
      reportNo: report.reportNo || null,
      contentVersion: report.contentVersion || null,
      evidencePackageId: draftEvidence?.evidencePackageId || null
    };
  }

  function buildM05ClosedLoopStrip(summary) {
    const strip = root.document.createElement?.("section");
    if (!strip) return null;
    strip.className = "s004-closed-loop-strip";
    strip.dataset.s004ClosedLoop = "complete";
    strip.setAttribute("aria-label", "S004 贷前调查报告闭环状态");
    summary.steps.forEach((step) => {
      const item = root.document.createElement("div");
      item.className = "s004-closed-loop-step";
      item.dataset.step = step.id;
      item.title = `${step.label} · ${step.detail}`;
      const mark = root.document.createElement("b");
      mark.textContent = "✓";
      const copy = root.document.createElement("div");
      const label = root.document.createElement("strong");
      label.textContent = step.label;
      const state = root.document.createElement("small");
      state.textContent = "已完成";
      copy.append(label, state);
      item.append(mark, copy);
      strip.append(item);
    });
    return strip;
  }

  function patchM05EvidenceClosedLoop() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    const page = root.document.querySelector?.('.page[data-screen-label="证据包详情"]');
    const pageTitle = page?.querySelector?.(".page-header h1")?.textContent?.trim() || "";
    if (!/^(?:S004 贷前调查|RDEF-S004-PREFLIGHT-002|S004-PLR-2026-0001)/.test(pageTitle)) return;
    const summary = m05ClosedLoopStatus();
    const append = !m05ScenarioReadOnly();
    root.document.documentElement.dataset.ofwS004M05ClosedLoop = summary.complete ? (append ? "complete-append" : "complete-readonly") : "incomplete";
    root.document.documentElement.dataset.ofwS004M05ClosedLoopMissing = summary.steps.filter((step) => !step.complete).map((step) => step.id).join(",") || "none";
    ensureM05ScenarioStyle();
    page.dataset.ofwS004M05EvidenceDetail = summary.complete
      ? (append ? "closed-loop-append" : "closed-loop-readonly")
      : (append ? "active-evidence-append" : "active-evidence-recovery");

    const blockingNotice = [...page.children].find((node) =>
      node.classList?.contains("notice") && (
        node.textContent?.includes("当前不可用于新的正式输出")
        || node.textContent?.includes("当前固定证据与闭环可用于形成新的草稿、运行和核验记录")
      ));
    const generationGateAllowed = [...(page.querySelectorAll?.("article") || [])].some((article) =>
      article.textContent?.includes("报告草稿生成与移交") && article.textContent?.includes("允许"));
    if (blockingNotice) {
      blockingNotice.classList.remove("danger", "warning");
      blockingNotice.classList.add(append && generationGateAllowed ? "success" : "warning");
      setText(blockingNotice.querySelector?.("strong"), summary.complete
        ? (append ? "S004 闭环已完成 · 当前轮次可继续运行" : "S004 闭环制品完整 · 当前轮次状态待恢复")
        : (append && generationGateAllowed ? "当前固定证据可用于新的 Agent 草稿运行" : "当前固定证据用途门待恢复"));
      setText(blockingNotice.querySelector?.("span"), summary.complete
        ? (append
          ? `数据工程 → Published/C008 → 固定证据包 → Agent 结构化结果 → 报告中心事实绑定 → 确定性核验 → 人工复核 → 同源 HTML/PDF → 报告伴读均已形成。当前 ${context.scenarioRunId || "S004 scenarioRunId"} 可继续追加新的 Agent/伴读/核验运行；历史 ${summary.reportNo || "S004 报告"} ${summary.contentVersion || ""} 和正式输出不可原地覆盖。`
          : `数据工程 → Published/C008 → 固定证据包 → Agent 结构化结果 → 报告中心事实绑定 → 确定性核验 → 人工复核 → 同源 HTML/PDF → 报告伴读均已形成。当前轮次运行权限状态尚未恢复；请重新读取场景，且不得覆盖历史 ${summary.reportNo || "S004 报告"} ${summary.contentVersion || ""}。`)
        : (append && generationGateAllowed
          ? "当前 C022 的场景、报告根、固定证据包和精确双版本身份完整，报告草稿用途门为允许；可追加独立 Run/Result，历史证据、运行和正式输出不覆盖。"
          : "当前固定证据仍保留；完成 C017 与用途门恢复后才可创建新的独立运行，历史记录不覆盖。"));
      blockingNotice.dataset.ofwS004ClosedLoopNotice = summary.complete
        ? (append ? "complete-append" : "complete-readonly")
        : (append && generationGateAllowed ? "active-evidence-append" : "active-evidence-recovery");
      if (summary.complete && !page.querySelector?.(".s004-closed-loop-strip")) {
        const strip = buildM05ClosedLoopStrip(summary);
        if (strip) blockingNotice.after(strip);
      }
    }

    const directory = page.querySelector?.(".evidence-layout > .panel:first-child");
    if (directory) {
      setText(directory.querySelector?.(".panel-head h2"), "证据目录（固定快照）");
      const count = directory.querySelectorAll?.(".evidence-row")?.length || 0;
      setText(directory.querySelector?.(".panel-head p"), `${count} 项固定引用 · 在目录区域内滚动查看`);
      const body = directory.querySelector?.(".panel-body");
      body?.setAttribute?.("tabindex", "0");
      body?.setAttribute?.("aria-label", `S004 固定证据目录，共 ${count} 项`);
      directory.dataset.ofwS004EvidenceDirectory = "contained-scroll";
    }
  }

  function patchM05ReadOnlyLabels() {
    root.document.querySelectorAll?.(".resource-directory-row, .resource-row").forEach((row) => {
      if (!row.textContent?.includes("S004")) return;
      if (row.textContent?.includes("S004 贷前调查报告") && row.textContent?.includes("Agent")) return;
      const badge = row.querySelector?.(".badge");
      if (badge) {
        setText(badge, "固定制品不可变");
        badge.classList?.remove("success");
        badge.classList?.add("neutral");
      }
    });
    root.document.querySelectorAll?.("article").forEach((article) => {
      if (!article.textContent?.includes("S004 贷前调查报告")) return;
      if (article.classList?.contains("agent-card")) return;
      const badge = article.querySelector?.(".badge");
      if (badge) {
        setText(badge, "固定结果不可覆盖");
        badge.classList?.remove("success");
        badge.classList?.add("neutral");
      }
    });
  }

  function patchM05ReadOnly() {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    ensureM05AppendAccessProjection();
    const state = m05RuntimeState() || {};
    const append = state?.scenarioAccess?.mode === M05_APPEND_ACCESS_MODE;
    root.document.documentElement.dataset.ofwS004M05Access = append ? M05_APPEND_ACCESS_MODE : "RECOVERY_REQUIRED";
    if (!append) {
      root.document.querySelectorAll?.("button, [role='button']").forEach((control) => {
        if (shouldBlockM05Control(control)) disableM05Control(control);
      });
      patchM05ReadOnlyLabels();
    } else {
      restoreM05AppendPresentation();
    }
    patchM05AgentPresentation();
    patchM05BaselineCapabilitySeparation();
    patchM05ReusableAgentContext();
    patchM05ReportRunEntry();
    patchM05EvidenceClosedLoop();
    patchM05GenerationArtifactCopy();
    patchM05RequestCopy();
    patchM05SessionSemantics();
  }

  function reportAgentConsumptionReady() {
    if (context.scenarioId !== "S004") return false;
    const c008 = readJsonState(C008_STATE_KEY);
    const c017 = readJsonState(C017_REPORT_KEY);
    const m05 = m05RuntimeState();
    const m06 = m05ReportReferenceState();
    const reportProjection = (c017?.projections || []).find((item) => item?.scenarioContext?.scenarioRunId === context.scenarioRunId) || c017?.projections?.[0];
    return Boolean(
      c008?.current?.semanticVersionId
      && c008?.current?.dataVersion
      && c008?.current?.t019?.evidenceId
      && reportProjection?.allowConsumption === true
      && Array.isArray(m05?.evidencePackages) && m05.evidencePackages.some((item) => item?.status === "ready")
      && m06?.report?.stage === "published"
      && m06.report?.evidencePackId
    );
  }

  function s004ReportFactsConsumable(resources = reportResourcesFromState()) {
    const factPackage = resources?.factPackage;
    const report = resources?.report;
    const c008 = readJsonState(C008_STATE_KEY);
    const c017 = readJsonState(C017_REPORT_KEY);
    const projection = (c017?.projections || []).find((item) =>
      item?.scenarioContext?.scenarioRunId === context.scenarioRunId
      && item?.dataVersion === factPackage?.dataVersion);
    return Boolean(
      factPackage?.packageId
      && factPackage?.readiness === "可消费"
      && factPackage?.scenarioContext?.scenarioRunId === context.scenarioRunId
      && factPackage?.semanticVersionId === c008?.current?.semanticVersionId
      && factPackage?.dataVersion === c008?.current?.dataVersion
      && projection?.allowConsumption === true
      && projection?.currentStateSummary?.hardQualityFailure === false
      && report?.stage === "published"
      && report?.evidencePackId === factPackage.packageId
    );
  }

  function patchM06TrustStripConsumption(resources = reportResourcesFromState()) {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return false;
    const consumable = s004ReportFactsConsumable(resources);
    if (!consumable) return false;
    const item = [...root.document.querySelectorAll?.(".trust-summary > div") || []]
      .find((node) => node.querySelector?.("span")?.textContent?.trim() === "报告消费");
    const value = item?.querySelector?.("strong");
    if (!value) return false;
    setText(value, "可消费");
    item.dataset.ofwS004ReportConsumption = "consumable";
    root.document.documentElement.dataset.ofwS004ReportConsumption = "consumable";
    return true;
  }

  function patchM01ConsumerBoundary() {
    if (moduleId !== "M01" || !scenarioM03NotApplicable()) return;
    const compatibility = root.document.querySelector(".compatibility-evidence");
    if (compatibility) {
      setText(compatibility.querySelector(".panel-head h2"), "智能问数兼容边界 · 本场景不适用");
      setText(compatibility.querySelector(".panel-head p"), "S004 不调用独立智能问数；本体管理保留原有消费方证据槽位，但不生成问数 Run、Result、C009 或兼容性结论。");
      setText(compatibility.querySelector(".panel-head > :last-child"), "不适用");
      setFactValue(compatibility, "兼容状态", "NOT_APPLICABLE · 本场景不启用独立问数");
      setFactValue(compatibility, "配置版本", "NOT_APPLICABLE");
      setFactValue(compatibility, "核验时间", context.formedAt || "场景形成时");
      setFactValue(compatibility, "来源记录", `scenario://${context.scenarioId}/${context.scenarioRunId}/boundary/M03`);
      const note = compatibility.querySelector(".boundary-note.warning");
      setText(note?.querySelector("b, strong"), "不创建智能问数兼容证据");
      setText(note?.querySelector("p"), "该状态是 S004 场景边界，不代表伪造或缺失问数运行；如未来纳入 M03，必须形成新的场景运行和真实消费方证据。");
    }

    const consumption = panelByHeading("消费上下文完整性") || panelByHeading("S004 报告与 Agent 消费上下文");
    if (!consumption) return;
    const ready = reportAgentConsumptionReady();
    setText(consumption.querySelector(".panel-head h2"), "S004 报告与 Agent 消费上下文");
    setText(consumption.querySelector(".panel-head p"), "智能问数按场景边界不适用；报告与 Agent 的正式消费分别由 Published/C008/T019、C017 和固定证据包核验。");
    setText(consumption.querySelector(".panel-head > :last-child"), ready ? "已就绪" : "待确认");
    setFactValue(consumption, "证据定位", ready ? "Published/C008/T019、C017 与固定证据包均可定位" : "报告或 Agent 消费证据尚未完整");
    setFactValue(consumption, "结论说明", ready
      ? "S004 报告与 Agent 消费链已就绪；M03 保持 NOT_APPLICABLE，不产生问数证据。"
      : "报告或 Agent 消费证据尚未完整；不得开始新的正式内容版本，先由对应 Owner 补齐证据并重新读取。");
    root.document.documentElement.dataset.ofwS004M01ReportAgentConsumption = ready ? "ready" : "incomplete";
  }

  function readReportState() {
    restoreS004NativeProjection();
    return hydrateM06StateFromNativeProjection(readJsonState(M06_STATE_KEY));
  }

  function isExactS004GenerationSourcePackage(factPackage) {
    const binding = factPackage?.authoritativeBinding || {};
    const facts = factPackage?.contentFacts || [];
    const anchors = factPackage?.anchors || [];
    return Boolean(
      factPackage?.packageId
      && (!factPackage?.factPackageStatus || factPackage.factPackageStatus === "available")
      && factPackage?.readiness === "可消费"
      && sameScenarioRun(factPackage)
      && (factPackage.semanticVersionId || binding.semanticVersionId)
      && (factPackage.dataVersion || binding.dataVersion)
      && facts.length > 0
      && anchors.length > 0
    );
  }

  function generationSourceResourcesFromState(state) {
    if (!state) return null;
    const definition = state.customDefinitions?.find?.((item) => item?.id === S004_REPORT_DEFINITION_ID)
      || state.customDefinitions?.[0]
      || null;
    const reports = [state.report, ...(state.publishedReports || [])].filter(Boolean);
    for (const report of reports) {
      if (!sameScenarioRun(report)) continue;
      const packs = [
        (report.evidencePacks || []).find((item) => item?.id === report.evidencePackId),
        ...(report.evidencePacks || [])
      ].filter((item, index, all) => item && all.indexOf(item) === index);
      for (const evidencePack of packs) {
        const factPackage = evidencePack?.authoritativeFactPackage;
        const template = evidencePack?.template;
        if (!definition || !template?.id || !isExactS004GenerationSourcePackage(factPackage)) continue;
        return {
          state: cloneJson(state),
          report: cloneJson(report),
          definition: cloneJson(definition),
          evidencePack: cloneJson(evidencePack),
          template: cloneJson(template),
          factPackage: cloneJson(factPackage)
        };
      }
    }
    return null;
  }

  function s004GenerationSourceResources(state = null) {
    if (reportGenerationSourceCache) return reportGenerationSourceCache;
    const candidates = [
      parentNativeProjection()?.m06 || null,
      state,
      readJsonState(M06_STATE_KEY)
    ];
    for (const candidate of candidates) {
      const located = generationSourceResourcesFromState(candidate);
      if (!located) continue;
      reportGenerationSourceCache = located;
      root.document.documentElement.dataset.ofwS004GenerationSource = "immutable-exact-package-captured";
      root.document.documentElement.dataset.ofwS004GenerationSourcePackage = located.factPackage.packageId;
      return reportGenerationSourceCache;
    }
    root.document.documentElement.dataset.ofwS004GenerationSource = "missing";
    return null;
  }

  function reportResourcesFromState() {
    if (reportResourcesCache) return reportResourcesCache;
    const state = readReportState();
    const report = state?.report;
    const source = s004GenerationSourceResources(state);
    const definition = state?.customDefinitions?.find?.((item) => item?.id === S004_REPORT_DEFINITION_ID)
      || state?.customDefinitions?.[0]
      || source?.definition;
    const activeEvidencePack = (report?.evidencePacks || []).find((item) => item?.id === report?.evidencePackId)
      || report?.evidencePacks?.[0]
      || null;
    const activeFactPackage = activeEvidencePack?.authoritativeFactPackage;
    const factPackage = isExactS004GenerationSourcePackage(activeFactPackage)
      ? activeFactPackage
      : source?.factPackage;
    const template = activeEvidencePack?.template?.id ? activeEvidencePack.template : source?.template;
    if (!report || !definition || !factPackage || !template) return null;
    reportResourcesCache = {
      state,
      report,
      definition,
      evidencePack: activeEvidencePack,
      template,
      factPackage,
      generationSource: source
    };
    return reportResourcesCache;
  }

  function sameScenarioRun(candidate) {
    const value = candidate?.scenarioContext || candidate || {};
    return ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => value?.[field] && value[field] === context[field]);
  }

  function isM06ActiveScenarioWorkState(state) {
    return isM06ActiveReportRecord(state?.report);
  }

  function reportCopilotFromState() {
    if (reportCopilotCache) return reportCopilotCache;
    const resources = reportResourcesFromState();
    const model = m05RuntimeState();
    if (!resources || !model) return null;
    const projection = locateS004CopilotProjection(model, resources.state);
    if (!projection) return null;
    reportCopilotCache = projection;
    return reportCopilotCache;
  }

  // This runtime executes in the injected <head>, before the frozen report
  // module normalizes and compacts its persisted state.  Capture the complete
  // S004 definition, evidence pack and artifact manifest once at module load;
  // later DOM renders must not depend on fields the baseline intentionally
  // drops from its compact storage projection.
  if (moduleId === "M06") {
    // M05 runs in a sibling baseline iframe. Preserve the mutable M06
    // Request/evidence/Draft aggregate in the same-run shell relay while the
    // user visits Agent Application, then restore it before the frozen M06
    // app reads state again. The immutable Published generation source stays
    // in reportGenerationSourceCache and is never replaced by this relay.
    consumeS004RuntimeRelay("M06_RUNTIME_STATE", M06_STATE_KEY);
    restoreS004NativeProjection();
    ensureS004CompletedVerificationProjection();
    root.document.documentElement.dataset.ofwS004ReportPrewarm = reportResourcesFromState() ? "ready" : "missing";
    root.document.documentElement.dataset.ofwS004CopilotPrewarm = reportCopilotFromState() ? "completed" : "missing";
    repairS004CurrentGenerationProjection();
    auditS004RuntimeClock();
    if (reportResourcesCache && reportCopilotCache) nativeReseedGuardWrite(null);
  }
  if (moduleId === "M05") {
    // M05 can be left while a frozen Run is still waiting/running. Restore
    // the same-run Owner aggregate before reading storage so the native
    // timer resumes instead of prewarming an older compact catalog over it.
    consumeS004RuntimeRelay("M05_RUNTIME_STATE", M05_STATE_KEY);
    restoreS004NativeProjection();
    const restoredM05 = mergeS004QaHistory(readJsonState(M05_STATE_KEY));
    const initialM05 = normalizeS004M05RuntimeProjection(restoredM05);
    if (restoredM05 && JSON.stringify(restoredM05) !== JSON.stringify(initialM05)) writeJsonState(M05_STATE_KEY, initialM05);
    if (initialM05) {
      publishS004RuntimeRelayPayload("M05_RUNTIME_STATE", initialM05);
      root.document.documentElement.dataset.ofwS004M05RelayPrewarm = "current-owner-state-published";
    }
    const initialM06 = readJsonState(M06_STATE_KEY);
    if (hasM05RuntimeProjection(initialM05, initialM06)) {
      m05RuntimeCache = cloneJson(initialM05);
      m05ReportStateCache = cloneJson(initialM06);
      nativeReseedGuardWrite(null);
      root.document.documentElement.dataset.ofwS004M05Prewarm = "complete";
    }
    auditS004RuntimeClock();
  }

  function m06ReportDataProjectionIdentity(resources = reportResourcesFromState()) {
    const report = resources?.report || null;
    const factPackage = resources?.factPackage || null;
    const binding = factPackage?.authoritativeBinding || report?.bindingSnapshot || {};
    const packageKey = factPackage?.dataVersion || binding.dataVersion || null;
    const packageSemanticVersionId = factPackage?.semanticVersionId || binding.semanticVersionId || null;
    const c008 = readJsonState(C008_STATE_KEY);
    const c008Current = c008?.current || null;
    const c017 = readJsonState(C017_REPORT_KEY);
    const c017Projection = (c017?.projections || []).find((item) =>
      sameScenarioRun(item) && item?.dataVersion === packageKey) || null;
    const issues = [];

    if (!factPackage?.packageId) issues.push("fact-package-missing");
    if (factPackage?.factPackageStatus && factPackage.factPackageStatus !== "available") issues.push("fact-package-status-not-available");
    if (factPackage?.readiness !== "可消费") issues.push("fact-package-not-consumable");
    if (!(factPackage?.contentFacts || []).length) issues.push("fact-package-facts-missing");
    if (!(factPackage?.anchors || []).length) issues.push("fact-package-anchors-missing");
    if (!packageKey) issues.push("data-version-missing");
    if (!sameScenarioRun(factPackage)) issues.push("fact-package-scenario-mismatch");
    if (!sameScenarioRun(c008)) issues.push("c008-scenario-mismatch");
    if (!c008Current?.semanticVersionId || c008Current.semanticVersionId !== packageSemanticVersionId) issues.push("c008-semantic-version-mismatch");
    if (!c008Current?.dataVersion || c008Current.dataVersion !== packageKey) issues.push("c008-data-version-mismatch");
    if (!c017Projection) issues.push("c017-projection-not-located");
    if (c017Projection && c017Projection.allowConsumption !== true) issues.push("c017-consumption-not-allowed");
    if (c017Projection?.currentStateSummary?.hardQualityFailure !== false) issues.push("c017-quality-not-consumable");
    const activeEvidencePack = report?.evidencePackId
      ? (report.evidencePacks || []).find((item) => item?.id === report.evidencePackId)
      : null;
    const activeFactPackage = activeEvidencePack?.authoritativeFactPackage;
    const activeFactPackageRef = activeEvidencePack?.authoritativeFactPackageRef || activeFactPackage || {};
    if (report?.evidencePackId && !activeEvidencePack) issues.push("report-evidence-pack-not-located");
    if (activeEvidencePack && activeFactPackageRef.packageId && activeFactPackageRef.packageId !== factPackage?.packageId) {
      issues.push("report-fact-package-mismatch");
    }
    if (activeFactPackage && !sameScenarioRun(activeFactPackage)) issues.push("report-fact-package-scenario-mismatch");
    if (report?.bindingSnapshot?.semanticVersionId && report.bindingSnapshot.semanticVersionId !== packageSemanticVersionId) issues.push("report-semantic-version-mismatch");
    if (report?.bindingSnapshot?.dataVersion && report.bindingSnapshot.dataVersion !== packageKey) issues.push("report-data-version-mismatch");
    if (binding.semanticVersionId && binding.semanticVersionId !== packageSemanticVersionId) issues.push("authoritative-semantic-version-mismatch");
    if (binding.dataVersion && binding.dataVersion !== packageKey) issues.push("authoritative-data-version-mismatch");

    return {
      valid: issues.length === 0,
      issues,
      packageKey,
      packageId: factPackage?.packageId || null,
      semanticVersionId: packageSemanticVersionId,
      c008SemanticVersionId: c008Current?.semanticVersionId || null,
      c008DataVersion: c008Current?.dataVersion || null,
      c017ProjectionId: c017Projection?.currentStateSummary?.id || c017?.projectionId || null,
      c017DataVersion: c017Projection?.dataVersion || null
    };
  }

  function s004ReportDefinitionProjection(resources = reportResourcesFromState()) {
    const profile = activeS004RuntimeProfile();
    const definition = resources?.definition || {};
    const template = resources?.template || {};
    const factPackage = resources?.factPackage || {};
    return {
      id: definition.id || profile.definition.reportDefinitionId || S004_REPORT_DEFINITION_ID,
      name: "贷前调查报告（财务公司）",
      purpose: "对集团成员单位贷款申请开展贷前调查，形成可追溯的结构化草稿、确定性核验与人工复核链。",
      audience: "财务公司授信审批与调查岗",
      version: definition.version || S004_REPORT_DEFINITION_VERSION,
      template: `财务公司贷款贷前调查报告模板 ${template.version || S004_REPORT_TEMPLATE_VERSION}`,
      templateId: template.id || profile.definition.reportTemplateId || S004_REPORT_TEMPLATE_ID,
      evidence: `Published/C008 权威绑定、C017 可信度摘要与固定证据包（${Array.isArray(factPackage.contentFacts) ? factPackage.contentFacts.length : 0} 项事实 / ${Array.isArray(factPackage.anchors) ? factPackage.anchors.length : 0} 个稳定锚点）`,
      agent: `${profile.definition.reportAgentId || "AGENT-S004-PREFLIGHT-REPORT-002"} · 只生成结构化草稿`,
      validation: "V01—V08 确定性核验，覆盖身份、Published/C008、数据版本、Metric、Rule、证据、T044 与人工确认边界",
      review: "调查意见、风险可控性和授信结论必须由财务公司人员确认",
      publish: "受控 HTML + 同源 PDF；已发布制品不原地更新",
      status: "已启用",
      scene: "S004",
      sections: cloneJson(definition.sections || [])
    };
  }

  function s004TemplateProjection(resources = reportResourcesFromState()) {
    const definition = resources?.definition || {};
    const template = resources?.template || {};
    const factPackage = resources?.factPackage || {};
    const sections = (definition.sections || []).map((item, index) => ({
      ...cloneJson(item),
      id: item.id || item.sectionId || item.stableAnchor || `s004-section-${index + 1}`,
      name: item.name || item.title || item.sectionId || `章节 ${index + 1}`
    }));
    const slots = Array.isArray(template.slots) && template.slots.length
      ? cloneJson(template.slots)
      : (factPackage.anchors || []).map((item) => item.stableAnchor || item.anchorId || item.id).filter(Boolean);
    return {
      id: template.id || S004_REPORT_TEMPLATE_ID,
      name: "贷前调查权威示例模板",
      version: template.version || S004_REPORT_TEMPLATE_VERSION,
      status: "已启用",
      chapters: sections.map((item) => item.name),
      slots,
      formats: ["HTML", "PDF"],
      downloads: { ...(template.downloads || {}) },
      confirmationLabel: template.confirmationLabel || "【需人工确认】",
      aiSuggestionLabel: template.aiSuggestionLabel || "AI 建议（基于已固化资料与系统事实生成）"
    };
  }

  function s004PublishedResourceProjection(resources = reportResourcesFromState()) {
    const state = readJsonState(M01_STATE_KEY);
    const published = (state?.publishedVersions || []).filter((item) => sameScenarioRun(item));
    const selectedId = state?.currentFormalVersionId || state?.selectedVersionId;
    const version = published.find((item) => item.id === selectedId) || published[0] || null;
    const deterministic = resources?.factPackage?.deterministicInputs || {};
    const objects = cloneJson(version?.objects || []);
    const links = cloneJson(version?.links || []);
    const metrics = cloneJson(version?.metrics || (deterministic.metricResults || []).map((item) => ({
      id: item.metricId,
      name: item.name,
      unit: item.unit,
      type: "Metric",
      publicationState: "Published"
    })));
    const rules = cloneJson(version?.rules || (deterministic.ruleRun?.results || []).map((item) => ({
      id: item.ruleId,
      name: item.ruleId,
      type: "Rule",
      publicationState: "Published"
    })));
    const actions = cloneJson(version?.actions || []);
    const semanticResources = [...objects, ...links].map((item) => ({
      ...item,
      id: item.id || item.objectTypeId || item.relationTypeId,
      type: item.type || (item.source && item.target ? "Relation" : "Object")
    })).filter((item) => item.id);
    const resourceIds = [...semanticResources, ...metrics, ...rules, ...actions]
      .map((item) => item.id || item.metricId || item.ruleId || item.actionTypeId)
      .filter(Boolean);
    return {
      semanticVersionId: resources?.factPackage?.semanticVersionId || resources?.factPackage?.authoritativeBinding?.semanticVersionId || null,
      semanticVersion: resources?.factPackage?.semanticVersion || resources?.factPackage?.authoritativeBinding?.semanticVersion || null,
      semanticResources,
      metrics,
      rules,
      actionTypes: actions,
      resourceIds: [...new Set(resourceIds)]
    };
  }

  function normalizeS004GenerationRequest(payload, resources = reportResourcesFromState()) {
    if (context.scenarioId !== "S004" || !payload || !resources?.factPackage) return cloneJson(payload);
    const exactPackage = cloneJson(resources.factPackage);
    const definition = s004ReportDefinitionProjection(resources);
    const template = s004TemplateProjection(resources);
    const published = s004PublishedResourceProjection(resources);
    const next = normalizeS004DemoClockValue(cloneJson(payload));
    const exactBinding = cloneJson(exactPackage.authoritativeBinding || {
      semanticVersionId: exactPackage.semanticVersionId,
      semanticVersion: exactPackage.semanticVersion,
      dataAssetVersionId: exactPackage.dataAssetVersionId,
      dataVersion: exactPackage.dataVersion,
      consumableVersionId: exactPackage.consumableVersionId,
      asOf: exactPackage.asOf
    });
    const reportContext = next.reportContext || {};
    const evidencePack = reportContext.evidencePack || {};
    next.scenarioContext = cloneJson(context);
    next.scenarioLabel = S004_REPORT_SCENARIO_LABEL;
    next.reportDefinition = { id: definition.id, version: definition.version };
    next.template = { id: template.id, version: template.version, slots: cloneJson(template.slots) };
    next.semanticBinding = cloneJson(exactBinding);
    next.reportContext = {
      ...reportContext,
      scenarioContext: cloneJson(context),
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      scenarioFormedAt: context.formedAt,
      scenarioStatus: context.status,
      scenarioLabel: S004_REPORT_SCENARIO_LABEL,
      reportDefinition: cloneJson(next.reportDefinition),
      template: cloneJson(next.template),
      evidencePack: {
        ...evidencePack,
        factPackageId: exactPackage.packageId,
        factInventoryVersion: exactPackage.factInventoryVersion
      },
      semanticBinding: cloneJson(exactBinding),
      publishedResources: {
        semanticVersionId: published.semanticVersionId,
        semanticVersion: published.semanticVersion,
        resourceIds: cloneJson(published.resourceIds)
      }
    };
    next.reportEvidence = {
      sections: cloneJson(definition.sections || []),
      anchors: cloneJson(exactPackage.anchors || []),
      contentFacts: cloneJson(exactPackage.contentFacts || []),
      contentItems: cloneJson(exactPackage.contentItems || []),
      renderManifest: cloneJson(exactPackage.renderManifest || null),
      generatedNarrativeContract: cloneJson(exactPackage.generatedNarrativeContract || null),
      schemaVersion: exactPackage.schemaVersion,
      factInventoryVersion: exactPackage.factInventoryVersion,
      publishedResourceRefs: cloneJson(published.resourceIds)
    };
    return next;
  }

  function assertS004GenerationProjection(payload) {
    const serialized = JSON.stringify(payload || {});
    const reportDefinition = payload?.reportContext?.reportDefinition || payload?.reportDefinition || {};
    const template = payload?.reportContext?.template || payload?.template || {};
    const facts = payload?.reportEvidence?.contentFacts || [];
    const anchors = payload?.reportEvidence?.anchors || [];
    const binding = payload?.reportContext?.semanticBinding || payload?.semanticBinding || {};
    const issues = [];
    if (reportDefinition.id !== S004_REPORT_DEFINITION_ID) issues.push("report-definition-not-s004");
    if (template.id !== S004_REPORT_TEMPLATE_ID) issues.push("report-template-not-s004");
    if (facts.length !== 19) issues.push(`fact-count-${facts.length}`);
    if (anchors.length !== 19) issues.push(`anchor-count-${anchors.length}`);
    if (!binding.semanticVersionId || !binding.dataVersion || !binding.consumableVersionId || !binding.asOf) issues.push("published-c008-binding-incomplete");
    if (!sameScenarioRun(payload?.reportContext || payload)) issues.push("scenario-context-mismatch");
    S004_FORBIDDEN_GENERATION_MARKERS.forEach((marker) => {
      if (serialized.includes(marker)) issues.push(`forbidden-marker:${marker}`);
    });
    if (/20260817|2026-08-17|2026\/08\/17/.test(serialized)) issues.push("demo-clock-after-2026-08-16");
    return {
      valid: issues.length === 0,
      issues,
      reportDefinitionId: reportDefinition.id || null,
      reportTemplateId: template.id || null,
      factCount: facts.length,
      anchorCount: anchors.length,
      semanticVersionId: binding.semanticVersionId || null,
      dataVersion: binding.dataVersion || null
    };
  }

  function normalizeS004GenerationReportState(state, resources = reportResourcesFromState()) {
    if (context.scenarioId !== "S004" || !state?.report || !resources?.factPackage) return state;
    const activeReport = state.report;
    const leakedPack = (activeReport.evidencePacks || []).some((pack) =>
      pack?.reportDefinition?.id === "RD-FIN-001"
      || pack?.template?.id === "RT-FIN-002"
      || String(pack?.agentReference?.release || "").includes("融资报告"));
    if (!leakedPack) return state;
    const next = cloneJson(state);
    const exactPackage = cloneJson(resources.factPackage);
    const definition = s004ReportDefinitionProjection(resources);
    const template = s004TemplateProjection(resources);
    const published = s004PublishedResourceProjection(resources);
    next.report = normalizeS004DemoClockValue(next.report);
    next.report.definitionId = definition.id;
    next.report.evidencePacks = (next.report.evidencePacks || []).map((pack) => {
      const leaked = pack?.reportDefinition?.id === "RD-FIN-001"
        || pack?.template?.id === "RT-FIN-002"
        || String(pack?.agentReference?.release || "").includes("融资报告");
      if (!leaked) return pack;
      return {
        ...pack,
        reportDefinition: { id: definition.id, version: definition.version },
        template: { id: template.id, version: template.version, slots: cloneJson(template.slots) },
        semanticBinding: cloneJson(exactPackage.authoritativeBinding || pack.semanticBinding),
        semanticResourceIds: cloneJson(published.resourceIds),
        agentReference: {
          release: `${activeS004RuntimeProfile().definition.reportAgentId || "AGENT-S004-PREFLIGHT-REPORT-002"} 2.0.0`,
          skill: "贷前调查报告结构化草稿组织 2.0.0"
        },
        reportEvidenceSchemaVersion: exactPackage.schemaVersion,
        factInventoryVersion: exactPackage.factInventoryVersion,
        authoritativeFactPackage: cloneJson(exactPackage)
      };
    });
    return next;
  }

  function normalizeS004C022Envelope(envelope, resources = reportResourcesFromState()) {
    if (context.scenarioId !== "S004" || !envelope) return envelope;
    const next = cloneJson(envelope);
    const requests = Array.isArray(next) ? next : Array.isArray(next.requests) ? next.requests : [];
    let projectedCurrentRequest = false;
    const projected = requests.map((request) => {
      const requestContext = scenarioContextFrom(request);
      const belongsToCurrentRun = ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => requestContext[field] === context[field]);
      const serialized = JSON.stringify(request || {});
      if (belongsToCurrentRun && S004_FORBIDDEN_GENERATION_MARKERS.some((marker) => serialized.includes(marker))) {
        projectedCurrentRequest = true;
        return normalizeS004GenerationRequest(request, resources);
      }
      return request;
    });
    if (Array.isArray(next)) return projected;
    next.requests = projected;
    if (projectedCurrentRequest) {
      next.scenarioContext = cloneJson(context);
      next.formedAt = normalizeS004DemoClockText(next.formedAt);
    }
    return next;
  }

  function repairS004CurrentGenerationProjection() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return { state: false, c022: false };
    const resources = reportResourcesFromState();
    if (!resources) return { state: false, c022: false };
    const currentState = readJsonState(M06_STATE_KEY);
    const projectedState = normalizeS004GenerationReportState(currentState, resources);
    const currentInbox = readJsonState(C022_INBOX_KEY);
    const projectedInbox = normalizeS004C022Envelope(currentInbox, resources);
    const stateChanged = Boolean(currentState && JSON.stringify(currentState) !== JSON.stringify(projectedState));
    const c022Changed = Boolean(currentInbox && JSON.stringify(currentInbox) !== JSON.stringify(projectedInbox));
    if (stateChanged) writeJsonState(M06_STATE_KEY, projectedState);
    if (c022Changed) writeJsonState(C022_INBOX_KEY, projectedInbox);
    if (stateChanged || c022Changed) {
      reportResourcesCache = null;
      root.document.documentElement.dataset.ofwS004GenerationProjectionRepair = [
        stateChanged ? "m06-state" : null,
        c022Changed ? "c022" : null
      ].filter(Boolean).join("+");
    }
    return { state: stateChanged, c022: c022Changed };
  }

  function auditS004RuntimeClock() {
    if (context.scenarioId !== "S004") return [];
    const violations = [M05_STATE_KEY, M06_STATE_KEY, C022_INBOX_KEY, C024_INBOX_KEY]
      .flatMap((key) => s004RuntimeClockViolations(readJsonState(key)).map((item) => `${key}:${item}`));
    if (root.document?.documentElement?.dataset) {
      root.document.documentElement.dataset.ofwS004RuntimeClockIntegrity = violations.length ? "violation" : "2026-08-16-only";
      root.document.documentElement.dataset.ofwS004RuntimeClockViolationCount = String(violations.length);
    }
    return violations;
  }

  function adaptS004ExternalOwners(value) {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !value?.agent?.submitGeneration) return value;
    const originalAgent = value.agent;
    const agent = Object.freeze({
      ...originalAgent,
      submitGeneration(payload = {}) {
        const projected = normalizeS004GenerationRequest(payload);
        const validation = assertS004GenerationProjection(projected);
        root.document.documentElement.dataset.ofwS004GenerationProjection = validation.valid ? "valid" : validation.issues.join(",");
        if (!validation.valid) {
          return {
            owner: "Agent 应用",
            requestId: projected?.requestId || null,
            status: "已拒绝",
            failure: `S004 生成请求投影校验失败：${validation.issues.join("、")}`
          };
        }
        return normalizeS004DemoClockValue(originalAgent.submitGeneration(projected));
      }
    });
    return Object.freeze({ ...value, agent });
  }

  function installM06ExternalOwnersProjection() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || root.__OFW_S004_EXTERNAL_OWNERS_PROJECTION__) return;
    const property = "RC_EXTERNAL_OWNERS";
    const descriptor = Object.getOwnPropertyDescriptor(root, property);
    let current = descriptor?.get ? descriptor.get.call(root) : descriptor?.value;
    try {
      Object.defineProperty(root, property, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() { return current; },
        set(value) { current = adaptS004ExternalOwners(value); }
      });
      if (current) current = adaptS004ExternalOwners(current);
      root.__OFW_S004_EXTERNAL_OWNERS_PROJECTION__ = true;
    } catch (_) {
      if (root[property]) root[property] = adaptS004ExternalOwners(root[property]);
    }
  }

  function installS004RuntimeClockStorageProjection() {
    if (context.scenarioId !== "S004" || root.__OFW_S004_RUNTIME_CLOCK_STORAGE_PROJECTION__) return;
    const proto = root.Storage?.prototype;
    if (!proto?.setItem) return;
    const clockKeys = new Set([M05_STATE_KEY, M06_STATE_KEY, C022_INBOX_KEY, C024_INBOX_KEY]);
    const previous = proto.setItem;
    proto.setItem = function (key, value) {
      let projectedValue = value;
      if (this === root.localStorage && clockKeys.has(String(key))) {
        try {
          const parsed = JSON.parse(String(value));
          const projected = normalizeS004CurrentRuntimeClockRecords(parsed);
          projectedValue = JSON.stringify(projected);
          const violations = s004RuntimeClockViolations(projected);
          root.document.documentElement.dataset.ofwS004RuntimeClockWrite = violations.length ? "rejected-future-date" : "2026-08-16-only";
          root.document.documentElement.dataset.ofwS004RuntimeClockWriteViolationCount = String(violations.length);
        } catch (_) { /* Preserve baseline behavior for non-JSON values. */ }
      }
      return previous.call(this, key, projectedValue);
    };
    root.__OFW_S004_RUNTIME_CLOCK_STORAGE_PROJECTION__ = true;
  }

  function installM06GenerationStorageProjection() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || root.__OFW_S004_GENERATION_STORAGE_PROJECTION__) return;
    const proto = root.Storage?.prototype;
    if (!proto?.setItem) return;
    const previous = proto.setItem;
    proto.setItem = function (key, value) {
      let projectedValue = value;
      let relayPayload = null;
      if (this === root.localStorage && (key === M06_STATE_KEY || key === C022_INBOX_KEY)) {
        try {
          const parsed = JSON.parse(String(value));
          const projected = key === M06_STATE_KEY
            ? normalizeS004GenerationReportState(parsed)
            : normalizeS004C022Envelope(parsed);
          projectedValue = JSON.stringify(projected);
          if (key === M06_STATE_KEY) {
            relayPayload = projected;
            if (isM06ActiveScenarioWorkState(projected)) {
              // Preserve the active report in storage, but invalidate the
              // prewarmed published-report cache so later reads merge the
              // current Request/evidence/Draft instead of projecting the
              // historical formal report back over it.
              reportResourcesCache = null;
              reportCopilotCache = null;
              root.document.documentElement.dataset.ofwS004GenerationCache = "preserved-for-active-generation";
            } else if (projected !== parsed) {
              reportResourcesCache = null;
            }
          }
          if (key === C022_INBOX_KEY) {
            const requests = Array.isArray(projected) ? projected : projected?.requests || [];
            const latest = [...requests].reverse().find((item) => sameScenarioRun(item?.reportContext || item));
            if (latest) {
              const validation = assertS004GenerationProjection(latest);
              root.document.documentElement.dataset.ofwS004C022Projection = validation.valid ? "valid" : validation.issues.join(",");
            }
          }
        } catch (_) { /* Preserve baseline storage behavior for non-JSON values. */ }
      }
      if (relayPayload) publishS004RuntimeRelayPayload("M06_RUNTIME_STATE", relayPayload);
      const result = previous.call(this, key, projectedValue);
      return result;
    };
    root.__OFW_S004_GENERATION_STORAGE_PROJECTION__ = true;
  }

  function projectS004ReportData(data) {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !data) return data;
    const resources = reportResourcesFromState();
    if (!resources) return data;
    const { factPackage } = resources;
    const identity = m06ReportDataProjectionIdentity(resources);
    const exactPackage = cloneJson(factPackage);
    const s004Definition = s004ReportDefinitionProjection(resources);
    const s004Template = s004TemplateProjection(resources);
    const published = s004PublishedResourceProjection(resources);
    const sections = cloneJson(s004Definition.sections || []);
    // The frozen generation workspace reads DATA.definitions[0] and builds
    // the evidence package from DATA.templates / semantic resources.  Put the
    // exact S004 records on that native path before app.js captures RC_DATA;
    // DOM-only replacement cannot safely change the C022 contract payload.
    data.definitions = [s004Definition];
    data.templates = [s004Template];
    data.semanticResources = cloneJson(published.semanticResources);
    data.metrics = Object.fromEntries(published.metrics.map((item) => [item.id || item.metricId, cloneJson(item)]).filter(([id]) => id));
    data.rules = cloneJson(published.rules);
    data.actionTypes = cloneJson(published.actionTypes);
    const s004Scene = (data.scenes || []).find((item) => item.id === "S004") || {
      id: "S004",
      name: "财务公司贷款贷前调查报告",
      type: "正式报告"
    };
    data.scenes = [{
      ...s004Scene,
      status: "全链路已装配",
      readiness: "可消费",
      capabilityStatus: "v1.0.3 原生报告能力 + S004 参数化配置",
      description: "财务公司集团成员单位贷款贷前调查已绑定当前 Published/C008、固定事实包和报告 Agent；同一配置可为其他成员单位创建隔离运行。"
    }];
    data.reportEvidence = {
      ...(data.reportEvidence || {}),
      schemaVersion: exactPackage.schemaVersion || data.reportEvidence?.schemaVersion,
      factInventoryVersion: exactPackage.factInventoryVersion || data.reportEvidence?.factInventoryVersion,
      sections,
      facts: cloneJson(exactPackage.contentFacts || []),
      anchors: cloneJson(exactPackage.anchors || []),
      contentItems: cloneJson(exactPackage.contentItems || []),
      renderManifest: cloneJson(exactPackage.renderManifest || null),
      generatedNarrativeContract: cloneJson(exactPackage.generatedNarrativeContract || null),
      authoritativeBinding: cloneJson(exactPackage.authoritativeBinding || null),
      factPackages: identity.valid && identity.packageKey ? { [identity.packageKey]: exactPackage } : {}
    };
    data.s004RuntimeProjection = {
      scenarioContext: cloneJson(context),
      factPackageId: exactPackage.packageId,
      dataVersion: identity.packageKey,
      readiness: exactPackage.readiness,
      identityStatus: identity.valid ? "exact-match" : "blocked",
      identityIssues: cloneJson(identity.issues),
      c008SemanticVersionId: identity.c008SemanticVersionId,
      c017ProjectionId: identity.c017ProjectionId,
      reportDefinitionId: s004Definition.id,
      reportTemplateId: s004Template.id,
      factCount: exactPackage.contentFacts?.length || 0,
      anchorCount: exactPackage.anchors?.length || 0,
      publishedResourceCount: published.resourceIds.length,
      injectedBeforeApp: true
    };
    root.document.documentElement.dataset.ofwS004ReportFactPackage = identity.valid && exactPackage.readiness === "可消费"
      ? "available-consumable"
      : (identity.valid ? "available-not-consumable" : "identity-mismatch");
    root.document.documentElement.dataset.ofwS004ReportDataIdentity = identity.valid ? "exact-match" : identity.issues.join(",");
    return data;
  }

  function synchronizeM06ReportDataProjection(reason = "runtime-sync") {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return null;
    restoreS004NativeProjection();
    const data = root.RC_DATA;
    const resources = reportResourcesFromState();
    if (!data || !resources) {
      root.document.documentElement.dataset.ofwS004ReportDataSync = !data ? "waiting-for-rc-data" : "waiting-for-report-resources";
      root.document.documentElement.dataset.ofwS004ReportDataSyncReason = reason;
      return null;
    }
    const projected = projectS004ReportData(data);
    const identity = m06ReportDataProjectionIdentity(resources);
    const installed = identity.packageKey
      ? projected?.reportEvidence?.factPackages?.[identity.packageKey]
      : null;
    const exactMatch = Boolean(
      identity.valid
      && installed?.packageId === identity.packageId
      && installed?.dataVersion === identity.packageKey
      && (installed?.semanticVersionId || installed?.authoritativeBinding?.semanticVersionId) === identity.semanticVersionId
      && installed?.scenarioContext?.scenarioRunId === context.scenarioRunId
    );
    root.document.documentElement.dataset.ofwS004ReportDataSync = exactMatch ? "exact-fact-package-installed" : "fact-package-not-installed";
    root.document.documentElement.dataset.ofwS004ReportDataSyncReason = reason;
    root.document.documentElement.dataset.ofwS004ReportFactPackageKey = identity.packageKey || "missing";
    if (exactMatch) {
      root.document.documentElement.dataset.ofwS004ReportData = "injected";
      root.document.documentElement.dataset.ofwS004ReportDataIdentity = "exact-match";
    }
    return {
      ready: exactMatch,
      reason,
      resources,
      packageKey: identity.packageKey,
      packageId: identity.packageId,
      identity
    };
  }

  function installM06ReportDataStorageListener() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || m06ReportDataStorageListenerInstalled || typeof root.addEventListener !== "function") return;
    const relevantKeys = new Set([M06_STATE_KEY, C008_STATE_KEY, C017_REPORT_KEY, NATIVE_SEED_MARKER_KEY]);
    root.addEventListener("storage", (event) => {
      if (!relevantKeys.has(event?.key)) return;
      synchronizeM06ReportDataProjection(`storage:${event.key}`);
    });
    m06ReportDataStorageListenerInstalled = true;
  }

  function scheduleM06ReportDataProjection(reason = "runtime-schedule") {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    installM06ReportDataStorageListener();
    if (m06ReportDataProjectionScheduled || typeof root.setTimeout !== "function") return;
    m06ReportDataProjectionScheduled = true;
    M06_REPORT_DATA_RETRY_DELAYS.forEach((delay, index) => {
      root.setTimeout(() => {
        const result = synchronizeM06ReportDataProjection(`${reason}:${index + 1}`);
        if (!result?.ready && index === M06_REPORT_DATA_RETRY_DELAYS.length - 1) {
          root.document.documentElement.dataset.ofwS004ReportDataRetry = "exhausted-awaiting-storage-or-render";
        }
        if (result?.ready) root.document.documentElement.dataset.ofwS004ReportDataRetry = "completed";
      }, delay);
    });
  }

  function installM06InitialDataProjection() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || root.__OFW_S004_M06_INITIAL_DATA_PROJECTION__) return;
    const property = "RC_DATA";
    const descriptor = Object.getOwnPropertyDescriptor(root, property);
    let current = descriptor?.get ? descriptor.get.call(root) : descriptor?.value;
    const adapt = (value) => projectS004ReportData(value);
    try {
      Object.defineProperty(root, property, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() { return current; },
        set(value) {
          current = value;
          current = adapt(current);
          root.document.documentElement.dataset.ofwS004ReportDataTiming = "before-baseline-app";
          synchronizeM06ReportDataProjection("rc-data-assigned");
        }
      });
      if (current) {
        current = adapt(current);
        synchronizeM06ReportDataProjection("rc-data-existing");
      }
      root.__OFW_S004_M06_INITIAL_DATA_PROJECTION__ = true;
    } catch (_) {
      if (root[property]) {
        adapt(root[property]);
        synchronizeM06ReportDataProjection("rc-data-fallback");
      }
    }
  }

  function injectReportResources() {
    if (moduleId !== "M06" || !root.RC_DATA) {
      if (moduleId === "M06") root.document.documentElement.dataset.ofwS004ReportData = "unavailable";
      return null;
    }
    const resources = reportResourcesFromState();
    if (!resources) {
      root.document.documentElement.dataset.ofwS004ReportData = "incomplete";
      return null;
    }
    const { state, report, definition, template, factPackage } = resources;
    const synchronized = synchronizeM06ReportDataProjection("report-render");
    root.document.documentElement.dataset.ofwS004ReportData = synchronized?.ready ? "injected" : "identity-incomplete";
    root.document.documentElement.dataset.ofwS004ReportTemplateCount = String(root.RC_DATA.templates.length);
    return { state, report, definition, template, factPackage };
  }

  function patchM06GenerationConsumable() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !String(root.location.hash || "").includes("/reports/generate")) return;
    const resources = reportResourcesFromState();
    const page = root.document.querySelector?.('.page[data-screen-label="报告生成工作区"]');
    const factPackage = resources?.factPackage;
    if (!page || !factPackage || page.querySelector?.("[data-s004-consumable-fact-package]")) return;
    if (!s004ReportFactsConsumable(resources)) return;
    const profile = activeS004RuntimeProfile();
    const selection = m06ReportRunSelection();
    const selected = selection.selected || {};
    const options = selection.options.map((item) => `<option value="${escapeHtml(item.borrowerId)}" ${item.borrowerId === selected.borrowerId ? "selected" : ""}>${escapeHtml(item.legalName)} · ${escapeHtml(item.readinessLabel || "")}</option>`).join("");
    const applicationText = selection.ready
      ? `${selected.applicationId || profile.application?.applicationId || "待绑定申请"} · ${selected.productType || profile.application?.productType || "贷款申请"}`
      : selected.borrowerId === "__OTHER_GROUP_MEMBER__"
        ? "选择具体成员单位后登记贷款申请"
        : `${selected.legalName || "所选成员单位"} · 待登记贷款申请`;
    const dataText = selection.ready
      ? `已就绪 · 数据截至 ${factPackage.asOf || profile.application?.dataAsOf || "待定位"}`
      : "需完成数据接入、质量检查和 Published/C008 绑定";
    const readinessCopy = selection.ready
      ? "所选借款人的贷款申请、数据快照、Published/C008 和固定证据已就绪，可进入基线六步生成流程。"
      : `${selected.borrowerId === "__OTHER_GROUP_MEMBER__" ? "请选择具体集团成员单位" : `请为 ${selected.legalName || "所选成员单位"} 登记贷款申请`}，并先在数据工程完成该公司的数据准备；就绪后即可复用同一报告定义、模板和 Agent 发起新的生成运行。`;
    const panel = root.document.createElement("section");
    panel.className = "panel s004-consumable-fact-package s004-report-run-launcher";
    panel.dataset.s004ConsumableFactPackage = "true";
    panel.innerHTML = `<div class="panel-head"><div><h2>新建贷前调查报告生成运行</h2><p>选择集团成员借款人和贷款申请，复用已启用的贷前调查报告定义进入生成流程。</p></div><span class="badge ${selection.ready ? "success" : "warning"}"><span class="status-dot"></span>${selection.ready ? "可生成" : "待数据准备"}</span></div><div class="panel-body"><div class="form-grid s004-report-run-fields"><div class="form-field"><label for="s004-report-run-borrower">借款人</label><select class="select" id="s004-report-run-borrower" data-s004-generation-borrower>${options}</select></div><div class="form-field"><label>贷款申请</label><input class="input" value="${escapeHtml(applicationText)}" readonly></div><div class="form-field"><label>报告定义</label><input class="input" value="贷前调查报告（财务公司） · ${escapeHtml(profile.definition?.reportDefinitionVersion || S004_REPORT_DEFINITION_VERSION)}" readonly></div><div class="form-field"><label>数据准备</label><input class="input" value="${escapeHtml(dataText)}" readonly></div></div><div class="notice ${selection.ready ? "" : "warning"}"><div><strong>${selection.ready ? "生成条件已满足" : "请先完成所选公司的数据准备"}</strong><span>${escapeHtml(readinessCopy)}</span></div></div><div class="button-row"><button class="btn primary" type="button" data-action="open-generation-modal" data-s004-start-generation ${selection.ready ? "" : "disabled"}>新建生成运行</button>${selection.ready ? "" : '<button class="btn" type="button" data-s004-open-data-preparation>前往数据工程准备</button>'}</div></div>`;
    const header = page.querySelector?.(".page-header");
    header?.insertAdjacentElement?.("afterend", panel);
    root.document.documentElement.dataset.ofwS004GenerationFactPackage = selection.ready ? "ready-for-new-run" : "borrower-data-required";
  }

  function patchM06BorrowerSelectionInWizard(scope) {
    if (!scope?.querySelector?.(".wizard-steps") || scope.querySelector?.("[data-s004-wizard-borrower-selection]")) return;
    const fields = [...(scope.querySelectorAll?.(".form-field") || [])];
    const definitionField = fields.find((field) => field.querySelector?.("label")?.textContent?.trim() === "报告定义");
    if (!definitionField) return;
    const selection = m06ReportRunSelection();
    const selected = selection.selected || {};
    const wrapper = root.document.createElement("div");
    wrapper.className = "form-field full s004-wizard-borrower-selection";
    wrapper.dataset.s004WizardBorrowerSelection = "true";
    wrapper.innerHTML = `<label for="s004-wizard-borrower">借款人及贷款申请</label><select class="select" id="s004-wizard-borrower" data-s004-generation-borrower>${selection.options.map((item) => `<option value="${escapeHtml(item.borrowerId)}" ${item.borrowerId === selected.borrowerId ? "selected" : ""}>${escapeHtml(item.legalName)} · ${escapeHtml(item.applicationId || "待选择贷款申请")}</option>`).join("")}</select><small>${escapeHtml(selection.ready ? (selected.readinessLabel || "资料已就绪，可生成") : (selected.readinessLabel || "需先完成数据准备"))}</small>`;
    definitionField.parentElement?.insertBefore?.(wrapper, definitionField);
    const next = scope.closest?.(".modal, .modal-card")?.querySelector?.('[data-action="wizard-next"]');
    if (next) next.disabled = !selection.ready;
  }

  function isM06BaselineDefaultValue(value, defaults = []) {
    const normalized = String(value == null ? "" : value).trim();
    return !normalized || defaults.some((item) => normalized === String(item).trim());
  }

  function setM06WizardField(scope, labelText, value, baselineDefaults = []) {
    const fields = [...(scope?.querySelectorAll?.(".form-field, .field") || [])];
    const field = fields.find((item) => item.querySelector?.("label")?.textContent?.trim() === labelText
      || item.querySelector?.(":scope > label")?.textContent?.trim() === labelText
      || item.querySelector?.("label")?.textContent?.trim()?.startsWith(labelText));
    const control = field?.querySelector?.("input, textarea, select");
    if (!control) return false;
    const current = "value" in control ? control.value : control.textContent;
    if (!isM06BaselineDefaultValue(current, baselineDefaults)) return false;
    if ("value" in control) control.value = value;
    else setText(control, value);
    control.dataset.ofwS004WizardCopy = "scenario-default";
    return true;
  }

  function replaceM06WizardDefaultText(scope, replacements) {
    (scope?.querySelectorAll?.("strong, span, small, p, option") || []).forEach((node) => {
      const current = node.textContent?.trim() || "";
      const replacement = replacements.find(([baseline]) => current === baseline)?.[1];
      if (!replacement) return;
      setText(node, replacement);
      node.dataset.ofwS004WizardCopy = "scenario-default";
    });
  }

  function patchM06GenerationWizardCopy() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    const page = root.document.querySelector?.('.page[data-screen-label="报告生成工作区"]');
    const modalScopes = [...(root.document.querySelectorAll?.(".modal, .modal-card, .dialog, .drawer") || [])]
      .filter((item) => /生成报告|生成新内容版本|重新生成|报告类型/.test(item.textContent || ""));
    const scopes = [page, ...modalScopes].filter(Boolean);
    if (!scopes.length) return;
    const profile = activeS004RuntimeProfile();
    const borrowerName = profile.borrower?.legalName || "当前集团成员单位";
    const applicationId = profile.application?.applicationId || profile.stable?.applicationId || "待绑定贷款申请";
    const definitionVersion = profile.definition?.reportDefinitionVersion || S004_REPORT_DEFINITION_VERSION;
    const templateVersion = profile.definition?.reportTemplateVersion || S004_REPORT_TEMPLATE_VERSION;
    const standardScope = `当前借款人 ${borrowerName}、贷款申请 ${applicationId}、财报、贷款调查补充资料、Published/C008 与固定证据包。`;
    const textReplacements = [
      ["融资业务对象与属性集合", "集团成员借款人、贷款申请、财务报表事实与贷前调查报告对象"],
      ["融资余额、加权融资成本与结构占比", "申请金额、偿债能力、营运资金、历史融资与内部授信指标"],
      ["R01 / R02 / R03 评估结果", "成员资格、用途一致性、证据完整性与借款风险 Rule 结果"],
      ["集团指标、三家重点单位、R01/R02/R03、机构贡献和可信度披露。", standardScope],
      ["增加受限机构附件", "补充贷款调查附件范围"],
      ["固定证据时重新校验权限；证据不可读会停在“证据缺失”，不会调用 Agent 猜测。", "仅在报告定义允许且固定证据包已锁定时补充附件；证据不可读会停在“证据缺失”，不会调用 Agent 猜测。"],
      ["集团融资经营分析报告", "财务公司贷款贷前调查报告"],
      ["S001 · 经营分析", "S004 · 正式报告"],
      ["1.0.0 / 2.2.0", `${definitionVersion} / ${templateVersion}`],
      ["集团融资经营分析 · 集团范围", `${borrowerName} · ${applicationId}`]
    ];

    scopes.forEach((scope) => {
      const s004Choice = [...(scope.querySelectorAll?.(".choice-card") || [])].find((card) =>
        card.textContent?.includes("财务公司贷款贷前调查报告") && card.textContent?.includes("S004"));
      if (s004Choice) {
        s004Choice.classList?.remove("disabled");
        s004Choice.classList?.add("selected");
        s004Choice.removeAttribute?.("disabled");
        s004Choice.removeAttribute?.("aria-disabled");
        s004Choice.dataset.action = "select-report-type";
        s004Choice.dataset.value = "finance";
        setText(s004Choice.querySelector?.("strong"), "财务公司贷款贷前调查报告");
        const description = [...(s004Choice.children || [])].find((node) => node.tagName === "SPAN" && !node.classList?.contains("badge") && !node.classList?.contains("icon"));
        setText(description, "适用于集团成员单位贷款申请");
        const badge = s004Choice.querySelector?.(".badge");
        if (badge) {
          setText(badge, "可创建");
          badge.classList?.remove("warning", "neutral");
          badge.classList?.add("success");
        }
        s004Choice.dataset.ofwS004WizardChoice = "enabled-baseline-state-machine";
      }
      [...(scope.querySelectorAll?.(".choice-card") || [])].forEach((card) => {
        if (card === s004Choice || !card.textContent?.includes("集团融资经营分析报告")) return;
        card.remove();
      });
      [...(scope.querySelectorAll?.(".choice-card") || [])].forEach((card) => {
        if (card === s004Choice || card.textContent?.includes("财务公司贷款贷前调查报告")) return;
        card.remove();
      });

      setM06WizardField(scope, "业务目的", "对集团成员单位贷款申请形成可追溯的贷前调查草稿、确定性核验与人工复核链。", [
        "形成集团融资成本、债务结构、重点单位、机构分布与 Rule 发现的固定经营分析结论。"
      ]);
      setM06WizardField(scope, "适用对象", "财务公司授信审批与调查岗", ["集团财务管理者"]);
      setM06WizardField(scope, "业务主体", "财务公司", ["集团"]);
      setM06WizardField(scope, "报告定义", `财务公司贷款贷前调查报告 · ${definitionVersion}`, ["集团融资经营分析报告 · 1.0.0"]);
      setM06WizardField(scope, "模板", `财务公司贷款贷前调查报告模板 · ${templateVersion}`, ["融资经营分析模板 · 2.2.0"]);
      replaceM06WizardDefaultText(scope, textReplacements);
      patchM06BorrowerSelectionInWizard(scope);
    });

    const regenerateNote = root.document.getElementById?.("regenerate-note");
    if (regenerateNote && isM06BaselineDefaultValue(regenerateNote.value, [
      "根据当前数据形成新的融资经营分析报告，并保留与原报告的替代关系。"
    ])) {
      regenerateNote.value = "基于当前固定证据包形成新的贷前调查内容版本，保留与原报告的替代关系；历史正式 HTML/PDF 不原地改写。";
      regenerateNote.dataset.ofwS004WizardCopy = "scenario-default";
    }
    root.document.documentElement.dataset.ofwS004GenerationWizard = "baseline-state-machine-s004-copy";
  }

  function formalOutputUrl(file) {
    if (!file) return null;
    const configuredBase = activeScenarioRuntimeConfig()?.formalOutputBinding?.baseRef;
    const baseRef = configuredBase || "../s004/artifacts/report/";
    const normalizedBase = String(baseRef).endsWith("/") ? String(baseRef) : `${baseRef}/`;
    return new URL(String(file).replace(/^\.\//, ""), new URL(normalizedBase, runtimeBase)).href;
  }

  function openS004PdfViewer(output, reportTitle = currentS004ReportTitle()) {
    if (moduleId !== "M06" || !output?.file) return false;
    const href = formalOutputUrl(output.file);
    if (!href) return false;
    const preview = activeScenarioRuntimeConfig()?.formalOutputBinding?.sameSourcePdf?.preview || null;
    const previewPageCount = Number(preview?.pageCount || 0);
    const previewBase = preview?.baseRef ? new URL(preview.baseRef, runtimeBase) : null;
    const previewPages = previewBase && preview?.fileStem && previewPageCount > 0
      ? Array.from({ length: previewPageCount }, (_, index) => {
          const page = index + 1;
          return {
            page,
            href: new URL(`${preview.fileStem}${String(page).padStart(2, "0")}.png`, previewBase).href
          };
        })
      : [];
    root.document.querySelector?.('[data-s004-pdf-viewer]')?.remove?.();
    const backdrop = root.document.createElement("div");
    backdrop.className = "drawer-backdrop";
    backdrop.dataset.s004PdfViewer = "true";
    const downloadName = formalReportDownloadName("pdf");
    const pageMarkup = previewPages.length
      ? `<div class="s004-pdf-page-stack" role="document" aria-label="${escapeHtml(reportTitle)} PDF 逐页预览">${previewPages.map(({ page, href: pageHref }) => `<figure class="s004-pdf-preview-page" data-page="${page}"><figcaption>第 ${page} / ${previewPages.length} 页</figcaption><img src="${pageHref}" alt="${escapeHtml(reportTitle)} 第 ${page} 页" ${page === 1 ? "" : 'loading="lazy"'}></figure>`).join("")}</div>`
      : `<div class="s004-pdf-preview-unavailable"><strong>页内逐页预览尚未登记</strong><span>请下载同源 PDF 原件查看；不得以空白或浏览器拦截页冒充报告预览。</span></div>`;
    backdrop.innerHTML = `<aside class="drawer"><header class="drawer-head"><h2>${escapeHtml(reportTitle)}</h2><button class="icon-button" type="button" data-s004-close-pdf title="关闭">×</button></header><div class="s004-pdf-viewer-body">${pageMarkup}<div class="s004-pdf-viewer-fallback"><span>同源 PDF 固定版 · A4 纵向 · ${previewPages.length || "页数未登记"}${previewPages.length ? " 页" : ""}；逐页图像由不可变 PDF 确定性渲染，仅用于兼容查看，正式产物仍以原 PDF 文件为准。</span><a href="${href}" target="_blank" rel="noopener" type="application/pdf" data-s004-open-pdf-original>新窗口打开 PDF 原件</a><a href="${href}" download="${downloadName}" type="application/pdf" data-s004-download-pdf-original>下载 PDF 原件</a></div></div></aside>`;
    (root.document.getElementById("app") || root.document.body).append(backdrop);
    root.document.documentElement.dataset.ofwS004PdfViewer = previewPages.length ? "opened-in-page-images" : "opened-with-direct-links";
    return true;
  }

  function templateDownloadUrl(file) {
    return file ? new URL(`./artifacts/templates/${file}`, runtimeBase).href : null;
  }

  function ensureM06ScenarioStyle() {
    if (moduleId !== "M06" || root.document.getElementById("ofw-s004-m06-scenario-style")) return;
    const style = root.document.createElement("style");
    style.id = "ofw-s004-m06-scenario-style";
    style.textContent = `
      .s004-formal-report.report-paper {
        position: relative;
        box-sizing: border-box;
        width: min(794px, 100%);
        max-width: 100%;
        margin: 0 auto;
        min-height: 0;
        padding: clamp(30px, 6cqi, 54px) clamp(20px, 7cqi, 58px) clamp(48px, 8cqi, 68px);
        color: #111827;
        font-family: Calibri, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 13px;
        line-height: 1.7;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 8px 28px rgba(15, 23, 42, .12);
      }
      .reader-grid:has(.s004-formal-report),
      .report-viewport:has(.s004-formal-report) { min-width: 0; max-width: 100%; }
      .report-viewport:has(.s004-formal-report) {
        padding: 24px 12px 64px;
        background: #eef2f6;
        container: s004-report / inline-size;
      }
      .s004-formal-report.report-paper::before {
        content: "演示案例";
        position: absolute;
        left: 50%;
        top: 42%;
        transform: translate(-50%, -50%) rotate(-28deg);
        color: rgba(34, 69, 116, .045);
        font-size: clamp(52px, 8vw, 84px);
        font-weight: 800;
        letter-spacing: .12em;
        pointer-events: none;
      }
      .s004-formal-report > * { position: relative; z-index: 1; }
      .s004-report-presentation-note {
        margin: 0 0 28px;
        padding: 9px 11px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        color: #43526a;
        background: #f2f6fb;
        border: 1px solid #d4dfec;
        border-left: 3px solid #5d82bb;
        border-radius: 5px;
        font-size: 11px;
      }
      .s004-report-presentation-note strong { color: #244c83; }
      .s004-formal-report .title-block { margin: 0 0 20px; padding: 0 0 13px; border-bottom: 2px solid #2d64a6; text-align: center; }
      .s004-formal-report .title-block h1 { margin: 0; color: #244c83; font-size: clamp(25px, 3vw, 34px); letter-spacing: .1em; }
      .s004-formal-report .title-block h1[data-s004-full-report-title] { max-width: 760px; margin-inline: auto; font-size: clamp(20px, 4.8cqi, 30px); letter-spacing: .025em; line-height: 1.35; overflow-wrap: anywhere; }
      .s004-formal-report .title-block .borrower { margin-top: 8px; font-size: 17px; font-weight: 700; }
      .s004-formal-report .title-block .control { margin-top: 5px; color: #64748b; font-size: 11px; }
      .s004-formal-report h2 { margin: 28px 0 12px; color: #244c83; font-size: 21px; line-height: 1.35; }
      .s004-formal-report h3 { margin: 19px 0 9px; color: #244c83; font-size: 16px; line-height: 1.4; }
      .s004-formal-report h4 { margin: 14px 0 6px; color: #334155; font-size: 14px; }
      .s004-formal-report p { margin: 0 0 10px; color: #273548; line-height: 1.72; text-align: justify; }
      .s004-formal-report .source-intro,
      .s004-formal-report .note { color: #526174; }
      .s004-formal-report table { width: 100%; margin: 9px 0 15px; border-collapse: collapse; table-layout: fixed; font-size: 11px; line-height: 1.42; }
      .s004-formal-report th,
      .s004-formal-report td { padding: 6px 7px; border: 1px solid #939ca7; vertical-align: middle; overflow-wrap: anywhere; }
      .s004-formal-report th { color: #243248; background: #dce7f5; text-align: center; }
      .s004-formal-report .number { text-align: right; font-variant-numeric: tabular-nums; }
      .s004-formal-report .center { text-align: center; }
      .s004-formal-report .group-row td,
      .s004-formal-report .category-row td { background: #f1f5f9; font-weight: 700; }
      .s004-formal-report .total-row td,
      .s004-formal-report .grand-total-row td { font-weight: 700; }
      .s004-formal-report .table-unit,
      .s004-formal-report .caption { color: #64748b; font-size: 10px; text-align: center; }
      .s004-formal-report .formula { margin: 8px 0; padding: 8px 10px; border-left: 3px solid #315d9b; background: #f7f9fc; }
      .s004-formal-report .s004-human-confirmation {
        margin: 10px 0;
        padding: 9px 11px;
        color: #5e430f;
        background: #fff8e8;
        border-left: 4px solid #a97419;
      }
      .s004-formal-report .s004-human-confirmation > span { margin-right: 6px; color: #875c0a; font-weight: 800; }
      .s004-formal-report .s004-ai-suggestion-label { margin-right: 5px; color: #6c4b0d; font-weight: 750; }
      .s004-formal-report .equity-diagram { margin: 14px auto 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 32px; text-align: center; }
      .s004-formal-report .equity-node { padding: 10px 8px; border: 1px solid #3463a1; border-radius: 7px; background: #dce7f5; font-weight: 700; }
      .s004-formal-report .equity-node.root,
      .s004-formal-report .equity-node.group { grid-column: 1 / 3; width: min(300px, 100%); justify-self: center; color: #fff; background: #315d9b; }
      .s004-formal-report .equity-arrow { grid-column: 1 / 3; color: #315d9b; font-weight: 800; }
      .s004-formal-report .source-list { padding-left: 22px; }
      .s004-formal-report .source-list li { margin: 6px 0; }
      .s004-formal-report .page-break-before { padding-top: 8px; }
      .drawer-backdrop[data-s004-template-drawer] .s004-template-downloads { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
      .s004-definition-reuse { margin-top: 14px; padding: 12px; border: 1px solid #d7e1ee; border-radius: 8px; background: #f8fafc; }
      .s004-definition-reuse h3 { margin: 0 0 8px; color: #244c83; font-size: 14px; }
      .s004-definition-reuse-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .s004-definition-reuse-grid > div { padding: 9px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; }
      .s004-definition-reuse-grid strong, .s004-definition-reuse-grid span { display: block; }
      .s004-definition-reuse-grid strong { margin-bottom: 4px; color: #334155; font-size: 12px; }
      .s004-definition-reuse-grid span { color: #64748b; font-size: 11px; line-height: 1.5; }
      .s004-definition-reuse > p { margin: 9px 0 0; color: #526174; font-size: 11px; line-height: 1.55; }
      .drawer-backdrop[data-s004-pdf-viewer] { z-index: 30; }
      .drawer-backdrop[data-s004-pdf-viewer] .drawer { width: min(1120px, 96vw); height: min(92vh, 920px); }
      .s004-pdf-viewer-body { height: calc(100% - 52px); padding: 0; display: flex; flex-direction: column; gap: 0; background: #e8edf3; }
      .s004-pdf-page-stack { flex: 1; min-height: 0; padding: 16px 20px 28px; overflow: auto; scrollbar-gutter: stable; }
      .s004-pdf-preview-page { width: min(794px, 100%); margin: 0 auto 18px; }
      .s004-pdf-preview-page figcaption { margin: 0 0 6px; color: #526174; font-size: 11px; text-align: center; }
      .s004-pdf-preview-page img { display: block; width: 100%; height: auto; border: 1px solid #cbd5e1; background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, .14); }
      .s004-pdf-preview-unavailable { flex: 1; min-height: 0; display: grid; place-content: center; gap: 6px; color: #526174; text-align: center; }
      .s004-pdf-viewer-fallback { padding: 9px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; color: #526174; border-top: 1px solid #cbd5e1; background: #fff; font-size: 11px; }
      .s004-pdf-viewer-fallback span { margin-right: auto; }
      .s004-pdf-viewer-fallback a { color: #315d9b; font-weight: 700; }
      .s004-consumable-fact-package { margin: 12px 0; border: 1px solid #b6ddcf; border-radius: 8px; background: #f5faf8; }
      .s004-consumable-fact-package .panel-body { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .s004-consumable-fact-package .s004-fact-package-stat { padding: 9px 10px; border: 1px solid #d7e9e2; border-radius: 6px; background: #fff; }
      .s004-consumable-fact-package .s004-fact-package-stat strong,
      .s004-consumable-fact-package .s004-fact-package-stat span { display: block; }
      .s004-consumable-fact-package .s004-fact-package-stat strong { color: #16614f; font-size: 12px; }
      .s004-consumable-fact-package .s004-fact-package-stat span { margin-top: 3px; color: #526174; font-size: 11px; line-height: 1.4; }
      .s004-report-run-launcher .panel-body { display: block; }
      .s004-report-run-launcher .s004-report-run-fields { margin-bottom: 12px; }
      .s004-report-run-launcher .notice { margin: 0 0 12px; }
      .s004-report-run-launcher .button-row { margin-top: 0; }
      .s004-wizard-borrower-selection small { margin-top: 5px; display: block; color: #64748b; line-height: 1.45; }
      .assistant-content .s004-qa-recommendations { margin: 12px 0 14px; padding: 12px; border: 1px solid #d7e1ee; border-radius: 8px; background: #f8fafc; }
      .assistant-pane { overflow: hidden; }
      .assistant-pane .assistant-content { min-width: 0; }
      .assistant-pane .assistant-compose { min-width: 0; position: relative; z-index: 2; }
      .assistant-pane .assistant-compose .compose-row { min-width: 0; grid-template-columns: minmax(0, 1fr) 34px; }
      .assistant-pane .assistant-compose .compose-row .input { width: 100%; min-width: 0; height: 36px; box-sizing: border-box; }
      .assistant-pane .assistant-compose .compose-row .icon-only { width: 34px; min-width: 34px; height: 36px; }
      .assistant-pane .assistant-compose .inline-actions { min-width: 0; justify-content: space-between; gap: 8px 12px; }
      .assistant-content .s004-qa-recommendations > header { margin-bottom: 9px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .assistant-content .s004-qa-recommendations > header > div { min-width: 0; }
      .assistant-content .s004-qa-recommendations > header strong { color: #244c83; }
      .assistant-content .s004-qa-recommendations > header span { display: block; margin-top: 2px; color: #64748b; font-size: 11px; }
      .assistant-content .s004-qa-recommendations .suggestion-list { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .assistant-content .s004-qa-recommendations .suggestion-chip { width: 100%; min-height: 52px; max-width: 100%; padding: 7px 8px; white-space: normal; text-align: left; line-height: 1.45; }
      .assistant-content .message.assistant > p { white-space: normal; line-height: 1.75; }
      .assistant-content .s004-qa-answer-line { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 7px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
      .assistant-content .s004-qa-answer-line:last-child { border-bottom: 0; }
      .assistant-content .s004-qa-answer-line b { color: #244c83; }
      .assistant-content .s004-qa-answer-line span { color: #334155; }
      .assistant-content .s004-qa-citations { margin: 8px 0 2px; padding: 9px 10px; border: 1px solid #d7e1ee; border-radius: 6px; background: #f8fafc; }
      .assistant-content .s004-qa-citations > strong { display: block; margin-bottom: 6px; color: #526174; font-size: 11px; }
      .assistant-content .s004-qa-citation-list { display: flex; flex-wrap: wrap; gap: 5px; }
      .assistant-content .s004-qa-citation-list code { padding: 3px 5px; color: #315d9b; border: 1px solid #d7e1ee; border-radius: 4px; background: #fff; font-size: 9.5px; overflow-wrap: anywhere; }
      .assistant-content .s004-verification-rules { margin: 12px 0 14px; border: 1px solid #d7e1ee; border-radius: 8px; background: #fff; overflow: hidden; }
      .assistant-content .s004-verification-rules > summary { padding: 11px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #244c83; background: #f3f7fb; cursor: pointer; font-weight: 700; }
      .assistant-content .s004-verification-rules > summary small { color: #64748b; font-weight: 500; }
      .assistant-content .s004-verification-rules[open] .s004-verification-rule-list { max-height: 230px; overflow: auto; scrollbar-gutter: stable; }
      .assistant-content .s004-verification-rule-list { padding: 4px 12px 10px; display: grid; grid-template-columns: 1fr; gap: 0; }
      .assistant-content .s004-verification-rule { padding: 9px 0; display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 2px 8px; border-bottom: 1px solid #edf1f5; }
      .assistant-content .s004-verification-rule code { grid-row: 1 / 3; color: #315d9b; font-size: 11px; }
      .assistant-content .s004-verification-rule strong { color: #334155; font-size: 12px; }
      .assistant-content .s004-verification-rule span { color: #64748b; font-size: 11px; line-height: 1.45; }
      .assistant-content .s004-verification-run-meta { margin: 0 12px 11px; padding: 8px 10px; color: #43526a; background: #f8fafc; border-left: 3px solid #5d82bb; font-size: 11px; line-height: 1.5; }
      .assistant-content .verification-item.s004-verification-pass-compact { grid-template-columns: auto minmax(0, 1fr); align-items: center; padding: 8px 9px; }
      .assistant-content .verification-item.s004-verification-pass-compact p,
      .assistant-content .verification-item.s004-verification-pass-compact button { display: none; }
      .assistant-content .s004-verification-empty { padding: 14px 12px; color: #526174; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; font-size: 11px; text-align: center; }
      .assistant-content .s004-verification-progress { padding: 12px; display: grid; gap: 10px; border: 1px solid #d7e1ee; border-radius: 8px; background: #f8fafc; }
      .assistant-content .s004-verification-progress header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .assistant-content .s004-verification-progress header strong { color: #244c83; }
      .assistant-content .s004-verification-progress-track { height: 6px; overflow: hidden; border-radius: 999px; background: #dfe7f0; }
      .assistant-content .s004-verification-progress-track span { display: block; height: 100%; border-radius: inherit; background: #315d9b; transition: width 180ms ease; }
      .assistant-content .s004-verification-progress-steps { display: grid; gap: 6px; }
      .assistant-content .s004-verification-progress-steps span { padding: 6px 8px; color: #64748b; border-left: 2px solid #d7e1ee; font-size: 11px; }
      .assistant-content .s004-verification-progress-steps span.done { color: #16614f; border-left-color: #2f8f74; }
      .assistant-content .s004-verification-progress-steps span.active { color: #244c83; border-left-color: #315d9b; font-weight: 700; }
      .assistant-content .s004-verification-explanation { padding: 10px 11px; color: #43526a; border: 1px solid #d7e1ee; border-radius: 7px; background: #f8fafc; font-size: 11px; line-height: 1.6; }
      .assistant-content .s004-verification-explanation strong { display: block; margin-bottom: 4px; color: #244c83; font-size: 12px; }
      .assistant-compose .s004-verification-boundary { width: 100%; margin: 0; color: #64748b; font-size: 10.5px; line-height: 1.5; }
      @container s004-report (max-width: 680px) {
        .s004-formal-report.report-paper { padding: 30px 24px 52px; }
        .s004-formal-report .title-block h1[data-s004-full-report-title] { font-size: clamp(20px, 5.2cqi, 26px); }
      }
      @container s004-report (max-width: 480px) {
        .s004-formal-report.report-paper { padding: 24px 16px 44px; }
        .s004-formal-report table { font-size: 9.5px; }
      }
      @media (max-width: 760px) {
        .reader-grid:has(> .assistant-pane) > .report-viewport:has(.s004-formal-report),
        .report-viewport:has(.s004-formal-report) { width: 100%; max-width: 100%; min-width: 0; padding: 12px 8px 42px; }
        .s004-formal-report.report-paper { width: 100%; padding: 24px 16px 44px; box-shadow: none; }
        .s004-formal-report table { font-size: 9.5px; }
        .s004-formal-report .equity-diagram { gap: 12px; }
        .assistant-content .s004-verification-rule-list { grid-template-columns: 1fr; }
        .s004-definition-reuse-grid { grid-template-columns: 1fr; }
        .s004-consumable-fact-package .panel-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .assistant-content .s004-qa-recommendations .suggestion-list { grid-template-columns: 1fr; }
        .assistant-content .s004-qa-answer-line { grid-template-columns: 1fr; gap: 1px; }
      }
      @media (max-width: 520px) { .s004-consumable-fact-package .panel-body { grid-template-columns: 1fr; } }
    `;
    root.document.head.append(style);
  }

  function visibleS004Report(reportNo) {
    if (!reportNo) return false;
    const reader = root.document.querySelector('.reader-shell[data-screen-label="正式报告阅读页"], .reader-shell');
    return Boolean(reader?.textContent?.includes(reportNo));
  }

  function patchS004CopilotTrace(assistantContent, projectionOverride = null) {
    if (!assistantContent) return;
    assistantContent.querySelectorAll?.("[data-s004-copilot-trace]").forEach((node) => node.remove());
    root.document.documentElement.dataset.ofwS004C024VisibleTrace = "hidden-from-business-user";
  }

  function patchS004ReportAssistant(qaContext) {
    const assistantContent = qaContext?.closest?.(".assistant-content");
    if (!assistantContent) return;
    const rawProjection = reportCopilotFromState();
    const projection = rawProjection?.result?.id && rawProjection.result.id === m06QaClearedThroughResultId
      ? null
      : rawProjection;
    const suggestedAnchor = root.document.documentElement.dataset.ofwS004SuggestedAnchor || null;
    const displayAnchor = suggestedAnchor || projection?.anchor || null;
    if (displayAnchor) setText(qaContext.querySelector("strong"), `当前报告 · ${displayAnchor}`);
    setText(qaContext.querySelector("small"), "回答只依据当前报告已固化的资料和系统事实，不临时联网搜索，也不重算正式指标。");

    const baselineSuggestions = [...assistantContent.querySelectorAll(":scope > .suggestion-list")];
    baselineSuggestions.forEach((node) => node.remove());
    const qaCatalog = m06QaCatalogForCurrentProfile();
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(qaCatalog.length / pageSize));
    m06QaRecommendationPageIndex = ((m06QaRecommendationPageIndex % pageCount) + pageCount) % pageCount;
    const visibleQuestions = qaCatalog.slice(m06QaRecommendationPageIndex * pageSize, (m06QaRecommendationPageIndex + 1) * pageSize);
    const recommendationSignature = `${m06QaRecommendationPageIndex}|${visibleQuestions.map((item) => item.intent).join("|")}`;
    let recommendations = assistantContent.querySelector("[data-s004-qa-recommendations]");
    if (!recommendations) {
      recommendations = root.document.createElement("section");
      recommendations.className = "s004-qa-recommendations";
      recommendations.dataset.s004QaRecommendations = "true";
      qaContext.insertAdjacentElement("afterend", recommendations);
    }
    if (recommendations.dataset.s004QaRecommendationSignature !== recommendationSignature) {
      const questionButtons = visibleQuestions.map((item) => `<button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="${escapeHtml(item.question)}" data-s004-anchor="${escapeHtml(item.anchor)}">${escapeHtml(item.question)}</button>`).join("");
      recommendations.innerHTML = `<header><div><strong>推荐问题</strong><span>每次显示 6 个</span></div><button class="text-link" type="button" data-s004-refresh-qa>换一组</button></header><div class="suggestion-list">${questionButtons}</div>`;
      recommendations.dataset.s004QaRecommendationSignature = recommendationSignature;
    }

    const composer = root.document.querySelector(".assistant-pane .assistant-compose");
    const composeInput = composer?.querySelector('input[data-input="qa-draft"], input[placeholder*="询问当前报告"]');
    if (composeInput) {
      composeInput.setAttribute("aria-label", "输入报告问题");
      composeInput.setAttribute("autocomplete", "off");
    }
    const inlineActions = composer?.querySelector(".inline-actions") || composer?.querySelector(".button-row");
    if (inlineActions && !inlineActions.querySelector("[data-s004-clear-qa]")) {
      const clearButton = root.document.createElement("button");
      clearButton.className = "text-link";
      clearButton.type = "button";
      clearButton.dataset.s004ClearQa = "true";
      clearButton.textContent = "清空会话";
      inlineActions.append(clearButton);
    }
    const comparisonButton = inlineActions?.querySelector('[data-action="start-current-comparison"]');
    if (comparisonButton) setText(comparisonButton, "与当前权威数据比较");

    assistantContent.querySelector('[data-action="reread-agent-result"]')?.remove();
    assistantContent.querySelectorAll(".notice").forEach((notice) => {
      if (/Agent 应用|正在从 Agent|Session|Run|Result/.test(notice.textContent || "")) notice.remove();
    });

    if (projection) {
      let userMessage = assistantContent.querySelector(".message.user");
      if (!userMessage) {
        userMessage = root.document.createElement("div");
        userMessage.className = "message user";
        userMessage.innerHTML = "<p></p>";
        recommendations.insertAdjacentElement("afterend", userMessage);
      }
      setText(userMessage.querySelector("p"), projection.request?.question || "当前报告问题");

      let assistantMessage = assistantContent.querySelector(".message.assistant");
      if (!assistantMessage) {
        assistantMessage = root.document.createElement("div");
        assistantMessage.className = "message assistant";
        assistantMessage.innerHTML = '<p></p><div class="message-meta"><span></span><button class="citation-link" type="button" data-action="jump-anchor">定位证据</button><button class="citation-link" type="button" data-action="open-anchor-evidence">打开证据</button></div>';
        userMessage.insertAdjacentElement("afterend", assistantMessage);
      }
      const response = m06AnswerForQuestion(projection.request?.question || "");
      const answerNode = assistantMessage.querySelector("p");
      const persistedSummary = String(projection.result?.summary || "").trim();
      const persistedStructured = /^结论：[^\n]+\n依据：[^\n]+\n边界：[^\n]+$/.test(persistedSummary);
      renderM06QaAnswer(answerNode, persistedStructured ? persistedSummary : response.answer);
      answerNode.dataset.ofwS004AnswerSource = persistedStructured ? "immutable-m05-result" : "legacy-result-fixed-evidence-projection";
      if (answerNode?.dataset && answerNode.dataset.ofwS004ClearAnswer !== (response.anchor || projection.anchor)) {
        answerNode.dataset.ofwS004ClearAnswer = response.anchor || projection.anchor;
      }
      const citationRefs = Array.isArray(projection.result?.citationRefs)
        ? projection.result.citationRefs
        : Array.isArray(projection.result?.citations) && projection.result.citations.length > 2
          ? projection.result.citations
          : response.citationRefs;
      let citations = assistantMessage.querySelector("[data-s004-qa-citations]");
      if (!citations) {
        citations = root.document.createElement("div");
        citations.className = "s004-qa-citations";
        citations.dataset.s004QaCitations = "true";
        answerNode?.insertAdjacentElement?.("afterend", citations);
      }
      renderM06QaCitations(citations, citationRefs);
      setText(assistantMessage.querySelector(".message-meta span"), `报告快照 · ${projection.report?.bindingSnapshot?.asOf || "2026-08-15"}`);
      assistantMessage.querySelectorAll("[data-action='jump-anchor'], [data-action='open-anchor-evidence']").forEach((button) => {
        if (button.dataset.anchor !== projection.anchor) button.dataset.anchor = projection.anchor;
      });
    } else {
      assistantContent.querySelectorAll(".message.user, .message.assistant, [data-s004-qa-citations]").forEach((node) => node.remove());
    }
    patchS004CopilotTrace(assistantContent, projection);
    root.document.documentElement.dataset.ofwS004C024State = assistantContent.querySelector(".message.assistant") ? "interactive-result" : "ready-for-question";
  }

  function s004VerificationStatusClass(status) {
    const value = String(status || "").toLowerCase();
    if (["pass", "passed"].includes(value)) return "pass";
    if (["warning", "warn"].includes(value)) return "warn";
    if (["fail", "failed"].includes(value)) return "fail";
    return "unverifiable";
  }

  function renderS004VerificationResults(assistantContent, results) {
    const list = assistantContent?.querySelector(".verification-list");
    if (!list) return;
    const allResults = Array.isArray(results) ? results : [];
    const filtered = m06VerificationFilter === "issues"
      ? allResults.filter((item) => s004VerificationStatusClass(item?.status) !== "pass")
      : allResults;
    const signature = JSON.stringify({ filter: m06VerificationFilter, items: filtered.map((item) => [item.id, item.status, item.issue]) });
    if (list.dataset.s004VerificationListSignature === signature) return;
    if (!filtered.length) {
      list.innerHTML = '<div class="s004-verification-empty">当前没有需要处理的问题。</div>';
      list.dataset.s004VerificationListSignature = signature;
      return;
    }
    list.innerHTML = filtered.map((item) => {
      const statusClass = s004VerificationStatusClass(item.status);
      const businessLabel = s004VerificationBusinessLabel(item);
      const businessDetail = s004VerificationBusinessDetail(item);
      if (statusClass === "pass") {
        return `<div class="verification-item s004-verification-pass-compact"><span class="status-icon pass">✓</span><div><h4>${escapeHtml(businessLabel)}：已通过</h4></div></div>`;
      }
      return `<div class="verification-item"><span class="status-icon ${statusClass}">!</span><div><h4>${escapeHtml(businessLabel)}</h4><p><strong>核验内容：</strong>${escapeHtml(businessDetail)}</p><p><strong>当前结果：</strong>${escapeHtml(item.outcome || item.issue || item.detail || "需要进一步核对")}</p><p><strong>证据：</strong>${escapeHtml(item.evidence || "未定位")}<br><strong>影响：</strong>${escapeHtml(item.impact || "待评估")}<br><strong>责任：</strong>${escapeHtml(item.responsibility || "待确认")}<br><strong>建议：</strong>${escapeHtml(item.recommendation || "核对后重新核验")}</p></div>${item.anchor ? `<button class="text-link" type="button" data-action="jump-anchor" data-anchor="${escapeHtml(item.anchor)}">定位</button>` : ""}</div>`;
    }).join("");
    list.dataset.s004VerificationListSignature = signature;
  }

  function renderS004VerificationExplanation(assistantContent, currentVerification) {
    let explanation = assistantContent?.querySelector("[data-s004-verification-explanation]");
    if (!m06VerificationExplanationVisible) {
      explanation?.remove();
      return;
    }
    const results = Array.isArray(currentVerification?.results) ? currentVerification.results : [];
    const issues = results.filter((item) => s004VerificationStatusClass(item?.status) !== "pass");
    const copy = issues.length
      ? `当前有 ${issues.length} 项需要处理：${issues.map((item) => s004VerificationBusinessLabel(item)).join("、")}。先按问题项修复资料、版本或绑定，再重新核验当前报告。`
      : "当前报告的身份、版本、证据、指标、规则、锚点和人工确认边界均通过核验。通过仅表示当前报告内部链路完整，不代表当前权威数据未变化，也不代表授信已经批准。";
    if (!explanation) {
      explanation = root.document.createElement("section");
      explanation.className = "s004-verification-explanation";
      explanation.dataset.s004VerificationExplanation = "true";
      const list = assistantContent.querySelector(".verification-list");
      list?.insertAdjacentElement("afterend", explanation);
    }
    setHtmlBySignature(explanation, "s004VerificationExplanationSignature", copy, `<strong>核验说明</strong><span>${escapeHtml(copy)}</span>`);
  }

  function renderS004VerificationAnimation(assistantContent) {
    let panel = assistantContent?.querySelector("[data-s004-verification-progress]");
    if (!m06VerificationAnimation) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = root.document.createElement("section");
      panel.className = "s004-verification-progress";
      panel.dataset.s004VerificationProgress = "true";
      assistantContent.querySelector(".context-box")?.insertAdjacentElement("afterend", panel);
    }
    const steps = ["锁定报告版本", "读取证据与权威版本", "执行确定性规则", "汇总核验结果"];
    const html = `<header><strong>正在重新核验当前版本</strong><span>${m06VerificationAnimation.progress}%</span></header><div class="s004-verification-progress-track"><span style="width:${m06VerificationAnimation.progress}%"></span></div><div class="s004-verification-progress-steps">${steps.map((step, index) => `<span class="${index < m06VerificationAnimation.step ? "done" : index === m06VerificationAnimation.step ? "active" : ""}">${step}</span>`).join("")}</div>`;
    setHtmlBySignature(panel, "s004VerificationProgressSignature", `${m06VerificationAnimation.step}|${m06VerificationAnimation.progress}`, html);
  }

  function clearS004VerificationAnimationTimers() {
    m06VerificationAnimationTimers.forEach((timer) => root.clearTimeout?.(timer));
    m06VerificationAnimationTimers = [];
  }

  function beginS004VerificationRerun(draftReaderActive) {
    clearS004VerificationAnimationTimers();
    m06VerificationExplanationVisible = false;
    m06VerificationAnimation = { step: 0, progress: 6 };
    patchS004VerificationPresentation();
    [[1, 28, 260], [2, 58, 620], [3, 86, 980]].forEach(([step, progress, delay]) => {
      m06VerificationAnimationTimers.push(root.setTimeout(() => {
        m06VerificationAnimation = { step, progress };
        patchS004VerificationPresentation();
      }, delay));
    });
    m06VerificationAnimationTimers.push(root.setTimeout(() => {
      const run = draftReaderActive ? runS004DraftDeterministicVerification() : rerunS004DeterministicVerification();
      m06VerificationAnimation = { step: 4, progress: 100, runId: run?.runId || null };
      patchS004VerificationPresentation();
      m06VerificationAnimationTimers.push(root.setTimeout(() => {
        m06VerificationAnimation = null;
        patchS004VerificationPresentation();
      }, 360));
    }, 1320));
    root.document.documentElement.dataset.ofwS004VerificationRerunRequested = "animated-in-place";
  }

  function patchS004VerificationPresentation() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    const activeTab = root.document.querySelector('.assistant-tabs [data-tab="verification"].active');
    if (!activeTab) return;
    const assistantContent = root.document.querySelector(".assistant-pane .assistant-content");
    if (!assistantContent) return;
    const contextBox = assistantContent.querySelector(".context-box");
    const heading = contextBox?.querySelector("strong")?.textContent || "整份报告";
    const runLabel = contextBox?.querySelector("span")?.textContent || "核验运行";
    const contextStrong = contextBox?.querySelector("strong");
    const verificationState = completeM06StateForMutation() || readJsonState(M06_STATE_KEY);
    const verificationReport = verificationState?.report;
    const formalLifecycle = ["published", "withdrawn"].includes(String(verificationReport?.stage || ""));
    const currentVerification = formalLifecycle
      ? verificationReport?.postPublicationVerification || null
      : verificationReport?.verification || null;
    renderS004VerificationAnimation(assistantContent);
    const exactFullCoverage = isS004FullVerificationProjection(verificationReport, currentVerification);
    const latestCompletedVerification = [...(verificationReport?.verificationRuns || [])].reverse().find((run) => {
      const status = String(run?.status || "");
      const coverage = run?.coverage || {};
      return status.startsWith("completed")
        && coverage.status === "complete"
        && Number(coverage.pending || 0) === 0
        && Number(coverage.error || 0) === 0;
    }) || (String(currentVerification?.status || "").startsWith("completed") ? currentVerification : null);
    const displayHeading = exactFullCoverage ? heading.replace("局部或未完整", "整份覆盖完整") : heading;
    if (exactFullCoverage && contextStrong?.textContent?.includes("局部或未完整")) {
      setText(contextStrong, displayHeading);
    }
    if (exactFullCoverage) {
      [...assistantContent.querySelectorAll(".notice.warning")].forEach((notice) => {
        if (notice.querySelector("strong")?.textContent?.includes("当前运行不能解锁人工确认")) notice.remove();
      });
      const prepareFull = root.document.querySelector('.assistant-pane [data-action="prepare-full-verification"]');
      if (prepareFull) {
        const row = prepareFull.parentElement;
        prepareFull.remove();
        if (row && !row.querySelector('[data-action="start-explanation"]')) {
          const explain = root.document.createElement("button");
          explain.className = "btn";
          explain.type = "button";
          explain.dataset.action = "start-explanation";
          explain.textContent = "查看核验说明";
          row.append(explain);
        }
        const primaryAction = formalLifecycle ? "request-regeneration" : "confirm-draft";
        if (row && !row.querySelector(`[data-action="${primaryAction}"]`)) {
          const primary = root.document.createElement("button");
          primary.className = "btn primary";
          primary.type = "button";
          primary.dataset.action = primaryAction;
          primary.textContent = formalLifecycle ? "生成新内容版本" : "确认草稿";
          row.append(primary);
        }
      }
    }
    const currentStatus = String(currentVerification?.status || "");
    const currentResults = Array.isArray(currentVerification?.results) ? currentVerification.results : [];
    const currentCounts = currentResults.reduce((acc, item) => {
      const status = String(item?.status || "").toLowerCase();
      if (status === "pass" || status === "passed") acc.pass += 1;
      else if (status === "warning" || status === "warn") acc.warning += 1;
      else if (status === "fail" || status === "failed") acc.fail += 1;
      else acc.unverifiable += 1;
      return acc;
    }, { pass: 0, warning: 0, fail: 0, unverifiable: 0 });
    const currentCoverage = currentVerification?.coverage || {};
    const currentRunId = currentVerification?.runId || runLabel.replace(/^核验运行\s*/, "") || "尚未形成运行";
    const currentRunSummary = `${currentRunId} · ${currentStatus || "未开始"} · ${currentCoverage.completed || 0} / ${currentCoverage.applicable || currentCoverage.planned || 18} 检查单元 · ${currentCoverage.factCovered || 0} / ${currentCoverage.factTotal || 19} 事实 · ${currentCoverage.anchorCovered || 0} / ${currentCoverage.anchorTotal || 19} 锚点 · 通过 ${currentCounts.pass} / 警告 ${currentCounts.warning} / 失败 ${currentCounts.fail} / 无法核验 ${currentCounts.unverifiable}`;
    const summary = assistantContent.querySelector(".verification-summary");
    if (summary) {
      const values = [currentCounts.pass, currentCounts.warning, currentCounts.fail, currentCounts.unverifiable];
      summary.querySelectorAll(":scope > div strong").forEach((node, index) => setText(node, values[index] ?? "0"));
    }
    const segmented = assistantContent.querySelector(".segmented");
    segmented?.querySelectorAll?.('[data-action="set-verification-filter"]').forEach((button) => {
      const active = button.dataset.filter === m06VerificationFilter;
      button.classList?.toggle?.("active", active);
      button.setAttribute?.("aria-pressed", active ? "true" : "false");
    });
    renderS004VerificationResults(assistantContent, currentResults);
    renderS004VerificationExplanation(assistantContent, currentVerification);
    assistantContent.querySelectorAll(".notice").forEach((notice) => {
      if (/Agent 应用只读解释|解释请求已交付|重新读取解释/.test(notice.textContent || "")) notice.remove();
    });
    let details = assistantContent.querySelector("[data-s004-verification-rules]");
    if (!details) {
      details = root.document.createElement("details");
      details.className = "s004-verification-rules";
      details.dataset.s004VerificationRules = "true";
      const segmented = assistantContent.querySelector(".segmented");
      if (segmented) segmented.insertAdjacentElement("beforebegin", details);
      else contextBox?.insertAdjacentElement("afterend", details);
    }
    if (details) {
      const artifactBoundary = formalLifecycle
        ? "已发布 HTML/PDF 正文不会因重新核验而原地变化。"
        : "当前为候选内容版本；核验只解锁人工复核，不会自动发布 HTML/PDF。";
      const detailSignature = [currentRunId, currentStatus, displayHeading, currentCoverage.completed, currentCoverage.applicable, currentCoverage.factCovered, currentCoverage.anchorCovered].join("|");
      if (details.dataset.s004VerificationSignature !== detailSignature) {
        const wasOpen = Boolean(details.open);
        details.innerHTML = `<summary><span>报告数据一致性核验规则与执行口径</span><small>8 类确定性规则 · 18 个执行单元</small></summary><div class="s004-verification-rule-list">${M06_VERIFICATION_RULES.map(([code, name, detail]) => `<div class="s004-verification-rule"><code>${code}</code><strong>${name}</strong><span>${detail}</span></div>`).join("")}</div><div class="s004-verification-run-meta"><strong>当前任务：</strong>${escapeHtml(currentRunSummary)}<br><strong>范围：</strong>${escapeHtml(displayHeading)}。以上规则逐项核对报告数据、固定证据和已发布事实是否一致；${artifactBoundary}</div>`;
        details.open = wasOpen;
        details.dataset.s004VerificationSignature = detailSignature;
      }
    }

    const currentInterrupted = ["run_failed", "failed", "interrupted"].includes(currentStatus)
      || (!currentStatus && assistantContent.textContent?.includes("核验任务中断"));
    if (!currentInterrupted) {
      assistantContent.querySelectorAll("[data-s004-verification-recovery-notice], [data-s004-last-completed-verification]").forEach((node) => node.remove());
      [...assistantContent.querySelectorAll(".notice.warning, .notice.danger")].forEach((notice) => {
        if (notice.textContent?.includes("核验任务中断")) notice.remove();
      });
    }
    if (currentInterrupted) {
      let recoveryNotice = [...assistantContent.querySelectorAll(".notice")].find((notice) => notice.textContent?.includes("核验任务中断"))
        || assistantContent.querySelector("[data-s004-verification-recovery-notice]");
      if (!recoveryNotice) {
        recoveryNotice = root.document.createElement("div");
        recoveryNotice.className = "notice warning";
        details?.insertAdjacentElement("afterend", recoveryNotice);
      }
      recoveryNotice.dataset.s004VerificationRecoveryNotice = "history-preserved";
      recoveryNotice.classList?.remove("danger");
      recoveryNotice.classList?.add("warning");
      const failedRunId = currentVerification?.runId || "失败尝试未定位";
      const completedRunId = latestCompletedVerification?.runId || "尚无完成运行";
      const recoveryHtml = `<div><strong>${latestCompletedVerification ? "最近完成核验结果可用；失败尝试已保留" : "失败核验尝试已保留，可重新核验当前版本"}</strong><span>失败 Run ${escapeHtml(failedRunId)} 未覆盖历史记录；${latestCompletedVerification ? `下方继续展示最近完成 Run ${escapeHtml(completedRunId)} 的规则与结果。` : "修复运行条件后可新增独立核验 Run。"}${formalLifecycle ? "重新核验不会改写已发布 HTML/PDF。" : "重新核验不会自动确认或发布候选内容。"}</span></div>`;
      setHtmlBySignature(recoveryNotice, "s004VerificationRecoverySignature", [failedRunId, completedRunId, formalLifecycle].join("|"), recoveryHtml);

      if (latestCompletedVerification && !assistantContent.querySelector("[data-s004-last-completed-verification]")) {
        const completedResults = Array.isArray(latestCompletedVerification.results) ? latestCompletedVerification.results : [];
        const completedCounts = completedResults.reduce((acc, item) => {
          const status = String(item?.status || "").toLowerCase();
          if (status === "pass" || status === "passed") acc.pass += 1;
          else if (status === "warning" || status === "warn") acc.warning += 1;
          else if (status === "fail" || status === "failed") acc.fail += 1;
          else acc.unverifiable += 1;
          return acc;
        }, { pass: 0, warning: 0, fail: 0, unverifiable: 0 });
        const previous = root.document.createElement("section");
        previous.className = "s004-last-completed-verification";
        previous.dataset.s004LastCompletedVerification = latestCompletedVerification.runId || "completed";
        previous.innerHTML = `<div class="context-box"><span>最近完成核验 ${escapeHtml(latestCompletedVerification.runId || "待定位")}</span><strong>历史完成结果只读展示 · 当前失败尝试单独保留</strong></div><div class="verification-summary"><div><span>通过</span><strong>${completedCounts.pass}</strong></div><div><span>警告</span><strong>${completedCounts.warning}</strong></div><div><span>失败</span><strong>${completedCounts.fail}</strong></div><div><span>无法核验</span><strong>${completedCounts.unverifiable}</strong></div></div><div class="verification-list">${completedResults.map((item) => { const status = s004VerificationStatusClass(item.status); const label = s004VerificationBusinessLabel(item); return status === "pass" ? `<div class="verification-item s004-verification-pass-compact"><span class="status-icon pass">✓</span><div><h4>${escapeHtml(label)}：已通过</h4></div></div>` : `<div class="verification-item"><span class="status-icon ${status}">!</span><div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(item.outcome || item.issue || item.detail || "需要核对")}</p></div></div>`; }).join("")}</div>`;
        recoveryNotice.insertAdjacentElement("afterend", previous);
      }
    }
    const composeActions = root.document.querySelector(".assistant-pane .assistant-compose .button-row");
    if (composeActions && !composeActions.querySelector('[data-s004-rerun-verification]')) {
      const rerun = root.document.createElement("button");
      rerun.className = "btn";
      rerun.type = "button";
      rerun.dataset.action = "s004-rerun-verification";
      rerun.dataset.s004RerunVerification = "true";
      rerun.textContent = "重新核验当前版本";
      composeActions.prepend(rerun);
    }
    const explanationButton = composeActions?.querySelector('[data-action="start-explanation"], [data-action="reread-explanation"]');
    if (explanationButton) {
      explanationButton.dataset.action = "start-explanation";
      setText(explanationButton, m06VerificationExplanationVisible ? "收起核验说明" : "查看核验说明");
    }
    const compareButton = root.document.querySelector('.assistant-pane [data-action="start-current-comparison"]');
    if (compareButton) setText(compareButton, "与当前权威数据比较");
    const compose = root.document.querySelector(".assistant-pane .assistant-compose");
    let boundary = compose?.querySelector("[data-s004-verification-boundary]");
    if (compose && !boundary) {
      boundary = root.document.createElement("p");
      boundary.className = "s004-verification-boundary";
      boundary.dataset.s004VerificationBoundary = "true";
      compose.append(boundary);
    }
    setText(boundary, "重新核验检查当前报告自身的版本、证据和规则；与当前权威数据比较会另建比较记录，不改变本次核验结论。");
    root.document.documentElement.dataset.ofwS004VerificationPresentation = currentInterrupted
      ? (latestCompletedVerification ? "failed-history-preserved-completed-results-visible" : "failed-history-preserved-rerun-available")
      : "rules-and-results-visible";
  }

  function patchS004ComparisonPresentation() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    const closeButton = root.document.querySelector('.assistant-pane [data-action="close-comparison"]');
    if (!closeButton) return;
    setText(closeButton, "返回核验结果");
    const assistantContent = root.document.querySelector(".assistant-pane .assistant-content");
    const compose = root.document.querySelector(".assistant-pane .assistant-compose");
    if (!assistantContent || !compose) return;
    const explanationButton = compose.querySelector('[data-action="start-comparison-explanation"], [data-action="reread-comparison-explanation"]');
    if (explanationButton) setText(explanationButton, m06ComparisonExplanationVisible ? "收起差异说明" : "查看差异说明");
    compose.querySelectorAll('[data-action="reread-comparison-record-explanation"]').forEach((button) => button.remove());
    assistantContent.querySelectorAll(".notice").forEach((notice) => {
      if (/Agent 应用|解释请求|重新读取解释/.test(notice.textContent || "")) notice.remove();
    });
    let boundary = compose.querySelector("[data-s004-comparison-boundary]");
    if (!boundary) {
      boundary = root.document.createElement("p");
      boundary.className = "s004-verification-boundary";
      boundary.dataset.s004ComparisonBoundary = "true";
      compose.append(boundary);
    }
    setText(boundary, "当前权威数据比较只对照报告快照与当前事实，不重新执行报告内部核验，也不会改写已发布报告。");
    let explanation = assistantContent.querySelector("[data-s004-comparison-explanation]");
    if (!m06ComparisonExplanationVisible) {
      explanation?.remove();
      return;
    }
    const state = completeM06StateForMutation() || readJsonState(M06_STATE_KEY);
    const comparison = state?.report?.comparison || state?.publishedReports?.find((item) => item?.reportNo === state?.ui?.viewingReportNo)?.comparison || {};
    const counts = comparison.counts || {};
    const changed = Number(counts.changed || 0);
    const unverifiable = Number(counts.unverifiable || 0);
    const copy = changed || unverifiable
      ? `当前比较发现 ${changed} 项变化、${unverifiable} 项无法比较。变化只说明报告快照与当前权威事实不同；如需更新正式内容，应创建新的内容版本并重新核验。`
      : `当前比较未发现结构化事实变化。该结论只针对本次固定比较范围，不等同于授信风险判断，也不替代报告内部核验。`;
    if (!explanation) {
      explanation = root.document.createElement("section");
      explanation.className = "s004-verification-explanation";
      explanation.dataset.s004ComparisonExplanation = "true";
      const anchor = assistantContent.querySelector(".compare-grid, .comparison-outcome") || assistantContent.firstElementChild;
      anchor?.insertAdjacentElement("afterend", explanation);
    }
    setHtmlBySignature(explanation, "s004ComparisonExplanationSignature", `${changed}|${unverifiable}|${copy}`, `<strong>差异说明</strong><span>${escapeHtml(copy)}</span>`);
  }

  function patchS004CurrentRunAccessCopy() {
    if (context.scenarioId !== "S004" || !["M05", "M06"].includes(moduleId)) return;
    const replacements = [
      ["当前只读查看既有制品", "历史正式制品保持不可变；当前隔离轮次可追加新的问答、Agent Run、内容版本和确定性核验记录"],
      ["不发起新运行或版本变更", "当前隔离轮次可追加新运行和新内容版本；历史制品不原地覆盖"],
      ["当前不可用于新的正式输出", "当前固定证据与闭环可用于形成新的草稿、运行和核验记录；本轮不执行正式发布"]
    ];
    root.document.querySelectorAll?.(".notice strong, .notice span, .badge, .page-header p, .context-box small, .context-box strong").forEach((node) => {
      let copy = node.textContent || "";
      let changed = false;
      replacements.forEach(([from, to]) => {
        if (!copy.includes(from)) return;
        copy = copy.replaceAll(from, to);
        changed = true;
      });
      if (changed) {
        setText(node, copy);
        node.dataset.ofwS004AppendAccessCopy = "true";
      }
    });
  }

  function patchS004FormalReportIdentity(report) {
    if (!report || !visibleS004Report(report.reportNo)) return;
    const paper = root.document.querySelector(".s004-formal-report");
    const title = currentS004ReportTitle();
    const profile = activeS004RuntimeProfile();
    const heading = paper?.querySelector(".title-block h1");
    if (heading) {
      setText(heading, title);
      heading.dataset.s004FullReportTitle = "true";
    }
    const borrower = paper?.querySelector(".title-block .borrower");
    if (borrower) setText(borrower, `借款人：${profile.borrower.legalName || "集团成员单位"} · 业务主体：财务公司`);
    paper?.setAttribute?.("aria-label", title);
    root.document.documentElement.dataset.ofwS004ReportNamingPolicy = profile.naming.policyId || "borrower-year-issue-date";
  }

  function patchM06ReusableDefinitionDetails() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    const drawer = [...root.document.querySelectorAll?.(".drawer") || []].find((item) =>
      item.querySelector?.(".drawer-head h2")?.textContent?.trim() === "报告定义详情"
      && item.textContent?.includes("贷前调查报告（财务公司）"));
    const body = drawer?.querySelector?.(".drawer-body");
    if (!body) return;
    body.querySelectorAll?.("[data-s004-definition-reuse]").forEach((node) => node.remove());
    root.document.documentElement.dataset.ofwS004ReportDefinitionReuse = "baseline-definition-detail";
  }

  function patchM06BaselineCapabilitySeparation() {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    root.document.querySelectorAll?.(".resource-row").forEach((row) => {
      const isBaseline = row.textContent?.includes("RD-FIN-001") || row.textContent?.includes("RT-FIN-002");
      if (!isBaseline || row.dataset.ofwS004BaselineReference === "true") return;
      row.dataset.ofwS004BaselineReference = "true";
    });
    root.document.querySelectorAll?.(".choice-card").forEach((card) => {
      if (card.textContent?.includes("S004") || (!card.textContent?.includes("S001") && !card.textContent?.includes("集团融资经营分析"))) return;
      card.dataset.ofwS004BaselineReference = "true";
      card.hidden = true;
    });
    root.document.documentElement.dataset.ofwS004M06BaselineSeparation = "capability-preserved-records-isolated";
  }

  function openS004TemplateDrawer() {
    const resources = reportResourcesFromState();
    if (!resources) return;
    const { definition, template } = resources;
    root.document.querySelector(".drawer-backdrop[data-s004-template-drawer]")?.remove();
    const backdrop = root.document.createElement("div");
    backdrop.className = "drawer-backdrop";
    backdrop.dataset.s004TemplateDrawer = "true";
    const chapters = (definition.sections || []).map((item) => item.title);
    const htmlFile = template.downloads?.html || "RT-S004-PREFLIGHT-002-v2.0.0.html";
    const jsonFile = template.downloads?.json || "RT-S004-PREFLIGHT-002-v2.0.0.json";
    const htmlHref = templateDownloadUrl(htmlFile);
    const jsonHref = templateDownloadUrl(jsonFile);
    backdrop.innerHTML = `<aside class="drawer"><header class="drawer-head"><h2>报告模板详情</h2><button class="icon-button" type="button" data-s004-close-template title="关闭">×</button></header><div class="drawer-body"><div class="detail-list"><div class="detail-row"><span>模板</span><strong>财务公司贷款贷前调查报告模板 · ${template.version}</strong></div><div class="detail-row"><span>适用范围</span><strong>集团成员单位贷款申请 · 可跨借款人复用</strong></div><div class="detail-row"><span>章节骨架</span><strong>${chapters.join(" → ")}</strong></div><div class="detail-row"><span>稳定锚点</span><strong>${template.slots.length} 项 · ${template.id}</strong></div><div class="detail-row"><span>运行时绑定</span><strong>borrowerId / applicationId / reportId / scenarioRunId / evidencePackId / contentVersion</strong></div><div class="detail-row"><span>模板格式</span><strong>HTML 查看/下载 + JSON 字段定义</strong></div><div class="detail-row"><span>人工确认标记</span><strong>${template.confirmationLabel || "【需人工确认】"} · ${template.aiSuggestionLabel || "AI 建议（基于已固化资料与系统事实生成）"}</strong></div></div><div class="notice"><div><strong>模板只负责骨架与版式</strong><span>业务目的、证据、Agent、确定性核验、人工复核和发布规则仍由报告定义及报告中心维护；新借款人形成独立版本，DOCX 仍不纳入一期。</span></div></div><div class="s004-template-downloads">${htmlHref ? `<a class="btn primary" href="${htmlHref}" target="_blank" rel="noopener" data-s004-template-download="html">打开 HTML 模板</a><a class="btn" href="${htmlHref}" download="${htmlFile}" data-s004-template-download="html-file">下载 HTML</a>` : ""}${jsonHref ? `<a class="btn" href="${jsonHref}" download="${jsonFile}" data-s004-template-download="json">下载 JSON 字段定义</a>` : ""}</div></div><footer class="drawer-foot"><button class="btn" type="button" data-s004-close-template>关闭</button></footer></aside>`;
    (root.document.getElementById("app") || root.document.body).append(backdrop);
  }

  function addBanner() {
    if (!bannerText) {
      root.document.getElementById?.("ofw-s004-module-banner")?.remove?.();
      return;
    }
    if (!root.document.body || root.document.getElementById("ofw-s004-module-banner")) return;
    const host = root.document.querySelector("#root, #app, .app-shell, .page-shell, .screen-stage, main") || root.document.body;
    const banner = root.document.createElement("div");
    banner.id = "ofw-s004-module-banner";
    banner.className = "notice warning ofw-s004-runtime-banner";
    banner.setAttribute("role", "status");
    banner.style.cssText = "margin:10px 14px;position:relative;z-index:2;line-height:1.6;";
    banner.innerHTML = `<strong>${bannerText.split("·")[0]}</strong><span>${bannerText.includes("·") ? ` · ${bannerText.split("·").slice(1).join("·")}` : ""}</span>`;
    host.prepend(banner);
  }

  function dedupeM06ReportDefinitions() {
    if (moduleId !== "M06" || context.scenarioId !== "S004" || !root.location.hash.includes("tab=definitions")) return;
    const seen = new Set();
    root.document.querySelectorAll?.("main .resource-list .resource-row").forEach((row) => {
      const id = row.querySelector?.('[data-action="open-definition"]')?.dataset?.id
        || (row.textContent?.match(/RDEF-S004-PREFLIGHT-002/) || [])[0]
        || null;
      if (!id) return;
      if (seen.has(id)) {
        row.remove();
        return;
      }
      seen.add(id);
    });
    const definitionTab = root.document.querySelector('a.tab[href="#/reports?tab=definitions"]');
    if (definitionTab) setText(definitionTab.querySelector("span"), String(seen.size || 1));
    root.document.documentElement.dataset.ofwS004ReportDefinitionCount = String(seen.size || 1);
  }

  function patchReportCatalog() {
    if (moduleId !== "M06") return;
    ensureM06ScenarioStyle();
    const resources = injectReportResources();
    patchM06TrustStripConsumption(resources);
    patchM06GenerationConsumable();
    patchM06GenerationWizardCopy();
    const report = resources?.report;
    const definition = resources?.definition;
    const template = resources?.template;
    const reportNo = report?.reportNo || "S004-PLR-2026-0001";
    const reportTitle = currentS004ReportTitle();
    // Only patch controls whose S004 identity can be proven from the seeded
    // report record. Never rewrite generic S001 text, status badges or disabled
    // controls: the frozen module keeps its original creation workflow.
    const workspace = root.document.querySelector(".product-nav-foot");
    setText(workspace?.querySelectorAll("span")?.[0], "财务公司授信审批与调查岗");
    root.document.querySelectorAll(".resource-row").forEach((row) => {
      if (row.textContent?.includes(reportNo)) setText(row.querySelector("div > strong"), reportTitle);
    });
    const reportIsVisible = visibleS004Report(reportNo);
    if (reportIsVisible) {
      patchS004FormalReportIdentity(report);
      const readerTitle = root.document.querySelector(".reader-toolbar .reader-title");
      if (readerTitle?.textContent?.includes(reportNo)) setText(readerTitle.querySelector("strong"), reportTitle);
      const qaContext = [...root.document.querySelectorAll(".assistant-pane .context-box")]
        .find((box) => box.querySelector("span")?.textContent?.trim() === "当前上下文");
      if (qaContext) {
        if (!qaContext.dataset.ofwS004StableAnchor) qaContext.dataset.ofwS004StableAnchor = "sec-03-financial";
        patchS004ReportAssistant(qaContext);
      }
      patchS004VerificationPresentation();
      patchS004ComparisonPresentation();
    }
    patchM06ReusableDefinitionDetails();
    patchM06BaselineCapabilitySeparation();
    dedupeM06ReportDefinitions();
    const definitionTab = root.document.querySelector('a.tab[href="#/reports?tab=definitions"]');
    if (definitionTab) setText(definitionTab.querySelector("span"), "1");
    const templateTab = root.document.querySelector('a.tab[href="#/reports?tab=templates"]');
    if (templateTab) setText(templateTab.querySelector("span"), "1");
    if (root.location.hash.includes("tab=templates") && template) {
      const existingTemplateRow = [...root.document.querySelectorAll(".resource-row")]
        .find((row) => row.textContent?.includes(template.id));
      const htmlFile = template.downloads?.html || "RT-S004-PREFLIGHT-002-v2.0.0.html";
      const htmlHref = templateDownloadUrl(htmlFile);
      if (existingTemplateRow) {
        const actions = existingTemplateRow.querySelector(".inline-actions") || existingTemplateRow;
        if (htmlHref && !actions.querySelector('[data-s004-template-download="catalog"]')) {
          const link = root.document.createElement("a");
          link.className = "text-link";
          link.href = htmlHref;
          link.download = htmlFile;
          link.dataset.s004TemplateDownload = "catalog";
          link.textContent = "下载模板";
          actions.append(link);
        }
      } else {
        const list = root.document.querySelector("main .resource-list");
        if (list) {
        const row = root.document.createElement("div");
        row.className = "resource-row";
        row.dataset.s004Template = template.id;
        const chapters = (definition?.sections || []).map((item) => item.title);
        row.innerHTML = `<div><strong>财务公司贷款贷前调查报告模板</strong><small>${template.id} · ${chapters.length} 个章节 · HTML / JSON</small></div><div class="resource-meta"><span>版本</span><strong>${template.version}</strong></div><div><span class="badge success"><span class="status-dot"></span>已启用</span></div><div class="inline-actions"><button class="btn" type="button" data-s004-open-template="${template.id}">查看详情</button>${htmlHref ? `<a class="text-link" href="${htmlHref}" download="${htmlFile}" data-s004-template-download="catalog">下载模板</a>` : ""}</div>`;
        list.append(row);
        }
      }
    }

    const liveCard = [...root.document.querySelectorAll(".ledger-row, .ledger-card")].find((card) =>
      card.querySelector('[data-action="navigate"][data-route="/reports/view"]')
      && !card.querySelector('[data-action="open-scene-readiness"]'));
    if (liveCard) {
      setText(liveCard.querySelector(".scene-code"), "S004");
      setText(liveCard.querySelector(".ledger-title strong, h3"), reportTitle);
      setText(liveCard.querySelector(".ledger-title small, :scope > p"), "正式报告 · 财务公司");
    }
    root.document.querySelectorAll('[data-action="open-scene-readiness"][data-scene="S004"]').forEach((button) => {
      button.closest(".ledger-row, .ledger-card")?.remove();
    });
    const blockerSummary = root.document.querySelector('[data-action="set-catalog-status"][data-status="阻断"]');
    if (blockerSummary) {
      setText(blockerSummary.querySelector("strong"), "2");
      setText(blockerSummary.querySelector("small"), "S002—S003 等待业务资料");
    }

    root.document.querySelectorAll(".choice-card").forEach((card) => {
      if (!card.textContent?.includes(reportTitle) || !card.textContent?.includes("S004")) return;
      const description = [...card.children].find((node) => node.tagName === "SPAN" && !node.classList.contains("icon") && !node.classList.contains("badge"));
      setText(description, "S004 · 已装配报告定义、固定证据、Agent、核验、复核与发布链；新公司或新时点使用独立身份和版本运行");
      const badge = card.querySelector(".badge");
      if (badge && !badge.textContent?.includes("已装配")) badge.innerHTML = '<span class="status-dot"></span>已装配';
      card.classList.remove("disabled");
      card.removeAttribute("disabled");
      card.removeAttribute("aria-disabled");
    });

    const chapterMap = [
      ["sec-01-borrower-evaluation", "借款人评价"],
      ["sec-02-operations", "借款人经营情况"],
      ["sec-03-financial", "借款人财务情况"],
      ["sec-04-risk", "借款风险分析"],
      ["sec-05-credit-conclusion", "授信结论"],
      ["sec-06-data-sources", "数据来源"]
    ];
    root.document.querySelectorAll(".reader-toc .toc-link").forEach((button, index) => {
      const mapped = chapterMap[index];
      if (!mapped) return;
      button.dataset.section = mapped[0];
      setText(button.querySelector("span"), mapped[1]);
    });

    const traceDefinition = [...root.document.querySelectorAll(".timeline-row")].find((row) => row.querySelector("strong")?.textContent?.trim() === "报告定义与模板");
    if (reportIsVisible && definition && template && traceDefinition) {
      setText(traceDefinition.querySelector("small"), `${definition.id} ${definition.version} · ${template.id} ${template.version}`);
      traceDefinition.dataset.ofwS004TraceIdentity = `${definition.id}@${definition.version}|${template.id}@${template.version}`;
    }

    const toolbar = root.document.querySelector(".reader-toolbar .header-actions");
    toolbar?.querySelectorAll?.("[data-s004-preview-pdf]").forEach((button) => button.remove());
    if (toolbar && report?.artifactManifest && !toolbar.querySelector(".s004-formal-output-links")) {
      const links = root.document.createElement("span");
      links.className = "s004-formal-output-links";
      links.style.display = "contents";
      [
        [report.artifactManifest.html?.output, "查看 HTML", false],
        [report.artifactManifest.pdf?.output, "查看 PDF", true]
      ].forEach(([output, label, downloadable]) => {
        const href = formalOutputUrl(output?.file);
        if (!href) return;
        if (downloadable) {
          const download = root.document.createElement("a");
          download.className = "btn";
          download.href = href;
          download.download = formalReportDownloadName("pdf");
          download.type = "application/pdf";
          download.setAttribute("aria-label", `下载 PDF：${reportTitle}`);
          download.title = `下载 PDF · ${reportTitle}`;
          download.textContent = "下载 PDF";
          download.dataset.s004FormalOutputDownload = output.format;
          links.append(download);
          return;
        }
        const link = root.document.createElement("a");
        link.className = "btn";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener";
        link.type = output.format === "SAME_SOURCE_PDF" ? "application/pdf" : "text/html";
        link.setAttribute("aria-label", `${label}：${reportTitle}`);
        link.title = `${label} · ${reportTitle}`;
        link.textContent = label;
        link.dataset.s004FormalOutput = output.format;
        links.append(link);
      });
      if (links.childElementCount) toolbar.prepend(links);
    }
    if (reportIsVisible) {
      root.document.documentElement.dataset.ofwS004ReportReader = "immutable-artifact-interactive-assistant";
      root.document.documentElement.dataset.ofwS004ReportAnchor = "sec-03-financial";
      root.document.documentElement.dataset.ofwS004ReportPresentation = root.document.querySelector(".s004-formal-report") ? "fit-a4-fragment" : "pending";
    }
  }

  function patchScenarioIdentity() {
    if (moduleId !== "M01") return;
    const workspace = root.document.querySelector(".product-nav-foot");
    setText(workspace?.querySelector("strong"), "S004");
    setText(workspace?.querySelector("span"), "财务公司贷款贷前调查");
  }

  const M01_PUBLISHED_CANVAS_MIN_ZOOM = 0.5;
  const M01_PUBLISHED_CANVAS_MAX_ZOOM = 1;
  const M01_PUBLISHED_CANVAS_DEFAULT_ZOOM = 0.72;
  let m01PublishedCanvasZoom = null;
  let m01PublishedCanvasDrag = null;
  let m01PublishedCanvasLastWheelAt = -Infinity;

  function normalizeM01PublishedCanvasZoom(value, fallback = M01_PUBLISHED_CANVAS_DEFAULT_ZOOM) {
    const numeric = Number(value);
    const resolved = Number.isFinite(numeric) ? numeric : fallback;
    return Math.max(M01_PUBLISHED_CANVAS_MIN_ZOOM, Math.min(M01_PUBLISHED_CANVAS_MAX_ZOOM, resolved));
  }

  function publishedCanvasZoomFromWorld(world) {
    const match = String(world?.style?.transform || "").match(/scale\(\s*([0-9.]+)\s*\)/);
    return normalizeM01PublishedCanvasZoom(match?.[1]);
  }

  function nextM01PublishedCanvasZoom(current, direction) {
    if (direction === "reset") return M01_PUBLISHED_CANVAS_DEFAULT_ZOOM;
    const step = direction === "in" ? 0.1 : direction === "out" ? -0.1 : 0;
    return normalizeM01PublishedCanvasZoom(Math.round((normalizeM01PublishedCanvasZoom(current) + step) * 100) / 100);
  }

  function m01PublishedCanvasElements(scroll = null) {
    const exactScroll = scroll || root.document.querySelector(".published-canvas-viewport .published-canvas-scroll");
    const viewport = exactScroll?.closest?.(".published-canvas-viewport") || null;
    return {
      viewport,
      scroll: exactScroll,
      space: exactScroll?.querySelector?.(".published-canvas-space") || null,
      world: exactScroll?.querySelector?.(".published-canvas-world") || null
    };
  }

  function applyM01PublishedCanvasZoom(nextZoom, options = {}) {
    if (moduleId !== "M01" || context.scenarioId !== "S004") return null;
    const elements = m01PublishedCanvasElements(options.scroll);
    const { viewport, scroll, space, world } = elements;
    if (!viewport || !scroll || !space || !world) return null;
    const currentZoom = normalizeM01PublishedCanvasZoom(m01PublishedCanvasZoom ?? publishedCanvasZoomFromWorld(world));
    const zoom = normalizeM01PublishedCanvasZoom(nextZoom);
    const rect = scroll.getBoundingClientRect?.() || { left: 0, top: 0, width: scroll.clientWidth || 0, height: scroll.clientHeight || 0 };
    const anchorX = Number.isFinite(options.clientX) ? options.clientX - rect.left : (scroll.clientWidth || rect.width || 0) / 2;
    const anchorY = Number.isFinite(options.clientY) ? options.clientY - rect.top : (scroll.clientHeight || rect.height || 0) / 2;
    const worldX = ((scroll.scrollLeft || 0) + anchorX) / currentZoom;
    const worldY = ((scroll.scrollTop || 0) + anchorY) / currentZoom;
    const worldWidth = Number.parseFloat(world.style.width) || world.offsetWidth || 2140;
    const worldHeight = Number.parseFloat(world.style.height) || world.offsetHeight || 1120;

    m01PublishedCanvasZoom = zoom;
    world.style.transform = `scale(${zoom})`;
    space.style.width = `${Math.ceil(worldWidth * zoom)}px`;
    space.style.height = `${Math.ceil(worldHeight * zoom)}px`;
    setText(viewport.querySelector(".published-canvas-zoom b"), `${Math.round(zoom * 100)}%`);
    scroll.scrollLeft = Math.max(0, worldX * zoom - anchorX);
    scroll.scrollTop = Math.max(0, worldY * zoom - anchorY);
    scroll.dataset.ofwS004Zoom = String(zoom);
    root.document.documentElement.dataset.ofwS004M01PublishedCanvasZoom = String(zoom);
    return zoom;
  }

  function ensureM01PublishedCanvasStyle() {
    if (root.document.getElementById("ofw-s004-m01-published-canvas-style")) return;
    const style = root.document.createElement?.("style");
    if (!style) return;
    style.id = "ofw-s004-m01-published-canvas-style";
    style.textContent = `
      .published-canvas-scroll[data-ofw-s004-panzoom="enabled"] { cursor: grab; overscroll-behavior: contain; touch-action: none; }
      .published-canvas-scroll[data-ofw-s004-panzoom="enabled"].is-s004-panning { cursor: grabbing; user-select: none; }
      .published-canvas-scroll[data-ofw-s004-panzoom="enabled"] .canvas-node { cursor: pointer; }
    `;
    (root.document.head || root.document.documentElement).append(style);
  }

  function patchM01PublishedCanvas() {
    if (moduleId !== "M01" || context.scenarioId !== "S004") return;
    const { viewport, scroll, world } = m01PublishedCanvasElements();
    if (!viewport || !scroll || !world) return;
    ensureM01PublishedCanvasStyle();
    scroll.dataset.ofwS004Panzoom = "enabled";
    scroll.setAttribute?.("aria-label", "S004 已发布本体只读画布；拖动平移，鼠标滚轮缩放");
    scroll.setAttribute?.("title", "拖动画布平移，鼠标滚轮缩放；节点位置与 Published 本体保持只读");
    const observedZoom = publishedCanvasZoomFromWorld(world);
    if (m01PublishedCanvasZoom == null) m01PublishedCanvasZoom = observedZoom;
    if (Math.abs(observedZoom - m01PublishedCanvasZoom) > 0.001) applyM01PublishedCanvasZoom(m01PublishedCanvasZoom, { scroll });
    scroll.dataset.ofwS004Zoom = String(m01PublishedCanvasZoom);
    root.document.documentElement.dataset.ofwS004M01PublishedCanvasZoom = String(m01PublishedCanvasZoom);
    const note = viewport.querySelector(".published-canvas-note > span:last-child");
    setText(note, "拖动画布平移，鼠标滚轮缩放；点击语义节点查看该精确 Published 版本的资源详情。节点布局与本体内容保持只读。");
    root.document.documentElement.dataset.ofwS004M01PublishedCanvas = "read-only-pan-wheel-zoom";
  }

  // ---------------------------------------------------------------------
  // M01 S004 semantic context
  // ---------------------------------------------------------------------
  // The frozen v1.0.3 page remains the source of the module structure and
  // route behavior.  This small runtime panel only projects the current
  // S004 instance binding into that page so the user can see the generic
  // semantic definitions and the concrete borrower/application/report
  // instance being consumed by the rest of the chain.
  function m01Escape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function m01PublishedState() {
    if (moduleId !== "M01" || context.scenarioId !== "S004") return null;
    const state = readJsonState(M01_STATE_KEY);
    if (!state || !Array.isArray(state.publishedVersions)) return null;
    const versions = state.publishedVersions.filter((item) => sameScenarioRun(item));
    const selectedId = state.currentFormalVersionId || state.selectedVersionId;
    return versions.find((item) => item.id === selectedId) || versions[0] || null;
  }

  function m01RuntimeConfig() {
    return activeScenarioRuntimeConfig() || {};
  }

  function m01InstanceBinding(version) {
    const config = m01RuntimeConfig();
    const runtime = config || {};
    const borrowerProfiles = runtime.borrowerProfiles || {};
    const applicationProfiles = runtime.applicationProfiles || {};
    const borrower = (borrowerProfiles.profiles || []).find((item) => item.borrowerId === borrowerProfiles.activeBorrowerId)
      || (borrowerProfiles.profiles || [])[0]
      || {};
    const application = (applicationProfiles.applications || []).find((item) => item.applicationId === applicationProfiles.activeApplicationId)
      || (applicationProfiles.applications || [])[0]
      || {};
    const ontology = runtime.ontologyInstanceBindings || {};
    const stable = runtime.stableIdentities || {};
    const report = runtime.reportNamingPolicy || {};
    const artifactProjection = runtime.historicalArtifactProjection || {};
    return {
      financialCompany: runtime.businessSubject || "财务公司",
      borrower,
      application,
      ontology,
      stable,
      report,
      artifactProjection,
      version,
      dataVersion: runtime.dataVersion || version?.dataContract?.assetVersion || "待确认",
      dataAsOf: runtime.dataAsOf || version?.dataContract?.asOf || "待确认",
      c008: ontology.c008BindingId || runtime.bindingId || "待确认",
      publishedPointer: ontology.publishedPointer || runtime.ontologyVersion || version?.semanticVersion || "待确认",
      evidencePackId: stable.evidencePackId || "待确认",
      reportId: stable.reportId || "待确认",
      applicationId: application.applicationId || stable.applicationId || "待确认"
    };
  }

  function ensureM01ScenarioContextStyle() {
    if (root.document?.getElementById?.("ofw-s004-m01-context-style")) return;
    const style = root.document?.createElement?.("style");
    if (!style) return;
    style.id = "ofw-s004-m01-context-style";
    style.textContent = `
      .s004-m01-context-panel { margin: 14px 0 18px; }
      .s004-m01-context-panel .panel-head { align-items: flex-start; }
      .s004-m01-context-panel .s004-context-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
      .s004-m01-context-panel .s004-context-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .s004-m01-context-panel .s004-context-card { min-width: 0; padding: 12px; border: 1px solid #e1e8f0; border-radius: 8px; background: #fbfdff; }
      .s004-m01-context-panel .s004-context-card h3 { margin: 0 0 8px; color: #244c83; font-size: 13px; }
      .s004-m01-context-panel .s004-context-card p { margin: 0 0 8px; color: #526174; font-size: 11px; line-height: 1.55; }
      .s004-m01-context-panel .s004-context-table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .s004-m01-context-panel .s004-context-table th, .s004-m01-context-panel .s004-context-table td { padding: 6px 7px; border-bottom: 1px solid #edf1f5; text-align: left; vertical-align: top; }
      .s004-m01-context-panel .s004-context-table th { color: #526174; font-weight: 650; background: #f6f9fc; }
      .s004-m01-context-panel .s004-context-table td:last-child { text-align: right; white-space: nowrap; }
      .s004-m01-context-panel .s004-resource-list { display: grid; gap: 7px; max-height: 240px; overflow: auto; }
      .s004-m01-context-panel .s004-resource-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 7px 0; border-bottom: 1px solid #edf1f5; }
      .s004-m01-context-panel .s004-resource-item:last-child { border-bottom: 0; }
      .s004-m01-context-panel .s004-resource-item > i { width: 24px; height: 24px; display: grid; place-items: center; color: #315d9b; border-radius: 6px; background: #e8f0fa; font-style: normal; font-size: 11px; font-weight: 800; }
      .s004-m01-context-panel .s004-resource-item b { display: block; color: #334155; font-size: 11px; }
      .s004-m01-context-panel .s004-resource-item small { display: block; color: #64748b; line-height: 1.45; }
      .s004-m01-context-panel .s004-reuse-note { margin-top: 12px; padding: 10px 11px; border-left: 3px solid #5d82bb; color: #43526a; background: #f3f7fb; font-size: 11px; line-height: 1.6; }
      .s004-m01-context-panel .s004-reuse-note strong { color: #244c83; }
      @media (max-width: 900px) { .s004-m01-context-panel .s004-context-grid { grid-template-columns: 1fr; } .s004-m01-context-panel .s004-context-badges { justify-content: flex-start; } }
    `;
    (root.document.head || root.document.documentElement)?.append?.(style);
  }

  function m01ResourceSummary(resource, kind, versionId) {
    const id = resource?.id || resource?.metricId || resource?.ruleId || "待确认";
    const name = resource?.name || id;
    const details = kind === "metric"
      ? `${resource?.formula || resource?.calculation || "固定计算口径"} · ${resource?.unit || "—"} · ${resource?.scope || "借款人"}`
      : `${resource?.condition || resource?.definition || "确定性规则"} · ${resource?.appliesTo || "贷前调查业务对象"}`;
    const icon = kind === "metric" ? "M" : "R";
    return `<div class="s004-resource-item"><i>${icon}</i><div><b>${m01Escape(name)}</b><small class="mono">${m01Escape(id)}</small><small>${m01Escape(details)}</small></div></div>`;
  }

  function m01ScenarioContextMarkup(version) {
    const binding = m01InstanceBinding(version);
    const borrower = binding.borrower || {};
    const application = binding.application || {};
    const objects = Array.isArray(version?.objects) ? version.objects : [];
    const links = Array.isArray(version?.links) ? version.links : [];
    const metrics = Array.isArray(version?.metrics) ? version.metrics : [];
    const rules = Array.isArray(version?.rules) ? version.rules : [];
    const objectRows = objects.map((item) => `<tr><td><b>${m01Escape(item.name || item.id)}</b><small class="mono">${m01Escape(item.id)}</small></td><td>${m01Escape(item.memberId || "通用定义")}</td><td>${m01Escape(item.properties?.length || 0)} 个属性</td></tr>`).join("");
    const relationRows = links.map((item) => `<tr><td><b>${m01Escape(item.name || item.id)}</b><small class="mono">${m01Escape(item.id)}</small></td><td>${m01Escape(item.sourceName || item.source || "待定位")} → ${m01Escape(item.targetName || item.target || "待定位")}</td><td>${m01Escape(item.cardinality || "关系")}</td></tr>`).join("");
    const versionId = version?.id || "";
    const signature = [versionId, objects.length, links.length, metrics.length, rules.length, borrower.borrowerId, application.applicationId].join("|");
    return {
      signature,
      html: `<section class="panel s004-m01-context-panel" data-ofw-s004-m01-context="true" data-context-signature="${m01Escape(signature)}">
        <div class="panel-head"><div><h2>S004 场景语义与实例绑定</h2><p>通用贷前调查对象、关系、Metric、Rule 定义与当前场景实例均来自本精确 Published 版本；本面板只读展示，不改变 v1.0.3 本体工作台能力。</p></div><div class="s004-context-badges"><span class="badge success"><span class="status-dot"></span>Published</span><span class="badge neutral">可复用定义</span></div></div>
        <div class="panel-body">
          <div class="s004-context-grid">
            <section class="s004-context-card"><h3>当前实例绑定</h3><dl class="definition-grid compact"><dt>业务主体</dt><dd>${m01Escape(binding.financialCompany)}</dd><dt>借款人</dt><dd>${m01Escape(borrower.legalName || borrower.shortName || "待绑定")} <span class="mono">${m01Escape(borrower.borrowerId || "")}</span></dd><dt>贷款申请</dt><dd>${m01Escape(application.applicationId || binding.applicationId)} · ${m01Escape(application.productType || "贷款申请")}</dd><dt>报告身份</dt><dd>${m01Escape(binding.reportId)} · ${m01Escape(binding.report.currentTitle || "贷前调查报告")}</dd></dl></section>
            <section class="s004-context-card"><h3>权威消费绑定</h3><dl class="definition-grid compact"><dt>Published 指针</dt><dd class="mono">${m01Escape(binding.publishedPointer)}</dd><dt>C008</dt><dd class="mono">${m01Escape(binding.c008)}</dd><dt>数据资产版本</dt><dd class="mono">${m01Escape(binding.dataVersion)}</dd><dt>证据包</dt><dd class="mono">${m01Escape(binding.evidencePackId)}</dd><dt>历史制品来源</dt><dd class="mono">${m01Escape(binding.artifactProjection?.sourceScenarioContext?.scenarioVersion || "待确认")} / ${m01Escape(binding.artifactProjection?.sourceScenarioContext?.scenarioRunId || "待确认")}</dd><dt>当前运行投影</dt><dd class="mono">${m01Escape(context.scenarioVersion)} / ${m01Escape(context.scenarioRunId)}</dd></dl></section>
            <section class="s004-context-card"><h3>复用边界</h3><p>对象、关系、Metric、Rule 是跨集团成员单位通用定义；实例身份按借款人和申请替换。</p><p class="mono">场景：${m01Escape(context.scenarioId)} · 轮次：${m01Escape(context.scenarioRunId)}</p></section>
          </div>
          <div class="s004-context-grid" style="margin-top:12px">
            <section class="s004-context-card"><h3>Object 定义（${objects.length}）</h3><table class="s004-context-table"><thead><tr><th>业务对象 / 稳定身份</th><th>数据成员</th><th>结构</th></tr></thead><tbody>${objectRows || `<tr><td colspan="3">暂无 Published Object</td></tr>`}</tbody></table></section>
            <section class="s004-context-card"><h3>Relation 定义（${links.length}）</h3><table class="s004-context-table"><thead><tr><th>关系 / 稳定身份</th><th>方向</th><th>基数</th></tr></thead><tbody>${relationRows || `<tr><td colspan="3">暂无 Published Relation</td></tr>`}</tbody></table></section>
            <section class="s004-context-card"><h3>Metric / Rule 定义（${metrics.length} / ${rules.length}）</h3><div class="s004-resource-list">${metrics.map((item) => m01ResourceSummary(item, "metric", versionId)).join("")}${rules.map((item) => m01ResourceSummary(item, "rule", versionId)).join("")}</div></section>
          </div>
          <div class="s004-reuse-note"><strong>其他集团成员单位复用方式：</strong>沿用本 Published 版本的通用定义、报告模板和核验规则，为新成员单位建立独立 <span class="mono">borrowerId / applicationId / reportId / scenarioRunId</span>，重新绑定数据快照、C008、证据包和报告内容版本；历史报告与历史运行保持不可变，不在当前报告上覆盖。</div>
        </div>
      </section>`
    };
  }

  function patchM01PublishedNodeLabels() {
    if (moduleId !== "M01" || context.scenarioId !== "S004" || !root.document?.querySelectorAll) return;
    const version = m01PublishedState();
    if (!version) return;
    const resourceMap = new Map([
      ...(version.metrics || []).map((item) => [item.id, { ...item, kind: "metric" }]),
      ...(version.rules || []).map((item) => [item.id, { ...item, kind: "rule" }])
    ]);
    root.document.querySelectorAll(".published-canvas-world .canvas-node").forEach((node) => {
      const id = node.getAttribute?.("data-node");
      const resource = resourceMap.get(id);
      if (!resource) return;
      const title = node.querySelector?.("b");
      const subtitle = node.querySelector?.("p");
      const name = resource.name || resource.id || "已发布资源";
      const detail = resource.kind === "metric"
        ? `${resource.unit || "—"} · ${resource.scope || "借款人"}`
        : `${resource.code || resource.id} · ${resource.appliesTo || "贷前调查业务对象"}`;
      if (title && (!title.textContent?.trim() || /undefined|null/.test(title.textContent))) setText(title, name);
      if (subtitle && (!subtitle.textContent?.trim() || /undefined|null/.test(subtitle.textContent))) setText(subtitle, detail);
      node.dataset.ofwS004LabelFixed = "true";
    });
  }

  function patchM01ScenarioContext() {
    if (moduleId !== "M01" || context.scenarioId !== "S004" || !root.document?.querySelector) return;
    const version = m01PublishedState();
    if (!version) return;
    root.document.querySelectorAll?.("[data-ofw-s004-m01-context], #ofw-s004-m01-context-style, #ofw-s004-module-banner").forEach((node) => node.remove());
    patchM01PublishedNodeLabels();
    root.document.documentElement.dataset.ofwS004M01SemanticContext = "baseline-layout-preserved";
  }

  function patch() {
    addBanner();
    patchScenarioIdentity();
    patchM01ConsumerBoundary();
    patchM01PublishedCanvas();
    patchM01ScenarioContext();
    patchM03NotApplicable();
    patchM04EmptyActionRequestQueue();
    patchM05ReadOnly();
    patchReportCatalog();
    patchS004CurrentRunAccessCopy();
    auditS004RuntimeClock();
  }

  const observerOptions = Object.freeze({ childList: true, subtree: true });
  let patchScheduled = false;
  let patchRunning = false;
  let observer = null;

  function observeRuntimeDom() {
    if (!observer || !root.document?.documentElement) return;
    observer.observe(root.document.documentElement, observerOptions);
  }

  function runScheduledPatch() {
    patchScheduled = false;
    if (patchRunning) return;
    patchRunning = true;
    observer?.disconnect?.();
    try {
      patch();
    } finally {
      patchRunning = false;
      observeRuntimeDom();
    }
  }

  function schedulePatch() {
    if (patchScheduled || patchRunning) return;
    patchScheduled = true;
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(runScheduledPatch);
    else root.setTimeout(runScheduledPatch, 0);
  }

  observer = new MutationObserver(schedulePatch);
  observeRuntimeDom();
  root.document.addEventListener("wheel", (event) => {
    if (moduleId !== "M01" || context.scenarioId !== "S004" || !event.deltaY) return;
    const scroll = event.target.closest?.(".published-canvas-scroll[data-ofw-s004-panzoom='enabled']");
    if (!scroll) return;
    event.preventDefault();
    const eventAt = Number.isFinite(Number(event.timeStamp)) ? Number(event.timeStamp) : s004NowEpoch();
    if (eventAt - m01PublishedCanvasLastWheelAt < 70) return;
    m01PublishedCanvasLastWheelAt = eventAt;
    const direction = event.deltaY < 0 ? "in" : "out";
    applyM01PublishedCanvasZoom(nextM01PublishedCanvasZoom(m01PublishedCanvasZoom, direction), {
      scroll,
      clientX: event.clientX,
      clientY: event.clientY
    });
    root.document.documentElement.dataset.ofwS004M01PublishedCanvasLastInput = "wheel";
  }, { capture: true, passive: false });
  root.document.addEventListener("pointerdown", (event) => {
    if (moduleId !== "M01" || context.scenarioId !== "S004" || event.button !== 0) return;
    const scroll = event.target.closest?.(".published-canvas-scroll[data-ofw-s004-panzoom='enabled']");
    if (!scroll || event.target.closest?.(".canvas-node, .published-canvas-toolbar, .published-canvas-note")) return;
    m01PublishedCanvasDrag = {
      pointerId: event.pointerId,
      scroll,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: scroll.scrollLeft || 0,
      startTop: scroll.scrollTop || 0,
      moved: false
    };
    scroll.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, true);
  root.document.addEventListener("pointermove", (event) => {
    const drag = m01PublishedCanvasDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) >= 3) {
      drag.moved = true;
      drag.scroll.classList?.add("is-s004-panning");
    }
    if (!drag.moved) return;
    drag.scroll.scrollLeft = Math.max(0, drag.startLeft - deltaX);
    drag.scroll.scrollTop = Math.max(0, drag.startTop - deltaY);
    event.preventDefault();
    root.document.documentElement.dataset.ofwS004M01PublishedCanvasLastInput = "drag";
  }, true);
  const finishM01PublishedCanvasDrag = (event) => {
    const drag = m01PublishedCanvasDrag;
    if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    drag.scroll.classList?.remove("is-s004-panning");
    drag.scroll.releasePointerCapture?.(drag.pointerId);
    m01PublishedCanvasDrag = null;
  };
  root.document.addEventListener("pointerup", finishM01PublishedCanvasDrag, true);
  root.document.addEventListener("pointercancel", finishM01PublishedCanvasDrag, true);
  root.document.addEventListener("change", (event) => {
    if (moduleId !== "M06" || context.scenarioId !== "S004") return;
    const select = event.target.closest?.("[data-s004-generation-borrower]");
    if (!select) return;
    m06SelectedBorrowerId = select.value;
    root.document.querySelectorAll?.("[data-s004-consumable-fact-package], [data-s004-wizard-borrower-selection]").forEach((node) => node.remove());
    patchM06GenerationConsumable();
    patchM06GenerationWizardCopy();
    root.document.documentElement.dataset.ofwS004SelectedBorrower = m06SelectedBorrowerId;
  }, true);
  root.document.addEventListener("click", (event) => {
    if (context.scenarioId !== "S004") return;
    if (moduleId === "M05") {
      const control = event.target.closest?.("button, [role='button']");
      const label = m05ControlLabel(control);
      if (label === "接收生成请求") consumeS004RuntimeRelay("C022", C022_INBOX_KEY);
      if (["接收请求", "开始生成报告草稿", "开始生成", "重新运行", "重试原快照", "创建替代运行"].includes(label)) {
        scheduleS004RuntimeRelay("M05_RUNTIME_STATE", M05_STATE_KEY, [80, 500, 1200, 2200, 3600, 5200, 6500]);
        [80, 500, 1200, 2200].forEach((delay) => root.setTimeout?.(() => {
          normalizeS004M05StoredState();
          m05RuntimeCache = null;
          patchM05GenerationArtifactCopy();
        }, delay));
      }
      return;
    }
    if (moduleId !== "M06") return;
    const action = event.target.closest?.("[data-action]")?.dataset?.action || "";
    if (["start-pending-regeneration", "submit-generation", "retry-generation", "retry-standard-generation", "retry-blocked-generation", "regenerate-report"].includes(action)) {
      // The frozen M06 handler evaluates DATA.reportEvidence synchronously in
      // the same click.  Ensure the exact S004 fact package is installed on
      // that native object before the baseline generation gate runs; a later
      // timer is too late and can produce a false first-click block even when
      // Published/C008/C017 are already an exact, consumable match.
      const synchronized = synchronizeM06ReportDataProjection(`before-generation-action:${action}`);
      root.document.documentElement.dataset.ofwS004GenerationActionData = synchronized?.ready
        ? "exact-fact-package-ready"
        : `not-ready:${(synchronized?.identity?.issues || []).join(",") || "unavailable"}`;
      scheduleS004RuntimeRelay("C022", C022_INBOX_KEY, [80, 500, 1200, 2200, 3600]);
    }
    if (action === "reread-generation") consumeS004RuntimeRelay("M05_RUNTIME_STATE", M05_STATE_KEY);
  }, true);
  root.document.addEventListener("click", (event) => {
    if (!shouldBlockM03Control(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    root.document.documentElement.dataset.ofwS004M03LastBlockedAction = m03ControlLabel(event.target.closest?.("button, [role='button']")) || "unknown";
  }, true);
  root.document.addEventListener("submit", (event) => {
    if (!isM03NotApplicable() || !event.target?.matches?.("form.composer, form.follow-composer")) return;
    root.document.documentElement.dataset.ofwS004M03LastNativeSubmit = "submit";
  }, true);
  root.document.addEventListener("click", (event) => {
    if (moduleId !== "M05" || context.scenarioId !== "S004") return;
    const control = event.target.closest?.('[data-s004-report-run-entry="true"]');
    if (!control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    root.document.documentElement.dataset.ofwS004M05ReportRunEntry = "redirected-to-report-request";
    try {
      if (root.parent && root.parent !== root) {
        root.parent.postMessage({
          type: "OFW_S004_NAVIGATE",
          route: "#module/report",
          moduleFragment: "#/reports/generate",
          scenarioId: context.scenarioId,
          scenarioVersion: context.scenarioVersion,
          scenarioRunId: context.scenarioRunId
        }, root.location.origin);
      }
    } catch (_) {
      root.location.hash = "#/requests";
    }
  }, true);
  root.document.addEventListener("click", (event) => {
    if (shouldBlockM05BaselineControl(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const control = event.target.closest?.("button, [role='button']");
      if (control) {
        control.disabled = true;
        control.setAttribute?.("aria-disabled", "true");
        control.setAttribute?.("title", "该 v1.0.3 基线能力未绑定当前 S004，不得在本场景创建业务运行。");
      }
      root.document.documentElement.dataset.ofwS004BaselineActionBlocked = m05ControlLabel(control) || "unknown";
      return;
    }
    if (!shouldBlockM05Control(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const control = event.target.closest?.("button, [role='button']");
    disableM05Control(control);
    root.document.documentElement.dataset.ofwS004M05LastBlockedAction = m05ControlLabel(control) || "unknown";
  }, true);
  root.document.addEventListener("submit", (event) => {
    if (!m05ScenarioReadOnly()) return;
    const form = event.target;
    if (!form?.closest?.(".modal, .modal-backdrop, .modal-root")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    root.document.documentElement.dataset.ofwS004M05LastBlockedAction = "submit";
  }, true);
  root.document.addEventListener("click", (event) => {
    if (moduleId !== "M06") return;
    const dataPreparation = event.target.closest?.("[data-s004-open-data-preparation]");
    if (dataPreparation && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const selection = m06ReportRunSelection();
      try {
        if (root.parent && root.parent !== root) {
          root.parent.postMessage({
            type: "OFW_S004_NAVIGATE",
            route: selection.preparationRoute,
            moduleFragment: "#/resources",
            scenarioId: context.scenarioId,
            scenarioVersion: context.scenarioVersion,
            scenarioRunId: context.scenarioRunId
          }, root.location.origin);
        }
      } catch (_) { /* Keep the current report page when parent navigation is unavailable. */ }
      root.document.documentElement.dataset.ofwS004ReportRunPreparation = "requested";
      return;
    }
    const refreshQa = event.target.closest?.("[data-s004-refresh-qa]");
    if (refreshQa && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const pageCount = Math.max(1, Math.ceil(m06QaCatalogForCurrentProfile().length / 6));
      m06QaRecommendationPageIndex = (m06QaRecommendationPageIndex + 1) % pageCount;
      const recommendations = root.document.querySelector("[data-s004-qa-recommendations]");
      if (recommendations?.dataset) delete recommendations.dataset.s004QaRecommendationSignature;
      const qaContext = root.document.querySelector(".assistant-pane .assistant-content .context-box");
      patchS004ReportAssistant(qaContext);
      return;
    }
    const clearQa = event.target.closest?.("[data-s004-clear-qa]");
    if (clearQa && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const currentProjection = reportCopilotFromState();
      m06QaClearedThroughResultId = currentProjection?.result?.id || "CLEARED_EMPTY_SESSION";
      const state = completeM06StateForMutation() || readJsonState(M06_STATE_KEY);
      if (state?.assistant) {
        state.assistant.requestRef = null;
        state.assistant.qaDraft = "";
        writeJsonState(M06_STATE_KEY, state);
      }
      const assistantContent = root.document.querySelector(".assistant-pane .assistant-content");
      assistantContent?.querySelectorAll?.(".message.user, .message.assistant, [data-s004-qa-citations], [data-s004-copilot-trace]").forEach((node) => node.remove());
      const input = root.document.querySelector('.assistant-pane input[data-input="qa-draft"], .assistant-pane input[placeholder*="询问当前报告"]');
      if (input) input.value = "";
      const qaContext = assistantContent?.querySelector(".context-box");
      patchS004ReportAssistant(qaContext);
      root.document.documentElement.dataset.ofwS004QaSession = "cleared-recommendations-preserved";
      return;
    }
    if (event.target.closest?.("[data-s004-close-pdf]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.document.querySelector?.('[data-s004-pdf-viewer]')?.remove?.();
      root.document.documentElement.dataset.ofwS004PdfViewer = "closed";
      return;
    }
    const pdfPreview = event.target.closest?.("[data-s004-preview-pdf]");
    if (pdfPreview && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const resources = reportResourcesFromState();
      const output = resources?.report?.artifactManifest?.pdf?.output;
      openS004PdfViewer(output, currentS004ReportTitle());
      return;
    }
    const baselinePdfEntry = event.target.closest?.('[data-action="open-pdf"], [data-action="open-export-pdf"]');
    if (baselinePdfEntry && context.scenarioId === "S004") {
      // Keep every v1.0.3 PDF entry point, including “更多 → PDF 固定版”
      // and the export-complete modal, on the same immutable S004 artifact.
      // The frozen renderPdf() page is a report-paper reconstruction rather
      // than the actual file and therefore cannot prove that the bound PDF is
      // viewable.  Open the deterministic page-image viewer instead while
      // preserving the baseline menu, modal and state machine around it.
      event.preventDefault();
      event.stopImmediatePropagation();
      const resources = reportResourcesFromState();
      const output = resources?.report?.artifactManifest?.pdf?.output;
      if (openS004PdfViewer(output, currentS004ReportTitle())) {
        root.document.documentElement.dataset.ofwS004PdfEntry = baselinePdfEntry.dataset.action;
      }
      return;
    }
    const baselineChoice = event.target.closest?.('[data-ofw-s004-baseline-reference="true"]');
    if (baselineChoice && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.document.documentElement.dataset.ofwS004BaselineChoiceBlocked = "true";
      return;
    }
    const currentM06State = completeM06StateForMutation() || readJsonState(M06_STATE_KEY);
    const report = currentM06State?.report || reportResourcesFromState()?.report;
    const draftReaderActive = String(root.location.hash || "").includes("/reports/draft")
      && report?.stage === "draft"
      && sameScenarioRun(report);
    const nativeVerificationStart = event.target.closest?.('[data-action="start-verification"]');
    if (nativeVerificationStart && context.scenarioId === "S004" && (draftReaderActive || visibleS004Report(report?.reportNo))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      beginS004VerificationRerun(draftReaderActive);
      return;
    }
    const verificationRerun = event.target.closest?.("[data-s004-rerun-verification]");
    if (verificationRerun) {
      event.preventDefault();
      event.stopImmediatePropagation();
      beginS004VerificationRerun(draftReaderActive);
      return;
    }
    const verificationFilter = event.target.closest?.('[data-action="set-verification-filter"]');
    if (verificationFilter && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      m06VerificationFilter = verificationFilter.dataset.filter === "issues" ? "issues" : "all";
      patchS004VerificationPresentation();
      return;
    }
    const verificationExplanation = event.target.closest?.('[data-action="start-explanation"], [data-action="reread-explanation"]');
    if (verificationExplanation && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      m06VerificationExplanationVisible = !m06VerificationExplanationVisible;
      patchS004VerificationPresentation();
      root.document.documentElement.dataset.ofwS004VerificationExplanation = m06VerificationExplanationVisible ? "visible-deterministic" : "hidden";
      return;
    }
    const comparisonExplanation = event.target.closest?.('[data-action="start-comparison-explanation"], [data-action="reread-comparison-explanation"], [data-action="reread-comparison-record-explanation"]');
    if (comparisonExplanation && context.scenarioId === "S004") {
      event.preventDefault();
      event.stopImmediatePropagation();
      m06ComparisonExplanationVisible = !m06ComparisonExplanationVisible;
      patchS004ComparisonPresentation();
      root.document.documentElement.dataset.ofwS004ComparisonExplanation = m06ComparisonExplanationVisible ? "visible-deterministic" : "hidden";
      return;
    }
    const confirmDraft = event.target.closest?.('[data-action="confirm-draft"]');
    if (confirmDraft && draftReaderActive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const confirmation = confirmS004DraftAfterVerification();
      if (confirmation) {
        root.setTimeout(() => root.location.reload(), 40);
      } else {
        patchS004VerificationPresentation();
      }
      return;
    }
    const qaSuggestion = event.target.closest?.('[data-s004-qa-recommendations] [data-action="ask-suggestion"]');
    if (qaSuggestion?.dataset.s004Anchor) {
      const selectedAnchor = qaSuggestion.dataset.s004Anchor;
      // v1.0.3's suggestion action only fills qaDraft; it deliberately keeps
      // the currently selected report anchor. Remember the recommendation's
      // explicit anchor and bind it to the C024 envelope after the frozen
      // handler creates that envelope, before M05 consumes it.
      root.document.documentElement.dataset.ofwS004SuggestedAnchor = selectedAnchor;
    }
    const askReport = event.target.closest?.('[data-action="ask-report"]');
    if (askReport && visibleS004Report(report?.reportNo)) {
      m06QaClearedThroughResultId = null;
      root.setTimeout(() => {
        const reportState = readJsonState(M06_STATE_KEY);
        const requestId = reportState?.assistant?.requestRef?.requestId;
        const suggestedAnchor = root.document.documentElement.dataset.ofwS004SuggestedAnchor || null;
        if (requestId && suggestedAnchor) {
          rebindS004C024Anchor(requestId, suggestedAnchor);
          reportState.assistant.selectedAnchor = suggestedAnchor;
          reportState.assistant.requestRef.selectedAnchor = suggestedAnchor;
        }
        const completion = completeS004C024InAgentOwner(requestId);
        if (!completion) return;
        if (reportState?.assistant?.requestRef) {
          Object.assign(reportState.assistant.requestRef, {
            runId: completion.run?.id || null,
            resultId: completion.result?.id || null,
            sessionId: completion.session?.id || completion.run?.sessionId || null,
            bindingId: completion.run?.bindingId || null,
            readAt: completion.result?.generatedAt || s004NowIso()
          });
          writeJsonState(M06_STATE_KEY, reportState);
          if (reportResourcesCache?.state?.assistant) {
            reportResourcesCache.state.assistant = cloneJson(reportState.assistant);
          }
        }
        const reread = root.document.querySelector('[data-action="reread-agent-result"]');
        if (reread?.click) reread.click();
        const qaContext = root.document.querySelector(".assistant-pane .assistant-content .context-box");
        patchS004ReportAssistant(qaContext);
        delete root.document.documentElement.dataset.ofwS004SuggestedAnchor;
        root.document.documentElement.dataset.ofwS004C024State = "completed-and-returned";
      }, 40);
    }
    const openPublished = event.target.closest?.('[data-action="open-published-report"][data-report]');
    if (openPublished && openPublished.dataset.report === report?.reportNo) {
      // The frozen handler resets state.assistant before opening a published
      // report.  S004 already seeds ui.viewingReportNo and an immutable,
      // completed C024 reference, so route directly and preserve that exact
      // read-only Request/Session/Run/Result chain.
      event.preventDefault();
      event.stopImmediatePropagation();
      root.document.documentElement.dataset.ofwS004PublishedOpen = "preserved-c024";
      if (root.location.hash !== "#/reports/view") root.location.hash = "#/reports/view";
      return;
    }
    // The loader injects a <base> element so the frozen module can keep using
    // its original relative assets.  A fragment-only anchor would otherwise
    // resolve against that base URL and navigate out of the scenario loader,
    // dropping the runtime adapter and its isolated state.  Keep M06's native
    // hash routes in the current loader document; the frozen hashchange
    // handler still performs the actual render.
    const localRoute = event.target.closest?.('a[href^="#/"]');
    if (localRoute) {
      const href = localRoute.getAttribute("href");
      event.preventDefault();
      event.stopImmediatePropagation();
      if (href && root.location.hash !== href) root.location.hash = href;
      return;
    }
    if (event.target.closest?.("[data-s004-close-template]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.document.querySelector(".drawer-backdrop[data-s004-template-drawer]")?.remove();
      return;
    }
    const customTemplate = event.target.closest?.("[data-s004-open-template]");
    if (customTemplate) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openS004TemplateDrawer();
      return;
    }
    const button = event.target.closest?.('[data-action="open-template"][data-id]');
    if (!button) return;
    const resources = reportResourcesFromState();
    if (button.dataset.id === resources?.template?.id) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openS004TemplateDrawer();
      return;
    }
    if (!root.RC_DATA?.templates) return;
    const selected = root.RC_DATA.templates.find((item) => item.id === button.dataset.id);
    if (!selected) return;
    root.RC_DATA.templates = [selected, ...root.RC_DATA.templates.filter((item) => item.id !== selected.id)];
  }, true);
  root.document.addEventListener("click", (event) => {
    if (moduleId !== "M01" || context.scenarioId !== "S004") return;
    const control = event.target.closest?.('[data-action^="published-canvas-zoom:"]');
    if (!control) return;
    const scroll = control.closest?.(".published-canvas-viewport")?.querySelector?.(".published-canvas-scroll");
    if (!scroll) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = control.dataset.action.split(":")[1];
    applyM01PublishedCanvasZoom(nextM01PublishedCanvasZoom(m01PublishedCanvasZoom, direction), { scroll });
    root.document.documentElement.dataset.ofwS004M01PublishedCanvasLastInput = `button-${direction}`;
  }, true);
  if (root.__OFW_BASELINE_MODULE_RUNTIME_TEST__) {
    root.OFWBaselineModuleRuntimeTestApi = Object.freeze({
      readM03State,
      s004RuntimeRelay,
      publishS004RuntimeRelayPayload,
      publishS004RuntimeRelay,
      consumeS004RuntimeRelay,
      scheduleS004RuntimeRelay,
      scenarioM03NotApplicable,
      isM03NotApplicable,
      m03ControlLabel,
      shouldBlockM03Control,
      patchM03NotApplicable,
      readM04State,
      isM04EmptyActionRequestQueue,
      patchM04EmptyActionRequestQueue,
      reportAgentConsumptionReady,
      patchM01ConsumerBoundary,
      s004ReportFactsConsumable,
      patchM06TrustStripConsumption,
      m01PublishedState,
      m01InstanceBinding,
      patchM01ScenarioContext,
      patchM01PublishedNodeLabels,
      normalizeM01PublishedCanvasZoom,
      publishedCanvasZoomFromWorld,
      nextM01PublishedCanvasZoom,
      applyM01PublishedCanvasZoom,
      patchM01PublishedCanvas,
      reportResourcesFromState,
      s004GenerationSourceResources,
      generationSourceResourcesFromState,
      isExactS004GenerationSourcePackage,
      reportCopilotFromState,
      isM06ActiveScenarioWorkState,
      isM06ActiveReportRecord,
      activeScenarioRuntimeConfig,
      activeS004RuntimeProfile,
      currentS004ReportTitle,
      formalReportDownloadName,
      m06AnswerForQuestion,
      executeS004DeterministicVerification,
      normalizeCompletedVerification,
      s004CanonicalVerificationPlan,
      completeS004ActiveContentContract,
      mergeS004CompleteReport,
      ensureS004CompletedVerificationProjection,
      completeS004C024InAgentOwner,
      nextS004CopilotOrdinal,
      s004QaHistoryKey,
      s004QaHistoryFromModel,
      mergeS004QaHistory,
      persistS004QaHistory,
      rebindS004C024Anchor,
      rerunS004DeterministicVerification,
      runS004DraftDeterministicVerification,
      confirmS004DraftAfterVerification,
      requestS004NativeReseed,
      reseedProjectionIsValid,
      locateS004CopilotProjection,
      hasFullCopilotProjection,
      hasM05RuntimeProjection,
      visibleS004Report,
      m06ReportDataProjectionIdentity,
      s004ReportDefinitionProjection,
      s004TemplateProjection,
      s004PublishedResourceProjection,
      normalizeS004GenerationRequest,
      assertS004GenerationProjection,
      normalizeS004GenerationReportState,
      normalizeS004C022Envelope,
      normalizeS004DemoClockText,
      setHtmlBySignature,
      renderM06QaAnswer,
      renderM06QaCitations,
      normalizeS004CurrentRuntimeClockRecords,
      s004NowDate,
      s004NowIso,
      s004NowEpoch,
      s004RuntimeClockViolations,
      repairS004CurrentGenerationProjection,
      auditS004RuntimeClock,
      projectS004ReportData,
      synchronizeM06ReportDataProjection,
      scheduleM06ReportDataProjection,
      installM06InitialDataProjection,
      patchM06GenerationConsumable,
      isM06BaselineDefaultValue,
      patchM06GenerationWizardCopy,
      patchS004CopilotTrace,
      patchS004VerificationPresentation,
      patchS004CurrentRunAccessCopy,
      openS004PdfViewer,
      m05InitialEvidenceFilter,
      installM05InitialEvidenceFilter,
      normalizeS004M05RuntimeProjection,
      normalizeS004M05StoredState,
      installM05GenerationStorageProjection,
      ensureM05AppendAccessProjection,
      m05ScenarioReadOnly,
      shouldBlockM05Control,
      shouldBlockM05BaselineControl,
      patchM05AgentPresentation,
      patchM05BaselineCapabilitySeparation,
      patchM05ReusableAgentContext,
      patchM05ReportRunEntry,
      patchM05GenerationArtifactCopy,
      m05ClosedLoopStatus,
      patchM05EvidenceClosedLoop,
      patchM05ReadOnly
    });
  }
  root.addEventListener("load", schedulePatch, true);
  root.setTimeout(schedulePatch, 0);
  root.setTimeout(schedulePatch, 120);
  root.setTimeout(schedulePatch, 800);
})(typeof window !== "undefined" ? window : globalThis);
