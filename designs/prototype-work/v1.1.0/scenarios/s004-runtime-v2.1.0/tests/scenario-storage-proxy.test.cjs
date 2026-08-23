"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");

class FakeStorage {
  constructor() { this.records = new Map(); this.maxChars = Number.POSITIVE_INFINITY; }
  get length() { return this.records.size; }
  key(index) { return Array.from(this.records.keys())[index] ?? null; }
  getItem(key) { return this.records.has(String(key)) ? this.records.get(String(key)) : null; }
  setItem(key, value) {
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    const next = new Map(this.records);
    next.set(normalizedKey, normalizedValue);
    const size = [...next.entries()].reduce((sum, [itemKey, itemValue]) => sum + itemKey.length + itemValue.length, 0);
    if (size > this.maxChars) {
      const error = new Error("storage quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.records = next;
  }
  removeItem(key) { this.records.delete(String(key)); }
  clear() { this.records.clear(); }
}

class FakeStorageEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
    this.immediatePropagationStopped = false;
  }
  stopImmediatePropagation() { this.immediatePropagationStopped = true; }
}

function context(scenarioId, runSuffix) {
  return {
    scenarioId,
    scenarioVersion: `${scenarioId}-v2.1.0`,
    scenarioRunId: `${scenarioId}-RUN-${runSuffix}`,
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
}

function createRoot() {
  class RootStorage extends FakeStorage {}
  Object.defineProperty(RootStorage.prototype, "length", Object.getOwnPropertyDescriptor(FakeStorage.prototype, "length"));
  const listeners = new Map();
  const root = {
    location: { search: "", origin: "http://127.0.0.1" },
    localStorage: new RootStorage(),
    sessionStorage: new RootStorage(),
    Storage: RootStorage,
    StorageEvent: FakeStorageEvent,
    addEventListener(type, listener) {
      const values = listeners.get(type) || [];
      values.push(listener);
      listeners.set(type, values);
    },
    dispatchEvent(event) {
      for (const listener of [...(listeners.get(event.type) || [])]) {
        if (event.immediatePropagationStopped) break;
        listener(event);
      }
      return !event.immediatePropagationStopped;
    }
  };
  root.parent = root;
  root.window = root;
  root.globalThis = root;
  return root;
}

function loadProxy(root) {
  const source = fs.readFileSync(path.join(RUNTIME_DIR, "scenario-storage-proxy.js"), "utf8");
  new Function("window", "globalThis", source)(root, root);
  return root.OFWRuntimeStorage;
}

test("localStorage/sessionStorage 的 get set remove clear key length 按场景轮次隔离", () => {
  const root = createRoot();
  const proxy = loadProxy(root);
  const a = context("S001", "A");
  const b = context("S004", "B");
  const localKey = "ontology3-decision-center-review-v2-portfolio-state-v6";
  const m04ViewKey = "ontology3-decision-center-view-v2-portfolio";
  const m06TabKey = "ontology3.report-center.lifecycle-review.v1.active-tab";

  proxy.install({ root, context: a, moduleId: "M04" });
  root.localStorage.setItem(localKey, "A-local");
  root.sessionStorage.setItem(m04ViewKey, "A-view");
  root.sessionStorage.setItem(m06TabKey, "A-tab");
  root.sessionStorage.setItem("shared-nonlegacy", "shared");
  const aLocalPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(localKey);
  const aViewPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(m04ViewKey);
  const aTabPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(m06TabKey);

  proxy.install({ root, context: b, moduleId: "M04" });
  assert.equal(root.localStorage.getItem(localKey), null);
  assert.equal(root.sessionStorage.getItem(m04ViewKey), null);
  assert.equal(root.sessionStorage.getItem(m06TabKey), null);
  assert.equal(root.sessionStorage.length, 1);
  assert.equal(root.sessionStorage.key(0), "shared-nonlegacy");

  root.localStorage.setItem(localKey, "B-local");
  root.sessionStorage.setItem(m04ViewKey, "B-view");
  root.sessionStorage.setItem(m06TabKey, "B-tab");
  const bLocalPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(localKey);
  const bViewPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(m04ViewKey);
  const bTabPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(m06TabKey);
  assert.notEqual(aLocalPhysical, bLocalPhysical);
  assert.notEqual(aViewPhysical, bViewPhysical);
  assert.notEqual(aTabPhysical, bTabPhysical);
  assert.deepEqual(Array.from({ length: root.sessionStorage.length }, (_, index) => root.sessionStorage.key(index)).sort(), [m04ViewKey, m06TabKey, "shared-nonlegacy"].sort());

  root.sessionStorage.removeItem(m04ViewKey);
  assert.equal(root.sessionStorage.getItem(m04ViewKey), null);
  assert.equal(root.sessionStorage.records.get(aViewPhysical), "A-view");
  root.localStorage.clear();
  root.sessionStorage.clear();
  assert.equal(root.localStorage.records.has(bLocalPhysical), false);
  assert.equal(root.sessionStorage.records.has(bTabPhysical), false);
  assert.equal(root.localStorage.records.get(aLocalPhysical), "A-local");
  assert.equal(root.sessionStorage.records.get(aViewPhysical), "A-view");
  assert.equal(root.sessionStorage.records.get(aTabPhysical), "A-tab");
  assert.equal(root.sessionStorage.getItem("shared-nonlegacy"), "shared");

  proxy.install({ root, context: a, moduleId: "M04" });
  assert.equal(root.localStorage.getItem(localKey), "A-local");
  assert.equal(root.sessionStorage.getItem(m04ViewKey), "A-view");
  assert.equal(root.sessionStorage.getItem(m06TabKey), "A-tab");
  assert.equal(root.sessionStorage.length, 3);
  assert.deepEqual(Array.from({ length: root.sessionStorage.length }, (_, index) => root.sessionStorage.key(index)).sort(), [m04ViewKey, m06TabKey, "shared-nonlegacy"].sort());
});

test("localStorage 配额不足时只把当前逻辑键溢出到同轮次 sessionStorage", () => {
  const root = createRoot();
  root.localStorage.maxChars = 320;
  root.localStorage.setItem("shared-capacity", "x".repeat(220));
  const proxy = loadProxy(root);
  const current = context("S004", "QUOTA");
  const key = "ontology3-canvas-first-review-v17";
  const value = "y".repeat(220);

  proxy.install({ root, context: current, moduleId: "M01" });
  const physical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(key);
  const overflow = root.OFW_RUNTIME_STORAGE.toOverflowKey(key);
  root.localStorage.setItem(key, value);

  assert.equal(root.localStorage.records.has(physical), false);
  assert.equal(root.sessionStorage.records.get(overflow), value);
  assert.equal(root.localStorage.getItem(key), value);
  assert.equal(Array.from({ length: root.localStorage.length }, (_, index) => root.localStorage.key(index)).includes(key), true);
  assert.equal(Array.from({ length: root.sessionStorage.length }, (_, index) => root.sessionStorage.key(index)).includes(key), false);

  root.localStorage.removeItem("shared-capacity");
  root.localStorage.setItem(key, "small-state");
  assert.equal(root.localStorage.records.get(physical), "small-state");
  assert.equal(root.sessionStorage.records.has(overflow), false);
  assert.equal(root.localStorage.getItem(key), "small-state");
});

test("跨模块合同溢出到场景外壳共享存储并可由另一 iframe 同轮次读取", () => {
  const writer = createRoot();
  const shellLocalStorage = new writer.Storage();
  const shellSessionStorage = new writer.Storage();
  const shell = {
    location: { origin: writer.location.origin },
    localStorage: shellLocalStorage,
    sessionStorage: shellSessionStorage
  };
  writer.parent = shell;
  shellLocalStorage.maxChars = 260;
  shellLocalStorage.setItem("shared-capacity", "x".repeat(180));
  const current = context("S004", "SHARED-OVERFLOW");
  const contractKey = "ontology3.agent-application.c022-inbox.v1";
  const contractValue = JSON.stringify({ contractCode: "C022", requests: [{ requestId: "RGEN-S004-001" }] });
  const writerProxy = loadProxy(writer);

  writerProxy.install({ root: writer, context: current, moduleId: "M06" });
  const overflowKey = writer.OFW_RUNTIME_STORAGE.toOverflowKey(contractKey);
  writer.localStorage.setItem(contractKey, contractValue);

  assert.equal(writer.OFW_RUNTIME_STORAGE.canonicalStorageScope(), "scenario-shell");
  assert.equal(writer.OFW_RUNTIME_STORAGE.overflowStorageScope(), "scenario-shell");
  assert.equal(writer.sessionStorage.records.has(overflowKey), false);
  assert.equal(shellSessionStorage.records.get(overflowKey), contractValue);
  assert.equal(writer.localStorage.getItem(contractKey), contractValue);

  const reader = createRoot();
  reader.parent = shell;
  const readerProxy = loadProxy(reader);
  readerProxy.install({ root: reader, context: current, moduleId: "M05" });
  assert.equal(reader.OFW_RUNTIME_STORAGE.canonicalStorageScope(), "scenario-shell");
  assert.equal(reader.OFW_RUNTIME_STORAGE.overflowStorageScope(), "scenario-shell");
  assert.equal(reader.localStorage.getItem(contractKey), contractValue);

  const otherRun = createRoot();
  otherRun.parent = shell;
  const otherProxy = loadProxy(otherRun);
  otherProxy.install({ root: otherRun, context: context("S004", "OTHER-RUN"), moduleId: "M05" });
  assert.equal(otherRun.localStorage.getItem(contractKey), null);

  reader.localStorage.removeItem(contractKey);
  assert.equal(shellSessionStorage.records.has(overflowKey), false);
  assert.equal(writer.localStorage.getItem(contractKey), null);
});

test("跨模块小型合同使用场景外壳 canonical localStorage 并保持轮次隔离", () => {
  const writer = createRoot();
  const shell = {
    location: { origin: writer.location.origin },
    localStorage: new writer.Storage(),
    sessionStorage: new writer.Storage()
  };
  writer.parent = shell;
  const current = context("S004", "SHARED-CANONICAL");
  const key = "ontology3.agent-application.c024-inbox.v1";
  const value = JSON.stringify({ contractCode: "C024", requestId: "C024-S004-001" });
  const writerProxy = loadProxy(writer);
  writerProxy.install({ root: writer, context: current, moduleId: "M06" });
  const physical = writer.OFW_RUNTIME_STORAGE.toPhysicalKey(key);
  writer.localStorage.setItem(key, value);

  assert.equal(writer.localStorage.records.has(physical), false);
  assert.equal(shell.localStorage.records.get(physical), value);

  const reader = createRoot();
  reader.parent = shell;
  loadProxy(reader).install({ root: reader, context: current, moduleId: "M05" });
  assert.equal(reader.localStorage.getItem(key), value);

  const otherScenario = createRoot();
  otherScenario.parent = shell;
  loadProxy(otherScenario).install({ root: otherScenario, context: context("S002", "SHARED-CANONICAL"), moduleId: "M05" });
  assert.equal(otherScenario.localStorage.getItem(key), null);
});

test("storage 事件只向当前场景暴露逻辑键并屏蔽其他轮次、未隔离旧键与 clear", () => {
  const root = createRoot();
  const proxy = loadProxy(root);
  const a = context("S001", "A");
  const b = context("S004", "B");
  const key = "ontology3-decision-center-view-v2-portfolio";

  proxy.install({ root, context: a, moduleId: "M04" });
  const aPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(key);
  proxy.install({ root, context: b, moduleId: "M04" });
  const bPhysical = root.OFW_RUNTIME_STORAGE.toPhysicalKey(key);
  const observed = [];
  root.addEventListener("storage", (event) => observed.push({ key: event.key, newValue: event.newValue }));

  root.dispatchEvent(new root.StorageEvent("storage", { key: bPhysical, newValue: "B", storageArea: root.sessionStorage, url: "http://127.0.0.1" }));
  root.dispatchEvent(new root.StorageEvent("storage", { key: aPhysical, newValue: "A", storageArea: root.sessionStorage, url: "http://127.0.0.1" }));
  root.dispatchEvent(new root.StorageEvent("storage", { key, newValue: "legacy", storageArea: root.sessionStorage, url: "http://127.0.0.1" }));
  root.dispatchEvent(new root.StorageEvent("storage", { key: null, newValue: null, storageArea: root.sessionStorage, url: "http://127.0.0.1" }));
  root.dispatchEvent(new root.StorageEvent("storage", { key: "shared-nonlegacy", newValue: "shared", storageArea: root.sessionStorage, url: "http://127.0.0.1" }));

  assert.deepEqual(observed, [
    { key, newValue: "B" },
    { key: "shared-nonlegacy", newValue: "shared" }
  ]);
  assert.equal(proxy.isLegacyKey("ontology3-decision-center-view-v2-portfolio"), true);
  assert.equal(proxy.isLegacyKey("ontology3.report-center.lifecycle-review.v1.active-tab"), true);
});
