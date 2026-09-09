import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const workRoot = resolve(testDir, "../..");
const compositeRoot = join(workRoot, "composite");
const manifestPath = join(workRoot, "COMPOSITE-MANIFEST.json");
const browserEvidencePath = join(compositeRoot, "evidence", "browser-regression.json");

function posix(value) {
  return value.split(sep).join("/");
}

function files(root) {
  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Artifact inventory does not allow symlinks: ${target}`);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) output.push(target);
    }
  };
  visit(root);
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

export function buildInventory() {
  const entries = files(compositeRoot).map((target) => {
    const buffer = readFileSync(target);
    return {
      path: posix(relative(workRoot, target)),
      bytes: statSync(target).size,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  });
  return {
    root: "composite",
    algorithm: "sha256",
    generatedBy: "composite/tests/refresh-manifest.mjs",
    generatedAt: JSON.parse(readFileSync(browserEvidencePath, "utf8")).observedAt,
    status: "complete",
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    files: entries
  };
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.artifactInventory = buildInventory();
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`refreshed ${manifest.artifactInventory.fileCount} files / ${manifest.artifactInventory.totalBytes} bytes`);
