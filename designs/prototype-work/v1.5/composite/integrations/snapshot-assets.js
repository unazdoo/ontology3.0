(function installSnapshotAssets(global) {
  "use strict";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const catalog = () => global.OFW_V14_SNAPSHOT_CATALOG;
  function create({ doc, win, openDrawer, signal }) {
    let financingAssets=[];
    Promise.all([win.fetch('/data/finance-contract-assets.json',{signal}).then(r=>{if(!r.ok)throw Error('融资台账资产读取失败');return r.json();}),import('/designs/prototype-work/v1.5/composite/shared/model-contracts.js')]).then(([pack,{INPUT_PORTS}])=>{
      if(signal?.aborted)return;
      financingAssets=pack.assets.map(a=>({...a,financing:true,rowCount:a.rows.length,snapshotId:a.id+'@'+a.version,fields:Object.values(INPUT_PORTS).find(p=>p.member===a.kind).fields}));lastRoute=null;render();
    }).catch(e=>{if(!signal?.aborted)console.error(e);});
    let activeId = null,
      activeTab = "overview",
      page = 1,
      query = "",
      assetQuery = "",
      downloadBusy = false,
      error = "",
      lastRoute = null;
    const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
    const command = (action, label, extra = "", primary = false) =>
      `<button type="button" class="ofw-native-action${primary ? " primary" : ""}" data-snapshot-action="${action}" ${extra}>${icon(action === "download" ? "download" : action === "situation" ? "globe-2" : "file-search")}${esc(label)}</button>`;
    const facts = (items) =>
      `<dl class="ofw-native-facts">${items.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
    const refresh = () => {
      global.lucide?.createIcons({ root: doc, attrs: { "stroke-width": 1.8 } });
      global.OFW_READABILITY?.refresh(doc);
    };
    function setRoute(id, tab = "overview") {
      activeId = id;
      activeTab = tab;
      page = 1;
      query = "";
      error = "";
      const hash = `#/resources?snapshotAsset=${encodeURIComponent(id)}&snapshotTab=${tab}`;
      lastRoute = hash;
      if (win.location.hash !== hash) win.location.hash = hash;
      show();
    }
    function current() {
      return [...(catalog()?.assets||[]),...financingAssets].find((asset) => asset.id === activeId) || null;
    }
    function showFinancing(asset){
      const filtered=asset.rows.filter(row=>!query||Object.values(row).some(v=>String(v??'').includes(query))),pages=Math.max(1,Math.ceil(filtered.length/20));page=Math.min(page,pages);
      const tabs=[['overview','概览与来源'],['data','字段与明细']];
      const header=`<p class="snapshot-notice">原融资台账提取 · ${asset.rowCount} 条 · 截至 ${esc(asset.asOf)}</p><div class="snapshot-tabs">${tabs.map(([id,name])=>`<button data-snapshot-action="tab" data-tab="${id}" class="${activeTab===id?'active':''}">${name}</button>`).join('')}</div>`;
      const body=activeTab==='data'?`<details class="snapshot-fields"><summary>字段字典 · ${asset.fields.length} 个字段</summary><div class="snapshot-table"><table><thead><tr><th>字段</th><th>类型／单位</th><th>缺失处理</th></tr></thead><tbody>${asset.fields.map(f=>`<tr><td>${esc(f.label)}<small>${esc(f.key)}</small></td><td>${esc(f.type)} ${esc(f.unit)}</td><td>${f.nullable?'保留未提供，不以零或评分替代':'必须取得'}</td></tr>`).join('')}</tbody></table></div></details><form class="snapshot-search" data-snapshot-search><input name="query" value="${esc(query)}" placeholder="搜索借据、企业或银行"><button type="submit">查询</button></form><div class="snapshot-table"><table><thead><tr>${asset.fields.map(f=>`<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${filtered.slice((page-1)*20,page*20).map(row=>`<tr>${asset.fields.map(f=>`<td>${row[f.key]==null?'未提供':esc(row[f.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="snapshot-pagination"><span>${filtered.length} 条 · ${page}/${pages} 页</span>${command('prev','上一页',page===1?'disabled':'')}${command('next','下一页',page===pages?'disabled':'')}</div>`:facts([['资产版本',asset.version],['原工作簿',asset.source],['原工作表',asset.sourceSheet],['源文件指纹',asset.sourceSha256],['提取资产指纹',asset.digest],['重定价口径','首次生效日与周期取原台账；下一重定价日按台账周期计算'],['评级覆盖',`${asset.ratingCoverage} 条正式评级；当前源文件未提供评级字段`],['利率匹配','同评级、同币种、相近期限按银行匹配；不足时按原台账板块计算加权均值'],['金融口径',asset.currencyBasis]])+`<p>每条明细保留原借据编号和源行号；固定利率借据的重定价字段不适用。历史演示快照与本资产独立保留。</p><a href="/${esc(asset.source)}" target="_blank" rel="noopener">查看原始融资工作簿</a>`;
      openDrawer(asset.name,'数据工程 · 原台账资产',header+body,`<a class="ofw-native-action" href="/data/finance-contract-assets.json" download>导出提取资产 JSON</a>`);refresh();
    }
    function show() {
      const c = catalog(),
        asset = current();
      if (!c) return;
      const source = activeId === c.source.id;
      if (!source && !asset) return;
      if(asset?.financing){showFinancing(asset);return;}
      const tabs = [
        ["overview", "概览"],
        ["data", "字段与数据"],
        ["snapshots", "快照记录"],
        ["lineage", "血缘与使用"],
      ];
      const entries = source ? c.assets : [asset];
      let body = "";
      if (activeTab === "data") {
        if (source)
          body = `<div class="snapshot-members">${c.assets.map((item) => `<button class="snapshot-member" data-snapshot-action="open" data-id="${item.id}"><strong>${esc(item.name)}</strong><span>${item.rowCount} 条 · ${item.fields.length} 个字段</span></button>`).join("")}</div>`;
        else {
          const filtered = asset.rows.filter(
              (row) =>
                !query ||
                Object.values(row).some((value) =>
                  String(value).toLowerCase().includes(query.toLowerCase()),
                ),
            ),
            pages = Math.max(1, Math.ceil(filtered.length / 20));
          page = Math.min(page, pages);
          body = `<details class="snapshot-fields"><summary>字段字典 · ${asset.fields.length} 个字段</summary><div class="snapshot-table"><table><thead><tr><th>字段</th><th>类型</th><th>单位</th><th>引用</th></tr></thead><tbody>${asset.fields.map((f) => `<tr><td>${esc(f.label)}<small>${esc(f.key)}</small></td><td>${f.type}</td><td>${esc(f.unit || "无")}</td><td>${esc(f.reference || "无")}</td></tr>`).join("")}</tbody></table></div></details><form class="snapshot-search" data-snapshot-search><input aria-label="筛选快照记录" name="query" value="${esc(query)}" placeholder="搜索ID、主体名称或字段值"><button class="ofw-native-action" type="submit">${icon("search")}查询</button></form><div class="snapshot-table"><table><thead><tr>${asset.fields.map((f) => `<th>${esc(f.label)}${f.unit ? `<small>${esc(f.unit)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${filtered
            .slice((page - 1) * 20, page * 20)
            .map(
              (row) =>
                `<tr>${asset.fields.map((f) => `<td>${esc(row[f.key])}</td>`).join("")}</tr>`,
            )
            .join(
              "",
            )}</tbody></table>${filtered.length ? "" : '<p class="ofw-native-note">没有匹配记录</p>'}</div><div class="snapshot-pagination"><span>${filtered.length} / ${asset.rowCount} 条 · 第 ${page} / ${pages} 页</span><button class="ofw-native-action" data-snapshot-action="prev" ${page <= 1 ? "disabled" : ""} aria-label="上一页">${icon("chevron-left")}</button><button class="ofw-native-action" data-snapshot-action="next" ${page >= pages ? "disabled" : ""} aria-label="下一页">${icon("chevron-right")}</button></div>`;
        }
      } else if (activeTab === "snapshots") {
        body = facts([
          ["快照ID", asset?.snapshotId || c.snapshotId],
          ["数据截至", c.asOf],
          ["生成时间", c.builtAt],
          ["文件名", c.file.name],
          ["文件大小", `${c.file.sizeBytes.toLocaleString("zh-CN")} 字节`],
          ["Excel工作表", `${c.file.sheetCount} 张`],
          [
            "记录覆盖",
            `${c.validation.rowCount} 条 / ${c.assets.length} 个资产`,
          ],
          ["完整文件SHA-256", c.file.sha256],
          ["资产记录SHA-256", asset?.contentDigest || c.dataDigest],
          ["状态", "完整模拟构造 · 已冻结"],
        ]);
      } else if (activeTab === "lineage") {
        body =
          facts([
            [
              "构造来源",
              "原型企业与评分样本 + 确定性模拟融资、现金、授信、担保、事件及坐标",
            ],
            ["快照输入", c.snapshotId],
            ["数据版本", c.dataVersion],
            [
              "完整性检查",
              `${c.validation.assetCount} 个资产，${c.validation.rowCount} 条记录，${c.validation.problems.length} 个异常`,
            ],
            ["消费语义", c.ontologyVersion],
            ["下游使用", "经营驾驶舱 / 融资与风险态势；问数、方案、报告"],
            ["边界", "模拟数据，非真实借据、金融交易或正式信用评级"],
          ]) +
          `<div class="snapshot-members">${entries
            .flatMap((item) =>
              item.fields
                .filter((f) => f.reference)
                .map((f) => {
                  const key = f.reference.split(".")[0],
                    target = c.assets.find((other) => other.key === key);
                  return `<button class="snapshot-member" data-snapshot-action="open" data-id="${target.id}"><strong>${esc(item.name)}.${esc(f.label)}</strong><span>关联 ${esc(target.name)}</span></button>`;
                }),
            )
            .join("")}</div>`;
      } else
        body = facts([
          ["数据属性", "完整模拟构造"],
          ["快照版本", asset?.version || "1.0.0"],
          ["数据截至", c.asOf],
          ["记录数量", `${asset?.rowCount ?? c.validation.rowCount} 条`],
          [
            "字段 / 成员",
            asset
              ? `${asset.fields.length} 个字段`
              : `${c.assets.length} 个资产`,
          ],
          ["质量结果", "主键唯一、字段完整、类型有效、外键完整"],
          [
            "数据来源",
            asset?.description ||
              "包含全部原始明细、字段字典、快照版本与来源说明",
          ],
          ["下游状态", "本地演示工作台已绑定；不替代正式业务数据"],
        ]);
      const header = `<div class="snapshot-notice"><span class="badge warning">模拟数据</span><strong>${esc(asset?.snapshotId || c.snapshotId)}</strong></div><div class="snapshot-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === activeTab}" class="${id === activeTab ? "active" : ""}" data-snapshot-action="tab" data-tab="${id}">${label}</button>`).join("")}</div>`;
      openDrawer(
        asset?.name || c.source.name,
        "数据工程 · 冻结模拟快照",
        `${header}${body}${error ? `<p class="snapshot-error" role="alert">${esc(error)}</p>` : ""}<p class="snapshot-download-status" role="status">${downloadBusy ? "正在读取并校验完整Excel文件…" : ""}</p>`,
        command("source", "来源快照", "", false) +
          command("situation", "查看经营态势") +
          command(
            "download",
            downloadBusy ? "校验中…" : "下载完整快照 Excel",
            downloadBusy ? "disabled" : "",
            true,
          ),
      );
      refresh();
    }
    async function download() {
      if (downloadBusy) return;
      downloadBusy = true;
      error = "";
      show();
      try {
        const c = catalog(),
          response = await win.fetch(c.file.url, { cache: "no-store", signal });
        if (!response.ok)
          throw new Error(`下载失败（HTTP ${response.status}），请重试`);
        const buffer = await response.arrayBuffer(),
          digest = Array.from(
            new Uint8Array(await win.crypto.subtle.digest("SHA-256", buffer)),
          )
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
        if (buffer.byteLength !== c.file.sizeBytes || digest !== c.file.sha256)
          throw new Error("快照文件与登记指纹不一致，已停止下载");
        const url = win.URL.createObjectURL(
            new win.Blob([buffer], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
          ),
          anchor = doc.createElement("a");
        anchor.href = url;
        anchor.download = c.file.name;
        doc.body.append(anchor);
        anchor.click();
        anchor.remove();
        win.setTimeout(() => win.URL.revokeObjectURL(url), 3000);
        downloadBusy = false;
        show();
        doc.querySelector(".snapshot-download-status").textContent =
          "完整Excel文件已校验，下载已发起";
      } catch (caught) {
        if (signal?.aborted) return;
        error = caught.message;
        downloadBusy = false;
        show();
      }
    }
    function render() {
      const c = catalog();
      if (!c) return;
      doc
        .querySelectorAll("[data-snapshot-record]")
        .forEach((node) => node.remove());
      const column = doc.querySelector(".asset-column");
      if (column) {
        const table = column.querySelector(".asset-resource-table tbody"),
          grid = column.querySelector(".asset-grid");
        for (const asset of c.assets) {
          const node = doc.createElement(table ? "tr" : "article");
          node.dataset.snapshotRecord = asset.id;
          node.className = table ? "" : "asset-card";
          const open = `<button class="text-link" type="button" data-snapshot-action="open" data-id="${asset.id}">查看详情</button>`;
          node.innerHTML = table
            ? `<td><div class="table-resource-name"><span class="source-icon">SN</span><div><strong>${esc(asset.name)}</strong><small>完整模拟构造 · ${asset.rowCount} 条记录</small></div></div></td><td>${asset.snapshotId}</td><td>经营态势演示</td><td>${asset.asOf}</td><td><span class="badge success">完整性通过</span></td><td>1</td><td>${asset.fields.filter((f) => f.reference).length} 项引用</td><td>${c.builtAt.slice(0, 10)}</td><td><span class="badge warning">模拟快照已冻结</span></td><td>${open}</td>`
            : `<div><span class="eyebrow">模拟数据资产</span><h3>${esc(asset.name)}</h3><p>${asset.rowCount} 条记录 · ${asset.fields.length} 个字段</p></div><div class="summary-strip"><div class="fact"><span>冻结快照</span><strong>${asset.snapshotId}</strong></div><div class="fact"><span>数据截至</span><strong>${asset.asOf}</strong></div><div class="fact"><span>质量检查</span><strong>完整性通过</strong></div><div class="fact"><span>下游使用</span><strong>融资与风险态势</strong></div></div><div class="card-foot"><span class="badge warning">完整模拟构造</span>${open}</div>`;
          (table || grid)?.append(node);
        }
        for(const asset of financingAssets){const node=doc.createElement(table?'tr':'article');node.dataset.snapshotRecord=asset.id;node.className=table?'':'asset-card';const open=`<button class="text-link" data-snapshot-action="open" data-id="${asset.id}">查看详情</button>`;node.innerHTML=table?`<td><strong>${esc(asset.name)}</strong><small>${asset.rowCount} 条原台账明细</small></td><td>${esc(asset.version)}</td><td>融资模型输入</td><td>${asset.asOf}</td><td>重定价条款按源读取</td><td>1</td><td>源行可追溯</td><td>${asset.asOf}</td><td>信用评级待源提供</td><td>${open}</td>`:`<h3>${esc(asset.name)}</h3><p>${asset.rowCount} 条 · 原借据与源行可追溯</p><p>重定价条款按源读取，信用评级待源提供。</p>${open}`;(table||grid)?.append(node);}
        const count = column.querySelector(".resource-column-head h2 em");
        if (count)
          count.textContent = String((table || grid)?.children.length || 0);
        let filter = column.querySelector("[data-snapshot-asset-filter]");
        if (!filter) {
          filter = doc.createElement("label");
          filter.className = "snapshot-search";
          filter.dataset.snapshotAssetFilter = "";
          filter.innerHTML =
            '<input aria-label="搜索数据资产" placeholder="搜索资产名称、版本或状态"><span data-snapshot-asset-count></span>';
          column.querySelector(".resource-column-head")?.after(filter);
          filter.querySelector("input").value = assetQuery;
        }
        filterAssets();
      }
      const sourceColumn = doc.querySelector(".source-column");
      if (sourceColumn) {
        const table = sourceColumn.querySelector(
            ".source-resource-table tbody",
          ),
          group = sourceColumn.querySelector(".source-groups");
        const node = doc.createElement(table ? "tr" : "article");
        node.dataset.snapshotRecord = c.source.id;
        node.className = table ? "" : "source-card";
        const open = `<button class="text-link" type="button" data-snapshot-action="open" data-id="${c.source.id}">查看详情</button>`;
        node.innerHTML = table
          ? `<td><strong>${c.source.name}</strong></td><td>手工工作簿</td><td>完整模拟构造</td><td>文件已校验</td><td>1</td><td>${c.asOf}</td><td>冻结快照</td><td>${c.builtAt.slice(0, 10)}</td><td>${open}</td>`
          : `<div class="source-card-head"><span class="source-icon">${icon("file-spreadsheet")}</span><div><h3>${c.source.name}</h3><p>${c.assets.length} 个资产 · ${c.validation.rowCount} 条记录 · Excel完整文件</p></div><span class="badge warning">模拟</span></div><div class="source-card-facts"><div class="fact"><span>数据截至</span><strong>${c.asOf}</strong></div><div class="fact"><span>快照</span><strong>1个完整文件</strong></div></div><div class="card-foot"><span>已生成并校验</span>${open}</div>`;
        const search =
          doc.querySelector("#resource-search")?.value.trim().toLowerCase() ||
          "";
        if (
          !search ||
          `${c.source.name} 模拟 数据 快照`.toLowerCase().includes(search)
        ) {
          if (table) table.append(node);
          else if (group) {
            const section = doc.createElement("section");
            section.className = "source-group";
            section.dataset.snapshotRecord = "source-group";
            section.innerHTML =
              '<div class="source-group-head"><strong>模拟工作簿</strong><span>1 个来源</span></div><div class="source-card-grid"></div>';
            section.querySelector(".source-card-grid").append(node);
            group.append(section);
          }
        }
        const count = sourceColumn.querySelector(".resource-column-head h2 em");
        if (count)
          count.textContent = String((win.DE_DATA?.sources.length || 0) + 1);
      }
      const params = new URLSearchParams(win.location.hash.split("?")[1] || ""),
        id = params.get("snapshotAsset");
      if (id && win.location.hash !== lastRoute) {
        lastRoute = win.location.hash;
        activeId = id;
        activeTab = ["overview", "data", "snapshots", "lineage"].includes(
          params.get("snapshotTab"),
        )
          ? params.get("snapshotTab")
          : "overview";
        show();
      } else if (!id) {
        lastRoute = null;
        activeId = null;
      }
      refresh();
    }
    function filterAssets() {
      const column = doc.querySelector(".asset-column");
      if (!column) return;
      const nodes = [
        ...column.querySelectorAll(
          ".asset-resource-table tbody > tr,.asset-grid > .asset-card",
        ),
      ];
      for (const node of nodes)
        node.style.display =
          !assetQuery ||
          node.textContent.toLowerCase().includes(assetQuery.toLowerCase())
            ? ""
            : "none";
      const count = column.querySelector("[data-snapshot-asset-count]");
      if (count)
        count.textContent = `${nodes.filter((node) => node.style.display !== "none").length} / ${nodes.length} 个资产`;
    }
    doc.addEventListener(
      "input",
      (event) => {
        if (event.target.matches("[data-snapshot-asset-filter] input")) {
          assetQuery = event.target.value.trim();
          filterAssets();
        }
      },
      { signal },
    );
    doc.addEventListener(
      "click",
      (event) => {
        const node = event.target.closest("[data-snapshot-action]");
        if (!node) {
          const close = event.target.closest(
            '[data-ofw-native-action="close-drawer"]',
          );
          if (
            activeId &&
            close &&
            (!close.classList.contains("ofw-native-drawer-backdrop") ||
              event.target === close)
          ) {
            activeId = null;
            lastRoute = null;
            win.history.replaceState(null, "", "#/resources");
          }
          return;
        }
        event.preventDefault();
        const action = node.dataset.snapshotAction;
        if (action === "open") setRoute(node.dataset.id);
        if (action === "tab") setRoute(activeId, node.dataset.tab);
        if (action === "source") setRoute(catalog().source.id, "snapshots");
        if (action === "prev" || action === "next") {
          page += action === "next" ? 1 : -1;
          show();
        }
        if (action === "download") void download();
        if (action === "situation")
          global.OFW_V14_JOINT.open("dashboard", "situation");
      },
      { signal },
    );
    doc.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && activeId) {
          activeId = null;
          lastRoute = null;
          win.history.replaceState(null, "", "#/resources");
        }
      },
      { signal },
    );
    doc.addEventListener(
      "submit",
      (event) => {
        if (!event.target.matches("[data-snapshot-search]")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        query = new win.FormData(event.target).get("query").trim();
        page = 1;
        show();
      },
      { signal, capture: true },
    );
    if (!doc.getElementById("snapshot-assets-style")) {
      const style = doc.createElement("style");
      style.id = "snapshot-assets-style";
      style.textContent =
        ".snapshot-tabs{display:flex;border-bottom:1px solid #dce3eb;gap:16px;margin:16px 0}.snapshot-tabs button{padding:10px 0;border:0;border-bottom:2px solid transparent;background:none;font-size:14px;color:#63768c}.snapshot-tabs button.active{border-color:#315fae;color:#244b8d}.snapshot-notice{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.snapshot-notice strong{font-size:12px;overflow-wrap:anywhere}.snapshot-table{overflow:auto;max-height:360px}.snapshot-table table{border-collapse:collapse;width:100%;font-size:13px}.snapshot-table th,.snapshot-table td{padding:10px;border-bottom:1px solid #dce3eb;text-align:left;white-space:nowrap}.snapshot-table th{background:#eef3fa;position:sticky;top:0}.snapshot-table small{display:block;font-size:12px;color:#697b90}.snapshot-pagination{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:12px 0}.snapshot-pagination span{margin-right:auto;font-size:13px}.snapshot-search{display:flex;gap:8px;margin:16px 0}.snapshot-search input{flex:1;min-width:0;border:1px solid #bdcddd;padding:8px;border-radius:4px}.snapshot-error{color:#b43d3d}.snapshot-download-status{font-size:13px;color:#315fae}.snapshot-members{display:grid;gap:8px}.snapshot-member{display:flex;justify-content:space-between;gap:12px;text-align:left;padding:12px;border:1px solid #dce3eb;background:#fff;color:#314e75}.snapshot-member span{font-size:12px}.snapshot-fields{margin:16px 0}.snapshot-fields summary{cursor:pointer;font-size:14px}.ofw-native-action svg{width:16px;height:16px}@media(max-width:620px){.snapshot-tabs{gap:10px}.snapshot-tabs button{font-size:13px}.snapshot-member{flex-wrap:wrap}}";
      doc.head.append(style);
    }
    return {
      render,
      sourceCount: () => (catalog() ? 1 : 0),
      snapshotCount: () => (catalog() ? 1 : 0),
    };
  }
  global.OFW_V14_SNAPSHOT_ASSETS = Object.freeze({ create });
})(window);
