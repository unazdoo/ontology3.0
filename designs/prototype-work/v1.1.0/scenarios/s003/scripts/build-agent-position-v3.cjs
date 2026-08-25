#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const OUTPUT = "resources/m05/agent-position.v3.json";

function read(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function sha(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function build() {
  // v3 is checked in as the immutable profile source. Keeping the builder
  // read-only prevents a stale v2-to-v3 transformation from recreating the
  // forbidden profile-generated Evidence/Run/Session/Result records.
  return read(OUTPUT);
}

function main() {
  const check = process.argv.includes("--check");
  const target = path.join(root, OUTPUT);
  if (!check) throw new Error("agent-position.v3.json 是已签入的不可变 C024-only 配置；请使用 apply_patch 更新后执行 --check");
  const current = fs.readFileSync(target);
  const digest = crypto.createHash("sha256").update(current).digest("hex");
  const sidecar = `${digest}  ${path.basename(OUTPUT)}\n`;
  if (fs.readFileSync(`${target}.sha256`, "utf8") !== sidecar) throw new Error("agent-position.v3.json.sha256 不一致");
  build();
  process.stdout.write(`verified ${OUTPUT} ${digest}\n`);
}

if (require.main === module) main();

module.exports = Object.freeze({ build });
