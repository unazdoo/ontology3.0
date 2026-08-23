(() => {
  "use strict";

  const RESOURCE_PATH = "../scenarios/s003/resources/m05/agent-position.v7.json";
  const SCENARIO_RESOURCE_ROOT = "../scenarios/s003/";
  const STORAGE_ROOT = "ofw:v1.1.0";
  const STORAGE_SCOPE = "m05";
  const MODEL_KEY = "agent-application.catalog.model.v23";
  const PROJECTION_SCHEMA_VERSION = "ofw.s003.m05.agent-model-projection.v1";
  const SCENARIO_PROFILE_VERSION = "ofw.s003.m05.report-copilot-profile.v4";
  let positionConfig = null;
  let positionLoadPromise = null;
  let currentProjectionIssue = null;
  let moduleHealth = { status: "checking", detail: "正在校验 S003 Agent 场景配置与正式报告资源。", error: null };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function fail(message, code = "INVALID_S003_AGENT_PROFILE") {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function requireValue(value, message) {
    if (value === undefined || value === null || value === "") fail(message);
    return value;
  }

  function readScenarioContext() {
    const params = new URLSearchParams(window.location.search);
    return {
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"),
      status: params.get("scenarioStatus") || params.get("status") || "active",
      baselineVersion: params.get("baselineVersion"),
      baselineSnapshotId: params.get("baselineSnapshotId")
    };
  }

  function isActive(context = readScenarioContext()) {
    return context?.scenarioId === "S003";
  }

  function isReadOnly(context = readScenarioContext()) {
    const params = new URLSearchParams(window.location.search);
    return isActive(context) && (context?.status !== "active"
      || params.has("checkpoint")
      || params.get("mode") === "historical-readonly");
  }

  function sameScenario(left, right) {
    return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"]
      .every((field) => left[field] && left[field] === right[field]));
  }

  function assertContext(context = readScenarioContext()) {
    if (!isActive(context) || !context.scenarioVersion || !context.scenarioRunId || !context.formedAt) {
      fail("S003 M05 命名空间缺少完整场景运行身份", "MISSING_SCENARIO_IDENTITY");
    }
    return context;
  }

  function foundationContext(context = readScenarioContext()) {
    const value = assertContext(context);
    return {
      scenarioId: value.scenarioId,
      scenarioVersion: value.scenarioVersion,
      scenarioRunId: value.scenarioRunId,
      formedAt: value.formedAt,
      status: value.status
    };
  }

  function scenarioIdentity(context = readScenarioContext()) {
    return foundationContext(context);
  }

  function physicalKey(context = readScenarioContext()) {
    const value = assertContext(context);
    return `${STORAGE_ROOT}:${value.scenarioId}:${value.scenarioVersion}:${value.scenarioRunId}:${STORAGE_SCOPE}:${encodeURIComponent(MODEL_KEY)}`;
  }

  function namespaceAdapter(context, storage) {
    if (!window.OFWScenarioFoundation?.createNamespacedStorage) {
      fail("S003 M05 未加载场景 Foundation，拒绝回退平台固定存储键", "MISSING_FOUNDATION");
    }
    return window.OFWScenarioFoundation.createNamespacedStorage({
      storage,
      context: foundationContext(context),
      scope: STORAGE_SCOPE
    });
  }

  function isolateProjection(error, context = readScenarioContext()) {
    currentProjectionIssue = {
      code: error?.code || "INCOMPATIBLE_PROJECTION",
      isolated: true,
      reason: `S003 M05 当前工作投影不可兼容读取：${error?.message || "记录损坏"}`,
      recovery: "原命名空间记录保持不变；平台通用 Agent 目录从正式初始目录只读装入，不删除历史运行或证据。",
      physicalKey: (() => { try { return physicalKey(context); } catch (_) { return null; } })(),
      detectedAt: new Date().toISOString()
    };
    moduleHealth = { status: "warning", detail: `${currentProjectionIssue.reason}；正式场景配置仍可只读装入。`, error: null };
    return null;
  }

  function getProjectionIssue() {
    return clone(currentProjectionIssue);
  }

  function parseEnvelope(raw, context) {
    if (raw === null) return null;
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (_) {
      fail("S003 M05 命名空间记录不是有效 JSON", "INVALID_PROJECTION_JSON");
    }
    if (envelope?.schemaVersion !== window.OFWScenarioFoundation?.STORAGE_SCHEMA_VERSION
      || !sameScenario(envelope?.scenarioContext, context)) {
      fail("S003 M05 命名空间 envelope 与当前 scenarioRunId 不一致", "PROJECTION_IDENTITY_MISMATCH");
    }
    return clone(envelope.payload);
  }

  function assertProjection(payload, context) {
    if (!payload || payload.projectionSchemaVersion !== PROJECTION_SCHEMA_VERSION) {
      fail("S003 M05 工作投影 schemaVersion 不兼容", "INCOMPATIBLE_PROJECTION");
    }
    if (!sameScenario(payload.scenarioContext, context) || !payload.model || typeof payload.model !== "object") {
      fail("S003 M05 工作投影缺少当前运行身份或 Agent 模型", "PROJECTION_IDENTITY_MISMATCH");
    }
    return clone(payload.model);
  }

  function validatePosition(profile) {
    if (!["ofw.s003.m05.agent-position.v4", "ofw.s003.m05.agent-position.v5", "ofw.s003.m05.agent-position.v6", "ofw.s003.m05.agent-position.v7"].includes(profile?.schemaVersion)) fail("S003 M05 场景配置 schemaVersion 不兼容");
    if (profile?.moduleId !== "M05" || profile?.dedicatedAgent !== false) fail("S003 M05 场景配置违反一期 Agent 边界");
    const identity = profile.scenarioIdentity || {};
    if (identity.scenarioId !== "S003" || identity.scenarioVersion !== "S003-v1" || !identity.sourceScenarioRunId) {
      fail("S003 M05 场景配置缺少正式来源运行身份");
    }
    const agent = profile.scenarioProfile || {};
    [agent.baseAgentId, agent.baseReleaseVersion, agent.derivedReleaseVersion, agent.bindingId, agent.inputContract, agent.outputContract]
      .forEach((value) => requireValue(value, "S003 M05 场景配置缺少 Agent Release 合同"));
    if (agent.baseAgentId !== "report-copilot" || agent.baseReleaseVersion === agent.derivedReleaseVersion) {
      fail("S003 M05 必须从平台 report-copilot 的独立派生 Release 装入");
    }
    requireValue(agent.prompt?.id, "S003 M05 缺少场景 Prompt");
    requireValue(agent.prompt?.version, "S003 M05 缺少场景 Prompt 版本");
    if (!Array.isArray(agent.skills) || !agent.skills.length || !Array.isArray(agent.tools) || !agent.tools.length) {
      fail("S003 M05 场景 Release 缺少 Skill 或工具白名单");
    }
    const model = profile.publishedModel || {};
    [model.pointerId, model.pointerVersion, model.pointerRef, model.packageId, model.packageVersion, model.semanticVersionId]
      .forEach((value) => requireValue(value, "S003 M05 缺少 Published 模型身份"));
    if (model.semanticVersionId !== `${model.packageId}@${model.packageVersion}`) fail("S003 M05 semanticVersionId 与模型包版本不一致");
    const report = profile.reportBinding || {};
    [report.manifestId, report.manifestRef, report.contentSetId, report.contentRef, report.reportId, report.contentVersion, report.artifactId, report.artifactRef, report.verificationRef]
      .forEach((value) => requireValue(value, "S003 M05 缺少正式报告绑定"));
    if (profile.lifecyclePolicy?.materializeFrom !== "C024"
      || profile.lifecyclePolicy?.profileCreatesEvidenceRunSession !== false
      || profile.lifecyclePolicy?.requiresExactScenarioRunId !== true) {
      fail("S003 M05 场景配置必须声明仅由同轮真实 C024 形成 Evidence、Session、Run 与 Result");
    }
    return clone(profile);
  }

  function validateDocuments(profile, documents, context = readScenarioContext()) {
    const next = validatePosition(profile);
    const sourceIdentity = {
      scenarioId: next.scenarioIdentity.scenarioId,
      scenarioVersion: next.scenarioIdentity.scenarioVersion,
      scenarioRunId: next.scenarioIdentity.sourceScenarioRunId
    };
    const pointer = documents?.pointer;
    const manifest = documents?.manifest;
    const contents = documents?.contents;
    const artifacts = documents?.artifacts;
    const definition = documents?.definition;
    const template = documents?.template;
    const assurance = documents?.assurance;
    if (!pointer || !manifest || !contents || !artifacts || !definition || !template || !assurance) {
      fail("S003 M05 正式资源校验资料不完整");
    }
    if (pointer.pointerId !== next.publishedModel.pointerId || pointer.pointerVersion !== next.publishedModel.pointerVersion) fail("S003 M05 Published pointer 身份不一致");
    if (pointer.activeTarget?.packageId !== next.publishedModel.packageId
      || pointer.activeTarget?.packageVersion !== next.publishedModel.packageVersion
      || pointer.activeTarget?.lifecycleStatus !== "published") fail("S003 M05 Published 模型目标不一致");
    const manifestReport = (manifest.reports || []).find((item) => item.reportId === next.reportBinding.reportId);
    const contentRecord = (contents.reports || []).find((item) => item.reportId === next.reportBinding.reportId);
    const artifact = (artifacts.artifacts || []).find((item) => item.artifactId === next.reportBinding.artifactId);
    if (!manifestReport || !contentRecord?.content || !artifact) fail("S003 M05 无法定位配置指定的正式报告、内容或产物");
    if (!sameScenario(pointer.scenarioIdentity, sourceIdentity)
      || !sameScenario(manifestReport.scenarioIdentity, sourceIdentity)
      || !sameScenario(contentRecord.content.scenarioIdentity, sourceIdentity)
      || !sameScenario(artifact.deepLink?.parameters, sourceIdentity)) fail("S003 M05 M01/M06 正式资源的场景身份不一致");
    if (manifest.manifestId !== next.reportBinding.manifestId
      || contents.contentSetId !== next.reportBinding.contentSetId
      || artifacts.artifactSetId !== next.reportBinding.artifactSetId) fail("S003 M05 报告资源集合身份不一致");
    if (manifestReport.contentVersion !== next.reportBinding.contentVersion
      || contentRecord.contentVersion !== next.reportBinding.contentVersion
      || artifact.contentVersion !== next.reportBinding.contentVersion) fail("S003 M05 报告内容版本不一致");
    if (manifestReport.contentSha256 !== next.reportBinding.contentSha256
      || contentRecord.contentSha256 !== next.reportBinding.contentSha256
      || artifact.contentSha256 !== next.reportBinding.contentSha256) fail("S003 M05 报告内容哈希不一致");
    if (manifestReport.artifactSha256 !== next.reportBinding.artifactSha256
      || artifact.artifactSha256 !== next.reportBinding.artifactSha256) fail("S003 M05 报告产物哈希不一致");
    if (definition.definitionId !== next.reportBinding.formalReportDefinitionId
      || definition.definitionVersion !== next.reportBinding.formalReportDefinitionVersion) fail("S003 M05 报告定义身份不一致");
    if (template.templateId !== next.reportBinding.formalReportTemplateId
      || template.templateVersion !== next.reportBinding.formalReportTemplateVersion) fail("S003 M05 报告模板身份不一致");
    if (assurance.profileId !== next.reportBinding.assuranceProfileId
      || assurance.profileVersion !== next.reportBinding.assuranceProfileVersion) fail("S003 M05 核验配置身份不一致");
    const verification = contentRecord.content.verificationSummary || {};
    const expectedVerification = next.reportBinding.verificationSummary || {};
    if (verification.deterministic !== true
      || verification.checkCount !== expectedVerification.checkCount
      || verification.passedCount !== expectedVerification.passedCount
      || verification.result !== expectedVerification.result
      || verification.clientSideScoreRecalculation !== expectedVerification.clientSideScoreRecalculation) {
      fail(`S003 M05 正式报告未提供通过的 ${expectedVerification.checkCount || "预期"} 项确定性核验摘要`);
    }
    next.resolvedResources = {
      publishedTarget: clone(pointer.activeTarget),
      manifestReport: clone(manifestReport),
      reportContent: clone(contentRecord.content),
      artifact: clone(artifact),
      assurance: clone(assurance)
    };
    if (isActive(context) && context.scenarioRunId !== next.scenarioIdentity.sourceScenarioRunId) {
      next.currentRunCompatible = false;
      next.currentRunIssue = `当前运行 ${context.scenarioRunId} 与正式报告来源 ${next.scenarioIdentity.sourceScenarioRunId} 不一致`;
    } else {
      next.currentRunCompatible = true;
      next.currentRunIssue = null;
    }
    return next;
  }

  function scenarioResourceUrl(ref) {
    return `${SCENARIO_RESOURCE_ROOT}${String(ref || "").replace(/^\.\//, "")}`;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) fail(`读取 ${path} 失败（HTTP ${response.status}）`, "RESOURCE_FETCH_FAILED");
    return response.json();
  }

  async function initialize() {
    if (!isActive()) return null;
    if (positionConfig) return clone(positionConfig);
    if (positionLoadPromise) return positionLoadPromise;
    positionLoadPromise = (async () => {
      try {
        const profile = validatePosition(await fetchJson(RESOURCE_PATH));
        const refs = profile.reportBinding;
        const [pointer, manifest, contents, artifacts, definition, template, assurance] = await Promise.all([
          fetchJson(scenarioResourceUrl(profile.publishedModel.pointerRef)),
          fetchJson(scenarioResourceUrl(refs.manifestRef)),
          fetchJson(scenarioResourceUrl(refs.contentRef)),
          fetchJson(scenarioResourceUrl(refs.artifactRef)),
          fetchJson(scenarioResourceUrl(refs.formalReportDefinitionRef)),
          fetchJson(scenarioResourceUrl(refs.formalReportTemplateRef)),
          fetchJson(scenarioResourceUrl(refs.assuranceProfileRef))
        ]);
        positionConfig = validateDocuments(profile, { pointer, manifest, contents, artifacts, definition, template, assurance });
        moduleHealth = positionConfig.currentRunCompatible
          ? { status: currentProjectionIssue ? "warning" : "healthy", detail: "平台通用报告伴读 Agent 已通过正式 M01/M06 资源校验并装入 S003 派生 Release。", error: null }
          : { status: "warning", detail: `${positionConfig.currentRunIssue}；保留平台 Agent 目录，不物化 Evidence、Run、Session 或 Result。`, error: null };
        return clone(positionConfig);
      } catch (error) {
        positionConfig = null;
        moduleHealth = { status: "blocked", detail: error.message || "S003 Agent 场景配置校验失败", error: error.message || "配置校验失败" };
        return null;
      } finally {
        positionLoadPromise = null;
      }
    })();
    return positionLoadPromise;
  }

  function installPositionForTesting(profile, documents = null, context = readScenarioContext()) {
    positionConfig = documents ? validateDocuments(profile, documents, context) : validatePosition(profile);
    return clone(positionConfig);
  }

  function positionForContext(context, override = null) {
    const profile = validatePosition(override || positionConfig);
    if (context.scenarioId !== profile.scenarioIdentity.scenarioId || context.scenarioVersion !== profile.scenarioIdentity.scenarioVersion) {
      fail("S003 M05 配置与当前场景版本不一致", "PROFILE_IDENTITY_MISMATCH");
    }
    if (context.scenarioRunId !== profile.scenarioIdentity.sourceScenarioRunId) {
      fail(`当前运行 ${context.scenarioRunId} 没有同身份正式报告；仅保留平台 Agent 目录，等待同轮真实 C024`, "SOURCE_RUN_MISMATCH");
    }
    return profile;
  }

  function buildPromptResource(profile) {
    const prompt = profile.scenarioProfile.prompt;
    return {
      id: prompt.id,
      name: prompt.name,
      value: {
        version: prompt.version,
        status: prompt.status,
        validatedAt: prompt.validatedAt,
        change: prompt.change,
        variables: clone(prompt.variables),
        contextBoundary: prompt.contextBoundary,
        outputContracts: clone(prompt.outputContracts),
        sections: clone(prompt.sections)
      }
    };
  }

  function buildDerivedRelease(baseRelease, profile) {
    const config = profile.scenarioProfile;
    return {
      ...clone(baseRelease),
      version: config.derivedReleaseVersion,
      basedOnRelease: config.baseReleaseVersion,
      releasedAt: config.prompt.validatedAt,
      validationAt: config.prompt.validatedAt,
      inputContract: config.inputContract,
      outputContract: config.outputContract,
      prompt: { id: config.prompt.id, version: config.prompt.version },
      skills: config.skills.map((item) => ({ id: item.id, version: item.version, scenarioPurpose: item.scenarioPurpose })),
      tools: config.tools.map((item) => item.id),
      ontology: profile.publishedModel.displayName,
      ontologyScope: "企业债务风险正式报告、精确 Published 模型、C035 结果、稳定章节锚点与确定性核验摘要",
      scenarioBinding: {
        id: config.bindingId,
        version: profile.scenarioIdentity.scenarioVersion,
        mode: config.bindingMode,
        scenarioId: profile.scenarioIdentity.scenarioId,
        scenarioLabel: "集团债务风险监测",
        objectScope: `${profile.reportBinding.enterprise.name}（${profile.reportBinding.enterprise.enterpriseId}）正式报告`,
        status: "ready"
      },
      change: profile.reason
    };
  }

  function scenarioCredibility(context, profile) {
    const report = profile.reportBinding;
    const model = profile.publishedModel;
    const data = profile.dataBinding;
    const evidence = profile.evidencePackage;
    const verification = report.verificationSummary;
    const observedAt = profile.runtimeExample.finishedAt;
    return {
      contract: "C017 Agent 安全投影 / S003 报告固定上下文",
      contextStatus: "normal",
      versionBindingSummary: {
        id: `${evidence.requestContextId}-BINDING`,
        version: evidence.requestContextVersion,
        status: "ready",
        label: "报告、模型与数据版本已固定",
        formedAt: evidence.formedAt,
        observedAt,
        t006: "S003 企业债务风险正式数据资产",
        t007: data.dataAssetId,
        t008: data.assessmentAt,
        ontology: model.displayName,
        binding: `${report.reportId} / ${report.contentVersion} / ${evidence.id}`,
        reason: "报告中心固定了同一 scenarioRunId 下的正式报告、Published 模型、数据资产和核验摘要。"
      },
      currentStateSummary: {
        id: `${evidence.requestContextId}-CURRENT`,
        version: evidence.requestContextVersion,
        status: "ready",
        label: "可用于报告伴读",
        observedAt,
        quality: `报告核验 ${verification.passedCount}/${verification.checkCount} 通过`,
        freshness: "评估时点已固定",
        dataQualification: "允许只读解释",
        useConclusion: "仅可解释当前正式报告及包内证据；不得重算评分或触发行动。"
      },
      identities: {
        current: { role: "当前权威", status: "ready", label: "正式报告正在服务", t006: "S003 企业债务风险正式数据资产", t007: data.dataAssetId, t008: data.assessmentAt, reason: "报告、模型、数据与场景轮次一致。" },
        candidate: { role: "候选", status: "unknown", label: "没有待采用候选", t006: "S003 企业债务风险正式数据资产", t007: null, t008: null, reason: "当前伴读只固定正式报告，不推断候选。" },
        previousQualified: { role: "上一具备采用资格", status: "unknown", label: "未提供", t006: "S003 企业债务风险正式数据资产", t007: null, t008: null, reason: "当前请求不需要历史回退。" },
        previousAuthoritative: { role: "上一权威服务", status: "unknown", label: "未提供", t006: "S003 企业债务风险正式数据资产", t007: null, t008: null, reason: "不以历史版本替代当前报告。" }
      },
      ontologyAdoption: { status: "ready", label: "已采用", ontology: model.displayName, dataVersion: data.dataAssetId, observedAt, source: `${model.pointerRef}${model.pointerJsonPointer}` },
      consumptionReadiness: { status: "ready", label: "可供报告伴读", allowedUse: "解释当前报告、核验摘要与证据引用", observedAt, reason: "报告身份、证据包、Published 模型和数据版本均完整。" },
      stableEvidence: { status: "complete", label: "固定证据完整", refs: [report.reportId, report.manifestId, evidence.id, model.pointerId, report.verificationRef], reason: "只提供结构化证据和稳定引用，不复制工作簿或重新计算结果。" },
      postQuality: { status: "complete", label: "未发现新增硬质量问题", checkedAt: observedAt, scope: report.reportId, reason: `${verification.passedCount}/${verification.checkCount} 项确定性核验通过。`, recovery: "报告版本变化时由报告中心提交新的固定上下文。" },
      agentGates: [
        { id: "report-question", name: "报告固定上下文问答", status: "ready", label: "允许", reason: "报告、证据、Published 模型及核验引用完整。", recovery: "版本变化后创建新会话和新运行。" },
        { id: "verification-explain", name: "解释确定性核验", status: "ready", label: "允许", reason: `报告中心已提供 ${verification.passedCount}/${verification.checkCount} 核验摘要。`, recovery: "核验摘要缺失时返回受限说明。" },
        { id: "action-request", name: "创建行动申请", status: "blocked", label: "禁止", reason: "报告伴读只能解释，行动必须由驾驶舱提交并在决策中心人工确认。", recovery: "前往驾驶舱或决策中心通用入口。" }
      ],
      historyDimensions: [
        { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "报告、内容、模型和数据版本均有稳定标识。", checkedAt: observedAt },
        { id: "content-access", name: "内容访问", status: "available", label: "可访问固定报告上下文", reason: "仅访问当前报告结构化内容和证据引用。", checkedAt: observedAt },
        { id: "evidence-completeness", name: "证据完整", status: "complete", label: "完整", reason: "评分、分档、指标、因子和核验引用完整。", checkedAt: observedAt },
        { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "不适用", reason: "报告伴读不负责重跑评估。", checkedAt: observedAt },
        { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "本次只解释已形成的确定性核验摘要。", checkedAt: observedAt }
      ],
      useFlags: { isCurrentAuthoritative: true, hasNewerCandidate: false, canStartNewRun: true, canConfirmNewResult: true, canPrepareActionRequest: false, canUseAsPreviousTrusted: false, historyDisclosureRequired: true },
      scenarioIdentity: scenarioIdentity(context)
    };
  }

  function scenarioEvidence(context, profile) {
    const report = profile.reportBinding;
    const model = profile.publishedModel;
    const data = profile.dataBinding;
    const evidenceConfig = profile.evidencePackage;
    const verification = report.verificationSummary;
    const content = profile.resolvedResources?.reportContent;
    const items = evidenceConfig.evidenceItems.map((item) => ({
      ...clone(item),
      object: report.enterprise.name
    }));
    return {
      id: evidenceConfig.id,
      evidencePackageId: evidenceConfig.id,
      evidencePackageVersion: evidenceConfig.version,
      name: `${report.enterprise.name} 债务风险正式报告证据包`,
      kind: "report",
      status: "ready",
      statusLabel: "可用于伴读",
      currentProjection: true,
      dataVersion: data.dataAssetId,
      dataAssetVersionId: data.dataAssetId,
      dataAsOf: data.assessmentAt,
      ontologyVersion: model.displayName,
      semanticVersionId: model.semanticVersionId,
      quality: `报告核验 ${verification.passedCount}/${verification.checkCount} 通过`,
      freshness: "评估时点已固定",
      authority: "M06 正式报告、M01 Published 模型及 C035 结果的只读固定引用",
      formedAt: evidenceConfig.formedAt,
      previousId: null,
      scenarioContext: scenarioIdentity(context),
      requestContext: {
        id: evidenceConfig.requestContextId,
        version: evidenceConfig.requestContextVersion,
        sourceOwner: "报告中心",
        requestedAt: evidenceConfig.formedAt,
        scenarioId: context.scenarioId,
        scenarioLabel: "集团债务风险监测",
        objectScope: `${report.enterprise.name}（${report.enterprise.enterpriseId}）`,
        expectedOutput: profile.scenarioProfile.outputContract
      },
      credibility: scenarioCredibility(context, profile),
      report: {
        number: report.reportId,
        name: content?.reportTitle || `${report.enterprise.name} 企业债务风险评估报告`,
        contentVersion: report.contentVersion,
        anchor: "key-risk-diagnosis",
        verification: `${report.verificationRef} · ${verification.passedCount}/${verification.checkCount} 通过`,
        artifactId: report.artifactId,
        artifactVersion: report.artifactVersion,
        deepLink: report.deepLink
      },
      items
    };
  }

  function toolTrace(profile, evidence) {
    const report = profile.reportBinding;
    const model = profile.publishedModel;
    const runtime = profile.runtimeExample;
    const mapping = {
      "tool-report-context": { input: `${report.contentRef}${report.contentJsonPointer}`, output: `固定 ${report.reportId} / content ${report.contentVersion}` },
      "tool-evidence-reader": { input: evidence.id, output: `读取 ${evidence.items.length} 项结构化证据` },
      "tool-ontology-reader": { input: `${model.pointerRef}${model.pointerJsonPointer}`, output: `定位 ${model.semanticVersionId}` },
      "tool-verification-reader": { input: report.verificationRef, output: `${report.verificationSummary.passedCount}/${report.verificationSummary.checkCount} 核验通过` },
      "tool-citation-validator": { input: evidence.items.map((item) => item.source).join("；"), output: "全部回答引用可定位" },
      "tool-output-validator": { input: profile.scenarioProfile.outputContract, output: "输出合同校验通过；未产生评分或行动副作用" },
      "tool-report-result-return": { input: runtime.resultId, output: `${runtime.resultReturn.status} · ${runtime.resultReturn.destination}` }
    };
    return profile.scenarioProfile.tools.map((binding, index) => {
      const tool = (window.AGENT_TOOLS || []).find((item) => item.id === binding.id);
      const trace = mapping[binding.id] || { input: "场景固定上下文", output: "完成" };
      return {
        id: `${runtime.runId}-T${index + 1}`,
        toolId: binding.id,
        toolName: tool?.name || binding.id,
        toolVersion: binding.version,
        toolOwner: tool?.owner || "平台通用能力提供方",
        status: "complete",
        duration: `${24 + index * 7}ms`,
        input: trace.input,
        output: trace.output
      };
    });
  }

  function scenarioRun(context, evidence, agent, profile) {
    const runtime = profile.runtimeExample;
    const report = profile.reportBinding;
    const content = profile.resolvedResources?.reportContent;
    const release = agent.releases.find((item) => item.version === agent.activeRelease);
    const indicatorTitles = content?.keyRiskDiagnosis?.indicatorItems?.map((item) => item.title)
      || report.assessment.lowestIndicators;
    const factorTitles = content?.keyRiskDiagnosis?.factorItems?.map((item) => item.title)
      || report.assessment.negativeFactors;
    const finalScore = content?.assessment?.finalScore ?? report.assessment.finalScore;
    const riskTier = content?.assessment?.riskTier?.name || report.assessment.riskTierName;
    const confirmation = runtime.confirmation || { status: "unconfirmed" };
    const result = {
      id: runtime.resultId,
      type: "Report Copilot Result",
      contract: profile.scenarioProfile.outputContract,
      title: `${report.enterprise.name} 风险等级说明`,
      summary: `最终评分 ${finalScore} 分、风险等级为${riskTier}。本轮重点关注 ${indicatorTitles.join("、")}，并跟踪 ${factorTitles.join("、")}。`,
      sections: [
        { title: "风险等级依据", body: "风险等级直接引用 C035 已发布最终评分与分档结果，不在 Agent 应用重新计算。", refs: ["S003-EV-RISK-TIER"] },
        { title: "关键风险关注", body: content?.conclusion || "重点关注低分指标与负向调节因子。", refs: ["S003-EV-WEAKNESS", "S003-EV-FACTOR"] },
        { title: "核验结论", body: `报告中心 ${report.verificationSummary.passedCount} 项确定性核验均通过，回答仅解释当前报告内容版本。`, refs: ["S003-EV-VERIFY", "S003-EV-CONTRACT"] }
      ],
      limitations: "不重算风险评分，不修改调节因子或风险分档，不创建行动申请、负责人待办或通知。",
      confidence: "基于同一 scenarioRunId 下的正式报告、Published 模型、C035 结果和确定性核验摘要。",
      owner: "Agent 应用",
      destination: runtime.resultReturn.destination,
      generatedAt: runtime.finishedAt,
      freshness: "评估时点已固定",
      confirmation: confirmation.status,
      contextStatus: "current"
    };
    if (confirmation.status === "confirmed") {
      result.confirmedBy = confirmation.confirmedBy;
      result.confirmedAt = confirmation.confirmedAt;
    }
    const snapshot = {
      agentId: agent.id,
      agentName: agent.name,
      agentRelease: release.version,
      prompt: clone(release.prompt),
      promptBinding: { ...clone(release.prompt), name: profile.scenarioProfile.prompt.name },
      skills: clone(release.skills),
      skillBindings: release.skills.map((item) => ({ ...clone(item), name: item.scenarioPurpose || item.id })),
      tools: clone(release.tools),
      toolBindings: profile.scenarioProfile.tools.map((item) => ({ id: item.id, name: item.purpose, version: item.version })),
      inputContract: release.inputContract,
      outputContract: release.outputContract,
      expectedOutput: release.outputContract,
      scenarioBinding: clone(release.scenarioBinding),
      scenario: "S003 · 集团债务风险监测",
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      objectScope: `${report.enterprise.name}（${report.enterprise.enterpriseId}）`,
      requestContext: clone(evidence.requestContext),
      reportNumber: report.reportId,
      contentVersion: report.contentVersion,
      evidenceId: evidence.id,
      evidenceName: evidence.name,
      evidencePackageId: evidence.evidencePackageId,
      evidencePackageVersion: evidence.evidencePackageVersion,
      evidenceStatus: evidence.status,
      evidenceAuthority: evidence.authority,
      evidenceFormedAt: evidence.formedAt,
      evidenceItemCount: evidence.items.length,
      evidenceItems: clone(evidence.items),
      semanticVersionId: evidence.semanticVersionId,
      ontology: evidence.ontologyVersion,
      ontologyVersion: evidence.ontologyVersion,
      dataAssetVersionId: evidence.dataAssetVersionId,
      dataVersion: evidence.dataVersion,
      dataAsOf: evidence.dataAsOf,
      quality: evidence.quality,
      freshness: evidence.freshness,
      credibility: clone(evidence.credibility),
      report: clone(evidence.report)
    };
    return {
      id: runtime.runId,
      source: "报告中心 C024",
      status: "complete",
      currentProjection: true,
      attempt: 1,
      createdAt: runtime.createdAt,
      finishedAt: runtime.finishedAt,
      question: runtime.question,
      requestId: evidence.requestContext.id,
      sessionId: runtime.sessionId,
      snapshot,
      steps: [
        { id: `${runtime.runId}-S1`, name: "固定报告上下文", detail: "锁定报告、内容版本、稳定锚点和场景轮次", status: "complete" },
        { id: `${runtime.runId}-S2`, name: "读取正式证据", detail: "读取报告内容、Published 模型、C035 结果与核验摘要", status: "complete" },
        { id: `${runtime.runId}-S3`, name: "校验引用与输出合同", detail: "核对回答引用且没有重算评分或创建行动", status: "complete" },
        { id: `${runtime.runId}-S4`, name: "回传报告伴读结果", detail: "结果返回报告中心当前报告上下文", status: "complete" }
      ],
      toolCalls: toolTrace(profile, evidence),
      result
    };
  }

  function scenarioSession(context, evidence, run, profile) {
    const report = profile.reportBinding;
    const runtime = profile.runtimeExample;
    return {
      id: runtime.sessionId,
      currentProjection: true,
      status: "active",
      bindingId: `${profile.scenarioProfile.bindingId}-${report.enterprise.enterpriseId}`,
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      requestContext: clone(evidence.requestContext),
      reportVersion: `${report.reportId} / ${report.contentVersion}`,
      reportNumber: report.reportId,
      contentVersion: report.contentVersion,
      evidencePackageId: evidence.evidencePackageId,
      evidencePackageVersion: evidence.evidencePackageVersion,
      semanticVersionId: evidence.semanticVersionId,
      ontologyVersion: evidence.ontologyVersion,
      dataAssetVersionId: evidence.dataAssetVersionId,
      dataVersion: evidence.dataVersion,
      anchor: evidence.report.anchor,
      latestRunId: run.id,
      latestResultId: run.result.id,
      verificationSummary: `${report.verificationRef} · ${report.verificationSummary.passedCount}/${report.verificationSummary.checkCount} 通过`,
      verificationRunRef: report.verificationRef,
      currentComparisonRef: null,
      resultReturnStatus: runtime.resultReturn.status === "returned" ? "已返回报告中心" : runtime.resultReturn.status,
      resultReturnedAt: runtime.resultReturn.returnedAt,
      regenerationStatus: "不适用；报告伴读不触发重生成",
      regenerationRef: null
    };
  }

  function safeScenarioCatalog(model) {
    if (!model || !Array.isArray(model.agents)) return clone(model);
    const next = clone(model);
    next.agents = next.agents.map((agent) => ({
      ...agent,
      scenarioAvailability: agent.id === "report-copilot"
        ? { status: "waiting-profile", label: "等待 S003 报告伴读配置" }
        : { status: "not-bound", label: "当前场景未绑定，保留平台目录" }
    }));
    next.evidencePackages = [];
    next.runs = [];
    next.sessions = [];
    next.inboundRequests = [];
    next.drafts = [];
    next.handoffs = [];
    next.orchestrations = [];
    next.staticCatalogStoredAsReference = false;
    delete next.agentOverrides;
    delete next.baseAgentOverrides;
    delete next.baseEvidenceOverrides;
    return next;
  }

  function decorateModelForScenario(model, context = readScenarioContext(), fallbackModel = null, profileOverride = null) {
    if (!model || !Array.isArray(model.agents) || !isActive(context)) return clone(model);
    const profile = positionForContext(context, profileOverride);
    const next = clone(model);
    const catalogAgents = (fallbackModel?.agents || []).length ? fallbackModel.agents : (next.agents || []);
    const fallbackAgent = catalogAgents.find((agent) => agent.id === profile.scenarioProfile.baseAgentId);
    const projectedAgent = [...(next.agents || []), ...(next.agentOverrides || [])].find((agent) => agent.id === profile.scenarioProfile.baseAgentId);
    const baseAgent = clone(projectedAgent || fallbackAgent);
    if (!baseAgent) fail("平台通用报告伴读 Agent 未定位", "BASE_AGENT_MISSING");
    const baseRelease = (baseAgent.releases || []).find((item) => item.version === profile.scenarioProfile.baseReleaseVersion);
    if (!baseRelease) fail("平台通用报告伴读基线 Release 未定位", "BASE_RELEASE_MISSING");
    const derivedRelease = buildDerivedRelease(baseRelease, profile);
    const scenarioAgent = {
      ...baseAgent,
      activeRelease: derivedRelease.version,
      scenario: `S003 · ${profile.scenarioProfile.displayName}`,
      s003ScenarioConfiguration: true,
      scenarioProfile: {
        exportId: profile.exportId,
        exportVersion: profile.exportVersion,
        dedicatedAgent: false,
        displayName: profile.scenarioProfile.displayName,
        sourceScenarioRunId: profile.scenarioIdentity.sourceScenarioRunId
      },
      releases: [derivedRelease, ...(baseAgent.releases || []).filter((item) => item.version !== derivedRelease.version).map(clone)]
    };
    next.scenarioProfileVersion = SCENARIO_PROFILE_VERSION;
    next.currentScenarioContext = scenarioIdentity(context);
    next.agents = catalogAgents.map((agent) => agent.id === scenarioAgent.id
      ? scenarioAgent
      : {
        ...clone(agent),
        scenarioAvailability: { status: "not-bound", label: "当前场景未绑定，保留平台目录" }
      });
    const promptResource = buildPromptResource(profile);
    const prompts = (next.resourceReleases?.prompts || []).filter((item) => item.id !== promptResource.id);
    next.resourceReleases = { ...(next.resourceReleases || {}), prompts: [promptResource, ...prompts] };
    next.staticCatalogStoredAsReference = false;
    delete next.agentOverrides;
    delete next.baseAgentOverrides;
    delete next.baseEvidenceOverrides;
    const recordIdentity = (item) => item?.scenarioContext
      || item?.requestContext
      || item?.snapshot
      || item?.c024?.reportContext?.scenarioContext
      || null;
    const keepScenarioRecord = (item) => {
      const identity = recordIdentity(item);
      if (!identity?.scenarioId) return item?.type === "report-copilot" || item?.kind === "report" || Boolean(item?.c024);
      return sameScenario(identity, context);
    };
    const legacyProfileGenerated = {
      evidencePackages: (next.evidencePackages || []).filter((item) => String(item?.id || "").startsWith("S003-M05-REPORT-EVIDENCE-")),
      runs: (next.runs || []).filter((item) => String(item?.id || "").startsWith("S003-M05-RUN-REPORT-COPILOT-")),
      sessions: (next.sessions || []).filter((item) => String(item?.id || "").startsWith("S003-M05-SESSION-REPORT-COPILOT-")),
      inboundRequests: (next.inboundRequests || []).filter((item) => item?.type === "report-copilot" && !item?.c024 && String(item?.id || "").startsWith("S003-C024-REPORT-COPILOT-"))
    };
    next.profileGeneratedLegacyRecords = {
      ...(next.profileGeneratedLegacyRecords || {}),
      ...Object.fromEntries(Object.entries(legacyProfileGenerated).map(([kind, items]) => [kind, items.map((item) => ({
        ...clone(item),
        projectionStatus: "reclassified",
        reclassificationReason: "旧版场景 profile 预造记录，未经过真实 C024 生命周期；保留只读但退出当前目录。"
      }))]))
    };
    const legacyIds = new Set(Object.values(legacyProfileGenerated).flat().map((item) => item?.id).filter(Boolean));
    next.evidencePackages = (next.evidencePackages || []).filter((item) => !legacyIds.has(item?.id) && keepScenarioRecord(item));
    next.runs = (next.runs || []).filter((item) => !legacyIds.has(item?.id) && keepScenarioRecord(item));
    next.sessions = (next.sessions || []).filter((item) => !legacyIds.has(item?.id) && keepScenarioRecord(item));
    next.inboundRequests = (next.inboundRequests || []).filter((item) => !legacyIds.has(item?.id) && keepScenarioRecord(item));
    next.drafts = (next.drafts || []).filter(keepScenarioRecord);
    next.handoffs = (next.handoffs || []).filter(keepScenarioRecord);
    next.orchestrations = (next.orchestrations || []).filter(keepScenarioRecord);
    next.currentScenarioContext = scenarioIdentity(context);
    return next;
  }

  function readModel(fallbackModel, storage = window.localStorage) {
    const context = readScenarioContext();
    if (!isActive(context)) return null;
    let sourceModel = fallbackModel;
    try {
      const payload = isReadOnly(context)
        ? parseEnvelope(storage.getItem(physicalKey(context)), context)
        : namespaceAdapter(context, storage).get(MODEL_KEY);
      if (payload !== null) {
        const storedModel = assertProjection(payload, context);
        if (storedModel.schemaVersion !== fallbackModel?.schemaVersion) fail("S003 M05 Agent 模型 schemaVersion 不兼容", "INCOMPATIBLE_PROJECTION");
        sourceModel = storedModel;
      }
    } catch (error) {
      isolateProjection(error, context);
      sourceModel = fallbackModel;
    }
    try {
      return decorateModelForScenario(sourceModel, context, fallbackModel);
    } catch (error) {
      moduleHealth = { status: error.code === "SOURCE_RUN_MISMATCH" ? "warning" : "blocked", detail: error.message, error: error.code === "SOURCE_RUN_MISMATCH" ? null : error.message };
      return safeScenarioCatalog(fallbackModel);
    }
  }

  function writeModel(model, storage = window.localStorage) {
    const context = readScenarioContext();
    if (!isActive(context)) return false;
    if (isReadOnly(context)) throw new Error("历史、Checkpoint、恢复或回归上下文为只读，M05 写入已拒绝");
    if (currentProjectionIssue?.isolated) throw new Error("M05 不兼容工作投影已隔离，禁止覆盖原记录；请从统一场景快照克隆恢复");
    namespaceAdapter(context, storage).set(MODEL_KEY, {
      projectionSchemaVersion: PROJECTION_SCHEMA_VERSION,
      scenarioContext: foundationContext(context),
      model: clone(model)
    });
    return true;
  }

  function matchesIdentity(identity, context = readScenarioContext()) {
    return !isActive(context) || sameScenario(identity, context);
  }

  function filterResources(kind, resources = []) {
    return Array.isArray(resources) ? resources : [];
  }

  function ContextBar() {
    if (!isActive()) return null;
    const context = readScenarioContext();
    const issue = getProjectionIssue();
    const readOnly = isReadOnly(context) || Boolean(issue?.isolated);
    return <div className={`s003-agent-context ${readOnly ? "readonly" : ""}`} role="status">
      <div><strong>S003 · 债务风险监测</strong><span>{context.scenarioVersion || "版本缺失"} · {context.scenarioRunId || "轮次缺失"}</span></div>
      <div><span>基线 {context.baselineVersion || "v1.0.3"}</span><span>{context.baselineSnapshotId || "BSL-S001-V103-DE0119608E26"}</span><span>{readOnly ? "只读上下文" : "当前运行可写"}</span></div>
      {issue ? <div className="s003-agent-projection-issue"><strong>本次评估状态需要刷新</strong><span>已保留历史记录；当前页面会从已发布配置重新读取，不影响既有报告和证据。</span></div> : null}
    </div>;
  }

  function BoundaryCard({ agents = [] }) {
    const profile = positionConfig;
    const reportAgent = agents.find((agent) => agent.id === "report-copilot");
    if (!profile) {
      return <Notice kind="danger" title="债务风险报告伴读配置未通过校验">平台通用 Agent 目录仍可只读查看，但不会生成 S003 Evidence、Run、Session 或 Result。{moduleHealth.error ? ` ${moduleHealth.error}` : ""}</Notice>;
    }
    if (!profile.currentRunCompatible) {
      return <Notice kind="warning" title="本轮报告正在准备">当前评估配置已加载，报告结果将在本轮正式结果形成后自动关联；既有报告与配置保持不变。</Notice>;
    }
    return <Notice kind="info" title={`${profile.scenarioProfile.displayName}已装入`}>
      复用平台通用“{reportAgent?.name || "报告伴读与数据核验助手"}”，保留基线 Release {profile.scenarioProfile.baseReleaseVersion}，当前使用派生 Release {profile.scenarioProfile.derivedReleaseVersion}。绑定 {profile.publishedModel.semanticVersionId} 与报告内容 {profile.reportBinding.contentVersion}；只读解释和核验，不重算评分或创建行动申请。
    </Notice>;
  }

  function getEvidenceSourceSummary() {
    const profile = positionConfig;
    if (!profile) return null;
    const report = profile.reportBinding || {};
    const resolved = profile.resolvedResources || {};
    return {
      status: profile.currentRunCompatible ? "ready" : "run-mismatch",
      statusLabel: profile.currentRunCompatible ? "正式资源已核验" : "运行身份不一致",
      lifecycleStatus: "awaiting-c024",
      lifecycleLabel: "等待报告中心 C024",
      lifecycleBoundary: "当前仅展示已核验的正式来源，不创建 Evidence、Request、Binding、Session、Run 或 Result。",
      scenarioIdentity: {
        scenarioId: profile.scenarioIdentity.scenarioId,
        scenarioVersion: profile.scenarioIdentity.scenarioVersion,
        scenarioRunId: profile.scenarioIdentity.sourceScenarioRunId
      },
      report: {
        reportId: report.reportId,
        reportTitle: resolved.reportContent?.reportTitle || `${report.enterprise?.name || "企业"} 企业债务风险评估报告`,
        enterpriseName: report.enterprise?.name,
        enterpriseId: report.enterprise?.enterpriseId,
        contentVersion: report.contentVersion,
        manifestId: report.manifestId,
        artifactId: report.artifactId,
        artifactVersion: report.artifactVersion
      },
      publishedModel: {
        semanticVersionId: profile.publishedModel.semanticVersionId,
        pointerId: profile.publishedModel.pointerId,
        lifecycleStatus: profile.publishedModel.lifecycleStatus
      },
      data: {
        dataAssetId: profile.dataBinding.dataAssetId,
        humanInputSnapshotId: profile.dataBinding.humanInputSnapshotId,
        assessmentAt: profile.dataBinding.assessmentAt
      },
      verification: {
        result: report.verificationSummary?.result,
        passedCount: report.verificationSummary?.passedCount,
        checkCount: report.verificationSummary?.checkCount,
        reference: report.verificationRef
      },
      issue: profile.currentRunIssue || null
    };
  }

  function EvidenceSourceCard() {
    if (!isActive()) return null;
    const summary = getEvidenceSourceSummary();
    if (!summary) {
      return <Notice kind="danger" title="S003 正式报告来源尚未通过校验">Agent 生命周期保持为空，不会用配置数据预造证据或结果。</Notice>;
    }
    const ready = summary.status === "ready";
    return <section className="panel">
      <div className="panel-head"><div><h2>S003 正式报告上下文来源</h2><p>供报告伴读请求选择和核对；不等同于 Agent 固定证据包或生成结果。</p></div><StatusBadge status={ready ? "ready" : "warning"} label={summary.statusLabel}></StatusBadge></div>
      <div className="panel-body stack">
        <Notice kind={ready ? "info" : "warning"} title={summary.lifecycleLabel}>{summary.lifecycleBoundary}{summary.issue ? ` ${summary.issue}` : " 只有报告中心提交同一 scenarioRunId 的真实 C024 后，才能接收并形成当前固定 Evidence。"}</Notice>
        <div className="summary-grid">
          <div className="summary-cell"><span>正式企业报告</span><strong>{summary.report.enterpriseName}</strong><small>{summary.report.contentVersion} · {summary.report.reportId}</small></div>
          <div className="summary-cell"><span>Published 模型</span><strong>{summary.publishedModel.semanticVersionId}</strong><small>{summary.publishedModel.pointerId}</small></div>
          <div className="summary-cell"><span>数据与评估时点</span><strong>{summary.data.assessmentAt}</strong><small>{summary.data.dataAssetId}</small></div>
          <div className="summary-cell"><span>确定性核验</span><strong>{summary.verification.passedCount}/{summary.verification.checkCount} 通过</strong><small>{summary.verification.reference}</small></div>
        </div>
        <div className="resource-directory">
          <div className="resource-directory-row"><span className="resource-icon"><Icon name="file-check-2"></Icon></span><div><strong>{summary.report.reportTitle}</strong><small>{summary.report.manifestId} · 内容版本 {summary.report.contentVersion}</small></div><span>{summary.report.artifactVersion}</span><StatusBadge status="published" label="正式报告"></StatusBadge></div>
          <div className="resource-directory-row"><span className="resource-icon"><Icon name="package-check"></Icon></span><div><strong>报告产物与固定引用</strong><small>{summary.report.artifactId}</small></div><span>{summary.scenarioIdentity.scenarioRunId}</span><StatusBadge status="ready" label="同轮可定位"></StatusBadge></div>
        </div>
      </div>
    </section>;
  }

  window.S003AgentAdapter = Object.freeze({
    PROJECTION_SCHEMA_VERSION,
    MODEL_KEY,
    readScenarioContext,
    isActive,
    isReadOnly,
    physicalKey,
    initialize,
    installPositionForTesting,
    validatePosition,
    validateDocuments,
    readModel,
    writeModel,
    decorateModelForScenario,
    matchesIdentity,
    getProjectionIssue,
    filterPromptResources: (resources) => filterResources("prompt", resources),
    filterSkillResources: (resources) => filterResources("skill", resources),
    filterToolResources: (resources) => filterResources("tool", resources),
    getPosition: () => clone(positionConfig),
    getEvidenceSourceSummary: () => clone(getEvidenceSourceSummary()),
    getHealth: () => {
      const health = clone(moduleHealth);
      const projectionIssue = getProjectionIssue();
      if (projectionIssue) {
        health.detail = "本次评估状态需要刷新；已保留历史记录，并从已发布配置重新读取。";
        health.error = null;
      } else if (positionConfig && !positionConfig.currentRunCompatible) {
        health.detail = "本轮报告正在准备；当前可继续查看平台 Agent 目录与已发布配置。";
        health.error = null;
      }
      return {
        moduleId: "M05",
        ...health,
        projectionIssue: projectionIssue ? {
          ...projectionIssue,
          reason: "本次评估状态需要刷新",
          recovery: "已保留历史记录，并从已发布配置重新读取。"
        } : null,
        scenarioContext: clone(readScenarioContext()),
        acceptanceReady: false
      };
    },
    ContextBar,
    BoundaryCard,
    EvidenceSourceCard
  });
})();
