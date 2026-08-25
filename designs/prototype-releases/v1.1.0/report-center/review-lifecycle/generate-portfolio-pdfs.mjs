import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.OFW_REPORT_BASE_URL || "http://127.0.0.1:4340";
const outputDirectory = path.join(here, "portfolio-assets/pdf");
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const sources = [
  { source: "report-center/review-lifecycle/portfolio-assets/s001-financing-report.html", output: path.join(outputDirectory, "s001-financing-report.pdf") },
  { source: "report-center/review-lifecycle/portfolio-assets/s002-budget-report.html", output: path.join(outputDirectory, "s002-budget-report.pdf") },
  ...fs.readdirSync(path.join(here, "portfolio-assets/s003"))
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => ({ source: `report-center/review-lifecycle/portfolio-assets/s003/${name}`, output: path.join(outputDirectory, name.replace(/\.html$/, ".pdf")) })),
  { source: "scenarios/s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.html", output: path.join(root, "scenarios/s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.pdf") }
];

fs.mkdirSync(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chrome });
for (const item of sources) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/${item.source}`, { waitUntil: "networkidle" });
  await page.pdf({ path: item.output, format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.close();
  if (!fs.existsSync(item.output) || fs.statSync(item.output).size < 1000) throw new Error(`PDF generation failed for ${item.source}`);
  console.log(`${path.basename(item.output)} ${fs.statSync(item.output).size}`);
}

await browser.close();
console.log(`Generated ${sources.length} report PDFs.`);
