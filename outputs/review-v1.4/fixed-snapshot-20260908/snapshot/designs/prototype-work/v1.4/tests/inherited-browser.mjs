import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const output = process.env.OFW_FIX_OUTPUT ? new URL("inherited-browser/", new URL(process.env.OFW_FIX_OUTPUT)) : new URL("../artifacts/inherited-platform/", import.meta.url);
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
page.setDefaultTimeout(14000);
const errors = [],
  failed = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.stack));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});
async function check(name, action) {
  await action();
  checks.push({ name, status: "passed" });
  console.log("PASS " + name);
}
const shot = async (name) => {
  await page.waitForTimeout(350);
  return page.screenshot({
    path: fileURLToPath(new URL(name + ".png", output)),
  });
};
async function frame() {
  await page.locator("#module-frame").waitFor();
  const f = await (
    await page.locator("#module-frame").elementHandle()
  ).contentFrame();
  await f.waitForFunction(() => document.body?.innerText.trim().length > 30);
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
async function task(id, moduleId) {
  const mobile = page.locator(`[data-module-task-select="${moduleId}"]`);
  if (await mobile.isVisible()) await mobile.selectOption(id);
  else
    await page
      .locator(`[data-module-id="${moduleId}"][data-module-task="${id}"]`)
      .click();
  return frame();
}
async function joint() {
  const f = await frame();
  await f.waitForFunction(() => Boolean(window.__OFW_V14__));
  return f;
}
async function readyMap(f) {
  await f.waitForSelector("#global-map[data-map-ready=true]");
  await f.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
}
const action = async (f, id) => {
  const target = f.locator(`[data-action="${id}"]`).first();
  if (
    !(await target.isVisible()) &&
    (await target
      .locator('xpath=ancestor::details[contains(@class,"workspace-actions")]')
      .count())
  )
    await f.locator(".workspace-actions > summary").click();
  await target.click();
};
try {
  await page.goto(runtime.url);
  await page.waitForSelector(".classic-home-frame");
  await check(
    "Default entry retains v1.3 home, brand, domain architecture and all original navigation",
    async () => {
      assert.match(page.url(), /v1\.4\/composite/);
      assert.equal(await page.locator("[data-primary-nav]").count(), 10);
      assert.equal(
        await page.locator('[data-action="home-domain"]').count(),
        3,
      );
      assert.equal(await page.locator("#workspace-context-chip").count(), 0);
      assert.equal(await page.locator(".brand-brain").count(), 1);
      await shot("01-inherited-home");
      await page
        .locator('[data-action="home-domain"][data-domain="action"]')
        .click();
      assert.ok(
        await page.locator('[data-entry-task="situation"]').isVisible(),
      );
      await shot("02-home-additive-entry");
    },
  );
  await check(
    "All 45 original resources are retained with nine snapshot assets and three analysis resources",
    async () => {
      const values = await page.evaluate(() => ({
        count: OFW_V131_CATALOG.resources.length,
        scenarios: OFW_V131_DATA.scenarios.map((item) => item.id),
        added: OFW_V14_JOINT.additions.map((item) => item.id),
      }));
      assert.equal(values.count, 57);
      assert.deepEqual(values.scenarios, [
        "S001",
        "S002",
        "S003",
        "S004",
        "S005",
      ]);
      assert.equal(values.added.length, 12);
      await page
        .getByRole("button", { name: "搜索业务资源", exact: true })
        .click();
      await page.locator("[data-catalog-search]").fill("企业主数据");
      await page.locator(".finder-result").first().click();
      await page.locator('[data-action="use-resource"]').click();
      const f = await frame();
      await f.locator(".snapshot-notice").waitFor();
      assert.match(await f.locator(".ofw-native-drawer").innerText(), /21 条/);
      await f
        .locator('.ofw-native-drawer > header [aria-label="关闭"]')
        .click();
      await shot("03-data-inheritance");
    },
  );
  await check(
    "Data, ontology, query, decision, Agent and report retain original task roots",
    async () => {
      for (const [moduleId, taskId, marker] of [
        ["data", "resources", "#ofw-native-integration-style"],
        ["ontology", "published", "#ofw-native-integration-style"],
        ["query", "settings", "#ofw-native-integration-style"],
        ["decision", "workbench", "#ofw-native-integration-style"],
        ["agent", "orchestrations", "#ofw-native-integration-style"],
        ["report", "definitions", "#ofw-native-integration-style"],
      ]) {
        await go(moduleId);
        const f = await task(taskId, moduleId);
        await f.locator(marker).waitFor({ state: "attached" });
        assert.ok(!f.url().includes("workbench.html"));
        assert.ok((await f.locator("body").innerText()).length > 100);
        assert.equal(await page.locator(".platform-shell").count(), 1);
      }
    },
  );
  await check(
    "Original object discovery, relationships, series and comparison remain intact",
    async () => {
      await go("m07");
      const f = await task("discover", "m07");
      await f.locator("#app[aria-busy=false]").waitFor();
      await f.locator("#object-search").fill("环保测试");
      await f.locator("[data-open-object]:visible").first().click();
      await f.locator("#continue-analysis").click();
      await f.locator("body").press("Escape");
      for (const lens of ["graph", "timeseries", "map", "compare"]) {
        const target = f.locator(`[data-lens="${lens}"]`);
        if (await target.count()) await target.click();
      }
      assert.ok(await f.locator("#compare-metric").count());
      await shot("04-original-explorer");
    },
  );
  await check(
    "New global map is one lens in the original platform, with no nested platform navigation",
    async () => {
      await go("dashboard");
      await task("situation", "dashboard");
      const f = await joint();
      await readyMap(f);
      assert.equal(await f.locator(".rail,.topbar").count(), 0);
      assert.equal(await page.locator(".module-subnav-item").count(), 7);
      await action(f, "reset-filters");
      await action(f, "fit");
      await readyMap(f);
      const pixels = await f.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 80;
        c.height = 80;
        const x = c.getContext("2d");
        x.drawImage(__OFW_V14__.getMap().getCanvas(), 0, 0, 80, 80);
        return new Set([...x.getImageData(0, 0, 80, 80).data]).size;
      });
      assert.ok(pixels > 30);
      await shot("05-map-in-platform");
      await action(f, "world");
      await readyMap(f);
      await shot("06-global-map");
    },
  );
  await check(
    "Map enterprise hands off canonical identity into original object explorer and back",
    async () => {
      let f = await joint();
      await f.locator('.entity-row[data-object-id="ENT-020"]').click();
      await action(f, "native-object");
      await page.waitForFunction(
        () =>
          !document
            .getElementById("module-frame")
            .src.includes("workbench.html"),
      );
      f = await frame();
      await f.locator("#app[aria-busy=false]").waitFor();
      assert.equal(
        await page.evaluate(
          () => OFW_V131_STORE.workspaceContext().activeObjectRef?.id,
        ),
        "ENT-020",
      );
      assert.equal(
        await page.evaluate(
          () => OFW_V131_STORE.workspaceContext().dataVersionRef,
        ),
        null,
      );
      await go("dashboard");
      await task("situation", "dashboard");
      f = await joint();
      await readyMap(f);
      assert.equal(
        await f.evaluate(() => __OFW_V14__.getState().selectedId),
        "ENT-020",
      );
    },
  );
  await check(
    "Map question is additive to the original query settings, semantics and history",
    async () => {
      let f = await joint();
      await action(f, "native-query");
      await page.waitForURL("**#module/query");
      f = await frame();
      await f
        .locator("#ofw-native-integration-style")
        .waitFor({ state: "attached" });
      assert.ok(
        await page.locator('[data-module-task="settings"]').isVisible(),
      );
      await task("map-query", "query");
      f = await joint();
      await readyMap(f);
      await f.locator('[data-action="right-tab"][data-tab="query"]').click();
      await f.locator("#question").fill("找出高成本且有资金缺口的企业");
      await action(f, "reset-filters");
      await f.locator("#query-form [type=submit]").click();
      await f.waitForFunction(
        () => __OFW_V14__.getState().queries[0]?.status === "success",
      );
      assert.ok(
        (await f.evaluate(() => __OFW_V14__.getResult().rows.length)) > 0,
      );
    },
  );
  await check(
    "Joint report is appended to the inherited report editor with fixed data and enterprise values",
    async () => {
      let f = await joint();
      const snapshot = await f.evaluate(
        () => __OFW_V14__.getState().queries[0].snapshot,
      );
      await f.locator('[data-action="report-answer"]').first().click();
      await f.locator("#report-title").fill("联合融资与债务风险复核");
      await f.locator("#report-edit [type=submit]").click();
      await action(f, "native-report");
      await page.waitForURL("**#module/report");
      f = await frame();
      await f.locator('[data-ofw-native-action="report-open"]').first().click();
      await f.locator("[data-report-block]").first().waitFor();
      const draft = await page.evaluate(() => OFW_WORKFLOW.readReport("S003"));
      const blocks = draft.contentBlocks.filter((block) => block.jointReportId);
      assert.equal(blocks.length, 4);
      assert.equal(blocks[0].rows.length, snapshot.rows.length);
      assert.equal(blocks[0].rows[0].value, snapshot.rows[0].balance / 100);
      assert.equal(blocks[0].dataVersionId, snapshot.dataVersion);
      assert.equal(blocks[0].resultMode, "demo");
      assert.ok(await f.locator('[data-ofw-report-action="up"]').count());
      await shot("07-original-report-editor");
      await f.locator('[data-ofw-report-action="source"]').first().click();
      await page.waitForURL("**#dashboard");
      f = await joint();
      await readyMap(f);
      assert.equal(
        await f.evaluate(() => __OFW_V14__.getResult().rows.length),
        snapshot.rows.length,
      );
    },
  );
  await check(
    "Scenario and review tasks belong to original decision module without replacing approvals",
    async () => {
      let f = await joint();
      await f.locator('[data-action="right-tab"][data-tab="scenario"]').click();
      await f.locator("#scenario-name").fill("联合风险演示方案");
      await f.locator("#scenario-rate").fill("-50");
      await f.locator("#scenario-rate").dispatchEvent("input");
      await f.locator("#scenario-form [type=submit]").click();
      await f.locator('[data-action="nav"][data-view="plans"]').click();
      await page.waitForURL("**#module/decision");
      f = await joint();
      assert.ok(
        await page.locator('[data-module-task="workbench"]').isVisible(),
      );
      assert.ok(await page.locator('[data-module-task="todos"]').isVisible());
      await action(f, "task-plan");
      await f.locator("#task-owner").fill("集团风险部");
      await f.locator("#task-confirm").check();
      await f.locator("#task-form [type=submit]").click();
      await task("analysis-tasks", "decision");
      f = await joint();
      await f.locator(".task-row").first().click();
      await f.locator("#task-note").fill("已复核资金与到期明细");
      await f.locator("#task-transition [type=submit]").click();
      assert.equal(
        await f.evaluate(() => __OFW_V14__.getState().tasks[0].status),
        "IN_PROGRESS",
      );
      await shot("08-decision-additive-tasks");
      await f.locator('[data-action="close-modal"]').click();
      await task("workbench", "decision");
      f = await frame();
      await f
        .locator("#ofw-native-integration-style")
        .waitFor({ state: "attached" });
      assert.ok(!f.url().includes("workbench.html"));
    },
  );
  await check(
    "Rules belong to the existing financing and debt-risk ontology drafts",
    async () => {
      await go("ontology");
      await task("published", "ontology");
      const f = await frame();
      await f.locator('[data-owned-rule-open="S001"]').waitFor();
      assert.equal(
        await page.locator('[data-module-task="rule-sandbox"]').count(),
        0,
      );
      const drafts = await f.evaluate(() =>
        OFW_M01_PORTFOLIO_STATE.drafts.filter((draft) => draft.operationsOwner),
      );
      assert.equal(drafts.length, 2);
      assert.ok(
        drafts.every(
          (draft) =>
            draft.rules.some((rule) => rule.operationsRuleKey) &&
            draft.basedOnVersionId &&
            !draft.publishedVersionId,
        ),
      );
      await shot("08-owned-ontology-rules");
    },
  );
  await check(
    "Professional workspace navigation stays inside the same platform and one tab",
    async () => {
      await go("data");
      const f = await task("resources", "data");
      await f
        .locator(
          '[data-snapshot-action="open"][data-id="asset-v14-enterprises"]',
        )
        .click();
      await f.locator('[data-snapshot-action="situation"]').click();
      await page.waitForURL("**#dashboard");
      assert.equal(context.pages().length, 1);
      await go("modeling");
      const m = await frame();
      await m.waitForFunction(() => document.body.innerText.includes("模型"));
      await shot("09-inherited-models");
      await go("dashboard");
      const d = await frame();
      assert.ok((await d.locator("body").innerText()).length > 100);
    },
  );
  await check(
    "Embedded map and original platform remain usable on desktop and mobile",
    async () => {
      for (const viewport of [
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await go("dashboard");
        await task("situation", "dashboard");
        const f = await joint();
        await readyMap(f);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert.ok(
          await f.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await action(f, "fit");
        await readyMap(f);
        if (viewport.width === 390) {
          await action(f, "mobile-objects");
          await f.locator(".entity-row").first().click();
          await f
            .locator("#investigation-content")
            .evaluate((el) => (el.scrollTop = el.scrollHeight));
          assert.ok(
            await f
              .locator("#investigation-content")
              .evaluate(
                (el) =>
                  Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <
                  2,
              ),
          );
          await action(f, "close-mobile");
        }
        await shot(`10-platform-${viewport.width}`);
      }
    },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  const manifest = JSON.parse(
    await readFile(new URL("../INHERITANCE-MANIFEST.json", import.meta.url)),
  );
  await writeFile(
    new URL("result.json", output),
    JSON.stringify(
      {
        status: "passed",
        checks,
        consoleErrors: errors,
        httpErrors: failed,
        inheritedFiles: manifest.files.length,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await rm(new URL("failure.json", output), { force: true });
  await rm(new URL("failure.png", output), { force: true });
  console.log(`Verified ${checks.length} inherited-platform workflows`);
} catch (error) {
  await shot("failure");
  await writeFile(
    new URL("failure.json", output),
    JSON.stringify({ message: error.stack, checks, errors, failed }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
