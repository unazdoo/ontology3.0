import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const output = new URL("../artifacts/cockpit-layout/", import.meta.url);
await mkdir(output, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const checks = [],
  errors = [];
let page;
const tasks = [
  "directory",
  "financing",
  "budget",
  "risk",
  "preloan",
  "post-investment",
  "situation",
];
async function frame() {
  return (await page.locator("#module-frame").elementHandle()).contentFrame();
}
async function shot(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(`${name}.png`, output)),
  });
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.setDefaultTimeout(14000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `${runtime.url}/designs/prototype-work/v1.5/composite/s001-e2e-integration/index.html?task=directory#dashboard`,
    );
    await page.locator(".cockpit-layout").waitFor();
    for (const task of tasks) {
      await page
        .locator(`[data-module-id="dashboard"][data-module-task="${task}"]`)
        .click();
      await page.waitForFunction(
        (id) =>
          document.querySelector(".cockpit-layout .module-subnav-item.active")
            ?.dataset.moduleTask === id,
        task,
      );
      const f = await frame();
      await f.waitForFunction(() => document.body?.innerText.length > 40);
      if (task === "situation") {
        await f.waitForSelector("#global-map[data-map-ready=true]");
        await f.waitForFunction(() => !__OFW_V14__.getMap().isMoving());
      }
      const layout = await page.evaluate(() => {
        const nav = document.querySelector(".cockpit-layout .module-subnav"),
          buttons = [...nav.querySelectorAll(".module-subnav-item")],
          menu = nav.querySelector("nav"),
          selected = nav.querySelector(".active"),
          a = nav.getBoundingClientRect(),
          b = document.getElementById("module-frame").getBoundingClientRect(),
          s = selected.getBoundingClientRect(),
          m = menu.getBoundingClientRect();
        return {
          nav: { x: a.x, y: a.y, width: a.width, height: a.height },
          frame: { x: b.x, y: b.y, width: b.width, height: b.height },
          rows: buttons.map((button) =>
            Math.round(button.getBoundingClientRect().top),
          ),
          selectedVisible: s.left >= m.left - 1 && s.right <= m.right + 1,
          selectHidden:
            getComputedStyle(nav.querySelector("select")).display === "none",
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.equal(
        new Set(layout.rows).size,
        1,
        `${task}: navigation must stay on one horizontal line`,
      );
      assert.ok(layout.selectedVisible, `${task}: active tab clipped`);
      assert.ok(layout.selectHidden);
      assert.ok(!layout.overflow);
      assert.ok(
        Math.abs(layout.frame.x - layout.nav.x) < 2 &&
          Math.abs(layout.frame.width - layout.nav.width) < 2,
      );
      assert.ok(layout.nav.y + layout.nav.height <= layout.frame.y + 1);
      assert.equal(layout.nav.height, 48);
      if (["directory", "financing", "situation"].includes(task))
        await shot(`${viewport.width}-${task}`);
      checks.push(`${viewport.width}: ${task} horizontal navigation`);
    }
    const f = await frame();
    assert.equal(await f.locator(".joint-toolbar").count(), 0);
    assert.equal(
      await f.locator(".map-date-label").innerText(),
      "联合态势 · 数据截至 2025-12-31",
    );
    assert.equal(
      await f.locator(".map-date-label time").getAttribute("datetime"),
      "2025-12-31",
    );
    const mapLayout = await f.evaluate(() => {
      const rect = (selector) => {
        const b = document.querySelector(selector).getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          right: b.right,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
        };
      };
      return {
        map: rect(".map-stage"),
        date: rect(".map-date-label"),
        legend: rect(".map-legend"),
        credit: rect(".maplibregl-ctrl-attrib"),
        toolbar: rect(".workspace-toolbar"),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.ok(
      Math.abs(mapLayout.toolbar.y) < 1,
      "extra row above metric controls",
    );
    assert.ok(mapLayout.date.right <= mapLayout.map.right - 8);
    assert.ok(mapLayout.map.right - mapLayout.date.right < 20);
    assert.ok(mapLayout.date.bottom < mapLayout.map.bottom);
    assert.ok(
      mapLayout.date.bottom <= mapLayout.credit.y + 1,
      "date overlaps attribution",
    );
    const overlap = (a, b) =>
      a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    assert.ok(!overlap(mapLayout.date, mapLayout.legend));
    assert.ok(!mapLayout.overflow);
    const colored = await f.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(__OFW_V14__.getMap().getCanvas(), 0, 0, 64, 64);
      return new Set(ctx.getImageData(0, 0, 64, 64).data).size;
    });
    assert.ok(colored > 20);
    await f.locator(".workspace-actions > summary").click();
    assert.equal(
      await f.locator(".workspace-actions-menu .button:visible").count(),
      5,
    );
    await shot(`${viewport.width}-tools`);
    await f.locator("body").press("Escape");
    assert.equal(await f.locator(".workspace-actions[open]").count(), 0);
    await f.locator(".workspace-actions > summary").click();
    await f.locator(".workspace-actions-menu [data-action=source]").click();
    await f.locator("dialog[open]").waitFor();
    assert.match(await f.locator("dialog").innerText(), /数据来源/);
    await f.locator("dialog").press("Escape");
    if (viewport.width <= 390) {
      await f.locator("[data-action=mobile-analysis]").click();
      assert.ok(await f.locator("#investigation.mobile-visible").isVisible());
      await f.locator("[data-action=close-mobile]").click();
    }
    await f.locator("[data-canvas=network]").click();
    assert.equal(await f.locator(".map-date-label").isVisible(), false);
    await f.locator("[data-canvas=map]").click();
    assert.ok(await f.locator(".map-date-label").isVisible());
    checks.push(
      `${viewport.width}: compact toolbar, lower-right date, nonblank map and retained actions`,
    );
    await context.close();
    console.log(`PASS ${viewport.width}x${viewport.height}`);
  }
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
