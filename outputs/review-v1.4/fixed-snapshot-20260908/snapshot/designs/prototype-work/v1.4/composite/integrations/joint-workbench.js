(function installJointWorkbench(global) {
  "use strict";
  const task = (id, label, icon, view) =>
    Object.freeze({ id, label, icon, view, hash: `#v14/${view}` });
  const tasks = Object.freeze({
    dashboard: [task("situation", "融资与风险态势", "globe-2", "workbench")],
    query: [task("map-query", "地图联动问数", "map", "workbench")],
    decision: [
      task("financing-plans", "融资方案推演", "git-compare-arrows", "plans"),
      task("analysis-tasks", "分析复核事项", "list-checks", "tasks"),
    ],
    report: [
      task("joint-reports", "联合分析报告", "file-chart-column", "reports"),
    ],
  });
  const owners = {
    workbench: ["dashboard", "situation"],
    plans: ["decision", "financing-plans"],
    tasks: ["decision", "analysis-tasks"],
    reports: ["report", "joint-reports"],
    ontology: ["ontology", "published"],
    data: ["data", "resources"],
    models: ["modeling", "objectives"],
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let shell,
    pendingReport = null,
    pendingRule = null;
  function isJoint(frame) {
    try {
      return new URL(frame.contentWindow.location.href).pathname.endsWith(
        "/workbench.html",
      );
    } catch {
      return false;
    }
  }
  function taskForFrame(frame, moduleId) {
    if (!isJoint(frame)) return null;
    const view =
      new URLSearchParams(frame.contentWindow.location.hash.slice(1)).get(
        "view",
      ) || "workbench";
    return tasks[moduleId]?.find((item) => item.view === view) || null;
  }
  function source(item) {
    const url = new URL("/workbench.html", location.origin);
    url.searchParams.set("embedded", "1");
    url.hash = `view=${item.view}`;
    return url.pathname + url.search + url.hash;
  }
  function attach(api) {
    shell = api;
    for (const scenario of global.OFW_V131_DATA.scenarios) {
      const positions =
        shell.store.scenario(scenario.id)?.navigation?.framePositions || {};
      if (positions.m07?.hash === "#v14/workbench")
        shell.store.saveFramePosition(
          "m07",
          { hash: "#discover", windowY: 0, containerY: 0 },
          scenario.id,
        );
      if (positions.data?.hash === "#v14/data")
        shell.store.saveFramePosition(
          "data",
          { hash: "#/resources", windowY: 0, containerY: 0 },
          scenario.id,
        );
      if (positions.ontology?.hash === "#v14/ontology")
        shell.store.saveFramePosition(
          "ontology",
          { hash: "#published", windowY: 0, containerY: 0 },
          scenario.id,
        );
    }
  }
  function open(moduleId, taskId, context = null) {
    if (!shell) return;
    if (context) shell.updateWorkspaceContext(context, "joint-workbench");
    const target = shell.tasks(moduleId).find((item) => item.id === taskId);
    if (!target) throw new Error("工作区任务不存在");
    shell.capture();
    shell.store.saveFramePosition(moduleId, {
      hash: target.hash,
      windowY: 0,
      containerY: 0,
    });
    shell.navigate(
      moduleId === "dashboard" ? "#dashboard" : `#module/${moduleId}`,
      { skipCapture: true },
    );
  }
  function openOntology(owner = "S001") {
    if (!["S001", "S003"].includes(owner))
      throw new Error("规则所属本体不支持");
    shell.capture();
    shell.store.setActiveScenario(owner, "ontology-rules");
    const url = new URL(
      global.OFW_V131_DATA.moduleById.ontology.source,
      location.href,
    );
    url.searchParams.set("operationsOwner", owner);
    url.hash = `modeling/workbench?draft=DRAFT-V14-OPERATIONS-${owner}`;
    shell.store.saveFramePosition("ontology", {
      href: url.href,
      hash: url.hash,
      windowY: 0,
      containerY: 0,
    });
    shell.navigate("#module/ontology", { skipCapture: true });
  }
  function applyOwnedRule(result) {
    if (
      !result?.ontologyId ||
      !result?.draftId ||
      !result?.ruleId ||
      !result?.dataDigest ||
      !Array.isArray(result.objectIds)
    )
      throw new Error("规则验证身份不完整");
    const draft = document
        .getElementById("module-frame")
        ?.contentWindow?.OFW_M01_PORTFOLIO_STATE?.drafts.find(
          (item) => item.id === result.draftId,
        ),
      rule = draft?.rules.find((item) => item.id === result.ruleId);
    if (
      !draft ||
      !rule ||
      draft.publishedVersionId ||
      JSON.stringify([
        draft.id,
        draft.draftRevision,
        rule,
        draft.metrics.filter((item) => item.operationsDefinitionId),
      ]) !== result.ruleFingerprint
    )
      throw new Error("规则定义已变化，请重新验证后再应用");
    pendingRule = clone(result);
    open("dashboard", "situation");
  }
  function activate(frame, module, item) {
    if (!item.view && !isJoint(frame)) return false;
    try {
      frame.contentWindow.__OFW_NATIVE_MODULE_INTEGRATION__?.destroy?.();
    } catch {}
    shell.store.saveFramePosition(module.id, {
      hash: item.hash,
      windowY: 0,
      containerY: 0,
    });
    if (item.view && isJoint(frame)) {
      frame.contentWindow.postMessage(
        { type: "OFW_V14_VIEW", view: item.view },
        location.origin,
      );
      return true;
    }
    frame.src = item.view ? source(item) : shell.frameSource(module);
    return true;
  }
  function adapt(frame, module) {
    document
      .querySelector(".module-workspace-layout")
      ?.classList.toggle("joint-active", isJoint(frame));
    if (!isJoint(frame)) return false;
    const sync = () => {
      shell.syncNavigation(frame, module);
      const heading = document.getElementById("frame-breadcrumb-current");
      if (heading)
        heading.textContent =
          taskForFrame(frame, module.id)?.label || module.name;
    };
    frame.contentWindow.addEventListener("hashchange", sync);
    frame.contentDocument.addEventListener("click", () => setTimeout(sync, 50));
    sync();
    frame.contentWindow.postMessage(
      { type: "OFW_V14_CONTEXT", context: shell.store.workspaceContext() },
      location.origin,
    );
    return true;
  }
  function scopeContext(payload) {
    const ids = payload?.objectIds || [];
    const master = global.OFW_ENTERPRISE_MASTER;
    const resolved = ids.map((id) => master?.resolve(id)).filter(Boolean);
    if (ids.length !== resolved.length)
      throw new Error("交接对象不在继承的企业主数据中");
    const selected = payload.selectedId
      ? master.resolve(payload.selectedId)
      : null;
    return {
      scenarioId: "S003",
      activeObjectRef: selected
        ? { id: selected.id, title: selected.name, objectTypeRef: "Enterprise" }
        : null,
      objectSetRef: {
        id: "V14-JOINT-SCOPE",
        title: `联合分析 · ${ids.length}家企业`,
        objectIds: resolved.map((item) => item.id),
      },
      analysisScope: "set",
      sourceModuleId: "joint-workbench",
    };
  }
  function nativeContext(payload) {
    return {
      ...scopeContext(payload),
      dataVersionRef: null,
      ontologyVersionRef: null,
      comparisonRef: null,
      evidenceRefs: [],
      resultView: "formal",
      timeRange: {
        start: "2025-12-31",
        end: "2025-12-31",
        label: "截至2025-12-31",
      },
    };
  }
  function publishReport(report) {
    if (
      !report?.id ||
      !Array.isArray(report.rows) ||
      !report.evidence?.dataDigest
    )
      throw new Error("联合分析报告缺少固定依据");
    const context = scopeContext({ objectIds: report.evidence.objectIds });
    const resultMode = report.evidence.resultKind === "SIMULATION" ? "simulation" : "demo";
    const workspaceContext = {
      ...context,
      sourceModuleId: "joint-workbench",
      resultView: resultMode,
      resultMode: { id: resultMode, label: resultMode === "demo" ? "演示基准" : `方案模拟 · ${report.planSnapshot?.name || report.plan?.name || report.evidence.planId}` },
      objectSet: { ...context.objectSetRef, label: context.objectSetRef.title, count: report.evidence.objectIds.length },
      timeRange: { start: report.evidence.asOf, end: report.evidence.asOf, label: `截至${report.evidence.asOf} · ${report.evidence.horizon}天窗口` },
      dataVersionRef: { id: report.evidence.dataVersion },
      ontologyVersionRef: { id: report.evidence.ontologyVersion },
      evidenceRefs: [report.evidence.dataDigest],
      jointEvidence: clone(report.evidence),
    };
    const W = global.OFW_WORKFLOW,
      identity = `V14-REPORT-${report.id}`,
      existing = W.readReport("S003");
    const imported = existing?.jointImports?.includes(report.id) || existing?.contentBlocks.some((block) => block.jointReportId === report.id);
    if (imported) {
      // An imported revision is immutable. Preserve prose, order and deleted blocks.
      W.saveReport("S003", { ...existing, workspaceContext, resultMode,
        jointImports: [...new Set([...(existing.jointImports || []), report.id])],
        contentBlocks: existing.contentBlocks.map((block) => {
          if (block.jointReportId !== report.id) return block;
          const fingerprint = (item) => JSON.stringify([item.sourceModuleId, item.title, item.resultId, item.rows, item.text, item.workspaceContext]);
          const untouched = block.fingerprint === fingerprint(block);
          const next = { ...block, resultMode, workspaceContext };
          if (untouched) {
            next.text = `联合态势演示分析，非正式融资事实。${report.evidence.horizon}天窗口；${report.notes || ""}`;
            next.fingerprint = fingerprint(next);
          }
          return next;
        }) });
      return identity;
    }
    for (const [key, label, unit, scale] of [
      ["balance", "融资余额", "亿元", 100],
      ["cost", "加权融资成本", "%", 1],
      ["due", "窗口到期本金", "亿元", 100],
      ["gap", "测算资金缺口", "亿元", 100],
    ]) {
      W.appendBlock("S003", {
        type: "result-summary",
        title: `${report.title} · ${label}`,
        sourceModuleId: "dashboard",
        jointReportId: report.id,
        jointMetric: key,
        resultMode,
        resultId: identity,
        modelVersionId: null,
        dataVersionId: report.evidence.dataVersion,
        ontologyVersionId: report.evidence.ontologyVersion,
        text: `联合态势演示分析，非正式融资事实。${report.evidence.horizon}天窗口；${report.notes || ""}`,
        rows: report.rows.map((row) => ({
          id: row.id,
          name: row.name,
          value: row[key] === null ? null : row[key] / scale,
          unit,
          status: row.riskTier,
          evidenceRefs: [...row.loanIds, report.evidence.dataDigest],
        })),
        workspaceContext,
        evidenceRefs: [report.evidence.dataDigest, identity],
        jointSnapshot: clone(report),
        sourceTask: "situation",
      });
    }
    const saved = W.readReport("S003");
    W.saveReport("S003", { ...saved, jointImports: [...new Set([...(saved.jointImports || []), report.id])] });
    return identity;
  }
  function handle(event, frame) {
    if (
      event.origin !== location.origin ||
      event.source !== frame?.contentWindow
    )
      return false;
    const message = event.data;
    if (!String(message?.type || "").startsWith("OFW_V14_")) return false;
    try {
      if (message.type === "OFW_V14_READY") {
        const module = shell.moduleForRoute();
        adapt(frame, module);
        if (pendingReport) {
          frame.contentWindow.postMessage(
            { type: "OFW_V14_RESTORE_REPORT", report: pendingReport },
            location.origin,
          );
          pendingReport = null;
        }
        if (pendingRule) {
          frame.contentWindow.postMessage(
            { type: "OFW_V14_APPLY_OWNED_RULE", result: pendingRule },
            location.origin,
          );
          pendingRule = null;
        }
        return true;
      }
      if (message.type === "OFW_V14_VIEW_CHANGED") {
        const module = shell.moduleForRoute();
        shell.syncNavigation(frame, module);
        document.getElementById("frame-breadcrumb-current").textContent =
          taskForFrame(frame, module.id)?.label || module.name;
        return true;
      }
      if (message.type === "OFW_V14_NAVIGATE") {
        if (message.view === "ontology") {
          openOntology("S001");
          return true;
        }
        const target = owners[message.view];
        if (!target) throw new Error("无效工作区");
        open(...target);
        return true;
      }
      if (message.type === "OFW_V14_OPEN_ONTOLOGY") {
        openOntology(message.owner);
        return true;
      }
      if (message.type === "OFW_V14_NATIVE") {
        if (
          ![
            "m07",
            "query",
            "modeling",
            "data",
            "ontology",
            "report",
            "decision",
            "agent",
            "dashboard",
          ].includes(message.moduleId)
        )
          throw new Error("无效模块");
        shell.store.setActiveScenario(
          message.scenarioId === "S001" ? "S001" : "S003",
          "joint-analysis-native",
        );
        const context = nativeContext(message.scope || {});
        context.scenarioId = shell.store.get().activeScenarioId;
        open(
          message.moduleId,
          message.taskId || shell.tasks(message.moduleId)[0].id,
          context,
        );
        shell.toast(
          "已进入原业务工作区",
          "对象身份保持一致；原业务结果使用继承的数据版本，不替换为合成融资明细。",
          "info",
        );
        return true;
      }
      if (message.type === "OFW_V14_REPORT") {
        const resultId = publishReport(message.report);
        frame.contentWindow.postMessage(
          { type: "OFW_V14_REPORT_SAVED", resultId },
          location.origin,
        );
        if (message.open) {
          shell.store.setActiveScenario("S003", "joint-report");
          open("report", "catalog");
        }
        return true;
      }
    } catch (error) {
      shell.toast("交接未完成", error.message, "danger");
      frame?.contentWindow?.postMessage(
        { type: "OFW_V14_ERROR", message: error.message },
        location.origin,
      );
    }
    return true;
  }
  const base = global.OFW_V131_CATALOG;
  function returnReport(block) {
    pendingReport = clone(block.jointSnapshot);
    open("dashboard", "situation");
  }
  const additions = [
    ...(global.OFW_V14_SNAPSHOT_CATALOG?.assets || []).map((asset) => ({
      id: `ofw.v14.snapshot.${asset.key}`,
      moduleId: "data",
      taskId: "resources",
      assetId: asset.id,
      name: asset.name,
      type: "SimulatedSnapshotAsset",
      refs: [asset.snapshotId, asset.dataVersion],
      dataVersionId: asset.dataVersion,
    })),
    {
      id: "ofw.v14.joint.ontology",
      moduleId: "ontology",
      taskId: "modeling",
      ontologyRuleOwner: "S001",
      scenarioId: "S001",
      name: "融资本体 · 成本偏离规则修订",
      type: "OntologyRuleDraft",
      refs: ["ONT-ENTERPRISE-FINANCE-RISK-1.4"],
    },
    {
      id: "ofw.v14.joint.map",
      moduleId: "dashboard",
      taskId: "situation",
      name: "融资成本与债务风险联合态势",
      type: "OperationsDashboard",
      refs: ["ENT-001", "ENT-020", "/data/portfolio.json"],
    },
    {
      id: "ofw.v14.joint.plans",
      moduleId: "decision",
      taskId: "financing-plans",
      name: "融资条件独立方案推演",
      type: "SimulationWorkspace",
      refs: ["SIMULATION", "NO_EXTERNAL_EXECUTION"],
    },
  ].map((item) =>
    Object.freeze({
      ...item,
      scenarioId: item.scenarioId || "S003",
      status: "available",
      summary:
        "基于统一企业身份的增量分析资源；演示融资与历史评分保持独立来源。",
    }),
  );
  const resources = Object.freeze([...base.resources, ...additions]);
  const catalog = Object.freeze({
    ...base,
    resources,
    resourcesFor: (id) => resources.filter((item) => item.moduleId === id),
    resource: (id) => resources.find((item) => item.id === id),
  });
  global.OFW_V120_CATALOG = catalog;
  global.OFW_V131_CATALOG = catalog;
  global.OFW_V14_JOINT = Object.freeze({
    tasks,
    source,
    isJoint,
    taskForFrame,
    attach,
    open,
    openOntology,
    applyOwnedRule,
    activate,
    adapt,
    handle,
    publishReport,
    returnReport,
    additions,
  });
})(window);
