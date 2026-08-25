(() => {
  "use strict";

  const SCENARIO_SHELL_CHANNEL = "ontology3.0-scenario-shell-v1";
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : new URL(location.href);
  const scenarioRoot = new URL("../../scenarios/s003/", location.href);
  const styleUrl = new URL("./s003-scenario-adapter.css?v=20260817-03-m02-input-fix", scriptUrl);
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get("scenarioId") !== "S003") return;

  let bundle = null;
  let runtimeMode = "loading";
  let runtimeError = null;
  let notice = null;
  let hostRegistered = false;
  let formalDeliveryStarted = false;
  const context = () => {
    const source = bundle?.candidate?.scenarioIdentity || bundle?.config?.initialScenarioContext || {};
    return {
      scenarioId: "S003",
      scenarioVersion: urlParams.get("scenarioVersion") || source.scenarioVersion || "S003-v1",
      scenarioRunId: urlParams.get("scenarioRunId") || source.scenarioRunId || "—",
      baselineVersion: urlParams.get("baselineVersion") || bundle?.config?.baselineVersion || "v1.0.3",
      baselineSnapshotId: urlParams.get("baselineSnapshotId") || bundle?.config?.baselineSnapshotId || "BSL-S001-V103-DE0119608E26"
    };
  };

  function publishedVersionId() {
    const packageVersion = String(bundle?.publishedPointer?.activeTarget?.packageVersion || "1.0.2");
    return packageVersion === "1.0.1" ? "S003-M01-DEBT-RISK-V1" : `S003-M01-DEBT-RISK-V${packageVersion.replaceAll(".", "_")}`;
  }

  function redirectRetiredModelConfigRoute() {
    const retired = String(location.hash || "").match(/^#\/resources\/source\/(s003-factor-config|s003-risk-band-config|s003-enterprise-factor-input)/);
    if (!retired) return false;
    const identity = context();
    const configTab = retired[1] === "s003-risk-band-config" ? "tiers" : retired[1] === "s003-enterprise-factor-input" ? "overview" : "factors";
    const hash = `#published/version?id=${encodeURIComponent(publishedVersionId())}&tab=s003-model-config&configTab=${configTab}`;
    if (window.parent !== window) {
      window.parent.postMessage({
        channel: SCENARIO_SHELL_CHANNEL,
        operation: "navigateScenarioModule",
        moduleId: "ontology",
        hash,
        scenarioId: identity.scenarioId,
        scenarioVersion: identity.scenarioVersion,
        scenarioRunId: identity.scenarioRunId,
        sourceModule: "M02"
      }, location.origin);
    } else {
      const target = new URL("../../ontology-management-review/canvas-first/index.html", location.href);
      Object.entries(identity).forEach(([key, value]) => { if (value && value !== "—") target.searchParams.set(key, value); });
      target.hash = hash;
      location.replace(target.href);
    }
    return true;
  }

  document.documentElement.dataset.ofwScenario = "S003";
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = styleUrl.href;
  document.head.appendChild(stylesheet);

  function loadScript(url) {
    if (window.OFW_SCENARIO_CONFIGS?.S003) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url.href;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`无法读取 ${url.pathname}`));
      document.head.appendChild(script);
    });
  }
  async function readJson(relativePath) {
    const response = await fetch(new URL(relativePath, scenarioRoot), { cache: "no-store" });
    if (!response.ok) throw new Error(`${relativePath} 读取失败（${response.status}）`);
    return response.json();
  }
  function renderOverview(helpers) {
    if (!bundle) return `<section class="panel"><div class="panel-body"><div class="empty-state"><strong>S003 正式资源正在装载</strong><p>基线数据源详情保持可用。</p></div></div></section>`;
    const { source, input, candidate, quality, pipelineProjection, dataContract, publishedPointer } = bundle;
    return `<div class="detail-grid s003-native-extension"><div class="stack"><section class="panel"><div class="panel-head"><div><span class="panel-title">S003 财务来源与合同</span><p>当前工作簿只提供财务数据；原附件中的调节因子 Sheet 仅作为来源历史证据。</p></div>${helpers.badge("正式来源已登记", "success")}</div><div class="panel-body"><div class="summary-grid">${helpers.fact("来源标识", source.sourceId)}${helpers.fact("评估时点", source.assessmentAt)}${helpers.fact("币种 / 金额单位", `${source.currency} / ${source.amountUnit}`)}${helpers.fact("当前管道成员", "财务数据")}${helpers.fact("当前期 / 上期字段", `${dataContract.currentPeriodColumn || "I"} / ${dataContract.priorPeriodColumn || "AA"}`)}${helpers.fact("企业因子输入版本", input.snapshotId)}${helpers.fact("模型定义提供方", "M01 本体管理")}</div>${helpers.notice("企业当期因子以 M02 T053 不可变人工输入快照绑定本轮评估，不再提供逐户模型配置页；调节因子系数、评分权重、固定计算语义和风险分档仍由 M01 随 Published 模型版本维护。两者均不进入 Python 管道参数或数据质量规则。", "info")}</div></section><section class="panel"><div class="panel-head"><div><span class="panel-title">数据质量与正式采用</span><p>财务来源、人工输入版本、质量结果和正式 T007 均可追溯到本轮正式消费链。</p></div>${helpers.badge(quality.status === "passed" ? "消费就绪" : quality.status, quality.status === "passed" ? "success" : "warning")}</div><div class="panel-body"><div class="summary-grid">${helpers.fact("质量结果", quality.qualityResultId)}${helpers.fact("检查项", `${quality.checks.length} 项`)}${helpers.fact("当前管道运行", pipelineProjection.sourcePipelineRunId)}${helpers.fact("正式数据资产", candidate.dataAssetId)}${helpers.fact("Published 指针", publishedPointer.pointerId)}${helpers.fact("消费状态", "本体侧已正式采用")}</div>${helpers.notice(`明确排除：企业因子业务取值判定、${(quality.explicitlyExcludedChecks || []).join("、")}`, "warning", "质量检查不拥有业务模型")}</div></section></div><aside class="stack"><section class="panel"><div class="panel-head"><span class="panel-title">来源取得与运行计划</span>${helpers.badge("按需上传", "info")}</div><div class="panel-body"><div class="summary-grid">${helpers.fact("手工工作簿", "无来源同步计划")}${helpers.fact("取得方式", "按需上传形成快照")}${helpers.fact("管道运行计划", "在数据管道中独立维护")}${helpers.fact("当前快照", source.sourceId)}</div>${helpers.notice("与 v1.0.3 一致：手工工作簿不设置来源同步计划；共享文件夹的扫描/同步计划仍归数据源设置；定时、触发和正式运行计划只在数据管道中独立维护。", "info")}</div></section></aside></div>`;
  }

  // 旧调节因子/风险分档数据源页面及其工作投影已经停用；M02 不再读取、
  // 迁移或写入这些旧配置。企业当期因子保留为不可变 T053 输入版本，
  // 不暴露逐户模型配置页且不进入 Python 管道；历史浏览器原字节保持不动。

  const extension = {
    scenarioId: "S003",
    getHealth: () => ({
      moduleId: "M02",
      status: runtimeMode === "loading" ? "checking" : !bundle ? "blocked" : "healthy",
      detail: runtimeMode === "loading" ? "S003 财务来源、正式资产和管道投影正在装载。" : !bundle ? (runtimeError || "S003 数据资源未装载") : "基线数据源目录展示财务工作簿；企业当期因子绑定 M02 T053 输入快照，M01 只维护模型参数，数据管道只处理财务数据。",
      projectionIssue: runtimeError ? { reason: runtimeError, formalReadAvailable: Boolean(bundle) } : null,
      scenarioContext: context(),
      acceptanceReady: false
    }),
    managesSource: source => Boolean(bundle && source?.id === "s003-workbook"),
    sourceTabs: () => [],
    sourceActions: (source, helpers) => {
      if (source?.id === "s003-workbook") return `${helpers.button("查看修订证据","revision-evidence","soft","history")}${helpers.button("查看来源内容核验证据","quality-evidence","","shield")}${helpers.button("编辑设置","source-settings","","settings",false,'data-id="s003-workbook"')}`;
      return "";
    },
    sourceDirectoryState: source => {
      if (source?.id === "s003-workbook" && bundle) return { label: "正式来源已登记", tone: "success" };
      return null;
    },
    sourceFooterCopy: source => {
      if (source?.id === "s003-workbook" && bundle) return `正式来源 · ${bundle.source.assessmentAt} · 质量${bundle.quality.status === "passed" ? "通过" : bundle.quality.status}`;
      return "";
    },
    sourceAcquisition: source => {
      if (source?.id === "s003-workbook") return { label: "来源取得方式", value: "按需上传形成快照", settingsTitle: "来源取得设置", settingsDetail: "手工工作簿不设置来源同步计划；每次按需上传形成新的不可变快照。与 v1.0.3 一致，只有共享文件夹扫描属于数据源同步；定时、触发和正式运行计划只在数据管道中独立维护。", pipelineSchedule: "仅手工正式运行", pipelineHref: "#/pipelines/S003-M02-PIPELINE-001/canvas", pipelineLabel: "前往管道设置运行计划" };
      return null;
    },
    workbookSheetScope: source => source?.id === "s003-workbook" ? { inputSheetIds: ["s003-financial"], hideExcludedSheets: true, excludedReason: "当前数据源逻辑成员只有财务数据；原附件中的调节因子 Sheet 不在本数据源详情展示，也不作为当前管道输入。企业当期因子使用独立 T053 输入快照，不作为工作簿页签或模型配置页。" } : null,
    renderSourceTab: (source, tab, helpers) => {
      if (source?.id === "s003-workbook") {
        if (tab === "overview") return renderOverview(helpers);
        return null;
      }
      return null;
    }
  };
  window.DE_SCENARIO_EXTENSION = extension;

  function refreshHost() {
    if (!window.DE_SCENARIO_HOST) return false;
    if (bundle && !hostRegistered) hostRegistered = window.DE_SCENARIO_HOST.registerResourceBundle(bundle) === true;
    window.DE_SCENARIO_HOST.refresh();
    if (bundle && hostRegistered && !formalDeliveryStarted && typeof window.DE_SCENARIO_HOST.ensureS003FormalDelivery === "function") {
      formalDeliveryStarted = true;
      // Let the native M01 bridge finish its C033 handshake before the first
      // C003 attempt.  The helper is idempotent and preserves prior attempts.
      window.setTimeout(() => {
        window.DE_SCENARIO_HOST.ensureS003FormalDelivery().then(result => {
          if (!result?.okay) {
            formalDeliveryStarted = false;
            notice = { tone: "warning", title: "数据资产接收仍待核对", detail: result?.reason || "M01 尚未返回完整 C003 接收回执；历史资产与证据保持不变。" };
          }
          window.DE_SCENARIO_HOST.refresh();
        }).catch(error => {
          formalDeliveryStarted = false;
          notice = { tone: "warning", title: "数据资产接收结果未知", detail: error?.message || "M01 C003 联合回执尚未取得；可稍后重新读取。" };
          window.DE_SCENARIO_HOST.refresh();
        });
      }, 120);
    }
    return true;
  }
  function waitForHost() {
    if (refreshHost()) return;
    window.setTimeout(waitForHost, 16);
  }

  (async () => {
    try {
      await loadScript(new URL("integration-config.js", scenarioRoot));
      const [dataContract, source, input, candidate, quality, pipeline, sourceRegistry, pipelineProjection, publishedPointer] = await Promise.all([
        readJson("resources/m02/data-contract.v1.1.json"),
        readJson("resources/m02/source-asset.v1.json"),
        readJson("resources/m02/human-input-snapshot.v1.json"),
        readJson("resources/m02/formal-candidate-data-asset.v1.json"),
        readJson("resources/m02/quality-result.v1.json"),
        readJson("resources/m02/pipeline-run.v2.json"),
        readJson("resources/m02/source-registry.v4.json"),
        readJson("resources/m02/pipeline-current-projection.v4.json"),
        readJson("resources/m01/published-pointer.v2.json")
      ]);
      bundle = { config: window.OFW_SCENARIO_CONFIGS?.S003 || {}, dataContract, source, input, candidate, quality, pipeline, sourceRegistry, pipelineProjection, publishedPointer };
      if (redirectRetiredModelConfigRoute()) return;
      runtimeMode = "ready";
      runtimeError = null;
      refreshHost();
    } catch (error) {
      runtimeMode = "read-only-degraded";
      runtimeError = error?.message || String(error);
      notice = { tone: "danger", title: "S003 扩展资源未完整装载", detail: `${runtimeError}；基线数据工程目录、导航和通用操作仍保持可用。` };
      refreshHost();
    }
  })();
  waitForHost();
})();
