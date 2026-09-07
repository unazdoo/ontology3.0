import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const output = new URL("../artifacts/box-selection/", import.meta.url);
await mkdir(output, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 }),
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
const errors = [],
  checks = [];
let page, f;
async function ready() {
  await f.waitForSelector("#global-map[data-map-ready=true]");
  await f.waitForFunction(
    () =>
      !__OFW_V14__.getMap().isMoving() && __OFW_V14__.getMap().areTilesLoaded(),
  );
}
const state = () => f.evaluate(() => __OFW_V14__.getState());
const count = () => f.evaluate(() => __OFW_V14__.getResult().rows.length);
const act = (id) => f.locator(`[data-action="${id}"]`).first().click();
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: fileURLToPath(new URL(`${name}.png`, output)),
  });
}
async function rectangle(kind = "point") {
  return f.evaluate((kind) => {
    const m = __OFW_V14__.getMap(),
      b = m.getContainer().getBoundingClientRect();
    const available = (bounds) =>
      bounds.every(
        ([x, y]) =>
          x > 0 &&
          y > 0 &&
          x < b.width &&
          y < b.height &&
          document.elementFromPoint(b.x + x, b.y + y)?.closest("#global-map"),
      );
    if (kind === "empty") {
      for (let y = 8; y < b.height - 34; y += 28)
        for (let x = 8; x < b.width - 34; x += 28) {
          const bounds = [
            [x, y],
            [x + 26, y + 26],
          ];
          if (
            available(bounds) &&
            !m.queryRenderedFeatures(bounds, {
              layers: ["entity-points", "clusters"],
            }).length
          )
            return bounds;
        }
      return null;
    }
    const layer = kind === "cluster" ? "clusters" : "entity-points";
    for (const feature of m.queryRenderedFeatures({ layers: [layer] })) {
      const p = m.project(feature.geometry.coordinates),
        bounds = [
          [p.x - 12, p.y - 12],
          [p.x + 12, p.y + 12],
        ];
      if (available(bounds)) return bounds;
    }
    return null;
  }, kind);
}
async function box(bounds, reverse = false) {
  assert.ok(bounds, "no usable map selection rectangle");
  const b = await f.locator("#global-map").boundingBox();
  await act("box-select");
  const [a, z] = reverse ? [bounds[1], bounds[0]] : bounds;
  await page.mouse.move(b.x + a[0], b.y + a[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + z[0], b.y + z[1], { steps: 8 });
  await page.mouse.up();
  await f.waitForFunction(
    () => document.getElementById("global-map").dataset.choosing === "false",
  );
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${runtime.url}/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html?task=situation#dashboard`,
    );
    await page.locator('#module-frame[src*="workbench.html"]').waitFor();
    f = await (
      await page.locator("#module-frame").elementHandle()
    ).contentFrame();
    await ready();
    await check(
      `${viewport.width}: empty box leaves all enterprises and filters unchanged`,
      async () => {
        const prior = (await state()).filters;
        await box(await rectangle("empty"));
        await f.locator(".toast").filter({ hasText: "未框中企业" }).waitFor();
        assert.deepEqual((await state()).filters, prior);
        assert.equal(await count(), 21);
      },
    );
    await check(
      `${viewport.width}: selecting twice and cancelling restores the previous scope`,
      async () => {
        if (viewport.width < 1000) await act("mobile-objects");
        await f.locator("#industry").selectOption("风电");
        if (viewport.width < 1000) await act("close-objects");
        await ready();
        const before = await count();
        const point =
          (await rectangle("point")) || (await rectangle("cluster"));
        await box(point, true);
        await f.waitForFunction(
          () => __OFW_V14__.getState().filters.boxIds !== null,
        );
        const selected = await count();
        assert.ok(selected > 0 && selected < before);
        assert.equal((await state()).filters.objectIds, null);
        assert.equal((await state()).filters.industry, "风电");
        await ready();
        await shot(`${viewport.width}-selected`);
        const displayed = await f.evaluate(() => {
          const m = __OFW_V14__.getMap();
          return m
            .queryRenderedFeatures({ layers: ["entity-points", "clusters"] })
            .map((feature) => feature.properties);
        });
        if (selected === 1) {
          assert.ok(displayed.length > 0);
          assert.ok(displayed.every((feature) => !feature.point_count));
          const ids = (await state()).filters.boxIds;
          assert.ok(
            displayed.every((feature) => ids.includes(feature.id)),
            "map still shows enterprises outside the box",
          );
        }
        await box(point);
        await f.waitForFunction(
          () =>
            document.getElementById("global-map").dataset.choosing === "false",
        );
        await f.locator("#map-filter-actions [data-action=clear-box]").click();
        await ready();
        assert.equal(await count(), before);
        assert.equal((await state()).filters.industry, "风电");
        assert.equal((await state()).filters.boxIds, null);
      },
    );
    await check(
      `${viewport.width}: blank box while already filtered does not erase a valid selection`,
      async () => {
        await box((await rectangle("point")) || (await rectangle("cluster")));
        await f.waitForFunction(
          () => __OFW_V14__.getState().filters.boxIds !== null,
        );
        await ready();
        const prior = (await state()).filters,
          rows = await count();
        await box(await rectangle("empty"));
        await f.locator(".toast").filter({ hasText: "未框中企业" }).waitFor();
        assert.deepEqual((await state()).filters, prior);
        assert.equal(await count(), rows);
        await f
          .locator("#map-filter-actions [data-action=reset-filters]")
          .click();
        await ready();
        assert.equal(await count(), 21);
      },
    );
    await check(
      `${viewport.width}: old persisted empty selection recovers even after reload without undo history`,
      async () => {
        await f.evaluate(() => {
          const s = __OFW_V14__.getState();
          s.filters = { ...s.filters, objectIds: [], boxIds: null };
          s.reports = [...s.reports];
          localStorage.setItem("ofw.v1.4.workbench.v1", JSON.stringify(s));
        });
        await page.reload();
        await page.locator('#module-frame[src*="workbench.html"]').waitFor();
        f = await (
          await page.locator("#module-frame").elementHandle()
        ).contentFrame();
        await ready();
        assert.equal(await count(), 0);
        assert.ok(await f.locator("[data-action=undo]").isDisabled());
        assert.ok(await f.locator("#map-empty-state").isVisible());
        await shot(`${viewport.width}-empty-recovery`);
        await f.locator("#map-empty-state [data-action=reset-filters]").click();
        await ready();
        assert.equal(await count(), 21);
        assert.equal((await state()).filters.objectIds, null);
        assert.ok(!(await f.locator("#map-empty-state").isVisible()));
      },
    );
    await check(
      `${viewport.width}: box tool can be cancelled by its button and Escape`,
      async () => {
        const prior = (await state()).filters;
        await act("box-select");
        assert.equal(
          await f
            .locator("[data-action=box-select]")
            .getAttribute("aria-pressed"),
          "true",
        );
        await act("box-select");
        assert.equal(
          await f
            .locator("[data-action=box-select]")
            .getAttribute("aria-pressed"),
          "false",
        );
        await act("box-select");
        await f.locator("body").press("Escape");
        assert.equal(
          await f
            .locator("[data-action=box-select]")
            .getAttribute("aria-pressed"),
          "false",
        );
        assert.deepEqual((await state()).filters, prior);
      },
    );
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${runtime.url}/workbench.html`);
  await page.waitForFunction(() => Boolean(window.__OFW_V14__));
  f = page;
  await ready();
  await check(
    "Late cluster resolution cannot reapply a box after showing all enterprises",
    async () => {
      await f.locator("#industry").selectOption("风电");
      await ready();
      await f.evaluate(() => {
        const source = __OFW_V14__.getMap().getSource("entities"),
          original = source.getClusterLeaves.bind(source);
        source.getClusterLeaves = async (...args) => {
          const leaves = await original(...args);
          await new Promise((resolve) => (window.__releaseBox = resolve));
          return leaves;
        };
      });
      await box(await rectangle("cluster"));
      await f.waitForFunction(() => Boolean(window.__releaseBox));
      await f
        .locator("#map-filter-actions [data-action=reset-filters]")
        .click();
      await f.evaluate(() => window.__releaseBox());
      await page.waitForTimeout(150);
      assert.equal(await count(), 21);
      assert.equal((await state()).filters.boxIds, null);
    },
  );
  await context.close();
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
} catch (error) {
  if (page && !page.isClosed()) await shot("failure");
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
