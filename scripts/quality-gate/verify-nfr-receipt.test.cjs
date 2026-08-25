"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("NFR receipt verifier enforces performance and accessibility evidence", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "quality-nfr-"));
  try {
    const script = path.join(__dirname, "verify-nfr-receipt.mjs");
    const performance = path.join(temp, "performance.json");
    fs.writeFileSync(performance, JSON.stringify({ status: "passed", evidence: "artifact://perf", p95Ms: 120, sloMs: 200 }));
    assert.equal(spawnSync(process.execPath, [script, "--kind", "performance", "--receipt", performance]).status, 0);
    const accessibility = path.join(temp, "a11y.json");
    fs.writeFileSync(accessibility, JSON.stringify({ status: "passed", evidence: "artifact://a11y", standard: "WCAG-2.2-AA", violations: 1, keyboard: true }));
    assert.notEqual(spawnSync(process.execPath, [script, "--kind", "accessibility", "--receipt", accessibility]).status, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
