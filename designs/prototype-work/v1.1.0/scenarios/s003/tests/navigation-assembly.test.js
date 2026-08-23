"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scenarioRoot = path.resolve(__dirname, "..");
const workRoot = path.resolve(scenarioRoot, "../..");
const shellSource = fs.readFileSync(path.join(workRoot, "s001-e2e-integration", "app.js"), "utf8");
const scenarioEntry = fs.readFileSync(path.join(scenarioRoot, "index.html"), "utf8");
const scenarioConfig = fs.readFileSync(path.join(scenarioRoot, "integration-config.js"), "utf8");

test("S003 只去除重复场景标签和模块标题，S001 分支保持原导航", () => {
  assert.match(shellSource, /scenario\.id === "S003" \? "" : `<div class="nav-context">/);
  assert.match(shellSource, /const s003NavigationDedupe = activeScenario\(\)\.id === "S003" && moduleId !== "dashboard"/);
  assert.match(shellSource, /\.product-nav > \.product-nav-head \{ display:none!important; \}/);
  assert.match(shellSource, /return `\$\{common\}\$\{s003NavigationDedupe\}\$\{adapters\[kind\] \|\| ""\}`/);
});

test("模块真实二级菜单与六模块路由仍由 v1.0.3 派生公共壳承载", () => {
  for (const moduleId of ["data", "ontology", "query", "decision", "agent", "report"]) {
    assert.match(shellSource, new RegExp(moduleId + ": `"));
  }
  assert.ok((shellSource.match(/> \.product-nav \{ grid-column:1!important; grid-row:1!important; \}/g) || []).length >= 6);
  assert.doesNotMatch(shellSource, /stopImmediatePropagation/);
  assert.match(scenarioEntry, /s001-e2e-integration\/index\.html/);
  assert.match(scenarioEntry, /window\.location\.replace\(target\.href\)/);
});

test("M02 旧配置深链从 framePositions 定向迁移回基线数据资源目录", () => {
  for (const retiredPrefix of ["s003-factor-config", "s003-risk-band-config", "s003-enterprise-factor-input"]) {
    assert.match(scenarioConfig, new RegExp(`#\\/resources\\/source\\/${retiredPrefix}\\*`));
  }
  assert.match(shellSource, /pattern\.endsWith\("\*"\)/);
  assert.match(shellSource, /String\(hash \|\| ""\)\.startsWith\(pattern\.slice\(0, -1\)\)/);
  assert.match(shellSource, /migration: "deprecated-s003-private-entry-to-baseline-entry"/);
});

test("跨模块 iframe 地址不会污染当前模块的 framePositions", () => {
  assert.match(shellSource, /const mapped = shellRouteForUrl\(href\);/);
  assert.match(shellSource, /mapped\[2\] !== moduleId/);
  assert.match(shellSource, /moduleId === "dashboard" && mapped\[2\] === "report"/);
});

test("统一壳模块路由只解析 pathname，不会被隐藏合同桥或 returnTo 查询参数误导", () => {
  assert.match(shellSource, /new URL\(String\(url \|\| ""\), window\.location\.href\)\.pathname/);
  assert.ok(shellSource.includes('pathname = String(url || "").split(/[?#]/, 1)[0];'));
  assert.match(shellSource, /routeMap\.find\(\(\[needle\]\) => pathname\.includes\(needle\)\)/);
  assert.doesNotMatch(shellSource, /routeMap\.find\(\(\[needle\]\) => url\.includes\(needle\)\)/);
});
