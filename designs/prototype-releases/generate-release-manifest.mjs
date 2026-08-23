import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const releasesRoot = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("用法：node designs/prototype-releases/generate-release-manifest.mjs <版本号>");
  process.exit(2);
}

const releaseRoot = path.join(releasesRoot, `v${version}`);
const versionPath = path.join(releaseRoot, "VERSION.json");
const manifestPath = path.join(releaseRoot, "manifest.json");

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isSafeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) return false;
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  return normalized === relativePath && normalized !== ".." && !normalized.startsWith("../");
}

function listFiles(root, options = {}) {
  const { excludeRelative = new Set() } = options;
  const files = [];

  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = toPosix(path.relative(root, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`禁止符号链接：${toPosix(path.relative(releaseRoot, absolute))}`);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile() && !excludeRelative.has(relative)) files.push(absolute);
      else if (!stat.isFile()) throw new Error(`不支持的文件类型：${toPosix(path.relative(releaseRoot, absolute))}`);
    }
  }

  walk(root);
  return files;
}

function treeDigest(root, options = {}) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(root, options);
  let bytes = 0;
  for (const file of files) {
    const relative = toPosix(path.relative(root, file));
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

function collectEntryPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectEntryPaths);
  if (!value || typeof value !== "object") return [];
  if (typeof value.path === "string") return [value.path];
  if (typeof value.entry === "string") return [value.entry];
  return Object.values(value).flatMap(collectEntryPaths);
}

if (!fs.existsSync(releaseRoot) || !fs.lstatSync(releaseRoot).isDirectory()) {
  console.error(`发布目录不存在：${releaseRoot}`);
  process.exit(1);
}
if (!fs.existsSync(versionPath) || !fs.lstatSync(versionPath).isFile()) {
  console.error(`VERSION.json 不存在：${versionPath}`);
  process.exit(1);
}

try {
  // Scan first, including a pre-existing manifest, so no symlink can be hidden by exclusion.
  listFiles(releaseRoot);

  const releaseVersion = JSON.parse(fs.readFileSync(versionPath, "utf8"));
  const requiredVersionFields = {
    version,
    status: "frozen-implementation-baseline",
    immutable: true,
    acceptanceReady: false,
  };
  for (const [field, expected] of Object.entries(requiredVersionFields)) {
    if (releaseVersion[field] !== expected) {
      throw new Error(`VERSION.json.${field}: ${JSON.stringify(releaseVersion[field])} != ${JSON.stringify(expected)}`);
    }
  }
  if (!isSafeRelativePath(releaseVersion.entry)) throw new Error(`VERSION.json.entry 非法：${JSON.stringify(releaseVersion.entry)}`);

  const entryPaths = [...new Set([
    ...collectEntryPaths(releaseVersion.entry),
    ...collectEntryPaths(releaseVersion.moduleEntries),
    ...collectEntryPaths(releaseVersion.additionalEntries),
  ])].sort();
  if (entryPaths.length === 0) throw new Error("VERSION.json 未声明入口");

  const entries = {};
  for (const entry of entryPaths) {
    if (!isSafeRelativePath(entry)) throw new Error(`入口路径非法：${JSON.stringify(entry)}`);
    const entryPath = path.join(releaseRoot, entry);
    if (!fs.existsSync(entryPath) || !fs.lstatSync(entryPath).isFile()) throw new Error(`入口文件不存在：${entry}`);
    entries[entry] = sha256(fs.readFileSync(entryPath));
  }

  const allowedTopLevel = fs.readdirSync(releaseRoot).sort().filter((name) => name !== "manifest.json");
  const components = {};
  for (const name of allowedTopLevel) {
    const absolute = path.join(releaseRoot, name);
    if (fs.lstatSync(absolute).isDirectory()) components[name] = treeDigest(absolute);
  }

  const releaseFiles = listFiles(releaseRoot, { excludeRelative: new Set(["manifest.json"]) });
  const fileInventory = {};
  for (const file of releaseFiles) {
    const relative = toPosix(path.relative(releaseRoot, file));
    const content = fs.readFileSync(file);
    fileInventory[relative] = { bytes: content.length, sha256: sha256(content) };
  }

  const manifest = {
    manifestVersion: 2,
    prototypeVersion: version,
    algorithm: "sha256(relativePath\\0fileBytes\\0, sorted recursively)",
    inventoryExcludes: ["manifest.json"],
    uniqueEntry: releaseVersion.entry,
    allowedTopLevel,
    releaseTree: treeDigest(releaseRoot, { excludeRelative: new Set(["manifest.json"]) }),
    components,
    entries,
    fileInventory,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`v${version} manifest v2 已生成：${Object.keys(components).length} 个组件，${entryPaths.length} 个入口，${Object.keys(fileInventory).length} 个文件。`);
} catch (error) {
  console.error(`v${version} manifest v2 生成失败：${error.message}`);
  process.exit(1);
}
