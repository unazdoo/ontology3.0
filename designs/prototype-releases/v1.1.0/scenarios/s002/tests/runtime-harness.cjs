"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const scenarioRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(scenarioRoot, "../..");
const foundationPath = path.join(workspaceRoot, "foundation/ofw-scenario-foundation.js");

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
    entries() { return [...values.entries()]; }
  };
}

function deterministicCrypto(seed = 0x5a17) {
  let state = seed >>> 0;
  return {
    subtle: webcrypto.subtle,
    getRandomValues(array) {
      for (let index = 0; index < array.length; index += 1) {
        state = (state * 1664525 + 1013904223) >>> 0;
        array[index] = state & 0xff;
      }
      return array;
    }
  };
}

function createRuntime(options = {}) {
  let currentTime = Date.parse(options.startIso || "2026-08-15T02:00:00.000Z");
  const storage = options.storage || createMemoryStorage();

  class RuntimeDate extends Date {
    constructor(...args) { super(args.length ? args[0] : currentTime); }
    static now() { return currentTime; }
  }

  const runtimeWindow = { localStorage: storage, location: { search: "" } };
  const sandbox = {
    window: runtimeWindow,
    URLSearchParams,
    TextEncoder,
    Date: RuntimeDate,
    setTimeout,
    clearTimeout,
    console,
    crypto: deterministicCrypto(options.randomSeed),
    fetch: options.fetch
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(foundationPath, "utf8"), sandbox, { filename: foundationPath });
  runtimeWindow.OFWScenarioFoundation = sandbox.OFWScenarioFoundation;
  for (const fileName of ["data.js", "state.js"]) {
    const filePath = path.join(scenarioRoot, fileName);
    vm.runInContext(fs.readFileSync(filePath, "utf8"), sandbox, { filename: filePath });
  }

  return {
    window: runtimeWindow,
    store: runtimeWindow.S002_STORE,
    data: runtimeWindow.S002_DATA,
    foundation: runtimeWindow.OFWScenarioFoundation,
    storage,
    advance(milliseconds = 60000) { currentTime += milliseconds; return new Date(currentTime).toISOString(); },
    now() { return new Date(currentTime).toISOString(); }
  };
}

module.exports = Object.freeze({ createMemoryStorage, createRuntime, scenarioRoot });
