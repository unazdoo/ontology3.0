#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_NODE_MODULES || "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const BASE_URL = process.env.S003_BROWSER_BASE_URL || "http://127.0.0.1:4333";
const OUTPUT_ROOT = path.resolve(process.env.S003_SURFACE_OUTPUT_ROOT || path.join(__dirname, "..", "evidence", "browser-surface"));
const FORMED_AT = process.env.S003_SURFACE_FORMED_AT || new Date().toISOString();
const RUN_ID = process.env.S003_SURFACE_RUN_ID || `${FORMED_AT.replace(/[-:.]/g, "").replace("Z", "Z")}-${crypto.randomBytes(4).toString("hex")}`;
const RUN_DIR = path.join(OUTPUT_ROOT, RUN_ID);
const SCENARIO_QUERY = "scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260817163000000-c02200000001&scenarioFormedAt=2026-08-17T16:30:00.000Z&scenarioStatus=active";
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

function loadPlaywright() {
  return require(path.join(PLAYWRIGHT_ROOT, "playwright"));
}

function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] };
  page.on("console", message => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", error => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", request => diagnostics.requestErrors.push(`${request.url()} · ${request.failure()?.errorText || "unknown"}`));
  page.on("response", response => { if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function openShell(browser, hash) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(`${BASE_URL}/s001-e2e-integration/index.html?${SCENARIO_QUERY}${hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: 30000 });
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: 30000 });
  const frame = async () => {
    const handle = await page.locator("#module-frame").elementHandle({ timeout: 30000 });
    return handle.contentFrame();
  };
  return { context, page, diagnostics, frame };
}

async function waitForFrameText(page, matcher, timeout = 30000) {
  const started = Date.now();
  let lastFrame = null;
  while (Date.now() - started < timeout) {
    const handle = await page.locator("#module-frame").elementHandle().catch(() => null);
    const nextFrame = handle ? await handle.contentFrame().catch(() => null) : null;
    if (nextFrame) {
      lastFrame = nextFrame;
      const text = await nextFrame.locator("body").innerText().catch(() => "");
      if (typeof matcher === "function" ? matcher(text) : text.includes(matcher)) return nextFrame;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`模块 iframe 文本未在超时内形成: ${typeof matcher === "string" ? matcher : "matcher"}; last=${lastFrame ? await lastFrame.locator("body").innerText().catch(() => "") : "无 frame"}`);
}

function assertClean(diagnostics) {
  assert.deepEqual(diagnostics.consoleErrors, [], `console error: ${JSON.stringify(diagnostics.consoleErrors)}`);
  assert.deepEqual(diagnostics.pageErrors, [], `page error: ${JSON.stringify(diagnostics.pageErrors)}`);
  assert.deepEqual(diagnostics.requestErrors, [], `request error: ${JSON.stringify(diagnostics.requestErrors)}`);
  assert.deepEqual(diagnostics.httpErrors, [], `HTTP error: ${JSON.stringify(diagnostics.httpErrors)}`);
}

async function m02Detail(browser) {
  const { context, page, diagnostics, frame } = await openShell(browser, "#module/data");
  const f = await frame();
  await f.getByText("企业债务风险评估模版", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  assert.match(decodeURI(f.url()), /方案B2\.html/);
  assert.match(f.url(), /#\/resources$/);
  const row = f.locator("tr").filter({ hasText: "企业债务风险评估模版" }).first();
  assert.equal(await row.count(), 1);
  await row.getByRole("button", { name: "查看详情" }).click();
  await f.waitForTimeout(250);
  assert.match(f.url(), /#\/resources\/source\/s003-workbook\?tab=overview$/);
  const text = await f.locator("body").innerText();
  for (const expected of ["企业债务风险评估模版", "财务数据", "调节因子", "I / AA", "CNY / 元", "企业因子输入版本", "来源取得与运行计划", "质量结果", "质量检查不拥有业务模型"]) {
    assert.match(text, new RegExp(escapeRegExp(expected)), `M02 detail missing ${expected}`);
  }
  assert.equal(await f.locator(".detail-hero").count(), 1);
  assert.equal(await f.locator(".tabs").count() >= 1, true);
  assert.equal(await f.getByRole("link", { name: "企业因子在线填报" }).count(), 0, "企业因子输入不应再作为数据源详情页签");
  assert.doesNotMatch(text, /企业因子配置/);
  assertClean(diagnostics);
  await page.screenshot({ path: path.join(RUN_DIR, "m02-detail.png"), fullPage: false });
  const result = { route: f.url(), detailStructure: ["detail-hero", "tabs", "detail-grid"], factorInputSeparated: true };
  await context.close();
  return result;
}

async function m01Published(browser) {
  const { context, page, diagnostics, frame } = await openShell(browser, "#module/ontology");
  const f = await frame();
  await f.getByText("企业债务风险评估模型", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const nativeText = await f.locator("body").innerText();
  assert.match(nativeText, /Published/);
  assert.match(nativeText, /S003-M01-DEBT-RISK-PKG/);
  await f.getByRole("button", { name: "查看版本详情" }).click();
  await f.waitForTimeout(200);
  await f.getByRole("button", { name: "模型配置" }).click();
  await f.waitForTimeout(200);
  const configText = await f.locator("body").innerText();
  for (const expected of ["债务风险监测模型配置", "评分权重", "调节因子配置", "风险分档配置", "在建企业固定 60", "盈利历史不足按 A", "缺失因子按 0 档"]) {
    assert.match(configText, new RegExp(expected.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), `M01 config missing ${expected}`);
  }
  await f.locator(".s003-m01-config-tabs").getByRole("link", { name: "评分权重", exact: true }).click();
  await f.waitForTimeout(100);
  const weightInputCount = await f.locator('input[data-s003-m01-weight]').count();
  assert.equal(weightInputCount, 45);
  await f.locator(".s003-m01-config-tabs").getByRole("link", { name: "调节因子配置", exact: true }).click();
  await f.waitForTimeout(100);
  const factorInputCount = await f.locator('input[data-s003-m01-factor]').count();
  assert.equal(factorInputCount > 0, true);
  await f.locator(".s003-m01-config-tabs").getByRole("link", { name: "风险分档配置", exact: true }).click();
  await f.waitForTimeout(100);
  const tierInputCount = await f.locator('input[data-s003-m01-tier]').count();
  assert.equal(tierInputCount, 8);
  assertClean(diagnostics);
  await page.screenshot({ path: path.join(RUN_DIR, "m01-published-config.png"), fullPage: false });
  const result = { route: f.url(), weightInputCount, factorInputCount, tierInputCount };
  await context.close();
  return result;
}

async function m03DeepLink(browser) {
  const { context, page, diagnostics, frame } = await openShell(browser, "#module/query");
  const f = await frame();
  await f.evaluate(() => { location.hash = "#/semantics"; });
  await f.waitForTimeout(500);
  const card = f.locator(".resource-card").filter({ hasText: "债务风险评估 Published 模型包" }).first();
  assert.equal(await card.count(), 1);
  await card.getByRole("button", { name: /查看详情/ }).click();
  await f.waitForTimeout(100);
  const popupPromise = context.waitForEvent("page", { timeout: 10000 });
  await f.getByRole("button", { name: "查看详情" }).last().click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.waitForTimeout(700);
  assert.match(popup.url(), /ontology-management-review\/canvas-first\/index\.html/);
  assert.match(popup.url(), /#published\/ontology\?id=S003-M01-DEBT-RISK-PKG&version=S003-M01-DEBT-RISK-PKG(?:%40|@)1\.0\.2/);
  assert.match(await popup.locator("body").innerText(), /企业债务风险评估模型/);
  assertClean(diagnostics);
  await popup.screenshot({ path: path.join(RUN_DIR, "m03-to-m01-deep-link.png"), fullPage: false });
  const result = { sourceRoute: f.url(), targetRoute: popup.url() };
  await popup.close();
  await context.close();
  return result;
}

async function m06Report(browser) {
  const { context, page, diagnostics, frame } = await openShell(browser, "#module/report");
  let f = await frame();
  await f.evaluate(() => { location.hash = "#/dashboard/s003"; });
  f = await waitForFrameText(page, "集团债务风险监测");
  const text = await f.locator("body").innerText();
  for (const expected of ["集团债务风险监测", "企业风险评分明细", "21", "风电测试公司01"]) assert.match(text, new RegExp(escapeRegExp(expected)), `M06 dashboard missing ${expected}`);
  const reportButton = f.locator('button[data-action="s003-open-formal-report"]').first();
  assert.equal(await reportButton.count(), 1);
  await reportButton.click();
  await f.waitForTimeout(350);
  assert.match(f.url(), /#\/reports\/view\?enterpriseId=S003-ENT-020/);
  const reportText = await f.locator("body").innerText();
  for (const expected of ["企业债务风险评估报告", "财务指标评分明细", "规则与特殊语义", "核验、版本、产物与证据", "S003-RUN-20260817163000000-c02200000001"]) assert.match(reportText, new RegExp(escapeRegExp(expected)), `report detail missing ${expected}`);
  assert.doesNotMatch(reportText, /单位553|单位465|单位561/);
  assertClean(diagnostics);
  await page.screenshot({ path: path.join(RUN_DIR, "m06-dashboard-report.png"), fullPage: false });
  const result = { dashboardRoute: f.url(), reportRunId: "S003-RUN-20260817163000000-c02200000001" };
  await context.close();
  return result;
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  for (const [id, run] of [["m02-detail", m02Detail], ["m01-published", m01Published], ["m03-deep-link", m03DeepLink], ["m06-report", m06Report]]) {
    const startedAt = Date.now();
    try {
      cases.push({ id, status: "passed", details: await run(browser), durationMs: Date.now() - startedAt });
      process.stdout.write(`PASS ${id}\n`);
    } catch (error) {
      cases.push({ id, status: "failed", error: { message: error.message, stack: error.stack }, durationMs: Date.now() - startedAt });
      process.stdout.write(`FAIL ${id} ${error.message}\n`);
    }
  }
  await browser.close();
  const result = { schemaVersion: "ofw.s003.browser-surface-result.v1", runId: RUN_ID, formedAt: FORMED_AT, baseUrl: BASE_URL, cases, totals: { cases: cases.length, passed: cases.filter(item => item.status === "passed").length, failed: cases.filter(item => item.status === "failed").length } };
  const outputPath = path.join(RUN_DIR, "browser-surface-results.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`RESULT ${outputPath}\n`);
  if (result.totals.failed) process.exitCode = 1;
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
