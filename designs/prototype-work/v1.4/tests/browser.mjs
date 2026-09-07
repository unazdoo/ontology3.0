import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const artifacts = new URL("../artifacts/verification/", import.meta.url);
await mkdir(artifacts, { recursive: true });
async function digestTree(root) {
  const h = createHash("sha256");
  async function visit(url) {
    for (const name of (await readdir(url, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (name.name === "node_modules" || name.name === ".runtime") continue;
      const child = new URL(
        `${name.name}${name.isDirectory() ? "/" : ""}`,
        url,
      );
      h.update(child.pathname);
      if (name.isDirectory()) await visit(child);
      else h.update(await readFile(child));
    }
  }
  await visit(root);
  return h.digest("hex");
}
const historical = new URL("../../v1.3.2/", import.meta.url),
  before = await digestTree(historical);
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [],
  failed = [],
  steps = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    failed.push(`${response.status()} ${response.url()}`);
});
const click = (action) =>
  page.locator(`[data-action="${action}"]`).first().click();
const nav = (view) => page.locator(`.rail-item[data-view="${view}"]`).click();
const state = () => page.evaluate(() => window.__OFW_V14__.getState());
const mapReady = async () => {
  await page.waitForSelector('#global-map[data-map-ready="true"]');
  await page.waitForFunction(() => !window.__OFW_V14__.getMap()?.isMoving());
};
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(`${name}.png`, artifacts)),
    fullPage: true,
  });
async function pixels() {
  return page.evaluate(() => {
    const map = window.__OFW_V14__.getMap();
    map.triggerRepaint();
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(map.getCanvas(), 0, 0, 80, 80);
    const rgba = ctx.getImageData(0, 0, 80, 80).data,
      colors = new Set();
    let visible = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      colors.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
      if (rgba[i + 3] > 0 && rgba[i] + rgba[i + 1] + rgba[i + 2] > 0) visible++;
    }
    return { colors: colors.size, visible };
  });
}
async function check(name, run) {
  await run();
  steps.push(name);
  console.log(`PASS ${name}`);
}
async function question(text) {
  await page.locator("[data-right-tab]").count();
  await page.locator('[data-action="right-tab"][data-tab="query"]').click();
  await page.locator("#question").fill(text);
  await page.locator('#query-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector(".query-working"));
}
try {
  await page.goto(runtime.url+'/workbench.html');
  await page.waitForFunction(() => Boolean(window.__OFW_V14__));
  await mapReady();
  await check(
    "Desktop: unified objects, offline map and nonblank WebGL",
    async () => {
      assert.equal((await state()).version, 1);
      assert.equal(await page.locator(".entity-row").count(), 21);
      const p = await pixels();
      assert.ok(p.colors > 20 && p.visible > 4000, JSON.stringify(p));
      assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
      await shot("01-desktop-workbench");
    },
  );
  await check(
    "Global globe, animated zoom, camera persistence and stable analysis scope",
    async () => {
      const ids = await page.evaluate(() =>
        window.__OFW_V14__.getResult().rows.map((row) => row.id),
      );
      await click("world");
      await page.waitForFunction(() => window.__OFW_V14__.getMap().isMoving());
      await page.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
      const p = await pixels();
      assert.ok(p.colors > 20);
      await shot("02-global-globe");
      const z = await page.evaluate(() =>
        window.__OFW_V14__.getMap().getZoom(),
      );
      await click("zoom-in");
      await page.waitForFunction(
        (z) => window.__OFW_V14__.getMap().getZoom() > z + 0.8,
        z,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          window.__OFW_V14__.getResult().rows.map((row) => row.id),
        ),
        ids,
      );
      await click("fit");
      await page.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
    },
  );
  await check("Wheel zoom and drag do not change the object set", async () => {
    const box = await page.locator("#global-map").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const zoom = await page.evaluate(() =>
      window.__OFW_V14__.getMap().getZoom(),
    );
    await page.mouse.wheel(0, -320);
    await page.waitForFunction(
      (z) => window.__OFW_V14__.getMap().getZoom() > z + 0.1,
      zoom,
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 50,
      box.y + box.height / 2 + 15,
      { steps: 10 },
    );
    await page.mouse.up();
    assert.equal(await page.locator(".entity-row").count(), 21);
  });
  await check(
    "Enterprise -> loan -> bank -> related enterprise -> back chain",
    async () => {
      await page.locator('.entity-row[data-object-id="ENT-020"]').click();
      await page
        .locator('#investigation [data-object-type="loan"]')
        .first()
        .click();
      assert.match(
        await page.locator("#investigation").innerText(),
        /合成借款/,
      );
      await page
        .locator('#investigation [data-object-type="bank"]')
        .first()
        .click();
      assert.match(
        await page.locator("#investigation").innerText(),
        /金融机构/,
      );
      await page
        .locator('#investigation [data-object-type="enterprise"]')
        .first()
        .click();
      await click("detail-back");
      assert.match(
        await page.locator("#investigation").innerText(),
        /金融机构/,
      );
      await click("detail-back");
      assert.match(
        await page.locator("#investigation").innerText(),
        /合成借款/,
      );
      await click("detail-back");
      assert.equal(
        await page.locator(".entity-profile h2").innerText(),
        "环保测试公司4",
      );
      await shot("03-enterprise-drilldown");
    },
  );
  await check(
    "Inspector can scroll fully to sources; definitions reveal contributing loans",
    async () => {
      await page
        .locator("#investigation-content")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      assert.ok(
        await page
          .locator("#investigation-content")
          .evaluate(
            (el) =>
              Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2,
          ),
      );
      await page
        .locator("#investigation-content")
        .evaluate((el) => (el.scrollTop = 0));
      await page
        .locator('.profile-metrics [data-object-id="weightedCost"]')
        .click();
      assert.match(
        await page.locator("#investigation").innerText(),
        /当前取值/,
      );
      assert.equal(
        await page.locator('#investigation [data-object-type="loan"]').count(),
        4,
      );
      await click("detail-back");
    },
  );
  await check(
    "Guarantee, facility, project and event all drill into linked subjects",
    async () => {
      for (const type of ["guarantee", "facility", "project", "event"]) {
        const target = page
          .locator(`#investigation [data-object-type="${type}"]`)
          .first();
        if (await target.count()) {
          await target.click();
          assert.ok(
            await page
              .locator('#investigation [data-object-type="enterprise"]')
              .count(),
          );
          await click("detail-back");
        }
      }
    },
  );
  await check(
    "Same-screen query filters map and preserves empty/failed query boundaries",
    async () => {
      await click("reset-filters");
      await question("找出高成本且有资金缺口的企业");
      const s = await state();
      assert.equal(s.queries[0].status, "success");
      const ids = s.queries[0].evidence.objectIds;
      assert.ok(ids.length > 0 && ids.length < 21);
      assert.equal(await page.locator(".entity-row").count(), ids.length);
      await question("未来130天到期多少");
      assert.equal((await state()).queries[0].status, "failed");
      assert.equal(await page.locator(".entity-row").count(), ids.length);
      await shot("04-query-cohort");
    },
  );
  await check(
    "Query parameters -> live scenario -> save without reconstructing the map",
    async () => {
      await question("未来90天如果降息50bp，授信收缩30%，展期180天");
      await click("scenario-answer");
      assert.equal(await page.locator("#scenario-rate").inputValue(), "-50");
      assert.equal(
        await page.locator("#scenario-extension").inputValue(),
        "180",
      );
      await page.locator("#scenario-name").fill("授信压力下的融资调整");
      await page.evaluate(
        () => (window.__mapBefore = window.__OFW_V14__.getMap()),
      );
      await page.locator("#scenario-rate").fill("-100");
      await page.locator("#scenario-rate").dispatchEvent("input");
      await page.locator("#scenario-credit").fill("50");
      await page.locator("#scenario-credit").dispatchEvent("input");
      await page.locator('#scenario-form [type="submit"]').click();
      const s = await state();
      assert.equal(s.plans.length, 1);
      assert.equal(s.plans[0].parameters.rateBps, -100);
      assert.equal(s.plans[0].parameters.creditHaircut, 50);
      assert.ok(
        await page.evaluate(
          () => window.__mapBefore === window.__OFW_V14__.getMap(),
        ),
      );
      await shot("05-scenario-map");
    },
  );
  await check(
    "Scenario facility drilldown displays adjusted value and the original snapshot",
    async () => {
      await page.locator(".entity-row").first().click();
      const link = page
          .locator('#investigation [data-object-type="facility"]')
          .first(),
        id = await link.getAttribute("data-object-id");
      await link.click();
      const expected = await page.evaluate((id) => {
        const f = window.__OFW_V14__
          .getDataset()
          .facilities.find((f) => f.id === id);
        return (
          ((f.undrawn * 0.5) / 100).toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " 亿元"
        );
      }, id);
      const text = await page.locator("#investigation").innerText();
      assert.ok(
        text.includes("方案未用额度") &&
          text.includes(expected) &&
          text.includes("原快照未用"),
      );
      await page.locator("#sort").selectOption("risk");
    },
  );
  await check(
    "Old query report remains a baseline snapshot despite active scenario",
    async () => {
      await page.locator('[data-action="right-tab"][data-tab="query"]').click();
      await page.locator('[data-action="report-answer"]').first().click();
      const s = await state();
      assert.equal(s.reports[0].evidence.resultKind, "DEMO_BASELINE");
      assert.equal(s.reports[0].plan, null);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "Scenario -> confirmed task -> progress -> completed -> review report -> download",
    async () => {
      await nav("plans");
      await click("task-plan");
      await page.locator("#task-owner").fill("集团财务部");
      await page.locator("#task-title").fill("债务与融资联合复核");
      await page.locator("#task-confirm").check();
      await page.locator('#task-form [type="submit"]').click();
      assert.equal((await state()).tasks.length, 1);
      await nav("tasks");
      await click("open-task");
      await click("edit-task");
      await page.locator("#assignment-owner").fill("集团风险管理部");
      await page.locator("#assignment-note").fill("融资与风险联合复核分办");
      await page.locator('#task-assignment [type="submit"]').click();
      assert.equal((await state()).tasks[0].owner, "集团风险管理部");
      await page.locator("#task-note").fill("已核对到期借款与银行授信额度");
      await page.locator("#task-status").selectOption("IN_PROGRESS");
      await page.locator('#task-transition [type="submit"]').click();
      await page
        .locator("#task-note")
        .fill("演示证据已复核，保留方案等待业务审批");
      await page.locator("#task-status").selectOption("COMPLETED");
      await page.locator('#task-transition [type="submit"]').click();
      const s = await state();
      assert.equal(s.tasks[0].status, "COMPLETED");
      assert.equal(s.tasks[0].history.length, 4);
      assert.equal(s.tasks[0].externalSideEffects, 0);
      await shot("06-task-audit");
      await click("report-task");
      await page.locator("#report-title").fill("企业债务风险与融资调整复核");
      await page.locator('#report-edit [type="submit"]').click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator('dialog [data-action="export-report"]').click();
      const download = await downloadPromise;
      await download.saveAs(
        fileURLToPath(new URL("sample-report.html", artifacts)),
      );
      const html = await readFile(
        fileURLToPath(new URL("sample-report.html", artifacts)),
        "utf8",
      );
      assert.ok(html.includes("演示证据已复核"));
      assert.ok(html.includes("方案假设"));
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "Independent second scenario and aligned comparison",
    async () => {
      await nav("plans");
      await click("new-scenario");
      await page.locator("#scenario-name").fill("保守利率方案");
      await page.locator("#scenario-rate").fill("100");
      await page.locator("#scenario-rate").dispatchEvent("input");
      await page.locator('#scenario-form [type="submit"]').click();
      await nav("plans");
      await page.locator("[data-compare-plan]").nth(0).check();
      await page.locator("[data-compare-plan]").nth(1).check();
      assert.match(
        await page.locator(".comparison-section").innerText(),
        /同范围同口径/,
      );
      await shot("07-comparison");
    },
  );
  await check(
    "Rules sandbox -> shared map cohort -> query evidence carries rule identity",
    async () => {
      await nav("ontology");
      await page.locator("#semantic-threshold").fill("50");
      await page.locator('#semantic-form [type="submit"]').click();
      await click("apply-rule");
      await mapReady();
      const s = await state();
      assert.equal(s.filters.premiumThreshold, 50);
      await question("找出高成本企业");
      const answer = (await state()).queries[0];
      assert.equal(answer.evidence.rule.premiumThreshold, 50);
      assert.ok(answer.snapshot.rows.every((row) => row.premium > 50));
      await nav("ontology");
      await shot("08-ontology");
    },
  );
  await check(
    "Isolated model API and standalone model workspace load",
    async () => {
      const response = await page.request.get(
        `${runtime.url}/model-api/v1/model-management/context?scenarioId=S003`,
      );
      assert.equal(response.status(), 200);
      await nav("models");
      await page.frameLocator("#model-frame").locator("body").waitFor();
      await page.waitForTimeout(1200);
      assert.ok(
        (await page.frameLocator("#model-frame").locator("body").innerText())
          .length > 150,
      );
      await shot("09-model-verification");
    },
  );
  await check(
    "Saved exploration and reload retain filters, camera, tasks and reports",
    async () => {
      await nav("workbench");
      await mapReady();
      await click("save-exploration");
      await page.locator("#exploration-name").fill("客户联合风险观察");
      await page.locator('#save-exploration-form [type="submit"]').click();
      const s = await state();
      await page.reload();
      await mapReady();
      const restored = await state();
      assert.equal(restored.tasks[0].status, "COMPLETED");
      assert.equal(restored.reports.length, s.reports.length);
      assert.equal(restored.filters.premiumThreshold, 50);
      assert.equal(restored.explorations.length, 1);
      assert.ok(Math.abs(restored.camera.zoom - s.camera.zoom) < 0.02);
    },
  );
  await check(
    "1280x720: no page overflow, object table scroll reaches last row",
    async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await click("reset-filters");
      await click("toggle-table");
      await page
        .locator(".dock-scroll")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      assert.ok(
        await page
          .locator(".dock-scroll")
          .evaluate(
            (el) =>
              Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2,
          ),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await shot("10-compact-desktop");
      await click("toggle-table");
    },
  );
  await check(
    "Mobile map renders and analysis/object drawers remain usable",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await click("fit");
      await page.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
      const p = await pixels();
      assert.ok(p.colors > 20 && p.visible > 4000);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await shot("11-mobile-map");
      const saveBounds = await page
          .locator('[data-action="save-exploration"]')
          .boundingBox(),
        toolbarBounds = await page
          .locator(".workspace-toolbar-right")
          .boundingBox();
      assert.ok(
        saveBounds.height <= toolbarBounds.height &&
          saveBounds.y >= toolbarBounds.y &&
          saveBounds.y + saveBounds.height <=
            toolbarBounds.y + toolbarBounds.height + 1,
        "mobile save control must fit toolbar",
      );
      await click("mobile-objects");
      await page.locator('.entity-row[data-object-id="ENT-020"]').click();
      assert.ok(await page.locator("#investigation").isVisible());
      await page
        .locator("#investigation-content")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      assert.ok(
        await page
          .locator("#investigation-content")
          .evaluate(
            (el) =>
              Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2,
          ),
      );
      await page
        .locator("#investigation-content")
        .evaluate((el) => (el.scrollTop = 0));
      await shot("12-mobile-drilldown");
      await click("close-mobile");
      await click("mobile-analysis");
      await page.locator('[data-action="right-tab"][data-tab="query"]').click();
      await question("这家企业融资成本多少");
      assert.equal((await state()).queries[0].evidence.objectIds[0], "ENT-020");
      await click("close-mobile");
    },
  );
  await check("Mobile documents and modal fit, scroll and escape", async () => {
    for (const view of ["plans", "tasks", "reports", "ontology"]) {
      await nav(view);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .locator(".document-surface")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      assert.ok(
        await page
          .locator(".document-surface")
          .evaluate(
            (el) =>
              Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2,
          ),
      );
    }
    await nav("reports");
    await click("open-report");
    const bounds = await page.locator("dialog").boundingBox();
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= 390 &&
        bounds.y >= 0 &&
        bounds.height <= 844,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").isVisible(), false);
  });
  await check(
    "Box selection and undo preserve an explicit object cohort",
    async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await nav("workbench");
      await mapReady();
      await click("reset-filters");
      await click("fit");
      await page.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
      const b = await page.locator("#global-map").boundingBox();
      await click("box-select");
      await page.mouse.move(b.x + 80, b.y + 110);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width - 90, b.y + b.height - 80, {
        steps: 15,
      });
      await page.mouse.up();
      await page.waitForFunction(
        () => window.__OFW_V14__.getState().filters.boxIds !== null,
      );
      assert.ok((await state()).filters.boxIds.length < 22);
      await click("undo");
      assert.equal((await state()).filters.boxIds, null);
    },
  );
  await check(
    "Rendered map points and clusters respond to actual pointer selection",
    async () => {
      await page.waitForTimeout(350);
      await page.waitForFunction(
        () =>
          window.__OFW_V14__
            .getMap()
            .queryRenderedFeatures({ layers: ["clusters"] }).length > 0,
      );
      const cluster = await page.evaluate(() => {
          const map = window.__OFW_V14__.getMap(),
            feature = map.queryRenderedFeatures({ layers: ["clusters"] })[0],
            p = map.project(feature.geometry.coordinates);
          return { x: p.x, y: p.y, z: map.getZoom() };
        }),
        b = await page.locator("#global-map").boundingBox();
      await page.mouse.click(b.x + cluster.x, b.y + cluster.y);
      await page.waitForFunction(
        (z) => window.__OFW_V14__.getMap().getZoom() > z + 0.1,
        cluster.z,
      );
      await page.waitForFunction(() => !window.__OFW_V14__.getMap().isMoving());
      const point = await page.evaluate(() => {
        const map = window.__OFW_V14__.getMap(),
          b = map.getContainer().getBoundingClientRect();
        for (const feature of map.queryRenderedFeatures({
          layers: ["entity-points"],
        })) {
          const p = map.project(feature.geometry.coordinates);
          if (
            p.x > 80 &&
            p.x < b.width - 90 &&
            p.y > 100 &&
            p.y < b.height - 90
          )
            return { x: p.x, y: p.y, id: feature.properties.id };
        }
        return null;
      });
      assert.ok(point);
      await page.mouse.click(b.x + point.x, b.y + point.y);
      await page.waitForFunction(
        (id) => window.__OFW_V14__.getState().selectedId === id,
        point.id,
      );
    },
  );
  await check(
    "Relationship view pans, zooms, resets and matrix retains inspectable enterprise points",
    async () => {
      await page.locator('.entity-row[data-object-id="ENT-020"]').click();
      await page.locator('[data-canvas="network"]').click();
      assert.ok(
        (await page.locator(".network-scene [data-object-id]").count()) > 3,
      );
      await click("network-in");
      await page.waitForFunction(
        () => window.__OFW_V14__.getState().networkCamera?.k > 1.1,
      );
      await click("network-reset");
      await page.waitForFunction(
        () =>
          Math.abs(window.__OFW_V14__.getState().networkCamera.k - 1) < 0.01,
      );
      await shot("13-relationship-network");
      await page.locator('[data-canvas="matrix"]').click();
      assert.equal(
        await page.locator(".matrix-svg [data-object-id]").count(),
        21,
      );
      await shot("14-cost-risk-matrix");
      await page.locator('[data-canvas="map"]').click();
    },
  );
  await check(
    "Report review freezes a version; revision creates an independent editable draft",
    async () => {
      await nav("reports");
      await click("open-report");
      await click("review-report");
      await page.locator("#report-reviewer").fill("财务复核人");
      await page
        .locator("#review-note")
        .fill("已检查演示输入、计算边界和处置记录");
      await page.locator('#report-review-form [type="submit"]').click();
      assert.equal(
        await page.locator("#report-title").getAttribute("readonly"),
        "",
      );
      const reviewed = (await state()).reports.find(
        (report) => report.status === "REVIEWED",
      );
      assert.ok(reviewed);
      await click("revise-report");
      assert.equal(
        await page.locator("#report-title").getAttribute("readonly"),
        null,
      );
      const revised = (await state()).reports[0];
      assert.equal(revised.parentId, reviewed.id);
      assert.equal(revised.version, 2);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "Deleted scenario can be restored from a saved exploration without substituting baseline",
    async () => {
      await nav("plans");
      await click("apply-plan");
      await mapReady();
      const original = (await state()).activePlanId;
      await click("save-exploration");
      await page.locator("#exploration-name").fill("方案快照恢复验证");
      await page.locator('#save-exploration-form [type="submit"]').click();
      await nav("plans");
      await page
        .locator(`[data-action="delete-plan"][data-id="${original}"]`)
        .click();
      await click("confirm-delete-plan");
      assert.ok(!(await state()).plans.some((plan) => plan.id === original));
      await click("saved");
      await click("restore-exploration");
      await mapReady();
      assert.equal((await state()).activePlanId, original);
      assert.equal(
        await page.evaluate(() => window.__OFW_V14__.getResult().resultKind),
        "SIMULATION",
      );
    },
  );
  await check(
    "Cancelled query does not change scope and preserves cancellation history",
    async () => {
      await page.locator('[data-action="right-tab"][data-tab="query"]').click();
      const ids = await page.evaluate(() =>
        window.__OFW_V14__.getResult().rows.map((row) => row.id),
      );
      await page.locator("#question").fill("未来90天到期多少");
      await page.locator('#query-form [type="submit"]').click();
      await click("cancel-query");
      assert.equal((await state()).queries[0].status, "cancelled");
      assert.deepEqual(
        await page.evaluate(() =>
          window.__OFW_V14__.getResult().rows.map((row) => row.id),
        ),
        ids,
      );
    },
  );
  await check("Unavailable dataset has a retryable error state", async () => {
    const errorPage = await context.newPage();
    await errorPage.route("**/data/portfolio.json", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await errorPage.goto(runtime.url+'/workbench.html');
    await errorPage.locator(".boot-error").waitFor();
    assert.match(await errorPage.locator(".boot-error").innerText(), /503/);
    await errorPage.unroute("**/data/portfolio.json");
    await errorPage.getByRole("button", { name: "重试" }).click();
    await errorPage.waitForSelector('#global-map[data-map-ready="true"]');
    await errorPage.close();
  });
  assert.deepEqual(errors, [], "browser console errors");
  assert.deepEqual(failed, [], "failed HTTP responses");
  assert.equal(
    await digestTree(historical),
    before,
    "v1.3.2 remains unchanged",
  );
  await writeFile(
    new URL("result.json", artifacts),
    JSON.stringify(
      {
        status: "passed",
        steps,
        consoleErrors: errors,
        httpErrors: failed,
        historicalDigest: before,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await rm(new URL("failure.json", artifacts), { force: true });
  await rm(new URL("failure.png", artifacts), { force: true });
  console.log(
    `Verified ${steps.length} workflows; screenshots: ${fileURLToPath(artifacts)}`,
  );
} catch (error) {
  await shot("failure");
  await writeFile(
    new URL("failure.json", artifacts),
    JSON.stringify({ message: error.stack, steps, errors, failed }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
