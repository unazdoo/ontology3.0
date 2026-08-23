function getModuleFromLocation() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const id = params.get("module");
  return MODULE_BY_ID[id] ? id : null;
}

function App() {
  const variant = document.body.dataset.variant || "a";
  const productionMode = variant === "a";
  const availableModules = productionMode ? CLASSIC_MODULES : ONTOLOGY_MODULES;
  const availableModuleById = productionMode ? CLASSIC_MODULE_BY_ID : MODULE_BY_ID;
  const [menuCollapsed, setMenuCollapsed] = React.useState(() => window.localStorage.getItem("ontology3-home-sidebar") === "collapsed");
  const [activeDomain, setActiveDomain] = React.useState("foundation");
  const [activeStep, setActiveStep] = React.useState("data");
  const [workbenchFilter, setWorkbenchFilter] = React.useState("all");
  const [expandedModules, setExpandedModules] = React.useState(() => new Set());
  const [openModuleId, setOpenModuleId] = React.useState(getModuleFromLocation);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [toast, setToast] = React.useState("");

  React.useEffect(() => {
    window.localStorage.setItem("ontology3-home-sidebar", menuCollapsed ? "collapsed" : "expanded");
  }, [menuCollapsed]);

  React.useEffect(() => {
    const syncLocation = () => setOpenModuleId(getModuleFromLocation());
    window.addEventListener("popstate", syncLocation);
    window.addEventListener("hashchange", syncLocation);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("hashchange", syncLocation);
    };
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        if (searchOpen) setSearchOpen(false);
        else if (guideOpen) setGuideOpen(false);
        else if (notificationsOpen) setNotificationsOpen(false);
        else if (openModuleId) closeModule();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, guideOpen, notificationsOpen, openModuleId]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message) => setToast(message);

  const openModule = (moduleId) => {
    if (!MODULE_BY_ID[moduleId]) return;
    setSearchOpen(false);
    setGuideOpen(false);
    setNotificationsOpen(false);
    if (getModuleFromLocation() !== moduleId) {
      window.history.pushState({ homepageDrawer: true, moduleId }, "", `#module=${encodeURIComponent(moduleId)}`);
    }
    setOpenModuleId(moduleId);
  };

  const closeModule = () => {
    if (!openModuleId) return;
    if (window.history.state?.homepageDrawer) {
      window.history.back();
    } else {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setOpenModuleId(null);
    }
  };

  const prepareModuleLocation = (moduleId) => {
    if (variant === "a") {
      const targetDomain = Object.values(CLASSIC_DOMAINS).find((domain) => domain.moduleIds.includes(moduleId));
      if (targetDomain) setActiveDomain(targetDomain.key);
    } else if (variant === "b") {
      setWorkbenchFilter("all");
    } else {
      const targetStep = LOOP_STEPS.find((step) => step.moduleIds.includes(moduleId));
      if (targetStep) setActiveStep(targetStep.id);
    }
  };

  const locateModule = (moduleId) => {
    prepareModuleLocation(moduleId);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setOpenModuleId(null);
    showToast(`已在首页定位：${MODULE_BY_ID[moduleId].name}`);
    window.setTimeout(() => {
      const target = document.querySelector(`[data-module-id="${moduleId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 120);
  };

  const toggleModule = (moduleId) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleCapability = (capability) => showToast(`已定位能力：${capability}`);
  const handleDrawerCapability = (moduleName, capability) => showToast(`${moduleName} · ${capability}`);

  let homeContent = null;
  if (variant === "a") {
    homeContent = <ClassicHome activeDomain={activeDomain} onDomain={setActiveDomain} expanded={expandedModules} onToggle={toggleModule} onOpenModule={openModule} onCapability={handleCapability}/>;
  } else if (variant === "b") {
    homeContent = <WorkbenchHome filter={workbenchFilter} onFilter={setWorkbenchFilter} expanded={expandedModules} onToggle={toggleModule} onOpenModule={openModule} onCapability={handleCapability}/>;
  } else {
    homeContent = <LoopHome activeStep={activeStep} onStep={setActiveStep} expanded={expandedModules} onToggle={toggleModule} onOpenModule={openModule} onCapability={handleCapability}/>;
  }

  return (
    <div className={`prototype-root${productionMode ? " production-home" : ""}`}>
      <a className="skip-link" href="#homepage-stage">跳到首页内容</a>
      {!productionMode && <div className="demo-banner" role="status">
        <b>Ontology 3.0 · 首页评审原型</b>
        <span>六模块入口 · 中性状态 · 三套方案</span>
        <span className="banner-truth">静态交互演示 · 不连接后台，不生成真实运行、发布或消费结果</span>
      </div>}
      <div className={`app-shell${menuCollapsed ? " menu-collapsed" : ""}`}>
        <Sidebar collapsed={menuCollapsed} onToggle={() => setMenuCollapsed((value) => !value)} onOpenModule={openModule} onOpenGuide={() => setGuideOpen(true)} onOpenSearch={() => setSearchOpen(true)} modules={availableModules} productionMode={productionMode}/>
        <main className="main-area">
          <Topbar variant={variant} onOpenSearch={() => setSearchOpen(true)} onOpenNotifications={() => setNotificationsOpen((value) => !value)} productionMode={productionMode}/>
          <div className="homepage-stage" id="homepage-stage" tabIndex="-1">
            <div className={`homepage variant-${variant}`}>{homeContent}</div>
          </div>
        </main>
        {notificationsOpen && <NotificationPopover onClose={() => setNotificationsOpen(false)} productionMode={productionMode}/>}
      </div>
      {searchOpen && <SearchPalette query={searchQuery} onQuery={setSearchQuery} onClose={() => setSearchOpen(false)} onOpenModule={openModule} modules={availableModules} productionMode={productionMode}/>}
      {guideOpen && <GuideDialog onClose={() => setGuideOpen(false)} productionMode={productionMode}/>}
      {openModuleId && <ModuleDrawer module={availableModuleById[openModuleId]} onClose={closeModule} onLocate={locateModule} onCapability={handleDrawerCapability} productionMode={productionMode}/>}
      <Toast message={toast}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
