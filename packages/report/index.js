"use strict";

const template = require("./template");
const render = require("./render");
const reportExport = require("./export");
const errors = require("./errors");
const utils = require("./utils");
const store = require("./store");
const definition = require("./definition");
const fixedView = require("./fixed-view");
const gate = require("./gate");
const handoff = require("./handoff");
const verification = require("./verification");
const comparison = require("./comparison");
const reportCheckpoint = require("./checkpoint");
const service = require("./service");

module.exports = Object.freeze({
  ...template,
  ...render,
  ...reportExport,
  ...errors,
  reportUtils: utils,
  ...store,
  ...definition,
  ...fixedView,
  ...gate,
  ...handoff,
  ...verification,
  ...comparison,
  ...reportCheckpoint,
  ...service,
  createReportCenterService: service.createReportService,
  createM06Service: service.createReportService,
  createManagedDefinition: definition.createManagedReportDefinition,
  createManagedTemplate: definition.createManagedReportTemplate,
  runT049: verification.runDeterministicVerification,
  compareC027: comparison.createC027Comparison,
  exportM06Checkpoint: reportCheckpoint.createM06Checkpoint,
  validateM06Export: reportCheckpoint.validateM06Checkpoint
});
