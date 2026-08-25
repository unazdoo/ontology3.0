'use strict';

const contractEnvelopeSchema = require('./schemas/contract-envelope.schema.json');
const scenarioContextSchema = require('./schemas/scenario-context.schema.json');
const resourceRefSchema = require('./schemas/resource-ref.schema.json');
const evidenceRefSchema = require('./schemas/evidence-ref.schema.json');
const auditFieldsSchema = require('./schemas/audit-fields.schema.json');
const featureFlagConfigSchema = require('./schemas/feature-flag-config.schema.json');
const schemaRegistry = require('./schemas/registry.json');
const validation = require('./validation');
const config = require('./config');
const compatibility = require('./compatibility');

const SCHEMA_DRAFT = 'http://json-schema.org/draft-07/schema#';
const SCHEMA_VERSION = 'draft-0.1.0';
const CONTRACT_SCHEMA_VERSION = SCHEMA_VERSION;
const DRAFT_SCHEMA_VERSION = SCHEMA_VERSION;
const CONTRACT_ENVELOPE_SCHEMA_VERSION = SCHEMA_VERSION;
const CONTRACT_STATUS = 'draft';
const CONTRACT_OWNER = 'Foundation / packages/contracts';

const schemas = Object.freeze({
  registry: schemaRegistry,
  contractEnvelope: contractEnvelopeSchema,
  envelope: contractEnvelopeSchema,
  scenarioContext: scenarioContextSchema,
  resourceRef: resourceRefSchema,
  evidenceRef: evidenceRefSchema,
  auditFields: auditFieldsSchema,
  featureFlagConfig: featureFlagConfigSchema
});

module.exports = Object.assign({
  SCHEMA_DRAFT,
  SCHEMA_VERSION,
  DRAFT_SCHEMA_VERSION,
  CONTRACT_SCHEMA_VERSION,
  CONTRACT_ENVELOPE_SCHEMA_VERSION,
  CONTRACT_STATUS,
  CONTRACT_OWNER,
  schemaRegistry,
  schemas,
  SCHEMAS: schemas,
  contractEnvelopeSchema,
  envelopeSchema: contractEnvelopeSchema,
  CONTRACT_ENVELOPE_SCHEMA: contractEnvelopeSchema,
  ENVELOPE_SCHEMA: contractEnvelopeSchema,
  scenarioContextSchema,
  SCENARIO_CONTEXT_SCHEMA: scenarioContextSchema,
  resourceRefSchema,
  RESOURCE_REF_SCHEMA: resourceRefSchema,
  evidenceRefSchema,
  EVIDENCE_REF_SCHEMA: evidenceRefSchema,
  auditFieldsSchema,
  AUDIT_FIELDS_SCHEMA: auditFieldsSchema,
  featureFlagConfigSchema,
  FEATURE_FLAG_CONFIG_SCHEMA: featureFlagConfigSchema
}, validation, config, compatibility);
