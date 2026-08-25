'use strict';

// Convenience entry point for consumers that only need the minimum audit
// metadata. Storage, retention, authorization and append-only behavior remain
// outside this module.
const contracts = require('./index');

module.exports = Object.freeze({
  AUDIT_FIELDS: contracts.AUDIT_FIELDS,
  AUDIT_FIELD_PURPOSES: contracts.AUDIT_FIELD_PURPOSES,
  auditFieldsSchema: contracts.auditFieldsSchema,
  validateAuditFields: contracts.validateAuditFields,
  assertAuditFields: contracts.assertAuditFields,
  createAuditFields: contracts.createAuditFields,
  normalizeAuditFields: contracts.normalizeAuditFields
});
