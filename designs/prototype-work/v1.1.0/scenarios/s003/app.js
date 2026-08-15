(function () {
  "use strict";

  const DATA = window.S003Data;
  const STORE = window.S003Store;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function attr(value) { return esc(value); }

  function icon(name, className) { return DATA.icon(name, className); }

  function state() { return STORE.getState(); }

  function bundle() { return STORE.getBundle(); }

  function records() { return state().activeRun?.enterpriseResults || []; }

  function fixtureEnterprises() { return bundle()?.fixture?.enterprises || []; }

  function selectedEnterprise() {
    const id = state().selectedEnterpriseId || fixtureEnterprises()[0]?.enterpriseId;
    return fixtureEnterprises().find(function (item) { return item.enterpriseId === id; }) || fixtureEnterprises()[0] || null;
  }

  function selectedRecord() {
    const id = state().selectedEnterpriseId;
    return records().find(function (item) { return item.enterpriseId === id; }) || null;
  }

  function riskBadge(value, compact) {
    const key = DATA.riskKey(value);
    const meta = DATA.RISK_META[key] || DATA.RISK_META.UNKNOWN;
    return `<span class="risk-badge ${meta.className} ${compact ? "compact" : ""}"><i></i>${esc(meta.name)}</span>`;
  }

  function statusChip(label, tone) {
    return `<span class="status-chip ${tone || "neutral"}"><i></i>${esc(label)}</span>`;
  }

  function button(label, action, options) {
    const config = options || {};
    const classes = ["btn", config.primary ? "btn-primary" : "", config.ghost ? "btn-ghost" : "", config.danger ? "btn-danger" : "", config.small ? "btn-small" : "", config.disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-action="${attr(action)}" ${config.disabled ? "disabled" : ""}>${config.icon ? icon(config.icon, "sm") : ""}<span>${esc(label)}</span></button>`;
  }

  function displayContext() {
    const st = state();
    return st.historicalView?.context
      || st.historicalView?.checkpoint?.scenarioContext
      || st.activeRun?.scenarioContext
      || st.context
      || {};
  }

  function runLabel() {
    const context = displayContext();
    const runId = context.scenarioRunId || state().activeRun?.runId;
    return runId ? DATA.shortId(runId) : "待形成运行";
  }

  function activeModule() {
    return DATA.MODULES.find(function (item) { return item.id === state().activeModuleId; }) || DATA.MODULES.find(function (item) { return item.id === "M06"; });
  }

  function moduleNav() {
    const st = state();
    const items = [
      { id: "home", name: "首页", icon: "home", view: "overview", note: "S003 场景首页" },
      ...DATA.MODULES
    ];
    return `<aside class="global-nav ${st.navCollapsed ? "is-collapsed" : ""} ${st.mobileNavOpen ? "is-mobile-open" : ""}">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true"><span>OFW</span></span>
        <div class="brand-copy"><strong>${esc(DATA.BRAND.zh)}</strong><small>${esc(DATA.BRAND.en)}</small></div>
        <button class="nav-collapse" type="button" data-action="toggle-nav" aria-label="${st.navCollapsed ? "展开主菜单" : "收起主菜单"}">${icon(st.navCollapsed ? "chevronRight" : "chevronDown", "sm")}</button>
      </div>
      <div class="nav-context"><span>当前场景</span><strong>${esc(DATA.BRAND.scene)}</strong><small>独立运行空间 · v1.1.0</small></div>
      <nav class="primary-nav" aria-label="平台一级导航">
        ${items.map(function (item) {
          const isActive = item.id === st.activeModuleId;
          if (item.id === "home") {
            return `<button class="nav-item home-item" type="button" data-action="view-overview" title="${attr(item.note)}">${icon(item.icon)}<span>${esc(item.name)}</span></button>`;
          }
          return `<button class="nav-item ${isActive ? "active" : ""}" type="button" data-module-id="${attr(item.id)}" title="${attr(`${item.name} · ${item.note}`)}">
            ${icon(item.icon)}<span>${esc(item.name)}</span>${isActive ? '<i class="nav-state active-dot"></i>' : ""}
          </button>`;
        }).join("")}
      </nav>
      <div class="nav-foot">
        <div class="nav-foot-line"><span class="connection-dot"></span><strong>场景隔离已启用</strong></div>
        <p>父基线 v1.0.3 · 不改写 S001</p>
        <small>${esc(runLabel())}</small>
      </div>
    </aside>`;
  }

  function topbar() {
    const st = state();
    const context = displayContext();
    const module = activeModule();
    const runStatus = st.runStatus === "succeeded" ? statusChip("运行成功", "success") : st.runStatus === "running" ? statusChip("重评中", "info") : st.runStatus === "failed" ? statusChip("运行失败", "danger") : statusChip("待运行", "neutral");
    const configStatus = st.configStatus === "published" ? statusChip(`模型 ${st.publishedModel?.packageVersion || "—"} 已发布`, "success") : st.configStatus === "validated" ? statusChip("配置已校验", "warning") : statusChip("配置 Draft", "warning");
    const historical = st.historicalView;
    return `<header class="global-topbar">
      <div class="topbar-left">
        <button class="mobile-menu-button" type="button" data-action="toggle-mobile-nav" aria-label="打开导航">${icon("menu")}</button>
        <button class="back-button" type="button" data-action="go-back" title="返回上一级">${icon("back", "sm")}</button>
        <div class="breadcrumb"><span>${esc(`${module?.id || "M06"} ${module?.name || "报告中心"}`)}</span><b>/</b><strong>S003 债务风险监测</strong></div>
      </div>
      <div class="topbar-context">
        <span class="context-label">${historical ? "历史快照只读" : "当前运行"}</span>
        <strong>${esc(runLabel())}</strong>
        <small>${esc(context.scenarioVersion || "S003-v1")} · ${esc(bundle()?.fixture?.assessmentAt || "2025-12-31")}</small>
      </div>
      <div class="topbar-actions">
        ${configStatus}${runStatus}
        <button class="top-action-button" type="button" data-action="quick-rerun" ${historical || st.runStatus === "running" ? "disabled" : ""}>${icon("refresh", "sm")}<span>快速重跑</span></button>
        <button class="top-action-button" type="button" data-action="print-report">${icon("print", "sm")}<span>打印报告</span></button>
        <span class="avatar" title="业务 Owner：财务公司">财</span>
      </div>
    </header>`;
  }

  function scenarioTabs() {
    const st = state();
    return `<div class="scene-tabs" role="tablist" aria-label="S003 场景工作台视图">
      ${DATA.VIEWS.filter(function (view) { return view.inTabs !== false; }).map(function (view) {
        return `<button type="button" role="tab" aria-selected="${st.currentView === view.id}" class="scene-tab ${st.currentView === view.id ? "active" : ""}" data-view="${view.id}">${icon(view.icon, "sm")}<span>${esc(view.label)}</span></button>`;
      }).join("")}
    </div>`;
  }

  function identityRail() {
    const st = state();
    const b = bundle();
    const context = displayContext();
    const baseline = b?.manifest?.baseline || {};
    const dataAsset = b?.formalDataAsset || {};
    const input = st.factorInputSnapshot || b?.humanInputSnapshot || {};
    const pointer = b?.publishedPointer || {};
    const assessmentAt = st.activeRun?.assessmentAt || b?.fixture?.assessmentAt || b?.dataContract?.assessmentAt;
    return `<section class="identity-rail" aria-label="S003 持续场景身份">
      <div><span>scenarioId</span><strong>${esc(context.scenarioId || "S003")}</strong></div>
      <div><span>scenarioVersion</span><strong>${esc(context.scenarioVersion || "S003-v1")}</strong></div>
      <div class="identity-run"><span>scenarioRunId</span><strong title="${attr(context.scenarioRunId || "")}">${esc(context.scenarioRunId || "待形成")}</strong></div>
      <div><span>baselineVersion</span><strong>${esc(baseline.baselineVersion || "1.0.3")}</strong></div>
      <div class="identity-baseline"><span>baselineSnapshotId</span><strong title="${attr(baseline.baselineSnapshotId || "")}">${esc(DATA.shortId(baseline.baselineSnapshotId || "—", 18, 6))}</strong></div>
      <div><span>Published 模型</span><strong title="${attr(pointer.pointerId || "")}">${esc(st.publishedModel?.packageVersion || "—")}</strong></div>
      <div class="identity-input"><span>Published 输入</span><strong title="${attr(input.snapshotId || "")}">${esc(DATA.shortId(input.snapshotId || "—", 17, 6))}</strong></div>
      <div class="identity-asset"><span>数据资产</span><strong title="${attr(dataAsset.dataAssetId || "")}">${esc(DATA.shortId(dataAsset.dataAssetId || "—", 20, 6))}</strong></div>
      <div><span>assessmentAt</span><strong>${esc(assessmentAt || "—")}</strong></div>
    </section>`;
  }

  function pageHeader(title, eyebrow, description, actions) {
    return `<div class="page-header">
      <div><span class="eyebrow">${esc(eyebrow || "S003 场景工作台")}</span><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>
      <div class="page-actions">${actions || ""}</div>
    </div>`;
  }

  function infoStrip() {
    const st = state();
    const b = bundle();
    const quality = b?.qualityResult;
    return `<div class="info-strip">
      <div class="info-strip-main">${icon("shield", "sm")}<span><strong>场景边界：</strong>评分、因子系数、权重和风险阈值均由 M01 Published 结果提供；M02 只负责数据与人工输入质量。</span></div>
      <div class="info-strip-meta"><span>${esc(b?.fixture?.currency || "CNY")}</span><b>·</b><span>${esc(b?.fixture?.amountUnit || "元")}</span><b>·</b><span>质量 ${quality?.status === "passed" ? "通过" : "待核"}</span></div>
    </div>`;
  }

  function renderShell(content) {
    const st = state();
    return `<div class="platform-shell ${st.navCollapsed ? "nav-collapsed" : ""}">${moduleNav()}<section class="shell-main">${topbar()}<main class="route-stage"><div class="scene-frame">${scenarioTabs()}${identityRail()}${infoStrip()}${content}</div></main></section></div>`;
  }

  function renderBoot() {
    const st = state();
    if (st.fatalError) {
      return `<div class="fatal-screen"><div class="fatal-card">${icon("alert", "lg")}<h1>S003 场景资料未能完整装载</h1><p>${esc(st.fatalError)}</p><small>请确认工作台从 v1.1.0 场景目录通过 HTTP 服务打开。</small></div></div>`;
    }
    return `<div class="boot-screen"><span class="boot-mark">OFW</span><div><strong>正在装载 S003 场景工作台</strong><small>读取场景身份、数据夹具与 Published 模型包…</small></div></div>`;
  }

  function kpiCard(label, value, note, tone, iconName) {
    return `<article class="kpi-card ${tone || ""}"><div class="kpi-top"><span class="kpi-icon">${icon(iconName || "chart", "sm")}</span><span class="kpi-label">${esc(label)}</span></div><strong class="kpi-value">${esc(value)}</strong><small>${esc(note)}</small></article>`;
  }

  function riskCounts() {
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    records().forEach(function (record) { if (counts[record.riskTier] !== undefined) counts[record.riskTier] += 1; });
    return counts;
  }

  function renderRiskDistribution(counts, total) {
    return `<div class="risk-distribution">
      ${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) {
        const meta = DATA.RISK_META[key];
        const count = counts[key] || 0;
        const width = total ? Math.max(2, (count / total) * 100) : 0;
        return `<div class="risk-row"><div class="risk-row-label">${riskBadge(key, true)}<strong>${count}</strong><span>家</span></div><div class="risk-track"><i class="${meta.className}" style="width:${width}%"></i></div><small>${esc(meta.description)}</small></div>`;
      }).join("")}
    </div>`;
  }

  function publishedRiskRangeLabel(tier) {
    if (!tier) return "—";
    if (tier.maxExclusive == null) return `≥ ${DATA.formatScore(tier.minInclusive)}`;
    return `${DATA.formatScore(tier.minInclusive)} ≤ 分值 < ${DATA.formatScore(tier.maxExclusive)}`;
  }

  function renderPublishedThresholds() {
    const tiers = state().publishedModel?.riskTiers || [];
    return `<div class="published-thresholds" aria-label="当前 Published 风险分档">
      ${tiers.map(function (tier) { return `<div class="threshold-item ${DATA.RISK_META[tier.tierId]?.className || "risk-unknown"}">${riskBadge(tier.tierId, true)}<strong>${esc(publishedRiskRangeLabel(tier))}</strong></div>`; }).join("")}
    </div>`;
  }

  function renderOverviewEnterpriseTable() {
    const list = topRiskRows(10);
    if (!list.length) return `<div class="empty-state compact">${icon("info", "sm")}<span>当前没有可展示的企业评分结果。</span></div>`;
    return `<div class="data-table-wrap"><table class="data-table overview-enterprise-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th class="num">原始分</th><th class="num">调节合计</th><th class="num">综合分</th><th>风险等级</th><th>报告</th></tr></thead><tbody>${list.map(function (record) { return `<tr><td><button class="company-link" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.enterpriseId)}</small></button></td><td><strong class="cell-primary">${esc(record.sector || "—")}</strong><small class="cell-secondary">${esc(record.category || "—")}</small></td><td class="num mono">${record.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</td><td class="num mono ${Number(record.factorSum) < 0 ? "negative" : ""}">${record.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</td><td class="num"><strong class="score-cell">${DATA.formatScore(record.finalScore)}</strong></td><td>${riskBadge(record.riskTier, true)}</td><td><button class="table-action" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}">${icon("file", "sm")}查看</button></td></tr>`; }).join("")}</tbody></table></div>`;
  }

  function sectorSummary() {
    const map = {};
    records().forEach(function (record) {
      const key = record.category || "未分类";
      map[key] ||= { total: 0, scores: [], counts: { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 } };
      map[key].total += 1;
      if (Number.isFinite(Number(record.finalScore))) map[key].scores.push(Number(record.finalScore));
      if (map[key].counts[record.riskTier] !== undefined) map[key].counts[record.riskTier] += 1;
    });
    if (!Object.keys(map).length) {
      fixtureEnterprises().forEach(function (enterprise) { map[enterprise.category] ||= { total: 0, scores: [], counts: { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 } }; map[enterprise.category].total += 1; });
    }
    return Object.entries(map).map(function ([name, item]) {
      const avg = item.scores.length ? item.scores.reduce((a, b) => a + b, 0) / item.scores.length : null;
      return `<article class="sector-card"><div class="sector-head"><div><strong>${esc(name)}</strong><small>${item.total} 家企业</small></div><span>${avg == null ? "待评估" : `${DATA.formatScore(avg)} 分均值`}</span></div><div class="sector-bars">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<i class="${DATA.RISK_META[key].className}" style="width:${item.total ? Math.max(2, item.counts[key] / item.total * 100) : 0}%" title="${DATA.RISK_META[key].name} ${item.counts[key]} 家"></i>`; }).join("")}</div><div class="sector-foot"><span>绿 ${item.counts.GREEN}</span><span>黄 ${item.counts.YELLOW}</span><span>红 ${item.counts.RED}</span><span>黑 ${item.counts.BLACK}</span></div></article>`;
    }).join("");
  }

  function processRail() {
    const st = state();
    const steps = [
      ["数据接入", "M02", "database", true],
      ["模型发布", "M01", "network", st.configStatus === "published"],
      ["权威评估", "C035", "shield", Boolean(st.activeRun)],
      ["报告生成", "M06", "file", Boolean(st.activeRun)],
      ["人工确认", "M04", "target", st.decisions.length > 0]
    ];
    return `<div class="process-rail">${steps.map(function (step, index) { return `<div class="process-step ${step[3] ? "done" : "pending"}"><span class="process-index">${step[3] ? icon("check", "sm") : String(index + 1).padStart(2, "0")}</span><div><strong>${esc(step[0])}</strong><small>${esc(step[1])}</small></div>${index < steps.length - 1 ? '<b class="process-line"></b>' : ""}</div>`; }).join("")}</div>`;
  }

  function topRiskRows(limit) {
    const list = records().slice().sort(function (a, b) {
      const rank = DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier);
      return rank || (Number(a.finalScore ?? Infinity) - Number(b.finalScore ?? Infinity));
    });
    return list.slice(0, limit || 5);
  }

  function renderRiskRows(list, options) {
    const config = options || {};
    if (!list.length) return `<div class="empty-state compact">${icon("info", "sm")}<span>${esc(config.empty || "暂无可展示的评估结果")}</span></div>`;
    return `<div class="risk-list">${list.map(function (record) {
      const factorHits = record.factors?.filter(function (factor) { return ["重大诉讼", "当月资金余缺预警"].includes(factor.value); }) || [];
      return `<button class="risk-list-row" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><span class="risk-list-rank">${riskBadge(record.riskTier, true)}</span><span class="risk-list-main"><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.category)} · ${factorHits.length ? `重大因子 ${factorHits.length} 项` : "无重大因子命中"}</small></span><span class="risk-list-score">${record.finalScore == null ? "—" : DATA.formatScore(record.finalScore)}<small>综合分</small></span>${icon("chevronRight", "sm")}</button>`;
    }).join("")}</div>`;
  }

  function resourceRow(label, resourceId, version, status, owner, detail) {
    return `<div class="resource-row"><div><strong>${esc(label)}</strong><small>${esc(owner || "平台场景包")}</small></div><code title="${attr(resourceId || "")}">${esc(resourceId || "—")}</code><span>${esc(version || "—")}</span>${statusChip(status || "已形成", status === "不可消费" ? "warning" : "success")}<small class="resource-detail">${esc(detail || "")}</small></div>`;
  }

  function renderDataQuality() {
    const b = bundle();
    const contract = b?.dataContract || {};
    const source = b?.sourceAsset || {};
    const pipeline = b?.pipelineRun || {};
    const formal = b?.formalDataAsset || {};
    const input = b?.humanInputSnapshot || {};
    const quality = b?.qualityResult || {};
    const members = source.logicalMembers || [];
    return `${pageHeader("数据与人工输入质量", "M02 · 场景适配视图", "在 S003 场景壳内查看数据来源、两个逻辑成员、人工输入和质量结果；本视图不执行评分、不维护模型参数。", `${button("填写企业因子", "view-factor-entry", { primary: true, icon: "edit" })}${button("查看运行", "view-runs", { ghost: true, icon: "refresh" })}`)}
      <div class="module-owner-strip"><span class="module-owner-icon">${icon("database", "sm")}</span><div><strong>Owner：${esc(contract.moduleOwner || "数据工程")}</strong><small>业务输入 Owner：${esc(contract.businessInputOwner || "财务公司")} · C031 数据契约 · ${esc(contract.contractVersion || "1.1.0")}</small></div>${statusChip(quality.status === "passed" ? "质量通过" : "待核", quality.status === "passed" ? "success" : "warning")}</div>
      <section class="module-stage-grid"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">输入上下文</span><h3>权威数据夹具与评估口径</h3></div>${statusChip("仅正式候选可消费", "info")}</div><div class="member-cards">${members.map(function (member) { return `<article class="member-card"><span class="member-icon">${icon(member.name === "调节因子" ? "sliders" : "table", "sm")}</span><strong>${esc(member.name)}</strong><small>${esc(member.range)} · ${member.rowCount} 家 · ${member.fieldCount} 字段</small></article>`; }).join("")}</div><dl class="contract-facts"><div><dt>评估时点</dt><dd>${esc(contract.assessmentAt || "2025-12-31")}</dd></div><div><dt>币种 / 金额单位</dt><dd>${esc(contract.currency || "CNY")} / ${esc(contract.amountUnit || "元")}</dd></div><div><dt>当前期列</dt><dd><code>${esc(contract.currentPeriodColumn || "I")}</code></dd></div><div><dt>上期列</dt><dd><code>${esc(contract.priorPeriodColumn || "AA")}</code></dd></div><div><dt>来源文件</dt><dd title="${attr(source.fileName || "")}">${esc(source.fileName || "企业债务风险评估模版_S003兼容版.xlsx")}</dd></div><div><dt>正式候选</dt><dd title="${attr(formal.dataAssetId || "")}">${esc(formal.dataAssetId || "—")}</dd></div></dl></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">M02 资源链</span><h3>从来源到正式候选</h3></div><span class="panel-note">不得在此计算评分</span></div><div class="resource-list">${resourceRow("来源工作簿", source.sourceId, "1.0.0", "已验证", "M02 数据工程", `sha256 ${String(source.sourceSha256 || "").slice(0, 12)}…`)}${resourceRow("人工输入快照", input.snapshotId, input.snapshotVersion, input.status === "published-input" ? "已发布" : input.status, "M02 数据工程", `${input.enterpriseCount || 21} 家 · ${input.factorCount || 6} 项 · 无复核人`)}${resourceRow("管道运行", pipeline.pipelineRunId, "1.0.0", pipeline.status === "succeeded" ? "运行成功" : pipeline.status, "M02 数据工程", `输入 ${pipeline.inputSourceId || "—"}`)}${resourceRow("正式候选数据资产", formal.dataAssetId, formal.dataAssetVersion, formal.status === "quality-passed-candidate" ? "候选已形成" : formal.status, "M02 数据工程", `${formal.enterpriseCount || 21} 家 · 仅作为后续 Published 输入`)}${resourceRow("兼容性夹具", contract.forbiddenCompatibilityAsset?.sha256, "—", "不可消费", "M02 数据工程", "仅权威夹具，不得原地提升")}</div></article></section>
      <section class="module-stage-grid lower"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">质量职责</span><h3>通过项与排除项</h3></div>${statusChip("M02 边界", "success")}</div><div class="quality-columns"><div><strong>本次已校验</strong><ul>${(quality.checks || []).slice(0, 8).map(function (check) { return `<li><span class="quality-dot"></span><span>${esc(check.evidence || check.checkId || "质量检查")}</span></li>`; }).join("")}</ul></div><div><strong>明确不归 M02</strong><ul>${(contract.qualityDoesNotOwn || quality.explicitlyExcludedChecks || []).map(function (item) { return `<li><span class="quality-dot muted"></span><span>${esc(item)}</span></li>`; }).join("")}</ul></div></div></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">下一步</span><h3>进入场景内消费链</h3></div></div><div class="handoff-mini"><div><span class="handoff-index">01</span><div><strong>企业因子填报</strong><small>在线编辑并形成新的人工输入快照</small></div></div><div><span class="handoff-index">02</span><div><strong>Published 模型</strong><small>由 M01 校验并切换权威指针</small></div></div><div><span class="handoff-index">03</span><div><strong>快速重评 / 报告</strong><small>沿用当前场景运行身份链路</small></div></div></div></article></section>`;
  }

  function renderAgentBoundary() {
    const position = bundle()?.agentPosition || {};
    return `${pageHeader("Agent 能力边界", "M05 · 场景适配视图", "一期不建设 S003 专属 Agent；本视图把允许复用与明确禁止的动作放在同一场景上下文中，避免用户误以为 Agent 参与评分或业务写入。", button("返回场景总览", "view-overview", { primary: true, icon: "back" }))}
      <div class="module-owner-strip"><span class="module-owner-icon">${icon("bot", "sm")}</span><div><strong>Owner：${esc(position.moduleOwner || "Agent 应用")}</strong><small>状态：${esc(position.status || "verified-not-required-for-phase-1")} · 当前场景保留平台公共能力边界</small></div>${statusChip(position.dedicatedAgent ? "已配置专属 Agent" : "一期无专属 Agent", position.dedicatedAgent ? "warning" : "success")}</div>
      <section class="agent-boundary-grid"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">M05 运行定位</span><h3>Agent 不进入评分闭环</h3></div>${statusChip("边界已锁定", "success")}</div><div class="agent-status-card"><span class="agent-status-icon">${icon("shield", "lg")}</span><div><strong>${position.dedicatedAgent ? "当前存在专属 Agent" : "当前不存在 S003 专属 Agent"}</strong><p>${esc(position.reason || "S003 一期为确定性评估、报告和通用决策闭环，不需要 Agent 参与评分或业务写入。")}</p></div></div><dl class="contract-facts"><div><dt>评分输入</dt><dd>Published 本体 / C035 结果</dd></div><div><dt>报告输入</dt><dd>正式运行证据与 Published 事实</dd></div><div><dt>决策入口</dt><dd>人工确认后 Action Request</dd></div><div><dt>Agent 写入</dt><dd>禁止</dd></div></dl></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">允许复用</span><h3>仅作为伴读边界</h3></div></div><ul class="boundary-list allowed">${(position.allowedReuse || []).map(function (item) { return `<li><span>${icon("check", "sm")}</span><div><strong>${esc(item)}</strong><small>后续如显式进入，仍必须消费当前 Published 结果</small></div></li>`; }).join("") || `<li><span>${icon("check", "sm")}</span><div><strong>平台现有报告伴读入口</strong><small>一期不在本场景启动</small></div></li>`}</ul></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">禁止越界</span><h3>四项强制阻断</h3></div>${statusChip("不可绕过", "danger")}</div><ul class="boundary-list forbidden">${(position.forbidden || ["重算 C035 结果", "修改模型配置", "自动创建 Action Request", "替代人工确认"]).map(function (item) { return `<li><span>${icon("close", "sm")}</span><div><strong>${esc(item)}</strong><small>由 M01/M04 或人工确认流程负责</small></div></li>`; }).join("")}</ul></article></section>
      <section class="panel handoff-chain-panel"><div class="panel-heading"><div><span class="eyebrow">统一场景链路</span><h3>Agent 位于链路之外</h3></div><small>所有节点仍在 S003 壳内可追溯</small></div><div class="handoff-chain"><div class="handoff-node"><span>M02</span><strong>数据与输入</strong><small>质量通过</small></div><b>→</b><div class="handoff-node"><span>M01</span><strong>Published 模型</strong><small>${esc(state().publishedModel?.packageVersion || "1.0.1")}</small></div><b>→</b><div class="handoff-node"><span>C035</span><strong>权威评估</strong><small>${esc(DATA.shortId(state().activeRun?.runId || "待运行"))}</small></div><b>→</b><div class="handoff-node"><span>M06</span><strong>报告 / 工作台</strong><small>当前消费</small></div></div></section>`;
  }

  function renderOverview() {
    const st = state();
    const b = bundle();
    const total = b?.fixture?.enterpriseCount || fixtureEnterprises().length;
    const counts = riskCounts();
    const scored = records().filter(function (record) { return Number.isFinite(Number(record.finalScore)); });
    const avg = scored.length ? scored.reduce(function (sum, record) { return sum + Number(record.finalScore); }, 0) / scored.length : null;
    const highRisk = records().filter(function (record) { return ["YELLOW", "RED", "BLACK"].includes(record.riskTier); });
    const quality = b?.qualityResult;
    return `${pageHeader("债务风险监测总览", "S003 · M06 场景工作台", "面向集团债务风险管理人员，串起因子填报、模型发布、快速重评、企业报告与通用决策确认。", `${button("进入企业明细", "view-enterprises", { primary: true, icon: "building" })}${button("填写企业因子", "view-factor-entry", { ghost: true, icon: "edit" })}`)}
      <section class="hero-band"><div><span class="hero-kicker">${esc(DATA.BRAND.scene)}</span><h2>集团债务风险<br><em>可解释、可追溯</em>地监测</h2><p>当前评估时点 <strong>${esc(b?.fixture?.assessmentAt || "2025-12-31")}</strong>，覆盖 <strong>${total}</strong> 家企业；所有结论携带场景身份、模型版本与数据资产引用。</p><div class="hero-meta"><span>${icon("shield", "sm")}父基线 v1.0.3</span><span>${icon("database", "sm")}财务数据 + 调节因子</span><span>${icon("lock", "sm")}运行隔离</span></div></div><div class="hero-score"><span>本轮成功运行</span><strong>${st.activeRun ? esc(DATA.shortId(st.activeRun.runId)) : "—"}</strong><small>${st.activeRun ? `${DATA.formatDateTime(st.activeRun.evaluatedAt)} · ${st.activeRun.modelVersion}` : "等待 M01 评估结果"}</small></div></section>
      ${!st.activeRun ? `<div class="callout warning">${icon("alert", "sm")}<div><strong>当前尚无可消费的 Published 风险事实</strong><p>工作台已完成场景数据与配置装载；待 M01 评分引擎返回权威评估结果后，企业评分、报告和问数将自动可用。</p></div></div>` : ""}
      <section class="kpi-grid">${kpiCard("企业总数", total, "财务数据成员已接入", "blue", "building")}${kpiCard("黄 / 红 / 黑", `${counts.YELLOW} / ${counts.RED} / ${counts.BLACK}`, st.activeRun ? "需关注企业" : "待 M01 评估", "risk", "alert")}${kpiCard("集团平均评分", avg == null ? "—" : DATA.formatScore(avg), st.activeRun ? "基于当前成功运行" : "不在前端自行计算", "violet", "chart")}${kpiCard("数据质量", quality?.status === "passed" ? "通过" : "待核", quality?.qualityResultId || "M02 质量结果", "green", "shield")}</section>
      <section class="overview-grid"><article class="panel risk-panel"><div class="panel-heading"><div><span class="eyebrow">风险分布</span><h3>四档风险分布</h3></div><span class="panel-note">${st.activeRun ? `共 ${scored.length} 家已评分` : "等待权威结果"}</span></div>${renderPublishedThresholds()}${renderRiskDistribution(counts, total)}</article><article class="panel sector-panel"><div class="panel-heading"><div><span class="eyebrow">产业板块</span><h3>板块监测</h3></div><button class="link-button" type="button" data-action="view-enterprises">查看全部 ${icon("chevronRight", "sm")}</button></div><div class="sector-grid">${sectorSummary()}</div></article></section>
      <section class="overview-grid lower"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">重点企业</span><h3>需要优先关注</h3></div><button class="link-button" type="button" data-action="view-enterprises">进入明细 ${icon("chevronRight", "sm")}</button></div>${renderRiskRows(topRiskRows(5), { empty: "当前没有风险评分明细。" })}</article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">运行链路</span><h3>场景工作台进度</h3></div><button class="link-button" type="button" data-action="view-checkpoints">查看快照 ${icon("chevronRight", "sm")}</button></div>${processRail()}<div class="mini-contracts"><span>数据资产 <b>${esc(b?.formalDataAsset?.dataAssetId || "S003-T007-FORMAL-CANDIDATE")}</b></span><span>人工输入 <b>${esc(st.factorInputSnapshot?.snapshotId || "S003-T053-INPUT-20251231-v1")}</b></span></div></article></section>
      <section class="panel table-panel overview-enterprise-panel"><div class="panel-heading"><div><span class="eyebrow">企业评分明细</span><h3>风险优先的前 10 家企业</h3></div><button class="link-button" type="button" data-action="view-enterprises">筛选、排序与查看全部 ${icon("chevronRight", "sm")}</button></div>${renderOverviewEnterpriseTable()}<footer class="table-footer"><span>${icon("shield", "sm")}所有评分、分档和报告均来自当前 Published 模型与正式运行证据。</span><strong>${esc(st.activeRun?.runId || "待形成运行")}</strong></footer></section>`;
  }

  function enterpriseRows() {
    const st = state();
    const resultMap = Object.fromEntries(records().map(function (record) { return [record.enterpriseId, record]; }));
    const search = st.enterpriseSearch.trim().toLowerCase();
    const list = fixtureEnterprises().map(function (enterprise) {
      return { enterprise, record: resultMap[enterprise.enterpriseId] || null };
    }).filter(function (row) {
      if (search && !`${row.enterprise.name} ${row.enterprise.enterpriseId} ${row.enterprise.category}`.toLowerCase().includes(search)) return false;
      if (st.enterpriseRiskFilter !== "ALL" && DATA.riskKey(row.record?.riskTier) !== st.enterpriseRiskFilter) return false;
      if (st.enterpriseSectorFilter !== "ALL" && row.enterprise.category !== st.enterpriseSectorFilter) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (st.enterpriseSort === "name-asc") return a.enterprise.name.localeCompare(b.enterprise.name, "zh-CN");
      if (st.enterpriseSort === "name-desc") return b.enterprise.name.localeCompare(a.enterprise.name, "zh-CN");
      if (st.enterpriseSort === "score-desc") return Number(b.record?.finalScore ?? -Infinity) - Number(a.record?.finalScore ?? -Infinity);
      if (st.enterpriseSort === "risk") {
        const rank = DATA.riskRank(a.record?.riskTier) - DATA.riskRank(b.record?.riskTier);
        return rank || Number(a.record?.finalScore ?? Infinity) - Number(b.record?.finalScore ?? Infinity);
      }
      return Number(a.record?.finalScore ?? Infinity) - Number(b.record?.finalScore ?? Infinity);
    });
    return list;
  }

  function metricNames(record) {
    const items = record?.lowestMetrics || [];
    if (!items.length) return '<span class="muted">等待权威评估</span>';
    return `<div class="metric-tags">${items.slice(0, 3).map(function (item) { return `<span title="${attr(item.note || "")}">${esc(item.name || item.metricName || "指标")}</span>`; }).join("")}</div>`;
  }

  function renderEnterpriseTable() {
    const rows = enterpriseRows();
    if (!rows.length) return `<div class="empty-state">${icon("search", "lg")}<strong>没有匹配的企业</strong><span>请调整搜索词或筛选条件。</span></div>`;
    return `<div class="data-table-wrap"><table class="data-table enterprise-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th class="num">原始分</th><th class="num">调节合计</th><th class="num">综合分</th><th>风险等级</th><th>得分最低 3 项</th><th>报告</th></tr></thead><tbody>${rows.map(function ({ enterprise, record }) {
      const actionCandidate = STORE.candidateFor(enterprise.enterpriseId);
      return `<tr><td><button class="company-link" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise.enterpriseId)}"><strong>${esc(enterprise.name)}</strong><small>${esc(enterprise.enterpriseId)}</small></button></td><td><strong class="cell-primary">${esc(enterprise.sector)}</strong><small class="cell-secondary">${esc(enterprise.category)}</small></td><td class="num mono">${record?.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</td><td class="num mono ${Number(record?.factorSum) < 0 ? "negative" : ""}">${record?.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</td><td class="num"><strong class="score-cell">${record?.finalScore == null ? "—" : DATA.formatScore(record.finalScore)}</strong></td><td>${riskBadge(record?.riskTier || "UNKNOWN", true)}${actionCandidate ? '<small class="candidate-mark">处置候选</small>' : ""}</td><td>${metricNames(record)}</td><td><button class="table-action" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise.enterpriseId)}">${icon("file", "sm")}查看</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function filterSelect(label, name, value, options) {
    return `<label class="filter-field"><span>${esc(label)}</span><select data-filter="${attr(name)}">${options.map(function (option) { const item = typeof option === "string" ? { value: option, label: option } : option; return `<option value="${attr(item.value)}" ${item.value === value ? "selected" : ""}>${esc(item.label)}</option>`; }).join("")}</select>${icon("chevronDown", "sm")}</label>`;
  }

  function renderEnterprises() {
    const st = state();
    const categories = [...new Set(fixtureEnterprises().map(function (item) { return item.category; }))];
    return `${pageHeader("企业风险评分明细", "风险总览 · 明细穿透", "按企业、风险等级和产业板块筛选；点击任一企业进入同一运行身份下的诊断报告。", `${button("导出打印", "print-report", { ghost: true, icon: "print" })}${button("快速重跑", "quick-rerun", { primary: true, icon: "refresh", disabled: st.runStatus === "running" || Boolean(st.historicalView) })}`)}
      <section class="panel table-panel"><div class="table-toolbar"><label class="search-field">${icon("search", "sm")}<input type="search" data-filter="enterpriseSearch" value="${attr(st.enterpriseSearch)}" placeholder="搜索企业名称、ID 或类别" /><kbd>/</kbd></label><div class="filter-group">${filterSelect("风险", "enterpriseRiskFilter", st.enterpriseRiskFilter, [{ value: "ALL", label: "全部风险" }, ...["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return { value: key, label: DATA.RISK_META[key].name }; })])}${filterSelect("类别", "enterpriseSectorFilter", st.enterpriseSectorFilter, [{ value: "ALL", label: "全部类别" }, ...categories])}${filterSelect("排序", "enterpriseSort", st.enterpriseSort, [{ value: "score-asc", label: "评分从低到高" }, { value: "score-desc", label: "评分从高到低" }, { value: "risk", label: "风险优先" }, { value: "name-asc", label: "名称 A–Z" }, { value: "name-desc", label: "名称 Z–A" }])}</div><span class="result-count">${enterpriseRows().length} / ${fixtureEnterprises().length} 家</span></div>${renderEnterpriseTable()}<footer class="table-footer"><span>${icon("info", "sm")}评分只展示 M01 C035 权威结果；排序与筛选不会触发重算。</span><strong>评估时点 ${esc(bundle().fixture.assessmentAt)}</strong></footer></section>`;
  }

  function factorStateMeta(enterprise, factorName, value) {
    if (DATA.isNotApplicable(enterprise, factorName)) return { label: "不适用", code: "NOT_APPLICABLE", tone: "neutral" };
    if (value == null || value === "") return { label: "缺失套 0 档", code: "DEFAULTED_ZERO", tone: "warning" };
    return { label: "已显式填报", code: "EXPLICIT_VALUE", tone: "success" };
  }

  function renderFactorForm(enterprise) {
    if (!enterprise) return "";
    const values = state().factorInputs[enterprise.enterpriseId] || {};
    return `<div class="factor-form-grid">${Object.entries(DATA.FACTOR_INPUT_CHOICES).map(function ([factorName, choices]) {
      const value = values[factorName] ?? null;
      const meta = factorStateMeta(enterprise, factorName, value);
      const disabled = meta.code === "NOT_APPLICABLE" || Boolean(state().historicalView);
      return `<label class="factor-field ${disabled ? "is-disabled" : ""}"><span class="factor-label"><strong>${esc(factorName)}</strong>${statusChip(meta.label, meta.tone)}</span><span class="factor-control"><select data-factor-name="${attr(factorName)}" data-enterprise-id="${attr(enterprise.enterpriseId)}" ${disabled ? "disabled" : ""}><option value="__MISSING__" ${value == null || value === "" ? "selected" : ""}>${meta.code === "NOT_APPLICABLE" ? "不适用（环保 / 在建企业）" : "未填报（按 0 档）"}</option>${choices.map(function (choice) { return `<option value="${attr(choice)}" ${choice === value ? "selected" : ""}>${esc(choice)}</option>`; }).join("")}</select>${icon("chevronDown", "sm")}</span><small><code>${esc(meta.code)}</code>${meta.code === "NOT_APPLICABLE" ? " 与缺失不同，不参与因子计算" : meta.code === "DEFAULTED_ZERO" ? " 适用但未填，按用户确认口径使用 0 档" : " 由财务公司人工填报"}</small></label>`;
    }).join("")}</div>`;
  }

  function factorCompletion() {
    let explicit = 0;
    let defaults = 0;
    let notApplicable = 0;
    fixtureEnterprises().forEach(function (enterprise) {
      Object.keys(DATA.FACTOR_INPUT_CHOICES).forEach(function (name) {
        const meta = factorStateMeta(enterprise, name, state().factorInputs[enterprise.enterpriseId]?.[name]);
        if (meta.code === "EXPLICIT_VALUE") explicit += 1;
        if (meta.code === "DEFAULTED_ZERO") defaults += 1;
        if (meta.code === "NOT_APPLICABLE") notApplicable += 1;
      });
    });
    return { explicit, defaults, notApplicable, total: explicit + defaults + notApplicable };
  }

  function renderFactorEntry() {
    const st = state();
    const enterprise = selectedEnterprise();
    const completion = factorCompletion();
    const validation = st.factorEntryValidation;
    const status = st.factorEntryStatus === "published" ? statusChip("Published 输入快照", "success") : st.factorEntryStatus === "validated" ? statusChip("校验通过", "warning") : statusChip("Draft", "warning");
    return `${pageHeader("企业因子在线填报", "M02 · 人工业务输入", "一期由财务公司在线填报六项企业因子，不设置复核人；保存和发布均不会自动触发风险重评。", `${button("校验全部", "validate-factor-inputs", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布输入快照", "publish-factor-inputs", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}`)}
      <div class="callout info">${icon("info", "sm")}<div><strong>人工取值与模型定义分离</strong><p>本页只维护企业当期取值；因子系数和规则由 M01 Published 模型包维护。环保和在建企业的电价因子记为 NOT_APPLICABLE，适用但缺失才套 0 档。</p></div></div>
      <section class="split-layout factor-layout"><aside class="entity-picker panel"><div class="panel-heading"><div><span class="eyebrow">填报对象</span><h3>21 家企业</h3></div>${status}</div><label class="search-field compact">${icon("search", "sm")}<input type="search" data-filter="factorEntrySearch" value="${attr(st.factorEntrySearch)}" placeholder="筛选企业" /></label><div class="entity-list">${fixtureEnterprises().filter(function (item) { return !st.factorEntrySearch || item.name.includes(st.factorEntrySearch) || item.enterpriseId.toLowerCase().includes(st.factorEntrySearch.toLowerCase()); }).map(function (item) { const selected = item.enterpriseId === enterprise?.enterpriseId; const values = st.factorInputs[item.enterpriseId] || {}; const incomplete = Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (name) { return !DATA.isNotApplicable(item, name) && (values[name] == null || values[name] === ""); }).length; return `<button class="entity-option ${selected ? "active" : ""}" type="button" data-action="select-factor-enterprise" data-enterprise-id="${attr(item.enterpriseId)}"><span><strong>${esc(item.name)}</strong><small>${esc(item.category)}</small></span>${incomplete ? `<em>${incomplete} 缺失</em>` : icon("check", "sm")}</button>`; }).join("")}</div></aside><article class="panel factor-editor"><div class="factor-editor-head"><div><span class="eyebrow">当前企业</span><h2>${esc(enterprise?.name || "—")}</h2><p>${esc(enterprise?.category || "—")} · ${esc(enterprise?.enterpriseId || "—")} · 评估时点 ${esc(bundle().fixture.assessmentAt)}</p></div><button class="link-button" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise?.enterpriseId || "")}">查看报告 ${icon("chevronRight", "sm")}</button></div>${renderFactorForm(enterprise)}<div class="editor-footer"><div><span>${status}</span><small>${st.factorInputSnapshot?.snapshotId ? `当前：${esc(st.factorInputSnapshot.snapshotId)}` : "尚未发布输入快照"}</small></div><div>${button("保存 Draft", "save-factor-draft", { ghost: true, icon: "save", disabled: Boolean(st.historicalView) })}${button("校验并发布", "validate-publish-factors", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}</div></div></article></section>
      <section class="panel input-summary"><div class="panel-heading"><div><span class="eyebrow">输入完整性</span><h3>业务输入状态</h3></div><small>共 ${completion.total} 个企业因子单元</small></div><div class="summary-metrics"><div><strong>${completion.explicit}</strong><span>显式填报</span></div><div><strong>${completion.defaults}</strong><span>缺失套 0 档</span></div><div><strong>${completion.notApplicable}</strong><span>不适用</span></div><div><strong>0</strong><span>待复核（一期不设）</span></div></div>${validation ? `<div class="validation-result ${validation.ok ? "success" : "danger"}">${icon(validation.ok ? "check" : "alert", "sm")}<div><strong>${validation.ok ? "输入枚举与适用性校验通过" : `发现 ${validation.errors.length} 项错误`}</strong><p>${validation.ok ? `DEFAULTED_ZERO ${validation.defaultedZeroCount} 项，NOT_APPLICABLE ${validation.notApplicableCount} 项。` : esc(validation.errors.slice(0, 3).join("；"))}</p></div></div>` : ""}</section>`;
  }

  function configStatusCard() {
    const st = state();
    const lifecycle = st.configStatus === "published" ? { label: "Published", tone: "success", note: "当前配置可用于重评" } : st.configStatus === "validated" ? { label: "已校验", tone: "warning", note: "尚未切换 Published 指针" } : { label: "Draft", tone: "warning", note: "草稿不可运行" };
    return `<div class="config-status-card"><span class="config-status-icon">${icon(st.configStatus === "published" ? "lock" : "edit", "lg")}</span><div><span>模型包 ${esc(st.publishedModel?.packageId || "S003-M01-DEBT-RISK-PKG")}</span><strong>${esc(st.publishedModel?.packageVersion || "—")} · ${esc(lifecycle.label)}</strong><small>${esc(lifecycle.note)} · 业务 Owner：财务公司 · 生命周期 Owner：本体管理</small></div>${statusChip(lifecycle.label, lifecycle.tone)}</div>`;
  }

  function renderWeightConfig() {
    const draft = state().configDraft;
    const categories = Object.keys(draft.weights || {});
    return `<div class="config-description"><div>${icon("table", "sm")}<span><strong>评分权重</strong>固定 15 项指标，可调整三类企业权重；每类合计必须为 100。</span></div><span>评分锚点一期不开放编辑</span></div><div class="data-table-wrap"><table class="data-table config-table"><thead><tr><th>#</th><th>指标</th>${categories.map(function (category) { return `<th class="num">${esc(category)}</th>`; }).join("")}</tr></thead><tbody>${draft.indicatorOrder.map(function (metric, index) { return `<tr><td class="row-number">${String(index + 1).padStart(2, "0")}</td><td><strong>${esc(metric)}</strong>${metric === "盈利稳定性" ? '<small class="cell-secondary">历史不足默认 A（100 分）</small>' : ""}</td>${categories.map(function (category) { return `<td class="num"><label class="number-input"><input type="number" min="0" max="100" step="1" data-weight-category="${attr(category)}" data-weight-index="${index}" value="${attr(draft.weights[category][index])}" ${state().historicalView ? "disabled" : ""}/><span>%</span></label></td>`; }).join("")}</tr>`; }).join("")}<tr class="total-row"><td></td><td><strong>权重合计</strong></td>${categories.map(function (category) { const total = draft.weights[category].reduce(function (sum, value) { return sum + Number(value || 0); }, 0); return `<td class="num"><strong class="${Math.abs(total - 100) < .001 ? "valid-total" : "invalid-total"}">${total}</strong></td>`; }).join("")}</tr></tbody></table></div>`;
  }

  function renderFactorConfig() {
    const factors = state().configDraft.factors || [];
    return `<div class="config-description"><div>${icon("sliders", "sm")}<span><strong>调节因子系数</strong>一期固定六项因子及分档，只允许调整已确认分档系数。</span></div><span>禁止新增 / 删除因子和分档</span></div><div class="factor-config-grid">${factors.map(function (factor, factorIndex) { return `<article class="factor-config-card"><header><span class="factor-number">F${String(factorIndex + 1).padStart(2, "0")}</span><div><strong>${esc(factor.name)}</strong><small>适用：${esc((factor.applicableCategories || []).join("、"))}</small></div>${icon("lock", "sm")}</header><div class="factor-tier-list">${factor.tiers.map(function (tier) { return `<label><span><strong>${esc(tier.label)}</strong><small>${esc(tier.tierId)}</small></span><span class="number-input coefficient"><input type="number" min="-1" max="1" step="0.01" data-factor-id="${attr(factor.factorId)}" data-tier-id="${attr(tier.tierId)}" value="${attr(tier.coefficient)}" ${state().historicalView ? "disabled" : ""}/><em>${Number(tier.coefficient) > 0 ? "加分" : Number(tier.coefficient) < 0 ? "减分" : "中性"}</em></span></label>`; }).join("")}</div></article>`; }).join("")}</div>`;
  }

  function configRiskRangeLabel(tier, tiers, index) {
    const min = Number(tier.minInclusive);
    const max = index === 0 ? null : Number(tiers[index - 1].minInclusive);
    return max == null ? `≥ ${min}` : `≥ ${min} 且 < ${max}`;
  }

  function renderRiskTierConfig() {
    const tiers = state().configDraft.riskTiers || [];
    return `<div class="config-description"><div>${icon("alert", "sm")}<span><strong>风险分档阈值</strong>固定绿、黄、红、黑四档，只允许调整连续阈值。</span></div><span>黑灯下限固定为 0</span></div><div class="risk-tier-config">${tiers.map(function (tier, index) { const meta = DATA.RISK_META[tier.tierId] || DATA.RISK_META.UNKNOWN; return `<article class="risk-tier-card ${meta.className}"><div class="risk-tier-title"><span class="risk-dot"></span><div><strong>${esc(tier.name)}</strong><small>${esc(tier.tierId)}</small></div>${icon("lock", "sm")}</div><label><span>分数下限（含）</span><div class="number-input threshold"><input type="number" min="0" max="100" step="1" data-risk-tier-id="${attr(tier.tierId)}" value="${attr(tier.minInclusive)}" ${tier.tierId === "BLACK" || state().historicalView ? "disabled" : ""}/><em>分</em></div></label><p>当前范围：<strong>${esc(configRiskRangeLabel(tier, tiers, index))}</strong></p></article>`; }).join("")}</div>`;
  }

  function renderConfigBody() {
    if (state().activeConfigTab === "factors") return renderFactorConfig();
    if (state().activeConfigTab === "tiers") return renderRiskTierConfig();
    return renderWeightConfig();
  }

  function renderConfiguration() {
    const st = state();
    const validation = st.configValidation;
    return `${pageHeader("风险模型与分档配置", "M01 · Published 原子模型包", "配置由财务公司定义业务口径、本体管理维护版本与 Published 指针；页面不把模型参数下沉到 M02 管道或质量规则。", `${button("校验配置", "validate-configuration", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布新版本", "publish-configuration", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}`)}
      ${configStatusCard()}<section class="panel config-workspace"><div class="config-tabs" role="tablist"><button class="${st.activeConfigTab === "weights" ? "active" : ""}" type="button" data-config-tab="weights">评分权重</button><button class="${st.activeConfigTab === "factors" ? "active" : ""}" type="button" data-config-tab="factors">调节因子</button><button class="${st.activeConfigTab === "tiers" ? "active" : ""}" type="button" data-config-tab="tiers">风险分档</button></div><div class="config-body">${renderConfigBody()}</div><footer class="config-footer"><div>${validation ? `<div class="validation-result inline ${validation.ok ? "success" : "danger"}">${icon(validation.ok ? "check" : "alert", "sm")}<span>${validation.ok ? "配置校验通过，可发布新版本" : `${validation.errors.length} 项配置错误：${esc(validation.errors.slice(0, 2).join("；"))}`}</span></div>` : `<span class="muted">修改任一值即进入 Draft；Draft 不可重评。</span>`}</div><div>${button("放弃 Draft", "reset-configuration", { ghost: true, icon: "refresh", disabled: st.configStatus === "published" || Boolean(st.historicalView) })}${button("校验", "validate-configuration", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布", "publish-configuration", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}</div></footer></section>
      <div class="boundary-grid"><article class="boundary-card allowed"><strong>${icon("check", "sm")}本页负责</strong><p>权重、六项因子系数、四档阈值的 Draft → 校验 → Published；发布后才可快速重评。</p></article><article class="boundary-card forbidden"><strong>${icon("alert", "sm")}本页不负责</strong><p>不修改评分锚点，不新增因子或风险档，不自动创建 Action Request，不把参数写入 Python 管道。</p></article></div>`;
  }

  function runRiskSummary(run) {
    if (!run) return "";
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    run.enterpriseResults.forEach(function (item) { if (counts[item.riskTier] !== undefined) counts[item.riskTier] += 1; });
    return `<div class="run-risk-summary">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<span>${riskBadge(key, true)}<b>${counts[key]}</b></span>`; }).join("")}</div>`;
  }

  function renderRunHistory() {
    const history = state().runHistory || [];
    if (!history.length) return `<div class="empty-state compact">${icon("clock", "sm")}<span>尚无成功运行；失败不会覆盖上一成功运行。</span></div>`;
    return `<div class="run-history-list">${history.map(function (run, index) { return `<article class="run-history-row ${index === 0 ? "active" : ""}"><span class="run-status-dot"></span><div class="run-identity"><strong>${esc(DATA.shortId(run.runId, 22, 8))}</strong><small>${DATA.formatDateTime(run.evaluatedAt)} · ${esc(run.modelVersion)}</small></div>${runRiskSummary(run)}<span class="run-report-count">${run.reportCount} 份报告</span>${statusChip(index === 0 ? "当前" : "历史", index === 0 ? "success" : "neutral")}</article>`; }).join("")}</div>`;
  }

  function reportCards() {
    if (!records().length) return `<div class="empty-state">${icon("file", "lg")}<strong>尚无企业报告</strong><span>报告只在成功评估后自动生成，并与本轮运行身份保持一致。</span></div>`;
    return `<div class="report-card-grid">${records().slice().sort(function (a, b) { return DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier) || Number(a.finalScore) - Number(b.finalScore); }).map(function (record) { return `<button class="report-card" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><div class="report-card-top">${riskBadge(record.riskTier, true)}<span>${DATA.formatScore(record.finalScore)} 分</span></div><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.category)} · ${esc(record.assessmentAt)}</small><footer><span>${icon("file", "sm")}HTML / Print</span><span>查看 ${icon("chevronRight", "sm")}</span></footer></button>`; }).join("")}</div>`;
  }

  function renderRuns() {
    const st = state();
    const run = st.activeRun;
    const canRun = st.configStatus === "published" && st.factorEntryStatus === "published" && !st.historicalView && st.runStatus !== "running";
    return `${pageHeader("运行、重评与企业报告", "M06 · 统一场景工作台", "配置发布后可显式快速重评；每次重评形成新 scenarioRunId，成功后自动生成 21 份同源企业报告。", `${button(st.runStatus === "running" ? "重评进行中" : "使用当前 Published 版本重跑", "quick-rerun", { primary: true, icon: "refresh", disabled: !canRun })}`)}
      <section class="run-control-grid"><article class="panel run-control"><div class="panel-heading"><div><span class="eyebrow">快速重评</span><h3>显式运行门</h3></div>${st.runStatus === "running" ? statusChip("运行中", "info") : statusChip(canRun ? "可运行" : "暂不可运行", canRun ? "success" : "warning")}</div><div class="run-gates"><div class="${st.configStatus === "published" ? "passed" : "blocked"}">${icon(st.configStatus === "published" ? "check" : "alert", "sm")}<span><strong>Published 模型</strong><small>${esc(st.publishedModel?.packageVersion || "—")}</small></span></div><div class="${st.factorEntryStatus === "published" ? "passed" : "blocked"}">${icon(st.factorEntryStatus === "published" ? "check" : "alert", "sm")}<span><strong>人工输入快照</strong><small>${esc(st.factorInputSnapshot?.snapshotId || "待发布")}</small></span></div><div class="passed">${icon("check", "sm")}<span><strong>数据质量</strong><small>${esc(bundle().qualityResult?.qualityResultId || "M02")}</small></span></div></div><div class="run-action-box"><span class="run-action-icon">${icon("refresh", "lg")}</span><div><strong>${st.runStatus === "running" ? "正在执行确定性评估" : "创建新的隔离运行"}</strong><p>重评不会覆盖旧轮次；若失败，工作台继续展示上一成功运行，也不会自动派发 Action Request。</p></div>${button("快速重跑", "quick-rerun", { primary: true, icon: "play", disabled: !canRun })}</div>${st.runError ? `<div class="validation-result danger">${icon("alert", "sm")}<div><strong>本次运行未成功切换</strong><p>${esc(st.runError)}</p></div></div>` : ""}</article><article class="panel current-run"><div class="panel-heading"><div><span class="eyebrow">当前成功运行</span><h3>${run ? esc(DATA.shortId(run.runId, 23, 8)) : "尚未形成"}</h3></div>${run ? statusChip("Succeeded", "success") : statusChip("Pending", "neutral")}</div>${run ? `<dl class="run-facts"><div><dt>评估时间</dt><dd>${DATA.formatDateTime(run.evaluatedAt)}</dd></div><div><dt>评估时点</dt><dd>${esc(run.assessmentAt)}</dd></div><div><dt>模型版本</dt><dd>${esc(run.modelVersion)}</dd></div><div><dt>数据资产</dt><dd title="${attr(run.dataAssetId)}">${esc(DATA.shortId(run.dataAssetId, 19, 7))}</dd></div><div><dt>输入快照</dt><dd title="${attr(run.inputSnapshotId)}">${esc(DATA.shortId(run.inputSnapshotId, 19, 7))}</dd></div><div><dt>报告数量</dt><dd>${run.reportCount} 份</dd></div></dl>${runRiskSummary(run)}` : `<div class="empty-state compact">${icon("info", "sm")}<span>等待 M01 评分引擎返回完整 21 家结果。</span></div>`}</article></section>
      <section class="panel run-history-panel"><div class="panel-heading"><div><span class="eyebrow">运行历史</span><h3>场景轮次与上一成功保护</h3></div><small>最多展示当前浏览器投影内最近 20 次</small></div>${renderRunHistory()}</section>
      <section class="panel reports-panel"><div class="panel-heading"><div><span class="eyebrow">企业报告</span><h3>风险评分企业明细与报告穿透</h3></div><span class="panel-note">${records().length} / ${bundle().fixture.enterpriseCount} 份</span></div>${reportCards()}</section>`;
  }

  function renderQueryAnswer(answer) {
    if (!answer) return `<div class="query-placeholder">${icon("message", "lg")}<strong>选择一个标准问题</strong><p>M03 只读取当前运行的 Published 风险事实，不自行重算评分。</p></div>`;
    const result = answer.result || {};
    const footer = `<footer>来源：C008 / T019 / C035 · ${esc(runLabel())}</footer>`;
    if (["risk-counts", "risk-tier-distribution"].includes(answer.type)) {
      const counts = answer.counts || result.counts || {};
      return `<div class="query-answer"><span class="answer-label">只读问数结果</span><h3>${esc(answer.title)}</h3><div class="answer-risk-grid">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<div>${riskBadge(key, true)}<strong>${counts[key] || 0}</strong><span>家企业</span></div>`; }).join("")}</div>${result.averageFinalScore != null ? `<p class="answer-text">集团平均评分 ${DATA.formatScore(result.averageFinalScore)}，共 ${result.total || 0} 家企业。</p>` : ""}${footer}</div>`;
    }
    if (answer.type === "enterprise-list") {
      return `<div class="query-answer"><span class="answer-label">只读问数结果</span><h3>${esc(answer.title)}</h3>${renderRiskRows(answer.records || result.enterprises || [], { empty: "没有企业符合当前问题条件。" })}${footer}</div>`;
    }
    if (answer.type === "enterprise-detail") {
      return `<div class="query-answer"><span class="answer-label">企业详情 · 只读</span><h3>${esc(result.enterpriseName || "—")}</h3><div class="answer-risk-grid"><div>${riskBadge(result.riskTier, true)}<strong>${DATA.formatScore(result.finalScore)}</strong><span>综合评分</span></div><div><span>原始分</span><strong>${DATA.formatScore(result.rawScore)}</strong><span>调节 ${result.factorSum == null ? "—" : Number(result.factorSum).toFixed(2)}</span></div></div><button class="btn btn-primary btn-small" type="button" data-action="open-report" data-enterprise-id="${attr(result.enterpriseId)}">${icon("file", "sm")}查看企业报告</button>${footer}</div>`;
    }
    if (answer.type === "lowest-three-indicators") {
      return `<div class="query-answer"><span class="answer-label">最低三项 · 只读</span><h3>${esc(result.enterprise?.enterpriseName || answer.title)}</h3><div class="report-risk-cards">${(result.indicators || []).map(function (metric, index) { return `<article><span>0${index + 1}</span><div><strong>${esc(metric.name)}</strong><p>指标得分 ${DATA.formatScore(metric.score)}</p></div></article>`; }).join("")}</div>${footer}</div>`;
    }
    if (answer.type === "factor-default-and-not-applicable") {
      const rows = result.records || [];
      return `<div class="query-answer"><span class="answer-label">默认语义 · 只读</span><h3>${esc(answer.title)}</h3><p class="answer-text">涉及 ${result.enterpriseCount || rows.length} 家企业；DEFAULTED_ZERO ${result.counts?.DEFAULTED_ZERO || 0} 项，NOT_APPLICABLE ${result.counts?.NOT_APPLICABLE || 0} 项。</p><div class="decision-candidate-list">${rows.slice(0, 8).map(function (item) { return `<article class="decision-candidate"><div>${statusChip(item.factors?.[0]?.state || "—", item.factors?.[0]?.state === "NOT_APPLICABLE" ? "info" : "warning")}</div><div class="candidate-main"><strong>${esc(item.enterprise?.enterpriseName || "—")}</strong><small>${esc((item.factors || []).map(function (factor) { return factor.name; }).join("、"))}</small></div></article>`; }).join("")}</div>${footer}</div>`;
    }
    if (answer.type === "disposition-candidate-list") {
      const candidates = result.candidates || [];
      return `<div class="query-answer"><span class="answer-label">处置候选 · 只读</span><h3>${esc(answer.title)}</h3><p class="answer-text">共 ${result.count || candidates.length} 项候选；问数不会创建 Action Request 或负责人待办。</p><div class="decision-candidate-list">${candidates.slice(0, 8).map(function (candidate) { return `<article class="decision-candidate"><div>${riskBadge(candidate.enterprise?.riskTier, true)}</div><div class="candidate-main"><strong>${esc(candidate.enterprise?.enterpriseName || "—")}</strong><small>${esc(candidate.actionTypeId)} · 待人工确认</small></div><button class="btn btn-small btn-primary" type="button" data-action="open-decision" data-enterprise-id="${attr(candidate.enterprise?.enterpriseId || "")}">${icon("target", "sm")}人工确认</button></article>`; }).join("")}</div>${footer}</div>`;
    }
    return `<div class="query-answer"><span class="answer-label">${answer.type === "empty" ? "运行门提示" : "Published 规则解释"}</span><h3>${esc(answer.title)}</h3><p class="answer-text">${esc(answer.body)}</p><footer>${answer.type === "empty" ? "未触发前端重算" : `模型版本：${esc(state().publishedModel?.packageVersion || "—")}`}</footer></div>`;
  }

  function actionTypeLabel(value) {
    return {
      S003_RISK_FOLLOW_UP: "风险跟踪",
      S003_SPECIAL_DISPOSAL: "专项处置",
      S003_EMERGENCY_RESPONSE: "紧急响应",
      S003_FACTOR_EMERGENCY: "重大因子应急"
    }[value] || value;
  }

  function decisionCandidates() {
    return STORE.listDecisionCandidates().sort(function (a, b) { return DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier) || Number(a.finalScore) - Number(b.finalScore) || a.actionTypeId.localeCompare(b.actionTypeId); });
  }

  function renderDecisionCandidates() {
    const candidates = decisionCandidates();
    if (!candidates.length) return `<div class="empty-state compact">${icon("shield", "sm")}<span>当前运行没有黄 / 红 / 黑或重大因子处置候选。</span></div>`;
    return `<div class="decision-candidate-list">${candidates.map(function (candidate) { const candidateRunId = candidate.scenarioIdentity?.scenarioRunId; const existing = state().decisions.find(function (item) { return item.scenarioRunId === candidateRunId && item.enterpriseId === candidate.enterpriseId && item.actionTypeId === candidate.actionTypeId; }); return `<article class="decision-candidate"><div>${riskBadge(candidate.riskTier, true)}<span class="candidate-type">${esc(actionTypeLabel(candidate.actionTypeId))}</span></div><div class="candidate-main"><strong>${esc(candidate.enterpriseName)}</strong><small>${DATA.formatScore(candidate.finalScore)} 分 · ${esc(candidate.actionTypeId)}</small></div>${existing ? statusChip("已人工确认", "success") : `<button class="btn btn-small btn-primary" type="button" data-action="open-decision" data-candidate-id="${attr(candidate.candidateId)}">${icon("target", "sm")}人工确认</button>`}</article>`; }).join("")}</div>`;
  }

  function renderDecisionHistory() {
    if (!state().decisions.length) return `<div class="empty-state compact">${icon("clock", "sm")}<span>尚无人工确认的 Action Request 投影。</span></div>`;
    return `<div class="decision-history">${state().decisions.map(function (item) { return `<article><span class="decision-icon">${icon("check", "sm")}</span><div><strong>${esc(item.enterpriseName)} · ${esc(actionTypeLabel(item.actionTypeId))}</strong><small>${esc(item.actionRequestId)} · ${esc(item.todo?.todoId || item.todoId || "待办待接收")} · 负责人 ${esc(item.owner)}</small></div>${statusChip(item.todo?.status === "pending" ? "负责人待办待处理" : "待通用中心接收", "warning")}<button class="link-button" type="button" data-action="open-report" data-enterprise-id="${attr(item.enterpriseId)}">查看来源报告 ${icon("chevronRight", "sm")}</button></article>`; }).join("")}</div>`;
  }

  function renderQueryDecision() {
    const st = state();
    return `${pageHeader("只读问数与通用决策入口", "M03 + M04 · 场景内兼容视图", "问数只消费 Published 风险事实；处置候选必须由人员确认后，才形成进入通用决策中心的 Action Request。", `${button("查看负责人待办", "view-decision-todos", { primary: true, icon: "target" })}${button("查看快照", "view-checkpoints", { ghost: true, icon: "layers" })}`)}
      <section class="query-decision-grid"><article class="panel query-panel" id="m03-query"><div class="panel-heading"><div><span class="eyebrow">M03 · 智能问数</span><h3>标准快问</h3></div>${statusChip("只读", "info")}</div><div class="query-layout"><div class="query-list">${bundle().queryCatalog.queries.map(function (query) { return `<button class="query-option ${st.queryId === query.queryId ? "active" : ""}" type="button" data-action="run-query" data-query-id="${attr(query.queryId)}"><span>${icon("message", "sm")}</span><div><strong>${esc(query.question)}</strong><small>${esc(query.queryId)} · ${esc(query.resultShape)}</small></div>${icon("chevronRight", "sm")}</button>`; }).join("")}</div><div class="query-result">${renderQueryAnswer(st.queryAnswer)}</div></div></article><article class="panel decision-panel" id="m04-decision"><div class="panel-heading"><div><span class="eyebrow">M04 · 通用决策</span><h3>处置候选与人工确认</h3></div>${statusChip("不自动派发", "warning")}</div><div class="callout compact warning">${icon("alert", "sm")}<div><strong>负责人待办必须经过人工确认</strong><p>一期不开发多用户、经办、审批权限和多级审批；本视图在 S003 场景壳内复用通用 Action Request 合同。</p></div></div>${renderDecisionCandidates()}<div class="decision-boundary"><span>${icon("shield", "sm")}历史查看、克隆恢复与隔离回归均禁止重放历史 Action Request、通知、审批和待办。</span></div></article></section>
      <section class="panel" id="m04-todos"><div class="panel-heading"><div><span class="eyebrow">M04 · 已确认事项</span><h3>负责人待办交接投影</h3></div><small>正式状态以通用决策中心 M04 回执为准</small></div>${renderDecisionHistory()}</section>`;
  }

  function checkpointLabel(code) {
    return {
      CP01: ["初始配置完成", "锁定基线、场景身份与 M01—M06 初始合同"],
      CP02: ["数据接入完成", "锁定数据资产、人工输入、评估时点与质量结果"],
      CP03: ["Published 切换完成", "锁定模型包、权威指针与首轮评估结果"],
      CP04: ["问数联调完成", "锁定 M03 查询目录与 Published 事实消费证据"],
      CP05: ["决策链完成", "锁定处置候选、人工确认与通用待办交接"],
      CP06: ["报告 / 驾驶舱完成", "锁定 21 份报告、工作台与打印证据"],
      CP07: ["端到端联调完成", "锁定全链路版本、测试与证据包"],
      CP08: ["统一场景壳完成", "锁定 M01—M06 内部适配视图、身份带和连续操作证据"]
    }[code] || [code, "场景快照"];
  }

  function checkpointStatus(entry) {
    if (!entry.manifest) return { label: "待形成", tone: "neutral" };
    const readiness = entry.manifest.restoreReadiness?.status;
    return readiness === "verified" ? { label: "可恢复", tone: "success" } : { label: "已形成", tone: "warning" };
  }

  function renderCheckpointTimeline() {
    return `<div class="checkpoint-timeline">${bundle().checkpoints.map(function (entry, index) { const label = checkpointLabel(entry.code); const status = checkpointStatus(entry); const manifest = entry.manifest; return `<article class="checkpoint-row ${manifest ? "available" : "pending"}"><span class="checkpoint-index">${entry.code}</span><span class="checkpoint-line"></span><div class="checkpoint-main"><div class="checkpoint-title"><div><strong>${esc(label[0])}</strong><small>${esc(label[1])}</small></div>${statusChip(status.label, status.tone)}</div>${manifest ? `<dl><div><dt>Checkpoint ID</dt><dd title="${attr(manifest.checkpointId)}">${esc(DATA.shortId(manifest.checkpointId, 25, 8))}</dd></div><div><dt>来源运行</dt><dd title="${attr(manifest.sourceScenarioRunId)}">${esc(DATA.shortId(manifest.sourceScenarioRunId, 22, 7))}</dd></div><div><dt>形成时间</dt><dd>${DATA.formatDateTime(manifest.createdAt)}</dd></div><div><dt>恢复模式</dt><dd>isolated-clone</dd></div></dl><div class="checkpoint-actions"><button type="button" class="btn btn-small btn-ghost" data-action="view-checkpoint" data-checkpoint-code="${entry.code}">${icon("file", "sm")}只读查看</button><button type="button" class="btn btn-small btn-ghost" data-action="restore-checkpoint" data-checkpoint-code="${entry.code}">${icon("copy", "sm")}克隆恢复</button><button type="button" class="btn btn-small btn-ghost" data-action="regress-checkpoint" data-checkpoint-code="${entry.code}">${icon("refresh", "sm")}隔离回归</button></div>` : `<div class="checkpoint-pending">${icon("clock", "sm")}待对应节点完成后，由平台公共层与 M01—M06 Owner 导出正式不可变清单。</div>`}</div></article>`; }).join("")}</div>`;
  }

  function renderCheckpoints() {
    const st = state();
    const historical = st.historicalView;
    const context = displayContext();
    return `${pageHeader("场景快照与恢复", "C034 · 公共 Checkpoint 能力", "正式快照锁定基线、场景身份、模块版本、数据、Published 指针、结果、报告、决策、测试与证据；浏览器状态不是真源。", historical ? button("退出历史只读", "exit-historical", { primary: true, icon: "back" }) : "")}
      ${historical ? `<div class="historical-banner">${icon("lock", "sm")}<div><strong>${esc(historical.code)} 历史快照只读模式</strong><p>保留原 scenarioRunId ${esc(DATA.shortId(historical.context?.scenarioRunId || historical.checkpoint?.scenarioContext?.scenarioRunId))}；禁止编辑、重评和副作用重放。</p></div>${button("返回当前运行", "exit-historical", { ghost: true, icon: "back" })}</div>` : ""}
      <section class="checkpoint-layout"><article class="panel checkpoint-panel"><div class="panel-heading"><div><span class="eyebrow">CP01—CP08</span><h3>不可变节点</h3></div><span class="panel-note">${bundle().checkpoints.filter(function (item) { return item.manifest; }).length} / 8 已形成</span></div>${renderCheckpointTimeline()}</article><aside class="checkpoint-aside"><article class="panel context-card"><span class="context-card-icon">${icon("layers", "lg")}</span><span class="eyebrow">${historical ? "历史快照身份" : "当前场景身份"}</span><h3>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)}</h3><code>${esc(context.scenarioRunId)}</code><dl><div><dt>父基线</dt><dd>${esc(bundle().manifest.baseline.baselineVersion)}</dd></div><div><dt>基线快照</dt><dd title="${attr(bundle().manifest.baseline.baselineSnapshotId)}">${esc(DATA.shortId(bundle().manifest.baseline.baselineSnapshotId, 19, 6))}</dd></div><div><dt>状态</dt><dd>${esc(context.status)}</dd></div><div><dt>命名空间</dt><dd>独立隔离</dd></div></dl></article><article class="panel snapshot-rules"><div class="panel-heading"><div><span class="eyebrow">恢复语义</span><h3>三种操作严格分离</h3></div></div><ul><li><strong>历史查看</strong><span>原 scenarioRunId，只读展示当时状态与证据。</span></li><li><strong>克隆恢复</strong><span>创建新 scenarioRunId，不覆盖历史。</span></li><li><strong>隔离回归</strong><span>演练模式，禁用外发与历史副作用重放。</span></li></ul></article><div class="callout compact info">${icon("info", "sm")}<div><strong>可丢弃投影提示</strong><p>${esc(st.projectionNotice)}</p></div></div></aside></section>`;
  }

  function metricValue(value) {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return esc(value);
    if (Math.abs(number) >= 1000000) return esc(DATA.formatAmount(number, bundle().fixture.amountUnit));
    if (Math.abs(number) < 1 && number !== 0) return `${(number * 100).toFixed(2)}%`;
    return number.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
  }

  function reportConclusion(record) {
    const meta = DATA.RISK_META[record.riskTier] || DATA.RISK_META.UNKNOWN;
    const critical = record.factors.filter(function (factor) { return ["重大诉讼", "当月资金余缺预警"].includes(factor.value); });
    if (record.riskTier === "GREEN") return `经当前 Published 模型包评估，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为绿灯。企业债务风险总体可控，建议保持常态监测${critical.length ? "，并单独跟踪重大因子" : ""}。`;
    if (record.riskTier === "YELLOW") return `经当前 Published 模型包评估，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为黄灯。部分指标出现弱化信号，建议由债务风险管理人员确认风险跟踪 Action Request。`;
    if (record.riskTier === "RED") return `经当前 Published 模型包评估，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为红灯。债务压力较为显著，建议人工确认专项处置并推动至负责人待办。`;
    if (record.riskTier === "BLACK") return `经当前 Published 模型包评估，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为黑灯。需由管理人员立即核对证据并人工确认紧急响应 Action Request。`;
    return `${record.enterpriseName}当前尚未取得 M01 权威风险等级，报告仅展示已接入的数据身份，不形成业务结论。${meta.description}`;
  }

  function reportFactorRows(record) {
    return record.factors.map(function (factor) {
      const stateMeta = factor.state === "NOT_APPLICABLE" ? { label: "不适用", tone: "neutral" } : factor.state === "DEFAULTED_ZERO" ? { label: "缺失套 0 档", tone: "warning" } : { label: "显式取值", tone: "success" };
      return `<tr><td><strong>${esc(factor.name)}</strong></td><td>${factor.value == null ? "—" : esc(factor.value)}</td><td class="num mono ${Number(factor.coefficient) < 0 ? "negative" : Number(factor.coefficient) > 0 ? "positive" : ""}">${factor.coefficient == null ? "由 M01 返回" : `${Number(factor.coefficient) > 0 ? "+" : ""}${Number(factor.coefficient).toFixed(2)}`}</td><td>${statusChip(stateMeta.label, stateMeta.tone)}</td></tr>`;
    }).join("");
  }

  function reportMetricRows(record) {
    if (!record.metrics.length) return `<tr><td colspan="6" class="empty-cell">M01 评估结果未返回指标评分明细。</td></tr>`;
    const sorted = record.metrics.slice().sort(function (a, b) { return Number(a.score) - Number(b.score); });
    const lowest = new Set(sorted.slice(0, 3).map(function (item) { return item.name; }));
    return record.metrics.map(function (metric, index) {
      return `<tr class="${lowest.has(metric.name) ? "low-metric-row" : ""}"><td class="row-number">${String(index + 1).padStart(2, "0")}</td><td><strong>${esc(metric.name)}</strong>${lowest.has(metric.name) ? '<small class="low-label">关键风险</small>' : ""}</td><td>${metricValue(metric.value)}</td><td class="num">${metric.grade == null ? "—" : esc(metric.grade)}</td><td class="num">${Number.isFinite(Number(metric.weight)) ? `${Number(metric.weight)}%` : "—"}</td><td class="num"><strong>${DATA.formatScore(metric.score)}</strong></td></tr>`;
    }).join("");
  }

  function reportIdentity(record) {
    const run = state().activeRun;
    const context = displayContext();
    const formal = formalReportFor(record.enterpriseId);
    const reportId = formal?.manifest?.reportId || `S003-RPT-${run?.runId || context.scenarioRunId}-${record.enterpriseId}`;
    const lifecycle = formal ? "正式不可变制品" : "当前运行即时报告投影";
    return `<dl class="report-identity"><div><dt>scenarioId</dt><dd>${esc(context.scenarioId)}</dd></div><div><dt>scenarioVersion</dt><dd>${esc(context.scenarioVersion)}</dd></div><div><dt>scenarioRunId</dt><dd>${esc(context.scenarioRunId)}</dd></div><div><dt>prototypeVersion</dt><dd>1.1.0</dd></div><div><dt>enterpriseId</dt><dd>${esc(record.enterpriseId)}</dd></div><div><dt>assessmentAt</dt><dd>${esc(record.assessmentAt)}</dd></div><div><dt>modelVersion</dt><dd>${esc(run?.modelVersion || state().publishedModel?.packageVersion)}</dd></div><div><dt>reportId</dt><dd>${esc(reportId)}</dd></div><div><dt>content / artifact</dt><dd>${esc(formal?.manifest?.contentVersion || "待形成")} / ${esc(formal?.manifest?.artifactVersion || "工作台投影")}</dd></div><div><dt>生命周期</dt><dd>${esc(lifecycle)}</dd></div></dl>`;
  }

  function formalReportFor(enterpriseId) {
    const runId = state().activeRun?.runId;
    const manifest = bundle()?.reportManifest?.reports?.find(function (item) {
      return item.enterpriseId === enterpriseId && item.scenarioIdentity?.scenarioRunId === runId;
    });
    if (!manifest) return null;
    const content = bundle()?.reportContents?.reports?.find(function (item) { return item.reportId === manifest.reportId; });
    const artifact = bundle()?.reportArtifacts?.artifacts?.find(function (item) { return item.reportId === manifest.reportId; });
    return { manifest, content, artifact };
  }

  function renderReport() {
    const record = selectedRecord();
    const enterprise = selectedEnterprise();
    const context = displayContext();
    if (!record) {
      return `${pageHeader("企业债务风险诊断报告", "M06 · 报告穿透", "报告只能由成功运行结果生成，不在页面端补算风险分。", button("返回企业明细", "view-enterprises", { ghost: true, icon: "back" }))}<div class="empty-state report-empty">${icon("file", "lg")}<strong>${esc(enterprise?.name || "企业")} 尚无可用报告</strong><span>请先完成 Published 模型与输入快照，并取得 M01 全量成功评估结果。</span>${button("前往运行与报告", "view-runs", { primary: true, icon: "refresh" })}</div>`;
    }
    const meta = DATA.RISK_META[record.riskTier] || DATA.RISK_META.UNKNOWN;
    const candidate = STORE.candidateFor(record.enterpriseId);
    const decision = state().decisions.find(function (item) { return item.scenarioRunId === context.scenarioRunId && item.enterpriseId === record.enterpriseId; });
    const formal = formalReportFor(record.enterpriseId);
    const lowest = record.lowestMetrics || [];
    return `<div class="report-toolbar">${button("返回企业明细", "view-enterprises", { ghost: true, icon: "back" })}<div>${formal?.artifact ? `<button class="btn btn-ghost" type="button" data-action="open-formal-report">${icon("external", "sm")}<span>打开正式制品</span></button>` : ""}<button class="btn btn-ghost" type="button" data-action="copy-report-link">${icon("copy", "sm")}<span>复制深链</span></button>${button("打印 / 导出 PDF", "print-now", { primary: true, icon: "print" })}</div></div><article class="report-page ${meta.className}">
      <header class="report-header"><div class="report-brand"><span class="report-logo">OFW</span><div><strong>智财问策 · Ontology Financial World</strong><small>S003 债务风险监测</small></div></div><div class="report-document-meta"><span>企业债务风险诊断报告</span><strong>${esc(record.assessmentAt)}</strong><small>内容版本 1.0.0</small></div></header>
      <section class="report-title"><div><span>${esc(record.category)}</span><h1>${esc(record.enterpriseName)}</h1><p>${esc(record.enterpriseId)} · 币种 ${esc(bundle().fixture.currency)} · 金额单位 ${esc(bundle().fixture.amountUnit)}</p></div>${riskBadge(record.riskTier, false)}</section>
      <section class="report-score-band"><div class="report-score-main"><span>调整后综合得分</span><strong>${DATA.formatScore(record.finalScore)}</strong><small>/ 100</small></div><div class="report-score-breakdown"><div><span>原始得分</span><strong>${record.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</strong></div><div><span>调节系数合计</span><strong>${record.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</strong></div><div><span>风险等级</span><strong>${esc(meta.name)}</strong></div></div></section>
      <section class="report-section conclusion"><div class="report-section-number">01</div><div><span class="eyebrow">总体判断</span><h2>总体风险评分与结论</h2><p>${esc(reportConclusion(record))}</p><div class="risk-basis"><strong>${icon("shield", "sm")}分档依据</strong><span>${esc(meta.description)}；阈值来源于 Published 模型包 ${esc(state().publishedModel.packageVersion)}。</span></div></div></section>
      <section class="report-section"><div class="report-section-number">02</div><div class="report-section-body"><span class="eyebrow">业务调节</span><h2>调节因子明细</h2><div class="data-table-wrap report-table"><table class="data-table"><thead><tr><th>调节因子</th><th>企业取值</th><th class="num">系数</th><th>语义状态</th></tr></thead><tbody>${reportFactorRows(record)}</tbody></table></div></div></section>
      <section class="report-section"><div class="report-section-number">03</div><div class="report-section-body"><span class="eyebrow">财务评分</span><h2>15 项财务指标评分明细</h2><div class="data-table-wrap report-table"><table class="data-table"><thead><tr><th>#</th><th>指标</th><th>指标值</th><th class="num">等级</th><th class="num">权重</th><th class="num">得分</th></tr></thead><tbody>${reportMetricRows(record)}</tbody></table></div></div></section>
      <section class="report-section"><div class="report-section-number">04</div><div class="report-section-body"><span class="eyebrow">重点风险</span><h2>关键风险指标与证据</h2>${lowest.length ? `<div class="report-risk-cards">${lowest.slice(0, 3).map(function (metric, index) { return `<article><span>0${index + 1}</span><div><strong>${esc(metric.name || metric.metricName || "风险指标")}</strong><p>得分 ${DATA.formatScore(metric.score)}${metric.note ? ` · ${esc(metric.note)}` : ""}</p></div></article>`; }).join("")}</div>` : `<div class="empty-state compact">${icon("info", "sm")}<span>M01 尚未返回最低三项指标明细。</span></div>`}<div class="evidence-row"><div><span>数据资产</span><strong>${esc(state().activeRun?.dataAssetId || "—")}</strong></div><div><span>人工输入</span><strong>${esc(state().activeRun?.inputSnapshotId || "—")}</strong></div><div><span>质量结果</span><strong>${esc(bundle().qualityResult?.qualityResultId || "—")}</strong></div></div></div></section>
      <section class="report-section"><div class="report-section-number">05</div><div class="report-section-body"><span class="eyebrow">风险处置</span><h2>处置候选与人工确认状态</h2>${candidate ? `<div class="report-action-card"><span class="report-action-icon">${icon("target", "lg")}</span><div><strong>${esc(actionTypeLabel(candidate.actionTypeId))}</strong><p>${esc(candidate.actionTypeId)} · 该候选不会自动创建 Action Request 或负责人待办。</p></div>${decision ? statusChip("已人工确认", "success") : `<button class="btn btn-primary" type="button" data-action="open-decision" data-candidate-id="${attr(candidate.candidateId)}">${icon("target", "sm")}人工确认</button>`}</div>` : `<div class="callout compact success">${icon("check", "sm")}<div><strong>当前未生成处置候选</strong><p>仍应按集团债务风险管理要求保持常态监测。</p></div></div>`}</div></section>
      <section class="report-section identity-section"><div class="report-section-number">06</div><div class="report-section-body"><span class="eyebrow">版本与追溯</span><h2>报告身份、来源和默认语义</h2>${reportIdentity(record)}<div class="default-semantics"><span><b>HISTORY_INSUFFICIENT_DEFAULT_A</b>盈利历史不足按 A（100 分）</span><span><b>DEFAULTED_ZERO</b>适用但缺失因子按 0 档</span><span><b>NOT_APPLICABLE</b>业务不适用，不等同于缺失</span><span><b>UNDER_CONSTRUCTION_60</b>在建企业原始分固定为 60</span></div></div></section>
      <footer class="report-footer"><span>本报告由 S003 场景工作台基于 M01 C035 权威评估结果生成。</span><span>${esc(context.scenarioRunId)}</span></footer>
    </article>`;
  }

  function renderCurrentView() {
    const view = state().currentView;
    if (view === "data-quality") return renderDataQuality();
    if (view === "enterprises") return renderEnterprises();
    if (view === "factor-entry") return renderFactorEntry();
    if (view === "configuration") return renderConfiguration();
    if (view === "runs") return renderRuns();
    if (view === "query-decision") return renderQueryDecision();
    if (view === "checkpoints") return renderCheckpoints();
    if (view === "agent-boundary") return renderAgentBoundary();
    if (view === "report") return renderReport();
    return renderOverview();
  }

  function renderModal() {
    const pending = state().pendingDecision;
    if (!pending) {
      modalRoot.innerHTML = "";
      document.body.classList.remove("modal-open");
      return;
    }
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-decision"><section class="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title" onclick="event.stopPropagation()"><header><div><span class="eyebrow">通用 Action Request</span><h2 id="decision-modal-title">人工确认处置候选</h2></div><button type="button" class="modal-close" data-action="close-decision" aria-label="关闭">${icon("close")}</button></header><div class="modal-body"><div class="decision-summary"><span class="decision-summary-icon">${icon("target", "lg")}</span><div><strong>${esc(pending.enterpriseName)}</strong><p>${riskBadge(pending.riskTier, true)}<b>${DATA.formatScore(pending.finalScore)} 分</b></p></div></div><dl class="modal-facts"><div><dt>Action Type</dt><dd>${esc(pending.actionTypeId)}</dd></div><div><dt>处置类型</dt><dd>${esc(actionTypeLabel(pending.actionTypeId))}</dd></div><div><dt>来源运行</dt><dd title="${attr(pending.scenarioRunId)}">${esc(DATA.shortId(pending.scenarioRunId, 23, 8))}</dd></div><div><dt>评估时点</dt><dd>${esc(pending.assessmentAt)}</dd></div></dl><label class="form-field"><span>负责人</span><input id="decision-owner" type="text" value="集团债务风险负责人" /></label><label class="form-field"><span>确认说明（可选）</span><textarea id="decision-note" rows="3" placeholder="补充处置重点、关注期限或交接说明"></textarea></label><label class="confirm-check"><input id="decision-confirmed" type="checkbox" /><span><strong>我已核对企业、风险等级、Action Type 与负责人</strong><small>确认后仅形成进入通用决策中心的交接投影，不自动触发多级审批、通知或外部派发。</small></span></label><div class="callout compact warning">${icon("alert", "sm")}<div><strong>人工确认门</strong><p>一期不开发 S003 专属处置页，负责人待办沿用决策中心既有框架。</p></div></div></div><footer><button type="button" class="btn btn-ghost" data-action="close-decision">取消</button><button type="button" class="btn btn-primary" data-action="confirm-decision">${icon("check", "sm")}确认并交接</button></footer></section></div>`;
  }

  function render() {
    if (!state().ready) {
      app.innerHTML = renderBoot();
      renderModal();
      return;
    }
    const active = document.activeElement;
    const activeFilter = active?.dataset?.filter;
    const selectionStart = activeFilter && typeof active.selectionStart === "number" ? active.selectionStart : null;
    app.innerHTML = renderShell(renderCurrentView());
    renderModal();
    if (activeFilter) {
      const next = app.querySelector(`[data-filter="${CSS.escape(activeFilter)}"]`);
      if (next) {
        next.focus({ preventScroll: true });
        if (selectionStart != null && typeof next.setSelectionRange === "function") next.setSelectionRange(selectionStart, selectionStart);
      }
    }
  }

  function toast(message, tone) {
    const item = document.createElement("div");
    item.className = `toast ${tone || "info"}`;
    item.innerHTML = `${icon(tone === "danger" ? "alert" : tone === "success" ? "check" : "info", "sm")}<span>${esc(message)}</span>`;
    toastRegion.appendChild(item);
    window.setTimeout(function () { item.classList.add("leaving"); }, 3200);
    window.setTimeout(function () { item.remove(); }, 3600);
  }

  function setHash(view, enterpriseId, replace, anchor) {
    const next = view === "report" ? `#report/${encodeURIComponent(enterpriseId)}` : `#${view}${anchor ? `/${anchor}` : ""}`;
    if (replace) history.replaceState({ s003: true }, "", next);
    else history.pushState({ s003: true }, "", next);
  }

  function navigate(view, enterpriseId, options) {
    const config = options || {};
    if (state().historicalView && view !== "checkpoints") STORE.exitHistoricalView();
    STORE.setView(view, enterpriseId, config.moduleId, config.anchor);
    setHash(view, enterpriseId, config.replace, config.anchor);
    window.requestAnimationFrame(function () {
      const target = config.anchor ? document.getElementById(config.anchor) : null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function quickRerun() {
    try {
      const run = await STORE.quickRerun();
      if (run) {
        toast(`重评成功：${DATA.shortId(run.runId)}`, "success");
        navigate("runs", null, { replace: true });
      } else {
        toast(state().runError || "本次重评未成功，已保留上一成功运行。", "danger");
      }
    } catch (error) {
      toast(error.message || String(error), "danger");
    }
  }

  function openReport(enterpriseId) {
    if (!enterpriseId) return;
    STORE.selectEnterprise(enterpriseId);
    navigate("report", enterpriseId);
  }

  async function copyReportLink() {
    const id = state().selectedEnterpriseId;
    const formal = formalReportFor(id);
    if (formal?.manifest?.deepLink?.href) {
      const url = new URL(formal.manifest.deepLink.href, window.location.href);
      try {
        await navigator.clipboard.writeText(url.href);
        toast("正式报告深链已复制；已锁定 scenarioRunId 与 reportId。", "success");
      } catch (_) {
        toast(url.href, "info");
      }
      return;
    }
    const url = new URL(window.location.href);
    url.hash = `report/${encodeURIComponent(id)}`;
    url.searchParams.set("scenarioId", state().context.scenarioId);
    url.searchParams.set("scenarioVersion", state().context.scenarioVersion);
    url.searchParams.set("scenarioRunId", state().context.scenarioRunId);
    url.searchParams.set("prototypeVersion", "1.1.0");
    try {
      await navigator.clipboard.writeText(url.href);
      toast("报告深链已复制；链接携带当前 scenarioRunId。", "success");
    } catch (_) {
      toast(url.href, "info");
    }
  }

  function openFormalReport() {
    const formal = formalReportFor(state().selectedEnterpriseId);
    if (!formal?.artifact?.html) return toast("当前运行尚未形成正式不可变报告制品。", "danger");
    const url = URL.createObjectURL(new Blob([formal.artifact.html], { type: "text/html;charset=utf-8" }));
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    if (!opened) toast("浏览器阻止了新窗口，请允许弹窗后重试。", "danger");
  }

  function printReport() {
    if (state().currentView !== "report") {
      const id = state().selectedEnterpriseId || records()[0]?.enterpriseId;
      if (!id) return toast("尚无可打印的企业报告。", "danger");
      openReport(id);
      window.setTimeout(function () { window.print(); }, 180);
      return;
    }
    window.print();
  }

  async function handleAction(action, target) {
    if (action === "toggle-nav") return STORE.toggleNav();
    if (action === "toggle-mobile-nav") return STORE.toggleMobileNav();
    if (action === "go-back") {
      if (state().currentView === "report") return navigate("enterprises");
      return navigate("overview");
    }
    if (action === "view-overview") return navigate("overview", null, { moduleId: "M06" });
    if (action === "view-enterprises") return navigate("enterprises");
    if (action === "view-factor-entry") return navigate("factor-entry");
    if (action === "view-runs") return navigate("runs");
    if (action === "view-checkpoints") return navigate("checkpoints");
    if (action === "view-decision-todos") return navigate("query-decision", null, { moduleId: "M04", anchor: "m04-todos" });
    if (action === "open-report") return openReport(target.dataset.enterpriseId);
    if (action === "select-factor-enterprise") return STORE.selectEnterprise(target.dataset.enterpriseId);
    if (action === "save-factor-draft") return toast("Draft 已保存为当前场景的可丢弃工作投影；未触发重评。", "info");
    if (action === "validate-factor-inputs") {
      const result = STORE.validateFactorInputs();
      return toast(result.ok ? "企业因子输入校验通过。" : `校验未通过：${result.errors[0]}`, result.ok ? "success" : "danger");
    }
    if (action === "publish-factor-inputs") {
      try { const snapshot = STORE.publishFactorInputs(); return toast(`已形成输入快照投影 ${snapshot.snapshotId}；尚未重评。`, "success"); } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "validate-publish-factors") {
      try {
        const validation = STORE.validateFactorInputs();
        if (!validation.ok) throw new Error(validation.errors[0]);
        const snapshot = STORE.publishFactorInputs();
        return toast(`校验通过并发布 ${snapshot.snapshotId}；请显式点击快速重跑。`, "success");
      } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "validate-configuration") {
      const result = STORE.validateConfiguration();
      return toast(result.ok ? "配置校验通过，可发布新版本。" : `配置未通过：${result.errors[0]}`, result.ok ? "success" : "danger");
    }
    if (action === "publish-configuration") {
      try { const model = STORE.publishConfiguration(); return toast(`模型包 ${model.packageVersion} 已发布；不会自动重评。`, "success"); } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "reset-configuration") { STORE.resetConfiguration(); return toast("已放弃 Draft，恢复当前 Published 配置。", "info"); }
    if (action === "quick-rerun") return quickRerun();
    if (action === "run-query") { STORE.runQuery(target.dataset.queryId); return; }
    if (action === "open-decision") {
      try {
        navigate("query-decision", null, { moduleId: "M04", anchor: "m04-decision", replace: true });
        STORE.openDecision(target.dataset.candidateId || target.dataset.enterpriseId);
      } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "close-decision") return STORE.closeDecision();
    if (action === "confirm-decision") {
      try {
        const result = STORE.confirmDecision({
          owner: document.getElementById("decision-owner")?.value.trim(),
          note: document.getElementById("decision-note")?.value.trim(),
          confirmed: Boolean(document.getElementById("decision-confirmed")?.checked)
        });
        return toast(`${result.enterpriseName} 已人工确认，等待通用决策中心接收。`, "success");
      } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "view-checkpoint") {
      try { STORE.viewCheckpoint(target.dataset.checkpointCode); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "exit-historical") return STORE.exitHistoricalView();
    if (action === "restore-checkpoint") {
      try { const operation = STORE.cloneRestore(target.dataset.checkpointCode); toast(`已克隆恢复为新运行 ${DATA.shortId(operation.context.scenarioRunId)}。`, "success"); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "regress-checkpoint") {
      try { const operation = STORE.isolatedRegression(target.dataset.checkpointCode); toast(`已创建隔离回归 ${DATA.shortId(operation.context.scenarioRunId)}。`, "success"); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "print-report" || action === "print-now") return printReport();
    if (action === "open-formal-report") return openFormalReport();
    if (action === "copy-report-link") return copyReportLink();
  }

  app.addEventListener("click", function (event) {
    const moduleTarget = event.target.closest("[data-module-id]");
    if (moduleTarget) {
      const module = DATA.MODULES.find(function (item) { return item.id === moduleTarget.dataset.moduleId; });
      if (module) navigate(module.view, null, { moduleId: module.id, anchor: module.anchor || null });
      return;
    }
    const viewTarget = event.target.closest("[data-view]");
    if (viewTarget) {
      navigate(viewTarget.dataset.view);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    event.preventDefault();
    void handleAction(actionTarget.dataset.action, actionTarget);
  });

  modalRoot.addEventListener("click", function (event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    event.preventDefault();
    void handleAction(actionTarget.dataset.action, actionTarget);
  });

  app.addEventListener("input", function (event) {
    const filter = event.target.dataset.filter;
    if (filter && ["enterpriseSearch", "factorEntrySearch"].includes(filter)) STORE.setFilter(filter, event.target.value);
  });

  app.addEventListener("change", function (event) {
    const target = event.target;
    if (target.dataset.filter) return STORE.setFilter(target.dataset.filter, target.value);
    if (target.dataset.factorName) return STORE.updateFactorInput(target.dataset.enterpriseId, target.dataset.factorName, target.value);
    if (target.dataset.weightCategory) return STORE.updateWeight(target.dataset.weightCategory, Number(target.dataset.weightIndex), target.value);
    if (target.dataset.factorId) return STORE.updateFactorCoefficient(target.dataset.factorId, target.dataset.tierId, target.value);
    if (target.dataset.riskTierId) return STORE.updateRiskThreshold(target.dataset.riskTierId, target.value);
  });

  app.addEventListener("click", function (event) {
    const tab = event.target.closest("[data-config-tab]");
    if (tab) STORE.setFilter("activeConfigTab", tab.dataset.configTab);
  });

  window.addEventListener("popstate", function () {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw.startsWith("report/")) STORE.setView("report", decodeURIComponent(raw.split("?")[0].slice(7)));
    else {
      const [requestedView, requestedAnchor] = raw.split("/");
      const view = DATA.VIEWS.some(function (item) { return item.id === requestedView; }) ? requestedView : "overview";
      const anchor = ["m03-query", "m04-decision", "m04-todos"].includes(requestedAnchor) ? requestedAnchor : null;
      const moduleId = anchor?.startsWith("m04-") ? "M04" : undefined;
      if (state().historicalView && view !== "checkpoints") STORE.exitHistoricalView();
      STORE.setView(view, null, moduleId, anchor);
      if (anchor) window.requestAnimationFrame(function () { document.getElementById(anchor)?.scrollIntoView({ block: "start" }); });
    }
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state().pendingDecision) STORE.closeDecision();
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      navigate("enterprises");
      window.setTimeout(function () { document.querySelector('[data-filter="enterpriseSearch"]')?.focus(); }, 100);
    }
  });

  STORE.subscribe(render);
  render();
  void STORE.bootstrap();
})();
