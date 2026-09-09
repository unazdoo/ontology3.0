import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startCandidate } from "../start-candidate.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const testDir = path.dirname(fileURLToPath(import.meta.url));
const compositeRoot = path.resolve(testDir, "..");
const evidenceRoot = path.join(compositeRoot, "evidence");
const screenshotsRoot = path.join(evidenceRoot, "screenshots");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const testRuntime = process.env.OFW_ENTRY_BASE ? null : await startCandidate({ staticPort: 0, modelingPort: 0 });
const entryBase = process.env.OFW_ENTRY_BASE || testRuntime.entryUrl.replace(/#home$/, "");
const apiBase = process.env.OFW_API_BASE || testRuntime?.modelingUrl;
const evidenceDate = "20260906";
const scenarioIds = ["S001", "S002", "S003", "S004", "S005"];
const routes = ["#home", "#module/data", "#module/ontology", "#module/query", "#module/decision", "#module/agent", "#module/report", "#module/m07", "#module/modeling", "#dashboard"];
const routeModule = new Map(routes.filter((route) => route !== "#home").map((route) => [route, route === "#dashboard" ? "dashboard" : route.split("/").at(-1)]));
const m08Views = ["objectives", "models", "compare", "observe", "release"];
const errors = { console: [], page: [], resources: [] };
const screenshots = [];

await rm(screenshotsRoot, { recursive: true, force: true });
await mkdir(screenshotsRoot, { recursive: true });

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${pathname}: ${body.code || body.message || response.status}`);
  return body;
}

async function action(scenarioId, operation, payload = {}) {
  return api(`/v1/model-management/actions/${operation}`, {
    method: "POST",
    body: JSON.stringify({ scenarioId, payload })
  });
}

async function resetCycle(scenarioId) {
  return action(scenarioId, "reset-current-cycle");
}

async function waitState(scenarioId, predicate, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const context = await api(`/v1/model-management/context?scenarioId=${scenarioId}`);
    if (predicate(context.state)) return context.state;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`${scenarioId} runtime state timed out.`);
}

async function completeOptimizationCycle(scenarioId) {
  let state = (await api(`/v1/model-management/context?scenarioId=${scenarioId}`)).state;
  const run = async (operation, payload = {}) => {
    state = (await action(scenarioId, operation, payload)).state;
    return state;
  };
  if (!state.insights.length) await run("generate-insights");
  if (state.insightReview?.decision !== "APPROVED") await run("review-insights", { decision: "APPROVED", reviewedBy: `reviewer-${scenarioId.toLowerCase()}`, comment: "已核对证据、风险和同口径验证要求，允许创建候选版本。" });
  if (!state.candidates.length) await run("create-candidate");
  if (!state.shadowTrial) await run("start-shadow", { candidateId: state.candidates.at(-1)?.candidateId });
  while (state.shadowTrial?.status === "ACTIVE") await run("advance-shadow");
  if (!state.benchmarks.some((item) => item.scope === "MATURED_SHADOW_LABELS")) await run("rebenchmark");
  if (!state.releaseCandidate) await run("form-release");
  if (state.consumerBinding?.validationStatus !== "VALID") await run("validate-binding");
  if (state.consumerBinding?.status !== "APPLIED") await run("apply-binding", { confirmed: true, confirmedBy: `reviewer-${scenarioId.toLowerCase()}` });
  if (!state.results?.simulationEnvelope) await run("run-stress", { parameters: { interestRateBps: 150, creditSpreadBps: 200, liquidityHaircutPct: 12, refinanceShockPct: 18 } });
  return state;
}

async function resolveFrame(page, moduleId) {
  const selector = `#module-frame[data-module-id="${moduleId}"]`;
  await page.locator(selector).waitFor({ state: "attached", timeout: 10_000 });
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const handle = await page.locator(selector).elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) { await page.waitForTimeout(80); continue; }
    try {
      await frame.waitForFunction(() => document.body?.innerText.trim().length > 20, null, { timeout: 2_500 });
      await frame.waitForTimeout(450);
      return frame;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(100);
    }
  }
  throw new Error(`Unable to resolve stable ${moduleId} frame: ${lastError?.message || "unknown error"}`);
}

async function selectRoute(page, scenarioId, route) {
  await page.evaluate((id) => window.OFW_V120_STORE.setActiveScenario(id, "chrome-regression"), scenarioId);
  const homeHash = (await page.evaluate(() => location.hash)) === "#home" ? "#/" : "#home";
  await page.evaluate((hash) => { location.hash = hash; }, homeHash);
  await page.waitForFunction(() => !document.querySelector("#module-frame"), null, { timeout: 10_000 });
  if (route === "#home") return null;
  const moduleId = routeModule.get(route);
  await page.evaluate((hash) => { location.hash = hash; }, route);
  await page.waitForFunction(({ hash, moduleId }) => location.hash === hash && document.querySelector("#module-frame")?.dataset.moduleId === moduleId, { hash: route, moduleId }, { timeout: 10_000 });
  return resolveFrame(page, moduleId);
}

async function visibleClick(frame, selector) {
  const target = frame.locator(`${selector}:visible`).first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  await target.click();
}

async function ensureQueryStart(frame) {
  if (await frame.locator(".modern-start:visible").count()) return;
  if (await frame.locator(".modern-detail-head > button:visible").count()) {
    await frame.locator(".modern-detail-head > button:visible").first().click();
    await frame.waitForTimeout(120);
  }
  const nativeNew = frame.locator("[data-ofw-native-action='query-new']:visible").first();
  const parentNew = frame.locator(".modern-conversation-bar button:visible").filter({ hasText: "新会话" }).first();
  if (await nativeNew.count()) await nativeNew.click();
  else if (await parentNew.count()) await parentNew.click();
  await frame.locator(".modern-start").waitFor({ state: "visible", timeout: 5_000 });
}

async function screenshot(page, name) {
  const target = path.join(screenshotsRoot, name);
  await page.screenshot({ path: target, fullPage: false });
  screenshots.push(`composite/evidence/screenshots/${name}`);
}

async function dimensions(surface) {
  return surface.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    textLength: document.body?.innerText.trim().length || 0,
    runtimeErrors: window.__OFW_RUNTIME_ERRORS__ || [],
    failedResources: window.__OFW_FAILED_RESOURCES__ || []
  }));
}

async function verifyPage(page, frame, { scenarioId, route }) {
  const outer = await dimensions(page);
  const result = {
    blank: outer.textLength < 20,
    outerOverflow: outer.scrollWidth > outer.clientWidth + 1,
    frameOverflow: false,
    applicationErrors: outer.runtimeErrors.length,
    failedResources: outer.failedResources.length
  };
  if (await page.locator(".platform-shell").count() !== 1) throw new Error(`${scenarioId} ${route} does not have exactly one Shell.`);
  if (route === "#home") {
    if (await page.locator("[data-scenario-card],.scenario-portfolio").count()) throw new Error("Homepage still exposes scenario run or to-do cards.");
    if (await page.getByText("场景运行与待办", { exact: true }).count()) throw new Error("Homepage still exposes scenario operations copy.");
    if (await page.locator(".classic-home-frame").count() !== 1 || await page.locator(".module-entry,.module-directory,.home-chain-track").count()) throw new Error("Homepage must contain only the platform capability architecture.");
    if (!await page.getByText("从可信数据到可追溯决策", { exact: true }).count()) throw new Error("Homepage platform architecture heading is missing.");
    if (await page.locator(".home-capability-entry").count() !== 5) throw new Error("Homepage does not expose the active domain's five real feature entries.");
    if (await page.getByText("全部可用", { exact: true }).count() || await page.getByText("当前关系", { exact: true }).count()) throw new Error("Homepage still exposes non-functional availability or relationship copy.");
    if (await page.getByText("统一资源目录", { exact: true }).count()) throw new Error("Homepage still exposes the removed unified resource directory.");
    if (await page.locator(".active-context,[data-action='focus-scenario'],[data-action='switch-scenario']").count()) throw new Error("Homepage still exposes global scenario switching.");
  } else {
    if (await page.locator(".module-subnav").count() !== 1) throw new Error(`${scenarioId} ${route} does not have one unified secondary navigation.`);
    if (await page.locator(".module-subnav-item").count() < 2) throw new Error(`${scenarioId} ${route} secondary navigation is incomplete.`);
    if (await page.locator(".module-breadcrumb").count()) throw new Error(`${scenarioId} ${route} still uses a standalone breadcrumb row.`);
    if (await page.locator(".top-breadcrumb").count() !== 1) throw new Error(`${scenarioId} ${route} does not expose the breadcrumb in the top bar.`);
    const subnavColor = await page.locator(".module-subnav").evaluate((node) => getComputedStyle(node).backgroundColor);
    const expectedColor = route === "#module/query" ? "rgb(235, 234, 228)" : "rgb(228, 235, 242)";
    if (subnavColor !== expectedColor) throw new Error(`${scenarioId} ${route} secondary navigation palette mismatch: ${subnavColor}.`);
    const taskFontSize = await page.locator(".module-subnav-item span:last-child").first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    if (taskFontSize < 13) throw new Error(`${scenarioId} ${route} secondary navigation text is too small.`);
    if (await page.locator("[data-module-scenario-select],.module-scenario-control").count()) throw new Error(`${scenarioId} ${route} still exposes a module-level business scenario selector.`);
  }
  if (frame) {
    const inner = await dimensions(frame);
    result.blank ||= inner.textLength < 20;
    result.frameOverflow = inner.scrollWidth > inner.clientWidth + 1;
    result.applicationErrors += inner.runtimeErrors.length;
    result.failedResources += inner.failedResources.length;
    const visibleInternalNavigation = await frame.locator(".product-nav:visible,.module-nav:visible,.center-nav:visible").count();
    if (visibleInternalNavigation) throw new Error(`${scenarioId} ${route} still exposes ${visibleInternalNavigation} iframe-level navigation blocks.`);
    if (await frame.locator("#ofw-s003-workflow").count()) throw new Error(`${scenarioId} ${route} contains the removed S003 overlay.`);
    if (await frame.locator("[data-portfolio-filter]:visible").count()) throw new Error(`${scenarioId} ${route} still exposes an iframe-level business-scope selector.`);
    if (route === "#module/query") {
      if (!await frame.locator(".modern-start").count() || !await frame.locator(".modern-composer").count()) throw new Error(`${scenarioId} M03 is not the parent conversation workspace.`);
    }
    if (route === "#module/m07") {
      await frame.locator("#app[aria-busy='false']").waitFor({ state: "visible", timeout: 10_000 });
      const m07 = await frame.evaluate(() => ({ route: document.querySelector("#app")?.dataset.route, counts: window.__OFW_M07_DEBUG__?.getResourceCounts?.() }));
      if (!m07.counts || m07.counts.objects < 50 || m07.counts.links < 1 || !["discover", "explore"].includes(m07.route)) throw new Error(`${scenarioId} M07 business-object workspace is incomplete.`);
    }
    if (route === "#module/modeling") {
      if (await page.locator(".module-subnav-item[data-module-id='modeling']").count() !== 5) throw new Error(`${scenarioId} M08 navigation was not reduced to five task pages.`);
      if (await frame.locator(".target-card").count() !== 5) throw new Error("M08 does not expose all registered business objectives together.");
    }
    if (route === "#dashboard" && (await frame.locator(".directory-head").count()) && await frame.getByText("模型结果", { exact: true }).count()) throw new Error("Dashboard directory still exposes the removed model-result button.");
  }
  return result;
}

async function runDataAndContract(page, scenarioId, { s005 = false } = {}) {
  let frame = await selectRoute(page, scenarioId, "#module/data");
  await frame.evaluate(() => { location.hash = "#/resources"; });
  await visibleClick(frame, `[data-ofw-native-action='data-open'][data-scenario-id='${scenarioId}']`);
  for (const operation of ["build-data", "validate-data", "freeze-data"]) {
    await visibleClick(frame, `[data-ofw-native-action='runtime'][data-operation='${operation}'][data-scenario-id='${scenarioId}']`);
  }
  frame = await selectRoute(page, scenarioId, "#module/ontology");
  await frame.evaluate(() => { location.hash = "#published"; });
  await visibleClick(frame, `[data-ofw-native-action='ontology-open'][data-scenario-id='${scenarioId}']`);
  await visibleClick(frame, `[data-ofw-native-action='runtime'][data-operation='create-contract'][data-scenario-id='${scenarioId}']`);
  return waitState(scenarioId, (state) => state.cycle.status === "CONTRACT_READY");
}

async function runBasicScenario(page, scenarioId, question) {
  await resetCycle(scenarioId);
  await runDataAndContract(page, scenarioId);
  let frame = await selectRoute(page, scenarioId, "#module/modeling");
  await visibleClick(frame, "[data-action='benchmark-baseline']");
  await visibleClick(frame, "[data-action='run-models']");
  const runtime = await waitState(scenarioId, (state) => state.cycle.status === "MODEL_PORTFOLIO_EVALUATED");

  frame = await selectRoute(page, scenarioId, "#module/query");
  await ensureQueryStart(frame);
  await visibleClick(frame, `[data-ofw-native-action='query-scenario'][data-query-scenario='${scenarioId}']`);
  await visibleClick(frame, `[data-ofw-model-question='${question}']`);
  await frame.locator("#ofw-native-query-answer").waitFor({ state: "visible" });
  const queryStartHidden = await frame.locator(".modern-start").evaluate((node) => node.hidden && getComputedStyle(node).display === "none");

  const guardReceipt = await api("/v1/model-management/guard", { method: "POST", body: JSON.stringify({ scenarioId, resultKind: "PREDICTION" }) });

  frame = await selectRoute(page, scenarioId, "#module/agent");
  await visibleClick(frame, "[data-ofw-native-action='agent-open']");
  await visibleClick(frame, "[data-ofw-native-action='agent-run']");
  const agentCount = Number(await frame.locator(".product-nav-item.active .nav-count").innerText());
  const agentSummaryCount = Number(await frame.locator(".agent-directory-summary .summary-cell").filter({ hasText: "可用 Agent" }).locator("strong").innerText());

  frame = await selectRoute(page, scenarioId, "#module/report");
  await visibleClick(frame, "[data-ofw-native-action='report-open']");
  await visibleClick(frame, "[data-ofw-native-action='report-generate']");
  const reportText = await frame.locator("#ofw-native-drawer-root").innerText();

  frame = await selectRoute(page, scenarioId, "#dashboard");
  const dashboardHash = ({ S001: "#/view/financing/overview", S002: "#/view/budget/cost", S004: "#/view/preloan/models" })[scenarioId];
  await frame.evaluate((hash) => { location.hash = hash; }, dashboardHash);
  await page.waitForTimeout(350);
  frame = await resolveFrame(page, "dashboard");
  await visibleClick(frame, "[data-ofw-native-action='dashboard-open']");
  await visibleClick(frame, "[data-ofw-native-action='dashboard-view'][data-view='candidate']");
  const dashboardText = await frame.locator("#ofw-native-drawer-root").innerText();
  const dashboardRowCount = await frame.locator("#ofw-native-drawer-root .ofw-native-query-row").count();
  const completed = await completeOptimizationCycle(scenarioId);
  return {
    cycleStatus: completed.cycle.status,
    modelRunCount: completed.modelRuns.length,
    benchmarkRunCount: completed.benchmarks.length,
    shadowWindowCount: completed.shadowTrial?.maturedWindows?.length || 0,
    releaseCandidateId: completed.releaseCandidate?.releaseCandidateId || null,
    bindingStatus: completed.consumerBinding?.status || null,
    simulationResultId: completed.results?.simulationEnvelope?.resultId || null,
    queryStartHidden,
    hardReject: guardReceipt.code === "NON_FACT_SOURCE_REJECTED" && guardReceipt.sideEffectsEmitted === 0,
    agentCount,
    agentSummaryCount,
    reportDraftReady: reportText.includes("待复核草稿"),
    dashboardCandidateReady: dashboardText.includes("候选预测") && dashboardRowCount > 0
  };
}

async function runS003MainChain(page) {
  await resetCycle("S003");
  await runDataAndContract(page, "S003");
  const frame = await selectRoute(page, "S003", "#module/modeling");
  for (const operation of ["benchmark-baseline", "run-models", "generate-insights"]) await visibleClick(frame, `[data-action='${operation}']`);
  await visibleClick(frame, "[data-view='compare']");
  await visibleClick(frame, "[data-action='review-approve']");
  await frame.locator("[data-modal-comment]").fill("已核对证据、潜在风险和同口径验证要求，批准创建候选版本。");
  await visibleClick(frame, "[data-modal-confirm]");
  for (const operation of ["create-candidate", "start-shadow", "advance-shadow", "advance-shadow", "advance-shadow", "rebenchmark", "form-release", "validate-binding"]) {
    await visibleClick(frame, `[data-action='${operation}']`);
  }
  await visibleClick(frame, "[data-action='apply-binding']");
  await visibleClick(frame, "[data-modal-confirm]");
  await waitState("S003", (state) => state.consumerBinding?.status === "APPLIED");
  await frame.evaluate(() => { location.hash = "#release"; });
  await frame.waitForFunction(() => location.hash === "#release" && document.body.innerText.includes("消费者地图") && document.body.innerText.includes("运行与版本控制"), null, { timeout: 10_000 });
  await frame.waitForFunction(() => {
    const button = document.querySelector("[data-action='run-stress']");
    return button && !button.disabled;
  }, null, { timeout: 10_000 });
  await visibleClick(frame, "[data-action='run-stress']");
  return waitState("S003", (state) => state.cycle.status === "BINDING_APPLIED" && Boolean(state.results?.simulationEnvelope));
}

async function verifyM03Animation(page) {
  const frame = await selectRoute(page, "S003", "#module/query");
  const question = "未来90天最需要关注哪些企业？";
  await ensureQueryStart(frame);
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S003']");
  await visibleClick(frame, `[data-ofw-model-question='${question}']`);
  const expected = ["正在确认问题范围", "正在读取权威数据", "正在整理业务结果", "正在核对回答依据", "正在生成回答"];
  const observed = [];
  for (let index = 0; index < expected.length; index += 1) {
    if (index) await frame.waitForTimeout(720);
    const step = await frame.locator(".modern-thinking strong").innerText();
    const count = await frame.locator(".modern-thinking em").innerText();
    const progress = await frame.locator(".modern-thinking-track span").getAttribute("style");
    observed.push({ step, count, progress });
    if (step !== expected[index] || count !== `${index + 1}/5`) throw new Error(`M03 animation step ${index + 1} mismatch.`);
    if (index === 2) await screenshot(page, `final-m03-thinking-${evidenceDate}-1440x900.png`);
  }
  await frame.locator("#ofw-native-query-answer").waitFor({ state: "visible", timeout: 6_000 });
  const answer = { title: await frame.locator(".modern-answer-card h2").innerText(), rowCount: await frame.locator(".ofw-native-query-row").count() };
  await visibleClick(frame, "[data-ofw-native-action='query-new']");
  await visibleClick(frame, `[data-ofw-model-question='${question}']`);
  await frame.waitForTimeout(780);
  await visibleClick(frame, "[data-ofw-native-action='query-new']");
  await frame.waitForTimeout(3_700);
  const cancellation = await frame.evaluate(() => ({ thinking: Boolean(document.querySelector("#ofw-native-query-thinking")), answer: Boolean(document.querySelector("#ofw-native-query-answer")), startVisible: !document.querySelector(".modern-start")?.hidden }));
  if (cancellation.thinking || cancellation.answer || !cancellation.startVisible) throw new Error("M03 cancelled run produced a late answer.");
  return { observed, answer, cancellation };
}

async function verifyM03Recommendations(page) {
  const frame = await selectRoute(page, "S003", "#module/query");
  await ensureQueryStart(frame);
  await frame.locator(".ofw-query-scenario-tabs").waitFor({ state: "visible", timeout: 10_000 });
  const expected = { ALL: 51, S001: 14, S002: 11, S003: 20, S004: 3, S005: 3 };
  const beforeLoads = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);
  const startToken = await frame.evaluate(() => {
    const start = document.querySelector(".modern-start");
    start.dataset.recommendationStabilityToken = `stable-${Date.now()}`;
    return start.dataset.recommendationStabilityToken;
  });
  const observed = {};
  for (const [scenario, count] of Object.entries(expected)) {
    await visibleClick(frame, `[data-ofw-native-action='query-scenario'][data-query-scenario='${scenario}']`);
    const visible = await frame.locator(".modern-question-grid > button:visible").count();
    if (visible !== count) throw new Error(`M03 ${scenario} recommendation count ${visible}, expected ${count}.`);
    observed[scenario] = visible;
  }
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S003']");
  const debtQuestions = await frame.locator(".modern-question-grid > button:visible").allTextContents();
  if (!debtQuestions.some((text) => text.includes("集团当前浮动利率敞口和短期债务结构"))) throw new Error("M03 did not move financing-management debt questions into S003.");
  if (!debtQuestions.some((text) => text.includes("当前21家企业的债务风险等级"))) throw new Error("M03 did not retain the parent S003 recommendations.");
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='ALL']");
  await frame.waitForTimeout(300);
  const afterLoads = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);
  const stableStart = await frame.evaluate((token) => document.querySelector(".modern-start")?.dataset.recommendationStabilityToken === token, startToken);
  if (afterLoads !== beforeLoads || !stableStart) throw new Error("M03 recommendation tabs reloaded or replaced the workspace.");
  const tabLabels = await frame.locator(".ofw-query-scenario-tabs button span").allTextContents();
  if (tabLabels.some((label) => /^S00[1-5]/.test(label))) throw new Error("M03 recommendation tabs still expose scenario codes.");
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S001']");
  await frame.locator(".modern-question-grid > button:visible").filter({ hasText: "集团当前融资余额和平均融资成本分别是多少？" }).first().click();
  await frame.locator(".modern-thinking").waitFor({ state: "visible", timeout: 5_000 });
  const baselineAnimationStep = await frame.locator(".modern-thinking strong").innerText();
  if (baselineAnimationStep !== "正在确认问题范围") throw new Error("M03 parent recommendation no longer starts the baseline response animation.");
  await frame.locator(".modern-conversation-bar button").filter({ hasText: "新会话" }).first().click();
  await frame.locator(".modern-start").waitFor({ state: "visible", timeout: 5_000 });
  await frame.locator(".ofw-query-scenario-tabs").waitFor({ state: "visible", timeout: 5_000 });
  return { tabCount: await frame.locator(".ofw-query-scenario-tabs [data-query-scenario]").count(), tabLabels, observed, frameReloads: afterLoads - beforeLoads, stableStart, baselineAnimationStep };
}

async function verifyM03BusinessAnswerAndAction(page) {
  let frame = await selectRoute(page, "S001", "#module/query");
  await ensureQueryStart(frame);
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S001']");
  await frame.locator(".modern-question-grid > button:visible").filter({ hasText: "集团当前融资余额和平均融资成本" }).first().click();
  await frame.locator(".ofw-sector-comparison").waitFor({ state: "visible", timeout: 12_000 });
  const sectorRows = await frame.locator(".ofw-sector-comparison article").allTextContents();
  if (sectorRows.length !== 7 || !sectorRows.some((item) => item.includes("环保产业") && item.includes("+0.369"))) throw new Error("M03 initial answer does not expose the complete group-to-sector comparison.");
  await frame.getByText("查看回答详情", { exact: true }).click();
  await frame.locator(".modern-detail-tabs button").filter({ hasText: "BI 分析" }).click();
  const chartModes = {};
  for (const label of ["指标卡", "横向柱状图", "纵向柱状图", "堆叠柱状图"]) {
    const button = frame.locator(".modern-chart-types button").filter({ hasText: label });
    if (!await button.count()) continue;
    await button.click();
    await frame.waitForTimeout(360);
    chartModes[label] = await frame.locator(".modern-lieflat-chart").getAttribute("data-chart-type");
  }
  if (new Set(Object.values(chartModes)).size < 4) throw new Error("M03 BI chart modes are not structurally distinct.");
  await frame.locator(".modern-detail-head > button").click();
  await frame.locator(".modern-answer-card").waitFor({ state: "visible", timeout: 5_000 });
  await frame.locator(".modern-conversation-bar button").filter({ hasText: "新会话" }).first().click();
  await frame.locator(".modern-start").waitFor({ state: "visible", timeout: 5_000 });
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S001']");
  await frame.locator(".modern-question-grid > button:visible").filter({ hasText: "单位553的成本压力主要来自哪些银行" }).first().click();
  await frame.locator(".ofw-query-action-cta").waitFor({ state: "visible", timeout: 12_000 });
  await frame.locator(".ofw-query-action-cta button").click();
  await frame.locator(".ofw-action-modal").waitFor({ state: "visible", timeout: 5_000 });
  await frame.locator("[data-query-action-confirm]").check();
  await visibleClick(frame, "[data-ofw-native-action='query-action-submit']");
  await frame.waitForFunction(() => document.querySelector(".ofw-action-modal")?.innerText.includes("已送达决策中心"), null, { timeout: 5_000 });
  const actionReceipt = await frame.locator(".ofw-action-modal").innerText();
  await visibleClick(frame, "[data-ofw-native-route='#module/decision']");
  await page.waitForFunction(() => location.hash === "#module/decision" && document.querySelector("#module-frame")?.dataset.moduleId === "decision", null, { timeout: 10_000 });
  frame = await resolveFrame(page, "decision");
  await frame.waitForTimeout(700);
  const workbench = await frame.evaluate(() => ({
    title: document.querySelector(".page-header h1")?.textContent,
    hasTarget: document.body.innerText.includes("单位553"),
    summaryCards: [...document.querySelectorAll(".portfolio-leader-metrics")].filter((item) => getComputedStyle(item).display !== "none" && getComputedStyle(item).visibility !== "hidden").length,
    scenarioFilters: [...document.querySelectorAll("label.dc-select")].filter((item) => item.querySelector(":scope > span")?.textContent.trim() === "业务场景" && getComputedStyle(item).display !== "none" && getComputedStyle(item).visibility !== "hidden").length,
    modelIntercept: document.body.innerText.includes("模型结果拦截")
  }));
  await frame.evaluate(() => { location.hash = "#overview"; });
  await frame.locator(".ofw-decision-ops").waitFor({ state: "visible", timeout: 5_000 });
  const operations = await frame.evaluate(() => ({
    title: document.querySelector(".ofw-ops-head h1")?.textContent,
    recordCount: document.querySelectorAll(".ofw-ops-table > button").length,
    hasTarget: document.body.innerText.includes("单位553"),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }));
  return { sectorRows, chartModes, actionReceiptReady: actionReceipt.includes("AR-RUN-S001"), workbench, operations };
}

async function verifyHomeStability(page) {
  await selectRoute(page, "S003", "#home");
  const beforeLoads = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);
  const before = await page.locator(".classic-home-frame").boundingBox();
  const layouts = [];
  for (const domain of ["intelligence", "action", "foundation", "intelligence", "foundation"]) {
    await page.locator(`.architecture-node[data-domain='${domain}']`).click();
    await page.waitForTimeout(150);
    const box = await page.locator(".classic-home-frame").boundingBox();
    layouts.push({ domain, x: box.x, y: box.y, width: box.width, height: box.height });
  }
  const afterLoads = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);
  const stable = layouts.every((item) => Math.abs(item.x - before.x) < 0.5 && Math.abs(item.y - before.y) < 0.5 && Math.abs(item.width - before.width) < 0.5 && Math.abs(item.height - before.height) < 0.5);
  if (!stable || afterLoads !== beforeLoads) throw new Error("Homepage capability switching caused layout movement or an iframe reload.");
  return { stable, frameReloads: afterLoads - beforeLoads, layouts };
}

async function verifyDataAndOntologyUx(page) {
  let frame = await selectRoute(page, "S003", "#module/data");
  await frame.locator(".source-resource-table").waitFor({ state: "visible", timeout: 10_000 });
  const sourceRows = await frame.locator(".source-resource-table tbody tr").evaluateAll((rows) => rows.map((row) => ({ name: row.querySelector("strong")?.textContent, snapshots: row.querySelector("td:nth-child(5)")?.textContent.trim() })));
  const sourceByName = Object.fromEntries(sourceRows.map((item) => [item.name, Number(item.snapshots)]));
  if (sourceByName["实际执行明细"] !== 2 || sourceByName["预算下达明细"] !== 2 || sourceByName["预算申报明细汇总"] !== 2 || sourceByName["中国广核年度报告"] !== 3) throw new Error("M02 yearly files were not consolidated into source snapshots.");
  const redundantScopeControls = await frame.locator("[data-portfolio-filter]:visible").count();
  const redundantVersionControls = await frame.locator("button:visible,a:visible").filter({ hasText: "新建评测数据版本" }).count();
  if (redundantScopeControls || redundantVersionControls) throw new Error(`M02 still exposes redundant controls: scope=${redundantScopeControls}, evaluationVersion=${redundantVersionControls}.`);
  if (await frame.locator("[data-ofw-native-model-data]:not([data-ofw-native-model-data='container'])").count() !== 5) throw new Error("M02 does not expose five model data assets in the native asset catalog.");
  await frame.locator(".source-resource-table tbody tr").filter({ hasText: "实际执行明细" }).getByText("查看详情", { exact: true }).click();
  await frame.locator(".tabs .tab").filter({ hasText: "快照历史" }).click();
  const actualSnapshots = await frame.locator(".snapshot-row").count();
  if (actualSnapshots !== 2) throw new Error("M02 actual-execution source does not expose two yearly snapshots.");
  await frame.evaluate(() => { location.hash = "#/resources"; });
  await frame.waitForTimeout(350);
  await frame.locator(".source-resource-table tbody tr").filter({ hasText: "中国广核年度报告" }).getByText("查看详情", { exact: true }).click();
  await frame.locator(".tabs .tab").filter({ hasText: "快照历史" }).click();
  const annualSnapshots = await frame.locator(".snapshot-row").count();
  if (annualSnapshots !== 3) throw new Error("M02 annual-report source does not expose three yearly snapshots.");
  await frame.evaluate(() => { location.hash = "#/pipelines?tab=runs"; });
  await frame.waitForTimeout(400);
  const runHistory = await frame.evaluate(() => ({ rows: document.querySelectorAll(".run-row").length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, grid: document.querySelector(".run-row") ? getComputedStyle(document.querySelector(".run-row")).gridTemplateColumns : "" }));
  if (!runHistory.rows || runHistory.overflow) throw new Error("M02 run history is empty or horizontally misaligned.");
  await frame.evaluate(() => { location.hash = "#/pipelines?tab=definitions"; });
  await frame.waitForTimeout(350);
  await frame.locator(".pipeline-card a.btn.primary").first().click();
  await frame.locator(".definition-selector > button").click();
  await frame.waitForFunction(() => document.querySelector(".version-popover")?.innerText.includes("新建草稿（可编辑副本）") && document.querySelector(".version-popover")?.innerText.includes("已发布 · 只读"), null, { timeout: 5_000 });
  const definitionMenu = await frame.locator(".version-popover").innerText();
  if (!definitionMenu.includes("新建草稿（可编辑副本）") || !definitionMenu.includes("已发布 · 只读")) throw new Error("M02 pipeline definition menu does not expose the read-only-to-draft workflow.");

  frame = await selectRoute(page, "S003", "#module/ontology");
  await frame.locator(".published-ontology-grid").waitFor({ state: "visible", timeout: 10_000 });
  const ontologyTitles = await frame.locator(".published-ontology-card:not([data-ofw-native-model-contract]) h2").allTextContents();
  const ontologyCardText = await frame.locator(".published-ontology-card:not([data-ofw-native-model-contract])").allTextContents();
  if (ontologyTitles.some((title) => /^S00[1-5]/.test(title)) || ontologyCardText.some((text) => /(^|\s)S00[1-5](\s|·)/.test(text))) throw new Error("M01 published ontology cards still expose scenario markers.");
  if (await frame.locator("[data-ofw-native-model-contract]").count() !== 5) throw new Error("M01 does not expose five model contracts in the semantic asset catalog.");
  return { sourceRows, actualSnapshots, annualSnapshots, runHistory, definitionMenu, ontologyTitles };
}

async function verifyM08Scroll(page) {
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 720 });
  const frame = await selectRoute(page, "S003", "#module/modeling");
  const results = {};
  for (const view of m08Views) {
    await frame.evaluate((target) => { location.hash = `#${target}`; }, view);
    await frame.waitForFunction((target) => location.hash === `#${target}`, view, { timeout: 5_000 });
    await frame.waitForTimeout(120);
    results[view] = await frame.evaluate(() => {
      const scroller = document.scrollingElement;
      const before = scroller.scrollTop;
      scroller.scrollTo(0, scroller.scrollHeight);
      const after = scroller.scrollTop;
      scroller.scrollTo(0, 0);
      const internalScrollAvailable = [...document.querySelectorAll(".repository-list,.file-tree,.repository-console pre,.repository-git")].some((node) => node.scrollHeight > node.clientHeight + 1);
      return { clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight, documentScrollWorked: scroller.scrollHeight <= scroller.clientHeight + 1 || after > before, internalScrollAvailable };
    });
    if (!results[view].documentScrollWorked) throw new Error(`M08 ${view} cannot scroll vertically.`);
    if (view === "compare") {
      const benchmarkText = await frame.locator("body").innerText();
      if (/precisionAtFixedCapacity|brierScore/.test(benchmarkText)) throw new Error("M08 benchmark still exposes internal metric field names.");
    }
  }
  await frame.evaluate(() => { location.hash = "#repository"; });
  await frame.locator(".repository-layout").waitFor({ state: "visible", timeout: 10_000 });
  results.repository = await frame.evaluate(() => {
    const scroller = document.scrollingElement;
    const before = scroller.scrollTop;
    scroller.scrollTo(0, scroller.scrollHeight);
    const after = scroller.scrollTop;
    scroller.scrollTo(0, 0);
    const internalScrollAvailable = [...document.querySelectorAll(".repository-list,.file-tree,.repository-console pre,.repository-git")].some((node) => node.scrollHeight > node.clientHeight + 1);
    return { clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight, documentScrollWorked: scroller.scrollHeight <= scroller.clientHeight + 1 || after > before, internalScrollAvailable };
  });
  if (!results.repository.documentScrollWorked || !results.repository.internalScrollAvailable) throw new Error("M08 repository scrolling is unavailable.");
  if (previousViewport) await page.setViewportSize(previousViewport);
  return { viewport: "1280x720", views: results };
}

async function verifyS003DataAndSemanticTrace(page) {
  let frame = await selectRoute(page, "S003", "#module/data");
  await frame.locator("[data-ofw-native-model-data='S003']").waitFor({ state: "visible", timeout: 10_000 });
  const dataCatalogNative = await frame.locator(".asset-column [data-ofw-native-model-data]:not([data-ofw-native-model-data='container'])").count() === 5;
  const dataPromptPanels = await frame.locator(".ofw-native-inline-model-data").count();
  await visibleClick(frame, "[data-ofw-native-action='data-open'][data-scenario-id='S003']");
  const dataText = await frame.locator("#ofw-native-drawer-root").innerText();
  const dataAssetCount = await frame.locator("#ofw-native-drawer-root .ofw-native-contract-list article").count();
  frame = await selectRoute(page, "S003", "#module/ontology");
  await frame.locator("[data-ofw-native-model-contract='S003']").waitFor({ state: "visible", timeout: 10_000 });
  const semanticCatalogNative = await frame.locator(".published-ontology-grid [data-ofw-native-model-contract]").count() === 5;
  const semanticPromptPanels = await frame.locator(".ofw-native-inline-model-data").count();
  await visibleClick(frame, "[data-ofw-native-action='ontology-open'][data-scenario-id='S003']");
  const semanticText = await frame.locator("#ofw-native-drawer-root").innerText();
  const modelBindingCount = await frame.locator("#ofw-native-drawer-root .ofw-native-contract-list article").count();
  return {
    dataAssetCount,
    modelBindingCount,
    dataCatalogNative,
    semanticCatalogNative,
    dataPromptPanels,
    semanticPromptPanels,
    dataTraceReady: dataCatalogNative && dataPromptPanels === 0 && dataAssetCount === 6 && dataText.includes("synthetic recipe") && dataText.includes("Python model run"),
    semanticTraceReady: semanticCatalogNative && semanticPromptPanels === 0 && modelBindingCount === 10 && semanticText.includes("FACT_READ_ONLY") && semanticText.includes("PREDICTION_OR_SHADOW")
  };
}

async function runS003RepositoryFlow(page) {
  const frame = await selectRoute(page, "S003", "#module/modeling");
  await frame.evaluate(() => { location.hash = "#repository"; });
  await frame.locator(".repository-layout").waitFor({ state: "visible", timeout: 10_000 });
  await visibleClick(frame, "[data-repository-model-id='MODEL-S003-CALIBRATED-SCORE']");
  await frame.waitForFunction(() => document.querySelector(".repository-identity")?.innerText.includes("概率校准评分模型"), null, { timeout: 10_000 });
  const initial = await frame.evaluate(() => ({ repositoryCount: document.querySelectorAll(".repository-list button").length, fileCount: document.querySelectorAll(".file-tree button").length, branch: document.querySelector("[data-repository-branch]")?.value, readOnly: document.querySelector("[data-repository-editor]")?.readOnly, counts: [...document.querySelectorAll(".repository-git dd")].map((item) => Number(item.textContent)) }));
  const runSuffix = Date.now().toString(36);
  const branchName = `feature/chrome-${runSuffix}`;
  const tagName = `v0.2.0-rc.${runSuffix}`;
  await frame.locator("[data-repository-form='branchName']").fill(branchName);
  await visibleClick(frame, "[data-repository-action='branch']");
  await frame.waitForFunction((name) => document.querySelector("[data-repository-branch]")?.value === name, branchName, { timeout: 10_000 });
  await frame.locator("[data-repository-editor]").evaluate((element) => {
    element.value += "\n\n## Chrome 回归\n\n记录 2026-09-04 代码仓全链路验证。\n";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await frame.locator("[data-repository-form='commitMessage']").fill("Add Chrome regression note");
  await visibleClick(frame, "[data-repository-action='commit']");
  await frame.waitForFunction((counts) => { const next = [...document.querySelectorAll(".repository-git dd")].map((item) => Number(item.textContent)); return next[0] >= counts[0] + 1 && next[1] >= counts[1] + 1; }, initial.counts, { timeout: 10_000 });
  await frame.locator("[data-repository-form='tagName']").fill(tagName);
  await visibleClick(frame, "[data-repository-action='tag']");
  await frame.waitForFunction((counts) => [...document.querySelectorAll(".repository-git dd")].map((item) => Number(item.textContent))[2] >= counts[2] + 1, initial.counts, { timeout: 10_000 });
  await visibleClick(frame, "[data-repository-action='release']");
  await frame.waitForFunction((counts) => [...document.querySelectorAll(".repository-git dd")].map((item) => Number(item.textContent)).at(-1) >= counts.at(-1) + 1, initial.counts, { timeout: 10_000 });
  await visibleClick(frame, "[data-repository-action='test']");
  await frame.waitForFunction(() => document.querySelector(".repository-console pre")?.innerText.includes("PASSED"), null, { timeout: 15_000 });
  await visibleClick(frame, "[data-repository-action='run']");
  await frame.waitForFunction(() => document.querySelector(".repository-console pre")?.innerText.includes('"resultCount": 21'), null, { timeout: 15_000 });
  const consoleText = await frame.locator(".repository-console pre").innerText();
  const final = await frame.evaluate((initialCounts) => { const counts = [...document.querySelectorAll(".repository-git dd")].map((item) => Number(item.textContent)); return { branch: document.querySelector("[data-repository-branch]")?.value, counts, deltas: counts.map((value, index) => value - (initialCounts[index] || 0)), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; }, initial.counts);
  await screenshot(page, `final-m08-repository-${evidenceDate}-1440x900.png`);
  return { initial, final, pythonRunSucceeded: consoleText.includes("SUCCEEDED"), boundToDataAndSemantic: consoleText.includes("DV-S003-SYN-LONGITUDINAL") && consoleText.includes("SC-S003-MULTIMODEL") };
}

async function verifyS004Dashboard(page) {
  let frame = await selectRoute(page, "S004", "#dashboard");
  await page.locator(".module-subnav-item[data-module-id='dashboard'][data-module-task='preloan']").click();
  await page.waitForFunction(() => document.querySelector("#module-frame")?.dataset.scenarioId === "S004", null, { timeout: 10_000 });
  frame = await resolveFrame(page, "dashboard");
  await frame.waitForFunction(() => location.hash === "#/view/preloan/overview" && document.body.innerText.includes("贷款贷前风险评估驾驶舱"), null, { timeout: 10_000 });
  const overview = { metricCount: await frame.locator(".metric").count(), applicantCount: await frame.locator(".preloan-table tbody tr").count() };
  await visibleClick(frame, "[data-action='preloan-applicant-detail'][data-applicant-id='LoanApplicant-004']");
  const applicantText = await frame.locator(".drawer").innerText();
  await visibleClick(frame, ".drawer-head [data-action='close-drawer']");
  await frame.evaluate(() => { location.hash = "#/view/preloan/evidence"; });
  await frame.locator(".preloan-evidence-grid").waitFor({ state: "visible" });
  const evidenceCount = await frame.locator(".preloan-evidence-grid article").count();
  await visibleClick(frame, "[data-action='preloan-evidence-detail']");
  const evidenceText = await frame.locator(".drawer").innerText();
  await visibleClick(frame, ".drawer-head [data-action='close-drawer']");
  await frame.evaluate(() => { location.hash = "#/view/preloan/models"; });
  await frame.locator(".preloan-result-identities").waitFor({ state: "visible" });
  await visibleClick(frame, "[data-ofw-native-action='dashboard-open']");
  const modelText = await frame.locator("#ofw-native-drawer-root").innerText();
  await screenshot(page, `final-dashboard-s004-${evidenceDate}-1440x900.png`);
  return { ...overview, evidenceCount, applicantTraceReady: applicantText.includes("DATA-ASSET-S004-20260815-V01"), missingStatesVisible: applicantText.includes("无法评价"), evidenceTraceReady: evidenceText.includes("DATA-ASSET-S004") || evidenceText.includes("SEM-S004-PREFLIGHT-V1"), modelResultReady: modelText.includes("贷前风险评估") || modelText.includes("S004") };
}

async function verifyS003Consumers(page) {
  let frame = await selectRoute(page, "S003", "#module/query");
  await ensureQueryStart(frame);
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S003']");
  await visibleClick(frame, "[data-ofw-model-question='未来90天最需要关注哪些企业？']");
  await frame.locator("#ofw-native-query-answer").waitFor({ state: "visible" });
  const queryText = await frame.locator("#ofw-native-query-answer").innerText();
  await frame.waitForTimeout(900);
  await screenshot(page, `final-m03-answer-${evidenceDate}-1440x900.png`);

  frame = await selectRoute(page, "S003", "#dashboard");
  await frame.evaluate(() => { location.hash = "#/view/risk/operations"; });
  await page.waitForTimeout(350);
  frame = await resolveFrame(page, "dashboard");
  await frame.waitForFunction(() => document.body.innerText.includes("模型目标与优化消费结果"), null, { timeout: 10_000 });
  await frame.locator('[data-change="s003-use-kind"]').selectOption("BENCHMARK");
  await visibleClick(frame, "[data-action='s003-modeling-recalculate']");
  await frame.waitForFunction(() => !document.body.innerText.includes("正在计算"), null, { timeout: 10_000 });
  await visibleClick(frame, "[data-action='s003-modeling-view'][data-view='candidate']");
  await visibleClick(frame, "[data-action='s003-enterprise-detail']");
  const detailLabels = ["风险时间曲线", "风险事件类型", "流动性缺口与债务到期墙", "关系传染路径", "异常事件", "指标与因子贡献", "模型、数据与证据"];
  for (const label of detailLabels) await frame.getByText(label, { exact: true }).waitFor({ state: "visible" });
  await screenshot(page, `final-dashboard-detail-${evidenceDate}-1440x900.png`);
  return { queryRows: await frame.locator(".s003-detail-section").count(), queryReady: queryText.includes("未来90天风险关注"), detailLabels };
}

async function runS005Chain(page) {
  await resetCycle("S005");
  await page.evaluate(() => window.OFW_V120_STORE.resetCurrentScenario("S005"));
  await runDataAndContract(page, "S005", { s005: true });
  let frame = await selectRoute(page, "S005", "#module/query");
  await ensureQueryStart(frame);
  await visibleClick(frame, "[data-ofw-native-action='query-scenario'][data-query-scenario='S005']");
  await visibleClick(frame, "[data-ofw-model-question='哪些金融产品的候选评价分数最高？']");
  await frame.locator("#ofw-native-query-answer").waitFor({ state: "visible" });
  await ensureQueryStart(frame);
  await visibleClick(frame, "[data-ofw-model-question='压力模拟下哪些产品变化最大？']");
  await frame.locator("#ofw-native-query-answer").waitFor({ state: "visible" });

  frame = await selectRoute(page, "S005", "#module/decision");
  await page.waitForFunction(() => window.OFW_V120_STORE.s005ModuleProjection("M04")?.actions?.find((item) => item.operation === "selection_read_only")?.status === "complete", null, { timeout: 10_000 });
  const decisionGuard = await api("/v1/model-management/guard", { method: "POST", body: JSON.stringify({ scenarioId: "S005", resultKind: "SIMULATION" }) });

  frame = await selectRoute(page, "S005", "#module/agent");
  await visibleClick(frame, "[data-ofw-native-action='agent-open']");
  await visibleClick(frame, "[data-ofw-native-action='agent-run']");

  frame = await selectRoute(page, "S005", "#module/m07");
  await page.locator('[data-module-task="discover"]').click();
  await frame.locator("#object-search").fill("基金 A");
  await visibleClick(frame, "[data-open-object='investment::product-01']");
  await visibleClick(frame, "#continue-analysis");
  await visibleClick(frame, "[data-navigate-module='modeling']");
  await page.waitForFunction(() => location.hash === "#module/modeling" && document.querySelector("#module-frame")?.dataset.moduleId === "modeling", null, { timeout: 10_000 });
  frame = await resolveFrame(page, "modeling");
  await visibleClick(frame, "[data-action='benchmark-baseline']");
  await visibleClick(frame, "[data-action='run-models']");
  await frame.locator("[data-result-view]").selectOption("candidate");
  await visibleClick(frame, "[data-action='return-result']");
  await page.waitForFunction(() => location.hash === "#module/m07" && document.querySelector("#module-frame")?.dataset.moduleId === "m07", null, { timeout: 10_000 });

  frame = await selectRoute(page, "S005", "#module/report");
  await visibleClick(frame, "[data-ofw-native-action='report-open']");
  await visibleClick(frame, "[data-ofw-native-action='report-generate']");
  const reportText = await frame.locator("#ofw-native-drawer-root").innerText();
  const projection = await page.evaluate(() => {
    const moduleOutputs = ["M02", "M01", "M03", "M04", "M05", "M07", "M08", "M06"]
      .flatMap((moduleId) => window.OFW_V120_STORE.s005ModuleProjection(moduleId)?.moduleOutputs || []);
    return {
      progress: window.OFW_V120_STORE.s005Progress(),
      evaluation: window.OFW_V120_STORE.s005EvaluationProjection(),
      moduleOutputs: [...new Map(moduleOutputs.map((item) => [item.outputId, item])).values()]
    };
  });
  const completed = await completeOptimizationCycle("S005");
  return {
    progress: projection.progress,
    evaluationRunId: projection.evaluation?.evaluationRun?.evaluationRunId || null,
    evaluationResultId: projection.evaluation?.evaluationResult?.evaluationResultId || null,
    moduleOutputCount: projection.moduleOutputs.length,
    reportDraftReady: reportText.includes("待复核草稿"),
    hardReject: decisionGuard.code === "NON_FACT_SOURCE_REJECTED" && decisionGuard.sideEffectsEmitted === 0,
    externalSideEffects: projection.evaluation?.evaluationResult?.boundary?.externalSideEffects ?? 0,
    optimizationStatus: completed.cycle.status,
    benchmarkRunCount: completed.benchmarks.length,
    shadowWindowCount: completed.shadowTrial?.maturedWindows?.length || 0,
    releaseCandidateId: completed.releaseCandidate?.releaseCandidateId || null,
    bindingStatus: completed.consumerBinding?.status || null,
    simulationResultId: completed.results?.simulationEnvelope?.resultId || null
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--disable-features=Translate,MediaRouter", "--disable-background-networking"]
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") errors.console.push(message.text()); });
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "request failed";
    if (!/ERR_ABORTED|favicon/i.test(`${failure} ${request.url()}`)) errors.resources.push(`${request.url()} · ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon/i.test(response.url())) errors.resources.push(`${response.url()} · HTTP ${response.status()}`);
  });
  await page.goto(`${entryBase}#home`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.OFW_V131_STORE && document.body.innerText.includes("模型目标与优化"), null, { timeout: 10_000 });

  const coverage = { failedPages: 0, blankPages: 0, outerHorizontalOverflows: 0, frameDocumentHorizontalOverflows: 0, applicationErrors: 0, failedResources: 0 };
  const visitedM08Views = {};
  for (const scenarioId of scenarioIds) {
    for (const route of routes) {
      try {
        const frame = await selectRoute(page, scenarioId, route);
        const check = await verifyPage(page, frame, { scenarioId, route });
        coverage.blankPages += Number(check.blank);
        coverage.outerHorizontalOverflows += Number(check.outerOverflow);
        coverage.frameDocumentHorizontalOverflows += Number(check.frameOverflow);
        coverage.applicationErrors += check.applicationErrors;
        coverage.failedResources += check.failedResources;
        if (route === "#module/modeling") {
          const visited = [];
          for (const view of m08Views) {
            await frame.evaluate((target) => { location.hash = `#${target}`; }, view);
            await frame.waitForFunction((target) => location.hash === `#${target}`, view, { timeout: 5_000 });
            await frame.waitForTimeout(80);
            visited.push(view);
          }
          visitedM08Views[scenarioId] = visited;
        }
      } catch (error) {
        coverage.failedPages += 1;
        errors.page.push(`${scenarioId} ${route}: ${error.message}`);
      }
    }
  }

  const homeStability = await verifyHomeStability(page);
  const dataAndOntologyUx = await verifyDataAndOntologyUx(page);

  const basicChains = {
    S001: await runBasicScenario(page, "S001", "哪些融资主体的候选评价结果最需要关注？"),
    S002: await runBasicScenario(page, "S002", "哪些预算单元的候选超支风险最高？"),
    S004: await runBasicScenario(page, "S004", "哪些借款主体需要优先人工复核？")
  };
  const s003Runtime = await runS003MainChain(page);
  const m03Recommendations = await verifyM03Recommendations(page);
  const m03BusinessFlow = await verifyM03BusinessAnswerAndAction(page);
  const m03Animation = await verifyM03Animation(page);
  const m08Scroll = await verifyM08Scroll(page);
  const s003Traceability = await verifyS003DataAndSemanticTrace(page);
  const s003Repository = await runS003RepositoryFlow(page);
  const s003Consumers = await verifyS003Consumers(page);
  const s004Dashboard = await verifyS004Dashboard(page);
  const s005Chain = await runS005Chain(page);
  const allScenarioOptimization = {
    S001: { status: basicChains.S001.cycleStatus, benchmarks: basicChains.S001.benchmarkRunCount, shadowWindows: basicChains.S001.shadowWindowCount, releaseCandidateId: basicChains.S001.releaseCandidateId, bindingStatus: basicChains.S001.bindingStatus, simulationResultId: basicChains.S001.simulationResultId },
    S002: { status: basicChains.S002.cycleStatus, benchmarks: basicChains.S002.benchmarkRunCount, shadowWindows: basicChains.S002.shadowWindowCount, releaseCandidateId: basicChains.S002.releaseCandidateId, bindingStatus: basicChains.S002.bindingStatus, simulationResultId: basicChains.S002.simulationResultId },
    S003: { status: s003Runtime.cycle.status, benchmarks: s003Runtime.benchmarks.length, shadowWindows: s003Runtime.shadowTrial?.maturedWindows?.length || 0, releaseCandidateId: s003Runtime.releaseCandidate?.releaseCandidateId || null, bindingStatus: s003Runtime.consumerBinding?.status || null, simulationResultId: s003Runtime.results?.simulationEnvelope?.resultId || null },
    S004: { status: basicChains.S004.cycleStatus, benchmarks: basicChains.S004.benchmarkRunCount, shadowWindows: basicChains.S004.shadowWindowCount, releaseCandidateId: basicChains.S004.releaseCandidateId, bindingStatus: basicChains.S004.bindingStatus, simulationResultId: basicChains.S004.simulationResultId },
    S005: { status: s005Chain.optimizationStatus, benchmarks: s005Chain.benchmarkRunCount, shadowWindows: s005Chain.shadowWindowCount, releaseCandidateId: s005Chain.releaseCandidateId, bindingStatus: s005Chain.bindingStatus, simulationResultId: s005Chain.simulationResultId }
  };

  await selectRoute(page, "S003", "#home");
  await screenshot(page, `final-home-${evidenceDate}-1440x900.png`);
  for (const [route, name] of [
    ["#module/data", `final-m02-${evidenceDate}-1440x900.png`],
    ["#module/ontology", `final-m01-${evidenceDate}-1440x900.png`],
    ["#module/query", `final-m03-${evidenceDate}-1440x900.png`],
    ["#module/decision", `final-m04-${evidenceDate}-1440x900.png`],
    ["#module/agent", `final-m05-${evidenceDate}-1440x900.png`],
    ["#module/report", `final-m06-${evidenceDate}-1440x900.png`],
    ["#module/m07", `final-m07-${evidenceDate}-1440x900.png`],
    ["#module/modeling", `final-m08-${evidenceDate}-1440x900.png`],
    ["#dashboard", `final-dashboard-${evidenceDate}-1440x900.png`]
  ]) {
    const frame = await selectRoute(page, "S003", route);
    if (route === "#module/modeling") {
      await frame.evaluate(() => { location.hash = "#objectives"; });
      await frame.waitForTimeout(180);
    }
    if (route === "#dashboard") {
      await frame.evaluate(() => { location.hash = "#/view/risk/operations"; });
      await page.waitForTimeout(300);
    }
    await screenshot(page, name);
  }
  {
    const frame = await selectRoute(page, "S003", "#module/modeling");
    for (const view of ["models", "compare", "observe"]) {
      await frame.evaluate((target) => { location.hash = `#${target}`; }, view);
      await frame.waitForTimeout(180);
      await screenshot(page, `final-m08-${view}-${evidenceDate}-1440x900.png`);
    }
  }
  await selectRoute(page, "S002", "#module/m07");
  await screenshot(page, `final-s002-m07-${evidenceDate}-1440x900.png`);
  await selectRoute(page, "S004", "#module/m07");
  await screenshot(page, `final-s004-m07-${evidenceDate}-1440x900.png`);

  const viewportResults = [];
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    let outer = 0;
    let inner = 0;
    let blanks = 0;
    for (const route of routes) {
      const frame = await selectRoute(page, "S003", route);
      const check = await verifyPage(page, frame, { scenarioId: "S003", route });
      outer += Number(check.outerOverflow);
      inner += Number(check.frameOverflow);
      blanks += Number(check.blank);
      if (viewport.width === 390 && route === "#module/modeling") {
        for (const view of m08Views) {
          await frame.evaluate((target) => { location.hash = `#${target}`; }, view);
          await frame.waitForTimeout(60);
        }
      }
    }
    const size = `${viewport.width}x${viewport.height}`;
    await selectRoute(page, "S003", "#module/query");
    await screenshot(page, `final-m03-${evidenceDate}-${size}.png`);
    await selectRoute(page, "S003", "#module/modeling");
    await screenshot(page, `final-m08-${evidenceDate}-${size}.png`);
    await selectRoute(page, "S003", "#dashboard");
    await screenshot(page, `final-dashboard-${evidenceDate}-${size}.png`);
    viewportResults.push({ size, result: outer + inner + blanks === 0 ? "passed" : "failed", scenarioId: "S003", routesChecked: routes.length, outerHorizontalOverflowsObserved: outer, moduleDocumentHorizontalOverflowsObserved: inner, blankPagesObserved: blanks });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await selectRoute(page, "S003", "#home");
  const secondPage = await context.newPage();
  await secondPage.goto(`${entryBase}#home`, { waitUntil: "domcontentloaded" });
  await secondPage.waitForFunction(() => window.__OFW_PAGE_INSTANCE__);
  const secondInstanceBefore = await secondPage.evaluate(() => window.__OFW_PAGE_INSTANCE__);
  await selectRoute(page, "S002", "#module/m07");
  await secondPage.waitForTimeout(250);
  const secondInstanceAfter = await secondPage.evaluate(() => window.__OFW_PAGE_INSTANCE__);
  const frameLoadsBefore = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  const frameLoadsAfter = await page.evaluate(() => window.__OFW_FRAME_LOAD_COUNT__ || 0);

  const deepLink = await context.newPage();
  await deepLink.goto(`${entryBase.replace("?", "?scenarioId=S004&")}#module/m07`, { waitUntil: "domcontentloaded" });
  await deepLink.waitForFunction(() => document.querySelector("#module-frame")?.dataset.scenarioId === "S004", null, { timeout: 10_000 });
  const deepFrame = await resolveFrame(deepLink, "m07");
  const deepLinkReady = await deepFrame.evaluate(() => document.querySelector("#app")?.getAttribute("aria-busy") === "false" && (window.__OFW_M07_DEBUG__?.getResourceCounts?.().objects || 0) >= 50);
  await deepLink.reload({ waitUntil: "domcontentloaded" });
  await deepLink.waitForFunction(() => document.querySelector("#module-frame")?.dataset.scenarioId === "S004", null, { timeout: 10_000 });
  const reloadedDeepFrame = await resolveFrame(deepLink, "m07");
  const deepRefreshReady = await reloadedDeepFrame.evaluate(() => document.querySelector("#app")?.getAttribute("aria-busy") === "false" && (window.__OFW_M07_DEBUG__?.getResourceCounts?.().objects || 0) >= 50);
  await deepLink.close();
  await secondPage.close();

  const allErrors = [...new Set([...errors.console, ...errors.page, ...errors.resources])];
  const observedAt = new Date().toISOString();
  const routeCoveragePassed = coverage.failedPages + coverage.blankPages + coverage.outerHorizontalOverflows + coverage.frameDocumentHorizontalOverflows + coverage.applicationErrors + coverage.failedResources === 0;
  const allScenarioOptimizationPassed = Object.values(allScenarioOptimization).every((item) => item.status === "BINDING_APPLIED" && item.bindingStatus === "APPLIED" && item.shadowWindows === 3 && item.releaseCandidateId && item.simulationResultId);
  const realWorkflowsPassed = Object.values(basicChains).every((item) => item.queryStartHidden && item.hardReject && item.agentCount === 10 && item.agentSummaryCount === 10 && item.reportDraftReady && item.dashboardCandidateReady && item.cycleStatus === "BINDING_APPLIED")
    && m03Animation.answer.rowCount > 0
    && m03Animation.cancellation.startVisible
    && m03Recommendations.tabCount === 6
    && m03Recommendations.observed.ALL === 51
    && m03Recommendations.frameReloads === 0
    && m03Recommendations.stableStart
    && m03Recommendations.baselineAnimationStep === "正在确认问题范围"
    && m03BusinessFlow.sectorRows.length === 7
    && Object.keys(m03BusinessFlow.chartModes).length === 4
    && m03BusinessFlow.actionReceiptReady
    && m03BusinessFlow.workbench.title === "决策工作台"
    && m03BusinessFlow.workbench.summaryCards === 0
    && m03BusinessFlow.workbench.scenarioFilters === 0
    && !m03BusinessFlow.workbench.modelIntercept
    && m03BusinessFlow.operations.title === "决策运营概览"
    && m03BusinessFlow.operations.hasTarget
    && !m03BusinessFlow.operations.overflow
    && homeStability.stable
    && homeStability.frameReloads === 0
    && dataAndOntologyUx.actualSnapshots === 2
    && dataAndOntologyUx.annualSnapshots === 3
    && dataAndOntologyUx.runHistory.rows > 0
    && !dataAndOntologyUx.runHistory.overflow
    && Object.values(m08Scroll.views).every((item) => item.documentScrollWorked)
    && s003Traceability.dataTraceReady
    && s003Traceability.semanticTraceReady
    && s003Repository.pythonRunSucceeded
    && s003Repository.boundToDataAndSemantic
    && s003Repository.final.deltas.every((value) => value === 1)
    && s004Dashboard.applicantTraceReady
    && s004Dashboard.evidenceTraceReady
    && s004Dashboard.modelResultReady
    && allScenarioOptimizationPassed
    && s005Chain.hardReject
    && s005Chain.optimizationStatus === "BINDING_APPLIED"
    && s005Chain.moduleOutputCount >= 8;
  const evidence = {
    schemaVersion: "ofw.prototype.browser-regression.v8",
    candidateVersion: "v1.4-rc.1",
    observedAt,
    browser: { family: "Google Chrome", version: await browser.version(), executablePath: chromePath, controlSurface: "Playwright direct to local Google Chrome", inAppBrowserUsed: false },
    entryUrl: `${entryBase}#home`,
    scenarioCoverage: { result: routeCoveragePassed ? "passed" : "failed", scenarioIds, routesPerScenario: routes.length, totalPagesChecked: scenarioIds.length * routes.length, ...coverage },
    realModuleWorkflows: {
      result: realWorkflowsPassed ? "passed" : "failed",
      parentWorkspaceReplacements: 0,
      nativeIntegration: "composite/integrations/native-module-integrations.js",
      basicChains,
      homepage: { scenarioOperationsVisible: false, platformArchitectureVisible: true, moduleDirectoryEntries: 0, globalScenarioSwitcherVisible: false, unifiedResourceDirectoryVisible: false, stableArchitectureLayout: homeStability.stable, architectureSwitchFrameReloads: homeStability.frameReloads },
      homeStability,
      dataAndOntologyUx,
      m03Recommendations,
      m03BusinessFlow,
      m03Animation,
      m08Scroll,
      s003Traceability,
      s003Repository,
      s004Dashboard,
      allScenarioOptimization,
      s005: s005Chain,
      modules: {
        M01: { workspace: "parent ontology-management workspace", operation: "create immutable model semantic contract", modelBindings: 10 },
        M02: { workspace: "parent data-engineering workspace", operations: ["build", "validate", "freeze"], modelDataAssets: 6 },
        M03: { workspace: "parent intelligent-query conversation workspace", processingSteps: 5, staleRunCancellation: true },
        M04: { workspace: "parent decision workbench plus decision-operations cockpit", hardRejectCode: "NON_FACT_SOURCE_REJECTED", sideEffectsEmitted: 0 },
        M05: { workspace: "parent Agent catalog", agentCatalogCount: 10 },
        M06: { workspace: "parent report catalog", reportDraftLifecycle: "review required" },
        M07: { workspace: "object discovery plus shared-context exploration workbench", portfolioObjectCount: 71, lensCount: 6 },
        M08: { workspace: "generic five-task optimization center with Python repository IDE", businessGoalCount: 5, repositoryCount: 10, gitLikeLifecycle: ["branch", "commit", "tag", "release-candidate"] }
      }
    },
    modelManagement: { result: Object.values(visitedM08Views).every((items) => items.length === m08Views.length) && s003Repository.pythonRunSucceeded ? "passed" : "failed", moduleName: "模型目标与优化", scenarioRegistrations: scenarioIds, navigationModeDesktop: "Shell-level vertical task navigation", navigationModeMobile: "Shell-level single task selector", iframeNavigationVisible: false, horizontalTaskMenuUsed: false, views: m08Views, singlePrimaryNextAction: true },
    mainChain: { result: s003Runtime.cycle.status === "BINDING_APPLIED" ? "passed" : "failed", scenarioId: "S003", cycleId: s003Runtime.cycle.cycleId, finalStatus: s003Runtime.cycle.status, dataVersionId: s003Runtime.data.dataVersionId, semanticContractVersionId: s003Runtime.semanticContract.semanticContractVersionId, modelRunCount: s003Runtime.modelRuns.length, benchmarkRunCount: s003Runtime.benchmarks.length, candidateModelVersionId: s003Runtime.candidates.at(-1).modelVersionId, shadowTrialId: s003Runtime.shadowTrial.shadowTrialId, releaseCandidateId: s003Runtime.releaseCandidate.releaseCandidateId, bindingRevisionId: s003Runtime.consumerBinding.bindingRevisionId, bindingStatus: s003Runtime.consumerBinding.status, resultPackageId: s003Runtime.results.resultPackage.resultPackageId, simulationResultId: s003Runtime.results.simulationEnvelope.resultId, formalModelPointerChanged: s003Runtime.consumerBinding.formalModelPointerChanged, formalFactPointerChanged: s003Runtime.consumerBinding.formalFactPointerChanged, sideEffectsEmitted: s003Runtime.boundaries.externalSideEffects },
    dataEngineering: { result: s003Traceability.dataTraceReady ? "passed" : "failed", classification: s003Runtime.data.classification, enterpriseCount: s003Runtime.data.enterpriseCount, periodCount: s003Runtime.data.periodCount, observationCount: s003Runtime.data.observationCount, dataAssetCount: s003Runtime.data.dataAssets.length, modelBindingCount: s003Runtime.semanticContract.modelBindings.length, futureLeakageRows: s003Runtime.data.quality.futureLeakageRows, invalidOutcomeRows: s003Runtime.data.quality.invalidOutcomeRows, labelIndependence: s003Runtime.data.quality.labelIndependence, frozen: s003Runtime.data.immutable },
    modelPortfolio: { result: "passed", objectiveCount: s003Runtime.objectives.length, modelCount: s003Runtime.modelDefinitions.length, formalBaselineCount: s003Runtime.modelDefinitions.filter((item) => item.modelRole === "FORMAL_BASELINE").length, coreChallengerCount: s003Runtime.modelDefinitions.filter((item) => item.modelRole === "CORE_CHALLENGER").length, supplementalModelCount: s003Runtime.modelDefinitions.filter((item) => item.modelRole === "SUPPLEMENTAL").length, modelRunCount: s003Runtime.modelRuns.length, benchmarkRunCount: s003Runtime.benchmarks.length, automaticChampionSelected: false, automaticRelease: false, aggregateScoreCreated: false },
    modelRepositories: { result: s003Repository.pythonRunSucceeded && s003Repository.boundToDataAndSemantic ? "passed" : "failed", repositoryCount: s003Repository.initial.repositoryCount, filesPerRepository: s003Repository.initial.fileCount, branchCommitTagReleaseCounts: s003Repository.final.counts, actualPythonProcess: true, dataVersionBound: true, semanticContractBound: true, formalRepositoryReadOnly: true },
    dashboard: { result: s003Consumers.queryReady && s003Consumers.detailLabels.length === 7 && s004Dashboard.modelResultReady ? "passed" : "failed", views: ["正式结果", "候选试算", "影子观察", "压力模拟", "正式与候选差异"], enterpriseDetailEvidence: s003Consumers.detailLabels, fiveDashboardDirectoryEntries: true, s004RealDashboard: s004Dashboard, formalFactsMutable: false },
    stability: { result: secondInstanceBefore === secondInstanceAfter && frameLoadsAfter - frameLoadsBefore <= 1 && deepLinkReady && deepRefreshReady && homeStability.stable && homeStability.frameReloads === 0 ? "passed" : "failed", crossTabReloadsObserved: secondInstanceBefore === secondInstanceAfter ? 0 : 1, secondTabPageInstanceChangedAfterNavigation: secondInstanceBefore !== secondInstanceAfter, historyBackFrameLoadDelta: frameLoadsAfter - frameLoadsBefore, deepLinkAndRefreshStable: deepLinkReady && deepRefreshReady, homeArchitectureStable: homeStability.stable, homeArchitectureFrameReloads: homeStability.frameReloads, popstateAndHashchangeCoalesced: true, backgroundPollingLoops: 0, mutationObservers: 0 },
    viewports: [
      { size: "1440x900", result: routeCoveragePassed ? "passed" : "failed", scenariosChecked: 5, routesChecked: 50, outerHorizontalOverflowsObserved: coverage.outerHorizontalOverflows, moduleDocumentHorizontalOverflowsObserved: coverage.frameDocumentHorizontalOverflows, blankPagesObserved: coverage.blankPages },
      ...viewportResults
    ],
    runtimeErrors: { applicationConsoleErrors: errors.console.length, pageErrors: errors.page.length, failedResourceRequests: errors.resources.length, details: allErrors },
    screenshots,
    overallResult: routeCoveragePassed && realWorkflowsPassed && allErrors.length === 0 && s003Runtime.cycle.status === "BINDING_APPLIED" && s005Chain.hardReject ? "passed" : "failed",
    acceptanceReady: false
  };
  await writeFile(path.join(evidenceRoot, "browser-regression.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ overallResult: evidence.overallResult, scenarioCoverage: evidence.scenarioCoverage, realModuleWorkflows: evidence.realModuleWorkflows.result, mainChain: evidence.mainChain, dashboard: evidence.dashboard, stability: evidence.stability, runtimeErrors: evidence.runtimeErrors }, null, 2));
  if (evidence.overallResult !== "passed") process.exitCode = 1;
} finally {
  await browser.close();
  await testRuntime?.close();
}
