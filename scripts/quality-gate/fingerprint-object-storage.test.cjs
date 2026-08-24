"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("object-storage fingerprint is deterministic for a prefix", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "quality-fingerprint-"));
  try {
    fs.writeFileSync(path.join(temp, "a.txt"), "a");
    const script = path.join(__dirname, "fingerprint-object-storage.mjs");
    const one = spawnSync(process.execPath, [script, "--root", temp, "--prefix", "pr/1/aaaaaaaaaaaa/"], { encoding: "utf8" });
    const two = spawnSync(process.execPath, [script, "--root", temp, "--prefix", "pr/1/aaaaaaaaaaaa/"], { encoding: "utf8" });
    assert.equal(one.status, 0, one.stderr);
    assert.equal(two.status, 0, two.stderr);
    assert.match(one.stdout, /[a-f0-9]{64}/);
    assert.equal(one.stdout, two.stdout);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
