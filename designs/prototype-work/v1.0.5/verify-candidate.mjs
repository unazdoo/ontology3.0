import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = JSON.parse(fs.readFileSync(path.join(root, "VERSION.json"), "utf8"));
const expectedScenarioRunId = process.env.SCENARIO_RUN_ID || manifest.scenarioRunId;

function listFiles(directory) {
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) files.push(...listFiles(absolute));
    else if (stat.isFile()) files.push(absolute);
  }
  return files;
}

function treeDigest(directory) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(directory);
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(directory, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

function targetDigest(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return treeDigest(target);
  const content = fs.readFileSync(target);
  const hash = crypto.createHash("sha256");
  hash.update(path.basename(target));
  hash.update("\0");
  hash.update(content);
  hash.update("\0");
  return { files: 1, bytes: content.length, treeSha256: hash.digest("hex") };
}

const failures = [];
for (const [component, expected] of Object.entries(manifest.components)) {
  const actual = targetDigest(path.join(root, component));
  for (const key of ["files", "bytes", "treeSha256"]) {
    if (actual[key] !== expected[key]) failures.push(`${component}.${key}: ${actual[key]} != ${expected[key]}`);
  }
}

for (const [entry, expected] of Object.entries(manifest.entries)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, entry))).digest("hex");
  if (actual !== expected) failures.push(`${entry}: ${actual} != ${expected}`);
}

if (manifest.prototypeVersion !== "1.0.5") failures.push(`prototypeVersion: ${manifest.prototypeVersion}`);
if (manifest.scenarioRunId !== expectedScenarioRunId) failures.push(`scenarioRunId: ${manifest.scenarioRunId} != ${expectedScenarioRunId}`);
if (version.activeScenarioRunId !== manifest.scenarioRunId) failures.push(`VERSION.activeScenarioRunId: ${version.activeScenarioRunId} != ${manifest.scenarioRunId}`);
if (version.status !== "release-candidate") failures.push(`VERSION.status: ${version.status}`);
if (manifest.rollbackVersion !== "1.0.4") failures.push(`rollbackVersion: ${manifest.rollbackVersion}`);
if (manifest.acceptanceReady !== false) failures.push("acceptanceReady 必须为 false");
if (version.acceptanceReady !== false) failures.push("VERSION.acceptanceReady 必须为 false");

const regressionDirectory = path.join(root, "regression-results", manifest.scenarioRunId);
const resultFile = path.join(regressionDirectory, "result.json");
const targetedFile = path.join(regressionDirectory, "targeted-regression.json");
if (!fs.existsSync(resultFile)) failures.push(`回归结果不存在：${path.relative(root, resultFile)}`);
if (!fs.existsSync(targetedFile)) failures.push(`定向回归结果不存在：${path.relative(root, targetedFile)}`);
let regressionResult = null;
let targetedRegression = null;
if (fs.existsSync(resultFile)) {
  try { regressionResult = JSON.parse(fs.readFileSync(resultFile, "utf8")); }
  catch (error) { failures.push(`回归结果无法解析：${error.message}`); }
}
if (fs.existsSync(targetedFile)) {
  try { targetedRegression = JSON.parse(fs.readFileSync(targetedFile, "utf8")); }
  catch (error) { failures.push(`定向回归结果无法解析：${error.message}`); }
}
if (regressionResult) {
  if (regressionResult.scenarioRunId !== manifest.scenarioRunId) failures.push("回归结果 scenarioRunId 与 manifest 不一致");
  if (regressionResult.integrationProgress !== "15/15") failures.push(`联调进度不是 15/15：${regressionResult.integrationProgress}`);
  if (regressionResult.status !== "passed") failures.push(`回归结果状态不是 passed：${regressionResult.status}`);
  if (regressionResult.acceptanceReady !== false) failures.push("回归结果 acceptanceReady 必须为 false");
}
if (targetedRegression) {
  if (targetedRegression.scenarioRunId !== manifest.scenarioRunId) failures.push("定向回归 scenarioRunId 与 manifest 不一致");
  if (targetedRegression.passed !== true) failures.push("定向回归 passed 必须为 true");
  if (targetedRegression.acceptanceReady !== false) failures.push("定向回归 acceptanceReady 必须为 false");
  if (targetedRegression.pageViewportCombinations !== 24) failures.push(`页面—分辨率组合必须为 24：${targetedRegression.pageViewportCombinations}`);
  if (!Array.isArray(targetedRegression.results) || targetedRegression.results.length !== 3) failures.push("定向回归必须包含 3 个分辨率结果");
  if (Array.isArray(targetedRegression.results)) {
    const expectedViewports = new Set(["1440x900", "1280x720", "390x844"]);
    const actualViewports = new Set(targetedRegression.results.map((item) => item.viewport));
    if (actualViewports.size !== 3 || [...expectedViewports].some((item) => !actualViewports.has(item))) failures.push("定向回归缺少指定分辨率");
    targetedRegression.results.forEach((item) => {
      if (item.moduleEntryCount < 6) failures.push(`${item.viewport} 模块入口不足 6 个`);
      if (item.consoleErrors?.length) failures.push(`${item.viewport} 存在控制台错误：${item.consoleErrors.join("；")}`);
      if (item.dataRefresh?.after?.reportReady !== true) failures.push(`${item.viewport} 刷新后 C017/T019 未恢复可消费投影`);
      if (item.queryReady !== true) failures.push(`${item.viewport} 智能问数正式消费门未通过`);
      if (item.dashboardReady !== true) failures.push(`${item.viewport} 仪表盘权威投影未通过`);
      if (item.decisionBanksReady !== true) failures.push(`${item.viewport} 决策中心机构证据未通过`);
      if (item.reportAgentReady !== true) failures.push(`${item.viewport} 报告伴读证据未通过`);
      if (item.chartLayout?.overlap) failures.push(`${item.viewport} 报告图表存在重叠`);
    });
  }
}

function parseStoredJson(snapshot, key) {
  const raw = snapshot?.localStorage?.[key];
  if (!raw) {
    failures.push(`运行快照缺少 ${key}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    failures.push(`运行快照中的 ${key} 无法解析：${error.message}`);
    return null;
  }
}

const snapshotFile = path.join(root, "runtime-snapshots", `${manifest.scenarioRunId}.runtime.json`);
if (!fs.existsSync(snapshotFile)) {
  failures.push(`运行快照不存在：${path.relative(root, snapshotFile)}`);
} else {
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  if (snapshot.scenarioRunId !== manifest.scenarioRunId) {
    failures.push(`运行快照 scenarioRunId: ${snapshot.scenarioRunId} != ${manifest.scenarioRunId}`);
  }
  if (snapshot.prototypeVersion !== "1.0.5") {
    failures.push(`运行快照 prototypeVersion: ${snapshot.prototypeVersion}`);
  }

  const queryState = parseStoredJson(snapshot, "ontology3.iq.review.conversation.v1");
  const decisionInbox = parseStoredJson(snapshot, "ontology3.decision-center.c011.inbox.v1");
  const expectedActions = {
    "UNIT-553": {
      subjectName: "单位553",
      ruleId: "RULE-HIGH-FINANCING-COST",
      banks: ["欧陆银行", "寰宇银行", "海联银行"]
    },
    "UNIT-465": {
      subjectName: "单位465",
      ruleId: "RULE-FLOATING-RATE-EXPOSURE"
    },
    "UNIT-561": {
      subjectName: "单位561",
      ruleId: "RULE-SHORT-TERM-DEBT-CONCENTRATION"
    }
  };

  const queryRequests = Array.isArray(queryState?.actionRequests) ? queryState.actionRequests : [];
  const inboxRequests = Array.isArray(decisionInbox?.requests) ? decisionInbox.requests : [];
  if (queryRequests.length !== 3) failures.push(`智能问数 Action Request 数量: ${queryRequests.length} != 3`);
  if (inboxRequests.length !== 3) failures.push(`决策中心 C011 请求数量: ${inboxRequests.length} != 3`);

  for (const [targetStableId, expected] of Object.entries(expectedActions)) {
    const queryRequest = queryRequests.find((item) => item.targetStableId === targetStableId || item.c011Payload?.subjectId === targetStableId);
    const payload = queryRequest?.c011Payload || queryRequest;
    if (!queryRequest) {
      failures.push(`智能问数缺少 ${targetStableId} 的 Action Request`);
    } else {
      if (payload?.subjectName !== expected.subjectName) failures.push(`${targetStableId} 主体名称: ${payload?.subjectName}`);
      if (payload?.rule?.id !== expected.ruleId) failures.push(`${targetStableId} Rule: ${payload?.rule?.id} != ${expected.ruleId}`);
      if (!String(payload?.recommendation || "").includes(expected.subjectName)) {
        failures.push(`${targetStableId} 建议正文未引用自身主体：${payload?.recommendation || "空"}`);
      }
      const bankNames = Array.isArray(payload?.banks) ? payload.banks.map((item) => item?.name).filter(Boolean) : [];
      if (bankNames.length < 3) failures.push(`${targetStableId} 优先银行不足 3 家：${bankNames.join("、") || "空"}`);
      if (expected.banks && JSON.stringify(bankNames.slice(0, 3)) !== JSON.stringify(expected.banks)) {
        failures.push(`${targetStableId} 优先银行: ${bankNames.slice(0, 3).join("、")} != ${expected.banks.join("、")}`);
      }
    }

    const inboxRequest = inboxRequests.find((item) => item.subjectId === targetStableId || item.targetStableId === targetStableId);
    if (!inboxRequest) {
      failures.push(`决策中心缺少 ${targetStableId} 的 C011 请求`);
    } else {
      if (inboxRequest.subjectName !== expected.subjectName) failures.push(`决策中心 ${targetStableId} 主体名称: ${inboxRequest.subjectName}`);
      if (inboxRequest.rule?.id !== expected.ruleId) failures.push(`决策中心 ${targetStableId} Rule: ${inboxRequest.rule?.id} != ${expected.ruleId}`);
      if (!String(inboxRequest.recommendation || "").includes(expected.subjectName)) {
        failures.push(`决策中心 ${targetStableId} 建议正文未引用自身主体：${inboxRequest.recommendation || "空"}`);
      }
    }
  }
}

if (failures.length) {
  console.error("v1.0.5 候选完整性校验失败：");
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`v1.0.5 候选完整性校验通过：${Object.keys(manifest.components).length} 个组件，${Object.keys(manifest.entries).length} 个入口。`);
