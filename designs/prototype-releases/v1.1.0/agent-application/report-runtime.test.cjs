"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MemoryStorage {
  constructor() { this.values = new Map(); this.failWrites = false; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.failWrites) throw new Error("QuotaExceededError"); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const timers = [];
const storage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const window = {
  localStorage: storage,
  sessionStorage,
  setTimeout(callback, delay) {
    timers.push({ callback, delay });
    timers.sort((left, right) => left.delay - right.delay);
    return timers.length;
  },
  dispatchEvent() {},
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
};
const context = vm.createContext({ window, localStorage: storage, sessionStorage, CustomEvent: window.CustomEvent, Date, Intl, console });
const source = fs.readFileSync(path.join(__dirname, "portfolio-integration.js"), "utf8");
vm.runInContext(source, context, { filename: "portfolio-integration.js" });

const runtime = window.AGENT_REPORT_RUNTIME;
assert.ok(runtime, "M05 必须暴露报告运行 Owner 服务");

function flushTimers() {
  while (timers.length) timers.shift().callback();
}

const generation = runtime.submit({
  kind: "report-generation",
  scenarioId: "S002",
  definitionId: "RD-BUDGET-001",
  definitionName: "预算监督管理分析报告",
  templateId: "RT-BUDGET-001",
  templateName: "预算监督管理分析模板",
  subject: "集团整体",
  dataVersion: "S002-DATA-v1",
  dataAsOf: "2025-12-31",
  semanticVersion: "预算管理本体 1.0.0",
  semanticVersionId: "T019-S002-v1",
  evidencePackageId: "EP-S002-BUDGET-001",
  agentId: "budget-report-drafter",
  agentName: "预算报告草稿 Agent",
  agentVersion: "1.0",
  chapters: ["预算执行概览", "异常与建议"]
});
assert.equal(generation.status, "accepted", "生成请求提交后应先处于已接收状态");
timers.shift().callback();
assert.equal(runtime.getReceipt(generation.requestId).status, "processing", "生成请求必须经历处理中");
flushTimers();
const generationDone = runtime.getReceipt(generation.requestId);
assert.equal(generationDone.status, "complete", "生成请求应形成完成回执");
assert.equal(generationDone.result.type, "Agent Report Draft", "生成结果必须属于 M05 源草稿");
assert.ok(generationDone.result.sourceDraft.sections.length === 2, "源草稿必须携带实际章节正文");

const reading = runtime.submit({
  kind: "report-reading",
  scenarioId: "S001",
  reportNumber: "RPT-20260816-092626-010",
  reportTitle: "集团融资成本与债务结构分析报告",
  contentVersion: "2.0.0",
  question: "优先与哪些银行协商？",
  answerBasis: "建议优先与欧陆银行、寰宇银行和海联银行协商。",
  evidencePackageId: "EP-20260816-092248-003",
  semanticVersion: "融资管理本体 3.8.1",
  dataVersion: "FIN-ASSET-20251231-v02",
  dataAsOf: "2025-12-31",
  agentId: "report-copilot",
  agentName: "报告伴读助手",
  agentVersion: "3.1.0"
});
assert.equal(reading.status, "accepted", "伴读请求提交后应先处于已接收状态");
timers.shift().callback();
assert.equal(runtime.getReceipt(reading.requestId).status, "processing", "伴读请求必须经历处理中");
flushTimers();
const readingDone = runtime.getReceipt(reading.requestId);
assert.equal(readingDone.status, "complete", "伴读请求应形成完成回执");
assert.ok(readingDone.sessionId, "伴读处理必须形成 M05-owned Session");
assert.match(readingDone.result.answer, /欧陆银行/, "伴读结果必须回读固定报告答案");

const verification = runtime.submitVerification({
  scenarioId: "S004",
  reportNumber: "S004-PLR-2026-0001",
  reportTitle: "贷款贷前调查报告",
  contentVersion: "2.0.0",
  verificationDefinitionId: "VERIFY-S004-PREFLIGHT-v2",
  evidencePackageId: "EVID-S004-20260815-0002",
  evidenceRefs: ["S004-EV-DEBT", "S004-EV-CURRENT"],
  semanticVersion: "贷前调查本体 V1",
  semanticVersionId: "SEM-S004-PREFLIGHT-V1",
  dataVersion: "DATA-ASSET-S004-20260815-V01",
  dataAsOf: "2026-08-15",
  reportContent: {
    digest: "sha256:REPORT-S004-V2",
    anchors: [
      { id: "ANCHOR-FIN-01", label: "第三部分 财务情况", location: "chapter-3#debt-ratio" },
      { id: "ANCHOR-FIN-02", label: "第三部分 财务情况", location: "chapter-3#current-ratio" }
    ],
    items: [
      { id: "CLAIM-DEBT", label: "资产负债率", reportedValue: 65.15, unit: "%", period: "2026-08-15", subject: "借款人", anchorId: "ANCHOR-FIN-01", anchorLabel: "第三部分 财务情况", evidenceRef: "S004-EV-DEBT", comparisonMethod: "numeric-exact" },
      { id: "CLAIM-CURRENT", label: "流动比率", reportedValue: 0.66, period: "2026-08-15", subject: "借款人", anchorId: "ANCHOR-FIN-02", anchorLabel: "第三部分 财务情况", evidenceRef: "S004-EV-CURRENT", comparisonMethod: "numeric-tolerance" }
    ]
  }
});
assert.equal(verification.status, "accepted", "核验抽取请求提交后应先处于已接收状态");
timers.shift().callback();
assert.equal(runtime.getReceipt(verification.requestId).status, "processing", "核验抽取必须经历处理中");
flushTimers();
const verificationDone = runtime.getReceipt(verification.requestId);
assert.equal(verificationDone.status, "complete", "核验抽取请求应形成完成回执");
assert.equal(verificationDone.result.type, "Report Verification Extraction", "核验 Agent 只能形成抽取结果");
assert.equal(verificationDone.result.claims.length, 2, "抽取结果必须返回结构化声明");
assert.equal(verificationDone.result.anchors.length, 2, "抽取结果必须返回稳定锚点");
assert.deepEqual([...verificationDone.result.evidenceRefs], ["S004-EV-DEBT", "S004-EV-CURRENT"], "抽取结果必须返回精确证据引用");
assert.ok(verificationDone.result.comparisonRequests.every((item) => item.determinationStatus === "not-evaluated"), "Agent 不得提前给出核验通过或失败");
assert.ok(verificationDone.result.comparisonRequests.every((item) => item.determinationOwner === "报告中心确定性规则引擎"), "正式核验判定必须归报告中心规则引擎");
assert.equal(verificationDone.result.pass, undefined, "抽取结果不得携带正式通过字段");
assert.equal(verificationDone.result.failed, undefined, "抽取结果不得携带正式失败字段");
assert.throws(() => runtime.submit({
  kind: "report-verification",
  reportNumber: "RPT-INVALID",
  contentVersion: "1.0",
  verificationDefinitionId: "VERIFY-INVALID",
  evidencePackageId: "EP-INVALID",
  agentId: "report-copilot",
  reportContent: { items: [] }
}), /report-verification-agent/, "报告自动核验不得复用伴读 Agent 配置");

const failed = runtime.submit({
  kind: "report-reading",
  scenarioId: "S004",
  reportNumber: "S004-PLR-2026-0001",
  reportTitle: "贷款贷前调查报告",
  contentVersion: "2.0.0",
  question: "解释风险结论",
  evidencePackageId: "EVID-S004-20260815-0002",
  agentId: "preflight-report-copilot",
  agentName: "贷前调查报告伴读 Agent",
  agentVersion: "2.0.0",
  simulateFailure: true,
  failureReason: "固定证据读取超时"
});
flushTimers();
assert.equal(runtime.getReceipt(failed.requestId).status, "failed", "失败必须保留明确失败回执");
const retried = runtime.retry(failed.requestId);
assert.equal(retried.status, "accepted", "失败请求应可创建新尝试");
flushTimers();
assert.equal(runtime.getReceipt(retried.requestId).status, "complete", "重试应形成独立成功结果");

const merged = runtime.mergeIntoModel({ inboundRequests: [], evidencePackages: [], runs: [], sessions: [] });
assert.ok(merged.runs.length >= 5, "M05 运行目录必须可读取所有尝试");
assert.ok(merged.sessions.some((item) => item.id === readingDone.sessionId), "M05 会话目录必须可读取伴读 Session");
assert.ok(merged.runs.some((item) => item.result?.id === generationDone.resultId), "M05 结果目录必须可读取报告草稿 Result");
assert.ok(merged.runs.some((item) => item.result?.id === verificationDone.resultId), "M05 结果目录必须可读取报告核验抽取 Result");

storage.failWrites = true;
const fallback = runtime.submit({
  kind: "report-reading",
  scenarioId: "S003",
  reportNumber: "RISK-020-2025",
  reportTitle: "环保测试公司4债务风险评估报告",
  contentVersion: "1.7.0",
  question: "主要风险来自哪里？",
  evidencePackageId: "企业风险证据包 · S003-ENT-020",
  agentId: "report-copilot-s003-profile",
  agentName: "债务风险报告伴读 Agent",
  agentVersion: "1.5"
});
assert.equal(fallback.status, "accepted", "本地持久化配额不足时必须回退到当前页签运行存储");
assert.ok(sessionStorage.getItem(runtime.storageKey), "回退存储必须保留 M05-owned 运行账本");
flushTimers();
assert.equal(runtime.getReceipt(fallback.requestId).status, "complete", "回退存储中的运行仍应完成并可回读");

console.log("M05 report runtime verification passed");
