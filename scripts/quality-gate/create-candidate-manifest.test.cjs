"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("candidate creator refuses a missing evidence manifest", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "create-candidate-manifest.mjs"), "--evidence", "/does/not/exist.json"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
});

test("candidate creator never trusts implementationCandidate flag alone", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "quality-candidate-"));
  try {
    const evidence = path.join(temp, "evidence.json");
    fs.writeFileSync(evidence, JSON.stringify({ implementationCandidate: true }));
    const result = spawnSync(process.execPath, [path.join(__dirname, "create-candidate-manifest.mjs"), "--evidence", evidence], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
