"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("cleanup emits a scoped, non-destructive receipt", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "quality-cleanup-"));
  try {
    const descriptor = { id: "pr-1-aaaaaaaaaaaa", databaseSchema: "pr_1_aaaaaaaaaaaa", objectStoragePrefix: "pr/1/aaaaaaaaaaaa/", queueNamespace: "pr-1-aaaaaaaaaaaa", credentialRef: "pr/1/aaaaaaaaaaaa" };
    const descriptorPath = path.join(temp, "env.json");
    const outputPath = path.join(temp, "cleanup.json");
    fs.writeFileSync(descriptorPath, JSON.stringify(descriptor));
    const result = spawnSync(process.execPath, [path.join(__dirname, "cleanup-pr-environment.mjs"), "--descriptor", descriptorPath, "--output", outputPath], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(outputPath, "utf8")).destructiveActionsPerformed, false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
