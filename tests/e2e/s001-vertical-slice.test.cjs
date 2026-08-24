'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const m04 = require('../../services/decision');
const m06 = require('../../services/report');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1.1.0',
  scenarioRunId: 'S001-RUN-VERTICAL-SLICE-1',
  formedAt: '2026-08-25T00:00:00.000Z',
  status: 'active'
});
const NOW = () => '2026-08-25T00:00:01.000Z';

test('S001 stores an actual M04 C019 through the M06 read-only Owner port idempotently', async () => {
  const decision = m04.createDecisionService({
    scenarioContext: CONTEXT,
    c017Reader: () => { throw new Error('empty C019 must not read C017'); },
    clock: NOW
  });
  const report = m06.createM06Service({
    m04DecisionPort: m06.createM04DecisionPort(decision),
    clock: NOW
  });
  const request = {
    scenarioContext: CONTEXT,
    traceId: 'TRACE-S001-VERTICAL-1',
    correlationId: 'CORR-S001-VERTICAL-1',
    idempotencyKey: 'S001-VERTICAL-C019-1',
    returnContext: { sourceScenario: 'M06', filters: {}, issuedAt: NOW() }
  };
  const first = await report.receiveC019(request);
  const duplicate = await report.receiveC019(request);
  const stored = report.readStoredC019({ receiptId: first.receipt.receiptId, scenarioContext: CONTEXT });

  assert.equal(first.outcome, 'received');
  assert.equal(first.reference.sourceOwner, 'M04');
  assert.equal(first.reference.readOnly, true);
  assert.deepEqual(first.reference.scenarioContext, CONTEXT);
  assert.equal(first.receipt.traceId, request.traceId);
  assert.equal(first.receipt.correlationId, request.correlationId);
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(duplicate.receipt.receiptId, first.receipt.receiptId);
  assert.equal(stored.reference.referenceId, first.reference.referenceId);
  assert.equal(stored.receipt.receiptId, first.receipt.receiptId);

  await assert.rejects(() => report.receiveC019({
    ...request,
    idempotencyKey: 'S001-VERTICAL-C019-OTHER-RUN',
    scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-VERTICAL-SLICE-OTHER' }
  }));
  assert.equal(report.readStoredC019({ receiptId: first.receipt.receiptId, scenarioContext: CONTEXT }).receipt.receiptId, first.receipt.receiptId);
});
