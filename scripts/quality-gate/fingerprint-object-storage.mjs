#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJson, writeJson } from "./lib/quality-gate.mjs";
import { fingerprintLiveObjectStorage } from "./lib/pr-environment-provider.mjs";

function parse(argv) {
  const result = { root: null, prefix: null, descriptor: null, receipt: null, roundId: process.env.IMPLEMENTATION_ROUND_ID || null, live: false, output: "artifacts/object-storage-fingerprint.json" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") result.root = argv[++i];
    else if (argv[i] === "--prefix") result.prefix = argv[++i];
    else if (argv[i] === "--descriptor") result.descriptor = argv[++i];
    else if (argv[i] === "--receipt") result.receipt = argv[++i];
    else if (argv[i] === "--round-id") result.roundId = argv[++i];
    else if (argv[i] === "--live") result.live = true;
    else if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/fingerprint-object-storage.mjs (--root path --prefix pr/... | --live --descriptor path --receipt path) [--round-id id] [--output path]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (result.live) {
    if (!result.descriptor || !result.receipt) throw new Error("live mode requires --descriptor and --receipt");
  } else if (!result.root || !result.prefix) throw new Error("descriptor mode requires --root and --prefix");
  if (result.prefix && !/^pr\/[1-9][0-9]*\/[a-f0-9]{7,12}\/$/.test(String(result.prefix))) throw new Error("prefix must be an isolated pr/<number>/<sha>/ namespace");
  return result;
}

function filesUnder(root, relative = "") {
  const current = path.join(root, relative);
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(root, child) : [child];
  });
}

try {
  const options = parse(process.argv.slice(2));
  let fingerprint;
  if (options.live) {
    fingerprint = await fingerprintLiveObjectStorage({ descriptor: readJson(options.descriptor), receipt: readJson(options.receipt), roundId: options.roundId || undefined });
    if (options.prefix && fingerprint.prefix !== options.prefix) throw new Error("requested prefix does not match the live provider receipt");
  } else {
    const root = path.resolve(options.root);
    const outputPath = path.resolve(options.output);
    const files = filesUnder(root).filter((relative) => path.resolve(root, relative) !== outputPath).sort();
    const hash = crypto.createHash("sha256");
    for (const relative of files) {
      hash.update(relative.replaceAll(path.sep, "/"));
      hash.update("\0");
      hash.update(fs.readFileSync(path.join(root, relative)));
      hash.update("\0");
    }
    fingerprint = {
      schemaVersion: "implementation-object-storage-fingerprint.v1",
      status: "verified",
      sourceType: "fixture-shape-only",
      productionEvidence: false,
      algorithm: "sha256",
      value: hash.digest("hex"),
      prefix: options.prefix,
      fileCount: files.length,
      evidence: "artifact://object-storage-fingerprint.json"
    };
  }
  writeJson(options.output, fingerprint);
  console.log(`Object-storage fingerprint: ${fingerprint.value} (${fingerprint.fileCount} files; ${fingerprint.sourceType})`);
} catch (error) {
  console.error(`Object-storage fingerprint FAILED: ${error.message}`);
  process.exit(1);
}
