(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("query", function (ctx) {
    return ctx.modulePage({
      moduleId: "M03",
      eyebrow: "INTELLIGENT QUERY · SCOPE GATE",
      title: "智能问数不纳入本场景一期",
      description: "资料没有证明贷前调查必须通过独立交互问数完成，场景保持明确 NOT_APPLICABLE，而不是伪造空运行。",
      body: '<section class="boundary-page">'
        + '<div class="boundary-illustration">' + ctx.icon("sparkles", "xl") + '<span>NOT_APPLICABLE</span></div>'
        + '<div class="boundary-copy"><h2>边界已确认</h2><p>正式报告事实经 M02 数据资产、M01 Published 本体和 C008 进入固定证据包。报告生成不需要先创建一条问数 Session 或 Run。</p>'
        + '<div class="boundary-principles">'
        + ctx.boundaryPrinciple("不预置问数结果", "S004 不复制 S001 问数历史或问题模板。")
        + ctx.boundaryPrinciple("不绕过 Published", "任何报告事实仍须通过 C008 权威投影。")
        + ctx.boundaryPrinciple("后续增量需有资料证据", "只有真实需求证明需要独立问数时，才提交模块增量。")
        + '</div></div>'
        + '<aside class="boundary-aside"><h3>Checkpoint 语义</h3><p>CP30 应记录 M03 的 Owner 回执为“不适用且已校验”，不能省略 M03 条目。</p>' + ctx.ownerExport("M03") + '</aside>'
        + '</section>'
    });
  });
})();
