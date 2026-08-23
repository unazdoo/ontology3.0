const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FOUNDATION_SOURCE = fs.readFileSync(path.resolve(ROOT, "../../foundation/ofw-scenario-foundation.js"), "utf8");
const STATE_SOURCE = fs.readFileSync(path.resolve(ROOT, "state.js"), "utf8");

const STATIC_CONTEXT = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260815133000000-c03503000001",
  formedAt: "2026-08-15T13:30:00.000Z",
  status: "active"
});

class MemoryStorage {
  constructor(entries) {
    this.items = new Map(entries || []);
    this.writeCount = 0;
    this.failAtWrite = null;
  }

  get length() {
    return this.items.size;
  }

  key(index) {
    return Array.from(this.items.keys())[index] ?? null;
  }

  getItem(key) {
    return this.items.has(String(key)) ? this.items.get(String(key)) : null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    if (this.failAtWrite === this.writeCount) {
      const error = new Error("QuotaExceededError: test storage quota");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.items.set(String(key), String(value));
  }

  removeItem(key) {
    this.items.delete(String(key));
  }

  failOnNthNextWrite(offset) {
    this.failAtWrite = this.writeCount + offset;
  }

  entries() {
    return Array.from(this.items.entries());
  }

  clone() {
    return new MemoryStorage(this.entries());
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function factorValues() {
  return {
    "S003-ENT-001": { "融资能力": "一般" },
    "S003-ENT-002": { "融资能力": "良好" }
  };
}

function createModel(version = "1.0.1") {
  const indicatorOrder = Array.from({ length: 15 }, (_, index) => `指标${String(index + 1).padStart(2, "0")}`);
  const categoryWeights = [100, ...Array(14).fill(0)];
  const factors = Array.from({ length: 6 }, (_, index) => ({
    factorId: `factor-${index + 1}`,
    name: `调节因子${index + 1}`,
    tiers: [{ tierId: "A", label: "A 档", coefficient: 0 }]
  }));
  return {
    schemaVersion: "ofw.s003.model-package.v1",
    packageId: "S003-M01-DEBT-RISK-PKG",
    packageVersion: version,
    lifecycleStatus: "published",
    businessOwner: "财务公司",
    resourceType: "RiskModel",
    weights: {
      "新能源产业-风电": categoryWeights,
      "核电": categoryWeights,
      "环保": categoryWeights
    },
    factors,
    riskTiers: [
      { tierId: "GREEN", name: "绿灯", minInclusive: 40, maxExclusive: null },
      { tierId: "YELLOW", name: "黄灯", minInclusive: 25, maxExclusive: 40 },
      { tierId: "RED", name: "红灯", minInclusive: 10, maxExclusive: 25 },
      { tierId: "BLACK", name: "黑灯", minInclusive: 0, maxExclusive: 10 }
    ],
    indicatorOrder,
    assessment: { assessmentAt: "2025-12-31" },
    publishedAt: "2026-08-15T13:30:00.000Z"
  };
}

function createInputSnapshot(sequence = 1) {
  return {
    schemaVersion: "ofw.s003.t053.human-input-snapshot.v1",
    snapshotId: `S003-T053-INPUT-20251231-v${sequence}`,
    snapshotVersion: `1.0.${sequence - 1}`,
    status: "published-input",
    immutable: true,
    formedAt: "2026-08-15T13:04:23.000Z",
    owner: "M02 数据工程",
    businessOwner: "财务公司",
    assessmentAt: "2025-12-31",
    enterpriseCount: 2,
    factorCount: 1,
    values: factorValues()
  };
}

function createResults(context, modelVersion = "1.0.1") {
  return {
    schemaVersion: "ofw.s003.c035-results.v1",
    status: "PUBLISHED-RESULTS",
    immutable: true,
    scenarioIdentity: clone(context),
    assessmentAt: "2025-12-31",
    evaluatedAt: "2026-08-15T13:31:00.000Z",
    modelIdentity: { packageVersion: modelVersion, publishedVersion: modelVersion },
    dataIdentity: { dataVersion: "S003-T007-DATA-v1" },
    results: [
      { enterpriseId: "S003-ENT-001", rawScore: 80, factorSum: 0, finalScore: 80, riskTier: "GREEN", indicatorDetails: [], factorDetails: [] },
      { enterpriseId: "S003-ENT-002", rawScore: 60, factorSum: 0, finalScore: 60, riskTier: "YELLOW", indicatorDetails: [], factorDetails: [] }
    ]
  };
}

function createModuleRestoreRefs(sourceScenarioRunId = STATIC_CONTEXT.scenarioRunId) {
  return Object.fromEntries(["M01", "M02", "M03", "M04", "M05", "M06"].map((moduleId) => [moduleId, {
    exportId: `S003-${moduleId}-TEST-EXPORT`,
    exportRef: `resources/${moduleId.toLowerCase()}/test-export.json`,
    exportSha256: "a".repeat(64),
    sourceScenarioRunId
  }]));
}

function runtimeLineage(overrides = {}) {
  return {
    operationId: overrides.operationId || "OP-S003-20260815193000000-010203040506",
    operationMode: overrides.operationMode || "runtime-evaluation",
    sourceCheckpointId: Object.prototype.hasOwnProperty.call(overrides, "sourceCheckpointId") ? overrides.sourceCheckpointId : null,
    sourceScenarioRunId: Object.prototype.hasOwnProperty.call(overrides, "sourceScenarioRunId") ? overrides.sourceScenarioRunId : null,
    moduleRestoreReferences: overrides.moduleRestoreReferences || createModuleRestoreRefs(overrides.sourceScenarioRunId || STATIC_CONTEXT.scenarioRunId)
  };
}

function createBundle(trackers) {
  const model = createModel();
  const inputSnapshot = createInputSnapshot();
  const fixture = {
    fixtureId: "S003-FIXTURE-TEST",
    assessmentAt: "2025-12-31",
    currency: "CNY",
    amountUnit: "万元",
    enterpriseCount: 2,
    enterprises: [
      { enterpriseId: "S003-ENT-001", name: "测试企业一", sector: "风电", category: "新能源产业-风电", factorInputs: factorValues()["S003-ENT-001"] },
      { enterpriseId: "S003-ENT-002", name: "测试企业二", sector: "风电", category: "新能源产业-风电", factorInputs: factorValues()["S003-ENT-002"] }
    ]
  };
  const checkpointValidationAt = "2026-08-15T13:00:00.000Z";
  const checkpointModules = Object.fromEntries(["M01", "M02", "M03", "M04", "M05", "M06"].map((moduleId) => [moduleId, {
    moduleId,
    moduleVersion: "1.0.0",
    exportId: `S003-${moduleId}-TEST-EXPORT`,
    exportRef: `resources/${moduleId.toLowerCase()}/test-export.json`,
    exportSha256: "a".repeat(64),
    validation: {
      status: "verified",
      validatedAt: checkpointValidationAt,
      evidenceRef: "evidence/CP01.md"
    },
    restoreMode: "isolated-clone"
  }]));
  const checkpointStateSections = Object.fromEntries([
    "data",
    "semantics",
    "configurations",
    "results",
    "reports",
    "decisions",
    "testFixtures",
    "featureFlags",
    "evidence"
  ].map((name) => [name, {
    status: "empty",
    reason: "测试夹具仅验证 C034 运行编排；具体状态由 checkpointProjection 测试替身提供。",
    items: []
  }]));
  const checkpointManifest = {
    schemaVersion: "ofw.c034.checkpoint.v1",
    checkpointId: "CP-S003-20260815130000000-c03501000001",
    checkpointNode: "e2e-integrated",
    baselineVersion: "1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    parentVersion: "1.0.3",
    scenarioContext: clone(STATIC_CONTEXT),
    sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId,
    createdAt: checkpointValidationAt,
    immutable: true,
    code: {
      prototypeVersion: "1.1.0",
      buildVersion: "S003-STATE-PERSISTENCE-TEST",
      entryRef: "runtime/test-entry.html",
      treeSha256: "b".repeat(64)
    },
    modules: checkpointModules,
    stateSections: checkpointStateSections,
    restoreReadiness: {
      status: "verified",
      verifiedAt: checkpointValidationAt,
      evidenceRef: "evidence/CP01.md"
    },
    sideEffectPolicy: {
      allowHistoricalActionRequestReplay: false,
      allowHistoricalNotificationReplay: false,
      allowHistoricalApprovalReplay: false,
      allowHistoricalTodoReplay: false,
      allowExternalDispatch: false
    }
  };
  const pendingActionRequest = {
    schemaVersion: "ofw.s003.m04.action-request.v1",
    actionRequestId: "AR-S003-TEST-PENDING",
    contractCode: "C011",
    status: "awaiting-member-unit-confirmation",
    scenarioIdentity: clone(STATIC_CONTEXT),
    enterpriseId: "S003-ENT-001",
    enterpriseName: "测试企业一",
    actionTypeId: "S003-ACTION-RISK-REVIEW",
    candidateId: `S003-CAND-${STATIC_CONTEXT.scenarioRunId}-001`,
    sourceCandidateId: `S003-CAND-${STATIC_CONTEXT.scenarioRunId}-001`,
    assessmentAt: "2025-12-31",
    resultVersion: "1.0.0",
    idempotencyKey: `${STATIC_CONTEXT.scenarioRunId}|S003-ENT-001|S003-ACTION-RISK-REVIEW|2025-12-31|1.0.0`,
    confirmed: false,
    owner: null,
    ownerId: null,
    todoId: null,
    decisionRecipient: {
      recipientId: "S003-CONTACT-001",
      recipientName: "测试企业一债务风险接口人",
      role: "成员单位债务风险接口人"
    }
  };
  const confirmedActionRequest = {
    schemaVersion: "ofw.s003.m04.action-request.v1",
    actionRequestId: "AR-S003-TEST-CONFIRMED",
    contractCode: "C011",
    status: "confirmed-to-owner-todo",
    scenarioIdentity: clone(STATIC_CONTEXT),
    enterpriseId: "S003-ENT-002",
    enterpriseName: "测试企业二",
    actionTypeId: "S003-ACTION-RISK-REVIEW",
    candidateId: `S003-CAND-${STATIC_CONTEXT.scenarioRunId}-002`,
    sourceCandidateId: `S003-CAND-${STATIC_CONTEXT.scenarioRunId}-002`,
    assessmentAt: "2025-12-31",
    resultVersion: "1.0.0",
    idempotencyKey: `${STATIC_CONTEXT.scenarioRunId}|S003-ENT-002|S003-ACTION-RISK-REVIEW|2025-12-31|1.0.0`,
    confirmed: true,
    confirmedBy: "测试企业二债务风险接口人",
    owner: "测试企业二风险处置负责人",
    ownerId: "S003-OWNER-002",
    todoId: "TODO-S003-TEST-CONFIRMED",
    decisionRecipient: {
      recipientId: "S003-CONTACT-002",
      recipientName: "测试企业二债务风险接口人",
      role: "成员单位债务风险接口人"
    }
  };
  function nextOperationContext(status) {
    trackers.runSequence += 1;
    const milliseconds = String(trackers.runSequence).padStart(3, "0");
    const nonce = `aabbccdd${trackers.runSequence.toString(16).padStart(4, "0")}`;
    const context = {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: `S003-RUN-20260815190000${milliseconds}-${nonce}`,
      formedAt: `2026-08-15T19:00:00.${milliseconds}Z`,
      status
    };
    trackers.lastAttemptedContext = clone(context);
    return context;
  }
  return {
    manifest: { scenario: { ...clone(STATIC_CONTEXT), initialScenarioRunId: STATIC_CONTEXT.scenarioRunId } },
    fixture,
    model,
    baseModel: clone(model),
    publishedPointer: { pointerId: "S003-M01-PUBLISHED-POINTER", activeTarget: { packageId: model.packageId, packageVersion: model.packageVersion } },
    publishedFacts: { schemaVersion: "ofw.s003.published-debt-risk-facts.v1", status: "PUBLISHED", immutable: true, scenarioIdentity: clone(STATIC_CONTEXT), facts: [] },
    humanInputSnapshot: inputSnapshot,
    c035Results: createResults(STATIC_CONTEXT),
    formalDataAsset: { dataAssetId: "S003-T007-DATA-v1" },
    agentPosition: { resourceId: "S003-M05-NO-DEDICATED-AGENT", status: "PUBLISHED" },
    reportManifest: { manifestId: "S003-M06-REPORT-MANIFEST-TEST", scenarioIdentity: clone(STATIC_CONTEXT), reportCount: 2 },
    dataContract: { candidateResources: { formalCandidateDataAssetId: "S003-T007-DATA-v1" } },
    checkpoints: [{
      code: "CP01",
      manifest: checkpointManifest
    }],
    queryCatalog: { queries: [{ queryId: "S003-QRY-001", question: "风险分布" }] },
    queryService: {
      QUERY_DEFINITIONS: [{ queryId: "S003-QRY-001", requiresEnterpriseId: false }],
      createQueryService(input) {
        trackers.queryCalls.push({
          publicationStatus: input.publicationStatus,
          scenarioContext: clone(input.scenarioContext),
          scenarioIdentity: clone(input.portfolio?.scenarioIdentity)
        });
        return {
          execute() {
            return {
              question: "风险分布",
              result: { type: "risk-tier-distribution", counts: { GREEN: 1, YELLOW: 1, RED: 0, BLACK: 0 } },
              source: { publicationStatus: input.publicationStatus, scenarioIdentity: clone(input.portfolio.scenarioIdentity) }
            };
          }
        };
      }
    },
    decisionService: {
      createDecisionService(input) {
        trackers.decisionRuntimeCreations += 1;
        const candidate = {
          candidateId: `S003-CAND-${input.scenarioContext.scenarioRunId}-001`,
          idempotencyKey: `S003-IDEMP-${input.scenarioContext.scenarioRunId}-001`,
          enterpriseId: "S003-ENT-001",
          actionTypeId: "S003-ACTION-RISK-REVIEW",
          trigger: { type: "RISK_TIER" }
        };
        return {
          listCandidates() {
            return [candidate];
          },
          confirmCandidate(candidateId) {
            trackers.decisionConfirmations += 1;
            return {
              actionRequest: {
                actionRequestId: `S003-AR-${input.scenarioContext.scenarioRunId}-001`,
                idempotencyKey: candidate.idempotencyKey,
                scenarioIdentity: clone(input.scenarioContext),
                enterpriseId: candidate.enterpriseId,
                actionTypeId: candidate.actionTypeId,
                candidateId
              },
              todo: { owner: "集团债务风险负责人" },
              idempotencyKey: candidate.idempotencyKey,
              created: true
            };
          }
        };
      }
    },
    decisionInbox: { requests: [pendingActionRequest] },
    decisionResults: {
      confirmations: [{
        idempotencyKey: confirmedActionRequest.idempotencyKey,
        actionRequest: confirmedActionRequest,
        todo: {
          todoId: confirmedActionRequest.todoId,
          actionRequestId: confirmedActionRequest.actionRequestId,
          status: "pending",
          owner: confirmedActionRequest.owner,
          ownerId: confirmedActionRequest.ownerId
        }
      }]
    },
    checkpointProjection: {
      resolveCheckpointProjection() {
        return {
          exact: true,
          restoreMode: "full",
          restorable: true,
          hasPublished: true,
          runnable: true,
          issues: [],
          sourceContext: clone(STATIC_CONTEXT),
          fixture: clone(fixture),
          model: clone(model),
          inputSnapshot: clone(inputSnapshot),
          c035Results: createResults(STATIC_CONTEXT),
          decisionResults: { confirmations: [] },
          reportCount: 2,
          evidenceRefs: ["evidence/CP01.md"],
          moduleVersions: {},
          sectionRefs: {},
          data: { formalDataAsset: { dataAssetId: "S003-T007-DATA-v1" }, qualityResult: null }
        };
      }
    },
    checkpointService: {
      createCheckpointService(input) {
        trackers.checkpointRuntimeCreations += 1;
        let lastSuccessful = input.lastSuccessfulRun || null;
        return {
          getLastSuccessfulRun() {
            return lastSuccessful;
          },
          beginRerun(request) {
            return {
              operationId: request.operationId,
              mode: "rerun",
              sourceScenarioRunId: request.sourceScenarioRunId,
              context: nextOperationContext("active")
            };
          },
          cloneRestore(request) {
            return {
              operationId: request.operationId,
              mode: "clone-restore",
              sourceCheckpointId: checkpointManifest.checkpointId,
              sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId,
              moduleRestoreRefs: createModuleRestoreRefs(),
              context: nextOperationContext("restored")
            };
          },
          createRegression(request) {
            return {
              operationId: request.operationId,
              mode: "isolated-regression",
              sourceCheckpointId: checkpointManifest.checkpointId,
              sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId,
              context: nextOperationContext("regression")
            };
          },
          viewHistorical(request) {
            return {
              operationId: request.operationId,
              mode: "historical-view",
              context: { ...clone(STATIC_CONTEXT), status: "historical-readonly" },
              sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId
            };
          },
          completeRunAttempt(inputValue) {
            if (inputValue.status === "succeeded" && trackers.failSuccessfulCompletion) {
              throw new Error("test C034 completion failure");
            }
            trackers.completions.push(clone(inputValue));
          }
        };
      }
    },
    engine: {
      async evaluatePortfolio(payload) {
        trackers.engineCalls += 1;
        return createResults(payload.scenarioContext, payload.model.packageVersion);
      }
    }
  };
}

async function createRuntime(options = {}) {
  const storage = options.storage || new MemoryStorage();
  const trackers = {
    checkpointRuntimeCreations: 0,
    runSequence: 0,
    engineCalls: 0,
    queryCalls: [],
    decisionRuntimeCreations: 0,
    decisionConfirmations: 0,
    completions: [],
    lastAttemptedContext: null,
    failSuccessfulCompletion: Boolean(options.failSuccessfulCompletion),
    foundation: null
  };
  const location = {
    href: options.href || "http://localhost/s003/#overview",
    hash: (options.href || "http://localhost/s003/#overview").split("#")[1] ? `#${(options.href || "").split("#")[1]}` : ""
  };
  const sandbox = {
    console,
    URL,
    Date,
    Uint8Array,
    localStorage: storage,
    location,
    crypto: {
      getRandomValues(bytes) {
        bytes.fill(7);
        return bytes;
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FOUNDATION_SOURCE, sandbox, { filename: "ofw-scenario-foundation.js" });
  trackers.foundation = sandbox.OFWScenarioFoundation;
  const bundle = createBundle(trackers);
  sandbox.__checkpointManifestJson = JSON.stringify(bundle.checkpoints[0].manifest);
  bundle.checkpoints[0].manifest = vm.runInContext("JSON.parse(__checkpointManifestJson)", sandbox);
  delete sandbox.__checkpointManifestJson;
  sandbox.S003Data = {
    VIEWS: [
      { id: "overview" }, { id: "runs" }, { id: "factor-entry" }, { id: "configuration" },
      { id: "enterprises" }, { id: "checkpoints" }, { id: "query-decision" }, { id: "agent-boundary" }
    ],
    MODULES: ["M01", "M02", "M03", "M04", "M05", "M06"].map((id) => ({ id })),
    FACTOR_INPUT_CHOICES: { "融资能力": ["一般", "良好"] },
    isNotApplicable() { return false; },
    riskKey(value) { return String(value || "GREEN").toUpperCase(); },
    shortId(value) { return String(value || "").slice(-12); },
    async load() { return bundle; }
  };
  vm.runInContext(STATE_SOURCE, sandbox, { filename: "state.js" });
  await sandbox.S003Store.bootstrap();
  return { sandbox, store: sandbox.S003Store, storage, trackers, bundle };
}

function runtimeHref(runId, view = "runs") {
  return `http://localhost/s003/?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=${runId}&prototypeVersion=1.1.0#${view}`;
}

function findStorageKey(storage, fragment) {
  const key = storage.entries().map(([entry]) => entry).find((entry) => entry.includes(fragment));
  assert.ok(key, `missing storage key containing ${fragment}`);
  return key;
}

function readEnvelope(storage, key) {
  return JSON.parse(storage.getItem(key));
}

function writeEnvelope(storage, key, envelope) {
  storage.items.set(key, JSON.stringify(envelope));
}

function namespacedAdapter(runtime, context, scope) {
  runtime.sandbox.__statePersistenceContext = JSON.stringify(context);
  runtime.sandbox.__statePersistenceScope = scope;
  const adapter = vm.runInContext(
    "OFWScenarioFoundation.createNamespacedStorage({ storage: localStorage, context: JSON.parse(__statePersistenceContext), scope: __statePersistenceScope })",
    runtime.sandbox
  );
  delete runtime.sandbox.__statePersistenceContext;
  delete runtime.sandbox.__statePersistenceScope;
  return adapter;
}

test("企业因子修改只进入 M02 T053 Draft，发布不改写 M01 模型定义", async () => {
  const first = await createRuntime();
  assert.equal(first.store.getState().factorInputs["S003-ENT-001"]["融资能力"], factorValues()["S003-ENT-001"]["融资能力"]);
  assert.equal(Object.prototype.hasOwnProperty.call(first.store.getState().configDraft, "factorInputs"), false);
  first.store.updateFactorInput("S003-ENT-001", "融资能力", "良好");
  const inputKey = findStorageKey(first.storage, ":m02:factor-inputs%2Fcurrent");
  const draftEnvelope = readEnvelope(first.storage, inputKey);
  assert.equal(draftEnvelope.payload.status, "draft");
  assert.equal(draftEnvelope.payload.values["S003-ENT-001"]["融资能力"], "良好");
  assert.equal(draftEnvelope.payload.snapshot.snapshotId, "S003-T053-INPUT-20251231-v1");

  const second = await createRuntime({ storage: first.storage });
  assert.equal(second.store.getState().factorEntryStatus, "draft");
  assert.equal(second.store.getState().factorInputSnapshot.snapshotId, "S003-T053-INPUT-20251231-v1");
  const v2 = second.store.publishFactorInputs();
  assert.equal(v2.snapshotId, "S003-T053-INPUT-20251231-v2");
  assert.equal(v2.owner, "M02 数据工程");
  assert.equal(second.store.getState().publishedModel.packageVersion, "1.0.1");
  assert.equal(Object.prototype.hasOwnProperty.call(second.store.getState().publishedModel, "enterpriseFactorInputs"), false);
  second.store.updateFactorInput("S003-ENT-001", "融资能力", "一般");

  const third = await createRuntime({ storage: second.storage });
  assert.equal(third.store.getState().factorInputSnapshot.snapshotId, "S003-T053-INPUT-20251231-v2");
  const v3 = third.store.publishFactorInputs();
  assert.equal(v3.snapshotId, "S003-T053-INPUT-20251231-v3");
  assert.equal(third.storage.entries().some(([key]) => key.includes(":m02:factor-inputs%2Fcurrent")), true);
});

test("bootstrap 在重新进入或早退前清空跨运行临时 UI，并重建 C034 runtime", async () => {
  const runtime = await createRuntime();
  runtime.store.setFilter("enterpriseSearch", "旧企业");
  runtime.store.runQuery("S003-QRY-001");
  assert.ok(runtime.store.getState().queryAnswer);
  assert.equal(runtime.trackers.checkpointRuntimeCreations, 1);

  runtime.sandbox.location.href = runtimeHref("S003-RUN-20260815195959999-deadbeef0001");
  runtime.sandbox.location.hash = "#runs";
  await runtime.store.bootstrap();
  const state = runtime.store.getState();
  assert.equal(state.ready, false);
  assert.equal(state.activeRun, null);
  assert.equal(state.lastSuccessfulRun, null);
  assert.equal(state.queryId, null);
  assert.equal(state.queryAnswer, null);
  assert.equal(state.enterpriseSearch, "");
  assert.equal(state.historicalView, null);
});

test("仅有 C011 的待接口人确认记录不得进入已形成负责人待办集合", async () => {
  const runtime = await createRuntime();
  const state = runtime.store.getState();
  assert.equal(state.actionRequests.length, 2, "全部 C011 应进入行动申请集合");
  assert.equal(state.decisions.length, 1, "只有带 todo 的成员单位确认记录才进入已处理集合");

  const pending = state.actionRequests.find((item) => item.actionRequest?.actionRequestId === "AR-S003-TEST-PENDING");
  assert.ok(pending);
  assert.equal(pending.stage, "submitted");
  assert.equal(pending.actionRequest.owner, null);
  assert.equal(pending.actionRequest.todoId, null);
  assert.equal(pending.todo, null);
  assert.equal(state.decisions.some((item) => item.idempotencyKey === pending.idempotencyKey), false);

  const confirmed = state.decisions[0];
  assert.equal(confirmed.stage, "confirmed");
  assert.equal(confirmed.actionRequest.actionRequestId, "AR-S003-TEST-CONFIRMED");
  assert.equal(confirmed.actionRequest.owner, "测试企业二风险处置负责人");
  assert.equal(confirmed.todo.todoId, "TODO-S003-TEST-CONFIRMED");

  const candidate = runtime.store.listDecisionCandidates()[0];
  const opened = runtime.store.openDecision(candidate.candidateId);
  assert.equal(opened.decisionStage, "submitted", "仅有 C011 的候选打开时仍应显示待接口人确认");
  assert.equal(opened.todo, null);
});

test("有效动态投影可刷新，且模型、输入和企业结果保持同一运行身份", async () => {
  const first = await createRuntime();
  const run = await first.store.quickRerun();
  assert.ok(run, first.store.getState().runError);
  assert.equal(run.refreshable, true);
  const reloaded = await createRuntime({ storage: first.storage, href: runtimeHref(run.runId) });
  const state = reloaded.store.getState();
  assert.equal(state.ready, true);
  assert.equal(state.activeRun.runId, run.runId);
  assert.equal(state.activeRun.modelVersion, state.publishedModel.packageVersion);
  assert.equal(state.activeRun.inputSnapshotId, state.factorInputSnapshot.snapshotId);
  assert.deepEqual(Array.from(state.activeRun.enterpriseResults, (item) => item.enterpriseId).sort(), ["S003-ENT-001", "S003-ENT-002"]);
  assert.equal(state.lastSuccessfulRun.runId, STATIC_CONTEXT.scenarioRunId);
  assert.equal(state.activeRun.authorityMode, "published-runtime");
  assert.equal(state.activeRun.projectionOnly, true);
  assert.equal(reloaded.trackers.engineCalls, 0, "刷新只恢复已校验投影，不重新评估");
});

test("连续重跑后上一运行保留逐户评分和只读报告绑定", async () => {
  const runtime = await createRuntime();
  const firstRun = await runtime.store.quickRerun();
  assert.ok(firstRun, runtime.store.getState().runError);
  const secondRun = await runtime.store.quickRerun();
  assert.ok(secondRun, runtime.store.getState().runError);
  assert.notEqual(secondRun.runId, firstRun.runId);

  const reloaded = await createRuntime({ storage: runtime.storage, href: runtimeHref(secondRun.runId) });
  const historical = reloaded.store.getState().runHistory.find((item) => item.runId === firstRun.runId);
  assert.ok(historical, "上一运行应进入历史列表");
  assert.equal(historical.detailAvailable, true);
  assert.equal(historical.enterpriseResults.length, 2);
  assert.equal(historical.reportBindings.length, 2);
  assert.deepEqual(Array.from(historical.enterpriseResults, (item) => item.enterpriseId).sort(), ["S003-ENT-001", "S003-ENT-002"]);
  assert.ok(historical.reportBindings.every((item) => item.reportId && item.scenarioRunId === firstRun.runId));
  assert.equal(historical.reportBindings.some((item) => item.scenarioRunId === secondRun.runId), false);
});

test("真实评分引擎的三元 scenarioIdentity 可形成完整浏览器工作投影", async () => {
  const runtime = await createRuntime();
  runtime.bundle.engine.evaluatePortfolio = async (payload) => {
    const raw = createResults(payload.scenarioContext, payload.model.packageVersion);
    raw.scenarioIdentity = {
      scenarioId: payload.scenarioContext.scenarioId,
      scenarioVersion: payload.scenarioContext.scenarioVersion,
      scenarioRunId: payload.scenarioContext.scenarioRunId
    };
    return raw;
  };
  const run = await runtime.store.quickRerun();
  assert.ok(run, runtime.store.getState().runError);
  assert.equal(run.raw.scenarioIdentity.formedAt, run.scenarioContext.formedAt);
  assert.equal(run.raw.scenarioIdentity.status, run.scenarioContext.status);
  assert.equal(run.scenarioContext.scenarioRunId, run.raw.scenarioIdentity.scenarioRunId);
  assert.equal(run.authorityMode, "published-runtime");
  assert.equal(run.projectionOnly, true);
});

test("M03/M04 只消费正式 Published 证据，工作投影候选、打开与确认均 fail-closed", async () => {
  const runtime = await createRuntime();
  const formalAnswer = runtime.store.runQuery("S003-QRY-001");
  assert.equal(formalAnswer.type, "risk-tier-distribution");
  assert.equal(runtime.trackers.queryCalls.length, 1);
  assert.equal(runtime.trackers.queryCalls[0].publicationStatus, "PUBLISHED");

  const formalCandidates = runtime.store.listDecisionCandidates();
  assert.equal(formalCandidates.length, 1);
  runtime.store.openDecision(formalCandidates[0].candidateId);
  runtime.store.closeDecision();

  const projection = await runtime.store.quickRerun();
  assert.ok(projection, runtime.store.getState().runError);
  const blocked = runtime.store.runQuery("S003-QRY-001");
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.authorityMode, "published-runtime");
  assert.equal(runtime.trackers.queryCalls.length, 1, "工作投影不得以 PUBLISHED 调用 M03 服务");
  assert.equal(runtime.store.listDecisionCandidates().length, 0);
  assert.throws(() => runtime.store.openDecision("S003-ENT-001"), /工作投影|Published 证据/);
  assert.throws(() => runtime.store.confirmDecision({ confirmed: true }), /工作投影|Published 证据/);
  assert.equal(runtime.trackers.decisionConfirmations, 0);
});

test("精确历史 Published 证据可只读问数，但不得重放 Action Request", async () => {
  const runtime = await createRuntime();
  runtime.store.viewCheckpoint("CP01");
  const answer = runtime.store.runQuery("S003-QRY-001");
  assert.equal(answer.type, "risk-tier-distribution");
  assert.equal(runtime.trackers.queryCalls.length, 1);
  assert.equal(runtime.trackers.queryCalls[0].scenarioContext.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
  const candidates = runtime.store.listDecisionCandidates();
  assert.equal(candidates.length, 1);
  runtime.store.openDecision(candidates[0].candidateId);
  assert.throws(() => runtime.store.confirmDecision({ confirmed: true }), /历史快照|不得重放/);
  assert.equal(runtime.trackers.decisionConfirmations, 0);
});

test("快速重跑持久化完整 operation lineage，刷新后保持 operationId、来源和 M01—M06 引用", async () => {
  const first = await createRuntime();
  const run = await first.store.quickRerun();
  assert.ok(run, first.store.getState().runError);
  const runtimeKey = findStorageKey(first.storage, `:${run.runId}:m06:runs%2Fcurrent`);
  const payload = readEnvelope(first.storage, runtimeKey).payload;
  assert.match(payload.operationId, /^OP-S003-\d{17}-[0-9a-f]{12}$/);
  assert.equal(payload.operationMode, "rerun");
  assert.equal(payload.sourceCheckpointId, null);
  assert.equal(payload.sourceScenarioRunId, STATIC_CONTEXT.scenarioRunId);
  assert.deepEqual(Object.keys(payload.moduleRestoreReferences).sort(), ["M01", "M02", "M03", "M04", "M05", "M06"]);

  const reloaded = await createRuntime({ storage: first.storage, href: runtimeHref(run.runId) });
  assert.deepEqual(clone(reloaded.store.getState().operationLineage), {
    operationId: payload.operationId,
    operationMode: "rerun",
    sourceCheckpointId: null,
    sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId,
    moduleRestoreReferences: payload.moduleRestoreReferences
  });
});

test("克隆恢复与隔离回归分别保留 Checkpoint 来源、原 runId 和模块恢复引用", async () => {
  const restoredRuntime = await createRuntime();
  const restored = restoredRuntime.store.cloneRestore("CP01");
  const restoreKey = findStorageKey(restoredRuntime.storage, `:${restored.context.scenarioRunId}:m06:runs%2Fcurrent`);
  const restorePayload = readEnvelope(restoredRuntime.storage, restoreKey).payload;
  assert.equal(restorePayload.operationMode, "clone-restore");
  assert.equal(restorePayload.sourceCheckpointId, restoredRuntime.bundle.checkpoints[0].manifest.checkpointId);
  assert.equal(restorePayload.sourceScenarioRunId, STATIC_CONTEXT.scenarioRunId);
  assert.deepEqual(Object.keys(restorePayload.moduleRestoreReferences).sort(), ["M01", "M02", "M03", "M04", "M05", "M06"]);
  const restoredReload = await createRuntime({ storage: restoredRuntime.storage, href: runtimeHref(restored.context.scenarioRunId) });
  assert.equal(restoredReload.store.getState().operationLineage.operationMode, "clone-restore");

  const regressionRuntime = await createRuntime();
  const regression = await regressionRuntime.store.isolatedRegression("CP01");
  assert.ok(regression.run, regressionRuntime.store.getState().runError);
  const regressionKey = findStorageKey(regressionRuntime.storage, `:${regression.context.scenarioRunId}:m06:runs%2Fcurrent`);
  const regressionPayload = readEnvelope(regressionRuntime.storage, regressionKey).payload;
  assert.equal(regressionPayload.operationMode, "isolated-regression");
  assert.equal(regressionPayload.sourceCheckpointId, regressionRuntime.bundle.checkpoints[0].manifest.checkpointId);
  assert.equal(regressionPayload.sourceScenarioRunId, STATIC_CONTEXT.scenarioRunId);
  const regressionReload = await createRuntime({ storage: regressionRuntime.storage, href: runtimeHref(regression.context.scenarioRunId) });
  assert.equal(regressionReload.store.getState().operationLineage.operationMode, "isolated-regression");
  assert.equal(regressionReload.store.getState().activeRun.authorityMode, "isolated-regression");
});

test("无历史企业因子快照时，克隆恢复在 M02 建立完整企业键的可丢弃输入 Draft", async () => {
  const runtime = await createRuntime();
  const originalResolver = runtime.bundle.checkpointProjection.resolveCheckpointProjection;
  runtime.bundle.checkpointProjection.resolveCheckpointProjection = () => ({
    ...originalResolver(),
    hasPublished: false,
    runnable: false,
    inputSnapshot: null,
    c035Results: null
  });
  const restored = runtime.store.cloneRestore("CP01");
  const configKey = findStorageKey(runtime.storage, `:${restored.context.scenarioRunId}:m01:config%2Fcurrent`);
  const configPayload = readEnvelope(runtime.storage, configKey).payload;
  const inputKey = findStorageKey(runtime.storage, `:${restored.context.scenarioRunId}:m02:factor-inputs%2Fcurrent`);
  const inputPayload = readEnvelope(runtime.storage, inputKey).payload;
  assert.equal(configPayload.status, "draft");
  assert.equal(Object.prototype.hasOwnProperty.call(configPayload, "enterpriseFactorInputs"), false);
  assert.equal(inputPayload.status, "draft");
  assert.equal(inputPayload.snapshot, null);
  assert.deepEqual(Object.keys(inputPayload.values).sort(), ["S003-ENT-001", "S003-ENT-002"]);
  assert.equal(runtime.store.getState().activeRun, null);
});

test("返回正式成功运行恢复同轮 M01 Published 配置，不把后续 Draft 显示成 Published", async () => {
  const runtime = await createRuntime();
  runtime.store.updateFactorInput("S003-ENT-001", "融资能力", "良好");
  runtime.store.publishFactorInputs();
  const run = await runtime.store.quickRerun();
  assert.ok(run, runtime.store.getState().runError);
  runtime.store.updateFactorInput("S003-ENT-001", "融资能力", "一般");
  assert.equal(runtime.store.getState().factorEntryStatus, "draft");
  runtime.store.cloneRestore("CP01");
  assert.equal(runtime.store.getState().factorEntryStatus, "published");
  runtime.store.returnToLastSuccessfulRun();
  assert.equal(runtime.store.getState().factorEntryStatus, "published");
  assert.equal(runtime.store.getState().publishedModel.packageVersion, "1.0.1");
  assert.equal(runtime.store.getState().factorInputSnapshot.snapshotId, "S003-T053-INPUT-20251231-v1");
});

test("返回静态正式运行时从 M01 Published 事实集补齐报告输入", async () => {
  const runtime = await createRuntime();
  const expectedFacts = runtime.bundle.c035Results.results.map((result, index) => ({
    schemaVersion: "ofw.s003.published-debt-risk-fact.v1",
    sourceResultId: result.resultId || `S003-C035-FACT-${index + 1}`
  }));
  runtime.bundle.publishedFacts = { facts: expectedFacts };
  runtime.bundle.publishedPointer = { activeTarget: {} };
  runtime.bundle.reportService = {
    createReportService(input) {
      assert.equal(JSON.stringify(input.publishedFacts.facts), JSON.stringify(expectedFacts.map((fact) => ({
        ...fact,
        scenarioIdentity: clone(input.scenarioContext)
      }))));
      return {
        listReports() { return []; },
        renderHtml() { return ""; }
      };
    }
  };
  runtime.store.cloneRestore("CP01");
  runtime.store.returnToLastSuccessfulRun();
  assert.equal(runtime.store.getState().context.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
});

test("动态投影严格拒绝 namespace、envelope、context、run、模型、输入及企业集合篡改", async (t) => {
  const first = await createRuntime();
  const run = await first.store.quickRerun();
  assert.ok(run, first.store.getState().runError);
  const runtimeKey = findStorageKey(first.storage, `:${run.runId}:m06:runs%2Fcurrent`);

  const cases = [
    {
      name: "namespace",
      mutate(storage) {
        const raw = storage.getItem(runtimeKey);
        storage.removeItem(runtimeKey);
        storage.items.set(runtimeKey.replace(":m06:", ":m05:"), raw);
      }
    },
    { name: "envelope", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.extra = true; writeEnvelope(storage, runtimeKey, value); } },
    { name: "context", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.payload.projectionContext.formedAt = "2026-08-15T00:00:00.000Z"; writeEnvelope(storage, runtimeKey, value); } },
    { name: "run", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.payload.activeRun.runId = "S003-RUN-20260815195959999-deadbeef0002"; writeEnvelope(storage, runtimeKey, value); } },
    { name: "model", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.payload.modelVersion = "9.9.9"; writeEnvelope(storage, runtimeKey, value); } },
    { name: "input", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.payload.activeRun.inputSnapshotId = "S003-T053-INPUT-20251231-v999"; value.payload.inputSnapshotId = "S003-T053-INPUT-20251231-v999"; writeEnvelope(storage, runtimeKey, value); } },
    { name: "enterprise uniqueness", mutate(storage) { const value = readEnvelope(storage, runtimeKey); value.payload.activeRun.enterpriseResults[1].enterpriseId = "S003-ENT-001"; writeEnvelope(storage, runtimeKey, value); } }
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const storage = first.storage.clone();
      item.mutate(storage);
      const reloaded = await createRuntime({ storage, href: runtimeHref(run.runId) });
      assert.equal(reloaded.store.getState().ready, false);
      assert.match(reloaded.store.getState().fatalError, /投影|运行|scenarioRunId|命名空间/);
      assert.equal(reloaded.trackers.engineCalls, 0, "非法投影不得触发自动评估");
    });
  }
});

test("localStorage 不得把工作投影或伪造成功指针提升为 M03/M04 正式消费", async (t) => {
  const first = await createRuntime();
  const run = await first.store.quickRerun();
  assert.ok(run, first.store.getState().runError);
  const runtimeKey = findStorageKey(first.storage, `:${run.runId}:m06:runs%2Fcurrent`);

  await t.test("工作投影篡改 authorityMode/projectionOnly", async () => {
    const storage = first.storage.clone();
    const envelope = readEnvelope(storage, runtimeKey);
    envelope.payload.activeRun.authorityMode = "published-evidence";
    envelope.payload.activeRun.projectionOnly = false;
    writeEnvelope(storage, runtimeKey, envelope);
    const reloaded = await createRuntime({ storage, href: runtimeHref(run.runId) });
    assert.equal(reloaded.store.getState().ready, false);
    assert.match(reloaded.store.getState().fatalError, /不得伪装|published-evidence|浏览器/);
    assert.equal(reloaded.trackers.queryCalls.length, 0);
    assert.equal(reloaded.trackers.decisionRuntimeCreations, 0);
  });

  await t.test("lastSuccessfulRun 内容篡改", async () => {
    const storage = first.storage.clone();
    const envelope = readEnvelope(storage, runtimeKey);
    envelope.payload.lastSuccessfulRun.raw.results[0].finalScore = 1;
    writeEnvelope(storage, runtimeKey, envelope);
    const reloaded = await createRuntime({ storage, href: runtimeHref(run.runId) });
    assert.equal(reloaded.store.getState().ready, false);
    assert.match(reloaded.store.getState().fatalError, /权威 Published 证据|正式成功指针|投影无效/);
    assert.equal(reloaded.trackers.queryCalls.length, 0);
    assert.equal(reloaded.trackers.decisionRuntimeCreations, 0);
  });
});

test("同轮次 M01/M04 损坏与从未形成严格区分，原样隔离后按模块重建工作投影", async (t) => {
  const untouched = await createRuntime();
  assert.equal(untouched.store.getState().ready, true, "从未形成可按静态正式证据启动");

  const cases = [
    {
      name: "M01",
      prepare(runtime) {
        runtime.store.resetConfiguration();
        const key = findStorageKey(runtime.storage, `:${STATIC_CONTEXT.scenarioRunId}:m01:config%2Fcurrent`);
        const envelope = readEnvelope(runtime.storage, key);
        envelope.payload.status = "corrupt";
        writeEnvelope(runtime.storage, key, envelope);
      }
    },
    {
      name: "M04",
      prepare(runtime) {
        const candidate = runtime.store.listDecisionCandidates()[0];
        runtime.store.openDecision(candidate.candidateId);
        runtime.store.confirmDecision({ confirmed: true });
        const key = findStorageKey(runtime.storage, `:${STATIC_CONTEXT.scenarioRunId}:m04:action-requests%2Fcurrent`);
        const envelope = readEnvelope(runtime.storage, key);
        envelope.payload.items = {};
        writeEnvelope(runtime.storage, key, envelope);
      }
    }
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const runtime = await createRuntime();
      item.prepare(runtime);
      const reloaded = await createRuntime({ storage: runtime.storage });
      const snapshot = reloaded.store.getRuntimeSnapshot();
      const moduleId = item.name === "M01" ? "M01" : "M04";
      assert.equal(snapshot.ready, true);
      assert.equal(snapshot.fatalError, null);
      assert.equal(snapshot.projectionHealth[moduleId].status, "isolated-rebuilt");
      assert.equal(snapshot.runtimeHealth.status, "degraded");
      assert.equal(snapshot.runtimeHealth.formalPublishedReadReady, true);
      assert.equal(snapshot.projectionRecoveryReceipts.length, 1);
      assert.equal(snapshot.projectionRecoveryReceipts[0].formalArtifactsUnaffected, true);
      assert.match(snapshot.projectionRecoveryReceipts[0].originalRaw, /corrupt|\[\]|items/);
      const published = reloaded.store.getPublishedResourceSnapshot();
      assert.equal(published.ready, true, "Draft 损坏不得阻断 Published-only 读取");
      assert.equal(published.publishedModel.packageVersion, "1.0.1");
      assert.equal(reloaded.store.getState().context.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
    });
  }
});

test("退役的 M02 v0 企业因子投影保持原字节，不阻断当前正式 T053 输入", async () => {
  const runtime = await createRuntime();
  const legacy = namespacedAdapter(runtime, STATIC_CONTEXT, "m02");
  legacy.set("factor-inputs/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v0",
    projectionContext: clone(STATIC_CONTEXT),
    status: "draft",
    values: factorValues(),
    snapshot: createInputSnapshot()
  });
  const key = findStorageKey(runtime.storage, `:${STATIC_CONTEXT.scenarioRunId}:m02:factor-inputs%2Fcurrent`);
  const originalRaw = runtime.storage.getItem(key);

  const reloaded = await createRuntime({ storage: runtime.storage });
  const snapshot = reloaded.store.getRuntimeSnapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.projectionHealth.M02.status, "healthy");
  assert.equal(reloaded.storage.getItem(key), originalRaw);
  assert.equal(snapshot.factorInputSnapshot.owner, "M02 数据工程");
  assert.equal(snapshot.context.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
  assert.equal(reloaded.trackers.engineCalls, 0, "读取退役投影不得触发自动重评");
});

test("退役的 M02 未知 schema 投影保持隔离，当前正式 T053 输入继续可读", async () => {
  const runtime = await createRuntime();
  namespacedAdapter(runtime, STATIC_CONTEXT, "m02").set("factor-inputs/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v999",
    projectionContext: clone(STATIC_CONTEXT),
    status: "draft",
    values: { ...factorValues(), "S003-ENT-001": { "融资能力": "未知旧值" } },
    snapshot: null,
    lastPublishedSnapshot: null
  });
  const key = findStorageKey(runtime.storage, `:${STATIC_CONTEXT.scenarioRunId}:m02:factor-inputs%2Fcurrent`);
  const originalRaw = runtime.storage.getItem(key);

  const reloaded = await createRuntime({ storage: runtime.storage });
  const snapshot = reloaded.store.getRuntimeSnapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.projectionHealth.M02.status, "healthy");
  assert.equal(reloaded.storage.getItem(key), originalRaw);
  assert.equal(JSON.stringify(snapshot.factorInputs), JSON.stringify(factorValues()));
  assert.equal(snapshot.factorInputSnapshot.owner, "M02 数据工程");
  assert.equal(snapshot.context.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
  assert.equal(reloaded.store.getPublishedResourceSnapshot().ready, true);
  assert.equal(reloaded.trackers.engineCalls, 0, "退役投影不得触发自动重评");
});

test("returnToLastSuccessfulRun 遇到后来损坏的同轮次投影明确报错", async () => {
  const runtime = await createRuntime();
  runtime.store.resetConfiguration();
  const run = await runtime.store.quickRerun();
  assert.ok(run, runtime.store.getState().runError);
  const configKey = findStorageKey(runtime.storage, `:${STATIC_CONTEXT.scenarioRunId}:m01:config%2Fcurrent`);
  const envelope = readEnvelope(runtime.storage, configKey);
  envelope.payload.status = "corrupt";
  writeEnvelope(runtime.storage, configKey, envelope);
  assert.throws(() => runtime.store.returnToLastSuccessfulRun(), /已存在但损坏|不同于从未形成|拒绝静默回退/);
  assert.equal(runtime.store.getState().activeRun.runId, run.runId);
});

test("普通动态投影 activeRun=null 被阻断，不得绕过 C034 自动 evaluate", async () => {
  const storage = new MemoryStorage();
  const runtime = await createRuntime({ storage });
  const context = {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: "S003-RUN-20260815193000000-010203040506",
    formedAt: "2026-08-15T19:30:00.000Z",
    status: "active"
  };
  const adapter = namespacedAdapter(runtime, context, "m06");
  adapter.set("runs/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v1",
    projectionContext: clone(context),
    runtimeProjectionSchemaVersion: "ofw.s003.runtime-projection.v1",
    projectionComplete: true,
    context: clone(context),
    activeRun: null,
    regressionRun: null,
    lastSuccessfulRun: null,
    runHistory: [],
    runStatus: "idle",
    restoredFromCheckpoint: null,
    ...runtimeLineage({ operationId: "OP-S003-20260815193000000-010203040506" }),
    modelVersion: "1.0.1",
    inputSnapshotId: "S003-T053-INPUT-20251231-v1",
    enterpriseCount: 2
  });

  const reloaded = await createRuntime({ storage, href: runtimeHref(context.scenarioRunId) });
  assert.equal(reloaded.store.getState().ready, false);
  assert.match(reloaded.store.getState().fatalError, /activeRun=null/);
  assert.equal(reloaded.trackers.engineCalls, 0);
});

test("restored 运行优先读取 M02 T053 输入，不把旧 M01 企业因子字段当作模型定义", async () => {
  const storage = new MemoryStorage();
  const runtime = await createRuntime({ storage });
  const context = {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: "S003-RUN-20260815193100000-060504030201",
    formedAt: "2026-08-15T19:31:00.000Z",
    status: "restored"
  };
  const model = createModel();
  const configDraft = {
    packageId: model.packageId,
    packageVersion: model.packageVersion,
    basedOnPackageId: model.packageId,
    basedOnVersion: model.packageVersion,
    proposedVersion: "1.0.2",
    weights: clone(model.weights),
    factors: [],
    riskTiers: [],
    indicatorOrder: [],
    assessment: clone(model.assessment),
    factorInputs: factorValues()
  };
  const modelConfigurationSnapshot = {
    schemaVersion: "ofw.s003.m01.enterprise-factor-configuration-snapshot.v1",
    snapshotId: `S003-M01-MODEL-CONFIG-${model.packageVersion}`,
    snapshotVersion: model.packageVersion,
    status: "published-model-configuration",
    immutable: true,
    formedAt: model.publishedAt,
    owner: "M01 本体管理",
    businessOwner: "财务公司",
    assessmentAt: "2025-12-31",
    enterpriseCount: 2,
    factorCount: 1,
    modelPackageId: model.packageId,
    modelPackageVersion: model.packageVersion,
    values: factorValues()
  };
  namespacedAdapter(runtime, context, "m01").set("config/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v1",
    projectionContext: clone(context),
    configDraft,
    publishedModel: model,
    lastPublishedModel: clone(model),
    enterpriseFactorInputs: factorValues(),
    modelConfigurationSnapshot,
    lastPublishedConfiguration: clone(modelConfigurationSnapshot),
    status: "draft"
  });
  const t053Snapshot = createInputSnapshot();
  namespacedAdapter(runtime, context, "m02").set("factor-inputs/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v1",
    projectionContext: clone(context),
    status: "published",
    values: factorValues(),
    snapshot: t053Snapshot,
    lastPublishedSnapshot: clone(t053Snapshot)
  });
  namespacedAdapter(runtime, context, "m06").set("runs/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v1",
    projectionContext: clone(context),
    runtimeProjectionSchemaVersion: "ofw.s003.runtime-projection.v1",
    projectionComplete: true,
    context: clone(context),
    activeRun: null,
    regressionRun: null,
    lastSuccessfulRun: null,
    runHistory: [],
    runStatus: "restored",
    restoredFromCheckpoint: "CP01",
    ...runtimeLineage({
      operationId: "OP-S003-20260815193100000-060504030201",
      operationMode: "clone-restore",
      sourceCheckpointId: "CP-S003-20260815130000000-c03501000001",
      sourceScenarioRunId: STATIC_CONTEXT.scenarioRunId
    }),
    modelVersion: model.packageVersion,
    inputSnapshotId: t053Snapshot.snapshotId,
    enterpriseCount: 2
  });

  const reloaded = await createRuntime({ storage, href: runtimeHref(context.scenarioRunId) });
  const state = reloaded.store.getState();
  assert.equal(state.ready, true);
  assert.equal(state.runStatus, "restored");
  assert.equal(state.activeRun, null);
  assert.equal(state.factorInputSnapshot.snapshotId, t053Snapshot.snapshotId);
  assert.equal(state.factorInputSnapshot.owner, "M02 数据工程");
  assert.equal(state.factorEntryStatus, "published");
  assert.equal(Object.prototype.hasOwnProperty.call(state.publishedModel, "enterpriseFactorInputs"), false);
  assert.equal(reloaded.trackers.engineCalls, 0);
});

test("配额或部分写入失败时原子回滚，新运行不进入成功/可刷新状态", async () => {
  const runtime = await createRuntime();
  const baselineRunId = runtime.store.getState().activeRun.runId;
  runtime.storage.failOnNthNextWrite(2);
  const run = await runtime.store.quickRerun();
  const state = runtime.store.getState();
  assert.equal(run, null);
  assert.equal(state.runStatus, "failed");
  assert.equal(state.activeRun.runId, baselineRunId);
  assert.equal(state.lastSuccessfulRun.runId, baselineRunId);
  assert.equal(state.runHistory.length, 1);
  assert.equal(state.projectionPersistence.ok, false);
  assert.equal(state.projectionPersistence.atomic, true);
  assert.match(state.runError, /原子持久化|QuotaExceededError/);
  const attemptedRunId = runtime.trackers.lastAttemptedContext.scenarioRunId;
  assert.equal(runtime.storage.entries().some(([key]) => key.includes(`:${attemptedRunId}:`)), false);
  assert.equal(runtime.trackers.completions.at(-1).status, "failed");
});

test("C034 成功回执失败时回滚已落盘投影，不留下伪成功深链", async () => {
  const runtime = await createRuntime({ failSuccessfulCompletion: true });
  const baselineRunId = runtime.store.getState().activeRun.runId;
  const run = await runtime.store.quickRerun();
  const state = runtime.store.getState();
  assert.equal(run, null);
  assert.equal(state.activeRun.runId, baselineRunId);
  assert.equal(state.runStatus, "failed");
  assert.equal(state.projectionPersistence.rolledBack, true);
  assert.equal(state.projectionPersistence.atomic, true);
  assert.match(state.runError, /C034 成功回执未完成/);
  const attemptedRunId = runtime.trackers.lastAttemptedContext.scenarioRunId;
  assert.equal(runtime.storage.entries().some(([key]) => key.includes(`:${attemptedRunId}:`)), false);
  assert.equal(runtime.trackers.completions.at(-1).status, "failed");
});

test("regression、restored、historical 运行不得恢复为正式 lastSuccessfulRun", async (t) => {
  const first = await createRuntime();
  const run = await first.store.quickRerun();
  assert.ok(run, first.store.getState().runError);
  const runtimeKey = findStorageKey(first.storage, `:${run.runId}:m06:runs%2Fcurrent`);
  for (const status of ["regression", "restored", "historical-readonly"]) {
    await t.test(status, async () => {
      const storage = first.storage.clone();
      const envelope = readEnvelope(storage, runtimeKey);
      envelope.payload.lastSuccessfulRun.scenarioContext.status = status;
      envelope.payload.lastSuccessfulRun.raw.scenarioIdentity.status = status;
      writeEnvelope(storage, runtimeKey, envelope);
      const reloaded = await createRuntime({ storage, href: runtimeHref(run.runId) });
      assert.equal(reloaded.store.getState().ready, false);
      assert.match(reloaded.store.getState().fatalError, /正式成功指针|投影无效/);
      assert.equal(reloaded.trackers.engineCalls, 0);
    });
  }
});

test("动态 Published 模型由当前 M01 投影继承，资源读取与新轮次重置不回退静态模型", async () => {
  const first = await createRuntime();
  const dynamicModel = createModel("1.0.2");
  dynamicModel.publishedAt = "2026-08-16T09:00:00.000Z";
  const currentDraft = first.store.getState().configDraft;
  const dynamicDraft = {
    ...clone(currentDraft),
    basedOnPackageId: dynamicModel.packageId,
    basedOnVersion: dynamicModel.packageVersion,
    proposedVersion: "1.0.3"
  };
  namespacedAdapter(first, STATIC_CONTEXT, "m01").set("config/current", {
    projectionSchemaVersion: "ofw.s003.browser-projection.v1",
    projectionContext: clone(STATIC_CONTEXT),
    configDraft: dynamicDraft,
    publishedModel: dynamicModel,
    lastPublishedModel: clone(dynamicModel),
    enterpriseFactorInputs: factorValues(),
    modelConfigurationSnapshot: {
      schemaVersion: "ofw.s003.m01.enterprise-factor-configuration-snapshot.v1",
      snapshotId: "S003-M01-MODEL-CONFIG-1.0.2",
      snapshotVersion: "1.0.2",
      status: "published-model-configuration",
      immutable: true,
      formedAt: dynamicModel.publishedAt,
      owner: "M01 本体管理",
      businessOwner: "财务公司",
      assessmentAt: "2025-12-31",
      enterpriseCount: 2,
      factorCount: 1,
      modelPackageId: dynamicModel.packageId,
      modelPackageVersion: dynamicModel.packageVersion,
      values: factorValues()
    },
    lastPublishedConfiguration: {
      schemaVersion: "ofw.s003.m01.enterprise-factor-configuration-snapshot.v1",
      snapshotId: "S003-M01-MODEL-CONFIG-1.0.2",
      snapshotVersion: "1.0.2",
      status: "published-model-configuration",
      immutable: true,
      formedAt: dynamicModel.publishedAt,
      owner: "M01 本体管理",
      businessOwner: "财务公司",
      assessmentAt: "2025-12-31",
      enterpriseCount: 2,
      factorCount: 1,
      modelPackageId: dynamicModel.packageId,
      modelPackageVersion: dynamicModel.packageVersion,
      values: factorValues()
    },
    status: "published"
  });

  const reloaded = await createRuntime({
    storage: first.storage,
    href: runtimeHref(STATIC_CONTEXT.scenarioRunId)
  });
  const published = reloaded.store.getPublishedResourceSnapshot();
  assert.equal(published.publishedModel.packageVersion, "1.0.2");
  assert.equal(published.publishedPointer.activeTarget.packageVersion, "1.0.2");
  assert.equal(published.publishedPointer.activeTarget.publishedSnapshot.packageVersion, "1.0.2");
  assert.equal(published.scenarioContext.scenarioRunId, STATIC_CONTEXT.scenarioRunId);

  const nextContext = await reloaded.store.resetCurrentScenario();
  assert.notEqual(nextContext.scenarioRunId, STATIC_CONTEXT.scenarioRunId);
  assert.equal(reloaded.store.getState().publishedModel.packageVersion, "1.0.2");
});
