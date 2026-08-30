(function (root) {
  "use strict";

  const moduleId = root.S005_MODULE_ID || "M02";
  const context = root.S005_MODULE_CONTEXT || {};
  const parentWindow = root.parent && root.parent !== root ? root.parent : null;
  const runner = () => parentWindow?.OFW_S005_RUNNER || null;
  const stageByModule = { M02: "sourceBatch", M01: "classification", M03: "compliance", M04: "selection", M05: "tradingRisk", M06: "reportDraft" };
  const labelByModule = { M02: "来源批次", M01: "分类与语义", M03: "市场与合规", M04: "池内选择", M05: "交易与风险", M06: "研究草稿" };

  function escapeText(value) { return String(value ?? "").replace(/[<&>]/g, ""); }
  function projection() { return runner()?.projection?.() || { steps: {} }; }
  function state() { return runner()?.state?.() || { status: "待运行", running: false }; }
  function moduleStorage() { return parentWindow?.OFW_ACTIVE_SCENARIO_ADAPTER?.store?.createModuleStorage?.(moduleId) || null; }

  function recordObservation() {
    try {
      moduleStorage()?.set("s005/real-baseline-observation", {
        scenarioContext: context,
        moduleId,
        baselineSource: root.S005_BASELINE_SOURCE || "",
        observedAt: new Date().toISOString(),
        mode: "real-v1.1.0-module-entry"
      });
    } catch (_) {}
  }

  function patchRegistry() {
    try {
      const registry = root.OFW_COMPOSITE_REGISTRY;
      if (registry?.scenes && !registry.scenes.some((scene) => scene.scenarioId === "S005")) {
        registry.scenes.push({ scenarioId: "S005", scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, name: "金融产品投后评价全周期闭环", domain: "投后评价", dataAsOf: "2026-07-17", status: "running" });
      }
    } catch (_) {}
  }

  function patchVisibleText() {
    // Keep the frozen module copy's own scenario catalogue intact. S005 is
    // shown by the explicit context/evidence band below rather than by
    // rewriting baseline facts from S001-S004.
  }

  function ensureEvidenceBand() {
    if (!root.document.body || root.document.querySelector("[data-s005-real-evidence-band]")) return;
    const source = parentWindow?.S005_FULL_CHAIN_DATA;
    const facts = {
      M02: ["79 份周期间快照", "393 个工作表实例", "2 种结构版本", "Wind 日 NAV 待导入"],
      M01: ["五类一期允许范围", "Wind fund_type", "1 条超范围事实", "Published 资源不创建"],
      M03: ["同类样本 1,284 只", "合规 3 / 1 / 1 / 1", "同类中位数", "同类前三分之一"],
      M04: ["冻结决策 DEC-S005-20260717-004", "T+60 +0.42 个百分点", "95% CI 已登记", "只读研究消费"],
      M05: ["TWR +7.40%", "MWR +6.92%", "夏普 1.38", "最大回撤 -1.86%"],
      M06: ["研究草稿", "部分评价", "5 个评价段落", "不发布正式报告"]
    }[moduleId] || [];
    const band = root.document.createElement("section");
    band.dataset.s005RealEvidenceBand = "true";
    band.style.cssText = "margin:10px 14px;padding:9px 11px;border:1px solid #cbd9e8;border-radius:5px;background:#f8fbff;color:#344258;font:10px/1.45 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;position:relative;z-index:29";
    band.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong style="color:#244b8d">S005 研究注入 · ${escapeText(labelByModule[moduleId])}</strong><small style="color:#6c7889">来源：ofw.s005.research.v1 · ${escapeText(context.scenarioRunId)}</small></div><div style="display:grid;grid-template-columns:repeat(${Math.max(2, Math.min(4, facts.length))},minmax(0,1fr));gap:6px;margin-top:7px">${facts.map((fact) => `<span style="padding:5px 6px;border:1px solid #dce6f0;border-radius:4px;background:#fff">${escapeText(fact)}</span>`).join("")}</div><small style="display:block;margin-top:6px;color:#6c7889">v1.1.0 原生页面、原生路由和原生交互保持不变；S005 仅注入当前场景上下文、研究证据和隔离状态。</small>`;
    const strip = root.document.querySelector("[data-s005-real-baseline-strip]");
    if (strip?.parentElement) strip.parentElement.insertBefore(band, strip.nextSibling); else root.document.body.insertBefore(band, root.document.body.firstChild);
  }

  function ensureContextStrip() {
    if (!root.document.body || root.document.querySelector("[data-s005-real-baseline-strip]")) return;
    const strip = root.document.createElement("section");
    strip.dataset.s005RealBaselineStrip = "true";
    strip.style.cssText = "margin:0;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#344258;background:#f8fbff;border-bottom:1px solid #cbd9e8;font:11px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;position:relative;z-index:30";
    strip.innerHTML = `<span><b style="color:#315fae">S005 · v1.1.0 基线模块</b>　${escapeText(labelByModule[moduleId])}　<span style="color:#6c7889">${escapeText(context.scenarioRunId)}</span></span><span data-s005-real-status style="color:#a45c12">读取中</span>`;
    root.document.body.insertBefore(strip, root.document.body.firstChild);
    const stage = stageByModule[moduleId];
    if (stage) {
      const button = root.document.createElement("button");
      button.type = "button";
      button.textContent = moduleId === "M04" || moduleId === "M05" ? "记录研究观察" : "确认当前阶段";
      button.dataset.s005RealStageAction = stage;
      button.style.cssText = "margin-left:auto;padding:4px 8px;border:1px solid #9fb8d8;border-radius:4px;color:#315fae;background:#fff;font:inherit;cursor:pointer";
      strip.appendChild(button);
      button.addEventListener("click", () => {
        const result = runner()?.completeFromModule?.(stage);
        if (result?.ok) updateStatus();
        else { button.textContent = result?.reason || "请先完成前置阶段"; }
      });
    }
  }

  function updateStatus() {
    const status = state();
    const record = projection().steps?.[stageByModule[moduleId]];
    const node = root.document.querySelector("[data-s005-real-status]");
    if (node) node.textContent = record?.complete ? "已完成 · 研究状态已回写" : status.running ? "研究链路运行中" : "待确认";
  }

  function boot() {
    patchRegistry();
    recordObservation();
    ensureContextStrip();
    ensureEvidenceBand();
    patchVisibleText();
    updateStatus();
    root.setInterval(() => { ensureContextStrip(); ensureEvidenceBand(); updateStatus(); }, 700);
  }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})(typeof window !== "undefined" ? window : globalThis);
