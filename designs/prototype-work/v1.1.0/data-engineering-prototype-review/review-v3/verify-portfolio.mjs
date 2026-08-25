import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const storage = new Map();
const sandbox = {
  console, Intl, URLSearchParams, structuredClone,
  location: { search: "", hash: "", pathname: "/data-engineering/方案B2.html" },
  history: { replaceState() {} },
  document: { readyState: "loading" },
  addEventListener() {}, requestAnimationFrame() {}, setInterval() {},
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const run = relative => vm.runInContext(fs.readFileSync(path.join(here, relative), "utf8"), sandbox, { filename: relative });

run("../../composite-resource-registry.js");
run("shared/fixtures.js");
sandbox.window.OFW_DE_BASE_DATA = structuredClone(sandbox.window.DE_DATA);
run("../../scenarios/s002/baseline-adapters/data-engineering-prototype-review/review-v3/s002-core-data.js");
run("portfolio-s001-flow-seed.js");
run("portfolio-integration.js");

const data = sandbox.window.DE_DATA;
const flow = sandbox.window.OFW_M02_PORTFOLIO_FLOW;
const appSource = fs.readFileSync(path.join(here, "shared/app.js"), "utf8");
assert.equal(data.sources.length, 15, "four-scenario catalog must contain 15 source records");
assert.equal(data.targetAssets.length, 5, "four-scenario catalog must contain 5 published assets");
assert.equal(data.pipelines.length, 5, "four-scenario catalog must contain 5 pipelines");
assert.ok(data.sources.every(source => source.enabled && source.snapshots.length && source.snapshots[0].status === "已登记"));
assert.ok(data.sources.every(source => source.snapshots[0].downloadHref));
for (const source of data.sources) {
  const href = decodeURIComponent(source.snapshots[0].downloadHref.replace("./", ""));
  assert.ok(fs.existsSync(path.join(here, href)), `${source.name} source download must exist`);
}
assert.ok(data.targetAssets.every(asset => asset.published && asset.consumptionStatus === "消费就绪"));
assert.ok(data.pipelines.every(pipeline => pipeline.canOpen && flow.publishedDefinitions.some(definition => definition.pipelineId === pipeline.id)));
assert.ok(data.pipelines.every(pipeline => flow.runs.some(runItem => runItem.pipelineId === pipeline.id && runItem.status === "成功" && runItem.assetVersion)));
assert.ok(data.targetAssets.every(asset => flow.assetVersions.some(version => version.id === asset.currentVersion && version.t019Status === "已采用")));
assert.ok(flow.assetVersions.some(version => version.id === "S003-T007-DEBT-RISK-20251231-v1"));

for (const pipeline of data.pipelines) {
  const definition = flow.publishedDefinitions.find(item => item.pipelineId === pipeline.id && item.id === pipeline.definitionVersion);
  const runItem = flow.runs.find(item => item.pipelineId === pipeline.id && item.definitionVersion === definition?.id && item.status === "成功");
  const asset = data.targetAssets.find(item => item.t006Id === pipeline.targetAssetId);
  const version = flow.assetVersions.find(item => item.id === asset?.currentVersion && item.targetAssetId === pipeline.targetAssetId);
  const sourceNodes = definition?.nodes.filter(node => node.key === "source") || [];
  assert.ok(definition, `${pipeline.id} must resolve its own published definition`);
  assert.ok(runItem, `${pipeline.id} must resolve its own successful run`);
  assert.ok(asset && version, `${pipeline.id} must resolve its exact published asset version`);
  assert.equal(runItem.assetVersion, version.id, `${pipeline.id} run and asset version must stay aligned`);
  assert.equal(flow.authorityVersionIds[pipeline.targetAssetId], version.id, `${pipeline.id} must resolve its own T019-adopted authority version`);
  assert.equal(version.t019Status, "已采用", `${pipeline.id} asset version must be adopted`);
  assert.equal(sourceNodes.length, pipeline.sourceIds.length, `${pipeline.id} definition source-node count must match its sources`);
  assert.equal(runItem.inputs.length, sourceNodes.length, `${pipeline.id} run must lock every definition input`);
  for (const node of sourceNodes) {
    const source = data.sources.find(item => item.id === node.sourceId);
    const input = runItem.inputs.find(item => item.nodeId === node.id);
    assert.ok(source && input, `${pipeline.id}/${node.id} must resolve its source and locked input`);
    assert.equal(input.resourceId, source.id, `${pipeline.id}/${node.id} resource identity must not drift`);
    assert.equal(input.name, source.name, `${pipeline.id}/${node.id} visible source name must be defined`);
    assert.equal(input.resourceName, source.name, `${pipeline.id}/${node.id} contract source name must be defined`);
    assert.equal(input.version, source.snapshots[0].snapshotId, `${pipeline.id}/${node.id} snapshot identity must not drift`);
    assert.equal(input.snapshot, source.snapshots[0].fileName, `${pipeline.id}/${node.id} source filename must not drift`);
  }
  assert.deepEqual(new Set(runItem.nodeExecutions.map(item => item.id)), new Set(definition.nodes.map(item => item.id)), `${pipeline.id} must expose every node execution`);
  assert.ok(runItem.nodeExecutions.every(item => item.status === "成功" || item.status === "消费就绪"), `${pipeline.id} completed canvas cannot contain an unexecuted node`);
}

const financeRun = flow.runs.find(item => item.id === "RUN-20251231-002");
const financeVersion = flow.assetVersions.find(item => item.id === "FIN-ASSET-20251231-v02");
assert.equal(financeRun.inputs[0].snapshot, "集团融资业务数据_2025.xlsx");
assert.equal(financeVersion.sourceSnapshot, "集团融资业务数据_2025.xlsx");
assert.equal(flow.runStatus, "ready", "S001 completed run must project as consumption-ready");
assert.equal(flow.candidateVersionId, "", "an adopted S001 version must not remain in the pending-candidate slot");
assert.doesNotMatch(JSON.stringify({ inputs: financeRun.inputs, snapshot: financeRun.snapshot, nodeExecutions: financeRun.nodeExecutions, sourceSnapshot: financeVersion.sourceSnapshot }), /融资一览表_一期演示数据\.xlsx/);
assert.ok(flow.runs.filter(item => item.pipelineId.startsWith("S002-")).every(item => item.inputs.every(input => input.name && input.resourceName)), "S002 canvas inputs must always have visible and contract names");
assert.match(appSource, /sameScenarioContext\(r\.scenarioContext,flow\.scenarioContext\)/, "canvas must still prefer the current C033 run");
assert.match(appSource, /function isCompletedPortfolioRun\(run\)/, "canvas must have an explicit completed-run fallback gate");
assert.match(appSource, /run\?\.status==="成功".*run\.closureStatus==="消费就绪".*version\.t019Status==="已采用".*flow\.authorityVersionIds\?\.\[version\.targetAssetId\]===version\.id/, "completed-run fallback must verify run closure, T019 adoption, and the exact authority pointer");
assert.match(appSource, /\.\.\.copy\(record\),id:record\.pipelineId\|\|base\.id,mode,definitionLabel:label/, "published definition hydration must preserve the stable pipeline id instead of replacing it with the definition id");
assert.doesNotMatch(JSON.stringify({ sources: data.sources, assets: data.targetAssets }), /FORMAL-CANDIDATE|合同冲突|待总控裁决|本轮未选择|内容已核验/);
const visibleFinanceSheets = data.workbooks.finance.sheets.filter(sheet => sheet.input !== false);
assert.doesNotMatch(JSON.stringify(visibleFinanceSheets), /演示单位|演示环球银行|演示亚太银行|演示海岸银行/);

console.log(`PASS M02 portfolio: ${data.sources.length} sources, ${data.pipelines.length} pipelines, ${data.targetAssets.length} assets, all downloads and completed runs verified.`);
