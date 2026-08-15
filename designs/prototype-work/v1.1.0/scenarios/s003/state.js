(function () {
  "use strict";

  const DATA = window.S003Data;
  const FOUNDATION = window.OFWScenarioFoundation;
  const listeners = new Set();

  let bundle = null;
  let state = {
    ready: false,
    fatalError: null,
    context: null,
    currentView: "overview",
    selectedEnterpriseId: null,
    navCollapsed: false,
    mobileNavOpen: false,
    activeConfigTab: "weights",
    enterpriseSearch: "",
    enterpriseRiskFilter: "ALL",
    enterpriseSectorFilter: "ALL",
    enterpriseSort: "score-asc",
    factorEntrySearch: "",
    factorEntryStatus: "published",
    factorEntryValidation: null,
    factorInputSnapshot: null,
    factorInputs: {},
    configStatus: "published",
    configValidation: null,
    configDraft: null,
    publishedModel: null,
    activeRun: null,
    lastSuccessfulRun: null,
    runHistory: [],
    runStatus: "idle",
    runError: null,
    queryId: null,
    queryAnswer: null,
    decisions: [],
    pendingDecision: null,
    historicalView: null,
    operationNotice: null,
    projectionNotice: "浏览器存储仅保存可丢弃的当前工作投影，不作为正式快照真源。"
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function emit() {
    listeners.forEach(function (listener) { listener(getState()); });
  }

  function getState() {
    return state;
  }

  function getBundle() {
    return bundle;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function set(patch, silent) {
    state = { ...state, ...patch };
    if (!silent) emit();
    return state;
  }

  function initialContext(manifest) {
    const scenario = manifest.scenario;
    const context = {
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioRunId: scenario.initialScenarioRunId,
      formedAt: scenario.formedAt,
      status: scenario.status || "active"
    };
    if (FOUNDATION) FOUNDATION.assertScenarioContext(context);
    return Object.freeze(context);
  }

  function storage(scope) {
    if (!FOUNDATION || !state.context || state.historicalView) return null;
    try {
      return FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context: state.context, scope });
    } catch (_) {
      return null;
    }
  }

  function persist(scope, key, payload) {
    const adapter = storage(scope);
    if (!adapter) return;
    try { adapter.set(key, payload); } catch (_) { /* 可丢弃投影写入失败不影响正式事实 */ }
  }

  function readProjection(scope, key) {
    const adapter = storage(scope);
    if (!adapter) return null;
    try { return adapter.get(key); } catch (_) { return null; }
  }

  function sourceFactorInputs(fixture) {
    return Object.fromEntries(fixture.enterprises.map(function (enterprise) {
      return [enterprise.enterpriseId, clone(enterprise.factorInputs || {})];
    }));
  }

  function normalizeDecisionRecord(record) {
    const actionRequest = record?.actionRequest || record;
    if (!actionRequest?.actionRequestId || !actionRequest?.scenarioIdentity) return null;
    return {
      ...clone(actionRequest),
      scenarioRunId: actionRequest.scenarioIdentity.scenarioRunId,
      actionRequest: clone(actionRequest),
      todo: clone(record?.todo || null),
      idempotencyKey: record?.idempotencyKey || actionRequest.idempotencyKey,
      created: record?.created !== false,
      idempotent: Boolean(record?.idempotent),
      duplicate: Boolean(record?.duplicate)
    };
  }

  function sourceDecisionRecords() {
    return (bundle?.decisionResults?.confirmations || []).map(normalizeDecisionRecord).filter(Boolean);
  }

  function createConfigDraft(model) {
    const service = bundle?.configService || window.S003ConfigService;
    if (service?.createDraft) {
      const draft = service.createDraft(model);
      return {
        schemaVersion: draft.schemaVersion,
        draftId: draft.draftId,
        lifecycleStatus: draft.lifecycleStatus,
        basedOnPackageId: draft.basedOnPackageId,
        basedOnVersion: draft.basedOnVersion,
        proposedVersion: draft.proposedVersion,
        owner: draft.owner,
        createdAt: draft.createdAt,
        weights: clone(draft.editable.weights),
        factors: clone(draft.editable.factors),
        riskTiers: clone(draft.editable.riskTiers),
        indicatorOrder: clone(draft.locked.indicatorOrder),
        assessment: clone(draft.locked.assessment),
        locked: clone(draft.locked),
        changedAt: null
      };
    }
    return {
      packageId: model.packageId,
      packageVersion: model.packageVersion,
      weights: clone(model.weights),
      factors: clone(model.factors),
      riskTiers: clone(model.riskTiers),
      indicatorOrder: clone(model.indicatorOrder),
      assessment: clone(model.assessment),
      changedAt: null
    };
  }

  function hydrateConfigDraft(value, model) {
    const baseline = createConfigDraft(model);
    if (!value) return baseline;
    const projected = clone(value);
    return {
      ...baseline,
      ...projected,
      weights: clone(projected.weights || baseline.weights),
      factors: clone(projected.factors || baseline.factors),
      riskTiers: clone(projected.riskTiers || baseline.riskTiers),
      indicatorOrder: clone(projected.indicatorOrder || baseline.indicatorOrder),
      assessment: clone(projected.assessment || baseline.assessment),
      locked: clone(projected.locked || baseline.locked)
    };
  }

  function canonicalConfigDraft(draft) {
    const source = draft || state.configDraft;
    const locked = source.locked || {
      resourceType: state.publishedModel.resourceType,
      indicatorOrder: clone(state.publishedModel.indicatorOrder),
      formulas: clone(state.publishedModel.formulas),
      scoreAnchors: clone(state.publishedModel.scoreAnchors),
      profitStability: clone(state.publishedModel.profitStability),
      actionTypes: clone(state.publishedModel.actionTypes),
      assessment: clone(state.publishedModel.assessment)
    };
    return {
      schemaVersion: source.schemaVersion || "ofw.s003.m01.config-draft.v1",
      draftId: source.draftId || `S003-MODEL-DRAFT-${Date.now()}`,
      lifecycleStatus: source.lifecycleStatus || (state.configStatus === "validated" ? "validated" : "draft"),
      basedOnPackageId: source.basedOnPackageId || state.publishedModel.packageId,
      basedOnVersion: source.basedOnVersion || state.publishedModel.packageVersion,
      proposedVersion: source.proposedVersion || incrementVersion(state.publishedModel.packageVersion),
      owner: source.owner || state.publishedModel.businessOwner || "财务公司",
      createdAt: source.createdAt || source.changedAt || new Date().toISOString(),
      validatedAt: source.validatedAt || null,
      editable: {
        weights: clone(source.weights),
        factors: clone(source.factors),
        riskTiers: clone(source.riskTiers)
      },
      locked: clone(locked)
    };
  }

  function routeFromHash() {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw.startsWith("report/")) {
      return { view: "report", enterpriseId: decodeURIComponent(raw.split("?")[0].slice(7)) };
    }
    const view = DATA.VIEWS.some(function (item) { return item.id === raw; }) ? raw : "overview";
    return { view };
  }

  async function bootstrap() {
    try {
      bundle = await DATA.load();
      const context = bundle.c035Results?.scenarioIdentity
        ? Object.freeze(clone(bundle.c035Results.scenarioIdentity))
        : initialContext(bundle.manifest);
      if (FOUNDATION) FOUNDATION.assertScenarioContext(context);
      const projectedFactors = readProjectionForContext(context, "m02", "factor-inputs/current");
      const projectedConfig = readProjectionForContext(context, "m01", "config/current");
      const projectedDecisions = readProjectionForContext(context, "m04", "action-requests/current");
      const factorInputs = projectedFactors?.values || sourceFactorInputs(bundle.fixture);
      const publishedModel = projectedConfig?.publishedModel || clone(bundle.model);
      const configDraft = hydrateConfigDraft(projectedConfig?.configDraft, publishedModel);
      const route = routeFromHash();
      state = {
        ...state,
        ready: true,
        context,
        currentView: route.view,
        selectedEnterpriseId: route.enterpriseId || bundle.fixture.enterprises[0]?.enterpriseId || null,
        factorInputs,
        factorInputSnapshot: clone(bundle.humanInputSnapshot),
        publishedModel,
        configDraft,
        decisions: Array.isArray(projectedDecisions?.items) ? projectedDecisions.items : sourceDecisionRecords()
      };
      emit();
      if (bundle.c035Results?.scenarioIdentity?.scenarioRunId === context.scenarioRunId) {
        const run = normalizeRun(bundle.c035Results, context);
        set({
          activeRun: run,
          lastSuccessfulRun: run,
          runHistory: [run],
          runStatus: "succeeded",
          runError: null,
          operationNotice: "已读取 CP03 同轮次 Published C035 权威结果与 CP06 正式报告。"
        });
      } else {
        await evaluate(context, { initial: true, keepPrevious: false });
      }
    } catch (error) {
      set({ ready: false, fatalError: error.message || String(error) });
    }
  }

  function readProjectionForContext(context, scope, key) {
    if (!FOUNDATION) return null;
    try {
      const adapter = FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context, scope });
      return adapter.get(key);
    } catch (_) {
      return null;
    }
  }

  function applyFactorInputsToFixture() {
    const fixture = clone(bundle.fixture);
    fixture.enterprises = fixture.enterprises.map(function (enterprise) {
      return { ...enterprise, factorInputs: clone(state.factorInputs[enterprise.enterpriseId] || enterprise.factorInputs || {}) };
    });
    return fixture;
  }

  async function callEngine(context) {
    const engine = bundle.engine || window.S003ScoreEngine;
    if (!engine) throw new Error("M01 评分引擎尚未加载；已保留上一成功运行，当前不可重评。");
    const fixture = applyFactorInputsToFixture();
    const payload = {
      scenarioContext: clone(context),
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      assessmentAt: fixture.assessmentAt,
      modelPackage: clone(state.publishedModel),
      model: clone(state.publishedModel),
      fixture,
      enterprises: clone(fixture.enterprises),
      factorInputs: clone(state.factorInputs),
      humanInputSnapshot: clone(state.factorInputSnapshot),
      context: {
        ...clone(context),
        assessmentAt: fixture.assessmentAt,
        currency: fixture.currency,
        amountUnit: fixture.amountUnit,
        dataVersion: bundle.formalDataAsset?.dataAssetId || bundle.formalDataAsset?.assetId || fixture.fixtureId,
        manualInputVersion: state.factorInputSnapshot?.snapshotId || bundle.humanInputSnapshot?.snapshotId,
        publishedVersion: state.publishedModel.packageVersion,
        resultVersion: "1.0.0"
      }
    };

    const portfolioMethod = ["evaluatePortfolio", "evaluateScenario", "runEvaluation", "runScenario", "evaluateAll", "run"]
      .find(function (name) { return typeof engine[name] === "function"; });
    if (portfolioMethod) {
      try {
        return await engine[portfolioMethod](payload);
      } catch (firstError) {
        try {
          return await engine[portfolioMethod](fixture, state.publishedModel, { scenarioContext: context, factorInputs: state.factorInputs });
        } catch (_) {
          throw firstError;
        }
      }
    }
    if (typeof engine.evaluateEnterprise === "function") {
      const results = [];
      for (const enterprise of fixture.enterprises) {
        results.push(await engine.evaluateEnterprise({
          enterprise,
          modelPackage: state.publishedModel,
          scenarioContext: context,
          assessmentAt: fixture.assessmentAt
        }));
      }
      return { enterpriseResults: results };
    }
    throw new Error("S003ScoreEngine 未暴露可识别的组合评估方法。");
  }

  function resultArray(raw) {
    if (Array.isArray(raw)) return raw;
    const candidates = [raw?.enterpriseResults, raw?.results, raw?.evaluations, raw?.records, raw?.portfolio?.enterprises, raw?.data?.enterpriseResults];
    return candidates.find(Array.isArray) || [];
  }

  function normalizeMetricDetails(result) {
    const source = result.indicatorDetails || result.indicatorScores || result.indicatorResults || result.metricResults || result.metrics || [];
    if (Array.isArray(source)) {
      return source.map(function (item, index) {
        return {
          name: item.name || item.metricName || item.indicatorName || state.publishedModel.indicatorOrder?.[index] || `指标${index + 1}`,
          value: item.value ?? item.metricValue ?? item.indicatorValue ?? item.actualValue ?? null,
          grade: item.grade ?? item.level ?? null,
          score: Number(item.weightedScore ?? item.score ?? item.metricScore ?? 0),
          weight: Number(item.weightPercent ?? (Number(item.weight) <= 1 ? Number(item.weight) * 100 : item.weight) ?? state.publishedModel.weights?.[result.category]?.[index] ?? 0),
          note: item.note || item.reason || ""
        };
      });
    }
    return Object.entries(source || {}).map(function ([name, item]) {
      const value = typeof item === "object" ? item : { score: item };
      return {
        name,
        value: value.value ?? value.metricValue ?? null,
        grade: value.grade ?? value.level ?? null,
        score: Number(value.score ?? value.weightedScore ?? 0),
        weight: Number(value.weight ?? 0),
        note: value.note || value.reason || ""
      };
    });
  }

  function normalizeFactorDetails(result, enterprise) {
    const source = result.factorDetails || result.factorResults || result.adjustmentFactors || [];
    if (Array.isArray(source) && source.length) {
      return source.map(function (item) {
        const name = item.name || item.factorName || item.label || "调节因子";
        return {
          name,
          value: item.value ?? item.inputValue ?? item.selectedTier ?? item.tierLabel ?? enterprise.factorInputs?.[name] ?? null,
          coefficient: Number(item.coefficient ?? item.factorCoefficient ?? item.adjustment ?? 0),
          state: item.state || item.applicability || (DATA.isNotApplicable(enterprise, name) ? "NOT_APPLICABLE" : "EXPLICIT_VALUE"),
          note: item.note || item.reason || ""
        };
      });
    }
    return Object.keys(DATA.FACTOR_INPUT_CHOICES).map(function (name) {
      const value = enterprise.factorInputs?.[name] ?? null;
      return {
        name,
        value,
        coefficient: null,
        state: DATA.isNotApplicable(enterprise, name) ? "NOT_APPLICABLE" : value == null || value === "" ? "DEFAULTED_ZERO" : "EXPLICIT_VALUE",
        note: "系数以 M01 评估结果为准"
      };
    });
  }

  function normalizeResult(result, index) {
    const enterpriseId = result.enterpriseId || result.enterprise?.enterpriseId || result.entityId || result.companyId || bundle.fixture.enterprises[index]?.enterpriseId;
    const sourceEnterprise = bundle.fixture.enterprises.find(function (item) { return item.enterpriseId === enterpriseId; }) || bundle.fixture.enterprises[index] || {};
    const enterprise = { ...sourceEnterprise, factorInputs: clone(state.factorInputs[enterpriseId] || sourceEnterprise.factorInputs || {}) };
    const finalScore = Number(result.finalScore ?? result.adjustedScore ?? result.riskScore ?? result.score);
    const rawScore = Number(result.rawScore ?? result.baseScore ?? result.originalScore);
    const factorSum = Number(result.factorSum ?? result.adjustmentSum ?? result.totalFactorCoefficient);
    const risk = DATA.riskKey(result.riskTierId || result.riskTier || result.riskLevel || result.level);
    const metrics = normalizeMetricDetails({ ...result, category: enterprise.category });
    const factors = normalizeFactorDetails(result, enterprise);
    const lowestMetrics = Array.isArray(result.lowestMetrics)
      ? result.lowestMetrics
      : Array.isArray(result.lowestThree)
        ? result.lowestThree
        : Array.isArray(result.keyRisks)
          ? result.keyRisks
          : metrics.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 3);
    return {
      enterpriseId: enterprise.enterpriseId,
      enterpriseName: enterprise.name,
      sector: enterprise.sector,
      category: enterprise.category,
      assessmentAt: result.assessmentAt || bundle.fixture.assessmentAt,
      rawScore: Number.isFinite(rawScore) ? rawScore : null,
      factorSum: Number.isFinite(factorSum) ? factorSum : null,
      finalScore: Number.isFinite(finalScore) ? finalScore : null,
      riskTier: risk,
      metrics,
      factors,
      lowestMetrics,
      candidateActions: clone(result.candidateActions || result.actionCandidates || result.dispositionCandidates || []),
      defaults: clone(result.defaults || result.defaultSemantics || []),
      report: clone(result.report || result.reportData || null),
      raw: clone(result)
    };
  }

  function normalizeRun(raw, context) {
    const results = resultArray(raw).map(normalizeResult);
    if (results.length !== bundle.fixture.enterpriseCount) {
      throw new Error(`M01 评估返回 ${results.length} 家企业，预期 ${bundle.fixture.enterpriseCount} 家；拒绝切换当前成功运行。`);
    }
    return {
      runId: context.scenarioRunId,
      scenarioContext: clone(context),
      assessmentAt: raw?.assessmentAt || bundle.fixture.assessmentAt,
      evaluatedAt: raw?.evaluatedAt || raw?.formedAt || new Date().toISOString(),
      status: "succeeded",
      modelVersion: raw?.modelIdentity?.packageVersion || state.publishedModel.packageVersion,
      publishedVersion: raw?.modelIdentity?.publishedVersion || state.publishedModel.packageVersion,
      inputSnapshotId: state.factorInputSnapshot?.snapshotId || bundle.humanInputSnapshot?.snapshotId,
      dataAssetId: raw?.dataIdentity?.dataVersion || bundle.formalDataAsset?.dataAssetId || bundle.formalDataAsset?.assetId || bundle.dataContract?.candidateResources?.formalCandidateDataAssetId,
      enterpriseResults: results,
      reportCount: results.length,
      raw: clone(raw)
    };
  }

  async function evaluate(context, options) {
    const config = options || {};
    set({ runStatus: "running", runError: null });
    try {
      const raw = await callEngine(context);
      const run = normalizeRun(raw, context);
      const existing = state.runHistory.filter(function (item) { return item.runId !== run.runId; });
      const history = [run, ...existing].slice(0, 20);
      set({
        context,
        activeRun: run,
        lastSuccessfulRun: run,
        runHistory: history,
        runStatus: "succeeded",
        runError: null,
        operationNotice: config.initial ? "已读取 M01 权威评估结果。" : `重评成功，形成新运行 ${DATA.shortId(run.runId)}。`
      });
      persist("m06", "runs/current", { activeRun: run, runHistory: history });
      return run;
    } catch (error) {
      const previous = state.lastSuccessfulRun || state.activeRun;
      set({
        activeRun: previous,
        runStatus: "failed",
        runError: error.message || String(error),
        operationNotice: previous ? "本次重评未切换成功运行，工作台继续展示上一成功运行。" : "尚无可展示的成功运行。"
      });
      return null;
    }
  }

  function setView(view, enterpriseId) {
    const next = view === "report" || DATA.VIEWS.some(function (item) { return item.id === view; }) ? view : "overview";
    set({ currentView: next, selectedEnterpriseId: enterpriseId || state.selectedEnterpriseId, mobileNavOpen: false });
  }

  function selectEnterprise(enterpriseId) {
    set({ selectedEnterpriseId: enterpriseId });
  }

  function setFilter(name, value) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return;
    set({ [name]: value });
  }

  function markFactorDraft() {
    set({ factorEntryStatus: "draft", factorEntryValidation: null }, true);
    persist("m02", "factor-inputs/current", { status: "draft", values: state.factorInputs, changedAt: new Date().toISOString() });
    emit();
  }

  function updateFactorInput(enterpriseId, factorName, value) {
    if (state.historicalView) return false;
    const next = clone(state.factorInputs);
    next[enterpriseId] = { ...(next[enterpriseId] || {}), [factorName]: value === "__MISSING__" ? null : value };
    state = { ...state, factorInputs: next };
    markFactorDraft();
    return true;
  }

  function validateFactorInputs() {
    const errors = [];
    bundle.fixture.enterprises.forEach(function (enterprise) {
      Object.entries(DATA.FACTOR_INPUT_CHOICES).forEach(function ([factorName, choices]) {
        const value = state.factorInputs[enterprise.enterpriseId]?.[factorName];
        if (DATA.isNotApplicable(enterprise, factorName)) return;
        if (value == null || value === "") return;
        if (!choices.includes(value)) errors.push(`${enterprise.name} · ${factorName} 的取值“${value}”不在允许枚举内`);
      });
    });
    const result = {
      ok: errors.length === 0,
      errors,
      defaultedZeroCount: bundle.fixture.enterprises.reduce(function (count, enterprise) {
        return count + Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (factorName) {
          const value = state.factorInputs[enterprise.enterpriseId]?.[factorName];
          return !DATA.isNotApplicable(enterprise, factorName) && (value == null || value === "");
        }).length;
      }, 0),
      notApplicableCount: bundle.fixture.enterprises.reduce(function (count, enterprise) {
        return count + Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (factorName) {
          return DATA.isNotApplicable(enterprise, factorName);
        }).length;
      }, 0),
      validatedAt: new Date().toISOString()
    };
    set({ factorEntryValidation: result, factorEntryStatus: result.ok ? "validated" : "draft" });
    return result;
  }

  function nextSnapshotVersion() {
    const current = String(state.factorInputSnapshot?.snapshotId || bundle.humanInputSnapshot?.snapshotId || "v0");
    const match = current.match(/-v(\d+)$/);
    return (match ? Number(match[1]) : 0) + 1;
  }

  function publishFactorInputs() {
    if (state.historicalView) throw new Error("历史快照只读，不能发布人工输入。");
    const validation = state.factorEntryValidation?.ok ? state.factorEntryValidation : validateFactorInputs();
    if (!validation.ok) throw new Error("企业因子校验未通过，不能发布输入快照。");
    const version = nextSnapshotVersion();
    const snapshot = {
      schemaVersion: "ofw.s003.t053.human-input-snapshot.ui-projection.v1",
      snapshotId: `S003-T053-INPUT-${String(bundle.fixture.assessmentAt).replaceAll("-", "")}-v${version}`,
      snapshotVersion: `1.0.${version - 1}`,
      status: "published-input",
      immutable: true,
      formedAt: new Date().toISOString(),
      owner: "M02 数据工程",
      businessOwner: "财务公司",
      reviewerRequired: false,
      assessmentAt: bundle.fixture.assessmentAt,
      enterpriseCount: bundle.fixture.enterpriseCount,
      factorCount: Object.keys(DATA.FACTOR_INPUT_CHOICES).length,
      projectionOnly: true,
      values: clone(state.factorInputs)
    };
    set({ factorInputSnapshot: snapshot, factorEntryStatus: "published", factorEntryValidation: validation });
    persist("m02", "factor-inputs/current", { status: "published", values: state.factorInputs, snapshot });
    return snapshot;
  }

  function markConfigDraft() {
    state.configDraft.changedAt = new Date().toISOString();
    state.configDraft.lifecycleStatus = "draft";
    set({ configStatus: "draft", configValidation: null }, true);
    persist("m01", "config/current", { configDraft: state.configDraft, publishedModel: state.publishedModel, status: "draft" });
    emit();
  }

  function updateWeight(category, index, value) {
    if (state.historicalView) return;
    state.configDraft.weights[category][Number(index)] = Number(value);
    markConfigDraft();
  }

  function updateFactorCoefficient(factorId, tierId, value) {
    if (state.historicalView) return;
    const factor = state.configDraft.factors.find(function (item) { return item.factorId === factorId; });
    const tier = factor?.tiers?.find(function (item) { return item.tierId === tierId; });
    if (!tier) return;
    tier.coefficient = Number(value);
    markConfigDraft();
  }

  function updateRiskThreshold(tierId, value) {
    if (state.historicalView) return;
    const tier = state.configDraft.riskTiers.find(function (item) { return item.tierId === tierId; });
    if (!tier || tierId === "BLACK") return;
    tier.minInclusive = Number(value);
    const byId = Object.fromEntries(state.configDraft.riskTiers.map(function (item) { return [item.tierId, item]; }));
    if (byId.GREEN) byId.GREEN.maxExclusive = null;
    if (byId.YELLOW && byId.GREEN) byId.YELLOW.maxExclusive = Number(byId.GREEN.minInclusive);
    if (byId.RED && byId.YELLOW) byId.RED.maxExclusive = Number(byId.YELLOW.minInclusive);
    if (byId.BLACK && byId.RED) {
      byId.BLACK.minInclusive = 0;
      byId.BLACK.maxExclusive = Number(byId.RED.minInclusive);
    }
    markConfigDraft();
  }

  function validateConfiguration() {
    const service = bundle?.configService || window.S003ConfigService;
    if (service?.markValidated) {
      const outcome = service.markValidated(canonicalConfigDraft(state.configDraft));
      const result = {
        ok: outcome.validation.ok,
        errors: outcome.validation.errors.map(function (error) { return `${error.message}（${error.code}）`; }),
        details: clone(outcome.validation.errors),
        validatedAt: new Date().toISOString()
      };
      const nextDraft = {
        ...state.configDraft,
        lifecycleStatus: outcome.draft.lifecycleStatus,
        validatedAt: outcome.draft.validatedAt || null
      };
      set({ configDraft: nextDraft, configValidation: result, configStatus: result.ok ? "validated" : "draft" });
      return result;
    }
    const errors = [];
    Object.entries(state.configDraft.weights).forEach(function ([category, weights]) {
      if (weights.some(function (value) { return !Number.isFinite(Number(value)) || Number(value) < 0; })) errors.push(`${category} 权重必须为非负数`);
      const total = weights.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      if (Math.abs(total - 100) > 0.0001) errors.push(`${category} 权重合计为 ${total}，必须等于 100`);
    });
    if (state.configDraft.factors.length !== 6) errors.push("一期固定六项调节因子，不允许新增或删除");
    state.configDraft.factors.forEach(function (factor) {
      factor.tiers.forEach(function (tier) {
        if (!Number.isFinite(Number(tier.coefficient)) || Number(tier.coefficient) < -1 || Number(tier.coefficient) > 1) {
          errors.push(`${factor.name} · ${tier.label} 的系数必须在 -1 至 1 之间`);
        }
      });
    });
    const fixed = ["GREEN", "YELLOW", "RED", "BLACK"];
    if (state.configDraft.riskTiers.length !== 4 || state.configDraft.riskTiers.some(function (tier, index) { return tier.tierId !== fixed[index]; })) {
      errors.push("一期固定绿、黄、红、黑四档及顺序，不允许新增、删除或改名");
    }
    const thresholds = Object.fromEntries(state.configDraft.riskTiers.map(function (tier) { return [tier.tierId, Number(tier.minInclusive)]; }));
    if (!(thresholds.GREEN > thresholds.YELLOW && thresholds.YELLOW > thresholds.RED && thresholds.RED > thresholds.BLACK && thresholds.BLACK === 0)) {
      errors.push("风险阈值必须满足：绿灯 > 黄灯 > 红灯 > 黑灯，且黑灯下限固定为 0");
    }
    const result = { ok: errors.length === 0, errors, validatedAt: new Date().toISOString() };
    set({ configValidation: result, configStatus: result.ok ? "validated" : "draft" });
    return result;
  }

  function incrementVersion(version) {
    const parts = String(version || "1.0.0").split(".").map(Number);
    return `${parts[0] || 1}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
  }

  function publishConfiguration() {
    if (state.historicalView) throw new Error("历史快照只读，不能发布模型配置。");
    const validation = state.configValidation?.ok ? state.configValidation : validateConfiguration();
    if (!validation.ok) throw new Error("配置校验未通过，不能切换 Published 指针。");
    const service = bundle?.configService || window.S003ConfigService;
    const publishedAt = new Date().toISOString();
    const published = service?.publishDraft
      ? clone(service.publishDraft({ ...canonicalConfigDraft(state.configDraft), lifecycleStatus: "validated", validatedAt: state.configDraft.validatedAt || publishedAt }, state.publishedModel, { publishedAt }))
      : {
          ...clone(state.publishedModel),
          packageVersion: incrementVersion(state.publishedModel.packageVersion),
          lifecycleStatus: "published",
          weights: clone(state.configDraft.weights),
          factors: clone(state.configDraft.factors),
          riskTiers: clone(state.configDraft.riskTiers)
        };
    published.publishedAt = publishedAt;
    published.businessOwner = "财务公司";
    published.moduleOwner = "本体管理";
    const draft = createConfigDraft(published);
    set({ publishedModel: published, configDraft: draft, configStatus: "published", configValidation: validation });
    persist("m01", "config/current", { configDraft: draft, publishedModel: published, status: "published" });
    return published;
  }

  function resetConfiguration() {
    if (state.historicalView) return;
    const draft = createConfigDraft(state.publishedModel);
    set({ configDraft: draft, configStatus: "published", configValidation: null });
    persist("m01", "config/current", { configDraft: draft, publishedModel: state.publishedModel, status: "published" });
  }

  async function quickRerun() {
    if (state.historicalView) throw new Error("历史快照只读，不能重评。");
    if (state.configStatus !== "published") throw new Error("配置仍为 Draft 或仅已校验；必须先发布模型版本再重评。");
    if (state.factorEntryStatus !== "published") throw new Error("企业因子输入尚未形成 Published 不可变快照。");
    const nextStatus = state.context.status === "regression" ? "regression" : "active";
    const context = FOUNDATION
      ? FOUNDATION.createScenarioContext({ scenarioId: state.context.scenarioId, scenarioVersion: state.context.scenarioVersion, status: nextStatus })
      : {
          scenarioId: state.context.scenarioId,
          scenarioVersion: state.context.scenarioVersion,
          scenarioRunId: `${state.context.scenarioId}-RUN-${Date.now()}-runtime`,
          formedAt: new Date().toISOString(),
          status: nextStatus
        };
    return evaluate(context, { initial: false, keepPrevious: true });
  }

  function runQuery(queryId) {
    const query = bundle.queryCatalog.queries.find(function (item) { return item.queryId === queryId; });
    if (!query) return null;
    const records = state.activeRun?.enterpriseResults || [];
    let answer;
    if (!records.length) {
      answer = { type: "empty", title: "尚无 Published 风险事实", body: "问数不会自行重算风险分。请先完成模型发布与成功运行。" };
    } else {
      const service = bundle.queryService || window.S003QueryService;
      if (service?.createQueryService && state.activeRun?.raw) {
        const runtime = service.createQueryService({
          scenarioContext: clone(state.context),
          portfolio: state.activeRun.raw,
          publicationStatus: "PUBLISHED"
        });
        const definition = service.QUERY_DEFINITIONS.find(function (item) { return item.queryId === queryId; });
        const parameters = definition?.requiresEnterpriseId ? { enterpriseId: state.selectedEnterpriseId || records[0]?.enterpriseId } : {};
        const output = runtime.execute(queryId, parameters);
        answer = { type: output.result.type, title: output.question, result: clone(output.result), source: clone(output.source), readOnly: true };
      } else if (queryId === "S003-QRY-001") {
        const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
        records.forEach(function (item) { if (counts[item.riskTier] !== undefined) counts[item.riskTier] += 1; });
        answer = { type: "risk-tier-distribution", title: query.question, result: { counts } };
      } else if (queryId === "S003-QRY-002") {
        answer = { type: "enterprise-list", title: query.question, result: { enterprises: records.filter(function (item) { return ["RED", "BLACK"].includes(item.riskTier); }) } };
      } else {
        answer = { type: "empty", title: "M03 查询服务不可用", body: "工作台不会回退为自行重算业务结论。" };
      }
    }
    set({ queryId, queryAnswer: answer });
    return answer;
  }

  function createDecisionRuntime() {
    const service = bundle?.decisionService || window.S003DecisionService;
    if (!service?.createDecisionService || !state.activeRun?.raw) return null;
    const sameRunRecords = state.decisions.filter(function (item) {
      return item.scenarioRunId === state.context.scenarioRunId;
    }).map(function (item) {
      return item.actionRequest ? item : { actionRequest: item, todo: item.todo || null };
    });
    const mode = state.historicalView ? "historical-readonly" : state.context.status === "regression" ? "regression" : state.context.status;
    return service.createDecisionService({
      scenarioContext: clone(state.context),
      c035Results: clone(state.activeRun.raw),
      publicationStatus: "PUBLISHED",
      existingRecords: sameRunRecords,
      mode
    });
  }

  function listDecisionCandidates() {
    const runtime = createDecisionRuntime();
    return runtime ? clone(runtime.listCandidates()) : [];
  }

  function candidateFor(enterpriseId) {
    const candidates = listDecisionCandidates().filter(function (candidate) { return candidate.enterpriseId === enterpriseId; });
    if (!candidates.length) return null;
    const confirmed = state.decisions.find(function (item) {
      return item.scenarioRunId === state.context.scenarioRunId && item.enterpriseId === enterpriseId;
    });
    return candidates.find(function (candidate) { return candidate.actionTypeId === confirmed?.actionTypeId; })
      || candidates.find(function (candidate) { return candidate.trigger?.type === "RISK_TIER"; })
      || candidates[0];
  }

  function openDecision(reference) {
    const candidates = listDecisionCandidates();
    const candidate = candidates.find(function (item) { return item.candidateId === reference || item.idempotencyKey === reference; })
      || candidateFor(reference);
    if (!candidate) throw new Error("该企业当前未命中处置候选，不创建 Action Request。");
    set({ pendingDecision: candidate });
    return candidate;
  }

  function closeDecision() {
    set({ pendingDecision: null });
  }

  function confirmDecision(input) {
    if (state.historicalView) throw new Error("历史快照或隔离查看不得重放 Action Request。");
    const candidate = state.pendingDecision;
    if (!candidate) throw new Error("没有待确认的处置候选。");
    if (!input?.confirmed) throw new Error("请先确认已核对企业、风险等级、Action Type 与负责人。");
    const runtime = createDecisionRuntime();
    if (!runtime) throw new Error("M04 通用决策服务不可用，拒绝创建 Action Request。");
    const receipt = runtime.confirmCandidate(candidate.candidateId, {
      confirmed: true,
      owner: input.owner || "集团债务风险负责人",
      note: input.note || "",
      confirmedAt: new Date().toISOString()
    });
    const item = normalizeDecisionRecord(receipt);
    const decisions = [item, ...state.decisions.filter(function (record) { return record.idempotencyKey !== item.idempotencyKey; })];
    set({ decisions, pendingDecision: null });
    persist("m04", "action-requests/current", { items: decisions });
    return item;
  }

  function viewCheckpoint(code) {
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    const view = FOUNDATION ? FOUNDATION.createHistoricalView(entry.manifest) : {
      mode: "historical-view", readOnly: true, context: entry.manifest.scenarioContext, sourceCheckpointId: entry.manifest.checkpointId
    };
    set({ historicalView: { ...view, checkpoint: entry.manifest, code }, operationNotice: `${code} 已以原 scenarioRunId 只读打开。` });
    return view;
  }

  function exitHistoricalView() {
    set({ historicalView: null, operationNotice: "已返回当前运行投影。" });
  }

  function cloneRestore(code) {
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    if (!FOUNDATION) throw new Error("C034 公共恢复底座不可用。");
    const operation = FOUNDATION.cloneRestore(entry.manifest);
    set({
      context: operation.context,
      historicalView: null,
      activeRun: null,
      runStatus: "idle",
      operationNotice: `已从 ${code} 克隆恢复为新运行 ${DATA.shortId(operation.context.scenarioRunId)}；未覆盖历史、未重放副作用。`
    });
    return operation;
  }

  function isolatedRegression(code) {
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    if (!FOUNDATION) throw new Error("C034 公共回归底座不可用。");
    const operation = FOUNDATION.createIsolatedRegression(entry.manifest);
    set({
      context: operation.context,
      historicalView: null,
      activeRun: null,
      runStatus: "idle",
      operationNotice: `已创建 ${code} 隔离回归运行；历史 Action Request、通知、审批和待办不会重放。`
    });
    return operation;
  }

  function toggleNav() {
    set({ navCollapsed: !state.navCollapsed, mobileNavOpen: false });
  }

  function toggleMobileNav() {
    set({ mobileNavOpen: !state.mobileNavOpen });
  }

  window.S003Store = Object.freeze({
    bootstrap,
    subscribe,
    getState,
    getBundle,
    setView,
    selectEnterprise,
    setFilter,
    updateFactorInput,
    validateFactorInputs,
    publishFactorInputs,
    updateWeight,
    updateFactorCoefficient,
    updateRiskThreshold,
    validateConfiguration,
    publishConfiguration,
    resetConfiguration,
    quickRerun,
    runQuery,
    listDecisionCandidates,
    candidateFor,
    openDecision,
    closeDecision,
    confirmDecision,
    viewCheckpoint,
    exitHistoricalView,
    cloneRestore,
    isolatedRegression,
    toggleNav,
    toggleMobileNav
  });
})();
