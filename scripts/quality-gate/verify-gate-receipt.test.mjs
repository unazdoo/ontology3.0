import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.join(path.dirname(new URL(import.meta.url).pathname), "verify-gate-receipt.mjs");

test("gate receipt adapter maps kebab-case CI names and rejects placeholders", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gate-receipt-"));
  try {
    const manifest = path.join(directory, "manifest.json");
    const report = path.join(directory, "report.json");
    fs.writeFileSync(manifest, JSON.stringify({ checks: { e2e: { status: "verified", evidence: "artifact://e2e-run.json", scenarioId: "S001", runtimeRunId: "S001-RUN-20260824-1" } } }), "utf8");
    const success = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "e2e", "--report", report], { encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(fs.readFileSync(report, "utf8")).valid, true);

    fs.writeFileSync(manifest, JSON.stringify({ checks: { e2e: { status: "passed", evidence: "fixture://example" } } }), "utf8");
    const failure = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "e2e"], { encoding: "utf8" });
    assert.notEqual(failure.status, 0);
    assert.match(`${failure.stdout}\n${failure.stderr}`, /placeholder|fixture/i);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
