#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sha256, writeJson } from "./lib/quality-gate.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/verify-sbom.mjs --sbom <path> [--package <path>] [--report <path>]`);
}
function parse(argv) {
  const result = { packagePath: "package.json", report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--sbom") result.sbom = argv[++i];
    else if (option === "--package") result.packagePath = argv[++i];
    else if (option === "--report") result.report = argv[++i];
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  if (!result.sbom) throw new Error("--sbom is required");
  return result;
}

function fail(errors) {
  const error = new Error("SBOM validation failed");
  error.details = errors;
  throw error;
}

let options;
try {
  options = parse(process.argv.slice(2));
  const sbomPath = path.resolve(options.sbom);
  const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
  const errors = [];
  if (sbom.spdxVersion !== "SPDX-2.3") errors.push("spdxVersion must be SPDX-2.3");
  if (sbom.SPDXID !== "SPDXRef-DOCUMENT") errors.push("SPDXID must be SPDXRef-DOCUMENT");
  if (typeof sbom.documentNamespace !== "string" || !sbom.documentNamespace) errors.push("documentNamespace is required");
  if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) errors.push("at least one package is required");
  if (!Array.isArray(sbom.relationships) || sbom.relationships.length === 0) errors.push("relationships are required");
  const ids = new Set();
  for (const [index, item] of (sbom.packages || []).entries()) {
    if (!item || typeof item !== "object") errors.push(`packages[${index}] is invalid`);
    else {
      if (typeof item.SPDXID !== "string" || !item.SPDXID) errors.push(`packages[${index}].SPDXID is required`);
      else if (ids.has(item.SPDXID)) errors.push(`duplicate package SPDXID ${item.SPDXID}`);
      else ids.add(item.SPDXID);
      if (typeof item.name !== "string" || !item.name) errors.push(`packages[${index}].name is required`);
      if (item.filesAnalyzed !== false) errors.push(`packages[${index}].filesAnalyzed must be false for dependency-only SBOM`);
    }
  }
  const packageManifest = JSON.parse(fs.readFileSync(path.resolve(options.packagePath), "utf8"));
  const root = sbom.packages?.[0];
  if (root?.name !== packageManifest.name) errors.push(`root package name ${root?.name} does not match package.json ${packageManifest.name}`);
  if (root?.versionInfo !== String(packageManifest.version)) errors.push(`root package version ${root?.versionInfo} does not match package.json ${packageManifest.version}`);
  if (errors.length) fail(errors);
  const report = {
    schemaVersion: "implementation-sbom-verification.v1",
    status: "passed",
    sbom: sbomPath,
    packageCount: sbom.packages.length,
    sbomSha256: sha256(fs.readFileSync(sbomPath)),
    evidence: "artifact://sbom.spdx.json"
  };
  if (options.report) writeJson(options.report, report);
  console.log(`SBOM verified: ${sbom.packages.length} packages; sha256=${report.sbomSha256}`);
} catch (error) {
  console.error(`SBOM verification FAILED: ${error.message}`);
  for (const detail of error.details || []) console.error(`- ${detail}`);
  usage();
  process.exit(1);
}
