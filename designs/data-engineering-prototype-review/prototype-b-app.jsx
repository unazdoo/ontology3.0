const { useCallback, useEffect, useMemo, useState } = React;

const PROTOTYPE_VALID_SCREENS = new Set([
  "overview",
  "sources",
  "source-manual",
  "source-folder",
  "source-s003",
  "pipelines",
  "canvas",
  "runs",
  "run-detail",
  "assets",
  "asset-detail",
  "lineage",
]);

function prototypeFlowForScenario(key) {
  return {
    uploadRegistered: key !== "A",
    qualityConfirmed: key === "B" || key === "D",
    published: key === "B" || key === "D",
    refreshed: key === "B",
    priorAReady: key === "B" || key === "C" || key === "D",
    canvasRunState: key === "B" ? "ready" : key === "C" ? "hard-failed" : key === "D" ? "refresh-failed" : "idle",
    canvasTrialEndKey: "quality",
  };
}

function PrototypeToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const icon = toast.tone === "success" ? "CircleCheck" : toast.tone === "warning" ? "TriangleAlert" : toast.tone === "failed" ? "CircleX" : "Info";
  return (
    <button type="button" className={`prototype-toast ${toast.tone || "info"}`} onClick={onClose} title="关闭提示" aria-label={`${toast.message}，点击关闭`}>
      <PrototypeIcon name={icon} size={16} />
      <span>{toast.message}</span>
      <PrototypeIcon name="X" size={13} />
    </button>
  );
}

function PrototypeRail({ onReviewInfo, onReset, onNavigate }) {
  return (
    <aside className="app-rail" aria-label="平台模块栏">
      <div className="app-rail-logo" title="Ontology 3.0"><PrototypeIcon name="Orbit" size={18} /></div>
      <button type="button" className="active" title="返回数据工程总览" aria-label="返回数据工程总览" onClick={() => onNavigate("overview")}><PrototypeIcon name="Workflow" size={18} /></button>
      <div className="app-rail-spacer"></div>
      <button type="button" onClick={onReviewInfo} title="原型评审说明" aria-label="原型评审说明"><PrototypeIcon name="Info" size={17} /></button>
      <button type="button" onClick={onReset} title="重置原型状态" aria-label="重置原型状态"><PrototypeIcon name="RotateCcw" size={17} /></button>
    </aside>
  );
}

function PrototypeProductNav({ screen, onNavigate }) {
  const parent = screen.startsWith("source-") ? "sources"
    : screen === "canvas" ? "pipelines"
      : screen === "run-detail" ? "runs"
        : screen === "asset-detail" ? "assets"
          : screen;
  return (
    <nav className="product-nav" aria-label="数据工程导航">
      <div className="product-nav-head">
        <span><PrototypeIcon name="Workflow" size={16} /></span>
        <div><strong>数据工程</strong><small>来源 · 处理 · 质量 · 发布 · 刷新</small></div>
      </div>
      <div className="product-nav-list">
        <div className="product-nav-label">工作区</div>
        {PROTOTYPE_NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`product-nav-item ${parent === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <PrototypeIcon name={item.icon} size={15} />
            <span>{item.label}</span>
            <span className="nav-screen-id">{item.screen}</span>
          </button>
        ))}
      </div>
      <div className="product-nav-foot">
        <strong>一期演示边界</strong><br />
        S001：两种真实来源 · 五节点管道<br />
        S003：仅兼容性事实与证据
      </div>
    </nav>
  );
}

function PrototypeTopbar({ screen }) {
  const title = PROTOTYPE_SCREEN_TITLES[screen] || "数据工程";
  const parent = screen.startsWith("source-") ? "数据源"
    : screen === "canvas" ? "数据管道"
      : screen === "run-detail" ? "运行历史"
        : screen === "asset-detail" ? "数据资产"
          : "数据工程";
  return (
    <header className="app-topbar">
      <div className="app-breadcrumb" aria-label="面包屑">
        <span>Ontology 3.0</span><PrototypeIcon name="ChevronRight" size={12} />
        {parent !== "数据工程" ? <><span>{parent}</span><PrototypeIcon name="ChevronRight" size={12} /></> : null}
        <strong>{title}</strong>
      </div>
      <div className="app-account" title="一期默认单账号，无角色切换">
        <span>数</span>
        <div><strong>数据工程演示账号</strong><small>单账号评审</small></div>
      </div>
    </header>
  );
}

function PrototypeScenarioBar({ screen, scenarioKey, onChange, onReset }) {
  if (screen === "source-s003") {
    return (
      <section className="review-scenario-bar s003-review-context-bar" aria-label="S003 兼容性验证范围">
        <div className="review-scenario-copy">
          <strong>D051 · S003 兼容性验证</strong>
          <span>只读展示真实工作簿核验事实；不参与 S001 A–D 运行夹具，尚未运行且不可消费。</span>
        </div>
        <PrototypeStatus tone="neutral">不进入本体刷新</PrototypeStatus>
      </section>
    );
  }
  const scenario = PROTOTYPE_SCENARIOS[scenarioKey];
  return (
    <section className="review-scenario-bar" aria-label="原型评审场景控制器">
      <div className="review-scenario-copy">
        <strong>仅用于原型评审 · 标识非正式编号合同</strong>
        <span>{scenario.description}。所有交互为确定性评审模拟，不声称后端已经执行。</span>
      </div>
      <div className="review-scenario-controls">
        <label className="review-scenario-label">
          <span>场景</span>
          <select value={scenarioKey} onChange={(event) => onChange(event.target.value)} aria-label="切换评审场景">
            {Object.values(PROTOTYPE_SCENARIOS).map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}
          </select>
        </label>
        <PrototypeIconButton icon="RotateCcw" label="恢复主演示场景" onClick={onReset} />
      </div>
    </section>
  );
}

function PrototypeReviewInfo({ open, onClose }) {
  return (
    <PrototypeModal
      open={open}
      onClose={onClose}
      title="方案 B 原型评审说明"
      icon="Info"
      width="650px"
      footer={<PrototypeButton variant="primary" onClick={onClose}>知道了</PrototypeButton>}
    >
      <PrototypeAlert tone="info" title="这是高保真交互原型，不是已连接后端的生产系统">
        A–D 控制器只用于 S001 稳定重放成功、质量硬失败和刷新不兼容证据；S003 详情只展示真实文件核验事实与待运行证据，不参与该控制器。
      </PrototypeAlert>
      <div className="review-info-grid">
        <div><strong>一期真实闭环</strong><p>来源登记 → Python 标准化 → 数据检查 → 发布不可变数据资产版本 → 请求本体刷新 → 权威采用后消费就绪。</p></div>
        <div><strong>严格边界</strong><p>数据工程不编辑本体资源，也不直接把工作簿或四成员明细交给智能问数、报告中心或 Agent。</p></div>
        <div><strong>可信回退</strong><p>候选失败、刷新不兼容或 T019 未采用时，上一可信版本继续服务，并保留完整追溯证据。</p></div>
        <div><strong>评审提示</strong><p>所有可见动作均可点击；页签、筛选、弹层、画布缩放和恢复路径都可连续操作。</p></div>
      </div>
    </PrototypeModal>
  );
}

function PrototypeScreenRouter({ screen, scenarioKey, routeContext, sourceResources, onNavigate, onToast, onFlowChange, onSourceResourceChange }) {
  const scenario = PROTOTYPE_SCENARIOS[scenarioKey];
  const common = { scenario, scenarioKey, flowState: routeContext, sourceResources, onNavigate, onToast, onFlowChange, onSourceResourceChange };
  switch (screen) {
    case "overview": return <SourceOverviewScreen {...common} />;
    case "sources": return <SourceDirectoryScreen {...common} />;
    case "source-manual": return <ManualSourceScreen {...common} routeState={routeContext} initialOpenUpload={Boolean(routeContext.openUpload)} />;
    case "source-folder": return <FolderSourceScreen {...common} routeState={routeContext} />;
    case "source-s003": return <S003CompatibilityScreen {...common} />;
    case "pipelines": return <PipelineDirectoryScreen {...common} />;
    case "canvas": return <PrototypePipelineCanvasScreen {...common} routeState={routeContext} />;
    case "runs": return <PrototypeRunsScreen {...common} />;
    case "run-detail": return <PrototypeRunDetailScreen {...common} runId={routeContext.runId || scenario.run} initialTab={routeContext.initialTab || routeContext.tab || "summary"} />;
    case "assets": return <PrototypeAssetsScreen {...common} />;
    case "asset-detail": return <PrototypeAssetDetailScreen {...common} versionId={routeContext.versionId} initialView={routeContext.initialView || routeContext.tab || "overview"} />;
    case "lineage": return <PrototypeLineageScreen {...common} centerId={routeContext.centerId} lineageMode={routeContext.lineageMode} />;
    default: return <SourceOverviewScreen {...common} />;
  }
}

function PrototypeApp() {
  const initialHash = window.location.hash.replace(/^#\/?/, "");
  const [screen, setScreen] = useState(PROTOTYPE_VALID_SCREENS.has(initialHash) ? initialHash : "overview");
  const [scenarioKey, setScenarioKey] = useState("A");
  const [routeContext, setRouteContext] = useState({});
  const [flowState, setFlowState] = useState({ uploadRegistered: false, qualityConfirmed: false, published: false, refreshed: false, priorAReady: false, canvasRunState: "idle", canvasTrialEndKey: "quality" });
  const [sourceResources, setSourceResources] = useState([]);
  const [reviewInfoOpen, setReviewInfoOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, tone = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const navigate = useCallback((nextScreen, payload = {}) => {
    if (!PROTOTYPE_VALID_SCREENS.has(nextScreen)) return;
    if (payload.scenarioKey && PROTOTYPE_SCENARIOS[payload.scenarioKey] && payload.scenarioKey !== scenarioKey) {
      setScenarioKey(payload.scenarioKey);
      const nextFlow = prototypeFlowForScenario(payload.scenarioKey);
      setFlowState(payload.scenarioKey === "A" && payload.resolvedReady ? { ...nextFlow, uploadRegistered: true, qualityConfirmed: true, published: true, refreshed: true, canvasRunState: "ready" } : nextFlow);
    } else if (payload.scenarioKey === "A" && payload.resolvedReady) {
      const nextFlow = prototypeFlowForScenario("A");
      setFlowState({ ...nextFlow, uploadRegistered: true, qualityConfirmed: true, published: true, refreshed: true, canvasRunState: "ready" });
    }
    setScreen(nextScreen);
    setRouteContext(payload || {});
    window.history.pushState({ screen: nextScreen, payload }, "", `#${nextScreen}`);
  }, [scenarioKey]);

  useEffect(() => {
    if (!window.history.state || !window.history.state.screen) {
      window.history.replaceState({ screen, payload: routeContext }, "", `#${screen}`);
    }
    const onPopState = (event) => {
      const next = event.state && event.state.screen;
      if (!PROTOTYPE_VALID_SCREENS.has(next)) return;
      const payload = event.state.payload || {};
      if (payload.scenarioKey && PROTOTYPE_SCENARIOS[payload.scenarioKey]) {
        setScenarioKey(payload.scenarioKey);
        const nextFlow = prototypeFlowForScenario(payload.scenarioKey);
        setFlowState(payload.scenarioKey === "A" && payload.resolvedReady ? { ...nextFlow, uploadRegistered: true, qualityConfirmed: true, published: true, refreshed: true, canvasRunState: "ready" } : nextFlow);
      }
      setScreen(next);
      setRouteContext(payload);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const stage = document.getElementById("prototype-screen-stage");
    if (stage) stage.scrollTo({ top: 0, left: 0 });
  }, [screen]);

  const changeScenario = useCallback((next) => {
    setScenarioKey(next);
    setRouteContext({});
    setFlowState(prototypeFlowForScenario(next));
    showToast(`已切换到${PROTOTYPE_SCENARIOS[next].name}，页面状态已按评审夹具重放`, "info");
  }, [showToast]);

  const resetPrototype = useCallback(() => {
    setScenarioKey("A");
    setRouteContext({});
    setFlowState({ uploadRegistered: false, qualityConfirmed: false, published: false, refreshed: false, priorAReady: false, canvasRunState: "idle", canvasTrialEndKey: "quality" });
    setSourceResources([]);
    navigate("overview");
    showToast("已恢复主演示场景和起始页面", "success");
  }, [navigate, showToast]);

  const mergeFlowState = useCallback((patch) => {
    setFlowState((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));
  }, []);

  const mergeSourceResource = useCallback((resource) => {
    if (!resource || !resource.id) return;
    setSourceResources((current) => {
      const existing = current.find((item) => item.id === resource.id);
      return existing
        ? current.map((item) => item.id === resource.id ? { ...item, ...resource } : item)
        : [...current, resource];
    });
  }, []);

  const routerContext = useMemo(() => ({ ...routeContext, ...flowState }), [routeContext, flowState]);

  return (
    <div className="prototype-app" data-prototype-direction="B">
      <PrototypeRail onReviewInfo={() => setReviewInfoOpen(true)} onReset={resetPrototype} onNavigate={navigate} />
      <PrototypeProductNav screen={screen} onNavigate={navigate} />
      <main className="app-workspace">
        <PrototypeTopbar screen={screen} />
        <PrototypeScenarioBar screen={screen} scenarioKey={scenarioKey} onChange={changeScenario} onReset={resetPrototype} />
        <div className="screen-stage" id="prototype-screen-stage">
          <PrototypeScreenRouter
            screen={screen}
            scenarioKey={scenarioKey}
            routeContext={routerContext}
            sourceResources={sourceResources}
            onNavigate={navigate}
            onToast={showToast}
            onFlowChange={mergeFlowState}
            onSourceResourceChange={mergeSourceResource}
          />
        </div>
      </main>
      <PrototypeReviewInfo open={reviewInfoOpen} onClose={() => setReviewInfoOpen(false)} />
      <PrototypeToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PrototypeApp />);
