const {
  useEffect: useEvidenceEffect,
  useMemo: useEvidenceMemo,
  useRef: useEvidenceRef,
  useState: useEvidenceState,
} = React;

const PROTOTYPE_EVIDENCE_CSS = `
  .pe-link-button{display:inline-flex;align-items:center;gap:5px;padding:0;color:var(--accent);background:none;border:0;font-size:9px;font-weight:650;text-align:left}.pe-link-button:hover{text-decoration:underline}.pe-link-button:active{transform:translateY(1px)}
  .pe-filter-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:9px 10px;background:#fff;border:1px solid var(--line);border-bottom:0}.pe-filter-group{display:flex;align-items:flex-end;gap:7px;min-width:0}.pe-filter-bar .p-search{width:250px}.pe-filter-summary{color:var(--muted);font-size:8px;white-space:nowrap}
  .pe-run-state{display:grid;gap:3px}.pe-run-state small{color:var(--muted);font-size:8px}.pe-detail-tabs{margin-bottom:12px;border:1px solid var(--line);border-bottom:0}.pe-detail-body{min-height:330px}.pe-stack{display:grid;gap:12px}.pe-compact-stack{display:grid;gap:7px}.pe-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pe-split-asset{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr);gap:12px}.pe-kpi-band{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}.pe-kpi{padding:10px 11px;background:#fff}.pe-kpi span,.pe-kpi small{display:block;color:var(--muted);font-size:8px}.pe-kpi strong{display:block;margin:5px 0 3px;color:var(--ink);font-size:13px}.pe-kpi.success{box-shadow:inset 0 2px var(--success)}.pe-kpi.warning{box-shadow:inset 0 2px var(--warning)}.pe-kpi.failed{box-shadow:inset 0 2px var(--danger)}
  .pe-node-list{display:grid;border:1px solid var(--line);background:#fff}.pe-node-row{display:grid;grid-template-columns:34px minmax(170px,.8fr) minmax(0,1.2fr) 110px auto;align-items:center;gap:10px;min-height:56px;padding:7px 10px;border:0;border-bottom:1px solid var(--line);color:var(--ink-2);background:#fff;text-align:left}.pe-node-row:last-child{border-bottom:0}.pe-node-row:hover{background:#f7f9fd}.pe-node-row.active{background:#edf3ff;box-shadow:inset 3px 0 var(--accent)}.pe-node-order{width:25px;height:25px;display:grid;place-items:center;color:#fff;background:#607086;border-radius:50%;font-size:8px;font-weight:700}.pe-node-row.success .pe-node-order{background:var(--success)}.pe-node-row.warning .pe-node-order{background:var(--warning)}.pe-node-row.failed .pe-node-order{background:var(--danger)}.pe-node-main strong,.pe-node-main small,.pe-node-evidence strong,.pe-node-evidence small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pe-node-main strong{color:var(--ink);font-size:10px}.pe-node-main small,.pe-node-evidence small{margin-top:3px;color:var(--muted);font-size:8px}.pe-node-evidence strong{font-size:9px}.pe-node-time{color:var(--muted);font-size:8px}.pe-node-expanded{padding:11px;background:#f8fafc;border:1px solid var(--line);border-top:0}
  .pe-quality-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pe-mini-stat{padding:8px 9px;background:#f7f9fb;border:1px solid var(--line)}.pe-mini-stat span{display:block;color:var(--muted);font-size:8px}.pe-mini-stat strong{display:block;margin-top:4px;font-size:12px}.pe-failure-sample{padding:9px 10px;color:#782a31;background:#fff5f5;border:1px solid #e4bdc0;font-size:9px;line-height:1.6}.pe-code{font-family:"SFMono-Regular",Consolas,monospace;color:#244b86;background:#eef3fb;padding:1px 4px;border-radius:2px}
  .pe-member-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pe-member-card{min-width:0;padding:9px;background:#fff;border:1px solid var(--line)}.pe-member-card strong,.pe-member-card span,.pe-member-card small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pe-member-card strong{font-size:10px}.pe-member-card span{margin-top:7px;color:var(--ink);font-size:15px;font-weight:700}.pe-member-card small{margin-top:4px;color:var(--muted);font-size:8px}
  .pe-asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pe-asset-card{position:relative;min-height:202px;display:flex;flex-direction:column;gap:10px;padding:13px;color:var(--ink-2);background:#fff;border:1px solid var(--line);text-align:left}.pe-asset-card.real{grid-column:span 2;cursor:pointer;box-shadow:inset 3px 0 var(--accent)}.pe-asset-card.real:hover{border-color:#91ace4;box-shadow:inset 3px 0 var(--accent),0 3px 10px rgba(31,55,90,.08)}.pe-asset-card.real:active{transform:translateY(1px)}.pe-asset-card.planned{background:#f7f8fa;border-style:dashed}.pe-asset-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.pe-asset-title{display:flex;gap:9px;min-width:0}.pe-asset-icon{width:32px;height:32px;display:grid;place-items:center;flex:0 0 auto;color:var(--accent);background:var(--accent-soft);border:1px solid #bed0f3;border-radius:4px}.pe-asset-card.planned .pe-asset-icon{color:#7a8590;background:#eef1f3;border-color:#d2d8dd}.pe-asset-title strong,.pe-asset-title small{display:block}.pe-asset-title strong{font-size:11px}.pe-asset-title small{margin-top:3px;color:var(--muted);font-size:8px}.pe-asset-description{margin:0;color:var(--muted);font-size:9px;line-height:1.65}.pe-asset-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:9px;border-top:1px solid var(--line);color:var(--muted);font-size:8px}.pe-planning-note{margin-top:auto;padding:8px;color:#596673;background:#eef1f3;border:1px solid #d7dde2;font-size:8px;line-height:1.55}
  .pe-asset-context{display:flex;align-items:flex-end;gap:8px}.pe-asset-context .p-select-wrap select{min-width:230px}.pe-view-shell{background:#fff;border:1px solid var(--line)}.pe-view-shell>.p-tabs{border-bottom:1px solid var(--line)}.pe-view-body{padding:12px}.pe-version-note{padding:11px;border-left:3px solid var(--accent);background:#f5f8ff}.pe-version-note strong{display:block;font-size:10px}.pe-version-note p{margin:5px 0 0;color:var(--muted);font-size:9px;line-height:1.65}
  .pe-member-nav{display:grid;gap:5px}.pe-member-nav button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 10px;color:var(--ink-2);background:#fff;border:1px solid var(--line);text-align:left}.pe-member-nav button:hover{border-color:#9ab4e7;background:#f7faff}.pe-member-nav button.active{color:#173f91;background:#edf3ff;border-color:#8faeea;box-shadow:inset 3px 0 var(--accent)}.pe-member-nav strong,.pe-member-nav small{display:block}.pe-member-nav strong{font-size:9px}.pe-member-nav small{margin-top:3px;color:var(--muted);font-size:8px}.pe-member-nav b{align-self:center;font-size:10px}.pe-member-meta{margin-bottom:9px}.pe-table-toolbar{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:8px}.pe-table-toolbar .p-search{width:230px}.pe-readonly-label{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:8px}.pe-relationship-list{display:grid;gap:6px}.pe-relationship{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 9px;color:var(--ink-2);background:#fff;border:1px solid var(--line);text-align:left}.pe-relationship:hover{border-color:#9cb5e5}.pe-relationship.active{background:#eff4ff;border-color:#89a9e5}.pe-relationship code{font-size:8px;white-space:normal}.pe-arrow{color:var(--muted)}
  .pe-provenance{position:relative;display:grid;gap:8px}.pe-provenance::before{content:"";position:absolute;top:22px;bottom:22px;left:18px;width:1px;background:#bac8d5}.pe-provenance-item{position:relative;z-index:1;display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px;background:#fff;border:1px solid var(--line)}.pe-provenance-icon{width:26px;height:26px;display:grid;place-items:center;color:var(--accent);background:#edf3ff;border:1px solid #b9cdf0;border-radius:50%}.pe-provenance-copy strong,.pe-provenance-copy span{display:block}.pe-provenance-copy strong{font-size:10px}.pe-provenance-copy span{margin-top:3px;color:var(--muted);font-size:8px}
  .pe-refresh-flow{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);align-items:stretch}.pe-refresh-card{padding:11px;background:#fff;border:1px solid var(--line)}.pe-refresh-card.warning{border-top:3px solid var(--warning)}.pe-refresh-card.failed{border-top:3px solid var(--danger)}.pe-refresh-card.success{border-top:3px solid var(--success)}.pe-refresh-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}.pe-refresh-card-head strong{font-size:10px}.pe-refresh-arrow{display:grid;place-items:center;color:var(--muted)}.pe-contract-explain{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pe-contract-card{padding:9px;background:#f7f9fb;border:1px solid var(--line)}.pe-contract-card strong{display:block;font-size:9px}.pe-contract-card p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.55}
  .pe-lineage-page{display:grid;grid-template-rows:auto auto minmax(0,1fr);height:100%;background:#e9eef2}.pe-lineage-header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:66px;padding:10px 14px;background:#fff;border-bottom:1px solid var(--line)}.pe-lineage-title{display:flex;align-items:flex-start;gap:9px;min-width:0}.pe-lineage-title h1{margin:0;font-size:16px}.pe-lineage-title p{margin:3px 0 0;color:var(--muted);font-size:9px}.pe-lineage-actions{display:flex;align-items:center;gap:7px}.pe-lineage-toolbar{min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;background:#f8fafb;border-bottom:1px solid var(--line)}.pe-lineage-toolbar-left,.pe-lineage-toolbar-right{display:flex;align-items:center;gap:7px}.pe-segmented{display:flex;padding:2px;background:#e9edf1;border:1px solid #d0d7de;border-radius:4px}.pe-segmented button{min-height:27px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;color:#596674;background:transparent;border:0;border-radius:3px;font-size:9px}.pe-segmented button:hover{color:var(--accent)}.pe-segmented button.active{color:#173f93;background:#fff;box-shadow:0 1px 2px rgba(24,38,54,.12);font-weight:680}.pe-lineage-toolbar .p-search{width:215px}.pe-zoom-readout{min-width:43px;color:var(--muted);font-size:8px;text-align:center}
  .pe-lineage-workspace{position:relative;min-width:0;min-height:0;overflow:hidden}.pe-lineage-canvas{position:absolute;inset:0;overflow:hidden;background-color:#edf1f4;background-image:radial-gradient(#bdc7d0 0.7px,transparent .7px);background-size:18px 18px;touch-action:none;cursor:grab}.pe-lineage-canvas.panning{cursor:grabbing}.pe-lineage-stage{position:absolute;top:0;left:0;width:1880px;height:620px;transform-origin:0 0;will-change:transform}.pe-lineage-lines{position:absolute;inset:0;width:1880px;height:620px;overflow:visible}.pe-lineage-line{fill:none;stroke:#8f9eab;stroke-width:1.5;marker-end:url(#pe-arrowhead);pointer-events:stroke;cursor:pointer;transition:stroke 100ms,stroke-width 100ms}.pe-lineage-line:hover,.pe-lineage-line.active{stroke:var(--accent);stroke-width:3}.pe-lineage-line.trusted{stroke:#5b9b7d}.pe-lineage-line.failed{stroke:#c15860}.pe-lineage-node{position:absolute;width:158px;min-height:76px;padding:9px;color:var(--ink-2);background:#fff;border:1px solid #bfc9d2;border-top:3px solid #8595a4;border-radius:4px;box-shadow:0 2px 5px rgba(30,45,58,.09);text-align:left;cursor:grab;user-select:none;will-change:transform}.pe-lineage-node:hover{border-color:#7697d4;box-shadow:0 3px 9px rgba(36,65,103,.14)}.pe-lineage-node:active{cursor:grabbing}.pe-lineage-node.selected{outline:2px solid var(--accent);outline-offset:2px}.pe-lineage-node.search-hit{box-shadow:0 0 0 4px rgba(36,87,214,.16),0 3px 9px rgba(36,65,103,.14)}.pe-lineage-node.success{border-top-color:var(--success)}.pe-lineage-node.warning{border-top-color:var(--warning)}.pe-lineage-node.failed{border-top-color:var(--danger)}.pe-lineage-node.info{border-top-color:var(--info)}.pe-lineage-node-head{display:flex;align-items:center;justify-content:space-between;gap:5px}.pe-lineage-node-kind{color:var(--muted);font-size:7px;font-weight:700;text-transform:uppercase}.pe-lineage-node-title{display:block;margin-top:5px;color:var(--ink);font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pe-lineage-node-id{display:block;margin-top:3px;color:var(--muted);font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pe-lineage-node .p-status{margin-top:6px}.pe-lineage-legend{position:absolute;z-index:5;bottom:10px;left:10px;display:flex;align-items:center;gap:10px;padding:7px 9px;color:var(--muted);background:rgba(255,255,255,.94);border:1px solid var(--line);box-shadow:0 2px 6px rgba(27,42,55,.08);font-size:8px}.pe-legend-item{display:flex;align-items:center;gap:4px}.pe-legend-dot{width:7px;height:7px;border-radius:50%;background:#8595a4}.pe-legend-dot.success{background:var(--success)}.pe-legend-dot.warning{background:var(--warning)}.pe-legend-dot.failed{background:var(--danger)}.pe-legend-dot.info{background:var(--info)}
  .pe-lineage-drawer{position:absolute;z-index:12;top:0;right:0;bottom:0;width:340px;display:flex;flex-direction:column;background:#fff;border-left:1px solid var(--line);box-shadow:-8px 0 20px rgba(30,45,60,.10)}.pe-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;padding:12px;border-bottom:1px solid var(--line)}.pe-drawer-title{min-width:0}.pe-drawer-title span{display:block;color:var(--accent);font-size:8px;font-weight:700}.pe-drawer-title h2{margin:4px 0 0;font-size:13px}.pe-drawer-body{min-height:0;overflow:auto;padding:11px}.pe-drawer-section{padding:0 0 11px;margin-bottom:11px;border-bottom:1px solid var(--line)}.pe-drawer-section:last-child{border-bottom:0}.pe-drawer-section h3{margin:0 0 7px;color:var(--ink);font-size:9px}.pe-drawer-section p{margin:0;color:var(--muted);font-size:9px;line-height:1.65}.pe-drawer-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.pe-edge-info{position:absolute;z-index:7;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:7px 9px;color:#23446d;background:#f7fbff;border:1px solid #a9c2e6;box-shadow:0 3px 8px rgba(31,54,82,.10);font-size:8px}
  @media(max-width:1250px){.pe-asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pe-asset-card.real{grid-column:span 2}.pe-member-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.pe-lineage-drawer{width:310px}.pe-split-asset{grid-template-columns:240px minmax(0,1fr)}}
`;

function PrototypeEvidenceStyles() {
  return <style>{PROTOTYPE_EVIDENCE_CSS}</style>;
}

function peScenario(scenario, scenarioKey) {
  if (scenario && scenario.key) return scenario;
  return PROTOTYPE_SCENARIOS[scenarioKey] || PROTOTYPE_SCENARIOS.A;
}

function peTone(value) {
  const text = String(value || "");
  if (/失败|不兼容|硬阻断|未受理/.test(text)) return "failed";
  if (/警告|等待|未发布|排队|处理中|未知/.test(text)) return /处理中/.test(text) ? "running" : "warning";
  if (/成功|通过|就绪|已结束|已登记|已发布/.test(text)) return "success";
  if (/运行中|受理|已发出/.test(text)) return "info";
  return "neutral";
}

const PE_A_RUN_ID = "RUN-FIN-20260809-001";
const PE_A_REFRESH_ID = "REFRESH-FIN-20260809-001";
const PE_R1_ID = "ASSET-FINANCE@2026.07.31-r1";
const PE_R2_ID = "ASSET-FINANCE@2026.08.08-r2";
const PE_R3_ID = "ASSET-FINANCE@2026.08.08-r3";
const PE_LINEAGE_VERSION_FIXTURES = {
  [PE_R1_ID]: { t008: "2026-07-31", snapshot: "SNAP-FIN-20260731-001", run: PE_A_RUN_ID, refresh: PE_A_REFRESH_ID },
  [PE_R2_ID]: { t008: "2026-08-08", snapshot: "SNAP-FIN-20260808-002", run: "RUN-FIN-20260809-002", refresh: "REFRESH-FIN-20260809-002" },
  [PE_R3_ID]: { t008: "2026-08-08", snapshot: "SNAP-FIN-20260808-004", run: "RUN-FIN-20260809-004", refresh: "REFRESH-FIN-20260809-004" },
  "ASSET-FINANCE@2026.06.30-r0": { t008: "2026-06-30", snapshot: "SNAP-FIN-20260630-001", run: "RUN-FIN-20260702-000", refresh: "REFRESH-FIN-20260702-000" },
};
const PE_R0_VERSION = {
  id: "ASSET-FINANCE@2026.06.30-r0",
  label: "2026-06-30 · r0",
  t008: "2026-06-30",
  publishedAt: "2026-07-02 09:18",
  quality: "有警告·已确认",
  versionStatus: "不可变",
  consumption: "消费就绪",
  owner: "数据工程演示账号",
  run: "RUN-FIN-20260702-000",
  change: "融资标准化数据资产的上一可信基线版本",
};

function peAReady(flowState = {}) {
  return flowState.refreshed === true || flowState.priorAReady === true || flowState.resolvedReady === true;
}

function pePreviousTrustedVersion(scenario) {
  if (scenario.key === "A") return PE_R0_VERSION.id;
  if (scenario.key === "D") return PE_R2_ID;
  return PE_R1_ID;
}

function pePreviousTrustedLabel(scenario, includeId = false) {
  const id = pePreviousTrustedVersion(scenario);
  const label = id === PE_R0_VERSION.id ? "2026-06-30 · r0" : id === PE_R2_ID ? "2026-08-08 · r2" : "2026-07-31 · r1";
  return includeId ? id : label;
}

function peFlowReady(scenario, flowState = {}) {
  return scenario.key !== "A" || peAReady(flowState);
}

function peDynamicRuns(flowState = {}) {
  const aReady = peAReady(flowState);
  const baseRuns = PROTOTYPE_RUNS.map((run) => {
    if (run.id === "RUN-FIN-20260809-001") {
      return {
        ...run,
        id: PE_A_RUN_ID,
        execution: aReady ? "已结束" : "等待确认",
        closure: aReady ? "消费就绪" : "未发布",
        duration: aReady ? "5 分 02 秒" : "进行中",
      };
    }
    return run;
  });
  if (!flowState.retryRunCreated || !flowState.retryRunScenario) return baseRuns;
  const retryScenario = PROTOTYPE_SCENARIOS[flowState.retryRunScenario];
  const fixture = prototypeRetryRunFixture(flowState.retryRunScenario);
  if (!retryScenario || !fixture) return baseRuns;
  const state = flowState.canvasRunState || "running";
  const finished = ["hard-failed", "refresh-failed", "ready", "stopped"].includes(state);
  const execution = state === "hard-failed" ? "失败" : state === "waiting" ? "等待确认" : finished ? "已结束" : "运行中";
  const closure = state === "refresh-failed" ? "已发布·刷新失败" : state === "ready" ? "消费就绪" : "未发布";
  const duration = finished ? (state === "hard-failed" ? "26.1 秒" : state === "refresh-failed" ? "3 分 42 秒" : state === "ready" ? "4 分 08 秒" : "已结束") : "进行中";
  const retryRun = {
    id: fixture.id,
    t008: retryScenario.t008,
    type: "正式运行",
    trigger: "关联重试 · 画布手工触发",
    execution,
    closure,
    start: fixture.start,
    duration,
    retry: `源自 ${fixture.parentRun}`,
    scenario: retryScenario.key,
  };
  return [retryRun, ...baseRuns.filter((run) => run.id !== fixture.id)];
}

function peAvailableVersions(scenario, flowState = {}) {
  const versions = PROTOTYPE_ASSET_VERSIONS.some((version) => version.id === PE_R0_VERSION.id)
    ? PROTOTYPE_ASSET_VERSIONS
    : [...PROTOTYPE_ASSET_VERSIONS, PE_R0_VERSION];
  if (scenario.key === "A") {
    const ids = peAReady(flowState)
      ? [PE_R1_ID, PE_R0_VERSION.id]
      : [PE_R0_VERSION.id];
    return versions.filter((version) => ids.includes(version.id));
  }
  if (scenario.key === "C") {
    return versions.filter((version) => [PE_R1_ID, PE_R0_VERSION.id].includes(version.id));
  }
  if (scenario.key === "D") {
    return versions.filter((version) => [PE_R3_ID, PE_R2_ID, PE_R1_ID, PE_R0_VERSION.id].includes(version.id));
  }
  return versions.filter((version) => [PE_R2_ID, PE_R1_ID, PE_R0_VERSION.id].includes(version.id));
}

function peLatestVersion(scenario, flowState = {}) {
  return peAvailableVersions(scenario, flowState)[0] || PE_R0_VERSION;
}

function peRunIdForVersion(version) {
  return version.id === PE_R1_ID ? PE_A_RUN_ID : version.run;
}

function peLineageTargetForVersion(version, scenario, flowState = {}) {
  if (version.id.includes("2026.06.30")) return { scenarioKey: "A", lineageMode: "trusted" };
  if (version.id === PE_R1_ID) {
    if (scenario.key === "A" && peAReady(flowState)) return { scenarioKey: "A", lineageMode: "candidate" };
    return { scenarioKey: "B", lineageMode: "trusted" };
  }
  if (version.id === PE_R2_ID && scenario.key === "D") return { scenarioKey: "D", lineageMode: "trusted" };
  return { scenarioKey: version.id === PE_R3_ID ? "D" : "B", lineageMode: "candidate" };
}

function peScenarioForRun(run, fallback) {
  if (run && run.id === "RUN-FIN-20260702-000") {
    return {
      ...PROTOTYPE_SCENARIOS.A,
      t008: "2026-06-30",
      snapshot: "SNAP-FIN-20260630-001",
      run: "RUN-FIN-20260702-000",
      assetVersion: "ASSET-FINANCE@2026.06.30-r0",
      refresh: "REFRESH-FIN-20260702-000",
      execution: "已结束",
      closure: "消费就绪",
      taskTitle: "上一可信基线版本已完成并持续服务",
      taskImpact: "ASSET-FINANCE@2026.06.30-r0 已被权威消费绑定采用",
      color: "success",
    };
  }
  if (run && run.id === PE_A_RUN_ID) {
    return { ...PROTOTYPE_SCENARIOS.A, run: PE_A_RUN_ID, refresh: PE_A_REFRESH_ID };
  }
  return run && PROTOTYPE_SCENARIOS[run.scenario] ? PROTOTYPE_SCENARIOS[run.scenario] : fallback;
}

function peRunReady(run) {
  return run && run.closure === "消费就绪";
}

function peAvailableAssetVersions(scenario, flowState = {}) {
  return peAvailableVersions(scenario, flowState);
}

function peRunEnd(run) {
  if (!run || run.duration === "进行中") return "—";
  const map = {
    "RUN-FIN-20260809-004": "2026-08-09 10:23:42",
    "RUN-FIN-20260809-003": "2026-08-09 10:12:26",
    "RUN-FIN-20260809-005": "2026-08-09 10:26:26",
    "RUN-FIN-20260809-006": "2026-08-09 10:34:42",
    "RUN-FIN-20260809-002": "2026-08-09 10:10:08",
    [PE_A_RUN_ID]: run.execution === "已结束" ? "2026-08-09 10:05:02" : "—",
    "RUN-FIN-20260702-000": "2026-07-02 09:19:51",
    "TRIAL-FIN-20260809-001": "2026-08-09 09:55:08",
  };
  if (run.duration === "进行中") return "—";
  return map[run.id] || "—";
}

function peStageTiming(run, scenario) {
  if (run.type === "试运行") return [
    { label: "登记至资产发布", value: "不适用", detail: "试运行不发布 T007", tone: "" },
    { label: "发布至刷新结果", value: "不适用", detail: "试运行不请求刷新", tone: "" },
    { label: "整体闭环", value: "8.4 秒", detail: "仅完成临时计算证据", tone: "success" },
  ];
  if (run.id === "RUN-FIN-20260702-000") return [
    { label: "登记至资产发布", value: "1 分 47 秒", detail: "目标 ≤ 2 分钟 · 达标", tone: "success" },
    { label: "发布至刷新结果", value: "2 分 04 秒", detail: "目标 ≤ 3 分钟 · 达标", tone: "success" },
    { label: "整体闭环", value: "3 分 51 秒", detail: "上一可信基线持续服务", tone: "success" },
  ];
  if (scenario.key === "A" && peRunReady(run)) return [
    { label: "登记至资产发布", value: "1 分 58 秒", detail: "目标 ≤ 2 分钟 · 达标", tone: "success" },
    { label: "发布至刷新结果", value: "3 分 04 秒", detail: "已收到 T019 采用证据", tone: "success" },
    { label: "整体闭环", value: "5 分 02 秒", detail: "消费就绪", tone: "success" },
  ];
  if (scenario.key === "B") return [
    { label: "登记至资产发布", value: "1 分 56 秒", detail: "目标 ≤ 2 分钟 · 达标", tone: "success" },
    { label: "发布至刷新结果", value: "2 分 12 秒", detail: "目标 ≤ 3 分钟 · 达标", tone: "success" },
    { label: "整体闭环", value: "4 分 08 秒", detail: "已收到 T019 采用证据", tone: "success" },
  ];
  if (scenario.key === "D") return [
    { label: "登记至资产发布", value: "1 分 41 秒", detail: "目标 ≤ 2 分钟 · 达标", tone: "success" },
    { label: "发布至刷新结果", value: "2 分 01 秒", detail: "按时返回不兼容结果", tone: "failed" },
    { label: "整体闭环", value: "3 分 42 秒", detail: "上一可信版本继续服务", tone: "failed" },
  ];
  if (scenario.key === "C") return [
    { label: "登记至资产发布", value: "未完成", detail: "26.1 秒时被质量门硬阻断", tone: "failed" },
    { label: "发布至刷新结果", value: "不适用", detail: "未形成 T007", tone: "" },
    { label: "整体闭环", value: "未发布", detail: "上一可信版本继续服务", tone: "warning" },
  ];
  return [
    { label: "登记至资产发布", value: "进行中", detail: "质量警告等待人工确认", tone: "warning" },
    { label: "发布至刷新结果", value: "未开始", detail: "确认前不请求刷新", tone: "" },
    { label: "整体闭环", value: "未发布", detail: "上一可信版本继续服务", tone: "warning" },
  ];
}

function PrototypeRunsScreen({ scenario, scenarioKey, flowState = {}, onNavigate = () => {}, onToast = () => {} }) {
  const activeScenario = peScenario(scenario, scenarioKey);
  const [query, setQuery] = useEvidenceState("");
  const [type, setType] = useEvidenceState("全部类型");
  const [trigger, setTrigger] = useEvidenceState("全部触发");
  const [execution, setExecution] = useEvidenceState("全部执行状态");
  const [closure, setClosure] = useEvidenceState("全部闭环结果");

  const resolvedRuns = useEvidenceMemo(() => peDynamicRuns(flowState), [flowState.refreshed, flowState.priorAReady, flowState.resolvedReady, flowState.retryRunCreated, flowState.retryRunId, flowState.retryRunScenario, flowState.retryFrom, flowState.canvasRunState]);
  const rows = useEvidenceMemo(() => resolvedRuns.filter((run) => {
    const hitQuery = !query || `${run.id} ${run.t008}`.toLowerCase().includes(query.toLowerCase());
    return hitQuery && (type === "全部类型" || run.type === type) &&
      (trigger === "全部触发" || run.trigger === trigger) &&
      (execution === "全部执行状态" || run.execution === execution) &&
      (closure === "全部闭环结果" || run.closure === closure);
  }), [resolvedRuns, query, type, trigger, execution, closure]);
  const formalCount = resolvedRuns.filter((run) => run.type === "正式运行").length;
  const readyCount = resolvedRuns.filter((run) => run.closure === "消费就绪").length;
  const waitingCount = resolvedRuns.filter((run) => run.execution === "等待确认").length;
  const recoveryCount = resolvedRuns.filter((run) => run.execution === "失败" || run.closure === "已发布·刷新失败").length;

  const resetFilters = () => {
    setQuery(""); setType("全部类型"); setTrigger("全部触发"); setExecution("全部执行状态"); setClosure("全部闭环结果");
    onToast("筛选条件已清除", "success");
  };

  const columns = [
    { key: "id", label: "运行标识", width: "205px", render: (run) => <div className="p-primary-cell"><strong className="mono">{run.id}</strong><small>{run.type} · {run.trigger}</small></div> },
    { key: "t008", label: "数据截至时间", width: "100px", render: (run) => <span className="mono">{run.t008}</span> },
    { key: "execution", label: "执行状态", width: "112px", render: (run) => <PrototypeStatus tone={peTone(run.execution)} compact>{run.execution}</PrototypeStatus> },
    { key: "closure", label: "闭环结果", width: "150px", render: (run) => <PrototypeStatus tone={peTone(run.closure)} compact>{run.closure}</PrototypeStatus> },
    { key: "start", label: "开始时间", width: "135px", render: (run) => <span className="mono">{run.start}</span> },
    { key: "duration", label: "总耗时", width: "82px" },
    { key: "retry", label: "重试关系", render: (run) => <span title={run.retry}>{run.retry}</span> },
    { key: "open", label: "", width: "35px", render: () => <PrototypeIcon name="ChevronRight" size={14} /> },
  ];

  return (
    <main className="screen-page" data-screen-label="D6 运行历史">
      <PrototypeEvidenceStyles />
      <PrototypePageHeader
        kicker="D6 · 只读运行证据"
        title="运行历史"
        description="按开始时间倒序查看正式运行与试运行。执行状态说明流程做到哪一步，闭环结果说明是否真正发布并进入可信消费。"
        actions={<PrototypeButton icon="Workflow" onClick={() => onNavigate("pipelines")}>返回管道目录</PrototypeButton>}
        meta={<><span>当前评审场景 <strong>{activeScenario.name}</strong></span><span>历史事实不可改写</span></>}
      />
      <PrototypeMetricStrip items={[
        { label: "运行记录", value: String(resolvedRuns.length), detail: `${formalCount} 次正式运行 · ${resolvedRuns.length - formalCount} 次试运行`, icon: "History" },
        { label: "消费就绪", value: String(readyCount), detail: "已收到刷新和 T019 采用证据", icon: "CircleCheck", tone: "success" },
        { label: "等待确认", value: String(waitingCount), detail: "质量警告不自动放行", icon: "TriangleAlert", tone: "warning" },
        { label: "需恢复", value: String(recoveryCount), detail: "质量硬失败 · 刷新不兼容", icon: "CircleX", tone: "failed" },
      ]} />
      <section className="p-section">
        <PrototypeSectionHeader title="全部运行" count={rows.length} description="只提供一期有价值的检索与筛选；不导出、不删除、不批量操作。" />
        <div className="pe-filter-bar">
          <div className="pe-filter-group">
            <PrototypeSearch value={query} onChange={setQuery} placeholder="搜索运行标识或 T008" ariaLabel="搜索运行标识或数据截至时间" />
            <PrototypeSelect value={type} onChange={setType} options={["全部类型", "正式运行", "试运行"]} />
            <PrototypeSelect value={trigger} onChange={setTrigger} options={["全部触发", ...Array.from(new Set(resolvedRuns.map((run) => run.trigger)))]} />
            <PrototypeSelect value={execution} onChange={setExecution} options={["全部执行状态", ...Array.from(new Set(resolvedRuns.map((run) => run.execution)))]} />
            <PrototypeSelect value={closure} onChange={setClosure} options={["全部闭环结果", ...Array.from(new Set(resolvedRuns.map((run) => run.closure)))]} />
          </div>
          <div className="pe-filter-group"><span className="pe-filter-summary">默认按开始时间倒序</span><PrototypeButton size="sm" variant="ghost" icon="RotateCcw" onClick={resetFilters}>清除</PrototypeButton></div>
        </div>
        <PrototypeTable
          columns={columns}
          rows={rows}
          rowKey="id"
          onRowClick={(run) => onNavigate("run-detail", { runId: run.id, scenarioKey: run.scenario, resolvedReady: run.id === PE_A_RUN_ID && peRunReady(run) })}
          empty={<PrototypeEmpty icon="SearchX" title="没有符合条件的运行" description="请清除部分筛选条件；历史记录没有被删除。" action={<PrototypeButton onClick={resetFilters}>清除筛选</PrototypeButton>} />}
        />
      </section>
    </main>
  );
}

function peNodeEvidence(run, scenario) {
  const trial = run.type === "试运行";
  const base = [
    { key: "source", name: "数据源", summary: scenario.snapshot, detail: "原始快照已锁定 · 全量声明", duration: trial ? "1.1 秒" : "2.4 秒", state: "执行成功", tone: "success" },
    { key: "python", name: "Python 处理", summary: "融资工作簿标准化 v1 · 1.0.0", detail: "输入 5,218 行 · 输出四成员", duration: trial ? "4.6 秒" : "14.8 秒", state: "执行成功", tone: "success" },
    { key: "quality", name: "数据检查", summary: `DQ-FIN-20260809-${scenario.key === "B" ? "002" : scenario.key === "C" ? "003" : scenario.key === "D" ? "004" : "001"}`, detail: "融资固定检查集 v1.0 · 共 8 项", duration: trial ? "2.7 秒" : "8.9 秒", state: "执行成功", tone: scenario.key === "C" ? "failed" : "warning" },
    { key: "publish", name: "发布数据资产", summary: scenario.assetVersion, detail: "四成员 · 三关系 · 不可变版本", duration: "6.3 秒", state: "未执行", tone: "neutral" },
    { key: "refresh", name: "请求本体刷新", summary: scenario.refresh, detail: "目标 Published v1.0.0", duration: "2 分 01 秒", state: "未执行", tone: "neutral" },
  ];
  if (trial) {
    base[2].tone = "warning"; base[2].state = "临时结果·有警告";
    base[3] = { ...base[3], summary: "试运行不形成 T007", detail: "未执行发布", duration: "—" };
    base[4] = { ...base[4], summary: "试运行不请求刷新", detail: "未执行外部动作", duration: "—" };
  } else if (scenario.key === "C") {
    base[2].state = "执行成功·质量失败";
    base[2].detail = "8 项检查 · 1 项硬失败 · 3 项警告";
    base[3].summary = "被质量门阻断"; base[3].detail = "未形成 T007"; base[3].duration = "—";
    base[4].summary = "上游未发布"; base[4].detail = "未创建刷新请求"; base[4].duration = "—";
  } else if (scenario.key === "D") {
    base[2].state = "执行成功·警告已确认";
    base[3].state = "执行成功"; base[3].tone = "success";
    base[4].state = "请求成功·结果不兼容"; base[4].tone = "failed";
  } else if (peRunReady(run)) {
    base[2].state = "执行成功·警告已确认";
    base[2].detail = "8 项检查 · 5 通过 · 3 警告 · 已人工确认";
    base[3].state = "执行成功"; base[3].tone = "success";
    base[4].state = "执行成功·刷新成功"; base[4].tone = "success";
    base[4].duration = scenario.key === "B" ? "2 分 12 秒" : "3 分 04 秒";
  } else if (scenario.key === "A") {
    base[2].state = "执行成功·质量有警告";
    base[2].detail = "8 项检查 · 5 通过 · 3 警告 · 等待人工确认";
    base[3].summary = "等待质量确认"; base[3].detail = "确认前不形成 T007"; base[3].duration = "—";
    base[4].summary = "上游未发布"; base[4].detail = "未创建刷新请求"; base[4].duration = "—";
  }
  return base;
}

function PrototypeRunDetailScreen({ scenario, scenarioKey, flowState = {}, runId, initialTab = "summary", onNavigate = () => {}, onToast = () => {} }) {
  const fallback = peScenario(scenario, scenarioKey);
  const dynamicRuns = peDynamicRuns(flowState);
  const fallbackRunId = fallback.key === "A" ? PE_A_RUN_ID : fallback.run;
  const baseRun = dynamicRuns.find((item) => item.id === runId) || dynamicRuns.find((item) => item.id === fallbackRunId) || dynamicRuns[3];
  const run = baseRun;
  const activeScenario = peScenarioForRun(run, fallback);
  const runReady = peRunReady(run);
  const resolvedReady = run.id === PE_A_RUN_ID && runReady;
  const outcomeTone = runReady ? "success" : activeScenario.key === "C" || activeScenario.key === "D" ? "failed" : "warning";
  const outcomeTitle = runReady ? "发布、刷新与权威采用证据齐全，运行已消费就绪" : activeScenario.taskTitle;
  const outcomeImpact = runReady ? `${activeScenario.assetVersion} 已形成 T018，且 T019 已采用精确组合` : activeScenario.taskImpact;
  const [tab, setTab] = useEvidenceState(initialTab);
  const [expandedNode, setExpandedNode] = useEvidenceState(activeScenario.key === "C" ? "quality" : "");
  const [retryOpen, setRetryOpen] = useEvidenceState(false);
  useEvidenceEffect(() => { setTab(initialTab); setExpandedNode(activeScenario.key === "C" ? "quality" : ""); }, [run.id, initialTab]);

  const nodes = peNodeEvidence(run, activeScenario);
  const parentRunId = run.retry && run.retry.startsWith("源自 ") ? run.retry.slice(3) : "";
  const qualityRows = PROTOTYPE_QUALITY_ROWS.map((item) => {
    if (activeScenario.key === "C" && item.name === "产业板块有效值") return { ...item, result: "失败", affected: 1, actual: "发现旧名称“新能源控股”", recovery: "修正来源或板块标准化后创建关联重试" };
    if (["B", "D"].includes(activeScenario.key) && item.name === "担保方式完整性") return { ...item, affected: 1867, actual: "1,867 条为空" };
    return item;
  });
  const source = prototypeScenarioSource(activeScenario.key);

  const createRetry = () => {
    setRetryOpen(false);
    onToast(activeScenario.key === "D" ? "已记录恢复动作：先修正结构并形成新资产版本" : `已从 ${run.id} 创建关联重试上下文`, "success");
    onNavigate("canvas", { retryFrom: run.id, selectedNode: activeScenario.key === "D" ? "publish" : "quality" });
  };

  return (
    <main className="screen-page" data-screen-label="D6 运行详情">
      <PrototypeEvidenceStyles />
      <PrototypePageHeader
        kicker="D6 · 历史运行只读证据"
        title={run.id}
        description="这条记录及其证据不可改写；任何重试都会创建新运行或新刷新请求，并引用本记录。"
        onBack={() => onNavigate("runs")}
        actions={<><PrototypeButton icon="Workflow" onClick={() => onNavigate("canvas", { runId: run.id, historical: true, resolvedReady })}>返回管道</PrototypeButton><PrototypeButton variant="primary" icon="Route" onClick={() => onNavigate("lineage", { centerId: run.id, scenarioKey: run.scenario, lineageMode: run.id === "RUN-FIN-20260702-000" ? "trusted" : "candidate", resolvedReady })}>打开数据沿袭</PrototypeButton></>}
        meta={<><span>类型 <strong>{run.type}</strong></span><span>触发 <strong>{run.trigger}</strong></span><PrototypeStatus tone={peTone(run.execution)} compact>{run.execution}</PrototypeStatus><PrototypeStatus tone={peTone(run.closure)} compact>{run.closure}</PrototypeStatus><span>T008 <strong>{run.t008}</strong></span><span>{run.start} — {peRunEnd(run)} · {run.duration}</span></>}
      />
      <div className="pe-detail-tabs"><PrototypeTabs value={tab} onChange={setTab} items={[
        { value: "summary", label: "运行摘要", icon: "ClipboardList" },
        { value: "nodes", label: "节点与质量", icon: "ListTree" },
        { value: "publish", label: "发布与刷新", icon: "PackageCheck" },
      ]} /></div>
      <div className="pe-detail-body">
        {tab === "summary" ? <div className="pe-stack">
          <PrototypeAlert tone={outcomeTone} title={outcomeTitle}>
            {outcomeImpact}。固定边界：执行成功不等于质量通过，质量通过也不等于消费就绪。
          </PrototypeAlert>
          <div className="pe-kpi-band">{peStageTiming(run, activeScenario).map((item) => <div className={`pe-kpi ${item.tone}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</div>
          <section className="p-section">
            <PrototypeSectionHeader title="本次锁定上下文" description="以下版本共同决定了本次运行结果；历史运行不会跟随当前配置变化。" />
            <div className="p-section-body"><PrototypeKeyValues columns={3} items={[
              { label: "T002 原始快照", value: activeScenario.snapshot, mono: true },
              { label: "T003 管道保存版本", value: "PIPE-FIN-STD-v1.0 · 保存版本 13", mono: true },
              { label: "T004 Python 模块", value: "融资工作簿标准化 v1 · 1.0.0" },
              { label: "T008 数据截至时间", value: run.t008, mono: true },
              { label: "T006 串行队列", value: run.trigger.includes("共享文件夹") ? "队列位置 1 · 已出队" : parentRunId ? "关联重试 · 不排队" : "手工触发 · 不排队" },
              { label: "重试关系", value: run.retry, mono: run.retry !== "无" },
            ]} /></div>
          </section>
          <div className="pe-split">
            <section className="p-section">
              <PrototypeSectionHeader title="触发与版本关系" />
              <div className="p-section-body pe-compact-stack">
                <PrototypeKeyValues columns={1} compact items={[
                  { label: "触发方式", value: run.trigger },
                  { label: "运行类型", value: run.type },
                  { label: "父子运行", value: run.retry === "无" ? "无关联重试" : run.retry },
                ]} />
                {run.retry !== "无" ? <PrototypeButton size="sm" variant="ghost" icon="ExternalLink" onClick={() => { const parentId = run.retry.replace(/^源自\s*/, ""); const parentScenario = PROTOTYPE_RUNS.find((item) => item.id === parentId); onNavigate("run-detail", { runId: parentId, scenarioKey: parentScenario ? parentScenario.scenario : activeScenario.key, resolvedReady: parentId === PE_A_RUN_ID }); }}>打开原运行</PrototypeButton> : null}
              </div>
            </section>
            <section className="p-section">
              <PrototypeSectionHeader title="证据入口" description="打开原始证据，不在此页修改历史。" />
              <div className="p-section-body pe-compact-stack">
                <PrototypeButton icon="FileSpreadsheet" onClick={() => onNavigate(source.target, { sourceId: source.id, snapshotId: activeScenario.snapshot })}>打开原始快照</PrototypeButton>
                <PrototypeButton icon="Workflow" onClick={() => onNavigate("canvas", { runId: run.id, historical: true })}>在画布中定位本次运行</PrototypeButton>
              </div>
            </section>
          </div>
        </div> : null}

        {tab === "nodes" ? <div className="pe-stack">
          <PrototypeAlert tone={activeScenario.key === "C" ? "failed" : "info"} title={activeScenario.key === "C" ? "数据检查节点执行成功，但正式质量结果失败" : "节点执行状态与正式质量状态分开记录"}>
            {activeScenario.key === "C" ? "旧板块名称“新能源控股”命中硬阻断，发布节点未执行。" : "展开任一节点查看输入输出规模和证据摘要；质量警告需要人工确认。"}
          </PrototypeAlert>
          <div className="pe-node-list">{nodes.map((node, index) => <React.Fragment key={node.key}>
            <button type="button" className={`pe-node-row ${node.tone} ${expandedNode === node.key ? "active" : ""}`} onClick={() => setExpandedNode(expandedNode === node.key ? "" : node.key)} aria-expanded={expandedNode === node.key}>
              <span className="pe-node-order">{String(index + 1).padStart(2, "0")}</span>
              <span className="pe-node-main"><strong>{node.name}</strong><small>{node.state}</small></span>
              <span className="pe-node-evidence"><strong className={node.summary.includes("-") ? "mono" : ""}>{node.summary}</strong><small>{node.detail}</small></span>
              <span className="pe-node-time">耗时 {node.duration}</span>
              <PrototypeStatus tone={node.tone} compact>{node.state}</PrototypeStatus>
            </button>
            {expandedNode === node.key ? <div className="pe-node-expanded">
              <div className="pe-split">
                <PrototypeKeyValues columns={2} compact items={[
                  { label: "开始", value: index < 3 || ["B", "D"].includes(activeScenario.key) ? `${run.start.slice(0, 10)} · 已记录` : "未开始" },
                  { label: "结束", value: node.state === "未执行" ? "未执行" : "已记录" },
                  { label: "输入规模", value: node.key === "source" ? "1 个工作簿" : "5,218 条融资明细" },
                  { label: "输出规模", value: node.key === "python" ? "4 个成员 · 5,840 行" : node.key === "quality" ? "8 项正式检查" : node.detail },
                ]} />
                <div className="pe-compact-stack"><PrototypeAlert tone={node.tone === "failed" ? "failed" : node.tone === "warning" ? "warning" : "info"} title="日志摘要">{node.detail}。完整历史证据保持只读。</PrototypeAlert><PrototypeButton size="sm" icon="LocateFixed" onClick={() => onNavigate("canvas", { runId: run.id, historical: true, selectedNode: node.key })}>在 D5 聚焦该节点</PrototypeButton></div>
              </div>
            </div> : null}
          </React.Fragment>)}</div>
          <section className="p-section">
            <PrototypeSectionHeader title="正式 T005 · 融资固定检查集 v1.0" count={8} description="检查明细属于本次运行，不另建冲突的数据质量页面。" actions={(activeScenario.key === "C" || run.execution === "等待确认") && run.type !== "试运行" ? <PrototypeButton size="sm" variant={activeScenario.key === "C" ? "danger" : "warning"} icon="RotateCcw" onClick={() => setRetryOpen(true)}>{activeScenario.key === "C" ? "创建关联重试" : "返回画布处理警告"}</PrototypeButton> : null} />
            <div className="p-section-body pe-compact-stack">
              <div className="pe-quality-summary">
                <div className="pe-mini-stat"><span>检查总数</span><strong>8</strong></div>
                <div className="pe-mini-stat"><span>通过</span><strong>{activeScenario.key === "C" ? "4" : "5"}</strong></div>
                <div className="pe-mini-stat"><span>警告</span><strong>3</strong></div>
                <div className="pe-mini-stat"><span>失败</span><strong>{activeScenario.key === "C" ? "1" : "0"}</strong></div>
              </div>
              {activeScenario.key === "C" ? <div className="pe-failure-sample"><strong>有限失败样例</strong> · 单位编码 <span className="pe-code">UNIT-553</span> 的统一产业板块为 <span className="pe-code">新能源控股</span>；预期使用已确认的新板块名称。该记录使本次正式 T005 失败，T007 未形成。</div> : null}
            </div>
            <PrototypeTable columns={[
              { key: "name", label: "检查名称", width: "175px" },
              { key: "group", label: "分组", width: "110px" },
              { key: "result", label: "结果", width: "86px", render: (item) => <PrototypeStatus compact tone={peTone(item.result)}>{item.result}</PrototypeStatus> },
              { key: "level", label: "门禁", width: "86px" },
              { key: "affected", label: "影响行数", width: "80px", align: "right" },
              { key: "actual", label: "实际结果" },
              { key: "recovery", label: "恢复建议", width: "205px" },
            ]} rows={qualityRows} rowKey="name" />
          </section>
        </div> : null}

        {tab === "publish" ? <PrototypeRunPublishTab run={run} scenario={activeScenario} onNavigate={onNavigate} onRetry={() => setRetryOpen(true)} /> : null}
      </div>
      <PrototypeModal open={retryOpen} onClose={() => setRetryOpen(false)} title={activeScenario.key === "D" ? "确认恢复不兼容候选" : "创建关联重试"} icon="RotateCcw" footer={<><PrototypeButton onClick={() => setRetryOpen(false)}>取消</PrototypeButton><PrototypeButton variant="primary" onClick={createRetry}>{activeScenario.key === "D" ? "返回管道修正" : "创建重试上下文"}</PrototypeButton></>}>
        <PrototypeAlert tone={activeScenario.key === "D" ? "failed" : "warning"} title={activeScenario.key === "D" ? "同一结构直接重试仍会不兼容" : "历史运行不会被修改"}>
          {activeScenario.key === "D" ? "先在发布节点修正融资负责人参考的字段合同，再形成新的不可变资产版本；不对同一不兼容 T007 盲目重发。" : `新运行将引用 ${run.id}，并从允许的失败位置开始；已成功节点仍以原证据为依据。`}
        </PrototypeAlert>
      </PrototypeModal>
    </main>
  );
}

function PrototypeRunPublishTab({ run, scenario, onNavigate, onRetry }) {
  const trial = run.type === "试运行";
  const noAsset = trial || !["消费就绪", "已发布·刷新失败"].includes(run.closure);
  const resolvedReady = run.id === PE_A_RUN_ID && peRunReady(run);
  if (trial) return <PrototypeEmpty icon="FlaskConical" title="不适用 · 试运行不发布" description="本次只形成临时预览与检查结果，不形成 T007，也不请求本体刷新。" action={<PrototypeButton icon="Workflow" onClick={() => onNavigate("canvas", { runId: run.id, historical: true })}>返回画布查看临时结果</PrototypeButton>} />;
  if (noAsset) return <div className="pe-stack">
    <PrototypeAlert tone={scenario.key === "C" ? "failed" : "warning"} title={scenario.key === "C" ? "质量硬阻断，未发布 T007" : "质量警告等待确认，尚未发布 T007"}>
      {scenario.key === "C" ? "产业板块有效值检查失败，发布与刷新均未执行。" : "只有在同一演示账号确认三项可选字段警告后，第四节点才会发布不可变版本。"}
    </PrototypeAlert>
    <div className="pe-split">
      <section className="p-section"><PrototypeSectionHeader title="发布结果" /><div className="p-section-body"><PrototypeKeyValues columns={1} items={[
        { label: "T007", value: "未形成" }, { label: "阻断位置", value: scenario.key === "C" ? "数据检查 · 产业板块有效值" : "数据检查 · 等待人工确认" }, { label: "四成员 / 三关系", value: "候选已计算，但未作为不可变资产发布" },
      ]} /></div></section>
      <section className="p-section"><PrototypeSectionHeader title="刷新结果" /><div className="p-section-body"><PrototypeKeyValues columns={1} items={[
        { label: "刷新请求", value: "未创建" }, { label: "目标 T017", value: "Published v1.0.0 · 配置已锁定" }, { label: "当前服务", value: `${pePreviousTrustedLabel(scenario)} 继续服务` },
      ]} /></div></section>
    </div>
    <div className="p-inline-actions"><PrototypeButton variant={scenario.key === "C" ? "danger" : "warning"} icon={scenario.key === "C" ? "RotateCcw" : "TriangleAlert"} onClick={onRetry}>{scenario.key === "C" ? "创建关联重试" : "返回画布处理警告"}</PrototypeButton><PrototypeButton icon="Route" onClick={() => onNavigate("lineage", { centerId: run.id, scenarioKey: scenario.key })}>查看停在何处</PrototypeButton></div>
  </div>;

  const incompatible = run.closure === "已发布·刷新失败";
  return <div className="pe-stack">
    <PrototypeAlert tone={incompatible ? "failed" : "success"} title={incompatible ? "T007 已发布，但刷新结果不兼容" : "发布、刷新与权威采用证据齐全"}>
      {incompatible ? `候选版本未被 T019 采用；上一可信 ${pePreviousTrustedLabel(scenario)} 继续服务。` : "只有收到 T018 形成且 T019 正式采用的权威证据后，本页才显示消费就绪。"}
    </PrototypeAlert>
    <section className="p-section">
      <PrototypeSectionHeader title="不可变资产版本" actions={<PrototypeButton size="sm" icon="ExternalLink" onClick={() => onNavigate("asset-detail", { versionId: scenario.assetVersion, scenarioKey: scenario.key, resolvedReady })}>打开资产详情</PrototypeButton>} />
      <div className="p-section-body pe-stack"><PrototypeKeyValues columns={3} items={[
        { label: "T007", value: scenario.assetVersion, mono: true }, { label: "T008", value: scenario.t008, mono: true }, { label: "发布状态", value: "发布成功 · 不可变" },
      ]} /><div className="pe-member-strip">{PROTOTYPE_MEMBERS.map((member) => <div className="pe-member-card" key={member.key}><strong>{member.name}</strong><span>{member.rows.toLocaleString("zh-CN")}</span><small>{member.grain} · 主键 {member.primaryKey}</small></div>)}</div><PrototypeAlert title="关系端点检查">3 条成员关系全部通过，未匹配端点为 0。</PrototypeAlert></div>
    </section>
    <div className="pe-refresh-flow">
      <div className="pe-refresh-card success"><div className="pe-refresh-card-head"><strong>刷新请求</strong><PrototypeStatus tone="success" compact>已受理</PrototypeStatus></div><PrototypeKeyValues columns={1} compact items={[
        { label: "请求标识", value: scenario.refresh, mono: true }, { label: "候选 T007 / T008", value: `${scenario.assetVersion} · ${scenario.t008}` }, { label: "目标 T017", value: "融资演示本体 · Published v1.0.0" }, { label: "来源映射", value: "融资标准化来源映射 v1" },
      ]} /></div>
      <div className="pe-refresh-arrow"><PrototypeIcon name="ArrowRight" size={18} /></div>
      <div className={`pe-refresh-card ${incompatible ? "failed" : "success"}`}><div className="pe-refresh-card-head"><strong>刷新结果</strong><PrototypeStatus tone={incompatible ? "failed" : "success"} compact>{incompatible ? "不兼容" : "成功"}</PrototypeStatus></div><PrototypeKeyValues columns={1} compact items={incompatible ? [
        { label: "候选输出字段", value: "融资负责人参考.负责人显示名" }, { label: "T017 期望字段", value: "融资负责人参考.负责人名称" }, { label: "结果原因", value: "候选缺少既有来源映射要求的负责人名称字段" }, { label: "T018", value: "未形成" }, { label: "T019", value: "未采用候选" }, { label: "当前服务", value: `${pePreviousTrustedLabel(scenario)} 继续服务` },
      ] : [
        { label: "对象 / 关系", value: "4 类对象 · 3 类关系 · 端点通过" }, { label: "T018", value: `已形成 · 消费候选 ${scenario.t008}` }, { label: "T019", value: "权威消费绑定已采用" }, { label: "索引状态", value: "可消费准备完成" },
      ]} /></div>
    </div>
    <div className="p-inline-actions"><PrototypeButton icon="Route" onClick={() => onNavigate("lineage", { centerId: scenario.assetVersion, scenarioKey: scenario.key, lineageMode: "candidate", resolvedReady })}>打开完整沿袭</PrototypeButton>{incompatible ? <PrototypeButton variant="danger" icon="Wrench" onClick={onRetry}>查看恢复方式</PrototypeButton> : null}</div>
  </div>;
}

const PE_PLANNED_ASSETS = [
  { name: "SAP 融资数据", icon: "Building2", scope: "未来可接入合同、借款、还款及核算相关数据；一期没有 SAP 真实连接器。" },
  { name: "司库融资数据", icon: "Landmark", scope: "未来可接入授信、融资交易与资金头寸；一期没有司库真实连接器。" },
  { name: "企业数据中台主题数据", icon: "Network", scope: "未来可接入经治理的企业主数据和融资主题数据；一期没有数据中台真实连接器。" },
];

function PrototypeAssetsScreen({ scenario, scenarioKey, flowState = {}, onNavigate = () => {}, onToast = () => {} }) {
  const activeScenario = peScenario(scenario, scenarioKey);
  const [query, setQuery] = useEvidenceState("");
  const [status, setStatus] = useEvidenceState("全部状态");
  const availableVersions = peAvailableAssetVersions(activeScenario, flowState);
  const visibleVersion = peLatestVersion(activeScenario, flowState);
  const consumption = activeScenario.key === "D" && visibleVersion.id === PE_R3_ID ? "刷新失败" : "消费就绪";
  const realVisible = (!query || "融资标准化数据资产".includes(query)) && (status === "全部状态" || status === consumption);
  return <main className="screen-page" data-screen-label="D7 数据资产目录">
    <PrototypeEvidenceStyles />
    <PrototypePageHeader kicker="D7 · 数据资产目录" title="数据资产" description="已接入区只展示真实发布的 T006/T007；规划区只说明未来可接入内容，不伪装连接、同步或可消费状态。" meta={<><span>真实资产 <strong>1</strong></span><span>规划说明 <strong>3</strong></span></>} />
    <section className="p-section">
      <PrototypeSectionHeader title="已接入数据资产" count={realVisible ? 1 : 0} description="一期资产可查看、追溯和恢复刷新，但不能作为新的管道数据源回读。" />
      <div className="pe-filter-bar"><div className="pe-filter-group"><PrototypeSearch value={query} onChange={setQuery} placeholder="搜索真实资产" /><PrototypeSelect value={status} onChange={setStatus} options={["全部状态", "消费就绪", "刷新失败"]} /></div><span className="pe-filter-summary">仅检索已真实接入资产</span></div>
      {realVisible ? <div className="p-section-body"><button type="button" className="pe-asset-card real" style={{width:"100%"}} onClick={() => onNavigate("asset-detail", { versionId: visibleVersion.id, scenarioKey: activeScenario.key })}>
        <div className="pe-asset-card-head"><div className="pe-asset-title"><span className="pe-asset-icon"><PrototypeIcon name="Package" size={18} /></span><span><strong>融资标准化数据资产</strong><small>T006 · 一个版本包，内部含四成员与三关系</small></span></div><PrototypeStatus tone={peTone(consumption)}>{consumption}</PrototypeStatus></div>
        <p className="pe-asset-description">由真实融资工作簿经过预置 Python 标准化和正式质量门形成。不是一张万能表，也不是四个彼此独立的资产。</p>
        <div className="pe-member-strip">{PROTOTYPE_MEMBERS.map((member) => <div className="pe-member-card" key={member.key}><strong>{member.name}</strong><span>{member.rows.toLocaleString("zh-CN")}</span><small>{member.grain}</small></div>)}</div>
        <div className="pe-asset-card-foot"><span>当前展示 <strong className="mono">{visibleVersion.id}</strong> · T008 {visibleVersion.t008}</span><span>正式质量 {visibleVersion.quality} <PrototypeIcon name="ChevronRight" size={13} /></span></div>
      </button></div> : <PrototypeEmpty icon="SearchX" title="没有符合条件的真实资产" description="请清除搜索或状态筛选；规划资产不会混入结果。" action={<PrototypeButton onClick={() => { setQuery(""); setStatus("全部状态"); onToast("资产筛选已清除", "success"); }}>清除筛选</PrototypeButton>} />}
    </section>
    <section className="p-section">
      <PrototypeSectionHeader title="后期规划资产" count={3} description="以下仅用于演示说明扩展位置；没有连接、同步、版本、质量、消费或绑定操作。" />
      <div className="p-section-body"><div className="pe-asset-grid">{PE_PLANNED_ASSETS.map((asset) => <article className="pe-asset-card planned" key={asset.name} aria-label={`${asset.name}，后期规划说明`}>
        <div className="pe-asset-card-head"><div className="pe-asset-title"><span className="pe-asset-icon"><PrototypeIcon name={asset.icon} size={18} /></span><span><strong>{asset.name}</strong><small>后期规划 · 一期未接入</small></span></div><PrototypeStatus tone="neutral" compact>规划说明</PrototypeStatus></div>
        <p className="pe-asset-description">{asset.scope}</p>
        <div className="pe-planning-note"><strong>一期边界</strong><br />无真实来源、无 T007、无质量结果、无可消费版本；本卡不响应点击。</div>
      </article>)}</div></div>
    </section>
  </main>;
}

function peMemberPreview(memberKey) {
  if (memberKey === "detail") return PROTOTYPE_PREVIEW_ROWS.map((row) => ({ a: row.debt, b: row.org, c: row.institution, d: row.balance }));
  if (memberKey === "subject") return [
    { a: "UNIT-553", b: "单位A", c: "境内新能源", d: "OWNER-001" }, { a: "UNIT-465", b: "单位B", c: "核能", d: "OWNER-009" }, { a: "UNIT-561", b: "单位C", c: "数字化", d: "OWNER-009" }, { a: "UNIT-127", b: "单位D", c: "核燃料", d: "OWNER-014" },
  ];
  if (memberKey === "institution") return [
    { a: "INST-001", b: "银行A", c: "银行", d: "—" }, { a: "INST-004", b: "银行D", c: "银行", d: "—" }, { a: "INST-011", b: "银行K", c: "银行", d: "—" }, { a: "INST-018", b: "非银机构R", c: "非银", d: "—" },
  ];
  return [
    { a: "OWNER-001", b: "融资负责人001", c: "—", d: "—" }, { a: "OWNER-009", b: "融资负责人009", c: "—", d: "—" }, { a: "OWNER-014", b: "融资负责人014", c: "—", d: "—" },
  ];
}

function PrototypeAssetDetailScreen({ scenario, scenarioKey, flowState = {}, versionId, assetVersionId, initialView = "overview", onNavigate = () => {}, onToast = () => {} }) {
  const activeScenario = peScenario(scenario, scenarioKey);
  const availableVersions = peAvailableAssetVersions(activeScenario, flowState);
  const desired = versionId || assetVersionId || availableVersions[0].id;
  const [selectedVersion, setSelectedVersion] = useEvidenceState(availableVersions.some((item) => item.id === desired) ? desired : availableVersions[0].id);
  const [view, setView] = useEvidenceState(initialView);
  const [memberKey, setMemberKey] = useEvidenceState("subject");
  const [fieldQuery, setFieldQuery] = useEvidenceState("");
  const [relationshipId, setRelationshipId] = useEvidenceState("REL-01");
  useEvidenceEffect(() => {
    setSelectedVersion(availableVersions.some((item) => item.id === desired) ? desired : availableVersions[0].id);
  }, [desired, activeScenario.key, flowState.refreshed, flowState.priorAReady, flowState.resolvedReady]);
  const version = availableVersions.find((item) => item.id === selectedVersion) || availableVersions[0];
  const member = PROTOTYPE_MEMBERS.find((item) => item.key === memberKey);
  const fields = PROTOTYPE_MEMBER_FIELDS[memberKey].filter((field) => !fieldQuery || field.join(" ").toLowerCase().includes(fieldQuery.toLowerCase()));
  const currentIncompatible = activeScenario.key === "D" && version.id === PE_R3_ID;
  const currentConsumption = currentIncompatible ? "已发布·刷新失败" : "消费就绪";
  const currentRun = currentIncompatible ? activeScenario.run : peRunIdForVersion(version);
  const lineageTarget = peLineageTargetForVersion(version, activeScenario, flowState);
  const resolvedReady = version.id === PE_R1_ID;

  return <main className="screen-page" data-screen-label="D8 数据资产详情">
    <PrototypeEvidenceStyles />
    <PrototypePageHeader
      kicker="D8 · T006 数据资产详情"
      title="融资标准化数据资产"
      description="一个不可变版本包包含四个成员和三条受检关系；任何视图切换都保持在同一精确 T007。"
      onBack={() => onNavigate("assets")}
      actions={<><PrototypeButton icon="History" onClick={() => onNavigate("run-detail", { runId: currentRun, scenarioKey: currentIncompatible ? "D" : version.id.includes("08.08") ? "B" : "A", resolvedReady })}>打开发布运行</PrototypeButton><PrototypeButton variant="primary" icon="Route" onClick={() => onNavigate("lineage", { centerId: version.id, ...lineageTarget, resolvedReady })}>打开数据沿袭</PrototypeButton></>}
      meta={<><span>T007 <strong className="mono">{version.id}</strong></span><span>T008 <strong>{version.t008}</strong></span><PrototypeStatus tone="success" compact>{version.versionStatus}</PrototypeStatus><PrototypeStatus tone="warning" compact>{version.quality}</PrototypeStatus><PrototypeStatus tone={peTone(currentConsumption)} compact>{currentConsumption}</PrototypeStatus></>}
    />
    <section className="p-section">
      <div className="p-section-body pe-asset-context">
        <PrototypeSelect label="精确资产版本" value={selectedVersion} onChange={(value) => { setSelectedVersion(value); onToast(`已切换到 ${value}`, "success"); }} options={availableVersions.map((item) => ({ value: item.id, label: `${item.label} · ${item.versionStatus}` }))} />
        <span className="pe-readonly-label"><PrototypeIcon name="LockKeyhole" size={13} />历史版本只读，切换不会修改权威消费绑定</span>
      </div>
    </section>
    <section className="pe-view-shell">
      <PrototypeTabs value={view} onChange={setView} items={[
        { value: "overview", label: "版本概览", icon: "LayoutList" },
        { value: "members", label: "成员与关系", icon: "Boxes" },
        { value: "provenance", label: "来源与追溯", icon: "GitBranch" },
        { value: "refresh", label: "刷新与消费", icon: "RefreshCw" },
      ]} />
      <div className="pe-view-body">
        {view === "overview" ? <PrototypeAssetOverview version={version} runId={currentRun} resolvedReady={resolvedReady} currentIncompatible={currentIncompatible} onNavigate={onNavigate} /> : null}
        {view === "members" ? <PrototypeAssetMembers version={version} member={member} memberKey={memberKey} setMemberKey={setMemberKey} fields={fields} fieldQuery={fieldQuery} setFieldQuery={setFieldQuery} relationshipId={relationshipId} setRelationshipId={setRelationshipId} /> : null}
        {view === "provenance" ? <PrototypeAssetProvenance version={version} runId={currentRun} scenarioKey={lineageTarget.scenarioKey} lineageMode={lineageTarget.lineageMode} onNavigate={onNavigate} /> : null}
        {view === "refresh" ? <PrototypeAssetRefresh version={version} scenario={activeScenario} incompatible={currentIncompatible} lineageTarget={lineageTarget} onNavigate={onNavigate} onToast={onToast} /> : null}
      </div>
    </section>
  </main>;
}

function PrototypeAssetOverview({ version, runId, resolvedReady, currentIncompatible, onNavigate }) {
  return <div className="pe-stack">
    <PrototypeAlert tone={currentIncompatible ? "failed" : "success"} title={currentIncompatible ? "资产发布成功不等于消费就绪" : "不可变资产版本已具备可信消费证据"}>
      {currentIncompatible ? "该 T007 的刷新结果不兼容，T019 未采用；2026-08-08 · r2 继续服务。" : "正式质量警告已经人工确认，刷新成功且 T019 已采用这一精确组合。"}
    </PrototypeAlert>
    <div className="pe-version-note"><strong>{version.id}</strong><p>{version.change}</p></div>
    <PrototypeMetricStrip items={[
      { label: "融资明细", value: "5,218", detail: "一行一笔融资借据", icon: "Rows3" },
      { label: "融资主体", value: "574", detail: "稳定单位编码", icon: "Building2" },
      { label: "金融机构 / 负责人", value: "24 / 24", detail: "两类参考成员", icon: "Landmark" },
      { label: "人民币融资余额", value: "2.161 万亿元", detail: "精确值 2,161,338,700,000", icon: "BadgeDollarSign" },
    ]} />
    <div className="pe-split">
      <section className="p-section"><PrototypeSectionHeader title="版本事实" /><div className="p-section-body"><PrototypeKeyValues columns={2} items={[
        { label: "发布时间", value: version.publishedAt }, { label: "T026 Owner", value: version.owner }, { label: "正式 T005", value: "融资固定检查集 v1.0 · 有警告已确认" }, { label: "版本状态", value: "不可变 · 不允许修改或覆盖" },
      ]} /></div></section>
      <section className="p-section"><PrototypeSectionHeader title="结构摘要" /><div className="p-section-body pe-compact-stack"><PrototypeKeyValues columns={2} items={[
        { label: "成员", value: "4 个" }, { label: "关系", value: "3 条" }, { label: "成员总行数", value: "5,840" }, { label: "关系端点", value: "全部匹配 · 0 未匹配" },
      ]} /><PrototypeButton size="sm" icon="History" onClick={() => onNavigate("run-detail", { runId, initialTab: "nodes", resolvedReady })}>查看正式质量证据</PrototypeButton></div></section>
    </div>
  </div>;
}

function PrototypeAssetMembers({ member, memberKey, setMemberKey, fields, fieldQuery, setFieldQuery, relationshipId, setRelationshipId }) {
  const preview = peMemberPreview(memberKey);
  const headers = memberKey === "detail" ? ["借据编号", "单位编码", "机构编码", "融资余额"] : memberKey === "subject" ? ["单位编码", "单位名称", "统一产业板块", "负责人标识"] : memberKey === "institution" ? ["机构编码", "机构名称", "机构类别", "—"] : ["负责人标识", "负责人名称", "—", "—"];
  const selectedRelationship = PROTOTYPE_RELATIONSHIPS.find((item) => item.id === relationshipId);
  return <div className="pe-stack">
    <PrototypeAlert title="四个成员共同构成一个 T007">参考成员用于稳定身份，融资明细保存事实；三条关系用受检主外键将它们连接，避免负责人和单位之间失去归属。</PrototypeAlert>
    <div className="pe-split-asset">
      <aside className="pe-member-nav" aria-label="资产成员">{PROTOTYPE_MEMBERS.map((item) => <button type="button" className={item.key === memberKey ? "active" : ""} key={item.key} onClick={() => { setMemberKey(item.key); setFieldQuery(""); }}><span><strong>{item.name}</strong><small>{item.grain} · 主键 {item.primaryKey}</small></span><b>{item.rows.toLocaleString("zh-CN")}</b></button>)}</aside>
      <div className="pe-stack">
        <div className="pe-member-meta"><PrototypeKeyValues columns={3} compact items={[
          { label: "当前成员", value: member.name }, { label: "粒度", value: member.grain }, { label: "行数 / 主键", value: `${member.rows.toLocaleString("zh-CN")} / ${member.primaryKey}` },
        ]} /></div>
        <section className="p-section"><PrototypeSectionHeader title="字段合同" count={fields.length} description="一期只读展示字段、类型和业务含义，不在资产详情编辑结构。" /><div className="p-section-body"><div className="pe-table-toolbar"><PrototypeSearch value={fieldQuery} onChange={setFieldQuery} placeholder="搜索字段名、类型或说明" /><span className="pe-readonly-label"><PrototypeIcon name="LockKeyhole" size={12} />字段合同随 T007 冻结</span></div><PrototypeTable columns={[
          { key: "name", label: "字段名", width: "150px", render: (row) => <strong>{row[0]}</strong> }, { key: "type", label: "类型", width: "90px", render: (row) => row[1] }, { key: "role", label: "键角色", width: "80px", render: (row) => row[2] }, { key: "description", label: "业务说明", render: (row) => row[3] },
        ]} rows={fields} /></div></section>
        <section className="p-section"><PrototypeSectionHeader title="有限数据预览" description="仅用于理解成员粒度；不提供导出或直接消费。" /><PrototypeTable columns={headers.map((label, index) => ({ key: ["a", "b", "c", "d"][index], label, align: memberKey === "detail" && index === 3 ? "right" : undefined }))} rows={preview} /></section>
      </div>
    </div>
    <section className="p-section"><PrototypeSectionHeader title="成员关系" count={3} description="关系属于当前同一资产版本，不是四个资产之间的外部拼接。" /><div className="p-section-body pe-split"><div className="pe-relationship-list">{PROTOTYPE_RELATIONSHIPS.map((relationship) => <button type="button" key={relationship.id} className={`pe-relationship ${relationshipId === relationship.id ? "active" : ""}`} onClick={() => setRelationshipId(relationship.id)}><strong>{relationship.id}</strong><code>{relationship.source} <span className="pe-arrow">→</span> {relationship.target}</code><PrototypeStatus tone="success" compact>{relationship.cardinality}</PrototypeStatus></button>)}</div><PrototypeAlert tone="success" title={`${selectedRelationship.id} · 端点检查通过`}>来源字段 <span className="pe-code">{selectedRelationship.source}</span> 指向 <span className="pe-code">{selectedRelationship.target}</span>；未匹配端点 0，关系基数为{selectedRelationship.cardinality}。</PrototypeAlert></div></section>
  </div>;
}

function PrototypeAssetProvenance({ version, runId, scenarioKey, lineageMode, onNavigate }) {
  const isR3 = version.id === PE_R3_ID;
  const isR2 = version.id === PE_R2_ID;
  const isR0 = version.id.includes("06.30");
  const resolvedReady = version.id.includes("07.31");
  const snapshot = isR3 ? "SNAP-FIN-20260808-004" : isR2 ? "SNAP-FIN-20260808-002" : isR0 ? "SNAP-FIN-20260630-001" : "SNAP-FIN-20260731-001";
  const fingerprint = isR3 ? prototypeSnapshotFixture("D").fingerprint : isR2 ? prototypeSnapshotFixture("B").fingerprint : isR0 ? "5a82…91be" : prototypeSnapshotFixture("A").fingerprint;
  const items = [
    { icon: "FolderInput", title: "T001 · 融资工作簿手工上传", detail: "SRC-FIN-UPLOAD-001 · 真实文件来源", action: "打开来源", screen: "source-manual", payload: {} },
    { icon: "FileSpreadsheet", title: `T002 · ${snapshot}`, detail: `内容指纹 ${fingerprint} · T008 从用户确认获得`, action: "打开快照", screen: "source-manual", payload: { snapshotId: snapshot } },
    { icon: "Workflow", title: "T003 · PIPE-FIN-STD-v1.0 · 保存版本 13", detail: "合法五节点单链 · 本次锁定配置", action: "打开管道", screen: "canvas", payload: { runId, historical: true } },
    { icon: "SquareFunction", title: "T004 · 融资工作簿标准化 v1 · 1.0.0", detail: "预置脚本组件 · 无在线编辑或任意脚本上传", action: "查看运行", screen: "run-detail", payload: { runId, scenarioKey, resolvedReady } },
    { icon: "ShieldCheck", title: "T005 · 融资固定检查集 v1.0", detail: "8 项正式检查 · 质量警告已人工确认", action: "查看质量", screen: "run-detail", payload: { runId, scenarioKey, initialTab: "nodes", resolvedReady } },
    { icon: "PackageCheck", title: `T007 · ${version.id}`, detail: `不可变资产版本 · T008 ${version.t008}`, action: "当前版本", screen: "asset-detail", payload: { versionId: version.id } },
  ];
  return <div className="pe-stack"><PrototypeAlert title="追溯链由真实版本证据自动形成">T008 是业务数据截至时间，不等于文件读取时间或资产发布时间；每个资源都锁定到精确版本。</PrototypeAlert><div className="pe-provenance">{items.map((item) => <div className="pe-provenance-item" key={item.title}><span className="pe-provenance-icon"><PrototypeIcon name={item.icon} size={14} /></span><div className="pe-provenance-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><PrototypeButton size="sm" variant="ghost" icon="ExternalLink" onClick={() => onNavigate(item.screen, item.payload)}>{item.action}</PrototypeButton></div>)}</div><PrototypeButton variant="primary" icon="Route" onClick={() => onNavigate("lineage", { centerId: version.id, scenarioKey, lineageMode, resolvedReady })}>在只读画布查看完整上下游</PrototypeButton></div>;
}

function PrototypeAssetRefresh({ version, scenario, incompatible, lineageTarget, onNavigate, onToast }) {
  const requestId = incompatible ? "REFRESH-FIN-20260809-004" : version.id.includes("08.08") ? "REFRESH-FIN-20260809-002" : version.id.includes("06.30") ? "REFRESH-FIN-20260702-000" : PE_A_REFRESH_ID;
  const resolvedReady = version.id.includes("07.31");
  const [recoveryOpen, setRecoveryOpen] = useEvidenceState(false);
  return <div className="pe-stack">
    <PrototypeAlert tone={incompatible ? "failed" : "success"} title={incompatible ? "候选未被 T019 采用，上一可信版本继续服务" : "刷新成功且权威消费绑定已正式采用"}>
      {incompatible ? "资产本身仍是不可变发布事实，但不兼容结果阻止它进入权威消费。" : "请求已发出、刷新成功、T018 形成和 T019 采用是四段不同证据，缺一不可称为消费就绪。"}
    </PrototypeAlert>
    <div className="pe-contract-explain">
      <div className="pe-contract-card"><strong>T017 · 请求目标</strong><p>数据工程请求的既有目标：融资演示本体 · Published v1.0.0，其中引用融资标准化来源映射 v1。</p></div>
      <div className="pe-contract-card"><strong>T018 · 可消费候选</strong><p>本体刷新成功后形成的候选语义版本；它尚不自动等于消费者正在使用的正式版本。若 T018 已形成但 T019 尚未采用，闭环状态必须显示“已发布·刷新成功·待权威采用”。</p></div>
      <div className="pe-contract-card"><strong>T019 · 权威消费绑定</strong><p>由本体管理 Owner 原子提交，决定消费者正式采用哪组 Published 语义版本和 T018；数据工程只能读取结果。</p></div>
    </div>
    <div className="pe-refresh-flow">
      <section className="pe-refresh-card success"><div className="pe-refresh-card-head"><strong>刷新请求</strong><PrototypeStatus tone="success" compact>已受理</PrototypeStatus></div><PrototypeKeyValues columns={1} compact items={[
        { label: "请求标识", value: requestId, mono: true }, { label: "精确 T007", value: version.id, mono: true }, { label: "T008 / 正式质量", value: `${version.t008} · ${version.quality}` }, { label: "目标精确 T017", value: "融资演示本体 · Published v1.0.0" }, { label: "来源映射", value: "融资标准化来源映射 v1" }, { label: "队列 / 重试来源", value: "队列位置 1 · 原始请求" },
      ]} /></section>
      <div className="pe-refresh-arrow"><PrototypeIcon name="ArrowRight" size={19} /></div>
      <section className={`pe-refresh-card ${incompatible ? "failed" : "success"}`}><div className="pe-refresh-card-head"><strong>刷新结果</strong><PrototypeStatus tone={incompatible ? "failed" : "success"} compact>{incompatible ? "不兼容" : "成功"}</PrototypeStatus></div><PrototypeKeyValues columns={1} compact items={incompatible ? [
        { label: "候选输出字段", value: "融资负责人参考.负责人显示名" }, { label: "T017 期望字段", value: "融资负责人参考.负责人名称" }, { label: "返回原因", value: "候选缺少既有来源映射要求的负责人名称字段" }, { label: "四类对象 / 三关系", value: "未进入可消费准备" }, { label: "主键 / 端点", value: "资产侧通过 · 外部映射不兼容" }, { label: "T018", value: "未形成" }, { label: "T019", value: "未采用候选" }, { label: "上一可信", value: "ASSET-FINANCE@2026.08.08-r2 继续服务" },
      ] : [
        { label: "对象数量", value: "融资主体 574 · 融资明细 5,218 · 机构 24 · 负责人 24" }, { label: "关系数量", value: "3 类 · 11,010 条关系实例" }, { label: "主键 / 端点", value: "全部通过 · 0 未匹配" }, { label: "索引", value: "可消费准备完成" }, { label: "T018", value: `融资演示本体消费候选 · ${version.t008}` }, { label: "T019", value: "已采用这一精确组合" },
      ]} /></section>
    </div>
    <div className="p-inline-actions"><PrototypeButton icon="Route" onClick={() => onNavigate("lineage", { centerId: version.id, ...lineageTarget, resolvedReady })}>核对完整沿袭</PrototypeButton><PrototypeButton icon="History" onClick={() => onNavigate("run-detail", { runId: incompatible ? scenario.run : peRunIdForVersion(version), scenarioKey: incompatible ? "D" : lineageTarget.scenarioKey, resolvedReady })}>打开请求所在运行</PrototypeButton>{incompatible ? <PrototypeButton variant="danger" icon="Wrench" onClick={() => setRecoveryOpen(true)}>查看恢复方式</PrototypeButton> : <PrototypeButton variant="ghost" icon="RefreshCw" onClick={() => onToast(`已核对 ${requestId}：结果成功且权威证据完整`, "success")}>核对原请求</PrototypeButton>}</div>
    <PrototypeModal open={recoveryOpen} onClose={() => setRecoveryOpen(false)} title="不兼容结果的恢复方式" icon="Wrench" footer={<><PrototypeButton onClick={() => setRecoveryOpen(false)}>关闭</PrototypeButton><PrototypeButton variant="primary" onClick={() => { setRecoveryOpen(false); onNavigate("canvas", { selectedNode: "publish", recoveryFrom: requestId }); }}>返回发布节点修正</PrototypeButton></>}>
      <div className="pe-stack"><PrototypeAlert tone="failed" title="不对同一不兼容结构盲目重试">同一 T007 是不可变事实，重复发送不会修正字段合同。真正恢复需修正候选结构并形成新的 T003、运行和 T007；本评审夹具只演示失败复验，不扩写新的成功版本。</PrototypeAlert><PrototypeKeyValues columns={1} items={[
        { label: "候选输出字段", value: "融资负责人参考.负责人显示名" }, { label: "T017 期望字段", value: "融资负责人参考.负责人名称" }, { label: "目标", value: "融资演示本体 · Published v1.0.0" }, { label: "当前服务保护", value: "T019 仍采用 2026-08-08 · r2；消费者不中断" },
      ]} /></div>
    </PrototypeModal>
  </div>;
}

function peLineageModel(scenario, mode, expanded, journeyReady = false, runOverride = "") {
  const trusted = mode === "trusted";
  const trustedIsR0 = trusted && scenario.key === "A";
  const trustedIsR2 = trusted && scenario.key === "D";
  const effective = trusted ? (trustedIsR2 ? PROTOTYPE_SCENARIOS.B : PROTOTYPE_SCENARIOS.A) : scenario;
  const fullSuccess = trusted || effective.key === "B" || (effective.key === "A" && journeyReady);
  const qualityConfirmed = fullSuccess || effective.key === "D";
  const incompatible = !trusted && effective.key === "D";
  const blocked = !trusted && (effective.key === "C" || (effective.key === "A" && !journeyReady));
  const asset = trustedIsR0 ? PE_R0_VERSION.id : effective.assetVersion;
  const versionFixture = PE_LINEAGE_VERSION_FIXTURES[asset];
  const t008 = versionFixture ? versionFixture.t008 : trustedIsR0 ? "2026-06-30" : effective.t008;
  const snapshot = versionFixture ? versionFixture.snapshot : trustedIsR0 ? "SNAP-FIN-20260630-001" : effective.snapshot;
  const run = !trusted && runOverride ? runOverride : versionFixture ? versionFixture.run : trustedIsR0 ? PE_R0_VERSION.run : effective.key === "A" ? PE_A_RUN_ID : effective.run;
  const retryFixture = Object.values(PROTOTYPE_RETRY_RUN_FIXTURES).find((item) => item.id === run) || null;
  const refresh = versionFixture ? versionFixture.refresh : trustedIsR0 ? "REFRESH-FIN-20260702-000" : effective.key === "A" ? PE_A_REFRESH_ID : effective.refresh;
  const timeline = {
    R0: { source:"2026-07-02 09:14", snapshot:"2026-07-02 09:16", run:"2026-07-02 09:16", step:"2026-07-02 09:17", asset:"2026-07-02 09:18", request:"2026-07-02 09:18", result:"2026-07-02 09:19", consumption:"2026-07-02 09:19" },
    A: { source:"2026-08-09 09:58", snapshot:"2026-08-09 10:00", run:"2026-08-09 10:00", step:"2026-08-09 10:01", asset:"2026-08-09 10:02", request:"2026-08-09 10:02", result:"2026-08-09 10:05", consumption:"2026-08-09 10:05" },
    B: { source:"2026-08-09 10:04", snapshot:"2026-08-09 10:06", run:"2026-08-09 10:06", step:"2026-08-09 10:07", asset:"2026-08-09 10:08", request:"2026-08-09 10:08", result:"2026-08-09 10:10", consumption:"2026-08-09 10:10" },
    C: { source:"2026-08-09 10:10", snapshot:"2026-08-09 10:12", run:"2026-08-09 10:12", step:"2026-08-09 10:12", asset:"未形成", request:"未形成", result:"未形成", consumption:"上一可信继续服务" },
    D: { source:"2026-08-09 10:18", snapshot:"2026-08-09 10:20", run:"2026-08-09 10:20", step:"2026-08-09 10:21", asset:"2026-08-09 10:22", request:"2026-08-09 10:22", result:"2026-08-09 10:24", consumption:"T019 未采用" },
  }[trustedIsR0 ? "R0" : effective.key];
  const nodes = [];
  const edgePairs = [];
  const add = (node) => nodes.push(node);
  const connect = (from, to, label = "形成") => edgePairs.push({ id: `${from}-${to}`, from, to, label, tone: incompatible && from === "request" ? "failed" : trusted ? "trusted" : "" });
  const baseY = 218;
  const source = prototypeScenarioSource(effective.key);
  add({ id:"source", kind:"T001 数据源", label:source.name, resource:source.id, x:48, y:baseY, tone:"success", status:source.id === "SRC-FIN-FOLDER-001" ? "暂停 · 手工检查" : "可用", t008, time:timeline.source, conclusion:"真实文件来源已登记，可追到工作簿与读取证据。", summary:`${source.name} · 绑定融资标准化管道`, recovery:"无需恢复。", target:source.target });
  add({ id:"snapshot", kind:"T002 原始快照", label:"原始工作簿快照", resource:snapshot, x:expanded?220:258, y:baseY, tone:"success", status:"已登记", t008, time:timeline.snapshot, conclusion:"原始文件按内容指纹登记，源文件保持不变。", summary:"融资一览表 · 全量快照 · 5,218 条", recovery:"若数据有误，登记修正后的新快照；不覆盖本快照。", target:source.target });
  connect("source","snapshot","发现并登记");
  if (!expanded) {
    add({ id:"run", kind:"管道运行", label:"融资标准化与发布", resource:run, x:468, y:baseY, tone:effective.key === "C" ? "failed" : blocked ? "warning" : "success", status:effective.key === "C" ? "质量失败" : blocked ? "等待确认" : "已结束", t008, time:retryFixture ? retryFixture.start : timeline.run, conclusion:effective.key === "C" ? "运行已执行到质量门，因旧板块名称硬阻断。" : blocked ? "运行在质量警告处等待人工确认。" : "四个运行步骤完成并保留精确版本证据。", summary:retryFixture ? `关联恢复运行 · 源自 ${retryFixture.parentRun}` : "T003 保存版本 13 · T004 v1.0.0 · T005 v1.0", recovery:effective.key === "C" ? "返回数据检查节点修正后创建关联重试。" : "打开运行详情核对节点证据。", target:"run-detail" });
    connect("snapshot","run","作为精确输入");
  } else {
    const steps = [
      { id:"step-source", kind:"运行步骤 1/4", label:"数据源", resource:snapshot, x:392, tone:"success", status:"执行成功", summary:"锁定 T002 与全量声明", target:"canvas" },
      { id:"step-python", kind:"运行步骤 2/4", label:"Python 处理", resource:"融资工作簿标准化 v1 · 1.0.0", x:564, tone:"success", status:"执行成功", summary:"输出四成员 · 5,840 行", target:"canvas" },
      { id:"quality", kind:"T005 · 运行步骤 3/4", label:"数据质量结果", resource:trustedIsR0 ? "DQ-FIN-20260702-000" : `DQ-FIN-20260809-${effective.key === "B" ? "002" : effective.key === "C" ? "003" : effective.key === "D" ? "004" : "001"}`, x:736, tone:effective.key === "C" ? "failed" : "warning", status:effective.key === "C" ? "失败" : qualityConfirmed ? "警告已确认" : "等待确认", summary:effective.key === "C" ? "8 项 · 1 失败 · 3 警告" : "8 项 · 5 通过 · 3 警告", target:"run-detail" },
      { id:"step-publish", kind:"运行步骤 4/4", label:"发布数据资产", resource:blocked ? "未形成 T007" : asset, x:908, tone:blocked ? "neutral" : "success", status:blocked ? "未执行" : "执行成功", summary:blocked ? "被质量门阻断" : "四成员 · 三关系 · 不可变", target:"canvas" },
    ];
    steps.forEach((step) => add({ ...step, y:baseY, t008, time:timeline.step, conclusion:step.summary, recovery:step.id === "quality" && effective.key === "C" ? "修正旧板块名称后创建关联重试。" : "打开对应证据页面继续核对。" }));
    connect("snapshot","step-source","作为精确输入"); connect("step-source","step-python","传递工作簿"); connect("step-python","quality","提交候选检查"); connect("quality","step-publish",blocked?"硬阻断":"门禁允许");
  }
  const lastRunId = expanded ? "step-publish" : "run";
  if (!blocked) {
    const startX = expanded ? 1080 : 678;
    add({ id:"asset", kind:"T007 资产版本", label:"融资标准化数据资产", resource:asset, x:startX, y:baseY, tone:"success", status:"不可变", t008, time:timeline.asset, conclusion:"发布形成一个含四成员、三关系的不可变资产版本。", summary:"5,218 明细 · 574 主体 · 24 机构 · 24 负责人", recovery:"资产版本不可修改；需要变化时发布新版本。", target:"asset-detail" });
    add({ id:"request", kind:"本体刷新请求", label:"请求刷新 Published v1.0.0", resource:refresh, x:startX+210, y:baseY, tone:"success", status:"已受理", t008, time:timeline.request, conclusion:"数据工程已将精确 T007/T008 请求发给既有 T017。", summary:"目标 T017 · 融资标准化来源映射 v1", recovery:"先核对原请求状态，不默认重复发送。", target:"asset-detail" });
    add({ id:"t017", kind:"请求侧既有输入", label:"融资演示本体", resource:"Published v1.0.0 · T017", x:startX+210, y:58, tone:"info", status:"精确目标", t008:"既有语义版本", time:"请求前已存在", conclusion:"T017 是刷新请求的既有目标，不是刷新产生的结果。", summary:"冻结/引用融资标准化来源映射 v1", recovery:"数据工程只读核对，不编辑本体内部资源。", target:"asset-detail" });
    add({ id:"result", kind:"本体刷新结果", label:incompatible?"结构合同不兼容":"刷新成功", resource:`RESULT-${refresh}`, x:startX+420, y:baseY, tone:incompatible?"failed":"success", status:incompatible?"不兼容":"成功", t008, time:timeline.result, conclusion:incompatible?"候选输出为“负责人显示名”，但 T017 既有来源映射要求“负责人名称”。":"对象、关系、主键、端点与索引准备成功。", summary:incompatible?"T018 未形成 · T019 未采用":"4 类对象 · 3 类关系 · 端点通过", impact:incompatible?`候选没有污染当前消费；${PE_R2_ID} 继续服务。`:"刷新成功仍需 T019 采用证据才能消费就绪。", recovery:incompatible?"返回发布节点核对结构；本夹具复验仍不兼容，不形成新的成功版本。":"无需恢复。", target:"asset-detail" });
    connect(lastRunId,"asset","发布形成"); connect("asset","request","创建刷新请求"); connect("t017","request","作为精确目标"); connect("request","result",incompatible?"返回不兼容":"返回成功");
    if (fullSuccess) {
      add({ id:"consumption", kind:"T018 / T019 证据", label:"权威消费组合", resource:`消费候选 ${t008} · T019 已采用`, x:startX+630, y:baseY, tone:"success", status:"消费就绪", t008, time:timeline.consumption, conclusion:"T018 已形成，且权威消费绑定 T019 已采用精确组合。", summary:"Published v1.0.0 + T018 · 当前正式服务", recovery:"无需恢复；消费者只读该权威绑定。", target:"asset-detail" });
      connect("result","consumption","权威采用");
    }
  }
  return { nodes, edges:edgePairs, width: expanded ? 1880 : 1600, t008, blocked, incompatible, trusted, run, asset, snapshot, refresh, scenarioKey: trustedIsR0 ? "A" : effective.key };
}

function PrototypeLineageScreen({ scenario, scenarioKey, flowState = {}, centerId, lineageMode, onNavigate = () => {}, onToast = () => {} }) {
  const activeScenario = peScenario(scenario, scenarioKey);
  const journeyReady = activeScenario.key === "A" && peAReady(flowState);
  const inferredMode = lineageMode || (centerId === pePreviousTrustedVersion(activeScenario) ? "trusted" : "candidate");
  const [mode, setMode] = useEvidenceState(inferredMode);
  const [expanded, setExpanded] = useEvidenceState(false);
  const [query, setQuery] = useEvidenceState("");
  const [zoom, setZoom] = useEvidenceState(.58);
  const [pan, setPan] = useEvidenceState({ x: 20, y: 48 });
  const [positions, setPositions] = useEvidenceState({});
  const [selectedId, setSelectedId] = useEvidenceState("");
  const [selectedEdge, setSelectedEdge] = useEvidenceState("");
  const [drag, setDrag] = useEvidenceState(null);
  const [panDrag, setPanDrag] = useEvidenceState(null);
  const canvasRef = useEvidenceRef(null);
  const retryRunFinished = activeScenario.key === "D"
    ? flowState.canvasRunState === "refresh-failed"
    : activeScenario.key === "C" && flowState.canvasRunState === "hard-failed";
  const retryRunOverride = flowState.retryRunCreated
    && flowState.retryRunScenario === activeScenario.key
    && retryRunFinished
    ? flowState.retryRunId
    : "";
  const model = useEvidenceMemo(() => peLineageModel(activeScenario, mode, expanded, journeyReady, retryRunOverride), [activeScenario.key, mode, expanded, journeyReady, retryRunOverride]);
  const modelResolvedReady = model.asset === PE_R1_ID && !model.blocked;
  useEvidenceEffect(() => { setMode(lineageMode || (centerId === pePreviousTrustedVersion(activeScenario) ? "trusted" : "candidate")); }, [lineageMode, centerId, activeScenario.key]);
  useEvidenceEffect(() => { setPositions({}); setSelectedId(centerId && model.nodes.some((node) => node.resource === centerId || node.id === centerId) ? (model.nodes.find((node) => node.resource === centerId || node.id === centerId) || {}).id : model.nodes.some((node) => node.id === "asset") ? "asset" : expanded && model.nodes.some((node) => node.id === "quality") ? "quality" : "run"); setSelectedEdge(""); }, [model, centerId]);
  useEvidenceEffect(() => { const onKey = (event) => { if (event.key === "Escape") { setSelectedId(""); setSelectedEdge(""); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  const nodePos = (node) => positions[node.id] || { x:node.x, y:node.y };
  const selected = model.nodes.find((node) => node.id === selectedId);
  const searchHits = model.nodes.filter((node) => query && `${node.label} ${node.resource} ${node.kind}`.toLowerCase().includes(query.toLowerCase())).map((node) => node.id);
  const selectedIndex = model.nodes.findIndex((node) => node.id === selectedId);
  const fit = () => {
    const width = canvasRef.current ? canvasRef.current.clientWidth - (selected ? 350 : 20) : 1100;
    const scale = Math.max(.5, Math.min(1, (width - 40) / model.width));
    setZoom(Number(scale.toFixed(2))); setPan({x:22,y:Math.max(28,(canvasRef.current ? canvasRef.current.clientHeight : 600)/2-baseLineY(model)*scale)}); onToast("已适应当前链路并保留选中节点", "success");
  };
  function baseLineY() { return 255; }
  const reset = () => { setZoom(.58); setPan({x:20,y:48}); setPositions({}); setSelectedEdge(""); onToast("视图已复位，真实依赖关系未改变", "success"); };
  const startNodeDrag = (event, node) => { event.stopPropagation(); const pos=nodePos(node); setDrag({id:node.id,startX:event.clientX,startY:event.clientY,x:pos.x,y:pos.y}); event.currentTarget.setPointerCapture(event.pointerId); };
  const movePointer = (event) => {
    if (drag) setPositions((current) => ({...current,[drag.id]:{x:drag.x+(event.clientX-drag.startX)/zoom,y:drag.y+(event.clientY-drag.startY)/zoom}}));
    if (panDrag) setPan({x:panDrag.x+event.clientX-panDrag.startX,y:panDrag.y+event.clientY-panDrag.startY});
  };
  const endPointer = () => { setDrag(null); setPanDrag(null); };
  const startPan = (event) => {
    if (event.button !== 0 || (event.target.closest && event.target.closest(".pe-lineage-node")) || (event.target.matches && event.target.matches(".pe-lineage-line"))) return;
    setPanDrag({startX:event.clientX,startY:event.clientY,x:pan.x,y:pan.y});
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  };
  const edgePath = (edge) => { const from=model.nodes.find((node)=>node.id===edge.from); const to=model.nodes.find((node)=>node.id===edge.to); if(!from||!to)return""; const a=nodePos(from),b=nodePos(to); const x1=a.x+158,y1=a.y+38,x2=b.x,y2=b.y+38; const mid=(x1+x2)/2; return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`; };
  const edgeActive = (edge) => selectedEdge===edge.id || (selectedId && (edge.from===selectedId || edge.to===selectedId)) || (searchHits.includes(edge.from) || searchHits.includes(edge.to));

  return <main className="screen-page flush" data-screen-label="D9 数据沿袭">
    <PrototypeEvidenceStyles />
    <div className="pe-lineage-page">
      <header className="pe-lineage-header"><div className="pe-lineage-title"><PrototypeIconButton icon="ArrowLeft" label="返回数据资产" onClick={() => onNavigate("assets")} /><div><h1>数据沿袭</h1><p>自动生成的只读版本链：来源 → 快照 → 运行 → 资产 → 刷新请求 → 刷新结果 → 权威消费证据</p></div></div><div className="pe-lineage-actions"><PrototypeStatus tone="info" icon="LockKeyhole">只读证据画布</PrototypeStatus><PrototypeButton icon="Workflow" onClick={() => onNavigate("canvas", { runId: model.run, historical: true, resolvedReady: modelResolvedReady })}>返回管道</PrototypeButton><PrototypeButton icon="History" onClick={() => onNavigate("run-detail", { runId: model.run, scenarioKey: model.scenarioKey, resolvedReady: modelResolvedReady })}>查看运行</PrototypeButton></div></header>
      <div className="pe-lineage-toolbar"><div className="pe-lineage-toolbar-left"><div className="pe-segmented" role="tablist" aria-label="沿袭链路对照"><button type="button" role="tab" aria-selected={mode==="candidate"} className={mode==="candidate"?"active":""} onClick={()=>setMode("candidate")}><PrototypeIcon name="GitCompareArrows" size={13}/>当前候选链路</button><button type="button" role="tab" aria-selected={mode==="trusted"} className={mode==="trusted"?"active":""} onClick={()=>setMode("trusted")}><PrototypeIcon name="CircleCheck" size={13}/>上一可信链路</button></div><PrototypeSearch value={query} onChange={(value)=>{setQuery(value);if(value){const hit=model.nodes.find((node)=>`${node.label} ${node.resource} ${node.kind}`.toLowerCase().includes(value.toLowerCase()));if(hit)setSelectedId(hit.id);}}} placeholder="搜索名称、版本或标识" ariaLabel="搜索沿袭节点"/><span className="pe-filter-summary">{query ? `命中 ${searchHits.length} 个真实节点` : `T008 ${model.t008}`}</span></div><div className="pe-lineage-toolbar-right"><PrototypeButton size="sm" icon={expanded?"Minimize2":"Maximize2"} onClick={()=>{const next=!expanded;setExpanded(next);setZoom(next ? .5 : .58);setPan({x:20,y:48});}}>{expanded?"收起运行":"展开运行"}</PrototypeButton><PrototypeButton size="sm" icon="WandSparkles" onClick={()=>{setPositions({});onToast("已恢复默认横向排列", "success");}}>自动排列</PrototypeButton><PrototypeIconButton icon="ZoomOut" label="缩小" onClick={()=>setZoom(Math.max(.5,Number((zoom-.1).toFixed(2))))}/><span className="pe-zoom-readout">{Math.round(zoom*100)}%</span><PrototypeIconButton icon="ZoomIn" label="放大" onClick={()=>setZoom(Math.min(1.35,Number((zoom+.1).toFixed(2))))}/><PrototypeIconButton icon="Scan" label="适应窗口" onClick={fit}/><PrototypeIconButton icon="RotateCcw" label="复位视图" onClick={reset}/></div></div>
      <div className="pe-lineage-workspace">
        <div ref={canvasRef} className={`pe-lineage-canvas ${panDrag?"panning":""}`} onPointerDown={startPan} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer} onWheel={(event)=>{event.preventDefault();setZoom((value)=>Math.max(.5,Math.min(1.35,Number((value + (event.deltaY < 0 ? .06 : -.06)).toFixed(2)))));}}>
          <div className="pe-lineage-stage" style={{transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}}>
            <svg className="pe-lineage-lines" aria-label="沿袭关系连线"><defs><marker id="pe-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L7,3 z" fill="#8f9eab"/></marker></defs>{model.edges.map((edge)=><path key={edge.id} d={edgePath(edge)} className={`pe-lineage-line ${edge.tone||""} ${edgeActive(edge)?"active":""}`} role="button" tabIndex="0" aria-label={`${edge.label}：${edge.from} 到 ${edge.to}`} onClick={(event)=>{event.stopPropagation();setSelectedEdge(edge.id);setSelectedId("");}} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedEdge(edge.id);setSelectedId("");}}}/>)}</svg>
            {model.nodes.map((node)=>{const pos=nodePos(node);return <button type="button" key={node.id} className={`pe-lineage-node ${node.tone} ${selectedId===node.id?"selected":""} ${searchHits.includes(node.id)?"search-hit":""}`} style={{left:pos.x,top:pos.y}} onPointerDown={(event)=>startNodeDrag(event,node)} onClick={(event)=>{event.stopPropagation();setSelectedId(node.id);setSelectedEdge("");}}><span className="pe-lineage-node-head"><span className="pe-lineage-node-kind">{node.kind}</span><PrototypeIcon name={node.tone==="failed"?"CircleX":node.tone==="warning"?"TriangleAlert":node.tone==="info"?"Info":"CircleCheck"} size={12}/></span><strong className="pe-lineage-node-title">{node.label}</strong><span className="pe-lineage-node-id mono">{node.resource}</span><PrototypeStatus tone={node.tone} compact>{node.status}</PrototypeStatus></button>})}
          </div>
          {selectedEdge ? <div className="pe-edge-info"><PrototypeIcon name="Link2" size={13}/><strong>{(model.edges.find((edge)=>edge.id===selectedEdge)||{}).label}</strong><span>这是由精确资源版本形成的真实关系；高亮只改变视图，不改变依赖。</span><PrototypeIconButton icon="X" size={12} label="关闭关系说明" onClick={()=>setSelectedEdge("")}/></div> : null}
          <div className="pe-lineage-legend"><strong>状态</strong>{[["success","成功 / 可信"],["info","运行中 / 既有输入"],["warning","警告 / 等待"],["failed","失败 / 不兼容"],["","未执行 / 未知"]].map(([tone,label])=><span className="pe-legend-item" key={label}><i className={`pe-legend-dot ${tone}`}></i>{label}</span>)}</div>
        </div>
        {selected ? <PrototypeLineageDrawer node={selected} scenario={activeScenario} model={model} mode={mode} onClose={()=>setSelectedId("")} onNavigate={onNavigate}/> : null}
      </div>
    </div>
  </main>;
}

function PrototypeLineageDrawer({ node, scenario, model, mode, onClose, onNavigate }) {
  const isQuality=node.id==="quality" || node.kind.includes("T005");
  const isRequest=node.id==="request";
  const isResult=node.id==="result";
  const qualityFailed = !model.trusted && scenario.key === "C";
  const exactAsset = node.resource && node.resource.startsWith("ASSET-") ? node.resource : model.asset;
  const lineageScenarioKey = model.scenarioKey;
  const resolvedReady = model.asset === PE_R1_ID && !model.blocked;
  const guaranteeMissing = [PE_R2_ID, PE_R3_ID].includes(model.asset) ? "1,867" : "1,868";
  const navPayload = node.target==="run-detail" ? {runId:model.run,scenarioKey:lineageScenarioKey,initialTab:isQuality?"nodes":"summary",resolvedReady} : node.target==="asset-detail" ? {versionId:exactAsset,scenarioKey:lineageScenarioKey,initialView:isRequest||isResult?"refresh":"overview",resolvedReady} : node.target==="canvas" ? {runId:model.run,historical:true,selectedNode:isQuality?"quality":node.id.replace("step-",""),resolvedReady} : {snapshotId:model.snapshot};
  return <aside className="pe-lineage-drawer" aria-label={`${node.label}连续详情`}><header className="pe-drawer-head"><div className="pe-drawer-title"><span>{node.kind}</span><h2>{node.label}</h2></div><PrototypeIconButton icon="PanelRightClose" label="关闭详情抽屉" onClick={onClose}/></header><div className="pe-drawer-body">
    <section className="pe-drawer-section"><h3>业务结论</h3><PrototypeStatus tone={node.tone}>{node.status}</PrototypeStatus><p style={{marginTop:7}}>{node.conclusion}</p></section>
    <section className="pe-drawer-section"><h3>精确资源与时间</h3><PrototypeKeyValues columns={1} compact items={[{label:"资源 / 版本",value:node.resource,mono:true},{label:"T008",value:node.t008},{label:"证据时间",value:node.time}]} /></section>
    <section className="pe-drawer-section"><h3>{isRequest?"请求输入与目标":isResult?"返回结果摘要":"输入输出 / 成员摘要"}</h3><p>{node.summary}</p></section>
    {isQuality ? <section className="pe-drawer-section"><h3>正式质量证据</h3><PrototypeKeyValues columns={1} compact items={[
      {label:"检查集版本",value:"融资固定检查集 v1.0"},{label:"检查总数",value:"8"},{label:"失败 / 警告",value:qualityFailed?"1 / 3":"0 / 3"},{label:"有限失败样例",value:qualityFailed?"UNIT-553 · 新能源控股":`无硬失败；可选字段缺失 212 / 212 / ${guaranteeMissing}`},
    ]}/></section> : null}
    {isRequest ? <section className="pe-drawer-section"><h3>请求侧证据</h3><PrototypeKeyValues columns={1} compact items={[
      {label:"队列位置",value:"1 · 已出队"},{label:"创建 / 发起",value:node.time},{label:"重试来源",value:"原始请求"},{label:"出队核对",value:`T007 ${model.asset} · T008 ${model.t008} · 无同时点替代`},{label:"精确 T017",value:"融资演示本体 · Published v1.0.0"},
    ]}/></section> : null}
    {isResult ? <section className="pe-drawer-section"><h3>影响与上一可信</h3><p>{node.impact||"结果已经形成可追溯证据。"}</p>{scenario.key==="D"&&mode==="candidate"?<PrototypeKeyValues columns={1} compact items={[{label:"候选输出字段",value:"融资负责人参考.负责人显示名"},{label:"T017 期望字段",value:"融资负责人参考.负责人名称"},{label:"T018 / T019",value:"未形成 / 未采用"},{label:"上一可信",value:"ASSET-FINANCE@2026.08.08-r2 · 继续服务"}]}/>:null}</section> : null}
    <section className="pe-drawer-section"><h3>恢复建议</h3><p>{node.recovery}</p></section>
    <section className="pe-drawer-section"><h3>证据定位与导航</h3><div className="pe-drawer-actions"><PrototypeButton size="sm" variant="primary" icon="ExternalLink" onClick={()=>onNavigate(node.target,navPayload)}>{node.target==="run-detail"?"查看运行":node.target==="asset-detail"?"查看资产":node.target==="canvas"?"返回管道":"查看来源"}</PrototypeButton><PrototypeButton size="sm" icon="History" onClick={()=>onNavigate("run-detail",{runId:model.run,scenarioKey:lineageScenarioKey,resolvedReady})}>完整运行证据</PrototypeButton></div></section>
  </div></aside>;
}

Object.assign(window, {
  PrototypeRunsScreen,
  PrototypeRunDetailScreen,
  PrototypeAssetsScreen,
  PrototypeAssetDetailScreen,
  PrototypeLineageScreen,
});
