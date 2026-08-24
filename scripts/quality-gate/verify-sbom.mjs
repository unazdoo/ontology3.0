#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sha256, writeJson } from "./lib/quality-gate.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/verify-sbom.mjs --sbom <path> [--package <path>] [--report <path>]`);
}
function parse(argv) {
  const result = { packagePath: "package.json", report: null, root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--sbom") result.sbom = argv[++i];
    else if (option === "--package") result.packagePath = argv[++i];
    else if (option === "--root") result.root = argv[++i];
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

function sourceHash(root, paths) {
  const files = [];
  const visit = (current) => {
    if (!fs.existsSync(current)) throw new Error(`component path does not exist: ${path.relative(root, current)}`);
    const stat = fs.statSync(current);
    if (stat.isFile()) files.push(current);
    else if (stat.isDirectory()) for (const name of fs.readdirSync(current).sort()) visit(path.join(current, name));
  };
  paths.forEach((entry) => visit(path.resolve(root, entry)));
  const source = files.sort().map((file) => ({ path: path.relative(root, file).replaceAll(path.sep, "/"), sha256: sha256(fs.readFileSync(file)) }));
  return { source, sourceSha256: sha256(JSON.stringify(source)) };
}

let options;
try {
  options = parse(process.argv.slice(2));
  const sbomPath = path.resolve(options.sbom);
  const rootPath = path.resolve(options.root);
  const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
  const errors = [];
  if (sbom.spdxVersion !== "SPDX-2.3") errors.push("spdxVersion must be SPDX-2.3");
  if (sbom.SPDXID !== "SPDXRef-DOCUMENT") errors.push("SPDXID must be SPDXRef-DOCUMENT");
  if (typeof sbom.documentNamespace !== "string" || !sbom.documentNamespace) errors.push("documentNamespace is required");
  if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) errors.push("at least one package is required");
  if (!Array.isArray(sbom.relationships) || sbom.relationships.length === 0) errors.push("relationships are required");
  const ids = new Set();
  const componentIds = new Set();
  for (const [index, item] of (sbom.packages || []).entries()) {
    if (!item || typeof item !== "object") errors.push(`packages[${index}] is invalid`);
    else {
      if (typeof item.SPDXID !== "string" || !item.SPDXID) errors.push(`packages[${index}].SPDXID is required`);
      else if (ids.has(item.SPDXID)) errors.push(`duplicate package SPDXID ${item.SPDXID}`);
      else ids.add(item.SPDXID);
      if (typeof item.name !== "string" || !item.name) errors.push(`packages[${index}].name is required`);
      if (item.filesAnalyzed !== false) errors.push(`packages[${index}].filesAnalyzed must be false for dependency-only SBOM`);
      if (item.name?.startsWith("ontology3/")) {
        const source = item.externalRefs?.find((ref) => ref.referenceCategory === "OTHER" && ref.referenceType === "component-source-sha256");
        if (!source || !/^sha256:[a-f0-9]{64}$/i.test(source.referenceLocator || "")) errors.push(`component ${item.name} lacks a source SHA-256`);
        const annotation = item.annotations?.[0];
        try {
          const parsed = JSON.parse(annotation?.comment || "");
          if (!parsed.componentId || !Array.isArray(parsed.paths) || !parsed.paths.length || !Array.isArray(parsed.source) || !parsed.source.length) throw new Error("metadata");
          const actual = sourceHash(rootPath, parsed.paths);
          if (source.referenceLocator !== `sha256:${actual.sourceSha256}` || JSON.stringify(parsed.source) !== JSON.stringify(actual.source)) errors.push(`component ${item.name} source SHA-256 does not match current files`);
          componentIds.add(parsed.componentId);
        } catch (error) { errors.push(`component ${item.name} lacks verifiable source paths: ${error.message}`); }
      }
    }
  }
  const packageManifest = JSON.parse(fs.readFileSync(path.resolve(options.packagePath), "utf8"));
  const root = sbom.packages?.[0];
  if (root?.name !== packageManifest.name) errors.push(`root package name ${root?.name} does not match package.json ${packageManifest.name}`);
  if (root?.versionInfo !== String(packageManifest.version)) errors.push(`root package version ${root?.versionInfo} does not match package.json ${packageManifest.version}`);
  for (const id of ["foundation", "m01", "m02", "m03", "m04", "m05", "m06", "integration-contract-tests", "quality-gates"]) if (!componentIds.has(id)) errors.push(`required component missing: ${id}`);
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
