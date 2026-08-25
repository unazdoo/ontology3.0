(function () {
  "use strict";

  const DATA = window.RC_DATA;
  const OWNERS = window.RC_EXTERNAL_OWNERS;
  if (!DATA || !OWNERS) throw new Error("报告中心依赖未就绪");
  const STORAGE_KEY = "ontology3.report-center.lifecycle-review.v1";
  const SESSION_STORAGE_KEY = `${STORAGE_KEY}.active-tab`;
  const S003_STATE_KEY = "report-center/state.v2";
  const S003_LEGACY_STATE_KEY = "report-center/state";
  const PLATFORM_SCENARIO_CONTEXT_KEY = "ontology3.platform.scenario-runtime.v1";
  const C033_HANDOFF_CONTEXT_KEY = "ontology3.0-s001-handoff-v1:scenario-context";
  const C008_PROJECTION_STORAGE_KEY = "ontology3-c008-authoritative-projection-v1";
  const C024_INBOX_KEY = "ontology3.agent-application.c024-inbox.v1";
  const SCENARIO_SHELL_CHANNEL = "ontology3.0-scenario-shell-v1";
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  const pendingTimers = new Set();
  let idSequence = 0;
  const S003_CONFIG = window.OFW_SCENARIO_CONFIGS?.S003 || null;
  const s003Dashboard = {
    status: S003_CONFIG ? "idle" : "unavailable",
    loading: null,
    checkpointLoading: null,
    error: null,
    resources: null,
    tab: "overview",
    // 企业报告数量较多时列表更适合核对评分、风险灯和重点指标；仍保留
    // 卡片视图切换，用户在当前工作台内可随时切回卡片。
    reportIndexLayout: "list",
    riskFilter: "ALL",
    analysisSector: null,
    analysisIndicator: null,
    searchTerm: "",
    sortKey: "finalScore-asc",
    selectedEnterpriseId: null,
    selectedRunId: null,
    formalReportTab: "qa",
    formalReportSection: "s003-report-summary",
    companionQuestionId: "risk-summary",
    companionDraft: null,
    companionRequestRef: null,
    reportCompareOpen: false,
    verificationFilter: "all",
    selectedVerificationCheckId: null,
    focusedCandidateId: null,
    actionDrawerRequestId: null,
    staticResources: null,
    lastRerunRequestAt: null,
    runtimeSnapshot: null,
    runtimeError: null,
    checkpointIssues: []
  };
  const s003ShellRequests = new Map();
  const runtimeExternalViews = {
    trust: null,
    trustReadIndex: 0,
    decisionById: new Map(),
    historySemanticByReport: new Map(),
    historyReadCountByReport: new Map(),
    decisionNavigation: null,
  };
  const runtimeFactPackages = new Map();
  let runtimePersistenceError = null;
  let s003ProjectionIssue = null;
  let previousRoutePath = null;

  function readStoredObject(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function normalizeScenarioContext(source = {}) {
    const value = source?.scenarioContext || source?.context || source || {};
    return {
      scenarioId: value.scenarioId || null,
      scenarioVersion: value.scenarioVersion || null,
      scenarioRunId: value.scenarioRunId || null,
      formedAt: value.formedAt || value.contextFormedAt || null,
      status: value.status || value.contextStatus || null,
    };
  }

  function activeScenarioContext() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeScenarioContext({
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt"),
      status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus"),
    });
    const candidates = [fromUrl, normalizeScenarioContext(readStoredObject(C033_HANDOFF_CONTEXT_KEY) || {}), normalizeScenarioContext(readStoredObject(PLATFORM_SCENARIO_CONTEXT_KEY) || {})];
    return candidates.find(scenarioContextReady) || fromUrl;
  }

  function scenarioContextReady(context) {
    return Boolean(context?.scenarioId && context?.scenarioVersion && context?.scenarioRunId && context?.formedAt
      && ["active", "ready", "available", "有效", "启用", "进行中", "已启用", "可用"].includes(context.status));
  }

  function sameScenarioContext(left, right) {
    return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => left[field] && left[field] === right[field]));
  }

  function scenarioContextSnapshot() {
    const context = activeScenarioContext();
    return scenarioContextReady(context) ? clone(context) : null;
  }

  function resourceInCurrentScenario(resource) {
    return Boolean(resource?.scenarioContext && sameScenarioContext(resource.scenarioContext, activeScenarioContext()));
  }

  function s003RequestedContext() {
    const params = new URLSearchParams(window.location.search);
    const explicit = normalizeScenarioContext({
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt"),
      status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus")
    });
    if (explicit.scenarioId) return explicit;
    return activeScenarioContext();
  }

  function s003ScenarioSelected() {
    return Boolean(S003_CONFIG && s003RequestedContext().scenarioId === S003_CONFIG.id);
  }

  function s003ResourceContext(resources) {
    return normalizeScenarioContext(resources?.results?.scenarioIdentity || resources?.reportManifest?.scenarioIdentity || {});
  }

  function s003ContextState(resources = s003Dashboard.resources) {
    const active = s003RequestedContext();
    const resource = s003ResourceContext(resources);
    const isCurrent = scenarioContextReady(active) && sameScenarioContext(active, resource);
    const projectionOnly = Boolean(resources?.runtime?.projectionOnly || resources?.results?.projectionOnly || resources?.reportManifest?.projectionOnly);
    const configurationDelta = s003ConfigurationDeltaForResources(resources);
    const configurationAhead = Boolean(configurationDelta.ahead);
    return {
      active,
      resource,
      isCurrent,
      historicalReadOnly: !isCurrent,
      projectionOnly,
      configurationAhead,
      configurationDelta,
      mode: !isCurrent ? "historical-readonly" : projectionOnly ? "working-projection" : "published-evidence",
      reason: isCurrent
        ? projectionOnly
          ? "当前统一场景上下文与浏览器工作投影一致；尚未形成可供下游正式消费的 Published 证据。"
          : configurationAhead
            ? `当前结果仍绑定上一轮评分输入；${s003ConfigurationDeltaLabel(configurationDelta)}已更新，等待快速重跑形成新的隔离运行。`
            : "当前统一场景上下文与正式 Published 报告资源一致。"
        : `资源属于 ${resource.scenarioId || "未知场景"} / ${resource.scenarioVersion || "未知版本"} / ${resource.scenarioRunId || "未知运行"}；当前上下文为 ${active.scenarioId || "未取得"} / ${active.scenarioVersion || "未取得"} / ${active.scenarioRunId || "未取得"}。`
    };
  }

  function s003ReportModuleHealth() {
    const context = s003RequestedContext();
    const provider = s003Dashboard.status === "ready" ? s003ReportProvider() : null;
    const status = !S003_CONFIG || s003Dashboard.status === "unavailable" || s003Dashboard.status === "failed"
      ? "blocked"
      : s003Dashboard.status === "idle" || s003Dashboard.status === "loading"
        ? "checking"
        : s003ProjectionIssue?.blocking
          ? "blocked"
          : s003ProjectionIssue || runtimePersistenceError
            ? "warning"
            : provider
              ? "healthy"
              : "blocked";
    const detail = s003Dashboard.status === "failed"
      ? s003Dashboard.error
      : s003ProjectionIssue?.reason
        ? `${s003ProjectionIssue.reason}；${s003ProjectionIssue.recovery || "请从正式 Published 资源恢复。"}`
        : runtimePersistenceError
          ? runtimePersistenceError
          : status === "checking"
            ? "S003 报告 Provider、企业报告和驾驶舱资源正在装载。"
            : provider
              ? `基线报告目录、生命周期和生成工作区已装入 ${provider.reports.length} 份 S003 企业报告。`
              : "S003 报告 Provider 未形成可读资源。";
    return {
      moduleId: "M06",
      status,
      detail,
      projectionIssue: clone(s003ProjectionIssue),
      persistenceError: runtimePersistenceError,
      reportCount: provider?.reports?.length || 0,
      scenarioContext: clone(context),
      acceptanceReady: false
    };
  }

  window.S003ReportModuleHealth = s003ReportModuleHealth;

  function s003ScenarioQuery(context = s003RequestedContext()) {
    const query = new URLSearchParams();
    ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].forEach((field) => {
      if (context?.[field]) query.set(field, context[field]);
    });
    return query.toString();
  }

  function s003ModuleHref(relativePath, hash = "") {
    const query = s003ScenarioQuery();
    return `${relativePath}${query ? `?${query}` : ""}${hash}`;
  }

  function s003ModelConfigurationHash(sectionId = "overview", returnTo = null) {
    // The dashboard's formal result may still be bound to an older model.
    // Navigation must target the current M01 Published configuration, not the
    // result-bound pointer embedded in the historical/formal report bundle.
    const packageVersion = s003Dashboard.resources?.configurationModel?.packageVersion
      || s003Dashboard.runtimeSnapshot?.publishedModel?.packageVersion
      || s003Dashboard.resources?.publishedPointer?.activeTarget?.packageVersion
      || s003Dashboard.resources?.publishedModel?.packageVersion
      || "1.0.2";
    const versionId = packageVersion === "1.0.1"
      ? "S003-M01-DEBT-RISK-V1"
      : `S003-M01-DEBT-RISK-V${String(packageVersion).replaceAll(".", "_")}`;
    const query = new URLSearchParams({
      id: versionId,
      tab: "s003-model-config",
      configTab: sectionId
    });
    if (returnTo) query.set("returnTo", returnTo);
    return `#published/version?${query}`;
  }

  function s003FormalReportHash({ enterpriseId, reportId = null, runId = null } = {}) {
    const query = new URLSearchParams();
    if (enterpriseId) query.set("enterpriseId", enterpriseId);
    if (reportId) query.set("reportId", reportId);
    if (runId) query.set("runId", runId);
    return `#/reports/view${query.size ? `?${query}` : ""}`;
  }

  function s003ReportRoute(path, { enterpriseId = null, reportId = null, runId = null } = {}) {
    const query = new URLSearchParams();
    if (enterpriseId) query.set("enterpriseId", enterpriseId);
    if (reportId) query.set("reportId", reportId);
    if (runId) query.set("runId", runId);
    return `${path}${query.size ? `?${query}` : ""}`;
  }

  function requestS003ShellAction(operation, payload = {}) {
    if (window.parent === window) return false;
    const context = activeScenarioContext();
    window.parent.postMessage({
      channel: SCENARIO_SHELL_CHANNEL,
      operation,
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      ...payload
    }, window.location.origin);
    return true;
  }

  function requestS003ShellOperation(operation, payload = {}) {
    if (window.parent === window) return Promise.reject(new Error("当前页面未运行在统一场景壳内"));
    const context = activeScenarioContext();
    if (!sameScenarioContext(context, s003RequestedContext())) return Promise.reject(new Error("S003 场景运行身份未对齐"));
    const requestId = `s003-m06-${Date.now()}-${++idSequence}`;
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        s003ShellRequests.delete(requestId);
        reject(new Error(`${operation} 等待统一场景壳响应超时`));
      }, 8000);
      s003ShellRequests.set(requestId, { resolve, reject, timeoutId });
      window.parent.postMessage({
        channel: SCENARIO_SHELL_CHANNEL,
        operation,
        requestId,
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        payload
      }, window.location.origin);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.channel !== SCENARIO_SHELL_CHANNEL) return;
    const message = event.data;
    if (!message.requestId || !String(message.operation || "").endsWith(":response")) return;
    const pending = s003ShellRequests.get(message.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    s003ShellRequests.delete(message.requestId);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new Error(message.error || "统一场景壳操作失败"));
  });

  function s003RuntimeTier(value) {
    if (value && typeof value === "object") return clone(value);
    const tierId = String(value || "UNKNOWN").toUpperCase();
    return {
      tierId,
      name: ({ GREEN: "绿灯", YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯" })[tierId] || "待评估"
    };
  }

  function s003StableFingerprintValue(value) {
    if (Array.isArray(value)) return value.map(s003StableFingerprintValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = s003StableFingerprintValue(value[key]);
      return result;
    }, {});
  }

  function s003ContentFingerprint(prefix, value) {
    const text = JSON.stringify(s003StableFingerprintValue(value));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function s003ModelConfigFingerprint(model) {
    if (!model?.packageId || !model?.weights || !Array.isArray(model?.factors) || !Array.isArray(model?.riskTiers)) return null;
    return s003ContentFingerprint("S003-MODEL", {
      packageId: model.packageId,
      resourceType: model.resourceType,
      indicatorOrder: model.indicatorOrder,
      weights: model.weights,
      factors: model.factors,
      riskTiers: model.riskTiers,
      formulas: model.formulas,
      scoreAnchors: model.scoreAnchors,
      profitStability: model.profitStability,
      actionTypes: model.actionTypes,
      assessment: model.assessment
    });
  }

  function s003InputConfigFingerprint(snapshot) {
    const values = Array.isArray(snapshot?.records) ? snapshot.records : snapshot?.values;
    if (!snapshot || (!values || typeof values !== "object")) return null;
    return s003ContentFingerprint("S003-INPUT", {
      assessmentAt: snapshot.assessmentAt,
      enterpriseCount: snapshot.enterpriseCount,
      factorCount: snapshot.factorCount,
      values
    });
  }

  function s003ConfigurationDelta(staticResources, run, currentModel, currentInput) {
    const runModelVersion = run?.modelVersion || staticResources?.reportManifest?.modelIdentity?.packageVersion || null;
    const runInputSnapshotId = run?.inputSnapshotId || staticResources?.results?.inputIdentity?.humanInputSnapshotId || null;
    const currentModelFingerprint = s003ModelConfigFingerprint(currentModel);
    const currentInputFingerprint = s003InputConfigFingerprint(currentInput);
    const staticModelFingerprint = s003ModelConfigFingerprint(staticResources?.publishedModel);
    const staticInputFingerprint = s003InputConfigFingerprint(staticResources?.inputSnapshot);
    const runModelFingerprint = run?.modelConfigurationFingerprint
      || (runModelVersion && runModelVersion === currentModel?.packageVersion ? currentModelFingerprint : null)
      || (runModelVersion && runModelVersion === staticResources?.publishedModel?.packageVersion ? staticModelFingerprint : null);
    const runInputFingerprint = run?.inputConfigurationFingerprint
      || (runInputSnapshotId && runInputSnapshotId === currentInput?.snapshotId ? currentInputFingerprint : null)
      || (runInputSnapshotId && runInputSnapshotId === staticResources?.inputSnapshot?.snapshotId ? staticInputFingerprint : null);
    const modelChanged = Boolean(currentModelFingerprint && runModelFingerprint && currentModelFingerprint !== runModelFingerprint);
    const inputChanged = Boolean(currentInputFingerprint && runInputFingerprint && currentInputFingerprint !== runInputFingerprint);
    return {
      ahead: modelChanged || inputChanged,
      modelChanged,
      inputChanged,
      currentModelFingerprint,
      runModelFingerprint,
      currentInputFingerprint,
      runInputFingerprint
    };
  }

  function s003ConfigurationDeltaForResources(resources = s003Dashboard.resources) {
    const runtimeDelta = resources?.runtime?.configurationDelta;
    if (runtimeDelta && typeof runtimeDelta.ahead === "boolean") return runtimeDelta;
    const currentModel = resources?.configurationModel || resources?.publishedModel || null;
    const currentInput = resources?.currentInputSnapshot || resources?.inputSnapshot || null;
    return s003ConfigurationDelta(resources, null, currentModel, currentInput);
  }

  function s003ConfigurationDeltaLabel(delta) {
    if (delta?.modelChanged && delta?.inputChanged) return "模型配置和企业因子输入";
    if (delta?.inputChanged) return "企业因子输入";
    return "模型配置";
  }

  function s003RuntimeResultRecord(item, context) {
    const raw = item?.raw || {};
    return {
      ...clone(raw),
      scenarioIdentity: clone(context),
      enterprise: {
        enterpriseId: item.enterpriseId || raw.enterprise?.enterpriseId,
        name: item.enterpriseName || raw.enterprise?.name,
        sector: item.sector || raw.enterprise?.sector,
        category: item.category || raw.enterprise?.category
      },
      assessmentAt: item.assessmentAt || raw.assessmentAt,
      rawScore: item.rawScore,
      factorSum: item.factorSum,
      compositeAdjustment: item.compositeAdjustment,
      finalScore: item.finalScore,
      riskTier: s003RuntimeTier(item.riskTier || raw.riskTier),
      indicatorResults: clone(item.metrics || raw.indicatorResults || []),
      factorResults: clone(item.factors || raw.factorResults || []),
      lowestThree: clone(item.lowestMetrics || raw.lowestThree || []),
      dispositionCandidates: clone(item.candidateActions || item.dispositionCandidates || raw.dispositionCandidates || [])
    };
  }

  function s003RuntimeReportFallback(record, context, run) {
    const tier = s003RuntimeTier(record.riskTier);
    const binding = (run?.reportBindings || []).find((item) => item.enterpriseId === record.enterprise.enterpriseId) || null;
    const reportId = binding?.reportId || `S003-RPT-${context.scenarioRunId}-${record.enterprise.enterpriseId}`;
    return {
      schemaVersion: "ofw.s003.m06.enterprise-report-content.v1",
      moduleId: "M06",
      reportId,
      reportVersion: binding?.reportVersion || "runtime-preview",
      contentVersion: binding?.contentVersion || "runtime-preview",
      artifactVersion: binding?.artifactVersion || "browser-work-projection",
      status: "runtime-preview",
      immutable: false,
      projectionOnly: true,
      generatedAt: run.evaluatedAt,
      scenarioIdentity: clone(context),
      enterprise: clone(record.enterprise),
      assessment: {
        assessmentAt: record.assessmentAt,
        currency: "CNY",
        amountUnit: "元",
        rawScore: record.rawScore,
        factorSum: record.factorSum,
        compositeAdjustment: record.compositeAdjustment,
        finalScore: record.finalScore,
        riskTier: tier,
        isUnderConstruction: record.enterprise.category === "在建企业"
      },
      conclusion: `${record.enterprise.name}本轮工作投影综合得分为 ${Number(record.finalScore).toFixed(2)} 分，风险等级为${tier.name}；该结果尚未提升为正式 Published 事实。`,
      keyIndicators: clone((record.lowestThree || []).slice(0, 3)),
      indicatorDetails: clone(record.indicatorResults || []),
      adjustmentFactors: clone(record.factorResults || []),
      evidenceReferences: [],
      generationPolicy: {
        sourceIsPublished: false,
        clientSideScoreRecalculation: false,
        createsActionRequest: false,
        createsTodo: false,
        sendsNotification: false,
        dedicatedAgentRequired: false
      }
    };
  }

  function s003RuntimeResources(staticResources, snapshot, selectedRun = null) {
    const explicitSelection = Boolean(selectedRun);
    const context = normalizeScenarioContext(selectedRun?.scenarioContext || snapshot?.context || {});
    const active = s003RequestedContext();
    const run = selectedRun || snapshot?.activeRun || null;
    const runContext = normalizeScenarioContext(run?.scenarioContext || {});
    const currentModel = snapshot?.publishedModel || staticResources.publishedModel;
    const currentInput = snapshot?.factorInputSnapshot || staticResources.inputSnapshot;
    const configurationDelta = s003ConfigurationDelta(staticResources, run, currentModel, currentInput);
    const base = {
      ...staticResources,
      configurationModel: currentModel,
      currentInputSnapshot: currentInput,
      runtimeSnapshot: snapshot,
      runtime: {
        available: true,
        context,
        runStatus: snapshot?.runStatus || null,
        runError: snapshot?.runError || null,
        operationLineage: snapshot?.operationLineage || null,
        operationNotice: snapshot?.operationNotice || null,
        projectionNotice: snapshot?.projectionNotice || null,
        authorityMode: run?.authorityMode || null,
        projectionOnly: Boolean(run?.projectionOnly),
        runModelVersion: run?.modelVersion || null,
        currentModelVersion: currentModel?.packageVersion || null,
        inputSnapshotId: currentInput?.snapshotId || null,
        configurationAhead: configurationDelta.ahead,
        configurationDelta,
        selectedRunId: run?.runId || null,
        selectedRunExplicitly: explicitSelection,
        summaryOnly: Boolean(run && !Array.isArray(run.enterpriseResults))
      }
    };
    if ((!sameScenarioContext(context, active) || !sameScenarioContext(runContext, active)) && !explicitSelection) return base;
    if (run?.authorityMode === "published-evidence" && run?.projectionOnly !== true
      && sameScenarioContext(runContext, s003ResourceContext(staticResources))) return base;
    if (!Array.isArray(run?.enterpriseResults) || run.enterpriseResults.length === 0) return base;
    const results = run.enterpriseResults.map((item) => s003RuntimeResultRecord(item, runContext));
    const reportSource = Array.isArray(run.reports) && run.reports.length === results.length
      ? run.reports.map((report) => ({ ...clone(report), immutable: false, status: "runtime-preview", projectionOnly: true }))
      : results.map((record) => s003RuntimeReportFallback(record, runContext, run));
    const reports = reportSource.map((content) => ({
      reportId: content.reportId,
      contentVersion: content.contentVersion || "runtime-preview",
      contentSha256: null,
      projectionOnly: true,
      content
    }));
    const runtimeCandidates = results.flatMap((record) => (record.dispositionCandidates || []).map((candidate) => ({
      ...clone(candidate),
      scenarioIdentity: clone(runContext),
      enterpriseId: record.enterprise.enterpriseId,
      enterpriseName: record.enterprise.name,
      sector: record.enterprise.sector,
      category: record.enterprise.category,
      riskTier: s003Tier(record),
      riskTierName: s003TierName(record),
      finalScore: record.finalScore,
      sourceResultId: record.resultId || `S003-C035-WORK-${runContext.scenarioRunId}-${record.enterprise.enterpriseId}`,
      sourceResultVersion: record.resultVersion || "runtime-preview",
      assessmentAt: record.assessmentAt,
      requiresHumanConfirmation: true,
      actionRequestId: null,
      todoId: null,
      autoCreateActionRequest: false,
      autoCreateTodo: false
    })));
    return {
      ...base,
      publishedModel: currentModel,
      inputSnapshot: currentInput,
      resourceScenarioContext: runContext,
      results: {
        schemaVersion: "ofw.s003.c035.runtime-projection.v1",
        contractId: "C035",
        resultSetId: `S003-C035-WORK-${runContext.scenarioRunId}`,
        resultSetVersion: "runtime-preview",
        status: "runtime-projection",
        immutable: false,
        projectionOnly: true,
        formedAt: run.evaluatedAt,
        scenarioIdentity: clone(runContext),
        assessmentAt: run.assessmentAt,
        inputIdentity: {
          dataAssetId: run.dataAssetId,
          dataAssetVersion: staticResources.results?.inputIdentity?.dataAssetVersion || null,
          humanInputSnapshotId: run.inputSnapshotId,
          humanInputSnapshotVersion: currentInput?.snapshotVersion || null,
          qualityResultId: staticResources.quality?.qualityResultId || null
        },
        enterpriseCount: results.length,
        results
      },
      reportManifest: {
        schemaVersion: "ofw.s003.m06.runtime-report-manifest.v1",
        moduleId: "M06",
        status: "runtime-report-preview",
        immutable: false,
        projectionOnly: true,
        scenarioIdentity: clone(runContext),
        assessmentAt: run.assessmentAt,
        modelIdentity: {
          packageId: currentModel?.packageId || "S003-M01-DEBT-RISK-PKG",
          packageVersion: run.modelVersion,
          lifecycleStatus: "published-runtime-input"
        },
        reportCount: reports.length,
        reports: reports.map((report) => ({
          reportId: report.reportId,
          enterpriseId: report.content.enterprise.enterpriseId,
          enterpriseName: report.content.enterprise.name,
          finalScore: report.content.assessment.finalScore,
          riskTierId: s003Tier(report.content.assessment.riskTier),
          scenarioIdentity: clone(runContext),
          projectionOnly: true
        }))
      },
      reportContents: {
        schemaVersion: "ofw.s003.m06.runtime-report-content-set.v1",
        moduleId: "M06",
        status: "runtime-report-previews",
        immutable: false,
        projectionOnly: true,
        scenarioIdentity: clone(runContext),
        assessmentAt: run.assessmentAt,
        reportCount: reports.length,
        reports
      },
      decisionResults: {
        schemaVersion: "ofw.s003.m04.runtime-candidate-projection.v1",
        moduleId: "M04",
        status: "runtime-candidate-preview",
        immutable: false,
        projectionOnly: true,
        scenarioIdentity: clone(runContext),
        candidateSummary: { total: runtimeCandidates.length, awaitingHumanConfirmation: runtimeCandidates.length },
        candidatesBeforeConfirmation: runtimeCandidates,
        confirmedDecision: null
      }
    };
  }

  function s003RunOptions(staticResources = s003Dashboard.staticResources, snapshot = s003Dashboard.runtimeSnapshot) {
    if (!staticResources) return [];
    const formalContext = s003ResourceContext(staticResources);
    const formal = {
      runId: formalContext.scenarioRunId,
      scenarioContext: formalContext,
      assessmentAt: staticResources.results?.assessmentAt,
      evaluatedAt: staticResources.results?.formedAt || staticResources.reportManifest?.formedAt,
      modelVersion: staticResources.reportManifest?.modelIdentity?.packageVersion || staticResources.publishedModel?.packageVersion,
      inputSnapshotId: staticResources.results?.inputIdentity?.humanInputSnapshotId,
      reportCount: staticResources.reportManifest?.reportCount || 0,
      authorityMode: "published-evidence",
      projectionOnly: false,
      riskCounts: clone(staticResources.reportManifest?.summary?.riskTierCounts || {}),
      detailed: true,
      source: "formal-resource"
    };
    const candidates = [snapshot?.activeRun, ...(snapshot?.runHistory || []), snapshot?.lastSuccessfulRun].filter(Boolean);
    const byId = new Map([[formal.runId, formal]]);
    candidates.forEach((run) => {
      if (!run?.runId) return;
      const current = byId.get(run.runId);
      const detailed = Array.isArray(run.enterpriseResults) && run.enterpriseResults.length > 0;
      if (!current || detailed) byId.set(run.runId, { ...clone(run), detailed, source: "runtime" });
    });
    return [...byId.values()].sort((left, right) => String(right.evaluatedAt || "").localeCompare(String(left.evaluatedAt || "")));
  }

  function s003SummaryOnlyResources(staticResources, snapshot, run) {
    const context = normalizeScenarioContext(run?.scenarioContext || {});
    const counts = clone(run?.riskCounts || {});
    const currentModel = snapshot?.publishedModel || staticResources.publishedModel;
    const currentInput = snapshot?.factorInputSnapshot || staticResources.inputSnapshot;
    const configurationDelta = s003ConfigurationDelta(staticResources, run, currentModel, currentInput);
    return {
      ...staticResources,
      configurationModel: currentModel,
      currentInputSnapshot: currentInput,
      resourceScenarioContext: context,
      results: {
        ...clone(staticResources.results),
        resultSetId: `S003-C035-SUMMARY-${run.runId}`,
        resultSetVersion: "summary-only",
        status: "historical-summary-only",
        immutable: true,
        projectionOnly: true,
        scenarioIdentity: context,
        assessmentAt: run.assessmentAt,
        enterpriseCount: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
        results: []
      },
      reportManifest: {
        ...clone(staticResources.reportManifest),
        manifestId: `S003-M06-RUN-SUMMARY-${run.runId}`,
        manifestVersion: "summary-only",
        status: "historical-summary-only",
        immutable: true,
        projectionOnly: true,
        scenarioIdentity: context,
        assessmentAt: run.assessmentAt,
        reportCount: run.reportCount || 0,
        reports: [],
        summary: { riskTierCounts: counts }
      },
      reportContents: {
        ...clone(staticResources.reportContents),
        contentSetId: `S003-M06-CONTENT-SUMMARY-${run.runId}`,
        contentSetVersion: "summary-only",
        status: "historical-summary-only",
        immutable: true,
        projectionOnly: true,
        scenarioIdentity: context,
        assessmentAt: run.assessmentAt,
        reportCount: 0,
        reports: []
      },
      runtimeSnapshot: snapshot,
      runtime: {
        available: true,
        selectedRunId: run.runId,
        selectedRunExplicitly: true,
        summaryOnly: true,
        runStatus: run.status,
        authorityMode: run.authorityMode,
        projectionOnly: true,
        runModelVersion: run.modelVersion,
        inputSnapshotId: run.inputSnapshotId,
        configurationAhead: configurationDelta.ahead,
        configurationDelta,
        riskCounts: counts
      }
    };
  }

  function s003ResourcesForRun(runId = s003Dashboard.selectedRunId) {
    const staticResources = s003Dashboard.staticResources;
    const snapshot = s003Dashboard.runtimeSnapshot;
    if (!staticResources) return null;
    const options = s003RunOptions(staticResources, snapshot);
    const selected = options.find((run) => run.runId === runId) || options[0];
    if (!selected || selected.source === "formal-resource") {
      // The formal dashboard must compare the formal result against the
      // authoritative static Published model/input pair. A stale browser
      // projection may contain an older model version; using it here makes a
      // no-op version difference look like an unrequested configuration change.
      const currentModel = staticResources.publishedModel;
      const currentInput = staticResources.inputSnapshot;
      const configurationDelta = s003ConfigurationDelta(staticResources, selected, currentModel, currentInput);
      return { ...staticResources, configurationModel: currentModel, currentInputSnapshot: currentInput, runtimeSnapshot: snapshot, runtime: { ...(staticResources.runtime || {}), selectedRunId: selected?.runId || null, selectedRunExplicitly: Boolean(runId), summaryOnly: false, authorityMode: "published-evidence", projectionOnly: false, runModelVersion: selected?.modelVersion || staticResources.publishedModel?.packageVersion, configurationAhead: configurationDelta.ahead, configurationDelta } };
    }
    if (!selected.detailed) return s003SummaryOnlyResources(staticResources, snapshot, selected);
    return s003RuntimeResources(staticResources, snapshot, selected);
  }

  function assertS003ResourceIdentity(resources, publishedPointer, publishedModel) {
    const resourceContext = s003ResourceContext(resources);
    if (resourceContext.scenarioId !== S003_CONFIG.id || !resourceContext.scenarioVersion || !resourceContext.scenarioRunId) {
      throw new Error("S003 风险结果缺少完整场景运行身份");
    }
    const runBoundResources = [
      ["Published 指针", publishedPointer?.scenarioIdentity],
      ["风险结果", resources.results?.scenarioIdentity],
      ["Published 事实", resources.facts?.scenarioIdentity],
      ["报告清单", resources.reportManifest?.scenarioIdentity],
      ["报告内容", resources.reportContents?.scenarioIdentity],
      ["报告版本历史", resources.reportHistory?.scenarioIdentity]
    ];
    runBoundResources.forEach(([label, context]) => {
      if (!sameScenarioContext(resourceContext, normalizeScenarioContext(context || {}))) {
        throw new Error(`${label}与 S003 风险结果不属于同一 scenarioRunId`);
      }
    });
    const mismatchedReport = (resources.reportContents?.reports || []).find((report) => !sameScenarioContext(resourceContext, normalizeScenarioContext(report.content?.scenarioIdentity || {})));
    if (mismatchedReport) throw new Error(`企业报告 ${mismatchedReport.reportId || "未知标识"} 与报告清单不属于同一 scenarioRunId`);
    if (publishedPointer?.status !== "active" || publishedPointer?.activeTarget?.lifecycleStatus !== "published") {
      throw new Error("S003 Published 模型指针不是 active / published 状态");
    }
    if (!publishedModel?.packageId || !publishedModel?.packageVersion) throw new Error("S003 Published 模型快照不可读取");
    if (publishedPointer.activeTarget.packageId !== publishedModel.packageId || publishedPointer.activeTarget.packageVersion !== publishedModel.packageVersion) {
      throw new Error("S003 Published 指针目标与内嵌模型快照不一致");
    }
    if (resources.reportManifest?.modelIdentity?.packageId !== publishedModel.packageId || resources.reportManifest?.modelIdentity?.packageVersion !== publishedModel.packageVersion) {
      throw new Error("S003 报告清单与当前 Published 模型版本不一致");
    }
    if (resources.results?.inputIdentity?.humanInputSnapshotId !== resources.inputSnapshot?.snapshotId) {
      throw new Error("S003 风险结果与企业因子输入快照不一致");
    }
    if (resources.results?.inputIdentity?.qualityResultId !== resources.quality?.qualityResultId) {
      throw new Error("S003 风险结果与数据质量结果不一致");
    }
    return resourceContext;
  }

  async function loadS003Dashboard() {
    if (!S003_CONFIG) return null;
    if (s003Dashboard.status === "ready") return s003Dashboard.resources;
    if (s003Dashboard.loading) return s003Dashboard.loading;
    const urls = S003_CONFIG.dashboard?.resourceUrls || {};
    s003Dashboard.status = "loading";
    const resourceRequests = new Map();
    const resourcesRequest = Promise.all(Object.entries(urls).map(async ([key, url]) => {
      if (!resourceRequests.has(url)) {
        resourceRequests.set(url, fetch(url, { cache: "no-cache" }).then(async (response) => {
          if (!response.ok) throw new Error(`${url} · ${response.status} ${response.statusText}`);
          return response.json();
        }));
      }
      return [key, await resourceRequests.get(url)];
    }));
    s003Dashboard.loading = resourcesRequest.then(async (entries) => {
      const resources = Object.fromEntries(entries);
      const publishedPointer = resources.publishedPointer || resources.model || null;
      const publishedModel = publishedPointer?.activeTarget?.publishedSnapshot || null;
      const resourceScenarioContext = assertS003ResourceIdentity(resources, publishedPointer, publishedModel);
      if ((resources.results?.results || []).length !== Number(resources.reportManifest?.reportCount || 0)
        || Number(resources.reportManifest?.reportCount || 0) !== (resources.reportContents?.reports || []).length) {
        throw new Error("S003 企业风险结果与报告数量不一致");
      }
      if (resources.reportDefinition?.lifecycleStatus !== "published"
        || resources.reportTemplate?.lifecycleStatus !== "published"
        || resources.reportTemplate?.definitionId !== resources.reportDefinition?.definitionId) {
        throw new Error("S003 报告定义与模板未形成一致的 Published 绑定");
      }
      if (resources.reportAssurance?.lifecycleStatus !== "published"
        || !Array.isArray(resources.reportAssurance?.verificationChecks)
        || !Array.isArray(resources.reportAssurance?.companionQuestions)) {
        throw new Error("S003 报告核验与伴读配置不可用");
      }
      if (resources.actionTypeCatalog?.lifecycleStatus !== "published"
        || !sameScenarioContext(normalizeScenarioContext(resources.actionTypeCatalog?.scenarioIdentity || {}), resourceScenarioContext)
        || resources.actionTypeCatalog?.publishedModelBinding?.packageId !== publishedModel.packageId
        || resources.actionTypeCatalog?.publishedModelBinding?.packageVersion !== publishedModel.packageVersion
        || !(resources.actionTypeCatalog?.actionTypes || []).every((item) => item.actionTypeId && item.displayName && item.description)) {
        throw new Error("S003 Published Action Type 展示目录不完整或与当前模型身份不一致");
      }
      if (Number(resources.reportArtifacts?.artifactCount || 0) !== Number(resources.reportManifest?.reportCount || 0)) {
        throw new Error("S003 正式报告清单与产物数量不一致");
      }
      if (resources.reportHistory?.currentManifestRef !== "resources/m06/report-manifest.v9.json"
        || resources.reportHistory?.versionCount !== (resources.reportHistory?.versions || []).length
        || resources.reportHistory?.versions?.at(-1)?.manifestVersion !== resources.reportManifest?.manifestVersion) {
        throw new Error("S003 报告版本历史与当前正式报告清单不一致");
      }
      const staticResources = { ...resources, checkpoints: [], publishedPointer, publishedModel, configurationModel: publishedModel, currentInputSnapshot: resources.inputSnapshot, resourceScenarioContext };
      let runtimeSnapshot = null;
      let runtimeError = null;
      try {
        runtimeSnapshot = await requestS003ShellOperation("getS003RuntimeSnapshot");
      } catch (error) {
        runtimeError = error?.message || String(error);
      }
      s003Dashboard.runtimeSnapshot = runtimeSnapshot;
      s003Dashboard.runtimeError = runtimeError;
      s003Dashboard.checkpointIssues = [];
      s003Dashboard.staticResources = staticResources;
      const requestedRunId = routeInfo().query.get("runId");
      const availableRuns = s003RunOptions(staticResources, runtimeSnapshot);
      const preferredRunId = requestedRunId && availableRuns.some((run) => run.runId === requestedRunId)
        ? requestedRunId
        : runtimeSnapshot?.activeRun?.runId || resourceScenarioContext.scenarioRunId;
      s003Dashboard.selectedRunId = s003Dashboard.selectedRunId && availableRuns.some((run) => run.runId === s003Dashboard.selectedRunId)
        ? s003Dashboard.selectedRunId
        : preferredRunId;
      s003Dashboard.resources = runtimeSnapshot ? s003ResourcesForRun(s003Dashboard.selectedRunId) : staticResources;
      const requestedEnterpriseId = routeInfo().query.get("enterpriseId");
      const candidateEnterpriseId = requestedEnterpriseId || s003Dashboard.selectedEnterpriseId;
      const resultIds = new Set((s003Dashboard.resources.results?.results || []).map((record) => record.enterprise?.enterpriseId));
      s003Dashboard.selectedEnterpriseId = resultIds.has(candidateEnterpriseId)
        ? candidateEnterpriseId
        : s003Dashboard.resources.results?.results?.[0]?.enterprise?.enterpriseId || null;
      s003Dashboard.focusedCandidateId = routeInfo().query.get("candidateId") || null;
      s003Dashboard.status = "ready";
      s003Dashboard.error = null;
      const scheduleCheckpointLoad = () => { void loadS003CheckpointCatalog(staticResources); };
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(scheduleCheckpointLoad, { timeout: 1800 });
      else window.setTimeout(scheduleCheckpointLoad, 0);
      return s003Dashboard.resources;
    }).catch((error) => {
      s003Dashboard.status = "failed";
      s003Dashboard.error = error?.message || String(error);
      return null;
    }).finally(() => {
      s003Dashboard.loading = null;
      if (["/dashboard/s003", "/lifecycle", "/reports", "/reports/s003", "/reports/generate", "/reports/draft", "/reports/view", "/reports/pdf"].includes(routeInfo().path)) renderApp();
    });
    return s003Dashboard.loading;
  }

  function loadS003CheckpointCatalog(staticResources = s003Dashboard.staticResources) {
    if (!S003_CONFIG || !staticResources) return Promise.resolve([]);
    if (s003Dashboard.checkpointLoading) return s003Dashboard.checkpointLoading;
    const urls = S003_CONFIG.dashboard?.checkpointUrls || [];
    s003Dashboard.checkpointLoading = Promise.allSettled(urls.map(async (url) => {
      // Checkpoint 清单不可变，允许浏览器直接复用缓存；它不参与驾驶舱首屏
      // 的 Published 结果消费门，避免 30+ 个历史文件阻塞当前风险总览。
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`${url} · ${response.status} ${response.statusText}`);
      return response.json();
    })).then((results) => {
      const checkpoints = results.filter((item) => item.status === "fulfilled").map((item) => item.value);
      const checkpointIssues = results.filter((item) => item.status === "rejected").map((item) => item.reason?.message || String(item.reason));
      if (staticResources === s003Dashboard.staticResources) {
        staticResources.checkpoints = checkpoints;
        s003Dashboard.checkpointIssues = checkpointIssues;
        if (s003Dashboard.resources) s003Dashboard.resources.checkpoints = checkpoints;
      }
      return checkpoints;
    }).finally(() => {
      s003Dashboard.checkpointLoading = null;
    });
    return s003Dashboard.checkpointLoading;
  }

  function currentPublishedReports() {
    return (state.publishedReports || []).filter(resourceInCurrentScenario);
  }

  function currentActionRequests() {
    return (state.actionRequests || []).filter(resourceInCurrentScenario);
  }

  function freshVerification() {
    return {
      scenarioContext: null,
      status: "idle",
      attempt: 0,
      progress: 0,
      runId: null,
      retryOf: null,
      scope: "整份报告",
      filter: "all",
      results: [],
      completedAt: null,
      scopeContext: null,
      runScope: null,
      anchorCount: 0,
      factCount: 0,
      planVersion: null,
      coverage: {
        status: "not_started",
        planned: 0,
        applicable: 0,
        completed: 0,
        pending: 0,
        error: 0,
        notApplicable: 0,
        skipped: 0,
        factTotal: 0,
        factCovered: 0,
        anchorTotal: 0,
        anchorCovered: 0,
      },
      explanationRequestId: null,
      explanationRunId: null,
      explanationResultId: null,
      explanationSubmittedAt: null,
      explanationReadAt: null,
      planSnapshot: [],
      unitResults: [],
      currentStatusSummary: null,
      currentBindingSnapshot: null,
      currentStatusReadAt: null,
    };
  }

  function freshComparison() {
    return {
      scenarioContext: null,
      status: "idle",
      recordId: null,
      comparedAt: null,
      currentVersion: null,
      reportSnapshot: null,
      reportFactPackage: null,
      reportTrust: null,
      currentBinding: null,
      currentTrust: null,
      currentFactPackage: null,
      candidateSnapshot: null,
      dataPreviousSnapshot: null,
      previousAuthoritativeSnapshot: null,
      gateVersion: "C027-GATE-1.0",
      thresholdVersion: "报告定义 1.0.0",
      permission: null,
      compatibility: null,
      gate: null,
      comparisonOutcome: null,
      comparisonOutcomeReason: null,
      recordStatus: "当前",
      staleReason: null,
      staleDetectedAt: null,
      currentStatusReadAt: null,
      results: [],
      counts: { same: 0, changed: 0, unverifiable: 0 },
      explanationRequestId: null,
      explanationRunId: null,
      explanationResultId: null,
      explanationSubmittedAt: null,
      explanationReadAt: null,
    };
  }

  function syncComparisonRecordReferences(report, comparison) {
    if (!comparison?.recordId) return;
    const record = (report.comparisonRecords || []).find((item) => item.recordId === comparison.recordId);
    if (!record) return;
    ["explanationRequestId", "explanationRunId", "explanationResultId", "explanationSubmittedAt", "explanationReadAt"].forEach((field) => {
      if (record[field] == null && comparison[field] != null) record[field] = comparison[field];
    });
  }

  function syncVerificationArchiveReferences(report, verification) {
    if (!verification?.runId) return;
    const archived = (report.verificationRuns || []).find((item) => item.runId === verification.runId);
    if (!archived) return;
    ["explanationRequestId", "explanationRunId", "explanationResultId", "explanationSubmittedAt", "explanationReadAt"].forEach((field) => {
      if (archived[field] == null && verification[field] != null) archived[field] = verification[field];
    });
  }

  function markPriorComparisonRecordsStale(report, currentRecordId, detectedAt) {
    (report.comparisonRecords || []).forEach((record) => {
      if (!record?.recordId || !sameScenarioContext(record.scenarioContext, report.scenarioContext) || record.recordId === currentRecordId || record.recordStatus && record.recordStatus !== "当前") return;
      record.recordStatus = "已陈旧";
      record.staleReason = "已形成新的显式比较记录；原比较上下文和确定性结果保持不变。";
      record.staleDetectedAt = detectedAt;
    });
  }

  function freshHumanReview() {
    return { status: "pending", contentVersion: null, reviewer: null, completedAt: null, note: null };
  }

  function newReportRecord() {
    return {
      scenarioContext: null,
      aggregateId: null,
      stage: "idle",
      definitionId: "RD-FIN-001",
      generationMode: "standard",
      progress: 0,
      requestId: null,
      evidencePackId: null,
      generationRunId: null,
      generationResultId: null,
      agentGenerationRefs: [],
      contentVersions: [],
      verificationRuns: [],
      evidencePacks: [],
      reviewHistory: [],
      publicationRuns: [],
      activeOperation: null,
      draftId: null,
      reviewCopyId: null,
      draftVersion: null,
      contentVersion: null,
      contentSnapshot: null,
      revisionNumber: 0,
      generatedAt: null,
      returnedAt: null,
      confirmedAt: null,
      publishedAt: null,
      reportNo: null,
      publicationId: null,
      frozenHtml: null,
      artifactManifest: null,
      humanReview: freshHumanReview(),
      issues: [],
      verification: freshVerification(),
      comparison: freshComparison(),
      comparisonRecords: [],
      trustWarnings: [],
      generationBlock: null,
      publicationVerificationRef: null,
      postPublicationVerification: null,
    };
  }

  function newState() {
    const s003 = s003ScenarioSelected();
    return {
      stateVersion: 4,
      nonce: Date.now(),
      navOpen: false,
      catalog: {
        query: "",
        status: "all",
        type: "all",
        view: "list",
      },
      wizard: {
        step: 1,
        reportType: s003 ? "s003-debt-risk" : "finance",
        scope: "集团",
        semantic: "published-current",
        dataContext: "current",
        compatibility: "idle",
        generationMode: "standard",
      },
      dashboard: {
        tab: "overview",
        scopeType: "group",
        scopeId: "集团",
        compareUnits: s003 ? [] : ["单位553", "单位465", "单位561"],
      },
      actionRequests: [],
      insight: {
        requestId: null,
        resultId: null,
        runId: null,
        sessionId: null,
        bindingId: null,
        confirmationRequestId: null,
        submittedAt: null,
        bindingSnapshot: null,
        referenced: false,
      },
      publishedReports: [],
      withdrawnReports: [],
      replacementRelations: [],
      exportTasks: [],
      publishAttempt: 0,
      regenerationRequest: null,
      report: newReportRecord(),
      customDefinitions: [],
      assistant: {
        tab: "qa",
        selectedAnchor: "metric-cost",
        selectedSection: "sec-overview",
        qaDraft: "",
        requestRef: null,
      },
      ui: {
        modal: null,
        drawer: null,
        readerMoreOpen: false,
        actionUnit: s003 ? null : "单位553",
        actionSubmissionId: null,
        pendingActionRef: null,
        tempDefinitionName: "",
        tempDefinitionPurpose: "",
        pendingScrollAnchor: null,
        pendingExternalReturn: null,
        viewingReportNo: null,
      },
    };
  }

  function factPackageReference(factPackage) {
    if (!factPackage) return null;
    return {
      packageId: factPackage.packageId || null,
      packageVersion: factPackage.packageVersion || null,
      schemaVersion: factPackage.schemaVersion || null,
      factInventoryVersion: factPackage.factInventoryVersion || null,
      factPackageStatus: factPackage.factPackageStatus || factPackage.status || "unavailable",
      semanticVersionId: factPackage.semanticVersionId || null,
      semanticVersion: factPackage.semanticVersion || null,
      dataAssetVersionId: factPackage.dataAssetVersionId || null,
      dataVersion: factPackage.dataVersion || null,
      consumableVersionId: factPackage.consumableVersionId || null,
      asOf: factPackage.asOf || null,
      statusReason: factPackage.statusReason || null,
    };
  }

  function resolveExactFactPackage(reference) {
    if (!reference?.dataVersion) return null;
    const candidate = DATA.reportEvidence.factPackages?.[reference.dataVersion]
      || runtimeFactPackages.get(reference.dataVersion)
      || materializeS001FactPackage(currentAuthority());
    const exact = candidate
      && (!reference.packageId || candidate.packageId === reference.packageId)
      && (!reference.semanticVersionId || candidate.semanticVersionId === reference.semanticVersionId)
      && (!reference.dataAssetVersionId || candidate.dataAssetVersionId === reference.dataAssetVersionId)
      && (!reference.consumableVersionId || candidate.consumableVersionId === reference.consumableVersionId);
    if (exact) return clone(candidate);
    return {
      ...clone(reference),
      status: "unavailable",
      factPackageStatus: "unavailable",
      contentFacts: [],
      anchors: [],
      contentItems: [],
      renderManifest: null,
      generatedNarrativeContract: null,
      statusReason: reference.statusReason || "原精确事实包不可定位；不得改用当前定义或其他数据版本替代。",
    };
  }

  function compactEvidencePack(evidencePack) {
    if (!evidencePack) return evidencePack;
    const { authoritativeFactPackage, authoritativeFactPackageRef, ...rest } = evidencePack;
    return {
      ...rest,
      authoritativeFactPackageRef: factPackageReference(authoritativeFactPackage || authoritativeFactPackageRef),
    };
  }

  function compactGeneratedContentFact(fact) {
    if (!fact) return fact;
    return {
      contentFactId: fact.contentFactId || null,
      sourceFactId: fact.sourceFactId || null,
      factId: fact.factId || null,
      intendedFactId: fact.intendedFactId || null,
      label: fact.label || null,
      kind: fact.kind || null,
      value: clone(fact.value),
      authoritativeValue: clone(fact.authoritativeValue),
      unit: fact.unit ?? null,
      scope: fact.scope || null,
      resultVersion: fact.resultVersion || null,
      evidenceRefs: clone(fact.evidenceRefs || []),
      anchorIds: clone(fact.anchorIds || []),
      bindingStatus: fact.bindingStatus || null,
      basis: clone(fact.basis || []),
    };
  }

  function hydrateEvidencePack(evidencePack) {
    if (!evidencePack) return evidencePack;
    const legacyPackage = evidencePack.authoritativeFactPackage;
    const reference = evidencePack.authoritativeFactPackageRef || factPackageReference(legacyPackage);
    const authoritativeFactPackage = legacyPackage?.contentFacts?.length
      ? clone(legacyPackage)
      : resolveExactFactPackage(reference);
    return {
      ...evidencePack,
      authoritativeFactPackageRef: reference,
      authoritativeFactPackage,
    };
  }

  function compactContentSnapshot(snapshot, keepPayload = true) {
    if (!snapshot) return null;
    return {
      snapshotId: snapshot.snapshotId || null,
      revisionNumber: snapshot.revisionNumber || null,
      factPackageId: snapshot.factPackageId || null,
      dataVersion: snapshot.dataVersion || null,
      contentFacts: keepPayload ? (snapshot.contentFacts || []).map(compactGeneratedContentFact) : [],
      bindingGaps: clone(snapshot.bindingGaps || []),
      narratives: keepPayload ? clone(snapshot.narratives || []) : [],
      archivedContentFactCount: keepPayload ? null : (snapshot.contentFacts || []).length,
      archivedNarrativeCount: keepPayload ? null : (snapshot.narratives || []).length,
      createdAt: snapshot.createdAt || null,
    };
  }

  function factPackageForStoredSnapshot(snapshot, report) {
    const matchingPack = (report?.evidencePacks || []).find((pack) => {
      const factPackage = pack.authoritativeFactPackage;
      return factPackage && factPackage.dataVersion === snapshot?.dataVersion
        && (!snapshot?.factPackageId || factPackage.packageId === snapshot.factPackageId);
    });
    return matchingPack?.authoritativeFactPackage || resolveExactFactPackage({
      packageId: snapshot?.factPackageId || null,
      dataVersion: snapshot?.dataVersion || null,
      semanticVersionId: report?.bindingSnapshot?.semanticVersionId || null,
      dataAssetVersionId: report?.bindingSnapshot?.dataAssetVersionId || null,
      consumableVersionId: report?.bindingSnapshot?.consumableVersionId || null,
    });
  }

  function hydrateContentSnapshot(snapshot, report) {
    if (!snapshot) return null;
    const factPackage = factPackageForStoredSnapshot(snapshot, report);
    if (!factPackageIsAvailable(factPackage)) {
      return {
        ...snapshot,
        authoritativeFacts: [],
        groupMetrics: null,
        units: {},
        trend: [],
        structures: null,
        institutions: [],
        facts: [],
      };
    }
    return {
      ...snapshot,
      authoritativeFacts: clone(factPackage.contentFacts || []),
      groupMetrics: clone(factPackage.groupMetrics || null),
      units: clone(factPackage.units || {}),
      trend: clone(factPackage.trend || []),
      structures: clone(factPackage.structures || null),
      institutions: clone(factPackage.institutions || []),
      facts: clone(factPackage.contentFacts || []),
    };
  }

  function rebuildStoredVerificationPlan(content) {
    const factInventory = content.factInventory || [];
    const bindings = content.t044Bindings || [];
    const checkById = new Map(DATA.reportEvidence.verificationChecks.map((item) => [item.id, item]));
    const factPlan = factInventory.flatMap((fact) => (fact.applicableChecks || [])
      .filter((checkType) => checkType !== "unboundContentDetection")
      .map((checkType) => ({
        id: `T049-PLAN-${content.draftId}-${fact.id}-${checkType}`,
        factId: fact.id,
        contentItemId: null,
        checkType,
        checkName: checkById.get(checkType)?.name || checkType,
        owner: "报告中心",
        applicability: "applicable",
        executionState: "planned",
        t044Ids: bindings.filter((binding) => binding.factRefs?.includes(fact.id) || binding.intendedFactRefs?.includes(fact.id)).map((binding) => binding.id),
      })));
    const contentPlan = (content.renderManifest?.items || []).map((item) => ({
      id: `T049-PLAN-${content.draftId}-${item.contentItemId || item.anchorId}-unboundContentDetection`,
      factId: item.factRefs?.[0] || item.intendedFactRefs?.[0] || null,
      contentItemId: item.contentItemId,
      checkType: "unboundContentDetection",
      checkName: checkById.get("unboundContentDetection")?.name || "无绑定内容识别",
      owner: "报告中心",
      applicability: "applicable",
      executionState: "planned",
      t044Ids: bindings.filter((binding) => binding.contentItemId === item.contentItemId).map((binding) => binding.id),
    }));
    return [...factPlan, ...contentPlan];
  }

  function compactContentVersion(content, keepPayload = true) {
    const { snapshot, factInventory, verificationPlan, ...rest } = content;
    return {
      ...rest,
      t044Bindings: keepPayload ? clone(content.t044Bindings || []) : [],
      renderManifest: keepPayload ? clone(content.renderManifest || null) : { manifestId: content.renderManifest?.manifestId || null, version: content.renderManifest?.version || null, items: [] },
      snapshot: compactContentSnapshot(snapshot, keepPayload),
      factInventoryRef: {
        factPackageId: snapshot?.factPackageId || null,
        dataVersion: snapshot?.dataVersion || null,
        count: factInventory?.length || 0,
      },
      verificationPlanRef: {
        version: DATA.reportEvidence.verificationRuleVersion,
        count: verificationPlan?.length || 0,
      },
      archivedPayload: keepPayload ? null : {
        factCount: factInventory?.length || snapshot?.contentFacts?.length || 0,
        bindingCount: content.t044Bindings?.length || 0,
        manifestItemCount: content.renderManifest?.items?.length || 0,
        reason: "后续内容修订已形成；历史草稿保留稳定标识、状态、时间、核验引用和计数摘要。",
      },
    };
  }

  function hydrateContentVersion(content, report) {
    const hydrated = {
      ...content,
      snapshot: hydrateContentSnapshot(content.snapshot, report),
    };
    const factPackage = factPackageForStoredSnapshot(content.snapshot, report);
    hydrated.factInventory = content.factInventory?.length
      ? clone(content.factInventory)
      : clone(factPackageIsAvailable(factPackage) ? factPackage.contentFacts : []);
    hydrated.verificationPlan = content.verificationPlan?.length
      ? clone(content.verificationPlan)
      : rebuildStoredVerificationPlan(hydrated);
    return hydrated;
  }

  function compactVerification(verification) {
    if (!verification) return verification;
    const { planSnapshot, unitResults, ...rest } = verification;
    return {
      ...rest,
      results: (verification.results || []).map((item) => ({
        id: item.id || null,
        name: item.name || null,
        status: item.status || null,
        reasonCode: item.reasonCode || null,
        factId: item.factId || null,
        contentItemId: item.contentItemId || null,
        anchor: item.anchor || null,
      })),
      planSnapshotRef: {
        version: verification.planVersion || null,
        count: planSnapshot?.length || 0,
      },
      unitResultsRef: {
        count: unitResults?.length || 0,
      },
    };
  }

  function hydrateVerification(verification, report = null) {
    if (!verification) return verification;
    const hydrated = { ...verification, planSnapshot: [], unitResults: [] };
    if (["queued", "running"].includes(hydrated.status)) {
      hydrated.status = "run_failed";
      hydrated.coverage = {
        ...freshVerification().coverage,
        ...(hydrated.coverage || {}),
        status: "incomplete",
        error: Math.max(1, Number(hydrated.coverage?.error || 0)),
      };
      hydrated.interruptionReason = "页面恢复时原核验运行已中断；请使用同一范围重新发起核验。";
    }
    if (report && hydrated.status === "completed" && hydrated.results?.length) {
      const fixedPlan = verificationPlanForScope(report, hydrated.scopeContext);
      const rebuiltUnits = verificationUnitResults(report, hydrated.scopeContext, fixedPlan, hydrated.currentStatusSummary);
      const rebuiltResults = verificationResults(hydrated.scopeContext, rebuiltUnits, report);
      const storedById = new Map(hydrated.results.map((item) => [item.id, item]));
      const rebuiltIds = new Set(rebuiltResults.map((item) => item.id));
      hydrated.results = rebuiltResults.map((item) => ({ ...item, ...(storedById.get(item.id) || {}) }))
        .concat(hydrated.results.filter((item) => !rebuiltIds.has(item.id)));
    }
    return hydrated;
  }

  function compactVerificationArchive(run) {
    const counts = run.results?.length
      ? run.results.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {})
      : clone(run.statusCounts || {});
    return {
      runId: run.runId || null,
      retryOf: run.retryOf || null,
      status: run.status || null,
      attempt: run.attempt || null,
      scope: run.scope || null,
      runScope: run.runScope || null,
      scopeContext: clone(run.scopeContext || null),
      evidencePackId: run.evidencePackId || null,
      reportEvidenceVersion: run.reportEvidenceVersion || null,
      planVersion: run.planVersion || null,
      completedAt: run.completedAt || null,
      currentStatusSummary: clone(run.currentStatusSummary || null),
      currentBindingSnapshot: clone(run.currentBindingSnapshot || null),
      currentStatusReadAt: run.currentStatusReadAt || null,
      coverage: clone(run.coverage || null),
      statusCounts: counts,
      resultCount: run.results?.length || run.resultCount || 0,
      explanationRequestId: run.explanationRequestId || null,
      explanationRunId: run.explanationRunId || null,
      explanationResultId: run.explanationResultId || null,
      explanationSubmittedAt: run.explanationSubmittedAt || null,
      explanationReadAt: run.explanationReadAt || null,
      scenarioContext: clone(run.scenarioContext || null),
    };
  }

  function compactComparison(comparison) {
    if (!comparison) return comparison;
    const { reportFactPackage, currentFactPackage, ...rest } = comparison;
    return {
      ...rest,
      reportFactPackageRef: factPackageReference(reportFactPackage || comparison.reportFactPackageRef),
      currentFactPackageRef: factPackageReference(currentFactPackage || comparison.currentFactPackageRef),
    };
  }

  function hydrateComparison(comparison) {
    if (!comparison) return comparison;
    return {
      ...comparison,
      reportFactPackage: resolveExactFactPackage(comparison.reportFactPackageRef || factPackageReference(comparison.reportFactPackage)),
      currentFactPackage: resolveExactFactPackage(comparison.currentFactPackageRef || factPackageReference(comparison.currentFactPackage)),
    };
  }

  function compactReportForStorage(report) {
    if (!report) return report;
    const compact = { ...report };
    compact.evidencePacks = (report.evidencePacks || []).map(compactEvidencePack);
    compact.contentVersions = (report.contentVersions || []).map((content) => compactContentVersion(content, content.reviewCopyId === report.reviewCopyId));
    compact.contentSnapshotRef = report.contentSnapshot ? {
      snapshotId: report.contentSnapshot.snapshotId || null,
      reviewCopyId: report.reviewCopyId || null,
    } : null;
    delete compact.contentSnapshot;
    compact.verification = compactVerification(report.verification);
    compact.postPublicationVerification = compactVerification(report.postPublicationVerification);
    compact.verificationRuns = (report.verificationRuns || []).map(compactVerificationArchive);
    compact.comparison = compactComparison(report.comparison);
    compact.comparisonRecords = (report.comparisonRecords || []).map(compactComparison);
    return compact;
  }

  function hydrateReportFromStorage(storedReport) {
    if (!storedReport) return storedReport;
    const report = { ...storedReport };
    report.evidencePacks = (storedReport.evidencePacks || []).map(hydrateEvidencePack);
    report.contentVersions = (storedReport.contentVersions || []).map((content) => hydrateContentVersion(content, report));
    const activeContent = report.contentVersions.find((item) => item.reviewCopyId === report.reviewCopyId)
      || report.contentVersions.find((item) => item.snapshot?.snapshotId === storedReport.contentSnapshotRef?.snapshotId);
    report.contentSnapshot = storedReport.contentSnapshot
      ? hydrateContentSnapshot(storedReport.contentSnapshot, report)
      : clone(activeContent?.snapshot || null);
    report.verification = hydrateVerification(storedReport.verification, report);
    report.postPublicationVerification = hydrateVerification(storedReport.postPublicationVerification, report);
    report.comparison = hydrateComparison(storedReport.comparison);
    report.comparisonRecords = (storedReport.comparisonRecords || []).map(hydrateComparison);
    return report;
  }

  function compactStateForStorage(sourceState) {
    const viewedPublishedReport = sourceState.ui?.viewingReportNo
      ? (sourceState.publishedReports || []).find((report) => report.reportNo === sourceState.ui.viewingReportNo) || null
      : null;
    const primaryReport = viewedPublishedReport?.reportNo && viewedPublishedReport.reportNo === sourceState.report?.reportNo
      ? viewedPublishedReport
      : sourceState.report;
    const activeReportNo = primaryReport?.reportNo || null;
    return {
      ...sourceState,
      stateVersion: 4,
      savedAtMs: Date.now(),
      exportTasks: (sourceState.exportTasks || []).map(({ file, ...task }) => ({
        ...task,
        fileReference: file ? {
          name: file.name || null,
          mime: file.mime || null,
          encoding: file.encoding || null,
          source: "正式报告冻结 HTML",
        } : task.fileReference || null,
      })),
      report: compactReportForStorage(primaryReport),
      publishedReports: (sourceState.publishedReports || [])
        .filter((report) => !activeReportNo || report.reportNo !== activeReportNo)
        .map(compactReportForStorage),
    };
  }

  function s003ModuleStateStorage(storage) {
    if (!s003ScenarioSelected() || s003RequestedContext().status !== "active" || !window.OFWScenarioFoundation?.createNamespacedStorage) return null;
    try {
      return window.OFWScenarioFoundation.createNamespacedStorage({
        storage,
        context: s003RequestedContext(),
        scope: "m06"
      });
    } catch (_) {
      return null;
    }
  }

  function s003PhysicalStateKey(logicalKey, context = s003RequestedContext()) {
    if (!context?.scenarioId || !context?.scenarioVersion || !context?.scenarioRunId) return null;
    return `ofw:v1.1.0:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}:m06:${encodeURIComponent(logicalKey)}`;
  }

  function readS003StateEnvelope(storage, logicalKey) {
    const context = s003RequestedContext();
    const key = s003PhysicalStateKey(logicalKey, context);
    const raw = key ? storage.getItem(key) : null;
    if (raw === null) return { found: false, value: null, key, raw: null };
    let envelope;
    try { envelope = JSON.parse(raw); } catch (_) { throw new Error(`${logicalKey} 不是有效 JSON`); }
    if (envelope?.schemaVersion !== window.OFWScenarioFoundation?.STORAGE_SCHEMA_VERSION
      || !sameScenarioContext(normalizeScenarioContext(envelope.scenarioContext || {}), context)) {
      throw new Error(`${logicalKey} envelope 与当前 scenarioRunId 不一致`);
    }
    if (!envelope.payload || typeof envelope.payload !== "object") throw new Error(`${logicalKey} 缺少状态载荷`);
    return { found: true, value: envelope.payload, key, raw };
  }

  function readS003ModuleState(storage, { allowLegacy = true } = {}) {
    try {
      const current = readS003StateEnvelope(storage, S003_STATE_KEY);
      if (current.found) return current.value;
    } catch (error) {
      s003ProjectionIssue = {
        blocking: true,
        status: "isolated-incompatible",
        reason: `M06 当前工作投影已原位隔离：${error.message}`,
        recovery: "正式 Published 报告仍可读取；请从统一场景快照克隆恢复，不得覆盖该记录。"
      };
      return null;
    }
    if (!allowLegacy) return null;
    try {
      const legacy = readS003StateEnvelope(storage, S003_LEGACY_STATE_KEY);
      if (!legacy.found) return null;
      if (![1, 2, 3, 4].includes(legacy.value.stateVersion)) throw new Error("旧版状态 schemaVersion 不兼容");
      s003ProjectionIssue = {
        blocking: false,
        status: "legacy-migrated-copy",
        reason: "检测到旧版 M06 当前工作投影；已作为兼容输入读取，原记录保持不变。",
        recovery: `下一次明确保存将写入 ${S003_STATE_KEY}，不会覆盖 ${S003_LEGACY_STATE_KEY}。`
      };
      return legacy.value;
    } catch (error) {
      s003ProjectionIssue = {
        blocking: false,
        status: "legacy-isolated",
        reason: `旧版 M06 工作投影不可迁移，已原位隔离：${error.message}`,
        recovery: "当前页面从正式 Published 报告资源重建只读视图；原记录未删除。"
      };
      return null;
    }
  }

  function loadState() {
    try {
      let candidates;
      if (s003ScenarioSelected()) {
        const currentCandidates = [
          readS003ModuleState(localStorage, { allowLegacy: false }),
          readS003ModuleState(sessionStorage, { allowLegacy: false })
        ].filter(Boolean);
        candidates = currentCandidates.length ? currentCandidates : [
          readS003ModuleState(localStorage),
          readS003ModuleState(sessionStorage)
        ].filter(Boolean);
      } else candidates = [localStorage.getItem(STORAGE_KEY), sessionStorage.getItem(SESSION_STORAGE_KEY)]
          .filter(Boolean)
          .map((raw) => JSON.parse(raw));
      if (!candidates.length) return newState();
      const parsed = normalizeStoredPlaceholders(candidates.sort((left, right) => Number(right.savedAtMs || 0) - Number(left.savedAtMs || 0))[0]);
      if (![1, 2, 3, 4].includes(parsed.stateVersion)) return newState();
      const defaults = newState();
      parsed.stateVersion = 4;
      parsed.publishedReports = Array.isArray(parsed.publishedReports) ? parsed.publishedReports : [];
      parsed.withdrawnReports = Array.isArray(parsed.withdrawnReports) ? parsed.withdrawnReports : [];
      parsed.exportTasks = Array.isArray(parsed.exportTasks) ? parsed.exportTasks.map((task) => {
        if (task.format !== "pdf") return task;
        const { file, ...reference } = task;
        return { ...reference, presentationRoute: task.status === "成功" ? "/reports/pdf" : task.presentationRoute || null };
      }) : [];
      parsed.actionRequests = Array.isArray(parsed.actionRequests) ? parsed.actionRequests.map((request) => {
        return {
          id: request.id,
          scenarioContext: clone(request.scenarioContext || request.payload?.scenarioContext || null),
          sourceScene: request.sourceScene || request.payload?.sourceScene || null,
          singleBusinessSubject: request.singleBusinessSubject || request.unit || request.payload?.singleBusinessSubject || request.payload?.unit || null,
          singleBusinessSubjectId: request.singleBusinessSubjectId || request.payload?.singleBusinessSubjectId || null,
          singleBusinessSubjectName: request.singleBusinessSubjectName || request.payload?.singleBusinessSubjectName || request.singleBusinessSubject || request.unit || null,
          singleBusinessSubjectObjectType: request.singleBusinessSubjectObjectType || request.payload?.singleBusinessSubjectObjectType || null,
          returnRoute: request.returnRoute || request.payload?.returnRoute || "/dashboard/s001?tab=evidence",
          filter: request.filter || request.payload?.filter || "Rule 与行动",
          returnPosition: request.returnPosition || request.payload?.returnPosition || "action-collaboration",
          createdAt: request.createdAt || null,
        };
      }) : [];
      parsed.replacementRelations = Array.isArray(parsed.replacementRelations) ? parsed.replacementRelations : [];
      parsed.catalog = { ...defaults.catalog, ...(parsed.catalog || {}) };
      parsed.wizard = { ...defaults.wizard, ...(parsed.wizard || {}) };
      parsed.publishAttempt = 0;
      parsed.regenerationRequest = parsed.regenerationRequest || null;
      parsed.ui = { ...defaults.ui, ...(parsed.ui || {}) };
      parsed.ui.readerMoreOpen = false;
      if (parsed.ui.pendingActionRef?.status === "提交中") {
        parsed.ui.pendingActionRef.status = "结果未知";
        parsed.ui.pendingActionRef.interruptionReason = "页面恢复时未取得明确接收结果；必须先按原提交标识核对。";
      }
      parsed.assistant = { ...defaults.assistant, ...(parsed.assistant || {}), requestRef: parsed.assistant?.requestRef || null };
      parsed.insight = {
        ...defaults.insight,
        requestId: parsed.insight?.requestId || null,
        resultId: parsed.insight?.resultId || null,
        runId: parsed.insight?.runId || null,
        sessionId: parsed.insight?.sessionId || null,
        bindingId: parsed.insight?.bindingId || null,
        confirmationRequestId: parsed.insight?.confirmationRequestId || null,
        submittedAt: parsed.insight?.submittedAt || null,
        bindingSnapshot: parsed.insight?.bindingSnapshot || null,
        referenced: Boolean(parsed.insight?.referenced),
      };
      delete parsed.decisionSummaries;
      delete parsed.externalTrustProjection;
      delete parsed.trustReadAttempt;
      delete parsed.assistant.externalRecord;
      delete parsed.assistant.sessionId;
      delete parsed.assistant.bindingId;
      delete parsed.assistant.runId;
      delete parsed.assistant.resultId;
      if (parsed.assistant.requestRef) delete parsed.assistant.requestRef.question;
      parsed.report = normalizeReport(hydrateReportFromStorage(parsed.report));
      parsed.publishedReports = parsed.publishedReports.map((report) => normalizeReport(hydrateReportFromStorage(report)));
      if (["published", "withdrawn"].includes(parsed.report?.stage) && parsed.report.reportNo) {
        parsed.publishedReports = parsed.publishedReports.filter((item) => item.reportNo !== parsed.report.reportNo);
        parsed.publishedReports.unshift(JSON.parse(JSON.stringify(parsed.report)));
      }
      return parsed;
    } catch (error) {
      return newState();
    }
  }

  let state = loadState();

  function normalizeReport(report) {
    const normalized = { ...newReportRecord(), ...(report || {}) };
    if (!scenarioContextReady(normalized.scenarioContext)) normalized.legacyScenarioStatus = "场景运行上下文不可证明";
    const legacyRuns = Array.isArray(normalized.generationRuns) ? normalized.generationRuns : [];
    normalized.agentGenerationRefs = Array.isArray(normalized.agentGenerationRefs)
      ? normalized.agentGenerationRefs
      : legacyRuns.map((run) => ({
        requestId: run.requestId || normalized.requestId,
        runId: run.runId,
        resultId: run.sourceDraftId || null,
        sourceDraftId: run.sourceDraftId || null,
        retryOfRunId: run.retryOf || null,
        evidencePackId: run.evidencePackId || normalized.evidencePackId,
        submittedAt: run.startedAt || null,
      }));
    normalized.agentGenerationRefs = normalized.agentGenerationRefs.map((reference) => ({
      ...reference,
      requestId: reference.requestId || normalized.requestId,
      runId: reference.runId || null,
      resultId: reference.resultId || null,
      sourceDraftId: reference.sourceDraftId || null,
      retryOfRunId: reference.retryOfRunId || reference.retryOf || null,
      evidencePackId: reference.evidencePackId || normalized.evidencePackId,
      submittedAt: reference.submittedAt || null,
      scenarioContext: clone(reference.scenarioContext || normalized.scenarioContext || null),
    }));
    delete normalized.generationRuns;
    delete normalized.agentSourceDrafts;
    normalized.contentVersions = Array.isArray(normalized.contentVersions) ? normalized.contentVersions : [];
    normalized.contentVersions = normalized.contentVersions.map((content) => ({
      ...content,
      t044Bindings: Array.isArray(content.t044Bindings) ? content.t044Bindings : [],
      factInventory: Array.isArray(content.factInventory) ? content.factInventory : [],
      renderManifest: content.renderManifest && Array.isArray(content.renderManifest.items)
        ? content.renderManifest
        : { manifestId: null, version: null, items: [] },
      verificationPlan: Array.isArray(content.verificationPlan) ? content.verificationPlan : [],
      verificationRunIds: Array.isArray(content.verificationRunIds) ? content.verificationRunIds : [],
    }));
    const activeContent = normalized.contentVersions.find((item) => item.reviewCopyId === normalized.reviewCopyId);
    normalized.contentSnapshot = normalized.contentSnapshot || clone(activeContent?.snapshot || null);
    normalized.verificationRuns = Array.isArray(normalized.verificationRuns) ? normalized.verificationRuns : [];
    normalized.evidencePacks = Array.isArray(normalized.evidencePacks) ? normalized.evidencePacks : [];
    normalized.reviewHistory = Array.isArray(normalized.reviewHistory) ? normalized.reviewHistory : [];
    normalized.publicationRuns = Array.isArray(normalized.publicationRuns) ? normalized.publicationRuns : [];
    normalized.issues = Array.isArray(normalized.issues) ? normalized.issues : [];
    normalized.verification = { ...freshVerification(), ...(normalized.verification || {}) };
    normalized.verification.results = Array.isArray(normalized.verification.results) ? normalized.verification.results : [];
    normalized.verification.planSnapshot = Array.isArray(normalized.verification.planSnapshot) ? normalized.verification.planSnapshot : [];
    normalized.verification.unitResults = Array.isArray(normalized.verification.unitResults) ? normalized.verification.unitResults : [];
    normalized.verification.coverage = { ...freshVerification().coverage, ...(normalized.verification.coverage || {}) };
    delete normalized.verification.explanationStatus;
    delete normalized.verification.explanationText;
    if (normalized.verification.status === "completed" && normalized.verification.scopeContext?.scope !== "整份报告") {
      const currentContent = normalized.contentVersions.find((item) => item.reviewCopyId === normalized.reviewCopyId);
      const contentAnchors = currentContent?.t044Bindings || [];
      const allowedAnchors = normalized.verification.scopeContext.scope === "当前章节"
        ? contentAnchors.filter((anchor) => anchor.templateSlot === normalized.verification.scopeContext.sectionId)
        : contentAnchors.filter((anchor) => anchor.anchorId === normalized.verification.scopeContext.anchorId);
      const allowedIds = new Set(allowedAnchors.map((anchor) => anchor.anchorId));
      normalized.verification.results = normalized.verification.results.filter((result) => allowedIds.has(result.anchor));
      normalized.verification.anchorCount = normalized.verification.results.length;
      normalized.verification.factCount = new Set(allowedAnchors.flatMap((anchor) => anchor.factRefs || [])).size;
    }
    normalized.comparison = { ...freshComparison(), ...(normalized.comparison || {}) };
    normalized.comparisonRecords = Array.isArray(normalized.comparisonRecords)
      ? normalized.comparisonRecords.map((item) => ({ ...freshComparison(), ...item }))
      : [];
    normalized.trustWarnings = Array.isArray(normalized.trustWarnings)
      ? normalized.trustWarnings.map((warning) => ({
        ...warning,
        failureFactAt: warning.failureFactAt ?? warning.hardQualityFailureFoundAt ?? null,
        summaryFormedAt: warning.summaryFormedAt ?? null,
        readAt: warning.readAt ?? warning.detectedAt ?? null,
        confirmationAt: warning.confirmationAt ?? null,
      }))
      : [];
    normalized.humanReview = { ...freshHumanReview(), ...(normalized.humanReview || {}) };
    normalized.publicationVerificationRef = normalized.publicationVerificationRef || null;
    normalized.postPublicationVerification = normalized.postPublicationVerification
      ? { ...freshVerification(), ...normalized.postPublicationVerification }
      : null;
    if (normalized.postPublicationVerification) {
      normalized.postPublicationVerification.results = Array.isArray(normalized.postPublicationVerification.results) ? normalized.postPublicationVerification.results : [];
      normalized.postPublicationVerification.planSnapshot = Array.isArray(normalized.postPublicationVerification.planSnapshot) ? normalized.postPublicationVerification.planSnapshot : [];
      normalized.postPublicationVerification.unitResults = Array.isArray(normalized.postPublicationVerification.unitResults) ? normalized.postPublicationVerification.unitResults : [];
      normalized.postPublicationVerification.coverage = { ...freshVerification().coverage, ...(normalized.postPublicationVerification.coverage || {}) };
    }
    return normalized;
  }

  function saveState() {
    const compacted = compactStateForStorage(state);
    const serialized = JSON.stringify(compacted);
    if (s003ScenarioSelected()) {
      if (s003RequestedContext().status !== "active") {
        runtimePersistenceError = "当前 S003 历史、恢复或回归上下文只读；M06 未写入任何工作投影。";
        return false;
      }
      if (s003ProjectionIssue?.blocking) {
        runtimePersistenceError = "M06 当前工作投影已隔离；请通过统一场景快照克隆恢复，禁止覆盖不兼容记录。";
        return false;
      }
      const sharedStorage = s003ModuleStateStorage(localStorage);
      const sessionStore = s003ModuleStateStorage(sessionStorage);
      if (!sharedStorage && !sessionStore) {
        runtimePersistenceError = "当前 S003 场景运行身份不是可写上下文；报告中心未写入旧版共享状态键。";
        return false;
      }
      try {
        if (!sharedStorage) throw new Error("浏览器共享命名空间不可用");
        sharedStorage.set(S003_STATE_KEY, compacted);
        sessionStore?.remove(S003_STATE_KEY);
        runtimePersistenceError = null;
        return true;
      } catch (sharedStorageError) {
        try {
          if (!sessionStore) throw sharedStorageError;
          sessionStore.set(S003_STATE_KEY, compacted);
          runtimePersistenceError = null;
          return true;
        } catch (sessionStorageError) {
          runtimePersistenceError = "当前 S003 操作仍保留在本页面，但未能写入该 scenarioRunId 的 M06 隔离命名空间。";
          if (typeof console !== "undefined" && typeof console.error === "function") {
            console.error("[ontology3] S003 报告中心命名空间保存失败", { sharedStorageError, sessionStorageError });
          }
          return false;
        }
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      runtimePersistenceError = null;
      return true;
    } catch (sharedStorageError) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
        runtimePersistenceError = null;
        return true;
      } catch (sessionStorageError) {
        runtimePersistenceError = "当前操作仍保留在本页面，但浏览器未能保存恢复点。请关闭占用同一工作区的其他页面后重试，或重置本工作区。";
        if (typeof console !== "undefined" && typeof console.error === "function") {
          console.error("[ontology3] 报告中心恢复点保存失败", { sharedStorageError, sessionStorageError });
        }
        return false;
      }
    }
  }

  function commit(renderNow = true) {
    saveState();
    if (renderNow) renderApp();
  }

  function readingReport() {
    if (state.ui.viewingReportNo) {
      return state.publishedReports.find((item) => item.reportNo === state.ui.viewingReportNo && resourceInCurrentScenario(item)) || state.report;
    }
    return state.report;
  }

  function bindingFor(report = readingReport()) {
    const authoritative = currentAuthority();
    const trust = currentTrust();
    return report?.bindingSnapshot || (authoritative?.bindingId ? {
      bindingId: authoritative.bindingId,
      semanticVersionId: authoritative.semanticVersionId,
      semanticVersion: authoritative.semanticVersion,
      dataAssetId: authoritative.dataAssetId,
      dataAssetVersionId: authoritative.dataAssetVersionId,
      dataVersion: authoritative.dataVersion,
      consumableVersionId: authoritative.consumableVersionId,
      asOf: authoritative.asOf,
      quality: trust.publishedQuality,
      freshness: trust.freshness,
      consumption: authoritative.readiness,
      semanticResolution: "resolved",
      fixedAt: null,
    } : {});
  }

  function currentAuthority() {
    return runtimeExternalViews.trust?.binding || OWNERS.trust?.peekCurrent?.().binding || {};
  }

  function currentTrust() {
    return runtimeExternalViews.trust?.trust || OWNERS.trust?.peekCurrent?.().trust || {};
  }

  function currentBindingSummary() {
    return runtimeExternalViews.trust?.bindingSummary || OWNERS.trust?.peekCurrent?.().bindingSummary || {};
  }

  function readCurrentTrustProjection(purpose, { advance = false } = {}) {
    const projection = advance
      ? OWNERS.trust?.advanceCurrent?.()
      : OWNERS.trust?.readCurrent?.({ purpose });
    return clone(projection || {
      schemaVersion: null,
      projectionId: null,
      projectionVersion: null,
      formedAt: null,
      readStatus: "missing",
      scenarioContext: null,
      binding: null,
      trust: null,
      bindingSummary: null,
      reason: "统一 C008 权威投影不可定位。",
      recoveryAdvice: "由本体管理形成统一投影后重新读取。",
      exchangeKey: C008_PROJECTION_STORAGE_KEY,
      readAt: nowText(),
      purpose,
    });
  }

  function reportBindingSummary(report = readingReport()) {
    const snapshot = evidencePackFor(report)?.dataTrustAtGeneration || null;
    return snapshot;
  }

  function fiveDimensionsFor(summary) {
    return Array.isArray(summary?.fiveDimensions) && summary.fiveDimensions.length
      ? summary.fiveDimensions
      : [];
  }

  function renderFiveDimensions(summary) {
    return `<div class="dimension-list">${fiveDimensionsFor(summary).map((item) => `<div class="dimension-row"><span>${esc(item.name)}</span>${badge(item.status, ["版本不存在/引用无效", "身份冲突", "不可访问", "不完整", "依赖不足", "不一致", "执行失败"].includes(item.status) ? "danger" : ["未知", "未执行", "运行中", "具备重放条件"].includes(item.status) ? "warning" : "success")}<small>${esc(item.reason)}</small></div>`).join("")}</div>`;
  }

  function comparisonFingerprint(binding, trust) {
    return [binding?.bindingId, binding?.semanticVersionId, binding?.dataAssetVersionId, binding?.consumableVersionId, trust?.id, trust?.version, trust?.formedAt].map((value) => value || "").join("|");
  }

  function allReportRecords() {
    return [state.report, ...(state.publishedReports || [])].filter((report) => report && resourceInCurrentScenario(report));
  }

  function markComparisonRecordsStale(binding, trust, detectedAt) {
    const currentFingerprint = comparisonFingerprint(binding, trust);
    allReportRecords().forEach((report) => {
      const mark = (record) => {
        if (!record?.recordId || record.recordStatus === "已陈旧") return;
        if (comparisonFingerprint(record.currentBinding, record.currentTrust) === currentFingerprint) return;
        record.recordStatus = "已陈旧";
        record.staleReason = "当前权威组合或 C017 当前状态摘要已变化；原比较结果保持不变。";
        record.staleDetectedAt = detectedAt;
      };
      (report.comparisonRecords || []).forEach(mark);
      if (report.comparison?.status === "completed") mark(report.comparison);
    });
  }

  function recordTrustWarning(binding, trust, readAt) {
    if (!trust?.hardQualityFailure) return;
    const reports = allReportRecords();
    reports.forEach((report) => {
      const reportBinding = bindingFor(report);
      if (!reportBinding?.dataVersion || reportBinding.dataVersion !== trust.dataVersion) return;
      report.trustWarnings = Array.isArray(report.trustWarnings) ? report.trustWarnings : [];
      const existing = report.trustWarnings.find((item) => item.summaryId === trust.id && item.summaryVersion === trust.version);
      if (existing) {
        existing.failureFactAt = existing.failureFactAt || trust.hardQualityFailureFoundAt || null;
        existing.summaryFormedAt = existing.summaryFormedAt || trust.formedAt || null;
        existing.readAt = existing.readAt || existing.detectedAt || readAt || null;
        existing.confirmationAt = existing.confirmationAt || trust.hardQualityFailureConfirmedAt || null;
        return;
      }
      report.trustWarnings.unshift({
        summaryId: trust.id,
        summaryVersion: trust.version,
        failureFactAt: trust.hardQualityFailureFoundAt || null,
        summaryFormedAt: trust.formedAt,
        readAt,
        confirmationAt: trust.hardQualityFailureConfirmedAt || null,
        dataVersion: trust.dataVersion,
        finding: trust.laterQualityFinding,
        impactScope: trust.impactScope,
        recoveryAdvice: trust.recoveryAdvice,
      });
    });
  }

  function hardFailureForReport(report = readingReport(), projection = null) {
    const reportDataVersion = bindingFor(report)?.dataVersion;
    const trust = projection?.trust || currentTrust();
    if (trust?.hardQualityFailure && trust.dataVersion === reportDataVersion) {
      const previouslyRead = (report?.trustWarnings || []).find((item) => item.summaryId === trust.id && item.summaryVersion === trust.version);
      return {
        summaryId: trust.id,
        summaryVersion: trust.version,
        failureFactAt: trust.hardQualityFailureFoundAt || null,
        summaryFormedAt: trust.formedAt,
        readAt: projection?.readAt || previouslyRead?.readAt || previouslyRead?.detectedAt || null,
        confirmationAt: trust.hardQualityFailureConfirmedAt || previouslyRead?.confirmationAt || null,
        dataVersion: trust.dataVersion,
        finding: trust.laterQualityFinding,
        impactScope: trust.impactScope,
        recoveryAdvice: trust.recoveryAdvice,
      };
    }
    return (report?.trustWarnings || []).find((item) => item.dataVersion === reportDataVersion) || null;
  }

  function readReportTrustGate(report, purpose) {
    const projection = readCurrentTrustProjection(purpose);
    const readAt = projection.readAt || nowText();
    runtimeExternalViews.trust = projection;
    recordTrustWarning(projection.binding, projection.trust, readAt);
    const failure = hardFailureForReport(report, projection);
    const expectedBinding = bindingFor(report);
    const outcome = generationGateOutcome(projection, expectedBinding);
    return {
      projection,
      failure,
      readAt,
      allowed: outcome.allowed && !failure,
      reason: failure?.finding || outcome.reason || null,
    };
  }

  function bindingIdentityMatches(left, right) {
    if (!left || !right) return false;
    return ["bindingId", "semanticVersionId", "dataAssetVersionId", "dataVersion", "consumableVersionId"]
      .every((field) => left[field] === right[field]);
  }

  function generationGateOutcome(projection, expectedBinding = null) {
    const binding = projection?.binding;
    const trust = projection?.trust;
    const bindingSummary = projection?.bindingSummary;
    const factPackage = factPackageForBinding(binding);
    const activeScenario = activeScenarioContext();
    if (!scenarioContextReady(activeScenario)) {
      return { allowed: false, reason: "平台 C033 场景运行上下文不可定位或不完整。", factPackage: null };
    }
    if (!projection || projection.schemaVersion !== 1 || projection.readStatus !== "ready") {
      return { allowed: false, reason: projection?.reason || "统一 C008 权威投影未就绪、为空或读取失败。", factPackage: null };
    }
    if (!sameScenarioContext(projection.scenarioContext, activeScenario)) {
      return { allowed: false, reason: "C008/C017 投影与当前场景版本或运行轮次错配。", factPackage: null };
    }
    if (!binding || !trust || !bindingSummary) {
      return { allowed: false, reason: "未取得 C008 当前权威组合或 C017 双摘要。", factPackage: null };
    }
    if (expectedBinding && !bindingIdentityMatches(binding, expectedBinding)) {
      return { allowed: false, reason: "固定证据期间当前权威组合发生变化；本次请求不能静默改用新组合。", factPackage };
    }
    if (trust.dataVersion !== binding.dataVersion || bindingSummary.dataVersion !== binding.dataVersion) {
      return { allowed: false, reason: "C008 当前权威组合、C017 当前状态摘要与版本绑定摘要身份不一致。", factPackage };
    }
    if (trust.hardQualityFailure) {
      return { allowed: false, reason: trust.recoveryAdvice || "当前权威组合已登记事后硬质量失败。", factPackage };
    }
    if (trust.readiness !== "可消费" || binding.readiness !== "可消费") {
      return { allowed: false, reason: trust.recoveryAdvice || "当前权威组合尚不可消费。", factPackage };
    }
    if (binding.compatibility !== "兼容") {
      return { allowed: false, reason: "当前已发布语义与数据版本不兼容。", factPackage };
    }
    if (!factPackageIsAvailable(factPackage)) {
      return { allowed: false, reason: "当前精确权威组合的结构化事实包不可定位；不会改用其他版本事实。", factPackage };
    }
    return { allowed: true, reason: null, factPackage };
  }

  function readGenerationTrustGate(report, purpose, expectedBinding = null) {
    const projection = readCurrentTrustProjection(purpose);
    const readAt = projection.readAt || nowText();
    runtimeExternalViews.trust = projection;
    markComparisonRecordsStale(projection.binding, projection.trust, readAt);
    recordTrustWarning(projection.binding, projection.trust, readAt);
    return { projection, readAt, ...generationGateOutcome(projection, expectedBinding) };
  }

  function blockGenerationBeforeAgent(report, operation, gate, phase) {
    const currentPackId = report.evidencePackId;
    const hasSubmittedRun = Boolean(currentPackId && report.agentGenerationRefs.some((item) => item.evidencePackId === currentPackId));
    if (currentPackId && !hasSubmittedRun) {
      report.evidencePacks = report.evidencePacks.filter((item) => item.id !== currentPackId);
    }
    const previousContext = operation?.previousContext || null;
    report.evidencePackId = hasSubmittedRun ? currentPackId : previousContext?.evidencePackId || null;
    report.generationRunId = hasSubmittedRun ? report.generationRunId : previousContext?.generationRunId || null;
    report.bindingSnapshot = hasSubmittedRun ? report.bindingSnapshot : clone(previousContext?.bindingSnapshot || report.bindingSnapshot || null);
    report.stage = "evidence_missing";
    report.progress = Math.max(18, report.progress || 0);
    report.activeOperation = null;
    report.generationBlock = {
      type: "authority-trust-gate",
      phase,
      status: "阻断",
      checkedAt: gate.readAt,
      reason: gate.reason,
      bindingId: gate.projection?.binding?.bindingId || null,
      dataVersion: gate.projection?.binding?.dataVersion || null,
      currentSummaryId: gate.projection?.trust?.id || null,
      currentSummaryVersion: gate.projection?.trust?.version || null,
      currentSummaryFormedAt: gate.projection?.trust?.formedAt || null,
      newEvidencePackFormed: false,
      agentRunSubmitted: false,
      isRevision: Boolean(operation?.isRevision),
      isReplacement: Boolean(report.replacedReportNo),
      sourceReportNo: report.replacedReportNo || null,
      requestId: report.requestId || null,
    };
    if (report.generationBlock.isReplacement && state.regenerationRequest?.id === report.requestId) {
      Object.assign(state.regenerationRequest, {
        status: "阻断",
        blockedAt: gate.readAt,
        blockReason: gate.reason,
        currentSummaryId: gate.projection?.trust?.id || null,
        currentSummaryVersion: gate.projection?.trust?.version || null,
        newEvidencePackFormed: false,
        agentRunSubmitted: false,
      });
    }
    commit();
    toast("新内容版本生成已阻断", `${gate.reason} 原报告、生成请求和既有证据均已保留。`, "danger");
  }

  function generationGateReference(gate, phase) {
    return {
      phase,
      bindingId: gate.projection?.binding?.bindingId || null,
      semanticVersionId: gate.projection?.binding?.semanticVersionId || null,
      dataAssetVersionId: gate.projection?.binding?.dataAssetVersionId || null,
      dataVersion: gate.projection?.binding?.dataVersion || null,
      currentSummaryId: gate.projection?.trust?.id || null,
      currentSummaryVersion: gate.projection?.trust?.version || null,
      currentSummaryFormedAt: gate.projection?.trust?.formedAt || null,
      readAt: gate.readAt,
      result: gate.allowed ? "通过" : "阻断",
    };
  }

  function comparisonOutcomeFor(comparison) {
    const reportPackageAvailable = factPackageIsAvailable(comparison.reportFactPackage);
    const currentPackageAvailable = factPackageIsAvailable(comparison.currentFactPackage);
    const identityMatches = currentPackageAvailable
      && comparison.currentFactPackage.semanticVersionId === comparison.currentBinding?.semanticVersionId
      && comparison.currentFactPackage.dataVersion === comparison.currentBinding?.dataVersion
      && comparison.currentFactPackage.dataAssetVersionId === comparison.currentBinding?.dataAssetVersionId
      && comparison.currentFactPackage.consumableVersionId === comparison.currentBinding?.consumableVersionId;
    if (!reportPackageAvailable) return { outcome: "无法比较", reason: "报告生成时的固定事实包不可定位。", canCompare: false };
    if (!currentPackageAvailable || !identityMatches) return { outcome: "无法比较", reason: "当前权威组合的精确结构化事实包不可定位或身份不一致。", canCompare: false };
    if (comparison.permission !== "获准读取报告绑定范围") return { outcome: "无法比较", reason: "当前用户无权读取比较所需的报告绑定范围。", canCompare: false };
    if (comparison.currentTrust?.hardQualityFailure || comparison.currentTrust?.readiness !== "可消费" || comparison.currentBinding?.readiness !== "可消费" || comparison.currentBinding?.compatibility !== "兼容") {
      return { outcome: "无法比较", reason: comparison.currentTrust?.recoveryAdvice || "当前权威上下文不可消费或不兼容。", canCompare: false };
    }
    const replay = fiveDimensionsFor(comparison.currentTrust).find((item) => item.id === "replay-verification");
    const hasWarning = comparison.currentTrust?.comparisonCondition === "带警告"
      || !["当前", "正常"].includes(comparison.currentTrust?.freshness);
    if (hasWarning) return { outcome: "可以比较但有警告", reason: "结构化结果可比，但必须同时披露当前质量、新鲜度或上一可信版本提示。", canCompare: true };
    if (replay && !["通过", "一致", "已验证一致"].includes(replay.status)) return { outcome: "仅可做固定结果比较", reason: "双方固定结构化结果可比，但报告历史数据未形成真实重放一致性结论。", canCompare: true };
    return { outcome: "可以比较", reason: "精确版本、结构化事实、权限、质量和语义兼容门均已通过。", canCompare: true };
  }

  function factPackageForBinding(binding) {
    if (!binding?.dataVersion) return null;
    const factPackage = DATA.reportEvidence.factPackages?.[binding.dataVersion]
      || runtimeFactPackages.get(binding.dataVersion)
      || materializeS001FactPackage(binding);
    if (!factPackage) return null;
    const identityMatches = factPackage.semanticVersionId === binding.semanticVersionId
      && factPackage.dataVersion === binding.dataVersion
      && factPackage.dataAssetVersionId === binding.dataAssetVersionId
      && factPackage.consumableVersionId === binding.consumableVersionId;
    return identityMatches ? factPackage : null;
  }

  function materializeS001FactPackage(binding) {
    const scenario = activeScenarioContext();
    const trust = currentTrust();
    if (!binding?.bindingId || !binding?.semanticVersionId || !binding?.semanticVersion || !binding?.dataAssetVersionId
      || !binding?.dataVersion || !binding?.consumableVersionId || !binding?.asOf || !scenarioContextReady(scenario)
      || scenario.scenarioId !== "S001" || binding.readiness !== "可消费" || binding.compatibility !== "兼容"
      || trust?.dataVersion !== binding.dataVersion || trust?.hardQualityFailure || trust?.readiness !== "可消费") return null;
    const template = DATA.reportEvidence.factPackages?.["2026.08.09-01"];
    if (!template || template.factPackageStatus !== "available") return null;
    const safeVersion = String(binding.dataVersion).replace(/[^A-Za-z0-9_-]/g, "-");
    const metricResultVersion = `METRIC-${safeVersion}-01`;
    const ruleResultVersion = `RULE-${safeVersion}-01`;
    const trendMonthMap = new Map([
      ["2026-03", "2025-07"],
      ["2026-04", "2025-08"],
      ["2026-05", "2025-09"],
      ["2026-06", "2025-10"],
      ["2026-07", "2025-11"],
      ["2026-08", "2025-12"],
    ]);
    const versionBinding = {
      bindingId: binding.bindingId,
      publishedSemanticVersion: binding.semanticVersion,
      semanticVersionId: binding.semanticVersionId,
      dataAssetVersionId: binding.dataAssetVersionId,
      consumableVersionId: binding.consumableVersionId,
      dataVersion: binding.dataVersion,
      resultVersion: `${metricResultVersion} / ${ruleResultVersion}`,
      resultVersions: { metric: metricResultVersion, rule: ruleResultVersion },
      asOf: binding.asOf,
      previousTrustedCombination: clone(binding.previousTrustedCombination || null),
    };
    const retargetEvidence = (items = []) => items.map((item) => String(item).startsWith("C017-") ? (trust.id || item) : item);
    const retargetTrendIdentity = (value) => {
      if (typeof value !== "string") return value;
      let next = value
        .replaceAll("2026-03 至 2026-08", "2025-07 至 2025-12")
        .replaceAll("2025-09 至 2026-08", "2025-07 至 2025-12");
      trendMonthMap.forEach((targetMonth, sourceMonth) => {
        if (next === sourceMonth || next.includes(`FACT-COST-TREND-${sourceMonth}`) || next.includes(`chart-cost-${sourceMonth}`) || next.startsWith(`${sourceMonth} `)) {
          next = next.replaceAll(sourceMonth, targetMonth);
        }
      });
      return next;
    };
    const retargetRecord = (record) => {
      const next = clone(record);
      ["id", "factId", "intendedFactId", "sourceFactId", "anchorId", "primaryAnchorId", "htmlAnchorId", "pdfAnchorId", "label", "value", "displayValue", "renderedValue", "timeRange"].forEach((field) => {
        if (field in next) next[field] = retargetTrendIdentity(next[field]);
      });
      if (Array.isArray(next.factRefs)) next.factRefs = next.factRefs.map(retargetTrendIdentity);
      if (Array.isArray(next.intendedFactRefs)) next.intendedFactRefs = next.intendedFactRefs.map(retargetTrendIdentity);
      if (Array.isArray(next.anchorIds)) next.anchorIds = next.anchorIds.map(retargetTrendIdentity);
      if (next.dimension?.month) next.dimension = { ...next.dimension, month: retargetTrendIdentity(next.dimension.month) };
      if (next.id === "FACT-AS-OF" || next.id === "FACT-DATA-AS-OF-DISCLOSURE") next.value = binding.asOf;
      if (next.id === "FACT-PUBLISHED-SEMANTIC-VERSION") next.value = binding.semanticVersion;
      if (next.id === "FACT-DATA-VERSION") next.value = binding.dataVersion;
      if (next.id === "FACT-DATA-QUALITY-STATUS") next.value = trust.publishedQuality;
      if (next.id === "FACT-DATA-FRESHNESS") next.value = trust.freshness;
      if (next.id === "FACT-DATA-READINESS") next.value = trust.readiness;
      if (/Metric/.test(next.kind || "")) next.resultVersion = metricResultVersion;
      if (/Rule/.test(next.kind || "")) next.resultVersion = ruleResultVersion;
      if (next.id === "FACT-SUGGESTION-BASIS") {
        next.resultVersion = ruleResultVersion;
        next.basis = (next.basis || []).map((item) => ({ ...item, resultVersion: ruleResultVersion }));
      }
      if (Array.isArray(next.evidence)) next.evidence = retargetEvidence(next.evidence).map(retargetTrendIdentity);
      if (Array.isArray(next.evidenceRefs)) next.evidenceRefs = retargetEvidence(next.evidenceRefs).map(retargetTrendIdentity);
      if (["FACT-AS-OF", "FACT-DATA-AS-OF-DISCLOSURE"].includes(next.id)) next.evidence = [binding.dataVersion, trust.id].filter(Boolean);
      if (next.id === "FACT-PUBLISHED-SEMANTIC-VERSION") next.evidence = [binding.semanticVersionId, binding.bindingId].filter(Boolean);
      if (next.id === "FACT-DATA-VERSION") next.evidence = [binding.dataVersion, binding.bindingId, trust.id].filter(Boolean);
      if (next.semanticSnapshot) next.semanticSnapshot = { ...next.semanticSnapshot, semanticVersionId: binding.semanticVersionId, publishedSemanticVersion: binding.semanticVersion, semanticVersion: binding.semanticVersion };
      if (next.trustSnapshot) next.trustSnapshot = { ...next.trustSnapshot, dataVersion: binding.dataVersion, asOf: binding.asOf, qualityStatus: trust.publishedQuality, freshnessStatus: trust.freshness, consumptionReadiness: trust.readiness };
      if (next.ruleSnapshot) next.ruleSnapshot = { ...next.ruleSnapshot, publishedSemanticVersion: binding.semanticVersion, resultVersion: ruleResultVersion };
      if (next.displayValue != null && next.id?.startsWith("FACT-")) next.displayValue = typeof next.value === "number"
        ? next.unit === "%" ? `${next.value}%` : next.unit ? `${next.value} ${next.unit}` : next.value
        : next.value;
      return next;
    };
    const retargetedContentFacts = (template.contentFacts || []).map(retargetRecord);
    const retargetedFactsById = new Map(retargetedContentFacts.map((fact) => [fact.id, fact]));
    const retargetPresentationRecord = (record) => {
      const next = retargetRecord(record);
      const refs = next.factRefs || (next.factId ? [next.factId] : []);
      const fact = refs.length === 1 ? retargetedFactsById.get(refs[0]) : null;
      const isSimpleOccurrence = fact && next.claimType !== "narrative" && next.presentationType !== "paragraph";
      if (isSimpleOccurrence) {
        const displayValue = typeof fact.value === "number"
          ? fact.unit === "%" ? `${fact.value}%` : fact.unit ? `${fact.value} ${fact.unit}` : fact.value
          : fact.value;
        if ("displayValue" in next) next.displayValue = displayValue;
        if ("renderedValue" in next) next.renderedValue = displayValue;
        if ("displayUnit" in next) next.displayUnit = fact.unit || null;
        if ("evidenceRefs" in next) next.evidenceRefs = clone(fact.evidence || next.evidenceRefs || []);
        if ("semanticSnapshot" in next) next.semanticSnapshot = clone(fact.semanticSnapshot || next.semanticSnapshot || null);
        if ("trustSnapshot" in next) next.trustSnapshot = clone(fact.trustSnapshot || next.trustSnapshot || null);
        if ("ruleSnapshot" in next) next.ruleSnapshot = clone(fact.ruleSnapshot || next.ruleSnapshot || null);
        if ("canonicalFactKey" in next) next.canonicalFactKey = fact.canonicalFactKey || next.canonicalFactKey || null;
      }
      return next;
    };
    const pack = {
      ...clone(template),
      packageId: `RFP-S001-${safeVersion}`,
      packageVersion: "1.0",
      sceneId: scenario.scenarioId,
      scenarioContext: clone(scenario),
      authorityBindingId: binding.bindingId,
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      consumableVersionId: binding.consumableVersionId,
      asOf: binding.asOf,
      quality: trust.publishedQuality,
      freshness: trust.freshness,
      readiness: trust.readiness,
      resultVersions: { metric: metricResultVersion, rule: ruleResultVersion },
      authoritativeBinding: versionBinding,
      contentFacts: retargetedContentFacts,
      anchors: (template.anchors || []).map(retargetPresentationRecord),
      contentItems: (template.contentItems || []).map(retargetPresentationRecord),
      trend: (template.trend || []).map((point) => ({ ...clone(point), month: retargetTrendIdentity(point.month) })),
      renderManifest: {
        ...clone(template.renderManifest),
        authoritativeBinding: versionBinding,
        items: (template.renderManifest?.items || []).map(retargetPresentationRecord),
      },
      generatedNarrativeContract: clone(template.generatedNarrativeContract),
      actionTypes: DATA.actionTypes.map((item) => item.id === "AT-FIN-OPT-001"
        ? { ...clone(item), publishedSemanticVersion: binding.semanticVersion, status: "Published" }
        : clone(item)),
      units: Object.fromEntries(Object.entries(template.units || {}).map(([name, unit]) => [name, {
        ...clone(unit),
        rule: { ...clone(unit.rule), publishedSemanticVersion: binding.semanticVersion, resultVersion: ruleResultVersion },
      }])),
      owners: { ...clone(template.owners), authoritativeBinding: "本体管理", dataTrust: "数据工程", contentFacts: "报告中心" },
      materializedAt: nowText(),
      materializationBasis: "同一 C033 轮次的 C008/T019、C017 双摘要与 S001 已确认报告事实合同",
    };
    runtimeFactPackages.set(binding.dataVersion, pack);
    return pack;
  }

  function currentFactPackage() {
    return factPackageForBinding(currentAuthority());
  }

  function factPackageIsAvailable(factPackage) {
    return Boolean(factPackage && factPackage.factPackageStatus === "available" && factPackage.contentFacts?.length && factPackage.anchors?.length);
  }

  function evidencePackFor(report = readingReport()) {
    return report?.evidencePacks?.find((item) => item.id === report.evidencePackId) || null;
  }

  function factPackageForReport(report = readingReport()) {
    const evidencePack = evidencePackFor(report);
    if (report?.evidencePackId) return evidencePack?.authoritativeFactPackage || null;
    return factPackageForBinding(bindingFor(report));
  }

  function currentFactsAreUsable() {
    const trust = currentTrust();
    const binding = currentAuthority();
    const projection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.();
    return Boolean(projection?.schemaVersion === 1 && projection?.readStatus === "ready"
      && sameScenarioContext(projection?.scenarioContext, activeScenarioContext())
      && factPackageIsAvailable(currentFactPackage())
      && trust
      && binding
      && !trust.hardQualityFailure
      && trust.readiness === "可消费"
      && binding.readiness === "可消费"
      && binding.compatibility === "兼容");
  }

  function dashboardConsumptionBlock() {
    const trust = currentTrust();
    const binding = currentAuthority();
    const factPackage = currentFactPackage();
    const factsAvailable = factPackageIsAvailable(factPackage);
    if (currentFactsAreUsable()) return "";
    const projection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
    const reason = projection.readStatus !== "ready"
      ? projection.reason || "统一 C008 权威投影未就绪。"
      : trust.hardQualityFailure
      ? trust.recoveryAdvice || "当前权威组合存在硬质量失败。"
      : binding.compatibility !== "兼容"
        ? "当前已发布语义与数据版本不兼容。"
        : trust.readiness !== "可消费" || binding.readiness !== "可消费"
          ? trust.recoveryAdvice || "当前权威组合尚不可消费。"
          : "当前权威组合的精确业务事实包不可定位。";
    const previous = projection.previousTrustedCombination || {};
    const previousFacts = DATA.reportEvidence.factPackages?.[previous.dataVersion] || null;
    const recovery = trust.freshness === "上一可信版本继续服务"
      ? factPackageIsAvailable(previousFacts)
        ? "上一可信组合已由本体管理受控采用；待其精确事实可定位后展示。"
        : "上一可信组合已由本体管理受控采用，但该精确事实包当前不可定位；不复制其他版本结果。"
      : "等待本体管理受控采用新的可消费组合；报告中心不能自行切换上一版本。";
    return `
      <section class="panel" data-screen-label="驾驶舱业务内容阻断">
        <div class="panel-body section-stack">
          <div class="notice danger">${icon("shield-x")}<div><strong>当前业务分析暂不可用</strong><span>${esc(reason)} 指标、趋势、结构、机构、单位比较和 Rule 结果均不作为完整当前结果展示。</span></div></div>
          <div class="detail-list">
            <div class="detail-row"><span>统一投影</span><strong>${esc(projection.projectionId || "不可定位")} · ${esc(projection.projectionVersion || "未取得")} · ${esc(projection.readStatus || "missing")}</strong></div>
            <div class="detail-row"><span>当前权威组合</span><strong>${esc(binding.bindingId || "未形成")} · ${esc(binding.semanticVersion || "未取得")} / ${esc(binding.dataVersion || "未取得")}</strong></div>
            <div class="detail-row"><span>数据截至 / 摘要时点</span><strong>${esc(binding.asOf)} / ${esc(trust.formedAt || "未提供")}</strong></div>
            <div class="detail-row"><span>质量 / 消费 / 兼容性</span><strong>${esc(trust.publishedQuality)} / ${esc(binding.readiness)} / ${esc(binding.compatibility || "未提供")}</strong></div>
            <div class="detail-row"><span>责任位置</span><strong>数据可信度：数据工程 · 权威组合：本体管理</strong></div>
            <div class="detail-row"><span>恢复方式</span><strong>${esc(recovery)}</strong></div>
            <div class="detail-row"><span>上一可信组合</span><strong>${esc(previous.bindingId || "未取得")} · ${esc(previous.dataVersion || "未取得")} · 截至 ${esc(previous.asOf || "未取得")} · 只读参考</strong></div>
          </div>
          <div class="button-row"><button class="btn primary" type="button" data-action="open-trust">${icon("shield-check", "sm")}查看数据状态</button></div>
        </div>
      </section>
    `;
  }

  function factById(factPackage, factId) {
    return factPackage?.contentFacts?.find((item) => item.id === factId) || null;
  }

  function formatFactValue(fact) {
    if (!fact) return "不可定位";
    if (typeof fact.value !== "number") return String(fact.value);
    const value = formatNumber(fact.value, fact.unit === "%" ? 6 : 3);
    return `${value}${fact.unit ? ` ${fact.unit}` : ""}`;
  }

  function semanticResolutionFor(report = readingReport()) {
    const key = report.reportNo || report.draftId || report.aggregateId;
    return runtimeExternalViews.historySemanticByReport.get(key)?.status || bindingFor(report).semanticResolution || "resolved";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storePublishedReport(report = state.report) {
    const snapshot = clone(report);
    if (!snapshot.reportNo || !scenarioContextReady(snapshot.scenarioContext) || state.publishedReports.some((item) => item.reportNo === snapshot.reportNo && sameScenarioContext(item.scenarioContext, snapshot.scenarioContext))) return false;
    state.publishedReports.unshift(snapshot);
    return true;
  }

  function updatePublishedLifecycle(reportNo, patch) {
    const report = state.publishedReports.find((item) => item.reportNo === reportNo && resourceInCurrentScenario(item));
    if (!report) return null;
    Object.assign(report, patch);
    return report;
  }

  function actionPayload(request) {
    if (!request?.id) return {};
    return OWNERS.decision.getAction(request.id)?.payload || {};
  }

  function rereadDecisionSummaries(navigation = {}) {
    const summaries = OWNERS.decision.rereadSummary(currentActionRequests().map((request) => request.id), navigation);
    runtimeExternalViews.decisionById.clear();
    (summaries || []).forEach((summary) => runtimeExternalViews.decisionById.set(summary.sourceRequestId, summary));
    return summaries || [];
  }

  function syncAgentReference(reference, external) {
    if (!reference || !external) return false;
    reference.runId = external.runId || reference.runId || null;
    reference.sessionId = external.sessionId || reference.sessionId || null;
    reference.bindingId = external.bindingId || external.contextBindingId || reference.bindingId || null;
    reference.resultId = external.resultId || reference.resultId || null;
    reference.readAt = external.readAt || nowText();
    return true;
  }

  function rereadAgentReferences() {
    let reads = 0;
    const assistantRef = state.assistant.requestRef;
    if (assistantRef) {
      const external = OWNERS.agent.getC025?.(assistantRef.requestId || assistantRef.runId);
      if (syncAgentReference(assistantRef, external)) reads += 1;
    }
    allReportRecords().forEach((report) => {
      const verificationRecords = [report.verification, report.postPublicationVerification, ...(report.verificationRuns || [])].filter(Boolean);
      verificationRecords.forEach((verification) => {
        if (!verification.explanationRequestId && !verification.explanationRunId) return;
        const external = OWNERS.agent.getC025?.(verification.explanationRequestId || verification.explanationRunId);
        if (!external) return;
        verification.explanationRunId = external.runId || verification.explanationRunId || null;
        verification.explanationResultId = external.resultId || verification.explanationResultId || null;
        verification.explanationReadAt = external.readAt || verification.explanationReadAt || null;
        syncVerificationArchiveReferences(report, verification);
        reads += 1;
      });
      [report.comparison, ...(report.comparisonRecords || [])].filter(Boolean).forEach((comparison) => {
        if (!comparison.explanationRequestId && !comparison.explanationRunId) return;
        const external = OWNERS.agent.getByComparisonRecord?.(comparison.recordId)
          || OWNERS.agent.getQA?.(comparison.explanationRequestId || comparison.explanationRunId);
        if (!external) return;
        comparison.explanationRunId = external.runId || comparison.explanationRunId || null;
        comparison.explanationResultId = external.resultId || comparison.explanationResultId || null;
        comparison.explanationReadAt = external.readAt || comparison.explanationReadAt || null;
        syncComparisonRecordReferences(report, comparison);
        reads += 1;
      });
    });
    return reads;
  }

  function isOpenIssue(issue) {
    return !["已核对关闭", "已解决", "已取消"].includes(issue.status);
  }

  function createContentSnapshot(report, generatedContent = null) {
    const factPackage = factPackageForReport(report);
    if (!factPackageIsAvailable(factPackage)) return null;
    const authoritativeFacts = clone(factPackage.contentFacts || []);
    const contentFacts = generatedContent?.contentFacts?.length
      ? clone(generatedContent.contentFacts)
      : authoritativeFacts.map((fact) => ({
        contentFactId: `GCF-MIGRATED-${fact.id}`,
        sourceFactId: fact.id,
        factId: fact.id,
        intendedFactId: fact.id,
        label: fact.label,
        kind: fact.kind,
        value: clone(fact.value),
        authoritativeValue: clone(fact.value),
        unit: fact.unit,
        scope: fact.scope,
        resultVersion: fact.resultVersion,
        evidenceRefs: clone(fact.evidence || []),
        anchorIds: clone(fact.anchorIds || []),
        bindingStatus: "bound",
      }));
    return {
      snapshotId: makeId("CNT"),
      revisionNumber: generatedContent?.contentRevision || report.revisionNumber,
      factPackageId: factPackage.packageId,
      dataVersion: factPackage.dataVersion,
      contentFacts,
      authoritativeFacts,
      bindingGaps: clone(generatedContent?.bindingGaps || []),
      narratives: clone(generatedContent?.generatedNarratives || []),
      groupMetrics: clone(factPackage.groupMetrics),
      units: clone(factPackage.units),
      trend: clone(factPackage.trend),
      structures: clone(factPackage.structures),
      institutions: clone(factPackage.institutions),
      facts: clone(factPackage.contentFacts),
      createdAt: nowText(),
    };
  }

  function snapshotContentFact(snapshot, factId) {
    return snapshot?.contentFacts?.find((fact) => fact.sourceFactId === factId || fact.intendedFactId === factId || fact.factId === factId) || null;
  }

  function snapshotAuthoritativeFact(snapshot, factId) {
    return snapshot?.authoritativeFacts?.find((fact) => fact.id === factId)
      || snapshot?.facts?.find((fact) => fact.id === factId)
      || null;
  }

  function snapshotBindingGap(snapshot, factId) {
    return snapshot?.bindingGaps?.find((gap) => gap.intendedFactId === factId) || null;
  }

  function snapshotNarrative(snapshot, id, fallback = "") {
    return snapshot?.narratives?.find((item) => item.id === id)?.text || fallback;
  }

  function snapshotFactValue(snapshot, factId) {
    const contentFact = snapshotContentFact(snapshot, factId);
    return contentFact ? contentFact.value : snapshotAuthoritativeFact(snapshot, factId)?.value;
  }

  function snapshotFactText(snapshot, factId, digits = 6, includeUnit = true) {
    const fact = snapshotContentFact(snapshot, factId) || snapshotAuthoritativeFact(snapshot, factId);
    if (!fact || fact.value == null) return "不可定位";
    const value = typeof fact.value === "number" ? formatNumber(fact.value, digits) : String(fact.value);
    if (!includeUnit || !fact.unit) return value;
    return fact.unit === "%" ? `${value}%` : `${value} ${fact.unit}`;
  }

  function snapshotValueMismatch(snapshot, factId) {
    const contentFact = snapshotContentFact(snapshot, factId);
    const authoritativeFact = snapshotAuthoritativeFact(snapshot, factId);
    return Boolean(contentFact && authoritativeFact && !comparisonValueEqual(contentFact.value, authoritativeFact.value));
  }

  function buildContentContract(sourceItems, factPackage, draftId) {
    const providedManifest = factPackage.renderManifest || { manifestId: null, version: null, items: factPackage.contentItems || [] };
    const sourceByContentId = new Map((sourceItems || []).filter((item) => item.contentItemId).map((item) => [item.contentItemId, item]));
    const sourceByAnchor = new Map((sourceItems || []).filter((item) => item.anchorId).map((item) => [item.anchorId, item]));
    const renderItems = (providedManifest.items || factPackage.contentItems || []).map((declared) => {
      const source = sourceByContentId.get(declared.contentItemId) || sourceByAnchor.get(declared.anchorId) || null;
      const bindingMissing = source?.bindingStatus === "missing" || declared.bindingStatus === "missing";
      const requiresEvidence = declared.requiresEvidence !== false;
      const factRefs = bindingMissing ? [] : clone(source?.factRefs?.length ? source.factRefs : declared.factRefs || []);
      const evidenceRefs = bindingMissing ? [] : clone(source?.evidenceRefs?.length ? source.evidenceRefs : declared.evidenceRefs || []);
      return {
        ...clone(declared),
        sourceItemId: source?.sourceItemId || null,
        parentId: source?.parentId || null,
        contentItemId: declared.contentItemId || source?.contentItemId || null,
        anchorId: declared.anchorId || source?.anchorId || null,
        templateSlot: declared.templateSlot || source?.templateSlot || null,
        contentType: source?.contentType || declared.presentationType || declared.claimType || "content-item",
        location: source?.location || declared.location || declared.anchorId || declared.contentItemId,
        factRefs,
        intendedFactRefs: bindingMissing ? clone(declared.factRefs || source?.intendedFactRefs || []) : [],
        evidenceRefs,
        bindingStatus: requiresEvidence ? (bindingMissing || !factRefs.length || !evidenceRefs.length ? "missing" : "bound") : "not-required",
        requiresEvidence,
        renderedValue: source?.renderedValue ?? source?.value ?? declared.renderedValue ?? declared.displayValue ?? null,
        displayValue: source?.displayValue ?? source?.value ?? declared.displayValue ?? declared.renderedValue ?? null,
        rendered: source ? source.rendered !== false : declared.origin === "template",
      };
    });
    const t044Bindings = renderItems.filter((item) => item.requiresEvidence && item.anchorId).map((item, index) => ({
      id: `T044-${draftId}-${String(index + 1).padStart(3, "0")}`,
      sourceItemId: item.sourceItemId,
      contentItemId: item.contentItemId,
      parentId: item.parentId,
      templateSlot: item.templateSlot,
      contentType: item.contentType,
      origin: item.origin,
      claimType: item.claimType,
      anchorId: item.anchorId,
      htmlAnchorId: item.htmlAnchorId || item.anchorId,
      pdfAnchorId: item.pdfAnchorId || `pdf-${item.anchorId}`,
      location: item.location,
      factRefs: clone(item.factRefs || []),
      intendedFactRefs: clone(item.intendedFactRefs || []),
      evidenceRefs: clone(item.evidenceRefs || []),
      bindingStatus: item.bindingStatus,
      renderedValue: clone(item.renderedValue),
      displayValue: clone(item.displayValue),
      displayUnit: item.displayUnit ?? null,
      canonicalFactKey: item.canonicalFactKey || null,
    }));
    const factInventory = clone(factPackage.contentFacts || []);
    const checkById = new Map(DATA.reportEvidence.verificationChecks.map((item) => [item.id, item]));
    const factPlan = factInventory.flatMap((fact) => (fact.applicableChecks || [])
      .filter((checkType) => checkType !== "unboundContentDetection")
      .map((checkType) => ({
        id: `T049-PLAN-${draftId}-${fact.id}-${checkType}`,
        factId: fact.id,
        contentItemId: null,
        checkType,
        checkName: checkById.get(checkType)?.name || checkType,
        owner: "报告中心",
        applicability: "applicable",
        executionState: "planned",
        t044Ids: t044Bindings.filter((binding) => binding.factRefs.includes(fact.id) || binding.intendedFactRefs.includes(fact.id)).map((binding) => binding.id),
      })));
    const contentPlan = renderItems.map((item) => ({
      id: `T049-PLAN-${draftId}-${item.contentItemId || item.anchorId}-unboundContentDetection`,
      factId: item.factRefs[0] || item.intendedFactRefs?.[0] || null,
      contentItemId: item.contentItemId,
      checkType: "unboundContentDetection",
      checkName: checkById.get("unboundContentDetection")?.name || "无绑定内容识别",
      owner: "报告中心",
      applicability: "applicable",
      executionState: "planned",
      t044Ids: t044Bindings.filter((binding) => binding.contentItemId === item.contentItemId).map((binding) => binding.id),
    }));
    const renderManifest = {
      manifestId: providedManifest.manifestId,
      version: providedManifest.version,
      reportDefinitionId: providedManifest.reportDefinitionId,
      templateId: providedManifest.templateId,
      authoritativeBinding: clone(providedManifest.authoritativeBinding || factPackage.authoritativeBinding || null),
      items: renderItems,
    };
    return { t044Bindings, factInventory, renderManifest, verificationPlan: [...factPlan, ...contentPlan] };
  }

  function isFullVerificationCoverage(report, verification) {
    const contract = contentContract(report);
    const coverage = verification?.coverage || {};
    return frozenVerificationScope(verification) === "整份报告"
      && coverage.status === "complete"
      && coverage.planned === contract.verificationPlan.length
      && coverage.applicable === contract.verificationPlan.length
      && coverage.completed === contract.verificationPlan.length
      && coverage.pending === 0
      && coverage.error === 0
      && coverage.skipped === 0
      && coverage.factTotal === contract.factInventory.length
      && coverage.factCovered === contract.factInventory.length
      && coverage.anchorTotal === contract.t044Bindings.filter((item) => item.anchorId).length
      && coverage.anchorCovered === contract.t044Bindings.filter((item) => item.anchorId).length;
  }

  function comparisonValueEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function buildComparisonResults(reportPackage, currentPackage) {
    const currentFacts = new Map((currentPackage?.contentFacts || []).map((fact) => [fact.id, fact]));
    return (reportPackage?.contentFacts || []).map((reportFact) => {
      const currentFact = currentFacts.get(reportFact.id);
      const comparable = currentFact
        && reportFact.unit === currentFact.unit
        && reportFact.scope === currentFact.scope;
      const status = !comparable ? "unverifiable"
        : comparisonValueEqual(reportFact.value, currentFact.value) ? "same" : "changed";
      return {
        factId: reportFact.id,
        label: reportFact.label || reportFact.id,
        anchor: reportFact.primaryAnchorId,
        status,
        reportValue: formatFactValue(reportFact),
        currentValue: comparable ? formatFactValue(currentFact) : "不可比较",
        reportResultVersion: reportFact.resultVersion || null,
        currentResultVersion: currentFact?.resultVersion || null,
        limitation: comparable ? null : "当前事实缺失，或单位、适用对象与报告快照不一致。",
      };
    });
  }

  function currentContentRecord(report = state.report) {
    return report.contentVersions.find((item) => item.reviewCopyId === report.reviewCopyId) || null;
  }

  function recordReviewEvent(report, type, detail = {}) {
    const event = { scenarioContext: clone(report.scenarioContext), id: makeId("REV"), type, contentVersion: report.contentVersion || report.draftVersion, at: nowText(), ...detail };
    report.reviewHistory.push(event);
    return event;
  }

  function archiveVerificationRun(report, run) {
    if (!run?.runId || report.verificationRuns.some((item) => item.runId === run.runId)) return;
    report.verificationRuns.push({ ...clone(run), scenarioContext: clone(report.scenarioContext) });
    const content = currentContentRecord(report);
    if (content && !content.verificationRunIds.includes(run.runId)) content.verificationRunIds.push(run.runId);
  }

  function latestGenerationReference(report = state.report) {
    return report.agentGenerationRefs.find((item) => report.generationRunId && item.runId === report.generationRunId)
      || report.agentGenerationRefs.find((item) => report.requestId && item.requestId === report.requestId)
      || report.agentGenerationRefs.at(-1)
      || null;
  }

  function rereadGeneration(report = state.report) {
    const reference = latestGenerationReference(report);
    if (!reference) return null;
    return OWNERS.agent.getGeneration(reference.runId || reference.requestId);
  }

  function schedule(callback, delay) {
    const nonce = state.nonce;
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      if (state.nonce !== nonce) return;
      callback();
    }, delay);
    pendingTimers.add(timer);
  }

  function clearTimers() {
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
    pendingTimers.clear();
  }

  function resetRuntimeExternalViews() {
    runtimeExternalViews.trust = null;
    runtimeExternalViews.trustReadIndex = 0;
    runtimeExternalViews.decisionById.clear();
    runtimeExternalViews.historySemanticByReport.clear();
    runtimeExternalViews.historyReadCountByReport.clear();
    runtimeExternalViews.decisionNavigation = null;
  }

  function esc(value) {
    return normalizeDisplayText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeCorruptedText(value) {
    let text = String(value ?? "").replace(/未\uFFFD+得/g, "未取得");
    if (text.includes("\uFFFD")) text = "未取得";
    return text;
  }

  function normalizeStoredPlaceholders(value) {
    if (typeof value === "string") return normalizeCorruptedText(value);
    if (Array.isArray(value)) return value.map(normalizeStoredPlaceholders);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeStoredPlaceholders(item)]));
    }
    return value;
  }

  function normalizeDisplayText(value) {
    const text = normalizeCorruptedText(value);
    const publishedOntologyMeta = text.match(/^Published\s*本体[：:]\s*(.+)$/);
    if (publishedOntologyMeta) return `本体版本：${publishedOntologyMeta[1]}（已发布）`;
    const dataAsOfMeta = text.match(/^T008[：:]\s*(.+)$/);
    if (dataAsOfMeta) return `数据截至：${dataAsOfMeta[1]}`;
    const bindingSummaryMeta = text.match(/^C017\s*版本绑定摘要[：:]\s*(.+)$/);
    if (bindingSummaryMeta) return `版本绑定摘要：${bindingSummaryMeta[1]}`;
    const localized = text
      .replace(/^报告标识[：:]/, "报告编号：")
      .replace(/行动请求/g, "行动申请")
      .replace(/([\u3400-\u9fff])\s+Published\b/g, "$1已发布")
      .replace(/\bPublished\s+([\u3400-\u9fff])/g, "已发布$1")
      .replace(/\bPublished\b/g, "已发布")
      .replace(/([\u3400-\u9fff])\s+Draft\b/g, "$1草稿")
      .replace(/\bDraft\s+([\u3400-\u9fff])/g, "草稿$1")
      .replace(/\bDraft\b/g, "草稿")
      .replace(/([\u3400-\u9fff])\s+Owner\b/g, "$1责任人")
      .replace(/\bOwner\s+([\u3400-\u9fff])/g, "责任人$1")
      .replace(/\bOwner\b/g, "责任人")
      .replace(/([\u3400-\u9fff])\s+Action Request\b/g, "$1行动申请")
      .replace(/\bAction Request\s+([\u3400-\u9fff])/g, "行动申请$1")
      .replace(/\bAction Request\b/g, "行动申请");
    if (!s003ScenarioSelected()) return localized;
    return localized
      .replace(/当前为报告工作预览/g, "本次企业报告正在形成")
      .replace(/工作预览不可下载/g, "报告形成后可下载")
      .replace(/工作预览/g, "报告预览")
      .replace(/当前运行工作投影/g, "本次评估结果正在准备")
      .replace(/当前工作投影/g, "本次评估批次")
      .replace(/评分工作投影/g, "本次评分结果")
      .replace(/工作投影/g, "本次评估批次")
      .replace(/历史快照\s*[·・]\s*只读/g, "历史评估记录")
      .replace(/历史运行只读/g, "历史评估记录")
      .replace(/历史只读/g, "历史记录，仅供查看")
      .replace(/当前组合不可消费/g, "当前结果正在准备")
      .replace(/不可消费/g, "暂未形成正式结果")
      .replace(/正式消费继续阻断/g, "正式处理将在发布完成后开放")
      .replace(/消费继续阻断/g, "将在发布完成后开放")
      .replace(/继续阻断/g, "暂不进入后续处理")
      .replace(/统一运行服务暂不可读/g, "正在同步本次评估结果")
      .replace(/部分 Checkpoint 目录项暂不可读/g, "部分场景快照正在同步");
  }

  function localizeVisibleText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const normalized = normalizeDisplayText(node.nodeValue);
      if (normalized !== node.nodeValue) node.nodeValue = normalized;
    });
    root.querySelectorAll?.("[title], [aria-label], [placeholder]").forEach((element) => {
      ["title", "aria-label", "placeholder"].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        element.setAttribute(attribute, normalizeDisplayText(element.getAttribute(attribute)));
      });
    });
    root.querySelectorAll?.("input[readonly], textarea[readonly]").forEach((element) => {
      element.value = normalizeDisplayText(element.value);
    });
  }

  function normalizeFrozenReportHtml(html) {
    if (!html) return html;
    const template = document.createElement("template");
    template.innerHTML = String(html);
    const narrative = template.content.querySelector("#narrative-suggestion");
    const suggestionBasis = template.content.querySelector("#suggestion-basis");
    if (narrative && suggestionBasis) {
      const duplicateParagraph = suggestionBasis.closest("p");
      narrative.replaceChildren(suggestionBasis);
      if (duplicateParagraph && duplicateParagraph !== narrative) duplicateParagraph.remove();
    }
    localizeVisibleText(template.content);
    return template.innerHTML;
  }

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true"><i data-lucide="${name}"></i></span>`;
  }

  function nowText() {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()).replaceAll("/", "-");
  }

  function compactStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function makeId(prefix) {
    idSequence += 1;
    return `${prefix}-${compactStamp()}-${String(idSequence).padStart(3, "0")}`;
  }

  function formatNumber(value, digits = 3) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  }

  function formatPercent(value, digits = 2) {
    return `${formatNumber(value, digits)}%`;
  }

  function toneForStatus(status) {
    if (["可使用", "已启用", "已发布", "已完成", "通过", "请求已接收", "已确认"].includes(status)) return "success";
    if (["资料待补充", "警告", "有提示", "待复核", "待确认", "处理中", "生成中", "固定证据中"].includes(status)) return "warning";
    if (["失败", "证据缺失", "核验阻断", "不可消费", "硬质量失败"].includes(status)) return "danger";
    if (["无法核验", "受限"].includes(status)) return "purple";
    return "info";
  }

  function badge(status, tone = toneForStatus(status)) {
    return `<span class="badge ${tone}"><span class="status-dot"></span>${esc(status)}</span>`;
  }

  function toast(title, detail = "", tone = "") {
    const node = document.createElement("div");
    node.className = `toast ${tone}`.trim();
    const visibleTitle = normalizeDisplayText(title);
    const visibleDetail = normalizeDisplayText(detail);
    node.innerHTML = `${icon(tone === "danger" ? "circle-alert" : tone === "success" ? "circle-check" : "info")}<div><strong>${esc(visibleTitle)}</strong>${visibleDetail ? `<span>${esc(visibleDetail)}</span>` : ""}</div>`;
    toastRoot.appendChild(node);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    window.setTimeout(() => node.remove(), 3800);
  }

  function routeInfo() {
    const hash = window.location.hash || "#/lifecycle";
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    const [path, queryString = ""] = raw.split("?");
    return { path: path || "/lifecycle", query: new URLSearchParams(queryString) };
  }

  function navigate(path) {
    previousRoutePath = routeInfo().path;
    state.navOpen = false;
    saveState();
    if (`#${path}` === window.location.hash) renderApp();
    else window.location.hash = path;
  }

  function renderShell(content, options = {}) {
    const currentPath = routeInfo().path;
    const active = (prefix) => currentPath.startsWith(prefix) ? "active" : "";
    const crumb = options.crumb || "报告中心";
    const shellAuthority = currentAuthority();
    const shellAsOf = options.asOf || shellAuthority.asOf || "未取得";
    const baselinePublishedReportCount = currentPublishedReports().filter((item) => item.stage === "published").length;
    const providerPublishedReportCount = s003ScenarioSelected() && s003Dashboard.status === "ready"
      ? (s003ReportProvider()?.reports || []).filter((item) => item.stage === "published").length
      : 0;
    const publishedReportCount = s003ScenarioSelected()
      ? Math.max(Number(options.publishedReportCount || 0), providerPublishedReportCount)
      : options.publishedReportCount ?? baselinePublishedReportCount;
    const catalogReportCount = s003ScenarioSelected()
      ? publishedReportCount
      : state.report.stage === "idle" ? 0 : 1;
    const platformModule = (moduleId, relativePath, label, iconName) => s003ScenarioSelected()
      ? `<button class="platform-button" type="button" data-action="s003-navigate-module" data-module="${moduleId}" aria-label="${label}" title="${label}">${icon(iconName)}</button>`
      : `<a class="platform-button" href="${esc(relativePath)}" aria-label="${label}" title="${label}">${icon(iconName)}</a>`;
    return `
      <div class="app-shell ${s003ScenarioSelected() ? "s003-native-shell" : ""} ${state.navOpen ? "nav-open" : ""}">
        <aside class="platform-rail" aria-label="平台模块">
          <a class="platform-logo" href="../../ontology3-homepage-review/index.html" aria-label="智财问策平台首页" title="智财问策平台首页">${icon("network")}</a>
          <a class="platform-button" href="../../ontology3-homepage-review/index.html" aria-label="平台首页" title="平台首页">${icon("house")}</a>
          ${platformModule("data", "../../data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html", "数据工程", "database")}
          ${platformModule("ontology", "../../ontology-management-prototype/index.html", "本体管理", "network")}
          ${platformModule("query", "../../intelligent-query-prototype/智能问数工作台.html", "智能问数", "message-square-text")}
          ${platformModule("decision", "../../decision-center-prototype/index.html", "决策中心", "list-checks")}
          ${platformModule("agent", "../../agent-application/Agent应用.html", "Agent 应用", "bot")}
          <span class="platform-button active" title="报告中心">${icon("chart-no-axes-combined")}</span>
          <div class="platform-spacer"></div>
          <button class="platform-button" type="button" data-action="open-reset" title="重置状态">${icon("rotate-ccw")}</button>
        </aside>
        ${state.navOpen ? `<button class="mobile-nav-backdrop" type="button" data-action="toggle-nav" aria-label="关闭导航"></button>` : ""}
        <nav class="product-nav" aria-label="报告中心导航">
          ${s003ScenarioSelected() ? "" : `<div class="product-nav-head">
            <span>${icon("chart-no-axes-combined", "sm")}</span>
            <div><strong>报告中心</strong><small>分析与正式报告</small></div>
          </div>`}
          <div class="product-nav-list">
            <div class="product-nav-label">报告工作</div>
            <a class="product-nav-item ${active("/lifecycle")}" href="#/lifecycle">${icon("rows-3", "sm")}<span>报告目录</span><em>${catalogReportCount}</em></a>
            <a class="product-nav-item ${active("/reports/generate") || active("/reports/draft") ? "active" : ""}" href="#/reports/generate">${icon("git-pull-request-create", "sm")}<span>创建与生成</span></a>
            <a class="product-nav-item ${active("/reports/view") || active("/reports/s003") || active("/reports/pdf") || currentPath === "/reports" && routeInfo().query.get("tab") === "products" ? "active" : ""}" href="#/reports?tab=products">${icon("library", "sm")}<span>正式报告</span><em>${publishedReportCount}</em></a>
            <div class="product-nav-label">资源与分析</div>
            <a class="product-nav-item ${currentPath === "/reports" && routeInfo().query.get("tab") !== "products" ? "active" : ""}" href="#/reports?tab=definitions">${icon("file-cog", "sm")}<span>报告定义</span></a>
          </div>
          <div class="product-nav-foot">
            <strong>当前工作区</strong>
            <span>集团财务管理</span>
            <span>报告生命周期工作区</span>
          </div>
        </nav>
        <section class="app-workspace">
          <header class="topbar">
            <div class="topbar-left">
              <button class="icon-button mobile-nav-toggle" type="button" data-action="toggle-nav" title="打开导航">${icon("menu")}</button>
              <div class="breadcrumb">${icon("chart-no-axes-combined", "sm")}<span>报告中心</span>${icon("chevron-right", "sm")}<strong>${esc(crumb)}</strong></div>
            </div>
            <div class="topbar-actions">
              <span class="badge plain trust-top-badge">数据截至 ${esc(shellAsOf)}</span>
              <button class="btn ghost" type="button" data-action="open-reset" title="清除本次操作产生的内容">${icon("rotate-ccw", "sm")}重置状态</button>
            </div>
            ${s003ProjectionIssue ? `<div class="persistence-banner">${icon("shield-alert", "sm")}<span>${esc(s003ProjectionIssue.reason)} ${esc(s003ProjectionIssue.recovery)}</span></div>` : runtimePersistenceError ? `<div class="persistence-banner">${icon("hard-drive", "sm")}<span>${esc(runtimePersistenceError)}</span><button class="btn" type="button" data-action="retry-persistence">重试保存</button></div>` : ""}
          </header>
          <main class="main ${options.mainClass || ""}">${content}</main>
        </section>
      </div>
    `;
  }

  function trustStrip() {
    const trust = currentTrust();
    const binding = currentAuthority();
    const factsAvailable = factPackageIsAvailable(currentFactPackage());
    const projection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
    const blocked = projection.readStatus !== "ready" || trust.hardQualityFailure || trust.readiness !== "可消费" || binding.readiness !== "可消费" || binding.compatibility !== "兼容" || !factsAvailable;
    return `
      <div class="trust-strip">
        <div class="trust-summary">
          <div>${icon("database", "sm")}<span>数据版本</span><strong>${esc(binding.dataVersion || "未取得")}</strong></div>
          <div>${icon("network", "sm")}<span>语义版本</span><strong>${esc(binding.semanticVersion || "未取得")}</strong></div>
          <div>${icon("calendar-clock", "sm")}<span>数据截至</span><strong>${esc(binding.asOf || "未取得")}</strong></div>
          <div>${icon(blocked ? "shield-x" : "shield-alert", "sm")}<span>质量</span><strong>${esc(trust.publishedQuality || projection.reason || "未取得")}</strong></div>
          <div>${icon(blocked ? "circle-x" : "circle-check-big", "sm")}<span>报告消费</span><strong>${esc(projection.readStatus !== "ready" ? "上游未就绪" : !factsAvailable ? "事实不可定位" : binding.compatibility !== "兼容" ? "版本不兼容" : blocked ? "不可消费" : binding.readiness)}</strong></div>
        </div>
        <button class="btn soft" type="button" data-action="open-trust">${icon("shield-check", "sm")}查看数据状态</button>
      </div>
    `;
  }

  function s003Tier(record) {
    return record?.riskTier?.tierId || record?.riskTier || "UNKNOWN";
  }

  function s003TierName(record) {
    return record?.riskTier?.name || ({ GREEN: "绿灯", YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯" }[s003Tier(record)] || "待评估");
  }

  function s003TierBadge(record) {
    const tier = s003Tier(record);
    return `<span class="s003-risk-badge risk-${tier.toLowerCase()}"><i></i>${esc(s003TierName(record))}</span>`;
  }

  function s003TierThresholdText(tier) {
    if (!tier) return "阈值未取得";
    const min = tier.minInclusive == null ? null : Number(tier.minInclusive);
    const max = tier.maxExclusive == null ? null : Number(tier.maxExclusive);
    if (min == null && max != null) return `< ${max}`;
    if (min != null && max == null) return `≥ ${min}`;
    if (min != null && max != null) return `[${min}, ${max})`;
    return "阈值未取得";
  }

  function s003TierGuidance(tierId) {
    return ({
      GREEN: "风险总体可控，纳入常态监测并持续改善低分指标。",
      YELLOW: "出现弱化信号，优先核查风险源并确认持续跟踪事项。",
      RED: "债务压力显著，优先人工确认专项处置并跟踪负责人待办。",
      BLACK: "进入应急风险状态，优先人工确认应急响应和违约防控行动。"
    })[tierId] || "按当前 Published 风险分档和 Action Type 执行。";
  }

  function s003SectorSummaries(results) {
    const groups = new Map();
    (results || []).forEach((record) => {
      const sector = record.enterprise?.sector || "未分类";
      const group = groups.get(sector) || { sector, count: 0, scoreTotal: 0, highRiskCount: 0, weakest: null };
      const score = Number(record.finalScore || 0);
      group.count += 1;
      group.scoreTotal += score;
      if (["YELLOW", "RED", "BLACK"].includes(s003Tier(record))) group.highRiskCount += 1;
      if (!group.weakest || score < group.weakest.score) group.weakest = { name: record.enterprise?.name || "未命名企业", score, tierName: s003TierName(record) };
      groups.set(sector, group);
    });
    return [...groups.values()].map((group) => ({ ...group, average: group.count ? group.scoreTotal / group.count : 0 }))
      .sort((left, right) => right.count - left.count || left.sector.localeCompare(right.sector, "zh-CN"));
  }

  function s003TierToneClass(tierId) {
    return ({ YELLOW: "yellow", RED: "red", BLACK: "black", GREEN: "green" })[String(tierId || "").toUpperCase()] || "neutral";
  }

  // Keep the sector card's enterprise count and score in separate metric cells.
  // The previous free-form header/flex layout allowed the count, badge and score
  // to collide when a long sector name or a narrow viewport was used.
  function s003SectorCard(sector, options = {}) {
    const selected = options.selectedSector === sector.sector;
    const overview = Boolean(options.overview);
    const countLabel = `${sector.count} 家企业`;
    const averageLabel = `${Number(sector.average || 0).toFixed(2)} 分`;
    const weakest = sector.weakest
      ? `${sector.weakest.score.toFixed(2)} 分 / ${esc(sector.weakest.tierName)}`
      : "—";
    return `<button type="button" class="s003-sector-card ${selected ? "active" : ""}" data-action="s003-select-sector" data-sector="${esc(sector.sector)}" aria-label="${esc(`${sector.sector}，${countLabel}，平均评分 ${averageLabel}`)}">
      <header><span>${icon("building-2", "sm")}</span><div><strong>${esc(sector.sector)}</strong><small>产业板块</small></div>${sector.highRiskCount ? badge(`关注 ${sector.highRiskCount} 家`, "warning") : badge("当前无分档关注", "success")}</header>
      <div class="s003-sector-metrics">
        <span class="s003-sector-metric"><small>企业数</small><strong>${sector.count}<em>家</em></strong></span>
        <span class="s003-sector-metric"><small>产业平均评分</small><strong>${averageLabel}</strong></span>
      </div>
      <p>最低分企业：${esc(sector.weakest?.name || "—")} · ${weakest}</p>
      <small class="s003-drill-hint">${overview ? "查看本产业企业明细" : "点击查看本产业企业"} ${icon("arrow-right", "sm")}</small>
    </button>`;
  }

  function s003SortDetailRows(rows) {
    return rows.slice().sort((left, right) => {
      const scoreDelta = Number(left.record?.finalScore ?? Infinity) - Number(right.record?.finalScore ?? Infinity);
      return scoreDelta || String(left.record?.enterprise?.name || "").localeCompare(String(right.record?.enterprise?.name || ""), "zh-CN");
    });
  }

  function s003FocusAnalysisDetail() {
    if (typeof window.requestAnimationFrame !== "function") return;
    window.requestAnimationFrame(() => {
      document.querySelector(".s003-risk-analysis-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function s003WeakIndicatorSummaries(results) {
    const groups = new Map();
    (results || []).forEach((record) => (record.lowestThree || []).slice(0, 3).forEach((indicator) => {
      const name = indicator.name || "未命名指标";
      const group = groups.get(name) || { name, count: 0, scoreTotal: 0, enterprises: [] };
      group.count += 1;
      group.scoreTotal += Number(indicator.score || 0);
      if (group.enterprises.length < 3) group.enterprises.push(record.enterprise?.name || "未命名企业");
      groups.set(name, group);
    }));
    return [...groups.values()].map((group) => ({ ...group, average: group.count ? group.scoreTotal / group.count : 0 }))
      .sort((left, right) => right.count - left.count || left.average - right.average)
      .slice(0, 6);
  }

  function s003RiskAnalysis(results) {
    const sectorSummaries = s003SectorSummaries(results);
    const weakIndicators = s003WeakIndicatorSummaries(results);
    const selectedSector = s003Dashboard.analysisSector;
    const selectedIndicator = s003Dashboard.analysisIndicator;
    const detailRows = selectedSector
      ? results.filter((record) => (record.enterprise?.sector || "未分类") === selectedSector).map((record) => ({
        record,
        detail: `${record.enterprise?.sector || "未分类"} · ${record.enterprise?.category || "未分类"}`
      }))
      : selectedIndicator
        ? results.filter((record) => (record.lowestThree || []).some((item) => item.name === selectedIndicator)).map((record) => {
          const indicator = (record.lowestThree || []).find((item) => item.name === selectedIndicator);
          return { record, detail: `该指标得分 ${Number(indicator?.score ?? indicator?.indicatorScore ?? 0).toFixed(2)} 分` };
        })
        : [];
    const sortedDetailRows = s003SortDetailRows(detailRows);
    const detailTitle = selectedSector
      ? `${selectedSector}企业明细`
      : selectedIndicator
        ? `${selectedIndicator}涉及企业明细`
        : "选择产业或薄弱指标查看明细";
    return `<div class="section-stack s003-risk-analysis">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">产业风险分布</div><p>按产业查看企业数量、需关注企业数和平均评分；点击产业卡片可下钻到企业明细，明细默认按综合评分升序。</p></div><span class="badge plain">${sectorSummaries.length} 个产业</span></div><div class="panel-body"><div class="s003-sector-grid">${sectorSummaries.map((sector) => s003SectorCard(sector, { selectedSector })).join("")}</div></div></section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">共性薄弱指标</div><p>每家企业取评分最低的 3 项指标，再统计涉及企业数；点击指标查看涉及企业和报告。</p></div><span class="badge plain">最多展示 6 项</span></div><div class="panel-body"><div class="s003-group-weakness">${weakIndicators.length ? weakIndicators.map((item, index) => `<button type="button" class="s003-weak-card ${selectedIndicator === item.name ? "active" : ""}" data-action="s003-select-weak-indicator" data-indicator="${esc(item.name)}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(item.name)}</strong><small>${item.count} 家企业进入各自最低三项 · 平均得分 ${item.average.toFixed(2)}</small></div><b>查看明细</b></button>`).join("") : `<div class="notice"><span>${icon("circle-dashed", "sm")}</span><div><strong>暂无可聚合的共性薄弱指标</strong><span>在建企业固定分批次不补造虚假指标排名。</span></div></div>`}</div></div></section>
      <section class="panel s003-risk-analysis-detail"><div class="panel-head"><div><div class="panel-title">${esc(detailTitle)}</div><p>${selectedSector || selectedIndicator ? "明细与当前运行评分、风险分档和正式报告保持同一 scenarioRunId；以下按综合评分升序。" : "请选择上方一项进行下钻。"}</p></div>${selectedSector || selectedIndicator ? `<button class="btn" type="button" data-action="s003-clear-analysis-selection">返回分析总览</button>` : ""}</div><div class="panel-body flush">${sortedDetailRows.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th>综合评分</th><th>风险分档</th><th>明细口径</th><th>报告</th></tr></thead><tbody>${sortedDetailRows.map(({ record, detail }) => `<tr><td><strong>${esc(record.enterprise?.name)}</strong><small class="table-subline">${esc(record.enterprise?.enterpriseId)}</small></td><td>${esc(record.enterprise?.sector || "未分类")}<small class="table-subline">${esc(record.enterprise?.category || "未分类")}</small></td><td><strong>${Number(record.finalScore).toFixed(2)} 分</strong></td><td>${s003TierBadge(record)}</td><td>${esc(detail)}</td><td><button class="text-link" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(record.enterprise?.enterpriseId)}">查看报告</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><div><h2>还没有选择下钻对象</h2><p>从上方产业卡片或薄弱指标开始查看。</p></div></div>`}</div></section>
    </div>`;
  }

  function s003ReportManagementFocus(content, candidates) {
    const tierId = content?.assessment?.riskTier?.tierId || "UNKNOWN";
    const negativeFactors = (content?.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0);
    const weakest = (content?.keyIndicators || []).slice(0, 3);
    if (content?.assessment?.isUnderConstruction) {
      return {
        headline: "建设期债务风险总体可控，重点保障资金与投产条件",
        guidance: "固定 60 分不代表财务指标逐项良好；应重点核实施工进度、建设资金缺口、融资提款、股东支持、投产条件和投产后运营资金。",
        items: [
          { title: "建设资金与工程节点", detail: "核对未付工程款、未来三个月支付节点、已落实融资和仍需资金，形成可执行的建设资金缺口清单。" },
          { title: "投产条件与收益起点", detail: "核实工程进度、并网或投产审批、预计收入起始和首期运营资金，评估延期或超概算对债务安排的影响。" },
          { title: "核查负向调节因子", detail: negativeFactors.length ? negativeFactors.map((item) => `${item.name}（${item.tierLabel || item.inputValue || "已命中"}，${Number(item.coefficient).toFixed(2)}）`).join("；") : "本轮无负向调节因子；继续核对企业人工输入版本。" },
          { title: "保持版本与重跑纪律", detail: "企业因子或模型配置变化后，先形成新输入或 Published 版本，再创建新的 scenarioRunId 重跑；历史报告和行动证据不覆盖。" }
        ]
      };
    }
    const headline = ({
      GREEN: "常态监测与薄弱指标改善",
      YELLOW: "预防性跟踪与风险源核查",
      RED: "专项处置与流动性风险压降",
      BLACK: "应急响应与违约风险防控"
    })[tierId] || "债务风险持续监测";
    const items = [
      {
        title: "优先改善低分指标",
        detail: weakest.length ? weakest.map((item) => `${item.name} ${Number(item.score || 0).toFixed(2)} 分`).join("；") : "在建企业本轮适用固定 60 分语义，未形成 15 项指标排序。"
      },
      {
        title: "核查负向调节因子",
        detail: negativeFactors.length ? negativeFactors.map((item) => `${item.name}（${item.tierLabel || item.inputValue || "已命中"}，${Number(item.coefficient).toFixed(2)}）`).join("；") : "本轮无负向调节因子；继续核对企业人工输入版本。"
      },
      {
        title: "跟踪分档预警行动",
        detail: candidates?.length ? candidates.map((candidate) => `${s003CandidateTierLabel(candidate)}：${candidate.displayStatus}`).join("；") : "本轮为绿灯，不形成预警行动；报告生成不会自动创建 Action Request 或负责人待办。"
      },
      {
        title: "保持版本与重跑纪律",
        detail: "企业因子或模型配置变化后，先形成新输入/Published 版本，再创建新的 scenarioRunId 重跑；历史报告和行动证据不覆盖。"
      }
    ];
    return { headline, guidance: s003TierGuidance(tierId), items };
  }

  // 正式报告 v9 的事实保持只读；阅读器在展示层将通用口号补充为
  // “对象 + 责任角色 + 时限/频率 + 形成证据”的确定性执行建议。
  // 不凭空生成金额目标，金额和阈值仍要求企业在台账中确认。
  function s003ConcreteReportStrategy(content, candidates) {
    const tierId = content?.assessment?.riskTier?.tierId || "UNKNOWN";
    const enterpriseName = content?.enterprise?.name || "本企业";
    const details = new Map((content?.indicatorDetails || []).map((item) => [item.name, item]));
    const negativeFactors = (content?.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0);
    const keyIndicators = (content?.keyIndicators || []).slice(0, 3);
    const isConstruction = Boolean(content?.assessment?.isUnderConstruction);
    const indicatorActions = {
      "应收账款周转率": ["5 个工作日内由财务负责人导出应收账龄表，列出前十大客户、逾期金额和预计回款日。", "每周回填回款兑现率；证据为账龄表、催收记录和回款流水，连续两周未兑现时提交亮灯预警复核。"],
      "现金比率": ["3 个工作日内由资金负责人核对未来 90 天到期债务、受限资金和可动用现金，形成缺口表。", "按周更新缺口金额和资金来源；证据为到期债务清单、授信余额表和资金计划。"],
      "现金流动负债比率": ["5 个工作日内由资金负责人拆解经营现金流与流动负债覆盖缺口，标注近期到期负债。", "每月复核覆盖率和回款兑现情况；证据为现金流预测、负债到期表和回款台账。"],
      "利息保障倍数": ["5 个工作日内由融资负责人核对利息支出、融资成本和到期结构，形成降本/置换清单。", "按月跟踪利息覆盖变化；证据为融资合同、利息支付表和置换方案。"],
      "资产负债率": ["10 个工作日内由财务负责人拆分有息负债、期限和集中到期风险，形成杠杆压降清单。", "按月复核新增负债和资本补充进展；证据为负债结构表、资本安排和审批记录。"],
      "股东权益同比增长率": ["10 个工作日内由财务负责人核对亏损、分红、减值和资本投入对权益变动的贡献。", "形成资本补充/分红约束结论；证据为权益变动表、董事会决议和资本安排。"],
      "盈利稳定性": ["5 个工作日内由经营负责人核对近三年利润波动原因，并补充未来三个月利润与现金流预测。", "按月比较预测与实际偏差；证据为利润桥、经营计划和滚动预测表。"],
      "销售毛利率": ["5 个工作日内由经营负责人拆解价格、产量、成本和结算偏差，形成毛利改善清单。", "按月跟踪毛利和成本兑现；证据为毛利桥、采购/销售台账和结算差异表。"],
      "总资产收益率": ["10 个工作日内由经营负责人识别低效、闲置和未形成收益的资产，形成盘活或退出清单。", "按月回填资产利用率和收益改善；证据为资产清单、盘活计划和处置回执。"],
      "总资产周转率": ["10 个工作日内由经营负责人拆分低周转资产和收入贡献，明确盘活责任单元。", "按月复核周转率与收入变化；证据为资产利用率表和经营收入台账。"],
      "净资产收益率": ["10 个工作日内由财务负责人核对利润、净资产和资本投入匹配关系，明确回报改善路径。", "按月跟踪利润与权益变化；证据为权益变动表、利润计划和资本安排。"],
      "营业利润率": ["5 个工作日内由经营负责人拆解主营利润、期间费用和减值损失，形成费用压降清单。", "按月复核营业利润率和费用兑现；证据为利润表、费用明细和改善台账。"],
      "净利润": ["5 个工作日内由经营负责人拆解主营、财务费用和非经常性损益，确认利润下滑来源。", "按月跟踪利润与现金流预测偏差；证据为利润桥、费用表和经营计划。"],
      "经营活动产生的现金流入": ["5 个工作日内由资金负责人核对应收回款、结算周期和大额回款节点。", "按周跟踪回款兑现率；证据为回款计划、客户对账单和银行流水。"]
    };
    const factorActions = {
      "融资能力（已用授信余额/授信总额）": "5 个工作日内由融资负责人列出已用授信、可用额度、到期融资、成本和续贷/置换安排，证据为授信余额表和融资台账。",
      "资金余缺预警": "3 个工作日内由资金负责人形成未来 90 天逐笔资金缺口表，列明到期债务、回款、授信和应急来源，按周回填。",
      "是否存在重大诉讼": "5 个工作日内由法务负责人形成诉讼标的、预计损失、保全措施和资金影响清单，证据为诉讼台账和法务意见。",
      "担保情况": "10 个工作日内由法务与财务负责人核对对外担保余额、被担保方偿债能力和追偿条件，证据为担保台账。",
      "总部支持程度": "10 个工作日内由财务公司接口人核实支持承诺、金额、触发条件和可执行时间，证据为支持函或会议纪要。",
      "电价波动率": "5 个工作日内由经营负责人核对电价变化、结算偏差和收入敏感性，形成现金流情景测算，证据为结算表和测算底稿。"
    };
    const indicatorStrategies = isConstruction ? [] : keyIndicators.map((item) => {
      const detail = details.get(item.name) || item;
      const pair = indicatorActions[item.name] || [`5 个工作日内由财务负责人核实 ${item.name} 的数据口径、形成原因和责任环节。`, `按月回填改善结果；证据为 ${item.name} 明细表、责任清单和复核记录。`];
      return { ...item, target: item.name, currentScore: item.score, actions: [`当前得分 ${Number(item.score || 0).toFixed(2)} 分；实际值 ${s003ReportIndicatorValue(detail, content.assessment)}。`, ...pair] };
    });
    const factorStrategies = negativeFactors.map((factor) => ({
      ...factor,
      target: factor.name,
      actions: [factorActions[factor.name] || `5 个工作日内由财务公司接口人核实${factor.name}取值、档位和对评分的影响，形成责任清单与证据定位。`]
    }));
    const tierLabel = ({ GREEN: "绿灯", YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯" })[tierId] || "当前分档";
    const focusNames = isConstruction ? "建设资金缺口、工程节点和投产条件" : keyIndicators.map((item) => item.name).join("、") || "最低关注指标";
    const actionLine = candidates?.length ? `本轮 ${tierLabel} 已形成 ${candidates.length} 条亮灯预警候选，核对后由集团债务风险管理人员提交至对应成员单位接口人。` : "本轮未形成亮灯预警候选，仍需按月保留监测证据。";
    const guidance = isConstruction
      ? `${enterpriseName}采用在建企业固定 60 分语义，不代表财务指标逐项良好。5 个工作日内先核实${focusNames}，形成建设资金缺口表、工程节点清单和融资提款证据；按月更新，重大变化再进入亮灯行动。`
      : `${enterpriseName}本轮为${tierLabel}，综合分 ${Number(content?.assessment?.finalScore || 0).toFixed(2)}。优先处理${focusNames}；5 个工作日内由财务/资金负责人形成责任清单和首版证据，按周或按月回填改善结果。${actionLine}`;
    const managementPortfolios = isConstruction ? [
      { code: "A", title: "建设资金与工程节点", summary: "把未付工程款、未来 90 天支付节点和已落实融资放在同一缺口表中。", actions: ["责任角色：项目公司财务负责人；时限：5 个工作日内；证据：工程款清单、资金计划、融资提款回执。", "频率：每月更新支付完成率；延期或缺口扩大时提交亮灯预警复核。"] },
      { code: "B", title: "投产条件与运营资金", summary: "核对并网/投产审批、预计收入起始和首期运营资金。", actions: ["责任角色：项目负责人；时限：10 个工作日内；证据：工程进度、审批文件、投产计划。", "频率：按月更新投产条件和运营资金缺口。"] },
      { code: "C", title: "融资与股东支持", summary: "把提款条件、总部支持承诺和可执行时间落到台账。", actions: ["责任角色：融资负责人；时限：10 个工作日内；证据：授信合同、支持函、提款计划。", "未落实安排不得作为已解决依据，需保留待确认状态。"] }
    ] : [
      { code: "A", title: "本企业流动性与偿债安排", summary: `围绕${negativeFactors.some((item) => item.name.includes("资金")) ? "资金余缺预警、现金流和到期债务" : "现金流、到期债务和可动用资源"}建立未来 90 天滚动视图。`, actions: ["责任角色：资金负责人；时限：3 个工作日内形成首版缺口表；证据：到期债务、回款、授信和受限资金清单。", "频率：每周更新；缺口扩大或回款逾期时提交对应亮灯预警。"] },
      { code: "B", title: "本企业融资、担保与诉讼", summary: negativeFactors.length ? `本轮负向因子：${negativeFactors.map((item) => `${item.name}（${Number(item.coefficient).toFixed(2)}）`).join("、")}，需联合核实。` : "本轮未命中负向调节因子，继续保留人工输入证据。", actions: ["责任角色：融资/法务负责人；时限：5 个工作日内完成授信、担保和诉讼台账核对。", "证据：授信余额表、担保台账、诉讼台账及未兑现安排；重大变化按亮灯提交。"] },
      { code: "C", title: "低分指标改善", summary: `当前优先指标：${focusNames}；建议先改善事实，不以分数变化替代业务整改。`, actions: ["责任角色：经营负责人；时限：5 个工作日内确认责任环节和基线值。", "频率：按月复核实际值与得分变化；证据：指标明细、改善台账和复核记录。"] },
      { code: "D", title: "复评与证据留存", summary: "输入或模型变化后用新运行验证改善，历史报告和行动证据保持只读。", actions: ["责任角色：成员单位接口人；时限：每月复核，重大变化即时上报。", "证据：新 T053 输入快照、Published 模型版本、scenarioRunId 和对比报告。"] }
    ];
    const threeMonthActionPlan = isConstruction ? [
      { period: "第 1 月 / 5 个工作日内", objective: "核实建设资金与工程节点", actions: "形成未付工程款、未来 90 天支付节点、已落实融资和资金缺口清单；责任角色：项目公司财务负责人。" },
      { period: "第 2 月 / 按月", objective: "跟踪投产条件与提款安排", actions: "回填工程进度、并网/投产审批、融资提款和运营资金准备情况；证据归档到项目台账。" },
      { period: "第 3 月 / 新运行", objective: "复评建设风险与偿债安排", actions: "使用新输入或新 Published 模型创建 scenarioRunId 重跑；历史报告和行动状态不覆盖。" }
    ] : [
      { period: "第 1 月 / 5 个工作日内", objective: "核实低分指标与负向因子", actions: `围绕${focusNames}${negativeFactors.length ? `及${negativeFactors.map((item) => item.name).join("、")}` : ""}形成责任清单、基线值和证据定位；责任角色：财务/经营负责人。` },
      { period: "第 2 月 / 每周或每月", objective: "跟踪资金与经营改善", actions: "按周更新资金缺口和回款，按月更新利润、成本、融资、诉讼或担保措施；记录已完成事项、剩余缺口和证据。" },
      { period: "第 3 月 / 新运行", objective: "复评风险是否回落", actions: "在新输入或新 Published 模型具备后创建新的 scenarioRunId，对比评分、亮灯和行动状态；不重放历史副作用。" }
    ];
    return { headline: `${tierLabel} · ${isConstruction ? "建设资金与投产条件" : "本企业可执行改善"}`, guidance, indicatorStrategies, factorStrategies, managementPortfolios, threeMonthActionPlan };
  }

  function s003ResultRows() {
    const results = s003Dashboard.resources?.results?.results || [];
    const keyword = s003Dashboard.searchTerm.trim().toLowerCase();
    const rows = results.filter((record) => {
      if (s003Dashboard.riskFilter !== "ALL" && s003Tier(record) !== s003Dashboard.riskFilter) return false;
      if (!keyword) return true;
      return [record.enterprise?.name, record.enterprise?.enterpriseId, record.enterprise?.sector, record.enterprise?.category]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    }).slice();
    const [field, direction] = s003Dashboard.sortKey.split("-");
    const multiplier = direction === "desc" ? -1 : 1;
    return rows.sort((left, right) => {
      if (field === "name") return String(left.enterprise?.name || "").localeCompare(String(right.enterprise?.name || ""), "zh-CN") * multiplier;
      if (field === "risk") return (s003TierOrder(left) - s003TierOrder(right)) * multiplier;
      return (Number(left.finalScore || 0) - Number(right.finalScore || 0)) * multiplier;
    });
  }

  // Keep the dashboard's "最低指标" column truthful even when an older
  // Published result set omitted lowestThree for a construction enterprise.
  // Construction scoring is intentionally fixed at 60 and does not rank
  // indicators; render that semantic explicitly instead of leaving a blank
  // cell or inventing a weak-indicator ranking.  For ordinary enterprises,
  // tolerate a missing projection by deriving the display-only fallback from
  // the already published indicator results (never recalculating scores).
  function s003LowestMetricDisplay(record) {
    const lowest = Array.isArray(record?.lowestThree) ? record.lowestThree.filter(Boolean) : [];
    if (lowest.length) {
      return lowest.slice(0, 3).map((item) => `${esc(item.name)}（${Number(item.score ?? item.indicatorScore ?? 0).toFixed(2)} 分）`).join("、");
    }
    if (record?.enterprise?.category === "在建企业") {
      return "—";
    }
    const indicators = Array.isArray(record?.indicatorResults)
      ? record.indicatorResults
      : Array.isArray(record?.metrics) ? record.metrics : [];
    return indicators
      .filter((item) => item && Number.isFinite(Number(item.score ?? item.indicatorScore)))
      .slice()
      .sort((left, right) => Number(left.score ?? left.indicatorScore) - Number(right.score ?? right.indicatorScore))
      .slice(0, 3)
      .map((item) => `${esc(item.name || item.metricName || "指标")}（${Number(item.score ?? item.indicatorScore).toFixed(2)} 分）`)
      .join("、") || "—";
  }

  function s003ReportWeakDisplay(content, weak) {
    if (content?.assessment?.isUnderConstruction) return "—";
    return (weak || []).map((item) => `${esc(item.name)}（${Number(item.score ?? item.indicatorScore ?? 0).toFixed(2)} 分）`).join("、") || "本轮无单独弱项标签";
  }

  function s003TierOrder(record) {
    return ({ BLACK: 0, RED: 1, YELLOW: 2, GREEN: 3 })[s003Tier(record)] ?? 9;
  }

  function s003ReportFor(enterpriseId) {
    return (s003Dashboard.resources?.reportContents?.reports || []).find((report) => report.content?.enterprise?.enterpriseId === enterpriseId) || null;
  }

  function s003EvidenceByType(content, evidenceType) {
    return (content?.evidenceReferences || []).find((evidence) => evidence.evidenceType === evidenceType) || null;
  }

  function s003ModelConfigurationAhead(resources = s003Dashboard.resources) {
    return Boolean(s003ConfigurationDeltaForResources(resources).ahead);
  }

  function s003ActionTypeMeta(actionTypeId) {
    const resources = s003Dashboard.resources || s003Dashboard.staticResources || {};
    const catalog = resources.actionTypeCatalog || null;
    const item = catalog?.lifecycleStatus === "published"
      ? (catalog.actionTypes || []).find((entry) => entry.actionTypeId === actionTypeId)
      : null;
    const publishedDescription = item ? item.description : null;
    const requiresHumanConfirmation = item ? item.requiresHumanConfirmation : null;
    if (!item || !item.displayName || !item.description) {
      return {
        label: `${actionTypeId || "未分类 Action Type"}（展示定义缺失）`,
        description: "M01 Published Action Type 未提供 displayName / description，当前仅保留技术标识并阻断业务文案回退。",
        tone: "danger",
        published: false
      };
    }
    const tone = /黑灯|红灯|重大|应急/.test(`${item.displayName} ${item.triggerSummary || ""}`)
      ? "danger"
      : /黄灯|跟踪/.test(`${item.displayName} ${item.triggerSummary || ""}`) ? "warning" : "plain";
    const trigger = String(item.triggerSummary || "").trim();
    const tier = trigger.match(/黄灯|红灯|黑灯/)?.[0] || "风险分档";
    const description = `${tier}按亮灯形成一条预警候选；集团债务风险管理人员从驾驶舱显式提交后送达对应成员单位接口人（债务风险）。`;
    const managementHint = "接口人核实预警依据并选择本单位负责人后，沿用通用决策中心形成负责人待办；不经过集团集中收件，不启动多级审批。";
    return {
      label: item.displayName,
      tierLabel: tier ? `${tier}预警` : item.displayName,
      description,
      sourceDescription: publishedDescription,
      requiresHumanConfirmation: requiresHumanConfirmation !== false,
      managementHint,
      tone,
      published: true
    };
  }

  // 行动入口按风险灯展示，Action Type 仅作为底层合同标识保留在证据和详情中。
  // 这样用户先理解“哪一盏灯需要处理”，不会被一期内部的三种处置名词分散注意力。
  function s003TierActionLabel(tierId) {
    return ({ YELLOW: "黄灯预警", RED: "红灯预警", BLACK: "黑灯预警" })[String(tierId || "").toUpperCase()] || "风险预警";
  }

  function s003CandidateTierLabel(candidate) {
    return s003TierActionLabel(candidate?.riskTier || candidate?.trigger?.tierId);
  }

  function s003RiskActionGuidance(tierId) {
    return ({
      YELLOW: { tone: "yellow", detail: "以风险防范为主：持续跟踪薄弱指标、资金安排和改善进展，防止风险升级。" },
      RED: { tone: "red", detail: "以风险处置为主：核实风险成因和处置进度，重点关注风险外溢及对其他成员单位的影响。" },
      BLACK: { tone: "black", detail: "立即成立风险专项小组：快速核实事实、明确处置负责人和时限，立即开展风险处置并控制风险扩散。" }
    })[String(tierId || "").toUpperCase()] || { tone: "neutral", detail: "按当前风险灯核对事实并记录处理进展。" };
  }

  function s003DecisionInboxRequests(resources = s003Dashboard.resources) {
    const context = s003ResourceContext(resources);
    const staticRequests = sameScenarioContext(normalizeScenarioContext(resources?.decisionInbox?.scenarioIdentity || {}), context)
      ? resources.decisionInbox.requests || []
      : [];
    const liveRequests = OWNERS.decision.listInboxRequests?.() || [];
    const byId = new Map();
    [...staticRequests, ...liveRequests].forEach((request) => {
      const requestContext = normalizeScenarioContext(request?.scenarioContext || request?.scenarioIdentity || {});
      const requestId = request?.requestId || request?.id || null;
      if (!requestId || !sameScenarioContext(requestContext, context)) return;
      byId.set(requestId, clone(request));
    });
    return [...byId.values()];
  }

  function s003DecisionSummaries(resources = s003Dashboard.resources) {
    const context = s003ResourceContext(resources);
    return (OWNERS.decision.listScenarioSummaries?.() || [])
      .filter((summary) => sameScenarioContext(normalizeScenarioContext(summary?.scenarioContext || {}), context));
  }

  function s003RiskActionTypeForTier(tierId, resources = s003Dashboard.resources) {
    const tierName = ({ YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯" })[String(tierId || "").toUpperCase()] || null;
    if (!tierName) return null;
    return (resources?.actionTypeCatalog?.actionTypes || []).find((item) => {
      const summary = String(item?.triggerSummary || "");
      return summary.includes(tierName) && summary.includes("风险分档");
    }) || null;
  }

  function s003MemberUnitDecisionRoute(candidate, resources = s003Dashboard.resources) {
    const enterpriseId = candidate?.enterpriseId || candidate?.enterprise?.enterpriseId || "UNKNOWN";
    const enterpriseName = candidate?.enterpriseName || candidate?.enterprise?.name || "对应成员单位";
    const configured = (resources?.enterpriseContactRouting?.routes || []).find((item) => item.enterpriseId === enterpriseId) || null;
    if (!configured?.memberUnitId || !configured?.memberUnitName || !configured?.decisionRecipient?.recipientId || !configured?.decisionRecipient?.recipientName) {
      return {
        routeConfigured: false,
        enterpriseId,
        routingTarget: null,
        decisionRecipient: null,
        recipientRole: null,
        recipientName: null,
        recipientId: null,
        recommendedTaskOwner: `${enterpriseName}债务风险责任人`,
        recommendedTaskOwnerId: `${enterpriseId}-DEBT-RISK-OWNER`
      };
    }
    const decisionRecipient = {
      enterpriseId,
      memberUnitId: configured.memberUnitId,
      memberUnitName: configured.memberUnitName,
      recipientId: configured.decisionRecipient.recipientId,
      recipientName: configured.decisionRecipient.recipientName,
      role: configured.decisionRecipient.role || "成员单位债务风险接口人"
    };
    return {
      routeConfigured: true,
      routingTarget: {
        type: "member-unit-decision-center",
        organizationId: decisionRecipient.memberUnitId,
        organizationName: decisionRecipient.memberUnitName
      },
      decisionRecipient,
      recipientRole: decisionRecipient.role,
      recipientName: decisionRecipient.recipientName,
      recipientId: decisionRecipient.recipientId,
      recommendedTaskOwner: `${enterpriseName}债务风险责任人`,
      recommendedTaskOwnerId: `${enterpriseId}-DEBT-RISK-OWNER`
    };
  }

  function s003ActionRequestId(candidate) {
    return `AR-${candidate.candidateId}`;
  }

  function s003RequestTargetsMemberUnit(request, candidate) {
    if (!request || !candidate) return false;
    const expected = s003MemberUnitDecisionRoute(candidate);
    if (!expected.routeConfigured) return false;
    const target = request.routingTarget || {};
    const recipient = request.decisionRecipient || request.recipient || {};
    const recipientId = recipient.recipientId || recipient.id || request.recipientId || null;
    const recipientRole = recipient.role || request.recipientRole || null;
    const recipientName = recipient.recipientName || recipient.name || request.recipientName || null;
    const organizationId = recipient.memberUnitId || target.organizationId || request.subjectId || request.enterpriseId;
    return (recipient.enterpriseId || request.subjectId || request.enterpriseId) === candidate.enterpriseId
      && organizationId === expected.decisionRecipient.memberUnitId
      && (recipientId === expected.recipientId
        || (recipientRole === expected.recipientRole && recipientName === expected.recipientName));
  }

  function s003RiskTierCandidateRecords(resources, decision) {
    const sourceCandidates = decision?.candidatesBeforeConfirmation || [];
    const sourceByKey = new Map(sourceCandidates.filter((candidate) => candidate?.trigger?.type === "RISK_TIER")
      .map((candidate) => [`${candidate.enterpriseId}|${candidate.actionTypeId}`, candidate]));
    const context = s003ResourceContext(resources);
    return (resources?.results?.results || []).map((record) => {
      const tierId = s003Tier(record);
      if (!["YELLOW", "RED", "BLACK"].includes(tierId)) return null;
      const actionType = s003RiskActionTypeForTier(tierId, resources);
      if (!actionType) return null;
      const inlineCandidate = (record.dispositionCandidates || []).find((candidate) => candidate?.trigger?.type === "RISK_TIER"
        && candidate.actionTypeId === actionType.actionTypeId) || null;
      const source = sourceByKey.get(`${record.enterprise?.enterpriseId}|${actionType.actionTypeId}`) || inlineCandidate || {};
      const candidateId = source.candidateId || `S003-CAND-${context.scenarioRunId}-${record.enterprise?.enterpriseId}-${actionType.actionTypeId}-${record.assessmentAt}-${record.resultVersion || "runtime-preview"}`;
      const candidate = {
        ...clone(source),
        candidateId,
        actionTypeId: actionType.actionTypeId,
        status: source.status || "CANDIDATE_AWAITING_HUMAN_CONFIRMATION",
        requiresHumanConfirmation: true,
        trigger: { type: "RISK_TIER", tierId, tierName: s003TierName(record) },
        scenarioIdentity: clone(record.scenarioIdentity || context),
        enterpriseId: record.enterprise?.enterpriseId,
        enterpriseName: record.enterprise?.name,
        sector: record.enterprise?.sector,
        category: record.enterprise?.category,
        riskTier: tierId,
        riskTierName: s003TierName(record),
        finalScore: record.finalScore,
        sourceResultId: record.resultId,
        sourceResultVersion: record.resultVersion,
        assessmentAt: record.assessmentAt,
        actionRequestId: source.actionRequestId || null,
        todoId: source.todoId || null,
        autoCreateActionRequest: false,
        autoCreateTodo: false
      };
      return { ...candidate, ...s003MemberUnitDecisionRoute(candidate) };
    }).filter(Boolean);
  }

  function s003RiskTierDispositionCandidates(candidates) {
    return (candidates || []).filter((candidate) => candidate?.trigger?.type === "RISK_TIER"
      && ["YELLOW", "RED", "BLACK"].includes(String(candidate?.trigger?.tierId || candidate?.riskTier || "").toUpperCase()));
  }

  function s003FormationState(candidate, confirmed) {
    const isConfirmed = confirmed?.candidateId === candidate.candidateId && confirmed?.created === true;
    const routeValid = !isConfirmed || s003RequestTargetsMemberUnit(confirmed?.actionRequest, candidate);
    if (isConfirmed && confirmed?.todo?.todoId) return {
      code: "TODO_CREATED", label: "已转负责人待办", tone: "success",
      requestId: confirmed.actionRequest?.actionRequestId || null,
      taskId: confirmed.todo.todoId,
      owner: confirmed.todo.owner || confirmed.actionRequest?.owner || null,
      source: "report-formation",
      routeValid
    };
    if (isConfirmed && confirmed?.actionRequest?.actionRequestId) return {
      code: "REQUEST_CREATED", label: "行动申请已形成", tone: "success",
      requestId: confirmed.actionRequest.actionRequestId,
      taskId: null,
      owner: confirmed.actionRequest.owner || null,
      source: "report-formation",
      routeValid
    };
    return { code: "PENDING_SUBMISSION", label: "待提交行动申请", tone: "warning", requestId: null, taskId: null, owner: null, source: "report-formation", routeValid: true };
  }

  function s003WorkflowStatusLabel(value, fallback = "状态待更新") {
    const normalized = String(value || "").trim();
    const labels = {
      pending: "待负责人处理",
      assigned: "待负责人处理",
      awaiting: "待决策",
      accepted: "已接收",
      submitted: "已提交",
      confirmed: "已处理",
      completed: "已完成",
      closed: "已关闭",
      rejected: "已退回"
    };
    return labels[normalized.toLowerCase()] || normalized || fallback;
  }

  function s003DecisionStateSourceLabel(value) {
    return ({
      C011: "行动申请入口（C011）",
      C019: "决策中心回读（C019）",
      "report-formation": "报告形成时快照",
      "legacy-group-route": "既有集团统一接收记录"
    })[value] || value || "报告形成时快照";
  }

  function s003CurrentDecisionState(candidate, formationState, inboxRequests, summaries) {
    const expectedRequestId = s003ActionRequestId(candidate);
    const matchingRequests = inboxRequests.filter((item) => item.sourceCandidateId === candidate.candidateId
      || item.candidateId === candidate.candidateId
      || item.id === expectedRequestId
      || item.requestId === expectedRequestId);
    const request = matchingRequests.find((item) => s003RequestTargetsMemberUnit(item, candidate)) || matchingRequests[0] || null;
    const requestId = request?.requestId || request?.id || formationState.requestId || null;
    const matchingSummaries = summaries.filter((item) => item.sourceCandidateId === candidate.candidateId
      || item.candidateId === candidate.candidateId
      || item.requestId === expectedRequestId
      || item.sourceRequestId === expectedRequestId);
    const summary = matchingSummaries.find((item) => requestId && (item.requestId === requestId || item.sourceRequestId === requestId))
      || matchingSummaries.find((item) => item.requestId === expectedRequestId || item.sourceRequestId === expectedRequestId)
      || null;
    const candidateMatchesRequest = !request || ((request.subjectId || request.enterpriseId) === candidate.enterpriseId
      && (request.actionType?.id || request.actionTypeId) === candidate.actionTypeId);
    if (!candidateMatchesRequest) return {
      code: "STATE_MISMATCH", label: "决策记录身份错配", tone: "danger", requestId, taskId: summary?.taskId || null,
      owner: request?.owner || null, source: "C011", valid: false,
      reason: "Action Request 的企业或 Action Type 与风险候选不一致"
    };
    const routeMatchesRequest = !request || s003RequestTargetsMemberUnit(request, candidate);
    if (!routeMatchesRequest || (!request && formationState.routeValid === false)) return {
      code: "ROUTING_MISMATCH", label: "待按成员单位接口人重新提交", tone: "warning", requestId: null, taskId: null,
      owner: null, source: "legacy-group-route", valid: false, resubmittable: true,
      legacyRequestId: requestId,
      reason: "既有记录由集团统一接收，未路由到对应成员单位债务风险接口人"
    };
    if (summary?.taskId || (formationState.routeValid !== false && formationState.taskId)) return {
      code: "TODO_CREATED", label: s003WorkflowStatusLabel(summary?.taskStatus, "已分办负责人待办"), tone: "success",
      requestId: summary?.requestId || summary?.sourceRequestId || requestId,
      taskId: summary?.taskId || (formationState.routeValid !== false ? formationState.taskId : null),
      owner: request?.owner || (formationState.routeValid !== false ? formationState.owner : null),
      source: summary?.taskId ? "C019" : formationState.source,
      valid: true
    };
    if (summary?.decisionStatus) return {
      code: "DECIDED", label: s003WorkflowStatusLabel(summary.requestStatus, "接口人已确认"), tone: "success",
      requestId: summary.requestId || summary.sourceRequestId || requestId,
      taskId: null, owner: request?.owner || formationState.owner || null, source: "C019", valid: true
    };
    if (summary?.requestId || summary?.sourceRequestId) return {
      code: "REQUEST_ACCEPTED", label: summary.reminderStatus === "待决策" ? "待成员单位接口人确认" : s003WorkflowStatusLabel(summary.actionRequestStatus || summary.status, "成员单位已接收"),
      tone: "warning", requestId: summary.requestId || summary.sourceRequestId, taskId: null,
      owner: request?.owner || null, source: "C019", valid: true
    };
    if (request) return {
      code: "REQUEST_SUBMITTED", label: request.requestGate?.status === "accepted" ? "已送达成员单位接口人 · 待确认" : "已送达成员单位接口人",
      tone: "warning", requestId, taskId: request.taskId || null, owner: request.owner || null, source: "C011", valid: true
    };
    return { ...formationState, valid: true };
  }

  function s003DecisionCandidates(resources = s003Dashboard.resources) {
    const decision = resources?.decisionResults || {};
    const decisionContext = normalizeScenarioContext(decision?.scenarioIdentity || decision?.confirmedDecision?.scenarioIdentity || {});
    const resourceContext = s003ResourceContext(resources);
    const decisionMatchesContext = sameScenarioContext(decisionContext, resourceContext);
    const confirmed = decisionMatchesContext ? decision.confirmedDecision || null : null;
    const inboxRequests = s003DecisionInboxRequests(resources);
    const summaries = s003DecisionSummaries(resources);
    return s003RiskTierCandidateRecords(resources, decisionMatchesContext ? decision : {}).map((candidate) => {
      const formationState = s003FormationState(candidate, confirmed);
      const currentState = s003CurrentDecisionState(candidate, formationState, inboxRequests, summaries);
      const currentRequestId = currentState.valid === false ? null : currentState.requestId || null;
      return {
        ...clone(candidate),
        confirmed: ["REQUEST_CREATED", "REQUEST_SUBMITTED", "REQUEST_ACCEPTED", "DECIDED", "TODO_CREATED"].includes(currentState.code),
        formationState,
        currentState,
        actionRequestId: currentRequestId || (formationState.routeValid === false ? null : formationState.requestId || null),
        todoId: currentState.valid === false ? null : currentState.taskId || formationState.taskId || null,
        owner: currentState.owner || formationState.owner || null,
        displayStatus: currentState.label
      };
    });
  }

  function s003ActionTierRank(candidate) {
    return ({ BLACK: 0, RED: 1, YELLOW: 2, GREEN: 3 })[String(candidate?.riskTier || candidate?.trigger?.tierId || "").toUpperCase()] ?? 9;
  }

  function s003SortedActionCandidates(candidates = []) {
    return candidates.slice().sort((left, right) => {
      const tier = s003ActionTierRank(left) - s003ActionTierRank(right);
      if (tier) return tier;
      const score = Number(left?.finalScore ?? Infinity) - Number(right?.finalScore ?? Infinity);
      return score || String(left?.enterpriseName || "").localeCompare(String(right?.enterpriseName || ""), "zh-CN");
    });
  }

  function s003ActionProgressDrawer(resources = s003Dashboard.resources) {
    const requestId = s003Dashboard.actionDrawerRequestId;
    if (!requestId) return "";
    const candidates = s003SortedActionCandidates(s003DecisionCandidates(resources));
    const candidate = candidates.find(item => item.actionRequestId === requestId || item.candidateId === requestId);
    if (!candidate) return "";
    const request = s003DecisionInboxRequests(resources).find(item => item.requestId === requestId || item.id === requestId) || null;
    const summaries = s003DecisionSummaries(resources);
    const summary = summaries.find(item => item.requestId === requestId || item.sourceRequestId === requestId || item.candidateId === candidate.candidateId) || null;
    const route = s003MemberUnitDecisionRoute(candidate);
    const state = candidate.currentState || {};
    const status = s003CandidateDisplayStatus(candidate, s003ContextState(resources));
    const flow = [
      { label: "驾驶舱提交", value: candidate.actionRequestId ? "已提交行动申请" : "尚未提交", done: Boolean(candidate.actionRequestId) },
      { label: "成员单位接口人确认", value: state.code === "DECIDED" || state.code === "TODO_CREATED" ? "已确认" : "待确认", done: ["DECIDED", "TODO_CREATED"].includes(state.code) },
      { label: "负责人待办", value: candidate.todoId ? (summary?.taskStatus || "已形成") : "确认后形成", done: Boolean(candidate.todoId) }
    ];
    const report = s003ReportFor(candidate.enterpriseId)?.content;
    return `<div class="s003-action-drawer-backdrop" data-action="s003-close-action-drawer"></div><aside class="s003-action-drawer" role="dialog" aria-label="行动进展"><header><div><span>风险行动</span><h2>${esc(candidate.enterpriseName)}</h2><p>${esc(s003CandidateTierLabel(candidate))} · ${Number(candidate.finalScore).toFixed(2)} 分</p></div><button class="icon-button" type="button" data-action="s003-close-action-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="s003-action-drawer-body"><section class="s003-action-drawer-status"><div><span>当前状态</span><strong>${badge(status.label, status.tone)}</strong></div><div><span>成员单位接口人</span><strong>${esc(route.recipientName)}</strong></div><div><span>建议分办负责人</span><strong>${esc(route.recommendedTaskOwner)}</strong></div><div><span>行动申请</span><strong class="mono">${esc(candidate.actionRequestId || request?.requestId || "未形成")}</strong></div></section><section><h3>行动流转</h3><div class="s003-action-flow">${flow.map(item => `<div class="${item.done ? "done" : "pending"}"><i>${item.done ? "✓" : "·"}</i><span><strong>${item.label}</strong><small>${item.value}</small></span></div>`).join("")}</div></section><section><h3>亮灯依据</h3><p class="s003-action-drawer-copy">${esc(s003CandidateTriggerText(candidate))}；正式评分 ${Number(candidate.finalScore).toFixed(2)} 分。风险处置按亮灯等级推进，评分和正式报告均来自当前 scenarioRunId。</p></section>${report ? `<button class="btn" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(candidate.enterpriseId)}">查看企业报告</button>` : ""}</div></aside>`;
  }

  function s003CandidateTriggerText(candidate) {
    if (candidate?.trigger?.type === "MAJOR_FACTOR") return (candidate.trigger.factors || []).join("、") || "重大调节因子";
    if (candidate?.trigger?.type === "RISK_TIER") return `${candidate.trigger.tierName || candidate.riskTierName || "风险分档"}触发`;
    return candidate?.trigger?.type || "已发布触发条件";
  }

  function s003CandidateDisplayStatus(candidate, contextState = s003ContextState()) {
    if (!contextState?.isCurrent) {
      const formationLabel = candidate?.formationState?.label || s003ContentCandidateStatus(candidate);
      return { label: `历史记录 · ${formationLabel}`, tone: "plain" };
    }
    if (contextState?.projectionOnly) return { label: "本次评估批次", tone: "warning" };
    const currentState = candidate?.currentState || { label: "待提交", tone: "warning" };
    return {
      ...currentState,
      label: s003WorkflowStatusLabel(currentState.label || currentState.status, "状态待更新")
    };
  }

  function s003ContentCandidateStatus(candidate) {
    return ({
      CANDIDATE_AWAITING_HUMAN_CONFIRMATION: "待提交行动申请",
      ACTION_REQUEST_SUBMITTED: "行动申请已提交",
      CONFIRMED_TO_OWNER_TODO: "已转负责人待办",
      OWNER_TODO_IN_PROGRESS: "负责人办理中",
      CLOSED: "已关闭",
      RESOLVED: "已完成"
    })[candidate?.status] || candidate?.displayStatus || "待成员单位接口人确认";
  }

  function s003CandidateActionControl(candidate, contextState = s003ContextState(), surface = "dashboard") {
    if (candidate?.actionRequestId) return `<button class="text-link" type="button" data-action="s003-open-action-request" data-request-id="${esc(candidate.actionRequestId)}">查看行动进展</button>`;
    if (!contextState?.isCurrent) return `<button class="btn" type="button" disabled title="历史记录仅供查看，不重复发送行动申请">仅查看历史记录</button>`;
    if (contextState?.projectionOnly) return `<button class="btn" type="button" data-action="s003-switch-formal-run">切换正式评分后提交</button>`;
    if (candidate?.routeConfigured === false) return `<button class="btn" type="button" disabled title="该企业尚未配置成员单位债务风险接口人">接口人未配置</button>`;
    if (surface === "report") return `<button class="btn" type="button" data-action="s003-open-dashboard-candidate" data-candidate-id="${esc(candidate.candidateId)}" data-enterprise-id="${esc(candidate.enterpriseId)}">前往驾驶舱提交</button>`;
    const label = candidate?.currentState?.code === "ROUTING_MISMATCH" ? "按接口人重新提交" : "提交行动申请";
    return `<button class="btn primary" type="button" data-action="s003-submit-action-request" data-candidate-id="${esc(candidate.candidateId)}">${label}</button>`;
  }

  function s003ActionRequestForCandidate(candidate, resources = s003Dashboard.resources) {
    const context = s003ResourceContext(resources);
    const result = (resources?.results?.results || []).find((item) => item.enterprise?.enterpriseId === candidate?.enterpriseId) || null;
    const target = resources?.publishedPointer?.activeTarget || resources?.publishedModel || {};
    const actionMeta = s003ActionTypeMeta(candidate?.actionTypeId);
    const report = s003ReportFor(candidate?.enterpriseId)?.content || null;
    const inputIdentity = resources?.results?.inputIdentity || {};
    const route = s003MemberUnitDecisionRoute(candidate);
    const requestId = s003ActionRequestId(candidate);
    const reportRoute = s003FormalReportHash({
      enterpriseId: candidate.enterpriseId,
      reportId: report?.reportId || null,
      runId: context.scenarioRunId
    });
    return {
      id: requestId,
      requestId,
      scenario: "债务风险监测",
      scenarioContext: clone(context),
      subjectId: candidate.enterpriseId,
      subjectName: candidate.enterpriseName,
      sourceType: "report",
      sourceRef: `债务风险驾驶舱 · ${candidate.sourceResultId}`,
      requester: "集团债务风险管理人员",
      submittedBy: "集团债务风险管理人员",
      requestTime: nowText(),
      actionType: {
        id: candidate.actionTypeId,
        name: actionMeta.label,
        version: target.packageVersion || result?.modelIdentity?.packageVersion || "1.0.1",
        status: "已发布"
      },
      rule: null,
      metric: {
        id: "MET-S003-FINAL-RISK-SCORE",
        name: "企业最终风险评分",
        value: `${Number(candidate.finalScore).toFixed(2)} 分`,
        explanation: `${candidate.riskTierName} · ${s003CandidateTriggerText(candidate)}`,
        evaluatedAt: candidate.assessmentAt,
        scope: `${candidate.enterpriseName} · ${candidate.category}`
      },
      // 接口人是决策收件人与确认人，不是负责人待办的承接人。
      // 负责人只能在接口人确认并交办后写入 Action Request / C019。
      owner: null,
      ownerId: null,
      routingTarget: clone(route.routingTarget),
      decisionRecipient: clone(route.decisionRecipient),
      recipientRole: route.recipientRole,
      recipientName: route.recipientName,
      recipientId: route.recipientId,
      recommendedTaskOwner: route.recommendedTaskOwner,
      recommendedTaskOwnerId: route.recommendedTaskOwnerId,
      handoffInstruction: "成员单位债务风险接口人在决策中心确认后，再提交分办任务给本单位债务风险责任人。",
      recommendation: `${actionMeta.description} ${s003TierGuidance(candidate.riskTier)}`,
      banks: [],
      loans: [],
      loanCount: 0,
      evidence: {
        semanticVersion: `${target.packageId || "S003-M01-DEBT-RISK-PKG"} ${target.packageVersion || result?.modelIdentity?.packageVersion || "1.0.1"}`,
        dataVersion: inputIdentity.dataAssetId || result?.dataIdentity?.dataAssetId || "未取得精确数据资产标识",
        dataAssetVersion: inputIdentity.dataAssetVersion || result?.dataIdentity?.dataAssetVersion || result?.dataIdentity?.dataVersion || null,
        dataAssetId: inputIdentity.dataAssetId || null,
        snapshotId: candidate.sourceResultId,
        cutoff: candidate.assessmentAt,
        quality: inputIdentity.qualityResultId || "当前运行质量结果",
        availability: "完整可用",
        ready: "消费就绪",
        freshness: "固定运行证据",
        availableSections: ["企业最终风险评分", "风险分档", "风险触发依据", "企业正式报告", "已发布 Action Type"],
        missingItems: [],
        reportId: report?.reportId || null,
        reportRoute
      },
      sourceCandidateId: candidate.candidateId,
      sourceResultId: candidate.sourceResultId,
      sourceResultVersion: candidate.sourceResultVersion || candidate.resultVersion,
      reportId: report?.reportId || null,
      reportRoute,
      requiresHumanConfirmation: true,
      automatic: false
    };
  }

  function s003RunSelector(resources = s003Dashboard.resources) {
    const runs = s003RunOptions();
    if (!runs.length) return "";
    const selected = runs.find((run) => run.runId === s003Dashboard.selectedRunId) || runs[0];
    const runLabel = selected?.projectionOnly ? "待发布重跑" : selected?.authorityMode === "published-evidence" ? "正式评分" : "历史评分";
    return `<div class="s003-run-switcher"><div><span>当前查看</span><strong>${esc(runLabel)} · ${esc(selected?.assessmentAt || "评估时点未取得")}</strong><small>模型 V${esc(selected?.modelVersion || "—")} · ${selected?.reportCount || 0} 家企业报告</small></div><label><span>切换评分批次</span><select data-change="s003-run-selection">${runs.map((run) => `<option value="${esc(run.runId)}" ${run.runId === selected?.runId ? "selected" : ""}>${run.projectionOnly ? "待发布重跑" : run.authorityMode === "published-evidence" ? "正式评分" : "历史评分"} · ${esc(run.assessmentAt || "未知时点")} · 模型 V${esc(run.modelVersion || "—")}${run.detailed ? "" : " · 仅摘要"}</option>`).join("")}</select></label><div class="s003-run-switcher-status">${badge(runLabel, selected?.projectionOnly ? "warning" : "success")}<span>${selected?.detailed ? "可查看逐户评分与报告" : "仅保留汇总结果"}</span></div></div>`;
  }

  function s003Overview() {
    const resources = s003Dashboard.resources;
    const contextState = s003ContextState(resources);
    const results = resources.results.results || [];
    const manifestCounts = resources.reportManifest?.summary?.riskTierCounts || resources.runtime?.riskCounts || {};
    const counts = results.reduce((acc, record) => {
      const tier = s003Tier(record);
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, { GREEN: Number(manifestCounts.GREEN || 0), YELLOW: Number(manifestCounts.YELLOW || 0), RED: Number(manifestCounts.RED || 0), BLACK: Number(manifestCounts.BLACK || 0) });
    if (results.length) Object.keys(counts).forEach((key) => { counts[key] = results.filter((record) => s003Tier(record) === key).length; });
    const enterpriseCount = results.length || Number(resources.results.enterpriseCount || 0) || Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
    const average = results.length ? results.reduce((sum, record) => sum + Number(record.finalScore || 0), 0) / results.length : null;
    const rows = s003ResultRows();
    const candidates = s003SortedActionCandidates(s003DecisionCandidates(resources));
    const awaitingCount = candidates.filter((candidate) => candidate.currentState?.code === "PENDING_SUBMISSION").length;
    const decisionPendingCount = candidates.filter((candidate) => ["REQUEST_SUBMITTED", "REQUEST_ACCEPTED"].includes(candidate.currentState?.code)).length;
    const handledCount = candidates.filter((candidate) => ["DECIDED", "TODO_CREATED"].includes(candidate.currentState?.code)).length;
    const mismatchCount = candidates.filter((candidate) => candidate.currentState?.valid === false).length;
    const tierAttentionEnterpriseIds = new Set(results.filter((record) => ["YELLOW", "RED", "BLACK"].includes(s003Tier(record))).map((record) => record.enterprise.enterpriseId));
    const attentionEnterpriseCount = tierAttentionEnterpriseIds.size;
    const candidatesByEnterprise = candidates.reduce((map, candidate) => {
      const list = map.get(candidate.enterpriseId) || [];
      list.push(candidate);
      map.set(candidate.enterpriseId, list);
      return map;
    }, new Map());
    const triggerTiers = ["YELLOW", "RED", "BLACK"];
    // 仍读取 Published Action Type 以完成合同核对；页面展示按风险灯归类。
    const triggerTypes = triggerTiers.map((tierId) => s003RiskActionTypeForTier(tierId, resources)?.actionTypeId).filter(Boolean);
    const configurationModel = resources.configurationModel || resources.publishedModel || {};
    const riskTiers = (configurationModel.riskTiers || []).slice().sort((left, right) => ({ GREEN: 0, YELLOW: 1, RED: 2, BLACK: 3 }[left.tierId] ?? 9) - ({ GREEN: 0, YELLOW: 1, RED: 2, BLACK: 3 }[right.tierId] ?? 9));
    const sectorSummaries = s003SectorSummaries(results);
    const weakIndicators = s003WeakIndicatorSummaries(results);
    const summaryOnlyNotice = resources.runtime?.summaryOnly
      ? `<div class="notice warning"><span>${icon("history", "sm")}</span><div><strong>该历史批次仅保留评分摘要</strong><span>风险分布和报告数量可追溯，但该批次未保留逐户明细；需要查看完整证据时，可从对应场景快照创建新的查看批次。</span></div></div>`
      : "";
    const configurationDelta = s003ConfigurationDeltaForResources(resources);
    const rerunNotice = configurationDelta.ahead
      ? `<div class="notice warning"><span>${icon("triangle-alert", "sm")}</span><div><strong>${esc(s003ConfigurationDeltaLabel(configurationDelta))}已更新，等待重跑</strong><span>本次评分尚未使用这些已发布变更；快速重跑会形成新的评分批次，当前结果和报告保持不变。</span></div></div>`
      : "";
    return `<div class="section-stack s003-overview-stack">
      ${s003RunSelector(resources)}
      ${summaryOnlyNotice}
      <div class="s003-kpi-grid">
        <article class="s003-kpi-total"><span>监测企业</span><strong>${enterpriseCount}</strong><small>评估时点 ${esc(resources.results.assessmentAt)}</small></article>
        <article class="s003-kpi-average"><span>集团平均评分</span><strong>${average == null ? "—" : average.toFixed(2)}</strong><small>来源：同一运行的${contextState.projectionOnly ? "本次评分结果" : "已发布评分结果"}</small></article>
        <article class="s003-kpi-attention"><span>预警企业</span><strong>${attentionEnterpriseCount}</strong><small>黄灯、红灯、黑灯企业；绿灯企业不形成预警行动</small></article>
      </div>
      <div class="two-col s003-overview-grid">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">风险分档分布与判定口径</div><p>阈值由财务公司定义，并在 M01 已发布模型中维护；本页只展示和筛选结果，不新增评分规则。</p></div></div><div class="panel-body section-stack"><div class="s003-distribution">${["GREEN", "YELLOW", "RED", "BLACK"].map((tier) => `<button type="button" data-action="s003-filter-risk" data-risk="${tier}"><span class="s003-risk-dot risk-${tier.toLowerCase()}"></span><strong>${{GREEN:"绿灯",YELLOW:"黄灯",RED:"红灯",BLACK:"黑灯"}[tier]}</strong><b>${counts[tier]}</b><i><i style="width:${enterpriseCount ? Math.round(counts[tier] / enterpriseCount * 100) : 0}%"></i></i></button>`).join("")}</div><div class="s003-tier-guidance">${riskTiers.map((tier) => `<article><header><span class="s003-risk-dot risk-${String(tier.tierId || "unknown").toLowerCase()}"></span><strong>${esc(tier.name)}</strong><code>${esc(s003TierThresholdText(tier))}</code></header><p>${esc(s003TierGuidance(tier.tierId))}</p></article>`).join("")}</div></div></section>
        <section class="panel"><div class="panel-head"><div><div class="panel-title">模型与本次评分</div><p>查看本次评分采用的模型、评估时点和报告覆盖情况；配置调整后可创建新的评分批次。</p></div></div><div class="panel-body"><div class="s003-run-facts"><div><span>评分模型</span><strong>V${esc(resources.runtime?.runModelVersion || resources.reportManifest?.modelIdentity?.packageVersion || resources.publishedModel.packageVersion)}</strong></div><div><span>评估时点</span><strong>${esc(resources.results.assessmentAt)}</strong></div><div><span>覆盖企业</span><strong>${enterpriseCount} 家</strong></div><div><span>${contextState.projectionOnly ? "报告预览" : "正式报告"}</span><strong>${resources.reportManifest.reportCount || 0} 份</strong></div></div>${rerunNotice}<div class="button-row"><button class="btn" type="button" data-action="s003-navigate-module" data-module="ontology" data-hash="${esc(s003ModelConfigurationHash("overview"))}">模型配置</button>${contextState.isCurrent && !resources.runtime?.summaryOnly ? `<button class="btn primary" type="button" data-action="s003-request-rerun">按当前配置快速重跑</button>` : `<button class="btn primary" type="button" disabled>当前视图不可重跑</button>`}</div></div></section>
      </div>
      <section class="panel s003-overview-industry"><div class="panel-head"><div><div class="panel-title">产业风险分布与共性薄弱指标</div><p>左侧回答风险集中在哪些产业，右侧回答哪些评分指标在多家企业中反复偏低；点击卡片进入同一运行的下钻明细。</p></div>${badge(`${sectorSummaries.length} 个产业`, "plain")}</div><div class="panel-body s003-sector-weakness-layout"><div><div class="section-title-row"><div><h3>产业风险分布</h3><p>展示各产业企业数、需关注企业数、平均评分和最低分企业，点击后自动切换到“产业与薄弱项”明细。</p></div></div><div class="s003-sector-grid">${sectorSummaries.map((sector) => s003SectorCard(sector, { overview: true })).join("")}</div></div><div class="s003-group-weakness"><div class="section-title-row"><div><h3>共性薄弱指标</h3><p>先取每家企业得分最低的 3 项指标，再统计同一指标涉及的企业数；点击指标查看涉及企业和报告。</p></div></div>${weakIndicators.length ? weakIndicators.map((item, index) => `<button type="button" class="s003-weak-card" data-action="s003-select-weak-indicator" data-indicator="${esc(item.name)}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(item.name)}</strong><small>主要涉及：${esc(item.enterprises.join("、"))}${item.count > item.enterprises.length ? ` 等 ${item.count} 家` : ""}</small></div><b>涉及 ${item.count} 家企业</b><em>平均 ${item.average.toFixed(2)} 分 · 查看明细</em></button>`).join("") : `<div class="notice"><span>${icon("circle-dashed", "sm")}</span><div><strong>暂无可聚合的共性薄弱指标</strong><span>在建企业固定分或仅保留摘要的批次不补造指标排名。</span></div></div>`}</div></div></section>
      <section class="panel s003-overview-actions"><div class="panel-head"><div><div class="panel-title">分档预警与行动提交</div><p>黄灯、红灯、黑灯企业按亮灯结果逐户形成一条待提交预警行动；页面仅按灯色区分，底层 Action Type 标识仍用于合同追溯。</p></div>${candidates.length ? badge(`待提交 ${awaitingCount} · 已送达待接口人确认 ${decisionPendingCount} · 已确认或已分办 ${handledCount}`, mismatchCount ? "danger" : awaitingCount ? "warning" : "success") : badge("全部绿灯", "success")}</div><div class="panel-body section-stack"><div class="s003-trigger-grid">${triggerTiers.map((tierId) => { const scoped = candidates.filter((candidate) => String(candidate.riskTier || candidate.trigger?.tierId).toUpperCase() === tierId); const pending = scoped.filter((candidate) => ["PENDING_SUBMISSION", "ROUTING_MISMATCH"].includes(candidate.currentState?.code)).length; const guidance = s003RiskActionGuidance(tierId); return `<article class="s003-trigger-card ${guidance.tone}"><span>${icon(tierId === "BLACK" ? "shield-alert" : "activity", "sm")}</span><div><strong>${esc(s003TierActionLabel(tierId))}</strong><small>${esc(guidance.detail)}</small></div><b>${scoped.length}</b><em>${pending} 条待提交行动申请</em></article>`; }).join("")}</div>${candidates.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>企业 / 报告</th><th>亮灯等级 / 评分</th><th>预警类型</th><th>亮灯依据</th><th>接收接口人</th><th>成员单位处理状态</th><th>行动</th></tr></thead><tbody>${candidates.map((candidate) => { const focused = candidate.candidateId === s003Dashboard.focusedCandidateId; const status = s003CandidateDisplayStatus(candidate, contextState); const route = s003MemberUnitDecisionRoute(candidate); return `<tr class="${focused ? "s003-focused-row" : ""}"><td><strong>${esc(candidate.enterpriseName)}</strong><small class="table-subline">${esc(candidate.enterpriseId)}</small><button class="text-link s003-inline-report-link" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(candidate.enterpriseId)}">查看企业报告</button></td><td>${s003TierBadge({ riskTier: candidate.riskTier })}<small class="table-subline">${Number(candidate.finalScore).toFixed(2)} 分</small></td><td><strong>${esc(s003CandidateTierLabel(candidate))}</strong><small class="table-subline">底层合同：${esc(candidate.actionTypeId)}</small></td><td>${esc(s003CandidateTriggerText(candidate))}</td><td><strong>${esc(route.recipientName)}</strong><small class="table-subline">确认后建议分办：${esc(route.recommendedTaskOwner)}</small></td><td>${badge(status.label, status.tone)}<small class="table-subline">${esc(s003DecisionStateSourceLabel(candidate.currentState?.source))}</small></td><td>${s003CandidateActionControl(candidate, contextState)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="notice"><span>${icon("circle-check", "sm")}</span><div><strong>当前运行全部为绿灯</strong><span>绿灯企业保持常态监测，不形成预警行动；不会借用其他评分批次的行动记录。</span></div></div>`}</div></section>
      <section class="panel s003-overview-enterprises" id="s003-enterprise-score-table"><div class="panel-head"><div><div class="panel-title">企业风险评分明细</div><p>按企业、产业、类别和风险分档筛选排序；默认按综合评分升序，正式报告在报告中心落地。</p></div><div class="s003-table-tools"><label class="s003-search"><span>搜索企业</span><input type="search" value="${esc(s003Dashboard.searchTerm)}" placeholder="名称 / 编号 / 产业" data-input="s003-enterprise-search"></label><label class="s003-sort"><span>排序</span><select data-change="s003-result-sort"><option value="finalScore-asc" ${s003Dashboard.sortKey === "finalScore-asc" ? "selected" : ""}>综合分升序</option><option value="finalScore-desc" ${s003Dashboard.sortKey === "finalScore-desc" ? "selected" : ""}>综合分降序</option><option value="risk-asc" ${s003Dashboard.sortKey === "risk-asc" ? "selected" : ""}>风险优先</option><option value="name-asc" ${s003Dashboard.sortKey === "name-asc" ? "selected" : ""}>企业名称</option></select></label><button class="btn ${s003Dashboard.riskFilter === "ALL" ? "primary" : ""}" type="button" data-action="s003-filter-risk" data-risk="ALL">全部</button>${["YELLOW","RED","BLACK"].map((tier) => `<button class="btn ${s003Dashboard.riskFilter === tier ? "primary" : ""}" type="button" data-action="s003-filter-risk" data-risk="${tier}">${{YELLOW:"黄灯",RED:"红灯",BLACK:"黑灯"}[tier]}</button>`).join("")}</div></div><div class="panel-body flush"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th class="num">原始分</th><th class="num">调节合计</th><th class="num">综合分</th><th>风险等级</th><th>最低指标</th><th>预警</th><th>正式报告</th></tr></thead><tbody>${rows.length ? rows.map((record) => { const enterpriseCandidates = candidatesByEnterprise.get(record.enterprise.enterpriseId) || []; return `<tr><td><strong>${esc(record.enterprise.name)}</strong><small class="table-subline">${esc(record.enterprise.enterpriseId)}</small></td><td>${esc(record.enterprise.sector)}<small class="table-subline">${esc(record.enterprise.category)}</small></td><td class="num">${Number(record.rawScore).toFixed(2)}</td><td class="num">${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}</td><td class="num"><strong>${Number(record.finalScore).toFixed(2)}</strong></td><td>${s003TierBadge(record)}</td><td>${s003LowestMetricDisplay(record)}</td><td>${enterpriseCandidates.length ? enterpriseCandidates.map((candidate) => `<span class="s003-trigger-chip ${s003TierToneClass(candidate.riskTier || candidate.trigger?.tierId)}">${esc(s003CandidateTierLabel(candidate))}</span>`).join("") : "—"}</td><td><button class="text-link" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(record.enterprise.enterpriseId)}">${contextState.projectionOnly ? "查看报告预览" : "在报告中心查看"}</button></td></tr>`; }).join("") : `<tr><td colspan="9"><div class="empty-state"><div><h2>${resources.runtime?.summaryOnly ? "该历史运行没有逐户明细投影" : "没有匹配企业"}</h2><p>${resources.runtime?.summaryOnly ? "请从对应 Checkpoint 克隆恢复，或切换到保留完整评分明细的运行。" : "请调整关键词或风险等级筛选。"}</p></div></div></td></tr>`}</tbody></table></div></div></section>
    </div>`;
  }

  function s003DashboardProjection(mode) {
    const template = document.createElement("template");
    template.innerHTML = s003Overview().replaceAll("在报告中心查看", "查看报告").replaceAll("进入报告中心查看", "查看报告");
    const riskDistribution = template.content.querySelector(".s003-distribution");
    if (riskDistribution) {
      const legend = document.createElement("div");
      legend.className = "s003-risk-legend";
      legend.setAttribute("aria-label", "风险分档颜色图例");
      legend.innerHTML = [
        ["green", "绿灯", "常态监测"],
        ["yellow", "黄灯", "预防性跟踪"],
        ["red", "红灯", "专项处置"],
        ["black", "黑灯", "应急响应"]
      ].map(([tone, label, meaning]) => `<span class="s003-risk-legend-item s003-risk-legend-${tone}"><i class="s003-risk-dot risk-${tone}"></i><b>${label}</b><small>${meaning}</small></span>`).join("");
      riskDistribution.parentNode.insertBefore(legend, riskDistribution);
      riskDistribution.querySelectorAll("button").forEach((button) => {
        const tone = String(button.dataset.risk || "unknown").toLowerCase();
        button.classList.add(`risk-row-${["green", "yellow", "red", "black"].includes(tone) ? tone : "unknown"}`);
        button.setAttribute("aria-label", `${button.querySelector("strong")?.textContent || "风险分档"} ${button.querySelector("b")?.textContent || "0"} 家`);
      });
    }
    // 产业风险分布与共性薄弱指标集中在独立页签，风险总览只保留集团级结论与行动入口。
    if (mode === "overview") template.content.querySelector(".s003-overview-industry")?.remove();
    const actionPanel = template.content.querySelector(".s003-overview-actions");
    if (actionPanel) {
      const table = actionPanel.querySelector("table");
      const head = table?.querySelector("thead tr");
      if (head) {
        const tierHead = head.querySelector("th:nth-child(2)");
        if (tierHead) {
          tierHead.textContent = "风险等级";
          const scoreHead = document.createElement("th");
          scoreHead.className = "num";
          scoreHead.textContent = "综合评分";
          tierHead.after(scoreHead);
        }
      }
      table?.querySelectorAll("tbody tr").forEach((row) => {
        const tierCell = row.querySelector("td:nth-child(2)");
        if (!tierCell) return;
        const scoreText = tierCell.querySelector(".table-subline")?.textContent?.trim() || "—";
        tierCell.querySelector(".table-subline")?.remove();
        const scoreCell = document.createElement("td");
        scoreCell.className = "num s003-action-score";
        scoreCell.textContent = scoreText;
        tierCell.after(scoreCell);
      });
    }
    const actionDrawer = s003ActionProgressDrawer(s003Dashboard.resources);
    if (mode === "actions") {
      const resources = s003Dashboard.resources;
      const contextState = s003ContextState(resources);
      const guidance = contextState.projectionOnly
        ? `<div class="notice warning"><span>${icon("triangle-alert", "sm")}</span><div><strong>当前批次尚未发布</strong><span>可以查看评分和行动候选；提交前请切换到正式评分批次，避免把试算结果送入决策中心。</span></div><button class="text-link" type="button" data-action="s003-switch-formal-run">切换正式评分</button></div>`
        : contextState.historicalReadOnly
          ? `<div class="notice"><span>${icon("history", "sm")}</span><div><strong>历史评分只读</strong><span>历史行动和待办不会重放；请切换到当前正式评分处理新申请。</span></div></div>`
          : `<div class="notice success"><span>${icon("user-check", "sm")}</span><div><strong>行动申请直达成员单位接口人</strong><span>集团债务风险管理人员从驾驶舱提交后，申请进入对应成员单位接口人的决策中心；接口人确认后再提交分办任务，处理状态会回流本页。</span></div></div>`;
      return `<div class="section-stack s003-action-workspace">${s003RunSelector(resources)}${guidance}${actionPanel ? actionPanel.outerHTML : `<section class="panel"><div class="panel-body"><div class="empty-state"><div><h2>当前批次全部为绿灯</h2><p>绿灯企业不形成预警行动，也不会借用其他评分批次的行动记录。</p></div></div></div></section>`}${actionDrawer}</div>`;
    }
    actionPanel?.remove();
    return template.innerHTML + actionDrawer;
  }

  function s003ReportValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value !== "number" || !Number.isFinite(value)) return esc(value);
    const absolute = Math.abs(value);
    if (absolute >= 100000000) return `${(value / 100000000).toFixed(2)} 亿`;
    if (absolute >= 10000) return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
  }

  function s003ReportIndicatorValue(item, assessment = {}) {
    const value = item?.actualValue ?? item?.value;
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value !== "number" || !Number.isFinite(value)) return esc(value);
    const percentageIndicators = new Set(["资产负债率", "总资产收益率", "净资产收益率", "销售毛利率", "营业利润率", "股东权益同比增长率"]);
    if (percentageIndicators.has(item?.name)) return `${(value * 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    const amountIndicators = new Set(["总资产", "净利润", "经营活动产生的现金流入"]);
    if (amountIndicators.has(item?.name) && assessment?.currency === "CNY") {
      const sign = value < 0 ? "-" : "";
      const absolute = Math.abs(value);
      if (absolute >= 100000000) return `${sign}¥${(absolute / 100000000).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 亿`;
      if (absolute >= 10000) return `${sign}¥${(absolute / 10000).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 万`;
      return `${sign}¥${absolute.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return s003ReportValue(value);
  }

  function s003FactorStateLabel(state) {
    return ({
      APPLIED: "已采用",
      NOT_APPLICABLE: "业务不适用",
      DEFAULTED_ZERO: "缺失套零档"
    })[state] || state || "未标记";
  }

  function s003IndicatorStateLabel(state, marker) {
    if (["PROFIT_HISTORY_DEFAULT_A", "HISTORY_INSUFFICIENT_DEFAULT_A"].includes(marker)) return "盈利历史不足按 A";
    if (marker === "UNDER_CONSTRUCTION_FIXED_60") return "在建企业固定 60 分";
    return ({
      EVALUATED: "已评分",
      NOT_APPLICABLE: "业务不适用",
      NOT_EVALUATED_UNDER_CONSTRUCTION: "在建企业不逐项评分",
      DEFAULTED: "已采用默认语义"
    })[state] || state || "已评分";
  }

  function s003IndicatorStateNote(item = {}) {
    if (item.note) return item.note;
    if (["PROFIT_HISTORY_DEFAULT_A", "HISTORY_INSUFFICIENT_DEFAULT_A"].includes(item.marker)) return "盈利历史不足，按 A 档计分";
    if (item.marker === "UNDER_CONSTRUCTION_FIXED_60") return "在建企业原始基础分固定 60 分，不逐项汇总财务指标";
    return "—";
  }

  function s003RuleStatement(value) {
    return String(value || "")
      .replaceAll("HISTORY_INSUFFICIENT_DEFAULT_A", "盈利历史不足按 A")
      .replaceAll("PROFIT_HISTORY_DEFAULT_A", "盈利历史不足按 A")
      .replaceAll("UNDER_CONSTRUCTION_FIXED_60", "在建企业固定 60 分")
      .replaceAll("DEFAULTED_ZERO", "缺失套零档")
      .replaceAll("NOT_APPLICABLE", "业务不适用");
  }

  function s003ReportDetailSections(content, contextState) {
    const indicators = content.indicatorDetails || [];
    const rules = content.ruleExplanations || [];
    const candidates = s003RiskTierDispositionCandidates(content.disposition?.candidates || []);
    const evidence = content.evidenceReferences || [];
    const generation = content.generationPolicy || {};
    const indicatorSection = content.assessment?.isUnderConstruction
      ? `<section><h3>财务指标口径清单（${indicators.length} 项）</h3><div class="notice"><span>${icon("info", "sm")}</span><div><strong>在建企业不逐项评分</strong><span>财务原始基础分固定为 60 分；以下仅保留 Published 指标定义、公式和本轮不评价状态，不展示虚假的实际值、权重合计或最低指标排序。</span></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>指标</th><th>Published 公式</th><th>本轮状态</th><th>说明</th></tr></thead><tbody>${indicators.map((item) => `<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.formula || "—")}</td><td>${esc(s003IndicatorStateLabel(item.status, item.marker))}</td><td>${esc(s003IndicatorStateNote(item))}</td></tr>`).join("")}</tbody></table></div></section>`
      : `<section><h3>财务指标评分明细（${indicators.length} 项）</h3><div class="data-table-wrap"><table class="data-table"><thead><tr><th>指标</th><th class="num">实际值</th><th class="num">得分</th><th class="num">权重</th><th class="num">加权得分</th><th>状态 / 备注</th></tr></thead><tbody>${indicators.map((item) => `<tr><td><strong>${esc(item.name)}</strong><small class="table-subline">${esc(item.formula || "")}</small></td><td class="num">${s003ReportIndicatorValue(item, content.assessment)}</td><td class="num">${Number(item.score ?? item.indicatorScore ?? 0).toFixed(2)}</td><td class="num">${Number(item.weightPercent ?? item.weight ?? 0).toFixed(2)}%</td><td class="num">${Number(item.weightedScore ?? 0).toFixed(2)}</td><td>${esc(s003IndicatorStateLabel(item.status, item.marker))}<small class="table-subline">${esc(s003IndicatorStateNote(item))}</small></td></tr>`).join("") || `<tr><td colspan="6">当前预览未形成指标明细。</td></tr>`}</tbody></table></div></section>`;
    return `${indicatorSection}
      <section><h3>规则说明与默认语义</h3><div class="s003-rule-list">${rules.map((rule) => `<article><div><strong>${esc(rule.title || rule.ruleId)}</strong><small>${esc(rule.ruleId || "")}</small></div>${badge(rule.applied ? "本轮适用" : "未触发", rule.applied ? "success" : "plain")}<p>${esc(s003RuleStatement(rule.statement || "—"))}</p></article>`).join("") || `<div class="notice"><div><strong>规则说明未单独形成</strong><span>本次评估批次仅显示评分结果，不补造正式规则证据。</span></div></div>`}</div></section>
      <section><h3>分档预警与行动状态</h3><div class="data-table-wrap"><table class="data-table"><thead><tr><th>预警类型</th><th>亮灯依据</th><th>提交状态</th><th>成员单位确认</th><th>行动申请 / 分办待办</th></tr></thead><tbody>${candidates.map((candidate) => { const route = s003MemberUnitDecisionRoute(candidate); return `<tr><td>${esc(s003CandidateTierLabel(candidate))}<small class="table-subline">底层合同：${esc(candidate.actionTypeId)}</small></td><td>${esc(s003CandidateTriggerText(candidate))}</td><td>${esc(s003ContentCandidateStatus(candidate))}</td><td>${esc(route.recipientName)}</td><td>${esc(candidate.actionRequestId || "未形成行动申请")}<small class="table-subline">${esc(candidate.todoId || `确认后建议分办给${route.recommendedTaskOwner}`)}</small></td></tr>`; }).join("") || `<tr><td colspan="5">本企业为绿灯，本轮不形成预警行动；报告生成不会自动创建行动申请或负责人待办。</td></tr>`}</tbody></table></div><div class="notice"><span>${icon("user-check", "sm")}</span><div><strong>一期处置边界</strong><span>集团债务风险管理人员从驾驶舱提交后，行动申请直接进入对应成员单位接口人的通用决策中心；接口人确认后再提交分办任务，不建设专属处置页或多级审批。</span></div></div></section>
      <section><h3>证据与版本追溯</h3><div class="s003-evidence-list">${evidence.map((item) => `<article><strong>${esc(s003EvidenceTypeLabel(item.evidenceType || "证据"))}</strong><code>${esc(item.evidenceId || "—")}</code><span>${esc(item.ref || "本次评估批次")}</span><small>${esc(item.evidenceType || "证据")} · ${esc(item.evidenceVersion || item.packageVersion || "")}</small></article>`).join("") || `<article><strong>本次评估批次</strong><code>${esc(content.scenarioIdentity?.scenarioRunId || "—")}</code><span>本次评分与报告预览</span><small>暂未形成正式证据包</small></article>`}</div></section>
      <section><h3>报告生成边界</h3><div class="s003-generation-boundary"><span>来源状态 <b>${contextState.projectionOnly ? "本次评估批次" : generation.sourceIsPublished ? "Published" : "未确认"}</b></span><span>客户端重算 <b>${generation.clientSideScoreRecalculation ? "是" : "否"}</b></span><span>创建 Action Request <b>${generation.createsActionRequest ? "是" : "否"}</b></span><span>创建待办 <b>${generation.createsTodo ? "是" : "否"}</b></span><span>发送通知 <b>${generation.sendsNotification ? "是" : "否"}</b></span><span>专属 Agent <b>${generation.dedicatedAgentRequired ? "需要" : "不需要"}</b></span></div></section>`;
  }

  function s003Reports() {
    const contextState = s003ContextState();
    const reports = s003Dashboard.resources.reportContents.reports || [];
    if (!reports.length) return `<div class="empty-state"><div><h2>本次运行没有逐户报告明细</h2><p>请切换到保留完整明细的运行，或从对应 Checkpoint 克隆恢复。</p></div></div>`;
    const reportNotice = contextState.projectionOnly
      ? `<div class="notice warning"><span>${icon("flask-conical", "sm")}</span><div><strong>当前为报告工作预览</strong><span>绑定 ${esc(contextState.resource.scenarioRunId)}，不冒充报告中心正式产物；正式报告仍在报告中心目录按原运行身份只读落地。</span></div></div>`
      : `<div class="notice success"><span>${icon("shield-check", "sm")}</span><div><strong>正式报告已在报告中心落地</strong><span>以下索引只提供驾驶舱穿透入口，阅读、核验、伴读、下载和打印均进入报告中心通用报告详情。</span></div></div>`;
    const reportItems = reports.map((report) => {
      const content = report.content;
      const weak = (content.keyIndicators || content.assessment?.lowestThree || []).slice(0, 3);
      return { content, weak };
    }).sort((left, right) => {
      const scoreDelta = Number(left.content?.assessment?.finalScore ?? Infinity) - Number(right.content?.assessment?.finalScore ?? Infinity);
      return scoreDelta || String(left.content?.enterprise?.name || "").localeCompare(String(right.content?.enterprise?.name || ""), "zh-CN");
    });
    const reportIndex = s003Dashboard.reportIndexLayout === "list"
      ? `<div class="record-table-wrap s003-report-index-list"><table class="data-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th>综合评分</th><th>风险分档</th><th>重点关注</th><th>内容版本</th><th>操作</th></tr></thead><tbody>${reportItems.map(({ content, weak }) => `<tr><td><strong>${esc(content.enterprise.name)}</strong><small class="table-subline">${esc(content.enterprise.enterpriseId)}</small></td><td>${esc(content.enterprise.sector || "未分类")}<small class="table-subline">${esc(content.enterprise.category || "未分类")}</small></td><td class="num"><strong>${Number(content.assessment.finalScore).toFixed(2)}</strong></td><td>${s003TierBadge({ riskTier: content.assessment.riskTier })}</td><td>${s003ReportWeakDisplay(content, weak)}</td><td>${contextState.projectionOnly ? "工作预览" : esc(content.contentVersion)}</td><td><button class="btn primary" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(content.enterprise.enterpriseId)}">查看报告</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="s003-report-index">${reportItems.map(({ content, weak }) => `<article><header><div>${s003TierBadge({riskTier:content.assessment.riskTier})}<strong>${esc(content.enterprise.name)}</strong><small>${esc(content.enterprise.enterpriseId)} · ${esc(content.reportId)}</small></div><b>${Number(content.assessment.finalScore).toFixed(2)}</b></header><p>${esc(content.conclusion)}</p><div class="s003-report-index-weak"><span>重点关注</span><strong>${s003ReportWeakDisplay(content, weak)}</strong></div><footer><span>${contextState.projectionOnly ? "工作预览" : `内容版本 ${esc(content.contentVersion)}`}</span><button class="btn primary" type="button" data-action="s003-open-formal-report" data-enterprise-id="${esc(content.enterprise.enterpriseId)}">${contextState.projectionOnly ? "查看同轮报告预览" : "查看报告"}</button></footer></article>`).join("")}</div>`;
    return `<div class="section-stack">${reportNotice}<section class="panel"><div class="panel-head"><div><div class="panel-title">企业报告索引</div><p>${reports.length} 家企业 · 与当前评分运行同一 scenarioRunId</p></div><div class="button-row"><div class="segmented" aria-label="报告索引视图"><button class="${s003Dashboard.reportIndexLayout === "cards" ? "active" : ""}" type="button" data-action="s003-set-report-index-layout" data-layout="cards">卡片视图</button><button class="${s003Dashboard.reportIndexLayout === "list" ? "active" : ""}" type="button" data-action="s003-set-report-index-layout" data-layout="list">列表视图</button></div><button class="btn" type="button" data-action="s003-navigate-module" data-module="report" data-hash="#/reports?tab=products">打开报告中心目录</button></div></div><div class="panel-body">${reportIndex}</div></section></div>`;
  }

  function s003ReportArtifact(reportId, resources = s003Dashboard.resources) {
    return (resources?.reportArtifacts?.artifacts || []).find((item) => item.reportId === reportId) || null;
  }

  function s003ReportVerification(content, resources = s003Dashboard.resources) {
    const profile = resources?.reportAssurance || {};
    const result = (resources?.results?.results || []).find((item) => item.enterprise?.enterpriseId === content?.enterprise?.enterpriseId) || null;
    const evidenceTypes = new Set((content?.evidenceReferences || []).map((item) => item.evidenceType));
    const requiredEvidence = resources?.reportDefinition?.requiredEvidenceTypes || [];
    const artifact = s003ReportArtifact(content?.reportId, resources);
    const weights = (content?.indicatorDetails || []).reduce((sum, item) => sum + Number(item.weightPercent ?? Number(item.weight || 0) * 100), 0);
    const generation = content?.generationPolicy || {};
    const artifactHtml = String(artifact?.html || "");
    const forbiddenPresentation = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
    const detailByName = new Map((content?.indicatorDetails || []).map((item) => [item.name, item]));
    const diagnosisValueFormat = (content?.keyRiskDiagnosis?.indicatorItems || []).every((item) => {
      if (item.type && item.type !== "indicator") return true;
      const detail = detailByName.get(item.title);
      return Boolean(detail && item.actualValueDisplay === s003ReportIndicatorValue(detail, content.assessment));
    });
    const reportCandidates = s003RiskTierDispositionCandidates(content?.disposition?.candidates || []);
    const decisionCandidates = s003DecisionCandidates(resources).filter((item) => item.enterpriseId === content?.enterprise?.enterpriseId);
    const formationStatusAlignment = decisionCandidates.length === reportCandidates.length && decisionCandidates.every((candidate) => {
      const reportCandidate = reportCandidates.find((item) => item.candidateId === candidate.candidateId);
      if (!reportCandidate) return false;
      if (candidate.formationState?.code === "PENDING_SUBMISSION") return !reportCandidate.actionRequestId && !reportCandidate.todoId;
      return reportCandidate.actionRequestId === candidate.formationState?.requestId && reportCandidate.todoId === candidate.formationState?.taskId;
    });
    const candidateIds = new Set(decisionCandidates.map((candidate) => candidate.candidateId));
    const currentRequests = s003DecisionInboxRequests(resources).filter((item) => (item.subjectId || item.enterpriseId) === content?.enterprise?.enterpriseId
      && candidateIds.has(item.sourceCandidateId || item.candidateId || String(item.requestId || item.id || "").replace(/^AR-/, "").replace(/-UNIT-LIAISON-v1$/, "")));
    const currentSummaries = s003DecisionSummaries(resources).filter((item) => item.enterpriseId === content?.enterprise?.enterpriseId
      && (!item.sourceCandidateId && !item.candidateId || candidateIds.has(item.sourceCandidateId || item.candidateId)));
    const requestMatchesCandidate = (request, candidate) => {
      const candidateId = request.sourceCandidateId || request.candidateId || String(request.requestId || request.id || "").replace(/^AR-/, "");
      return Boolean(candidate && candidate.candidateId === candidateId
        && (request.subjectId || request.enterpriseId) === candidate.enterpriseId
        && (request.actionType?.id || request.actionTypeId) === candidate.actionTypeId);
    };
    const summaryMatchesCandidate = (summary, candidate) => {
      if (summary.sourceCandidateId || summary.candidateId) return (summary.sourceCandidateId || summary.candidateId) === candidate.candidateId;
      const summaryRequestId = summary.requestId || summary.sourceRequestId || null;
      return Boolean(summaryRequestId && (candidate.currentState?.requestId === summaryRequestId
        || candidate.formationState?.requestId === summaryRequestId));
    };
    const currentRequestAlignment = currentRequests.every((request) => decisionCandidates.some((candidate) => requestMatchesCandidate(request, candidate)));
    const currentSummaryAlignment = currentSummaries.every((summary) => decisionCandidates.some((candidate) => summaryMatchesCandidate(summary, candidate)));
    const currentEvidenceCoverage = decisionCandidates.every((candidate) => {
      if (candidate.currentState?.code === "PENDING_SUBMISSION") return true;
      if (candidate.currentState?.source === "C011") return currentRequests.some((request) => requestMatchesCandidate(request, candidate));
      if (candidate.currentState?.source === "C019") return currentSummaries.some((summary) => summaryMatchesCandidate(summary, candidate));
      if (candidate.formationState?.source === "report-formation") {
        const reportCandidate = reportCandidates.find((item) => item.candidateId === candidate.candidateId);
        return Boolean(reportCandidate && reportCandidate.actionRequestId === candidate.formationState.requestId
          && reportCandidate.todoId === candidate.formationState.taskId);
      }
      return false;
    });
    const decisionStatusAlignment = formationStatusAlignment
      && currentRequestAlignment
      && currentSummaryAlignment
      && currentEvidenceCoverage
      && decisionCandidates.every((candidate) => candidate.currentState?.valid !== false);
    const constructionSemantics = !content?.assessment?.isUnderConstruction
      || (Number(content.assessment.rawScore) === 60
        && JSON.stringify(content.threeMonthActionPlan || []).includes("建设资金")
        && !/低分指标|最低指标/.test(JSON.stringify({ conclusion: content.conclusion, diagnosis: content.keyRiskDiagnosis, strategy: content.responseStrategy })));
    const indicatorCoverage = content?.assessment?.isUnderConstruction
      ? (content?.indicatorDetails || []).length >= 15
        && Math.abs(weights) < 0.01
        && (content?.indicatorDetails || []).every((item) => item.marker === "UNDER_CONSTRUCTION_FIXED_60" || item.status === "NOT_EVALUATED_UNDER_CONSTRUCTION")
      : (content?.indicatorDetails || []).length >= 15 && Math.abs(weights - 100) < 0.01;
    const checks = {
      "scenario-identity": sameScenarioContext(normalizeScenarioContext(content?.scenarioIdentity || {}), s003ResourceContext(resources)),
      "published-binding": Boolean(s003EvidenceByType(content, "PUBLISHED_MODEL_POINTER") && resources?.publishedModel?.packageVersion),
      "score-record": Boolean(result && Math.abs(Number(result.finalScore) - Number(content?.assessment?.finalScore)) < 0.001),
      "indicator-coverage": indicatorCoverage,
      "factor-coverage": (content?.adjustmentFactors || []).length >= 6 && Boolean(content?.factorStateSummary),
      "evidence-coverage": requiredEvidence.every((type) => evidenceTypes.has(type)),
      "artifact-identity": Boolean(resources?.runtime?.projectionOnly || artifact && artifact.reportId === content?.reportId && artifact.contentVersion === content?.contentVersion && artifact.artifactSha256),
      "side-effect-boundary": generation.clientSideScoreRecalculation === false && generation.createsActionRequest === false && generation.createsTodo === false && generation.sendsNotification === false,
      "localized-business-status": Boolean(resources?.runtime?.projectionOnly || artifactHtml && !forbiddenPresentation.test(artifactHtml)),
      "structured-trigger": Boolean(resources?.runtime?.projectionOnly || artifactHtml && !artifactHtml.includes("[object Object]")) && reportCandidates.every((candidate) => s003CandidateTriggerText(candidate) !== "[object Object]"),
      "diagnosis-value-format": diagnosisValueFormat,
      "decision-status-alignment": decisionStatusAlignment,
      "construction-semantics": constructionSemantics
    };
    const details = {
      "decision-status-alignment": decisionStatusAlignment
        ? `报告形成时 ${reportCandidates.length} 条候选与当前 C011/C019 状态可分别定位；预期实时记录均实际存在`
        : `形成时一致=${formationStatusAlignment ? "是" : "否"}；C011 一致=${currentRequestAlignment ? "是" : "否"}；C019 一致=${currentSummaryAlignment ? "是" : "否"}；当前证据覆盖=${currentEvidenceCoverage ? "是" : "否"}`
    };
    return (profile.verificationChecks || []).map((item) => ({ ...item, passed: checks[item.checkId] === true, detail: details[item.checkId] || null }));
  }

  function s003CompanionAnswer(questionId, content, resources = s003Dashboard.resources) {
    const weak = (content?.keyIndicators || []).slice(0, 3);
    const factors = content?.adjustmentFactors || [];
    const negative = factors.filter((item) => Number(item.coefficient) < 0);
    const positive = factors.filter((item) => Number(item.coefficient) > 0);
    const candidates = s003DecisionCandidates(resources).filter((item) => item.enterpriseId === content?.enterprise?.enterpriseId);
    const concrete = s003ConcreteReportStrategy(content, candidates);
    const portfolios = concrete.managementPortfolios || [];
    const plan = concrete.threeMonthActionPlan || [];
    const defaultSemantics = [];
    if (content?.assessment?.isUnderConstruction) defaultSemantics.push("在建企业原始基础分固定 60 分");
    if ((content?.ruleExplanations || []).some((item) => item.applied && /盈利历史不足/.test(item.title || item.statement || ""))) defaultSemantics.push("盈利历史不足按 A");
    const defaultedZero = Number(content?.factorStateSummary?.DEFAULTED_ZERO || 0);
    const notApplicable = Number(content?.factorStateSummary?.NOT_APPLICABLE || 0);
    if (defaultedZero) defaultSemantics.push(`${defaultedZero} 项适用因子缺失套 0 档`);
    if (notApplicable) defaultSemantics.push(`${notApplicable} 项业务条件不适用`);
    const answers = {
      "risk-summary": `${content?.conclusion || "当前报告未形成总体结论"} 原始分 ${Number(content?.assessment?.rawScore || 0).toFixed(2)}，调节合计 ${Number(content?.assessment?.factorSum || 0).toFixed(2)}，最终分 ${Number(content?.assessment?.finalScore || 0).toFixed(2)}。`,
      weakness: weak.length ? `最低三项指标为：${weak.map((item) => `${item.name}（${Number(item.score || 0).toFixed(2)} 分）`).join("、")}。` : "当前报告没有可读取的最低三项指标。",
      adjustment: `负向调节因子 ${negative.length} 项${negative.length ? `：${negative.map((item) => `${item.name} ${Number(item.coefficient).toFixed(2)}`).join("、")}` : ""}；正向调节因子 ${positive.length} 项${positive.length ? `：${positive.map((item) => `${item.name} +${Number(item.coefficient).toFixed(2)}`).join("、")}` : ""}。`,
      strategy: portfolios.length ? `${concrete.headline}。${concrete.guidance}执行分为：${portfolios.map((item) => `${item.title}：${item.actions.join("；")}`).join("；")}。` : `${content?.responseStrategy?.headline || "按当前风险等级推进管理措施"}。${content?.responseStrategy?.guidance || ""}`,
      "three-month-plan": plan.length ? plan.map((item) => `${item.period}“${item.objective}”：${item.actions}`).join("；") : "当前报告未固定未来三个月行动建议。",
      defaults: defaultSemantics.length ? `本轮采用的默认或不适用语义包括：${defaultSemantics.join("；")}。这些语义来自 Published 模型与固定结果，报告助手不会自行改写。` : "本轮未实际命中在建固定分、盈利历史不足或缺失套零语义；业务不适用项仍与缺失取值分离记录。",
      disposition: candidates.length ? `本轮按亮灯结果识别出 ${candidates.length} 条待提交预警行动：${candidates.map((item) => `${s003CandidateTierLabel(item)}（${item.displayStatus}）`).join("、")}。行动申请须由集团债务风险管理人员从驾驶舱显式提交，提交后送达本单位债务风险接口人确认。` : "本企业本轮为绿灯，不形成预警行动，也不会由报告生成自动创建 Action Request 或负责人待办。",
      evidence: `报告引用 ${(content?.evidenceReferences || []).length} 类正式证据：${(content?.evidenceReferences || []).map((item) => `${item.evidenceType} / ${item.evidenceId}`).join("；")}。`
    };
    return answers[questionId] || answers["risk-summary"];
  }

  function profileReadyForS003Companion(resources, content) {
    const contextState = s003ContextState(resources);
    const profile = resources?.agentPosition || {};
    const profileModel = profile.publishedModel || {};
    const data = profile.dataBinding || {};
    const evidenceByType = new Map((content?.evidenceReferences || []).map((item) => [item.evidenceType, item]));
    return Boolean(contextState.isCurrent && !contextState.projectionOnly
      && scenarioContextReady(contextState.active)
      && sameScenarioContext(contextState.active, content?.scenarioIdentity)
      && profile?.scenarioProfile?.baseAgentId === "report-copilot"
      && profile.scenarioIdentity?.sourceScenarioRunId === contextState.active.scenarioRunId
      && profileModel.semanticVersionId && profileModel.packageVersion === resources?.publishedModel?.packageVersion
      && data.dataAssetId && data.dataAssetId === evidenceByType.get("FORMAL_DATA_ASSET")?.evidenceId
      && data.dataAssetVersion && data.assessmentAt === content?.assessment?.assessmentAt
      && evidenceByType.get("PUBLISHED_MODEL_POINTER")?.evidenceId
      && evidenceByType.get("QUALITY_RESULT")?.evidenceId);
  }

  function s003CompanionAgentRequest(content, question, resources = s003Dashboard.resources) {
    const contextState = s003ContextState(resources);
    const profile = resources?.agentPosition || {};
    const profileModel = profile.publishedModel || {};
    const data = profile.dataBinding || {};
    const reportEvidence = content?.evidenceReferences || [];
    const evidenceByType = new Map(reportEvidence.map((item) => [item.evidenceType, item]));
    const context = scenarioContextReady(contextState.active) && sameScenarioContext(contextState.active, content?.scenarioIdentity)
      ? clone(contextState.active)
      : null;
    const required = [
      context,
      content?.reportId,
      content?.contentVersion,
      content?.enterprise?.enterpriseId,
      profile?.scenarioProfile?.baseAgentId === "report-copilot" ? profile.scenarioProfile.baseAgentId : null,
      profileModel.semanticVersionId,
      profileModel.packageVersion,
      data.dataAssetId,
      data.dataAssetVersion,
      data.assessmentAt,
      evidenceByType.get("PUBLISHED_MODEL_POINTER")?.evidenceId,
      evidenceByType.get("FORMAL_DATA_ASSET")?.evidenceId,
      evidenceByType.get("QUALITY_RESULT")?.evidenceId
    ];
    if (!profileReadyForS003Companion(resources, content) || required.some((value) => !value)) return null;
    if (profile.scenarioIdentity?.sourceScenarioRunId !== context.scenarioRunId
      || profileModel.packageVersion !== resources?.publishedModel?.packageVersion
      || data.dataAssetId !== evidenceByType.get("FORMAL_DATA_ASSET")?.evidenceId
      || data.assessmentAt !== content.assessment?.assessmentAt) return null;
    const selectedAnchor = s003Dashboard.formalReportSection || "s003-report-summary";
    const evidencePack = {
      id: `${content.reportId}-EVIDENCE-PACK`,
      version: content.contentVersion,
      fixedAt: content.generatedAt || resources?.reportContents?.formedAt || null,
      items: reportEvidence.map((item) => ({ id: item.evidenceId, version: item.evidenceVersion || item.packageVersion || null, type: item.evidenceType, ref: item.ref || null }))
    };
    const semanticBinding = {
      semanticVersionId: profileModel.semanticVersionId,
      semanticVersion: profileModel.packageVersion,
      dataAssetVersionId: data.dataAssetId,
      dataVersion: data.dataAssetVersion,
      consumableVersionId: `${profileModel.pointerId}/T018`,
      asOf: data.assessmentAt
    };
    return {
      requestId: makeId("C024-S003"),
      question,
      selectedAnchor,
      evidencePackId: evidencePack.id,
      reportContentVersion: content.contentVersion,
      semanticResolution: "S003 Published 模型与正式企业报告固定上下文",
      reportContext: {
        scenarioContext: context,
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        scenarioFormedAt: context.formedAt,
        scenarioStatus: context.status,
        contextIntent: "report-qa-fixed",
        reportNumber: content.reportId,
        reportId: content.reportId,
        reportName: `${content.enterprise.name}企业债务风险评估报告`,
        contentVersion: content.contentVersion,
        reportDefinition: { id: resources.reportDefinition?.definitionId, version: resources.reportDefinition?.definitionVersion, name: resources.reportDefinition?.name },
        template: { id: resources.reportTemplate?.templateId, version: resources.reportTemplate?.templateVersion, name: resources.reportTemplate?.name, slots: clone(resources.reportTemplate?.sections || []) },
        evidencePack,
        evidencePackId: evidencePack.id,
        anchorSnapshotId: `${content.reportId}-ANCHORS`,
        anchorSnapshotVersion: content.contentVersion,
        selectedAnchor,
        selectedAnchorBinding: { sectionId: selectedAnchor, reportId: content.reportId, contentVersion: content.contentVersion },
        semanticResolution: "published-model-and-formal-report",
        semanticBinding,
        semanticVersionId: semanticBinding.semanticVersionId,
        semanticVersion: semanticBinding.semanticVersion,
        dataAssetVersionId: semanticBinding.dataAssetVersionId,
        dataVersion: semanticBinding.dataVersion,
        consumableVersionId: semanticBinding.consumableVersionId,
        asOf: semanticBinding.asOf,
        trustAtGeneration: {
          id: evidenceByType.get("QUALITY_RESULT")?.evidenceId,
          version: evidenceByType.get("QUALITY_RESULT")?.evidenceVersion || "1.0.0",
          formedAt: content.generatedAt,
          status: "ready",
          publishedQuality: "质量检查通过",
          freshness: "固定运行证据",
          readiness: "可消费"
        },
        permission: { id: `PERM-${content.reportId}`, version: "1.0", status: "allowed", scope: "当前正式报告及绑定证据" },
        verificationReference: {
          runId: `${content.reportId}-CURRENT-VERIFY`,
          resultVersion: resources.reportAssurance?.profileVersion || "1.1.0",
          status: "当前跨模块核验",
          reportFormationSummary: clone(content.verificationSummary || null)
        },
        comparisonMode: "snapshot-only",
        comparisonReference: null,
        contentFacts: [
          { id: `${content.reportId}-FINAL-SCORE`, label: "最终评分", kind: "Metric", value: content.assessment.finalScore, unit: "分", displayValue: `${Number(content.assessment.finalScore).toFixed(2)} 分`, evidenceRefs: [evidenceByType.get("C035_RESULT")?.evidenceId].filter(Boolean) },
          { id: `${content.reportId}-RISK-TIER`, label: "风险分档", kind: "RiskTier", value: content.assessment.riskTier?.tierId, displayValue: content.assessment.riskTier?.name, evidenceRefs: [evidenceByType.get("PUBLISHED_RISK_FACT")?.evidenceId].filter(Boolean) }
        ],
        semanticResources: [profileModel.pointerId, profileModel.semanticVersionId, data.dataAssetId].filter(Boolean)
      }
    };
  }

  function s003CompanionRequestState(content, question) {
    const stored = readStoredObject(C024_INBOX_KEY);
    const requests = Array.isArray(stored) ? stored : Array.isArray(stored?.requests) ? stored.requests : [];
    const request = requests.slice().reverse().find((item) => {
      const reportContext = item?.reportContext || {};
      return item?.requestId
        && (reportContext.reportId || reportContext.reportNumber) === content?.reportId
        && reportContext.contentVersion === content?.contentVersion
        && item.question === question?.label
        && sameScenarioContext(normalizeScenarioContext(reportContext.scenarioContext || {}), normalizeScenarioContext(content?.scenarioIdentity || {}));
    }) || null;
    if (!request) return null;
    const external = OWNERS.agent.getQA?.(request.requestId) || null;
    return {
      requestId: request.requestId,
      question: request.question,
      reportId: content.reportId,
      contentVersion: content.contentVersion,
      questionId: question.questionId,
      status: external?.status || "等待 Agent 应用接收",
      submittedAt: external?.submittedAt || request.receivedAt || stored?.formedAt || null,
      bindingId: external?.bindingId || external?.contextBindingId || null,
      sessionId: external?.sessionId || null,
      runId: external?.runId || null,
      resultId: external?.resultId || null,
      answer: external?.answer || external?.text || null,
      failure: external?.failure || null
    };
  }

  function s003ReportChapterCatalog() {
    return [
      { sectionId: "executive-summary", domId: "s003-report-summary", label: "执行摘要" },
      { sectionId: "key-risk-diagnosis", domId: "s003-report-diagnosis", label: "关键风险诊断" },
      { sectionId: "adjustment-factors", domId: "s003-report-factors", label: "调节因子" },
      { sectionId: "financial-indicators", domId: "s003-report-indicators", label: "财务指标" },
      { sectionId: "rule-basis", domId: "s003-report-rules", label: "规则与语义" },
      { sectionId: "risk-strategy", domId: "s003-report-strategy", label: "应对策略" },
      { sectionId: "three-month-plan", domId: "s003-report-three-months", label: "三个月行动" },
      { sectionId: "disposition-status", domId: "s003-report-action", label: "风险行动" },
      { sectionId: "verification-and-evidence", domId: "s003-report-evidence", label: "版本与证据" }
    ];
  }

  function s003ReportChapterPlan(content, template) {
    const catalog = s003ReportChapterCatalog();
    const byId = new Map(catalog.map((chapter) => [chapter.sectionId, chapter]));
    const requested = Array.isArray(content?.chapterOrder) && content.chapterOrder.length
      ? content.chapterOrder
      : (template?.sections || []).map((section) => section.sectionId);
    const ordered = [];
    const seen = new Set();
    requested.forEach((sectionId) => {
      const chapter = byId.get(sectionId);
      if (!chapter || seen.has(sectionId)) return;
      seen.add(sectionId);
      ordered.push(chapter);
    });
    catalog.forEach((chapter) => {
      if (seen.has(chapter.sectionId)) return;
      seen.add(chapter.sectionId);
      ordered.push(chapter);
    });
    return ordered.map((chapter, index) => ({ ...chapter, no: String(index + 1).padStart(2, "0") }));
  }

  function s003OrderReportPaper(markup, chapters) {
    const template = document.createElement("template");
    template.innerHTML = String(markup || "").trim();
    const article = template.content.firstElementChild;
    if (!article) return markup;
    const footer = article.querySelector(":scope > .s003-report-footer");
    chapters.forEach((chapter) => {
      const section = article.querySelector(`#${chapter.domId}`);
      if (!section) return;
      const number = section.querySelector(":scope > .s003-report-section-heading > span");
      if (number) number.textContent = chapter.no;
      article.insertBefore(section, footer || null);
    });
    return article.outerHTML;
  }

  function s003ReportSectionLabel(sectionId) {
    return s003ReportChapterCatalog().find((chapter) => chapter.sectionId === sectionId)?.label || sectionId;
  }

  function s003EvidenceTypeLabel(evidenceType) {
    return ({
      C035_RESULT: "企业风险评估结果",
      PUBLISHED_RISK_FACT: "已发布风险事实",
      PUBLISHED_MODEL_POINTER: "已发布模型指针",
      FORMAL_DATA_ASSET: "正式数据资产",
      HUMAN_INPUT_SNAPSHOT: "企业因子输入快照",
      QUALITY_RESULT: "数据质量结果",
      REPORT_CONTRACT: "报告合同",
      DECISION_RESULT: "决策与待办状态"
    })[evidenceType] || evidenceType;
  }

  function s003TemplateComponentLabel(component) {
    return ({
      "enterprise-identity": "企业身份",
      "assessment-context": "评估上下文",
      "score-card": "评分卡",
      "risk-tier-badge": "风险分档",
      "conclusion-callout": "总体结论",
      "lowest-three-indicators": "最低三项指标",
      "negative-factor-diagnosis": "负向因子诊断",
      "default-semantics-summary": "默认语义摘要",
      "evidence-pointers": "证据指针",
      "factor-table": "调节因子表",
      "factor-state-summary": "因子状态摘要",
      "default-semantics": "默认语义",
      "indicator-table": "15 项指标表",
      "weight-total": "权重合计",
      "raw-score-summary": "原始评分摘要",
      "composite-formula": "综合评分公式",
      "construction-default": "在建企业固定 60 分",
      "profit-history-default": "盈利历史不足按 A",
      "missing-factor-default": "缺失因子套 0 档",
      "not-applicable-semantics": "不适用语义",
      "tier-rule": "风险分档规则",
      "tier-management-focus": "分档管理重点",
      "indicator-recommendations": "指标改善建议",
      "factor-mitigation-recommendations": "因子缓释建议",
      "month-one-verification": "第 1 月风险核实",
      "month-two-tracking": "第 2 月改善跟踪",
      "month-three-reassessment": "第 3 月重新评估",
      "no-automatic-side-effects-note": "不自动触发副作用说明",
      "trigger-classification": "风险触发分类",
      "candidate-list": "分档预警行动",
      "action-request-and-todo-status": "行动申请与待办状态",
      "verification-summary": "核验摘要",
      "version-binding": "版本绑定",
      "evidence-index": "证据索引",
      "artifact-downloads": "正式产物下载"
    })[component] || component;
  }

  function s003VerificationStatus(item) {
    if (item?.passed === true) return "pass";
    if (item?.severity === "warning") return "warn";
    if (!item?.detail) return "unverifiable";
    return "fail";
  }

  function s003VerificationSeverityLabel(value) {
    return ({
      blocking: "阻断级核验",
      warning: "提示级核验",
      informational: "信息级核验"
    })[String(value || "").toLowerCase()] || "确定性核验";
  }

  function s003VerificationDetail(item) {
    return item?.detail || `核验编号 ${item?.checkId || "未取得"} · ${s003VerificationSeverityLabel(item?.severity)}`;
  }

  function s003VerificationAnchor(checkId) {
    return ({
      "scenario-identity": "s003-report-evidence",
      "published-binding": "s003-report-evidence",
      "score-record": "s003-report-summary",
      "indicator-coverage": "s003-report-indicators",
      "factor-coverage": "s003-report-factors",
      "evidence-coverage": "s003-report-evidence",
      "artifact-identity": "s003-report-evidence",
      "side-effect-boundary": "s003-report-action",
      "localized-business-status": "s003-report-evidence",
      "structured-trigger": "s003-report-action",
      "diagnosis-value-format": "s003-report-diagnosis",
      "decision-status-alignment": "s003-report-action",
      "construction-semantics": "s003-report-diagnosis"
    })[checkId] || "s003-report-evidence";
  }

  function s003ReportComparison(content, resources) {
    const current = (resources?.results?.results || []).find((item) => item.enterprise?.enterpriseId === content?.enterprise?.enterpriseId) || null;
    const sameRun = sameScenarioContext(normalizeScenarioContext(content?.scenarioIdentity || {}), s003ResourceContext(resources));
    const comparable = Boolean(current && sameRun);
    const scoreDelta = comparable ? Number(current.finalScore || 0) - Number(content.assessment?.finalScore || 0) : null;
    const tierChanged = comparable && s003Tier(current) !== content.assessment?.riskTier?.tierId;
    const modelAhead = s003ModelConfigurationAhead(resources);
    return `<div class="s003-current-comparison"><div class="context-box"><span>与当前评分批次比较</span><strong>${comparable ? scoreDelta === 0 && !tierChanged ? "评分与分档无变化" : "发现评分结果差异" : "无法比较"}</strong><small>${comparable ? "报告与当前正式评分来自同一批次；比较不会改写正式报告。" : "当前评分批次与报告不一致，系统不会借用其他批次结果。"}</small></div><div class="verification-summary"><div><span>报告评分</span><strong>${Number(content.assessment?.finalScore || 0).toFixed(2)}</strong></div><div><span>当前评分</span><strong>${comparable ? Number(current.finalScore || 0).toFixed(2) : "—"}</strong></div><div><span>报告分档</span><strong>${esc(content.assessment?.riskTier?.name || "—")}</strong></div><div><span>当前分档</span><strong>${comparable ? esc(s003TierName(current)) : "—"}</strong></div></div>${modelAhead ? `<div class="notice warning">${icon("shield-alert")}<div><strong>模型配置已领先于本次评分</strong><span>新配置尚未重跑，不能替代本报告采用的已发布模型和评分结果。</span></div></div>` : `<div class="notice success">${icon("circle-check")}<div><strong>当前评分与报告一致</strong><span>评分、分档和评估时点均来自同一正式评分批次。</span></div></div>`}</div>`;
  }

  function s003ReportAssistantQA(content, resources, contextState) {
    const questions = resources?.reportAssurance?.companionQuestions || [];
    const selected = questions.find((item) => item.questionId === s003Dashboard.companionQuestionId) || questions[0] || { questionId: "risk-summary", label: "这家企业的总体风险结论是什么？" };
    const draft = s003Dashboard.companionDraft === null ? selected.label : s003Dashboard.companionDraft;
    const questionRef = { questionId: draft.trim() === selected.label ? selected.questionId : "custom", label: draft.trim() };
    const memoryRequest = s003Dashboard.companionRequestRef?.reportId === content.reportId
      && s003Dashboard.companionRequestRef?.question === questionRef.label
      ? s003Dashboard.companionRequestRef
      : null;
    const requestRef = questionRef.label ? s003CompanionRequestState(content, questionRef) || memoryRequest : null;
    const canSubmit = contextState.isCurrent && !contextState.projectionOnly && Boolean(questionRef.label) && profileReadyForS003Companion(resources, content);
    const fixedAnswer = s003CompanionAnswer(selected.questionId, content, resources);
    const messages = !questionRef.label
      ? `<div class="notice"><div><strong>选择一个推荐问题或输入新问题</strong><span>已清空的会话不会影响推荐问题和当前正式报告上下文。</span></div></div>`
      : requestRef?.answer
      ? `<div class="message user"><p>${esc(requestRef.question || questionRef.label)}</p></div><div class="message assistant"><p>${esc(requestRef.answer)}</p><div class="message-meta"><span>报告快照 · ${esc(content.assessment.assessmentAt)}</span><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="${esc(s003Dashboard.formalReportSection || "s003-report-summary")}">定位证据</button><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="s003-report-evidence">打开证据</button></div></div>`
      : requestRef
        ? requestRef.failure
          ? `<div class="notice danger">${icon("circle-x")}<div><strong>本次问题暂无法回答</strong><span>${esc(requestRef.failure)}</span></div></div>`
          : `<div class="message user"><p>${esc(requestRef.question || questionRef.label)}</p></div><div class="message assistant"><p>${esc(fixedAnswer)}</p><div class="message-meta"><span>当前报告内容</span><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="${esc(s003Dashboard.formalReportSection || "s003-report-summary")}">定位正文</button><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="s003-report-evidence">查看证据</button></div></div>`
        : `<div class="message assistant s003-fixed-reading"><p>${esc(fixedAnswer)}</p><div class="message-meta"><span>固定字段解读 · 未调用 Agent · 不重算评分</span><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="${esc(s003Dashboard.formalReportSection || "s003-report-summary")}">定位正文</button><button class="citation-link" type="button" data-action="s003-jump-report-section" data-section="s003-report-evidence">打开证据</button></div></div>`;
    return `
      <div class="assistant-content s003-assistant-content">
        <div class="context-box"><span>当前上下文</span><strong>${esc(content.enterprise.name)} · ${esc(s003ReportSectionLabel(s003ReportChapterCatalog().find((item) => item.domId === s003Dashboard.formalReportSection)?.sectionId || "executive-summary"))}</strong><small>问答只使用当前正式报告、固定证据与 Published 双版本；不会读取工作簿成员明细、重算评分或创建行动申请。</small></div>
        <div class="suggestion-list">${questions.map((item) => `<button class="suggestion-chip" type="button" data-action="s003-fill-companion-question" data-question-id="${esc(item.questionId)}">${esc(item.label)}</button>`).join("")}</div>
        ${messages}
        ${requestRef?.answer ? `<div class="notice success">${icon("bot")}<div><strong>Agent 应用只读返回</strong><span>${esc([requestRef.sessionId && `Session ${requestRef.sessionId}`, requestRef.runId && `Run ${requestRef.runId}`, requestRef.resultId && `Result ${requestRef.resultId}`].filter(Boolean).join(" · ") || requestRef.requestId)}</span></div><button class="text-link" type="button" data-action="s003-navigate-module" data-module="agent" data-hash="#/runs">查看 Agent 记录</button></div>` : ""}
        ${s003Dashboard.reportCompareOpen ? s003ReportComparison(content, resources) : ""}
      </div>
      <div class="assistant-compose">
        <div class="compose-row"><input class="input" type="text" value="${esc(draft)}" data-input="s003-companion-draft" placeholder="询问当前报告或所选章节"><button class="btn primary icon-only" type="button" data-action="s003-submit-companion-agent" data-report-id="${esc(content.reportId)}" title="发送" ${canSubmit ? "" : "disabled"}>${icon("send", "sm")}</button></div>
        <div class="inline-actions"><button class="text-link" type="button" data-action="s003-clear-companion-session">清空会话</button><button class="text-link" type="button" data-action="s003-toggle-report-comparison">${s003Dashboard.reportCompareOpen ? "收起当前比较" : "与当前运行比较"}</button><button class="text-link" type="button" data-action="s003-jump-report-section" data-section="s003-report-evidence">查看追溯</button></div>
        ${canSubmit ? "" : `<small class="s003-agent-boundary-note">只有当前 Published 正式运行、M05 通用报告伴读配置及完整证据身份对齐时才能提交。</small>`}
      </div>`;
  }

  function s003ReportAssistantVerification(content, resources, verification, formalVerification) {
    const normalized = verification.map((item) => ({ ...item, status: s003VerificationStatus(item), anchor: s003VerificationAnchor(item.checkId) }));
    const counts = normalized.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, { pass: 0, warn: 0, fail: 0, unverifiable: 0 });
    const filtered = s003Dashboard.verificationFilter === "issues" ? normalized.filter((item) => item.status !== "pass") : normalized;
    const selected = normalized.find((item) => item.checkId === s003Dashboard.selectedVerificationCheckId) || null;
    return `
      <div class="assistant-content s003-assistant-content">
        <div class="context-box"><span>核验范围</span><strong>整份正式报告 · 当前跨模块重读</strong><small>报告形成时核验保持不可变；当前核验重新读取同运行 C011/C019、报告产物和 Published 绑定，不把历史 13/13 直接当作当前健康。</small></div>
        <div class="verification-summary"><div><span>通过</span><strong>${counts.pass}</strong></div><div><span>警告</span><strong>${counts.warn}</strong></div><div><span>失败</span><strong>${counts.fail}</strong></div><div><span>无法核验</span><strong>${counts.unverifiable}</strong></div></div>
        <div class="detail-list"><div class="detail-row"><span>报告形成时</span><strong>${Number(formalVerification.passedCount || 0)} / ${Number(formalVerification.checkCount || 0)} 通过 · 内容版本 ${esc(content.contentVersion)}</strong></div><div class="detail-row"><span>当前重读</span><strong>${counts.pass} / ${normalized.length} 通过 · ${counts.fail + counts.unverifiable} 项阻断</strong></div></div>
        <div class="segmented"><button type="button" class="${s003Dashboard.verificationFilter === "all" ? "active" : ""}" data-action="s003-set-verification-filter" data-filter="all">全部</button><button type="button" class="${s003Dashboard.verificationFilter === "issues" ? "active" : ""}" data-action="s003-set-verification-filter" data-filter="issues">仅看问题</button></div>
        <div class="verification-list">${filtered.map((item) => `<div class="verification-item">${statusIcon(item.status)}<div><h4>${esc(item.label)}</h4><p>${esc(s003VerificationDetail(item))}</p></div><div class="s003-verification-actions"><button class="text-link" type="button" data-action="s003-locate-verification" data-check-id="${esc(item.checkId)}">定位</button><button class="text-link" type="button" data-action="s003-explain-verification" data-check-id="${esc(item.checkId)}">说明</button></div></div>`).join("") || `<div class="notice success">${icon("circle-check")}<div><strong>当前没有异常项</strong><span>切换“全部”可查看完整确定性检查清单。</span></div></div>`}</div>
        ${selected ? `<div class="notice ${selected.status === "pass" ? "success" : selected.status === "warn" ? "warning" : "danger"}">${icon(selected.status === "pass" ? "circle-check" : "shield-alert")}<div><strong>${esc(selected.label)}</strong><span>${esc(s003VerificationDetail(selected))}；证据位置：${esc(s003ReportSectionLabel(s003ReportChapterCatalog().find((item) => item.domId === selected.anchor)?.sectionId || "verification-and-evidence"))}。</span></div><button class="text-link" type="button" data-action="s003-jump-report-section" data-section="${esc(selected.anchor)}">定位证据</button></div>` : ""}
        ${s003Dashboard.reportCompareOpen ? s003ReportComparison(content, resources) : ""}
      </div>
      <div class="assistant-compose"><div class="button-row"><button class="btn" type="button" data-action="s003-refresh-verification">${icon("refresh-cw", "sm")}重新读取核验</button><button class="btn" type="button" data-action="s003-toggle-report-comparison">${icon("git-compare-arrows", "sm")}${s003Dashboard.reportCompareOpen ? "收起比较" : "与当前运行比较"}</button></div><button class="text-link" type="button" data-action="s003-jump-report-section" data-section="s003-report-evidence">查看追溯</button></div>`;
  }

  function s003ReportAssistantPane(content, resources, contextState, verification, formalVerification) {
    const activeTab = s003Dashboard.formalReportTab === "verification" ? "verification" : "qa";
    return `<aside class="assistant-pane"><div class="pane-heading"><strong>报告助手</strong><small>以当前报告版本绑定的证据包为根</small></div><div class="assistant-tabs"><button class="${activeTab === "qa" ? "active" : ""}" type="button" data-action="s003-set-report-assistant-tab" data-tab="qa">报告问答</button><button class="${activeTab === "verification" ? "active" : ""}" type="button" data-action="s003-set-report-assistant-tab" data-tab="verification">自动核验</button></div>${activeTab === "verification" ? s003ReportAssistantVerification(content, resources, verification, formalVerification) : s003ReportAssistantQA(content, resources, contextState)}</aside>`;
  }

  function renderS003FormalReport() {
    if (s003Dashboard.status === "idle") void loadS003Dashboard();
    if (s003Dashboard.status !== "ready") return renderShell(`<div class="page"><div class="page-header"><div><h1>企业债务风险评估报告</h1><p>正在读取当前运行的正式报告资源。</p></div></div>${s003NativeProviderNotice()}</div>`, { crumb: "企业报告" });
    const requestedRunId = routeInfo().query.get("runId");
    if (requestedRunId && requestedRunId !== s003Dashboard.selectedRunId && s003RunOptions().some((run) => run.runId === requestedRunId)) {
      s003Dashboard.selectedRunId = requestedRunId;
      s003Dashboard.resources = s003ResourcesForRun(requestedRunId);
    }
    const resources = s003Dashboard.resources;
    const contextState = s003ContextState(resources);
    const currentRoute = routeInfo().path;
    const draftSnapshot = currentRoute === "/reports/draft";
    const printView = currentRoute === "/reports/pdf";
    const requestedReportId = routeInfo().query.get("reportId");
    const requestedEnterpriseId = routeInfo().query.get("enterpriseId");
    const selected = (resources?.reportContents?.reports || []).find((report) => requestedReportId && report.content?.reportId === requestedReportId)
      || (resources?.reportContents?.reports || []).find((report) => report.content?.enterprise?.enterpriseId === (requestedEnterpriseId || s003Dashboard.selectedEnterpriseId))
      || resources?.reportContents?.reports?.[0]
      || null;
    const content = selected?.content;
    if (!content) return renderShell(`<div class="page"><div class="page-header"><div><h1>企业报告不可定位</h1><p>当前运行没有该企业的逐户报告明细。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=products">返回正式报告</button></div></div><div class="empty-state"><div><h2>请切换到保留完整报告明细的运行</h2><p>系统不会借用其他 scenarioRunId 的企业报告替代。</p></div></div></div>`, { crumb: "企业报告" });
    const contentReady = Boolean(
      content.conclusion
      && Array.isArray(content.keyRiskDiagnosis?.indicatorItems)
      && Array.isArray(content.keyRiskDiagnosis?.factorItems)
      && content.responseStrategy?.headline
      && content.responseStrategy?.guidance
      && Array.isArray(content.responseStrategy?.indicatorStrategies)
      && Array.isArray(content.responseStrategy?.factorStrategies)
      && Array.isArray(content.responseStrategy?.managementPortfolios)
      && content.responseStrategy.managementPortfolios.length
      && Array.isArray(content.threeMonthActionPlan)
      && content.threeMonthActionPlan.length === 3
      && Array.isArray(content.chapterOrder)
      && content.chapterOrder.length === 9
      && content.verificationSummary?.deterministic === true
      && (contextState.projectionOnly || (Array.isArray(content.verificationResults)
        && content.verificationResults.length === content.verificationSummary.checkCount
        && content.verificationSummary.derivedFromResults === true))
    );
    if (!contentReady) return renderShell(`<div class="page"><div class="page-header"><div><h1>正式报告内容版本不完整</h1><p>${esc(content.reportId)} 未满足九章正文、诊断、策略、三个月计划和确定性核验合同。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=products">返回正式报告</button></div></div><div class="notice danger">${icon("file-warning")}<div><strong>已阻断备用文案拼装</strong><span>报告中心不会用 UI 默认文案补造正式内容；请恢复该报告绑定的正式内容资源。</span></div></div></div>`, { crumb: "企业报告" });
    const enterpriseId = content.enterprise.enterpriseId;
    s003Dashboard.selectedEnterpriseId = enterpriseId;
    const verification = s003ReportVerification(content, resources);
    const passed = verification.filter((item) => item.passed).length;
    const formalVerification = content.verificationSummary;
    const artifact = s003ReportArtifact(content.reportId, resources);
    const candidates = s003DecisionCandidates(resources).filter((item) => item.enterpriseId === enterpriseId);
    const majorFactorCandidates = candidates.filter((item) => item.trigger?.type === "MAJOR_FACTOR");
    const immutableEscalation = content.managementEscalation?.triggered ? content.managementEscalation : null;
    const escalationFactors = immutableEscalation?.factors?.length
      ? immutableEscalation.factors
      : majorFactorCandidates.map(s003CandidateTriggerText);
    const managementEscalation = escalationFactors.length
      ? `<div class="notice warning s003-report-management-escalation">${icon("triangle-alert", "sm")}<div><strong>重大因子作为亮灯预警的补充证据</strong><span>本轮综合评分仍为${esc(content.assessment.riskTier?.name || "待评估")}；同时命中${esc(escalationFactors.join("、"))}。重大因子不单独形成行动：黄灯、红灯、黑灯随本轮亮灯预警由成员单位接口人一并核实，绿灯仅保留诊断证据。</span></div></div>`
      : "";
    const modelVersion = s003EvidenceByType(content, "PUBLISHED_MODEL_POINTER")?.packageVersion || resources?.runtime?.runModelVersion || resources?.publishedModel?.packageVersion;
    const reportMode = contextState.projectionOnly ? "工作预览" : draftSnapshot ? "形成时复核快照" : printView ? "打印 / PDF 视图" : "正式报告";
    const negativeFactors = (content.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0);
    const indicatorDiagnosis = content.keyRiskDiagnosis.indicatorItems;
    const factorDiagnosis = content.keyRiskDiagnosis.factorItems;
    const concreteStrategy = s003ConcreteReportStrategy(content, candidates);
    const responseHeadline = concreteStrategy.headline;
    const responseGuidance = concreteStrategy.guidance;
    const indicatorStrategies = concreteStrategy.indicatorStrategies;
    const factorStrategies = concreteStrategy.factorStrategies;
    const threeMonthPlan = concreteStrategy.threeMonthActionPlan;
    const indicatorByName = new Map((content.indicatorDetails || []).map((item) => [item.name, item]));
    const factorByName = new Map((content.adjustmentFactors || []).map((item) => [item.name, item]));
    const strategyPortfolio = concreteStrategy.managementPortfolios;
    const chapters = s003ReportChapterPlan(content, resources.reportTemplate);
    const reportRouteParams = { enterpriseId, reportId: content.reportId, runId: content.scenarioIdentity?.scenarioRunId };
    const s003ReaderMore = `<div class="reader-more"><button class="btn" type="button" data-action="toggle-reader-more" aria-haspopup="menu" aria-expanded="${state.ui.readerMoreOpen ? "true" : "false"}">${icon("ellipsis", "sm")}更多${icon("chevron-down", "sm")}</button>${state.ui.readerMoreOpen ? `<div class="reader-more-menu" role="menu" aria-label="报告浏览操作"><button type="button" role="menuitem" data-action="s003-open-formation-review">${icon("scan-text", "sm")}<span><strong>形成时复核</strong><small>只读查看形成时核验快照</small></span></button><button type="button" role="menuitem" data-action="s003-download-report-html" data-report-id="${esc(content.reportId)}">${icon("download", "sm")}<span><strong>下载 HTML</strong><small>下载当前正式报告固定产物</small></span></button><button type="button" role="menuitem" data-action="s003-open-report-pdf">${icon("file-text", "sm")}<span><strong>打印 / PDF</strong><small>打开同源打印视图</small></span></button><button type="button" role="menuitem" data-action="s003-locate-report-evidence">${icon("shield-check", "sm")}<span><strong>查看数据状态</strong><small>定位当前报告版本、数据和证据</small></span></button><button type="button" role="menuitem" data-action="s003-open-report-lifecycle">${icon("git-branch", "sm")}<span><strong>查看生命周期</strong><small>回到基线报告生命周期工作区</small></span></button></div>` : ""}</div>`;
    const actionButtons = contextState.projectionOnly
      ? `<button class="btn" type="button" disabled>报告形成后可下载</button>`
      : printView
        ? `<button class="btn" type="button" data-action="navigate" data-route="${esc(s003ReportRoute("/reports/view", reportRouteParams))}">${icon("book-open", "sm")}返回正式报告</button><button class="btn primary" type="button" data-action="s003-print-formal-report">${icon("printer", "sm")}打印 / 另存为 PDF</button>`
        : draftSnapshot
          ? `<button class="btn primary" type="button" data-action="navigate" data-route="${esc(s003ReportRoute("/reports/view", reportRouteParams))}">${icon("book-open", "sm")}返回正式报告</button><button class="btn" type="button" data-action="s003-open-report-lifecycle">${icon("git-branch", "sm")}查看生命周期</button>`
          : `<button class="btn primary" type="button" data-action="s003-open-report-lifecycle">${icon("refresh-cw", "sm")}生成新内容版本</button>${s003ReaderMore}`;
    const toc = `<aside class="reader-toc"><div class="pane-heading"><strong>章节目录</strong><small>点击章节定位正文</small></div><div class="toc-list">${chapters.map((chapter) => `<button class="toc-link ${s003Dashboard.formalReportSection === chapter.domId ? "active" : ""}" type="button" data-action="s003-jump-report-section" data-section="${chapter.domId}"><em>${chapter.no}</em><span>${esc(chapter.label)}</span></button>`).join("")}</div><div class="toc-meta"><span class="badge plain">内容版本 ${esc(content.contentVersion)}</span><span class="badge plain">评估时点 ${esc(content.assessment.assessmentAt)}</span><span class="badge plain">模型 ${esc(modelVersion)}</span><button class="text-link" type="button" data-action="navigate" data-route="/reports?tab=products">返回报告目录</button></div></aside>`;
    const assistant = s003ReportAssistantPane(content, resources, contextState, verification, formalVerification);
    const formationVerificationTable = (content.verificationResults || []).length
      ? `<div class="data-table-wrap s003-formation-verification"><table class="data-table"><thead><tr><th>形成时检查项</th><th>结果</th><th>证据</th><th>影响 / 责任 / 建议</th></tr></thead><tbody>${content.verificationResults.map((item) => `<tr><td><strong>${esc(item.label)}</strong><small class="table-subline">${esc(item.checkId)}</small></td><td>${badge(item.status, item.passed ? "success" : "danger")}</td><td>${esc(item.evidence)}</td><td><strong>影响：</strong>${esc(item.impact)}<small class="table-subline"><strong>责任：</strong>${esc(item.responsibility)}</small><small class="table-subline"><strong>建议：</strong>${esc(item.recommendation)}</small></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="notice warning"><div><strong>形成时逐项核验正在准备</strong><span>本次评估报告尚未形成固定核验结果；页面不会用当前读取结果替代形成时证据。</span></div></div>`;
    const reportPaperSource = `<article class="report-paper s003-formal-document">
      <header class="s003-report-cover"><div><span>智财问策 · 集团债务风险监测</span><h1><span class="s003-report-company">${esc(content.enterprise.name)}</span><span class="s003-report-document-title">企业债务风险评估报告</span></h1><p>${esc(content.enterprise.sector)} · ${esc(content.enterprise.category)}</p></div><div class="s003-report-cover-score"><strong>${Number(content.assessment.finalScore).toFixed(2)}</strong>${s003TierBadge({ riskTier: content.assessment.riskTier })}<small>评估时点 ${esc(content.assessment.assessmentAt)}</small></div><dl><div><dt>报告编号</dt><dd>${esc(content.reportId)}</dd></div><div><dt>内容版本</dt><dd>${esc(content.contentVersion)}</dd></div><div><dt>币种 / 金额单位</dt><dd>${esc(content.assessment.currency)} / ${esc(content.assessment.amountUnit)}</dd></div><div><dt>业务 Owner</dt><dd>${esc(content.businessOwner || "财务公司")}</dd></div></dl></header>
      <section id="s003-report-summary"><div class="s003-report-section-heading"><span>01</span><div><h2>执行摘要与总体结论</h2><p>结论仅适用于本报告锁定的评估时点、模型版本、输入版本和 scenarioRunId。</p></div></div><div class="s003-executive-conclusion"><strong>${esc(content.conclusion)}</strong><p>${esc(responseGuidance || s003TierGuidance(content.assessment.riskTier?.tierId))}</p></div>${managementEscalation}<div class="s003-score-composition"><div><span>原始评分</span><strong>${Number(content.assessment.rawScore).toFixed(2)}</strong></div><div><span>调节因子合计</span><strong>${Number(content.assessment.factorSum) > 0 ? "+" : ""}${Number(content.assessment.factorSum).toFixed(2)}</strong></div><div><span>综合调节系数</span><strong>${Number(content.assessment.compositeAdjustment).toFixed(2)}</strong></div><div><span>最终评分</span><strong>${Number(content.assessment.finalScore).toFixed(2)}</strong></div></div><div class="s003-report-callout"><strong>评分口径</strong><p>${content.assessment.isUnderConstruction ? "在建企业原始基础分按已裁决固定 60 分处理，并继续叠加适用调节因子；15 项财务指标不逐项形成得分排序。" : "经营企业按当前 Published 模型的 15 项指标、权重和调节因子形成最终评分。"}</p></div></section>
      <section id="s003-report-diagnosis"><div class="s003-report-section-heading"><span>02</span><div><h2>关键风险诊断说明</h2><p>正文直接采用当前正式报告内容版本已固定的诊断条目，并补充同一运行内的实际值、评分表现和证据出处。</p></div></div><div class="s003-diagnosis-list">${indicatorDiagnosis.map((diagnosis, index) => { const indicator = indicatorByName.get(diagnosis.title) || (content.keyIndicators || [])[index] || {}; const construction = diagnosis.type === "construction"; const actualValue = diagnosis.actualValueDisplay || s003ReportIndicatorValue(indicator, content.assessment); const score = diagnosis.currentScore == null ? Number(indicator.score ?? 0).toFixed(2) : Number(diagnosis.currentScore).toFixed(2); return `<article class="${construction ? "construction" : ""}"><span>${construction ? "建" : String(index + 1).padStart(2, "0")}</span><div><h3>${esc(diagnosis.title)} · ${construction ? "固定口径" : `实际值 ${actualValue} · 得分 ${score}`}</h3><p>${esc(diagnosis.statement)}</p>${diagnosis.verificationFocus ? `<p class="s003-diagnosis-recommendation"><strong>核验重点：</strong>${esc(diagnosis.verificationFocus)}</p>` : ""}<small>证据引用：${esc(diagnosis.evidencePointer || indicator.evidencePointer || "当前报告固定指标明细")}</small></div></article>`; }).join("")}${factorDiagnosis.map((diagnosis, index) => { const factor = factorByName.get(diagnosis.title) || negativeFactors[index] || {}; return `<article class="factor"><span>F${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(diagnosis.title)} · 系数 ${Number(factor.coefficient || 0).toFixed(2)}</h3><p>${esc(diagnosis.statement)}</p>${diagnosis.recommendation ? `<p class="s003-diagnosis-recommendation"><strong>建议：</strong>${esc(diagnosis.recommendation)}</p>` : ""}<small>证据引用：${esc(diagnosis.evidencePointer || factor.factorId || "当前报告固定调节因子明细")} · ${esc(s003FactorStateLabel(factor.state || "APPLIED"))}</small></div></article>`; }).join("")}</div><div class="s003-diagnosis-grid"><article><span>负向调节因子</span><strong>${Number(content.keyRiskDiagnosis?.negativeFactorCount ?? negativeFactors.length)} 项</strong><small>${negativeFactors.map((item) => item.name).join("、") || "本轮无负向调节因子"}</small></article><article><span>缺失套零档</span><strong>${Number(content.keyRiskDiagnosis?.defaultedZeroCount ?? content.factorStateSummary?.DEFAULTED_ZERO ?? 0)} 项</strong><small>适用但缺失时采用零系数档，并保留“缺失套零档”标记</small></article><article><span>业务不适用</span><strong>${Number(content.keyRiskDiagnosis?.notApplicableCount ?? content.factorStateSummary?.NOT_APPLICABLE ?? 0)} 项</strong><small>业务不适用与缺失取值分离记录，不参与调节</small></article></div></section>
      ${content.assessment.isUnderConstruction
        ? `<section id="s003-report-indicators"><div class="s003-report-section-heading"><span>03</span><div><h2>财务指标口径清单</h2><p>在建企业固定 60 分；保留指标定义与公式，不展示虚假的实际值、权重合计或最低指标排序。</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>指标名称</th><th>Published 公式</th><th>本轮状态</th><th>说明</th></tr></thead><tbody>${(content.indicatorDetails || []).map((item) => `<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.formula || "—")}</td><td>${esc(s003IndicatorStateLabel(item.status, item.marker))}</td><td>${esc(s003IndicatorStateNote(item))}</td></tr>`).join("")}</tbody></table></div></section>`
        : `<section id="s003-report-indicators"><div class="s003-report-section-heading"><span>03</span><div><h2>财务指标评分明细</h2><p>展示实际值、得分、权重、加权得分、公式和适用状态。</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>指标名称</th><th>实际值</th><th class="num">得分</th><th class="num">权重</th><th class="num">加权得分</th><th>公式 / 备注</th></tr></thead><tbody>${(content.indicatorDetails || []).map((item) => `<tr><td><strong>${esc(item.name)}</strong><small class="table-subline">${esc(s003IndicatorStateLabel(item.status, item.marker))}</small></td><td>${s003ReportIndicatorValue(item, content.assessment)}</td><td class="num"><strong>${Number(item.score || 0).toFixed(2)}</strong></td><td class="num">${Number(item.weightPercent || Number(item.weight || 0) * 100).toFixed(0)}%</td><td class="num">${Number(item.weightedScore || 0).toFixed(2)}</td><td>${esc(item.formula || "—")}<small class="table-subline">${esc(s003IndicatorStateNote(item))}</small></td></tr>`).join("")}<tr class="s003-total-row"><td><strong>合计</strong></td><td>—</td><td class="num">—</td><td class="num"><strong>${(content.indicatorDetails || []).reduce((sum, item) => sum + Number(item.weightPercent || Number(item.weight || 0) * 100), 0).toFixed(0)}%</strong></td><td class="num"><strong>${Number(content.assessment.rawScore).toFixed(2)}</strong></td><td>原始评分</td></tr></tbody></table></div></section>`}
      <section id="s003-report-factors"><div class="s003-report-section-heading"><span>04</span><div><h2>调节因子明细</h2><p>企业人工取值与 Published 模型规则分离保存；本表展示本轮固定结果。</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>因子</th><th>企业取值</th><th>分档</th><th class="num">系数</th><th>适用状态</th><th>重大风险</th></tr></thead><tbody>${(content.adjustmentFactors || []).map((factor) => `<tr><td><strong>${esc(factor.name)}</strong><small class="table-subline">${esc(factor.factorId)}</small></td><td>${esc(factor.inputValue ?? "—")}</td><td>${esc(factor.tierLabel || "—")}</td><td class="num"><strong>${Number(factor.coefficient) > 0 ? "+" : ""}${Number(factor.coefficient || 0).toFixed(2)}</strong></td><td>${badge(s003FactorStateLabel(factor.state), factor.state === "DEFAULTED_ZERO" ? "warning" : factor.state === "NOT_APPLICABLE" ? "plain" : "success")}</td><td>${factor.majorRiskHit ? badge("已触发", "danger") : "—"}</td></tr>`).join("")}<tr class="s003-total-row"><td><strong>调节合计</strong></td><td>—</td><td>—</td><td class="num"><strong>${Number(content.assessment.factorSum) > 0 ? "+" : ""}${Number(content.assessment.factorSum).toFixed(2)}</strong></td><td colspan="2">综合调节系数 ${Number(content.assessment.compositeAdjustment).toFixed(2)}</td></tr></tbody></table></div></section>
      <section id="s003-report-strategy"><div class="s003-report-section-heading"><span>05</span><div><h2>风险应对策略与改善建议</h2><p>本节采用当前正式报告内容版本中的管理建议，不改变模型阈值，也不自动创建行动申请或待办。</p></div></div><div class="s003-strategy-lead"><strong>${esc(responseHeadline)}</strong><p>${esc(responseGuidance)}</p></div><div class="s003-strategy-grid">${indicatorStrategies.map((strategy, index) => `<article><header><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(strategy.target)}</strong><small>${strategy.currentScore == null ? "指标改善事项" : `当前得分 ${Number(strategy.currentScore).toFixed(2)}`}</small></div></header><ul>${(strategy.actions || []).map((action) => `<li>${esc(action)}</li>`).join("")}</ul></article>`).join("")}${factorStrategies.length ? `<article><header><span>F</span><div><strong>负向调节因子缓释</strong><small>${factorStrategies.length} 项需持续核实</small></div></header><ul>${factorStrategies.map((strategy) => `<li><strong>${esc(strategy.target)}：</strong>${esc((strategy.actions || []).join("；") || "核实事实证据与缓释安排。")}</li>`).join("")}</ul></article>` : ""}</div><div class="s003-management-strategy-grid">${strategyPortfolio.map((group) => `<article><header><span>${esc(group.code)}</span><div><strong>${esc(group.title)}</strong><small>${esc(group.summary)}</small></div></header><ol>${group.actions.map((action) => `<li>${esc(action)}</li>`).join("")}</ol></article>`).join("")}</div></section>
      <section id="s003-report-three-months"><div class="s003-report-section-heading"><span>06</span><div><h2>未来三个月行动建议</h2><p>以下为正式报告中已固化的管理建议，不自动形成 Action Request、通知、审批或负责人待办。</p></div></div><div class="s003-month-plan">${threeMonthPlan.map((item) => `<article><span>${esc(item.period)}</span><strong>${esc(item.objective)}</strong><p>${esc(item.actions)}</p></article>`).join("")}</div></section>
      <section id="s003-report-action"><div class="s003-report-section-heading"><span>07</span><div><h2>分档预警与行动状态</h2><p>报告锁定亮灯结果和形成时状态，并只读叠加当前 C011/C019 处理进度；当前变化不会改写正式报告内容版本。</p></div></div>${candidates.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>预警类型</th><th>亮灯依据</th><th>接收接口人</th><th>成员单位处理状态</th><th>行动申请 / 分办待办</th><th>操作</th></tr></thead><tbody>${candidates.map((candidate) => { const status = s003CandidateDisplayStatus(candidate, contextState); const route = s003MemberUnitDecisionRoute(candidate); return `<tr><td><strong>${esc(s003CandidateTierLabel(candidate))}</strong><small class="table-subline">底层合同：${esc(candidate.actionTypeId)}</small></td><td>${esc(s003CandidateTriggerText(candidate))}</td><td><strong>${esc(route.recipientName)}</strong><small class="table-subline">确认后建议分办：${esc(route.recommendedTaskOwner)}</small></td><td>${badge(status.label, status.tone)}<small class="table-subline">${esc(s003DecisionStateSourceLabel(candidate.currentState?.source))}</small></td><td>${esc(candidate.actionRequestId || "尚未形成")}<small class="table-subline">${esc(candidate.todoId || "尚未形成分办待办")}</small></td><td>${s003CandidateActionControl(candidate, contextState, "report")}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="notice"><span>${icon("circle-check", "sm")}</span><div><strong>本企业本轮为绿灯</strong><span>绿灯企业不形成预警行动；报告中心不会补造 Action Request、审批、通知或负责人待办。</span></div></div>`}</section>
      <section id="s003-report-rules"><div class="s003-report-section-heading"><span>08</span><div><h2>规则与特殊语义</h2><p>展示本轮报告引用的 Published 规则说明及其是否实际适用。</p></div></div><div class="s003-rule-list">${(content.ruleExplanations || []).map((rule) => `<article><div><strong>${esc(rule.title)}</strong><small>${esc(rule.ruleId)}</small></div><p>${esc(s003RuleStatement(rule.statement))}</p>${badge(rule.applied ? "本轮已适用" : "本轮未适用", rule.applied ? "success" : "plain")}</article>`).join("")}</div></section>
      <section id="s003-report-evidence"><div class="s003-report-section-heading"><span>09</span><div><h2>核验、版本、产物与证据</h2><p>报告形成时核验与当前跨模块核验分别展示；报告、配置、运行结果和证据均可追溯到当前运行身份。</p></div></div><div class="s003-verification-summary-inline"><article><span>报告形成时核验</span><strong>${Number(formalVerification.passedCount || 0)} / ${Number(formalVerification.checkCount || 0)}</strong><small>内容版本 ${esc(content.contentVersion)} · 不可变</small></article><article class="${passed === verification.length ? "" : "failed"}"><span>当前跨模块核验</span><strong>${passed} / ${verification.length}</strong><small>${passed === verification.length ? "当前读取全部通过" : "存在跨模块不一致"}</small></article><article><span>正式产物状态</span><strong>${artifact?.artifactId ? "身份一致" : contextState.projectionOnly ? "工作预览" : "不可定位"}</strong><small>${esc(artifact?.artifactVersion || content.artifactVersion || "—")} · ${content.artifactPolicy?.independentPdfArtifact === false ? "HTML 固定产物，浏览器打印 / PDF" : "客户端不重算评分"}</small></article></div>${formationVerificationTable}<div class="s003-run-facts"><div><span>scenarioRunId</span><strong>${esc(content.scenarioIdentity.scenarioRunId)}</strong></div><div><span>报告定义 / 模板</span><strong>${esc(resources.reportDefinition?.definitionVersion)} / ${esc(resources.reportTemplate?.templateVersion)}</strong></div><div><span>模型版本</span><strong>${esc(modelVersion)}</strong></div><div><span>数据资产</span><strong>${esc(s003EvidenceByType(content, "FORMAL_DATA_ASSET")?.evidenceId || "—")}</strong></div><div><span>企业因子输入</span><strong>${esc(s003EvidenceByType(content, "HUMAN_INPUT_SNAPSHOT")?.evidenceId || "—")}</strong></div><div><span>正式产物</span><strong>${esc(artifact?.artifactId || (contextState.projectionOnly ? "尚未形成" : "不可定位"))}</strong></div></div><div class="s003-evidence-list">${(content.evidenceReferences || []).map((item) => `<article><strong>${esc(s003EvidenceTypeLabel(item.evidenceType))}</strong><code>${esc(item.evidenceId)}</code><span>${esc(item.ref || "—")}</span><small>${esc(item.evidenceType)} · ${esc(item.sha256 || item.evidenceVersion || "—")}</small></article>`).join("")}</div></section>
      <footer class="s003-report-footer"><span>${esc(content.reportId)} · ${esc(content.contentVersion)}</span><span>本报告仅适用于 ${esc(content.assessment.assessmentAt)} 评估时点及所列版本证据</span></footer>
    </article>`;
    const reportPaper = s003OrderReportPaper(reportPaperSource, chapters);
    const warning = contextState.projectionOnly
      ? `<div class="notice warning s003-reader-warning"><span>${icon("flask-conical", "sm")}</span><div><strong>本次评估报告预览</strong><span>报告版本和固定产物正在形成；完成后可下载并进入后续业务使用。</span></div></div>`
      : draftSnapshot
        ? `<div class="notice s003-reader-warning"><span>${icon("scan-text", "sm")}</span><div><strong>形成时复核记录</strong><span>该视图使用正式内容版本和形成时逐项核验证据复现复核状态；不会重新确认、重新发布或覆盖当前正式报告。</span></div></div>`
        : printView
          ? `<div class="notice s003-reader-warning"><span>${icon("printer", "sm")}</span><div><strong>浏览器打印 / 另存为 PDF</strong><span>当前正式产物是固定 HTML；本页不声明独立 PDF 文件、URL 或哈希。</span></div></div>`
          : "";
    const toolbar = `<header class="reader-toolbar"><div class="reader-title"><button class="icon-button" type="button" data-action="navigate" data-route="/reports?tab=products" title="返回报告目录">${icon("arrow-left")}</button><div><strong>${esc(content.enterprise.name)} · 企业债务风险评估报告</strong><small>${esc(content.reportId)} · 内容版本 ${esc(content.contentVersion)} · ${esc(content.scenarioIdentity.scenarioRunId)}</small></div>${badge(reportMode, contextState.projectionOnly ? "warning" : "success")}${s003TierBadge({ riskTier: content.assessment.riskTier })}</div><div class="header-actions">${actionButtons}</div></header>`;
    const readerGrid = printView
      ? `<div class="reader-grid s003-print-grid"><section class="report-viewport" id="report-viewport">${reportPaper}</section></div>`
      : `<div class="reader-grid">${toc}<section class="report-viewport" id="report-viewport">${reportPaper}</section>${assistant}</div>`;
    return renderShell(`<div class="reader-shell s003-reader-shell ${warning ? "has-reader-warning" : ""}" data-screen-label="S003 企业${printView ? "打印" : draftSnapshot ? "复核快照" : "正式报告"}">${toolbar}${warning}${readerGrid}</div>`, { crumb: `${content.enterprise.name} · ${printView ? "打印 / PDF" : draftSnapshot ? "形成时复核" : "企业报告"}`, mainClass: "reader-main", asOf: content.assessment.assessmentAt, publishedReportCount: contextState.projectionOnly ? 0 : resources.reportManifest.reportCount || 0 });
  }

  function s003Operations() {
    const resources = s003Dashboard.resources;
    const contextState = s003ContextState(resources);
    const checkpoints = resources.checkpoints || [];
    const latest = checkpoints.at(-1) || null;
    const nodeNames = {
      "initial-configured": "场景初始配置",
      "data-connected": "数据接入完成",
      "published-switched": "Published 切换完成",
      "query-integrated": "问数联调完成",
      "decision-chain-completed": "决策链完成",
      "agent-report-dashboard-completed": "报告与驾驶舱完成",
      "e2e-integrated": "端到端联调完成"
    };
    const lineage = resources.runtime?.operationLineage || null;
    return `<div class="section-stack">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">当前运行控制</div><p>快速重跑沿用统一场景壳的定向重置与新 scenarioRunId 语义。</p></div>${badge(contextState.isCurrent ? "当前运行" : "历史记录", contextState.isCurrent ? "success" : "warning")}</div><div class="panel-body"><div class="s003-run-facts"><div><span>当前资源运行</span><strong>${esc(contextState.resource.scenarioRunId)}</strong></div><div><span>统一壳运行</span><strong>${esc(contextState.active.scenarioRunId || "未取得")}</strong></div><div><span>Checkpoint 数量</span><strong>${checkpoints.length}</strong></div><div><span>恢复模式</span><strong>isolated-clone</strong></div></div><div class="notice"><span>${icon("shield-check", "sm")}</span><div><strong>历史证据不覆盖</strong><span>查看使用原 scenarioRunId；恢复、重跑和回归必须克隆为新运行，历史 Action Request、通知和负责人待办不得重放。</span></div></div><div class="button-row">${contextState.isCurrent ? `<button class="btn primary" type="button" data-action="s003-request-rerun">快速重跑并创建新轮次</button>` : `<button class="btn primary" type="button" disabled>历史批次不可重跑</button>`}<button class="btn" type="button" data-action="s003-navigate-module" data-module="ontology" data-hash="${esc(s003ModelConfigurationHash("overview"))}">打开模型配置</button></div></div></section>
      ${contextState.projectionOnly ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">本次评估批次</div><p>新运行已形成，正式结果和场景快照正在准备。</p></div>${badge("结果准备中", "warning")}</div><div class="panel-body"><div class="s003-run-facts"><div><span>operationId</span><strong>${esc(lineage?.operationId || "未取得")}</strong></div><div><span>来源运行</span><strong>${esc(lineage?.sourceScenarioRunId || "未取得")}</strong></div><div><span>运行状态</span><strong>${esc(resources.runtime?.runStatus || "未取得")}</strong></div><div><span>权威模式</span><strong>${esc(resources.runtime?.authorityMode || "published-runtime")}</strong></div></div><div class="notice warning"><span>${icon("circle-dashed", "sm")}</span><div><strong>正式结果正在形成</strong><span>问数、决策和正式报告将在本轮发布完成后自动关联新的评分结果与报告版本。</span></div></div></div></section>` : ""}
      <section class="panel"><div class="panel-head"><div><div class="panel-title">不可变场景快照</div><p>CP01—CP${String(checkpoints.length).padStart(2, "0")} 均绑定 v1.0.3 基线和精确模块状态。</p></div>${latest ? badge(latest.restoreReadiness?.status === "verified" ? "可克隆恢复" : "待校验", latest.restoreReadiness?.status === "verified" ? "success" : "warning") : ""}</div><div class="panel-body"><div class="s003-checkpoint-list">${checkpoints.map((checkpoint, index) => `<article><span>CP${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(nodeNames[checkpoint.checkpointNode] || checkpoint.checkpointNode)}</strong><small>${esc(checkpoint.checkpointId)}</small></div><div><b>${esc(checkpoint.sourceScenarioRunId)}</b><small>${esc(checkpoint.createdAt)}</small></div><em>${checkpoint.immutable ? "不可变" : "未锁定"}</em>${checkpoint.restoreReadiness?.status === "verified" ? `<button class="text-link" type="button" data-action="s003-request-restore" data-checkpoint-id="${esc(checkpoint.checkpointId)}" data-source-run-id="${esc(checkpoint.sourceScenarioRunId)}">克隆恢复</button>` : ""}</article>`).join("")}</div></div></section>
      ${latest ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">最新快照模块状态</div><p>${esc(latest.checkpointId)} · ${esc(latest.code?.buildVersion || "")}</p></div></div><div class="panel-body"><div class="s003-module-snapshots">${Object.values(latest.modules || {}).map((module) => `<article><span>${esc(module.moduleId)}</span><strong>v${esc(module.moduleVersion)}</strong><small>${esc(module.exportId)}</small><em>${esc(module.validation?.status || "unknown")}</em></article>`).join("")}</div></div></section>` : ""}
    </div>`;
  }

  function renderS003Dashboard() {
    if (!S003_CONFIG) return renderShell(`<div class="empty-state"><div><h2>S003 场景配置未装入</h2><p>当前工作区没有加载 S003 配置包。</p></div></div>`, { crumb: "S003 债务风险监测" });
    if (!s003ScenarioSelected()) return renderShell(`<div class="empty-state"><div><h2>当前场景不是 S003</h2><p>债务风险仪表盘只在统一壳传入 scenarioId=S003 时装入；报告中心其他目录和生命周期保持 v1.0.3 行为。</p></div></div>`, { crumb: "报告中心" });
    if (s003Dashboard.status === "idle") void loadS003Dashboard();
    if (s003Dashboard.status === "idle" || s003Dashboard.status === "loading") return renderShell(`<div class="empty-state"><div><h2>正在读取 S003 Published 资源</h2><p>读取模型、数据、风险结果、企业报告与证据。</p></div></div>`, { crumb: "S003 债务风险监测" });
    if (s003Dashboard.status === "failed") return renderShell(`<div class="empty-state"><div><h2>S003 资源读取失败</h2><p>${esc(s003Dashboard.error)}</p><button class="btn primary" type="button" data-action="s003-retry-load">重新读取</button></div></div>`, { crumb: "S003 债务风险监测" });
    const resources = s003Dashboard.resources;
    const contextState = s003ContextState(resources);
    const context = contextState.resource;
    const body = s003Dashboard.tab === "reports"
      ? s003Reports().replaceAll("进入报告中心查看", "查看报告")
      : s003Dashboard.tab === "actions"
        ? s003DashboardProjection("actions")
        : s003Dashboard.tab === "analysis"
          ? s003RiskAnalysis(resources.results.results || [])
          : s003DashboardProjection("overview");
    const modeNotice = contextState.isCurrent
      ? contextState.projectionOnly
        ? `<div class="notice warning s003-mode-notice"><span>${icon("flask-conical", "sm")}</span><div><strong>本次评估结果正在准备</strong><span>配置、输入、评分结果和 21 份报告预览均已绑定 ${esc(context.scenarioRunId)}；正式发布完成后，问数、决策和报告会自动使用本轮结果。</span></div></div>`
        : ""
      : `<div class="notice warning s003-mode-notice"><span>${icon("history", "sm")}</span><div><strong>历史评估记录</strong><span>${esc(contextState.reason)} 当前可查看当时结果和报告；如需按新配置评估，请返回当前批次快速重跑。</span></div></div>`;
    const runtimeWarnings = [];
    if (s003Dashboard.runtimeError) runtimeWarnings.push(`<div class="notice warning"><span>${icon("wifi-off", "sm")}</span><div><strong>正在同步本次评估结果</strong><span>当前先展示已形成的评分和报告；同步完成后页面会更新到本轮最新状态。</span></div></div>`);
    if (s003Dashboard.checkpointIssues?.length) runtimeWarnings.push(`<div class="notice warning"><span>${icon("history", "sm")}</span><div><strong>部分场景快照正在同步</strong><span>已保留 ${resources.checkpoints?.length || 0} 个可验证历史节点；评分结果、企业报告和驾驶舱仍可正常查看。</span></div></div>`);
    const runtimeWarning = runtimeWarnings.join("");
    return renderShell(`<div class="page" data-screen-label="S003 债务风险仪表盘"><div class="page-header"><div><h1>集团债务风险监测</h1><p>集中查看集团风险分布、企业评分、风险行动和正式报告；模型调整后可快速重跑并形成新的评分批次。</p></div><div class="header-actions">${contextState.isCurrent ? `<button class="btn" type="button" data-action="s003-navigate-module" data-module="ontology" data-hash="${esc(s003ModelConfigurationHash("overview"))}">模型配置</button>` : ""}</div></div>${modeNotice}${runtimeWarning}<div class="tabs"><button class="tab ${s003Dashboard.tab === "overview" ? "active" : ""}" type="button" data-action="s003-set-tab" data-tab="overview">风险总览</button><button class="tab ${s003Dashboard.tab === "analysis" ? "active" : ""}" type="button" data-action="s003-set-tab" data-tab="analysis">产业与薄弱项</button><button class="tab ${s003Dashboard.tab === "actions" ? "active" : ""}" type="button" data-action="s003-set-tab" data-tab="actions">风险行动</button><button class="tab ${s003Dashboard.tab === "reports" ? "active" : ""}" type="button" data-action="s003-set-tab" data-tab="reports">${contextState.projectionOnly ? "报告预览" : "企业报告"}</button></div>${body}</div>`, { crumb: "S003 债务风险监测", mainClass: "s003-dashboard-main", asOf: resources.results.assessmentAt, publishedReportCount: contextState.projectionOnly ? 0 : resources.reportManifest.reportCount || 0 });
  }

  function renderScenes() {
    const cards = DATA.scenes.map((scene) => {
      const view = scene.id === "S003" && S003_CONFIG && s003ScenarioSelected() ? {
        ...scene,
        status: s003ScenarioSelected() ? "已装入 v1.0.3 基线" : "可在统一场景切换器中启用",
        description: "在 v1.0.3 派生报告中心内提供集团风险总览、企业评分明细、模型配置、评分批次和企业报告穿透。"
      } : scene;
      return `
      <article class="scene-card">
        <div class="scene-card-head">
          <div><span class="scene-code">${view.id}</span><h2>${esc(view.name)}</h2></div>
          ${badge(view.status)}
        </div>
        <p>${esc(view.description)}</p>
        <div class="button-row">
          ${view.id === "S001"
            ? `<button class="btn primary" type="button" data-action="navigate" data-route="/dashboard/s001">${icon("arrow-right", "sm")}打开驾驶舱</button>`
            : view.id === "S003" && s003ScenarioSelected()
              ? `<button class="btn primary" type="button" data-action="navigate" data-route="/dashboard/s003">${icon("arrow-right", "sm")}打开债务风险仪表盘</button>`
            : `<button class="btn" type="button" data-action="open-scene-readiness" data-scene="${view.id}">${icon("list-tree", "sm")}查看详情</button>`}
        </div>
      </article>
    `;
    }).join("");
    return renderShell(`
      <div class="page" data-screen-label="仪表盘目录">
        <div class="page-header">
          <div><h1>仪表盘目录</h1><p>进入业务分析驾驶舱或查看场景接入状态。</p></div>
        </div>
        ${trustStrip()}
        <div class="scene-grid">${cards}</div>
      </div>
    `, { crumb: "仪表盘目录" });
  }

  function scopeMetrics() {
    const factPackage = currentFactPackage();
    if (!factPackageIsAvailable(factPackage)) return null;
    if (state.dashboard.scopeType === "unit") return factPackage.units[state.dashboard.scopeId] || factPackage.groupMetrics;
    if (state.dashboard.scopeType === "board") {
      const board = factPackage.boards?.find((item) => item.name === state.dashboard.scopeId);
      return board?.publishedMetrics || null;
    }
    return factPackage.groupMetrics;
  }

  function metricCards() {
    const m = scopeMetrics();
    if (!m) return `<div class="notice danger">${icon("file-question")}<div><strong>当前权威事实不可定位</strong><span>本体管理已返回当前权威组合，但该精确数据版本没有可读取的业务事实包。报告中心不会沿用其他版本指标。</span></div></div>`;
    const items = [
      ["balance", "融资余额", formatNumber(m.balance, 3), "亿元"],
      ["cost", "余额加权融资成本", formatNumber(m.cost, 6), "%"],
      ["floating", "浮动利率余额占比", formatNumber(m.floating, 2), "%"],
      ["shortTerm", "短期债务余额占比", formatNumber(m.shortTerm, 2), "%"],
      ["foreign", "外币融资余额占比", formatNumber(m.foreign, 2), "%"],
      ["highCost", "高成本融资余额占比", formatNumber(m.highCost, 2), "%"],
      ["credit", "信用融资余额占比", formatNumber(m.credit, 2), "%"],
    ];
    return `<div class="metric-grid dashboard-metric-grid">${items.map(([key, label, value, unit]) => `
      <button class="metric-card" type="button" data-action="open-metric" data-metric="${key}">
        <span>${label}</span>
        <strong class="metric-value">${value}<small>${unit}</small></strong>
        <div class="metric-foot"><span>${state.dashboard.scopeId}</span><span>口径与证据 ${icon("chevron-right", "sm")}</span></div>
      </button>
    `).join("")}</div>`;
  }

  function trendPanel() {
    const trend = currentFactPackage()?.trend || [];
    if (!trend.length) return `<section class="panel"><div class="panel-body"><div class="empty-state"><div><div class="empty-icon">${icon("chart-no-axes-column-increasing")}</div><h2>趋势事实不可定位</h2><p>等待当前精确版本的已发布业务事实可读后再展示。</p></div></div></div></section>`;
    const costs = trend.map((item) => item.cost);
    const min = Math.min(...costs) - 0.02;
    const max = Math.max(...costs) + 0.02;
    return `
      <section class="panel">
        <div class="panel-head"><div><div class="panel-title">融资成本趋势</div><p>月末余额加权融资成本 · %</p></div><button class="text-link" type="button" data-action="open-metric" data-metric="cost">口径与证据 ${icon("chevron-right", "sm")}</button></div>
        <div class="panel-body">
          <div class="chart-frame">
            <div class="trend-chart">${trend.map((item) => {
              const height = 28 + ((item.cost - min) / (max - min)) * 132;
              return `<div class="trend-column"><div class="trend-bar" style="height:${height}px" data-value="${formatNumber(item.cost, 3)}%"></div><small>${item.month.slice(5)}</small></div>`;
            }).join("")}</div>
            <div class="chart-legend"><span class="legend-key"><i></i>融资成本</span><span>报告范围内完整月份</span><span>当前 ${formatPercent(currentFactPackage().groupMetrics.cost, 6)}</span></div>
          </div>
        </div>
      </section>
    `;
  }

  function structureGrid() {
    const structures = currentFactPackage()?.structures;
    if (!structures) return `<div class="notice danger">${icon("file-question")}<div><strong>结构事实不可定位</strong><span>不使用其他数据版本的结构占比替代。</span></div></div>`;
    const groups = [
      ["利率结构", structures.rate], ["期限结构", structures.term], ["币种结构", structures.currency],
      ["担保结构", structures.guarantee], ["融资类型", structures.finance], ["境内外结构", structures.region],
    ];
    return `<div class="structure-grid">${groups.map(([name, values]) => `
      <button class="structure-item" type="button" data-action="open-structure" data-structure="${name}">
        <div class="structure-item-head"><strong>${name}</strong>${icon("chevron-right", "sm")}</div>
        <div class="stacked-bar">${values.map((item) => `<span style="width:${item.value}%" title="${item.name} ${formatPercent(item.value, 2)}"></span>`).join("")}</div>
        <div class="structure-legend">${values.map((item) => `<div><span>${item.name}</span><strong>${formatPercent(item.value, 2)}</strong></div>`).join("")}</div>
      </button>
    `).join("")}</div>`;
  }

  function institutionTable(list = null) {
    list = list || currentFactPackage()?.institutions || [];
    if (!list.length) return `<div class="empty-state"><div><div class="empty-icon">${icon("landmark")}</div><h2>机构事实不可定位</h2><p>不使用其他版本机构数据替代当前权威组合。</p></div></div>`;
    const maxShare = Math.max(...list.map((item) => item.share));
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>融资机构</th><th class="num">融资余额（亿元）</th><th>余额占比</th><th class="num">加权成本</th><th class="num">借据数</th><th></th></tr></thead>
          <tbody>${list.map((item) => `
            <tr><td><div class="row-main"><strong>${item.name}</strong><small>银行</small></div></td><td class="num">${formatNumber(item.balance, 3)}</td><td><div class="status-inline"><div class="mini-bar"><span style="width:${item.share / maxShare * 100}%"></span></div><span>${formatPercent(item.share, 2)}</span></div></td><td class="num">${formatPercent(item.cost, 4)}</td><td class="num">${item.count}</td><td><button class="text-link" type="button" data-action="open-institution" data-institution="${item.name}">查看详情</button></td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function comparisonSection() {
    const factPackage = currentFactPackage();
    if (!factPackageIsAvailable(factPackage)) return `<section class="panel"><div class="panel-body"><div class="notice danger">${icon("file-question")}<div><strong>单位比较不可用</strong><span>当前权威组合的业务事实包不可定位，不能沿用上一页面或其他版本的单位结果。</span></div></div></div></section>`;
    const selected = state.dashboard.compareUnits;
    const key = [...selected].sort().join("|");
    const result = factPackage.comparisons[key];
    const unitButtons = Object.keys(factPackage.units).map((unit) => `<button class="unit-chip ${selected.includes(unit) ? "active" : ""}" type="button" data-action="toggle-compare-unit" data-unit="${unit}">${selected.includes(unit) ? icon("check", "sm") : icon("plus", "sm")}${unit}</button>`).join("");
    const rows = selected.map((unit) => factPackage.units[unit]).filter(Boolean);
    return `
      <section class="panel">
        <div class="panel-head"><div><div class="panel-title">单位比较</div><p>选择 2 家或 3 家，组合指标按所选单位融资明细并集的受治理结果展示。</p></div><button class="btn" type="button" data-action="open-ask" data-context="单位比较">${icon("message-square-text", "sm")}继续问数</button></div>
        <div class="panel-body">
          <div class="comparison-picker"><div class="unit-chips">${unitButtons}</div><span class="badge plain">已选 ${selected.length} 家</span></div>
          ${result ? `
            <div class="comparison-summary"><div class="fact"><span>组合融资余额</span><strong>${formatNumber(result.balance, 3)} 亿元</strong></div><div class="fact"><span>组合加权融资成本</span><strong>${formatPercent(result.cost, 6)}</strong></div><div class="fact"><span>与集团基准差异</span><strong>${result.cost >= factPackage.groupMetrics.cost ? "+" : ""}${formatNumber(result.cost - factPackage.groupMetrics.cost, 6)} 个百分点</strong></div></div>
            <div class="data-table-wrap" style="margin-top:10px"><table class="data-table"><thead><tr><th>单位</th><th class="num">余额（亿元）</th><th class="num">加权成本</th><th class="num">浮动利率</th><th class="num">短期债务</th><th>Rule</th></tr></thead><tbody>${rows.map((item, index) => `<tr><td><strong>${selected[index]}</strong></td><td class="num">${formatNumber(item.balance, 3)}</td><td class="num">${formatPercent(item.cost, 6)}</td><td class="num">${formatPercent(item.floating, 2)}</td><td class="num">${formatPercent(item.shortTerm, 2)}</td><td>${badge(item.rule.code + " 命中", "warning")}</td></tr>`).join("")}</tbody></table></div>
          ` : `<div class="notice warning" style="margin-top:12px">${icon("circle-alert")}<div><strong>还需选择 ${selected.length === 0 ? "2—3" : "1—2"} 家单位</strong><span>只有明确选择 2 家或 3 家后才展示组合结果。</span></div></div>`}
        </div>
      </section>
    `;
  }

  function ruleAndActionSection() {
    const factPackage = currentFactPackage();
    if (!factPackageIsAvailable(factPackage)) return `<section class="panel"><div class="panel-body"><div class="notice danger">${icon("file-question")}<div><strong>Rule 运行事实不可定位</strong><span>当前精确版本缺少 Rule 结果事实；不能发起基于其他版本证据的行动请求。</span></div></div></div></section>`;
    const pendingAction = state.ui.pendingActionRef;
    const pendingActionBlock = pendingAction && ["提交中", "结果未知", "未形成"].includes(pendingAction.status)
      ? `<div class="notice warning" style="margin-bottom:10px">${icon("circle-help")}<div><strong>${pendingAction.status === "未形成" ? "原提交已确认未形成" : "行动申请提交结果待核对"}</strong><span>${esc(pendingAction.unit)} · ${esc(pendingAction.clientSubmissionId)}。当前未记为成功，也没有在报告中心形成提醒或待办。</span></div><button class="text-link" type="button" data-action="resume-action-result">继续核对</button></div>`
      : "";
    const unitNames = state.dashboard.scopeType === "unit" ? [state.dashboard.scopeId] : Object.keys(factPackage.units);
    const cards = unitNames.map((unitName) => {
      const item = factPackage.units[unitName];
      return `<div class="rule-card"><div><div class="status-inline">${badge(item.rule.status, "warning")}<span class="scene-code">${item.rule.code}</span></div><h3>${unitName} · ${item.rule.name}</h3><p>${item.rule.branch}</p><div class="rule-evidence"><div class="fact"><span>指标快照</span><strong>${item.rule.metricValue}</strong></div><div class="fact"><span>阈值</span><strong>${item.rule.threshold}</strong></div><div class="fact"><span>评估时间</span><strong>${item.rule.evaluatedAt}</strong></div><div class="fact"><span>优先机构</span><strong>${item.institutions[0].name}</strong></div></div></div><button class="btn" type="button" data-action="open-rule" data-unit="${unitName}">${icon("search", "sm")}查看证据</button></div>`;
    }).join("");
    return `
      <div class="two-col dashboard-action-grid">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">Rule 命中摘要</div><p>结论、阈值、分支和机构归因均来自已发布语义结果。</p></div></div><div class="panel-body section-stack">${cards}</div></section>
        <section class="panel" id="action-collaboration">
          <div class="panel-head"><div><div class="panel-title">行动协同</div><p>只提交标准行动申请；后续状态从决策中心读取。</p></div><button class="btn primary" type="button" data-action="open-action">${icon("send", "sm")}发起行动</button></div>
          <div class="panel-body">
            ${pendingActionBlock}
            ${currentActionRequests().length === 0 ? `<div class="empty-state" style="min-height:180px;padding:20px"><div><div class="empty-icon">${icon("inbox")}</div><h2>暂无关联请求</h2><p>从单一单位的 Rule 证据发起行动后，请求标识会显示在这里。</p><button class="btn" type="button" data-action="reread-decision">${icon("refresh-cw", "sm")}重新读取</button></div></div>` : `
              <div class="resource-list">${currentActionRequests().map((request) => { const summary = runtimeExternalViews.decisionById.get(request.id); const payload = actionPayload(request); const targetStatus = summary?.targetRefs?.map((target) => `${target.targetType} ${target.status}`).join(" · ") || "等待重新读取"; const subjectName = payload.singleBusinessSubjectName || payload.unit || request.singleBusinessSubjectName || request.singleBusinessSubject || "业务主体不可定位"; const subjectId = payload.singleBusinessSubjectId || request.singleBusinessSubjectId || "稳定标识待重新读取"; const subjectType = payload.singleBusinessSubjectObjectType || request.singleBusinessSubjectObjectType || "Object Type 待重新读取"; const c033 = summary?.scenarioContext || request.scenarioContext || {}; return `<div class="resource-row" style="grid-template-columns:minmax(0,1fr) auto"><div><strong>${esc(subjectName)} · ${esc(payload.ruleCode || "Rule 待重新读取")}</strong><small>${esc(subjectId)} · ${esc(subjectType)}</small><small>${request.id} · ${request.createdAt}${summary ? ` · 摘要时点 ${summary.summaryAsOf || summary.readAt}` : " · 尚未回读摘要"}</small><small>C033 ${esc(c033.scenarioId || "待重新读取")} / ${esc(c033.scenarioVersion || "待重新读取")} / ${esc(c033.scenarioRunId || "待重新读取")}</small><small>语义 ${esc(summary?.semanticVersion || "待重新读取")} · 数据 ${esc(summary?.dataVersion || "待重新读取")} · 截至 ${esc(summary?.asOf || "待重新读取")}</small><small>${esc(targetStatus)}</small></div><div class="inline-actions">${badge(summary?.status || "等待重新读取")}<button class="text-link" type="button" data-action="open-external-decision" data-id="${request.id}">查看详情</button></div></div>`; }).join("")}</div>
              <div class="notice" style="margin-top:10px">${icon("info")}<div><strong>决策状态只读</strong><span>摘要来自 C019；请求成功不表示提醒已确认、待办已创建或行动已执行。回链后会按标识重新读取。</span></div></div>
            `}
          </div>
        </section>
      </div>
    `;
  }

  function insightSection() {
    const insight = state.insight;
    const current = insight.bindingSnapshot || currentAuthority();
    const external = insight.runId ? OWNERS.agent.getInsight(insight.runId) : null;
    const factPackage = factPackageForBinding(current);
    let body = "";
    if (!insight.requestId) {
      body = `<div class="empty-state" style="min-height:210px"><div><div class="empty-icon">${icon("sparkles")}</div><h2>尚未生成洞察</h2><p>生成时会固定当前范围、指标、Rule 证据、数据版本与时点。</p><button class="btn primary" type="button" data-action="generate-insight">${icon("sparkles", "sm")}生成洞察</button></div></div>`;
    } else if (!external) {
      body = `<div class="notice warning">${icon("refresh-cw")}<div><strong>洞察结果尚未回读</strong><span>报告中心仅保存请求与外部 Run / Result 标识，不保存 Agent 运行状态或结果正文。</span></div></div><div class="detail-list"><div class="detail-row"><span>请求标识</span><strong>${esc(insight.requestId)}</strong></div><div class="detail-row"><span>Agent Run</span><strong>${esc(insight.runId)}</strong></div><div class="detail-row"><span>Result</span><strong>${esc(insight.resultId || "等待返回")}</strong></div><div class="detail-row"><span>场景引用</span><strong>${insight.referenced ? "已保留引用选择" : "未引用"}</strong></div></div><button class="btn primary" type="button" data-action="reread-insight">${icon("refresh-cw", "sm")}重新读取 Agent 结果</button>`;
    } else if (external.status === "运行中" || external.contentStatus === "确认中") {
      body = `<div class="progress-card"><div class="progress-head"><div><h2>${external.contentStatus === "确认中" ? "正在读取确认结果" : "正在形成洞察"}</h2><p>固定范围：${state.dashboard.scopeId}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:${external.contentStatus === "确认中" ? 82 : 58}%"></span></div><div class="detail-row"><span>Agent 运行</span><strong>${esc(insight.runId)}</strong></div><div class="detail-row"><span>固定数据版本</span><strong>${esc(current.dataVersion)}</strong></div><div class="help-text">运行状态只在当前页面按 Agent 应用返回展示。</div></div>`;
    } else if (external.status !== "已完成") {
      body = `<div class="notice warning">${icon("refresh-cw")}<div><strong>洞察结果需要重新读取</strong><span>报告中心只保留外部标识，未保存 Agent 正文或运行状态副本。</span></div></div><button class="btn primary" type="button" data-action="reread-insight">${icon("refresh-cw", "sm")}重新读取 Agent 结果</button>`;
    } else {
      body = `<div class="section-stack"><div class="notice ${external.contentStatus === "已确认" ? "success" : "warning"}">${icon(external.contentStatus === "已确认" ? "circle-check" : "clock")}<div><strong>内容状态：${external.contentStatus}</strong><span>Agent 状态来自当前只读回读；数据新鲜度与驾驶舱引用分别显示。</span></div></div><div><h3 style="margin:0 0 6px">${esc(external.title || "融资经营洞察")}</h3><p style="margin:0;color:var(--muted)">${esc(external.text || (factPackageIsAvailable(factPackage) ? `集团加权融资成本为 ${formatPercent(factPackage.groupMetrics.cost, 6)}，近三个月变化趋缓。` : "固定事实包当前不可定位，不能形成洞察正文。"))}</p></div><div class="detail-list"><div class="detail-row"><span>证据</span><strong>集团融资成本、R01/R02、三家机构贡献</strong></div><div class="detail-row"><span>版本与时点</span><strong>语义 ${esc(current.semanticVersion)} · 数据 ${esc(current.dataVersion)} · 截至 ${esc(current.asOf)}</strong></div><div class="detail-row"><span>生成时间</span><strong>${esc(external.generatedAt)}</strong></div><div class="detail-row"><span>场景引用</span><strong>${insight.referenced ? "已引用到 S001 洞察区" : "未引用"}</strong></div></div><div class="button-row"><button class="btn" type="button" data-action="open-external-agent" data-id="${insight.runId}" data-return="/dashboard/s001?tab=insight" data-position="ai-insight">${icon("external-link", "sm")}查看 Agent 记录</button>${external.contentStatus !== "已确认" ? `<button class="btn soft" type="button" data-action="request-insight-confirm">${icon("send", "sm")}请求内容确认</button>` : `<button class="btn ${insight.referenced ? "" : "primary"}" type="button" data-action="toggle-insight-reference">${icon(insight.referenced ? "unlink" : "link", "sm")}${insight.referenced ? "停止引用" : "引用到驾驶舱"}</button>`}<button class="btn ghost" type="button" data-action="generate-insight">${icon("refresh-cw", "sm")}重新生成</button></div></div>`;
    }
    return `<section class="panel"><div class="panel-head"><div><div class="panel-title">AI 洞察</div><p>解释与建议，不作为数据源、正式指标或 Rule 计算层。</p></div></div><div class="panel-body">${body}</div></section>`;
  }

  function dashboardOverview() {
    const current = currentAuthority();
    return `
      <div class="section-stack">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">核心指标</div><p>${state.dashboard.scopeId} · 数据截至 ${esc(current.asOf)}</p></div></div><div class="panel-body">${metricCards()}</div></section>
        <div class="two-col dashboard-analysis-grid">${trendPanel()}<section class="panel overview-structure-panel"><div class="panel-head"><div><div class="panel-title">债务结构</div><p>未知分类保持单列。</p></div><button class="text-link" type="button" data-action="set-dashboard-tab" data-tab="structure">查看详情 ${icon("chevron-right", "sm")}</button></div><div class="panel-body">${structureGrid()}</div></section></div>
        <section class="panel"><div class="panel-head"><div><div class="panel-title">金融机构分布</div><p>总体余额分布，不等同于 Rule 优先协商机构。</p></div></div><div class="panel-body flush">${institutionTable()}</div></section>
        ${comparisonSection()}
        ${ruleAndActionSection()}
        <div class="equal-col dashboard-assist-grid">${insightSection()}<section class="panel"><div class="panel-head"><div><div class="panel-title">智能问数</div><p>带入当前场景、范围、单位与指标上下文。</p></div></div><div class="panel-body section-stack"><button class="btn full" type="button" data-action="open-ask" data-context="集团融资成本与结构">${icon("message-square-text", "sm")}集团融资成本与结构</button><button class="btn full" type="button" data-action="open-ask" data-context="单位风险原因">${icon("message-square-text", "sm")}单位风险原因</button><button class="btn full" type="button" data-action="open-ask" data-context="优先协商机构">${icon("message-square-text", "sm")}优先协商机构</button><div class="notice">${icon("info")}<div><strong>当前上下文</strong><span>${state.dashboard.scopeId} · ${state.dashboard.compareUnits.join("、")} · 语义 ${esc(current.semanticVersion)}</span></div></div></div></section></div>
      </div>
    `;
  }

  function dashboardTabContent() {
    const blocked = dashboardConsumptionBlock();
    if (blocked) return blocked;
    if (state.dashboard.tab === "compare") return comparisonSection();
    if (state.dashboard.tab === "structure") return `<div class="section-stack"><section class="panel"><div class="panel-head"><div><div class="panel-title">债务结构</div><p>按受治理属性和指标结果展示。</p></div></div><div class="panel-body">${structureGrid()}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">金融机构分布</div><p>当前范围总体融资分布。</p></div></div><div class="panel-body flush">${institutionTable()}</div></section></div>`;
    if (state.dashboard.tab === "evidence") return `<div class="section-stack">${ruleAndActionSection()}${insightSection()}</div>`;
    return dashboardOverview();
  }

  function renderDashboard() {
    const requestedTab = routeInfo().query.get("tab");
    if (["overview", "compare", "structure", "evidence"].includes(requestedTab)) state.dashboard.tab = requestedTab;
    const factPackage = currentFactPackage();
    const usable = currentFactsAreUsable();
    const scopeOptions = state.dashboard.scopeType === "board"
      ? (factPackage?.boards || []).map((item) => `<option value="${item.name}" ${item.name === state.dashboard.scopeId ? "selected" : ""}>${item.name}</option>`).join("")
      : Object.keys(factPackage?.units || {}).map((unit) => `<option value="${unit}" ${unit === state.dashboard.scopeId ? "selected" : ""}>${unit}</option>`).join("");
    return renderShell(`
      <div class="page" data-screen-label="S001 集团融资成本与债务结构优化驾驶舱">
        <div class="page-header"><div><div class="status-inline"><span class="scene-code">S001</span>${badge(usable ? "可使用" : "不可消费")}</div><h1>集团融资成本与债务结构优化</h1><p>仪表盘版本 ${DATA.product.dashboardVersion} · 回答发生了什么、经营情况怎样。</p></div><div class="header-actions">${usable ? `<button class="btn" type="button" data-action="navigate" data-route="/reports/generate">${icon("file-plus-2", "sm")}生成报告</button><button class="btn primary" type="button" data-action="open-action">${icon("send", "sm")}发起行动</button>` : `<button class="btn primary" type="button" data-action="open-trust">${icon("shield-check", "sm")}查看数据状态</button>`}</div></div>
        ${trustStrip()}
        <div class="scope-toolbar">
          <div class="segmented" aria-label="分析范围"><button type="button" class="${state.dashboard.scopeType === "group" ? "active" : ""}" data-action="set-scope-type" data-type="group">集团</button><button type="button" class="${state.dashboard.scopeType === "board" ? "active" : ""}" data-action="set-scope-type" data-type="board">板块</button><button type="button" class="${state.dashboard.scopeType === "unit" ? "active" : ""}" data-action="set-scope-type" data-type="unit">单位</button></div>
          ${state.dashboard.scopeType === "group" ? `<div class="field-inline"><label>当前范围</label><strong>集团</strong></div>` : `<div class="field-inline"><label for="scope-select">当前范围</label><select class="select" id="scope-select" data-change="scope-id">${scopeOptions}</select></div>`}
          <div class="scope-note help-text">切换范围会更新指标、结构、机构和 Rule；AI 洞察保留自身新鲜度状态。</div>
          ${usable ? `<button class="btn" type="button" data-action="open-ask" data-context="${state.dashboard.scopeId}">${icon("message-square-text", "sm")}智能问数</button>` : ""}
        </div>
        ${usable ? `<div class="tabs"><button class="tab ${state.dashboard.tab === "overview" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="overview">经营概览</button><button class="tab ${state.dashboard.tab === "compare" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="compare">单位比较</button><button class="tab ${state.dashboard.tab === "structure" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="structure">结构与机构</button><button class="tab ${state.dashboard.tab === "evidence" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="evidence">Rule 与行动</button></div>` : ""}
        ${dashboardTabContent()}
      </div>
    `, { crumb: "S001 融资驾驶舱" });
  }

  function reportWorkflowIndex() {
    const map = { idle: 0, evidence: 1, evidence_missing: 1, generating: 2, generation_failed: 2, draft: 3, returned: 3, confirmed: 4, publishing: 4, publish_failed: 4, published: 5, withdrawn: 5 };
    return map[state.report.stage] ?? 0;
  }

  function workflowStrip() {
    const current = reportWorkflowIndex();
    const steps = ["选择定义", "固定证据", "Agent 生成", "核验复核", "形成产物", "已发布"];
    return `<div class="workflow-strip">${steps.map((step, index) => `<div class="workflow-step ${index < current ? "done" : index === current ? "active" : ""}"><span>0${index + 1}</span><strong>${step}</strong></div>`).join("")}</div>`;
  }

  function reportStatusLabel(stage) {
    const labels = {
      idle: "未开始", evidence: "处理中", evidence_missing: "阻断", generating: "处理中",
      generation_failed: "生成失败",
      draft: "草稿待复核", returned: "已退回", confirmed: "已确认", publishing: "处理中",
      publish_failed: "发布失败", published: "已发布", withdrawn: "已撤回",
    };
    return labels[stage] || "未开始";
  }

  function s003ReportProvider(resources = s003Dashboard.resources) {
    if (!resources?.reportManifest || !resources?.reportContents) return null;
    const contentById = new Map((resources.reportContents.reports || []).map((record) => [record.reportId, record]));
    const contextState = s003ContextState(resources);
    const reports = (resources.reportManifest.reports || []).map((record) => {
      const contentRecord = contentById.get(record.reportId) || null;
      return {
        ...clone(record),
        content: clone(contentRecord?.content || null),
        stage: contextState.projectionOnly ? "runtime-preview" : "published",
        publishedAt: contentRecord?.content?.generatedAt || resources.reportManifest.formedAt,
        immutable: contentRecord?.content?.immutable === true && resources.reportManifest.immutable === true
      };
    });
    return {
      schemaVersion: "ofw.s003.m06.baseline-report-provider.v1",
      scenarioContext: clone(resources.resourceScenarioContext || resources.reportManifest.scenarioIdentity),
      contextState,
      definition: {
        ...clone(resources.reportDefinition || {}),
        id: resources.reportDefinition?.definitionId || "S003-RPT-DEF-DEBT-RISK",
        version: resources.reportDefinition?.definitionVersion || resources.reportManifest.manifestVersion,
        status: contextState.projectionOnly ? "工作投影只读" : resources.reportDefinition?.lifecycleStatus === "published" ? "已启用" : "未发布"
      },
      template: {
        ...clone(resources.reportTemplate || {}),
        id: resources.reportTemplate?.templateId || "S003-RPT-TPL-ENTERPRISE-RISK",
        version: resources.reportTemplate?.templateVersion || resources.reportContents.contentSetVersion,
        status: contextState.projectionOnly ? "预览" : resources.reportTemplate?.lifecycleStatus === "published" ? "已发布" : "未发布"
      },
      reports,
      history: clone(resources.reportHistory || null),
      summary: clone(resources.reportManifest.summary || {}),
      assessmentAt: resources.reportManifest.assessmentAt,
      manifestId: resources.reportManifest.manifestId,
      manifestVersion: resources.reportManifest.manifestVersion
    };
  }

  function s003NativeProvider() {
    if (s003Dashboard.status === "idle") void loadS003Dashboard();
    return s003Dashboard.status === "ready" ? s003ReportProvider() : null;
  }

  function s003NativeProviderNotice() {
    if (s003Dashboard.status === "failed") return `<div class="notice danger">${icon("file-warning")}<div><strong>S003 报告资源读取失败</strong><span>${esc(s003Dashboard.error)}</span></div><button class="btn" type="button" data-action="s003-retry-load">重新读取</button></div>`;
    return `<div class="notice">${icon("loader-circle")}<div><strong>正在读取 S003 Published 报告资源</strong><span>基线报告目录、生命周期和生成工作区保持可用；场景资源完成校验后作为原生记录装入。</span></div></div>`;
  }

  function s003CatalogItems(provider = s003NativeProvider()) {
    if (!provider) return [];
    return provider.reports.map((report) => ({
      key: `s003-${report.enterpriseId}`,
      title: `${report.enterpriseName}债务风险评估报告`,
      scene: "S003",
      type: "专题报告",
      status: report.stage === "published" ? "已发布" : "工作预览",
      owner: "财务公司",
      version: `${report.contentVersion} · ${report.reportId}`,
      updated: report.publishedAt,
      next: report.stage === "published" ? "查看企业正式报告或返回公共仪表盘" : "仅预览，不进入正式消费",
      route: "s003-report",
      enterpriseId: report.enterpriseId
    }));
  }

  function catalogItems() {
    if (s003ScenarioSelected()) return s003CatalogItems();
    const currentStage = state.report.stage;
    const live = currentStage === "idle" ? {
      key: "finance", title: "集团融资经营分析报告", scene: "S001", type: "经营分析",
      status: "未开始", owner: "集团财务管理", version: "尚未形成内容版本", updated: "等待创建草稿",
      next: "选择报告类型并固定生成上下文", route: "create",
    } : {
      key: "finance", title: "集团融资经营分析报告", scene: "S001", type: "经营分析",
      status: reportStatusLabel(currentStage), owner: "集团财务管理",
      version: state.report.contentVersion ? `内容版本 ${state.report.contentVersion}` : state.report.draftVersion ? `草稿版本 ${state.report.draftVersion}` : "正在形成内容版本",
      updated: state.report.publishedAt || state.report.confirmedAt || state.report.generatedAt || "处理中",
      next: currentStage === "draft" ? "完成自动核验与人工检查" : currentStage === "returned" ? "生成新内容版本" : currentStage === "confirmed" ? "发布正式报告" : currentStage === "published" ? "阅读、追溯或形成新内容版本" : currentStage === "evidence_missing" ? "处理证据阻断后重试" : currentStage === "generation_failed" ? "保留证据包并创建新 Run 重试" : currentStage === "publish_failed" ? "基于已确认版本重试发布" : "等待当前步骤完成",
      route: currentStage === "draft" || currentStage === "returned" || currentStage === "confirmed" ? "/reports/draft" : currentStage === "published" ? "/reports/view" : "/reports/generate",
    };
    return [
      live,
      { key: "budget", title: "预算执行分析报告", scene: "S002", type: "经营分析", status: "接入阻断", owner: "预算管理", version: "尚无获准报告定义", updated: "等待业务资料", next: "补齐预算周期、版本与指标范围", route: "readiness", sceneId: "S002" },
      { key: "risk", title: "债务风险监测报告", scene: "S003", type: "专题报告", status: "不可消费", owner: "融资风险管理", version: "完整场景未建设", updated: "数据内容已确认·待受控发布验证", next: "数据工程兼容性验证", route: "readiness", sceneId: "S003" },
      { key: "credit", title: "财务公司贷款贷前调查报告", scene: "S004", type: "正式报告", status: "接入阻断", owner: "财务公司", version: "尚无正式章节合同", updated: "等待业务资料", next: "补齐报告样例、证据与复核规则", route: "readiness", sceneId: "S004" },
    ];
  }

  function renderLifecycle() {
    const s003 = s003ScenarioSelected();
    const provider = s003 ? s003NativeProvider() : null;
    const statusOptions = ["all", "未开始", "处理中", "生成失败", "草稿待复核", "已确认", "已发布", "工作预览", "已退回", "发布失败", "阻断", "接入阻断", "不可消费"];
    const normalized = state.catalog.query.trim().toLowerCase();
    const visible = catalogItems().filter((item) => {
      const searchHit = !normalized || `${item.title} ${item.scene} ${item.type} ${item.owner}`.toLowerCase().includes(normalized);
      const statusHit = state.catalog.status === "all" || item.status === state.catalog.status || state.catalog.status === "阻断" && item.status === "接入阻断";
      return searchHit && statusHit;
    });
    const activeIndex = s003 ? (provider ? 5 : 0) : reportWorkflowIndex();
    const providerResources = s003 ? s003Dashboard.resources || {} : {};
    const s003LifecycleContext = provider ? [
      `${provider.definition?.id || "报告定义"} / ${provider.template?.id || "报告模板"}`,
      `${providerResources.results?.inputIdentity?.dataAssetId || "正式数据资产"} · ${providerResources.results?.inputIdentity?.humanInputSnapshotId || providerResources.inputSnapshot?.snapshotId || "企业输入快照"}`,
      `${provider.reports.length} 份结构化报告内容 · 同一 scenarioRunId`,
      `${providerResources.reportAssurance?.verificationChecks?.length || 0} 项确定性检查 · 人工复核边界保留`,
      `${provider.reports.length} 份 HTML / PDF 同源正式产物`,
      `${provider.manifestId || "Published 报告清单"} · 历史记录可追溯`
    ] : [];
    const lifecycle = [
      ["创建", "选择类型与定义", "file-plus-2"], ["固定证据", "锁定已发布语义和数据上下文", "package-check"],
      ["内容生成", s003 ? "确定性形成结构化内容项" : "Agent 返回结构化内容项", "sparkles"], ["核验复核", "确定性核验与人工确认", "shield-check"],
      ["形成产物", "同源生成 HTML 与 PDF", "files"], ["发布历史", "冻结、追溯、撤回或替代", "history"],
    ];
    const itemMarkup = visible.map((item) => {
      const action = item.route === "s003-report" ? "s003-open-report" : item.route === "create" ? "open-generation-modal" : item.route === "readiness" ? "open-scene-readiness" : "navigate";
      const attrs = item.route === "s003-report" ? `data-enterprise-id="${esc(item.enterpriseId)}"` : item.route === "readiness" ? `data-scene="${item.sceneId}"` : item.route.startsWith("/") ? `data-route="${item.route}"` : "";
      const primary = item.key === "finance" || item.route === "s003-report";
      if (state.catalog.view === "cards") return `<article class="ledger-card"><header><div><span class="scene-code">${item.scene}</span><h3>${item.title}</h3></div>${badge(item.status)}</header><p>${item.type} · ${item.owner}</p><dl><div><dt>版本</dt><dd>${item.version}</dd></div><div><dt>最近变化</dt><dd>${item.updated}</dd></div><div><dt>下一步</dt><dd>${item.next}</dd></div></dl><button class="btn ${primary ? "primary" : ""}" type="button" data-action="${action}" ${attrs}>${item.route === "create" ? "创建报告" : "查看详情"}</button></article>`;
      return `<div class="ledger-row"><div class="ledger-title"><span class="scene-code">${item.scene}</span><div><strong>${item.title}</strong><small>${item.type} · ${item.owner}</small></div></div><div><span>当前版本</span><strong>${item.version}</strong></div><div>${badge(item.status)}<small>${item.updated}</small></div><div><span>下一步</span><strong>${item.next}</strong></div><button class="btn ${primary ? "primary" : ""}" type="button" data-action="${action}" ${attrs}>${item.route === "create" ? "创建报告" : "查看详情"}</button></div>`;
    }).join("");
    const issueCount = state.report.issues.filter(isOpenIssue).length;
    const formalCount = provider ? provider.reports.filter((item) => item.stage === "published").length : 0;
    const riskCounts = provider?.summary?.riskTierCounts || {};
    const summary = s003 ? `
          <button type="button" data-action="set-catalog-status" data-status="已发布"><span>正式报告</span><strong>${formalCount}</strong><small>不可变企业报告</small></button>
          <button type="button"><span>绿灯</span><strong>${riskCounts.GREEN || 0}</strong><small>常态监测</small></button>
          <button type="button"><span>黄/红/黑</span><strong>${(riskCounts.YELLOW || 0) + (riskCounts.RED || 0) + (riskCounts.BLACK || 0)}</strong><small>重点关注企业</small></button>
          <button type="button"><span>评估时点</span><strong>${esc(provider?.assessmentAt || "读取中")}</strong><small>${esc(provider?.manifestId || "Published 清单待读取")}</small></button>` : `
          <button type="button" data-action="set-catalog-status" data-status="处理中"><span>处理中</span><strong>${["evidence", "generating", "publishing"].includes(state.report.stage) ? 1 : 0}</strong><small>证据、生成或发布运行</small></button>
          <button type="button" data-action="set-catalog-status" data-status="草稿待复核"><span>待我检查</span><strong>${state.report.stage === "draft" ? 1 : 0}</strong><small>${issueCount ? `${issueCount} 项复核问题` : "自动核验与人工检查分开"}</small></button>
          <button type="button" data-action="set-catalog-status" data-status="阻断"><span>需要处理</span><strong>${["evidence_missing", "generation_failed", "publish_failed"].includes(state.report.stage) ? 1 : 3}</strong><small>${["evidence_missing", "generation_failed", "publish_failed"].includes(state.report.stage) ? "当前报告存在阻断" : "S002—S004 等待业务资料"}</small></button>
          <button type="button" data-action="set-catalog-status" data-status="已发布"><span>正式报告</span><strong>${currentPublishedReports().filter((item) => item.stage === "published").length}</strong><small>HTML 与 PDF 同源冻结</small></button>`;
    return renderShell(`
      <div class="page lifecycle-page" data-screen-label="报告目录">
        <div class="page-header"><div><h1>报告目录</h1><p>${s003 ? "沿用基线目录、筛选、生命周期和详情入口，按当前 S003 运行装入企业报告。" : "按创建、生成、核验、确认、发布与历史顺序推进每份报告。"}</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">查看报告定义</button>${s003 ? `<button class="btn primary" type="button" data-action="s003-open-dashboard">${icon("layout-dashboard", "sm")}返回公共仪表盘</button>` : `<button class="btn primary" type="button" data-action="open-generation-modal">${icon("plus", "sm")}创建报告</button>`}</div></div>
        <section class="lifecycle-summary">
          ${summary}
        </section>
        <section class="panel lifecycle-board">
          <div class="panel-head"><div><div class="panel-title">当前生命周期</div><p>保持 v1.0.3 的创建、固定证据、生成、核验、产物与发布语义；S003 只注入每一阶段的同运行证据。</p></div><button class="text-link" type="button" data-action="navigate" data-route="${s003 ? "/reports?tab=products" : "/reports/generate"}">${s003 ? "查看当前产物" : "进入当前工作"}</button></div>
          <div class="lifecycle-rail">${lifecycle.map(([title, copy, iconName], index) => `<button type="button" class="life-node ${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}" data-action="navigate" data-route="${s003 ? "/reports?tab=products" : "/reports/generate"}"><span>${icon(iconName)}</span><strong>${title}</strong><small>${copy}</small>${s003LifecycleContext[index] ? `<em class="s003-life-context">${esc(s003LifecycleContext[index])}</em>` : ""}</button>`).join("")}</div>
        </section>
        <section class="panel report-ledger-panel">
          <div class="ledger-toolbar"><div class="search-box">${icon("search", "sm")}<input aria-label="搜索报告" placeholder="搜索报告名称、场景、类型或负责人" value="${esc(state.catalog.query)}" data-input="catalog-query"></div><select class="select compact-select" aria-label="状态筛选" data-change="catalog-status">${statusOptions.map((option) => `<option value="${option}" ${state.catalog.status === option ? "selected" : ""}>${option === "all" ? "全部状态" : option}</option>`).join("")}</select><div class="segmented"><button type="button" class="${state.catalog.view === "list" ? "active" : ""}" data-action="set-catalog-view" data-view="list">${icon("list", "sm")}列表</button><button type="button" class="${state.catalog.view === "cards" ? "active" : ""}" data-action="set-catalog-view" data-view="cards">${icon("layout-grid", "sm")}卡片</button></div></div>
          <div class="panel-body flush">${visible.length ? `<div class="${state.catalog.view === "cards" ? "ledger-grid" : "ledger-list"}">${itemMarkup}</div>` : s003 && !provider ? s003NativeProviderNotice() : `<div class="empty-state"><div><div class="empty-icon">${icon("search-x")}</div><h2>没有符合条件的报告</h2><p>调整关键词或状态筛选后再查看。</p><button class="btn" type="button" data-action="clear-catalog-filter">清除筛选</button></div></div>`}</div>
        </section>
      </div>
    `, { crumb: "报告目录", asOf: provider?.assessmentAt || undefined, publishedReportCount: s003 ? formalCount : undefined });
  }

  function renderReports() {
    const s003 = s003ScenarioSelected();
    const provider = s003 ? s003NativeProvider() : null;
    const tab = routeInfo().query.get("tab") || "definitions";
    const detail = routeInfo().query.get("detail");
    const definitions = s003 ? (provider ? [provider.definition] : []) : [...DATA.definitions, ...state.customDefinitions];
    const templates = s003 ? (provider ? [provider.template] : []) : DATA.templates;
    const products = s003 ? (provider?.reports || []) : currentPublishedReports();
    let content = "";
    if (s003 && !provider) {
      content = s003NativeProviderNotice();
    } else if (tab === "definitions") {
      if (s003 && detail === "definition") {
        const item = definitions[0];
        content = `<section class="panel s003-resource-detail"><div class="panel-head"><div><div class="panel-title">${esc(item.name)}</div><p>${esc(item.id)} · 版本 ${esc(item.version)}</p></div>${badge(item.status, provider?.contextState.projectionOnly ? "warning" : "success")}</div><div class="panel-body section-stack"><div class="notice"><span>${icon("file-cog", "sm")}</span><div><strong>业务目的</strong><span>${esc(item.purpose)}</span></div></div><div class="s003-run-facts"><div><span>业务责任人</span><strong>${esc(item.businessOwner || "财务公司")}</strong></div><div><span>主要用户</span><strong>${esc((item.audience || []).join("、") || "集团债务风险管理人员")}</strong></div><div><span>对象范围</span><strong>${esc(item.scope?.objectType || "企业")} · 每企业一份</strong></div><div><span>同轮身份</span><strong>${item.scope?.sameScenarioRunRequired ? "必须" : "未约束"}</strong></div></div><section><h3>必需章节</h3><div class="s003-contract-chip-grid">${(item.requiredSections || []).map((sectionId) => `<span>${esc(s003ReportSectionLabel(sectionId))}<small>${esc(sectionId)}</small></span>`).join("")}</div></section><section><h3>必需证据</h3><div class="s003-contract-chip-grid">${(item.requiredEvidenceTypes || []).map((type) => `<span>${esc(s003EvidenceTypeLabel(type))}<small>${esc(type)}</small></span>`).join("")}</div></section><section><h3>核验、伴读与发布边界</h3><div class="s003-generation-boundary"><span>确定性核验 <b>${item.verificationPolicy?.deterministic ? "是" : "否"}</b></span><span>客户端重算 <b>${item.verificationPolicy?.clientSideScoreRecalculation ? "是" : "否"}</b></span><span>专属 Agent <b>${item.companionPolicy?.dedicatedAgentRequired ? "需要" : "不需要"}</b></span><span>伴读创建行动 <b>${item.companionPolicy?.mayCreateActionRequest ? "是" : "否"}</b></span><span>正式格式 <b>${esc((item.publicationPolicy?.formats || []).map((format) => format === "html" ? "HTML 阅读版" : format === "print-to-pdf" ? "打印 / PDF" : format).join(" / "))}</b></span><span>多级审批 <b>${item.permissionPolicy?.multiLevelApproval ? "是" : "一期不建设"}</b></span></div></section><div class="button-row"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">返回定义列表</button><button class="btn primary" type="button" data-action="navigate" data-route="/reports?tab=templates&detail=template">查看绑定模板</button></div></div></section>`;
      } else content = `<div class="resource-list">${definitions.map((item) => `<div class="resource-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.id)} · ${esc(item.purpose)}</small></div><div class="resource-meta"><span>版本</span><strong>${esc(item.version)}</strong></div><div>${badge(item.status, s003 && provider?.contextState.projectionOnly ? "warning" : "success")}</div><button class="btn" type="button" data-action="${s003 ? "navigate" : "open-definition"}" ${s003 ? `data-route="/reports?tab=definitions&detail=definition"` : `data-id="${item.id}"`}>查看详情</button></div>`).join("")}</div>`;
    } else if (tab === "templates") {
      if (s003 && detail === "template") {
        const item = templates[0];
        content = `<section class="panel s003-resource-detail"><div class="panel-head"><div><div class="panel-title">${esc(item.name)}</div><p>${esc(item.id)} · 版本 ${esc(item.version)}</p></div>${badge(item.status, provider?.contextState.projectionOnly ? "warning" : "success")}</div><div class="panel-body section-stack"><div class="s003-run-facts"><div><span>绑定定义</span><strong>${esc(item.definitionId)}</strong></div><div><span>版式密度</span><strong>${item.layout?.density === "high" ? "高密度" : esc(item.layout?.density || "高密度")}</strong></div><div><span>页面宽度</span><strong>${item.layout?.pageWidth === "A4-responsive" ? "A4 响应式阅读版" : esc(item.layout?.pageWidth || "A4 响应式阅读版")}</strong></div><div><span>支持格式</span><strong>${esc((item.supportedFormats || []).map((format) => format === "html" ? "HTML 阅读版" : format === "print-to-pdf" ? "打印 / PDF" : format).join(" / "))}</strong></div></div><div class="s003-template-sections">${(item.sections || []).map((section, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(section.title)}</strong><small>${esc(section.sectionId)} · ${section.required ? "必需" : "可选"}</small><p>${esc((section.components || []).map(s003TemplateComponentLabel).join("、"))}</p></div></article>`).join("")}</div><div class="notice"><span>${icon("shield-check", "sm")}</span><div><strong>模板不携带旧场景数据</strong><span>${esc(item.download?.reasonExampleHtmlDisabled || "正式 HTML 由具体报告内容版本形成。")}</span></div></div><div class="button-row"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=templates">返回模板列表</button><button class="btn primary" type="button" data-action="s003-download-template-json">${icon("download", "sm")}下载模板 JSON</button></div></div></section>`;
      } else content = `<div class="resource-list">${templates.map((item) => `<div class="resource-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.id)} · ${s003 ? `${item.sections?.length || 0} 个章节 · 企业评分、因子、分档、证据与处置状态` : `${item.chapters.length} 个章节 · ${item.formats.join(" / ")}`}</small></div><div class="resource-meta"><span>版本</span><strong>${esc(item.version)}</strong></div><div>${badge(item.status, s003 && provider?.contextState.projectionOnly ? "warning" : "success")}</div><button class="btn" type="button" data-action="${s003 ? "navigate" : "open-template"}" ${s003 ? `data-route="/reports?tab=templates&detail=template"` : `data-id="${item.id}"`}>查看详情</button></div>`).join("")}</div>`;
    } else {
      content = products.length ? `<div class="resource-list">${products.map((report) => s003
        ? `<div class="resource-row"><div><strong>${esc(report.enterpriseName)}债务风险评估报告</strong><small class="record-reference">报告编号 ${esc(report.reportId)} · 内容版本 ${esc(report.contentVersion)}</small></div><div class="resource-meta"><span>形成时间</span><strong>${esc(report.publishedAt)}</strong></div><div>${badge(report.stage === "published" ? "已发布" : "工作预览", report.stage === "published" ? "success" : "warning")}</div><button class="btn primary" type="button" data-action="s003-open-report" data-enterprise-id="${esc(report.enterpriseId)}">${icon("book-open", "sm")}查看详情</button></div>`
        : `<div class="resource-row"><div><strong>集团融资经营分析报告</strong><small class="record-reference">报告编号 ${esc(report.reportNo)} · 内容版本 ${esc(report.contentVersion)}${report.replacedReportNo ? ` · 替代 ${esc(report.replacedReportNo)}` : ""}</small></div><div class="resource-meta"><span>发布时间</span><strong>${esc(report.publishedAt)}</strong></div><div>${badge(report.stage === "withdrawn" ? "已撤回" : "已发布", report.stage === "withdrawn" ? "warning" : "success")}</div><button class="btn ${report.stage === "published" ? "primary" : ""}" type="button" data-action="open-published-report" data-report="${esc(report.reportNo)}">${icon("book-open", "sm")}查看详情</button></div>`).join("")}</div>` : `<div class="panel"><div class="empty-state"><div><div class="empty-icon">${icon("library")}</div><h2>尚无正式报告</h2><p>${s003 ? "当前 Published 报告清单没有可展示的企业报告。" : "从已启用的报告定义创建草稿，经证据固定、自动核验和人工复核后发布。"}</p>${s003 ? `<button class="btn primary" type="button" data-action="s003-open-dashboard">返回公共仪表盘</button>` : `<button class="btn primary" type="button" data-action="open-generation-modal">${icon("file-plus-2", "sm")}创建报告</button>`}</div></div></div>`;
    }
    return renderShell(`
      <div class="page" data-screen-label="报告资源管理">
        <div class="page-header"><div><h1>报告管理</h1><p>${s003 ? "S003 资源通过报告 Provider 装入基线定义、模板和正式报告页；当前场景记录只读可追溯。" : "报告定义约束业务目的与证据，模板只负责章节骨架和版式。"}</p></div><div class="header-actions">${tab === "definitions" && !s003 ? `<button class="btn" type="button" data-action="open-new-definition">${icon("plus", "sm")}新建报告定义</button>` : ""}<button class="btn primary" type="button" data-action="navigate" data-route="${s003 ? "/reports?tab=products" : "/reports/generate"}">${icon(s003 ? "library" : "wand-sparkles", "sm")}${s003 ? "查看正式报告" : "生成报告"}</button></div></div>
        <div class="tabs"><a class="tab ${tab === "definitions" ? "active" : ""}" href="#/reports?tab=definitions">报告定义 <span>${definitions.length}</span></a><a class="tab ${tab === "templates" ? "active" : ""}" href="#/reports?tab=templates">报告模板 <span>${templates.length}</span></a><a class="tab ${tab === "products" ? "active" : ""}" href="#/reports?tab=products">正式报告 <span>${products.filter((item) => !s003 || item.stage === "published").length}</span></a></div>
        ${content}
      </div>
    `, { crumb: tab === "products" ? "正式报告" : tab === "templates" ? "报告模板" : "报告定义", asOf: provider?.assessmentAt || undefined, publishedReportCount: s003 ? products.filter((item) => item.stage === "published").length : undefined });
  }

  function generationProgress() {
    const report = state.report;
    if (report.stage === "evidence_missing") {
      if (report.generationBlock?.type === "authority-trust-gate") {
        const block = report.generationBlock;
        return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>新内容版本生成已阻断</h2><p>报告中心在${esc(block.phase || "生成前")}重新读取 C008/C017 后停止本次流程。</p></div>${badge("阻断", "danger")}</div><div class="notice danger">${icon("shield-x")}<div><strong>${esc(block.reason || "当前权威组合不满足生成门")}</strong><span>原报告、生成请求和既有证据保持不变；未形成新证据包，未提交 Agent Run，也未自行切换上一可信组合。</span></div></div><div class="progress-facts"><div class="fact"><span>生成请求</span><strong>${esc(block.requestId || report.requestId || "未取得")}</strong></div><div class="fact"><span>安全门阶段</span><strong>${esc(block.phase || "未取得")}</strong></div><div class="fact"><span>C017 当前摘要</span><strong>${esc(block.currentSummaryId || "未取得")} · ${esc(block.currentSummaryVersion || "未取得")}</strong></div><div class="fact"><span>读取时间</span><strong>${esc(block.checkedAt || block.readAt || "未取得")}</strong></div></div><div class="button-row"><button class="btn primary" type="button" data-action="retry-blocked-generation">${icon("refresh-cw", "sm")}重新读取并重试</button>${block.isReplacement && state.regenerationRequest?.sourceReportNo ? `<button class="btn" type="button" data-action="open-published-report" data-report="${esc(state.regenerationRequest.sourceReportNo)}">查看原报告</button>` : `<button class="btn" type="button" data-action="open-trust">查看数据状态</button>`}</div></div></section>`;
      }
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>证据固定未完成</h2><p>机构授信附件当前不可读，无法进入 Agent 生成。</p></div>${badge("证据缺失")}</div><div class="notice danger">${icon("file-warning")}<div><strong>受限附件缺少访问权限</strong><span>影响“重点机构授信情况”章节。报告正文不能用推测补齐。</span></div></div><div class="button-row"><button class="btn primary" type="button" data-action="retry-standard-generation">${icon("refresh-cw", "sm")}改用标准证据范围并重试</button><button class="btn" type="button" data-action="open-generation-modal">调整生成范围</button></div></div></section>`;
    }
    if (report.stage === "publish_failed") {
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>正式产物形成失败</h2><p>HTML 阅读版已形成，但 PDF 固定版任务失败；当前内容版本没有进入正式目录。</p></div>${badge("发布失败", "danger")}</div><div class="notice danger">${icon("file-warning")}<div><strong>PDF 字体资源校验超时</strong><span>报告编号尚未生成，HTML 与 PDF 不会分叉发布。可重试同一次发布任务或返回草稿。</span></div></div><div class="button-row"><button class="btn primary" type="button" data-action="retry-publish">${icon("refresh-cw", "sm")}重试发布</button><button class="btn" type="button" data-action="navigate" data-route="/reports/draft">返回已确认内容</button></div></div></section>`;
    }
    if (report.stage === "generation_failed") {
      const external = rereadGeneration(report);
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>报告内容生成失败</h2><p>证据包已固定并保留；Agent 应用没有返回身份一致、可接收的 C023 源草稿。</p></div>${badge("生成失败", "danger")}</div><div class="notice danger">${icon("circle-x")}<div><strong>${esc(external?.failure || "未取得可用生成结果")}</strong><span>失败原因来自 Agent 应用当前回读；报告中心不补造 Run、Result 或源草稿。</span></div></div><div class="progress-facts"><div class="fact"><span>证据包</span><strong>${esc(report.evidencePackId)}</strong></div><div class="fact"><span>失败运行</span><strong>${esc(report.generationRunId || "尚未形成")}</strong></div><div class="fact"><span>责任位置</span><strong>Agent 应用</strong></div><div class="fact"><span>恢复方式</span><strong>修复后创建新 Run，或重新读取原请求</strong></div></div><div class="button-row"><button class="btn primary" type="button" data-action="retry-generation">${icon("refresh-cw", "sm")}重新交付生成请求</button><button class="btn" type="button" data-action="reread-generation">${icon("rotate-cw", "sm")}重新读取原请求</button><button class="btn" type="button" data-action="open-trace">查看追溯</button></div></div></section>`;
    }
    if (["evidence", "generating", "publishing"].includes(report.stage)) {
      const title = report.stage === "evidence" ? "正在固定生成证据" : report.stage === "generating" ? "正在生成结构化草稿" : "正在形成 HTML 与 PDF";
      const copy = report.stage === "evidence" ? "正在锁定定义、模板、语义、数据版本与证据槽位。" : report.stage === "generating" ? "C022 已交付；等待 Agent 应用形成独立 Run 和 C023 源草稿。" : "两种阅读形态来自同一已确认内容版本。";
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${title}</h2><p>${copy}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:${report.progress}%"></span></div><div class="progress-facts"><div class="fact"><span>报告请求</span><strong>${esc(report.requestId)}</strong></div><div class="fact"><span>证据包</span><strong>${esc(report.evidencePackId || "固定中")}</strong></div><div class="fact"><span>Agent 运行</span><strong>${esc(report.generationRunId || "等待 Agent 应用形成")}</strong></div><div class="fact"><span>当前进度</span><strong>${report.progress}%</strong></div></div>${report.stage === "generating" ? `<div class="button-row"><button class="btn primary" type="button" data-action="reread-generation">${icon("refresh-cw", "sm")}重新读取 Agent 草稿</button>${!report.generationRunId ? `<button class="btn" type="button" data-action="retry-generation">${icon("send", "sm")}重新交付请求</button>` : ""}</div>` : ""}<div class="help-text">可以离开当前页面；返回后需重新读取 Agent 应用权威记录，报告中心不保存运行状态副本。</div></div></section>`;
    }
    if (["draft", "returned", "confirmed", "published", "withdrawn"].includes(report.stage)) {
      const status = report.stage === "draft" ? "草稿待复核" : report.stage === "returned" ? "已退回" : report.stage === "confirmed" ? "已确认待发布" : report.stage === "withdrawn" ? "已撤回" : "已发布";
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${report.stage === "published" ? "正式报告已形成" : report.stage === "withdrawn" ? "正式报告已撤回" : report.stage === "returned" ? "草稿已退回修订" : "草稿已返回"}</h2><p>${["published", "withdrawn"].includes(report.stage) ? "HTML 阅读版与 PDF 固定版共享编号、内容版本和证据链。" : `草稿版本 ${report.draftVersion} · 证据包 ${report.evidencePackId}`}</p></div>${badge(status)}</div>${report.stage === "returned" ? `<div class="notice warning">${icon("undo-2")}<div><strong>复核问题已关联</strong><span>原草稿和核验结果保持只读；重新生成会形成新的草稿版本。</span></div></div>` : report.stage === "withdrawn" ? `<div class="notice warning">${icon("archive-restore")}<div><strong>目录引用已撤回</strong><span>产物仍按发布时版本只读保留并可追溯，不会用当前定义替代历史证据。</span></div></div>` : ""}<div class="button-row">${report.stage === "returned" ? `<button class="btn primary" type="button" data-action="regenerate-report">${icon("refresh-cw", "sm")}重新生成</button>` : ["published", "withdrawn"].includes(report.stage) ? `<button class="btn primary" type="button" data-action="navigate" data-route="/reports/view">${icon("book-open", "sm")}查看详情</button>` : `<button class="btn primary" type="button" data-action="navigate" data-route="/reports/draft">${icon("scan-text", "sm")}打开草稿</button>`}<button class="btn" type="button" data-action="open-trace">${icon("git-branch", "sm")}查看追溯</button></div></div></section>`;
    }
    return "";
  }

  function renderGenerate() {
    const s003 = s003ScenarioSelected();
    if (s003) {
      const provider = s003NativeProvider();
      const formalCount = provider ? provider.reports.filter((report) => report.stage === "published").length : 0;
      const requestedEnterpriseId = routeInfo().query.get("enterpriseId") || s003Dashboard.selectedEnterpriseId;
      const selected = provider?.reports.find((report) => report.enterpriseId === requestedEnterpriseId) || provider?.reports[0] || null;
      const reportParams = selected ? { enterpriseId: selected.enterpriseId, reportId: selected.reportId, runId: selected.content?.scenarioIdentity?.scenarioRunId } : {};
      const historyVersions = provider?.history?.versions || [];
      const body = provider ? `<div class="section-stack"><section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${provider.contextState.projectionOnly ? "当前为报告工作预览" : "企业风险报告已形成"}</h2><p>${esc(provider.manifestId)} · 版本 ${esc(provider.manifestVersion)}</p></div>${badge(provider.contextState.projectionOnly ? "不可消费" : "已发布", provider.contextState.projectionOnly ? "warning" : "success")}</div><div class="progress-facts"><div class="fact"><span>报告定义</span><strong>${esc(provider.definition.id)}</strong></div><div class="fact"><span>企业报告</span><strong>${provider.reports.length} 份</strong></div><div class="fact"><span>正式报告</span><strong>${formalCount} 份</strong></div><div class="fact"><span>评估时点</span><strong>${esc(provider.assessmentAt)}</strong></div></div><div class="notice"><span>${icon("shield-check")}</span><div><strong>当前页沿用基线六阶段生命周期</strong><span>S003 一期报告由 Published 风险结果确定性形成；“形成报告”替代专属 Agent 生成，但选择定义、固定证据、复核、固定产物、发布和历史替代语义保持不变。</span></div></div>${selected ? `<div class="detail-list"><div class="detail-row"><span>当前企业</span><strong>${esc(selected.enterpriseName)} · ${esc(selected.enterpriseId)}</strong></div><div class="detail-row"><span>当前报告</span><strong>${esc(selected.reportId)} · 内容版本 ${esc(selected.contentVersion)}</strong></div><div class="detail-row"><span>正式产物</span><strong>固定 HTML · 浏览器打印 / 另存为 PDF</strong></div></div>` : ""}<div class="button-row">${selected ? `<button class="btn" type="button" data-action="navigate" data-route="${esc(s003ReportRoute("/reports/draft", reportParams))}">${icon("scan-text", "sm")}形成时复核</button><button class="btn" type="button" data-action="navigate" data-route="${esc(s003ReportRoute("/reports/pdf", reportParams))}">${icon("printer", "sm")}打印 / PDF</button><button class="btn primary" type="button" data-action="navigate" data-route="${esc(s003ReportRoute("/reports/view", reportParams))}">${icon("book-open", "sm")}查看正式报告</button>` : `<button class="btn" type="button" data-action="navigate" data-route="/reports?tab=products">查看正式报告</button>`}<button class="btn" type="button" data-action="s003-open-dashboard">返回公共仪表盘</button></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">报告版本、撤回与替代语义</div><p>旧版本保持不可变；新内容通过 supersedes / supersededBy 建立替代链，不在原报告上覆盖修改。</p></div>${badge(`${historyVersions.length} 个不可变版本`, "plain")}</div><div class="panel-body section-stack"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>顺序</th><th>清单版本</th><th>形成时间</th><th>状态</th><th>替代关系</th><th>清单引用</th></tr></thead><tbody>${historyVersions.map((version) => `<tr><td>${version.sequence}</td><td><strong>${esc(version.manifestVersion)}</strong><small class="table-subline">${esc(version.manifestId)}</small></td><td>${esc(version.formedAt)}</td><td>${badge(version.status === "current" ? "当前正式版本" : "历史只读", version.status === "current" ? "success" : "plain")}</td><td>${version.supersededBy ? `被 ${esc(version.supersededBy.split("/").at(-1))} 替代` : "当前版本"}<small class="table-subline">${version.supersedes ? `替代 ${esc(version.supersedes.split("/").at(-1))}` : "初始版本"}</small></td><td><code>${esc(version.manifestRef)}</code></td></tr>`).join("")}</tbody></table></div><div class="notice"><span>${icon("archive-restore", "sm")}</span><div><strong>撤回不删除历史</strong><span>${esc(provider.history?.semantics?.withdrawal || "撤回只改变目录引用；历史内容与哈希继续保留。")}</span></div></div></div></section></div>` : s003NativeProviderNotice();
      const steps = ["选择定义", "固定证据", "形成报告", "一致性核验", "固定产物", "已发布"];
      return renderShell(`
        <div class="page" data-screen-label="报告生成工作区">
          <div class="page-header"><div><h1>报告生成</h1><p>S003 报告 Provider 在基线工作区内提供只读生成结果和版本证据。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">查看报告定义</button></div></div>
          <div class="workflow-strip">${steps.map((step, index) => `<div class="workflow-step ${provider && index < 5 ? "done" : provider && index === 5 ? "active" : index === 0 ? "active" : ""}"><span>0${index + 1}</span><strong>${step}</strong></div>`).join("")}</div>
          <div style="height:12px"></div>
          ${body}
        </div>
      `, { crumb: "报告生成", asOf: provider?.assessmentAt || undefined, publishedReportCount: formalCount });
    }
    const def = DATA.definitions[0];
    const report = state.report;
    const authority = currentAuthority();
    const trustProjection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
    const trustReady = trustProjection.readStatus === "ready" && Boolean(authority.bindingId);
    const trustSummary = currentTrust();
    const pendingRegeneration = state.regenerationRequest && (["published", "withdrawn"].includes(report.stage) || report.generationBlock?.isReplacement) ? `
      <section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${state.regenerationRequest.status === "阻断" ? "新生成请求已阻断" : "新生成请求已创建"}</h2><p>原正式报告继续可读；只有新的获准权威组合满足生成门时才会形成独立证据包。</p></div>${badge(state.regenerationRequest.status || "未开始", state.regenerationRequest.status === "阻断" ? "danger" : "")}</div>${state.regenerationRequest.status === "阻断" ? `<div class="notice danger">${icon("shield-x")}<div><strong>当前权威组合不能用于新生成</strong><span>${esc(state.regenerationRequest.blockReason)} 请求与原正式报告均已保留；重新读取后可重试。</span></div></div>` : ""}<div class="progress-facts"><div class="fact"><span>生成请求</span><strong>${esc(state.regenerationRequest.id)}</strong></div><div class="fact"><span>来源报告</span><strong>${esc(state.regenerationRequest.sourceReportNo)}</strong></div><div class="fact"><span>请求时间</span><strong>${esc(state.regenerationRequest.createdAt)}</strong></div><div class="fact"><span>当前状态</span><strong>${esc(state.regenerationRequest.status || "未开始")}</strong></div></div><div class="button-row"><button class="btn primary" type="button" data-action="start-pending-regeneration">${icon(state.regenerationRequest.status === "阻断" ? "refresh-cw" : "play", "sm")}${state.regenerationRequest.status === "阻断" ? "重新读取并重试" : "开始固定证据"}</button><button class="btn" type="button" data-action="open-published-report" data-report="${esc(state.regenerationRequest.sourceReportNo)}">查看原报告</button></div></div></section>` : "";
    return renderShell(`
      <div class="page" data-screen-label="报告生成工作区">
        <div class="page-header"><div><h1>报告生成</h1><p>从已启用定义固定证据，生成结构化草稿并进入复核。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">查看报告定义</button></div></div>
        ${trustStrip()}
        ${workflowStrip()}
        <div style="height:12px"></div>
        ${pendingRegeneration || (report.stage === "idle" ? `<div class="two-col"><section class="panel"><div class="panel-head"><div><div class="panel-title">生成范围</div><p>当前只选择报告定义允许的对象与证据。</p></div></div><div class="panel-body detail-list"><div class="detail-row"><span>报告定义</span><strong>${def.name} · ${def.version}</strong></div><div class="detail-row"><span>适用对象</span><strong>集团融资经营分析 · 集团范围</strong></div><div class="detail-row"><span>模板</span><strong>${def.template}</strong></div><div class="detail-row"><span>证据范围</span><strong>${def.evidence}</strong></div><div class="detail-row"><span>Agent</span><strong>${def.agent}</strong></div><div class="detail-row"><span>发布规则</span><strong>${def.publish}</strong></div><div class="button-row" style="margin-top:12px"><button class="btn primary" type="button" data-action="open-generation-modal">${icon("wand-sparkles", "sm")}开始生成</button></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">版本与证据准备</div><p>正式生成前固定当前组合。</p></div></div><div class="panel-body checklist"><div class="check-row">${icon("circle-check", "sm")}<div><strong>报告定义与模板</strong><span>${def.version} / 2.2.0</span></div></div><div class="check-row">${icon(trustReady ? "circle-check" : "circle-dashed", "sm")}<div><strong>Published 语义</strong><span>${esc(authority.semanticVersion || "待读取 C008 当前权威组合")}</span></div></div><div class="check-row">${icon(trustReady ? "circle-check" : "circle-dashed", "sm")}<div><strong>精确数据版本</strong><span>${trustReady ? `${esc(authority.dataVersion)} · 截至 ${esc(authority.asOf)}` : "未取得 T019/C017 可消费版本"}</span></div></div><div class="check-row">${icon(trustReady ? "circle-alert" : "shield-x", "sm")}<div><strong>质量与消费状态</strong><span>${esc(trustReady ? `${trustSummary.publishedQuality || "未取得"} · ${trustSummary.readiness || authority.readiness || "未取得"}` : trustProjection.reason || "统一权威投影未就绪")}</span></div></div></div></section></div>` : generationProgress())}
      </div>
    `, { crumb: "报告生成" });
  }

  function reportChapters() {
    return [
      ["sec-overview", "01", "经营概览"],
      ["sec-cost", "02", "融资成本"],
      ["sec-structure", "03", "债务结构"],
      ["sec-units", "04", "重点单位与机构"],
      ["sec-rules", "05", "规则发现"],
      ["sec-evidence", "06", "证据与限制"],
    ];
  }

  function evidenceSpan(id, content, ref, extraClass = "") {
    const formal = ["published", "withdrawn"].includes(readingReport().stage);
    const selected = !formal && state.assistant.selectedAnchor === id ? "selected" : "";
    return `<span id="${id}" class="evidence-anchor ${selected} ${extraClass}" tabindex="0" data-clickable="true" data-action="select-anchor" data-anchor="${id}">${content}<sup class="evidence-ref">${ref}</sup></span>`;
  }

  function reportPaper() {
    const report = readingReport();
    if (["published", "withdrawn"].includes(report.stage) && report.frozenHtml) return normalizeFrozenReportHtml(report.frozenHtml);
    const binding = bindingFor(report);
    const bindingTrust = reportBindingSummary(report);
    const snapshot = report.contentSnapshot || createContentSnapshot(report);
    if (!snapshot) return `<article class="report-paper"><section class="report-section"><div class="notice danger">${icon("file-question")}<div><strong>报告事实不可定位</strong><span>当前精确权威组合没有可读取的报告事实包，不能使用其他版本正文替代。</span></div></div></section></article>`;
    const hasHighCostMismatch = snapshotValueMismatch(snapshot, "FACT-GROUP-HIGH-COST");
    const hasSuggestionGap = Boolean(snapshotBindingGap(snapshot, "FACT-SUGGESTION-SCOPE"));
    const unitFacts = ["553", "465", "561"].map((key) => ({
      key,
      name: `单位${key}`,
      balance: snapshotFactText(snapshot, `FACT-UNIT-${key}-BALANCE`, 3, false),
      cost: snapshotFactText(snapshot, `FACT-UNIT-${key}-COST`, 6),
    }));
    const ruleFacts = ["R01", "R02", "R03"].map((code) => {
      const result = snapshotContentFact(snapshot, `FACT-${code}-RESULT`) || snapshotAuthoritativeFact(snapshot, `FACT-${code}-RESULT`);
      return {
        code,
        scope: result?.scope || "不可定位",
        result: snapshotFactText(snapshot, `FACT-${code}-RESULT`, 6, false),
        branch: snapshotFactText(snapshot, `FACT-${code}-BRANCH`, 6, false),
        threshold: snapshotFactText(snapshot, `FACT-${code}-THRESHOLD`, 6),
        evaluatedAt: snapshotFactText(snapshot, `FACT-${code}-EVALUATED-AT`, 6, false),
      };
    });
    const reportLabel = ["published", "withdrawn"].includes(report.stage) ? report.reportNo : report.draftId;
    const contentVersion = report.contentVersion || report.draftVersion || "0.1";
    return `
      <article class="report-paper" aria-label="集团融资经营分析报告正文">
        <header class="report-cover" id="report-cover">
          <span class="kicker">集团融资经营分析</span>
          <h1>集团融资成本与债务结构分析报告</h1>
          <p>围绕融资余额、加权融资成本、债务结构、重点单位与机构贡献，形成可追溯的经营情况分析。</p>
          <div class="report-cover-meta"><span>报告编号：${esc(reportLabel)}</span><span>内容版本：${esc(contentVersion)}</span><span>本体版本：${esc(binding.semanticVersion)}（已发布）</span><span>数据版本：${esc(binding.dataVersion)}</span><span>数据截至：${esc(binding.asOf)}</span><span>版本绑定摘要：${esc(bindingTrust?.id || "不可定位")} / ${esc(bindingTrust?.version || "未取得")}</span><span>证据包：${esc(report.evidencePackId)}</span></div>
        </header>
        <section class="report-section" id="sec-overview">
          <h2>一、经营概览</h2>
          <p class="report-lead" id="narrative-overview">截至 ${evidenceSpan("date-asof", snapshotFactText(snapshot, "FACT-AS-OF", 6, false), "E01")}，集团融资余额为 ${evidenceSpan("metric-balance", snapshotFactText(snapshot, "FACT-GROUP-BALANCE", 3), "E02")}，余额加权融资成本为 ${evidenceSpan("metric-cost", snapshotFactText(snapshot, "FACT-GROUP-COST", 6), "E03")}。</p>
          <div class="report-kpis"><div class="report-kpi"><span>融资余额</span><strong>${evidenceSpan("kpi-balance", snapshotFactText(snapshot, "FACT-GROUP-BALANCE", 3), "E02")}</strong></div><div class="report-kpi"><span>加权融资成本</span><strong>${evidenceSpan("kpi-cost", snapshotFactText(snapshot, "FACT-GROUP-COST", 6), "E03")}</strong></div><div class="report-kpi"><span>浮动利率余额占比</span><strong>${evidenceSpan("kpi-floating", snapshotFactText(snapshot, "FACT-GROUP-FLOATING", 6), "E04")}</strong></div></div>
          <p id="narrative-overview-judgment">${evidenceSpan("judgment-cost-trend", snapshotFactText(snapshot, "FACT-JUDGMENT-COST-TREND", 6, false), "E28")} ${evidenceSpan("judgment-floating-exposure", snapshotFactText(snapshot, "FACT-JUDGMENT-FLOATING-EXPOSURE", 6, false), "E29")}</p>
        </section>
        <section class="report-section" id="sec-cost">
          <h2>二、融资成本</h2>
          <p id="narrative-cost">${evidenceSpan("judgment-cost-low", snapshotFactText(snapshot, "FACT-JUDGMENT-COST-LOW", 6, false), "E30")} 高成本融资余额占比为 ${evidenceSpan("metric-high-cost", snapshotFactText(snapshot, "FACT-GROUP-HIGH-COST", 6), "E05", hasHighCostMismatch ? "has-review" : "")}${hasHighCostMismatch ? `<sup class="review-marker">!</sup>` : ""}。${evidenceSpan("judgment-high-cost-unit553", snapshotFactText(snapshot, "FACT-JUDGMENT-HIGH-COST-UNIT553", 6, false), "E31")}</p>
          <div class="report-chart" id="chart-cost-figure"><h4>${evidenceSpan("chart-cost", "近六个月融资成本（%）", "E03")}</h4><div class="report-bars">${snapshot.trend.map((item) => `<div class="report-bar">${evidenceSpan(`chart-cost-${item.month}`, `<i style="height:${48 + (item.cost - 2.34) * 820}px"></i><span>${item.month.slice(5)}<br>${formatNumber(item.cost, 3)}</span>`, "E03")}</div>`).join("")}</div></div>
          <p id="narrative-cost-method">${evidenceSpan("disclosure-weighted-method", snapshotFactText(snapshot, "FACT-DISCLOSURE-WEIGHTED-METHOD", 6, false), "E32")} ${evidenceSpan("disclosure-fixed-results", snapshotFactText(snapshot, "FACT-DISCLOSURE-FIXED-RESULTS", 6, false), "E37")}</p>
        </section>
        <section class="report-section" id="sec-structure">
          <h2>三、债务结构</h2>
          <p id="narrative-structure">浮动利率余额占比为 ${evidenceSpan("structure-floating", snapshotFactText(snapshot, "FACT-GROUP-FLOATING", 6), "E04")}；短期债务余额占比为 ${evidenceSpan("structure-short", snapshotFactText(snapshot, "FACT-GROUP-SHORT", 6), "E06")}；外币融资余额占比为 ${evidenceSpan("structure-foreign", snapshotFactText(snapshot, "FACT-GROUP-FOREIGN", 6), "E07")}。</p>
          <table class="report-table"><thead><tr><th>结构维度</th><th class="num">主要类别</th><th class="num">占比</th><th>证据说明</th></tr></thead><tbody><tr><td>利率结构</td><td class="num">浮动利率</td><td class="num">${evidenceSpan("cell-floating", snapshotFactText(snapshot, "FACT-GROUP-FLOATING", 6), "E04")}</td><td>${evidenceSpan("judgment-floating-high", snapshotFactText(snapshot, "FACT-JUDGMENT-FLOATING-HIGH", 6, false), "E33")}</td></tr><tr><td>期限结构</td><td class="num">短期</td><td class="num">${evidenceSpan("cell-short", snapshotFactText(snapshot, "FACT-GROUP-SHORT", 6), "E06")}</td><td>${evidenceSpan("judgment-short-low", snapshotFactText(snapshot, "FACT-JUDGMENT-SHORT-LOW", 6, false), "E34")}</td></tr><tr><td>币种结构</td><td class="num">外币</td><td class="num">${evidenceSpan("cell-foreign", snapshotFactText(snapshot, "FACT-GROUP-FOREIGN", 6), "E07")}</td><td>${evidenceSpan("judgment-unit553-foreign", snapshotFactText(snapshot, "FACT-UNIT553-FOREIGN-CURRENCY", 6, false), "E35")}</td></tr><tr><td>担保结构</td><td class="num">信用</td><td class="num">${evidenceSpan("cell-credit", snapshotFactText(snapshot, "FACT-GROUP-CREDIT", 6), "E08")}</td><td>见第六章质量限制</td></tr></tbody></table>
          <p>担保方式未知余额占比为 ${evidenceSpan("structure-unknown", snapshotFactText(snapshot, "FACT-GUARANTEE-UNKNOWN", 6), "E09")}。未知值未被归入信用融资，相关披露构成质量提示。</p>
        </section>
        <section class="report-section" id="sec-units">
          <h2>四、重点单位与机构</h2>
          <p id="narrative-unit-comparison">单位553、单位465和单位561的组合融资余额为 ${evidenceSpan("compare-balance", snapshotFactText(snapshot, "FACT-THREE-UNIT-BALANCE", 3), "E10")}，组合加权融资成本为 ${evidenceSpan("compare-cost", snapshotFactText(snapshot, "FACT-THREE-UNIT-COST", 6), "E11")}。</p>
          <table class="report-table"><thead><tr><th>单位</th><th class="num">融资余额（亿元）</th><th class="num">加权成本</th></tr></thead><tbody>${unitFacts.map((unit) => `<tr><td>${unit.name}</td><td class="num">${evidenceSpan(`unit-${unit.key}-balance`, unit.balance, "E10")}</td><td class="num">${evidenceSpan(`unit-${unit.key}-cost`, unit.cost, "E11")}</td></tr>`).join("")}</tbody></table>
          <p id="narrative-institution-priority">单位553的高成本问题融资主要集中于 ${evidenceSpan("institution-priority", snapshotFactText(snapshot, "FACT-R01-INSTITUTIONS", 6, false), "E12")}。${evidenceSpan("institution-priority-basis", snapshotFactText(snapshot, "FACT-INSTITUTION-PRIORITY-BASIS", 6, false), "E36")}</p>
        </section>
        <section class="report-section" id="sec-rules">
          <h2>五、规则发现</h2>
          ${ruleFacts.map((rule, index) => `<div class="report-rule" id="narrative-rule-${rule.code.toLowerCase()}"><strong>${evidenceSpan(`rule-${rule.code.toLowerCase()}-result`, `${rule.code} · ${rule.scope}${rule.result}`, `E${13 + index}`)}</strong><span>触发分支：${evidenceSpan(`rule-${rule.code.toLowerCase()}-branch`, rule.branch, `E${13 + index}`)}；阈值 ${evidenceSpan(`rule-${rule.code.toLowerCase()}-threshold`, rule.threshold, `E${13 + index}`)}；评估时间 ${evidenceSpan(`rule-${rule.code.toLowerCase()}-evaluated-at`, rule.evaluatedAt, `E${13 + index}`)}。</span></div>`).join("")}
          <p id="narrative-suggestion" class="evidence-anchor ${!["published", "withdrawn"].includes(report.stage) && state.assistant.selectedAnchor === "narrative-suggestion" ? "selected" : ""}" tabindex="0" data-clickable="true" data-action="select-anchor" data-anchor="narrative-suggestion">${hasSuggestionGap ? `<span id="suggestion-basis" class="evidence-anchor has-review" tabindex="0" data-clickable="true" data-action="select-anchor" data-anchor="suggestion-basis">${snapshotFactText(snapshot, "FACT-SUGGESTION-SCOPE", 6, false)}<sup class="review-marker">!</sup></span>` : evidenceSpan("suggestion-basis", snapshotFactText(snapshot, "FACT-SUGGESTION-SCOPE", 6, false), "E16")}</p>
        </section>
        <section class="report-section" id="sec-evidence">
          <h2>六、证据与限制</h2>
          <div id="narrative-trust-disclosure"><p>本报告固定引用报告定义 ${evidenceSpan("disclosure-definition-version", snapshotFactText(snapshot, "FACT-REPORT-DEFINITION-VERSION", 6, false), "E17")}、模板 ${evidenceSpan("disclosure-template-version", snapshotFactText(snapshot, "FACT-REPORT-TEMPLATE-VERSION", 6, false), "E18")}、已发布语义版本 ${evidenceSpan("disclosure-semantic-version", snapshotFactText(snapshot, "FACT-PUBLISHED-SEMANTIC-VERSION", 6, false), "E19")}、数据版本 ${evidenceSpan("disclosure-data-version", snapshotFactText(snapshot, "FACT-DATA-VERSION", 6, false), "E20")}、版本绑定摘要 ${esc(bindingTrust?.id || "不可定位")} / ${esc(bindingTrust?.version || "未取得")}（形成于 ${esc(bindingTrust?.formedAt || "未取得")}）和证据包 ${esc(report.evidencePackId)}。</p>
          <p>数据截至 ${evidenceSpan("disclosure-data-asof", snapshotFactText(snapshot, "FACT-DATA-AS-OF-DISCLOSURE", 6, false), "E21")}；质量 ${evidenceSpan("disclosure-quality", snapshotFactText(snapshot, "FACT-DATA-QUALITY-STATUS", 6, false), "E22")}；新鲜度 ${evidenceSpan("disclosure-freshness", snapshotFactText(snapshot, "FACT-DATA-FRESHNESS", 6, false), "E23")}；生成时消费状态 ${evidenceSpan("disclosure-readiness", snapshotFactText(snapshot, "FACT-DATA-READINESS", 6, false), "E24")}。</p>
          <p>${evidenceSpan("disclosure-quality-limitation", snapshotFactText(snapshot, "FACT-QUALITY-LIMITATION", 6, false), "E25")} ${evidenceSpan("disclosure-llm-role", snapshotFactText(snapshot, "FACT-LLM-ROLE-LIMITATION", 6, false), "E26")} ${evidenceSpan("disclosure-snapshot-freeze", snapshotFactText(snapshot, "FACT-SNAPSHOT-FREEZE-LIMITATION", 6, false), "E27")}</p></div>
          <div class="report-footnotes">E01—E37 均可从报告助手或追溯详情打开。HTML 阅读版与 PDF 固定版共享报告标识、内容版本和证据链。</div>
        </section>
      </article>
    `;
  }

  function tocPane() {
    const report = readingReport();
    return `<aside class="reader-toc"><div class="pane-heading"><strong>章节目录</strong><small>点击章节定位正文</small></div><div class="toc-list">${reportChapters().map(([id, no, name]) => `<button class="toc-link ${state.assistant.selectedSection === id ? "active" : ""}" type="button" data-action="jump-section" data-section="${id}"><em>${no}</em><span>${name}</span></button>`).join("")}</div><div class="toc-meta"><span class="badge plain">内容版本 ${report.contentVersion || report.draftVersion}</span><span class="badge plain">证据包 ${report.evidencePackId}</span><button class="text-link" type="button" data-action="open-trace">查看完整追溯</button></div></aside>`;
  }

  function activeVerification(report = readingReport()) {
    if (["published", "withdrawn"].includes(report.stage)) return report.postPublicationVerification || { ...freshVerification(), scope: "整份报告" };
    return report.verification;
  }

  function verificationForWrite(report = readingReport()) {
    if (["published", "withdrawn"].includes(report.stage)) {
      report.postPublicationVerification = report.postPublicationVerification || freshVerification();
      return report.postPublicationVerification;
    }
    return report.verification;
  }

  function contentContract(report = readingReport()) {
    return currentContentRecord(report) || { t044Bindings: [], factInventory: [], renderManifest: { items: [] }, verificationPlan: [] };
  }

  function anchorsForScope(report = readingReport(), scopeContext = activeVerification(report).scopeContext) {
    const anchors = contentContract(report).t044Bindings.filter((item) => item.anchorId);
    if (!scopeContext || scopeContext.scope === "整份报告") return anchors;
    if (scopeContext.scope === "当前章节") return anchors.filter((anchor) => anchor.templateSlot === scopeContext.sectionId);
    return anchors.filter((anchor) => anchor.anchorId === scopeContext.anchorId);
  }

  function freezeVerificationScope(report = readingReport()) {
    const scope = activeVerification(report).scope;
    return {
      scope,
      sectionId: scope === "当前章节" ? state.assistant.selectedSection : null,
      anchorId: scope === "当前锚点" ? state.assistant.selectedAnchor : null,
    };
  }

  function frozenVerificationScope(verification) {
    return verification.runScope || verification.scopeContext?.scope || verification.scope;
  }

  function verificationPlanForScope(report = readingReport(), scopeContext = activeVerification(report).scopeContext, planSnapshot = null) {
    const contract = contentContract(report);
    const plan = Array.isArray(planSnapshot) && planSnapshot.length ? planSnapshot : contract.verificationPlan;
    if (!scopeContext || scopeContext.scope === "整份报告") return plan;
    const selectedBindings = anchorsForScope(report, scopeContext);
    const factIds = new Set(selectedBindings.flatMap((item) => item.factRefs || []));
    const contentItemIds = new Set(selectedBindings.map((item) => item.contentItemId).filter(Boolean));
    const scopedManifestItems = (contract.renderManifest?.items || []).filter((item) => scopeContext.scope === "当前章节"
      ? item.templateSlot === scopeContext.sectionId
      : item.anchorId === scopeContext.anchorId);
    scopedManifestItems.forEach((item) => contentItemIds.add(item.contentItemId));
    return plan.filter((item) => factIds.has(item.factId) || contentItemIds.has(item.contentItemId));
  }

  function coverageForPlan(report, scopeContext, completed = false, progress = 0, error = 0, planSnapshot = null) {
    const plan = verificationPlanForScope(report, scopeContext, planSnapshot);
    const contract = contentContract(report);
    const scopedBindings = anchorsForScope(report, scopeContext);
    const facts = new Set(plan.map((item) => item.factId));
    const done = completed ? Math.max(0, plan.length - error) : 0;
    return {
      status: completed && done === plan.length && error === 0 ? "complete" : error ? "error" : done ? "partial" : "not_started",
      planned: plan.length,
      applicable: plan.length,
      completed: done,
      pending: Math.max(0, plan.length - done - error),
      error,
      notApplicable: 0,
      skipped: 0,
      factTotal: scopeContext?.scope === "整份报告" ? contract.factInventory.length : facts.size,
      factCovered: completed ? (scopeContext?.scope === "整份报告" ? contract.factInventory.length : facts.size) : 0,
      anchorTotal: scopeContext?.scope === "整份报告" ? contract.t044Bindings.filter((item) => item.anchorId).length : scopedBindings.length,
      anchorCovered: completed ? scopedBindings.length : 0,
    };
  }

  function coverageFromUnitResults(report, scopeContext, planSnapshot, unitResults) {
    const plan = verificationPlanForScope(report, scopeContext, planSnapshot);
    const contract = contentContract(report);
    const scopedBindings = anchorsForScope(report, scopeContext);
    const resultById = new Map((unitResults || []).map((item) => [item.id, item]));
    const applicable = plan.filter((item) => (resultById.get(item.id)?.applicability || item.applicability) !== "not_applicable");
    const completedUnits = applicable.filter((item) => resultById.get(item.id)?.executionState === "completed");
    const errorUnits = applicable.filter((item) => resultById.get(item.id)?.executionState === "error");
    const skippedUnits = applicable.filter((item) => resultById.get(item.id)?.executionState === "skipped");
    const completedFactIds = new Set(completedUnits.map((item) => item.factId).filter(Boolean));
    const scopedFactIds = new Set(applicable.map((item) => item.factId).filter(Boolean));
    const completedContentIds = new Set(completedUnits.map((item) => item.contentItemId).filter(Boolean));
    const coveredAnchors = scopedBindings.filter((binding) => {
      if (binding.contentItemId && completedContentIds.has(binding.contentItemId)) return true;
      return (binding.factRefs || []).some((factId) => completedFactIds.has(factId));
    });
    const notApplicable = plan.length - applicable.length;
    const completedCount = completedUnits.length;
    const pending = Math.max(0, applicable.length - completedCount - errorUnits.length - skippedUnits.length);
    return {
      status: pending === 0 && errorUnits.length === 0 && skippedUnits.length === 0 && completedCount === applicable.length ? "complete" : errorUnits.length ? "error" : completedCount ? "partial" : "not_started",
      planned: plan.length,
      applicable: applicable.length,
      completed: completedCount,
      pending,
      error: errorUnits.length,
      notApplicable,
      skipped: skippedUnits.length,
      factTotal: scopeContext?.scope === "整份报告" ? contract.factInventory.length : scopedFactIds.size,
      factCovered: completedFactIds.size,
      anchorTotal: scopeContext?.scope === "整份报告" ? contract.t044Bindings.filter((item) => item.anchorId).length : scopedBindings.length,
      anchorCovered: coveredAnchors.length,
    };
  }

  function verificationContext(report, currentStatusSummary = null) {
    const contract = contentContract(report);
    const evidencePack = evidencePackFor(report);
    const snapshot = report.contentSnapshot || currentContentRecord(report)?.snapshot || null;
    const binding = bindingFor(report);
    const factPackage = evidencePack?.authoritativeFactPackage || null;
    const facts = new Map((contract.factInventory || []).map((fact) => [fact.id, fact]));
    const contentFacts = new Map((snapshot?.contentFacts || []).map((fact) => [fact.sourceFactId || fact.factId || fact.id, fact]));
    const authoritativeFacts = new Map((snapshot?.authoritativeFacts || factPackage?.contentFacts || []).map((fact) => [fact.id, fact]));
    const manifestItems = contract.renderManifest?.items || [];
    return {
      report,
      contract,
      evidencePack,
      snapshot,
      binding,
      factPackage,
      facts,
      contentFacts,
      authoritativeFacts,
      manifestItems,
      t044ByContentId: new Map((contract.t044Bindings || []).filter((item) => item.contentItemId).map((item) => [item.contentItemId, item])),
      manifestById: new Map(manifestItems.map((item) => [item.contentItemId, item])),
      permission: evidencePack?.permission || { status: "allowed", id: "PERM-REPORT-CONTEXT", version: "1.0" },
      semanticMissing: semanticResolutionFor(report) === "missing",
      exactEvidenceAvailable: factPackageIsAvailable(factPackage),
      currentStatusSummary,
    };
  }

  function outcome(status, reasonCode, issue, impact, recommendation, responsibility) {
    return { status, reasonCode, issue, impact, recommendation, responsibility };
  }

  function permissionBlocked(context) {
    return ["denied", "insufficient", "拒绝", "权限不足"].includes(context.permission?.status);
  }

  function evaluateEvidenceCompleteness(unit, context) {
    if (permissionBlocked(context)) return outcome("unverifiable", "PERMISSION_DENIED", "当前用户无权读取该报告位置的固定证据。", "无法确认内容与证据是否完整。", "申请报告绑定证据范围的读取权限后重新核验。", "权限判定：平台公共权限；核验：报告中心");
    if (!context.exactEvidenceAvailable || context.semanticMissing) return outcome("unverifiable", "EVIDENCE_UNLOCATABLE", "生成时的精确事实包或 Published 语义资源不可定位。", "该位置的证据完整性无法确认。", "按原稳定标识重新读取；不得用当前定义或当前数据替代。", "历史语义：本体管理；事实可复现：数据工程；核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const contentFact = context.contentFacts.get(unit.factId);
    const bindings = context.contract.t044Bindings.filter((item) => item.factRefs.includes(unit.factId) || item.intendedFactRefs?.includes(unit.factId));
    if (snapshotBindingGap(context.snapshot, unit.factId) || contentFact?.bindingStatus === "missing") return outcome("unverifiable", "CONTENT_BINDING_MISSING", "生成内容项缺少完整事实或权威证据绑定。", "无法确认该内容可作为正式报告证据。", "退回并生成新内容版本，补齐结构化绑定。", "Agent 生成结果：Agent 应用；T044 与核验：报告中心");
    if (!fact || !contentFact || !bindings.length || !(fact.evidence || []).length || !fact.resultVersion) return outcome("fail", "EVIDENCE_CONTRACT_INVALID", "可读取上下文中的事实、T044、权威引用或结果版本不完整。", "违反报告定义的必需证据合同。", "修复内容合同后重新生成，不能人工补写为通过。", "内容绑定与 T049：报告中心");
    return outcome("pass", "EVIDENCE_COMPLETE", "事实、T044、稳定锚点、权威引用和结果版本均可定位。", "未发现证据完整性影响。", "保留当前固定绑定。", "内容绑定与 T049：报告中心");
  }

  function evaluateValueConsistency(unit, context) {
    if (permissionBlocked(context) || !context.exactEvidenceAvailable) return outcome("unverifiable", "VALUE_SOURCE_UNAVAILABLE", "固定正文值或权威事实当前不可读取。", "无法比较数值、比例、日期或单位。", "恢复固定证据读取后重新核验。", "事实可复现：数据工程；核验：报告中心");
    const contentFact = context.contentFacts.get(unit.factId);
    const authoritative = context.authoritativeFacts.get(unit.factId);
    if (!contentFact || !authoritative || contentFact.value == null || authoritative.value == null) return outcome("unverifiable", "VALUE_MISSING", "正文值或绑定权威事实缺失。", "无法形成确定性数值结论。", "补齐结构化值、单位和转换规则后重新生成。", "Agent 结构化结果：Agent 应用；核验：报告中心");
    if (contentFact.unit !== authoritative.unit || !comparisonValueEqual(contentFact.value, authoritative.value)) return outcome("fail", "VALUE_MISMATCH", `正文值 ${snapshotFactText(context.snapshot, unit.factId, 6)}，绑定权威事实为 ${formatFactValue(authoritative)}。`, "影响该事实所在摘要、正文、表格或图表及人工确认。", "退回并生成新内容版本，不在正文原地修改。", "内容生成：Agent 应用；确定性判定：报告中心");
    return outcome("pass", "VALUE_MATCH", "正文结构化值、单位与生成时冻结事实一致。", "未发现数值一致性影响。", "保留当前固定值。", "确定性判定：报告中心");
  }

  function evaluateSemanticConsistency(unit, context) {
    if (permissionBlocked(context) || context.semanticMissing) return outcome("unverifiable", "SEMANTIC_UNLOCATABLE", "生成时 Published 语义资源无法按稳定标识读取。", "名称、定义、单位、对象、范围或有效期无法确认。", "等待本体管理按 C026 解析原版本；不得以当前版本替代。", "Published 语义与历史解析：本体管理；核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const semantic = fact?.semanticSnapshot;
    if (!fact || !semantic?.resourceId || !semantic?.publishedVersion || !semantic?.name || !semantic?.definition || !semantic?.applicableObject || !semantic?.timeRange) return outcome("unverifiable", "SEMANTIC_FIELDS_MISSING", "固定语义快照缺少稳定标识、版本、名称、定义、适用对象或时间范围。", "无法完整核对语义披露。", "由本体管理补齐原版本语义证据后重新核验。", "Published 语义：本体管理；核验：报告中心");
    const isDirectQuantitativeClaim = typeof fact.value === "number" || fact.unit != null;
    if (isDirectQuantitativeClaim && (semantic.unit || null) !== (fact.unit || null)) return outcome("fail", "SEMANTIC_UNIT_CONFLICT", `报告单位 ${fact.unit || "无"} 与固定语义单位 ${semantic.unit || "无"} 不一致。`, "可能改变指标含义或比较结果。", "退回并按原 Published 语义重新生成。", "Published 语义：本体管理；内容绑定与核验：报告中心");
    return outcome("pass", "SEMANTIC_MATCH", "名称、定义、单位、适用对象、范围、有效期和 Published 版本可定位且一致。", "未发现语义一致性影响。", "保留稳定语义引用。", "Published 语义：本体管理；核验：报告中心");
  }

  function evaluateVersionCompatibility(unit, context) {
    if (!context.evidencePack || !context.exactEvidenceAvailable) return outcome("unverifiable", "VERSION_CONTEXT_UNAVAILABLE", "生成证据包或精确事实包不可定位。", "无法判断语义、数据与结果版本是否兼容。", "恢复原证据包与版本映射后重新核验。", "权威组合：本体管理；可复现事实：数据工程；核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const pack = context.factPackage;
    const semantic = context.evidencePack.semanticBinding || {};
    const required = [semantic.bindingId, semantic.semanticVersionId, semantic.dataAssetVersionId, semantic.consumableVersionId, semantic.dataVersion, fact?.resultVersion];
    if (required.some((value) => !value)) return outcome("unverifiable", "VERSION_FIELDS_MISSING", "权威组合或事实结果版本字段不完整。", "无法形成同一权威组合的兼容结论。", "由提供模块补齐稳定版本标识和映射后重新核验。", "权威组合：本体管理；数据版本：数据工程；核验：报告中心");
    const matches = semantic.bindingId === pack.authorityBindingId
      && semantic.semanticVersionId === pack.semanticVersionId
      && semantic.dataAssetVersionId === pack.dataAssetVersionId
      && semantic.consumableVersionId === pack.consumableVersionId
      && semantic.dataVersion === pack.dataVersion;
    if (!matches || semantic.compatibility !== "兼容" || semantic.readiness !== "可消费") return outcome("fail", "VERSION_COMBINATION_CONFLICT", "报告内容引用的语义、数据或消费版本不属于同一可消费权威组合。", "报告可能混用候选、不可消费或不兼容结果。", "阻断确认并按正确权威组合重新固定证据。", "权威组合：本体管理；可信度：数据工程；核验：报告中心");
    return outcome("pass", "VERSION_COMPATIBLE", "Published 语义、数据、消费和结果版本属于同一兼容权威组合。", "未发现版本兼容性影响。", "保留当前固定版本组合。", "权威组合：本体管理；核验：报告中心");
  }

  function evaluateTrustDisclosure(unit, context) {
    if (!context.evidencePack) return outcome("unverifiable", "TRUST_SNAPSHOT_UNAVAILABLE", "生成时数据可信度摘要不可定位。", "无法核对截至时间、质量、新鲜度和消费状态。", "恢复生成时 C017 摘要后重新核验。", "可信度事实：数据工程；核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const trust = fact?.trustSnapshot;
    const ownerTrust = context.evidencePack.dataTrustAtGeneration || {};
    const currentStatus = context.currentStatusSummary || {};
    const required = [trust?.asOf, trust?.qualityStatus, trust?.freshnessStatus, trust?.consumptionReadiness, ownerTrust.asOf, ownerTrust.publishedQuality, ownerTrust.freshness, ownerTrust.readiness];
    if (required.some((value) => !value)) return outcome("unverifiable", "TRUST_FIELDS_MISSING", "固定可信度快照缺少截至时间、质量、新鲜度或消费状态。", "无法完整披露报告生成时的数据限制。", "由数据工程补齐 C017 固定摘要后重新核验。", "可信度事实：数据工程；核验：报告中心");
    if (ownerTrust.hardQualityFailure || ownerTrust.readiness !== "可消费") return outcome("fail", "TRUST_BLOCKING", "生成时数据存在硬质量失败或不可消费状态。", "当前内容不能进入人工确认或发布。", "等待新的可消费权威组合，不得自行切换版本。", "可信度事实：数据工程；权威组合：本体管理；核验：报告中心");
    if (trust.asOf !== ownerTrust.asOf || trust.qualityStatus !== ownerTrust.publishedQuality || trust.freshnessStatus !== ownerTrust.freshness || trust.consumptionReadiness !== ownerTrust.readiness) return outcome("fail", "TRUST_DISCLOSURE_CONFLICT", "报告披露与生成时数据工程可信度摘要不一致。", "可能隐藏陈旧、质量异常或不可消费状态。", "阻断确认并按生成时可信度快照重新生成。", "可信度事实：数据工程；披露与核验：报告中心");
    if (currentStatus.hardQualityFailure) {
      const historicalArtifact = ["published", "withdrawn"].includes(context.report.stage);
      if (historicalArtifact) return outcome("warn", "POST_PUBLICATION_HARD_QUALITY_FAILURE", `报告生成后数据工程登记硬质量失败：${currentStatus.laterQualityFinding || "后续质量异常"}。`, "原报告数值、证据包和发布依据 T049 均保持不变；该失败版本不得用于新报告生成。", "继续保留固定报告与原核验；按影响范围显式新建 C027，或选择其他获准组合生成新内容版本。", "后续质量事实：数据工程；警告与新核验：报告中心；权威回退：本体管理");
      return outcome("fail", "DRAFT_HARD_QUALITY_FAILURE", `当前草稿绑定版本已登记硬质量失败：${currentStatus.laterQualityFinding || "后续质量异常"}。`, "命中本报告绑定范围，当前内容版本不能人工确认或发布；生成时固定数值和证据仍保持原样。", "等待新的可消费权威组合并生成新内容版本；不得在当前草稿原地改值或改绑。", "后续质量事实：数据工程；影响范围与 T049：报告中心；权威回退：本体管理");
    }
    const qualityImpacted = ["FACT-GUARANTEE-UNKNOWN", "FACT-DATA-QUALITY-STATUS", "FACT-QUALITY-LIMITATION"].includes(unit.factId)
      && ["有提示", "陈旧", "上一可信版本继续服务"].includes(ownerTrust.publishedQuality);
    const freshnessImpacted = unit.factId === "FACT-DATA-FRESHNESS"
      && ["陈旧", "上一可信版本继续服务"].includes(ownerTrust.freshness);
    const readinessImpacted = unit.factId === "FACT-DATA-READINESS"
      && ownerTrust.freshness === "上一可信版本继续服务";
    if (qualityImpacted || freshnessImpacted || readinessImpacted) return outcome("warn", "TRUST_DISCLOSED_WARNING", "非阻断质量、新鲜度或上一可信版本提示已按生成时状态披露。", "限制相关结构解释，但不改变其他已绑定事实。", "保留警告、截至时间和限制脚注。", "可信度事实：数据工程；披露与核验：报告中心");
    return outcome("pass", "TRUST_DISCLOSED", "数据截至时间、质量、新鲜度、消费就绪和适用限制均与生成时摘要一致。", "未发现可信度披露影响。", "保留当前披露。", "可信度事实：数据工程；核验：报告中心");
  }

  function evaluateRuleConsistency(unit, context) {
    if (context.semanticMissing || !context.exactEvidenceAvailable) return outcome("unverifiable", "RULE_SOURCE_UNAVAILABLE", "生成时 Published Rule 或评估记录不可定位。", "Rule 结论、分支、阈值和命中证据无法确认。", "恢复原 Rule 与评估记录后重新核验；不得用当前 Rule 替代。", "Rule 与历史解析：本体管理；核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const contentFact = context.contentFacts.get(unit.factId);
    if (snapshotBindingGap(context.snapshot, unit.factId) || contentFact?.bindingStatus === "missing") return outcome("unverifiable", "RULE_BINDING_MISSING", "Rule 相关内容缺少完整条件或命中证据绑定。", "不能确认该结论或建议的适用边界。", "退回并生成新内容版本，补齐 Rule 条件引用。", "Agent 生成结果：Agent 应用；T049：报告中心");
    const rule = fact?.ruleSnapshot;
    const basis = fact?.basis || fact?.basisFactRefs || [];
    const requiredSuggestionRefs = ["RULE-FIN-R01", "RULE-FIN-R02", "RULE-FIN-R03", "AT-FIN-OPT-001"];
    const factEvidence = fact?.evidence || [];
    const contentEvidence = contentFact?.evidenceRefs || [];
    const semanticResources = context.evidencePack?.semanticResourceIds || [];
    const publishedActionType = (context.factPackage?.actionTypes || DATA.actionTypes).find((item) => item.id === "AT-FIN-OPT-001"
      && item.status === "Published"
      && item.definitionVersion
      && item.publishedSemanticVersion === context.binding.semanticVersion);
    const isSuggestionFact = String(fact?.kind || "").includes("建议");
    if (isSuggestionFact && (!publishedActionType || !requiredSuggestionRefs.every((ref) => factEvidence.includes(ref)
      && contentEvidence.includes(ref)
      && semanticResources.includes(ref)))) return outcome("unverifiable", "SUGGESTION_SOURCE_INCOMPLETE", "建议内容未同时绑定 R01、R02、R03 与当前 Published Action Type。", "不能确认建议适用主体、Rule 条件或受控行动类型。", "退回并在新内容版本中补齐四类稳定引用；不得根据文本推断。", "Published Rule 与 Action Type：本体管理；Agent 结构化结果：Agent 应用；核验：报告中心");
    if (unit.factId === "FACT-SUGGESTION-SCOPE") {
      const scopeMatches = contentFact
        && comparisonValueEqual(contentFact.value, fact.value)
        && contentFact.scope === fact.scope
        && contentFact.resultVersion === fact.resultVersion;
      return scopeMatches
        ? outcome("pass", "SUGGESTION_SCOPE_MATCH", "建议使用边界、适用范围及 R01、R02、R03 和 Action Type 引用一致。", "未发现建议范围越界。", "保留“仅用于复核参考”的固定限制。", "Rule 与 Action Type：本体管理；确定性核验：报告中心")
        : outcome("fail", "SUGGESTION_SCOPE_CONFLICT", "建议使用边界、适用范围或结果版本与固定事实不一致。", "建议可能被误读为已提交 Action Request 或已执行行动。", "退回并从固定建议边界重新生成，不在正文中手工扩展。", "结构化建议：Agent 应用；确定性核验：报告中心");
    }
    if (unit.factId === "FACT-SUGGESTION-BASIS") {
      const expectedBasis = Array.isArray(basis) ? basis : [];
      const actualBasis = Array.isArray(contentFact?.basis) ? contentFact.basis : [];
      const fields = ["scope", "ruleId", "ruleVersion", "evaluationRecordId", "resultVersion", "direction"];
      const expectedRuleIds = ["RULE-FIN-R01", "RULE-FIN-R02", "RULE-FIN-R03"];
      const basisComplete = expectedBasis.length === expectedRuleIds.length
        && actualBasis.length === expectedRuleIds.length
        && expectedRuleIds.every((ruleId) => {
          const expected = expectedBasis.find((item) => item.ruleId === ruleId);
          const actual = actualBasis.find((item) => item.ruleId === ruleId);
          const resultFact = context.facts.get(`FACT-${ruleId.slice(-3)}-RESULT`);
          return expected && actual
            && fields.every((field) => expected[field] && actual[field] === expected[field])
            && resultFact?.scope === expected.scope
            && resultFact?.ruleSnapshot?.ruleId === expected.ruleId
            && resultFact?.ruleSnapshot?.ruleVersion === expected.ruleVersion
            && resultFact?.ruleSnapshot?.evaluationRecordId === expected.evaluationRecordId
            && resultFact?.resultVersion === expected.resultVersion;
        });
    detailRows.sort((left, right) => Number(left.record?.finalScore || 0) - Number(right.record?.finalScore || 0));
      if (!basisComplete) return outcome("fail", "SUGGESTION_BASIS_CONFLICT", "建议依据中的主体、Rule、版本、评估记录、结果版本或建议方向与固定证据不一致。", "建议可能被错误地关联到业务主体或 Rule 命中结果。", "退回并从固定 Rule 评估记录重新生成结构化建议，不在正文中手工修正。", "Rule 与 Action Type：本体管理；结构化建议：Agent 应用；确定性核验：报告中心");
      return outcome("pass", "SUGGESTION_BASIS_MATCH", "R01、R02、R03 的主体、版本、评估记录、结果版本、建议方向及 Action Type 引用逐项一致。", "未发现建议依据错配。", "保留当前结构化建议绑定。", "Rule 与 Action Type：本体管理；确定性核验：报告中心");
    }
    const hasSuggestionBasis = Array.isArray(basis) && basis.length > 0 && factEvidence.some((ref) => String(ref).startsWith("RULE-"));
    if (!rule && !hasSuggestionBasis) return outcome("unverifiable", "RULE_FIELDS_MISSING", "适用的 Rule 检查缺少 Rule 标识、版本或评估快照。", "无法核对 Rule 结论或建议依据。", "补齐原 Rule 稳定标识与评估记录后重新核验。", "Rule：本体管理；核验：报告中心");
    if (rule && [rule.ruleId, rule.ruleVersion, rule.evaluationRecordId, rule.evaluationTime, rule.branch, rule.metricId, rule.result].some((value) => !value)) return outcome("unverifiable", "RULE_FIELDS_MISSING", "Rule 快照缺少标识、版本、评估记录、时间、分支、Metric 或结论。", "无法完整复核命中条件。", "补齐结构化 Rule 快照后重新生成。", "Rule：本体管理；结构化结果：Agent 应用；核验：报告中心");
    return outcome("pass", "RULE_MATCH", "Rule、版本、评估记录、结论、分支、阈值、时间、观测值和 Metric 引用一致。", "未发现 Rule 一致性影响。", "保留当前 Rule 证据。", "Rule：本体管理；核验：报告中心");
  }

  function comparableRenderedValue(value) {
    if (typeof value === "number") return value;
    const text = String(value ?? "").trim().replaceAll(",", "");
    const numeric = text.match(/^(-?\d+(?:\.\d+)?)\s*(%|亿元)?$/);
    return numeric ? Number(numeric[1]) : text;
  }

  function evaluateCrossContentConsistency(unit, context) {
    if (!context.exactEvidenceAvailable) return outcome("unverifiable", "OCCURRENCES_UNAVAILABLE", "生成时呈现清单或固定事实不可定位。", "无法覆盖摘要、正文、指标卡、表格、图表和固定呈现。", "恢复完整 renderManifest 后重新核验。", "内容清单与核验：报告中心");
    const fact = context.facts.get(unit.factId);
    const occurrences = context.manifestItems.filter((item) => (item.factRefs || []).includes(unit.factId));
    if (!fact || !occurrences.length) return outcome("unverifiable", "OCCURRENCES_MISSING", "该事实没有可核对的稳定呈现位置。", "无法确认跨内容重复值是否一致。", "补齐正文、HTML/PDF 锚点和呈现清单后重新生成。", "内容清单与核验：报告中心");
    const simpleOccurrences = occurrences.filter((item) => (item.factRefs || []).length === 1 && item.claimType !== "narrative" && item.presentationType !== "paragraph");
    const authoritative = context.authoritativeFacts.get(unit.factId);
    const conflict = simpleOccurrences.some((item) => item.displayUnit != null && item.displayUnit !== authoritative?.unit
      || item.displayValue != null && !comparisonValueEqual(comparableRenderedValue(item.displayValue), comparableRenderedValue(authoritative?.value)));
    if (conflict) return outcome("fail", "CROSS_CONTENT_CONFLICT", "同一固定事实在摘要、正文、卡片、表格、图表或固定呈现中存在值或单位冲突。", "读者可能看到相互矛盾的经营结论。", "退回并从同一结构化内容项重新形成全部呈现。", "内容清单与 T049：报告中心");
    return outcome("pass", "CROSS_CONTENT_MATCH", `${occurrences.length} 个登记呈现位置引用同一固定事实与版本。`, "未发现跨内容一致性影响。", "保留当前同源呈现。", "内容清单与 T049：报告中心");
  }

  function evaluateUnboundContent(unit, context) {
    const item = context.manifestById.get(unit.contentItemId);
    if (!item) return outcome("unverifiable", "CONTENT_ITEM_UNLOCATABLE", "渲染内容项未进入固定 renderManifest。", "T049 无法确认正文是否存在计划外业务判断。", "将内容项登记到清单并重新生成。", "内容清单与 T049：报告中心");
    if (!item.requiresEvidence) {
      const allowed = item.origin === "template" && item.bindingStatus === "not-required" && item.evidenceNotRequiredReason;
      return allowed
        ? outcome("pass", "TEMPLATE_ALLOWLIST", "模板静态结构已登记为不声明业务事实。", "无需证据绑定。", "保留模板豁免说明。", "模板与内容清单：报告中心")
        : outcome("fail", "INVALID_TEMPLATE_EXEMPTION", "内容项声明免证据但不符合模板白名单。", "业务判断可能绕过结构化证据。", "移除豁免或补齐 T044 与固定证据。", "模板与 T049：报告中心");
    }
    if (permissionBlocked(context)) return outcome("unverifiable", "CONTENT_PERMISSION_DENIED", "无权读取该内容项的固定证据绑定。", "无法判断是否存在无绑定内容。", "取得权限后重新核验。", "权限判定：平台公共权限；核验：报告中心");
    const t044 = context.t044ByContentId.get(item.contentItemId);
    const refs = item.factRefs || [];
    const factsValid = refs.length > 0 && refs.every((factId) => context.facts.has(factId));
    if (!item.rendered) return outcome("warn", "BOUND_ITEM_NOT_RENDERED", "已登记且有证据的内容项未进入当前正文呈现。", "可能存在孤立绑定或内容缺失。", "核对模板槽位并重新形成当前内容版本。", "内容选择与 T044：报告中心");
    if (item.bindingStatus === "missing" || !t044 || !factsValid || !(item.evidenceRefs || []).length) return outcome("unverifiable", "UNBOUND_CONTENT", "渲染出的业务内容缺少 T044、结构化事实或权威证据。", "该内容不能被自动核验，也不能进入正式报告。", "退回并生成新内容版本，补齐固定绑定。", "Agent 内容：Agent 应用；T044 与核验：报告中心");
    return outcome("pass", "CONTENT_BOUND", "非模板内容已登记并绑定 T044、结构化事实和权威证据。", "未发现无绑定内容。", "保留当前内容绑定。", "T044 与 T049：报告中心");
  }

  function evaluateVerificationUnit(unit, context) {
    const evaluators = {
      evidenceCompleteness: evaluateEvidenceCompleteness,
      valueConsistency: evaluateValueConsistency,
      semanticConsistency: evaluateSemanticConsistency,
      versionCompatibility: evaluateVersionCompatibility,
      trustDisclosure: evaluateTrustDisclosure,
      ruleConsistency: evaluateRuleConsistency,
      crossContentConsistency: evaluateCrossContentConsistency,
      unboundContentDetection: evaluateUnboundContent,
    };
    const evaluator = evaluators[unit.checkType];
    return evaluator
      ? evaluator(unit, context)
      : outcome("unverifiable", "CHECK_TYPE_UNKNOWN", `核验计划包含未登记检查类型 ${unit.checkType}。`, "该检查单元不能形成确定性结论。", "修正核验规则版本后重新运行。", "T049：报告中心");
  }

  function verificationUnitResults(report, scopeContext, planSnapshot = null, currentStatusSummary = null) {
    const context = verificationContext(report, currentStatusSummary);
    return verificationPlanForScope(report, scopeContext, planSnapshot).map((unit) => {
      const fact = context.facts.get(unit.factId);
      const evaluated = evaluateVerificationUnit(unit, context);
      return {
        ...clone(unit),
        ...evaluated,
        applicability: "applicable",
        executionState: "completed",
        completedAt: nowText(),
        semanticVersion: context.binding.semanticVersion,
        dataVersion: context.binding.dataVersion,
        resultVersion: fact?.resultVersion || DATA.reportEvidence.schemaVersion,
      };
    });
  }

  function verificationResults(scopeContext = activeVerification(readingReport()).scopeContext, unitResults = null, verifiedReport = readingReport()) {
    const binding = bindingFor(verifiedReport);
    const contract = contentContract(verifiedReport);
    const scopedPlan = Array.isArray(unitResults) && unitResults.length ? unitResults : verificationPlanForScope(verifiedReport, scopeContext);
    const groups = new Map();
    scopedPlan.filter((item) => item.executionState === "completed").forEach((item) => {
      const key = item.checkType === "unboundContentDetection" ? `CONTENT:${item.contentItemId}` : `FACT:${item.factId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const priority = { fail: 4, unverifiable: 3, warn: 2, pass: 1 };
    return [...groups.entries()].map(([key, planUnits]) => {
      const factId = key.startsWith("FACT:") ? key.slice(5) : planUnits[0].factId;
      const contentItemId = key.startsWith("CONTENT:") ? key.slice(8) : null;
      const fact = contract.factInventory.find((item) => item.id === factId);
      const manifestItem = contentItemId ? contract.renderManifest?.items?.find((item) => item.contentItemId === contentItemId) : null;
      const anchor = contentItemId
        ? contract.t044Bindings.find((item) => item.contentItemId === contentItemId)
        : contract.t044Bindings.find((item) => item.factRefs?.includes(factId) || item.intendedFactRefs?.includes(factId));
      const worst = [...planUnits].sort((left, right) => (priority[right.status] || 0) - (priority[left.status] || 0))[0];
      const evidenceRefs = fact?.evidence || manifestItem?.evidenceRefs || anchor?.evidenceRefs || [];
      return {
        id: `T049-${contentItemId || factId}`,
        name: contentItemId ? manifestItem?.displayValue || manifestItem?.claimType || contentItemId : fact?.label || factId,
        status: worst.status,
        reasonCode: worst.reasonCode,
        factId,
        contentItemId,
        anchor: manifestItem?.anchorId || anchor?.anchorId || fact?.primaryAnchorId,
        t044Ids: planUnits.flatMap((item) => item.t044Ids || []),
        checkUnitIds: planUnits.map((item) => item.id),
        checkTypes: planUnits.map((item) => item.checkType),
        checkNames: planUnits.map((item) => item.checkName),
        location: manifestItem?.location || fact?.location || anchor?.location || "报告正文",
        issue: worst.issue,
        evidence: evidenceRefs.join("、") || "不可定位",
        version: `${binding.semanticVersion} / ${binding.dataVersion} / ${fact?.resultVersion || DATA.reportEvidence.schemaVersion}`,
        impact: worst.impact,
        responsibility: worst.responsibility,
        recommendation: worst.recommendation,
      };
    });
  }

  function statusLabel(status) {
    return { pass: "通过", warn: "警告", fail: "失败", unverifiable: "无法核验" }[status] || status;
  }

  function statusIcon(status) {
    const name = status === "pass" ? "check" : status === "warn" ? "triangle-alert" : status === "fail" ? "x" : "help-circle";
    return `<span class="status-icon ${status}">${icon(name, "sm")}</span>`;
  }

  function assistantQA() {
    const a = state.assistant;
    const report = readingReport();
    const binding = bindingFor(report);
    const requestRef = a.requestRef;
    const external = requestRef ? OWNERS.agent.getQA(requestRef.runId || requestRef.requestId) : null;
    const ownerQuestion = external?.payload?.question || null;
    const messages = external?.status === "已完成" ? `<div class="message user"><p>${esc(ownerQuestion || "问题正文由 Agent 应用维护")}</p></div><div class="message assistant"><p>${esc(external.answer)}</p><div class="message-meta"><span>报告快照 · ${esc(binding.asOf)}</span><button class="citation-link" type="button" data-action="jump-anchor" data-anchor="${external.anchor}">定位证据</button><button class="citation-link" type="button" data-action="open-anchor-evidence" data-anchor="${external.anchor}">打开证据</button></div></div>` : requestRef ? `<div class="notice warning">${icon("refresh-cw")}<div><strong>正在从 Agent 应用读取问题与答案</strong><span>报告中心仅保留请求、Run、Result 和上下文标识，不保存消息正文。</span></div></div>` : "";
    return `
      <div class="assistant-content">
        <div class="context-box"><span>当前上下文</span><strong>${esc(a.selectedAnchor)} · 证据包 ${esc(report.evidencePackId)}</strong><small>普通问答仅含报告固定内容、锚点、证据包和生成时 C017 版本绑定摘要；不自动加入后续 T049/C027，不包含工作簿、T002、T007 成员明细或当前业务数据查询权。</small></div>
        ${!requestRef ? `<div class="suggestion-list"><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="集团融资成本为什么下降？">集团融资成本为什么下降？</button><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="单位553为什么命中 R01？">单位553为什么命中 R01？</button><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="报告中的数据和当前数据相比有什么变化？">与当前数据相比有什么变化？</button></div>` : ""}
        ${messages}
        ${requestRef && external?.status !== "已完成" ? `<button class="btn full" type="button" data-action="reread-agent-result">${icon("refresh-cw", "sm")}重新读取 Agent 返回</button>` : ""}
        ${external?.status === "已完成" ? `<div class="notice">${icon("bot")}<div><strong>Agent 应用只读返回</strong><span>Session ${esc(external.sessionId)} · Run ${esc(external.runId)} · Result ${esc(external.resultId)} · 回读 ${esc(external.readAt)}</span></div><button class="text-link" type="button" data-action="open-external-agent" data-id="${esc(external.runId)}" data-return="${esc(routeInfo().path)}" data-position="${esc(external.anchor || a.selectedAnchor)}">查看 Agent 记录</button></div>` : ""}
      </div>
      <div class="assistant-compose">
        <div class="compose-row"><input class="input" type="text" value="${esc(a.qaDraft)}" data-input="qa-draft" placeholder="询问当前报告或所选内容"><button class="btn primary icon-only" type="button" data-action="ask-report" title="发送">${icon("send", "sm")}</button></div>
        <div class="inline-actions"><button class="text-link" type="button" data-action="start-current-comparison">与当前数据比较</button><button class="text-link" type="button" data-action="open-trace">查看追溯</button></div>
      </div>
    `;
  }

  function currentComparisonBlock() {
    const report = readingReport();
    const comparison = report.comparison;
    const binding = bindingFor(report);
    if (comparison.status === "idle") return "";
    if (comparison.status === "running") return `<div class="notice">${icon("loader-circle")}<div><strong>正在重新读取当前权威上下文</strong><span>本次显式比较正在读取当前 C008/T019 与 C017 当前状态摘要；报告快照保持不变，候选、刷新失败和未采用版本不会参与数值比较。</span></div></div>`;
    const current = comparison.currentBinding;
    const trust = comparison.currentTrust;
    const candidate = comparison.candidateSnapshot;
    const dataPrevious = comparison.dataPreviousSnapshot;
    const previousAuthoritative = comparison.previousAuthoritativeSnapshot;
    const explanationKey = comparison.explanationRequestId || comparison.explanationRunId;
    const explanation = explanationKey ? OWNERS.agent.getQA(explanationKey) : null;
    const history = report.comparisonRecords.map((item) => `<div class="detail-row"><span>${esc(item.recordId)}</span><div><strong>${esc(item.comparedAt)} · ${esc(item.currentBinding?.dataVersion)} · ${esc(item.comparisonOutcome || item.gate)}</strong><small>${esc(item.recordStatus || "当前")}${item.staleDetectedAt ? ` · 发现于 ${esc(item.staleDetectedAt)}` : ""}${item.staleReason ? ` · ${esc(item.staleReason)}` : ""}</small></div><button class="text-link" type="button" data-action="open-comparison-record" data-id="${esc(item.recordId)}">查看详情</button></div>`).join("");
    const reportTrustState = comparison.reportTrust ? "生成时已固定" : "摘要不可定位";
    const currentTrustState = trust ? `${esc(trust.publishedQuality)} · ${esc(trust.readiness)}` : "未取得";
    const identities = `
      <div class="snapshot-comparison" role="group" aria-label="报告快照与当前消费组合">
        <div class="snapshot-comparison-corner">对照项</div>
        <div class="snapshot-comparison-head report"><strong>报告快照</strong><small>生成时固定</small></div>
        <div class="snapshot-comparison-head current"><strong>当前消费组合</strong><small>${esc(trust?.readiness || "未取得")}</small></div>
        <div class="snapshot-row-label">本体版本</div>
        <div class="snapshot-value">${esc(binding.semanticVersion || "未取得")}</div>
        <div class="snapshot-value">${esc(current?.semanticVersion || "未取得")}</div>
        <div class="snapshot-row-label">数据版本</div>
        <div class="snapshot-value">${esc(binding.dataVersion || "未取得")}</div>
        <div class="snapshot-value">${esc(current?.dataVersion || "未取得")}</div>
        <div class="snapshot-row-label">数据截至</div>
        <div class="snapshot-value">${esc(binding.asOf || "未取得")}</div>
        <div class="snapshot-value">${esc(current?.asOf || "未取得")}</div>
        <div class="snapshot-row-label">使用状态</div>
        <div class="snapshot-value snapshot-state">${reportTrustState}</div>
        <div class="snapshot-value snapshot-state">${currentTrustState}</div>
      </div>
      <details class="comparison-disclosure">
        <summary>${icon("git-branch", "sm")}<span><strong>查看版本与追溯</strong><small>绑定、摘要、事实包及非当前版本</small></span>${icon("chevron-down", "sm")}</summary>
        <div class="comparison-trace-grid">
          <section class="trace-group"><h4>报告快照追溯</h4><div class="compact-trace">
            <div><span>固定组合</span><strong>${esc(binding.bindingId || "未取得")}</strong></div>
            <div><span>C017 版本绑定摘要</span><strong>${esc(comparison.reportTrust?.id || "不可定位")} / ${esc(comparison.reportTrust?.version || "未取得")} · ${esc(comparison.reportTrust?.formedAt || "未取得")}</strong></div>
            <div><span>事实包</span><strong>${esc(comparison.reportFactPackage?.packageId || "不可定位")}</strong></div>
          </div></section>
          <section class="trace-group"><h4>当前组合追溯</h4><div class="compact-trace">
            <div><span>C008 / T019 当前绑定</span><strong>${esc(current?.bindingId || "未取得")}</strong></div>
            <div><span>C017 当前摘要</span><strong>${trust ? `${esc(trust.id)} / ${esc(trust.version)} · ${esc(trust.formedAt)}` : "未取得"}</strong></div>
            <div><span>质量 / 消费</span><strong>${currentTrustState}</strong></div>
          </div></section>
          <section class="trace-group trace-boundary"><h4>候选与上一版本证据</h4><div class="compact-trace">
            <div><span>候选版本</span><strong>${esc(candidate?.id || "未取得")} · ${esc(candidate?.dataVersion || "未取得")} · ${esc(candidate?.readiness || "未取得")} · 未被 T019 采用</strong></div>
            <div><span>数据侧上一已通过版本</span><strong>${esc(dataPrevious?.id || "未取得")} · ${esc(dataPrevious?.dataVersion || "未取得")}</strong></div>
            <div><span>本体上一权威服务组合</span><strong>${esc(previousAuthoritative?.bindingId || "未取得")} · ${esc(previousAuthoritative?.semanticVersion || "未取得")} / ${esc(previousAuthoritative?.dataVersion || "未取得")}</strong></div>
            <div><span>使用边界</span><strong>以上版本只读披露，不参与正式数值比较，报告中心不得自行切换</strong></div>
          </div></section>
        </div>
      </details>`;
    const header = `<div class="context-box"><span>比较记录 ${esc(comparison.recordId)}</span><strong>报告快照与当前消费组合 · ${esc(comparison.recordStatus || "当前")}</strong>${comparison.recordStatus === "已陈旧" ? `<small>${esc(comparison.staleReason)} 发现于 ${esc(comparison.staleDetectedAt)}；再次比较将形成新记录。</small>` : ""}</div><div class="comparison-overview"><div class="comparison-outcome"><span>确定性结论</span><strong>${esc(comparison.comparisonOutcome || comparison.gate || "读取中")}</strong><small>${esc(comparison.comparisonOutcomeReason || comparison.limitation || "")}</small></div><div class="comparison-overview-meta"><div><span>读取 / 比较</span><strong>${esc(comparison.currentStatusReadAt || "未取得")} · ${esc(comparison.comparedAt || "处理中")}</strong></div><div><span>权限 / 兼容</span><strong>${esc(comparison.permission || "读取中")} · ${esc(comparison.compatibility || "未验证")}</strong></div></div></div>${identities}`;
    const blocked = comparison.comparisonOutcome === "无法比较" || comparison.gate === "无法比较";
    const body = blocked
      ? `<div class="notice danger">${icon("shield-x")}<div><strong>无法比较，报告固定结果仍可阅读</strong><span>${esc(comparison.comparisonOutcomeReason || comparison.limitation || trust?.recoveryAdvice || "当前精确事实包不可定位。")} 报告快照保持冻结，不显示当前数值或一致结论。</span></div></div>`
      : `<div class="compare-grid"><div class="compare-card"><span>报告快照 · ${esc(binding.dataVersion)}</span><strong>${comparison.counts.same} 项无变化</strong><small>${comparison.counts.changed} 项变化 · ${comparison.counts.unverifiable} 项无法比较</small></div><div class="compare-card"><span>当前权威 · ${esc(current.dataVersion)}</span><strong>${esc(comparison.currentFactPackage.packageId)}</strong><small>逐事实、逐版本确定性比较</small></div></div><div class="verification-list">${comparison.results.slice(0, 12).map((item) => `<div class="verification-item">${statusIcon(item.status === "same" ? "pass" : item.status === "changed" ? "warn" : "unverifiable")}<div><h4>${esc(item.label)}：${item.status === "same" ? "无变化" : item.status === "changed" ? "发生变化" : "无法比较"}</h4><p>报告 ${esc(item.reportValue)} · 当前 ${esc(item.currentValue)}${item.limitation ? ` · ${esc(item.limitation)}` : ""}</p><p>报告结果版本 ${esc(item.reportResultVersion || "未提供")} · 当前结果版本 ${esc(item.currentResultVersion || "未提供")}</p></div>${item.anchor ? `<button class="text-link" type="button" data-action="open-anchor-evidence" data-anchor="${esc(item.anchor)}">证据</button>` : ""}</div>`).join("")}</div>${comparison.results.length > 12 ? `<div class="notice">${icon("list-checks")}<div><strong>已固定全部 ${comparison.results.length} 项比较结果</strong><span>当前视图优先显示前 12 项；完整记录保留每项事实和结果版本。</span></div></div>` : ""}`;
    const explanationBlock = !explanationKey ? "" : explanation?.status === "已完成"
      ? `<div class="notice success">${icon("bot")}<div><strong>Agent 应用只读返回比较解释</strong><span>${esc(explanation.answer)} · Result ${esc(explanation.resultId)} · 回读 ${esc(explanation.readAt)}</span></div><button class="text-link" type="button" data-action="open-external-agent" data-id="${esc(explanation.runId)}" data-return="${esc(routeInfo().path)}" data-position="${esc(state.assistant.selectedAnchor)}">查看 Agent 记录</button></div>`
      : `<div class="notice warning">${icon("refresh-cw")}<div><strong>比较解释结果尚未回读</strong><span>报告中心只保留外部请求、Run 与 Result 标识；确定性比较结果不会被修改。</span></div><button class="text-link" type="button" data-action="reread-comparison-explanation">重新读取</button></div>`;
    const candidateNotice = candidate?.id
      ? `${esc(candidate.dataVersion || "未取得数据版本")} 尚不可消费且未被 T019 采用；`
      : "本次未取得候选快照；";
    return `${header}${comparison.comparisonOutcome && !blocked ? `<div class="notice ${comparison.comparisonOutcome === "可以比较" ? "success" : "warning"}">${icon(comparison.comparisonOutcome === "可以比较" ? "circle-check" : "shield-alert")}<div><strong>${esc(comparison.comparisonOutcome)}</strong><span>${esc(comparison.comparisonOutcomeReason)}</span></div></div>` : ""}${body}${explanationBlock}<div class="notice warning">${icon("layers")}<div><strong>非当前权威版本不参与比较</strong><span>${candidateNotice}刷新失败、处理中候选和其他未采用版本均只读披露，报告正文和既有比较记录保持不变。</span></div></div>${report.comparisonRecords.length ? `<h4>比较历史</h4><div class="detail-list">${history}</div>` : ""}`;
  }

  function assistantVerification() {
    const report = readingReport();
    const binding = bindingFor(report);
    const formalReport = ["published", "withdrawn"].includes(report.stage);
    const v = activeVerification(report);
    const results = v.results.length ? v.results : verificationResults(freezeVerificationScope(report));
    const total = v.coverage.planned || verificationPlanForScope(report, freezeVerificationScope(report)).length;
    const filtered = v.filter === "issues" ? results.filter((item) => item.status !== "pass") : results;
    if (report.comparison.status !== "idle") {
      const comparison = report.comparison;
      const canExplain = comparison.status === "completed" && comparison.comparisonOutcome !== "无法比较" && comparison.gate !== "无法比较";
      return `<div class="assistant-content">${currentComparisonBlock()}</div><div class="assistant-compose"><div class="button-row"><button class="btn" type="button" data-action="close-comparison">返回自动核验</button>${canExplain ? `<button class="btn" type="button" data-action="${comparison.explanationRequestId ? "reread-comparison-explanation" : "start-comparison-explanation"}">${icon(comparison.explanationRequestId ? "refresh-cw" : "sparkles", "sm")}${comparison.explanationRequestId ? "重新读取解释" : "解释比较差异"}</button>` : ""}<button class="btn primary" type="button" data-action="create-comparison-issue">${icon("message-square-warning", "sm")}创建复核问题</button></div></div>`;
    }
    if (v.status === "idle") {
      const contract = contentContract(report);
      return `<div class="assistant-content"><div class="context-box"><span>核验范围</span><strong>${v.scope}</strong><small>开始核验后固定当次 C017 当前状态摘要；后续权威状态变化不改写本次运行。</small></div><div class="segmented"><button type="button" class="${v.scope === "整份报告" ? "active" : ""}" data-action="set-verification-scope" data-scope="整份报告">整份</button><button type="button" class="${v.scope === "当前章节" ? "active" : ""}" data-action="set-verification-scope" data-scope="当前章节">章节</button><button type="button" class="${v.scope === "当前锚点" ? "active" : ""}" data-action="set-verification-scope" data-scope="当前锚点">锚点</button></div><div class="notice">${icon("shield-check")}<div><strong>确定性核验</strong><span>先比对结构化证据并形成四态；无需等待 LLM。</span></div></div><div class="detail-list"><div class="detail-row"><span>结构化事实</span><strong>${contract.factInventory.length} 项</strong></div><div class="detail-row"><span>稳定锚点</span><strong>${contract.t044Bindings.filter((item) => item.anchorId).length} 项</strong></div><div class="detail-row"><span>适用检查单元</span><strong>${verificationPlanForScope(report, freezeVerificationScope(report)).length} 项 · 8 类规则</strong></div><div class="detail-row"><span>固定版本</span><strong>${esc(binding.semanticVersion)} / ${esc(binding.dataVersion)}</strong></div></div></div><div class="assistant-compose"><button class="btn primary full" type="button" data-action="start-verification">${icon("shield-check", "sm")}开始核验</button></div>`;
    }
    if (["queued", "running"].includes(v.status)) {
      return `<div class="assistant-content"><div class="context-box"><span>核验运行 ${esc(v.runId)}</span><strong>${v.scope} · ${v.status === "queued" ? "排队中" : "运行中"}</strong></div><div class="progress-track"><span style="width:${v.progress}%"></span></div><div class="verification-summary"><div><span>计划 / 适用</span><strong>${v.coverage.planned} / ${v.coverage.applicable}</strong></div><div><span>已完成</span><strong>${v.coverage.completed}</strong></div><div><span>待处理 / 异常</span><strong>${v.coverage.pending} / ${v.coverage.error}</strong></div><div><span>不适用 / 跳过</span><strong>${v.coverage.notApplicable} / ${v.coverage.skipped}</strong></div></div><div class="notice">${icon("info")}<div><strong>核验尚未完整</strong><span>当前不会显示整份报告通过，也不会提前允许确认。</span></div></div></div><div class="assistant-compose"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">离开后返回</button></div>`;
    }
    if (v.status === "run_failed") {
      return `<div class="assistant-content"><div class="context-box"><span>核验运行 ${esc(v.runId)}</span><strong>${v.scope} · 执行失败</strong></div><div class="verification-summary"><div><span>计划 / 适用</span><strong>${v.coverage.planned} / ${v.coverage.applicable}</strong></div><div><span>已完成</span><strong>${v.coverage.completed}</strong></div><div><span>待处理 / 异常</span><strong>${v.coverage.pending} / ${v.coverage.error}</strong></div><div><span>不适用 / 跳过</span><strong>${v.coverage.notApplicable} / ${v.coverage.skipped}</strong></div></div><div class="notice danger">${icon("circle-x")}<div><strong>核验任务中断</strong><span>证据包读取超时。当前不是“无法核验”业务结论，也不会生成四态汇总；可用同一范围发起新的核验运行。</span></div></div></div><div class="assistant-compose"><button class="btn primary full" type="button" data-action="start-verification">${icon("refresh-cw", "sm")}重试核验</button></div>`;
    }
    const counts = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    const openIssues = report.issues.filter(isOpenIssue);
    const explanationKey = v.explanationRequestId || v.explanationRunId;
    const explanation = explanationKey ? OWNERS.agent.getExplanation(explanationKey) : null;
    const explanationBlock = !explanationKey ? "" : explanation?.status === "已完成" ? `<div class="notice success">${icon("bot")}<div><strong>Agent 应用只读返回差异解释</strong><span>${esc(explanation.text)} · Result ${esc(explanation.resultId)} · 回读 ${esc(explanation.readAt)}</span></div><button class="text-link" type="button" data-action="open-external-agent" data-id="${esc(explanation.runId)}" data-return="${esc(routeInfo().path)}" data-position="${esc(state.assistant.selectedAnchor)}">查看 Agent 记录</button></div>` : `<div class="notice warning">${icon("refresh-cw")}<div><strong>差异解释结果尚未回读</strong><span>报告中心仅保存外部标识，不复制解释正文或运行状态。</span></div><button class="text-link" type="button" data-action="reread-explanation">重新读取</button></div>`;
    const runScope = frozenVerificationScope(v);
    const partialScope = !isFullVerificationCoverage(report, v);
    const coverageCopy = `${v.coverage.completed} / ${v.coverage.applicable} 检查单元 · ${v.coverage.factCovered} / ${v.coverage.factTotal} 事实 · ${v.coverage.anchorCovered} / ${v.coverage.anchorTotal} 锚点 · C017 ${v.currentStatusSummary?.id || "未取得"}`;
    return `<div class="assistant-content"><div class="context-box"><span>核验运行 ${esc(v.runId)}</span><strong>${esc(runScope)} · ${partialScope ? "局部或未完整" : "整份覆盖完整"} · ${coverageCopy}</strong></div><div class="verification-summary"><div><span>通过</span><strong>${counts.pass || 0}</strong></div><div><span>警告</span><strong>${counts.warn || 0}</strong></div><div><span>失败</span><strong>${counts.fail || 0}</strong></div><div><span>无法核验</span><strong>${counts.unverifiable || 0}</strong></div></div><div class="verification-summary"><div><span>计划 / 适用</span><strong>${v.coverage.planned} / ${v.coverage.applicable}</strong></div><div><span>完成 / 待处理</span><strong>${v.coverage.completed} / ${v.coverage.pending}</strong></div><div><span>执行异常</span><strong>${v.coverage.error}</strong></div><div><span>不适用 / 跳过</span><strong>${v.coverage.notApplicable} / ${v.coverage.skipped}</strong></div></div>${partialScope ? `<div class="notice warning">${icon("shield-alert")}<div><strong>当前运行不能解锁人工确认</strong><span>只有整份报告的 ${v.coverage.planned} 个计划检查单元、${v.coverage.factTotal} 项事实和 ${v.coverage.anchorTotal} 个锚点覆盖完整，且无待处理、异常或跳过，才可进入人工确认。</span></div></div>` : ""}<div class="segmented"><button type="button" class="${v.filter === "all" ? "active" : ""}" data-action="set-verification-filter" data-filter="all">全部</button><button type="button" class="${v.filter === "issues" ? "active" : ""}" data-action="set-verification-filter" data-filter="issues">仅看问题</button></div><div class="verification-list">${filtered.map((item) => `<div class="verification-item">${statusIcon(item.status)}<div><h4>${item.name}</h4><p>${item.location} · ${item.issue}</p><p><strong>证据：</strong>${item.evidence}<br><strong>版本：</strong>${item.version}<br><strong>影响：</strong>${item.impact}<br><strong>责任：</strong>${item.responsibility}<br><strong>建议：</strong>${item.recommendation}</p></div>${item.anchor ? `<button class="text-link" type="button" data-action="jump-anchor" data-anchor="${item.anchor}">定位</button>` : ""}</div>`).join("")}</div>${openIssues.length && !(counts.fail || counts.unverifiable) ? `<div class="notice warning">${icon("clipboard-check")}<div><strong>${openIssues.length} 项旧版问题待人工核对</strong><span>自动核验通过不会自动关闭复核问题；需核对当前内容版本后记录关闭依据。</span></div></div>` : ""}${explanationBlock}</div><div class="assistant-compose"><div class="button-row">${partialScope ? `<button class="btn primary" type="button" data-action="prepare-full-verification">${icon("shield-check", "sm")}改为整份核验</button>` : `<button class="btn" type="button" data-action="${explanationKey && !explanation ? "reread-explanation" : explanationKey ? "reread-explanation" : "start-explanation"}">${icon(explanationKey ? "refresh-cw" : "sparkles", "sm")}${explanationKey ? "重新读取解释" : "解释差异"}</button>`}${!partialScope ? (counts.fail || counts.unverifiable) ? `<button class="btn primary" type="button" data-action="create-verification-issues">${icon("message-square-warning", "sm")}创建复核问题</button>` : openIssues.length ? `<button class="btn primary" type="button" data-action="close-resolved-issues">${icon("clipboard-check", "sm")}核对并关闭问题</button>` : formalReport ? `<button class="btn primary" type="button" data-action="request-regeneration">${icon("refresh-cw", "sm")}生成新内容版本</button>` : `<button class="btn primary" type="button" data-action="confirm-draft">${icon("circle-check", "sm")}确认草稿</button>` : ""}</div><button class="text-link" type="button" data-action="start-current-comparison">与当前数据比较</button></div>`;
  }

  function assistantPane() {
    return `<aside class="assistant-pane"><div class="pane-heading"><strong>报告助手</strong><small>以当前报告版本绑定的证据包为根</small></div><div class="assistant-tabs"><button class="${state.assistant.tab === "qa" ? "active" : ""}" type="button" data-action="set-assistant-tab" data-tab="qa">报告问答</button><button class="${state.assistant.tab === "verification" ? "active" : ""}" type="button" data-action="set-assistant-tab" data-tab="verification">自动核验</button></div>${state.assistant.tab === "qa" ? assistantQA() : assistantVerification()}</aside>`;
  }

  function canConfirmDraft() {
    const v = state.report.verification;
    if (hardFailureForReport(state.report)) return false;
    if (v.status !== "completed" || !v.results.length) return false;
    if (!isFullVerificationCoverage(state.report, v)) return false;
    if (v.results.some((item) => item.status === "fail" || item.status === "unverifiable")) return false;
    return !state.report.issues.some(isOpenIssue);
  }

  function readerToolbar(isPublished) {
    const report = readingReport();
    const status = isPublished ? report.stage === "withdrawn" ? "已撤回" : "已发布" : report.stage === "confirmed" || report.stage === "publish_failed" ? "已确认待发布" : report.stage === "returned" ? "已退回" : "草稿待复核";
    let actions = "";
    if (isPublished) {
      const moreMenu = `<div class="reader-more"><button class="btn" type="button" data-action="toggle-reader-more" aria-haspopup="menu" aria-expanded="${state.ui.readerMoreOpen ? "true" : "false"}">${icon("ellipsis", "sm")}更多${icon("chevron-down", "sm")}</button>${state.ui.readerMoreOpen ? `<div class="reader-more-menu" role="menu" aria-label="报告浏览操作"><button type="button" role="menuitem" data-action="open-trust">${icon("shield-check", "sm")}<span><strong>查看数据状态</strong><small>查看报告快照与当前权威组合</small></span></button><button type="button" role="menuitem" data-action="start-current-comparison">${icon("git-compare-arrows", "sm")}<span><strong>与当前数据比较</strong><small>形成独立、可追溯的比较记录</small></span></button><button type="button" role="menuitem" data-action="open-export">${icon("download", "sm")}<span><strong>导出</strong><small>导出固定 HTML 或 PDF</small></span></button><button type="button" role="menuitem" data-action="open-pdf">${icon("file-text", "sm")}<span><strong>PDF 固定版</strong><small>打开同源固定呈现</small></span></button><button type="button" role="menuitem" data-action="open-trace">${icon("git-branch", "sm")}<span><strong>查看追溯</strong><small>查看版本、核验和证据链</small></span></button></div>` : ""}</div>`;
      actions = `<button class="btn primary" type="button" data-action="request-regeneration">${icon("refresh-cw", "sm")}生成新内容版本</button>${moreMenu}${report.stage === "published" ? `<div class="reader-danger-zone"><button class="btn danger" type="button" data-action="open-withdraw">${icon("archive-x", "sm")}撤回</button></div>` : ""}`;
    } else if (report.stage === "confirmed") {
      actions = `<button class="btn" type="button" data-action="cancel-confirmation">取消确认</button><button class="btn primary" type="button" data-action="open-publish">${icon("upload", "sm")}发布报告</button>`;
    } else if (report.stage === "returned") {
      actions = `<button class="btn primary" type="button" data-action="regenerate-report">${icon("refresh-cw", "sm")}重新生成</button>`;
    } else if (report.stage === "publish_failed") {
      actions = `<button class="btn" type="button" data-action="navigate" data-route="/reports/generate">查看失败原因</button><button class="btn primary" type="button" data-action="retry-publish">${icon("refresh-cw", "sm")}重试发布</button>`;
    } else {
      actions = `<button class="btn" type="button" data-action="open-return">${icon("undo-2", "sm")}退回修订</button><button class="btn primary" type="button" data-action="confirm-draft">${icon("circle-check", "sm")}确认草稿</button>`;
    }
    return `<header class="reader-toolbar"><div class="reader-title"><button class="icon-button" type="button" data-action="navigate" data-route="${isPublished ? "/reports?tab=products" : "/reports/generate"}" title="返回">${icon("arrow-left")}</button><div><strong>集团融资成本与债务结构分析报告</strong><small class="record-reference">报告编号 ${isPublished ? report.reportNo : report.draftId} · 内容版本 ${report.contentVersion || report.draftVersion}</small></div>${badge(status)}</div><div class="header-actions">${actions}</div></header>`;
  }

  function reportTrustWarningBanner(report = readingReport()) {
    const warning = hardFailureForReport(report);
    if (!warning) return "";
    const formalReport = ["published", "withdrawn"].includes(report.stage);
    const title = formalReport ? "报告生成后发现数据质量异常" : "草稿绑定版本发现数据质量异常";
    const impact = formalReport
      ? "本报告固定内容、数值及发布依据核验均未修改；新报告生成已被阻断，当前比较是否可行由新建 C027 记录独立判断。"
      : "草稿、固定数值和既有核验结果均保留，但当前内容版本不能确认或发布；请重新核验并基于获准权威组合生成新内容版本。";
    const action = formalReport
      ? `<button class="text-link" type="button" data-action="open-trust">查看数据状态</button>`
      : `<div class="button-row"><button class="text-link" type="button" data-action="open-trust">查看数据状态</button><button class="text-link" type="button" data-action="regenerate-report">生成新内容版本</button></div>`;
    return `<div class="reader-warning"><div class="notice danger">${icon("shield-alert")}<div><strong>${title}</strong><span>${esc(warning.finding)}；${esc(warning.impactScope)}。${impact}</span><small>C017 后续质量事实 ${esc(warning.summaryId)} · 质量事实时间 ${esc(warning.failureFactAt || "未提供")} · 摘要形成 ${esc(warning.summaryFormedAt || "未提供")} · 报告中心首次读取 ${esc(warning.readAt || warning.detectedAt || "未提供")}</small><small>独立确认时间：${esc(warning.confirmationAt || "数据工程未提供")}</small></div>${action}</div></div>`;
  }

  function renderReader(isPublished) {
    if (!readingReport().draftId) return renderGenerate();
    const report = readingReport();
    const warning = reportTrustWarningBanner(report);
    return renderShell(`<div class="reader-shell ${warning ? "has-reader-warning" : ""}" data-screen-label="${isPublished ? "正式报告阅读页" : "草稿复核页"}">${readerToolbar(isPublished)}${warning}<div class="reader-grid">${tocPane()}<section class="report-viewport" id="report-viewport">${reportPaper()}</section>${assistantPane()}</div></div>`, { crumb: isPublished ? "正式报告阅读" : "草稿复核", mainClass: "reader-main" });
  }

  function renderPdf() {
    const report = readingReport();
    if (!["published", "withdrawn"].includes(report.stage)) return renderReports();
    return renderShell(`<div class="reader-shell" data-screen-label="PDF 固定版"><header class="reader-toolbar"><div class="reader-title"><button class="icon-button" type="button" data-action="navigate" data-route="/reports/view" title="返回">${icon("arrow-left")}</button><div><strong>PDF 固定版</strong><small>${report.reportNo} · 内容版本 ${report.contentVersion}</small></div>${badge(report.stage === "withdrawn" ? "已撤回" : "已发布", report.stage === "withdrawn" ? "warning" : "success")}</div><div class="header-actions"><button class="btn" type="button" data-action="print-report">${icon("printer", "sm")}打印或保存 PDF</button></div></header><div class="reader-grid" style="grid-template-columns:minmax(0,1fr)"><section class="report-viewport">${reportPaper()}</section></div></div>`, { crumb: "PDF 固定版", mainClass: "reader-main" });
  }

  function decisionTargetKey(type) {
    return ({ "action-request": "Action Request", reminder: "提醒", task: "待办", trace: "全链路追溯" })[type] || "Action Request";
  }

  function externalRecord(type, id, decisionTargetType = "Action Request") {
    const query = routeInfo().query;
    const isDecision = type === "decision";
    const decisionDetail = isDecision ? OWNERS.decision.getTargetDetail(decisionTargetType, id) : null;
    const requestData = decisionDetail?.payload || {};
    const summary = isDecision ? OWNERS.decision.rereadTargetSummary(decisionTargetType, id) : null;
    const agentRecord = type === "agent" ? OWNERS.agent.getAny(id) : null;
    const title = isDecision ? `${decisionTargetType}详情` : type === "agent" ? "Agent 运行记录" : "智能问数工作区";
    const owner = isDecision ? "决策中心" : type === "agent" ? "Agent 应用" : "智能问数";
    const defaultReturnRoute = isDecision ? "/dashboard/s001?tab=evidence" : agentRecord?.kind === "dashboard-insight" ? "/dashboard/s001?tab=insight" : ["published", "withdrawn"].includes(readingReport().stage) ? "/reports/view" : "/reports/draft";
    const returnRoute = query.get("return") || summary?.returnRoute || requestData.returnRoute || defaultReturnRoute;
    const returnFilter = query.get("filter") || summary?.filter || requestData.filter || "Rule 与行动";
    const returnPosition = query.get("position") || summary?.returnPosition || requestData.returnPosition || "action-collaboration";
    const sourceScene = query.get("scene") || summary?.sourceScene || requestData.sourceScene || "S001";
    const businessSubject = query.get("subject") || summary?.businessSubject || requestData.singleBusinessSubjectName || requestData.singleBusinessSubject || requestData.unit || "未取得";
    const businessSubjectId = query.get("subjectId") || summary?.businessSubjectId || requestData.singleBusinessSubjectId || "未取得";
    const businessSubjectObjectType = query.get("subjectType") || summary?.businessSubjectObjectType || requestData.singleBusinessSubjectObjectType || "未取得";
    const summaryAsOf = query.get("asOf") || summary?.summaryAsOf || "未取得";
    if (isDecision) runtimeExternalViews.decisionNavigation = { returnRoute, filter: returnFilter, returnPosition, sourceScene, businessSubject, businessSubjectId, businessSubjectObjectType, summaryAsOf };
    const targetLinks = (summary?.targetRefs || decisionDetail?.targetRefs || []).map((target) => target.targetId
      ? `<button class="btn ${target.targetType === decisionTargetType ? "soft" : ""}" type="button" data-action="open-external-decision-target" data-target-type="${esc(target.targetType)}" data-id="${esc(target.targetId)}">${esc(target.targetType)} · ${esc(target.status)}</button>`
      : `<button class="btn" type="button" disabled>${esc(target.targetType)} · ${esc(target.status)}</button>`).join("");
    const fixed = agentRecord?.fixedContextRef || {};
    if (agentRecord?.kind === "report-generation") {
      fixed.reportId = `聚合 ${fixed.reportAggregateId || "未提供"} / 请求 ${fixed.reportRequestId || agentRecord.requestId || "未提供"}`;
      fixed.contentVersion = fixed.targetContentRevision
        ? `目标修订 ${fixed.targetContentRevision} · 草稿尚未形成`
        : "草稿尚未形成（源草稿形成前）";
      fixed.selectedAnchor = fixed.anchorContextStatus || "整份报告锚点清单已固定；单点锚点不适用";
      fixed.verificationRunId = fixed.verificationRunId || "尚未发起（生成阶段）";
    }
    const comparisonRow = `${fixed.verificationCurrentSummaryId ? `<div class="detail-row"><span>T049 当前摘要引用</span><strong>${esc(fixed.verificationCurrentSummaryId)} · ${esc(fixed.verificationCurrentSummaryVersion || "未提供")}</strong><small>形成 ${esc(fixed.verificationCurrentSummaryFormedAt || "未提供")} · 读取 ${esc(fixed.verificationCurrentSummaryReadAt || "未提供")}</small></div>` : ""}${fixed.comparisonRecordId ? `<div class="detail-row"><span>显式比较记录</span><strong>${esc(fixed.comparisonRecordId)} · ${esc(fixed.comparisonOutcome || fixed.comparisonGate || "未提供")} · ${esc(fixed.comparisonReportDataVersion || "未提供")} / ${esc(fixed.comparisonCurrentDataVersion || "未提供")}</strong><small>比较 ${esc(fixed.comparisonComparedAt || "未提供")} · C017 ${esc(fixed.comparisonCurrentSummaryId || "未提供")} ${esc(fixed.comparisonCurrentSummaryVersion || "")}</small></div>` : ""}`;
    const body = isDecision ? decisionDetail ? `<div class="button-row">${targetLinks}</div><div class="detail-list"><div class="detail-row"><span>目标类型 / 标识</span><strong>${esc(decisionTargetType)} / ${esc(summary?.targetId || id)}</strong></div><div class="detail-row"><span>目标可用性</span><strong>${esc(summary?.targetAvailability || "不可定位")} · ${esc(summary?.status || "权威记录不可定位")}</strong></div><div class="detail-row"><span>Action Request</span><strong>${esc(decisionDetail.actionRequestId)}</strong></div><div class="detail-row"><span>C033 场景轮次</span><strong>${esc(summary?.scenarioContext?.scenarioId || "未取得")} / ${esc(summary?.scenarioContext?.scenarioVersion || "未取得")} / ${esc(summary?.scenarioContext?.scenarioRunId || "未取得")}</strong></div><div class="detail-row"><span>来源</span><strong>报告中心仪表盘 · ${esc(sourceScene)}</strong></div><div class="detail-row"><span>单一业务主体</span><strong>${esc(businessSubject)} · ${esc(businessSubjectId)} · ${esc(businessSubjectObjectType)}</strong></div><div class="detail-row"><span>Action Type</span><strong>${esc(requestData.actionTypeId)} · ${esc(requestData.actionTypeVersion)} · Published ${esc(requestData.actionTypePublishedSemanticVersion)}</strong></div><div class="detail-row"><span>Rule 条件</span><strong>${esc(requestData.ruleId)} · ${esc(requestData.ruleVersion)} · ${esc(requestData.ruleBranch)}</strong></div><div class="detail-row"><span>Metric / Rule 结果版本</span><strong>${esc(requestData.metricResultVersion || "未取得")} / ${esc(requestData.ruleResultVersion || "未取得")}</strong></div><div class="detail-row"><span>Published 语义 / 数据</span><strong>${esc(summary?.semanticVersion || decisionDetail.semanticVersion)} / ${esc(summary?.dataVersion || decisionDetail.dataVersion)} · 截至 ${esc(summary?.asOf || decisionDetail.asOf)}</strong></div><div class="detail-row"><span>摘要时点 / 读取时间</span><strong>${esc(summaryAsOf)} / ${esc(summary?.readAt || "未取得")}</strong></div><div class="detail-row"><span>返回位置 / 筛选</span><strong>${esc(returnRoute)} · ${esc(returnPosition)} / ${esc(returnFilter)}</strong></div></div>${summary?.targetAvailability === "尚未形成" ? `<div class="notice warning" style="margin-top:14px">${icon("clock")}<div><strong>${esc(decisionTargetType)}尚未形成</strong><span>当前只显示决策中心返回的可用性，不创建占位提醒或待办。</span></div></div>` : ""}` : `<div class="notice danger">${icon("file-question")}<div><strong>决策中心记录不可定位</strong><span>报告中心不会根据提交载荷、组件状态或报告内容重建提醒、待办或执行状态。</span></div></div>` : type === "agent" ? agentRecord ? `<div class="detail-list"><div class="detail-row"><span>Agent Release</span><strong>${esc(agentRecord.agentReleaseId)} · ${esc(agentRecord.agentReleaseVersion)}</strong></div><div class="detail-row"><span>Context Binding</span><strong>${esc(agentRecord.contextBindingId)} · ${esc(agentRecord.contextBindingVersion)}</strong></div><div class="detail-row"><span>Session</span><strong>${esc(agentRecord.sessionId)} · ${esc(agentRecord.sessionVersion)}</strong></div><div class="detail-row"><span>Run</span><strong>${esc(agentRecord.runId)} · ${esc(agentRecord.runVersion)}</strong></div><div class="detail-row"><span>Result</span><strong>${esc(agentRecord.resultId || "尚未形成")} · ${esc(agentRecord.resultVersion || "尚未形成")}</strong></div><div class="detail-row"><span>报告 / 内容版本</span><strong>${esc(fixed.reportId || fixed.draftId || "未提供")} · ${esc(fixed.contentVersion || "未提供")}</strong></div><div class="detail-row"><span>定义 / 模板</span><strong>${esc(fixed.reportDefinitionId || "未提供")} ${esc(fixed.reportDefinitionVersion || "")} · ${esc(fixed.templateId || "未提供")} ${esc(fixed.templateVersion || "")}</strong></div><div class="detail-row"><span>证据包 / 锚点</span><strong>${esc(fixed.evidencePackId || "未提供")} ${esc(fixed.evidencePackVersion || "")} · ${esc(fixed.selectedAnchor || fixed.anchorSnapshotId || "未提供")}</strong></div><div class="detail-row"><span>Published 语义 / 数据</span><strong>${esc(fixed.semanticVersion || "未提供")} / ${esc(fixed.dataVersion || "未提供")} · 截至 ${esc(fixed.asOf || "未提供")}</strong></div><div class="detail-row"><span>权限 / T049</span><strong>${esc(fixed.permissionDecisionId || "未提供")} ${esc(fixed.permissionDecisionVersion || "")} · ${esc(fixed.verificationRunId || "未发起")}</strong></div>${comparisonRow}<div class="detail-row"><span>提交 / 完成 / 回读</span><strong>${esc(agentRecord.submittedAt)} / ${esc(agentRecord.completedAt || "未完成")} / ${esc(agentRecord.readAt || "未回读")}</strong></div><div class="detail-row"><span>审计入口</span><strong>${esc(agentRecord.auditRoute || "未提供")}</strong></div><div class="detail-row"><span>权威状态</span><strong>${esc(agentRecord.status)} · Agent 应用只读返回</strong></div></div>` : `<div class="notice danger">${icon("file-question")}<div><strong>Agent 运行记录不可定位</strong><span>报告中心仅保留外部标识，不会根据报告草稿、问答内容或本地状态重建 Agent Run、Result 或 Session。</span></div></div><div class="detail-list"><div class="detail-row"><span>请求的运行标识</span><strong>${esc(id)}</strong></div><div class="detail-row"><span>恢复方式</span><strong>返回后重新读取 Agent 应用</strong></div></div>` : `<div class="detail-list"><div class="detail-row"><span>场景</span><strong>S001 集团融资成本与债务结构优化</strong></div><div class="detail-row"><span>范围</span><strong>${state.dashboard.scopeId}</strong></div><div class="detail-row"><span>所选单位</span><strong>${state.dashboard.compareUnits.join("、")}</strong></div><div class="detail-row"><span>版本</span><strong>${currentAuthority().semanticVersion} / ${currentAuthority().dataVersion}</strong></div></div>`;
    return `<div class="external-shell" data-screen-label="${title}"><header class="external-head"><div class="status-inline">${icon(isDecision ? "list-checks" : type === "agent" ? "bot" : "message-square-text")}<strong>${owner}</strong></div><button class="btn" type="button" data-action="external-return" data-route="${esc(returnRoute)}" data-filter="${esc(returnFilter)}" data-position="${esc(returnPosition)}" data-scene="${esc(sourceScene)}" data-subject="${esc(businessSubject)}" data-subject-id="${esc(businessSubjectId)}" data-subject-type="${esc(businessSubjectObjectType)}" data-as-of="${esc(summaryAsOf)}">${icon("arrow-left", "sm")}返回报告中心</button></header><main class="external-body"><article class="external-card"><header class="external-card-head"><h1>${title}</h1><p>通过稳定详情入口打开；返回后报告中心将重新读取权威状态。</p></header><div class="external-card-body">${body}<div class="notice" style="margin-top:14px">${icon("shield-check")}<div><strong>状态归 ${owner} 维护</strong><span>此处只展示跳转目标和传入上下文，不提供确认、拒绝、负责人分配、待办更新或其他跨模块状态写入操作。</span></div></div></div></article></main></div>`;
  }

  function renderExternal(path) {
    const parts = path.split("/").filter(Boolean);
    if (parts[1] === "decision") return externalRecord("decision", decodeURIComponent(parts[3] || parts[2] || ""), decisionTargetKey(parts[2]));
    return externalRecord(parts[1] || "decision", decodeURIComponent(parts.slice(2).join("/")));
  }

  function metricMeta(key) {
    const metrics = scopeMetrics();
    const map = {
      balance: ["融资余额", metrics ? `${formatNumber(metrics.balance, 3)} 亿元` : "不可定位", "全部融资明细折合人民币余额的受治理合计结果"],
      cost: ["余额加权融资成本", metrics ? formatPercent(metrics.cost, 6) : "不可定位", "按折合人民币余额加权，不对单位成本做简单平均"],
      floating: ["浮动利率余额占比", metrics ? formatPercent(metrics.floating, 6) : "不可定位", "浮动利率融资余额占当前范围融资余额的比例"],
      shortTerm: ["短期债务余额占比", metrics ? formatPercent(metrics.shortTerm, 6) : "不可定位", "短期分类余额占当前范围融资余额的比例"],
      foreign: ["外币融资余额占比", metrics ? formatPercent(metrics.foreign, 6) : "不可定位", "非人民币融资折合余额占当前范围融资余额的比例"],
      highCost: ["高成本融资余额占比", metrics ? formatPercent(metrics.highCost, 6) : "不可定位", "高于受治理高成本界限的融资余额占比"],
      credit: ["信用融资余额占比", metrics ? formatPercent(metrics.credit, 6) : "不可定位", "信用分类余额占比，未知担保方式不计入信用"],
    };
    return map[key] || map.balance;
  }

  function renderDrawer() {
    const drawer = state.ui.drawer;
    if (!drawer) return "";
    const report = readingReport();
    const binding = bindingFor(report);
    let title = "详情";
    let body = "";
    let foot = `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    if (drawer.type === "trust") {
      title = "数据状态与版本";
      const current = currentAuthority();
      const trustProjection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
      const previous = trustProjection.previousTrustedCombination || {};
      const currentTrustSummary = currentTrust();
      const bindingTrust = reportBindingSummary(report) || {};
      const reportBinding = bindingFor(report);
      const candidate = trustProjection.candidate || {};
      const dataPrevious = trustProjection.dataPreviousVersion || {};
      body = `<div class="section-stack"><div class="notice ${currentTrustSummary.hardQualityFailure ? "danger" : "warning"}">${icon(currentTrustSummary.hardQualityFailure ? "shield-x" : "shield-alert")}<div><strong>${esc(currentTrustSummary.hardQualityFailure ? "硬质量异常" : currentTrustSummary.publishedQuality || trustProjection.reason || "权威投影未就绪")}</strong><span>${esc(currentTrustSummary.hardQualityFailure ? currentTrustSummary.recoveryAdvice : bindingTrust?.publishedQualityDetails || currentTrustSummary.recoveryAdvice || trustProjection.recoveryAdvice)}</span></div></div><section class="trust-section"><h4>报告生成快照</h4><div class="detail-list"><div class="detail-row"><span>固定权威组合</span><strong>${esc(reportBinding.bindingId || "尚未形成")} · 语义 ${esc(reportBinding.semanticVersion || "未取得")} + 数据 ${esc(reportBinding.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>版本绑定摘要</span><strong>${esc(bindingTrust?.id || "尚未形成")} · ${esc(bindingTrust?.formedAt || "未取得")}</strong></div><div class="detail-row"><span>固定状态</span><strong>${esc(bindingTrust?.publishedQuality || reportBinding.quality || "未取得")} · ${esc(bindingTrust?.freshness || reportBinding.freshness || "未取得")} · ${esc(bindingTrust?.readiness || reportBinding.consumption || "未取得")}</strong></div></div>${renderFiveDimensions(bindingTrust)}</section><section class="trust-section"><h4>当前权威组合</h4><div class="detail-list"><div class="detail-row"><span>投影标识 / 状态</span><strong>${esc(trustProjection.projectionId || "不可定位")} · ${esc(trustProjection.projectionVersion || "未取得")} · ${esc(trustProjection.readStatus || "missing")}</strong></div><div class="detail-row"><span>C008 / T019</span><strong>${esc(current.bindingId || "尚未形成")} · 语义 ${esc(current.semanticVersion || "未取得")} + 数据 ${esc(current.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>当前只读状态</span><strong>${esc(currentTrustSummary.id || "不可定位")} · ${esc(currentTrustSummary.formedAt || "未取得")}</strong></div><div class="detail-row"><span>质量 / 新鲜度</span><strong>${esc(currentTrustSummary.publishedQuality || "未取得")} · ${esc(currentTrustSummary.freshness || "未取得")}</strong></div><div class="detail-row"><span>消费状态</span><strong>${esc(currentTrustSummary.hardQualityFailure ? "不可消费" : current.readiness || "未取得")}</strong></div>${currentTrustSummary.hardQualityFailure ? `<div class="detail-row"><span>质量事实时间</span><strong>${esc(currentTrustSummary.hardQualityFailureFoundAt || "未提供")}</strong></div><div class="detail-row"><span>摘要形成 / 页面读取</span><strong>${esc(currentTrustSummary.formedAt || "未提供")} / ${esc(runtimeExternalViews.trust?.readAt || drawer.trustReadAt || "未提供")}</strong></div>` : ""}</div>${renderFiveDimensions(currentTrustSummary)}</section><section class="trust-section readonly-identity"><h4>处理中或失败候选</h4><div class="detail-list"><div class="detail-row"><span>候选版本</span><strong>${esc(candidate.id || "未取得")} · ${esc(candidate.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>状态与边界</span><strong>${esc(candidate.readiness || "未形成")} · 未被 T019 采用，不参与正式数值比较</strong></div></div></section><section class="trust-section readonly-identity"><h4>上一版本证据</h4><div class="detail-list"><div class="detail-row"><span>数据侧上一已通过版本</span><strong>${esc(dataPrevious.id || "未取得")} · ${esc(dataPrevious.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>本体上一权威服务组合</span><strong>${esc(previous.bindingId || "未取得")} · ${esc(previous.semanticVersion || "未取得")} / ${esc(previous.dataVersion || "未取得")} · 截至 ${esc(previous.asOf || "未取得")}</strong></div><div class="detail-row"><span>使用边界</span><strong>两者分别只读展示；不得由报告中心自行改用</strong></div></div></section></div>`;
      foot = `<button class="btn" type="button" data-action="reread-trust">${icon("refresh-cw", "sm")}重新读取</button><button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "metric") {
      const [name, value, definition] = metricMeta(drawer.metric);
      const current = currentAuthority();
      title = "口径与证据";
      body = `<div class="detail-list"><div class="detail-row"><span>指标</span><strong>${name}</strong></div><div class="detail-row"><span>当前结果</span><strong>${value} · ${state.dashboard.scopeId}</strong></div><div class="detail-row"><span>业务口径</span><strong>${definition}</strong></div><div class="detail-row"><span>Published 语义版本</span><strong>${esc(current.semanticVersion)}</strong></div><div class="detail-row"><span>结果版本</span><strong>${DATA.product.metricResultVersion}</strong></div><div class="detail-row"><span>数据版本</span><strong>${esc(current.dataVersion)}</strong></div><div class="detail-row"><span>数据截至</span><strong>${esc(current.asOf)}</strong></div></div>`;
    } else if (drawer.type === "structure") {
      title = drawer.name;
      body = `<div class="notice">${icon("layers")}<div><strong>受治理结构视图</strong><span>余额、占比和笔数来自已发布语义结果；报告中心只负责筛选、展示和下钻。</span></div></div>${structureGrid()}`;
    } else if (drawer.type === "rule") {
      const unit = currentFactPackage()?.units?.[drawer.unit];
      title = unit ? `${unit.rule.code} · ${unit.rule.name}` : "Rule 证据";
      body = unit ? `<div class="detail-list"><div class="detail-row"><span>业务主体</span><strong>${drawer.unit}</strong></div><div class="detail-row"><span>命中状态</span><strong>${unit.rule.status}</strong></div><div class="detail-row"><span>指标快照</span><strong>${unit.rule.metric} ${unit.rule.metricValue}</strong></div><div class="detail-row"><span>阈值</span><strong>${unit.rule.threshold}</strong></div><div class="detail-row"><span>触发分支</span><strong>${unit.rule.branch}</strong></div><div class="detail-row"><span>评估时间</span><strong>${unit.rule.evaluatedAt}</strong></div><div class="detail-row"><span>Rule 版本</span><strong>${esc(currentAuthority().semanticVersion)} / ${unit.rule.resultVersion}</strong></div></div><h3>优先协商机构</h3>${institutionTable(unit.institutions)}` : `<div class="notice danger">${icon("file-question")}<div><strong>当前精确 Rule 事实不可定位</strong><span>不使用其他数据版本的 Rule 结论替代。</span></div></div>`;
      foot = unit ? `<button class="btn primary" type="button" data-action="open-action" data-unit="${drawer.unit}">${icon("send", "sm")}发起行动</button><button class="btn" type="button" data-action="close-drawer">关闭</button>` : `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "institution") {
      const candidates = [
        ...(currentFactPackage()?.institutions || []),
        ...Object.values(currentFactPackage()?.units || {}).flatMap((unit) => unit.institutions || []),
      ];
      const institution = candidates.find((item) => item.name === drawer.institution);
      const current = currentAuthority();
      title = "机构融资明细";
      body = institution ? `<div class="detail-list"><div class="detail-row"><span>融资机构</span><strong>${esc(institution.name)}</strong></div><div class="detail-row"><span>当前范围</span><strong>${esc(drawer.scope || state.dashboard.scopeId)}</strong></div><div class="detail-row"><span>融资余额</span><strong>${formatNumber(institution.balance, 3)} 亿元</strong></div><div class="detail-row"><span>余额占比</span><strong>${formatPercent(institution.share, 2)}</strong></div><div class="detail-row"><span>加权融资成本</span><strong>${formatPercent(institution.cost, 4)}</strong></div><div class="detail-row"><span>借据数</span><strong>${institution.count} 笔</strong></div><div class="detail-row"><span>Published 语义 / 数据</span><strong>${esc(current.semanticVersion)} / ${esc(current.dataVersion)}</strong></div><div class="detail-row"><span>数据截至</span><strong>${esc(current.asOf)}</strong></div></div><div class="notice">${icon("info")}<div><strong>只读业务明细</strong><span>机构指标来自当前权威组合；报告中心只负责展示和下钻，不创建或改写指标结果。</span></div></div>` : `<div class="empty-state"><div><div class="empty-icon">${icon("landmark")}</div><h2>机构记录不可定位</h2><p>返回机构列表后重新选择，不使用名称近似匹配。</p></div></div>`;
    } else if (drawer.type === "definition") {
      const def = [...DATA.definitions, ...state.customDefinitions].find((item) => item.id === drawer.id);
      title = "报告定义详情";
      body = `<div class="detail-list"><div class="detail-row"><span>名称</span><strong>${esc(def.name)}</strong></div><div class="detail-row"><span>业务目的</span><strong>${esc(def.purpose)}</strong></div><div class="detail-row"><span>适用对象</span><strong>${esc(def.audience)}</strong></div><div class="detail-row"><span>模板引用</span><strong>${esc(def.template || "待选择")}</strong></div><div class="detail-row"><span>证据范围</span><strong>${esc(def.evidence || "待补充")}</strong></div><div class="detail-row"><span>Agent / Skill</span><strong>${esc(def.agent || "待选择")}</strong></div><div class="detail-row"><span>校验规则</span><strong>${esc(def.validation || "待补充")}</strong></div><div class="detail-row"><span>复核规则</span><strong>${esc(def.review || "待补充")}</strong></div><div class="detail-row"><span>发布规则</span><strong>${esc(def.publish || "待补充")}</strong></div></div><div class="notice">${icon("info")}<div><strong>定义与模板分离</strong><span>业务目的、证据、Agent、校验和发布规则不写入模板。</span></div></div>`;
    } else if (drawer.type === "template") {
      const item = DATA.templates[0];
      title = "报告模板详情";
      body = `<div class="detail-list"><div class="detail-row"><span>模板</span><strong>${item.name} · ${item.version}</strong></div><div class="detail-row"><span>章节骨架</span><strong>${item.chapters.join(" → ")}</strong></div><div class="detail-row"><span>受控内容组件</span><strong>章节、指标卡、数据表、图表、Rule 摘要、脚注、附件</strong></div><div class="detail-row"><span>固定呈现</span><strong>${item.formats.join(" / ")}</strong></div></div><div class="notice">${icon("shield-check")}<div><strong>模板只负责骨架与版式</strong><span>不维护业务口径、证据范围、Agent 配置、复核或发布规则。</span></div></div>`;
    } else if (drawer.type === "trace") {
      title = "报告追溯";
      const historyKey = report.reportNo || report.draftId || report.aggregateId;
      const historyRecord = runtimeExternalViews.historySemanticByReport.get(historyKey) || null;
      const historyRead = historyRecord?.status;
      const semanticStatus = semanticResolutionFor(report);
      const verificationReference = report.publicationVerificationRef || (report.verification.runId ? { runId: report.verification.runId, completedAt: report.verification.completedAt, coverage: report.verification.coverage } : null);
      const tracedEvidencePack = evidencePackFor(report);
      const decisionSummary = tracedEvidencePack?.decisionRunSummary || null;
      const decisionRecords = Array.isArray(decisionSummary?.records) ? decisionSummary.records : [];
      const decisionTaskRefs = decisionRecords.flatMap((record) => (record.targetRefs || []).filter((target) => target?.targetType === "待办" && target?.targetId).map((target) => ({
        taskId: target.targetId,
        subject: record.businessSubject || record.businessSubjectId || "未提供业务主体",
        readAt: record.readAt || decisionSummary.readAt || null,
      })));
      const currentDecisionTaskRefs = (OWNERS.decision.listScenarioSummaries?.() || []).flatMap((record) => (record.targetRefs || []).filter((target) => target?.targetType === "待办" && target?.targetId));
      const currentDecisionDiagnostic = OWNERS.decision.diagnose?.() || { available: false, reason: "C019 读取状态不可定位。" };
      const decisionSummaryPanel = decisionTaskRefs.length
        ? `<div class="notice">${icon("list-checks")}<div><strong>生成时决策摘要 · ${esc(decisionSummary.contractCode || "C019")}</strong><span>只读固定 ${decisionTaskRefs.length} 条负责人待办引用，不复制或维护决策状态。</span></div></div><div class="detail-list">${decisionTaskRefs.map((item) => `<div class="detail-row"><span>${esc(item.subject)}</span><strong>${esc(item.taskId)}${item.readAt ? ` · 读取于 ${esc(item.readAt)}` : ""}</strong></div>`).join("")}</div>`
        : `<div class="notice warning">${icon("circle-help")}<div><strong>生成时未固定负责人待办摘要</strong><span>当前证据包中没有可定位的 C019 待办引用；不会用生成后的当前状态补写旧证据包。${currentDecisionTaskRefs.length ? `当前已可读取 ${currentDecisionTaskRefs.length} 条待办摘要，可生成新修订版。` : `当前仍未取得可用决策摘要：${esc(currentDecisionDiagnostic.reason || "未形成待办引用")} `}</span></div></div>`;
      body = `<div class="timeline"><div class="timeline-row done"><span class="timeline-node"></span><div><strong>报告定义与模板</strong><small>RD-FIN-001 1.0.0 · RT-FIN-002 2.2.0</small></div><time>固定</time></div><div class="timeline-row done"><span class="timeline-node"></span><div><strong>生成证据包</strong><small>${esc(report.evidencePackId)} · 语义 ${esc(binding.semanticVersion)} · 数据 ${esc(binding.dataVersion)}</small></div><time>${esc(binding.asOf)}</time></div><div class="timeline-row done"><span class="timeline-node"></span><div><strong>Agent 源草稿</strong><small>${esc(report.generationRunId)} · 结构化内容项与包内引用</small></div><time>${esc(report.generatedAt || "未形成")}</time></div><div class="timeline-row ${verificationReference ? "done" : "active"}"><span class="timeline-node"></span><div><strong>发布依据的确定性核验</strong><small>${esc(verificationReference?.runId || "未发起")} · ${verificationReference ? `${verificationReference.coverage?.completed || 0} / ${verificationReference.coverage?.applicable || 0} 检查单元` : "待完成"}</small></div><time>${esc(verificationReference?.completedAt || "")}</time></div><div class="timeline-row ${report.confirmedAt ? "done" : "active"}"><span class="timeline-node"></span><div><strong>人工复核</strong><small>${report.confirmedAt ? "已确认" : report.stage === "returned" ? "已退回" : "待处理"}</small></div><time>${esc(report.confirmedAt || report.returnedAt || "")}</time></div><div class="timeline-row ${["published", "withdrawn"].includes(report.stage) ? "done" : ""}"><span class="timeline-node"></span><div><strong>正式报告产物</strong><small>${["published", "withdrawn"].includes(report.stage) ? `${report.reportNo} · HTML / PDF · ${report.contentVersion}${report.stage === "withdrawn" ? " · 已撤回" : ""}` : "尚未发布"}</small></div><time>${esc(report.publishedAt || "")}</time></div></div>${report.postPublicationVerification?.runId ? `<div class="notice">${icon("shield-check")}<div><strong>发布后核验 ${esc(report.postPublicationVerification.runId)}</strong><span>独立记录，不覆盖发布依据 ${esc(report.publicationVerificationRef?.runId)}。</span></div></div>` : ""}<div class="notice ${historyRead === "missing" || semanticStatus === "missing" ? "danger" : ""}">${icon(historyRead === "checking" ? "loader-circle" : historyRead === "missing" || semanticStatus === "missing" ? "file-question" : "network")}<div><strong>历史语义解析：${historyRead === "checking" ? "正在等待本体管理返回" : historyRead === "missing" || semanticStatus === "missing" ? "历史资源不可定位" : historyRead === "resolved" ? "已重新读取" : "未发起"}</strong><span>${historyRead === "missing" || semanticStatus === "missing" ? "原版本不会被当前 Published 替代；冻结报告不发生变化。" : historyRead === "resolved" ? `C026 回读时点 ${esc(historyRecord?.readAt)}；只读结果未写回正式产物。` : "按稳定资源标识请求本体管理解析，不使用名称匹配。"}</span></div></div><div class="button-row" style="margin-top:10px">${report.generationRunId ? `<button class="btn" type="button" data-action="open-external-agent" data-id="${esc(report.generationRunId)}" data-return="${esc(routeInfo().path)}" data-position="report-cover">${icon("external-link", "sm")}查看 Agent 记录</button>` : ""}<button class="btn" type="button" data-action="resolve-history-semantics" ${historyRead === "checking" ? "disabled" : ""}>${icon("scan-search", "sm")}重新读取历史语义</button></div>`;
      body += decisionSummaryPanel;
    } else if (drawer.type === "anchor-evidence") {
      const contract = contentContract(report);
      const anchorBinding = contract.t044Bindings.find((item) => item.anchorId === drawer.anchor) || null;
      const fixedFactPackage = factPackageForReport(report);
      const boundFacts = (anchorBinding?.factRefs || []).map((factId) => factById(fixedFactPackage, factId)).filter(Boolean);
      const evidenceRefs = [...new Set([
        ...(anchorBinding?.evidenceRefs || []),
        ...boundFacts.flatMap((fact) => fact.evidence || []),
      ])];
      const exactEvidenceAvailable = Boolean(anchorBinding && factPackageIsAvailable(fixedFactPackage) && boundFacts.length);
      title = "报告位置与权威证据";
      body = semanticResolutionFor(report) === "missing" || !exactEvidenceAvailable ? `<div class="notice danger">${icon("file-question")}<div><strong>${semanticResolutionFor(report) === "missing" ? "历史资源不可定位" : "固定证据不可定位"}</strong><span>报告仍保留原稳定标识和内容快照，但该位置的生成时绑定当前无法完整解析。不得改用当前 Published 定义、当前数据或其他锚点证据冒充。</span></div></div><div class="detail-list"><div class="detail-row"><span>报告位置</span><strong>${esc(drawer.anchor)}</strong></div><div class="detail-row"><span>T044 内容绑定</span><strong>${esc(anchorBinding?.id || "不可定位")}</strong></div><div class="detail-row"><span>内容版本</span><strong>${esc(report.contentVersion || report.draftVersion)}</strong></div><div class="detail-row"><span>原语义版本</span><strong>${esc(binding.semanticVersion)}</strong></div><div class="detail-row"><span>原数据版本</span><strong>${esc(binding.dataVersion)} · 截至 ${esc(binding.asOf)}</strong></div><div class="detail-row"><span>责任位置</span><strong>历史语义解析：本体管理 · 固定证据与核验：报告中心</strong></div></div>` : `<div class="detail-list"><div class="detail-row"><span>报告位置</span><strong>${esc(anchorBinding.location || drawer.anchor)}</strong></div><div class="detail-row"><span>T044 内容绑定</span><strong>${esc(anchorBinding.id)} · ${esc(anchorBinding.contentType)}</strong></div><div class="detail-row"><span>内容版本 / 证据包</span><strong>${esc(report.contentVersion || report.draftVersion)} · ${esc(report.evidencePackId)}</strong></div>${boundFacts.map((fact) => `<div class="detail-row"><span>${esc(fact.label || fact.kind || fact.id)}</span><strong>${esc(formatFactValue(fact))} · ${esc(fact.scope || "未提供范围")} · 结果 ${esc(fact.resultVersion || "未提供")}</strong></div>${String(fact.kind || "").includes("Rule") ? `<div class="detail-row"><span>Rule 条件</span><strong>${esc(fact.ruleId || evidenceRefs.find((item) => String(item).startsWith("RULE-")) || "不可定位")} · 版本 ${esc(fact.ruleVersion || "未提供")} · ${esc(fact.triggeredBranch || fact.value || "未提供分支")}</strong></div><div class="detail-row"><span>评估与命中证据</span><strong>${esc(fact.evaluationId || "未提供评估标识")} · ${esc(fact.evaluatedAt || "未提供评估时间")} · 观测 ${esc(fact.observedValue || "未提供")}</strong></div>` : ""}`).join("")}<div class="detail-row"><span>权威证据</span><strong>${esc(evidenceRefs.join("、") || "不可定位")}</strong></div><div class="detail-row"><span>Published 语义 / 数据</span><strong>${esc(binding.semanticVersion)} / ${esc(binding.dataVersion)} · 截至 ${esc(binding.asOf)}</strong></div><div class="detail-row"><span>质量 / 新鲜度 / 消费状态</span><strong>${esc(binding.quality)} · ${esc(binding.freshness)} · ${esc(binding.consumption)}</strong></div><div class="detail-row"><span>责任位置</span><strong>语义定义：本体管理 · 数据可信度：数据工程 · 内容绑定：报告中心</strong></div></div><div class="notice">${icon("shield-check")}<div><strong>只读固定证据</strong><span>报告中心和 Agent 不能创建、修改或重新解释 Object、Property、Metric、Rule、Link 或 Action Type。</span></div></div>`;
    } else if (drawer.type === "comparison-record") {
      const record = report.comparisonRecords.find((item) => item.recordId === drawer.id);
      title = "比较记录详情";
      if (!record) {
        body = `<div class="notice danger">${icon("file-question")}<div><strong>比较记录不可定位</strong><span>不会根据当前报告或当前数据重建历史结果。</span></div></div>`;
      } else {
        const explanation = OWNERS.agent.getByComparisonRecord?.(record.recordId)
          || (record.explanationRunId ? OWNERS.agent.getQA(record.explanationRunId) : null);
        const resultRows = (record.results || []).map((item) => `<div class="verification-item">${statusIcon(item.status === "same" ? "pass" : item.status === "changed" ? "warn" : "unverifiable")}<div><h4>${esc(item.label)}：${item.status === "same" ? "无变化" : item.status === "changed" ? "发生变化" : "无法比较"}</h4><p>报告 ${esc(item.reportValue)} · 当前 ${esc(item.currentValue)}</p><p>报告结果 ${esc(item.reportResultVersion || "未提供")} · 当前结果 ${esc(item.currentResultVersion || "未提供")}</p></div></div>`).join("");
        body = `<div class="context-box"><span>C027 比较记录</span><strong>${esc(record.recordId)} · ${esc(record.recordStatus || "当前")}</strong><small>旧记录只追加陈旧标志和外部解释引用，不覆盖原确定性结果。</small></div><div class="detail-list"><div class="detail-row"><span>报告固定组合</span><strong>${esc(record.reportSnapshot?.bindingId)} · ${esc(record.reportSnapshot?.semanticVersion)} / ${esc(record.reportSnapshot?.dataVersion)}</strong></div><div class="detail-row"><span>报告固定事实包</span><strong>${esc(record.reportFactPackage?.packageId || record.reportFactPackageRef?.packageId || "不可定位")} · ${esc(record.reportFactPackage?.dataVersion || record.reportFactPackageRef?.dataVersion || record.reportSnapshot?.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>当前权威组合</span><strong>${esc(record.currentBinding?.bindingId)} · ${esc(record.currentBinding?.semanticVersion)} / ${esc(record.currentBinding?.dataVersion)}</strong></div><div class="detail-row"><span>当前事实包</span><strong>${esc(record.currentFactPackage?.packageId || record.currentFactPackageRef?.packageId || "不可定位")} · ${esc(record.currentFactPackage?.dataVersion || record.currentFactPackageRef?.dataVersion || record.currentBinding?.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>C017 当前摘要</span><strong>${esc(record.currentTrust?.id)} ${esc(record.currentTrust?.version)} · ${esc(record.currentTrust?.formedAt)}</strong></div><div class="detail-row"><span>读取 / 比较时间</span><strong>${esc(record.currentStatusReadAt)} / ${esc(record.comparedAt)}</strong></div><div class="detail-row"><span>比较门 / 阈值版本</span><strong>${esc(record.gateVersion || "未取得")} · ${esc(record.thresholdVersion || "未取得")}</strong></div><div class="detail-row"><span>权限 / 兼容 / 门</span><strong>${esc(record.permission)} · ${esc(record.compatibility)} · ${esc(record.gate)}</strong></div><div class="detail-row"><span>处理中或失败候选</span><strong>${esc(record.candidateSnapshot?.id || "未取得")} · ${esc(record.candidateSnapshot?.dataVersion || "未取得")} · ${esc(record.candidateSnapshot?.readiness || "未取得")}</strong></div><div class="detail-row"><span>数据侧上一版本</span><strong>${esc(record.dataPreviousSnapshot?.id || "未取得")} · ${esc(record.dataPreviousSnapshot?.dataVersion || "未取得")} · ${esc(record.dataPreviousSnapshot?.authority || "未取得")}</strong></div><div class="detail-row"><span>本体上一权威组合</span><strong>${esc(record.previousAuthoritativeSnapshot?.bindingId || "未取得")} · ${esc(record.previousAuthoritativeSnapshot?.semanticVersion || "未取得")} / ${esc(record.previousAuthoritativeSnapshot?.dataVersion || "未取得")}</strong></div><div class="detail-row"><span>确定性结果</span><strong>${esc(record.comparisonOutcome)} · 无变化 ${record.counts?.same || 0} / 变化 ${record.counts?.changed || 0} / 无法比较 ${record.counts?.unverifiable || 0}</strong></div><div class="detail-row"><span>Agent 解释引用</span><strong>${esc(record.explanationRequestId || "未发起")} · ${esc(record.explanationRunId || explanation?.runId || "未形成")} · ${esc(record.explanationResultId || explanation?.resultId || "未形成")} · ${esc(record.explanationReadAt || "未回读")}</strong>${record.explanationRequestId && (!record.explanationResultId || !record.explanationReadAt) ? `<button class="text-link" type="button" data-action="reread-comparison-record-explanation" data-id="${esc(record.recordId)}">重新读取解释</button>` : ""}</div></div>${record.staleReason ? `<div class="notice warning">${icon("clock")}<div><strong>该记录已陈旧</strong><span>${esc(record.staleReason)} · ${esc(record.staleDetectedAt)}</span></div></div>` : ""}${explanation?.status === "已完成" ? `<div class="notice success">${icon("bot")}<div><strong>Agent 应用只读解释</strong><span>${esc(explanation.answer)} · Result ${esc(explanation.resultId)}</span></div><button class="text-link" type="button" data-action="open-external-agent" data-id="${esc(explanation.runId)}" data-return="${esc(routeInfo().path)}" data-position="${esc(state.assistant.selectedAnchor || "report-cover")}">查看 Agent 记录</button></div>` : ""}<div class="verification-list">${resultRows}</div>`;
      }
    } else if (drawer.type === "scene") {
      const scene = DATA.scenes.find((item) => item.id === drawer.sceneId);
      title = `${scene.id} · ${scene.name}`;
      const missing = scene.id === "S002" ? ["预算业务目标与周期", "预算版本与口径清单", "差异分析与验收样例"] : scene.id === "S003" ? ["风险类别与监测周期", "指标、Rule 与阈值", "责任人与行动需求"] : ["正式报告样例与读者", "章节、证据与判断规则", "复核、发布与交付要求"];
      body = scene.id === "S003"
        ? `<div class="notice warning">${icon("shield-alert")}<div><strong>${esc(scene.status)}</strong><span>${esc(scene.capabilityStatus)} · ${esc(scene.readiness)}</span></div></div><div class="detail-list"><div class="detail-row"><span>当前阶段</span><strong>${esc(scene.stage)}</strong></div><div class="detail-row"><span>当前状态</span><strong>${esc(scene.status)}</strong></div><div class="detail-row"><span>场景能力</span><strong>${esc(scene.capabilityStatus)}</strong></div><div class="detail-row"><span>消费状态</span><strong>${esc(scene.readiness)}</strong></div><div class="detail-row"><span>不可用原因</span><strong>${esc(scene.unavailableReason)}</strong></div></div><div class="notice">${icon("info")}<div><strong>稳定入口只读展示</strong><span>不形成 S003 驾驶舱业务内容，不发起 Action Request，也不把兼容性数据标记为当前权威组合。</span></div></div>`
        : `<div class="notice warning">${icon("clock")}<div><strong>资料待补充</strong><span>当前只保留稳定入口、资源清单和接入门，不生成业务图表或结论。</span></div></div><h3>所需资料</h3><div class="checklist">${missing.map((item) => `<div class="check-row">${icon("circle-dashed", "sm")}<div><strong>${item}</strong><span>由场景业务 Owner 补充并确认</span></div></div>`).join("")}</div><h3>下一步</h3><p class="help-text">资料补齐后，按对象、指标、Rule、证据、数据就绪和验收样例逐项接入。</p>`;
    }
    return `<div class="drawer-backdrop"><aside class="drawer"><header class="drawer-head"><h2>${title}</h2><button class="icon-button" type="button" data-action="close-drawer" title="关闭">${icon("x")}</button></header><div class="drawer-body">${body}</div><footer class="drawer-foot">${foot}</footer></aside></div>`;
  }

  function wizardCanAdvance() {
    if (state.wizard.step === 1) return state.wizard.reportType === "finance";
    if (state.wizard.step === 4) return state.wizard.compatibility === "compatible";
    return true;
  }

  function renderGenerationWizard() {
    const w = state.wizard;
    const stepLabels = ["报告类型", "业务范围", "Published 语义", "数据上下文", "生成规则", "确认创建"];
    let content = "";
    if (w.step === 1) {
      content = `<div class="choice-grid"><button class="choice-card selected" type="button" data-action="select-report-type" data-value="finance">${icon("landmark")}<strong>集团融资经营分析报告</strong><span>S001 · 经营分析 · 已有获准定义、模板与证据范围</span>${badge("可创建", "success")}</button><button class="choice-card disabled" type="button" disabled>${icon("hand-coins")}<strong>财务公司贷款贷前调查报告</strong><span>S004 · 业务资料与正式章节合同尚未补齐</span>${badge("接入阻断", "warning")}</button><button class="choice-card disabled" type="button" disabled>${icon("file-chart-column")}<strong>预算与债务风险报告</strong><span>S002 / S003 · 等待场景资料与验收样例</span>${badge("接入阻断", "warning")}</button></div>`;
    } else if (w.step === 2) {
      content = `<div class="form-grid"><div class="form-field full"><label>业务目的</label><textarea class="textarea" readonly>形成集团融资成本、债务结构、重点单位、机构分布与 Rule 发现的固定经营分析结论。</textarea></div><div class="form-field"><label>适用对象</label><input class="input" value="集团财务管理者" readonly></div><div class="form-field"><label>业务主体</label><input class="input" value="集团" readonly></div><div class="form-field"><label>报告定义</label><input class="input" value="集团融资经营分析报告 · 1.0.0" readonly></div><div class="form-field"><label>模板</label><input class="input" value="融资经营分析模板 · 2.2.0" readonly></div></div><div class="notice">${icon("info")}<div><strong>定义与模板分开</strong><span>定义决定证据、Agent、校验、复核和发布规则；模板只负责章节骨架与版式。</span></div></div>`;
    } else if (w.step === 3) {
      const projection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
      const semanticReady = projection.readStatus === "ready" && Boolean(currentAuthority().semanticVersionId);
      content = `<div class="readonly-contract"><div class="contract-head"><div><strong>${semanticReady ? "获准 Published 语义组合" : "Published 语义组合待读取"}</strong><span>本体管理只读提供；报告中心不能创建、修改或重新解释。</span></div>${badge(semanticReady ? "Published" : "未取得", semanticReady ? "success" : "warning")}</div><div class="semantic-resource-grid"><article><span>Object / Property</span><strong>${semanticReady ? "融资业务对象与属性集合" : "等待当前权威组合"}</strong><small>定义、适用对象、筛选范围、有效期随精确版本固化</small></article><article><span>Metric</span><strong>${semanticReady ? "融资余额、加权融资成本与结构占比" : "等待当前权威组合"}</strong><small>名称、定义、单位、范围与版本在报告中披露</small></article><article><span>Rule</span><strong>${semanticReady ? "R01 / R02 / R03 评估结果" : "等待当前权威组合"}</strong><small>Rule 定义、版本、评估时间、分支与命中证据固定引用</small></article><article><span>Published 本体版本</span><strong>${esc(currentAuthority().semanticVersion || "未取得")}</strong><small>${semanticReady ? "按稳定资源标识解析，不按名称匹配" : esc(projection.reason || "到数据上下文步骤重新读取")}</small></article></div><div class="notice ${semanticReady ? "" : "warning"}">${icon(semanticReady ? "shield-check" : "circle-dashed")}<div><strong>${semanticReady ? "精确历史引用" : "当前不视为已获准"}</strong><span>${semanticReady ? "旧正式报告继续解析生成时版本；原版本不可定位时显示“无法核验”，不得改用当前定义冒充。" : "只有同一 C033 轮次的 C008/T019 与 C017 双摘要完整且可消费后，才可固定为报告上下文。"}</span></div></div></div>`;
    } else if (w.step === 4) {
      const current = currentAuthority();
      const projection = runtimeExternalViews.trust || OWNERS.trust?.peekCurrent?.() || {};
      const previous = projection.previousTrustedCombination || {};
      const trust = currentTrust();
      const stateCopy = w.compatibility === "checking" ? ["正在核对", "info"] : w.compatibility === "compatible" ? ["兼容，可生成", "success"] : w.compatibility === "blocked" ? ["当前组合不可消费", "danger"] : ["尚未核对", "plain"];
      content = `<div class="context-choice-list"><div class="context-choice selected"><span>${icon("database")}</span><div><strong>当前权威数据上下文</strong><small>${esc(current.bindingId || "尚未形成")} · 数据 ${esc(current.dataVersion || "未取得")} · 截至 ${esc(current.asOf || "未取得")}</small></div>${icon(current.bindingId ? "check-circle-2" : "circle-dashed")}</div><div class="context-choice readonly"><span>${icon("history")}</span><div><strong>本体上一权威组合</strong><small>${esc(previous.dataVersion || "未取得")} · 截至 ${esc(previous.asOf || "未取得")} · 只读参考，不能由报告中心切换</small></div>${icon("lock")}</div><div class="context-choice readonly"><span>${icon("database-backup")}</span><div><strong>数据侧上一已通过发布版本</strong><small>${esc(projection.dataPreviousVersion?.dataVersion || "未取得")} · 不是当前 T019，不参与本次生成</small></div>${icon("lock")}</div><div class="context-choice readonly"><span>${icon("loader-circle")}</span><div><strong>处理中候选版本</strong><small>${esc(projection.candidate?.dataVersion || "未取得")} · ${esc(projection.candidate?.readiness || "未形成")} · 不参与正式生成</small></div>${icon("lock")}</div></div><div class="context-validation ${stateCopy[1]}"><div><span>兼容性检查</span>${badge(stateCopy[0], stateCopy[1])}</div>${w.compatibility === "idle" ? `<p>验证 C008/T019 当前组合、C017 双摘要、C033 场景轮次、硬质量状态与消费就绪。</p><button class="btn primary" type="button" data-action="validate-data-context">验证上下文</button>` : w.compatibility === "checking" ? `<div class="progress-track"><span style="width:64%"></span></div>` : w.compatibility === "compatible" ? `<p>当前权威组合兼容且可消费；质量提示将在报告中固定披露。</p><button class="btn" type="button" data-action="validate-data-context">重新读取并验证</button>` : `<p>${esc(w.compatibilityReason || projection.reason || trust.recoveryAdvice || "统一权威投影不可用")} 报告中心不能自行改用上一版本。</p><button class="btn" type="button" data-action="validate-data-context">重新读取权威状态</button>`}</div>`;
    } else if (w.step === 5) {
      content = `<div class="choice-grid two"><label class="radio-card large"><input type="radio" name="wizard-generation-mode" value="standard" data-change="wizard-generation-mode" ${w.generationMode === "standard" ? "checked" : ""}><span><strong>标准证据范围</strong><span>集团指标、三家重点单位、R01/R02/R03、机构贡献和可信度披露。</span><small>Agent 仅返回结构化内容项和证据引用；受控 HTML 由模板组件形成。</small></span></label><label class="radio-card large"><input type="radio" name="wizard-generation-mode" value="restricted" data-change="wizard-generation-mode" ${w.generationMode === "restricted" ? "checked" : ""}><span><strong>增加受限机构附件</strong><span>固定证据时重新校验权限；证据不可读会停在“证据缺失”，不会调用 Agent 猜测。</span><small>适用于包含受限机构附件的正式报告需求。</small></span></label></div><div class="run-separation"><div><span>01</span><strong>报告生成 Run</strong><small>Agent 应用拥有源草稿与运行状态</small></div>${icon("arrow-right")}<div><span>02</span><strong>确定性核验 Run</strong><small>报告中心拥有 T049 四态与覆盖</small></div>${icon("arrow-right")}<div><span>03</span><strong>差异解释 Run</strong><small>独立 LLM 只解释，不改变四态</small></div></div>`;
    } else {
      const contextLabel = "C008/T019 当前权威组合";
      const current = currentAuthority();
      content = `<div class="confirmation-grid"><div><span>报告类型</span><strong>集团融资经营分析报告</strong><small>S001 · 经营分析</small></div><div><span>报告定义 / 模板</span><strong>1.0.0 / 2.2.0</strong><small>定义决定业务合同，模板决定章节骨架</small></div><div><span>Published 语义</span><strong>${esc(current.semanticVersion || "未取得")}</strong><small>Object、Property、Metric、Rule 精确引用</small></div><div><span>数据上下文</span><strong>${contextLabel}</strong><small>${esc(current.dataVersion || "未取得")} · 截至 ${esc(current.asOf || "未取得")}</small></div><div><span>生成方式</span><strong>${w.generationMode === "restricted" ? "增加受限机构附件" : "标准证据范围"}</strong><small>先固定证据，再发起 Agent</small></div><div><span>正式呈现</span><strong>受控 HTML + PDF 固定版</strong><small>同编号、同内容版本、同证据链</small></div></div><div class="notice warning">${icon("lock-keyhole")}<div><strong>创建不会产生正式结果</strong><span>提交后先形成报告 Draft 记录并进入证据固定；只有生成、核验、人工确认与发布均完成后才形成正式报告。</span></div></div>`;
    }
    return `<ol class="wizard-steps six">${stepLabels.map((label, index) => `<li class="${index + 1 < w.step ? "done" : index + 1 === w.step ? "active" : ""}"><span>${index + 1 < w.step ? icon("check", "sm") : index + 1}</span><strong>${label}</strong></li>`).join("")}</ol><div class="wizard-content">${content}</div>`;
  }

  function renderModal() {
    const modal = state.ui.modal;
    if (!modal) return "";
    const report = readingReport();
    let title = "";
    let subtitle = "";
    let body = "";
    let foot = "";
    let wide = false;
    if (modal.type === "reset") {
      title = s003ScenarioSelected() ? "请求新场景轮次" : "重置状态";
      subtitle = s003ScenarioSelected() ? "S003 重置必须由统一场景壳封存当前轮次并创建新的 scenarioRunId。" : "只清除当前场景轮次的未发布工作投影和临时界面状态。";
      body = s003ScenarioSelected()
        ? `<div class="notice warning">${icon("rotate-ccw")}<div><strong>当前轮次不会原地归零</strong><span>确认后只向统一场景壳提交重跑请求；原 scenarioRunId、报告、Action Request、待办和证据继续只读保留。</span></div></div>`
        : `<div class="notice warning">${icon("rotate-ccw")}<div><strong>正式历史不会被改写</strong><span>已发布报告、历史核验、独立比较、替代关系和导出记录继续保留；Agent、决策中心、本体管理和数据工程的权威记录不会被清除。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-reset">${s003ScenarioSelected() ? "提交新轮次请求" : "重置状态"}</button>`;
    } else if (modal.type === "generation") {
      title = "创建报告";
      subtitle = "按六步固定报告类型、业务范围、Published 语义和正式数据上下文。";
      wide = true;
      body = renderGenerationWizard();
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button>${state.wizard.step > 1 ? `<button class="btn" type="button" data-action="wizard-prev">上一步</button>` : ""}${state.wizard.step < 6 ? `<button class="btn primary" type="button" data-action="wizard-next" ${wizardCanAdvance() ? "" : "disabled"}>下一步</button>` : `<button class="btn primary" type="button" data-action="submit-generation">创建 Draft 并固定证据</button>`}`;
    } else if (modal.type === "action") {
      const unitName = state.ui.actionUnit;
      const factPackage = currentFactPackage();
      const unit = factPackage?.units?.[unitName];
      wide = true;
      title = "发起融资优化建议";
      subtitle = "只向决策中心提交标准 Action Request。";
      body = unit ? `<div class="form-grid"><div class="form-field full"><label for="action-unit">单一业务主体</label><select class="select" id="action-unit" data-change="action-unit">${Object.keys(factPackage.units).map((name) => `<option value="${name}" ${name === unitName ? "selected" : ""}>${factPackage.units[name].singleBusinessSubjectName || name} · ${factPackage.units[name].singleBusinessSubjectId}</option>`).join("")}</select></div><div class="form-field"><label>业务主体名称</label><input class="input" value="${unit.singleBusinessSubjectName}" readonly></div><div class="form-field"><label>业务主体稳定标识</label><input class="input" value="${unit.singleBusinessSubjectId}" readonly></div><div class="form-field"><label>业务主体 Object Type</label><input class="input" value="${unit.singleBusinessSubjectObjectType}" readonly></div><div class="form-field"><label>来源类型</label><input class="input" value="报告中心仪表盘" readonly></div><div class="form-field"><label>来源记录</label><input class="input" value="S001 / 仪表盘 ${DATA.product.dashboardVersion} / Rule 与行动" readonly></div><div class="form-field"><label>发起者</label><input class="input" value="财务分析员" readonly></div><div class="form-field"><label>请求时间</label><input class="input" value="提交时生成" readonly></div><div class="form-field"><label>已发布 Action Type</label><input class="input" value="${DATA.product.actionTypeId} · ${DATA.product.actionTypeVersion} · Published ${DATA.actionTypes[0].publishedSemanticVersion}" readonly></div><div class="form-field"><label>Rule 条件</label><input class="input" value="${unit.rule.id} · ${unit.rule.version} · ${unit.rule.name}" readonly></div><div class="form-field"><label>触发分支</label><input class="input" value="${unit.rule.branch}" readonly></div><div class="form-field"><label>评估与证据</label><input class="input" value="${unit.rule.evaluationId} · ${unit.rule.evaluatedAt}" readonly></div><div class="form-field"><label>Metric 快照</label><input class="input" value="${unit.rule.metricId} · ${unit.rule.metric} ${unit.rule.metricValue}" readonly></div><div class="form-field"><label>语义 / 数据版本</label><input class="input" value="${currentAuthority().semanticVersionId} / ${currentAuthority().dataAssetVersionId}" readonly></div><div class="form-field full"><label>行动建议上下文</label><textarea class="textarea" readonly>优先协商机构：${unit.institutions.map((item) => item.name).join("、")}；候选借据：${unit.loans.map((item) => item.id).join("、")}；建议方向：${unit.rule.code === "R01" ? "降息或置换高成本借据" : unit.rule.code === "R02" ? "固定利率、利率上限或重定价条款" : "展期或置换中长期融资"}</textarea></div></div><div class="notice" style="margin-top:12px">${icon("info")}<div><strong>提交结果边界</strong><span>缺少 Published Action Type 或当前权威数据硬质量失败时不能提交。取得来源请求标识只表示报告中心已提交标准请求；只有 C019 返回同标识稳定引用后才显示为决策中心已接收，仍不表示提醒已确认、待办已创建或行动已执行。</span></div></div>` : `<div class="notice danger">${icon("file-question")}<div><strong>当前主体的精确 Rule 事实不可定位</strong><span>不能使用其他版本事实提交 Action Request。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-action">${icon("send", "sm")}提交请求</button>`;
    } else if (modal.type === "action-submitting") {
      title = "正在提交 Action Request";
      body = `<div class="progress-card"><div class="progress-head"><div><h2>正在等待决策中心接收</h2><p>${esc(modal.unit)} · ${esc(modal.ruleCode)}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:68%"></span></div></div>`;
      foot = `<button class="btn" type="button" disabled>请稍候</button>`;
    } else if (modal.type === "action-result") {
      const request = state.actionRequests.find((item) => item.id === modal.id);
      const requestData = actionPayload(request);
      title = "Action Request 已接收";
      body = `<div class="notice success">${icon("circle-check")}<div><strong>${esc(request.id)}</strong><span>${modal.duplicate ? "C019 已按相同标识返回原 Action Request，未创建重复请求。" : "C019 已返回同一 Action Request 的稳定引用。"}</span></div></div><div class="detail-list" style="margin-top:12px"><div class="detail-row"><span>业务主体</span><strong>${esc(requestData.singleBusinessSubjectName || requestData.unit)} · ${esc(requestData.singleBusinessSubjectId)}</strong></div><div class="detail-row"><span>Object Type</span><strong>${esc(requestData.singleBusinessSubjectObjectType)}</strong></div><div class="detail-row"><span>Rule</span><strong>${requestData.ruleCode} · ${requestData.ruleName}</strong></div><div class="detail-row"><span>请求时间</span><strong>${request.createdAt}</strong></div><div class="detail-row"><span>提交前读取</span><strong>C008 / C017 · ${esc(requestData.currentTrustReadAt || "未取得")}</strong></div><div class="detail-row"><span>当前含义</span><strong>决策中心已接收标准请求</strong></div></div><div class="notice warning">${icon("shield-alert")}<div><strong>尚不代表后续决策状态</strong><span>提醒确认、负责人待办与行动执行状态只能在决策中心查看。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">留在驾驶舱</button><button class="btn primary" type="button" data-action="open-external-decision" data-id="${request.id}">查看详情</button>`;
    } else if (modal.type === "action-unknown") {
      title = "提交结果尚未确认";
      body = `<div class="notice warning">${icon("circle-help")}<div><strong>C019 尚未返回稳定引用</strong><span>${esc(modal.receipt.reason)} 当前不会记为已接收，也不会自动再发一条请求。</span></div></div><div class="detail-list" style="margin-top:12px"><div class="detail-row"><span>来源请求标识</span><strong>${esc(modal.payload.id || modal.payload.requestId)}</strong></div><div class="detail-row"><span>单一业务主体</span><strong>${esc(modal.payload.singleBusinessSubjectName)} · ${esc(modal.payload.singleBusinessSubjectId)}</strong></div><div class="detail-row"><span>提交标识</span><strong>${esc(modal.receipt.idempotencyKey)}</strong></div><div class="detail-row"><span>恢复顺序</span><strong>重新读取 C019；缺少稳定引用不证明请求未形成</strong></div>${modal.checkedAt ? `<div class="detail-row"><span>核对时间</span><strong>${esc(modal.checkedAt)}</strong></div>` : ""}</div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">暂后处理</button><button class="btn primary" type="button" data-action="check-action-result">重新读取 C019</button>`;
    } else if (modal.type === "action-failed") {
      title = "Action Request 提交失败";
      body = `<div class="notice danger">${icon("circle-x")}<div><strong>${esc(modal.receipt.reason || "决策中心拒绝了请求")}</strong><span>失败回执已返回；未形成提醒或待办，也未执行行动。</span></div></div><div class="detail-list" style="margin-top:12px"><div class="detail-row"><span>失败回执</span><strong>${esc(modal.receipt.receiptId || "未取得")}</strong></div><div class="detail-row"><span>责任位置</span><strong>${modal.receipt.outcome === "rejected" ? "决策中心入口校验；来源证据由本体管理与数据工程提供" : "决策中心接收"}</strong></div><div class="detail-row"><span>恢复建议</span><strong>重新读取 C008/C017 和已发布语义资源；条件恢复后从原入口再次提交。</strong></div></div>`;
      foot = `<button class="btn primary" type="button" data-action="close-modal">返回检查</button>`;
    } else if (modal.type === "return") {
      title = "退回草稿修订";
      subtitle = "原草稿、核验结果和复核问题保持只读。";
      const issueCount = report.verification.results.filter((item) => item.status === "fail" || item.status === "unverifiable").length;
      body = `<div class="notice warning">${icon("message-square-warning")}<div><strong>${issueCount || 1} 项问题需要处理</strong><span>重新生成后形成新的草稿版本和内容证据绑定。</span></div></div><div class="form-field" style="margin-top:12px"><label>退回意见</label><textarea class="textarea" id="return-note">修正高成本融资余额占比，并为行动建议补充结构化证据绑定。</textarea></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-return">确认退回</button>`;
    } else if (modal.type === "publish") {
      title = "发布正式报告";
      subtitle = "从同一已确认内容版本形成两种固定呈现。";
      body = `<div class="detail-list"><div class="detail-row"><span>内容版本</span><strong>${report.contentVersion}</strong></div><div class="detail-row"><span>HTML 阅读版</span><strong>章节目录、稳定锚点、证据入口与报告助手</strong></div><div class="detail-row"><span>PDF 固定版</span><strong>同内容、同报告编号、同证据链</strong></div><div class="detail-row"><span>发布后</span><strong>冻结，不随新数据或模板原地变化</strong></div></div><div class="notice">${icon("shield-check")}<div><strong>发布完成门</strong><span>HTML 与 PDF 均形成后，正式报告才进入产物库。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-publish">${icon("upload", "sm")}确认发布</button>`;
    } else if (modal.type === "new-definition") {
      title = "新建报告定义";
      subtitle = "先形成可校验业务合同，再启用生成。";
      body = `<div class="form-grid"><div class="form-field full"><label>名称</label><input class="input" data-input="definition-name" value="${esc(state.ui.tempDefinitionName)}" placeholder="例如：月度融资机构集中度报告"></div><div class="form-field full"><label>业务目的</label><textarea class="textarea" data-input="definition-purpose" placeholder="说明报告要回答的业务问题">${esc(state.ui.tempDefinitionPurpose)}</textarea></div><div class="form-field"><label>适用对象</label><select class="select"><option>集团财务管理者</option><option>融资分析人员</option></select></div><div class="form-field"><label>模板引用</label><select class="select"><option>融资经营分析模板 2.2.0</option></select></div></div><div class="notice" style="margin-top:12px">${icon("info")}<div><strong>保存为编辑中</strong><span>证据范围、Agent、校验、复核和发布规则补齐并校验后才能启用。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="save-new-definition">保存定义</button>`;
    } else if (modal.type === "regenerate") {
      title = "请求重新生成";
      subtitle = "正式报告保持冻结，新请求将形成新的证据包和产物。";
      body = `<div class="form-field"><label>重新生成原因</label><textarea class="textarea" id="regenerate-note">根据当前数据形成新的融资经营分析报告，并保留与原报告的替代关系。</textarea></div><div class="notice warning" style="margin-top:12px">${icon("layers")}<div><strong>原报告不会变化</strong><span>${report.reportNo}、内容版本 ${report.contentVersion} 和全部锚点继续可读。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="start-regeneration-from-published">创建新请求</button>`;
    } else if (modal.type === "withdraw") {
      title = "撤回正式报告";
      subtitle = "撤回目录引用，不删除产物或历史证据。";
      body = `<div class="notice warning">${icon("archive-x")}<div><strong>${esc(report.reportNo)} 将不再作为当前正式报告</strong><span>HTML、PDF、内容版本、生成时 Published 语义和数据版本继续只读保留。需要修正内容时应生成新内容版本。</span></div></div><div class="form-field" style="margin-top:12px"><label>撤回原因</label><textarea class="textarea" id="withdraw-reason">发现需要补充披露的业务事项，先撤回目录引用并形成新内容版本。</textarea></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-withdraw">确认撤回</button>`;
    } else if (modal.type === "export") {
      title = "导出报告";
      subtitle = "导出任务引用同一正式报告编号、内容版本和证据链。";
      body = `<div class="choice-grid two"><label class="radio-card large"><input type="radio" name="export-format" value="pdf" data-change="export-format" ${state.ui.exportFormat !== "html" ? "checked" : ""}><span><strong>PDF 固定版</strong><span>适合存档、打印与线下流转。</span></span></label><label class="radio-card large"><input type="radio" name="export-format" value="html" data-change="export-format" ${state.ui.exportFormat === "html" ? "checked" : ""}><span><strong>受控 HTML 阅读包</strong><span>保留章节锚点、脚注与只读证据引用。</span></span></label></div><div class="notice">${icon("link")}<div><strong>内容同源</strong><span>导出不会重新调用 Agent，也不会使用当前数据重渲染旧报告。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-export">开始导出</button>`;
    } else if (modal.type === "export-progress") {
      title = "正在准备导出";
      body = `<div class="progress-card"><div class="progress-head"><div><h2>正在锁定固定呈现</h2><p>${esc(modal.taskId)} · ${esc(report.reportNo)}</p></div>${badge("处理中", "warning")}</div><div class="progress-track"><span style="width:68%"></span></div></div>`;
      foot = `<button class="btn" type="button" disabled>请稍候</button>`;
    } else if (modal.type === "export-result") {
      const task = state.exportTasks.find((item) => item.id === modal.taskId);
      title = task?.status === "失败" ? "导出失败" : "导出已完成";
      body = task?.status === "失败" ? `<div class="notice danger">${icon("circle-x")}<div><strong>${esc(task.failure || "导出任务失败")}</strong><span>报告内容与正式状态未受影响。身份一致的封装故障可重试；版本或场景错配须返回正式报告重新发起。</span></div></div><div class="detail-list"><div class="detail-row"><span>导出任务</span><strong>${esc(task.id)}</strong></div><div class="detail-row"><span>报告版本</span><strong>${esc(task.reportNo)} · ${esc(task.contentVersion)}</strong></div><div class="detail-row"><span>恢复方式</span><strong>${task.failure === "固定文件封装超时" ? "重试当前导出任务" : "返回正式报告核对固定身份"}</strong></div></div>` : `<div class="notice success">${icon("circle-check")}<div><strong>${task?.format === "pdf" ? "PDF 固定版已准备" : "受控 HTML 阅读包已准备"}</strong><span>引用报告 ${esc(task.reportNo)} 的内容版本 ${esc(task.contentVersion)} 和同一冻结正文，不包含当前数据替换。</span></div></div><div class="detail-list"><div class="detail-row"><span>导出任务</span><strong>${esc(task?.id)}</strong></div><div class="detail-row"><span>完成时间</span><strong>${esc(task?.completedAt)}</strong></div></div>`;
      foot = task?.status === "失败" ? `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-action="retry-export" data-id="${esc(task.id)}">重试导出</button>` : `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-action="${task?.format === "pdf" ? "open-export-pdf" : "download-export"}" data-id="${esc(task?.id)}">${task?.format === "pdf" ? "打开 PDF 固定版" : "下载 HTML 阅读包"}</button>`;
    }
    return `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}"><header class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${modal.type !== "action-submitting" ? `<button class="icon-button" type="button" data-action="close-modal" title="关闭">${icon("x")}</button>` : ""}</header><div class="modal-body">${body}</div><footer class="modal-foot">${foot}</footer></section></div>`;
  }

  function restoreScroll() {
    if (!state.ui.pendingScrollAnchor) return;
    const anchor = state.ui.pendingScrollAnchor;
    state.ui.pendingScrollAnchor = null;
    saveState();
    window.requestAnimationFrame(() => {
      const element = document.getElementById(anchor);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function renderApp() {
    const { path, query } = routeInfo();
    const returnedFromDecision = previousRoutePath?.startsWith("/external/decision/") && !path.startsWith("/external/");
    const navigation = runtimeExternalViews.decisionNavigation;
    const returnedSummaries = returnedFromDecision
      ? rereadDecisionSummaries({
        returnRoute: navigation?.returnRoute || `${path}${query.toString() ? `?${query.toString()}` : ""}`,
        filter: navigation?.filter || null,
        returnPosition: navigation?.returnPosition || state.ui.pendingScrollAnchor || null,
        sourceScene: navigation?.sourceScene || null,
        businessSubject: navigation?.businessSubject || null,
        summaryAsOf: navigation?.summaryAsOf || null,
      })
      : [];
    let html = "";
    if (path === "/lifecycle") html = renderLifecycle();
    else if (path === "/scenes") html = renderScenes();
    else if (path === "/dashboard/s001" && !s003ScenarioSelected()) html = renderDashboard();
    else if (path === "/dashboard/s001" && s003ScenarioSelected()) html = renderS003Dashboard();
    else if (path === "/dashboard/s003" && s003ScenarioSelected()) html = renderS003Dashboard();
    else if (path === "/reports") html = renderReports();
    else if (path === "/reports/s003" && s003ScenarioSelected()) html = renderS003FormalReport();
    else if (path === "/reports/generate") html = renderGenerate();
    else if (path === "/reports/draft") html = s003ScenarioSelected() ? renderS003FormalReport() : renderReader(false);
    else if (path === "/reports/view") html = s003ScenarioSelected() && (query.get("enterpriseId") || query.get("reportId"))
      ? renderS003FormalReport()
      : s003ScenarioSelected()
        ? renderReports()
        : ["published", "withdrawn"].includes(readingReport().stage) ? renderReader(true) : renderGenerate();
    else if (path === "/reports/pdf") html = s003ScenarioSelected() ? renderS003FormalReport() : renderPdf();
    else if (path.startsWith("/external/")) html = renderExternal(path);
    else html = renderLifecycle();
    if (!path.startsWith("/external/")) html += renderDrawer() + renderModal();
    app.innerHTML = html;
    localizeVisibleText(app);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    restoreScroll();
    if (returnedSummaries.length) {
      toast("决策摘要已重新读取", `回链时点 ${returnedSummaries[0].readAt}；报告中心未保存或写入决策状态。`, "success");
      runtimeExternalViews.decisionNavigation = null;
    }
    previousRoutePath = path;
  }

  function restoreInterruptedWork() {
    if (state.report.stage === "generating") rereadGeneration(state.report);
    const operation = state.report.activeOperation;
    if (operation) {
      resumeActiveOperation();
      return;
    }
    if (["evidence", "publishing"].includes(state.report.stage)) {
      if (state.report.stage === "publishing") {
        state.report.stage = "publish_failed";
        state.report.progress = Math.max(78, state.report.progress || 0);
      } else state.report.stage = "evidence_missing";
      saveState();
    }
  }

  function beginGeneration(mode = state.report.generationMode, isRevision = false, requestIdOverride = null, options = {}) {
    const previous = state.report;
    const previousRevision = previous.revisionNumber || 0;
    const previousContext = {
      evidencePackId: previous.evidencePackId || null,
      generationRunId: previous.generationRunId || null,
      bindingSnapshot: clone(previous.bindingSnapshot || null),
    };
    const startNewAggregate = !isRevision && !options.reuseAggregate && !["idle", "evidence_missing", "generation_failed"].includes(previous.stage);
    const report = startNewAggregate ? newReportRecord() : previous;
    const requestId = requestIdOverride || makeId(isRevision ? "RGR" : "RGEN");
    report.generationMode = mode;
    report.generationBlock = null;
    const requestGate = readGenerationTrustGate(report, "开始固定证据前重新读取 C008/C017");
    if (!requestGate.allowed) {
      report.stage = "evidence_missing";
      report.progress = 18;
      report.activeOperation = null;
      report.generationBlock = {
        ...generationGateReference(requestGate, "开始固定证据前"),
        type: "authority-trust-gate",
        status: "阻断",
        reason: requestGate.reason,
        newEvidencePackFormed: false,
        agentRunSubmitted: false,
        isRevision,
        isReplacement: Boolean(report.replacedReportNo),
        sourceReportNo: report.replacedReportNo || null,
        requestId: null,
      };
      if (report.generationBlock.isReplacement && state.regenerationRequest?.id === requestId) {
        Object.assign(state.regenerationRequest, {
          status: "阻断",
          blockedAt: requestGate.readAt,
          blockReason: requestGate.reason,
          currentSummaryId: requestGate.projection?.trust?.id || null,
          currentSummaryVersion: requestGate.projection?.trust?.version || null,
          newEvidencePackFormed: false,
          agentRunSubmitted: false,
        });
      }
      if (startNewAggregate) state.report = report;
      state.ui.modal = null;
      state.ui.viewingReportNo = null;
      commit();
      return toast("当前权威组合不可用于生成", `${requestGate.reason} 未形成生成请求、证据包、Agent Run、草稿或正式报告。`, "danger");
    }
    const currentBinding = requestGate.projection.binding;
    const trustAtRequest = requestGate.projection.trust;
    const bindingTrustAtRequest = requestGate.projection.bindingSummary;
    const authoritativeFactPackage = requestGate.factPackage;
    const decisionSummaryCandidates = (OWNERS.decision.listScenarioSummaries?.() || []).filter((summary) =>
      summary?.scenarioContext?.scenarioId === requestGate.projection.scenarioContext?.scenarioId
      && summary?.scenarioContext?.scenarioVersion === requestGate.projection.scenarioContext?.scenarioVersion
      && summary?.scenarioContext?.scenarioRunId === requestGate.projection.scenarioContext?.scenarioRunId
      && summary?.semanticVersion === currentBinding.semanticVersion
      && summary?.dataVersion === currentBinding.dataVersion
      && summary?.targetRefs?.some((target) => target.targetType === "待办" && target.targetId)
    );
    const decisionSubjectIds = new Set();
    const decisionSummariesAtGeneration = decisionSummaryCandidates.filter((summary) => {
      const subjectId = summary.businessSubjectId || summary.businessSubject;
      if (!subjectId) return true;
      if (decisionSubjectIds.has(subjectId)) return false;
      decisionSubjectIds.add(subjectId);
      return true;
    });
    if (startNewAggregate) state.report = report;
    report.requestId = requestId;
    report.scenarioContext = clone(requestGate.projection.scenarioContext);
    report.aggregateId = report.aggregateId || makeId("RAG");
    report.stage = "evidence";
    report.progress = 18;
    report.evidencePackId = makeId("EP");
    report.generationRunId = null;
    report.contextMode = "current-authoritative";
    report.bindingSnapshot = {
      bindingId: currentBinding.bindingId,
      semanticVersionId: currentBinding.semanticVersionId,
      semanticVersion: currentBinding.semanticVersion,
      dataAssetId: currentBinding.dataAssetId,
      dataAssetVersionId: currentBinding.dataAssetVersionId,
      dataVersion: currentBinding.dataVersion,
      consumableVersionId: currentBinding.consumableVersionId,
      asOf: currentBinding.asOf,
      quality: bindingTrustAtRequest.publishedQuality,
      freshness: bindingTrustAtRequest.freshness,
      consumption: currentBinding.readiness,
      semanticResolution: "resolved",
      fixedAt: nowText(),
    };
    const evidencePack = {
      scenarioContext: clone(report.scenarioContext),
      id: report.evidencePackId,
      version: "1.0",
      reportDefinition: { id: "RD-FIN-001", version: "1.0.0" },
      template: { id: "RT-FIN-002", version: "2.2.0", slots: clone(DATA.templates[0].chapters) },
      semanticBinding: clone(currentBinding),
      dataTrustAtGeneration: clone(bindingTrustAtRequest),
      permission: { id: "PERM-REPORT-CONTEXT", version: "1.0", status: "allowed", scope: "报告绑定证据范围" },
      semanticResourceIds: [...DATA.semanticResources.map((item) => item.id), ...Object.values(DATA.metrics).map((item) => item.id), ...DATA.rules.map((item) => item.id), ...DATA.actionTypes.map((item) => item.id)],
      agentReference: { release: "融资报告生成助手 3.1.0", skill: "融资经营分析生成 1.0" },
      reportEvidenceSchemaVersion: DATA.reportEvidence.schemaVersion,
      factInventoryVersion: authoritativeFactPackage.factInventoryVersion,
      authoritativeFactPackage: clone(authoritativeFactPackage),
      decisionRunSummary: {
        contractCode: "C019",
        owner: "决策中心",
        consumer: "报告中心",
        readAt: nowText(),
        records: clone(decisionSummariesAtGeneration),
      },
      fixedAt: report.bindingSnapshot.fixedAt,
      generationGateReads: [generationGateReference(requestGate, "开始固定证据前")],
    };
    report.evidencePacks.push(evidencePack);
    report.activeOperation = {
      type: "generation",
      phase: "evidence",
      dueAt: Date.now() + 850,
      mode,
      isRevision,
      previousRevision,
      previousContext,
    };
    state.ui.modal = null;
    state.ui.viewingReportNo = null;
    commit();
    resumeActiveOperation();
  }

  function completeEvidencePhase() {
    const report = state.report;
    const operation = report.activeOperation;
    if (!operation || operation.type !== "generation" || operation.phase !== "evidence") return;
    report.progress = 48;
    if (operation.mode === "restricted") {
      report.stage = "evidence_missing";
      report.activeOperation = null;
      commit();
      toast("证据固定未完成", "机构授信附件不可读；未发起 Agent 生成。", "danger");
      return;
    }
    const evidencePack = evidencePackFor(report);
    const evidenceGate = readGenerationTrustGate(report, "证据收集完成后重新读取 C008/C017", evidencePack?.semanticBinding || null);
    if (!evidenceGate.allowed) {
      return blockGenerationBeforeAgent(report, operation, evidenceGate, "证据收集完成后");
    }
    evidencePack.generationGateReads = Array.isArray(evidencePack.generationGateReads) ? evidencePack.generationGateReads : [];
    evidencePack.generationGateReads.push(generationGateReference(evidenceGate, "证据收集完成后"));
    startAgentGeneration(operation.isRevision, operation.previousRevision, null);
  }

  function startAgentGeneration(isRevision, previousRevision, retryOf) {
    const report = state.report;
    const evidencePack = evidencePackFor(report);
    if (!evidencePack || !factPackageIsAvailable(evidencePack.authoritativeFactPackage)) {
      report.stage = "generation_failed";
      report.activeOperation = null;
      commit();
      return toast("无法提交报告生成", "固定证据包中的精确结构化事实不可定位。", "danger");
    }
    const operation = report.activeOperation || {
      type: "generation",
      phase: "agent-submit",
      isRevision,
      previousRevision,
      previousContext: {
        evidencePackId: report.evidencePackId,
        generationRunId: report.generationRunId,
        bindingSnapshot: clone(report.bindingSnapshot || null),
      },
    };
    const submitGate = readGenerationTrustGate(report, "提交 Agent 生成前重新读取 C008/C017", evidencePack.semanticBinding);
    if (!submitGate.allowed) {
      return blockGenerationBeforeAgent(report, operation, submitGate, "提交 Agent 生成前");
    }
    evidencePack.generationGateReads = Array.isArray(evidencePack.generationGateReads) ? evidencePack.generationGateReads : [];
    evidencePack.generationGateReads.push(generationGateReference(submitGate, "提交 Agent 生成前"));
    const targetContentRevision = isRevision ? Math.max(2, previousRevision + 1) : Math.max(1, previousRevision + 1);
    const submittedAt = nowText();
    const external = OWNERS.agent.submitGeneration({
      requestId: report.requestId,
      submittedAt,
      evidencePackId: report.evidencePackId,
      retryOfRunId: retryOf,
      contentRevision: targetContentRevision,
      reportDefinition: clone(evidencePack.reportDefinition),
      template: clone(evidencePack.template),
      semanticBinding: clone(evidencePack.semanticBinding),
      reportContext: {
        scenarioContext: clone(report.scenarioContext),
        scenarioId: report.scenarioContext?.scenarioId || null,
        scenarioVersion: report.scenarioContext?.scenarioVersion || null,
        scenarioRunId: report.scenarioContext?.scenarioRunId || null,
        scenarioFormedAt: report.scenarioContext?.formedAt || null,
        scenarioStatus: report.scenarioContext?.status || null,
        contextPhase: "源草稿形成前",
        reportAggregateId: report.aggregateId,
        reportRequestId: report.requestId,
        targetContentRevision,
        reportDefinition: clone(evidencePack.reportDefinition),
        template: clone(evidencePack.template),
        evidencePack: {
          id: evidencePack.id,
          version: evidencePack.version,
          fixedAt: evidencePack.fixedAt,
          factPackageId: evidencePack.authoritativeFactPackage.packageId,
          factInventoryVersion: evidencePack.factInventoryVersion,
        },
        semanticBinding: clone(evidencePack.semanticBinding),
        trustAtGeneration: clone(evidencePack.dataTrustAtGeneration),
        permission: clone(evidencePack.permission),
        anchorContextStatus: "整份报告锚点清单已固定；单点锚点不适用",
      },
      reportEvidence: {
        sections: clone(DATA.reportEvidence.sections),
        anchors: clone(evidencePack.authoritativeFactPackage.anchors),
        contentFacts: clone(evidencePack.authoritativeFactPackage.contentFacts),
        contentItems: clone(evidencePack.authoritativeFactPackage.contentItems),
        renderManifest: clone(evidencePack.authoritativeFactPackage.renderManifest),
        generatedNarrativeContract: clone(evidencePack.authoritativeFactPackage.generatedNarrativeContract),
        schemaVersion: evidencePack.authoritativeFactPackage.schemaVersion,
        factInventoryVersion: evidencePack.authoritativeFactPackage.factInventoryVersion,
      },
    });
    if (!external?.requestId || external.status === "已拒绝") {
      return blockGenerationBeforeAgent(report, operation, {
        ...submitGate,
        allowed: false,
        reason: external?.failure || "Agent 应用拒绝了 C022 固定身份。",
      }, "提交 Agent 生成前");
    }
    const reference = {
      requestId: external.requestId || report.requestId,
      runId: external.runId || null,
      retryOfRunId: external.retryOfRunId,
      evidencePackId: report.evidencePackId,
      evidencePackVersion: evidencePack.version,
      semanticVersionId: evidencePack.semanticBinding.semanticVersionId,
      semanticVersion: evidencePack.semanticBinding.semanticVersion,
      dataAssetVersionId: evidencePack.semanticBinding.dataAssetVersionId,
      dataVersion: evidencePack.semanticBinding.dataVersion,
      consumableVersionId: evidencePack.semanticBinding.consumableVersionId,
      asOf: evidencePack.semanticBinding.asOf,
      submittedAt: external.submittedAt || submittedAt,
      scenarioContext: clone(report.scenarioContext),
      resultId: null,
      sourceDraftId: null,
      isRevision: Boolean(isRevision),
      previousRevision: Number(previousRevision || 0),
      targetContentRevision,
    };
    report.stage = "generating";
    report.progress = retryOf ? 58 : 52;
    report.generationRunId = reference.runId || null;
    report.agentGenerationRefs.push(reference);
    report.activeOperation = null;
    commit();
    toast("报告生成请求已交付", "C022 已形成；只有 Agent 应用返回身份一致的 C023 Run、Result 和源草稿后，报告中心才会创建评审副本。", "success");
  }

  function completeAgentGeneration() {
    const report = state.report;
    const reference = latestGenerationReference(report);
    if (!reference) return null;
    const evidencePack = evidencePackFor(report);
    const external = OWNERS.agent.getGeneration(reference.runId || reference.requestId);
    if (!external || ["等待 Agent 应用接收", "等待 Agent 应用运行", "运行中"].includes(external.status)) {
      const externalStatus = external?.status || "等待 Agent 应用接收";
      if (external?.runId) {
        reference.runId = external.runId;
        report.generationRunId = external.runId;
      }
      report.progress = external?.status === "运行中" ? 72 : 56;
      report.activeOperation = null;
      commit();
      return toast("Agent 草稿尚未形成", `${externalStatus}；报告中心未补造 Run、Result 或草稿。`, "danger");
    }
    if (["失败", "已拒绝"].includes(external.status)) {
      reference.runId = external.runId || reference.runId || null;
      report.stage = "generation_failed";
      report.progress = 86;
      report.activeOperation = null;
      commit();
      return toast("报告内容生成失败", `${external.failure || "Agent 应用未形成可接收源草稿"}；证据包已保留。`, "danger");
    }
    if (!external || external.status !== "已完成" || !external.resultId || !external.sourceDraftId || !external.sourceItems?.length || !external.generatedContent?.contentFacts?.length) {
      report.stage = "generation_failed";
      report.progress = 86;
      report.activeOperation = null;
      commit();
      return toast("报告内容生成失败", external?.failure || "Agent 未返回完整结构化内容项清单。", "danger");
    }
    const revisionNumber = reference.isRevision
      ? Math.max(2, reference.previousRevision + 1)
      : Math.max(1, reference.targetContentRevision || reference.previousRevision + 1);
    const sourceDraftId = external.sourceDraftId;
    const resultId = external.resultId;
    const reviewCopyId = makeId("RCP");
    const draftId = makeId("DRAFT");
    const draftVersion = `0.${revisionNumber}`;
    const snapshot = createContentSnapshot({ ...report, revisionNumber }, external.generatedContent);
    const contentContractSnapshot = buildContentContract(external.sourceItems, evidencePack.authoritativeFactPackage, draftId);
    reference.runId = external.runId;
    reference.resultId = resultId;
    reference.sourceDraftId = sourceDraftId;
    report.generationRunId = external.runId;
    report.generationResultId = resultId;
    report.contentVersions.push({
      scenarioContext: clone(report.scenarioContext),
      reviewCopyId,
      draftId,
      draftVersion,
      sourceDraftId,
      evidencePackId: report.evidencePackId,
      generationRunId: external.runId,
      status: "草稿待复核",
      snapshot: clone(snapshot),
      t044Bindings: contentContractSnapshot.t044Bindings,
      factInventory: contentContractSnapshot.factInventory,
      verificationPlan: contentContractSnapshot.verificationPlan,
      renderManifest: contentContractSnapshot.renderManifest,
      verificationRunIds: [],
      createdAt: nowText(),
    });
    report.stage = "draft";
    report.progress = 100;
    report.activeOperation = null;
    report.revisionNumber = revisionNumber;
    report.draftId = draftId;
    report.reviewCopyId = reviewCopyId;
    report.draftVersion = draftVersion;
    report.contentVersion = draftVersion;
    report.contentSnapshot = snapshot;
    report.generatedAt = nowText();
    report.returnedAt = null;
    report.confirmedAt = null;
    report.humanReview = { ...freshHumanReview(), contentVersion: draftVersion };
    report.verification = freshVerification();
    report.comparison = freshComparison();
    if (state.regenerationRequest?.id === report.requestId) state.regenerationRequest = null;
    state.assistant = newState().assistant;
    commit();
    toast("草稿已返回", `内容版本 ${report.draftVersion} 已形成；报告中心仅保留 Agent 结果引用和自身复核副本。`, "success");
  }

  function resumeActiveOperation() {
    const operation = state.report.activeOperation;
    if (!operation) return;
    const callback = operation.type === "generation" && operation.phase === "evidence"
      ? completeEvidencePhase
      : operation.type === "generation" && operation.phase === "agent"
        ? completeAgentGeneration
        : operation.type === "publication"
          ? completePublication
          : null;
    if (!callback) return;
    schedule(callback, Math.max(20, operation.dueAt - Date.now()));
  }

  function reportContextForQA(report = readingReport(), options = {}) {
    const snapshot = report.contentSnapshot || currentContentRecord(report)?.snapshot || null;
    const binding = bindingFor(report);
    const evidencePack = evidencePackFor(report);
    const contract = contentContract(report);
    const selectedAnchor = state.assistant.selectedAnchor;
    const selectedBinding = contract.t044Bindings.find((item) => item.anchorId === selectedAnchor) || null;
    const referencedVerification = options.verification?.status === "completed" && options.verification?.runId
      ? options.verification
      : null;
    const comparison = options.comparison?.status === "completed" && options.comparison?.recordId
      ? options.comparison
      : null;
    const explicitComparison = Boolean(comparison);
    return {
      scenarioContext: clone(report.scenarioContext || null),
      scenarioId: report.scenarioContext?.scenarioId || null,
      scenarioVersion: report.scenarioContext?.scenarioVersion || null,
      scenarioRunId: report.scenarioContext?.scenarioRunId || null,
      scenarioFormedAt: report.scenarioContext?.formedAt || null,
      scenarioStatus: report.scenarioContext?.status || null,
      contextIntent: options.intent || "report-qa-fixed",
      reportNumber: report.reportNo || report.draftId,
      reportId: report.reportNo || report.draftId,
      draftId: report.draftId || null,
      contentVersion: report.contentVersion || report.draftVersion,
      reportDefinition: clone(evidencePack?.reportDefinition || { id: report.definitionId, version: null }),
      template: clone(evidencePack?.template || {}),
      evidencePack: {
        id: evidencePack?.id || report.evidencePackId,
        version: evidencePack?.version || null,
        fixedAt: evidencePack?.fixedAt || binding.fixedAt || null,
        factPackageId: evidencePack?.authoritativeFactPackage?.packageId || null,
        factInventoryVersion: evidencePack?.factInventoryVersion || null,
        contentManifestId: contract.renderManifest?.manifestId || null,
        contentManifestVersion: contract.renderManifest?.version || null,
      },
      evidencePackId: report.evidencePackId,
      anchorSnapshotId: snapshot?.snapshotId || null,
      anchorSnapshotVersion: report.contentVersion || report.draftVersion,
      selectedAnchor,
      selectedAnchorBinding: clone(selectedBinding),
      t044Bindings: clone(contract.t044Bindings || []),
      renderManifest: clone(contract.renderManifest || { items: [] }),
      semanticResolution: semanticResolutionFor(report),
      semanticBinding: clone(binding),
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      asOf: binding.asOf,
      trustAtGeneration: clone(evidencePack?.dataTrustAtGeneration || {}),
      trustSummaryId: evidencePack?.dataTrustAtGeneration?.id || null,
      trustSummaryVersion: evidencePack?.dataTrustAtGeneration?.version || null,
      permission: clone(evidencePack?.permission || { id: "PERM-REPORT-CONTEXT", version: "1.0", status: "allowed", scope: "报告绑定证据范围" }),
      verificationReference: referencedVerification?.runId ? {
        runId: referencedVerification.runId,
        resultVersion: referencedVerification.planVersion || referencedVerification.resultVersion || null,
        status: referencedVerification.status || "发布依据",
        currentStatusSummaryRef: referencedVerification.currentStatusSummary ? {
          id: referencedVerification.currentStatusSummary.id,
          version: referencedVerification.currentStatusSummary.version,
          formedAt: referencedVerification.currentStatusSummary.formedAt,
          dataVersion: referencedVerification.currentStatusSummary.dataVersion,
          readAt: referencedVerification.currentStatusReadAt,
        } : null,
      } : null,
      comparisonMode: explicitComparison ? "explicit" : "snapshot-only",
      comparisonReference: explicitComparison ? {
        recordId: comparison.recordId,
        comparedAt: comparison.comparedAt,
        gate: comparison.gate,
        comparisonOutcome: comparison.comparisonOutcome,
        comparisonOutcomeReason: comparison.comparisonOutcomeReason,
        recordStatus: comparison.recordStatus,
        staleReason: comparison.staleReason,
        staleDetectedAt: comparison.staleDetectedAt,
        reportSnapshot: clone(comparison.reportSnapshot || null),
        currentBinding: clone(comparison.currentBinding || null),
        currentStatusSummaryRef: comparison.currentTrust ? {
          id: comparison.currentTrust.id,
          version: comparison.currentTrust.version,
          formedAt: comparison.currentTrust.formedAt,
          dataVersion: comparison.currentTrust.dataVersion,
        } : null,
        counts: clone(comparison.counts || null),
        results: clone(comparison.results || []),
      } : null,
      contentFacts: clone(snapshot?.contentFacts || []),
      authoritativeFacts: clone(snapshot?.authoritativeFacts || []),
      semanticResources: clone(evidencePack?.semanticResourceIds || []),
      trend: clone(snapshot?.trend || []),
    };
  }

  function publishC024Request(candidate) {
    const context = normalizeScenarioContext(candidate?.reportContext?.scenarioContext || {});
    const evidence = candidate?.reportContext?.evidencePack || {};
    const semantic = candidate?.reportContext?.semanticBinding || {};
    const reportId = candidate?.reportContext?.reportNumber || candidate?.reportContext?.reportId || null;
    const contentVersion = candidate?.reportContext?.contentVersion || null;
    if (!candidate?.requestId || !scenarioContextReady(context) || !sameScenarioContext(context, activeScenarioContext())
      || !reportId || !contentVersion || !evidence.id || !evidence.version
      || !semantic.semanticVersionId || !semantic.semanticVersion || !semantic.dataAssetVersionId || !semantic.dataVersion || !semantic.consumableVersionId || !semantic.asOf) {
      return false;
    }
    const compactFact = (fact = {}) => ({
      id: fact.id || fact.contentFactId || fact.factId || null,
      contentFactId: fact.contentFactId || null,
      factId: fact.factId || fact.sourceFactId || fact.id || null,
      label: fact.label || fact.name || null,
      kind: fact.kind || fact.semanticResourceType || null,
      value: clone(fact.value ?? null),
      unit: fact.unit || null,
      displayValue: fact.displayValue ?? null,
      scope: fact.scope || null,
      resultVersion: fact.resultVersion || null,
      evidenceRefs: clone(fact.evidenceRefs || fact.evidence || []),
    });
    const compactComparisonReference = (reference) => reference ? {
      recordId: reference.recordId || null,
      comparedAt: reference.comparedAt || null,
      gate: reference.gate || null,
      comparisonOutcome: reference.comparisonOutcome || null,
      comparisonOutcomeReason: reference.comparisonOutcomeReason || null,
      recordStatus: reference.recordStatus || null,
      staleReason: reference.staleReason || null,
      staleDetectedAt: reference.staleDetectedAt || null,
      reportSnapshot: clone(reference.reportSnapshot || null),
      currentBinding: clone(reference.currentBinding || null),
      currentStatusSummaryRef: clone(reference.currentStatusSummaryRef || null),
      counts: clone(reference.counts || null),
      results: (reference.results || []).map((item) => ({
        factId: item.factId || item.id || null,
        label: item.label || null,
        status: item.status || null,
        reportValue: item.reportValue ?? null,
        currentValue: item.currentValue ?? null,
        reportResultVersion: item.reportResultVersion || null,
        currentResultVersion: item.currentResultVersion || null,
        limitation: item.limitation || null,
        anchor: item.anchor || null,
      })),
    } : null;
    const compactCandidate = (request = {}) => {
      const requestContext = request.reportContext || {};
      const compactContext = {
        scenarioContext: clone(requestContext.scenarioContext || null),
        scenarioId: requestContext.scenarioId || null,
        scenarioVersion: requestContext.scenarioVersion || null,
        scenarioRunId: requestContext.scenarioRunId || null,
        scenarioFormedAt: requestContext.scenarioFormedAt || null,
        scenarioStatus: requestContext.scenarioStatus || null,
        contextIntent: requestContext.contextIntent || "report-qa-fixed",
        reportNumber: requestContext.reportNumber || requestContext.reportId || null,
        reportId: requestContext.reportId || requestContext.reportNumber || null,
        draftId: requestContext.draftId || null,
        contentVersion: requestContext.contentVersion || null,
        reportDefinition: clone(requestContext.reportDefinition || null),
        template: clone(requestContext.template || null),
        evidencePack: clone(requestContext.evidencePack || null),
        evidencePackId: requestContext.evidencePackId || requestContext.evidencePack?.id || null,
        anchorSnapshotId: requestContext.anchorSnapshotId || null,
        anchorSnapshotVersion: requestContext.anchorSnapshotVersion || null,
        selectedAnchor: requestContext.selectedAnchor || request.selectedAnchor || null,
        selectedAnchorBinding: clone(requestContext.selectedAnchorBinding || null),
        semanticResolution: requestContext.semanticResolution || null,
        semanticBinding: clone(requestContext.semanticBinding || null),
        semanticVersionId: requestContext.semanticVersionId || null,
        semanticVersion: requestContext.semanticVersion || null,
        dataAssetVersionId: requestContext.dataAssetVersionId || null,
        dataVersion: requestContext.dataVersion || null,
        asOf: requestContext.asOf || null,
        trustAtGeneration: clone(requestContext.trustAtGeneration || null),
        trustSummaryId: requestContext.trustSummaryId || null,
        trustSummaryVersion: requestContext.trustSummaryVersion || null,
        permission: clone(requestContext.permission || null),
        verificationReference: clone(requestContext.verificationReference || null),
        comparisonMode: requestContext.comparisonMode || "snapshot-only",
        comparisonReference: compactComparisonReference(requestContext.comparisonReference),
        contentFacts: (requestContext.contentFacts || []).map(compactFact),
        semanticResources: clone(requestContext.semanticResources || []),
      };
      return {
        requestId: request.requestId || null,
        receivedAt: request.receivedAt || nowText(),
        question: request.question || null,
        selectedAnchor: request.selectedAnchor || compactContext.selectedAnchor,
        evidencePackId: request.evidencePackId || compactContext.evidencePackId,
        reportContentVersion: request.reportContentVersion || compactContext.contentVersion,
        semanticResolution: request.semanticResolution || compactContext.semanticResolution,
        reportContext: compactContext,
      };
    };
    const existing = readStoredObject(C024_INBOX_KEY);
    const requests = (Array.isArray(existing) ? existing : Array.isArray(existing?.requests) ? existing.requests : [])
      .filter(Boolean)
      .map(compactCandidate);
    const identity = [reportId, contentVersion, evidence.id, evidence.version, semantic.semanticVersionId, semantic.semanticVersion, semantic.dataAssetVersionId, semantic.dataVersion, semantic.consumableVersionId, semantic.asOf];
    const conflict = requests.find((item) => {
      if (item?.requestId !== candidate.requestId) return false;
      const itemContext = item.reportContext || {};
      const itemEvidence = itemContext.evidencePack || {};
      const itemSemantic = itemContext.semanticBinding || {};
      const itemIdentity = [itemContext.reportNumber || itemContext.reportId || null, itemContext.contentVersion || null, itemEvidence.id || null, itemEvidence.version || null, itemSemantic.semanticVersionId || null, itemSemantic.semanticVersion || null, itemSemantic.dataAssetVersionId || null, itemSemantic.dataVersion || null, itemSemantic.consumableVersionId || null, itemSemantic.asOf || null];
      return !sameScenarioContext(normalizeScenarioContext(itemContext.scenarioContext || {}), context)
        || identity.some((value, index) => value !== itemIdentity[index]);
    });
    if (conflict) return false;
    const next = requests.filter((item) => item?.requestId !== candidate.requestId);
    next.push(compactCandidate(candidate));
    try {
      localStorage.setItem(C024_INBOX_KEY, JSON.stringify({
        contractCode: "C024",
        schemaVersion: 1,
        owner: "报告中心",
        consumer: "Agent 应用",
        scenarioContext: clone(candidate.reportContext?.scenarioContext || null),
        formedAt: nowText(),
        requests: next,
      }));
      return true;
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.error === "function") console.error("[ontology3] C024 交付失败", error);
      return false;
    }
  }

  function performPublish(isRetry = false) {
    if (state.report.stage !== "confirmed" && state.report.stage !== "publish_failed") {
      return toast("当前内容不能发布", "只有已完成自动核验、问题关闭并人工确认的内容版本可以发布。", "danger");
    }
    if (!state.report.confirmedAt || state.report.humanReview.status !== "confirmed") {
      return toast("人工检查尚未完成", "请先记录人工检查与确认，再形成正式产物。", "danger");
    }
    const evidencePack = evidencePackFor(state.report);
    const binding = bindingFor(state.report);
    if (!scenarioContextReady(state.report.scenarioContext) || !sameScenarioContext(state.report.scenarioContext, activeScenarioContext())
      || !state.report.contentVersion || !evidencePack?.id || !evidencePack?.version
      || !binding?.semanticVersionId || !binding?.dataAssetVersionId || !binding?.dataVersion || !binding?.consumableVersionId) {
      return toast("正式产物身份不完整", "报告根、内容版本、证据包、C033 或精确语义/数据版本不完整或与当前轮次错配；未开始发布。", "danger");
    }
    const trustGate = readReportTrustGate(state.report, "报告发布前重新读取 C017 后续质量事实");
    if (!trustGate.allowed) {
      state.report.publicationBlock = { status: "阻断", checkedAt: trustGate.readAt, dataVersion: trustGate.failure?.dataVersion || binding.dataVersion, reason: trustGate.reason };
      commit();
      return toast("报告发布已阻断", `${trustGate.reason || "C017 当前状态或精确版本身份不可确认"}。草稿、人工确认和原核验记录均已保留；请重新读取权威状态。`, "danger");
    }
    state.publishAttempt = isRetry ? 2 : 1;
    state.report.stage = "publishing";
    state.report.progress = isRetry ? 38 : 24;
    state.report.publicationId = state.report.publicationId || makeId("PUB");
    const run = {
      scenarioContext: clone(state.report.scenarioContext),
      id: makeId("PRUN"),
      retryOf: isRetry ? state.report.publicationRuns.at(-1)?.id || null : null,
      publicationId: state.report.publicationId,
      contentVersion: state.report.contentVersion,
      evidencePackId: evidencePack.id,
      evidencePackVersion: evidencePack.version,
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      consumableVersionId: binding.consumableVersionId,
      asOf: binding.asOf,
      versionBindingSummaryId: evidencePack.dataTrustAtGeneration?.id || null,
      versionBindingSummaryVersion: evidencePack.dataTrustAtGeneration?.version || null,
      versionBindingSummaryFormedAt: evidencePack.dataTrustAtGeneration?.formedAt || null,
      status: "处理中",
      startedAt: nowText(),
      completedAt: null,
      failure: null,
    };
    state.report.publicationRuns.push(run);
    state.report.activeOperation = { type: "publication", runId: run.id, dueAt: Date.now() + (isRetry ? 1300 : 1800), isRetry };
    state.ui.modal = null;
    navigate("/reports/generate");
    commit();
    schedule(() => { state.report.progress = 68; commit(); }, 600);
    resumeActiveOperation();
  }

  function completePublication() {
    const report = state.report;
    const operation = report.activeOperation;
    if (!operation || operation.type !== "publication") return;
    const run = report.publicationRuns.find((item) => item.id === operation.runId);
    if (!run) return;
    const trustGate = readReportTrustGate(report, "正式产物形成前重新读取 C017 后续质量事实");
    if (!trustGate.allowed) {
      run.status = "失败";
      run.failure = trustGate.reason || "C017 当前状态或精确版本身份不可确认";
      run.completedAt = nowText();
      report.stage = "publish_failed";
      report.progress = Math.max(78, report.progress || 0);
      report.activeOperation = null;
      report.publicationBlock = { status: "阻断", checkedAt: trustGate.readAt, dataVersion: trustGate.failure?.dataVersion || bindingFor(report).dataVersion, reason: trustGate.reason };
      commit();
      toast("正式产物形成已停止", `${run.failure}；草稿、人工确认和原核验均已保留，未形成正式报告。`, "danger");
      return;
    }
    if (!operation.isRetry) {
      run.status = "失败";
      run.failure = "PDF 字体资源校验超时";
      run.completedAt = nowText();
      report.stage = "publish_failed";
      report.progress = 78;
      report.activeOperation = null;
      commit();
      toast("正式产物形成失败", "PDF 固定版任务未完成；未发布不完整产物。", "danger");
      return;
    }
    const reportNo = makeId("RPT");
    const formalVersion = report.replacedReportNo ? "2.0" : "1.0";
    const draftVersion = report.contentVersion;
    const fixedBinding = clone(bindingFor(report));
    const fixedEvidencePack = evidencePackFor(report);
    const versionBindingSummary = clone(fixedEvidencePack?.dataTrustAtGeneration || null);
    report.reportNo = reportNo;
    report.contentVersion = formalVersion;
    report.stage = "published";
    report.progress = 100;
    report.publishedAt = nowText();
    report.activeOperation = null;
    run.status = "成功";
    run.completedAt = report.publishedAt;
    report.contentSnapshot = clone(report.contentSnapshot || createContentSnapshot(report));
    report.publicationVerificationRef = {
      scenarioContext: clone(report.scenarioContext),
      runId: report.verification.runId,
      resultVersion: report.verification.planVersion || null,
      contentVersion: report.contentVersion,
      sourceDraftVersion: draftVersion,
      evidencePackId: report.evidencePackId,
      completedAt: report.verification.completedAt,
      currentStatusSummary: clone(report.verification.currentStatusSummary || null),
      currentStatusReadAt: report.verification.currentStatusReadAt || null,
      coverage: clone(report.verification.coverage),
      statusCounts: report.verification.results.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
    };
    report.postPublicationVerification = null;
    const selectedAnchor = state.assistant.selectedAnchor;
    state.assistant.selectedAnchor = null;
    report.frozenHtml = reportPaper();
    state.assistant.selectedAnchor = selectedAnchor;
    report.artifactManifest = {
      scenarioContext: clone(report.scenarioContext),
      reportNo,
      contentVersion: formalVersion,
      sourceDraftVersion: draftVersion,
      evidencePackId: report.evidencePackId,
      evidencePackVersion: fixedEvidencePack?.version || null,
      semanticVersionId: fixedBinding.semanticVersionId,
      semanticVersion: fixedBinding.semanticVersion,
      dataAssetVersionId: fixedBinding.dataAssetVersionId,
      dataVersion: fixedBinding.dataVersion,
      consumableVersionId: fixedBinding.consumableVersionId,
      asOf: fixedBinding.asOf,
      versionBindingSummaryId: versionBindingSummary?.id || null,
      versionBindingSummaryVersion: versionBindingSummary?.version || null,
      versionBindingSummaryFormedAt: versionBindingSummary?.formedAt || null,
      html: { status: "已形成", frozenAt: report.publishedAt, reportNo, contentVersion: formalVersion, evidencePackId: report.evidencePackId, evidencePackVersion: fixedEvidencePack?.version || null, semanticVersionId: fixedBinding.semanticVersionId, semanticVersion: fixedBinding.semanticVersion, dataAssetVersionId: fixedBinding.dataAssetVersionId, dataVersion: fixedBinding.dataVersion, asOf: fixedBinding.asOf, versionBindingSummaryId: versionBindingSummary?.id || null, versionBindingSummaryVersion: versionBindingSummary?.version || null },
      pdf: { status: "已形成", frozenAt: report.publishedAt, reportNo, contentVersion: formalVersion, evidencePackId: report.evidencePackId, evidencePackVersion: fixedEvidencePack?.version || null, semanticVersionId: fixedBinding.semanticVersionId, semanticVersion: fixedBinding.semanticVersion, dataAssetVersionId: fixedBinding.dataAssetVersionId, dataVersion: fixedBinding.dataVersion, asOf: fixedBinding.asOf, versionBindingSummaryId: versionBindingSummary?.id || null, versionBindingSummaryVersion: versionBindingSummary?.version || null },
    };
    const content = currentContentRecord(report);
    if (content) content.status = "已发布";
    if (report.replacedReportNo) {
      const relation = { scenarioContext: clone(report.scenarioContext), oldReportNo: report.replacedReportNo, newReportNo: reportNo, createdAt: report.publishedAt };
      state.replacementRelations.push(relation);
      report.replaces = report.replacedReportNo;
      updatePublishedLifecycle(report.replacedReportNo, { replacedByReportNo: reportNo });
    }
    storePublishedReport(report);
    state.ui.viewingReportNo = reportNo;
    commit();
    toast("正式报告已发布", "HTML 阅读版与 PDF 固定版已冻结并进入正式报告目录。", "success");
  }

  function runExport(task, isRetry = false) {
    const report = state.publishedReports.find((item) => item.reportNo === task.reportNo && sameScenarioContext(item.scenarioContext, task.scenarioContext));
    const evidencePack = evidencePackFor(report);
    const binding = bindingFor(report);
    const manifest = report?.artifactManifest || {};
    if (!report || !resourceInCurrentScenario(report) || !sameScenarioContext(task.scenarioContext, activeScenarioContext()) || report.contentVersion !== task.contentVersion
      || report.evidencePackId !== task.evidencePackId || evidencePack?.version !== task.evidencePackVersion
      || binding.semanticVersionId !== task.semanticVersionId || binding.dataAssetVersionId !== task.dataAssetVersionId
      || binding.dataVersion !== task.dataVersion || binding.consumableVersionId !== task.consumableVersionId
      || binding.semanticVersion !== task.semanticVersion || binding.asOf !== task.asOf
      || manifest.reportNo !== task.reportNo || manifest.contentVersion !== task.contentVersion
      || manifest.evidencePackId !== task.evidencePackId || manifest.evidencePackVersion !== task.evidencePackVersion
      || manifest.semanticVersionId !== task.semanticVersionId || manifest.dataAssetVersionId !== task.dataAssetVersionId
      || manifest.dataVersion !== task.dataVersion || manifest.versionBindingSummaryId !== task.versionBindingSummaryId
      || manifest.versionBindingSummaryVersion !== task.versionBindingSummaryVersion) {
      task.status = "失败";
      task.failure = "正式报告身份、证据包、场景轮次或精确双版本不一致";
      state.ui.modal = { type: "export-result", taskId: task.id };
      commit();
      return;
    }
    task.status = "处理中";
    task.attempt = Number(task.attempt || 0) + 1;
    state.ui.modal = { type: "export-progress", taskId: task.id };
    commit();
    schedule(() => {
      if (task.attempt === 1 && !isRetry) {
        task.status = "失败";
        task.failure = "固定文件封装超时";
      } else {
        task.status = "成功";
        task.completedAt = nowText();
        if (task.format === "html") {
          task.file = {
            name: `${task.reportNo}-${task.contentVersion}.html`,
            mime: "text/html;charset=utf-8",
            encoding: "text",
            content: normalizeFrozenReportHtml(report?.frozenHtml || ""),
          };
          task.presentationRoute = null;
        } else {
          delete task.file;
          task.presentationRoute = "/reports/pdf";
        }
      }
      state.ui.modal = { type: "export-result", taskId: task.id };
      commit();
    }, 1200);
  }

  async function handleAction(element) {
    const action = element.dataset.action;
    if (action !== "toggle-reader-more") state.ui.readerMoreOpen = false;
    if (action === "s003-navigate-module") {
      if (!s003ScenarioSelected()) return;
      const moduleId = element.dataset.module;
      const hash = element.dataset.hash || undefined;
      if (!requestS003ShellAction("navigateScenarioModule", { moduleId, hash })) {
        return toast("请从统一场景入口操作", "跨模块导航由 v1.1.0 统一场景壳保持 scenarioRunId；报告中心独立打开时不会替换当前页面。", "danger");
      }
      return;
    }
    if (action === "s003-open-dashboard") {
      if (!s003ScenarioSelected()) return;
      if (!requestS003ShellAction("openS003DashboardCandidate")) return navigate("/dashboard/s003");
      return;
    }
    if (action === "s003-open-dashboard-candidate") {
      if (!s003ScenarioSelected()) return;
      const candidateId = element.dataset.candidateId || "";
      const enterpriseId = element.dataset.enterpriseId || "";
      if (!requestS003ShellAction("openS003DashboardCandidate", { candidateId, enterpriseId })) {
        const query = new URLSearchParams();
        if (candidateId) query.set("candidateId", candidateId);
        if (enterpriseId) query.set("enterpriseId", enterpriseId);
        return navigate(`/dashboard/s003${query.size ? `?${query}` : ""}`);
      }
      return;
    }
    if (action === "s003-submit-action-request") {
      if (!s003ScenarioSelected()) return;
      const contextState = s003ContextState();
      if (!contextState.isCurrent || contextState.projectionOnly) return toast("当前运行不可提交", "只有与统一场景上下文一致的 Published 正式运行可以提交行动申请。", "danger");
      const candidate = s003DecisionCandidates().find((item) => item.candidateId === element.dataset.candidateId) || null;
      if (!candidate) return toast("风险触发不可定位", "当前运行没有该候选，未创建替代行动申请。", "danger");
      if (candidate.routeConfigured === false) return toast("成员单位接口人未配置", `${candidate.enterpriseName} 尚未配置可接收行动申请的成员单位债务风险接口人，当前未提交 C011。`, "danger");
      if (candidate.confirmed && candidate.actionRequestId) {
        return requestS003ShellAction("navigateScenarioModule", { moduleId: "decision", hash: `#request/${encodeURIComponent(candidate.actionRequestId)}` });
      }
      const payload = s003ActionRequestForCandidate(candidate);
      const result = OWNERS.decision.submitAction(payload);
      if (result?.outcome !== "submitted") return toast("行动申请提交失败", result?.reason || "通用 C011 收件箱未接收该请求。", "danger");
      renderApp();
      toast("行动申请已送达成员单位接口人", `${candidate.enterpriseName} 的行动申请已定向送达 ${payload.recipientName} 的决策中心（原型记录路由，不触发外部通知），待接口人确认；确认后再提交分办任务，驾驶舱保留当前位置。`, "success");
      return;
    }
    if (action === "s003-open-action-request") {
      if (!s003ScenarioSelected()) return;
      const requestId = element.dataset.requestId || "";
      if (!requestId) return toast("行动申请不可定位", "当前记录没有可读取的 Action Request 标识。", "danger");
      s003Dashboard.actionDrawerRequestId = requestId;
      renderApp();
      return;
    }
    if (action === "s003-close-action-drawer") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.actionDrawerRequestId = null;
      renderApp();
      return;
    }
    if (action === "s003-switch-formal-run") {
      if (!s003ScenarioSelected()) return;
      const formal = s003RunOptions().find((run) => run.authorityMode === "published-evidence" && run.projectionOnly !== true);
      if (!formal) return toast("正式评分不可定位", "当前没有可用于行动申请的正式评分批次。", "danger");
      s003Dashboard.selectedRunId = formal.runId;
      s003Dashboard.resources = s003ResourcesForRun(formal.runId);
      s003Dashboard.tab = "actions";
      renderApp();
      return toast("已切换到正式评分", "现在可以核对风险触发并提交行动申请。", "success");
    }
    if (action === "s003-open-report" || action === "s003-open-formal-report") {
      if (!s003ScenarioSelected()) return;
      const enterpriseId = element.dataset.enterpriseId;
      if (!s003ReportFor(enterpriseId)) return toast("企业报告不可定位", "当前运行没有该企业的同身份报告。", "danger");
      s003Dashboard.selectedEnterpriseId = enterpriseId;
      s003Dashboard.formalReportSection = "s003-report-summary";
      s003Dashboard.formalReportTab = "qa";
      s003Dashboard.companionDraft = "";
      s003Dashboard.companionQuestionId = null;
      s003Dashboard.reportCompareOpen = false;
      const report = s003ReportFor(enterpriseId)?.content || null;
      const hash = s003FormalReportHash({ enterpriseId, reportId: report?.reportId || null, runId: s003Dashboard.selectedRunId });
      return navigate(hash.slice(1));
    }
    if (action === "s003-jump-report-section") {
      if (!s003ScenarioSelected()) return;
      const sectionId = element.dataset.section;
      if (!sectionId) return;
      s003Dashboard.formalReportSection = sectionId;
      document.querySelectorAll(".reader-toc .toc-link").forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
      window.requestAnimationFrame(() => {
        const section = document.getElementById(sectionId);
        const viewport = document.getElementById("report-viewport");
        if (!section) return;
        if (!viewport) return section.scrollIntoView({ behavior: "smooth", block: "start" });
        const viewportRect = viewport.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        viewport.scrollTo({ top: Math.max(0, viewport.scrollTop + sectionRect.top - viewportRect.top - 16), behavior: "smooth" });
      });
      return;
    }
    if (action === "s003-open-report-lifecycle") {
      if (!s003ScenarioSelected()) return;
      const params = { enterpriseId: s003Dashboard.selectedEnterpriseId, reportId: s003ReportFor(s003Dashboard.selectedEnterpriseId)?.content?.reportId, runId: s003Dashboard.selectedRunId };
      return navigate(s003ReportRoute("/reports/generate", params));
    }
    if (action === "s003-open-formation-review") {
      if (!s003ScenarioSelected()) return;
      const params = { enterpriseId: s003Dashboard.selectedEnterpriseId, reportId: s003ReportFor(s003Dashboard.selectedEnterpriseId)?.content?.reportId, runId: s003Dashboard.selectedRunId };
      return navigate(s003ReportRoute("/reports/draft", params));
    }
    if (action === "s003-open-report-pdf") {
      if (!s003ScenarioSelected()) return;
      const params = { enterpriseId: s003Dashboard.selectedEnterpriseId, reportId: s003ReportFor(s003Dashboard.selectedEnterpriseId)?.content?.reportId, runId: s003Dashboard.selectedRunId };
      return navigate(s003ReportRoute("/reports/pdf", params));
    }
    if (action === "s003-locate-report-evidence") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.formalReportTab = "verification";
      s003Dashboard.formalReportSection = "s003-report-evidence";
      renderApp();
      return;
    }
    if (action === "s003-set-report-assistant-tab") {
      if (!s003ScenarioSelected()) return;
      const tab = element.dataset.tab;
      if (!["qa", "companion", "verification"].includes(tab)) return;
      s003Dashboard.formalReportTab = tab === "companion" ? "qa" : tab;
      return renderApp();
    }
    if (action === "s003-select-companion-question" || action === "s003-fill-companion-question") {
      if (!s003ScenarioSelected()) return;
      const questionId = element.dataset.questionId || "risk-summary";
      const question = (s003Dashboard.resources?.reportAssurance?.companionQuestions || []).find((item) => item.questionId === questionId) || null;
      s003Dashboard.companionQuestionId = questionId;
      s003Dashboard.companionDraft = question?.label || "";
      return renderApp();
    }
    if (action === "s003-clear-companion-session") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.companionRequestRef = null;
      s003Dashboard.companionDraft = "";
      s003Dashboard.companionQuestionId = null;
      s003Dashboard.reportCompareOpen = false;
      renderApp();
      return toast("会话已清空", "推荐问题和当前报告上下文仍保留。", "success");
    }
    if (action === "s003-toggle-report-comparison") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.reportCompareOpen = !s003Dashboard.reportCompareOpen;
      return renderApp();
    }
    if (action === "s003-set-verification-filter") {
      if (!s003ScenarioSelected()) return;
      const filter = element.dataset.filter;
      if (!["all", "issues"].includes(filter)) return;
      s003Dashboard.verificationFilter = filter;
      return renderApp();
    }
    if (action === "s003-explain-verification") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.selectedVerificationCheckId = element.dataset.checkId || null;
      return renderApp();
    }
    if (action === "s003-locate-verification") {
      if (!s003ScenarioSelected()) return;
      const sectionId = s003VerificationAnchor(element.dataset.checkId);
      s003Dashboard.formalReportSection = sectionId;
      renderApp();
      window.requestAnimationFrame(() => {
        const section = document.getElementById(sectionId);
        const viewport = document.getElementById("report-viewport");
        if (!section || !viewport) return;
        const viewportRect = viewport.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        viewport.scrollTo({ top: Math.max(0, viewport.scrollTop + sectionRect.top - viewportRect.top - 16), behavior: "smooth" });
      });
      return;
    }
    if (action === "s003-refresh-verification") {
      if (!s003ScenarioSelected()) return;
      renderApp();
      return toast("当前核验已重新读取", "已按同一 scenarioRunId 重新读取 Published 绑定、正式产物及 C011/C019 状态；报告形成时核验未被改写。", "success");
    }
    if (action === "s003-submit-companion-agent") {
      if (!s003ScenarioSelected()) return;
      const reportId = element.dataset.reportId || "";
      const report = (s003Dashboard.resources?.reportContents?.reports || []).find((item) => item.content?.reportId === reportId)?.content || null;
      const selectedQuestion = (s003Dashboard.resources?.reportAssurance?.companionQuestions || [])
        .find((item) => item.questionId === s003Dashboard.companionQuestionId) || null;
      const questionText = String(s003Dashboard.companionDraft ?? selectedQuestion?.label ?? "").trim();
      if (!report || !questionText) return toast("报告伴读请求已阻断", "当前正式报告或问题正文不可定位，未写入 C024。", "danger");
      const request = s003CompanionAgentRequest(report, questionText, s003Dashboard.resources);
      if (!request || !publishC024Request(request)) {
        return toast("报告伴读请求已阻断", "当前运行、M05 场景 Release、报告内容版本、证据包或 Published 双版本身份不完整/错配，未写入 C024。", "danger");
      }
      const external = OWNERS.agent.submitQA(request);
      if (external?.status === "已拒绝") return toast("报告伴读请求已拒绝", external.failure || "Agent 应用拒绝了当前固定上下文。", "danger");
      s003Dashboard.companionRequestRef = {
        requestId: request.requestId,
        reportId: report.reportId,
        contentVersion: report.contentVersion,
        questionId: selectedQuestion?.label === questionText ? selectedQuestion.questionId : "custom",
        question: questionText,
        answer: external?.answer || external?.text || null,
        sessionId: external?.sessionId || null,
        runId: external?.runId || null,
        resultId: external?.resultId || null,
        status: external?.status || "等待 Agent 应用接收",
        submittedAt: external?.submittedAt || nowText()
      };
      renderApp();
      return toast("回答已生成", "回答基于当前正式报告及其证据，可继续提问或定位正文。", "success");
    }
    if (action === "s003-download-template-json") {
      if (!s003ScenarioSelected() || !s003Dashboard.resources?.reportTemplate) return;
      const resource = s003Dashboard.resources.reportTemplate;
      const blob = new Blob([JSON.stringify(resource, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resource.templateId || "S003-report-template"}-${resource.templateVersion || "1.0.0"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return toast("模板已下载", link.download, "success");
    }
    if (action === "s003-download-report-html") {
      if (!s003ScenarioSelected()) return;
      const artifact = s003ReportArtifact(element.dataset.reportId);
      if (!artifact?.html) return toast("正式 HTML 不可下载", "当前运行未形成同身份正式产物。", "danger");
      const blob = new Blob([artifact.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${artifact.reportId}-${artifact.contentVersion || "1.0.0"}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return toast("正式报告已下载", link.download, "success");
    }
    if (action === "s003-print-formal-report") {
      if (!s003ScenarioSelected()) return;
      window.print();
      return;
    }
    if (action === "s003-request-restore") {
      if (!s003ScenarioSelected()) return;
      const checkpointId = element.dataset.checkpointId;
      const sourceScenarioRunId = element.dataset.sourceRunId;
      if (!requestS003ShellAction("requestScenarioRestore", { checkpointId, sourceScenarioRunId, mode: "clone-restore", sourceModule: "M06" })) {
        return toast("请从统一场景入口恢复", "恢复必须由平台公共层克隆快照并创建新的 scenarioRunId；M06 不会本地生成轮次。", "danger");
      }
      return toast("已请求克隆恢复", `${checkpointId} 将由统一场景壳校验；原 ${sourceScenarioRunId} 保持只读且不会覆盖。`, "success");
    }
    if (action === "s003-set-tab") {
      if (!s003ScenarioSelected()) return;
      const tab = element.dataset.tab;
      if (!["overview", "analysis", "actions", "reports"].includes(tab)) return;
      s003Dashboard.tab = tab;
      return renderApp();
    }
    if (action === "s003-set-report-index-layout") {
      if (!s003ScenarioSelected()) return;
      if (!["cards", "list"].includes(element.dataset.layout)) return;
      s003Dashboard.reportIndexLayout = element.dataset.layout;
      return renderApp();
    }
    if (action === "s003-select-sector") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.analysisSector = element.dataset.sector || null;
      s003Dashboard.analysisIndicator = null;
      s003Dashboard.tab = "analysis";
      return renderApp();
    }
    if (action === "s003-select-weak-indicator") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.analysisIndicator = element.dataset.indicator || null;
      s003Dashboard.analysisSector = null;
      s003Dashboard.tab = "analysis";
      return renderApp();
    }
    if (action === "s003-clear-analysis-selection") {
      s003Dashboard.analysisSector = null;
      s003Dashboard.analysisIndicator = null;
      return renderApp();
    }
    if (action === "s003-filter-risk") {
      if (!s003ScenarioSelected()) return;
      const risk = element.dataset.risk;
      if (!["ALL", "GREEN", "YELLOW", "RED", "BLACK"].includes(risk)) return;
      s003Dashboard.riskFilter = risk;
      s003Dashboard.tab = "overview";
      s003Dashboard.analysisSector = null;
      s003Dashboard.analysisIndicator = null;
      return renderApp();
    }
    if (action === "s003-retry-load") {
      if (!s003ScenarioSelected()) return;
      s003Dashboard.status = "idle";
      s003Dashboard.error = null;
      s003Dashboard.resources = null;
      s003Dashboard.runtimeSnapshot = null;
      s003Dashboard.runtimeError = null;
      return renderApp();
    }
    if (action === "s003-request-rerun") {
      if (!s003ScenarioSelected() || !s003ContextState().isCurrent) return toast("当前运行不可重跑", "只有与统一场景上下文一致的当前运行可以创建新轮次。", "danger");
      if (!requestS003ShellAction("requestScenarioRerun", { sourceModule: "M06", requestedAt: new Date().toISOString() })) {
        return toast("请从统一场景入口操作", "快速重跑由 v1.1.0 统一场景壳编排，报告中心独立打开时不会创建新运行。", "warning");
      }
      s003Dashboard.lastRerunRequestAt = new Date().toISOString();
      return toast("已请求快速重跑", "请在统一工作台确认；确认后将封存当前轮次并创建新的 scenarioRunId。", "success");
    }
    if (action === "toggle-reader-more") {
      state.ui.readerMoreOpen = !state.ui.readerMoreOpen;
      return renderApp();
    }
    if (action === "retry-persistence") {
      const saved = saveState();
      renderApp();
      toast(saved ? "恢复点已保存" : "仍无法保存恢复点", saved ? "当前页面状态已写入浏览器，可继续操作。" : runtimePersistenceError, saved ? "success" : "danger");
      return;
    }
    if (action === "navigate") {
      const route = element.dataset.route;
      if (route === "/reports/draft" || route === "/reports/generate") state.ui.viewingReportNo = null;
      if (route === "/reports/view" && !state.ui.viewingReportNo && ["published", "withdrawn"].includes(state.report.stage)) state.ui.viewingReportNo = state.report.reportNo;
      saveState();
      return navigate(route);
    }
    if (action === "open-published-report") {
      state.ui.viewingReportNo = element.dataset.report;
      state.assistant = newState().assistant;
      saveState();
      return navigate("/reports/view");
    }
    if (action === "toggle-nav") { state.navOpen = !state.navOpen; return commit(); }
    if (action === "set-catalog-view") { state.catalog.view = element.dataset.view; return commit(); }
    if (action === "set-catalog-status") { state.catalog.status = element.dataset.status; return commit(); }
    if (action === "clear-catalog-filter") { state.catalog.query = ""; state.catalog.status = "all"; return commit(); }
    if (action === "open-reset") { state.ui.modal = { type: "reset" }; return commit(); }
    if (action === "confirm-reset") {
      if (s003ScenarioSelected()) {
        state.ui.modal = null;
        if (!s003ContextState().isCurrent) return toast("当前运行不可重置", "只有与统一场景上下文一致的当前运行可以创建新轮次。", "danger");
        if (!requestS003ShellAction("requestScenarioRerun", { sourceModule: "M06", reason: "reset-current-scenario", requestedAt: new Date().toISOString() })) {
          renderApp();
          return toast("请从统一场景入口操作", "S003 重置由 v1.1.0 统一场景壳编排；报告中心不会在原 scenarioRunId 内清空状态。", "warning");
        }
        renderApp();
        return toast("已请求新场景轮次", "统一场景壳将先形成前置 Checkpoint，再创建新的 scenarioRunId；当前轮次未被覆盖。", "success");
      }
      clearTimers();
      resetRuntimeExternalViews();
      const context = activeScenarioContext();
      if (!scenarioContextReady(context)) return toast("无法定向重置", "当前 C033 场景运行上下文不可定位；未清除任何报告、核验、比较或外部记录。", "danger");
      const preservedPublished = clone(state.publishedReports || []);
      const preservedWithdrawn = clone(state.withdrawnReports || []);
      const preservedRelations = clone(state.replacementRelations || []);
      const preservedExports = clone(state.exportTasks || []);
      const preservedActions = clone(state.actionRequests || []);
      state = newState();
      state.publishedReports = preservedPublished;
      state.withdrawnReports = preservedWithdrawn;
      state.replacementRelations = preservedRelations;
      state.exportTasks = preservedExports;
      state.actionRequests = preservedActions;
      saveState();
      window.location.hash = "/lifecycle";
      renderApp();
      return toast("当前工作区已重置", "未发布草稿和临时界面状态已清除；正式报告、历史核验/比较、导出记录及其他模块权威记录保持不变。", "success");
    }
    if (action === "close-modal") { state.ui.modal = null; return commit(); }
    if (action === "close-drawer") { state.ui.drawer = null; return commit(); }
    if (action === "open-trust") { state.ui.drawer = { type: "trust" }; return commit(); }
    if (action === "reread-trust") {
      const projection = readCurrentTrustProjection("用户重新读取权威状态", { advance: true });
      const readAt = projection.readAt;
      runtimeExternalViews.trust = projection;
      markComparisonRecordsStale(currentAuthority(), currentTrust(), readAt);
      recordTrustWarning(currentAuthority(), currentTrust(), readAt);
      state.ui.drawer = { ...state.ui.drawer, trustReadAt: readAt };
      commit();
      toast(currentTrust().hardQualityFailure ? "已读取到硬质量异常" : currentTrust().freshness === "上一可信版本继续服务" ? "已读取到受控回退结果" : "权威状态已重新读取", `本体管理 C008/T019 与数据工程 C017 返回于 ${readAt}；报告中心未改判或切换版本。`, currentTrust().hardQualityFailure ? "danger" : "success");
      return;
    }
    if (action === "open-metric") { state.ui.drawer = { type: "metric", metric: element.dataset.metric }; return commit(); }
    if (action === "open-structure") { state.ui.drawer = { type: "structure", name: element.dataset.structure }; return commit(); }
    if (action === "open-institution") { state.ui.drawer = { type: "institution", institution: element.dataset.institution, scope: state.dashboard.scopeId }; return commit(); }
    if (action === "open-scene-readiness") { state.ui.drawer = { type: "scene", sceneId: element.dataset.scene }; return commit(); }
    if (action === "set-scope-type") {
      state.dashboard.scopeType = element.dataset.type;
      const factPackage = currentFactPackage();
      state.dashboard.scopeId = element.dataset.type === "group" ? "集团" : element.dataset.type === "board" ? factPackage?.boards?.[0]?.name || "集团" : Object.keys(factPackage?.units || {})[0] || "集团";
      return commit();
    }
    if (action === "set-dashboard-tab") { state.dashboard.tab = element.dataset.tab; return commit(); }
    if (action === "toggle-compare-unit") {
      const unit = element.dataset.unit;
      const selected = state.dashboard.compareUnits;
      if (selected.includes(unit)) state.dashboard.compareUnits = selected.filter((item) => item !== unit);
      else if (selected.length < 3) state.dashboard.compareUnits = [...selected, unit];
      else return toast("最多选择 3 家单位", "先移除一项，再选择其他单位。", "danger");
      return commit();
    }
    if (action === "open-rule") { state.ui.drawer = { type: "rule", unit: element.dataset.unit }; return commit(); }
    if (action === "open-comparison-record") { state.ui.drawer = { type: "comparison-record", id: element.dataset.id }; return commit(); }
    if (action === "open-action") {
      const trust = currentTrust();
      const actionType = DATA.actionTypes.find((item) => item.id === DATA.product.actionTypeId && item.status === "Published");
      if (!actionType) return toast("缺少已发布 Action Type", "当前入口不能提交 Action Request。", "danger");
      if (!currentFactsAreUsable()) return toast("当前数据不可用于发起行动", factPackageIsAvailable(currentFactPackage()) ? trust.recoveryAdvice || "等待新的可消费权威组合。" : "当前精确事实包不可定位。", "danger");
      state.ui.drawer = null;
      state.ui.actionUnit = element.dataset.unit || (state.dashboard.scopeType === "unit" ? state.dashboard.scopeId : state.dashboard.compareUnits[0] || "单位553");
      state.ui.actionSubmissionId = makeId("ARSUB");
      state.ui.modal = { type: "action" };
      return commit();
    }
    if (action === "submit-action") {
      const unitName = state.ui.actionUnit;
      const submissionProjection = readCurrentTrustProjection("Action Request 提交前读取并固定 C008/C017");
      runtimeExternalViews.trust = submissionProjection;
      const submissionBinding = submissionProjection.binding;
      const currentTrustSummary = submissionProjection.trust;
      const factPackage = factPackageForBinding(submissionBinding);
      const unit = factPackage?.units?.[unitName];
      const actionType = DATA.actionTypes.find((item) => item.id === DATA.product.actionTypeId && item.status === "Published");
      if (!actionType) return toast("缺少已发布 Action Type", "所有请求强制引用 Published Action Type。", "danger");
      if (!unit?.singleBusinessSubjectId || !unit?.singleBusinessSubjectName || !unit?.singleBusinessSubjectObjectType) return toast("业务主体身份不完整", "单一业务主体必须同时包含稳定标识、名称和 Object Type。", "danger");
      if (!unit?.rule?.id || unit.rule.publicationStatus !== "Published") return toast("Rule 条件不完整", "S001 当前入口基于 Rule，不能标记为不适用。", "danger");
      const submissionGate = generationGateOutcome(submissionProjection);
      if (!submissionGate.allowed) return toast("当前数据不可用于发起行动", submissionGate.reason || "当前权威组合不可消费、不兼容或与场景轮次错配。", "danger");
      const idempotencyKey = state.ui.actionSubmissionId || makeId("ARSUB");
      const evidenceFingerprint = ["S001", DATA.product.dashboardVersion, unit.singleBusinessSubjectId, unit.rule.evaluationId, actionType.id, submissionBinding.semanticVersionId, submissionBinding.dataAssetVersionId].join("|");
      const requestTime = nowText();
      const stableEvidenceRefs = [unit.rule.evaluationId, unit.rule.metricId, ...unit.loans.map((item) => item.id)];
      const payload = {
        id: makeId("AR"),
        requestId: null,
        scenarioContext: clone(submissionProjection.scenarioContext),
        scenarioId: submissionProjection.scenarioContext?.scenarioId || null,
        scenarioVersion: submissionProjection.scenarioContext?.scenarioVersion || null,
        scenarioRunId: submissionProjection.scenarioContext?.scenarioRunId || null,
        unit: unitName,
        requestTime,
        sourceType: "report",
        sourceTypeLabel: "报告中心仪表盘",
        sourceRecord: {
          sceneId: "S001",
          dashboardVersion: DATA.product.dashboardVersion,
          componentId: "action-collaboration",
          objectContextId: unit.singleBusinessSubjectId,
        },
        sourceScene: "S001",
        initiator: "财务分析员",
        initiatorId: "USER-FIN-ANALYST-001",
        owner: "决策中心",
        singleBusinessSubject: unitName,
        singleBusinessSubjectId: unit.singleBusinessSubjectId,
        singleBusinessSubjectName: unit.singleBusinessSubjectName || unitName,
        singleBusinessSubjectObjectType: unit.singleBusinessSubjectObjectType,
        actionTypeId: actionType.id,
        actionType: DATA.product.actionType,
        actionTypeVersion: actionType.definitionVersion,
        actionTypePublishedSemanticVersion: actionType.publishedSemanticVersion,
        ruleId: unit.rule.id,
        ruleCode: unit.rule.code,
        ruleName: unit.rule.name,
        ruleVersion: unit.rule.version,
        rulePublishedSemanticVersion: unit.rule.publishedSemanticVersion,
        ruleEvaluationId: unit.rule.evaluationId,
        ruleEvaluatedAt: unit.rule.evaluatedAt,
        ruleResultVersion: unit.rule.resultVersion,
        ruleBranch: unit.rule.branch,
        ruleEvidence: stableEvidenceRefs,
        metricId: unit.rule.metricId,
        metricSnapshot: `${unit.rule.metric} ${unit.rule.metricValue}`,
        metricResultVersion: factPackage.resultVersions?.metric || DATA.product.metricResultVersion,
        metricEvidence: {
          id: unit.rule.metricId,
          name: unit.rule.metric,
          value: unit.rule.metricValue.replace("%", ""),
          unit: "%",
          scope: {
            id: unit.singleBusinessSubjectId,
            name: unit.singleBusinessSubjectName || unitName,
            objectType: unit.singleBusinessSubjectObjectType,
          },
          evaluatedAt: unit.rule.evaluatedAt,
          resultVersion: factPackage.resultVersions?.metric || DATA.product.metricResultVersion,
          triggerExplanation: unit.rule.branch,
          evidenceRefs: stableEvidenceRefs,
        },
        bindingId: submissionBinding.bindingId,
        semanticVersionId: submissionBinding.semanticVersionId,
        semanticVersion: submissionBinding.semanticVersion,
        dataAssetVersionId: submissionBinding.dataAssetVersionId,
        dataVersion: submissionBinding.dataVersion,
        consumableVersionId: submissionBinding.consumableVersionId,
        asOf: submissionBinding.asOf,
        currentTrustSnapshot: clone(currentTrustSummary),
        currentTrustReadAt: submissionProjection.readAt,
        idempotencyKey,
        evidenceFingerprint,
        allowUncertainResult: true,
        preferredInstitutions: unit.institutions.map((item) => item.name),
        candidateLoans: unit.loans.map((item) => item.id),
        recommendedDirection: unit.rule.code === "R01" ? "降息或置换高成本借据" : unit.rule.code === "R02" ? "固定利率、利率上限或重定价条款" : "展期或置换中长期融资",
        returnRoute: "/dashboard/s001?tab=evidence",
        filter: "Rule 与行动",
        returnPosition: "action-collaboration",
      };
      payload.requestId = payload.id;
      payload.actionType = {
        id: actionType.id,
        name: DATA.product.actionType,
        version: actionType.definitionVersion,
        status: "已发布",
        publishedSemanticVersion: actionType.publishedSemanticVersion,
      };
      payload.rule = {
        id: unit.rule.id,
        version: unit.rule.version,
        evaluatedAt: unit.rule.evaluatedAt,
        branch: unit.rule.branch,
        hitEvidence: unit.rule.evaluationId,
      };
      payload.metric = {
        id: unit.rule.metricId,
        name: unit.rule.metric,
        value: unit.rule.metricValue,
      };
      payload.evidence = {
        snapshotId: unit.rule.evaluationId,
        semanticVersion: submissionBinding.semanticVersion,
        dataVersion: submissionBinding.dataVersion,
        cutoff: submissionBinding.asOf,
      };
      state.ui.pendingActionRef = {
        clientSubmissionId: idempotencyKey,
        unit: unitName,
        status: "提交中",
        requestTime,
        payload: clone(payload),
      };
      state.ui.modal = { type: "action-submitting", unit: unitName, ruleCode: unit.rule.code, idempotencyKey };
      commit();
      schedule(() => {
        const external = OWNERS.decision.submitAction(payload);
        if (external.outcome === "rejected") {
          state.ui.pendingActionRef = { ...state.ui.pendingActionRef, receiptId: external.receiptId, status: "失败" };
          state.ui.modal = { type: "action-failed", receipt: external, unit: unitName };
          commit();
          return;
        }
        if (["unknown", "submitted"].includes(external.outcome)) {
          state.ui.pendingActionRef = { ...state.ui.pendingActionRef, receiptId: external.receiptId, status: "结果未知", payload: clone(payload) };
          state.ui.modal = { type: "action-unknown", receipt: { ...external, reason: external.reason || "已提交标准请求，等待决策中心接收后形成 C019 稳定引用。", idempotencyKey }, payload, unit: unitName };
          if (!state.actionRequests.some((item) => item.id === payload.id)) state.actionRequests.unshift({ id: payload.id, scenarioContext: clone(payload.scenarioContext), sourceScene: payload.sourceScene, singleBusinessSubject: payload.singleBusinessSubject, singleBusinessSubjectId: payload.singleBusinessSubjectId, singleBusinessSubjectName: payload.singleBusinessSubjectName, singleBusinessSubjectObjectType: payload.singleBusinessSubjectObjectType, returnRoute: payload.returnRoute, filter: payload.filter, returnPosition: payload.returnPosition, createdAt: payload.requestTime });
          commit();
          return;
        }
        const request = {
          id: external.actionRequestId,
          scenarioContext: clone(payload.scenarioContext),
          sourceScene: payload.sourceScene,
          singleBusinessSubject: payload.singleBusinessSubject,
          singleBusinessSubjectId: payload.singleBusinessSubjectId,
          singleBusinessSubjectName: payload.singleBusinessSubjectName,
          singleBusinessSubjectObjectType: payload.singleBusinessSubjectObjectType,
          returnRoute: payload.returnRoute,
          filter: payload.filter,
          returnPosition: payload.returnPosition,
          createdAt: payload.requestTime || external.acceptedAt,
          acceptedAt: external.acceptedAt,
        };
        if (!state.actionRequests.some((item) => item.id === request.id)) state.actionRequests.unshift(request);
        state.ui.pendingActionRef = null;
        runtimeExternalViews.decisionById.set(request.id, OWNERS.decision.rereadSummary(request.id, {
          returnRoute: payload.returnRoute,
          filter: payload.filter,
          returnPosition: payload.returnPosition,
          sourceScene: payload.sourceScene,
          businessSubject: payload.singleBusinessSubject,
        }));
        state.ui.modal = { type: "action-result", id: request.id, duplicate: external.duplicate === true };
        commit();
      }, 1000);
      return;
    }
    if (action === "resume-action-result") {
      const pending = state.ui.pendingActionRef;
      if (!pending?.clientSubmissionId || !pending?.payload) return toast("原提交恢复信息不完整", "请重新从单一业务主体的 Rule 证据发起请求。", "danger");
      const receipt = {
        receiptId: pending.receiptId || "等待权威核对",
        idempotencyKey: pending.clientSubmissionId,
        outcome: pending.status === "未形成" ? "not_found" : "unknown",
        reason: pending.interruptionReason || "原提交尚未取得明确接收结果。",
      };
      state.ui.modal = {
        type: "action-unknown",
        receipt,
        payload: clone(pending.payload),
        unit: pending.unit,
        checkedAt: pending.checkedAt || null,
        resultConfirmedMissing: pending.status === "未形成",
      };
      return commit();
    }
    if (action === "check-action-result") {
      const modal = state.ui.modal;
      if (modal?.type !== "action-unknown") return;
      const result = OWNERS.decision.getSubmissionResult(modal.payload?.id || modal.payload?.requestId);
      if (result.outcome === "accepted") {
        const payload = modal.payload;
        const request = {
          id: result.actionRequestId,
          scenarioContext: clone(payload.scenarioContext),
          sourceScene: payload.sourceScene,
          singleBusinessSubject: payload.singleBusinessSubject,
          singleBusinessSubjectId: payload.singleBusinessSubjectId,
          singleBusinessSubjectName: payload.singleBusinessSubjectName,
          singleBusinessSubjectObjectType: payload.singleBusinessSubjectObjectType,
          returnRoute: payload.returnRoute,
          filter: payload.filter,
          returnPosition: payload.returnPosition,
          createdAt: payload.requestTime,
          acceptedAt: result.readAt,
        };
        if (!state.actionRequests.some((item) => item.id === request.id)) state.actionRequests.unshift(request);
        state.ui.pendingActionRef = null;
        runtimeExternalViews.decisionById.set(request.id, result.summary);
        state.ui.modal = { type: "action-result", id: request.id, duplicate: true };
        commit();
        return;
      }
      state.ui.pendingActionRef = {
        ...state.ui.pendingActionRef,
        status: "等待决策中心接收",
        checkedAt: result.readAt || nowText(),
      };
      state.ui.modal = {
        ...modal,
        receipt: { ...modal.receipt, ...result },
        checkedAt: result.readAt,
        resultConfirmedMissing: false,
      };
      commit();
      return toast("C019 尚未形成稳定引用", "请求标识已保留；报告中心不会把缺失判为失败，也不会自动重试或创建提醒、待办。", "danger");
    }
    if (action === "reread-decision") {
      const summaries = rereadDecisionSummaries({ returnRoute: "/dashboard/s001?tab=evidence", filter: "Rule 与行动", returnPosition: "action-collaboration", sourceScene: "S001", businessSubject: state.dashboard.scopeId });
      renderApp();
      if (summaries.length) toast("决策摘要已重新读取", `读取时点 ${summaries[0].readAt}；摘要仅保留在当前页面，状态仍由决策中心维护。`, "success");
      else if (currentActionRequests().length) toast("决策记录不可定位", "已保留 Action Request 外部标识；报告中心不会重建提醒、待办或执行状态。", "danger");
      else toast("暂无关联决策记录", "当前场景尚未提交 Action Request。", "success");
      return;
    }
    if (action === "open-external-decision") {
      const request = currentActionRequests().find((item) => item.id === element.dataset.id);
      const payload = actionPayload(request);
      const summary = OWNERS.decision.rereadTargetSummary("Action Request", element.dataset.id, {
        returnRoute: request?.returnRoute || payload.returnRoute,
        filter: request?.filter || payload.filter,
        returnPosition: request?.returnPosition || payload.returnPosition,
        sourceScene: request?.sourceScene || payload.sourceScene,
        businessSubject: request?.singleBusinessSubject || payload.singleBusinessSubject,
      });
      if (!summary?.stableDetailEntry) return toast("稳定详情入口尚未形成", "C019 未返回该 Action Request 的稳定详情入口；保持当前页面并等待重新读取。", "danger");
      state.ui.modal = null;
      state.ui.drawer = null;
      state.ui.pendingScrollAnchor = request?.returnPosition || "action-collaboration";
      state.ui.pendingExternalReturn = {
        owner: "decision",
        requestId: request?.id || element.dataset.id,
        returnRoute: request?.returnRoute || payload.returnRoute || "/dashboard/s001?tab=evidence",
        returnPosition: request?.returnPosition || payload.returnPosition || "action-collaboration",
        filter: request?.filter || payload.filter || "Rule 与行动",
        sourceScene: summary?.sourceScene || request?.sourceScene || payload.sourceScene || "S001",
        businessSubject: summary?.businessSubject || request?.singleBusinessSubjectName || request?.singleBusinessSubject || payload.singleBusinessSubjectName || payload.singleBusinessSubject || payload.unit || "",
        summaryAsOf: summary?.summaryAsOf || null,
      };
      saveState();
      const decisionBase = new URL("../../decision-center-prototype/", window.location.href);
      window.location.assign(new URL(summary.stableDetailEntry, decisionBase).href);
      return;
    }
    if (action === "open-external-decision-target") {
      const targetType = element.dataset.targetType;
      const targetId = element.dataset.id;
      const summary = OWNERS.decision.rereadTargetSummary(targetType, targetId, runtimeExternalViews.decisionNavigation || {});
      if (!summary) return toast("目标不可定位", "决策中心没有返回该稳定详情目标。", "danger");
      if (!summary.stableDetailEntry) return toast("稳定详情入口尚未形成", "决策中心未返回该目标的稳定详情入口。", "danger");
      state.ui.pendingScrollAnchor = summary.returnPosition || "action-collaboration";
      state.ui.pendingExternalReturn = {
        owner: "decision",
        requestId: summary.sourceRequestId || null,
        returnRoute: summary.returnRoute || "/dashboard/s001?tab=evidence",
        returnPosition: summary.returnPosition || "action-collaboration",
        filter: summary.filter || "Rule 与行动",
        sourceScene: summary.sourceScene || "S001",
        businessSubject: summary.businessSubject || null,
        summaryAsOf: summary.summaryAsOf || null,
      };
      saveState();
      const decisionBase = new URL("../../decision-center-prototype/", window.location.href);
      window.location.assign(new URL(summary.stableDetailEntry, decisionBase).href);
      return;
    }
    if (action === "open-external-agent") {
      const report = readingReport();
      const returnRoute = element.dataset.return || (["published", "withdrawn"].includes(report.stage) ? "/reports/view" : "/reports/draft");
      const external = OWNERS.agent.getC025?.(element.dataset.id);
      state.ui.modal = null;
      state.ui.drawer = null;
      state.ui.pendingScrollAnchor = element.dataset.position || state.assistant.selectedAnchor || state.assistant.selectedSection || "report-cover";
      state.ui.pendingExternalReturn = {
        owner: "agent",
        requestId: external?.requestId || state.assistant.requestRef?.requestId || element.dataset.id,
        returnRoute,
        returnPosition: state.ui.pendingScrollAnchor,
        assistantTab: state.assistant.tab,
      };
      saveState();
      const target = external?.auditRoute || `../../agent-application/Agent应用.html#/runs/${encodeURIComponent(element.dataset.id)}`;
      window.location.assign(new URL(target, window.location.href).href);
      return;
    }
    if (action === "open-ask") {
      const selectedUnit = state.dashboard.scopeType === "unit" ? currentFactPackage()?.units?.[state.dashboard.scopeId] : null;
      const query = new URLSearchParams({
        return: "/dashboard/s001?tab=overview",
        filter: "融资概览",
        position: "dashboard-overview",
        scene: "S001",
        context: element.dataset.context || state.dashboard.scopeId,
        subject: state.dashboard.scopeId,
        subjectId: selectedUnit?.singleBusinessSubjectId || "",
        subjectType: selectedUnit?.singleBusinessSubjectObjectType || state.dashboard.scopeType,
        asOf: currentAuthority().asOf || "",
      });
      return navigate(`/external/ask/${encodeURIComponent(element.dataset.context || state.dashboard.scopeId)}?${query.toString()}`);
    }
    if (action === "external-return") {
      state.ui.pendingScrollAnchor = element.dataset.position || null;
      const assistantTab = routeInfo().query.get("assistantTab");
      if (assistantTab === "qa" || assistantTab === "verification") state.assistant.tab = assistantTab;
      runtimeExternalViews.decisionNavigation = {
        returnRoute: element.dataset.route,
        filter: element.dataset.filter || null,
        returnPosition: element.dataset.position || null,
        sourceScene: element.dataset.scene || null,
        businessSubject: element.dataset.subject || null,
        businessSubjectId: element.dataset.subjectId || null,
        businessSubjectObjectType: element.dataset.subjectType || null,
        summaryAsOf: element.dataset.asOf || null,
      };
      navigate(element.dataset.route);
      return;
    }
    if (action === "generate-insight") {
      if (!currentFactsAreUsable()) return toast("当前上下文不能生成洞察", factPackageIsAvailable(currentFactPackage()) ? currentTrust().recoveryAdvice : "当前精确事实包不可定位。", "danger");
      const external = OWNERS.agent.submitInsight({
        sceneId: "S001",
        scopeType: state.dashboard.scopeType,
        scopeId: state.dashboard.scopeId,
        semanticBinding: clone(currentAuthority()),
        factPackageId: currentFactPackage().packageId,
      });
      if (!external?.runId) {
        return toast("等待 Agent 应用接入", "当前未取得真实 C020 Agent Run；报告中心未创建本地运行或洞察结果。", "danger");
      }
      state.insight = {
        requestId: external.requestId,
        resultId: null,
        runId: external.runId,
        sessionId: external.sessionId,
        bindingId: external.bindingId,
        confirmationRequestId: null,
        submittedAt: external.submittedAt,
        bindingSnapshot: clone(currentAuthority()),
        referenced: state.insight.referenced,
      };
      commit();
      return;
    }
    if (action === "reread-insight") {
      if (!state.insight.runId) return;
      const external = OWNERS.agent.getInsight(state.insight.runId);
      renderApp();
      toast(external ? "Agent 结果已重新读取" : "Agent 记录不可定位", external ? "洞察正文和运行状态仅在当前页面展示。" : "报告中心不会根据外部标识重建洞察结果或运行状态。", external ? "success" : "danger");
      return;
    }
    if (action === "request-insight-confirm") {
      const external = OWNERS.agent.requestInsightConfirmation(state.insight.runId, { contentStatus: "确认中" });
      if (!external) return toast("Agent 确认请求未形成", "请在 Agent 应用恢复真实运行后重新读取；报告中心未补造确认状态。", "danger");
      state.insight.confirmationRequestId = external?.confirmationRequestId || null;
      commit();
      return;
    }
    if (action === "toggle-insight-reference") { state.insight.referenced = !state.insight.referenced; commit(); toast(state.insight.referenced ? "已引用到驾驶舱" : "已停止引用", "Agent 内容确认与新鲜度状态未改变。", "success"); return; }
    if (action === "open-definition") { state.ui.drawer = { type: "definition", id: element.dataset.id }; return commit(); }
    if (action === "open-template") { state.ui.drawer = { type: "template", id: element.dataset.id }; return commit(); }
    if (action === "open-new-definition") { state.ui.tempDefinitionName = ""; state.ui.tempDefinitionPurpose = ""; state.ui.modal = { type: "new-definition" }; return commit(); }
    if (action === "save-new-definition") {
      if (!state.ui.tempDefinitionName.trim() || !state.ui.tempDefinitionPurpose.trim()) return toast("请补齐名称和业务目的", "缺少必填内容时不能保存报告定义。", "danger");
      state.customDefinitions.push({ id: makeId("RD"), name: state.ui.tempDefinitionName.trim(), purpose: state.ui.tempDefinitionPurpose.trim(), audience: "集团财务管理者", version: "0.1.0", template: "融资经营分析模板 2.2.0", evidence: "待补充", agent: "待选择", validation: "待补充", review: "待补充", publish: "待补充", status: "编辑中" });
      state.ui.modal = null;
      commit();
      toast("报告定义已保存", "当前状态为编辑中，完成校验前不会进入可生成目录。", "success");
      return;
    }
    if (action === "open-generation-modal") {
      state.wizard = { ...newState().wizard, step: state.report.stage === "evidence_missing" ? 5 : 1 };
      state.ui.modal = { type: "generation" };
      return commit();
    }
    if (action === "select-report-type") { state.wizard.reportType = element.dataset.value; return commit(); }
    if (action === "wizard-prev") { state.wizard.step = Math.max(1, state.wizard.step - 1); return commit(); }
    if (action === "wizard-next") {
      if (!wizardCanAdvance()) return toast("当前步骤尚未完成", state.wizard.step === 4 ? "请先验证数据上下文。" : "请完成必填选择。", "danger");
      state.wizard.step = Math.min(6, state.wizard.step + 1);
      return commit();
    }
    if (action === "select-data-context") {
      state.wizard.dataContext = "current";
      state.wizard.compatibility = "idle";
      return commit();
    }
    if (action === "validate-data-context") {
      state.wizard.compatibility = "checking";
      commit();
      schedule(() => {
        const projection = readCurrentTrustProjection("创建报告时重新读取统一 C008/C017 投影");
        runtimeExternalViews.trust = projection;
        const gate = generationGateOutcome(projection);
        state.wizard.dataContext = "current";
        state.wizard.compatibility = gate.allowed ? "compatible" : "blocked";
        state.wizard.compatibilityReason = gate.reason || null;
        commit();
      }, 900);
      return;
    }
    if (action === "submit-generation") {
      if (state.wizard.step !== 6 || state.wizard.compatibility !== "compatible") return toast("生成上下文尚未就绪", "返回数据上下文步骤重新读取当前权威状态。", "danger");
      state.report.generationMode = state.wizard.generationMode;
      return beginGeneration(state.wizard.generationMode);
    }
    if (action === "retry-standard-generation") { state.report.generationMode = "standard"; return beginGeneration("standard", false, null, { reuseAggregate: true }); }
    if (action === "retry-blocked-generation") {
      const block = state.report.generationBlock;
      if (!block) return;
      if (block.isReplacement && state.regenerationRequest) {
        state.regenerationRequest.status = "未开始";
        state.regenerationRequest.blockReason = null;
        state.regenerationRequest.blockedAt = null;
        state.regenerationRequest.currentSummaryId = null;
        state.regenerationRequest.currentSummaryVersion = null;
        state.regenerationRequest.newEvidencePackFormed = false;
        state.regenerationRequest.agentRunSubmitted = false;
        state.report = state.publishedReports.find((item) => item.reportNo === state.regenerationRequest.sourceReportNo) || state.report;
        state.report.generationBlock = null;
        commit(false);
        return handleAction(Object.assign(document.createElement("button"), { dataset: { action: "start-pending-regeneration" } }));
      }
      return beginGeneration(state.report.generationMode || "standard", Boolean(block.isRevision), block.requestId || state.report.requestId, { reuseAggregate: true });
    }
    if (action === "retry-generation") {
      return startAgentGeneration(Boolean(state.report.revisionNumber), state.report.revisionNumber, state.report.generationRunId || null);
    }
    if (action === "reread-generation") return completeAgentGeneration();
    if (action === "open-trace") { state.ui.drawer = { type: "trace" }; return commit(); }
    if (action === "resolve-history-semantics") {
      const report = readingReport();
      const binding = bindingFor(report);
      const key = report.reportNo || report.draftId || report.aggregateId;
      const readCount = Number(runtimeExternalViews.historyReadCountByReport.get(key) || 0) + 1;
      runtimeExternalViews.historyReadCountByReport.set(key, readCount);
      runtimeExternalViews.historySemanticByReport.set(key, { status: "checking", requestedAt: nowText(), readCount, semanticVersionId: binding.semanticVersionId });
      renderApp();
      schedule(() => {
        const status = report.replacedByReportNo ? "missing" : "resolved";
        const readAt = nowText();
        runtimeExternalViews.historySemanticByReport.set(key, { status, readAt, readCount, semanticVersionId: binding.semanticVersionId });
        renderApp();
        toast(status === "missing" ? "历史资源不可定位" : "历史语义已重新读取", status === "missing" ? "本体管理返回未定位；冻结报告未改变。" : "按 C026 只读返回生成时 Published 版本；冻结报告未改变。", status === "missing" ? "danger" : "success");
      }, 900);
      return;
    }
    if (action === "jump-section") {
      state.assistant.selectedSection = element.dataset.section;
      state.ui.pendingScrollAnchor = element.dataset.section;
      return commit();
    }
    if (action === "select-anchor" || action === "jump-anchor") {
      const anchor = element.dataset.anchor;
      state.assistant.selectedAnchor = anchor;
      state.ui.pendingScrollAnchor = anchor;
      if (action === "select-anchor") state.ui.drawer = { type: "anchor-evidence", anchor };
      return commit();
    }
    if (action === "open-anchor-evidence") { state.ui.drawer = { type: "anchor-evidence", anchor: element.dataset.anchor }; return commit(); }
    if (action === "set-assistant-tab") { state.assistant.tab = element.dataset.tab; return commit(); }
    if (action === "ask-suggestion") { state.assistant.qaDraft = element.dataset.question; return commit(); }
    if (action === "ask-report") {
      const question = state.assistant.qaDraft.trim();
      if (!question) return toast("请输入问题", "助手只会基于当前报告版本和证据包回答。", "danger");
      const c024Request = {
        requestId: makeId("C024"),
        question,
        selectedAnchor: state.assistant.selectedAnchor,
        evidencePackId: readingReport().evidencePackId,
        reportContentVersion: readingReport().contentVersion || readingReport().draftVersion,
        semanticResolution: semanticResolutionFor(readingReport()),
        reportContext: reportContextForQA(readingReport(), { intent: "report-qa-fixed" }),
      };
      if (!publishC024Request(c024Request)) return toast("报告伴读请求已阻断", "报告编号、内容版本、证据包、C033 或精确语义/数据版本不完整或错配；未向 Agent 应用交付。", "danger");
      state.assistant.qaDraft = "";
      const external = OWNERS.agent.submitQA(c024Request);
      if (external?.status === "已拒绝") return toast("报告伴读请求已拒绝", external?.failure || "C024 固定身份不完整或与当前场景轮次不一致。", "danger");
      state.assistant.requestRef = {
        requestId: c024Request.requestId,
        scenarioContext: clone(readingReport().scenarioContext),
        reportNo: readingReport().reportNo || readingReport().draftId,
        contentVersion: readingReport().contentVersion || readingReport().draftVersion,
        evidencePackVersion: evidencePackFor(readingReport())?.version || null,
        selectedAnchor: state.assistant.selectedAnchor,
        evidencePackId: readingReport().evidencePackId,
        submittedAt: external?.submittedAt || nowText(),
        sessionId: external?.sessionId || null,
        bindingId: external?.bindingId || null,
        runId: external?.runId || null,
        resultId: external?.resultId || null,
      };
      commit();
      return toast("报告伴读请求已交付", "已向 Agent 应用提交 C024；Binding、Session、Run 和 Result 仅在 M05 实际接收和运行后回读。", "success");
    }
    if (action === "reread-agent-result") {
      const ref = state.assistant.requestRef;
      if (!ref) return;
      const external = OWNERS.agent.getQA(ref.requestId || ref.runId);
      syncAgentReference(ref, external);
      commit();
      toast(external?.status === "已完成" ? "Agent 结果已重新读取" : external ? "Agent 请求状态已重新读取" : "Agent 记录不可定位", external?.status === "已完成" ? "答案仅在当前页面显示，报告中心未保存消息或运行状态副本。" : external ? `当前状态：${external.status}。` : "保留请求与外部标识，等待 Agent 应用恢复权威记录。", external ? "success" : "danger");
      return;
    }
    if (action === "set-verification-scope") { verificationForWrite(readingReport()).scope = element.dataset.scope; return commit(); }
    if (action === "prepare-full-verification") {
      const report = readingReport();
      if (["published", "withdrawn"].includes(report.stage)) report.postPublicationVerification = { ...freshVerification(), scope: "整份报告" };
      else report.verification = { ...freshVerification(), scope: "整份报告" };
      return commit();
    }
    if (action === "start-verification") {
      const report = readingReport();
      if (!resourceInCurrentScenario(report)) return toast("当前报告不属于本场景轮次", "请从对应场景历史入口读取；本轮不写入核验记录。", "danger");
      const v = verificationForWrite(report);
      const verificationProjection = readCurrentTrustProjection("T049 核验运行开始时独立读取并固定 C008/C017");
      const previousRunId = v.runId;
      if (previousRunId) archiveVerificationRun(report, v);
      const scopeContext = freezeVerificationScope(report);
      const scopeAnchors = anchorsForScope(report, scopeContext);
      const planSnapshot = clone(verificationPlanForScope(report, scopeContext));
      v.attempt = Number(v.attempt || 0) + 1;
      v.retryOf = previousRunId;
      v.status = "queued"; v.progress = 4; v.runId = makeId("VRF"); v.results = []; v.completedAt = null;
      v.explanationRequestId = null; v.explanationRunId = null; v.explanationResultId = null; v.explanationReadAt = null;
      v.scopeContext = scopeContext;
      v.runScope = scopeContext.scope;
      v.factCount = new Set(scopeAnchors.flatMap((anchor) => anchor.factRefs || [])).size;
      v.anchorCount = scopeAnchors.length;
      v.evidencePackId = report.evidencePackId;
      v.reportEvidenceVersion = DATA.reportEvidence.schemaVersion;
      v.planVersion = DATA.reportEvidence.verificationRuleVersion;
      v.planSnapshot = planSnapshot;
      v.currentStatusSummary = clone(verificationProjection.trust);
      v.currentBindingSnapshot = clone(verificationProjection.binding);
      v.currentStatusReadAt = verificationProjection.readAt;
      v.scenarioContext = clone(report.scenarioContext);
      v.unitResults = planSnapshot.map((unit) => ({ ...unit, status: null, applicability: "applicable", executionState: "pending" }));
      v.coverage = coverageForPlan(report, scopeContext, false, 4, 0, planSnapshot);
      commit();
      schedule(() => { v.status = "running"; v.progress = 36; v.coverage = coverageForPlan(report, scopeContext, false, 36, 0, planSnapshot); commit(); }, 500);
      schedule(() => { v.progress = 74; v.coverage = coverageForPlan(report, scopeContext, false, 74, 0, planSnapshot); commit(); }, 1100);
      schedule(() => {
        if (v.attempt === 1) {
          v.status = "run_failed";
          v.coverage = coverageForPlan(report, scopeContext, false, v.progress, 1, planSnapshot);
          commit();
          toast("核验运行失败", "证据包读取超时；未形成确定性四态，可发起新运行重试。", "danger");
          return;
        }
        v.status = "completed";
        v.progress = 100;
        v.unitResults = verificationUnitResults(report, scopeContext, planSnapshot, v.currentStatusSummary);
        v.results = verificationResults(scopeContext, v.unitResults);
        v.coverage = coverageFromUnitResults(report, scopeContext, planSnapshot, v.unitResults);
        v.completedAt = nowText();
        archiveVerificationRun(report, v);
        commit();
        const runScope = frozenVerificationScope(v);
        const isFull = isFullVerificationCoverage(report, v);
        const blocked = v.results.some((result) => ["fail", "unverifiable"].includes(result.status));
        toast("自动核验已完成", !isFull ? `${runScope}核验完成；部分范围不能解锁人工确认。` : blocked ? "发现阻断项，不能确认草稿。" : "整份报告覆盖完整，必需检查项没有阻断。", !isFull ? "" : blocked ? "danger" : "success");
      }, 1800);
      return;
    }
    if (action === "set-verification-filter") { verificationForWrite(readingReport()).filter = element.dataset.filter; return commit(); }
    if (action === "start-explanation") {
      const report = readingReport();
      const v = verificationForWrite(report);
      const c024Request = {
        requestId: makeId("C024"),
        question: "请解释当前 T049 确定性核验结果中的差异、限制和建议处理方式。",
        selectedAnchor: state.assistant.selectedAnchor,
        evidencePackId: report.evidencePackId,
        reportContentVersion: report.contentVersion || report.draftVersion,
        verificationRunId: v.runId,
        results: clone(v.results),
        contentVersion: report.contentVersion,
        reportContext: reportContextForQA(report, { intent: "t049-explanation", verification: v }),
      };
      if (!publishC024Request(c024Request)) return toast("差异解释请求已阻断", "T049 所属报告身份、证据包、C033 或精确语义/数据版本不完整或错配；未向 Agent 应用交付。", "danger");
      const external = OWNERS.agent.submitExplanation(c024Request);
      if (external?.status === "已拒绝") return toast("差异解释请求已拒绝", external?.failure || "C024 固定身份不完整或与当前场景轮次不一致。", "danger");
      v.explanationRequestId = c024Request.requestId;
      v.explanationRunId = external?.runId || null;
      v.explanationResultId = external?.resultId || null;
      v.explanationSubmittedAt = external?.submittedAt || nowText();
      v.explanationReadAt = null;
      syncVerificationArchiveReferences(report, v);
      commit();
      return toast("差异解释请求已交付", "确定性四态保持不变；解释仅在 Agent 应用实际运行后回读。", "success");
    }
    if (action === "reread-explanation") {
      const report = readingReport();
      const v = verificationForWrite(report);
      if (!v.explanationRequestId && !v.explanationRunId) return;
      const external = OWNERS.agent.getExplanation(v.explanationRequestId || v.explanationRunId);
      v.explanationRunId = external?.runId || v.explanationRunId;
      v.explanationResultId = external?.resultId || v.explanationResultId;
      v.explanationReadAt = external?.readAt || v.explanationReadAt;
      syncVerificationArchiveReferences(report, v);
      commit();
      toast(external ? "差异解释已重新读取" : "Agent 解释记录不可定位", external ? "正文由 Agent 应用返回，确定性四态未改变。" : "报告中心不会根据 T049 结果重建 LLM 解释正文。", external ? "success" : "danger");
      return;
    }
    if (action === "create-verification-issues") {
      const report = readingReport();
      const v = activeVerification(report);
      const blocking = v.results.filter((item) => item.status === "fail" || item.status === "unverifiable");
      blocking.forEach((item) => {
        if (!report.issues.some((issue) => issue.sourceId === item.id && isOpenIssue(issue))) report.issues.push({ id: makeId("RI"), sourceId: item.id, sourceRunId: v.runId, contentVersion: report.contentVersion, anchor: item.anchor, title: item.name, status: "待处理", createdAt: nowText(), closedAt: null, closedBy: null, closeBasis: null });
      });
      commit();
      toast("复核问题已创建", `${blocking.length} 项问题已关联核验结果和报告位置。`, "success");
      return;
    }
    if (action === "close-resolved-issues") {
      const report = readingReport();
      const v = activeVerification(report);
      if (v.status !== "completed" || v.results.some((item) => item.status === "fail" || item.status === "unverifiable")) {
        return toast("问题尚不能关闭", "当前内容版本仍有失败或无法核验项。", "danger");
      }
      const closedAt = nowText();
      report.issues = report.issues.map((issue) => isOpenIssue(issue) ? { ...issue, status: "已核对关闭", closedAt, closedBy: "财务分析员", closeBasis: `内容版本 ${report.contentVersion} · 核验 Run ${v.runId}` } : issue);
      recordReviewEvent(report, "问题关闭", { reviewer: "财务分析员", note: `依据 ${v.runId} 核对当前内容版本` });
      commit(); toast("复核问题已关闭", "已记录关闭人、时间及当前核验 Run；发布不会自动改变问题状态。", "success"); return;
    }
    if (action === "create-comparison-issue") {
      const report = readingReport();
      report.issues.push({ id: makeId("RI"), sourceId: report.comparison.recordId, anchor: "metric-balance", title: "报告快照与当前数据差异", status: "待处理", createdAt: nowText() });
      commit(); toast("复核问题已创建", "原报告和比较记录均保持不变。", "success"); return;
    }
    if (action === "start-comparison-explanation") {
      const report = readingReport();
      const comparison = report.comparison;
      if (comparison.status !== "completed" || comparison.gate !== "允许结构化事实比较" || !comparison.recordId) return toast("当前比较不能解释", "请先完成通过比较门的显式快照比较。", "danger");
      const c024Request = {
        requestId: makeId("C024"),
        question: "请解释该报告快照与当前数据比较记录中的差异。",
        selectedAnchor: state.assistant.selectedAnchor,
        evidencePackId: report.evidencePackId,
        reportContentVersion: report.contentVersion || report.draftVersion,
        semanticResolution: semanticResolutionFor(report),
        reportContext: reportContextForQA(report, { intent: "c027-explanation", comparison }),
      };
      if (!publishC024Request(c024Request)) return toast("比较解释请求已阻断", "C027 所属报告身份、证据包、C033 或精确语义/数据版本不完整或错配；未向 Agent 应用交付。", "danger");
      const external = OWNERS.agent.submitQA(c024Request);
      if (external?.status === "已拒绝") return toast("比较解释请求已拒绝", external?.failure || "C024 固定身份不完整或与当前场景轮次不一致。", "danger");
      comparison.explanationRequestId = c024Request.requestId;
      comparison.explanationRunId = external?.runId || null;
      comparison.explanationResultId = external?.resultId || null;
      comparison.explanationSubmittedAt = external?.submittedAt || nowText();
      comparison.explanationReadAt = null;
      syncComparisonRecordReferences(report, comparison);
      commit();
      return toast("比较解释请求已交付", "C027 确定性比较记录保持不变；解释仅在 M05 形成 Run 与 Result 后回读。", "success");
    }
    if (action === "reread-comparison-explanation") {
      const comparison = readingReport().comparison;
      if (!comparison.explanationRequestId && !comparison.explanationRunId) return;
      const external = OWNERS.agent.getQA(comparison.explanationRequestId || comparison.explanationRunId);
      if (external?.runId) comparison.explanationRunId = external.runId;
      if (external?.resultId) comparison.explanationResultId = external.resultId;
      comparison.explanationReadAt = external?.readAt || nowText();
      syncComparisonRecordReferences(readingReport(), comparison);
      commit();
      toast(external ? "比较解释已重新读取" : "Agent 解释记录不可定位", external ? "确定性比较记录保持不变。" : "报告中心未重建解释正文或运行状态。", external ? "success" : "danger");
      return;
    }
    if (action === "reread-comparison-record-explanation") {
      const report = readingReport();
      const record = (report.comparisonRecords || []).find((item) => item.recordId === element.dataset.id);
      if (!record) return toast("比较记录不可定位", "未修改任何历史比较结果。", "danger");
      const external = OWNERS.agent.getByComparisonRecord?.(record.recordId)
        || OWNERS.agent.getQA(record.explanationRequestId || record.explanationRunId);
      if (!external) return toast("Agent 解释记录不可定位", "历史比较结果保持不变；请在 Agent 应用完成该请求后重试。", "danger");
      record.explanationRunId = external.runId || record.explanationRunId || null;
      record.explanationResultId = external.resultId || record.explanationResultId || null;
      record.explanationReadAt = external.readAt || nowText();
      if (report.comparison?.recordId === record.recordId) Object.assign(report.comparison, {
        explanationRunId: record.explanationRunId,
        explanationResultId: record.explanationResultId,
        explanationReadAt: record.explanationReadAt,
      });
      commit();
      toast(external.status === "已完成" ? "比较解释已重新读取" : "Agent 解释尚未完成", external.status === "已完成" ? "仅补充 Run、Result 与读取时点；原确定性比较结果未修改。" : "报告中心未补造解释结果或运行状态。", external.status === "已完成" ? "success" : "danger");
      return;
    }
    if (action === "open-return") { state.ui.modal = { type: "return" }; return commit(); }
    if (action === "submit-return") {
      if (!state.report.issues.some(isOpenIssue)) state.report.issues.push({ id: makeId("RI"), sourceId: "manual-review", contentVersion: state.report.contentVersion, anchor: state.assistant.selectedAnchor, title: "人工复核退回", status: "待处理", createdAt: nowText(), closedAt: null, closedBy: null, closeBasis: null });
      state.report.stage = "returned"; state.report.returnedAt = nowText(); state.report.humanReview = { status: "returned", contentVersion: state.report.contentVersion, reviewer: "财务分析员", completedAt: state.report.returnedAt, note: document.getElementById("return-note")?.value?.trim() || "退回修订" }; state.ui.modal = null;
      const content = currentContentRecord(state.report); if (content) content.status = "已退回";
      recordReviewEvent(state.report, "退回", { reviewer: "财务分析员", note: state.report.humanReview.note });
      commit(); toast("草稿已退回", "原草稿与核验结果已保留，可重新生成新版本。", "success"); return;
    }
    if (action === "regenerate-report") { navigate("/reports/generate"); return beginGeneration("standard", true); }
    if (action === "confirm-draft") {
      const trustGate = readReportTrustGate(state.report, "草稿确认前重新读取 C017 后续质量事实");
      if (!trustGate.allowed) {
        state.assistant.tab = "verification";
        commit();
        return toast("当前草稿不能确认", `${trustGate.reason || "C017 当前状态或精确版本身份不可确认"}。请重新读取权威状态并基于获准组合处理。`, "danger");
      }
      if (state.report.issues.some(isOpenIssue)) {
        state.assistant.tab = "verification";
        commit();
        return toast("仍有复核问题未关闭", "问题必须由人工核对并记录关闭依据，发布不会自动关闭问题。", "danger");
      }
      if (!canConfirmDraft()) {
        state.assistant.tab = "verification";
        commit();
        return toast("当前不能确认草稿", "需先完成确定性核验，并处理失败或无法核验的必需项。", "danger");
      }
      state.report.stage = "confirmed"; state.report.confirmedAt = nowText();
      state.report.humanReview = { status: "confirmed", contentVersion: state.report.contentVersion, reviewer: "财务分析员", completedAt: state.report.confirmedAt, note: "已核对自动核验结果与报告正文，同意发布当前内容版本。" };
      const content = currentContentRecord(state.report); if (content) content.status = "已确认";
      recordReviewEvent(state.report, "确认", { reviewer: "财务分析员", note: state.report.humanReview.note });
      commit(); toast("草稿已确认", "确认只作用于当前内容版本，尚未发布正式报告。", "success"); return;
    }
    if (action === "cancel-confirmation") { recordReviewEvent(state.report, "取消确认", { reviewer: "财务分析员" }); state.report.stage = "draft"; state.report.confirmedAt = null; state.report.humanReview = { ...freshHumanReview(), contentVersion: state.report.contentVersion }; commit(); toast("已取消确认", "草稿内容与核验记录保持不变。", "success"); return; }
    if (action === "open-publish") { state.ui.modal = { type: "publish" }; return commit(); }
    if (action === "submit-publish") return performPublish(false);
    if (action === "retry-publish") return performPublish(true);
    if (action === "open-pdf") return navigate("/reports/pdf");
    if (action === "print-report") { window.print(); return; }
    if (action === "open-withdraw") { state.ui.modal = { type: "withdraw" }; return commit(); }
    if (action === "confirm-withdraw") {
      const report = readingReport();
      const withdrawnAt = nowText();
      const withdrawal = { stage: "withdrawn", withdrawnAt, withdrawalReason: document.getElementById("withdraw-reason")?.value?.trim() || "目录引用撤回" };
      updatePublishedLifecycle(report.reportNo, withdrawal);
      if (state.report.reportNo === report.reportNo) Object.assign(state.report, withdrawal);
      if (!state.withdrawnReports.includes(report.reportNo)) state.withdrawnReports.push(report.reportNo);
      state.ui.modal = null;
      commit();
      toast("正式报告已撤回", "目录引用已撤回，固定产物和历史证据仍可追溯。", "success");
      return;
    }
    if (action === "open-export") { state.ui.exportFormat = "pdf"; state.ui.modal = { type: "export" }; return commit(); }
    if (action === "submit-export") {
      const report = readingReport();
      const evidencePack = evidencePackFor(report);
      const binding = bindingFor(report);
      const manifest = report.artifactManifest || {};
      const task = { scenarioContext: clone(report.scenarioContext), id: makeId("EXP"), reportNo: report.reportNo, contentVersion: report.contentVersion, evidencePackId: report.evidencePackId, evidencePackVersion: evidencePack?.version || null, semanticVersionId: binding.semanticVersionId || null, semanticVersion: binding.semanticVersion || null, dataAssetVersionId: binding.dataAssetVersionId || null, dataVersion: binding.dataVersion || null, consumableVersionId: binding.consumableVersionId || null, asOf: binding.asOf || null, versionBindingSummaryId: manifest.versionBindingSummaryId || null, versionBindingSummaryVersion: manifest.versionBindingSummaryVersion || null, versionBindingSummaryFormedAt: manifest.versionBindingSummaryFormedAt || null, format: state.ui.exportFormat || "pdf", status: "未开始", attempt: 0, createdAt: nowText() };
      state.exportTasks.unshift(task);
      return runExport(task, false);
    }
    if (action === "retry-export") {
      const task = state.exportTasks.find((item) => item.id === element.dataset.id && resourceInCurrentScenario(item));
      if (task) return runExport(task, true);
      return toast("导出任务不存在", "重新打开导出面板创建新任务。", "danger");
    }
    if (action === "download-export") {
      const task = state.exportTasks.find((item) => item.id === element.dataset.id && resourceInCurrentScenario(item));
      if (!task?.file || task.status !== "成功") return toast("导出文件尚未就绪", "请先完成导出任务。", "danger");
      const payload = task.file.encoding === "base64" ? Uint8Array.from(window.atob(task.file.content), (char) => char.charCodeAt(0)) : task.file.content;
      const blob = new Blob([payload], { type: task.file.mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = task.file.name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      task.downloadedAt = nowText(); state.ui.modal = null; commit(); toast("文件已下载", task.file.name, "success"); return;
    }
    if (action === "open-export-pdf") {
      const task = state.exportTasks.find((item) => item.id === element.dataset.id && resourceInCurrentScenario(item));
      if (!task?.presentationRoute || task.status !== "成功" || task.format !== "pdf") return toast("PDF 固定版尚未就绪", "请先完成导出任务。", "danger");
      state.ui.modal = null; task.openedAt = nowText(); commit(false); return navigate("/reports/pdf");
    }
    if (action === "request-regeneration") { state.ui.modal = { type: "regenerate" }; return commit(); }
    if (action === "start-regeneration-from-published") {
      state.ui.modal = null;
      const oldReportNo = readingReport().reportNo;
      state.regenerationRequest = { scenarioContext: clone(readingReport().scenarioContext), id: makeId("RGEN"), sourceReportNo: oldReportNo, createdAt: nowText(), status: "未开始" };
      state.ui.viewingReportNo = null;
      commit(); navigate("/reports/generate"); toast("新生成请求已创建", `原报告 ${oldReportNo} 保持冻结。`, "success"); return;
    }
    if (action === "start-pending-regeneration") {
      const pending = state.regenerationRequest;
      if (!pending) return;
      const fresh = newReportRecord();
      state.report = { ...fresh, replacedReportNo: pending.sourceReportNo };
      state.assistant = newState().assistant;
      state.ui.viewingReportNo = null;
      return beginGeneration("standard", false, pending.id, { reuseAggregate: true });
    }
    if (action === "start-current-comparison") {
      state.assistant.tab = "verification";
      const report = readingReport();
      const comparisonProjection = readCurrentTrustProjection("C027 比较运行开始时独立读取并固定 C008/C017");
      const comparisonBinding = comparisonProjection.binding;
      const comparisonTrust = comparisonProjection.trust;
      const comparisonGate = generationGateOutcome(comparisonProjection);
      const comparison = {
        ...freshComparison(),
        scenarioContext: clone(report.scenarioContext),
        status: "running",
        recordId: makeId("CMP"),
        reportSnapshot: clone(bindingFor(report)),
        reportFactPackage: clone(factPackageForReport(report)),
        reportTrust: clone(reportBindingSummary(report)),
        currentVersion: comparisonBinding?.dataVersion || null,
        currentBinding: clone(comparisonBinding),
        currentTrust: clone(comparisonTrust),
        currentFactPackage: clone(factPackageForBinding(comparisonBinding)),
        candidateSnapshot: clone(comparisonProjection.candidate || null),
        dataPreviousSnapshot: clone(comparisonProjection.dataPreviousVersion || null),
        previousAuthoritativeSnapshot: clone(comparisonProjection.previousTrustedCombination || null),
        compatibility: comparisonBinding?.compatibility || "不可定位",
        permission: "获准读取报告绑定范围",
        gate: "读取中",
        currentStatusReadAt: comparisonProjection.readAt,
      };
      report.comparison = comparison;
      commit();
      schedule(() => {
        comparison.status = "completed";
        comparison.comparedAt = nowText();
        const outcome = comparisonGate.allowed
          ? comparisonOutcomeFor(comparison)
          : { outcome: "无法比较", reason: comparisonGate.reason, canCompare: false };
        comparison.comparisonOutcome = outcome.outcome;
        comparison.comparisonOutcomeReason = outcome.reason;
        comparison.gate = outcome.canCompare ? "允许结构化事实比较" : "无法比较";
        comparison.limitation = outcome.reason;
        comparison.results = outcome.canCompare ? buildComparisonResults(comparison.reportFactPackage, comparison.currentFactPackage) : [];
        comparison.counts = comparison.results.reduce((acc, item) => { acc[item.status] += 1; return acc; }, { same: 0, changed: 0, unverifiable: 0 });
        markPriorComparisonRecordsStale(report, comparison.recordId, comparison.comparedAt);
        report.comparison = comparison;
        report.comparisonRecords.unshift(clone(comparison));
        commit();
      }, 1300);
      return;
    }
    if (action === "close-comparison") { readingReport().comparison = freshComparison(); return commit(); }
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element) {
      if (state.ui.readerMoreOpen) {
        state.ui.readerMoreOpen = false;
        renderApp();
      }
      return;
    }
    event.preventDefault();
    handleAction(element);
  });

  document.addEventListener("change", (event) => {
    const element = event.target.closest("[data-change]");
    if (!element) return;
    const type = element.dataset.change;
    if (type === "scope-id") { state.dashboard.scopeId = element.value; commit(); }
    else if (type === "generation-mode") { state.report.generationMode = element.value; commit(); }
    else if (type === "wizard-generation-mode") { state.wizard.generationMode = element.value; commit(); }
    else if (type === "catalog-status") { state.catalog.status = element.value; commit(); }
    else if (type === "action-unit") { state.ui.actionUnit = element.value; commit(); }
    else if (type === "export-format") { state.ui.exportFormat = element.value; commit(); }
    else if (type === "s003-result-sort" && s003ScenarioSelected()) {
      s003Dashboard.sortKey = element.value;
      renderApp();
    } else if (type === "s003-run-selection" && s003ScenarioSelected()) {
      const selected = s003RunOptions().find((run) => run.runId === element.value);
      if (!selected) return;
      s003Dashboard.selectedRunId = selected.runId;
      s003Dashboard.resources = s003ResourcesForRun(selected.runId);
      const ids = new Set((s003Dashboard.resources?.results?.results || []).map((record) => record.enterprise?.enterpriseId));
      if (!ids.has(s003Dashboard.selectedEnterpriseId)) s003Dashboard.selectedEnterpriseId = s003Dashboard.resources?.results?.results?.[0]?.enterprise?.enterpriseId || null;
      renderApp();
    }
  });

  document.addEventListener("input", (event) => {
    const element = event.target.closest("[data-input]");
    if (!element) return;
    const type = element.dataset.input;
    if (type === "qa-draft") state.assistant.qaDraft = element.value;
    else if (type === "s003-companion-draft" && s003ScenarioSelected()) s003Dashboard.companionDraft = element.value;
    else if (type === "definition-name") state.ui.tempDefinitionName = element.value;
    else if (type === "definition-purpose") state.ui.tempDefinitionPurpose = element.value;
    else if (type === "catalog-query") {
      state.catalog.query = element.value;
      saveState();
      renderApp();
      window.requestAnimationFrame(() => {
        const input = document.querySelector('[data-input="catalog-query"]');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
      return;
    } else if (type === "s003-enterprise-search" && s003ScenarioSelected()) {
      s003Dashboard.searchTerm = element.value;
      renderApp();
      window.requestAnimationFrame(() => {
        const input = document.querySelector('[data-input="s003-enterprise-search"]');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
      return;
    }
    saveState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.ui.modal) { state.ui.modal = null; commit(); }
      else if (state.ui.drawer) { state.ui.drawer = null; commit(); }
      else if (state.ui.readerMoreOpen) { state.ui.readerMoreOpen = false; renderApp(); }
      else if (state.navOpen) { state.navOpen = false; commit(); }
    }
    if (event.key === "Enter" && event.target.matches('[data-input="qa-draft"]')) {
      event.preventDefault();
      handleAction({ dataset: { action: "ask-report" } });
    }
    if (event.key === "Enter" && event.target.matches('[data-input="s003-companion-draft"]')) {
      event.preventDefault();
      const reportId = routeInfo().query.get("reportId") || s003ReportFor(s003Dashboard.selectedEnterpriseId)?.content?.reportId || "";
      handleAction({ dataset: { action: "s003-submit-companion-agent", reportId } });
    }
  });

  window.addEventListener("hashchange", renderApp);
  window.addEventListener("pageshow", () => {
    const pending = state.ui.pendingExternalReturn;
    if (!pending) return;
    let reads = 0;
    if (pending.owner === "decision") {
      reads = rereadDecisionSummaries({
        returnRoute: pending.returnRoute,
        filter: pending.filter,
        returnPosition: pending.returnPosition,
        sourceScene: pending.sourceScene,
        businessSubject: pending.businessSubject,
        summaryAsOf: pending.summaryAsOf,
      }).length;
    } else if (pending.owner === "agent") {
      reads = rereadAgentReferences();
      if (pending.assistantTab === "qa" || pending.assistantTab === "verification") state.assistant.tab = pending.assistantTab;
    }
    state.ui.pendingScrollAnchor = pending.returnPosition || state.ui.pendingScrollAnchor;
    state.ui.pendingExternalReturn = null;
    saveState();
    renderApp();
    toast(pending.owner === "decision" ? "决策摘要已重新读取" : "Agent 状态已重新读取", reads ? "已按原场景轮次和稳定标识读取提供模块当前状态。" : "提供模块尚未形成可读取记录；报告中心未补造本地状态。", reads ? "success" : "danger");
  });
  restoreInterruptedWork();
  if (!window.location.hash) window.location.hash = "/lifecycle";
  else renderApp();
})();
