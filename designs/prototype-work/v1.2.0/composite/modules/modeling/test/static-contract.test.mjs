import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

async function filesBelow(directory = root) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else output.push(path);
  }
  return output;
}

test("manifest binds the exact frozen source and target candidate", async () => {
  const manifest = JSON.parse(await read("INTEGRATION-MANIFEST.json"));
  assert.equal(manifest.sourceTag, "prototype-v1.1.0-frozen");
  assert.equal(manifest.parentVersion, "v1.1.0");
  assert.equal(manifest.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
  assert.equal(manifest.targetPrototypeVersion, "v1.2.0-rc.1");
  assert.equal(manifest.acceptanceReady, false);
  assert.deepEqual(manifest.mount.requiredQueryParameters, ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]);
  assert.deepEqual(manifest.scenarioIdentity.fields, ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]);
  assert.deepEqual(manifest.s005Objective, {
    objectiveId: "MO-S005-POST-INVESTMENT-RESEARCH-v1",
    scenarioIds: ["S005"],
    acceptedObjectTypes: ["InvestmentProduct"],
    resultKinds: ["PREDICTION", "SIMULATION"],
    missingInputPolicy: "UNAVAILABLE_NO_CROSS_SCENARIO_FALLBACK"
  });
});

test("export contains only portable M08, bridge, validation and contract artifacts", async () => {
  const files = await filesBelow();
  const paths = files.map((path) => relative(root, path));
  const forbiddenPath = /(^|\/)(?:_archive|archive|screenshots|exploration-prototype|platform-shell|\.DS_Store)(?:\/|$)/i;
  assert.ok(paths.every((path) => !forbiddenPath.test(path)), paths.filter((path) => forbiddenPath.test(path)).join("\n"));
  for (const path of files) assert.equal((await lstat(path)).isSymbolicLink(), false, relative(root, path));
  const textFiles = files.filter((path) => !path.endsWith("SHA256SUMS") && !path.endsWith(".json"))
    .filter((path) => !path.endsWith("s005-synthetic.v1.json"));
  for (const path of textFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /\/Users\/|ontology3\.0-worktrees|[A-Za-z]:\\\\/, relative(root, path));
  }
});

test("module uses canonical M07 and parameterized scenario identity", async () => {
  const html = await read("module/content.html");
  const source = await read("module/content.js");
  const data = await read("module/data.js");
  assert.match(html, /\.\.\/bridge\/m07-m08-bridge\.js/);
  assert.doesNotMatch(html, /shared-type-scale|platform-shell/);
  assert.match(source, /activeScenarioIdentity/);
  assert.match(source, /scenarioVersion/);
  assert.match(source, /scenarioRunId/);
  assert.match(source, /caseStudies/);
  assert.match(source, /OBJECT_INPUT_UNAVAILABLE/);
  assert.match(source, /SERIES_INPUT_UNAVAILABLE/);
  assert.match(source, /SYNTHETIC_CANDIDATE_SIMULATION/);
  assert.match(source, /simulation\?\.fixture\?\.classification/);
  assert.match(source, /containsSourceBusinessValues: simulation\?\.fixture\?\.containsSourceBusinessValues/);
  assert.match(source, /simulationStatus: simulation\?\.status/);
  assert.match(source, /factWriteAllowed: simulation\?\.result\?\.factWriteAllowed/);
  assert.match(source, /actionWriteAllowed: simulation\?\.result\?\.actionWriteAllowed/);
  assert.match(source, /sideEffectsEmitted: simulation\?\.sideEffectAudit\?\.emitted/);
  assert.doesNotMatch(source, /containsSourceBusinessValues === true|sideEffectAudit\?\.emitted \?\? 0/);
  assert.match(source, /study\.m08\?\.inputMode \|\| "OBSERVED_SERIES_SIMULATION"/);
  assert.match(data, /inputMode: "SYNTHETIC_CANDIDATE_SIMULATION"/);
  assert.match(source, /事实覆盖增量 0/);
  assert.match(source, /item\.scenarioIds\?\.includes\(scenarioId\)/);
  assert.match(source, /暂无可用建模目标/);
  assert.match(source, /returnUrl: matches/);
  assert.doesNotMatch(source, /DATA\.caseStudy/);
  assert.doesNotMatch(`${html}\n${source}\n${data}`, /原型|演示|研究夹具|合成预览|研究服务|方案说明/);
  assert.match(source, /data-route-module="m07"/);
  assert.doesNotMatch(source, /scenarioId:\s*"S001"|#module\/exploration|RETURN_TO_EXPLORATION/);
  const { loadFixture } = await import(pathToFileURL(resolve(root, "validation/src/fixture.mjs")));
  const fixture = await loadFixture({ scenarioId: "S099" });
  assert.equal(fixture.fixtureId, "FIX-S099-SYNTHETIC-v1");
  assert.doesNotMatch(JSON.stringify(fixture), /S005/);
});

test("module exposes a schema-driven Objective-first workspace and real S003 state chain", async () => {
  const html = await read("module/content.html");
  const source = await read("module/content.js");
  const data = await read("module/data.js");
  const css = await read("module/content.css");

  assert.match(source, /catalogScope:\s*persisted\.catalogScope \|\| "SCENARIO"/);
  assert.match(source, /data-catalog-scope="ALL"/);
  assert.match(source, /data-catalog-scope="SCENARIO"/);
  for (const kind of ["FORECAST", "CLASSIFICATION", "SCORING", "OPTIMIZATION"]) assert.match(source, new RegExp(kind));
  for (const section of ["benchmark", "insights", "candidates", "binding", "consumption"]) assert.match(source, new RegExp(`"${section}"`));
  const lifecycleSource = source.slice(source.indexOf("function lifecycle"), source.indexOf("function nextWorkspaceSection"));
  for (const label of ["目标定义", "动态合同", "基准评测", "AI 洞察", "候选版本", "人工评审", "Release", "Binding", "消费跟踪"]) assert.match(lifecycleSource, new RegExp(label));
  assert.doesNotMatch(lifecycleSource, /Simulation|隔离模拟|模拟使用/);

  assert.match(source, /MO-S003-DEBT-RISK-EARLY-WARNING-v1/);
  assert.match(data, /S003:\s*"MO-S003-DEBT-RISK-EARLY-WARNING-v1"/);
  for (const path of ["workspace", "benchmark/run", "insights/generate", "candidates/generate", "candidates/evaluate", "shadow/start", "shadow/advance", "release-candidates/form", "bindings/validate", "bindings/apply-default", "results/recalculate"]) assert.match(source, new RegExp(`/v1/s003/${path.replace("/", "\\/")}`));
  assert.match(source, /OFW_S003_MODELING_RECALCULATE_REQUEST/);
  assert.match(source, /OFW_S003_MODELING_WORKSPACE/);
  assert.match(source, /OFW_S003_MODELING_RESULT/);
  assert.match(source, /scenarioContext:\s*structuredClone\(scenario\)/);
  assert.match(source, /workspaceSnapshot/);
  assert.match(source, /factWriteAllowed:\s*false/);
  assert.match(source, /actionWriteAllowed:\s*false/);
  assert.match(source, /actionSourceAllowed:\s*false/);
  assert.match(source, /benchmarkRunId/);
  assert.match(source, /experimentRunId/);
  assert.match(source, /shadowRunId/);
  assert.match(source, /ARCHIVED_SCENARIO_RUN_REUSE_REJECTED/);

  for (const field of ["objectTypeRef", "propertyRef", "type", "unit", "timeGrain", "shape", "cardinality", "nullable", "required", "resultKind", "displayRole", "permissionScope", "consumers"]) assert.match(source, new RegExp(`port\\.${field}`));
  assert.doesNotMatch(source, /"InvestmentProduct"|未来90日到期债务集中度|偿债覆盖和到期压力/);
  assert.match(source, /NON_FACT_SOURCE_REJECTED/);
  assert.match(source, /moduleByConsumer = \{ M07_EXPLORATION: "m07"/);
  assert.match(source, /usage:\s*"simulation"/);
  assert.match(source, /simulation:\s*"objective"/);
  assert.match(source, /replace\(\/\^#\\\/\?\//);
  assert.match(source, /handoff\.usageIntent \|\| handoff\.requestedUseKind \|\| "SIMULATION"/);
  assert.match(html, /content\.css\?v=20260831-06/);
  assert.match(html, /m07-m08-bridge\.js\?v=20260831-06/);
  assert.match(html, /data\.js\?v=20260831-06/);
  assert.match(html, /content\.js\?v=20260831-06/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*m08-workspace-strip/);
});

test("bridge enforces canonical M07 and exact round-trip identity", async () => {
  const sandbox = { URLSearchParams };
  vm.createContext(sandbox);
  vm.runInContext(await read("bridge/m07-m08-bridge.js"), sandbox);
  const bridge = sandbox.OFW_M07_M08_BRIDGE;
  const scenario = { scenarioId: "S005", scenarioVersion: "S005-v1", scenarioRunId: "S005-RUN-TEST-001", formedAt: "2026-08-27T00:00:00.000Z", status: "active" };
  const handoff = bridge.acceptM07Open({
    type: "OFW_M07_OPEN_M08",
    sourceModuleId: "m07",
    sourceRoute: "#module/m07",
    payload: { ...scenario, objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct" } }
  }, scenario);
  assert.equal(handoff.sourceModuleId, "m07");
  assert.deepEqual(Object.keys(bridge.scenarioIdentity(handoff)), [...bridge.IDENTITY_FIELDS]);
  assert.match(bridge.moduleUrl("module/content.html", scenario), /scenarioRunId=S005-RUN-TEST-001/);
  assert.match(bridge.moduleUrl("module/content.html", scenario), /status=active/);
  const delivered = bridge.deliveryMessage({ scenarioContext: scenario, explorationHandoff: handoff }, scenario);
  assert.equal(delivered.payload.explorationHandoff.objectRef.objectTypeRef, "InvestmentProduct");
  const inputManifest = { ...scenario, objectRef: handoff.objectRef };
  const resultEnvelope = { resultId: "SIM-001", inputSnapshot: { ...scenario } };
  const returned = bridge.returnMessage({ inputManifest, resultEnvelope, simulationStatus: "SUCCEEDED" }, scenario);
  assert.equal(returned.type, "OFW_M08_RETURN_TO_M07");
  assert.equal(returned.targetRoute, "#module/m07");
  assert.deepEqual(returned.payload.inputManifest, inputManifest);
  assert.deepEqual(returned.payload.resultEnvelope, resultEnvelope);
  assert.equal(returned.payload.status, "active");
  assert.equal(returned.payload.simulationStatus, "SUCCEEDED");
  assert.throws(() => bridge.acceptM07Open({ type: "OFW_M07_OPEN_M08", payload: { ...scenario, scenarioRunId: "OTHER" } }, scenario));
});

test("SHA256SUMS covers every exported file exactly", async () => {
  const lines = (await read("SHA256SUMS")).trim().split("\n").filter(Boolean);
  const declared = new Map(lines.map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, line);
    return [match[2], match[1]];
  }));
  const files = (await filesBelow()).map((path) => relative(root, path)).filter((path) => path !== "SHA256SUMS").sort();
  assert.deepEqual([...declared.keys()].sort(), files);
  for (const path of files) {
    const digest = createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
    assert.equal(declared.get(path), digest, path);
  }
});
