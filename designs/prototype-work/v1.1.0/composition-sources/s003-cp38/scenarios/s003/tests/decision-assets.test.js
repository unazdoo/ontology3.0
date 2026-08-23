"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function readJson(ref) { return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8")); }
function digest(ref) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex"); }

test("CP05 decision assets are deterministic and hash-locked", () => {
  execFileSync(process.execPath, [path.join(root, "scripts/build-decision-assets.cjs"), "--check"], {stdio: "pipe"});
  execFileSync(process.execPath, [path.join(root, "scripts/build-decision-results.cjs"), "--check"], {stdio: "pipe"});
  for (const ref of ["resources/m04/decision-runtime.v1.json", "resources/m04/decision-results.v1.json", "evidence/CP05-decision-chain-validation.md"]) {
    assert.equal(fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0], digest(ref));
  }
});

test("CP05 confirms exactly one candidate and creates one generic Action Request/todo", () => {
  const results = readJson("resources/m04/decision-results.v1.json");
  assert.equal(results.candidateSummary.total, 9);
  assert.equal(results.candidateSummary.confirmed, 1);
  assert.equal(results.candidateSummary.actionRequestsCreated, 1);
  assert.equal(results.candidateSummary.todosCreated, 1);
  assert.equal(results.candidateSummary.approvalsStarted, 0);
  assert.equal(results.policy.reviewer, null);
  assert.equal(results.policy.multiLevelApproval, false);
  assert.equal(results.policy.multiUserPermissions, false);
  assert.equal(results.confirmedDecision.actionRequest.actionTypeId, "S003_SPECIAL_DISPOSAL");
  assert.equal(results.confirmedDecision.todo.target, "负责人待办");
});

test("CP05 keeps the other candidates awaiting human confirmation", () => {
  const results = readJson("resources/m04/decision-results.v1.json");
  const waiting = results.candidatesBeforeConfirmation.filter((candidate) => candidate.candidateId !== results.confirmedDecision.candidateId);
  assert.equal(waiting.length, 8);
  assert.ok(waiting.every((candidate) => candidate.requiresHumanConfirmation));
  assert.ok(waiting.every((candidate) => candidate.status === "CANDIDATE_AWAITING_HUMAN_CONFIRMATION"));
});
