(function installReportEditor(global) {
  "use strict";
  const W = global.OFW_WORKFLOW;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const glyph = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

  function blockBody(block) {
    const rows = block.rows || [];
    return `<p class="report-block-text">${esc(block.text || "")}</p>${rows.length ? `<div class="report-table-wrap"><table class="report-content-table"><thead><tr><th>对象 / 指标</th><th>结果</th><th>状态 / 说明</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.value ?? row.primary ?? "暂无")}${row.unit && (row.value != null || row.primary != null) ? ` ${esc(row.unit)}` : ""}</td><td>${esc(row.missingReason || [row.status || row.secondary, row.tertiary].filter(Boolean).join(" · "))}</td></tr>`).join("")}</tbody></table></div>` : ""}${(block.series || []).map((series) => `<details><summary>${esc(series.label)} · ${esc(series.unit || "")}</summary><table class="report-content-table"><tbody>${series.points.map((point) => `<tr><td>${esc(point.date)}</td><td>${esc(point.value ?? "缺失")}</td></tr>`).join("")}</tbody></table></details>`).join("")}`;
  }

  function sourceMarkup(block) {
    const context = block.workspaceContext || {};
    const object = context.activeObjectRef || context.object;
    return `<div class="report-source"><span>${esc(block.type === "text" ? "分析备注" : context.resultMode?.label || W.modes[W.normalizeMode(block.resultMode)])}</span><span>${esc(object?.title || object?.label || "业务对象集")}</span><span>${esc(context.timeRange?.label || "来源快照")}</span></div><details class="report-evidence"><summary>来源与证据 · ${(block.evidenceRefs || []).length} 项</summary><dl><dt>结果</dt><dd>${esc(block.resultId || "对象 / 分析快照")}</dd><dt>模型版本</dt><dd>${esc(block.modelVersionId || "不适用")}</dd><dt>数据版本</dt><dd>${esc(block.dataVersionId || "来源未提供")}</dd><dt>语义版本</dt><dd>${esc(block.ontologyVersionId || "来源未提供")}</dd></dl>${(block.evidenceRefs || []).map((ref) => `<code>${esc(typeof ref === "string" ? ref : JSON.stringify(ref))}</code>`).join("")}</details>`;
  }

  function create({ doc, scenarioId, openDrawer, navigate, updateWorkspaceContext, onSave }) {
    let preview = false;
    const history = [];
    const read = () => W.readReport(scenarioId);
    const persist = (next, remember = true) => {
      if (remember && read()) history.push(read());
      if (history.length > 30) history.shift();
      const saved = W.saveReport(scenarioId, next);
      onSave?.(saved);
      return saved;
    };
    const command = (action, name, label, disabled = false, id = "") => `<button type="button" class="report-icon-button" data-ofw-report-action="${action}" data-block-id="${esc(id)}" aria-label="${label}" title="${label}" ${disabled ? "disabled" : ""}>${glyph(name)}</button>`;

    function open() {
      let draft = read();
      if (!draft) draft = persist({ reportId: `RPT-${scenarioId}-${Date.now().toString(36)}`, title: "业务分析报告", formedAt: new Date().toISOString(), contentBlocks: [] }, false);
      const blocks = draft.contentBlocks || [];
      const body = `<div class="report-editor" data-report-editor><div class="report-editor-heading">${preview ? `<h2>${esc(draft.title)}</h2>` : `<label class="report-title-field"><span>报告标题</span><input data-report-title value="${esc(draft.title)}" maxlength="100"></label>`}<span class="report-save-state" role="status">${blocks.length} 个内容块 · 已保存到本机</span></div>${blocks.map((block, index) => `<section class="report-block" data-report-block="${esc(block.id)}"><header>${preview ? `<h3>${esc(block.title)}</h3>` : `<input data-report-field="title" data-block-id="${esc(block.id)}" value="${esc(block.title)}" maxlength="100" aria-label="内容块标题">`}<div class="report-block-tools">${command("source", "external-link", "返回来源", !block.sourceModuleId, block.id)}${preview ? "" : command("up", "arrow-up", "上移内容块", index === 0, block.id) + command("down", "arrow-down", "下移内容块", index === blocks.length - 1, block.id) + command("delete", "trash-2", "删除内容块", false, block.id)}</div></header>${preview ? blockBody(block) : `<textarea data-report-field="text" data-block-id="${esc(block.id)}" rows="3" aria-label="分析文字">${esc(block.text || "")}</textarea>${blockBody({ ...block, text: "" })}`}${sourceMarkup(block)}</section>`).join("") || `<div class="ofw-native-note">草稿尚无内容</div>`}</div>`;
      const footer = `${command("undo", "undo-2", "撤销上次编辑", !history.length)}<button type="button" class="ofw-native-action" data-ofw-report-action="add">${glyph("plus")}添加文字</button><button type="button" class="ofw-native-action" data-ofw-report-action="preview">${glyph(preview ? "pencil" : "eye")}${preview ? "返回编辑" : "预览"}</button><button type="button" class="ofw-native-action primary" data-ofw-report-action="export">${glyph("download")}导出 HTML</button>`;
      openDrawer("分析报告草稿", "报告中心 · 待复核草稿", body, `<button type="button" class="ofw-native-action" data-ofw-native-action="report-generate">${glyph("file-plus-2")}加入当前结果</button>${footer}`);
      doc.defaultView.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
    }

    function captureFields() {
      const draft = read();
      if (!draft || !doc.querySelector("[data-report-editor]")) return;
      const next = W.clone(draft);
      const title = doc.querySelector("[data-report-title]");
      if (title) next.title = title.value.trim() || "未命名报告";
      doc.querySelectorAll("[data-report-field]").forEach((input) => {
        const block = next.contentBlocks.find((item) => item.id === input.dataset.blockId);
        if (block) block[input.dataset.reportField] = input.value;
      });
      if (JSON.stringify(next) !== JSON.stringify(draft)) persist(next);
    }

    function handle(event) {
      const button = event.target.closest("[data-ofw-report-action]");
      if (!button) return false;
      event.preventDefault(); event.stopImmediatePropagation();
      captureFields();
      const action = button.dataset.ofwReportAction;
      const draft = read();
      const index = draft.contentBlocks.findIndex((item) => item.id === button.dataset.blockId);
      if (action === "undo") { const previous = history.pop(); if (previous) persist(previous, false); }
      if (action === "preview") preview = !preview;
      if (action === "add") { draft.contentBlocks.push({ id: global.crypto.randomUUID(), type: "text", title: "分析结论", text: "", resultMode: draft.resultMode || "formal", evidenceRefs: [] }); preview = false; persist(draft); }
      if (action === "delete" && index >= 0) { draft.contentBlocks.splice(index, 1); persist(draft); }
      if ((action === "up" || action === "down") && index >= 0) {
        const destination = index + (action === "up" ? -1 : 1);
        if (destination >= 0 && destination < draft.contentBlocks.length) { [draft.contentBlocks[index], draft.contentBlocks[destination]] = [draft.contentBlocks[destination], draft.contentBlocks[index]]; persist(draft); }
      }
      if (action === "source" && index >= 0) {
        const block = draft.contentBlocks[index];
        if(block.jointReportId&&global.OFW_V14_JOINT){global.OFW_V14_JOINT.returnReport(block);return true;}
        updateWorkspaceContext?.(block.workspaceContext || {});
        if (block.returnUrl && block.sourceModuleId === "m07") {
          global.OFW_V131_STORE?.saveFramePosition("m07", { href: block.returnUrl, hash: new URL(block.returnUrl, global.location.href).hash });
        }
        navigate?.(block.sourceModuleId === "dashboard" ? "#dashboard" : `#module/${block.sourceModuleId}`);
        return true;
      }
      if (action === "export") {
        const content = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(draft.title)}</title><style>body{font:15px/1.65 system-ui,sans-serif;color:#20292c;max-width:960px;margin:40px auto;padding:0 24px}section{border-top:1px solid #dce2e4;padding:20px 0}table{width:100%;border-collapse:collapse}th,td{padding:9px;text-align:left;border-bottom:1px solid #dce2e4}p{white-space:pre-wrap}code,dd{overflow-wrap:anywhere}code{display:block;font-size:12px}.report-source{display:flex;gap:16px;color:#526466;font-size:12px}details{margin-top:16px}dl{display:grid;grid-template-columns:100px 1fr}dd{margin:0}</style><h1>${esc(draft.title)}</h1><p>待复核草稿 · ${esc(draft.updatedAt || draft.formedAt)}</p>${draft.contentBlocks.map((block) => `<section><h2>${esc(block.title)}</h2>${blockBody(block)}${sourceMarkup(block)}</section>`).join("")}</html>`;
        const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
        const anchor = doc.createElement("a"); anchor.href = url; anchor.download = `${draft.title.replace(/[\\/:*?"<>|]/g, "-")}.html`; doc.body.append(anchor); anchor.click(); anchor.remove(); global.setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      open(); return true;
    }
    return Object.freeze({ open, handle, captureFields });
  }
  global.OFW_REPORT_EDITOR = Object.freeze({ create, blockBody });
})(window);
