#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const foundation = require("../../../foundation/ofw-scenario-foundation.js");
const decisionService = require("../domain/decision-service.js");

const packageRoot = path.resolve(__dirname, "..");
const SOURCE_REF = "resources/m01/c035-risk-results.v1.json";
const FACTS_REF = "resources/m01/published-risk-facts.v1.json";
const RUNTIME_REF = "resources/m04/decision-runtime.v1.json";
const RESULTS_REF = "resources/m04/decision-results.v1.json";
const EVIDENCE_REF = "evidence/CP05-decision-chain-validation.md";
const CONFIRMED_AT = "2026-08-15T14:32:00.000Z";

function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
function resolveRef(ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..") || ref.startsWith("/")) fail(`非法包内引用: ${String(ref)}`);
  const absolute = path.resolve(packageRoot, ref);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) fail(`引用越出 S003 包: ${ref}`);
  return absolute;
}
function readJson(ref) {
  const absolute = resolveRef(ref);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`文件不存在: ${ref}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(ref) { return sha256(fs.readFileSync(resolveRef(ref))); }
function bytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function writeOrVerify(ref, value, writeMode) {
  const target = resolveRef(ref);
  const content = Buffer.isBuffer(value) ? value : bytes(value);
  const digest = sha256(content);
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(target).equals(content)) fail(`${ref} 已存在但内容不匹配，拒绝覆盖`);
  } else if (!writeMode) {
    fail(`${ref} 不存在；使用 --write 生成不可变运行时资源`);
  } else {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content, {flag: "wx"});
  }
  return digest;
}

function buildResultSet() {
  const source = readJson(SOURCE_REF);
  const facts = readJson(FACTS_REF);
  const context = foundation.assertScenarioContext(source.scenarioIdentity);
  const service = decisionService.createDecisionService({
    scenarioContext: context,
    c035Results: source,
    publicationStatus: "PUBLISHED",
    now: () => CONFIRMED_AT
  });
  const candidates = service.listCandidates();
  const selected = candidates.find((candidate) => candidate.actionTypeId === "S003_SPECIAL_DISPOSAL");
  if (!selected) fail("CP05 未找到红灯处置候选");
  const confirmation = service.confirmCandidate(selected.candidateId, {
    confirmed: true,
    owner: "集团债务风险管理负责人",
    note: "按通用决策中心红灯处置规则推动负责人待办；一期不启用多级审批。",
    confirmedAt: CONFIRMED_AT
  });
  const confirmed = service.listConfirmed();
  return {
    schemaVersion: "ofw.s003.m04.decision-results.v1",
    moduleId: "M04",
    moduleOwner: "决策中心",
    resultSetId: "S003-M04-DECISION-RESULTS-20260815-001",
    resultSetVersion: "1.0.0",
    status: "decision-chain-completed",
    immutable: true,
    formedAt: "2026-08-15T14:30:00.000Z",
    scenarioIdentity: context,
    assessmentAt: source.assessmentAt,
    candidateSummary: {
      total: candidates.length,
      awaitingHumanConfirmation: candidates.length - 1,
      confirmed: confirmed.length,
      actionRequestsCreated: confirmed.filter((record) => record.created).length,
      todosCreated: confirmed.filter((record) => record.created && record.todo).length,
      notificationsDispatched: 0,
      approvalsStarted: 0
    },
    candidatesBeforeConfirmation: candidates,
    confirmedDecision: confirmation,
    confirmations: confirmed,
    policy: {
      owner: "财务公司",
      primaryUser: "集团债务风险管理人员",
      humanConfirmationRequired: true,
      reviewer: null,
      multiLevelApproval: false,
      multiUserPermissions: false,
      target: "负责人待办",
      sourceContracts: ["C011", "C019", "C033", "C035"]
    },
    source: {
      c035Results: {ref: SOURCE_REF, sha256: sha256File(SOURCE_REF)},
      publishedFacts: {ref: FACTS_REF, sha256: sha256File(FACTS_REF)},
      decisionRuntime: {ref: RUNTIME_REF, sha256: sha256File(RUNTIME_REF)}
    },
    sideEffects: {
      automaticActionRequest: false,
      automaticTodo: false,
      actionRequestCreatedOnlyAfterHumanConfirmation: true,
      notificationsDispatched: false,
      approvalsStarted: false,
      externalDispatch: false
    },
    factsCount: facts.facts.length
  };
}

function main() {
  const writeMode = process.argv.includes("--write");
  const resultSet = buildResultSet();
  const resultHash = writeOrVerify(RESULTS_REF, resultSet, writeMode);
  const evidence = `# CP05 通用决策链验证\n\n` +
    `- 形成时间：${resultSet.formedAt}\n` +
    `- 场景运行：\`${resultSet.scenarioIdentity.scenarioRunId}\`\n` +
    `- 候选总数：${resultSet.candidateSummary.total}\n` +
    `- 人工确认：${resultSet.candidateSummary.confirmed} 条红灯处置候选\n` +
    `- Action Request：${resultSet.candidateSummary.actionRequestsCreated}\n` +
    `- 负责人待办：${resultSet.candidateSummary.todosCreated}\n` +
    `- 通知：0；审批流程：0；多用户权限：关闭\n\n` +
    `## 边界\n\n` +
    `- 候选不会自动创建 Action Request。\n` +
    `- 只有人工确认并指定负责人后，才通过通用决策中心入口生成 Action Request 和负责人待办。\n` +
    `- 一期不设置复核人、不建设多级审批和多用户经办权限。\n` +
    `- 隔离回归使用 regression 模式，历史处置不重放。\n\n` +
    `## 资源哈希\n\n` +
    `- \`${sha256File(RUNTIME_REF)}  ${RUNTIME_REF}\`\n` +
    `- \`${resultHash}  ${RESULTS_REF}\`\n`;
  const evidenceHash = writeOrVerify(EVIDENCE_REF, Buffer.from(evidence, "utf8"), writeMode);
  process.stdout.write(`${resultHash}  ${RESULTS_REF}\n${evidenceHash}  ${EVIDENCE_REF}\n`);
}

main();
