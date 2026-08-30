(() => {
  "use strict";

  const DATA = window.S005_DATA;
  const app = document.getElementById("app");
  const state = { variant: new URLSearchParams(window.location.search).get("variant") || "a" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const icon = (name, size = "") => `<i data-lucide="${escapeHtml(name)}" class="icon ${size}"></i>`;
  const badge = (label, tone = "neutral") => `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
  const seriesToRows = (values) => values.map((value, index) => ({ date: ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"][index], value }));
  const marketSeries = () => DATA.marketSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
  const selectionSeries = () => DATA.selectionSeries.map((item) => ({ key: item.key, label: item.label, color: item.color, values: seriesToRows(item.values) }));
  const legend = (items) => `<div class="legend">${items.map((item) => `<span><i style="--legend-color:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>`;
  const source = (text) => `<small class="chart-note">${icon("database", "sm")}${escapeHtml(text)}</small>`;

  function topbar() {
    const options = [["a", "A · 运营总览", "layout-dashboard"], ["b", "B · 流程工作台", "route"], ["c", "C · 研究分析", "flask-conical"]];
    return `<header class="topbar"><div class="brand"><div class="brand-mark">${icon("activity", "lg")}</div><div><strong>智财问策 · S005 投后评价</strong><small>三套驾驶舱版本比较 · 研究夹具</small></div></div><nav class="variant-switcher" aria-label="驾驶舱版本">${options.map(([id,label,glyph]) => `<button type="button" class="${state.variant === id ? "active" : ""}" data-variant="${id}">${icon(glyph, "sm")}${label}</button>`).join("")}</nav><div class="base-meta"><span>活动基线 <b>v1.1.0</b></span><span>评价日 <b>${escapeHtml(DATA.meta.asOf)}</b></span></div></header>`;
  }

  function intro(title, subtitle) {
    return `<section class="intro"><div><p class="eyebrow">S005 · 研究驾驶舱设计版本</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="intro-actions"><button class="btn" type="button" data-action="method">${icon("book-open", "sm")}评价方法</button><button class="btn primary" type="button" data-action="sources">${icon("database", "sm")}数据源状态</button></div></section>`;
  }

  function statusRow() {
    return `<section class="status-row"><div><p class="eyebrow">研究上下文</p><strong>市场同类基金池 · ${escapeHtml(DATA.meta.scenarioVersion)}</strong><small>数据截至 ${escapeHtml(DATA.meta.asOf)} · ${escapeHtml(DATA.meta.sourceStatus)}</small></div><div class="status-cell"><span>分类输入</span><strong>Wind fund_type</strong></div><div class="status-cell"><span>比较基线</span><strong>合同基准 + 中位数 + 前三分之一</strong></div><div class="status-cell"><span>评价结果</span>${badge("部分评价", "warning")}</div><div class="status-cell"><span>行动链</span>${badge("一期不启用", "danger")}</div></section>`;
  }

  function kpis() {
    return `<section class="kpis">${DATA.kpis.map((item) => `<article class="kpi ${item.tone === "green" ? "green" : item.tone === "red" ? "red" : item.tone === "amber" ? "amber" : ""}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)} <small>${escapeHtml(item.unit)}</small></strong><small>${escapeHtml(item.note)}</small></article>`).join("")}</section>`;
  }

  function panel(title, subtitle, body, actions = "", extra = "") {
    return `<section class="panel ${extra}"><header class="panel-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>${actions}</header><div class="panel-body">${body}</div></section>`;
  }

  function riskLamps() {
    return `<div class="lamp-list">${DATA.riskLamps.map((item) => `<article class="lamp ${item.tone === "success" ? "green" : item.tone === "warning" ? "amber" : "gray"}"><div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div><small>${escapeHtml(item.detail)}</small></article>`).join("")}</div>`;
  }

  function table(rows = DATA.poolRows.slice(0, 5)) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>基金</th><th>分类</th><th class="num">评价日净值</th><th class="num">基准超额</th><th class="num">波动</th><th class="num">回撤</th><th>选择</th><th>原因</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>研究伪名</small></td><td>${escapeHtml(row.category)}</td><td class="num">${escapeHtml(row.nav)}</td><td class="num positive">${escapeHtml(row.excess)}</td><td class="num">${escapeHtml(row.vol)}</td><td class="num negative">${escapeHtml(row.drawdown)}</td><td>${badge(row.selected, row.selected === "已选" ? "success" : "neutral")}</td><td>${escapeHtml(row.reason)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function eventList() {
    return `<div class="evidence-list"><div class="evidence-item"><time>2026-05-18</time><div><strong>管理人甲 · 监管措施</strong><small>原文已定位，影响期和整改状态需复核</small></div></div><div class="evidence-item"><time>2026-06-30</time><div><strong>基金 C · 穿透资料缺失</strong><small>最近可见数据过期，显示无法判断</small></div></div><div class="evidence-item"><time>2026-07-05</time><div><strong>基金 B · 名录映射一致</strong><small>中基协、官网和 Wind 主数据一致</small></div></div></div>`;
  }

  function variantA() {
    const series = marketSeries();
    const selected = selectionSeries();
    return `<div class="a-grid">${intro("A · 运营总览型", "高密度看板：先看评价结果，再看市场对比、合规状态和交易风险。")}${statusRow()}${kpis()}<div class="a-main">${panel("市场同类基金池对比", "入池 / 同类中位数 / 同类前三分之一 / 合同基准", `<div class="chart-meta">${legend(series)}${source("Wind 导出待接入 · 月频研究夹具")}</div><chart-stage id="va-market" name="s005-variant-a-market" zoom="x" class="large"></chart-stage>`, `<button class="icon-btn" type="button" data-action="download" title="下载图表" aria-label="下载图表">${icon("download")}</button>`, "")}${panel("持续合规状态", "不设自动阻断，只显示事实和复核状态", riskLamps(), `<button class="btn" type="button" data-action="sources">${icon("file-search", "sm")}事件证据</button>`, "")}</div><div class="a-lower">${panel("池内选中 vs 未选", "交易后窗口选择差异", `<div class="chart-meta">${legend(selected)}${source("决策前冻结 · T+窗口")}</div><chart-stage id="va-selection" name="s005-variant-a-selection" zoom="x" class="small"></chart-stage>`, "", "")}${panel("交易与操作状态", "基金下一 NAV / 利率债同时点估值", table(DATA.poolRows.slice(0, 4)), `<button class="btn" type="button" data-action="method">${icon("arrow-up-right", "sm")}看归因</button>`, "flush")}</div><div class="a-boundary"><div><span>核心结论</span><strong>入池中位数高于同类中位数，低于前三分之一</strong></div><div><span>数据状态</span><strong>日 NAV / 现金流 / 事件映射待接入</strong></div><div><span>动作边界</span><strong>只读研究，不自动创建行动</strong></div></div></div>`;
  }

  function variantB() {
    const series = marketSeries();
    return `<div class="b-layout">${`<aside class="b-rail"><h2>S005 评价流程</h2>${[["1","来源与分类","Wind fund_type"],["2","市场同类基金池","中位数 / 前三分之一"],["3","持续合规","官方事件源"],["4","池内选择","选中 / 未选"],["5","交易与风险","NAV / 现金流"],["6","事后复盘","归因与证据"]].map(([n,label,note],i)=>`<button class="b-step ${i === 2 ? "active" : ""}" type="button" data-action="step"><span class="step-index">${n}</span><span><strong>${label}</strong><small>${note}</small></span></button>`).join("")}</aside>`}<main class="b-main">${intro("B · 流程工作台型", "按评价链路推进：每一步只展示当前需要确认的事实、图表和证据。")}${statusRow()}<section class="b-hero"><div><p class="eyebrow">当前阶段 · 03 / 06</p><h2>持续准入合规</h2><p>管理人事件、基金合同范围、最近可见穿透和数据新鲜度。</p></div><div class="b-stage-number">03</div></section><div class="b-split">${panel("合规事件时间线", "官方来源优先，未检索到不等于无事件", eventList(), `<button class="btn" type="button" data-action="sources">${icon("external-link", "sm")}打开来源</button>`, "")}${panel("阶段摘要", "只读事实状态", `<div class="analysis-cells"><div><span>符合范围</span><strong class="positive">12</strong><small>只</small></div><div><span>需复核</span><strong class="warning-text">2</strong><small>只</small></div><div><span>无法判断</span><strong class="muted">1</strong><small>只</small></div><div><span>不在范围</span><strong class="negative">0</strong><small>只</small></div></div><div class="c-note">一期不设自动阻断或权限门；复核人只确认事实和证据。</div>`, `<button class="btn primary" type="button" data-action="method">${icon("arrow-right", "sm")}下一步：池内选择</button>`, "")}</div>${panel("池内选择预览", "当前阶段只读查看后续选择差异，避免在合规证据未确认时先下结论", `<div class="chart-meta">${legend(series)}${source("研究夹具 · 评价日 2026-07-17")}</div><chart-stage id="vb-market" name="s005-variant-b-market" zoom="x"></chart-stage>`, `<button class="btn" type="button" data-action="method">${icon("info", "sm")}查看状态语义</button>`, "")}${panel("证据回链", "所有结果回到 M02 来源、M01 语义和 M06 只读消费", `<div class="source-stack">${DATA.modules.map((item) => `<div class="source-row"><div><strong>${escapeHtml(item.id)} · ${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)}</small></div>${badge(item.state, item.state === "研究输入" ? "success" : item.state === "禁用" ? "danger" : "warning")}</div>`).join("")}</div>`, `<button class="btn primary" type="button" data-action="sources">${icon("waypoints", "sm")}查看关联</button>`, "")}</main></div>`;
  }

  function variantC() {
    const series = marketSeries();
    const selected = selectionSeries();
    return `<div class="c-layout"><aside class="c-rail"><p class="eyebrow">研究分析版本</p><h2>横向比较参数</h2><div class="filter-block"><label>基金分类</label><select><option>全部债券型基金</option><option>短期纯债</option><option>中长期纯债</option><option>混合一级/二级</option></select></div><div class="filter-block"><label>评价窗口</label><select><option>近 12 个月</option><option>近 36 个月</option></select></div><div class="filter-block"><label>风险调整</label><select><option>Sharpe + Sortino</option><option>Calmar + 回撤</option><option>信息比率</option></select></div><div class="c-note">推荐：Sharpe 只作为风险调整收益子维度；至少 252 个有效日，正式横评建议 36 个月。</div><div class="c-note">市场同类基金池包含历史退出样本；缺口保留为断点，不前值填充。</div></aside><main class="c-main">${intro("C · 研究分析型", "图表优先：把基准、同类中位数、前三分之一、风险和选择差异放在同一研究视野。")}${statusRow()}${panel("全周期净值与比较基线", "同类中位数、同类前三分之一和合同基准并列", `<div class="chart-meta">${legend(series)}${source("Wind fund_type + 官方基准要素")}</div><chart-stage id="vc-market" name="s005-variant-c-market" zoom="x" class="large"></chart-stage>`, `<button class="icon-btn" type="button" data-action="download" title="下载研究图表" aria-label="下载研究图表">${icon("download")}</button>`, "")}<div class="c-chart-grid">${panel("选择差异", "已选交易 vs 池内未选", `<div class="chart-meta">${legend(selected)}${source("T+1/T+5/T+20/T+60")}</div><chart-stage id="vc-selection" name="s005-variant-c-selection" zoom="x" class="small"></chart-stage>`, "", "")}${panel("研究摘要", "风险调整收益与风险暴露分开", `<div class="c-analysis"><div class="analysis-cell"><span>Sharpe</span><strong>0.84</strong><small>研究夹具</small></div><div class="analysis-cell"><span>Sortino</span><strong>1.21</strong><small>下行风险</small></div><div class="analysis-cell"><span>最大回撤</span><strong class="negative">-1.86%</strong><small>恢复待核</small></div><div class="analysis-cell"><span>选择差异</span><strong class="positive">+0.42%</strong><small>置信区间含 0</small></div></div><div class="c-note">不设置总分门槛；风险灯、合规状态和置信度单独展示。</div>`, `<button class="btn" type="button" data-action="method">${icon("book-open", "sm")}公式说明</button>`, "")}</div>${panel("证据与数据源", "研究结果必须能回到 Wind 导出或官方原文", `<div class="source-stack">${DATA.sources.map((item) => `<div class="source-row"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div>${badge(item.state, item.state === "可核验" ? "success" : item.state === "待接入" ? "warning" : "neutral")}</div>`).join("")}</div>`, `<button class="btn primary" type="button" data-action="sources">${icon("file-search", "sm")}证据清单</button>`, "")}</main></div>`;
  }

  function drawLine(stageId, allSeries) {
    const stage = document.getElementById(stageId); if (!stage) return;
    stage.ready.then(({ d3 }) => stage.draw(({ width, height, view, layer, t, tips, esc }) => {
      const rows = allSeries.flatMap((item) => item.values);
      const margin = { top: 18, right: 18, bottom: 34, left: 44 };
      const xBase = d3.scaleUtc(d3.extent(rows, (row) => new Date(`${row.date}-01`)), [margin.left, width - margin.right]);
      const yBase = d3.scaleLinear([d3.min(rows, (row) => row.value) - .4, d3.max(rows, (row) => row.value) + .4], [height - margin.bottom, margin.top]).nice();
      const x = view.x(xBase); const y = view.y(yBase); const line = d3.line().x((row) => x(new Date(`${row.date}-01`))).y((row) => y(row.value)).curve(d3.curveMonotoneX);
      layer("grid").call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat("")).selectAll("line").attr("stroke", "#e4eaee");
      layer("x-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%Y-%m"))).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      layer("y-axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => v.toFixed(1))).selectAll("text").attr("fill", "#6b7b8b").attr("font-size", 10);
      const paths = layer("series").selectAll("path").data(allSeries, (item) => item.key).join("path").attr("fill", "none").attr("stroke", (item) => item.color).attr("stroke-width", (item) => item.key === "pool" || item.key === "selected" ? 2.6 : 1.7).attr("stroke-linecap", "round").attr("d", (item) => line(item.values));
      t(paths);
      const points = layer("points").selectAll("g").data(allSeries.flatMap((item) => item.values.map((row) => ({ ...row, key: item.key, label: item.label, color: item.color }))), (item) => `${item.key}-${item.date}`).join("g").attr("transform", (row) => `translate(${x(new Date(`${row.date}-01`))},${y(row.value)})`);
      points.selectAll("circle").data((row) => [row]).join("circle").attr("r", 2.2).attr("fill", (row) => row.color);
      tips(points, (row) => ({ html: `<strong>${esc(row.label)}</strong><br>${esc(row.date)} · ${Number(row.value).toFixed(2)}` }));
    }));
  }

  function toast(text) { const root = document.getElementById("toast-root"); root.innerHTML = `<div class="toast">${icon("info", "sm")}${escapeHtml(text)}</div>`; window.setTimeout(() => { root.innerHTML = ""; }, 2400); }

  function render() {
    const content = state.variant === "b" ? variantB() : state.variant === "c" ? variantC() : variantA();
    app.innerHTML = `${topbar()}<main class="canvas">${content}</main>`;
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    const series = marketSeries(); const selected = selectionSeries();
    if (state.variant === "a") { drawLine("va-market", series); drawLine("va-selection", selected); }
    if (state.variant === "b") drawLine("vb-market", series);
    if (state.variant === "c") { drawLine("vc-market", series); drawLine("vc-selection", selected); }
  }

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-variant], [data-action]"); if (!target) return;
    if (target.dataset.variant) { state.variant = target.dataset.variant; const url = new URL(window.location.href); url.searchParams.set("variant", state.variant); window.history.replaceState({}, "", url); render(); return; }
    if (target.dataset.action === "method") toast("方法：TWR/MWR 分账 · 中位数 + 前三分之一 · Sharpe/Sortino 并列");
    if (target.dataset.action === "sources") toast("来源：Wind 导出 + 证监会 / 中基协 / 中债 / 中证指数");
    if (target.dataset.action === "download") toast("研究夹具暂不导出生产文件");
    if (target.dataset.action === "step") toast("流程状态仅研究展示，不创建门禁或行动");
  });

  render();
})();
