import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("candidate pages contain no redirect wrappers or background polling loops", () => {
  const files = [
    "s001-e2e-integration/app.js",
    "integrations/native-module-integrations.js",
    "model-center/app.js",
    "dashboard/index.html",
    "dashboard/app.js"
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /location\.replace|setInterval|MutationObserver/, file);
  }
});

test("cross-tab state changes never force a full page reload", () => {
  const source = read("s001-e2e-integration/app.js");
  assert.match(source, /其他窗口状态已变化/);
  assert.doesNotMatch(source, /storage[\s\S]{0,160}location\.reload/);
  assert.match(source, /__OFW_PAGE_INSTANCE__/);
});

test("popstate and hashchange are coalesced into one iframe render", () => {
  const source = read("s001-e2e-integration/app.js");
  assert.match(source, /function scheduleNavigationRender/);
  assert.match(source, /addEventListener\("popstate"[\s\S]*scheduleNavigationRender/);
  assert.match(source, /addEventListener\("hashchange", scheduleNavigationRender\)/);
  assert.match(source, /__OFW_FRAME_LOAD_COUNT__/);
});

test("stale iframe callbacks cannot overwrite the current module breadcrumb", () => {
  const source = read("s001-e2e-integration/app.js");
  assert.match(source, /frame !== document\.getElementById\("module-frame"\)/);
  assert.match(source, /renderedModuleId !== module\.id/);
});

test("new multi-model table is reorganized as cards on narrow screens", () => {
  const css = read("dashboard/styles.css");
  const app = read("dashboard/app.js");
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*s003-enterprise-table\.multi-model/);
  for (const label of ["企业", "90天概率", "风险事件 / 时间", "90天缺口", "关系 / 异常", "置信度", "证据"]) assert(app.includes(`data-label=\"${label}\"`));
});

test("Dashboard enterprise detail exposes the full multi-model evidence chain", () => {
  const app = read("dashboard/app.js");
  const css = read("dashboard/styles.css");
  for (const field of ["survivalCurve", "eventTypeProbabilities", "maturityWall", "relationRiskPath", "anomalyEvents", "contributors", "confidenceMissingReasons", "semanticContractVersionId", "evidenceRefs"]) assert.match(app, new RegExp(field));
  for (const label of ["风险时间曲线", "风险事件类型", "流动性缺口与债务到期墙", "关系传染路径", "异常事件", "指标与因子贡献", "模型、数据与证据"]) assert.match(app, new RegExp(label));
  assert.match(css, /s003-detail-bars/);
  assert.match(css, /s003-relation-path/);
  assert.match(css, /s003-contributor-list/);
});

test("model management UI uses one generic scenario contract and explicit review actions", () => {
  const app = read("model-center/app.js");
  assert.match(app, /model-management\/context/);
  assert.match(app, /model-management\/actions/);
  assert.match(app, /review-approve|review-reject|review-insights/);
  assert.match(app, /模型优化中心/);
  assert.doesNotMatch(app, /S003|Enterprise|债务风险|liquidityGap|\/v1\/s003/);
});

test("business-facing model screens do not expose raw evaluation status as primary copy", () => {
  const dashboard = read("dashboard/app.js");
  const registration = read("runtime/s003-registration.mjs");
  assert.match(dashboard, /EVALUATED: "已评测"/);
  assert.match(registration, /title: "校准与单调约束的组合改进"/);
  assert.match(registration, /title: "补齐流动性数据覆盖"/);
  assert.match(registration, /title: "补齐关系网络覆盖"/);
});
