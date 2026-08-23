#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_NODE_MODULES || "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const ORIGIN = process.env.S003_BROWSER_ORIGIN || "http://127.0.0.1:4333";
const SCENARIO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.resolve(process.env.S003_CP18_BROWSER_OUTPUT || path.join(SCENARIO_ROOT, "evidence", "browser-cp18"));
const FIXED_NOW = process.env.S003_BROWSER_NOW || null;
const FORMED_AT = FIXED_NOW || new Date().toISOString();
const RUN_ID = `${FORMED_AT.replace(/[-:.]/g, "").replace("Z", "Z")}-${crypto.randomBytes(4).toString("hex")}`;
const RUN_DIR = path.join(OUTPUT_ROOT, RUN_ID);
const TIMEOUT = 60_000;
const FORMAL = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260815133000000-c03503000001",
  formedAt: "2026-08-15T13:30:00.000Z",
  status: "active"
});

const MODULES = Object.freeze([
  { id: "data", path: /data-engineering-prototype-review\/review-v3\/(?:%E6%96%B9%E6%A1%88B2|方案B2)\.html/, marker: "数据资源" },
  { id: "ontology", path: /ontology-management-review\/canvas-first\/index\.html/, marker: "本体建模" },
  { id: "query", path: /intelligent-query-prototype\/review-next\/conversation-workspace\/index\.html/, marker: "问数工作台" },
  { id: "decision", path: /decision-center-prototype\/(?:index\.html|review-v2\/action-portfolio\.html)/, marker: "决策工作台" },
  { id: "agent", path: /agent-application\/(?:Agent%E5%BA%94%E7%94%A8|Agent应用)\.html/, marker: "Agent 目录" },
  { id: "report", path: /report-center\/review-lifecycle\/index\.html/, marker: "报告目录" }
]);

function shellUrl(scenarioId, hash) {
  if (scenarioId === "S001") return `${ORIGIN}/s001-e2e-integration/index.html?scenarioId=S001${hash}`;
  const query = new URLSearchParams({
    scenarioId: FORMAL.scenarioId,
    scenarioVersion: FORMAL.scenarioVersion,
    scenarioRunId: FORMAL.scenarioRunId,
    scenarioFormedAt: FORMAL.formedAt,
    scenarioStatus: FORMAL.status
  });
  return `${ORIGIN}/s001-e2e-integration/index.html?${query}${hash}`;
}

function attachDiagnostics(page) {
  const value = { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] };
  page.on("console", message => {
    if (message.type() !== "error") return;
    const location = message.location?.() || {};
    value.consoleErrors.push({ text: message.text(), url: location.url || null, lineNumber: location.lineNumber ?? null });
  });
  page.on("pageerror", error => value.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(reason)) value.requestErrors.push({ url: request.url(), reason });
  });
  page.on("response", response => { if (response.status() >= 400) value.httpErrors.push({ url: response.url(), status: response.status() }); });
  return value;
}

function assertClean(value) {
  assert.deepEqual(value.consoleErrors, []);
  assert.deepEqual(value.pageErrors, []);
  assert.deepEqual(value.requestErrors, []);
  assert.deepEqual(value.httpErrors, []);
}

async function openShell(browser, scenarioId = "S003", hash = "#home") {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "zh-CN", timezoneId: "Asia/Shanghai", acceptDownloads: true });
  if (FIXED_NOW) {
    await context.addInitScript(({ fixedNow }) => {
      const NativeDate = Date;
      const fixedMs = NativeDate.parse(fixedNow);
      function FixedDate(...args) {
        if (!(this instanceof FixedDate)) return new NativeDate(fixedMs).toString();
        return new NativeDate(...(args.length ? args : [fixedMs]));
      }
      FixedDate.prototype = NativeDate.prototype;
      Object.setPrototypeOf(FixedDate, NativeDate);
      FixedDate.now = () => fixedMs;
      FixedDate.parse = NativeDate.parse;
      FixedDate.UTC = NativeDate.UTC;
      window.Date = FixedDate;
    }, { fixedNow: FIXED_NOW });
  }
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(shellUrl(scenarioId, hash), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  if (scenarioId === "S003") {
    await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: TIMEOUT });
  } else {
    await page.waitForFunction(() => window.S001_STORE?.getScenarioContext?.("S001")?.scenarioId === "S001", null, { timeout: TIMEOUT });
  }
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: TIMEOUT });
  return { context, page, diagnostics };
}

async function currentFrame(page) {
  const handle = await page.locator("#module-frame").elementHandle({ timeout: TIMEOUT });
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("模块 iframe 未形成");
  return frame;
}

async function waitShellFrameBody(page, pattern) {
  const matcher = pattern instanceof RegExp ? pattern : new RegExp(String(pattern));
  const started = Date.now();
  let frame = null;
  while (Date.now() - started < TIMEOUT) {
    frame = await currentFrame(page).catch(() => null);
    const body = frame ? await frame.locator("body").innerText().catch(() => "") : "";
    if (matcher.test(body)) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`模块正文未就绪：${frame?.url() || "无 iframe"}`);
}

async function waitFrame(page, expected) {
  const started = Date.now();
  let frame;
  while (Date.now() - started < TIMEOUT) {
    frame = await currentFrame(page).catch(() => null);
    if (frame && expected.path.test(decodeURI(frame.url()))) {
      const body = await frame.locator("body").innerText().catch(() => "");
      const markers = [expected.marker, ...(expected.markerAlternates || [])].filter(Boolean);
      if (!markers.length || markers.some(marker => body.includes(marker))) return frame;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${expected.id} 未进入基线原生页面：${frame?.url() || "无 iframe"}`);
}

async function navigateModule(page, expected) {
  await page.locator(`.nav-item[data-route="#module/${expected.id}"]`).click();
  await page.waitForFunction(id => location.hash === `#module/${id}`, expected.id, { timeout: TIMEOUT });
  const frame = await waitFrame(page, expected);
  // Native modules hydrate asynchronously after the iframe is created.  A
  // stable module marker prevents the assertions below from observing the
  // transient "正在读取…" shell and also mirrors what a user sees.
  if (expected.marker) {
    await frame.getByText(expected.marker, { exact: true }).first().waitFor({ state: "visible", timeout: TIMEOUT });
  }
  return frame;
}

function runIdFrom(value) {
  return new URL(value).searchParams.get("scenarioRunId");
}

async function caseShellAndModules(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#home");
  const labels = (await page.locator(".primary-nav .nav-item span").allTextContents()).map(value => value.trim()).filter(Boolean);
  assert.deepEqual(labels, ["首页", "数据工程", "本体管理", "智能问数", "决策中心", "Agent 应用", "报告中心", "仪表盘"]);
  assert.equal(await page.locator(".global-nav .nav-context").count(), 0, "S003 左栏不应重复显示第二层场景标签");
  assert.match(await page.locator(".nav-foot strong").innerText(), /历史节点 15\/15/);

  const results = {};
  const moduleBodies = {};
  for (const expected of MODULES) {
    const frame = await navigateModule(page, expected);
    assert.equal(runIdFrom(frame.url()), FORMAL.scenarioRunId, `${expected.id} 运行身份不一致`);
    assert.doesNotMatch(decodeURI(frame.url()), /\/scenarios\/s003\/(?:index|runtime)/);
    const repeatedModuleHeading = frame.locator(".product-nav > .product-nav-head");
    if (await repeatedModuleHeading.count()) {
      assert.equal(await repeatedModuleHeading.first().evaluate(node => getComputedStyle(node).display), "none", `${expected.id} 二级菜单仍重复显示模块标题层`);
    }
    moduleBodies[expected.id] = await frame.locator("body").innerText();
    results[expected.id] = { url: frame.url(), bodyMarker: expected.marker };
  }

  const dataFrame = await navigateModule(page, MODULES[0]);
  await dataFrame.waitForFunction(() => {
    const text = document.querySelector(".source-resource-table")?.innerText || "";
    return text.includes("企业债务风险评估模版");
  }, null, { timeout: TIMEOUT });
  const directory = await dataFrame.locator(".source-resource-table").innerText();
  assert.match(directory, /企业债务风险评估模版/);
  assert.doesNotMatch(directory, /企业因子输入|调节因子配置|风险分档配置/);
  assert.equal(await dataFrame.locator(".source-resource-table tbody tr").count(), 1);

  const queryFrame = await navigateModule(page, MODULES[2]);
  await queryFrame.getByText("问数工作台", { exact: true }).first().waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await queryFrame.locator("body").innerText(), /债务风险问数助手|推荐问题/);

  let decisionFrame = await navigateModule(page, MODULES[3]);
  // M04 keeps the native baseline shell and hydrates its persisted decision
  // projection asynchronously.  Wait for the real workbench marker before
  // asserting its contents; a transient loading shell is not a failure.
  decisionFrame = await waitShellFrameBody(page, /待我决策|当前没有待我决策事项/);
  const decisionText = await decisionFrame.locator("body").innerText();
  assert.match(decisionText, /决策工作台|待我决策|已处理/);
  assert.match(decisionText, /决策工作台|待我决策|已处理/);

  const agentText = moduleBodies.agent || "";
  assert.match(agentText, /一期不新增评分或处置专属 Agent/);
  assert.match(agentText, /报告伴读与数据核验助手|债务风险报告伴读配置/);

  const reportFrame = await navigateModule(page, MODULES[5]);
  await reportFrame.waitForFunction(() => window.S003ReportModuleHealth?.()?.status !== "checking", null, { timeout: TIMEOUT });
  await reportFrame.waitForFunction(() => document.body?.innerText?.includes("正式报告") && document.body?.innerText?.match(/正式报告\s*21/), null, { timeout: TIMEOUT });
  const reportText = await reportFrame.locator("body").innerText();
  assert.match(reportText, /正式报告\s*21/);
  assert.doesNotMatch(reportText, /S003 场景工作台/);
  assert.equal(await reportFrame.locator(".product-nav-item").filter({ hasText: "S003 场景工作台" }).count(), 0);

  await page.screenshot({ path: path.join(RUN_DIR, "shell-and-modules.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { labels, modules: results, sourceCount: 1 };
}

async function caseM01Canvas(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#module/ontology");
  const frame = await waitFrame(page, MODULES[1]);
  await frame.locator("[data-s003-m01-modeling-summary]").waitFor({ state: "visible", timeout: TIMEOUT });
  // Open the native Published version first, then use its baseline tab.  The
  // S003 adapter adds the model-config tab but never replaces the native
  // version navigation.
  await frame.locator('[data-s003-m01-open-version="overview"]').click();
  await frame.waitForFunction(() => location.hash.includes("#published/version") && location.hash.includes("tab=overview"), null, { timeout: TIMEOUT });
  await frame.locator('[data-action="version-tab:canvas"]').click();
  await frame.waitForFunction(() => location.hash.includes("#published/version") && location.hash.includes("tab=canvas"), null, { timeout: TIMEOUT });
  await frame.locator('.published-canvas-panel[data-s003-m01-canvas-enhanced="true"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const nodes = frame.locator(".published-canvas-world > .canvas-node");
  const edges = frame.locator(".published-canvas-world > .edge-layer .edge");
  assert.equal(await nodes.count(), 34);
  assert.equal(await edges.count(), 18);
  const overlaps = await frame.locator(".published-canvas-world").evaluate(world => {
    const items = [...world.querySelectorAll(":scope > .canvas-node")].map(node => ({ id: node.dataset.node, left: parseFloat(node.style.left), top: parseFloat(node.style.top), right: parseFloat(node.style.left) + node.offsetWidth, bottom: parseFloat(node.style.top) + node.offsetHeight }));
    const pairs = [];
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]; const b = items[j];
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) pairs.push([a.id, b.id]);
    }
    return pairs;
  });
  assert.deepEqual(overlaps, []);

  const scroll = frame.locator(".published-canvas-scroll");
  const world = frame.locator(".published-canvas-world");
  const beforeScale = await world.getAttribute("style");
  await scroll.hover();
  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(120);
  const afterScale = await world.getAttribute("style");
  assert.notEqual(afterScale, beforeScale, "鼠标滚轮未改变画布比例");

  await scroll.evaluate(node => { node.scrollLeft = 0; node.scrollTop = 0; });
  const beforePan = await scroll.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
  const box = await scroll.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x - 70, box.y - 50, { steps: 5 });
  await page.mouse.up();
  const afterPan = await scroll.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
  assert.ok(afterPan.left > beforePan.left || afterPan.top > beforePan.top, "拖动画布空白区域未推动视口平移");
  await frame.locator("[data-s003-m01-canvas-reset-layout]").click();
  await page.waitForTimeout(100);

  await frame.locator('[data-action="published-canvas-view:lineage"]').click();
  const lineageNode = frame.locator(".published-lineage-data").first();
  await lineageNode.waitFor({ state: "visible", timeout: TIMEOUT });
  await lineageNode.click();
  await frame.getByText(/(?:Published|已发布)数据沿袭只读详情/, { exact: false }).waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await frame.locator("body").innerText(), /完整上游链路|数据工程|只读边界/);

  await page.screenshot({ path: path.join(RUN_DIR, "m01-published-canvas.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { nodeCount: 34, edgeCount: 18, overlaps, wheelZoomed: true, canvasPanned: true };
}

async function caseM02Native(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#module/data");
  let frame = await waitFrame(page, MODULES[0]);
  const rows = frame.locator(".source-resource-table tbody tr");
  assert.equal(await rows.count(), 1);
  assert.doesNotMatch(await frame.locator(".source-resource-table").innerText(), /企业因子输入|调节因子配置|风险分档配置/);
  await frame.locator('button[data-action="open-source-detail"][data-id="s003-workbook"]').click();
  await frame.waitForFunction(() => location.hash.includes("/resources/source/s003-workbook") && location.hash.includes("tab=overview"), null, { timeout: TIMEOUT });
  await frame.locator('[data-action="source-detail-tab"][data-value="content"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=content"), null, { timeout: TIMEOUT });
  let body = await frame.locator("body").innerText();
  for (const token of ["正式快照内容", "财务数据", "I", "AA", "当前快照", "内容已核验"]) assert.match(body, new RegExp(token));
  await frame.locator('[data-action="source-detail-tab"][data-value="overview"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=overview"), null, { timeout: TIMEOUT });
  await frame.getByText("S003 财务来源与合同", { exact: true }).waitFor({ state: "visible", timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  for (const token of ["当前数据截至", "CNY / 元", "按需上传工作簿"]) assert.match(body, new RegExp(token));
  await frame.locator('[data-action="source-detail-tab"][data-value="snapshots"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=snapshots"), null, { timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  assert.match(body, /快照历史/);
  assert.match(body, /下载数据表/);
  assert.match(body, /\.xlsx/);
  await frame.locator('[data-action="source-detail-tab"][data-value="settings"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=settings"), null, { timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  assert.match(body, /手工工作簿不设置来源同步计划/);
  assert.match(body, /(?:定时、触发和正式运行计划|管道运行计划)(?:只在|在)数据管道中(?:单独|独立)?维护/);
  assert.doesNotMatch(body, /定时扫描|Python 配置导入/);

  await frame.getByText("数据管道", { exact: true }).first().click();
  await frame.waitForFunction(() => location.hash.startsWith("#/pipelines") && location.hash.includes("tab=definitions"), null, { timeout: TIMEOUT });
  frame = await currentFrame(page);
  const canvasLink = frame.locator('a[href^="#/pipelines/"][href$="/canvas"]').first();
  await canvasLink.waitFor({ state: "visible", timeout: TIMEOUT });
  await canvasLink.click();
  frame = await currentFrame(page);
  await frame.locator("#canvas-stage").waitFor({ state: "visible", timeout: TIMEOUT });
  const viewport = frame.locator(".canvas-viewport");
  const world = frame.locator("#canvas-world");
  const beforeStyle = await world.getAttribute("style");
  await viewport.hover();
  await page.mouse.wheel(0, -360);
  await page.waitForTimeout(120);
  assert.notEqual(await world.getAttribute("style"), beforeStyle, "数据管道滚轮未缩放");
  const workbookNode = frame.locator('[data-node-id="node-source-workbook"]');
  const factorNode = frame.locator('[data-node-id="node-source-enterprise-factors"]');
  assert.equal(await workbookNode.count(), 1);
  assert.equal(await factorNode.count(), 1);
  const workbookTop = await workbookNode.evaluate(node => parseFloat(node.style.top));
  const factorTop = await factorNode.evaluate(node => parseFloat(node.style.top));
  assert.ok(Math.abs(factorTop - workbookTop) <= 360, "两个数据源节点间距过大");
  const pipelineText = await frame.locator("body").innerText();
  assert.match(pipelineText, /提交本体刷新|消费就绪/);
  assert.match(pipelineText, /企业因子输入/);
  assert.doesNotMatch(pipelineText, /调节因子配置.*数据源|风险分档配置.*数据源/);
  await frame.evaluate(() => { location.hash = "#/resources/asset/s003-debt-risk-asset?tab=consumption"; });
  await frame.waitForFunction(() => location.hash.includes("/resources/asset/s003-debt-risk-asset") && location.hash.includes("tab=consumption"), null, { timeout: TIMEOUT });
  const consumptionText = await frame.locator("body").innerText();
  assert.match(consumptionText, /消费就绪/);
  assert.match(consumptionText, /完整回执|正式采用证据/);
  assert.doesNotMatch(consumptionText, /刷新未就绪|7 项通过/);
  assertClean(diagnostics);
  await context.close();
  return { sourceCount: 1, pipelineInputCount: 2, detailTabs: ["content", "snapshots", "settings"], wheelZoomed: true, sourceNodeGap: Math.abs(factorTop - workbookTop), c003Closed: true };
}

async function caseM01PublishedAndConfig(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#module/ontology");
  const frame = await waitFrame(page, MODULES[1]);
  await frame.locator('[data-s003-m01-open-version="overview"]').click();
  await frame.waitForFunction(() => location.hash.includes("#published/version") && location.hash.includes("tab=overview"), null, { timeout: TIMEOUT });
  await frame.locator('[data-action="version-tab:s003-model-config"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=s003-model-config"), null, { timeout: TIMEOUT });
  await frame.locator('a[href*="s003-model-config"][href*="configTab=overview"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const configTabs = frame.locator(".s003-m01-config-tabs a");
  const tabLabels = (await configTabs.allTextContents()).map(item => item.trim()).filter(Boolean);
  for (const label of ["配置总览", "企业因子配置", "调节因子配置", "评分权重", "风险分档配置", "行动触发", "固定业务语义", "发布与版本"]) assert.ok(tabLabels.includes(label), label);
  await frame.locator('.s003-m01-config-tabs a[href*="configTab=factors"]').click();
  await frame.waitForFunction(() => location.hash.includes("configTab=factors"), null, { timeout: TIMEOUT });
  await frame.waitForFunction(() => document.body?.innerText?.includes("调节因子系数"), null, { timeout: TIMEOUT });
  let body = await frame.locator("body").innerText();
  assert.match(body, /调节因子系数/);
  await frame.locator('.s003-m01-config-tabs a[href*="configTab=tiers"]').click();
  await frame.waitForFunction(() => location.hash.includes("configTab=tiers"), null, { timeout: TIMEOUT });
  await frame.waitForFunction(() => /风险分档|绿灯|黄灯|红灯|黑灯/.test(document.body?.innerText || ""), null, { timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  assert.match(body, /风险分档|绿灯|黄灯|红灯|黑灯/);
  await frame.locator('.s003-m01-config-tabs a[href*="configTab=actions"]').click();
  await frame.waitForFunction(() => location.hash.includes("configTab=actions"), null, { timeout: TIMEOUT });
  await frame.waitForFunction(() => document.body?.innerText?.includes("行动类型") && document.body?.innerText?.includes("风险分档跟踪"), null, { timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  for (const label of ["风险分档跟踪", "专项风险处置", "重大风险应急响应", "重大因子应急处置"]) assert.match(body, new RegExp(label));
  await frame.locator('.s003-m01-config-tabs a[href*="configTab=factor-input"]').click();
  await frame.waitForFunction(() => location.hash.includes("configTab=factor-input"), null, { timeout: TIMEOUT });
  await frame.waitForFunction(() => /企业因子输入校验|一期无复核人/.test(document.body?.innerText || ""), null, { timeout: TIMEOUT });
  body = await frame.locator("body").innerText();
  assert.match(body, /企业因子输入校验|一期无复核人/);
  assert.match(body, /NOT_APPLICABLE|不适用/);
  assert.match(body, /缺失（0 档）|缺失套零/);

  await frame.locator('[data-action="version-tab:canvas"]').click();
  await frame.waitForFunction(() => location.hash.includes("tab=canvas"), null, { timeout: TIMEOUT });
  await frame.locator('.published-canvas-panel[data-s003-m01-canvas-enhanced="true"]').waitFor({ state: "visible", timeout: TIMEOUT });
  await frame.locator('[data-action="published-canvas-view:lineage"]').click();
  const lineageNode = frame.locator(".published-lineage-data").first();
  await lineageNode.waitFor({ state: "visible", timeout: TIMEOUT });
  await lineageNode.click();
  await frame.getByText(/(?:Published|已发布)数据沿袭只读详情/, { exact: false }).waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await frame.locator("body").innerText(), /数据工程|完整上游链路|只读边界/);
  assertClean(diagnostics);
  await context.close();
  return { configTabs: tabLabels, publishedCanvas: true, lineageDetail: true };
}

async function caseM03M04M05(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#home");
  const queryFrame = await navigateModule(page, MODULES[2]);
  await queryFrame.locator(".recommendation-card").first().waitFor({ state: "visible", timeout: TIMEOUT });
  const recommendationCards = queryFrame.locator(".recommendation-card");
  const recommendedQuestions = await recommendationCards.count();
  assert.equal(recommendedQuestions >= 6, true);
  const queryLandingBody = await queryFrame.locator("body").innerText();
  assert.match(queryLandingBody, /当前问数助手：债务风险问数助手/);
  assert.doesNotMatch(queryLandingBody, /平台通用问数配置 · S003 只读|融资问数 Agent/);
  await recommendationCards.first().click();
  await queryFrame.locator(".answer-card").waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await queryFrame.locator("body").innerText(), /原问题|查询结果|固定事实|风险/);
  const queryBody = await queryFrame.locator("body").innerText();
  assert.match(queryBody, /债务风险问数助手/);
  assert.doesNotMatch(queryBody, /平台通用问数配置 · S003 只读|融资问数 Agent/);

  await queryFrame.locator(".product-nav-item").filter({ hasText: "历史会话" }).click();
  await queryFrame.locator('[data-screen-label="历史会话"]').waitFor({ state: "visible", timeout: TIMEOUT });
  assert.equal(await queryFrame.locator(".history-list > button").count() >= 3, true);
  assert.doesNotMatch(await queryFrame.locator("body").innerText(), /融资成本|金融机构归因/);

  await queryFrame.locator(".product-nav-item").filter({ hasText: "问数视图" }).click();
  await queryFrame.getByRole("heading", { name: "问数视图", exact: true }).waitFor({ state: "visible", timeout: TIMEOUT });
  await queryFrame.locator("article.saved-view").first().waitFor({ state: "visible", timeout: TIMEOUT });
  const viewBody = await queryFrame.locator("body").innerText();
  assert.match(viewBody, /Published 问题示例/);
  assert.equal(await queryFrame.locator("article.saved-view").count(), 6);

  await queryFrame.locator(".product-nav-item").filter({ hasText: "语义资源" }).click();
  await queryFrame.locator('[data-screen-label="语义资源"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const semanticBody = await queryFrame.locator("body").innerText();
  assert.match(semanticBody, /正式消费链/);
  assert.match(semanticBody, /债务风险评估 Published 模型包/);
  assert.doesNotMatch(semanticBody, /不允许机构反查融资明细|主体可反向取得明细/);

  await queryFrame.locator(".product-nav-item").filter({ hasText: "Agent 配置" }).click();
  await queryFrame.locator('[data-screen-label="Agent 配置"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const agentConfigBody = await queryFrame.locator("body").innerText();
  assert.match(agentConfigBody, /债务风险问数助手/);
  assert.match(agentConfigBody, /能力与工具/);
  const capabilityDetailButton = queryFrame.locator(".capability-panel .text-button").first();
  await capabilityDetailButton.click();
  await queryFrame.locator(".ui-drawer").waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await queryFrame.locator(".ui-drawer").innerText(), /允许范围|运行边界|当前场景/);

  let decisionFrame = await navigateModule(page, MODULES[3]);
  decisionFrame = await waitShellFrameBody(page, /待我决策|当前没有待我决策事项/);
  const decisionBody = await decisionFrame.locator("body").innerText();
  assert.match(decisionBody, /决策工作台/);
  assert.match(decisionBody, /行动申请|待我决策|当前没有待我决策事项/);
  assert.match(decisionBody, /行动申请|待人工确认|待我决策|人工判断/);
  assert.doesNotMatch(decisionBody, /S003 专属处置|风险处置候选面板/);
  assert.doesNotMatch(decisionBody, /银行|贷款|金融机构/, "S003 决策工作台泄漏了 S001 融资业务语义");

  const agentFrame = await navigateModule(page, { ...MODULES[4], marker: "" });
  await waitShellFrameBody(page, /Agent 目录/);
  await waitShellFrameBody(page, /债务风险报告伴读配置已装入|报告伴读与数据核验助手/);
  const agentBody = await agentFrame.locator("body").innerText();
  assert.match(agentBody, /债务风险报告伴读配置已装入|报告伴读与数据核验助手/);
  assert.match(agentBody, /证据与结果|报告证据/);
  assert.match(agentBody, /一期不新增评分或处置专属 Agent/);
  assert.equal(await agentFrame.locator(".agent-grid .agent-card").count(), 3);
  assert.match(agentBody, /Release 1\.2|当前 Release\s*1\.2/);
  await agentFrame.locator('.product-nav-item[title="证据与结果"]').click();
  await agentFrame.locator('[data-screen-label="证据与结果"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const evidenceBody = await agentFrame.locator("body").innerText();
  assert.match(evidenceBody, /S003 正式报告上下文来源|正式企业报告/);
  assert.match(evidenceBody, /等待报告中心 C024/);
  assert.match(evidenceBody, /13\/13 通过/);
  assert.doesNotMatch(evidenceBody, /集团融资证据包|融资候选证据包/);
  assert.equal(await agentFrame.locator(".resource-directory-row").count() >= 2, true);
  assertClean(diagnostics);
  await context.close();
  return { recommendedQuestions, queryAnswered: true, decisionGeneric: true, reportAgent: true };
}

async function caseDashboardAndReport(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#dashboard");
  let frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const dashboardText = await frame.locator("body").innerText();
  for (const token of ["企业风险评分明细", "风险集中分布与集团共性薄弱项", "按产业定位风险集中区域", "集团共性薄弱指标", "债务风险触发与行动", "风险分档分布与判定口径", "风电测试公司01", "环保测试公司4"]) assert.match(dashboardText, new RegExp(token));
  const enterprisePanel = frame.locator(".panel").filter({ hasText: "企业风险评分明细" }).last();
  assert.equal(await enterprisePanel.locator('button[data-action="s003-open-formal-report"]').count(), 21);
  assert.match(dashboardText, /风险分档跟踪/);
  assert.match(dashboardText, /重大因子应急/);
  assert.match(dashboardText, /专项风险处置/);
  assert.match(dashboardText, /重大风险应急响应/);
  assert.match(dashboardText, /重点关注企业指黄灯、红灯和黑灯企业/);
  assert.match(dashboardText, /企业数表示有多少家企业把该指标列为最低三项/);
  assert.match(dashboardText, /最低指标[\s\S]*?总资产收益率（\d+\.\d{2} 分）/);

  assert.equal(await frame.locator('button[data-action="s003-set-tab"][data-tab="configuration"]').count(), 0);
  assert.equal(await frame.locator('button[data-action="s003-navigate-module"][data-module="ontology"]').count() >= 1, true);
  await enterprisePanel.locator('button[data-action="s003-open-formal-report"][data-enterprise-id="S003-ENT-020"]').click();
  await page.waitForFunction(() => location.hash === "#module/report", null, { timeout: TIMEOUT });
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT) {
    const candidate = await currentFrame(page).catch(() => null);
    if (candidate && /#\/reports\/view\?/.test(candidate.url())) {
      frame = candidate;
      break;
    }
    await page.waitForTimeout(100);
  }
  assert.match(frame.url(), /#\/reports\/view\?/);
  await frame.waitForFunction(() => document.body?.innerText?.includes("执行摘要与总体结论") && /报告助手|报告伴读/.test(document.body?.innerText || ""), null, { timeout: TIMEOUT });
  const reportText = await frame.locator("body").innerText();
  for (const token of ["执行摘要与总体结论", "关键风险诊断说明", "财务指标评分明细", "调节因子明细", "风险应对策略与改善建议", "未来三个月行动建议", "债务风险触发与行动状态", "规则、默认语义与评分口径", "版本、产物与证据", "报告伴读", "自动核验", "内容版本 1.4.0"]) {
    if (token === "规则、默认语义与评分口径") assert.match(reportText, /规则、默认语义与评分口径|规则与特殊语义|规则与语义/);
    else if (token === "版本、产物与证据") assert.match(reportText, /版本、产物与证据|版本与证据/);
    else if (token === "报告伴读") assert.match(reportText, /报告助手|报告伴读/);
    else assert.match(reportText, new RegExp(token));
  }
  assert.doesNotMatch(reportText, /实际值为\s*未取得/, "正式报告诊断与指标明细不一致");
  assert.doesNotMatch(reportText, /\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/, "正式报告暴露内部状态枚举");
  assert.match(reportText, /交叉违约/);
  const viewport = frame.locator("#report-viewport");
  const beforeScroll = await viewport.evaluate(node => node.scrollTop);
  await frame.locator('button[data-action="s003-jump-report-section"][data-section="s003-report-three-months"]').click();
  await page.waitForTimeout(160);
  const afterScroll = await viewport.evaluate(node => node.scrollTop);
  assert.notEqual(afterScroll, beforeScroll, "报告目录未推动正文滚动");
  await frame.getByRole("button", { name: "自动核验", exact: true }).click();
  await frame.waitForFunction(() => /13\s*\/\s*13\s*通过/.test(document.querySelector(".assistant-pane")?.innerText || ""), null, { timeout: TIMEOUT });
  const verificationText = await frame.locator(".assistant-pane").innerText();
  assert.match(verificationText, /13\s*\/\s*13/);
  assert.match(verificationText, /13\s*\/\s*13\s*通过|确定性检查通过/);
  assert.match(verificationText, /正文与下载产物未暴露内部状态枚举/);
  assert.match(verificationText, /行动状态与决策中心同轮记录一致|预期 C011\/C019 记录实际存在且与同轮候选精确一致/);
  const downloadPath = path.join(RUN_DIR, "formal-report-v6.html");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: TIMEOUT }),
    frame.locator('button[data-action="s003-download-report-html"]').click()
  ]);
  await download.saveAs(downloadPath);
  const downloadedHtml = fs.readFileSync(downloadPath, "utf8");
  for (const token of ["关键风险诊断说明", "风险应对策略与改善建议", "未来三个月行动建议", "风险触发与行动状态", "核验、版本、产物与证据"]) assert.match(downloadedHtml, new RegExp(token));
  assert.doesNotMatch(downloadedHtml, /实际值为\s*未取得/, "下载报告固化了错误的指标实际值");
  assert.doesNotMatch(downloadedHtml, /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/, "下载报告包含内部枚举或对象字符串");

  await page.screenshot({ path: path.join(RUN_DIR, "dashboard-enterprise-report.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { enterpriseRows: 21, actionTypes: 4, reportSections: 9, verificationChecks: 13, directoryScrolled: true, downloadedFormalHtml: path.basename(downloadPath) };
}

async function caseDashboardActionAndConfig(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#dashboard");
  let frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const modelConfigButton = frame.locator('button[data-action="s003-navigate-module"][data-module="ontology"]:visible').first();
  await modelConfigButton.click();
  await page.waitForFunction(() => location.hash === "#module/ontology", null, { timeout: TIMEOUT });
  frame = await waitFrame(page, { ...MODULES[1], marker: "已发布本体", markerAlternates: ["本体建模"] });
  await frame.waitForFunction(() => /模型配置|债务风险模型配置|模型配置总览/.test(document.body?.innerText || ""), null, { timeout: TIMEOUT });
  assert.match(frame.url(), /s003-model-config/);
  assert.match(await frame.locator("body").innerText(), /债务风险模型配置|模型配置总览/);
  await page.locator('.nav-item[data-route="#dashboard"]').click();
  await page.waitForFunction(() => location.hash === "#dashboard", null, { timeout: TIMEOUT });
  frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const submit = frame.locator('button[data-action="s003-submit-action-request"]').first();
  assert.equal(await submit.count(), 1);
  const candidateId = await submit.getAttribute("data-candidate-id");
  assert.ok(candidateId, "驾驶舱候选缺少稳定 candidateId");
  const requestId = `AR-${candidateId}`;
  await submit.click();
  assert.equal(page.url().includes("#dashboard"), true, "提交行动申请后应保留驾驶舱位置");
  const openRequest = frame.locator(`button[data-action="s003-open-action-request"][data-request-id="${requestId}"]`);
  await openRequest.waitFor({ state: "visible", timeout: TIMEOUT });
  await openRequest.click();
  await page.waitForFunction(() => location.hash === "#module/decision", null, { timeout: TIMEOUT });
  const decision = await waitFrame(page, MODULES[3]);
  await decision.waitForFunction((id) => document.body?.innerText?.includes(id), requestId, { timeout: TIMEOUT });

  const decisionStateFor = async () => decision.evaluate((id) => {
    const params = new URLSearchParams(location.search);
    const context = {
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"),
      status: params.get("scenarioStatus") || "active"
    };
    const state = window.S003DecisionAdapter?.readRecord?.(context, "state", window.localStorage) || null;
    const request = state?.requests?.find((item) => item.id === id) || null;
    const task = request?.taskId ? state?.tasks?.find((item) => item.id === request.taskId) || null : null;
    return { context, state, request, task };
  }, requestId);

  let decisionProjection = await decisionStateFor();
  assert.equal(decisionProjection.request?.scenarioContext?.scenarioRunId, FORMAL.scenarioRunId);
  assert.equal(decisionProjection.request?.evidence?.dataVersion, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  const requestReceipt = decisionProjection.request?.c017SafetyReads?.find((item) => item.gate === "request_receipt") || null;
  if (requestReceipt?.outcome !== "allowed") {
    const retry = decision.getByRole("button", { name: "重新读取安全状态", exact: true }).first();
    await retry.waitFor({ state: "visible", timeout: TIMEOUT });
    await retry.click();
  }
  await decision.waitForFunction((id) => {
    const params = new URLSearchParams(location.search);
    const context = { scenarioId: params.get("scenarioId"), scenarioVersion: params.get("scenarioVersion"), scenarioRunId: params.get("scenarioRunId"), formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"), status: params.get("scenarioStatus") || "active" };
    const state = window.S003DecisionAdapter?.readRecord?.(context, "state", window.localStorage);
    const request = state?.requests?.find((item) => item.id === id);
    return request?.c017SafetyReads?.some((item) => item.gate === "request_receipt" && item.outcome === "allowed");
  }, requestId, { timeout: TIMEOUT });

  let confirm = decision.getByRole("button", { name: "确认并交办", exact: true }).last();
  if (await confirm.count() === 0 || !await confirm.isVisible().catch(() => false)) {
    await decision.getByRole("button", { name: "查看决策事项", exact: true }).click();
    confirm = decision.getByRole("button", { name: "确认并交办", exact: true }).last();
  }
  await confirm.waitFor({ state: "visible", timeout: TIMEOUT });
  await confirm.click();
  const modal = decision.locator(".dc-modal");
  await modal.waitFor({ state: "visible", timeout: TIMEOUT });
  await modal.locator("textarea").first().fill("依据当前正式企业报告、风险分档与调节因子证据，确认进入负责人待办持续跟踪。");
  await modal.getByRole("button", { name: "核对提交内容", exact: true }).click();
  await modal.getByRole("button", { name: "确认并交办", exact: true }).click();
  await decision.waitForFunction((id) => {
    const params = new URLSearchParams(location.search);
    const context = { scenarioId: params.get("scenarioId"), scenarioVersion: params.get("scenarioVersion"), scenarioRunId: params.get("scenarioRunId"), formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"), status: params.get("scenarioStatus") || "active" };
    const state = window.S003DecisionAdapter?.readRecord?.(context, "state", window.localStorage);
    const request = state?.requests?.find((item) => item.id === id);
    const reads = request?.c017SafetyReads || [];
    return Boolean(request?.taskId
      && state?.tasks?.some((item) => item.id === request.taskId)
      && ["request_receipt", "confirmation_submit", "task_formation"].every((gate) => reads.some((item) => item.gate === gate && item.outcome === "allowed")));
  }, requestId, { timeout: TIMEOUT });
  decisionProjection = await decisionStateFor();
  const reads = decisionProjection.request.c017SafetyReads;
  for (const gate of ["request_receipt", "confirmation_submit", "task_formation"]) {
    const read = [...reads].reverse().find((item) => item.gate === gate);
    assert.ok(read, `${gate} 未形成 C017 回执`);
    assert.equal(read.outcome, "allowed");
    assert.equal(read.t007, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
    assert.notEqual(read.summaryId, "未定位");
    assert.notEqual(read.summaryVersion, "未定位");
    assert.notEqual(read.summaryFormedAt, "未定位");
  }
  assert.equal(decisionProjection.task?.scenarioContext?.scenarioRunId, FORMAL.scenarioRunId);
  assert.equal(decisionProjection.request.taskId, decisionProjection.task.id);
  assert.equal(decisionProjection.state.scenarioBootstrap.notificationsDispatched, 0);
  assert.equal(decisionProjection.state.scenarioBootstrap.approvalsStarted, 0);
  await decision.getByRole("button", { name: "查看企业风险报告", exact: true }).first().click();
  await page.waitForFunction(() => location.hash === "#module/report", null, { timeout: TIMEOUT });
  const report = await waitFrame(page, MODULES[5]);
  await report.waitForFunction((name) => document.body?.innerText?.includes(name) && document.body?.innerText?.includes("执行摘要与总体结论"), decisionProjection.request.subjectName, { timeout: TIMEOUT });
  assert.equal(runIdFrom(report.url()), FORMAL.scenarioRunId);
  assertClean(diagnostics);
  await context.close();
  return {
    modelConfigRoute: true,
    actionSubmittedToDecisionCenter: true,
    requestId,
    taskId: decisionProjection.task.id,
    c017Gates: ["request_receipt", "confirmation_submit", "task_formation"],
    reportDrillThrough: true,
    notificationsDispatched: 0,
    approvalsStarted: 0
  };
}

async function caseOldProjectionCompatibility(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#home");
  const runId = await page.evaluate(() => window.S003Store.getRuntimeSnapshot().context.scenarioRunId);
  // A clean browser correctly has no Draft projection. Form one through the
  // public API first, then corrupt only that disposable work projection so the
  // compatibility path is exercised without touching Published history.
  await page.evaluate(() => {
    const state = window.S003Store.getRuntimeSnapshot();
    const current = state.factorInputs?.["S003-ENT-001"]?.["融资能力（已用授信余额/授信总额）"] || "良好";
    window.S003Store.updateFactorInput("S003-ENT-001", "融资能力（已用授信余额/授信总额）", current);
  });
  await page.evaluate((currentRunId) => {
    const entries = Object.entries(localStorage);
    const target = entries.find(([key]) => key.includes(`:${currentRunId}:m02:factor-inputs%2Fcurrent`));
    if (!target) throw new Error("未找到 M02 当前工作投影");
    const [key, raw] = target;
    const envelope = JSON.parse(raw);
    envelope.payload.projectionSchemaVersion = "ofw.s003.browser-projection.v999";
    if (envelope.payload.values?.["S003-ENT-001"]) envelope.payload.values["S003-ENT-001"]["融资能力"] = "未知旧值";
    localStorage.setItem(key, JSON.stringify(envelope));
  }, runId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: TIMEOUT });
  const snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.projectionHealth.M02.status, "isolated-rebuilt");
  assert.equal(snapshot.runtimeHealth.formalPublishedReadReady, true);
  assert.ok(snapshot.projectionRecoveryReceipts.some(item => /v999/.test(item.originalRaw || "")));
  assert.equal(await page.evaluate(() => window.S003Store.getPublishedResourceSnapshot().ready), true);
  await page.locator('.nav-item[data-route="#module/ontology"]').click();
  const ontology = await waitFrame(page, MODULES[1]);
  const ontologyBody = await ontology.locator("body").innerText();
  assert.match(ontologyBody, /本体建模|已发布|S003 数据资产接收投影/);
  assert.doesNotMatch(ontologyBody, /S003 M01 场景资源未装载/);
  assertClean(diagnostics);
  await context.close();
  return { oldProjectionSchema: "v999", status: snapshot.projectionHealth.M02.status, publishedReadReady: true };
}

async function caseQuickRerunAndHistory(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#dashboard");
  let frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const oldSnapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  const oldRunId = oldSnapshot.context.scenarioRunId;
  const oldDecisionIds = (oldSnapshot.decisions || []).map(item => item.actionRequestId || item.id).filter(Boolean).sort();
  const oldFrameUrl = frame.url();
  await frame.locator('button[data-action="s003-request-rerun"]:visible').first().click();
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').waitFor({ state: "visible", timeout: TIMEOUT });
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').click();
  await page.waitForFunction(previous => window.S003Store?.getRuntimeSnapshot?.()?.context?.scenarioRunId !== previous, oldRunId, { timeout: TIMEOUT });
  const nextRunId = await page.evaluate(() => window.S003Store.getRuntimeSnapshot().context.scenarioRunId);
  await page.waitForFunction(runId => new URL(location.href).searchParams.get("scenarioRunId") === runId, nextRunId, { timeout: TIMEOUT });
  await page.waitForFunction(runId => {
    const item = document.querySelector("#module-frame");
    return item && new URL(item.src).searchParams.get("scenarioRunId") === runId && item.dataset.dashboardRunId === runId;
  }, nextRunId, { timeout: TIMEOUT });
  frame = await currentFrame(page);
  await frame.waitForFunction(runId => location.href.includes(runId) && document.body?.innerText?.includes("当前工作投影"), nextRunId, { timeout: TIMEOUT });
  const runSelect = frame.locator('select[data-change="s003-run-selection"]');
  const options = await runSelect.locator("option").allTextContents();
  assert.equal(options.length, 2);
  assert.match(options[0], /工作投影/);
  assert.match(options[1], /正式运行/);

  let snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.context.scenarioRunId, nextRunId);
  assert.equal(snapshot.activeRun.runId, nextRunId);
  assert.equal(snapshot.activeRun.projectionOnly, true);
  assert.equal(snapshot.lastSuccessfulRun.runId, oldRunId);
  assert.deepEqual(snapshot.decisions, []);

  await runSelect.selectOption(oldRunId);
  await frame.waitForFunction(runId => document.body?.innerText?.includes("历史快照 · 只读") && document.body?.innerText?.includes(runId), oldRunId, { timeout: TIMEOUT });
  assert.equal(await frame.locator('button[data-action="s003-submit-action-request"]').count(), 0, "历史运行不应渲染可提交按钮");
  const historicalCandidateRows = await frame.locator(".s003-overview-actions tbody tr").count();
  const historicalReadonlyButtons = await frame.getByRole("button", { name: "历史只读", exact: true }).count();
  const historicalActionLinks = await frame.locator('button[data-action="s003-open-action-request"]').count();
  assert.equal(historicalCandidateRows, 9, "历史运行应保留全部正式行动候选");
  assert.equal(historicalReadonlyButtons + historicalActionLinks, historicalCandidateRows, "历史候选必须仅提供只读状态或既有行动申请查看入口");
  snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.context.scenarioRunId, nextRunId, "切换历史运行覆盖了当前运行身份");
  assert.equal(snapshot.activeRun.runId, nextRunId);
  assert.deepEqual(snapshot.decisions, []);
  await runSelect.selectOption(nextRunId);
  await frame.waitForFunction(() => document.body?.innerText?.includes("当前工作投影"), null, { timeout: TIMEOUT });

  const projectionFinal = await page.evaluate(() => {
    const snapshot = window.S003Store.getRuntimeSnapshot();
    const iframe = document.querySelector("#module-frame");
    return { shellUrl: location.href, frameUrl: iframe?.src, frameRunId: iframe?.dataset.dashboardRunId, context: snapshot.context, activeRunId: snapshot.activeRun?.runId, lastSuccessfulRunId: snapshot.lastSuccessfulRun?.runId, decisionCount: snapshot.decisions?.length || 0 };
  });
  assert.equal(runIdFrom(projectionFinal.shellUrl), nextRunId);
  assert.equal(runIdFrom(projectionFinal.frameUrl), nextRunId);
  assert.equal(projectionFinal.frameRunId, nextRunId);
  assert.equal(projectionFinal.decisionCount, 0);
  assert.notEqual(oldFrameUrl, projectionFinal.frameUrl);
  await page.screenshot({ path: path.join(RUN_DIR, "quick-rerun-current-projection.png"), fullPage: false });

  await page.locator('.nav-item[data-route="#home"]').click();
  await page.waitForFunction(() => location.hash === "#home", null, { timeout: TIMEOUT });
  const returnButton = page.locator('[data-action="return-formal-run"]');
  await returnButton.waitFor({ state: "visible", timeout: TIMEOUT });
  await returnButton.click();
  await page.waitForFunction(runId => window.S003Store?.getRuntimeSnapshot?.()?.context?.scenarioRunId === runId, oldRunId, { timeout: TIMEOUT });
  await page.waitForFunction(runId => new URL(location.href).searchParams.get("scenarioRunId") === runId && location.hash === "#dashboard", oldRunId, { timeout: TIMEOUT });
  const returnedFormal = await page.evaluate(() => {
    const snapshot = window.S003Store.getRuntimeSnapshot();
    return {
      context: snapshot.context,
      activeRunId: snapshot.activeRun?.runId,
      lastSuccessfulRunId: snapshot.lastSuccessfulRun?.runId,
      runStatus: snapshot.runStatus,
      decisionIds: (snapshot.decisions || []).map(item => item.actionRequestId || item.id).filter(Boolean).sort()
    };
  });
  assert.equal(returnedFormal.context.scenarioRunId, oldRunId);
  assert.equal(returnedFormal.activeRunId, oldRunId);
  assert.equal(returnedFormal.lastSuccessfulRunId, oldRunId);
  assert.equal(returnedFormal.runStatus, "succeeded");
  assert.deepEqual(returnedFormal.decisionIds, oldDecisionIds);
  assertClean(diagnostics);
  await context.close();
  return { oldRunId, nextRunId, options, projectionFinal, returnedFormal, historicalSideEffectsReplayed: false, historicalSubmitButtons: 0, historicalReadonlyButtons, historicalActionLinks };
}

async function caseS001Isolation(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S001", "#home");
  const body = await page.locator("body").innerText();
  assert.match(body, /S001 · 融资成本洞察与行动闭环/);
  const checked = [];
  for (const expected of MODULES) {
    const frame = await navigateModule(page, { ...expected, marker: "" });
    const url = new URL(frame.url());
    assert.equal(url.searchParams.get("scenarioId"), "S001");
    const state = await frame.evaluate(() => ({
      htmlScenario: document.documentElement.dataset.ofwScenario || null,
      m01: window.ONTOLOGY_SCENARIO_EXTENSION?.scenarioId === "S003",
      m02: window.DE_SCENARIO_EXTENSION?.scenarioId === "S003" || window.DE_SCENARIO_EXTENSION?.isActive === true,
      m03: window.S003IQNativeBridge?.isActive === true,
      m04: Boolean(window.S003DecisionAdapter?.isActive?.({ scenarioId: "S001" })),
      m05: window.S003AgentAdapter?.isActive === true,
      m06: [...document.querySelectorAll(".product-nav-item")].some(item => item.textContent.includes("S003 场景工作台"))
    }));
    assert.equal(state.htmlScenario === "S003", false);
    assert.deepEqual([state.m01, state.m02, state.m03, state.m04, state.m05, state.m06], [false, false, false, false, false, false]);
    if (expected.id === "agent") {
      await frame.locator(".agent-grid .agent-card").first().waitFor({ state: "visible", timeout: TIMEOUT });
      assert.equal(await frame.locator(".agent-grid .agent-card").count(), 3);
      const baselineAgentBody = await frame.locator("body").innerText();
      assert.match(baselineAgentBody, /融资洞察与行动协作 Agent/);
      assert.match(baselineAgentBody, /融资经营分析报告生成 Agent/);
      await frame.locator('.product-nav-item[title="证据与结果"]').click();
      await frame.locator('[data-screen-label="证据与结果"]').waitFor({ state: "visible", timeout: TIMEOUT });
      assert.equal(await frame.locator(".resource-directory-row").count() >= 2, true);
      assert.match(await frame.locator("body").innerText(), /集团融资证据包/);
    }
    checked.push({ module: expected.id, url: frame.url() });
  }
  assertClean(diagnostics);
  await context.close();
  return { checked };
}

async function runCase(browser, id, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn(browser);
    process.stdout.write(`PASS ${id}\n`);
    return { id, status: "passed", durationMs: Date.now() - startedAt, details };
  } catch (error) {
    process.stdout.write(`FAIL ${id} ${error.message}\n`);
    return { id, status: "failed", durationMs: Date.now() - startedAt, error: { name: error.name, message: error.message, stack: error.stack } };
  }
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { chromium } = require(path.join(PLAYWRIGHT_ROOT, "playwright"));
  const browser = await chromium.launch({ headless: process.env.S003_BROWSER_HEADED !== "1" });
  const cases = [];
  const selectedCases = new Set(String(process.env.S003_CP18_CASES || process.env.S003_CP16_CASES || "").split(",").map(value => value.trim()).filter(Boolean));
  for (const [id, fn] of [
    ["shell-and-modules", caseShellAndModules],
    ["m02-native", caseM02Native],
    ["m01-canvas", caseM01Canvas],
    ["m01-published-config", caseM01PublishedAndConfig],
    ["m03-m04-m05", caseM03M04M05],
    ["dashboard-and-report", caseDashboardAndReport],
    ["dashboard-action-and-config", caseDashboardActionAndConfig],
    ["old-projection-compatibility", caseOldProjectionCompatibility],
    ["quick-rerun-and-history", caseQuickRerunAndHistory],
    ["s001-isolation", caseS001Isolation]
  ]) {
    if (selectedCases.size && !selectedCases.has(id)) continue;
    cases.push(await runCase(browser, id, fn));
  }
  const browserVersion = browser.version();
  await browser.close();
  const result = {
    schemaVersion: "ofw.s003.browser-cp18-result.v1",
    runId: RUN_ID,
    formedAt: FORMED_AT,
    origin: ORIGIN,
    formalSourceScenarioRunId: FORMAL.scenarioRunId,
    browserVersion,
    cases,
    totals: { cases: cases.length, passed: cases.filter(item => item.status === "passed").length, failed: cases.filter(item => item.status === "failed").length },
    checkpointCreated: false,
    acceptanceReady: false
  };
  const output = path.join(RUN_DIR, "browser-cp18-results.json");
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`RESULT ${output}\n`);
  if (result.totals.failed) process.exitCode = 1;
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
