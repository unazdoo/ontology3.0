"use strict";

const { fail, ReportError } = require("./errors");
const {
  assertObject,
  assertString,
  assertArray,
  assertScenarioRun,
  immutableJson,
  stableSerialize,
  sha256,
  contentId,
  nowIso,
  sameScenarioRun
} = require("./utils");
const { createReportStore } = require("./store");
const {
  createManagedReportDefinition,
  createManagedReportTemplate,
  definitionKey,
  templateKey
} = require("./definition");
const {
  createFixedViewSnapshot,
  createDashboardDefinition,
  createDashboardContentVersion
} = require("./fixed-view");
const {
  GATE_STAGES,
  readGenerationGate,
  formFixedReportContext,
  readCurrentComparisonContext,
  normalizeC017
} = require("./gate");
const {
  buildEvidencePack,
  buildC022Request,
  C023_SCHEMA_VERSION,
  acceptC023Draft,
  createReviewArtifacts,
  assertAllowedKeys
} = require("./handoff");
const {
  acceptM05Extraction,
  EXTRACTION_RESULT_SCHEMA_VERSION,
  runDeterministicVerification,
  canConfirmOrPublish
} = require("./verification");
const {
  createC027Comparison,
  createComparisonStalenessEvent,
  materializeComparison
} = require("./comparison");
const { createFrozenReportRecord } = require("./render");
const { isContractEnvelope, unwrapStrictContractEnvelope } = require("./boundary");
const {
  buildC024Envelope,
  acceptC024ReceiptEnvelope,
  observeC025ResourceChain,
  acceptC025Envelope,
  buildC025ReadEnvelope,
  expectedC025Context
} = require("./copilot");

const SERVICE_SCHEMA_VERSION = "ofw.m06.report-service.v1";
const GENERATION_INTENT_SCHEMA_VERSION = "ofw.m06.report-generation-intent.v1";
const REVIEW_DECISION_SCHEMA_VERSION = "ofw.m06.report-review-decision.v1";
const QUALITY_WARNING_SCHEMA_VERSION = "ofw.m06.report-quality-warning.v1";
const C024_REQUEST_RECORD_SCHEMA_VERSION = "ofw.m06.c024-request-record.v1";
const COPILOT_READBACK_SCHEMA_VERSION = "ofw.m06.c025-readback-record.v1";

function requirePort(port, method, owner) {
  if (!port || typeof port[method] !== "function") fail("PORT_NOT_CONFIGURED", `${owner} port method ${method} is required`);
  return port[method].bind(port);
}

function recordRef(id, version) {
  return `${id}@${version}`;
}

function valueText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.displayValue === "string") return value.displayValue;
    if (Object.prototype.hasOwnProperty.call(value, "value")) return String(value.value);
  }
  return stableSerialize(value);
}

class ReportService {
  constructor(options = {}) {
    this.store = options.store || createReportStore(options.storeOptions);
    this.c008Provider = options.c008Provider;
    this.c017Provider = options.c017Provider;
    this.m05Port = options.m05Port;
    this.m05CopilotPort = options.m05CopilotPort || options.m05Port;
    this.authorizationPort = options.authorizationPort;
    this.clock = options.clock;
    this.idFactory = options.idFactory;
    this.requireContractEnvelopes = options.requireContractEnvelopes === true;
    this.sequence = 0;
    this.pendingGenerations = new Map();
    this.pendingCopilotRequests = new Map();
  }

  _now() {
    return nowIso(this.clock);
  }

  _id(prefix, seed) {
    this.sequence += 1;
    if (typeof this.idFactory === "function") {
      const value = this.idFactory(prefix, { seed, sequence: this.sequence, now: this._now() });
      return assertString(value, `${prefix} id`);
    }
    return contentId(prefix, { seed, sequence: this.sequence, now: this._now() });
  }

  _definition(reportDefinitionId, version) {
    const value = this.store.get("reportDefinitions", `${reportDefinitionId}@${version}`);
    if (!value) fail("REPORT_DEFINITION_NOT_FOUND", `report definition ${reportDefinitionId}@${version} was not found`);
    return value;
  }

  _template(templateId, version) {
    const value = this.store.get("reportTemplates", `${templateId}@${version}`);
    if (!value) fail("REPORT_TEMPLATE_NOT_FOUND", `report template ${templateId}@${version} was not found`);
    return value;
  }

  _audit(eventType, subjectId, details) {
    const occurredAt = this._now();
    const auditEventId = this._id("AUD", { eventType, subjectId, occurredAt, details });
    return this.store.append("auditEvents", auditEventId, {
      schemaVersion: "ofw.m06.audit-event.v1",
      auditEventId,
      eventType,
      subjectId,
      occurredAt,
      details
    });
  }

  _externalPayload(value, options) {
    if (isContractEnvelope(value)) {
      return unwrapStrictContractEnvelope(value, options);
    }
    if (this.requireContractEnvelopes) {
      fail("CONTRACT_ENVELOPE_REQUIRED", `${options?.label || "external response"} must use the strict Foundation Contract Envelope`);
    }
    return value;
  }

  registerReportDefinition(input) {
    const definition = createManagedReportDefinition(input);
    return this.store.append("reportDefinitions", definitionKey(definition), definition);
  }

  registerReportTemplate(input) {
    const definition = this._definition(input.reportDefinitionId, input.reportDefinitionVersion);
    const template = createManagedReportTemplate(input, definition);
    return this.store.append("reportTemplates", templateKey(template), template);
  }

  importFixedQueryView(input) {
    const snapshot = createFixedViewSnapshot(input);
    const pointerValue = snapshot.runStatus === "succeeded" && !snapshot.postQualityHardFailure
      ? { snapshotId: snapshot.snapshotId, viewVersion: snapshot.viewVersion }
      : this.store.pointer("fixedViews", snapshot.viewId);
    return this.store.appendMany([
      { collection: "fixedViews", id: snapshot.snapshotId, record: snapshot }
    ], pointerValue ? [{ namespace: "fixedViews", key: snapshot.viewId, value: pointerValue }] : [])[0];
  }

  registerDashboardDefinition(input) {
    const definition = createDashboardDefinition(input);
    return this.store.append("dashboardDefinitions", `${definition.dashboardId}@${definition.version}`, definition);
  }

  createDashboardVersion(input) {
    const definition = this.store.get("dashboardDefinitions", `${input.dashboardId}@${input.definitionVersion}`);
    if (!definition) fail("DASHBOARD_DEFINITION_NOT_FOUND", "dashboard definition was not found");
    const version = createDashboardContentVersion({ ...input, definition, formedAt: input.formedAt || this._now() });
    version.content.forEach((slot) => {
      if (slot.kind === "fixed-query-view" && !this.store.get("fixedViews", slot.resourceVersionRef)) {
        fail("DASHBOARD_FIXED_VIEW_NOT_FOUND", `fixed C018 snapshot ${slot.resourceVersionRef} was not found`);
      }
      if (slot.kind === "fixed-query-view") {
        const fixedView = this.store.get("fixedViews", slot.resourceVersionRef);
        if (!sameScenarioRun(fixedView.scenarioContext, version.scenarioContext)) fail("DASHBOARD_CONTEXT_MISMATCH", `dashboard slot ${slot.slotId} crosses scenario runs`);
      }
      if (slot.kind === "published-report" && !this.store.get("artifacts", slot.resourceVersionRef)) {
        fail("DASHBOARD_REPORT_NOT_FOUND", `published report artifact ${slot.resourceVersionRef} was not found`);
      }
      if (slot.kind === "published-report") {
        const artifact = this.store.get("artifacts", slot.resourceVersionRef);
        if (!sameScenarioRun(artifact.scenarioContext, version.scenarioContext)) fail("DASHBOARD_CONTEXT_MISMATCH", `dashboard report slot ${slot.slotId} crosses scenario runs`);
      }
    });
    return this.store.append("dashboardVersions", version.dashboardContentVersionId, version);
  }

  publishDashboardVersion(input) {
    const version = this.store.get("dashboardVersions", input.dashboardContentVersionId);
    if (!version) fail("DASHBOARD_VERSION_NOT_FOUND", "dashboard content version was not found");
    const publication = immutableJson({
      ...version,
      publicationId: input.publicationId || this._id("DASHPUB", version.dashboardContentVersionId),
      status: "published",
      publishedAt: input.publishedAt || this._now(),
      publishedBy: assertString(input.publishedBy, "dashboard publishedBy")
    });
    const publicationRecordId = `${version.dashboardContentVersionId}:publication:${publication.publicationId}`;
    this.store.appendMany([
      { collection: "dashboardVersions", id: publicationRecordId, record: publication }
    ], [{ namespace: "dashboards", key: version.dashboardId, value: { dashboardContentVersionId: publicationRecordId } }]);
    return publication;
  }

  generateReport(input) {
    const key = input?.requestId || input?.idempotencyKey || null;
    if (!key) return this._generateReport(input);
    if (this.pendingGenerations.has(key)) return this.pendingGenerations.get(key);
    const pending = this._generateReport(input).finally(() => this.pendingGenerations.delete(key));
    this.pendingGenerations.set(key, pending);
    return pending;
  }

  async _generateReport(input) {
    assertObject(input, "report generation input");
    const scenarioContext = assertScenarioRun(input.scenarioContext, null);
    const definition = this._definition(input.reportDefinitionId, input.reportDefinitionVersion);
    const template = this._template(definition.templateRef.templateId, definition.templateRef.version);
    if (!definition.applicability.scenarioIds.includes(scenarioContext.scenarioId)) {
      fail("REPORT_SCENARIO_NOT_ALLOWED", "report definition does not allow this scenario");
    }
    if (Array.isArray(input.generationScope?.sections)) {
      const allowedSections = new Set(definition.sections.map((section) => section.sectionId));
      const unknownSections = input.generationScope.sections.filter((sectionId) => !allowedSections.has(sectionId));
      if (unknownSections.length) fail("GENERATION_SCOPE_OUT_OF_SCOPE", "generation scope contains unknown report sections", { unknownSections });
    }
    assertObject(input.objectScope, "objectScope");
    assertString(input.objectScope.objectTypeId || input.objectScope.objectType, "objectScope.objectTypeId");
    assertString(input.objectScope.objectId || input.objectScope.objectSetId, "objectScope.objectId");
    const requestId = input.requestId || this._id("RGEN", { scenarioContext, definition: definitionKey(definition), objectScope: input.objectScope });
    const reportAggregateId = input.reportAggregateId || this._id("RAG", { requestId, scenarioContext });
    const intent = immutableJson({
      schemaVersion: GENERATION_INTENT_SCHEMA_VERSION,
      requestId,
      reportAggregateId,
      scenarioContext,
      definitionRef: { reportDefinitionId: definition.reportDefinitionId, version: definition.version },
      templateRef: { templateId: template.templateId, version: template.version },
      objectScope: input.objectScope,
      generationScope: input.generationScope,
      requestedBy: assertString(input.requestedBy, "generation requestedBy"),
      requestedAt: input.requestedAt || this._now(),
      requestFingerprint: sha256({ scenarioContext, definition: definitionKey(definition), template: templateKey(template), objectScope: input.objectScope, generationScope: input.generationScope }),
      immutable: true
    });
    const existingIntent = this.store.get("generationRequests", requestId);
    if (existingIntent && existingIntent.requestFingerprint !== intent.requestFingerprint) {
      fail("GENERATION_REQUEST_CONFLICT", "requestId already identifies a different generation intent");
    }
    this.store.append("generationRequests", requestId, intent);
    const existingDraft = this.store.list("sourceDrafts", (draft) => draft.requestId === requestId)[0];
    if (existingDraft) return this._generationResult(existingDraft);
    const existingC022 = this.store.get("c022Requests", requestId);
    if (existingC022) return this._resumeC022(existingC022, definition, template);

    const gateReads = [];
    const seenReceiptIds = new Set();
    let evidenceItems;
    try {
      const first = await readGenerationGate({
        stage: GATE_STAGES[0], scenarioContext, requestId, idempotencyKey: intent.requestFingerprint, c008Provider: this.c008Provider, c017Provider: this.c017Provider,
        clock: this.clock, seenReceiptIds, requireContractEnvelope: this.requireContractEnvelopes
      });
      gateReads.push(first);
      this.store.append("generationGateReads", first.gateReadId, { ...first, requestId });
      if (typeof input.collectEvidence !== "function") fail("EVIDENCE_COLLECTOR_REQUIRED", "collectEvidence must build governed evidence after the first live gate");
      evidenceItems = await input.collectEvidence(immutableJson({
        scenarioContext,
        requestId,
        reportAggregateId,
        definition,
        template,
        exactCombination: first.exactCombination
      }));
      const second = await readGenerationGate({
        stage: GATE_STAGES[1], scenarioContext, requestId, idempotencyKey: intent.requestFingerprint, c008Provider: this.c008Provider, c017Provider: this.c017Provider,
        clock: this.clock, seenReceiptIds, requireContractEnvelope: this.requireContractEnvelopes
      });
      gateReads.push(second);
      this.store.append("generationGateReads", second.gateReadId, { ...second, requestId });
      const third = await readGenerationGate({
        stage: GATE_STAGES[2], scenarioContext, requestId, idempotencyKey: intent.requestFingerprint, c008Provider: this.c008Provider, c017Provider: this.c017Provider,
        clock: this.clock, seenReceiptIds, requireContractEnvelope: this.requireContractEnvelopes
      });
      gateReads.push(third);
      this.store.append("generationGateReads", third.gateReadId, { ...third, requestId });
    } catch (error) {
      this._audit("generation-gate-blocked", requestId, { code: error.code || "UNEXPECTED_ERROR", message: error.message, gateReads: gateReads.map((read) => read.gateReadId) });
      throw error;
    }
    const fixedContext = formFixedReportContext({ gateReads });
    const fixedAt = this._now();
    const evidencePack = buildEvidencePack({ definition, template, fixedContext, evidenceItems, fixedAt });
    const c022 = buildC022Request({
      requestId,
      reportAggregateId,
      scenarioContext,
      definition,
      template,
      objectScope: input.objectScope,
      generationScope: input.generationScope,
      evidencePack,
      fixedContext,
      requestedAt: intent.requestedAt,
      idempotencyKey: `idem-v1:${sha256({ requestId, evidencePackId: evidencePack.evidencePackId })}`
    });
    const handoffId = this._id("C022OUT", { requestId, evidencePackId: evidencePack.evidencePackId });
    this.store.appendMany([
      { collection: "evidencePacks", id: evidencePack.evidencePackId, record: evidencePack },
      { collection: "c022Requests", id: requestId, record: c022 },
      { collection: "handoffAttempts", id: handoffId, record: { handoffId, contract: "C022", requestId, status: "submitted", submittedAt: this._now(), targetOwner: "M05", evidencePackId: evidencePack.evidencePackId } }
    ]);
    return this._submitC022(c022, definition, template, handoffId);
  }

  async _resumeC022(c022, definition, template) {
    const lookup = this.m05Port && this.m05Port.readReportGeneration;
    if (typeof lookup === "function") {
      const existing = await lookup.call(this.m05Port, immutableJson({ requestId: c022.requestId, scenarioContext: c022.scenarioContext }));
      if (existing) {
        const payload = this._externalPayload(existing, { scenarioContext: c022.scenarioContext, payloadSchemaVersion: C023_SCHEMA_VERSION, label: "M05 C023 response" });
        return this._acceptC023(payload, c022, definition, template, this._id("C022RESUME", c022.requestId));
      }
    }
    return this._submitC022(c022, definition, template, this._id("C022RETRY", c022.requestId));
  }

  async _submitC022(c022, definition, template, handoffId) {
    const submit = requirePort(this.m05Port, "submitReportGeneration", "M05");
    let response;
    try {
      response = await submit(c022);
    } catch (error) {
      this.store.append("handoffAttempts", `${handoffId}:failed`, {
        handoffId: `${handoffId}:failed`, contract: "C022", requestId: c022.requestId, status: "failed", failedAt: this._now(), error: { code: error.code || "M05_ERROR", message: error.message }
      });
      throw error;
    }
    const payload = this._externalPayload(response, { scenarioContext: c022.scenarioContext, payloadSchemaVersion: C023_SCHEMA_VERSION, label: "M05 C023 response" });
    return this._acceptC023(payload, c022, definition, template, handoffId);
  }

  _acceptC023(response, c022, definition, template, handoffId) {
    const sourceDraft = acceptC023Draft(response, c022, definition, template);
    this.store.appendMany([
      { collection: "sourceDrafts", id: sourceDraft.sourceDraftId, record: sourceDraft },
      { collection: "c023Receipts", id: sourceDraft.handoffReceipt.receiptId, record: sourceDraft.handoffReceipt }
    ]);
    let artifacts;
    try {
      artifacts = createReviewArtifacts({
        sourceDraft,
        definition,
        template,
        evidencePack: c022.evidencePack,
        reportAggregateId: c022.reportAggregateId,
        formedAt: this._now()
      });
    } catch (error) {
      this.store.append("handoffAttempts", `${handoffId}:review-failed`, {
        handoffId: `${handoffId}:review-failed`,
        contract: "C023",
        requestId: c022.requestId,
        sourceDraftId: sourceDraft.sourceDraftId,
        status: "review_failed",
        failedAt: this._now(),
        error: { code: error.code || "C023_REVIEW_ERROR", message: error.message }
      });
      throw error;
    }
    const entries = [
      { collection: "reviewCopies", id: artifacts.reviewCopy.reviewCopyId, record: artifacts.reviewCopy },
      { collection: "contentVersions", id: artifacts.contentVersion.contentVersionId, record: artifacts.contentVersion },
      { collection: "handoffAttempts", id: `${handoffId}:accepted`, record: { handoffId: `${handoffId}:accepted`, contract: "C023", requestId: c022.requestId, sourceDraftId: sourceDraft.sourceDraftId, status: "accepted", acceptedAt: sourceDraft.handoffReceipt.acceptedAt } },
      ...artifacts.anchors.map((anchor) => ({ collection: "anchors", id: anchor.t044Id, record: anchor }))
    ];
    this.store.appendMany(entries, [{
      namespace: "reports",
      key: c022.reportAggregateId,
      value: { contentVersionId: artifacts.contentVersion.contentVersionId, reviewCopyId: artifacts.reviewCopy.reviewCopyId, stage: "review" }
    }]);
    this._audit("c022-c023-accepted", c022.requestId, { sourceDraftId: sourceDraft.sourceDraftId, contentVersionId: artifacts.contentVersion.contentVersionId });
    return immutableJson({ c022, sourceDraft, ...artifacts });
  }

  _generationResult(sourceDraft) {
    const contentVersion = this.store.list("contentVersions", (content) => content.sourceDraftRef.sourceDraftId === sourceDraft.sourceDraftId)[0];
    const reviewCopy = this.store.list("reviewCopies", (review) => review.sourceDraftId === sourceDraft.sourceDraftId)[0];
    const anchors = this.store.list("anchors", (anchor) => anchor.sourceDraftId === sourceDraft.sourceDraftId);
    const c022 = this.store.get("c022Requests", sourceDraft.requestId);
    return immutableJson({ c022, sourceDraft, reviewCopy, contentVersion, anchors });
  }

  _resolveReportCopilotRequest(input) {
    assertObject(input, "report copilot request input");
    assertAllowedKeys(input, [
      "reportId", "reportNumber", "artifactVersion", "contentVersionId", "anchorIds", "selectionScope",
      "purpose", "question", "c017Ref", "agentReleaseRef", "semanticEvidenceRefs",
      "t049RunId", "comparisonRecordId", "requestedBy", "requestedAt", "correlationId", "traceId",
      "requestId", "eventId"
    ], "report copilot request input");
    const reportId = assertString(input.reportId, "reportId");
    const artifact = this.store.get("artifacts", reportId);
    if (!artifact) fail("PUBLISHED_REPORT_NOT_FOUND", "official C024 requires an existing published report");
    if (input.reportNumber && input.reportNumber !== artifact.reportNo) fail("REPORT_NUMBER_MISMATCH", "requested report number does not match the published artifact");
    if (input.artifactVersion && input.artifactVersion !== artifact.artifactVersion) fail("ARTIFACT_VERSION_MISMATCH", "requested artifact version does not match the published artifact");
    if (input.contentVersionId && input.contentVersionId !== artifact.contentVersionId) fail("CONTENT_VERSION_MISMATCH", "requested content version does not match the published artifact");
    const contentVersion = this.store.get("contentVersions", artifact.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "published content version was not found");
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    if (!evidencePack) fail("EVIDENCE_PACK_NOT_FOUND", "published report evidence pack was not found");
    const anchorIds = assertArray(input.anchorIds, "anchorIds", { nonEmpty: true });
    const uniqueAnchorIds = [...new Set(anchorIds.map((id) => assertString(id, "anchorId")))];
    const anchors = uniqueAnchorIds.map((anchorId) => {
      const anchor = this.store.get("anchors", anchorId);
      if (!anchor) fail("T044_NOT_FOUND", `stable anchor ${anchorId} was not found`);
      return anchor;
    });
    const t049 = input.t049RunId ? this.store.get("verificationRuns", input.t049RunId) : null;
    if (input.t049RunId && !t049) fail("T049_NOT_FOUND", "specified T049 result was not found");
    const comparison = input.comparisonRecordId ? this.store.get("comparisons", input.comparisonRecordId) : null;
    if (input.comparisonRecordId && !comparison) fail("COMPARISON_NOT_FOUND", "specified C027 comparison was not found");
    return {
      artifact,
      contentVersion,
      evidencePack,
      anchors,
      c017Ref: input.c017Ref || evidencePack.generationBindingSummary,
      agentReleaseRef: input.agentReleaseRef,
      semanticEvidenceRefs: input.semanticEvidenceRefs || [],
      t049,
      comparison,
      purpose: input.purpose,
      question: input.question,
      selectionScope: input.selectionScope,
      requestedBy: input.requestedBy,
      requestedAt: input.requestedAt || this._now(),
      correlationId: input.correlationId,
      traceId: input.traceId,
      requestId: input.requestId,
      eventId: input.eventId,
      intentFingerprint: sha256({
        reportId: artifact.reportId,
        contentVersionId: contentVersion.contentVersionId,
        evidencePackId: evidencePack.evidencePackId,
        anchorIds: uniqueAnchorIds,
        purpose: input.purpose,
        question: input.question,
        agentReleaseRef: input.agentReleaseRef,
        t049RunId: input.t049RunId || null,
        comparisonRecordId: input.comparisonRecordId || null,
        requestedBy: input.requestedBy
      }),
      authorizationScopeRef: contentId("C024-AUTH-SCOPE", {
        reportId: artifact.reportId,
        contentVersionId: contentVersion.contentVersionId,
        evidencePackId: evidencePack.evidencePackId,
        anchorIds: uniqueAnchorIds,
        purpose: input.purpose
      })
    };
  }

  async createReportCopilotRequest(input) {
    const resolved = this._resolveReportCopilotRequest(input);
    const priorById = input.requestId ? this.store.get("c024Requests", input.requestId) : null;
    const priorByIntent = this.store.list("c024Requests", (record) => record.intentFingerprint === resolved.intentFingerprint)[0];
    const priorIntent = priorById || priorByIntent;
    if (priorIntent) {
      if (priorIntent.intentFingerprint !== resolved.intentFingerprint) {
        fail("C024_IDEMPOTENCY_CONFLICT", "C024 requestId already belongs to a different report copilot intent");
      }
      return immutableJson({
        fixedReportContext: this.store.get("fixedReportContexts", priorIntent.fixedContextId),
        request: priorIntent,
        envelope: priorIntent.envelope
      });
    }
    const authorize = requirePort(this.authorizationPort, "authorizeReportCopilotContext", "platform authorization");
    const decision = await authorize(immutableJson({
      scenarioContext: resolved.artifact.scenarioContext,
      actorRef: resolved.requestedBy,
      scopeRef: resolved.authorizationScopeRef,
      reportId: resolved.artifact.reportId,
      contentVersionId: resolved.contentVersion.contentVersionId,
      evidencePackId: resolved.evidencePack.evidencePackId,
      anchorIds: resolved.anchors.map((anchor) => anchor.t044Id),
      purpose: resolved.purpose
    }));
    assertObject(decision, "report copilot authorization decision");
    assertAllowedKeys(decision, [
      "decisionId", "version", "status", "decidedAt", "scopeRef", "scenarioContext", "owner", "source"
    ], "report copilot authorization decision");
    assertScenarioRun(decision.scenarioContext, resolved.artifact.scenarioContext, "report copilot authorization scenarioContext");
    if (decision.owner !== "platform" || decision.source !== "authorization-api"
        || decision.scopeRef !== resolved.authorizationScopeRef || decision.status !== "allowed") {
      fail("COPILOT_NOT_AUTHORIZED", "platform authorization did not allow the exact report copilot context", {
        decisionId: decision.decisionId || null,
        status: decision.status || null,
        expectedScopeRef: resolved.authorizationScopeRef,
        actualScopeRef: decision.scopeRef || null
      });
    }
    const built = buildC024Envelope({
      ...resolved,
      authorizationRef: {
        decisionId: decision.decisionId,
        version: decision.version,
        status: decision.status,
        decidedAt: decision.decidedAt,
        scopeRef: decision.scopeRef
      }
    });
    const priorByBuiltId = this.store.get("c024Requests", built.payload.requestId);
    const priorByIdempotency = this.store.list("c024Requests", (record) => record.idempotencyKey === built.envelope.idempotencyKey)[0];
    const prior = priorByBuiltId || priorByIdempotency;
    if (prior) {
      if (prior.requestFingerprint !== built.payload.requestFingerprint) {
        fail("C024_IDEMPOTENCY_CONFLICT", "C024 request identity already belongs to a different fixed report context or intent");
      }
      return immutableJson({
        fixedReportContext: this.store.get("fixedReportContexts", prior.fixedContextId),
        request: prior,
        envelope: prior.envelope
      });
    }
    const request = immutableJson({
      schemaVersion: C024_REQUEST_RECORD_SCHEMA_VERSION,
      contractId: "C024",
      requestId: built.payload.requestId,
      requestFingerprint: built.payload.requestFingerprint,
      intentFingerprint: resolved.intentFingerprint,
      idempotencyKey: built.envelope.idempotencyKey,
      scenarioContext: built.payload.scenarioContext,
      fixedContextId: built.fixedReportContext.fixedContextId,
      fixedContextVersion: built.fixedReportContext.version,
      reportRef: built.fixedReportContext.reportRef,
      evidencePackRef: built.fixedReportContext.evidencePackRef,
      anchorSnapshotRef: {
        id: built.fixedReportContext.anchorSnapshot.anchorSnapshotId,
        version: built.fixedReportContext.anchorSnapshot.version
      },
      agentReleaseRef: built.fixedReportContext.agentReleaseRef,
      purpose: built.payload.selectionIntent.purpose,
      requestedAt: built.payload.requestedAt,
      requestedBy: built.payload.requestedBy,
      envelope: built.envelope,
      immutable: true
    });
    this.store.appendMany([
      { collection: "fixedReportContexts", id: built.fixedReportContext.fixedContextId, record: built.fixedReportContext },
      { collection: "c024Requests", id: request.requestId, record: request }
    ], [{ namespace: "copilot", key: request.reportRef.reportId, value: { requestId: request.requestId, fixedContextId: request.fixedContextId } }]);
    return immutableJson({ fixedReportContext: built.fixedReportContext, request, envelope: built.envelope });
  }

  async requestReportCopilot(input) {
    const prepared = await this.createReportCopilotRequest(input);
    const key = prepared.request.idempotencyKey;
    if (this.pendingCopilotRequests.has(key)) return this.pendingCopilotRequests.get(key);
    const pending = this._requestReportCopilot(prepared).finally(() => this.pendingCopilotRequests.delete(key));
    this.pendingCopilotRequests.set(key, pending);
    return pending;
  }

  async _requestReportCopilot(prepared) {
    const existing = this.store.list("c025References", (reference) => reference.requestId === prepared.request.requestId)[0];
    if (existing) return this._readReportCopilotReference(prepared, existing);
    const received = this.store.list("c024Handoffs", (handoff) => handoff.requestId === prepared.request.requestId && handoff.status === "accepted")[0];
    if (received) {
      // A prior receive/run may have completed even if M06 lost the response.
      // Read by the same idempotent request; never start a second M05 Run.
      const observation = this.store.list("copilotReadbacks", (item) => item.requestId === prepared.request.requestId && item.stage === "run-observed")[0];
      if (!observation) {
        fail("C025_IDEMPOTENCY_CHAIN_UNKNOWN", "M06 cannot prove the original M05 resource chain; a retry may not start or accept another Run");
      }
      return this._readReportCopilotReference(prepared, observation);
    }
    const receive = requirePort(this.m05CopilotPort, "receiveReportCopilotRequest", "M05 report copilot");
    const run = requirePort(this.m05CopilotPort, "runReportCopilot", "M05 report copilot");
    let receiptEnvelope;
    try {
      receiptEnvelope = await receive(prepared.envelope);
      if (!receiptEnvelope) fail("C024_RECEIPT_NOT_FOUND", "M05 did not return a strict C024 receipt");
      const receipt = acceptC024ReceiptEnvelope(receiptEnvelope, {
        requestId: prepared.request.requestId,
        idempotencyKey: prepared.request.idempotencyKey,
        scenarioContext: prepared.request.scenarioContext,
        fixedContextId: prepared.request.fixedContextId,
        fixedContextVersion: prepared.request.fixedContextVersion
      });
      const handoff = immutableJson({
        handoffId: contentId("C024-HANDOFF", { requestId: receipt.requestId, receivedAt: receipt.receivedAt }),
        requestId: receipt.requestId,
        idempotencyKey: receipt.idempotencyKey,
        scenarioContext: receipt.scenarioContext,
        fixedContextRef: receipt.fixedContextRef,
        status: "accepted",
        receivedAt: receipt.receivedAt,
        owner: "M05",
        immutable: true
      });
      this.store.append("c024Handoffs", handoff.handoffId, handoff);
    } catch (error) {
      this._recordCopilotFailure(prepared.request, "receive", error);
      throw error;
    }
    let runEnvelope;
    try {
      runEnvelope = await run(prepared.envelope, receiptEnvelope);
      if (!runEnvelope) fail("C025_NOT_FOUND", "M05 did not return a strict C025 result after the Run");
      const observation = observeC025ResourceChain(runEnvelope, expectedC025Context(prepared.envelope));
      this._storeC025ChainObservation(prepared, observation, runEnvelope);
      const acceptedRun = acceptC025Envelope(runEnvelope, expectedC025Context(prepared.envelope));
      return this._readReportCopilotReference(prepared, {
        ...acceptedRun.reference,
        referenceFingerprint: acceptedRun.referenceFingerprint,
        resourceChainFingerprint: acceptedRun.resourceChainFingerprint
      });
    } catch (error) {
      this._recordCopilotFailure(prepared.request, "run", error);
      throw error;
    }
  }

  async _readReportCopilotReference(prepared, expectedReference) {
    const read = requirePort(this.m05CopilotPort, "readReportCopilotResult", "M05 report copilot");
    const readIdempotencyKey = `idem-v1:${sha256({
      operation: "C025-read",
      requestId: prepared.request.requestId,
      resultId: expectedReference?.resultRef?.id || null
    })}`;
    const readEnvelope = buildC025ReadEnvelope({
      requestId: prepared.request.requestId,
      idempotencyKey: readIdempotencyKey,
      sourceIdempotencyKey: prepared.request.idempotencyKey,
      scenarioContext: prepared.request.scenarioContext,
      fixedContextRef: { id: prepared.request.fixedContextId, version: prepared.request.fixedContextVersion },
      bindingRef: expectedReference?.bindingRef || null,
      sessionRef: expectedReference?.sessionRef || null,
      runRef: expectedReference?.runRef || null,
      resultRef: expectedReference?.resultRef || null,
      requestedAt: this._now(),
      actorRef: prepared.request.requestedBy,
      correlationId: prepared.envelope.correlationId,
      traceId: prepared.envelope.traceId
    });
    let resultEnvelope;
    try {
      resultEnvelope = await read(readEnvelope);
      if (!resultEnvelope) fail("C025_NOT_FOUND", "M05 did not return the C025 result for the fixed request context");
      const accepted = acceptC025Envelope(resultEnvelope, expectedC025Context(prepared.envelope));
      if (expectedReference?.resourceChainFingerprint && accepted.resourceChainFingerprint !== expectedReference.resourceChainFingerprint) {
        fail("C025_IDEMPOTENT_REFERENCE_MISMATCH", "M05 changed Binding/Session/Run/Result for an idempotent C024 request");
      }
      if (expectedReference?.referenceFingerprint && accepted.referenceFingerprint !== expectedReference.referenceFingerprint) {
        fail("C025_IDEMPOTENT_REFERENCE_MISMATCH", "M05 changed Binding/Session/Run/Result for an idempotent C024 request");
      }
      return this._storeC025Reference(prepared, accepted, resultEnvelope);
    } catch (error) {
      this._recordCopilotFailure(prepared.request, "read", error);
      throw error;
    }
  }

  _storeC025Reference(prepared, accepted, resultEnvelope) {
    const existing = this.store.list("c025References", (reference) => reference.requestId === prepared.request.requestId)[0];
    if (existing && existing.referenceFingerprint !== accepted.referenceFingerprint) {
      fail("C025_IDEMPOTENT_REFERENCE_MISMATCH", "M05 returned a different C025 resource chain for the same request");
    }
    const reference = existing || immutableJson({
      ...accepted.reference,
      referenceFingerprint: accepted.referenceFingerprint,
      sourceEnvelopeRef: { eventId: resultEnvelope.eventId, eventType: resultEnvelope.eventType },
      recordedAt: this._now()
    });
    const readback = immutableJson({
      schemaVersion: COPILOT_READBACK_SCHEMA_VERSION,
      readbackId: this._id("C025-READBACK", { requestId: reference.requestId, resultId: reference.resultRef.id }),
      requestId: reference.requestId,
      c025ReferenceId: reference.c025ReferenceId,
      referenceFingerprint: reference.referenceFingerprint,
      sourceEnvelopeRef: { eventId: resultEnvelope.eventId, eventType: resultEnvelope.eventType },
      outcome: reference.outcome,
      successful: reference.successful,
      readAt: this._now(),
      owner: "M06",
      readOnly: true,
      immutable: true
    });
    this.store.appendMany([
      { collection: "c025References", id: reference.c025ReferenceId, record: reference },
      { collection: "copilotReadbacks", id: readback.readbackId, record: readback }
    ], [{ namespace: "copilot", key: reference.reportRef.reportId, value: { requestId: reference.requestId, c025ReferenceId: reference.c025ReferenceId } }]);
    this._audit("c024-c025-readback", reference.requestId, {
      bindingId: reference.bindingRef.id,
      sessionId: reference.sessionRef.id,
      runId: reference.runRef.id,
      resultId: reference.resultRef.id,
      outcome: reference.outcome
    });
    return reference;
  }

  _storeC025ChainObservation(prepared, observation, resultEnvelope) {
    const existing = this.store.list("copilotReadbacks", (item) => item.requestId === prepared.request.requestId && item.stage === "run-observed")[0];
    if (existing) {
      if (existing.resourceChainFingerprint !== observation.resourceChainFingerprint) {
        fail("C025_IDEMPOTENT_REFERENCE_MISMATCH", "M05 exposed a second resource chain for the same C024 request");
      }
      return existing;
    }
    const record = immutableJson({
      schemaVersion: COPILOT_READBACK_SCHEMA_VERSION,
      readbackId: this._id("C025-CHAIN", { requestId: prepared.request.requestId, fingerprint: observation.resourceChainFingerprint }),
      requestId: prepared.request.requestId,
      c025ReferenceId: null,
      bindingRef: observation.bindingRef,
      sessionRef: observation.sessionRef,
      runRef: observation.runRef,
      resultRef: observation.resultRef,
      resourceChainFingerprint: observation.resourceChainFingerprint,
      referenceFingerprint: null,
      sourceEnvelopeRef: { eventId: resultEnvelope.eventId, eventType: resultEnvelope.eventType },
      stage: "run-observed",
      outcome: "observed",
      successful: false,
      readAt: this._now(),
      owner: "M06",
      readOnly: true,
      immutable: true
    });
    this.store.append("copilotReadbacks", record.readbackId, record);
    return record;
  }

  _recordCopilotFailure(request, stage, error) {
    const readback = immutableJson({
      schemaVersion: COPILOT_READBACK_SCHEMA_VERSION,
      readbackId: this._id("C025-FAIL", { requestId: request.requestId, stage, code: error.code || "ERROR" }),
      requestId: request.requestId,
      c025ReferenceId: null,
      referenceFingerprint: null,
      sourceEnvelopeRef: null,
      stage,
      outcome: "failed",
      successful: false,
      error: { code: error.code || "M05_COPILOT_ERROR", message: error.message },
      readAt: this._now(),
      owner: "M06",
      readOnly: true,
      immutable: true
    });
    this.store.append("copilotReadbacks", readback.readbackId, readback);
  }

  async readReportCopilotResult(input) {
    assertObject(input, "report copilot read input");
    assertAllowedKeys(input, ["requestId"], "report copilot read input");
    const request = this.store.get("c024Requests", assertString(input.requestId, "requestId"));
    if (!request) fail("C024_REQUEST_NOT_FOUND", "C024 request was not found");
    const fixedReportContext = this.store.get("fixedReportContexts", request.fixedContextId);
    const prepared = immutableJson({ fixedReportContext, request, envelope: request.envelope });
    const existing = this.store.list("c025References", (reference) => reference.requestId === request.requestId)[0] || null;
    return this._readReportCopilotReference(prepared, existing);
  }

  getReportCopilotReference(requestId) {
    const reference = this.store.list("c025References", (item) => item.requestId === requestId)[0];
    return reference || null;
  }

  async verifyContent(input) {
    assertObject(input, "verification input");
    const contentVersion = this.store.get("contentVersions", input.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "content version was not found");
    const definition = this._definition(contentVersion.definitionRef.reportDefinitionId, contentVersion.definitionRef.version);
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    const anchors = this.store.list("anchors", (anchor) => anchor.contentVersionId === contentVersion.contentVersionId);
    const verificationRunId = input.verificationRunId || this._id("T049RUN", { contentVersionId: contentVersion.contentVersionId, initiatedAt: input.initiatedAt || this._now() });
    const initiatedAt = input.initiatedAt || this._now();
    const extract = requirePort(this.m05Port, "extractReportClaims", "M05");
    const rawExtraction = await extract(immutableJson({
      schemaVersion: "ofw.c024.report-verification-extraction-request.v1",
      requestId: this._id("C024EXT", verificationRunId),
      scenarioContext: contentVersion.scenarioContext,
      contentVersionId: contentVersion.contentVersionId,
      contentItems: contentVersion.contentItems,
      anchors,
      evidencePackRef: contentVersion.evidencePackRef,
      fixedContext: { exactCombination: evidencePack.exactCombination, generationBindingSummary: evidencePack.generationBindingSummary },
      purpose: "claim-extraction-only-no-deterministic-outcome"
    }));
    const extractionPayload = this._externalPayload(rawExtraction, { scenarioContext: contentVersion.scenarioContext, payloadSchemaVersion: EXTRACTION_RESULT_SCHEMA_VERSION, label: "M05 extraction response" });
    const extraction = acceptM05Extraction(extractionPayload, { contentVersion, anchors });
    const currentContext = await readCurrentComparisonContext({
      scenarioContext: contentVersion.scenarioContext,
      c008Provider: this.c008Provider,
      c017Provider: this.c017Provider,
      purpose: "M06-T049-current-status",
      clock: this.clock,
      requireContractEnvelope: this.requireContractEnvelopes
    });
    const completedAt = this._now();
    const t049 = runDeterministicVerification({
      verificationRunId,
      version: input.version || "1.0.0",
      contentVersion,
      definition,
      evidencePack,
      anchors,
      extraction,
      currentContext,
      scope: input.scope,
      initiatedBy: input.initiatedBy,
      initiatedAt,
      completedAt
    });
    this.store.appendMany([
      { collection: "verificationExtractions", id: extraction.extractionResultId, record: extraction },
      { collection: "verificationRuns", id: t049.verificationRunId, record: t049 }
    ], [{ namespace: "verifications", key: contentVersion.contentVersionId, value: { verificationRunId: t049.verificationRunId } }]);
    this._audit("t049-completed", t049.verificationRunId, { contentVersionId: contentVersion.contentVersionId, status: t049.status, coverageStatus: t049.coverageStatus });
    return t049;
  }

  async _readBoundC017(contentVersion, evidencePack, purpose) {
    const reader = requirePort(this.c017Provider, "readC017ForVersion", "M02");
    const raw = await reader(immutableJson({
      scenarioContext: contentVersion.scenarioContext,
      purpose,
      semanticVersionId: evidencePack.exactCombination.semanticVersionId,
      dataVersionId: evidencePack.exactCombination.dataVersionId,
      t008: evidencePack.exactCombination.t008,
      requestedAt: this._now()
    }));
    const summary = normalizeC017(raw, contentVersion.scenarioContext, { allowHardFailure: true, requireContractEnvelope: this.requireContractEnvelopes });
    const fixed = evidencePack.exactCombination;
    if (summary.semanticVersionId !== fixed.semanticVersionId || summary.dataVersionId !== fixed.dataVersionId || summary.t008 !== fixed.t008) {
      fail("BOUND_QUALITY_SUMMARY_MISMATCH", "C017 bound-version response does not match the exact report content binding");
    }
    return summary;
  }

  async confirmReview(input) {
    const contentVersion = this.store.get("contentVersions", input.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "content version was not found");
    const definition = this._definition(contentVersion.definitionRef.reportDefinitionId, contentVersion.definitionRef.version);
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    const t049 = this.store.get("verificationRuns", input.verificationRunId);
    if (!t049 || t049.contentVersionId !== contentVersion.contentVersionId || !canConfirmOrPublish(t049, definition)) {
      fail("REVIEW_CONFIRMATION_BLOCKED", "a complete non-blocking T049 result is required before human confirmation");
    }
    const c017 = await this._readBoundC017(contentVersion, evidencePack, "M06-review-confirmation-gate");
    if (c017.hardFailure || c017.qualityStatus === "hard-fail") {
      this._audit("review-confirmation-quality-blocked", contentVersion.contentVersionId, { summaryId: c017.summaryId, failureId: c017.failureId });
      fail("POST_QUALITY_HARD_FAILURE", "human confirmation is blocked by a post-publication hard quality failure");
    }
    const decision = immutableJson({
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      reviewDecisionId: input.reviewDecisionId || this._id("REVIEW", input),
      contentVersionId: contentVersion.contentVersionId,
      reviewCopyId: assertString(input.reviewCopyId, "reviewCopyId"),
      verificationRunId: t049.verificationRunId,
      decision: "confirmed",
      reviewer: assertString(input.reviewer, "reviewer"),
      conclusion: assertString(input.conclusion, "review conclusion"),
      confirmedAt: input.confirmedAt || this._now(),
      c017GateRef: { summaryId: c017.summaryId, version: c017.version, readReceiptId: c017.receipt.receiptId },
      immutable: true
    });
    return this.store.append("reviewDecisions", decision.reviewDecisionId, decision);
  }

  _renderInput(input, contentVersion, definition, template, evidencePack, t049) {
    const anchors = this.store.list("anchors", (anchor) => anchor.contentVersionId === contentVersion.contentVersionId);
    const anchorByContent = new Map(anchors.map((anchor) => [anchor.sourceContentItemId, anchor]));
    const itemsBySection = new Map(definition.sections.map((section) => [section.sectionId, []]));
    contentVersion.contentItems.forEach((item) => {
      itemsBySection.get(item.sectionId)?.push({
        contentItemId: item.sourceContentItemId,
        anchorId: anchorByContent.get(item.sourceContentItemId)?.t044Id,
        text: valueText(item.structuredContent),
        factRefs: item.facts.map((fact) => fact.factId),
        evidenceRefs: anchorByContent.get(item.sourceContentItemId)?.evidenceRefs || item.evidenceRefs,
        templateSlot: item.templateSlotId
      });
    });
    return {
      reportId: input.reportId,
      contentVersionId: contentVersion.contentVersionId,
      scenarioContext: contentVersion.scenarioContext,
      status: "published",
      title: input.title || definition.title,
      subtitle: input.subtitle || null,
      definition: {
        reportDefinitionId: definition.reportDefinitionId,
        version: definition.version,
        title: definition.title,
        sections: definition.sections
      },
      template: {
        templateId: template.templateId,
        version: template.version,
        reportDefinitionId: definition.reportDefinitionId,
        slots: template.slots.map((slot) => ({ slotId: slot.templateSlotId, sectionId: slot.sectionId }))
      },
      sections: definition.sections.map((section) => ({ sectionId: section.sectionId, blocks: itemsBySection.get(section.sectionId) })),
      renderManifest: {
        manifestId: contentId("RM", { contentVersionId: contentVersion.contentVersionId, anchors: anchors.map((anchor) => anchor.t044Id) }),
        version: "1.0.0",
        items: contentVersion.contentItems.map((item) => {
          const anchor = anchorByContent.get(item.sourceContentItemId);
          return {
            contentItemId: item.sourceContentItemId,
            anchorId: anchor.t044Id,
            sectionId: item.sectionId,
            templateSlot: item.templateSlotId,
            location: anchor.stableLocation,
            factRefs: item.facts.map((fact) => fact.factId),
            evidenceRefs: anchor.evidenceRefs
          };
        })
      },
      verificationPlan: t049.results.map((result) => ({ id: result.resultId, factId: result.factId, contentItemId: result.sourceContentItemId, checkType: result.groupId, owner: "M06", t044Ids: result.t044Ids })),
      contentSnapshot: {
        contentVersion,
        exactCombination: evidencePack.exactCombination,
        generationBindingSummary: evidencePack.generationBindingSummary,
        evidencePackRef: contentVersion.evidencePackRef,
        verificationRunId: t049.verificationRunId,
        coverage: t049.coverage,
        factCoverage: t049.factCoverage
      }
    };
  }

  async publishReport(input) {
    assertObject(input, "publication input");
    const contentVersion = this.store.get("contentVersions", input.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "content version was not found");
    const definition = this._definition(contentVersion.definitionRef.reportDefinitionId, contentVersion.definitionRef.version);
    const template = this._template(contentVersion.templateRef.templateId, contentVersion.templateRef.version);
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    const t049 = this.store.get("verificationRuns", input.verificationRunId);
    const reviewDecision = this.store.get("reviewDecisions", input.reviewDecisionId);
    if (!reviewDecision || reviewDecision.contentVersionId !== contentVersion.contentVersionId || reviewDecision.decision !== "confirmed") {
      fail("PUBLICATION_REVIEW_REQUIRED", "exact human review confirmation is required");
    }
    if (!t049 || t049.verificationRunId !== reviewDecision.verificationRunId || !canConfirmOrPublish(t049, definition)) {
      fail("PUBLICATION_T049_REQUIRED", "exact complete T049 publication basis is required");
    }
    const reportId = assertString(input.reportId, "reportId");
    if (this.store.get("artifacts", reportId)) fail("IMMUTABLE_REPORT_EXISTS", `published report ${reportId} already exists and cannot be overwritten`);
    const requestedReportNo = input.reportNo || reportId;
    if (this.store.list("artifacts", (item) => item.reportNo === requestedReportNo).length) {
      fail("IMMUTABLE_REPORT_NUMBER_EXISTS", `report number ${requestedReportNo} already identifies an immutable artifact`);
    }
    const runId = input.publicationRunId || this._id("PUBRUN", { reportId, contentVersionId: contentVersion.contentVersionId });
    const startedAt = input.startedAt || this._now();
    const startSummary = await this._readBoundC017(contentVersion, evidencePack, "M06-publication-start-gate");
    if (startSummary.hardFailure || startSummary.qualityStatus === "hard-fail") {
      this.store.append("publicationRuns", runId, { publicationRunId: runId, reportId, contentVersionId: contentVersion.contentVersionId, status: "blocked", stage: "publication-start", startedAt, completedAt: this._now(), c017Ref: startSummary.summaryId });
      fail("POST_QUALITY_HARD_FAILURE", "publication is blocked by a post-publication hard quality failure");
    }
    const renderInput = this._renderInput({ ...input, reportId }, contentVersion, definition, template, evidencePack, t049);
    let frozen;
    try {
      frozen = createFrozenReportRecord(renderInput, { now: input.publishedAt || this._now() });
    } catch (error) {
      this.store.append("publicationRuns", runId, { publicationRunId: runId, reportId, contentVersionId: contentVersion.contentVersionId, status: "failed", stage: "render", startedAt, completedAt: this._now(), partialArtifactsPublished: false, error: { code: error.code || "RENDER_ERROR", message: error.message } });
      throw error;
    }
    const finalizeSummary = await this._readBoundC017(contentVersion, evidencePack, "M06-publication-finalize-gate");
    if (finalizeSummary.hardFailure || finalizeSummary.qualityStatus === "hard-fail") {
      this.store.append("publicationRuns", runId, { publicationRunId: runId, reportId, contentVersionId: contentVersion.contentVersionId, status: "blocked", stage: "artifact-finalize", startedAt, completedAt: this._now(), c017Ref: finalizeSummary.summaryId, partialArtifactsPublished: false });
      fail("POST_QUALITY_HARD_FAILURE", "formal artifact creation was stopped before persistence by a hard quality failure");
    }
    const artifact = immutableJson({
      ...frozen,
      artifactVersion: input.artifactVersion || "1.0.0",
      reportNo: requestedReportNo,
      reportAggregateId: contentVersion.reportAggregateId,
      replacedReportId: input.replacedReportId || null,
      replacedReportNo: input.replacedReportNo || null,
      regenerationRequestId: input.regenerationRequestId || null,
      publishedAt: input.publishedAt || this._now(),
      publishedBy: assertString(input.publishedBy, "publishedBy"),
      publicationRunId: runId,
      publicationVerificationRef: { verificationRunId: t049.verificationRunId },
      reviewDecisionRef: { reviewDecisionId: reviewDecision.reviewDecisionId },
      artifactManifest: {
        sourceHash: frozen.sourceHash,
        htmlSha256: frozen.contentVersions[0].htmlSha256,
        pdfSha256: frozen.contentVersions[0].pdfSha256,
        sameSource: true,
        reportId,
        contentVersionId: contentVersion.contentVersionId
      },
      evidencePackRef: contentVersion.evidencePackRef,
      sourceDraftRef: contentVersion.sourceDraftRef,
      anchors: this.store.list("anchors", (anchor) => anchor.contentVersionId === contentVersion.contentVersionId),
      coverage: t049.coverage,
      immutable: true
    });
    const publicationRun = {
      publicationRunId: runId,
      reportId,
      contentVersionId: contentVersion.contentVersionId,
      status: "completed",
      startedAt,
      completedAt: artifact.publishedAt,
      htmlSha256: artifact.contentVersions[0].htmlSha256,
      pdfSha256: artifact.contentVersions[0].pdfSha256,
      sourceHash: artifact.contentVersions[0].sourceHash,
      sameSource: true,
      c017GateRefs: [startSummary.receipt.receiptId, finalizeSummary.receipt.receiptId]
    };
    this.store.appendMany([
      { collection: "artifacts", id: reportId, record: artifact },
      { collection: "publicationRuns", id: runId, record: publicationRun }
    ], [{ namespace: "reports", key: contentVersion.reportAggregateId, value: { reportId, contentVersionId: contentVersion.contentVersionId, stage: "published" } }]);
    this._audit("report-published", reportId, { publicationRunId: runId, contentVersionId: contentVersion.contentVersionId, sameSource: true });
    return artifact;
  }

  async compareWithCurrent(input) {
    assertObject(input, "C027 input");
    if (input.explicitUserAction !== true) fail("EXPLICIT_USER_ACTION_REQUIRED", "C027 may only be started by an explicit user action");
    const contentVersion = this.store.get("contentVersions", input.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "content version was not found");
    const definition = this._definition(contentVersion.definitionRef.reportDefinitionId, contentVersion.definitionRef.version);
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    const initiatedAt = input.initiatedAt || this._now();
    if (input.idempotencyKey) {
      const prior = this.store.list("comparisons", (item) => item.idempotencyKey === input.idempotencyKey);
      if (prior.length) return this.getComparison(prior[0].comparisonRecordId);
    }
    const currentContext = await readCurrentComparisonContext({
      scenarioContext: contentVersion.scenarioContext,
      c008Provider: this.c008Provider,
      c017Provider: this.c017Provider,
      purpose: "M06-C027-explicit-user-comparison",
      clock: this.clock,
      requireContractEnvelope: this.requireContractEnvelopes
    });
    const authorize = requirePort(this.authorizationPort, "authorizeReportComparison", "platform authorization");
    const comparisonRunId = input.comparisonRunId || this._id("C027RUN", { contentVersionId: contentVersion.contentVersionId, initiatedBy: input.initiatedBy });
    if (this.store.get("verificationRuns", comparisonRunId) || comparisonRunId === contentVersion.sourceDraftRef.generationRunId) {
      fail("RUN_ID_REUSED", "C027 comparison run must be independent from generation and T049 runs");
    }
    let comparison;
    try {
      const authorization = await authorize(immutableJson({
        scenarioContext: contentVersion.scenarioContext,
        actor: input.initiatedBy,
        contentVersionId: contentVersion.contentVersionId,
        factIds: contentVersion.factInventory.map((fact) => fact.factId),
        purpose: "C027"
      }));
      comparison = createC027Comparison({
        explicitUserAction: input.explicitUserAction,
        initiatedBy: input.initiatedBy,
        initiatedAt,
        comparedAt: input.comparedAt || this._now(),
        comparisonRunId,
        idempotencyKey: input.idempotencyKey || null,
        contentVersion,
        evidencePack,
        currentContext,
        definition,
        authorization
      });
    } catch (error) {
      const attemptId = contentId("C027ATT", { comparisonRunId, code: error.code || "ERROR" });
      this.store.append("comparisonAttempts", attemptId, {
        attemptId,
        comparisonRunId,
        contentVersionId: contentVersion.contentVersionId,
        scenarioContext: contentVersion.scenarioContext,
        initiatedBy: input.initiatedBy,
        explicitUserAction: input.explicitUserAction === true,
        status: "failed",
        failedAt: this._now(),
        error: { code: error.code || "C027_ERROR", message: error.message }
      });
      throw error;
    }
    const prior = this.store.list("comparisons", (item) => item.contentVersionId === contentVersion.contentVersionId);
    const stalenessEvents = prior.map((item) => createComparisonStalenessEvent(item, currentContext, comparison.comparedAt)).filter(Boolean);
    this.store.appendMany([
      { collection: "comparisons", id: comparison.comparisonRecordId, record: comparison },
      ...stalenessEvents.map((event) => ({ collection: "comparisonStaleness", id: event.stalenessEventId, record: event }))
    ], [{ namespace: "comparisons", key: contentVersion.contentVersionId, value: { comparisonRecordId: comparison.comparisonRecordId } }]);
    this._audit("c027-completed", comparison.comparisonRecordId, { result: comparison.result, staleEvents: stalenessEvents.length });
    return comparison;
  }

  async markComparisonStaleIfAuthorityChanged(input) {
    const comparison = this.store.get("comparisons", input.comparisonRecordId);
    if (!comparison) fail("COMPARISON_NOT_FOUND", "C027 comparison record was not found");
    const currentContext = await readCurrentComparisonContext({
      scenarioContext: comparison.scenarioContext,
      c008Provider: this.c008Provider,
      c017Provider: this.c017Provider,
      purpose: "M06-C027-staleness-observation",
      clock: this.clock,
      requireContractEnvelope: this.requireContractEnvelopes
    });
    const event = createComparisonStalenessEvent(comparison, currentContext, input.observedAt || this._now());
    if (event) this.store.append("comparisonStaleness", event.stalenessEventId, event);
    return materializeComparison(comparison, this.store.list("comparisonStaleness", (item) => item.comparisonRecordId === comparison.comparisonRecordId));
  }

  getComparison(comparisonRecordId) {
    const comparison = this.store.get("comparisons", comparisonRecordId);
    if (!comparison) return null;
    return materializeComparison(comparison, this.store.list("comparisonStaleness", (item) => item.comparisonRecordId === comparisonRecordId));
  }

  requestRegeneration(input) {
    assertObject(input, "regeneration input");
    if (input.explicitUserAction !== true) fail("EXPLICIT_USER_ACTION_REQUIRED", "regeneration requires an explicit user action");
    const comparison = input.comparisonRecordId ? this.store.get("comparisons", input.comparisonRecordId) : null;
    const contentVersion = this.store.get("contentVersions", input.contentVersionId || comparison?.contentVersionId);
    if (!contentVersion) fail("CONTENT_VERSION_NOT_FOUND", "regeneration source content version was not found");
    const request = immutableJson({
      schemaVersion: "ofw.m06.report-regeneration-request.v1",
      regenerationRequestId: input.regenerationRequestId || this._id("REGEN", input),
      scenarioContext: contentVersion.scenarioContext,
      sourceContentVersionId: contentVersion.contentVersionId,
      sourceReportId: input.sourceReportId || null,
      sourceComparisonRecordId: comparison?.comparisonRecordId || null,
      sourceVerificationRunId: input.verificationRunId || null,
      sourceReviewIssueId: input.reviewIssueId || null,
      requestedBy: assertString(input.requestedBy, "regeneration requestedBy"),
      requestedAt: input.requestedAt || this._now(),
      explicitUserAction: true,
      status: "requested",
      immutable: true
    });
    return this.store.append("regenerationRequests", request.regenerationRequestId, request);
  }

  async observePostPublicationQualityFailure(input) {
    assertObject(input, "post-publication quality input");
    const artifact = this.store.get("artifacts", input.reportId);
    if (!artifact) fail("PUBLISHED_REPORT_NOT_FOUND", "published report was not found");
    const contentVersion = this.store.get("contentVersions", artifact.contentVersionId);
    const evidencePack = this.store.get("evidencePacks", contentVersion.evidencePackRef.evidencePackId);
    const c017 = await this._readBoundC017(contentVersion, evidencePack, "M06-post-publication-quality-observation");
    if (!c017.hardFailure && c017.qualityStatus !== "hard-fail") return null;
    const warning = immutableJson({
      schemaVersion: QUALITY_WARNING_SCHEMA_VERSION,
      warningId: contentId("QWARN", { reportId: artifact.reportId, failureId: c017.failureId, summaryId: c017.summaryId }),
      reportId: artifact.reportId,
      contentVersionId: artifact.contentVersionId,
      severity: "warning-on-historical-report",
      message: "A post-publication hard quality failure was discovered; frozen report content and its publication-basis T049 remain unchanged.",
      failureId: c017.failureId,
      affectedScope: c017.affectedScope,
      qualityFactAt: c017.qualityFactAt,
      qualityConfirmedAt: c017.confirmedAt || null,
      summaryId: c017.summaryId,
      summaryFormedAt: c017.formedAt,
      firstReadAt: input.firstReadAt || this._now(),
      originalContentChanged: false,
      originalVerificationChanged: false,
      blocksGenerationFromDataVersion: c017.dataVersionId,
      immutable: true
    });
    return this.store.append("qualityWarnings", warning.warningId, warning);
  }

  recordPostPublicationQualityFailure(input) {
    return this.observePostPublicationQualityFailure(input);
  }

  runVerification(input) {
    return this.verifyContent(input);
  }

  createCurrentComparison(input) {
    return this.compareWithCurrent(input);
  }

  getPublishedReport(reportId) {
    const artifact = this.store.get("artifacts", reportId);
    if (!artifact) return null;
    const warnings = this.store.list("qualityWarnings", (warning) => warning.reportId === reportId);
    return immutableJson({ artifact, warnings });
  }

  getFixedView(snapshotId) {
    return this.store.get("fixedViews", snapshotId);
  }

  getCurrentFixedView(viewId) {
    const pointer = this.store.pointer("fixedViews", viewId);
    return pointer ? this.store.get("fixedViews", pointer.snapshotId) : null;
  }

  getDashboard(dashboardId) {
    const pointer = this.store.pointer("dashboards", dashboardId);
    if (!pointer) return null;
    return this.store.get("dashboardVersions", pointer.dashboardContentVersionId);
  }

  getReportDefinition(reportDefinitionId, version) {
    return this._definition(reportDefinitionId, version);
  }

  getReportTemplate(templateId, version) {
    return this._template(templateId, version);
  }

  snapshot() {
    return this.store.snapshot();
  }
}

function createReportService(options) {
  return new ReportService(options);
}

module.exports = Object.freeze({
  SERVICE_SCHEMA_VERSION,
  GENERATION_INTENT_SCHEMA_VERSION,
  REVIEW_DECISION_SCHEMA_VERSION,
  QUALITY_WARNING_SCHEMA_VERSION,
  ReportService,
  createReportService,
  ReportError,
  recordRef
});
