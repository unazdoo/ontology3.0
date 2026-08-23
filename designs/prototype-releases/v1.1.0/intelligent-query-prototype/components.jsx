const { useEffect, useMemo, useRef, useState } = React;

function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  const nodes = window.lucide?.[name] || window.lucide?.CircleHelp || [];
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {nodes.map(([tag, attrs], index) => React.createElement(tag, { ...attrs, key: `${tag}-${index}` }))}
    </svg>
  );
}

function Button({ children, icon, tone = "default", size = "md", className = "", disabled = false, title, type = "button", onClick }) {
  return (
    <button className={`btn ${tone} ${size} ${className}`} type={type} disabled={disabled} title={title} onClick={onClick}>
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ icon, label, active = false, disabled = false, onClick }) {
  return (
    <button className={`icon-button ${active ? "active" : ""}`} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={18} />
    </button>
  );
}

function StatusBadge({ children, tone = "neutral", icon }) {
  return (
    <span className={`badge ${tone}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      <span>{children}</span>
    </span>
  );
}

function EmptyState({ icon = "Inbox", title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="empty-actions">{action}</div> : null}
    </div>
  );
}

function Notice({ tone = "info", title, children, action }) {
  const iconName = tone === "danger" ? "CircleAlert" : tone === "warning" ? "TriangleAlert" : tone === "success" ? "CircleCheck" : "Info";
  return (
    <div className={`notice ${tone}`}>
      <Icon name={iconName} size={18} />
      <div className="notice-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{children}</span>
      </div>
      {action ? <div className="notice-action">{action}</div> : null}
    </div>
  );
}

function Fact({ label, value, note }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title || actions ? (
        <header className="panel-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Segmented({ items, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}>
          {item.icon ? <Icon name={item.icon} size={15} /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function Modal({ title, description, children, footer, onClose, size = "md" }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const listener = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", listener);
  }, [onClose]);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex="-1">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton icon="X" label="关闭" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}

function Drawer({ title, subtitle, children, onClose }) {
  useEffect(() => {
    const listener = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [onClose]);
  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton icon="X" label="关闭" onClick={onClose} />
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

function Toast({ message, tone = "success" }) {
  if (!message) return null;
  const iconName = tone === "danger" ? "CircleAlert" : tone === "warning" ? "TriangleAlert" : "CircleCheck";
  return (
    <div className={`toast ${tone}`} role="status">
      <Icon name={iconName} size={17} />
      <span>{message}</span>
    </div>
  );
}

function ProgressSteps({ steps, current }) {
  return (
    <div className="progress-steps" aria-label="运行进度">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={step} className={`progress-step ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <span>{done ? <Icon name="Check" size={13} /> : active ? <span className="spinner tiny"></span> : index + 1}</span>
            <strong>{step}</strong>
          </div>
        );
      })}
    </div>
  );
}

function MetricCards({ items, selected, onSelect }) {
  return (
    <div className={`metric-grid ${items.length > 3 ? "four" : ""}`}>
      {items.map((item) => (
        <button key={item.label} type="button" className={`metric-card ${item.tone || ""} ${selected === item.label ? "selected" : ""}`} onClick={() => onSelect(item.label)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.tone === "danger" ? "需要重点关注" : item.tone === "warning" ? "存在关注项" : "查看精确结果"}</small>
        </button>
      ))}
    </div>
  );
}

function BarChart({ categories, values, unit, selected, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...values, 1);
  return (
    <div className="bar-chart" aria-label="柱状图">
      <div className="chart-unit">单位：{unit}</div>
      <div className="bar-list">
        {categories.map((category, index) => {
          const value = values[index];
          const width = Math.max((value / max) * 100, value === 0 ? 0 : 4);
          return (
            <button
              type="button"
              className={`bar-row ${selected === category ? "selected" : ""}`}
              key={category}
              onClick={() => onSelect(category)}
              onMouseEnter={() => setHovered(category)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="bar-label">{category}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${width}%` }}></span></span>
              <strong>{new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value)}{unit}</strong>
              {hovered === category ? <span className="chart-tooltip">{category} · 精确值 {value.toFixed(3)}{unit}<em>点击定位证据</em></span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({ categories, values, unit, selected, onSelect }) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const first = (values[0] / total) * 100;
  return (
    <div className="donut-layout">
      <button
        type="button"
        className="donut"
        aria-label={`${categories[0]} ${values[0]}${unit}`}
        style={{ background: `conic-gradient(var(--red) 0 ${first}%, #dfe7f0 ${first}% 100%)` }}
        onClick={() => onSelect(categories[0])}
      >
        <span>
          <strong>{values[0].toFixed(3)}%</strong>
          <small>{categories[0]}</small>
        </span>
      </button>
      <div className="donut-legend">
        {categories.map((category, index) => (
          <button type="button" key={category} className={selected === category ? "selected" : ""} onClick={() => onSelect(category)}>
            <span className={`legend-dot tone-${index}`}></span>
            <span>{category}</span>
            <strong>{values[index].toFixed(3)}{unit}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function StackedChart({ categories, stacks, selected, onSelect }) {
  return (
    <div className="stacked-chart">
      <div className="stacked-legend"><span><i className="legend-dot tone-2"></i>浮动利率</span><span><i className="legend-dot tone-3"></i>固定利率</span></div>
      {categories.map((category, index) => {
        const floating = stacks?.[index]?.[0] ?? 0;
        const fixed = stacks?.[index]?.[1] ?? 0;
        return (
          <button type="button" className={`stacked-row ${selected === category ? "selected" : ""}`} key={category} onClick={() => onSelect(category)}>
            <span>{category}</span>
            <span className="stack-track" title={`${category}：浮动 ${floating.toFixed(1)}%，固定 ${fixed.toFixed(1)}%`}>
              <i className="floating" style={{ width: `${floating}%` }}></i>
              <i className="fixed" style={{ width: `${fixed}%` }}></i>
            </span>
            <strong>{floating.toFixed(1)}% / {fixed.toFixed(1)}%</strong>
          </button>
        );
      })}
    </div>
  );
}

function ChartTypeMenu({ result, value, onChange }) {
  const options = [
    { value: "recommended", label: "系统推荐", icon: "Sparkles" },
    { value: "metric", label: "指标卡", icon: "PanelsTopLeft" },
    { value: "bar", label: "柱状图", icon: "ChartNoAxesColumnIncreasing" },
    { value: "stacked", label: "堆叠柱状图", icon: "ChartBarStacked" },
    { value: "donut", label: "环形图", icon: "ChartPie" }
  ];
  const reason = (type) => {
    if (type === "donut" && result.resultType !== "unit") return "当前结果不是单一对象的部分—整体构成";
    if (type === "stacked" && result.resultType !== "group") return "当前结果缺少可比较的完整构成维度";
    if (type === "bar" && result.chart.categories.length < 2) return "当前结果缺少可比较维度";
    return "";
  };
  return (
    <div className="chart-menu" role="menu" aria-label="图表类型">
      {options.map((option) => {
        const disabledReason = reason(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "active" : ""}
            disabled={Boolean(disabledReason)}
            title={disabledReason || option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon name={option.icon} size={16} />
            <span>{option.label}</span>
            {disabledReason ? <small>{disabledReason}</small> : value === option.value ? <Icon name="Check" size={14} /> : null}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  Icon,
  Button,
  IconButton,
  StatusBadge,
  EmptyState,
  Notice,
  Fact,
  Panel,
  Segmented,
  Modal,
  Drawer,
  Toast,
  ProgressSteps,
  MetricCards,
  BarChart,
  DonutChart,
  StackedChart,
  ChartTypeMenu
});
