"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(path.join(__dirname, "FOUNDATION-RUNBOOK.md"), "utf8");

test("Foundation runbook keeps the operational safety gates explicit", () => {
  for (const phrase of [
    "npm test",
    "npm run check",
    "git diff --check",
    "compatibility classifier",
    "new `scenarioRunId`",
    "overwritesSource=false",
    "Action Requests",
    "Rollback"
  ]) {
    assert.match(runbook, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), phrase);
  }
});
