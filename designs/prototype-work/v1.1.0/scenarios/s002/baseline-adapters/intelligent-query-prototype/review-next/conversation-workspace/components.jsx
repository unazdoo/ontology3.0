(() => {
  "use strict";

  const {
    createElement,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
  } = React;

  const cx = (...tokens) =>
    tokens
      .flatMap((token) => {
        if (!token) return [];
        if (typeof token === "string") return [token];
        if (Array.isArray(token)) return token;
        if (typeof token === "object") {
          return Object.entries(token)
            .filter(([, enabled]) => Boolean(enabled))
            .map(([name]) => name);
        }
        return [];
      })
      .filter(Boolean)
      .join(" ");

  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object || {}, key);

  const toPascalCase = (name = "") =>
    String(name)
      .trim()
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

  const reactSvgAttribute = (name) => {
    const aliases = {
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "fill-rule": "fillRule",
      "clip-rule": "clipRule",
    };
    return aliases[name] || name;
  };

  const renderIconNode = (node, index) => {
    if (!Array.isArray(node)) return null;
    const [tag, rawAttributes = {}, children = []] = node;
    const attributes = {};
    Object.entries(rawAttributes).forEach(([name, value]) => {
      attributes[reactSvgAttribute(name)] = value;
    });
    const key = attributes.key || `${tag}-${index}`;
    delete attributes.key;
    return createElement(
      tag,
      { ...attributes, key },
      Array.isArray(children)
        ? children.map((child, childIndex) => renderIconNode(child, childIndex))
        : undefined,
    );
  };

  function Icon({
    name = "circle",
    size = 18,
    strokeWidth = 2,
    label,
    className,
    ...rest
  }) {
    const iconName = toPascalCase(name);
    const iconDefinition =
      window.lucide?.icons?.[iconName] || window.lucide?.[iconName];
    const children = Array.isArray(iconDefinition)
      ? iconDefinition.map((node, index) => renderIconNode(node, index))
      : [
          <circle key="fallback-circle" cx="12" cy="12" r="8" />,
          <path key="fallback-path" d="M9 12h6" />,
        ];

    return (
      <svg
        className={cx("ui-icon", className)}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={label ? undefined : "true"}
        aria-label={label}
        role={label ? "img" : undefined}
        focusable="false"
        {...rest}
      >
        {children}
      </svg>
    );
  }

  function Button({
    children,
    variant = "secondary",
    size = "md",
    icon,
    iconAfter,
    loading = false,
    loadingText = "处理中",
    disabled = false,
    className,
    type = "button",
    title,
    ...rest
  }) {
    const isDisabled = disabled || loading;
    return (
      <button
        type={type}
        className={cx(
          "ui-button",
          `ui-button--${variant}`,
          `ui-button--${size}`,
          { "is-loading": loading },
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        title={title}
        {...rest}
      >
        {loading ? (
          <Icon name="loader-circle" className="ui-button__spinner" />
        ) : icon ? (
          typeof icon === "string" ? <Icon name={icon} /> : icon
        ) : null}
        {children ? (
          <span className="ui-button__label">
            {loading && loadingText ? loadingText : children}
          </span>
        ) : loading ? (
          <span className="sr-only">{loadingText}</span>
        ) : null}
        {!loading && iconAfter
          ? typeof iconAfter === "string"
            ? <Icon name={iconAfter} />
            : iconAfter
          : null}
      </button>
    );
  }

  function IconButton({ label, icon, className, variant = "ghost", ...rest }) {
    return (
      <Button
        className={cx("ui-icon-button", className)}
        variant={variant}
        icon={icon}
        aria-label={label}
        title={rest.title || label}
        {...rest}
      />
    );
  }

  function Badge({
    children,
    tone = "neutral",
    icon,
    dot = false,
    className,
    title,
    ...rest
  }) {
    return (
      <span
        className={cx("ui-badge", `ui-badge--${tone}`, className)}
        title={title}
        {...rest}
      >
        {dot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
        {icon ? (typeof icon === "string" ? <Icon name={icon} size={14} /> : icon) : null}
        <span>{children}</span>
      </span>
    );
  }

  const STATUS_DEFINITIONS = {
    not_started: { label: "未开始", tone: "neutral", icon: "circle" },
    processing: { label: "处理中", tone: "info", icon: "loader-circle" },
    success: { label: "成功", tone: "success", icon: "circle-check" },
    failed: { label: "失败", tone: "danger", icon: "circle-x" },
    blocked: { label: "阻断", tone: "danger", icon: "octagon-alert" },
    not_consumable: { label: "不可消费", tone: "danger", icon: "ban" },
    previous_trusted: {
      label: "上一可信版本",
      tone: "warning",
      icon: "history",
    },
    warning: { label: "有警告", tone: "warning", icon: "triangle-alert" },
    stale: { label: "数据陈旧", tone: "warning", icon: "clock-alert" },
    current: { label: "当前", tone: "success", icon: "circle-check" },
    candidate: { label: "候选", tone: "info", icon: "flask-conical" },
    enabled: { label: "已启用", tone: "success", icon: "circle-check" },
    disabled: { label: "未启用", tone: "neutral", icon: "circle-off" },
    published: { label: "已发布", tone: "success", icon: "badge-check" },
    draft: { label: "草稿", tone: "neutral", icon: "file-pen-line" },
    partial: { label: "部分可用", tone: "warning", icon: "circle-dot-dashed" },
    unavailable: { label: "无法计算", tone: "danger", icon: "circle-slash" },
    zero_denominator: {
      label: "零分母",
      tone: "danger",
      icon: "circle-slash",
    },
    no_match: { label: "无匹配记录", tone: "neutral", icon: "search-x" },
    empty: { label: "暂无数据", tone: "neutral", icon: "inbox" },
    deprecated: { label: "已废弃", tone: "danger", icon: "refresh-cw-off" },
    needs_revision: { label: "需修订", tone: "warning", icon: "file-warning" },
    runnable: { label: "可运行", tone: "success", icon: "play" },
    loaded: { label: "已加载", tone: "success", icon: "package-check" },
    pending_enablement: { label: "待启用", tone: "info", icon: "power" },
    validating: { label: "验证中", tone: "info", icon: "loader-circle" },
    validation_failed: { label: "验证失败", tone: "danger", icon: "badge-x" },
    received: { label: "已接收", tone: "success", icon: "inbox" },
    revision_required: { label: "需迁移", tone: "warning", icon: "replace" },
    compatible: { label: "兼容", tone: "success", icon: "badge-check" },
    revalidation_required: { label: "需重验", tone: "warning", icon: "refresh-cw" },
    timeout: { label: "超时", tone: "danger", icon: "clock-alert" },
    unknown: { label: "未知", tone: "warning", icon: "circle-help" },
    version_mismatch: { label: "版本不一致", tone: "danger", icon: "git-compare" },
  };

  const STATUS_ALIASES = {
    "未开始": "not_started",
    "处理中": "processing",
    "运行中": "processing",
    "成功": "success",
    "失败": "failed",
    "阻断": "blocked",
    "不可消费": "not_consumable",
    "上一可信版本": "previous_trusted",
    "警告": "warning",
    "有警告": "warning",
    "数据陈旧": "stale",
    "当前": "current",
    "候选": "candidate",
    "已启用": "enabled",
    "未启用": "disabled",
    "已发布": "published",
    "草稿": "draft",
    "部分可用": "partial",
    "无法计算": "unavailable",
    "零分母": "zero_denominator",
    "无匹配记录": "no_match",
    "暂无数据": "empty",
    "已废弃": "deprecated",
    "需修订": "needs_revision",
    "可运行": "runnable",
    "已加载": "loaded",
    "待启用": "pending_enablement",
    "验证中": "validating",
    "验证失败": "validation_failed",
    "已接收": "received",
    "报告中心已接收": "received",
    "需迁移": "revision_required",
    "兼容": "compatible",
    "需重验": "revalidation_required",
    "超时": "timeout",
    "未知": "unknown",
    "通过": "success",
    "未通过": "failed",
    "具备条件": "runnable",
    "等待候选": "not_started",
    "混版": "version_mismatch",
    "版本不一致": "version_mismatch",
    "not-started": "not_started",
    running: "processing",
    loading: "processing",
    ready: "success",
    error: "failed",
    "not-consumable": "not_consumable",
    "previous-trusted": "previous_trusted",
    "zero-denominator": "zero_denominator",
    "no-match": "no_match",
  };

  const normalizeStatus = (status) => {
    if (!status) return "not_started";
    const raw = String(status).trim();
    return STATUS_ALIASES[raw] || STATUS_ALIASES[raw.toLowerCase()] || raw;
  };

  function StatusBadge({ status, label, tone, icon, className, ...rest }) {
    const normalized = normalizeStatus(status);
    const definition = STATUS_DEFINITIONS[normalized] || {
      label: label || String(status || "状态未知"),
      tone: "neutral",
      icon: "circle-help",
    };
    return (
      <Badge
        className={cx(
          "ui-status-badge",
          `ui-status-badge--${normalized}`,
          { "is-processing": normalized === "processing" },
          className,
        )}
        tone={tone || definition.tone}
        icon={icon || definition.icon}
        {...rest}
      >
        {label || definition.label}
      </Badge>
    );
  }

  function useDialogBehavior({ open, onClose, ref }) {
    useEffect(() => {
      if (!open) return undefined;
      const previousFocus = document.activeElement;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const focusableSelector = [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");

      const focusTimer = window.setTimeout(() => {
        const initial =
          ref.current?.querySelector("[data-autofocus]") ||
          ref.current?.querySelector(focusableSelector) ||
          ref.current;
        initial?.focus?.();
      }, 0);

      const handleKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose?.();
          return;
        }
        if (event.key !== "Tab" || !ref.current) return;
        const focusable = Array.from(
          ref.current.querySelectorAll(focusableSelector),
        ).filter((element) => element.offsetParent !== null);
        if (!focusable.length) {
          event.preventDefault();
          ref.current.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        window.clearTimeout(focusTimer);
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = previousOverflow;
        previousFocus?.focus?.();
      };
    }, [open, onClose, ref]);
  }

  function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
    closeLabel = "关闭",
    closeOnBackdrop = true,
    className,
  }) {
    const dialogRef = useRef(null);
    const generatedId = useId();
    const titleId = `${generatedId}-title`;
    const descriptionId = `${generatedId}-description`;
    useDialogBehavior({ open, onClose, ref: dialogRef });

    if (!open) return null;
    return (
      <div
        className="ui-overlay"
        onMouseDown={(event) => {
          if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
        }}
      >
        <section
          ref={dialogRef}
          className={cx("ui-modal", `ui-modal--${size}`, className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex="-1"
        >
          <header className="ui-modal__header">
            <div className="ui-modal__heading">
              {title ? <h2 id={titleId}>{title}</h2> : null}
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <IconButton
              icon="x"
              label={closeLabel}
              onClick={onClose}
              data-autofocus={!title ? "true" : undefined}
            />
          </header>
          <div className="ui-modal__body">{children}</div>
          {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
        </section>
      </div>
    );
  }

  function Drawer({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    side = "right",
    size = "md",
    closeLabel = "关闭",
    closeOnBackdrop = true,
    className,
  }) {
    const drawerRef = useRef(null);
    const generatedId = useId();
    const titleId = `${generatedId}-title`;
    const descriptionId = `${generatedId}-description`;
    useDialogBehavior({ open, onClose, ref: drawerRef });

    if (!open) return null;
    return (
      <div
        className="ui-overlay ui-overlay--drawer"
        onMouseDown={(event) => {
          if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
        }}
      >
        <aside
          ref={drawerRef}
          className={cx(
            "ui-drawer",
            `ui-drawer--${side}`,
            `ui-drawer--${size}`,
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex="-1"
        >
          <header className="ui-drawer__header">
            <div className="ui-drawer__heading">
              {title ? <h2 id={titleId}>{title}</h2> : null}
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <IconButton icon="x" label={closeLabel} onClick={onClose} />
          </header>
          <div className="ui-drawer__body">{children}</div>
          {footer ? <footer className="ui-drawer__footer">{footer}</footer> : null}
        </aside>
      </div>
    );
  }

  const NOTICE_ICONS = {
    info: "info",
    success: "circle-check",
    warning: "triangle-alert",
    danger: "octagon-alert",
    neutral: "message-circle",
  };

  function Notice({
    tone = "info",
    title,
    children,
    icon,
    action,
    onDismiss,
    dismissLabel = "关闭提示",
    compact = false,
    className,
    role,
  }) {
    return (
      <div
        className={cx(
          "ui-notice",
          `ui-notice--${tone}`,
          { "ui-notice--compact": compact },
          className,
        )}
        role={role || (tone === "danger" ? "alert" : "status")}
      >
        <Icon name={icon || NOTICE_ICONS[tone] || NOTICE_ICONS.info} />
        <div className="ui-notice__content">
          {title ? <strong className="ui-notice__title">{title}</strong> : null}
          {children ? <div className="ui-notice__body">{children}</div> : null}
        </div>
        {action ? <div className="ui-notice__action">{action}</div> : null}
        {onDismiss ? (
          <IconButton icon="x" label={dismissLabel} onClick={onDismiss} />
        ) : null}
      </div>
    );
  }

  function Toast({
    id,
    tone = "success",
    title,
    message,
    action,
    onDismiss,
    duration = 4500,
    className,
  }) {
    useEffect(() => {
      if (!duration || !onDismiss) return undefined;
      const timer = window.setTimeout(() => onDismiss(id), duration);
      return () => window.clearTimeout(timer);
    }, [duration, id, onDismiss]);

    return (
      <div
        className={cx("ui-toast", `ui-toast--${tone}`, className)}
        role={tone === "danger" ? "alert" : "status"}
        aria-live={tone === "danger" ? "assertive" : "polite"}
      >
        <Icon name={NOTICE_ICONS[tone] || "bell"} />
        <div className="ui-toast__content">
          {title ? <strong>{title}</strong> : null}
          {message ? <p>{message}</p> : null}
        </div>
        {action ? <div className="ui-toast__action">{action}</div> : null}
        {onDismiss ? (
          <IconButton icon="x" label="关闭消息" onClick={() => onDismiss(id)} />
        ) : null}
      </div>
    );
  }

  function ToastRegion({ toasts = [], onDismiss, className }) {
    return (
      <div
        className={cx("ui-toast-region", className)}
        aria-label="操作消息"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </div>
    );
  }

  function EmptyState({
    icon = "inbox",
    title = "暂无内容",
    description,
    primaryAction,
    secondaryAction,
    compact = false,
    className,
  }) {
    return (
      <div
        className={cx(
          "ui-empty-state",
          { "ui-empty-state--compact": compact },
          className,
        )}
      >
        <span className="ui-empty-state__icon" aria-hidden="true">
          <Icon name={icon} size={compact ? 22 : 28} />
        </span>
        <div className="ui-empty-state__copy">
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {primaryAction || secondaryAction ? (
          <div className="ui-empty-state__actions">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    );
  }

  function PageHeader({
    eyebrow,
    title,
    description,
    breadcrumbs = [],
    onBack,
    backLabel = "返回",
    status,
    meta,
    actions,
    children,
    className,
  }) {
    return (
      <header className={cx("ui-page-header", className)}>
        {breadcrumbs.length ? (
          <nav className="ui-breadcrumbs" aria-label="面包屑">
            <ol>
              {breadcrumbs.map((item, index) => (
                <li key={item.id || item.label || index}>
                  {item.onClick ? (
                    <button type="button" onClick={item.onClick}>
                      {item.label}
                    </button>
                  ) : item.href ? (
                    <a href={item.href}>{item.label}</a>
                  ) : (
                    <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                      {item.label}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 ? (
                    <Icon name="chevron-right" size={14} />
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="ui-page-header__main">
          {onBack ? (
            <IconButton
              className="ui-page-header__back"
              icon="arrow-left"
              label={backLabel}
              onClick={onBack}
            />
          ) : null}
          <div className="ui-page-header__copy">
            {eyebrow ? <span className="ui-page-header__eyebrow">{eyebrow}</span> : null}
            <div className="ui-page-header__title-row">
              <h1>{title}</h1>
              {status
                ? React.isValidElement(status)
                  ? status
                  : <StatusBadge status={status} />
                : null}
            </div>
            {description ? <p>{description}</p> : null}
            {meta ? <div className="ui-page-header__meta">{meta}</div> : null}
          </div>
          {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
        </div>
        {children ? <div className="ui-page-header__content">{children}</div> : null}
      </header>
    );
  }

  function Tabs({
    items = [],
    activeId,
    onChange,
    ariaLabel = "页签",
    variant = "line",
    size = "md",
    className,
  }) {
    const enabledItems = items.filter((item) => !item.disabled);
    const fallbackActiveId = enabledItems[0]?.id;
    const focusTab = (container, id) => {
      window.requestAnimationFrame(() => {
        Array.from(container?.querySelectorAll("[data-tab-id]") || [])
          .find((element) => element.dataset.tabId === String(id))
          ?.focus();
      });
    };
    const handleTabKeyDown = (event, item) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = Math.max(
        enabledItems.findIndex((candidate) => candidate.id === item.id),
        0,
      );
      let nextIndex = currentIndex;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = enabledItems.length - 1;
      if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      }
      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % enabledItems.length;
      }
      const nextItem = enabledItems[nextIndex];
      if (!nextItem) return;
      onChange?.(nextItem.id, nextItem);
      focusTab(event.currentTarget.parentElement, nextItem.id);
    };

    return (
      <div
        className={cx(
          "ui-tabs",
          `ui-tabs--${variant}`,
          `ui-tabs--${size}`,
          className,
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const active = item.id === (activeId ?? fallbackActiveId);
          return (
            <button
              key={item.id}
              type="button"
              className={cx("ui-tabs__item", { "is-active": active })}
              role="tab"
              aria-selected={active}
              aria-controls={item.controls}
              data-tab-id={item.id}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              title={item.disabled ? item.reason || "当前不可用" : item.title}
              onClick={() => !item.disabled && onChange?.(item.id, item)}
              onKeyDown={(event) => handleTabKeyDown(event, item)}
            >
              {item.icon ? <Icon name={item.icon} size={16} /> : null}
              <span>{item.label}</span>
              {hasOwn(item, "count") ? (
                <span className="ui-tabs__count">{item.count}</span>
              ) : null}
              {item.badge ? item.badge : null}
            </button>
          );
        })}
      </div>
    );
  }

  function Segmented(props) {
    return <Tabs {...props} variant="segmented" />;
  }

  function DisplayModeSwitch({
    value,
    onChange,
    disabledModes = {},
    className,
  }) {
    const items = [
      { id: "text", label: "文字解读", icon: "align-left" },
      { id: "table", label: "数据表", icon: "table-2" },
      { id: "chart", label: "BI 图表", icon: "chart-column-big" },
    ].map((item) => ({
      ...item,
      disabled: Boolean(disabledModes[item.id]),
      reason:
        typeof disabledModes[item.id] === "string"
          ? disabledModes[item.id]
          : undefined,
    }));
    return (
      <Segmented
        className={cx("ui-display-mode-switch", className)}
        items={items}
        activeId={value}
        onChange={onChange}
        ariaLabel="结果展示方式"
      />
    );
  }

  function Fact({
    label,
    value,
    secondary,
    icon,
    tone,
    mono = false,
    className,
    children,
  }) {
    return (
      <div className={cx("ui-fact", tone && `ui-fact--${tone}`, className)}>
        {icon ? (
          <span className="ui-fact__icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
        ) : null}
        <div className="ui-fact__content">
          <span className="ui-fact__label">{label}</span>
          <span className={cx("ui-fact__value", { "is-mono": mono })}>
            {value ?? children ?? "—"}
          </span>
          {secondary ? <span className="ui-fact__secondary">{secondary}</span> : null}
        </div>
      </div>
    );
  }

  function FactGrid({ children, columns, className }) {
    return (
      <div
        className={cx("ui-fact-grid", className)}
        style={columns ? { "--fact-grid-columns": columns } : undefined}
      >
        {children}
      </div>
    );
  }

  function Skeleton({ width, height, radius, lines, className, label = "正在加载" }) {
    if (lines && lines > 1) {
      return (
        <div className={cx("ui-skeleton-lines", className)} aria-label={label} role="status">
          {Array.from({ length: lines }).map((_, index) => (
            <span
              key={index}
              className="ui-skeleton"
              style={{
                width: index === lines - 1 ? "68%" : width || "100%",
                height: height || 12,
                borderRadius: radius,
              }}
            />
          ))}
        </div>
      );
    }
    return (
      <span
        className={cx("ui-skeleton", className)}
        style={{ width, height, borderRadius: radius }}
        aria-label={label}
        role="status"
      />
    );
  }

  function Progress({
    value,
    max = 100,
    label,
    showValue = false,
    tone = "brand",
    size = "md",
    className,
  }) {
    const determinate = Number.isFinite(Number(value));
    const safeValue = determinate
      ? Math.min(Math.max(Number(value), 0), Number(max) || 100)
      : undefined;
    const percent = determinate ? (safeValue / (Number(max) || 100)) * 100 : undefined;
    return (
      <div
        className={cx(
          "ui-progress",
          `ui-progress--${tone}`,
          `ui-progress--${size}`,
          { "is-indeterminate": !determinate },
          className,
        )}
      >
        {label || showValue ? (
          <div className="ui-progress__meta">
            {label ? <span>{label}</span> : <span />}
            {showValue && determinate ? <span>{Math.round(percent)}%</span> : null}
          </div>
        ) : null}
        <div
          className="ui-progress__track"
          role="progressbar"
          aria-label={label || "进度"}
          aria-valuemin={determinate ? 0 : undefined}
          aria-valuemax={determinate ? max : undefined}
          aria-valuenow={determinate ? safeValue : undefined}
        >
          <span
            className="ui-progress__bar"
            style={determinate ? { width: `${percent}%` } : undefined}
          />
        </div>
      </div>
    );
  }

  const valueAt = (row, path) => {
    if (typeof path === "function") return path(row);
    if (!path) return undefined;
    return String(path)
      .split(".")
      .reduce((value, key) => value?.[key], row);
  };

  function DataTable({
    columns = [],
    rows = [],
    rowKey = "id",
    selectedRowId,
    onRowClick,
    sortBy,
    sortDirection = "asc",
    onSort,
    caption,
    emptyTitle = "暂无数据",
    emptyDescription,
    compact = false,
    stickyHeader = false,
    className,
    getRowClassName,
    scrollSelectedIntoView = true,
    footer,
  }) {
    const selectedRowRef = useRef(null);
    const getKey = (row, index) =>
      typeof rowKey === "function" ? rowKey(row, index) : row?.[rowKey] ?? index;
    useEffect(() => {
      if (!scrollSelectedIntoView || selectedRowId === null || selectedRowId === undefined) return;
      selectedRowRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }, [scrollSelectedIntoView, selectedRowId, rows.length]);
    return (
      <div
        className={cx(
          "ui-data-table",
          { "ui-data-table--compact": compact, "has-sticky-header": stickyHeader },
          className,
        )}
      >
        <div className="ui-data-table__scroller">
          <table>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.sortable && onSort);
                  const sorted = sortBy === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={cx(
                        column.align && `is-${column.align}`,
                        column.className,
                      )}
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={
                        sorted
                          ? sortDirection === "desc"
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="ui-data-table__sort"
                          onClick={() =>
                            onSort(
                              column.key,
                              sorted && sortDirection === "asc" ? "desc" : "asc",
                              column,
                            )
                          }
                        >
                          <span>{column.label}</span>
                          <Icon
                            name={
                              sorted
                                ? sortDirection === "desc"
                                  ? "arrow-down"
                                  : "arrow-up"
                                : "arrow-up-down"
                            }
                            size={14}
                          />
                        </button>
                      ) : (
                        <span>{column.label}</span>
                      )}
                      {column.unit ? (
                        <span className="ui-data-table__unit">（{column.unit}）</span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, rowIndex) => {
                  const key = getKey(row, rowIndex);
                  const selected = String(key) === String(selectedRowId);
                  const clickable = Boolean(onRowClick);
                  return (
                    <tr
                      key={key}
                      ref={selected ? selectedRowRef : undefined}
                      className={cx(
                        { "is-selected": selected, "is-clickable": clickable },
                        getRowClassName?.(row, rowIndex),
                      )}
                      aria-selected={selected || undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={() => onRowClick?.(row, rowIndex)}
                      onKeyDown={(event) => {
                        if (clickable && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onRowClick(row, rowIndex);
                        }
                      }}
                    >
                      {columns.map((column) => {
                        const rawValue = valueAt(row, column.accessor || column.key);
                        const rendered = column.render
                          ? column.render(rawValue, row, rowIndex)
                          : column.format
                            ? column.format(rawValue, row)
                            : rawValue;
                        return (
                          <td
                            key={column.key}
                            className={cx(
                              column.align && `is-${column.align}`,
                              column.cellClassName,
                            )}
                          >
                            {rendered ?? <span className="ui-data-table__empty-value">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)}>
                    <EmptyState
                      compact
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              )}
            </tbody>
            {footer ? <tfoot>{footer}</tfoot> : null}
          </table>
        </div>
      </div>
    );
  }

  const DEFAULT_PALETTE = [
    "var(--chart-1, #2f66d0)",
    "var(--chart-2, #12a594)",
    "var(--chart-3, #7d62d9)",
    "var(--chart-4, #d0872f)",
    "var(--chart-5, #d55372)",
    "var(--chart-6, #68758a)",
  ];

  const CHART_TYPE_ALIASES = {
    auto: "recommended",
    system: "recommended",
    "system-recommended": "recommended",
    metric: "metric",
    indicator: "metric",
    "metric-card": "metric",
    card: "metric",
    bar: "horizontal-bar",
    horizontal: "horizontal-bar",
    "bar-horizontal": "horizontal-bar",
    column: "vertical-bar",
    vertical: "vertical-bar",
    "bar-vertical": "vertical-bar",
    stacked: "stacked-bar",
    "stacked-column": "stacked-bar",
    donut: "donut",
    ring: "donut",
    table: "table",
  };

  const normalizeChartType = (type = "recommended") =>
    CHART_TYPE_ALIASES[type] || type;

  const numberOf = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const defaultFormatValue = (value, unit = "", precision = 3) => {
    const numeric = numberOf(value);
    if (numeric === null) return value ?? "—";
    const formatted = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
    }).format(numeric);
    return `${formatted}${unit || ""}`;
  };

  const normalizeChartData = (data = [], labelKey = "label", valueKey = "value") =>
    data.map((item, index) => {
      if (typeof item === "number" || typeof item === "string") {
        return {
          id: String(index),
          label: `项目 ${index + 1}`,
          value: numberOf(item),
          rawValue: item,
          source: item,
        };
      }
      return {
        ...item,
        id: item.id ?? item.key ?? String(index),
        label: item[labelKey] ?? item.name ?? `项目 ${index + 1}`,
        value: numberOf(item[valueKey]),
        rawValue: item[valueKey],
        source: item,
      };
    });

  const blockedChartStatuses = new Set([
    "failed",
    "blocked",
    "not_consumable",
    "unavailable",
    "zero_denominator",
    "no_match",
    "empty",
    "quality_failed",
    "incompatible",
  ]);

  const blockedChartStatusLabels = new Set([
    "质量失败",
    "本体不兼容",
    "上下文不完整",
    "不可读取",
    "不可消费",
    "无法计算",
    "零分母",
    "对象不存在",
    "无匹配记录",
    "覆盖不足",
    "映射失败",
    "无法判断",
  ]);

  const isBlockedChartItem = (item) =>
    blockedChartStatuses.has(normalizeStatus(item?.status)) ||
    blockedChartStatusLabels.has(String(item?.status || "").trim()) ||
    item?.chartable === false;

  const getSegments = (item, series = []) => {
    if (Array.isArray(item.segments)) {
      return item.segments.map((segment, index) => ({
        id: segment.id ?? segment.key ?? String(index),
        key: segment.key ?? segment.id ?? String(index),
        label: segment.label ?? segment.name ?? `类别 ${index + 1}`,
        value: numberOf(segment.value),
        unit: segment.unit ?? item.unit,
        color: segment.color,
        evidenceId: segment.evidenceId,
        rowId: segment.rowId ?? item.rowId ?? item.id,
        parentId: item.id,
        source: segment,
      }));
    }
    return series.map((definition, index) => ({
      id: definition.id ?? definition.key ?? String(index),
      key: definition.key,
      label: definition.label ?? definition.name ?? definition.key,
      value: numberOf(item.source?.[definition.key]),
      unit: definition.unit ?? item.unit,
      color: definition.color,
      evidenceId: item.source?.[`${definition.key}EvidenceId`],
      rowId: item.rowId ?? item.id,
      parentId: item.id,
      source: definition,
    }));
  };

  const matchesChartSelection = (item, selectedId) =>
    selectedId !== null &&
    selectedId !== undefined &&
    [item?.id, item?.rowId, item?.evidenceId]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value) === String(selectedId));

  const resolveChartSelection = (items, selectedId, series = []) => {
    const direct = items.find((item) => matchesChartSelection(item, selectedId));
    if (direct) return direct;
    for (const item of items) {
      const segment = getSegments(item, series).find((candidate) => {
        const compoundId = `${item.id}:${candidate.id}`;
        return (
          matchesChartSelection(candidate, selectedId) ||
          String(compoundId) === String(selectedId)
        );
      });
      if (segment) {
        return {
          ...segment,
          id: `${item.id}:${segment.id}`,
          label: `${item.label} · ${segment.label}`,
          source: item.source || item,
        };
      }
    }
    return null;
  };

  function getChartApplicability(type, rawData = [], options = {}) {
    const requestedType = normalizeChartType(type);
    const items = normalizeChartData(
      rawData,
      options.labelKey || "label",
      options.valueKey || "value",
    );
    const blockedItems = items.filter(isBlockedChartItem);
    const chartableItems = items.filter(
      (item) => item.value !== null && !isBlockedChartItem(item),
    );
    const units = new Set(
      chartableItems
        .map((item) => item.unit || options.unit || "")
        .filter(Boolean),
    );
    const segmentGroups = items.map((item) => ({
      item,
      segments: getSegments(item, options.series || []).filter(
        (segment) => segment.value !== null,
      ),
    }));
    const hasSegments = segmentGroups.some((group) => group.segments.length);
    const total = chartableItems.reduce((sum, item) => sum + Math.max(item.value || 0, 0), 0);
    const hasNegative = chartableItems.some((item) => item.value < 0);
    const maxCategories = options.maxCategories || (requestedType === "donut" ? 6 : 12);

    if (!items.length) return { applicable: false, reason: "当前没有可展示的数据" };
    if (requestedType === "table") return { applicable: true, reason: "", items };
    if (blockedItems.length) {
      return {
        applicable: false,
        reason: "当前结果含无法计算或阻断项，已安全回退到数据表",
      };
    }
    if (requestedType === "stacked-bar") {
      if (!hasSegments || segmentGroups.some((group) => !group.segments.length)) {
        return { applicable: false, reason: "当前结果没有完整的构成维度" };
      }
      const segments = segmentGroups.flatMap((group) => group.segments);
      const segmentUnits = new Set(
        segments.map((segment) => segment.unit || options.unit || "").filter(Boolean),
      );
      if (segmentUnits.size > 1) {
        return { applicable: false, reason: "当前构成项包含不可直接比较的单位" };
      }
      if (segments.some((segment) => segment.value < 0)) {
        return { applicable: false, reason: "当前构成项包含负值，已安全回退到数据表" };
      }
      if (items.length > maxCategories && !options.allowTopN) {
        return { applicable: false, reason: "当前类别较多，已安全回退到数据表" };
      }
      return { applicable: true, reason: "", items };
    }
    if (!chartableItems.length) {
      return { applicable: false, reason: "当前结果无法形成不误导的图形" };
    }
    if (chartableItems.length !== items.length) {
      return {
        applicable: false,
        reason: "当前结果含缺失值，已安全回退到数据表",
      };
    }
    if (units.size > 1 && requestedType !== "stacked-bar") {
      return { applicable: false, reason: "当前结果包含不可直接比较的单位" };
    }
    if (requestedType === "metric" && chartableItems.length !== 1) {
      return { applicable: false, reason: "指标卡仅适用于单值结果" };
    }
    if (
      (requestedType === "horizontal-bar" || requestedType === "vertical-bar") &&
      chartableItems.length < 2
    ) {
      return { applicable: false, reason: "当前缺少可比较维度" };
    }
    if (hasNegative && ["horizontal-bar", "vertical-bar"].includes(requestedType)) {
      return { applicable: false, reason: "当前结果包含负值，已安全回退到数据表" };
    }
    if (requestedType === "donut") {
      if (chartableItems.length < 2) {
        return { applicable: false, reason: "当前缺少构成类别" };
      }
      if (chartableItems.length > maxCategories) {
        return { applicable: false, reason: "当前类别过多，不适合环形图" };
      }
      if (hasNegative || total <= 0 || options.partToWhole === false) {
        return { applicable: false, reason: "当前结果不满足部分与整体关系" };
      }
    }
    if (
      chartableItems.length > maxCategories &&
      !options.allowTopN &&
      requestedType !== "table"
    ) {
      return { applicable: false, reason: "当前类别较多，已安全回退到数据表" };
    }
    return { applicable: true, reason: "", items: chartableItems };
  }

  const invokeSelection = (onSelect, item, extra = {}) => {
    if (!onSelect) return;
    onSelect(item.id, item.source || item, { item, ...extra });
  };

  const chartKeyHandler = (handler) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

  function ChartSelection({ item, onEvidence, format, unit }) {
    if (!item) return null;
    return (
      <div className="ui-mini-chart__selection" role="status">
        <div>
          <span>{item.label}</span>
          <strong>{format(item.rawValue ?? item.value, item.unit || unit, item)}</strong>
        </div>
        {item.evidenceId && onEvidence ? (
          <Button
            size="sm"
            variant="ghost"
            icon="file-search"
            onClick={() => onEvidence(item.evidenceId, item.source || item)}
          >
            查看证据
          </Button>
        ) : null}
      </div>
    );
  }

  function ChartTableFallback({ items, format, unit, reason, onSelect, selectedId, onEvidence }) {
    const columns = [
      { key: "label", label: "业务项" },
      {
        key: "value",
        label: "精确值",
        align: "right",
        render: (_, item) =>
          item.value === null
            ? <StatusBadge status={item.status || "unavailable"} />
            : format(item.rawValue ?? item.value, item.unit || unit, item),
      },
      {
        key: "evidence",
        label: "证据",
        align: "right",
        render: (_, item) =>
          item.evidenceId && onEvidence ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onEvidence(item.evidenceId, item.source || item);
              }}
            >
              查看详情
            </Button>
          ) : (
            "—"
          ),
      },
    ];
    return (
      <div className="ui-mini-chart__fallback">
        {reason ? (
          <Notice tone="info" compact title="已切换为数据表">
            {reason}
          </Notice>
        ) : null}
        <DataTable
          compact
          columns={columns}
          rows={items}
          selectedRowId={selectedId}
          onRowClick={onSelect ? (item) => invokeSelection(onSelect, item) : undefined}
          emptyTitle="暂无可展示数据"
        />
      </div>
    );
  }

  function MetricChart({ item, selected, onSelect, format, unit, onEvidence }) {
    const content = (
      <>
        <span className="ui-mini-chart__metric-label">{item.label}</span>
        <strong className="ui-mini-chart__metric-value">
          {format(item.rawValue ?? item.value, item.unit || unit, item)}
        </strong>
        {item.secondary ? (
          <span className="ui-mini-chart__metric-secondary">{item.secondary}</span>
        ) : null}
        {item.status ? <StatusBadge status={item.status} /> : null}
      </>
    );
    return (
      <div className="ui-mini-chart__metric-wrap">
        {onSelect ? (
          <button
            type="button"
            className={cx("ui-mini-chart__metric", { "is-selected": selected })}
            onClick={() => invokeSelection(onSelect, item)}
            aria-pressed={selected}
          >
            {content}
          </button>
        ) : (
          <div className={cx("ui-mini-chart__metric", { "is-selected": selected })}>
            {content}
          </div>
        )}
        {item.evidenceId && onEvidence ? (
          <Button
            size="sm"
            variant="ghost"
            icon="file-search"
            onClick={() => onEvidence(item.evidenceId, item.source || item)}
          >
            查看证据
          </Button>
        ) : null}
      </div>
    );
  }

  function HorizontalBars({ items, maxValue, selectedId, onSelect, format, unit, palette }) {
    return (
      <div className="ui-mini-chart__horizontal-bars" role="list">
        {items.map((item, index) => {
          const percent = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 0) : 0;
          const selected = matchesChartSelection(item, selectedId);
          const exact = format(item.rawValue ?? item.value, item.unit || unit, item);
          return (
            <button
              key={item.id}
              type="button"
              className={cx("ui-mini-chart__bar-row", { "is-selected": selected })}
              role="listitem"
              onClick={() => invokeSelection(onSelect, item)}
              aria-pressed={selected}
              aria-label={`${item.label}，${exact}`}
              title={`${item.label}：${exact}${item.evidenceId ? "；可查看证据" : ""}`}
            >
              <span className="ui-mini-chart__bar-label">{item.label}</span>
              <span className="ui-mini-chart__bar-track" aria-hidden="true">
                <span
                  className="ui-mini-chart__bar-fill"
                  style={{ width: `${percent}%`, backgroundColor: item.color || palette[index % palette.length] }}
                />
                {item.value === 0 ? <span className="ui-mini-chart__zero-mark" /> : null}
              </span>
              <strong className="ui-mini-chart__bar-value">{exact}</strong>
            </button>
          );
        })}
      </div>
    );
  }

  function VerticalBars({ items, maxValue, selectedId, onSelect, format, unit, palette, height }) {
    return (
      <div
        className="ui-mini-chart__vertical-bars"
        role="list"
        style={{ "--mini-chart-plot-height": `${Math.max(height - 116, 160)}px` }}
      >
        {items.map((item, index) => {
          const percent = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 0) : 0;
          const selected = matchesChartSelection(item, selectedId);
          const exact = format(item.rawValue ?? item.value, item.unit || unit, item);
          return (
            <button
              key={item.id}
              type="button"
              className={cx("ui-mini-chart__column-item", { "is-selected": selected })}
              role="listitem"
              onClick={() => invokeSelection(onSelect, item)}
              aria-pressed={selected}
              aria-label={`${item.label}，${exact}`}
              title={`${item.label}：${exact}${item.evidenceId ? "；可查看证据" : ""}`}
            >
              <strong className="ui-mini-chart__column-value">{exact}</strong>
              <span className="ui-mini-chart__column-track" aria-hidden="true">
                <span
                  className="ui-mini-chart__column-fill"
                  style={{ height: `${percent}%`, backgroundColor: item.color || palette[index % palette.length] }}
                />
                {item.value === 0 ? <span className="ui-mini-chart__zero-mark" /> : null}
              </span>
              <span className="ui-mini-chart__column-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function StackedBars({
    items,
    series,
    selectedId,
    onSelect,
    format,
    unit,
    palette,
  }) {
    return (
      <div className="ui-mini-chart__stacked-bars">
        {items.map((item) => {
          const segments = getSegments(item, series).filter((segment) => segment.value !== null);
          const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
          return (
            <div className="ui-mini-chart__stacked-row" key={item.id}>
              <div className="ui-mini-chart__stacked-meta">
                <span>{item.label}</span>
                <strong>{format(total, item.unit || unit, item)}</strong>
              </div>
              <div className="ui-mini-chart__stacked-track" role="group" aria-label={`${item.label}构成`}>
                {segments.map((segment, index) => {
                  const segmentId = `${item.id}:${segment.id}`;
                  const percent = total > 0 ? (Math.max(segment.value, 0) / total) * 100 : 0;
                  const exact = format(segment.value, segment.unit || unit, segment);
                  const selected =
                    String(segmentId) === String(selectedId) ||
                    matchesChartSelection(segment, selectedId) ||
                    matchesChartSelection(item, selectedId);
                  return (
                    <button
                      key={segmentId}
                      type="button"
                      className={cx("ui-mini-chart__stacked-segment", { "is-selected": selected })}
                      style={{
                        width: `${percent}%`,
                        backgroundColor: segment.color || palette[index % palette.length],
                      }}
                      onClick={() =>
                        invokeSelection(
                          onSelect,
                          {
                            ...segment,
                            id: segmentId,
                            rowId: segment.rowId || item.rowId || item.id,
                            evidenceId: segment.evidenceId || item.evidenceId,
                            label: `${item.label} · ${segment.label}`,
                            source: segment.source || segment,
                          },
                          { parent: item.source || item, segment: segment.source || segment },
                        )
                      }
                      aria-pressed={selected}
                      aria-label={`${item.label}，${segment.label}，${exact}`}
                      title={`${item.label} · ${segment.label}：${exact}`}
                    >
                      <span className="sr-only">{segment.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function DonutChart({ items, selectedId, onSelect, format, unit, palette }) {
    const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
    let runningOffset = 0;
    return (
      <div className="ui-mini-chart__donut-layout">
        <svg
          className="ui-mini-chart__donut"
          viewBox="0 0 220 220"
          role="img"
          aria-label="构成环形图"
        >
          <circle className="ui-mini-chart__donut-track" cx="110" cy="110" r="72" pathLength="100" />
          {items.map((item, index) => {
            const percent = total > 0 ? (Math.max(item.value, 0) / total) * 100 : 0;
            const offset = runningOffset;
            runningOffset += percent;
            const selected = matchesChartSelection(item, selectedId);
            const exact = format(item.rawValue ?? item.value, item.unit || unit, item);
            return (
              <circle
                key={item.id}
                className={cx("ui-mini-chart__donut-segment", { "is-selected": selected })}
                cx="110"
                cy="110"
                r="72"
                pathLength="100"
                stroke={item.color || palette[index % palette.length]}
                strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 110 110)"
                tabIndex="0"
                role="button"
                aria-pressed={selected}
                aria-label={`${item.label}，${exact}，占比 ${percent.toFixed(1)}%`}
                onClick={() => invokeSelection(onSelect, item)}
                onKeyDown={chartKeyHandler(() => invokeSelection(onSelect, item))}
              >
                <title>{`${item.label}：${exact}（${percent.toFixed(1)}%）`}</title>
              </circle>
            );
          })}
          <text className="ui-mini-chart__donut-center-label" x="110" y="103" textAnchor="middle">
            合计
          </text>
          <text className="ui-mini-chart__donut-center-value" x="110" y="127" textAnchor="middle">
            {format(total, unit)}
          </text>
        </svg>
        <div className="ui-mini-chart__legend" aria-label="图例">
          {items.map((item, index) => {
            const selected = matchesChartSelection(item, selectedId);
            return (
              <button
                key={item.id}
                type="button"
                className={cx("ui-mini-chart__legend-item", { "is-selected": selected })}
                onClick={() => invokeSelection(onSelect, item)}
                aria-pressed={selected}
              >
                <span
                  className="ui-mini-chart__legend-swatch"
                  style={{ backgroundColor: item.color || palette[index % palette.length] }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                <strong>{format(item.rawValue ?? item.value, item.unit || unit, item)}</strong>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function MiniChart({
    type: typeProp,
    chartType,
    data = [],
    series = [],
    title,
    subtitle,
    unit = "",
    labelKey = "label",
    valueKey = "value",
    precision = 3,
    formatValue,
    selectedId,
    onSelect,
    onEvidence,
    onRestore,
    height = 320,
    maxCategories,
    allowTopN = false,
    partToWhole,
    showLegend = true,
    palette = DEFAULT_PALETTE,
    fallback = "table",
    fallbackReason,
    emptyTitle = "暂无可展示数据",
    emptyDescription = "调整问题范围后重新运行，即可在这里查看结果。",
    transition = "auto",
    className,
  }) {
    const requestedType = normalizeChartType(typeProp || chartType || "recommended");
    const allItems = useMemo(
      () => normalizeChartData(data, labelKey, valueKey),
      [data, labelKey, valueKey],
    );
    const format = (value, itemUnit, item) => {
      if (formatValue) return formatValue(value, itemUnit, item);
      if (item?.displayValue) return item.displayValue;
      return defaultFormatValue(value, itemUnit || "", precision);
    };

    let resolvedType = requestedType;
    if (requestedType === "recommended") {
      const hasSegments = allItems.some((item) => getSegments(item, series).length > 0);
      if (allItems.filter((item) => item.value !== null).length === 1) resolvedType = "metric";
      else if (hasSegments) resolvedType = "stacked-bar";
      else if (partToWhole && allItems.length <= (maxCategories || 6)) resolvedType = "donut";
      else resolvedType = "horizontal-bar";
    }

    const applicability = getChartApplicability(resolvedType, data, {
      labelKey,
      valueKey,
      unit,
      series,
      maxCategories,
      allowTopN,
      partToWhole,
    });
    let items = allItems;
    let limited = false;
    const limit = maxCategories || (resolvedType === "donut" ? 6 : 12);
    if (allowTopN && applicability.applicable && items.length > limit) {
      items = [...items]
        .sort((left, right) => (right.value ?? -Infinity) - (left.value ?? -Infinity))
        .slice(0, limit);
      limited = true;
    }

    const selectedItem = resolveChartSelection(allItems, selectedId, series);
    const maxValue = Math.max(...items.map((item) => Math.max(item.value || 0, 0)), 0);
    const shouldFallback = !applicability.applicable || resolvedType === "table";
    const fallbackMessage = fallbackReason || applicability.reason;

    if (!allItems.length) {
      return (
        <section
          className={cx("ui-mini-chart", "ui-mini-chart--empty", className)}
          style={{ minHeight: height }}
        >
          <EmptyState
            icon="chart-no-axes-combined"
            title={emptyTitle}
            description={emptyDescription}
          />
        </section>
      );
    }

    return (
      <section
        className={cx(
          "ui-mini-chart",
          `ui-mini-chart--${shouldFallback ? "table" : resolvedType}`,
          className,
        )}
        style={{ minHeight: height }}
        data-chart-type={shouldFallback ? "table" : resolvedType}
        data-transition={transition}
        aria-label={title || "业务结果图表"}
      >
        {title || subtitle || unit || onRestore ? (
          <header className="ui-mini-chart__header">
            <div>
              {title ? <h3>{title}</h3> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className="ui-mini-chart__header-actions">
              {unit ? <Badge tone="neutral">单位：{unit}</Badge> : null}
              {onRestore ? (
                <Button size="sm" variant="ghost" icon="rotate-ccw" onClick={onRestore}>
                  恢复完整范围
                </Button>
              ) : null}
            </div>
          </header>
        ) : null}

        {limited ? (
          <Notice tone="warning" compact title={`仅展示前 ${limit} 项`}>
            图表未完整展示；数据表保留当前查询返回的完整范围。
          </Notice>
        ) : null}

        <div className="ui-mini-chart__plot">
          {shouldFallback ? (
            fallback === "empty" ? (
              <EmptyState title="当前结果不适合图形展示" description={fallbackMessage} compact />
            ) : (
              <ChartTableFallback
                items={allItems}
                format={format}
                unit={unit}
                reason={resolvedType === "table" ? fallbackReason : fallbackMessage}
                onSelect={onSelect}
                selectedId={selectedId}
                onEvidence={onEvidence}
              />
            )
          ) : resolvedType === "metric" ? (
            <MetricChart
              item={items[0]}
              selected={matchesChartSelection(items[0], selectedId)}
              onSelect={onSelect}
              format={format}
              unit={unit}
              onEvidence={onEvidence}
            />
          ) : resolvedType === "horizontal-bar" ? (
            <HorizontalBars
              items={items}
              maxValue={maxValue}
              selectedId={selectedId}
              onSelect={onSelect}
              format={format}
              unit={unit}
              palette={palette}
            />
          ) : resolvedType === "vertical-bar" ? (
            <VerticalBars
              items={items}
              maxValue={maxValue}
              selectedId={selectedId}
              onSelect={onSelect}
              format={format}
              unit={unit}
              palette={palette}
              height={height}
            />
          ) : resolvedType === "stacked-bar" ? (
            <StackedBars
              items={items}
              series={series}
              selectedId={selectedId}
              onSelect={onSelect}
              format={format}
              unit={unit}
              palette={palette}
            />
          ) : resolvedType === "donut" ? (
            <DonutChart
              items={items}
              selectedId={selectedId}
              onSelect={onSelect}
              format={format}
              unit={unit}
              palette={palette}
            />
          ) : null}
        </div>

        {!shouldFallback && resolvedType !== "donut" && showLegend && series.length ? (
          <div className="ui-mini-chart__legend" aria-label="图例">
            {series.map((item, index) => (
              <span className="ui-mini-chart__legend-item" key={item.id || item.key || index}>
                <span
                  className="ui-mini-chart__legend-swatch"
                  style={{ backgroundColor: item.color || palette[index % palette.length] }}
                  aria-hidden="true"
                />
                <span>{item.label || item.name || item.key}</span>
              </span>
            ))}
          </div>
        ) : null}

        {selectedItem && !shouldFallback && resolvedType !== "metric" ? (
          <ChartSelection item={selectedItem} onEvidence={onEvidence} format={format} unit={unit} />
        ) : null}
      </section>
    );
  }

  MiniChart.getApplicability = getChartApplicability;

  class ChartErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false };
      this.retry = this.retry.bind(this);
    }

    static getDerivedStateFromError() {
      return { failed: true };
    }

    componentDidCatch(error) {
      this.props.onError?.(error);
    }

    componentDidUpdate(previousProps) {
      if (
        this.state.failed &&
        previousProps.resetKey !== this.props.resetKey
      ) {
        this.setState({ failed: false });
      }
    }

    retry() {
      this.setState({ failed: false });
      this.props.onRetry?.();
    }

    render() {
      if (!this.state.failed) return this.props.children;
      return (
        <div className="chart-stage is-failed" role="status">
          <Notice
            tone="danger"
            title="图表展示失败"
            action={
              this.props.onRetry ? (
                <Button size="sm" icon="refresh-cw" onClick={this.retry}>
                  重试图表
                </Button>
              ) : null
            }
          >
            已安全回退到数据表；固定结果、版本与证据保持不变。
          </Notice>
          <ChartTableFallback
            items={this.props.items || []}
            format={this.props.format}
            unit={this.props.unit}
            reason="图表区域暂时无法呈现，以下为同一份固定结构化结果。"
            onSelect={this.props.onSelect}
            selectedId={this.props.selectedId}
            onEvidence={this.props.onEvidence}
          />
        </div>
      );
    }
  }

  function SafeMiniChart(props) {
    const items = useMemo(
      () => normalizeChartData(props.data || [], props.labelKey || "label", props.valueKey || "value"),
      [props.data, props.labelKey, props.valueKey],
    );
    const format = (value, itemUnit, item) => {
      if (props.formatValue) return props.formatValue(value, itemUnit, item);
      if (item?.displayValue) return item.displayValue;
      return defaultFormatValue(value, itemUnit || "", props.precision ?? 3);
    };
    const resetKey =
      props.resetKey ||
      `${normalizeChartType(props.type || props.chartType)}:${props.resultId || "fixed"}`;
    return (
      <ChartErrorBoundary
        resetKey={resetKey}
        items={items}
        format={format}
        unit={props.unit || ""}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        onEvidence={props.onEvidence}
        onError={props.onError}
        onRetry={props.onRetry}
      >
        <MiniChart {...props} />
      </ChartErrorBoundary>
    );
  }

  const RESULT_CHART_OPTIONS = [
    { id: "recommended", label: "系统推荐", icon: "sparkles" },
    { id: "metric", label: "指标卡", icon: "square-equal" },
    { id: "horizontal-bar", label: "横向柱状图", icon: "chart-bar-big" },
    { id: "vertical-bar", label: "纵向柱状图", icon: "chart-column-big" },
    { id: "stacked-bar", label: "堆叠柱状图", icon: "chart-bar-stacked" },
    { id: "donut", label: "环形图", icon: "chart-pie" },
  ];

  const chartContractToken = (type) =>
    ({
      "horizontal-bar": "bar",
      "vertical-bar": "bar",
      "stacked-bar": "stacked",
    })[type] || type;

  function ResultChartMenu({
    value = "recommended",
    onChange,
    getChartModel,
    allowedTypes,
    options = RESULT_CHART_OPTIONS,
    className,
  }) {
    const evaluations = options.map((option) => {
      let model = null;
      let reason = "";
      try {
        model = getChartModel?.(option.id) || null;
      } catch (_) {
        reason = "当前图表适配信息无法读取";
      }
      const allowed =
        option.id === "recommended" ||
        !Array.isArray(allowedTypes) ||
        allowedTypes.includes(chartContractToken(option.id)) ||
        allowedTypes.includes(option.id);
      const resolvedType = normalizeChartType(
        option.id === "recommended" ? model?.type || "recommended" : option.id,
      );
      const check = model
        ? getChartApplicability(resolvedType, model.data || [], {
            labelKey: model.labelKey,
            valueKey: model.valueKey,
            unit: model.unit,
            series: model.series,
            maxCategories: model.maxCategories,
            allowTopN: model.allowTopN,
            partToWhole: model.partToWhole,
          })
        : { applicable: false, reason: reason || "当前结果没有该图表所需的语义结构" };
      return {
        ...option,
        disabled: !allowed || !check.applicable,
        reason: !allowed
          ? "当前结果语义未提供该图表所需的可比结构"
          : check.reason,
      };
    });
    const unavailable = evaluations.filter((item) => item.disabled && item.reason);
    return (
      <div className={cx("ui-result-chart-menu", className)}>
        <div className="chart-menu-inline" aria-label="图表类型">
          {evaluations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx({ active: value === item.id })}
              disabled={item.disabled}
              aria-disabled={item.disabled}
              aria-describedby={item.disabled ? `chart-reason-${item.id}` : undefined}
              title={item.disabled ? item.reason : item.label}
              onClick={() => !item.disabled && onChange?.(item.id, item)}
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {unavailable.length ? (
          <Notice tone="info" compact title="部分图表当前不可用">
            {unavailable.map((item, index) => (
              <React.Fragment key={item.id}>
                {index ? "；" : ""}
                <span id={`chart-reason-${item.id}`}>
                  {item.label}：{item.reason}
                </span>
              </React.Fragment>
            ))}
          </Notice>
        ) : null}
      </div>
    );
  }

  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const blockedCsvStatus = /质量失败|本体不兼容|无法计算|零分母|覆盖不足|映射失败|无法判断/;

  function buildStructuredResultCsv({
    result,
    context,
    generatedAt,
    resourceTypeFor,
    filename,
  }) {
    if (!result?.fixedResultId || !Array.isArray(result.rows) || !result.rows.length) {
      throw new Error("当前没有完整的固定结构化结果");
    }
    if (!context?.semanticVersion || !context?.dataVersion || !context?.asOf) {
      throw new Error("双版本或数据截至时间不完整");
    }
    if (context.allowConsumption === false || /质量失败|本体不兼容/.test(String(context.quality || ""))) {
      throw new Error("当前上下文不可消费，不能导出误导性结果");
    }
    const missingEvidence = result.rows.find((row) => !row.evidenceId);
    if (missingEvidence) {
      throw new Error(`${missingEvidence.object || "结果项"}缺少证据编号`);
    }
    const blockedRow = result.rows.find((row) => blockedCsvStatus.test(String(row.status || "")));
    if (blockedRow) {
      throw new Error(`${blockedRow.object || "结果项"}为“${blockedRow.status}”，不能导出误导性数值`);
    }
    const headers = [
      "业务对象",
      "资源类型",
      "稳定资源身份",
      "业务标签",
      "精确值",
      "单位",
      "业务状态",
      "业务提示",
      "证据编号",
      "已发布语义版本",
      "可消费数据版本",
      "数据截至时间",
      "生成时间",
      "质量状态",
      "新鲜度",
      "查询返回范围",
    ];
    const scopeLabel = result.queryDefinitionTopN
      ? `查询定义返回 Top ${result.queryDefinitionTopN}`
      : "当前查询完整结果";
    const rows = result.rows.map((row) => [
      row.object,
      resourceTypeFor?.(row.resourceId) || "语义结果",
      row.resourceId,
      row.label,
      row.exact,
      row.unit,
      row.status,
      row.warning || "",
      row.evidenceId,
      context.semanticVersion,
      context.dataVersion,
      context.asOf,
      generatedAt || "",
      context.quality || "",
      context.freshness || "",
      scopeLabel,
    ]);
    const safeName = String(filename || result.title || "问数结果")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim();
    return {
      filename: `${safeName || "问数结果"}.csv`,
      text: `\ufeff${[headers, ...rows]
        .map((line) => line.map(csvCell).join(","))
        .join("\n")}`,
      rowCount: rows.length,
      fixedResultId: result.fixedResultId,
    };
  }

  function downloadStructuredResultCsv(input) {
    const artifact = buildStructuredResultCsv(input);
    const blob = new Blob([artifact.text], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = artifact.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return artifact;
  }

  function StructuredResultText({ result, onEvidence }) {
    const rowsById = Object.fromEntries((result?.rows || []).map((row) => [row.id, row]));
    return (
      <div className="text-result">
        <p className="answer-summary">{result?.summary}</p>
        <div className={cx("metric-grid", { four: result?.highlights?.length === 4 })}>
          {(result?.highlights || []).map((item) => {
            const row = rowsById[item.id];
            const evidenceId = item.evidenceId || row?.evidenceId;
            return (
              <button
                type="button"
                className={cx("metric-card", item.tone)}
                key={item.id}
                disabled={!onEvidence || !evidenceId}
                title={!evidenceId ? "当前结果项缺少证据定位" : "查看证据"}
                onClick={() => onEvidence?.(evidenceId, row || item)}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.unit || "业务结果"} · {evidenceId ? "点击查看证据" : "证据定位不可用"}</small>
              </button>
            );
          })}
        </div>
        <div className="answer-proof">
          <Icon name="shield-check" size={16} />
          <span>所有正式数值均来自本轮固定结构化语义结果；展示切换不会重新计算。</span>
          {onEvidence ? <button onClick={() => onEvidence()}>查看证据</button> : null}
        </div>
      </div>
    );
  }

  function StructuredResultTable({
    result,
    selectedId,
    onSelect,
    onEvidence,
    onExport,
    exportDisabled = false,
    exportReason,
    exportLoading = false,
  }) {
    const rows = result?.rows || [];
    const columns = [
      { key: "object", label: "业务对象" },
      { key: "label", label: "指标 / 规则 / 关系" },
      { key: "exact", label: "精确值", align: "right" },
      { key: "unit", label: "单位" },
      { key: "status", label: "业务状态", render: (value) => <StatusBadge status={value} /> },
      {
        key: "evidenceId",
        label: "证据",
        render: (value, row) =>
          value && onEvidence ? (
            <Button
              size="sm"
              variant="ghost"
              icon="file-search"
              onClick={(event) => {
                event.stopPropagation();
                onEvidence(value, row);
              }}
            >
              查看详情
            </Button>
          ) : value || "—",
      },
    ];
    return (
      <div className="table-result">
        <div className="workspace-toolbar">
          <div>
            <strong>当前完整结果</strong>
            <small>
              {rows.length} 行 · 精确业务值
              {result?.queryDefinitionTopN ? ` · 查询定义返回 Top ${result.queryDefinitionTopN}` : ""}
            </small>
          </div>
          <span className="toolbar-spacer"></span>
          {onExport ? (
            <Button
              size="sm"
              icon="download"
              loading={exportLoading}
              disabled={exportDisabled}
              title={exportDisabled ? exportReason || "当前结果不可导出" : "导出当前完整结果"}
              onClick={onExport}
            >
              导出 CSV
            </Button>
          ) : null}
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          selectedRowId={selectedId}
          onRowClick={onSelect ? (row) => onSelect(row.id, row) : undefined}
          caption="当前问数固定结构化结果"
          compact
        />
      </div>
    );
  }

  function FixedResultViewer({
    result,
    context,
    generatedAt,
    mode = "text",
    chartType = "recommended",
    selectedId,
    getChartModel,
    onModeChange,
    onChartTypeChange,
    onSelect,
    onEvidence,
    onContext,
    onExport,
    exportDisabled = false,
    exportReason,
    exportLoading = false,
    onChartError,
    onRetryChart,
    readOnly = false,
    className,
  }) {
    const warningMessages = [
      ...(/失败|陈旧|上一可信|刷新中|警告/.test(String(context?.freshness || ""))
        ? [context.freshness]
        : []),
      ...(/警告|失败|无法判断/.test(String(context?.quality || ""))
        ? [context.quality]
        : []),
      ...((result?.rows || []).some((row) => row.warning) ? ["当前结果包含业务口径提示"] : []),
    ];
    const tableModel = {
      type: "table",
      data: (result?.rows || []).map((row) => ({
        id: row.id,
        rowId: row.id,
        evidenceId: row.evidenceId,
        label: row.object || row.label,
        value: null,
        status: row.status,
        unit: row.unit,
      })),
      series: [],
      unit: "",
    };
    let chartModel = tableModel;
    let chartModelFailure = "";
    try {
      chartModel = getChartModel?.(chartType) || tableModel;
    } catch (_) {
      chartModelFailure = "当前图表适配信息无法读取，已安全回退到数据表";
    }
    const handleChartSelect = (id, item, meta) => {
      const rowId = item?.rowId || meta?.item?.rowId || id;
      onSelect?.(rowId, item, meta);
    };
    const handleChartEvidence = (evidenceId, item) => {
      onEvidence?.(evidenceId || item?.evidenceId, item);
    };
    return (
      <section
        className={cx("ui-fixed-result-viewer", className)}
        data-fixed-result-id={result?.fixedResultId}
      >
        <ContextBar
          semanticVersion={context?.semanticVersion}
          dataVersion={context?.dataVersion}
          dataAsOf={context?.asOf}
          generatedAt={generatedAt}
          quality={context?.quality || "无法判断"}
          freshness={context?.freshness || "无法判断"}
          evidenceCount={result?.evidenceIds?.length ?? result?.rows?.length ?? 0}
          warnings={warningMessages}
          onEvidence={onEvidence ? () => onEvidence() : undefined}
          onOpen={onContext}
        />
        {warningMessages.length ? (
          <Notice tone="warning" compact title="本轮数据提示">
            {warningMessages.join("；")}。该提示在文字、表格和图表中持续有效。
          </Notice>
        ) : null}
        <div className="display-toolbar">
          <DisplayModeSwitch value={mode} onChange={onModeChange} />
          <span className="display-spacer"></span>
          {mode === "chart" ? (
            <ResultChartMenu
              value={chartType}
              onChange={onChartTypeChange}
              getChartModel={getChartModel}
              allowedTypes={result?.chart?.allowed}
            />
          ) : null}
        </div>
        <div className="result-stage">
          {mode === "text" ? (
            <StructuredResultText result={result} onEvidence={onEvidence} />
          ) : mode === "table" ? (
            <StructuredResultTable
              result={result}
              selectedId={selectedId}
              onSelect={onSelect}
              onEvidence={onEvidence}
              onExport={readOnly ? undefined : onExport}
              exportDisabled={exportDisabled}
              exportReason={exportReason}
              exportLoading={exportLoading}
            />
          ) : (
            <>
              {chartModelFailure ? (
                <Notice tone="danger" compact title="图表展示失败">
                  {chartModelFailure}；固定结果、版本与证据保持不变。
                </Notice>
              ) : null}
              <SafeMiniChart
                {...chartModel}
                resultId={result?.fixedResultId}
                title={result?.title}
                subtitle="点击图形元素可定位对应表格行和证据"
                selectedId={selectedId}
                onSelect={handleChartSelect}
                onEvidence={handleChartEvidence}
                onRestore={onSelect ? () => onSelect(null) : undefined}
                onError={onChartError}
                onRetry={onRetryChart}
                transition="semantic"
                fallbackReason={chartModelFailure}
              />
            </>
          )}
        </div>
      </section>
    );
  }

  function EvidenceList({
    items = [],
    selectedId,
    onSelect,
    onOpen,
    emptyTitle = "暂无证据",
    emptyDescription,
    className,
  }) {
    if (!items.length) {
      return (
        <EmptyState
          className={className}
          compact
          icon="file-search"
          title={emptyTitle}
          description={emptyDescription}
        />
      );
    }
    return (
      <ol className={cx("ui-evidence-list", className)}>
        {items.map((item, index) => {
          const id = item.id ?? String(index);
          const selected = String(id) === String(selectedId);
          const mainAction = onSelect || item.onOpen || onOpen;
          const content = (
            <>
              <span className="ui-evidence-list__icon" aria-hidden="true">
                <Icon name={item.icon || "file-check-2"} />
              </span>
              <span className="ui-evidence-list__content">
                <span className="ui-evidence-list__heading">
                  <strong>{item.title || item.label || id}</strong>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </span>
                {item.summary || item.description ? (
                  <span className="ui-evidence-list__summary">
                    {item.summary || item.description}
                  </span>
                ) : null}
                <span className="ui-evidence-list__meta">
                  {item.type ? <span>{item.type}</span> : null}
                  {item.source ? <span>{item.source}</span> : null}
                  {item.version ? <span>{item.version}</span> : null}
                  {item.asOf ? <span>截至 {item.asOf}</span> : null}
                </span>
              </span>
            </>
          );
          return (
            <li
              key={id}
              className={cx("ui-evidence-list__item", { "is-selected": selected })}
            >
              {mainAction ? (
                <button
                  type="button"
                  className="ui-evidence-list__main"
                  onClick={() => mainAction(id, item)}
                  aria-pressed={onSelect ? selected : undefined}
                >
                  {content}
                </button>
              ) : (
                <div className="ui-evidence-list__main">{content}</div>
              )}
              {onOpen || item.onOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  iconAfter="arrow-up-right"
                  disabled={item.openDisabled}
                  title={item.openDisabled ? item.openReason || "当前无法打开详情" : "查看详情"}
                  onClick={() => (item.onOpen || onOpen)?.(id, item)}
                >
                  查看详情
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  const RESOURCE_ICONS = {
    object: "boxes",
    object_type: "boxes",
    property: "list-tree",
    link: "git-branch",
    link_type: "git-branch",
    metric: "calculator",
    rule: "shield-check",
    action: "send",
    action_type: "send",
    skill: "sparkles",
  };

  const RESOURCE_LABELS = {
    object: "业务对象",
    object_type: "业务对象",
    property: "属性",
    link: "关系",
    link_type: "关系",
    metric: "指标",
    rule: "规则",
    action: "行动类型",
    action_type: "行动类型",
    skill: "能力",
  };

  function ResourceChip({
    type,
    typeLabel,
    name,
    id,
    version,
    status,
    onClick,
    disabled = false,
    disabledReason,
    className,
  }) {
    const normalizedType = String(type || "object").toLowerCase().replace(/[\s-]+/g, "_");
    const content = (
      <>
        <span className="ui-resource-chip__icon" aria-hidden="true">
          <Icon name={RESOURCE_ICONS[normalizedType] || "box"} size={15} />
        </span>
        <span className="ui-resource-chip__type">
          {typeLabel || RESOURCE_LABELS[normalizedType] || type}
        </span>
        <strong className="ui-resource-chip__name">{name || id}</strong>
        {version ? <span className="ui-resource-chip__version">{version}</span> : null}
        {status ? <StatusBadge status={status} /> : null}
        {onClick && !disabled ? <Icon name="arrow-up-right" size={14} /> : null}
      </>
    );
    if (onClick) {
      return (
        <button
          type="button"
          className={cx("ui-resource-chip", `ui-resource-chip--${normalizedType}`, className)}
          onClick={onClick}
          disabled={disabled}
          title={disabled ? disabledReason || "当前不可定位" : id}
        >
          {content}
        </button>
      );
    }
    return (
      <span
        className={cx("ui-resource-chip", `ui-resource-chip--${normalizedType}`, className)}
        title={id}
      >
        {content}
      </span>
    );
  }

  function ContextBar({
    semanticVersion,
    dataVersion,
    dataAsOf,
    generatedAt,
    quality,
    freshness,
    evidenceCount = null,
    items = [],
    warnings = [],
    onEvidence,
    onOpen,
    className,
  }) {
    const contextItems = [
      semanticVersion
        ? { id: "semantic", label: "语义版本", value: semanticVersion, icon: "network" }
        : null,
      dataVersion
        ? { id: "data", label: "数据版本", value: dataVersion, icon: "database" }
        : null,
      dataAsOf
        ? { id: "as-of", label: "数据截至", value: dataAsOf, icon: "calendar-clock" }
        : null,
      generatedAt
        ? { id: "generated", label: "生成时间", value: generatedAt, icon: "clock-3" }
        : null,
      ...items,
    ].filter(Boolean);

    return (
      <div className={cx("ui-context-bar", className)} aria-label="本轮上下文摘要">
        <div className="ui-context-bar__items">
          {contextItems.map((item, index) => (
            <div className="ui-context-bar__item" key={item.id || item.label || index} title={`${item.label}：${item.value}`}>
              {item.icon ? <Icon name={item.icon} size={15} /> : null}
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.status ? <StatusBadge status={item.status} /> : null}
            </div>
          ))}
          {quality ? (
            <div className="ui-context-bar__item" title={`质量：${React.isValidElement(quality) ? "查看状态" : quality}`}>
              <Icon name="shield-check" size={15} />
              <span>质量</span>
              {React.isValidElement(quality) ? quality : <StatusBadge status={quality} />}
            </div>
          ) : null}
          {freshness ? (
            <div className="ui-context-bar__item" title={`新鲜度：${React.isValidElement(freshness) ? "查看状态" : freshness}`}>
              <Icon name="refresh-cw" size={15} />
              <span>新鲜度</span>
              {React.isValidElement(freshness) ? freshness : <StatusBadge status={freshness} />}
            </div>
          ) : null}
        </div>
        <div className="ui-context-bar__actions">
          {warnings.length ? (
            <Badge tone="warning" icon="triangle-alert">
              {warnings.length} 项警告
            </Badge>
          ) : null}
          {evidenceCount !== null && evidenceCount !== undefined ? (
            <Button
              size="sm"
              variant="ghost"
              icon="file-search"
              onClick={onEvidence}
              disabled={!onEvidence}
            >
              证据 {evidenceCount || 0}
            </Button>
          ) : null}
          {onOpen ? (
            <Button size="sm" variant="ghost" iconAfter="chevron-right" onClick={onOpen}>
              查看详情
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const components = {
    cx,
    Icon,
    Button,
    IconButton,
    Badge,
    StatusBadge,
    Modal,
    Drawer,
    Toast,
    ToastRegion,
    EmptyState,
    Notice,
    PageHeader,
    Tabs,
    Segmented,
    DisplayModeSwitch,
    Fact,
    FactGrid,
    Skeleton,
    Progress,
    DataTable,
    MiniChart,
    SafeMiniChart,
    ResultChartMenu,
    StructuredResultText,
    StructuredResultTable,
    FixedResultViewer,
    EvidenceList,
    ResourceChip,
    ContextBar,
    buildStructuredResultCsv,
    downloadStructuredResultCsv,
    formatBusinessValue: defaultFormatValue,
    getChartApplicability,
    normalizeStatus,
  };

  window.IQComponents = Object.freeze(components);
  window.IQ = window.IQ || {};
  window.IQ.UI = Object.freeze({ ...(window.IQ.UI || {}), ...components });
})();
