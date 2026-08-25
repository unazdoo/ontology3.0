function StatusChip({ module, small = false }) {
  return <span className={`status-chip ${module.statusTone}${small ? " small" : ""}`}><span className="status-dot"></span>{module.status}</span>;
}

function CapabilityTags({ module, expanded = false, interactive = false, onCapability }) {
  const shown = expanded ? module.capabilities : module.capabilities.slice(0, 4);
  const remaining = module.capabilities.length - shown.length;
  return (
    <div className="capability-tags" aria-label={`${module.name}能力`}>
      {shown.map((capability) => interactive ? (
        <button type="button" key={capability} onClick={(event) => { event.stopPropagation(); onCapability?.(capability); }}>{capability}</button>
      ) : <span key={capability}>{capability}</span>)}
      {remaining > 0 && <span className="tag-more">+{remaining}</span>}
    </div>
  );
}

function ModuleCard({ module, expanded, onToggle, onOpen, highlighted = false, dimmed = false, layout = "default", onCapability, productionMode = false }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(module.id);
    }
  };
  return (
    <article
      className={`module-card module-card-${layout}${highlighted ? " highlighted" : ""}${dimmed ? " dimmed" : ""}`}
      tabIndex="0"
      onKeyDown={handleKeyDown}
      onClick={() => onOpen(module.id)}
      data-module-id={module.id}
      aria-label={`打开${module.name}入口概览`}
    >
      <div className="module-card-top">
        <div className="module-icon"><Icon name={module.icon} size={19}/></div>
        <div className="module-card-title"><span>{module.code}</span><b>{module.name}</b></div>
        {!productionMode && <StatusChip module={module} small/>}
      </div>
      <p>{module.summary}</p>
      <CapabilityTags module={module} expanded={expanded} interactive={Boolean(onCapability)} onCapability={onCapability}/>
      {expanded && (
        productionMode ? (
          <div className="module-expanded production-expanded">
            <span><b>运行状态</b>{module.runtime}</span>
            <span><b>查看方式</b>进入模块查看资源与记录</span>
          </div>
        ) : (
          <div className="module-expanded">
            <span><b>当前状态</b>{module.statusDetail}</span>
            <span><b>运行证据</b>{module.runtime}</span>
          </div>
        )
      )}
      <div className="module-card-actions">
        <button type="button" className="text-action" onClick={(event) => { event.stopPropagation(); onToggle(module.id); }} aria-expanded={expanded}>
          {expanded ? "收起" : "展开能力"}<Icon name="chevron" size={14}/>
        </button>
        <button type="button" className="card-open" onClick={(event) => { event.stopPropagation(); onOpen(module.id); }}>
          进入模块<Icon name="arrow" size={14}/>
        </button>
      </div>
    </article>
  );
}

function Sidebar({ collapsed, onToggle, onOpenModule, onOpenGuide, onOpenSearch, modules = ONTOLOGY_MODULES, productionMode = false }) {
  return (
    <>
      <aside className="rail" aria-label="主菜单控制栏">
        <button className="brandmark" type="button" onClick={onToggle} aria-label={collapsed ? "展开主菜单" : "收起主菜单"} title={collapsed ? "展开主菜单" : "收起主菜单"}>
          <Icon name="brand" size={19}/>
        </button>
        <button className="railnav on" type="button" aria-current="page" title="平台首页"><Icon name="home"/></button>
        {modules.map((module) => (
          <button className="railnav" type="button" key={module.id} onClick={() => onOpenModule(module.id)} title={module.name}><Icon name={module.icon}/></button>
        ))}
        <div className="railspacer"></div>
        <div className="railfoot" title={productionMode ? "用户中心" : "首页评审原型"}>AK</div>
      </aside>
      <aside className="side-menu" aria-label="平台主菜单" aria-hidden={collapsed}>
        <div className="side-head">
          <b>Ontology 3.0</b>
          <span>数据—语义—决策—行动平台</span>
          {productionMode ? <span className="envtag">统一工作台</span> : <span className="envtag">首页评审 · 无后台连接</span>}
        </div>
        <nav aria-label="平台导航">
          <div className="menu-section">开始</div>
          <button className="on" type="button"><Icon name="home" size={15}/>平台首页</button>
          <button type="button" onClick={onOpenGuide}><Icon name="info" size={15}/>使用导览</button>
          <div className="menu-section">六个模块</div>
          {modules.map((module) => (
            <button type="button" key={module.id} onClick={() => onOpenModule(module.id)}>
              <Icon name={module.icon} size={15}/>{module.name}{!productionMode && <span className={`menu-status ${module.statusTone}`}></span>}
            </button>
          ))}
        </nav>
        {productionMode ? (
          <section className="side-current" aria-labelledby="current-work-title">
            <div className="menu-section" id="current-work-title">快速开始</div>
            <button type="button" onClick={() => onOpenModule("data-engineering")}>
              <b>数据工程</b>
              <small>接入数据、配置管道与质量规则</small>
            </button>
          </section>
        ) : (
          <section className="side-current" aria-labelledby="current-work-title">
            <div className="menu-section" id="current-work-title">当前工作</div>
            <button type="button" onClick={() => onOpenModule("data-engineering")}>
              <b>S001 六模块闭环</b>
              <small>继续优先完成 · 未宣称已运行</small>
            </button>
          </section>
        )}
        <section className="side-recent" aria-labelledby="recent-title">
          <div className="menu-section" id="recent-title">最近访问</div>
          <p>{productionMode ? "暂无最近访问记录" : "暂无可核验的最近访问记录"}</p>
          <button type="button" onClick={onOpenSearch}>选择模块</button>
        </section>
        <div className="side-footer">{productionMode ? <>从首页进入模块，查看能力、运行状态和最近工作。<br/>点击左上角标可折叠 / 展开。</> : <>首页仅承载平台入口、能力概览、当前状态与继续工作。<br/>点击左上角标可折叠 / 展开。</>}</div>
      </aside>
    </>
  );
}

function Topbar({ variant, onOpenSearch, onOpenNotifications, productionMode = false }) {
  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="当前位置">
        <ol><li><span>Ontology 3.0</span></li><li><h1>平台首页</h1></li></ol>
      </nav>
      <button className="search-trigger" type="button" onClick={onOpenSearch} aria-label="搜索模块与能力">
        <Icon name="search" size={15}/><span>搜索模块 / 能力 / 继续事项</span><kbd>Ctrl K</kbd>
      </button>
      <div className="top-right">
        {!productionMode && <nav className="variant-switcher" aria-label="切换设计方案">
          {Object.entries(VARIANT_META).map(([key, meta]) => (
            <a key={key} className={variant === key ? "active" : ""} href={meta.file} aria-current={variant === key ? "page" : undefined} title={meta.name}>{key.toUpperCase()}</a>
          ))}
        </nav>}
        <button className="icon-button" type="button" onClick={onOpenNotifications} aria-label="查看状态通知"><Icon name="bell" size={16}/></button>
        {!productionMode && <span className="review-chip">{VARIANT_META[variant].name}</span>}
      </div>
    </header>
  );
}

function ClassicCoreGraphic({ domainKey, label }) {
  return (
    <div className="classic-core" data-core-state={domainKey} aria-hidden="true">
      <svg viewBox="0 0 220 150">
        <g className="core-grid"><path d="M34 112 110 137l76-25-76-25-76 25Zm19-6 57 19 57-19M72 100l38 13 38-13M34 112v8l76 25 76-25v-8M72 100v26m38-39v58m38-45v26"/></g>
        <path className="core-hud" d="M31 30v-8h9m140 0h9v8M31 104v8h9m140 0h9v-8M110 13v8m0 91v12M28 67h12m140 0h12"/>
        <polygon className="core-piece core-a" points="110,18 166,48 110,78 54,48"/>
        <polygon className="core-piece core-b" points="110,29 153,52 110,75 67,52"/>
        <polygon className="core-piece core-c" points="110,40 143,58 110,76 77,58"/>
        <rect className="core-piece core-d" x="83" y="31" width="54" height="54"/>
        <rect className="core-piece core-e" x="105" y="53" width="10" height="10"/>
        <path className="core-trace core-trace-foundation" d="M72 34H48v10H36m112-10h24v10h12M65 60H43v20H31m124-20h22v20h12M70 86H50v18H38m112-18h20v18h12M110 18v98"/>
        <path className="core-trace core-trace-intelligence" d="M46 42 76 26l30 16-30 16-30-16Zm0 0v34l30 17 30-17V42M76 58v35M114 46l30-16 30 16-30 16-30-16Zm0 0v34l30 17 30-17V46M144 62v35M106 58h8m-8 14h8"/>
        <path className="core-trace core-trace-action" d="M92 27h36l30 22M161 60v23l-36 26M110 111H91L59 88V57m51-11 25 16-25 16-25-16 25-16Z"/>
        <path className="core-scan" d="M45 29h130"/>
        <rect className="core-pulse" x="103" y="51" width="14" height="14"/>
      </svg>
      <b>ONTOLOGY 3.0</b>
      <span>{label}</span>
    </div>
  );
}

function ClassicHome({ activeDomain, onDomain, expanded, onToggle, onOpenModule, onCapability }) {
  const domain = CLASSIC_DOMAINS[activeDomain];
  const domains = Object.values(CLASSIC_DOMAINS);
  return (
    <section className="homeframe classic-frame" data-screen-label="方案 A · 经典复刻版">
      <div className="classic-visual">
        <div className="architecture-intro">
          <div><span className="architecture-label">ONTOLOGY 3.0 · 平台能力架构</span><h2>从可信数据到可追溯行动</h2></div>
          <p>数据、语义与行动在同一证据链中协作：数据形成业务定义，问数与报告支持判断，行动结果持续沉淀为可追溯记录。</p>
        </div>
        <div className="architecture-cycle" aria-label="平台三大能力域">
          <svg className="architecture-path" viewBox="0 0 640 520" aria-hidden="true">
            <defs><marker id="classic-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1.5 10.5 6 2 10.5"/></marker></defs>
            <g className="path-segment segment-1"><path className="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" markerEnd="url(#classic-arrow)"/><path className="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"/></g>
            <g className="path-segment segment-2"><path className="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" markerEnd="url(#classic-arrow)"/><path className="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"/></g>
            <g className="path-segment segment-3"><path className="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" markerEnd="url(#classic-arrow)"/><path className="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"/></g>
          </svg>
          {domains.map((item) => (
            <button key={item.key} className={`architecture-node ${item.key}${activeDomain === item.key ? " active" : ""}`} type="button" onClick={() => onDomain(item.key)} aria-pressed={activeDomain === item.key}>
              <span className="node-en">{item.en}</span><Icon name={item.icon} size={34}/><span className="node-zh">{item.zh}</span>
            </button>
          ))}
          <ClassicCoreGraphic domainKey={activeDomain} label={domain.core}/>
        </div>
        <div className="architecture-foot">
          <span><b>01 数据治理</b>数据源、数据管道、资产版本与质量。</span>
          <span><b>02 语义问数</b>已发布业务定义、可信问数、报告与证据。</span>
          <span><b>03 行动智能</b>行动请求、人工确认与受控协作。</span>
        </div>
      </div>
      <div className="classic-detail" aria-live="polite">
        <div className="detail-kicker">{domain.kicker}</div>
        <h2>{domain.title}</h2>
        <p className="detail-lead">{domain.lead}</p>
        <div className="classic-module-list">
          {domain.moduleIds.map((id) => <ModuleCard key={id} module={CLASSIC_MODULE_BY_ID[id]} expanded={expanded.has(id)} onToggle={onToggle} onOpen={onOpenModule} layout="classic" onCapability={onCapability} productionMode/>) }
        </div>
        <div className="classic-actions">
          <button className="primary-button" type="button" onClick={() => onOpenModule(domain.moduleIds[0])}>进入{CLASSIC_MODULE_BY_ID[domain.moduleIds[0]].name}<Icon name="arrow" size={15}/></button>
          <span>进入模块即可查看资源、运行记录与最近工作。</span>
          <div className="classic-pager" aria-label="切换能力域">
            {domains.map((item) => <button key={item.key} className={activeDomain === item.key ? "active" : ""} type="button" onClick={() => onDomain(item.key)} aria-label={item.zh}>{item.order}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkbenchHome({ filter, onFilter, expanded, onToggle, onOpenModule, onCapability }) {
  const visibleModules = ONTOLOGY_MODULES.filter((module) => {
    if (filter === "all") return true;
    if (filter === "conditional") return module.statusTone === "conditional";
    return module.statusTone !== "conditional";
  });
  return (
    <section className="homeframe workbench-frame" data-screen-label="方案 B · 模块工作台版">
      <div className="workbench-main">
        <div className="workbench-heading">
          <div><span className="architecture-label">ONTOLOGY 3.0 · MODULE WORKBENCH</span><h2>从这里继续平台工作</h2><p>六个模块保持清晰边界；首页只展示入口、设计状态、能力摘要和下一步。</p></div>
          <div className="workbench-filter" aria-label="筛选模块状态">
            <button className={filter === "all" ? "active" : ""} type="button" onClick={() => onFilter("all")}>全部模块</button>
            <button className={filter === "review" ? "active" : ""} type="button" onClick={() => onFilter("review")}>待评审</button>
            <button className={filter === "conditional" ? "active" : ""} type="button" onClick={() => onFilter("conditional")}>条件评审</button>
          </div>
        </div>
        <div className="module-grid">
          {visibleModules.map((module) => <ModuleCard key={module.id} module={module} expanded={expanded.has(module.id)} onToggle={onToggle} onOpen={onOpenModule} layout="workbench" onCapability={onCapability}/>) }
        </div>
      </div>
      <aside className="continue-panel" aria-label="当前工作与继续事项">
        <div className="panel-kicker">CURRENT WORK</div>
        <h2>当前工作</h2>
        <button className="current-focus" type="button" onClick={() => onOpenModule("data-engineering")}>
          <span>平台当前活动</span><b>继续优先完成 S001 六模块闭环</b><small>不以首页卡片代替真实运行或联调证据</small><Icon name="arrow" size={16}/>
        </button>
        <div className="continue-section">
          <div className="section-title"><span>待继续事项</span><span>按总控状态</span></div>
          <div className="continue-list">
            {ONTOLOGY_MODULES.map((module) => (
              <button type="button" key={module.id} onClick={() => onOpenModule(module.id)}>
                <span className={`continue-mark ${module.statusTone}`}></span><span><b>{module.name}</b><small>{module.continueText}</small></span><Icon name="chevron" size={14}/>
              </button>
            ))}
          </div>
        </div>
        <div className="continue-section recent-empty">
          <div className="section-title"><span>最近工作</span><span>浏览记录</span></div>
          <Icon name="history" size={20}/><b>暂无可核验记录</b><p>原型不会编造最近访问、成功运行或发布数量。</p>
        </div>
        <div className="status-legend"><span><i className="focus"></i>评审优先</span><span><i className="review"></i>待评审</span><span><i className="conditional"></i>可条件评审</span></div>
      </aside>
    </section>
  );
}

function LoopHome({ activeStep, onStep, expanded, onToggle, onOpenModule, onCapability }) {
  const active = LOOP_STEPS.find((step) => step.id === activeStep) || LOOP_STEPS[0];
  const activeIds = new Set(active.moduleIds);
  return (
    <section className="homeframe loop-frame" data-screen-label="方案 C · 业务闭环版">
      <div className="loop-story">
        <div className="architecture-label">ONTOLOGY 3.0 · BUSINESS LOOP</div>
        <h2>数据—语义—决策—行动</h2>
        <p className="loop-lead">六个模块沿同一条证据链协作：每一步只拥有自己的资源与状态，任何结果都能回到生成它的版本和证据。</p>
        <div className="loop-steps" aria-label="业务闭环主链">
          <span className="loop-line" aria-hidden="true"><i></i></span>
          {LOOP_STEPS.map((step) => (
            <button type="button" key={step.id} className={`loop-step ${activeStep === step.id ? "active" : ""}`} onClick={() => onStep(step.id)} aria-pressed={activeStep === step.id}>
              <span className="loop-index">{step.order}</span>
              <span className="loop-copy"><span>{step.en}</span><b>{step.name}</b><small>{step.title}</small></span>
              <Icon name="chevron" size={16}/>
            </button>
          ))}
        </div>
        <div className="loop-active-detail" aria-live="polite">
          <span>{active.name}阶段</span><h3>{active.title}</h3><p>{active.description}</p>
          <div>{active.moduleIds.map((id) => <button type="button" key={id} onClick={() => onOpenModule(id)}>{MODULE_BY_ID[id].name}<Icon name="arrow" size={13}/></button>)}</div>
        </div>
        <div className="evidence-return"><span className="return-arrow"><Icon name="back" size={17}/></span><div><b>证据回流</b><p>报告核验、决策结果与 Agent 运行只追加追溯，不回写或伪造上游成功状态。</p></div></div>
      </div>
      <div className="loop-map">
        <div className="loop-map-heading"><div><span className="panel-kicker">SIX MODULES</span><h2>六模块职责对照</h2></div><span>当前聚焦：{active.name}</span></div>
        <div className="loop-module-grid">
          {ONTOLOGY_MODULES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              expanded={expanded.has(module.id)}
              onToggle={onToggle}
              onOpen={onOpenModule}
              layout="loop"
              highlighted={activeIds.has(module.id)}
              dimmed={!activeIds.has(module.id)}
              onCapability={onCapability}
            />
          ))}
        </div>
        <div className="loop-legend"><span><i className="line-data"></i>数据</span><span><i className="line-semantics"></i>语义</span><span><i className="line-decision"></i>决策</span><span><i className="line-action"></i>行动</span><p>点击左侧阶段聚焦对应模块；点击任一模块查看入口与边界。</p></div>
      </div>
    </section>
  );
}

function SearchPalette({ query, onQuery, onClose, onOpenModule, modules = ONTOLOGY_MODULES, productionMode = false }) {
  const normalized = query.trim().toLowerCase();
  const results = modules.filter((module) => {
    const searchable = productionMode
      ? [module.name, module.summary, ...module.capabilities]
      : [module.name, module.en, module.summary, module.status, ...module.capabilities];
    return !normalized || searchable.join(" ").toLowerCase().includes(normalized);
  });
  return (
    <div className="overlay palette-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="搜索模块与能力">
        <label><Icon name="search" size={18}/><input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} placeholder="输入模块、能力或状态"/><kbd>Esc</kbd></label>
        <div className="palette-results">
          {results.map((module) => (
            <button type="button" key={module.id} onClick={() => onOpenModule(module.id)}>
              <span className="module-icon"><Icon name={module.icon} size={18}/></span><span><b>{module.name}</b><small>{module.capabilities.join(" · ")}</small></span>{!productionMode && <StatusChip module={module} small/>}<Icon name="arrow" size={15}/>
            </button>
          ))}
          {results.length === 0 && <div className="palette-empty"><b>没有匹配项</b><span>{productionMode ? "可搜索“发布态”“行动请求”“报告助手”等能力。" : "可搜索“Published”“Action Request”“报告助手”等能力。"}</span></div>}
        </div>
        <footer><span>↑↓ 浏览</span><span>Enter 打开</span><span>Esc 关闭</span></footer>
      </section>
    </div>
  );
}

function ModuleDrawer({ module, onClose, onLocate, onCapability, productionMode = false }) {
  const [selectedCapability, setSelectedCapability] = React.useState(module.capabilities[0]);
  React.useEffect(() => setSelectedCapability(module.capabilities[0]), [module.id]);
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="module-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-toolbar"><button type="button" onClick={onClose}><Icon name="back" size={16}/>返回首页</button><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><Icon name="close" size={17}/></button></div>
        <div className="drawer-head"><div className="drawer-icon"><Icon name={module.icon} size={28}/></div><div><span>{productionMode ? `${module.code} · 平台模块` : `${module.code} · ${module.en}`}</span><h2 id="drawer-title">{module.name}</h2></div></div>
        {!productionMode && <StatusChip module={module}/>} 
        <p className="drawer-summary">{module.summary}</p>
        {productionMode ? (
          <section className="drawer-status production-drawer-status"><div><span>运行状态</span><b>{module.runtime}</b><p>进入模块后可查看资源、运行记录和最新工作。</p></div></section>
        ) : (
          <section className="drawer-status"><div><span>设计状态</span><b>{module.status}</b><p>{module.statusDetail}</p></div><div><span>运行证据</span><b>{module.runtime}</b><p>首页不会用演示数字或静态成功记录替代真实运行。</p></div></section>
        )}
        <section className="drawer-section"><h3>{productionMode ? "模块能力" : "首页能力概览"}</h3><div className="drawer-capabilities">{module.capabilities.map((capability) => <button className={selectedCapability === capability ? "active" : ""} type="button" key={capability} onClick={() => { setSelectedCapability(capability); onCapability?.(module.name, capability); }}>{capability}</button>)}</div><div className="capability-focus"><span>当前选择</span><b>{selectedCapability}</b><p>{productionMode ? "进入模块后查看相关资源与操作记录。" : "此处只验证首页入口与能力定位，不展开模块内部工作台。"}</p></div></section>
        <section className="drawer-section boundary-grid"><div><span>本模块拥有</span><p>{module.owns}</p></div><div><span>明确边界</span><p>{module.boundary}</p></div></section>
        <div className="drawer-footer"><button className="primary-button" type="button" onClick={() => onLocate(module.id)}>在首页定位<Icon name="expand" size={15}/></button><span>{productionMode ? "返回首页可继续选择其他模块。" : "本评审原型仅创建首页。"}</span></div>
      </aside>
    </div>
  );
}

function GuideDialog({ onClose, productionMode = false }) {
  return (
    <div className="overlay palette-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="drawer-toolbar"><span>首页使用导览</span><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><Icon name="close" size={17}/></button></div>
        {productionMode ? (
          <div className="guide-content"><span className="panel-kicker">使用导览</span><h2 id="guide-title">首页可以帮助你</h2><div className="guide-grid"><span><b>01 进入模块</b>从侧栏、模块卡片或搜索进入六个模块。</span><span><b>02 查看能力</b>了解每个模块负责的资源、操作和边界。</span><span><b>03 掌握状态</b>查看模块运行状态、通知和最近工作。</span><span><b>04 继续工作</b>从首页快速回到需要处理的模块。</span></div><p>点击模块卡片查看入口概览；按浏览器返回键或“返回首页”恢复原位置。</p><button className="primary-button" type="button" onClick={onClose}>开始使用</button></div>
        ) : (
          <div className="guide-content"><span className="panel-kicker">QUICK GUIDE</span><h2 id="guide-title">首页只做四件事</h2><div className="guide-grid"><span><b>01 平台入口</b>从侧栏、模块卡片或搜索进入六个模块。</span><span><b>02 能力概览</b>查看每个模块负责什么，以及明确不负责什么。</span><span><b>03 当前状态</b>只展示总控台账中的设计状态，不伪造运行成功。</span><span><b>04 继续工作</b>定位 S001 当前工作与各模块下一步。</span></div><p>点击模块卡片会打开首页级入口概览；按浏览器返回键或“返回首页”恢复原位置。顶部 A / B / C 可切换三套方案。</p><button className="primary-button" type="button" onClick={onClose}>开始评审</button></div>
        )}
      </section>
    </div>
  );
}

function NotificationPopover({ onClose, productionMode = false }) {
  return (
    <div className="notification-popover" role="dialog" aria-label="状态通知">
      <div><b>状态通知</b><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><Icon name="close" size={15}/></button></div>
      <span className="notification-empty"><Icon name="bell" size={20}/><b>{productionMode ? "暂无运行通知" : "暂无真实运行通知"}</b><p>{productionMode ? "模块运行、发布和质量状态将在这里汇总。" : "评审原型不会生成成功、发布或消费就绪消息。"}</p></span>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast" role="status"><Icon name="check" size={15}/><span>{message}</span></div>;
}

Object.assign(window, {
  StatusChip,
  ModuleCard,
  Sidebar,
  Topbar,
  ClassicHome,
  WorkbenchHome,
  LoopHome,
  SearchPalette,
  ModuleDrawer,
  GuideDialog,
  NotificationPopover,
  Toast
});
