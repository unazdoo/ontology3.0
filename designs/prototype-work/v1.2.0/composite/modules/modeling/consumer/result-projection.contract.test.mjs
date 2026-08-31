import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const compositeRoot = path.resolve(root, "../../..");
const read = (file) => fs.readFileSync(file, "utf8");
const html = read(path.join(root, "result-projection.html"));
const source = read(path.join(root, "result-projection.js"));
const shell = read(path.join(compositeRoot, "s001-e2e-integration/app.js"));
const state = read(path.join(compositeRoot, "s001-e2e-integration/state.js"));

test("consumer adapter is content-only and shared by M03, M05 and M06", () => {
  assert.doesNotMatch(`${html}\n${source}`, /platform-shell|global-nav|global-topbar/);
  for (const token of ["M03_QUERY", "M05_AGENT", "M06_REPORT", "OFW_MODELING_CONSUMER_READY", "OFW_MODELING_CONSUMER_CONTEXT"])
    assert(source.includes(token), `missing consumer contract: ${token}`);
});

test("consumer adapter preserves result identity and non-fact boundaries", () => {
  for (const token of ["resultId", "resultKind", "runId", "permissionScope", "factWriteAllowed", "actionWriteAllowed", "actionSourceAllowed"])
    assert(source.includes(token), `missing result field: ${token}`);
  assert.match(source, /item\.objectName \|\| item\.enterpriseName/);
  assert.match(source, /item\.objectTypeRef \|\| "Enterprise"/);
  assert.match(source, /不能创建 Action Request、审批、待办、通知或交易/);
  assert.match(source, /不能覆盖 Published FACT、C035、正式报告或历史处置/);
  assert.doesNotMatch(source, /scorePortfolio|riskModelDraft|nextPatchVersion|M01-PUBLISH/);
});

test("shell mounts real module consumers and relays Dashboard recalculation through M08", () => {
  for (const token of ["S003_MODEL_CONSUMERS", "deliverModelingConsumerContext", "OFW_S003_MODELING_RECALCULATE_REQUEST", "/v1/s003/results/recalculate", "saveModelingResult"])
    assert(shell.includes(token), `missing shell adapter: ${token}`);
  assert.match(state, /NON_FACT_SOURCE_REJECTED/);
});
