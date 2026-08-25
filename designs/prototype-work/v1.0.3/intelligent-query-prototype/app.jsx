const {
  Icon, Button, IconButton, StatusBadge, EmptyState, Notice, Fact, Panel,
  Segmented, Modal, Drawer, Toast, ProgressSteps, MetricCards, BarChart,
  DonutChart, StackedChart, ChartTypeMenu
} = window;

const QUERY_STEPS = ["理解问题", "核对上下文", "执行语义查询", "核验证据", "生成回答"];
const ROUTES = {
  q1: { label: "问数工作台", icon: "MessageSquareText" },
  q3: { label: "语义资源", icon: "LibraryBig" },
  q4: { label: "历史会话", icon: "History" },
  q5: { label: "问数视图", icon: "PanelsTopLeft" },
  q6: { label: "Agent 配置", icon: "Bot" }
};

function nowText() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(new Date()).replaceAll("/", "-");
}

function safeState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IQ_STORAGE_KEY));
    return parsed && parsed.schemaVersion === 1 ? parsed : iqInitialState();
  } catch (_) {
    return iqInitialState();
  }
}

function routeFromHash() {
  const match = window.location.hash.match(/^#\/(q[13456])/);
  return match?.[1] || "q1";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function statusTone(status) {
  if (["成功", "已启用", "已发布", "可消费", "可计算", "真实零值", "已接收"].includes(status)) return "success";
  if (["处理中", "刷新中", "待验证", "待启用", "已保存"].includes(status)) return "info";
  if (["失败", "阻断", "不可消费"].includes(status)) return "danger";
  if (["陈旧", "命中", "存在警告", "上一可信版本服务中"].includes(status) || String(status).startsWith("优先级")) return "warning";
  return "neutral";
}

function stateNeedsFailure(dataCheck) {
  return dataCheck.status !== "failed";
}

function App() {
  const [workspace, setWorkspace] = useState(safeState);
  const [route, setRoute] = useState(routeFromHash);
  const [toast, setToast] = useState(null);
  const [dataModal, setDataModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(IQ_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/q1";
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (next) => { window.location.hash = `#/${next}`; };
  const notify = (message, tone = "success") => setToast({ message, tone });
  const currentRun = workspace.runs.find((run) => run.id === workspace.currentRunId) || null;

  const resetAll = () => {
    localStorage.removeItem(IQ_STORAGE_KEY);
    setWorkspace(iqInitialState());
    setResetModal(false);
    window.location.hash = "#/q1";
    notify("工作区已恢复为初始状态");
  };

  const beginDataCheck = () => {
    if (workspace.dataCheck.status === "checking") return;
    const attempt = workspace.dataCheck.attempt + 1;
    const suffix = String(Date.now()).slice(-6);
    const hasCurrent = Boolean(workspace.dataCheck.currentVersion);
    const candidateVersion = workspace.dataCheck.candidateVersion || `DV-FIN-CAND-${suffix}`;
    setWorkspace((prev) => ({
      ...prev,
      dataCheck: { ...prev.dataCheck, status: "checking", attempt, candidateVersion, message: "正在核对权威绑定与候选刷新", lastCheckedAt: nowText() }
    }));
    window.setTimeout(() => {
      if (!hasCurrent) {
        setWorkspace((prev) => ({ ...prev, dataCheck: { ...prev.dataCheck, status: "ready", currentVersion: `DV-FIN-CURRENT-${suffix}`, currentAsOf: "2026-06-30 23:59 CST", bindingRef: `T019-FIN-${suffix}`, candidateVersion: null, message: "已读取当前权威消费绑定", lastCheckedAt: nowText() } }));
        notify("已读取当前权威数据上下文");
      } else if (stateNeedsFailure(workspace.dataCheck)) {
        setWorkspace((prev) => ({ ...prev, dataCheck: { ...prev.dataCheck, status: "failed", message: "候选刷新质量检查失败，上一可信版本继续服务", lastCheckedAt: nowText() } }));
        notify("候选版本未进入正式问数，上一可信版本继续服务", "warning");
      } else {
        setWorkspace((prev) => ({ ...prev, dataCheck: { ...prev.dataCheck, status: "adopted", previousVersion: prev.dataCheck.currentVersion, currentVersion: prev.dataCheck.candidateVersion, currentAsOf: "2026-07-31 23:59 CST", bindingRef: `T019-FIN-${suffix}`, candidateVersion: null, message: "已读取新的权威消费绑定", lastCheckedAt: nowText() } }));
        notify("新的权威消费绑定已可用于后续问数");
      }
    }, 1200);
  };

  return (
    <div className="app-shell">
      <aside className="platform-rail" aria-label="平台模块">
        <span className="platform-logo" title="Ontology 3.0"><Icon name="Boxes" size={20} /></span>
        <span className="platform-static" title="平台总览"><Icon name="LayoutDashboard" /></span>
        <button className="platform-button active" title="智能问数" onClick={() => navigate("q1")}><Icon name="MessagesSquare" /></button>
        <span className="platform-static" title="决策中心"><Icon name="GitPullRequestArrow" /></span>
        <span className="platform-static" title="报告中心"><Icon name="ChartSpline" /></span>
        <span className="platform-spacer"></span>
        <span className="platform-static" title="帮助"><Icon name="CircleHelp" /></span>
      </aside>

      <aside className="product-nav">
        <div className="product-nav-head">
          <span><Icon name="MessagesSquare" size={17} /></span>
          <div><strong>智能问数</strong><small>语义驱动的业务查询</small></div>
        </div>
        <nav className="product-nav-list">
          <span className="product-nav-label">工作区</span>
          {Object.entries(ROUTES).map(([key, item]) => (
            <button key={key} className={`product-nav-item ${route === key ? "active" : ""}`} onClick={() => navigate(key)}>
              <Icon name={item.icon} size={17} /><span>{item.label}</span>
              {key === "q4" && workspace.runs.length ? <em>{workspace.runs.length}</em> : null}
              {key === "q5" && workspace.views.length ? <em>{workspace.views.length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="product-nav-foot">
          <strong>{workspace.config.status}</strong>
          <span>{workspace.config.activeVersion || "配置尚未启用"}</span>
        </div>
      </aside>

      <section className="app-workspace">
        <header className="topbar">
          <div className="breadcrumb"><Icon name="Home" size={13} /><span>智能问数</span><Icon name="ChevronRight" size={12} /><strong>{ROUTES[route].label}</strong></div>
          <div className="top-actions">
            <button className={`data-context ${workspace.dataCheck.status}`} onClick={() => setDataModal(true)}>
              <Icon name={workspace.dataCheck.status === "failed" ? "TriangleAlert" : workspace.dataCheck.status === "checking" ? "RefreshCw" : "DatabaseZap"} size={16} />
              <span>{workspace.dataCheck.status === "failed" ? "上一可信版本服务中" : workspace.dataCheck.status === "checking" ? "正在检查数据状态" : workspace.dataCheck.status === "adopted" ? "权威绑定已更新" : workspace.dataCheck.status === "ready" ? "数据上下文已就绪" : "数据状态"}</span>
            </button>
            <IconButton icon="RotateCcw" label="重置状态" onClick={() => setResetModal(true)} />
          </div>
        </header>

        <main className="main">
          {route === "q1" ? <QueryWorkspace workspace={workspace} setWorkspace={setWorkspace} currentRun={currentRun} navigate={navigate} notify={notify} /> : null}
          {route === "q3" ? <ResourceDirectory /> : null}
          {route === "q4" ? <HistoryPage workspace={workspace} setWorkspace={setWorkspace} navigate={navigate} /> : null}
          {route === "q5" ? <ViewsPage workspace={workspace} setWorkspace={setWorkspace} navigate={navigate} notify={notify} /> : null}
          {route === "q6" ? <ConfigPage workspace={workspace} setWorkspace={setWorkspace} notify={notify} navigate={navigate} /> : null}
        </main>
      </section>

      {dataModal ? (
        <DataContextModal workspace={workspace} onClose={() => setDataModal(false)} onCheck={beginDataCheck} />
      ) : null}
      {resetModal ? (
        <Modal title="重置工作区" description="清除本模块产生的配置、运行、视图和请求记录。" onClose={() => setResetModal(false)} footer={<><Button onClick={() => setResetModal(false)}>取消</Button><Button tone="primary" icon="RotateCcw" onClick={resetAll}>确认重置</Button></>}>
          <Notice tone="warning" title="此操作不可撤销">上游语义资源和数据状态不会受影响。</Notice>
        </Modal>
      ) : null}
      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

function QueryWorkspace({ workspace, setWorkspace, currentRun, navigate, notify }) {
  const [question, setQuestion] = useState(workspace.draftQuestion || "");
  const [clarify, setClarify] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [saveModal, setSaveModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);

  useEffect(() => {
    if (workspace.draftQuestion) setQuestion(workspace.draftQuestion);
  }, [workspace.draftQuestion]);

  const buildContext = () => {
    const suffix = String(Date.now()).slice(-6);
    const dataVersion = workspace.dataCheck.currentVersion || `DV-FIN-CURRENT-${suffix}`;
    return {
      semanticVersion: workspace.config.context.semanticVersion,
      dataVersion,
      bindingRef: workspace.dataCheck.bindingRef || `T019-FIN-${suffix}`,
      asOf: workspace.dataCheck.currentAsOf || "2026-06-30 23:59 CST",
      quality: "通过，可消费",
      freshness: workspace.dataCheck.status === "failed" ? "候选刷新失败，上一可信版本服务中" : "符合当前新鲜度策略"
    };
  };

  const finishRun = (runId, templateId) => {
    const template = IQ_RESULT_TEMPLATES[templateId];
    setWorkspace((prev) => ({
      ...prev,
      runs: prev.runs.map((run) => run.id === runId ? {
        ...run,
        status: "成功",
        step: QUERY_STEPS.length,
        completedAt: nowText(),
        result: {
          ...template,
          rows: template.rows.map((row, index) => ({ ...row, evidenceId: `E-${runId}-${String(index + 1).padStart(3, "0")}` }))
        },
        display: { mode: "text", chart: "recommended", selected: null }
      } : run)
    }));
  };

  const startRun = (templateId, text) => {
    if (workspace.config.status !== "已启用") {
      notify("请先完成 Agent 配置验证并启用配置", "warning");
      navigate("q6");
      return;
    }
    if (templateId === "trend-blocked") {
      const runId = `Q-${String(Date.now()).slice(-8)}`;
      const blocked = {
        id: runId, question: text, templateId, createdAt: nowText(), completedAt: nowText(), status: "阻断", step: 1,
        failure: "当前 Published 指标没有可比较时间序列，无法计算上期变化。",
        recovery: "改问当前时点结果，或等待时间序列指标发布后重新查询。",
        configVersion: workspace.config.activeVersion,
        context: buildContext()
      };
      setWorkspace((prev) => ({ ...prev, idCounter: prev.idCounter + 1, currentRunId: runId, runs: [blocked, ...prev.runs] }));
      setQuestion("");
      return;
    }
    const runId = `Q-${String(Date.now()).slice(-8)}`;
    const context = buildContext();
    const run = {
      id: runId, question: text, templateId, createdAt: nowText(), completedAt: null, status: "处理中", step: 0,
      understanding: IQ_RESULT_TEMPLATES[templateId]?.title,
      configVersion: workspace.config.activeVersion,
      context
    };
    setWorkspace((prev) => ({
      ...prev,
      idCounter: prev.idCounter + 1,
      currentRunId: runId,
      draftQuestion: null,
      dataCheck: prev.dataCheck.currentVersion ? prev.dataCheck : { ...prev.dataCheck, status: "ready", currentVersion: context.dataVersion, currentAsOf: context.asOf, bindingRef: context.bindingRef, message: "已在本轮上下文中固定权威数据绑定", lastCheckedAt: nowText() },
      runs: [run, ...prev.runs]
    }));
    setQuestion("");
    QUERY_STEPS.forEach((_, index) => {
      window.setTimeout(() => {
        if (index === QUERY_STEPS.length - 1) finishRun(runId, templateId);
        else setWorkspace((prev) => ({ ...prev, runs: prev.runs.map((item) => item.id === runId ? { ...item, step: index + 1 } : item) }));
      }, 520 * (index + 1));
    });
  };

  const resolveTemplate = (text) => {
    const exact = IQ_QUERY_LIBRARY.find((item) => item.question === text);
    if (exact) return exact.id;
    if (text.includes("上期") || text.includes("趋势")) return "trend-blocked";
    if (text.includes("机构") || text.includes("协商")) return "institution-priority";
    if (text.includes("规则") || text.includes("命中")) return "rule-explain";
    if (text.includes("集团") || text.includes("板块")) return "group-overview";
    if (text.includes("561") && text.includes("465")) return "triple-cost";
    if (text.includes("465")) return "pair-cost";
    return "unit-cost";
  };

  const submitQuestion = (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const templateId = resolveTemplate(trimmed);
    if (templateId === "ambiguous-unit") {
      setClarify({ question: trimmed, selected: null });
      return;
    }
    startRun(templateId, trimmed);
  };

  const updateDisplay = (patch) => setWorkspace((prev) => ({
    ...prev,
    runs: prev.runs.map((run) => run.id === prev.currentRunId ? { ...run, display: { ...run.display, ...patch } } : run)
  }));

  const selectHistoryRun = (runId) => setWorkspace((prev) => ({ ...prev, currentRunId: runId }));

  return (
    <div className="page query-page">
      <PageHeader eyebrow="业务问数" title="问数工作台" description="基于已发布语义和权威消费上下文查询融资业务。" actions={currentRun ? <Button icon="Plus" onClick={() => { setWorkspace((prev) => ({ ...prev, currentRunId: null })); setQuestion(""); }}>新问题</Button> : null} />

      {workspace.config.status !== "已启用" ? (
        <Notice tone="warning" title="问数配置尚未启用" action={<Button size="sm" tone="soft" onClick={() => navigate("q6")}>前往配置</Button>}>
          完成配置验证并启用后，才能装配受控运行上下文。
        </Notice>
      ) : null}

      <div className={`query-layout ${currentRun ? "with-history" : ""}`}>
        <section className="query-main">
          {!currentRun ? (
            <>
              <div className="ask-hero">
                <div className="ask-heading"><span><Icon name="Sparkles" size={20} /></span><div><h2>想了解什么业务问题？</h2><p>输入单位、集团、指标、规则或金融机构范围。</p></div></div>
                <form className="composer" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
                  <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：单位553平均融资成本及构成是什么？" rows="3" />
                  <div className="composer-foot"><span><Icon name="ShieldCheck" size={14} />仅使用白名单内的已发布语义资源</span><Button type="submit" tone="primary" icon="ArrowUp" disabled={!question.trim() || workspace.config.status !== "已启用"}>提交问题</Button></div>
                </form>
              </div>
              <section className="question-library">
                <div className="section-title"><div><h2>常用问题</h2><p>选择问题后仍会核对对象范围和上下文。</p></div></div>
                <div className="question-grid">
                  {IQ_QUERY_LIBRARY.map((item) => (
                    <button key={item.id} className="question-card" onClick={() => submitQuestion(item.question)} disabled={workspace.config.status !== "已启用"}>
                      <span><Icon name={item.icon} size={19} /></span><div><strong>{item.title}</strong><p>{item.description}</p></div><Icon name="ArrowUpRight" size={16} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <RunView
              run={currentRun}
              workspace={workspace}
              updateDisplay={updateDisplay}
              onEvidence={(payload) => setEvidence(payload)}
              onSave={() => setSaveModal(true)}
              onPin={() => {
                const sourceView = workspace.views.find((view) => view.sourceRunId === currentRun.id);
                if (!sourceView) {
                  setSaveModal(true);
                  return notify("固定引用前请先保存为问数视图", "warning");
                }
                if (workspace.pins.some((pin) => pin.runId === currentRun.id)) return notify("当前结果已固定引用", "warning");
                const pin = { id: `PIN-${String(Date.now()).slice(-7)}`, runId: currentRun.id, viewId: sourceView.id, title: sourceView.name, createdAt: nowText(), status: "已接收", queryDefinition: sourceView.queryDefinition, display: sourceView.display, context: currentRun.context };
                setWorkspace((prev) => ({ ...prev, pins: [pin, ...prev.pins] }));
                notify("报告中心已接收视图引用，尚未发布");
              }}
              onAction={() => setActionModal(true)}
              onFollow={(text) => startRun(resolveTemplate(text), text)}
              notify={notify}
            />
          )}
        </section>

        {currentRun ? (
          <aside className="run-history-rail">
            <div className="rail-title"><strong>本次会话</strong><span>{workspace.runs.length} 轮</span></div>
            <div className="rail-runs">
              {workspace.runs.slice(0, 8).map((run) => (
                <button key={run.id} className={run.id === currentRun.id ? "active" : ""} onClick={() => selectHistoryRun(run.id)}>
                  <span>{run.question}</span><small>{run.createdAt} · {run.status}</small>
                </button>
              ))}
            </div>
            <Button size="sm" icon="History" onClick={() => navigate("q4")}>查看全部历史</Button>
          </aside>
        ) : null}
      </div>

      {clarify ? (
        <Modal title="确认查询对象" description="“单位55”不是完整对象名，请确认是否指以下对象。" onClose={() => setClarify(null)} footer={<><Button onClick={() => setClarify(null)}>取消</Button><Button tone="primary" disabled={!clarify.selected} onClick={() => { const selected = clarify.selected; setClarify(null); startRun("pair-cost", `${selected}和单位465综合平均融资成本是多少？`); }}>确认范围</Button></>}>
          <div className="choice-list">
            {["单位553"].map((name) => <button key={name} className={clarify.selected === name ? "selected" : ""} onClick={() => setClarify({ ...clarify, selected: name })}><span><strong>{name}</strong><small>融资主体 · 单位层级 · 当前唯一候选</small></span>{clarify.selected === name ? <Icon name="CircleCheck" /> : <Icon name="Circle" />}</button>)}
          </div>
        </Modal>
      ) : null}
      {evidence ? <EvidenceDrawer run={currentRun} focus={evidence} onClose={() => setEvidence(null)} /> : null}
      {saveModal && currentRun?.status === "成功" ? <SaveViewModal run={currentRun} workspace={workspace} setWorkspace={setWorkspace} onClose={() => setSaveModal(false)} notify={notify} /> : null}
      {actionModal && currentRun?.status === "成功" ? <ActionRequestModal run={currentRun} workspace={workspace} setWorkspace={setWorkspace} onClose={() => setActionModal(false)} /> : null}
    </div>
  );
}

function RunView({ run, workspace, updateDisplay, onEvidence, onSave, onPin, onAction, onFollow, notify }) {
  const [chartMenu, setChartMenu] = useState(false);
  const display = run.display || { mode: "text", chart: "recommended", selected: null };
  const stale = run.context?.freshness?.includes("上一可信");

  if (run.status === "处理中") {
    return (
      <section className="run-surface processing">
        <div className="question-echo"><span><Icon name="MessageCircle" /></span><div><small>当前问题</small><strong>{run.question}</strong></div><StatusBadge tone="info" icon="LoaderCircle">处理中</StatusBadge></div>
        <div className="processing-card">
          <span className="spinner large"></span><h2>{QUERY_STEPS[Math.min(run.step, QUERY_STEPS.length - 1)]}</h2>
          <p>正在固定本轮配置、语义、数据和证据上下文。</p><ProgressSteps steps={QUERY_STEPS} current={run.step} />
        </div>
      </section>
    );
  }

  if (run.status === "阻断") {
    return (
      <section className="run-surface">
        <div className="question-echo"><span><Icon name="MessageCircle" /></span><div><small>当前问题</small><strong>{run.question}</strong></div><StatusBadge tone="danger" icon="Ban">阻断</StatusBadge></div>
        <Notice tone="danger" title="当前上下文无法回答">{run.failure}</Notice>
        <Panel title="恢复建议"><div className="recovery-row"><Icon name="Route" /><span>{run.recovery}</span><Button size="sm" onClick={() => onFollow("集团融资成本、债务结构和产业板块对比如何？")}>改问当前结果</Button></div></Panel>
      </section>
    );
  }

  const result = run.result;
  const selectedRow = result.rows.find((row) => row.object === display.selected || row.item === display.selected || (display.selected && row.item.includes(display.selected)));
  const chartType = display.chart === "recommended" ? result.chart.default : display.chart;
  const downloadCsv = () => {
    const headers = ["业务对象", "语义资源", "精确值", "单位", "业务状态", "证据编号", "Published语义版本", "可消费数据版本", "数据截至时间", "生成时间", "质量状态"];
    const rows = result.rows.map((row) => [row.object, row.item, row.display, row.unit, row.status, row.evidenceId, run.context.semanticVersion, run.context.dataVersion, run.context.asOf, run.completedAt, run.context.quality]);
    const content = "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${result.title}-${run.id}.csv`; link.click(); URL.revokeObjectURL(url);
    notify("已导出当前完整结构化结果");
  };

  return (
    <section className="run-surface">
      <div className="question-echo"><span><Icon name="MessageCircle" /></span><div><small>当前问题</small><strong>{run.question}</strong></div><StatusBadge tone="success" icon="CircleCheck">成功</StatusBadge></div>
      {stale ? <Notice tone="warning" title="上一可信版本继续服务">候选刷新未通过质量检查。本轮仍使用固定的数据版本，结果和证据未混入候选数据。</Notice> : null}

      <div className="answer-card">
        <header className="answer-head">
          <div><span className="eyebrow">受控语义结果</span><h2>{result.title}</h2></div>
          <div className="answer-actions">
            <Button size="sm" icon="BookmarkPlus" onClick={onSave}>保存视图</Button>
            <Button size="sm" icon="Pin" onClick={onPin}>固定引用</Button>
            <Button size="sm" tone="primary" icon="Send" onClick={onAction}>发起行动</Button>
          </div>
        </header>
        <div className="trust-strip">
          <button onClick={() => onEvidence({ type: "context" })}><span>语义版本</span><strong>{run.context.semanticVersion}</strong></button>
          <button onClick={() => onEvidence({ type: "context" })}><span>数据版本</span><strong>{run.context.dataVersion}</strong></button>
          <button onClick={() => onEvidence({ type: "context" })}><span>数据截至</span><strong>{run.context.asOf}</strong></button>
          <button onClick={() => onEvidence({ type: "quality" })}><span>质量状态</span><strong><Icon name="ShieldCheck" size={14} />{run.context.quality}</strong></button>
          <button onClick={() => onEvidence({ type: "context" })}><span>生成时间</span><strong>{run.completedAt}</strong></button>
        </div>

        <div className="display-toolbar">
          <Segmented label="结果展示方式" value={display.mode} onChange={(mode) => updateDisplay({ mode })} items={[
            { value: "text", label: "文字解读", icon: "Text" }, { value: "table", label: "数据表", icon: "Table2" }, { value: "chart", label: "BI 图表", icon: "ChartNoAxesCombined" }
          ]} />
          {display.mode === "chart" ? (
            <div className="chart-picker-wrap"><Button size="sm" icon="SlidersHorizontal" onClick={() => setChartMenu(!chartMenu)}>{display.chart === "recommended" ? "系统推荐" : { metric: "指标卡", bar: "柱状图", stacked: "堆叠柱状图", donut: "环形图" }[display.chart]}</Button>{chartMenu ? <ChartTypeMenu result={result} value={display.chart} onChange={(chart) => { updateDisplay({ chart }); setChartMenu(false); }} /> : null}</div>
          ) : null}
          <span className="display-spacer"></span>
          {display.selected ? <Button size="sm" icon="RotateCcw" onClick={() => updateDisplay({ selected: null })}>恢复完整范围</Button> : null}
          {display.mode === "table" ? <Button size="sm" icon="Download" onClick={downloadCsv}>导出 CSV</Button> : null}
        </div>

        <div className={`result-stage mode-${display.mode}`}>
          {display.mode === "text" ? (
            <div className="text-result">
              <p className="answer-summary">{result.summary}</p>
              <MetricCards items={result.highlights} selected={display.selected} onSelect={(selected) => updateDisplay({ selected })} />
              <div className="answer-proof"><Icon name="Quote" size={17} /><span>关键结论由固定结构化结果组织，不使用模型重新计算。</span><button onClick={() => onEvidence({ type: "all" })}>查看证据</button></div>
            </div>
          ) : null}
          {display.mode === "table" ? <ResultTable run={run} selected={display.selected} onSelect={(selected) => updateDisplay({ selected })} onEvidence={onEvidence} /> : null}
          {display.mode === "chart" ? (
            <ChartResult result={result} chartType={chartType} selected={display.selected} onSelect={(selected) => updateDisplay({ selected })} onFallback={() => updateDisplay({ mode: "table" })} />
          ) : null}
        </div>
        {selectedRow ? <div className="selection-bar"><Icon name="MousePointer2" size={15} /><span>已定位：{selectedRow.object} · {selectedRow.item} · {selectedRow.display}{selectedRow.unit}</span><button onClick={() => onEvidence({ type: "row", row: selectedRow })}>查看证据</button></div> : null}
      </div>

      <section className="follow-section"><span>继续追问</span><div>{result.nextQuestions.map((text) => <button key={text} onClick={() => onFollow(text)}>{text}<Icon name="ArrowUpRight" size={14} /></button>)}</div></section>
    </section>
  );
}

function ResultTable({ run, selected, onSelect, onEvidence }) {
  return (
    <div className="table-wrap">
      <table className="result-table"><thead><tr><th>业务对象</th><th>指标 / 规则</th><th>精确结果</th><th>状态</th><th>证据</th></tr></thead><tbody>
        {run.result.rows.map((row) => <tr key={row.evidenceId} className={selected === row.object || selected === row.item || (selected && row.item.includes(selected)) ? "selected" : ""} onClick={() => onSelect(row.object)}><td><strong>{row.object}</strong>{row.detail ? <small>{row.detail}</small> : null}</td><td>{row.item}</td><td className="numeric">{row.display} {row.unit}</td><td><StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge></td><td><button className="evidence-link" onClick={(event) => { event.stopPropagation(); onEvidence({ type: "row", row }); }}>{row.evidenceId}<Icon name="ChevronRight" size={13} /></button></td></tr>)}
      </tbody></table>
    </div>
  );
}

function ChartResult({ result, chartType, selected, onSelect, onFallback }) {
  if (chartType === "table") return <div className="chart-fallback"><Notice tone="info" title="已选择安全展示">规则结果的量纲不同，数据表能更准确地保留阈值、状态和证据。</Notice><Button icon="Table2" onClick={onFallback}>切换数据表</Button></div>;
  return (
    <div className="chart-stage">
      <div className="chart-caption"><div><strong>{result.title}</strong><span>{chartType === "stacked" ? "融资结构构成" : chartType === "donut" ? "单一单位构成" : "当前结果"}</span></div><StatusBadge tone="info">精确值可查</StatusBadge></div>
      <div className="chart-canvas" key={chartType}>
        {chartType === "metric" ? <MetricCards items={result.highlights} selected={selected} onSelect={onSelect} /> : null}
        {chartType === "bar" ? <BarChart categories={result.chart.categories} values={result.chart.values} unit={result.chart.unit} selected={selected} onSelect={onSelect} /> : null}
        {chartType === "donut" ? <DonutChart categories={result.chart.categories} values={result.chart.values} unit={result.chart.unit} selected={selected} onSelect={onSelect} /> : null}
        {chartType === "stacked" ? <StackedChart categories={result.chart.categories} stacks={result.chart.stacks} selected={selected} onSelect={onSelect} /> : null}
      </div>
      <div className="chart-footnote"><Icon name="Info" size={14} />点击图形元素可定位对应结果和证据。图形不会改变查询范围。</div>
    </div>
  );
}

function EvidenceDrawer({ run, focus, onClose }) {
  const rows = focus.type === "row" ? [focus.row] : run.result.rows;
  return (
    <Drawer title="证据与运行上下文" subtitle={`${run.id} · ${run.result.title}`} onClose={onClose}>
      <div className="evidence-summary">
        <StatusBadge tone="success" icon="BadgeCheck">上下文完整</StatusBadge>
        <p>本轮数值、规则状态与证据均固定在同一个消费上下文中。</p>
      </div>
      <section className="drawer-section"><h3>版本证明</h3><div className="fact-grid two"><Fact label="Published 语义版本" value={run.context.semanticVersion} /><Fact label="可消费数据版本" value={run.context.dataVersion} /><Fact label="权威绑定引用" value={run.context.bindingRef} /><Fact label="数据截至时间" value={run.context.asOf} /><Fact label="Agent 配置" value={run.configVersion} /><Fact label="质量与新鲜度" value={run.context.quality} note={run.context.freshness} /></div></section>
      <section className="drawer-section"><h3>{focus.type === "row" ? "当前证据" : "结果证据"}</h3><div className="evidence-list">{rows.map((row) => <article key={row.evidenceId} className={focus.row?.evidenceId === row.evidenceId ? "focused" : ""}><div><StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge><code>{row.evidenceId}</code></div><h4>{row.object} · {row.item}</h4><p>精确结果：{row.display} {row.unit}</p><dl><dt>语义资源</dt><dd>{row.item.includes("命中") ? "已发布规则" : "已发布指标"}</dd><dt>对象范围</dt><dd>{row.object}</dd><dt>数据定位</dt><dd>{run.context.dataVersion} · 当前结果成员</dd></dl></article>)}</div></section>
      <Notice tone="info" title="只读证据">不展示原始工作簿、源表字段、处理代码或当前结果范围外的数据。</Notice>
    </Drawer>
  );
}

function SaveViewModal({ run, workspace, setWorkspace, onClose, notify }) {
  const [name, setName] = useState(run.result.title);
  const save = () => {
    const view = {
      id: `VIEW-${String(Date.now()).slice(-7)}`, name: name.trim(), createdAt: nowText(), sourceRunId: run.id, question: run.question,
      templateId: run.templateId, queryDefinition: { scope: run.result.scope, resources: run.result.rows.map((row) => row.item), sort: run.result.resultType === "institutions" ? "问题余额贡献降序" : "业务默认", timePolicy: "权威绑定的数据截至时间" },
      display: { ...run.display }, status: "可运行", semanticVersion: run.context.semanticVersion
    };
    setWorkspace((prev) => ({ ...prev, views: [view, ...prev.views] })); onClose(); notify("问数视图已保存");
  };
  return (
    <Modal title="保存为问数视图" description="查询定义与展示偏好分开保存。" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button tone="primary" icon="Save" disabled={!name.trim()} onClick={save}>保存视图</Button></>}>
      <label className="field"><span>视图名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="save-contract"><div><strong>查询定义</strong><p>{run.result.scope.join("、")} · {run.result.rows.map((row) => row.item).slice(0, 3).join("、")}</p></div><div><strong>展示偏好</strong><p>{{ text: "文字解读", table: "数据表", chart: "BI 图表" }[run.display.mode]} · {run.display.chart === "recommended" ? "系统推荐" : run.display.chart}</p></div></div>
      <Notice tone="info">换参数运行时会重新判断展示是否适用；展示偏好不会改变查询口径。</Notice>
    </Modal>
  );
}

function ActionRequestModal({ run, workspace, setWorkspace, onClose }) {
  const [stage, setStage] = useState("confirm");
  const [requestId, setRequestId] = useState(null);
  const target = run.result.scope.length === 1 ? run.result.scope[0] : null;
  const submit = () => {
    setStage("submitting");
    window.setTimeout(() => {
      const id = `AR-${String(Date.now()).slice(-8)}`;
      const request = { id, createdAt: nowText(), status: "已提交", target, type: "发起融资优化建议", runId: run.id, context: run.context, evidenceIds: run.result.rows.map((row) => row.evidenceId) };
      setRequestId(id);
      setWorkspace((prev) => ({ ...prev, actionRequests: [request, ...prev.actionRequests] })); setStage("success");
    }, 900);
  };
  const eligible = Boolean(target);
  return (
    <Modal title="发起行动请求" description="向决策中心提交本轮固定证据，不在此处创建提醒或待办。" onClose={stage === "submitting" ? () => {} : onClose} footer={stage === "confirm" ? <><Button onClick={onClose}>取消</Button><Button tone="primary" icon="Send" disabled={!eligible} onClick={submit}>确认提交</Button></> : stage === "success" ? <Button tone="primary" onClick={onClose}>完成</Button> : null}>
      {stage === "confirm" ? <><div className="fact-grid two"><Fact label="目标主体" value={target || "需要单一目标主体"} /><Fact label="Action Type" value="发起融资优化建议" /><Fact label="来源运行" value={run.id} /><Fact label="证据数量" value={`${run.result.rows.length} 项`} /><Fact label="语义版本" value={run.context.semanticVersion} /><Fact label="数据版本" value={run.context.dataVersion} /></div>{!eligible ? <Notice tone="danger" title="无法提交">组合查询不能静默选择一个单位作为行动目标。请先查询单一单位。</Notice> : <Notice tone="warning" title="提交前确认">图表临时选中项不会成为行动目标；目标主体来自本轮已确认对象范围。</Notice>}</> : null}
      {stage === "submitting" ? <div className="modal-progress"><span className="spinner large"></span><strong>正在提交请求</strong><p>保持本轮目标、版本和证据不变。</p></div> : null}
      {stage === "success" ? <div className="success-result"><span><Icon name="CircleCheckBig" size={30} /></span><h3>请求已提交</h3><p>决策中心已接收请求，后续确认和待办由决策中心承接。</p><code>{requestId}</code></div> : null}
    </Modal>
  );
}

function ResourceDirectory() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("全部");
  const [detail, setDetail] = useState(null);
  const types = ["全部", "对象", "指标", "规则", "关系", "行动类型"];
  const filtered = IQ_SEMANTIC_RESOURCES.filter((item) => (type === "全部" || item.type === type) && `${item.name}${item.stableId}${item.scope}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="page">
      <PageHeader eyebrow="只读目录" title="语义资源" description="浏览当前可用于问数的已发布资源和稳定身份。" />
      <div className="directory-toolbar"><label className="search-box"><Icon name="Search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或稳定身份" /></label><span>共 {filtered.length} 项</span></div>
      <div className="filter-tabs">{types.map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
      {filtered.length ? <div className="resource-grid">{filtered.map((item) => <article className="resource-card" key={item.stableId}><header><span><Icon name={item.type === "指标" ? "Gauge" : item.type === "规则" ? "ShieldCheck" : item.type === "关系" ? "GitBranch" : item.type === "行动类型" ? "Send" : "Box"} /></span><StatusBadge tone="success">{item.status}</StatusBadge></header><h3>{item.name}</h3><code>{item.stableId}</code><p>{item.scope}</p><footer><span>{item.type}{item.unit ? ` · ${item.unit}` : ""}</span><button onClick={() => setDetail(item)}>查看详情<Icon name="ChevronRight" size={14} /></button></footer></article>)}</div> : <EmptyState icon="SearchX" title="没有匹配资源" description="调整资源类型或搜索词后重试。" />}
      {detail ? <Drawer title={detail.name} subtitle={`${detail.type} · ${detail.stableId}`} onClose={() => setDetail(null)}><div className="detail-status"><StatusBadge tone="success" icon="BadgeCheck">{detail.status}</StatusBadge><p>该资源只读引用，不能在智能问数中修改。</p></div><div className="fact-grid two"><Fact label="稳定身份" value={detail.stableId} /><Fact label="资源类型" value={detail.type} /><Fact label="适用范围" value={detail.scope} /><Fact label="单位" value={detail.unit || "不适用"} /><Fact label="可用于规划" value="是" /><Fact label="可用于正式查询" value="在白名单和对象适用范围内" /></div><Notice tone="info">资源定义、发布和变更由本体管理负责。</Notice></Drawer> : null}
    </div>
  );
}

function HistoryPage({ workspace, setWorkspace, navigate }) {
  const [filter, setFilter] = useState("全部");
  const filtered = workspace.runs.filter((run) => filter === "全部" || run.status === filter);
  const openRun = (id) => { setWorkspace((prev) => ({ ...prev, currentRunId: id })); navigate("q1"); };
  return (
    <div className="page">
      <PageHeader eyebrow="运行记录" title="历史会话" description="每轮结果保留原问题、固定上下文、状态和证据。" actions={<Button icon="Plus" tone="primary" onClick={() => { setWorkspace((prev) => ({ ...prev, currentRunId: null })); navigate("q1"); }}>新问题</Button>} />
      <div className="filter-tabs">{["全部", "成功", "处理中", "阻断"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {!filtered.length ? <EmptyState icon="History" title="暂无运行记录" description="完成一次问数后，本轮问题和结果会出现在这里。" action={<Button tone="primary" onClick={() => navigate("q1")}>开始问数</Button>} /> : <div className="history-list">{filtered.map((run) => <button key={run.id} onClick={() => openRun(run.id)}><span className="history-icon"><Icon name={run.status === "成功" ? "CircleCheck" : run.status === "阻断" ? "Ban" : "LoaderCircle"} /></span><div><strong>{run.question}</strong><p>{run.status === "成功" ? run.result.title : run.failure || QUERY_STEPS[Math.min(run.step, QUERY_STEPS.length - 1)]}</p><small>{run.id} · {run.createdAt}</small></div><StatusBadge tone={statusTone(run.status)}>{run.status}</StatusBadge><Icon name="ChevronRight" /></button>)}</div>}
    </div>
  );
}

function ViewsPage({ workspace, setWorkspace, navigate, notify }) {
  const [mode, setMode] = useState("cards");
  const [tab, setTab] = useState("views");
  const rerun = (view) => {
    setWorkspace((prev) => ({ ...prev, currentRunId: null, draftQuestion: view.question }));
    navigate("q1");
    notify(`已载入“${view.name}”的查询定义，请在工作台运行`, "success");
  };
  return (
    <div className="page">
      <PageHeader eyebrow="复用与交付" title="问数视图" description="复用查询定义和展示偏好，或查看已交付的仪表盘引用。" actions={<Segmented label="排列方式" value={mode} onChange={setMode} items={[{ value: "cards", label: "卡片", icon: "LayoutGrid" }, { value: "list", label: "列表", icon: "List" }]} />} />
      <div className="tabs"><button className={tab === "views" ? "active" : ""} onClick={() => setTab("views")}>可复用视图 <span>{workspace.views.length}</span></button><button className={tab === "pins" ? "active" : ""} onClick={() => setTab("pins")}>固定引用 <span>{workspace.pins.length}</span></button><button className={tab === "actions" ? "active" : ""} onClick={() => setTab("actions")}>行动请求 <span>{workspace.actionRequests.length}</span></button></div>
      {tab === "views" ? (!workspace.views.length ? <EmptyState icon="Bookmark" title="暂无可复用视图" description="在成功回答中保存视图后，可在此重新运行或查看定义。" action={<Button tone="primary" onClick={() => navigate("q1")}>前往问数</Button>} /> : <div className={`view-collection ${mode}`}>{workspace.views.map((view) => <article key={view.id} className="saved-view"><header><span><Icon name="PanelsTopLeft" /></span><StatusBadge tone="success">{view.status}</StatusBadge></header><h3>{view.name}</h3><p>{view.question}</p><div className="view-facts"><Fact label="对象范围" value={view.queryDefinition.scope.join("、")} /><Fact label="展示偏好" value={{ text: "文字解读", table: "数据表", chart: "BI 图表" }[view.display.mode]} /></div><footer><span>{view.createdAt}</span><Button size="sm" icon="Play" onClick={() => rerun(view)}>重新运行</Button></footer></article>)}</div>) : null}
      {tab === "pins" ? (!workspace.pins.length ? <EmptyState icon="Pin" title="暂无固定引用" description="固定回答后，报告中心接收引用的结果会显示在这里。" /> : <div className="record-table"><div className="record-head"><span>引用名称</span><span>来源运行</span><span>接收时间</span><span>状态</span></div>{workspace.pins.map((pin) => <div key={pin.id} className="record-row"><strong>{pin.title}</strong><button onClick={() => { setWorkspace((prev) => ({ ...prev, currentRunId: pin.runId })); navigate("q1"); }}>{pin.runId}</button><span>{pin.createdAt}</span><StatusBadge tone="success">{pin.status}</StatusBadge></div>)}</div>) : null}
      {tab === "actions" ? (!workspace.actionRequests.length ? <EmptyState icon="Send" title="暂无行动请求" description="从单一主体回答中确认提交后，请求记录会出现在这里。" /> : <div className="record-table"><div className="record-head"><span>请求记录</span><span>目标主体</span><span>提交时间</span><span>状态</span></div>{workspace.actionRequests.map((item) => <div key={item.id} className="record-row"><strong>{item.id}</strong><span>{item.target}</span><span>{item.createdAt}</span><StatusBadge tone="info">{item.status}</StatusBadge></div>)}</div>) : null}
    </div>
  );
}

function ConfigPage({ workspace, setWorkspace, notify, navigate }) {
  const [tab, setTab] = useState(workspace.config.status === "已启用" ? "active" : "candidate");
  const config = workspace.config;
  const validate = () => {
    if (config.validationStatus === "running") return;
    const attempt = config.validationAttempt + 1;
    setWorkspace((prev) => ({ ...prev, config: { ...prev.config, validationStatus: "running", validationAttempt: attempt, lastCheckedAt: nowText() } }));
    window.setTimeout(() => {
      if (!config.skillRepaired) {
        setWorkspace((prev) => ({ ...prev, config: { ...prev.config, validationStatus: "failed", status: "待验证", lastCheckedAt: nowText() } }));
        notify("配置验证被 Skill 版本错配阻断", "warning");
      } else {
        const suffix = String(Date.now()).slice(-6);
        setWorkspace((prev) => ({ ...prev, config: { ...prev.config, validationStatus: "passed", status: "待启用", activeVersion: `CFG-FIN-${suffix}`, promptVersion: `PROMPT-FIN-${suffix}`, whitelistVersion: `WL-FIN-${suffix}`, bindingVersion: `BIND-FIN-${suffix}`, lastCheckedAt: nowText(), context: { semanticVersion: `SEM-FIN-P-${suffix}`, skillSet: IQ_CONFIG_CANDIDATE.skills.map((skill) => ({ ...skill, loaded: skill.expected })) } } }));
        notify("配置验证通过，请确认启用");
      }
    }, 1300);
  };
  const repair = () => {
    setWorkspace((prev) => ({ ...prev, config: { ...prev.config, skillRepaired: true, validationStatus: "not_started", status: "待验证" } }));
    notify("已重新加载正确的 Skill 版本");
  };
  const enable = () => {
    setWorkspace((prev) => ({ ...prev, config: { ...prev.config, status: "已启用" } })); setTab("active"); notify("问数配置已启用");
  };
  const skills = config.skillRepaired ? IQ_CONFIG_CANDIDATE.skills.map((skill) => ({ ...skill, loaded: skill.expected })) : IQ_CONFIG_CANDIDATE.skills;
  return (
    <div className="page">
      <PageHeader eyebrow="运行约束" title="问数 Agent 配置" description="管理智能问数拥有的提示词、Skill、本体绑定和资源白名单。" actions={config.status === "已启用" ? <Button tone="primary" icon="MessageSquareText" onClick={() => navigate("q1")}>开始问数</Button> : null} />
      <div className="tabs"><button className={tab === "candidate" ? "active" : ""} onClick={() => setTab("candidate")}>配置候选</button><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>已启用配置 {config.status === "已启用" ? <span>1</span> : null}</button></div>
      {tab === "candidate" ? (
        <div className="config-grid">
          <div className="stack">
            <Panel title={IQ_CONFIG_CANDIDATE.name} subtitle={IQ_CONFIG_CANDIDATE.scene} actions={<StatusBadge tone={statusTone(config.status)}>{config.status}</StatusBadge>}>
              <div className="fact-grid two"><Fact label="系统提示词" value={IQ_CONFIG_CANDIDATE.promptLabel} /><Fact label="资源白名单" value={`${IQ_CONFIG_CANDIDATE.resourceCount} 项已发布资源`} /><Fact label="Skill 数量" value={`${skills.length} 项`} /><Fact label="场景状态" value="可配置" /></div>
            </Panel>
            <Panel title="Skill 加载清单" subtitle="验证实际加载版本是否与候选配置一致。">
              <div className="skill-list">{skills.map((skill) => { const match = skill.expected === skill.loaded; return <div key={skill.name}><span className={`skill-icon ${match ? "ok" : "error"}`}><Icon name={match ? "Check" : "X"} size={14} /></span><strong>{skill.name}</strong><span>要求 {skill.expected}</span><span>已加载 {skill.loaded}</span><StatusBadge tone={match ? "success" : "danger"}>{match ? "一致" : "错配"}</StatusBadge></div>; })}</div>
            </Panel>
          </div>
          <div className="stack">
            <Panel title="配置验证" subtitle="通过后才能生成可启用的配置快照。">
              {config.validationStatus === "not_started" ? <EmptyState icon="ShieldCheck" title="尚未验证" description="运行验证以核对 Prompt、Skill、白名单和本体绑定。" action={<Button tone="primary" icon="Play" onClick={validate}>运行验证</Button>} /> : null}
              {config.validationStatus === "running" ? <div className="validation-running"><span className="spinner large"></span><strong>正在验证配置</strong><p>核对启用状态、稳定身份、资源适用范围和完整性。</p></div> : null}
              {config.validationStatus === "failed" ? <div className="validation-result"><Notice tone="danger" title="验证失败">场景与资源发现 Skill 要求版本 1.8，实际加载版本 1.7。配置未生成，不能启用。</Notice><div className="recovery-actions"><Button icon="RefreshCw" tone="soft" onClick={repair}>重新加载 Skill</Button></div></div> : null}
              {config.validationStatus === "passed" ? <div className="validation-result"><Notice tone="success" title="验证通过">配置快照已固定，等待确认启用。</Notice><div className="version-grid"><Fact label="配置版本" value={config.activeVersion} /><Fact label="Prompt 版本" value={config.promptVersion} /><Fact label="白名单版本" value={config.whitelistVersion} /><Fact label="本体绑定版本" value={config.bindingVersion} /></div><Button tone="primary" icon="Power" onClick={enable}>启用配置</Button></div> : null}
            </Panel>
            <Panel title="验证范围" subtitle="阻断关键上下文错配。"><ul className="check-points">{["配置组件属于同一版本", "Skill 实际加载版本一致", "资源已发布且在白名单内", "关系方向和端点有效", "资源适用于目标对象", "输出证据映射完整"].map((item) => <li key={item}><Icon name="CheckCircle2" size={15} />{item}</li>)}</ul></Panel>
          </div>
        </div>
      ) : (
        config.status === "已启用" ? <div className="active-config"><div className="active-hero"><span><Icon name="BadgeCheck" size={26} /></span><div><span className="eyebrow">当前启用</span><h2>{IQ_CONFIG_CANDIDATE.name}</h2><p>{config.activeVersion} · {IQ_CONFIG_CANDIDATE.scene}</p></div><StatusBadge tone="success" icon="Power">已启用</StatusBadge></div><div className="config-grid"><Panel title="配置快照"><div className="fact-grid two"><Fact label="配置版本" value={config.activeVersion} /><Fact label="系统提示词版本" value={config.promptVersion} /><Fact label="资源白名单版本" value={config.whitelistVersion} /><Fact label="本体绑定版本" value={config.bindingVersion} /><Fact label="Published 语义版本" value={config.context?.semanticVersion} /><Fact label="最近验证" value={config.lastCheckedAt} /></div></Panel><Panel title="已加载 Skill"><div className="compact-list">{config.context?.skillSet.map((skill) => <div key={skill.name}><Icon name="Check" size={14} /><span>{skill.name}</span><strong>{skill.loaded}</strong></div>)}</div></Panel></div><Notice tone="info" title="所有权边界">该快照由智能问数固定。其他运行承载不得追加 Prompt、Skill、工具、会话记忆或自动选择“最新版本”。</Notice></div> : <EmptyState icon="Bot" title="没有已启用配置" description="在配置候选中完成验证并确认启用。" action={<Button onClick={() => setTab("candidate")}>查看配置候选</Button>} />
      )}
    </div>
  );
}

function DataContextModal({ workspace, onClose, onCheck }) {
  const state = workspace.dataCheck;
  const adopted = state.status === "adopted";
  const hasCurrent = Boolean(state.currentVersion);
  const leftVersion = adopted ? state.previousVersion : state.currentVersion;
  return (
    <Modal title="数据可信度状态" description="只读核对权威消费绑定、刷新和质量结果。" size="lg" onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button tone="primary" icon="RefreshCw" disabled={state.status === "checking"} onClick={onCheck}>{state.status === "checking" ? "检查中" : "检查更新"}</Button></>}>
      {state.status === "checking" ? <Notice tone="info" title="正在检查">候选刷新不会混入当前回答。</Notice> : null}
      {state.status === "failed" ? <Notice tone="warning" title="候选刷新失败">质量检查未通过，当前权威绑定未切换。上一可信版本继续服务，并在后续回答中显示警告。</Notice> : null}
      {state.status === "adopted" ? <Notice tone="success" title="已读取权威绑定变化">新的绑定仅用于此后创建的问数运行，历史结果仍保留原数据版本。</Notice> : null}
      <div className="data-lanes">
        <article className={adopted ? "previous" : hasCurrent ? "current" : "candidate"}><header><strong>{adopted ? "上一可信" : hasCurrent ? "当前权威" : "权威数据上下文"}</strong><StatusBadge tone={adopted ? "warning" : hasCurrent ? "success" : "neutral"}>{adopted ? "可回溯" : hasCurrent ? "可消费" : "未开始"}</StatusBadge></header><h3>{hasCurrent ? "融资数据资产" : "尚未读取"}</h3><code>{leftVersion || "运行问数或检查更新后固定"}</code><p>{hasCurrent ? `数据截至 ${adopted ? "2026-06-30 23:59 CST" : state.currentAsOf}` : "当前没有已装配的数据版本"}</p><small>{hasCurrent ? "质量通过 · 证据定位完整" : "不会预先生成版本或成功状态"}</small></article>
        <Icon name="ArrowRight" />
        <article className={state.status === "failed" ? "failed" : adopted ? "current" : "candidate"}><header><strong>{adopted ? "当前权威" : "候选刷新"}</strong><StatusBadge tone={state.status === "failed" ? "danger" : adopted ? "success" : state.status === "checking" ? "info" : "neutral"}>{state.status === "failed" ? "不可消费" : adopted ? "可消费" : state.status === "checking" ? "处理中" : "未开始"}</StatusBadge></header><h3>{(adopted ? state.currentVersion : state.candidateVersion) || "尚无候选版本"}</h3><code>{(adopted ? state.currentVersion : state.candidateVersion) || "检查更新后生成候选标识"}</code><p>{adopted ? `数据截至 ${state.currentAsOf}` : state.status === "failed" ? "成员映射完整性检查失败" : "尚未取得质量结果"}</p><small>{state.lastCheckedAt ? `最近检查 ${state.lastCheckedAt}` : "可检查上游是否存在新绑定"}</small></article>
      </div>
      <Notice tone="info">刷新成功不等于权威消费绑定已切换。本模块只读取绑定结果，不维护消费指针。</Notice>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
