import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("candidate pages contain no redirect wrappers or background polling loops", () => {
  for (const file of ["s001-e2e-integration/app.js", "integrations/native-module-integrations.js", "model-center/app.js", "dashboard/app.js", "modules/m07/app.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /location\.replace|setInterval|MutationObserver/, file);
  }
});

test("cross-tab state changes never force a full page reload", () => {
  const shell = read("s001-e2e-integration/app.js");
  assert.match(shell, /其他窗口状态已变化/);
  assert.doesNotMatch(shell, /storage[\s\S]{0,180}location\.reload/);
  assert.match(shell, /__OFW_PAGE_INSTANCE__/);
});

test("M07 receives host context only after its resource reports ready", () => {
  const shell = read("s001-e2e-integration/app.js");
  assert.match(shell, /if \(module\.id !== "m07"\) deliverWorkspaceContext/);
  assert.match(shell, /message\.type === "OFW_M07_READY"[\s\S]{0,520}deliverWorkspaceContext\(frame, DATA\.moduleById\.m07\)/);
});

test("Dashboard switches business views without rebuilding its iframe", () => {
  const shell = read("s001-e2e-integration/app.js");
  const focusBlock = shell.match(/if \(message\.type === "OFW_DASHBOARD_SCENARIO_FOCUS"[\s\S]*?return;\n      }/i)?.[0] || "";
  assert.match(focusBlock, /mountNativeIntegration/);
  assert.doesNotMatch(focusBlock, /frame\.src|render\(\)/);
});

test("popstate, hashchange and stale frame callbacks remain guarded", () => {
  const shell = read("s001-e2e-integration/app.js");
  assert.match(shell, /function scheduleNavigationRender/);
  assert.match(shell, /addEventListener\("hashchange", scheduleNavigationRender\)/);
  assert.match(shell, /frame !== document\.getElementById\("module-frame"\)/);
  assert.match(shell, /__OFW_FRAME_LOAD_COUNT__/);
});

test("required desktop and mobile layouts have explicit responsive rules", () => {
  const shellCss = read("s001-e2e-integration/styles.css");
  const m07Css = read("modules/m07/styles.css");
  const m08Css = read("model-center/styles.css");
  const dashboardCss = read("dashboard/styles.css");
  assert.match(shellCss, /@media \(max-width: 620px\)/);
  assert.match(m07Css, /@media \(max-width: 720px\)/);
  assert.match(m08Css, /@media \(max-width: 720px\)/);
  assert.match(dashboardCss, /@media \(max-width: 420px\)/);
});
