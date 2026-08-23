"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterRef = "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/s002-adapter.js";
const entryRef = "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html";
const dataRef = "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/data.jsx";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

test("M03打开已完成轮次即展示结构化结果、Rule Hit与证据下钻", function () {
  const adapter = read(adapterRef);
  const entry = read(entryRef);

  assert.ok(adapter.includes("approvedQuestionFromRun(projection?.currentRun)?.question"), "M03未按显式问题身份读取统一工作台当前问数");
  assert.ok(adapter.includes("if (projection.runComplete && completedQuestion) patchCompletedQuery(completedQuestion)"), "M03仍可能为空问题或要求重新提交后才显示结果");
  assert.ok(adapter.includes('center?.querySelector(".run-surface") || center'), "M03无法在已完成轮次的基线分析区呈现结果");
  assert.ok(adapter.includes('data-s002-query-result="M03"'), "M03缺少基线结果区中的结构化结果投影");
  assert.ok(adapter.includes('center.querySelectorAll("[data-s002-query-result=\'M03\']")'), "M03切换问题时可能残留重复结果区");
  assert.ok(adapter.includes("if (!runSurface.contains(node)) node.remove()"), "M03未清理基线提交后被替代的旧结果投影");
  assert.ok(adapter.includes("查看证据下钻"));
  assert.ok(adapter.includes("查看 Rule 命中"));
  assert.ok(adapter.includes('data-s002-bi-view="M03"'), "M03缺少可切换的BI结果视图");
  assert.ok(adapter.includes("patchCompletedQuery(question);"), "推荐问题未直接切换到对应的已完成结果");
  assert.ok(adapter.includes('panel.dataset.s002RecommendationPanel = "M03"'), "已完成轮次缺少六问切换面板");
  assert.ok(adapter.includes('center.appendChild(panel)'), "六问切换面板未落在基线分析工作区");
  assert.ok(adapter.includes("askHero.insertAdjacentElement(\"afterend\", result)"), "已完成结果未前置到问数主工作区");
  assert.ok(adapter.includes("bindCapabilityDetails"), "Agent能力与工具缺少详情入口");
  assert.ok(adapter.includes("S002-BUDGET-SUPERVISION-SKILL-v1"), "能力详情未显示预算场景Skill绑定");
  assert.ok(adapter.includes("const QUESTION_PLANS = Object.freeze"), "六个问题缺少逐题语义计划");
  assert.ok(adapter.includes('setRailDefinition(cards[1], "关系路径", questionPlan.relationshipPath)'), "结果侧栏未按当前问题更新关系路径");
  assert.ok(adapter.includes('setRailDefinition(cards[1], "最终理解", question)'), "切换问题后侧栏最终理解未同步当前问题");
  assert.ok(adapter.includes("预算版本归属主体：预算版本 → 预算主体"), "预算执行/申报问题缺少已发布关系路径");
  assert.ok(adapter.includes("项目占用使用预算版本：项目占用 → 预算版本"), "项目余额问题缺少已发布关系路径");
  assert.ok(adapter.includes("采购发起关联项目占用：采购发起 → 项目占用"), "年末采购问题缺少已发布关系路径");
  assert.ok(adapter.includes("合法重复凭证 21 组、期间异常 13 条、日期倒置 6 条"));
  assert.ok(adapter.includes('!String(value).trim().endsWith(rawUnit)'), "M03指标卡未避免数值与单位重复显示");
  assert.ok(adapter.includes('hint: canonicalBusinessText(hint)'), "M03指标卡缺少去重后的辅助说明");
  assert.ok(adapter.includes("window.__S002_SELECTED_QUERY = question"), "推荐问题选择未形成稳定的当前问题状态");
  assert.ok(adapter.includes("const completedQuestion = completedQuestionFor(projection, displayedQuestion)"), "基线重渲染后可能用旧问题覆盖新答案");
  assert.ok(adapter.includes("if (!key) return null;"), "未识别问题仍会默认套用第一条预算执行答案");
  assert.ok(adapter.includes("const fallback = RESULT_FALLBACKS[key] || null;"), "结果合同仍保留首条答案兜底");
  assert.ok(adapter.includes("if (!answerKey || !S002.questionKeys.includes(answerKey)) return false;"), "非获准问题未保留基线阻断/门禁结果");
  assert.ok(adapter.includes("domain.resolveQuestion = (question) => questionKey(question);"), "基线宽松解析器未收紧为六问白名单");
  assert.ok(entry.includes("data.jsx?v=20260817-16"), "M03入口未切换到最新语义数据版本");
  assert.ok(entry.includes("s002-adapter.js?v=20260817-24"), "M03入口未切换到最新场景脚本版本");
  assert.ok(adapter.includes("projection.ruleCount || 7"), "M03直接入口Rule数量兜底未与7条正式命中对齐");
});

test("M03只允许六个获准问题或显式合同身份，近似问题和冲突身份保持阻断", function () {
  const broadResolver = () => "s002-budget-execution";
  const document = {
    readyState: "loading",
    documentElement: { dataset: {} },
    head: { appendChild() {} },
    getElementById() { return null; },
    createElement() { return { id: "", textContent: "" }; },
    addEventListener() {}
  };
  const window = {
    IQDomain: { resolveQuestion: broadResolver },
    location: { search: "", hash: "#/ask" },
    setTimeout() { return 0; },
    clearTimeout() {},
    addEventListener() {}
  };
  const sandbox = { window, document, location: window.location, URLSearchParams, console };
  vm.createContext(sandbox);
  vm.runInContext(read(adapterRef), sandbox, { filename: adapterRef });

  const guard = window.S002_M03_QUERY_GUARD;
  assert.ok(guard, "M03六问白名单守卫未暴露运行时核验入口");
  const expectedKeys = [
    "s002-budget-execution",
    "s002-cost-margin",
    "s002-project-occupancy",
    "s002-year-end",
    "s002-submission",
    "s002-actions"
  ];
  assert.deepEqual(Array.from(guard.approvedQuestions, (question) => guard.questionKey(question)), expectedKeys);
  assert.equal(guard.questionKey(" 2025年各部门费用预算执行率和差异额分别是多少？ "), "s002-budget-execution");
  assert.equal(guard.questionKey("s002-actions"), "s002-actions", "显式固定结果合同应可定位");

  for (const unsupported of [
    "2025年预算执行率是多少？",
    "哪些单位成本占收比超过100%？",
    "当前预算异常应该怎么处理？",
    "请预测2027年预算",
    "hello"
  ]) {
    assert.equal(guard.questionKey(unsupported), null, `近似或非获准问题不应取得固定答案：${unsupported}`);
    assert.equal(window.IQDomain.resolveQuestion(unsupported), null, `宽松基线解析器仍对非获准问题返回答案：${unsupported}`);
  }

  assert.equal(
    guard.approvedQuestionFromRun({ questionId: "Q-ACTION", label: "2025 预算执行、差异与项目占用监督" }).question,
    "2024—2025年各部门费用预算执行率变化分别是多少？",
    "显式Owner问题身份应解析到对应固定问题"
  );
  assert.equal(
    guard.approvedQuestionFromRun({ questionId: "Q-ACTION", label: "2025年各部门费用预算执行率和差异额分别是多少？" }),
    null,
    "问题标识与文字冲突时不得任选一个答案"
  );

  window.__S002_LAST_SUBMITTED_QUERY = "2025年预算执行率是多少？";
  window.__S002_SELECTED_QUERY = guard.approvedQuestions[0];
  assert.equal(
    guard.completedQuestionFor({ currentRun: { questionId: "Q-EXECUTION" } }, guard.approvedQuestions[0]),
    "",
    "提交非获准问题后不得用旧选择、旧Owner运行或默认答案覆盖基线阻断态"
  );
  window.__S002_LAST_SUBMITTED_QUERY = guard.approvedQuestions[5];
  assert.equal(
    guard.completedQuestionFor({ currentRun: { questionId: "Q-EXECUTION" } }, ""),
    guard.approvedQuestions[5],
    "获准问题应按本次提交而不是旧Owner运行展示对应答案"
  );
});

test("M03六问、Published资源和跨年趋势与当前S002合同对齐", function () {
  const adapter = read(adapterRef);
  const data = read(dataRef);

  assert.ok(data.includes("function readS002ScenarioPackageProjection"), "直接或历史查看缺少S002只读Published投影");
  assert.ok(data.includes('source: "S002_SCENARIO_PACKAGE_READ_ONLY_PROJECTION"'), "场景包只读投影缺少明确来源标识");
  assert.ok(data.includes('"RULE-003": "RULE-S002-COST-TO-REVENUE"'), "RULE-003未映射到成本占收比异常");
  assert.ok(data.includes('s002Rule("RULE-S002-COST-TO-REVENUE", "成本占收比异常"'), "Published目录缺少成本占收比异常Rule");
  assert.equal(data.includes('s002Rule("RULE-S002-ACCRUAL-VARIANCE"'), false, "跨年计提质量核验仍被冒充正式Rule");
  for (const value of ["84.25", "63.20", "-21.05", "90.12", "77.97", "-12.15", "125.48", "98.86", "-26.62"]) {
    assert.ok(adapter.includes(value), `跨年执行趋势缺少 ${value}`);
    assert.ok(data.includes(value), `固定结果缺少跨年执行趋势 ${value}`);
  }
  assert.ok(data.includes('TOOLS.filter((item) => item.id !== "TOOL-IQ-ACTION-REQUEST")'), "S002问数Agent仍可能启用行动申请工具");
  assert.equal(adapter.includes("4条待我决策"), false, "推荐问答仍混入决策事项统计");
  assert.ok(data.includes("费用预算执行率 ≥ 95% 或 ≤ 70%"), "M03费用预算执行阈值未与Published本体对齐");
  assert.equal(data.includes("费用预算执行率 ≥ 90% 或 ≤ 70%"), false, "M03仍保留旧的90%阈值");
  assert.ok(data.includes('&& !/初始申报|预算申报/.test(normalized)'), "初始申报问题可能误路由到2025成本占收比答案");
  assert.ok(adapter.includes('.active-config .skill-list > div, .active-config .capability-chip-list > span'), "Agent配置页能力与工具缺少逐项详情入口");
  assert.ok(adapter.includes('setReadyStatusBadge(active.querySelector(".active-hero .ui-status-badge"), "已核对")'), "Agent配置状态仍可能与可运行提示矛盾");
});

test("M03完整场景不展示临时不可消费提示，并提供能力详情入口", function () {
  const adapter = read(adapterRef);
  assert.ok(adapter.includes("adaptAgentConfigReady"), "Agent配置页缺少场景就绪投影");
  assert.ok(adapter.includes("if (!projection?.semanticReady) return;"), "未Published或空投影轮次仍可能被强制涂成正式可用");
  assert.ok(adapter.includes("adaptAgentConfigReady(projection);"), "Agent 配置页延迟投影未传入权威上下文");
  assert.ok(adapter.includes("当前配置可用于正式问数"), "完整场景未声明正式问数可用");
  assert.ok(adapter.includes("查看详情"), "Skill/Tool缺少详情入口");
  assert.ok(adapter.includes('["当前数据暂不可用于正式问数", "当前配置可用于正式问数"]'), "正式场景未将不可消费提示归一为可运行状态");
  assert.ok(adapter.includes('data-s002-display-mode="text"'));
  assert.ok(adapter.includes('data-s002-display-mode="chart"'));
  assert.ok(adapter.includes("BI 图表"));
  assert.ok(adapter.includes('data-s002-display-mode="table"'));
});

test("M03年末采购结果保持表格视图并按万元与百分比分面展示BI", function () {
  const adapter = read(adapterRef);
  const data = read(dataRef);
  const entry = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html");

  assert.ok(adapter.includes("function chartFacets(result)"), "M03缺少独立量纲分面函数");
  assert.ok(adapter.includes('result.key === "s002-year-end"'), "年末采购问题未使用专属分面");
  assert.ok(adapter.includes('{ title: "金额规模", unit: "万元"'));
  assert.ok(adapter.includes('{ title: "占比与集中度", unit: "%"'));
  assert.ok(adapter.includes("window.__S002_DISPLAY_MODE_BY_KEY"), "结果重绘时未保留表格/BI切换状态");
  assert.ok(adapter.includes("modeStore[answerKey] = mode"), "点击展示方式后未保存当前问题的视图");
  assert.ok(adapter.includes('exact: "273.09", unit: "万元"') && adapter.includes('exact: "8.59", unit: "%"'), "年末采购表格缺少金额与比例明细");
  assert.ok(data.includes('exact: "273.09", unit: "万元"') && data.includes('exact: "18.94", unit: "%"'), "data合同未保留年末采购表格明细");
  assert.ok(entry.includes("data.jsx?v=20260817-16"));
  assert.ok(entry.includes("s002-adapter.js?v=20260817-24"));
});

test("M03跨年趋势表格按部门、精确值、单位和年度状态正确映射", function () {
  const adapter = read(adapterRef);
  const data = read(dataRef);
  for (const source of [adapter, data]) {
    assert.ok(source.includes('label: "费用预算执行率变化", exact: "-21.05", unit: "个百分点", status: "2024 84.25% → 2025 63.20%"'));
    assert.ok(source.includes('label: "费用预算执行率变化", exact: "-12.15", unit: "个百分点", status: "2024 90.12% → 2025 77.97%"'));
    assert.ok(source.includes('label: "费用预算执行率变化", exact: "-26.62", unit: "个百分点", status: "2024 125.48% → 2025 98.86%"'));
    assert.equal(source.includes('status: "待我决策"'), false, "跨年趋势结果仍混入待决策状态");
  }
  assert.ok(adapter.includes('result.key === "s002-actions"'), "跨年趋势未使用专属BI分面");
  assert.ok(adapter.includes('title: "执行率同比变化", unit: "个百分点"'));
});

test("M03重新打开新Checkpoint时以当前场景配置覆盖旧runId加载证明", function () {
  const adapter = read(adapterRef);
  const data = read(dataRef);

  assert.ok(
    data.includes("...(parsed.activeConfig || {}),") &&
      data.includes("...clone(S002_ACTIVE_CONFIG),"),
    "S002当前配置必须在持久化展示状态之后重放，避免旧runId覆盖当前URL/C008上下文"
  );
  assert.equal(adapter.includes("S002-RUN-20260815235500000-a07fd209d423"), false, "M03直接入口仍硬编码旧历史runId");
  assert.ok(adapter.includes('runId: "S002-RUN-20260815-M03-DIRECT"'), "M03直接入口缺少中性只读fallback runId");
});
