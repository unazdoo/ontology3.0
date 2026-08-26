"use strict";

const contracts = require("../contracts");
const identity = require("../identity");
const { fail } = require("./errors");
const { assertObject, assertString, immutableJson } = require("./utils");

const FOUNDATION_CONTRACT_VERSION = contracts.CONTRACT_SCHEMA_VERSION;
const M06_BOUNDARY_VERSION = "ofw.m06.foundation-boundary.v1";

function assertFoundationCompatibility(schemaVersion) {
  try {
    const result = contracts.assertSchemaCompatibility(schemaVersion, FOUNDATION_CONTRACT_VERSION);
    if (result.status !== contracts.COMPATIBILITY_STATUS.EXACT) {
      fail("FOUNDATION_SCHEMA_NOT_EXACT", "M06 only accepts the exact registered Foundation schema version", result);
    }
    return result;
  } catch (error) {
    if (error.code === "FOUNDATION_SCHEMA_NOT_EXACT") throw error;
    fail("FOUNDATION_SCHEMA_INCOMPATIBLE", "Foundation schema compatibility check failed closed", {
      schemaVersion,
      expected: FOUNDATION_CONTRACT_VERSION,
      compatibility: error.result || null
    });
  }
}

function assertStrictScenarioContext(value, expected, label = "scenarioContext") {
  let context;
  try {
    context = contracts.assertScenarioContext(value, { allowUnknown: false });
  } catch (error) {
    fail("STRICT_SCENARIO_CONTEXT_INVALID", `${label} failed strict Foundation validation`, {
      errors: error.errors || null
    });
  }
  if (expected) {
    let expectedContext;
    try {
      expectedContext = contracts.assertScenarioContext(expected, { allowUnknown: false });
    } catch (error) {
      fail("STRICT_SCENARIO_CONTEXT_INVALID", `expected ${label} failed strict Foundation validation`, {
        errors: error.errors || null
      });
    }
    if (!identity.sameRunContext(context, expectedContext)) {
      fail("SCENARIO_CONTEXT_MISMATCH", `${label} belongs to a different scenario run`, {
        expected: expectedContext,
        actual: context
      });
    }
  }
  return immutableJson(context);
}

function payloadScenarioContext(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload.scenarioContext || payload.reportContext?.scenarioContext || null;
}

function isContractEnvelope(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "eventId")
    && Object.prototype.hasOwnProperty.call(value, "eventType")
    && Object.prototype.hasOwnProperty.call(value, "schemaVersion")
    && Object.prototype.hasOwnProperty.call(value, "payload"));
}

function assertStrictContractEnvelope(value, options = {}) {
  assertObject(value, "contract envelope");
  assertFoundationCompatibility(value.schemaVersion);
  let envelope;
  try {
    envelope = contracts.assertContractEnvelope(value, { allowUnknown: false });
  } catch (error) {
    fail("STRICT_CONTRACT_ENVELOPE_INVALID", "contract envelope failed strict Foundation validation", {
      errors: error.errors || null
    });
  }
  const scenarioContext = assertStrictScenarioContext(envelope.scenarioContext, options.scenarioContext);
  if (options.eventType && envelope.eventType !== options.eventType) {
    fail("CONTRACT_EVENT_TYPE_MISMATCH", `expected eventType ${options.eventType}`, {
      actual: envelope.eventType
    });
  }
  if (options.payloadSchemaVersion) {
    assertObject(envelope.payload, "contract envelope payload");
    if (envelope.payload.schemaVersion !== options.payloadSchemaVersion) {
      fail("PAYLOAD_SCHEMA_MISMATCH", `expected payload schemaVersion ${options.payloadSchemaVersion}`, {
        actual: envelope.payload.schemaVersion
      });
    }
  }
  const embeddedContext = payloadScenarioContext(envelope.payload);
  if (embeddedContext) assertStrictScenarioContext(embeddedContext, scenarioContext, "payload.scenarioContext");
  if (typeof options.payloadValidator === "function") {
    const result = options.payloadValidator(envelope.payload);
    if (result === false || result?.valid === false || result?.ok === false) {
      fail("PAYLOAD_VALIDATION_FAILED", "contract envelope payload failed the registered M06 validator", {
        errors: result?.errors || null
      });
    }
  }
  return immutableJson({ ...envelope, scenarioContext });
}

function createStrictContractEnvelope(input) {
  assertObject(input, "contract envelope input");
  const scenarioContext = assertStrictScenarioContext(input.scenarioContext, null);
  const envelope = {
    eventId: assertString(input.eventId, "eventId"),
    eventType: assertString(input.eventType, "eventType"),
    schemaVersion: FOUNDATION_CONTRACT_VERSION,
    occurredAt: assertString(input.occurredAt, "occurredAt"),
    actorRef: input.actorRef,
    correlationId: assertString(input.correlationId, "correlationId"),
    traceId: assertString(input.traceId, "traceId"),
    idempotencyKey: assertString(input.idempotencyKey, "idempotencyKey"),
    scenarioContext,
    resourceRefs: Array.isArray(input.resourceRefs) ? input.resourceRefs : [],
    evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    payload: input.payload
  };
  return assertStrictContractEnvelope(envelope, {
    scenarioContext,
    eventType: envelope.eventType,
    payloadSchemaVersion: input.payloadSchemaVersion,
    payloadValidator: input.payloadValidator
  });
}

function unwrapStrictContractEnvelope(value, options = {}) {
  return assertStrictContractEnvelope(value, options).payload;
}

module.exports = Object.freeze({
  FOUNDATION_CONTRACT_VERSION,
  M06_BOUNDARY_VERSION,
  assertFoundationCompatibility,
  assertStrictScenarioContext,
  isContractEnvelope,
  assertStrictContractEnvelope,
  createStrictContractEnvelope,
  unwrapStrictContractEnvelope
});
