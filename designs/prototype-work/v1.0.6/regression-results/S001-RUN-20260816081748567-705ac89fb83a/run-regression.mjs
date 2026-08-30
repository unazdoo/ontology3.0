import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.dirname(fileURLToPath(import.meta.url));
const candidateRoot = path.resolve(root, "../..");
const version = JSON.parse(await fs.readFile(path.join(candidateRoot, "VERSION.json"), "utf8"));
const base = process.env.BASE_URL || "http://127.0.0.1:4328";
const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 }
];

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Users/domi/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell"
});
const results = [];

async function moduleFrame(page, moduleId, urlPart) {
  await page.goto(`${base}/s001-e2e-integration/index.html#module/${moduleId}`, { waitUntil: "domcontentloaded" });
  const handle = await page.waitForSelector("#module-frame");
  const frame = await handle.contentFrame();
  await frame.waitForURL(url => url.toString().includes(urlPart), { timeout: 15000 });
  await frame.waitForLoadState("domcontentloaded");
  await frame.waitForTimeout(700);
  return frame;
}

async function readJsonFromStorage(frame, key) {
  return frame.evaluate((storageKey) => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch (_) { return null; }
  }, key);
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));

  await page.goto(`${base}/open-completed-run.html`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/s001-e2e-integration\/.*#home$/, { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes("15/15"), null, { timeout: 15000 });
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const moduleEntryCount = await page.getByRole("navigation", { name: "一级导航" }).getByRole("button").count();

  const dataFrame = await moduleFrame(page, "data", "data-engineering-prototype-review");
  await dataFrame.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem("ontology3.data-engineering.workspace.v5-handoff") || "null");
    const projection = JSON.parse(localStorage.getItem("ontology3.c017.report-center.projection.v1") || "null");
    return state?.t019Status === "已采用" && projection?.projections?.some?.(item => item.allowConsumption === true);
  }, null, { timeout: 15000 });
  const beforeDataReload = await dataFrame.evaluate(() => ({
    t019Status: JSON.parse(localStorage.getItem("ontology3.data-engineering.workspace.v5-handoff") || "null")?.t019Status,
    reportReady: JSON.parse(localStorage.getItem("ontology3.c017.report-center.projection.v1") || "null")?.projections?.some?.(item => item.allowConsumption === true)
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  const dataHandleReloaded = await page.waitForSelector("#module-frame");
  const dataFrameReloaded = await dataHandleReloaded.contentFrame();
  await dataFrameReloaded.waitForFunction(() => JSON.parse(localStorage.getItem("ontology3.c017.report-center.projection.v1") || "null")?.projections?.some?.(item => item.allowConsumption === true), null, { timeout: 15000 });
  const afterDataReload = await dataFrameReloaded.evaluate(() => ({
    t019Status: JSON.parse(localStorage.getItem("ontology3.data-engineering.workspace.v5-handoff") || "null")?.t019Status,
    reportReady: JSON.parse(localStorage.getItem("ontology3.c017.report-center.projection.v1") || "null")?.projections?.some?.(item => item.allowConsumption === true)
  }));

  const queryFrame = await moduleFrame(page, "query", "intelligent-query-prototype");
  await queryFrame.waitForTimeout(900);
  const queryText = await queryFrame.locator("body").innerText();
  const queryState = await readJsonFromStorage(queryFrame, "ontology3.iq.review.conversation.v1");
  const queryConfigReady = queryState?.activeConfig?.status === "已启用" && queryState?.activeConfig?.compatibility === "兼容";
  const queryHasSuccessfulRun = (queryState?.liveRuns || []).some((run) => run?.status === "成功");

  const ontologyFrame = await moduleFrame(page, "ontology", "ontology-management-review");
  await ontologyFrame.getByRole("button", { name: "在画布中查看", exact: true }).click();
  await ontologyFrame.waitForSelector(".published-canvas-scroll", { timeout: 12000 });
  const zoomBefore = await ontologyFrame.locator(".published-canvas-zoom b").innerText();
  await ontologyFrame.locator(".published-canvas-scroll").evaluate(el => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
  });
  await ontologyFrame.waitForTimeout(200);
  const zoomAfter = await ontologyFrame.locator(".published-canvas-zoom b").innerText();

  await page.goto(`${base}/s001-e2e-integration/index.html#dashboard`, { waitUntil: "domcontentloaded" });
  const dashboardHandle = await page.waitForSelector("#module-frame");
  const dashboardFrame = await dashboardHandle.contentFrame();
  await dashboardFrame.waitForURL(url => url.toString().includes("report-center"), { timeout: 15000 });
  await dashboardFrame.waitForTimeout(1200);
  const openDashboard = dashboardFrame.getByRole("button", { name: "打开驾驶舱", exact: true });
  if (await openDashboard.count()) {
    await openDashboard.evaluate((element) => element.click());
    await dashboardFrame.waitForFunction(() => document.body.innerText.includes("仪表盘版本") || document.body.innerText.includes("当前业务分析暂不可用"), null, { timeout: 12000 });
  }
  const dashboardText = await dashboardFrame.locator("body").innerText();

  const decisionFrame = await moduleFrame(page, "decision", "decision-center-prototype");
  const decisionState = await readJsonFromStorage(decisionFrame, "ontology3-decision-center-review-v2-portfolio-state-v6");
  const taskId = decisionState?.tasks?.[0]?.id || null;
  if (taskId) await decisionFrame.evaluate((id) => { location.hash = `#task/${id}`; }, taskId);
  await decisionFrame.waitForTimeout(900);
  const decisionText = await decisionFrame.locator("body").innerText();
  const activeDecisionRequest = (decisionState?.requests || []).find((request) => request?.taskId === taskId) || null;
  const bankNames = [...new Set([
    ...(activeDecisionRequest?.decision?.banks || []),
    ...((decisionState?.tasks || []).find((task) => task?.id === taskId)?.banks || [])
  ].map((bank) => typeof bank === "string" ? bank : bank?.name).filter(Boolean))];

  const agentFrame = await moduleFrame(page, "agent", "agent-application");
  const agentText = await agentFrame.locator("body").innerText();

  const reportFrame = await moduleFrame(page, "report", "report-center");
  await reportFrame.waitForSelector(".report-chart", { timeout: 12000 });
  const reportQa = reportFrame.getByRole("button", { name: "报告问答", exact: true });
  if (await reportQa.count()) {
    await reportQa.evaluate((element) => element.click());
    await reportFrame.waitForFunction(() => document.body.innerText.includes("当前上下文"), null, { timeout: 12000 });
  }
  const rereadAgent = reportFrame.getByRole("button", { name: "重新读取 Agent 返回", exact: true });
  if (await rereadAgent.count()) {
    await rereadAgent.evaluate((element) => element.click());
    await reportFrame.waitForFunction(() => {
      const text = document.body.innerText;
      return /RUN-20260816-004|RES-20260816-004|RSESSION-20260816-002/.test(text) || text.includes("Agent 记录不可定位");
    }, null, { timeout: 12000 });
  }
  const reportText = await reportFrame.locator("body").innerText();
  const chartLayout = await reportFrame.locator(".report-chart").evaluate(chart => {
    const title = chart.querySelector("h4").getBoundingClientRect();
    const bars = [...chart.querySelectorAll(".report-bar-fill")].map(el => el.getBoundingClientRect());
    const content = chart.querySelector(":scope > div")?.getBoundingClientRect() || null;
    return {
      barCount: bars.length,
      emptyState: chart.classList.contains("report-chart-empty"),
      overlap: bars.length ? bars.some(bar => bar.top < title.bottom) : Boolean(content && content.top < title.bottom),
      titleBottom: title.bottom,
      minBarTop: bars.length ? Math.min(...bars.map(bar => bar.top)) : null,
      contentTop: content?.top ?? null
    };
  });
  const reportOverflow = await reportFrame.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await reportFrame.locator(".report-chart").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(root, `report-${viewport.name}.png`), fullPage: false });
  await reportFrame.evaluate(() => { location.hash = "/reports?tab=definitions"; });
  await reportFrame.waitForFunction(() => document.body.innerText.includes("集团融资经营分析报告") && document.body.innerText.includes("报告定义"), null, { timeout: 12000 });
  const definitionRow = reportFrame.locator(".resource-row").filter({ hasText: "集团融资经营分析报告" }).first();
  await definitionRow.getByRole("button", { name: "查看详情", exact: true }).evaluate((element) => element.click());
  await reportFrame.waitForSelector(".drawer", { timeout: 12000 });
  const templateDownload = reportFrame.getByRole("link", { name: "下载模板", exact: true });
  const templateView = reportFrame.getByRole("link", { name: "查看模板", exact: true });
  const templateHref = await templateDownload.getAttribute("href");
  const templateDownloadName = await templateDownload.getAttribute("download");
  const templateFileCheck = await reportFrame.evaluate(async (href) => {
    if (!href) return { ok: false, chapters: false, title: false };
    const response = await fetch(href, { cache: "no-store" });
    const html = response.ok ? await response.text() : "";
    const chapters = ["经营概览", "融资成本", "债务结构", "重点单位与机构", "规则发现", "证据与限制"];
    return {
      ok: response.ok,
      chapters: chapters.every((chapter) => html.includes(chapter)),
      title: html.includes("集团融资成本与债务结构分析报告")
    };
  }, templateHref);
  const templateDownloadReady = await templateDownload.count() === 1
    && await templateView.count() === 1
    && templateHref === "templates/s001-financing-report-template.html"
    && templateDownloadName === "S001-集团融资成本与债务结构分析报告模板-v2.2.0.html"
    && templateFileCheck.ok && templateFileCheck.chapters && templateFileCheck.title;

  results.push({
    viewport: viewport.name,
    homeOverflow,
    reportOverflow,
    moduleEntryCount,
    dataRefresh: { before: beforeDataReload, after: afterDataReload },
    queryReady: queryConfigReady && queryHasSuccessfulRun && !queryText.includes("当前数据暂不可用于正式问数"),
    ontologyZoom: { before: zoomBefore, after: zoomAfter, changed: zoomBefore !== zoomAfter },
    dashboardReady: dashboardText.includes("仪表盘版本 1.2.0") && dashboardText.includes("核心指标") && !dashboardText.includes("当前业务分析暂不可用"),
    decisionBanksReady: bankNames.length >= 3 && bankNames.every((name) => decisionText.includes(name)) && !decisionText.includes("尚不能核对优先协商银行"),
    agentReady: /Agent|伴读|运行/.test(agentText),
    reportAgentReady: reportText.includes("Agent 应用只读返回") && /RUN-20260816-004/.test(reportText) && /RES-20260816-004/.test(reportText) && /RSESSION-20260816-002/.test(reportText) && !reportText.includes("记录不可定位"),
    templateDownloadReady,
    chartLayout,
    textSamples: { query: queryText.slice(0, 900), dashboard: dashboardText.slice(0, 900), decision: decisionText.slice(0, 1200) },
    consoleErrors: errors
  });
  await context.close();
}

await browser.close();
const pageCountPerViewport = 8;
const passed = results.length === viewports.length && results.every(item => !item.homeOverflow && !item.reportOverflow && item.moduleEntryCount >= 6 && item.dataRefresh.after.reportReady && item.queryReady && item.ontologyZoom.changed && item.dashboardReady && item.decisionBanksReady && item.agentReady && item.reportAgentReady && item.templateDownloadReady && !item.chartLayout.overlap && item.consoleErrors.length === 0);
const output = { generatedAt: new Date().toISOString(), scenarioRunId: version.activeScenarioRunId, prototypeVersion: "1.0.5", passed, acceptanceReady: false, pageCountPerViewport, pageViewportCombinations: results.length * pageCountPerViewport, results };
await fs.writeFile(path.join(root, "targeted-regression.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!passed) process.exitCode = 1;
