'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const m05 = require('../../packages/m05');
const { runS001DataSemantic } = require('./helpers/s001-data-semantic.cjs');
const { runS001QueryDecision } = require('./helpers/s001-query-decision.cjs');
const { runS001ReportAgent } = require('./helpers/s001-report-agent.cjs');

function buildRelease(exact, now) {
  return m05.publishAgentRelease(m05.createAgentRelease({
    releaseId: 'REL-S001-REPORT',
    releaseVersion: '1.0.0',
    status: 'validated',
    agent: { type: 'agent', id: 's001-report-draft', version: '1.0.0' },
    prompt: { type: 'prompt', id: 's001-report-prompt', version: '1.0.0' },
    skills: [{ type: 'skill', id: 's001-report-structure', version: '1.0.0' }],
    tools: [{ type: 'tool', id: 's001-report-read', version: '1.0.0' }],
    model: { type: 'model', id: 's001-report-model', version: '1.0.0' },
    publishedOntologies: [{ type: 'publishedOntology', id: exact.semanticVersionId, version: exact.semanticVersion, status: 'published' }],
    scenario: { type: 'scenario', id: 'S001', version: 'S001-v1' },
    validity: { validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z' },
    resourceWhitelist: [
      { resourceType: 'reportContext', resourceId: 'RPT-S001-REPORT-AGENT', resourceVersion: '1.0.0', operations: ['read-context'], readOnly: true },
      { resourceType: 'evidence', resourceId: 'E-C019-S001', resourceVersion: '1.0.0', operations: ['read-evidence', 'cite'], readOnly: true },
      { resourceType: 'publishedOntology', resourceId: exact.semanticVersionId, resourceVersion: exact.semanticVersion, operations: ['read-ontology'], readOnly: true },
      { resourceType: 'answer', resourceId: 'answer-output', resourceVersion: '1.0.0', operations: ['emit-result'], readOnly: true }
    ],
    permissions: { allowedRoles: ['operator', 'admin'], required: ['agent.run.execute'], denied: ['agent.action.execute', 'agent.report.publish'] }
  }, { now }), { now });
}

function makeFresh(asOf) {
  return {
    status: 'fresh', reason: 'S001 cutoff is within the configured threshold', asOfTime: asOf, t008: asOf,
    evaluatedAt: '2026-08-25T01:00:00.000Z', thresholdRef: 'S001-FRESH', thresholdVersion: '1.0.0',
    owner: 'M02', scope: 'asset', gate: 'allowed'
  };
}

async function setup() {
  const front = runS001DataSemantic({ scenarioRunId: 'S001-RUN-E2E-FULL' });
  const fresh = makeFresh(front.asset.t008);
  const readC017 = (input = {}) => front.readC017({ ...input, freshness: input.freshness || fresh });
  const clock = () => '2026-08-25T02:00:00.000Z';
  const queryDecision = await runS001QueryDecision({
    ...front,
    readC008: () => front.service.readC008({ scenarioContext: front.scenarioContext }),
    readC017,
    c009Config: {
      configVersion: 'C009-S001-v1', promptVersion: 'PROMPT-S001-v1',
      skillSet: ['SKILL-QUERY-v1'], loadedSkillSet: ['SKILL-QUERY-v1'],
      toolAllowlist: ['TOOL-SEMANTIC-READ-v1'], availableTools: ['TOOL-SEMANTIC-READ-v1'],
      publishedOntologyVersion: front.c008.current.semanticVersionId,
      resourceAllowlist: ['MET-FINANCE-BALANCE', 'RULE-HIGH-COST', 'ACTION-OPTIMIZE'],
      enabled: true, scenarioContext: front.scenarioContext, evaluationTime: '2026-08-25T01:00:00.000Z'
    },
    query: {
      question: '哪些融资主体触发高成本规则？', finalUnderstanding: '查询高成本规则命中的融资主体',
      metricRefs: [{ id: 'MET-FINANCE-BALANCE', type: 'Metric' }], ruleRefs: [{ id: 'RULE-HIGH-COST', type: 'Rule' }],
      scope: { objects: [{ id: 'SUBJECT-S001', label: '融资主体' }] }
    },
    queryExecutor: () => ({
      metrics: [{ metricId: 'MET-FINANCE-BALANCE', value: 100, evidenceRefs: [{ evidenceType: 'metric', evidenceId: 'E-MET-S001' }] }],
      rules: [{ ruleId: 'RULE-HIGH-COST', ruleVersion: '1.0.0', status: 'hit', evidenceRefs: [{ evidenceType: 'rule', evidenceId: 'E-RULE-S001' }] }],
      rows: [{ resultItemId: 'SUBJECT-S001', value: 100, evidenceRefs: [{ evidenceType: 'row', evidenceId: 'E-ROW-S001' }] }]
    }),
    target: { stableId: 'SUBJECT-S001', name: '融资主体' },
    actionType: { actionTypeId: 'ACTION-OPTIMIZE', version: '1.0.0', status: 'PUBLISHED' },
    metricSnapshot: { id: 'MET-FINANCE-BALANCE', value: 100, unit: 'CNY' },
    owner: 'OWNER-S001', traceId: 'TRACE-S001-E2E', correlationId: 'CORR-S001-E2E', clock
  });

  const exact = {
    t019Id: front.c008.current.t019Id, t019Version: String(front.c008.current.t019Revision),
    semanticVersionId: front.c008.current.semanticVersionId, semanticVersion: front.c008.current.publishedSemanticVersion,
    dataVersionId: front.c008.current.dataVersion,
    t008: /^\d{4}-\d{2}-\d{2}$/.test(front.c008.current.dataAsOf) ? `${front.c008.current.dataAsOf}T00:00:00.000Z` : front.c008.current.dataAsOf
  };
  const release = buildRelease(exact, clock());
  const runtime = m05.createM05Runtime({
    clock, release,
    models: [{ id: 's001-report-model', version: '1.0.0', execute: async ({ input }) => ({
      output: {
        answer: 'fixed evidence explanation',
        anchors: input.reportContext.anchors,
        evidenceRefs: [{ id: 'E-C019-S001', version: '1.0.0' }]
      }
    }) }]
  });
  let c008ReadCounter = 0;
  const c008Provider = {
    readCurrentC008: (request = {}) => {
      const projection = front.service.readC008({ scenarioContext: front.scenarioContext });
      const receiptId = `M01-C008-${++c008ReadCounter}`;
      return {
        ...projection,
        currentAuthority: projection.currentAuthority ? {
          ...projection.currentAuthority,
          dataVersion: projection.currentAuthority.dataVersion ? {
            ...projection.currentAuthority.dataVersion,
            t008: /^\d{4}-\d{2}-\d{2}$/.test(projection.currentAuthority.dataVersion.t008)
              ? `${projection.currentAuthority.dataVersion.t008}T00:00:00.000Z`
              : projection.currentAuthority.dataVersion.t008
          } : projection.currentAuthority.dataVersion
        } : projection.currentAuthority,
        authoritativeRead: {
          ...projection.authoritativeRead,
          receiptId,
          readAt: request.requestedAt || clock(),
          static: false
        },
        readReceipt: {
          ...projection.authoritativeRead,
          receiptId,
          readAt: request.requestedAt || clock(),
          static: false
        }
      };
    }
  };
  let c017ReadCounter = 0;
  const reportC017 = (input = {}) => {
    const readId = `M06-C017-${++c017ReadCounter}`;
    const raw = readC017({ ...input, consumer: 'report', purpose: input.purpose || 'report', currentSummaryId: 'C017-S001-REPORT-CURRENT', summaryVersion: '1', formedAt: '2026-08-25T01:00:00.000Z', observedAt: '2026-08-25T01:00:00.000Z', readId, idempotencyKey: `idem-${readId}` });
    const c008 = front.service.readC008({ scenarioContext: front.scenarioContext });
    // C017 owns data quality; the M06 adapter only joins the read-only C008
    // semantic observation needed to prove one exact report combination.
    return {
      ...raw.projection,
      summaryId: raw.projection.summaryId,
      version: raw.projection.summaryVersion,
      summaryType: raw.projection.summaryType,
      authoritativeRead: raw.authoritativeRead,
      readReceipt: raw.readReceipt,
      status: raw.status,
      consumptionReadiness: raw.consumptionReadiness,
      binding: {
        semanticVersionId: c008.current.semanticVersionId,
        semanticVersion: c008.current.publishedSemanticVersion,
        dataVersionId: raw.projection.assetVersionId,
        t008: /^\d{4}-\d{2}-\d{2}$/.test(raw.projection.t008) ? `${raw.projection.t008}T00:00:00.000Z` : raw.projection.t008
      }
    };
  };
  const c017Provider = {
    readCurrentC017: reportC017,
    readC017ForVersion: reportC017
  };
  const c017Resolver = async () => reportC017({ purpose: 'report' });
  const authorizationPort = {
    authorizeReportCopilotContext: (request) => ({ decisionId: 'AUTH-C024-S001', version: '1.0.0', status: 'allowed', decidedAt: clock(), scopeRef: request.scopeRef, scenarioContext: request.scenarioContext, owner: 'platform', source: 'authorization-api' }),
    authorizeReportComparison: (request) => ({ decisionId: 'AUTH-C027-S001', owner: 'platform', source: 'authorization-api', scenarioContext: request.scenarioContext, decidedAt: clock(), allowed: true, deniedFactIds: [] })
  };
  const report = await runS001ReportAgent({
    scenarioContext: front.scenarioContext, c008Provider, c017Provider, authorizationPort,
    generationRelease: release, extractionRelease: release, agentReleaseRef: { agentId: 's001-report-draft', version: '1.0.0' },
    c017Resolver, m05Runtime: runtime, copilotActor: { id: 's001-reader', roles: ['operator'], scenarioIds: ['S001'] }, clock
  }, queryDecision.m04, {
    exactCombination: exact, generationRelease: release, extractionRelease: release,
    agentReleaseRef: { agentId: 's001-report-draft', version: '1.0.0' }, c017Resolver, authorizationPort, copilotActor: { id: 's001-reader', roles: ['operator'], scenarioIds: ['S001'] }, clock
  });
  return { front, queryDecision, report, exact };
}

test('S001 real vertical slice completes through report publication and read-only copilot', async () => {
  const result = await setup();
  assert.equal(result.front.c003.status, 'accepted');
  assert.equal(result.front.c008.readStatus, 'ready');
  assert.equal(result.queryDecision.run.status, 'completed');
  assert.equal(result.queryDecision.received.outcome, 'accepted');
  assert.equal(result.queryDecision.confirmation.outcome, 'confirmed');
  assert.equal(result.queryDecision.task.outcome, 'task_created');
  assert.equal(result.queryDecision.c019.status, 'ready');
  assert.equal(result.report.t049.status, 'pass');
  assert.equal(result.report.artifact.artifactManifest.sameSource, true);
  assert.equal(result.report.copilot.successful, true);
  assert.equal(result.report.copilot.outcome, 'complete');
  assert.equal(result.report.c027.triggered, false);
  assert.equal(result.report.artifact.scenarioContext.scenarioRunId, result.front.scenarioContext.scenarioRunId);
});
