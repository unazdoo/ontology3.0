(function mountModelingConsumer(global) {
  "use strict";

  const root = document.getElementById("projection-root");
  const params = new URLSearchParams(global.location.search);
  const moduleId = params.get("moduleId") || "M03";
  const consumerId = params.get("consumerId") || "M03_QUERY";
  const allowedConsumers = new Set(["M03_QUERY", "M05_AGENT", "M06_REPORT"]);
  if (!allowedConsumers.has(consumerId)) throw new Error("不支持的模型结果消费者。");
  const objectiveId = params.get("objectiveId") || "MO-S003-DEBT-RISK-EARLY-WARNING-v1";
  const fields = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
  const context = Object.fromEntries(fields.map((field) => [field, params.get(field)]));
  const meta = {
    M03: { name: "智能问数", title: "模型结果问数证据", description: "引用固定结果和证据回答问题，不重新评分。", icon: "message-square-text" },
    M05: { name: "Agent 应用", title: "模型结果只读解释", description: "解释固定贡献与差异，不修改模型、标签或结果。", icon: "bot" },
    M06: { name: "报告中心", title: "模型结果报告投影", description: "形成带 Result ID 的候选结果块，不进入正式事实章节。", icon: "files" }
  }[moduleId] || { name: moduleId, title: "模型结果投影", description: "只读消费统一结果包络。", icon: "file-search" };
  let projection = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const icon = (name) => `<i data-lucide="${esc(name)}"></i>`;
  const exactContext = (value) => value && fields.every((field) => value[field] === context[field]);
  const resultItems = (envelope) => Array.isArray(envelope?.resultItems) ? envelope.resultItems : [];
  const subjects = (envelope) => Array.isArray(envelope?.subjects) ? envelope.subjects : Array.isArray(envelope?.subjectRefs) ? envelope.subjectRefs : [];

  function valueText(item) {
    if (item?.value === null || item?.value === undefined) return item?.missingReason || "无法评价";
    if (typeof item.value === "object") return JSON.stringify(item.value);
    return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
  }

  function render() {
    const envelope = projection?.resultEnvelope || null;
    const workspace = projection?.workspace || null;
    const boundarySafe = !envelope || envelope.resultKind === "FACT" || (envelope.factWriteAllowed === false && envelope.actionWriteAllowed === false && envelope.actionSourceAllowed === false);
    const blocked = projection?.status === "BLOCKED" || !boundarySafe;
    const blockedCode = projection?.status === "BLOCKED" ? projection.code : "NON_FACT_BOUNDARY_INVALID";
    const blockedReason = projection?.status === "BLOCKED" ? projection.reason : "非 FACT Result Envelope 未显式关闭事实写入、行动写入和行动来源。";
    root.innerHTML = `<div class="page"><header class="head"><div><span>${esc(moduleId)} · ${esc(meta.name)}</span><h1>${esc(meta.title)}</h1><p>${esc(meta.description)}</p></div><div class="identity"><span>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)}</span><code>${esc(context.scenarioRunId)}</code></div></header>
      <section class="status"><div><span>Objective</span><strong>${esc(envelope?.objectiveId || workspace?.objectiveId || objectiveId)}</strong></div><div><span>结果身份</span><strong>${envelope ? `<em class="kind ${String(envelope.resultKind || "").toLowerCase()}">${esc(envelope.resultKind)}</em>` : "暂无候选"}</strong></div><div><span>Model Version</span><strong>${esc(envelope?.modelVersionId || workspace?.baselineModelVersion?.modelVersionId || "等待 M08")}</strong></div><div><span>消费权限</span><strong>${esc(envelope?.permissionScope || projection?.permissionScope || "只读")}</strong></div></section>
      <section class="notice ${blocked ? "warning" : ""}">${icon(blocked ? "shield-x" : "shield-check")}<div><strong>${blocked ? esc(blockedCode) : "统一 Result Envelope 只读投影"}</strong><span>${blocked ? esc(blockedReason) : "Result ID、版本、as-of、coverage 和证据保持不变；本模块不拥有模型计算。"}</span></div></section>
      ${blocked ? "" : `<div class="grid"><section class="panel"><header><h2>结果摘要</h2><p>按当前消费者权限裁剪字段。</p></header><div class="body">${envelope ? `<div class="outputs">${resultItems(envelope).map((item) => `<div class="row"><span>${esc(item.label || item.outputId)}</span><strong>${esc(valueText(item))}</strong></div>`).join("") || `<div class="row"><span>结果状态</span><strong>${esc(envelope.status || "AVAILABLE")}</strong></div>`}</div>` : `<div class="empty"><strong>尚无候选结果</strong><span>从 M08 目标工作区运行 Benchmark、候选评测或 Shadow Trial 后在此读取。</span></div>`}</div></section>
        <section class="panel"><header><h2>对象与证据</h2><p>企业级结果不复制为正式 C035。</p></header><div class="body">${envelope ? `<div class="subjects">${subjects(envelope).slice(0,8).map((item) => { const ref = item.objectRef || { id: item.objectId || item.enterpriseId, title: item.objectName || item.enterpriseName, objectTypeRef: item.objectTypeRef || "Enterprise" }; return `<article class="subject"><header><strong>${esc(ref.title || ref.id || "业务对象")}</strong><span>${esc(item.predictedRiskTierName || item.predictedRiskTier || item.riskTier || "")}</span></header><div class="chips"><span class="chip">${esc(ref.objectTypeRef || "Enterprise")}</span>${item.riskScore != null ? `<span class="chip">评分 ${esc(item.riskScore)}</span>` : ""}${item.delta != null ? `<span class="chip">差异 ${esc(item.delta)}</span>` : ""}</div></article>`; }).join("")}</div><div class="evidence"><div class="row"><span>Result ID</span><strong class="mono">${esc(envelope.resultId)}</strong></div><div class="row"><span>运行</span><strong class="mono">${esc(envelope.runId)}</strong></div><div class="row"><span>证据</span><strong class="mono">${esc(envelope.evidenceRef || envelope.sourceLineage?.fixedResultSetId || "未提供")}</strong></div></div>` : `<p class="boundary">当前 S003 正式风险事实、报告和处置状态保持冻结只读；没有候选包络时不生成替代结果。</p>`}</div></section></div>`}
      <div class="actions"><button class="btn primary" type="button" data-open-modeling>${icon("arrow-up-right")}打开 M08 目标工作区</button></div>
      <p class="boundary">预测和模拟结果不能创建 Action Request、审批、待办、通知或交易，也不能覆盖 Published FACT、C035、正式报告或历史处置。</p></div>`;
    root.querySelector("[data-open-modeling]")?.addEventListener("click", () => global.parent.postMessage({ type: "OFW_S003_OPEN_MODELING_OBJECTIVE", scenarioContext: { ...context }, ...context, objectiveId, returnRoute: `#module/${params.get("routeModuleId") || "query"}`, view: "consumption" }, global.location.origin));
    global.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
  }

  global.addEventListener("message", (event) => {
    if (event.origin !== global.location.origin || event.source !== global.parent) return;
    if (event.data?.type !== "OFW_MODELING_CONSUMER_CONTEXT" || event.data.consumerId !== consumerId || !exactContext(event.data.scenarioContext)) return;
    projection = event.data.projection || null;
    render();
  });

  render();
  global.parent.postMessage({ type: "OFW_MODELING_CONSUMER_READY", moduleId, consumerId, objectiveId, scenarioContext: { ...context } }, global.location.origin);
})(window);
