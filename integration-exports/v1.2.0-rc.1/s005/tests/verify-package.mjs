#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "INTEGRATION-MANIFEST.json"), "utf8"));
const checksumPath = path.join(root, "SHA256SUMS");

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link is not allowed: ${path.relative(root, absolute)}`);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

assert.equal(manifest.sourceTag, "prototype-v1.1.0-frozen");
assert.equal(manifest.parentVersion, "v1.1.0");
assert.equal(manifest.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
assert.equal(manifest.targetPrototypeVersion, "v1.2.0-rc.1");
assert.equal(manifest.acceptanceReady, false);
assert.equal(manifest.registration.scenarioId, "S005");
assert.equal(manifest.registration.scenarioVersion, "S005-v1");
assert.equal(manifest.shellContract.includesShell, false);
assert.deepEqual(manifest.resetBoundary.preservesModules, ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"]);

const files = filesUnder(root);
const relative = files.map((file) => path.relative(root, file).split(path.sep).join("/")).sort();
const forbiddenNames = [/\.DS_Store$/i, /(^|\/)archive(\/|$)/i, /screenshot/i, /(^|\/)BASELINE-[^/]+$/i];
relative.forEach((file) => forbiddenNames.forEach((pattern) => assert.equal(pattern.test(file), false, `Forbidden package path: ${file}`)));

const textExtensions = new Set([".html", ".css", ".js", ".json", ".md", ".mjs"]);
const absoluteUserPrefix = ["/", "Users", "/"].join("");
const fileUriPrefix = ["file", "://"].join("");
files.filter((file) => textExtensions.has(path.extname(file))).forEach((file) => {
  const text = fs.readFileSync(file, "utf8");
  assert.equal(text.includes(absoluteUserPrefix), false, `Absolute user path found in ${path.relative(root, file)}`);
  assert.equal(text.includes(fileUriPrefix), false, `File URI found in ${path.relative(root, file)}`);
});

assert.ok(fs.existsSync(checksumPath), "SHA256SUMS is required");
const expected = fs.readFileSync(checksumPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => {
  const match = line.match(/^([a-f0-9]{64})  (.+)$/);
  assert.ok(match, `Invalid checksum line: ${line}`);
  return { digest: match[1], file: match[2] };
});
const checksumFiles = expected.map((entry) => entry.file).sort();
const actualScope = relative.filter((file) => file !== "SHA256SUMS");
assert.deepEqual(checksumFiles, actualScope, "SHA256SUMS scope must cover every regular package file except itself");
expected.forEach((entry) => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, entry.file))).digest("hex");
  assert.equal(digest, entry.digest, `Checksum mismatch: ${entry.file}`);
});

const contentHtml = fs.readFileSync(path.join(root, "content.html"), "utf8");
assert.equal(contentHtml.includes("platform-shell"), false, "content page must not include a product Shell");
assert.ok(contentHtml.includes("scenario-config.js") && contentHtml.includes("scenario-adapter.js") && contentHtml.includes("content.js"));

console.log(JSON.stringify({ status: "ok", check: "package-integrity", files: relative.length, checksumEntries: expected.length }));
