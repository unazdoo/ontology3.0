"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const foundation = require("./ofw-scenario-foundation.js");

class MemoryStorage {
  constructor() {
    this.records = new Map();
    this.clearCalls = 0;
  }

  get length() {
    return this.records.size;
  }

  key(index) {
    return Array.from(this.records.keys())[index] ?? null;
  }

  getItem(key) {
    return this.records.has(key) ? this.records.get(key) : null;
  }

  setItem(key, value) {
    this.records.set(String(key), String(value));
  }

  removeItem(key) {
    this.records.delete(String(key));
  }

  clear() {
    this.clearCalls += 1;
    this.records.clear();
  }
}

function fixedRandom(start) {
  return function (size) {
    return Uint8Array.from({ length: size }, function (_, index) {
      return (start + index) % 256;
    });
  };
}

function createContext(scenarioId, version, millisecond, randomStart) {
  return foundation.createScenarioContext(
    { scenarioId: scenarioId, scenarioVersion: version },
    {
      now: new Date(Date.UTC(2026, 7, 15, 8, 30, 0, millisecond)),
      randomBytes: fixedRandom(randomStart)
    }
  );
}

function moduleEntries(now) {
  return foundation.MODULE_IDS.reduce(function (result, moduleId, index) {
    const digit = ((index + 1) % 10).toString(16);
    result[moduleId] = {
      moduleId: moduleId,
      moduleVersion: `1.0.${index + 1}`,
      exportId: `${moduleId}-EXPORT-001`,
      exportRef: `evidence://exports/${moduleId}/001`,
      exportSha256: digit.repeat(64),
      validation: {
        status: "verified",
        validatedAt: now,
        evidenceRef: `evidence://validations/${moduleId}/001`
      },
      restoreMode: "isolated-clone"
    };
    return result;
  }, {});
}

function emptyStateSections() {
  return foundation.STATE_SECTION_NAMES.reduce(function (result, name) {
    result[name] = {
      status: "empty",
      reason: `初始配置节点尚未形成 ${name} 业务资源`,
      items: []
    };
    return result;
  }, {});
}

function createCheckpoint(context, options) {
  const config = options || {};
  const now = config.now || "2026-08-15T09:00:00.000Z";
  return foundation.createCheckpointManifest(
    {
      checkpointNode: "initial-configured",
      parentVersion: "1.0.3",
      scenarioContext: context,
      code: {
        prototypeVersion: "1.1.0",
        buildVersion: "foundation-test-001",
        entryRef: "prototype://v1.1.0/foundation",
        treeSha256: "a".repeat(64)
      },
      modules: moduleEntries(now),
      stateSections: emptyStateSections(),
      restoreReadiness: {
        status: "verified",
        verifiedAt: now,
        evidenceRef: "evidence://checkpoint/restore-verification/001"
      }
    },
    {
      now: new Date(now),
      randomBytes: fixedRandom(config.randomStart || 50)
    }
  );
}

test("浏览器可直接加载且暴露唯一全局 API", function () {
  const scriptPath = path.join(__dirname, "ofw-scenario-foundation.js");
  const source = fs.readFileSync(scriptPath, "utf8");
  const sandbox = { crypto: globalThis.crypto };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: scriptPath });
  assert.equal(sandbox.OFWScenarioFoundation.FOUNDATION_VERSION, "1.0.0");
  assert.equal(
    sandbox.OFWScenarioFoundation.CURRENT_BASELINE_SNAPSHOT_ID,
    "BSL-S001-V103-DE0119608E26"
  );
});

test("创建严格且不可变的场景三元身份", function () {
  const context = createContext("S002", "S002-v1", 123, 1);
  assert.match(context.scenarioRunId, /^S002-RUN-\d{17}-[a-f0-9]{12}$/);
  assert.equal(context.formedAt, "2026-08-15T08:30:00.123Z");
  assert.equal(context.status, "active");
  assert.equal(Object.isFrozen(context), true);

  const second = createContext("S002", "S002-v1", 124, 2);
  assert.notEqual(context.scenarioRunId, second.scenarioRunId);
});

test("拒绝版本前缀、运行前缀、未知字段和上下文错配", function () {
  const context = createContext("S002", "S002-v1", 0, 3);
  const wrongVersion = { ...context, scenarioVersion: "S003-v1" };
  const wrongRun = {
    ...context,
    scenarioRunId: context.scenarioRunId.replace(/^S002/, "S003")
  };
  const extra = { ...context, successState: true };

  assert.equal(foundation.validateScenarioContext(wrongVersion).ok, false);
  assert.equal(foundation.validateScenarioContext(wrongRun).ok, false);
  assert.equal(foundation.validateScenarioContext(extra).ok, false);
  assert.throws(
    function () {
      foundation.assertScenarioContextMatch(context, createContext("S003", "S003-v1", 0, 4));
    },
    function (error) {
      return error.code === "SCENARIO_CONTEXT_MISMATCH";
    }
  );
});

test("显式命名空间适配器隔离场景、版本、轮次和模块 scope", function () {
  const storage = new MemoryStorage();
  const s002 = createContext("S002", "S002-v1", 1, 5);
  const s003 = createContext("S003", "S003-v1", 1, 6);
  const s002m1 = foundation.createNamespacedStorage({ storage: storage, context: s002, scope: "m01" });
  const s002m2 = foundation.createNamespacedStorage({ storage: storage, context: s002, scope: "m02" });
  const s003m1 = foundation.createNamespacedStorage({ storage: storage, context: s003, scope: "m01" });

  s002m1.set("draft/current", { draftId: "DRAFT-S002" }, { now: "2026-08-15T09:00:00.000Z" });
  s002m2.set("run/current", { runId: "PIPE-S002" }, { now: "2026-08-15T09:00:01.000Z" });
  s003m1.set("draft/current", { draftId: "DRAFT-S003" }, { now: "2026-08-15T09:00:02.000Z" });

  assert.deepEqual(s002m1.get("draft/current"), { draftId: "DRAFT-S002" });
  assert.deepEqual(s003m1.get("draft/current"), { draftId: "DRAFT-S003" });
  assert.equal(s002m1.get("missing"), null);
  assert.deepEqual(s002m1.keys(), ["draft/current"]);
  assert.equal("importSnapshot" in s002m1, false);
  assert.equal("exportSnapshot" in s002m1, false);

  const corruptEnvelope = {
    schemaVersion: foundation.STORAGE_SCHEMA_VERSION,
    scenarioContext: s003,
    savedAt: "2026-08-15T09:00:03.000Z",
    payload: { draftId: "WRONG-SCENE" }
  };
  storage.setItem(s002m1.keyFor("corrupt"), JSON.stringify(corruptEnvelope));
  assert.throws(
    function () {
      s002m1.get("corrupt");
    },
    function (error) {
      return error.code === "SCENARIO_CONTEXT_MISMATCH";
    }
  );
});

test("定向重置只清当前场景当前轮次并生成新 runId", function () {
  const storage = new MemoryStorage();
  const current = createContext("S002", "S002-v1", 10, 10);
  const olderRun = createContext("S002", "S002-v1", 11, 11);
  const otherScene = createContext("S003", "S003-v1", 10, 12);
  const currentM1 = foundation.createNamespacedStorage({ storage: storage, context: current, scope: "m01" });
  const currentM6 = foundation.createNamespacedStorage({ storage: storage, context: current, scope: "m06" });
  const olderM1 = foundation.createNamespacedStorage({ storage: storage, context: olderRun, scope: "m01" });
  const otherM1 = foundation.createNamespacedStorage({ storage: storage, context: otherScene, scope: "m01" });

  currentM1.set("state", { value: "current-m1" });
  currentM6.set("state", { value: "current-m6" });
  olderM1.set("state", { value: "older-run" });
  otherM1.set("state", { value: "other-scene" });
  storage.setItem("unrelated-key", "preserve");

  const receipt = foundation.directionalReset(
    { storage: storage, currentContext: current },
    {
      now: new Date("2026-08-15T10:00:00.000Z"),
      randomBytes: fixedRandom(20)
    }
  );

  assert.equal(receipt.mode, "directional-reset");
  assert.equal(receipt.removedStorageKeyCount, 2);
  assert.notEqual(receipt.context.scenarioRunId, current.scenarioRunId);
  assert.equal(receipt.context.scenarioId, "S002");
  assert.equal(currentM1.get("state"), null);
  assert.deepEqual(olderM1.get("state"), { value: "older-run" });
  assert.deepEqual(otherM1.get("state"), { value: "other-scene" });
  assert.equal(storage.getItem("unrelated-key"), "preserve");
  assert.equal(storage.clearCalls, 0, "禁止调用 storage.clear() 整体清库");
});

test("Checkpoint 清单固定 BSL-S001-V103-DE0119608E26 且不含业务成功状态", function () {
  const context = createContext("S002", "S002-v1", 20, 30);
  const checkpoint = createCheckpoint(context);
  const validation = foundation.validateCheckpointManifest(checkpoint);

  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.equal(checkpoint.baselineVersion, "1.0.3");
  assert.equal(checkpoint.baselineSnapshotId, "BSL-S001-V103-DE0119608E26");
  assert.equal(checkpoint.sourceScenarioRunId, context.scenarioRunId);
  assert.equal(checkpoint.immutable, true);
  assert.equal(Object.isFrozen(checkpoint), true);
  assert.equal("acceptanceReady" in checkpoint, false);
  assert.equal("completedSteps" in checkpoint, false);
  assert.deepEqual(checkpoint.sideEffectPolicy, foundation.SIDE_EFFECT_POLICY);
});

test("Checkpoint 拒绝错误基线、缺失模块、非法哈希和历史副作用放开", function () {
  const context = createContext("S002", "S002-v1", 21, 31);
  const checkpoint = createCheckpoint(context, { randomStart: 51 });

  const wrongBaseline = { ...checkpoint, baselineSnapshotId: "BSL-S001-V103-WRONG" };
  assert.equal(foundation.validateCheckpointManifest(wrongBaseline).ok, false);

  const missingModule = JSON.parse(JSON.stringify(checkpoint));
  delete missingModule.modules.M06;
  assert.equal(foundation.validateCheckpointManifest(missingModule).ok, false);

  const badHash = JSON.parse(JSON.stringify(checkpoint));
  badHash.modules.M02.exportSha256 = "not-a-sha";
  assert.equal(foundation.validateCheckpointManifest(badHash).ok, false);

  const sideEffectEnabled = JSON.parse(JSON.stringify(checkpoint));
  sideEffectEnabled.sideEffectPolicy.allowHistoricalTodoReplay = true;
  assert.equal(foundation.validateCheckpointManifest(sideEffectEnabled).ok, false);

  const unavailableButVerified = JSON.parse(JSON.stringify(checkpoint));
  unavailableButVerified.stateSections.data = {
    status: "unavailable",
    reason: "数据导出当前不可定位",
    items: []
  };
  assert.equal(foundation.validateCheckpointManifest(unavailableButVerified).ok, false);

  const fakeSuccess = JSON.parse(JSON.stringify(checkpoint));
  fakeSuccess.acceptanceReady = true;
  const fakeSuccessResult = foundation.validateCheckpointManifest(fakeSuccess);
  assert.equal(fakeSuccessResult.ok, false);
  assert.equal(
    fakeSuccessResult.errors.some(function (error) {
      return error.code === "FORBIDDEN_BUSINESS_SUCCESS_FIELD";
    }),
    true
  );
});

test("历史查看保持原 runId 且严格只读", function () {
  const context = createContext("S002", "S002-v1", 30, 40);
  const checkpoint = createCheckpoint(context, { randomStart: 52 });
  const view = foundation.createHistoricalView(checkpoint, {
    now: new Date("2026-08-15T11:00:00.000Z"),
    randomBytes: fixedRandom(60)
  });

  assert.equal(view.mode, "historical-view");
  assert.equal(view.context.scenarioRunId, context.scenarioRunId);
  assert.equal(view.context.status, "historical-readonly");
  assert.equal(view.readOnly, true);
  assert.equal(view.writesCurrentProjection, false);
  assert.equal(view.rerunsBusinessLogic, false);
  assert.equal(Object.isFrozen(view), true);
});

test("克隆恢复生成新 runId 且禁止重放历史 Action、通知、审批和待办", function () {
  const context = createContext("S002", "S002-v1", 31, 41);
  const checkpoint = createCheckpoint(context, { randomStart: 53 });
  const restored = foundation.cloneRestore(checkpoint, {
    now: new Date("2026-08-15T11:10:00.000Z"),
    randomBytes: fixedRandom(61)
  });

  assert.equal(restored.mode, "clone-restore");
  assert.notEqual(restored.context.scenarioRunId, context.scenarioRunId);
  assert.equal(restored.context.scenarioVersion, context.scenarioVersion);
  assert.equal(restored.context.status, "restored");
  assert.equal(restored.overwritesHistory, false);
  Object.values(restored.sideEffectPolicy).forEach(function (value) {
    assert.equal(value, false);
  });
  assert.equal(restored.moduleRestoreRefs.M01.exportId, "M01-EXPORT-001");
});

test("隔离回归生成新 runId、默认关闭外发能力及历史副作用", function () {
  const context = createContext("S002", "S002-v1", 32, 42);
  const checkpoint = createCheckpoint(context, { randomStart: 54 });
  const regression = foundation.createIsolatedRegression(checkpoint, {
    now: new Date("2026-08-15T11:20:00.000Z"),
    randomBytes: fixedRandom(62)
  });

  assert.equal(regression.mode, "isolated-regression");
  assert.notEqual(regression.context.scenarioRunId, context.scenarioRunId);
  assert.equal(regression.context.status, "regression");
  assert.equal(regression.isolationMode, "drill");
  assert.equal(regression.externalCapabilitiesDefault, "disabled");
  Object.values(regression.sideEffectPolicy).forEach(function (value) {
    assert.equal(value, false);
  });
});

test("未验证恢复的 Checkpoint 只能历史查看，不能恢复或回归", function () {
  const context = createContext("S002", "S002-v1", 33, 43);
  const checkpoint = JSON.parse(JSON.stringify(createCheckpoint(context, { randomStart: 55 })));
  checkpoint.restoreReadiness.status = "not-verified";
  assert.equal(foundation.validateCheckpointManifest(checkpoint).ok, true);
  assert.equal(foundation.createHistoricalView(checkpoint).readOnly, true);
  assert.throws(
    function () {
      foundation.cloneRestore(checkpoint);
    },
    function (error) {
      return error.code === "CHECKPOINT_NOT_RESTORABLE";
    }
  );
  assert.throws(
    function () {
      foundation.createIsolatedRegression(checkpoint);
    },
    function (error) {
      return error.code === "CHECKPOINT_NOT_RESTORABLE";
    }
  );
});

test("基线迁移强制新 scenarioVersion 和新 runId，并保留来源对照", function () {
  const context = createContext("S002", "S002-v1", 40, 70);
  const checkpoint = createCheckpoint(context, { randomStart: 56 });

  assert.throws(
    function () {
      foundation.migrateBaseline(checkpoint, {
        targetBaselineVersion: "1.0.4",
        targetBaselineSnapshotId: "BSL-S001-V104-ABCDEF123456",
        targetScenarioVersion: "S002-v1"
      });
    },
    function (error) {
      return error.code === "IN_PLACE_SCENARIO_VERSION_MIGRATION";
    }
  );

  const migration = foundation.migrateBaseline(
    checkpoint,
    {
      targetBaselineVersion: "1.0.4",
      targetBaselineSnapshotId: "BSL-S001-V104-ABCDEF123456",
      targetScenarioVersion: "S002-v2"
    },
    {
      now: new Date("2026-08-15T12:00:00.000Z"),
      randomBytes: fixedRandom(80)
    }
  );

  assert.equal(migration.mode, "baseline-migration");
  assert.equal(migration.source.scenarioVersion, "S002-v1");
  assert.equal(migration.source.scenarioRunId, context.scenarioRunId);
  assert.equal(migration.target.scenarioVersion, "S002-v2");
  assert.notEqual(migration.target.scenarioRunId, context.scenarioRunId);
  assert.equal(migration.target.baselineVersion, "1.0.4");
  assert.equal(migration.overwritesSource, false);
  assert.equal(migration.requiresMigrationComparison, true);
  assert.equal(migration.requiresNewCheckpoint, true);
});
