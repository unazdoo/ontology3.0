(function () {
  "use strict";

  const FOUNDATION = window.OFWScenarioFoundation;
  const SOURCE_TAGS = Object.freeze(["official-public", "synthetic-demo", "human-confirmed"]);
  const STEP_STATUSES = Object.freeze(["pending", "running", "verified", "blocked", "not_applicable"]);
  const STABLE_ID_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertScenarioContext(value) {
    const context = FOUNDATION.assertScenarioContext(value);
    if (context.scenarioId !== "S004" || context.scenarioVersion !== "S004-v1") {
      throw new Error("S004 场景拒绝不匹配的场景身份。");
    }
    return context;
  }

  function validateStableId(value) {
    return typeof value === "string" && STABLE_ID_RE.test(value);
  }

  function validateSourceTag(value) {
    return SOURCE_TAGS.includes(value);
  }

  function validateStepStatus(value) {
    return STEP_STATUSES.includes(value);
  }

  function validateExternalRecord(record, expectedOwner, context) {
    const errors = [];
    if (!isPlainObject(record)) errors.push("记录必须是对象");
    const normalizedOwner = function (value) { return String(value || "").replace(/\s+/g, ""); };
    if (record && expectedOwner && normalizedOwner(record.owner) !== normalizedOwner(expectedOwner)) errors.push("Owner 不匹配");
    if (record && record.scenarioContext) {
      try {
        FOUNDATION.assertScenarioContextMatch(context, record.scenarioContext);
      } catch (error) {
        errors.push(error.message || "场景上下文不匹配");
      }
    }
    if (record && record.sourceTag && !validateSourceTag(record.sourceTag)) errors.push("来源标签不合法");
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.S004Validators = Object.freeze({
    SOURCE_TAGS: SOURCE_TAGS,
    STEP_STATUSES: STEP_STATUSES,
    assertScenarioContext: assertScenarioContext,
    validateStableId: validateStableId,
    validateSourceTag: validateSourceTag,
    validateStepStatus: validateStepStatus,
    validateExternalRecord: validateExternalRecord,
    escapeHtml: escapeHtml,
    clone: clone
  });
})();
