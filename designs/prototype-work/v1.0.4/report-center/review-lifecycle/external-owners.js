(function () {
  "use strict";

  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const nowText = () => new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replaceAll("/", "-");

  const AGENT_APP_STORAGE_KEY = "ontology3.agent-application.catalog.v7";
  const C022_INBOX_KEY = "ontology3.agent-application.c022-inbox.v1";
  const C008_PROJECTION_STORAGE_KEY = "ontology3-c008-authoritative-projection-v1";
  const C017_REPORT_PROJECTION_STORAGE_KEY = "ontology3.c017.report-center.projection.v1";
  const PLATFORM_SCENARIO_CONTEXT_KEY = "ontology3.platform.scenario-runtime.v1";
  const C033_HANDOFF_CONTEXT_KEY = "ontology3.0-s001-handoff-v1:scenario-context";

  const readOwnerStore = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const writeOwnerStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error(`[ontology3] Owner 记录持久化失败：${key}`, error);
      }
      return false;
    }
  };

  function createTrustOwner() {
    const parseStoredObject = (key, label) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { value: null, reason: `${label}尚未形成` };
        const value = JSON.parse(raw);
        return value && typeof value === "object" ? { value, reason: null } : { value: null, reason: `${label}格式无效` };
      } catch (_) {
        return { value: null, reason: `${label}无法解析` };
      }
    };

    const scenarioContextFrom = (source = {}) => {
      const value = source.scenarioContext || source.context || source;
      return {
        scenarioId: value.scenarioId || null,
        scenarioVersion: value.scenarioVersion || null,
        scenarioRunId: value.scenarioRunId || null,
        formedAt: value.formedAt || value.contextFormedAt || null,
        status: value.status || value.contextStatus || null,
      };
    };

    const scenarioReady = (context) => Boolean(
      context?.scenarioId && context?.scenarioVersion && context?.scenarioRunId && context?.formedAt
      && ["active", "ready", "available", "有效", "启用", "进行中", "已启用", "可用"].includes(context.status),
    );
    const sameScenario = (left, right) => ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => left?.[field] === right?.[field]);
    const missing = (record, fields) => fields.filter((field) => record?.[field] == null || record[field] === "");
    const currentScenarioContext = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = scenarioContextFrom({
        scenarioId: params.get("scenarioId"), scenarioVersion: params.get("scenarioVersion"), scenarioRunId: params.get("scenarioRunId"),
        formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt"),
        status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus"),
      });
      const c033 = parseStoredObject(C033_HANDOFF_CONTEXT_KEY, "C033 统一交接上下文").value || {};
      const legacy = parseStoredObject(PLATFORM_SCENARIO_CONTEXT_KEY, "平台场景上下文").value || {};
      return [fromUrl, scenarioContextFrom(c033), scenarioContextFrom(legacy)].find(scenarioReady) || fromUrl;
    };
    const unavailable = (readStatus, reason, c008 = null, c017 = null) => ({
      owner: "本体管理 / 数据工程",
      schemaVersion: 1,
      projectionId: c008?.projectionId || null,
      projectionVersion: c008?.projectionVersion || null,
      formedAt: c017?.formedAt || c008?.formedAt || null,
      readStatus,
      scenarioContext: scenarioContextFrom(c008 || c017 || {}),
      binding: null,
      trust: null,
      bindingSummary: null,
      previousTrustedCombination: clone(c008?.previousTrustedCombination || null),
      candidate: clone(c008?.candidate || null),
      dataPreviousVersion: null,
      reason,
      recoveryAdvice: "分别由本体管理恢复同轮次 C008/T019、由数据工程恢复面向报告中心的 C017 双摘要，然后重新读取。",
      exchangeKey: `${C008_PROJECTION_STORAGE_KEY} + ${C017_REPORT_PROJECTION_STORAGE_KEY}`,
      ownerRefs: { binding: "本体管理 · C008/T019", trust: "数据工程 · C017" },
    });
    const normalizedC008Status = (value) => ["available", "ready", "可用", "可消费"].includes(String(value || "").trim().toLowerCase())
      ? "ready" : ["empty", "空", "无t019", "尚未形成"].includes(String(value || "").trim().toLowerCase())
        ? "empty" : ["failed", "failure", "失败", "读取失败"].includes(String(value || "").trim().toLowerCase())
          ? "failed" : ["unavailable", "不可消费", "blocked", "阻断"].includes(String(value || "").trim().toLowerCase()) ? "unavailable" : "invalid";

    const normalizeProjection = () => {
      const c008Stored = parseStoredObject(C008_PROJECTION_STORAGE_KEY, "C008 权威组合投影");
      const c017Stored = parseStoredObject(C017_REPORT_PROJECTION_STORAGE_KEY, "C017 报告中心只读投影");
      if (!c008Stored.value) return unavailable("missing", c008Stored.reason, null, c017Stored.value);
      if (!c017Stored.value) return unavailable("missing", c017Stored.reason, c008Stored.value, null);
      const c008 = clone(c008Stored.value);
      const c017 = clone(c017Stored.value);
      const platformScenario = currentScenarioContext();
      const c008Scenario = scenarioContextFrom(c008);
      const c017Scenario = scenarioContextFrom(c017);
      if (!scenarioReady(platformScenario)) return unavailable("context_missing", "平台 C033 场景运行上下文不可定位或不完整。", c008, c017);
      const c008Missing = missing(c008, ["schemaVersion", "projectionId", "projectionVersion", "formedAt", "readStatus", "contractCode", "sourceModule"]);
      if (c008.schemaVersion !== 1 || c008.projectionId !== C008_PROJECTION_STORAGE_KEY || c008.contractCode !== "C008" || !["本体管理", "M01"].includes(c008.sourceModule) || c008Missing.length || !scenarioReady(c008Scenario)) {
        return unavailable("invalid", `C008 包络字段不完整：${[...c008Missing, ...(!scenarioReady(c008Scenario) ? ["C033 场景运行上下文"] : [])].join("、")}`, c008, c017);
      }
      const c017Missing = missing(c017, ["schemaVersion", "projectionId", "projectionVersion", "formedAt", "readStatus", "contractCode", "sourceModule", "consumer"]);
      if (c017.schemaVersion !== 1 || c017.projectionId !== C017_REPORT_PROJECTION_STORAGE_KEY || c017.contractCode !== "C017" || c017.sourceModule !== "数据工程" || c017.consumer !== "报告中心" || c017Missing.length || !scenarioReady(c017Scenario)) {
        return unavailable("invalid", `C017 报告中心投影字段不完整：${[...c017Missing, ...(!scenarioReady(c017Scenario) ? ["C033 场景运行上下文"] : [])].join("、")}`, c008, c017);
      }
      if (!sameScenario(c008Scenario, platformScenario) || !sameScenario(c017Scenario, platformScenario)) {
        return unavailable("context_mismatch", "C008、C017 与当前平台 C033 不是同一场景运行轮次。", c008, c017);
      }
      const c008Status = normalizedC008Status(c008.readStatus);
      if (c008Status !== "ready") return unavailable(c008Status, c008.reason || "当前没有可读取的 T019 权威消费组合。", c008, c017);
      if (c017.readStatus !== "ready") return unavailable(c017.readStatus || "unavailable", c017.reason || "当前没有可读取的 C017 双摘要。", c008, c017);
      const current = c008.current || {};
      const currentMissing = missing(current, ["semanticVersionId", "semanticVersion", "dataVersion", "asOf", "switchedAt"]);
      if (currentMissing.length || !current.t019?.recordId || !current.t019?.evidenceId) return unavailable("invalid", `C008 当前组合字段不完整：${[...currentMissing, "T019 记录或证据"].join("、")}`, c008, c017);
      const projection = (c017.projections || []).find((item) => item?.dataVersion === current.dataVersion && sameScenario(scenarioContextFrom(item), platformScenario));
      if (!projection) return unavailable("not_found", "C017 无法定位 C008 当前组合引用的精确数据版本。", c008, c017);
      const currentSummary = projection.currentStateSummary || {};
      const versionSummary = projection.versionBindingSummary || {};
      const t018EvidenceId = projection.refresh?.t018EvidenceId || null;
      const summaryMissing = [
        ...missing(currentSummary, ["id", "version", "formedAt", "qualityStatus", "hardQualityFailure"]),
        ...missing(versionSummary, ["id", "version", "formedAt"]),
        ...missing(projection, ["assetId", "dataVersion", "asOf"]),
        ...(!t018EvidenceId ? ["T018 候选资格证据"] : []),
      ];
      if (summaryMissing.length || projection.dataVersion !== current.dataVersion || projection.asOf !== current.asOf) {
        return unavailable("invalid", `C008 与 C017 双摘要字段不完整或身份不一致：${[...summaryMissing, ...(projection.dataVersion !== current.dataVersion || projection.asOf !== current.asOf ? ["精确数据版本或 T008"] : [])].join("、")}`, c008, c017);
      }
      const binding = {
        bindingId: current.t019.recordId,
        semanticVersionId: current.semanticVersionId,
        semanticVersion: current.semanticVersion,
        dataAssetId: projection.assetId,
        dataAssetVersionId: projection.dataVersion,
        dataVersion: projection.dataVersion,
        consumableVersionId: t018EvidenceId,
        asOf: projection.asOf,
        adoptedAt: current.switchedAt,
        readiness: projection.allowConsumption ? "可消费" : "不可消费",
        compatibility: projection.allowConsumption ? "兼容" : "无法判断",
        authority: "已采用",
      };
      const trust = {
        id: currentSummary.id,
        version: currentSummary.version,
        formedAt: currentSummary.formedAt,
        dataAssetId: projection.assetId,
        dataAssetVersionId: projection.dataVersion,
        dataVersion: projection.dataVersion,
        asOf: projection.asOf,
        publishedQuality: projection.quality?.status || currentSummary.qualityStatus,
        laterQualityFinding: currentSummary.hardQualityFailure ? currentSummary.reason : "未发现事后硬质量失败",
        hardQualityFailure: currentSummary.hardQualityFailure === true,
        hardQualityFailureFoundAt: currentSummary.detectedAt && currentSummary.detectedAt !== "不适用" ? currentSummary.detectedAt : null,
        impactScope: currentSummary.impactScope,
        recoveryAdvice: currentSummary.recovery,
        comparisonCondition: currentSummary.hardQualityFailure ? "无法比较" : projection.allowConsumption ? (projection.quality?.warnings?.length ? "带警告" : "可以比较") : "仅固定结果比较",
        comparisonConditionReason: currentSummary.reason,
        freshness: projection.freshness?.label || projection.freshness?.status || "截至时间已确认",
        readiness: projection.allowConsumption ? "可消费" : "不可消费",
        retention: "按当前数据工程保留状态读取",
        fiveDimensions: clone(projection.fiveDimensions || []),
      };
      const bindingSummary = {
        id: versionSummary.id,
        version: versionSummary.version,
        formedAt: versionSummary.formedAt,
        semanticVersionId: current.semanticVersionId,
        semanticVersion: current.semanticVersion,
        dataAssetId: projection.assetId,
        dataAssetVersionId: projection.dataVersion,
        dataVersion: projection.dataVersion,
        asOf: projection.asOf,
        publishedQuality: projection.quality?.status || currentSummary.qualityStatus,
        freshness: projection.freshness?.label || projection.freshness?.status || "截至时间已确认",
        readiness: projection.allowConsumption ? "可消费" : "不可消费",
        hardQualityFailure: currentSummary.hardQualityFailure === true,
        fiveDimensions: clone(projection.fiveDimensions || []),
      };
      return {
        owner: "本体管理 / 数据工程",
        schemaVersion: 1,
        projectionId: c008.projectionId,
        projectionVersion: `${c008.projectionVersion} / ${c017.projectionVersion}`,
        formedAt: c017.formedAt,
        readStatus: "ready",
        scenarioContext: platformScenario,
        binding,
        trust,
        bindingSummary,
        previousTrustedCombination: clone(c008.previousTrustedCombination || null),
        candidate: clone(c008.candidate || projection.candidate || null),
        dataPreviousVersion: clone(projection.previousTrusted || null),
        providerReturnedAt: c017.formedAt,
        reason: null,
        recoveryAdvice: null,
        exchangeKey: `${C008_PROJECTION_STORAGE_KEY} + ${C017_REPORT_PROJECTION_STORAGE_KEY}`,
        ownerRefs: { binding: "本体管理 · C008/T019", trust: "数据工程 · C017" },
      };
    };

    const peekCurrent = () => normalizeProjection();
    const readCurrent = ({ purpose = "只读消费" } = {}) => ({
      ...normalizeProjection(),
      purpose,
      readAt: nowText(),
      ownerRefs: {
        binding: "本体管理 · C008/T019",
        trust: "数据工程 · C017（报告中心只读投影）",
      },
    });
    const advanceCurrent = () => readCurrent({ purpose: "用户重新读取权威状态" });
    const reset = () => {};

    return Object.freeze({ peekCurrent, readCurrent, advanceCurrent, reset, exchangeKey: `${C008_PROJECTION_STORAGE_KEY} + ${C017_REPORT_PROJECTION_STORAGE_KEY}` });
  }

  function createAgentProjectionReader() {
    const parseModel = () => readOwnerStore(AGENT_APP_STORAGE_KEY, null);
    const parseC022Inbox = () => readOwnerStore(C022_INBOX_KEY, null);
    const activeScenario = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {
        scenarioId: params.get("scenarioId"),
        scenarioVersion: params.get("scenarioVersion"),
        scenarioRunId: params.get("scenarioRunId"),
        formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt"),
        status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus"),
      };
      const c033 = readOwnerStore(C033_HANDOFF_CONTEXT_KEY, {}) || {};
      const legacy = readOwnerStore(PLATFORM_SCENARIO_CONTEXT_KEY, {}) || {};
      const normalize = (source = {}) => {
        const value = source.scenarioContext || source.context || source;
        return {
          scenarioId: value.scenarioId || null,
          scenarioVersion: value.scenarioVersion || null,
          scenarioRunId: value.scenarioRunId || null,
          formedAt: value.formedAt || value.contextFormedAt || null,
          status: value.status || value.contextStatus || null,
        };
      };
      const ready = (value) => Boolean(value.scenarioId && value.scenarioVersion && value.scenarioRunId && value.formedAt
        && ["active", "ready", "available", "有效", "启用", "进行中", "已启用", "可用"].includes(value.status));
      return [normalize(fromUrl), normalize(c033), normalize(legacy)].find(ready) || normalize(fromUrl);
    };
    const sameScenario = (left, right) => Boolean(left && right
      && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => left[field] && left[field] === right[field]));
    const requestIdentity = (request = {}) => ({
      scenarioContext: request.scenarioContext || request.c024?.reportContext?.scenarioContext || null,
      reportNo: request.reportNumber || request.c024?.reportContext?.reportNumber || request.c024?.reportContext?.reportId || null,
      contentVersion: request.contentVersion || request.c024?.reportContext?.contentVersion || null,
      evidencePackId: request.evidencePackageId || request.c024?.reportContext?.evidencePack?.id || null,
      evidencePackVersion: request.evidencePackageVersion || request.c024?.reportContext?.evidencePack?.version || null,
      semanticVersionId: request.semanticVersionId || request.c024?.reportContext?.semanticBinding?.semanticVersionId || null,
      semanticVersion: request.semanticVersion || request.c024?.reportContext?.semanticBinding?.semanticVersion || null,
      dataAssetVersionId: request.dataAssetVersionId || request.c024?.reportContext?.semanticBinding?.dataAssetVersionId || null,
      dataVersion: request.dataVersion || request.c024?.reportContext?.semanticBinding?.dataVersion || null,
      consumableVersionId: request.consumableVersionId || request.c024?.reportContext?.semanticBinding?.consumableVersionId || null,
      asOf: request.dataAsOf || request.c024?.reportContext?.semanticBinding?.asOf || null,
      anchor: request.anchor || request.c024?.selectedAnchor || request.c024?.reportContext?.selectedAnchor || null,
    });
    const generationIdentity = (request = {}) => {
      const context = request.reportContext || {};
      const evidence = context.evidencePack || {};
      const semantic = context.semanticBinding || request.semanticBinding || {};
      return {
        scenarioContext: context.scenarioContext || request.scenarioContext || null,
        requestId: request.requestId || context.reportRequestId || null,
        aggregateId: context.reportAggregateId || null,
        evidencePackId: evidence.id || request.evidencePackId || null,
        evidencePackVersion: evidence.version || null,
        semanticVersionId: semantic.semanticVersionId || null,
        semanticVersion: semantic.semanticVersion || null,
        dataAssetVersionId: semantic.dataAssetVersionId || null,
        dataVersion: semantic.dataVersion || null,
        consumableVersionId: semantic.consumableVersionId || null,
        asOf: semantic.asOf || null,
      };
    };
    const compactHistoricalGenerationRequest = (request = {}) => {
      const identity = generationIdentity(request);
      return {
        requestId: identity.requestId,
        submittedAt: request.submittedAt || null,
        archived: true,
        persistedAsReference: true,
        reportContext: {
          scenarioContext: clone(identity.scenarioContext),
          reportRequestId: identity.requestId,
          reportAggregateId: identity.aggregateId,
          targetContentRevision: request.reportContext?.targetContentRevision || request.contentRevision || null,
          evidencePack: { id: identity.evidencePackId, version: identity.evidencePackVersion },
          reportDefinition: clone(request.reportContext?.reportDefinition || request.reportDefinition || null),
          template: clone(request.reportContext?.template || request.template || null),
          semanticBinding: {
            semanticVersionId: identity.semanticVersionId,
            semanticVersion: identity.semanticVersion,
            dataAssetVersionId: identity.dataAssetVersionId,
            dataVersion: identity.dataVersion,
            consumableVersionId: identity.consumableVersionId,
            asOf: identity.asOf,
          },
        },
      };
    };
    const generationRequest = (key) => {
      const inbox = parseC022Inbox();
      const requests = Array.isArray(inbox) ? inbox : Array.isArray(inbox?.requests) ? inbox.requests : [];
      return requests.find((item) => item?.requestId === key || item?.reportContext?.reportRequestId === key) || null;
    };
    const generationRunIdentity = (run = {}) => {
      const snapshot = run.snapshot || run.fixedContextRef || run.context || {};
      const scenario = run.scenarioContext || snapshot.scenarioContext || {
        scenarioId: snapshot.scenarioId,
        scenarioVersion: snapshot.scenarioVersion,
        scenarioRunId: snapshot.scenarioRunId,
        formedAt: snapshot.scenarioFormedAt,
        status: snapshot.scenarioStatus,
      };
      return {
        scenarioContext: scenario,
        requestId: run.requestId || snapshot.reportRequestId || snapshot.requestId || null,
        aggregateId: snapshot.reportAggregateId || null,
        evidencePackId: snapshot.evidencePackageId || snapshot.evidencePackId || null,
        evidencePackVersion: snapshot.evidencePackageVersion || snapshot.evidencePackVersion || null,
        semanticVersionId: snapshot.semanticVersionId || null,
        semanticVersion: snapshot.ontologyVersion || snapshot.semanticVersion || null,
        dataAssetVersionId: snapshot.dataAssetVersionId || null,
        dataVersion: snapshot.dataVersion || null,
        consumableVersionId: snapshot.consumableVersionId || null,
        asOf: snapshot.dataAsOf || snapshot.asOf || null,
      };
    };
    const generationIdentityMatches = (expected, actual) => sameScenario(expected.scenarioContext, actual.scenarioContext)
      && ["requestId", "aggregateId", "evidencePackId", "evidencePackVersion", "semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId", "asOf"]
        .every((field) => expected[field] && actual[field] && expected[field] === actual[field]);
    const identityMatchesRun = (identity, run) => {
      if (!run) return true;
      const snapshot = run.snapshot || {};
      return sameScenario(identity.scenarioContext, run.scenarioContext || snapshot)
        && (!identity.reportNo || identity.reportNo === snapshot.reportNumber)
        && (!identity.contentVersion || identity.contentVersion === snapshot.contentVersion)
        && (!identity.evidencePackId || identity.evidencePackId === snapshot.evidencePackageId)
        && (!identity.evidencePackVersion || identity.evidencePackVersion === snapshot.evidencePackageVersion)
        && (!identity.semanticVersionId || identity.semanticVersionId === snapshot.semanticVersionId)
        && (!identity.semanticVersion || identity.semanticVersion === (snapshot.ontologyVersion || snapshot.semanticVersion))
        && (!identity.dataAssetVersionId || identity.dataAssetVersionId === snapshot.dataAssetVersionId)
        && (!identity.dataVersion || identity.dataVersion === snapshot.dataVersion)
        && (!snapshot.consumableVersionId || identity.consumableVersionId === snapshot.consumableVersionId)
        && (!identity.asOf || identity.asOf === (snapshot.dataAsOf || snapshot.asOf));
    };
    const statusLabel = (request, run) => {
      if (run?.result && ["complete", "partial"].includes(run.status)) return "已完成";
      if (run?.status === "failed") return "失败";
      if (run?.status === "blocked" || request?.status === "blocked") return "已拒绝";
      if (["waiting", "running"].includes(run?.status)) return "运行中";
      return request ? "等待 Agent 应用运行" : "等待 Agent 应用接收";
    };
    const answerFor = (run) => {
      const result = run?.result;
      if (!result) return null;
      if (result.summary) return result.summary;
      if (Array.isArray(result.findings) && result.findings.length) return result.findings.map((item) => item.text || item.title).filter(Boolean).join("；");
      return result.text || result.title || null;
    };
    const fixedContextFor = (request, run) => {
      const identity = requestIdentity(request);
      const snapshot = run?.snapshot || {};
      return {
        scenarioId: identity.scenarioContext?.scenarioId || null,
        scenarioVersion: identity.scenarioContext?.scenarioVersion || null,
        scenarioRunId: identity.scenarioContext?.scenarioRunId || null,
        reportId: identity.reportNo,
        contentVersion: identity.contentVersion,
        evidencePackId: identity.evidencePackId,
        evidencePackVersion: identity.evidencePackVersion,
        semanticVersionId: identity.semanticVersionId,
        semanticVersion: identity.semanticVersion || snapshot.ontologyVersion || request.semanticVersion || null,
        dataAssetVersionId: identity.dataAssetVersionId,
        dataVersion: identity.dataVersion,
        consumableVersionId: identity.consumableVersionId,
        asOf: identity.asOf || snapshot.dataAsOf || request.dataAsOf || null,
        selectedAnchor: identity.anchor,
        verificationRunId: request.c024?.verificationRunId || request.c024?.reportContext?.verificationReference?.runId || null,
        comparisonRecordId: request.c024?.reportContext?.comparisonReference?.recordId || null,
      };
    };
    const readRecord = (key) => {
      if (!key) return null;
      const model = parseModel();
      if (!model || !Array.isArray(model.inboundRequests) || !Array.isArray(model.runs)) return null;
      const current = activeScenario();
      const request = model.inboundRequests.find((item) => item.id === key || item.sourceRequestId === key || item.runId === key || item.resultId === key
        || item.c024?.reportContext?.comparisonReference?.recordId === key)
        || model.inboundRequests.find((item) => {
          const run = model.runs.find((candidate) => candidate.id === key || candidate.result?.id === key || candidate.sessionId === key || candidate.bindingId === key);
          return run && item.id === run.requestId;
        });
      const rejection = (model.c024Rejections || []).find((item) => item.sourceRequestId === key);
      if (!request) {
        if (!rejection) return null;
        return {
          owner: "Agent 应用",
          requestId: rejection.sourceRequestId,
          status: "已拒绝",
          failure: (rejection.issues || []).join("；") || "C024 固定身份校验失败",
          submittedAt: rejection.receivedAt || null,
          readAt: nowText(),
        };
      }
      const identity = requestIdentity(request);
      const requiredIdentity = ["reportNo", "contentVersion", "evidencePackId", "evidencePackVersion", "semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId", "asOf", "anchor"];
      if (!sameScenario(identity.scenarioContext, current) || requiredIdentity.some((field) => !identity[field])) {
        return { owner: "Agent 应用", requestId: request.id, status: "已拒绝", failure: "C025 固定报告、证据包、C033 或精确双版本身份不完整或错配", readAt: nowText() };
      }
      const run = model.runs.find((item) => item.id === key || item.result?.id === key || item.sessionId === key || item.bindingId === key)
        || model.runs.find((item) => item.requestId === request.id || item.id === request.runId);
      if (!identityMatchesRun(identity, run)) {
        return { owner: "Agent 应用", requestId: request.id, status: "已拒绝", failure: "C025 Run 与 C024 报告、证据包、场景轮次或精确双版本错配", readAt: nowText() };
      }
      const session = (model.sessions || []).find((item) => item.id === (run?.sessionId || request.sessionId)) || null;
      const result = run?.result || null;
      const fixedContextRef = fixedContextFor(request, run);
      return {
        owner: "Agent 应用",
        kind: request.c024?.reportContext?.contextIntent === "t049-explanation" ? "verification-explanation" : "report-qa",
        requestId: request.id,
        runId: run?.id || request.runId || null,
        runVersion: run?.snapshot?.agentRelease || null,
        sessionId: session?.id || run?.sessionId || request.sessionId || null,
        sessionVersion: session?.version || null,
        bindingId: session?.bindingId || run?.bindingId || request.bindingId || null,
        contextBindingId: session?.bindingId || run?.bindingId || request.bindingId || null,
        contextBindingVersion: session?.bindingVersion || null,
        resultId: result?.id || request.resultId || null,
        resultVersion: result?.version || null,
        status: statusLabel(request, run),
        answer: answerFor(run),
        text: answerFor(run),
        anchor: identity.anchor,
        submittedAt: request.receivedAt || null,
        completedAt: run?.finishedAt || null,
        readAt: nowText(),
        failure: run?.error || request.blockedReason || null,
        payload: { question: request.question || request.c024?.question || null },
        fixedContextRef,
        agentReleaseId: run?.snapshot?.agentId || "report-copilot",
        agentReleaseVersion: run?.snapshot?.agentRelease || null,
        auditRoute: run?.id ? `../../agent-application/Agent应用.html#/runs/${encodeURIComponent(run.id)}` : "../../agent-application/Agent应用.html#/runs",
      };
    };
    const publishGeneration = (payload = {}) => {
      const identity = generationIdentity(payload);
      const current = activeScenario();
      const required = ["requestId", "aggregateId", "evidencePackId", "evidencePackVersion", "semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "consumableVersionId", "asOf"];
      if (!sameScenario(identity.scenarioContext, current) || required.some((field) => !identity[field])) {
        return { owner: "Agent 应用", requestId: identity.requestId, status: "已拒绝", failure: "C022 缺少 C033、报告根、证据包或精确双版本身份" };
      }
      const inbox = parseC022Inbox();
      const requests = (Array.isArray(inbox) ? inbox : Array.isArray(inbox?.requests) ? inbox.requests : []).filter(Boolean);
      const conflict = requests.find((item) => item?.requestId === identity.requestId
        && !generationIdentityMatches(identity, generationIdentity(item)));
      if (conflict) {
        return { owner: "Agent 应用", requestId: identity.requestId, status: "已拒绝", failure: "同一 C022 请求标识已绑定其他场景轮次或精确版本" };
      }
      const next = requests
        .filter((item) => item?.requestId !== identity.requestId)
        .map(compactHistoricalGenerationRequest);
      next.push(clone(payload));
      const persisted = writeOwnerStore(C022_INBOX_KEY, {
        contractCode: "C022",
        schemaVersion: 1,
        owner: "报告中心",
        consumer: "Agent 应用",
        scenarioContext: clone(identity.scenarioContext),
        formedAt: nowText(),
        requests: next,
      });
      if (!persisted) {
        return { owner: "Agent 应用", requestId: identity.requestId, status: "已拒绝", failure: "报告生成请求未能写入跨模块收件箱，请释放浏览器工作区容量后重试" };
      }
      return {
        owner: "Agent 应用",
        requestId: identity.requestId,
        status: "等待 Agent 应用接收",
        submittedAt: nowText(),
        runId: null,
        resultId: null,
      };
    };
    const readGeneration = (key) => {
      if (!key) return null;
      const inbox = parseC022Inbox();
      const requests = Array.isArray(inbox) ? inbox : Array.isArray(inbox?.requests) ? inbox.requests : [];
      const model = parseModel();
      const allRuns = Array.isArray(model?.runs) ? model.runs : [];
      const run = allRuns.find((item) => item.id === key || item.requestId === key || item.result?.id === key)
        || allRuns.find((item) => requests.some((request) => request?.requestId === item.requestId && (request.requestId === key || item.id === key)));
      const request = generationRequest(run?.requestId || key)
        || requests.find((item) => item?.requestId === run?.requestId || item?.requestId === key);
      if (!request) return null;
      const expected = generationIdentity(request);
      if (!sameScenario(expected.scenarioContext, activeScenario())) return null;
      if (!run) {
        return { owner: "Agent 应用", requestId: expected.requestId, status: "等待 Agent 应用接收", submittedAt: request.submittedAt || null, runId: null, resultId: null };
      }
      const actual = generationRunIdentity(run);
      if (!generationIdentityMatches(expected, actual)) {
        return { owner: "Agent 应用", requestId: expected.requestId, runId: run.id || null, status: "已拒绝", failure: "C023 Run 与 C022 场景轮次、报告根、证据包或精确双版本错配", readAt: nowText() };
      }
      const result = run.result || null;
      const status = run.status === "failed" ? "失败"
        : run.status === "blocked" ? "已拒绝"
          : result && ["complete", "partial"].includes(run.status) ? "已完成"
            : ["waiting", "running"].includes(run.status) ? "运行中" : "等待 Agent 应用运行";
      return {
        owner: "Agent 应用",
        requestId: expected.requestId,
        runId: run.id || null,
        runVersion: run.snapshot?.agentRelease || run.version || null,
        resultId: result?.id || null,
        resultVersion: result?.version || null,
        sourceDraftId: result?.sourceDraftId || run.sourceDraftId || null,
        sourceItems: clone(result?.sourceItems || result?.contentItems || []),
        generatedContent: clone(result?.generatedContent || result?.content || null),
        status,
        submittedAt: run.startedAt || request.submittedAt || null,
        completedAt: run.finishedAt || null,
        readAt: nowText(),
        failure: run.error || result?.failure || null,
        fixedContextRef: clone(actual),
        auditRoute: run.id ? `../../agent-application/Agent应用.html#/runs/${encodeURIComponent(run.id)}` : "../../agent-application/Agent应用.html#/runs",
      };
    };
    const submit = (payload = {}) => readRecord(payload.requestId) || {
      owner: "Agent 应用",
      requestId: payload.requestId || null,
      status: "等待 Agent 应用接收",
      submittedAt: nowText(),
      runId: null,
      sessionId: null,
      bindingId: null,
      resultId: null,
    };
    return Object.freeze({ readRecord, submit, publishGeneration, readGeneration, storageKey: AGENT_APP_STORAGE_KEY, c022StorageKey: C022_INBOX_KEY });
  }

  function createDecisionProjectionReader() {
    const projectionKey = "ontology3.decision-center.c019.projection.v1";
    const inboxKey = "ontology3.decision-center.c011.inbox.v1";
    const parse = (key) => {
      try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
    };
    const activeScenario = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {
        scenarioId: params.get("scenarioId"),
        scenarioVersion: params.get("scenarioVersion"),
        scenarioRunId: params.get("scenarioRunId"),
        formedAt: params.get("formedAt") || params.get("scenarioFormedAt") || params.get("contextCreatedAt") || params.get("scenarioContextFormedAt"),
        status: params.get("scenarioStatus") || params.get("status") || params.get("contextStatus"),
      };
      if (fromUrl.scenarioId && fromUrl.scenarioVersion && fromUrl.scenarioRunId) return fromUrl;
      const source = parse(PLATFORM_SCENARIO_CONTEXT_KEY) || {};
      return source.scenarioContext || source;
    };
    const sameScenario = (left, right) => Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => left[field] && left[field] === right[field]));
    const scenarioReady = (context) => Boolean(context?.scenarioId && context?.scenarioVersion && context?.scenarioRunId && context?.formedAt
      && ["active", "ready", "available", "已启用", "可用"].includes(context.status));
    const projection = () => {
      const envelope = parse(projectionKey);
      const current = activeScenario();
      if (!envelope || envelope.contractCode !== "C019" || envelope.schemaVersion !== 1 || envelope.owner !== "决策中心"
        || !scenarioReady(envelope.scenarioContext) || !scenarioReady(current) || !sameScenario(envelope.scenarioContext, current)) return null;
      return envelope;
    };
    const diagnose = () => {
      const envelope = parse(projectionKey);
      const current = activeScenario();
      if (!envelope) return { available: false, reason: "决策中心尚未发布 C019 决策运行摘要。" };
      if (envelope.contractCode !== "C019") return { available: false, reason: "决策运行摘要合同类型不是 C019。" };
      if (envelope.schemaVersion !== 1) return { available: false, reason: `C019 包络版本不可用：${envelope.schemaVersion ?? "未提供"}。` };
      if (envelope.owner !== "决策中心") return { available: false, reason: "C019 Owner 不是决策中心。" };
      if (!scenarioReady(envelope.scenarioContext)) return { available: false, reason: "C019 缺少完整、已启用的场景版本、运行轮次、形成时间或状态。" };
      if (!scenarioReady(current)) return { available: false, reason: "平台当前场景上下文缺少完整、已启用的版本、运行轮次、形成时间或状态。" };
      if (!sameScenario(envelope.scenarioContext, current)) return {
        available: false,
        reason: `C019 场景身份 ${envelope.scenarioContext?.scenarioId || "缺失"} / ${envelope.scenarioContext?.scenarioVersion || "缺失"} / ${envelope.scenarioContext?.scenarioRunId || "缺失"} 与当前工作区 ${current?.scenarioId || "缺失"} / ${current?.scenarioVersion || "缺失"} / ${current?.scenarioRunId || "缺失"} 不一致。`,
      };
      return { available: true, reason: null, recordCount: Array.isArray(envelope.records) ? envelope.records.length : 0 };
    };
    const records = () => {
      const envelope = projection();
      return envelope ? (Array.isArray(envelope.records) ? envelope.records : []).filter((record) => sameScenario(record.scenarioContext, envelope.scenarioContext)) : [];
    };
    const target = (record, targetType) => ({
      "Action Request": record?.requestRef,
      "提醒": record?.reminderRef,
      "待办": record?.taskRef,
      "全链路追溯": record?.traceRef,
    })[targetType] || null;
    const normalizeTargetType = (value) => ({
      request: "Action Request", "action-request": "Action Request", actionRequest: "Action Request",
      reminder: "提醒", task: "待办", trace: "全链路追溯",
    })[value] || value;
    const recordByTarget = (targetType, targetId) => {
      const normalized = normalizeTargetType(targetType);
      return records().find((record) => {
        const ref = target(record, normalized);
        return ref?.targetId === targetId || (normalized === "Action Request" && record.requestRef?.targetId === targetId);
      }) || null;
    };
    const summaryFrom = (record, selectedType = "Action Request", navigation = {}, readAt = null) => {
      if (!record) return null;
      const normalized = normalizeTargetType(selectedType);
      const selected = target(record, normalized);
      const refs = [
        ["Action Request", record.requestRef, record.requestStatus],
        ["提醒", record.reminderRef, record.reminderStatus],
        ["待办", record.taskRef, record.taskStatus],
        ["全链路追溯", record.traceRef, record.traceRef ? "可读取" : null],
      ].map(([type, ref, status]) => ({
        targetType: type,
        targetId: ref?.targetId || null,
        resourceId: ref?.targetId || null,
        detailRoute: ref?.stableDetailEntry || null,
        availability: ref?.targetId ? "可读取" : "尚未形成",
        status: status || (ref?.targetId ? "可读取" : "尚未形成"),
      }));
      return {
        owner: "决策中心",
        sourceRequestId: record.requestRef?.targetId || null,
        targetType: normalized,
        targetId: selected?.targetId || null,
        targetResourceId: selected?.targetId || null,
        targetAvailability: selected?.targetId ? "可读取" : "尚未形成",
        status: normalized === "Action Request" ? record.requestStatus : normalized === "提醒" ? record.reminderStatus : normalized === "待办" ? record.taskStatus : selected?.targetId ? "可读取" : "尚未形成",
        actionRequestStatus: record.requestStatus || null,
        semanticVersion: record.semanticVersion || null,
        semanticVersionId: record.semanticVersionId || null,
        dataAssetVersionId: record.dataAssetVersionId || null,
        dataVersion: record.dataVersion || null,
        asOf: record.asOf || null,
        scenarioContext: clone(record.scenarioContext),
        sourceScene: record.navigationContext?.sourceScene || record.scenarioContext?.scenarioId || null,
        businessSubject: record.businessSubject?.name || null,
        businessSubjectId: record.businessSubject?.id || null,
        readAt,
        summaryAsOf: projection()?.summaryAsOf || null,
        returnRoute: navigation.returnRoute || record.navigationContext?.returnRoute || null,
        filter: navigation.filter || record.navigationContext?.filter || null,
        returnPosition: navigation.returnPosition || record.navigationContext?.returnPosition || null,
        targetRefs: refs,
        stableDetailEntry: selected?.stableDetailEntry || null,
      };
    };
    const getAction = (requestId) => {
      const inbox = parse(inboxKey);
      const payload = Array.isArray(inbox?.requests) ? inbox.requests.find((item) => (item.id || item.requestId) === requestId) : null;
      return payload ? { actionRequestId: requestId, payload: clone(payload) } : null;
    };
    const getTargetDetail = (targetType, targetId) => {
      const record = recordByTarget(targetType, targetId);
      if (!record) return null;
      const summary = summaryFrom(record, targetType);
      const actionRequestId = record.requestRef?.targetId || null;
      return { ...summary, actionRequestId, targetRefs: summary.targetRefs, payload: getAction(actionRequestId)?.payload || {} };
    };
    const rereadTargetSummary = (targetType, targetId, navigation = {}) => summaryFrom(recordByTarget(targetType, targetId), targetType, navigation, nowText());
    const rereadSummary = (requestIds, navigation = {}) => {
      const ids = Array.isArray(requestIds) ? requestIds : [requestIds];
      const readAt = nowText();
      const result = ids.map((id) => summaryFrom(recordByTarget("Action Request", id), "Action Request", navigation, readAt)).filter(Boolean);
      return Array.isArray(requestIds) ? result : result[0] || null;
    };
    const listScenarioSummaries = () => {
      const readAt = nowText();
      return records().map((record) => summaryFrom(record, "Action Request", {}, readAt)).filter(Boolean);
    };
    return Object.freeze({
      getAction,
      getTargetDetail,
      rereadTargetSummary,
      rereadSummary,
      listScenarioSummaries,
      diagnose,
      getSummary: (id) => summaryFrom(recordByTarget("Action Request", id)),
      getTargetSummary: (type, id, navigation = {}) => summaryFrom(recordByTarget(type, id), type, navigation),
      projectionKey,
    });
  }

  const agentProjection = createAgentProjectionReader();
  const agent = Object.freeze({
    submitGeneration: agentProjection.publishGeneration,
    getGeneration: agentProjection.readGeneration,
    completeGeneration: () => null,
    submitQA: agentProjection.submit,
    getQA: agentProjection.readRecord,
    getByComparisonRecord: agentProjection.readRecord,
    completeQA: () => null,
    submitExplanation: agentProjection.submit,
    getExplanation: agentProjection.readRecord,
    completeExplanation: () => null,
    submitInsight: () => ({ owner: "Agent 应用", status: "等待真实 C020 交换", runId: null, resultId: null }),
    getInsight: agentProjection.readRecord,
    completeInsight: () => null,
    requestInsightConfirmation: () => null,
    getC025: agentProjection.readRecord,
    getAny: (key) => agentProjection.readRecord(key) || agentProjection.readGeneration(key),
    c025StorageKey: agentProjection.storageKey,
    c022StorageKey: agentProjection.c022StorageKey,
  });
  const trust = createTrustOwner();
  const decisionProjection = createDecisionProjectionReader();
  const decision = Object.freeze({
    ...decisionProjection,
    submitAction(payload) {
      const requestId = payload?.requestId || payload?.id || null;
      if (!requestId) return { outcome: "rejected", status: "请求已拒绝", reason: "缺少 Action Request 稳定标识" };
      const context = payload.scenarioContext || {};
      const active = (() => { try { const raw = JSON.parse(localStorage.getItem(PLATFORM_SCENARIO_CONTEXT_KEY) || "null") || {}; return raw.scenarioContext || raw; } catch (_) { return {}; } })();
      const contextReady = ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => context[field] && context[field] === active[field]);
      if (!contextReady) return { outcome: "rejected", status: "请求已拒绝", reason: "Action Request 场景、版本或轮次与当前工作投影不一致" };
      const envelope = {
        contractCode: "C011",
        schemaVersion: 1,
        owner: "报告中心",
        consumer: "决策中心",
        scenarioContext: clone(context),
        formedAt: nowText(),
        requests: (() => {
          const existing = readOwnerStore("ontology3.decision-center.c011.inbox.v1", null);
          const values = Array.isArray(existing?.requests) ? existing.requests : [];
          const conflict = values.find((item) => (item.requestId || item.id) === requestId
            && !["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => item.scenarioContext?.[field] && item.scenarioContext[field] === context[field]));
          if (conflict) return null;
          return [...values.filter((item) => (item.requestId || item.id) !== requestId), clone(payload)];
        })(),
      };
      if (!envelope.requests) return { outcome: "rejected", status: "请求已拒绝", reason: "同一 Action Request 标识已属于其他场景轮次，未覆盖原记录" };
      writeOwnerStore("ontology3.decision-center.c011.inbox.v1", envelope);
      return { outcome: "submitted", status: "已提交，等待决策中心接收", actionRequestId: requestId, acceptedAt: null, payload: clone(payload) };
    },
    getSubmissionResult(requestId) {
      const summary = decisionProjection.rereadSummary(requestId);
      return summary?.sourceRequestId
        ? { outcome: "accepted", status: summary.status || "请求已接收", actionRequestId: summary.sourceRequestId, summary, readAt: summary.readAt }
        : { outcome: "unknown", status: "等待决策中心接收", reason: "C019 尚未形成该 Action Request 的稳定引用；缺失不等于请求未形成。", actionRequestId: requestId, readAt: nowText() };
    },
    reset() {},
  });
  const resetAll = () => {
    trust.reset();
  };

  window.RC_EXTERNAL_OWNERS = Object.freeze({ agent, trust, decision, resetAll });
})();
