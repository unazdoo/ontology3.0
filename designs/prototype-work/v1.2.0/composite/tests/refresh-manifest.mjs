import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WORK_ROOT = resolve(TEST_DIR, "../..");
const COMPOSITE_ROOT = join(WORK_ROOT, "composite");
const MANIFEST_PATH = join(WORK_ROOT, "COMPOSITE-MANIFEST.json");

function posixPath(value) {
  return value.split(sep).join("/");
}

function regularFiles(root) {
  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Artifact inventory does not allow symlinks: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) output.push(path);
    }
  };
  visit(root);
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

export function buildInventory() {
  const files = regularFiles(COMPOSITE_ROOT).map((path) => {
    const buffer = readFileSync(path);
    return {
      path: posixPath(relative(WORK_ROOT, path)),
      bytes: statSync(path).size,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  });
  return {
    root: "composite",
    algorithm: "sha256",
    generatedBy: "composite/tests/refresh-manifest.mjs",
    generatedAt: new Date().toISOString(),
    status: "complete",
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files
  };
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  manifest.artifactInventory = buildInventory();
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`refreshed ${manifest.artifactInventory.fileCount} files / ${manifest.artifactInventory.totalBytes} bytes`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
