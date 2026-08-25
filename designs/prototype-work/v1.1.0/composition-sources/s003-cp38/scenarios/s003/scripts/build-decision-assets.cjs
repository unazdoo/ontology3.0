#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const foundation = require("../../../foundation/ofw-scenario-foundation.js");
const decisionService = require("../domain/decision-service.js");

const packageRoot = path.resolve(__dirname, "..");
const SOURCE_REF = "resources/m01/c035-risk-results.v1.json";
const BINDING_REF = "resources/m04/decision-binding.v1.json";
const RUNTIME_REF = "resources/m04/decision-runtime.v1.json";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function resolveRef(ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..") || ref.startsWith("/")) {
    fail(`非法包内引用: ${String(ref)}`);
  }
  const absolute = path.resolve(packageRoot, ref);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) fail(`引用越出 S003 包: ${ref}`);
  return absolute;
}

function readJson(ref) {
  const absolute = resolveRef(ref);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`文件不存在: ${ref}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(ref) {
  return sha256(fs.readFileSync(resolveRef(ref)));
}

function serialize(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeOrVerify(ref, bytes, writeMode) {
  const target = resolveRef(ref);
  const digest = sha256(bytes);
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target);
    if (!existing.equals(bytes)) fail(`${ref} 已存在但内容不匹配，拒绝覆盖`);
    return digest;
  }
  if (!writeMode) fail(`${ref} 不存在；使用 --write 生成不可变运行时资源`);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, bytes, {flag: "wx"});
  return digest;
}

function verifyExistingRuntime(runtime, source, binding) {
  if (!runtime || runtime.schemaVersion !== "ofw.s003.m04.decision-runtime.v1") {
    fail(`${RUNTIME_REF} schemaVersion 无效`);
  }
  if (runtime.moduleId !== "M04" || !runtime.serviceRef || runtime.serviceRef !== "domain/decision-service.js") {
    fail(`${RUNTIME_REF} 缺少 M04 服务绑定`);
  }
  const bindingRef = runtime.bindingRef || runtime.binding?.ref;
  const bindingSha = runtime.bindingSha256 || runtime.binding?.sha256;
  if (bindingRef !== BINDING_REF || bindingSha !== sha256File(BINDING_REF)) {
    fail(`${RUNTIME_REF} 的决策合同引用或 SHA-256 不匹配`);
  }
  const sourceIdentity = runtime.scenarioIdentity;
  if (!sourceIdentity || sourceIdentity.scenarioId !== source.scenarioIdentity.scenarioId
      || sourceIdentity.scenarioVersion !== source.scenarioIdentity.scenarioVersion
      || sourceIdentity.scenarioRunId !== source.scenarioIdentity.scenarioRunId) {
    fail(`${RUNTIME_REF} 场景身份与 C035 结果集不一致`);
  }
  const sideEffects = runtime.sideEffects || {};
  const automaticActionRequest = sideEffects.automaticActionRequest ?? sideEffects.automaticCandidateCreation;
  const automaticTodo = sideEffects.automaticTodo ?? (sideEffects.todoCreatedOnlyAfterConfirmation === false);
  if (automaticActionRequest !== false || automaticTodo !== false) {
    fail(`${RUNTIME_REF} 不得开启自动 Action Request/待办`);
  }
  const guards = new Set(runtime.guards || []);
  if (!guards.has("requires-human-confirmation") && runtime.confirmation?.required !== true) {
    fail(`${RUNTIME_REF} 缺少人工确认门`);
  }
  if (!guards.has("historical-replay-blocked") && runtime.sideEffects?.historicalReplayAllowed !== false) {
    fail(`${RUNTIME_REF} 未关闭历史副作用重放`);
  }
  if (!guards.has("drill-external-side-effects-disabled") && runtime.sideEffects?.regressionReplayAllowed !== false) {
    fail(`${RUNTIME_REF} 未关闭回归副作用重放`);
  }
  return true;
}

function buildRuntime(source, binding) {
  const scenarioContext = foundation.assertScenarioContext(source.scenarioIdentity);
  const service = decisionService.createDecisionService({
    scenarioContext,
    c035Results: source,
    publicationStatus: "PUBLISHED"
  });
  const candidates = service.listCandidates();
  const actionTypeIds = [...new Set(candidates.map((candidate) => candidate.actionTypeId))].sort();
  const riskTierCounts = candidates.reduce((counts, candidate) => {
    counts[candidate.riskTier] = (counts[candidate.riskTier] || 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: "ofw.s003.m04.decision-runtime.v1",
    moduleId: "M04",
    moduleOwner: "决策中心",
    runtimeId: "S003-M04-DECISION-RUNTIME",
    runtimeVersion: "1.0.0",
    status: "implemented-generic-decision-binding",
    formedAt: source.formedAt || scenarioContext.formedAt,
    scenarioIdentity: scenarioContext,
    serviceRef: "domain/decision-service.js",
    binding: {
      ref: BINDING_REF,
      sha256: sha256File(BINDING_REF),
      bindingId: binding.bindingId,
      bindingVersion: binding.bindingVersion
    },
    source: {
      resultSetId: source.resultSetId || null,
      resultSetVersion: source.resultSetVersion || null,
      ref: SOURCE_REF,
      sha256: sha256File(SOURCE_REF),
      schemaVersion: source.schemaVersion,
      status: source.status,
      c035ResultCount: source.results.length,
      candidateCount: candidates.length
    },
    candidateSummary: {
      candidateIds: candidates.map((candidate) => candidate.candidateId),
      actionTypeIds,
      riskTierCounts
    },
    confirmation: {
      required: true,
      fields: ["confirmed", "owner", "note"],
      ownerRequired: true,
      noteOptional: true,
      duplicateConfirmation: "idempotent-no-new-record",
      noMultiUserPermissions: true,
      noMultiLevelApproval: true
    },
    idempotencyKey: binding.idempotencyKey,
    sideEffects: {
      automaticCandidateCreation: false,
      actionRequestRequiresHumanConfirmation: true,
      actionRequestCreatedOnlyAfterConfirmation: true,
      todoCreatedOnlyAfterConfirmation: true,
      notificationsSent: false,
      externalDispatch: false,
      historicalReplayAllowed: false,
      regressionReplayAllowed: false
    },
    contracts: ["C011", "C019", "C033", "C035"]
  };
}

function main() {
  const writeMode = process.argv.includes("--write");
  const source = readJson(SOURCE_REF);
  const binding = readJson(BINDING_REF);
  if (!Array.isArray(source.results)) fail("C035 结果集缺少 results 数组");
  if (binding.automaticCreation !== false || binding.requiresHumanConfirmation !== true) {
    fail("M04 通用决策合同的人工确认/禁止自动创建边界不正确");
  }
  const runtime = buildRuntime(source, binding);
  const bytes = serialize(runtime);
  const existingRuntimePath = resolveRef(RUNTIME_REF);
  if (fs.existsSync(existingRuntimePath)) {
    const existingRuntime = readJson(RUNTIME_REF);
    // A concurrently materialized immutable runtime may use an equivalent
    // contract shape. Validate it semantically and never overwrite it.
    verifyExistingRuntime(existingRuntime, source, binding);
    process.stdout.write(`${sha256File(RUNTIME_REF)}  ${RUNTIME_REF} (existing immutable runtime verified)\n`);
    return;
  }
  const digest = writeOrVerify(RUNTIME_REF, bytes, writeMode);
  process.stdout.write(`${digest}  ${RUNTIME_REF}\n`);
}

main();
