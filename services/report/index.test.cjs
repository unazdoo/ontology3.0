"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

test("M06 service Owner entry point exposes the report service and C034 provider", () => {
  const report = require("./index.js");
  assert.equal(typeof report.createReportService, "function");
  assert.equal(typeof report.createM06CheckpointProvider, "function");
  assert.equal(report.C027_SCHEMA_VERSION, "ofw.c027.report-current-comparison.v1");
});
