import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { start } from "../server.mjs";
const output = process.env.OFW_FIX_OUTPUT ? new URL("owned-rules-browser/", new URL(process.env.OFW_FIX_OUTPUT)) : new URL("../artifacts/owned-rules/", import.meta.url);
await mkdir(output, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage(),
  errors = [],
  checks = [];
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.stack));
let f;
const entry =
  runtime.url +
  "/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html";
async function frame() {
  f = await (
    await page.locator("#module-frame").elementHandle()
  ).contentFrame();
  await f.waitForFunction(() => document.body?.innerText.length > 40);
  return f;
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", output)),
  });
}
async function selectRule(id) {
  await f.locator(`.palette-item[data-resource="${id}"]`).click();
  await f.locator("[data-owned-rule-panel]").waitFor();
}
try {
  await page.goto(runtime.url + "/");
  await page.locator('[data-primary-nav][data-route="#module/ontology"]').click();
  for (const owner of ["S003", "S001"]) {
    await page.locator('[data-module-id=ontology][data-module-task=published]').click();
    await frame();
    await f.locator(`[data-owned-rule-open=${owner}]`).click();
    await page.waitForTimeout(500);
    await frame();
    await f.waitForFunction(owner => OFW_M01_PORTFOLIO_STATE.drafts.find(d => d.id === OFW_M01_PORTFOLIO_STATE.activeDraftId)?.operationsOwner === owner, owner);
    checks.push(`Native catalog opens ${owner} owning draft`);
  }
  await frame();
  await f.waitForFunction(() => Boolean(window.OFW_M01_PORTFOLIO_STATE));
  await f.locator(".canvas-toolbar [data-action=zoom-in]").click();
  const baseline = await f.evaluate(() =>
    JSON.stringify(OFW_M01_PORTFOLIO_STATE.publishedVersions),
  );
  await check(
    "Financing rule is a native resource in the owning ontology draft",
    async () => {
      assert.equal(
        await page.locator("[data-module-task=rule-sandbox]").count(),
        0,
      );
      await selectRule("RULE-OPS-FINANCING-PREMIUM");
      await f.locator('[data-owned-rule-action=validate]').click();
      await f.locator('.owned-rule-result').waitFor();
      const validation = await page.evaluate(() => JSON.parse(localStorage.getItem('ofw.v14.ontology-rule-validation.v1'))[0]);
      assert.equal(validation.threshold, 25);
      await f.locator('[data-owned-rule-action=apply]').click();
      await page.waitForURL('**#dashboard');
      await frame();
      await f.waitForFunction(() => window.__OFW_V14__?.getState().filters.ruleRef?.premiumThreshold === 25);
      assert.deepEqual((await f.evaluate(() => __OFW_V14__.getResult().rows.map(r => r.id))).sort(), validation.objectIds.sort());
      await f.locator('#question').fill('找出高成本企业');
      await f.locator('#query-form [type=submit]').click();
      await f.waitForFunction(() => __OFW_V14__.getState().queries[0]?.status === 'success');
      await f.locator('[data-action=report-answer]').first().click();
      assert.equal(await f.evaluate(() => __OFW_V14__.getState().reports[0].evidence.rule.premiumThreshold),25);
      await f.locator('dialog').press('Escape');
      await shot('00-native-rule-25-downstream');
      await page.locator('[data-primary-nav][data-route="#module/ontology"]').click();
      await frame();
      await selectRule('RULE-OPS-FINANCING-PREMIUM');
      assert.match(
        await f.locator("[data-owned-rule-panel]").innerText(),
        /集团融资成本与债务结构优化本体/,
      );
      await shot("01-financing-rule");
    },
  );
  await check(
    "Native rule editing persists threshold and validates the current definition",
    async () => {
      await f
        .locator(
          '.inspector-foot [data-action="edit-resource:RULE-OPS-FINANCING-PREMIUM"]',
        )
        .click();
      await f.locator("#rule-condition").fill("融资成本偏离 > 50 bp");
      await f.locator("[data-action=confirm-add-rule]").click();
      await f.locator("[data-owned-rule-action=validate]").click();
      await f.locator(".owned-rule-result").waitFor();
      assert.match(await f.locator(".owned-rule-result").innerText(), /50 bp/);
      const s = await f.evaluate(() => OFW_M01_PORTFOLIO_STATE);
      assert.equal(
        s.drafts
          .find((draft) => draft.operationsOwner === "S001")
          .rules.find((rule) => rule.operationsRuleKey).condition,
        "融资成本偏离 > 50 bp",
      );
      assert.equal(JSON.stringify(s.publishedVersions), baseline);
      await shot("02-rule-validation");
    },
  );
  await check(
    "Ontology-owned rule drives the map and retains ontology identity in questions and reports",
    async () => {
      await f.locator("[data-owned-rule-action=apply]").click();
      await page.waitForFunction(() => location.hash === "#dashboard");
      await frame();
      await f.waitForSelector("#global-map[data-map-ready=true]");
      await f.waitForFunction(
        () =>
          __OFW_V14__.getState().filters.ruleRef?.id ===
          "RULE-OPS-FINANCING-PREMIUM",
      );
      const s = await f.evaluate(() => __OFW_V14__.getState());
      assert.equal(s.filters.premiumThreshold, 50);
      assert.equal(
        s.filters.ruleRef.ontologyId,
        "ONT-GROUP-FINANCING-OPTIMIZATION",
      );
      await f.locator("#question").fill("找出高成本企业");
      await f.locator("#query-form [type=submit]").click();
      await f.waitForFunction(
        () => __OFW_V14__.getState().queries[0]?.status === "success",
      );
      assert.equal(
        await f.evaluate(
          () => __OFW_V14__.getState().queries[0].evidence.rule.ontologyId,
        ),
        "ONT-GROUP-FINANCING-OPTIMIZATION",
      );
      await f.locator("[data-action=report-answer]").first().click();
      assert.equal(
        await f.evaluate(
          () => __OFW_V14__.getState().reports[0].evidence.rule.id,
        ),
        "RULE-OPS-FINANCING-PREMIUM",
      );
      await f.locator("dialog").press("Escape");
    },
  );
  await check(
    "Map labels display enterprise name followed by city and selected popup remains readable",
    async () => {
      await f.locator("[data-action=reset-filters]").first().click();
      await f.locator(".entity-row[data-object-id=ENT-020]").click();
      await f.waitForFunction(() => !__OFW_V14__.getMap().isMoving());
      assert.equal(
        await f.locator(".selected-map-label").innerText(),
        "环保测试公司4（杭州）",
      );
      const label = await f.evaluate(() => {
        const m = __OFW_V14__.getMap();
        return {
          layer: m.getLayer("enterprise-labels").id,
          image: m.hasImage("enterprise-ENT-020"),
        };
      });
      assert.ok(label.image);
      await shot("03-enterprise-city-labels");
      await page.setViewportSize({ width: 390, height: 844 });
      await f.locator("[data-action=close-mobile]").click();
      await shot("04-mobile-label");
      assert.ok(await f.locator(".selected-map-label").isVisible());
      await page.setViewportSize({ width: 1440, height: 900 });
    },
  );
  await check(
    "Rule condition changes are not silently replaced by the last verified condition",
    async () => {
      await page.goto(entry + "?ruleOwner=S001#module/ontology");
      await frame();
      await selectRule("RULE-OPS-FINANCING-PREMIUM");
      await f
        .locator(
          '.inspector-foot [data-action="edit-resource:RULE-OPS-FINANCING-PREMIUM"]',
        )
        .click();
      await f.locator("#rule-condition").fill("不支持的规则条件");
      await f.locator("[data-action=confirm-add-rule]").click();
      await f.locator("[data-owned-rule-action=validate]").click();
      await f.locator(".owned-rule-error").waitFor();
      assert.equal(
        await f.locator("[data-owned-rule-action=apply]").count(),
        0,
      );
      await f
        .locator(
          '.inspector-foot [data-action="edit-resource:RULE-OPS-FINANCING-PREMIUM"]',
        )
        .click();
      await f.locator("#rule-condition").fill("融资成本偏离 > 50 bp");
      await f.locator("[data-action=confirm-add-rule]").click();
    },
  );
  await check(
    "Debt maturity and funding-gap logic belong to the debt-risk ontology",
    async () => {
      await page.goto(entry + "?ruleOwner=S003#module/ontology");
      await frame();
      await selectRule("RULE-OPS-DEBT-LIQUIDITY-GAP");
      assert.match(
        await f.locator("[data-owned-rule-panel]").innerText(),
        /企业债务风险本体/,
      );
      const s = await f.evaluate(() => OFW_M01_PORTFOLIO_STATE);
      const d = s.drafts.find((item) => item.operationsOwner === "S003");
      assert.equal(d.ontologyStableId, "ONT-S003-DEBT-RISK");
      assert.equal(
        d.metrics.filter((item) => item.operationsDefinitionId).length,
        3,
      );
      await f.locator("[data-owned-rule-action=validate]").click();
      await f.locator(".owned-rule-result").waitFor();
      await shot("05-debt-rule");
      await f.locator("[data-owned-rule-action=apply]").click();
      await page.waitForFunction(() => location.hash === "#dashboard");
      await frame();
      await f.waitForFunction(() =>
        Boolean(window.__OFW_V14__?.getState().filters.ruleRef),
      );
      const state = await f.evaluate(() => __OFW_V14__.getState());
      assert.equal(state.filters.ruleRef.ontologyId, "ONT-S003-DEBT-RISK");
      assert.equal(state.filters.gapOnly, true);
    },
  );
  await check(
    "Deprecated standalone rule tab resolves to the native ontology editor",
    async () => {
      await page.goto(entry + "?task=rule-sandbox#module/ontology");
      await frame();
      await f.waitForSelector(".workbench-shell");
      assert.equal(
        await page.locator("[data-module-task=rule-sandbox]").count(),
        0,
      );
      assert.ok(f.url().includes("/composite/ontology/"));
      assert.equal(
        await f.evaluate(
          () =>
            OFW_M01_PORTFOLIO_STATE.drafts.filter(
              (item) => item.operationsOwner,
            ).length,
        ),
        2,
      );
    },
  );
  assert.deepEqual(errors, []);
  await rm(new URL('failure.json',output),{force:true});await rm(new URL('failure.png',output),{force:true});
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
} catch (error) {
  await shot("failure");
  await writeFile(
    new URL("failure.json", output),
    JSON.stringify({ error: error.stack, errors, checks }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
