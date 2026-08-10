const {
  useCallback: useCanvasCallback,
  useEffect: useCanvasEffect,
  useMemo: useCanvasMemo,
  useRef: useCanvasRef,
  useState: useCanvasState,
} = React;

const PROTOTYPE_CANVAS_CSS = `
  .pc-page{height:100%;display:grid;grid-template-rows:58px minmax(0,1fr);background:#e9eef2}.pc-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 11px 7px 13px;background:#fff;border-bottom:1px solid var(--line)}.pc-title{display:flex;align-items:center;gap:9px;min-width:0}.pc-title-copy{min-width:0}.pc-title-copy h1{margin:0;color:var(--ink);font-size:14px;font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-title-copy p{margin:3px 0 0;color:var(--muted);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-head-actions{display:flex;align-items:center;gap:6px}.pc-save-state{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:8px;white-space:nowrap}.pc-layout{min-width:0;min-height:0;display:grid;grid-template-columns:180px minmax(0,1fr);grid-template-rows:minmax(250px,1fr) var(--pc-bottom-height,286px);overflow:hidden}.pc-layout.drawer-open{grid-template-columns:180px minmax(0,1fr) 322px}.pc-library{grid-column:1;grid-row:1 / 3;min-height:0;display:flex;flex-direction:column;background:#f8fafb;border-right:1px solid var(--line)}.pc-library-head{padding:11px;border-bottom:1px solid var(--line)}.pc-library-head strong{display:block;font-size:10px}.pc-library-head span{display:block;margin-top:4px;color:var(--muted);font-size:8px;line-height:1.5}.pc-library-list{min-height:0;display:grid;align-content:start;gap:6px;padding:9px;overflow:auto}.pc-library-node{display:grid;grid-template-columns:27px minmax(0,1fr);gap:8px;padding:8px;color:var(--ink-2);background:#fff;border:1px solid var(--line);border-left:3px solid var(--node-color);border-radius:4px;text-align:left}.pc-library-node:hover{background:#f4f7fd;border-color:#9bb2df;border-left-color:var(--node-color)}.pc-library-node.used{background:#f2f4f6}.pc-library-icon{width:25px;height:25px;display:grid;place-items:center;color:var(--node-color);background:#f7f8fa;border:1px solid var(--line);border-radius:3px}.pc-library-copy strong,.pc-library-copy span,.pc-library-copy small{display:block}.pc-library-copy strong{font-size:9px}.pc-library-copy span{margin-top:3px;color:var(--muted);font-size:7px;line-height:1.4}.pc-library-copy small{margin-top:5px;color:var(--accent);font-size:7px}.pc-library-foot{margin-top:auto;padding:9px;color:var(--muted);background:#f2f5f7;border-top:1px solid var(--line);font-size:8px;line-height:1.55}.pc-canvas-shell{position:relative;grid-column:2;grid-row:1;min-width:0;min-height:0;overflow:hidden;background:#edf1f4}.pc-canvas{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none;background-color:#edf1f4;background-image:radial-gradient(#bec8d1 .7px,transparent .7px);background-size:18px 18px}.pc-canvas.panning{cursor:grabbing}.pc-stage{position:absolute;top:0;left:0;width:1280px;height:390px;transform-origin:0 0;will-change:transform}.pc-lines{position:absolute;inset:0;width:1280px;height:390px;pointer-events:none}.pc-line{fill:none;stroke:#8d9baa;stroke-width:1.6;marker-end:url(#pc-arrow)}.pc-line.active{stroke:var(--accent);stroke-width:2.4}.pc-node{position:absolute;width:174px;height:92px;padding:9px;color:var(--ink-2);background:#fff;border:1px solid #b9c4ce;border-top:3px solid var(--node-color);border-radius:4px;box-shadow:0 2px 6px rgba(24,41,56,.10);text-align:left;user-select:none;cursor:grab}.pc-node:hover{border-color:#7e9fd9;box-shadow:0 4px 11px rgba(31,53,79,.13)}.pc-node.selected{outline:2px solid var(--accent);outline-offset:2px}.pc-node.running{box-shadow:0 0 0 3px rgba(36,87,214,.14)}.pc-node.failed{border-color:#cc747b;border-top-color:var(--danger)}.pc-node.warning{border-color:#d5ad58;border-top-color:var(--warning)}.pc-node-head{display:flex;align-items:center;justify-content:space-between;gap:7px}.pc-node-kind{display:flex;align-items:center;gap:5px;min-width:0}.pc-node-kind span{width:20px;height:20px;display:grid;place-items:center;color:#fff;background:var(--node-color);border-radius:3px}.pc-node-kind strong{font-size:9px;white-space:nowrap}.pc-node-summary{display:block;margin-top:6px;color:var(--ink);font-size:9px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-node-detail{display:block;margin-top:3px;color:var(--muted);font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-node-status{margin-top:6px}.pc-empty-canvas{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:7px;color:var(--muted);pointer-events:none}.pc-empty-canvas strong{color:var(--ink-2);font-size:11px}.pc-empty-canvas span{font-size:8px}.pc-viewport{position:absolute;z-index:8;bottom:10px;left:10px;display:flex;align-items:center;gap:4px;padding:4px;background:rgba(255,255,255,.96);border:1px solid var(--line);box-shadow:0 2px 7px rgba(25,42,57,.09)}.pc-zoom{min-width:40px;color:var(--muted);font-size:8px;text-align:center}.pc-context{position:absolute;z-index:7;top:9px;left:10px;display:flex;align-items:center;gap:6px;padding:6px 8px;color:#51606e;background:rgba(255,255,255,.94);border:1px solid var(--line);font-size:8px}.pc-context strong{color:var(--ink-2)}.pc-drawer{grid-column:3;grid-row:1 / 3;min-width:0;min-height:0;display:flex;flex-direction:column;background:#fff;border-left:1px solid var(--line);box-shadow:-5px 0 13px rgba(27,43,57,.07)}.pc-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:11px;border-bottom:1px solid var(--line)}.pc-drawer-title{display:flex;align-items:flex-start;gap:8px;min-width:0}.pc-drawer-mark{width:27px;height:27px;display:grid;place-items:center;color:#fff;background:var(--node-color);border-radius:4px}.pc-drawer-title h2{margin:0;font-size:11px}.pc-drawer-title p{margin:3px 0 0;color:var(--muted);font-size:8px}.pc-drawer-body{min-height:0;flex:1;overflow:auto;padding:10px}.pc-drawer-section{margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}.pc-drawer-section:last-child{border-bottom:0}.pc-drawer-section h3{margin:0 0 8px;color:var(--ink);font-size:9px}.pc-drawer-section p{margin:0;color:var(--muted);font-size:8px;line-height:1.6}.pc-drawer-stack{display:grid;gap:8px}.pc-contract-list{display:grid;gap:5px}.pc-contract-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px;background:#f7f9fb;border:1px solid var(--line)}.pc-contract-row strong{font-size:8px}.pc-contract-row span{color:var(--muted);font-size:7px}.pc-script-card{padding:9px;background:#f5f8ff;border:1px solid #bfd0ef;border-left:3px solid #536ccf}.pc-script-card strong,.pc-script-card span,.pc-script-card small{display:block}.pc-script-card strong{font-size:10px}.pc-script-card span{margin-top:4px;color:var(--ink-2);font-size:8px}.pc-script-card small{margin-top:5px;color:var(--muted);font-size:7px;line-height:1.5}.pc-bottom{grid-column:2;grid-row:2;min-width:0;min-height:0;display:grid;grid-template-rows:38px minmax(0,1fr);background:#fff;border-top:1px solid var(--line)}.pc-bottom-head{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line)}.pc-bottom-head .p-tabs{min-width:0;flex:1;border-bottom:0}.pc-bottom-actions{display:flex;align-items:center;gap:4px;padding-right:7px}.pc-bottom-body{min-height:0;overflow:auto;padding:10px}.pc-bottom.collapsed{grid-template-rows:38px}.pc-bottom.collapsed .pc-bottom-body{display:none}.pc-evidence-context{display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:6px 8px;color:var(--muted);background:#f5f7f9;border:1px solid var(--line);font-size:7px;white-space:nowrap;overflow:auto}.pc-evidence-context strong{color:var(--ink-2)}.pc-preview-tools{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-bottom:8px}.pc-segmented{display:flex;padding:2px;background:#e9edf1;border:1px solid #d0d7de;border-radius:4px}.pc-segmented button{min-height:25px;padding:0 8px;color:var(--muted);background:transparent;border:0;border-radius:3px;font-size:8px}.pc-segmented button.active{color:#173f91;background:#fff;box-shadow:0 1px 2px rgba(24,38,54,.12);font-weight:680}.pc-preview-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(240px,.75fr);gap:9px}.pc-evidence-card{padding:8px;background:#fff;border:1px solid var(--line)}.pc-evidence-card h3{margin:0 0 7px;font-size:9px}.pc-run-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(275px,.75fr);gap:9px}.pc-progress-list{display:grid;border:1px solid var(--line)}.pc-progress-row{display:grid;grid-template-columns:25px minmax(130px,.7fr) minmax(0,1fr) auto;align-items:center;gap:8px;min-height:39px;padding:5px 8px;border-bottom:1px solid var(--line)}.pc-progress-row:last-child{border-bottom:0}.pc-progress-order{width:20px;height:20px;display:grid;place-items:center;color:#fff;background:#7d8b98;border-radius:50%;font-size:7px}.pc-progress-row.success .pc-progress-order{background:var(--success)}.pc-progress-row.warning .pc-progress-order{background:var(--warning)}.pc-progress-row.failed .pc-progress-order{background:var(--danger)}.pc-progress-row.running .pc-progress-order{background:var(--accent)}.pc-progress-row strong{font-size:8px}.pc-progress-row span{color:var(--muted);font-size:7px}.pc-quality-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-bottom:8px;background:var(--line);border:1px solid var(--line)}.pc-quality-stat{padding:7px;background:#fff}.pc-quality-stat span{display:block;color:var(--muted);font-size:7px}.pc-quality-stat strong{display:block;margin-top:4px;font-size:12px}.pc-modal-stack{display:grid;gap:10px}.pc-shortcut-list{display:grid;border:1px solid var(--line)}.pc-shortcut-row{display:grid;grid-template-columns:180px minmax(0,1fr);align-items:center;gap:10px;padding:9px;border-bottom:1px solid var(--line)}.pc-shortcut-row:last-child{border-bottom:0}.pc-shortcut-row kbd{width:fit-content;padding:3px 6px;color:#2f465d;background:#f3f5f7;border:1px solid #c8d0d8;border-bottom-width:2px;border-radius:3px;font-family:"SFMono-Regular",Consolas,monospace;font-size:8px}.pc-shortcut-row span{color:var(--muted);font-size:8px}.pc-debug-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pc-debug-pane{padding:9px;background:#f7f9fb;border:1px solid var(--line)}.pc-debug-pane strong{font-size:9px}.pc-debug-pane pre{max-height:150px;margin:7px 0 0;overflow:auto;color:#38506a;font-size:7px;line-height:1.6;white-space:pre-wrap}.pc-warning-reason textarea{min-height:70px}.pc-loading-center{min-height:140px;display:grid;place-items:center;align-content:center;gap:7px;color:var(--accent)}.pc-loading-center span{color:var(--muted);font-size:8px}@media(max-width:1250px){.pc-layout.drawer-open{grid-template-columns:170px minmax(0,1fr) 300px}.pc-library{font-size:8px}.pc-node{width:162px}.pc-preview-grid,.pc-run-grid{grid-template-columns:1fr}.pc-head-actions .p-btn span{font-size:9px}}
  .pc-stage{width:1000px}.pc-lines{width:1000px}.pc-node{width:144px}.pc-node-kind strong,.pc-node-summary{font-size:8px}.pc-node.locked{cursor:pointer}.pc-lock-note{color:#71500c;background:#fff7e7;border:1px solid #e0c57f;padding:4px 7px;border-radius:3px}.pc-recovery-chip{display:inline-flex;align-items:center;gap:5px;color:#28547b;background:#edf6fc;border:1px solid #bcd5e7;padding:4px 7px;border-radius:3px;font-size:8px;white-space:nowrap}.pc-preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.pc-preview-heading h3{margin:0;font-size:10px}.pc-preview-heading p{margin:3px 0 0;color:var(--muted);font-size:7px;line-height:1.5}.pc-preview-stack{display:grid;gap:8px}.pc-preview-package{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}@media(max-width:1250px){.pc-node{width:144px}.pc-preview-package{grid-template-columns:1fr}}
`;

function PrototypeCanvasStyles() {
  return <style>{PROTOTYPE_CANVAS_CSS}</style>;
}

function pcTone(status) {
  if (/失败|不兼容/.test(status)) return "failed";
  if (/警告|等待|未发布|结束/.test(status)) return "warning";
  if (/运行|处理中|发布中|刷新中/.test(status)) return "running";
  if (/成功|通过|完整|就绪|已保存/.test(status)) return "success";
  return "neutral";
}

function pcPriorTrustedVersion(scenario) {
  if (scenario.key === "A") return "ASSET-FINANCE@2026.06.30-r0";
  if (scenario.key === "D") return "ASSET-FINANCE@2026.08.08-r2";
  return "ASSET-FINANCE@2026.07.31-r1";
}

function pcScenarioFingerprint(scenario) {
  return prototypeSnapshotFixture(scenario.key).fingerprint;
}

function pcScenarioQualityRows(scenario) {
  return PROTOTYPE_QUALITY_ROWS.map((row) => {
    if (scenario.key === "C" && row.name === "产业板块有效值") {
      return { ...row, result: "失败", affected: 1, actual: "1 条记录使用旧名称“新能源控股”", recovery: "修正来源值或标准化输入后创建关联重试" };
    }
    if (["B", "D"].includes(scenario.key) && row.name === "担保方式完整性") {
      return { ...row, affected: 1867, actual: "1,867 条为空" };
    }
    return row;
  });
}

function pcInitialRunState(scenario, routeState) {
  if (routeState.mode === "new") return "idle";
  if (!routeState.historical && (routeState.retryFrom || routeState.recoveryFrom)) return "idle";
  if (routeState.runId === "TRIAL-FIN-20260809-001") return "trial-complete";
  if (routeState.runId === "RUN-FIN-20260702-000") return "ready";
  if (routeState.runId === "RUN-FIN-20260809-001") return routeState.resolvedReady || routeState.refreshed || routeState.canvasRunState === "ready" ? "ready" : "waiting";
  if (routeState.runId === "RUN-FIN-20260809-002") return "ready";
  if (routeState.runId === "RUN-FIN-20260809-003") return "hard-failed";
  if (routeState.runId === "RUN-FIN-20260809-004") return "refresh-failed";
  if (routeState.canvasRunState) {
    if (routeState.canvasRunState === "trial-running") return "trial-complete";
    if (routeState.canvasRunState === "running") return scenario.key === "C" ? "hard-failed" : "waiting";
    if (routeState.canvasRunState === "publishing") return scenario.key === "D" ? "refresh-failed" : "ready";
    return routeState.canvasRunState;
  }
  if (!routeState.historical && !routeState.runId) return "idle";
  if (scenario.key === "A") return routeState.resolvedReady || routeState.refreshed ? "ready" : "waiting";
  if (scenario.key === "B") return "ready";
  if (scenario.key === "C") return "hard-failed";
  if (scenario.key === "D") return "refresh-failed";
  return "idle";
}

function pcDefaultPositions() {
  return Object.fromEntries(PROTOTYPE_PIPELINE_NODES.map((node, index) => [node.key, { x: 42 + index * 162, y: 126 }]));
}

function pcSnapshotT008(scenario, routeState, snapshotId) {
  if (!snapshotId || snapshotId === "尚未绑定") return "尚未确定";
  if (snapshotId === "SNAP-FIN-20260630-001") return "2026-06-30";
  const routedT008 = routeState.snapshotId === snapshotId ? routeState.snapshotT008 : "";
  const registeredT008 = routeState.registeredSnapshot && routeState.registeredSnapshot.id === snapshotId ? routeState.registeredSnapshot.t008 : routeState.registeredSnapshotId === snapshotId ? routeState.registeredT008 : "";
  if (snapshotId === scenario.snapshot) return routedT008 || registeredT008 || scenario.t008;
  return routedT008 || registeredT008 || scenario.t008;
}

function PrototypePipelineCanvasScreen({
  scenario = PROTOTYPE_SCENARIOS.A,
  onNavigate = () => {},
  onToast = () => {},
  onFlowChange,
  routeState = {},
}) {
  const isNew = routeState.mode === "new";
  const pipelineId = isNew ? "PIPE-FIN-DRAFT-NEW" : "PIPE-FIN-STD-v1.0";
  const historical = Boolean(routeState.historical);
  const initialNode = isNew ? "" : routeState.focusNode || routeState.selectedNode || "source";
  const [placed, setPlaced] = useCanvasState(isNew ? [] : PROTOTYPE_PIPELINE_NODES.map((node) => node.key));
  const [selectedKey, setSelectedKey] = useCanvasState(initialNode);
  const [drawerOpen, setDrawerOpen] = useCanvasState(!isNew);
  const [positions, setPositions] = useCanvasState(pcDefaultPositions);
  const [history, setHistory] = useCanvasState([]);
  const [zoom, setZoom] = useCanvasState(.76);
  const [pan, setPan] = useCanvasState({ x: 22, y: 32 });
  const [dragNode, setDragNode] = useCanvasState(null);
  const [panDrag, setPanDrag] = useCanvasState(null);
  const [saved, setSaved] = useCanvasState(!isNew);
  const [bottomOpen, setBottomOpen] = useCanvasState(true);
  const [bottomTall, setBottomTall] = useCanvasState(false);
  const [bottomTab, setBottomTab] = useCanvasState(routeState.bottomTab || "preview");
  const [previewSide, setPreviewSide] = useCanvasState("output");
  const [previewLoading, setPreviewLoading] = useCanvasState(false);
  const [previewReady, setPreviewReady] = useCanvasState(Boolean(routeState.historical || routeState.runId));
  const [fieldQuery, setFieldQuery] = useCanvasState("");
  const [runState, setRunState] = useCanvasState(() => pcInitialRunState(scenario, routeState));
  const [trialEndKey, setTrialEndKey] = useCanvasState(routeState.canvasTrialEndKey || initialNode || "quality");
  const [confirmOpen, setConfirmOpen] = useCanvasState(false);
  const [warningOpen, setWarningOpen] = useCanvasState(false);
  const [shortcutOpen, setShortcutOpen] = useCanvasState(false);
  const [debugOpen, setDebugOpen] = useCanvasState(false);
  const [debugRunning, setDebugRunning] = useCanvasState(false);
  const [warningReason, setWarningReason] = useCanvasState("");
  const [scriptVersion, setScriptVersion] = useCanvasState("1.0.0");
  const [sourceId, setSourceId] = useCanvasState(routeState.sourceId || prototypeScenarioSource(scenario.key).id);
  const [snapshotId, setSnapshotId] = useCanvasState(routeState.snapshotId || scenario.snapshot);
  const [detailSheet, setDetailSheet] = useCanvasState("2-融资一览表明细");
  const [detailHeader, setDetailHeader] = useCanvasState("1");
  const [ownerSheet, setOwnerSheet] = useCanvasState("单位负责人映射");
  const [ownerHeader, setOwnerHeader] = useCanvasState("3");
  const [missingLabel, setMissingLabel] = useCanvasState("未知");
  const [versionNote, setVersionNote] = useCanvasState("融资工作簿标准化发布");
  const [recoveryContext, setRecoveryContext] = useCanvasState(routeState.retryFrom || routeState.recoveryFrom || "");
  const [recoveryLabel, setRecoveryLabel] = useCanvasState(routeState.retryFrom ? "重试来源" : "恢复来源");
  const repairFixture = scenario.key === "D" && recoveryContext ? prototypeRetryRunFixture("D") : null;
  const activeAssetVersion = scenario.assetVersion;
  const canvasRef = useCanvasRef(null);
  const timersRef = useCanvasRef([]);
  const previewRequestRef = useCanvasRef(0);
  const scenarioRef = useCanvasRef(scenario.key);
  const allPlaced = placed.length === PROTOTYPE_PIPELINE_NODES.length;
  const selected = placed.includes(selectedKey) ? PROTOTYPE_PIPELINE_NODES.find((node) => node.key === selectedKey) || null : null;
  const boundSnapshotId = placed.includes("source") ? snapshotId : "尚未绑定";
  const boundT008 = !placed.includes("source") ? "尚未确定" : pcSnapshotT008(scenario, routeState, snapshotId);
  const qualityRows = useCanvasMemo(() => pcScenarioQualityRows(scenario), [scenario.key]);
  const interactionLocked = historical || ["trial-running", "running", "waiting", "publishing"].includes(runState);
  const formalQualityAvailable = ["waiting", "stopped", "hard-failed", "publishing", "refresh-failed", "ready"].includes(runState);
  const lockReason = historical ? "历史运行上下文只读" : runState === "waiting" ? "正式运行停在质量门；请先继续或结束本次运行" : runState === "publishing" ? "正在发布并请求刷新，配置和节点位置已锁定" : runState === "trial-running" ? "试运行中，配置和节点位置已锁定" : runState === "running" ? "正式运行中，配置和节点位置已锁定" : "";

  useCanvasEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);
  useCanvasEffect(() => {
    if (scenarioRef.current === scenario.key) return;
    scenarioRef.current = scenario.key;
    setPlaced(isNew ? [] : PROTOTYPE_PIPELINE_NODES.map((node) => node.key));
    setSourceId(prototypeScenarioSource(scenario.key).id);
    setSnapshotId(scenario.snapshot);
    setRecoveryContext("");
    setRecoveryLabel("恢复来源");
    previewRequestRef.current += 1;
    setPreviewLoading(false);
    setPreviewReady(false);
    setPreviewSide("output");
    setFieldQuery("");
    setSaved(!isNew);
    setConfirmOpen(false);
    setWarningOpen(false);
    setWarningReason("");
    setTrialEndKey("quality");
    if (isNew) { setRunState("idle"); setSelectedKey(""); setBottomTab("preview"); }
    else if (scenario.key === "A") { setRunState("waiting"); setSelectedKey("quality"); setBottomTab("quality"); }
    else if (scenario.key === "B") { setRunState("ready"); setSelectedKey("refresh"); setBottomTab("run"); }
    else if (scenario.key === "C") { setRunState("hard-failed"); setSelectedKey("quality"); setBottomTab("quality"); }
    else if (scenario.key === "D") { setRunState("refresh-failed"); setSelectedKey("refresh"); setBottomTab("run"); }
    setDrawerOpen(!isNew);
    setBottomOpen(true);
  }, [scenario.key]);
  useCanvasEffect(() => {
    setRecoveryContext(routeState.retryFrom || routeState.recoveryFrom || "");
    setRecoveryLabel(routeState.retryFrom ? "重试来源" : "恢复来源");
  }, [routeState.retryFrom, routeState.recoveryFrom]);
  useCanvasEffect(() => {
    const requested = routeState.focusNode || routeState.selectedNode;
    if (requested && placed.includes(requested)) {
      setSelectedKey(requested);
      setDrawerOpen(true);
    }
    if (routeState.bottomTab) {
      setBottomTab(routeState.bottomTab);
      setBottomOpen(true);
    }
  }, [routeState.focusNode, routeState.selectedNode, routeState.bottomTab, placed.join("|")]);

  const selectNode = useCanvasCallback((key, preferredTab) => {
    const changed = key !== selectedKey;
    setSelectedKey(key);
    setDrawerOpen(true);
    setBottomOpen(true);
    if (changed) {
      previewRequestRef.current += 1;
      setPreviewLoading(false);
      setPreviewReady(false);
      setPreviewSide("output");
      setFieldQuery("");
    }
    if (preferredTab) setBottomTab(preferredTab);
    else if (key === "quality" && ["waiting", "hard-failed", "stopped"].includes(runState)) setBottomTab("quality");
    else if (changed) setBottomTab("preview");
  }, [runState, selectedKey]);

  const savePipeline = useCanvasCallback(() => {
    if (interactionLocked) {
      onToast(lockReason || "当前上下文已锁定，不能保存配置", historical ? "info" : "warning");
      return;
    }
    if (!allPlaced) {
      onToast(`还缺 ${PROTOTYPE_PIPELINE_NODES.length - placed.length} 个节点；按合法顺序补齐后再保存`, "warning");
      return;
    }
    setSaved(true);
    onToast(isNew ? "新管道草稿已保存为 PIPE-FIN-DRAFT-NEW · 保存版本 1" : "管道已保存为 PIPE-FIN-STD-v1.0 · 保存版本 13", "success");
  }, [historical, interactionLocked, lockReason, allPlaced, placed.length, onToast, isNew]);

  const undo = useCanvasCallback(() => {
    if (interactionLocked) {
      onToast(lockReason || "当前上下文已锁定，不能撤销节点移动", historical ? "info" : "warning");
      return;
    }
    if (!history.length) {
      onToast("当前没有可撤销的画布位置更改", "info");
      return;
    }
    const previous = history[history.length - 1];
    setPositions(previous);
    setHistory((items) => items.slice(0, -1));
    onToast("已撤销上一次节点移动", "success");
  }, [interactionLocked, lockReason, historical, history, onToast]);

  const fitCanvas = useCanvasCallback(() => {
    const count = Math.max(placed.length, 1);
    const needed = 42 + (count - 1) * 162 + 160;
    const width = canvasRef.current ? canvasRef.current.clientWidth : 980;
    const nextZoom = Math.max(.62, Math.min(1, (width - 50) / needed));
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: 20, y: 28 });
    onToast("已适应窗口并保留当前选中节点", "success");
  }, [placed.length, onToast]);

  const addNode = (key) => {
    if (placed.includes(key)) {
      selectNode(key);
      onToast("该节点已经在画布中，已为你定位", "info");
      return;
    }
    if (interactionLocked) {
      onToast(lockReason || "当前上下文已锁定，不能改变画布结构", historical ? "info" : "warning");
      return;
    }
    const expected = PROTOTYPE_PIPELINE_NODES[placed.length];
    if (!expected || expected.key !== key) {
      onToast(`合法下一节点是“${expected ? expected.name : "无"}”；一期不允许逆序、分支或重复节点`, "warning");
      return;
    }
    setPlaced((items) => [...items, key]);
    setSelectedKey(key);
    setDrawerOpen(true);
    setSaved(false);
    onToast(`已加入“${expected.name}”并连接到合法单链`, "success");
  };

  const removeLastNode = () => {
    if (!placed.length || placed[placed.length - 1] !== selectedKey || runState !== "idle") return;
    setPlaced((items) => items.slice(0, -1));
    setSelectedKey(placed.length > 1 ? placed[placed.length - 2] : "");
    setDrawerOpen(placed.length > 1);
    setSaved(false);
    onToast("已删除最后一个尚未运行的节点", "success");
  };

  const generatePreview = useCanvasCallback(() => {
    if (!selected) {
      onToast("请先选择一个节点", "warning");
      return;
    }
    setBottomOpen(true);
    setBottomTab("preview");
    setPreviewLoading(true);
    setPreviewReady(false);
    const requestId = ++previewRequestRef.current;
    timersRef.current.push(window.setTimeout(() => {
      if (previewRequestRef.current !== requestId) return;
      setPreviewLoading(false);
      setPreviewReady(true);
      onToast(`已生成“${selected.name}”的有限预览`, "success");
    }, 420));
  }, [selected, onToast]);

  const runTrial = useCanvasCallback(() => {
    if (interactionLocked || !selected || ["publish", "refresh"].includes(selected.key)) {
      if (interactionLocked) onToast(lockReason, "warning");
      return;
    }
    const frozenEndKey = selected.key;
    setTrialEndKey(frozenEndKey);
    setRunState("trial-running");
    if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "trial-running", canvasTrialEndKey: frozenEndKey });
    setBottomOpen(true);
    setBottomTab("run");
    timersRef.current.push(window.setTimeout(() => {
      setRunState("trial-complete");
      if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "trial-complete", canvasTrialEndKey: frozenEndKey });
      onToast(`试运行已完成至“${selected.name}”；未发布 T007，也未请求刷新`, "success");
    }, 620));
  }, [interactionLocked, lockReason, selected, onFlowChange, onToast]);

  const beginFormalRun = () => {
    if (interactionLocked) {
      onToast(lockReason || "当前运行尚未结束", "warning");
      return;
    }
    if (!allPlaced || !saved) {
      onToast(!allPlaced ? "请先补齐五节点合法单链" : "请先保存当前管道配置", "warning");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmFormalRun = () => {
    setConfirmOpen(false);
    setWarningReason("");
    setRunState("running");
    const retryFixture = recoveryContext ? prototypeRetryRunFixture(scenario.key) : null;
    const retryPatch = retryFixture ? {
      retryRunCreated: true,
      retryRunId: retryFixture.id,
      retryRunScenario: scenario.key,
      retryFrom: retryFixture.parentRun,
    } : {};
    if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "running", ...retryPatch });
    setBottomOpen(true);
    setBottomTab("run");
    timersRef.current.push(window.setTimeout(() => {
      if (scenario.key === "C") {
        setRunState("hard-failed");
        if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "hard-failed", uploadRegistered: true, qualityConfirmed: false, published: false, refreshed: false });
        selectNode("quality", "quality");
        onToast("产业板块有效值检查硬阻断；未形成 T007", "failed");
        return;
      }
      setRunState("waiting");
      if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "waiting", uploadRegistered: true, qualityConfirmed: false, published: false, refreshed: false });
      selectNode("quality", "quality");
      setWarningOpen(true);
      onToast("正式质量门有 3 项警告，等待人工确认", "warning");
    }, 760));
  };

  const continueAfterWarning = () => {
    if (!warningReason.trim()) return;
    setWarningOpen(false);
    setRunState("publishing");
    if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "publishing", qualityConfirmed: true });
    setBottomTab("run");
    timersRef.current.push(window.setTimeout(() => {
      const refreshFailed = scenario.key === "D";
      setRunState(refreshFailed ? "refresh-failed" : "ready");
      selectNode("refresh", "run");
      if (typeof onFlowChange === "function") onFlowChange({ uploadRegistered: true, qualityConfirmed: true, published: true, refreshed: !refreshFailed, canvasRunState: refreshFailed ? "refresh-failed" : "ready" });
      if (refreshFailed) onToast("质量警告已人工确认；内容去重命中既有 r3，关联复验仍返回不兼容，r2 继续服务", "failed");
      else onToast(`已发布 ${activeAssetVersion}；刷新成功且 T019 已采用，消费就绪`, "success");
    }, 820));
  };

  const stopAfterWarning = () => {
    setWarningOpen(false);
    setRunState("stopped");
    setBottomTab("run");
    if (typeof onFlowChange === "function") onFlowChange({ qualityConfirmed: false, published: false, refreshed: false, canvasRunState: "stopped" });
    onToast("本次运行已结束且未发布；上一可信版本继续服务", "warning");
  };

  const startDebug = () => {
    setDebugRunning(true);
    timersRef.current.push(window.setTimeout(() => {
      setDebugRunning(false);
      onToast("限定样例调试完成；结果不是正式 T005，也不会发布", "success");
    }, 520));
  };

  const resetPython = () => {
    setDetailSheet("2-融资一览表明细"); setDetailHeader("1"); setOwnerSheet("单位负责人映射"); setOwnerHeader("3"); setMissingLabel("未知"); setSaved(false);
    onToast("Python 公开参数已恢复为融资预置默认值", "success");
  };

  const nodeState = (key) => {
    const order = PROTOTYPE_PIPELINE_NODES.findIndex((node) => node.key === key);
    const trialEndOrder = PROTOTYPE_PIPELINE_NODES.findIndex((node) => node.key === trialEndKey);
    if (runState === "idle") return { label: "配置完整", tone: "success" };
    if (runState === "trial-running") return order <= trialEndOrder ? { label: order === trialEndOrder ? "试运行中" : "样例成功", tone: order === trialEndOrder ? "running" : "success" } : { label: "未执行", tone: "neutral" };
    if (runState === "trial-complete") return order <= trialEndOrder ? { label: "样例成功", tone: "success" } : { label: "未执行", tone: "neutral" };
    if (runState === "running") return order < 2 ? { label: "执行成功", tone: "success" } : order === 2 ? { label: "检查中", tone: "running" } : { label: "等待上游", tone: "neutral" };
    if (["waiting", "stopped"].includes(runState)) return order < 2 ? { label: "执行成功", tone: "success" } : order === 2 ? { label: runState === "waiting" ? "质量有警告" : "警告·本次结束", tone: "warning" } : { label: "未执行", tone: "neutral" };
    if (runState === "hard-failed") return order < 2 ? { label: "执行成功", tone: "success" } : order === 2 ? { label: "质量失败", tone: "failed" } : { label: "上游阻断", tone: "neutral" };
    if (runState === "publishing") return order < 3 ? { label: order === 2 ? "警告已确认" : "执行成功", tone: order === 2 ? "warning" : "success" } : order === 3 ? { label: "发布中", tone: "running" } : { label: "等待上游", tone: "neutral" };
    if (runState === "refresh-failed") return order < 4
      ? order === 2
        ? { label: "警告已确认", tone: "warning" }
        : order === 3 && scenario.key === "D" && recoveryContext
          ? { label: "命中既有 r3", tone: "info" }
          : { label: "执行成功", tone: "success" }
      : { label: "刷新不兼容", tone: "failed" };
    if (runState === "ready") return { label: order === 2 ? "警告已确认" : order === 4 ? "消费就绪" : "执行成功", tone: order === 2 ? "warning" : "success" };
    return { label: "未执行", tone: "neutral" };
  };

  useCanvasEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") { event.preventDefault(); savePipeline(); return; }
      if (command && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
      if (!command && event.key.toLowerCase() === "f") { event.preventDefault(); fitCanvas(); return; }
      if (!command && (event.key === "+" || event.key === "=")) { event.preventDefault(); setZoom((value) => Math.min(1.25, Number((value + .1).toFixed(2)))); return; }
      if (!command && event.key === "-") { event.preventDefault(); setZoom((value) => Math.max(.55, Number((value - .1).toFixed(2)))); return; }
      if (event.key === "Escape") {
        if (document.querySelector(".p-modal-backdrop")) return;
        if (shortcutOpen) setShortcutOpen(false);
        else if (debugOpen) setDebugOpen(false);
        else if (warningOpen) setWarningOpen(false);
        else if (confirmOpen) setConfirmOpen(false);
        else setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [savePipeline, undo, fitCanvas, shortcutOpen, debugOpen, warningOpen, confirmOpen]);

  const startNodeDrag = (event, key) => {
    event.stopPropagation();
    if (interactionLocked) {
      onToast(lockReason || "当前节点位置已锁定", historical ? "info" : "warning");
      return;
    }
    const pos = positions[key];
    setDragNode({ key, sx: event.clientX, sy: event.clientY, x: pos.x, y: pos.y, moved: false, before: positions });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event) => {
    if (dragNode) {
      const dx = event.clientX - dragNode.sx;
      const dy = event.clientY - dragNode.sy;
      if (!dragNode.moved && Math.hypot(dx, dy) > 3) {
        setHistory((items) => [...items.slice(-19), dragNode.before]);
        setDragNode((current) => current ? { ...current, moved: true } : current);
      }
      if (dragNode.moved || Math.hypot(dx, dy) > 3) {
        setPositions((current) => ({ ...current, [dragNode.key]: { x: dragNode.x + dx / zoom, y: dragNode.y + dy / zoom } }));
      }
    }
    if (panDrag) setPan({ x: panDrag.x + event.clientX - panDrag.sx, y: panDrag.y + event.clientY - panDrag.sy });
  };
  const pointerEnd = () => { if (dragNode && dragNode.moved) setSaved(false); setDragNode(null); setPanDrag(null); };
  const startPan = (event) => {
    if (event.button !== 0 || (event.target.closest && event.target.closest(".pc-node"))) return;
    setPanDrag({ sx: event.clientX, sy: event.clientY, x: pan.x, y: pan.y });
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  };
  const edgePath = (fromKey, toKey) => {
    const a = positions[fromKey]; const b = positions[toKey];
    if (!a || !b) return "";
    const x1 = a.x + 144; const y1 = a.y + 46; const x2 = b.x; const y2 = b.y + 46; const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  };

  const layoutStyle = { "--pc-bottom-height": bottomOpen ? (bottomTall ? "410px" : "286px") : "38px" };

  return (
    <main className="screen-page flush" data-screen-label="D5 五节点数据管道画布">
      <PrototypeCanvasStyles />
      <div className="pc-page">
        <header className="pc-head">
          <div className="pc-title">
            <PrototypeIconButton icon="ArrowLeft" label="返回管道目录" onClick={() => onNavigate("pipelines")} />
            <div className="pc-title-copy"><h1>{isNew ? "新建融资管道" : "融资数据标准化与发布"}</h1><p>{pipelineId} · T008 {boundT008} · 五节点合法单链 · {interactionLocked ? lockReason : "当前可编辑配置"}</p></div>
            <PrototypeStatus tone={saved ? "success" : "warning"} compact>{saved ? "已保存" : "有未保存修改"}</PrototypeStatus>
            {recoveryContext ? <span className="pc-recovery-chip"><PrototypeIcon name="GitBranch" size={11} />{recoveryLabel} · {recoveryContext}</span> : null}
          </div>
          <div className="pc-head-actions">
            <span className={`pc-save-state ${interactionLocked ? "pc-lock-note" : ""}`}><PrototypeIcon name="LockKeyhole" size={12} />{interactionLocked ? "配置与节点移动已锁定" : "正式运行将锁定 T002/T003/T004"}</span>
            <PrototypeButton size="sm" icon="Save" disabled={interactionLocked} title={interactionLocked ? lockReason : "保存当前管道配置"} onClick={savePipeline}>保存</PrototypeButton>
            <PrototypeButton size="sm" icon="TableProperties" disabled={!selected} title={selected ? "生成当前节点的有限预览" : "请先把节点加入画布并选中"} onClick={generatePreview}>生成预览</PrototypeButton>
            <PrototypeButton size="sm" icon="FlaskConical" disabled={interactionLocked || !selected || ["publish", "refresh"].includes(selected.key)} title={interactionLocked ? lockReason : selected && ["publish", "refresh"].includes(selected.key) ? "试运行只到数据源、Python 或数据检查节点" : "使用有限样例运行至当前节点"} onClick={runTrial}>试运行至当前节点</PrototypeButton>
            <PrototypeButton size="sm" variant="primary" icon="Play" disabled={interactionLocked} title={interactionLocked ? lockReason : "锁定版本并运行完整五节点单链"} onClick={beginFormalRun}>正式运行全流程</PrototypeButton>
            <PrototypeIconButton icon="Keyboard" label="查看画布快捷键" onClick={() => setShortcutOpen(true)} />
          </div>
        </header>

        <div className={`pc-layout ${drawerOpen && selected ? "drawer-open" : ""}`} style={layoutStyle}>
          <aside className="pc-library" aria-label="五节点库">
            <div className="pc-library-head"><strong>节点库</strong><span>一期仅允许下列五类节点及固定顺序。可点击或拖入画布。</span></div>
            <div className="pc-library-list">
              {PROTOTYPE_PIPELINE_NODES.map((node) => <button type="button" draggable={!interactionLocked} key={node.key} className={`pc-library-node ${placed.includes(node.key) ? "used" : ""}`} style={{ "--node-color": node.color }} title={!placed.includes(node.key) && interactionLocked ? lockReason : placed.includes(node.key) ? "点击定位该节点" : "点击或拖入画布"} onDragStart={(event) => { if (interactionLocked) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", node.key); }} onClick={() => addNode(node.key)}><span className="pc-library-icon"><PrototypeIcon name={node.icon} size={14} /></span><span className="pc-library-copy"><strong>{node.order} · {node.name}</strong><span>{node.hint}</span><small>{placed.includes(node.key) ? "已在画布 · 点击定位" : interactionLocked ? "当前运行已锁定结构" : placed.length === Number(node.order) - 1 ? "可作为下一节点" : "等待前序节点"}</small></span></button>)}
            </div>
            <div className="pc-library-foot"><strong>结构约束</strong><br />不支持分支、循环、并行或通用清洗算子；已发布数据资产不作为可拖入来源。</div>
          </aside>

          <section className="pc-canvas-shell" aria-label="可执行管道画布">
            <div className="pc-context"><PrototypeIcon name="Database" size={12} /><strong>{boundSnapshotId}</strong><span>T008 {boundT008}</span><span>{placed.includes("source") ? "全量快照" : "等待数据源节点"}</span>{recoveryContext ? <span>关联恢复自 <strong>{recoveryContext}</strong></span> : null}</div>
            <div ref={canvasRef} className={`pc-canvas ${panDrag ? "panning" : ""}`} onPointerDown={startPan} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(.55, Math.min(1.25, Number((value + (event.deltaY < 0 ? .06 : -.06)).toFixed(2))))); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addNode(event.dataTransfer.getData("text/plain")); }}>
              {!placed.length ? <div className="pc-empty-canvas"><PrototypeIcon name="Workflow" size={25} /><strong>从“数据源”开始搭建</strong><span>拖入或点击节点库；非法顺序会在落下前拒绝。</span></div> : null}
              <div className="pc-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                <svg className="pc-lines" aria-hidden="true"><defs><marker id="pc-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#8d9baa" /></marker></defs>{placed.slice(1).map((key, index) => { const from = placed[index]; return <path key={`${from}-${key}`} className={`pc-line ${selectedKey === from || selectedKey === key ? "active" : ""}`} d={edgePath(from, key)} />; })}</svg>
                {PROTOTYPE_PIPELINE_NODES.filter((node) => placed.includes(node.key)).map((node) => { const state = nodeState(node.key); const pos = positions[node.key]; return <button type="button" key={node.key} className={`pc-node ${selectedKey === node.key ? "selected" : ""} ${state.tone} ${interactionLocked ? "locked" : ""}`} title={interactionLocked ? `${lockReason}；仍可点击查看证据` : "拖动调整位置；点击查看配置与证据"} style={{ left: pos.x, top: pos.y, "--node-color": node.color }} onPointerDown={(event) => startNodeDrag(event, node.key)} onClick={(event) => { event.stopPropagation(); selectNode(node.key); }}><span className="pc-node-head"><span className="pc-node-kind"><span><PrototypeIcon name={node.icon} size={12} /></span><strong>{node.order} · {node.name}</strong></span><PrototypeIcon name={interactionLocked ? "LockKeyhole" : "Grip"} size={12} /></span><span className="pc-node-summary">{node.summary}</span><span className="pc-node-detail">{node.key === "source" ? snapshotId : node.key === "quality" ? "8 项检查 · 3 项警告" : node.key === "publish" ? "融资标准化数据资产" : node.key === "refresh" ? "融资演示本体 · Published v1.0.0" : "v1.0.0 · 四成员候选"}</span><span className="pc-node-status"><PrototypeStatus tone={state.tone} compact>{state.label}</PrototypeStatus></span></button>; })}
              </div>
            </div>
            <div className="pc-viewport"><PrototypeIconButton icon="Undo2" label={interactionLocked ? lockReason : "撤销节点移动"} disabled={interactionLocked || !history.length} onClick={undo} /><PrototypeIconButton icon="ZoomOut" label="缩小" onClick={() => setZoom((value) => Math.max(.55, Number((value - .1).toFixed(2))))} /><span className="pc-zoom">{Math.round(zoom * 100)}%</span><PrototypeIconButton icon="Scan" label="适应窗口" onClick={fitCanvas} /><PrototypeIconButton icon="ZoomIn" label="放大" onClick={() => setZoom((value) => Math.min(1.25, Number((value + .1).toFixed(2))))} /></div>
          </section>

          <PrototypeCanvasBottomPanel scenario={scenario} assetVersion={activeAssetVersion} snapshotId={boundSnapshotId} boundT008={boundT008} pipelineId={pipelineId} selected={selected} runState={runState} nodeState={nodeState} tab={bottomTab} setTab={setBottomTab} open={bottomOpen} setOpen={setBottomOpen} tall={bottomTall} setTall={setBottomTall} previewSide={previewSide} setPreviewSide={setPreviewSide} previewLoading={previewLoading} previewReady={previewReady} fieldQuery={fieldQuery} setFieldQuery={setFieldQuery} qualityRows={qualityRows} formalQualityAvailable={formalQualityAvailable} recoveryContext={recoveryContext} recoveryLabel={recoveryLabel} onSelectNode={selectNode} onNavigate={onNavigate} onToast={onToast} onWarning={() => setWarningOpen(true)} onRetry={() => { setRecoveryContext(scenario.run); setRecoveryLabel("重试来源"); setRunState("idle"); if (typeof onFlowChange === "function") onFlowChange({ canvasRunState: "idle" }); selectNode("source", "preview"); onToast(`已从 ${scenario.run} 创建关联重试上下文；正式运行前不会分配新运行号`, "success"); }} />

          {drawerOpen && selected ? <PrototypeCanvasDrawer historical={historical} locked={interactionLocked} lockReason={lockReason} node={selected} scenario={scenario} assetVersion={activeAssetVersion} repairActive={Boolean(repairFixture)} routeState={routeState} runState={runState} nodeState={nodeState(selected.key)} formalQualityAvailable={formalQualityAvailable} sourceId={sourceId} setSourceId={(value) => { setSourceId(value); setSnapshotId(scenario.snapshot); setSaved(false); }} snapshotId={snapshotId} boundT008={boundT008} setSnapshotId={(value) => { setSnapshotId(value); setSaved(false); }} scriptVersion={scriptVersion} setScriptVersion={(value) => { setScriptVersion(value); setSaved(false); }} detailSheet={detailSheet} setDetailSheet={(value) => { setDetailSheet(value); setSaved(false); }} detailHeader={detailHeader} setDetailHeader={(value) => { setDetailHeader(value); setSaved(false); }} ownerSheet={ownerSheet} setOwnerSheet={(value) => { setOwnerSheet(value); setSaved(false); }} ownerHeader={ownerHeader} setOwnerHeader={(value) => { setOwnerHeader(value); setSaved(false); }} missingLabel={missingLabel} setMissingLabel={(value) => { setMissingLabel(value); setSaved(false); }} versionNote={versionNote} setVersionNote={(value) => { setVersionNote(value); setSaved(false); }} onClose={() => setDrawerOpen(false)} onNavigate={onNavigate} onPreview={generatePreview} onDebug={() => { setDebugOpen(true); startDebug(); }} onResetPython={resetPython} onOpenQuality={() => { setBottomTab("quality"); setBottomOpen(true); }} onOpenRun={() => { setBottomTab("run"); setBottomOpen(true); }} canDelete={!interactionLocked && runState === "idle" && placed[placed.length - 1] === selected.key && isNew} onDelete={removeLastNode} /> : null}
        </div>
      </div>

      <PrototypeCanvasModals scenario={scenario} snapshotId={boundSnapshotId} boundT008={boundT008} pipelineId={pipelineId} selected={selected} confirmOpen={confirmOpen} setConfirmOpen={setConfirmOpen} onConfirm={confirmFormalRun} warningOpen={warningOpen} setWarningOpen={setWarningOpen} warningReason={warningReason} setWarningReason={setWarningReason} onContinue={continueAfterWarning} onStop={stopAfterWarning} shortcutOpen={shortcutOpen} setShortcutOpen={setShortcutOpen} debugOpen={debugOpen} setDebugOpen={setDebugOpen} debugRunning={debugRunning} onDebug={startDebug} />
    </main>
  );
}

function PrototypeNodePreview({ scenario, snapshotId, boundT008, selected, previewSide, fieldQuery, qualityRows, formalQualityAvailable, runState }) {
  if (!selected) return <PrototypeEmpty icon="MousePointer2" title="尚未选择节点" description="从节点库加入节点并选中后，再生成该节点的有限预览。" />;

  const query = fieldQuery.trim().toLowerCase();
  const filterRows = (rows) => rows.filter((row) => !query || Object.values(row).join(" ").toLowerCase().includes(query));
  const rawRows = PROTOTYPE_PREVIEW_ROWS.map((row, index) => ({
    row: index + 2,
    unitName: row.orgName,
    sector: row.sector,
    institution: row.institutionName,
    owner: row.owner,
    balance: row.balance,
  }));
  const memberRows = PROTOTYPE_MEMBERS.map((member) => ({
    member: member.name,
    grain: member.grain,
    primaryKey: member.primaryKey,
    rows: member.rows.toLocaleString(),
  }));
  const relationshipRows = PROTOTYPE_RELATIONSHIPS.map((relationship) => ({
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    cardinality: relationship.cardinality,
    unmatched: relationship.unmatched,
  }));
  const publishedAvailable = ["refresh-failed", "ready"].includes(runState);
  const refreshAvailable = ["refresh-failed", "ready"].includes(runState);

  const header = (title, description) => <div className="pc-preview-heading"><div><h3>{title}</h3><p>{description}</p></div><PrototypeStatus compact>{previewSide === "input" ? "节点输入" : "节点输出"}</PrototypeStatus></div>;
  const rawTable = () => <PrototypeTable columns={[{ key: "row", label: "原行", width: "8%" }, { key: "unitName", label: "单位名称", width: "16%" }, { key: "sector", label: "原板块值", width: "18%" }, { key: "institution", label: "金融机构原值", width: "18%" }, { key: "owner", label: "负责人原值", width: "18%" }, { key: "balance", label: "融资余额原值", align: "right", width: "22%" }]} rows={filterRows(rawRows)} rowKey="row" empty={<PrototypeEmpty icon="SearchX" title="没有匹配的原始样例" description="清空搜索后查看四行固定样例。" />} />;
  const memberTable = () => <PrototypeTable columns={[{ key: "member", label: "成员", width: "27%" }, { key: "grain", label: "粒度", width: "31%" }, { key: "primaryKey", label: "主键", width: "24%" }, { key: "rows", label: "候选行数", align: "right", width: "18%" }]} rows={filterRows(memberRows)} rowKey="member" empty={<PrototypeEmpty icon="SearchX" title="没有匹配的成员" description="清空搜索后查看四成员候选。" />} />;

  if (selected.key === "source") {
    if (previewSide === "input") return <div className="pc-preview-stack">{header("原始工作簿输入", "这里只证明文件和工作表可读，尚未生成标准化成员。")}{rawTable()}</div>;
    return <div className="pc-preview-stack">{header("锁定的原始快照 T002", "数据源节点输出是不可覆盖的快照证据，不是清洗后的业务表。")}<PrototypeKeyValues columns={3} compact items={[{ label: "快照", value: snapshotId, mono: true }, { label: "数据截至时间 T008", value: boundT008 }, { label: "更新语义", value: "独立完整的全量快照" }, { label: "内容指纹", value: snapshotId === scenario.snapshot ? pcScenarioFingerprint(scenario) : "5a82…91be", mono: true }, { label: "融资明细", value: "5,218 行 · 35 来源字段" }, { label: "负责人映射", value: "574 家主体 · 24 位负责人" }]} /></div>;
  }

  if (selected.key === "python") {
    if (previewSide === "input") return <div className="pc-preview-stack">{header("Python 工作簿输入", "读取两个已配置工作表的有限原值样例；表头与角色由脚本组件唯一配置。")}{rawTable()}</div>;
    return <div className="pc-preview-stack">{header("四成员候选输出", "预置模块生成四个稳定粒度的成员候选，并同时形成三条关系候选。")}{memberTable()}<PrototypeAlert tone="info" title="同时生成三条关系候选">明细→主体、明细→机构、主体→负责人；这里只是运行中候选，尚未形成不可变 T007。</PrototypeAlert></div>;
  }

  if (selected.key === "quality") {
    if (previewSide === "input") return <div className="pc-preview-stack">{header("受检的标准化候选", "正式质量门同时核对四成员、三关系、业务分类和数值范围。")}{memberTable()}<PrototypeTable columns={[{ key: "id", label: "关系", width: "10%" }, { key: "source", label: "来源端点", width: "31%" }, { key: "target", label: "目标端点", width: "31%" }, { key: "cardinality", label: "基数", width: "14%" }, { key: "unmatched", label: "未匹配", align: "right", width: "14%" }]} rows={filterRows(relationshipRows)} rowKey="id" /></div>;
    if (!formalQualityAvailable) return <div className="pc-preview-stack">{header("正式质量检查输出", "只有正式运行到达质量门后才会形成 T005 证据。")}<PrototypeEmpty icon="ShieldQuestion" title="尚未形成正式质量结果" description="预览和样例调试都不会生成 T005。请保存配置并正式运行全流程。" /></div>;
    return <div className="pc-preview-stack">{header("正式质量检查输出 T005", "结果保留原始结论；人工确认警告只决定是否允许继续发布。")}<PrototypeTable columns={[{ key: "name", label: "检查项", width: "27%" }, { key: "level", label: "门禁", width: "14%" }, { key: "result", label: "结果", width: "14%", render: (row) => <PrototypeStatus tone={pcTone(row.result)} compact>{row.result}</PrototypeStatus> }, { key: "affected", label: "影响行", align: "right", width: "13%" }, { key: "actual", label: "实际", width: "32%" }]} rows={filterRows(qualityRows)} rowKey="name" /></div>;
  }

  if (selected.key === "publish") {
    if (previewSide === "input") return <div className="pc-preview-stack">{header("上游发布候选", "发布节点接收已经过正式质量门的四成员、三关系和 T005 结论。")}{memberTable()}<PrototypeKeyValues columns={3} compact items={[{ label: "正式质量", value: formalQualityAvailable ? scenario.quality : "尚未运行" }, { label: "关系端点未匹配", value: formalQualityAvailable ? "0" : "待检查" }, { label: "数据截至时间", value: boundT008 }]} /></div>;
    return <div className="pc-preview-stack">{header(publishedAvailable ? "不可变版本包 T007" : "拟发布版本包", publishedAvailable ? "四成员和三关系作为一个原子版本发布，成员不能各自切换。" : "当前只展示发布合同；正式运行通过质量门后才分配 T007。")}{publishedAvailable ? <PrototypeKeyValues columns={3} compact items={[{ label: "精确 T007", value: scenario.assetVersion, mono: true }, { label: "逻辑资产 T006", value: "融资标准化数据资产" }, { label: "版本状态", value: "不可变" }]} /> : <PrototypeAlert tone="info" title="尚未发布">生成预览不会创建资产版本；正式运行到第四节点才执行原子发布。</PrototypeAlert>}<div className="pc-preview-package">{memberRows.map((member) => <div className="pc-evidence-card" key={member.member}><h3>{member.member}</h3><PrototypeKeyValues columns={2} compact items={[{ label: "粒度", value: member.grain }, { label: "主键", value: member.primaryKey }, { label: "行数", value: member.rows }, { label: "版本归属", value: publishedAvailable ? scenario.assetVersion : "待发布" }]} /></div>)}</div><PrototypeAlert tone="info" title="同包包含三条关系">REL-01 明细→主体；REL-02 明细→机构；REL-03 主体→负责人。端点未匹配必须为 0。</PrototypeAlert></div>;
  }

  if (previewSide === "input") {
    return <div className="pc-preview-stack">{header("刷新请求输入", "第五节点只接收精确 T007，不接收原始工作簿或 Python 临时结果。")}{publishedAvailable ? <PrototypeKeyValues columns={3} compact items={[{ label: "精确 T007", value: scenario.assetVersion, mono: true }, { label: "数据截至时间", value: boundT008 }, { label: "四成员 / 三关系", value: "4 / 3" }, { label: "正式质量", value: scenario.quality }, { label: "目标精确 T017", value: "Published v1.0.0" }, { label: "来源映射", value: "融资标准化来源映射 v1" }]} /> : <PrototypeEmpty icon="PackageOpen" title="尚无可请求刷新的 T007" description="必须先通过质量门并完成第四节点发布。" />}</div>;
  }
  return <div className="pc-preview-stack">{header("刷新请求合同输出", "请求事实和本体返回结果分开记录；请求发出不等于刷新成功。")}{refreshAvailable ? <PrototypeKeyValues columns={3} compact items={[{ label: "刷新请求", value: scenario.refresh, mono: true }, { label: "请求引用", value: scenario.assetVersion, mono: true }, { label: "目标 T017", value: "Published v1.0.0" }, { label: "受理结果", value: "已受理" }, { label: "刷新结果", value: scenario.refreshResult }, { label: "权威采用", value: runState === "ready" ? "T019 已采用" : "T019 未采用" }]} /> : <PrototypeEmpty icon="Send" title="尚未形成刷新请求" description="第四节点发布成功后，第五节点才会按合同发出请求。" />}</div>;
}

function PrototypeCanvasBottomPanel({ scenario, assetVersion, snapshotId, boundT008, pipelineId, selected, runState, nodeState, tab, setTab, open, setOpen, tall, setTall, previewSide, setPreviewSide, previewLoading, previewReady, fieldQuery, setFieldQuery, qualityRows, formalQualityAvailable, recoveryContext, recoveryLabel, onSelectNode, onNavigate, onToast, onWarning, onRetry }) {
  const execution = runState === "idle" ? "尚无运行" : runState === "trial-running" ? "试运行中" : runState === "running" || runState === "publishing" ? "运行中" : runState === "waiting" ? "等待确认" : runState === "hard-failed" ? "失败" : "已结束";
  const closure = runState === "ready" ? "消费就绪" : runState === "refresh-failed" ? "已发布·刷新失败" : runState === "trial-complete" || runState === "trial-running" ? "不适用·试运行不发布" : runState === "publishing" ? "发布中" : "未发布";
  const hasRunEvidence = runState !== "idle";
  const activeRunId = !hasRunEvidence ? "尚未创建" : runState === "trial-complete" || runState === "trial-running" ? "TRIAL-FIN-20260809-001" : recoveryContext ? prototypeRetryRunId(scenario.key) : scenario.run;
  const guaranteeMissing = ["B", "D"].includes(scenario.key) ? "1,867" : "1,868";
  const displayT008 = boundT008;
  return <section className={`pc-bottom ${open ? "" : "collapsed"}`} aria-label="节点证据面板">
    <div className="pc-bottom-head"><PrototypeTabs value={tab} onChange={(value) => { setTab(value); setOpen(true); }} items={[{ value: "preview", label: "数据预览", icon: "TableProperties" }, { value: "run", label: "运行结果", icon: "Activity" }, { value: "quality", label: "质量结果", icon: "ShieldCheck", disabled: !(selected && selected.key === "quality" && formalQualityAvailable), disabledReason: !selected || selected.key !== "quality" ? "先选择数据检查节点" : "正式运行到达质量门后可查看" }]} /><div className="pc-bottom-actions"><PrototypeIconButton icon={tall ? "Minimize2" : "Maximize2"} label={tall ? "恢复面板高度" : "调高面板"} onClick={() => { setTall(!tall); setOpen(true); }} /><PrototypeIconButton icon={open ? "PanelBottomClose" : "PanelBottomOpen"} label={open ? "折叠证据面板" : "展开证据面板"} onClick={() => setOpen(!open)} /></div></div>
    <div className="pc-bottom-body">
      <div className="pc-evidence-context"><span>当前节点 <strong>{selected ? selected.name : "未选择"}</strong></span><span>T002 <strong>{snapshotId}</strong></span><span>T003 <strong>{pipelineId}</strong></span><span>T004 <strong>1.0.0</strong></span><span>T008 <strong>{displayT008}</strong></span>{recoveryContext ? <span>{recoveryLabel} <strong>{recoveryContext}</strong></span> : null}</div>
      {tab === "preview" ? previewLoading ? <div className="pc-loading-center"><PrototypeIcon name="LoaderCircle" size={22} className="spin" /><span>正在生成当前节点的有限预览</span></div> : !previewReady ? <PrototypeEmpty icon="TableProperties" title="尚无预览" description="点击顶部“生成预览”；预览正常不等于正式质量检查通过。" /> : <><div className="pc-preview-tools"><div className="pc-segmented"><button type="button" className={previewSide === "input" ? "active" : ""} onClick={() => setPreviewSide("input")}>节点输入</button><button type="button" className={previewSide === "output" ? "active" : ""} onClick={() => setPreviewSide("output")}>节点输出</button></div><PrototypeSearch value={fieldQuery} onChange={setFieldQuery} placeholder="搜索当前节点证据" ariaLabel="搜索当前节点预览证据" /></div><PrototypeNodePreview scenario={scenario} snapshotId={snapshotId} boundT008={boundT008} selected={selected} previewSide={previewSide} fieldQuery={fieldQuery} qualityRows={qualityRows} formalQualityAvailable={formalQualityAvailable} runState={runState} /></> : null}
      {tab === "run" ? <div className="pc-run-grid"><div className="pc-progress-list">{PROTOTYPE_PIPELINE_NODES.map((node) => { const state = nodeState(node.key); return <button type="button" key={node.key} className={`pc-progress-row ${state.tone}`} onClick={() => onSelectNode(node.key, "run")}><span className="pc-progress-order">{node.order}</span><strong>{node.name}</strong><span>{state.label}</span><PrototypeStatus tone={state.tone} compact>{state.label}</PrototypeStatus></button>; })}</div><div className="pc-evidence-card"><h3>本次运行结论</h3><PrototypeKeyValues columns={2} compact items={[{ label: "执行状态", value: execution }, { label: "闭环结果", value: closure }, { label: "运行标识", value: activeRunId, mono: true }, ...(recoveryContext ? [{ label: recoveryLabel, value: recoveryContext, mono: true }] : []), { label: "当前服务", value: runState === "ready" ? assetVersion : hasRunEvidence ? `${pcPriorTrustedVersion(scenario)} 继续服务` : "尚未创建本次运行" }, { label: "登记至发布", value: runState === "ready" || runState === "refresh-failed" ? "目标内" : "未完成" }, { label: "发布至刷新结果", value: runState === "ready" ? "目标内" : runState === "refresh-failed" ? "按时返回不兼容" : "未开始" }]} /><div className="p-inline-actions modal-section-gap">{hasRunEvidence ? <PrototypeButton size="sm" icon="History" onClick={() => onNavigate("run-detail", { runId: activeRunId, scenarioKey: scenario.key, retryFrom: recoveryContext || undefined })}>完整运行详情</PrototypeButton> : null}<PrototypeButton size="sm" icon="List" onClick={() => onNavigate("runs")}>全部运行</PrototypeButton>{["ready", "refresh-failed"].includes(runState) ? <PrototypeButton size="sm" variant="primary" icon="Package" onClick={() => onNavigate("asset-detail", { versionId: assetVersion, scenarioKey: scenario.key, initialView: runState === "refresh-failed" ? "refresh" : "overview" })}>打开资产证据</PrototypeButton> : null}</div></div></div> : null}
      {tab === "quality" ? !(selected && selected.key === "quality" && formalQualityAvailable) ? <PrototypeEmpty icon="ShieldQuestion" title="当前没有可展示的正式质量结果" description={!selected || selected.key !== "quality" ? "选择数据检查节点后查看与该节点对应的 T005。" : "正式运行到达质量门后才会形成 T005；预览和样例调试不计入。"} /> : <><div className="pc-quality-summary"><div className="pc-quality-stat"><span>正式检查</span><strong>8</strong></div><div className="pc-quality-stat"><span>硬失败</span><strong>{scenario.key === "C" ? "1" : "0"}</strong></div><div className="pc-quality-stat"><span>警告</span><strong>3</strong></div><div className="pc-quality-stat"><span>总体结论</span><strong>{scenario.key === "C" ? "失败" : "有警告"}</strong></div></div><PrototypeAlert tone={scenario.key === "C" ? "failed" : "warning"} title={scenario.key === "C" ? "产业板块有效值硬阻断，不能忽略" : "硬门通过，但 3 项可选字段缺失需要人工确认"} actions={runState === "waiting" ? <PrototypeButton size="sm" variant="warning" onClick={onWarning}>处理质量警告</PrototypeButton> : runState === "hard-failed" ? <PrototypeButton size="sm" variant="danger" onClick={onRetry}>从失败处创建重试</PrototypeButton> : null}>{scenario.key === "C" ? "旧名称“新能源控股”未进入 D007 有效板块，候选未发布。修正来源或 Python 输入后新建关联运行。" : `缺失数为 212 / 212 / ${guaranteeMissing}；继续或结束都会保存理由和证据。`}</PrototypeAlert><div className="modal-section-gap"><PrototypeTable columns={[{ key: "name", label: "检查项", width: "22%" }, { key: "group", label: "分组", width: "13%" }, { key: "level", label: "门禁", width: "11%" }, { key: "result", label: "结果", width: "10%", render: (row) => <PrototypeStatus tone={pcTone(row.result)} compact>{row.result}</PrototypeStatus> }, { key: "affected", label: "影响行", align: "right", width: "9%" }, { key: "actual", label: "实际", width: "18%" }, { key: "recovery", label: "恢复方式", width: "17%" }]} rows={qualityRows} rowKey="name" /></div></> : null}
    </div>
  </section>;
}

function PrototypeCanvasDrawer({ historical, locked, lockReason, node, scenario, assetVersion, repairActive, routeState, runState, nodeState, formalQualityAvailable, sourceId, setSourceId, snapshotId, boundT008, setSnapshotId, scriptVersion, setScriptVersion, detailSheet, setDetailSheet, detailHeader, setDetailHeader, ownerSheet, setOwnerSheet, ownerHeader, setOwnerHeader, missingLabel, setMissingLabel, versionNote, setVersionNote, onClose, onNavigate, onPreview, onDebug, onResetPython, onOpenQuality, onOpenRun, canDelete, onDelete }) {
  const members = PROTOTYPE_MEMBERS;
  const sourceTarget = sourceId === "SRC-FIN-FOLDER-001" ? "source-folder" : "source-manual";
  const published = ["refresh-failed", "ready"].includes(runState);
  const refreshPending = runState === "publishing";
  const t007State = published ? assetVersion : refreshPending ? "发布中，尚未分配" : "未形成";
  const refreshRequestState = published ? (runState === "refresh-failed" ? "已发出 · 返回不兼容" : "已发出 · 返回成功") : refreshPending ? "等待发布完成后发出" : "未发出";
  const t018State = runState === "ready" ? "已形成" : runState === "refresh-failed" ? "未形成 · 刷新结果不兼容" : refreshPending ? "尚未形成 · 等待刷新结果" : "未形成 · 尚未发出刷新请求";
  const t019State = runState === "ready" ? "已采用精确组合" : runState === "refresh-failed" ? `未采用当前候选 · ${pcPriorTrustedVersion(scenario)} 继续服务` : refreshPending ? "尚未发生采用判断" : "尚未发生候选采用判断";
  return <aside className="pc-drawer" aria-label={`${node.name}配置抽屉`}><header className="pc-drawer-head"><div className="pc-drawer-title"><span className="pc-drawer-mark" style={{ "--node-color": node.color }}><PrototypeIcon name={node.icon} size={14} /></span><div><h2>{node.order} · {node.name}</h2><p>{node.hint}</p></div></div><PrototypeIconButton icon="PanelRightClose" label="关闭配置抽屉" onClick={onClose} /></header><div className="pc-drawer-body">
    <div className="pc-drawer-section"><PrototypeStatus tone={nodeState.tone}>{nodeState.label}</PrototypeStatus>{locked ? <div className="modal-section-gap"><PrototypeAlert tone={historical ? "info" : "warning"} title={historical ? "历史运行上下文只读" : "本次运行已锁定配置"}>{lockReason}。仍可选择节点、查看证据、缩放和平移。</PrototypeAlert></div> : null}</div>
    {node.key === "source" ? <><section className="pc-drawer-section"><h3>已绑定真实来源</h3><div className="pc-drawer-stack"><PrototypeSelect label="来源 T001" value={sourceId} onChange={setSourceId} disabled={locked} options={[{ value: "SRC-FIN-UPLOAD-001", label: "融资工作簿手工上传" }, { value: "SRC-FIN-FOLDER-001", label: "融资共享文件夹" }]} /><PrototypeSelect label="原始快照 T002" value={snapshotId} onChange={setSnapshotId} disabled={locked} options={[{ value: scenario.snapshot, label: scenario.snapshot }, { value: "SNAP-FIN-20260630-001", label: "SNAP-FIN-20260630-001 · 历史" }]} /></div></section><section className="pc-drawer-section"><h3>只读来源证据</h3><PrototypeKeyValues columns={1} compact items={[{ label: "数据截至时间 T008", value: boundT008 }, { label: "更新语义", value: "独立完整的全量快照" }, { label: "工作簿", value: snapshotId === scenario.snapshot ? prototypeSnapshotFixture(scenario.key).file : "融资一览表_20260630.xlsx" }, { label: "目标工作表", value: "2-融资一览表明细；单位负责人映射" }]} /><div className="modal-section-gap"><PrototypeButton size="sm" icon="ExternalLink" onClick={() => onNavigate(sourceTarget, { sourceId, snapshotId })}>在来源页查看 T008 / 全量声明</PrototypeButton></div></section></> : null}
    {node.key === "python" ? <><section className="pc-drawer-section"><h3>预置脚本组件</h3><div className="pc-script-card"><strong>融资工作簿标准化 v1</strong><span>版本 {scriptVersion}</span><small>只允许选择平台预置、受控版本；没有在线代码编辑、任意脚本上传或依赖安装。</small></div><div className="modal-section-gap"><PrototypeSelect label="脚本版本" value={scriptVersion} onChange={setScriptVersion} disabled={locked} options={["1.0.0"]} /></div></section><section className="pc-drawer-section"><h3>公开参数</h3><div className="pc-drawer-stack"><PrototypeField label="融资明细工作表" value={detailSheet} onChange={setDetailSheet} readOnly={locked} /><PrototypeField label="明细表头行" type="number" value={detailHeader} onChange={setDetailHeader} readOnly={locked} /><PrototypeField label="负责人映射工作表" value={ownerSheet} onChange={setOwnerSheet} readOnly={locked} /><PrototypeField label="负责人表头行" type="number" value={ownerHeader} onChange={setOwnerHeader} readOnly={locked} /><PrototypeField label="缺失值展示标签" value={missingLabel} onChange={setMissingLabel} readOnly={locked} /></div><div className="p-inline-actions modal-section-gap"><PrototypeButton size="sm" icon="RotateCcw" disabled={locked} title={locked ? lockReason : "恢复预置默认参数"} onClick={onResetPython}>恢复默认</PrototypeButton><PrototypeButton size="sm" variant="primary" icon="Bug" disabled={locked} title={locked ? lockReason : "运行 100 行限定样例"} onClick={onDebug}>运行样例调试</PrototypeButton></div></section><section className="pc-drawer-section"><h3>固定输出</h3><p>四成员候选 + 三关系候选；机构编码使用受控 24 家名称—编码映射。</p></section></> : null}
    {node.key === "quality" ? <><section className="pc-drawer-section"><h3>固定融资检查集</h3><PrototypeKeyValues columns={1} compact items={[{ label: "检查集", value: "融资固定检查集 v1.0" }, { label: "检查总数", value: "8" }, { label: "硬阻断", value: "身份、端点、板块、数值范围" }, { label: "警告", value: "可选字段完整性与规模变化" }]} /></section><section className="pc-drawer-section"><PrototypeAlert tone={!formalQualityAvailable ? "info" : scenario.key === "C" ? "failed" : "warning"} title={!formalQualityAvailable ? "尚未形成正式质量结果" : scenario.key === "C" ? "正式质量失败" : "正式质量有警告"}>{!formalQualityAvailable ? "预览和 Python 样例调试不会生成 T005；请正式运行到达质量门。" : scenario.key === "C" ? "硬阻断没有忽略入口。" : "质量结论仍为有警告；人工确认只决定是否允许继续发布。"}</PrototypeAlert><div className="modal-section-gap"><PrototypeButton variant="primary" size="sm" icon="ShieldCheck" disabled={!formalQualityAvailable} title={formalQualityAvailable ? "打开本次正式质量结果" : "正式运行到达质量门后可查看"} onClick={onOpenQuality}>打开质量结果</PrototypeButton></div></section></> : null}
    {node.key === "publish" ? <><section className="pc-drawer-section"><h3>发布合同</h3>{repairActive ? <PrototypeAlert tone="warning" title="关联恢复上下文已建立">候选输出使用“融资负责人参考.负责人显示名”，而 T017 既有来源映射要求“负责人名称”。当前只记录核对与复验证据，不声称字段已修复或刷新会成功；内容未变化时命中既有 r3，不生成新的成功 T007，r2 继续服务。</PrototypeAlert> : null}<div className="modal-section-gap"><PrototypeField label="版本说明" value={versionNote} onChange={setVersionNote} readOnly={locked} required hint="正式运行到第四节点时自动发布，不另设独立发布按钮。" /></div><div className="modal-section-gap"><PrototypeKeyValues columns={1} compact items={[{ label: "逻辑资产 T006", value: "融资标准化数据资产" }, { label: "Owner", value: "数据工程演示账号" }, { label: "版本规则", value: "四成员、三关系原子发布；T007 不可变" }, { label: "数据截至时间", value: boundT008 }, ...(repairActive ? [{ label: "候选输出字段", value: "融资负责人参考.负责人显示名" }, { label: "T017 期望字段", value: "融资负责人参考.负责人名称" }, { label: "当前结论", value: "尚未证明兼容" }] : [])]} /></div></section><section className="pc-drawer-section"><h3>四个成员</h3><div className="pc-contract-list">{members.map((member) => <div className="pc-contract-row" key={member.key}><div><strong>{member.name}</strong><span>{member.grain} · 主键 {member.primaryKey}</span></div><PrototypeStatus compact>{member.rows.toLocaleString()} 行</PrototypeStatus></div>)}</div></section><section className="pc-drawer-section"><h3>三条关系</h3><p>明细→主体、明细→机构、主体→负责人；端点未匹配必须为 0。</p><div className="p-inline-actions modal-section-gap"><PrototypeButton size="sm" icon="TableProperties" onClick={onPreview}>查看候选预览</PrototypeButton>{published ? <PrototypeButton size="sm" icon="Package" onClick={() => onNavigate("asset-detail", { versionId: assetVersion, scenarioKey: scenario.key })}>打开已发布资产</PrototypeButton> : null}</div></section></> : null}
    {node.key === "refresh" ? <><section className="pc-drawer-section"><h3>请求目标</h3><PrototypeField label="既有本体来源映射" value="融资演示本体 · Published v1.0.0" readOnly hint="一期只选择既有精确 T017，不在数据工程中编辑本体映射。" /><div className="modal-section-gap"><PrototypeKeyValues columns={1} compact items={[{ label: "精确 T017", value: "Published v1.0.0" }, { label: "来源映射", value: "融资标准化来源映射 v1" }, { label: "T007 · 资产版本", value: t007State, mono: true }, { label: "四成员 / 三关系", value: "4 / 3" }]} /></div></section><section className="pc-drawer-section"><h3>请求与结果侧只读证据</h3><div className="pc-contract-list"><div className="pc-contract-row"><div><strong>刷新请求</strong><span>{refreshRequestState}</span></div></div><div className="pc-contract-row"><div><strong>T018 · 可消费候选</strong><span>{t018State}</span></div></div><div className="pc-contract-row"><div><strong>T019 · 权威消费绑定</strong><span>{t019State}</span></div></div></div><div className="p-inline-actions modal-section-gap"><PrototypeButton size="sm" icon="Activity" onClick={onOpenRun}>查看运行结果</PrototypeButton>{published ? <PrototypeButton size="sm" variant="primary" icon="Route" onClick={() => onNavigate("lineage", { centerId: assetVersion, scenarioKey: scenario.key })}>查看沿袭</PrototypeButton> : null}</div></section></> : null}
    {canDelete ? <section className="pc-drawer-section"><h3>草稿节点</h3><PrototypeButton size="sm" variant="danger" icon="Trash2" onClick={onDelete}>删除最后一个未运行节点</PrototypeButton></section> : null}
  </div></aside>;
}

function PrototypeCanvasModals({ scenario, snapshotId, boundT008, pipelineId, selected, confirmOpen, setConfirmOpen, onConfirm, warningOpen, setWarningOpen, warningReason, setWarningReason, onContinue, onStop, shortcutOpen, setShortcutOpen, debugOpen, setDebugOpen, debugRunning, onDebug }) {
  const guaranteeMissing = ["B", "D"].includes(scenario.key) ? "1,867" : "1,868";
  return <>
    <PrototypeModal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="确认正式运行全流程" icon="Play" width="690px" footer={<><PrototypeButton onClick={() => setConfirmOpen(false)}>取消</PrototypeButton><PrototypeButton variant="primary" icon="Play" onClick={onConfirm}>确认并运行</PrototypeButton></>}><div className="pc-modal-stack"><PrototypeAlert tone="warning" title="正式运行会锁定版本并在质量允许时产生外部副作用">运行创建后不能撤销；第四节点自动发布不可变 T007，第五节点向精确 T017 发起刷新请求。</PrototypeAlert><PrototypeKeyValues columns={2} items={[{ label: "原始快照 T002", value: snapshotId, mono: true }, { label: "数据截至时间 T008", value: boundT008 }, { label: "管道配置 T003", value: `${pipelineId} · ${pipelineId === "PIPE-FIN-DRAFT-NEW" ? "保存版本 1" : "保存版本 13"}` }, { label: "Python T004", value: "融资工作簿标准化 v1 · 1.0.0" }, { label: "发布逻辑资产 T006", value: "融资标准化数据资产" }, { label: "目标精确 T017", value: "融资演示本体 · Published v1.0.0" }, { label: "既有来源映射", value: "融资标准化来源映射 v1" }, { label: "警告规则", value: "任何警告都停待人工确认" }]} /></div></PrototypeModal>
    <PrototypeModal open={warningOpen} onClose={() => setWarningOpen(false)} title="处理正式质量警告" icon="TriangleAlert" width="710px" footer={<><PrototypeButton onClick={() => setWarningOpen(false)}>取消</PrototypeButton><PrototypeButton variant="danger" onClick={onStop}>本次不继续发布</PrototypeButton><PrototypeButton variant="primary" icon="ArrowRight" disabled={!warningReason.trim()} onClick={onContinue}>填写理由并继续</PrototypeButton></>}><div className="pc-modal-stack"><PrototypeAlert tone="warning" title="3 项警告不会自动放行">利率形式 212 条为空、期限种类 212 条为空、担保方式 {guaranteeMissing} 条为空。硬阻断均已通过。</PrototypeAlert><PrototypeKeyValues columns={2} compact items={[{ label: "候选 T008", value: boundT008 }, { label: "上一可信", value: `${pcPriorTrustedVersion(scenario)} 继续服务` }, { label: "继续的影响", value: scenario.key === "D" ? "复验当前结构；内容去重命中 r3，不生成新 T007" : "发布新 T007 并请求刷新" }, { label: "结束的影响", value: "本次未发布，释放串行队列" }]} /><PrototypeTextarea label="确认理由" value={warningReason} onChange={setWarningReason} required placeholder="例如：三个字段均为可选展示项，本次下游不依赖，允许继续发布" /></div></PrototypeModal>
    <PrototypeModal open={shortcutOpen} onClose={() => setShortcutOpen(false)} title="画布快捷键" icon="Keyboard" width="520px" footer={<PrototypeButton variant="primary" onClick={() => setShortcutOpen(false)}>关闭</PrototypeButton>}><div className="pc-shortcut-list">{[["Command / Ctrl + Z", "撤销上一次节点位置更改"], ["Command / Ctrl + S", "保存当前管道配置"], ["F", "适应窗口并保留选中节点"], ["+ / -", "放大或缩小画布"], ["Esc", "关闭当前弹层或配置抽屉"]].map(([key, copy]) => <div className="pc-shortcut-row" key={key}><kbd>{key}</kbd><span>{copy}</span></div>)}</div><p className="p-modal-copy modal-section-gap">输入框、下拉框或文本域获得焦点时，不触发画布快捷键。</p></PrototypeModal>
    <PrototypeModal open={debugOpen} onClose={() => setDebugOpen(false)} title="Python 限定样例调试" icon="Bug" width="760px" footer={<><PrototypeButton onClick={() => setDebugOpen(false)}>返回配置</PrototypeButton><PrototypeButton variant="primary" icon="Play" loading={debugRunning} onClick={onDebug}>重新运行调试</PrototypeButton></>}>{debugRunning ? <PrototypeSkeleton rows={6} /> : <div className="pc-modal-stack"><PrototypeAlert tone="success" title="样例调试完成">只处理 100 行临时样例；未执行全量正式质量门，不形成 T005、T007 或刷新请求。</PrototypeAlert><PrototypeKeyValues columns={3} compact items={[{ label: "临时标识", value: "DEBUG-FIN-20260809-001", mono: true }, { label: "样例范围", value: "融资明细前 100 行" }, { label: "耗时", value: "1.8 秒" }, { label: "输入", value: "100 行 · 35 字段" }, { label: "输出", value: "四成员候选 · 三关系候选" }, { label: "错误", value: "0" }]} /><div className="pc-debug-diff"><div className="pc-debug-pane"><strong>输入摘要</strong><pre>单位名称: 单位A\n金融机构: 银行A\n融资余额: 1250000000\n负责人: 融资负责人001</pre></div><div className="pc-debug-pane"><strong>标准化输出摘要</strong><pre>单位编码: UNIT-553\n机构编码: INST-001\n统一产业板块: 境内新能源\n负责人标识: OWNER-001</pre></div></div></div>}</PrototypeModal>
  </>;
}

Object.assign(window, { PrototypePipelineCanvasScreen });
