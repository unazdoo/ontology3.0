import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const dataSource = read("./data.js");
const appSource = read("./app.js");
const cssSource = read("./styles.css");
const htmlSource = read("./index.html");

const context = { window: { RC_PORTFOLIO: { data: {} } } };
vm.runInNewContext(dataSource, context, { filename: "data.js" });
const data = context.window.DASHBOARD_DATA;

assert.equal(data.version, "ofw.dashboard.canonical.v2");
assert.deepEqual(Array.from(data.dashboards, (item) => item.id), ["financing", "budget", "risk"]);

const financing = data.dashboards.find((item) => item.id === "financing");
assert.equal(financing.metrics.length, 7);
assert.equal(financing.structures.length, 6);
assert.equal(financing.units.length, 3);
assert.equal(financing.rules.length, 3);
assert.ok(financing.institutions.length >= 6);

const budget = data.dashboards.find((item) => item.id === "budget");
assert.equal(budget.topics.length, 6);
assert.deepEqual(Array.from(budget.topics, (item) => item.id), ["cost", "project", "travel", "accrual", "concentration", "supplier"]);
budget.topics.forEach((topic) => assert.ok(budget.details[topic.id]?.length >= 3, `${topic.id} 缺少明细`));

const risk = data.dashboards.find((item) => item.id === "risk");
assert.equal(risk.companies.length, 21);
assert.equal(risk.companies.filter((item) => item.riskTier !== "绿灯").length, 5);
assert.equal(risk.companies.filter((item) => item.report).length, 21);
assert.equal(risk.modelConfig.publishedVersion, "1.0.2");
assert.equal(risk.actions.length, 5);
assert.ok(risk.actions.every((item) => item.enterpriseId && item.actionTypeId && item.actionTypeVersion === "1.0.2" && item.recipientId && item.recipient));
assert.deepEqual(Array.from(risk.thresholds, (item) => item.range), ["≥ 40 分", "25—40 分", "10—25 分", "< 10 分"]);

["经营概览", "单位比较", "结构与机构", "规则与行动", "风险总览", "产业与薄弱项", "风险处置行动", "模型与运行", "模型配置与重评", "数据更新后重评", "模型调整后重评", "校验、发布并重评", "发起处置行动"].forEach((label) => assert.ok(appSource.includes(label), `缺少 ${label}`));
["budget-expand", "risk-sector-detail", "toggle-finance-unit", "metric-detail", "risk-model-section", "risk-data-check", "risk-rerun", "risk-action-evidence", "risk-action-confirm", "risk-action-unconfirm", "risk-action-submit", "risk-model-save", "risk-model-apply-run", "risk-model-reset"].forEach((action) => assert.ok(appSource.includes(action), `缺少交互 ${action}`));
assert.doesNotMatch(appSource, />仅发布</);
assert.doesNotMatch(appSource, />发布并重评/);
assert.doesNotMatch(appSource, /企业明细与行动/);
assert.doesNotMatch(appSource, /模型与运行[^\n]*企业正式报告/);
assert.match(cssSource, /overflow-y:\s*auto/);
assert.match(cssSource, /\.drawer-body[^}]*overflow-x:\s*hidden;\s*overflow-y:\s*auto/s);
assert.match(cssSource, /@media \(max-width: 760px\)/);
assert.match(htmlSource, /styles\.css\?v=20260823-10/);
assert.match(cssSource, /\.toolbar-group[^}]*flex-wrap:\s*nowrap/);
assert.match(cssSource, /\.toolbar-note[^}]*overflow-wrap:\s*anywhere/);
assert.match(htmlSource, /score-engine\.js\?v=20260823-01/);
assert.match(htmlSource, /data\.js\?v=20260823-09/);
assert.match(htmlSource, /app\.js\?v=20260823-19/);
assert.match(appSource, /function syncModelEditControls\(\)/);
assert.match(appSource, /ofw\.dashboard\.workspace\.v7/);
assert.doesNotMatch(appSource, /onclick="event\.stopPropagation\(\)"/);
assert.match(appSource, /target\.classList\.contains\("drawer-backdrop"\) && event\.target !== target/);
assert.doesNotMatch(appSource, /financeOverviewLegacy/);
assert.doesNotMatch(dataSource, /\["2025-09",\s*2\.462\]/);
assert.doesNotMatch(`${dataSource}\n${appSource}`, /S003-T007-FORMAL-CANDIDATE-20251231-v1/);
assert.ok(dataSource.includes("S003-T007-DEBT-RISK-20251231-v1"), "S003 本轮重跑必须读取当前正式数据资产");
assert.ok(financing.metrics.every((item) => item.trend === "flat"), "S001 无连续历史版本时不得展示趋势方向");
assert.deepEqual(Array.from(financing.metrics, (item) => item.change), ["本期结果", "集团范围", "本期结构", "本期结构", "本期结构", "当前规则口径", "本期结构"]);
for (const key of ["inTransit", "supplier"]) assert.equal(budget.metrics.find((item) => item.key === key)?.trend, "flat");
assert.equal(risk.metrics.find((item) => item.key === "alerts")?.trend, "flat");
assert.deepEqual(Array.from(new Set(risk.companies.map((item) => item.category === "在建企业" ? "新能源产业-风电" : item.category))).sort(), ["新能源产业-风电", "核电", "环保"]);
assert.equal(risk.companies.filter((item) => item.category === "在建企业").length, 3, "三家在建企业必须保留原始经营阶段事实");
assert.match(appSource, /在建状态单独按经营阶段分析，不作为产业板块/);
assert.match(appSource, /这里只呈现五条已触发预警、需要人工判断的事项/);

const forbidden = ["合同冲突", "待总控裁决", "原型夹具", "非真实结果"];
forbidden.forEach((phrase) => assert.equal(`${dataSource}\n${appSource}`.includes(phrase), false, `页面包含内部文案：${phrase}`));

console.log("dashboard verification passed: 3 dashboards, 4 financing views, 6 budget topics, 21 risk enterprises");
