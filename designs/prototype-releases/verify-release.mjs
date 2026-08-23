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
const failures = [];

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

function walkFiles(root, options = {}) {
  const { excludeRelative = new Set() } = options;
  const files = [];

  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = toPosix(path.relative(root, absolute));
      const stat = fs.lstatSync(absolute);

      if (stat.isSymbolicLink()) {
        failures.push(`禁止符号链接：${toPosix(path.relative(releaseRoot, absolute))}`);
        continue;
      }
      if (stat.isDirectory()) {
        walk(absolute);
      } else if (stat.isFile() && !excludeRelative.has(relative)) {
        files.push(absolute);
      } else if (!stat.isFile()) {
        failures.push(`不支持的文件类型：${toPosix(path.relative(releaseRoot, absolute))}`);
      }
    }
  }

  walk(root);
  return files;
}

function treeDigest(root, options = {}) {
  const hash = crypto.createHash("sha256");
  const files = walkFiles(root, options);
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

function compareDigest(label, actual, expected) {
  if (!expected || typeof expected !== "object") {
    failures.push(`${label}: 缺少摘要`);
    return;
  }
  for (const key of ["files", "bytes", "treeSha256"]) {
    if (actual[key] !== expected[key]) failures.push(`${label}.${key}: ${actual[key]} != ${expected[key]}`);
  }
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`${label} 无法读取：${error.message}`);
    process.exit(1);
  }
}

if (!fs.existsSync(releaseRoot) || !fs.lstatSync(releaseRoot).isDirectory()) {
  console.error(`发布目录不存在：${releaseRoot}`);
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error(`发布清单不存在：${manifestPath}`);
  process.exit(1);
}
if (fs.lstatSync(manifestPath).isSymbolicLink()) {
  console.error(`v${version} 完整性校验失败：\n- 禁止符号链接：manifest.json`);
  process.exit(1);
}

const manifest = readJson(manifestPath, "manifest.json");

function verifyComponentsAndEntries() {
  if (!manifest.components || typeof manifest.components !== "object" || Array.isArray(manifest.components)) {
    failures.push("components: 缺少组件摘要");
  } else {
    for (const [component, expected] of Object.entries(manifest.components)) {
      if (!isSafeRelativePath(component)) {
        failures.push(`components: 非法路径 ${component}`);
        continue;
      }
      const componentRoot = path.join(releaseRoot, component);
      if (!fs.existsSync(componentRoot) || !fs.lstatSync(componentRoot).isDirectory()) {
        failures.push(`components: 目录不存在 ${component}`);
        continue;
      }
      compareDigest(component, treeDigest(componentRoot), expected);
    }
  }

  if (!manifest.entries || typeof manifest.entries !== "object" || Array.isArray(manifest.entries)) {
    failures.push("entries: 缺少入口摘要");
    return;
  }
  for (const [entry, expected] of Object.entries(manifest.entries)) {
    if (!isSafeRelativePath(entry)) {
      failures.push(`entries: 非法路径 ${entry}`);
      continue;
    }
    const entryPath = path.join(releaseRoot, entry);
    if (!fs.existsSync(entryPath) || !fs.lstatSync(entryPath).isFile()) {
      failures.push(`entries: 文件不存在 ${entry}`);
      continue;
    }
    const actual = sha256(fs.readFileSync(entryPath));
    if (actual !== expected) failures.push(`${entry}: ${actual} != ${expected}`);
  }
}

function verifyV2() {
  if (manifest.prototypeVersion !== version) {
    failures.push(`prototypeVersion: ${manifest.prototypeVersion} != ${version}`);
  }

  const versionPath = path.join(releaseRoot, "VERSION.json");
  if (!fs.existsSync(versionPath) || !fs.lstatSync(versionPath).isFile()) {
    failures.push("VERSION.json: 文件不存在");
  } else {
    const releaseVersion = readJson(versionPath, "VERSION.json");
    const requiredVersionFields = {
      version,
      status: "frozen-implementation-baseline",
      immutable: true,
      acceptanceReady: false,
    };
    for (const [field, expected] of Object.entries(requiredVersionFields)) {
      if (releaseVersion[field] !== expected) {
        failures.push(`VERSION.json.${field}: ${JSON.stringify(releaseVersion[field])} != ${JSON.stringify(expected)}`);
      }
    }
    if (manifest.uniqueEntry !== releaseVersion.entry) {
      failures.push(`uniqueEntry: ${JSON.stringify(manifest.uniqueEntry)} != VERSION.json.entry ${JSON.stringify(releaseVersion.entry)}`);
    }
  }

  if (!isSafeRelativePath(manifest.uniqueEntry)) {
    failures.push(`uniqueEntry: 非法路径 ${JSON.stringify(manifest.uniqueEntry)}`);
  } else if (!Object.hasOwn(manifest.entries ?? {}, manifest.uniqueEntry)) {
    failures.push(`uniqueEntry: 未登记到 entries (${manifest.uniqueEntry})`);
  }

  const actualTopLevel = fs.readdirSync(releaseRoot).sort().filter((name) => name !== "manifest.json");
  if (!Array.isArray(manifest.allowedTopLevel)) {
    failures.push("allowedTopLevel: 必须为数组");
  } else {
    const allowed = [...manifest.allowedTopLevel].sort();
    if (new Set(allowed).size !== allowed.length || allowed.some((name) => !isSafeRelativePath(name) || name.includes("/"))) {
      failures.push("allowedTopLevel: 包含重复项或非法顶层名称");
    }
    if (JSON.stringify(actualTopLevel) !== JSON.stringify(allowed)) {
      failures.push(`allowedTopLevel: 实际 ${JSON.stringify(actualTopLevel)} != 清单 ${JSON.stringify(allowed)}`);
    }
  }

  const actualComponentNames = fs.readdirSync(releaseRoot).sort().filter((name) => {
    const item = path.join(releaseRoot, name);
    return name !== "manifest.json" && fs.lstatSync(item).isDirectory();
  });
  const manifestComponentNames = Object.keys(manifest.components ?? {}).sort();
  if (JSON.stringify(actualComponentNames) !== JSON.stringify(manifestComponentNames)) {
    failures.push(`components: 实际顶层目录 ${JSON.stringify(actualComponentNames)} != 清单 ${JSON.stringify(manifestComponentNames)}`);
  }

  const releaseFiles = walkFiles(releaseRoot, { excludeRelative: new Set(["manifest.json"]) });
  const actualInventory = {};
  for (const file of releaseFiles) {
    const relative = toPosix(path.relative(releaseRoot, file));
    const content = fs.readFileSync(file);
    actualInventory[relative] = { bytes: content.length, sha256: sha256(content) };
  }

  if (!manifest.fileInventory || typeof manifest.fileInventory !== "object" || Array.isArray(manifest.fileInventory)) {
    failures.push("fileInventory: 必须为对象");
  } else {
    const actualPaths = Object.keys(actualInventory).sort();
    const expectedPaths = Object.keys(manifest.fileInventory).sort();
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      const missing = actualPaths.filter((item) => !expectedPaths.includes(item));
      const extra = expectedPaths.filter((item) => !actualPaths.includes(item));
      if (missing.length) failures.push(`fileInventory: 清单缺少 ${missing.join(", ")}`);
      if (extra.length) failures.push(`fileInventory: 清单多出 ${extra.join(", ")}`);
    }
    for (const relative of actualPaths) {
      const expected = manifest.fileInventory[relative];
      if (!expected) continue;
      for (const key of ["bytes", "sha256"]) {
        if (actualInventory[relative][key] !== expected[key]) {
          failures.push(`fileInventory.${relative}.${key}: ${actualInventory[relative][key]} != ${expected[key]}`);
        }
      }
    }
  }

  compareDigest(
    "releaseTree",
    treeDigest(releaseRoot, { excludeRelative: new Set(["manifest.json"]) }),
    manifest.releaseTree,
  );

  for (const entry of Object.keys(manifest.entries ?? {})) {
    if (!Object.hasOwn(actualInventory, entry)) failures.push(`entries: ${entry} 不在 fileInventory 中`);
  }
}

// Scan the complete tree even for v1 manifests so a release can never conceal a symlink.
walkFiles(releaseRoot);

if (manifest.manifestVersion === 1) {
  verifyComponentsAndEntries();
} else if (manifest.manifestVersion === 2) {
  verifyComponentsAndEntries();
  verifyV2();
} else {
  failures.push(`manifestVersion: 不支持 ${JSON.stringify(manifest.manifestVersion)}`);
}

if (failures.length) {
  console.error(`v${version} 完整性校验失败：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`v${version} 完整性校验通过：manifest v${manifest.manifestVersion}，${Object.keys(manifest.components).length} 个组件，${Object.keys(manifest.entries).length} 个入口。`);
