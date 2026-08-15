(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("report", function (ctx) {
    const selectedId = ctx.state.ui.selectedReportSection || "SEC-01";
    const selected = ctx.data.reportDefinition.find(function (section) { return section.id === selectedId; }) || ctx.data.reportDefinition[0];
    const sectionNav = ctx.data.reportDefinition.map(function (section) {
      return '<button class="report-section-button ' + (section.id === selected.id ? "active" : "") + '" type="button" data-action="select-report-section" data-section="' + ctx.e(section.id) + '">'
        + '<span>' + ctx.e(section.id.replace("SEC-", "")) + '</span><strong>' + ctx.e(section.title.replace(/^.+、/, "")) + '</strong>'
        + ctx.icon("chevron") + '</button>';
    }).join("");
    const itemRows = selected.items.map(function (item, index) {
      const factStatus = ctx.projection.steps.bindAnchors.status === "verified" ? "已绑定" : "待绑定";
      return '<div class="report-item-row"><span class="item-index">' + String(index + 1).padStart(2, "0") + '</span><div><strong>' + ctx.e(item) + '</strong><p>Published 事实 / 证据来源 / 稳定锚点</p></div><span class="fact-state">' + factStatus + '</span></div>';
    }).join("");
    const human = ctx.state.humanDecision;
    const reportStatus = ctx.projection.hasPublishedReport ? "已发布" : ctx.projection.steps.verifyFacts.status === "verified" ? "待人工复核" : "草稿准备中";

    return ctx.modulePage({
      moduleId: "M06",
      eyebrow: "REPORT CENTER · HTML / PDF",
      title: "贷前调查报告生命周期",
      description: "报告定义采用用户提供输出报告的共同结构；Agent 草稿经事实绑定、确定性核验和人工复核后才能发布。",
      body: '<section class="report-workspace">'
        + '<aside class="report-sidebar"><div class="report-sidebar-head"><span>报告定义</span><strong>六部分正式结构</strong></div>' + sectionNav + '</aside>'
        + '<div class="report-editor">'
        + '<div class="report-editor-head"><div><span class="eyebrow">' + ctx.e(selected.id) + '</span><h2>' + ctx.e(selected.title) + '</h2><p>章节标题用于报告组织，不等同于本体对象类型。</p></div><span class="report-status">' + ctx.e(reportStatus) + '</span></div>'
        + '<div class="report-items">' + itemRows + '</div>'
        + '<div class="report-preview-note">' + ctx.icon("info") + '<span>分析文字可由 Agent 组织表达；资金需求、财务指标和核验结论必须引用确定性事实。第五部分最终结论只接受人工确认。</span></div>'
        + '</div>'
        + '<aside class="report-inspector">'
        + '<div class="inspector-block"><span>报告编号</span><strong>' + ctx.e(ctx.data.stableIdentities.reportNumber) + '</strong><small>' + ctx.e(ctx.data.stableIdentities.reportId) + ' · 内容版本随发布新建</small></div>'
        + '<div class="inspector-block"><span>证据包</span><strong>' + ctx.e(ctx.data.stableIdentities.evidencePackId) + '</strong><small>当前场景轮次固定引用</small></div>'
        + '<div class="inspector-block"><span>人工复核</span><strong>' + ctx.e(human.status === "confirmed" ? "已确认" : human.status === "returned" ? "已退回" : "待确认") + '</strong><small>' + ctx.e(human.reviewer || "尚未指定有权审批人") + '</small></div>'
        + '<div class="format-pair"><div><span>HTML</span><strong>' + (ctx.projection.hasPublishedReport ? "正式发布" : "待发布") + '</strong></div><div><span>PDF</span><strong>' + (ctx.projection.hasPublishedReport ? "同源发布" : "待发布") + '</strong></div></div>'
        + (ctx.projection.hasPublishedReport ? '<div class="format-actions"><a class="btn compact" href="./' + ctx.e(ctx.data.formalOutputs.html) + '" target="_blank" rel="noopener">打开 HTML</a><a class="btn compact" href="./' + ctx.e(ctx.data.formalOutputs.pdf) + '" target="_blank" rel="noopener">查看 PDF</a></div>' : '')
        + ctx.ownerExport("M06")
        + '</aside>'
        + '</section>'
        + '<section class="panel report-step-panel"><div class="panel-head"><div><h2>M06 场景步骤</h2><p>证据包、锚点、核验、人工复核和发布门逐层推进。</p></div></div>' + ctx.stepTable("M06") + '</section>'
    });
  });
})();
