const { useEffect } = React;

function Icon({ name, size = 17, className = "" }) {
  return <i data-lucide={name} className={`icon ${className}`} style={{ width: size, height: size }} aria-hidden="true"></i>;
}

function Button({ children, icon, kind = "", className = "", onClick, disabled = false, title, type = "button", draggable = false, onDragStart, onDragEnd }) {
  return (
    <button
      type={type}
      className={`btn ${kind} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {icon ? <Icon name={icon}></Icon> : null}
      {children}
    </button>
  );
}

function StatusBadge({ status, label }) {
  const classes = {
    enabled: "success",
    available: "success",
    ready: "success",
    allowed: "success",
    complete: "success",
    success: "success",
    validated: "success",
    published: "success",
    confirmed: "success",
    received: "success",
    active: "info",
    waiting: "info",
    running: "info",
    submitting: "info",
    validating: "info",
    queued: "info",
    draft: "warning",
    pending: "warning",
    partial: "warning",
    limited: "warning",
    cancelled: "warning",
    paused: "warning",
    stale: "warning",
    blocked: "danger",
    failed: "danger",
    incompatible: "danger",
    "quality-blocked": "danger",
    rejected: "danger",
    disabled: "neutral",
    skipped: "neutral",
    history: "neutral",
    "pending-integration": "warning",
    warning: "warning",
    unknown: "neutral",
    unavailable: "danger",
    consistent: "success",
    inconsistent: "danger",
    "not-run": "neutral",
    "replay-ready": "info",
    "dependency-missing": "warning"
  };
  const labels = {
    enabled: "已启用",
    available: "可用",
    ready: "可运行",
    allowed: "允许",
    complete: "已完成",
    success: "成功",
    validated: "验证通过",
    published: "已发布",
    confirmed: "已确认可作参考",
    received: "已接收",
    active: "处理中",
    waiting: "等待",
    running: "运行中",
    submitting: "提交中",
    validating: "验证中",
    queued: "等待",
    draft: "配置草稿",
    pending: "待处理",
    partial: "部分完成",
    limited: "受限完成",
    cancelled: "已取消",
    paused: "人工暂停",
    stale: "上下文陈旧",
    blocked: "已阻断",
    failed: "失败",
    incompatible: "版本不兼容",
    "quality-blocked": "质量阻断",
    rejected: "已退回",
    disabled: "已停用",
    skipped: "已跳过",
    history: "历史版本",
    "pending-integration": "合同已确认·待联调",
    warning: "有警告",
    unknown: "无法判断",
    unavailable: "不可访问",
    consistent: "重放一致",
    inconsistent: "重放不一致",
    "not-run": "未执行",
    "replay-ready": "具备重放条件",
    "dependency-missing": "依赖不足"
  };
  return <span className={`badge ${classes[status] || "neutral"}`}>{label || labels[status] || status}</span>;
}

function Modal({ title, subtitle, children, onClose, actions, size = "" }) {
  useEffect(() => {
    const handler = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${size}`.trim()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="btn icon-only" onClick={onClose} title="关闭"><Icon name="x"></Icon></button>
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <footer className="modal-foot">{actions}</footer> : null}
      </section>
    </div>
  );
}

function Drawer({ title, subtitle, children, onClose, actions, wide = false }) {
  useEffect(() => {
    const handler = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`drawer ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
          <button className="btn icon-only" onClick={onClose} title="关闭"><Icon name="x"></Icon></button>
        </header>
        <div className="drawer-body">{children}</div>
        {actions ? <footer className="drawer-foot">{actions}</footer> : null}
      </aside>
    </div>
  );
}

function PageHeader({ title, description, eyebrow, actions, back }) {
  return (
    <header className="page-header">
      <div className="page-title-wrap">
        {back ? <button className="btn icon-only back-button" onClick={back} title="返回"><Icon name="arrow-left"></Icon></button> : null}
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

function EmptyState({ icon = "inbox", title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-content">
        <div className="empty-icon"><Icon name={icon} size={22}></Icon></div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="button-row">{action}</div> : null}
      </div>
    </div>
  );
}

function KeyValueList({ rows, compact = false }) {
  return (
    <div className={`key-value-list ${compact ? "compact" : ""}`}>
      {rows.map((row, index) => (
        <div className="key-value-row" key={`${row.label}-${index}`}>
          <span>{row.label}</span>
          <div>{row.value ?? "未提供"}</div>
        </div>
      ))}
    </div>
  );
}

function Tabs({ items, value, onChange, label = "视图" }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} className={`tab ${value === item.id ? "active" : ""}`} onClick={() => onChange(item.id)} role="tab" aria-selected={value === item.id}>
          {item.label}{item.count !== undefined ? <em>{item.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

function Notice({ kind = "info", title, children, action }) {
  const icons = { success: "circle-check", warning: "triangle-alert", danger: "circle-alert", info: "info" };
  return (
    <div className={`notice ${kind}`}>
      <Icon name={icons[kind] || "info"}></Icon>
      <div><strong>{title}</strong>{children ? <span>{children}</span> : null}</div>
      {action ? <div className="notice-action">{action}</div> : null}
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.kind || ""}`} key={toast.id}>
          <Icon name={toast.kind === "danger" ? "circle-alert" : toast.kind === "success" ? "circle-check" : "info"}></Icon>
          <div><strong>{toast.title}</strong>{toast.message ? <span>{toast.message}</span> : null}</div>
        </div>
      ))}
    </div>
  );
}

function CredibilitySummary({ credibility, title = "可信度摘要" }) {
  const binding = credibility?.versionBindingSummary || null;
  const current = credibility?.currentStateSummary || null;
  const status = current?.status || binding?.status || "unknown";
  const label = current?.label || binding?.label || "摘要未提供";
  const supportItems = credibility ? [
    {
      id: "refresh",
      name: "刷新状态",
      value: credibility.refresh,
      time: credibility.refresh?.observedAt,
      detail: credibility.refresh?.resultState || credibility.refresh?.reason,
      recovery: credibility.refresh?.recovery
    },
    {
      id: "post-quality",
      name: "事后质量",
      value: credibility.postQuality,
      time: credibility.postQuality?.checkedAt,
      detail: credibility.postQuality?.scope ? `${credibility.postQuality.scope}：${credibility.postQuality.reason || "未提供原因"}` : credibility.postQuality?.reason,
      recovery: credibility.postQuality?.recovery
    },
    {
      id: "ontology-adoption",
      name: "本体正式采用",
      value: credibility.ontologyAdoption,
      time: credibility.ontologyAdoption?.observedAt,
      detail: credibility.ontologyAdoption?.source,
      recovery: credibility.ontologyAdoption?.recovery
    },
    {
      id: "consumption-readiness",
      name: "消费就绪证据",
      value: credibility.consumptionReadiness,
      time: credibility.consumptionReadiness?.observedAt,
      detail: credibility.consumptionReadiness?.reason || credibility.consumptionReadiness?.allowedUse,
      recovery: credibility.consumptionReadiness?.recovery
    },
    {
      id: "stable-evidence",
      name: "稳定证据定位",
      value: credibility.stableEvidence,
      time: credibility.stableEvidence?.checkedAt,
      detail: credibility.stableEvidence?.refs?.join("；") || credibility.stableEvidence?.reason,
      recovery: credibility.stableEvidence?.recovery
    }
  ] : [];

  return (
    <section className="credibility-summary" aria-label={title}>
      <div className="credibility-component-head">
        <div>
          <h3>{title}</h3>
          <small>{credibility?.contract || "可信度合同未提供"}</small>
        </div>
        <StatusBadge status={status} label={label}></StatusBadge>
      </div>
      {!credibility ? (
        <div className="credibility-missing"><Icon name="circle-help" size={16}></Icon><span>未取得可信度摘要，本次用途只能按无法判断处理。</span></div>
      ) : (
        <>
          <div className="credibility-dual-summary">
            <div className="credibility-summary-column binding-summary">
              <div className="credibility-summary-label"><Icon name="link-2" size={14}></Icon><strong>版本绑定摘要</strong></div>
              <KeyValueList compact rows={[
                { label: "摘要标识", value: binding?.id },
                { label: "版本 / 形成", value: binding?.version || binding?.formedAt ? `${binding?.version || "未提供版本"} / ${binding?.formedAt || "未提供时间"}` : null },
                { label: "精确数据版本", value: binding?.t007 },
                { label: "数据截至时间", value: binding?.t008 },
                { label: "时点来源", value: binding?.t008Source },
                { label: "Published 语义", value: binding?.ontology },
                { label: "权威关系", value: binding?.binding }
              ]}></KeyValueList>
              <p className="credibility-explanation">{binding?.reason || "未提供版本绑定说明。"}</p>
            </div>
            <div className="credibility-summary-column current-summary">
              <div className="credibility-summary-label"><Icon name="activity" size={14}></Icon><strong>当前状态摘要</strong></div>
              <KeyValueList compact rows={[
                { label: "摘要标识", value: current?.id },
                { label: "版本", value: current?.version },
                { label: "来源 Owner", value: current?.sourceOwner || credibility?.externalAuthority?.owner },
                { label: "稳定来源", value: current?.sourceReference || credibility?.externalAuthority?.sourceReference },
                { label: "观察时间", value: current?.observedAt },
                { label: "最近读取", value: credibility?.lastReadAt },
                { label: "质量", value: current?.quality },
                { label: "新鲜度", value: current?.freshness },
                { label: "事实年龄", value: current?.factAge },
                { label: "阈值 / Owner", value: current?.freshnessThreshold || current?.freshnessThresholdOwner ? `${current?.freshnessThreshold || "未提供阈值"} / ${current?.freshnessThresholdOwner || "未提供 Owner"}` : null },
                { label: "适用范围", value: current?.applicableScope },
                { label: "数据侧资格", value: current?.dataQualification },
                { label: "刷新关系", value: current?.refresh },
                { label: "当前采用版本", value: current?.activeDataVersion },
                { label: "当前采用截至", value: current?.activeDataAsOf }
              ]}></KeyValueList>
              <p className="credibility-explanation">{current?.useConclusion || "未提供当前用途结论，正式用途应保持阻断。"}</p>
            </div>
          </div>
          <div className="credibility-support-grid" aria-label="消费与恢复证据">
            {supportItems.map((item) => (
              <article className="credibility-support-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <StatusBadge status={item.value?.status || "unknown"} label={item.value?.label || "未提供"}></StatusBadge>
                </div>
                <p>{item.detail || "未提供权威说明。"}</p>
                <small>{item.time ? `核对时间：${item.time}` : "核对时间未提供"}</small>
                <span><b>恢复方式</b>{item.recovery || current?.recovery || "重新读取当前状态摘要；仍缺权威证据时保持阻断。"}</span>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function VersionIdentityGrid({ identities, title = "版本身份关系" }) {
  const identityOrder = [
    ["current", "当前权威"],
    ["candidate", "较新候选"],
    ["previousQualified", "上一具备采用资格"],
    ["previousAuthoritative", "上一权威服务"]
  ];

  return (
    <section className="panel credibility-identities" aria-label={title}>
      <div className="panel-head"><div><h2>{title}</h2><p>四类身份分别展示，不以“最新”或“上一”模糊替代</p></div></div>
      <div className="panel-body">
        <div className="version-identity-grid">
          {identityOrder.map(([key, fallback]) => {
            const identity = identities?.[key] || null;
            return (
              <article className={`version-identity-item identity-${identity?.status || "unknown"}`} key={key}>
                <div className="version-identity-head">
                  <div><span>{fallback}</span><strong>{identity?.role || fallback}</strong></div>
                  <StatusBadge status={identity?.status || "unknown"} label={identity?.label || "未提供"}></StatusBadge>
                </div>
                <dl>
                  <div><dt>数据资产</dt><dd>{identity?.t006 || "未提供"}</dd></div>
                  <div><dt>精确版本</dt><dd>{identity?.t007 || "未提供"}</dd></div>
                  <div><dt>截至时间</dt><dd>{identity?.t008 || "未提供"}</dd></div>
                </dl>
                <p>{identity?.reason || "没有足够证据判断该版本身份。"}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HistoryDimensions({ dimensions = [], title = "历史五维状态" }) {
  const expected = ["version-location", "content-access", "evidence-completeness", "replay-capability", "replay-verification"];
  const byId = new Map((dimensions || []).map((item) => [item.id, item]));
  const rows = expected.map((id) => byId.get(id) || { id, name: {
    "version-location": "版本定位",
    "content-access": "内容访问",
    "evidence-completeness": "证据完整",
    "replay-capability": "重放能力",
    "replay-verification": "重放核验"
  }[id], status: "unknown", label: "未提供", reason: "当前摘要未提供该维度。", checkedAt: null, recovery: "补齐权威状态后重新核对。" });

  return (
    <section className="panel credibility-history" aria-label={title}>
      <div className="panel-head"><div><h2>{title}</h2><p>固定证据可核对，不等于历史重放已经执行</p></div></div>
      <div className="panel-body history-dimension-list">
        {rows.map((item, index) => {
          const replayUnverified = item.id === "replay-verification" && ["not-run", "dependency-missing", "unknown"].includes(item.status);
          return (
            <article className={`history-dimension-row dimension-${item.status}`} key={item.id}>
              <span className="dimension-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="dimension-copy">
                <div><strong>{item.name}</strong><StatusBadge status={item.status} label={item.label}></StatusBadge></div>
                <p>{item.reason}</p>
                <small>{item.checkedAt ? `最近核对：${item.checkedAt}` : "核对时间未提供"}{replayUnverified ? " · 尚无已执行重放结论" : ""}</small>
              </div>
              <div className="dimension-recovery"><span>恢复方式</span><p>{item.recovery || "未提供"}</p></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AgentUseGate({ gates = [], title = "Agent 用途门", highlightId = null }) {
  return (
    <section className="panel agent-use-gates" aria-label={title}>
      <div className="panel-head"><div><h2>{title}</h2><p>每项用途独立判断；允许一种用途不代表全部用途可用</p></div></div>
      <div className="panel-body agent-gate-list">
        {gates?.length ? gates.map((gate) => (
          <article className={`agent-gate-row gate-${gate.status} ${highlightId === gate.id ? "highlighted" : ""}`.trim()} key={gate.id}>
            <span className="agent-gate-icon"><Icon name={["ready", "allowed"].includes(gate.status) ? "check" : gate.status === "warning" ? "triangle-alert" : "lock-keyhole"} size={15}></Icon></span>
            <div className="agent-gate-copy">
              <div><strong>{gate.name}</strong><StatusBadge status={gate.status || "unknown"} label={gate.label}></StatusBadge></div>
              <p>{gate.reason || "未提供用途判断原因。"}</p>
            </div>
            <div className="agent-gate-recovery"><span>恢复方式</span><p>{gate.recovery || "未提供"}</p></div>
          </article>
        )) : <div className="credibility-missing"><Icon name="circle-help" size={16}></Icon><span>未取得 Agent 用途门，本次正式用途保持阻断。</span></div>}
      </div>
    </section>
  );
}

function AppShell({ route, title, counts, onNavigate, accountOpen, setAccountOpen, onReset, children }) {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const detailRoots = {
    "agent-detail": "agents",
    "draft-config": "agents",
    "resource-detail": "resources",
    "run-detail": "runs",
    "evidence-detail": "evidence",
    "orchestration-editor": "orchestrations"
  };
  const activeTop = detailRoots[route.screen] || route.screen;
  const workLabel = window.AGENT_WORKSPACE_CONFIG.variant === "task" ? "任务运行与结果" : window.AGENT_WORKSPACE_CONFIG.variant === "orchestration" ? "受约束协作" : "目录与配置";

  return (
    <div className={`app-shell variant-${window.AGENT_WORKSPACE_CONFIG.variant}`}>
      <aside className="platform-rail" aria-label="平台导航">
        <button className="platform-logo" onClick={() => onNavigate(window.AGENT_WORKSPACE_CONFIG.initialRoute)} title="返回当前工作台"><Icon name="boxes" size={20}></Icon></button>
        <div className="platform-current" title="Agent 应用"><Icon name="bot" size={19}></Icon></div>
        <div className="platform-spacer"></div>
        <button className="platform-action" onClick={onReset} title="重置状态"><Icon name="rotate-ccw" size={18}></Icon></button>
      </aside>

      <aside className="product-nav" aria-label="Agent 应用导航">
        <div className="product-nav-head">
          <span><Icon name="bot" size={16}></Icon></span>
          <div><strong>Agent 应用</strong><small>{workLabel}</small></div>
        </div>
        <nav className="product-nav-list">
          <div className="product-nav-label">工作区</div>
          {window.AGENT_NAV_ITEMS.map((item) => (
            <button key={item.id} className={`product-nav-item ${activeTop === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} title={item.label}>
              <Icon name={item.icon}></Icon><span>{item.label}</span>
              {counts[item.id] ? <em className="nav-count">{counts[item.id]}</em> : null}
            </button>
          ))}
        </nav>
        <div className="product-nav-foot"><strong>运行约束</strong><span>固定证据与精确版本</span></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>{window.AGENT_WORKSPACE_CONFIG.title}</span><Icon name="chevron-right" size={12}></Icon><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="boundary-chip"><Icon name="shield-check" size={13}></Icon>报告 / 洞察 / 伴读</span>
            <div className="account-wrap">
              <button className="account-button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>
                <span className="account-avatar">管</span>
                <span className="account-copy"><strong>平台管理员</strong><small>单账号工作区</small></span>
                <Icon name="chevron-down" size={14}></Icon>
              </button>
              {accountOpen ? <div className="account-menu"><button className="menu-button" onClick={onReset}><Icon name="rotate-ccw"></Icon>重置状态</button></div> : null}
            </div>
          </div>
        </header>
        <main className="main" onClick={() => accountOpen && setAccountOpen(false)}>{children}</main>
      </section>
    </div>
  );
}

Object.assign(window, {
  Icon,
  Button,
  StatusBadge,
  Modal,
  Drawer,
  PageHeader,
  EmptyState,
  KeyValueList,
  Tabs,
  Notice,
  ToastStack,
  CredibilitySummary,
  HistoryDimensions,
  VersionIdentityGrid,
  AgentUseGate,
  AppShell
});
