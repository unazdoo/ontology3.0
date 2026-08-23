#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const Foundation = require("../../../foundation/ofw-scenario-foundation.js");
const Contracts = require("../modules/owner-state-contracts.cjs");
const Generator = require("./generate-checkpoints.cjs");

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

function resolveRef(ref) {
  const absolute = path.resolve(scenarioRoot, String(ref || "").split("#", 1)[0]);
  assert(absolute.startsWith(`${scenarioRoot}${path.sep}`), `引用越出S002场景目录：${ref}`);
  return absolute;
}

function verifyFile(ref, expectedSha) {
  const absolute = resolveRef(ref);
  assert(fs.existsSync(absolute), `引用文件不存在：${ref}`);
  assert(sha256(fs.readFileSync(absolute)) === expectedSha, `SHA-256不匹配：${ref}`);
  return absolute;
}

function sameContext(left, right) {
  return ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => left?.[field] === right?.[field]);
}

function validateModule(moduleId, entry, manifest) {
  const exportPath = verifyFile(entry.exportRef, entry.exportSha256);
  const exported = readJson(exportPath);
  const errors = Contracts.validateModuleExport(exported, { moduleId, checkpointNode: manifest.checkpointNode });
  assert(errors.length === 0, `${moduleId}模块导出无效：${errors.join("；")}`);
  assert(sameContext(exported.scenarioContext, manifest.scenarioContext), `${moduleId}场景身份错配`);
  assert(exported.runtimeState.moduleId === moduleId, `${moduleId}运行状态Owner错配`);
  assert(exported.runtimeState.moduleVersion === entry.moduleVersion, `${moduleId}运行状态版本错配`);
  const receipt = readJson(resolveRef(entry.validation.evidenceRef));
  assert(receipt.exportSha256 === entry.exportSha256, `${moduleId}Owner回执摘要错配`);
  assert(receipt.validationStatus === "verified", `${moduleId}Owner回执未验证`);
  assert(receipt.validationScope === "prototype-scenario-adapter", `${moduleId}Owner回执未声明原型适配器边界`);
  assert(Object.values(receipt.checks).every((value) => String(value).startsWith("verified")), `${moduleId}Owner检查未通过`);
  return exported;
}

function validateStateSections(manifest) {
  for (const [name, section] of Object.entries(manifest.stateSections)) {
    if (section.status === "referenced") {
      assert(section.items.length > 0, `${name}引用分区为空`);
      section.items.forEach((item) => verifyFile(item.ref, item.sha256));
    } else {
      assert(section.items.length === 0 && section.reason, `${name}空分区缺少原因`);
    }
  }
}

function validateRestoreEvidence(manifest) {
  const evidence = readJson(resolveRef(manifest.restoreReadiness.evidenceRef));
  assert(evidence.schemaVersion === "ofw.s002.restore-validation.v2", "恢复校验schema错误");
  assert(evidence.checkpointId === manifest.checkpointId, "恢复校验checkpointId错配");
  assert(evidence.validationScope === "prototype-scenario-adapter", "恢复校验未声明原型边界");
  assert(evidence.historicalView.status === "verified" && evidence.historicalView.readOnly && evidence.historicalView.writeRejected, "历史只读验证失败");
  assert(evidence.cloneRestore.status === "verified" && evidence.cloneRestore.createsNewScenarioRunId && evidence.cloneRestore.projectionMatches, "克隆恢复验证失败");
  assert(evidence.cloneRestore.externalSideEffectsReplayed === false, "克隆恢复重放外部副作用");
  assert(evidence.isolatedRegression.status === "verified" && evidence.isolatedRegression.createsNewScenarioRunId, "隔离回归验证失败");
  assert(evidence.isolatedRegression.historicalActionRequestReplayCount === 0 && evidence.isolatedRegression.historicalTodoReplayCount === 0, "隔离回归重放历史决策副作用");
  assert(Object.values(evidence.sideEffectPolicy).every((value) => value === false), "恢复副作用策略未全量关闭");
}

function validateAll() {
  const catalogPath = path.join(scenarioRoot, "checkpoints/checkpoint-catalog.json");
  assert(fs.existsSync(catalogPath), "缺少当前Checkpoint目录");
  const catalog = readJson(catalogPath);
  assert(catalog.schemaVersion === "ofw.s002.checkpoint-catalog.v2", "Checkpoint目录schema错误");
  assert(catalog.catalogRole === "mutable-current-index", "当前目录未声明为可变索引");
  assert(catalog.baselineVersion === Contracts.BASELINE_VERSION && catalog.baselineSnapshotId === Contracts.BASELINE_SNAPSHOT_ID, "Checkpoint目录父基线错配");
  assert(catalog.checkpoints.length === 8, "Checkpoint节点数量不是8");
  assert(fs.existsSync(resolveRef(catalog.immutableArchiveRoot)), "不可变运行归档目录不存在");
  const currentCodeHash = Generator.computeCodeHash();
  assert(catalog.code.treeSha256 === currentCodeHash, `代码树发生漂移：当前=${currentCodeHash}，目录=${catalog.code.treeSha256}`);

  const seenIds = new Set();
  const nodes = new Set();
  let ownerReceiptCount = 0;
  for (const item of catalog.checkpoints) {
    const manifestPath = verifyFile(item.file, item.sha256);
    const manifest = readJson(manifestPath);
    assert(Foundation.validateCheckpointManifest(manifest).ok, `${item.id} Foundation清单校验失败`);
    assert(manifest.scenarioContext.scenarioRunId === catalog.sourceScenarioRunId, `${item.id}不属于当前真实运行`);
    assert(manifest.code.treeSha256 === currentCodeHash, `${item.id}代码哈希错配`);
    assert(!seenIds.has(manifest.checkpointId), `Checkpoint ID重复：${manifest.checkpointId}`);
    seenIds.add(manifest.checkpointId);
    nodes.add(manifest.checkpointNode);
    for (const [moduleId, entry] of Object.entries(manifest.modules)) {
      validateModule(moduleId, entry, manifest);
      ownerReceiptCount += 1;
    }
    validateStateSections(manifest);
    validateRestoreEvidence(manifest);
    const currentLink = path.join(scenarioRoot, "checkpoints/current", path.basename(item.file));
    assert(fs.lstatSync(currentLink).isSymbolicLink(), `${item.id}当前入口不是符号链接`);
    assert(fs.realpathSync(currentLink) === fs.realpathSync(manifestPath), `${item.id}当前入口未指向不可变归档`);
  }
  assert(nodes.size === 8, "Checkpoint节点存在重复或缺失");
  const pre = catalog.checkpoints.find((item) => item.id === "CP-PRE");
  const cp01 = catalog.checkpoints.find((item) => item.id === "CP01");
  const cp02 = catalog.checkpoints.find((item) => item.id === "CP02");
  assert(Date.parse(cp01.createdAt) < Date.parse(pre.createdAt) && Date.parse(pre.createdAt) < Date.parse(cp02.createdAt), "CP-PRE未形成于真实高风险数据接入之前");
  const cp07 = readJson(resolveRef(catalog.checkpoints.find((item) => item.id === "CP07").file));
  const m04 = readJson(resolveRef(cp07.modules.M04.exportRef)).runtimeState;
  const m06 = readJson(resolveRef(cp07.modules.M06.exportRef)).runtimeState;
  assert(m04.actionRequests.length === 0, "CP07当前范围不应形成Action Request");
  assert(m04.decisionAlerts.length === 0, "CP07当前范围不应形成决策提醒");
  assert(m04.todos.length === 0, "CP07当前范围不应形成平台内待办");
  assert(m04.actionPolicy === "disabled-for-s002-current-scope", "CP07未锁定当前决策触发边界");
  assert(m04.decisionSummary.status === "no-runtime-actions", "CP07决策摘要未声明零运行事项");
  assert(m06.reports.every((item) => item.status === "draft" && item.t049Ref === null), "Dashboard发布错误地发布了正式报告");
  assert(m06.dashboardVersions.length === 1 && m06.dashboardVersions[0].status === "published", "CP07缺少独立Dashboard Version");
  return { catalog, ownerReceiptCount, currentCodeHash };
}

if (require.main === module) {
  try {
    const result = validateAll();
    process.stdout.write(`S002 Checkpoint校验通过：${result.catalog.checkpoints.length}个节点；${result.ownerReceiptCount}份Owner回执；code=${result.currentCodeHash}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({ validateAll });
