"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterRef = "baseline-adapters/m05/agent-application/s002-adapter.js";
const entryRef = "baseline-adapters/m05/agent-application/Agent应用.html";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

test("M05完成运行固定同轮次 C017/T019/C018 只读证据且不显示空夹具状态", function () {
  const adapter = read(adapterRef);
  const entry = read(entryRef);

  for (const token of [
    'currentStateSummary: {',
    'id: "C017-S002-CURRENT-v1"',
    'label: "当前固定组合可消费"',
    'binding: "T019-S002-v1 / C018-S002-v1"',
    'ontologyAdoption: { status: "ready"',
    'consumptionReadiness: { status: "ready"',
    'stableEvidence: { status: "available"',
    'id: "version-location"',
    'id: "replay-verification"',
    'status: "not-run"',
    'evidenceRevision: "S002-M05-EVIDENCE-v6"',
    'const DATA_ASSET_VERSIONS = Object.freeze(["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"])',
    'value: "6个获准问题 + 7条正式Rule命中 + 1条分析建议"',
    'label: "5 项证据齐备"',
    'id: "confirm-result"',
    'name: "确认预算异常分析结果"',
    'canConfirmNewResult: true',
    'toolIds: ["tool-evidence-reader", "tool-ontology-reader", "tool-budget-report-draft"]',
    'does not publish or mutate any upstream'
  ]) {
    assert.ok(adapter.includes(token), `M05固定证据投影缺少：${token}`);
  }
  assert.ok(entry.includes('s002-adapter.js?v=13'), "M05入口未切换到最新场景脚本版本");
  assert.ok(entry.includes('app.jsx?v=57'), "M05入口未切换到最新基线应用补丁版本");
  assert.ok(entry.includes('credibilityReadAt: "2026-08-15 10:00:00"'), "M05历史详情未固定场景证据读取时点");
  const app = read("baseline-adapters/m05/agent-application/app.jsx");
  assert.ok(app.includes("window.AGENT_WORKSPACE_CONFIG.credibilityReadAt || targetRun?.snapshot?.evidenceFormedAt || nowText()"), "M05历史详情仍会使用系统当前时间污染只读证据");
  assert.ok(app.includes('"dataAssetVersions"'), "M05运行快照未持久化双数据资产版本");
  assert.ok(app.includes("displayDataVersionSet(run.snapshot)"), "M05运行主视图未展示双数据资产及组合指针");
  assert.ok(adapter.includes('DATA_ASSET_VERSIONS.join(" + ")'), "M05运行步骤仍把组合指针误展示为单一数据资产");
  assert.ok(adapter.includes("preferCompletedRunHistory"), "M05完成态进入运行中心后未默认展示运行记录");
  assert.ok(adapter.includes("savedRunsById"), "M05未校验持久化运行是否仍保留完整步骤、工具和结果落位");
  assert.ok(adapter.includes('const confirmGate = savedEvidence?.credibility?.agentGates?.find((item) => item?.id === "confirm-result")'), "旧持久化投影缺少确认门时不会自动重建");
  assert.ok(app.includes("ownerProjectedRunIds"), "M05基线持久化仍可能压缩第二条Owner投影运行");
});

test("M05历史Checkpoint从统一工作台同轮次投影两个完成运行", function () {
  const scenarioRunId = "S002-RUN-20260815080200000-6cdb7ec5603f";
  const snapshot = {
    context: {
      scenarioId: "S002",
      scenarioVersion: "S002-v1",
      scenarioRunId,
      formedAt: "2026-08-15T08:02:00.000Z",
      status: "historical"
    },
    progress: { agentsRun: true },
    agentRuns: [
      { runId: "AG-RUN-S002-HISTORY-ANOMALY", agentId: "budget-anomaly-analyst", name: "预算异常分析 Agent", status: "complete", summary: "历史异常分析完成", evidence: ["C017-S002-BINDING-v1", "T019-S002-v1", "C018-S002-v1"] },
      { runId: "AG-RUN-S002-HISTORY-REPORT", agentId: "budget-report-drafter", name: "预算报告草稿 Agent", status: "complete", summary: "历史报告草稿完成", evidence: ["C017-S002-BINDING-v1", "T019-S002-v1", "C018-S002-v1"] }
    ],
    orchestrationRun: {
      runId: "ORCH-RUN-S002-HISTORY",
      definitionVersion: "S002-ORCH-v1",
      status: "complete",
      steps: ["AG-RUN-S002-HISTORY-ANOMALY", "AG-RUN-S002-HISTORY-REPORT"],
      formedAt: "2026-08-15T08:02:00.000Z"
    }
  };
  const values = new Map();
  const storageKey = "ontology3.s002.agent-application.catalog.v1";
  const ownerRunIds = snapshot.agentRuns.map((run) => run.runId);
  values.set(storageKey, JSON.stringify({
    currentScenarioContext: snapshot.context,
    s002OwnerProjection: {
      moduleId: "M05",
      moduleVersion: "S002-M05-1.0.0",
      evidenceRevision: "S002-M05-EVIDENCE-v6",
      scenarioRunId,
      status: "complete",
      ownerRunIds,
      orchestrationRunId: snapshot.orchestrationRun.runId
    },
    runs: ownerRunIds.map((id, index) => ({
      id,
      status: "complete",
      snapshot: { agentId: snapshot.agentRuns[index].agentId },
      steps: [],
      toolCalls: [],
      result: { id: `${id}-RESULT`, type: index ? "Agent Report Draft" : "AI Insight" }
    })),
    orchestrations: [{ id: snapshot.orchestrationRun.definitionVersion }]
  }));
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const window = {
    location: { search: `?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=${scenarioRunId}&status=historical` },
    parent: { S002_STORE: { get: () => snapshot } },
    AGENT_TOOLS: [],
    AGENT_APP_INITIAL_STATE: { agents: [], runs: [], orchestrations: [], sequence: {} }
  };
  const sandbox = { window, localStorage, URLSearchParams, JSON, console };
  vm.createContext(sandbox);
  vm.runInContext(read(adapterRef), sandbox, { filename: adapterRef });

  assert.equal(window.S002_M05_ADAPTER.ownerStateReady, true);
  assert.equal(window.S002_M05_ADAPTER.runs.length, 2);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.status === "complete"), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.steps.length === 3 && run.steps.every((step) => step.status === "complete")), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.toolCalls.length >= 2 && run.toolCalls.length <= 3 && run.toolCalls.every((call) => call.status === "complete" && call.output)), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.result.destination && run.result.sections.length > 0), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => JSON.stringify(run.snapshot.dataAssetVersions) === JSON.stringify(["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"])), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.evidencePackageId === "S002-BUDGET-EVIDENCE-v1" && run.snapshot.evidencePackageVersion === "1.0"), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.semanticVersionId === "SEM-S002-BUDGET-v1" && run.snapshot.ontologyVersion === "S002-ONTO-v1"), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.dataAssetVersionId === "S002-DATA-BUNDLE" && run.snapshot.dataVersion === "S002-DATA-v1"), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.promptBinding?.version === "1.0" && !String(run.snapshot.promptBinding?.name || "").includes("undefined")), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.skillBindings?.length === 1 && run.snapshot.skillBindings.every((binding) => binding.id && binding.name && binding.version)), true);
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.snapshot.toolBindings?.length >= 2 && run.snapshot.toolBindings?.length <= 3 && run.snapshot.toolBindings.every((binding) => binding.id && binding.name && binding.version)), true);
  assert.equal(window.S002_M05_ADAPTER.orchestration.trace.runId, "ORCH-RUN-S002-HISTORY");
  assert.equal(window.S002_M05_ADAPTER.runs.every((run) => run.result.citations.includes("C018-S002-v1")), true);
  const confirmGate = window.S002_M05_ADAPTER.evidence.credibility.agentGates.find((gate) => gate.id === "confirm-result");
  assert.equal(confirmGate.status, "allowed", "已完成异常分析缺少可用的人工确认门");
  assert.match(confirmGate.reason, /运行已完成.*输出合同.*固定证据.*C017\s*摘要一致/);
  assert.equal(window.S002_M05_ADAPTER.evidence.credibility.useFlags.canConfirmNewResult, true);
  const anomalyRun = window.S002_M05_ADAPTER.runs.find((run) => run.snapshot.agentId === "budget-anomaly-analyst");
  assert.equal(anomalyRun.status, "complete");
  assert.equal(anomalyRun.result.confirmation, "pending");
  const refreshed = JSON.parse(values.get(storageKey));
  assert.equal(refreshed.runs.every((run) => run.steps.length === 3), true, "匹配ID但缺失步骤的旧持久化投影必须被完整重建");
  assert.equal(refreshed.runs.every((run) => run.toolCalls.length >= 2 && run.toolCalls.length <= 3), true, "匹配ID但缺失工具轨迹的旧持久化投影必须按Agent能力完整重建");
  assert.equal(refreshed.runs.every((run) => run.result.destination), true, "匹配ID但缺失结果落位的旧持久化投影必须被完整重建");
  assert.equal(refreshed.evidencePackages[0].credibility.agentGates.some((gate) => gate.id === "confirm-result" && gate.status === "allowed"), true, "重建后持久化状态仍缺少确认结果用途门");
});
