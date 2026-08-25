'use strict';

const m05 = require('../../../packages/m05');

function buildRelease(exact, now) {
  return m05.publishAgentRelease(m05.createAgentRelease({
    releaseId: 'REL-S001-REPORT', releaseVersion: '1.0.0', status: 'validated',
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

function queryInputs(scenarioContext, semanticVersionId) {
  return {
    c009Config: {
      configVersion: 'C009-S001-v1', promptVersion: 'PROMPT-S001-v1',
      skillSet: ['SKILL-QUERY-v1'], loadedSkillSet: ['SKILL-QUERY-v1'],
      toolAllowlist: ['TOOL-SEMANTIC-READ-v1'], availableTools: ['TOOL-SEMANTIC-READ-v1'],
      publishedOntologyVersion: semanticVersionId,
      resourceAllowlist: ['MET-FINANCE-BALANCE', 'RULE-HIGH-COST', 'ACTION-OPTIMIZE'],
      enabled: true, scenarioContext, evaluationTime: '2026-08-25T01:00:00.000Z'
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
    owner: 'OWNER-S001', traceId: 'TRACE-S001-E2E', correlationId: 'CORR-S001-E2E'
  };
}

function createS001RuntimeResources(input) {
  const { scenarioContext, ontologyService, dataRuntime, asset } = input;
  const clock = input.clock || (() => '2026-08-25T02:00:00.000Z');
  const fresh = {
    status: 'fresh', reason: 'S001 cutoff is within the configured threshold', asOfTime: asset.t008, t008: asset.t008,
    evaluatedAt: '2026-08-25T01:00:00.000Z', thresholdRef: 'S001-FRESH', thresholdVersion: '1.0.0',
    owner: 'M02', scope: 'asset', gate: 'allowed'
  };
  const readC017Owner = (request = {}) => dataRuntime.readC017({
    assetVersionId: asset.assetVersionId,
    scenarioContext,
    consumer: request.consumer || 'intelligent-query',
    purpose: request.purpose || 'intelligent-query',
    requestedBy: request.requestedBy || 'M03',
    freshness: request.freshness || fresh,
    ...request
  });
  const c008 = ontologyService.readC008({ scenarioContext });
  const exact = {
    t019Id: c008.current.t019Id, t019Version: String(c008.current.t019Revision),
    semanticVersionId: c008.current.semanticVersionId, semanticVersion: c008.current.publishedSemanticVersion,
    dataVersionId: c008.current.dataVersion,
    t008: /^\d{4}-\d{2}-\d{2}$/.test(c008.current.dataAsOf) ? `${c008.current.dataAsOf}T00:00:00.000Z` : c008.current.dataAsOf
  };
  let c008ReadCounter = 0;
  const c008Provider = {
    readCurrentC008(request = {}) {
      const projection = ontologyService.readC008({ scenarioContext });
      const receiptId = `M01-C008-${++c008ReadCounter}`;
      const normalizeDataVersion = (value) => value ? { ...value, t008: /^\d{4}-\d{2}-\d{2}$/.test(value.t008) ? `${value.t008}T00:00:00.000Z` : value.t008 } : value;
      return {
        ...projection,
        currentAuthority: projection.currentAuthority ? { ...projection.currentAuthority, dataVersion: normalizeDataVersion(projection.currentAuthority.dataVersion) } : projection.currentAuthority,
        authoritativeRead: { ...projection.authoritativeRead, receiptId, readAt: request.requestedAt || clock(), static: false },
        readReceipt: { ...projection.authoritativeRead, receiptId, readAt: request.requestedAt || clock(), static: false }
      };
    }
  };
  let c017ReadCounter = 0;
  const reportC017 = (request = {}) => {
    const current = ontologyService.readC008({ scenarioContext });
    const { t008, binding, semanticVersionId, semanticVersion, dataVersionId, ...ownerRequest } = request;
    void t008; void binding; void semanticVersionId; void semanticVersion; void dataVersionId;
    const readId = `M06-C017-${++c017ReadCounter}`;
    const raw = readC017Owner({
      ...ownerRequest, consumer: 'report', purpose: request.purpose || 'report',
      binding: {
        semanticVersionId: current.current.semanticVersionId,
        semanticVersion: current.current.publishedSemanticVersion,
        dataVersionId: asset.assetVersionId,
        t008: asset.t008
      },
      currentSummaryId: 'C017-S001-REPORT-CURRENT', summaryVersion: '1',
      formedAt: '2026-08-25T01:00:00.000Z', observedAt: '2026-08-25T01:00:00.000Z',
      readId, idempotencyKey: `idem-${readId}`
    });
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
        semanticVersionId: current.current.semanticVersionId,
        semanticVersion: current.current.publishedSemanticVersion,
        dataVersionId: raw.projection.assetVersionId,
        t008: /^\d{4}-\d{2}-\d{2}$/.test(raw.projection.t008) ? `${raw.projection.t008}T00:00:00.000Z` : raw.projection.t008
      }
    };
  };
  const c017Provider = { readCurrentC017: reportC017, readC017ForVersion: reportC017 };
  const c017Resolver = async () => reportC017({ purpose: 'report' });
  const authorizationPort = {
    authorizeReportCopilotContext: (request) => ({ decisionId: 'AUTH-C024-S001', version: '1.0.0', status: 'allowed', decidedAt: clock(), scopeRef: request.scopeRef, scenarioContext: request.scenarioContext, owner: 'platform', source: 'authorization-api' }),
    authorizeReportComparison: (request) => ({ decisionId: 'AUTH-C027-S001', owner: 'platform', source: 'authorization-api', scenarioContext: request.scenarioContext, decidedAt: clock(), allowed: true, deniedFactIds: [] })
  };
  const release = buildRelease(exact, clock());
  const runtime = m05.createM05Runtime({
    clock, release,
    models: [{ id: 's001-report-model', version: '1.0.0', execute: async ({ input: modelInput }) => ({
      output: { answer: 'fixed evidence explanation', anchors: modelInput.reportContext.anchors, evidenceRefs: [{ id: 'E-C019-S001', version: '1.0.0' }] }
    }) }]
  });
  return {
    clock, exact, readC017Owner, c008Provider, c017Provider, c017Resolver, authorizationPort,
    release, runtime,
    agentReleaseRef: { agentId: 's001-report-draft', version: '1.0.0' },
    copilotActor: { id: 's001-reader', roles: ['operator'], scenarioIds: ['S001'] }
  };
}

module.exports = Object.freeze({ buildRelease, queryInputs, createS001RuntimeResources });
