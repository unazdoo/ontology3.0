"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const DESIGNS_DIR = path.resolve(RUNTIME_DIR, "../../../..");
const manifest = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, "scenario.manifest.json"), "utf8"));
const loaderSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-loader.js"), "utf8");
const storageProxySource = fs.readFileSync(path.join(RUNTIME_DIR, "scenario-storage-proxy.js"), "utf8");
const m02Source = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-modules/m02-data-engineering.html"), "utf8");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

class MemoryStorage {
  constructor() { this.records = new Map(); }
  get length() { return this.records.size; }
  key(index) { return Array.from(this.records.keys())[index] ?? null; }
  getItem(key) { return this.records.has(String(key)) ? this.records.get(String(key)) : null; }
  setItem(key, value) { this.records.set(String(key), String(value)); }
  removeItem(key) { this.records.delete(String(key)); }
  clear() { this.records.clear(); }
}

class MemoryStorageEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  stopImmediatePropagation() { this.immediatePropagationStopped = true; }
}

function storageRoot() {
  const listeners = new Map();
  const root = {
    location: { search: "" },
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    Storage: MemoryStorage,
    StorageEvent: MemoryStorageEvent,
    addEventListener(type, listener) {
      const values = listeners.get(type) || [];
      values.push(listener);
      listeners.set(type, values);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
    }
  };
  root.window = root;
  root.globalThis = root;
  new Function("window", "globalThis", storageProxySource)(root, root);
  return root;
}

function context(scenarioId, scenarioVersion, scenarioRunId) {
  return {
    scenarioId,
    scenarioVersion,
    scenarioRunId,
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
}

function loaderSearch(moduleId, sourceRef, scenarioContext) {
  return `?${new URLSearchParams({ moduleId, source: sourceRef, ...scenarioContext })}`;
}

function loaderSandbox(search, parentContext) {
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
    parent: { OFW_ACTIVE_SCENARIO_ADAPTER: { context: () => ({ ...parentContext }) } },
    crypto: crypto.webcrypto,
    TextEncoder,
    __OFW_BASELINE_MODULE_LOADER_DISABLE_AUTOBOOT__: true
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", loaderSource)(sandbox, sandbox);
  return { sandbox, api: sandbox.OFWBaselineModuleLoader, writes };
}

test("S001 默认仍使用冻结基线身份，M02 无 S004 上下文时回退原追加行为", () => {
  const entry = manifest.moduleEntryAllowlist.entries.M02;
  const frozen = fs.readFileSync(path.join(DESIGNS_DIR, entry.originReleasePath));
  assert.equal(sha256(frozen), entry.originSha256);
  assert.equal(manifest.baselineVersion, "v1.0.3");
  assert.equal(manifest.baselineSnapshotId, "BSL-S001-V103-DE0119608E26");

  assert.match(m02Source, /return candidate && typeof candidate\.scenarioId === "string"[^;]+: "S001";/);
  assert.match(m02Source, /catch \(_\) \{ return "S001"; \}/);
  const s004Projection = m02Source.indexOf('if (SCENARIO_ID === "S004")');
  const defaultAppend = m02Source.indexOf("flow.customSources.forEach", s004Projection);
  assert.ok(s004Projection >= 0 && defaultAppend > s004Projection, "非 S004 分支必须继续执行基线追加逻辑");
  assert.match(m02Source.slice(s004Projection, defaultAppend + 500), /else \{[\s\S]*flow\.customSources\.forEach/);
});

test("同 Origin 物理存储键同时按 scenarioId、scenarioVersion、scenarioRunId 隔离", () => {
  const root = storageRoot();
  const proxy = root.OFWRuntimeStorage;
  const logicalKey = "ontology3.data-engineering.workspace.v5-handoff";
  const contexts = [
    context("S001", "S001-v1.0.3", "S001-RUN-20260816000000000-aaaaaaaaaaaa"),
    context("S004", "S004-v2.1.0", "S004-RUN-20260816000000000-bbbbbbbbbbbb"),
    context("S004", "S004-v2.1.0", "S004-RUN-20260816000000001-cccccccccccc"),
    context("S004", "S004-v2.2.0", "S004-RUN-20260816000000002-dddddddddddd")
  ];
  const physicalKeys = [];

  contexts.forEach((item, index) => {
    proxy.install({ root, context: item, moduleId: "M02" });
    const prefix = root.OFW_RUNTIME_STORAGE.prefix();
    assert.equal(prefix, `ofw:v1.1.0:runtime:${item.scenarioId}:${item.scenarioVersion}:${item.scenarioRunId}:`);
    const physical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(logicalKey);
    assert.equal(physical.startsWith(prefix), true);
    physicalKeys.push(physical);
    root.localStorage.setItem(logicalKey, `value-${index}`);
    assert.equal(root.localStorage.getItem(logicalKey), `value-${index}`);
  });

  assert.equal(new Set(physicalKeys).size, contexts.length);
  contexts.forEach((item, index) => {
    proxy.install({ root, context: item, moduleId: "M02" });
    assert.equal(root.localStorage.getItem(logicalKey), `value-${index}`);
    assert.equal(root.localStorage.length, 1);
    assert.equal(root.localStorage.key(0), logicalKey);
  });
  assert.deepEqual(physicalKeys.map((key) => root.localStorage.records.get(key)), [
    "value-0", "value-1", "value-2", "value-3"
  ]);
});

test("父子 iframe 场景五字段任一被篡改时 loader 在 fetch 和 document.write 前失败关闭", async () => {
  const entry = manifest.moduleEntryAllowlist.entries.M01;
  const parent = context("S004", "S004-v2.1.0", "S004-RUN-20260816000000000-parentparent");
  const mutations = [
    { scenarioId: "S001", scenarioVersion: "S001-v1.0.3", scenarioRunId: "S001-RUN-20260816000000000-tamperedid1" },
    { scenarioVersion: "S004-v2.2.0" },
    { scenarioRunId: "S004-RUN-20260816000000000-tamperedrun" },
    { formedAt: "2026-08-16T00:00:01.000Z" },
    { status: "restoring" }
  ];

  for (const mutation of mutations) {
    const child = { ...parent, ...mutation };
    const { sandbox, api, writes } = loaderSandbox(loaderSearch("M01", entry.sourceRef, child), parent);
    let fetchCount = 0;
    sandbox.fetch = async () => { fetchCount += 1; throw new Error("不应执行 fetch"); };
    await assert.rejects(() => api.boot(), /父窗口不一致/);
    assert.equal(fetchCount, 0);
    assert.equal(writes.length, 0);
    assert.deepEqual(sandbox.document.documentElement.dataset, {});
  }

  const exact = loaderSandbox(loaderSearch("M01", entry.sourceRef, parent), parent);
  assert.equal(exact.api.validateQuery().moduleId, "M01");
});

