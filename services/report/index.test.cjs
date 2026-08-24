"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

test("M06 service Owner entry point exposes the report service and C034 provider", () => {
  const report = require("./index.js");
  assert.equal(typeof report.createReportService, "function");
  assert.equal(typeof report.createM06CheckpointProvider, "function");
  assert.equal(typeof report.buildC024Envelope, "function");
  assert.equal(typeof report.acceptC025Envelope, "function");
  assert.equal(typeof report.ReportService.prototype.createReportCopilotRequest, "function");
  assert.equal(typeof report.ReportService.prototype.requestReportCopilot, "function");
  assert.equal(typeof report.ReportService.prototype.readReportCopilotResult, "function");
  assert.equal(report.C027_SCHEMA_VERSION, "ofw.c027.report-current-comparison.v1");
});
