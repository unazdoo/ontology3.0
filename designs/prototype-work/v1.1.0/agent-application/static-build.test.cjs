"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("./vendor/babel.min.js");

const sources = ["data.jsx", "components.jsx", "app.jsx"];

test("M05 uses synchronous compiled scripts around the portfolio adapter", () => {
  const html = fs.readFileSync(path.join(__dirname, "Agent应用.html"), "utf8");
  assert.doesNotMatch(html, /babel\.min\.js|type=["']text\/babel["']/);
  const order = ["data.compiled.js", "portfolio-integration.js", "components.compiled.js", "app.compiled.js"]
    .map((name) => html.indexOf(name));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
});

test("M05 compiled artifacts match their JSX sources", () => {
  sources.forEach((sourceName) => {
    const source = fs.readFileSync(path.join(__dirname, sourceName), "utf8");
    const code = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
      sourceType: "script",
      filename: sourceName,
      comments: false,
      compact: true
    }).code;
    const expected = `(function () {\n${code}\n})();\n`;
    assert.equal(fs.readFileSync(path.join(__dirname, sourceName.replace(/\.jsx$/, ".compiled.js")), "utf8"), expected);
  });
});

test("M05 portfolio includes four-scenario agents, runs, results and handoffs", () => {
  const portfolio = fs.readFileSync(path.join(__dirname, "portfolio-integration.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "app.jsx"), "utf8");
  ["RES-S001-FINANCE-INSIGHT-001", "RES-S001-REPORT-COPILOT-001", "RES-S002-ANOMALY-001", "RES-S003-REPORT-COPILOT-001", "RES-S004-20260815-002-COPILOT"].forEach((id) => assert.match(portfolio, new RegExp(id)));
  ["AG-SESSION-S001-REPORT-001", "AG-SESSION-S003-REPORT-001", "AG-SESSION-S004-REPORT-001", "AH-S001-FIN-553"].forEach((id) => assert.match(portfolio, new RegExp(id)));
  assert.match(app, /const packages = model\.evidencePackages\.filter\(\(item\) => item\.portfolioRecord/);
  assert.match(app, /工具轨迹/);
  assert.doesNotMatch(portfolio, /S003-T007-FORMAL-CANDIDATE-20251231-v1/);
  assert.match(portfolio, /21,613\.387 亿元/);
  assert.match(portfolio, /2\.372231%/);
  assert.match(portfolio, /欧陆银行、寰宇银行、海联银行/);
  assert.match(portfolio, /RPT-20260816-092626-010/);
  assert.match(portfolio, /RISK-020-2025/);
  assert.match(portfolio, /环保测试公司4债务风险评估报告 · 1\.7\.0/);
  assert.match(portfolio, /企业风险证据包 · S003-ENT-020/);
  assert.doesNotMatch(portfolio, /118\.315亿元|2\.448%|浦发银行|建设银行/);
});

test("M05 exposes a report verification Agent distinct from report copilot", () => {
  const data = fs.readFileSync(path.join(__dirname, "data.jsx"), "utf8");
  const portfolio = fs.readFileSync(path.join(__dirname, "portfolio-integration.js"), "utf8");
  ["report-verification-agent", "prompt-report-verification-extraction", "skill-report-verification-extraction", "tool-verification-extraction-return"].forEach((id) => assert.match(data, new RegExp(id)));
  assert.match(portfolio, /submitVerification/);
  assert.match(portfolio, /Report Verification Extraction v1/);
  assert.match(portfolio, /determinationStatus: "not-evaluated"/);
  assert.doesNotMatch(portfolio, /determinationStatus: "passed"|determinationStatus: "failed"/);
});

test("M05 catalog, resources and evidence flow remain business-readable", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.jsx"), "utf8");
  const data = fs.readFileSync(path.join(__dirname, "data.jsx"), "utf8");
  const integration = fs.readFileSync(path.join(__dirname, "../s001-e2e-integration/app.js"), "utf8");
  assert.doesNotMatch(app.slice(app.indexOf("function AgentDirectory"), app.indexOf("function AgentCard")), /进行中运行|受限资源/);
  ["Prompt 规定任务和表达边界", "运行时如何生效", "Skill 接收已通过门禁的结构化输入", "固定依据", "Agent 结果", "工具轨迹", "下游回执"].forEach((copy) => assert.match(app, new RegExp(copy)));
  ["开始前核对", "证据使用", "输出结构", "质量与失败"].forEach((section) => assert.match(data, new RegExp(section)));
  assert.match(app, /back=\{\(\) => navigate\("agents"\)\}/);
  assert.match(integration, /if \(module\.id === "agent"\) return sourceWithScenarioContext\(fallback\)/);
});
