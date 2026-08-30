import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(root, "../..");
const repositoryRoot = path.resolve(workRoot, "../../..");
const frozenRoot = path.join(repositoryRoot, "designs/prototype-releases/v1.1.0/dashboard");
const read = (file) => fs.readFileSync(file, "utf8");

function loadData(file) {
  const context = vm.createContext({ console });
  context.window = context;
  vm.runInContext(read(file), context, { filename: file });
  return JSON.parse(JSON.stringify(context.DASHBOARD_DATA));
}

function normalizeBaselinePaths(value) {
  if (typeof value === "string") return value.replaceAll("../../../../prototype-releases/v1.1.0/", "../");
  if (Array.isArray(value)) return value.map(normalizeBaselinePaths);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeBaselinePaths(item)]));
  return value;
}

const candidate = loadData(path.join(root, "data.js"));
const frozen = loadData(path.join(frozenRoot, "data.js"));
const appSource = read(path.join(root, "app.js"));
const indexSource = read(path.join(root, "index.html"));

test("candidate Dashboard preserves the three frozen business dashboards", () => {
  assert.deepEqual(candidate.dashboards.map((dashboard) => dashboard.id), ["financing", "budget", "risk", "post-investment"]);
  assert.deepEqual(normalizeBaselinePaths(candidate.dashboards.slice(0, 3)), frozen.dashboards);
});

test("S005 Dashboard uses the registered identity without pinning a run", () => {
  const post = candidate.dashboards[3];
  assert.equal(post.scenarioId, "S005");
  assert.equal(post.scenarioVersion, "S005-v1");
  assert.equal(Object.hasOwn(post, "scenarioRunId"), false);
  assert.equal(post.status, "部分评价");
  assert.equal(post.sourceSummary.snapshotCount, 79);
  assert.equal(post.sourceSummary.sheetInstanceCount, 393);
  assert.equal(post.sourceSummary.candidateCount, 15);
  assert.equal(post.products.length, 5);
  assert.equal(post.marketSeries.series.length, 4);
  assert.equal(post.selectionSeries.series.length, 2);
  assert.equal(post.selectionSeries.expectedSpreadPct, 0.42);
  assert.equal(post.riskLamps.length, 4);
  assert.doesNotMatch(JSON.stringify(post), /当前正式使用|预置成功|已完成/);
});

test("S005 Dashboard exposes four meaningful views and an evidence alias", () => {
  for (const token of [
    '"overview"', '"products"', '"market"', '"selection"',
    "评价概览", "产品目录", "市场横评", "选择与证据",
    'tab === "evidence" ? "selection" : tab'
  ]) assert(appSource.includes(token), `missing S005 Dashboard view contract: ${token}`);
  assert.match(appSource, /renderPostInvestment\(current\.tab\)/);
  assert.match(appSource, /当前结论为部分评价/);
  assert.match(appSource, /不进入正式结果，也不据此创建行动或交易指令/);
});

test("candidate Dashboard remains content-only inside the composite Shell", () => {
  assert.doesNotMatch(`${indexSource}\n${appSource}`, /class=["'][^"']*(?:platform-shell|global-nav|global-topbar)/i);
  assert.match(indexSource, /id="app"/);
  assert.match(indexSource, /data\.js\?v=20260828-01/);
  assert.match(indexSource, /app\.js\?v=20260828-01/);
});
