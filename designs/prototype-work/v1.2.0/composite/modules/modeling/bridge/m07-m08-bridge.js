(function installM07M08Bridge(global) {
  "use strict";

  const CONTRACT = Object.freeze({
    schemaVersion: "ofw.m07-m08.bridge.v1",
    sourceModuleId: "m07",
    sourceRoute: "#module/m07",
    targetModuleId: "modeling",
    targetRoute: "#module/modeling",
    openEvent: "OFW_M07_OPEN_M08",
    deliverEvent: "OFW_M08_DELIVER_CONTEXT",
    returnEvent: "OFW_M08_RETURN_TO_M07"
  });
  const IDENTITY_FIELDS = Object.freeze([
    "scenarioId",
    "scenarioVersion",
    "scenarioRunId",
    "formedAt",
    "status"
  ]);

  function required(value, name) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) throw new TypeError(`${name} is required`);
    return normalized;
  }

  function scenarioIdentity(value) {
    const source = value?.scenarioContext || value?.payload?.scenarioContext || value?.payload || value || {};
    const identity = {
      scenarioId: required(source.scenarioId, "scenarioId"),
      scenarioVersion: required(source.scenarioVersion, "scenarioVersion"),
      scenarioRunId: required(source.scenarioRunId, "scenarioRunId"),
      formedAt: required(source.formedAt, "formedAt"),
      status: required(source.status, "status")
    };
    if (Number.isNaN(Date.parse(identity.formedAt))) throw new TypeError("formedAt must be an ISO timestamp");
    return Object.freeze(identity);
  }

  function sameScenario(left, right) {
    const a = scenarioIdentity(left);
    const b = scenarioIdentity(right);
    return IDENTITY_FIELDS.every((field) => a[field] === b[field]);
  }

  function moduleUrl(modulePath, identity, apiBase = "http://127.0.0.1:4357") {
    const scenario = scenarioIdentity(identity);
    const query = new URLSearchParams({ ...scenario, apiBase });
    return `${modulePath}?${query.toString()}`;
  }

  function acceptM07Open(message, activeScenario) {
    if (message?.type !== CONTRACT.openEvent) throw new TypeError(`Expected ${CONTRACT.openEvent}`);
    if (message.sourceModuleId && message.sourceModuleId !== CONTRACT.sourceModuleId) {
      throw new TypeError(`M07 sourceModuleId must be ${CONTRACT.sourceModuleId}`);
    }
    if (message.sourceRoute && message.sourceRoute !== CONTRACT.sourceRoute) {
      throw new TypeError(`M07 sourceRoute must be ${CONTRACT.sourceRoute}`);
    }
    if (!sameScenario(message.payload, activeScenario)) throw new TypeError("M07 handoff scenario does not match the active scenario");
    if (!message.payload?.objectRef?.id || !message.payload?.objectRef?.objectTypeRef) {
      throw new TypeError("M07 handoff objectRef.id and objectRef.objectTypeRef are required");
    }
    const identity = scenarioIdentity(activeScenario);
    return Object.freeze({
      ...message.payload,
      ...identity,
      scenarioContext: identity,
      sourceModuleId: CONTRACT.sourceModuleId,
      sourceRoute: CONTRACT.sourceRoute
    });
  }

  function deliveryMessage(payload, activeScenario) {
    if (!sameScenario(payload, activeScenario)) throw new TypeError("M08 delivery scenario does not match the active scenario");
    const identity = scenarioIdentity(activeScenario);
    if (payload?.explorationHandoff && !sameScenario(payload.explorationHandoff, identity)) {
      throw new TypeError("M07 explorationHandoff scenario does not match the active scenario");
    }
    return Object.freeze({
      type: CONTRACT.deliverEvent,
      targetModuleId: CONTRACT.targetModuleId,
      payload: Object.freeze({
        ...payload,
        scenarioContext: identity
      })
    });
  }

  function returnMessage(payload, activeScenario) {
    const identity = scenarioIdentity(activeScenario);
    if (!payload?.inputManifest || !payload?.resultEnvelope) {
      throw new TypeError("inputManifest and resultEnvelope are required");
    }
    if (!sameScenario(payload.inputManifest, identity)) {
      throw new TypeError("inputManifest scenario does not match the active scenario");
    }
    if (!sameScenario(payload.resultEnvelope.inputSnapshot, identity)) {
      throw new TypeError("resultEnvelope scenario does not match the active scenario");
    }
    return Object.freeze({
      type: CONTRACT.returnEvent,
      targetModuleId: CONTRACT.sourceModuleId,
      targetRoute: CONTRACT.sourceRoute,
      payload: Object.freeze({ ...payload, ...identity })
    });
  }

  global.OFW_M07_M08_BRIDGE = Object.freeze({
    CONTRACT,
    IDENTITY_FIELDS,
    scenarioIdentity,
    sameScenario,
    moduleUrl,
    acceptM07Open,
    deliveryMessage,
    returnMessage
  });
})(globalThis);
