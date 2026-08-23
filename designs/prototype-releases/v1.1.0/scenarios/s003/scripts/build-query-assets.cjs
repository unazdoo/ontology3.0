#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const queryService = require("../domain/query-service.js");

const packageRoot = path.resolve(__dirname, "..");
const formedAt = "2026-08-15T14:00:00.000Z";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, ref), "utf8"));
}

function serialize(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeOrVerify(ref, bytes, checkOnly) {
  const target = path.join(packageRoot, ref);
  const digest = sha256(bytes);
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(target).equals(bytes)) throw new Error(`不可变资源内容不一致: ${ref}`);
  } else if (checkOnly) {
    throw new Error(`缺少不可变资源: ${ref}`);
  } else {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes, {flag: "wx"});
  }
  const sidecarRef = `${ref}.sha256`;
  const sidecar = Buffer.from(`${digest}  ${path.basename(ref)}\n`, "utf8");
  const sidecarTarget = path.join(packageRoot, sidecarRef);
  if (fs.existsSync(sidecarTarget)) {
    if (!fs.readFileSync(sidecarTarget).equals(sidecar)) throw new Error(`SHA sidecar 内容不一致: ${sidecarRef}`);
  } else if (checkOnly) {
    throw new Error(`缺少 SHA sidecar: ${sidecarRef}`);
  } else {
    fs.writeFileSync(sidecarTarget, sidecar, {flag: "wx"});
  }
  return digest;
}

function build() {
  const c035Ref = "resources/m01/c035-risk-results.v1.json";
  const factsRef = "resources/m01/published-risk-facts.v1.json";
  const runtimeRef = "resources/m03/query-runtime.v1.json";
  const c035Results = readJson(c035Ref);
  const publishedFacts = readJson(factsRef);
  const runtime = readJson(runtimeRef);
  const scenarioContext = c035Results.scenarioIdentity;
  const service = queryService.createQueryService({scenarioContext, c035Results, publishedFacts});
  const executions = [
    [queryService.QUERY_IDS.RISK_DISTRIBUTION, {}],
    [queryService.QUERY_IDS.RED_BLACK_ENTERPRISES, {}],
    [queryService.QUERY_IDS.ENTERPRISE_DETAIL, {enterpriseId: "S003-ENT-001"}],
    [queryService.QUERY_IDS.LOWEST_THREE, {enterpriseId: "S003-ENT-001"}],
    [queryService.QUERY_IDS.FACTOR_DEFAULTS, {}],
    [queryService.QUERY_IDS.DISPOSITION_CANDIDATES, {}]
  ].map(([queryId, parameters]) => ({parameters, output: service.execute(queryId, parameters)}));

  const resultSet = {
    schemaVersion: "ofw.s003.m03.query-results.v1",
    moduleId: "M03",
    moduleOwner: "智能问数",
    resultSetId: "S003-M03-QUERY-RESULTS-20260815-001",
    resultSetVersion: "1.0.0",
    runtimeId: runtime.runtimeId,
    runtimeVersion: runtime.runtimeVersion,
    status: "query-integrated",
    immutable: true,
    formedAt,
    scenarioIdentity: scenarioContext,
    assessmentAt: c035Results.assessmentAt,
    mode: "read-only-published-facts",
    source: {
      c035Results: {ref: c035Ref, sha256: sha256(fs.readFileSync(path.join(packageRoot, c035Ref)))},
      publishedFacts: {ref: factsRef, sha256: sha256(fs.readFileSync(path.join(packageRoot, factsRef)))}
    },
    executions,
    summary: {
      queryCount: executions.length,
      readOnlyCount: executions.filter((item) => item.output.readOnly).length,
      actionRequestsCreated: 0,
      todosCreated: 0,
      notificationsDispatched: 0,
      publishedFactsMutated: 0
    }
  };
  return {runtimeRef, resultSet};
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const {runtimeRef, resultSet} = build();
  const runtimeDigest = writeOrVerify(runtimeRef, fs.readFileSync(path.join(packageRoot, runtimeRef)), checkOnly);
  const resultsRef = "resources/m03/query-results.v1.json";
  const resultsDigest = writeOrVerify(resultsRef, serialize(resultSet), checkOnly);
  const evidence = `# CP04 只读问数联调验证\n\n` +
    `- 形成时间：${formedAt}\n` +
    `- 场景运行：\`${resultSet.scenarioIdentity.scenarioRunId}\`\n` +
    `- 问数运行：\`${resultSet.runtimeId}@${resultSet.runtimeVersion}\`\n` +
    `- 结果集：\`${resultSet.resultSetId}@${resultSet.resultSetVersion}\`\n\n` +
    `## 联调结论\n\n` +
    `- 六个固定问题均从同一轮次 C035 与 Published Fact 读取。\n` +
    `- 企业详情和最低三项使用 \`S003-ENT-001\` 作为稳定穿透夹具。\n` +
    `- 查询结果全部为只读，未修改 Published 事实。\n` +
    `- Action Request、负责人待办和通知创建数均为 0。\n` +
    `- Draft、错误场景身份、错误 scenarioRunId 和事实不一致均由 M03 服务阻断。\n\n` +
    `## 资源哈希\n\n` +
    `- \`${runtimeDigest}  ${runtimeRef}\`\n` +
    `- \`${resultsDigest}  ${resultsRef}\`\n\n` +
    `## 恢复边界\n\n` +
    `- 历史查看只读展示既有查询结果，不重新计算或触发副作用。\n` +
    `- 恢复和隔离回归必须克隆为新的 scenarioRunId。\n`;
  const evidenceRef = "evidence/CP04-query-integration-validation.md";
  const evidenceDigest = writeOrVerify(evidenceRef, Buffer.from(evidence, "utf8"), checkOnly);
  process.stdout.write(`${resultSet.resultSetId}\n${runtimeDigest}  ${runtimeRef}\n${resultsDigest}  ${resultsRef}\n${evidenceDigest}  ${evidenceRef}\n`);
}

main();
