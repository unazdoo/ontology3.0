"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fail } = require("./errors");
const { cloneJson, immutableJson, stableSerialize, assertObject } = require("./utils");

const STORE_SCHEMA_VERSION = "ofw.m06.report-store.v1";
const COLLECTIONS = Object.freeze([
  "reportDefinitions",
  "reportTemplates",
  "fixedViews",
  "dashboardDefinitions",
  "dashboardVersions",
  "generationRequests",
  "generationGateReads",
  "c022Requests",
  "c023Receipts",
  "evidencePacks",
  "handoffAttempts",
  "sourceDrafts",
  "reviewCopies",
  "reviewDecisions",
  "contentVersions",
  "anchors",
  "verificationExtractions",
  "verificationRuns",
  "comparisons",
  "comparisonAttempts",
  "comparisonStaleness",
  "qualityWarnings",
  "artifacts",
  "publicationRuns",
  "regenerationRequests",
  "checkpointReceipts",
  "auditEvents"
]);

function emptyState() {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    revision: 0,
    collections: Object.fromEntries(COLLECTIONS.map((name) => [name, {}])),
    pointers: {
      reports: {},
      dashboards: {},
      fixedViews: {},
      verifications: {},
      comparisons: {}
    }
  };
}

function normalizeState(value) {
  const source = value || emptyState();
  assertObject(source, "report store state");
  const allowedRootFields = new Set(["schemaVersion", "revision", "collections", "pointers"]);
  const unknownRootFields = Object.keys(source).filter((field) => !allowedRootFields.has(field));
  if (unknownRootFields.length) fail("STORE_UNKNOWN_FIELD", "report store contains unknown root fields", { unknownRootFields });
  if (source.schemaVersion !== STORE_SCHEMA_VERSION) {
    fail("STORE_SCHEMA_MISMATCH", `store schemaVersion must be ${STORE_SCHEMA_VERSION}`);
  }
  const result = cloneJson(source);
  result.revision = Number.isInteger(result.revision) && result.revision >= 0 ? result.revision : 0;
  result.collections = result.collections || {};
  const unknownCollections = Object.keys(result.collections).filter((name) => !COLLECTIONS.includes(name));
  if (unknownCollections.length) fail("STORE_UNKNOWN_COLLECTION", "report store contains unknown collections", { unknownCollections });
  COLLECTIONS.forEach((name) => {
    if (!result.collections[name] || typeof result.collections[name] !== "object" || Array.isArray(result.collections[name])) {
      result.collections[name] = {};
    }
  });
  result.pointers = result.pointers || {};
  const pointerNamespaces = ["reports", "dashboards", "fixedViews", "verifications", "comparisons"];
  const unknownPointerNamespaces = Object.keys(result.pointers).filter((name) => !pointerNamespaces.includes(name));
  if (unknownPointerNamespaces.length) fail("STORE_UNKNOWN_POINTER_NAMESPACE", "report store contains unknown pointer namespaces", { unknownPointerNamespaces });
  pointerNamespaces.forEach((name) => {
    if (!result.pointers[name] || typeof result.pointers[name] !== "object" || Array.isArray(result.pointers[name])) {
      result.pointers[name] = {};
    }
    Object.entries(result.pointers[name]).forEach(([key, pointer]) => {
      if (!pointer || typeof pointer !== "object" || Array.isArray(pointer)) {
        fail("STORE_INVALID_POINTER", `report store pointer ${name}.${key} must be an object`);
      }
    });
  });
  return result;
}

function readFileState(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return emptyState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch (error) {
    fail("STORE_READ_FAILED", `cannot read report store ${filePath}`, { cause: error.message });
  }
}

function persistAtomic(filePath, state) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best-effort cleanup */ }
    fail("STORE_WRITE_FAILED", `cannot persist report store ${filePath}`, { cause: error.message });
  }
}

function transactionApi(draft) {
  return Object.freeze({
    append(collection, id, record) {
      if (!COLLECTIONS.includes(collection)) fail("UNKNOWN_COLLECTION", `unknown report collection ${collection}`);
      if (typeof id !== "string" || id.length === 0) fail("INVALID_RECORD_ID", "record id is required");
      const candidate = cloneJson(record, `${collection}.${id}`);
      const existing = draft.collections[collection][id];
      if (existing !== undefined) {
        if (stableSerialize(existing) !== stableSerialize(candidate)) {
          fail("IMMUTABLE_RECORD_CONFLICT", `${collection}.${id} already exists with different content`, { collection, id });
        }
        return immutableJson(existing);
      }
      draft.collections[collection][id] = candidate;
      return immutableJson(candidate);
    },
    setPointer(namespace, key, value) {
      if (!Object.prototype.hasOwnProperty.call(draft.pointers, namespace)) {
        fail("UNKNOWN_POINTER_NAMESPACE", `unknown pointer namespace ${namespace}`);
      }
      draft.pointers[namespace][key] = cloneJson(value, `${namespace}.${key}`);
      return immutableJson(value);
    },
    get(collection, id) {
      return draft.collections[collection]?.[id] ? immutableJson(draft.collections[collection][id]) : null;
    }
  });
}

class ReportStore {
  constructor(options = {}) {
    this.filePath = options.filePath ? path.resolve(options.filePath) : null;
    this.state = normalizeState(options.initialState || readFileState(this.filePath));
  }

  transact(mutator) {
    if (typeof mutator !== "function") fail("INVALID_TRANSACTION", "transaction mutator must be a function");
    const draft = cloneJson(this.state);
    const result = mutator(transactionApi(draft));
    draft.revision = this.state.revision + 1;
    persistAtomic(this.filePath, draft);
    this.state = draft;
    return result === undefined ? null : immutableJson(result);
  }

  append(collection, id, record) {
    return this.transact((transaction) => transaction.append(collection, id, record));
  }

  appendMany(entries, pointerUpdates = []) {
    return this.transact((transaction) => {
      const records = entries.map(({ collection, id, record }) => transaction.append(collection, id, record));
      pointerUpdates.forEach(({ namespace, key, value }) => transaction.setPointer(namespace, key, value));
      return records;
    });
  }

  get(collection, id) {
    const value = this.state.collections[collection]?.[id];
    return value === undefined ? null : immutableJson(value);
  }

  list(collection, predicate) {
    if (!COLLECTIONS.includes(collection)) fail("UNKNOWN_COLLECTION", `unknown report collection ${collection}`);
    const values = Object.values(this.state.collections[collection]).map((value) => cloneJson(value));
    return immutableJson(typeof predicate === "function" ? values.filter(predicate) : values);
  }

  pointer(namespace, key) {
    const value = this.state.pointers[namespace]?.[key];
    return value === undefined ? null : immutableJson(value);
  }

  snapshot() {
    return immutableJson(this.state);
  }

  isEmpty() {
    return COLLECTIONS.every((name) => Object.keys(this.state.collections[name]).length === 0);
  }
}

function createReportStore(options) {
  return new ReportStore(options);
}

module.exports = Object.freeze({ STORE_SCHEMA_VERSION, COLLECTIONS, ReportStore, createReportStore, emptyState, normalizeState });
