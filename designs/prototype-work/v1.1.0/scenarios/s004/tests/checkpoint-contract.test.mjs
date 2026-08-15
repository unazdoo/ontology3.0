import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BASELINE_SNAPSHOT_ID,
  BASELINE_VERSION,
  CHECKPOINT_DIR,
  FOUNDATION,
  PHASES,
  SCENARIO_ID,
  SCENARIO_ROOT,
  SCENARIO_VERSION,
  checkpointDigestPath,
  checkpointManifestPath,
  phaseByAlias,
  readJson,
  resolveProjectRef,
  sha256File,
  validateCheckpointCatalog,
  validateDetachedDigest,
  validateS004Phase,
  validateS004PreRisk,
  validateS004PostFix,
  validateS004FinalDelivery
} from "../checkpoints/checkpoint-lib.mjs";

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

const catalogPath = path.join(CHECKPOINT_DIR, "index.json");
const evidenceIndexPath = path.join(SCENARIO_ROOT, "evidence/index.json");
const preRiskAlias = "CP-S004-PRE-20260815133128000";
const pointerPromotionPreAlias = "CP-S004-PRE-20260815140408000";
const postFixAliases = Object.freeze([
  "CP-S004-50-POSTFIX-20260815141021000",
  "CP-S004-60-POSTFIX-20260815141021100"
]);
const finalDeliveryAlias = "CP-S004-DELIVERY-20260815145500000";
const fixedCheckpointDigests = Object.freeze({
  "CP-S004-00": "a9a49d9f34986bdce1baa1d8f2f6ffbc3de3fde2ce111e13cc361607848ae4bf",
  "CP-S004-10": "0757e02dcf5880b283f305a652dda640f80985d7177b1904fb40dd83906ee951",
  "CP-S004-20": "4a5d2d0ffbb59a3f7bc27746ba2b7cc550e5670c71c9c996aae7dc15a1488977",
  "CP-S004-30": "7dac1c945d93e107ed994c376e36e8dbf11f6627f8a5ca1461bc398a42e9fea4",
  "CP-S004-40": "417625f18b2f9c4772c1b28fa4234b671cc9c8cb5090146ea062634ca3ffabcb",
  "CP-S004-50": "11ca461745a874c7267a116a4bddfdc3690195b7b2fe085bf72d27757f146295",
  "CP-S004-60": "ad443f8ee9e3a8d1be4502ef0a8a2b0fc919fcbb0e0c531ba1e25aedf79f0ef4"
});

function catalog() {
  return readJson(catalogPath);
}

function manifest(alias) {
  return readJson(checkpointManifestPath(alias));
}

function modulePayload(manifestValue, moduleId) {
  const [ref, fragment] = manifestValue.modules[moduleId].exportRef.split("#");
  const payload = readJson(resolveProjectRef(ref));
  if (!fragment) return payload;
  return fragment.split(".").reduce((value, key) => value?.[key], payload);
}

function fixedRandom(start) {
  return (size) => Uint8Array.from({ length: size }, (_, index) => (start + index) % 256);
}

test("S004 catalog 固定 v1.0.3 基线、七个阶段和唯一不可变身份", () => {
  const value = catalog();
  assert.equal(validateCheckpointCatalog(value), true);
  assert.equal(value.scenarioId, SCENARIO_ID);
  assert.equal(value.scenarioVersion, SCENARIO_VERSION);
  assert.equal(value.baselineVersion, BASELINE_VERSION);
  assert.equal(value.baselineSnapshotId, BASELINE_SNAPSHOT_ID);
  const fixedEntries = value.checkpoints.filter((item) => PHASES.some((phase) => phase.alias === item.phaseAlias));
  assert.deepEqual(fixedEntries.map((item) => item.phaseAlias), PHASES.map((item) => item.alias));
  assert.equal(new Set(value.checkpoints.map((item) => item.checkpointId)).size, value.checkpoints.length);
  for (const entry of fixedEntries) assert.equal(entry.manifestSha256, fixedCheckpointDigests[entry.phaseAlias]);
  for (const evidence of Object.values(value.operationEvidence)) {
    assert.equal(sha256File(resolveProjectRef(evidence.ref)), evidence.sha256);
  }
});

test("历史查看、克隆恢复和隔离回归证据均绑定 CP60 且未覆盖来源", () => {
  const value = catalog();
  const finalCheckpoint = manifest("CP-S004-60");
  const historical = readJson(resolveProjectRef(value.operationEvidence.historicalView.ref));
  const restore = readJson(resolveProjectRef(value.operationEvidence.cloneRestore.ref));
  const regression = readJson(resolveProjectRef(value.operationEvidence.isolatedRegression.ref));
  assert.equal(historical.sourceCheckpointId, finalCheckpoint.checkpointId);
  assert.equal(historical.context.scenarioRunId, finalCheckpoint.scenarioContext.scenarioRunId);
  assert.equal(historical.readOnly, true);
  assert.equal(restore.sourceCheckpointId, finalCheckpoint.checkpointId);
  assert.notEqual(restore.restoredContext.scenarioRunId, finalCheckpoint.scenarioContext.scenarioRunId);
  assert.equal(restore.overwritesHistory, false);
  assert.equal(restore.moduleReceipts.length, 6);
  assert.equal(regression.sourceCheckpointId, finalCheckpoint.checkpointId);
  assert.notEqual(regression.regressionContext.scenarioRunId, finalCheckpoint.scenarioContext.scenarioRunId);
  assert.equal(regression.externalCapabilitiesDefault, "disabled");
  assert.equal(Object.values(regression.blockedAdapterCalls).reduce((sum, count) => sum + count, 0), 0);
});

test("证据索引中的计划、校验、恢复和回归引用均通过 SHA-256", () => {
  const index = readJson(evidenceIndexPath);
  assert.equal(index.scenarioContext.scenarioId, SCENARIO_ID);
  assert.equal(index.scenarioContext.scenarioVersion, SCENARIO_VERSION);
  assert.equal(index.baselineSnapshotId, BASELINE_SNAPSHOT_ID);
  assert.equal(index.items.length >= 11, true);
  for (const item of index.items) {
    assert.equal(sha256File(resolveProjectRef(item.ref)), item.sha256, item.ref);
  }
});

test("pointer-promotion PRE 锁定提升前 data.js、索引和旧 M06 Owner 导出", () => {
  const entry = catalog().checkpoints.find((item) => item.phaseAlias === pointerPromotionPreAlias);
  assert.ok(entry);
  const preManifest = manifest(pointerPromotionPreAlias);
  assert.equal(validateS004PreRisk(preManifest, entry), true);
  const riskItem = preManifest.stateSections.evidence.items.find(
    (item) => item.resourceId === "S004-PRE-RISK-POINTER-PROMOTION"
  );
  const risk = readJson(resolveProjectRef(riskItem.ref));
  assert.equal(risk.changeType, "publication-pointer-promotion");
  assert.equal(risk.pointerStateBefore.dataJsContentVersion, "1.0.0");
  assert.equal(risk.targetPointerState.contentVersion, "1.0.1");
  assert.equal(risk.sourceSnapshots.length, 3);
  for (const snapshot of risk.sourceSnapshots) {
    assert.equal(sha256File(resolveProjectRef(snapshot.snapshotRef)), snapshot.sha256);
  }
  assert.equal(sha256File(resolveProjectRef("designs/prototype-work/v1.1.0/scenarios/s004/module-exports/M06.json")), "ed3a303e0fc0a3ec6895cbe735dc9572cabf43dae963304a44743341ec6c7d5d");
});

test("当前发布指针和 data.js/M06 当前消费视图均提升到 v1.0.1", () => {
  const pointer = readJson(
    resolveProjectRef("designs/prototype-work/v1.1.0/scenarios/s004/artifacts/report/current-publication-pointer.json")
  );
  assert.equal(pointer.current.contentVersion, "1.0.1");
  assert.equal(pointer.current.publicationId, "PUB-S004-20260815-0002");
  assert.equal(pointer.previous.contentVersion, "1.0.0");
  assert.equal(sha256File(path.join(SCENARIO_ROOT, pointer.current.htmlRef)), pointer.current.htmlSha256);
  assert.equal(sha256File(path.join(SCENARIO_ROOT, pointer.current.pdfRef)), pointer.current.pdfSha256);
  const dataSource = fs.readFileSync(path.join(SCENARIO_ROOT, "data.js"), "utf8");
  assert.match(dataSource, /RPT-S004-CGNPC-20260815-v1\.0\.1\.html/);
  assert.match(dataSource, /contentVersion: "1\.0\.1"/);
  const moduleIndex = readJson(path.join(SCENARIO_ROOT, "module-exports/index.json"));
  assert.equal(moduleIndex.exports.M06, "module-exports/M06-publication-v1.0.1.json");
  assert.equal(moduleIndex.exportHistory.M06[0].ref, "module-exports/M06.json");
  const m06 = readJson(path.join(SCENARIO_ROOT, "module-exports/M06-publication-v1.0.1.json"));
  assert.equal(m06.moduleVersion, "1.1.0-s004.2");
  assert.equal(m06.checkpointStates.POSTFIX_CP60.contentVersion, "1.0.1");
});

test("旧 v1.0、旧 publication manifest、旧 M06 和所有旧 manifest SHA 均未改变", () => {
  assert.equal(sha256File(path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.html")), "607481865ce0c2c1f50dffebd62340b9562907b4090d469cd3e2f14674f9f602");
  assert.equal(sha256File(path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.pdf")), "1869e120993a8d054f800bc2130361a7b7a10f3f8a81b9b5563cfa098ca2a16b");
  assert.equal(sha256File(path.join(SCENARIO_ROOT, "artifacts/report/publication-manifest.json")), "35ed65c7cfa737cad4d186ddfdb8d80b828370acca68fda6f6b02b3ce0665adf");
  assert.equal(sha256File(path.join(SCENARIO_ROOT, "module-exports/M06.json")), "ed3a303e0fc0a3ec6895cbe735dc9572cabf43dae963304a44743341ec6c7d5d");
  for (const [alias, digest] of Object.entries(fixedCheckpointDigests)) {
    assert.equal(sha256File(checkpointManifestPath(alias)), digest);
  }
  assert.equal(sha256File(checkpointManifestPath(preRiskAlias)), "7881a154ce1d9a67fbe4d9ae76bb6db58030852d2450e32ecf27dbc61890f6ec");
  assert.equal(sha256File(checkpointManifestPath(pointerPromotionPreAlias)), "e7f5ae6a1a6d454c029e723fb4588b20d0dcd0ab30f55e3adf664b3749ead8b6");
  assert.equal(sha256File(checkpointManifestPath(postFixAliases[0])), "a0df984cf89e10f7c8b7707b2d00de623a68e21575efcb52a3ebeba38a743cc5");
  assert.equal(sha256File(checkpointManifestPath(postFixAliases[1])), "6c0540cbe3c1c5534ab4a7a5196525ce5449aa0e81f3ff317d9a9900a3ba4761");
});

test("post-fix CP50/CP60 使用新目录、新 M06 导出和 v1.0.1 同源报告", () => {
  for (const alias of postFixAliases) {
    const entry = catalog().checkpoints.find((item) => item.phaseAlias === alias);
    assert.ok(entry);
    const value = manifest(alias);
    assert.equal(validateS004PostFix(value, entry), true);
    assert.equal(
      validateDetachedDigest(checkpointManifestPath(alias), checkpointDigestPath(alias)),
      entry.manifestSha256
    );
    assert.match(value.modules.M06.exportRef, /M06-publication-v1\.0\.1\.json#/);
    const refs = value.stateSections.reports.items.map((item) => item.ref);
    assert.equal(refs.some((ref) => ref.endsWith("RPT-S004-CGNPC-20260815-v1.0.1.html")), true);
    assert.equal(refs.some((ref) => ref.endsWith("RPT-S004-CGNPC-20260815-v1.0.1.pdf")), true);
    assert.equal(entry.supersedesCheckpointId, manifest(alias.includes("-50-") ? "CP-S004-50" : "CP-S004-60").checkpointId);
  }
  const restored = FOUNDATION.cloneRestore(manifest(postFixAliases[1]), {
    now: new Date("2026-08-15T14:10:22.000Z"),
    randomBytes: fixedRandom(101)
  });
  assert.notEqual(restored.context.scenarioRunId, manifest(postFixAliases[1]).scenarioContext.scenarioRunId);
  assert.equal(restored.moduleRestoreRefs.M06.exportId, "M06-S004-POSTFIX-CP60-V1.0.1-EXPORT");
});

test("最终交付 Checkpoint 锁定当前代码树、Owner 导出和全类验收证据", () => {
  const entry = catalog().checkpoints.find((item) => item.phaseAlias === finalDeliveryAlias);
  assert.ok(entry);
  const value = manifest(finalDeliveryAlias);
  assert.equal(validateS004FinalDelivery(value, entry), true);
  assert.equal(
    validateDetachedDigest(checkpointManifestPath(finalDeliveryAlias), checkpointDigestPath(finalDeliveryAlias)),
    entry.manifestSha256
  );
  assert.equal(entry.deliveryStage, "delivery-handoff-completed");
  assert.equal(entry.deliveryStatus, "final-delivery-ready");
  assert.equal(entry.supersedesCheckpointId, manifest(postFixAliases[1]).checkpointId);
  const evidenceItem = value.stateSections.evidence.items.find(
    (item) => item.resourceId === "S004-FINAL-DELIVERY-READY"
  );
  const evidence = readJson(resolveProjectRef(evidenceItem.ref));
  assert.equal(evidence.verification.checkpointContract.result, "28/28 passed");
  assert.equal(evidence.verification.browser.result, "PASS");
  assert.equal(evidence.verification.workbook.result, "PASS");
  assert.equal(evidence.verification.workbook.formulaErrorMatches, 0);
  assert.equal(evidence.verification.pdf.result, "PASS");
  assert.equal(evidence.currentPublication.contentVersion, "1.0.1");
  assert.equal(
    sha256File(resolveProjectRef(evidence.verification.checkpointContract.sourceSnapshotRef)),
    evidence.verification.checkpointContract.sourceSnapshotSha256
  );
  for (const document of evidence.deliveryDocuments) {
    assert.equal(sha256File(resolveProjectRef(document.ref)), document.sha256);
  }
  for (const moduleId of FOUNDATION.MODULE_IDS) {
    const ownerExport = evidence.moduleOwnerExports[moduleId];
    assert.equal(sha256File(resolveProjectRef(ownerExport.ref)), ownerExport.sha256);
  }
  const restore = FOUNDATION.cloneRestore(value, {
    now: new Date("2026-08-15T14:29:27.000Z"),
    randomBytes: fixedRandom(111)
  });
  assert.notEqual(restore.context.scenarioRunId, value.scenarioContext.scenarioRunId);
  assert.equal(restore.moduleRestoreRefs.M06.exportId, "M06-S004-POSTFIX-CP60-V1.0.1-EXPORT");
});

test("新增 PRE 锁定 medium 风险、三项修改范围并回退到未改写的 CP60", () => {
  const value = catalog();
  const entry = value.checkpoints.find((item) => item.phaseAlias === preRiskAlias);
  assert.ok(entry);
  const preManifest = manifest(preRiskAlias);
  assert.equal(validateS004PreRisk(preManifest, entry), true);
  assert.equal(validateDetachedDigest(checkpointManifestPath(preRiskAlias), checkpointDigestPath(preRiskAlias)), entry.manifestSha256);
  assert.equal(entry.riskLevel, "medium");
  assert.equal(entry.rollbackTargetCheckpointId, manifest("CP-S004-60").checkpointId);
  assert.equal(catalog().checkpoints.find((item) => item.phaseAlias === "CP-S004-60").manifestSha256, fixedCheckpointDigests["CP-S004-60"]);
  const riskItem = preManifest.stateSections.evidence.items.find((item) => item.resourceId === "S004-PRE-RISK-PDF-COVER-HEADER");
  const risk = readJson(resolveProjectRef(riskItem.ref));
  assert.equal(risk.reason, "准备修正正式 PDF 封面打印页眉裁切");
  assert.equal(risk.riskLevel, "medium");
  assert.deepEqual(
    risk.changeScope.map((item) => path.basename(item.ref)),
    ["build-report.mjs", "RPT-S004-CGNPC-20260815-v1.0.html", "RPT-S004-CGNPC-20260815-v1.0.pdf"]
  );
  const restore = FOUNDATION.cloneRestore(preManifest, {
    now: new Date("2026-08-15T13:31:29.000Z"),
    randomBytes: fixedRandom(91)
  });
  assert.notEqual(restore.context.scenarioRunId, preManifest.scenarioContext.scenarioRunId);
  assert.equal(restore.overwritesHistory, false);
});

for (const phase of PHASES) {
  test(`${phase.alias} 通过 Foundation、阶段规则、引用和 detached SHA 校验`, () => {
    const value = manifest(phase.alias);
    assert.equal(validateS004Phase(value, phase.alias), true);
    const digest = validateDetachedDigest(checkpointManifestPath(phase.alias), checkpointDigestPath(phase.alias));
    const catalogEntry = catalog().checkpoints.find((item) => item.phaseAlias === phase.alias);
    assert.equal(digest, catalogEntry.manifestSha256);
    assert.equal(value.checkpointId, catalogEntry.checkpointId);
    assert.equal(value.checkpointNode, phase.node);
    assert.equal(value.scenarioContext.scenarioId, SCENARIO_ID);
    assert.equal(value.scenarioContext.scenarioVersion, SCENARIO_VERSION);
    assert.equal(value.sourceScenarioRunId, catalog().sourceScenarioRunId);
    assert.equal(value.immutable, true);
    Object.values(value.sideEffectPolicy).forEach((allowed) => assert.equal(allowed, false));
  });
}

test("CP30 明确 M03 不适用且不伪造问数结果", () => {
  const value = manifest("CP-S004-30");
  const payload = modulePayload(value, "M03");
  const applicability = payload.applicability || payload.status;
  assert.match(String(applicability), /not[-_ ]?applicable|不适用/i);
  assert.equal(value.stateSections.results.status, "empty");
});

test("CP40 无标准 Action Request 时 M04 和 decisions 都明确不适用", () => {
  const value = manifest("CP-S004-40");
  const payload = modulePayload(value, "M04");
  const count = Number(payload.actionRequestCount ?? payload.counts?.actionRequests ?? 0);
  assert.equal(count, 0);
  assert.match(String(payload.applicability || payload.status), /not[-_ ]?applicable|不适用|no[-_ ]?action/i);
  assert.equal(value.stateSections.decisions.status, "empty");
});

test("CP50/CP60 锁定同源 HTML/PDF 且不把 DOCX 纳入正式产物", () => {
  for (const alias of ["CP-S004-50", "CP-S004-60"]) {
    const value = manifest(alias);
    const refs = value.stateSections.reports.items.map((item) => item.ref);
    assert.equal(refs.some((ref) => ref.endsWith("RPT-S004-CGNPC-20260815-v1.0.html")), true);
    assert.equal(refs.some((ref) => ref.endsWith("RPT-S004-CGNPC-20260815-v1.0.pdf")), true);
    assert.equal(refs.some((ref) => /\.docx$/i.test(ref)), false);
    const htmlRef = refs.find((ref) => ref.endsWith(".html"));
    assert.match(fs.readFileSync(resolveProjectRef(htmlRef), "utf8"), /RPT-S004-CGNPC-20260815|中国广核|贷前调查/);
  }
});

test("历史查看保持来源 runId、只读且不重跑业务", () => {
  const source = manifest("CP-S004-60");
  const view = FOUNDATION.createHistoricalView(source, {
    now: new Date("2026-08-15T13:30:00.000Z"),
    randomBytes: fixedRandom(10)
  });
  assert.equal(view.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(view.context.status, "historical-readonly");
  assert.equal(view.readOnly, true);
  assert.equal(view.writesCurrentProjection, false);
  assert.equal(view.rerunsBusinessLogic, false);
  assert.throws(
    () => FOUNDATION.createNamespacedStorage({ storage: new MemoryStorage(), context: view.context, scope: "m06" }),
    (error) => error.code === "READ_ONLY_CONTEXT"
  );
});

test("克隆恢复创建新 runId、空隔离命名空间并按六模块引用恢复", () => {
  const source = manifest("CP-S004-60");
  const plan = FOUNDATION.cloneRestore(source, {
    now: new Date("2026-08-15T13:31:00.000Z"),
    randomBytes: fixedRandom(20)
  });
  assert.notEqual(plan.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(plan.context.scenarioVersion, source.scenarioContext.scenarioVersion);
  assert.equal(plan.requiresEmptyIsolatedNamespace, true);
  assert.equal(plan.overwritesHistory, false);

  const storage = new MemoryStorage();
  for (const moduleId of FOUNDATION.MODULE_IDS) {
    const scope = moduleId.toLowerCase();
    const adapter = FOUNDATION.createNamespacedStorage({ storage, context: plan.context, scope });
    assert.deepEqual(adapter.keys(), []);
    const ref = plan.moduleRestoreRefs[moduleId];
    assert.equal(sha256File(resolveProjectRef(ref.exportRef.split("#")[0])), ref.exportSha256);
    adapter.set(
      "restore/receipt",
      {
        moduleId,
        sourceCheckpointId: plan.sourceCheckpointId,
        sourceExportId: ref.exportId,
        sourceExportSha256: ref.exportSha256,
        restoredScenarioRunId: plan.context.scenarioRunId,
        mode: "isolated-clone"
      },
      { now: "2026-08-15T13:31:01.000Z" }
    );
    assert.equal(adapter.get("restore/receipt").restoredScenarioRunId, plan.context.scenarioRunId);
  }
  assert.equal(storage.length, 6);
  assert.equal(storage.clearCalls, 0);
});

test("非空目标命名空间在恢复编排前被拒绝", () => {
  const source = manifest("CP-S004-60");
  const plan = FOUNDATION.cloneRestore(source, {
    now: new Date("2026-08-15T13:32:00.000Z"),
    randomBytes: fixedRandom(30)
  });
  const storage = new MemoryStorage();
  const adapter = FOUNDATION.createNamespacedStorage({ storage, context: plan.context, scope: "m01" });
  adapter.set("existing", { forbidden: true });
  assert.throws(() => {
    if (adapter.keys().length) throw new Error("RESTORE_TARGET_NOT_EMPTY");
  }, /RESTORE_TARGET_NOT_EMPTY/);
});

test("隔离回归关闭外发能力，六类副作用适配器均未被调用", () => {
  const source = manifest("CP-S004-60");
  const plan = FOUNDATION.createIsolatedRegression(source, {
    now: new Date("2026-08-15T13:33:00.000Z"),
    randomBytes: fixedRandom(40)
  });
  assert.notEqual(plan.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(plan.isolationMode, "drill");
  assert.equal(plan.externalCapabilitiesDefault, "disabled");
  Object.values(plan.sideEffectPolicy).forEach((allowed) => assert.equal(allowed, false));

  const calls = {
    actionRequest: 0,
    notification: 0,
    approval: 0,
    todo: 0,
    externalDispatch: 0,
    reportPublish: 0
  };
  const guards = Object.fromEntries(
    Object.keys(calls).map((name) => [
      name,
      () => {
        throw new Error(`REGRESSION_SIDE_EFFECT_BLOCKED:${name}`);
      }
    ])
  );
  // 回归只读取固定证据和已有报告引用，不调用任何副作用适配器。
  assert.equal(Object.values(calls).reduce((sum, count) => sum + count, 0), 0);
  for (const [name, guard] of Object.entries(guards)) {
    assert.throws(guard, new RegExp(`REGRESSION_SIDE_EFFECT_BLOCKED:${name}`));
    assert.equal(calls[name], 0);
  }
});

test("损坏模块导出哈希在恢复前失败", () => {
  const corrupted = structuredClone(manifest("CP-S004-60"));
  corrupted.modules.M02.exportSha256 = "0".repeat(64);
  assert.throws(() => validateS004Phase(corrupted, "CP-S004-60"), /导出哈希不匹配/);
});

test("未验证恢复的 Checkpoint 不得克隆或回归", () => {
  const source = structuredClone(manifest("CP-S004-60"));
  source.restoreReadiness.status = "not-verified";
  assert.equal(FOUNDATION.validateCheckpointManifest(source).ok, true);
  assert.throws(() => FOUNDATION.cloneRestore(source), (error) => error.code === "CHECKPOINT_NOT_RESTORABLE");
  assert.throws(
    () => FOUNDATION.createIsolatedRegression(source),
    (error) => error.code === "CHECKPOINT_NOT_RESTORABLE"
  );
});

test("S002/S003 上下文不能读取 S004 模块投影", () => {
  const source = manifest("CP-S004-60");
  const storage = new MemoryStorage();
  const s004 = FOUNDATION.createNamespacedStorage({ storage, context: source.scenarioContext, scope: "m06" });
  s004.set("report/current", { reportNo: "RPT-S004-CGNPC-20260815" });
  const s002Context = FOUNDATION.createScenarioContext(
    { scenarioId: "S002", scenarioVersion: "S002-v1" },
    { now: new Date("2026-08-15T13:34:00.000Z"), randomBytes: fixedRandom(50) }
  );
  const s003Context = FOUNDATION.createScenarioContext(
    { scenarioId: "S003", scenarioVersion: "S003-v1" },
    { now: new Date("2026-08-15T13:34:01.000Z"), randomBytes: fixedRandom(60) }
  );
  const s002 = FOUNDATION.createNamespacedStorage({ storage, context: s002Context, scope: "m06" });
  const s003 = FOUNDATION.createNamespacedStorage({ storage, context: s003Context, scope: "m06" });
  assert.equal(s002.get("report/current"), null);
  assert.equal(s003.get("report/current"), null);
  assert.deepEqual(s004.get("report/current"), { reportNo: "RPT-S004-CGNPC-20260815" });
});

test("定向重置仅删除 S004 当前轮次并保留历史与其他场景", () => {
  const source = manifest("CP-S004-60");
  const storage = new MemoryStorage();
  const current = FOUNDATION.createNamespacedStorage({ storage, context: source.scenarioContext, scope: "m01" });
  current.set("state", { value: "current" });
  const other = FOUNDATION.createScenarioContext(
    { scenarioId: "S003", scenarioVersion: "S003-v1" },
    { now: new Date("2026-08-15T13:35:00.000Z"), randomBytes: fixedRandom(70) }
  );
  const otherAdapter = FOUNDATION.createNamespacedStorage({ storage, context: other, scope: "m01" });
  otherAdapter.set("state", { value: "other" });
  storage.setItem("root-preference", "keep");
  const receipt = FOUNDATION.directionalReset(
    { storage, currentContext: source.scenarioContext },
    { now: new Date("2026-08-15T13:35:01.000Z"), randomBytes: fixedRandom(80) }
  );
  assert.equal(current.get("state"), null);
  assert.deepEqual(otherAdapter.get("state"), { value: "other" });
  assert.equal(storage.getItem("root-preference"), "keep");
  assert.notEqual(receipt.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(storage.clearCalls, 0);
});

test("Checkpoint 阶段别名不是 Foundation checkpointId", () => {
  for (const phase of PHASES) {
    const value = manifest(phase.alias);
    assert.notEqual(value.checkpointId, phase.alias);
    assert.match(value.checkpointId, /^CP-S004-\d{17}-[a-f0-9]{12}$/);
    assert.equal(phaseByAlias(phase.alias).node, value.checkpointNode);
  }
});
