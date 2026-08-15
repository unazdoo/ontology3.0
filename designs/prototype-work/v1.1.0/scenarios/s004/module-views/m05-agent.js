(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("agent", function (ctx) {
    const definition = ctx.data.agentDefinition;
    const allowed = definition.allowedTools.map(function (item) {
      return '<span class="tool-chip allowed">' + ctx.icon("check") + ctx.e(item) + '</span>';
    }).join("");
    const denied = definition.deniedTools.map(function (item) {
      return '<span class="tool-chip denied">' + ctx.icon("ban") + ctx.e(item) + '</span>';
    }).join("");
    const draftReady = ctx.projection.steps.generateDraft.status === "verified";
    const published = ctx.projection.hasPublishedReport;

    return ctx.modulePage({
      moduleId: "M05",
      eyebrow: "AGENT APPLICATION · C022—C025",
      title: "报告生成与只读伴读 Agent",
      description: "Agent 只组织固定证据中的表达，不选择最新数据、不重算指标、不发布报告。",
      body: '<section class="module-grid two-wide">'
        + '<div class="panel"><div class="panel-head"><div><h2>Agent Definition</h2><p>' + ctx.e(definition.id) + '</p></div>' + ctx.ownerExport("M05") + '</div>'
        + '<dl class="key-value-list"><div><dt>名称</dt><dd>' + ctx.e(definition.name) + '</dd></div><div><dt>运行模式</dt><dd>Fixed evidence only</dd></div><div><dt>当前轮次</dt><dd>' + ctx.e(ctx.state.scenarioContext.scenarioRunId) + '</dd></div><div><dt>证据包</dt><dd>' + ctx.e(ctx.data.stableIdentities.evidencePackId) + '</dd></div></dl></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>工具白名单</h2><p>只开放生成与解释所需的最小能力。</p></div></div><div class="tool-list">' + allowed + '</div><div class="divider"></div><div class="tool-list">' + denied + '</div></div>'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>运行轨迹</h2><p>运行结果来自当前 S004 固定证据，不复用 S001 Session 或 Result。</p></div></div>'
        + '<div class="agent-run-track">'
        + ctx.agentNode("固定证据包", ctx.projection.steps.freezeEvidence.status, ctx.data.stableIdentities.evidencePackId)
        + ctx.agentArrow()
        + ctx.agentNode("结构化草稿", ctx.projection.steps.generateDraft.status, draftReady ? "六部分草稿已形成" : "等待运行")
        + ctx.agentArrow()
        + ctx.agentNode("正式报告", ctx.projection.steps.publishReport.status, published ? ctx.data.stableIdentities.reportId : "等待 M06 发布")
        + ctx.agentArrow()
        + ctx.agentNode("报告伴读", ctx.projection.steps.companionRun.status, published ? "可启动只读伴读" : "发布前不可启动")
        + '</div></div>'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>M05 场景步骤</h2><p>报告生成和伴读是两个独立运行；伴读必须绑定已发布报告。</p></div></div>' + ctx.stepTable("M05") + '</div>'
        + '</section>'
    });
  });
})();
