'use strict';

const registry = require('./schemas/registry.json');
const c014 = require('./schemas/c014-orchestration.schema.json');
const c020 = require('./schemas/c020-ai-insight.schema.json');
const c024 = require('./schemas/c024-report-copilot-request.schema.json');
const c025 = require('./schemas/c025-report-copilot-result.schema.json');
const c034 = require('./schemas/c034-checkpoint.schema.json');

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value); Object.keys(value).forEach((key) => freeze(value[key], seen)); return Object.freeze(value);
}

module.exports = freeze({ registry, c014, c020, c024, c025, c034, orchestration: c014, aiInsight: c020, reportCopilotRequest: c024, reportCopilotResult: c025, checkpoint: c034, C014: c014, C020: c020, C024: c024, C025: c025, C034: c034 });
