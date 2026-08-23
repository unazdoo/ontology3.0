(function () {
  "use strict";

  const scriptUrl = typeof document !== "undefined" && document.currentScript?.src
    ? new URL(document.currentScript.src)
    : null;
  const resourceUrl = function (relativePath) {
    if (!scriptUrl) return `../scenarios/s003/${relativePath}`;
    return new URL(relativePath, scriptUrl).pathname;
  };

  const workflow = [
    { id: "s003Source", module: "data", title: "接入债务风险财务来源", action: "查看数据来源", summary: "财务工作簿登记为数据源；企业当期因子取值与模型参数分离保存。", prerequisite: null },
    { id: "s003Snapshot", module: "data", title: "形成受控数据快照", action: "查看快照", summary: "锁定评估时点、币种、金额单位和 I/AA 字段口径。", prerequisite: "s003Source" },
    { id: "s003Input", module: "data", title: "绑定企业因子输入快照", action: "查看输入版本", summary: "本次运行只读绑定既有不可变企业因子输入快照；M01 模型配置不再提供逐户企业因子编辑页。", prerequisite: "s003Snapshot" },
    { id: "s003Pipeline", module: "data", title: "运行数据处理与质量门", action: "查看数据管道", summary: "数据工程只处理来源、标准化、质量和数据资产版本。", prerequisite: "s003Input" },
    { id: "s003DataPublish", module: "data", title: "发布正式候选数据资产", action: "查看数据资产", summary: "正式候选 T007 与兼容性验证版本严格分离。", prerequisite: "s003Pipeline" },
    { id: "s003Modeling", module: "ontology", title: "配置债务风险业务模型", action: "进入本体建模", summary: "维护 Metric、Rule、Action Type、权重、系数和风险阈值。", prerequisite: "s003DataPublish" },
    { id: "s003ModelPublish", module: "ontology", title: "发布风险模型与语义资源", action: "查看 Published", summary: "业务定义由财务公司负责，Published 生命周期由本体管理维护。", prerequisite: "s003Modeling" },
    { id: "s003Evaluate", module: "ontology", title: "形成权威风险评估", action: "查看评估结果", summary: "21 家企业结果绑定同一 Published 模型、输入和 scenarioRunId。", prerequisite: "s003ModelPublish" },
    { id: "s003Query", module: "query", title: "联调债务风险问数", action: "进入智能问数", summary: "智能问数只读消费 Published 风险事实。", prerequisite: "s003Evaluate" },
    { id: "s003Candidates", module: "decision", title: "按亮灯形成预警行动", action: "查看预警队列", summary: "黄灯、红灯、黑灯企业每家形成一条预警入口；重大因子仅补充诊断，不单独制造行动。", prerequisite: "s003Query" },
    { id: "s003Confirm", module: "decision", title: "成员单位接口人核实确认", action: "核实并分办", summary: "驾驶舱提交后直接送达对应成员单位接口人；一期不建设多用户权限、多级审批或 S003 专属处置页。", prerequisite: "s003Candidates" },
    { id: "s003Todo", module: "decision", title: "形成负责人待办", action: "追踪待办", summary: "成员单位接口人确认后，沿用通用决策中心选择负责人并形成待办。", prerequisite: "s003Confirm", automatic: false },
    { id: "s003AgentBoundary", module: "agent", title: "装入报告伴读场景配置", action: "查看 Agent 目录", summary: "复用平台通用报告伴读 Agent；不新增评分或处置 Agent，不绕过 Published。", prerequisite: "s003Evaluate" },
    { id: "s003Report", module: "report", title: "生成企业风险报告", action: "进入报告中心", summary: "每家企业报告与当前运行身份、数据、模型和证据一致。", prerequisite: "s003Todo" },
    { id: "s003Checkpoint", module: "report", title: "完成仪表盘与场景快照", action: "打开仪表盘", summary: "风险总览、配置工作台、快速重跑和 Checkpoint 在统一入口呈现。", prerequisite: "s003Report" }
  ];

  // 只引用已经形成的 S003 资源，不用配置文件伪造模块运行记录。
  const evidenceByStep = {
    s003Source: ["S003-M02-SOURCE-XLSX-20251231", "resources/m02/source-asset.v1.json"],
    s003Snapshot: ["S003-M02-SOURCE-XLSX-20251231", "resources/m02/source-asset.v1.json"],
    s003Input: ["S003-T053-INPUT-20251231-v1", "resources/m02/human-input-snapshot.v1.json"],
    s003Pipeline: ["S003-M02-PIPELINE-CURRENT-PROJECTION", "resources/m02/pipeline-current-projection.v4.json"],
    s003DataPublish: ["S003-T007-FORMAL-CANDIDATE-20251231-v1", "resources/m02/formal-candidate-data-asset.v1.json"],
    s003Modeling: ["S003-M01-MODEL-CONFIGURATION", "resources/m01/model-configuration.v3.json"],
    s003ModelPublish: ["S003-M01-PUBLISHED-POINTER", "resources/m01/published-pointer.v2.json"],
    s003Evaluate: ["S003-C035-RISK-RESULTS-20251231-v2", "resources/m01/c035-risk-results.v2.json"],
    s003Query: ["S003-M03-QUERY-RESULTS-20260817-002", "resources/m03/query-results.v2.json"],
    s003Candidates: ["S003-M04-DECISION-RESULTS-20260817-003", "resources/m04/decision-results.v3.json"],
    s003Confirm: ["S003-M04-DECISION-RESULTS-20260817-003", "resources/m04/decision-results.v3.json"],
    s003Todo: ["S003-M04-DECISION-RESULTS-20260817-003", "resources/m04/decision-results.v3.json"],
    s003AgentBoundary: ["S003-M05-REPORT-COPILOT-SCENARIO-PROFILE", "resources/m05/agent-position.v7.json"],
    s003Report: ["S003-M06-REPORT-MANIFEST-20260817-008", "resources/m06/report-manifest.v9.json"],
    s003Checkpoint: ["CP-S003-20260819141420000-c03838000038", "checkpoints/CP38-performance-and-m04-ux.json"]
  };
  const checkpointSteps = Object.fromEntries(workflow.map(function (step) {
    const evidence = evidenceByStep[step.id];
    return [step.id, {
      status: evidence ? "complete" : "pending",
      complete: Boolean(evidence),
      detail: step.summary,
      source: evidence?.[1] || "S003 配置化场景包",
      sourceRecordId: evidence?.[0] || null,
      at: null,
      recovery: "如需变更，请进入对应基线模块；统一壳只读取资源状态，不补造模块业务记录。"
    }];
  }));

  const scenario = {
    id: "S003",
    scenarioVersion: "S003-v1",
    status: "active",
    name: "债务风险监测",
    enabled: true,
    acceptanceReady: false,
    implementationMode: "baseline-extension",
    standalonePrototype: false,
    baselineVersion: "1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    prototypeVersion: "1.1.0",
    initialScenarioContext: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
      formedAt: "2026-08-17T16:30:00.000Z",
      status: "active"
    },
    organization: "集团债务风险管理",
    businessOwner: "财务公司",
    primaryUsers: "集团债务风险管理人员",
    selectedEntities: ["S003-ENT-001", "S003-ENT-007", "S003-ENT-020"],
    selectedEntityNames: ["风电测试公司01", "风电测试公司07", "环保测试公司4"],
    focus: "21 家企业",
    dataAsOf: "2025-12-31",
    sourceFile: "企业债务风险评估模版_S003兼容版.xlsx",
    sourceRows: 21,
    dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
    ontologyVersion: "S003-M01-DEBT-RISK-PKG 1.0.2",
    trustedOntologyVersion: "S003-M01-DEBT-RISK-PKG 1.0.2",
    moduleIds: ["data", "ontology", "query", "decision", "agent", "report"],
    dashboardReadyStepId: "s003Checkpoint",
    workflow,
    snapshotProjection: {
      kind: "immutable-checkpoint",
      checkpointId: "CP38-performance-and-m04-ux",
      manifestUrl: resourceUrl("checkpoints/CP38-performance-and-m04-ux.json"),
      readAt: "2026-08-19 14:14:20 UTC",
      scenarioIdentity: {
        scenarioId: "S003",
        scenarioVersion: "S003-v1",
        scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
        formedAt: "2026-08-17T16:30:00.000Z",
        status: "active"
      },
      steps: checkpointSteps,
      meta: {
        dataAsOf: "2025-12-31",
        dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
        semanticVersion: "1.0.2",
        bindingId: "S003-M01-PUBLISHED-POINTER",
        reportNo: "S003-M06-REPORT-MANIFEST-20260817-008",
        actualPdfFile: false
      },
      chain: {
        dataAssetVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
        ontologyBindingId: "S003-M01-PUBLISHED-POINTER",
        queryRunIds: ["S003-M03-QUERY-RESULTS-20260817-002"],
        decisionTaskIds: ["S003-M04-DECISION-RESULTS-20260817-003"],
        reportNo: "S003-M06-REPORT-MANIFEST-20260817-008",
        companionRunId: null,
        comparisonRecordId: null
      }
    },
    moduleOverrides: {
      data: {
        description: "接入债务风险财务工作簿，维护企业因子输入快照、数据管道、质量与数据资产版本。",
        initialHash: "#/resources",
        deprecatedInitialHashes: [
          "#/resources/source/s003-workbook?tab=overview",
          "#/resources/source/s003-factor-config*",
          "#/resources/source/s003-risk-band-config*",
          "#/resources/source/s003-enterprise-factor-input*"
        ]
      },
      ontology: {
        description: "维护债务风险对象、Metric、Rule、Action Type、模型配置和 Published 生命周期。",
        initialHash: "#modeling",
        deprecatedInitialHashes: ["#modeling/s003-debt-risk-config"]
      },
      query: {
        description: "基于 Published 风险事实进行只读问数、筛选和证据回链。",
        initialHash: "#/ask"
      },
      decision: {
        description: "沿用待决策队列、Action Request、成员单位接口人确认与负责人待办。",
        initialHash: "#workbench"
      },
      agent: {
        description: "保留 Agent 目录、运行与协作能力；复用平台报告伴读 Agent 的 S003 场景配置，不新增评分或处置 Agent。",
        initialHash: "#/agents"
      },
      report: {
        description: "保留报告目录、生成、核验和发布，并装入 S003 企业报告。",
        initialHash: "#/lifecycle"
      },
      dashboard: {
        initialHash: "#/dashboard/s003"
      }
    },
    dashboard: {
      route: "/dashboard/s003",
      title: "集团债务风险监测",
      checkpointUrls: [
        "checkpoints/CP01-initial-configured.json",
        "checkpoints/CP02-data-connected.json",
        "checkpoints/CP03-published-switched.json",
        "checkpoints/CP04-query-integrated.json",
        "checkpoints/CP05-decision-chain-completed.json",
        "checkpoints/CP06-agent-report-dashboard-completed.json",
        "checkpoints/CP07-e2e-integrated.json",
        "checkpoints/CP08-unified-scene-shell-completed.json",
        "checkpoints/CP09-runtime-operations-completed.json",
        "checkpoints/CP10-v103-baseline-module-integration-completed.json",
        "checkpoints/CP11-adapter-isolation-hardening-completed.json",
        "checkpoints/CP12-v103-native-integration-corrected.json",
        "checkpoints/CP13-v103-native-conditional-integration-completed.json",
        "checkpoints/CP14-v103-full-scene-regression-completed.json",
        "checkpoints/CP15-v103-full-scene-correction-completed.json",
        "checkpoints/CP16-v103-post-seal-regression-completed.json",
        "checkpoints/CP17-v103-browser-regression-completed.json",
        "checkpoints/CP18-v103-final-validation-completed.json",
        "checkpoints/CP19-v103-native-full-scene-browser-validated.json",
        "checkpoints/CP20-file-protocol-entry-fixed.json",
        "checkpoints/CP21-v103-v7-report-browser-regression-completed.json",
        "checkpoints/CP22-member-unit-routing-validated.json",
        "checkpoints/CP23-talk-track-and-member-routing-validated.json",
        "checkpoints/CP24-inventory-deduplication-validated.json",
        "checkpoints/CP25-pointer-sync-validated.json",
        "checkpoints/CP26-talk-track-and-full-validation.json",
        "checkpoints/CP27-runtime-chain-and-presentation-corrected.json",
        "checkpoints/CP28-health-chrome-and-final-regression.json",
        "checkpoints/CP29-cache-pinned-final-delivery.json",
        "checkpoints/CP30-fixed-score-no-lowest-indicator.json",
        "checkpoints/CP31-windows-demo-delivery-ready.json",
        "checkpoints/CP32-windows-demo-final-package.json",
        "checkpoints/CP33-m04-decision-workbench-ux.json",
        "checkpoints/CP34-m04-pointer-sync.json",
        "checkpoints/CP35-final-pointer-sync.json",
        "checkpoints/CP36-risk-visuals.json",
        "checkpoints/CP37-config-consistency.json",
        "checkpoints/CP38-performance-and-m04-ux.json"
      ].map(resourceUrl),
      resourceUrls: {
        fixture: resourceUrl("fixtures/enterprise-fixture.v1.json"),
        model: resourceUrl("resources/m01/published-pointer.v2.json"),
        publishedPointer: resourceUrl("resources/m01/published-pointer.v2.json"),
        modelConfiguration: resourceUrl("resources/m01/model-configuration.v3.json"),
        actionTypeCatalog: resourceUrl("resources/m01/action-type-catalog.v2.json"),
        results: resourceUrl("resources/m01/c035-risk-results.v2.json"),
        facts: resourceUrl("resources/m01/published-risk-facts.v2.json"),
        dataContract: resourceUrl("resources/m02/data-contract.v1.1.json"),
        sourceRegistry: resourceUrl("resources/m02/source-registry.v4.json"),
        pipelineProjection: resourceUrl("resources/m02/pipeline-current-projection.v4.json"),
        inputSnapshot: resourceUrl("resources/m02/human-input-snapshot.v1.json"),
        quality: resourceUrl("resources/m02/quality-result.v1.json"),
        c017DecisionProjection: resourceUrl("resources/m02/c017-decision-projection.v2.json"),
        decisionResults: resourceUrl("resources/m04/decision-results.v3.json"),
        decisionInbox: resourceUrl("resources/m04/decision-inbox.v3.json"),
        enterpriseContactRouting: resourceUrl("resources/m04/enterprise-contact-routing.v1.json"),
        agentPosition: resourceUrl("resources/m05/agent-position.v7.json"),
        reportDefinition: resourceUrl("resources/m06/report-definition.v2.json"),
        reportTemplate: resourceUrl("resources/m06/report-template.v2.json"),
        reportAssurance: resourceUrl("resources/m06/report-assurance-profile.v3.json"),
        reportManifest: resourceUrl("resources/m06/report-manifest.v9.json"),
        reportContents: resourceUrl("resources/m06/report-contents.v9.json"),
        reportArtifacts: resourceUrl("resources/m06/report-artifacts.v9.json"),
        reportHistory: resourceUrl("resources/m06/report-history-index.v4.json")
      }
    },
    featureFlags: {
      dedicatedAgent: false,
      multiUser: false,
      multiLevelApproval: false,
      dedicatedDispositionPage: false,
      dashboardWorkbench: true,
      fastRerun: true,
      checkpointRead: true
    },
    statusSemantics: {
      historicalCompletionSource: "immutable-checkpoint",
      currentRuntimeHealthSource: "S003Store.getRuntimeSnapshot + S003ShellHealth(M01-M06 page health)",
      requireHealthyRuntimeForAllConfirmed: true,
      acceptanceReady: false
    }
  };

  window.OFW_SCENARIO_CONFIGS = window.OFW_SCENARIO_CONFIGS || {};
  window.OFW_SCENARIO_CONFIGS.S003 = Object.freeze(scenario);
})();
