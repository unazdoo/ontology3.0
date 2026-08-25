#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { formatValidationErrors, nonEmpty, writeJson } from "./lib/quality-gate.mjs";

/*
 * Execute a configured E2E/performance/accessibility/security check and
 * persist a receipt.  The gate deliberately has no default "pass": callers
 * must provide either a real command or an evidence receipt.  This lets the
 * foundation run in a dependency-free checkout while keeping CI fail-closed
 * for implementation PRs.
 */

function usage() {
  console.error(`Usage: node scripts/quality-gate/run-quality-check.mjs --name <gate> [options]

Options:
  --name <gate>         Gate name (e2e, performance, accessibility, security, observability, ...)
  --command <command>   Executable to run
  --args <json>          JSON array of executable arguments
  --evidence <path>      Existing JSON receipt to validate/copy
  --output <path>        Receipt output (default: artifacts/<gate>-receipt.json)
  --allow-nonzero        Record a failed command without exiting before writing the receipt`);
}

function parse(argv) {
  const result = { output: null, args: [], allowNonzero: false };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--name") result.name = argv[++i];
    else if (option === "--command") result.command = argv[++i];
    else if (option === "--args") result.args = JSON.parse(argv[++i]);
    else if (option === "--evidence") result.evidence = argv[++i];
    else if (option === "--output") result.output = argv[++i];
    else if (option === "--allow-nonzero") result.allowNonzero = true;
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  if (!nonEmpty(result.name)) throw new Error("--name is required");
  result.output ||= `artifacts/${result.name}-receipt.json`;
  return result;
}

function readEvidence(filePath) {
  const resolved = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("evidence must be a JSON object");
  if (!['passed', 'verified'].includes(parsed.status)) throw new Error("evidence status must be passed or verified");
  if (!nonEmpty(parsed.evidence) && !nonEmpty(parsed.evidenceUri) && !nonEmpty(parsed.receiptUri)) throw new Error("evidence needs a durable URI/path");
  return { ...parsed, source: resolved };
}

function childEnvironment(gateName) {
  const allowed = /^(?:CI|GITHUB_|PR_|RUNTIME_|SCENARIO_|QUALITY_GATE_|NODE_|PATH$|HOME$|TMPDIR$|TEMP$|TMP$|LANG$|LC_)/;
  const blocked = /(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|ACCESS_KEY)/i;
  const safe = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.test(name) && !blocked.test(name)));
  return { ...safe, QUALITY_GATE_NAME: gateName };
}

let options;
try {
  options = parse(process.argv.slice(2));
  const started = Date.now();
  let receipt;
  if (options.command) {
    const result = spawnSync(options.command, options.args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: childEnvironment(options.name)
    });
    const status = result.status === 0 ? "passed" : "failed";
    receipt = {
      schemaVersion: "implementation-quality-receipt.v1",
      gate: options.name,
      status,
      command: [options.command, ...options.args],
      exitCode: result.status,
      signal: result.signal || null,
      durationMs: Date.now() - started,
      stdout: String(result.stdout || "").slice(-20000),
      stderr: String(result.stderr || "").slice(-20000),
      runtimeRunId: process.env.RUNTIME_RUN_ID || process.env.SCENARIO_RUN_ID || null,
      evidence: `artifact://${options.name}-receipt.json`
    };
    writeJson(options.output, receipt);
    if (status !== "passed" && !options.allowNonzero) {
      console.error(`${options.name} gate command failed (exit ${result.status ?? "unknown"}).`);
      process.exit(1);
    }
  } else if (options.evidence) {
    receipt = {
      schemaVersion: "implementation-quality-receipt.v1",
      gate: options.name,
      ...readEvidence(options.evidence),
      durationMs: Date.now() - started
    };
    writeJson(options.output, receipt);
  } else {
    throw new Error("provide --command or --evidence; an omitted check cannot pass");
  }
  console.log(`${options.name} gate ${receipt.status}: ${path.resolve(options.output)}`);
  if (receipt.status !== "passed" && receipt.status !== "verified") process.exit(1);
} catch (error) {
  console.error(`Quality check FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
