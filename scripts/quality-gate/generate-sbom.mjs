#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sha256, writeJson } from "./lib/quality-gate.mjs";

/*
 * Dependency-free SPDX generator.  It intentionally reads lockfiles when
 * present and falls back to declared dependency ranges when this foundation
 * package has no lockfile.  The resulting artifact is evidence, not a claim
 * that a package range was resolved at runtime.
 */

function usage() {
  console.error(`Usage: node scripts/quality-gate/generate-sbom.mjs [options]

Options:
  --root <path>       Repository root (default: current directory)
  --output <path>     SPDX JSON output path (default: artifacts/sbom.spdx.json)
  --package <path>    package.json path relative to root
  --allow-missing     Emit an empty root SBOM when package.json is absent`);
}

function parse(argv) {
  const result = { root: process.cwd(), output: "artifacts/sbom.spdx.json", package: null, allowMissing: false };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--root") result.root = argv[++i];
    else if (option === "--output") result.output = argv[++i];
    else if (option === "--package") result.package = argv[++i];
    else if (option === "--allow-missing") result.allowMissing = true;
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  return result;
}

function readJsonIf(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function packageRef(name, version) {
  return `SPDXRef-Package-${sha256(`${name}@${version}`).slice(0, 24)}`;
}

function addPackage(packages, seen, { name, version, license, supplier, downloadLocation, integrity, relationship = "DEPENDS_ON" }) {
  if (!name || !version) return null;
  const key = `${name}@${version}`;
  if (seen.has(key)) return seen.get(key);
  const SPDXID = packageRef(name, version);
  const entry = {
    SPDXID,
    name,
    versionInfo: String(version),
    downloadLocation: downloadLocation || "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: license || "NOASSERTION",
    licenseDeclared: license || "NOASSERTION",
    supplier: supplier || "NOASSERTION",
    externalRefs: []
  };
  if (integrity) {
    entry.externalRefs.push({
      referenceCategory: "PACKAGE-MANAGER",
      referenceType: "purl",
      referenceLocator: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}#integrity=${encodeURIComponent(integrity)}`
    });
  }
  seen.set(key, SPDXID);
  packages.push({ entry, relationship });
  return SPDXID;
}

function collectFromLock(lock, packages, seen) {
  if (!lock || typeof lock !== "object") return;
  // npm lockfile v2/v3: packages keys are node_modules paths.
  if (lock.packages && typeof lock.packages === "object") {
    for (const [location, value] of Object.entries(lock.packages)) {
      if (!value || !value.version || location === "") continue;
      const name = value.name || location.split("node_modules/").pop();
      addPackage(packages, seen, {
        name,
        version: value.version,
        license: value.license,
        integrity: value.integrity,
        downloadLocation: value.resolved
      });
    }
  }
  // npm lockfile v1: dependencies is a nested tree.
  function visit(tree, prefix = "") {
    if (!tree || typeof tree !== "object") return;
    for (const [name, value] of Object.entries(tree)) {
      if (!value || typeof value !== "object") continue;
      if (value.version) addPackage(packages, seen, {
        name,
        version: value.version,
        integrity: value.integrity,
        downloadLocation: value.resolved
      });
      visit(value.dependencies, `${prefix}${name}/`);
    }
  }
  visit(lock.dependencies);
}

function collectDeclared(manifest, packages, seen) {
  const groups = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const group of groups) {
    for (const [name, version] of Object.entries(manifest[group] || {})) {
      addPackage(packages, seen, { name, version: String(version), relationship: "DECLARED_DEPENDENCY" });
    }
  }
}

function makeDocument(manifest, packagePath, packages, lockPath, repositoryRoot = process.cwd()) {
  const rootVersion = String(manifest.version || "0.0.0");
  const rootName = String(manifest.name || path.basename(path.dirname(packagePath)));
  const rootID = packageRef(rootName, rootVersion);
  const rootPackage = {
    SPDXID: rootID,
    name: rootName,
    versionInfo: rootVersion,
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: manifest.license || "NOASSERTION",
    licenseDeclared: manifest.license || "NOASSERTION",
    supplier: "NOASSERTION"
  };
  const created = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  const namespaceHash = sha256(JSON.stringify({
    manifest,
    packagePath: path.relative(repositoryRoot, packagePath).replaceAll(path.sep, "/"),
    lockPath: lockPath ? path.relative(repositoryRoot, lockPath).replaceAll(path.sep, "/") : null,
    packages: packages.map(({ entry }) => entry)
  }));
  const relationships = [{ spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: rootID }];
  for (const item of packages) relationships.push({ spdxElementId: rootID, relationshipType: item.relationship, relatedSpdxElement: item.entry.SPDXID });
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${rootName}-${rootVersion}-sbom`,
    documentNamespace: `https://ontology3.example/sbom/${namespaceHash}`,
    creationInfo: {
      created,
      creators: ["Tool: ontology3-implementation-quality-gate"]
    },
    documentDescribes: [rootID],
    packages: [rootPackage, ...packages.map(({ entry }) => entry)],
    relationships,
    annotations: [{ annotationDate: created, annotator: "Tool: ontology3-implementation-quality-gate", annotationType: "OTHER", comment: "Generated for the implementation PR quality gate; unresolved ranges remain NOASSERTION." }]
  };
}

let options;
try {
  options = parse(process.argv.slice(2));
  const root = path.resolve(options.root);
  const packagePath = path.resolve(root, options.package || "package.json");
  const manifest = readJsonIf(packagePath);
  if (!manifest) {
    if (!options.allowMissing) throw new Error(`package.json not found: ${packagePath}`);
    const empty = makeDocument({ name: path.basename(root), version: "0.0.0" }, packagePath, [], null, root);
    writeJson(path.resolve(root, options.output), empty);
    console.log(`SBOM written (empty root): ${path.resolve(root, options.output)}`);
    process.exit(0);
  }
  const lockCandidates = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"];
  const lockPath = lockCandidates.map((candidate) => path.resolve(root, candidate)).find((candidate) => fs.existsSync(candidate));
  const packages = [];
  const seen = new Map();
  if (lockPath && lockPath.endsWith(".json")) collectFromLock(readJsonIf(lockPath), packages, seen);
  collectDeclared(manifest, packages, seen);
  const document = makeDocument(manifest, packagePath, packages, lockPath, root);
  const output = path.resolve(root, options.output);
  writeJson(output, document);
  console.log(`SBOM written: ${output} (${document.packages.length} packages)`);
} catch (error) {
  console.error(`SBOM generation FAILED: ${error.message}`);
  usage();
  process.exit(1);
}
