(function () {
  "use strict";

  const DATA = window.S002_DATA;
  const FOUNDATION = window.OFWScenarioFoundation;
  const STORAGE = window.localStorage;
  const SCENARIO = DATA.scenario;
  const MODULE_SCOPES = ["m01", "m02", "m03", "m04", "m05", "m06"];
  const MODULE_IDS = { m01: "M01", m02: "M02", m03: "M03", m04: "M04", m05: "M05", m06: "M06" };
  const MODULE_VERSIONS = {
    m01: "S002-M01-1.0.0",
    m02: "S002-M02-1.0.0",
    m03: "S002-M03-1.0.0",
    m04: "S002-M04-1.0.0",
    m05: "S002-M05-1.0.0",
    m06: "S002-M06-1.0.0"
  };
  const PLATFORM_SCOPE = "platform";
  const PLATFORM_KEY = "runtime-projection";
  const MODULE_KEY = "owned-state";
  const ACTIVE_CONTEXT_KEY = "ofw:v1.1.0:S002:S002-v1:active-context";
  const IMPLEMENTATION_AT_MS = Date.parse(SCENARIO.implementationTimestamp || "2026-08-15T08:00:00.000Z");
  const IMPLEMENTATION_DAY_END_MS = Date.parse(SCENARIO.implementationDayEnd || "2026-08-15T15:59:59.999Z");
  const LEGACY_ACTION_TYPE_ID_MAP = Object.freeze({ ...(DATA.legacyActionTypeIdMap || {}) });

  function canonicalActionTypeId(value) {
    return LEGACY_ACTION_TYPE_ID_MAP[value] || value;
  }

  function canonicalizeActionTypeReferences(value) {
    if (Array.isArray(value)) return value.map(canonicalizeActionTypeReferences);
    if (!value || typeof value !== "object") return value;
    const normalized = {};
    Object.entries(value).forEach(function ([key, item]) {
      if (key === "legacyCompatibleId") {
        normalized[key] = item;
        return;
      }
      if (typeof item === "string" && LEGACY_ACTION_TYPE_ID_MAP[item] && ["actionTypeId", "actionId", "id", "code"].includes(key)) {
        normalized[key] = canonicalActionTypeId(item);
        if (!normalized.legacyCompatibleId) normalized.legacyCompatibleId = item;
        return;
      }
      normalized[key] = canonicalizeActionTypeReferences(item);
    });
    return normalized;
  }

  function runtimeNowMs() {
    const current = Date.now();
    return current > IMPLEMENTATION_DAY_END_MS ? IMPLEMENTATION_AT_MS : current;
  }
  function nowIso() { return new Date(runtimeNowMs()).toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function createContext(status) {
    return FOUNDATION.createScenarioContext(
      { scenarioId: SCENARIO.id, scenarioVersion: SCENARIO.scenarioVersion, status: status || "active" },
      { now: runtimeNowMs() }
    );
  }

  function rememberActiveContext(value) {
    if (["active", "restored", "regression"].includes(value.status)) {
      STORAGE.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(value));
    }
    return value;
  }

  function loadOrCreateContext() {
    const saved = STORAGE.getItem(ACTIVE_CONTEXT_KEY);
    if (saved) {
      try {
        const value = FOUNDATION.assertScenarioContext(JSON.parse(saved));
        const formedAtMs = Date.parse(value.formedAt || "");
        const fixedImplementationContext = Number.isFinite(formedAtMs)
          && formedAtMs <= IMPLEMENTATION_DAY_END_MS
          && String(value.scenarioRunId || "").startsWith("S002-RUN-20260815");
        if (value.scenarioId === SCENARIO.id && value.scenarioVersion === SCENARIO.scenarioVersion && ["active", "restored", "regression"].includes(value.status) && fixedImplementationContext) {
          return value;
        }
      } catch (error) {
        // 损坏或旧版指针不授权读取其他轮次；下方创建新的活动轮次。
      }
    }
    return rememberActiveContext(createContext("active"));
  }

  function modeFromContext(value) {
    if (value.status === "historical-readonly") return "historical";
    if (value.status === "regression") return "regression";
    if (value.status === "restored") return "restored";
    return "live";
  }

  function emptyProgress() {
    return {
      dataConnected: false, qualityPassed: false, assetPublished: false,
      mappingApplied: false, ontologyPublished: false,
      queryRun: false, rulesRun: false,
      actionsDrafted: false, actionConfirmed: false, todoCreated: false,
      agentsRun: false, reportBuilt: false, dashboardPublished: false
    };
  }

  function moduleDefaults(scope) {
    const common = { moduleId: MODULE_IDS[scope], moduleVersion: MODULE_VERSIONS[scope] };
    if (scope === "m02") return { ...common, progress: { dataConnected: false, qualityPassed: false, assetPublished: false }, sourceSnapshot: null, sourceCatalog: [], pipelineDefinitions: [], pipelineRuns: [], qualityReceipt: null, dataAssets: [], dataAsset: null };
    if (scope === "m01") return { ...common, progress: { mappingApplied: false, ontologyPublished: false }, mappingVersion: null, c003Receipt: null, targetDraftBinding: null, publishedOntology: null };
    if (scope === "m03") return { ...common, progress: { queryRun: false, rulesRun: false }, queryRuns: [], ruleHits: [], ruleEvaluations: [], viewContracts: [], fixedView: null };
    if (scope === "m04") return { ...common, progress: { actionsDrafted: false, actionConfirmed: false, todoCreated: false }, actionRequests: [], decisionAlerts: [], todos: [], decisionSummary: null };
    if (scope === "m05") return { ...common, progress: { agentsRun: false }, agentRuns: [], orchestrationRun: null };
    return { ...common, progress: { reportBuilt: false, dashboardPublished: false }, reports: [], dashboardVersions: [], dashboardView: null };
  }

  function defaultModules() {
    return MODULE_SCOPES.reduce(function (result, scope) { result[scope] = moduleDefaults(scope); return result; }, {});
  }

  function platformDefaults(value, runtimeMode) {
    return {
      context: value,
      mode: runtimeMode,
      activeTheme: "execution",
      filters: { year: 2025, department: "全部", subject: "全部", project: "全部", period: "全年", anomaly: "全部" },
      selectedQuestion: null,
      drill: null,
      events: [],
      checkpointHistory: [],
      checkpoint: null,
      restoredFrom: null,
      regressionFrom: null,
      lastEventAt: nowIso()
    };
  }

  let context = loadOrCreateContext();
  let mode = modeFromContext(context);
  let listeners = [];
  let platformStorage = null;
  let moduleStorages = {};
  let platform = platformDefaults(context, mode);
  let modules = defaultModules();

  function writableContext() {
    return !["historical-readonly", "closed"].includes(context.status) && mode !== "historical";
  }

  function makeStorages() {
    platformStorage = null;
    moduleStorages = {};
    if (!writableContext()) return;
    platformStorage = FOUNDATION.createNamespacedStorage({ storage: STORAGE, context: context, scope: PLATFORM_SCOPE });
    MODULE_SCOPES.forEach(function (scope) {
      moduleStorages[scope] = FOUNDATION.createNamespacedStorage({ storage: STORAGE, context: context, scope: scope });
    });
  }

  function assertOwnedState(scope, value) {
    if (!value || value.moduleId !== MODULE_IDS[scope] || value.moduleVersion !== MODULE_VERSIONS[scope]) {
      throw new Error(`${MODULE_IDS[scope]}状态导出与Owner版本不匹配`);
    }
    return value;
  }

  function loadState() {
    platform = platformDefaults(context, mode);
    modules = defaultModules();
    if (!platformStorage) return;
    const savedPlatform = platformStorage.get(PLATFORM_KEY);
    if (savedPlatform && savedPlatform.context) {
      FOUNDATION.assertScenarioContextMatch(context, savedPlatform.context);
      platform = { ...platform, ...savedPlatform, context: context, mode: mode };
    }
    MODULE_SCOPES.forEach(function (scope) {
      const saved = moduleStorages[scope].get(MODULE_KEY);
      if (saved) modules[scope] = { ...moduleDefaults(scope), ...canonicalizeActionTypeReferences(assertOwnedState(scope, saved)) };
    });
  }

  function progressProjection() {
    return MODULE_SCOPES.reduce(function (result, scope) { return { ...result, ...(modules[scope].progress || {}) }; }, emptyProgress());
  }

  function getSnapshot() {
    return clone({
      ...platform,
      context: context,
      mode: mode,
      progress: progressProjection(),
      queryRuns: modules.m03.queryRuns,
      ruleHits: modules.m03.ruleHits,
      ruleEvaluations: modules.m03.ruleEvaluations,
      viewContracts: modules.m03.viewContracts,
      queryView: modules.m03.fixedView,
      actionRequests: modules.m04.actionRequests,
      decisionAlerts: modules.m04.decisionAlerts,
      todos: modules.m04.todos,
      decisionSummary: modules.m04.decisionSummary,
      agentRuns: modules.m05.agentRuns,
      orchestrationRun: modules.m05.orchestrationRun,
      reports: modules.m06.reports,
      dashboardVersions: modules.m06.dashboardVersions,
      dashboardView: modules.m06.dashboardView
    });
  }

  function notify() {
    const snapshot = getSnapshot();
    listeners.forEach(function (listener) { listener(snapshot); });
  }

  function persist(scopes, event) {
    if (!writableContext()) return false;
    rememberActiveContext(context);
    if (event) {
      const eventPayload = { ...event, context: clone(context), at: nowIso() };
      platform.events = [...(platform.events || []).slice(-79), eventPayload];
      platform.lastEventAt = eventPayload.at;
    }
    platform = { ...platform, context: context, mode: mode };
    platformStorage.set(PLATFORM_KEY, platform);
    (scopes || []).forEach(function (scope) { moduleStorages[scope].set(MODULE_KEY, modules[scope]); });
    notify();
    return true;
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
  }

  function updateModule(scope, patch, progressPatch, event) {
    if (!writableContext()) return false;
    modules[scope] = { ...modules[scope], ...patch, progress: { ...modules[scope].progress, ...(progressPatch || {}) } };
    return persist([scope], event);
  }

  function connectData() {
    return updateModule("m02", {
      sourceSnapshot: {
        snapshotId: "S002-SOURCE-SNAPSHOT-v1",
        sourceFiles: DATA.quality.sourceFiles,
        logicalSources: DATA.quality.logicalSources,
        snapshotCount: DATA.quality.snapshotCount,
        logicalMembers: DATA.quality.logicalMembers,
        sourcePackage: SCENARIO.sourcePackage,
        sourceSha256: SCENARIO.sourceSha256,
        formedAt: nowIso(),
        dataMarkerPolicy: ["SOURCE", "CORRECTED", "SYNTHETIC_FOR_DEMO", "DERIVED_REVERSAL", "DERIVED", "IMPUTED_ZERO", "MIXED_SOURCE_AND_DEMO_MARKERS"]
      },
      sourceCatalog: clone(DATA.dataSources),
      pipelineDefinitions: clone(DATA.dataPipelines)
    }, { dataConnected: true }, { type: "step-completed", step: "dataConnected", detail: "5个逻辑数据源以8个不可变年度/确认快照进入S002独立命名空间，共14个逻辑成员。" });
  }

  function runQuality() {
    if (!modules.m02.progress.dataConnected) return false;
    return updateModule("m02", {
      qualityReceipt: {
        receiptId: "S002-QUALITY-RECEIPT-v1",
        status: "passed-for-demo",
        checksPassed: DATA.quality.checksPassed,
        checksTotal: DATA.quality.checksTotal,
        formulaErrors: DATA.quality.formulaErrors,
        repairedIssues: clone(DATA.quality.repairedIssues),
        formedAt: nowIso(),
        disclaimer: "演示加工通过，不等于生产数据验收。"
      }
    }, { qualityPassed: true }, { type: "step-completed", step: "qualityPassed", detail: "合法重复保留；期间和日期异常按授权形成可追溯演示修正。" });
  }

  function publishData() {
    if (!modules.m02.progress.qualityPassed) return false;
    const formedAt = nowIso();
    const dataAssets = DATA.dataAssets.map(function (asset) {
      return {
        ...clone(asset),
        status: "published-for-scenario",
        qualityReceiptId: modules.m02.qualityReceipt.receiptId,
        snapshotId: modules.m02.sourceSnapshot.snapshotId,
        currency: SCENARIO.currency,
        unit: SCENARIO.unit,
        formedAt: formedAt
      };
    });
    const pipelineRuns = DATA.dataPipelines.map(function (pipeline) {
      return {
        runId: `RUN-${pipeline.pipelineId}`,
        pipelineId: pipeline.pipelineId,
        targetAssetVersion: pipeline.targetAssetVersion,
        status: "completed",
        qualityReceiptId: modules.m02.qualityReceipt.receiptId,
        snapshotId: modules.m02.sourceSnapshot.snapshotId,
        formedAt: formedAt
      };
    });
    return updateModule("m02", {
      dataAssets: dataAssets,
      pipelineRuns: pipelineRuns,
      dataAsset: {
        assetId: "S002-DATA-BUNDLE",
        version: "S002-DATA-v1",
        status: "published-for-scenario",
        role: "compatibility-delivery-pointer",
        componentAssets: dataAssets.map(function (asset) { return { assetId: asset.assetId, name: asset.name, version: asset.version, asOf: asset.asOf }; }),
        qualityReceiptId: modules.m02.qualityReceipt.receiptId,
        snapshotId: modules.m02.sourceSnapshot.snapshotId,
        asOf: SCENARIO.dataAsOf,
        currency: SCENARIO.currency,
        unit: SCENARIO.unit,
        formedAt: formedAt
      }
    }, { assetPublished: true }, { type: "step-completed", step: "assetPublished", detail: "M02通过两条正式管道分别发布预算编制与执行、项目预算占用与余额两个数据资产；S002-DATA-v1仅作为C003兼容交付组合指针。业务阈值和指标公式仍不进入管道。" });
  }

  function applyMapping() {
    if (!modules.m02.progress.assetPublished) return false;
    const formedAt = nowIso();
    const assetVersion = modules.m02.dataAsset.version;
    const deliveryId = `C003-${assetVersion}`;
    return updateModule("m01", {
      c003Receipt: {
        receiptId: `RECEIPT-${deliveryId}`,
        sourceModule: "本体管理",
        contractCode: "C003",
        status: "accepted",
        deliveryId: deliveryId,
        reason: null,
        t007Version: assetVersion,
        t006Id: modules.m02.dataAsset.assetId,
        t008AsOf: modules.m02.dataAsset.asOf,
        assetRole: modules.m02.dataAsset.role,
        componentAssets: clone(modules.m02.dataAsset.componentAssets || []),
        targetDraftId: "DRAFT-S002-BUDGET-v1",
        targetDraftRevision: 1,
        previousDraftId: null,
        previousAssetVersion: null,
        replacement: null,
        scenarioContext: clone(context),
        receivedAt: formedAt
      },
      targetDraftBinding: {
        deliveryId: deliveryId,
        sourceDeliveryId: deliveryId,
        assetVersion: assetVersion,
        sourceAssetVersion: assetVersion,
        componentAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }),
        targetDraftId: "DRAFT-S002-BUDGET-v1",
        targetDraftRevision: 1,
        formedAt: formedAt
      },
      mappingVersion: {
        mappingId: "S002-MAPPING-v1",
        dataAssetVersion: assetVersion,
        componentAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }),
        assetBindings: (modules.m02.dataAssets || []).map(function (asset) {
          return {
            assetId: asset.assetId,
            assetVersion: asset.version,
            memberIds: clone(asset.memberIds || []),
            internalRelationIds: clone(asset.internalRelationIds || []),
            crossAssetRelationIds: clone(asset.crossAssetRelationIds || [])
          };
        }),
        crossAssetRelations: [
          { relationId: "REL-LINK-S002-VOUCHER-PROJECT", sourceAssetVersion: "S002-BUDGET-EXEC-v1", targetAssetVersion: "S002-PROJECT-OCC-v1", stableKey: "项目标识" },
          { relationId: "REL-LINK-S002-PROJECT-VERSION", sourceAssetVersion: "S002-PROJECT-OCC-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1", stableKey: "预算版本标识" }
        ],
        stableKeys: ["主体", "期间", "科目", "预算版本", "情景", "项目", "凭证行", "采购发起"],
        formedAt: formedAt
      }
    }, { mappingApplied: true }, { type: "step-completed", step: "mappingApplied", detail: "M01已接收C003数据资产组合合同，分别绑定预算执行与项目占用资产到同一目标Draft；对象、关系、事件和稳定键映射完成，未按工作表页签建模。" });
  }

  function publishOntology() {
    if (!modules.m01.progress.mappingApplied) return false;
    return updateModule("m01", {
      publishedOntology: {
        ontologyVersion: "S002-ONTO-v1",
        publishedPointer: "T019-S002-v1",
        dataAssetVersion: modules.m02.dataAsset.version,
        componentAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }),
        metricVersion: "S002-METRIC-v1",
        ruleVersion: "S002-RULE-v1",
        actionTypeVersion: "S002-ACTION-TYPE-v1",
        status: "published-for-scenario",
        consumptionContext: {
          scenarioContext: clone(context),
          dataBundleVersion: modules.m02.dataAsset.version,
          componentAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }),
          ontologyVersion: "S002-ONTO-v1",
          publishedPointer: "T019-S002-v1",
          asOf: modules.m02.dataAsset.asOf,
          currency: SCENARIO.currency,
          unit: SCENARIO.unit,
          expenseBasis: SCENARIO.expenseBasis,
          incomeSign: SCENARIO.incomeSign,
          c003ReceiptId: modules.m01.c003Receipt?.receiptId || null,
          c003DeliveryId: modules.m01.c003Receipt?.deliveryId || null,
          targetDraftId: modules.m01.targetDraftBinding?.targetDraftId || null,
          targetDraftRevision: modules.m01.targetDraftBinding?.targetDraftRevision || null,
          status: "ready-for-current-scenario-run",
          readOnly: true
        },
        formedAt: nowIso()
      }
    }, { ontologyPublished: true }, { type: "step-completed", step: "ontologyPublished", detail: "M01切换Published本体和T019；M03/M06仅按引用消费。" });
  }

  function buildQuestionResult(type) {
    if (type === "execution") return DATA.annualFacts.filter(function (row) { return row.year === 2025; }).map(function (row) { return { department: row.department, expenseRate: row.expenseRate, budget: row.approvedExpenseBudget, actual: row.actualExpense, variance: Number((row.actualExpense - row.approvedExpenseBudget).toFixed(4)), unit: "万元", dataMarker: row.dataMarker }; });
    if (type === "cost-margin") return DATA.annualFacts.filter(function (row) { return row.year === 2025 && row.costToRevenue > 1; }).map(function (row) {
      return {
        department: row.department,
        actualRevenue: row.actualRevenue,
        actualExpense: row.actualExpense,
        costToRevenue: row.costToRevenue,
        costToRevenuePercent: Number((row.costToRevenue * 100).toFixed(2)),
        grossMargin: row.grossMargin,
        grossMarginPercent: Number((row.grossMargin * 100).toFixed(2)),
        conclusion: row.grossMargin < 0 ? "成本占收比超过100%，真正毛利率为负" : "真正毛利率非负",
        dataMarker: row.dataMarker
      };
    });
    if (type === "submission") return DATA.submissionFacts.filter(function (row) { return row.year === 2026; }).sort(function (a, b) { return b.costToRevenue - a.costToRevenue; }).map(function (row) { return { department: row.department, costToRevenue: row.costToRevenue, grossMargin: row.grossMargin, revenue: row.revenue, totalCost: row.totalCost, unit: "%", dataMarker: row.dataMarker }; });
    if (type === "balance") return DATA.projects.filter(function (row) { return row.availableBalance < 0 || (row.launchAmount > 0 && row.netInTransit / row.launchAmount >= 0.30); }).map(function (row) {
      const netInTransitRate = row.launchAmount > 0 ? row.netInTransit / row.launchAmount : null;
      return {
        projectId: row.projectId,
        department: row.department,
        name: row.name,
        availableBalance: row.availableBalance,
        netInTransit: row.netInTransit,
        netInTransitRate: netInTransitRate,
        netInTransitRatePercent: netInTransitRate == null ? null : Number((netInTransitRate * 100).toFixed(2)),
        alerts: [row.availableBalance < 0 ? "项目可用立项余额不足（Published RULE-001）" : null, netInTransitRate >= 0.30 ? "净在途占立项金额达到30%问数分析关注线（非Rule命中）" : null].filter(Boolean),
        sourceCoverage: row.commitmentSourceCoverage,
        dataMarker: row.dataMarker
      };
    });
    if (type === "commitment") return { netInTransit: DATA.occupancy.netInTransit, positivePr: DATA.occupancy.totalPositivePr, decemberShare: DATA.occupancy.decemberShare, budgetOccupancyDecemberShare: DATA.occupancy.budgetOccupancyDecemberShare, coverage: `${DATA.occupancy.coveredProjects}/21项目有源占用` };
    if (type === "trend") return DATA.annualFacts.filter(function (row) { return row.year === 2025; }).map(function (row) { return { department: row.department, revenueYoY: row.revenueYoY, expenseYoY: row.expenseYoY, trend: row.trend, dataMarker: row.dataMarker }; });
    return {
      pendingActions: [
        { sourceId: "HIT-002-2025-AQ", subject: "安全运行部|FY2025-APPROVED-FINAL-v1", actionType: "预算执行整改", owner: "安全运行部费用预算负责人", reason: "费用预算执行率98.86%，需核实剩余计划、采购占用和费用控制安排" },
        { sourceId: "HIT-003-2025-AQ", subject: "安全运行部|FY2025-APPROVED-FINAL-v1", actionType: "费用管理优化核查", owner: "安全运行部费用管理负责人", reason: "成本占收比112.63%，真正毛利率-12.63%，需核实收入确认与费用优化空间" },
        { sourceId: "HIT-005", subject: "PRJ-AQ-灾害-2025-002|供应商3", actionType: "供应商价格复核", owner: "采购管理部价格复核负责人", reason: "同口径价格倍率1.20倍，需复核可比组、税率和服务月数" },
        { sourceId: "HIT-002-2025-SB", subject: "设备管理部|FY2025-APPROVED-FINAL-v1", actionType: "下一年度预算合理性复核", owner: "设备管理部年度预算编制负责人", reason: "费用预算执行率63.20%，已命中RULE-002低执行率分支，需核实未执行计划及下一年度预算合理性" }
      ],
      boundary: "仅生成Action草稿和平台内待办，必须人工确认；不自动调增、调减、调剂、退回、释放、过账或调用外部系统。"
    };
  }

  function executeQuestion(questionId) {
    if (!modules.m01.progress.ontologyPublished) return false;
    const question = DATA.questions.find(function (item) { return item.id === questionId; });
    if (!question) return false;
    const run = {
      runId: `QR-S002-${runtimeNowMs()}`,
      questionId: questionId,
      label: question.label,
      result: buildQuestionResult(question.type),
      configurationRef: "C009-S002-v1",
      viewContract: "C018-S002-v1",
      dataAssetVersion: modules.m02.dataAsset.version,
      ontologyVersion: modules.m01.publishedOntology.ontologyVersion,
      publishedPointer: modules.m01.publishedOntology.publishedPointer,
      evidence: [modules.m02.dataAsset.version].concat((modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }), [modules.m01.publishedOntology.ontologyVersion, modules.m01.publishedOntology.publishedPointer]),
      at: nowIso()
    };
    const viewContracts = modules.m03.viewContracts.some(function (item) { return item.id === "C018-S002-v1"; }) ? modules.m03.viewContracts : [...modules.m03.viewContracts, { id: "C018-S002-v1", status: "active", pinnedDataVersion: run.dataAssetVersion, pinnedOntologyVersion: run.ontologyVersion, formedAt: run.at }];
    const fixedView = modules.m03.fixedView || {
      contractId: "C018-S002-v1",
      dataAssetVersion: run.dataAssetVersion,
      dataAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }),
      ontologyVersion: run.ontologyVersion,
      annualFacts: clone(DATA.annualFacts),
      submissionFacts: clone(DATA.submissionFacts),
      projects: clone(DATA.projects),
      occupancy: clone(DATA.occupancy),
      expenseDetails: clone(DATA.expenseDetails),
      travelFacts: clone(DATA.travelFacts),
      accrualPairs: clone(DATA.accrualPairs),
      supplierBenchmarks: clone(DATA.supplierBenchmarks),
      supplierBenchmarkGroups: clone(DATA.supplierBenchmarkGroups || []),
      legalRecordExplanations: clone(DATA.legalRecordExplanations),
      formedAt: run.at,
      syntheticMark: SCENARIO.syntheticMark
    };
    platform.selectedQuestion = questionId;
    modules.m03 = { ...modules.m03, queryRuns: [...modules.m03.queryRuns, run], viewContracts: viewContracts, fixedView: fixedView, progress: { ...modules.m03.progress, queryRun: true } };
    persist(["m03"], { type: "step-completed", step: "queryRun", questionId: questionId, detail: "固定问数视图返回结构化确定性结果。" });
    return run;
  }

  function runRules() {
    if (!modules.m03.progress.queryRun) return false;
    const hits = DATA.ruleHitInputs.map(function (input) {
      const mapping = DATA.ruleHitMappings.find(function (item) { return item.hitId === input.id; });
      if (!mapping) return { ...clone(input), ruleId: null, metricId: null, actionTypeId: null, actionType: null, ruleVersion: modules.m01.publishedOntology.ruleVersion, evidence: [modules.m02.dataAsset.version, modules.m01.publishedOntology.publishedPointer], mappingStatus: "blocked" };
      const rule = DATA.rules.find(function (item) { return item.id === mapping.ruleId; });
      const actionType = DATA.actionTypes.find(function (item) { return item.id === mapping.actionTypeId; });
      if (!rule || !actionType) return { ...clone(input), ruleId: mapping.ruleId || null, metricId: mapping.metricId || null, actionTypeId: mapping.actionTypeId || null, actionType: actionType?.name || null, ruleVersion: modules.m01.publishedOntology.ruleVersion, evidence: [modules.m02.dataAsset.version, mapping.metricId || rule?.supportingMeasure || null, modules.m01.publishedOntology.publishedPointer], mappingStatus: "blocked" };
      return { ...clone(input), ruleId: rule.id, metricId: mapping.metricId || null, actionTypeId: actionType.id, actionType: actionType.name, ruleVersion: modules.m01.publishedOntology.ruleVersion, evidence: [modules.m02.dataAsset.version, mapping.metricId || rule.supportingMeasure, modules.m01.publishedOntology.publishedPointer] };
    });
    modules.m03 = { ...modules.m03, ruleHits: hits, ruleEvaluations: clone(DATA.ruleEvaluations), progress: { ...modules.m03.progress, rulesRun: true } };
    persist(["m03"], { type: "step-completed", step: "rulesRun", hitCount: hits.length, qualityEvaluationCount: DATA.ruleEvaluations.length, detail: `${hits.length}条正式Rule命中，${DATA.ruleEvaluations.length}条独立质量核验无异常；分析建议、Rule命中与质量解释分开保存。` });
    return hits;
  }

  function gateEvidence(stage, decision) {
    return { stage: stage, status: "passed", decision: decision || "continue", c017SummaryId: "C017-S002-DATA-v1", dataAssetVersion: modules.m02.dataAsset.version, ontologyVersion: modules.m01.publishedOntology.ontologyVersion, readAt: nowIso() };
  }

  function businessAssignment(actionTypeId, department, suppliedOwner, suppliedOwnerId) {
    actionTypeId = canonicalActionTypeId(actionTypeId);
    const directOwner = String(suppliedOwner || "").trim();
    if (directOwner && !["平台管理员", "财务运营账号"].includes(directOwner)) {
      return { owner: directOwner, ownerId: suppliedOwnerId || `BUSINESS-${String(actionTypeId || "OWNER").replace(/[^A-Z0-9]+/gi, "-")}` };
    }
    const departmentCode = department === "设备管理部" ? "SB" : department === "技术部" ? "JS" : department === "安全运行部" ? "AQ" : "BUDGET";
    if (actionTypeId === "ACT-SUPPLIER-PRICE-REVIEW") return { owner: "采购管理业务承接人", ownerId: "BUSINESS-OWNER-PROCUREMENT-PRICE" };
    if (actionTypeId === "ACT-PROCUREMENT-COMMITMENT-CLEANUP") return { owner: `${department || "采购管理"}采购占用承接人`, ownerId: `BUSINESS-OWNER-${departmentCode}-COMMITMENT` };
    if (actionTypeId === "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT") return { owner: `${department || "预算管理"}预算申报承接人`, ownerId: `BUSINESS-OWNER-${departmentCode}-SUBMISSION` };
    if (["ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "ACT-BUDGET-EXECUTION-RECTIFICATION"].includes(actionTypeId)) return { owner: `${department || "预算管理"}预算承接人`, ownerId: `BUSINESS-OWNER-${departmentCode}-BUDGET` };
    return { owner: `${department || "预算管理"}预算承接人`, ownerId: `BUSINESS-OWNER-${departmentCode}-BUDGET` };
  }

  function actionSourceItems() {
    const recommendationByAction = {
      "ACT-BUDGET-EXECUTION-RECTIFICATION": "形成预算执行整改提醒，待人工确认后生成平台内待办；不反写外部预算系统。",
      "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW": "形成下一年度预算合理性复核提醒，待人工确认后生成平台内待办；不覆盖最终批准预算。",
      "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW": "形成费用管理优化核查提醒，要求人工核对费用结构和科目余额；不自动调账。",
      "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT": "生成预算申报依据补充待办，要求补充收入依据和成本拆解；不自动退回或改写申报。",
      "ACT-PROCUREMENT-COMMITMENT-CLEANUP": "生成采购占用清理核对待办；不直接释放外部占用。",
      "ACT-SUPPLIER-PRICE-REVIEW": "创建供应商价格复核待办；不触发供应商系统调用。"
    };
    const ruleItems = modules.m03.ruleHits.map(function (hit) {
      const rule = DATA.rules.find(function (item) { return item.id === hit.ruleId; });
      const metric = DATA.metrics.find(function (item) { return item.id === hit.metricId; });
      const supportingMetricId = hit.ruleId === "RULE-005" ? "RULE-005-SUPPORT" : hit.metricId;
      return {
        sourceType: "rule-hit",
        sourceId: hit.id,
        sourceRef: `M03 · ${hit.id} · ${hit.ruleId}`,
        requester: "规则运行服务",
        title: hit.title,
        subject: hit.subject,
        department: hit.department,
        year: hit.year,
        subjectCategories: clone(hit.subjectCategories || []),
        periods: clone(hit.periods || ["全年"]),
        dataMarker: hit.dataMarker,
        priority: hit.priority,
        ruleId: hit.ruleId,
        ruleName: rule && rule.name,
        ruleBranch: rule && rule.expression,
        ruleHitEvidence: `${hit.title}：${hit.value}${hit.unit || ""}`,
        metricId: supportingMetricId,
        metricName: metric ? metric.name : hit.ruleId === "RULE-005" ? "可比供应商价格倍率（Rule输入快照）" : rule && rule.supportingMeasure,
        metricValue: hit.value,
        metricUnit: hit.unit,
        metricExplanation: hit.denominator ? `${hit.numerator} / ${hit.denominator}；${hit.denominatorBasis || "同口径分母"}` : hit.baselinePrice ? `${hit.sourceUnitPrice} / ${hit.baselinePrice}；${hit.baselineMethod || "同口径比较"}` : hit.title,
        actionTypeId: hit.actionTypeId,
        actionType: hit.actionType,
        recommendation: recommendationByAction[hit.actionTypeId] || "形成平台内Action草稿，待人工确认。",
        evidence: hit.evidence,
        suggestedAmount: null
      };
    });
    const suggestionItems = DATA.actionSuggestions.map(function (suggestion) {
      const actionType = DATA.actionTypes.find(function (item) { return item.id === suggestion.actionTypeId; });
      return { ...clone(suggestion), sourceType: "qa-analysis-suggestion", sourceId: suggestion.id, actionType: actionType.name, evidence: [modules.m02.dataAsset.version].concat((modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }), [suggestion.metricId, "C018-S002-v1"]) };
    });
    return [...ruleItems, ...suggestionItems];
  }

  function submitActions() {
    if (!modules.m03.progress.rulesRun) return false;
    modules.m04 = {
      ...modules.m04,
      actionRequests: [],
      decisionAlerts: [],
      todos: [],
      actionPolicy: "disabled-for-s002-current-scope",
      decisionSummary: { id: "C019-S002-NOT-APPLICABLE", status: "no-runtime-actions", requestCount: 0, pendingCount: 0, awaitingCount: 0, confirmedCount: 0, rejectedCount: 0, todoCount: 0, formedAt: nowIso() },
      progress: { ...modules.m04.progress, actionsDrafted: true, actionConfirmed: true, todoCreated: true }
    };
    persist(["m04"], { type: "step-completed", step: "actionsDrafted", count: 0, actionPolicy: "disabled-for-s002-current-scope", detail: "S002 当前范围仅展示异常与关注事项，不生成行动申请、决策事项或平台内待办。" });
    return [];
  }

  function submitDashboardAction(sourceId) {
    if (sourceId) return false;
    return false;
    /* 当前 S002 范围明确禁用驾驶舱向决策中心发起行动示例。
    if (!writableContext() || !modules.m04.progress.actionsDrafted || !modules.m06.progress.dashboardPublished) return false;
    const candidateId = typeof sourceId === "string" ? sourceId : sourceId && (sourceId.sourceId || sourceId.id);
    const candidate = (DATA.dashboardActionCandidates || []).find(function (item) { return item.id === candidateId; });
    if (!candidate) return false;
    const actionType = DATA.actionTypes.find(function (item) { return item.id === candidate.actionTypeId; });
    if (!actionType) return false;
    const idempotencyKey = `${context.scenarioRunId}:${candidate.sourceType}:${candidate.id}:${candidate.actionTypeId}`;
    // 驾驶舱只是报告侧的预警查看与行动入口，不应因为发布动作扩充决策真值。
    // 若预警已由 M03 Rule/分析建议形成 Action Request，则复用原事项；只有
    // 确实没有对应事项时，用户点击才补建一条草稿。三种匹配均保持幂等。
    const existing = modules.m04.actionRequests.find(function (request) {
      return (candidate.relatedSourceId && request.sourceId === candidate.relatedSourceId)
        || request.idempotencyKey === idempotencyKey
        || request.sourceId === candidate.id;
    });
    if (existing) return clone(existing);
    const createdAt = nowIso();
    const runToken = context.scenarioRunId.slice(-12);
    const requestId = `AR-S002-${runToken}-${candidate.id}`;
    const assignment = businessAssignment(candidate.actionTypeId, candidate.department, candidate.businessOwner, candidate.businessOwnerId);
    const request = {
      requestId: requestId,
      requestVersion: 1,
      idempotencyKey: idempotencyKey,
      scenarioContext: clone(context),
      sourceType: candidate.sourceType,
      sourceId: candidate.id,
      sourceRef: `M06 · ${candidate.dashboardTrigger && candidate.dashboardTrigger.cardId || candidate.id} · 预算驾驶舱预警`,
      requester: "预算管理驾驶舱",
      ruleId: candidate.ruleId || null,
      ruleName: candidate.ruleName || null,
      ruleVersion: candidate.ruleId ? modules.m01.publishedOntology.ruleVersion : null,
      ruleBranch: candidate.ruleBranch || null,
      ruleHitEvidence: candidate.ruleHitEvidence || null,
      metricId: candidate.metricId || null,
      metricName: candidate.metricName || null,
      metricValue: candidate.metricValue,
      metricUnit: candidate.metricUnit || null,
      metricExplanation: candidate.metricExplanation || candidate.triggerReason,
      actionTypeId: candidate.actionTypeId,
      actionType: actionType.name,
      title: candidate.title,
      subjectId: candidate.subjectId,
      subject: candidate.subject,
      subjectName: candidate.subjectName,
      department: candidate.department,
      year: candidate.year,
      subjectCategories: clone(candidate.subjectCategories || []),
      periods: clone(candidate.periods || ["全年"]),
      dataMarker: candidate.dataMarker,
      amount: candidate.suggestedAmount == null ? null : candidate.suggestedAmount,
      priority: candidate.priority || "中",
      triggerReason: candidate.triggerReason,
      recommendation: candidate.recommendation,
      dashboardTrigger: clone(candidate.dashboardTrigger || null),
      status: "draft",
      externalStatus: "not-dispatched",
      owner: assignment.owner,
      ownerId: assignment.ownerId,
      businessOwner: assignment.owner,
      businessOwnerId: assignment.ownerId,
      decisionOperator: "平台管理员",
      semanticBinding: { dataAssetVersion: modules.m02.dataAsset.version, dataAssetVersions: (modules.m02.dataAsset.componentAssets || []).map(function (asset) { return asset.version; }), ontologyVersion: modules.m01.publishedOntology.ontologyVersion, actionTypeVersion: modules.m01.publishedOntology.actionTypeVersion, publishedPointer: modules.m01.publishedOntology.publishedPointer },
      gates: { receive: gateEvidence("receive"), confirm: { stage: "confirm", status: "pending" }, todo: { stage: "todo", status: "pending" } },
      evidence: [...new Set([...(candidate.evidence || []), modules.m02.dataAsset.version, modules.m01.publishedOntology.publishedPointer])],
      snapshotId: `DASH-S002-${candidate.id}-20260815`,
      cutoff: `${SCENARIO.dataAsOf} 23:59`,
      createdAt: createdAt,
      sideEffectPolicy: clone(FOUNDATION.SIDE_EFFECT_POLICY)
    };
    const actionRequests = [...modules.m04.actionRequests, request];
    const decisionAlerts = [...modules.m04.decisionAlerts, { alertId: `ALERT-${requestId}`, requestId: requestId, title: candidate.title, severity: candidate.priority === "高" ? "high" : candidate.ruleId ? "rule" : "analysis", status: "open", owner: assignment.owner, ownerId: assignment.ownerId, decisionOperator: "平台管理员", source: "M06预算驾驶舱", createdAt: createdAt }];
    const confirmedCount = actionRequests.filter(function (item) { return ["confirmed", "simulated-confirmed"].includes(item.status); }).length;
    const rejectedCount = actionRequests.filter(function (item) { return item.status === "rejected"; }).length;
    const pendingCount = actionRequests.filter(function (item) { return item.status === "draft"; }).length;
    modules.m04 = {
      ...modules.m04,
      actionRequests: actionRequests,
      decisionAlerts: decisionAlerts,
      decisionSummary: { ...(modules.m04.decisionSummary || { id: "C019-S002-v1" }), status: "reviewing", requestCount: actionRequests.length, pendingCount: pendingCount, awaitingCount: pendingCount, confirmedCount: confirmedCount, rejectedCount: rejectedCount, todoCount: modules.m04.todos.length, formedAt: createdAt },
      progress: { ...modules.m04.progress, actionsDrafted: true }
    };
    persist(["m04"], { type: "dashboard-action-drafted", sourceId: candidate.id, requestId: requestId, actionTypeId: candidate.actionTypeId, businessOwner: assignment.owner, externalDispatch: false });
    return clone(request); */
  }

  function decisionMetadata(value, request, decision) {
    const supplied = value && typeof value === "object" ? value : {};
    const assignment = businessAssignment(
      request.actionTypeId,
      request.department,
      supplied.owner || request.businessOwner || request.owner,
      supplied.ownerId || request.businessOwnerId || request.ownerId
    );
    return {
      reason: String(supplied.reason || (decision === "reject" ? "平台管理员已人工拒绝该预算Action草稿。" : "平台管理员已人工确认该预算Action草稿。")),
      owner: decision === "confirm" ? assignment.owner : null,
      ownerId: decision === "confirm" ? assignment.ownerId : null,
      due: decision === "confirm" ? String(supplied.due || supplied.dueDate || "演示确认后7日") : null,
      instructions: String(supplied.instructions || request.recommendation || "按固定证据核对，仅形成平台内待办。")
    };
  }

  function reviewAction(requestId, decision, metadata) {
    if (!writableContext()) return false;
    if (!modules.m04.progress.actionsDrafted) return false;
    if (!["confirm", "reject"].includes(decision)) return false;
    const existing = modules.m04.actionRequests.find(function (request) { return request.requestId === requestId; });
    if (!existing) return false;
    if (decision === "confirm" && ["confirmed", "simulated-confirmed"].includes(existing.status)) return clone(existing);
    if (existing.status !== "draft") return false;
    const isRegression = mode === "regression";
    const reviewedAt = nowIso();
    const review = decisionMetadata(metadata, existing, decision);
    let createdTodo = null;
    const requests = modules.m04.actionRequests.map(function (request) {
      if (request.requestId !== requestId) return request;
      if (decision === "reject") return {
        ...request,
        status: "rejected",
        rejectedAt: reviewedAt,
        rejectedBy: "平台管理员",
        decision: { type: "reject", reason: review.reason, operator: "平台管理员", time: reviewedAt, owner: null, dueDate: null, instructions: review.instructions },
        decisionReason: review.reason,
        decisionInstructions: review.instructions,
        gates: { ...request.gates, confirm: gateEvidence("confirm", "rejected"), todo: { stage: "todo", status: "not-created", reason: "request-rejected" } }
      };
      const status = isRegression ? "simulated-confirmed" : "confirmed";
      return {
        ...request,
        status: status,
        confirmedAt: reviewedAt,
        confirmedBy: "平台管理员",
        owner: review.owner,
        ownerId: review.ownerId,
        businessOwner: review.owner,
        businessOwnerId: review.ownerId,
        decision: { type: "confirm", reason: review.reason, operator: "平台管理员", time: reviewedAt, owner: review.owner, ownerId: review.ownerId, dueDate: review.due, instructions: review.instructions },
        decisionReason: review.reason,
        decisionInstructions: review.instructions,
        decisionDue: review.due,
        gates: { ...request.gates, confirm: gateEvidence("confirm", status), todo: isRegression ? { stage: "todo", status: "suppressed", reason: "isolated-regression" } : gateEvidence("todo", "create") },
        regressionOnly: isRegression
      };
    });
    if (decision === "confirm" && !isRegression) {
      const reviewed = requests.find(function (request) { return request.requestId === requestId; });
      const todoId = `TODO-${requestId}`;
      if (!modules.m04.todos.some(function (todo) { return todo.todoId === todoId; })) {
        const assignment = businessAssignment(reviewed.actionTypeId, reviewed.department, reviewed.businessOwner || reviewed.owner, reviewed.businessOwnerId || reviewed.ownerId);
        createdTodo = { todoId: todoId, requestId: requestId, idempotencyKey: reviewed.idempotencyKey, title: `${reviewed.actionType} · ${reviewed.subjectName || reviewed.subject}`, owner: assignment.owner, ownerId: assignment.ownerId, businessOwner: assignment.owner, businessOwnerId: assignment.ownerId, operator: "平台管理员", decisionReason: review.reason, instructions: review.instructions, status: "待处理", due: review.due, deepLink: "#module/decision", scenarioContext: clone(context), createdAt: reviewedAt, externalDispatch: false };
      }
    }
    const todos = createdTodo ? [...modules.m04.todos, createdTodo] : modules.m04.todos;
    const alerts = modules.m04.decisionAlerts.map(function (alert) { return alert.requestId === requestId ? { ...alert, status: decision === "reject" ? "rejected" : isRegression ? "simulated" : "resolved", resolvedAt: reviewedAt } : alert; });
    const confirmedCount = requests.filter(function (request) { return ["confirmed", "simulated-confirmed"].includes(request.status); }).length;
    const rejectedCount = requests.filter(function (request) { return request.status === "rejected"; }).length;
    const pendingCount = requests.filter(function (request) { return request.status === "draft"; }).length;
    modules.m04 = {
      ...modules.m04,
      actionRequests: requests,
      decisionAlerts: alerts,
      todos: todos,
      decisionSummary: { ...modules.m04.decisionSummary, status: "reviewing", requestCount: requests.length, pendingCount: pendingCount, awaitingCount: pendingCount, confirmedCount: confirmedCount, rejectedCount: rejectedCount, todoCount: todos.length, formedAt: reviewedAt },
      progress: { ...modules.m04.progress, actionConfirmed: confirmedCount > 0, todoCreated: todos.length > 0 }
    };
    persist(["m04"], { type: decision === "reject" ? "action-rejected" : "action-confirmed", requestId: requestId, todoId: createdTodo && createdTodo.todoId, reason: review.reason, businessOwner: review.owner, regressionSuppressed: isRegression });
    return clone(requests.find(function (request) { return request.requestId === requestId; }));
  }

  function confirmAction(requestId, metadata) { return reviewAction(requestId, "confirm", metadata); }
  function rejectAction(requestId, metadata) { return reviewAction(requestId, "reject", metadata); }

  function runAgents() {
    if (!modules.m03.progress.rulesRun || !modules.m04.progress.actionsDrafted) return false;
    const timestamp = runtimeNowMs();
    const runs = [
      { runId: `AG-RUN-S002-${timestamp}-ANOMALY`, agentId: "budget-anomaly-analyst", definitionVersion: "S002-AGENT-ANOMALY-v1", name: "预算异常分析 Agent", status: "complete", summary: `聚合${modules.m03.ruleHits.length}条Rule命中，输出异常事实、口径和证据定位；不生成Action候选。`, evidence: ["C018-S002-v1", modules.m01.publishedOntology.ruleVersion] },
      { runId: `AG-RUN-S002-${timestamp}-REPORT`, agentId: "budget-report-drafter", definitionVersion: "S002-AGENT-REPORT-v1", name: "预算报告草稿 Agent", status: "complete", summary: "只读消费C018固定视图和异常分析结果，生成五主题报告草稿；不触发决策中心，不引用尚未形成的T049。", evidence: ["C018-S002-v1", modules.m01.publishedOntology.publishedPointer] }
    ];
    modules.m05 = { ...modules.m05, agentRuns: runs, orchestrationRun: { runId: `ORCH-RUN-S002-${timestamp}`, definitionVersion: "S002-ORCH-v1", status: "complete", steps: runs.map(function (run) { return run.runId; }), formedAt: nowIso() }, progress: { ...modules.m05.progress, agentsRun: true } };
    persist(["m05"], { type: "step-completed", step: "agentsRun", agents: runs.map(function (run) { return run.agentId; }), detail: "两个受约束Agent完成轻量编排，不创建待办或发布正式报告。" });
    return clone(runs);
  }

  function buildReportContentSnapshot(capturedAt) {
    return {
      schemaVersion: "ofw.s002.report-content-snapshot.v1",
      capturedAt: capturedAt,
      scenarioContext: clone(context),
      c018: {
        contractId: modules.m03.fixedView.contractId,
        dataAssetVersion: modules.m03.fixedView.dataAssetVersion,
        ontologyVersion: modules.m03.fixedView.ontologyVersion,
        fixedView: clone(modules.m03.fixedView),
        ruleHits: clone(modules.m03.ruleHits),
        ruleEvaluations: clone(modules.m03.ruleEvaluations)
      },
      c019: {
        contractId: modules.m04.decisionSummary?.id || "C019-S002-NOT-APPLICABLE",
        decisionSummary: clone(modules.m04.decisionSummary),
        actionRequests: clone(modules.m04.actionRequests),
        decisionAlerts: clone(modules.m04.decisionAlerts),
        todos: clone(modules.m04.todos)
      }
    };
  }

  function buildDashboardView(report) {
    const contentSnapshot = clone(report.contentSnapshot);
    return {
      schemaVersion: "ofw.s002.dashboard-view.v2",
      contractId: "C018-S002-DASHBOARD-v1",
      status: "draft",
      dataAssetVersion: contentSnapshot.c018.dataAssetVersion,
      ontologyVersion: contentSnapshot.c018.ontologyVersion,
      decisionSummaryRef: contentSnapshot.c019.contractId,
      queryViewRef: contentSnapshot.c018.contractId,
      ruleRunRef: `M03-RULE-RUN-${contentSnapshot.c018.ruleHits.length}`,
      decisionSummaryStatus: contentSnapshot.c019.decisionSummary.status,
      reportDraftRef: report.reportId,
      contentSnapshotRef: `${report.reportId}#contentSnapshot`,
      contentSnapshot: contentSnapshot,
      formedAt: report.createdAt,
      syntheticMark: SCENARIO.syntheticMark
    };
  }

  function buildReport() {
    if (!modules.m05.progress.agentsRun) return false;
    const capturedAt = nowIso();
    const contentSnapshot = buildReportContentSnapshot(capturedAt);
    const fixedView = contentSnapshot.c018.fixedView;
    const annualFacts = fixedView.annualFacts || DATA.annualFacts;
    const submissionFacts = fixedView.submissionFacts || DATA.submissionFacts;
    const projectsView = fixedView.projects || DATA.projects;
    const travelFacts = fixedView.travelFacts || DATA.travelFacts;
    const accrualPairs = fixedView.accrualPairs || DATA.accrualPairs;
    const supplierBenchmarks = fixedView.supplierBenchmarks || DATA.supplierBenchmarks;
    const actionRequests = contentSnapshot.c019.actionRequests;
    const departments = DATA.departments.map(function (department) {
      const annual = annualFacts.filter(function (row) { return row.department === department.name; });
      const submissions = submissionFacts.filter(function (row) { return row.department === department.name; });
      const projects = projectsView.filter(function (row) { return row.department === department.name; });
      const travel = travelFacts.filter(function (row) { return row.department === department.name; });
      const ruleHits = contentSnapshot.c018.ruleHits.filter(function (row) { return row.department === department.name; });
      const requests = actionRequests.filter(function (row) { return row.department === department.name; });
      return {
        department: department.name,
        sections: ["预算执行与差异", "初始申报", "项目余额与采购占用", "差旅与计提", "供应商价格", "异常与关注事项"],
        annual: annual,
        submissions: submissions,
        projectSummary: { projectCount: projects.length, negativeBalanceCount: projects.filter(function (row) { return row.availableBalance < 0; }).length, availableBalance: projects.reduce(function (sum, row) { return sum + row.availableBalance; }, 0) },
        travel: travel,
        accrualPairCount: accrualPairs.filter(function (row) { return row.department === department.name; }).length,
        supplierBenchmarkCount: supplierBenchmarks.filter(function (row) { return row.department === department.name; }).length,
        ruleHitCount: ruleHits.length,
        actionRequestCount: requests.length,
        confirmedActionCount: requests.filter(function (row) { return row.status === "confirmed"; }).length,
        dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS"
      };
    });
    const report = {
      reportId: `RPT-S002-${runtimeNowMs()}`,
      version: "S002-REPORT-DRAFT-v1",
      title: "S002预算监督管理分析报告草稿",
      status: "draft",
      themes: DATA.themes.map(function (theme) { return theme.id; }),
      departmentSections: departments,
      contentSnapshot: contentSnapshot,
      evidence: [modules.m02.dataAsset.version, modules.m01.publishedOntology.ontologyVersion, "C018-S002-v1", modules.m04.decisionSummary.id],
      createdAt: capturedAt,
      formalArtifactPublished: false,
      t049Ref: null,
      disclaimer: "报告草稿含已标识的演示补全与派生数据，不代表正式报告发布或生产业务验收。"
    };
    modules.m06 = { ...modules.m06, reports: [...modules.m06.reports, report], dashboardView: buildDashboardView(report), progress: { ...modules.m06.progress, reportBuilt: true } };
    persist(["m06"], { type: "step-completed", step: "reportBuilt", reportId: report.reportId, detail: "六专题预算分析报告草稿和驾驶舱只读消费视图已形成；正式报告仍未发布。" });
    return clone(report);
  }

  function publishDashboard() {
    if (!modules.m06.progress.reportBuilt) return false;
    const report = modules.m06.reports[modules.m06.reports.length - 1];
    const publishedAt = nowIso();
    const contentSnapshot = clone(report.contentSnapshot);
    const version = {
      dashboardVersionId: `DASH-S002-${runtimeNowMs()}`,
      version: "S002-DASHBOARD-v1",
      status: "published",
      viewContract: modules.m06.dashboardView.contractId,
      reportDraftRef: report.reportId,
      reportStatusAtPublish: report.status,
      contentSnapshotRef: `${report.reportId}#contentSnapshot`,
      contentSnapshot: contentSnapshot,
      publishedAt: publishedAt,
      owner: "M06",
      formalReportPublished: false,
      t049Ref: null
    };
    const dashboardView = {
      ...modules.m06.dashboardView,
      status: "published",
      dashboardVersionId: version.dashboardVersionId,
      publishedAt: publishedAt,
      contentSnapshotRef: version.contentSnapshotRef,
      contentSnapshot: clone(contentSnapshot)
    };
    modules.m06 = { ...modules.m06, dashboardVersions: [...modules.m06.dashboardVersions, version], dashboardView: dashboardView, progress: { ...modules.m06.progress, dashboardPublished: true } };
    persist(["m06"], { type: "step-completed", step: "dashboardPublished", dashboardVersionId: version.dashboardVersionId, detail: "M06独立Dashboard Version已发布；报告草稿状态保持draft。" });
    return clone(version);
  }

  function setTheme(themeId) { if (!writableContext()) return false; platform.activeTheme = themeId; platform.drill = null; return persist([], { type: "theme-selected", themeId: themeId }); }
  function setFilters(filters) { if (!writableContext()) return false; platform.filters = { ...platform.filters, ...filters }; platform.drill = null; return persist([], { type: "filters-changed", filters: clone(filters) }); }
  function setDrill(drill) { if (!writableContext()) return false; platform.drill = clone(drill); return persist([], { type: "drill-opened", drill: clone(drill) }); }
  function clearDrill() { if (!writableContext()) return false; platform.drill = null; return persist([], { type: "drill-closed" }); }

  function reset() {
    if (!writableContext()) throw new Error("历史只读或已关闭运行不能重置；请返回当前活动运行。");
    const oldContext = context;
    const result = FOUNDATION.directionalReset(
      { storage: STORAGE, currentContext: oldContext },
      { now: runtimeNowMs() }
    );
    context = result.context;
    mode = modeFromContext(context);
    rememberActiveContext(context);
    platform = platformDefaults(context, mode);
    modules = defaultModules();
    makeStorages();
    persist(MODULE_SCOPES, { type: "scenario-reset", previousRunId: oldContext.scenarioRunId, newRunId: context.scenarioRunId });
    return result;
  }

  function loadCheckpoint(checkpoint) {
    return fetchJson(checkpoint.file).then(function (manifest) {
      const validation = FOUNDATION.validateCheckpointManifest(manifest);
      if (!validation.ok) throw new Error(`Checkpoint清单校验失败：${validation.errors.join("；")}`);
      if (manifest.scenarioContext.scenarioId !== SCENARIO.id || manifest.scenarioContext.scenarioVersion !== SCENARIO.scenarioVersion) throw new Error("Checkpoint场景身份与S002不匹配");
      if (manifest.baselineVersion !== SCENARIO.baselineVersion || manifest.baselineSnapshotId !== SCENARIO.baselineSnapshotId) throw new Error("Checkpoint父基线与S002不匹配");
      return manifest;
    });
  }

  function scopedCheckpointRef(ref) {
    const normalized = String(ref || "").replace(/^\.\//, "");
    if (!normalized || normalized.includes("\\") || /(^|\/)\.\.?($|\/)/.test(normalized)) throw new Error(`恢复资源路径越界：${ref}`);
    if (!/^checkpoints\/(current|runs)\//.test(normalized)) throw new Error(`恢复资源不在S002不可变运行目录：${ref}`);
    if (window.location && window.location.href) {
      const base = new URL("./", window.location.href);
      const resolved = new URL(normalized, base);
      if (resolved.origin !== base.origin || !resolved.pathname.startsWith(`${base.pathname}checkpoints/`)) throw new Error(`恢复资源跨Origin或跨场景：${ref}`);
      return resolved.href;
    }
    return normalized;
  }

  function sha256Text(text) {
    if (!globalThis.crypto?.subtle) return Promise.reject(new Error("当前运行环境不支持Checkpoint摘要校验"));
    return globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    });
  }

  function fetchJson(ref, expectedSha256) {
    const scopedRef = scopedCheckpointRef(ref);
    const normalized = String(ref || "").replace(/^\.\//, "");
    // checkpoints/current 是指向最新不可变运行的可变便捷指针；禁止浏览器
    // 复用旧响应。runs/* 仍保持内容寻址与摘要校验，不改变历史真源语义。
    const fetchOptions = normalized.startsWith("checkpoints/current/") ? { cache: "no-store" } : undefined;
    return fetch(scopedRef, fetchOptions).then(function (response) { if (!response.ok) throw new Error(`读取恢复资源 ${ref} 失败`); return response.text(); }).then(function (text) {
      const verify = expectedSha256 ? sha256Text(text).then(function (actual) { if (actual !== expectedSha256) throw new Error(`恢复资源摘要错配：${ref}`); }) : Promise.resolve();
      return verify.then(function () { return JSON.parse(text); });
    });
  }

  function loadCheckpointPayload(manifest) {
    const modulePromises = MODULE_SCOPES.map(function (scope) {
      const descriptor = manifest.modules[MODULE_IDS[scope]];
      return fetchJson(descriptor.exportRef, descriptor.exportSha256).then(function (payload) { return [scope, payload]; });
    });
    const configuration = manifest.stateSections.configurations.items[0];
    return Promise.all([Promise.all(modulePromises), fetchJson(configuration.ref, configuration.sha256)]).then(function (results) {
      const ownedStates = results[0].reduce(function (result, entry) {
        const scope = entry[0];
        const payload = entry[1];
        result[scope] = canonicalizeActionTypeReferences(assertOwnedState(scope, payload.runtimeState || payload.stateSnapshot || payload.state));
        return result;
      }, {});
      return { modules: ownedStates, configuration: results[1] };
    });
  }

  function restoredPlatform(configuration, targetContext, targetMode) {
    const saved = configuration.runtimeState && configuration.runtimeState.platform ? configuration.runtimeState.platform : {};
    return { ...platformDefaults(targetContext, targetMode), activeTheme: saved.activeTheme || "execution", filters: { ...platformDefaults(targetContext, targetMode).filters, ...(saved.filters || {}) }, selectedQuestion: saved.selectedQuestion || null, checkpointHistory: saved.checkpointHistory || [] };
  }

  function historicalView(checkpoint) {
    return loadCheckpoint(checkpoint).then(function (manifest) {
      const view = FOUNDATION.createHistoricalView(manifest);
      return loadCheckpointPayload(manifest).then(function (payload) {
        context = view.context;
        mode = "historical";
        modules = payload.modules;
        platform = { ...restoredPlatform(payload.configuration, context, mode), checkpoint: manifest };
        makeStorages();
        notify();
        return view;
      });
    });
  }

  function rebindRestoredDecisions(sourceContext, targetContext, sourceCheckpointId) {
    modules.m04.actionRequests = modules.m04.actionRequests.map(function (request) { return { ...request, sourceScenarioContext: request.scenarioContext || sourceContext, scenarioContext: clone(targetContext), restoredFrom: sourceCheckpointId, externalStatus: "not-dispatched" }; });
    modules.m04.todos = modules.m04.todos.map(function (todo) { return { ...todo, sourceScenarioContext: todo.scenarioContext || sourceContext, scenarioContext: clone(targetContext), restoredFrom: sourceCheckpointId, externalDispatch: false }; });
  }

  function rebindRestoredSemanticEvidence(sourceContext, targetContext, sourceCheckpointId) {
    const receipt = modules.m01.c003Receipt;
    if (receipt) {
      modules.m01.c003Receipt = {
        ...receipt,
        sourceScenarioContext: receipt.scenarioContext || sourceContext,
        scenarioContext: clone(targetContext),
        restoredFrom: sourceCheckpointId
      };
    }
    const binding = modules.m01.targetDraftBinding;
    if (binding) {
      modules.m01.targetDraftBinding = {
        ...binding,
        sourceScenarioContext: binding.scenarioContext || sourceContext,
        scenarioContext: clone(targetContext),
        restoredFrom: sourceCheckpointId
      };
    }
    const published = modules.m01.publishedOntology;
    if (published) {
      modules.m01.publishedOntology = {
        ...published,
        sourceScenarioContext: published.scenarioContext || sourceContext,
        scenarioContext: clone(targetContext),
        restoredFrom: sourceCheckpointId,
        consumptionContext: published.consumptionContext ? {
          ...published.consumptionContext,
          sourceScenarioContext: published.consumptionContext.scenarioContext || sourceContext,
          scenarioContext: clone(targetContext),
          restoredFrom: sourceCheckpointId
        } : published.consumptionContext
      };
    }
  }

  function cloneRestore(checkpoint) {
    return loadCheckpoint(checkpoint).then(function (manifest) {
      // Bind portable demo restores to the fixed S002 implementation date so
      // the cloned completed run remains the active context after refresh.
      const restored = FOUNDATION.cloneRestore(manifest, { now: runtimeNowMs() });
      return loadCheckpointPayload(manifest).then(function (payload) {
        context = restored.context;
        mode = "restored";
        rememberActiveContext(context);
        modules = payload.modules;
        rebindRestoredSemanticEvidence(manifest.scenarioContext, context, manifest.checkpointId);
        rebindRestoredDecisions(manifest.scenarioContext, context, manifest.checkpointId);
        platform = { ...restoredPlatform(payload.configuration, context, mode), restoredFrom: manifest.checkpointId };
        makeStorages();
        persist(MODULE_SCOPES, { type: "clone-restore", sourceCheckpointId: manifest.checkpointId, newRunId: context.scenarioRunId, historicalSideEffectsReplayed: false });
        return restored;
      });
    });
  }

  function isolatedRegression(checkpoint) {
    return loadCheckpoint(checkpoint).then(function (manifest) {
      const regression = FOUNDATION.createIsolatedRegression(manifest);
      return loadCheckpointPayload(manifest).then(function (payload) {
        context = regression.context;
        mode = "regression";
        rememberActiveContext(context);
        modules = payload.modules;
        modules.m03 = moduleDefaults("m03");
        modules.m04 = moduleDefaults("m04");
        modules.m05 = moduleDefaults("m05");
        modules.m06 = moduleDefaults("m06");
        platform = { ...platformDefaults(context, mode), regressionFrom: manifest.checkpointId };
        makeStorages();
        persist(MODULE_SCOPES, { type: "isolated-regression", sourceCheckpointId: manifest.checkpointId, newRunId: context.scenarioRunId, historicalActionReplay: false, historicalTodoReplay: false, externalDispatch: false });
        return regression;
      });
    });
  }

  function getCheckpointHistory() { return clone(platform.checkpointHistory || []); }

  function recordCheckpointSummary(summary) {
    if (!writableContext()) return false;
    const history = (platform.checkpointHistory || []).filter(function (item) { return item.checkpointId !== summary.checkpointId; });
    platform.checkpointHistory = [...history, clone(summary)].slice(-20);
    return persist([], { type: "checkpoint-summary-recorded", checkpointId: summary.checkpointId });
  }

  function exportOwnedState() {
    return clone({ scenarioContext: context, mode: mode, platform: platform, modules: modules, projection: getSnapshot() });
  }

  makeStorages();
  loadState();

  window.S002_STORE = {
    get: getSnapshot,
    subscribe: subscribe,
    context: function () { return context; },
    mode: function () { return mode; },
    reset: reset,
    connectData: connectData,
    runQuality: runQuality,
    publishData: publishData,
    applyMapping: applyMapping,
    publishOntology: publishOntology,
    executeQuestion: executeQuestion,
    runRules: runRules,
    submitActions: submitActions,
    submitDashboardAction: submitDashboardAction,
    confirmAction: confirmAction,
    rejectAction: rejectAction,
    runAgents: runAgents,
    buildReport: buildReport,
    publishDashboard: publishDashboard,
    setTheme: setTheme,
    setFilters: setFilters,
    setDrill: setDrill,
    clearDrill: clearDrill,
    loadCheckpoint: loadCheckpoint,
    historicalView: historicalView,
    cloneRestore: cloneRestore,
    isolatedRegression: isolatedRegression,
    recordCheckpointSummary: recordCheckpointSummary,
    getCheckpointHistory: getCheckpointHistory,
    exportOwnedState: exportOwnedState,
    moduleVersions: clone(MODULE_VERSIONS)
  };
})();
