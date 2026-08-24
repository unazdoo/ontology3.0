"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const report = require("./index.js");

const CONTEXT = Object.freeze({
  scenarioId: "S001",
  scenarioVersion: "S001-v1.1.0",
  scenarioRunId: "S001-RUN-20260824220000000-foundation",
  formedAt: "2026-08-24T22:00:00.000Z",
  status: "active"
});

function envelope(eventType, payload, sequence = 1) {
  return report.createStrictContractEnvelope({
    eventId: `EVT-M06-${sequence}`,
    eventType,
    occurredAt: `2026-08-24T22:00:0${sequence}.000Z`,
    actorRef: "module-owner",
    correlationId: `CORR-M06-${sequence}`,
    traceId: `TRACE-M06-${sequence}`,
    idempotencyKey: `IDEM-M06-${sequence}`,
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: [],
    payload,
    payloadSchemaVersion: payload.schemaVersion
  });
}

function c008Payload(receiptId = "READ-C008-1") {
  return {
    schemaVersion: "ofw.c008.authority-projection.v1",
    c008Id: "C008-S001-FOUNDATION",
    version: "1.0.0",
    status: "ready",
    scenarioContext: CONTEXT,
    authoritativeRead: {
      receiptId,
      owner: "M01",
      source: "owner-api",
      mode: report.LIVE_READ_MODE,
      readAt: "2026-08-24T22:00:01.000Z"
    },
    consumptionReadiness: { status: "ready" },
    currentAuthority: {
      t019: { id: "T019-S001-CURRENT", version: "1.0.0", status: "active" },
      publishedSemanticVersion: { id: "SEM-S001-001", version: "1.0.0" },
      dataVersion: { id: "DATA-S001-001", t008: "2026-08-24T21:59:59.000Z" },
      facts: []
    }
  };
}

function c017Payload(receiptId = "READ-C017-1") {
  return {
    schemaVersion: "ofw.c017.trust-summary.v1",
    summaryId: "C017-S001-FOUNDATION",
    version: "1.0.0",
    summaryType: "generation-binding",
    formedAt: "2026-08-24T22:00:01.000Z",
    status: "ready",
    scenarioContext: CONTEXT,
    authoritativeRead: {
      receiptId,
      owner: "M02",
      source: "owner-api",
      mode: report.LIVE_READ_MODE,
      readAt: "2026-08-24T22:00:01.000Z"
    },
    consumptionReadiness: { status: "ready" },
    binding: {
      semanticVersionId: "SEM-S001-001",
      semanticVersion: "1.0.0",
      dataVersionId: "DATA-S001-001",
      t008: "2026-08-24T21:59:59.000Z"
    },
    quality: { status: "pass", hardFailure: false }
  };
}

test("M06 strict Contract Envelope accepts only the exact Foundation baseline", () => {
  const value = envelope("M01.C008.Read", c008Payload());
  assert.equal(value.schemaVersion, report.FOUNDATION_CONTRACT_VERSION);
  assert.equal(report.unwrapStrictContractEnvelope(value, {
    scenarioContext: CONTEXT,
    payloadSchemaVersion: "ofw.c008.authority-projection.v1"
  }).c008Id, "C008-S001-FOUNDATION");

  for (const schemaVersion of ["draft-0.1.1", "draft-0.2.0", "0.1.0", "bad-version"]) {
    assert.throws(
      () => report.assertStrictContractEnvelope({ ...value, schemaVersion }),
      (error) => ["FOUNDATION_SCHEMA_INCOMPATIBLE", "FOUNDATION_SCHEMA_NOT_EXACT"].includes(error.code)
    );
  }
});

test("M06 strict Envelope and ScenarioContext reject unknown fields and run mismatch", () => {
  const value = envelope("M01.C008.Read", c008Payload());
  assert.throws(
    () => report.assertStrictContractEnvelope({ ...value, futureEnvelopeField: true }),
    (error) => error.code === "STRICT_CONTRACT_ENVELOPE_INVALID"
  );
  assert.throws(
    () => report.assertStrictContractEnvelope({
      ...value,
      scenarioContext: { ...value.scenarioContext, futureContextField: true }
    }),
    (error) => error.code === "STRICT_CONTRACT_ENVELOPE_INVALID"
  );
  assert.throws(
    () => report.assertStrictContractEnvelope({
      ...value,
      payload: {
        ...value.payload,
        scenarioContext: { ...value.payload.scenarioContext, scenarioRunId: "S001-RUN-20260824220000000-other" }
      }
    }),
    (error) => error.code === "SCENARIO_CONTEXT_MISMATCH"
  );
  assert.throws(
    () => report.assertScenarioContext({ ...CONTEXT, futureContextField: true }, { allowUnknown: true }),
    (error) => error.code === "ERR_CONTRACT_VALIDATION"
  );
});

test("C008/C017 generation gate validates Foundation envelopes before domain use", async () => {
  let sequence = 0;
  const gate = await report.readGenerationGate({
    stage: "before-evidence",
    scenarioContext: CONTEXT,
    requireContractEnvelope: true,
    c008Provider: {
      readCurrentC008() {
        sequence += 1;
        return envelope("M01.C008.Read", c008Payload(`READ-C008-${sequence}`), sequence);
      }
    },
    c017Provider: {
      readCurrentC017() {
        sequence += 1;
        return envelope("M02.C017.Read", c017Payload(`READ-C017-${sequence}`), sequence);
      }
    },
    clock: () => "2026-08-24T22:00:05.000Z"
  });
  assert.equal(gate.status, "passed");
  assert.equal(gate.exactCombination.dataVersionId, "DATA-S001-001");

  await assert.rejects(
    () => report.readGenerationGate({
      stage: "before-evidence",
      scenarioContext: CONTEXT,
      requireContractEnvelope: true,
      c008Provider: { readCurrentC008: () => c008Payload() },
      c017Provider: { readCurrentC017: () => envelope("M02.C017.Read", c017Payload(), 3) },
      clock: () => "2026-08-24T22:00:05.000Z"
    }),
    (error) => error.code === "CONTRACT_ENVELOPE_REQUIRED"
  );
});
