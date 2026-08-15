"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function digest(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

test("CP04 query assets are immutable and reproducible", () => {
  execFileSync(process.execPath, [path.join(root, "scripts/build-query-assets.cjs"), "--check"], {stdio: "pipe"});
  for (const ref of [
    "resources/m03/query-runtime.v1.json",
    "resources/m03/query-results.v1.json",
    "evidence/CP04-query-integration-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref));
  }
});

test("CP04 runs six fixed read-only queries against one exact scenario run", () => {
  const results = readJson("resources/m03/query-results.v1.json");
  assert.equal(results.executions.length, 6);
  assert.equal(results.summary.queryCount, 6);
  assert.equal(results.summary.readOnlyCount, 6);
  assert.equal(results.scenarioIdentity.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.deepEqual(
    results.executions.map((item) => item.output.queryId),
    ["S003-QRY-001", "S003-QRY-002", "S003-QRY-003", "S003-QRY-004", "S003-QRY-005", "S003-QRY-006"]
  );
});

test("CP04 materialization has no decision or notification side effects", () => {
  const results = readJson("resources/m03/query-results.v1.json");
  assert.deepEqual(results.summary, {
    queryCount: 6,
    readOnlyCount: 6,
    actionRequestsCreated: 0,
    todosCreated: 0,
    notificationsDispatched: 0,
    publishedFactsMutated: 0
  });
  for (const item of results.executions) {
    assert.deepEqual(item.output.sideEffects, {
      mutatesPublishedFacts: false,
      createsActionRequest: false,
      createsTodo: false,
      sendsNotification: false
    });
  }
});
