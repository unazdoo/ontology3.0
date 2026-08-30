#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const repo = path.resolve(new URL("..", import.meta.url).pathname);
const root = path.join(repo, "prototype", "full-chain");
const required = [
  "index.html", "app.js", "s005-baseline.css",
  "s005-config.js", "s005-data.js", "s005-boot.js", "s005-baseline-adapter.js", "s005-baseline-view.js",
  "s005-module-loader.html", "s005-module-loader.js", "s005-real-module-bridge.js",
  "README.md"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`missing S005 full-chain source assets: ${missing.join(", ")}`);

const sandbox = { window: {}, globalThis: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "s005-data.js"), "utf8"), sandbox, { filename: "s005-data.js" });
vm.runInNewContext(fs.readFileSync(path.join(root, "s005-config.js"), "utf8"), sandbox, { filename: "s005-config.js" });
const data = sandbox.window.S005_FULL_CHAIN_DATA;
const config = sandbox.window.S005_SCENARIO_CONFIG;
if (!data || data.sourceBatch.count !== 79) throw new Error("S005 source batch count must be 79");
if (!config || config.scenarioId !== "S005" || config.scenarioVersion !== "S005-v1") throw new Error("S005 scenario config mismatch");
if (config.baselineVersion !== "v1.1.0" || config.baselineSnapshotId !== "BSL-OFW-V110-94ABD0E991B7") throw new Error("S005 config baseline mismatch");
if (config.governanceBaselineVersion !== "v1.0.3") throw new Error("S005 config governance parent mismatch");
if (!Object.values(config.baselineModuleSources || {}).every((source) => source.startsWith("./baseline-v110/"))) throw new Error("S005 module sources are not v1.1.0 baseline entries");
if (config.workflow.length !== 7) throw new Error("S005 workflow must have 7 research stages");
if (!config.workflow.every((step) => step.moduleId && step.id && step.title)) throw new Error("S005 workflow contract incomplete");
if (!data.market.series.some((item) => item.key === "topThird")) throw new Error("top-third benchmark missing");
if (!data.trading.metrics.some((item) => item.key === "sharpe")) throw new Error("Sharpe metric missing");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const boot = fs.readFileSync(path.join(root, "s005-boot.js"), "utf8");
const adapter = fs.readFileSync(path.join(root, "s005-baseline-adapter.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "s005-module-loader.js"), "utf8");
for (const token of ["platform-shell", "renderShell", "module-frame", "sourceWithScenarioContext"]) {
  if (!app.includes(token)) throw new Error(`baseline injection token missing: ${token}`);
}
if (!boot.includes("OFW_S005_RUNNER") || !boot.includes("directionalReset")) throw new Error("S005 runner/reset contract missing");
for (const token of ["createAdapter", "createNamespacedStorage", "directionalReset", "setStep", "setResearchState"]) {
  if (!adapter.includes(token)) throw new Error(`adapter contract missing: ${token}`);
}
if (!loader.includes("document.open") || !loader.includes("baseline-v110") || !loader.includes("scenarioId")) throw new Error("module loader is not a v1.1.0 document-replacement loader");
if (!fs.readFileSync(path.join(root, "s005-real-module-bridge.js"), "utf8").includes("v1.1.0 基线模块")) throw new Error("S005 real module bridge missing");

for (const file of ["app.js", "s005-baseline-adapter.js", "s005-boot.js", "s005-baseline-view.js", "s005-module-loader.js", "s005-real-module-bridge.js", "s005-config.js", "s005-data.js"]) {
  execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "ignore" });
}

console.log(JSON.stringify({
  status: "ok",
  sourceEntry: "prototype/full-chain/index.html",
  implementationBaseline: {
    version: config.baselineVersion,
    snapshotId: config.baselineSnapshotId
  },
  governanceParent: {
    version: config.governanceBaselineVersion,
    snapshotId: config.governanceBaselineSnapshotId
  },
  sourceSnapshots: data.sourceBatch.count,
  workflowStages: config.workflow.length,
  modules: Object.keys(config.moduleSources).length,
  archiveScope: "S005-specific overlay sources only",
  loader: "context-validated-document-replacement",
  moduleEntries: "bound at materialization time to frozen v1.1.0 sources",
  nestedShell: false,
  storage: "Foundation namespaced + directionalReset"
}, null, 2));
