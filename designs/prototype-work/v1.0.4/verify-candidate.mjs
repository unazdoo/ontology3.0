import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

function listFiles(directory) {
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) files.push(...listFiles(absolute));
    else if (stat.isFile()) files.push(absolute);
  }
  return files;
}

function treeDigest(directory) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(directory);
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(directory, file).split(path.sep).join("/");
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
  const actual = treeDigest(path.join(root, component));
  for (const key of ["files", "bytes", "treeSha256"]) {
    if (actual[key] !== expected[key]) failures.push(`${component}.${key}: ${actual[key]} != ${expected[key]}`);
  }
}

for (const [entry, expected] of Object.entries(manifest.entries)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, entry))).digest("hex");
  if (actual !== expected) failures.push(`${entry}: ${actual} != ${expected}`);
}

if (manifest.prototypeVersion !== "1.0.4") failures.push(`prototypeVersion: ${manifest.prototypeVersion}`);
if (manifest.scenarioRunId !== "S001-RUN-20260815205357297-5625500f9a07") failures.push(`scenarioRunId: ${manifest.scenarioRunId}`);
if (manifest.acceptanceReady !== false) failures.push("acceptanceReady 必须为 false");

if (failures.length) {
  console.error("v1.0.4 候选完整性校验失败：");
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`v1.0.4 候选完整性校验通过：${Object.keys(manifest.components).length} 个组件，${Object.keys(manifest.entries).length} 个入口。`);
