const { useEffect: useDCComponentEffect, useRef: useDCComponentRef } = React;

function DCIcon({ name, size = 16, strokeWidth = 1.8, className = "", title = "" }) {
  const iconSet = window.lucide && window.lucide.icons ? window.lucide.icons : {};
  const nodes = iconSet[name] || iconSet.Circle || [];
  return (
    <svg
      className={`dc-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {nodes.map(([tag, attrs], index) => React.createElement(tag, { ...attrs, key: `${name}-${index}` }))}
    </svg>
  );
}

function DCButton({ children, icon, variant = "secondary", size = "md", loading = false, disabled = false, onClick, type = "button", className = "", title = "" }) {
  return (
    <button
      type={type}
      className={`dc-btn ${variant} ${size} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      title={title || undefined}
    >
      {loading ? <DCIcon name="LoaderCircle" size={15} className="spin" /> : icon ? <DCIcon name={icon} size={15} /> : null}
      <span>{children}</span>
    </button>
  );
}

function DCIconButton({ icon, label, onClick, active = false, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      className={`dc-icon-btn ${active ? "active" : ""} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <DCIcon name={icon} size={16} />
    </button>
  );
}

const DC_STATUS_META = {
  awaiting: { label: "待确认", tone: "warning", icon: "Clock3" },
  confirmed: { label: "已确认", tone: "success", icon: "CircleCheck" },
  rejected: { label: "已拒绝", tone: "neutral", icon: "CircleMinus" },
  blocked: { label: "已阻断", tone: "danger", icon: "OctagonX" },
  replaced: { label: "证据已纠正", tone: "info", icon: "RefreshCw" },
  withdrawn: { label: "上游已撤回", tone: "neutral", icon: "Undo2" },
  submitting: { label: "提交中", tone: "info", icon: "LoaderCircle", spin: true },
  create_failed: { label: "待办创建失败", tone: "danger", icon: "CircleX" },
  pending: { label: "待处理", tone: "warning", icon: "CircleDashed" },
  in_progress: { label: "处理中", tone: "info", icon: "LoaderCircle" },
  completed: { label: "已完成", tone: "success", icon: "CircleCheckBig" },
  cancelled: { label: "已取消", tone: "neutral", icon: "Ban" },
  execution_failed: { label: "执行失败", tone: "danger", icon: "CircleX" },
  correcting: { label: "纠正中", tone: "warning", icon: "RefreshCw" },
  corrected: { label: "已纠正", tone: "success", icon: "BadgeCheck" },
};

function DCStatus({ status, label, tone, icon, compact = false, suffix = "" }) {
  const meta = DC_STATUS_META[status] || { label: status || "未知", tone: "neutral", icon: "CircleDashed" };
  const resolvedLabel = label || meta.label;
  const resolvedTone = tone || meta.tone;
  const resolvedIcon = icon || meta.icon;
  return (
    <span className={`dc-status ${resolvedTone} ${compact ? "compact" : ""}`}>
      <DCIcon name={resolvedIcon} size={compact ? 11 : 12} className={meta.spin ? "spin" : ""} />
      <span>{resolvedLabel}{suffix}</span>
    </span>
  );
}

function DCSourceBadge({ type, compact = false }) {
  const meta = SOURCE_META[type] || SOURCE_META.rule;
  return (
    <span className={`source-badge ${meta.tone} ${compact ? "compact" : ""}`}>
      <DCIcon name={meta.icon} size={compact ? 11 : 13} />
      <span>{meta.label}</span>
    </span>
  );
}

function DCPageHeader({ title, description, eyebrow, actions, onBack, meta }) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <div className="page-title-line">
          {onBack ? <DCIconButton icon="ArrowLeft" label="返回" onClick={onBack} /> : null}
          <div>
            {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
          </div>
        </div>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="page-header-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

function DCSectionHeader({ title, description, actions, count }) {
  return (
    <div className="section-header">
      <div>
        <div className="section-title-line"><h2>{title}</h2>{count !== undefined ? <span className="count-badge">{count}</span> : null}</div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

function DCTabs({ items, value, onChange, ariaLabel = "页面视图" }) {
  return (
    <div className="dc-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          key={item.value}
          className={value === item.value ? "active" : ""}
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.icon ? <DCIcon name={item.icon} size={14} /> : null}
          <span>{item.label}</span>
          {item.count !== undefined ? <span className="tab-count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function DCSearch({ value, onChange, placeholder = "搜索" }) {
  return (
    <label className="dc-search">
      <DCIcon name="Search" size={14} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? <DCIconButton icon="X" label="清空搜索" onClick={() => onChange("")} /> : null}
    </label>
  );
}

function DCSelect({ label, value, onChange, options, className = "" }) {
  return (
    <label className={`dc-select ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label || "选择"}>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return <option value={item.value} key={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function DCField({ label, value, onChange, type = "text", placeholder = "", required = false, error = "", hint = "", readOnly = false, min }) {
  return (
    <label className={`dc-field ${error ? "has-error" : ""}`}>
      <span className="field-label">{label}{required ? <em>必填</em> : null}</span>
      <input type={type} value={value} onChange={(event) => onChange && onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} min={min} />
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

function DCTextarea({ label, value, onChange, placeholder = "", required = false, error = "", hint = "" }) {
  return (
    <label className={`dc-field ${error ? "has-error" : ""}`}>
      <span className="field-label">{label}{required ? <em>必填</em> : null}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}></textarea>
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

function DCKeyValues({ items, columns = 2, className = "" }) {
  return (
    <dl className={`key-values ${className}`.trim()} style={{ "--kv-columns": columns }}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <dt>{item.label}</dt>
          <dd className={item.mono ? "mono" : ""}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DCAlert({ tone = "info", title, children, actions, icon }) {
  const icons = { info: "Info", warning: "TriangleAlert", danger: "CircleX", success: "CircleCheck" };
  return (
    <div className={`dc-alert ${tone}`}>
      <DCIcon name={icon || icons[tone]} size={18} />
      <div className="alert-copy"><strong>{title}</strong>{children ? <div>{children}</div> : null}</div>
      {actions ? <div className="alert-actions">{actions}</div> : null}
    </div>
  );
}

function DCEmpty({ icon = "Inbox", title, description, action }) {
  return (
    <div className="dc-empty">
      <span><DCIcon name={icon} size={25} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action || null}
    </div>
  );
}

function DCTimeline({ items, compact = false }) {
  return (
    <ol className={`dc-timeline ${compact ? "compact" : ""}`}>
      {items.map((item, index) => (
        <li key={`${item.time}-${item.label}-${index}`}>
          <span className={`timeline-dot ${item.tone || ""}`}><DCIcon name={item.icon || "Circle"} size={10} /></span>
          <div>
            <div className="timeline-head"><strong>{item.label}</strong><time>{item.time}</time></div>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DCModal({ open, title, description, icon = "PanelTop", onClose, children, footer, width = "680px" }) {
  const closeRef = useDCComponentRef(onClose);
  closeRef.current = onClose;
  useDCComponentEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dc-modal" role="dialog" aria-modal="true" aria-label={title} style={{ "--modal-width": width }}>
        <header>
          <div className="modal-title"><span><DCIcon name={icon} size={18} /></span><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></div>
          <DCIconButton icon="X" label="关闭" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </div>
  );
}

function DCToast({ toast, onClose }) {
  useDCComponentEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  const icon = toast.tone === "success" ? "CircleCheck" : toast.tone === "danger" ? "CircleX" : toast.tone === "warning" ? "TriangleAlert" : "Info";
  return (
    <button type="button" className={`dc-toast ${toast.tone || "info"}`} onClick={onClose} aria-label={`${toast.message}，点击关闭`}>
      <DCIcon name={icon} size={17} />
      <span>{toast.message}</span>
      <DCIcon name="X" size={13} />
    </button>
  );
}

function DCLoadingBlock({ title, description }) {
  return (
    <div className="loading-block">
      <DCIcon name="LoaderCircle" size={22} className="spin" />
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </div>
  );
}
