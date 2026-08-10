const {
  useState: useSourceScreenState,
  useEffect: useSourceScreenEffect,
  useMemo: useSourceScreenMemo,
} = React;

function sourceScreenTone(value) {
  if (["可用", "可运行", "通过", "已登记", "处理成功", "处理成功·消费就绪", "消费就绪", "已保存", "成功", "已结束"].includes(value)) return "success";
  if (["有警告", "等待确认", "等待质量确认", "暂停", "排队", "等待文件就绪", "未发布"].includes(value)) return "warning";
  if (["失败", "处理失败", "读取失败", "不兼容", "校验失败", "处理成功·刷新失败", "已发布·刷新失败"].includes(value)) return "failed";
  if (["运行中", "检查中", "处理中"].includes(value)) return "running";
  return "neutral";
}

function sourceScreenGo(onNavigate, screen, payload) {
  if (typeof onNavigate === "function") onNavigate(screen, payload || {});
}

function sourceScreenToast(onToast, message, tone = "info") {
  if (typeof onToast === "function") onToast(message, tone);
}

const SOURCE_SCREEN_FOLDER_PATH = "/Users/domi/Public/Vibecoding/ontology3.0/demo_shared/融资数据待处理/";

function sourceScreenExtractT008(sampleName) {
  const match = /^融资一览表_(\d{4})(\d{2})(\d{2})\.xlsx$/.exec(sampleName.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function sourceScreenTaskDestination(scenario) {
  if (scenario.key === "D") return { screen: "asset-detail", payload: { tab: "refresh", versionId: scenario.assetVersion } };
  if (scenario.key === "C") return { screen: "run-detail", payload: { runId: scenario.run, tab: "nodes" } };
  return { screen: "canvas", payload: { runId: scenario.run, focusNode: "quality", bottomTab: "quality" } };
}

function sourceScreenLifecycleState(scenario, flowState = {}) {
  const aReady = scenario.key === "A" && Boolean(flowState.refreshed || flowState.priorAReady || flowState.resolvedReady);
  const ready = scenario.key === "B" || aReady;
  if (ready) {
    return {
      ready: true,
      execution: "已结束",
      closure: "消费就绪",
      process: "处理成功·消费就绪",
      consumption: `${scenario.assetVersion.replace("ASSET-FINANCE@", "")} 正在服务`,
      lastPublished: scenario.key === "B" ? "2026-08-09 10:08" : "2026-08-09 10:02",
      taskType: "消费就绪",
      taskTitle: "可信资产版本已刷新并被权威消费绑定采用",
      taskImpact: `${scenario.assetVersion} 已形成 T018，且 T019 已正式采用；智能问数可使用这一可信版本`,
      taskAction: "查看消费证据",
      tone: "success",
    };
  }
  if (scenario.key === "C") {
    return {
      ready: false,
      execution: "失败",
      closure: "未发布",
      process: "处理失败",
      consumption: "2026-07-31 · r1 继续服务",
      lastPublished: "未发布",
      taskType: "数据质量硬阻断",
      taskTitle: scenario.taskTitle,
      taskImpact: scenario.taskImpact,
      taskAction: scenario.taskAction,
      tone: "failed",
    };
  }
  if (scenario.key === "D") {
    return {
      ready: false,
      execution: "已结束",
      closure: "已发布·刷新失败",
      process: "处理成功·刷新失败",
      consumption: "2026-08-08 · r2 继续服务",
      lastPublished: "2026-08-09 10:22 · 刷新失败",
      taskType: "本体刷新不兼容",
      taskTitle: scenario.taskTitle,
      taskImpact: scenario.taskImpact,
      taskAction: scenario.taskAction,
      tone: "failed",
    };
  }
  return {
    ready: false,
    execution: "等待确认",
    closure: "未发布",
    process: "等待质量确认",
    consumption: "2026-06-30 · r0 继续服务",
    lastPublished: "等待质量确认",
    taskType: "数据质量警告",
    taskTitle: scenario.taskTitle,
    taskImpact: scenario.taskImpact,
    taskAction: scenario.taskAction,
    tone: "warning",
  };
}

function sourceScreenCurrentSnapshot(scenario, flowState = {}) {
  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const fixture = prototypeSnapshotFixture(scenario.key);
  const registered = flowState.registeredSnapshot;
  if (registered && registered.id === scenario.snapshot) {
    return {
      ...registered,
      t008: registered.t008 || flowState.registeredT008 || scenario.t008,
      status: registered.status || "已登记",
      process: lifecycle.process,
    };
  }
  return {
    id: scenario.snapshot,
    t008: flowState.registeredT008 || scenario.t008,
    file: fixture.file,
    fingerprint: fixture.fingerprint,
    status: "已登记",
    process: lifecycle.process,
    discoveredAt: fixture.discoveredAt,
    readAt: fixture.readAt,
  };
}

function SourceOverviewScreen({ scenario = PROTOTYPE_SCENARIOS.A, flowState = {}, sourceResources = [], onNavigate, onToast }) {
  const [taskOpen, setTaskOpen] = useSourceScreenState(false);
  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const currentSnapshot = sourceScreenCurrentSnapshot(scenario, flowState);
  const currentT008 = currentSnapshot.t008;
  const journeyReady = lifecycle.ready;
  const destination = journeyReady ? { screen: "asset-detail", payload: { versionId: scenario.assetVersion, initialView: "refresh" } } : sourceScreenTaskDestination(scenario);
  const taskType = lifecycle.taskType;
  const taskTime = journeyReady
    ? scenario.key === "A" ? "2026-08-09 10:05" : "2026-08-09 10:10"
    : scenario.key === "A" ? "2026-08-09 10:01" : scenario.key === "B" ? "2026-08-09 10:07" : scenario.key === "C" ? "2026-08-09 10:13" : "2026-08-09 10:24";
  const displayTitle = lifecycle.taskTitle;
  const displayImpact = lifecycle.taskImpact;
  const displayAction = lifecycle.taskAction;
  const displayExecution = lifecycle.execution;
  const displayClosure = lifecycle.closure;
  const displayConsumption = lifecycle.consumption;
  const displayTone = lifecycle.tone;
  const sourceCount = PROTOTYPE_SOURCE_ROWS.length + sourceResources.length;
  const manualSourceCount = PROTOTYPE_SOURCE_ROWS.filter((row) => row.type === "手工上传").length + sourceResources.filter((row) => row.type === "手工上传").length;
  const folderSourceCount = PROTOTYPE_SOURCE_ROWS.filter((row) => row.type === "共享文件夹").length + sourceResources.filter((row) => row.type === "共享文件夹").length;

  const openDestination = () => {
    setTaskOpen(false);
    sourceScreenGo(onNavigate, destination.screen, destination.payload);
  };

  return (
    <main className="screen-page source-overview-screen" data-screen-label="D1 数据工程总览">
      <PrototypePageHeader
        kicker="D1 · DATA ENGINEERING"
        title="数据工程总览"
        description="先处理会阻断可信数据更新的事项，再进入来源、管道或资产证据。执行状态与闭环结果分别展示。"
        actions={(
          <>
            <PrototypeButton icon="Upload" variant="primary" onClick={() => sourceScreenGo(onNavigate, "source-manual", { openUpload: true, journey: "upload" })}>上传工作簿</PrototypeButton>
            <PrototypeButton icon="ArrowRight" onClick={() => setTaskOpen(true)}>{journeyReady ? "查看闭环结果" : "继续处理待办"}</PrototypeButton>
          </>
        )}
      />

      <PrototypeAlert
        tone={displayTone}
        title={displayTitle}
        actions={<PrototypeButton size="sm" variant={journeyReady ? "secondary" : scenario.color === "failed" ? "danger" : "warning"} onClick={() => setTaskOpen(true)}>{journeyReady ? "查看完整证据" : "查看原因与恢复"}</PrototypeButton>}
      >
        {displayImpact}。当前结果不会改写已有快照、运行证据或历史可信版本。
      </PrototypeAlert>

      <div className="overview-metric-spacing">
        <PrototypeMetricStrip items={[
          { label: "S001 真实来源", value: String(sourceCount), detail: `手工上传 ${manualSourceCount} · 共享文件夹 ${folderSourceCount}`, icon: "FolderInput" },
          { label: "可运行管道", value: "1", detail: "五节点单链 · PIPE-FIN-STD-v1.0", icon: "Workflow", tone: "success" },
          { label: "逻辑数据资产", value: "1", detail: "融资标准化数据资产 · 不可变版本", icon: "Package" },
          { label: journeyReady ? "本次闭环" : "待处理事项", value: journeyReady ? "已完成" : "1", detail: taskType, icon: journeyReady ? "CircleCheck" : "TriangleAlert", tone: displayTone },
        ]} />
      </div>

      <div className="two-column-layout overview-workbench-grid">
        <section className="p-section overview-task-section">
          <PrototypeSectionHeader title={journeyReady ? "最近完成" : "待处理事项"} count={1} description={journeyReady ? "按精确运行、版本和权威采用证据展示最近完成的闭环。" : "按失败、等待确认、结果未知的优先级排列；这里不提供绕过质量门的发布或刷新快捷操作。"} />
          <div className="p-section-body">
            <button type="button" className={`overview-task-card ${displayTone}`} onClick={() => setTaskOpen(true)}>
              <span className="overview-task-icon"><PrototypeIcon name={journeyReady ? "CircleCheck" : scenario.color === "failed" ? "CircleX" : "TriangleAlert"} size={19} /></span>
              <span className="overview-task-copy">
                <span className="overview-task-topline"><PrototypeStatus tone={displayTone} compact>{taskType}</PrototypeStatus><small>{taskTime}</small></span>
                <strong>{displayTitle}</strong>
                <span>{displayImpact}</span>
                <span className="overview-task-resource mono">{scenario.run} · T008 {currentT008}</span>
              </span>
              <span className="overview-task-action">{displayAction}<PrototypeIcon name="ChevronRight" size={15} /></span>
            </button>
          </div>
        </section>

        <section className="p-section overview-state-section">
          <PrototypeSectionHeader title="当前闭环摘要" description="同一候选同时保留执行与闭环两类状态。" />
          <div className="p-section-body">
            <div className="evidence-list compact-evidence-list">
              <div className="evidence-row"><strong>候选数据截至时间</strong><div className="evidence-row-copy"><strong>{currentT008}</strong><span>来自明确的快照业务时点，不使用发现时间代替</span></div><PrototypeStatus tone="info">T008</PrototypeStatus></div>
              <div className="evidence-row"><strong>运行状态</strong><div className="evidence-row-copy"><strong>{displayExecution}</strong><span className="mono">{scenario.run}</span></div><PrototypeStatus tone={sourceScreenTone(displayExecution)}>{displayExecution}</PrototypeStatus></div>
              <div className="evidence-row"><strong>闭环结果</strong><div className="evidence-row-copy"><strong>{displayClosure}</strong><span>发布、刷新与消费就绪不会合并成一个“成功”</span></div><PrototypeStatus tone={sourceScreenTone(displayClosure)}>{displayClosure}</PrototypeStatus></div>
              <div className="evidence-row"><strong>当前服务</strong><div className="evidence-row-copy"><strong>{displayConsumption}</strong><span>失败候选不污染已采用的权威消费组合</span></div><PrototypeIcon name="ShieldCheck" size={17} /></div>
            </div>
          </div>
        </section>
      </div>

      <section className="p-section overview-resource-section">
        <PrototypeSectionHeader title="进入工作区" description="按资源类型继续工作；所有入口都保留当前评审场景。" />
        <div className="p-section-body overview-resource-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {[
            { screen: "sources", icon: "FolderInput", title: "数据源", count: `S001 ${sourceCount} 个真实来源`, copy: "管理手工上传与指定共享文件夹，并查看 S003 工作簿兼容性证据。" },
            { screen: "pipelines", icon: "Workflow", title: "数据管道", count: "1 条可运行管道", copy: "打开五节点画布，配置、调试、试运行和正式运行。" },
            { screen: "runs", icon: "History", title: "运行历史", count: `${displayExecution} · 1 个候选`, copy: "按运行查看节点、质量、发布和刷新证据。" },
            { screen: "assets", icon: "Package", title: "数据资产", count: "1 个已接入资产", copy: "查看不可变版本、四成员三关系与消费状态。" },
          ].map((item) => (
            <button type="button" key={item.screen} className="overview-resource-card" onClick={() => sourceScreenGo(onNavigate, item.screen)}>
              <span><PrototypeIcon name={item.icon} size={19} /></span>
              <span className="overview-resource-copy"><strong>{item.title}</strong><small>{item.count} · {item.copy}</small></span>
              <span className="overview-task-action">打开目录 <PrototypeIcon name="ArrowRight" size={13} /></span>
            </button>
          ))}
        </div>
      </section>

      <PrototypeModal
        open={taskOpen}
        title={journeyReady ? "最近完成闭环证据" : "待处理事项明细"}
        icon={journeyReady ? "CircleCheck" : scenario.color === "failed" ? "CircleX" : "TriangleAlert"}
        onClose={() => setTaskOpen(false)}
        width="650px"
        footer={(
          <>
            <PrototypeButton onClick={() => setTaskOpen(false)}>返回总览</PrototypeButton>
            <PrototypeButton variant="primary" icon="ArrowRight" onClick={openDestination}>{displayAction}</PrototypeButton>
          </>
        )}
      >
        <PrototypeAlert tone={displayTone} title={displayTitle}>{displayImpact}</PrototypeAlert>
        <div className="modal-section-gap">
          <PrototypeKeyValues columns={2} items={[
            { label: "事项类型", value: taskType },
            { label: "发生时间", value: taskTime },
            { label: "关联运行", value: scenario.run, mono: true },
            { label: "数据截至时间", value: currentT008 },
            { label: "执行状态", value: displayExecution },
            { label: "闭环结果", value: displayClosure },
          ]} />
        </div>
        <section className="modal-copy-section">
          <h3>为什么需要处理</h3>
          <p>{journeyReady ? "正式质量警告已由演示账号确认，资产、刷新结果、T018 与 T019 采用证据均已形成。" : scenario.key === "C" ? "产业板块检查发现 1 条旧名称“新能源控股”。这是硬阻断项，不能忽略，也不会形成 T007。" : scenario.key === "D" ? "外部刷新结果指出候选成员字段与目标 Published v1.0.0 的既有来源映射不兼容，T019 未采用该候选。" : "三项可选字段存在缺失。系统保留缺失事实并等待人工确认业务影响，不会自动补值或自动继续发布。"}</p>
          <h3>建议动作</h3>
          <p>{journeyReady ? "打开资产的“刷新与消费”视图核对精确版本、对象关系数量、T018 和 T019。" : scenario.key === "C" ? "打开失败运行，查看有限失败样例；回到来源修复值后登记新快照并创建关联运行。" : scenario.key === "D" ? "打开资产的刷新与消费证据，核对不兼容字段；修正输出合同后形成新 T003、新运行和新 T007。" : "打开画布的数据检查节点，逐项查看影响数量；选择继续发布或本次结束且不发布。"}</p>
          <h3>服务影响</h3>
          <p>{journeyReady ? "T019 已原子采用当前精确组合；下游通过本体消费，不直接读取工作簿或四成员明细。" : scenario.key === "D" ? "T019 未采用 r3；上一可信 ASSET-FINANCE@2026.08.08-r2 继续服务，消费者不中断。" : scenario.key === "C" ? "本次未形成 T007；上一可信 ASSET-FINANCE@2026.07.31-r1 继续服务。" : "上一可信 ASSET-FINANCE@2026.06.30-r0 继续服务；确认警告前不显示“消费就绪”。"}</p>
        </section>
      </PrototypeModal>
    </main>
  );
}

function SourceDirectoryScreen({ scenario = PROTOTYPE_SCENARIOS.A, flowState = {}, sourceResources = [], onNavigate, onToast, onSourceResourceChange }) {
  const [search, setSearch] = useSourceScreenState("");
  const [typeFilter, setTypeFilter] = useSourceScreenState("全部类型");
  const [statusFilter, setStatusFilter] = useSourceScreenState("全部状态");
  const [createType, setCreateType] = useSourceScreenState("");
  const [name, setName] = useSourceScreenState("");
  const [description, setDescription] = useSourceScreenState("");
  const [nameError, setNameError] = useSourceScreenState("");

  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const currentSnapshot = sourceScreenCurrentSnapshot(scenario, flowState);
  const sourceRows = useSourceScreenMemo(() => {
    const activeSourceId = scenario.key === "C" ? "SRC-FIN-FOLDER-001" : "SRC-FIN-UPLOAD-001";
    const derivedRows = PROTOTYPE_SOURCE_ROWS.map((row) => row.id === activeSourceId ? {
      ...row,
      lastCheck: row.type === "共享文件夹" ? currentSnapshot.discoveredAt : row.lastCheck,
      lastDiscovered: currentSnapshot.discoveredAt,
      lastRead: currentSnapshot.readAt,
      lastPublished: lifecycle.lastPublished,
      consumption: lifecycle.consumption,
    } : row);
    return [...derivedRows, ...sourceResources];
  }, [sourceResources, scenario.key, currentSnapshot.discoveredAt, currentSnapshot.readAt, lifecycle.lastPublished, lifecycle.consumption]);
  const filteredRows = useSourceScreenMemo(() => sourceRows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || `${row.name} ${row.description} ${row.id}`.toLowerCase().includes(query);
    const matchesType = typeFilter === "全部类型" || row.type === typeFilter;
    const matchesStatus = statusFilter === "全部状态" || row.status === statusFilter;
    return matchesQuery && matchesType && matchesStatus;
  }), [sourceRows, search, typeFilter, statusFilter]);
  const s003Matches = useSourceScreenMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || `${PROTOTYPE_S003_SOURCE.name} ${PROTOTYPE_S003_SOURCE.workbook} ${PROTOTYPE_S003_SOURCE.scenario} ${PROTOTYPE_S003_SOURCE.sourceType}`.toLowerCase().includes(query);
    const matchesType = typeFilter === "全部类型" || typeFilter === "手工上传";
    const matchesStatus = statusFilter === "全部状态" || statusFilter === "兼容性验证";
    return matchesQuery && matchesType && matchesStatus;
  }, [search, typeFilter, statusFilter]);
  const catalogTotal = sourceRows.length + 1;
  const visibleCatalogTotal = filteredRows.length + (s003Matches ? 1 : 0);

  const beginCreate = (type) => {
    setCreateType(type);
    setName("");
    setDescription(type === "手工上传" ? "补充说明该上传入口负责的数据范围" : "补充说明该固定目录负责的数据范围");
    setNameError("");
  };

  const closeCreate = () => {
    setCreateType("");
    setNameError("");
  };

  const createSource = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("请输入来源名称");
      return;
    }
    const duplicate = sourceRows.some((row) => row.name === trimmed);
    if (duplicate) {
      setNameError("名称已被现有来源使用，请换一个名称");
      return;
    }
    const target = createType === "手工上传" ? "source-manual" : "source-folder";
    const sourceSequence = sourceResources.filter((row) => row.type === createType).length + 1;
    const sourceId = `SRC-FIN-${createType === "手工上传" ? "UPLOAD" : "FOLDER"}-N${String(sourceSequence).padStart(3, "0")}`;
    const sourceDescription = description.trim();
    const resource = {
      id: sourceId,
      sourceId,
      name: trimmed,
      description: sourceDescription,
      type: createType,
      status: "未配置",
      lastCheck: "—",
      lastDiscovered: "—",
      lastRead: "—",
      lastPublished: "未发布",
      consumption: "未就绪",
      error: "无",
      pipeline: "融资数据标准化与发布",
      target,
      created: true,
      sourceName: trimmed,
      sourceDescription,
      sourceConfigured: false,
      hasSnapshot: false,
      hasCompletedCheck: false,
    };
    if (typeof onSourceResourceChange === "function") onSourceResourceChange(resource);
    closeCreate();
    sourceScreenToast(onToast, `${createType}来源已在原型中创建，继续完成来源配置`, "success");
    sourceScreenGo(onNavigate, target, resource);
  };

  const columns = [
    { key: "name", label: "来源", width: "19%", render: (row) => <div className="p-primary-cell"><strong>{row.name}</strong><small className="mono">{row.id}</small></div> },
    { key: "type", label: "类型", width: "9%" },
    { key: "status", label: "状态", width: "8%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.status)}>{row.status}</PrototypeStatus> },
    { key: "lastCheck", label: "最近检查", width: "10%" },
    { key: "lastDiscovered", label: "最近发现", width: "11%" },
    { key: "lastRead", label: "最近读取", width: "11%" },
    { key: "lastPublished", label: "最近发布", width: "10%" },
    { key: "consumption", label: "消费就绪", width: "11%" },
    { key: "error", label: "最近错误", width: "8%", render: (row) => row.error === "无" ? <span className="muted-table-value">无</span> : <PrototypeStatus compact tone="failed">{row.error}</PrototypeStatus> },
    { key: "open", label: "", width: "3%", render: () => <PrototypeIcon name="ChevronRight" size={14} /> },
  ];

  return (
    <main className="screen-page source-directory-screen" data-screen-label="D2 数据源目录">
      <PrototypePageHeader
        kicker="D2 · T001 DIRECTORY"
        title="数据源目录"
        description="S001 提供手工上传与指定共享文件夹的真实入口；S003 仅嵌入已核验工作簿的兼容性状态与结构，不提供运行或发布捷径。"
        actions={(
          <>
            <PrototypeButton icon="Upload" variant="primary" onClick={() => beginCreate("手工上传")}>新建手工上传来源</PrototypeButton>
            <PrototypeButton icon="FolderPlus" onClick={() => beginCreate("共享文件夹")}>新建共享文件夹来源</PrototypeButton>
          </>
        )}
      />

      <PrototypeMetricStrip items={[
        { label: "目录项目", value: String(catalogTotal), detail: "S001 真实来源 + S003 兼容性来源", icon: "Database" },
        { label: "手工文件来源", value: String(sourceRows.filter((row) => row.type === "手工上传").length + 1), detail: "S003 当前仅查看核验状态", icon: "Upload", tone: "success" },
        { label: "共享文件夹", value: String(sourceRows.filter((row) => row.type === "共享文件夹").length), detail: "无定时计划 · 可立即检查", icon: "FolderInput", tone: "warning" },
        { label: "当前不可消费", value: "1", detail: "S003 · 尚未形成真实运行证据", icon: "CircleDashed" },
      ]} />

      <section className="p-section source-directory-table-section">
        <div className="p-toolbar">
          <div className="p-toolbar-group">
            <PrototypeSearch value={search} onChange={setSearch} placeholder="搜索来源名称、说明或标识" ariaLabel="搜索数据源" />
            <PrototypeSelect value={typeFilter} onChange={setTypeFilter} options={["全部类型", "手工上传", "共享文件夹"]} />
            <PrototypeSelect value={statusFilter} onChange={setStatusFilter} options={["全部状态", "可用", "暂停", "读取失败", "未配置", "兼容性验证"]} />
          </div>
          <span className="toolbar-result-count">显示 {visibleCatalogTotal} / {catalogTotal} 个目录项目</span>
        </div>
        {s003Matches ? (
          <article className="s003-source-catalog-card" aria-label="S003 数据源兼容性验证摘要">
            <div className="s003-catalog-heading">
              <span className="s003-catalog-icon"><PrototypeIcon name="FileSpreadsheet" size={20} /></span>
              <div>
                <span className="s003-catalog-eyebrow">{PROTOTYPE_S003_SOURCE.scenario} · {PROTOTYPE_S003_SOURCE.sourceType}</span>
                <h2>{PROTOTYPE_S003_SOURCE.name}</h2>
                <p>当前只展示真实文件核验事实和待运行证据，不代表已登记、已发布或已接入场景。</p>
              </div>
              <PrototypeStatus tone="neutral">{PROTOTYPE_S003_SOURCE.consumption}</PrototypeStatus>
            </div>
            <div className="s003-catalog-facts">
              <div><span>C021 权威阶段</span><strong>{PROTOTYPE_S003_SOURCE.authoritativeStage}</strong><small>平台总控已登记</small></div>
              <div><span>数据工程内部结果</span><strong>{PROTOTYPE_S003_SOURCE.internalResult}</strong><small>细化结论，不改写 C021</small></div>
              <div><span>结构与时点</span><strong>{PROTOTYPE_S003_SOURCE.memberCount} 个逻辑成员 · {PROTOTYPE_S003_SOURCE.t008}</strong><small>T008 为外部已确认元数据</small></div>
              <div><span>最近核验</span><strong>{PROTOTYPE_S003_SOURCE.verification}</strong><small>尚无正式 T005 或 T007</small></div>
            </div>
            <div className="s003-catalog-footer">
              <span><PrototypeIcon name="LockKeyhole" size={14} />本卡没有“运行管道、发布资产、请求本体刷新”入口</span>
              <PrototypeButton variant="secondary" icon="ArrowRight" onClick={() => sourceScreenGo(onNavigate, "source-s003")}>查看兼容性验证</PrototypeButton>
            </div>
          </article>
        ) : null}
        {filteredRows.length ? (
          <PrototypeTable
            columns={columns}
            rows={filteredRows}
            rowKey="id"
            onRowClick={(row) => sourceScreenGo(onNavigate, row.target, row.created ? { ...row, sourceId: row.id } : { sourceId: row.id })}
          />
        ) : s003Matches ? null : (
          <PrototypeEmpty icon="SearchX" title="没有符合条件的来源" description="当前筛选没有结果。清空搜索或恢复“全部类型 / 全部状态”后再试。" action={<PrototypeButton onClick={() => { setSearch(""); setTypeFilter("全部类型"); setStatusFilter("全部状态"); }}>清空筛选</PrototypeButton>} />
        )}
      </section>

      <PrototypeAlert title="目录边界" tone="info">
        SAP、司库和企业数据中台只会在数据资产目录以“规划中·未接入”的说明卡展示；本页没有连接、同步或试用入口，也不会把 T006/T007 当作来源。
      </PrototypeAlert>

      <PrototypeModal
        open={Boolean(createType)}
        title={`新建${createType || ""}来源`}
        icon={createType === "手工上传" ? "Upload" : "FolderPlus"}
        onClose={closeCreate}
        width="570px"
        footer={(
          <>
            <PrototypeButton onClick={closeCreate}>取消</PrototypeButton>
            <PrototypeButton variant="primary" icon="ArrowRight" onClick={createSource}>创建并继续</PrototypeButton>
          </>
        )}
      >
        <PrototypeAlert title="已选择来源类型">{createType || "—"}。创建后进入对应详情完成上传或文件夹配置；来源类型创建后不在这里切换。</PrototypeAlert>
        <div className="p-form-grid one modal-section-gap">
          <PrototypeField label="来源类型" value={createType} readOnly />
          <PrototypeField label="来源名称" value={name} onChange={(value) => { setName(value); setNameError(""); }} required error={nameError} placeholder="输入易识别的来源名称" />
          <PrototypeTextarea label="说明" value={description} onChange={setDescription} placeholder="说明这个来源提供什么数据、由谁触发" />
        </div>
        <p className="p-modal-copy modal-section-gap">一期不会在该流程中提供 SAP、司库、数据中台或任意数据库连接选项。</p>
      </PrototypeModal>
    </main>
  );
}

function S003CompatibilityScreen({ onNavigate }) {
  const [memberKey, setMemberKey] = useSourceScreenState(PROTOTYPE_S003_MEMBERS[0].key);
  const [qualityGroup, setQualityGroup] = useSourceScreenState("passed");
  const [expandedQuality, setExpandedQuality] = useSourceScreenState("");
  const [evidenceItem, setEvidenceItem] = useSourceScreenState(null);
  const [revisionOpen, setRevisionOpen] = useSourceScreenState(false);
  const member = PROTOTYPE_S003_MEMBERS.find((item) => item.key === memberKey) || PROTOTYPE_S003_MEMBERS[0];
  const qualityItems = PROTOTYPE_S003_QUALITY_ITEMS.filter((item) => item.group === qualityGroup);
  const pendingEvidence = PROTOTYPE_S003_QUALITY_ITEMS.filter((item) => item.group === "pending");

  const changeMember = (nextKey) => {
    setMemberKey(nextKey);
    setExpandedQuality("");
    setEvidenceItem(null);
  };

  const changeQualityGroup = (nextGroup) => {
    setQualityGroup(nextGroup);
    setExpandedQuality("");
    setEvidenceItem(null);
  };

  const openQuality = () => {
    const target = document.getElementById("s003-quality-detail");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="screen-page s003-compatibility-screen" data-screen-label="D2 · S003 数据工程兼容性验证">
      <PrototypePageHeader
        kicker="D051 · S003 COMPATIBILITY"
        title={PROTOTYPE_S003_SOURCE.name}
        description="沿数据源目录查看工作簿身份、双成员结构、文件核验事实和真实发布门；本页不提供 S003 管道、发布或刷新操作。"
        onBack={() => sourceScreenGo(onNavigate, "sources")}
        meta={(
          <>
            <span>{PROTOTYPE_S003_SOURCE.workbook}</span>
            <PrototypeStatus tone="neutral">{PROTOTYPE_S003_SOURCE.currentStatus}</PrototypeStatus>
            <PrototypeStatus tone="neutral">{PROTOTYPE_S003_SOURCE.consumption}</PrototypeStatus>
          </>
        )}
        actions={(
          <>
            <PrototypeButton icon="FileDiff" onClick={() => setRevisionOpen(true)}>查看修订证据</PrototypeButton>
            <PrototypeButton icon="ShieldCheck" variant="primary" onClick={openQuality}>查看质量详情</PrototypeButton>
          </>
        )}
      />

      <PrototypeAlert tone="warning" title="结构与内容已核验，但尚未形成可发布证据">
        当前已确认工作簿内容及双成员结构可由现有数据资产合同表达，CR018 已接受，I023 已重定向。尚未真实登记来源快照与人工输入快照、执行受控处理和正式质量门，也未形成成员稳定标识或双成员兼容性版本，因此不能标记兼容性验证通过，更不能刷新本体或供其他模块消费。
      </PrototypeAlert>

      <div className="s003-status-grid" aria-label="S003 四维状态说明">
        <article className="success"><span>合同结构兼容</span><strong><PrototypeIcon name="CircleCheck" size={15} />兼容</strong><small>现有版本合同可原子表达两个成员</small></article>
        <article className="success"><span>文件内容准备</span><strong><PrototypeIcon name="CircleCheck" size={15} />已确认</strong><small>0 个数据内容阻断</small></article>
        <article className="neutral"><span>受控发布验证</span><strong><PrototypeIcon name="CircleDashed" size={15} />尚未运行</strong><small>合同已获准，五类真实证据待生成</small></article>
        <article className="neutral"><span>当前消费状态</span><strong><PrototypeIcon name="LockKeyhole" size={15} />不可消费</strong><small>兼容性验证用途，不进入刷新与采用链</small></article>
      </div>

      <div className="two-column-layout s003-identity-layout">
        <section className="p-section">
          <PrototypeSectionHeader title="文件身份与修订说明" description="哈希用于定位当前校正夹具与修订前内容；这里不虚构 T001、T002 或 T053。" actions={<PrototypeButton size="sm" icon="FileDiff" onClick={() => setRevisionOpen(true)}>查看修订证据</PrototypeButton>} />
          <div className="p-section-body">
            <div className="s003-hash-list">
              <div><span>当前文件 SHA-256</span><code>{PROTOTYPE_S003_SOURCE.currentHash}</code></div>
              <div><span>修订前 SHA-256</span><code>{PROTOTYPE_S003_SOURCE.previousHash}</code></div>
            </div>
            <div className="s003-revision-note"><PrototypeIcon name="FileDiff" size={16} /><div><strong>唯一修订</strong><p>{PROTOTYPE_S003_SOURCE.revision}。</p></div></div>
          </div>
        </section>

        <section className="p-section">
          <PrototypeSectionHeader title="业务时点与计量元数据" description="以下三项由业务 Owner 在总控中确认，工作簿本身没有编码这些元数据。" />
          <div className="p-section-body">
            <PrototypeKeyValues columns={2} items={[
              { label: "数据截至时间 T008", value: PROTOTYPE_S003_SOURCE.t008 },
              { label: "币种", value: PROTOTYPE_S003_SOURCE.currency },
              { label: "金额单位", value: PROTOTYPE_S003_SOURCE.amountUnit },
              { label: "当前来源索引", value: PROTOTYPE_S003_SOURCE.sourceIdentity },
              { label: "真实登记状态", value: PROTOTYPE_S003_SOURCE.registration },
              { label: "场景范围", value: "仅 D051 兼容性验证" },
            ]} />
          </div>
        </section>
      </div>

      <section className="p-section s003-pending-section">
        <PrototypeSectionHeader title="发布门还缺什么" count={pendingEvidence.length} description="这些位置只展示待生成的证据类型，不显示占位编号、假运行结果或假版本。" />
        <div className="p-section-body s003-pending-grid">
          {pendingEvidence.map((item, index) => (
            <button type="button" className="s003-pending-card" key={item.key} onClick={() => setEvidenceItem(item)}>
              <span className="s003-pending-index">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{item.name}</strong><small>{item.result.replace("待运行生成 · ", "")}</small></span>
              <PrototypeIcon name="ChevronRight" size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="p-section s003-members-section">
        <PrototypeSectionHeader title="双成员结构" count={2} description="两个成员共同组成未来的原子版本；成员切换只改变当前结构上下文。双成员匹配是数据层完整性校验，不是本体 Link。" />
        <div className="p-section-body">
          <PrototypeTabs
            ariaLabel="切换 S003 逻辑成员"
            value={memberKey}
            onChange={changeMember}
            items={PROTOTYPE_S003_MEMBERS.map((item) => ({ value: item.key, label: item.name, icon: item.key === "financial" ? "Table2" : "ListChecks" }))}
          />
          <article className="s003-member-card" key={member.key}>
            <div className="s003-member-heading">
              <div><span>当前成员</span><h3>{member.name}</h3></div>
              <PrototypeStatus tone="neutral">稳定标识待真实生成</PrototypeStatus>
            </div>
            <PrototypeKeyValues columns={2} items={[
              { label: "来源范围", value: member.range },
              { label: "数据规模", value: member.size },
              { label: "业务粒度", value: member.grain },
              { label: "当前兼容键", value: member.compatibleKey },
              { label: "成员稳定标识", value: member.stableId },
              { label: "匹配性质", value: "数据层一对一完整性校验 · 非本体 Link" },
            ]} />
            <div className="s003-member-facts">
              {member.facts.map((fact) => <div key={fact}><PrototypeIcon name="Check" size={13} /><span>{fact}</span></div>)}
            </div>
          </article>
        </div>
      </section>

      <section className="p-section s003-quality-section" id="s003-quality-detail">
        <PrototypeSectionHeader title="质量证据" description="文件核验事实、模板优化、已收敛治理项和待运行证据分组展示；当前核验摘要不冒充正式 T005。" />
        <div className="p-section-body">
          <PrototypeTabs
            ariaLabel="切换质量证据分组"
            value={qualityGroup}
            onChange={changeQualityGroup}
            items={PROTOTYPE_S003_QUALITY_GROUPS.map((group) => ({
              value: group.key,
              label: group.label,
              icon: group.key === "passed" || group.key === "settled" ? "CircleCheck" : group.key === "optimization" ? "Lightbulb" : "Clock3",
              count: PROTOTYPE_S003_QUALITY_ITEMS.filter((item) => item.group === group.key).length,
            }))}
          />
          <div className="s003-quality-list" key={qualityGroup}>
            {qualityItems.map((item) => {
              const group = PROTOTYPE_S003_QUALITY_GROUPS.find((entry) => entry.key === item.group);
              const expanded = expandedQuality === item.key;
              return (
                <article className={`s003-quality-item ${expanded ? "expanded" : ""}`} key={item.key}>
                  <button type="button" className="s003-quality-summary" aria-expanded={expanded} onClick={() => setExpandedQuality(expanded ? "" : item.key)}>
                    <span className={`s003-quality-mark ${group.tone}`}><PrototypeIcon name={group.tone === "success" ? "CircleCheck" : "Clock3"} size={15} /></span>
                    <span><strong>{item.name}</strong><small>{item.result}</small></span>
                    <PrototypeIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={15} />
                  </button>
                  {expanded ? (
                    <div className="s003-quality-detail">
                      <dl>
                        <div><dt>影响</dt><dd>{item.impact}</dd></div>
                        <div><dt>恢复建议</dt><dd>{item.recovery}</dd></div>
                        <div><dt>责任方</dt><dd>{item.owner}</dd></div>
                      </dl>
                      <PrototypeButton size="sm" icon="FileSearch" onClick={() => setEvidenceItem(item)}>查看证据</PrototypeButton>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="p-section s003-next-owner-section">
        <PrototypeSectionHeader title="下一步与责任方" description="页面只说明恢复路径，不提供绕过正式接入和质量门的快捷操作。" />
        <div className="p-section-body s003-next-owner-body">
          <span className="s003-owner-icon"><PrototypeIcon name="UserRoundCog" size={20} /></span>
          <div><strong>下一责任方：数据工程</strong><p>按 D053 真实登记输入、锁定受控模块并执行兼容性发布验证；五类证据齐备后，才能将细化结果提交平台公共层登记。未来形成的兼容性版本仍永久不可消费，不发起本体刷新。</p></div>
          <PrototypeStatus tone="neutral">等待真实执行</PrototypeStatus>
        </div>
      </section>

      <PrototypeModal
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        title="工作簿修订证据"
        icon="FileDiff"
        width="720px"
        footer={<PrototypeButton variant="primary" onClick={() => setRevisionOpen(false)}>关闭</PrototypeButton>}
      >
        <PrototypeAlert tone="success" title="只修订一个表头，业务数据未改变">
          用户已确认 I 列表示 2025 本年累计，AA 列表示 2024 上年本年累计；校正用于消除重复表头歧义。
        </PrototypeAlert>
        <div className="s003-revision-diff modal-section-gap">
          <div><span>修改位置</span><strong className="mono">财务数据!AA1</strong></div>
          <div><span>修改前</span><del>利润总额_本年累计数</del></div>
          <div><span>修改后</span><ins>利润总额_本年累计数(上年)</ins></div>
          <div><span>修改原因</span><strong>区分本年与上一年口径</strong></div>
        </div>
        <div className="s003-hash-list modal-section-gap">
          <div><span>修改前 SHA-256</span><code>{PROTOTYPE_S003_SOURCE.previousHash}</code></div>
          <div><span>修改后 SHA-256</span><code>{PROTOTYPE_S003_SOURCE.currentHash}</code></div>
        </div>
        <div className="s003-preserved-grid modal-section-gap">
          <div><PrototypeIcon name="Check" size={13} /><span>未改变业务数据</span></div>
          <div><PrototypeIcon name="Check" size={13} /><span>两个 Sheet 使用范围保持</span></div>
          <div><PrototypeIcon name="Check" size={13} /><span>财务数据十进制数值校验保持</span></div>
          <div><PrototypeIcon name="Check" size={13} /><span>调节因子 8 组列表下拉校验保持</span></div>
        </div>
      </PrototypeModal>

      <PrototypeModal
        open={Boolean(evidenceItem)}
        onClose={() => setEvidenceItem(null)}
        title={evidenceItem ? `${evidenceItem.name} · 证据` : "质量证据"}
        icon="FileSearch"
        width="680px"
        footer={<PrototypeButton variant="primary" onClick={() => setEvidenceItem(null)}>关闭</PrototypeButton>}
      >
        {evidenceItem ? (
          <>
            <PrototypeAlert tone={evidenceItem.group === "pending" ? "neutral" : evidenceItem.group === "optimization" ? "warning" : "success"} icon={evidenceItem.group === "pending" ? "CircleDashed" : undefined} title={evidenceItem.result}>
              {evidenceItem.group === "pending" ? "这里明确保留待真实运行生成的位置，不展示占位标识或模拟成功结果。" : "本条来自当前校正工作簿的只读核验或最新总控已生效裁决。"}
            </PrototypeAlert>
            <div className="modal-section-gap"><PrototypeKeyValues columns={1} items={[
              { label: "影响", value: evidenceItem.impact },
              { label: "恢复建议", value: evidenceItem.recovery },
              { label: "责任方", value: evidenceItem.owner },
              { label: "证据入口", value: evidenceItem.evidence },
            ]} /></div>
          </>
        ) : null}
      </PrototypeModal>
    </main>
  );
}

function ManualUploadWizard({ open, scenario, flowState = {}, existingSnapshot, onOpenExisting, onClose, onRegistered, onNavigate, onToast }) {
  const [step, setStep] = useSourceScreenState(0);
  const [fileSelected, setFileSelected] = useSourceScreenState(false);
  const [t008, setT008] = useSourceScreenState(scenario.t008);
  const [t008Note, setT008Note] = useSourceScreenState(scenario.key === "A" ? "业务提供的 2026 年 7 月月末时点" : "原型评审夹具中的明确业务时点");
  const [fullSnapshot, setFullSnapshot] = useSourceScreenState(true);
  const [fieldError, setFieldError] = useSourceScreenState("");
  const snapshot = sourceScreenCurrentSnapshot(scenario, flowState);
  const isDuplicate = Boolean(existingSnapshot && existingSnapshot.id === snapshot.id);

  useSourceScreenEffect(() => {
    if (!open) return;
    setStep(0);
    setFileSelected(false);
    setT008(scenario.t008);
    setT008Note(scenario.key === "A" ? "业务提供的 2026 年 7 月月末时点" : "原型评审夹具中的明确业务时点");
    setFullSnapshot(true);
    setFieldError("");
  }, [open, scenario.key, scenario.t008]);

  const chooseFixture = () => {
    setFileSelected(true);
    sourceScreenToast(onToast, isDuplicate ? "已识别为重复内容，将链接原快照且不重复登记" : "已载入确定性的融资工作簿元数据（原型交互模拟）", isDuplicate ? "warning" : "success");
  };

  const registerSnapshot = () => {
    if (!t008) {
      setFieldError("请填写业务数据截至时间 T008");
      return;
    }
    if (!t008Note.trim()) {
      setFieldError("请说明 T008 的业务依据");
      return;
    }
    if (!fullSnapshot) {
      setFieldError("必须确认该文件是独立完整的全量快照");
      return;
    }
    setFieldError("");
    setStep(2);
    if (typeof onRegistered === "function") onRegistered({ ...snapshot, t008 });
    sourceScreenToast(onToast, "原始快照已登记；尚未处理、发布或刷新", "success");
  };

  const footer = step === 0 && fileSelected && isDuplicate ? (
    <>
      <PrototypeButton onClick={onClose}>取消</PrototypeButton>
      <PrototypeButton variant="primary" icon="ExternalLink" onClick={() => { onClose(); if (typeof onOpenExisting === "function") onOpenExisting(existingSnapshot); }}>打开已登记快照</PrototypeButton>
    </>
  ) : step === 0 ? (
    <>
      <PrototypeButton onClick={onClose}>取消</PrototypeButton>
      <PrototypeButton variant="primary" icon="ArrowRight" disabled={!fileSelected} onClick={() => setStep(1)}>下一步：确认快照</PrototypeButton>
    </>
  ) : step === 1 ? (
    <>
      <PrototypeButton onClick={() => setStep(0)}>上一步</PrototypeButton>
      <PrototypeButton variant="primary" icon="Archive" onClick={registerSnapshot}>登记原始快照</PrototypeButton>
    </>
  ) : (
    <>
      <PrototypeButton onClick={onClose}>完成并返回</PrototypeButton>
      <PrototypeButton variant="primary" icon="Workflow" onClick={() => { onClose(); sourceScreenGo(onNavigate, "canvas", { snapshotId: snapshot.id, snapshotT008: t008, focusNode: "source" }); }}>打开管道并处理</PrototypeButton>
    </>
  );

  return (
    <PrototypeModal open={open} title="上传融资工作簿" icon="FileSpreadsheet" onClose={onClose} width="720px" footer={footer}>
      <PrototypeProgressSteps items={["选择文件", "确认快照", "登记结果"]} current={step} />
      {step === 0 ? (
        <div className="upload-step-content">
          <PrototypeAlert title="原型交互模拟" tone="info">不会修改或重新保存用户提供的原始工作簿。点击下方选择按钮会载入已核验的文件元数据和确定性样例，用于评审上传交互。</PrototypeAlert>
          <button type="button" className={`upload-dropzone ${fileSelected ? "selected" : ""}`} onClick={chooseFixture}>
            <span className="upload-dropzone-icon"><PrototypeIcon name={fileSelected ? "FileCheck2" : "UploadCloud"} size={28} /></span>
            <strong>{fileSelected ? snapshot.file : "选择一期融资演示工作簿"}</strong>
            <span>{fileSelected ? "文件可读 · .xlsx · 788 KB · 修改时间 2026-08-09 09:24" : "仅接受 .xlsx；本原型不会读取或改写其他本机文件"}</span>
            <em>{fileSelected ? "更换评审文件" : "选择文件"}</em>
          </button>
          {fileSelected ? (
            <div className="modal-section-gap">
              {isDuplicate ? <PrototypeAlert tone="warning" title="内容重复，不形成新快照">内容指纹已指向 <span className="mono">{existingSnapshot.id}</span>。文件改名也只处理一次；可打开原快照继续追溯。</PrototypeAlert> : null}
              <PrototypeKeyValues columns={3} compact items={[
                { label: "工作簿类型", value: "Microsoft Excel (.xlsx)" },
                { label: "融资明细", value: "5,218 行 · 35 个来源字段" },
                { label: "工作表检查", value: "2 张目标工作表已找到" },
                { label: "文件状态", value: "可读取 · 未加密" },
                { label: "表头检查", value: "明细第 1 行 · 映射第 3 行" },
                { label: "内容判断", value: isDuplicate ? `重复 · ${existingSnapshot.id}` : "将在下一步执行指纹与时点核对" },
              ]} />
            </div>
          ) : null}
        </div>
      ) : step === 1 ? (
        <div className="upload-step-content">
          <PrototypeAlert title="确认的是业务时点，不是上传时间">T008 必须来自业务提供的截至时间。文件生成时间、修改时间和平台发现时间都不能自动代替。</PrototypeAlert>
          <div className="p-form-grid modal-section-gap">
            <PrototypeField label="数据截至时间 T008" type="date" value={t008} onChange={(value) => { setT008(value); setFieldError(""); }} required />
            <PrototypeField label="所选文件" value={snapshot.file} readOnly />
          </div>
          <div className="p-form-grid one modal-section-gap">
            <PrototypeTextarea label="T008 依据说明" value={t008Note} onChange={(value) => { setT008Note(value); setFieldError(""); }} required hint="例如：业务确认的 2026 年 7 月月末时点" />
            <label className="p-checkbox"><input type="checkbox" checked={fullSnapshot} onChange={(event) => { setFullSnapshot(event.target.checked); setFieldError(""); }} /><span><strong>确认该文件是独立完整的全量快照</strong><br />平台会登记新 T002，不会与上一文件追加或增量合并。</span></label>
          </div>
          {fieldError ? <div className="modal-section-gap"><PrototypeAlert tone="failed" title="还不能登记">{fieldError}</PrototypeAlert></div> : null}
          <div className="modal-section-gap">
            <PrototypeKeyValues columns={2} compact items={[
              { label: "内容指纹预检查", value: `${snapshot.fingerprint} · 未发现相同内容`, mono: true },
              { label: "同 T008 内容检查", value: "未发现更正冲突" },
            ]} />
          </div>
        </div>
      ) : (
        <div className="upload-step-content">
          <PrototypeAlert tone="success" title="原始快照已登记">登记只证明原文件证据已保存；尚未运行 Python、执行正式质量门、发布 T007 或请求本体刷新。</PrototypeAlert>
          <div className="snapshot-result-card modal-section-gap">
            <div className="snapshot-result-mark"><PrototypeIcon name="Archive" size={24} /></div>
            <div><span>原始快照 T002</span><strong className="mono">{snapshot.id}</strong><small>{snapshot.file}</small></div>
            <PrototypeStatus tone="success">已登记</PrototypeStatus>
          </div>
          <div className="modal-section-gap">
            <PrototypeKeyValues columns={2} items={[
              { label: "数据截至时间", value: t008 },
              { label: "内容指纹", value: snapshot.fingerprint, mono: true },
              { label: "读取时间", value: snapshot.readAt },
              { label: "重复判断", value: "非重复" },
              { label: "更新语义", value: "完整全量快照" },
              { label: "下一步", value: "打开绑定管道并处理" },
            ]} />
          </div>
        </div>
      )}
    </PrototypeModal>
  );
}

function ManualSourceScreen({ scenario = PROTOTYPE_SCENARIOS.A, flowState = {}, onNavigate, onToast, onFlowChange, onSourceResourceChange, routeState = {}, initialOpenUpload = false }) {
  const isNewSource = Boolean(routeState.created);
  const sourceName = routeState.sourceName || "融资工作簿手工上传";
  const startsWithoutCurrentSnapshot = (isNewSource && !routeState.hasSnapshot) || Boolean(routeState.openUpload && !routeState.uploadRegistered);
  const [uploadOpen, setUploadOpen] = useSourceScreenState(Boolean(initialOpenUpload || routeState.openUpload || (isNewSource && !routeState.hasSnapshot)));
  const [snapshotDetail, setSnapshotDetail] = useSourceScreenState(null);
  const [registeredSnapshot, setRegisteredSnapshot] = useSourceScreenState(routeState.registeredSnapshot || sourceScreenCurrentSnapshot(scenario, flowState));
  const [hasSnapshot, setHasSnapshot] = useSourceScreenState(Boolean(routeState.hasSnapshot) || !startsWithoutCurrentSnapshot);
  const snapshotRows = useSourceScreenMemo(() => {
    if (hasSnapshot) return [registeredSnapshot, ...PROTOTYPE_SNAPSHOTS.filter((row) => row.id !== registeredSnapshot.id)];
    if (isNewSource) return [];
    return PROTOTYPE_SNAPSHOTS.filter((row) => row.id !== scenario.snapshot);
  }, [registeredSnapshot, hasSnapshot, isNewSource, scenario.snapshot]);
  const hasAnySnapshot = snapshotRows.length > 0;
  const latestVisibleSnapshot = snapshotRows[0] || null;

  useSourceScreenEffect(() => {
    setRegisteredSnapshot(routeState.registeredSnapshot || sourceScreenCurrentSnapshot(scenario, flowState));
    if (routeState.uploadRegistered || routeState.hasSnapshot) setHasSnapshot(true);
    else if (routeState.openUpload || isNewSource) setHasSnapshot(false);
    else setHasSnapshot(true);
  }, [scenario.key, flowState.refreshed, flowState.priorAReady, flowState.resolvedReady, isNewSource, routeState.openUpload, routeState.uploadRegistered, routeState.hasSnapshot, routeState.registeredSnapshot]);

  useSourceScreenEffect(() => {
    if (initialOpenUpload || routeState.openUpload) setUploadOpen(true);
  }, [initialOpenUpload, routeState.openUpload]);

  useSourceScreenEffect(() => {
    if (!routeState.snapshotId) return;
    const target = snapshotRows.find((row) => row.id === routeState.snapshotId);
    if (target) setSnapshotDetail(target);
  }, [routeState.snapshotId, snapshotRows]);

  const registerSnapshot = (snapshot) => {
    setRegisteredSnapshot(snapshot);
    setHasSnapshot(true);
    if (typeof onFlowChange === "function") onFlowChange({ uploadRegistered: true, registeredSnapshot: snapshot, registeredSnapshotId: snapshot.id, registeredT008: snapshot.t008 });
    if (isNewSource && typeof onSourceResourceChange === "function") {
      onSourceResourceChange({
        id: routeState.sourceId,
        status: "可用",
        hasSnapshot: true,
        registeredSnapshot: snapshot,
        lastCheck: "不适用",
        lastDiscovered: snapshot.readAt,
        lastRead: snapshot.readAt,
        lastPublished: "未发布",
        consumption: "未就绪",
      });
    }
  };

  const snapshotColumns = [
    { key: "id", label: "快照标识", width: "22%", render: (row) => <div className="p-primary-cell"><strong className="mono">{row.id}</strong><small>{row.file}</small></div> },
    { key: "t008", label: "数据截至时间", width: "12%" },
    { key: "fingerprint", label: "内容指纹", width: "11%", render: (row) => <span className="mono">{row.fingerprint}</span> },
    { key: "status", label: "登记状态", width: "10%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.status)}>{row.status}</PrototypeStatus> },
    { key: "process", label: "后续处理", width: "15%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.process)}>{row.process}</PrototypeStatus> },
    { key: "readAt", label: "读取时间", width: "15%" },
    { key: "open", label: "", width: "5%", render: () => <PrototypeIcon name="ChevronRight" size={14} /> },
  ];

  return (
    <main className="screen-page manual-source-screen" data-screen-label="D3 手工上传来源详情">
      <PrototypePageHeader
        kicker="D3 · T001 / T002"
        title={sourceName}
        description={isNewSource ? `${routeState.sourceDescription || "新来源已创建但尚未配置。"} 先上传工作簿并登记第一份不可改写的原始快照。` : "管理一个真实上传来源、登记不可改写的原始快照，并携带精确 T002 进入管道。"}
        onBack={() => sourceScreenGo(onNavigate, "sources")}
        meta={<><span className="mono">{routeState.sourceId || (isNewSource ? "SRC-FIN-UPLOAD-NEW" : "SRC-FIN-UPLOAD-001")}</span><PrototypeStatus tone={!isNewSource || hasSnapshot ? "success" : "warning"}>{!isNewSource || hasSnapshot ? "可用" : "未配置"}</PrototypeStatus><span>绑定管道：<strong>融资数据标准化与发布</strong></span></>}
        actions={(
          <>
            <PrototypeButton icon="Route" disabled={!hasAnySnapshot} title={!hasAnySnapshot ? "登记第一份快照后才能查看沿袭" : ""} onClick={() => sourceScreenGo(onNavigate, "lineage", { centerId: latestVisibleSnapshot.id })}>查看数据沿袭</PrototypeButton>
            <PrototypeButton icon="Upload" variant="primary" onClick={() => setUploadOpen(true)}>上传新快照</PrototypeButton>
          </>
        )}
      />

      <PrototypeMetricStrip items={[
        { label: "当前候选快照", value: hasSnapshot ? registeredSnapshot.t008 : "未登记", detail: hasSnapshot ? registeredSnapshot.id : hasAnySnapshot ? "历史 T002 仍保留，本次候选尚未登记" : "尚未登记 T002", icon: "Archive", tone: hasSnapshot ? "success" : "warning" },
        { label: "融资明细", value: hasSnapshot ? "5,218" : "0", detail: hasSnapshot ? "完整全量快照 · 35 个来源字段" : "等待上传工作簿", icon: "Rows3" },
        { label: "内容指纹", value: hasSnapshot ? registeredSnapshot.fingerprint : "—", detail: hasSnapshot ? "内容级去重证据" : "登记时生成", icon: "Fingerprint" },
        { label: "后续处理", value: hasSnapshot ? registeredSnapshot.process : "未开始", detail: "登记状态与运行结果分开", icon: "Workflow", tone: hasSnapshot ? sourceScreenTone(registeredSnapshot.process) : "warning" },
      ]} />

      <div className="two-column-layout source-detail-summary-grid">
        <section className="p-section">
          <PrototypeSectionHeader title="来源与最近快照" description="原始工作簿保持不变；快照只登记来源事实和业务时点。" />
          <div className="p-section-body">
            {hasSnapshot ? <PrototypeKeyValues columns={2} items={[
              { label: "来源类型", value: "手工上传" },
              { label: "来源状态", value: "可用" },
              { label: "最近成功读取", value: registeredSnapshot.readAt },
              { label: "最近错误", value: "无" },
              { label: "工作簿", value: registeredSnapshot.file },
              { label: "更新语义", value: "每次为完整全量快照" },
            ]} /> : hasAnySnapshot ? <><PrototypeAlert tone="warning" title="本次候选尚未登记">历史快照仍可追溯，但不会自动作为本次上传旅程的当前输入。</PrototypeAlert><div className="modal-section-gap"><PrototypeKeyValues columns={2} compact items={[
              { label: "上一历史快照", value: latestVisibleSnapshot.id, mono: true },
              { label: "上一历史 T008", value: latestVisibleSnapshot.t008 },
              { label: "当前候选", value: "等待上传并登记" },
              { label: "来源状态", value: "可用" },
            ]} /></div></> : <PrototypeEmpty icon="UploadCloud" title="尚无原始快照" description="上传第一份 .xlsx 工作簿并确认 T008 与全量声明后，这里才会形成 T002。" action={<PrototypeButton variant="primary" icon="Upload" onClick={() => setUploadOpen(true)}>上传工作簿</PrototypeButton>} />}
          </div>
        </section>
        <section className="p-section source-next-step-card">
          <PrototypeSectionHeader title="继续处理" description="使用精确快照进入已绑定的五节点管道。" />
          <div className="p-section-body">
            <div className="source-binding-card">
              <span><PrototypeIcon name="Workflow" size={20} /></span>
              <div><strong>融资数据标准化与发布</strong><small className="mono">PIPE-FIN-STD-v1.0</small></div>
            <PrototypeStatus tone={hasSnapshot ? "success" : "warning"}>{hasSnapshot ? "可运行" : "等待快照"}</PrototypeStatus>
            </div>
            <p className="source-binding-note">{hasSnapshot ? <>将携带 <span className="mono">{registeredSnapshot.id}</span>；T008 与全量声明在画布中只读，不会形成第二套编辑入口。</> : "请先登记本次候选快照；历史 T002 不会被自动替换为当前输入。"}</p>
            <PrototypeButton variant="primary" icon="ArrowRight" className="full-width-button" disabled={!hasSnapshot} title={!hasSnapshot ? "请先完成当前工作簿快照登记" : ""} onClick={() => sourceScreenGo(onNavigate, "canvas", { snapshotId: registeredSnapshot.id, snapshotT008: registeredSnapshot.t008, focusNode: "source" })}>打开管道并处理</PrototypeButton>
          </div>
        </section>
      </div>

      <section className="p-section">
        <PrototypeSectionHeader title="原始快照历史" count={snapshotRows.length} description="登记事实与后续处理事实分列；历史记录不会被新的上传覆盖。" />
        <PrototypeTable columns={snapshotColumns} rows={snapshotRows} rowKey="id" onRowClick={setSnapshotDetail} empty={<PrototypeEmpty icon="Archive" title="还没有快照历史" description="完成首次上传登记后，原始快照会按读取时间列在这里。" />} />
      </section>

      <ManualUploadWizard
        open={uploadOpen}
        scenario={scenario}
        flowState={flowState}
        existingSnapshot={hasSnapshot ? registeredSnapshot : null}
        onOpenExisting={setSnapshotDetail}
        onClose={() => setUploadOpen(false)}
        onRegistered={registerSnapshot}
        onNavigate={onNavigate}
        onToast={onToast}
      />

      <PrototypeModal
        open={Boolean(snapshotDetail)}
        title="原始快照证据"
        icon="Archive"
        onClose={() => setSnapshotDetail(null)}
        width="650px"
        footer={(
          <>
            <PrototypeButton onClick={() => setSnapshotDetail(null)}>关闭</PrototypeButton>
            <PrototypeButton icon="Route" onClick={() => { const id = snapshotDetail && snapshotDetail.id; setSnapshotDetail(null); sourceScreenGo(onNavigate, "lineage", { centerId: id }); }}>打开沿袭</PrototypeButton>
            <PrototypeButton variant="primary" icon="Workflow" onClick={() => { const detail = snapshotDetail; setSnapshotDetail(null); sourceScreenGo(onNavigate, "canvas", { snapshotId: detail && detail.id, snapshotT008: detail && detail.t008, focusNode: "source" }); }}>打开管道</PrototypeButton>
          </>
        )}
      >
        {snapshotDetail ? (
          <>
            <PrototypeAlert title="原始证据只读">快照一经登记不可原地覆盖。处理失败、质量失败或刷新失败不会改变这份原始证据。</PrototypeAlert>
            <div className="modal-section-gap"><PrototypeKeyValues columns={2} items={[
              { label: "快照标识", value: snapshotDetail.id, mono: true },
              { label: "登记状态", value: snapshotDetail.status },
              { label: "文件名称", value: snapshotDetail.file },
              { label: "数据截至时间", value: snapshotDetail.t008 },
              { label: "内容指纹", value: snapshotDetail.fingerprint, mono: true },
              { label: "读取时间", value: snapshotDetail.readAt },
              { label: "更新语义", value: "完整全量快照" },
              { label: "后续处理", value: snapshotDetail.process },
            ]} /></div>
          </>
        ) : null}
      </PrototypeModal>
    </main>
  );
}

function sourceFolderQueueRows(scenario, flowState = {}) {
  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const fixture = prototypeSnapshotFixture(scenario.key);
  const state = lifecycle.ready
    ? { execution: lifecycle.execution, closure: lifecycle.closure, blocking: "无 · 权威采用证据已形成", action: "查看消费证据" }
    : scenario.key === "C"
      ? { execution: lifecycle.execution, closure: lifecycle.closure, blocking: "产业板块有效值硬阻断", action: "查看失败运行" }
      : scenario.key === "D"
        ? { execution: lifecycle.execution, closure: lifecycle.closure, blocking: "刷新返回结构不兼容", action: "查看刷新证据" }
        : { execution: lifecycle.execution, closure: lifecycle.closure, blocking: "3 项质量警告等待人工确认", action: "处理质量警告" };
  return [
    {
      id: `QUEUE-${scenario.key}-001`,
      file: `融资一览表_${scenario.t008.replaceAll("-", "")}.xlsx`,
      t008: scenario.t008,
      created: fixture.discoveredAt,
      trigger: "立即检查",
      execution: state.execution,
      closure: state.closure,
      position: "当前项",
      blocking: state.blocking,
      action: state.action,
      scenario: scenario.key,
    },
    {
      id: "QUEUE-DUP-001",
      file: "融资一览表_20260630_副本.xlsx",
      t008: "2026-06-30",
      created: fixture.discoveredAt,
      trigger: "立即检查",
      execution: "未创建运行",
      closure: "重复内容",
      position: "—",
      blocking: "内容指纹已指向原快照",
      action: "打开原快照",
      scenario: "duplicate",
    },
  ];
}

function FolderSourceScreen({ scenario = PROTOTYPE_SCENARIOS.A, flowState = {}, onNavigate, onToast, onSourceResourceChange, routeState = {} }) {
  const isNewSource = Boolean(routeState.created);
  const sourceName = routeState.sourceName || "融资共享文件夹";
  const [folderPath, setFolderPath] = useSourceScreenState(routeState.folderPath || SOURCE_SCREEN_FOLDER_PATH);
  const [fileRule, setFileRule] = useSourceScreenState(routeState.fileRule || "融资一览表_YYYYMMDD.xlsx");
  const [extractMode, setExtractMode] = useSourceScreenState("从文件名 YYYYMMDD 提取");
  const [sampleName, setSampleName] = useSourceScreenState(routeState.sampleName || "融资一览表_20260731.xlsx");
  const [fullSnapshot, setFullSnapshot] = useSourceScreenState(true);
  const [configDirty, setConfigDirty] = useSourceScreenState(isNewSource && !routeState.sourceConfigured);
  const [tested, setTested] = useSourceScreenState(Boolean(routeState.sourceConfigured) || !isNewSource);
  const [sourceConfigured, setSourceConfigured] = useSourceScreenState(Boolean(routeState.sourceConfigured) || !isNewSource);
  const [hasCompletedCheck, setHasCompletedCheck] = useSourceScreenState(Boolean(routeState.hasCompletedCheck) || !isNewSource);
  const [testOpen, setTestOpen] = useSourceScreenState(false);
  const [testRunning, setTestRunning] = useSourceScreenState(false);
  const [testComplete, setTestComplete] = useSourceScreenState(true);
  const [lockOpen, setLockOpen] = useSourceScreenState(false);
  const [checkOpen, setCheckOpen] = useSourceScreenState(false);
  const [checking, setChecking] = useSourceScreenState(false);
  const [checkComplete, setCheckComplete] = useSourceScreenState(false);
  const [finderOpen, setFinderOpen] = useSourceScreenState(false);
  const [queueDetail, setQueueDetail] = useSourceScreenState(null);
  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const snapshotFixture = prototypeSnapshotFixture(scenario.key);
  const queueRows = useSourceScreenMemo(() => sourceFolderQueueRows(scenario, flowState), [scenario.key, scenario.t008, flowState.refreshed, flowState.priorAReady, flowState.resolvedReady]);
  const visibleQueueRows = hasCompletedCheck ? queueRows : [];
  const pathValid = folderPath.trim() === SOURCE_SCREEN_FOLDER_PATH;
  const ruleValid = fileRule.trim() === "融资一览表_YYYYMMDD.xlsx";
  const extractedT008 = sourceScreenExtractT008(sampleName);
  const sampleValid = Boolean(extractedT008);
  const testPassed = pathValid && ruleValid && sampleValid && fullSnapshot;
  const persistCreatedSource = (patch) => {
    if (!isNewSource || typeof onSourceResourceChange !== "function") return;
    onSourceResourceChange({ id: routeState.sourceId, ...patch });
  };

  const markDirty = () => {
    setConfigDirty(true);
    setTested(false);
  };

  const runAccessTest = () => {
    setTestOpen(true);
    setTestRunning(true);
    setTestComplete(false);
    setTested(false);
    window.setTimeout(() => {
      setTestRunning(false);
      setTestComplete(true);
      setTested(testPassed);
    }, 520);
  };

  const saveConfiguration = () => {
    if (!tested || !fullSnapshot) {
      sourceScreenToast(onToast, !fullSnapshot ? "请先确认全量快照声明" : "配置有变化，请先重新测试访问", "warning");
      if (!tested) runAccessTest();
      return;
    }
    setLockOpen(true);
  };

  const confirmLock = () => {
    if (!tested || !fullSnapshot) {
      setLockOpen(false);
      sourceScreenToast(onToast, "当前配置尚未通过完整门禁，请先重新测试", "warning");
      return;
    }
    setConfigDirty(false);
    setSourceConfigured(true);
    setLockOpen(false);
    persistCreatedSource({
      status: "暂停",
      sourceConfigured: true,
      folderPath,
      fileRule,
      sampleName,
      hasCompletedCheck,
    });
    sourceScreenToast(onToast, "配置已保存，并锁定后续立即检查使用的精确版本", "success");
  };

  const openImmediateCheck = () => {
    if (!sourceConfigured || configDirty || !tested) {
      sourceScreenToast(onToast, "请先测试并保存当前配置，再执行立即检查", "warning");
      return;
    }
    setCheckComplete(false);
    setChecking(false);
    setCheckOpen(true);
  };

  const startImmediateCheck = () => {
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      setCheckComplete(true);
      setHasCompletedCheck(true);
      persistCreatedSource({
        status: "暂停",
        sourceConfigured: true,
        hasCompletedCheck: true,
        lastCheck: snapshotFixture.discoveredAt,
        lastDiscovered: snapshotFixture.discoveredAt,
        lastRead: snapshotFixture.readAt,
        lastPublished: lifecycle.lastPublished,
        consumption: lifecycle.consumption,
      });
      sourceScreenToast(onToast, "本次立即检查已完成，来源仍保持暂停", scenario.key === "C" || scenario.key === "D" ? "warning" : "success");
    }, 720);
  };

  const openQueueAction = (row) => {
    if (row.scenario === "duplicate") {
      setQueueDetail(null);
      sourceScreenGo(onNavigate, "source-manual", { snapshotId: "SNAP-FIN-20260630-001" });
      return;
    }
    if (scenario.key === "D") sourceScreenGo(onNavigate, "asset-detail", { versionId: scenario.assetVersion, initialView: "refresh" });
    else if (lifecycle.ready) sourceScreenGo(onNavigate, "asset-detail", { versionId: scenario.assetVersion, initialView: "refresh" });
    else if (["A", "B"].includes(scenario.key)) sourceScreenGo(onNavigate, "canvas", { runId: scenario.run, focusNode: "quality", bottomTab: "quality" });
    else sourceScreenGo(onNavigate, "run-detail", { runId: scenario.run, initialTab: "nodes" });
    setQueueDetail(null);
  };

  const copyFolderPath = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(folderPath)
        .then(() => sourceScreenToast(onToast, "共享目录绝对路径已复制", "success"))
        .catch(() => sourceScreenToast(onToast, "浏览器未允许复制，请在弹层中手工选择路径", "warning"));
      return;
    }
    sourceScreenToast(onToast, "当前浏览器不支持剪贴板，请在弹层中手工选择路径", "warning");
  };

  const queueColumns = [
    { key: "file", label: "发现文件", width: "23%", render: (row) => <div className="p-primary-cell"><strong>{row.file}</strong><small className="mono">{row.id}</small></div> },
    { key: "t008", label: "T008", width: "9%" },
    { key: "trigger", label: "触发", width: "9%" },
    { key: "execution", label: "执行状态", width: "10%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.execution)}>{row.execution}</PrototypeStatus> },
    { key: "closure", label: "闭环结果", width: "13%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.closure)}>{row.closure}</PrototypeStatus> },
    { key: "position", label: "队列位置", width: "8%" },
    { key: "blocking", label: "等待 / 阻断原因", width: "23%" },
    { key: "open", label: "", width: "5%", render: () => <PrototypeIcon name="ChevronRight" size={14} /> },
  ];

  const testRows = [
    { label: "目录访问", value: pathValid ? folderPath : "目录不在一期固定边界内", detail: pathValid ? "已核对项目目录下的平台固定演示目录" : `一期只允许固定目录：${SOURCE_SCREEN_FOLDER_PATH}`, passed: pathValid },
    { label: "文件名规则", value: fileRule, detail: ruleValid ? `样例 ${sampleName} 应命中` : "一期规则固定为 融资一览表_YYYYMMDD.xlsx", passed: ruleValid },
    { label: "T008 提取", value: sampleValid ? extractedT008 : "无法提取", detail: sampleValid ? "从文件名日期提取，不使用发现时间" : "样例需匹配规则且包含有效日历日期", passed: sampleValid },
    { label: "全量声明", value: fullSnapshot ? "已确认" : "未确认", detail: "每个命中文件必须是独立完整的全量快照", passed: fullSnapshot },
    { label: "版本与发布门禁", value: "PIPE-FIN-STD-v1.0 / 四成员三关系", detail: "已保存可运行版本；发布说明必填", passed: true },
    { label: "刷新目标", value: "融资演示本体 · Published v1.0.0", detail: "既有来源映射：融资标准化来源映射 v1", passed: true },
  ];

  return (
    <main className="screen-page folder-source-screen" data-screen-label="D3 共享文件夹来源详情">
      <PrototypePageHeader
        kicker="D3 · T001 / MANUAL CHECK"
        title={sourceName}
        description={sourceConfigured ? "配置平台可持续访问的固定目录。当前不设置定时读取，只由“立即检查”手工触发一次完整发现—运行闭环。" : `${routeState.sourceDescription || "新来源已创建。"} 推荐目录已预填；完成访问测试并锁定精确版本后才可执行立即检查。`}
        onBack={() => sourceScreenGo(onNavigate, "sources")}
        meta={<><span className="mono">{routeState.sourceId || (isNewSource ? "SRC-FIN-FOLDER-NEW" : "SRC-FIN-FOLDER-001")}</span><PrototypeStatus tone={sourceConfigured ? "warning" : "neutral"}>{sourceConfigured ? "暂停 · 无定时检查" : "未配置"}</PrototypeStatus><span>{configDirty ? "有未保存修改" : sourceConfigured ? "配置已保存" : "等待测试与保存"}</span></>}
        actions={(
          <>
            <PrototypeButton icon="FolderOpen" onClick={() => setFinderOpen(true)}>在访达中定位</PrototypeButton>
            <PrototypeButton icon="RefreshCw" variant="primary" disabled={!sourceConfigured || configDirty || !tested} title={!sourceConfigured || configDirty || !tested ? "请先通过测试并保存配置" : ""} onClick={openImmediateCheck}>立即检查</PrototypeButton>
          </>
        )}
      />

      <PrototypeAlert title="检查方式：仅手工触发" tone="info">没有每 5 分钟或其他定时计划，也不显示“下次检查”。点击“立即检查”会使用已锁定版本执行一次完整周期；即使来源处于暂停状态也会运行一次，完成后仍保持暂停。</PrototypeAlert>

      <div className="folder-source-metric-spacing">
        <PrototypeMetricStrip items={[
          { label: "最近检查", value: hasCompletedCheck ? snapshotFixture.discoveredAt.slice(11, 16) : "—", detail: hasCompletedCheck ? `${snapshotFixture.discoveredAt.slice(0, 10)} · 手工立即检查` : "尚未执行检查", icon: "Clock" },
          { label: "最近发现", value: hasCompletedCheck ? snapshotFixture.discoveredAt.slice(11, 16) : "—", detail: hasCompletedCheck ? queueRows[0].file : "尚无发现证据", icon: "ScanSearch" },
          { label: "最近成功读取", value: hasCompletedCheck ? snapshotFixture.readAt.slice(11, 16) : "—", detail: hasCompletedCheck ? `${scenario.snapshot} · ${snapshotFixture.readAt}` : "尚无读取证据", icon: "FileCheck2", tone: hasCompletedCheck ? "success" : "" },
          { label: lifecycle.ready ? "最近队列结果" : "待处理队列", value: hasCompletedCheck ? "1" : "0", detail: hasCompletedCheck ? queueRows[0].blocking : "完成立即检查后显示", icon: "ListOrdered", tone: hasCompletedCheck ? lifecycle.tone : "" },
        ]} />
      </div>

      <div className="two-column-layout folder-config-layout">
        <section className="p-section">
          <PrototypeSectionHeader title="发现与时点配置" description="修改路径、规则或样例后必须重新测试，再保存生效。" actions={<PrototypeStatus tone={configDirty ? "warning" : sourceConfigured ? "success" : "neutral"}>{configDirty ? "未保存" : sourceConfigured ? "已保存" : "未配置"}</PrototypeStatus>} />
          <div className="p-section-body">
            <div className="p-form-grid one">
              <PrototypeField label="文件夹绝对路径" value={folderPath} onChange={(value) => { setFolderPath(value); markDirty(); }} required hint="本机演示固定在项目目录下；平台停止期间不扫描，恢复后补扫并去重。" />
              <div className="p-form-grid">
                <PrototypeField label="文件名规则" value={fileRule} onChange={(value) => { setFileRule(value); markDirty(); }} required hint="只发现符合规则的 .xlsx 文件" />
                <PrototypeField label="T008 提取方式" value={extractMode} readOnly hint="一期固定从文件名提取，避免形成第二套不完整配置。" />
              </div>
              <PrototypeField label="提取校验样例" value={sampleName} onChange={(value) => { setSampleName(value); markDirty(); }} required hint="当前预期提取：2026-07-31" />
              <label className="p-checkbox"><input type="checkbox" checked={fullSnapshot} onChange={(event) => { setFullSnapshot(event.target.checked); markDirty(); }} /><span><strong>每个命中文件都是独立完整的全量快照</strong><br />不追加、不合并；内容指纹重复时链接原证据且不产生新运行。</span></label>
            </div>
            <div className="p-inline-actions folder-config-actions">
              <PrototypeButton icon="TestTube2" onClick={runAccessTest}>测试访问</PrototypeButton>
              <PrototypeButton icon="Save" variant="primary" onClick={saveConfiguration}>保存并核对版本</PrototypeButton>
            </div>
          </div>
        </section>

        <section className="p-section folder-version-section">
          <PrototypeSectionHeader title="立即检查使用的精确版本" description="新草稿不会静默替换这里的锁定版本。" actions={<PrototypeButton size="sm" icon="RefreshCw" onClick={saveConfiguration}>核对 / 切换</PrototypeButton>} />
          <div className="p-section-body">
            <div className="version-lock-stack">
              <div><span>管道配置 T003</span><strong className="mono">PIPE-FIN-STD-v1.0</strong><PrototypeStatus compact tone="success">可运行</PrototypeStatus></div>
              <div><span>Python 模块 T004</span><strong>融资工作簿标准化 v1 · 1.0.0</strong><PrototypeStatus compact tone="success">已锁定</PrototypeStatus></div>
              <div><span>发布逻辑资产 T006</span><strong>融资标准化数据资产</strong><small>四成员 · 三关系 · 版本说明必填</small></div>
              <div><span>请求目标 T017</span><strong>融资演示本体 · Published v1.0.0</strong><small>融资标准化来源映射 v1</small></div>
            </div>
            <PrototypeAlert tone="warning" title="质量警告仍需人工确认">立即检查不会自动确认警告；候选会停在等待确认，未确认前不发布 T007、不发出刷新请求。</PrototypeAlert>
          </div>
        </section>
      </div>

      <section className="p-section folder-queue-section">
        <PrototypeSectionHeader
          title="文件发现与发布—刷新串行队列"
          count={visibleQueueRows.length}
          description="重复或问题文件只保留一条可更新记录；执行状态与闭环结果分列。"
          actions={<PrototypeButton size="sm" icon="RefreshCw" disabled={!sourceConfigured || configDirty || !tested} title={!sourceConfigured || configDirty || !tested ? "请先通过测试并保存配置" : ""} onClick={openImmediateCheck}>{hasCompletedCheck ? "再次立即检查" : "立即检查"}</PrototypeButton>}
        />
        <PrototypeTable columns={queueColumns} rows={visibleQueueRows} rowKey="id" onRowClick={setQueueDetail} empty={<PrototypeEmpty icon="Inbox" title="尚无文件发现记录" description="通过访问测试、保存精确版本并执行“立即检查”后，发现与去重结果会进入此队列。" />} />
      </section>

      <PrototypeModal open={testOpen} title="测试访问与执行门禁" icon="TestTube2" onClose={() => setTestOpen(false)} width="720px" footer={<><PrototypeButton onClick={() => setTestOpen(false)}>返回配置</PrototypeButton><PrototypeButton variant="primary" icon="RotateCw" loading={testRunning} onClick={runAccessTest}>重新测试</PrototypeButton></>}>
        {testRunning ? <PrototypeSkeleton rows={6} /> : testComplete ? (
          <>
            <PrototypeAlert tone={testPassed ? "success" : "failed"} title={testPassed ? "六项门禁均通过" : "配置尚未通过完整门禁"}>{testPassed ? "这只证明当前配置可用于原型评审，不代表后台连接能力已经实现。" : "修正失败项后重新测试；部分通过不能保存或执行立即检查。"}</PrototypeAlert>
            <div className="evidence-list modal-section-gap">
              {testRows.map((row) => <div className="evidence-row" key={row.label}><strong>{row.label}</strong><div className="evidence-row-copy"><strong>{row.value}</strong><span>{row.detail}</span></div><PrototypeStatus compact tone={row.passed ? "success" : "failed"}>{row.passed ? "通过" : "未通过"}</PrototypeStatus></div>)}
            </div>
          </>
        ) : null}
      </PrototypeModal>

      <PrototypeModal open={lockOpen} title="锁定立即检查执行版本" icon="LockKeyhole" onClose={() => setLockOpen(false)} width="700px" footer={<><PrototypeButton onClick={() => setLockOpen(false)}>取消</PrototypeButton><PrototypeButton variant="primary" icon="LockKeyhole" onClick={confirmLock}>确认锁定并保存</PrototypeButton></>}>
        <PrototypeAlert tone="warning" title="只影响之后手工触发的检查周期">已排队或运行中的任务继续使用其创建时锁定的版本；保存新的管道草稿不会静默切换。</PrototypeAlert>
        <div className="modal-section-gap"><PrototypeKeyValues columns={2} items={[
          { label: "自动执行管道 T003", value: "PIPE-FIN-STD-v1.0", mono: true },
          { label: "Python 模块 T004", value: "融资工作簿标准化 v1 · 1.0.0" },
          { label: "发布逻辑资产 T006", value: "融资标准化数据资产" },
          { label: "发布内容", value: "四成员 · 三关系 · 不可变 T007" },
          { label: "刷新目标 T017", value: "融资演示本体 · Published v1.0.0" },
          { label: "既有来源映射", value: "融资标准化来源映射 v1" },
          { label: "质量警告", value: "等待人工二选一，不自动继续" },
          { label: "触发方式", value: "仅手工“立即检查”" },
        ]} /></div>
        <p className="p-modal-copy modal-section-gap">一次立即检查的范围固定为：发现文件 → 登记非重复 T002 → 正式运行 → 质量门 → 允许时发布不可变 T007 → 请求目标 T017 刷新。T019 是否采用由本体管理的权威消费绑定决定。</p>
      </PrototypeModal>

      <PrototypeModal open={checkOpen} title="立即检查一次完整周期" icon="RefreshCw" onClose={() => setCheckOpen(false)} width="720px" footer={checking ? <><PrototypeStatus tone="running">检查进行中</PrototypeStatus><PrototypeButton onClick={() => setCheckOpen(false)}>关闭弹层并继续</PrototypeButton></> : checkComplete ? <><PrototypeButton onClick={() => setCheckOpen(false)}>关闭</PrototypeButton><PrototypeButton variant="primary" icon="ArrowRight" onClick={() => { setCheckOpen(false); setQueueDetail(queueRows[0]); }}>查看新队列项</PrototypeButton></> : <><PrototypeButton onClick={() => setCheckOpen(false)}>取消</PrototypeButton><PrototypeButton variant="primary" icon="Play" onClick={startImmediateCheck}>开始立即检查</PrototypeButton></>}>
        {!checking && !checkComplete ? (
          <>
            <PrototypeAlert tone="warning" title="当前来源处于暂停状态">本次仍会执行一次发现—运行完整周期，结束后继续保持暂停，不会建立定时计划。</PrototypeAlert>
            <div className="modal-section-gap"><PrototypeKeyValues columns={2} items={[
              { label: "检查目录", value: folderPath },
              { label: "文件名规则", value: fileRule },
              { label: "锁定管道", value: "PIPE-FIN-STD-v1.0", mono: true },
              { label: "锁定脚本", value: "融资工作簿标准化 v1 · 1.0.0" },
              { label: "发布资产", value: "融资标准化数据资产" },
              { label: "刷新目标", value: "Published v1.0.0" },
            ]} /></div>
          </>
        ) : checking ? (
          <div className="immediate-check-progress">
            <PrototypeIcon name="LoaderCircle" size={28} className="spin" />
            <strong>正在检查目录并登记非重复文件</strong>
            <span>原型交互模拟 · 不代表后端进程已经运行</span>
            <PrototypeSkeleton rows={4} />
          </div>
        ) : (
          <>
            <PrototypeAlert tone={scenario.key === "C" || scenario.key === "D" ? "warning" : "success"} title="本次检查完成">发现 2 个文件：1 个形成队列项，1 个内容重复并链接原快照。来源仍为暂停，未设置下次检查。</PrototypeAlert>
            <div className="evidence-list modal-section-gap">
              <div className="evidence-row"><strong>目录检查</strong><div className="evidence-row-copy"><strong>已完成</strong><span>{snapshotFixture.discoveredAt} · 手工立即检查</span></div><PrototypeStatus tone="success">成功</PrototypeStatus></div>
              <div className="evidence-row"><strong>新候选</strong><div className="evidence-row-copy"><strong>{queueRows[0].file}</strong><span>{queueRows[0].blocking}</span></div><PrototypeStatus tone={sourceScreenTone(queueRows[0].execution)}>{queueRows[0].execution}</PrototypeStatus></div>
              <div className="evidence-row"><strong>重复内容</strong><div className="evidence-row-copy"><strong>{queueRows[1].file}</strong><span>链接 SNAP-FIN-20260630-001，不产生新运行</span></div><PrototypeStatus tone="neutral">未重复处理</PrototypeStatus></div>
              <div className="evidence-row"><strong>来源状态</strong><div className="evidence-row-copy"><strong>暂停 · 无定时检查</strong><span>本次完成后未改变来源状态</span></div><PrototypeStatus tone="warning">保持暂停</PrototypeStatus></div>
            </div>
          </>
        )}
      </PrototypeModal>

      <PrototypeModal open={finderOpen} title="共享目录位置" icon="FolderOpen" onClose={() => setFinderOpen(false)} width="650px" footer={<><PrototypeButton onClick={() => setFinderOpen(false)}>关闭</PrototypeButton><PrototypeButton variant="primary" icon="Copy" onClick={copyFolderPath}>复制绝对路径</PrototypeButton></>}>
        <PrototypeAlert title="原型不会直接控制本机访达">正式实现中该动作会定位到已配置的固定目录；当前可用下方绝对路径核对目录边界。</PrototypeAlert>
        <div className="folder-path-callout modal-section-gap"><PrototypeIcon name="Folder" size={20} /><code>{folderPath}</code></div>
        <p className="p-modal-copy modal-section-gap">该目录位于项目目录下，不等同于任意监听桌面、下载或用户私人文件夹。平台进程停止期间不会扫描，恢复后补扫并按内容指纹去重。</p>
      </PrototypeModal>

      <PrototypeModal open={Boolean(queueDetail)} title="队列项详情" icon="ListOrdered" onClose={() => setQueueDetail(null)} width="680px" footer={queueDetail ? <><PrototypeButton onClick={() => setQueueDetail(null)}>返回队列</PrototypeButton><PrototypeButton variant="primary" icon="ArrowRight" onClick={() => openQueueAction(queueDetail)}>{queueDetail.action}</PrototypeButton></> : null}>
        {queueDetail ? (
          <>
            <PrototypeAlert tone={queueDetail.scenario === "duplicate" ? "info" : sourceScreenTone(queueDetail.execution)} title={queueDetail.blocking}>{queueDetail.scenario === "duplicate" ? "内容相同的改名文件只处理一次；当前记录链接原快照，不创建 T002、运行或 T007。" : "该项保留精确触发、版本和失败证据；恢复会创建关联运行或打开外部刷新证据，不改写本条历史。"}</PrototypeAlert>
            <div className="modal-section-gap"><PrototypeKeyValues columns={2} items={[
              { label: "文件", value: queueDetail.file },
              { label: "数据截至时间", value: queueDetail.t008 },
              { label: "触发方式", value: queueDetail.trigger },
              { label: "创建时间", value: queueDetail.created },
              { label: "执行状态", value: queueDetail.execution },
              { label: "闭环结果", value: queueDetail.closure },
              { label: "队列位置", value: queueDetail.position },
              { label: "阻断原因", value: queueDetail.blocking },
            ]} /></div>
          </>
        ) : null}
      </PrototypeModal>
    </main>
  );
}

function PipelineDirectoryScreen({ scenario = PROTOTYPE_SCENARIOS.A, flowState = {}, onNavigate }) {
  const [search, setSearch] = useSourceScreenState("");
  const [statusFilter, setStatusFilter] = useSourceScreenState("全部状态");
  const lifecycle = sourceScreenLifecycleState(scenario, flowState);
  const rows = useSourceScreenMemo(() => {
    const pipeline = {
      id: "PIPE-FIN-STD-v1.0",
      name: "融资数据标准化与发布",
      input: "手工上传 / 共享文件夹",
      output: "融资标准化数据资产",
      version: "v1.0 · 已保存",
      status: "可运行",
      latestRun: scenario.run,
      runState: lifecycle.execution,
      autoReference: "共享文件夹 · 立即检查锁定",
    };
    const query = search.trim().toLowerCase();
    const matchQuery = !query || `${pipeline.name} ${pipeline.id} ${pipeline.input} ${pipeline.output}`.toLowerCase().includes(query);
    const matchStatus = statusFilter === "全部状态" || pipeline.status === statusFilter;
    return matchQuery && matchStatus ? [pipeline] : [];
  }, [search, statusFilter, scenario.run, lifecycle.execution]);

  const columns = [
    { key: "name", label: "管道", width: "21%", render: (row) => <div className="p-primary-cell"><strong>{row.name}</strong><small className="mono">{row.id}</small></div> },
    { key: "input", label: "输入", width: "15%" },
    { key: "output", label: "输出", width: "16%" },
    { key: "version", label: "保存版本", width: "11%" },
    { key: "status", label: "配置状态", width: "10%", render: (row) => <PrototypeStatus compact tone={sourceScreenTone(row.status)}>{row.status}</PrototypeStatus> },
    { key: "latestRun", label: "最近运行", width: "16%", render: (row) => <div className="p-primary-cell"><strong className="mono">{row.latestRun}</strong><small>{row.runState}</small></div> },
    { key: "autoReference", label: "自动执行引用", width: "17%" },
    { key: "open", label: "", width: "4%", render: () => <PrototypeIcon name="ChevronRight" size={14} /> },
  ];

  return (
    <main className="screen-page pipeline-directory-screen" data-screen-label="D4 数据管道目录">
      <PrototypePageHeader
        kicker="D4 · T003 DIRECTORY"
        title="数据管道目录"
        description="找到已保存的五节点管道及最近运行证据。目录只负责进入画布，不直接运行、发布或切换共享文件夹锁定版本。"
        actions={<PrototypeButton icon="Plus" variant="primary" onClick={() => sourceScreenGo(onNavigate, "canvas", { mode: "new", name: "新建融资管道" })}>新建融资管道</PrototypeButton>}
      />

      <PrototypeMetricStrip items={[
        { label: "管道总数", value: "1", detail: "一期融资核心闭环", icon: "Workflow" },
        { label: "可运行", value: "1", detail: "五节点结构与必填配置完整", icon: "CircleCheck", tone: "success" },
        { label: "最近运行", value: lifecycle.execution, detail: `${scenario.run} · ${lifecycle.closure}`, icon: "History", tone: lifecycle.tone },
        { label: "手工检查引用", value: "1", detail: "融资共享文件夹 · 精确版本锁定", icon: "LockKeyhole" },
      ]} />

      <section className="p-section pipeline-directory-table-section">
        <div className="p-toolbar">
          <div className="p-toolbar-group">
            <PrototypeSearch value={search} onChange={setSearch} placeholder="搜索管道名称、标识、输入或输出" ariaLabel="搜索数据管道" />
            <PrototypeSelect value={statusFilter} onChange={setStatusFilter} options={["全部状态", "可运行", "编辑中", "校验失败", "已被新配置替代"]} />
          </div>
          <span className="toolbar-result-count">显示 {rows.length} / 1 条管道</span>
        </div>
        <PrototypeTable
          columns={columns}
          rows={rows}
          rowKey="id"
          onRowClick={(row) => sourceScreenGo(onNavigate, "canvas", { pipelineId: row.id })}
          empty={<PrototypeEmpty icon="SearchX" title="没有符合条件的管道" description="当前搜索或状态筛选没有结果。清空筛选后可重新查看已保存管道。" action={<PrototypeButton onClick={() => { setSearch(""); setStatusFilter("全部状态"); }}>清空筛选</PrototypeButton>} />}
        />
      </section>

      <div className="two-column-layout pipeline-directory-evidence">
        <section className="p-section">
          <PrototypeSectionHeader title="最近运行证据" description="打开精确运行，不在目录中直接重跑。" actions={<PrototypeButton size="sm" icon="ArrowRight" onClick={() => sourceScreenGo(onNavigate, "run-detail", { runId: scenario.run })}>查看运行详情</PrototypeButton>} />
          <div className="p-section-body"><PrototypeKeyValues columns={3} compact items={[
            { label: "运行标识", value: scenario.run, mono: true },
            { label: "数据截至时间", value: scenario.t008 },
            { label: "运行类型", value: "正式运行" },
            { label: "执行状态", value: lifecycle.execution },
            { label: "闭环结果", value: lifecycle.closure },
            { label: "触发方式", value: scenario.key === "C" ? "共享文件夹 · 立即检查" : "手工上传" },
          ]} /></div>
        </section>
        <section className="p-section">
          <PrototypeSectionHeader title="共享文件夹引用" description="这里只读显示引用；切换必须回来源详情确认。" actions={<PrototypeButton size="sm" icon="FolderInput" onClick={() => sourceScreenGo(onNavigate, "source-folder")}>打开来源配置</PrototypeButton>} />
          <div className="p-section-body"><PrototypeKeyValues columns={1} compact items={[
            { label: "来源", value: "融资共享文件夹" },
            { label: "执行方式", value: "仅手工“立即检查”" },
            { label: "锁定版本", value: "PIPE-FIN-STD-v1.0 / 脚本 1.0.0" },
            { label: "版本切换", value: "只影响之后发现的新文件" },
          ]} /></div>
        </section>
      </div>
    </main>
  );
}

Object.assign(window, {
  SourceOverviewScreen,
  SourceDirectoryScreen,
  S003CompatibilityScreen,
  ManualSourceScreen,
  FolderSourceScreen,
  PipelineDirectoryScreen,
});
