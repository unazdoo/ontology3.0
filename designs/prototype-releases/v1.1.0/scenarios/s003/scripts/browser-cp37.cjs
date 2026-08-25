#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_NODE_MODULES || "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const BASE_URL = process.env.S003_BROWSER_BASE_URL || "http://127.0.0.1:4333";
const FORMAL_QUERY = new URLSearchParams({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "active",
  contextCreatedAt: "2026-08-17T16:30:00.000Z",
  contextStatus: "active",
  scenarioFormedAt: "2026-08-17T16:30:00.000Z",
  scenarioStatus: "active",
  cb: "2026081938"
}).toString();

function loadPlaywright() {
  return require(path.join(PLAYWRIGHT_ROOT, "playwright"));
}

function attachDiagnostics(page) {
  const result = { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] };
  page.on("console", message => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", error => result.pageErrors.push(error.message));
  page.on("requestfailed", request => result.requestErrors.push(`${request.url()} · ${request.failure()?.errorText || "unknown"}`));
  page.on("response", response => { if (response.status() >= 400) result.httpErrors.push(`${response.status()} ${response.url()}`); });
  return result;
}

function assertClean(diagnostics) {
  assert.deepEqual(diagnostics.consoleErrors, [], `console error: ${JSON.stringify(diagnostics.consoleErrors)}`);
  assert.deepEqual(diagnostics.pageErrors, [], `page error: ${JSON.stringify(diagnostics.pageErrors)}`);
  assert.deepEqual(diagnostics.requestErrors, [], `request error: ${JSON.stringify(diagnostics.requestErrors)}`);
  assert.deepEqual(diagnostics.httpErrors, [], `HTTP error: ${JSON.stringify(diagnostics.httpErrors)}`);
}

async function waitForShell(page) {
  await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: 30000 });
  await page.locator("#module-frame").waitFor({ state: "visible", timeout: 30000 });
}

async function waitForFrameText(page, expected, timeout = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const handle = await page.locator("#module-frame").elementHandle().catch(() => null);
    const frame = handle ? await handle.contentFrame().catch(() => null) : null;
    if (frame) {
      const text = await frame.locator("body").innerText().catch(() => "");
      if (text.includes(expected)) return frame;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`模块 iframe 未形成预期内容: ${expected}`);
}

async function openS003(page, hash, cb = "2026081938") {
  const query = new URLSearchParams(FORMAL_QUERY);
  query.set("cb", cb);
  await page.goto(`${BASE_URL}/s001-e2e-integration/index.html?${query.toString()}${hash}`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
}

async function verifyDashboardModelConfig(page) {
  await openS003(page, "#dashboard");
  let frame = await waitForFrameText(page, "集团债务风险监测");
  const dashboardText = await frame.locator("body").innerText();
  assert.doesNotMatch(dashboardText, /已更新，等待重跑|新模型配置等待重跑|配置变化待重跑/);
  assert.equal(await frame.getByRole("button", { name: "模型配置", exact: true }).count(), 2);

  await frame.getByRole("button", { name: "模型配置", exact: true }).first().click();
  frame = await waitForFrameText(page, "债务风险监测模型配置");
  assert.match(frame.url(), /#published\/version\?id=S003-M01-DEBT-RISK-V\d+_\d+_\d+&tab=s003-model-config&configTab=overview$/);
  assert.equal(await frame.getByRole("button", { name: "返回仪表盘", exact: true }).count(), 1);
  await frame.getByRole("button", { name: "返回仪表盘", exact: true }).click();
  frame = await waitForFrameText(page, "集团债务风险监测");
  assert.match(page.url(), /#dashboard$/);

  await frame.getByRole("button", { name: "模型配置", exact: true }).nth(1).click();
  frame = await waitForFrameText(page, "债务风险监测模型配置");
  assert.match(frame.url(), /#published\/version\?id=S003-M01-DEBT-RISK-V\d+_\d+_\d+&tab=s003-model-config&configTab=overview$/);
  return { modelConfigRoute: frame.url(), falseRerunNotice: false, entryCount: 2 };
}

async function verifyDecisionDrawer(page) {
  await openS003(page, "#module/decision");
  const frame = await waitForFrameText(page, "决策事项列表");
  await frame.getByRole("button", { name: "查看详情", exact: true }).first().click();
  const actionBar = frame.locator(".portfolio-drawer-actions");
  await actionBar.waitFor({ state: "visible", timeout: 10000 });
  const layout = await actionBar.evaluate(element => {
    const style = getComputedStyle(element);
    return { display: style.display, flexWrap: style.flexWrap, overflowX: style.overflowX };
  });
  assert.equal(layout.display, "flex");
  assert.equal(layout.flexWrap, "nowrap");
  const buttons = await actionBar.locator("button").evaluateAll(elements => elements.map(element => ({
    text: element.textContent.trim(),
    className: element.className,
    backgroundColor: getComputedStyle(element).backgroundColor
  })));
  assert.deepEqual(buttons.map(item => item.text), ["查看追溯", "打开完整详情", "拒绝", "确认并交办"]);
  assert.equal(buttons.filter(item => item.className.includes("primary")).length, 1);
  assert.equal(buttons.find(item => item.className.includes("primary"))?.text, "确认并交办");
  assert.notEqual(buttons.at(-1).backgroundColor, buttons[0].backgroundColor);
  return { layout, buttons };
}

async function verifyOldBookmarkAndS001Isolation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await openS003(page, "#dashboard", "2026081937");
  let frame = await waitForFrameText(page, "集团债务风险监测");
  await frame.getByRole("button", { name: "模型配置", exact: true }).first().click();
  frame = await waitForFrameText(page, "债务风险监测模型配置");
  assert.match(frame.url(), /tab=s003-model-config&configTab=overview$/);

  await page.goto(`${BASE_URL}/s001-e2e-integration/index.html?cb=2026081938#module/ontology`, { waitUntil: "domcontentloaded" });
  frame = await waitForFrameText(page, "本体建模");
  const baselineText = await frame.locator("body").innerText();
  assert.doesNotMatch(baselineText, /债务风险监测模型配置/);
  assert.match(baselineText, /本体建模工作台/);
  assertClean(diagnostics);
  await context.close();
  return { staleBookmarkResolved: true, s001Isolated: true };
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = {
    dashboard: await verifyDashboardModelConfig(page),
    decision: await verifyDecisionDrawer(page),
    isolation: await verifyOldBookmarkAndS001Isolation(browser)
  };
  assertClean(diagnostics);
  await context.close();
  await browser.close();
  process.stdout.write(`${JSON.stringify({ status: "passed", diagnostics, result }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
