(function (root) {
  "use strict";

  // S004 native seed builders. Every builder is a pure function of the active
  // adapter scenario context so a scenario reset (new scenarioRunId) produces
  // a fresh, self-consistent seed set. Business identities cite the frozen
  // S004-v2.0.1 artifacts (read-only provenance); the runtime never rewrites
  // those artifacts or their historical checkpoint chain.

  const SCENARIO_NAME = "财务公司贷款贷前调查";

  const SEMANTIC_VERSION_ID = "SEM-S004-PREFLIGHT-V1";
  const SEMANTIC_VERSION = "V1";
  // C008、C017、Agent 和报告中心必须引用同一个精确 T007；不能另造一套
  // “报告数据版本”标识，否则全链路看似就绪但无法回溯到 M02 已发布资产版本。
  const DATA_VERSION = "DATA-ASSET-S004-20260815-V01";
  const AS_OF = "2026-08-15";
  const T019_RECORD_ID = "REC-T019-S004-20260815";
  const T019_EVIDENCE_ID = "EVID-T019-S004-001";
  const ONTOLOGY_STABLE_ID = "ONT-S004-LOAN-PREFLIGHT";
  const M02_T006 = "DATA-ASSET-S004";
  const M02_ASSET_VERSION = "DATA-ASSET-S004-20260815-V01";
  const M02_RUN_ID = "RUN-S004-20260815-001";
  const M02_DEFINITION_ID = "DEF-S004-20260815-01";
  const M02_SNAPSHOT_ID = "SNAP-S004-DEMO-20260815";
  const M02_REFRESH_TARGET_ID = "T054-S004-PREFLIGHT-001";
  const M02_REFRESH_TARGET_EVIDENCE_ID = "EVID-T054-S004-PREFLIGHT-001";
  const M02_REFRESH_DISCOVERY_ID = "C032-S004-PREFLIGHT-001";
  const M02_REFRESH_REQUEST_ID = "C028-S004-20260815-001";
  const M02_REFRESH_RESULT_ID = "C029-S004-20260815-001";
  const M02_SOURCE_SHA256 = "9a6e3502039beef28ebe1fe10bc046cd4bb0e051b35122b2d6aea1c8c235f6d9";
  const M02_SOURCE_SIZE_BYTES = 20294;
  const M02_ANNUAL_REPORT_2025_SHA256 = "f1ae0b9f53db25faf937d38be0abcee756ea7c8b58c29635aee0335a87904206";
  const M02_ANNUAL_REPORT_2025_SIZE_BYTES = 3123448;
  const T018_EVIDENCE_ID = "T018-S004-20260815-001";
  const REPORT_NO = "S004-PLR-2026-0001";
  const CONTENT_VERSION = "2.0.0";
  const EVIDENCE_PACK_ID = "EVID-S004-20260815-0002";
  const DEFINITION_ID = "RDEF-S004-PREFLIGHT-002";
  const AGENT_RUN_ID = "ARUN-S004-20260815-0002";
  const AGENT_RESULT_ID = "RES-S004-20260815-002";
  const AGENT_SESSION_ID = "RSESSION-S004-20260815-002";
  const COPILOT_RUN_ID = "ARUN-S004-20260815-0002-COPILOT";
  const COPILOT_SESSION_ID = "RSESSION-S004-20260815-002-COPILOT";
  const C022_REQUEST_ID = "C022-S004-20260815-0001";
  const C024_REQUEST_ID = "C024-S004-20260815-0001";

  // M05 must point at resources that already exist in the frozen v1.0.3
  // Agent catalog.  S004's formal configuration identifiers remain
  // provenance metadata; they are not substituted for shared Prompt/Skill/
  // Tool catalog identities.
  const BASELINE_REPORT_DRAFT_RESOURCES = Object.freeze({
    prompt: Object.freeze({ id: "prompt-report-draft", version: "1.0" }),
    skills: Object.freeze([{ id: "skill-report-organization", version: "1.0" }]),
    tools: Object.freeze([
      "tool-evidence-reader",
      "tool-ontology-reader",
      "tool-citation-validator",
      "tool-output-validator",
      "tool-report-draft-handoff"
    ])
  });
  const BASELINE_REPORT_COPILOT_RESOURCES = Object.freeze({
    prompt: Object.freeze({ id: "prompt-report-reading", version: "1.0" }),
    skills: Object.freeze([
      { id: "skill-report-reading", version: "1.0" },
      { id: "skill-semantic-rule-explain", version: "1.0" },
      { id: "skill-verification-explain", version: "1.0" }
    ]),
    tools: Object.freeze([
      "tool-report-context",
      "tool-evidence-reader",
      "tool-ontology-reader",
      "tool-verification-reader",
      "tool-citation-validator",
      "tool-output-validator",
      "tool-report-result-return"
    ])
  });

  const C017_NOT_DECLARED = "本制品未声明";
  const C017_CONFIDENCE_LABELS = Object.freeze({
    identity: "主体身份",
    financialStatements: "财务报表",
    calculatedMetrics: "计算指标",
    operatingAndIndustryNarrative: "经营与行业叙述",
    customerSpecificInternalFacts: "客户专属内部事实",
    creditDecision: "授信结论"
  });

  function immutableCopy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function c017ConfidenceSummary(c017Artifact) {
    const entries = Object.entries(c017Artifact?.confidence || {});
    if (!entries.length) return C017_NOT_DECLARED;
    return entries.map(([key, value]) => `${C017_CONFIDENCE_LABELS[key] || key}：${value}`).join("；");
  }

  function buildM05C017Credibility(context, ids, c017Artifact, reportEvidence, c022Trust, now) {
    const sourceSummaryId = c017Artifact?.summaryId || C017_NOT_DECLARED;
    const sourceOwner = c017Artifact?.owner || C017_NOT_DECLARED;
    const sourceFormedAt = c017Artifact?.formedAt || C017_NOT_DECLARED;
    const sourceStatus = c017Artifact?.status || C017_NOT_DECLARED;
    const sourceSchema = c017Artifact?.schemaVersion || C017_NOT_DECLARED;
    const confidence = c017ConfidenceSummary(c017Artifact);
    const fixedDataVersion = ids.dataVersion || C017_NOT_DECLARED;
    const fixedAsOf = reportEvidence?.packageValue?.asOf || AS_OF || C017_NOT_DECLARED;
    const fixedOntology = ids.semanticVersion ? `贷前调查本体 · Published ${ids.semanticVersion}` : C017_NOT_DECLARED;
    const operationalReason = "历史报告、历史 Run/Result/Session 与历史 Checkpoint 保持不可变；当前隔离 scenarioRunId 可基于固定证据包追加新的 C022/C024、Run、Result、Session、结构化草稿和确定性核验记录。";
    const missingReason = "字段在当前 C017 正式制品中未声明；不由 Agent、工作簿或模拟源节点补造。";
    const currentStatus = sourceStatus === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "warning" : "unknown";
    const currentLabel = sourceStatus === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "演示条件可信 · 当前轮次可消费" : C017_NOT_DECLARED;
    return {
      contract: "C017 Agent 安全投影",
      contextStatus: "current-scenario-operational",
      lastReadAt: now,
      externalAuthority: {
        owner: sourceOwner,
        sourceReference: sourceSummaryId,
        formedAt: sourceFormedAt,
        status: sourceStatus,
        schemaVersion: sourceSchema,
        sourceScenarioContext: c017Artifact?.scenarioContext || null
      },
      versionBindingSummary: {
        id: `C017-BIND-${context.scenarioRunId}`,
        sourceSummaryId,
        sourceOwner,
        sourceSchemaVersion: sourceSchema,
        version: c022Trust.currentStatusSummaryVersion || "2.0.0",
        formedAt: sourceFormedAt,
        ontology: fixedOntology,
        t006: ids.dataAssetId || C017_NOT_DECLARED,
        t007: fixedDataVersion,
        t008: fixedAsOf,
        t008Source: "固定证据包 authoritativeBinding.asOf；C017 原制品未单列时点来源",
        binding: `${ids.semanticVersionId || C017_NOT_DECLARED} / ${ids.dataAssetVersion || C017_NOT_DECLARED} / ${ids.evidencePackId || C017_NOT_DECLARED}`,
        reason: "仅绑定当前场景固定的 Published/C008/证据包身份；C017 未声明字段保持显式缺失，不跨模块推断。"
      },
      currentStateSummary: {
        id: sourceSummaryId,
        version: c022Trust.currentStatusSummaryVersion || "2.0.0",
        status: currentStatus,
        label: currentLabel,
        sourceOwner,
        sourceReference: sourceSummaryId,
        sourceFormedAt,
        observedAt: sourceFormedAt,
        quality: confidence,
        freshness: `${C017_NOT_DECLARED}；固定证据截至 ${fixedAsOf}`,
        factAge: C017_NOT_DECLARED,
        freshnessThreshold: C017_NOT_DECLARED,
        freshnessThresholdOwner: C017_NOT_DECLARED,
        applicableScope: `S004 · ${c017Artifact?.consumer || "M05/M06"} · 当前隔离轮次固定证据消费`,
        dataQualification: "允许固定证据包内的报告草稿生成、报告问答与核验解释",
        refresh: `${C017_NOT_DECLARED}；已发布报告不随刷新原地更新`,
        activeDataVersion: fixedDataVersion,
        activeDataAsOf: fixedAsOf,
        recovery: "身份、质量或证据发生变化时创建新的固定上下文和内容版本；已发布报告不原地更新。",
        useConclusion: `${operationalReason} 不得扩展读取工作簿、源节点或包外业务明细。 ${missingReason}`
      },
      identities: {
        current: { role: "当前权威", status: currentStatus, label: currentLabel, t006: ids.dataAssetId, t007: fixedDataVersion, t008: fixedAsOf, reason: "由当前固定证据包和 C008/T019 绑定；C017 由数据工程提供安全投影。" },
        candidate: { role: "较新候选", status: "unknown", label: C017_NOT_DECLARED, reason: missingReason },
        previousQualified: { role: "上一具备采用资格", status: "unknown", label: C017_NOT_DECLARED, reason: missingReason },
        previousAuthoritative: { role: "上一权威服务", status: "unknown", label: C017_NOT_DECLARED, reason: missingReason }
      },
      refresh: { status: "unknown", label: C017_NOT_DECLARED, observedAt: sourceFormedAt, resultState: missingReason, recovery: "需要刷新时由数据工程形成新的 C017 摘要和数据资产版本；不得静默改写当前固定证据包。" },
      ontologyAdoption: { status: "ready", label: "已采用（C008/T019）", ontology: fixedOntology, dataVersion: fixedDataVersion, observedAt: sourceFormedAt, source: "C008/T019 权威指针；不由 C017 自行采用" },
      consumptionReadiness: { status: "ready", label: "当前轮次可消费", allowedUse: "接收完整 C022/C024，追加新的 Run、Result、Session、草稿与核验解释；正式发布仍由报告中心负责", observedAt: sourceFormedAt, reason: operationalReason, recovery: "身份或用途变化时由报告中心形成新的固定上下文。" },
      stableEvidence: { status: "complete", label: "稳定身份可定位", checkedAt: C017_NOT_DECLARED, refs: [sourceSummaryId, ids.semanticVersionId, fixedDataVersion, fixedAsOf, ids.evidencePackId].filter(Boolean), reason: "身份来自 Published/C008/固定证据包；不暴露工作簿或原始源节点。" },
      postQuality: { status: "warning", label: "演示条件可信", checkedAt: sourceFormedAt, scope: fixedDataVersion, reason: "身份、财报与确定性指标具备高可信度；客户专属外部资料为合成演示数据，必须保留来源标签。", recovery: "切换真实借款人时替换相应来源槽并重新执行数据质量门。" },
      agentGates: [
        { id: "new-run", name: "发起新运行", status: "ready", label: "允许当前轮次追加", reason: operationalReason, recovery: "固定身份或证据版本变化时创建新的请求上下文，不覆盖旧运行。" },
        { id: "report-draft-transfer", name: "移交报告草稿评审副本", status: "ready", label: "允许", reason: "完整 C022、固定证据包和精确版本身份已满足；可生成新的结构化草稿并由报告中心创建复核副本。", recovery: "缺少身份或证据时由报告中心修复 C022 后重新提交。" },
        { id: "report-question", name: "报告快照问答", status: "ready", label: "允许", reason: "完整 C024 将报告、内容版本、稳定锚点、证据包和精确语义/数据版本固定，可创建独立伴读 Run/Result/Session。", recovery: "身份不一致时拒绝该请求，由报告中心提交新的完整 C024。" },
        { id: "verification-explain", name: "解释确定性核验", status: "ready", label: "允许", reason: "可基于报告中心提供的确定性核验引用创建新的解释 Run；Agent 不重新执行确定性计算。", recovery: "核验引用变化时由报告中心形成新的固定 C024 上下文。" },
        { id: "comparison-explain", name: "解释当前比较", status: "blocked", label: C017_NOT_DECLARED, reason: "当前 C017/报告制品未声明 C027 当前比较记录。", recovery: "报告中心提供显式 C027 记录后再解释。" },
        { id: "confirm-result", name: "确认新生成结果", status: "warning", label: "必须人工确认", reason: "Agent 结果可由用户确认其参考价值，但调查意见、风险判断、授信结论和正式发布必须在报告中心由有权人员确认。", recovery: "未经人工确认不得进入新的正式报告内容版本。" },
        { id: "action-request", name: "准备 Action Request", status: "blocked", label: "阻断", reason: "S004 当前无 Action Request；既有报告 Agent 不创建行动申请。", recovery: "如需行动，用户须通过决策中心受控入口提交标准 Action Request。" }
      ],
      historyDimensions: [
        { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "Published/C008、固定数据版本、C017 摘要和报告证据包身份可互相核对。", checkedAt: sourceFormedAt, recovery: "身份不一致时拒绝新运行并保留历史记录。" },
        { id: "content-access", name: "内容访问", status: "available", label: "可访问安全投影", reason: "仅访问结构化事实、固定证据和结果引用，不读取工作簿。", checkedAt: sourceFormedAt, recovery: "来源不可访问时保留历史结果，不补造内容。" },
        { id: "evidence-completeness", name: "证据完整", status: "complete", label: "固定证据可核对", reason: "报告证据包包含事实项、锚点和核验引用；C017 未声明字段不被隐式补齐。", checkedAt: sourceFormedAt, recovery: "缺失必填证据时保持阻断。" },
        { id: "replay-capability", name: "重放能力", status: "unknown", label: C017_NOT_DECLARED, reason: missingReason, checkedAt: C017_NOT_DECLARED, recovery: "只有平台形成真实重放依赖后才能评估。" },
        { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "当前没有历史重放运行的权威记录。", checkedAt: C017_NOT_DECLARED, recovery: "不得把固定证据复核冒充历史重放核验。" }
      ],
      useFlags: {
        isCurrentAuthoritative: true,
        hasNewerCandidate: false,
        canStartNewRun: true,
        canConfirmNewResult: true,
        canPrepareActionRequest: false,
        canUseAsPreviousTrusted: false,
        historyDisclosureRequired: true,
        readOnlyExistingArtifact: false
      }
    };
  }

  const M01_STATE_KEY = "ontology3-canvas-first-review-v17";
  const M02_FLOW_KEY = "ontology3.data-engineering.workspace.v5-handoff";
  // Actual v1.0.3 native storage roots for the two modules whose scenario
  // applicability is bounded in S004.  The runtime proxy isolates these
  // keys per scenarioRunId; the frozen module files remain untouched.
  const M03_STATE_KEY = "ontology3.iq.review.conversation.v1";
  const M03_WORKSPACE_KEY = "ontology3.intelligent-query.workspace.v1";
  const M03_C017_KEY = "ontology3.c017.intelligent-query.projection.v1";
  const M04_STATE_KEY = "ontology3-decision-center-review-v2-portfolio-state-v6";
  const M04_INBOX_KEY = "ontology3.decision-center.c011.inbox.v1";
  const M04_C017_KEY = "ontology3.c017.decision-center.projection.v1";
  const M04_C019_KEY = "ontology3.decision-center.c019.projection.v1";
  // Agent应用.html 的 v1.0.3 冻结入口读取 v7；v8 仅是 data.jsx 的开发投影键。
  const M05_STATE_KEY = "ontology3.agent-application.catalog.v7";
  const M06_STATE_KEY = "ontology3.report-center.lifecycle-review.v1";
  const C022_INBOX_KEY = "ontology3.agent-application.c022-inbox.v1";
  const C024_INBOX_KEY = "ontology3.agent-application.c024-inbox.v1";
  const REPORT_OWNER_RECORD_KEY = "ontology3.agent-application.owner-records.v1";
  const C033_PLATFORM_KEY = "ontology3.0-s001-handoff-v1:scenario-context";
  const SCENARIO_RUNTIME_KEY = "ontology3.platform.scenario-runtime.v1";
  const C008_PROJECTION_KEY = "ontology3-c008-authoritative-projection-v1";
  const C017_REPORT_KEY = "ontology3.c017.report-center.projection.v1";

  function artifactRuntimeIds(artifacts) {
    const published = artifacts?.publishedResources || {};
    const c008 = artifacts?.c008Facts || {};
    const sourceSnapshot = artifacts?.sourceSnapshot || {};
    const reportData = artifacts?.reportData || {};
    const reportDefinition = artifacts?.reportDefinition || {};
    const agent = artifacts?.agentConfig || {};
    const draft = artifacts?.draftOutput || {};
    const evidencePackage = artifacts?.evidencePackage || {};
    const publicationManifest = artifacts?.publicationManifest || {};
    const humanConfirmation = artifacts?.humanConfirmation || {};
    const deterministicVerification = artifacts?.deterministicVerification || {};
    const stableIdentity = sourceSnapshot.stableIdentity || c008.identity || evidencePackage.identity || {};
    const reportIdentity = publicationManifest.reportIdentity || {};
    const formalOutput = (publicationManifest.formalOutputs || [])[0] || {};
    return {
      semanticVersionId: published.publishedPointer || c008.publishedPointer || SEMANTIC_VERSION_ID,
      semanticVersion: published.resourcePackageVersion || c008.ontologyPackageVersion || SEMANTIC_VERSION,
      ontologyStableId: published.resourcePackageId || c008.ontologyPackageId || ONTOLOGY_STABLE_ID,
      dataVersion: reportData.dataVersion || c008.dataVersion || sourceSnapshot.dataVersion || DATA_VERSION,
      t019RecordId: c008.publishedPointer || T019_RECORD_ID,
      t019EvidenceId: c008.t019EvidenceId || c008.publishedEvidenceId || published.t019EvidenceId || T019_EVIDENCE_ID,
      reportId: reportData.reportId || c008.identity?.reportId || stableIdentity.reportId || reportIdentity.reportId || "RPT-S004-20260815-0001",
      reportNo: reportData.reportNumber || reportData.reportNo || stableIdentity.reportNumber || reportIdentity.reportNumber || REPORT_NO,
      contentVersion: reportData.contentVersion || CONTENT_VERSION,
      evidencePackId: evidencePackage.evidencePackageId || reportData.evidencePackageId || reportIdentity.evidencePackageId || EVIDENCE_PACK_ID,
      definitionId: reportDefinition.reportDefinitionId || DEFINITION_ID,
      agentId: agent.agentDefinitionId || "s004-preflight-report",
      agentRelease: agent.agentReleaseVersion || "2.0.0",
      agentRunId: draft.agentRunId || AGENT_RUN_ID,
      agentResultId: draft.resultId || (draft.agentRunId ? `RES-${draft.agentRunId}` : AGENT_RESULT_ID),
      agentSessionId: draft.agentSessionId || AGENT_SESSION_ID,
      dataAssetId: sourceSnapshot.dataAssetId || stableIdentity.dataAssetId || M02_T006,
      dataAssetVersion: sourceSnapshot.dataAssetVersion || stableIdentity.dataAssetVersion || M02_ASSET_VERSION,
      // v1.0.3's report fact-package identity uses the T018 candidate
      // qualification evidence as consumableVersionId.  T019 remains the
      // separately named Published adoption record/evidence on C008.  Keeping
      // these identities distinct lets the frozen report module resolve the
      // exact fact package without weakening the Published/T019 gate.
      consumableVersionId: T018_EVIDENCE_ID,
      verificationRunId: reportData.verificationRunId || deterministicVerification.verificationRunId || "VERIFY-S004-20260815-002",
      humanConfirmationId: reportData.humanConfirmationId || humanConfirmation.confirmationId || "HCONF-S004-20260815-0002",
      publicationId: publicationManifest.publicationId || reportIdentity.publicationId || "PUB-S004-20260815-0003",
      publicationStatus: publicationManifest.status || reportData.publicationStatus || "PUBLISHED",
      htmlFile: formalOutput.file || "RPT-S004-CGNPC-20260815-v2.0.html"
    };
  }

  function artifactMetrics(artifacts, fallback) {
    const metrics = artifacts?.publishedResources?.metrics;
    if (!Array.isArray(metrics) || !metrics.length) return fallback;
    const fallbackByName = new Map((fallback || []).map((item) => [String(item.name || "").trim(), item]));
    return metrics.map((metric, index) => {
      const id = metric.metricId || metric.id || `MET-S004-${String(index + 1).padStart(2, "0")}`;
      // The published artifact intentionally carries the compact Metric
      // contract (id/name/formula/unit).  The v1.0.3 canvas still renders
      // scope, dependencies and time semantics, so merge the richer S004
      // definition by stable business name before decorating the snapshot.
      // Never merge an artifact-only Metric with a fallback at the same
      // array index.  The compact Published artifact contains more metrics
      // than the original six-item display seed, so positional fallback
      // silently assigned e.g. the loan-application scope to ROE.
      const base = fallbackByName.get(String(metric.name || "").trim()) || {};
      const name = metric.name || base.name || id;
      const applicationMetric = id === "MET-WORKING-CAPITAL-NEED"
        || id === "MET-MAX-NEW-WORKING-CAPITAL-LOAN";
      const defaultScope = applicationMetric ? "贷款申请" : "借款人";
      const defaultSourceObjectId = applicationMetric ? "OBJ-LOAN-APPLICATION" : "OBJ-FINANCIAL-STATEMENT-FACT";
      const defaultSubjectObjectId = applicationMetric ? "OBJ-LOAN-APPLICATION" : "OBJ-GROUP-MEMBER-BORROWER";
      const defaultTime = applicationMetric ? "申请与资金需求测算时点" : "报告年度与数据截至时点";
      return {
        ...base,
        ...metric,
        id,
        name,
        code: metric.metricId || metric.id || base.code || id,
        unit: metric.unit || base.unit || "—",
        definition: metric.definition || metric.formula || base.definition || "Published Metric",
        formula: metric.formula || base.formula || base.calculation || "由 M01 确定性指标引擎计算",
        calculation: metric.calculation || base.calculation || metric.formula || "由 Published Metric 固定计算口径执行",
        scope: metric.scope || base.scope || defaultScope,
        time: metric.time || base.time || defaultTime,
        zeroHandling: metric.zeroHandling || base.zeroHandling || "缺少有效分母时返回无法计算",
        dependencyIds: Array.isArray(metric.dependencyIds) && metric.dependencyIds.length ? metric.dependencyIds : (base.dependencyIds || []),
        sourceObjectId: metric.sourceObjectId || base.sourceObjectId || defaultSourceObjectId,
        subjectObjectId: metric.subjectObjectId || base.subjectObjectId || defaultSubjectObjectId,
        owner: metric.owner || base.owner || "本体管理",
        type: "Metric", publicationState: "Published", status: "已发布",
        applicableScenario: metric.applicableScenario || `S004 ${SCENARIO_NAME}`,
        displayPrecision: metric.displayPrecision ?? base.displayPrecision ?? 2,
        valueSource: artifacts?.c008Facts?.metricRun?.results?.find((item) => item.metricId === id) || null
      };
    });
  }

  function artifactRules(artifacts, fallback) {
    const rules = artifacts?.publishedResources?.rules;
    if (!Array.isArray(rules) || !rules.length) return fallback;
    const fallbackByName = new Map((fallback || []).map((item) => [String(item.name || "").trim(), item]));
    return rules.map((rule, index) => {
      const id = rule.ruleId || rule.id || `RULE-S004-${String(index + 1).padStart(2, "0")}`;
      // Keep the compact Published Rule artifact authoritative while
      // retaining the complete v1.0.3 Rule display contract.  Without this
      // merge, the baseline canvas subtitle reads `undefined · undefined`
      // for artifact-only rules that omit code/appliesTo.
      // Rules also outnumber the legacy display seed.  Merge only by stable
      // business name, then fill the missing display contract by Rule ID.
      const base = fallbackByName.get(String(rule.name || "").trim()) || {};
      const defaultsById = {
        "RULE-S004-MEMBER-ACTIVE": {
          appliesTo: "集团成员借款人", objectId: "OBJ-GROUP-MEMBER-BORROWER",
          dependency: "集团成员名录 / memberStatus",
          condition: "借款人在数据截至时点属于集团成员名录且 memberStatus = ACTIVE",
          evidence: "SIM_MEMBER_REGISTRY"
        },
        "RULE-S004-LOAN-MINIMUM-SCOPE": {
          appliesTo: "贷款申请", objectId: "OBJ-LOAN-APPLICATION",
          dependency: "币种、期限、贷款类型、担保方式和资金用途",
          condition: "currency = CNY 且 termMonths = 12 且 loanType = WORKING_CAPITAL 且 guaranteeMode = CREDIT",
          evidence: "SIM_LOAN_APPLICATION"
        },
        "RULE-S004-AMOUNT-WITHIN-FUNDING": {
          appliesTo: "贷款申请", objectId: "OBJ-LOAN-APPLICATION",
          metricIds: ["MET-MAX-NEW-WORKING-CAPITAL-LOAN"],
          dependency: "申请金额 / 新增流动资金贷款额度",
          condition: "requestedAmount <= MET-MAX-NEW-WORKING-CAPITAL-LOAN",
          evidence: "C008 metricRun"
        },
        "RULE-S004-AMOUNT-WITHIN-FACILITY": {
          appliesTo: "贷款申请", objectId: "OBJ-LOAN-APPLICATION",
          dependency: "申请金额 / 内部可用授信额度",
          condition: "requestedAmount <= availableFacility",
          evidence: "SIM_INTERNAL_CREDIT"
        },
        "RULE-S004-REPORT-STRUCTURE-COMPLETE": {
          appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT",
          dependency: "报告定义、模板槽位和稳定锚点",
          condition: "权威示例要求的封面、五部分、数据来源、字段和稳定锚点全部存在",
          evidence: "RDEF-S004-PREFLIGHT-002 / RT-S004-PREFLIGHT-002"
        },
        "RULE-S004-REPORT-FACT-TRACEABLE": {
          appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT",
          dependency: "Published 本体、C008、T044 和固定证据包",
          condition: "每项正式事实均绑定 Published/C008 事实、内容项、稳定锚点和证据引用",
          evidence: "T019-S004-PUBLISHED-002 / C008-S004-AUTHORITATIVE-FACTS-002"
        },
        "RULE-S004-HUMAN-CREDIT-CONCLUSION": {
          appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT",
          dependency: "授信结论人工确认记录",
          condition: "正式授信结论、额度、期限、利率和条件必须引用 human-confirmed 记录",
          evidence: "HCONF-S004-20260815-0002"
        },
        "RULE-S004-RISK-CONTROLLABILITY-HUMAN": {
          appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT",
          dependency: "风险可控性人工确认记录",
          condition: "AI 风险建议只有在有权人员人工确认后才可进入正式判断",
          evidence: "HCONF-S004-20260815-0002"
        },
        "RULE-S004-NO-RAW-SOURCE-CONSUMPTION": {
          appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT",
          dependency: "C022/C024、固定证据包和构建输入清单",
          condition: "Agent 与正式报告构建输入不得包含工作簿、T007 业务明细或来源节点直读引用",
          evidence: "EVID-S004-20260815-0002"
        }
      };
      const displayDefaults = defaultsById[id] || {};
      const name = rule.name || base.name || id;
      return {
        ...base,
        ...rule,
        id,
        name,
        code: rule.code || rule.ruleCode || base.code || id,
        appliesTo: rule.appliesTo || base.appliesTo || displayDefaults.appliesTo || "贷前调查业务对象",
        objectId: rule.objectId || base.objectId || displayDefaults.objectId || null,
        metricIds: Array.isArray(rule.metricIds) ? rule.metricIds : (base.metricIds || displayDefaults.metricIds || []),
        dependency: rule.dependency || base.dependency || displayDefaults.dependency || ((rule.metricIds || base.metricIds || displayDefaults.metricIds || []).join("、") || "固定证据包"),
        owner: rule.owner || base.owner || "本体管理",
        type: "Rule", publicationState: "Published", status: "已发布",
        effect: rule.effect || base.effect || "DETERMINISTIC_GATE",
        condition: rule.condition || base.condition || displayDefaults.condition || "由 M01 确定性规则引擎校验",
        definition: rule.definition || base.definition || name,
        validity: rule.validity || base.validity || "随当前 Published 语义版本生效",
        testSample: rule.testSample || base.testSample || "等待代表性样例",
        bankRanking: rule.bankRanking || base.bankRanking || "—",
        evidence: rule.evidence || base.evidence || displayDefaults.evidence || "固定证据包",
        applicableScenario: rule.applicableScenario || `S004 ${SCENARIO_NAME}`,
        result: artifacts?.c008Facts?.ruleRun?.results?.find((item) => item.ruleId === id) || null
      };
    });
  }

  function ctx5(context) {
    return {
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: context.status
    };
  }

  function namedContext(context) {
    return Object.assign(ctx5(context), { scenarioName: SCENARIO_NAME });
  }

  function stamp(context) {
    return String(context.formedAt || "").replace("T", " ").slice(0, 19);
  }

  function artifactScenarioContext(artifacts) {
    const candidates = [
      artifacts?.publicationManifest?.scenarioContext,
      artifacts?.reportData?.scenarioContext,
      artifacts?.evidencePackage?.scenarioContext,
      artifacts?.c008Facts?.scenarioContext,
      artifacts?.publishedResources?.scenarioContext,
      artifacts?.sourceSnapshot?.scenarioContext
    ].filter(Boolean);
    const source = candidates.find((item) => item.scenarioId && item.scenarioVersion && item.scenarioRunId) || {};
    return {
      baselineVersion: source.baselineVersion || "v1.0.3",
      baselineSnapshotId: source.baselineSnapshotId || "BSL-S001-V103-DE0119608E26",
      scenarioId: source.scenarioId || "S004",
      scenarioVersion: source.scenarioVersion || "S004-v2",
      scenarioRunId: source.scenarioRunId || "S004-RUN-20260815233000000-7f3c8e42a1b6",
      formedAt: source.formedAt || "2026-08-15T23:30:00.000Z"
    };
  }

  function runtimeArtifactProjection(context, artifacts, scope) {
    return {
      projectionId: `ARTIFACT-PROJECTION-${scope}-${context.scenarioRunId}`,
      mode: "EXPLICIT_IMMUTABLE_ARTIFACT_PROJECTION",
      scope,
      sourceScenarioContext: artifactScenarioContext(artifacts),
      targetRuntimeScenarioContext: ctx5(context),
      sourceMutationAllowed: false,
      formalOutputPromotionAllowed: false,
      retainedIdentityPolicy: "保留正式报告、Published/C008、证据包和历史 Run 的原始业务标识；新增运行使用当前隔离 scenarioRunId。",
      migrationRule: "如需迁移正式制品到新基线或新场景版本，必须创建新的 scenarioVersion/scenarioRunId 和迁移对照，不得原地换父版本。"
    };
  }

  // ---------------------------------------------------------------- M01 ----

  function m01Objects() {
    return [
      {
        id: "OBJ-FINANCIAL-COMPANY", name: "财务公司", definition: "集团财务公司，贷前调查的授信主体。",
        identity: "PROP-FC-ID", title: "PROP-FC-NAME", memberId: "S004-MEMBER-FINANCIAL-COMPANY", count: 1,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-FC-ID", name: "财务公司稳定编号", dataType: "文本", unit: "—", definition: "财务公司稳定身份。", sourceFieldId: "FIELD-FC-ID", sourceField: "financialCompanyId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] },
          { id: "PROP-FC-NAME", name: "财务公司名称", dataType: "文本", unit: "—", definition: "财务公司显示名称。", sourceFieldId: "FIELD-FC-NAME", sourceField: "formalBusinessSubject", role: "标题", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-GROUP-MEMBER-BORROWER", name: "集团成员借款人", definition: "申请贷款的集团成员单位。",
        identity: "PROP-BORR-USCC", title: "PROP-BORR-NAME", memberId: "S004-MEMBER-BORROWER", count: 1,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-BORR-USCC", name: "统一社会信用代码", dataType: "文本", unit: "—", definition: "借款人法定唯一身份。", sourceFieldId: "FIELD-BORR-USCC", sourceField: "unifiedSocialCreditCode", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] },
          { id: "PROP-BORR-NAME", name: "借款人名称", dataType: "文本", unit: "—", definition: "借款人显示名称。", sourceFieldId: "FIELD-BORR-NAME", sourceField: "borrowerName", role: "标题", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-LOAN-APPLICATION", name: "贷款申请", definition: "借款人提交的流动资金贷款申请。",
        identity: "PROP-APP-ID", title: "PROP-APP-ID", memberId: "S004-MEMBER-APPLICATION", count: 1,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-APP-ID", name: "申请编号", dataType: "文本", unit: "—", definition: "贷款申请稳定身份。", sourceFieldId: "FIELD-APP-ID", sourceField: "applicationId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] },
          { id: "PROP-APP-AMOUNT", name: "申请金额", dataType: "数值", unit: "万元", definition: "申请流动资金贷款金额。", sourceFieldId: "FIELD-APP-AMOUNT", sourceField: "appliedAmount", role: "普通属性", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-FINANCIAL-STATEMENT-FACT", name: "财务报表事实", definition: "来自公开年报的资产负债与损益事实。",
        identity: "PROP-FIN-FACT-ID", title: "PROP-FIN-FACT-ID", memberId: "S004-MEMBER-FINANCIAL-FACTS", count: 3,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-FIN-FACT-ID", name: "事实编号", dataType: "文本", unit: "—", definition: "财务事实稳定身份。", sourceFieldId: "FIELD-FIN-FACT-ID", sourceField: "factId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-SHAREHOLDING", name: "股权事实", definition: "借款人前十大股东及质押冻结事实。",
        identity: "PROP-SHARE-FACT-ID", title: "PROP-SHARE-FACT-ID", memberId: "S004-MEMBER-SHAREHOLDING", count: 10,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-SHARE-FACT-ID", name: "股权事实编号", dataType: "文本", unit: "—", definition: "股权事实稳定身份。", sourceFieldId: "FIELD-SHARE-FACT-ID", sourceField: "shareholdingFactId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-OPERATING-FACT", name: "经营事实", definition: "借款人经营范围与机组运营事实。",
        identity: "PROP-OPS-FACT-ID", title: "PROP-OPS-FACT-ID", memberId: "S004-MEMBER-OPERATING", count: 4,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-OPS-FACT-ID", name: "经营事实编号", dataType: "文本", unit: "—", definition: "经营事实稳定身份。", sourceFieldId: "FIELD-OPS-FACT-ID", sourceField: "operatingFactId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-CREDIT-FACILITY", name: "内部授信额度", definition: "财务公司对借款人的内部授信与用信事实。",
        identity: "PROP-FACILITY-ID", title: "PROP-FACILITY-ID", memberId: "S004-MEMBER-FACILITY", count: 1,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-FACILITY-ID", name: "额度编号", dataType: "文本", unit: "—", definition: "授信额度稳定身份。", sourceFieldId: "FIELD-FACILITY-ID", sourceField: "facilityId", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      },
      {
        id: "OBJ-PREFLIGHT-REPORT", name: "贷前调查报告", definition: "对贷款申请形成的正式贷前调查报告。",
        identity: "PROP-RPT-ID", title: "PROP-RPT-ID", memberId: "S004-MEMBER-REPORT", count: 1,
        objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认", owner: "本体管理", terms: [],
        properties: [
          { id: "PROP-RPT-ID", name: "报告编号", dataType: "文本", unit: "—", definition: "报告稳定身份。", sourceFieldId: "FIELD-RPT-ID", sourceField: "reportNumber", role: "身份", linkEndpoint: false, nullable: "否", status: "已映射", lastChangedAt: "待确认", owner: "本体管理", terms: [] }
        ]
      }
    ];
  }

  function m01Links() {
    return [
      { id: "REL-MEMBER-OF-GROUP", name: "借款人属于集团", reverseName: "集团包含借款人", allowedDirection: "双向导航", coverage: "全量", source: "OBJ-GROUP-MEMBER-BORROWER", target: "OBJ-FINANCIAL-COMPANY", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-BORR-USCC", memberId: "S004-MEMBER-BORROWER" }, targetEndpoint: { kind: "property", id: "PROP-FC-ID" }, definition: "成员归属关系。", owner: "本体管理", terms: [] },
      { id: "REL-SUBMITS-APPLICATION", name: "借款人提交贷款申请", reverseName: "申请由借款人提交", allowedDirection: "双向导航", coverage: "全量", source: "OBJ-GROUP-MEMBER-BORROWER", target: "OBJ-LOAN-APPLICATION", cardinality: "一对多", sourceEndpoint: { kind: "assetField", id: "FIELD-BORR-USCC", memberId: "S004-MEMBER-BORROWER" }, targetEndpoint: { kind: "property", id: "PROP-APP-ID" }, definition: "申请提交关系。", owner: "本体管理", terms: [] },
      { id: "REL-STATEMENT-DESCRIBES-BORROWER", name: "财务事实描述借款人", reverseName: "借款人被财务事实描述", allowedDirection: "仅正向导航", coverage: "全量", source: "OBJ-FINANCIAL-STATEMENT-FACT", target: "OBJ-GROUP-MEMBER-BORROWER", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-FIN-FACT-ID", memberId: "S004-MEMBER-FINANCIAL-FACTS" }, targetEndpoint: { kind: "property", id: "PROP-BORR-USCC" }, definition: "财务事实归属。", owner: "本体管理", terms: [] },
      { id: "REL-SHAREHOLDER-HOLDS-BORROWER", name: "股东持有借款人股份", reverseName: "借款人被股东持有", allowedDirection: "仅正向导航", coverage: "全量", source: "OBJ-SHAREHOLDING", target: "OBJ-GROUP-MEMBER-BORROWER", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-SHARE-FACT-ID", memberId: "S004-MEMBER-SHAREHOLDING" }, targetEndpoint: { kind: "property", id: "PROP-BORR-USCC" }, definition: "股权持有关系。", owner: "本体管理", terms: [] },
      { id: "REL-REPORT-EVALUATES-APPLICATION", name: "报告调查贷款申请", reverseName: "申请被报告调查", allowedDirection: "仅正向导航", coverage: "全量", source: "OBJ-PREFLIGHT-REPORT", target: "OBJ-LOAN-APPLICATION", cardinality: "一对一", sourceEndpoint: { kind: "property", id: "PROP-RPT-ID" }, targetEndpoint: { kind: "property", id: "PROP-APP-ID" }, definition: "报告评估关系。", owner: "本体管理", terms: [] }
    ];
  }

  function m01Metrics() {
    return [
      { id: "MET-S004-01", name: "资产负债率", unit: "%", scope: "借款人", definition: "总负债 / 总资产。", dependencyIds: ["PROP-FIN-FACT-ID"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-FINANCIAL-STATEMENT-FACT", subjectObjectId: "OBJ-GROUP-MEMBER-BORROWER", time: "数据截至时点", zeroHandling: "分母为零时返回无法计算", calculation: "负债合计 ÷ 资产总计 × 100" },
      { id: "MET-S004-02", name: "流动比率", unit: "倍", scope: "借款人", definition: "流动资产 / 流动负债。", dependencyIds: ["PROP-FIN-FACT-ID"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-FINANCIAL-STATEMENT-FACT", subjectObjectId: "OBJ-GROUP-MEMBER-BORROWER", time: "数据截至时点", zeroHandling: "分母为零时返回无法计算", calculation: "流动资产合计 ÷ 流动负债合计" },
      { id: "MET-S004-03", name: "EBIT/利息", unit: "倍", scope: "借款人", definition: "息税前利润对利息支出的覆盖倍数。", dependencyIds: ["PROP-FIN-FACT-ID"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-FINANCIAL-STATEMENT-FACT", subjectObjectId: "OBJ-GROUP-MEMBER-BORROWER", time: "数据截至时点", zeroHandling: "分母为零时返回无法计算", calculation: "EBIT ÷ 利息支出" },
      { id: "MET-S004-04", name: "主营业务利润率", unit: "%", scope: "借款人", definition: "主营业务利润 / 主营业务收入。", dependencyIds: ["PROP-FIN-FACT-ID"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-FINANCIAL-STATEMENT-FACT", subjectObjectId: "OBJ-GROUP-MEMBER-BORROWER", time: "数据截至时点", zeroHandling: "分母为零时返回无法计算", calculation: "主营业务利润 ÷ 主营业务收入 × 100" },
      { id: "MET-S004-05", name: "营运资金周转次数", unit: "次/年", scope: "借款人", definition: "营业收入 / 平均营运资金。", dependencyIds: ["PROP-FIN-FACT-ID"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-FINANCIAL-STATEMENT-FACT", subjectObjectId: "OBJ-GROUP-MEMBER-BORROWER", time: "近十二年口径", zeroHandling: "分母为零时返回无法计算", calculation: "营业收入 ÷ 平均营运资金" },
      { id: "MET-S004-06", name: "新增流动资金贷款额度", unit: "万元", scope: "贷款申请", definition: "资金需求测算形成的新增流动资金贷款额度。", dependencyIds: ["PROP-APP-AMOUNT"], type: "Metric", owner: "本体管理", sourceObjectId: "OBJ-LOAN-APPLICATION", subjectObjectId: "OBJ-LOAN-APPLICATION", time: "申请时点", zeroHandling: "输入缺失时返回无法计算", calculation: "营运资金量 − 借款人自有资金 − 现有流动资金贷款 − 其他渠道营运资金" }
    ];
  }

  function m01Rules() {
    return [
      { id: "RULE-S004-01", name: "集团成员资格校验", code: "S004-R01", appliesTo: "集团成员借款人", objectId: "OBJ-GROUP-MEMBER-BORROWER", metricIds: [], dependency: "成员名录", conclusion: "成员资格有效或无效", evidence: "集团成员名录", type: "Rule", owner: "本体管理", condition: "借款人存在于集团成员名录且状态有效", definition: "校验借款人集团成员资格。", validity: "随当前 Published 语义版本生效", testSample: "中国广核电力股份有限公司", bankRanking: "—", businessBasis: "unknown", decisionRefs: [] },
      { id: "RULE-S004-02", name: "用途与申请一致性", code: "S004-R02", appliesTo: "贷款申请", objectId: "OBJ-LOAN-APPLICATION", metricIds: ["MET-S004-06"], dependency: "申请金额、资金用途", conclusion: "一致或不一致", evidence: "贷款申请与用途合同", type: "Rule", owner: "本体管理", condition: "资金用途与申请用途字段一致", definition: "校验申请用途与合同用途一致。", validity: "随当前 Published 语义版本生效", testSample: "APP-S004-20260815-0001", bankRanking: "—", businessBasis: "unknown", decisionRefs: [] },
      { id: "RULE-S004-03", name: "申请金额不超过资金需求测算额度", code: "S004-R03", appliesTo: "贷款申请", objectId: "OBJ-LOAN-APPLICATION", metricIds: ["MET-S004-06"], dependency: "新增流动资金贷款额度", conclusion: "通过或不通过", evidence: "资金需求测算", type: "Rule", owner: "本体管理", condition: "申请金额 ≤ 新增流动资金贷款额度", definition: "校验申请金额不超测算额度。", validity: "随当前 Published 语义版本生效", testSample: "10 亿元 ≤ 257,901 万元", bankRanking: "—", businessBasis: "unknown", decisionRefs: [] },
      { id: "RULE-S004-04", name: "证据完整性校验", code: "S004-R04", appliesTo: "贷前调查报告", objectId: "OBJ-PREFLIGHT-REPORT", metricIds: [], dependency: "固定证据包", conclusion: "完整或缺失", evidence: "EVID-S004-20260815-0002", type: "Rule", owner: "本体管理", condition: "固定证据包覆盖报告全部事实项", definition: "校验报告事实证据完整。", validity: "随当前 Published 语义版本生效", testSample: "RPT-S004-20260815-0001", bankRanking: "—", businessBasis: "unknown", decisionRefs: [] }
    ];
  }

  function m01Positions(metrics = [], rules = []) {
    const positions = {
      // Published 画布使用 v1.0.3 固定的 2140 × 1120 世界坐标。
      // 业务对象和 Link 位于上方关系区；Metric 与 Rule 分区排列，
      // 避免回退到基线的随机位置，也不把节点排到世界边界之外。
      "OBJ-SHAREHOLDING": [20, 40],
      "REL-SHAREHOLDER-HOLDS-BORROWER": [270, 55],
      "OBJ-GROUP-MEMBER-BORROWER": [520, 100],
      "REL-MEMBER-OF-GROUP": [770, 55],
      "OBJ-FINANCIAL-COMPANY": [1020, 40],
      "OBJ-CREDIT-FACILITY": [1290, 40],
      "OBJ-OPERATING-FACT": [1540, 40],
      "OBJ-FINANCIAL-STATEMENT-FACT": [20, 210],
      "REL-STATEMENT-DESCRIBES-BORROWER": [270, 225],
      "REL-SUBMITS-APPLICATION": [770, 225],
      "OBJ-LOAN-APPLICATION": [1020, 210],
      "REL-REPORT-EVALUATES-APPLICATION": [1290, 225],
      "OBJ-PREFLIGHT-REPORT": [1540, 210]
    };
    const metricColumns = [70, 395, 720, 1045, 1370, 1695];
    metrics.forEach((metric, index) => {
      positions[metric.id] = [metricColumns[index % metricColumns.length], 390 + Math.floor(index / metricColumns.length) * 130];
    });
    const ruleColumns = [70, 475, 880, 1285, 1690];
    rules.forEach((rule, index) => {
      positions[rule.id] = [ruleColumns[index % ruleColumns.length], 800 + Math.floor(index / ruleColumns.length) * 130];
    });
    return positions;
  }

  function s004AssetMembers() {
    const members = [
      { id: "S004-MEMBER-FINANCIAL-COMPANY", objectId: "OBJ-FINANCIAL-COMPANY", name: "财务公司主体", grain: "一行一财务公司", identity: "财务公司稳定编号", identityFieldId: "FIELD-FC-ID", rows: 1, fields: [["财务公司稳定编号", "文本标识", "FC-DEMO-001", "FIELD-FC-ID"], ["财务公司名称", "文本", "集团财务公司（演示）", "FIELD-FC-NAME"]] },
      { id: "S004-MEMBER-BORROWER", objectId: "OBJ-GROUP-MEMBER-BORROWER", name: "集团成员借款人", grain: "一行一借款人", identity: "统一社会信用代码", identityFieldId: "FIELD-BORR-USCC", rows: 1, fields: [["统一社会信用代码", "文本标识", "91440300093677087R", "FIELD-BORR-USCC"], ["借款人名称", "文本", "中国广核电力股份有限公司", "FIELD-BORR-NAME"]] },
      { id: "S004-MEMBER-APPLICATION", objectId: "OBJ-LOAN-APPLICATION", name: "贷款申请", grain: "一行一申请", identity: "申请编号", identityFieldId: "FIELD-APP-ID", rows: 1, fields: [["申请编号", "文本标识", "APP-S004-20260815-0001", "FIELD-APP-ID"], ["申请金额（万元）", "数值", "100000", "FIELD-APP-AMOUNT"]] },
      { id: "S004-MEMBER-FINANCIAL-FACTS", objectId: "OBJ-FINANCIAL-STATEMENT-FACT", name: "财务报表事实", grain: "一行一财务事实", identity: "财务事实编号", identityFieldId: "FIELD-FIN-FACT-ID", rows: 3, fields: [["财务事实编号", "文本标识", "FACT-S004-AR-2025-001", "FIELD-FIN-FACT-ID"], ["截至日期", "日期", "2025-12-31", "FIELD-FIN-ASOF"]] },
      { id: "S004-MEMBER-SHAREHOLDING", objectId: "OBJ-SHAREHOLDING", name: "股权事实", grain: "一行一股权事实", identity: "股权事实编号", identityFieldId: "FIELD-SHARE-FACT-ID", rows: 10, fields: [["股权事实编号", "文本标识", "FACT-S004-V2-OWNERSHIP-001", "FIELD-SHARE-FACT-ID"]] },
      { id: "S004-MEMBER-OPERATING", objectId: "OBJ-OPERATING-FACT", name: "经营事实", grain: "一行一经营事实", identity: "经营事实编号", identityFieldId: "FIELD-OPS-FACT-ID", rows: 4, fields: [["经营事实编号", "文本标识", "FACT-S004-V2-OPERATIONS-001", "FIELD-OPS-FACT-ID"]] },
      { id: "S004-MEMBER-FACILITY", objectId: "OBJ-CREDIT-FACILITY", name: "内部授信额度", grain: "一行一授信额度", identity: "额度编号", identityFieldId: "FIELD-FACILITY-ID", rows: 1, fields: [["额度编号", "文本标识", "FAC-S004-20260815-001", "FIELD-FACILITY-ID"]] },
      { id: "S004-MEMBER-REPORT", objectId: "OBJ-PREFLIGHT-REPORT", name: "贷前调查报告", grain: "一行一报告", identity: "报告编号", identityFieldId: "FIELD-RPT-ID", rows: 1, fields: [["报告编号", "文本标识", REPORT_NO, "FIELD-RPT-ID"]] }
    ];
    return members.map((member) => ({
      ...member,
      identityCheckStatus: "通过",
      identityMissingCount: 0,
      identityDuplicateCount: 0,
      identityEvidenceLocator: `EVID-S004-IDENTITY-${member.id}`
    }));
  }

  function s004AssetRelations() {
    return [
      ["REL-MEMBER-OF-GROUP", "借款人属于集团", "S004-MEMBER-BORROWER", "FIELD-BORR-USCC", "S004-MEMBER-FINANCIAL-COMPANY", "FIELD-FC-ID", "多对一"],
      ["REL-SUBMITS-APPLICATION", "借款人提交贷款申请", "S004-MEMBER-BORROWER", "FIELD-BORR-USCC", "S004-MEMBER-APPLICATION", "FIELD-APP-ID", "一对多"],
      ["REL-STATEMENT-DESCRIBES-BORROWER", "财务事实描述借款人", "S004-MEMBER-FINANCIAL-FACTS", "FIELD-FIN-FACT-ID", "S004-MEMBER-BORROWER", "FIELD-BORR-USCC", "多对一"],
      ["REL-SHAREHOLDER-HOLDS-BORROWER", "股东持有借款人股份", "S004-MEMBER-SHAREHOLDING", "FIELD-SHARE-FACT-ID", "S004-MEMBER-BORROWER", "FIELD-BORR-USCC", "多对一"],
      ["REL-REPORT-EVALUATES-APPLICATION", "报告调查贷款申请", "S004-MEMBER-REPORT", "FIELD-RPT-ID", "S004-MEMBER-APPLICATION", "FIELD-APP-ID", "一对一"]
    ].map(([id, name, sourceMemberId, sourceFieldId, targetMemberId, targetFieldId, cardinality]) => ({
      id, name, sourceMemberId, sourceFieldId, targetMemberId, targetFieldId, cardinality,
      endpointCheckStatus: "通过", unmatchedSourceCount: 0, unmatchedTargetCount: 0,
      endpointEvidenceLocator: `EVID-S004-ENDPOINT-${id}`
    }));
  }

  function canonicalSeedSnapshot(value) {
    if (Array.isArray(value)) return value.map(canonicalSeedSnapshot);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalSeedSnapshot(value[key])]));
  }

  function seedSnapshotFingerprint(value) {
    return JSON.stringify(canonicalSeedSnapshot(value));
  }

  function s004RefreshTarget({ context, semanticVersionId, semanticVersion, memberIds, relationIds, createdAt }) {
    return {
      stableId: M02_REFRESH_TARGET_ID,
      bindingVersion: "1",
      name: "贷前调查本体 · 数据刷新目标",
      status: "active",
      statusReason: null,
      semanticVersionId,
      semanticVersion,
      publishedSemanticVersionId: semanticVersionId,
      t017VersionId: semanticVersionId,
      scenarioContext: ctx5(context),
      sourceMappingVersionId: "MAP-S004-PUBLISHED-002",
      dataAssetId: M02_T006,
      memberIds: [...memberIds],
      relationIds: [...relationIds],
      owner: "本体管理",
      createdAt,
      lastCheckedAt: createdAt,
      supersedes: null,
      evidenceLocator: M02_REFRESH_TARGET_EVIDENCE_ID
    };
  }

  function c003PayloadFingerprint(value) {
    const snapshot = { ...(value || {}) };
    delete snapshot.payloadFingerprint;
    const text = seedSnapshotFingerprint(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `C003-PF-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}-${text.length}`;
  }

  function m01MappingContract(delivery, objects, links) {
    const sourceContractFingerprint = seedSnapshotFingerprint(delivery);
    const objectMappings = objects.map((object) => ({
      objectId: object.id,
      memberId: object.memberId,
      identityPropertyId: object.identity,
      titlePropertyId: object.title,
      propertyMappings: object.properties.map((property) => ({
        propertyId: property.id,
        definition: property.definition,
        unit: property.unit,
        sourceFieldId: property.sourceFieldId,
        sourceField: property.sourceField,
        dataType: property.dataType,
        role: property.role,
        nullable: property.nullable,
        linkEndpoint: Boolean(property.linkEndpoint)
      }))
    }));
    const linkMappings = links.map((link) => ({
      linkId: link.id,
      sourceObjectId: link.source,
      targetObjectId: link.target,
      sourceEndpoint: { ...link.sourceEndpoint },
      targetEndpoint: { ...link.targetEndpoint },
      sourceField: link.sourceEndpoint?.id,
      targetField: link.targetEndpoint?.id,
      cardinality: link.cardinality,
      assetRelationId: link.id
    }));
    return {
      ...delivery,
      sourceContractFingerprint,
      mappingVersionId: "MAP-S004-PUBLISHED-002",
      scope: `${delivery.members.length} 个资产成员、${delivery.relations.length} 条资产成员关系`,
      objectMappings,
      linkMappings
    };
  }

  function buildM02DeliveryEvidence(context) {
    const scenarioContext = ctx5(context);
    const sourceFingerprint = { algorithm: "SHA-256", value: M02_SOURCE_SHA256, sizeBytes: M02_SOURCE_SIZE_BYTES };
    const deliverySeriesId = `C003-${M02_ASSET_VERSION}`;
    const payload = {
      contractSchemaVersion: 2, sourceModule: "数据工程", contractCode: "C003",
      deliveryId: deliverySeriesId,
      deliverySeriesId, attemptNumber: 1, retryOf: null, previousDeliveryId: null,
      deliveryStatus: "已发送", deliveredAt: context.formedAt,
      assetId: M02_T006, assetName: "S004 贷前调查数据资产", assetVersion: M02_ASSET_VERSION,
      t006Id: M02_T006, t007Version: M02_ASSET_VERSION, t008AsOf: AS_OF,
      asOf: AS_OF, scenarioContext: scenarioContext, evidenceLocator: `数据工程 / 已发布数据资产 / ${M02_ASSET_VERSION}`,
      sourceSnapshotId: M02_SNAPSHOT_ID, processingModuleVersion: M02_DEFINITION_ID,
      publishedAt: context.formedAt, versionDescription: "S004 贷前调查演示数据资产正式发布版本",
      source: "财务报告既有事实 + 缺口合成演示节点", sourceFingerprint,
      t008Confirmation: { snapshotId: M02_SNAPSHOT_ID, asOf: AS_OF, confirmedBy: "财务公司调查岗", confirmedAt: context.formedAt, basis: "合成演示资料包数据截至日 2026-08-15", evidenceId: "T008-S004-20260815-001", evidenceLocator: `数据工程 / 数据截至时间确认 / ${M02_SNAPSHOT_ID} / ${AS_OF}`, sizeBytes: sourceFingerprint.sizeBytes, scenarioContext },
      runEvidence: { runId: M02_RUN_ID, definitionVersion: M02_DEFINITION_ID, qualityResultId: "DQR-S004-20260815-V2-001", evidenceLocator: `数据工程 / 正式运行 / ${M02_RUN_ID}` },
      publicationState: "已发布", purpose: "S004 贷前调查本体映射", consumptionRestriction: "仅供获准的 S004 贷前调查本体映射与候选验证",
      mappingEligibility: { status: "可供本体映射", evidenceLocator: `数据工程 / 已发布数据资产 / ${M02_ASSET_VERSION}` },
      qualitySummary: { status: "通过", resultId: "DQR-S004-20260815-V2-001", checkedAt: context.formedAt, evidenceLocator: "数据工程 / 质量结果 / DQR-S004-20260815-V2-001" },
      lineageCheckStatus: "通过", lineageEvidenceLocator: `数据工程 / 数据沿袭 / ${M02_ASSET_VERSION}`,
      sourceChain: [M02_SNAPSHOT_ID, M02_DEFINITION_ID, M02_RUN_ID, "DQR-S004-20260815-V2-001", M02_ASSET_VERSION],
      members: s004AssetMembers(),
      relations: s004AssetRelations()
    };
    payload.payloadFingerprint = c003PayloadFingerprint(payload);
    const receipt = {
      sourceModule: "本体管理", contractCode: "C003", deliveryId: payload.deliveryId,
      status: "accepted", receivedAt: context.formedAt, reason: null,
      scenarioContext, targetDraftId: "draft-S004-0001", targetDraftRevision: 1,
      assetId: M02_T006, assetVersion: M02_ASSET_VERSION, asOf: AS_OF,
      t006Id: M02_T006, t007Version: M02_ASSET_VERSION, t008AsOf: AS_OF,
      evidenceLocator: payload.evidenceLocator, contractSchemaVersion: 2,
      previousDraftId: null, previousAssetVersion: null, replacement: null
    };
    const record = {
      deliveryId: payload.deliveryId, deliverySeriesId, attemptNumber: 1,
      retryOf: null, previousDeliveryId: null, assetVersionId: M02_ASSET_VERSION,
      scenarioContext, submittedAt: context.formedAt,
      status: "已发送 · 结果待核对", receiptStatus: "等待 M01 持久化联合证据",
      payload, payloadFingerprint: payload.payloadFingerprint, sendCount: 1,
      events: [], verificationHistory: [], historicalAcceptedClaim: false,
      currentVerification: { status: "尚未核对", checkedAt: "", exchangeOrigin: "", issues: [] },
      runtimeVerificationId: ""
    };
    return { payload, receipt, record };
  }

  function buildM01State(context, artifacts) {
    const scenario = namedContext(context);
    const created = stamp(context);
    const ids = artifactRuntimeIds(artifacts);
    const m02Delivery = buildM02DeliveryEvidence(context);
    const delivery = m02Delivery.payload;
    const objects = m01Objects();
    const links = m01Links();
    const contract = m01MappingContract(delivery, objects, links);
    const deliveryFingerprint = seedSnapshotFingerprint(delivery);
    const deliveryReceipt = m02Delivery.receipt;
    const metrics = artifactMetrics(artifacts, m01Metrics());
    const rules = artifactRules(artifacts, m01Rules());
    const positions = m01Positions(metrics, rules);
    const draftId = "draft-S004-0001";
    const versionId = ids.semanticVersionId;
    const draft = {
      id: draftId, ontologyStableId: ids.ontologyStableId, name: "贷前调查本体",
      definition: "覆盖财务公司、集团成员借款人、贷款申请、财务/股权/经营事实、内部授信与贷前调查报告的语义结构。",
      draftName: "初始 Draft", scenario: `S004 ${SCENARIO_NAME}`, status: "Draft",
      createdAt: created, updatedAt: created, basedOn: null, basedOnVersionId: null,
      scenarioContext: scenario, draftRevision: 1, replacesDraftId: null,
      sourceDeliveryId: delivery.deliveryId, sourceDataContract: delivery,
      receivedDataAssetDelivery: {
        deliveryId: delivery.deliveryId, assetId: M02_T006, assetVersion: M02_ASSET_VERSION,
        asOf: AS_OF, scenarioContext: delivery.scenarioContext,
        evidenceLocator: delivery.evidenceLocator, receivedAt: context.formedAt
      },
      objects, links, metrics, rules, actions: [],
      positions, canvasView: { zoom: 0.62, pan: { x: 40, y: 30 } },
      validation: { status: "success", checkedAt: created, issues: [] },
      publishedVersionId: null,
      release: { owner: "本体管理", effectiveFrom: "", effectiveTo: "", changeReason: "待确认", replacementMode: "待确认", replacementResourceIds: [], replacementMap: {}, replacementDeclaration: "待确认", evidenceState: "尚未形成", confirmed: false }
    };
    const publishFields = {
      owner: "本体管理", publicationState: "Published", lifecycleState: "Published",
      businessValidityState: "有效", bindability: "可新绑定", effectiveFrom: created, effectiveTo: null,
      changeType: "新增", changeReason: "首版发布", lastChangedAt: created,
      controlledEvidenceLocator: ids.t019EvidenceId, applicableScenario: `S004 ${SCENARIO_NAME}`
    };
    const decorated = objects.map((object) => Object.assign({}, object, publishFields, {
      properties: object.properties.map((property) => Object.assign({}, property, publishFields)),
      changeType: "新增", changeReason: "首版发布", lastChangedAt: created,
      controlledEvidenceLocator: ids.t019EvidenceId, applicableScenario: `S004 ${SCENARIO_NAME}`
    }));
    const publishedLinks = links.map((link) => Object.assign({}, link, publishFields, {
      sourceName: (objects.find((item) => item.id === link.source) || {}).name || link.source,
      targetName: (objects.find((item) => item.id === link.target) || {}).name || link.target,
      sourceEndpointLabel: link.sourceEndpoint?.id || "", targetEndpointLabel: link.targetEndpoint?.id || "",
      sourceEndpointType: link.sourceEndpoint?.kind || "", targetEndpointType: link.targetEndpoint?.kind || "",
      endpointCompatible: true
    }));
    const publishedMetrics = metrics.map((metric) => Object.assign({}, metric, publishFields));
    const publishedRules = rules.map((rule) => Object.assign({}, rule, publishFields, { businessBasis: rule.businessBasis === "unknown" ? "confirmed" : rule.businessBasis }));
    const publishedProperties = decorated.flatMap((object) => object.properties.map((property) => Object.assign({}, property, { parentId: object.id, parentName: object.name })));
    const validationResourceManifest = [
      ...decorated.map((resource) => ({ ...resource, kind: "object", type: "Object Type" })),
      ...publishedProperties.map((resource) => ({ ...resource, kind: "property", type: "Property" })),
      ...publishedLinks.map((resource) => ({ ...resource, kind: "link", type: "Link Type" })),
      ...publishedMetrics.map((resource) => ({ ...resource, kind: "metric", type: "Metric" })),
      ...publishedRules.map((resource) => ({ ...resource, kind: "rule", type: "Rule" }))
    ].map((resource) => ({
      id: resource.id, name: resource.name, kind: resource.kind, type: resource.type,
      publicationState: "Published", businessValidityAtPublish: "有效",
      owner: resource.owner || "本体管理", effectiveFrom: resource.effectiveFrom || created,
      effectiveTo: resource.effectiveTo || null, bindability: resource.bindability || "可新绑定",
      changeType: resource.changeType || "新增", changeReason: resource.changeReason || "首版发布",
      lastChangedAt: resource.lastChangedAt || created, applicableScenario: resource.applicableScenario || `S004 ${SCENARIO_NAME}`,
      controlledEvidenceLocator: resource.controlledEvidenceLocator || ids.t019EvidenceId, capturedAt: created
    }));
    const validationSnapshot = {
      status: "passed", checkedAt: created,
      scopeSummary: `${decorated.length} Object · ${publishedProperties.length} Property · ${publishedLinks.length} Link · ${publishedMetrics.length} Metric · ${publishedRules.length} Rule · 0 Action Type`,
      resourceManifest: validationResourceManifest,
      groups: [
        ["ontology", "本体与稳定身份", 1 + validationResourceManifest.length],
        ["lifecycle", "生命周期与证据包络", 1 + validationResourceManifest.length],
        ["object", "Object Type", decorated.length],
        ["property", "身份、标题与 Property", publishedProperties.length],
        ["mapping", "数据成员与字段映射", decorated.length],
        ["link", "Link Type", publishedLinks.length],
        ["metric", "Metric", publishedMetrics.length],
        ["rule", "Rule", publishedRules.length],
        ["action", "Action Type", 0]
      ].map(([id, name, checkedCount]) => ({ id, name, checkedCount, status: "passed", issueCount: 0 })),
      mapping: { complete: true, detail: `${contract.members.length} 个资产成员与 ${contract.relations.length} 条成员关系已冻结，稳定身份、字段和关系端点均可定位。` },
      releaseEnvelope: { publicationTarget: "Published", owner: "本体管理", effectiveFrom: created, effectiveTo: null, changeReason: "首版发布", replacementDeclaration: "无替代关系", resourceManifest: validationResourceManifest }
    };
    const published = {
      id: versionId, ontologyStableId: ids.ontologyStableId, name: "贷前调查本体",
      definition: draft.definition, scenario: draft.scenario, scenarioContext: scenario,
      semanticVersion: ids.semanticVersion, status: "Published", publicationState: "Published", lifecycleState: "Published",
      owner: "本体管理", bindability: "可新绑定", effectiveFrom: created, effectiveTo: null,
      replacementDeclaration: "无替代关系", publishedAt: created, lastChangedAt: created,
      sourceDraftId: draftId, sourceDraftName: "初始 Draft",
      sourceDeliveryId: delivery.deliveryId, sourceDeliverySnapshot: delivery,
      sourceDeliveryReceiptSnapshot: deliveryReceipt, sourceDeliveryFingerprint: deliveryFingerprint,
      draftRevision: 1, basedOnVersion: null, basedOnVersionId: null,
      changeSummary: "S004 贷前调查首版发布", validationSnapshot,
      dataContract: contract, positions,
      objects: decorated,
      properties: publishedProperties,
      links: publishedLinks,
      metrics: publishedMetrics, rules: publishedRules, actions: [],
      publishRecordId: ids.t019RecordId, publishEvidenceRef: ids.t019EvidenceId,
      controlledEvidenceLocator: ids.t019EvidenceId,
      resourceManifestSnapshot: { versionId, semanticVersion: ids.semanticVersion, capturedAt: created, resources: validationResourceManifest }
    };
    const refreshTarget = s004RefreshTarget({
      context,
      semanticVersionId: versionId,
      semanticVersion: ids.semanticVersion,
      memberIds: contract.members.map((member) => member.id),
      relationIds: contract.relations.map((relation) => relation.id),
      createdAt: created
    });
    draft.publishedVersionId = versionId;
    return {
      schemaNote: "S004 runtime native seed",
      drafts: [draft], activeDraftId: draftId,
      publishedVersions: [published], selectedVersionId: versionId,
      currentFormalVersionId: versionId,
      currentFormalVersionIdsByOntology: { [ids.ontologyStableId]: versionId },
      updatesByVersion: {},
      bindingsByVersion: {
        [versionId]: {
          current: {
            ontologyStableId: ids.ontologyStableId, semanticVersionId: versionId, semanticVersion: ids.semanticVersion,
            dataVersion: ids.dataVersion, asOf: AS_OF, switchedAt: context.formedAt,
            scenarioContext: scenario,
            adoptionRecordId: ids.t019RecordId,
            adoptionEvidenceLocator: ids.t019EvidenceId,
            candidateValidationReference: { status: "passed", contractCode: "C008", decisionRef: "D064", evidenceLocator: "EVID-C008-S004-RUNTIME" },
            validationEvidenceRef: "EVID-C008-S004-RUNTIME"
          },
          previous: null
        }
      },
      recordsByVersion: {
        [versionId]: [
          {
            id: `REC-T054-${context.scenarioRunId}`,
            title: "数据刷新目标已建立",
            detail: `已形成绑定版本 ${refreshTarget.bindingVersion}；数据工程可只读发现，提交更新前仍须重新读取。`,
            resourceRef: "T054", formsContract: true, status: "可供发现", tone: "green",
            evidenceCode: M02_REFRESH_TARGET_EVIDENCE_ID, scenarioContext: scenario,
            formedAt: context.formedAt, time: created, sourceModule: "本体管理", contractCode: "C032",
            semanticVersionId: versionId, semanticVersion: ids.semanticVersion, dataVersion: ids.dataVersion
          },
          {
            id: `REC-C029-${context.scenarioRunId}`, title: "数据与本体匹配通过",
            detail: `${contract.members.length} 个数据资产成员、${contract.relations.length} 条成员关系及 Published 映射合同均可定位。`,
            resourceRef: "T051", formsContract: true, status: "通过", tone: "green",
            evidenceCode: `EVID-C029-${context.scenarioRunId}`, scenarioContext: scenario,
            formedAt: context.formedAt, time: created, sourceModule: "本体管理", contractCode: "C029",
            semanticVersionId: versionId, semanticVersion: ids.semanticVersion, dataVersion: ids.dataVersion
          },
          {
            id: `REC-T018-${context.scenarioRunId}`, title: "已具备下游消费验证条件",
            detail: "数据工程质量门、精确来源快照和数据资产版本均已形成；S004 智能问数消费方状态另按 NOT_APPLICABLE 处理。",
            resourceRef: "T018", formsContract: true, status: "具备条件", tone: "blue",
            evidenceCode: T018_EVIDENCE_ID, scenarioContext: scenario,
            formedAt: context.formedAt, time: created, sourceModule: "数据工程", contractCode: "",
            semanticVersionId: versionId, semanticVersion: ids.semanticVersion, dataVersion: ids.dataVersion
          },
          {
            id: ids.t019RecordId, title: "已切换为正式数据", detail: "Published 语义版本与精确数据版本已形成当前正式使用组合。",
            resourceRef: "T019", formsContract: true, status: "成功", tone: "green",
            evidenceCode: ids.t019EvidenceId, scenarioContext: scenario, formedAt: context.formedAt, time: created,
            sourceModule: "本体管理", contractCode: "T019", semanticVersionId: versionId, semanticVersion: ids.semanticVersion,
            dataVersion: ids.dataVersion, note: "S004 Published 指针切换记录（运行时种子）"
          }
        ]
      },
      refreshTargetBindingsByVersion: { [versionId]: [refreshTarget] },
      refreshTargetDiscoveries: {},
      externalDataAssets: { [`${M02_T006}::${M02_ASSET_VERSION}`]: delivery },
      dataAssetDeliveryReceipts: { [delivery.deliveryId]: deliveryReceipt },
      dataAssetDeliveryFingerprints: { [delivery.deliveryId]: deliveryFingerprint },
      scenarioContexts: { S004: scenario },
      activeScenarioId: "S004", scenarioHistory: [],
      scenarioContextReceipts: {
        [`C033-${context.scenarioRunId}`]: {
          envelope: { sourceModule: "平台公共层", contractCode: "C033", contextId: `C033-${context.scenarioRunId}`, deliveredAt: context.formedAt, evidenceLocator: "统一平台 / 场景工作区 / S004", scenarioContext: delivery.scenarioContext },
          receipt: { sourceModule: "本体管理", contractCode: "C033", contextId: `C033-${context.scenarioRunId}`, status: "accepted", receivedAt: context.formedAt, reason: null, evidenceLocator: "统一平台 / 场景工作区 / S004", scenarioContext: delivery.scenarioContext }
        }
      },
      pendingScenarioReset: null, scenarioActivationIntent: null, isolatedLegacyState: [],
      storageMigration: { status: "clean", checkedAt: context.formedAt, reason: "S004 runtime seed" },
      c008ProjectionRevision: 1, c008ProjectionFormedAt: context.formedAt, serial: 0
    };
  }

  // ---------------------------------------------------------------- M02 ----

  function buildM02Flow(context, artifacts) {
    const scenario = ctx5(context);
    const now = stamp(context);
    const ids = artifactRuntimeIds(artifacts);
    const m02Delivery = buildM02DeliveryEvidence(context);
    const activeBorrowerRun = {
      bindingMode: "IMMUTABLE_CURRENT_INSTANCE",
      borrowerId: "BORR-CN-USCC-91440300093677087R",
      borrowerName: "中国广核电力股份有限公司",
      unifiedSocialCreditCode: "91440300093677087R",
      borrowerKey: "91440300093677087R",
      memberId: "MEM-CGN-003816",
      applicationId: "APP-S004-20260815-0001",
      reportId: "RPT-S004-20260815-0001",
      scenarioRunId: scenario.scenarioRunId,
      reportingYear: 2025,
      asOfDate: AS_OF,
      immutable: true
    };
    const sourceTemplates = [
      {
        templateId: "SRC-TPL-PUBLIC-ANNUAL-REPORT-v1.0",
        templateName: "集团成员借款人公开年报来源模板",
        sourceSlotId: "SRC-SLOT-FINANCIAL-REPORTS",
        instanceScope: "per-borrower",
        sourceClass: "official-public",
        parameterKeys: ["borrowerId", "borrowerLegalName", "unifiedSocialCreditCode", "reportYears[]", "statementAsOf", "sourceFiles[]"],
        validationGates: [
          ["主体身份一致", "报告主体、统一社会信用代码与借款人参数一致"],
          ["期间与原件完整", "报告年度、期末日、PDF 指纹和页数均可定位"],
          ["财务事实不重复", "正式年报事实不得复制到上传型 synthetic-demo 资料包"]
        ],
        periodPolicy: "按配置年度；每年度一份不可变快照",
        asOfPolicy: "statementAsOf = 年报报告期末",
        updateStrategy: "按财报披露时点受控更新",
        reuseMode: "新借款人创建独立来源实例、快照和 scenarioRunId，不复制当前实例事实"
      },
      {
        templateId: "SRC-TPL-PREFLIGHT-EVIDENCE-PACK-v1.0",
        templateName: "集团成员借款人贷前调查资料包模板",
        sourceSlotId: "SRC-SLOT-LOAN-INVESTIGATION-PACK",
        instanceScope: "per-application",
        sourceClass: "synthetic-demo / authorized-external / human-input",
        parameterKeys: ["borrowerId", "memberId", "applicationId", "asOfDate", "sourceFile"],
        validationGates: [
          ["稳定键完整", "borrowerId、memberId、applicationId 均非空且唯一"],
          ["来源分类明确", "外部缺口标记 synthetic-demo 或 authorized-external，人工确认项标记 human-input"],
          ["财务事实去重", "资料包不得重复承载正式年报中的财务报表明细"],
          ["时点与单位完整", "资料截至日、币种和金额单位必须可核验"]
        ],
        periodPolicy: "按贷款申请资料截至日形成一份完整资料包快照",
        asOfPolicy: "asOfDate = 贷款申请资料锁定日",
        updateStrategy: "按需上传或绑定新快照",
        reuseMode: "新申请创建独立来源实例、快照和 scenarioRunId，不沿用当前申请资料"
      }
    ];
    const officialTemplate = sourceTemplates[0];
    const syntheticTemplate = sourceTemplates[1];
    const officialSource = {
      id: "s004-official-annual-reports", name: "财务报告",
      category: "正式财务报告", access: "既有权威资料复用",
      description: "中国广核电力股份有限公司 2023/2024/2025 年年度报告及其已登记公开披露事实。",
      registration: "本轮快照已确认 · 可运行", latestAcquired: now, asOf: "2025-12-31",
      snapshotCount: 3, syncPlan: "按财报披露时点受控更新", nextSync: "新年度正式财报形成后", lastSync: `${now} · 最近成功读取`,
      enabled: true, selectable: true, fileName: "中国广核2025年年度报告.pdf", workbookKey: "s004-official-annual-reports", snapshots: [],
      sourceArtifact: {
        kind: "pdf-bundle", bundleId: "S004-OFFICIAL-ANNUAL-REPORTS-2023-2025",
        bundleLabel: "中国广核电力 2023—2025 年年度报告（权威 PDF 文件集）",
        sourceLabel: "official-public · 财务报告",
        files: [
          { id: "SRC-AR-2023", fileName: "中国广核2023年年度报告.pdf", period: "2023 年度", asOf: "2023-12-31", pages: 228, sizeBytes: 5955620, sha256: "ad61895a8117b7c9129bb28483816f4f5d60b346245bd3a8a09d5c22e62f5d67", href: "../../s004/artifacts/data/source-materials/annual-reports/中国广核2023年年度报告.pdf", sourceType: "official-public" },
          { id: "SRC-AR-2024", fileName: "中国广核2024年年度报告.pdf", period: "2024 年度", asOf: "2024-12-31", pages: 227, sizeBytes: 1423683, sha256: "c379d7a62bb0fb8c0c5ceeba34f1ca9c806ee2ceb1b53bfcbf6c6f22076f9d5e", href: "../../s004/artifacts/data/source-materials/annual-reports/中国广核2024年年度报告.pdf", sourceType: "official-public" },
          { id: "SRC-AR-2025", fileName: "中国广核2025年年度报告.pdf", period: "2025 年度", asOf: "2025-12-31", pages: 234, sizeBytes: 3123448, sha256: "f1ae0b9f53db25faf937d38be0abcee756ea7c8b58c29635aee0335a87904206", href: "../../s004/artifacts/data/source-materials/annual-reports/中国广核2025年年度报告.pdf", sourceType: "official-public" }
        ]
      },
      templateDefinition: officialTemplate,
      instanceBinding: Object.assign({}, activeBorrowerRun, {
        sourceInstanceId: "SRC-INSTANCE-S004-CGN-ANNUAL-REPORTS-20260815",
        sourceSlotId: officialTemplate.sourceSlotId,
        templateId: officialTemplate.templateId,
        scope: "当前借款人"
      }),
      pipelineRefs: ["pipeline-s004-preflight"], downstreamAssets: ["S004 贷前调查数据资产"],
      folderPath: "/data/inbound/s004/annual-reports/", filePattern: "*.pdf"
    };
    const syntheticSource = {
      id: "s004-synthetic-demo-pack", name: "贷前调查合成演示资料包（synthetic-demo）",
      category: "手工工作簿", access: "按需上传工作簿",
      description: "贷款申请、内部授信、征信、历史融资、现场调查、还款计划等缺口合成节点。财务报告中的事实不在此重复造数。",
      registration: "本轮快照已确认 · 可运行", latestAcquired: now, asOf: AS_OF,
      snapshotCount: 1, syncPlan: "按需上传新快照", nextSync: "由用户上传触发", lastSync: `${now} · 最近成功读取`,
      enabled: true, selectable: true, fileName: "S004_贷前调查合成演示资料包-v2.0.1.xlsx", workbookKey: "s004-synthetic-demo-pack", snapshots: [],
      sourceArtifact: {
        kind: "xlsx-workbook", bundleId: "S004-SYNTHETIC-DEMO-PACK-V2.0.1",
        bundleLabel: "S004 贷前调查合成演示资料包 v2.0.1（完整工作簿）",
        sourceLabel: "synthetic-demo · 外部缺口及内部演示资料",
        files: [
          { id: "S004-DEMO-PACK", fileName: "S004_贷前调查合成演示资料包-v2.0.1.xlsx", period: "2026-08-15", asOf: AS_OF, sheets: 11, sizeBytes: 20294, sha256: "9a6e3502039beef28ebe1fe10bc046cd4bb0e051b35122b2d6aea1c8c235f6d9", href: "../../s004/artifacts/data/S004_贷前调查合成演示资料包-v2.0.1.xlsx", sourceType: "synthetic-demo" }
        ]
      },
      templateDefinition: syntheticTemplate,
      instanceBinding: Object.assign({}, activeBorrowerRun, {
        sourceInstanceId: "SRC-INSTANCE-S004-CGN-PREFLIGHT-PACK-20260815",
        sourceSlotId: syntheticTemplate.sourceSlotId,
        templateId: syntheticTemplate.templateId,
        scope: "当前贷款申请"
      }),
      pipelineRefs: ["pipeline-s004-preflight"], downstreamAssets: ["S004 贷前调查数据资产"],
      folderPath: "/data/inbound/s004/", filePattern: "*.xlsx"
    };
    const assetMembers = s004AssetMembers();
    const assetRelationships = s004AssetRelations();
    const targetAsset = {
      id: "asset-s004-preflight", t006Id: M02_T006, name: "S004 贷前调查数据资产", scene: "S004",
      purpose: "为贷前调查本体与正式报告提供借款人、贷款申请、财务事实、授信额度事实。",
      owner: "数据工程", businessSteward: "财务公司调查岗", published: true, status: "已发布",
      versionCount: 1, currentVersion: M02_ASSET_VERSION, currentAuthoritativeVersion: M02_ASSET_VERSION,
      asOf: AS_OF, quality: "通过", publishedAt: now, sourceSnapshot: M02_SNAPSHOT_ID, sourceSnapshotId: M02_SNAPSHOT_ID,
      runId: M02_RUN_ID, refreshStatus: "已刷新", consumptionStatus: "可消费",
      detailViews: [
        { key: "overview", label: "版本概览" }, { key: "members", label: "包含的数据" },
        { key: "lineage", label: "如何产生" }, { key: "consumption", label: "如何变为可用" }
      ],
      templateDefinition: {
        templateId: "ASSET-TPL-S004-PREFLIGHT-v1.0",
        templateName: "集团成员单位贷前调查数据资产模板",
        parameterKeys: ["borrowerId", "applicationId", "scenarioRunId", "sourceSnapshotIds[]", "asOfDate"],
        reuseMode: "复用成员、关系和质量合同；每个借款人申请形成独立数据资产版本"
      },
      instanceBinding: activeBorrowerRun,
      reusePolicy: { allowed: true, selectionMode: "显式选择精确版本与成员范围", defaultMemberScope: "全部成员", cycleProtection: "禁止同一数据资产的输出回读自身", s003CompatibilityVersionAllowed: false },
      members: assetMembers, relationships: assetRelationships, relationshipContracts: assetRelationships
    };
    const assetVersion = {
      id: M02_ASSET_VERSION, asOf: AS_OF, quality: "通过", qualityId: "DQR-S004-20260815-V2-001",
      publishedAt: now, scenarioContext: scenario,
      sourceSnapshot: "中国广核2025年年度报告.pdf；S004_贷前调查合成演示资料包-v2.0.1.xlsx",
      sourceSnapshotId: M02_SNAPSHOT_ID, sourceSnapshotIds: ["SNAP-S004-AR-2025", M02_SNAPSHOT_ID], sourceHash: M02_SOURCE_SHA256,
      inputContentFingerprint: `${M02_ANNUAL_REPORT_2025_SHA256}|${M02_SOURCE_SHA256}`, memberContractFingerprint: "seed-members",
      relationshipContractFingerprint: "seed-relations", businessOutputFingerprint: "seed-output",
      runId: M02_RUN_ID, definitionVersion: M02_DEFINITION_ID, targetAssetId: M02_T006,
      refreshStatus: "已刷新", consumptionStatus: "可消费", dataQualification: "数据侧合格", allowReuse: true,
      refreshRequestId: M02_REFRESH_REQUEST_ID, refreshResultId: M02_REFRESH_RESULT_ID,
      t018Status: "已形成", t018EvidenceId: T018_EVIDENCE_ID,
      t019Status: "已采用", t019EvidenceId: ids.t019EvidenceId, t019BindingId: ids.t019RecordId, t019Owner: "本体管理",
      adoptedAt: now, refreshCompletedAt: now, contentAccess: "可访问",
      templateId: "ASSET-TPL-S004-PREFLIGHT-v1.0", instanceBinding: activeBorrowerRun,
      retentionStatus: "一期历史保留 · 生产策略待取得", retentionPolicyId: "尚未取得", retentionPolicyVersion: "尚未取得",
      evidenceIntegrity: "完整",
      members: assetMembers.map((member) => ({ stableId: member.id, name: member.name, grain: member.grain, rowCount: member.rows, identity: member.identity })),
      relationships: assetRelationships.map((relation) => ({ stableId: relation.id, name: relation.name, checkedCount: memberFieldCount(relation), unmatchedCount: 0, status: "通过" })),
      dependencies: [], dependencyVersions: [], dependencyClosure: [],
      dataAssetDeliveryId: m02Delivery.payload.deliveryId,
      dataAssetDeliveryStatus: "已发送 · 结果待核对",
      dataAssetDeliveryReceiptStatus: "等待 M01 持久化联合证据",
      refreshBlockedByC003: true,
      refreshBlockedReason: "等待当前页面会话从 M01 重读同标识合同、完整回执、同轮 C033 与目标 Draft 绑定证据",
      bindingTrustSummary: null, currentTrustSummaries: []
    };
    const pipeline = {
      id: "pipeline-s004-preflight", name: "S004 贷前调查数据标准化", purpose: "形成 S004 贷前调查数据资产的可信版本",
      definitionState: "已发布定义", definitionVersion: M02_DEFINITION_ID, nodeCount: 6,
      source: "正式财务报告 + 贷前调查合成演示资料包", targetAsset: targetAsset.name, targetAssetId: M02_T006,
      ontologyBindingId: M02_REFRESH_TARGET_ID, refreshTarget: "贷前调查本体 · 数据刷新目标", refreshTargetId: M02_REFRESH_TARGET_ID,
      latestRun: `${M02_RUN_ID} · 成功`, schedule: "仅手工正式运行", canOpen: true,
      templateDefinition: {
        templateId: "PIPE-TPL-S004-PREFLIGHT-v1.0",
        templateName: "贷前调查事实标准化与发布模板",
        parameterKeys: ["sourceInstanceIds[]", "borrowerId", "applicationId", "scenarioRunId", "targetAssetVersion"]
      },
      instanceBinding: activeBorrowerRun
    };
    const qualityRules = [
      { id: "DQ-V2-IDENTITY", version: "2.0.0", name: "稳定身份键完整", type: "必填和唯一性", scope: "借款人、成员单位、贷款申请、报告", condition: "统一社会信用代码、成员 ID、申请编号和报告编号均完整且唯一", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补齐或消解冲突身份后以同一来源快照重试", owner: "数据工程", enabled: true },
      { id: "DQ-V2-FINANCIAL-COVERAGE", version: "2.0.0", name: "财务报告期间覆盖", type: "期间完整性", scope: "2023—2025 年财务报表", condition: "资产负债表、利润表和现金流量表的权威列示行完整", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补齐正式财务报告来源快照后重试", owner: "数据工程", enabled: true },
      { id: "DQ-V2-NO-DUPLICATE-FINANCIAL-UPLOAD", version: "2.0.0", name: "财报事实不重复造数", type: "来源边界", scope: "正式财务报告与 synthetic-demo", condition: "正式财务报告已含事实不得在上传型合成资料中重复生成", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "移除合成资料中的重复财报事实并重新形成快照", owner: "数据工程", enabled: true },
      { id: "DQ-V2-UNIT-CURRENCY", version: "2.0.0", name: "币种与单位统一", type: "单位和格式", scope: "财务金额与期间", condition: "财务金额统一为人民币万元，期间与截至日完整", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "修正币种、单位或期间标识后重试", owner: "数据工程", enabled: true },
      { id: "DQ-V2-SYNTHETIC-NODES", version: "2.0.0", name: "合成资料显式标识", type: "证据分类", scope: "外部缺口与内部演示资料", condition: "工商、评级、政策、成员资格、贷款申请和内部授信等演示节点均标记 synthetic-demo", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补齐 synthetic-demo 标签与来源说明后重试", owner: "数据工程", enabled: true }
    ];
    const definitionNodes = [
      { id: "node-source-official", key: "source", x: 6000, y: 4100, sourceId: officialSource.id, inputKind: "source", inputSlotId: "main", memberScope: "不适用" },
      { id: "node-source-synthetic", key: "source", x: 6000, y: 4350, sourceId: syntheticSource.id, inputKind: "source", inputSlotId: "reference", memberScope: "不适用" },
      { id: "node-python", key: "python", x: 6260, y: 4225 },
      { id: "node-quality", key: "quality", x: 6500, y: 4225 },
      { id: "node-publish", key: "publish", x: 6740, y: 4225 },
      { id: "node-refresh", key: "refresh", x: 6980, y: 4225 }
    ];
    const definitionEdges = [
      { id: "edge-official-python", from: "node-source-official", to: "node-python", slot: "主输入" },
      { id: "edge-synthetic-python", from: "node-source-synthetic", to: "node-python", slot: "参考输入" },
      { id: "edge-python-quality", from: "node-python", to: "node-quality", slot: "主输入" },
      { id: "edge-quality-publish", from: "node-quality", to: "node-publish", slot: "主输入" },
      { id: "edge-publish-refresh", from: "node-publish", to: "node-refresh", slot: "主输入" }
    ];
    const definition = {
      id: M02_DEFINITION_ID, pipelineId: "pipeline-s004-preflight", name: "S004 贷前调查数据标准化",
      purpose: targetAsset.purpose, targetAssetId: M02_T006,
      nodes: definitionNodes, edges: definitionEdges,
      pythonModule: {
        id: "s004-preflight-pipeline", name: "贷前调查事实标准化", version: "1.0.0",
        inputSlots: [
          { id: "main", name: "主输入", required: true, accepts: ["source"] },
          { id: "reference", name: "参考输入", required: true, accepts: ["source"] }
        ]
      },
      templateId: "PIPE-TPL-S004-PREFLIGHT-v1.0",
      runtimeParameterKeys: ["sourceInstanceIds[]", "borrowerId", "applicationId", "scenarioRunId", "targetAssetVersion"],
      instanceBinding: activeBorrowerRun,
      qualityRules, ontologyBindingId: M02_REFRESH_TARGET_ID, refreshTarget: "贷前调查本体 · 数据刷新目标", refreshTargetId: M02_REFRESH_TARGET_ID,
      sourceMappingVersion: "MAP-S004-PREFLIGHT-V1", pipelineSchedule: "仅手工正式运行", publishedAt: now
    };
    const runInputs = [
      {
        nodeId: "node-source-official", slotId: "main", slot: "主输入", kind: "正式财务报告",
        resourceId: officialSource.id, name: officialSource.name, version: "SNAP-S004-AR-2025",
        versionPolicy: "固定精确快照", snapshot: "中国广核2025年年度报告.pdf", fingerprint: M02_ANNUAL_REPORT_2025_SHA256,
        asOf: "2025-12-31", memberScope: "不适用", fieldGrainContract: "正式财务报告原始事实层",
        qualityCondition: "结构已核验", assetContractFingerprint: "不适用", gate: "快照及截至时间已锁定"
      },
      {
        nodeId: "node-source-synthetic", slotId: "reference", slot: "参考输入", kind: "手工工作簿",
        resourceId: syntheticSource.id, name: syntheticSource.name, version: M02_SNAPSHOT_ID,
        versionPolicy: "固定精确快照", snapshot: "S004_贷前调查合成演示资料包-v2.0.1.xlsx", fingerprint: M02_SOURCE_SHA256,
        asOf: AS_OF, memberScope: "不适用", fieldGrainContract: "贷前调查缺口事实层",
        qualityCondition: "结构已核验且 synthetic-demo 已标识", assetContractFingerprint: "不适用", gate: "快照及截至时间已锁定"
      }
    ];
    const validationFingerprint = JSON.stringify({
      name: definition.name,
      purpose: definition.purpose,
      nodes: definition.nodes.map((node) => ({
        id: node.id, key: node.key, sourceId: node.sourceId, inputKind: node.inputKind,
        inputSlotId: node.inputSlotId, assetId: node.assetId, assetVersionId: node.assetVersionId,
        memberScope: node.memberScope
      })),
      edges: definition.edges.map((edge) => ({ from: edge.from, to: edge.to, slotId: edge.slotId })),
      inputs: runInputs.map((input) => ({
        nodeId: input.nodeId, resourceId: input.resourceId, version: input.version, asOf: input.asOf,
        allowed: true, fingerprint: input.fingerprint, memberScope: input.memberScope,
        assetContractFingerprint: input.assetContractFingerprint === "不适用" ? "" : input.assetContractFingerprint
      })),
      pythonModule: definition.pythonModule,
      targetAssetId: definition.targetAssetId,
      ontologyBindingId: definition.ontologyBindingId,
      qualityRules: definition.qualityRules
    });
    definition.validationSeen = true;
    definition.validationFingerprint = validationFingerprint;
    definition.validationAt = now;
    definition.immutable = true;
    const refreshTarget = s004RefreshTarget({
      context,
      semanticVersionId: ids.semanticVersionId,
      semanticVersion: ids.semanticVersion,
      memberIds: assetMembers.map((member) => member.id),
      relationIds: assetRelationships.map((relation) => relation.id),
      createdAt: now
    });
    const refreshCandidate = {
      refreshTargetId: refreshTarget.stableId,
      scenarioContext: scenario,
      bindingVersion: refreshTarget.bindingVersion,
      bindingName: refreshTarget.name,
      currentStatus: "可用",
      displayStatus: "可供刷新",
      allowRefreshSubmission: true,
      semanticVersionId: ids.semanticVersionId,
      semanticVersion: ids.semanticVersion,
      publishedSemanticVersionId: ids.semanticVersionId,
      t017VersionId: ids.semanticVersionId,
      sourceMappingVersionId: refreshTarget.sourceMappingVersionId,
      dataAssetId: M02_T006,
      memberIds: [...refreshTarget.memberIds],
      relationIds: [...refreshTarget.relationIds],
      memberCoverage: { expected: assetMembers.length, covered: assetMembers.length, complete: true, memberIds: [...refreshTarget.memberIds], missingMemberIds: [], extraMemberIds: [] },
      relationCoverage: { expected: assetRelationships.length, covered: assetRelationships.length, complete: true, relationIds: [...refreshTarget.relationIds], missingRelationIds: [], extraRelationIds: [] },
      owner: "本体管理",
      lastCheckedAt: now,
      notAllowedReason: null,
      recoverySuggestion: "无需恢复；新的候选提交前仍须重新读取 C032。",
      evidenceLocator: M02_REFRESH_TARGET_EVIDENCE_ID,
      managementEntry: null,
      evidenceEntry: null,
      targetFingerprint: seedSnapshotFingerprint(refreshTarget),
      publishedContext: {
        discovery: { versionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, publicationState: "Published", name: "贷前调查本体" }
      },
      validationProblems: []
    };
    const discoveryBase = {
      sourceModule: "本体管理", contractCode: "C032", responseId: M02_REFRESH_DISCOVERY_ID,
      responseVersion: "1", queryDataAssetId: M02_T006, scenarioContext: scenario,
      formedAt: now, readAt: now, readPurpose: "发现", status: "可用",
      candidates: [refreshCandidate], reason: null,
      recoverySuggestion: "提交新的候选版本前必须重新读取；不得复用当前历史发现结果。",
      requiresSubmitReread: true, verifiedAt: now
    };
    const ontologyDiscovery = {
      ...discoveryBase,
      responseFingerprint: seedSnapshotFingerprint(discoveryBase)
    };
    const refreshAttempt = {
      requestId: M02_REFRESH_REQUEST_ID, resultId: M02_REFRESH_RESULT_ID, runId: M02_RUN_ID,
      assetVersionId: M02_ASSET_VERSION, dataAssetDeliveryId: m02Delivery.payload.deliveryId,
      qualityResultId: "DQR-S004-20260815-V2-001", ontologyBindingId: M02_REFRESH_TARGET_ID,
      target: refreshTarget.name, targetT017: ids.semanticVersionId,
      sourceMappingVersion: refreshTarget.sourceMappingVersionId,
      c032ResponseId: ontologyDiscovery.responseId, c032ResponseVersion: ontologyDiscovery.responseVersion,
      c032Fingerprint: ontologyDiscovery.responseFingerprint, c032FormedAt: now, c032ReadAt: now,
      c032Candidate: refreshCandidate, publishedContext: refreshCandidate.publishedContext,
      scenarioContext: scenario, memberContractSummary: `${assetMembers.length} 个成员`,
      relationshipContractSummary: `${assetRelationships.length} 条关系`,
      requestStatus: "已受理", createdAt: now, acceptedAt: now,
      resultStatus: "成功", resultAt: now,
      t018Status: "可消费候选", t018EvidenceId: T018_EVIDENCE_ID, t018At: now,
      t019Status: "已采用", t019EvidenceId: ids.t019EvidenceId, t019BindingId: ids.t019RecordId,
      adoptedVersionId: M02_ASSET_VERSION, adoptedAt: now, adoptionOwner: "本体管理",
      objectCounts: { expected: assetMembers.length, processed: assetMembers.length },
      relationshipCounts: { expected: assetRelationships.length, processed: assetRelationships.length },
      primaryKeyCheck: "通过", endpointCheck: "通过", indexStatus: "可消费",
      failureReason: "", recovery: "无需恢复", retryOf: "", events: [
        { at: now, phase: "刷新请求", status: "已受理", detail: M02_REFRESH_REQUEST_ID },
        { at: now, phase: "本体处理", status: "成功", detail: M02_REFRESH_RESULT_ID },
        { at: now, phase: "正式采用", status: "已取得证据", detail: ids.t019EvidenceId }
      ]
    };
    const run = {
      id: M02_RUN_ID, definitionVersion: M02_DEFINITION_ID, pipelineId: "pipeline-s004-preflight",
      pipelineName: pipeline.name, status: "成功 · 消费就绪", trigger: "手工正式运行", startedAt: now, endedAt: now,
      executionStatus: "成功", executionEndedAt: now, closureStatus: "已闭环", closedLoopEndedAt: now,
      scenarioIdentityStatus: "已证明", asOf: AS_OF, quality: "通过", qualityId: "DQR-S004-20260815-V2-001",
      snapshot: "SNAP-S004-AR-2025；SNAP-S004-DEMO-20260815", snapshotHash: M02_SOURCE_SHA256,
      scenarioContext: scenario, instanceBinding: activeBorrowerRun, targetAssetId: M02_T006, assetVersion: M02_ASSET_VERSION,
      t008Confirmation: m02Delivery.payload.t008Confirmation,
      inputs: runInputs,
      plan: definitionNodes.map((node) => ({ id: node.id, key: node.key, name: node.key === "source" ? (node.sourceId === officialSource.id ? officialSource.name : syntheticSource.name) : ({ python: "贷前调查事实标准化", quality: "数据质量检查", publish: "发布数据资产", refresh: "提交本体刷新请求" }[node.key] || node.key) })),
      nodeExecutions: definitionNodes.map((node) => ({
        id: node.id, key: node.key, name: node.key === "source" ? (node.sourceId === officialSource.id ? officialSource.name : syntheticSource.name) : ({ python: "贷前调查事实标准化", quality: "数据质量检查", publish: "发布数据资产", refresh: "提交本体刷新请求" }[node.key] || node.key),
        status: "成功", startedAt: now, endedAt: now,
        inputSummary: node.key === "source" ? "固定来源快照" : "上游证据已锁定",
        outputSummary: node.key === "publish" ? M02_ASSET_VERSION : node.key === "refresh" ? `${ids.t019RecordId} · 已采用` : "执行证据已形成"
      })),
      qualityRuleSnapshot: qualityRules.map((rule) => ({ ...rule })),
      qualityChecks: qualityRules.map((rule, index) => ({
        id: rule.id, checkedCount: [8, 3, 11, 27, 6][index] || 1, failedCount: 0,
        impact: "硬阻断为 0，发布门通过", evidenceLocator: `数据工程 / 质量结果 / DQR-S004-20260815-V2-001 / ${rule.id}`
      })),
      consumption: `消费就绪 · ${M02_ASSET_VERSION}`, refresh: "已刷新"
    };
    assetVersion.bindingTrustSummary = {
      id: `TRUST-BIND-${M02_ASSET_VERSION}-01`, version: "v1.0", formedAt: now,
      targetAssetId: M02_T006, assetVersionId: M02_ASSET_VERSION, asOf: AS_OF,
      scenarioContext: scenario, qualityId: assetVersion.qualityId, quality: assetVersion.quality,
      sourceSnapshot: assetVersion.sourceSnapshot, runId: M02_RUN_ID, definitionVersion: M02_DEFINITION_ID,
      refreshRequestId: assetVersion.refreshRequestId, refreshResultId: assetVersion.refreshResultId,
      retentionPolicyId: assetVersion.retentionPolicyId, retentionPolicyVersion: assetVersion.retentionPolicyVersion,
      note: "冻结记录本版本发布时的数据身份、时点、质量和证据定位；后续状态变化不会改写本摘要。",
      evidenceRefs: [M02_SNAPSHOT_ID, M02_DEFINITION_ID, M02_RUN_ID, assetVersion.qualityId, M02_ASSET_VERSION]
    };
    assetVersion.currentTrustSummaries = [{
      id: `TRUST-STATE-${M02_ASSET_VERSION}-01`, version: "v1.0", formedAt: now,
      reason: "当前精确数据资产版本已取得 T018 资格与 T019 正式采用证据；C003 联合接收状态由当前页面会话重新读取。",
      assetVersionId: M02_ASSET_VERSION, asOf: AS_OF, quality: assetVersion.quality,
      scenarioContext: scenario, refreshRequestId: assetVersion.refreshRequestId, refreshResultId: assetVersion.refreshResultId,
      t018Status: assetVersion.t018Status, t019EvidenceId: assetVersion.t019EvidenceId,
      currentAuthorityVersionId: M02_ASSET_VERSION, previousAuthorityVersionId: "尚无上一权威版本",
      retentionPolicyId: assetVersion.retentionPolicyId, retentionPolicyVersion: assetVersion.retentionPolicyVersion,
      dimensions: {
        versionLocation: "可定位", contentAccess: "可访问", evidenceIntegrity: "完整",
        replayCapability: "未执行", replayVerification: "未执行"
      }
    }];
    return {
      scenarioId: "S004",
      scenarioContext: Object.assign({}, scenario, { receivedAt: now, source: "平台公共层共享状态" }),
      scenarioContextHistory: [], scenarioRunHistory: [], awaitingScenarioContext: false,
      scenarioResetRequestedAt: "", asOfDate: AS_OF, snapshotConfirmed: true,
      t008Confirmation: m02Delivery.payload.t008Confirmation,
      definitionPublished: true, definitionVersion: M02_DEFINITION_ID, publishedDefinitions: [definition],
      customSources: [officialSource, syntheticSource],
      customPipelines: [pipeline], customAssets: [targetAsset],
      sourceTemplates,
      activeBorrowerRun,
      borrowerRunInstantiationPolicy: {
        mode: "CLONE_TEMPLATES_TO_NEW_ISOLATED_SCENARIO_RUN",
        entryOwner: "平台公共层场景运行入口",
        m02Role: "来源模板选择、参数校验和隔离装配预演",
        requiredNewKeys: ["borrowerId", "unifiedSocialCreditCode", "memberId", "applicationId", "scenarioRunId", "reportId"],
        isolatedOutputs: ["sourceInstanceId", "sourceSnapshotId", "dataAssetVersion", "Published/C008 binding", "evidencePackId", "contentVersion"],
        formalCreationBoundary: "M02 预演不创建正式 C033、Checkpoint、快照、运行、数据资产版本或报告"
      },
      borrowerRunPreview: null,
      uploadedSnapshots: [
        { sourceId: "s004-official-annual-reports", snapshot: { snapshotId: "SNAP-S004-AR-2023", acquiredAt: now, asOf: "2023-12-31", fileName: "中国广核2023年年度报告.pdf", hash: "ad61895a8117b7c9129bb28483816f4f5d60b346245bd3a8a09d5c22e62f5d67", sizeBytes: 5955620, structureStatus: "结构已核验" } },
        { sourceId: "s004-official-annual-reports", snapshot: { snapshotId: "SNAP-S004-AR-2024", acquiredAt: now, asOf: "2024-12-31", fileName: "中国广核2024年年度报告.pdf", hash: "c379d7a62bb0fb8c0c5ceeba34f1ca9c806ee2ceb1b53bfcbf6c6f22076f9d5e", sizeBytes: 1423683, structureStatus: "结构已核验" } },
        { sourceId: "s004-official-annual-reports", snapshot: { snapshotId: "SNAP-S004-AR-2025", acquiredAt: now, asOf: "2025-12-31", fileName: "中国广核2025年年度报告.pdf", hash: M02_ANNUAL_REPORT_2025_SHA256, sizeBytes: M02_ANNUAL_REPORT_2025_SIZE_BYTES, structureStatus: "结构已核验" } },
        { sourceId: "s004-synthetic-demo-pack", snapshot: { snapshotId: M02_SNAPSHOT_ID, acquiredAt: now, asOf: AS_OF, fileName: "S004_贷前调查合成演示资料包-v2.0.1.xlsx", hash: M02_SOURCE_SHA256, sizeBytes: M02_SOURCE_SIZE_BYTES, structureStatus: "结构已核验", t008Confirmation: m02Delivery.payload.t008Confirmation } }
      ],
      snapshotReadEvents: [],
      currentSnapshotSelections: { "s004-official-annual-reports": "SNAP-S004-AR-2025", "s004-synthetic-demo-pack": M02_SNAPSHOT_ID },
      runs: [run], assetVersions: [assetVersion], dataAssetDeliveries: [m02Delivery.record], refreshAttempts: [refreshAttempt],
      candidateVersionId: "", runStatus: "ready", refreshStatus: "adopted",
      consumptionStatus: "ready",
      authorityVersionIds: { [M02_T006]: M02_ASSET_VERSION },
      previousAuthorityVersionIds: { [M02_T006]: "" },
      ontologyDiscovery, ontologyDiscoveryHistory: [ontologyDiscovery], ontologyDiscoveryStatus: "ready", ontologyDiscoveryError: "",
      canvasDrafts: {}, runPlan: [], runNodeStates: {}, refreshBindingSelections: {},
      schemaNote: "S004 runtime native seed"
    };
  }

  function memberFieldCount(relation) {
    return 2;
  }

  // ---------------------------------------------------------------- M03 ----

  // Keep the complete v1.0.3 intelligent-query state shape. S004 only fixes
  // this scenario's applicability to NOT_APPLICABLE and starts with empty
  // run/result collections; the baseline page, routes and controls remain.
  function buildM03State(context, artifacts) {
    const scenario = ctx5(context);
    const ids = artifactRuntimeIds(artifacts);
    const unavailableReason = "S004 贷前调查业务链路不需要独立智能问数运行；完整 v1.0.3 问数页面和内部路由仍保留。";
    const config = {
      id: "IQ-AGENT-S004-PREFLIGHT-NOT-APPLICABLE",
      name: "S004 贷前调查问数配置（不适用）",
      scene: `S004 · ${SCENARIO_NAME}`,
      sceneId: "S004", sceneVersion: context.scenarioVersion, sceneRunId: context.scenarioRunId,
      sceneVersionStatus: "当前场景不适用", status: "不适用", compatibility: "不适用",
      version: "IQ-S004-NOT-APPLICABLE-1.0", promptVersion: null, whitelistVersion: null,
      bindingVersion: `${ids.semanticVersion} · ${ids.semanticVersionId}`,
      bindingVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
      contentFingerprint: "CFG-S004-IQ-NOT-APPLICABLE", validationRef: null,
      compatibilityOwner: "智能问数", owner: "智能问数", skills: [], observedSkills: [], tools: [], observedTools: [],
      deterministicCapabilities: [], loadProof: null, lastRuntimeVerificationAt: null,
      allowedResources: [],
      allowedActions: [],
      prohibitedActions: ["发起问数 Run", "形成问数 Result", "提交标准 Action Request", "创建提醒或待办"],
      executionPolicy: { mayRun: false, mayCreateResult: false, maySubmitActionRequest: false },
      scenarioApplicability: { status: "NOT_APPLICABLE", reason: unavailableReason }
    };
    const candidate = { ...config, id: "IQ-AGENT-S004-PREFLIGHT-CANDIDATE", name: "S004 贷前调查问数配置候选", version: null, candidateRevision: 0, validation: { status: "不适用", attempt: 0, repaired: false, tests: [] } };
    return {
      schemaVersion: 20, serial: 0, activeConfig: config, enabledConfigs: [config], candidateConfig: candidate,
      recommendations: { status: "不适用", attempt: 0, items: [], error: unavailableReason, generatedAt: null },
      liveRuns: [], historyRuns: [], currentRunId: null, savedViews: [], pins: [], actionRequests: [],
      candidateConsumptionValidation: { status: "不适用", attempts: [], activeRun: null }, draftQuestion: "",
      preferredDisplay: { mode: "text", chart: "recommended", reducedMotion: false },
      currentScenario: "S004", scenarioContext: scenario,
      scenarioApplicability: { status: "NOT_APPLICABLE", reason: unavailableReason }, activeConfigStatus: "NOT_APPLICABLE",
      executionPolicy: { mayRun: false, mayCreateResult: false, maySubmitActionRequest: false },
      ui: { resourceView: "cards", historyFilter: "全部", viewMode: "cards" }
    };
  }

  // ---------------------------------------------------------------- M04 ----

  function buildM04State(context) {
    const scenario = ctx5(context);
    return {
      schemaVersion: 6, stateModelVersion: 2, variant: "portfolio", stateRevision: 1,
      scenarioContext: scenario, currentScenario: "S004",
      scenarioApplicability: { status: "EMPTY_ACTION_REQUEST_QUEUE", reason: "S004 本轮未由用户通过受控入口提交标准 Action Request；决策中心保持完整能力并展示空队列。" },
      applicability: "EMPTY_ACTION_REQUEST_QUEUE", requests: [], tasks: [], receipts: [], auditHistory: [],
      aiSummaries: {
        workbench: { scope: "决策工作台", status: "idle", summary: null, filterSnapshot: null, dataCutoff: null, generatedAt: null, sourceRevision: null, attempts: 0, error: null, needsRefresh: false },
        operationsOverview: { scope: "决策运营概览", status: "idle", summary: null, filterSnapshot: null, dataCutoff: null, generatedAt: null, sourceRevision: null, attempts: 0, error: null, needsRefresh: false }
      },
      pageStates: {
        workbench: { status: "ready", partial: false, error: null, lastSuccessfulAt: null, recoverable: true, restoreContext: { view: "reminders", search: "", source: "all", status: "all", layout: "list", scrollTop: 0 } },
        taskWork: { status: "ready", partial: false, error: null, lastSuccessfulAt: null, recoverable: true, restoreContext: { owner: "all", status: "all", sort: "dueDate", scrollTop: 0 } },
        operationsOverview: { status: "ready", partial: false, error: null, lastSuccessfulAt: null, recoverable: true, restoreContext: { timeRange: "all", source: "all", subject: "all", scrollTop: 0 } }
      },
      activity: [], resetAt: null
    };
  }

  function buildM04Inbox(context) {
    return { contractCode: "C011", sourceModule: "平台公共层", consumer: "决策中心", scenarioContext: ctx5(context), formedAt: context.formedAt, requests: [], status: "empty", reason: "当前没有待接收的行动申请" };
  }

  function buildC017QueryProjection(context, c008, artifacts) {
    const scenario = ctx5(context);
    const reason = "S004 贷前调查场景不启用独立智能问数；保留模块能力，但当前消费者不得发起正式 Run、形成 Result 或提交 Action Request。";
    return {
      projectionId: M03_C017_KEY, projectionVersion: "2", schemaVersion: 1, formedAt: context.formedAt,
      readStatus: "empty", contractCode: "C017", sourceModule: "数据工程", consumer: "智能问数", scenarioContext: scenario,
      applicability: "NOT_APPLICABLE", allowConsumption: false, mayRun: false, mayCreateResult: false, maySubmitActionRequest: false,
      reason,
      recovery: "如未来资料证明贷前调查需要独立交互问数，应形成新的场景版本和受控配置后再启用。",
      projections: []
    };
  }

  function buildC017DecisionProjection(context, c008, artifacts) {
    const scenario = ctx5(context);
    const ids = artifactRuntimeIds(artifacts);
    const qualityId = artifacts?.quality?.qualityRunId || "DQR-S004-20260815-V2-001";
    return {
      projectionId: M04_C017_KEY, projectionVersion: "2", schemaVersion: 1, formedAt: context.formedAt,
      readStatus: "ready", contractCode: "C017", sourceModule: "数据工程", consumer: "决策中心", scenarioContext: scenario,
      applicability: "EMPTY_ACTION_REQUEST_QUEUE", allowConsumption: false, actionRequestCount: 0,
      reason: "S004 当前无 Action Request；保留精确数据可信度投影，待用户提交标准 Action Request 后按同一 T006/T007/T018/T019 重新读取。",
      projections: [{
        scenarioContext: scenario, assetId: ids.dataAssetId, t006Id: ids.dataAssetId,
        dataVersion: ids.dataAssetVersion, t007Version: ids.dataAssetVersion, asOf: AS_OF,
        t018: { status: "可消费候选", evidenceId: T018_EVIDENCE_ID },
        t019: { status: "已采用", recordId: ids.t019RecordId, evidenceId: ids.t019EvidenceId },
        currentStateSummary: { id: `C017-S004-CURRENT-${context.scenarioRunId}`, version: "2.0.0", formedAt: context.formedAt },
        qualityStatus: "通过", hardQualityFailure: false, detectedAt: "不适用", impactScope: "不适用", businessFieldCategories: "不适用",
        reason: "当前没有行动申请需要过门；该投影仅证明数据版本、质量、候选资格和正式采用状态可定位。",
        recovery: "用户提交标准 Action Request 后重新读取。", evidenceLocator: qualityId
      }]
    };
  }

  function buildC019DecisionProjection(context) {
    return {
      projectionId: M04_C019_KEY, projectionVersion: "2", schemaVersion: 1,
      formedAt: context.formedAt, readStatus: "empty", contractCode: "C019",
      sourceModule: "决策中心", consumer: "报告中心", scenarioContext: ctx5(context),
      requests: [], tasks: [], actionRequests: [], records: [],
      reason: "S004 当前没有用户通过受控入口提交的标准 Action Request。"
    };
  }

  // The frozen report-center implementation understands a C022/C023-shaped
  // report evidence package.  S004 keeps its own facts and anchors here, but
  // still uses the baseline contracts rather than a private report view.
  function buildReportFactPackage(context, artifacts) {
    const scenario = ctx5(context);
    const ids = artifactRuntimeIds(artifacts);
    const reportDefinition = artifacts?.reportDefinition || {};
    const reportData = artifacts?.reportData || {};
    const evidenceArtifact = artifacts?.evidencePackage || {};
    const c008 = artifacts?.c008Facts || {};
    const c008Facts = c008.facts || {};
    const stableIdentity = artifacts?.sourceSnapshot?.stableIdentity || {};
    const humanConfirmation = artifacts?.humanConfirmation || {};
    const resultVersion = `METRIC-${ids.dataVersion}-01 / RULE-${ids.dataVersion}-01`;
    const sourceById = new Map((c008Facts.sourceCatalogue || []).map((item) => [item.sourceId, item]));
    const riskById = new Map((c008Facts.riskThemes || []).map((item) => [item.riskId, item]));
    const riskHumanById = new Map((humanConfirmation.riskControllabilityJudgements || []).map((item) => [item.riskId, item]));
    const definition = {
      id: reportDefinition.reportDefinitionId || ids.definitionId,
      version: reportDefinition.reportDefinitionVersion || "2.0.0",
      source: reportDefinition,
      sections: Array.isArray(reportDefinition.sections) ? reportDefinition.sections : [],
      formalOutputs: reportDefinition.formalOutputs || ["CONTROLLED_HTML", "SAME_SOURCE_PDF"],
      formalPageSystem: reportDefinition.formalPageSystem || "A4_PORTRAIT",
      docxOutput: reportDefinition.docxOutput || "NOT_IN_PHASE_ONE"
    };
    const sourceFact = (sourceId) => {
      const source = sourceById.get(sourceId) || {};
      return {
        id: sourceId,
        label: source.label || sourceId,
        kind: "证据来源",
        value: `${source.label || sourceId}；来源分类 ${source.sourceClass || "evidence"}；报告生成阶段未实时联网搜索`,
        scope: "数据来源",
        evidence: Array.isArray(source.evidenceRefs) ? source.evidenceRefs : [sourceId],
        anchorIds: ["sec-06-data-sources"],
        resultVersion,
        sourceClass: source.sourceClass || "evidence",
        acquisitionMode: source.sourceClass === "official-document" ? "受控文件快照" : source.sourceClass === "synthetic-demo" ? "预先采集并固化的演示资料节点" : "人工核实程序",
        liveWebSearchAtGeneration: false
      };
    };
    const riskFact = (riskId, anchorId) => {
      const risk = riskById.get(riskId) || {};
      const human = riskHumanById.get(riskId) || {};
      return {
        id: riskId,
        label: risk.title || riskId,
        kind: "AI建议（需人工确认）",
        value: `AI 建议：${human.statement || "请基于固定证据包形成风险分析建议，并由人工复核确认。"}`,
        scope: "借款风险分析",
        evidence: [...new Set([...(risk.evidenceRefs || []), humanConfirmation.confirmationId || ids.humanConfirmationId])],
        anchorIds: [anchorId],
        resultVersion,
        humanInputRequired: true,
        aiSuggestion: true,
        confirmationRequired: true,
        suggestionOrigin: "fixed-evidence-agent-draft"
      };
    };
    const facts = [
      { id: "FACT-S004-V2-BORROWER-001", label: "借款人名称", kind: "事实项", value: c008Facts.borrower?.fullName || "中国广核电力股份有限公司", scope: "集团成员借款人", evidence: c008Facts.borrower?.evidenceRefs || ["SRC-CGN-AR-2025", "SIM_BUSINESS_REGISTRY_UPLOAD"], anchorIds: ["sec-01-01-basic"], resultVersion },
      { id: "FACT-S004-V2-OWNERSHIP-001", label: "控股股东持股比例", kind: "事实项", value: c008Facts.ownership?.equitySummary || "控股股东持股 58.89%", scope: "股权事实", evidence: c008Facts.ownership?.evidenceRefs || ["SRC-CGN-AR-2025", "SIM_BUSINESS_REGISTRY_UPLOAD"], anchorIds: ["sec-01-02-equity"], resultVersion },
      { id: "FACT-S004-V2-OPERATIONS-001", label: "经营情况", kind: "事实项", value: `在运核电机组 ${c008Facts.operations?.managedOperatingUnits || "28"} 台；在建 ${c008Facts.operations?.managedConstructionUnits || "20"} 台。`, scope: "经营事实", evidence: c008Facts.operations?.evidenceRefs || ["SRC-CGN-AR-2025"], anchorIds: ["sec-02-operations"], resultVersion },
      { id: "facts.financialStatements", label: "三年完整财务报表", kind: "事实集合", value: `${(c008Facts.financialStatements?.periods || []).map((item) => item.label).join("、") || "2023—2025 年"}合并资产负债表、利润表和现金流量表`, scope: "财务报表事实", evidence: c008Facts.financialStatements?.evidenceRefs || ["SRC-CGN-AR-2023", "SRC-CGN-AR-2024", "SRC-CGN-AR-2025"], anchorIds: ["sec-03-01-basic-financial"], resultVersion },
      { id: "metricRun.results", label: "三年财务指标结果", kind: "Metric 结果集合", value: `${(c008.metricRun?.results || []).length || 17} 项 Published Metric 结果`, scope: "财务报表事实", evidence: (c008.metricRun?.results || []).map((item) => item.metricId).filter(Boolean), anchorIds: ["sec-03-01-basic-financial"], resultVersion },
      { id: "MET-DEBT-ASSET-RATIO", label: "2025 年资产负债率", kind: "Metric", value: `${(c008.metricRun?.results || []).find((item) => item.metricId === "MET-DEBT-ASSET-RATIO")?.values?.["2025"] || "0.6515"}`, unit: "RATIO", scope: "财务报表事实", evidence: ["MET-DEBT-ASSET-RATIO", "SRC-CGN-AR-2025"], anchorIds: ["sec-03-01-basic-financial"], resultVersion },
      { id: "MET-CURRENT-RATIO", label: "2025 年流动比率", kind: "Metric", value: `${(c008.metricRun?.results || []).find((item) => item.metricId === "MET-CURRENT-RATIO")?.values?.["2025"] || "0.66"}`, unit: "TIMES", scope: "财务报表事实", evidence: ["MET-CURRENT-RATIO", "SRC-CGN-AR-2025"], anchorIds: ["sec-03-01-basic-financial"], resultVersion },
      { id: "FACT-S004-V2-WORKING-CAPITAL-001", label: "新增流动资金贷款额度", kind: "Metric", value: `${c008Facts.workingCapital?.maximumNewWorkingCapitalLoan || "257901"} 万元`, unit: "万元", scope: "贷款申请", evidence: c008Facts.workingCapital?.evidenceRefs || ["SIM_LOAN_APPLICATION", "SIM_LOAN_LEDGER"], anchorIds: ["sec-03-02-funding"], resultVersion },
      riskFact("RISK-S004-V2-001", "sec-04-01-market-price"),
      riskFact("RISK-S004-V2-002", "sec-04-02-operation"),
      riskFact("RISK-S004-V2-003", "sec-04-03-solvency"),
      riskFact("RISK-S004-V2-004", "sec-04-04-capex"),
      { id: humanConfirmation.confirmationId || ids.humanConfirmationId, label: "授信结论", kind: "AI建议（需人工确认）", value: `AI 建议：${humanConfirmation.creditConclusion?.comprehensiveJudgement || "请基于固定证据包形成非约束性授信建议，并由财务公司有权人员人工确认。"}`, scope: "授信结论", evidence: [humanConfirmation.confirmationId || ids.humanConfirmationId], anchorIds: ["sec-05-credit-conclusion"], resultVersion, humanInputRequired: true, aiSuggestion: true, confirmationRequired: true, suggestionOrigin: "fixed-evidence-agent-draft" },
      ...["SRC-CGN-AR-SET", "SRC-CGN-DISCLOSURES", "SRC-CGN-RATINGS", "SRC-CGN-BRIEFING", "SRC-NUCLEAR-POLICY", "SRC-CUSTOMER-SPECIFIC-NOTICE"].map(sourceFact)
    ];
    const factById = new Map(facts.map((fact) => [fact.id, fact]));
    const sectionBindings = reportData.factBindings || {};
    const bindingMap = {
      "report-cover": ["FACT-S004-V2-BORROWER-001"],
      "sec-01-borrower-evaluation": sectionBindings["sec-01-borrower-evaluation"],
      "sec-01-01-basic": ["FACT-S004-V2-BORROWER-001"],
      "sec-01-02-equity": ["FACT-S004-V2-OWNERSHIP-001"],
      "sec-02-operations": sectionBindings["sec-02-operations"],
      "sec-02-01-basic": ["FACT-S004-V2-OPERATIONS-001"],
      "sec-02-02-main-business": ["FACT-S004-V2-OPERATIONS-001"],
      "sec-02-03-industry": ["SRC-NUCLEAR-POLICY", "SRC-CGN-DISCLOSURES"],
      "sec-02-04-plan": ["FACT-S004-V2-OPERATIONS-001", "SRC-CGN-DISCLOSURES"],
      "sec-03-financial": sectionBindings["sec-03-financial"],
      "sec-03-01-basic-financial": ["facts.financialStatements", "metricRun.results", "MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO"],
      "sec-03-02-funding": ["FACT-S004-V2-WORKING-CAPITAL-001"],
      "sec-04-risk": sectionBindings["sec-04-risk"],
      "sec-04-01-market-price": ["RISK-S004-V2-001"],
      "sec-04-02-operation": ["RISK-S004-V2-002"],
      "sec-04-03-solvency": ["RISK-S004-V2-003"],
      "sec-04-04-capex": ["RISK-S004-V2-004"],
      "sec-05-credit-conclusion": sectionBindings["sec-05-credit-conclusion"],
      "sec-06-data-sources": sectionBindings["sec-06-data-sources"]
    };
    const resolvedAnchors = (definition.sections || []).flatMap((section) => [
      { stableAnchor: section.stableAnchor, label: section.title, sectionId: section.sectionId, humanInputRequired: Boolean(section.humanInputRequired) },
      ...(section.subsections || []).map((subsection) => ({ stableAnchor: subsection.stableAnchor, label: subsection.title, sectionId: section.sectionId, humanInputRequired: Boolean(subsection.humanRiskJudgementRequired) }))
    ]).filter((item) => item.stableAnchor).map((item) => {
      const factRefs = [...new Set((bindingMap[item.stableAnchor] || []).filter((factId) => factById.has(factId)))];
      const boundFacts = factRefs.map((factId) => factById.get(factId));
      return {
        id: item.stableAnchor,
        sectionId: item.sectionId,
        stableAnchor: item.stableAnchor,
        label: item.label || item.stableAnchor,
        factRefs,
        evidenceRefs: [...new Set(boundFacts.flatMap((fact) => fact.evidence || []))],
        humanInputRequired: item.humanInputRequired || boundFacts.some((fact) => fact.humanInputRequired)
      };
    });
    const contentItems = resolvedAnchors.map((anchor, index) => {
      const boundFacts = anchor.factRefs.map((factId) => factById.get(factId)).filter(Boolean);
      const displayValue = boundFacts.length ? boundFacts.map((fact) => fact.value).join("；") : anchor.label;
      return {
        sourceItemId: `SRC-ITEM-S004-${String(index + 1).padStart(3, "0")}`,
        contentItemId: `CONTENT-S004-${String(index + 1).padStart(3, "0")}`,
        anchorId: anchor.stableAnchor,
        templateSlot: anchor.sectionId,
        contentType: anchor.humanInputRequired ? "需人工确认" : boundFacts.length ? "事实绑定" : "固定模板结构",
        location: anchor.label,
        origin: anchor.humanInputRequired ? "ai-suggestion-human-confirmation" : boundFacts.length ? "fixed-evidence-package" : "report-definition",
        claimType: anchor.humanInputRequired ? "AI建议（需人工确认）" : boundFacts.length ? "事实或证据" : "结构项",
        factRefs: anchor.factRefs,
        intendedFactRefs: anchor.factRefs,
        evidenceRefs: anchor.evidenceRefs,
        bindingStatus: "bound",
        requiresEvidence: boundFacts.length > 0,
        renderedValue: displayValue,
        displayValue,
        displayUnit: null,
        canonicalFactKey: anchor.factRefs[0] || null,
        rendered: true
      };
    });
    const template = {
      id: "RT-S004-PREFLIGHT-002",
      version: definition.version,
      slots: resolvedAnchors.map((anchor) => anchor.stableAnchor),
      downloads: {
        html: "RT-S004-PREFLIGHT-002-v2.0.0.html",
        json: "RT-S004-PREFLIGHT-002-v2.0.0.json"
      },
      confirmationLabel: "【需人工确认】",
      aiSuggestionLabel: "AI 建议（基于已固化资料与系统事实生成）"
    };
    const packageValue = {
      packageId: evidenceArtifact.evidencePackageId || ids.evidencePackId,
      packageVersion: evidenceArtifact.evidencePackageVersion || "2.0.0",
      schemaVersion: "2.0.0",
      factInventoryVersion: "2.0.0",
      factPackageStatus: "available",
      scenarioContext: scenario,
      sceneId: "S004",
      authorityBindingId: `C008-${context.scenarioRunId}`,
      semanticVersionId: ids.semanticVersionId,
      semanticVersion: ids.semanticVersion,
      dataAssetVersionId: ids.dataAssetVersion,
      dataVersion: ids.dataVersion,
      consumableVersionId: ids.consumableVersionId,
      asOf: AS_OF,
      quality: "通过",
      freshness: "截至时间已确认",
      readiness: "可消费",
      authoritativeBinding: { bindingId: `C008-${context.scenarioRunId}`, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, asOf: AS_OF, resultVersion },
      contentFacts: facts,
      anchors: resolvedAnchors,
      contentItems,
      renderManifest: { manifestId: `RM-S004-${context.scenarioRunId}`, version: definition.version, authoritativeBinding: { semanticVersionId: ids.semanticVersionId, dataVersion: ids.dataVersion }, items: contentItems },
      generatedNarrativeContract: { status: "structured-draft-only", owner: "Agent 应用", narratives: [{ id: "s004-scope", text: "贷前调查分析文字仅组织固定证据；高风险判断与授信结论需人工确认。" }] },
      // Deterministic verification and report Q&A consume this immutable
      // subset of C008.  It is fixed into the evidence package at the same
      // scenarioRunId; neither M05 nor M06 reads a workbook or source node at
      // runtime, and changing borrower/application data requires a new pack.
      deterministicInputs: {
        stableIdentities: immutableCopy(stableIdentity),
        formalBusinessSubject: immutableCopy(c008Facts.formalBusinessSubject || null),
        memberStatus: immutableCopy(c008Facts.memberStatus || null),
        borrower: immutableCopy(c008Facts.borrower || null),
        ownership: immutableCopy(c008Facts.ownership || null),
        operations: immutableCopy(c008Facts.operations || null),
        loanApplication: immutableCopy(c008Facts.loanApplication || null),
        internalFacility: immutableCopy(c008Facts.internalFacility || null),
        financialStatements: immutableCopy(c008Facts.financialStatements || null),
        metricOpeningBalances2022: immutableCopy(c008Facts.metricOpeningBalances2022 || null),
        metricResults: immutableCopy(c008.metricRun?.results || []),
        metricRunId: c008.metricRun?.metricRunId || null,
        workingCapital: immutableCopy(c008Facts.workingCapital || null),
        riskThemes: immutableCopy(c008Facts.riskThemes || []),
        sourceCatalogue: immutableCopy(c008Facts.sourceCatalogue || []),
        ruleRun: immutableCopy(c008.ruleRun || null)
      },
      groupMetrics: { applicationAmount: "100000 万元", newWorkingCapitalLoan: "257901 万元" },
      units: {},
      boards: [],
      trend: [],
      statusReason: "S004 固定证据包；财务报告已有事实不重复设置上传型模拟数据。"
    };
    return { packageValue, facts, anchors: resolvedAnchors, contentItems, definition, template, reportData, evidenceArtifact };
  }

  function buildC022Request(context, reportEvidence, c017Artifact = null) {
    const now = stamp(context);
    const binding = reportEvidence.packageValue.authoritativeBinding || {};
    const evidencePackId = reportEvidence.packageValue.packageId || EVIDENCE_PACK_ID;
    // When the formal C017 artifact declares a fixed current-state summary,
    // C022 must bind to that exact immutable identity.  The generated
    // scenario-run fallback remains only for demo/inline artifacts that do
    // not declare the field; it must never overwrite a formal C017 identity.
    const c017SummaryId = c017Artifact?.summaryId || `C017-S004-${context.scenarioRunId}`;
    const c017Owner = c017Artifact?.owner || "本制品未声明";
    const c017FormedAt = c017Artifact?.formedAt || now;
    const c017Status = c017Artifact?.status || "本制品未声明";
    return {
      requestId: C022_REQUEST_ID,
      submittedAt: now,
      type: "report-draft",
      reportAggregateId: "RAG-S004-20260815-001",
      evidencePackId,
      contentRevision: 1,
      reportDefinition: reportEvidence.definition,
      template: reportEvidence.template,
      semanticBinding: binding,
      scenarioContext: ctx5(context),
      reportContext: {
        scenarioContext: ctx5(context), scenarioLabel: `S004 · ${SCENARIO_NAME}`, reportRequestId: C022_REQUEST_ID,
        reportAggregateId: "RAG-S004-20260815-001", targetContentRevision: 1,
        evidencePack: { id: evidencePackId, version: reportEvidence.packageValue.packageVersion || "2.0.0", fixedAt: now },
        reportDefinition: reportEvidence.definition, template: reportEvidence.template,
        semanticBinding: binding,
        trustAtGeneration: { id: `C017-BIND-S004-${context.scenarioRunId}`, version: "2.0.0", formedAt: c017FormedAt, status: c017Status === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "warning" : "ready", statusLabel: c017Status === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "演示条件可信 · 可用于当前轮次" : "可用于报告草稿生成", owner: c017Owner, quality: "通过", freshness: "截至时间已固定", readiness: "可消费", currentStatusSummaryId: c017SummaryId, currentStatusSummaryVersion: "2.0.0" }
      },
      reportEvidence: reportEvidence.packageValue,
      source: "报告中心（M06）"
    };
  }

  function buildC024Request(context, reportEvidence) {
    const now = stamp(context);
    const binding = reportEvidence.packageValue.authoritativeBinding || {};
    const evidencePackId = reportEvidence.packageValue.packageId || EVIDENCE_PACK_ID;
    const evidencePackVersion = reportEvidence.packageValue.packageVersion || "2.0.0";
    const reportId = reportEvidence.reportData.reportId || "RPT-S004-20260815-0001";
    const reportNumber = reportEvidence.reportData.reportNumber || reportEvidence.reportData.reportNo || REPORT_NO;
    const contentVersion = reportEvidence.reportData.contentVersion || CONTENT_VERSION;
    return {
      requestId: C024_REQUEST_ID,
      receivedAt: now,
      source: "报告中心",
      title: "S004 贷前调查报告伴读",
      question: "请解释本报告第三部分财务情况与第四部分风险分析的主要证据、核验状态和人工判断边界。",
      selectedAnchor: "sec-03-financial",
      evidencePackId,
      reportContentVersion: contentVersion,
      fixedContextRef: { reportId, reportNumber, contentVersion, evidencePackId, evidencePackVersion, ...binding },
      reportContext: {
        scenarioContext: ctx5(context), reportId, reportNumber, contentVersion,
        anchorSnapshotId: `ANCHOR-SNAPSHOT-S004-${context.scenarioRunId}`, anchorSnapshotVersion: contentVersion, selectedAnchor: "sec-03-financial",
        evidencePack: { id: evidencePackId, version: evidencePackVersion },
        evidencePackId, evidencePackageVersion: evidencePackVersion,
        semanticBinding: binding,
        question: "请解释本报告第三部分财务情况与第四部分风险分析的主要证据、核验状态和人工判断边界。"
      },
      reportEvidence: reportEvidence.packageValue
    };
  }

  // ---------------------------------------------------------------- M05 ----

  function buildM05State(context, artifacts) {
    const scenario = ctx5(context);
    const now = stamp(context);
    const ids = artifactRuntimeIds(artifacts);
    const agentArtifact = artifacts?.agentConfig || {};
    const c017Artifact = artifacts?.c017 || {};
    const reportEvidence = buildReportFactPackage(context, artifacts);
    const artifactProjection = runtimeArtifactProjection(context, artifacts, "M05");
    const c022 = buildC022Request(context, reportEvidence, c017Artifact);
    const c024 = buildC024Request(context, reportEvidence);
    const c022Trust = c022.reportContext?.trustAtGeneration || {};
    const evidencePackageVersion = reportEvidence.packageValue.packageVersion || "2.0.0";
    const definitionVersion = reportEvidence.definition.version || "2.0.0";
    const ontologyLabel = `贷前调查本体 · Published ${ids.semanticVersion}`;
    const draftBinding = { id: "AG-SB-REPORT-GENERATION", version: definitionVersion, mode: "request-context", scenarioId: null, scenarioLabel: "财务公司贷款贷前调查报告生成", objectScope: null, status: "ready" };
    const copilotBinding = { id: "AG-SB-REPORT-CONTEXT", version: definitionVersion, mode: "request-context", scenarioId: null, scenarioLabel: "已发布贷前调查报告伴读", objectScope: null, status: "ready" };
    const agent = {
      id: "report-draft", sourceAgentDefinitionId: ids.agentId,
      name: "S004 贷前调查报告 Agent", shortName: "S004 报告草稿",
      type: "报告草稿 Agent",
      purpose: "依据报告中心固定的证据包，生成贷前调查报告结构化草稿。",
      status: "enabled", activeRelease: ids.agentRelease, scenario: `S004 · ${SCENARIO_NAME}`,
      releases: [{
        version: ids.agentRelease, releasedAt: now, validationAt: now,
        inputContract: "Generation Evidence Package v1", outputContract: "Agent Report Draft v1",
        sourceInputContract: agentArtifact.inputContract || ids.evidencePackId,
        sourceOutputSchema: agentArtifact.outputSchema || "ofw.s004.agent-draft.v2",
        prompt: { ...BASELINE_REPORT_DRAFT_RESOURCES.prompt },
        skills: BASELINE_REPORT_DRAFT_RESOURCES.skills.map((item) => ({ ...item })),
        tools: [...BASELINE_REPORT_DRAFT_RESOURCES.tools],
        artifactMetadata: {
          agentDefinitionId: ids.agentId,
          agentReleaseVersion: ids.agentRelease,
          promptVersion: agentArtifact.promptVersion || null,
          skillVersion: agentArtifact.skillVersion || null,
          toolWhitelist: [...(agentArtifact.toolWhitelist || [])],
          inputContract: agentArtifact.inputContract || ids.evidencePackId,
          outputSchema: agentArtifact.outputSchema || "ofw.s004.agent-draft.v2"
        },
        ontology: ontologyLabel,
        ontologyScope: "贷前调查报告所需已发布业务对象、指标与规则",
        scenarioBinding: draftBinding, change: "贷前调查报告 Agent 初始发布",
        generationPolicy: agentArtifact.generationPolicy || {},
        humanOnlyOutputSlots: agentArtifact.humanOnlyOutputSlots || [],
        aiSuggestionSlots: ["riskControllabilityJudgements", "creditComprehensiveJudgement"],
        confirmationPolicy: "AI 建议基于已固化资料与系统事实生成；风险判断、调查意见、授信结论及发布授权必须人工确认"
      }]
    };
    const copilotAgent = {
      id: "report-copilot", name: "S004 贷前调查报告伴读 Agent", shortName: "S004 报告伴读",
      type: "报告伴读 Agent",
      purpose: "只解释已发布 S004 贷前调查报告和固定证据；不重新计算正式指标、不形成授信结论、不提交行动申请。",
      status: "enabled", activeRelease: "2.0.0", scenario: `S004 · ${SCENARIO_NAME}`,
      releases: [{ version: ids.agentRelease, releasedAt: now, validationAt: now, inputContract: "Report Reading Request v1", outputContract: "Report Copilot Result v1", prompt: { ...BASELINE_REPORT_COPILOT_RESOURCES.prompt }, skills: BASELINE_REPORT_COPILOT_RESOURCES.skills.map((item) => ({ ...item })), tools: [...BASELINE_REPORT_COPILOT_RESOURCES.tools], ontology: ontologyLabel, ontologyScope: "S004 贷前调查固定证据范围", scenarioBinding: copilotBinding, change: "S004 贷前调查报告伴读场景接入版本" }]
    };
    const evidence = {
      id: `${ids.evidencePackId}@${evidencePackageVersion}:generation`, evidencePackageId: ids.evidencePackId, evidencePackageVersion, name: "S004 贷前调查固定证据包", kind: "report-generation",
      currentProjection: true, projectionStatus: "current", status: "ready", statusLabel: "固定输入 · 可用于当前新运行", readOnly: true, mutationPolicy: "IMMUTABLE_EVIDENCE_APPEND_RUNS",
      semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
      dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion,
      consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF, ontologyVersion: ontologyLabel,
      quality: "通过固定证据门", freshness: "截至时间已确认", authority: "Published 本体与 C008 权威事实包",
      formedAt: now, previousId: null, scenarioContext: scenario,
      sourceArtifactScenarioContext: artifactProjection.sourceScenarioContext,
      runtimeProjectionContext: artifactProjection.targetRuntimeScenarioContext,
      requestContext: { id: C022_REQUEST_ID, version: "1.0", sourceOwner: "报告中心", scenarioId: "S004", scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, scenarioLabel: `S004 · ${SCENARIO_NAME}`, requestedAt: now, objectScope: "S004 贷前调查固定证据范围", expectedOutput: "Agent Report Draft v1" },
      report: { name: "财务公司贷款贷前调查报告", number: ids.reportNo, contentVersion: ids.contentVersion, anchor: "sec-03-financial", verification: "确定性核验已完成", verificationRunRef: ids.verificationRunId },
      generation: { identity: { requestId: C022_REQUEST_ID, aggregateId: "RAG-S004-20260815-001", evidencePackageId: ids.evidencePackId, evidencePackageVersion, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF, reportDefinitionId: ids.definitionId, reportDefinitionVersion: definitionVersion, templateId: reportEvidence.template.id, templateVersion: reportEvidence.template.version, targetContentRevision: 1 }, reportDefinition: reportEvidence.definition, template: reportEvidence.template, reportEvidence: c022.reportEvidence, contentRevision: 1, c022RequestId: C022_REQUEST_ID, reportEvidenceRef: ids.evidencePackId },
      credibility: buildM05C017Credibility(context, ids, c017Artifact, reportEvidence, c022Trust, now),
      items: reportEvidence.facts.map((fact) => ({ id: fact.id, type: fact.kind, name: fact.label, value: fact.value, object: fact.scope, source: fact.evidence.join("、"), evidenceRefs: fact.evidence, anchorIds: fact.anchorIds })),
      reportEvidence: c022.reportEvidence,
      itemsLegacy: [
        { id: "s004-ev-001", type: "身份", name: "借款人统一社会信用代码", value: "91440300093677087R", object: "集团成员借款人", source: "official-public" },
        { id: "s004-ev-002", type: "身份", name: "贷款申请编号", value: "APP-S004-20260815-0001", object: "贷款申请", source: "synthetic-demo" },
        { id: "s004-ev-003", type: "Metric", name: "新增流动资金贷款额度", value: "257,901 万元", object: "贷款申请", source: "derived-deterministic" },
        { id: "s004-ev-004", type: "AI建议（需人工确认）", name: "授信结论", value: "AI 建议：原则上提交人工授信审批；最终决定、额度、利率与条件由人工确认", object: "贷前调查报告", source: "fixed-evidence-agent-draft + human-confirmation" }
      ]
    };
    const run = {
      id: ids.agentRunId, status: "complete", createdAt: artifacts?.draftOutput?.startedAt || now, finishedAt: artifacts?.draftOutput?.completedAt || now,
      source: "Agent 应用", currentProjection: true, projectionStatus: "current",
      attempt: 1, failureMode: "normal", gateReason: null, retryOf: null, replacesRun: null,
      sessionId: null, bindingId: draftBinding.id, orchestrationRunId: null, stepRunId: null,
      scenarioContext: scenario, requestId: C022_REQUEST_ID, question: "按权威示例章节组织贷前调查报告草稿",
      steps: [
        { id: "input", name: "输入与版本校验", status: "complete", detail: "核对固定证据包与 Published 版本" },
        { id: "tools", name: "受控工具调用", status: "complete", detail: "仅调用白名单内工具" },
        { id: "generate", name: "结构化生成", status: "complete", detail: "按报告定义组织草稿" },
        { id: "output", name: "输出合同校验", status: "complete", detail: "Agent Report Draft v1" }
      ],
      toolCalls: [],
      result: {
        id: ids.agentResultId, type: "Agent Report Draft", contract: agentArtifact.outputSchema || "Agent Report Draft v1",
        title: "S004 贷前调查报告结构化草稿",
        summary: "覆盖借款人评价、经营、财务、风险分析与数据来源的章节草稿；风险与授信章节形成基于已固化资料与系统事实的 AI 建议，并明确标注需人工确认。",
        sections: [
          { title: "第一部分 借款人评价（工商信息）", body: "已绑定借款人身份与股权事实。", refs: ["FACT-S004-V2-BORROWER-001", "FACT-S004-V2-OWNERSHIP-001"] },
          { title: "第二部分 借款人经营情况", body: "已绑定经营事实与公开资料。", refs: ["FACT-S004-V2-OPERATIONS-001"] },
          { title: "第三部分 借款人财务情况", body: "已绑定财务指标与资金需求测算。", refs: ["MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO", "FACT-S004-V2-WORKING-CAPITAL-001"] },
          { title: "第四部分 借款风险分析", body: "已基于固定证据包形成非约束性 AI 建议；发布前须由人工确认风险可控性判断。", refs: ["RISK-S004-V2-001", "RISK-S004-V2-002"] },
          { title: "第五部分 授信结论", body: "已形成明确标注的 AI 建议；正式授信决定、额度、期限、利率和条件仍须由财务公司有权人员人工确认。", refs: ["HCONF-S004-20260815-0002"] }
        ],
        limitations: "草稿不是正式报告；不含人工授信决定。",
        confidence: "固定证据引用完整", generatedAt: now, owner: "Agent 应用（M05）", freshness: evidence.freshness, confirmation: "unconfirmed",
        destination: "保留在 Agent 应用；由报告中心人工复核采纳", evidencePackageId: ids.evidencePackId,
        scenarioContext: scenario,
        reportNumber: ids.reportNo, contentVersion: ids.contentVersion, reportDefinitionId: ids.definitionId, reportDefinitionVersion: definitionVersion, templateId: reportEvidence.template.id, templateVersion: reportEvidence.template.version, reportAggregateId: "RAG-S004-20260815-001", semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF,
        sourceDraftId: "SRC-DRAFT-S004-20260815-0001", sourceItems: reportEvidence.contentItems,
        generatedContent: { contentRevision: 1, contentFacts: reportEvidence.facts.map((fact, index) => ({ contentFactId: `GCF-S004-${String(index + 1).padStart(3, "0")}`, sourceFactId: fact.id, factId: fact.id, intendedFactId: fact.id, label: fact.label, kind: fact.kind, value: fact.value, authoritativeValue: fact.value, unit: fact.unit || null, scope: fact.scope, resultVersion: fact.resultVersion, evidenceRefs: fact.evidence, anchorIds: fact.anchorIds, bindingStatus: "bound", basis: fact.evidence })), bindingGaps: [], generatedNarratives: [], anchors: reportEvidence.anchors, renderManifest: reportEvidence.packageValue.renderManifest }
      },
      error: null, recovery: null,
      snapshot: {
        agentId: agent.id, agentName: agent.name, agentRelease: ids.agentRelease, scenarioBinding: draftBinding,
        requestContext: evidence.requestContext, scenarioId: "S004", scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId, scenario: `S004 · ${SCENARIO_NAME}`, objectScope: "S004 贷前调查固定证据范围",
        expectedOutput: "Agent Report Draft v1",
        reportNumber: ids.reportNo, contentVersion: ids.contentVersion, reportVersion: `${ids.reportNo} · ${ids.contentVersion}`,
        prompt: { id: "prompt-report-draft", version: "1.0" },
        promptBinding: { id: "prompt-report-draft", version: "1.0", name: "报告草稿组织边界" },
        skills: [{ id: "skill-report-organization", version: "1.0" }],
        skillBindings: [{ id: "skill-report-organization", version: "1.0", name: "报告组织" }],
        tools: agent.releases[0].tools,
        toolBindings: agent.releases[0].tools.map((id) => ({ id, version: "1.0", name: id, owner: "Agent 应用" })),
        ontology: agent.releases[0].ontology, ontologyScope: "S004 贷前调查固定证据范围",
        inputContract: "Generation Evidence Package v1", outputContract: "Agent Report Draft v1",
        evidenceId: evidence.id, evidencePackageId: ids.evidencePackId, evidencePackageVersion,
        evidenceName: evidence.name, evidenceAuthority: evidence.authority, evidenceFormedAt: evidence.formedAt,
        semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
        dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion,
        consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF,
        ontologyVersion: agent.releases[0].ontology, quality: evidence.quality, freshness: evidence.freshness,
        credibility: evidence.credibility,
        evidenceStatus: "ready", requestId: C022_REQUEST_ID, question: "按权威示例章节组织贷前调查报告草稿"
      }
    };
    const copilotEvidence = {
      ...evidence,
      id: `${ids.evidencePackId}@${evidencePackageVersion}:report`, kind: "report", name: "S004 贷前调查报告伴读固定证据", statusLabel: "固定报告快照 · 可用于新问答",
      readOnly: true, mutationPolicy: "IMMUTABLE_EVIDENCE_APPEND_RUNS",
      requestContext: { id: C024_REQUEST_ID, version: "1.0", sourceOwner: "报告中心", scenarioId: "S004", scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, scenarioLabel: `S004 · ${SCENARIO_NAME}`, requestedAt: now, objectScope: "S004 已发布贷前调查报告 / sec-03-financial", expectedOutput: "Report Copilot Result v1" },
      report: { name: "财务公司贷款贷前调查报告", number: ids.reportNo, contentVersion: ids.contentVersion, anchor: "sec-03-financial", verification: "确定性核验已完成", verificationRunRef: ids.verificationRunId }
    };
    const verificationArtifact = artifacts?.deterministicVerification || {};
    const verificationSummary = verificationArtifact.status === "PASS"
      ? `PASS · 确定性核验已完成（${Array.isArray(verificationArtifact.checks) ? verificationArtifact.checks.length : 0} 项检查）`
      : verificationArtifact.status || "本制品未声明";
    const copilotRun = {
      id: COPILOT_RUN_ID, status: "complete", createdAt: now, finishedAt: now, source: "Agent 应用", currentProjection: true, projectionStatus: "current", attempt: 1, failureMode: "normal", gateReason: null, retryOf: null, replacesRun: null,
      sessionId: COPILOT_SESSION_ID, bindingId: copilotBinding.id, orchestrationRunId: null, stepRunId: null, scenarioContext: scenario, requestId: C024_REQUEST_ID,
      question: c024.question, steps: [{ id: "input", name: "读取报告上下文", status: "complete" }, { id: "evidence", name: "读取固定证据", status: "complete" }, { id: "answer", name: "组织解释", status: "complete" }], toolCalls: [],
      result: { id: `${ids.agentResultId}-COPILOT`, type: "Report Copilot Result", contract: "Report Copilot Result v1", title: "S004 贷前调查报告伴读结果", summary: "解释第三部分财务情况与第四部分风险分析的固定证据、核验状态和人工判断边界。", sections: [{ title: "财务情况", body: "资产负债率 65.15%、流动比率 0.66 倍及资金需求测算均来自固定证据包。", refs: ["MET-DEBT-ASSET-RATIO", "MET-CURRENT-RATIO", "FACT-S004-V2-WORKING-CAPITAL-001"] }, { title: "人工判断边界", body: "风险分析和授信结论保留人工确认；Agent 不生成授信决定。", refs: ["RISK-S004-V2-001", ids.humanConfirmationId] }], limitations: "伴读只解释已发布内容，不重算正式指标。", confirmation: "not-required", owner: "Agent 应用（M05）", generatedAt: now, freshness: copilotEvidence.freshness, confidence: "固定证据引用完整；不重算正式指标", destination: "已返回报告中心伴读界面", reportNumber: ids.reportNo, contentVersion: ids.contentVersion, evidencePackageId: ids.evidencePackId, scenarioContext: scenario },
      error: null, recovery: null,
      snapshot: { agentId: "report-copilot", agentName: copilotAgent.name, agentRelease: ids.agentRelease, scenarioBinding: copilotBinding, requestContext: copilotEvidence.requestContext, scenarioId: "S004", scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, scenario: `S004 · ${SCENARIO_NAME}`, objectScope: "S004 已发布贷前调查报告 / sec-03-financial", expectedOutput: "Report Copilot Result v1", prompt: { ...copilotAgent.releases[0].prompt }, promptBinding: { ...copilotAgent.releases[0].prompt, name: "报告解释边界" }, skills: copilotAgent.releases[0].skills, skillBindings: copilotAgent.releases[0].skills.map((item) => ({ ...item, name: item.id })), tools: copilotAgent.releases[0].tools, toolBindings: copilotAgent.releases[0].tools.map((id) => ({ id, version: "1.0", name: id, owner: "Agent 应用" })), ontology: copilotAgent.releases[0].ontology, ontologyScope: "S004 已发布贷前调查报告 / sec-03-financial", inputContract: "Report Reading Request v1", outputContract: "Report Copilot Result v1", evidenceId: copilotEvidence.id, evidencePackageId: ids.evidencePackId, evidencePackageVersion, evidenceName: copilotEvidence.name, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF, ontologyVersion: copilotAgent.releases[0].ontology, quality: copilotEvidence.quality, freshness: copilotEvidence.freshness, credibility: copilotEvidence.credibility, evidenceStatus: "ready", requestId: C024_REQUEST_ID, question: c024.question, reportNumber: ids.reportNo, contentVersion: ids.contentVersion, anchor: "sec-03-financial", reportVersion: `${ids.reportNo} · ${ids.contentVersion}`, verificationSummary, verificationRunRef: ids.verificationRunId, currentComparisonRef: null, regenerationStatus: "可由报告中心提交新的完整 C024；历史报告不原地更新", regenerationRef: null }
    };
    const copilotSession = {
      id: COPILOT_SESSION_ID, bindingId: copilotBinding.id, currentProjection: true, projectionStatus: "current", scenarioContext: scenario, scenarioId: "S004", scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, reportNumber: ids.reportNo, contentVersion: ids.contentVersion, reportVersion: `${ids.reportNo} · ${ids.contentVersion}`, requestContext: copilotEvidence.requestContext, anchor: "sec-03-financial", evidenceId: copilotEvidence.id, evidencePackageId: ids.evidencePackId, evidencePackageVersion, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, ontologyVersion: copilotAgent.releases[0].ontology, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, status: "active", createdAt: now, latestRunId: COPILOT_RUN_ID, latestResultId: `${ids.agentResultId}-COPILOT`, resultReturnStatus: "已形成独立 Run、Result 与伴读 Session", resultReturnedAt: now, verificationSummary, verificationRunRef: ids.verificationRunId, currentComparisonRef: null, currentComparisonStatus: "本制品未声明 C027 当前比较记录", regenerationStatus: "当前轮次可接收新的完整 C024 并追加伴读运行", regenerationRef: null
    };
    return {
      schemaVersion: 23, staticCatalogStoredAsReference: true,
      artifactProjection,
      scenarioAccess: {
        mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY",
        label: "当前隔离轮次可运行 · 历史不可变",
        allowedActions: ["查看 Agent 目录", "查看配置资源", "接收完整 C022/C024", "发起当前轮次新运行", "追加 Run/Result/Session", "基于当前 Release 创建新草稿", "验证草稿并发布新的 Agent Release", "查看结果与证据", "人工确认结果参考价值"],
        blockedActions: ["覆盖历史 Run/Result/Session", "原地修改已发布 Agent Release", "绕过报告中心发布报告", "直接读取工作簿或源节点", "提交 Action Request"],
        reason: "当前 S004 scenarioRunId 已打通报告生成与伴读链；固定证据包本身不可变，但可追加新的运行和结果。历史报告、历史运行与 Checkpoint 不被覆盖。"
      },
      agentOverrides: [agent, copilotAgent], agents: [], baseEvidenceOverrides: [],
      evidencePackages: [evidence, copilotEvidence], runs: [run, copilotRun], sessions: [copilotSession],
      drafts: [], inboundRequests: [{ id: C022_REQUEST_ID, sourceRequestId: C022_REQUEST_ID, type: "report-draft", title: "S004 贷前调查报告生成", source: "报告中心", receivedAt: now, status: "complete", currentProjection: true, projectionStatus: "current", evidenceId: evidence.id, agentId: "report-draft", sourceAgentDefinitionId: ids.agentId, reportAggregateId: "RAG-S004-20260815-001", reportDefinitionId: ids.definitionId, reportDefinitionVersion: definitionVersion, templateId: reportEvidence.template.id, templateVersion: reportEvidence.template.version, evidencePackageId: ids.evidencePackId, evidencePackageVersion, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF, scenarioContext: scenario, question: "按固定报告定义、模板槽位和证据包生成结构化源草稿", requestContext: evidence.requestContext, c022, c022Fingerprint: JSON.stringify(c022) }, { id: C024_REQUEST_ID, sourceRequestId: C024_REQUEST_ID, type: "report-copilot", title: c024.title, source: "报告中心", receivedAt: now, status: "complete", currentProjection: true, projectionStatus: "current", evidenceId: copilotEvidence.id, agentId: "report-copilot", reportNumber: ids.reportNo, contentVersion: ids.contentVersion, reportVersion: `${ids.reportNo} · ${ids.contentVersion}`, evidencePackageId: ids.evidencePackId, evidencePackageVersion, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion, consumableVersionId: ids.consumableVersionId, dataAsOf: AS_OF, scenarioContext: scenario, anchor: "sec-03-financial", question: c024.question, requestContext: copilotEvidence.requestContext, c024, c024Fingerprint: JSON.stringify(c024) }], c022Rejections: [], c024Rejections: [],
      handoffs: [], orchestrations: [],
      sequence: { run: 2, debug: 0, handoff: 0, orchestration: 0, orchestrationRun: 0, result: 2, session: 1 },
      currentScenarioContext: scenario
    };
  }

  // ---------------------------------------------------------------- M06 ----

  function buildC008Envelope(context, artifacts) {
    const scenario = ctx5(context);
    const ids = artifactRuntimeIds(artifacts);
    const artifactProjection = runtimeArtifactProjection(context, artifacts, "C008");
    return {
      projectionId: C008_PROJECTION_KEY, projectionVersion: "2", schemaVersion: 1,
      formedAt: context.formedAt, sourceModule: "本体管理", contractCode: "C008",
      readStatus: "available", scenarioContext: scenario,
      artifactProjection,
      scenarioId: scenario.scenarioId, scenarioVersion: scenario.scenarioVersion,
      scenarioRunId: scenario.scenarioRunId, scenarioName: SCENARIO_NAME,
      scenarioFormedAt: scenario.formedAt, scenarioStatus: scenario.status,
      publishedSemanticVersionId: ids.semanticVersionId, publishedSemanticVersion: ids.semanticVersion,
      consumableDataVersion: ids.dataVersion, dataAsOf: AS_OF, switchedAt: context.formedAt,
      ontologyStableId: ids.ontologyStableId,
      current: {
        ontologyStableId: ids.ontologyStableId, semanticVersionId: ids.semanticVersionId,
        semanticVersion: ids.semanticVersion, dataVersion: ids.dataVersion, asOf: AS_OF,
        switchedAt: context.formedAt, t019: { recordId: ids.t019RecordId, evidenceId: ids.t019EvidenceId }
      },
      evidenceLocator: "统一平台 / 本体管理 / Published 指针"
    };
  }

  function buildC017ReportProjection(context, c008, artifacts) {
    const scenario = ctx5(context);
    const ids = artifactRuntimeIds(artifacts);
    return {
      projectionId: C017_REPORT_KEY, schemaVersion: 1, projectionVersion: "2",
      formedAt: context.formedAt, readStatus: "ready", contractCode: "C017",
      sourceModule: "数据工程", consumer: "报告中心", scenarioContext: scenario,
      projections: [{
        scenarioContext: scenario, assetId: ids.dataAssetId,
        dataVersion: c008.current.dataVersion, asOf: c008.current.asOf,
        allowConsumption: true, refresh: { t018EvidenceId: T018_EVIDENCE_ID },
        currentStateSummary: { id: `C017-S004-${context.scenarioRunId}`, version: "2.0.0", formedAt: context.formedAt, sourceOwner: "数据工程", qualityStatus: "通过", hardQualityFailure: false, detectedAt: "不适用", impactScope: "S004 固定报告证据范围", recovery: null, reason: null },
        versionBindingSummary: { id: `C017-BIND-S004-${context.scenarioRunId}`, version: "2.0.0", formedAt: context.formedAt, ontology: ids.semanticVersion, t006: ids.dataAssetId, t007: ids.dataAssetVersion, t008: AS_OF },
        quality: { status: "通过", warnings: ["合成演示资料为演示口径"] },
        freshness: { label: "截至时间已确认", status: "confirmed" },
        fiveDimensions: [], candidate: null, previousTrusted: null
      }]
    };
  }

  function buildM06State(context, frozenHtml, artifacts) {
    const scenario = ctx5(context);
    const now = stamp(context);
    const ids = artifactRuntimeIds(artifacts);
    const reportEvidence = buildReportFactPackage(context, artifacts);
    const artifactProjection = runtimeArtifactProjection(context, artifacts, "M06");
    const reportDefinitionArtifact = artifacts?.reportDefinition || {};
    const reportData = artifacts?.reportData || {};
    const verificationArtifact = artifacts?.deterministicVerification || {};
    const humanConfirmation = artifacts?.humanConfirmation || {};
    const publicationManifest = artifacts?.publicationManifest || {};
    const definitionVersion = reportEvidence.definition.version || "2.0.0";
    const evidencePackageVersion = reportEvidence.packageValue.packageVersion || "2.0.0";
    const verificationChecks = Array.isArray(verificationArtifact.checks) ? verificationArtifact.checks : [];
    const verificationCount = verificationChecks.length || reportEvidence.contentItems.length;
    const factBindingCount = reportEvidence.facts.length;
    const anchorCount = reportEvidence.contentItems.length;
    const publishedAt = publicationManifest.publishedAt || reportData.publishedAt || now;
    const draftId = `DRF-${ids.reportId}`;
    const reviewCopyId = `RC-${ids.reportId}`;
    const contentSnapshot = {
      snapshotId: `CNT-${ids.reportId}-${ids.contentVersion}`,
      revisionNumber: 1,
      factPackageId: ids.evidencePackId,
      dataVersion: ids.dataVersion,
      contentFacts: reportEvidence.facts.map((fact, index) => ({
        contentFactId: `GCF-S004-${String(index + 1).padStart(3, "0")}`,
        sourceFactId: fact.id,
        factId: fact.id,
        intendedFactId: fact.id,
        label: fact.label,
        kind: fact.kind,
        value: fact.value,
        authoritativeValue: fact.value,
        unit: fact.unit || null,
        scope: fact.scope,
        resultVersion: fact.resultVersion,
        evidenceRefs: fact.evidence,
        anchorIds: fact.anchorIds,
        bindingStatus: "bound"
      })),
      authoritativeFacts: reportEvidence.facts,
      bindingGaps: [], narratives: [],
      groupMetrics: reportEvidence.packageValue.groupMetrics,
      units: reportEvidence.packageValue.units,
      trend: reportEvidence.packageValue.trend,
      structures: reportEvidence.packageValue.structures || null,
      institutions: reportEvidence.packageValue.institutions || [],
      facts: reportEvidence.facts,
      createdAt: artifacts?.draftOutput?.completedAt || now
    };
    const t044Bindings = reportEvidence.contentItems.map((item, index) => ({
      id: `T044-S004-${String(index + 1).padStart(3, "0")}`,
      scenarioContext: scenario,
      contentItemId: item.contentItemId,
      anchorId: item.anchorId,
      templateSlot: item.templateSlot,
      contentType: item.contentType,
      factRefs: item.factRefs,
      intendedFactRefs: item.intendedFactRefs,
      evidenceRefs: item.evidenceRefs,
      bindingStatus: item.bindingStatus
    }));
    const bindingsForCheck = (checkId) => {
      const match = (anchorId) => t044Bindings.filter((binding) => binding.anchorId === anchorId || binding.templateSlot === anchorId);
      if (/OPERATIONS/.test(checkId)) return t044Bindings.filter((binding) => binding.templateSlot === "sec-02-operations");
      if (/RISK|AGENT-DECISION/.test(checkId)) return t044Bindings.filter((binding) => binding.templateSlot === "sec-04-risk" || binding.anchorId === "sec-05-credit-conclusion");
      if (/OWNERSHIP/.test(checkId)) return match("sec-01-borrower-evaluation");
      if (/STATEMENTS|METRIC|WORKING-CAPITAL/.test(checkId)) return t044Bindings.filter((binding) => binding.templateSlot === "sec-03-financial");
      if (/FORMAL-PAGE|IDENTITY|BASELINE-CONTEXT/.test(checkId)) return match("report-cover");
      return t044Bindings;
    };
    const verificationPlan = (verificationChecks.length ? verificationChecks : reportEvidence.contentItems.map((item) => ({ checkId: `VERIFY-${item.contentItemId}`, detail: `核验 ${item.location}`, result: "PASS" }))).map((check) => {
      const bindings = bindingsForCheck(check.checkId);
      const factId = bindings.flatMap((binding) => binding.factRefs || [])[0] || null;
      return {
        id: check.checkId,
        factId,
        contentItemId: bindings[0]?.contentItemId || null,
        checkType: check.checkId,
        checkName: check.detail,
        owner: "报告中心",
        applicability: "applicable",
        executionState: "planned",
        t044Ids: bindings.map((binding) => binding.id)
      };
    });
    const verificationUnitResults = verificationPlan.map((unit) => ({
      ...unit,
      executionState: "completed",
      status: "pass",
      reasonCode: "artifact-verification-pass"
    }));
    const completedVerification = {
      scenarioContext: scenario,
      runId: ids.verificationRunId,
      status: verificationArtifact.status === "PASS" ? "completed" : "completed-with-findings",
      scope: "整份报告",
      runScope: "整份报告",
      scopeContext: { scope: "整份报告", sectionId: null, anchorId: null },
      attempt: 2,
      retryOf: `VRF-S004-BASELINE-DEMO-ATTEMPT-1-${context.scenarioRunId}`,
      progress: 100,
      completedAt: verificationArtifact.verifiedAt || now,
      planVersion: definitionVersion,
      anchorCount,
      factCount: factBindingCount,
      evidencePackId: ids.evidencePackId,
      reportEvidenceVersion: reportEvidence.packageValue.schemaVersion,
      currentStatusReadAt: artifacts?.c017?.formedAt || now,
      currentStatusSummary: {
        id: artifacts?.c017?.summaryId || `C017-S004-${context.scenarioRunId}`,
        version: "2.0.0",
        formedAt: artifacts?.c017?.formedAt || now,
        status: artifacts?.c017?.status === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "warning" : "ready",
        label: artifacts?.c017?.status === "CONDITIONALLY_TRUSTED_FOR_DEMO" ? "演示条件可信" : "可消费"
      },
      coverage: { status: "complete", planned: verificationCount, applicable: verificationCount, completed: verificationCount, pending: 0, error: 0, notApplicable: 0, skipped: 0, factTotal: factBindingCount, factCovered: factBindingCount, anchorTotal: anchorCount, anchorCovered: anchorCount },
      results: verificationChecks.map((check) => ({
        id: check.checkId,
        checkId: check.checkId,
        name: check.detail,
        location: check.detail,
        outcome: check.result === "PASS" ? "一致" : "不一致",
        status: check.result === "PASS" ? "pass" : "fail",
        issue: check.result === "PASS" ? "未发现不一致" : check.detail,
        finding: check.detail,
        evidence: `${ids.evidencePackId} / ${check.checkId}`,
        version: `${definitionVersion} / ${ids.dataVersion} / ${evidencePackageVersion}`,
        impact: "按权威核验制品记录",
        responsibility: "报告中心",
        recovery: check.result === "PASS" ? "无需处理" : "按核验制品处理后重新运行",
        recommendation: check.result === "PASS" ? "无需处理" : "修复后重新运行",
        owner: "报告中心"
      })),
      planSnapshot: verificationPlan,
      unitResults: verificationUnitResults
    };
    const contentRecord = {
      scenarioContext: scenario,
      reviewCopyId,
      draftId,
      draftVersion: "1.0",
      contentVersion: ids.contentVersion,
      sourceDraftId: artifacts?.draftOutput?.reportId || ids.reportId,
      evidencePackId: ids.evidencePackId,
      generationRunId: ids.agentRunId,
      status: "已发布",
      snapshot: contentSnapshot,
      t044Bindings,
      factInventory: reportEvidence.facts,
      verificationPlan,
      renderManifest: reportEvidence.packageValue.renderManifest,
      verificationRunIds: [ids.verificationRunId],
      createdAt: artifacts?.draftOutput?.completedAt || now
    };
    const definition = {
      id: ids.definitionId, name: "贷前调查报告（财务公司）",
      purpose: "对集团成员借款人流动资金贷款申请形成正式贷前调查报告。",
      audience: "财务公司授信审批与调查岗", version: definitionVersion,
      template: `${reportEvidence.template.id} · 贷前调查权威示例结构`,
      templateId: reportEvidence.template.id,
      templateVersion: reportEvidence.template.version,
      sections: reportDefinitionArtifact.sections || reportEvidence.definition.sections || [],
      stableAnchors: reportEvidence.anchors.map((anchor) => anchor.stableAnchor),
      formalOutputs: reportDefinitionArtifact.formalOutputs || ["CONTROLLED_HTML", "SAME_SOURCE_PDF"],
      formalPageSystem: reportDefinitionArtifact.formalPageSystem || "A4_PORTRAIT",
      docxOutput: reportDefinitionArtifact.docxOutput || "NOT_IN_PHASE_ONE",
      evidence: `固定证据包 ${ids.evidencePackId} · Published ${ids.semanticVersion} · ${ids.dataVersion}`,
      agent: `S004 贷前调查报告 Agent ${ids.agentRelease}（固定证据绑定）`,
      validation: "确定性核验 VERIFY 后人工复核",
      review: "风险与授信章节形成基于已固化资料与系统事实的 AI 建议；调查意见、风险判断、授信结论和发布授权均须人工确认",
      publish: "同源 HTML/PDF，发布后不原地更新",
      status: "已启用"
    };
    const report = {
      scenarioContext: scenario, aggregateId: "RAG-S004-20260815-001", stage: "published",
      sourceArtifactScenarioContext: artifactProjection.sourceScenarioContext,
      runtimeProjectionContext: artifactProjection.targetRuntimeScenarioContext,
      artifactProjectionId: artifactProjection.projectionId,
      reportId: ids.reportId,
      definitionId: ids.definitionId, generationMode: "agent-draft-then-human",
      progress: 100, requestId: "RGEN-S004-20260815-001", evidencePackId: ids.evidencePackId,
      generationRunId: ids.agentRunId, generationResultId: ids.agentResultId,
      agentGenerationRefs: [{ runId: ids.agentRunId, resultId: ids.agentResultId, agentId: "report-draft", sourceAgentDefinitionId: ids.agentId, release: ids.agentRelease, requestId: C022_REQUEST_ID, sourceDraftId: "SRC-DRAFT-S004-20260815-0001", evidencePackId: ids.evidencePackId, scenarioContext: scenario }],
      contentVersions: [contentRecord],
      contentSnapshot,
      revisionNumber: 1,
      draftId, reviewCopyId,
      draftVersion: "1.0", contentVersion: ids.contentVersion,
      generatedAt: artifacts?.draftOutput?.completedAt || now, returnedAt: artifacts?.draftOutput?.completedAt || now,
      confirmedAt: humanConfirmation.creditConclusion?.confirmedAt || humanConfirmation.publicationAuthorization?.authorizedAt || now,
      publishedAt,
      reportNo: ids.reportNo, publicationId: ids.publicationId,
      frozenHtml,
      humanReview: {
        status: humanConfirmation.confirmationId ? "confirmed" : "pending",
        contentVersion: ids.contentVersion,
        reviewer: humanConfirmation.creditConclusion?.confirmedByRole || humanConfirmation.investigationOpinion?.confirmedByRole || "财务公司复核岗",
        completedAt: humanConfirmation.creditConclusion?.confirmedAt || humanConfirmation.publicationAuthorization?.authorizedAt || now,
        note: humanConfirmation.creditConclusion?.comprehensiveJudgement || "风险与授信章节已由 Agent 形成 AI 建议，并在发布前完成人工确认；演示确认未填写额度和利率。",
        confirmationId: ids.humanConfirmationId,
        sourceTag: humanConfirmation.sourceTag || "human-confirmed"
      },
      humanConfirmation,
      bindingSnapshot: {
        bindingId: ids.t019RecordId, semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
        dataAssetId: ids.dataAssetId, dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion,
        consumableVersionId: ids.consumableVersionId, asOf: AS_OF,
        quality: "合格", freshness: "截至时间已确认", consumption: "可消费",
        semanticResolution: "resolved", fixedAt: now
      },
      evidencePacks: [{
        scenarioContext: scenario, id: ids.evidencePackId, version: evidencePackageVersion,
        reportDefinition: { id: ids.definitionId, version: definitionVersion },
        template: {
          id: reportEvidence.template.id,
          version: reportEvidence.template.version,
          slots: reportEvidence.template.slots,
          downloads: { ...(reportEvidence.template.downloads || {}) },
          confirmationLabel: reportEvidence.template.confirmationLabel,
          aiSuggestionLabel: reportEvidence.template.aiSuggestionLabel
        },
        semanticBinding: { ...reportEvidence.packageValue.authoritativeBinding, t019: { recordId: ids.t019RecordId, evidenceId: ids.t019EvidenceId } },
        dataTrustAtGeneration: { qualityStatus: artifacts?.quality?.status || "通过", hardQualityFailure: false, formedAt: artifacts?.quality?.checkedAt || now },
        permission: { id: "PERM-S004-REPORT", version: "1.0", status: "allowed", scope: "报告绑定证据范围" },
        semanticResourceIds: [ids.semanticVersionId],
        agentReference: { agentId: ids.agentId, release: ids.agentRelease, skill: artifacts?.agentConfig?.skillVersion || "skill-report-organization" },
        reportEvidenceSchemaVersion: "2.0.0", factInventoryVersion: "2.0.0",
        authoritativeFactPackageRef: {
          packageId: ids.evidencePackId, packageVersion: evidencePackageVersion,
          schemaVersion: reportEvidence.packageValue.schemaVersion,
          factInventoryVersion: reportEvidence.packageValue.factInventoryVersion,
          factPackageStatus: reportEvidence.packageValue.factPackageStatus,
          semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
          dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion,
          consumableVersionId: ids.consumableVersionId, asOf: AS_OF
        },
        authoritativeFactPackage: reportEvidence.packageValue,
        artifactEvidencePackage: artifacts?.evidencePackage || null,
        decisionRunSummary: { contractCode: "C019", owner: "决策中心", consumer: "报告中心", readAt: now, records: [] },
        fixedAt: now, generationGateReads: []
      }],
      verificationRuns: [JSON.parse(JSON.stringify(completedVerification))],
      reviewHistory: [
        { scenarioContext: scenario, id: ids.verificationRunId, type: "deterministic-verification", contentVersion: ids.contentVersion, at: verificationArtifact.verifiedAt || now, status: verificationArtifact.status || "PASS" },
        { scenarioContext: scenario, id: ids.humanConfirmationId, type: "human-confirmation", contentVersion: ids.contentVersion, at: humanConfirmation.creditConclusion?.confirmedAt || now, status: humanConfirmation.confirmationId ? "confirmed" : "pending" },
        { scenarioContext: scenario, id: ids.publicationId, type: "publication", contentVersion: ids.contentVersion, at: publishedAt, status: ids.publicationStatus }
      ],
      publicationRuns: [{
        scenarioContext: scenario, id: `PRUN-${ids.publicationId}`, retryOf: null,
        publicationId: ids.publicationId, contentVersion: ids.contentVersion,
        evidencePackId: ids.evidencePackId, evidencePackVersion: evidencePackageVersion,
        status: ids.publicationStatus === "PUBLISHED" ? "成功" : ids.publicationStatus,
        startedAt: publishedAt, completedAt: publishedAt, failure: null,
        formalOutputs: publicationManifest.formalOutputs || []
      }],
      publicationVerificationRef: {
        runId: ids.verificationRunId, contentVersion: ids.contentVersion,
        evidencePackId: ids.evidencePackId, completedAt: verificationArtifact.verifiedAt || now,
        coverage: { status: "complete", planned: verificationCount, applicable: verificationCount, completed: verificationCount, pending: 0, error: 0, notApplicable: 0, skipped: 0 }
      },
      artifactManifest: {
        scenarioContext: scenario, reportId: ids.reportId, reportNo: ids.reportNo, contentVersion: ids.contentVersion,
        publicationId: ids.publicationId, sourceDraftVersion: "1.0",
        evidencePackId: ids.evidencePackId, evidencePackVersion: evidencePackageVersion,
        semanticVersionId: ids.semanticVersionId, semanticVersion: ids.semanticVersion,
        dataAssetVersionId: ids.dataAssetVersion, dataVersion: ids.dataVersion,
        consumableVersionId: ids.consumableVersionId, asOf: AS_OF,
        stableAnchors: reportEvidence.anchors.map((anchor) => anchor.stableAnchor),
        publishedTopLevelAnchors: publicationManifest.stableAnchors || reportData.stableAnchors || [],
        html: { status: "已形成", frozenAt: publishedAt, reportNo: ids.reportNo, contentVersion: ids.contentVersion, output: (publicationManifest.formalOutputs || []).find((item) => item.format === "CONTROLLED_HTML") || null },
        pdf: { status: "已形成", frozenAt: publishedAt, reportNo: ids.reportNo, contentVersion: ids.contentVersion, output: (publicationManifest.formalOutputs || []).find((item) => item.format === "SAME_SOURCE_PDF") || null },
        sourceManifest: publicationManifest
      },
      issues: [], trustWarnings: [], generationBlock: null,
      postPublicationVerification: JSON.parse(JSON.stringify(completedVerification))
    };
    const publishedReport = JSON.parse(JSON.stringify(report));
    return {
      stateVersion: 4, savedAtMs: Date.now(),
      artifactProjection,
      customDefinitions: [definition],
      report, publishedReports: [publishedReport], withdrawnReports: [], exportTasks: [],
      actionRequests: [], replacementRelations: [],
      assistant: {
        tab: "qa",
        selectedAnchor: "sec-03-financial",
        selectedSection: "sec-03-financial",
        qaDraft: "",
        requestRef: {
          requestId: C024_REQUEST_ID,
          runId: COPILOT_RUN_ID,
          resultId: `${ids.agentResultId}-COPILOT`,
          sessionId: COPILOT_SESSION_ID,
          selectedAnchor: "sec-03-financial",
          submittedAt: now
        }
      },
      ui: { viewingReportNo: ids.reportNo },
      schemaNote: "S004 runtime native seed"
    };
  }

  root.OFW_S004_SeedData = Object.freeze({
    keys: Object.freeze({
      M01_STATE_KEY, M02_FLOW_KEY, M03_STATE_KEY, M03_WORKSPACE_KEY, M03_C017_KEY,
      M04_STATE_KEY, M04_INBOX_KEY, M04_C017_KEY, M04_C019_KEY, M05_STATE_KEY, M06_STATE_KEY,
      C022_INBOX_KEY, C024_INBOX_KEY, REPORT_OWNER_RECORD_KEY,
      C033_PLATFORM_KEY, SCENARIO_RUNTIME_KEY, C008_PROJECTION_KEY, C017_REPORT_KEY
    }),
    identities: Object.freeze({
      SEMANTIC_VERSION_ID, SEMANTIC_VERSION, DATA_VERSION, AS_OF,
      T019_RECORD_ID, T019_EVIDENCE_ID, REPORT_NO, CONTENT_VERSION,
      EVIDENCE_PACK_ID, DEFINITION_ID, M02_T006, M02_ASSET_VERSION,
      M02_SNAPSHOT_ID, M02_SOURCE_SHA256, M02_SOURCE_SIZE_BYTES, T018_EVIDENCE_ID
    }),
    ctx5, namedContext,
    buildM02DeliveryEvidence,
    buildM01State, buildM02Flow, buildM03State, buildM04State, buildM04Inbox,
    buildM05State, buildM06State, buildReportFactPackage, buildC022Request, buildC024Request,
    buildC008Envelope, buildC017ReportProjection, buildC017QueryProjection, buildC017DecisionProjection, buildC019DecisionProjection
  });
})(typeof window !== "undefined" ? window : globalThis);
