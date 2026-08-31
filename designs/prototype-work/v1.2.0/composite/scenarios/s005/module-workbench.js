(function mountS005ModuleWorkbench(global) {
  "use strict";

  const root = document.getElementById("workbench");
  const toast = document.getElementById("toast");
  const query = new URLSearchParams(global.location.search);
  const moduleId = query.get("moduleId") || "M02";
  const context = {
    scenarioId: query.get("scenarioId"),
    scenarioVersion: query.get("scenarioVersion"),
    scenarioRunId: query.get("scenarioRunId"),
    formedAt: query.get("formedAt"),
    status: query.get("status")
  };
  const modules = Object.freeze({
    M02: { name: "数据工程", icon: "database", description: "登记来源版本、读取时点和质量结果。", actions: [{ operation: "source_delivery", label: "形成来源与质量交付", detail: "读取候选证据清单，形成当前轮次的数据版本和质量输出。" }] },
    M01: { name: "本体管理", icon: "network", description: "形成产品身份、Wind fund_type、分类和评价口径候选。", actions: [{ operation: "semantic_candidate", label: "形成身份与口径候选", detail: "只形成候选定义和映射，不发布 Ontology、Metric、Rule 或 T019。" }] },
    M03: { name: "智能问数", icon: "message-square-text", description: "只读消费评价运行，形成持续合规和市场横评结果。", actions: [{ operation: "compliance_evaluation", label: "形成持续准入合规结果", detail: "按当前评价输入列示符合、需复核和无法判断，不生成规则事实。" }, { operation: "market_peer_evaluation", label: "形成市场横评结果", detail: "使用现有月度归一化序列比较，不换算为日频风险指标。" }] },
    M04: { name: "决策中心", icon: "circle-dot-dashed", description: "只读复核选择结果；当前场景不适用行动闭环。", actions: [{ operation: "selection_read_only", label: "确认只读选择复核边界", detail: "Action、提醒、审批、待办和交易数量均必须为 0。" }] },
    M05: { name: "Agent 应用", icon: "bot", description: "只读解释交易与风险结果，不重新计算或执行动作。", actions: [{ operation: "risk_explanation", label: "形成交易与风险解释", detail: "解释固定评价结果并启动 M05/M07/M08 联合证据阶段。" }] },
    M06: { name: "报告中心", icon: "files", description: "汇总当前评价运行，形成报告草稿、复核和历史比较。", actions: [{ operation: "report_draft", label: "形成当前运行报告草稿", detail: "仅在 M01-M08 必需结果齐备后形成，不发布正式报告。" }] }
  });
  let projection = null;
  let busy = false;
  let toastTimer = null;

  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function icon(name) {
    return `<span class="icon" aria-hidden="true"><i data-lucide="${esc(name)}"></i></span>`;
  }

  function refreshIcons() {
    global.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function exactContext(value) {
    return value && ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => value[field] === context[field]);
  }

  function actionState(operation) {
    const entry = projection?.actions?.find((item) => item.operation === operation);
    return entry || { status: "pending", enabled: false, reason: "等待宿主状态" };
  }

  function outputCards() {
    const outputs = projection?.moduleOutputs || [];
    if (!outputs.length) return `<div class="empty">${icon("file-clock")}<strong>当前模块尚未形成结果</strong><span>完成前置模块后执行本页操作。</span></div>`;
    return `<div class="output-list">${outputs.map((output) => `<article class="output-card"><header><strong>${esc(output.label || output.operation)}</strong><span class="badge ${esc(output.status || "complete")}">${esc(output.status || "complete")}</span></header><p>${esc(output.summary || "当前轮次模块结果已登记。")}</p><code>${esc(output.outputId || output.evidenceRef || "—")}</code></article>`).join("")}</div>`;
  }

  function historyComparisonMarkup() {
    if (moduleId !== "M06") return "";
    const comparison = projection?.historyComparison || { status: "not_applicable", missingReason: "尚未收到历史比较上下文。" };
    return `<section class="panel"><header class="panel-head"><div><h2>复核与历史比较</h2><p>复核状态与上一运行引用分别保存，不把草稿当作已发布结果。</p></div><span class="badge ${comparison.status === "available" ? "complete" : "pending"}">${comparison.status === "available" ? "可比较" : "暂无历史"}</span></header><div class="evidence"><div class="evidence-row"><span>复核状态</span><strong>待复核</strong></div><div class="evidence-row"><span>当前 Result</span><code>${esc(comparison.currentEvaluationResultId || "—")}</code></div><div class="evidence-row"><span>上一运行</span><code>${esc(comparison.previousScenarioRunId || "—")}</code></div><div class="evidence-row"><span>上一 Result</span><code>${esc(comparison.previousEvaluationResultId || "—")}</code></div>${comparison.missingReason ? `<div class="evidence-row"><span>说明</span><strong>${esc(comparison.missingReason)}</strong></div>` : ""}</div></section>`;
  }

  function render() {
    const module = modules[moduleId] || modules.M02;
    const evaluation = projection?.evaluationResult || null;
    const stage = projection?.stage || { status: "pending", title: "等待宿主状态" };
    root.innerHTML = `<header class="workbench-head"><div><span class="kicker">${esc(moduleId)} · S005 当前评价运行</span><h1>${esc(module.name)}</h1><p>${esc(module.description)}</p></div><div class="identity"><span>场景身份</span><strong>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)}</strong><code>${esc(context.scenarioRunId || "等待宿主")}</code></div></header>
      <section class="status-strip"><div><span>当前阶段</span><strong>${esc(stage.title || "—")}</strong></div><div><span>阶段状态</span><strong>${esc(stage.status || "pending")}</strong></div><div><span>Evaluation Run</span><strong>${esc(projection?.evaluationRun?.evaluationRunId || "尚未建立")}</strong></div><div><span>评价状态 / 覆盖率</span><strong>${esc(evaluation?.evaluationStatus || "待评价")} · ${evaluation?.scoredCoverage == null ? "—" : `${Math.round(evaluation.scoredCoverage * 100)}%`}</strong></div></section>
      <section class="boundary ${moduleId === "M04" ? "warning" : ""}">${icon(moduleId === "M04" ? "shield-alert" : "shield-check")}<div><strong>${moduleId === "M04" ? "当前场景不形成决策动作" : "候选结果与正式事实严格分离"}</strong><span>${moduleId === "M04" ? "只读 / 不适用；Action、提醒、审批、待办和交易均为 0。" : "所有结果保留版本、缺失原因和证据引用；数据不足不补零。"}</span></div></section>
      <div class="workspace-grid"><section class="panel"><header class="panel-head"><div><h2>可执行操作</h2><p>只有实际模块结果事件可以推进当前阶段。</p></div><span class="badge ${esc(stage.status || "pending")}">${esc(stage.status || "pending")}</span></header><div class="actions">${module.actions.map((action) => { const state = actionState(action.operation); return `<article class="action-row"><span>${icon(module.icon)}</span><div><strong>${esc(action.label)}</strong><small>${esc(state.reason || action.detail)}</small></div><button class="btn" type="button" data-operation="${esc(action.operation)}" ${busy || !state.enabled ? "disabled" : ""}>${state.status === "complete" ? "已形成" : busy ? "处理中" : "形成结果"}</button></article>`; }).join("")}</div></section>
        <section class="panel"><header class="panel-head"><div><h2>当前模块输出</h2><p>所有输出均绑定当前五字段身份。</p></div><span class="badge ${projection?.moduleOutputs?.length ? "complete" : "pending"}">${projection?.moduleOutputs?.length || 0} 项</span></header>${outputCards()}</section></div>
      <section class="panel"><header class="panel-head"><div><h2>评价运行引用</h2><p>Dashboard 和后续模块读取同一 evaluation run/result。</p></div></header><div class="evidence"><div class="evidence-row"><span>数据版本</span><strong>${esc(evaluation?.dataVersionId || "等待 M02")}</strong></div><div class="evidence-row"><span>语义版本</span><strong>${esc(evaluation?.ontologyVersionId || "等待 M01")}</strong></div><div class="evidence-row"><span>公式 / 参数</span><strong>${esc(evaluation?.formulaVersion || "—")} / ${esc(evaluation?.parameterVersion || "—")}</strong></div><div class="evidence-row"><span>结果引用</span><code>${esc(evaluation?.evaluationResultId || "—")}</code></div></div></section>${historyComparisonMarkup()}`;
    root.querySelectorAll("[data-operation]").forEach((button) => button.addEventListener("click", () => submit(button.dataset.operation)));
    refreshIcons();
  }

  function submit(operation) {
    if (busy || !projection || !exactContext(projection.scenarioContext)) return;
    busy = true;
    render();
    global.parent.postMessage({
      type: "OFW_S005_MODULE_RESULT",
      schemaVersion: "ofw.s005.module-result.v1",
      moduleId,
      operation,
      scenarioContext: { ...context },
      result: buildResult(operation)
    }, global.location.origin);
  }

  function buildResult(operation) {
    const producedAt = new Date().toISOString();
    const evaluationResultId = projection?.evaluationResult?.evaluationResultId || null;
    const base = {
      clientResultId: `S005-MODULE-RESULT-${moduleId}-${operation}-${context.scenarioRunId}`,
      outputKind: `${moduleId}_${operation}`,
      status: moduleId === "M04" ? "not_applicable" : "complete",
      producedAt,
      evaluationRunId: projection?.evaluationRun?.evaluationRunId || null,
      evaluationResultId,
      consumerResultRef: evaluationResultId,
      evidenceRefs: [`module://${context.scenarioRunId}/${moduleId}/${operation}`],
      missingReasons: [],
      publishedOntology: false,
      publishedMetric: false,
      publishedRule: false,
      publishedT019: false
    };
    if (operation === "source_delivery") return {
      ...base,
      evaluationDate: "2026-07-17",
      eventReadAt: producedAt,
      sourceAudit: {
        snapshotCount: 79,
        sheetInstanceCount: 393,
        candidateCount: 15,
        asOf: "2026-07-17",
        windBatchId: null,
        windBatchMissingReason: "Wind 批次尚未交付。",
        dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
        qualityStatus: "partial"
      },
      missingReasons: ["Wind 批次尚未交付。", "实际 NAV、现金流和费用明细尚未交付。"]
    };
    if (operation === "semantic_candidate") return {
      ...base,
      classificationStatus: "candidate",
      windFundType: null,
      windFundTypeMissingReason: "Wind fund_type 尚未交付。",
      ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
      metricUpdates: {
        continuingEligibilityCompliance: {
          continuingEligibility: {
            status: "partial",
            value: { eligible: 3, reviewRequired: 1, unknown: 1, displayedProducts: 5, candidateCount: 15 },
            missingReason: "仅 5 只代表性产品具备范围状态，10 只候选尚未逐项列示。",
            evidenceRefs: [`module://${context.scenarioRunId}/M02/source_delivery`, `module://${context.scenarioRunId}/M01/semantic_candidate`]
          },
          classificationConfidence: { value: null, status: "not_evaluable", missingReason: "Wind fund_type 与候选分类尚未完成复核。" }
        },
        selectionExecution: {
          selectionAttribution: {
            status: "partial",
            value: 0.42,
            unit: "pct",
            missingReason: "该值仅为 T+60 归一化选择差异，不等同于完整选择归因。",
            evidenceRefs: [`module://${context.scenarioRunId}/M02/source_delivery`, `module://${context.scenarioRunId}/M01/semantic_candidate`]
          }
        }
      },
      missingReasons: ["Wind fund_type 尚未交付。", "分类和评价口径仍为候选。"]
    };
    if (operation === "compliance_evaluation") return {
      ...base,
      accessMode: "read_only",
      consumerResultRef: evaluationResultId,
      complianceResultRef: `evaluation://${context.scenarioRunId}/M03/compliance-read-only`,
      conclusionStatus: "partial",
      missingReasons: ["完整合规事件与处置证据尚未交付。"]
    };
    if (operation === "market_peer_evaluation") return {
      ...base,
      accessMode: "read_only",
      consumerResultRef: evaluationResultId,
      marketPeerResultRef: `evaluation://${context.scenarioRunId}/M03/market-peer-read-only`,
      conclusionStatus: "not_evaluable",
      missingReasons: ["现有序列为月度归一化组合比较，不是产品实际 NAV，不能计算产品 TWR 或日频风险指标。"]
    };
    if (operation === "selection_read_only") return {
      ...base,
      accessMode: "read_only",
      applicability: "not_applicable",
      actions: [], reminders: [], approvals: [], todos: [], trades: [],
      missingReasons: ["实际成交、下一可得 NAV、确认 NAV、滑点和结算流水均未交付。"]
    };
    if (operation === "risk_explanation") return {
      ...base,
      accessMode: "read_only",
      explanationRef: `evaluation://${context.scenarioRunId}/M05/trading-risk-explanation`,
      missingReasons: ["久期、评级迁移、穿透集中度、流动性和债券收益归因证据尚未交付。"]
    };
    if (operation === "report_draft") return {
      ...base,
      reportRef: `report://${context.scenarioRunId}/S005-evaluation-draft`,
      reportStatus: "draft",
      reviewStatus: "pending",
      reviewEvidenceRefs: [`module://${context.scenarioRunId}/M06/review-pending`],
      historyComparisonStatus: projection?.historyComparison?.status || "not_applicable",
      previousScenarioRunId: projection?.historyComparison?.previousScenarioRunId || null,
      previousEvaluationResultId: projection?.historyComparison?.previousEvaluationResultId || null,
      historyComparisonMissingReason: projection?.historyComparison?.missingReason || null,
      missingReasons: ["评价仍为部分状态，报告不得正式发布。"]
    };
    return base;
  }

  global.addEventListener("message", (event) => {
    if (event.origin !== global.location.origin || event.source !== global.parent) return;
    if (event.data?.type === "OFW_S005_MODULE_CONTEXT" && event.data.moduleId === moduleId && exactContext(event.data.scenarioContext)) {
      projection = event.data.payload;
      busy = false;
      render();
    }
    if (event.data?.type === "OFW_S005_MODULE_ERROR" && event.data.moduleId === moduleId) {
      busy = false;
      notify(event.data.message || "模块结果未形成");
      render();
    }
  });

  render();
  global.parent.postMessage({ type: "OFW_S005_MODULE_READY", moduleId, scenarioContext: { ...context } }, global.location.origin);
})(window);
