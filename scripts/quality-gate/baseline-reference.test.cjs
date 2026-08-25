"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

test("locked T056 baseline reference is internally consistent", () => {
  const script = path.join(__dirname, "verify-baseline-reference.mjs");
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
});
