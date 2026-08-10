const { useEffect: usePrototypeEffect } = React;

const prototypeModalStack = [];
let prototypeModalSerial = 0;

function PrototypeIcon({ name, size = 16, className = "", strokeWidth = 1.8, title = "" }) {
  const iconSet = window.lucide && window.lucide.icons ? window.lucide.icons : {};
  const iconNodes = iconSet[name] || iconSet.Circle || [];
  return (
    <svg
      className={`p-icon ${className}`.trim()}
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
      {iconNodes.map(([tag, attrs], index) => React.createElement(tag, { ...attrs, key: `${name}-${index}` }))}
    </svg>
  );
}

function PrototypeStatus({ children, tone = "neutral", icon, compact = false, title = "" }) {
  const statusIcon = icon || ({ success: "CircleCheck", warning: "TriangleAlert", failed: "CircleX", running: "LoaderCircle", info: "Info", neutral: "CircleDashed" }[tone]);
  return (
    <span className={`p-status ${tone} ${compact ? "compact" : ""}`} title={title || undefined}>
      {statusIcon ? <PrototypeIcon name={statusIcon} size={compact ? 10 : 12} className={tone === "running" ? "spin" : ""} /> : null}
      <span>{children}</span>
    </span>
  );
}

function PrototypeButton({ children, icon, variant = "secondary", size = "md", className = "", loading = false, disabled = false, onClick, type = "button", title = "", ariaLabel = "" }) {
  return (
    <button
      type={type}
      className={`p-btn ${variant} ${size} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      title={title || undefined}
      aria-label={ariaLabel || undefined}
    >
      {loading ? <PrototypeIcon name="LoaderCircle" size={15} className="spin" /> : icon ? <PrototypeIcon name={icon} size={15} /> : null}
      <span>{children}</span>
    </button>
  );
}

function PrototypeIconButton({ icon, label, onClick, disabled = false, active = false, className = "", size = 16 }) {
  return (
    <button type="button" className={`p-icon-btn ${active ? "active" : ""} ${className}`.trim()} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <PrototypeIcon name={icon} size={size} />
    </button>
  );
}

function PrototypePageHeader({ kicker, title, description, actions, meta, onBack }) {
  return (
    <header className="p-page-header">
      <div className="p-page-title-block">
        <div className="p-page-title-line">
          {onBack ? <PrototypeIconButton icon="ArrowLeft" label="返回" onClick={onBack} /> : null}
          <div className="p-page-title-copy">
            {kicker ? <div className="p-page-kicker">{kicker}</div> : null}
            <h1>{title}</h1>
          </div>
        </div>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="p-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="p-page-actions">{actions}</div> : null}
    </header>
  );
}

function PrototypeSectionHeader({ title, description, actions, count }) {
  return (
    <div className="p-section-header">
      <div>
        <div className="p-section-title-row"><h2>{title}</h2>{count !== undefined ? <span className="p-count">{count}</span> : null}</div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="p-section-actions">{actions}</div> : null}
    </div>
  );
}

function PrototypeMetricStrip({ items }) {
  return (
    <div className="p-metric-strip">
      {items.map((item) => (
        <div className={`p-metric ${item.tone || ""}`} key={item.label}>
          <div className="p-metric-head"><span>{item.label}</span>{item.icon ? <PrototypeIcon name={item.icon} size={14} /> : null}</div>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

function PrototypeTabs({ items, value, onChange, ariaLabel = "页面视图" }) {
  return (
    <div className="p-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          key={item.value}
          className={value === item.value ? "active" : ""}
          aria-selected={value === item.value}
          disabled={item.disabled}
          title={item.disabledReason || undefined}
          onClick={() => onChange(item.value)}
        >
          {item.icon ? <PrototypeIcon name={item.icon} size={14} /> : null}
          <span>{item.label}</span>
          {item.count !== undefined ? <span className="p-tab-count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function PrototypeSearch({ value, onChange, placeholder = "搜索", ariaLabel = "搜索" }) {
  return (
    <label className="p-search">
      <PrototypeIcon name="Search" size={14} />
      <span className="sr-only">{ariaLabel}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
      {value ? <button type="button" onClick={() => onChange("")} title="清空搜索" aria-label="清空搜索"><PrototypeIcon name="X" size={13} /></button> : null}
    </label>
  );
}

function PrototypeSelect({ label, value, onChange, options, disabled = false, className = "" }) {
  return (
    <label className={`p-select-wrap ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-label={label || "选择"}>
        {options.map((option) => {
          const normalized = typeof option === "string" ? { value: option, label: option } : option;
          return <option value={normalized.value} key={normalized.value}>{normalized.label}</option>;
        })}
      </select>
    </label>
  );
}

function PrototypeField({ label, value, onChange, placeholder = "", type = "text", required = false, error = "", readOnly = false, hint = "" }) {
  const handleChange = onChange ? (event) => onChange(event.currentTarget.value) : undefined;
  return (
    <label className={`p-field ${error ? "has-error" : ""}`}>
      <span className="p-field-label">{label}{required ? <b>必填</b> : null}</span>
      <input type={type} value={value} onChange={handleChange} onInput={type === "date" ? handleChange : undefined} placeholder={placeholder} readOnly={readOnly} aria-invalid={Boolean(error)} />
      {error ? <small className="p-field-error">{error}</small> : hint ? <small className="p-field-hint">{hint}</small> : null}
    </label>
  );
}

function PrototypeTextarea({ label, value, onChange, placeholder = "", required = false, error = "", hint = "" }) {
  return (
    <label className={`p-field ${error ? "has-error" : ""}`}>
      <span className="p-field-label">{label}{required ? <b>必填</b> : null}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)}></textarea>
      {error ? <small className="p-field-error">{error}</small> : hint ? <small className="p-field-hint">{hint}</small> : null}
    </label>
  );
}

function PrototypeKeyValues({ items, columns = 2, compact = false }) {
  return (
    <dl className={`p-key-values ${compact ? "compact" : ""}`} style={{ "--kv-columns": columns }}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <dt>{item.label}</dt>
          <dd className={item.mono ? "mono" : ""}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrototypeAlert({ tone = "info", title, children, actions, icon }) {
  const alertIcon = icon || ({ info: "Info", warning: "TriangleAlert", failed: "CircleX", success: "CircleCheck" }[tone]);
  return (
    <div className={`p-alert ${tone}`}>
      <PrototypeIcon name={alertIcon} size={17} />
      <div className="p-alert-copy"><strong>{title}</strong>{children ? <div>{children}</div> : null}</div>
      {actions ? <div className="p-alert-actions">{actions}</div> : null}
    </div>
  );
}

function PrototypeEmpty({ icon = "Inbox", title, description, action }) {
  return (
    <div className="p-empty">
      <PrototypeIcon name={icon} size={24} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action || null}
    </div>
  );
}

function PrototypeModal({ open, title, icon = "PanelTop", children, footer, onClose, width = "560px", closeLabel = "关闭弹层" }) {
  const modalIdRef = React.useRef("");
  const onCloseRef = React.useRef(onClose);
  if (!modalIdRef.current) modalIdRef.current = `prototype-modal-${++prototypeModalSerial}`;
  onCloseRef.current = onClose;

  usePrototypeEffect(() => {
    if (!open) return undefined;
    const modalId = modalIdRef.current;
    const removeFromStack = () => {
      const index = prototypeModalStack.lastIndexOf(modalId);
      if (index >= 0) prototypeModalStack.splice(index, 1);
    };
    removeFromStack();
    prototypeModalStack.push(modalId);
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || prototypeModalStack.at(-1) !== modalId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      removeFromStack();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="p-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="p-modal" role="dialog" aria-modal="true" aria-label={title} style={{ "--modal-width": width }}>
        <header><div><PrototypeIcon name={icon} size={17} /><h2>{title}</h2></div><PrototypeIconButton icon="X" label={closeLabel} onClick={onClose} /></header>
        <div className="p-modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </div>
  );
}

function PrototypeProgressSteps({ items, current }) {
  return (
    <ol className="p-progress-steps">
      {items.map((item, index) => {
        const state = index < current ? "done" : index === current ? "current" : "future";
        return <li key={item} className={state}><span>{state === "done" ? <PrototypeIcon name="Check" size={12} /> : index + 1}</span><strong>{item}</strong></li>;
      })}
    </ol>
  );
}

function PrototypeTable({ columns, rows, rowKey, empty, className = "", onRowClick }) {
  if (!rows.length && empty) return empty;
  return (
    <div className="p-table-wrap">
      <table className={`p-table ${className}`.trim()}>
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.align === "right" ? "numeric" : ""} style={column.width ? { width: column.width } : undefined}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowKey ? row[rowKey] : rowIndex}
              className={onRowClick ? "clickable" : ""}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? `打开${row.name || row.id || "记录"}` : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
            >
              {columns.map((column) => <td key={column.key} className={column.align === "right" ? "numeric" : ""}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrototypeSkeleton({ rows = 5 }) {
  return <div className="p-skeleton" aria-label="加载中">{Array.from({ length: rows }).map((_, index) => <span key={index}></span>)}</div>;
}

Object.assign(window, {
  PrototypeIcon,
  PrototypeStatus,
  PrototypeButton,
  PrototypeIconButton,
  PrototypePageHeader,
  PrototypeSectionHeader,
  PrototypeMetricStrip,
  PrototypeTabs,
  PrototypeSearch,
  PrototypeSelect,
  PrototypeField,
  PrototypeTextarea,
  PrototypeKeyValues,
  PrototypeAlert,
  PrototypeEmpty,
  PrototypeModal,
  PrototypeProgressSteps,
  PrototypeTable,
  PrototypeSkeleton,
});
