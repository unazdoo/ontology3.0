import "./styles.css";
import { embedded, send, native, canonicalScope } from "./platform.js";
import { createMap } from "./map.js";
import {
  validateDataset,
  filterEnterprises,
  metrics,
  facilityUndrawn,
  bankExposure,
  query,
  createPlan,
  comparePlan,
  scenarioSchema,
  defaultParams,
  taskLabels,
  taskTransitions,
  transitionTask,
  pointInBounds,
  clone,
  fmt,
  amount,
  riskRank,
} from "./domain.js";
import {
  createStore,
  defaultFilters,
  newTask,
  validateRestoredState,
  reportSnapshot,
  reassignTask,
} from "./store.js";
import {
  esc,
  icon,
  tool,
  button,
  badge,
  tierTone,
  empty,
  facts,
  objectButton,
  sourceDetails,
  refreshIcons,
  reportHtml,
  download,
  resultCsv,
} from "./ui.js";
import * as d3 from "d3";

const root = document.getElementById("app"),
  modal = document.getElementById("modal");
const store = createStore(localStorage, () =>
  notify("浏览器存储已满，新增记录仅保留在本次会话，请及时导出。", true),
);
let data,
  mapView,
  results,
  rows = [],
  pageView = "workbench",
  detailStack = [],
  queryEpoch = 0,
  queryBusy = false,
  pendingQuestion = "",
  composerDraft = "",
  planDraft = null,
  taskFilter = "all",
  reportSelected = null,
  busyError = "",
  selectedDefinition = "weightedCost";
const navItems = [
  ["workbench", "地图态势", "globe-2"],
  ["plans", "分析方案", "git-compare-arrows"],
  ["tasks", "事项跟踪", "list-checks"],
  ["reports", "分析报告", "files"],
  ["ontology", "数据本体", "network"],
  ["models", "模型验证", "activity"],
];
let hostView =
  new URLSearchParams(location.hash.slice(1)).get("view") || "workbench";
if (embedded) document.documentElement.classList.add("embedded-workbench");
const modeItems = [
  ["risk", "债务风险"],
  ["cost", "融资成本"],
  ["maturity", "到期压力"],
  ["exposure", "银行敞口"],
];
const get = () => store.get();
const activePlan = () =>
  get().plans.find((plan) => plan.id === get().activePlanId) || null;
function notify(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast ${error ? "error" : ""}`;
  node.textContent = message;
  document.getElementById("toasts").replaceChildren(node);
  setTimeout(() => node.remove(), 4200);
}
function save(patch, options) {
  try {
    const next = store.update(patch, options);
    if (!store.isPersistent()) {
      let notice = document.getElementById("storage-warning");
      if (!notice) {
        notice = document.createElement("div");
        notice.id = "storage-warning";
        notice.className = "storage-warning";
        notice.textContent = "仅当前会话：浏览器存储不可用，请导出重要结果。";
        document.body.append(notice);
      }
    }
    return next;
  } catch (error) {
    notify("本地保存失败，已有记录未被覆盖。请导出重要结果。", true);
    throw error;
  }
}
function recompute() {
  rows = filterEnterprises(data, get().filters, get().horizon, activePlan());
  results = metrics(
    data,
    rows.map((row) => row.id),
    get().horizon,
    activePlan(),
  );
}
function shell() {
  mapView?.destroy();
  mapView = null;
  if (embedded) {
    root.innerHTML = `<div class="embedded-application"><div id="page-surface"></div></div>`;
    renderPage();
    if (pageView !== hostView) {
      save({ pendingDraft: planDraft });
      send("OFW_V14_NAVIGATE", { view: pageView });
    }
    return;
  }
  root.innerHTML = `<div class="application"><aside class="rail"><button class="brand" data-action="nav" data-view="workbench" title="智财问策">${icon("network")}</button><nav aria-label="主导航">${navItems.map(([id, label, glyph]) => `<button class="rail-item ${id === pageView ? "active" : ""}" data-action="nav" data-view="${id}" title="${label}" aria-label="${label}">${icon(glyph)}<span>${label}</span></button>`).join("")}</nav><div class="rail-bottom"><span class="online-dot"></span><small>v1.4</small></div></aside><div class="application-main"><header class="topbar"><div class="brand-title"><strong>智财问策</strong><span>企业融资与债务风险</span></div><div class="topbar-tools"><span class="dataset-label">${icon("database")}演示数据 <b>${data.asOf}</b></span>${tool("saved", "history", "已保存探索")}${tool("source", "fingerprint", "数据来源与假设")}<span class="avatar">财</span></div></header><div id="page-surface"></div></div></div>`;
  renderPage();
}
function workspaceActions() {
  if (!embedded) return "";
  return `<details class="workspace-actions"><summary class="icon-button" title="更多工作区操作" aria-label="更多工作区操作">${icon("ellipsis")}</summary><div class="workspace-actions-menu">${button("native-object", "对象探索", "network", false, 'data-module="m07" data-task="explore"')}${button("native-query", "智能问数", "messages-square", false, 'data-module="query" data-task="ask"')}${button("native-model", "模型目标", "activity", false, 'data-module="modeling" data-task="objectives"')}${button("saved", "已保存探索", "history")}${button("source", "来源与假设", "fingerprint")}</div></details>`;
}
function renderPage() {
  if (pageView === "workbench") {
    renderWorkbench();
    return;
  }
  mapView?.destroy();
  mapView = null;
  const surface = document.getElementById("page-surface");
  surface.className = "document-surface";
  surface.innerHTML =
    pageView === "plans"
      ? plansPage()
      : pageView === "tasks"
        ? tasksPage()
        : pageView === "reports"
          ? reportsPage()
          : pageView === "ontology"
            ? ontologyPage()
            : modelsPage();
  if (embedded)
    surface
      .querySelector(".page-header")
      ?.insertAdjacentHTML("beforeend", workspaceActions());
  refreshIcons();
  if (pageView === "ontology") drawOntology();
  if (pageView === "models") mountModelFrame();
}
function renderWorkbench() {
  mapView?.destroy();
  mapView = null;
  const surface = document.getElementById("page-surface");
  surface.className = "workbench-surface";
  surface.innerHTML = `<div class="workspace-toolbar"><div class="mode-tabs" role="tablist" aria-label="态势指标">${modeItems.map(([id, label]) => `<button data-action="mode" data-mode="${id}" class="${get().mode === id ? "active" : ""}" role="tab" aria-selected="${get().mode === id}">${label}</button>`).join("")}</div><div class="workspace-toolbar-right"><label><span>展望</span><select id="horizon" aria-label="展望窗口">${[30, 90, 180, 365].map((days) => `<option value="${days}" ${get().horizon === days ? "selected" : ""}>${days}天</option>`).join("")}</select></label><select id="active-plan" aria-label="结果视图"><option value="">基准快照</option>${get()
    .plans.filter((plan) => plan.dataDigest === data.digest)
    .map(
      (plan) =>
        `<option value="${plan.id}" ${plan.id === get().activePlanId ? "selected" : ""}>方案 · ${esc(plan.name)}</option>`,
    )
    .join(
      "",
    )}</select>${tool("undo", "undo-2", "撤销筛选", get().filters ? "" : "disabled")}${button("save-exploration", "保存探索", "bookmark")}${workspaceActions()}</div></div><section class="metric-strip" id="metric-strip"></section><div class="workspace-grid"><aside class="object-list-pane" id="object-list-pane"><div class="objects-head"><div><h2>企业对象</h2><span id="entity-count"></span></div>${tool("reset-filters", "list-restart", "清除筛选")}${tool("close-objects", "x", "关闭企业列表")}</div><label class="search-input">${icon("search")}<input id="entity-search" aria-label="搜索企业" placeholder="企业、城市或来源名称" value="${esc(get().filters.search)}"></label><div class="list-filters"><select id="industry" aria-label="产业筛选"><option value="">全部产业</option>${["风电", "环保", "核电"].map((item) => `<option ${get().filters.industry === item ? "selected" : ""}>${item}</option>`).join("")}</select><select id="risk-tier" aria-label="风险筛选"><option value="">全部风险</option>${["红灯", "黄灯", "绿灯", "黑灯"].map((item) => `<option ${get().filters.riskTier === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div id="filter-summary" class="filter-summary"></div><div id="entity-list" class="entity-list"></div><footer class="list-footer"><span>金额单位 · 亿元</span><select id="sort" aria-label="企业排序">${[
    ["risk", "风险优先"],
    ["cost", "成本最高"],
    ["gap", "缺口最大"],
    ["due", "到期最多"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${get().filters.sort === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></footer></aside><main class="map-workspace"><div class="map-stage"><div id="global-map" aria-label="全球企业地图"></div><div id="analysis-canvas" class="analysis-canvas" hidden></div><div class="map-top-tools"><div class="canvas-tabs">${[
    ["map", "地图", "map"],
    ["network", "关联网络", "share-2"],
    ["matrix", "成本与风险", "scatter-chart"],
  ]
    .map(
      ([id, label, glyph]) =>
        `<button data-action="canvas" data-canvas="${id}" title="${label}" aria-label="${label}" class="${get().view === id ? "active" : ""}">${icon(glyph)}</button>`,
    )
    .join(
      "",
    )}</div><div id="map-scope-label" class="map-scope-label"></div></div><div id="map-filter-actions" class="map-filter-actions"></div><div id="map-empty-state" class="map-empty-state" hidden><strong>没有匹配企业</strong>${button("reset-filters", "显示全部企业", "list-restart")}</div><div class="map-controls">${tool("zoom-in", "plus", "放大地图")}${tool("zoom-out", "minus", "缩小地图")}${tool("world", "globe-2", "全球视野")}${tool("fit", "scan", "适配当前企业")}${tool("box-select", "scan-line", "框选企业")}${tool("relationships", "route", "切换银行与担保关系", `aria-pressed="${get().relationships}"`)}</div><div class="map-footer"><div id="map-legend" class="map-legend"></div><div class="map-date-label">联合态势 · 数据截至 <time datetime="${esc(data.asOf)}">${esc(data.asOf)}</time></div><div class="mobile-pane-switch">${button("mobile-objects", "企业", "building-2")}${button("mobile-analysis", "分析", "messages-square")}</div></div></div><section class="data-dock ${get().tableOpen ? "expanded" : ""}" id="data-dock"></section></main><aside class="investigation" id="investigation"></aside></div>`;
  try {
    mapView = createMap({
      container: document.getElementById("global-map"),
      data,
      camera: get().camera,
      onSelect: (type, id) => openObject(type, id, true),
      onCamera: (camera) => {
        try {
          store.update({ camera });
        } catch {}
      },
      onBoxSelect: (ids) => {
        if (!ids.length) {
          notify("未框中企业，已保留原分析范围");
          return;
        }
        applyFilters(
          { ...get().filters, boxIds: [...new Set(ids)] },
          get().horizon,
          false,
        );
        notify(`已框选 ${ids.length} 家企业`);
      },
      onError: (message) => {
        busyError = message;
        notify(`地图加载异常：${message}`, true);
      },
    });
  } catch (error) {
    mapView = null;
    document.getElementById("global-map").innerHTML =
      `<div class="map-unavailable">${empty("地图暂不可用", error.message)}${button("retry-map", "重试地图", "refresh-cw")}</div>`;
  }
  refreshWorkbench();
}
function refreshWorkbench() {
  if (pageView !== "workbench") return;
  recompute();
  document.getElementById("metric-strip").innerHTML = [
    ["融资余额", amount(results.totals.balance), "balance"],
    ["加权融资成本", `${fmt(results.totals.cost)}%`, "weightedCost"],
    [`${get().horizon}天到期`, amount(results.totals.due), "maturity"],
    ["测算资金缺口", amount(results.totals.gap), "gap"],
    [
      "风险关注",
      `${results.totals.attention} / ${rows.length} 家`,
      "riskScore",
    ],
  ]
    .map(
      ([label, value, id]) =>
        `<button class="metric-cell" data-object-type="definition" data-object-id="${id}"><span>${label}${icon("info")}</span><strong>${value}</strong></button>`,
    )
    .join("");
  document.getElementById("entity-count").textContent =
    `${rows.length} / ${data.enterprises.length}`;
  const f = get().filters;
  const hasFilters =
    f.objectIds !== null ||
    f.boxIds != null ||
    Boolean(
      f.search ||
        f.industry ||
        f.riskTier ||
        f.bankId ||
        f.highCost ||
        f.gapOnly,
    );
  document.getElementById("filter-summary").innerHTML =
    `${f.objectIds !== null ? badge(`限定 ${f.objectIds.length} 家`) : ""}${f.boxIds != null ? badge(`框选 ${f.boxIds.length} 家`) : ""}${f.highCost ? badge(`成本偏离 > ${f.premiumThreshold || 0}bp`, "amber") : ""}${f.gapOnly ? badge("存在资金缺口", "red") : ""}${f.bankId ? badge(data.banks.find((bank) => bank.id === f.bankId)?.name || "银行范围") : ""}`;
  document.getElementById("entity-list").innerHTML =
    rows
      .map(
        (row) =>
          `<button class="entity-row ${get().selectedId === row.id ? "active" : ""}" data-object-type="enterprise" data-object-id="${row.id}"><div class="entity-row-title"><span class="risk-dot ${tierTone(row.riskTier)}"></span><strong>${esc(row.name)}</strong>${get().tasks.some((task) => task.objectIds.includes(row.id) && !["CANCELLED", "COMPLETED"].includes(task.status)) ? icon("list-checks") : ""}</div><div class="entity-row-meta"><span>${esc(row.city)} · ${row.industry}</span><span>${row.riskTier}</span></div><div class="entity-row-values"><span>成本 <b>${fmt(row.cost)}%</b></span><span>${get().mode === "maturity" ? "到期" : "余额"} <b>${fmt((get().mode === "maturity" ? row.due : row.balance) / 100)}</b></span></div></button>`,
      )
      .join("") ||
    `${empty("没有匹配企业")}<div class="empty-recovery">${button("reset-filters", "显示全部企业", "list-restart")}</div>`;
  document.getElementById("map-filter-actions").innerHTML =
    `${f.boxIds != null ? button("clear-box", "取消框选", "x") : ""}${hasFilters || !rows.length ? button("reset-filters", "显示全部企业", "list-restart") : ""}`;
  document.getElementById("map-empty-state").hidden =
    Boolean(rows.length) || get().view !== "map";
  document.getElementById("map-scope-label").innerHTML =
    `${badge(activePlan() ? "方案模拟" : "基准快照", activePlan() ? "amber" : "green")}<span>${rows.length} 家企业</span>`;
  document.getElementById("map-legend").innerHTML =
    get().mode === "risk"
      ? `<span><i class="risk-dot green"></i>绿灯</span><span><i class="risk-dot amber"></i>黄灯</span><span><i class="risk-dot red"></i>红灯</span><small>点大小 · 融资余额</small>`
      : get().mode === "cost"
        ? `<span><i class="risk-dot green"></i>不高于基准</span><span><i class="risk-dot amber"></i>偏高</span><span><i class="risk-dot red"></i>高于25bp</span>`
        : get().mode === "maturity"
          ? `<span><i class="risk-dot red"></i>测算存在缺口</span><span><i class="risk-dot green"></i>无测算缺口</span>`
          : `<span><i class="risk-dot blue"></i>银行借款敞口</span>`;
  mapView?.update(rows, {
    mode: get().mode,
    selectedId: get().selectedId,
    relationships: get().relationships,
    taskIds: get()
      .tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status))
      .flatMap((task) => task.objectIds),
    plan: activePlan(),
  });
  document.querySelector('[data-action="undo"]').disabled = !store.canUndo();
  renderInvestigation();
  renderDock();
  renderCanvas();
  refreshIcons();
}
function renderDock() {
  const dock = document.getElementById("data-dock");
  if (!dock) return;
  dock.classList.toggle("expanded", get().tableOpen);
  dock.innerHTML = `<header><button data-action="toggle-table">${icon(get().tableOpen ? "chevron-down" : "chevron-up")}<strong>对象明细</strong><span>${rows.length} 家企业 · ${results.loans.length} 笔借款</span></button><div>${button("export-csv", "导出", "download")}${button("create-report", "加入报告", "file-plus-2")}</div></header>${get().tableOpen ? `<div class="dock-scroll"><table><thead><tr><th>企业</th><th>融资余额</th><th>融资成本</th><th>${get().horizon}天到期</th><th>测算缺口</th><th>历史风险</th></tr></thead><tbody>${rows.map((row) => `<tr><td><button class="text-button" data-object-type="enterprise" data-object-id="${row.id}">${esc(row.name)}</button></td><td>${fmt(row.balance / 100)}</td><td>${fmt(row.cost)}%</td><td>${fmt(row.due / 100)}</td><td>${fmt(row.gap / 100)}</td><td>${badge(row.riskTier, tierTone(row.riskTier))}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}
function renderInvestigation() {
  const panel = document.getElementById("investigation");
  if (!panel) return;
  const composer = document.getElementById("question");
  if (composer) composerDraft = composer.value;
  panel.innerHTML = `<header class="investigation-head"><div>${icon("scan-search")}<strong>调查与分析</strong></div>${tool("close-mobile", "x", "关闭分析面板")}</header><div class="investigation-tabs" role="tablist">${[
    ["query", "问数"],
    ["object", "对象"],
    ["scenario", "方案"],
  ]
    .map(
      ([id, label]) =>
        `<button data-action="right-tab" data-tab="${id}" class="${get().rightTab === id ? "active" : ""}" role="tab" aria-selected="${get().rightTab === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="investigation-content" id="investigation-content">${get().rightTab === "query" ? queryPanel() : get().rightTab === "scenario" ? scenarioPanel() : objectPanel()}</div>${get().rightTab === "query" ? `<form class="query-composer" id="query-form"><textarea id="question" placeholder="询问当前企业、成本或风险…" aria-label="业务问题" rows="2" ${queryBusy ? "disabled" : ""}>${esc(composerDraft)}</textarea><div><span>语义问数 · 固定业务口径</span>${queryBusy ? tool("cancel-query", "square", "取消查询") : `<button class="send-button" type="submit" title="发送问题" aria-label="发送问题">${icon("arrow-up")}</button>`}</div></form>` : ""}`;
}
function queryPanel() {
  const suggestions = [
    "找出高成本且有资金缺口的企业",
    "未来90天到期多少？",
    "这些企业主要依赖哪些银行？",
    "有哪些担保关系？",
  ];
  return `<section class="query-context"><span class="eyebrow">当前分析范围</span><strong>${`${rows.length} 家企业`}</strong><span>${get().horizon}天 · ${activePlan() ? esc(activePlan().name) : "基准快照"}</span></section><div class="query-suggestions">${suggestions.map((question) => `<button data-action="ask" data-question="${esc(question)}">${esc(question)}${icon("arrow-up-right")}</button>`).join("")}</div>${
    get().queries.length
      ? get()
          .queries.slice(0, 8)
          .map(
            (answer) =>
              `<article class="answer"><div class="question-bubble">${esc(answer.question)}</div><header>${icon(answer.status === "failed" ? "circle-alert" : "sparkles")}<strong>${answer.status === "failed" ? "未完成" : answer.status === "cancelled" ? "已取消" : "分析结果"}</strong><span>${answer.evidence?.resultKind === "SIMULATION" ? "模拟" : "固定快照"}</span></header><p>${esc(answer.summary)}</p>${(
                answer.refs || []
              )
                .slice(0, 5)
                .map((ref) =>
                  objectButton(
                    ref.type,
                    ref.id,
                    ref.name,
                    ref.secondary,
                    ref.primary,
                  ),
                )
                .join(
                  "",
                )}${answer.refs?.length > 5 ? `<small>另有 ${answer.refs.length - 5} 条结果，完整对象集已保留。</small>` : ""}${answer.status === "success" ? `<footer>${button("apply-answer", "定位结果", "scan", false, `data-id="${answer.id}"`)}${button("report-answer", "加入报告", "file-plus-2", false, `data-id="${answer.id}"`)}${answer.intent === "simulate" ? button("scenario-answer", "比较方案", "git-compare-arrows", false, `data-id="${answer.id}"`) : ""}${button("task-answer", "发起事项", "list-plus", false, `data-id="${answer.id}"`)}</footer>${sourceDetails(answer.evidence, data)}` : ""}</article>`,
          )
          .join("")
      : `<section class="attention-list"><header><span class="eyebrow">风险关注</span><h3>优先查看</h3></header>${rows
          .filter((row) => row.riskTier !== "绿灯")
          .slice(0, 3)
          .map((row) =>
            objectButton(
              "enterprise",
              row.id,
              row.name,
              `${row.city} · 缺口 ${amount(row.gap)}`,
              row.riskTier,
            ),
          )
          .join("")}</section>`
  }${queryBusy ? `<div class="query-working" role="status"><span class="spinner"></span>正在解析口径与关联对象</div>` : ""}`;
}
function objectPanel() {
  const current =
    detailStack.at(-1) ||
    (get().selectedId ? { type: "enterprise", id: get().selectedId } : null);
  if (!current) return empty("尚未选择企业");
  const { type, id } = current;
  const back =
    detailStack.length > 1
      ? `<button class="back-link" data-action="detail-back">${icon("arrow-left")}返回上一级</button>`
      : "";
  if (type === "enterprise") {
    const row = metrics(data, [id], get().horizon, activePlan()).rows[0];
    if (!row) return empty("企业已不在当前数据版本");
    const owned = resultsForEntity(id),
      guarantees = data.guarantees.filter(
        (item) => item.guarantorId === id || item.beneficiaryId === id,
      ),
      tasks = get().tasks.filter((task) => task.objectIds.includes(id));
    return `${back}<section class="entity-profile"><div class="profile-icon">${icon("building-2")}</div><span class="eyebrow">${esc(row.city)} · ${row.industry}</span><h2>${esc(row.name)}</h2><div>${badge(row.riskTier, tierTone(row.riskTier))}${badge(id)}</div>${row.aliasNames.length > 1 ? `<small>来源别名 · ${esc(row.aliasNames.slice(1).join(" / "))}</small>` : ""}</section><div class="profile-metrics">${[
      ["融资成本", `${fmt(row.cost)}%`, "weightedCost"],
      ["历史风险评分", `${fmt(row.riskScore)} 分`, "riskScore"],
      ["融资余额", amount(row.balance), "balance"],
      ["到期资金缺口", amount(row.gap), "gap"],
    ]
      .map(
        ([name, value, key]) =>
          `<button data-object-type="definition" data-object-id="${key}"><span>${name}</span><strong>${value}</strong>${icon("chevron-right")}</button>`,
      )
      .join(
        "",
      )}</div><div class="profile-actions">${button("ask-selected", "解释这家企业", "sparkles", true)}${button("new-scenario", "比较方案", "git-compare-arrows")}${button("new-task", "发起事项", "list-plus")}</div><section class="detail-section"><header><h3>融资明细</h3><span>${owned.loans.length} 笔</span></header>${owned.loans.map((loan) => objectButton("loan", loan.id, data.banks.find((bank) => bank.id === loan.bankId).name, `${loan.maturityDate} 到期 · ${loan.rateType === "FLOATING" ? "浮息" : "固息"}`, `${fmt(loan.rate)}%`)).join("")}</section><section class="detail-section"><header><h3>授信与资金</h3></header>${facts(
      [
        ["可用现金", amount(row.cash)],
        ["有效未用授信", amount(row.credit)],
        ["未来到期本金", amount(row.due)],
      ],
    )}${data.facilities
      .filter((facility) => facility.enterpriseId === id)
      .map((facility) =>
        objectButton(
          "facility",
          facility.id,
          facility.name,
          `有效期至 ${facility.validUntil}`,
          amount(facilityUndrawn(facility, activePlan())),
        ),
      )
      .join(
        "",
      )}</section><section class="detail-section"><header><h3>担保关系</h3><span>${guarantees.length} 条</span></header>${guarantees.map((item) => objectButton("guarantee", item.id, item.guarantorId === id ? "对外担保" : "获得担保", item.name, amount(item.amount))).join("") || `<p class="muted">暂无已登记担保关系</p>`}</section><section class="detail-section"><header><h3>项目与事件</h3></header>${data.projects
      .filter((item) => item.enterpriseId === id)
      .map((item) => objectButton("project", item.id, item.name, item.stage))
      .join("")}${data.events
      .filter((item) => item.enterpriseId === id)
      .map((item) => objectButton("event", item.id, item.name, item.date))
      .join(
        "",
      )}</section><section class="detail-section"><header><h3>跟踪事项</h3><span>${tasks.length}</span></header>${tasks.map((task) => `<button class="linked-row" data-action="open-task" data-id="${task.id}"><span><strong>${esc(task.title)}</strong><small>${esc(task.owner)}</small></span>${badge(taskLabels[task.status])}</button>`).join("") || `<p class="muted">暂无跟踪事项</p>`}</section>${sourceDetails(owned, data)}`;
  }
  if (type === "loan") {
    const loan = projectedLoan(id);
    if (!loan) return empty("借款不存在");
    const bank = data.banks.find((item) => item.id === loan.bankId),
      entity = data.enterprises.find((item) => item.id === loan.enterpriseId);
    return `${back}<span class="eyebrow">借款合同</span><h2>${esc(loan.name)}</h2>${badge(activePlan() ? "模拟借款" : "合成借款", activePlan() ? "amber" : "")}<code class="identity-code">${id}</code>${facts(
      [
        ["存续本金", amount(loan.principal)],
        ["执行年利率", `${fmt(loan.rate, 4)}%`],
        ["利率形式", loan.rateType === "FLOATING" ? "浮动利率" : "固定利率"],
        ["到期日", loan.maturityDate],
        ["币种", "人民币"],
        ["借款状态", "当期存续"],
      ],
    )}${objectButton("enterprise", entity.id, entity.name, "借款主体")}${objectButton("bank", bank.id, bank.name, "贷款银行")}${objectButton("project", loan.projectId, data.projects.find((item) => item.id === loan.projectId).name, "资金关联项目")}${sourceDetails(resultsForEntity(entity.id), data)}`;
  }
  if (type === "bank") {
    const bank = data.banks.find((item) => item.id === id);
    if (!bank) return empty("银行不存在");
    const exposure = bankExposure(
      data,
      metrics(data, undefined, get().horizon, activePlan()),
    ).find((item) => item.id === id);
    return `${back}<span class="eyebrow">金融机构</span><h2>${esc(bank.name)}</h2>${facts(
      [
        [
          "当前企业集敞口",
          amount(
            bankExposure(data, results).find((item) => item.id === id)
              ?.balance || 0,
          ),
        ],
        ["全体企业借款", amount(exposure?.balance || 0)],
        ["借款企业", `${exposure?.enterpriseIds.length || 0} 家`],
        ["演示位置", esc(bank.city)],
      ],
    )}${button("filter-bank", "查看关联企业", "scan", true, `data-id="${id}"`)}${(
      exposure?.enterpriseIds || []
    )
      .map((entityId) => {
        const entity = data.enterprises.find((item) => item.id === entityId);
        return objectButton("enterprise", entityId, entity.name, entity.city);
      })
      .join("")}${sourceDetails(results, data)}`;
  }
  if (type === "guarantee") {
    const item = data.guarantees.find((item) => item.id === id);
    if (!item) return empty("担保关系不存在");
    return `${back}<span class="eyebrow">担保合同</span><h2>企业担保关系</h2>${badge("合成关系", "amber")}${facts(
      [
        ["担保金额", amount(item.amount)],
        ["有效期", item.validUntil],
        ["计算边界", "不重复计入借款余额；不自动推断风险传播"],
      ],
    )}${objectButton("enterprise", item.guarantorId, data.enterprises.find((entity) => entity.id === item.guarantorId).name, "担保方")}${objectButton("enterprise", item.beneficiaryId, data.enterprises.find((entity) => entity.id === item.beneficiaryId).name, "被担保方")}${sourceDetails(results, data)}`;
  }
  if (type === "definition") {
    const item = data.definitions.find((item) => item.id === id);
    return item
      ? `${back}<span class="eyebrow">统一业务定义</span><h2>${item.name}</h2>${badge(data.ontologyVersion)}<div class="formula">${esc(item.expression)}</div><p>${esc(item.scope)}</p><section class="detail-section"><header><h3>计算输入</h3></header>${item.inputs.map((input) => `<div class="dependency-row">${icon("arrow-up-right")}<code>${esc(input)}</code></div>`).join("")}</section>${definitionInputs(id)}<section class="detail-section"><header><h3>共享消费</h3></header><div class="consumer-tags">${item.consumers.map((name) => badge(name, "green")).join("")}</div></section>${button("show-ontology", "查看本体依赖", "network")}${sourceDetails(results, data)}`
      : empty("定义不存在");
  }
  const collection = {
    facility: data.facilities,
    project: data.projects,
    event: data.events,
  }[type];
  const item = collection?.find((item) => item.id === id);
  if (!item) return empty("对象不存在");
  return `${back}<span class="eyebrow">${{ facility: "银行授信", project: "经营项目", event: "业务事件" }[type]}</span><h2>${esc(item.name)}</h2>${facts(
    type === "facility"
      ? [
          [
            activePlan() ? "方案未用额度" : "未用额度",
            amount(facilityUndrawn(item, activePlan())),
          ],
          ...(activePlan() ? [["原快照未用", amount(item.undrawn)]] : []),
          ["有效期", item.validUntil],
          [
            "当前窗口可用",
            item.validUntil >= results.end
              ? amount(facilityUndrawn(item, activePlan()))
              : "0.00 亿元",
          ],
        ]
      : type === "project"
        ? [
            ["项目状态", item.stage],
            ["位置", "城市级演示位置"],
          ]
        : [
            ["发生时间", item.date],
            ["源快照状态", item.status],
          ],
  )}${objectButton("enterprise", item.enterpriseId, data.enterprises.find((entity) => entity.id === item.enterpriseId).name, "关联企业")}${item.bankId ? objectButton("bank", item.bankId, data.banks.find((bank) => bank.id === item.bankId).name, "授信银行") : ""}${sourceDetails(results, data)}`;
}
function resultsForEntity(id) {
  return metrics(data, [id], get().horizon, activePlan());
}
function projectedLoan(id) {
  return metrics(data, undefined, get().horizon, activePlan()).loans.find(
    (loan) => loan.id === id,
  );
}

function scenarioPanel() {
  if (!planDraft)
    planDraft = activePlan()
      ? {
          name: activePlan().name,
          objectIds: clone(activePlan().objectIds),
          parameters: clone(activePlan().parameters),
        }
      : {
          name: "融资调整方案",
          objectIds: get().selectedId
            ? [get().selectedId]
            : rows.map((row) => row.id),
          parameters: defaultParams(),
        };
  let comparison = null,
    error = "";
  try {
    if (planDraft.objectIds.length)
      comparison = comparePlan(data, {
        id: "preview",
        ...planDraft,
        dataVersion: data.dataVersion,
        dataDigest: data.digest,
        ontologyVersion: data.ontologyVersion,
        horizon: get().horizon,
      });
  } catch (caught) {
    error = caught.message;
  }
  return `<section class="scenario-heading"><span class="eyebrow">独立方案</span><h2>融资条件推演</h2><span>${planDraft.objectIds.length} 家企业 · ${get().horizon}天窗口</span></section><form id="scenario-form"><label class="field">方案名称<input name="name" id="scenario-name" value="${esc(planDraft.name)}" maxlength="60" required></label><label class="field">适用银行<select id="scenario-bank"><option value="">全部关联银行</option>${data.banks.map((bank) => `<option value="${bank.id}" ${planDraft.parameters.bankId === bank.id ? "selected" : ""}>${esc(bank.name)}</option>`).join("")}</select></label><label class="range-field"><span>浮息利率变化 <strong>${planDraft.parameters.rateBps > 0 ? "+" : ""}${planDraft.parameters.rateBps} bp</strong></span><input type="range" id="scenario-rate" min="-200" max="500" step="10" value="${planDraft.parameters.rateBps}" aria-label="浮息利率变化"><small>只影响浮息借款，100bp = 1个百分点</small></label><label class="range-field"><span>未用授信收缩 <strong>${planDraft.parameters.creditHaircut}%</strong></span><input type="range" id="scenario-credit" min="0" max="100" step="5" value="${planDraft.parameters.creditHaircut}" aria-label="未用授信收缩"></label><label class="field">借款展期天数<input id="scenario-extension" type="number" min="0" max="365" step="1" value="${planDraft.parameters.extensionDays}"></label>${error ? `<p class="error-message">${esc(error)}</p>` : ""}${
    comparison
      ? `<div class="scenario-comparison"><header><span>当前基准</span><span>方案模拟</span></header>${[
          [
            "加权成本",
            `${fmt(comparison.before.totals.cost)}%`,
            `${fmt(comparison.after.totals.cost)}%`,
          ],
          [
            "到期本金",
            amount(comparison.before.totals.due),
            amount(comparison.after.totals.due),
          ],
          [
            "测算缺口",
            amount(comparison.before.totals.gap),
            amount(comparison.after.totals.gap),
          ],
        ]
          .map(
            ([label, a, b]) =>
              `<div><span>${label}</span><strong>${a}</strong>${icon("arrow-right")}<strong>${b}</strong></div>`,
          )
          .join(
            "",
          )}</div><p class="compact-note">年化利息变化 ${amount(comparison.after.totals.annualInterest - comparison.before.totals.annualInterest)}。本金不变估计；历史风险评分不变。</p>`
      : ""
  }<button class="button primary wide" type="submit" ${!planDraft.objectIds.length ? "disabled" : ""}>${icon("save")}保存并应用方案</button></form>${button("nav", "查看已保存方案", "git-compare-arrows", false, 'data-view="plans"')}`;
}

function updateScenarioPreview() {
  const preview = document.createElement("div");
  preview.innerHTML = scenarioPanel();
  for (const selector of [".scenario-comparison", ".compact-note"]) {
    const next = preview.querySelector(selector),
      current = document.querySelector(`#scenario-form ${selector}`);
    if (next && current) current.replaceWith(next);
  }
  refreshIcons();
}
function definitionInputs(id) {
  const scope = get().selectedId ? resultsForEntity(get().selectedId) : results;
  const key = {
    balance: "balance",
    weightedCost: "cost",
    maturity: "due",
    gap: "gap",
    exposure: "balance",
  }[id];
  const actual = key ? scope.totals[key] : null;
  const owned = get().selectedId ? scope.rows[0] : null;
  const loans =
    id === "maturity" || id === "gap"
      ? scope.loans.filter((loan) => loan.maturityDate <= scope.end)
      : scope.loans;
  return `<section class="detail-section"><header><h3>${owned ? esc(owned.name) : `${scope.rows.length} 家企业`} · 当前取值</h3></header>${
    key
      ? facts([
          ["计算结果", key === "cost" ? `${fmt(actual, 4)}%` : amount(actual)],
          ["观察日 / 窗口", `${scope.asOf} / ${scope.horizon}天`],
        ])
      : ""
  }${id === "riskScore" ? scope.rows.map((row) => objectButton("enterprise", row.id, row.name, `历史评分引用 · ${row.riskSource.id || row.id}`, `${fmt(row.riskScore)}分`)).join("") : id === "costPremium" ? scope.rows.map((row) => objectButton("enterprise", row.id, row.name, `${fmt(row.cost)}% − 基准 ${fmt(row.benchmarkRate)}%`, `${fmt(row.premium)}bp`)).join("") : loans.map((loan) => objectButton("loan", loan.id, loan.name, `${loan.maturityDate} · ${fmt(loan.rate, 4)}%`, amount(loan.principal))).join("")}${
    id === "gap"
      ? facts([
          [
            "可用现金合计",
            amount(scope.rows.reduce((sum, row) => sum + row.cash, 0)),
          ],
          [
            "有效未用授信",
            amount(scope.rows.reduce((sum, row) => sum + row.credit, 0)),
          ],
          ["汇总边界", "先逐企业计算缺口，再相加；不跨主体抵销"],
        ])
      : ""
  }</section>`;
}
function plansPage() {
  return `<div class="page-header"><div><span class="eyebrow">SCENARIOS</span><h1>分析方案</h1><p>基准快照与独立假设</p></div>${button("new-scenario", "新建方案", "plus", true)}</div><div class="plans-layout">${
    get().plans.length
      ? get()
          .plans.map((plan) => {
            let c;
            try {
              c = comparePlan(data, plan);
            } catch {
              return `<article class="plan-card"><h2>${esc(plan.name)}</h2>${badge("输入版本已变化", "amber")}</article>`;
            }
            return `<article class="plan-card"><header><div>${badge("模拟", "amber")}<h2>${esc(plan.name)}</h2></div><label class="compare-check"><input type="checkbox" data-compare-plan="${plan.id}" ${get().comparisonIds.includes(plan.id) ? "checked" : ""}>对比</label></header><p>${plan.objectIds.length} 家企业 · ${plan.horizon}天 · ${plan.createdAt.slice(0, 16).replace("T", " ")}</p>${facts(
              [
                ["浮息变化", `${plan.parameters.rateBps} bp`],
                ["授信收缩", `${plan.parameters.creditHaircut}%`],
                ["展期", `${plan.parameters.extensionDays}天`],
                [
                  "年化利息变化",
                  amount(
                    c.after.totals.annualInterest -
                      c.before.totals.annualInterest,
                  ),
                ],
                ["测算缺口", amount(c.after.totals.gap)],
              ],
            )}<footer>${button("apply-plan", "地图查看", "map", true, `data-id="${plan.id}"`)}${button("task-plan", "发起事项", "list-plus", false, `data-id="${plan.id}"`)}${tool("delete-plan", "trash-2", "删除方案", `data-id="${plan.id}"`)}</footer></article>`;
          })
          .join("")
      : empty("尚无方案", "从企业详情或问数结果开始比较")
  }</div>${get().comparisonIds.length === 2 ? planComparison() : ""}`;
}
function planComparison() {
  const plans = get().comparisonIds.map((id) =>
    get().plans.find((plan) => plan.id === id),
  );
  if (plans.some((plan) => !plan)) return "";
  const [a, b] = plans;
  const aligned =
    JSON.stringify([...a.objectIds].sort()) ===
      JSON.stringify([...b.objectIds].sort()) &&
    a.horizon === b.horizon &&
    a.dataDigest === b.dataDigest;
  const ca = comparePlan(data, a),
    cb = comparePlan(data, b);
  return `<section class="comparison-section"><header><h2>双方案比较</h2>${badge(aligned ? "同范围同口径" : "范围或窗口不同，仅并列展示", aligned ? "green" : "amber")}</header><table><thead><tr><th>指标</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${[
    ["企业数", a.objectIds.length, b.objectIds.length],
    ["展望天数", a.horizon, b.horizon],
    [
      "年化利息",
      amount(ca.after.totals.annualInterest),
      amount(cb.after.totals.annualInterest),
    ],
    [
      "加权成本",
      `${fmt(ca.after.totals.cost)}%`,
      `${fmt(cb.after.totals.cost)}%`,
    ],
    ["到期本金", amount(ca.after.totals.due), amount(cb.after.totals.due)],
    ["资金缺口", amount(ca.after.totals.gap), amount(cb.after.totals.gap)],
  ]
    .map(
      ([label, x, y]) => `<tr><th>${label}</th><td>${x}</td><td>${y}</td></tr>`,
    )
    .join("")}</tbody></table></section>`;
}
function tasksPage() {
  const tasks = get().tasks.filter(
    (task) => taskFilter === "all" || task.status === taskFilter,
  );
  return `<div class="page-header"><div><span class="eyebrow">OPERATIONS</span><h1>事项跟踪</h1><p>${get().tasks.length} 项本地事项 · 外部执行 0</p></div>${button("new-task", "新建事项", "plus", true)}</div><div class="document-tabs">${[["all", "全部"], ...Object.entries(taskLabels)].map(([id, label]) => `<button data-action="task-filter" data-filter="${id}" class="${taskFilter === id ? "active" : ""}">${label}<b>${id === "all" ? get().tasks.length : get().tasks.filter((task) => task.status === id).length}</b></button>`).join("")}</div><div class="task-list">${tasks.map((task) => `<button class="task-row" data-action="open-task" data-id="${task.id}"><span class="task-symbol">${icon(task.status === "COMPLETED" ? "circle-check" : "list-checks")}</span><span><strong>${esc(task.title)}</strong><small>${task.objectIds.length} 家企业 · ${esc(task.type)}</small></span><span>${esc(task.owner)}<small>${task.dueDate}</small></span>${badge(taskLabels[task.status], task.status === "COMPLETED" ? "green" : task.status === "CANCELLED" ? "" : "amber")}${icon("chevron-right")}</button>`).join("") || empty("当前没有事项")}</div>`;
}
function reportsPage() {
  return `<div class="page-header"><div><span class="eyebrow">REPORTS</span><h1>分析报告</h1><p>对象、分析口径与方案的固定快照</p></div>${button("create-report", "新建报告", "file-plus-2", true)}</div><div class="report-list">${
    get()
      .reports.map(
        (report) =>
          `<article class="report-row"><span class="report-file">${icon("file-chart-column")}</span><div><h2>${esc(report.title)}</h2><p>${report.rows.length} 家企业 · ${report.evidence.horizon}天 · ${report.createdAt.slice(0, 16).replace("T", " ")}</p><small>${esc(report.evidence.dataVersion)}</small></div>${badge(report.status === "REVIEWED" ? "已复核" : "待复核", report.status === "REVIEWED" ? "green" : "amber")}<div>${button("open-report", "预览与编辑", "eye", false, `data-id="${report.id}"`)}${tool("export-report", "download", "导出报告", `data-id="${report.id}"`)}</div></article>`,
      )
      .join("") || empty("尚无分析报告")
  }</div><section class="archive-link"><h2>历史正式报告</h2><p>原有已发布报告、正文、PDF与核验记录保持冻结。</p>${embedded ? button("native-center", "报告目录与正式报告", "files", false, 'data-module="report" data-task="catalog"') : '<a class="button" href="/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/report">报告中心</a>'}</section>`;
}
function ontologyPage() {
  const def =
    data.definitions.find((item) => item.id === selectedDefinition) ||
    data.definitions[0];
  return `<div class="page-header"><div><span class="eyebrow">ONTOLOGY</span><h1>数据与本体</h1><p>${data.ontologyVersion} · 固定数据版本 ${data.dataVersion}</p></div>${button("source", "来源与假设", "fingerprint")}</div><div class="ontology-stats">${[
    ["企业", data.enterprises.length, "building-2"],
    ["银行", data.banks.length, "landmark"],
    ["借款", data.loans.length, "file-text"],
    ["授信", data.facilities.length, "wallet-cards"],
    ["担保", data.guarantees.length, "link-2"],
    ["项目", data.projects.length, "factory"],
  ]
    .map(
      ([name, count, glyph]) =>
        `<div>${icon(glyph)}<span>${name}</span><strong>${count}</strong></div>`,
    )
    .join(
      "",
    )}</div><div class="ontology-layout"><nav class="definition-nav">${data.definitions.map((item) => `<button class="${item.id === def.id ? "active" : ""}" data-action="select-definition" data-id="${item.id}">${icon("workflow")}<span>${item.name}<small>${item.unit}</small></span></button>`).join("")}</nav><section class="ontology-definition"><h2>${def.name}</h2><div class="formula">${esc(def.expression)}</div><p>${esc(def.scope)}</p><div id="ontology-graph" class="ontology-graph"></div><div class="semantic-experiment"><header><h3>语义规则沙盒</h3>${badge("草稿，不覆盖基准", "amber")}</header><form id="semantic-form"><label>高成本偏离阈值<input type="number" id="semantic-threshold" min="0" max="200" value="25" step="5">bp</label><button class="button" type="submit">${icon("scan")}预览影响</button></form><div id="semantic-result"></div></div></section></div><section class="data-sources"><h2>数据版本</h2>${facts(
    [
      ["企业身份", "沿用 ENT-001 至 ENT-021；角色与来源别名单独保存"],
      ["融资明细", "84笔独立合成借款，三个主体总额与成本对齐旧快照"],
      ["风险评分", "21家企业的历史1.0.2评分，不随方案重算"],
      ["位置", "城市级演示位置，非实际注册地址"],
      ["缺口模型", "确定性公式，现金和授信均为演示输入"],
    ],
  )}</section><section class="archive-link"><h2>专业工作区</h2><p>数据、语义、运行与证据</p><div class="legacy-links">${[
    ["data", "数据工程", "database"],
    ["ontology", "本体建模", "network"],
    ["decision", "审批与决策", "circle-check"],
    ["agent", "Agent 应用", "bot"],
    ["query", "问数工作区", "messages-square"],
    ["dashboard", "经营驾驶舱", "layout-dashboard"],
    ["m07", "历史对象探索", "scan-search"],
  ]
    .map(([route, label, glyph]) =>
      embedded
        ? button("native-center", label, glyph, false, `data-module="${route}"`)
        : `<a class="button" href="/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#${route === "dashboard" ? "dashboard" : "module/" + route}">${icon(glyph)}${label}</a>`,
    )
    .join("")}</div></section>`;
}
function modelsPage() {
  return `<div class="page-header"><div><span class="eyebrow">MODELING</span><h1>模型验证</h1><p>独立模型试验环境 · 不将模型候选覆盖为融资事实</p></div><select id="model-program" aria-label="模型业务目标"><option value="S003">债务风险</option><option value="S001">融资成本</option><option value="S002">预算监督</option><option value="S004">贷前评估</option><option value="S005">投后评价</option></select></div><div class="model-frame-stage"><iframe id="model-frame" title="模型验证工作区"></iframe></div>`;
}

function openObject(type, id, reset = false) {
  if (detailStack.length)
    detailStack.at(-1).scrollTop =
      document.getElementById("investigation-content")?.scrollTop || 0;
  if (reset) detailStack = [];
  if (pageView !== "workbench") {
    pageView = "workbench";
    shell();
  }
  if (type === "enterprise") {
    save({ selectedId: id, rightTab: "object" });
    if (detailStack.at(-1)?.id !== id) detailStack.push({ type, id });
  } else {
    if (!detailStack.length && get().selectedId)
      detailStack = [{ type: "enterprise", id: get().selectedId }];
    detailStack.push({ type, id });
    save({ rightTab: "object" });
  }
  syncRoute();
  refreshWorkbench();
  if (type === "enterprise") mapView?.focus(id);
  document
    .getElementById("object-list-pane")
    .classList.remove("mobile-visible");
  document.getElementById("investigation").classList.add("mobile-visible");
}
function applyFilters(filters, horizon = get().horizon, fit = true) {
  mapView?.setChoosing(false);
  save({ filters, horizon, selectedId: null }, { undoable: true });
  detailStack = [];
  refreshWorkbench();
  syncInputs();
  syncRoute();
  if (fit) mapView?.fit(rows.map((row) => row.id));
}
function syncInputs() {
  for (const [id, value] of [
    ["entity-search", get().filters.search],
    ["industry", get().filters.industry],
    ["risk-tier", get().filters.riskTier],
    ["horizon", get().horizon],
    ["sort", get().filters.sort],
  ]) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }
  document.querySelectorAll("[data-mode]").forEach((node) => {
    node.classList.toggle("active", node.dataset.mode === get().mode);
    node.setAttribute(
      "aria-selected",
      String(node.dataset.mode === get().mode),
    );
  });
}
function syncRoute(replace = false) {
  const params = new URLSearchParams();
  if (get().selectedId) params.set("entity", get().selectedId);
  params.set("view", pageView);
  const hash = `#${params}`;
  if (location.hash !== hash)
    history[replace || embedded ? "replaceState" : "pushState"](
      { view: pageView, selectedId: get().selectedId },
      "",
      hash,
    );
  send("OFW_V14_VIEW_CHANGED", { view: pageView });
}
function showModal(title, body, footer = "") {
  if (modal.open) modal.close();
  modal.innerHTML = `<header><h2>${esc(title)}</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">${icon("x")}</button></header><div class="modal-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ""}`;
  modal.showModal();
  refreshIcons();
}
function startScenario(ids = null) {
  recompute();
  planDraft = {
    name: "融资调整方案",
    objectIds:
      ids ||
      (get().selectedId ? [get().selectedId] : rows.map((row) => row.id)),
    parameters: defaultParams(),
  };
  save({ rightTab: "scenario" });
  if (pageView !== "workbench") {
    pageView = "workbench";
    shell();
  } else renderInvestigation();
  refreshIcons();
}
function createReport(
  result = null,
  notes = "",
  plan = undefined,
  evidence = null,
) {
  if (!result) {
    recompute();
    result = results;
  }
  const fixedPlan =
    plan === undefined
      ? get().plans.find((item) => item.id === result.planId) || null
      : plan;
  const report = reportSnapshot(result, {
    title: `${fixedPlan ? "方案模拟" : "企业融资与风险"}分析报告`,
    notes:
      notes ||
      `${result.rows.length}家企业；融资成本、到期债务与资金缺口采用同一口径。`,
    plan: fixedPlan,
    evidence: evidence || {
      dataVersion: result.dataVersion,
      dataDigest: result.dataDigest,
      ontologyVersion: result.ontologyVersion,
      asOf: result.asOf,
      horizon: result.horizon,
      objectIds: result.rows.map((row) => row.id),
      resultKind: result.resultKind,
      planId: result.planId,
      rule: get().filters.highCost
        ? {
            id: get().filters.ruleId || "baseline",
            premiumThreshold: get().filters.premiumThreshold || 0,
          }
        : null,
    },
  });
  save({ reports: [report, ...get().reports] });
  send("OFW_V14_REPORT", { report });
  notify("报告快照已保存");
  openReport(report.id);
}
function restoreBasis(plan, evidence) {
  if (
    evidence.dataDigest !== data.digest ||
    evidence.ontologyVersion !== data.ontologyVersion
  )
    throw new Error("历史输入版本已变化，仍可导出快照，但不能套用到当前地图");
  if (evidence.planId && !plan) throw new Error("历史方案快照缺失");
  if (plan) {
    comparePlan(data, plan);
    if (!get().plans.some((item) => item.id === plan.id))
      save({ plans: [clone(plan), ...get().plans] });
  }
  save({ activePlanId: plan?.id || null });
  const select = document.getElementById("active-plan");
  if (select) {
    if (
      plan &&
      !Array.from(select.options).some((option) => option.value === plan.id)
    )
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${plan.id}">方案 · ${esc(plan.name)}</option>`,
      );
    select.value = plan?.id || "";
  }
}
function openReport(id) {
  const report = get().reports.find((item) => item.id === id);
  if (!report) return;
  reportSelected = id;
  showModal(
    `${report.status === "REVIEWED" ? "已复核报告" : "分析报告草稿"} · v${report.version || 1}`,
    `<form id="report-edit"><label class="field">报告标题<input id="report-title" value="${esc(report.title)}" maxlength="100" ${report.status === "REVIEWED" ? "readonly" : ""}></label><label class="field">分析结论<textarea id="report-notes" rows="4" ${report.status === "REVIEWED" ? "readonly" : ""}>${esc(report.notes)}</textarea></label><div class="report-preview"><h3>${report.rows.length} 家企业 · ${report.evidence.horizon}天</h3>${facts(
      [
        ["融资余额", amount(report.totals.balance)],
        ["加权成本", `${fmt(report.totals.cost)}%`],
        ["到期本金", amount(report.totals.due)],
        ["测算缺口", amount(report.totals.gap)],
      ],
    )}<div class="preview-objects">${report.rows.map((row) => `<span>${esc(row.name)} · ${row.riskTier}</span>`).join("")}</div>${sourceDetails(report.evidence, data)}</div><button class="button primary" type="submit" ${report.status === "REVIEWED" ? "disabled" : ""}>${icon("save")}保存编辑</button></form>`,
    (embedded
      ? button(
          "native-report",
          "在报告中心整理",
          "files",
          false,
          `data-id="${id}"`,
        )
      : "") +
      button(
        report.status === "REVIEWED" ? "revise-report" : "review-report",
        report.status === "REVIEWED" ? "修订草稿" : "提交复核",
        report.status === "REVIEWED" ? "file-pen-line" : "badge-check",
        false,
        `data-id="${id}"`,
      ) +
      button("export-report", "导出 HTML", "download", true, `data-id="${id}"`),
  );
}
function taskForm(ids = null, plan = undefined, evidence = null) {
  recompute();
  const fixedPlan = plan === undefined ? activePlan() : plan;
  const objectIds =
    ids || (get().selectedId ? [get().selectedId] : rows.map((row) => row.id));
  const source = evidence || {
    dataVersion: data.dataVersion,
    dataDigest: data.digest,
    ontologyVersion: data.ontologyVersion,
    asOf: data.asOf,
    horizon: get().horizon,
    objectIds,
    resultKind: fixedPlan ? "SIMULATION" : "DEMO_BASELINE",
    planId: fixedPlan?.id || null,
  };
  modal.taskInput = { objectIds, plan: fixedPlan, evidence: source };
  showModal(
    "发起跟踪事项",
    `<form id="task-form"><div class="task-scope">${badge(`${objectIds.length} 家企业`)}${badge(fixedPlan ? "附带模拟方案" : "基准分析", "amber")}</div><label class="field">事项名称<input id="task-title" required maxlength="100" value="${objectIds.length === 1 ? esc(data.enterprises.find((item) => item.id === objectIds[0])?.name) + " · " : ""}融资与风险复核"></label><label class="field">事项类型<select id="task-type"><option>风险复核</option><option>银行协商</option><option>融资安排</option><option>补充资料</option></select></label><label class="field">负责人<input id="task-owner" required maxlength="50" value="${objectIds.length === 1 ? esc(data.enterprises.find((item) => item.id === objectIds[0])?.owner || "") : ""}"></label><label class="field">到期日期<input id="task-due" type="date" required min="${new Date().toISOString().slice(0, 10)}" value="${new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}"></label><label class="checkbox-field"><input id="task-confirm" type="checkbox" required>确认创建本地跟踪事项，不发送外部通知或执行金融交易</label><p class="form-error" id="task-error" role="alert"></p><button type="submit" class="button primary wide">${icon("check")}确认创建</button></form>`,
  );
}
function openTask(id) {
  const task = get().tasks.find((item) => item.id === id);
  if (!task) return;
  showModal(
    task.title,
    `${facts([
      ["当前状态", badge(taskLabels[task.status])],
      ["负责人", esc(task.owner)],
      ["到期日期", task.dueDate],
      ["关联企业", `${task.objectIds.length} 家`],
      ["原始依据", `<code>${esc(task.evidence.dataVersion)}</code>`],
    ])}<section class="activity-list"><h3>处理记录</h3>${task.history.map((event) => `<article><i></i><div><strong>${taskLabels[event.to]}</strong><p>${esc(event.note)}</p><small>${event.at.slice(0, 16).replace("T", " ")}</small></div></article>`).join("")}</section><form id="task-transition" data-id="${id}"><label class="field">处理结果 / 变更原因<textarea id="task-note" required rows="3"></textarea></label><label class="field">更新状态<select id="task-status">${taskTransitions[task.status].map((status) => `<option value="${status}">${taskLabels[status]}</option>`).join("")}</select></label><p class="form-error" id="task-error" role="alert"></p><button type="submit" class="button primary">${icon("check")}保存处理</button></form>`,
    (!["COMPLETED", "CANCELLED"].includes(task.status)
      ? button(
          "edit-task",
          "调整分办",
          "user-round-pen",
          false,
          `data-id="${id}"`,
        )
      : "") +
      button("locate-task", "地图定位", "map", false, `data-id="${id}"`) +
      button(
        "report-task",
        "生成复核报告",
        "file-plus-2",
        false,
        `data-id="${id}"`,
      ),
  );
}
async function ask(question) {
  composerDraft = "";
  const composer = document.getElementById("question");
  if (composer) composer.value = "";
  pendingQuestion = question;
  const epoch = ++queryEpoch,
    context = {
      filters: clone(get().filters),
      horizon: get().horizon,
      plan: activePlan() ? clone(activePlan()) : null,
      selectedId: get().selectedId,
    };
  queryBusy = true;
  save({ rightTab: "query" });
  renderInvestigation();
  refreshIcons();
  await new Promise((resolve) => setTimeout(resolve, 320));
  if (epoch !== queryEpoch) return;
  try {
    const answer = query(data, question, context);
    const saved = {
      id: crypto.randomUUID(),
      status: "success",
      intent: answer.parsed.intent,
      question,
      summary: answer.summary,
      refs: answer.refs,
      evidence: answer.evidence,
      filters: answer.filters,
      horizon: answer.horizon,
      snapshot: answer.result,
      plan: context.plan,
      parameters: answer.parsed.parameters || null,
      createdAt: new Date().toISOString(),
    };
    save({ queries: [saved, ...get().queries].slice(0, 30) });
    if (["filter", "overview"].includes(answer.parsed.intent))
      applyFilters(answer.filters, answer.horizon);
    if (answer.parsed.intent === "simulate")
      notify("分析范围已固定，可打开方案调整参数");
  } catch (error) {
    save({
      queries: [
        {
          id: crypto.randomUUID(),
          status: "failed",
          question,
          summary: error.message,
          createdAt: new Date().toISOString(),
        },
        ...get().queries,
      ].slice(0, 30),
    });
  } finally {
    queryBusy = false;
    refreshWorkbench();
    document.getElementById("question")?.focus();
  }
}
function mountModelFrame() {
  const frame = document.getElementById("model-frame");
  if (!frame) return;
  const scenario = document.getElementById("model-program").value;
  const url = new URL(
    "/designs/prototype-work/v1.4/composite/model-center/index.html",
    location.origin,
  );
  url.searchParams.set("scenarioId", scenario);
  url.searchParams.set("apiBase", `${location.origin}/model-api`);
  url.searchParams.set("programIds", "S001,S002,S003,S004,S005");
  url.hash = "objectives";
  frame.src = url.href;
}
function renderCanvas() {
  const canvas = document.getElementById("analysis-canvas"),
    map = document.getElementById("global-map");
  if (!canvas) return;
  canvas.hidden = get().view === "map";
  map.hidden = get().view !== "map";
  document.querySelector(".map-controls").hidden = get().view !== "map";
  document.getElementById("map-legend").hidden =
    get().view !== "map" || !rows.length;
  document.querySelector(".mobile-pane-switch").hidden = !rows.length;
  document.querySelector(".map-date-label").hidden = get().view !== "map";
  document.getElementById("map-empty-state").hidden =
    Boolean(rows.length) || get().view !== "map";
  document
    .querySelectorAll("[data-canvas]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.canvas === get().view),
    );
  if (get().view === "map") {
    mapView?.resize();
    return;
  }
  if (get().view === "network") drawNetwork(canvas);
  else drawMatrix(canvas);
}
function drawNetwork(canvas) {
  const entity =
    data.enterprises.find((item) => item.id === get().selectedId) || rows[0];
  if (!entity) {
    canvas.innerHTML = empty("当前没有企业");
    return;
  }
  const loans = data.loans.filter((item) => item.enterpriseId === entity.id),
    banks = [...new Set(loans.map((item) => item.bankId))].map((id) =>
      data.banks.find((item) => item.id === id),
    ),
    guarantees = data.guarantees.filter((item) =>
      [item.guarantorId, item.beneficiaryId].includes(entity.id),
    );
  const related = guarantees.map((item) =>
    data.enterprises.find(
      (row) =>
        row.id ===
        (item.guarantorId === entity.id
          ? item.beneficiaryId
          : item.guarantorId),
    ),
  );
  const width = Math.max(340, canvas.clientWidth),
    height = Math.max(560, canvas.clientHeight),
    center = { x: width / 2, y: height * 0.55 };
  const nodes = [
    { ...entity, x: center.x, y: center.y, type: "enterprise", root: true },
    ...banks.map((bank, index) => ({
      ...bank,
      x: 80 + (width - 160) * (index / Math.max(1, banks.length - 1)),
      y: Math.max(170, height * 0.28),
      type: "bank",
    })),
    ...related.map((row, index) => ({
      ...row,
      x: 80 + (width - 160) * (index / Math.max(1, related.length - 1)),
      y: height * 0.83,
      type: "enterprise",
    })),
  ];
  canvas.innerHTML = `<div class="canvas-title"><h2>${esc(entity.name)}</h2><p>企业 → 借款银行 / 担保关联</p></div><svg viewBox="0 0 ${width} ${height}" class="relationship-svg" aria-label="业务关系网络"><g class="network-scene">${nodes
    .slice(1)
    .map(
      (node) =>
        `<line x1="${center.x}" y1="${center.y}" x2="${node.x}" y2="${node.y}" stroke="${node.type === "bank" ? "#6c9fbe" : "#c6a268"}" stroke-width="1.5" ${node.type === "bank" ? "" : 'stroke-dasharray="5 4"'}/><text x="${(center.x + node.x) / 2}" y="${(center.y + node.y) / 2 - 7}" text-anchor="middle">${node.type === "bank" ? "借款" : "担保"}</text>`,
    )
    .join(
      "",
    )}${nodes.map((node) => `<g role="button" tabindex="0" aria-label="${esc(node.name)}" data-object-type="${node.type}" data-object-id="${node.id}" transform="translate(${node.x},${node.y})"><circle r="${node.root ? 30 : 23}" fill="${node.root ? "#286f64" : node.type === "bank" ? "#4e7d9c" : "#b59857"}"/><text class="node-initial" y="5" text-anchor="middle">${node.type === "bank" ? "银" : "企"}</text><text y="${node.root ? 54 : 46}" text-anchor="middle">${esc(node.name)}</text></g>`).join("")}</g></svg><div class="network-controls">${tool("network-in", "plus", "放大关系网络")}${tool("network-out", "minus", "缩小关系网络")}${tool("network-reset", "scan", "复位关系网络")}</div>`;
  mountNetworkZoom(canvas);
  refreshIcons();
}
let networkZoom;
function mountNetworkZoom(canvas) {
  const svg = d3.select(canvas).select("svg");
  networkZoom = d3
    .zoom()
    .scaleExtent([0.5, 3])
    .on("zoom", (event) =>
      svg.select(".network-scene").attr("transform", event.transform),
    )
    .on("end", (event) =>
      save({
        networkCamera: {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        },
      }),
    );
  svg.call(networkZoom).on("dblclick.zoom", null);
  const camera = get().networkCamera;
  if (camera)
    svg.call(
      networkZoom.transform,
      d3.zoomIdentity.translate(camera.x, camera.y).scale(camera.k),
    );
}
function drawMatrix(canvas) {
  const width = Math.max(340, canvas.clientWidth),
    height = Math.max(400, canvas.clientHeight),
    margin = { left: 60, right: 30, top: 150, bottom: 60 };
  const x = d3
      .scaleLinear()
      .domain([
        Math.max(
          0,
          Math.min(1.8, ...rows.map((row) => row.cost ?? 1.8)) - 0.25,
        ),
        Math.max(3.5, ...rows.map((row) => row.cost || 0)) + 0.25,
      ])
      .range([margin.left, width - margin.right]),
    y = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);
  canvas.innerHTML = `<div class="canvas-title"><h2>融资成本 × 历史风险</h2><p>横轴越右成本越高；纵轴越低风险越需关注</p></div><svg viewBox="0 0 ${width} ${height}" class="matrix-svg" aria-label="融资成本与历史风险矩阵"><g class="matrix-x" transform="translate(0,${height - margin.bottom})"></g><g class="matrix-y" transform="translate(${margin.left},0)"></g><text x="${width - margin.right}" y="${height - 18}" text-anchor="end">融资成本 (%)</text><text x="${margin.left}" y="${margin.top - 8}">历史风险评分 (分)</text>${rows.map((row) => `<circle data-object-type="enterprise" data-object-id="${row.id}" role="button" tabindex="0" aria-label="${esc(row.name)}" cx="${x(row.cost)}" cy="${y(row.riskScore)}" r="${get().selectedId === row.id ? 9 : 6}" fill="${row.riskTier === "绿灯" ? "#338575" : row.riskTier === "红灯" ? "#ce6153" : "#cf9c35"}" stroke="#fff" stroke-width="2"><title>${esc(row.name)} · ${fmt(row.cost)}% · ${row.riskScore}分</title></circle>`).join("")}</svg>`;
  d3.select(canvas).select(".matrix-x").call(d3.axisBottom(x).ticks(4));
  d3.select(canvas).select(".matrix-y").call(d3.axisLeft(y).ticks(5));
}
function drawOntology() {
  const root = document.getElementById("ontology-graph");
  if (!root) return;
  const def = data.definitions.find((item) => item.id === selectedDefinition);
  root.innerHTML = `<div class="dependency-columns"><div><span class="eyebrow">输入对象与属性</span>${def.inputs.map((input) => `<div class="dependency-node">${icon("database")}<code>${esc(input)}</code></div>`).join("")}</div><div class="dependency-center">${icon("arrow-right")}<div><strong>${def.name}</strong><small>统一计算定义 · ${def.unit}</small></div>${icon("arrow-right")}</div><div><span class="eyebrow">共用此定义</span>${def.consumers.map((name) => `<div class="dependency-node">${icon("layers-2")}<strong>${name}</strong></div>`).join("")}</div></div>`;
  refreshIcons();
}

root.addEventListener("click", (event) => {
  const object = event.target.closest("[data-object-type]");
  if (object) {
    openObject(
      object.dataset.objectType,
      object.dataset.objectId,
      Boolean(object.closest(".entity-list")),
    );
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  handleAction(target).catch((error) => notify(error.message, true));
});
modal.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (target)
    handleAction(target).catch((error) => notify(error.message, true));
});
async function handleAction(target) {
  const action = target.dataset.action,
    id = target.dataset.id;
  if (action.startsWith("native-")) {
    if (action === "native-report") {
      const report = get().reports.find((item) => item.id === id);
      send("OFW_V14_REPORT", { report, open: true });
      return;
    }
    native(target.dataset.module, target.dataset.task, {
      objectIds: rows.map((row) => row.id),
      selectedId: get().selectedId,
    });
    return;
  }
  if (action === "nav") {
    queryEpoch++;
    queryBusy = false;
    pageView = target.dataset.view;
    syncRoute();
    shell();
    return;
  }
  if (action === "mode") {
    save({ mode: target.dataset.mode });
    refreshWorkbench();
    syncInputs();
    return;
  }
  if (action === "canvas") {
    save({ view: target.dataset.canvas });
    renderCanvas();
    refreshIcons();
    return;
  }
  if (action === "right-tab") {
    save({ rightTab: target.dataset.tab });
    renderInvestigation();
    refreshIcons();
    return;
  }
  if (action === "reset-filters") {
    applyFilters(defaultFilters());
    return;
  }
  if (action === "clear-box") {
    applyFilters({ ...get().filters, boxIds: null });
    return;
  }
  if (action === "undo") {
    mapView?.setChoosing(false);
    store.undo();
    refreshWorkbench();
    syncInputs();
    return;
  }
  if (action === "fit") {
    mapView.fit(rows.map((row) => row.id));
    return;
  }
  if (action === "retry-map") {
    renderWorkbench();
    return;
  }
  if (action === "network-in" || action === "network-out") {
    d3.select(".relationship-svg")
      .transition()
      .duration(260)
      .call(networkZoom.scaleBy, action === "network-in" ? 1.25 : 0.8);
    return;
  }
  if (action === "network-reset") {
    d3.select(".relationship-svg")
      .transition()
      .duration(260)
      .call(networkZoom.transform, d3.zoomIdentity);
    return;
  }
  if (action === "world") {
    mapView.world();
    return;
  }
  if (action === "zoom-in" || action === "zoom-out") {
    mapView.zoom(action === "zoom-in" ? 1 : -1);
    return;
  }
  if (action === "box-select") {
    mapView.setChoosing(target.getAttribute("aria-pressed") !== "true");
    return;
  }
  if (action === "relationships") {
    save({ relationships: !get().relationships });
    target.setAttribute("aria-pressed", String(get().relationships));
    refreshWorkbench();
    return;
  }
  if (action === "toggle-table") {
    save({ tableOpen: !get().tableOpen });
    renderDock();
    mapView?.resize();
    refreshIcons();
    return;
  }
  if (action === "detail-back") {
    detailStack.pop();
    const entity = detailStack.findLast((item) => item.type === "enterprise");
    save({ selectedId: entity?.id || null });
    refreshWorkbench();
    document.getElementById("investigation-content").scrollTop =
      detailStack.at(-1)?.scrollTop || 0;
    refreshIcons();
    return;
  }
  if (action === "ask") {
    await ask(target.dataset.question);
    return;
  }
  if (action === "ask-selected") {
    save({ rightTab: "query" });
    await ask(
      `为什么${data.enterprises.find((item) => item.id === get().selectedId)?.name}需要关注？`,
    );
    return;
  }
  if (action === "cancel-query") {
    queryEpoch++;
    queryBusy = false;
    save({
      queries: [
        {
          id: crypto.randomUUID(),
          status: "cancelled",
          question: pendingQuestion,
          summary: "查询已由用户取消，未改变分析范围。",
          createdAt: new Date().toISOString(),
        },
        ...get().queries,
      ].slice(0, 30),
    });
    notify("查询已取消");
    renderInvestigation();
    refreshIcons();
    return;
  }
  if (action === "apply-answer") {
    const answer = get().queries.find((item) => item.id === id);
    restoreBasis(answer.plan, answer.evidence);
    applyFilters(
      { ...answer.filters, objectIds: answer.evidence.objectIds },
      answer.horizon,
    );
    mapView.fit(answer.evidence.objectIds);
    return;
  }
  if (action === "report-answer") {
    const answer = get().queries.find((item) => item.id === id);
    createReport(
      answer.snapshot,
      answer.summary,
      answer.plan || null,
      answer.evidence,
    );
    return;
  }
  if (action === "task-answer") {
    const answer = get().queries.find((item) => item.id === id);
    taskForm(answer.evidence.objectIds, answer.plan || null, answer.evidence);
    return;
  }
  if (action === "scenario-answer") {
    const answer = get().queries.find((item) => item.id === id);
    save({ horizon: answer.horizon });
    syncInputs();
    startScenario(answer.evidence.objectIds);
    if (answer.parameters) {
      planDraft.parameters = clone(answer.parameters);
      renderInvestigation();
      refreshIcons();
    }
    return;
  }
  if (action === "filter-bank") {
    applyFilters({ ...defaultFilters(), bankId: id });
    save({ mode: "exposure", relationships: true });
    refreshWorkbench();
    syncInputs();
    return;
  }
  if (action === "new-scenario") {
    startScenario();
    return;
  }
  if (action === "apply-plan") {
    planDraft = null;
    const plan = get().plans.find((item) => item.id === id);
    save({
      activePlanId: id,
      filters: { ...defaultFilters(), objectIds: plan.objectIds },
      horizon: plan.horizon,
    });
    pageView = "workbench";
    shell();
    return;
  }
  if (action === "delete-plan") {
    showModal(
      "删除方案",
      "<p>已保存报告和事项中的方案快照仍会保留。</p>",
      button("confirm-delete-plan", "删除", "trash-2", true, `data-id="${id}"`),
    );
    return;
  }
  if (action === "confirm-delete-plan") {
    save({
      plans: get().plans.filter((item) => item.id !== id),
      activePlanId: get().activePlanId === id ? null : get().activePlanId,
      comparisonIds: get().comparisonIds.filter((item) => item !== id),
    });
    modal.close();
    renderPage();
    return;
  }
  if (action === "task-plan") {
    const plan = get().plans.find((item) => item.id === id);
    taskForm(plan.objectIds, plan, {
      dataVersion: plan.dataVersion,
      dataDigest: plan.dataDigest,
      ontologyVersion: plan.ontologyVersion,
      asOf: plan.asOf,
      horizon: plan.horizon,
      objectIds: plan.objectIds,
      resultKind: "SIMULATION",
      planId: plan.id,
    });
    return;
  }
  if (action === "new-task") {
    taskForm();
    return;
  }
  if (action === "open-task") {
    openTask(id);
    return;
  }
  if (action === "edit-task") {
    const task = get().tasks.find((item) => item.id === id);
    showModal(
      "调整事项分办",
      `<form id="task-assignment" data-id="${id}"><label class="field">负责人<input id="assignment-owner" required maxlength="50" value="${esc(task.owner)}"></label><label class="field">截止日期<input id="assignment-due" type="date" required value="${task.dueDate}"></label><label class="field">调整原因<textarea id="assignment-note" required rows="3"></textarea></label><p class="form-error"></p><button class="button primary" type="submit">${icon("check")}保存分办</button></form>`,
    );
    return;
  }
  if (action === "task-filter") {
    taskFilter = target.dataset.filter;
    renderPage();
    return;
  }
  if (action === "locate-task") {
    const task = get().tasks.find((item) => item.id === id);
    restoreBasis(task.plan, task.evidence);
    modal.close();
    save({
      filters: { ...defaultFilters(), objectIds: task.objectIds },
      selectedId: task.objectIds[0] || null,
      rightTab: "object",
      horizon: task.evidence.horizon,
    });
    detailStack = [];
    pageView = "workbench";
    shell();
    return;
  }
  if (action === "report-task") {
    const task = get().tasks.find((item) => item.id === id);
    const result = metrics(
      data,
      task.objectIds,
      task.evidence.horizon,
      task.plan,
    );
    createReport(
      result,
      `${task.title}\n负责人：${task.owner}\n${task.history.map((event) => `${taskLabels[event.to]}：${event.note}`).join("\n")}`,
      task.plan,
      task.evidence,
    );
    return;
  }
  if (action === "apply-rule") {
    const rule = get().ontologyDrafts.find((item) => item.id === id);
    if (rule.dataDigest !== data.digest)
      throw new Error("规则预览的数据版本已变化");
    save({
      filters: {
        ...defaultFilters(),
        highCost: true,
        premiumThreshold: rule.threshold,
        ruleId: rule.id,
      },
      activePlanId: null,
      selectedId: null,
      rightTab: "query",
      mode: "cost",
    });
    pageView = "workbench";
    shell();
    syncRoute();
    return;
  }
  if (action === "create-report") {
    createReport();
    return;
  }
  if (action === "open-report") {
    openReport(id);
    return;
  }
  if (action === "review-report") {
    showModal(
      "复核报告快照",
      `<form id="report-review-form" data-id="${id}"><label class="field">复核人<input id="report-reviewer" required maxlength="60"></label><label class="field">复核意见<textarea id="review-note" required rows="3"></textarea></label><p class="compact-note">确认后冻结此版本的本地记录；不对外发布。</p><button class="button primary" type="submit">${icon("badge-check")}确认复核</button></form>`,
    );
    return;
  }
  if (action === "revise-report") {
    const source = get().reports.find((report) => report.id === id),
      draft = {
        ...clone(source),
        id: crypto.randomUUID(),
        parentId: id,
        status: "DRAFT",
        version: (source.version || 1) + 1,
        review: null,
        createdAt: new Date().toISOString(),
      };
    save({ reports: [draft, ...get().reports] });
    openReport(draft.id);
    if (pageView === "reports") renderPage();
    return;
  }
  if (action === "export-report") {
    const report = get().reports.find((item) => item.id === id);
    download(`${report.title}.html`, reportHtml(report));
    return;
  }
  if (action === "export-csv") {
    download(
      "企业融资与风险.csv",
      resultCsv(results),
      "text/csv;charset=utf-8",
    );
    return;
  }
  if (action === "source") {
    showModal(
      "数据来源与演示假设",
      `<span class="eyebrow">${data.dataVersion}</span><h3>输入与结果身份</h3><ul class="assumptions">${data.assumptions.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>${facts(
        [
          ["企业", `${data.enterprises.length} 家`],
          ["借款", `${data.loans.length} 笔`],
          ["授信", `${data.facilities.length} 条`],
          ["担保", `${data.guarantees.length} 条`],
          ["输入指纹", `<code>${data.digest}</code>`],
        ],
      )}`,
      button("download-data", "导出源数据", "download"),
    );
    return;
  }
  if (action === "download-data") {
    download(
      "v1.4-演示数据.json",
      JSON.stringify(data, null, 2),
      "application/json",
    );
    return;
  }
  if (action === "save-exploration") {
    showModal(
      "保存探索",
      `<form id="save-exploration-form"><label class="field">探索名称<input id="exploration-name" value="${modeItems.find(([mode]) => mode === get().mode)[1]} · ${rows.length}家企业" maxlength="60" required></label><button type="submit" class="button primary">${icon("bookmark")}保存</button></form>`,
    );
    return;
  }
  if (action === "saved") {
    showModal(
      "已保存探索",
      get()
        .explorations.map(
          (item) =>
            `<button class="linked-row" data-action="restore-exploration" data-id="${item.id}"><span><strong>${esc(item.name)}</strong><small>${item.savedAt.slice(0, 16).replace("T", " ")}</small></span>${icon("arrow-up-right")}</button>`,
        )
        .join("") || empty("暂无保存的探索"),
    );
    return;
  }
  if (action === "restore-exploration") {
    const item = get().explorations.find((item) => item.id === id);
    if (item.evidence) restoreBasis(item.plan, item.evidence);
    if (
      item.state.activePlanId &&
      !get().plans.some((plan) => plan.id === item.state.activePlanId)
    )
      throw new Error("该探索的方案已删除，不能无提示替换为基准");
    save(item.state);
    pageView = "workbench";
    modal.close();
    shell();
    return;
  }
  if (action === "select-definition") {
    selectedDefinition = id;
    renderPage();
    return;
  }
  if (action === "show-ontology") {
    pageView = "ontology";
    shell();
    return;
  }
  if (action === "mobile-objects") {
    document
      .getElementById("object-list-pane")
      .classList.toggle("mobile-visible");
    return;
  }
  if (action === "close-objects") {
    document
      .getElementById("object-list-pane")
      .classList.remove("mobile-visible");
    return;
  }
  if (action === "mobile-analysis") {
    document.getElementById("investigation").classList.toggle("mobile-visible");
    return;
  }
  if (action === "close-mobile") {
    document.getElementById("investigation").classList.remove("mobile-visible");
    return;
  }
  if (action === "close-modal") {
    modal.close();
    return;
  }
}
root.addEventListener("input", (event) => {
  if (event.target.id === "question") composerDraft = event.target.value;
  if (event.target.id === "entity-search") {
    applyFilters(
      { ...get().filters, search: event.target.value },
      get().horizon,
      false,
    );
    return;
  }
  if (["scenario-rate", "scenario-credit"].includes(event.target.id)) {
    planDraft.parameters[
      event.target.id === "scenario-rate" ? "rateBps" : "creditHaircut"
    ] = Number(event.target.value);
    const summary =
      event.target.previousElementSibling?.querySelector("strong");
    if (summary)
      summary.textContent =
        event.target.value +
        (event.target.id === "scenario-rate" ? " bp" : "%");
    updateScenarioPreview();
  }
  if (event.target.id === "scenario-name") planDraft.name = event.target.value;
});
root.addEventListener("change", (event) => {
  const id = event.target.id,
    value = event.target.value;
  if (["industry", "risk-tier", "sort"].includes(id)) {
    applyFilters({
      ...get().filters,
      [id === "risk-tier" ? "riskTier" : id]: value,
    });
    return;
  }
  if (id === "horizon") {
    save({ horizon: Number(value) });
    refreshWorkbench();
    return;
  }
  if (id === "active-plan") {
    planDraft = null;
    save({ activePlanId: value || null });
    refreshWorkbench();
    return;
  }
  if (
    [
      "scenario-rate",
      "scenario-credit",
      "scenario-extension",
      "scenario-bank",
    ].includes(id)
  ) {
    planDraft.parameters[
      id === "scenario-rate"
        ? "rateBps"
        : id === "scenario-credit"
          ? "creditHaircut"
          : id === "scenario-extension"
            ? "extensionDays"
            : "bankId"
    ] = id === "scenario-bank" ? value || null : Number(value);
    updateScenarioPreview();
    return;
  }
  if (event.target.dataset.comparePlan) {
    const next = new Set(get().comparisonIds);
    event.target.checked
      ? next.add(event.target.dataset.comparePlan)
      : next.delete(event.target.dataset.comparePlan);
    if (next.size > 2) {
      event.target.checked = false;
      notify("最多选择两个方案");
      return;
    }
    save({ comparisonIds: [...next] });
    renderPage();
    return;
  }
  if (id === "model-program") {
    mountModelFrame();
    return;
  }
});
async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === "query-form") {
      const input = document.getElementById("question");
      const question = input.value.trim();
      if (question) await ask(question);
    }
    if (form.id === "scenario-form") {
      const plan = createPlan(
        data,
        planDraft.objectIds,
        planDraft.parameters,
        planDraft.name,
        get().horizon,
      );
      save({
        plans: [plan, ...get().plans],
        activePlanId: plan.id,
        filters: { ...defaultFilters(), objectIds: plan.objectIds },
      });
      planDraft = {
        name: plan.name,
        objectIds: clone(plan.objectIds),
        parameters: clone(plan.parameters),
      };
      notify("方案已保存，原基准未改变");
      const select = document.getElementById("active-plan");
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${plan.id}">方案 · ${esc(plan.name)}</option>`,
      );
      select.value = plan.id;
      refreshWorkbench();
      mapView?.fit(plan.objectIds);
    }
    if (form.id === "task-form") {
      if (!document.getElementById("task-confirm").checked)
        throw new Error("请确认本地执行边界");
      const task = newTask({
        ...modal.taskInput,
        title: document.getElementById("task-title").value,
        owner: document.getElementById("task-owner").value,
        dueDate: document.getElementById("task-due").value,
        type: document.getElementById("task-type").value,
        existing: get().tasks,
      });
      save({ tasks: [task, ...get().tasks] });
      modal.close();
      notify("跟踪事项已建立，外部执行为0");
      if (pageView === "workbench") refreshWorkbench();
      else renderPage();
    }
    if (form.id === "task-transition") {
      const task = get().tasks.find((item) => item.id === form.dataset.id);
      const next = transitionTask(
        task,
        document.getElementById("task-status").value,
        document.getElementById("task-note").value,
      );
      save({
        tasks: get().tasks.map((item) => (item.id === task.id ? next : item)),
      });
      openTask(task.id);
      if (pageView === "tasks") renderPage();
    }
    if (form.id === "report-edit") {
      if (
        get().reports.find((report) => report.id === reportSelected)?.status ===
        "REVIEWED"
      )
        throw new Error("已复核版本不可直接修改，请另建修订草稿");
      const title = document.getElementById("report-title").value.trim();
      if (!title) throw new Error("报告标题不能为空");
      save({
        reports: get().reports.map((report) =>
          report.id === reportSelected
            ? {
                ...report,
                title,
                notes: document.getElementById("report-notes").value,
              }
            : report,
        ),
      });
      notify("草稿编辑已保存");
      send("OFW_V14_REPORT", {
        report: get().reports.find((report) => report.id === reportSelected),
      });
      if (pageView === "reports") renderPage();
    }
    if (form.id === "save-exploration-form") {
      const name = document.getElementById("exploration-name").value.trim();
      if (!name) throw new Error("请输入名称");
      const {
        filters,
        horizon,
        mode,
        selectedId,
        view,
        camera,
        networkCamera,
        activePlanId,
        relationships,
      } = get();
      save({
        explorations: [
          {
            id: crypto.randomUUID(),
            name,
            savedAt: new Date().toISOString(),
            plan: activePlan() ? clone(activePlan()) : null,
            evidence: {
              dataDigest: data.digest,
              ontologyVersion: data.ontologyVersion,
              planId: activePlan()?.id || null,
            },
            state: clone({
              filters,
              horizon,
              mode,
              selectedId,
              view,
              camera,
              networkCamera,
              activePlanId,
              relationships,
            }),
          },
          ...get().explorations,
        ].slice(0, 30),
      });
      modal.close();
      notify("探索已保存");
    }
    if (form.id === "semantic-form") {
      const threshold = Number(
        document.getElementById("semantic-threshold").value,
      );
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 200)
        throw new Error("阈值范围为0至200bp");
      const impacted = metrics(data).rows.filter(
        (row) => row.premium > threshold,
      );
      const draft = {
        id: crypto.randomUUID(),
        threshold,
        objectIds: impacted.map((row) => row.id),
        dataDigest: data.digest,
        createdAt: new Date().toISOString(),
      };
      save({ ontologyDrafts: [draft, ...get().ontologyDrafts].slice(0, 20) });
      document.getElementById("semantic-result").innerHTML =
        `<h4>${impacted.length} 家企业命中规则草稿</h4><p>成本偏离 &gt; ${threshold} bp · 独立规则预览</p>${button("apply-rule", "在工作台验证", "map", true, `data-id="${draft.id}"`)}${impacted.map((row) => objectButton("enterprise", row.id, row.name, `${fmt(row.premium)} bp`)).join("")}`;
      refreshIcons();
    }
    if (form.id === "report-review-form") {
      const reviewer = document.getElementById("report-reviewer").value.trim(),
        note = document.getElementById("review-note").value.trim();
      if (!reviewer || !note) throw new Error("请填写复核人和意见");
      save({
        reports: get().reports.map((report) =>
          report.id === form.dataset.id
            ? {
                ...report,
                status: "REVIEWED",
                review: { reviewer, note, at: new Date().toISOString() },
              }
            : report,
        ),
      });
      openReport(form.dataset.id);
      if (pageView === "reports") renderPage();
      notify("本地复核记录已冻结，不代表对外正式发布");
    }
    if (form.id === "task-assignment") {
      const task = get().tasks.find((item) => item.id === form.dataset.id),
        updated = reassignTask(
          task,
          document.getElementById("assignment-owner").value,
          document.getElementById("assignment-due").value,
          document.getElementById("assignment-note").value,
        );
      save({
        tasks: get().tasks.map((item) =>
          item.id === task.id ? updated : item,
        ),
      });
      openTask(task.id);
      if (pageView === "tasks") renderPage();
      else refreshWorkbench();
    }
  } catch (error) {
    const inline = form.querySelector(".form-error");
    if (inline) inline.textContent = error.message;
    else notify(error.message, true);
  }
}
root.addEventListener("submit", handleSubmit);
modal.addEventListener("submit", handleSubmit);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document
      .querySelectorAll(".workspace-actions[open]")
      .forEach((menu) => (menu.open = false));
    mapView?.setChoosing(false);
    document
      .querySelectorAll(".mobile-visible")
      .forEach((node) => node.classList.remove("mobile-visible"));
  }
  if (
    ["Enter", " "].includes(event.key) &&
    event.target.matches("svg [data-object-id]")
  ) {
    event.preventDefault();
    openObject(event.target.dataset.objectType, event.target.dataset.objectId);
  }
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".workspace-actions[open]").forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest("[data-action]"))
      menu.open = false;
  });
});
window.addEventListener("resize", () => {
  mapView?.resize();
  if (pageView === "workbench" && get().view !== "map") renderCanvas();
});
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(location.hash.slice(1));
  pageView = navItems.some(([id]) => id === params.get("view"))
    ? params.get("view")
    : "workbench";
  save({ selectedId: params.get("entity") || null });
  detailStack = [];
  shell();
});
window.addEventListener("message", (event) => {
  if (embedded && event.origin === location.origin && event.source === parent) {
    const message = event.data;
    if (
      message?.type === "OFW_V14_VIEW" &&
      navItems.some(([id]) => id === message.view)
    ) {
      hostView = message.view;
      pageView = message.view;
      syncRoute(true);
      shell();
      return;
    }
    if (message?.type === "OFW_V14_RESTORE_REPORT" && data) {
      try {
        const report = message.report;
        restoreBasis(report.plan, report.evidence);
        applyFilters(
          { ...defaultFilters(), objectIds: report.evidence.objectIds },
          report.evidence.horizon,
        );
        save({ rightTab: "query" });
        refreshWorkbench();
        notify("已恢复报告的企业范围、方案和窗口");
      } catch (error) {
        notify(error.message, true);
      }
      return;
    }
    if (message?.type === "OFW_V14_CONTEXT" && data) {
      const signature = JSON.stringify(message.context),
        scope = canonicalScope(message.context, data);
      if (
        signature !== get().parentContextSignature &&
        scope &&
        message.context?.sourceModuleId !== "joint-workbench" &&
        (scope.objectIds || scope.selectedId)
      ) {
        save({
          filters: { ...defaultFilters(), objectIds: scope.objectIds },
          selectedId: scope.selectedId,
          rightTab: scope.selectedId ? "object" : get().rightTab,
          parentContextSignature: signature,
          activePlanId: null,
        });
        detailStack = [];
        refreshWorkbench();
      }
      return;
    }
    if (message?.type === "OFW_V14_REPORT_SAVED") {
      notify("已同步到报告中心草稿");
      return;
    }
    if (message?.type === "OFW_V14_ERROR") {
      notify(message.message, true);
      return;
    }
  }
  if (
    event.origin !== location.origin ||
    event.source !== document.getElementById("model-frame")?.contentWindow
  )
    return;
  if (event.data?.type === "OFW_M08_NAVIGATE") {
    pageView =
      event.data.route === "#module/report"
        ? "reports"
        : event.data.route === "#module/data" ||
            event.data.route === "#module/ontology"
          ? "ontology"
          : "workbench";
    shell();
  }
});
async function boot() {
  try {
    const response = await fetch("/data/portfolio.json");
    if (!response.ok) throw new Error(`数据 HTTP ${response.status}`);
    data = validateDataset(await response.json());
    save(validateRestoredState(get(), data));
    const params = new URLSearchParams(location.hash.slice(1));
    if (
      params.get("entity") &&
      data.enterprises.some((item) => item.id === params.get("entity"))
    )
      save({ selectedId: params.get("entity"), rightTab: "object" });
    if (navItems.some(([id]) => id === params.get("view")))
      pageView = params.get("view");
    if (embedded && get().pendingDraft) {
      planDraft = clone(get().pendingDraft);
      save({ pendingDraft: null });
    }
    recompute();
    shell();
    window.__OFW_V14__ = {
      getState: () => clone(get()),
      getResult: () => clone(results),
      getMap: () => mapView?.map,
      getDataset: () => clone(data),
    };
    send("OFW_V14_READY");
  } catch (error) {
    root.innerHTML = `<main class="boot-error"><h1>工作台未能加载</h1><p>${esc(error.message)}</p><button class="button" onclick="location.reload()">重试</button></main>`;
  }
}
boot();
