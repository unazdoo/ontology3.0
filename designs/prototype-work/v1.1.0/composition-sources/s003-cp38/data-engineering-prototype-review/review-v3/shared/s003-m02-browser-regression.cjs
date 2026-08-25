#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_NODE_MODULES || "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const { chromium } = require(path.join(PLAYWRIGHT_ROOT, "playwright"));
const origin = process.env.S003_BROWSER_ORIGIN || "http://127.0.0.1:4333";
const outputRoot = path.resolve(process.env.S003_M02_BROWSER_OUTPUT || "/tmp/s003-m02-browser-regression");
const scenarioRunId = "S003-RUN-20260817163000000-c02200000001";
const scenarioIdentity = { scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId, baselineVersion: "v1.0.3", baselineSnapshotId: "BSL-S001-V103-DE0119608E26" };

function moduleUrl(hash = "#/resources") {
  const query = new URLSearchParams({
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId,
    formedAt: "2026-08-17T16:30:00.000Z",
    status: "active",
    baselineVersion: "v1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26"
  });
  return `${origin}/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html?${query}${hash}`;
}

function attachDiagnostics(page) {
  const result = { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] };
  page.on("console", message => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", error => result.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(reason)) result.requestErrors.push({ url: request.url(), reason });
  });
  page.on("response", response => { if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status() }); });
  return result;
}

async function waitReady(page) {
  await page.goto(moduleUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => window.DE_SCENARIO_HOST?.scenarioId === "S003" && document.querySelectorAll(".source-resource-table tbody tr").length === 1, null, { timeout: 30_000 });
}

async function openSource(page, name) {
  if (!locationHashIsResources(await page.url())) await page.evaluate(() => { location.hash = "#/resources"; });
  await page.waitForFunction(() => location.hash === "#/resources" || location.hash.startsWith("#/resources?"));
  const row = page.locator(".source-resource-table tbody tr").filter({ hasText: name }).first();
  await row.waitFor({ state: "visible" });
  await row.getByRole("button", { name: "查看详情" }).click();
  await page.waitForFunction(() => location.hash.includes("/resources/source/"));
}

function locationHashIsResources(url) {
  return /#\/resources(?:\?|$)/.test(url);
}

async function selectTab(page, label) {
  const tab = page.locator(".tabs .tab").filter({ hasText: label }).first();
  await tab.waitFor({ state: "visible" });
  await tab.click();
  await page.waitForTimeout(80);
  const body = (await page.locator(".main").innerText()).trim();
  assert.ok(body.length > 80, `${label} 页签为空白`);
  return body;
}

async function verifyNativeSurfaces(browser) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await waitReady(page);

  const directoryText = await page.locator(".source-resource-table").innerText();
  assert.match(directoryText, /企业债务风险评估模版/);
  assert.doesNotMatch(directoryText, /企业因子输入|调节因子配置|风险分档配置/);

  await openSource(page, "企业债务风险评估模版");
  const overview = await selectTab(page, "概览");
  for (const token of ["正式来源已登记", "财务数据", "I / AA", "CNY / 元", "消费就绪"]) assert.match(overview, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const content = await selectTab(page, "内容与字段");
  assert.match(content, /正式快照内容/);
  assert.match(content, /财务数据/);
  assert.equal(await page.locator(".sheet-list .sheet-item").count(), 1);
  assert.equal((await page.locator(".sheet-list .sheet-item").first().innerText()).includes("财务数据"), true);
  assert.doesNotMatch(await page.locator(".sheet-list").innerText(), /调节因子/);
  assert.equal((await page.locator(".sheet-detail h3").innerText()).trim(), "财务数据");
  const snapshots = await selectTab(page, "快照历史");
  assert.match(snapshots, /下载数据表/);
  assert.match(snapshots, /2025-12-31/);
  const workbookHref = await page.locator('.snapshot-row a[download]').first().getAttribute("href");
  assert.match(workbookHref, /企业债务风险评估模版_S003兼容版\.xlsx$/);
  const workbookResponse = await page.request.get(new URL(workbookHref, page.url()).href);
  assert.equal(workbookResponse.status(), 200);
  assert.equal((await workbookResponse.body()).length, 16250);
  assert.match(await selectTab(page, "引用关系"), /债务风险(?:财务数据|输入)标准化与候选发布/);
  const settings = await selectTab(page, "设置");
  assert.match(settings, /按需上传/);
  assert.match(settings, /手工工作簿不设置来源同步计划/);
  assert.match(settings, /前往管道设置运行计划/);

  await page.evaluate(() => { location.hash = "#/pipelines?tab=definitions"; });
  await page.waitForFunction(() => location.hash.startsWith("#/pipelines?tab=definitions"));
  const pipelineCard = page.locator(".pipeline-card").filter({ hasText: /债务风险(?:财务数据|输入)标准化与候选发布/ }).first();
  await pipelineCard.getByRole("link", { name: "查看画布" }).click();
  await page.waitForFunction(() => location.hash.includes("/pipelines/S003-M02-PIPELINE-001/canvas"));
  await page.locator('.canvas-node[data-node-key="source"]').first().waitFor({ state: "visible" });
  assert.equal(await page.locator('.canvas-node[data-node-key="source"]').count(), 1);
  assert.equal(await page.locator(".canvas-node").count(), 5);
  const canvasText = await page.locator("#canvas-world").innerText();
  for (const token of ["企业债务风险评估模版", "财务数据", "Python 处理", "数据检查", "发布数据资产", "提交本体刷新请求"]) assert.match(canvasText, new RegExp(token));
  assert.doesNotMatch(canvasText, /企业因子输入|调节因子配置|风险分档配置/);
  await page.locator('.canvas-node[data-node-key="source"]').first().click();
  assert.match(await page.locator(".node-rail").innerText(), /企业债务风险评估模版|财务数据/);
  const viewport = page.locator(".canvas-viewport");
  const world = page.locator("#canvas-world");
  const beforeZoom = await world.evaluate(node => getComputedStyle(node).transform);
  const viewportBox = await viewport.boundingBox();
  assert.ok(viewportBox, "管道画布可视区域不存在");
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
  await page.mouse.wheel(0, -180);
  await page.waitForTimeout(120);
  const afterZoom = await world.evaluate(node => getComputedStyle(node).transform);
  assert.notEqual(afterZoom, beforeZoom, "鼠标滚轮未缩放管道画布");
  const beforePan = await viewport.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
  const blankPoint = await viewport.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const candidates = [[0.18, 0.78], [0.34, 0.72], [0.52, 0.82], [0.72, 0.76], [0.84, 0.68]];
    for (const [rx, ry] of candidates) {
      const x = rect.left + rect.width * rx;
      const y = rect.top + rect.height * ry;
      const hit = document.elementFromPoint(x, y);
      if (hit && node.contains(hit) && !hit.closest("[data-node-card],button,input,select,textarea,.canvas-mode-banner,.zoom-tools")) return { x, y };
    }
    return null;
  });
  assert.ok(blankPoint, "未找到可拖动的管道画布空白区域");
  await page.mouse.move(blankPoint.x, blankPoint.y);
  await page.mouse.down();
  await page.mouse.move(blankPoint.x - 70, blankPoint.y - 45, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const afterPan = await viewport.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
  assert.notDeepEqual(afterPan, beforePan, "拖动画布背景未产生平移");
  await page.locator('.canvas-node[data-node-key="python"]').click();
  const pythonRail = await page.locator(".node-rail").innerText();
  assert.match(pythonRail, /债务风险(?:财务)?数据标准化/);
  assert.match(pythonRail, /配置正文输入\s*0 个/);
  await page.locator('.canvas-node[data-node-key="quality"]').click();
  assert.match(await page.locator(".node-rail").innerText(), /不检查风险评分、系数、权重或阈值/);
  await page.evaluate(() => { location.hash = "#/resources/asset/s003-debt-risk-asset?tab=consumption"; });
  await page.waitForFunction(() => location.hash.includes("/resources/asset/s003-debt-risk-asset") && location.hash.includes("tab=consumption"));
  const consumptionText = await page.locator("body").innerText();
  assert.match(consumptionText, /消费就绪/);
  assert.match(consumptionText, /完整回执|正式采用证据/);
  assert.doesNotMatch(consumptionText, /刷新未就绪|7 项通过/);

  fs.mkdirSync(outputRoot, { recursive: true });
  await page.screenshot({ path: path.join(outputRoot, "m02-native-surfaces.png"), fullPage: true });
  await context.close();
  return { diagnostics, workbookHref, sourceNodes: 1, totalNodes: 5, c003Closed: true };
}

async function verifyPublicShell(browser) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const query = new URLSearchParams({ scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId, scenarioFormedAt: "2026-08-17T16:30:00.000Z", scenarioStatus: "active" });
  await page.goto(`${origin}/s001-e2e-integration/index.html?${query}#home`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: 30_000 });
  await page.locator('.nav-item[data-route="#module/data"]').click();
  const frame = page.frameLocator("#module-frame");
  await frame.locator(".source-resource-table").waitFor({ state: "visible", timeout: 30_000 });
  await frame.locator(".source-resource-table").filter({ hasText: "企业债务风险评估模版" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector("#module-frame")?.contentWindow?.DE_SCENARIO_EXTENSION?.getHealth?.().status === "healthy", null, { timeout: 30_000 });
  const directory = await frame.locator(".source-resource-table").innerText();
  assert.match(directory, /企业债务风险评估模版/);
  assert.doesNotMatch(directory, /企业因子输入|调节因子配置|风险分档配置/);
  const health = await frame.locator("body").evaluate(() => window.DE_SCENARIO_EXTENSION?.getHealth?.());
  assert.equal(health.status, "healthy", health.detail);
  assert.equal(health.scenarioContext.scenarioRunId, scenarioRunId);
  await page.screenshot({ path: path.join(outputRoot, "m02-public-shell.png"), fullPage: true });
  await context.close();
  return { diagnostics, status: health.status, scenarioRunId: health.scenarioContext.scenarioRunId };
}

async function verifyS001Isolation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(`${origin}/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html?scenarioId=S001#/resources`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".source-resource-table").waitFor({ state: "visible", timeout: 30_000 });
  const directory = await page.locator(".source-resource-table").innerText();
  assert.doesNotMatch(directory, /调节因子配置|风险分档配置/);
  const state = await page.evaluate(() => ({ extension: Boolean(window.DE_SCENARIO_EXTENSION), hostScenarioId: window.DE_SCENARIO_HOST?.scenarioId }));
  assert.equal(state.extension, false);
  assert.equal(state.hostScenarioId, "S001");
  await page.evaluate(() => { location.hash = "#/pipelines?tab=definitions"; });
  await page.waitForFunction(() => location.hash.startsWith("#/pipelines?tab=definitions"));
  assert.doesNotMatch(await page.locator(".pipeline-list").innerText(), /债务风险输入标准化与候选发布/);
  await page.screenshot({ path: path.join(outputRoot, "m02-s001-isolation.png"), fullPage: true });
  await context.close();
  return { diagnostics, extensionLoaded: state.extension, hostScenarioId: state.hostScenarioId };
}

async function verifyRetiredConfigurationRoutes(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const outcomes = {};
  for (const [sourceId, expectedTab] of [["s003-enterprise-factor-input", "overview"], ["s003-factor-config", "factors"], ["s003-risk-band-config", "tiers"]]) {
    await page.goto(moduleUrl(`#/resources/source/${sourceId}?tab=overview`), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForURL(url => url.pathname.includes("/ontology-management-review/canvas-first/index.html") && url.hash.includes(`configTab=${expectedTab}`), { timeout: 30_000 });
    await page.getByRole("heading", { name: "债务风险监测模型配置" }).waitFor({ state: "visible", timeout: 30_000 });
    const bodyText = await page.locator("body").innerText();
    assert.match(bodyText, /调节因子定义与系数|风险分档阈值|配置总览/);
    assert.doesNotMatch(bodyText, /企业因子配置/);
    outcomes[sourceId] = expectedTab;
  }
  await page.screenshot({ path: path.join(outputRoot, "m02-retired-config-routes.png"), fullPage: true });
  await context.close();
  return { diagnostics, outcomes };
}

(async () => {
  fs.mkdirSync(outputRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const result = { formedAt: new Date().toISOString(), origin, cases: {} };
  try {
    result.cases.native = await verifyNativeSurfaces(browser);
    result.cases.publicShell = await verifyPublicShell(browser);
    result.cases.s001Isolation = await verifyS001Isolation(browser);
    result.cases.retiredConfigurationRoutes = await verifyRetiredConfigurationRoutes(browser);
    for (const item of Object.values(result.cases)) {
      assert.deepEqual(item.diagnostics, { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] });
    }
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(outputRoot, "result.json"), JSON.stringify(result, null, 2));
    process.stdout.write(`${result.status.toUpperCase()} ${path.join(outputRoot, "result.json")}\n`);
  }
})();
