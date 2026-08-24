'use strict';

const m05 = require('../m05');

module.exports = Object.freeze({
  ...m05,
  ModelGateway: m05.ModelGateway,
  ToolGateway: m05.ToolGateway,
  PermissionGate: m05.PermissionGate,
  BudgetLedger: m05.BudgetLedger,
  runWithPolicy: m05.runWithPolicy,
  sanitizePrompt: m05.sanitizePrompt,
  detectPromptInjection: m05.detectPromptInjection
});
