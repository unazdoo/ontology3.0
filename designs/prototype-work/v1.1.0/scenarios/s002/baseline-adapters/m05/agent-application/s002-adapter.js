(function () {
  "use strict";

  // The copied v1.0.3 Agent application remains the runtime page. S002 only
  // supplies budget resources and projects run state owned by the current
  // scenarioRunId; a missing Owner State must never become a successful run.
  const params = new URLSearchParams(window.location.search);
  const context = {
    scenarioId: params.get("scenarioId") || "S002",
    scenarioVersion: params.get("scenarioVersion") || "S002-v1",
    scenarioRunId: params.get("scenarioRunId") || "S002-RUN-20260815160000000-9f72297443c6",
    formedAt: params.get("formedAt") || "2026-08-15T08:00:00.000Z",
    status: params.get("status") || "active",
    source: "预算监督管理运行"
  };
  const STORAGE_KEY = window.AGENT_WORKSPACE_CONFIG?.storageKey || "ontology3.s002.agent-application.catalog.v1";
  const PLATFORM_CONTEXT_KEY = "ontology3.s002.platform.scenario-runtime.v1";
  const DATA_VERSION = "S002-DATA-v1";
  const DATA_ASSET_ID = "S002-DATA-BUNDLE";
  const DATA_ASSET_VERSIONS = Object.freeze(["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  const SEMANTIC_VERSION_ID = "SEM-S002-BUDGET-v1";
  const ONTOLOGY_VERSION = "S002-ONTO-v1";
  const EVIDENCE_PACKAGE_VERSION = "1.0";
  const FORMED_AT = "2026-08-15 10:00:00";
  const TOOL_PRESENTATION = Object.freeze({
    "tool-evidence-reader": Object.freeze({ name: "固定证据读取器", owner: "M02 数据工程" }),
    "tool-ontology-reader": Object.freeze({ name: "Published 本体读取器", owner: "M01 本体管理" }),
    "tool-budget-report-draft": Object.freeze({ name: "预算报告草稿移交器", owner: "M05 Agent 应用" })
  });

  const budgetPrompts = [
    {
      id: "prompt-budget-anomaly",
      name: "预算异常分析边界",
      owner: "Agent 应用",
      versions: [{
        version: "1.0",
        status: "published",
        validatedAt: "2026-08-15 09:20",
        change: "S002 预算异常与关注事项解释",
        variables: ["问题", "C018固定视图", "Published语义", "Rule命中", "数据标识"],
        contextBoundary: "只消费 S002 C018 固定结构化结果和 Published 语义，不读取包外原始数据。",
        outputContracts: ["AI Insight v1"],
        sections: [
          { title: "任务", body: "解释预算执行、项目余额、采购占用和供应商价格异常。" },
          { title: "证据边界", body: "引用 S002-DATA-v1、S002-ONTO-v1、S002-RULE-v1 和 C018-S002-v1。" },
          { title: "输出要求", body: "返回异常、原因、证据、适用范围、限制和建议核查方向，不生成行动申请。" },
          { title: "禁止事项", body: "不得触发决策中心、自动审批、过账、覆盖最终批准预算或调用外部预算系统。" }
        ]
      }]
    },
    {
      id: "prompt-budget-report",
      name: "预算报告草稿边界",
      owner: "Agent 应用",
      versions: [{
        version: "1.0",
        status: "published",
        validatedAt: "2026-08-15 09:25",
        change: "S002 五主题报告草稿与驾驶舱证据组织",
        variables: ["报告定义", "五主题模板槽位", "C018固定视图", "Published语义", "证据版本"],
        contextBoundary: "只按报告中心固定的 S002 证据和模板形成源草稿；不发布正式报告。",
        outputContracts: ["Agent Report Draft v1"],
        sections: [
          { title: "任务", body: "组织预算执行、初始申报、项目余额与采购占用、异常与关注、跨年趋势和单位对比。" },
          { title: "证据边界", body: "每个事实项回指 C018-S002-v1、T019-S002-v1 或固定数据证据。" },
          { title: "输出要求", body: "返回不可变源草稿标识、事实项、下钻锚点和限制。" },
          { title: "禁止事项", body: "不得冒充 T049 正式报告、自动发布驾驶舱或改写预算数据。" }
        ]
      }]
    }
  ];

  const budgetSkills = [
    { id: "skill-budget-anomaly", name: "预算异常解释", versions: [{ version: "1.0", status: "published", purpose: "解释 S002 预算 Rule 命中和异常证据。", prerequisites: "C018-S002-v1；S002 Published 语义；精确数据版本。", inputContract: "预算指标、Rule 命中和项目/单位范围", outputContract: "AI Insight v1", evidenceRule: "每个结论绑定固定证据项。", toolIds: ["tool-evidence-reader", "tool-ontology-reader"], compatibleTypes: ["洞察 Agent"], dependencies: "M02 C018 与 M01 T019", failureLimits: "证据缺失或版本不一致时阻断。", validatedAt: "2026-08-15 09:20", change: "S002 初始可用版本" }] },
    { id: "skill-budget-report", name: "预算报告组织", versions: [{ version: "1.0", status: "published", purpose: "按五主题报告定义组织预算管理源草稿。", prerequisites: "C018-S002-v1、T019-S002-v1、报告定义与模板槽位。", inputContract: "预算报告生成请求", outputContract: "Agent Report Draft v1", evidenceRule: "事实项绑定 C018/T019/数据证据引用。", toolIds: ["tool-evidence-reader", "tool-ontology-reader", "tool-budget-report-draft"], compatibleTypes: ["报告草稿 Agent"], dependencies: "M06 报告中心", failureLimits: "身份或证据不完整时拒绝移交。", validatedAt: "2026-08-15 09:25", change: "S002 初始可用版本" }] }
  ];

  const budgetTools = [
    { id: "tool-budget-report-draft", name: "预算报告草稿移交器", version: "1.0", category: "结果移交工具", provider: "M05 Agent 应用", owner: "Agent 应用", purpose: "将预算报告源草稿移交报告中心评审副本。", allowed: "移交草稿标识、事实项和证据引用。", forbidden: "发布正式报告或驾驶舱。", input: "C022-S002 报告生成请求", output: "Agent Report Draft v1", scope: "S002 当前运行", prerequisites: "C018/T019 固定", recovery: "身份变化时创建新运行。", timeoutRule: "未取得移交回执时保持未知。", failureRule: "缺失事实项时阻断。", availability: "available" }
  ];

  const scenarioBinding = { id: "AG-SB-S002-BUDGET", version: "1.0", mode: "scenario-run", scenarioId: "S002", scenarioLabel: "预算监督管理", objectScope: "部门、项目、科目、预算版本、实际、采购占用", status: "ready" };
  const reportScenarioBinding = { id: "AG-SB-S002-REPORT", version: "1.0", mode: "request-context", scenarioId: "S002", scenarioLabel: "预算驾驶舱和报告草稿", objectScope: "五主题预算管理报告", status: "ready" };

  const agents = [
    {
      id: "budget-anomaly-analyst",
      name: "预算异常分析 Agent",
      shortName: "预算异常分析",
      type: "洞察 Agent",
      purpose: "解释 S002 预算执行、项目余额、采购占用和供应商价格异常，输出可追溯的建议核查方向。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "S002 · 预算监督管理",
      releases: [{ version: "1.0", releasedAt: FORMED_AT, validationAt: "2026-08-15 09:20", inputContract: "Generation Evidence Package v1", outputContract: "AI Insight v1", expectedOutput: "AI Insight v1", prompt: { id: "prompt-budget-anomaly", version: "1.0" }, skills: [{ id: "skill-budget-anomaly", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader"], ontology: ONTOLOGY_VERSION, ontologyScope: "预算主体、预算版本、项目、采购占用、Metric、Rule", scenarioBinding, change: "S002 初始可用版本" }]
    },
    {
      id: "budget-report-drafter",
      name: "预算报告草稿 Agent",
      shortName: "预算报告草稿",
      type: "报告草稿 Agent",
      purpose: "按报告中心五主题定义组织预算管理报告源草稿，保留事实、下钻锚点和演示数据标识。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "S002 · 预算监督管理",
      releases: [{ version: "1.0", releasedAt: FORMED_AT, validationAt: "2026-08-15 09:25", inputContract: "Report Generation Request v1", outputContract: "Agent Report Draft v1", expectedOutput: "Agent Report Draft v1", prompt: { id: "prompt-budget-report", version: "1.0" }, skills: [{ id: "skill-budget-report", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-budget-report-draft"], ontology: ONTOLOGY_VERSION, ontologyScope: "预算执行、初始申报、项目余额与采购占用、异常与关注、跨年趋势和单位对比", scenarioBinding: reportScenarioBinding, change: "S002 初始可用版本" }]
    }
  ];

  const evidence = {
    id: "S002-BUDGET-EVIDENCE-v1",
    version: EVIDENCE_PACKAGE_VERSION,
    name: "S002 预算固定证据包",
    kind: "budget",
    status: "ready",
    statusLabel: "可用于运行",
    dataVersion: DATA_VERSION,
    dataAssetId: DATA_ASSET_ID,
    dataAssetVersionId: DATA_ASSET_ID,
    dataAssetVersions: DATA_ASSET_VERSIONS,
    dataAsOf: "2025-12-31",
    ontologyVersion: ONTOLOGY_VERSION,
    semanticVersionId: SEMANTIC_VERSION_ID,
    quality: "质量检查通过（演示数据）",
    freshness: "演示快照已固定",
    authority: "M02 C018-S002-v1；M01 T019-S002-v1",
    formedAt: FORMED_AT,
    requestContext: { id: "AG-CTX-S002-BUDGET-20260815", version: "1.0", sourceOwner: "S002 场景", scenarioId: "S002", scenarioLabel: "预算监督管理", requestedAt: FORMED_AT, objectScope: "预算和实际监督", expectedOutput: "AI Insight v1 / Agent Report Draft v1" },
    items: [
      { id: "DATA-ASSETS-S002-v1", type: "数据资产版本", name: "预算监督双资产", value: DATA_ASSET_VERSIONS.join(" + "), object: "预算编制执行、项目余额占用", source: "M02" },
      { id: "C018-S002-v1", type: "固定问数视图", name: "预算结构化结果", value: "6个获准问题 + 7条正式Rule命中 + 1条分析建议", object: "部门、项目、预算版本", source: "M03" },
      { id: "T019-S002-v1", type: "Published 语义", name: "预算管理本体", value: ONTOLOGY_VERSION, object: "预算对象、Metric、Rule、Action Type", source: "M01" },
      { id: "S002-SCOPE-20260815", type: "运行范围声明", name: "决策触发边界", value: "当前 S002 全链路版本不生成行动申请、决策事项或平台内待办", object: "预算异常与关注事项", source: "S002 场景" },
      { id: "DATA-MARKER", type: "质量标识", name: "演示加工数据", value: "DERIVED / CORRECTED", object: "日期、期间、跨年补数", source: "M02" }
    ],
    // Read-only C017/T019/C018 consumption snapshot. M05 records the exact
    // evidence used by its run; it does not publish or mutate any upstream
    // contract owned by M01/M02/M03.
    credibility: {
      contract: "C017 Agent 安全投影",
      contextStatus: "normal",
      externalAuthority: { owner: "M02 数据工程 / M01 本体管理", sourceReference: "C017-S002-BINDING-v1 / T019-S002-v1" },
      lastReadAt: FORMED_AT,
      versionBindingSummary: {
        id: "C017-S002-BINDING-v1",
        version: "1.0",
        status: "ready",
        label: "精确组合已绑定",
        formedAt: FORMED_AT,
        observedAt: FORMED_AT,
        t006: "S002 预算编制执行资产 + 项目余额占用资产",
        t007: DATA_VERSION,
        componentAssetVersions: DATA_ASSET_VERSIONS,
        t008: "2025-12-31",
        t008Source: "M02 场景快照",
        ontology: ONTOLOGY_VERSION,
        binding: "T019-S002-v1 / C018-S002-v1",
        reason: "预算证据包只读固定数据版本、业务时点、Published 语义与问数结果。"
      },
      currentStateSummary: {
        id: "C017-S002-CURRENT-v1",
        version: "1.0",
        status: "ready",
        label: "当前固定组合可消费",
        sourceOwner: "M02 数据工程",
        sourceReference: "C017-S002-BINDING-v1",
        observedAt: FORMED_AT,
        quality: "质量检查通过（演示数据）",
        freshness: "场景快照固定",
        factAge: "截至 2025-12-31",
        freshnessThreshold: "固定演示快照",
        freshnessThresholdOwner: "平台公共层",
        applicableScope: "S002 当前 scenarioRunId 的固定证据包",
        dataQualification: "允许本轮 Agent 只读消费",
        refresh: "无待切换刷新",
        activeDataVersion: DATA_VERSION,
        activeDataAssetVersions: DATA_ASSET_VERSIONS,
        activeDataAsOf: "2025-12-31",
        useConclusion: "可用于本轮两个预算 Agent 的只读分析与草稿生成；不得据此自动审批、过账或调用外部预算系统。",
        recovery: "数据、语义或场景轮次变化时创建新证据包和新 Agent Run。"
      },
      refresh: { status: "complete", label: "固定快照已读取", observedAt: FORMED_AT, resultState: "同轮次数据、语义与问数结果已固定", recovery: "状态变化时创建新运行，不改写旧运行。" },
      postQuality: { status: "complete", label: "演示质量可消费", checkedAt: FORMED_AT, scope: DATA_VERSION, reason: "21组合法重复凭证保留；13条期间异常和6条日期倒置保留 CORRECTED 标识。", recovery: "如演示口径变化，以新 S002 运行形成新证据包。" },
      ontologyAdoption: { status: "ready", label: "Published 已采用", observedAt: FORMED_AT, source: "M01 T019-S002-v1 只读引用", recovery: "由 M01 发布新版本并形成新 T019 后创建新运行。" },
      consumptionReadiness: { status: "ready", label: "允许本轮只读消费", observedAt: FORMED_AT, allowedUse: "预算异常分析与预算报告源草稿", reason: "C017、T019、C018 与 scenarioRunId 一致。", recovery: "任一身份变化时阻断旧组合并创建新运行。" },
      stableEvidence: { status: "available", label: "稳定引用可定位", checkedAt: FORMED_AT, refs: ["S002-BUDGET-EVIDENCE-v1", "C017-S002-BINDING-v1", "C018-S002-v1", "T019-S002-v1"], recovery: "缺少稳定引用时保持阻断，不补造证据。" },
      identities: {
        current: { role: "当前权威", status: "ready", label: "当前固定组合", t006: "S002 预算编制执行资产 + 项目余额占用资产", t007: DATA_VERSION, componentAssetVersions: DATA_ASSET_VERSIONS, t008: "2025-12-31", reason: "本次运行固定且可追溯。" },
        candidate: { role: "较新候选", status: "unknown", label: "本轮无候选", reason: "未把未来数据或其他场景轮次混入本次运行。" },
        previousQualified: { role: "上一具备采用资格", status: "unknown", label: "本轮不改选", reason: "旧版本仅供历史查看，不作为当前自动回退来源。" },
        previousAuthoritative: { role: "上一权威服务", status: "unknown", label: "本轮不改选", reason: "历史身份不覆盖当前固定组合。" }
      },
      historyDimensions: [
        { id: "version-location", name: "版本定位", status: "complete", label: "已定位", reason: "S002-DATA-v1、S002-ONTO-v1、C018 与 T019 均有稳定引用。", checkedAt: FORMED_AT, recovery: "身份变化时创建新运行。" },
        { id: "content-access", name: "内容访问", status: "complete", label: "只读可访问", reason: "两个 Agent 仅访问固定证据包内的获准内容。", checkedAt: FORMED_AT, recovery: "访问范围不完整时阻断。" },
        { id: "evidence-completeness", name: "证据完整", status: "complete", label: "5 项证据齐备", reason: "双数据资产、问数结果、Published 语义、运行范围声明和质量标识均已固定。", checkedAt: FORMED_AT, recovery: "缺失稳定引用时重新形成证据包。" },
        { id: "replay-capability", name: "重放能力", status: "ready", label: "隔离克隆可用", reason: "需要回归时由平台快照克隆为新的 scenarioRunId，不覆盖本运行。", checkedAt: FORMED_AT, recovery: "通过平台 Checkpoint 恢复编排创建新运行。" },
        { id: "replay-verification", name: "重放核验", status: "not-run", label: "本页未重放", reason: "查看固定证据不等于重新执行 Agent；回归证据由平台 CP-E2E 独立保存。", checkedAt: FORMED_AT, recovery: "需要重放时进入隔离回归并创建新 scenarioRunId。" }
      ],
      useFlags: { isCurrentAuthoritative: true, canStartNewRun: true, canConfirmNewResult: true, canPrepareActionRequest: false, historyDisclosureRequired: true },
      agentGates: [
        { id: "new-run", name: "发起新预算运行", status: "allowed", label: "允许", reason: "S002 固定证据、版本和边界完整。", recovery: "版本变化时创建新运行。" },
        { id: "confirm-result", name: "确认预算异常分析结果", status: "allowed", label: "允许人工确认", reason: "异常分析运行已完成，输出合同、固定证据和当前 C017 摘要一致；可由人工确认其仅作业务复核参考。", recovery: "确认不改变 Metric、Rule、预算数据或决策状态；上下文变化时保留旧结果并创建新运行。" },
        { id: "action-request", name: "准备行动申请", status: "blocked", label: "当前范围不启用", reason: "本场景暂不设置触发决策中心的运行示例。", recovery: "如后续单独授权，再以新的 scenarioRunId 和范围声明启用。" },
        { id: "report-draft-transfer", name: "移交预算报告草稿", status: "allowed", label: "允许", reason: "五主题报告事实项与锚点齐备。", recovery: "正式发布仍由 M06 生命周期负责。" }
      ]
    },
    report: null
  };

  function promptBindingFor(agent) {
    const release = agent.releases[0];
    const resource = budgetPrompts.find((item) => item.id === release.prompt.id);
    return { id: release.prompt.id, name: resource?.name || release.prompt.id, version: release.prompt.version };
  }

  function skillBindingsFor(agent) {
    return agent.releases[0].skills.map((binding) => {
      const resource = budgetSkills.find((item) => item.id === binding.id);
      return { id: binding.id, name: resource?.name || binding.id, version: binding.version };
    });
  }

  function toolBindingsFor(agent) {
    const resources = [...(window.AGENT_TOOLS || []), ...budgetTools];
    return agent.releases[0].tools.map((id) => {
      const resource = resources.find((item) => item.id === id);
      return { id, name: TOOL_PRESENTATION[id]?.name || resource?.name || id, version: resource?.version || "1.0", owner: TOOL_PRESENTATION[id]?.owner || resource?.owner || "M05 Agent 应用" };
    });
  }

  const baseRun = (agent, runId, type, question, result) => ({
    id: runId,
    question,
    attempt: 1,
    source: "预算监督管理",
    status: "pending",
    createdAt: null,
    startedAt: null,
    finishedAt: null,
    completedAt: null,
    snapshot: {
      agentId: agent.id,
      agentName: agent.name,
      agentRelease: "1.0",
      evidenceId: evidence.id,
      evidencePackageId: evidence.id,
      evidencePackageVersion: evidence.version,
      evidenceName: evidence.name,
      evidenceStatus: "ready",
      dataVersion: DATA_VERSION,
      dataAssetId: DATA_ASSET_ID,
      dataAssetVersionId: DATA_ASSET_ID,
      dataAssetVersions: DATA_ASSET_VERSIONS,
      dataAsOf: "2025-12-31",
      ontologyVersion: ONTOLOGY_VERSION,
      semanticVersionId: SEMANTIC_VERSION_ID,
      ontology: ONTOLOGY_VERSION,
      quality: evidence.quality,
      freshness: evidence.freshness,
      scenarioId: "S002",
      scenario: "预算监督管理",
      scenarioVersion: "S002-v1",
      scenarioRunId: context.scenarioRunId,
      scenarioBinding: agent.id === "budget-report-drafter" ? reportScenarioBinding : scenarioBinding,
      requestContext: evidence.requestContext,
      inputContract: agent.releases[0].inputContract,
      outputContract: agent.releases[0].outputContract,
      expectedOutput: agent.releases[0].outputContract,
      objectScope: agent.purpose,
      evidenceItems: evidence.items,
      evidenceItemCount: evidence.items.length,
      prompt: { ...agent.releases[0].prompt },
      promptBinding: promptBindingFor(agent),
      skills: agent.releases[0].skills.map((binding) => ({ ...binding })),
      skillBindings: skillBindingsFor(agent),
      tools: agent.releases[0].tools,
      toolIds: agent.releases[0].tools,
      toolBindings: toolBindingsFor(agent),
      evidenceIdRef: evidence.id
    },
    steps: [
      { id: "evidence", name: "读取固定预算证据", status: "pending", detail: `${DATA_ASSET_VERSIONS.join(" + ")}（${DATA_VERSION} 组合指针） / ${ONTOLOGY_VERSION}` },
      { id: "analysis", name: type === "Agent Report Draft" ? "组织五主题报告草稿" : "解释 Rule 命中和关注事项", status: "pending", detail: "不改写确定性指标或预算数据" },
      { id: "handoff", name: "返回结构化结果", status: "pending", detail: type === "Agent Report Draft" ? "草稿待报告中心评审" : "仅返回分析结果，不触发决策中心" }
    ],
    toolCalls: agent.releases[0].tools.map((toolId, index) => ({
      id: `${runId}-TOOL-${index + 1}`,
      toolId,
      toolName: TOOL_PRESENTATION[toolId]?.name || toolId,
      toolVersion: "1.0",
      toolOwner: TOOL_PRESENTATION[toolId]?.owner || "M05 Agent 应用",
      input: index === 0 ? "S002 固定证据包与双数据资产版本" : "上一步获准结构化输出",
      output: null,
      status: "pending",
      duration: null
    })),
    result
  });

  const runDefinitions = [
    baseRun(agents[0], "AG-RUN-S002-ANOMALY-20260815", "AI Insight", "解释 S002 当前预算异常与关注事项", { id: "AG-RESULT-S002-ANOMALY-20260815", type: "AI Insight", title: "预算异常分析结果", summary: "聚合 7 条正式 Rule 命中和 1 条分析关注，按预算执行、申报合理性、项目余额、采购集中度、计提与供应商价格分类解释。", outputValidation: "结构化结果通过", confirmation: "pending", destination: "预算监督分析结果", citations: ["C018-S002-v1", "S002-RULE-v1", "T019-S002-v1"], sections: [{ title: "异常概览", body: "项目可用立项余额、执行率、年末占用、供应商价格和初始申报异常均可下钻。", refs: ["C018-S002-v1"] }, { title: "运行边界", body: "只返回证据解释和建议核查方向；当前范围不生成行动申请、决策事项或待办。", refs: ["S002-SCOPE-20260815"] }] }),
    baseRun(agents[1], "AG-RUN-S002-REPORT-20260815", "Agent Report Draft", "生成 S002 预算监督管理五主题报告草稿", { id: "AG-RESULT-S002-REPORT-20260815", type: "Agent Report Draft", title: "预算监督管理报告源草稿", summary: "形成预算执行、初始申报、项目余额与采购占用、异常与关注、跨年趋势及单位对比五主题草稿，保留 DERIVED/CORRECTED 标识。", outputValidation: "草稿合同通过", confirmation: "not-applicable", destination: "报告中心评审副本（未发布）", citations: ["C018-S002-v1", "T019-S002-v1", "S002-SCOPE-20260815"], sections: [{ title: "预算执行", body: "按最终批准预算和实际数展示执行率、差异额及期间下钻。", refs: ["C018-S002-v1"] }, { title: "异常与关注", body: "按 Rule 命中或分析关注展示指标、依据、建议核查方向和下钻证据。", refs: ["C018-S002-v1"] }, { title: "驾驶舱发布边界", body: "报告草稿和驾驶舱发布状态分离，不冒充正式 T049 报告。", refs: ["T019-S002-v1"] }] })
  ];

  const orchestrationDefinition = {
    id: "ORCH-S002-BUDGET-20260815",
    name: "预算异常 → 报告草稿协作编排",
    purpose: "先读取固定预算证据，再并行形成异常分析和报告草稿结果。",
    template: "parallel",
    status: "enabled",
    release: "1.0",
    createdAt: FORMED_AT,
    updatedAt: FORMED_AT,
    inputEvidenceId: evidence.id,
    nodes: [
      { id: "start", type: "start", name: "固定预算证据", x: 80, y: 160, status: "pending", outputContract: "Generation Evidence Package v1" },
      { id: "anomaly", type: "agent", name: agents[0].name, x: 340, y: 100, agentId: agents[0].id, release: "1.0", status: "pending", inputContract: "Generation Evidence Package v1", outputContract: "AI Insight v1" },
      { id: "report", type: "agent", name: agents[1].name, x: 340, y: 240, agentId: agents[1].id, release: "1.0", status: "pending", inputContract: "Generation Evidence Package v1", outputContract: "Agent Report Draft v1" },
      { id: "result", type: "result", name: "S002 受控结果", x: 660, y: 160, status: "pending", inputContract: "Parallel Member Result", outputContract: "Approved Summary Contract" }
    ],
    connections: [{ id: "c1", source: "start", target: "anomaly" }, { id: "c2", source: "start", target: "report" }, { id: "c3", source: "anomaly", target: "result" }, { id: "c4", source: "report", target: "result" }],
    validation: { status: "validated", errors: [], checkedAt: FORMED_AT },
    trace: null,
    releases: [{ version: "1.0", status: "enabled", releasedAt: FORMED_AT, snapshot: { definitionId: "ORCH-S002-BUDGET-20260815", release: "1.0", inputEvidenceId: evidence.id, nodes: [] } }]
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; } }
  function sameRun(value) { return value?.currentScenarioContext?.scenarioId === context.scenarioId && value?.currentScenarioContext?.scenarioRunId === context.scenarioRunId; }

  function sameScenarioContext(value) {
    const candidate = value?.context || value?.scenarioContext || value?.currentScenarioContext;
    return candidate?.scenarioId === context.scenarioId
      && candidate?.scenarioVersion === context.scenarioVersion
      && candidate?.scenarioRunId === context.scenarioRunId;
  }

  function readParentProjection() {
    try {
      const store = window.parent && window.parent !== window ? window.parent.S002_STORE : null;
      const snapshot = store && typeof store.get === "function" ? store.get() : null;
      if (!snapshot || !sameScenarioContext(snapshot)) return null;
      return {
        progress: clone(snapshot.progress || {}),
        agentRuns: clone(snapshot.agentRuns || []),
        orchestrationRun: clone(snapshot.orchestrationRun || null)
      };
    } catch (_) {
      return null;
    }
  }

  function readOwnedState() {
    // The unified workbench is the authoritative runtime projection for live,
    // historical and cloned runs. Historical Checkpoint viewing intentionally
    // does not hydrate a new M05 localStorage envelope, so consume the exact
    // same-run parent projection first and keep namespaced storage as the
    // direct-entry fallback.
    const parentProjection = readParentProjection();
    if (parentProjection) return parentProjection;
    const key = `ofw:v1.1.0:${encodeURIComponent(context.scenarioId)}:${encodeURIComponent(context.scenarioVersion)}:${encodeURIComponent(context.scenarioRunId)}:m05:owned-state`;
    const envelope = readJson(key);
    const bound = envelope?.scenarioContext;
    const payload = envelope?.payload;
    if (envelope?.schemaVersion !== "ofw.namespaced-storage.v1" || !bound || !payload) return null;
    if (bound.scenarioId !== context.scenarioId || bound.scenarioVersion !== context.scenarioVersion || bound.scenarioRunId !== context.scenarioRunId) return null;
    if (payload.moduleId !== "M05" || payload.moduleVersion !== "S002-M05-1.0.0") return null;
    return payload;
  }

  function completedOwnerProjection(state) {
    const expectedAgentIds = agents.map((agent) => agent.id);
    const ownerRuns = Array.isArray(state?.agentRuns) ? state.agentRuns : [];
    const byAgent = new Map(ownerRuns.map((run) => [run?.agentId, run]));
    const runIds = ownerRuns.map((run) => run?.runId).filter(Boolean);
    const orchestration = state?.orchestrationRun;
    const orchestrationSteps = Array.isArray(orchestration?.steps) ? orchestration.steps : [];
    const ready = state?.progress?.agentsRun === true
      && ownerRuns.length === expectedAgentIds.length
      && expectedAgentIds.every((agentId) => {
        const run = byAgent.get(agentId);
        return run?.status === "complete" && Boolean(run?.runId);
      })
      && orchestration?.status === "complete"
      && Boolean(orchestration?.runId)
      && runIds.every((runId) => orchestrationSteps.includes(runId));
    return { ready, byAgent, orchestration, runIds };
  }

  function projectRun(definition, ownerRun, formedAt) {
    const run = clone(definition);
    const result = clone(definition.result);
    const completedStatus = ownerRun.status;
    run.id = ownerRun.runId;
    run.source = "预算监督管理全链路";
    run.status = completedStatus;
    run.createdAt = formedAt;
    run.startedAt = formedAt;
    run.finishedAt = formedAt;
    run.completedAt = formedAt;
    run.snapshot.agentId = ownerRun.agentId;
    run.snapshot.agentName = ownerRun.name || run.snapshot.agentName;
    run.snapshot.scenarioRunId = context.scenarioRunId;
    run.snapshot.credibility = clone(evidence.credibility);
    run.steps = run.steps.map((step) => ({ ...step, status: completedStatus }));
    run.toolCalls = run.toolCalls.map((call) => ({ ...call, id: `${ownerRun.runId}-${call.toolId}`, status: completedStatus, output: "固定证据读取完成", duration: "120ms" }));
    run.result = {
      ...result,
      id: `${ownerRun.runId}-RESULT`,
      contract: result.contract || run.snapshot.outputContract,
      summary: ownerRun.summary || result.summary,
      owner: "M05 Agent 应用",
      generatedAt: formedAt,
      freshness: "固定至 2025-12-31 场景快照",
      limitations: result.limitations || "仅基于 S002 当前 scenarioRunId 的固定证据生成；不得自动审批、过账、反写外部预算系统或发布正式报告。",
      confidence: result.confidence || "数据资产、Published 本体、问数结果及决策摘要版本均已固定，可追溯至同轮次证据。",
      citations: Array.from(new Set([...(result.citations || []), ...((ownerRun.evidence || []).filter(Boolean))]))
    };
    return run;
  }

  function projectCompletedState(state, completion) {
    if (!completion.ready) return { evidencePackages: [], runs: [], orchestrations: [] };
    const formedAt = completion.orchestration.formedAt || context.formedAt || FORMED_AT;
    const runs = runDefinitions.map((definition) => projectRun(definition, completion.byAgent.get(definition.snapshot.agentId), formedAt));
    const orchestration = clone(orchestrationDefinition);
    orchestration.id = completion.orchestration.definitionVersion || orchestration.id;
    orchestration.createdAt = formedAt;
    orchestration.updatedAt = formedAt;
    orchestration.nodes = orchestration.nodes.map((node) => ({ ...node, status: completion.orchestration.status }));
    orchestration.validation = { status: "validated", errors: [], checkedAt: formedAt };
    orchestration.trace = {
      id: completion.orchestration.runId,
      runId: completion.orchestration.runId,
      status: completion.orchestration.status,
      startedAt: formedAt,
      finishedAt: formedAt,
      steps: runs.map((run) => ({ id: run.id, status: run.status, detail: run.result.title }))
    };
    orchestration.releases = orchestration.releases.map((release) => ({
      ...release,
      releasedAt: formedAt,
      snapshot: { ...release.snapshot, definitionId: orchestration.id, nodes: clone(orchestration.nodes) }
    }));
    return {
      evidencePackages: [{ ...clone(evidence), formedAt, requestContext: { ...clone(evidence.requestContext), requestedAt: formedAt } }],
      runs,
      orchestrations: [orchestration]
    };
  }

  function sameIds(items, expectedIds) {
    const actual = (items || []).map((item) => item?.id).filter(Boolean).sort();
    const expected = [...expectedIds].sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  function savedMatchesProjection(saved, marker, projection) {
    if (!sameRun(saved)) return false;
    if (JSON.stringify(saved?.s002OwnerProjection || null) !== JSON.stringify(marker)) return false;
    if (!sameIds(saved?.runs, projection.runs.map((run) => run.id))) return false;
    if (!sameIds(saved?.orchestrations, projection.orchestrations.map((item) => item.id))) return false;
    const savedEvidence = (saved?.evidencePackages || []).find((item) => item?.id === evidence.id);
    const confirmGate = savedEvidence?.credibility?.agentGates?.find((item) => item?.id === "confirm-result");
    if (!confirmGate || !["allowed", "ready", "warning"].includes(confirmGate.status) || savedEvidence?.credibility?.useFlags?.canConfirmNewResult !== true) return false;
    const savedRunsById = new Map((saved?.runs || []).map((run) => [run?.id, run]));
    return projection.runs.every((expected) => {
      const run = savedRunsById.get(expected.id);
      return run?.status === "complete"
        && Array.isArray(run.steps)
        && run.steps.length === expected.steps.length
        && run.steps.every((step) => step.status === "complete")
        && Array.isArray(run.toolCalls)
        && run.toolCalls.length === expected.toolCalls.length
        && run.toolCalls.every((call) => call.status === "complete" && Boolean(call.output))
        && Boolean(run.result?.id)
        && Boolean(run.result?.destination)
        && Array.isArray(run.result?.sections)
        && run.result.sections.length > 0;
    });
  }

  const ownerState = readOwnedState();
  const completion = completedOwnerProjection(ownerState);
  const projection = projectCompletedState(ownerState, completion);
  const projectionMarker = {
    moduleId: "M05",
    moduleVersion: "S002-M05-1.0.0",
    evidenceRevision: "S002-M05-EVIDENCE-v6",
    scenarioRunId: context.scenarioRunId,
    status: completion.ready ? "complete" : "blocked",
    ownerRunIds: completion.ready ? projection.runs.map((run) => run.id) : [],
    orchestrationRunId: completion.ready ? completion.orchestration.runId : null
  };

  function preferCompletedRunHistory() {
    if (!completion.ready || !String(window.location.hash || "").startsWith("#/runs")) return;
    let applied = false;
    const activate = function () {
      if (applied) return;
      const historyTab = Array.from(document.querySelectorAll('[role="tab"]')).find(function (item) {
        return String(item.textContent || "").includes("运行记录");
      });
      if (!historyTab) return;
      applied = true;
      if (historyTab.getAttribute("aria-selected") !== "true") historyTab.click();
      observer.disconnect();
    };
    const observer = new MutationObserver(activate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(activate, 0);
  }

  try {
    // Expose only the two budget Agent definitions and their approved
    // read-only resources in the active catalog projection.
    const sharedToolIds = new Set(["tool-evidence-reader", "tool-ontology-reader"]);
    const sharedTools = (window.AGENT_TOOLS || []).filter((tool) => sharedToolIds.has(tool.id));
    window.AGENT_PROMPTS = budgetPrompts.map(clone);
    window.AGENT_SKILLS = budgetSkills.map(clone);
    window.AGENT_TOOLS = [...sharedTools.map(clone), ...budgetTools.map(clone)];
    const initial = clone(window.AGENT_APP_INITIAL_STATE);
    initial.currentScenarioContext = context;
    // The current S002 run owns this catalog projection while the copied
    // v1.0.3 page structure and interactions remain intact.
    initial.agents = agents.map(clone);
    initial.drafts = [];
    initial.evidencePackages = projection.evidencePackages.map(clone);
    initial.inboundRequests = [];
    initial.c022Rejections = [];
    initial.c024Rejections = [];
    initial.runs = projection.runs.map(clone);
    initial.sessions = [];
    initial.handoffs = [];
    initial.orchestrations = projection.orchestrations.map(clone);
    initial.s002OwnerProjection = projectionMarker;
    initial.sequence = {
      ...(initial.sequence || {}),
      run: projection.runs.length,
      result: projection.runs.length,
      orchestration: projection.orchestrations.length,
      orchestrationRun: projection.orchestrations.length
    };
    // Replace the catalog seed before app.jsx captures its initial state so
    // compact/hydrate always reconstructs the same S002 projection.
    window.AGENT_APP_INITIAL_STATE = initial;
    window.AGENT_NAV_ITEMS = window.AGENT_NAV_ITEMS || [];
    const saved = readJson(STORAGE_KEY);
    if (!savedMatchesProjection(saved, projectionMarker, projection)) localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    const currentContext = readJson(PLATFORM_CONTEXT_KEY);
    if (currentContext?.scenarioRunId !== context.scenarioRunId) localStorage.setItem(PLATFORM_CONTEXT_KEY, JSON.stringify(context));
    preferCompletedRunHistory();
  } catch (_) {}

  window.S002_M05_ADAPTER = Object.freeze({
    context,
    ownerStateReady: completion.ready,
    agents,
    runs: projection.runs,
    orchestration: projection.orchestrations[0] || null,
    evidence: projection.evidencePackages[0] || null
  });
})();
