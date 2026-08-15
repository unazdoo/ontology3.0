const { useCallback, useEffect, useMemo, useState } = React;

function parseDecisionRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "workbench";
  const [path, queryString = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { path, parts, query: Object.fromEntries(new URLSearchParams(queryString)) };
}

function requestStatusLabel(request) {
  if (request.taskCreating) return "待办创建中";
  return (DC_STATUS_META[request.status] || {}).label || request.status;
}

function taskVisualStatus(task) {
  if (task.overdue && !["completed", "cancelled", "corrected"].includes(task.status)) {
    return { status: task.status, suffix: " · 已逾期" };
  }
  return { status: task.status, suffix: "" };
}

function expandDecisionRequests(requests) {
  return requests.flatMap((request) => [
    request,
    ...request.duplicateRequests.map((duplicate) => ({
      ...request,
      id: duplicate.id,
      sourceType: duplicate.sourceType,
      sourceRef: duplicate.sourceRef,
      requester: duplicate.requester || "业务用户",
      requestTime: duplicate.time,
      generatedTime: duplicate.time,
      duplicateOf: request.id,
      duplicateRelation: duplicate.relation,
      duplicateRequests: [],
    })),
  ]);
}

function buildTaskFromDecision(request, form) {
  const now = formatNow();
  const id = `TD-${Date.now().toString().slice(-10)}`;
  return {
    id,
    requestId: request.id,
    reminderId: request.reminderId,
    subjectId: request.subjectId,
    subjectName: request.subjectName,
    owner: form.owner,
    ownerId: request.ownerId,
    title: `推进${request.subjectName}${request.actionType.name}`,
    actionType: request.actionType,
    ruleLabel: request.rule ? `${request.rule.id} ${request.rule.name} · ${request.rule.version}` : "Rule 条件引用：不适用",
    metricLabel: `${request.metric.name} ${request.metric.value}`,
    dataVersion: request.evidence.dataVersion,
    cutoff: request.evidence.cutoff,
    createdAt: now,
    dueDate: form.dueDate,
    status: "pending",
    overdue: false,
    instructions: form.instructions,
    banks: form.banks,
    decisionReason: form.reason,
    progress: [],
    history: [
      { time: request.decision.time, label: "人工确认", detail: `${form.owner} · ${form.reason}` },
      { time: now, label: "待办创建", detail: `到期日 ${form.dueDate}` },
    ],
    sourceChanged: false,
    sourceChangeEvent: null,
    failure: null,
    result: null,
    correction: null,
    updateAttempts: 0,
  };
}

function DecisionRail({ onReset, onNavigate }) {
  return (
    <aside className="app-rail" aria-label="平台模块栏">
      <div className="rail-logo" title="Ontology 3.0"><DCIcon name="Orbit" size={18} /></div>
      <button type="button" className="active" title="决策中心" aria-label="决策中心" onClick={() => onNavigate("workbench")}><DCIcon name="Scale" size={18} /></button>
      <div className="rail-spacer"></div>
      <button type="button" onClick={onReset} title="重置状态" aria-label="重置状态"><DCIcon name="RotateCcw" size={17} /></button>
    </aside>
  );
}

function DecisionProductNav({ route, onNavigate }) {
  const active = route.parts[0] === "overview" ? "overview" : "workbench";
  const items = [
    { id: "workbench", label: "决策工作台", icon: "Inbox" },
    { id: "overview", label: "决策运营概览", icon: "Gauge" },
  ];
  return (
    <nav className="product-nav" aria-label="决策中心导航">
      <div className="product-nav-head">
        <span><DCIcon name="Scale" size={17} /></span>
        <div><strong>决策中心</strong><small>判断 · 承接 · 执行 · 追溯</small></div>
      </div>
      <div className="product-nav-list">
        <div className="product-nav-label">工作区</div>
        {items.map((item) => (
          <button type="button" key={item.id} className={`product-nav-item ${active === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
            <DCIcon name={item.icon} size={16} />
            <span>{item.label}</span>
            <DCIcon name="ChevronRight" size={13} className="nav-chevron" />
          </button>
        ))}
      </div>
    </nav>
  );
}

function routeTitle(route, data) {
  const [root, type, id] = route.parts;
  if (root === "overview") return ["决策中心", "决策运营概览"];
  if (root === "request") return ["决策工作台", data.requests.find((item) => item.id === type)?.subjectName || "Action Request"];
  if (root === "reminder") return ["决策工作台", data.requests.find((item) => item.reminderId === type)?.subjectName || "提醒详情"];
  if (root === "task") return ["决策工作台", data.tasks.find((item) => item.id === type)?.subjectName || "待办详情"];
  if (root === "trace") return ["决策工作台", "全链路追溯"];
  return ["决策中心", "决策工作台"];
}

function DecisionTopbar({ route, data }) {
  const [parent, title] = routeTitle(route, data);
  return (
    <header className="app-topbar">
      <div className="breadcrumb"><span>智财问策</span><DCIcon name="ChevronRight" size={12} /><span>{parent}</span><DCIcon name="ChevronRight" size={12} /><strong>{title}</strong></div>
    </header>
  );
}

function WorkbenchScreen({ data, onNavigate }) {
  const route = parseDecisionRoute();
  const requestedView = ["reminders", "tasks", "requests"].includes(route.query.view) ? route.query.view : "reminders";
  const [view, setView] = useState(requestedView);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(route.query.status || "all");
  const [layout, setLayout] = useState(() => window.innerWidth <= 760 ? "cards" : "list");

  useEffect(() => { setView(requestedView); setStatusFilter(route.query.status || "all"); }, [requestedView, route.query.status]);

  const awaitingCount = data.requests.filter((item) => item.status === "awaiting").length;
  const blockedCount = data.requests.filter((item) => ["blocked", "create_failed", "replaced"].includes(item.status)).length;
  const activeTasks = data.tasks.filter((item) => ["pending", "in_progress", "execution_failed", "correcting"].includes(item.status)).length;
  const directoryRequests = view === "requests" ? expandDecisionRequests(data.requests) : data.requests;

  const changeView = (next) => {
    setView(next);
    onNavigate(`workbench?view=${next}`, {}, true);
  };

  const filteredRequests = directoryRequests.filter((item) => {
    const haystack = `${item.subjectName} ${item.id} ${item.reminderId} ${item.metric.name} ${item.actionType.name} ${item.owner}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesSource = sourceFilter === "all" || item.sourceType === sourceFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesSource && matchesStatus;
  });
  const filteredTasks = data.tasks.filter((item) => {
    const haystack = `${item.subjectName} ${item.id} ${item.owner} ${item.title}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter);
  });

  return (
    <div className="page-shell">
      <DCPageHeader
        eyebrow="决策工作台"
        title="需要判断与推进的行动"
        description="逐条核对业务主体、触发原因、证据和建议，再决定是否交给负责人执行。"
        actions={<DCButton icon="Gauge" onClick={() => onNavigate("overview")}>查看运营概览</DCButton>}
      />
      <div className="workbench-summary">
        <button type="button" onClick={() => { setStatusFilter("awaiting"); changeView("reminders"); }}><span className="summary-icon warning"><DCIcon name="Clock3" /></span><div><strong>{awaitingCount}</strong><small>待确认提醒</small></div><DCIcon name="ChevronRight" size={14} /></button>
        <button type="button" onClick={() => { setStatusFilter("all"); changeView("tasks"); }}><span className="summary-icon blue"><DCIcon name="ListTodo" /></span><div><strong>{activeTasks}</strong><small>进行中待办</small></div><DCIcon name="ChevronRight" size={14} /></button>
        <button type="button" onClick={() => { setStatusFilter("blocked"); changeView("requests"); }}><span className="summary-icon danger"><DCIcon name="ShieldAlert" /></span><div><strong>{blockedCount}</strong><small>需要处理的异常</small></div><DCIcon name="ChevronRight" size={14} /></button>
      </div>

      <section className="content-panel workbench-panel">
        <div className="panel-toolbar split">
          <DCTabs
            value={view}
            onChange={changeView}
            items={[
              { value: "reminders", label: "决策提醒", icon: "BellRing", count: data.requests.filter((item) => item.reminderId).length },
              { value: "tasks", label: "负责人待办", icon: "ListTodo", count: data.tasks.length },
              { value: "requests", label: "Action Request", icon: "Waypoints", count: data.requests.length + data.requests.reduce((sum, item) => sum + item.duplicateRequests.length, 0) },
            ]}
          />
          <div className="toolbar-actions">
            <DCSearch value={search} onChange={setSearch} placeholder={view === "tasks" ? "搜索主体、待办或负责人" : "搜索主体、请求或指标"} />
            {view !== "tasks" ? <DCSelect label="来源" value={sourceFilter} onChange={setSourceFilter} options={[
              { value: "all", label: "全部来源" },
              { value: "rule", label: "Rule 自动命中" },
              { value: "qa", label: "智能问数" },
              { value: "agent", label: "Agent 应用" },
              { value: "report", label: "报告中心仪表盘" },
            ]} /> : null}
            <DCSelect label="状态" value={statusFilter} onChange={setStatusFilter} options={view === "tasks" ? [
              { value: "all", label: "全部状态" }, { value: "pending", label: "待处理" }, { value: "in_progress", label: "处理中" },
              { value: "execution_failed", label: "执行失败" }, { value: "completed", label: "已完成" }, { value: "cancelled", label: "已取消" },
            ] : [
              { value: "all", label: "全部状态" }, { value: "awaiting", label: "待确认" }, { value: "confirmed", label: "已确认" },
              { value: "rejected", label: "已拒绝" }, { value: "blocked", label: "已阻断" }, { value: "create_failed", label: "待办创建失败" }, { value: "replaced", label: "证据已纠正" },
            ]} />
            <div className="layout-toggle" aria-label="展示方式">
              <DCIconButton icon="Rows3" label="列表展示" active={layout === "list"} onClick={() => setLayout("list")} />
              <DCIconButton icon="LayoutGrid" label="卡片展示" active={layout === "cards"} onClick={() => setLayout("cards")} />
            </div>
          </div>
        </div>

        {view === "tasks" ? (
          <TaskDirectory tasks={filteredTasks} layout={layout} onNavigate={onNavigate} />
        ) : (
          <RequestDirectory requests={filteredRequests} mode={view} layout={layout} onNavigate={onNavigate} />
        )}
      </section>
    </div>
  );
}

function RequestDirectory({ requests, mode, layout, onNavigate }) {
  if (!requests.length) return <DCEmpty title="没有符合条件的记录" description="调整搜索词或筛选条件后重新查看。" action={<DCButton icon="RotateCcw" onClick={() => window.location.reload()}>恢复当前视图</DCButton>} />;
  if (layout === "cards") {
    return (
      <div className="record-card-grid">
        {requests.map((item) => (
          <article className="record-card" key={item.id}>
            <header><DCSourceBadge type={item.sourceType} compact /><DCStatus status={item.status} compact /></header>
            <div className="record-card-title"><span>{item.subjectName}</span><strong>{item.metric.name}</strong></div>
            <div className="record-primary"><strong>{item.metric.value}</strong><span>{item.metric.explanation}</span></div>
            <dl><div><dt>Action Type</dt><dd>{item.actionType.name}</dd></div><div><dt>负责人</dt><dd>{item.owner}</dd></div><div><dt>数据截至</dt><dd>{item.evidence.cutoff}</dd></div></dl>
            <footer><span>{mode === "requests" ? item.id : item.reminderId}</span><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(mode === "requests" ? `request/${item.id}` : `reminder/${item.reminderId}`)}>查看详情</DCButton></footer>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="record-table-wrap">
      <table className="record-table">
        <thead><tr><th>业务主体</th><th>触发原因 / 指标</th><th>来源</th><th>建议负责人</th><th>状态</th><th>生成时间</th><th></th></tr></thead>
        <tbody>{requests.map((item) => (
          <tr key={item.id}>
            <td><strong>{item.subjectName}</strong><small>{item.subjectId}</small></td>
            <td><strong>{item.rule ? `${item.rule.id} ${item.rule.name}` : item.metric.name}</strong><small>{item.metric.name} {item.metric.value}</small></td>
            <td><DCSourceBadge type={item.sourceType} compact /><small>{item.id}</small></td>
            <td><span>{item.owner}</span><small>{item.actionType.name}</small></td>
            <td><DCStatus status={item.status} compact />{item.duplicateRequests.length ? <small>{item.duplicateRequests.length + 1} 个来源请求</small> : null}</td>
            <td><span className="mono table-time">{item.generatedTime}</span><small>截至 {item.evidence.cutoff.split(" ")[0]}</small></td>
            <td><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(mode === "requests" ? `request/${item.id}` : `reminder/${item.reminderId}`)}>查看详情</DCButton></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TaskDirectory({ tasks, layout, onNavigate }) {
  if (!tasks.length) return <DCEmpty icon="ListTodo" title="没有符合条件的待办" description="待办只会在人工确认成功后创建。" />;
  if (layout === "cards") {
    return <div className="record-card-grid">{tasks.map((task) => {
      const visual = taskVisualStatus(task);
      return <article className="record-card task-card" key={task.id}>
        <header><span className="plain-chip"><DCIcon name="Building2" size={12} />{task.subjectName}</span><DCStatus status={visual.status} suffix={visual.suffix} compact /></header>
        <div className="record-card-title"><strong>{task.title}</strong></div>
        <div className="task-owner"><span className="avatar-small">{task.owner.slice(-2)}</span><div><strong>{task.owner}</strong><small>到期 {task.dueDate}</small></div></div>
        <dl><div><dt>决策依据</dt><dd>{task.metricLabel}</dd></div><div><dt>优先银行</dt><dd>{task.banks.slice(0, 2).join("、")}</dd></div></dl>
        <footer><span>{task.id}</span><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></footer>
      </article>;
    })}</div>;
  }
  return (
    <div className="record-table-wrap"><table className="record-table task-table"><thead><tr><th>待办</th><th>业务主体</th><th>负责人</th><th>到期时间</th><th>状态</th><th>最近进展</th><th></th></tr></thead><tbody>
      {tasks.map((task) => { const visual = taskVisualStatus(task); return <tr key={task.id}>
        <td><strong>{task.title}</strong><small>{task.id}</small></td><td><strong>{task.subjectName}</strong><small>{task.metricLabel}</small></td><td>{task.owner}</td>
        <td><span className={task.overdue ? "danger-text" : ""}>{task.dueDate}</span><small>{task.overdue ? "已超过到期时间" : "确认后第 5 个工作日"}</small></td>
        <td><DCStatus status={visual.status} suffix={visual.suffix} compact /></td><td><span>{task.progress.at(-1)?.content || "尚无进展记录"}</span></td>
        <td><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></td>
      </tr>; })}
    </tbody></table></div>
  );
}

function RequestDetailScreen({ request, onNavigate }) {
  if (!request) return <MissingScreen onNavigate={onNavigate} />;
  const sourceRuleLabel = request.rule ? `${request.rule.id} ${request.rule.name} · ${request.rule.version}` : "不适用";
  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => window.history.back()}
        eyebrow="Action Request"
        title={`${request.subjectName} · ${request.actionType.name}`}
        description={`${SOURCE_META[request.sourceType].label}于 ${request.requestTime} 发起，当前状态：${requestStatusLabel(request)}。`}
        meta={<><span className="mono">{request.id}</span><DCSourceBadge type={request.sourceType} compact /><DCStatus status={request.status} compact /></>}
        actions={<><DCButton icon="Route" onClick={() => onNavigate(`trace/request/${request.id}`)}>查看追溯</DCButton><DCButton variant="primary" icon="BellRing" onClick={() => onNavigate(`reminder/${request.reminderId}`)}>查看提醒</DCButton></>}
      />

      {request.status === "blocked" ? <DCAlert tone="danger" title="当前请求不能进入人工确认" actions={request.evidence.previousTrusted ? <DCButton size="sm" onClick={() => document.getElementById("previous-trusted")?.scrollIntoView({ behavior: "smooth" })}>查看上一可信证据</DCButton> : null}>{request.blockReason} {request.recovery}</DCAlert> : null}
      {request.status === "replaced" ? <DCAlert tone="warning" title="原证据已被纠正" actions={<DCButton size="sm" onClick={() => onNavigate("workbench?view=requests")}>查看请求目录</DCButton>}>{request.blockReason} {request.recovery}</DCAlert> : null}
      {request.duplicateOf ? <DCAlert tone="info" title="严格重复请求已关联到现有提醒" actions={<DCButton size="sm" onClick={() => onNavigate(`request/${request.duplicateOf}`)}>查看最早请求</DCButton>}>{request.id} 保留独立来源记录，并关联到提醒 {request.reminderId}；不会重复创建提醒或待办。</DCAlert> : null}

      <div className="two-column-detail">
        <main className="detail-main">
          <section className="content-panel section-card">
            <DCSectionHeader title="请求目标" />
            <DCKeyValues columns={2} items={[
              { label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` },
              { label: "所属场景", value: request.scenario },
              { label: "Action Type", value: `${request.actionType.name} · ${request.actionType.id}` },
              { label: "发布版本", value: `${request.actionType.version} · ${request.actionType.status}` },
              { label: "建议负责人", value: request.owner },
              { label: "请求时间", value: request.requestTime, mono: true },
            ]} />
          </section>
          <section className="content-panel section-card">
            <DCSectionHeader title="来源与条件引用" />
            <div className="source-detail-head"><DCSourceBadge type={request.sourceType} /><div><strong>{request.sourceRef}</strong><span>发起者：{request.requester}</span></div></div>
            <DCKeyValues columns={2} items={[
              { label: "Rule 条件引用", value: sourceRuleLabel },
              { label: "评估时间", value: request.rule?.evaluatedAt || "不适用" },
              { label: "触发分支或条件", value: request.rule?.branch || "不适用" },
              { label: "命中证据", value: request.rule?.hitEvidence || "不适用" },
            ]} />
          </section>
          <section className="content-panel section-card">
            <DCSectionHeader title="固定指标证据" />
            <div className="metric-focus"><div><span>{request.metric.name}</span><strong>{request.metric.value}</strong></div><p>{request.metric.explanation}</p></div>
            <DCKeyValues columns={3} items={[
              { label: "Metric 引用", value: request.metric.id, mono: true },
              { label: "对象范围", value: request.metric.scope },
              { label: "评估时间", value: request.metric.evaluatedAt, mono: true },
            ]} />
          </section>
          {request.evidence.previousTrusted ? <section className="content-panel section-card" id="previous-trusted">
            <DCSectionHeader title="上一可信证据" description="当前候选版本不可消费时，已确认的上一可信结果继续只读服务。" />
            <DCKeyValues columns={2} items={[
              { label: "数据版本", value: request.evidence.previousTrusted.dataVersion, mono: true },
              { label: "数据截至时间", value: request.evidence.previousTrusted.cutoff },
              { label: "指标结果", value: request.evidence.previousTrusted.metricValue },
              { label: "服务状态", value: request.evidence.previousTrusted.status },
            ]} />
          </section> : null}
        </main>
        <aside className="detail-aside">
          <section className="content-panel sticky-card">
            <DCSectionHeader title="证据可信度" />
            <div className="trust-list">
              <div><span><DCIcon name="BookOpenCheck" />语义版本</span><strong>{request.evidence.semanticVersion}</strong></div>
              <div><span><DCIcon name="Database" />数据版本</span><strong>{request.evidence.dataVersion}</strong></div>
              <div><span><DCIcon name="CalendarClock" />数据截至</span><strong>{request.evidence.cutoff}</strong></div>
              <div><span><DCIcon name="ShieldCheck" />质量</span><strong>{request.evidence.quality}</strong></div>
              <div><span><DCIcon name="PlugZap" />可用状态</span><strong>{request.evidence.ready}</strong></div>
              <div><span><DCIcon name="Fingerprint" />快照标识</span><strong className="mono">{request.evidence.snapshotId}</strong></div>
            </div>
          </section>
          {request.duplicateRequests.length ? <section className="content-panel section-card compact-card"><DCSectionHeader title="关联来源请求" count={request.duplicateRequests.length + 1} /><p className="support-copy">固定证据完全一致的开放请求关联到同一提醒，原请求仍逐条保留。</p>{request.duplicateRequests.map((item) => <div className="linked-request" key={item.id}><DCSourceBadge type={item.sourceType} compact /><div><strong>{item.id}</strong><small>{item.relation} · {item.time}</small></div></div>)}</section> : null}
        </aside>
      </div>
    </div>
  );
}

function EvidencePanel({ request }) {
  const [loanSearch, setLoanSearch] = useState("");
  const loans = request.loans.filter((loan) => `${loan.id} ${loan.bank} ${loan.type}`.toLowerCase().includes(loanSearch.toLowerCase()));
  return (
    <div className="evidence-stack">
      <section className="content-panel section-card">
        <DCSectionHeader title="为什么提醒" description="先看行动类型，再看适用的 Rule 条件和指标证据。" />
        <div className="why-grid">
          <article><span className="step-kicker">行动类型</span><strong>{request.actionType.name}</strong><p>{request.actionType.id} · {request.actionType.version} · {request.actionType.status}</p></article>
          <article><span className="step-kicker">Rule 条件引用</span><strong>{request.rule ? `${request.rule.id} ${request.rule.name}` : "不适用"}</strong><p>{request.rule ? request.rule.hitEvidence : "当前来源证据没有引用 Rule，不补造 Rule 条件。"}</p></article>
          <article className="metric-article"><span className="step-kicker">Metric 快照</span><strong>{request.metric.value}</strong><p>{request.metric.name} · {request.metric.explanation}</p></article>
        </div>
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="先和谁协商" description="排序来自固定证据，确认时可以调整本次执行顺序，但不会改写原始排名。" />
        {request.banks.length ? <div className="bank-rank-list">{request.banks.map((bank, index) => <article key={bank.name}><span className="rank-number">{index + 1}</span><div className="bank-name"><strong>{bank.name}</strong><small>{bank.note}</small></div><div><strong>{bank.balance}</strong><small>问题余额</small></div><div><strong>{bank.contribution}</strong><small>贡献占比</small></div><div><strong>{bank.loanCount} 笔</strong><small>关联借据</small></div></article>)}</div> : <DCEmpty icon="Landmark" title="建议银行证据缺失" description="当前版本无法核对金融机构映射，因此不会生成银行排名。" />}
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="涉及哪些贷款" count={request.loanCount} actions={<DCSearch value={loanSearch} onChange={setLoanSearch} placeholder="搜索借据、银行或类型" />} />
        {loans.length ? <div className="loan-table-wrap"><table className="loan-table"><thead><tr><th>借据编号</th><th>金融机构</th><th>贷款类型</th><th>余额</th><th>利率 / 定价</th></tr></thead><tbody>{loans.map((loan) => <tr key={loan.id}><td className="mono">{loan.id}</td><td>{loan.bank}</td><td>{loan.type}</td><td>{loan.balance}</td><td>{loan.rate}</td></tr>)}</tbody></table><div className="table-footnote">当前显示证据包中的高贡献借据；共关联 {request.loanCount} 笔。</div></div> : <DCEmpty icon="FileSearch" title="没有匹配的借据" description="调整搜索词后重新查看。" />}
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="证据是否可信" />
        <div className="trust-cards"><article><DCIcon name="BookOpenCheck" /><span>语义版本</span><strong>{request.evidence.semanticVersion}</strong></article><article><DCIcon name="Database" /><span>数据版本</span><strong>{request.evidence.dataVersion}</strong></article><article><DCIcon name="CalendarClock" /><span>数据截至时间</span><strong>{request.evidence.cutoff}</strong></article><article><DCIcon name="ShieldCheck" /><span>质量与可用</span><strong>{request.evidence.quality} · {request.evidence.ready}</strong></article></div>
      </section>
    </div>
  );
}

function DecisionModal({ open, request, mode, onClose, onSubmit }) {
  const initialDue = addWorkdays(new Date(), 5);
  const [stage, setStage] = useState("form");
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState(request.owner);
  const [dueDate, setDueDate] = useState(initialDue);
  const [instructions, setInstructions] = useState(request.recommendation);
  const [banks, setBanks] = useState(request.banks.map((item) => item.name));
  const [ownerChangeReason, setOwnerChangeReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("form"); setReason(""); setOwner(request.owner); setDueDate(addWorkdays(new Date(), 5));
    setInstructions(request.recommendation); setBanks(request.banks.map((item) => item.name)); setOwnerChangeReason(""); setError("");
  }, [open, request.id, mode]);

  const form = { reason, owner, dueDate, instructions, banks, ownerChangeReason };
  const validate = () => {
    if (!reason.trim()) return "请填写本次决定理由。";
    if (mode === "confirm" && !owner.trim()) return "请选择明确负责人。";
    if (mode === "confirm" && owner !== request.owner && !ownerChangeReason.trim()) return "修改负责人时必须填写修改理由。";
    if (mode === "confirm" && !dueDate) return "请选择到期时间。";
    if (mode === "confirm" && !instructions.trim()) return "请填写执行说明。";
    if (mode === "confirm" && !banks.length) return "至少保留一家本次协商银行。";
    return "";
  };
  const goReview = () => { const message = validate(); if (message) { setError(message); return; } setError(""); setStage("review"); };
  const submit = async () => { setStage("submitting"); const result = await onSubmit(mode, form); if (!result.ok) { setError(result.message); setStage("error"); } };

  const checks = [
    ["业务主体唯一", `${request.subjectName} · ${request.subjectId}`, true],
    ["Action Type 已发布", `${request.actionType.name} · ${request.actionType.version}`, true],
    ["Rule 条件引用", request.rule ? `${request.rule.id} · ${request.rule.version} · 命中证据完整` : "不适用，来源证据未引用 Rule", true],
    ["Metric 快照完整", `${request.metric.name} ${request.metric.value}`, true],
    ["双版本一致", `${request.evidence.semanticVersion} / ${request.evidence.dataVersion}`, request.evidence.ready === "消费就绪"],
    ["质量与可用", `${request.evidence.quality} · ${request.evidence.ready}`, request.evidence.ready === "消费就绪"],
  ];

  return (
    <DCModal open={open} onClose={() => stage !== "submitting" && onClose()} title={mode === "confirm" ? "确认并创建负责人待办" : "拒绝本次行动建议"} description={`${request.subjectName} · ${request.actionType.name}`} icon={mode === "confirm" ? "CircleCheckBig" : "CircleMinus"} width="820px" footer={stage === "form" ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant="primary" icon="ArrowRight" onClick={goReview}>核对提交内容</DCButton></> : stage === "review" ? <><DCButton onClick={() => setStage("form")}>返回修改</DCButton><DCButton variant={mode === "confirm" ? "primary" : "danger"} icon={mode === "confirm" ? "Check" : "CircleMinus"} onClick={submit}>{mode === "confirm" ? "确认并创建待办" : "确认拒绝"}</DCButton></> : stage === "error" ? <><DCButton onClick={onClose}>暂时关闭</DCButton><DCButton variant="primary" icon="RefreshCw" onClick={submit}>重试提交</DCButton></> : null}>
      {stage === "submitting" ? <DCLoadingBlock title="正在提交人工决定" description="系统将先固定人工决定，再创建独立负责人待办。" /> : null}
      {stage === "error" ? <div className="submission-error"><DCAlert tone="danger" title="提交没有完成">{error} 已保留表单内容，请核对后重试。</DCAlert><DCKeyValues columns={2} items={[{ label: "业务主体", value: request.subjectName }, { label: "本次决定", value: mode === "confirm" ? "确认" : "拒绝" }, { label: "负责人", value: owner }, { label: "到期时间", value: dueDate }]} /></div> : null}
      {stage === "form" ? <div className="decision-form-layout">
        <div className="validation-panel"><h3>确认前校验</h3><div className="validation-list">{checks.map(([label, detail, pass]) => <div key={label} className={pass ? "pass" : "fail"}><DCIcon name={pass ? "CircleCheck" : "CircleX"} /><div><strong>{label}</strong><small>{detail}</small></div></div>)}</div></div>
        <div className="form-panel"><DCTextarea label={mode === "confirm" ? "确认理由" : "拒绝理由"} value={reason} onChange={setReason} required placeholder={mode === "confirm" ? "说明为什么需要推进这项行动" : "说明本次不推进的业务原因"} error={error} />
          {mode === "confirm" ? <>
            <DCField label="负责人" value={owner} onChange={setOwner} required hint="默认取主体—负责人关系，本次修改不会回写本体。" />
            {owner !== request.owner ? <DCTextarea label="负责人修改理由" value={ownerChangeReason} onChange={setOwnerChangeReason} required placeholder="说明本次为何改由其他负责人承接" /> : null}
            <DCField label="到期时间" type="date" value={dueDate} onChange={setDueDate} required hint="默认：确认成功后的第 5 个工作日；确认日不计，周末不计。" />
            <DCTextarea label="执行说明" value={instructions} onChange={setInstructions} required />
            <fieldset className="bank-selector"><legend>本次协商银行</legend>{request.banks.map((bank, index) => <label key={bank.name}><input type="checkbox" checked={banks.includes(bank.name)} onChange={(event) => setBanks((current) => event.target.checked ? [...current, bank.name] : current.filter((name) => name !== bank.name))} /><span className="rank-number small">{index + 1}</span><strong>{bank.name}</strong><small>{bank.note}</small></label>)}</fieldset>
          </> : null}
        </div>
      </div> : null}
      {stage === "review" ? <div className="decision-review"><DCAlert tone={mode === "confirm" ? "info" : "warning"} title={mode === "confirm" ? "提交成功后会创建一条独立待办" : "拒绝后不会创建待办"}>{mode === "confirm" ? "本次确认只影响这条主体记录，不会修改 Rule、Metric 或原始证据。" : "原请求、证据和拒绝理由会继续保留在追溯中。"}</DCAlert><DCKeyValues columns={2} items={[
        { label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` }, { label: "本次决定", value: mode === "confirm" ? "确认" : "拒绝" },
        { label: "决定理由", value: reason }, { label: "负责人", value: mode === "confirm" ? owner : "不创建待办" },
        { label: "到期时间", value: mode === "confirm" ? dueDate : "不适用" }, { label: "协商银行", value: mode === "confirm" ? banks.join("、") : "不适用" },
      ]} />{mode === "confirm" ? <div className="review-instructions"><span>执行说明</span><p>{instructions}</p></div> : null}</div> : null}
    </DCModal>
  );
}

function ReminderDetailScreen({ request, onNavigate, submitDecision, retryCreateTask }) {
  const [tab, setTab] = useState("decision");
  const [decisionMode, setDecisionMode] = useState(null);
  if (!request) return <MissingScreen onNavigate={onNavigate} />;
  const canDecide = request.status === "awaiting";
  const task = null;
  const tabItems = [{ value: "decision", label: "处置建议", icon: "Scale" }, { value: "evidence", label: "证据", icon: "FileSearch" }, { value: "sources", label: "关联请求", icon: "Waypoints", count: request.duplicateRequests.length + 1 }, { value: "changes", label: "变更记录", icon: "History" }];
  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => window.history.back()}
        eyebrow="决策提醒"
        title={`${request.subjectName}需要判断：${request.actionType.name}`}
        description={request.metric.explanation}
        meta={<><span className="mono">{request.reminderId}</span><DCSourceBadge type={request.sourceType} compact /><DCStatus status={request.status} compact /></>}
        actions={<><DCButton icon="Route" onClick={() => onNavigate(`trace/reminder/${request.reminderId}`)}>查看追溯</DCButton>{canDecide ? <DCButton icon="CircleMinus" onClick={() => setDecisionMode("reject")}>拒绝</DCButton> : null}{canDecide ? <DCButton variant="primary" icon="CircleCheckBig" onClick={() => setDecisionMode("confirm")}>确认</DCButton> : null}</>}
      />

      {request.status === "blocked" ? <DCAlert tone="danger" title="证据门阻断人工确认">{request.blockReason} {request.recovery}</DCAlert> : null}
      {request.status === "replaced" ? <DCAlert tone="warning" title="证据已被上游纠正" actions={<DCButton size="sm" onClick={() => onNavigate("workbench?view=requests")}>查看替代请求</DCButton>}>{request.blockReason} 原证据保持只读，不能继续确认。</DCAlert> : null}
      {request.status === "create_failed" ? <DCAlert tone="danger" title="人工确认已保存，但待办创建失败" actions={<DCButton size="sm" variant="primary" icon="RefreshCw" onClick={() => retryCreateTask(request.id)}>重试创建待办</DCButton>}>负责人目录在首次创建时未返回明确结果。无需重复确认，修复后可直接重试。</DCAlert> : null}
      {request.taskCreating ? <DCAlert tone="info" title="正在创建负责人待办"><span className="inline-loading"><DCIcon name="LoaderCircle" className="spin" />人工决定已固定，正在形成独立待办。</span></DCAlert> : null}
      {request.status === "confirmed" && request.decision ? <DCAlert tone="success" title="已完成人工确认" actions={<DCButton size="sm" onClick={() => request.taskId && onNavigate(`task/${request.taskId}`)}>查看待办</DCButton>}>{request.decision.owner} 已承接，到期时间 {request.decision.dueDate}。</DCAlert> : null}
      {request.status === "rejected" && request.decision ? <DCAlert tone="info" title="已拒绝本次行动建议">{request.decision.reason} · {request.decision.time}</DCAlert> : null}

      <div className="reminder-hero content-panel">
        <div className="hero-fact"><span>发生了什么</span><strong>{request.metric.name} {request.metric.value}</strong><p>{request.metric.explanation}</p></div>
        <div className="hero-fact"><span>为什么产生</span><strong>{request.rule ? `${request.rule.id} ${request.rule.name}` : `${SOURCE_META[request.sourceType].label}提出建议`}</strong><p>{request.rule ? request.rule.hitEvidence : "当前来源证据未引用 Rule"}</p></div>
        <div className="hero-fact recommendation"><span>推荐决策</span><strong>{request.recommendation}</strong><p>优先银行：{request.banks.length ? request.banks.map((item) => item.name).join("、") : "待证据恢复后生成"}</p></div>
      </div>

      <DCTabs items={tabItems} value={tab} onChange={setTab} />
      {tab === "decision" ? <div className="decision-tab-layout">
        <main className="detail-main">
          <section className="content-panel section-card"><DCSectionHeader title="建议怎么做" description="建议只辅助判断，最终决定由用户提交。" /><div className="recommendation-box"><span><DCIcon name="Sparkles" /></span><div><strong>{request.recommendation}</strong><p>建议按证据贡献从高到低协商，并在待办中记录实际银行、范围和结果。</p></div></div></section>
          <section className="content-panel section-card"><DCSectionHeader title="优先协商银行" />{request.banks.length ? <div className="bank-rank-list compact">{request.banks.map((bank, index) => <article key={bank.name}><span className="rank-number">{index + 1}</span><div className="bank-name"><strong>{bank.name}</strong><small>{bank.note}</small></div><div><strong>{bank.balance}</strong><small>问题余额</small></div><div><strong>{bank.contribution}</strong><small>贡献占比</small></div></article>)}</div> : <DCEmpty icon="Landmark" title="暂无可确认的银行建议" description="当前证据无法核对机构映射。" />}</section>
        </main>
        <aside className="detail-aside"><section className="content-panel sticky-card"><DCSectionHeader title="判断前先核对" /><div className="decision-checklist"><div><DCIcon name="Building2" /><span>业务主体</span><strong>{request.subjectName}</strong></div><div><DCIcon name="UserRound" /><span>建议负责人</span><strong>{request.owner}</strong></div><div><DCIcon name="Database" /><span>数据版本</span><strong>{request.evidence.dataVersion}</strong></div><div><DCIcon name="CalendarClock" /><span>数据截至</span><strong>{request.evidence.cutoff}</strong></div><div><DCIcon name="ShieldCheck" /><span>证据状态</span><strong>{request.evidence.freshness}</strong></div></div>{canDecide ? <div className="sticky-actions"><DCButton onClick={() => setDecisionMode("reject")}>拒绝</DCButton><DCButton variant="primary" onClick={() => setDecisionMode("confirm")}>确认并交办</DCButton></div> : null}</section></aside>
      </div> : null}
      {tab === "evidence" ? <EvidencePanel request={request} /> : null}
      {tab === "sources" ? <section className="content-panel section-card"><DCSectionHeader title="关联 Action Request" description="所有原请求逐条保留；严格重复只关联开放提醒，不合并业务主体或待办。" count={request.duplicateRequests.length + 1} /><div className="request-chain-list"><button type="button" onClick={() => onNavigate(`request/${request.id}`)}><DCSourceBadge type={request.sourceType} /><div><strong>{request.id}</strong><span>{request.sourceRef}</span></div><DCStatus status={request.status} compact /><DCIcon name="ChevronRight" /></button>{request.duplicateRequests.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(`request/${item.id}`)}><DCSourceBadge type={item.sourceType} /><div><strong>{item.id}</strong><span>{item.sourceRef}</span></div><span className="plain-chip">{item.relation}</span><DCIcon name="ChevronRight" /></button>)}</div></section> : null}
      {tab === "changes" ? <section className="content-panel section-card"><DCSectionHeader title="变更记录" description="撤回、纠正和替代只追加事实，不覆盖原证据和人工决定。" />{request.sourceEvents.length ? <DCTimeline items={request.sourceEvents.map((event) => ({ time: event.time, label: event.type, detail: `${event.reason}${event.replacementId ? ` · 替代请求 ${event.replacementId}` : ""}`, icon: "RefreshCw", tone: "warning" }))} /> : <DCEmpty icon="History" title="没有来源变更" description="当前请求的固定证据尚未收到撤回、纠正或替代事实。" />}</section> : null}
      <DecisionModal open={Boolean(decisionMode)} request={request} mode={decisionMode || "confirm"} onClose={() => setDecisionMode(null)} onSubmit={async (mode, form) => { const result = await submitDecision(request.id, mode, form); if (result.ok) setDecisionMode(null); return result; }} />
    </div>
  );
}

function TaskActionModal({ open, type, task, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState("");
  const [bank, setBank] = useState(task.banks[0] || "");
  const [nextStep, setNextStep] = useState("");
  const [owner, setOwner] = useState(task.owner);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [instructions, setInstructions] = useState(task.instructions);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setReason(""); setResult(""); setBank(task.banks[0] || ""); setNextStep(""); setOwner(task.owner); setDueDate(task.dueDate); setInstructions(task.instructions); setSubmitting(false); setError("");
  }, [open, type, task.id]);
  const config = {
    progress: { title: "记录处理进展", icon: "MessageSquarePlus", action: "保存进展" },
    complete: { title: "完成待办", icon: "CircleCheckBig", action: "确认完成" },
    fail: { title: "记录执行失败", icon: "CircleX", action: "确认失败" },
    cancel: { title: "取消待办", icon: "Ban", action: "确认取消" },
    edit: { title: "修改执行安排", icon: "PencilLine", action: "保存修改" },
    correct: { title: "发起结果纠正", icon: "RefreshCw", action: "提交纠正" },
    source_continue: { title: "确认继续执行", icon: "PlayCircle", action: "继续执行" },
  }[type] || { title: "更新待办", icon: "Pencil", action: "保存" };
  const submit = async () => {
    if (type === "progress" && !result.trim()) return setError("请填写本次处理进展。"), undefined;
    if (["complete", "correct"].includes(type) && !result.trim()) return setError("请填写可核对的结果说明。"), undefined;
    if (["fail", "cancel", "source_continue"].includes(type) && !reason.trim()) return setError("请填写本次操作原因。"), undefined;
    if (type === "fail" && !nextStep.trim()) return setError("请填写恢复建议或下一步安排。"), undefined;
    if (type === "edit" && (!reason.trim() || !owner.trim() || !dueDate || !instructions.trim())) return setError("负责人、到期时间、执行说明和修改理由均为必填。"), undefined;
    setSubmitting(true); setError("");
    const response = await onSubmit(type, { reason, result, bank, nextStep, owner, dueDate, instructions });
    if (!response.ok) { setSubmitting(false); setError(response.message); return; }
    onClose();
  };
  return (
    <DCModal open={open} onClose={() => !submitting && onClose()} title={config.title} description={`${task.subjectName} · ${task.id}`} icon={config.icon} width="640px" footer={!submitting ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant={["fail", "cancel"].includes(type) ? "danger" : "primary"} icon={config.icon} onClick={submit}>{config.action}</DCButton></> : null}>
      {submitting ? <DCLoadingBlock title="正在保存操作" description="完成后会同步更新待办状态和追溯记录。" /> : <div className="task-action-form">
        {error ? <DCAlert tone="danger" title="本次操作没有完成">{error} 已保留填写内容，可修改后重试。</DCAlert> : null}
        {type === "progress" ? <DCTextarea label="进展说明" value={result} onChange={setResult} required placeholder="记录已联系对象、当前反馈和下一步" /> : null}
        {type === "complete" ? <><DCTextarea label="完成结果" value={result} onChange={setResult} required placeholder="说明实际完成内容、协商结果和后续安排" /><DCSelect label="主要协商银行" value={bank} onChange={setBank} options={task.banks.length ? task.banks : ["不适用"]} /></> : null}
        {type === "fail" ? <><DCTextarea label="失败原因" value={reason} onChange={setReason} required placeholder="说明本次执行未达到预期的原因" /><DCTextarea label="恢复建议" value={nextStep} onChange={setNextStep} required placeholder="说明可重试条件、责任人或下一步安排" /></> : null}
        {type === "cancel" ? <DCTextarea label="取消原因" value={reason} onChange={setReason} required placeholder="说明为什么不再继续本次待办" /> : null}
        {type === "edit" ? <><div className="form-grid"><DCField label="负责人" value={owner} onChange={setOwner} required /><DCField label="到期时间" type="date" value={dueDate} onChange={setDueDate} required /></div><DCTextarea label="执行说明" value={instructions} onChange={setInstructions} required /><DCTextarea label="修改理由" value={reason} onChange={setReason} required placeholder="说明本次修改原因；原值会保留在追溯中" /></> : null}
        {type === "correct" ? <><DCTextarea label="纠正原因" value={reason} onChange={setReason} required placeholder="说明原记录需要纠正的原因" /><DCTextarea label="纠正后的结果" value={result} onChange={setResult} required placeholder="填写应当保留的新结果" /></> : null}
        {type === "source_continue" ? <><DCAlert tone="warning" title="上游证据已发生变化">继续执行不会覆盖原固定证据；本次理由将与上游变化一并保留。</DCAlert><DCTextarea label="继续执行理由" value={reason} onChange={setReason} required placeholder="说明为什么仍按原人工决定继续" /></> : null}
      </div>}
    </DCModal>
  );
}

function TaskDetailScreen({ task, request, onNavigate, runTaskAction, refreshSource }) {
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  if (!task) return <MissingScreen onNavigate={onNavigate} />;
  const visual = taskVisualStatus(task);
  const canStart = task.status === "pending";
  const canWork = ["in_progress", "execution_failed"].includes(task.status);
  const canEdit = ["pending", "in_progress", "execution_failed"].includes(task.status);
  const canCorrect = ["completed", "cancelled"].includes(task.status);

  const doDirect = async (type) => {
    const result = await runTaskAction(task.id, type, {});
    return result;
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSource(task.id);
    setRefreshing(false);
  };

  const primaryAction = canStart ? <DCButton variant="primary" icon="Play" onClick={() => doDirect("start")}>开始处理</DCButton>
    : task.status === "in_progress" ? <DCButton variant="primary" icon="CircleCheckBig" onClick={() => setAction("complete")}>完成待办</DCButton>
      : task.status === "execution_failed" ? <DCButton variant="primary" icon="RefreshCw" onClick={() => doDirect("retry")}>重试执行</DCButton>
        : null;

  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => window.history.back()}
        eyebrow="负责人待办"
        title={task.title}
        description={`${task.subjectName} · ${task.owner} · 到期 ${task.dueDate}`}
        meta={<><span className="mono">{task.id}</span><DCStatus status={visual.status} suffix={visual.suffix} compact /></>}
        actions={<><DCButton icon="Route" onClick={() => onNavigate(`trace/task/${task.id}`)}>查看追溯</DCButton><DCButton icon="RefreshCw" loading={refreshing} onClick={handleRefresh}>重新读取来源</DCButton>{primaryAction}</>}
      />
      {task.overdue && !["completed", "cancelled", "corrected"].includes(task.status) ? <DCAlert tone="warning" title={`已逾期，仍保持${DC_STATUS_META[task.status]?.label || "当前"}状态`} actions={<DCButton size="sm" onClick={() => setAction("edit")}>调整到期时间</DCButton>}>到期日为 {task.dueDate}。逾期是时间提示，不会覆盖真实执行进度。</DCAlert> : null}
      {task.failure ? <DCAlert tone="danger" title="最近一次执行失败" actions={task.status === "execution_failed" ? <DCButton size="sm" variant="primary" icon="RefreshCw" onClick={() => doDirect("retry")}>重试执行</DCButton> : null}>{task.failure.reason} 恢复建议：{task.failure.nextStep}</DCAlert> : null}
      {task.sourceChanged ? <DCAlert tone="warning" title="上游证据发生变化" actions={<>{!["cancelled", "corrected"].includes(task.status) ? <DCButton size="sm" onClick={() => setAction("source_continue")}>继续执行</DCButton> : null}{!["cancelled", "completed", "corrected"].includes(task.status) ? <DCButton size="sm" variant="danger" onClick={() => setAction("cancel")}>取消待办</DCButton> : null}{["completed", "cancelled"].includes(task.status) ? <DCButton size="sm" variant="primary" onClick={() => setAction("correct")}>发起纠正</DCButton> : null}</>}>{task.sourceChangeEvent?.detail} 上游变化不会自动取消已有人工决定。</DCAlert> : null}
      {task.status === "correcting" ? <DCAlert tone="info" title="正在形成纠正记录"><span className="inline-loading"><DCIcon name="LoaderCircle" className="spin" />原结果保持只读，纠正完成后会并列展示新旧值。</span></DCAlert> : null}

      <div className="task-command-bar content-panel">
        <div className="task-command-main"><span className="avatar-large">{task.owner.slice(-2)}</span><div><span>当前负责人</span><strong>{task.owner}</strong></div><div><span>到期时间</span><strong className={task.overdue ? "danger-text" : ""}>{task.dueDate}</strong></div><div><span>当前状态</span><DCStatus status={visual.status} suffix={visual.suffix} compact /></div></div>
        <div className="task-command-actions">{canEdit ? <DCButton icon="PencilLine" onClick={() => setAction("edit")}>修改安排</DCButton> : null}{task.status === "in_progress" ? <DCButton icon="MessageSquarePlus" onClick={() => setAction("progress")}>记录进展</DCButton> : null}{canWork && task.status !== "execution_failed" ? <DCButton variant="danger-ghost" icon="CircleX" onClick={() => setAction("fail")}>记录失败</DCButton> : null}{["pending", "in_progress", "execution_failed"].includes(task.status) ? <DCButton variant="danger-ghost" icon="Ban" onClick={() => setAction("cancel")}>取消</DCButton> : null}{canCorrect ? <DCButton icon="RefreshCw" onClick={() => setAction("correct")}>发起纠正</DCButton> : null}</div>
      </div>

      <DCTabs value={tab} onChange={setTab} items={[{ value: "overview", label: "执行信息", icon: "ClipboardList" }, { value: "progress", label: "进展与结果", icon: "MessagesSquare", count: task.progress.length }, { value: "basis", label: "决策依据", icon: "FileCheck2" }, { value: "history", label: "状态记录", icon: "History", count: task.history.length }]} />
      {tab === "overview" ? <div className="two-column-detail"><main className="detail-main"><section className="content-panel section-card"><DCSectionHeader title="执行说明" /><p className="task-instructions">{task.instructions}</p><DCKeyValues columns={2} items={[{ label: "确认理由", value: task.decisionReason }, { label: "优先协商银行", value: task.banks.join("、") }, { label: "创建时间", value: task.createdAt, mono: true }, { label: "到期时间", value: task.dueDate }]} /></section><section className="content-panel section-card"><DCSectionHeader title="本次协商范围" /><div className="bank-chip-list">{task.banks.map((bank, index) => <span key={bank}><em>{index + 1}</em>{bank}</span>)}</div></section>{task.result ? <section className="content-panel section-card result-card"><DCSectionHeader title={task.correction ? "当前有效结果" : "完成结果"} /><div className="result-summary"><span><DCIcon name="BadgeCheck" /></span><div><strong>{task.correction?.result || task.result.summary}</strong><p>{task.correction ? `纠正原因：${task.correction.reason}` : `主要协商银行：${task.result.bank}`}</p></div></div></section> : null}</main><aside className="detail-aside"><section className="content-panel sticky-card"><DCSectionHeader title="不可修改的决策依据" /><div className="immutable-list"><div><span>业务主体</span><strong>{task.subjectName} · {task.subjectId}</strong></div><div><span>Action Type</span><strong>{task.actionType.name} · {task.actionType.version}</strong></div><div><span>Rule 条件</span><strong>{task.ruleLabel}</strong></div><div><span>Metric 快照</span><strong>{task.metricLabel}</strong></div><div><span>数据版本</span><strong>{task.dataVersion}</strong></div><div><span>数据截至</span><strong>{task.cutoff}</strong></div></div></section></aside></div> : null}
      {tab === "progress" ? <section className="content-panel section-card"><DCSectionHeader title="进展与结果" actions={task.status === "in_progress" ? <DCButton size="sm" icon="MessageSquarePlus" onClick={() => setAction("progress")}>记录进展</DCButton> : null} />{task.progress.length || task.result ? <div className="progress-feed">{task.progress.map((item, index) => <article key={`${item.time}-${index}`}><span className="avatar-small">{item.author.slice(-2)}</span><div><header><strong>{item.author}</strong><time>{item.time}</time></header><p>{item.content}</p></div></article>)}{task.result ? <article className="final-result"><span><DCIcon name="CircleCheckBig" /></span><div><header><strong>完成结果</strong><time>{task.result.time}</time></header><p>{task.result.summary}</p><small>主要协商银行：{task.result.bank}</small></div></article> : null}{task.correction ? <article className="correction-result"><span><DCIcon name="RefreshCw" /></span><div><header><strong>纠正结果</strong><time>{task.correction.time}</time></header><p>{task.correction.result}</p><small>原因：{task.correction.reason}</small></div></article> : null}</div> : <DCEmpty icon="MessagesSquare" title="尚无处理进展" description="开始待办后，可逐次记录联系情况和阶段结果。" />}</section> : null}
      {tab === "basis" ? <section className="content-panel section-card"><DCSectionHeader title="确认时固定的决策依据" /><DCKeyValues columns={3} items={[{ label: "原提醒", value: task.reminderId, mono: true }, { label: "Action Request", value: task.requestId, mono: true }, { label: "Action Type", value: `${task.actionType.name} · ${task.actionType.version}` }, { label: "Rule 条件引用", value: task.ruleLabel }, { label: "Metric 快照", value: task.metricLabel }, { label: "数据版本", value: task.dataVersion, mono: true }, { label: "数据截至时间", value: task.cutoff }, { label: "人工确认理由", value: task.decisionReason }, { label: "确认后负责人", value: task.owner }]} /><div className="center-action"><DCButton icon="Route" onClick={() => onNavigate(`trace/task/${task.id}`)}>查看完整追溯</DCButton></div></section> : null}
      {tab === "history" ? <section className="content-panel section-card"><DCSectionHeader title="状态记录" description="每次更新保留原状态、目标状态、操作内容和结果。" /><DCTimeline items={[...task.history].reverse().map((item) => ({ ...item, icon: item.label.includes("失败") ? "CircleX" : item.label.includes("纠正") ? "RefreshCw" : "CircleCheck" }))} /></section> : null}
      <TaskActionModal open={Boolean(action)} type={action} task={task} onClose={() => setAction(null)} onSubmit={(type, payload) => runTaskAction(task.id, type, payload)} />
    </div>
  );
}

function OperationsOverviewScreen({ data, onNavigate }) {
  const counts = useMemo(() => ({
    awaiting: data.requests.filter((item) => item.status === "awaiting").length,
    confirmed: data.requests.filter((item) => ["confirmed", "create_failed"].includes(item.status)).length,
    rejected: data.requests.filter((item) => item.status === "rejected").length,
    activeTasks: data.tasks.filter((item) => ["pending", "in_progress", "execution_failed", "correcting"].includes(item.status)).length,
    overdue: data.tasks.filter((item) => item.overdue && !["completed", "cancelled", "corrected"].includes(item.status)).length,
    failed: data.requests.filter((item) => ["blocked", "create_failed"].includes(item.status)).length + data.tasks.filter((item) => item.status === "execution_failed").length,
    corrected: data.tasks.filter((item) => item.status === "corrected").length + data.requests.filter((item) => item.status === "replaced").length,
  }), [data]);
  const queue = data.requests.filter((item) => ["awaiting", "blocked", "create_failed", "replaced"].includes(item.status)).slice(0, 6);
  const allRequests = expandDecisionRequests(data.requests);
  const sourceCounts = Object.keys(SOURCE_META).map((type) => ({ type, count: allRequests.filter((item) => item.sourceType === type).length }));
  const taskStates = ["pending", "in_progress", "execution_failed", "completed", "cancelled", "corrected"].map((status) => ({ status, count: data.tasks.filter((item) => item.status === status).length }));
  return (
    <div className="page-shell overview-page">
      <DCPageHeader eyebrow="决策运营概览" title="行动处理运行情况" description="查看需要判断、执行中和异常状态，并下钻到同一条运行记录。" actions={<DCButton variant="primary" icon="Inbox" onClick={() => onNavigate("workbench")}>进入决策工作台</DCButton>} />
      <div className="operations-metrics">
        <button type="button" onClick={() => onNavigate("workbench?view=reminders&status=awaiting")}><span>待确认提醒</span><strong>{counts.awaiting}</strong><small>等待人工判断</small><DCIcon name="Clock3" /></button>
        <button type="button" onClick={() => onNavigate("workbench?view=reminders")}><span>已确认 / 已拒绝</span><strong>{counts.confirmed}<em>/</em>{counts.rejected}</strong><small>本次状态</small><DCIcon name="Scale" /></button>
        <button type="button" onClick={() => onNavigate("workbench?view=tasks")}><span>进行中待办</span><strong>{counts.activeTasks}</strong><small>待处理及处理中</small><DCIcon name="ListTodo" /></button>
        <button type="button" onClick={() => onNavigate("workbench?view=tasks")} className={counts.overdue ? "warning" : ""}><span>已逾期</span><strong>{counts.overdue}</strong><small>未完成或取消</small><DCIcon name="AlarmClock" /></button>
        <button type="button" onClick={() => onNavigate("workbench?view=requests")} className={counts.failed ? "danger" : ""}><span>失败与阻断</span><strong>{counts.failed}</strong><small>需要恢复</small><DCIcon name="ShieldAlert" /></button>
        <button type="button" onClick={() => onNavigate("workbench?view=requests")}><span>纠正记录</span><strong>{counts.corrected}</strong><small>保留新旧结果</small><DCIcon name="RefreshCw" /></button>
      </div>

      <div className="overview-grid">
        <section className="content-panel overview-queue">
          <DCSectionHeader title="需要关注" description="按待确认、失败、阻断和上游变化聚合显示。" count={queue.length} actions={<DCButton size="sm" onClick={() => onNavigate("workbench")}>查看全部</DCButton>} />
          <div className="attention-list">{queue.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(`reminder/${item.reminderId}`)}><span className={`attention-icon ${SOURCE_META[item.sourceType].tone}`}><DCIcon name={SOURCE_META[item.sourceType].icon} /></span><div><strong>{item.subjectName} · {item.metric.name}</strong><small>{item.metric.value} · {item.owner}</small></div><DCStatus status={item.status} compact /><DCIcon name="ChevronRight" /></button>)}</div>
        </section>
        <section className="content-panel status-board">
          <DCSectionHeader title="待办状态" description="负责人待办的当前运行状态。" />
          <div className="status-count-list">{taskStates.map((item) => <button type="button" key={item.status} onClick={() => onNavigate("workbench?view=tasks")}><DCStatus status={item.status} compact /><strong>{item.count}</strong><span>条</span></button>)}</div>
          <div className="overdue-callout"><span><DCIcon name="AlarmClock" /></span><div><strong>{counts.overdue} 条待办已逾期</strong><small>逾期不覆盖处理中等执行事实</small></div><DCButton size="sm" onClick={() => onNavigate("workbench?view=tasks")}>查看详情</DCButton></div>
        </section>
        <section className="content-panel source-board">
          <DCSectionHeader title="请求来源" description="四类来源统一进入 Action Request。" />
          <div className="source-count-grid">{sourceCounts.map((item) => <button type="button" key={item.type} onClick={() => onNavigate("workbench?view=requests")}><DCSourceBadge type={item.type} /><strong>{item.count}</strong><small>条请求</small></button>)}</div>
        </section>
        <section className="content-panel activity-board">
          <DCSectionHeader title="最近运行记录" actions={<DCButton size="sm" icon="Route" onClick={() => { const first = data.requests[0]; onNavigate(`trace/request/${first.id}`); }}>查看追溯</DCButton>} />
          <DCTimeline compact items={data.activity.slice(0, 5).map((item) => ({ ...item, icon: item.label.includes("失败") || item.label.includes("阻断") ? "CircleX" : "CircleCheck" }))} />
        </section>
      </div>
    </div>
  );
}

function TraceStep({ state, icon, title, subtitle, details, active, onClick, actionLabel }) {
  return (
    <button type="button" className={`trace-step ${state} ${active ? "active" : ""}`} onClick={onClick}>
      <span className="trace-step-icon"><DCIcon name={icon} size={18} /></span>
      <div><small>{subtitle}</small><strong>{title}</strong><p>{details}</p>{actionLabel ? <em>{actionLabel}<DCIcon name="ChevronRight" size={12} /></em> : null}</div>
    </button>
  );
}

function TraceScreen({ kind, id, data, onNavigate }) {
  let request = null;
  let task = null;
  const [selected, setSelected] = useState(kind === "task" ? "task" : "source");
  if (kind === "request") request = expandDecisionRequests(data.requests).find((item) => item.id === id);
  if (kind === "reminder") request = data.requests.find((item) => item.reminderId === id);
  if (kind === "task") { task = data.tasks.find((item) => item.id === id); request = data.requests.find((item) => item.id === task?.requestId); }
  if (!request && !task) return <MissingScreen onNavigate={onNavigate} />;
  const subjectName = request?.subjectName || task.subjectName;
  const actionType = request?.actionType || task.actionType;
  const traceTask = task || data.tasks.find((item) => item.requestId === request?.id);
  const decision = request?.decision;

  const sourceTitle = request ? SOURCE_META[request.sourceType].label : "来源记录";
  const sourceDetails = request ? request.sourceRef : "原来源记录已固定在待办依据中";
  const requestState = request ? (request.status === "blocked" ? "failed" : "done") : "done";
  const reminderState = request ? (["blocked", "replaced"].includes(request.status) ? "stopped" : "done") : "done";
  const decisionState = decision ? "done" : request?.status === "awaiting" ? "current" : "stopped";
  const taskState = traceTask ? (["completed", "corrected"].includes(traceTask.status) ? "done" : traceTask.status === "execution_failed" ? "failed" : "current") : decision?.type === "reject" ? "stopped" : "future";

  const selectedContent = {
    source: { title: "从哪里来", text: sourceDetails, fields: request ? [{ label: "来源类型", value: sourceTitle }, { label: "来源记录", value: request.sourceRef }, { label: "发起者", value: request.requester }, { label: "请求时间", value: request.requestTime }] : [] },
    request: { title: "如何进入决策中心", text: request ? `Action Request ${request.id} 引用已发布 ${actionType.name}。` : `原 Action Request：${task.requestId}`, fields: request ? [{ label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` }, { label: "Action Type", value: `${actionType.name} · ${actionType.version}` }, { label: "Rule 条件引用", value: request.rule ? `${request.rule.id} · ${request.rule.version}` : "不适用" }, { label: "Metric 快照", value: `${request.metric.name} ${request.metric.value}` }] : [] },
    reminder: { title: "为什么形成提醒", text: request ? (request.rule?.hitEvidence || request.metric.explanation) : task.metricLabel, fields: request ? [{ label: "提醒标识", value: request.reminderId }, { label: "生成时间", value: request.generatedTime }, { label: "数据版本", value: request.evidence.dataVersion }, { label: "数据截至时间", value: request.evidence.cutoff }] : [] },
    decision: { title: "人工如何决定", text: decision ? `${decision.operator}已${decision.type === "confirm" ? "确认" : "拒绝"}：${decision.reason}` : "尚未提交人工决定。", fields: decision ? [{ label: "决定", value: decision.type === "confirm" ? "确认" : "拒绝" }, { label: "操作者", value: decision.operator }, { label: "负责人", value: decision.owner || "不适用" }, { label: "决定时间", value: decision.time }] : [] },
    task: { title: "执行到哪一步", text: traceTask ? `${traceTask.owner} · ${DC_STATUS_META[traceTask.status]?.label || traceTask.status}${traceTask.overdue ? " · 已逾期" : ""}` : decision?.type === "reject" ? "本次行动已拒绝，不创建负责人待办。" : "只有人工确认成功后才创建负责人待办。", fields: traceTask ? [{ label: "待办标识", value: traceTask.id }, { label: "负责人", value: traceTask.owner }, { label: "到期时间", value: traceTask.dueDate }, { label: "当前状态", value: `${DC_STATUS_META[traceTask.status]?.label || traceTask.status}${traceTask.overdue ? " · 已逾期" : ""}` }] : [] },
  }[selected];

  const traceEvents = [
    ...(request ? [{ time: request.requestTime, label: "来源发起 Action Request", detail: `${sourceTitle} · ${request.sourceRef}` }, { time: request.generatedTime, label: "形成决策提醒", detail: `${request.subjectName} · ${request.metric.name} ${request.metric.value}` }] : []),
    ...(request?.sourceEvents || []).map((event) => ({ time: event.time, label: event.type, detail: event.reason, tone: "warning" })),
    ...(decision ? [{ time: decision.time, label: decision.type === "confirm" ? "人工确认" : "人工拒绝", detail: decision.reason }] : []),
    ...(traceTask?.history || []).map((event) => ({ time: event.time, label: event.label, detail: event.detail })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="page-shell trace-page">
      <DCPageHeader onBack={() => window.history.back()} eyebrow="全链路追溯" title={`${subjectName} · 这项行动是如何产生的`} description="从来源证据到人工决定和执行结果，所有变化按发生顺序保留。" actions={<>{request ? <DCButton icon="BellRing" onClick={() => onNavigate(`reminder/${request.reminderId}`)}>查看提醒</DCButton> : null}{traceTask ? <DCButton variant="primary" icon="ListTodo" onClick={() => onNavigate(`task/${traceTask.id}`)}>查看待办</DCButton> : null}</>} />
      <section className="trace-answer content-panel">
        <div><span>发生了什么</span><strong>{request ? `${request.metric.name} ${request.metric.value}` : task.metricLabel}</strong><p>{request ? request.metric.explanation : task.instructions}</p></div>
        <div><span>原因是什么</span><strong>{request?.rule ? `${request.rule.id} ${request.rule.name}` : request ? `${sourceTitle}提出行动建议` : task.ruleLabel}</strong><p>{request?.rule ? request.rule.hitEvidence : "Rule 条件引用不适用或已固定在原请求中"}</p></div>
        <div><span>推荐决策</span><strong>{request?.recommendation || task.instructions}</strong><p>{request?.banks?.length ? `优先协商：${request.banks.map((bank) => bank.name).join("、")}` : `协商范围：${task.banks.join("、")}`}</p></div>
        <div><span>最终决定</span><strong>{decision ? (decision.type === "confirm" ? "已确认并交办" : "已拒绝") : traceTask ? "已确认并交办" : "等待人工判断"}</strong><p>{decision?.reason || traceTask?.decisionReason || "尚未提交决定理由"}</p></div>
      </section>

      <section className="trace-flow" aria-label="行动产生链路">
        <TraceStep state="done" icon={request ? SOURCE_META[request.sourceType].icon : "Waypoints"} subtitle="来源" title={sourceTitle} details={sourceDetails} active={selected === "source"} onClick={() => setSelected("source")} actionLabel="查看来源证据" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={requestState} icon="Waypoints" subtitle="唯一标准入口" title="Action Request" details={request?.id || task.requestId} active={selected === "request"} onClick={() => setSelected("request")} actionLabel="查看请求" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={reminderState} icon="BellRing" subtitle="带证据提醒" title="决策提醒" details={request?.reminderId || task.reminderId} active={selected === "reminder"} onClick={() => setSelected("reminder")} actionLabel="查看形成原因" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={decisionState} icon="Scale" subtitle="人工判断" title={decision ? (decision.type === "confirm" ? "已确认" : "已拒绝") : traceTask ? "已确认" : "等待判断"} details={decision?.time || traceTask?.createdAt || "尚未提交"} active={selected === "decision"} onClick={() => setSelected("decision")} actionLabel="查看决定" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={taskState} icon="ListTodo" subtitle="负责人承接" title={traceTask ? (DC_STATUS_META[traceTask.status]?.label || "待办") : "未创建待办"} details={traceTask?.id || (decision?.type === "reject" ? "本次已拒绝" : "确认后创建")} active={selected === "task"} onClick={() => setSelected("task")} actionLabel="查看执行状态" />
      </section>

      <div className="trace-detail-grid">
        <section className="content-panel trace-selected"><DCSectionHeader title={selectedContent.title} /><p className="trace-selected-copy">{selectedContent.text}</p>{selectedContent.fields.length ? <DCKeyValues columns={2} items={selectedContent.fields} /> : <DCEmpty icon="FileSearch" title="当前仅保留待办中的固定引用" description="可从状态记录继续查看原决定和执行变化。" />}</section>
        <section className="content-panel trace-events"><DCSectionHeader title="全程记录" count={traceEvents.length} /><DCTimeline compact items={traceEvents.map((event) => ({ ...event, icon: event.label.includes("失败") ? "CircleX" : event.label.includes("纠正") ? "RefreshCw" : "CircleCheck" }))} /></section>
      </div>
    </div>
  );
}

function MissingScreen({ onNavigate }) {
  return <div className="page-shell missing-screen"><DCEmpty icon="FileQuestion" title="记录不存在或已无法访问" description="返回决策工作台重新选择一条记录。" action={<DCButton variant="primary" icon="Inbox" onClick={() => onNavigate("workbench")}>返回工作台</DCButton>} /></div>;
}

function ResetModal({ open, onClose, onReset }) {
  const [resetting, setResetting] = useState(false);
  const execute = () => { setResetting(true); window.setTimeout(() => { onReset(); setResetting(false); onClose(); }, 800); };
  return <DCModal open={open} onClose={() => !resetting && onClose()} title="重置决策中心状态" description="恢复起始数据后，可从待确认提醒重新走完整流程。" icon="RotateCcw" width="520px" footer={!resetting ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant="danger" icon="RotateCcw" onClick={execute}>确认重置</DCButton></> : null}>{resetting ? <DCLoadingBlock title="正在重置状态" /> : <DCAlert tone="warning" title="已产生的操作记录将被清除">包括本次确认、拒绝、待办、进展、失败、重试、完成和纠正记录。起始业务数据会重新载入。</DCAlert>}</DCModal>;
}

function DecisionApp() {
  const [data, setData] = useState(loadDecisionState);
  const dataRef = React.useRef(data);
  const [route, setRoute] = useState(parseDecisionRoute);
  const [toast, setToast] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => { dataRef.current = data; window.localStorage.setItem(DC_STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState({}, "", "#workbench");
    const onPop = () => setRoute(parseDecisionRoute());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("hashchange", onPop); };
  }, []);
  useEffect(() => { const stage = document.getElementById("screen-stage"); if (stage) stage.scrollTo({ top: 0, left: 0 }); }, [route.path]);

  const showToast = useCallback((message, tone = "info") => setToast({ id: Date.now(), message, tone }), []);
  const commitData = useCallback((next) => { dataRef.current = next; setData(next); }, []);
  const navigate = useCallback((target, state = {}, replace = false) => {
    const hash = `#${target}`;
    if (replace) window.history.replaceState(state, "", hash); else window.history.pushState(state, "", hash);
    setRoute(parseDecisionRoute());
  }, []);
  const addActivity = (current, label, detail, time = formatNow()) => ({ ...current, activity: [{ time, label, detail }, ...current.activity].slice(0, 20) });

  const submitDecision = useCallback((requestId, mode, form) => new Promise((resolve) => {
    const starting = dataRef.current;
    commitData({ ...starting, requests: starting.requests.map((item) => item.id === requestId ? { ...item, status: "submitting" } : item) });
    window.setTimeout(() => {
      const current = dataRef.current;
      const request = current.requests.find((item) => item.id === requestId);
      const attempts = request.decisionAttempts || 0;
      if (request.subjectId === "UNIT-465" && attempts === 0) {
        const failed = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "awaiting", decisionAttempts: 1 } : item) };
        commitData(failed);
        resolve({ ok: false, message: "连接在提交过程中中断，尚未收到明确结果。系统核对后确认没有形成重复决定。" });
        return;
      }
      const now = formatNow();
      const decision = { type: mode, reason: form.reason, operator: "财务运营账号", time: now, owner: mode === "confirm" ? form.owner : null, dueDate: mode === "confirm" ? form.dueDate : null, instructions: form.instructions, banks: form.banks };
      if (mode === "reject") {
        const next = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "rejected", decision, decisionAttempts: attempts + 1 } : item) };
        commitData(addActivity(next, "人工拒绝行动建议", `${request.subjectName} · ${form.reason}`, now));
        resolve({ ok: true });
        return;
      }
      if (request.subjectId === "UNIT-561" && (request.taskCreateAttempts || 0) === 0) {
        const next = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "create_failed", decision, decisionAttempts: attempts + 1, taskCreateAttempts: 1 } : item) };
        commitData(addActivity(next, "待办创建失败", `${request.subjectName} · 人工确认保持有效`, now));
        showToast("人工确认已保存，但待办创建失败，可在提醒详情直接重试", "danger");
        resolve({ ok: true });
        return;
      }
      const requestWithDecision = { ...request, decision };
      const task = buildTaskFromDecision(requestWithDecision, form);
      const next = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "confirmed", decision, decisionAttempts: attempts + 1, taskId: task.id } : item), tasks: [task, ...current.tasks] };
      commitData(addActivity(next, "人工确认并创建待办", `${request.subjectName} · ${form.owner}`, now));
      showToast(`${request.subjectName}已确认，独立待办已创建`, "success");
      navigate(`task/${task.id}`);
      resolve({ ok: true });
    }, 1200);
  }), [commitData, navigate, showToast]);

  const retryCreateTask = useCallback((requestId) => {
    const current = dataRef.current;
    commitData({ ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, taskCreating: true } : item) });
    showToast("正在根据已保存的人工确认重试创建待办", "info");
    window.setTimeout(() => {
      const latest = dataRef.current;
      const request = latest.requests.find((item) => item.id === requestId);
      const form = { owner: request.decision.owner, dueDate: request.decision.dueDate, instructions: request.decision.instructions, banks: request.decision.banks, reason: request.decision.reason };
      const task = buildTaskFromDecision(request, form);
      const next = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? { ...item, status: "confirmed", taskCreating: false, taskId: task.id, taskCreateAttempts: (item.taskCreateAttempts || 0) + 1 } : item), tasks: [task, ...latest.tasks] };
      commitData(addActivity(next, "重试创建待办成功", `${request.subjectName} · ${task.id}`));
      showToast("待办创建成功，原人工确认保持不变", "success");
      navigate(`task/${task.id}`);
    }, 1100);
  }, [commitData, navigate, showToast]);

  const runTaskAction = useCallback((taskId, type, payload) => new Promise((resolve) => {
    window.setTimeout(() => {
      const current = dataRef.current;
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) { resolve({ ok: false, message: "待办已无法访问，请返回目录重新核对。" }); return; }
      if (type === "complete" && task.subjectId === "UNIT-465" && (task.updateAttempts || 0) === 0) {
        commitData({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? { ...item, updateAttempts: 1 } : item) });
        resolve({ ok: false, message: "保存结果时连接中断，系统核对后确认待办仍保持处理中。" });
        return;
      }
      const now = formatNow();
      let label = "更新待办"; let detail = "";
      const updated = { ...task, history: [...task.history] };
      if (type === "start") { updated.status = "in_progress"; label = "开始处理"; detail = `${task.owner}开始处理`; }
      if (type === "retry") { updated.status = "in_progress"; label = "重试执行"; detail = task.failure?.nextStep || "按恢复建议重新开始"; }
      if (type === "progress") { updated.progress = [...task.progress, { time: now, author: task.owner, content: payload.result }]; label = "记录进展"; detail = payload.result; }
      if (type === "complete") { updated.status = "completed"; updated.overdue = false; updated.result = { summary: payload.result, bank: payload.bank, time: now }; label = "完成待办"; detail = payload.result; }
      if (type === "fail") { updated.status = "execution_failed"; updated.failure = { reason: payload.reason, nextStep: payload.nextStep, time: now }; label = "执行失败"; detail = `${payload.reason} · ${payload.nextStep}`; }
      if (type === "cancel") { updated.status = "cancelled"; updated.overdue = false; label = "取消待办"; detail = payload.reason; }
      if (type === "edit") { const old = `${task.owner} / ${task.dueDate} / ${task.instructions}`; updated.owner = payload.owner; updated.dueDate = payload.dueDate; updated.instructions = payload.instructions; updated.overdue = payload.dueDate < dateOnly(new Date()); label = "修改执行安排"; detail = `${old} → ${payload.owner} / ${payload.dueDate} / ${payload.instructions}；原因：${payload.reason}`; }
      if (type === "source_continue") { updated.sourceChanged = false; label = "确认继续执行"; detail = payload.reason; }
      if (type === "correct") { updated.status = "correcting"; label = "发起纠正"; detail = payload.reason; updated.correction = { reason: payload.reason, result: payload.result, time: now, pending: true }; }
      updated.history.push({ time: now, label, detail });
      const next = { ...current, tasks: current.tasks.map((item) => item.id === taskId ? updated : item) };
      commitData(addActivity(next, label, `${task.subjectName} · ${detail}`, now));
      const messages = { start: "待办已进入处理中", retry: "已按恢复建议重新进入处理中", progress: "处理进展已保存", complete: "完成结果已保存", fail: "执行失败已记录，可重试或取消", cancel: "待办已取消，原记录继续保留", edit: "执行安排已更新并保留原值", source_continue: "继续执行理由已记录", correct: "正在形成纠正记录" };
      showToast(messages[type] || "待办已更新", ["fail", "cancel"].includes(type) ? "warning" : "success");
      if (type === "correct") window.setTimeout(() => {
        const latest = dataRef.current;
        const corrected = { ...latest, tasks: latest.tasks.map((item) => item.id === taskId ? { ...item, status: "corrected", correction: { ...item.correction, pending: false, time: formatNow() }, history: [...item.history, { time: formatNow(), label: "完成纠正", detail: item.correction.result }] } : item) };
        commitData(corrected);
        showToast("纠正记录已完成，新旧结果均已保留", "success");
      }, 1200);
      resolve({ ok: true });
    }, type === "start" || type === "retry" ? 650 : 900);
  }), [commitData, showToast]);

  const refreshSource = useCallback((taskId) => new Promise((resolve) => {
    window.setTimeout(() => {
      const current = dataRef.current;
      let changed = false;
      const next = { ...current, tasks: current.tasks.map((item) => {
        if (item.id !== taskId) return item;
        if (item.subjectId === "UNIT-561" && !item.sourceChanged) {
          changed = true;
          return { ...item, sourceChanged: true, sourceChangeEvent: { time: formatNow(), type: "证据纠正", detail: "上游已形成新的固定证据：短期余额范围减少 1 笔，建议银行顺序发生变化。" }, history: [...item.history, { time: formatNow(), label: "收到上游证据纠正", detail: "原待办不自动取消，等待人工选择" }] };
        }
        return item;
      }) };
      commitData(next);
      showToast(changed ? "已读取到上游证据变化，请选择继续、取消或纠正" : "来源状态已重新读取，当前没有新的变化", changed ? "warning" : "success");
      resolve();
    }, 850);
  }), [commitData, showToast]);

  const resetState = useCallback(() => {
    const initial = createInitialDecisionState(); initial.resetAt = formatNow(); commitData(initial); navigate("workbench", {}, true); showToast("状态已重置，可从待确认提醒重新开始", "success");
  }, [commitData, navigate, showToast]);

  const renderScreen = () => {
    const [root, second, third] = route.parts;
    if (root === "overview") return <OperationsOverviewScreen data={data} onNavigate={navigate} />;
    if (root === "request") return <RequestDetailScreen request={expandDecisionRequests(data.requests).find((item) => item.id === second)} onNavigate={navigate} />;
    if (root === "reminder") return <ReminderDetailScreen request={data.requests.find((item) => item.reminderId === second)} onNavigate={navigate} submitDecision={submitDecision} retryCreateTask={retryCreateTask} />;
    if (root === "task") { const task = data.tasks.find((item) => item.id === second); return <TaskDetailScreen task={task} request={data.requests.find((item) => item.id === task?.requestId)} onNavigate={navigate} runTaskAction={runTaskAction} refreshSource={refreshSource} />; }
    if (root === "trace") return <TraceScreen kind={second} id={third} data={data} onNavigate={navigate} />;
    return <WorkbenchScreen data={data} onNavigate={navigate} />;
  };

  return (
    <div className="decision-app">
      <DecisionRail onReset={() => setResetOpen(true)} onNavigate={navigate} />
      <DecisionProductNav route={route} onNavigate={navigate} />
      <main className="app-workspace"><DecisionTopbar route={route} data={data} /><div className="screen-stage" id="screen-stage">{renderScreen()}</div></main>
      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} onReset={resetState} />
      <DCToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DecisionApp />);
