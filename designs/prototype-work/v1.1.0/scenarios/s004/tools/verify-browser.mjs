import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.resolve(__dirname, "..");
const evidenceDir = path.join(scenarioDir, "evidence", "browser");
const baseUrl = "http://127.0.0.1:4334/scenarios/s004/";

await fs.mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});

const consoleEvents = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    consoleEvents.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => consoleEvents.push({ type: "pageerror", text: error.message }));

const routeChecks = [
  ["#home", ["S004", "v1.0.3", "财务公司贷款贷前调查"]],
  ["#flow", ["S004 最小完整闭环", "人工复核", "同源 HTML/PDF"]],
  ["#module/data", ["数据工程", "official-public", "synthetic-demo"]],
  ["#module/ontology", ["Published", "C008", "Metric"]],
  ["#module/query", ["NOT_APPLICABLE", "不纳入本场景一期"]],
  ["#module/decision", ["Action Request", "未提交", "待办"]],
  ["#module/agent", ["固定证据包", "结构化草稿", "伴读"]],
  ["#module/report", ["S004-PLR-2026-0001", "人工", "HTML"]],
  ["#checkpoints", ["端到端联调完成", "高风险修改前保护点", "克隆恢复"]],
  ["#evidence", ["证据与稳定身份", "M01", "M06"]]
];

const results = [];
for (const [hash, expectedTexts] of routeChecks) {
  const response = await page.goto(`${baseUrl}index.html${hash}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#app");
  const snapshot = await page.evaluate(() => ({
    text: document.body.innerText,
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    title: document.title
  }));
  const missing = expectedTexts.filter((text) => !snapshot.text.includes(text));
  const overflow = snapshot.width - snapshot.clientWidth;
  results.push({ hash, status: response?.status(), missing, overflow, title: snapshot.title });
  if (missing.length) throw new Error(`${hash} 缺少文本: ${missing.join(", ")}`);
  if (overflow > 1) throw new Error(`${hash} 桌面横向溢出 ${overflow}px`);
}

await page.goto(`${baseUrl}index.html#home`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(evidenceDir, "s004-home-1440x900.png"), fullPage: true });

const desktop1280 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await desktop1280.goto(`${baseUrl}index.html#module/report`, { waitUntil: "networkidle" });
const desktop1280Overflow = await desktop1280.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (desktop1280Overflow > 1) throw new Error(`1280px 报告页横向溢出 ${desktop1280Overflow}px`);
await desktop1280.screenshot({ path: path.join(evidenceDir, "s004-report-1280x720.png"), fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto(`${baseUrl}index.html#home`, { waitUntil: "networkidle" });
const mobileSnapshot = await mobile.evaluate(() => ({
  text: document.body.innerText,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  navCollapsed: document.querySelector(".app-shell")?.classList.contains("nav-collapsed") || false
}));
if (!mobileSnapshot.text.includes("S004")) throw new Error("390px 首页未加载 S004");
if (mobileSnapshot.overflow > 1) throw new Error(`390px 首页横向溢出 ${mobileSnapshot.overflow}px`);
await mobile.screenshot({ path: path.join(evidenceDir, "s004-home-390x844.png"), fullPage: true });

const reportPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const reportResponse = await reportPage.goto(`${baseUrl}artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.html`, { waitUntil: "networkidle" });
const reportCheck = await reportPage.evaluate(() => ({
  title: document.title,
  reportNumber: document.body.innerText.includes("S004-PLR-2026-0001"),
  contentVersion: document.body.innerText.includes("1.0.1"),
  anchors: Array.from(document.querySelectorAll("[data-anchor]")).map((node) => node.getAttribute("data-anchor")),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
}));
if (reportResponse?.status() !== 200 || !reportCheck.reportNumber || !reportCheck.contentVersion) {
  throw new Error("受控 HTML v1.0.1 加载或身份校验失败");
}
for (const anchor of [
  "sec-01-borrower-evaluation",
  "sec-02-operations",
  "sec-03-financial",
  "sec-04-risk",
  "sec-05-credit-conclusion",
  "sec-06-data-sources"
]) {
  if (!reportCheck.anchors.includes(anchor)) throw new Error(`受控 HTML 缺少稳定锚点 ${anchor}`);
}
await reportPage.screenshot({ path: path.join(evidenceDir, "s004-controlled-html-v1.0.1.png"), fullPage: false });

const pdfResponse = await page.request.get(`${baseUrl}artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf`);
if (pdfResponse.status() !== 200) throw new Error(`PDF HTTP 状态 ${pdfResponse.status()}`);
const pdfBytes = await pdfResponse.body();
if (pdfBytes.length < 100000) throw new Error(`PDF 文件异常偏小: ${pdfBytes.length}`);

if (consoleEvents.length) {
  throw new Error(`浏览器控制台存在错误或警告: ${JSON.stringify(consoleEvents)}`);
}

const verification = {
  schemaVersion: "ofw.s004.browser-verification.v1",
  verifiedAt: "2026-08-15T13:45:00.000Z",
  baseUrl,
  routes: results,
  viewports: {
    desktop1440: "PASS",
    desktop1280: desktop1280Overflow <= 1 ? "PASS" : "FAIL",
    mobile390: mobileSnapshot.overflow <= 1 ? "PASS" : "FAIL"
  },
  formalOutputs: {
    html: reportCheck,
    pdfStatus: pdfResponse.status(),
    pdfBytes: pdfBytes.length
  },
  consoleEvents,
  status: "PASS"
};

await fs.writeFile(path.join(evidenceDir, "browser-verification.json"), `${JSON.stringify(verification, null, 2)}\n`, "utf8");
await browser.close();
console.log(JSON.stringify(verification, null, 2));
