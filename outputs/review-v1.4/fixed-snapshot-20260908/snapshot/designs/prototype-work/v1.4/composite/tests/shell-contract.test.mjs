import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const compositeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(compositeRoot, "../../../..");
const read = (file) => fs.readFileSync(path.join(compositeRoot, file), "utf8");

function loadData() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInContext(read("s001-e2e-integration/data.js"), vm.createContext(sandbox));
  return sandbox.OFW_V131_DATA;
}

test("v1.4 inherits v1.3.2 with the original frozen ancestor anchors", () => {
  const data = loadData();
  const html = read("s001-e2e-integration/index.html");
  assert.equal(data.version, "v1.4-rc.1");
  assert.equal(data.parentVersion, "v1.3.2-rc.1");
  assert.equal(data.parentManifest, "INHERITANCE-MANIFEST.json");
  assert.equal(data.ancestorCommit, "e3990c69e77882062035490ef718fd93549bbf82");
  assert.equal(data.ancestorSubtree, "a24109c8be2ffceca73e0fedbb9387f4b85a7176");
  assert.equal(data.acceptanceReady, false);
  assert.match(html, /v1\.2\.0\/composite\/s001-e2e-integration\/styles\.css/);
  assert.match(html, /\.\/app\.js/);
  assert.doesNotMatch(html, /<iframe[^>]+v1\.3\.0\/composite\/s001-e2e-integration/);
});

test("one Shell registers M01-M08 and the business cockpit once", () => {
  const data = loadData();
  assert.equal(data.modules.length, 8);
  assert.equal(data.nav.length, 10);
  assert.equal(new Set(data.nav.map((item) => item.route)).size, 10);
  assert.equal(data.moduleById.m07.source.startsWith("../modules/m07/index.html"), true);
  assert.equal(data.moduleById.modeling.source.startsWith("../model-center/index.html"), true);
  assert.equal(data.moduleById.modeling.name, "模型目标与优化");
  assert.equal(data.dashboard.name, "经营驾驶舱");
});

test("homepage keeps the fixed three-domain architecture and real feature launcher", () => {
  const shell = read("s001-e2e-integration/app.js");
  const css = read("s001-e2e-integration/styles.css");
  for (const token of ["数据与本体", "探索与建模", "运营与智能", "homeCapabilityPanelMarkup", "home-capability-entry", "openHomeEntry"]) assert.match(shell, new RegExp(token));
  assert.match(css, /classic-home-frame[^}]*grid-template-columns:\s*minmax\(500px/);
  assert.match(css, /home-capability-panel/);
  assert.doesNotMatch(shell, /场景运行与待办|统一资源目录|模块工作区|全部可用|S001—S005 · 全链路协同/);
});

test("module tasks stay in the Shell with a shared horizontal cockpit layout", () => {
  const shell = read("s001-e2e-integration/app.js");
  const css = read("s001-e2e-integration/styles.css");
  assert.match(shell, /m07:[\s\S]*id: "discover"[\s\S]*id: "explore"/);
  for (const view of ["objectives", "models", "compare", "observe", "release"]) assert.match(shell, new RegExp(`id: "${view}"`));
  assert.match(css, /module-subnav[^}]*background:\s*#e4ebf2/);
  assert.match(css, /module-subnav-item span:last-child[^}]*font-size:\s*13px/);
  assert.match(shell,/module\.id === 'dashboard' \? ' cockpit-layout'/);
  assert.match(css,/\.cockpit-layout > \.module-subnav > nav[^}]*display:\s*flex/);
  assert.doesNotMatch(shell, /data-module-scenario-select|module-scenario-control/);
});

test("WorkspaceContext remains canonical and synchronized without a global context chip", () => {
  const state = read("s001-e2e-integration/state.js");
  const shell = read("s001-e2e-integration/app.js");
  for (const field of ["objectSetRef", "activeObjectRef", "timeRange", "comparisonRef", "resultView", "dataVersionRef", "ontologyVersionRef", "evidenceRefs"]) assert.match(state, new RegExp(field));
  for (const token of ["normalizeWorkspaceContextPatch", "OFW_WORKSPACE_CONTEXT", "OFW_WORKSPACE_CONTEXT_UPDATE"]) assert.match(shell, new RegExp(token));
  assert.doesNotMatch(shell.slice(shell.indexOf("function topbarMarkup"), shell.indexOf("function syncWorkspaceContextChrome")), /workspace-context-slot|workspaceContextChipMarkup/);
  assert.match(shell, /message\.patch \|\| message\.payload \|\| message\.context/);
});

test("M07 provides discovery plus six shared-context lenses", () => {
  const app = read("modules/m07/app.js");
  const resource = JSON.parse(read("modules/m07/resources/portfolio.json"));
  assert.equal(resource.objects.length, 71);
  assert.equal(resource.objects.filter((item) => item.enterpriseId).length, 21);
  assert.ok(resource.links.length > 0 && resource.series.length > 0);
  for (const lens of ["catalog", "object360", "graph", "temporal", "spatial", "compare"]) assert.match(app, new RegExp(lens));
  assert.match(app, /selectionMode: explicit \? "EXPLICIT" : "FILTERED"/);
  assert.match(app, /OFW_M07_OPEN_M08|OFW_M08_RETURN_TO_M07|OFW_WORKSPACE_CONTEXT_UPDATE/);
});

test("M08 is objective-centric, generic and retains the real Python/Git drilldown", () => {
  const app = read("model-center/app.js");
  const css = read("model-center/styles.css");
  for (const view of ["objectives", "models", "compare", "observe", "release"]) assert.ok(app.includes(`["${view}"`), view);
  for (const token of ["target-card", "comparison-board", "Shadow", "消费者地图", "Python 模型代码仓", "data-repository-action"]) assert.match(app, new RegExp(token));
  assert.doesNotMatch(app, /S003|Enterprise|liquidityGap|\/v1\/s003/);
  assert.match(css, /repository-layout/);
});

test("inherited real workspaces retain query animation, action, decision and report flows", () => {
  const integrations = read("integrations/native-module-integrations.js");
  for (const step of ["正在确认问题范围", "正在读取权威数据", "正在整理业务结果", "正在核对回答依据", "正在生成回答"]) assert.match(integrations, new RegExp(step));
  for (const token of ["QUERY_SCENARIOS", "ofw-query-scenario-tabs", "ofw-sector-comparison", "query-action-submit", "ofw-decision-ops", "report-add-context", "dashboard-open"]) assert.match(integrations, new RegExp(token));
  assert.doesNotMatch(integrations, /v1\.3 增量|原 v1\.2 页面|查看增量|模型结果拦截/);
});
