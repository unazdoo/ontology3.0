const { useEffect, useMemo, useRef, useState } = React;

const DIRECTIONS = {
  a: {
    letter: "A",
    name: "旧项目延续与升级",
    description: "深色壳层、紧凑企业工作台、克制蓝色强调",
    tags: ["平台衔接最稳", "紧凑", "低动效"],
  },
  b: {
    letter: "B",
    name: "高密度作业工作台",
    description: "画布、检查器与运行证据形成连续诊断工作区",
    tags: ["证据优先", "高密度", "强分隔"],
  },
  c: {
    letter: "C",
    name: "现代玻璃工作台",
    description: "轻玻璃外壳、实色数据内容、清晰空间层级",
    tags: ["空间层级", "轻盈", "中等动效"],
  },
};

const NODES = [
  {
    key: "source",
    order: "01",
    name: "数据源",
    icon: "Database",
    color: "#9a6b37",
    libraryHint: "选择快照与工作簿证据",
    summary: "融资工作簿",
    detail: "SNAP-FIN-20260731-001",
  },
  {
    key: "python",
    order: "02",
    name: "Python 处理",
    icon: "SquareFunction",
    color: "#536ccf",
    libraryHint: "选择预置脚本并运行调试",
    summary: "融资标准化模块",
    detail: "v1.0.0 · 配置完整",
  },
  {
    key: "quality",
    order: "03",
    name: "数据检查",
    icon: "ShieldCheck",
    color: "#168477",
    libraryHint: "执行固定融资质量门",
    summary: "融资固定检查集",
    detail: "8 项检查 · 3 项警告",
  },
  {
    key: "publish",
    order: "04",
    name: "发布数据资产",
    icon: "PackageCheck",
    color: "#7659b1",
    libraryHint: "发布不可变版本包",
    summary: "融资标准化资产",
    detail: "四成员 · 三关系",
  },
  {
    key: "refresh",
    order: "05",
    name: "请求本体刷新",
    icon: "RefreshCw",
    color: "#43779b",
    libraryHint: "向精确 T017 发起请求",
    summary: "融资演示本体",
    detail: "Published v1.0.0",
  },
];

const QUALITY_ROWS = [
  { name: "利率形式完整性", level: "警告", count: "212", actual: "212 条为空", recovery: "确认可选字段影响" },
  { name: "期限种类完整性", level: "警告", count: "212", actual: "212 条为空", recovery: "确认可选字段影响" },
  { name: "担保方式完整性", level: "警告", count: "1,868", actual: "1,868 条为空", recovery: "确认可选字段影响" },
  { name: "主体身份完整性", level: "通过", count: "0", actual: "574 / 574 可识别", recovery: "无需处理" },
];

const PREVIEW_ROWS = [
  ["ORG-0001", "单位A", "境内新能源", "INST-001", "银行A", "人民币", "1,250,000,000"],
  ["ORG-0002", "单位B", "核能", "INST-004", "银行D", "人民币", "820,000,000"],
  ["ORG-0003", "单位C", "数字化", "INST-011", "银行K", "人民币", "530,000,000"],
];

const INSPECTOR_CONTENT = {
  source: {
    status: "配置完整",
    sections: [
      {
        title: "已选输入",
        fields: [
          ["原始快照", "SNAP-FIN-20260731-001", "mono"],
          ["数据截至时间", "2026-07-31"],
          ["更新方式", "全量快照"],
          ["内容指纹", "SHA256 · 8f31…c219", "mono"],
        ],
      },
      {
        title: "来源证据",
        fields: [
          ["来源", "手工上传"],
          ["工作簿", "融资一览表_一期演示数据.xlsx"],
          ["工作表", "2-融资一览表明细；单位负责人映射"],
        ],
      },
    ],
  },
  python: {
    status: "配置完整",
    sections: [
      {
        title: "预置脚本组件",
        scriptSelector: true,
        fields: [
          ["输入", "SNAP-FIN-20260731-001", "mono"],
          ["输出", "四成员候选 + 三关系候选"],
        ],
      },
      {
        title: "工作表角色与表头",
        fields: [
          ["融资明细", "2-融资一览表明细 · 表头行 1"],
          ["负责人映射", "单位负责人映射 · 表头行 3"],
          ["缺失展示", "未知"],
        ],
      },
    ],
  },
  quality: {
    status: "执行成功 · 质量有警告",
    sections: [
      {
        title: "固定检查集",
        fields: [
          ["检查集版本", "融资固定检查集 v1.0"],
          ["当前结果", "8 项完成 · 3 项警告"],
          ["发布结论", "等待人工确认"],
        ],
      },
      {
        title: "检查分组",
        checks: [
          ["主体身份完整性", "硬阻断", "hard"],
          ["金融机构端点匹配", "硬阻断", "hard"],
          ["可选分类完整性", "警告", "warn"],
          ["规模变化", "警告", "warn"],
        ],
      },
    ],
  },
  publish: {
    status: "等待质量确认",
    sections: [
      {
        title: "发布合同",
        fields: [
          ["资产名称", "融资标准化数据资产"],
          ["版本包", "四成员 · 三关系 · 原子发布"],
          ["数据截至时间", "2026-07-31"],
          ["不可变规则", "发布后禁止原位修改"],
        ],
      },
      {
        title: "四个资产成员",
        fields: [
          ["成员 1", "融资主体参考"],
          ["成员 2", "融资明细"],
          ["成员 3", "金融机构参考"],
          ["成员 4", "融资负责人参考"],
        ],
      },
    ],
  },
  refresh: {
    status: "未执行",
    sections: [
      {
        title: "请求目标",
        fields: [
          ["目标本体", "融资演示本体"],
          ["精确 T017", "Published v1.0.0", "mono"],
          ["来源映射", "融资标准化来源映射 v1"],
        ],
      },
      {
        title: "结果证据",
        fields: [
          ["请求状态", "等待上游发布"],
          ["刷新结果", "未形成"],
          ["T018 / T019", "未形成 / 未采用"],
        ],
      },
    ],
  },
};

function Icon({ name, size = 16, className = "", strokeWidth = 1.8, title = "" }) {
  const fallback = window.lucide && window.lucide.icons ? window.lucide.icons.Circle : [];
  const iconNodes = window.lucide && window.lucide.icons ? (window.lucide.icons[name] || fallback) : [];
  return (
    <svg
      className={`icon ${className}`.trim()}
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

function DirectionSwitcher({ direction, onChange }) {
  return (
    <div className="direction-switch" aria-label="视觉方向">
      {Object.entries(DIRECTIONS).map(([key, item]) => (
        <button
          key={key}
          type="button"
          className={direction === key ? "active" : ""}
          onClick={() => onChange(key)}
          aria-pressed={direction === key}
          title={`切换到方案 ${item.letter}：${item.name}`}
        >
          <span>{item.letter}</span>
          {item.name}
        </button>
      ))}
    </div>
  );
}

function ReviewTopbar({ viewMode, setViewMode, onInfo, onShortcuts }) {
  return (
    <header className="review-topbar">
      <div className="review-brand">
        <div className="review-mark"><Icon name="Workflow" size={17} /></div>
        <div className="review-title-wrap">
          <h1 className="review-title">数据工程 · 视觉方向评审</h1>
          <div className="review-kicker">D5 管道画布代表场景 · 2026-08-09</div>
        </div>
      </div>

      <div className="review-mode" aria-label="评审模式">
        <button type="button" className={viewMode === "compare" ? "active" : ""} onClick={() => setViewMode("compare")}>
          <Icon name="Columns3" size={14} />并排比较
        </button>
        <button type="button" className={viewMode === "focus" ? "active" : ""} onClick={() => setViewMode("focus")}>
          <Icon name="Expand" size={14} />聚焦操作
        </button>
      </div>

      <div className="review-actions">
        <button type="button" className="review-btn" onClick={onInfo}>
          <Icon name="Info" size={15} />评审说明
        </button>
        <button type="button" className="review-btn" onClick={onShortcuts}>
          <Icon name="Keyboard" size={15} />快捷键
        </button>
      </div>
    </header>
  );
}

function ReviewStrip({ direction, setDirection, scenario, onReset }) {
  const scenarioCopy = scenario === "warning"
    ? "质量有警告 · 等待人工确认"
    : scenario === "continued"
      ? "已确认警告 · 发布节点准备继续"
      : scenario === "stopped"
        ? "本次运行已结束 · 未发布新版本"
        : "试运行完成 · 正式结论未改变";

  return (
    <section className="review-strip" aria-label="原型评审上下文">
      <div className="review-context">
        <span className="prototype-badge">视觉方向评审</span>
        <span className="context-copy">交互与状态为原型模拟，不代表后端能力已实现；三套方案功能范围完全一致。</span>
      </div>
      <div className="review-strip-right">
        <DirectionSwitcher direction={direction} onChange={setDirection} />
        <div className="scenario-control">
          <span className="scenario-label">代表场景</span>
          <span className="scenario-value"><Icon name="TriangleAlert" size={14} />{scenarioCopy}</span>
          <button type="button" className="reset-btn icon-btn" onClick={onReset} title="恢复代表场景" aria-label="恢复代表场景">
            <Icon name="RotateCcw" size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function DirectionCard({ directionKey, selected, onFocus, sharedProps }) {
  const direction = DIRECTIONS[directionKey];
  return (
    <article className={`direction-option dir-${directionKey} ${selected ? "selected" : ""}`} data-screen-label={`视觉方向 ${direction.letter}：${direction.name}`}>
      <header className="direction-option-header">
        <div className="direction-copy">
          <div className="direction-title-row">
            <span className="direction-letter">{direction.letter}</span>
            <h2 className="direction-name">{direction.name}</h2>
          </div>
          <p className="direction-description">{direction.description}</p>
          <div className="direction-tags">
            {direction.tags.map((tag) => <span className="direction-tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <button type="button" className="focus-btn" onClick={() => onFocus(directionKey)}>
          <Icon name="Maximize2" size={14} />聚焦
        </button>
      </header>
      <Workbench directionKey={directionKey} compact={true} {...sharedProps} />
    </article>
  );
}

function GlobalRail({ compact }) {
  return (
    <aside className="global-rail" aria-label="平台模块导航示意">
      <div className="module-mark" title="数据工程"><Icon name="Workflow" size={compact ? 10 : 16} /></div>
      <div className="rail-item active" title="数据工程画布"><Icon name="GitBranch" size={compact ? 9 : 15} /></div>
      <div className="rail-item" aria-disabled="true" title="本轮仅评审数据工程画布"><Icon name="Database" size={compact ? 9 : 15} /></div>
      <div className="rail-item" aria-disabled="true" title="本轮仅评审数据工程画布"><Icon name="Boxes" size={compact ? 9 : 15} /></div>
      <div className="rail-spacer"></div>
      <div className="rail-item" aria-disabled="true" title="单一演示账号"><Icon name="UserRound" size={compact ? 9 : 15} /></div>
    </aside>
  );
}

function ResourceNav({ compact }) {
  return (
    <aside className="resource-nav" aria-label="数据工程资源导航">
      <div className="resource-head">
        <Icon name="Database" size={compact ? 10 : 16} />
        <div><strong>数据工程</strong><span>融资演示工作区</span></div>
      </div>
      <div className="resource-section">
        <div className="resource-label">Build</div>
        <div className="resource-item"><Icon name="FolderInput" size={compact ? 8 : 14} />数据源<span className="count">2</span></div>
        <div className="resource-item active"><Icon name="Workflow" size={compact ? 8 : 14} />管道画布<span className="count">1</span></div>
        <div className="resource-item"><Icon name="Package" size={compact ? 8 : 14} />数据资产<span className="count">1</span></div>
      </div>
      <div className="resource-section">
        <div className="resource-label">Observe</div>
        <div className="resource-item"><Icon name="History" size={compact ? 8 : 14} />运行历史<span className="count">6</span></div>
        <div className="resource-item"><Icon name="Route" size={compact ? 8 : 14} />数据沿袭</div>
      </div>
    </aside>
  );
}

function ProductToolbar({
  compact,
  selectedNode,
  dirty,
  saving,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onTrial,
  onFormalRun,
  scenario,
}) {
  const selectedName = NODES.find((node) => node.key === selectedNode)?.name || "当前节点";
  const runBlocked = scenario !== "stopped";
  const runBlockedReason = scenario === "continued"
    ? "当前运行正在继续发布，结束前不能新建正式运行"
    : "当前运行等待质量确认，完成处置后才能再次正式运行";
  const saveCopy = saving ? "保存中" : dirty ? "有未保存更改" : "已保存";
  return (
    <header className="product-toolbar">
      <div className="product-title">
        <div className="product-title-row">
          <span className="breadcrumb">数据管道 /</span>
          <strong className="pipeline-name">融资数据标准化与发布</strong>
          <span className="version-label">PIPE-FIN-STD-v1.0</span>
        </div>
        <div className={`save-state ${dirty ? "dirty" : "saved"}`}>{saveCopy}</div>
      </div>
      <div className="product-actions">
        <button type="button" className="icon-btn" onClick={onUndo} disabled={!dirty || saving} title={dirty ? "撤销最近参数更改" : "当前没有可撤销操作"} aria-label="撤销">
          <Icon name="Undo2" size={compact ? 9 : 14} />
        </button>
        <button type="button" className="icon-btn" onClick={onRedo} disabled={!canRedo || saving} title={canRedo ? "重做最近参数更改" : "当前没有可重做操作"} aria-label="重做">
          <Icon name="Redo2" size={compact ? 9 : 14} />
        </button>
        <button type="button" className="tool-btn secondary-action" onClick={onSave} disabled={!dirty || saving} title={dirty ? "保存管道配置" : "配置已保存"}>
          <Icon name="Save" size={compact ? 9 : 14} /><span>{saving ? "保存中" : "保存"}</span>
        </button>
        <button type="button" className="tool-btn" onClick={onTrial} title={`试运行至：${selectedName}`}>
          <Icon name="Play" size={compact ? 9 : 14} /><span>试运行至：{selectedName}</span>
        </button>
        <button type="button" className="tool-btn primary" onClick={onFormalRun} disabled={runBlocked} title={runBlocked ? runBlockedReason : "正式运行全流程"}>
          <Icon name="Rocket" size={compact ? 9 : 14} /><span>正式运行全流程</span>
        </button>
      </div>
    </header>
  );
}

function NodeLibrary({ compact }) {
  return (
    <aside className="node-library" aria-label="一期节点库">
      <div className="library-head"><strong>节点库</strong><span>一期固定 5 类</span></div>
      <div className="library-list">
        {NODES.map((node) => (
          <div className="library-node" key={node.key} style={{ "--node-color": node.color }} title={`${node.name}：${node.libraryHint}`}>
            <span className="library-node-mark"><Icon name={node.icon} size={compact ? 8 : 14} /></span>
            <span><strong>{node.name}</strong><small>{node.libraryHint}</small></span>
          </div>
        ))}
      </div>
      <div className="library-summary">5 / 5 已在画布 · 5 / 5 配置完整</div>
    </aside>
  );
}

function nodeStatus(nodeKey, scenario) {
  if (nodeKey === "source" || nodeKey === "python") return { text: "执行成功", kind: "success", icon: "CircleCheck" };
  if (nodeKey === "quality") {
    if (scenario === "continued") return { text: "已确认警告", kind: "warning", icon: "TriangleAlert" };
    if (scenario === "stopped") return { text: "本次已结束", kind: "failed", icon: "CircleStop" };
    return { text: "执行成功", kind: "success", icon: "CircleCheck" };
  }
  if (nodeKey === "publish") {
    if (scenario === "continued") return { text: "准备发布", kind: "running", icon: "Clock3" };
    if (scenario === "stopped") return { text: "未发布", kind: "failed", icon: "CircleStop" };
    return { text: "等待确认", kind: "warning", icon: "Clock3" };
  }
  return { text: "未执行", kind: "", icon: "CircleDashed" };
}

function PipelineNode({ node, selected, onSelect, compact, scenario }) {
  const status = nodeStatus(node.key, scenario);
  return (
    <button
      type="button"
      className={`pipeline-node ${selected ? "selected" : ""}`}
      style={{ "--node-color": node.color }}
      onClick={() => onSelect(node.key)}
      aria-pressed={selected}
      title={`选择节点：${node.name}`}
    >
      <span className="node-title-row">
        <span className="node-number">{node.order}</span>
        <span className="node-title">{node.name}</span>
        <Icon name={node.icon} size={compact ? 7 : 12} />
      </span>
      <span className="node-config">
        <strong>{node.summary}</strong>
        {node.detail}
      </span>
      {node.key === "quality" ? (
        <span className="status-row">
          <span className={`status-pill ${status.kind}`} title={scenario === "continued" ? "质量警告已人工确认" : scenario === "stopped" ? "本次运行已结束" : "节点执行成功"}><Icon name={status.icon} size={compact ? 5 : 9} />{compact ? "成" : scenario === "continued" ? "已确认" : scenario === "stopped" ? "已结束" : "成功"}</span>
          <span className="status-pill warning" title="质量有 3 项警告"><Icon name="TriangleAlert" size={compact ? 5 : 9} />{compact ? "警3" : "警告 3"}</span>
        </span>
      ) : node.key === "refresh" ? (
        compact ? <span className="status-row"><span className="status-pill"><Icon name="CircleDashed" size={5} />未执行</span></span> : <span className="refresh-status-stack"><span><b>请求</b>｜未发起</span><span><b>结果</b>｜未形成</span></span>
      ) : (
        <span className="status-row"><span className={`status-pill ${status.kind}`}><Icon name={status.icon} size={compact ? 5 : 9} />{compact ? (status.kind === "success" ? "成功" : status.kind === "warning" ? "等待" : status.text) : status.text}</span></span>
      )}
    </button>
  );
}

function Canvas({ compact, selectedNode, onSelectNode, zoom, setZoom, scenario, onFit }) {
  return (
    <section className="canvas-area" aria-label="五节点管道画布">
      <div className="canvas-meta">
        <span className="canvas-chip"><Icon name="TriangleAlert" size={compact ? 6 : 10} />质量有警告 · 等待确认</span>
        <span>T008 2026-07-31</span>
      </div>
      <div className="canvas-stage">
        <div className="node-flow" style={{ transform: `scale(${zoom / 100})` }}>
          {NODES.map((node, index) => (
            <React.Fragment key={node.key}>
              <PipelineNode node={node} selected={selectedNode === node.key} onSelect={onSelectNode} compact={compact} scenario={scenario} />
              {index < NODES.length - 1 ? <span className={`flow-connector ${index < 2 ? "complete" : ""}`}></span> : null}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="viewport-tools" aria-label="画布视口控制">
        <button type="button" className="viewport-btn" onClick={() => setZoom((value) => Math.max(70, value - 10))} disabled={zoom <= 70} title="缩小" aria-label="缩小"><Icon name="ZoomOut" size={compact ? 7 : 12} /></button>
        <span className="viewport-btn zoom-label" aria-live="polite">{zoom}%</span>
        <button type="button" className="viewport-btn" onClick={onFit} title="适应窗口">适应</button>
        <button type="button" className="viewport-btn" onClick={() => setZoom((value) => Math.min(130, value + 10))} disabled={zoom >= 130} title="放大" aria-label="放大"><Icon name="ZoomIn" size={compact ? 7 : 12} /></button>
      </div>
    </section>
  );
}

function Inspector({ compact, selectedNode, onClose, scriptVersion, onScriptChange, scenario }) {
  const node = NODES.find((item) => item.key === selectedNode) || NODES[2];
  const content = INSPECTOR_CONTENT[selectedNode] || INSPECTOR_CONTENT.quality;
  let statusCopy = content.status;
  if (selectedNode === "publish" && scenario === "continued") statusCopy = "质量警告已确认 · 准备发布";
  if (selectedNode === "publish" && scenario === "stopped") statusCopy = "本次运行已结束 · 未发布";

  return (
    <aside className="inspector" aria-label={`${node.name}配置检查器`}>
      <div className="inspector-head">
        <div className="inspector-title-row">
          <span className="inspector-node-icon" style={{ "--node-color": node.color }}><Icon name={node.icon} size={compact ? 8 : 14} /></span>
          <span><strong>{node.name}</strong><small>{statusCopy}</small></span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="关闭配置抽屉（Esc）" aria-label="关闭配置抽屉"><Icon name="X" size={13} /></button>
      </div>
      <div className="inspector-scroll">
        {content.sections.map((section) => (
          <section className="form-section" key={section.title}>
            <h3 className="form-section-title">{section.title}</h3>
            {section.scriptSelector ? (
              <select className="script-select" value={scriptVersion} onChange={(event) => onScriptChange(event.target.value)} aria-label="预置 Python 脚本组件">
                <option value="融资标准化模块 v1.0.0">融资标准化模块 v1.0.0</option>
                <option value="融资标准化模块 v1.1.0-评审">融资标准化模块 v1.1.0-评审</option>
              </select>
            ) : null}
            {section.fields ? section.fields.map(([label, value, kind]) => (
              <div className="field-row" key={label}>
                <span className="field-label">{label}</span>
                <span className={`field-value ${kind || ""}`}>{value}</span>
              </div>
            )) : null}
            {section.checks ? section.checks.map(([name, level, kind]) => (
              <div className="check-row" key={name}>
                <span className="check-name">{name}</span>
                <span className={`severity ${kind}`}>{level}</span>
              </div>
            )) : null}
          </section>
        ))}
      </div>
      <div className="inspector-foot"><span>当前运行</span><strong>RUN-FIN-20260809-001</strong></div>
    </aside>
  );
}

function QualityPanel({ compact, scenario, onContinue, onStop }) {
  const verdict = scenario === "continued"
    ? ["警告已确认", "继续理由已登记，发布节点准备继续"]
    : scenario === "stopped"
      ? ["本次不继续发布", "未生成新 T007，上一可信版本继续服务"]
      : ["等待人工确认", "执行成功不等于质量通过；尚未生成 T007"];
  return (
    <>
      <div className="quality-summary">
        <div className="summary-metric"><strong>8</strong><span>检查总数</span></div>
        <div className="summary-metric"><strong>0</strong><span>硬门失败</span></div>
        <div className="summary-metric warning"><strong>3</strong><span>警告</span></div>
        <div className="summary-metric"><strong>0</strong><span>无法判断</span></div>
        <div className="summary-verdict"><Icon name={scenario === "stopped" ? "CircleStop" : "TriangleAlert"} size={compact ? 8 : 16} /><span><strong>{verdict[0]}</strong><span>{verdict[1]}</span></span></div>
      </div>
      <table className="data-table">
        <thead><tr><th style={{ width: "24%" }}>检查项</th><th style={{ width: "11%" }}>结果</th><th className="numeric" style={{ width: "11%" }}>影响行数</th><th style={{ width: "24%" }}>实际结果</th><th>恢复建议</th></tr></thead>
        <tbody>
          {QUALITY_ROWS.map((row) => (
            <tr key={row.name}><td>{row.name}</td><td><span className={`status-pill ${row.level === "警告" ? "warning" : "success"}`}>{row.level}</span></td><td className="numeric">{row.count}</td><td>{row.actual}</td><td>{row.recovery}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="quality-action-row">
        <button type="button" className="danger-btn" onClick={onStop} disabled={scenario !== "warning"}>本次不继续发布</button>
        <button type="button" className="primary-btn" onClick={onContinue} disabled={scenario !== "warning"}>填写理由并继续发布</button>
      </div>
    </>
  );
}

function RunPanel({ compact, selectedNode }) {
  return (
    <table className="data-table">
      <thead><tr><th style={{ width: "20%" }}>节点</th><th style={{ width: "14%" }}>执行状态</th><th>开始时间</th><th className="numeric">耗时</th><th className="numeric">输入 / 输出</th><th>证据摘要</th></tr></thead>
      <tbody>
        {NODES.map((node, index) => {
          const complete = index <= 2;
          return (
            <tr key={node.key} style={node.key === selectedNode ? { background: "#f1f6fc" } : undefined}>
              <td>{node.order} · {node.name}</td>
              <td><span className={`status-pill ${complete ? "success" : index === 3 ? "warning" : ""}`}>{complete ? "执行成功" : index === 3 ? "等待确认" : "未执行"}</span></td>
              <td>{complete ? `2026-08-09 10:0${index}:1${index}` : "—"}</td>
              <td className="numeric">{complete ? ["1.2 秒", "18.6 秒", "4.8 秒"][index] : "—"}</td>
              <td className="numeric">{complete ? ["1 / 1", "5,218 / 5,218", "5,218 / 5,218"][index] : "—"}</td>
              <td>{complete ? "证据已登记" : index === 3 ? "上游质量警告待人工处置" : "等待 T007"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PreviewPanel({ selectedNode }) {
  if (selectedNode === "publish") {
    return (
      <table className="data-table">
        <thead><tr><th>资产成员</th><th>候选粒度</th><th className="numeric">记录数</th><th>主键</th><th>发布状态</th></tr></thead>
        <tbody>
          <tr><td>融资主体参考</td><td>一行一融资主体</td><td className="numeric">574</td><td>单位编码</td><td>等待质量确认</td></tr>
          <tr><td>融资明细</td><td>一行一融资明细</td><td className="numeric">5,218</td><td>借据标识</td><td>等待质量确认</td></tr>
          <tr><td>金融机构参考</td><td>一行一金融机构</td><td className="numeric">24</td><td>机构编码</td><td>等待质量确认</td></tr>
          <tr><td>融资负责人参考</td><td>一行一负责人</td><td className="numeric">24</td><td>负责人标识</td><td>等待质量确认</td></tr>
        </tbody>
      </table>
    );
  }
  if (selectedNode === "refresh") {
    return <div className="empty-panel"><span>刷新节点尚未执行。发布 T007 后，此处展示请求与结果证据，不展示本体内部对象配置。</span></div>;
  }
  return (
    <table className="data-table">
      <thead><tr><th>单位编码</th><th>单位名称</th><th>统一产业板块</th><th>机构编码</th><th>金融机构</th><th>币种</th><th className="numeric">融资余额</th></tr></thead>
      <tbody>{PREVIEW_ROWS.map((row, index) => <tr key={index}>{row.map((value, cellIndex) => <td key={cellIndex} className={cellIndex === 6 ? "numeric" : ""}>{value}</td>)}</tr>)}</tbody>
    </table>
  );
}

function BottomPanel({ compact, selectedNode, bottomTab, setBottomTab, panelOpen, setPanelOpen, scenario, onContinue, onStop }) {
  return (
    <section className="bottom-panel" aria-label="节点证据面板">
      <div className="panel-context">
        <span className="context-evidence"><strong>{NODES.find((node) => node.key === selectedNode)?.name}</strong> ｜ 正式运行·手工上传 ｜ SNAP-FIN-20260731-001 ｜ T008 2026-07-31 ｜ RUN-FIN-20260809-001</span>
        <button type="button" className="icon-btn" onClick={() => setPanelOpen(!panelOpen)} title={panelOpen ? "收起底部面板" : "展开底部面板"} aria-label={panelOpen ? "收起底部面板" : "展开底部面板"}>
          <Icon name={panelOpen ? "PanelBottomClose" : "PanelBottomOpen"} size={compact ? 8 : 13} />
        </button>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="底部证据页签">
        <button type="button" role="tab" className={`panel-tab ${bottomTab === "preview" ? "active" : ""}`} aria-selected={bottomTab === "preview"} onClick={() => setBottomTab("preview")}>数据预览</button>
        <button type="button" role="tab" className={`panel-tab ${bottomTab === "run" ? "active" : ""}`} aria-selected={bottomTab === "run"} onClick={() => setBottomTab("run")}>运行结果</button>
        <button type="button" role="tab" className={`panel-tab ${bottomTab === "quality" ? "active" : ""}`} aria-selected={bottomTab === "quality"} disabled={selectedNode !== "quality"} title={selectedNode !== "quality" ? "质量结果仅适用于数据检查节点" : "查看质量结果"} onClick={() => setBottomTab("quality")}>质量结果</button>
      </div>
      <div className="panel-body" role="tabpanel">
        {bottomTab === "quality" ? <QualityPanel compact={compact} scenario={scenario} onContinue={onContinue} onStop={onStop} /> : null}
        {bottomTab === "run" ? <RunPanel compact={compact} selectedNode={selectedNode} /> : null}
        {bottomTab === "preview" ? <PreviewPanel selectedNode={selectedNode} /> : null}
      </div>
    </section>
  );
}

function Workbench({
  directionKey,
  compact,
  selectedNode,
  onSelectNode,
  bottomTab,
  setBottomTab,
  drawerOpen,
  setDrawerOpen,
  panelOpen,
  setPanelOpen,
  zoom,
  setZoom,
  onFit,
  scriptVersion,
  onScriptChange,
  savedScriptVersion,
  saving,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onTrial,
  onFormalRun,
  scenario,
  onContinue,
  onStop,
}) {
  const dirty = scriptVersion !== savedScriptVersion;
  return (
    <div className={`workbench theme-${directionKey} ${compact ? "compact" : ""} ${drawerOpen ? "" : "drawer-closed"} ${panelOpen ? "" : "panel-closed"}`}>
      <GlobalRail compact={compact} />
      <ResourceNav compact={compact} />
      <main className="product-main">
        <ProductToolbar
          compact={compact}
          selectedNode={selectedNode}
          dirty={dirty}
          saving={saving}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onSave={onSave}
          onTrial={onTrial}
          onFormalRun={onFormalRun}
          scenario={scenario}
        />
        <div className="pipeline-shell">
          <NodeLibrary compact={compact} />
          <Canvas compact={compact} selectedNode={selectedNode} onSelectNode={onSelectNode} zoom={zoom} setZoom={setZoom} scenario={scenario} onFit={onFit} />
          <Inspector compact={compact} selectedNode={selectedNode} onClose={() => setDrawerOpen(false)} scriptVersion={scriptVersion} onScriptChange={onScriptChange} scenario={scenario} />
          <BottomPanel compact={compact} selectedNode={selectedNode} bottomTab={bottomTab} setBottomTab={setBottomTab} panelOpen={panelOpen} setPanelOpen={setPanelOpen} scenario={scenario} onContinue={onContinue} onStop={onStop} />
        </div>
      </main>
      {!drawerOpen ? (
        <button type="button" className="drawer-reopen tool-btn" onClick={() => setDrawerOpen(true)} title="打开配置检查器">
          <Icon name="PanelRightOpen" size={compact ? 8 : 13} /><span className={compact ? "sr-only" : ""}>检查器</span>
        </button>
      ) : null}
    </div>
  );
}

function Modal({ modal, setModal, reason, setReason, onConfirmContinue, onConfirmStop, onConfirmTrial, selectedNode }) {
  if (!modal) return null;
  const close = () => setModal(null);
  const selectedName = NODES.find((node) => node.key === selectedNode)?.name;

  if (modal === "info") {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="info-title">
          <header className="modal-header"><h2 className="modal-title" id="info-title"><Icon name="Info" size={17} />如何评审这三套方向</h2><button type="button" className="icon-btn" onClick={close} aria-label="关闭"><Icon name="X" size={14} /></button></header>
          <div className="modal-body">
            <p className="modal-note">这是视觉方向确认页。页面中的运行、质量与发布状态用于评审交互，不代表后端已经实现，也不构成 CR006 / CR007 的平台裁决。</p>
            <div className="decision-box">
              <div className="decision-col"><strong>A · 延续</strong><span>最接近旧项目，迁移认知成本最低。</span></div>
              <div className="decision-col"><strong>B · 作业</strong><span>诊断与证据最突出，适合高频数据作业。</span></div>
              <div className="decision-col"><strong>C · 现代</strong><span>空间层级更轻，玻璃只用于工作台外壳。</span></div>
            </div>
            <p>三套都使用同一个 D5 场景：数据源和 Python 已执行成功，数据检查执行成功但质量有 3 项警告，发布等待人工确认，本体刷新尚未执行。</p>
            <p>建议先在“并排比较”观察密度、导航和状态表达，再点“聚焦”实际选择节点、切换页签、开合面板和缩放画布。</p>
          </div>
          <footer className="modal-actions"><button type="button" className="primary-btn" onClick={close}>知道了</button></footer>
        </section>
      </div>
    );
  }

  if (modal === "shortcuts") {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
          <header className="modal-header"><h2 className="modal-title" id="shortcut-title"><Icon name="Keyboard" size={17} />画布快捷键</h2><button type="button" className="icon-btn" onClick={close} aria-label="关闭"><Icon name="X" size={14} /></button></header>
          <div className="modal-body">
            <div className="shortcut-list">
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>⌘ / Ctrl</kbd><kbd>Z</kbd></span><span>撤销最近一次配置调整</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>⌘ / Ctrl</kbd><kbd>S</kbd></span><span>保存当前管道配置</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>F</kbd></span><span>适应窗口并保留当前选中节点</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>+</kbd><kbd>−</kbd></span><span>放大或缩小画布</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>Esc</kbd></span><span>关闭当前弹层；没有弹层时关闭配置抽屉</span></div>
            </div>
            <p style={{ marginTop: 10 }}>输入框或下拉框获得焦点时，不触发画布快捷键。</p>
          </div>
          <footer className="modal-actions"><button type="button" className="primary-btn" onClick={close}>关闭</button></footer>
        </section>
      </div>
    );
  }

  if (modal === "continue") {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="continue-title">
          <header className="modal-header"><h2 className="modal-title" id="continue-title"><Icon name="TriangleAlert" size={17} />确认警告并继续发布</h2><button type="button" className="icon-btn" onClick={close} aria-label="关闭"><Icon name="X" size={14} /></button></header>
          <div className="modal-body">
            <p className="modal-note">3 项警告涉及可选字段缺失；硬阻断为 0。继续操作会登记理由，再让发布节点处理本次候选，不会把“有警告”改写成“质量通过”。</p>
            <label htmlFor="continue-reason"><strong>继续理由</strong></label>
            <textarea id="continue-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例如：已核对缺失字段不影响一期融资余额、主体和机构关系演示。"></textarea>
          </div>
          <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>返回检查结果</button><button type="button" className="primary-btn" onClick={onConfirmContinue} disabled={!reason.trim()}>登记理由并继续</button></footer>
        </section>
      </div>
    );
  }

  if (modal === "stop") {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="stop-title">
          <header className="modal-header"><h2 className="modal-title" id="stop-title"><Icon name="CircleStop" size={17} />本次不继续发布</h2><button type="button" className="icon-btn" onClick={close} aria-label="关闭"><Icon name="X" size={14} /></button></header>
          <div className="modal-body"><p>本次运行将以“已结束·未发布”收口，不生成新 T007，也不发起本体刷新。上一可信版本继续服务，运行和警告证据仍会保留。</p><p className="modal-note">这是原型场景切换，可通过顶部“恢复代表场景”返回等待确认状态。</p></div>
          <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>返回</button><button type="button" className="danger-btn" onClick={onConfirmStop}>确认本次结束</button></footer>
        </section>
      </div>
    );
  }

  if (modal === "trial") {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="trial-title">
          <header className="modal-header"><h2 className="modal-title" id="trial-title"><Icon name="Play" size={17} />试运行至：{selectedName}</h2><button type="button" className="icon-btn" onClick={close} aria-label="关闭"><Icon name="X" size={14} /></button></header>
          <div className="modal-body"><p>试运行使用当前已保存配置和有限样例，不发布 T007、不请求本体刷新，也不会覆盖当前正式运行证据。</p><p className="modal-note">本页只模拟可见交互，用于评审操作反馈与信息层级。</p></div>
          <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>取消</button><button type="button" className="primary-btn" onClick={onConfirmTrial}>开始试运行</button></footer>
        </section>
      </div>
    );
  }

  return null;
}

function App() {
  const [viewMode, setViewMode] = useState("compare");
  const [direction, setDirection] = useState("b");
  const [selectedNode, setSelectedNode] = useState("quality");
  const [bottomTab, setBottomTab] = useState("quality");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [scriptVersion, setScriptVersion] = useState("融资标准化模块 v1.0.0");
  const [savedScriptVersion, setSavedScriptVersion] = useState("融资标准化模块 v1.0.0");
  const [redoVersion, setRedoVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scenario, setScenario] = useState("warning");
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const dirty = scriptVersion !== savedScriptVersion;

  const showToast = (message, kind = "success") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const selectNode = (nodeKey) => {
    setSelectedNode(nodeKey);
    setDrawerOpen(true);
    if (bottomTab === "quality" && nodeKey !== "quality") setBottomTab("run");
    if (nodeKey === "quality" && bottomTab !== "preview") setBottomTab("quality");
  };

  const focusDirection = (directionKey) => {
    setDirection(directionKey);
    setViewMode("focus");
    showToast(`已聚焦方案 ${DIRECTIONS[directionKey].letter}：${DIRECTIONS[directionKey].name}`);
  };

  const changeScript = (value) => {
    setScriptVersion(value);
    setRedoVersion(null);
  };

  const undo = () => {
    if (!dirty) return;
    setRedoVersion(scriptVersion);
    setScriptVersion(savedScriptVersion);
    showToast("已撤销最近一次脚本组件调整");
  };

  const redo = () => {
    if (!redoVersion) return;
    setScriptVersion(redoVersion);
    setRedoVersion(null);
    showToast("已重做脚本组件调整");
  };

  const save = () => {
    if (!dirty || saving) return;
    setSaving(true);
    window.setTimeout(() => {
      setSavedScriptVersion(scriptVersion);
      setSaving(false);
      setRedoVersion(null);
      showToast("管道配置已保存");
    }, 520);
  };

  const fitCanvas = () => {
    setZoom(100);
    showToast("画布已适应窗口，选中节点保持不变");
  };

  const resetScenario = () => {
    setScenario("warning");
    setSelectedNode("quality");
    setBottomTab("quality");
    setDrawerOpen(true);
    setPanelOpen(true);
    setZoom(100);
    setReason("");
    setModal(null);
    showToast("已恢复代表场景：质量有警告，等待人工确认");
  };

  const confirmContinue = () => {
    if (!reason.trim()) return;
    setScenario("continued");
    setModal(null);
    setSelectedNode("publish");
    setBottomTab("run");
    showToast("继续理由已登记；发布节点准备继续", "warning");
  };

  const confirmStop = () => {
    setScenario("stopped");
    setModal(null);
    setSelectedNode("publish");
    setBottomTab("run");
    showToast("本次运行已结束；上一可信版本继续服务", "warning");
  };

  const confirmTrial = () => {
    setModal(null);
    showToast(`正在试运行至：${NODES.find((node) => node.key === selectedNode)?.name}`);
    window.setTimeout(() => {
      setScenario((current) => current === "warning" ? "trialdone" : current);
      showToast("试运行完成；正式质量结论未改变");
    }, 850);
  };

  const startFormalRun = () => {
    setScenario("warning");
    setSelectedNode("quality");
    setBottomTab("quality");
    setDrawerOpen(true);
    setPanelOpen(true);
    showToast("已创建新的正式运行模拟；流程再次到达质量门", "warning");
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (event.key === "Escape") {
        if (modal) {
          setModal(null);
        } else if (drawerOpen) {
          setDrawerOpen(false);
          showToast("配置抽屉已关闭");
        }
        return;
      }
      if (editing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty) save();
        else showToast("当前配置已保存");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (dirty) undo();
        else showToast("当前没有可撤销操作", "warning");
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        fitCanvas();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => Math.min(130, value + 10));
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((value) => Math.max(70, value - 10));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, drawerOpen, dirty, scriptVersion, savedScriptVersion]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const sharedProps = useMemo(() => ({
    selectedNode,
    onSelectNode: selectNode,
    bottomTab,
    setBottomTab,
    drawerOpen,
    setDrawerOpen,
    panelOpen,
    setPanelOpen,
    zoom,
    setZoom,
    onFit: fitCanvas,
    scriptVersion,
    onScriptChange: changeScript,
    savedScriptVersion,
    saving,
    canRedo: Boolean(redoVersion),
    onUndo: undo,
    onRedo: redo,
    onSave: save,
    onTrial: () => setModal("trial"),
    onFormalRun: startFormalRun,
    scenario,
    onContinue: () => setModal("continue"),
    onStop: () => setModal("stop"),
  }), [selectedNode, bottomTab, drawerOpen, panelOpen, zoom, scriptVersion, savedScriptVersion, saving, redoVersion, scenario]);

  return (
    <div className="review-app" data-screen-label="数据工程视觉方向评审总览">
      <ReviewTopbar viewMode={viewMode} setViewMode={setViewMode} onInfo={() => setModal("info")} onShortcuts={() => setModal("shortcuts")} />
      <ReviewStrip direction={direction} setDirection={setDirection} scenario={scenario} onReset={resetScenario} />
      <main className="review-main">
        {viewMode === "compare" ? (
          <section className="compare-stage" aria-label="三套视觉方向并排比较">
            {Object.keys(DIRECTIONS).map((key) => <DirectionCard key={key} directionKey={key} selected={direction === key} onFocus={focusDirection} sharedProps={sharedProps} />)}
          </section>
        ) : (
          <section className="focus-stage" data-screen-label={`聚焦方案 ${DIRECTIONS[direction].letter}：${DIRECTIONS[direction].name}`}>
            <div className="focus-frame"><Workbench directionKey={direction} compact={false} {...sharedProps} /></div>
          </section>
        )}
      </main>
      <Modal modal={modal} setModal={setModal} reason={reason} setReason={setReason} onConfirmContinue={confirmContinue} onConfirmStop={confirmStop} onConfirmTrial={confirmTrial} selectedNode={selectedNode} />
      {toast ? <div className={`toast ${toast.kind}`} role="status"><Icon name={toast.kind === "warning" ? "TriangleAlert" : "CircleCheck"} size={16} />{toast.message}</div> : null}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
