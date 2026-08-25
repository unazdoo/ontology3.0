#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sha256, writeJson } from "./lib/quality-gate.mjs";

function parse(argv) {
  const result = { manifest: "quality-gates/golden/s001/manifest.json", report: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--manifest") result.manifest = argv[++i];
    else if (argv[i] === "--report") result.report = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/verify-golden-data.mjs [--manifest path] [--report path]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return result;
}

try {
  const options = parse(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const dataPath = path.resolve(path.dirname(manifestPath), path.basename(manifest.path));
  const actual = sha256(fs.readFileSync(dataPath));
  const errors = [];
  if (manifest.algorithm !== "sha256") errors.push("algorithm must be sha256");
  if (manifest.sha256 !== actual) errors.push(`sha256 mismatch: ${manifest.sha256} != ${actual}`);
  if (manifest.redacted !== true) errors.push("golden data must be marked redacted");
  if (manifest.reproducible !== true) errors.push("golden data must be marked reproducible");
  if (manifest.scenarioId !== "S001") errors.push("golden dataset must be scoped to S001");
  const report = { manifest: options.manifest, valid: errors.length === 0, sha256: actual, errors };
  if (options.report) writeJson(options.report, report);
  if (errors.length) {
    console.error(`Golden data gate FAILED:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Golden data gate passed: ${actual}`);
} catch (error) {
  console.error(`Golden data gate FAILED: ${error.message}`);
  process.exit(1);
}
