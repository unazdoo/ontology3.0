(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("decision", function (ctx) {
    return ctx.modulePage({
      moduleId: "M04",
      eyebrow: "DECISION CENTER · ACTION REQUEST GATE",
      title: "标准 Action Request 条件门",
      description: "当前报告流程未提交 Action Request，因此决策中心不产生提醒、审批、通知或待办。",
      body: '<section class="decision-gate">'
        + '<div class="gate-card primary"><div class="gate-icon">' + ctx.icon("target", "lg") + '</div><div><span class="eyebrow">CURRENT STATE</span><h2>没有待处理的 S004 行动申请</h2><p>报告发现的问题只可由用户从受控入口显式提交；场景壳、报告 Agent 和报告中心都无权代为创建。</p></div>'
        + '<span class="status-pill not_applicable">NOT_APPLICABLE</span></div>'
        + '<div class="gate-flow">'
        + ctx.gateNode("1", "报告发现问题", "只读呈现证据与风险")
        + ctx.gateArrow()
        + ctx.gateNode("2", "用户显式提交", "标准 Action Request")
        + ctx.gateArrow()
        + ctx.gateNode("3", "决策中心人工确认", "确认后才可形成待办")
        + '</div>'
        + '<div class="panel"><div class="panel-head"><div><h2>副作用抑制</h2><p>恢复和回归默认禁止历史动作重放。</p></div>' + ctx.ownerExport("M04") + '</div>'
        + '<div class="side-effect-grid">'
        + ctx.sideEffect("历史 Action Request", false)
        + ctx.sideEffect("通知与审批", false)
        + ctx.sideEffect("待办重建", false)
        + ctx.sideEffect("外部派发", false)
        + '</div></div>'
        + '</section>'
    });
  });
})();
