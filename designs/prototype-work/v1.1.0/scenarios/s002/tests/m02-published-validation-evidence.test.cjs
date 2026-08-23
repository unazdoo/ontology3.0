"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const entryRef = "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html";
const adapterRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

function validationApi() {
  const entry = read(entryRef);
  const start = entry.indexOf("  function validationChecksFingerprint(");
  const end = entry.indexOf("  function materializeProjectedS002ValidationEvidence(", start);
  assert.ok(start > -1 && end > start, "无法定位M02校验证据纯函数");
  const sandbox = {
    copy(value) { return JSON.parse(JSON.stringify(value)); },
    stableString(value) { return JSON.stringify(value); }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${entry.slice(start, end)}; api={validationResultSnapshot,validationSnapshotIntegrity,validationEvidenceState};`, sandbox);
  return sandbox.api;
}

function result(fingerprint = "fp-definition-input-v1", refreshOkay = false) {
  const checks = [
    ["structure", true], ["edges", true], ["slots", true], ["inputs", true],
    ["python", true], ["quality", true], ["asset", true], ["refresh", false]
  ].map(([id, blocking]) => ({
    id,
    name: id,
    content: `${id}-contract`,
    okay: id === "refresh" ? refreshOkay : true,
    blocking,
    issues: id === "refresh" && !refreshOkay ? ["目标绑定尚未就绪"] : [],
    impact: id === "refresh" && !refreshOkay ? "不阻断发布定义" : "无",
    recovery: id === "refresh" ? "刷新前重读目标绑定" : "无需处理",
    focus: id
  }));
  return {
    okay: true,
    refreshReady: refreshOkay,
    passed: checks.filter((item) => item.okay).length,
    failed: checks.filter((item) => !item.okay && item.blocking).length,
    warnings: checks.filter((item) => !item.okay && !item.blocking).length,
    fingerprint,
    checks
  };
}

function publishedCanvas(snapshot, definitionVersion = snapshot.definitionVersion) {
  return {
    mode: "published",
    definitionLabel: definitionVersion,
    validationSeen: true,
    validationFingerprint: snapshot.fingerprint,
    validationResult: snapshot
  };
}

test("M02已发布定义只消费同版、同输入配置且完整的冻结校验结果", function () {
  const api = validationApi();
  for (const definitionVersion of ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]) {
    const current = result(`fp-${definitionVersion}`);
    const snapshot = api.validationResultSnapshot(current, definitionVersion, "2026-08-15 16:00:00", {
      ownerModule: "M02",
      ownerModuleVersion: "S002-M02-1.0.0",
      definitionVersion
    });
    const state = api.validationEvidenceState(publishedCanvas(snapshot), current, true);

    assert.equal(api.validationSnapshotIntegrity(snapshot), true, `${definitionVersion} 校验快照完整性失败`);
    assert.equal(state.status, "current", `${definitionVersion} 未取得当前冻结证据`);
    assert.equal(state.seen, true);
    assert.equal(state.result.definitionVersion, definitionVersion);
    assert.equal(state.result.checks.length, 8);
    assert.equal(state.result.warnings, 1);
  }
});

test("M02输入版本或管道配置变化时冻结证据失配并阻断成功展示", function () {
  const api = validationApi();
  const snapshot = api.validationResultSnapshot(result(), "S002-PIPE-BUDGET-v1", "2026-08-15 16:00:00");
  const canvas = publishedCanvas(snapshot);

  assert.equal(api.validationEvidenceState(canvas, result("fp-input-version-v2"), true).status, "stale", "输入版本变化必须阻断");
  assert.equal(api.validationEvidenceState(canvas, result("fp-pipeline-config-v2"), true).status, "stale", "配置变化必须阻断");

  const changedBlocking = result();
  changedBlocking.checks[0].okay = false;
  changedBlocking.checks[0].issues = ["节点组成变化"];
  changedBlocking.passed = 6;
  changedBlocking.failed = 1;
  changedBlocking.okay = false;
  assert.equal(api.validationEvidenceState(canvas, changedBlocking, true).status, "stale", "阻断性检查结果变化必须阻断");
});

test("M02缺少历史validationResult或定义版本不一致时不得伪装为通过", function () {
  const api = validationApi();
  const current = result();
  const missing = api.validationEvidenceState({ definitionLabel: "S002-PIPE-BUDGET-v1", validationSeen: true, validationFingerprint: current.fingerprint }, current, true);
  assert.equal(missing.status, "missing");
  assert.equal(missing.seen, false);

  const wrongVersion = api.validationResultSnapshot(current, "S002-PIPE-v2", "2026-08-15 16:00:00");
  assert.equal(api.validationEvidenceState(publishedCanvas(wrongVersion, "S002-PIPE-BUDGET-v1"), current, true).status, "stale");

  const tampered = api.validationResultSnapshot(current, "S002-PIPE-BUDGET-v1", "2026-08-15 16:00:00");
  tampered.checks[0].issues.push("篡改项");
  assert.equal(api.validationSnapshotIntegrity(tampered), false);
  assert.equal(api.validationEvidenceState(publishedCanvas(tampered), current, true).status, "stale");
});

test("M02发布后动态刷新门状态变化不应误报为配置或输入变化", function () {
  const api = validationApi();
  const frozen = result("fp-definition-input-v1", false);
  const snapshot = api.validationResultSnapshot(frozen, "S002-PIPE-BUDGET-v1", "2026-08-15 16:00:00");
  const current = result("fp-definition-input-v1", true);
  const state = api.validationEvidenceState(publishedCanvas(snapshot), current, true);

  assert.equal(state.status, "current");
  assert.equal(state.result.refreshReady, false, "底栏应展示发布时冻结的逐项结果，而非改写历史证据");
  assert.equal(state.result.warnings, 1);
});

test("M02 Owner投影由真实校验逻辑形成快照，场景DOM适配器不得硬改底栏成功", function () {
  const entry = read(entryRef);
  const adapter = read(adapterRef);
  const materializeStart = entry.indexOf("  function materializeProjectedS002ValidationEvidence(");
  const materializeEnd = entry.indexOf("  function trialValidationResult(", materializeStart);
  const materialize = entry.slice(materializeStart, materializeEnd);

  assert.equal(entry.includes("S002-PIPE-v1-VALIDATED"), false, "不得继续使用固定字符串冒充校验指纹");
  for (const token of [
    'schemaVersion:"ofw.s002.m02-owner-validation-source.v1"',
    'component.qualityReceiptId===receipt.receiptId',
    'component.snapshotId===snapshot.snapshotId',
    'definitions=flow.publishedDefinitions.filter',
    'materialized===definitions.length',
    'materializeProjectedS002ValidationEvidence();',
    'const result=validationResult();',
    'definition.validationResult=snapshot',
    'validationEvidenceState(ui.canvas,current,!draft)',
    'record.validationResult=validationResultSnapshot(validation,version'
  ]) assert.ok(entry.includes(token), `M02真实校验证据链缺少：${token}`);

  assert.equal(/localStorage\.setItem|:m01:owned-state|:m03:owned-state|:m04:owned-state|:m05:owned-state|:m06:owned-state/.test(materialize), false, "M02校验证据修复不得写入其他Owner State");
  assert.equal(/validationFingerprint|validationResult|validation-row|管道定义安全检查|发布前校验证据/.test(adapter), false, "S002 DOM适配器不得直接伪造底栏校验成功");
});
