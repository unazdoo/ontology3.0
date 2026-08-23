"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const DESIGNS_DIR = path.resolve(RUNTIME_DIR, "../../../..");
const manifest = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, "scenario.manifest.json"), "utf8"));
const loaderSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-loader.js"), "utf8");

function loaderSearch(moduleId, sourceRef, extra = {}) {
  const params = new URLSearchParams({ moduleId, source: sourceRef, ...extra });
  return `?${params}`;
}

function createSandbox(search, parentContext = null) {
  const writes = [];
  const href = `http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html${search}`;
  const sandbox = {
    location: new URL(href),
    document: {
      body: { innerHTML: "" },
      documentElement: { dataset: {} },
      open() {},
      write(value) { writes.push(value); },
      close() {}
    },
    crypto: webcrypto,
    TextEncoder,
    __OFW_BASELINE_MODULE_LOADER_DISABLE_AUTOBOOT__: true
  };
  sandbox.parent = parentContext ? { OFW_ACTIVE_SCENARIO_ADAPTER: { context: () => ({ ...parentContext }) } } : sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", loaderSource)(sandbox, sandbox);
  return { sandbox, api: sandbox.OFWBaselineModuleLoader, writes };
}

test("允许清单只登记六个入口：五个冻结原件、一个 PATCH-REGISTRY M02 参数化副本", async () => {
  const entry = manifest.moduleEntryAllowlist.entries.M04;
  const { api } = createSandbox(loaderSearch("M04", entry.sourceRef));
  const entries = api.validateAllowlist(manifest);
  assert.deepEqual(Object.keys(entries).sort(), ["M01", "M02", "M03", "M04", "M05", "M06"]);
  assert.equal(entries.M04.releasePath.endsWith("/decision-center-prototype/review-v2/action-portfolio.html"), true);
  assert.equal(entries.M02.entryType, "registered-parameterization");
  assert.equal(entries.M02.patchCount, 28);
  assert.deepEqual(entries.M02.diffStats, { baseLines: 3450, adapterLines: 3833, nonEqualBlocks: 60, addedLines: 446, removedLines: 63 });
  assert.equal(entries.M02.patchRegistryPath.endsWith("/baseline-modules/PATCH-REGISTRY.md"), true);
  ["M01", "M03", "M04", "M05", "M06"].forEach((moduleId) => {
    assert.equal(entries[moduleId].entryType, "frozen-release");
    assert.equal(entries[moduleId].releasePath.startsWith("prototype-releases/v1.0.3/"), true);
  });
  for (const [moduleId, allowed] of Object.entries(entries)) {
    const actual = await api.sha256Hex(fs.readFileSync(path.join(DESIGNS_DIR, allowed.releasePath), "utf8"));
    assert.equal(actual, allowed.sha256, `${moduleId} 冻结入口摘要不匹配`);
  }
  const m02Origin = await api.sha256Hex(fs.readFileSync(path.join(DESIGNS_DIR, entries.M02.originReleasePath), "utf8"));
  assert.equal(m02Origin, entries.M02.originSha256);
  const patchRegistry = fs.readFileSync(path.join(DESIGNS_DIR, entries.M02.patchRegistryPath), "utf8");
  assert.match(patchRegistry, new RegExp(entries.M02.originSha256));
  assert.match(patchRegistry, /60 个非等价 diff block/);
  assert.match(patchRegistry, /M02-P06 \| S004 目录投影/);
  assert.match(patchRegistry, /M02-P07 \| 来源内容与下载/);
  assert.match(patchRegistry, /M02-P14 \| 新借款人装配预演/);
  assert.match(patchRegistry, /M02-P18 \| C003 场景用途参数化/);
  assert.match(patchRegistry, /M02-P20 \| C017 消费方边界/);
  assert.match(patchRegistry, /M02-P23 \| C017 精确版本修正/);
  assert.match(patchRegistry, /M02-P26 \| 同源与演示时钟参数化/);
  assert.match(patchRegistry, /M02-P27 \| M01 隐藏交接入口运行层适配/);
  assert.match(patchRegistry, /M02-P28 \| 来源目录与文件入口收敛/);
  assert.match(patchRegistry, /M02-P24 \| 当前实例运行入口/);
  assert.match(patchRegistry, /M02-P25 \| 历史生产核验一致性/);
});

test("loader 以完整 M02 文件 URL 解析资源，但 fragment 路由留在 loader 且保留运行层", async () => {
  const entry = manifest.moduleEntryAllowlist.entries.M02;
  const { sandbox, api, writes } = createSandbox(loaderSearch("M02", entry.sourceRef));
  const baselineUrl = new URL(entry.sourceRef, sandbox.location.href).href;
  const html = fs.readFileSync(path.join(DESIGNS_DIR, entry.releasePath), "utf8");
  sandbox.fetch = async (url) => {
    if (String(url).endsWith("/scenario.manifest.json")) return { ok: true, json: async () => manifest };
    return { ok: true, redirected: false, url: String(url), text: async () => html };
  };
  await api.boot();

  const baseHref = writes[0].match(/<base[^>]+href="([^"]+)"/)?.[1];
  assert.equal(baseHref, baselineUrl);
  assert.match(writes[0], /scenario-storage-proxy\.js\?v=20260816-\d+/);
  assert.match(writes[0], /baseline-module-runtime\.js\?v=20260817-\d+/);
  assert.match(writes[0], /data-ofw-fragment-router="M02"/);
  assert.equal(sandbox.document.documentElement.dataset.ofwBaselineModule, "M02");

  const pathname = sandbox.location.pathname;
  assert.equal(api.routeFragmentInPlace("#/pipelines/pipeline-s004-preflight/canvas"), true);
  assert.equal(sandbox.location.pathname, pathname);
  assert.equal(sandbox.location.pathname.endsWith("/baseline-module-loader.html"), true);
  assert.equal(sandbox.location.hash, "#/pipelines/pipeline-s004-preflight/canvas");
  assert.equal(sandbox.document.documentElement.dataset.ofwBaselineModule, "M02");
  assert.equal(api.routeFragmentInPlace("https://example.com/escape"), false);
});

test("loader 拒绝未知参数、重复参数、模块错配、旧 M04 入口及 source query/hash 篡改", () => {
  const m04 = manifest.moduleEntryAllowlist.entries.M04;
  assert.throws(() => createSandbox(`${loaderSearch("M04", m04.sourceRef)}&evil=1`).api.validateQuery(), /不允许的加载参数/);
  assert.throws(() => createSandbox(`${loaderSearch("M04", m04.sourceRef)}&moduleId=M05`).api.validateQuery(), /不得重复/);

  const mismatched = createSandbox(loaderSearch("M04", manifest.moduleEntryAllowlist.entries.M05.sourceRef));
  assert.throws(() => mismatched.api.resolveAllowedEntry(mismatched.api.validateQuery(), mismatched.api.validateAllowlist(manifest)), /未登记或已被篡改/);

  const oldM04 = "../../../../prototype-releases/v1.0.3/decision-center-prototype/index.html";
  const oldEntry = createSandbox(loaderSearch("M04", oldM04));
  assert.throws(() => oldEntry.api.resolveAllowedEntry(oldEntry.api.validateQuery(), oldEntry.api.validateAllowlist(manifest)), /未登记或已被篡改/);

  for (const suffix of ["?v=evil", "#redirect"]) {
    const changed = createSandbox(loaderSearch("M04", `${m04.sourceRef}${suffix}`));
    assert.throws(() => changed.api.resolveAllowedEntry(changed.api.validateQuery(), changed.api.validateAllowlist(manifest)), /未登记或已被篡改/);
  }
});

test("loader 校验父窗口场景身份并拒绝场景 query 篡改", () => {
  const entry = manifest.moduleEntryAllowlist.entries.M01;
  const expected = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-abcdef123456",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const matching = createSandbox(loaderSearch("M01", entry.sourceRef, {
    ...expected,
    contextCreatedAt: expected.formedAt,
    contextStatus: expected.status,
    scenarioFormedAt: expected.formedAt,
    scenarioStatus: expected.status
  }), expected);
  assert.equal(matching.api.validateQuery().moduleId, "M01");

  const tampered = createSandbox(loaderSearch("M01", entry.sourceRef, {
    ...expected,
    scenarioRunId: "S004-RUN-TAMPERED",
    contextCreatedAt: expected.formedAt,
    contextStatus: expected.status,
    scenarioFormedAt: expected.formedAt,
    scenarioStatus: expected.status
  }), expected);
  assert.throws(() => tampered.api.validateQuery(), /父窗口不一致/);

  const aliasConflict = createSandbox(loaderSearch("M01", entry.sourceRef, {
    ...expected,
    contextCreatedAt: "2026-08-16T01:00:00.000Z"
  }), expected);
  assert.throws(() => aliasConflict.api.validateQuery(), /参数不一致/);
});

test("loader 成功路径先核验清单与 SHA-256 再注入运行层", async () => {
  const entry = manifest.moduleEntryAllowlist.entries.M04;
  const { sandbox, api, writes } = createSandbox(loaderSearch("M04", entry.sourceRef));
  const html = fs.readFileSync(path.join(DESIGNS_DIR, entry.releasePath), "utf8");
  sandbox.fetch = async (url) => {
    if (String(url).endsWith("/scenario.manifest.json")) return { ok: true, json: async () => manifest };
    return { ok: true, redirected: false, url: String(url), text: async () => html };
  };
  await api.boot();
  assert.equal(writes.length, 1);
  assert.match(writes[0], /scenario-storage-proxy\.js\?v=20260816-\d+/);
  assert.match(writes[0], /baseline-module-runtime\.js\?v=20260817-\d+/);
  assert.equal(sandbox.document.documentElement.dataset.ofwBaselineModule, "M04");
  assert.equal(sandbox.document.documentElement.dataset.ofwBaselineSha256, entry.sha256);
});

test("loader 在冻结入口内容摘要不匹配时失败关闭", async () => {
  const entry = manifest.moduleEntryAllowlist.entries.M06;
  const { sandbox, api, writes } = createSandbox(loaderSearch("M06", entry.sourceRef));
  sandbox.fetch = async (url) => {
    if (String(url).endsWith("/scenario.manifest.json")) return { ok: true, json: async () => manifest };
    return { ok: true, redirected: false, url: String(url), text: async () => "tampered baseline" };
  };
  await assert.rejects(() => api.boot(), /SHA-256 不匹配/);
  assert.equal(writes.length, 0);
});
