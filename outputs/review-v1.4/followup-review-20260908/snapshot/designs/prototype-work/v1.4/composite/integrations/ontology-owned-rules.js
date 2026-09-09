(function installOntologyRuleWorkspace(global) {
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
  function create({ doc, win, signal }) {
    let selectedKey = "",
      result = null,
      busy = false,
      epoch = 0,
      horizon = 90,
      error = "";
    const storageKey = "ofw.v14.ontology-rule-validation.v1";
    const state = () => win.OFW_M01_PORTFOLIO_STATE;
    function current() {
      const s = state(),
        params = new URLSearchParams(win.location.hash.split("?")[1] || ""),
        draft = s?.drafts.find(
          (item) => item.id === (params.get("draft") || s.activeDraftId),
        );
      if (!draft?.operationsOwner || draft.publishedVersionId) return null;
      const id =
        doc
          .querySelector(".drawer-layer .drawer header .mono")
          ?.textContent.trim() ||
        doc.querySelector(".palette-item.active")?.dataset.resource;
      const rule = draft.rules.find(
        (item) => item.id === id && item.operationsRuleKey,
      );
      return rule ? { draft, rule } : null;
    }
    const fingerprint = (value) =>
      JSON.stringify([
        value.draft.id,
        value.draft.draftRevision,
        value.rule,
        value.draft.metrics.filter((item) => item.operationsDefinitionId),
      ]);
    function history() {
      try {
        return JSON.parse(global.localStorage.getItem(storageKey) || "[]");
      } catch {
        return [];
      }
    }
    function render() {
      if (!state() || !win.OFW_V14_OWNED_RULES) return;
      const s = state(),
        owners = win.OFW_V14_OWNED_RULES.owners;
      doc.querySelectorAll(".published-ontology-card").forEach((card) => {
        const button = card.querySelector('[data-action^="open-version:"]'),
          version = s.publishedVersions.find(
            (item) => item.id === button?.dataset.action.split(":")[1],
          ),
          owner = Object.entries(owners).find(
            ([, item]) => item.ontologyId === version?.ontologyStableId,
          )?.[0];
        if (owner && !card.querySelector("[data-owned-rule-open]"))
          card
            .querySelector("footer")
            ?.insertAdjacentHTML(
              "beforeend",
              `<button type="button" class="btn" data-owned-rule-open="${owner}">规则与指标修订</button>`,
            );
      });
      const c = current(),
        key = c ? fingerprint(c) : "";
      if (key !== selectedKey) {
        selectedKey = key;
        epoch++;
        busy = false;
        error = "";
        result = c
          ? history().find(
              (item) =>
                item.ruleFingerprint === key && item.horizon === horizon,
            ) || null
          : null;
      }
      doc
        .querySelectorAll("[data-owned-rule-panel]")
        .forEach((node) => node.remove());
      if (!c) return;
      const host =
        doc.querySelector(".drawer-layer .drawer-body") ||
        doc.querySelector(".workbench-shell .inspector-body");
      if (!host) return;
      const panel = doc.createElement("section");
      panel.dataset.ownedRulePanel = "";
      panel.className = "owned-rule-panel";
      panel.innerHTML = `<h3>规则验证</h3><dl><dt>所属本体</dt><dd>${esc(c.draft.name)}</dd><dt>修订草稿</dt><dd>${esc(c.draft.draftName)}</dd><dt>当前条件</dt><dd>${esc(c.rule.condition)}</dd><dt>输入</dt><dd>完整模拟快照 · 21家企业</dd></dl><label class="owned-rule-window">展望窗口<select data-owned-rule-window aria-label="规则验证窗口">${[30, 90, 180, 365].map((days) => `<option value="${days}" ${horizon === days ? "selected" : ""}>${days}天</option>`).join("")}</select></label><button type="button" class="btn primary" data-owned-rule-action="validate" ${busy ? "disabled" : ""}>${busy ? "正在验证…" : "运行规则验证"}</button>${error ? `<p class="owned-rule-error" role="alert">${esc(error)}</p>` : ""}${result ? `<div class="owned-rule-result"><strong>${result.objectIds.length} / 21 家企业命中</strong><p>${esc(result.condition)} · ${result.horizon}天</p><button type="button" class="btn" data-owned-rule-action="apply">在经营态势查看</button><details><summary>验证依据</summary><dl><dt>本体ID</dt><dd>${esc(result.ontologyId)}</dd><dt>规则ID</dt><dd>${esc(result.ruleId)}</dd><dt>数据版本</dt><dd>${esc(result.dataVersion)}</dd><dt>输入指纹</dt><dd>${esc(result.dataDigest)}</dd></dl><div>${result.rows.map((row) => `<p>${esc(row.name)}（${esc(row.city)}） · ${esc(row.value)}</p>`).join("") || "<p>没有命中企业</p>"}</div></details></div>` : ""}<p class="owned-rule-boundary">模拟验证不代表草稿已发布；当前正式规则和评分不变。</p>`;
      host.prepend(panel);
      const records = history().filter(
          (item) => item.draftId === c.draft.id && item.ruleId === c.rule.id,
        ),
        legacy = c.draft.operationsHistory || [];
      if (records.length || legacy.length)
        panel.insertAdjacentHTML(
          "beforeend",
          `<details class="owned-rule-history"><summary>验证记录 · ${records.length + legacy.length}</summary>${records.map((item) => `<p>${esc(item.condition)} · ${item.objectIds.length}家命中<br>${esc(item.createdAt)}${item.ruleFingerprint === key ? "" : " · 历史定义"}</p>`).join("")}${legacy.map((item) => `<p>迁移前记录 · 成本偏离 &gt; ${esc(item.threshold)}bp<br>${esc(item.createdAt || item.id)} · 仅保留历史依据</p>`).join("")}</details>`,
        );
      global.OFW_READABILITY?.refresh(doc);
    }
    async function validate() {
      const c = current();
      if (!c) return;
      const key = fingerprint(c);
      selectedKey = key;
      const request = ++epoch;
      busy = true;
      result = null;
      error = "";
      render();
      try {
        const metric = c.draft.metrics.find(
            (item) => item.id === c.rule.metricIds[0],
          ),
          definition = win.OFW_V14_BUSINESS_DEFINITIONS.definitions.find(
            (item) => item.id === c.rule.operationsRuleKey,
          );
        if (
          !metric ||
          metric.operationsDefinitionId !== definition.id ||
          metric.calculation !== definition.expression ||
          c.rule.objectId !== c.draft.objects[0].id
        )
          throw new Error(
            "规则依赖或指标计算已改变，当前验证器不能套用旧口径。",
          );
        let threshold = null;
        if (c.rule.operationsRuleKey === "costPremium") {
          const match = /^融资成本偏离\s*>\s*(\d+(?:\.\d+)?)\s*bp$/.exec(
            c.rule.condition.trim(),
          );
          if (!match || Number(match[1]) > 200)
            throw new Error(
              "当前支持“融资成本偏离 > 0至200 bp”的规则条件，请在编辑配置中核对。",
            );
          threshold = Number(match[1]);
        } else if (c.rule.condition.trim() !== "偿债资金缺口 > 0 百万元")
          throw new Error(
            "当前验证仅支持逐企业正向偿债缺口判断，不能忽略已修改的条件。",
          );
        const [domain, response] = await Promise.all([
          import("/src/domain.js"),
          fetch("/data/portfolio.json", { cache: "no-store", signal }),
        ]);
        if (!response.ok)
          throw new Error(`读取模拟快照失败：HTTP ${response.status}`);
        const data = domain.validateDataset(await response.json());
        if (data.digest !== win.OFW_V14_BUSINESS_DEFINITIONS.digest)
          throw new Error("本体修订与快照版本不一致");
        const calculated = domain.metrics(data, undefined, horizon);
        const matched = calculated.rows.filter((row) =>
          threshold === null ? row.gap > 0 : row.premium > threshold,
        );
        if (request !== epoch || !current() || fingerprint(current()) !== key)
          return;
        result = {
          id: global.crypto.randomUUID(),
          ontologyId: c.draft.ontologyStableId,
          draftId: c.draft.id,
          draftRevision: c.draft.draftRevision,
          baseVersionId: c.draft.basedOnVersionId,
          ruleId: c.rule.id,
          ruleName: c.rule.name,
          ruleFingerprint: key,
          condition: c.rule.condition,
          dataVersion: data.dataVersion,
          dataDigest: data.digest,
          ontologyVersion: data.ontologyVersion,
          asOf: data.asOf,
          horizon,
          threshold,
          objectIds: matched.map((row) => row.id),
          rows: matched.map((row) => ({
            id: row.id,
            name: row.name,
            city: row.city,
            value:
              threshold === null
                ? domain.amount(row.gap)
                : `${domain.fmt(row.premium)} bp`,
          })),
          resultKind: "SIMULATION",
          createdAt: new Date().toISOString(),
        };
        global.localStorage.setItem(
          storageKey,
          JSON.stringify([result, ...history()].slice(0, 50)),
        );
      } catch (caught) {
        if (request === epoch) error = caught.message;
      } finally {
        if (request === epoch) {
          busy = false;
          render();
        }
      }
    }
    doc.addEventListener(
      "click",
      (event) => {
        const open = event.target.closest("[data-owned-rule-open]");
        if (open) {
          global.OFW_V14_JOINT.openOntology(open.dataset.ownedRuleOpen);
          return;
        }
        const button = event.target.closest("[data-owned-rule-action]");
        if (button?.dataset.ownedRuleAction === "validate") void validate();
        if (button?.dataset.ownedRuleAction === "apply" && result) {
          try {
            global.OFW_V14_JOINT.applyOwnedRule(result);
          } catch (caught) {
            selectedKey = current() ? fingerprint(current()) : "";
            result = null;
            error = caught.message;
            render();
          }
        }
        if (
          event.target.closest('[data-action="open-data-engineering-lineage"]')
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          global.OFW_V14_JOINT.open("data", "resources");
        }
      },
      { signal, capture: true },
    );
    doc.addEventListener(
      "change",
      (event) => {
        if (event.target.matches("[data-owned-rule-window]")) {
          horizon = Number(event.target.value);
          result = null;
          epoch++;
          busy = false;
          render();
        }
      },
      { signal },
    );
    return { render };
  }
  global.OFW_V14_ONTOLOGY_RULES = Object.freeze({ create });
})(window);
