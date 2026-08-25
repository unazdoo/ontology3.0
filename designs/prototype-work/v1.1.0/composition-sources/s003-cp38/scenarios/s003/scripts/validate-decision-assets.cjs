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
  throw new Error(message);
}

function resolveRef(ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..") || ref.startsWith("/")) fail(`非法引用: ${String(ref)}`);
  const absolute = path.resolve(packageRoot, ref);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) fail(`引用越出 S003 包: ${ref}`);
  return absolute;
}

function readJson(ref) {
  const file = resolveRef(ref);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`文件不存在: ${ref}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256File(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveRef(ref))).digest("hex");
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${message}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
  }
}

function main() {
  const source = readJson(SOURCE_REF);
  const binding = readJson(BINDING_REF);
  const runtime = readJson(RUNTIME_REF);
  if (runtime.schemaVersion !== "ofw.s003.m04.decision-runtime.v1") fail("M04 runtime schemaVersion 无效");
  if (runtime.moduleId !== "M04" || !runtime.serviceRef || runtime.serviceRef !== "domain/decision-service.js") fail("M04 runtime 服务绑定无效");
  if (binding.automaticCreation !== false || binding.requiresHumanConfirmation !== true) fail("M04 binding 边界无效");
  const bindingRef = runtime.bindingRef || runtime.binding?.ref;
  const bindingSha = runtime.bindingSha256 || runtime.binding?.sha256;
  if (bindingRef !== BINDING_REF || bindingSha !== sha256File(BINDING_REF)) fail("M04 binding SHA-256 不匹配");

  const context = foundation.assertScenarioContext(source.scenarioIdentity);
  assertEqual(runtime.scenarioIdentity, context, "runtime 场景上下文不一致");
  const service = decisionService.createDecisionService({
    scenarioContext: context,
    c035Results: source,
    publicationStatus: "PUBLISHED"
  });
  const candidates = service.listCandidates();
  const sourceCount = runtime.source?.c035ResultCount ?? source.results.length;
  const runtimeCandidateCount = runtime.source?.candidateCount ?? runtime.candidateSummary?.total;
  assertEqual(sourceCount, source.results.length, "C035 结果数量不一致");
  if (runtimeCandidateCount !== undefined) assertEqual(runtimeCandidateCount, candidates.length, "候选数量不一致");
  if (runtime.candidateSummary?.candidateIds) {
    assertEqual(runtime.candidateSummary.candidateIds, candidates.map((candidate) => candidate.candidateId), "候选 ID 不一致");
  }
  if (runtime.candidateSummary?.actionTypeIds) {
    assertEqual(
      runtime.candidateSummary.actionTypeIds,
      [...new Set(candidates.map((candidate) => candidate.actionTypeId))].sort(),
      "Action Type 清单不一致"
    );
  }
  for (const candidate of candidates) {
    if (
      candidate.status !== "CANDIDATE_AWAITING_HUMAN_CONFIRMATION"
      || candidate.requiresHumanConfirmation !== true
    ) fail(`候选越过人工确认门: ${candidate.candidateId}`);
  }
  const sideEffects = runtime.sideEffects || {};
  const automaticActionRequest = sideEffects.automaticActionRequest ?? sideEffects.automaticCandidateCreation;
  const automaticTodo = sideEffects.automaticTodo ?? (sideEffects.todoCreatedOnlyAfterConfirmation === false);
  if (automaticActionRequest !== false) fail("不得自动创建候选 Action Request");
  if (sideEffects.actionRequestCreatedOnlyAfterConfirmation === false) fail("Action Request 必须经过人工确认");
  if (sideEffects.todoCreatedOnlyAfterConfirmation === false) fail("负责人待办必须经过人工确认");
  if (sideEffects.historicalReplayAllowed === true || sideEffects.regressionReplayAllowed === true) {
    fail("历史/回归副作用重放必须关闭");
  }
  if (automaticTodo === true) fail("不得自动创建负责人待办");
  process.stdout.write(`M04 decision assets valid: ${candidates.length} candidates\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
