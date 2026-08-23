(function (root) {
  "use strict";

  const D = root.IQDomain;
  const foundation = root.OFWScenarioFoundation;
  const queryServiceApi = root.S003QueryService;
  const variant = root.IQ_VARIANT;

  const CORE_IDS = Object.freeze({
    package: "S003-M01-DEBT-RISK-PKG",
    facts: "S003-PUBLISHED-RISK-FACTS-20251231-v2",
    results: "S003-C035-RISK-RESULTS-20251231-v2",
    queryCatalog: "S003-M03-QUERY-CATALOG-V3",
    runtime: "S003-M03-QUERY-RUNTIME",
    queryResults: "S003-M03-QUERY-RESULTS-20260817-002"
  });
  const ONTOLOGY_ID = "S003-M01-DEBT-RISK-PKG";
  const BASE_PUBLISHED_VERSION_ID = "S003-M01-DEBT-RISK-PKG@1.0.1";
  const RESOURCE_PATHS = Object.freeze({
    pointer: "../../../scenarios/s003/resources/m01/published-pointer.v2.json",
    c035: "../../../scenarios/s003/resources/m01/c035-risk-results.v2.json",
    facts: "../../../scenarios/s003/resources/m01/published-risk-facts.v2.json",
    actionTypes: "../../../scenarios/s003/resources/m01/action-type-catalog.v2.json",
    catalog: "../../../scenarios/s003/resources/m03/query-catalog.v3.json",
    runtime: "../../../scenarios/s003/resources/m03/query-runtime.v2.json",
    queryResults: "../../../scenarios/s003/resources/m03/query-results.v2.json"
  });
  const WORKSPACE_STATE_KEY = "workspace/state";
  const WORKSPACE_RECOVERY_STATE_KEY = "workspace/state.recovered.v1";
  const IDENTITY_COUNTER_KEY = "identity/counter";
  const QUERY_PREFIX = "S003-QRY-";
  const FORMAL_HISTORY_QUERY_IDS = Object.freeze(["S003-QRY-001", "S003-QRY-002", "S003-QRY-003"]);
  const ACTIVE_CONTEXT_STATUSES = Object.freeze(["active"]);
  const ZERO_SIDE_EFFECTS = Object.freeze({
    mutatesPublishedFacts: false,
    createsActionRequest: false,
    createsTodo: false,
    sendsNotification: false
  });
  const TIER_LABELS = Object.freeze({GREEN: "绿灯", YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯"});
  // The desktop host clock can differ from the controlled prototype review date.
  // Keep S003 user-visible operation timestamps deterministic and within the
  // validated scene date instead of leaking the host date into query history.
  const S003_REVIEW_CLOCK = Object.freeze({
    iso: "2026-08-16T04:00:00.000Z",
    display: "2026-08-16 12:00:00"
  });
  const s003IsoNow = () => S003_REVIEW_CLOCK.iso;
  const s003DisplayNow = () => S003_REVIEW_CLOCK.display;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function publishedVersionId(packageVersion) {
    const version = String(packageVersion || "1.0.1");
    return version === "1.0.1" ? BASE_PUBLISHED_VERSION_ID : `${CORE_IDS.package}@${version}`;
  }

  function readScenarioContext() {
    const params = new URLSearchParams(root.location.search);
    const rawStatus = params.get("scenarioStatus") || params.get("status") || "active";
    const supported = ["active", "historical-readonly", "restored", "regression", "migrated", "closed"];
    return {
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"),
      status: supported.includes(rawStatus) ? rawStatus : "active"
    };
  }

  function isActive() {
    return readScenarioContext().scenarioId === "S003";
  }

  if (!D || !variant || !isActive()) {
    root.S003IQNativeBridge = Object.freeze({isActive: false});
    return;
  }

  const originals = Object.freeze({
    createInitialState: D.createInitialState,
    loadState: D.loadState,
    saveState: D.saveState,
    resetState: D.resetState,
    nextStableId: D.nextStableId,
    resolveQuestion: D.resolveQuestion,
    materializeResult: D.materializeResult,
    verifyFixedResult: D.verifyFixedResult,
    validateRunContext: D.validateRunContext,
    matchApplicableAgents: D.matchApplicableAgents,
    readRuntimeContext: D.readRuntimeContext,
    readOntologyContext: D.readOntologyContext,
    readPublishedOntologyContext: D.readPublishedOntologyContext,
    readOntologyBindingContext: D.readOntologyBindingContext,
    readCandidateConsumptionContext: D.readCandidateConsumptionContext,
    projectRuntimeContext: D.projectRuntimeContext,
    attachScenarioContext: D.attachScenarioContext,
    projectRuntimeContextForScenario: D.projectRuntimeContextForScenario,
    runtimeContextMatches: D.runtimeContextMatches,
    deriveConfigRuntimeState: D.deriveConfigRuntimeState,
    recommendationEligibility: D.recommendationEligibility,
    recommendableQuestions: D.recommendableQuestions,
    queryDefinition: D.queryDefinition,
    csvEligibility: D.csvEligibility,
    actionEligibility: D.actionEligibility,
    publishActionRequestInbox: D.publishActionRequestInbox,
    validateFixedQuestionSet: D.validateFixedQuestionSet,
    validateCandidateFixedQuestionSet: D.validateCandidateFixedQuestionSet,
    buildOntologyDeepLink: D.buildOntologyDeepLink
  });

  const runtimeState = {
    status: "loading",
    error: null,
    data: null,
    queryService: null,
    context: null,
    resources: null,
    projectionIssue: null,
    workspaceStateKey: WORKSPACE_STATE_KEY
  };

  function contextIsActive(context = readScenarioContext()) {
    return ACTIVE_CONTEXT_STATUSES.includes(context?.status);
  }

  function projectionIssue(reason, recovery, code = "INCOMPATIBLE_PROJECTION") {
    runtimeState.projectionIssue = {
      code,
      reason,
      recovery: recovery || "原记录保持原位且不参与当前投影；请从当前 Published 输入重建新的工作投影。",
      isolated: true,
      detectedAt: s003IsoNow()
    };
    return runtimeState.projectionIssue;
  }

  function assertAvailableDependencies() {
    if (!foundation || typeof foundation.assertScenarioContext !== "function") {
      throw new Error("场景公共底座未加载，M03 已保持阻断");
    }
    if (!queryServiceApi || typeof queryServiceApi.createQueryService !== "function") {
      throw new Error("S003 Published 问数服务未加载，M03 已保持阻断");
    }
  }

  function assertSameTriple(expected, actual, label) {
    const fields = ["scenarioId", "scenarioVersion", "scenarioRunId"];
    const mismatches = fields.filter((field) => !actual || expected[field] !== actual[field]);
    if (mismatches.length) throw new Error(`${label}与当前场景运行身份不一致：${mismatches.join("、")}`);
  }

  function assertPublishedBundle(context, data) {
    foundation.assertScenarioContext(context);
    assertSameTriple(context, data.pointer.scenarioIdentity, "Published 指针");
    assertSameTriple(context, data.c035.scenarioIdentity, "C035 结果集");
    assertSameTriple(context, data.facts.scenarioIdentity, "Published 事实集");
    assertSameTriple(context, data.actionTypes.scenarioIdentity, "Published Action Type 目录");
    assertSameTriple(context, data.queryResults.scenarioIdentity, "M03 正式结果集");
    const target = data.pointer.activeTarget || {};
    if (target.packageId !== CORE_IDS.package || target.lifecycleStatus !== "published") {
      throw new Error("当前 Published 指针没有锁定 S003 已发布模型包");
    }
    if (data.c035.resultSetId !== CORE_IDS.results || data.c035.status !== "published-results") {
      throw new Error("C035 正式结果集不可消费");
    }
    if (data.facts.factSetId !== CORE_IDS.facts || data.facts.status !== "published") {
      throw new Error("债务风险 Published 事实集不可消费");
    }
    if (data.actionTypes.lifecycleStatus !== "published"
      || data.actionTypes.publishedModelBinding?.packageId !== target.packageId
      || data.actionTypes.publishedModelBinding?.packageVersion !== target.packageVersion) {
      throw new Error("M03 无法定位当前 Published 模型对应的 Action Type 目录");
    }
    const policy = data.runtime.scenarioIdentityPolicy || {};
    if (policy.scenarioId !== context.scenarioId || policy.scenarioVersion !== context.scenarioVersion || policy.scenarioRunId !== "must-exactly-match-current-published-run") {
      throw new Error("M03 问数运行身份策略与当前场景不一致");
    }
    if (data.queryResults.runtimeId !== data.runtime.runtimeId || data.queryResults.runtimeVersion !== data.runtime.runtimeVersion) {
      throw new Error("M03 正式结果集没有绑定当前只读运行版本");
    }
    if (data.queryResults.resultSetId !== CORE_IDS.queryResults || data.queryResults.immutable !== true) {
      throw new Error("M03 正式结果集不是当前不可变 Published 固定结果");
    }
    FORMAL_HISTORY_QUERY_IDS.forEach((queryId) => {
      const execution = (data.queryResults.executions || []).find((item) => item?.output?.queryId === queryId);
      if (!execution?.output || execution.output.readOnly !== true || execution.output.mode !== "read-only-published-facts") {
        throw new Error(`M03 正式联调执行证据 ${queryId} 不完整或不是只读结果`);
      }
      assertSameTriple(context, execution.output.scenarioIdentity, `M03 正式联调执行证据 ${queryId}`);
      if (Object.entries(ZERO_SIDE_EFFECTS).some(([key, value]) => execution.output.sideEffects?.[key] !== value)) {
        throw new Error(`M03 正式联调执行证据 ${queryId} 混入副作用`);
      }
    });
    if (data.catalog.catalogId !== CORE_IDS.queryCatalog || data.catalog.status !== "published-query-catalog" || data.catalog.immutable !== true) {
      throw new Error("M03 当前 Published 问题目录不可消费");
    }
    const catalogDefinitions = (data.catalog.queries || []).map((item) => ({
      queryId: item.queryId,
      question: item.question,
      resultShape: item.resultShape,
      requiresEnterpriseId: item.requiresEnterpriseId === true
    }));
    const serviceDefinitions = (queryServiceApi.QUERY_DEFINITIONS || []).map((item) => ({
      queryId: item.queryId,
      question: item.question,
      resultShape: item.resultShape,
      requiresEnterpriseId: item.requiresEnterpriseId === true
    }));
    if (JSON.stringify(catalogDefinitions) !== JSON.stringify(serviceDefinitions)) {
      throw new Error("M03 Published 问题目录与只读问数服务定义不一致");
    }
    const summary = data.queryResults.summary || {};
    if ([summary.actionRequestsCreated, summary.todosCreated, summary.notificationsDispatched, summary.publishedFactsMutated].some((value) => Number(value || 0) !== 0)) {
      throw new Error("M03 正式结果证据混入了副作用，已拒绝消费");
    }
  }

  function makeResources(data) {
    const target = data.pointer.activeTarget;
    const model = target.publishedSnapshot || {};
    const publishedAt = data.pointer.switchedAt;
    const common = (resource) => ({
      ...resource,
      owner: resource.owner || "财务公司",
      status: "已发布",
      lifecycleStatus: "published",
      version: target.packageVersion,
      effectivePeriod: `${publishedAt || "已发布"} 起`,
      replacementFact: "当前 Published 版本有效"
    });
    const properties = [
      ["S003-PROP-ENTERPRISE-ID", "企业标识", "文本", "企业稳定身份"],
      ["S003-PROP-ENTERPRISE-NAME", "企业名称", "文本", "企业展示名称"],
      ["S003-PROP-ENTERPRISE-CATEGORY", "企业类别", "枚举", "新能源产业-风电、核电、环保或在建企业"],
      ["S003-PROP-ASSESSMENT-AT", "评估时点", "日期", "本轮风险评估固定时点"],
      ["S003-PROP-FINAL-SCORE", "综合风险得分", "数值", "财务原始得分叠加调节因子后的最终评分"],
      ["S003-PROP-RISK-TIER", "风险分档", "枚举", "绿灯、黄灯、红灯或黑灯"]
    ].map(([id, name, dataType, definition]) => common({id, name, type: "Property", dataType, definition, scope: "债务风险评估企业"}));
    const metrics = (model.indicatorOrder || []).map((name, index) => common({
      id: `S003-METRIC-${String(index + 1).padStart(2, "0")}`,
      name,
      type: "Metric",
      unit: "分",
      scope: "企业 × 评估时点",
      definition: `${name}的债务风险评分指标，按当前 Published 模型公式计算。`,
      calculation: model.formulas?.[name] || "按 Published 公式计算",
      time: data.c035.assessmentAt
    }));
    metrics.push(common({
      id: "S003-METRIC-FINAL-SCORE",
      name: "综合风险得分",
      type: "Metric",
      unit: "分",
      scope: "企业 × 评估时点",
      definition: "财务原始得分叠加调节因子后的最终风险评分。",
      calculation: model.assessment?.formula || "round(clamp(rawScore × (1 + factorSum), 0, 100), 2)",
      time: data.c035.assessmentAt
    }));
    const factorRuleId = (factor, index) => {
      const stable = String(factor?.factorId || String(index + 1).padStart(2, "0"))
        .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return `S003-RULE-FACTOR-${stable || String(index + 1).padStart(2, "0")}`;
    };
    const factorRules = (model.factors || []).map((factor, index) => common({
      id: factorRuleId(factor, index),
      name: `调节因子：${factor.name}`,
      type: "Rule",
      scope: (factor.applicableCategories || []).join("、") || "适用企业",
      definition: `定义${factor.name}的业务分档和调节系数；企业取值在 M01 统一配置页维护，M02 仅负责人工业务输入快照的版本、校验与发布。`,
      condition: (factor.tiers || []).map((tier) => `${tier.label}（${tier.coefficient}）`).join("；")
    }));
    const tierRules = (model.riskTiers || []).map((tier, index) => common({
      id: `S003-RULE-RISK-${tier.tierId || String(index + 1).padStart(2, "0")}`,
      name: `风险分档：${tier.name}`,
      type: "Rule",
      scope: "债务风险评估企业",
      definition: `将企业综合风险得分划入${tier.name}。`,
      condition: tier.maxExclusive == null ? `综合得分 ≥ ${tier.minInclusive}` : `${tier.minInclusive} ≤ 综合得分 < ${tier.maxExclusive}`
    }));
    const invariantRules = [
      ["S003-RULE-UNDER-CONSTRUCTION-60", "在建企业固定 60 分", "在建企业财务原始得分固定为 60，仍叠加适用调节因子。"],
      ["S003-RULE-HISTORY-DEFAULT-A", "盈利历史不足按 A", "盈利历史不足时，盈利稳定性按 A 档（100 分）。"],
      ["S003-RULE-MISSING-FACTOR-ZERO", "缺失因子套 0 档", "因子适用但缺失时采用 0 系数档；NOT_APPLICABLE 与缺失严格分离。"]
    ].map(([id, name, definition]) => common({id, name, type: "Rule", scope: "债务风险评估企业", definition, condition: definition}));
    const actionTypes = (model.actionTypes || []).map((action, index) => {
      const catalog = (data.actionTypes.actionTypes || []).find((item) => item.actionTypeId === action.actionTypeId) || {};
      return common({
        id: action.actionTypeId || `S003-ACTION-${String(index + 1).padStart(2, "0")}`,
        name: catalog.displayName || action.actionTypeId,
        type: "Action Type",
        scope: "债务风险评估企业",
        definition: catalog.description || "人工确认后通过通用 Action Request 进入决策中心。",
        prerequisite: "Published 风险事实可追溯且用户完成人工确认"
      });
    });
    return [
      common({
        id: "S003-OBJ-DEBT-RISK-ENTERPRISE",
        name: "债务风险评估企业",
        type: "Object Type",
        scope: `${data.facts.factCount} 家企业 · ${data.facts.assessmentAt}`,
        definition: "在同一评估时点形成财务指标、调节因子、风险评分、分档与报告的集团所属企业。"
      }),
      ...properties,
      ...metrics,
      ...factorRules,
      ...tierRules,
      ...invariantRules,
      ...actionTypes,
      {
        id: target.packageId,
        name: "债务风险评估 Published 模型包",
        type: "Published Model Package",
        owner: "M01 本体管理",
        status: "已发布",
        version: target.packageVersion,
        scope: "风险评分、调节因子、分档与行动类型的原子发布包"
      },
      {
        id: data.facts.factSetId,
        name: "企业债务风险 Published 事实集",
        type: "Published Fact Set",
        owner: data.facts.owner || "M01 本体管理",
        status: "已发布",
        version: data.facts.factSetVersion,
        scope: `${data.facts.factCount} 家企业 · ${data.facts.assessmentAt}`
      },
      {
        id: data.c035.resultSetId,
        name: "企业债务风险 C035 正式结果集",
        type: "C035 Result Set",
        owner: "M01 本体管理",
        status: "已发布",
        version: data.c035.resultSetVersion,
        scope: `${data.c035.results.length} 家企业 · 只读证据来源`
      },
      {
        id: data.catalog.catalogId,
        name: "债务风险 Published 问题目录",
        type: "Published Query Catalog",
        owner: data.catalog.moduleOwner || "M03 智能问数",
        status: "已发布",
        version: data.catalog.catalogVersion,
        scope: `${data.catalog.queries.length} 个固定只读问题 · 与问数服务定义逐项校验`
      },
      {
        id: data.runtime.runtimeId,
        name: "S003 Published 事实只读问数运行",
        type: "Query Runtime",
        owner: "M03 智能问数",
        status: "已实现",
        version: data.runtime.runtimeVersion,
        scope: "仅消费 C008 / T019 / C035"
      },
      {
        id: data.queryResults.resultSetId,
        name: "S003 正式问数结果证据集",
        type: "Query Result Set",
        owner: "M03 智能问数",
        status: "已固定",
        version: data.queryResults.resultSetVersion,
        scope: `${data.queryResults.summary.queryCount} 个固定只读问题`
      }
    ];
  }

  function makeRuntimeContext(data, resources) {
    const context = readScenarioContext();
    const target = data.pointer.activeTarget;
    const versionId = publishedVersionId(target.packageVersion);
    const dataVersion = data.c035.inputIdentity?.dataAssetId || data.c035.dataIdentity?.dataVersion || data.c035.resultSetVersion;
    const t019RecordId = "S003-M01-RECORD-ADOPT";
    const t019EvidenceCode = data.pointer.pointerId || data.facts.sourceResultSet?.sha256;
    const active = contextIsActive(context);
    const fingerprint = [
      context.scenarioId,
      context.scenarioVersion,
      context.scenarioRunId,
      target.packageId,
      target.packageVersion,
      versionId,
      dataVersion,
      data.facts.factSetId,
      data.facts.factSetVersion,
      data.c035.resultSetId,
      data.c035.resultSetVersion,
      data.queryResults.resultSetId,
      data.queryResults.resultSetVersion
    ].join("|");
    return {
      ready: active,
      blocked: !active,
      past: !active,
      discoverable: true,
      formalAnswerable: active,
      allowConsumption: active,
      evidenceComplete: true,
      status: active ? "可消费" : "场景运行只读",
      reason: active ? "Published 模型、T019 事实和 C035 结果已精确绑定" : `${context.status || "unknown"} 上下文只允许查看已有问数运行，不允许创建新查询`,
      recovery: active ? "" : "返回当前 active scenarioRunId 后重新运行",
      recoveryOwner: "ontology",
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      scenarioFormedAt: context.formedAt,
      scenarioStatus: context.status,
      scenarioReferenceStatus: context.status,
      projectionId: data.facts.factSetId,
      projectionVersion: data.facts.factSetVersion,
      projectionFormedAt: data.facts.formedAt,
      versionId,
      semanticVersion: target.packageVersion,
      dataVersion,
      asOf: data.c035.assessmentAt,
      asOfSource: "C035 正式结果集",
      asOfEvidenceId: data.c035.resultSetId,
      asOfPrecision: "date",
      timezone: "Asia/Shanghai",
      t019Ref: `${t019RecordId}@${dataVersion}`,
      t019RecordId,
      t019EvidenceCode,
      quality: "通过",
      qualityEvidenceId: data.facts.sourceResultSet.sha256,
      freshness: "评估时点已固定",
      freshnessStatus: "可消费",
      freshnessBasis: `评估时点 ${data.c035.assessmentAt}`,
      freshnessEvidenceId: data.c035.resultSetId,
      lastSuccessfulAt: data.c035.formedAt,
      resources: clone(resources),
      resourceContractFingerprint: `S003-M03-RESOURCES|${resources.map((item) => `${item.id}@${item.version}`).join("|")}`,
      runtimeContextFingerprint: fingerprint,
      inputFingerprint: fingerprint,
      authorityMode: "published-runtime",
      projectionOnly: false,
      immutable: true,
      contracts: ["C008", "T019", "C035"],
      readAt: s003IsoNow()
    };
  }

  function makeConfig(context) {
    const skills = clone((D.SKILLS || []).slice(0, 3));
    const tools = clone((D.TOOLS || []).filter((tool) => tool.id !== "TOOL-IQ-ACTION-REQUEST"));
    const observedSkills = skills.map((item) => ({id: item.id, version: item.version, status: "已加载"}));
    const observedTools = tools.map((item) => ({id: item.id, version: item.version, status: "可用"}));
    const resourceIds = runtimeState.resources?.length
      ? runtimeState.resources.map((resource) => resource.id)
      : Object.values(CORE_IDS);
    return {
      id: "IQ-PLATFORM-S003-PUBLISHED-READONLY",
      name: "债务风险问数助手",
      scene: "集团债务风险监测",
      sceneId: context.scenarioId,
      sceneVersion: context.scenarioVersion,
      sceneRunId: context.scenarioRunId,
      sceneVersionStatus: context.status,
      status: "已启用",
      compatibility: runtimeState.status === "ready" ? "兼容" : "待核对上游正式绑定",
      version: "IQ-PLATFORM-S003-CFG-1.0",
      promptVersion: "IQ-S003-PUBLISHED-READONLY-PROMPT-1.0",
      whitelistVersion: "IQ-S003-PUBLISHED-RESOURCE-WL-1.0",
      bindingVersion: runtimeState.context ? `${runtimeState.context.semanticVersion} · ${runtimeState.context.versionId}` : "等待精确 Published 绑定",
      bindingVersionId: runtimeState.context ? runtimeState.context.versionId : CORE_IDS.package,
      semanticVersion: runtimeState.context ? runtimeState.context.semanticVersion : "1.0.1",
      contentFingerprint: "IQ-S003-PUBLISHED-READONLY-CFG-V1",
      resourceContractFingerprint: runtimeState.context ? runtimeState.context.resourceContractFingerprint : `S003-M03-RESOURCES|${resourceIds.join("|")}`,
      validationRef: runtimeState.data ? runtimeState.data.queryResults.resultSetId : CORE_IDS.queryResults,
      compatibilityOwner: "M03 智能问数",
      owner: "M03 智能问数",
      skills,
      observedSkills,
      tools,
      observedTools,
      deterministicCapabilities: clone(D.PLATFORM_CAPABILITIES || []),
      loadProof: `S003QueryService ${queryServiceApi && queryServiceApi.SERVICE_VERSION || "1.0.0"} · Published-only`,
      lastRuntimeVerificationAt: runtimeState.data ? runtimeState.data.queryResults.formedAt : context.formedAt,
      allowedResources: resourceIds,
      allowedActions: ["导出当前结果 CSV", "保存问数视图", "固定视图引用"],
      actionRequestForbidden: true,
      dataScope: "当前 S003 场景运行内已发布的债务风险模型、企业风险事实和 C035 正式结果",
      readOnlyBoundary: "只解释和展示已发布结果；不重算评分、不修改模型配置、不创建行动申请、负责人待办或通知",
      sourceContracts: ["C008", "T019", "C035"],
      c009Validation: runtimeState.context ? {
        owner: "智能问数",
        status: "通过",
        versionId: runtimeState.context.versionId,
        semanticVersion: runtimeState.context.semanticVersion,
        sceneId: context.scenarioId,
        sceneVersion: context.scenarioVersion,
        sceneRunId: context.scenarioRunId,
        dataVersion: runtimeState.context.dataVersion,
        asOf: runtimeState.context.asOf,
        t019EvidenceCode: runtimeState.context.t019EvidenceCode,
        configFingerprint: "IQ-S003-PUBLISHED-READONLY-CFG-V1",
        resourceContractFingerprint: runtimeState.context.resourceContractFingerprint,
        runtimeContextFingerprint: runtimeState.context.runtimeContextFingerprint
      } : null
    };
  }

  const QUERY_PRESENTATION = Object.freeze({
    "S003-QRY-001": Object.freeze({title: "集团风险分档分布", theme: "风险总览", resources: [CORE_IDS.facts, CORE_IDS.results]}),
    "S003-QRY-002": Object.freeze({title: "红黑灯企业", theme: "风险企业", resources: [CORE_IDS.facts, CORE_IDS.results]}),
    "S003-QRY-003": Object.freeze({title: "企业风险评估详情", theme: "企业详情", resources: [CORE_IDS.package, CORE_IDS.results], exampleEnterpriseName: "风电测试公司01"}),
    "S003-QRY-004": Object.freeze({title: "企业最低三项指标", theme: "指标弱项", resources: [CORE_IDS.package, CORE_IDS.results], exampleEnterpriseName: "风电测试公司01"}),
    "S003-QRY-005": Object.freeze({title: "因子缺失与不适用", theme: "因子语义", resources: [CORE_IDS.package, CORE_IDS.results]}),
    "S003-QRY-006": Object.freeze({title: "待接口人确认的亮灯预警", theme: "亮灯预警", resources: [CORE_IDS.package, CORE_IDS.results]})
  });
  const VALIDATION_EXPECTATIONS = Object.freeze({
    "S003-QRY-001": "核对风险分档计数、企业总数与 Published 结果逐项一致。",
    "S003-QRY-002": "核对红黑灯企业清单、评分、分档和企业稳定身份。",
    "S003-QRY-003": "核对单家企业评分、风险分档、指标与调节因子详情。",
    "S003-QRY-004": "核对最低三项指标的顺序、得分和逐项证据。",
    "S003-QRY-005": "核对缺失套零、环保企业不适用和因子来源语义。",
    "S003-QRY-006": "核对黄灯、红灯、黑灯按亮灯逐户形成预警；问数仅只读展示，不创建行动申请、待办或通知。"
  });

  function displayedQuestion(definition, presentation) {
    if (!presentation?.exampleEnterpriseName) return definition.question;
    return definition.question.replace("指定企业", presentation.exampleEnterpriseName);
  }

  const PUBLISHED_QUERY_DEFINITIONS = Object.freeze(
    (queryServiceApi?.QUERY_DEFINITIONS || []).map((definition) => Object.freeze(clone(definition)))
  );
  const RECOMMENDED_QUESTIONS = Object.freeze(PUBLISHED_QUERY_DEFINITIONS.map((definition) => {
    const presentation = QUERY_PRESENTATION[definition.queryId];
    if (!presentation) throw new Error(`S003 问数定义缺少展示配置：${definition.queryId}`);
    return Object.freeze({
      id: definition.queryId,
      title: presentation.title,
      question: displayedQuestion(definition, presentation),
      theme: presentation.theme,
      resources: clone(presentation.resources),
      resultShape: definition.resultShape,
      requiresEnterpriseId: definition.requiresEnterpriseId === true,
      definitionSource: "S003QueryService.QUERY_DEFINITIONS"
    });
  }));

  const VALIDATION_QUESTIONS = Object.freeze(RECOMMENDED_QUESTIONS.map((item, index) => Object.freeze({
    id: `S003-CVQ-${String(index + 1).padStart(2, "0")}`,
    templateId: item.id,
    question: item.question,
    expected: VALIDATION_EXPECTATIONS[item.id]
  })));

  function templateFor(queryId) {
    const recommended = RECOMMENDED_QUESTIONS.find((item) => item.id === queryId);
    if (!recommended) return null;
    return {
      id: queryId,
      title: recommended.title,
      scope: [],
      resourceIds: clone(recommended.resources),
      rows: [],
      chart: {recommended: "bar", allowed: ["bar", "table"]},
      nextQuestions: []
    };
  }

  RECOMMENDED_QUESTIONS.forEach((item) => {
    D.RESULT_TEMPLATES[item.id] = templateFor(item.id);
  });

  function storageAdapter() {
    const context = readScenarioContext();
    foundation.assertScenarioContext(context);
    if (!contextIsActive(context)) return null;
    return foundation.createNamespacedStorage({storage: root.localStorage, context, scope: "m03"});
  }

  function historicalState() {
    const context = readScenarioContext();
    const physicalKey = `ofw:v1.1.0:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}:m03:${encodeURIComponent(WORKSPACE_STATE_KEY)}`;
    const raw = root.localStorage.getItem(physicalKey);
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw);
      if (envelope.schemaVersion !== foundation.STORAGE_SCHEMA_VERSION) {
        projectionIssue(
          `M03 当前工作投影 schemaVersion 不兼容（${envelope.schemaVersion || "缺失"}）`,
          "该记录已按原物理键隔离保留；当前页面只从正式 Published 输入建立新的空工作投影。"
        );
        return null;
      }
      foundation.assertScenarioContextMatch(context, envelope.scenarioContext);
      return envelope.payload || null;
    } catch (error) {
      projectionIssue(
        `M03 当前工作投影不可读取：${error?.message || "记录损坏"}`,
        "该记录已隔离保留且不会进入正式消费；请保留历史证据并从当前 Published 输入重建工作投影。",
        "CORRUPT_PROJECTION"
      );
      return null;
    }
  }

  function adaptState(source) {
    const initial = originals.createInitialState();
    const current = readScenarioContext();
    const config = makeConfig(current);
    const stored = source && typeof source === "object" ? clone(source) : {};
    const isS003Run = (run) => Boolean(run?.context?.scenarioId
      && run.context.scenarioId === current.scenarioId
      && run.context.scenarioVersion === current.scenarioVersion
      && run.context.scenarioRunId === current.scenarioRunId
    );
    const isS003View = (view) => Boolean(view?.queryDefinition?.sceneId === current.scenarioId
      && view.queryDefinition.sceneVersion === current.scenarioVersion
      && view.queryDefinition.sceneRunId === current.scenarioRunId);
    const isS003Pin = (pin) => Boolean(pin?.deliverySnapshot?.scenarioId === current.scenarioId
      && pin.deliverySnapshot.scenarioVersion === current.scenarioVersion
      && pin.deliverySnapshot.scenarioRunId === current.scenarioRunId);
    const liveRuns = (stored.liveRuns || []).filter(isS003Run);
    const storedHistoryRuns = (stored.historyRuns || []).filter(isS003Run);
    const legacyPublishedExampleRuns = storedHistoryRuns.filter((run) => String(run?.id || "").startsWith("S003-M03-HISTORY-"));
    const persistedHistoryRuns = storedHistoryRuns.filter((run) => !String(run?.id || "").startsWith("S003-M03-HISTORY-") && !isFormalHistoryRun(run));
    const historyRuns = [...formalHistoryRuns(), ...persistedHistoryRuns];
    const allRunIds = new Set([...liveRuns, ...historyRuns].map((run) => run.id));
    const defaultRecommendations = {
      status: "成功",
      attempt: 1,
      items: RECOMMENDED_QUESTIONS.map((item) => ({...clone(item), resourceLabels: ["债务风险 Published 模型", "企业风险正式结果"]})),
      error: null,
      generatedAt: runtimeState.data?.queryResults?.formedAt || current.formedAt
    };
    return {
      ...initial,
      ...stored,
      schemaVersion: D.STATE_SCHEMA_VERSION,
      activeConfig: config,
      enabledConfigs: [clone(config)],
      candidateConfig: {
        ...clone(config),
        id: "IQ-PLATFORM-S003-PUBLISHED-READONLY-CANDIDATE",
        name: "债务风险问数助手配置候选",
        status: "候选",
        compatibility: "待验证",
        candidateRevision: Number(stored.candidateConfig?.candidateRevision || 0),
        validation: clone(stored.candidateConfig?.validation || {status: "未开始", attempt: 0, repaired: false, tests: []})
      },
      recommendations: stored.recommendations?.items?.some((item) => String(item?.id || "").startsWith(QUERY_PREFIX))
        ? stored.recommendations
        : defaultRecommendations,
      liveRuns,
      historyRuns,
      currentRunId: allRunIds.has(stored.currentRunId) ? stored.currentRunId : null,
      savedViews: (stored.savedViews || []).filter(isS003View).map((view) => view?.seededFromPublishedResult === true
        ? {...view, publishedExample: true, sourceLabel: "Published 问题示例", lastRunId: null}
        : view),
      pins: (stored.pins || []).filter(isS003Pin),
      actionRequests: [],
      historicalActionRequests: [],
      currentScenario: "S003",
      legacyPublishedExampleRuns: legacyPublishedExampleRuns.map((run) => ({
        ...run,
        recordType: "published-example-legacy",
        projectionStatus: "reclassified",
        reclassificationReason: "旧版预置问数结果缺少真实执行身份，已从历史会话移出并保留为只读 Published 示例记录。"
      })),
      s003HistoryMigration: legacyPublishedExampleRuns.length ? {
        status: "reclassified",
        count: legacyPublishedExampleRuns.length,
        reason: "旧版预置结果不再冒充真实历史；原记录保留在 legacyPublishedExampleRuns。"
      } : clone(stored.s003HistoryMigration || null),
      s003ProjectionIssue: clone(runtimeState.projectionIssue),
      scenarioContext: {
        id: current.scenarioId,
        name: "集团债务风险监测",
        version: current.scenarioVersion,
        runId: current.scenarioRunId,
        formedAt: current.formedAt,
        source: "公共场景壳 C033",
        status: current.status
      }
    };
  }

  function publishedExampleView(query, index) {
    const context = clone(runtimeState.context);
    const definition = queryDefinition(query.id);
    const queryContext = prepareQueryContext(query.question, null, null);
    const viewNames = {
      "S003-QRY-001": "集团风险分档总览",
      "S003-QRY-002": "红黑灯企业清单",
      "S003-QRY-003": "企业风险评估明细",
      "S003-QRY-004": "企业指标弱项明细",
      "S003-QRY-005": "因子缺失与不适用明细",
      "S003-QRY-006": "待成员单位接口人确认的亮灯预警"
    };
    return {
      id: `S003-M03-VIEW-${String(index + 1).padStart(3, "0")}`,
      name: viewNames[query.id] || query.title || query.question,
      question: query.question,
      templateId: query.id,
      status: "可运行",
      createdAt: runtimeState.data?.queryResults?.formedAt || context.scenarioFormedAt,
      semanticVersionId: context.versionId,
      semanticVersion: context.semanticVersion,
      resourceContractFingerprint: context.resourceContractFingerprint,
      queryDefinition: {
        ...definition,
        sceneId: context.scenarioId,
        sceneVersion: context.scenarioVersion,
        sceneRunId: context.scenarioRunId,
        objectScope: clone(definition.objectScope || []),
        resourceIds: clone(query.resources || definition.resourceIds || []),
        parameters: clone(queryContext)
      },
      displayPreference: {mode: index === 0 ? "chart" : "table", chart: "bar", legend: true, direction: definition.sorting || "业务默认"},
      lastRunId: null,
      publishedExample: true,
      sourceLabel: "Published 问题示例"
    };
  }

  function hydrateExperience(state) {
    if (!state || runtimeState.status !== "ready" || !runtimeState.context) return state;
    const activeConfig = makeConfig(readScenarioContext());
    const recommendations = {
      status: "成功",
      attempt: Math.max(1, Number(state.recommendations?.attempt || 0)),
      items: RECOMMENDED_QUESTIONS.map((item) => ({
        ...clone(item),
        resourceLabels: item.resources.map((id) => runtimeState.resources?.find((resource) => resource.id === id)?.name || id)
      })),
      error: null,
      generatedAt: runtimeState.data?.queryResults?.formedAt || readScenarioContext().formedAt
    };
    const existingViewTemplates = new Set((state.savedViews || [])
      .filter((view) => view?.publishedExample === true || view?.seededFromPublishedResult === true)
      .map((view) => view?.templateId)
      .filter(Boolean));
    const seedViews = RECOMMENDED_QUESTIONS
      .map(publishedExampleView)
      .filter((view) => !existingViewTemplates.has(view.templateId));
    return {
      ...state,
      activeConfig,
      enabledConfigs: [clone(activeConfig)],
      candidateConfig: {
        ...clone(activeConfig),
        ...clone(state.candidateConfig || {}),
        bindingVersion: activeConfig.bindingVersion,
        bindingVersionId: activeConfig.bindingVersionId,
        semanticVersion: activeConfig.semanticVersion,
        resourceContractFingerprint: activeConfig.resourceContractFingerprint,
        c009Validation: clone(activeConfig.c009Validation),
        compatibility: state.candidateConfig?.compatibility || "待验证",
        status: state.candidateConfig?.status || "候选"
      },
      recommendations,
      historyRuns: [...formalHistoryRuns(), ...(state.historyRuns || []).filter((run) => !isFormalHistoryRun(run) && !String(run?.id || "").startsWith("S003-M03-HISTORY-"))],
      savedViews: [...seedViews, ...(state.savedViews || [])],
      s003ExperienceSeedVersion: "published-native-v4"
    };
  }

  function loadState() {
    const adapter = storageAdapter();
    if (!adapter) return adaptState(historicalState());
    try {
      const recovered = adapter.get(WORKSPACE_RECOVERY_STATE_KEY);
      if (recovered) {
        runtimeState.workspaceStateKey = WORKSPACE_RECOVERY_STATE_KEY;
        return adaptState(recovered);
      }
    } catch (error) {
      runtimeState.workspaceStateKey = null;
      console.warn("S003 M03 命名空间状态已隔离", error?.message || error);
      projectionIssue(
        `M03 当前恢复投影不可读取：${error?.message || "命名空间记录不兼容"}`,
        "原恢复记录保持不变；当前页面只读取正式 Published 资源，写操作保持阻断。",
        "INCOMPATIBLE_RECOVERY_PROJECTION"
      );
      return adaptState(null);
    }
    try {
      runtimeState.workspaceStateKey = WORKSPACE_STATE_KEY;
      return adaptState(adapter.get(WORKSPACE_STATE_KEY));
    } catch (error) {
      console.warn("S003 M03 命名空间状态已隔离", error?.message || error);
      runtimeState.workspaceStateKey = WORKSPACE_RECOVERY_STATE_KEY;
      const issue = projectionIssue(
        `M03 当前工作投影不可读取：${error?.message || "命名空间记录不兼容"}`,
        `原命名空间记录保持不变；已从正式 Published 资源重建当前工作投影并写入独立逻辑键 ${WORKSPACE_RECOVERY_STATE_KEY}。`
      );
      issue.originalLogicalKey = WORKSPACE_STATE_KEY;
      issue.rebuiltLogicalKey = WORKSPACE_RECOVERY_STATE_KEY;
      return adaptState(null);
    }
  }

  function saveState(_storageKey, state) {
    try {
      const adapter = storageAdapter();
      if (!adapter || !runtimeState.workspaceStateKey) return false;
      adapter.set(runtimeState.workspaceStateKey, {...clone(state), actionRequests: [], historicalActionRequests: []});
      return true;
    } catch (error) {
      console.error("S003 M03 命名空间状态保存失败", error);
      return false;
    }
  }

  function resetState(_storageKey, currentState) {
    const resetAt = s003IsoNow();
    const archived = [...(currentState?.historyRuns || []), ...(currentState?.liveRuns || []).map((run) => ({
      ...clone(run),
      past: true,
      currentProjection: false,
      status: run.status === "处理中" ? "已废弃" : run.status,
      completedAt: run.completedAt || resetAt,
      failure: run.status === "处理中" ? "M03 当前工作投影已重置，未完成运行不会形成结果" : run.failure,
      recovery: run.status === "处理中" ? "基于当前 Published 上下文重新提问" : run.recovery
    }))];
    const next = adaptState({historyRuns: archived, resetHistory: [{resetAt, scenarioRunId: readScenarioContext().scenarioRunId, status: "M03 工作投影已重置"}, ...(currentState?.resetHistory || [])]});
    saveState(null, next);
    return next;
  }

  function nextStableId(prefix) {
    try {
      const adapter = storageAdapter();
      if (!adapter) return originals.nextStableId(prefix);
      const counter = Number(adapter.get(IDENTITY_COUNTER_KEY) || 0) + 1;
      adapter.set(IDENTITY_COUNTER_KEY, counter);
      return `${prefix}-S003-${Date.now().toString(36).toUpperCase()}-${String(counter).padStart(3, "0")}`;
    } catch (_) {
      return originals.nextStableId(prefix);
    }
  }

  function resolveQuestion(text) {
    const normalized = String(text || "").replace(/\s+/g, "").trim();
    const exact = RECOMMENDED_QUESTIONS.find((item) => item.question.replace(/\s+/g, "") === normalized);
    if (exact) return exact.id;
    if (/(风险等级|风险分档|各档|分布).*(多少|几家|数量)|多少家.*(风险等级|风险分档)/.test(normalized)) return "S003-QRY-001";
    if (/(红灯|黑灯).*(企业|单位)|哪些.*(红灯|黑灯)/.test(normalized)) return "S003-QRY-002";
    if (/(最低|最弱).*(三项|3项).*(指标)|指标.*(最低|最弱).*(三项|3项)/.test(normalized)) return "S003-QRY-004";
    if (/(评估详情|风险详情|债务风险评估|评分明细)/.test(normalized)) return "S003-QRY-003";
    if (/(缺失套零|缺失.*零|不适用).*(因子|语义)|因子.*(缺失套零|不适用)/.test(normalized)) return "S003-QRY-005";
    if (/(亮灯预警|待接口人确认|待成员单位接口人确认|处置候选|待人工确认|风险处置).*(预警|候选|企业|单位)?/.test(normalized)) return "S003-QRY-006";
    return null;
  }

  function enterpriseForQuestion(question, inheritedRun) {
    const results = runtimeState.data?.c035?.results || [];
    const normalized = String(question || "").replace(/\s+/g, "").toLowerCase();
    const direct = results.find((item) => {
      const enterprise = item.enterprise || {};
      return [enterprise.enterpriseId, enterprise.name].filter(Boolean).some((token) => normalized.includes(String(token).replace(/\s+/g, "").toLowerCase()));
    });
    if (direct) return direct.enterprise;
    const inheritedId = inheritedRun?.queryContext?.enterpriseId;
    return inheritedId ? results.find((item) => item.enterprise?.enterpriseId === inheritedId)?.enterprise || null : null;
  }

  function prepareQueryContext(question, inheritedRun, explicitContext) {
    const enterprise = enterpriseForQuestion(question, inheritedRun);
    return {
      ...(clone(explicitContext) || {}),
      originalQuestion: explicitContext?.originalQuestion || question,
      finalQuestion: question,
      enterpriseId: enterprise?.enterpriseId || explicitContext?.enterpriseId || null,
      enterpriseName: enterprise?.name || explicitContext?.enterpriseName || null,
      unitCodes: []
    };
  }

  function validateQuestion(question, queryId, inheritedRun, explicitContext) {
    if (runtimeState.status !== "ready") {
      return {passed: false, reason: runtimeState.error || "S003 Published 问数资源仍在读取", recovery: "核对当前 scenarioRunId 是否为正式 Published 运行，随后重试。"};
    }
    if (!contextIsActive()) {
      return {passed: false, reason: `${readScenarioContext().status || "unknown"} 场景上下文只读，不能创建新的问数运行`, recovery: "返回当前 active scenarioRunId 后重新提问。"};
    }
    if (!["S003-QRY-003", "S003-QRY-004"].includes(queryId)) return {passed: true, queryContext: prepareQueryContext(question, inheritedRun, explicitContext)};
    const queryContext = prepareQueryContext(question, inheritedRun, explicitContext);
    if (!queryContext.enterpriseId) {
      return {passed: false, reason: "该问题必须明确一家企业", recovery: "请在问题中输入企业名称或稳定企业 ID，例如“风电测试公司01”。"};
    }
    return {passed: true, queryContext};
  }

  function evidenceId(runId, index) {
    return `${runId || "S003-M03-RUN"}-E${String(index).padStart(3, "0")}`;
  }

  function rowFactory(runId) {
    let sequence = 0;
    return function makeRow(input) {
      sequence += 1;
      return {
        id: input.id || `row-${sequence}`,
        object: input.object,
        resourceId: input.resourceId || CORE_IDS.results,
        label: input.label,
        exact: input.exact,
        unit: input.unit || "",
        status: input.status || "已发布",
        evidenceId: evidenceId(runId, sequence),
        resourceVersion: input.resourceVersion || runtimeState.context?.resources?.find((item) => item.id === (input.resourceId || CORE_IDS.results))?.version || null,
        detail: input.detail || null,
        warning: input.warning || null
      };
    };
  }

  function chartFor(rows, options) {
    const selected = (options?.rows || rows).filter((row) => Number.isFinite(Number(row.exact)));
    return {
      recommended: options?.recommended || "bar",
      allowed: selected.length ? ["metric", "bar", "table"] : ["table"],
      adapters: {
        metric: selected[0] ? {items: [{id: selected[0].id, rowId: selected[0].id, evidenceId: selected[0].evidenceId, label: selected[0].label, value: Number(selected[0].exact), exact: String(selected[0].exact), unit: selected[0].unit, resourceId: selected[0].resourceId, status: selected[0].status}], unit: selected[0].unit} : {items: []},
        bar: {items: selected.map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.object === "集团" ? row.label : row.object, value: Number(row.exact), exact: String(row.exact), unit: row.unit, resourceId: row.resourceId, status: row.status})), unit: options?.unit || selected[0]?.unit || ""}
      }
    };
  }

  function fixedResult(queryOutput, runId, queryContext) {
    const result = queryOutput.result;
    const makeRow = rowFactory(runId);
    let rows = [];
    let title = queryOutput.question;
    let scope = ["集团"];
    let summary = "";
    let highlights = [];

    if (result.type === "risk-tier-distribution") {
      rows = [
        makeRow({id: "enterprise-total", object: "集团", resourceId: CORE_IDS.facts, label: "企业总数", exact: result.total, unit: "家"}),
        makeRow({id: "average-score", object: "集团", resourceId: CORE_IDS.results, label: "平均风险评分", exact: result.averageFinalScore, unit: "分"}),
        ...result.tiers.map((tier) => makeRow({id: `tier-${tier.tierId.toLowerCase()}`, object: "集团", resourceId: CORE_IDS.facts, label: `${TIER_LABELS[tier.tierId] || tier.name}企业`, exact: tier.count, unit: "家", status: TIER_LABELS[tier.tierId] || tier.name}))
      ];
      title = "集团债务风险分档分布";
      summary = `本轮共有 ${result.total} 家企业，平均风险评分 ${result.averageFinalScore} 分；绿灯 ${result.counts.GREEN} 家、黄灯 ${result.counts.YELLOW} 家、红灯 ${result.counts.RED} 家、黑灯 ${result.counts.BLACK} 家。`;
      highlights = rows.slice(0, 2).map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.label, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    } else if (result.type === "enterprise-list") {
      rows = result.enterprises.map((enterprise) => makeRow({id: enterprise.enterpriseId, object: enterprise.enterpriseName, resourceId: CORE_IDS.results, label: "最终风险评分", exact: enterprise.finalScore, unit: "分", status: enterprise.riskTier.name, detail: `${enterprise.resultId}@${enterprise.resultVersion} · ${enterprise.category}`}));
      title = "红灯与黑灯企业明细";
      scope = result.enterprises.map((item) => item.enterpriseName);
      summary = rows.length ? `当前共有 ${rows.length} 家红灯或黑灯企业，结果均来自同轮次 C035 正式结果。` : "当前没有红灯或黑灯企业。";
      highlights = rows.slice(0, 3).map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.object, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    } else if (result.type === "enterprise-detail") {
      scope = [result.enterpriseName];
      rows = [
        makeRow({id: "final-score", object: result.enterpriseName, label: "最终风险评分", exact: result.finalScore, unit: "分", status: result.riskTier.name, detail: result.resultId}),
        makeRow({id: "raw-score", object: result.enterpriseName, label: "原始评分", exact: result.rawScore, unit: "分", detail: result.resultId}),
        makeRow({id: "factor-sum", object: result.enterpriseName, label: "调节因子合计", exact: result.factorSum, unit: "", detail: result.resultId}),
        ...result.indicators.map((indicator, index) => makeRow({id: `indicator-${index + 1}`, object: result.enterpriseName, label: indicator.name, exact: indicator.score, unit: "分", status: indicator.status, detail: `实际值 ${indicator.actualValue} · 权重 ${indicator.weightPercent}% · ${result.resultId}`})),
        ...result.factors.map((factor, index) => makeRow({id: `factor-${index + 1}`, object: result.enterpriseName, label: factor.name, exact: factor.coefficient, unit: "系数", status: factor.state || factor.marker || "已评估", detail: `${factor.tierLabel || factor.inputValue || ""} · ${result.resultId}`}))
      ];
      title = `${result.enterpriseName}债务风险评估详情`;
      summary = `${result.enterpriseName}本轮原始评分 ${result.rawScore} 分，调节因子合计 ${result.factorSum}，最终评分 ${result.finalScore} 分，风险分档为${result.riskTier.name}。`;
      highlights = rows.slice(0, 3).map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.label, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    } else if (result.type === "lowest-three-indicators") {
      scope = [result.enterprise.enterpriseName];
      rows = result.indicators.map((indicator, index) => makeRow({id: `lowest-${index + 1}`, object: result.enterprise.enterpriseName, label: indicator.name, exact: indicator.score, unit: "分", status: "评分弱项", detail: `${result.enterprise.resultId}@${result.enterprise.resultVersion}`}));
      title = `${result.enterprise.enterpriseName}评分最低的三项指标`;
      summary = result.note || `${result.enterprise.enterpriseName}本轮最低三项指标为${rows.map((row) => `${row.label} ${row.exact} 分`).join("、")}。`;
      highlights = rows.map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.label, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    } else if (result.type === "factor-default-and-not-applicable") {
      rows = result.records.flatMap((record) => record.factors.map((factor, index) => makeRow({id: `${record.enterprise.enterpriseId}-${factor.factorId}-${index}`, object: record.enterprise.enterpriseName, label: factor.name, exact: factor.coefficient, unit: "系数", status: factor.state, detail: `${factor.note || factor.marker || ""} · ${record.enterprise.resultId}`})));
      title = "企业因子缺失套零与不适用明细";
      scope = result.records.map((record) => record.enterprise.enterpriseName);
      summary = `本轮涉及 ${result.enterpriseCount} 家企业；缺失套零 ${result.counts.DEFAULTED_ZERO} 项，不适用 ${result.counts.NOT_APPLICABLE} 项。`;
      const countRows = [
        makeRow({id: "defaulted-zero-count", object: "集团", resourceId: CORE_IDS.facts, label: "缺失套零", exact: result.counts.DEFAULTED_ZERO, unit: "项", status: "DEFAULTED_ZERO"}),
        makeRow({id: "not-applicable-count", object: "集团", resourceId: CORE_IDS.facts, label: "不适用", exact: result.counts.NOT_APPLICABLE, unit: "项", status: "NOT_APPLICABLE"})
      ];
      rows = [...countRows, ...rows];
      highlights = countRows.map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.label, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    } else if (result.type === "disposition-candidate-list") {
      rows = result.candidates.map((candidate, index) => makeRow({id: candidate.candidateId || `candidate-${index + 1}`, object: candidate.enterprise.enterpriseName, label: candidate.actionTypeId, exact: candidate.enterprise.finalScore, unit: "分", status: "待成员单位接口人确认", detail: `${candidate.enterprise.riskTier.name} · 按亮灯形成预警 · 问数不创建行动申请`}));
      title = "待成员单位接口人确认的亮灯预警";
      scope = result.candidates.map((item) => item.enterprise.enterpriseName);
      summary = `当前共有 ${result.count} 条黄灯、红灯或黑灯预警；行动申请从驾驶舱提交并直达对应成员单位接口人，智能问数只读展示，不创建行动申请、待办或通知。`;
      highlights = rows.slice(0, 3).map((row) => ({id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.object, value: `${row.exact}${row.unit}`, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status}));
    }

    const resourceIds = [...new Set(rows.map((row) => row.resourceId).concat([CORE_IDS.package, CORE_IDS.facts, CORE_IDS.results, CORE_IDS.runtime, CORE_IDS.queryResults]))];
    const evidenceIds = rows.map((row) => row.evidenceId);
    const output = {
      id: queryOutput.queryId,
      title,
      scope,
      resourceIds,
      summary,
      highlights,
      rows,
      chart: chartFor(rows),
      nextQuestions: [],
      evidenceReferences: [],
      evidenceIds,
      summaryEvidenceIds: evidenceIds,
      fixedResultId: `${runId}-${queryOutput.queryId}-RESULT`,
      contextIdentity: {
        versionId: runtimeState.context.versionId,
        semanticVersion: runtimeState.context.semanticVersion,
        dataVersion: runtimeState.context.dataVersion,
        asOf: runtimeState.context.asOf,
        scenarioId: runtimeState.context.scenarioId,
        scenarioVersion: runtimeState.context.scenarioVersion,
        scenarioRunId: runtimeState.context.scenarioRunId
      },
      queryContext: clone(queryContext),
      querySource: clone(queryOutput.source),
      sourceContracts: ["C008", "T019", "C035"],
      sideEffects: clone(ZERO_SIDE_EFFECTS),
      authorityMode: "published-runtime",
      projectionOnly: false,
      s003NativeResult: true
    };
    output.chart = chartFor(rows, {rows: queryOutput.queryId === "S003-QRY-001" ? rows.slice(2) : rows});
    return output;
  }

  function isFormalHistoryRun(run) {
    return run?.recordType === "published-fixed-result"
      || String(run?.id || "").startsWith("S003-M03-FORMAL-RUN:");
  }

  function formalHistoryQuestion(output) {
    if (output?.queryId === "S003-QRY-003" && output.result?.enterpriseName) {
      return `${output.result.enterpriseName}本轮债务风险评估详情是什么？`;
    }
    return output?.question || "正式联调问数结果";
  }

  function formalHistoryRuns() {
    const resultSet = runtimeState.data?.queryResults;
    if (runtimeState.status !== "ready" || !runtimeState.context || !resultSet?.immutable) return [];
    const activeConfig = makeConfig(readScenarioContext());
    return FORMAL_HISTORY_QUERY_IDS.map((queryId) => {
      const executionIndex = (resultSet.executions || []).findIndex((item) => item?.output?.queryId === queryId);
      const execution = resultSet.executions?.[executionIndex];
      if (!execution?.output) return null;
      const output = execution.output;
      const id = `S003-M03-FORMAL-RUN:${resultSet.resultSetId}:${queryId}`;
      const question = formalHistoryQuestion(output);
      const queryContext = {
        ...clone(execution.parameters || {}),
        originalQuestion: output.question,
        finalQuestion: question,
        enterpriseName: output.result?.enterpriseName || null
      };
      const result = fixedResult(output, id, queryContext);
      return {
        id,
        question,
        originalQuestion: output.question,
        finalQuestion: question,
        templateId: queryId,
        status: "成功",
        createdAt: resultSet.formedAt,
        completedAt: resultSet.formedAt,
        context: {...clone(runtimeState.context), past: true},
        configSnapshot: clone(activeConfig),
        queryContext,
        result: {
          ...result,
          sourceResultSetId: resultSet.resultSetId,
          sourceResultSetVersion: resultSet.resultSetVersion,
          sourceQueryId: queryId,
          sourceFormedAt: resultSet.formedAt,
          sourceReadOnly: true
        },
        display: {mode: "text", chart: "recommended", selected: null},
        past: true,
        readOnly: true,
        currentProjection: false,
        recordType: "published-fixed-result",
        historyOrigin: "formal-integration-execution",
        userSession: false,
        sourceResultSetId: resultSet.resultSetId,
        sourceResultSetVersion: resultSet.resultSetVersion,
        sourceQueryId: queryId,
        sourceExecutionIndex: executionIndex,
        sourceFormedAt: resultSet.formedAt,
        sourceScenarioIdentity: clone(resultSet.scenarioIdentity),
        sideEffects: clone(output.sideEffects),
        immutableSource: true,
        canRerunAgainstCurrentVersion: true
      };
    }).filter(Boolean);
  }

  function materializeResult(queryId, context, runId, queryContext) {
    if (!String(queryId || "").startsWith(QUERY_PREFIX)) return originals.materializeResult(queryId, context, runId, queryContext);
    if (runtimeState.status !== "ready" || !runtimeState.queryService) return null;
    if (!runtimeContextMatches(context, runtimeState.context)) return null;
    try {
      const output = runtimeState.queryService.execute(queryId, queryContext || {});
      return fixedResult(output, runId, queryContext || {});
    } catch (error) {
      runtimeState.error = error && error.message || "S003 Published 问数执行失败";
      return null;
    }
  }

  function runtimeContextMatches(left, right) {
    if (left?.scenarioId !== "S003" && right?.scenarioId !== "S003") return originals.runtimeContextMatches(left, right);
    return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId", "versionId", "semanticVersion", "dataVersion", "asOf", "t019EvidenceCode", "runtimeContextFingerprint"].every((field) => left[field] && left[field] === right[field]));
  }

  function verifyFixedResult(result, context, config) {
    if (!result?.s003NativeResult) return originals.verifyFixedResult(result, context, config);
    const issues = [];
    if (runtimeState.status !== "ready" || !runtimeState.context) issues.push(runtimeState.error || "S003 Published 运行不可用");
    if (!runtimeContextMatches(context, runtimeState.context)) issues.push("结果上下文与当前 Published 运行不一致");
    if (!result.fixedResultId || !Array.isArray(result.rows) || !result.rows.length) issues.push("固定结构化结果不完整");
    const rowIds = result.rows.map((row) => row.id);
    const evidenceIds = result.rows.map((row) => row.evidenceId);
    if (new Set(rowIds).size !== rowIds.length || rowIds.some((id) => !id)) issues.push("结果项身份缺失或重复");
    if (new Set(evidenceIds).size !== evidenceIds.length || evidenceIds.some((id) => !id)) issues.push("结果证据身份缺失或重复");
    const currentResources = new Set((runtimeState.context?.resources || []).map((item) => item.id));
    const allowed = new Set(config?.allowedResources || []);
    result.rows.forEach((row) => {
      if (!currentResources.has(row.resourceId) || !allowed.has(row.resourceId)) issues.push(`${row.resourceId || "未标识资源"}不在 Published 白名单内`);
      if (row.exact === undefined || row.exact === null || !row.status) issues.push(`${row.id || "结果项"}缺少精确值或状态`);
    });
    if (result.actionContext || (result.actionContexts || []).length) issues.push("S003 M03 结果不得携带可提交 Action Request 的行动上下文");
    if (!result.sideEffects || Object.entries(ZERO_SIDE_EFFECTS).some(([key, value]) => result.sideEffects[key] !== value)) issues.push("S003 M03 结果副作用声明不为零");
    if (result.projectionOnly === true || result.authorityMode !== "published-runtime") issues.push("工作投影或非正式结果不可作为正式问数答案");
    return {passed: issues.length === 0, issues: [...new Set(issues)]};
  }

  function validateRunContext(context, config, template) {
    if (!String(template?.id || "").startsWith(QUERY_PREFIX)) return originals.validateRunContext(context, config, template);
    const issues = [];
    if (runtimeState.status !== "ready") issues.push({gate: "正式消费组合", owner: "M01 本体管理 / M03 智能问数", reason: runtimeState.error || "S003 Published 运行尚未形成", recovery: "核对 Published 指针、T019、C035 和当前 scenarioRunId。"});
    if (!context?.ready || context?.allowConsumption !== true || context?.projectionOnly === true) issues.push({gate: "正式消费组合", owner: "M01 本体管理", reason: context?.reason || "当前不是可消费的 Published 运行", recovery: "只能基于当前正式 Published scenarioRunId 发起问数。"});
    if (!runtimeContextMatches(context, runtimeState.context)) issues.push({gate: "场景", owner: "平台场景目录 / 智能问数", reason: "当前场景、模型、事实或数据版本未与正式运行精确匹配", recovery: "重新从 S003 公共场景壳进入当前正式运行。"});
    if (!config || config.status !== "已启用" || config.sceneId !== "S003") issues.push({gate: "配置", owner: "M03 智能问数", reason: "平台通用 S003 只读问数配置未启用", recovery: "恢复平台通用只读配置。"});
    if (config?.allowedActions?.includes("提交标准 Action Request") || config?.actionRequestForbidden !== true) issues.push({gate: "边界", owner: "M03 智能问数", reason: "S003 一期问数配置不得开放 Action Request 提交", recovery: "移除行动申请能力，保持只读。"});
    const missing = (template?.resourceIds || []).filter((id) => !(config?.allowedResources || []).includes(id));
    if (missing.length) issues.push({gate: "资源", owner: "M03 智能问数 / M01 本体管理", reason: `当前问题缺少 ${missing.length} 项 Published 白名单资源`, recovery: "核对当前 Published 资源包与问数白名单。", ids: missing});
    return {passed: issues.length === 0, issues};
  }

  function readRuntimeContext() {
    if (runtimeState.context) return clone(runtimeState.context);
    const context = readScenarioContext();
    return {
      ready: false,
      blocked: true,
      allowConsumption: false,
      formalAnswerable: false,
      evidenceComplete: false,
      status: runtimeState.status === "error" ? "不可消费" : "读取中",
      reason: runtimeState.error || "正在读取 S003 Published 问数资源",
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      scenarioStatus: context.status,
      resources: []
    };
  }

  function readPublishedOntologyContext() {
    const context = readRuntimeContext();
    return {
      ...context,
      discoverable: Boolean(runtimeState.context),
      formalAnswerable: context.ready === true,
      answerabilityStatus: context.ready ? "可正式问数" : "不可正式回答",
      answerabilityReason: context.reason,
      semanticVersion: context.semanticVersion,
      versionId: context.versionId,
      resources: context.resources || [],
      linkProblems: [],
      contractProblems: []
    };
  }

  function deriveConfigRuntimeState(config, context) {
    const runtime = context?.scenarioId === "S003" ? context : readRuntimeContext();
    if (!runtime.ready) return {status: "当前组合不可消费", tone: "danger", reason: runtime.reason || "Published 运行未形成"};
    if (config?.sceneId !== runtime.scenarioId || config?.sceneVersion !== runtime.scenarioVersion || config?.sceneRunId !== runtime.scenarioRunId) return {status: "需重验", tone: "warning", reason: "配置与当前 scenarioRunId 不一致"};
    if (config?.actionRequestForbidden !== true || config?.allowedActions?.includes("提交标准 Action Request")) return {status: "需重验", tone: "danger", reason: "S003 只读问数边界被修改"};
    return {status: "兼容", tone: "success", reason: "债务风险问数助手配置与当前 Published 运行一致"};
  }

  function recommendationEligibility(question, config, context) {
    const item = typeof question === "string" ? RECOMMENDED_QUESTIONS.find((candidate) => candidate.question === question) : question;
    const runtime = context?.scenarioId === "S003" ? context : readRuntimeContext();
    const configState = deriveConfigRuntimeState(config, runtime);
    const eligible = Boolean(item && resolveQuestion(item.question) && configState.status === "兼容");
    return {eligible, reason: eligible ? "" : configState.reason || "问题不在 S003 固定只读问题集"};
  }

  function recommendableQuestions(config, context) {
    return RECOMMENDED_QUESTIONS.filter((item) => recommendationEligibility(item, config, context).eligible).map(clone);
  }

  function queryDefinition(queryId) {
    if (!String(queryId || "").startsWith(QUERY_PREFIX)) return originals.queryDefinition(queryId);
    const template = templateFor(queryId);
    return {
      id: queryId,
      objectScope: [],
      resourceIds: clone(template?.resourceIds || []),
      grouping: [],
      sorting: queryId === "S003-QRY-002" ? "风险优先、评分升序" : "业务默认",
      timePolicy: "固定评估时点",
      topN: null
    };
  }

  function csvEligibility(run) {
    if (!run?.result?.s003NativeResult) return originals.csvEligibility.apply(null, arguments);
    if (run.past || run.context?.past) return {allowed: false, reason: "历史轮次只读；请按当前 Published 版本重新运行后导出"};
    if (run.status !== "成功") return {allowed: false, reason: "只有成功形成的固定结果可以导出"};
    const verified = verifyFixedResult(run.result, run.context, run.configSnapshot);
    return verified.passed ? {allowed: true, reason: ""} : {allowed: false, reason: verified.issues[0]};
  }

  function actionEligibility(run) {
    if (run?.context?.scenarioId !== "S003") return originals.actionEligibility.apply(null, arguments);
    return {allowed: false, reason: "S003 一期智能问数只读展示；风险处置必须在通用决策中心经人工确认后进入 Action Request", actionContext: null};
  }

  function matchApplicableAgents(question, configs, context, template) {
    if (!String(template?.id || "").startsWith(QUERY_PREFIX)) return originals.matchApplicableAgents(question, configs, context, template);
    const config = (configs || []).find((item) => item.sceneId === "S003") || makeConfig(readScenarioContext());
    const gate = validateRunContext(context, config, template);
    return gate.passed ? [{config, reason: "唯一匹配债务风险问数助手的 Published 只读配置"}] : [];
  }

  function resultEvidenceMapping(result) {
    return (result?.rows || []).filter((row) => row?.evidenceId).map((row) => ({
      resultItemId: row.id,
      evidenceId: row.evidenceId,
      resourceId: row.resourceId
    }));
  }

  function resultObjectIdentities(result) {
    return [...new Set((result?.rows || []).flatMap((row) => [
      row.enterpriseId,
      row.entityId,
      row.stableId,
      row.objectId
    ]).filter(Boolean))];
  }

  function validateFixedQuestionSet(config, context) {
    const validationConfig = {
      ...clone(config || makeConfig(readScenarioContext())),
      status: "已启用",
      compatibility: "兼容",
      actionRequestForbidden: true
    };
    const questions = VALIDATION_QUESTIONS.map((definition, index) => {
      const gate = validateRunContext(context, validationConfig, templateFor(definition.templateId));
      const queryContext = prepareQueryContext(definition.question, null, null);
      const result = gate.passed
        ? materializeResult(definition.templateId, context, `S003-CONFIG-CHECK-${String(index + 1).padStart(2, "0")}`, queryContext)
        : null;
      const verification = result
        ? verifyFixedResult(result, context, validationConfig)
        : {passed: false, issues: gate.issues.map((item) => item.reason)};
      return {
        id: definition.id,
        question: definition.question,
        status: verification.passed ? "通过" : "失败",
        resourceIds: clone(result?.resourceIds || []),
        evidenceIds: clone(result?.evidenceIds || []),
        resultId: result?.fixedResultId || result?.id || null,
        contextIdentity: clone(result?.contextIdentity || null),
        reason: verification.issues[0] || ""
      };
    });
    const issues = questions.filter((item) => item.status !== "通过").map((item) => `${item.question}：${item.reason}`);
    return {passed: issues.length === 0, issues, questions};
  }

  function validateCandidateFixedQuestionSet(context, runId, options = {}) {
    if (!context?.ready || !context?.inputFingerprint) {
      return {passed: false, issues: [context?.reason || "候选 Published 上下文不完整"], questions: []};
    }
    const validationConfig = {
      ...clone(options.configSnapshot || makeConfig(readScenarioContext())),
      status: "已启用",
      compatibility: "隔离验证",
      actionRequestForbidden: true,
      bindingVersionId: context.versionId,
      semanticVersion: context.semanticVersion,
      resourceContractFingerprint: context.resourceContractFingerprint,
      allowedResources: (context.resources || []).map((item) => item.id).filter(Boolean)
    };
    const capabilityProof = D.runtimeCapabilityProof(validationConfig);
    const forcedStates = options.forcedStates || {};
    const questions = VALIDATION_QUESTIONS.map((definition) => {
      const forcedStatus = forcedStates[definition.id] || null;
      const queryContext = prepareQueryContext(definition.question, null, null);
      const fixedContext = {...clone(context), ready: true, blocked: false, evidenceComplete: true, candidateValidation: true};
      const result = !forcedStatus && capabilityProof.passed
        ? materializeResult(definition.templateId, fixedContext, `${runId}-${definition.id}`, queryContext)
        : null;
      const verification = result
        ? verifyFixedResult(result, fixedContext, validationConfig)
        : {passed: false, issues: capabilityProof.issues?.length ? capabilityProof.issues : [forcedStatus === "超时" ? "限定时间内未形成完整固定结果与逐项证据" : forcedStatus ? "候选结果或证据状态无法确定" : "候选固定结果未形成"]};
      return {
        ...clone(definition),
        status: forcedStatus || (verification.passed ? "通过" : "失败"),
        completedAt: s003IsoNow(),
        objectScope: clone(result?.scope || []),
        objectIdentities: resultObjectIdentities(result),
        resourceIds: clone(result?.resourceIds || templateFor(definition.templateId)?.resourceIds || []),
        fixedResultIdentity: result ? {
          fixedResultId: result.fixedResultId || result.id,
          scenarioId: context.scenarioId,
          scenarioVersion: context.scenarioVersion,
          scenarioRunId: context.scenarioRunId,
          semanticVersion: context.semanticVersion,
          dataVersion: context.dataVersion
        } : null,
        evidenceIds: clone(result?.evidenceIds || []),
        evidenceMapping: resultEvidenceMapping(result),
        responsibility: "M03 智能问数 · S003 候选固定题验证",
        reason: verification.issues[0] || "固定结果与逐项证据一致"
      };
    });
    const issues = questions.filter((item) => item.status !== "通过").map((item) => `${item.question}：${item.reason}`);
    return {passed: issues.length === 0, issues, questions};
  }

  function installDomainOverrides() {
    variant.storageKey = WORKSPACE_STATE_KEY;
    const config = makeConfig(readScenarioContext());
    D.ACTIVE_CONFIG = config;
    D.CANDIDATE_CONFIG = {...clone(config), id: "IQ-PLATFORM-S003-PUBLISHED-READONLY-CANDIDATE", status: "候选", compatibility: "待验证"};
    D.RECOMMENDED_QUESTIONS = clone(RECOMMENDED_QUESTIONS);
    D.CANDIDATE_VALIDATION_QUESTIONS = clone(VALIDATION_QUESTIONS);
    D.createInitialState = () => adaptState(null);
    D.loadState = loadState;
    D.saveState = saveState;
    D.resetState = resetState;
    D.nowText = s003DisplayNow;
    D.nextStableId = nextStableId;
    D.resolveQuestion = resolveQuestion;
    D.materializeResult = materializeResult;
    D.verifyFixedResult = verifyFixedResult;
    D.validateRunContext = validateRunContext;
    D.matchApplicableAgents = matchApplicableAgents;
    D.readRuntimeContext = readRuntimeContext;
    D.readOntologyContext = readPublishedOntologyContext;
    D.readPublishedOntologyContext = readPublishedOntologyContext;
    D.readOntologyBindingContext = readPublishedOntologyContext;
    D.readCandidateConsumptionContext = readPublishedOntologyContext;
    D.projectRuntimeContext = () => readRuntimeContext();
    D.attachScenarioContext = () => readRuntimeContext();
    D.projectRuntimeContextForScenario = () => readRuntimeContext();
    D.runtimeContextMatches = runtimeContextMatches;
    D.deriveConfigRuntimeState = deriveConfigRuntimeState;
    D.recommendationEligibility = recommendationEligibility;
    D.recommendableQuestions = recommendableQuestions;
    D.queryDefinition = queryDefinition;
    D.csvEligibility = csvEligibility;
    D.actionEligibility = actionEligibility;
    D.publishActionRequestInbox = () => ({published: false, reason: "S003 M03 禁止创建或发布 Action Request"});
    D.validateFixedQuestionSet = validateFixedQuestionSet;
    D.validateCandidateFixedQuestionSet = validateCandidateFixedQuestionSet;
    D.buildOntologyDeepLink = (context, resourceId, tab = "overview") => {
      if (context?.scenarioId !== "S003") {
        return originals.buildOntologyDeepLink(context, resourceId, tab);
      }
      // C035、Published Fact 与 M03 运行证据不是 M01 语义资源，不能伪造
      // published/resource 深链。只有模型包回到 M01 原生 Published 本体版本页。
      if (resourceId !== CORE_IDS.package) return null;
      const pageParams = new URLSearchParams({
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        scenarioContextFormedAt: context.scenarioFormedAt || context.projectionFormedAt || "2026-08-15T13:30:00.000Z",
        scenarioStatus: context.scenarioStatus || "active"
      });
      const hashParams = new URLSearchParams({
        id: ONTOLOGY_ID,
        version: publishedVersionId(context.semanticVersion)
      });
      return `../../../ontology-management-review/canvas-first/index.html?${pageParams.toString()}#published/ontology?${hashParams.toString()}`;
    };
  }

  async function fetchJson(path, label) {
    const response = await fetch(path, {cache: "no-store"});
    if (!response.ok) throw new Error(`${label}读取失败（HTTP ${response.status}）`);
    return response.json();
  }

  async function bootstrap() {
    try {
      assertAvailableDependencies();
      const context = readScenarioContext();
      foundation.assertScenarioContext(context);
      const entries = await Promise.all(Object.entries(RESOURCE_PATHS).map(async ([key, path]) => [key, await fetchJson(path, key)]));
      const data = Object.fromEntries(entries);
      assertPublishedBundle(context, data);
      const resources = makeResources(data);
      runtimeState.data = data;
      runtimeState.resources = resources;
      runtimeState.queryService = queryServiceApi.createQueryService({
        scenarioContext: context,
        c035Results: data.c035,
        publishedFacts: data.facts,
        publicationStatus: "PUBLISHED"
      });
      runtimeState.context = makeRuntimeContext(data, resources);
      runtimeState.status = "ready";
      runtimeState.error = null;
      D.RESOURCES = clone(resources);
      D.resourceById = Object.fromEntries(resources.map((item) => [item.id, item]));
      const config = makeConfig(context);
      D.ACTIVE_CONFIG = config;
      D.CANDIDATE_CONFIG = {...clone(config), id: "IQ-PLATFORM-S003-PUBLISHED-READONLY-CANDIDATE", status: "候选", compatibility: "待验证"};
    } catch (error) {
      runtimeState.status = "error";
      runtimeState.error = error && error.message || "S003 Published 问数资源读取失败";
      runtimeState.context = null;
      runtimeState.queryService = null;
    }
    root.dispatchEvent(new CustomEvent("s003-iq-runtime-change", {detail: {status: runtimeState.status, error: runtimeState.error}}));
  }

  installDomainOverrides();
  bootstrap();

  root.S003IQNativeBridge = Object.freeze({
    isActive: true,
    readScenarioContext,
    resolveQuestion,
    templateFor,
    prepareQueryContext,
    validateQuestion,
    materializeResult,
    verifyFixedResult,
    readRuntimeContext,
    runtimeContextMatches,
    hydrateExperience,
    getStatus: () => ({status: runtimeState.status, error: runtimeState.error}),
    getHealth: () => ({
      moduleId: "M03",
      status: runtimeState.status === "loading" ? "checking" : runtimeState.status === "error" ? "blocked" : runtimeState.projectionIssue ? "warning" : "healthy",
      detail: runtimeState.status === "loading"
        ? "正在装载债务风险问数资源。"
        : runtimeState.status === "error"
          ? "问数资源正在重新读取，请稍候刷新。"
          : runtimeState.projectionIssue
            ? "本次评估状态需要刷新；已发布问数资源仍可正常查看。"
            : "债务风险问数资源已装入当前工作台。",
      projectionIssue: runtimeState.projectionIssue ? {
        ...clone(runtimeState.projectionIssue),
        reason: "本次评估状态需要刷新",
        recovery: "已保留历史记录，并从已发布问数资源重新读取。"
      } : null,
      scenarioContext: clone(readScenarioContext()),
      acceptanceReady: false
    }),
    getProjectionIssue: () => clone(runtimeState.projectionIssue),
    ready: () => runtimeState.status === "ready",
    readyPromise: () => new Promise((resolve) => {
      if (runtimeState.status !== "loading") return resolve({status: runtimeState.status, error: runtimeState.error});
      root.addEventListener("s003-iq-runtime-change", (event) => resolve(event.detail), {once: true});
    })
  });
})(window);
