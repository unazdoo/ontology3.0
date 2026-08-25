"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.S002_PLAYWRIGHT_MODULE || "playwright");

const scenarioRoot = path.resolve(__dirname, "..");
const evidenceRoot = path.join(scenarioRoot, "evidence", "dashboard-regression-20260817");
const baseUrl = process.env.S002_BASE_URL || "http://127.0.0.1:4332/scenarios/s002/index.html?delivery=cp07#dashboard";
const chromePath = process.env.S002_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "900x900", width: 900, height: 900 },
  { name: "390x844", width: 390, height: 844 },
];

const topics = ["cost", "project", "travel", "accrual", "concentration", "supplier"];
const canonicalWarnings = ["预算执行", "成本效率", "项目余额", "年末占用", "供应商价格", "申报合理性"];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function reportFrame(page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll("iframe")).some((frame) => frame.src.includes("review-lifecycle")), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes("review-lifecycle"));
  ensure(frame, "未找到M06报告中心场景适配页");
  await frame.waitForSelector(".dashboard-topic-tabs", { timeout: 15000 });
  return frame;
}

async function verifyTopic(frame, topic) {
  await frame.locator(`[data-action="set-dashboard-tab"][data-tab="${topic}"]`).click();
  await frame.waitForTimeout(120);
  const toggle = frame.locator(`[data-action="toggle-dashboard-row"][data-topic="${topic}"]`).first();
  ensure(await toggle.count(), `${topic}专题没有明细展开入口`);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await frame.waitForTimeout(80);
  ensure((await toggle.getAttribute("aria-expanded")) === "true", `${topic}专题未进入展开状态`);
  const detail = frame.locator(".dashboard-detail-row:visible").first();
  ensure(await detail.count(), `${topic}专题未显示行内明细`);
  ensure(await detail.locator("tbody tr").count(), `${topic}专题明细表没有业务记录`);
}

async function runViewport(browser, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const errors = [];
  const missing = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404) missing.push(response.url());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  const frame = await reportFrame(page);
  ensure(await frame.locator('[data-action="set-dashboard-tab"]').count() === 6, "六专题页签数量不正确");

  for (const topic of topics) await verifyTopic(frame, topic);

  await frame.locator('[data-action="set-dashboard-tab"][data-tab="travel"]').click();
  const travelText = await frame.locator(".page").innerText();
  ensure(travelText.includes("上期：2025实际"), "差旅专题未明确上期年度");
  ensure(travelText.includes("本期：2026初始申报"), "差旅专题未明确本期年度");
  ensure(travelText.includes("差旅费同比分析图例"), "差旅专题缺少简明预警图例");

  await frame.locator('[data-action="set-dashboard-tab"][data-tab="cost"]').click();
  const categories = await frame.locator('[data-action="set-dashboard-warning-type"]').allTextContents();
  for (const label of canonicalWarnings) ensure(categories.some((item) => item.includes(label)), `分类预警缺少：${label}`);
  for (const stale of ["预算覆盖不足", "年末占用集中", "供应商报价偏高"]) ensure(!categories.some((item) => item.includes(stale)), `分类预警仍显示旧名称：${stale}`);
  for (const label of canonicalWarnings) {
    const card = frame.locator(`[data-action="set-dashboard-warning-type"][data-warning-type="${label}"]`);
    await card.click();
    await frame.waitForTimeout(50);
    ensure(await frame.locator(".dashboard-rule-legend").count(), `${label}缺少用户可理解的判定图例`);
    const warningRowCount = await frame.locator(".dashboard-alert-summary-panel tbody tr.dashboard-summary-row").count();
    if (label === "供应商价格" && warningRowCount === 0) {
      const emptyText = await frame.locator(".dashboard-alert-summary-panel .empty-state").innerText();
      ensure(emptyText.includes("供应商价格没有命中记录"), "供应商严格>1.2无命中时未显示明确空状态");
    } else {
      ensure(warningRowCount, `${label}缺少具体预警数据`);
    }
  }

  await frame.locator('[data-action="set-dashboard-tab"][data-tab="supplier"]').click();
  const supplierText = await frame.locator(".page").innerText();
  for (const label of ["净额（万元）", "服务人月", "人月成本（元）", "最高/最低倍率", "等于1.2不命中"]) ensure(supplierText.includes(label), `供应商专题缺少：${label}`);

  await page.screenshot({ path: path.join(evidenceRoot, `dashboard-${viewport.name}.png`), fullPage: true });
  await page.close();
  return { viewport: viewport.name, errors, missing };
}

(async () => {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const results = [];
    for (const viewport of viewports) results.push(await runViewport(browser, viewport));
    fs.writeFileSync(path.join(evidenceRoot, "audit-results.json"), `${JSON.stringify({ baseUrl, results }, null, 2)}\n`);
    const allErrors = results.flatMap((item) => item.errors);
    const allMissing = results.flatMap((item) => item.missing);
    ensure(allErrors.length === 0, `浏览器控制台错误：${allErrors.join(" | ")}`);
    ensure(allMissing.length === 0, `发现404资源：${allMissing.join(" | ")}`);
    process.stdout.write(`${JSON.stringify({ ok: true, baseUrl, results }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
