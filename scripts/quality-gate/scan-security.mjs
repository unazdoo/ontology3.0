#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { writeJson } from "./lib/quality-gate.mjs";

const DEFAULT_IGNORED = [
  /(^|\/)(\.git|node_modules|dist|build|coverage|outputs)(\/|$)/,
  /\.(png|jpe?g|gif|webp|pdf|xlsx?|zip|woff2?|ttf|eot|mp4|mp3)$/i,
  /(^|\/)(vendor|third_party)(\/|$)/i
];

const PATTERNS = [
  { id: "private-key", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: "aws-access-key", severity: "high", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github-token", severity: "high", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: "slack-token", severity: "high", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { id: "jwt-like-token", severity: "medium", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: "hard-coded-secret-assignment", severity: "high", pattern: /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"'${]{16,}["']/i }
];

function usage() {
  console.error(`Usage: node scripts/quality-gate/scan-security.mjs [options]

Options:
  --root <path>       Repository root (default: current directory)
  --output <path>     JSON report (default: artifacts/security-scan.json)
  --all-files         Scan untracked files too (default: tracked files when git is available)`);
}

function parse(argv) {
  const result = { root: process.cwd(), output: "artifacts/security-scan.json", allFiles: false };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--root") result.root = argv[++i];
    else if (option === "--output") result.output = argv[++i];
    else if (option === "--all-files") result.allFiles = true;
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  return result;
}

function trackedFiles(root) {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.error?.message || String(result.stderr || "unknown error").trim()}`);
  }
  return String(result.stdout || "", "utf8").split("\0").filter(Boolean);
}

function walk(root, relative = "") {
  const current = path.join(root, relative);
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!DEFAULT_IGNORED.some((pattern) => pattern.test(child + "/"))) files.push(...walk(root, child));
    } else files.push(child);
  }
  return files;
}

function ignored(relative) {
  return DEFAULT_IGNORED.some((pattern) => pattern.test(relative));
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

let options;
try {
  options = parse(process.argv.slice(2));
  const root = path.resolve(options.root);
  const candidates = options.allFiles ? walk(root) : trackedFiles(root);
  if (candidates.length === 0) throw new Error("no files were discovered; pass --all-files only for an intentionally non-git root");
  const findings = [];
  let scanned = 0;
  for (const relative of candidates) {
    if (ignored(relative)) continue;
    const filePath = path.join(root, relative);
    let text;
    try { text = fs.readFileSync(filePath, "utf8"); } catch { continue; }
    if (text.includes("\u0000")) continue;
    scanned += 1;
    for (const detector of PATTERNS) {
      detector.pattern.lastIndex = 0;
      const match = detector.pattern.exec(text);
      if (!match) continue;
      findings.push({ id: detector.id, severity: detector.severity, file: relative, line: lineNumber(text, match.index), preview: match[0].slice(0, 80).replace(/[A-Za-z0-9]/g, "*") });
    }
  }
  const report = {
    schemaVersion: "implementation-security-scan.v1",
    status: findings.length === 0 ? "passed" : "failed",
    scannedFiles: scanned,
    findings,
    evidence: "artifact://security-scan.json",
    secretValuesIncluded: false
  };
  writeJson(path.resolve(root, options.output), report);
  if (findings.length) {
    console.error(`Security scan FAILED: ${findings.length} potential secret(s).`);
    for (const finding of findings) console.error(`- ${finding.file}:${finding.line} ${finding.id} (${finding.severity})`);
    process.exit(1);
  }
  console.log(`Security scan passed: ${scanned} files scanned.`);
} catch (error) {
  console.error(`Security scan FAILED: ${error.message}`);
  usage();
  process.exit(1);
}
