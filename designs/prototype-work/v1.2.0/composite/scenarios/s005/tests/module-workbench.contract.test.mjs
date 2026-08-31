import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compositeRoot = path.resolve(root, "../..");
const shellRoot = path.join(compositeRoot, "s001-e2e-integration");
const read = (file) => fs.readFileSync(file, "utf8");
const html = read(path.join(root, "module-workbench.html"));
const workbench = read(path.join(root, "module-workbench.js"));
const shell = read(path.join(shellRoot, "app.js"));
const state = read(path.join(shellRoot, "state.js"));
const adapter = read(path.join(root, "scenario-adapter.js"));

test("S005 module workbench is content-only and covers M01-M06 operations", () => {
  assert.match(html, /id="workbench"/);
  assert.doesNotMatch(`${html}\n${workbench}`, /platform-shell|global-nav|global-topbar/);
  for (const token of ["M01", "M02", "M03", "M04", "M05", "M06", "source_delivery", "semantic_candidate", "compliance_evaluation", "market_peer_evaluation", "selection_read_only", "risk_explanation", "report_draft"])
    assert(workbench.includes(token), `missing workbench contract: ${token}`);
});

test("workbench returns verifiable module results and preserves missing evidence", () => {
  for (const token of ["ofw.s005.module-result.v1", "clientResultId", "outputKind", "producedAt", "evaluationRunId", "evaluationResultId", "consumerResultRef", "evidenceRefs", "missingReasons", "complianceResultRef", "marketPeerResultRef"])
    assert(workbench.includes(token), `missing result envelope field: ${token}`);
  assert.match(workbench, /windBatchId: null/);
  assert.match(workbench, /windFundType: null/);
  assert.match(workbench, /actions: \[\], reminders: \[\], approvals: \[\], todos: \[\], trades: \[\]/);
  assert.match(workbench, /value: 0\.42,[\s\S]{0,80}unit: "pct"/);
  assert.doesNotMatch(workbench, /value: 0\.0042|unit: "ratio"/);
  for (const token of ["复核与历史比较", "reviewEvidenceRefs", "historyComparisonStatus", "previousScenarioRunId", "previousEvaluationResultId", "historyComparisonMissingReason"])
    assert(workbench.includes(token), `missing M06 review/history contract: ${token}`);
  assert.doesNotMatch(workbench, /(?:twr|sharpe|sortino|duration|actualTwr)\s*:\s*\{[^}]*value\s*:\s*[0-9]/i);
});

test("host validates the active iframe, owner mapping, exact identity and engine output before progress", () => {
  for (const token of ["event.source !== frame.contentWindow", "OFW_S005_MODULE_RESULT", "S005_WORKBENCH_MODULES", "recordS005ModuleEvent", "s005ModuleProjection", "OFW_S005_EVALUATION_CONTEXT"])
    assert(shell.includes(token), `missing host validation token: ${token}`);
  assert.match(state, /阶段证据未引用当前模块输出/);
  assert.match(state, /阶段证据的模块或事件类型不一致/);
  assert.doesNotMatch(state, /updateS005Stage,\s*\n/);
  assert.doesNotMatch(adapter, /completeAll/);
});
