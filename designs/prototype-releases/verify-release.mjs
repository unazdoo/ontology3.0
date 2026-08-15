import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const releasesRoot = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("用法：node designs/prototype-releases/verify-release.mjs <版本号>");
  process.exit(2);
}

const releaseRoot = path.join(releasesRoot, `v${version}`);
const manifestPath = path.join(releaseRoot, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function listFiles(root) {
  const files = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) files.push(absolute);
    }
  }
  walk(root);
  return files;
}

function treeDigest(root) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(root);
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

const failures = [];
for (const [component, expected] of Object.entries(manifest.components)) {
  const actual = treeDigest(path.join(releaseRoot, component));
  for (const key of ["files", "bytes", "treeSha256"]) {
    if (actual[key] !== expected[key]) failures.push(`${component}.${key}: ${actual[key]} != ${expected[key]}`);
  }
}

for (const [entry, expected] of Object.entries(manifest.entries)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(releaseRoot, entry))).digest("hex");
  if (actual !== expected) failures.push(`${entry}: ${actual} != ${expected}`);
}

if (failures.length) {
  console.error(`v${version} 完整性校验失败：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`v${version} 完整性校验通过：${Object.keys(manifest.components).length} 个组件，${Object.keys(manifest.entries).length} 个入口。`);

