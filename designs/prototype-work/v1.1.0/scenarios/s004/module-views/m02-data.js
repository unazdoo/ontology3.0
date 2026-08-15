(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("data", function (ctx) {
    const data = ctx.data;
    const sourceCards = data.sourceGroups.map(function (source) {
      return '<article class="source-card">'
        + '<div class="source-card-head"><span class="source-type">' + ctx.e(source.kind) + '</span>' + ctx.sourceTag(source.tag) + '</div>'
        + '<h3>' + ctx.e(source.name) + '</h3>'
        + '<p>' + ctx.e(source.coverage) + '</p>'
        + '<div class="source-meta"><span>' + ctx.icon("file") + ctx.e(source.id) + '</span><strong>' + ctx.e(source.status) + '</strong></div>'
        + '<div class="source-note">' + ctx.e(source.note) + '</div>'
        + '</article>';
    }).join("");

    const quality = data.dataQualityChecks.map(function (item) {
      const complete = ctx.projection.steps.qualityGate.status === "verified";
      return '<div class="quality-row">'
        + '<span class="quality-state ' + (complete ? "verified" : "") + '">' + ctx.icon(complete ? "check" : "clock") + '</span>'
        + '<div><strong>' + ctx.e(item.name) + '</strong><p>' + ctx.e(item.detail) + '</p></div>'
        + '</div>';
    }).join("");

    return ctx.modulePage({
      moduleId: "M02",
      eyebrow: "DATA ENGINEERING · C003 / C017",
      title: "贷前调查数据准备",
      description: "公开事实与合成缺口分层进入同一质量门，形成可被 Published 本体绑定的数据资产。",
      body: '<section class="module-grid two-wide">'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>权威来源与缺口材料</h2><p>年报已有事实不重复造数；合成演示资料只覆盖真实缺口。</p></div>'
        + ctx.ownerExport("M02") + '</div><div class="source-grid">' + sourceCards + '</div></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>管道节点</h2><p>沿用数据工程既有来源、处理、质量、发布与交付能力。</p></div></div>'
        + '<div class="pipeline-list">'
        + ctx.pipelineNode("1", "读取来源快照", "锁定读取事件、文件指纹与时点", "database")
        + ctx.pipelineNode("2", "标准化与稳定键", "统一借款人、申请和报告标识", "key")
        + ctx.pipelineNode("3", "通用质量检查", "缺失、冲突、过期和不可核验", "shield")
        + ctx.pipelineNode("4", "发布数据资产", "形成精确资产版本与 C017", "publish")
        + ctx.pipelineNode("5", "交付本体管理", "按 C003 传递当前轮次引用", "arrow")
        + '</div></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>质量门</h2><p>事实缺失不得默认填零，冲突必须保留状态。</p></div></div><div class="quality-list">' + quality + '</div></div>'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>M02 场景步骤</h2><p>按钮只更新当前 S004 浏览器工作投影；正式状态以 Owner 导出和 C034 清单为准。</p></div></div>'
        + ctx.stepTable("M02") + '</div>'
        + '</section>'
    });
  });
})();
