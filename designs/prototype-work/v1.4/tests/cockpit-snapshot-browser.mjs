import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const output = process.env.OFW_FIX_OUTPUT ? new URL("cockpit-snapshot-browser/", new URL(process.env.OFW_FIX_OUTPUT)) : new URL("../artifacts/cockpit-snapshots/", import.meta.url);
await mkdir(output, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const entry = `${runtime.url}/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html`;
async function frame() {
  const element = await page.locator("#module-frame").elementHandle();
  const f = await element.contentFrame();
  await f.waitForFunction(() => document.body?.innerText.length > 30);
  return f;
}
async function go(id) {
  await page
    .locator(
      `[data-primary-nav][data-route="${id === "dashboard" ? "#dashboard" : "#module/" + id}"]`,
    )
    .click();
  return frame();
}
async function task(id, module) {
  const select = page.locator(`[data-module-task-select="${module}"]`);
  if (await select.isVisible()) await select.selectOption(id);
  else
    await page
      .locator(`[data-module-task="${id}"][data-module-id="${module}"]`)
      .click();
  return frame();
}
async function assets() {
  await go("data");
  const f = await task("resources", "data");
  await f.locator('[data-snapshot-record="asset-v14-loans"]').waitFor();
  return f;
}
async function open(f, id) {
  await f
    .locator(`[data-snapshot-action="open"][data-id="${id}"]`)
    .first()
    .click();
  await f.locator(".snapshot-notice").waitFor();
}
const act = (f, name) =>
  f.locator(`[data-snapshot-action="${name}"]`).first().click();
const tab = (f, name) =>
  f.locator(`[data-snapshot-action="tab"][data-tab="${name}"]`).click();
const close = (f) =>
  f.locator('.ofw-native-drawer > header [aria-label="关闭"]').click();
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
async function shot(name) {
  await page.waitForTimeout(280);
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", output)),
  });
}
try {
  await page.goto(entry + "?task=situation#module/m07");
  await check(
    "Old situation deep links migrate to the business cockpit",
    async () => {
      await page.waitForFunction(() => location.hash === "#dashboard");
      const f = await frame();
      await f.waitForSelector("#global-map[data-map-ready=true]");
      assert.equal(
        await page
          .locator("[data-module-task=situation][data-module-id=dashboard]")
          .count(),
        1,
      );
      await go("m07");
      assert.equal(
        await page.locator("[data-module-task=situation]").count(),
        0,
      );
      const d = await assets();
      assert.equal(
        await page.locator("[data-module-task=joint-data]").count(),
        0,
      );
      assert.equal(
        await d.locator('[data-snapshot-record^="asset-v14-"]').count(),
        9,
      );
    },
  );
  await check(
    "Cockpit directory opens the interactive map; original five business views remain",
    async () => {
      await go("dashboard");
      let f = await task("directory", "dashboard");
      await f.locator("[data-action=joint-situation]").click();
      await page.locator('#module-frame[src*="workbench.html"]').waitFor();
      f = await frame();
      await f.waitForSelector("#global-map[data-map-ready=true]");
      assert.ok(await page.locator("[data-module-task=financing]").count());
      assert.ok(await page.locator("[data-module-task=risk]").count());
      await shot("01-cockpit-map");
    },
  );
  await check(
    "Original asset directory supports card/list views, search and complete source registration",
    async () => {
      const f = await assets();
      await f.locator("[data-action=asset-view][data-value=cards]").click();
      await f
        .locator('.asset-card[data-snapshot-record="asset-v14-loans"]')
        .waitFor();
      assert.equal(
        await f.locator(".asset-card[data-snapshot-record]").count(),
        9,
      );
      await f.locator('[aria-label="搜索数据资产"]').fill("融资合同");
      assert.equal(await f.locator(".asset-card:visible").count(), 1);
      await shot("02-existing-asset-directory");
      await f.locator('[aria-label="搜索数据资产"]').fill("不存在的资产");
      assert.equal(await f.locator(".asset-card:visible").count(), 0);
      await f.locator('[aria-label="搜索数据资产"]').fill("");
      await f.locator("[data-action=asset-view][data-value=list]").click();
      await f
        .locator(
          '.asset-resource-table [data-snapshot-record="asset-v14-loans"]',
        )
        .waitFor();
      await f.locator("[data-action=source-view][data-value=cards]").click();
      await f
        .locator('[data-snapshot-record="source-v14-finance-risk"]')
        .waitFor();
    },
  );
  await check(
    "Asset drilldown includes all records, field definitions, search and pagination",
    async () => {
      const f = await frame();
      await open(f, "asset-v14-loans");
      await tab(f, "data");
      await f.locator('[aria-label="筛选快照记录"]').waitFor();
      assert.match(
        await f.locator(".snapshot-pagination").innerText(),
        /84 \/ 84/,
      );
      assert.equal(
        await f.locator(".snapshot-table").last().locator("tbody tr").count(),
        20,
      );
      await act(f, "next");
      assert.match(
        await f.locator(".snapshot-pagination").innerText(),
        /第 2 \/ 5/,
      );
      await f.locator('[aria-label="筛选快照记录"]').fill("ENT-020");
      await f.locator("[data-snapshot-search] button").click();
      assert.match(
        await f.locator(".snapshot-pagination").innerText(),
        /4 \/ 84/,
      );
      await f.locator(".snapshot-fields summary").click();
      assert.equal(await f.locator(".snapshot-fields tbody tr").count(), 12);
      await shot("03-snapshot-records");
    },
  );
  await check(
    "Downloaded Excel bytes exactly match the displayed snapshot identity",
    async () => {
      const f = await frame();
      await tab(f, "snapshots");
      await shot("04-snapshot-identity");
      const pending = page.waitForEvent("download");
      await act(f, "download");
      const download = await pending;
      const path = fileURLToPath(new URL("downloaded-snapshot.xlsx", output));
      await download.saveAs(path);
      const c = await page.evaluate(() => OFW_V14_SNAPSHOT_CATALOG);
      const bytes = await readFile(path);
      assert.equal(bytes.length, c.file.sizeBytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        c.file.sha256,
      );
      assert.equal(download.suggestedFilename(), c.file.name);
      await f
        .locator(".snapshot-download-status")
        .filter({ hasText: "下载已发起" })
        .waitFor();
    },
  );
  await check(
    "HTTP failure and checksum mismatch block download and allow retry",
    async () => {
      const f = await frame(),
        url = await page.evaluate(() => OFW_V14_SNAPSHOT_CATALOG.file.url);
      await page.route("**" + url, (route) =>
        route.fulfill({ status: 503, body: "unavailable" }),
      );
      await act(f, "download");
      await f.locator(".snapshot-error").filter({ hasText: "503" }).waitFor();
      await page.unroute("**" + url);
      await page.route("**" + url, async (route) => {
        const response = await route.fetch();
        const body = await response.body();
        body[100] ^= 1;
        return route.fulfill({ response, body });
      });
      await act(f, "download");
      await f
        .locator(".snapshot-error")
        .filter({ hasText: "指纹不一致" })
        .waitFor();
      await page.unroute("**" + url);
      const pending = page.waitForEvent("download");
      await act(f, "download");
      await pending;
      await f
        .locator(".snapshot-download-status")
        .filter({ hasText: "下载已发起" })
        .waitFor();
    },
  );
  await check(
    "Source snapshot contains all nine members and traceable asset relationships",
    async () => {
      const f = await frame();
      await act(f, "source");
      await tab(f, "data");
      assert.equal(await f.locator(".snapshot-member").count(), 9);
      await f.locator('.snapshot-member[data-id="asset-v14-loans"]').click();
      await tab(f, "lineage");
      assert.equal(await f.locator(".snapshot-member").count(), 3);
      await f.locator('.snapshot-member[data-id="asset-v14-banks"]').click();
      assert.match(
        await f.locator(".ofw-native-drawer > header h2").innerText(),
        /金融机构/,
      );
      await close(f);
      await page.reload();
      const restored = await frame();
      await restored
        .locator('[data-snapshot-record="asset-v14-loans"]')
        .waitFor();
      assert.equal(await restored.locator(".snapshot-notice").count(), 0);
    },
  );
  await check(
    "Snapshot detail survives reload and returns to the cockpit with matching data digest",
    async () => {
      let f = await frame();
      await open(f, "asset-v14-loans");
      await tab(f, "snapshots");
      await page.reload();
      f = await frame();
      await f.locator(".snapshot-notice").waitFor();
      assert.match(
        await f.locator(".ofw-native-drawer > header h2").innerText(),
        /融资合同台账/,
      );
      const digest = await page.evaluate(
        () => OFW_V14_SNAPSHOT_CATALOG.dataDigest,
      );
      await act(f, "situation");
      await page.waitForFunction(() => location.hash === "#dashboard");
      f = await frame();
      await f.waitForSelector("#global-map[data-map-ready=true]");
      assert.equal(
        await f.evaluate(() => __OFW_V14__.getDataset().digest),
        digest,
      );
    },
  );
  await check(
    "Map report returns to the cockpit rather than the former M07 situation task",
    async () => {
      let f = await frame();
      await f.locator("[data-action=create-report]").click();
      await f.locator("[data-action=native-report]").click();
      await page.waitForFunction(() => location.hash === "#module/report");
      f = await frame();
      await f.locator("[data-ofw-native-action=report-open]").first().click();
      await f.locator("[data-ofw-report-action=source]").first().click();
      await page.waitForFunction(() => location.hash === "#dashboard");
      f = await frame();
      await f.waitForSelector("#global-map[data-map-ready=true]");
    },
  );
  await check(
    "Mobile asset details, pagination and download controls remain accessible",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      const f = await assets();
      await open(f, "asset-v14-facilities");
      await tab(f, "data");
      await f.locator('[aria-label="筛选快照记录"]').waitFor();
      assert.ok(
        await f.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const box = await f.locator(".ofw-native-drawer").boundingBox();
      assert.ok(box.width <= 390);
      await page.waitForTimeout(500);
      await f
        .locator(".ofw-native-drawer-body")
        .evaluate((node) => (node.scrollTop = node.scrollHeight));
      assert.ok(
        await f
          .locator(".ofw-native-drawer-body")
          .evaluate(
            (node) =>
              Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop) <
              2,
          ),
      );
      await shot("05-mobile-snapshot");
      const pagination = await f.locator(".snapshot-pagination").boundingBox(),
        footer = await f.locator(".ofw-native-drawer > footer").boundingBox();
      assert.ok(
        pagination.y + pagination.height <= footer.y + 1,
        "pagination must remain reachable above footer",
      );
      await f.locator("body").press("Escape");
      assert.equal(await f.locator(".snapshot-notice").count(), 0);
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("result.json", output),
    JSON.stringify(
      {
        status: "passed",
        checks,
        errors,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await rm(new URL("failure.png", output), { force: true });
  await rm(new URL("failure.json", output), { force: true });
} catch (error) {
  await shot("failure");
  await writeFile(
    new URL("failure.json", output),
    JSON.stringify({ error: error.stack, checks, errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
