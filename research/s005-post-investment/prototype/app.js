(() => {
  "use strict";

  const DATA = window.S005_DATA;
  const state = { view: "overview", category: "全部", drawer: null, refreshedAt: "刚刚" };
  const app = document.getElementById("app");

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const icon = (name, size = "") => `<i data-lucide="${esc(name)}" class="icon ${size}"></i>`;
  const toneClass = (tone) => tone === "success" ? "success" : tone === "danger" ? "danger" : tone === "warning" ? "warning" : "neutral";
  const badge = (label, tone = "neutral") => `<span class="badge ${toneClass(tone)}">${esc(label)}</span>`;
  const fmt = (value, digits = 2) => Number(value).toFixed(digits);
  const sourceNote = (text) => `<span class="source-note">${icon("database", "sm")}${esc(text)}</span>`;

  function toast(message) {
    const root = document.getElementById("toast-root");
    root.innerHTML = `<div class="toast">${icon("info", "sm")}<span>${esc(message)}</span></div>`;
    window.setTimeout(() => { root.innerHTML = ""; }, 2600);
  }

  function header() {
    return `<header class="module-bar">
      <div class="module-title">
        <div class="mark">${icon("activity", "lg")}</div>
        <div><strong>智财问策 · 投后评价</strong><small>S005 研究驾驶舱 · 中文高密度原型</small></div>
        ${badge("研究夹具", "warning")}
      </div>
      <div class="module-actions">
        <span class="base-chip">活动基线 <strong>v1.1.0</strong></span>
        <span class="base-chip">回退 <strong>v1.0.3</strong></span>
        <button class="icon-btn" type="button" data-action="show-linkage" title="查看 v1.1.0 模块关联" aria-label="查看 v1.1.0 模块关联">${icon("waypoints")}</button>
        <button class="icon-btn" type="button" data-action="refresh" title="重新读取研究证据" aria-label="重新读取研究证据">${icon("refresh-cw")}</button>
      </div>
    </header>`;
  }

  function tabs() {
    const items = [
      ["overview", "全周期总览", "layout-dashboard"],
      ["market", "市场对比与入池", "bar-chart-3"],
      ["compliance", "准入合规", "shield-check"],
      ["selection", "池内选择", "git-compare"],
      ["trading", "交易与风险", "candlestick-chart"]
    ];
    return `<nav class="view-tabs" aria-label="投后评价视图">${items.map(([id, label, glyph]) => `<button class="view-tab ${state.view === id ? "active" : ""}" type="button" data-view="${id}">${icon(glyph, "sm")}<span>${label}</span></button>`).join("")}</nav>`;
  }

  function statusStrip() {
    return `<section class="status-strip" aria-label="评价上下文">
      <div class="status-context"><span class="eyebrow">评价上下文</span><strong>评价日 ${esc(DATA.meta.asOf)}</strong><small>数据截至 ${esc(DATA.meta.asOf)} · ${esc(DATA.meta.scenarioVersion)}</small></div>
      <div class="status-item"><span>数据状态</span>${badge(DATA.meta.sourceStatus, "warning")}</div>
      <div class="status-item"><span>公式版本</span><strong>${esc(DATA.meta.formulaVersion)}</strong></div>
      <div class="status-item"><span>覆盖</span><strong>12 / 12 月</strong><small>夹具序列</small></div>
      <div class="status-item"><span>结论</span>${badge("部分评价", "warning")}</div>
    </section>`;
  }

  function pageHead(title, subtitle, actions = "") {
    return `<section class="page-head"><div><span class="eyebrow">S005 · 金融产品投后评价管理</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="head-actions">${actions}</div></section>`;
  }

  function kpiGrid(items = DATA.kpis) {
    return `<section class="kpi-grid">${items.map((item) => `<article class="kpi ${toneClass(item.tone)}"><span>${esc(item.label)}</span><strong>${esc(item.value)} <em>${esc(item.unit)}</em></strong><small>${esc(item.note)}</small></article>`).join("")}</section>`;
  }

  function panel(title, subtitle, body, actions = "", extra = "") {
    return `<section class="panel ${extra}"><header class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${actions ? `<div class="panel-actions">${actions}</div>` : ""}</header><div class="panel-body">${body}</div></section>`;
  }

  function chartLegend(series) {
    return `<div class="legend">${series.map((item) => `<span><i style="--legend-color:${item.color}"></i>${esc(item.label)}</span>`).join("")}</div>`;
  }

  function lampGrid() {
    return `<div class="lamp-grid">${DATA.riskLamps.map((lamp) => `<article class="lamp ${toneClass(lamp.tone)}"><div><span class="lamp-dot"></span><strong>${esc(lamp.label)}</strong></div><b>${esc(lamp.value)}</b><small>${esc(lamp.detail)}</small></article>`).join("")}</div>`;
  }

  function overview() {
    const chartSeries = DATA.marketSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    const selectionSeries = DATA.selectionSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    return `<div class="view-panel" data-screen-label="S005 全周期总览">
      ${pageHead("投后评价全周期总览", "从市场同类基金池到准入、池内选择、交易执行和风险复盘，先看状态，再下钻证据。", `<button class="btn" type="button" data-action="show-method">${icon("book-open", "sm")}评价方法</button><button class="btn primary" type="button" data-action="show-sources">${icon("external-link", "sm")}数据源状态</button>`)}
      ${statusStrip()}
      ${kpiGrid()}
      <div class="grid-2-1">
        ${panel("市场横评趋势", "单位净值归一化为 100 · 同类中位数与合同基准为研究夹具", `<div class="chart-meta">${chartLegend(chartSeries)}<span class="chart-asof">12 个观察点 · 月频示意</span></div><chart-stage id="overview-market-chart" name="s005-market-overview" zoom="x" class="chart-stage"></chart-stage>`, `<button class="text-btn" type="button" data-view="market">展开全市场 ${icon("arrow-up-right", "sm")}</button>`, "chart-panel")}
        ${panel("独立风险灯", "风险灯不被收益评分抵销 · 灰灯代表证据不足", lampGrid(), `<button class="text-btn" type="button" data-view="compliance">查看准入与风险 ${icon("arrow-up-right", "sm")}</button>`, "lamp-panel")}
      </div>
      <div class="grid-2-1">
        ${panel("已选 vs 池内未选", "决策后窗口的选择差异 · 不把未选自动当负例", `<div class="chart-meta">${chartLegend(DATA.selectionSeries)}<span class="chart-asof">12 个月 · 匹配样本夹具</span></div><chart-stage id="overview-selection-chart" name="s005-selection-overview" zoom="x" class="chart-stage compact-chart"></chart-stage>`, `<button class="text-btn" type="button" data-view="selection">进入选择归因 ${icon("arrow-up-right", "sm")}</button>`, "chart-panel")}
        ${panel("评价链路状态", "沿用 v1.1.0 模块边界，当前只读消费", `<div class="module-link-list">${DATA.modules.map((item) => `<button type="button" class="module-link" data-action="module-detail" data-module="${esc(item.id)}"><span class="module-mark">${esc(item.id)}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></span>${badge(item.state, item.state === "研究输入" ? "success" : item.state === "禁用" ? "danger" : "warning")}${icon("chevron-right", "sm")}</button>`).join("")}</div>`, `<button class="text-btn" type="button" data-action="show-linkage">查看跨模块合同 ${icon("arrow-up-right", "sm")}</button>`, "module-panel")}
      </div>
      ${panel("当前研究边界", "原型数据不进入 v1.1.0 报告、仪表盘或行动链", `<div class="boundary-grid"><div><span>可计算</span><strong>时点暴露 · 结构趋势 · 研究夹具归因</strong></div><div><span>待补数据</span><strong>日 NAV · 交易现金流 · Wind 全市场导出</strong></div><div><span>禁用动作</span><strong>Action Request · 提醒 · 审批 · 待办 · 交易指令</strong></div></div>`, `<button class="text-btn" type="button" data-action="show-method">查看完整方法与缺口 ${icon("arrow-up-right", "sm")}</button>`, "boundary-panel")}
    </div>`;
  }

  function market() {
    const filtered = state.category === "全部" ? DATA.poolRows : DATA.poolRows.filter((row) => row.category === state.category);
    const marketSeries = DATA.marketSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    return `<div class="view-panel" data-screen-label="全市场与入池">
      ${pageHead("市场对比与入池", "按评价日固定市场同类基金池和分类版本，判断入池基金相对同类、前三分之一水平和基准的选择质量。", `<button class="btn" type="button" data-action="show-method">${icon("book-open", "sm")}方法口径</button><button class="btn primary" type="button" data-action="show-sources">${icon("database", "sm")}导出要求</button>`)}
      ${statusStrip()}
      <div class="toolbar"><div class="toolbar-group"><label>同类组<select data-action="category"><option>全部</option><option>中长期纯债</option><option>混合一级债基</option><option>混合二级债基</option><option>短期纯债</option></select></label><label>窗口<select><option>近 12 个月</option><option>近 36 个月</option><option>成立以来</option></select></label></div><div class="toolbar-note">点时市场同类基金池 · 清算/合并保留 · 分位仅描述</div></div>
      <div class="metric-ribbon"><div><span>入池</span><strong>15 / 15</strong><small>身份候选覆盖</small></div><div><span>同类样本</span><strong>1,284</strong><small>Wind 市场同类基金池</small></div><div><span>前三分之一差异</span><strong class="positive">-0.12%</strong><small>入池中位数相对水平</small></div><div><span>基准超额</span><strong class="positive">+0.82%</strong><small>入池中位数</small></div><div><span>存续状态</span><strong>含退出样本</strong><small>避免幸存者偏差</small></div></div>
      ${panel("入池基金 / 同类中位数 / 前三分之一 / 合同基准", "单位净值归一化为 100 · 断点表示缺失，不插值", `<div class="chart-meta">${chartLegend(marketSeries)}<span class="chart-asof">数据点 12 · 研究夹具</span></div><chart-stage id="market-chart" name="s005-market-comparison" zoom="x" class="chart-stage tall-chart"></chart-stage>`, `<button class="icon-btn" type="button" data-action="download-note" title="导出当前研究视图" aria-label="导出当前研究视图">${icon("download")}</button>`, "chart-panel")}
      ${panel("入池样本明细", "同时显示绝对表现、风险和入池/交易状态", `<div class="table-wrap"><table class="data-table"><thead><tr><th>候选基金</th><th>同类</th><th class="num">评价日净值</th><th class="num">基准超额</th><th class="num">波动</th><th class="num">最大回撤</th><th>交易状态</th><th>未选/入选理由</th></tr></thead><tbody>${filtered.map((row) => `<tr><td><strong>${esc(row.name)}</strong><small class="cell-note">${esc(row.name === "基金 A" ? "PRD-223C…A5FB" : "研究伪名")}</small></td><td>${esc(row.category)}</td><td class="num">${esc(row.nav)}</td><td class="num positive">${esc(row.excess)}</td><td class="num">${esc(row.vol)}</td><td class="num negative">${esc(row.drawdown)}</td><td>${badge(row.selected, row.selected === "已选" ? "success" : "neutral")}</td><td>${esc(row.reason)}</td></tr>`).join("")}</tbody></table></div>`, `<span class="table-footnote">${sourceNote("Wind 全量导出待接入 · 研究夹具")}</span>`, "flush-body")}
    </div>`;
  }

  function compliance() {
    return `<div class="view-panel" data-screen-label="准入合规">
      ${pageHead("准入合规", "将管理人事件、基金合同范围和最近可见穿透暴露分开核验，未知不等于通过。", `<button class="btn" type="button" data-action="show-sources">${icon("database", "sm")}事件源</button><button class="btn primary" type="button" data-action="show-method">${icon("sliders-horizontal", "sm")}规则口径</button>`)}
      ${statusStrip()}
      <div class="metric-ribbon compliance-ribbon"><div><span>范围状态</span><strong class="positive">12</strong><small>符合范围</small></div><div><span>需复核</span><strong class="warning-text">2</strong><small>事件/范围</small></div><div><span>无法判断</span><strong class="neutral-text">1</strong><small>穿透缺口</small></div><div><span>最新事件</span><strong>34 天</strong><small>研究夹具</small></div><div><span>不在允许范围</span><strong>权益类</strong><small>事实标记，不自动阻断</small></div></div>
      <div class="grid-2-1">
        ${panel("管理人和产品状态", "处罚、监管措施、自律处分、异常经营和合同范围按事件时间线存证", `<div class="compliance-timeline"><article class="timeline-item warning"><time>2026-05-18</time><div><strong>管理人甲（脱敏） · 监管措施</strong><p>原文已定位，影响期与整改状态待人工确认。</p></div>${badge("复核", "warning")}</article><article class="timeline-item neutral"><time>2026-06-30</time><div><strong>基金 C · 穿透数据缺失</strong><p>最近可见持仓超过新鲜度窗口，不能证明无权益暴露。</p></div>${badge("未知", "neutral")}</article><article class="timeline-item success"><time>2026-07-05</time><div><strong>基金 B · 管理人状态</strong><p>中基协名录、基金公司公告和 Wind 主数据映射一致。</p></div>${badge("通过", "success")}</article></div>`, `<button class="text-btn" type="button" data-action="show-sources">查看事件源清单 ${icon("arrow-up-right", "sm")}</button>`, "timeline-panel")}
        ${panel("合规风险灯", "准入合规独立于收益评分", lampGrid(), `<button class="text-btn" type="button" data-action="show-method">查看规则状态语义 ${icon("arrow-up-right", "sm")}</button>`, "lamp-panel")}
      </div>
      ${panel("入池持续跟踪", "每行保留主体映射、最近可见暴露、来源新鲜度和复核状态", `<div class="table-wrap"><table class="data-table compliance-table"><thead><tr><th>基金</th><th>同类</th><th>管理人</th><th>范围/暴露</th><th>最近事件</th><th>新鲜度</th><th>状态</th><th></th></tr></thead><tbody>${DATA.compliance.map((row,index) => `<tr><td><strong>${esc(row.name)}</strong><small class="cell-note">${esc(row.id)}</small></td><td>${esc(row.category)}</td><td>${esc(row.manager)}</td><td>${esc(row.exposure)}</td><td>${esc(row.event)}</td><td>${esc(row.freshness)}</td><td>${badge(row.status, row.tone)}</td><td><button class="icon-btn" type="button" data-action="compliance-detail" data-index="${index}" title="查看合规证据" aria-label="查看合规证据">${icon("file-search", "sm")}</button></td></tr>`).join("")}</tbody></table></div>`, `<span class="table-footnote">${sourceNote("证监会 / 中基协 / 基金公司公告 · 研究夹具")}</span>`, "flush-body")}
    </div>`;
  }

  function selection() {
    const selectionSeries = DATA.selectionSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    return `<div class="view-panel" data-screen-label="池内选择">
      ${pageHead("池内选择", "把“入池判断”和“实际交易选择”分开，按交易前可执行池做事后归因。", `<button class="btn" type="button" data-action="show-method">${icon("book-open", "sm")}选择归因方法</button><button class="btn primary" type="button" data-action="show-linkage">${icon("waypoints", "sm")}决策日志合同</button>`)}
      ${statusStrip()}
      <div class="metric-ribbon selection-ribbon"><div><span>可执行池</span><strong>11</strong><small>额度/流动性过滤后</small></div><div><span>已选交易</span><strong>4</strong><small>决策账快照</small></div><div><span>未选</span><strong>7</strong><small>原因码齐全</small></div><div><span>选择差异</span><strong class="positive">+0.42%</strong><small>12 月窗口</small></div><div><span>置信区间</span><strong>[-0.08, +0.79]</strong><small>block bootstrap</small></div></div>
      <div class="grid-2-1">
        ${panel("选中 vs 池内未选", "交易后窗口净值趋势 · 不把额度/现金约束造成的未选当负例", `<div class="chart-meta">${chartLegend(selectionSeries)}<span class="chart-asof">窗口：T+1 至完整持有期</span></div><chart-stage id="selection-chart" name="s005-selection-attribution" zoom="x" class="chart-stage tall-chart"></chart-stage>`, `<button class="icon-btn" type="button" data-action="download-note" title="下载选择差异视图" aria-label="下载选择差异视图">${icon("download")}</button>`, "chart-panel")}
        ${panel("未选原因", "结构化原因码用于公平反事实比较", `<div class="reason-list">${DATA.reasonRows.map((row) => `<div class="reason-row"><span>${esc(row.label)}</span><div><i style="--bar-width:${row.value * 16}%;--bar-color:${row.color}"></i></div><strong>${row.value}</strong></div>`).join("")}</div><div class="mini-callout">未选 ≠ 负面评价。先判断当日是否可交易，再进入选择差异。</div>`, `<button class="text-btn" type="button" data-action="show-method">查看筛选口径 ${icon("arrow-up-right", "sm")}</button>`, "reason-panel")}
      </div>
      ${panel("决策账快照", "交易前冻结候选集、选中标记、可执行约束和信息可得时点", `<div class="table-wrap"><table class="data-table"><thead><tr><th>决策日</th><th>可执行池</th><th>选中</th><th>未选</th><th>窗口</th><th>选择差异</th><th>信息时点</th></tr></thead><tbody><tr><td>2026-07-01</td><td>11 只</td><td>基金 A / C</td><td>基金 B / D / E…</td><td>T+20</td><td class="positive">+0.38%</td><td>交易前冻结</td></tr><tr><td>2026-06-01</td><td>10 只</td><td>基金 A</td><td>7 只</td><td>T+60</td><td class="positive">+0.51%</td><td>交易前冻结</td></tr><tr><td>2026-05-04</td><td>9 只</td><td>基金 C</td><td>6 只</td><td>完整持有</td><td class="neutral-text">无法归因</td><td>现金计划缺口</td></tr></tbody></table></div>`, `<span class="table-footnote">${sourceNote("研究夹具 · Wind 导出/内部决策日志待接入")}</span>`, "flush-body")}
    </div>`;
  }

  function trading() {
    return `<div class="view-panel" data-screen-label="交易与风险">
      ${pageHead("交易与风险", "日常监控观察风险变化，事后评价拆分择时、成本、市场和操作差异。", `<button class="btn" type="button" data-action="show-method">${icon("book-open", "sm")}归因方法</button><button class="btn primary" type="button" data-action="show-sources">${icon("database", "sm")}日频数据要求</button>`)}
      ${statusStrip()}
      <div class="grid-2-1">
        ${panel("已交易组合回撤", "研究夹具 · 日频 NAV 待接入 · 断点表示没有观测", `<div class="chart-meta"><span class="legend"><span><i style="--legend-color:#b4423d"></i>组合回撤</span><span><i style="--legend-color:#a36a2a"></i>市场状态</span></span><span class="chart-asof">最大回撤 -1.86% · 恢复期待确认</span></div><chart-stage id="drawdown-chart" name="s005-trading-drawdown" zoom="x" class="chart-stage tall-chart"></chart-stage>`, `<button class="icon-btn" type="button" data-action="download-note" title="下载回撤视图" aria-label="下载回撤视图">${icon("download")}</button>`, "chart-panel")}
        ${panel("风险与操作灯", "市场 beta、操作链路和数据质量并列呈现", `<div class="risk-matrix">${DATA.riskLamps.map((lamp) => `<div class="risk-matrix-row"><span>${esc(lamp.label)}</span>${badge(lamp.value, lamp.tone)}<small>${esc(lamp.detail)}</small></div>`).join("")}</div>`, `<button class="text-btn" type="button" data-action="show-method">查看红黄灰语义 ${icon("arrow-up-right", "sm")}</button>`, "lamp-panel")}
      </div>
      <div class="grid-2-1">
        ${panel("交易与执行记录", "基金使用下一可得 NAV；利率债使用中债/CFETS/Wind 同时点参考", `<div class="table-wrap"><table class="data-table"><thead><tr><th>日期</th><th>品种</th><th>动作</th><th>参考</th><th>滑点</th><th>持有期损益</th><th>状态</th></tr></thead><tbody>${DATA.tradeRows.map((row) => `<tr><td>${esc(row.date)}</td><td><strong>${esc(row.name)}</strong></td><td>${esc(row.action)}</td><td>${esc(row.ref)}</td><td class="num">${esc(row.slippage)}</td><td class="num ${row.pnl.startsWith("-") ? "negative" : "positive"}">${esc(row.pnl)}</td><td>${badge(row.status, row.tone)}</td></tr>`).join("")}</tbody></table></div>`, `<span class="table-footnote">${sourceNote("订单 / NAV / 估值 / 结算 · 研究夹具")}</span>`, "flush-body")}
        ${panel("市场状态", "宏观上下文只作解释层，不重复计入基金收益", `<div class="regime-list"><div><span>利率曲线</span><strong>平坦 → 轻微陡峭</strong><small>1Y / 10Y 变化待 Wind / 中债</small></div><div><span>流动性</span><strong>中性</strong><small>DR007 / 回购数据待接入</small></div><div><span>信用利差</span><strong>低波动</strong><small>中债 / 中证指数待核</small></div><div><span>操作事件</span><strong class="positive">0 条已确认失败</strong><small>净值修订 1 条待复核</small></div></div>`, `<button class="text-btn" type="button" data-action="show-sources">查看宏观数据源 ${icon("arrow-up-right", "sm")}</button>`, "regime-panel")}
      </div>
    </div>`;
  }

  function seriesToRows(values) {
    return values.map((value, index) => ({ date: monthsAt(index), value }));
  }

  function monthsAt(index) {
    return ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"][index];
  }

  function drawMultiLine(stage, allSeries, yLabel = "归一化值") {
    stage.ready.then(({ d3 }) => stage.draw(({ svg, width, height, view, layer, t, tips, esc: chartEsc }) => {
      const rows = allSeries.flatMap((item) => item.values);
      if (!rows.length) return stage.showEmpty("暂无可绘制数据");
      const margin = { top: 20, right: 22, bottom: 38, left: 48 };
      const xBase = d3.scaleUtc(d3.extent(rows, (row) => new Date(`${row.date}-01`)), [margin.left, width - margin.right]);
      const yBase = d3.scaleLinear([d3.min(rows, (row) => row.value) - 0.4, d3.max(rows, (row) => row.value) + 0.4], [height - margin.bottom, margin.top]).nice();
      const x = view.x(xBase);
      const y = view.y(yBase);
      const line = d3.line().x((row) => x(new Date(`${row.date}-01`))).y((row) => y(row.value)).curve(d3.curveMonotoneX);
      layer("grid").call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat("")).selectAll("line").attr("stroke", "#e4eaee");
      layer("x-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(Math.min(6, allSeries[0].values.length)).tickFormat(d3.timeFormat("%Y-%m"))).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      layer("y-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((value) => `${value.toFixed(1)}`)).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      layer("y-label").selectAll("text").data([yLabel]).join("text").attr("x", 8).attr("y", 14).attr("fill", "#84909b").attr("font-size", 10).text((value) => value);
      const paths = layer("series").selectAll("path").data(allSeries, (item) => item.key).join("path").attr("fill", "none").attr("stroke", (item) => item.color).attr("stroke-width", (item) => item.key === "pool" || item.key === "selected" ? 2.6 : 1.8).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("d", (item) => line(item.values));
      t(paths);
      const points = layer("points").selectAll("g").data(allSeries.flatMap((item) => item.values.map((row) => ({ ...row, key: item.key, label: item.label, color: item.color }))), (item) => `${item.key}-${item.date}`).join("g");
      points.attr("transform", (row) => `translate(${x(new Date(`${row.date}-01`))},${y(row.value)})`);
      points.selectAll("circle").data((row) => [row]).join("circle").attr("r", 2.3).attr("fill", (row) => row.color).attr("opacity", 0.75);
      tips(points, (row) => ({ html: `<strong>${chartEsc(row.label)}</strong><br>${chartEsc(row.date)} · ${Number(row.value).toFixed(2)}` }));
    }));
  }

  function drawDrawdown(stage) {
    stage.ready.then(({ d3 }) => stage.draw(({ svg, width, height, view, layer, t, tips, esc: chartEsc }) => {
      const rows = DATA.drawdownSeries.map((row) => ({ ...row, dateValue: new Date(row.date) }));
      const margin = { top: 20, right: 20, bottom: 38, left: 48 };
      const xBase = d3.scaleUtc(d3.extent(rows, (row) => row.dateValue), [margin.left, width - margin.right]);
      const yBase = d3.scaleLinear([-2.1, 0.15], [height - margin.bottom, margin.top]).nice();
      const x = view.x(xBase); const y = view.y(yBase);
      const line = d3.line().x((row) => x(row.dateValue)).y((row) => y(row.value)).curve(d3.curveMonotoneX);
      layer("grid").call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat("")).selectAll("line").attr("stroke", "#e4eaee");
      layer("x-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%m-%d"))).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      layer("y-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value.toFixed(1)}%`)).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      layer("zero").selectAll("line").data([0]).join("line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#9aa8b3").attr("stroke-dasharray", "4 4");
      const area = d3.area().x((row) => x(row.dateValue)).y0(y(0)).y1((row) => y(row.value)).curve(d3.curveMonotoneX);
      t(layer("area").selectAll("path").data([rows]).join("path").attr("d", area).attr("fill", "#f6dedd").attr("opacity", 0.7));
      t(layer("line").selectAll("path").data([rows]).join("path").attr("d", line).attr("fill", "none").attr("stroke", "#b4423d").attr("stroke-width", 2.6).attr("stroke-linecap", "round"));
      const marks = layer("marks").selectAll("circle").data(rows, (row) => row.date).join("circle").attr("cx", (row) => x(row.dateValue)).attr("cy", (row) => y(row.value)).attr("r", 3).attr("fill", "#b4423d");
      tips(marks, (row) => ({ html: `<strong>${chartEsc(row.date)}</strong><br>回撤 ${Number(row.value).toFixed(2)}%` }));
    }));
  }

  function setupCharts() {
    const marketSeries = DATA.marketSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    const selectionSeries = DATA.selectionSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
    ["overview-market-chart", "market-chart"].forEach((id) => { const stage = document.getElementById(id); if (stage) drawMultiLine(stage, marketSeries); });
    ["overview-selection-chart", "selection-chart"].forEach((id) => { const stage = document.getElementById(id); if (stage) drawMultiLine(stage, selectionSeries); });
    const drawdown = document.getElementById("drawdown-chart"); if (drawdown) drawDrawdown(drawdown);
  }

  function renderView() {
    const content = state.view === "market" ? market() : state.view === "compliance" ? compliance() : state.view === "selection" ? selection() : state.view === "trading" ? trading() : overview();
    app.innerHTML = `${header()}<main class="page">${tabs()}${content}</main>`;
    document.querySelectorAll("select[data-action='category']").forEach((select) => { select.value = state.category; });
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    setupCharts();
  }

  function showDrawer(title, body, footer = "") {
    state.drawer = { title, body, footer };
    const existing = document.querySelector(".drawer-backdrop");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><span class="eyebrow">S005 研究证据</span><h2>${esc(title)}</h2></div><button class="icon-btn" type="button" data-action="close-drawer" title="关闭" aria-label="关闭">${icon("x")}</button></header><div class="drawer-body">${body}</div><footer>${footer || `<button class="btn" type="button" data-action="close-drawer">关闭</button>`}</footer></aside></div>`);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function methodDrawer() {
    showDrawer("评价方法与降级", `<div class="drawer-section"><h3>四评价域 + 两横切域</h3><p>产品表现、财务公司实际结果、固定收益风险、管理运行质量，叠加持续合规和选择/执行。TWR 与 MWR 分账，Sharpe 与 Sortino 仅作风险调整收益指标，不单独决定结论。</p></div><div class="drawer-section"><h3>最小化状态</h3><p>不设置多级权限/安全门或自动阻断门；只显示符合范围、需复核、无法判断和不在允许范围。缺日 NAV、现金流、穿透或事件证据时诚实降级。</p></div><div class="drawer-section"><h3>当前证据</h3><dl class="drawer-dl"><div><dt>公式版本</dt><dd>${esc(DATA.meta.formulaVersion)}</dd></div><div><dt>基线</dt><dd>v1.1.0 / 回退 v1.0.3</dd></div><div><dt>研究命名空间</dt><dd>${esc(DATA.meta.namespace)}</dd></div></dl></div>`, `<button class="btn" type="button" data-action="close-drawer">关闭</button><button class="btn primary" type="button" data-action="show-sources">查看数据源</button>`);
  }

  function sourcesDrawer() {
    showDrawer("数据源状态", `<div class="source-drawer-list">${DATA.sources.map((source) => `<article><div><strong>${esc(source.label)}</strong><small>${esc(source.detail)}</small></div>${badge(source.state, source.state === "可核验" ? "success" : source.state === "待接入" ? "warning" : "neutral")}</article>`).join("")}</div><div class="drawer-note">Wind 导出属于许可数据；官方网页抓取必须限速、留 URL/读取日期/正文哈希并人工复核。抓取失败不得解释为“无处罚”或“无异常”。</div>`, `<button class="btn" type="button" data-action="close-drawer">关闭</button>`);
  }

  function linkageDrawer() {
    showDrawer("v1.1.0 模块关联", `<div class="linkage-drawer"><div class="linkage-base"><span class="base-mark">v1.1.0</span><div><strong>统一活动基线</strong><small>BSL-OFW-V110-94ABD0E991B7 · acceptanceReady=false</small></div></div>${DATA.modules.map((item) => `<article><span class="module-mark">${esc(item.id)}</span><div><strong>${esc(item.name)}</strong><p>${esc(item.detail)}</p></div>${badge(item.state, item.state === "研究输入" ? "success" : item.state === "禁用" ? "danger" : "warning")}<a class="icon-btn" href="${esc(item.href)}" target="_blank" rel="noopener" title="打开 ${esc(item.name)}参考入口" aria-label="打开 ${esc(item.name)}参考入口">${icon("external-link", "sm")}</a></article>`).join("")}<div class="drawer-note">S005 仅只读消费 v1.1.0 的 Shell、Foundation 和导航语汇；不复制四场景运行事实，不写回 M01-M06、M04 Action 或 M06 报告。</div></div>`, `<button class="btn" type="button" data-action="close-drawer">关闭</button><a class="btn primary" href="http://127.0.0.1:4342/dashboard/index.html" target="_blank" rel="noopener">${icon("external-link", "sm")}打开 v1.1.0 仪表盘</a>`);
  }

  function complianceDetail(index) {
    const row = DATA.compliance[index];
    if (!row) return;
    showDrawer(`${row.name} · 准入证据`, `<div class="drawer-section"><div class="drawer-status-line">${badge(row.status, row.tone)}<span>${esc(row.category)}</span></div><dl class="drawer-dl"><div><dt>管理人</dt><dd>${esc(row.manager)}</dd></div><div><dt>最近可见暴露</dt><dd>${esc(row.exposure)}</dd></div><div><dt>事件</dt><dd>${esc(row.event)}</dd></div><div><dt>数据新鲜度</dt><dd>${esc(row.freshness)}</dd></div><div><dt>规则状态</dt><dd>未知不等于通过</dd></div></dl></div><div class="drawer-note">该记录为研究夹具，正式结果必须回链证监会/中基协/基金公司原文、主体统一代码和读取哈希。</div>`, `<button class="btn" type="button" data-action="close-drawer">关闭</button>`);
  }

  function handleAction(event) {
    const target = event.target.closest("[data-action], [data-view]");
    if (!target) return;
    const view = target.dataset.view;
    if (view) { state.view = view; renderView(); return; }
    const action = target.dataset.action;
    if (action === "refresh") { state.refreshedAt = "刚刚"; toast("研究证据已重新读取（示意状态）"); return; }
    if (action === "show-method") { methodDrawer(); return; }
    if (action === "show-sources") { sourcesDrawer(); return; }
    if (action === "show-linkage") { linkageDrawer(); return; }
    if (action === "close-drawer") { document.querySelector(".drawer-backdrop")?.remove(); return; }
    if (action === "download-note") { toast("研究视图导出已禁用：当前数据为夹具"); return; }
    if (action === "module-detail") { linkageDrawer(); return; }
    if (action === "compliance-detail") { complianceDetail(Number(target.dataset.index)); return; }
  }

  app.addEventListener("click", handleAction);
  app.addEventListener("change", (event) => {
    const target = event.target.closest("select[data-action='category']");
    if (!target) return;
    state.category = target.value;
    renderView();
  });
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("drawer-backdrop")) document.querySelector(".drawer-backdrop")?.remove();
  });

  renderView();
})();
