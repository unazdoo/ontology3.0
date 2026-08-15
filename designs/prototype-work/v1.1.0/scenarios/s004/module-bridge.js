(function () {
  "use strict";

  const STORE = window.S004_STORE;
  const VALIDATORS = window.S004Validators;
  const OWNER_MATRIX = window.S004Contracts.moduleOwners;

  const indexPaths = Object.freeze({
    artifacts: "./artifacts/index.json",
    moduleExports: "./module-exports/index.json",
    checkpoints: "./checkpoints/index.json",
    evidence: "./evidence/index.json"
  });

  async function fetchOptionalJson(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        return Object.freeze({
          status: response.status === 404 ? "not-provided" : "unavailable",
          path: path,
          value: null,
          message: "HTTP " + response.status
        });
      }
      const value = await response.json();
      return Object.freeze({ status: "available", path: path, value: value, message: "" });
    } catch (error) {
      return Object.freeze({
        status: "unavailable",
        path: path,
        value: null,
        message: error && error.message ? error.message : "无法读取资源索引"
      });
    }
  }

  function contextMatches(value) {
    if (!value || typeof value !== "object") return true;
    const candidate = value.scenarioContext || value.context || null;
    if (!candidate) return true;
    try {
      window.OFWScenarioFoundation.assertScenarioContextMatch(STORE.getContext(), candidate);
      return true;
    } catch (_) {
      return false;
    }
  }

  function sanitizeResult(result) {
    if (result.status !== "available") return result;
    if (!contextMatches(result.value)) {
      return Object.freeze({
        status: "rejected-context-mismatch",
        path: result.path,
        value: null,
        message: "资源索引的场景、版本或运行轮次与当前 S004 不一致"
      });
    }
    return result;
  }

  async function loadAll() {
    const entries = await Promise.all(Object.entries(indexPaths).map(async function (entry) {
      const result = sanitizeResult(await fetchOptionalJson(entry[1]));
      return [entry[0], result];
    }));
    const external = Object.fromEntries(entries);
    const moduleIndex = external.moduleExports;
    if (moduleIndex && moduleIndex.status === "available" && moduleIndex.value && moduleIndex.value.exports) {
      const moduleRecords = {};
      const exportEntries = Object.entries(moduleIndex.value.exports);
      await Promise.all(exportEntries.map(async function (entry) {
        if (typeof entry[1] !== "string") return;
        const path = entry[1].startsWith(".") ? entry[1] : "./" + entry[1];
        const result = sanitizeResult(await fetchOptionalJson(path));
        if (result.status === "available") moduleRecords[entry[0]] = result.value;
      }));
      external.moduleExports = Object.freeze({
        ...moduleIndex,
        value: Object.freeze({ ...moduleIndex.value, modules: Object.freeze(moduleRecords) })
      });
    }
    STORE.setExternal(external);
    window.dispatchEvent(new CustomEvent("s004:external", { detail: external }));
    return external;
  }

  function moduleExportFromIndex(moduleId) {
    const external = STORE.get().external;
    const index = external && external.moduleExports && external.moduleExports.value;
    if (!index || typeof index !== "object") return null;
    if (index.modules && index.modules[moduleId]) return index.modules[moduleId];
    if (Array.isArray(index.exports)) {
      return index.exports.find(function (item) { return item && item.moduleId === moduleId; }) || null;
    }
    return index[moduleId] || null;
  }

  function validateModuleExport(moduleId) {
    const record = moduleExportFromIndex(moduleId);
    if (!record) {
      return Object.freeze({
        status: "not-provided",
        moduleId: moduleId,
        owner: OWNER_MATRIX[moduleId] ? OWNER_MATRIX[moduleId].owner : moduleId,
        record: null,
        errors: Object.freeze([])
      });
    }
    const owner = OWNER_MATRIX[moduleId] ? OWNER_MATRIX[moduleId].owner : null;
    const validation = VALIDATORS.validateExternalRecord(record, owner, STORE.getContext());
    return Object.freeze({
      status: validation.ok ? "verified-reference" : "rejected",
      moduleId: moduleId,
      owner: owner,
      record: validation.ok ? record : null,
      errors: validation.errors
    });
  }

  function resourceSummary() {
    const external = STORE.get().external || {};
    return Object.entries(indexPaths).map(function (entry) {
      const result = external[entry[0]] || {};
      return Object.freeze({
        key: entry[0],
        path: entry[1],
        status: result.status || "not-loaded",
        message: result.message || ""
      });
    });
  }

  window.S004Bridge = Object.freeze({
    indexPaths: indexPaths,
    loadAll: loadAll,
    moduleExportFromIndex: moduleExportFromIndex,
    validateModuleExport: validateModuleExport,
    resourceSummary: resourceSummary
  });
})();
