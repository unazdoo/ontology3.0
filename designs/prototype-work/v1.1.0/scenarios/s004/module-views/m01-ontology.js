(function () {
  "use strict";

  const views = window.S004ModuleViews || (window.S004ModuleViews = { renderers: {} });
  views.register = views.register || function (key, renderer) { views.renderers[key] = renderer; };

  views.register("ontology", function (ctx) {
    const ontology = ctx.data.ontology;
    const objects = ontology.objects.map(function (item, index) {
      return '<div class="semantic-node"><span>' + ctx.icon(index % 3 === 0 ? "building" : index % 3 === 1 ? "file" : "network") + '</span><strong>' + ctx.e(item) + '</strong><small>业务对象</small></div>';
    }).join("");
    const relations = ontology.relations.map(function (item) {
      return '<li>' + ctx.icon("link") + '<span>' + ctx.e(item) + '</span></li>';
    }).join("");
    const metrics = ontology.metrics.map(function (item) {
      return '<span class="semantic-chip metric">' + ctx.icon("metric") + ctx.e(item) + '</span>';
    }).join("");
    const rules = ontology.rules.map(function (item) {
      return '<div class="rule-row"><span>' + ctx.icon("shield") + '</span><div><strong>' + ctx.e(item) + '</strong><p>确定性校验 · 不输出自动授信结论</p></div></div>';
    }).join("");

    return ctx.modulePage({
      moduleId: "M01",
      eyebrow: "ONTOLOGY MANAGEMENT · C008 / T019",
      title: "贷前调查 Published 语义",
      description: "模板章节只是报告组织结构；业务事实仍通过对象、关系、Metric 和 Rule 建模。",
      body: '<section class="module-grid two-wide">'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>对象语义空间</h2><p>当前只展示 S004 候选资源投影，Published 切换仍由 M01 Owner 执行。</p></div>' + ctx.ownerExport("M01") + '</div>'
        + '<div class="semantic-canvas"><div class="semantic-grid">' + objects + '</div><div class="semantic-core"><span>Published</span><strong>贷前调查语义包</strong><small>' + ctx.e(ctx.data.stableIdentities.semanticVersionId) + '</small></div></div></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>关系</h2><p>稳定身份和来源关系贯穿数据、报告与证据。</p></div></div><ul class="relation-list">' + relations + '</ul></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>Metric</h2><p>指标由 Published 定义和确定性计算提供。</p></div></div><div class="semantic-chips">' + metrics + '</div></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>Rule</h2><p>只做资格、数据与事实一致性校验。</p></div></div><div class="rule-list">' + rules + '</div></div>'
        + '<div class="panel"><div class="panel-head"><div><h2>禁止自动化判断</h2><p>高风险判断保持人工责任。</p></div></div><div class="boundary-list">'
        + ontology.prohibitedRules.map(function (item) { return '<div>' + ctx.icon("ban") + '<span>' + ctx.e(item) + '</span></div>'; }).join("")
        + '</div></div>'
        + '<div class="panel span-2"><div class="panel-head"><div><h2>M01 场景步骤</h2><p>数据资产完成后才能形成映射；Published 切换后报告方才可消费。</p></div></div>' + ctx.stepTable("M01") + '</div>'
        + '</section>'
    });
  });
})();
