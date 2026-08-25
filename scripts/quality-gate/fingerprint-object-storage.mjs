#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { writeJson } from "./lib/quality-gate.mjs";

function parse(argv) {
  const result = { root: null, prefix: null, output: "artifacts/object-storage-fingerprint.json" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") result.root = argv[++i];
    else if (argv[i] === "--prefix") result.prefix = argv[++i];
    else if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/fingerprint-object-storage.mjs --root path --prefix pr/... [--output path]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!result.root || !result.prefix) throw new Error("--root and --prefix are required");
  if (!/^pr\/[1-9][0-9]*\/[a-f0-9]{12}\/$/.test(String(result.prefix))) {
    throw new Error("prefix must be an isolated pr/<number>/<sha12>/ namespace");
  }
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
  const fingerprint = {
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
  writeJson(options.output, fingerprint);
  console.log(`Object-storage fingerprint: ${fingerprint.value} (${files.length} files)`);
} catch (error) {
  console.error(`Object-storage fingerprint FAILED: ${error.message}`);
  process.exit(1);
}
