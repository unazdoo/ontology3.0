#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EXPECTED = "BSL-OFW-V110-94ABD0E991B7";
const root = process.cwd();
const checkpointPath = path.resolve(root, "designs/scenario-checkpoints/baselines/v1.1.0/T056-baseline-checkpoint.json");
const digestPath = path.resolve(root, "designs/scenario-checkpoints/baselines/v1.1.0/T056-baseline-checkpoint.sha256");

try {
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  const actualDigest = crypto.createHash("sha256").update(fs.readFileSync(checkpointPath)).digest("hex");
  const detachedDigest = fs.readFileSync(digestPath, "utf8").trim().split(/\s+/)[0];
  const errors = [];
  if (checkpoint.baselineSnapshotId !== EXPECTED || checkpoint.checkpointId !== EXPECTED) errors.push("baselineSnapshotId/checkpointId mismatch");
  if (checkpoint.status !== "locked" || checkpoint.baseline?.immutable !== true) errors.push("checkpoint is not locked and immutable");
  if (actualDigest !== detachedDigest) errors.push(`checkpoint digest mismatch: ${actualDigest} != ${detachedDigest}`);
  if (checkpoint.contract !== "C034") errors.push("checkpoint contract must be C034");
  if (checkpoint.acceptance?.acceptanceReady !== false) errors.push("baseline acceptanceReady must remain false");
  if (errors.length) {
    console.error(`Baseline reference gate FAILED:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Baseline reference gate passed: ${EXPECTED}`);
} catch (error) {
  console.error(`Baseline reference gate FAILED: ${error.message}`);
  process.exit(1);
}
