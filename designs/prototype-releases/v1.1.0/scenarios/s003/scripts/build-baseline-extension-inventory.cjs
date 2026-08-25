#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const prototypeRoot = path.resolve(scenarioRoot, "../..");
const SUPPORTED_VARIANTS = Object.freeze(Array.from({length: 19}, (_, index) => `v${19 - index}`));
const variant = SUPPORTED_VARIANTS.find((candidate) => process.argv.includes(`--${candidate}`)) || "v1";
const variantNumber = Number(variant.slice(1));
const atLeast = (minimum) => variantNumber >= minimum;
const CURRENT_FORMAL_RESOURCE_REFS = Object.freeze({
  M01: Object.freeze([
    "scenarios/s003/resources/m01/model-package.v2.json",
    "scenarios/s003/resources/m01/model-configuration.v3.json",
    "scenarios/s003/resources/m01/published-pointer.v2.json",
    "scenarios/s003/resources/m01/action-type-catalog.v2.json",
    "scenarios/s003/resources/m01/evaluation-run.v2.json",
    "scenarios/s003/resources/m01/c035-risk-results.v2.json",
    "scenarios/s003/resources/m01/published-risk-facts.v2.json",
    "scenarios/s003/resources/m01/runtime-export.v2.json"
  ]),
  M02: Object.freeze([
    "scenarios/s003/resources/m02/source-registry.v4.json",
    "scenarios/s003/resources/m02/pipeline-current-projection.v4.json",
    "scenarios/s003/resources/m02/c017-decision-projection.v2.json"
  ]),
  M03: Object.freeze([
    "scenarios/s003/resources/m03/query-catalog.v3.json",
    "scenarios/s003/resources/m03/query-runtime.v2.json",
    "scenarios/s003/resources/m03/query-results.v2.json"
  ]),
  M04: Object.freeze([
    "scenarios/s003/resources/m04/decision-binding.v2.json",
    "scenarios/s003/resources/m04/decision-runtime.v2.json",
    "scenarios/s003/resources/m04/decision-inbox.v3.json",
    "scenarios/s003/resources/m04/decision-results.v3.json",
    "scenarios/s003/resources/m04/enterprise-contact-routing.v1.json"
  ]),
  M05: Object.freeze(["scenarios/s003/resources/m05/agent-position.v6.json"]),
  M06: Object.freeze([
    "scenarios/s003/resources/m06/report-manifest.v8.json",
    "scenarios/s003/resources/m06/report-contents.v8.json",
    "scenarios/s003/resources/m06/report-artifacts.v8.json",
    "scenarios/s003/resources/m06/report-history-index.v3.json"
  ])
});
const CURRENT_FORMAL_RESOURCE_REFS_V14 = Object.freeze({
  ...CURRENT_FORMAL_RESOURCE_REFS,
  M05: Object.freeze(["scenarios/s003/resources/m05/agent-position.v7.json"]),
  M06: Object.freeze([
    "scenarios/s003/resources/m06/report-manifest.v9.json",
    "scenarios/s003/resources/m06/report-contents.v9.json",
    "scenarios/s003/resources/m06/report-artifacts.v9.json",
    "scenarios/s003/resources/m06/report-history-index.v4.json"
  ])
});
const CURRENT_FORMAL_RESOURCE_REFS_V15 = CURRENT_FORMAL_RESOURCE_REFS_V14;
const CURRENT_FORMAL_RESOURCE_REFS_V16 = CURRENT_FORMAL_RESOURCE_REFS_V15;
const CURRENT_FORMAL_RESOURCE_REFS_V17 = CURRENT_FORMAL_RESOURCE_REFS_V16;
const CURRENT_FORMAL_RESOURCE_REFS_V18 = CURRENT_FORMAL_RESOURCE_REFS_V17;
const CURRENT_FORMAL_RESOURCE_REFS_V19 = CURRENT_FORMAL_RESOURCE_REFS_V18;
const outputRef = `resources/integration/v103-baseline-extension-inventory.${variant}.json`;
const outputPath = path.join(scenarioRoot, outputRef);

const FILES = Object.freeze([
  ["PLATFORM", "平台公共层", "VERSION.json"],
  ["PLATFORM", "平台公共层", "WORKSPACE.md"],
  ["PLATFORM", "平台公共层", "foundation/ofw-scenario-foundation.js"],
  ["PLATFORM", "平台公共层", "foundation/ofw-scenario-foundation.test.cjs"],
  ["PLATFORM", "平台公共壳", "s001-e2e-integration/index.html"],
  ["PLATFORM", "平台公共壳", "s001-e2e-integration/app.js"],
  ["PLATFORM", "平台公共壳", "s001-e2e-integration/data.js"],
  ["PLATFORM", "平台公共壳", "s001-e2e-integration/state.js"],
  ["PLATFORM", "平台公共壳", "s001-e2e-integration/styles.css"],
  ["M01", "本体管理", "ontology-management-review/canvas-first/index.html"],
  ["M01", "本体管理", "ontology-management-review/canvas-first/app.js"],
  ["M01", "本体管理", "ontology-management-review/canvas-first/s003-scenario-adapter.js"],
  ["M01", "本体管理", "ontology-management-review/canvas-first/s003-scenario-adapter.css"],
  ["M02", "数据工程", "data-engineering-prototype-review/review-v3/方案B2.html"],
  ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/shell.html"],
  ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/app.js"],
  ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/s003-scenario-adapter.js"],
  ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/s003-scenario-adapter.css"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/index.html"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/app.jsx"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/styles.css"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/s003-adapter.jsx"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.js"],
  ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.test.cjs"],
  ["M04", "决策中心", "decision-center-prototype/review-v2/action-portfolio.html"],
  ["M04", "决策中心", "decision-center-prototype/review-v2/shared/app.jsx"],
  ["M04", "决策中心", "decision-center-prototype/review-v2/shared/data.jsx"],
  ["M04", "决策中心", "decision-center-prototype/review-v2/shared/s003-adapter.jsx"],
  ["M04", "决策中心", "decision-center-prototype/review-v2/shared/s003-adapter.test.cjs"],
  ["M05", "Agent 应用", "agent-application/Agent应用.html"],
  ["M05", "Agent 应用", "agent-application/app.jsx"],
  ["M05", "Agent 应用", "agent-application/app.css"],
  ["M05", "Agent 应用", "agent-application/s003-adapter.jsx"],
  ["M06", "报告中心", "report-center/review-lifecycle/index.html"],
  ["M06", "报告中心", "report-center/review-lifecycle/app.js"],
  ["M06", "报告中心", "report-center/review-lifecycle/lifecycle.css"],
  ...(atLeast(4)
    ? [
        ["PLATFORM", "平台公共壳", "scenarios/s003/tests/baseline-extension-contract.test.js"],
        ["M01", "本体管理", "ontology-management-review/canvas-first/s003-native-integration.test.cjs"],
        ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/s003-native-integration.test.cjs"],
        ["M05", "Agent 应用", "agent-application/s003-adapter.test.cjs"],
        ["M06", "报告中心", "report-center/review-lifecycle/s003-integration.test.cjs"]
      ]
    : [])
  , ...(atLeast(5) ? [
    ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/s003-m02-browser-regression.cjs"],
    ["M02", "数据工程", "data-engineering-prototype-review/review-v3/verify-static.mjs"],
    ["M04", "决策中心", "decision-center-prototype/review-v2/shared/app.css"],
    ["M06", "报告中心", "scenarios/s003/scripts/browser-cp14.cjs"]
  ] : []),
  ...(atLeast(6) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/data.js"],
    ["PLATFORM", "S003 总装", "scenarios/s003/integration-config.js"],
    ["PLATFORM", "S003 总装", "scenarios/s003/app.js"],
    ["PLATFORM", "S003 总装", "scenarios/s003/state.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/scripts/browser-cp15.cjs"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/model-configuration.v1.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/source-registry.v2.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/pipeline-current-projection.v2.json"],
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v2.json"],
    ["M06", "报告中心", "report-center/review-lifecycle/external-owners.js"],
    ["M06", "报告中心", "scenarios/s003/domain/report-service-v2.js"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v2.cjs"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v3.cjs"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v2.test.js"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contract.v2.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-definition.v2.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-template.v2.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-assurance-profile.v1.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v3.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v3.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v3.json"]
  ] : []),
  ...(atLeast(7) ? [
    ["PLATFORM", "S003 总装测试", "scenarios/s003/scripts/browser-cp16.cjs"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/workbench-shell.test.js"]
  ] : []),
  ...(atLeast(8) ? [
    ["PLATFORM", "S003 总装测试", "scenarios/s003/scripts/browser-cp17.cjs"]
  ] : []),
  ...(atLeast(9) ? [
    ["PLATFORM", "S003 总装测试", "scenarios/s003/scripts/browser-cp18.cjs"]
  ] : []),
  ...(atLeast(10) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/index.html"],
    ["PLATFORM", "S003 总装", "scenarios/s003/styles.css"],
    ["PLATFORM", "S003 运行服务", "scenarios/s003/domain/checkpoint-service.js"],
    ["PLATFORM", "S003 运行服务", "scenarios/s003/domain/checkpoint-projection.js"],
    ["PLATFORM", "S003 运行服务", "scenarios/s003/domain/query-service.js"],
    ["PLATFORM", "S003 运行服务", "scenarios/s003/domain/decision-service.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/checkpoint-service.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/checkpoint-projection.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/data-assets.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/decision-service.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/navigation-assembly.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/query-service.test.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/state-persistence.test.js"],
    ["M01", "本体管理", "ontology-management-review/canvas-first/app.css"],
    ["M02", "数据工程", "data-engineering-prototype-review/review-v3/shared/fixtures.js"],
    ["M03", "智能问数", "intelligent-query-prototype/review-next/conversation-workspace/variant.css"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/published-pointer.v1.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/action-type-catalog.v1.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/c035-risk-results.v1.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/published-risk-facts.v1.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/source-asset.v1.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/pipeline-run.v1.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/c017-decision-projection.v1.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-catalog.v1.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-catalog.v2.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-results.v1.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-inbox.v1.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-inbox.v2.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-results.v2.json"],
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v3.json"],
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v4.json"],
    ["M05", "Agent 应用", "scenarios/s003/scripts/build-agent-position-v3.cjs"],
    ["M06", "报告中心", "scenarios/s003/domain/report-service-v3.js"],
    ["M06", "报告中心", "scenarios/s003/domain/report-service-v4.js"],
    ["M06", "报告中心", "scenarios/s003/domain/report-service-v5.js"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v4.cjs"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v5.cjs"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v6.cjs"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v4.test.js"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v5.test.js"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v6.test.js"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-assurance-profile.v2.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-assurance-profile.v3.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v4.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v5.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v6.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v4.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v5.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v6.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v4.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v5.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v6.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-history-index.v1.json"]
  ] : []),
  ...(atLeast(11) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/README.md"],
    ["PLATFORM", "S003 总装", "scenarios/s003/CHANGELOG.md"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/scripts/browser-cp19.cjs"],
    ["PLATFORM", "S003 运行服务", "scenarios/s003/domain/config-service.js"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/config-service.test.js"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/model-configuration.v2.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/source-registry.v3.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/pipeline-run.v2.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/pipeline-current-projection.v3.json"]
  ] : []),
  ...(atLeast(12) ? [
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v5.json"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v7.cjs"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v7.test.js"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-history-index.v2.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v7.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v7.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v7.json"],
    ["M06", "报告中心", "scenarios/s003/evidence/M06-report-content-v7-validation.md"]
  ] : []),
  ...(atLeast(13) ? [
    ["PLATFORM", "S003 当前资源总装", "scenarios/s003/domain/report-service.js"],
    ["PLATFORM", "S003 当前资源总装", "scenarios/s003/scripts/build-risk-action-routing-v2.cjs"],
    ["PLATFORM", "S003 当前资源测试", "scenarios/s003/tests/report-service.test.js"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/model-package.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/model-configuration.v3.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/published-pointer.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/action-type-catalog.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/evaluation-run.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/c035-risk-results.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/published-risk-facts.v2.json"],
    ["M01", "本体管理", "scenarios/s003/resources/m01/runtime-export.v2.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/source-registry.v4.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/pipeline-current-projection.v4.json"],
    ["M02", "数据工程", "scenarios/s003/resources/m02/c017-decision-projection.v2.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-catalog.v3.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-runtime.v2.json"],
    ["M03", "智能问数", "scenarios/s003/resources/m03/query-results.v2.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-binding.v2.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-runtime.v2.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-inbox.v3.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/decision-results.v3.json"],
    ["M04", "决策中心", "scenarios/s003/resources/m04/enterprise-contact-routing.v1.json"],
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v6.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-history-index.v3.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v8.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v8.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v8.json"]
  ] : []),
  ...(atLeast(14) ? [
    ["M06", "报告中心", "scenarios/s003/domain/report-service-v6.js"],
    ["M06", "报告中心", "scenarios/s003/scripts/build-report-assets-v9.cjs"],
    ["M06", "报告中心测试", "scenarios/s003/tests/report-assets-v9.test.js"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-history-index.v4.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-manifest.v9.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-contents.v9.json"],
    ["M06", "报告中心", "scenarios/s003/resources/m06/report-artifacts.v9.json"],
    ["M06", "报告中心", "scenarios/s003/evidence/M06-report-content-v9-validation.md"],
    ["M05", "Agent 应用", "scenarios/s003/scripts/build-agent-position-v7.cjs"],
    ["M05", "Agent 应用", "scenarios/s003/resources/m05/agent-position.v7.json"]
  ] : []),
  ...(atLeast(16) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/runtime/cp22-entry.v1.html"],
    ["PLATFORM", "S003 总装", "scenarios/s003/checkpoints/spec-CP22.json"],
    ["PLATFORM", "S003 总装测试", "scenarios/s003/tests/current-risk-action-routing.test.js"]
  ] : []),
  ...(atLeast(17) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/runtime/cp23-entry.v1.html"],
    ["PLATFORM", "S003 总装", "scenarios/s003/checkpoints/spec-CP23.json"],
    ["PLATFORM", "S003 总装工具", "scenarios/s003/scripts/build-baseline-extension-inventory.cjs"],
    ["PLATFORM", "S003 总装工具", "scenarios/s003/scripts/create-checkpoint-v2.cjs"],
    ["PLATFORM", "S003 总装证据", "scenarios/s003/evidence/CP23-talk-track-and-member-routing-validation.md"],
    ["PLATFORM", "S003 浏览器证据", "scenarios/s003/evidence/browser-cp23/20260817T223000000Z-talk-track-member-routing/browser-cp23-results.json"]
  ] : [])
  , ...(atLeast(18) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/runtime/cp24-entry.v1.html"],
    ["PLATFORM", "S003 总装", "scenarios/s003/checkpoints/spec-CP24.json"],
    ["PLATFORM", "S003 总装证据", "scenarios/s003/evidence/CP24-inventory-deduplication-validation.md"],
    ["PLATFORM", "S003 浏览器证据", "scenarios/s003/evidence/browser-cp24/20260817T230000000Z-inventory-deduplication/browser-cp24-results.json"]
  ] : [])
  , ...(atLeast(19) ? [
    ["PLATFORM", "S003 总装", "scenarios/s003/runtime/cp25-entry.v1.html"],
    ["PLATFORM", "S003 总装", "scenarios/s003/checkpoints/spec-CP25.json"],
    ["PLATFORM", "S003 总装证据", "scenarios/s003/evidence/CP25-pointer-sync-validation.md"],
    ["PLATFORM", "S003 浏览器证据", "scenarios/s003/evidence/browser-cp25/20260817T233000000Z-pointer-sync/browser-cp25-results.json"]
  ] : [])
]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readFile(relativePath) {
  const absolute = path.resolve(prototypeRoot, relativePath);
  if (!absolute.startsWith(`${prototypeRoot}${path.sep}`)) {
    throw new Error(`文件越出 v1.1.0 工作区: ${relativePath}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`集成文件不存在: ${relativePath}`);
  }
  return fs.readFileSync(absolute);
}

function buildInventory() {
  const files = FILES.map(([moduleId, owner, relativePath]) => {
    const content = readFile(relativePath);
    return {
      moduleId,
      owner,
      path: relativePath,
      sha256: sha256(content),
      bytes: content.byteLength
    };
  });
  const treeLines = files
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map((item) => `${item.sha256}  ${item.path}`);
  const selectedFormalResourceRefs = ["v14", "v15", "v16", "v17", "v18", "v19"].includes(variant) ? CURRENT_FORMAL_RESOURCE_REFS_V19 : variant === "v13" ? CURRENT_FORMAL_RESOURCE_REFS : null;
  const currentFormalResourceRefs = selectedFormalResourceRefs
    ? Object.fromEntries(Object.entries(selectedFormalResourceRefs).map(([moduleId, refs]) => [moduleId, [...refs]]))
    : undefined;
  if (currentFormalResourceRefs) {
    const filePaths = new Set(files.map((item) => item.path));
    Object.values(currentFormalResourceRefs).flat().forEach((ref) => {
      if (!filePaths.has(ref)) throw new Error(`${variant} 当前正式资源未纳入集成文件树: ${ref}`);
    });
  }
  return {
    schemaVersion: `ofw.s003.baseline-extension-inventory.${variant}`,
    inventoryId: variant === "v19"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP25-POINTER-SYNC-FINAL"
      : variant === "v18"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP24-INVENTORY-DEDUPED-FINAL"
      : variant === "v17"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP23-TALK-TRACK-MEMBER-ROUTING-FINAL"
      : variant === "v16"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP22-MEMBER-UNIT-ROUTING-FINAL"
      : variant === "v15"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-REPORT-V9-MEMBER-UNIT-ROUTING-FINAL"
      : variant === "v14"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-REPORT-V9-MEMBER-UNIT-ROUTING"
      : variant === "v13"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CURRENT-RISK-ACTION-ROUTING"
      : variant === "v12"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP21-V7"
      : variant === "v11"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP19-FINAL"
      : variant === "v10"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP18-FINAL"
      : variant === "v9"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP18"
        : variant === "v8"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP17"
        : variant === "v7"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP16"
        : variant === "v6"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP15"
        : variant === "v5"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP14"
        : variant === "v4"
      ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP13"
      : variant === "v3"
        ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP12"
        : variant === "v2"
          ? "S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP11"
          : "S003-V103-BASELINE-MODULE-INTEGRATION-20260816",
    createdAt: variant === "v19"
      ? "2026-08-17T23:30:00.000Z"
      : variant === "v18"
      ? "2026-08-17T23:00:00.000Z"
      : variant === "v17"
      ? "2026-08-17T22:30:00.000Z"
      : variant === "v16"
      ? "2026-08-17T22:00:00.000Z"
      : variant === "v15"
      ? "2026-08-17T20:00:00.000Z"
      : variant === "v14"
      ? "2026-08-17T19:42:00.000Z"
      : variant === "v13"
      ? "2026-08-17T16:30:00.000Z"
      : variant === "v12"
      ? "2026-08-17T19:30:00.000Z"
      : variant === "v11"
      ? "2026-08-17T07:23:00.000Z"
      : variant === "v10"
      ? "2026-08-17T04:30:00.000Z"
      : variant === "v9"
        ? "2026-08-16T21:20:00.000Z"
        : variant === "v8"
        ? "2026-08-16T21:00:00.000Z"
        : variant === "v7"
        ? "2026-08-16T20:30:00.000Z"
        : variant === "v6"
        ? "2026-08-16T20:10:00.000Z"
        : variant === "v5"
        ? "2026-08-16T14:10:00.000Z"
        : variant === "v4"
      ? "2026-08-16T10:45:00.000Z"
      : variant === "v3"
        ? "2026-08-16T09:40:00.000Z"
        : variant === "v2" ? "2026-08-16T06:19:59.000Z" : "2026-08-16T05:59:45.000Z",
    immutable: true,
    baselineVersion: "1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    prototypeVersion: "1.1.0",
    scenarioIdentity: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: ["v13", "v14", "v15", "v16", "v17", "v18", "v19"].includes(variant)
        ? "S003-RUN-20260817163000000-c02200000001"
        : "S003-RUN-20260815133000000-c03503000001"
    },
    currentFormalResourceRefs,
    scope: "v1.0.3-derived-v1.1.0 conditional integration surfaces; frozen v1.0.3 excluded and separately verified",
    fileCount: files.length,
    treeSha256: sha256(Buffer.from(`${treeLines.join("\n")}\n`, "utf8")),
    files
  };
}

function main() {
  const mode = process.argv.includes("--write") ? "--write" : "--check";
  const serialized = `${JSON.stringify(buildInventory(), null, 2)}\n`;
  if (mode === "--write") {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, { flag: "wx" });
    process.stdout.write(`${outputRef} ${sha256(Buffer.from(serialized, "utf8"))}\n`);
    return;
  }
  if (mode !== "--check") throw new Error("用法: build-baseline-extension-inventory.cjs [--write|--check] [--v2|--v3|--v4|--v5|--v6|--v7|--v8|--v9|--v10|--v11|--v12|--v13|--v14|--v15|--v16|--v17|--v18|--v19]");
  if (!fs.existsSync(outputPath)) throw new Error(`待校验清单不存在: ${outputRef}`);
  const current = fs.readFileSync(outputPath, "utf8");
  if (current !== serialized) throw new Error(`v1.0.3 派生模块集成文件与 ${variant} 清单不一致`);
  process.stdout.write(`PASS ${outputRef}\n`);
}

module.exports = Object.freeze({
  FILES,
  CURRENT_FORMAL_RESOURCE_REFS,
  CURRENT_FORMAL_RESOURCE_REFS_V14,
  CURRENT_FORMAL_RESOURCE_REFS_V15,
  CURRENT_FORMAL_RESOURCE_REFS_V16,
  CURRENT_FORMAL_RESOURCE_REFS_V17,
  CURRENT_FORMAL_RESOURCE_REFS_V18,
  CURRENT_FORMAL_RESOURCE_REFS_V19,
  buildInventory,
  variant,
  variantNumber
});

if (require.main === module) main();
