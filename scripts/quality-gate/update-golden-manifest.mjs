#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, writeJson } from "./lib/quality-gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = path.join(root, "quality-gates/golden/s001/data.json");
const manifestPath = path.join(root, "quality-gates/golden/s001/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.sha256 = sha256(fs.readFileSync(dataPath));
writeJson(manifestPath, manifest);
console.log(`${manifest.path}: ${manifest.sha256}`);
