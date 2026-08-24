'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DecisionError,
  DecisionService,
  createDecisionService,
  GATES,
  READ_OUTCOMES
} = require('./index.js');

const context = {
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-20260824090000000-m04test',
  formedAt: '2026-08-24T09:00:00.000Z',
  status: 'active'
};

function request(overrides = {}) {
  return {
    requestId: 'AR-S001-001',
    schemaVersion: 'ofw.m03.c011.action-request.v1',
    scenarioContext: context,
    subjectId: 'UNIT-001',
    subjectName: '演示单位001',
    sourceType: 'rule',
    sourceRef: 'RULE-R01-RUN-1',
    submittedBy: 'operator-1',
    actionType: { id: 'ACTION-FOLLOW-UP', name: '跟进', version: '1.0.0', status: 'published' },
    semanticVersion: 'SEM-v1',
    dataVersion: 'T007-v1',
    rule: { id: 'R01', version: 'R01-v1', evaluatedAt: '2026-08-24T08:00:00.000Z', branch: 'hit', hitEvidence: '固定命中证据' },
    metric: { id: 'MET-1', name: '指标', value: 12, unit: '%', scope: 'UNIT-001', evaluatedAt: '2026-08-24T08:00:00.000Z', snapshotId: 'MET-SNAP-1' },
    evidence: { cutoff: '2026-08-23T23:59:59.000Z', snapshotId: 'EVID-1' },
    recommendation: '人工复核',
    ...overrides
  };
}

function c017(contextValue, dataVersion, gate, state = 'allowed') {
  const qualityStatus = state === 'allowed' ? '允许推进' : state === 'hard-failure' ? '失败' : state === 'unknown' ? '未知' : '允许推进';
  const hardQualityFailure = state === 'hard-failure' ? true : false;
  return {
    contractCode: 'C017',
    consumer: '决策中心',
    scenarioContext: contextValue,
    projections: [{
      dataVersion,
      scenarioContext: contextValue,
      gates: {
        [gate]: {
          currentStateSummary: {
            id: `C017-${dataVersion}-CURRENT`,
            version: 'current-1',
            formedAt: '2026-08-24T09:01:00.000Z',
            qualityStatus,
            hardQualityFailure,
            reason: state === 'unknown' ? '当前摘要无法解释' : '权威摘要',
            recovery: state === 'hard-failure' ? '等待可信版本' : '无需恢复',
            evidenceLocator: `C017/${dataVersion}/${gate}`
          },
          qualityStatus,
          hardQualityFailure,
          reason: state === 'unknown' ? '当前摘要无法解释' : '门读取结果'
        }
      }
    }]
  };
}

function sequenceReader(sequence) {
  const calls = [];
  const reader = (query, gate) => {
    calls.push({ query, gate });
    const next = sequence.length ? sequence.shift() : 'allowed';
    if (next instanceof Error) throw next;
    if (next === 'read-error') throw new Error('C017 temporarily unavailable');
    if (next === 'unknown') return c017(query.scenarioContext, query.t007, gate, 'unknown');
    if (next === 'hard-failure') return c017(query.scenarioContext, query.t007, gate, 'hard-failure');
    return c017(query.scenarioContext, query.t007, gate, 'allowed');
  };
  reader.calls = calls;
  return reader;
}

function service(reader, options = {}) {
  return createDecisionService({ scenarioContext: context, c017Reader: reader, clock: () => '2026-08-24T09:02:00.000Z', ...options });
}

test('acceptance, human decision and task are separate facts and each gate rereads C017', () => {
  const reader = sequenceReader(['allowed', 'unknown', 'allowed', 'read-error', 'allowed']);
  const decision = service(reader);
  const accepted = decision.receiveActionRequest(request());
  assert.equal(accepted.outcome, 'accepted');
  assert.equal(accepted.request.requestStatus, 'received');
  assert.equal(accepted.request.schemaVersion, 'ofw.m03.c011.action-request.v1');
  assert.equal(accepted.request.reminderStatus, 'awaiting_confirmation');
  assert.equal(accepted.request.confirmationStatus, 'pending');
  assert.equal(accepted.request.taskStatus, 'not_created');
  assert.equal(decision.listTodos().length, 0);
  assert.equal(reader.calls.length, 1);
  assert.equal(reader.calls[0].gate, GATES.REQUEST_RECEIPT);
  assert.deepEqual(Object.keys(reader.calls[0].query).sort(), ['consumer', 'contractCode', 'dataVersion', 'gate', 'purpose', 'scenarioContext', 'scenarioIdentity', 't007'].sort());

  const blockedConfirmation = decision.confirmAction('AR-S001-001', { decision: 'confirm', reason: '确认', owner: 'owner-1' });
  assert.equal(blockedConfirmation.outcome, 'blocked');
  assert.equal(blockedConfirmation.request.confirmationStatus, 'blocked');
  assert.equal(blockedConfirmation.form.owner, 'owner-1');
  assert.equal(reader.calls.length, 2);
  assert.equal(reader.calls[1].gate, GATES.CONFIRMATION_SUBMIT);
  assert.equal(decision.listConfirmations().length, 0);

  const confirmed = decision.retryConfirmation('AR-S001-001', { decision: 'confirm', reason: '确认', owner: 'owner-1' });
  assert.equal(confirmed.outcome, 'confirmed');
  assert.equal(confirmed.request.confirmationStatus, 'confirmed');
  assert.equal(confirmed.request.taskStatus, 'not_created');
  assert.equal(reader.calls.length, 3);

  const blockedTask = decision.createTask('AR-S001-001');
  assert.equal(blockedTask.outcome, 'blocked');
  assert.equal(blockedTask.request.confirmationStatus, 'confirmed');
  assert.equal(blockedTask.request.taskStatus, 'blocked');
  assert.equal(decision.listTodos().length, 0);
  assert.equal(reader.calls.length, 4);
  assert.equal(reader.calls[3].gate, GATES.TASK_FORMATION);

  const task = decision.retryTaskCreation('AR-S001-001');
  assert.equal(task.outcome, 'task_created');
  assert.equal(task.request.confirmationStatus, 'confirmed');
  assert.equal(task.request.taskStatus, 'created');
  assert.equal(decision.listTodos().length, 1);
  assert.equal(reader.calls.length, 5);
  assert.equal(reader.calls[4].gate, GATES.TASK_FORMATION);
});

test('same scene/run/double-version duplicate is side-effect free; same id mismatch is rejected', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const first = decision.receiveActionRequest(request());
  const duplicate = decision.receiveActionRequest(request());
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(duplicate.refs.request, first.refs.request);
  assert.equal(duplicate.refs.reminder, first.refs.reminder);
  assert.equal(reader.calls.length, 1, 'duplicate must not reread or create a notification');
  assert.equal(decision.listRequests().length, 1);
  assert.equal(decision.listReminders().length, 1);
  assert.equal(decision.listNotifications().length, 1);

  const conflict = decision.receiveActionRequest(request({ dataVersion: 'T007-v2' }));
  assert.equal(conflict.outcome, 'conflict');
  assert.equal(conflict.conflict, true);
  assert.equal(decision.listRequests().length, 1);
  assert.equal(decision.listReminders().length, 1);
  assert.equal(decision.listNotifications().length, 1);
  assert.equal(reader.calls.length, 1);

  const contextConflict = decision.receiveActionRequest(request({ scenarioContext: { ...context, scenarioRunId: 'S001-RUN-other' } }));
  assert.equal(contextConflict.outcome, 'conflict');
  assert.equal(contextConflict.conflict, true);
  assert.equal(decision.listRequests().length, 1, 'context conflict must not create a request');
});

test('canonical M03 delivery repeated through the Contract Envelope creates one Action Request', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const payload = request({ requestId: 'AR-S001-CANONICAL-DUP' });
  const envelope = decision.createContractEnvelope('C011.action-request.submitted', payload, {
    eventId: 'evt-canonical-1', idempotencyKey: 'idem-canonical-1', traceId: 'trace-canonical', correlationId: 'corr-canonical'
  });
  const first = decision.receiveContractEnvelope(envelope);
  const second = decision.receiveContractEnvelope({ ...envelope, eventId: 'evt-canonical-2' });
  assert.equal(first.outcome, 'accepted');
  assert.equal(second.outcome, 'duplicate');
  assert.equal(decision.listRequests().filter((item) => item.requestId === 'AR-S001-CANONICAL-DUP').length, 1);
  assert.equal(reader.calls.length, 1);
});

test('hard quality failure is retained and cannot be retried on the same fixed version', () => {
  const reader = sequenceReader(['hard-failure']);
  const decision = service(reader);
  const rejected = decision.receiveActionRequest(request({ requestId: 'AR-S001-HARD' }));
  assert.equal(rejected.outcome, 'quality_rejected');
  assert.equal(rejected.request.requestStatus, 'rejected');
  assert.equal(rejected.refs.reminder, null);
  assert.equal(decision.listReminders().length, 0);
  const retry = decision.retryRequestReceipt('AR-S001-HARD');
  assert.equal(retry.outcome, 'quality_rejected');
  assert.equal(reader.calls.length, 1);
});

test('unknown and unlocatable receipt results are retained and recover only by explicit reread', () => {
  const reader = sequenceReader(['unknown', 'allowed']);
  const decision = service(reader);
  const blocked = decision.receiveActionRequest(request({ requestId: 'AR-S001-UNKNOWN' }));
  assert.equal(blocked.outcome, 'blocked');
  assert.equal(blocked.request.requestStatus, 'unknown');
  assert.equal(decision.listReminders().length, 0);
  const recovered = decision.retryRequestReceipt('AR-S001-UNKNOWN');
  assert.equal(recovered.outcome, 'recovered');
  assert.equal(recovered.request.requestStatus, 'received');
  assert.ok(recovered.refs.reminder);
  assert.equal(decision.listReceipts().filter((item) => item.requestId === 'AR-S001-UNKNOWN').length, 2);
  assert.equal(decision.listRequests()[0].c017ReadAttempts.request_receipt, 2);
});

test('C017 version mismatch is a rejected gate, not an optimistic block', () => {
  const reader = (query, gate) => c017(query.scenarioContext, 'T007-other', gate, 'allowed');
  const decision = service(reader);
  const result = decision.receiveActionRequest(request({ requestId: 'AR-S001-VERSION' }));
  assert.equal(result.outcome, 'conflict');
  assert.equal(result.status, 'rejected');
  assert.equal(result.request.requestStatus, 'version_conflict');
  assert.equal(result.refs.reminder, null);
});

test('data version and T007 asset identity remain distinct at the C017 boundary', () => {
  const seen = [];
  const reader = (query, gate) => {
    seen.push(query);
    return c017(query.scenarioContext, query.t007, gate, 'allowed');
  };
  const decision = service(reader);
  const result = decision.receiveActionRequest(request({
    requestId: 'AR-S001-SPLIT-VERSIONS',
    dataVersion: '1.0.0',
    dataAssetId: 'S001-T007-FORMAL-v1'
  }));
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.request.dataVersion, '1.0.0');
  assert.equal(result.request.t007, 'S001-T007-FORMAL-v1');
  assert.equal(seen[0].dataVersion, '1.0.0');
  assert.equal(seen[0].t007, 'S001-T007-FORMAL-v1');
});

test('common contract envelopes are unwrapped without creating a second request source', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const payload = request({ requestId: 'AR-S001-ENVELOPE' });
  const result = decision.receiveContractEnvelope({
    eventId: 'evt-S001-ENVELOPE',
    eventType: 'C011.action-request.submitted',
    schemaVersion: 'draft-0.1.0',
    occurredAt: '2026-08-24T09:02:00.000Z',
    correlationId: 'corr-envelope',
    traceId: 'trace-envelope',
    idempotencyKey: 'caller-owned-key',
    scenarioContext: context,
    actorRef: 'source-module',
    resourceRefs: [],
    evidenceRefs: [],
    payload
  });
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.request.requestId, 'AR-S001-ENVELOPE');
  assert.equal(result.request.callerIdempotencyKey, 'caller-owned-key');
  assert.equal(reader.calls.length, 1);
});

test('Foundation strict context and envelope mismatches fail closed before C017', () => {
  const reader = sequenceReader(['allowed', 'allowed', 'allowed']);
  assert.throws(() => service(reader, { scenarioContext: { ...context, futureField: true } }), (error) => error.code === 'INVALID_SCENARIO_CONTEXT');
  const decision = service(reader);
  const baseEnvelope = {
    eventId: 'evt-S001-STRICT',
    eventType: 'C011.action-request.submitted',
    schemaVersion: 'draft-0.1.0',
    occurredAt: '2026-08-24T09:02:00.000Z',
    actorRef: 'source-module',
    correlationId: 'corr-strict',
    traceId: 'trace-strict',
    idempotencyKey: 'idem-strict',
    scenarioContext: context,
    resourceRefs: [],
    evidenceRefs: [],
    payload: request({ requestId: 'AR-S001-STRICT-ENVELOPE' })
  };
  const unknown = decision.receiveActionRequest({ ...baseEnvelope, unexpected: true });
  assert.equal(unknown.outcome, 'contract_rejected');
  const wrongVersion = decision.receiveActionRequest({ ...baseEnvelope, eventId: 'evt-S001-WRONG', schemaVersion: 'draft-0.1.1' });
  assert.equal(wrongVersion.outcome, 'contract_rejected');
  assert.equal(reader.calls.length, 0);
});

test('M04 Foundation compatibility and envelope helpers are exact and normalized', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  assert.equal(decision.checkFoundationCompatibility('draft-0.1.0').result.status, 'exact');
  assert.equal(decision.checkFoundationCompatibility('draft-0.1.1').ok, false);
  const envelope = decision.createContractEnvelope('C011.receipt', { requestId: 'AR-S001-ENVELOPE-HELPER' }, { actorRef: { refType: 'module', refId: 'M03' } });
  assert.equal(decision.validateContractEnvelope(envelope).valid, true);
  assert.equal(envelope.schemaVersion, 'draft-0.1.0');
  assert.equal(envelope.scenarioContext.scenarioRunId, context.scenarioRunId);
});

test('C017 strict context mismatch blocks the gate without using a cached result', () => {
  const reader = (query, gate) => c017({ ...query.scenarioContext, futureField: true }, query.t007, gate, 'allowed');
  const decision = service(reader);
  const result = decision.receiveActionRequest(request({ requestId: 'AR-S001-C017-STRICT' }));
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.request.requestStatus, 'unknown');
  assert.equal(result.refs.reminder, null);
});

test('trace/correlation and actor context propagate across the three owned facts', () => {
  const reader = sequenceReader(['allowed', 'allowed', 'allowed']);
  const decision = service(reader);
  const received = decision.receiveActionRequest({ ...request({ requestId: 'AR-S001-TRACE' }), traceId: 'trace-source', correlationId: 'corr-source', actorRef: 'actor-source' });
  decision.confirmAction('AR-S001-TRACE', { decision: 'confirm', reason: '确认', owner: 'owner', actorRef: 'actor-human', traceId: 'trace-human', correlationId: 'corr-human' });
  decision.createTask('AR-S001-TRACE', { actorRef: 'actor-task' });
  const state = decision.getState();
  const req = state.requests.find((item) => item.requestId === 'AR-S001-TRACE');
  const rem = state.reminders.find((item) => item.requestId === 'AR-S001-TRACE');
  const conf = state.confirmations.find((item) => item.requestId === 'AR-S001-TRACE');
  const task = state.todos.find((item) => item.requestId === 'AR-S001-TRACE');
  assert.equal(received.request.traceContext.traceId, 'trace-source');
  assert.equal(req.traceContext.correlationId, 'corr-source');
  assert.equal(rem.traceContext.traceId, req.traceContext.traceId);
  assert.equal(conf.traceContext.traceId, req.traceContext.traceId);
  assert.equal(task.traceContext.traceId, req.traceContext.traceId);
  assert.equal(req.audit.actorRef, 'actor-source');
});

test('unconfirmed task creation is blocked without reading or creating a task', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const accepted = decision.receiveActionRequest(request({ requestId: 'AR-S001-UNCONFIRMED' }));
  const result = decision.createTask('AR-S001-UNCONFIRMED');
  assert.equal(result.outcome, 'confirmation_required');
  assert.equal(reader.calls.length, 1);
  assert.equal(decision.listTodos().length, 0);
  assert.equal(accepted.request.confirmationStatus, 'pending');
});

test('rejection is a terminal human fact and does not create a task', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  decision.receiveActionRequest(request({ requestId: 'AR-S001-REJECT' }));
  const rejected = decision.confirmAction('AR-S001-REJECT', { decision: 'reject', reason: '证据不足' });
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(rejected.request.confirmationStatus, 'rejected');
  assert.equal(rejected.request.reminderStatus, 'rejected');
  assert.equal(decision.listConfirmations().length, 1);
  assert.equal(decision.createTask('AR-S001-REJECT').outcome, 'confirmation_required');
  assert.equal(reader.calls.length, 1, 'a negative human decision does not need the positive C017 gate');
});

test('C019 has stable refs and read-only detail/return context', () => {
  const reader = sequenceReader(['allowed', 'allowed', 'allowed']);
  const decision = service(reader);
  decision.receiveActionRequest(request({ requestId: 'AR-S001-C019' }));
  decision.confirmAction('AR-S001-C019', { decision: 'confirm', reason: '确认', owner: 'owner-1' });
  decision.createTask('AR-S001-C019');
  const summary = decision.getC019Summary({ returnContext: { sourceScenario: '报告中心', subjectId: 'UNIT-001', filters: { status: 'pending' }, returnPosition: 'panel-3', canWrite: true } });
  assert.equal(summary.contractCode, 'C019');
  assert.equal(summary.readOnly, true);
  assert.equal(summary.canWrite, false);
  assert.deepEqual(summary.writeCapabilities, []);
  const record = summary.records[0];
  assert.equal(record.requestRef.targetId, 'AR-S001-C019');
  assert.equal(record.requestRefId, 'AR-S001-C019');
  assert.ok(record.reminderRef.targetId);
  assert.ok(record.taskRef.targetId);
  assert.ok(record.traceRef.targetId);
  assert.equal(record.detailEntries.task.readOnly, true);
  assert.equal(record.detailEntries.task.canWrite, false);
  assert.equal('record' in record.detailEntries.task, false, 'summary must not embed a mutable/full detail record');
  const detail = decision.getDetail('task', record.taskRef, { navigationContext: { sourceScenario: '报告中心', canWrite: true } });
  assert.equal(detail.readOnly, true);
  assert.equal(detail.canWrite, false);
  assert.match(detail.href, /scenarioRunId=S001-RUN-20260824090000000-m04test/);
  assert.deepEqual(detail.navigationContext.writeCapabilities, []);
});

test('C034 export/validate/clone restore keeps M04 ledger isolated and does not replay side effects', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  decision.receiveActionRequest(request({ requestId: 'AR-S001-C034' }));
  const exported = decision.exportCheckpoint({ checkpointId: 'CP-M04-TEST' });
  const validation = decision.validateCheckpoint(exported);
  assert.equal(validation.ok, true);
  assert.equal(exported.sourceScenarioRunId, context.scenarioRunId);
  assert.equal(exported.m04Ledger.entries.some((entry) => entry.kind === 'request'), true);
  assert.equal('c017Projection' in exported, false);
  const provider = decision.createCheckpointProvider();
  const restored = provider.cloneRestore(exported, { runIdFactory: (scenarioId, details) => `${scenarioId}-RUN-${details.operation}-restored` });
  assert.equal(restored.overwritesHistory, false);
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.replayHistoricalSideEffects, false);
  assert.equal(restored.sideEffectsSuppressed, true);
  assert.equal(restored.delegateResult.restoredLedger.entries.some((entry) => entry.kind === 'request'), true);
  assert.equal('notifications' in restored.delegateResult, false);
  assert.equal('todos' in restored.delegateResult, false);
  assert.equal('actionRequests' in restored.delegateResult, false);
});

test('C034 Foundation strict context and exact schema policy reject altered checkpoints', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const exported = decision.exportCheckpoint({ checkpointId: 'CP-M04-STRICT' });
  const unknownContext = JSON.parse(JSON.stringify(exported));
  unknownContext.scenarioContext.futureField = true;
  assert.equal(decision.validateCheckpoint(unknownContext).ok, false);
  const wrongSchema = JSON.parse(JSON.stringify(exported));
  wrongSchema.schemaVersion = 'ofw.c034.checkpoint.v2';
  assert.equal(decision.validateCheckpoint(wrongSchema).ok, false);
  const unknownField = JSON.parse(JSON.stringify(exported));
  unknownField.futureField = true;
  assert.equal(decision.validateCheckpoint(unknownField).ok, false);
  assert.throws(() => decision.createCheckpointProvider().cloneRestore(unknownContext), (error) => error.code === 'INVALID_CHECKPOINT');
});

test('M04 owned state and C011 payload schema changes fail closed', () => {
  const reader = sequenceReader(['allowed']);
  assert.throws(() => new DecisionService({
    scenarioContext: context,
    c017Reader: reader,
    initialState: { schemaVersion: 'ofw.m04.decision-state.v2', scenarioContext: context }
  }), (error) => error.code === 'STATE_SCHEMA_INCOMPATIBLE');
  const decision = service(reader);
  assert.throws(() => decision.receiveActionRequest({ ...request({ requestId: 'AR-S001-WRONG-REQUEST-SCHEMA' }), schemaVersion: 'ofw.m04.c011.action-request.v1' }), (error) => error.code === 'REQUEST_SCHEMA_INCOMPATIBLE');
  assert.throws(() => decision.receiveActionRequest({ ...request({ requestId: 'AR-S001-WRONG-M03-SCHEMA' }), schemaVersion: 'ofw.m03.c011.request.v1' }), (error) => error.code === 'REQUEST_SCHEMA_INCOMPATIBLE');
  assert.equal(reader.calls.length, 0);
});

test('a shared state store preserves idempotency across service instances', () => {
  let stored = null;
  const stateStore = { load: () => stored, save: (value) => { stored = value; } };
  const reader = sequenceReader(['allowed']);
  const first = service(reader, { stateStore });
  const second = service(reader, { stateStore });
  first.receiveActionRequest(request({ requestId: 'AR-S001-SHARED' }));
  const duplicate = second.receiveActionRequest(request({ requestId: 'AR-S001-SHARED' }));
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(reader.calls.length, 1);
  assert.equal(second.listRequests().length, 1);
});

test('Map-backed state is namespaced by the full scenario triple', () => {
  const store = new Map();
  const reader = sequenceReader(['allowed', 'allowed']);
  const first = service(reader, { stateStore: store });
  const otherContext = { ...context, scenarioRunId: 'S001-RUN-other-map' };
  const second = createDecisionService({ scenarioContext: otherContext, c017Reader: reader, stateStore: store });
  first.receiveActionRequest(request({ requestId: 'AR-S001-MAP' }));
  second.receiveActionRequest(request({ requestId: 'AR-S001-MAP', scenarioContext: otherContext }));
  assert.equal(first.listRequests().length, 1);
  assert.equal(second.listRequests().length, 1);
  assert.equal(store.size, 2);
});

test('C017 projection copies are rejected at request and state boundaries', () => {
  const reader = sequenceReader(['allowed']);
  const decision = service(reader);
  const rejected = decision.receiveActionRequest(request({ c017Projection: { projections: [] } }));
  assert.equal(rejected.outcome, 'contract_rejected');
  assert.equal(reader.calls.length, 0);
  assert.throws(() => new DecisionService({ scenarioContext: context, c017Reader: reader, initialState: { scenarioContext: context, c017Projection: {} } }), (error) => error.code === 'C017_COPY_FORBIDDEN');
});

test('async C017 readers use the same gates and preserve the synchronous state machine', async () => {
  const calls = [];
  const reader = async (query, gate) => {
    calls.push({ query, gate });
    return c017(query.scenarioContext, query.t007, gate, 'allowed');
  };
  const decision = service(reader);
  const accepted = await decision.receiveActionRequestAsync(request({ requestId: 'AR-S001-ASYNC' }));
  assert.equal(accepted.outcome, 'accepted');
  const confirmed = await decision.confirmActionAsync('AR-S001-ASYNC', { decision: 'confirm', reason: '异步确认', owner: 'owner-async' });
  assert.equal(confirmed.outcome, 'confirmed');
  const task = await decision.createTaskAsync('AR-S001-ASYNC');
  assert.equal(task.outcome, 'task_created');
  assert.deepEqual(calls.map((item) => item.gate), [GATES.REQUEST_RECEIPT, GATES.CONFIRMATION_SUBMIT, GATES.TASK_FORMATION]);
  assert.equal(decision.listTodos().length, 1);
});

test('public sync-named methods transparently return a Promise for async C017 readers', async () => {
  const reader = async (query, gate) => c017(query.scenarioContext, query.t007, gate, 'allowed');
  const decision = service(reader);
  const accepted = await decision.receiveActionRequest(request({ requestId: 'AR-S001-ASYNC-DIRECT' }));
  assert.equal(accepted.outcome, 'accepted');
  const confirmed = await decision.confirmAction('AR-S001-ASYNC-DIRECT', { decision: 'confirm', reason: '确认', owner: 'owner' });
  assert.equal(confirmed.outcome, 'confirmed');
  assert.equal((await decision.createTask('AR-S001-ASYNC-DIRECT')).outcome, 'task_created');
});

test('concurrent async duplicate receipts share one in-flight operation', async () => {
  let reads = 0;
  const reader = async (query, gate) => {
    reads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return c017(query.scenarioContext, query.t007, gate, 'allowed');
  };
  const decision = service(reader);
  const [left, right] = await Promise.all([
    decision.receiveActionRequestAsync(request({ requestId: 'AR-S001-ASYNC-DUP' })),
    decision.receiveActionRequestAsync(request({ requestId: 'AR-S001-ASYNC-DUP' }))
  ]);
  assert.equal(reads, 1);
  assert.equal(left.refs.reminder, right.refs.reminder);
  assert.equal(decision.listRequests().length, 1);
  assert.equal(decision.listNotifications().length, 1);
});

test('unknown task writer results require reconciliation before a second side effect', () => {
  let writes = 0;
  const reader = sequenceReader(['allowed', 'allowed', 'allowed']);
  const decision = service(reader, { taskWriter: () => { writes += 1; return { status: 'unknown', reason: 'timeout' }; } });
  decision.receiveActionRequest(request({ requestId: 'AR-S001-TASK-UNKNOWN' }));
  decision.confirmAction('AR-S001-TASK-UNKNOWN', { decision: 'confirm', reason: '确认', owner: 'owner-1' });
  const unknown = decision.createTask('AR-S001-TASK-UNKNOWN');
  assert.equal(unknown.outcome, 'unknown');
  const retry = decision.retryTaskCreation('AR-S001-TASK-UNKNOWN');
  assert.equal(retry.outcome, 'unknown');
  assert.equal(writes, 1);
  const reconciled = decision.reconcileTaskCreation('AR-S001-TASK-UNKNOWN', { taskId: 'TD-REMOTE-1' });
  assert.equal(reconciled.outcome, 'task_reconciled');
  assert.equal(decision.listTodos().length, 1);
});

test('invalid C017 receipts and historical contexts fail closed', () => {
  const reader = sequenceReader(['allowed']);
  const historical = service(reader, { scenarioContext: { ...context, status: 'historical-readonly' } });
  assert.throws(() => historical.receiveActionRequest(request()), (error) => error.code === 'HISTORICAL_READ_ONLY');
  assert.equal(historical.getC019Summary().readOnly, true);
});

test('strict C011 contract mode rejects missing published/metric evidence fields before C017', () => {
  const reader = sequenceReader(['allowed']);
  const strict = service(reader, { strictContract: true });
  const result = strict.receiveActionRequest(request({
    requestId: 'AR-S001-STRICT',
    actionType: { id: 'ACTION', version: '1.0.0' },
    metric: {},
    evidence: {}
  }));
  assert.equal(result.outcome, 'contract_rejected');
  assert.equal(reader.calls.length, 0);
});
