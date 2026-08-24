'use strict';

const data = require('../../../services/data');
const ontology = require('../../../services/ontology');

const MEMBERS = [
  ['FIN-MEMBER-SUBJECT', 'Subject', 'f1'], ['FIN-MEMBER-DETAIL', 'Detail', 'f2'],
  ['FIN-MEMBER-INSTITUTION', 'Institution', 'f3'], ['FIN-MEMBER-OWNER', 'Owner', 'f4']
].map(([memberId, name, primaryKey]) => ({ memberId, name, grain: 'one row per entity', rowCount: 1, primaryKey, fields: [{ id: primaryKey, name: `${name} ID`, dataType: 'text', nullable: false }], qualityStatus: 'passed' }));

const RELATIONS = [
  ['FIN-REL-DETAIL-SUBJECT', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-SUBJECT', 'f2', 'f1'],
  ['FIN-REL-DETAIL-INSTITUTION', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-INSTITUTION', 'f2', 'f3'],
  ['FIN-REL-SUBJECT-OWNER', 'FIN-MEMBER-SUBJECT', 'FIN-MEMBER-OWNER', 'f1', 'f4']
].map(([relationId, sourceMemberId, targetMemberId, sourceFieldId, targetFieldId]) => ({ relationId, name: relationId, sourceMemberId, targetMemberId, sourceFieldId, targetFieldId, endpointCheckStatus: 'passed' }));

function context(options) {
  return Object.freeze({ scenarioId: 'S001', scenarioVersion: 'S001-v1', scenarioRunId: options.scenarioRunId || 'S001-RUN-E2E-DATA-SEMANTIC', formedAt: options.formedAt || '2026-08-25T00:00:00.000Z', status: 'active' });
}

function semanticContent() {
  return {
    ontologyId: 'ONT-S001-FINANCE', name: 'S001 finance ontology', description: 'Published S001 finance semantics.', sourceMappingVersion: 'MAPPING-S001-v1',
    mapping: { memberIds: MEMBERS.map((member) => member.memberId), relationIds: RELATIONS.map((relation) => relation.relationId) },
    resources: [
      { id: 'OBJ-FINANCE-SUBJECT', type: 'ObjectType', name: 'Financing subject', definition: 'A financing subject.' },
      { id: 'PROP-SUBJECT-ID', type: 'Property', name: 'Subject id', definition: 'Stable subject identity.', objectTypeId: 'OBJ-FINANCE-SUBJECT' },
      { id: 'MET-FINANCE-BALANCE', type: 'Metric', name: 'Financing balance', definition: 'Published balance.', dependencyIds: ['PROP-SUBJECT-ID'], unit: 'CNY' },
      { id: 'RULE-HIGH-COST', type: 'Rule', name: 'High cost', definition: 'High cost rule.', dependencyIds: ['MET-FINANCE-BALANCE'] },
      { id: 'ACTION-OPTIMIZE', type: 'ActionType', name: 'Optimize financing', definition: 'Optimization action.', targetObjectTypeId: 'OBJ-FINANCE-SUBJECT' }
    ]
  };
}

function runS001DataSemantic(options = {}) {
  const scenarioContext = context(options);
  let tick = 0;
  const now = () => new Date(Date.parse('2026-08-25T00:00:01.000Z') + tick++ * 1000).toISOString();
  const runtime = data.createDataRuntime({ clock: () => new Date(now()) });
  runtime.registerSource({ sourceId: 'T001-S001-FINANCE', name: 'S001 finance source', category: 'manual-workbook', readMethod: 'upload' });
  const snapshot = runtime.createSnapshot({ sourceId: 'T001-S001-FINANCE', fileName: 's001-finance.csv', content: Buffer.from('subject,detail,institution,owner\nS1,D1,I1,O1\n'), scenarioContext, readAt: now() });
  const t008 = runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2026-08-24', confirmedBy: 's001-owner', confirmedAt: now(), basis: 'business-owner-confirmed', scenarioContext });
  runtime.createPipeline({ pipelineId: 'T003-S001-FINANCE', pipelineVersion: 'T003-S001-FINANCE-v1', name: 'S001 finance normalization', outputAssetId: 'T006-FINANCE', inputSlots: [{ slotId: 'source', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('T003-S001-FINANCE');
  const run = runtime.runPipeline('T003-S001-FINANCE', { scenarioContext, executor: () => ({ normalized: true }), qualityChecks: [{ checkId: 'structure', status: 'passed', hard: true, checkedCount: 1 }] });
  const asset = runtime.publishAsset(run.runId, { assetId: 'T006-FINANCE', members: MEMBERS, relations: RELATIONS });
  const delivery = runtime.createC003Delivery({ assetVersionId: asset.assetVersionId, deliveryId: 'C003-S001-DATA-E2E', scenarioContext });

  const service = ontology.createOntologyService({ scenarioContext, ontologyId: 'ONT-S001-FINANCE', clock: now });
  const c003 = service.receiveC003(delivery);
  if (c003.status !== 'accepted') throw new Error(`M01 rejected real M02 C003: ${c003.reasonCode || c003.status}`);
  const draft = service.readDraft({ scenarioContext, draftId: c003.targetDraftId });
  service.saveDraft({ scenarioContext, draftId: draft.draftId, expectedContentRevision: 1, content: semanticContent() });
  const validation = service.validateDraft({ scenarioContext, draftId: draft.draftId, expectedContentRevision: 2 });
  if (validation.status !== 'passed') throw new Error('M01 semantic Draft validation did not pass');
  const published = service.publishDraft({ scenarioContext, draftId: draft.draftId, expectedContentRevision: 2, semanticVersion: 'S001-ONTO-v1' });
  const target = service.createRefreshTarget({ scenarioContext, t054Id: 'T054-S001-FINANCE', bindingVersion: '1', publishedId: published.publishedId, t017Id: published.t017Id, t006Id: asset.assetId, sourceMappingVersion: 'MAPPING-S001-v1', coverage: { memberIds: MEMBERS.map((member) => member.memberId), relationIds: RELATIONS.map((relation) => relation.relationId) }, ownerRef: 'M01-owner', verifiedAt: now(), evidenceRefs: ['T054-S001-E2E'] });
  const discovery = service.discoverC032({ scenarioContext, assetId: asset.assetId, requester: 'M02' });
  const c028 = service.submitC028({ requestId: 'C028-S001-E2E', scenarioContext, t006Id: asset.assetId, t007Version: asset.assetVersionId, t008AsOf: '2026-08-24', deliveryId: delivery.deliveryId, target: discovery.candidates[0], discovery, existingT019Snapshot: { t019Revision: 0, combinationId: null } });
  if (c028.status !== 'accepted') throw new Error(`M01 rejected C028: ${c028.reasonCode || c028.status}`);
  const c029 = service.completeC029({ requestId: c028.requestId, scenarioContext, status: 'succeeded', objectChecks: [{ id: 'OBJ-CHECK-S001', status: 'passed', evidenceRef: 'OBJ-E-S001' }], relationChecks: [{ id: 'REL-CHECK-S001', status: 'passed', evidenceRef: 'REL-E-S001' }], evidenceRefs: ['C029-E-S001'] });
  const t019 = service.commitT019({ scenarioContext, qualificationId: c029.t018.qualificationId, idempotencyKey: 'T019-S001-E2E', gates: { ontology: { status: 'passed', evidenceRefs: ['ONTO-GATE-S001'] }, mapping: { status: 'passed', evidenceRefs: ['MAP-GATE-S001'] } }, candidateValidation: { sourceModule: 'M03', semanticVersionId: published.publishedId, dataVersion: asset.assetVersionId, questionSetVersion: 'S001-FIXED-v1', status: 'passed', completedAt: now(), evidenceRefs: ['M03-CV-S001'] } });
  const c008 = service.readC008({ scenarioContext });
  const readC017 = (input = {}) => runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext, consumer: input.consumer || 'intelligent-query', purpose: input.purpose || 'intelligent-query', requestedBy: input.requestedBy || 'M03', ...input });
  return { scenarioContext, runtime, service, snapshot, t008, run, asset, delivery, c003, draft, validation, published, target, discovery, c028, c029, t018: c029.t018, t019, c008, readC017, projectC017: readC017 };
}

module.exports = Object.freeze({ runS001DataSemantic });
