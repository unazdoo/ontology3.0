(() => {
  "use strict";

  // M06 keeps the v1.0.3 report lifecycle and dashboard interactions. The
  // panel below is the S002 fact projection consumed by that page; it is not a
  // replacement report engine and never marks the report as T049 formal.
  const params = new URLSearchParams(location.search);
  const context = {
    scenarioId: params.get("scenarioId") || "S002",
    scenarioVersion: params.get("scenarioVersion") || "S002-v1",
    scenarioRunId: params.get("scenarioRunId") || "S002-RUN-20260815160000000-9f72297443c6",
    baselineVersion: params.get("baselineVersion") || "1.0.3"
  };
  const topics = [
    ["预算执行", "2025最终批准预算 2,297.70 万元", "实际 2,184.36 万元 · 执行率 95.08%"],
    ["初始申报", "2025/2026 部门最初申报", "不替代 2024/2025 最终批准预算"],
    ["项目余额与采购占用", "净在途占用 486.20 万元", "项目可用立项余额 = 立项 - 实际 - 在途 - 计提"],
    ["异常事项与 Action", "8 条 Action Request 草稿", "6 类 Action · 人工确认后平台内待办"],
    ["跨年趋势及单位对比", "2024 → 2025 可解释趋势", "单位、科目、期间和证据支持下钻"]
  ];
  const details = [
    ["设备管理部", "2025", "项目实施成本", "全年", "PRJ-SB-设备-2025-002", "余额不足 · 预算调增草稿", "SYNTHETIC_FOR_DEMO"],
    ["技术部", "2025", "部门公共费用", "全年", "ORG-JS-FY2025-INITIAL", "初始申报异常 · 申报退回", "SYNTHETIC_FOR_DEMO"],
    ["安全运行部", "2025", "项目实施成本", "Q4", "PRJ-AQ-概率-2025-002", "年末占用集中 · 占用释放", "DERIVED"],
    ["安全运行部", "2025", "技术服务", "全年", "PRJ-AQ-灾害-2025-002", "供应商价格偏高 · 价格复核", "DERIVED"]
  ];
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  function style() {
    if (document.getElementById("s002-m06-adapter-style")) return;
    const node = document.createElement("style");
    node.id = "s002-m06-adapter-style";
    node.textContent = `.s002-m06-panel{margin:0 0 16px;padding:14px;border:1px solid #d9cbb7;border-radius:8px;background:#fffaf3;color:#3e3022;font:12px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif}.s002-m06-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.s002-m06-head h2{margin:0;font-size:15px}.s002-m06-head p{margin:4px 0 0;color:#786b5e}.s002-m06-meta{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.s002-m06-meta span{padding:3px 7px;border:1px solid #ead9bd;border-radius:10px;background:#fff;color:#8c5e24;font-size:10px;font-weight:700;white-space:nowrap}.s002-m06-topics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:10px}.s002-m06-topic{padding:9px;border:1px solid #eee1cf;border-radius:6px;background:#fff}.s002-m06-topic b{display:block;color:#815a2d;font-size:10px}.s002-m06-topic strong{display:block;margin-top:4px;font-size:12px}.s002-m06-topic small{display:block;margin-top:4px;color:#756b61}.s002-m06-filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:11px}.s002-m06-filters label{display:grid;gap:3px;color:#756b61;font-size:10px}.s002-m06-filters select{min-width:0;padding:5px;border:1px solid #e1d5c5;border-radius:4px;background:#fff;color:#493927;font:inherit}.s002-m06-table{width:100%;margin-top:10px;border-collapse:collapse;background:#fff;font-size:10px}.s002-m06-table th,.s002-m06-table td{padding:6px 7px;border-bottom:1px solid #eee4d8;text-align:left;white-space:nowrap}.s002-m06-table th{color:#755b3d;background:#fffaf3;font-weight:700}.s002-m06-table td:last-child{color:#9b6a26;font-weight:700}.s002-m06-foot{margin-top:9px;padding-top:8px;border-top:1px solid #eadfce;color:#74685b;font-size:10px}@media(max-width:1000px){.s002-m06-topics{grid-template-columns:repeat(3,minmax(0,1fr))}.s002-m06-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){.s002-m06-head{display:block}.s002-m06-meta{justify-content:flex-start;margin-top:8px}.s002-m06-topics{grid-template-columns:1fr 1fr}.s002-m06-filters{grid-template-columns:1fr 1fr}.s002-m06-table{display:block;overflow:auto}}`;
    document.head.appendChild(node);
  }
  function tableRows() {
    const values = [...document.querySelectorAll("[data-s002-filter]")].map((select) => select.value).filter((value) => value && value !== "全部");
    const filtered = details.filter((row) => values.every((value) => row.includes(value)));
    return (filtered.length ? filtered : details).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
  }
  function renderTable(panel) {
    const tbody = panel.querySelector("[data-s002-detail-body]");
    if (tbody) tbody.innerHTML = tableRows();
  }
  function render() {
    const host = document.querySelector(".main") || document.querySelector("#app");
    if (!host || host.querySelector("[data-s002-adapter='M06']")) return;
    const panel = document.createElement("section");
    panel.className = "s002-m06-panel";
    panel.dataset.s002Adapter = "M06";
    const options = (index) => [...new Set(details.map((row) => row[index]))].map((value) => `<option>${esc(value)}</option>`).join("");
    panel.innerHTML = `<div class="s002-m06-head"><div><h2>S002 预算监督管理 · 报告中心 / 预算驾驶舱</h2><p>预算驾驶舱展示预算执行、初始申报、项目余额、采购占用、异常事项及跨年趋势；报告草稿与驾驶舱发布分开管理。</p></div><div class="s002-m06-meta"><span>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)}</span><span>预算监督数据 · 已就绪</span><span>预算驾驶舱 · 已发布</span><span>报告草稿 · draft</span></div></div><div class="s002-m06-topics">${topics.map(([name, value, note]) => `<article class="s002-m06-topic"><b>${esc(name)}</b><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("")}</div><div class="s002-m06-filters">${[["年度",1],["单位",0],["科目",2],["项目",4],["期间",3],["异常事项",5]].map(([label,index]) => `<label>${label}<select data-s002-filter="${esc(label)}"><option>全部</option>${options(index)}</select></label>`).join("")}</div><div style="overflow:auto"><table class="s002-m06-table"><thead><tr><th>单位</th><th>年度</th><th>科目</th><th>期间</th><th>项目/主体</th><th>异常与 Action</th><th>数据标识</th></tr></thead><tbody data-s002-detail-body>${tableRows()}</tbody></table></div><div class="s002-m06-foot">下钻范围：年度、单位、科目、项目、期间、异常事项 · 数据截至 2025-12-31 · 运行轮次：<b>${esc(context.scenarioRunId)}</b> · 预算调整仅生成决策中心草稿和平台内待办，不自动审批、过账、反写或覆盖最终批准预算。</div>`;
    host.insertBefore(panel, host.firstChild);
    panel.addEventListener("change", () => renderTable(panel));
  }
  // Keep the copied v1.0.3 lifecycle route under the isolated S002 namespace;
  // this historical adapter is not loaded by the current M06 entry.
  if (params.get("view") === "dashboard" && !location.hash.startsWith("#/dashboard/s002")) location.hash = "/dashboard/s002?tab=overview";
  style();
  const schedule = () => setTimeout(render, 60);
  schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
