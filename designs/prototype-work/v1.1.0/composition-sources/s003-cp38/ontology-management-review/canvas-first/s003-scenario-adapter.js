(() => {
  "use strict";

  const SCENARIO_SHELL_CHANNEL = "ontology3.0-scenario-shell-v1";
  const VERSION_ID = "S003-M01-DEBT-RISK-V1";
  const ONTOLOGY_ID = "S003-M01-DEBT-RISK-PKG";
  const CONFIG_TAB = "s003-model-config";
  const MODEL_CONFIG_SECTIONS = Object.freeze([
    Object.freeze({ sectionId: "overview", label: "配置总览", groupId: "overview", groupLabel: "配置总览" }),
    Object.freeze({ sectionId: "factors", label: "调节因子配置", groupId: "adjustment-factor", groupLabel: "调节因子配置" }),
    Object.freeze({ sectionId: "weights", label: "评分权重", groupId: "scoring-weight", groupLabel: "评分权重" }),
    Object.freeze({ sectionId: "tiers", label: "风险分档配置", groupId: "risk-band", groupLabel: "风险分档配置" })
  ]);
  const QUESTION_SET_VERSION = "S003-M03-FIXED-QUESTIONS-v1.0.0";
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : new URL(location.href);
  const scenarioRoot = new URL("../../scenarios/s003/", location.href);
  const styleUrl = new URL("./s003-scenario-adapter.css?v=20260819-40-performance", scriptUrl);
  const params = new URLSearchParams(location.search);
  if (params.get("scenarioId") !== "S003") return;

  let bundle = null;
  let publishedModel = null;
  let modelConfiguration = null;
  let actionTypeCatalog = null;
  let runtimeSnapshot = null;
  let draft = null;
  let runtimeMode = "loading";
  let runtimeError = null;
  let notice = null;
  let validation = [];
  let dirty = false;
  let registeredFingerprint = null;
  let requestSequence = 0;
  let surfaceSyncFrame = 0;
  let canvasGesture = null;
  let operationInFlight = false;
  let canvasWheelHandledAt = 0;
  const canvasNodePositions = new Map();

  function versionIdFor(model) {
    // 路由可能早于异步 Published 资源装载而被驾驶舱触发。此时必须
    // 仍指向当前正式模型，而不能退回已归档的 V1 详情页。
    const packageVersion = String(model?.packageVersion || bundle?.pointer?.activeTarget?.packageVersion || "1.0.2");
    return packageVersion === "1.0.1" ? VERSION_ID : `S003-M01-DEBT-RISK-V${packageVersion.replaceAll(".", "_")}`;
  }

  function mappingVersionFor(model = publishedModel) {
    return `S003-MAPPING-${model?.packageVersion || "1.0.1"}`;
  }

  function isCurrentS003Version(version) {
    return version?.ontologyStableId === ONTOLOGY_ID && version.id === versionIdFor(publishedModel);
  }

  // 当前 Published 模型的行动口径只按风险分档亮灯。旧模型中的重大因子
  // 触发定义保留在历史资源里供只读回看，但不应继续装入当前本体画布，
  // 也不应被误读为当前 Action Type 的独立 Rule。
  function isCurrentTierOnlyModel(model = publishedModel) {
    if (!model || model.packageId !== ONTOLOGY_ID) return false;
    const parts = String(model.packageVersion || "0.0.0").split(".").map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
      && (parts[0] > 1 || (parts[0] === 1 && (parts[1] > 0 || (parts[1] === 0 && parts[2] >= 2))));
  }

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const finite = value => Number.isFinite(Number(value));
  const nowText = () => new Date().toISOString();
  const formatTime = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", hour12: false }).format(date);
  };

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

  function activeContext() {
    const formal = bundle?.pointer?.scenarioIdentity || bundle?.model?.scenarioIdentity || {};
    return {
      scenarioId: "S003",
      scenarioVersion: params.get("scenarioVersion") || formal.scenarioVersion || "S003-v1",
      scenarioRunId: params.get("scenarioRunId") || formal.scenarioRunId || "s003-awaiting-context",
      formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt") || formal.formedAt || nowText(),
      status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus") || "active"
    };
  }

  function shellRequest(operation, payload = {}) {
    if (window.parent === window) return Promise.reject(new Error("当前 M01 未运行在统一 S003 场景壳内"));
    const context = activeContext();
    const requestId = `S003-M01-${operation}-${Date.now()}-${++requestSequence}`;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error(`${operation} 等待统一场景壳响应超时`));
      }, 7000);
      function onMessage(event) {
        const message = event.data;
        if (event.origin !== location.origin || event.source !== window.parent) return;
        if (message?.channel !== SCENARIO_SHELL_CHANNEL || message?.requestId !== requestId || message?.operation !== `${operation}:response`) return;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (message.ok) resolve(message.result);
        else reject(new Error(message.error || `${operation} 未完成`));
      }
      window.addEventListener("message", onMessage);
      window.parent.postMessage({ channel: SCENARIO_SHELL_CHANNEL, operation, requestId, scenarioId: context.scenarioId, scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, sourceModule: "M01", payload }, location.origin);
    });
  }

  function lifecycle(resource, extra = {}) {
    const publishedAt = publishedModel?.publishedAt || bundle?.model?.publishedAt || bundle?.pointer?.switchedAt || "2026-08-15T13:30:00.000Z";
    return {
      ...resource,
      owner: resource.owner || "财务公司",
      publicationState: "Published",
      lifecycleState: "Published",
      businessValidityState: "生效",
      bindability: "可新绑定",
      effectiveFrom: publishedAt,
      effectiveTo: null,
      businessBasis: "confirmed",
      changeType: "新增",
      changeReason: "S003-v1 债务风险模型正式发布",
      lastChangedAt: publishedAt,
      controlledEvidenceLocator: `${bundle?.pointer?.pointerId || "S003-M01-PUBLISHED-POINTER"} / ${resource.id}`,
      applicableScenario: "S003 债务风险监测",
      replaces: [],
      replacedBy: [],
      ...extra
    };
  }

  function metricResources(model) {
    return (model.indicatorOrder || []).map((name, index) => lifecycle({
      id: `S003-METRIC-${String(index + 1).padStart(2, "0")}`,
      name,
      type: "Metric",
      unit: "分",
      scope: "企业 × 评估时点",
      sourceObjectId: "S003-OBJ-DEBT-RISK-ENTERPRISE",
      subjectObjectId: "S003-OBJ-DEBT-RISK-ENTERPRISE",
      definition: `${name}的债务风险评分指标，按当前 Published 模型公式计算。`,
      calculation: model.formulas?.[name] || "按 Published 公式计算",
      time: model.assessment?.assessmentAt || bundle?.candidate?.assessmentAt || "2025-12-31",
      zeroHandling: name === "盈利稳定性" ? "盈利历史不足按 A 档（100 分）" : "非法值阻断；适用但缺失不得由 M01 静默补值",
      dependencyIds: []
    }));
  }

  function ruleResources(model) {
    const tierRules = (model.riskTiers || []).map((tier, index) => lifecycle({
      id: `S003-RULE-RISK-${tier.tierId || String(index + 1).padStart(2, "0")}`,
      code: `RISK_${tier.tierId || String(index + 1).padStart(2, "0")}`,
      name: `风险分档：${tier.name}`,
      type: "Rule",
      appliesTo: "债务风险评估企业",
      objectId: "S003-OBJ-DEBT-RISK-ENTERPRISE",
      metricIds: ["S003-METRIC-FINAL-SCORE"],
      condition: tier.maxExclusive == null ? `综合得分 ≥ ${tier.minInclusive}` : `${tier.minInclusive} ≤ 综合得分 < ${tier.maxExclusive}`,
      definition: `将企业综合风险得分划入${tier.name}。`,
      validity: "随当前 Published 模型版本生效",
      testSample: "覆盖阈值边界、连续性与无重叠检查",
      decisionRefs: ["Q026"]
    }));
    const triggerRules = [
      {
        id: "S003-RULE-MAJOR-LITIGATION",
        code: "MAJOR_LITIGATION",
        name: "重大诉讼风险触发",
        condition: "企业因子“是否存在重大诉讼”命中重大诉讼档位",
        definition: "识别需要形成行动候选的重大诉讼风险事件。"
      },
      {
        id: "S003-RULE-CURRENT-FUND-GAP",
        code: "CURRENT_FUND_GAP",
        name: "当月资金缺口风险触发",
        condition: "企业因子“资金余缺预警”命中当月资金余缺预警",
        definition: "识别需要立即关注并形成行动候选的当月资金缺口。"
      }
    ].map(item => lifecycle({
      ...item,
      type: "Rule",
      appliesTo: "债务风险评估企业",
      objectId: "S003-OBJ-DEBT-RISK-ENTERPRISE",
      metricIds: ["S003-METRIC-FINAL-SCORE"],
      validity: "随当前 Published 模型版本生效",
      testSample: "显式命中、未命中与不适用样例",
      decisionRefs: ["Q026"]
    }));
    return isCurrentTierOnlyModel(model) ? tierRules : [...tierRules, ...triggerRules];
  }

  function actionRuleIds(action, model) {
    const ids = [];
    if (action.triggerTier) ids.push(`S003-RULE-RISK-${action.triggerTier}`);
    if (!isCurrentTierOnlyModel(model)) (action.triggerFactors || []).forEach(trigger => {
      if (String(trigger).includes("诉讼")) ids.push("S003-RULE-MAJOR-LITIGATION");
      if (String(trigger).includes("资金余缺") || String(trigger).includes("资金缺口")) ids.push("S003-RULE-CURRENT-FUND-GAP");
    });
    return [...new Set(ids)];
  }

  function actionResources(model) {
    return (model.actionTypes || []).map((action, index) => lifecycle({
      id: action.actionTypeId || `S003-ACTION-${String(index + 1).padStart(2, "0")}`,
      name: actionTypeCatalog?.actionTypes?.find(item => item.actionTypeId === action.actionTypeId)?.displayName || action.actionTypeId,
      type: "Action Type",
      target: "债务风险评估企业",
      targetObjectId: "S003-OBJ-DEBT-RISK-ENTERPRISE",
      triggerTier: action.triggerTier || null,
      triggerFactors: clone(action.triggerFactors || []),
      definition: "集团债务风险管理人员从驾驶舱提交后，先形成通用 Action Request 并送达对应成员单位债务风险接口人；接口人确认并选择负责人后，才形成负责人待办。",
      submissionActor: "集团债务风险管理人员",
      recipientRole: "成员单位债务风险接口人",
      parameters: "企业、风险等级、触发证据、成员单位接口人、负责人（确认后）",
      prerequisite: "Published 风险事实可追溯且用户完成人工确认",
      result: "先形成 Action Request；接口人确认并选择负责人后形成负责人待办",
      confirmation: action.requiresHumanConfirmation === false ? "否" : "必须人工确认",
      failure: "缺少 Published 事实或人工确认时不形成 Action Request",
      defaultDue: "由通用决策中心规则确定",
      ruleIds: actionRuleIds(action, model),
      linkIds: []
    }));
  }

  function objectResources() {
    const properties = [
      ["S003-PROP-ENTERPRISE-ID", "企业标识", "文本", "身份", "否"],
      ["S003-PROP-ENTERPRISE-NAME", "企业名称", "文本", "标题", "否"],
      ["S003-PROP-ENTERPRISE-CATEGORY", "企业类别", "枚举", "普通属性", "否"],
      ["S003-PROP-ASSESSMENT-AT", "评估时点", "日期", "普通属性", "否"],
      ["S003-PROP-FINAL-SCORE", "综合风险得分", "数值", "普通属性", "否"],
      ["S003-PROP-RISK-TIER", "风险分档", "枚举", "普通属性", "否"]
    ].map(([id, name, dataType, role, nullable]) => lifecycle({ id, name, dataType, unit: name.includes("得分") ? "分" : "无", role, nullable, definition: `债务风险评估企业的${name}。`, parentId: "S003-OBJ-DEBT-RISK-ENTERPRISE", parentName: "债务风险评估企业", memberId: "S003-MEMBER-FINANCIAL" }));
    const object = lifecycle({ id: "S003-OBJ-DEBT-RISK-ENTERPRISE", name: "债务风险评估企业", definition: "在同一评估时点形成财务指标、调节因子、风险评分、分档与报告的集团所属企业。", identity: "S003-PROP-ENTERPRISE-ID", title: "S003-PROP-ENTERPRISE-NAME", memberId: "S003-MEMBER-FINANCIAL", count: bundle?.candidate?.enterpriseCount || 21, objectKind: "业务实体", linkEndpointFields: [], properties });
    return { object, properties };
  }

  function positionsFor(version) {
    const positions = {};
    (version.objects || []).forEach((resource, index) => { positions[resource.id] = [50, 430 + index * 150]; });
    const finalMetric = (version.metrics || []).find(resource => resource.id === "S003-METRIC-FINAL-SCORE") || null;
    const sourceMetrics = (version.metrics || []).filter(resource => resource !== finalMetric);
    sourceMetrics.forEach((resource, index) => { positions[resource.id] = [280 + (index % 4) * 210, 50 + Math.floor(index / 4) * 205]; });
    if (finalMetric) positions[finalMetric.id] = [955, 865];
    const riskRules = (version.rules || []).filter(resource => resource.id.startsWith("S003-RULE-RISK-"));
    const triggerRules = (version.rules || []).filter(resource => !resource.id.startsWith("S003-RULE-RISK-"));
    riskRules.forEach((resource, index) => { positions[resource.id] = [1190 + (index % 2) * 310, 260 + Math.floor(index / 2) * 175]; });
    triggerRules.forEach((resource, index) => { positions[resource.id] = [1190 + index * 310, 650]; });
    (version.actions || []).forEach((resource, index) => { positions[resource.id] = [1770, 120 + index * 205]; });
    return positions;
  }

  function buildVersion(model) {
    const pointer = bundle.pointer;
    const formalContext = clone(activeContext());
    const sourcePublishedContext = clone(pointer.scenarioIdentity || model.scenarioIdentity || bundle.results?.scenarioIdentity || null);
    const versionId = versionIdFor(model);
    const basedOnPackageVersion = model.provenance?.basedOnVersion || null;
    const basedOnVersionId = basedOnPackageVersion ? versionIdFor({ packageVersion: basedOnPackageVersion }) : null;
    const publishedAt = model.publishedAt || pointer.switchedAt || formalContext.formedAt;
    const { object, properties } = objectResources();
    const metrics = metricResources(model);
    metrics.push(lifecycle({ id: "S003-METRIC-FINAL-SCORE", name: "综合风险得分", type: "Metric", unit: "分", scope: "企业 × 评估时点", sourceObjectId: "S003-OBJ-DEBT-RISK-ENTERPRISE", subjectObjectId: "S003-OBJ-DEBT-RISK-ENTERPRISE", definition: "财务原始得分叠加调节因子后的最终风险评分。", calculation: "round(clamp(rawScore × (1 + factorSum), 0, 100), 2)", time: bundle.candidate.assessmentAt, zeroHandling: "非法或越界值阻断", dependencyIds: metrics.map(item => item.id) }));
    const version = {
      id: versionId,
      ontologyStableId: ONTOLOGY_ID,
      refreshTargetStableId: "S003-T054-DEBT-RISK-REFRESH-TARGET",
      name: "企业债务风险评估模型",
      definition: "面向集团债务风险管理人员，对企业财务表现和业务调节因子形成 Published 风险评分、分档和处置建议。",
      scenario: "S003 债务风险监测",
      scenarioContext: formalContext,
      semanticVersion: `V${String(model.packageVersion || pointer.pointerVersion || "1.0.1")}`,
      packageVersion: model.packageVersion || pointer.pointerVersion,
      status: "Published",
      publicationState: "Published",
      lifecycleState: "Published",
      businessValidityState: "生效",
      owner: "M01 本体管理",
      bindability: "可新绑定",
      effectiveFrom: publishedAt,
      effectiveTo: null,
      replacementDeclaration: "无",
      publishedAt,
      lastChangedAt: publishedAt,
      sourceDraftId: model.provenance?.sourceDraftId || null,
      sourceDraftName: "S003 正式模型包",
      sourceDeliveryId: bundle.candidate.dataAssetId,
      draftRevision: Math.max(1, Number(String(model.packageVersion || "1.0.1").split(".").at(-1)) || 1),
      basedOnVersion: basedOnPackageVersion ? `V${basedOnPackageVersion}` : null,
      basedOnVersionId,
      changeSummary: basedOnPackageVersion
        ? `基于 V${basedOnPackageVersion} 发布模型配置 V${model.packageVersion}`
        : "S003-v1 债务风险模型正式发布",
      sourcePublishedScenarioContext: sourcePublishedContext,
      objects: [object], properties, links: [], metrics, rules: ruleResources(model), actions: actionResources(model),
      dataContract: {
        mappingVersionId: mappingVersionFor(model),
        assetId: "S003-T006-DEBT-RISK-ASSET",
        assetName: "债务风险正式候选数据资产",
        assetVersion: bundle.candidate.dataAssetId || bundle.candidate.dataAssetVersion || "1.0.0",
        asOf: bundle.candidate.assessmentAt,
        publicationState: "已发布",
        scope: "1 个财务资产成员 · 0 条资产成员关系（已冻结）",
        purpose: "支撑 S003 Published 风险模型评估",
        consumptionRestriction: "仅供 M01 Published 生命周期采用；M02 不计算评分",
        sourceChain: [bundle.source.fileName, bundle.pipeline.pipelineRunId, bundle.quality.qualityResultId, bundle.candidate.dataAssetId, `M01 模型配置 V${model.packageVersion}`],
        members: [
          {
            id: "S003-MEMBER-FINANCIAL",
            name: "财务数据",
            grain: "一家企业在一个评估时点的财务事实",
            identity: "企业编号",
            rows: bundle.candidate.enterpriseCount,
            rowCount: bundle.candidate.enterpriseCount,
            fields: [
              ["企业编号", "文本", "S003-ENT-001", "S003-FIELD-ENTERPRISE-ID"],
              ["单位名称", "文本", "风电测试公司01", "S003-FIELD-ENTERPRISE-NAME"],
              ["评估时点", "日期", bundle.candidate.assessmentAt, "S003-FIELD-ASSESSMENT-AT"],
              ["币种", "枚举", "CNY", "S003-FIELD-CURRENCY"],
              ["金额单位", "文本", "元", "S003-FIELD-AMOUNT-UNIT"]
            ]
          }
        ],
        relations: [], objectMappings: [], linkMappings: []
      },
      validationSnapshot: { status: "passed", checkedAt: model.publishedAt || pointer.switchedAt || formalContext.formedAt, scopeSummary: "Metric、业务判断 Rule、Action Type、权重、系数、阈值与固定计算语义", groups: ["稳定身份", "模型参数", "风险阈值", "Owner 边界"].map(name => ({ name, status: "passed" })), mapping: { complete: true, detail: "S003 财务数据合同与 Published 模型指针已锁定" }, resourceManifest: [] },
      resourceManifestSnapshot: { versionId, semanticVersion: `V${String(model.packageVersion || pointer.pointerVersion || "1.0.1")}`, capturedAt: model.publishedAt || pointer.switchedAt || formalContext.formedAt, resources: [] }
    };
    version.positions = positionsFor(version);
    version.validationSnapshot.resourceManifest = [...version.objects, ...version.properties, ...version.metrics, ...version.rules, ...version.actions].map(item => ({ id: item.id, name: item.name, status: "passed" }));
    version.resourceManifestSnapshot.resources = version.validationSnapshot.resourceManifest.map(item => ({ ...item, publicationState: "Published", businessValidityAtPublish: "生效", owner: "财务公司", capturedAt: version.publishedAt }));
    return version;
  }

  function candidateValidationReferenceFor(version) {
    const evidenceId = bundle?.queryResults?.resultSetId || "S003-M03-QUERY-RESULTS-20260815-001";
    return {
      ...clone(version.scenarioContext),
      sourceModule: "智能问数",
      contractCode: "C008",
      decisionRef: "D064",
      status: "passed",
      semanticVersionId: version.id,
      semanticVersion: version.semanticVersion,
      dataVersion: bundle.candidate.dataAssetId,
      asOf: bundle.candidate.assessmentAt,
      runId: evidenceId,
      questionSetVersion: QUESTION_SET_VERSION,
      checkedAt: bundle?.queryResults?.formedAt || version.publishedAt,
      evidenceLocator: `智能问数 / ${evidenceId} / 候选固定题验证`
    };
  }

  function bindingFor(version) {
    const validationReference = candidateValidationReferenceFor(version);
    return { ...clone(version.scenarioContext), semanticVersion: version.semanticVersion, dataVersion: bundle.candidate.dataAssetId, asOf: bundle.candidate.assessmentAt, switchedAt: version.publishedAt || bundle.pointer.switchedAt, candidateKey: `${version.id}|${bundle.candidate.dataAssetId}|${bundle.candidate.assessmentAt}`, candidateValidationReference: validationReference, validationEvidenceRef: validationReference.evidenceLocator, questionSetVersion: validationReference.questionSetVersion, adoptionRecordId: "S003-M01-RECORD-ADOPT", adoptionEvidenceLocator: bundle.pointer.pointerId };
  }

  function recordsFor(version) {
    const validationReference = candidateValidationReferenceFor(version);
    return [
      { id: `S003-M01-RECORD-PUBLISH-${version.packageVersion}`, title: "语义版本已发布", detail: `S003 风险模型 ${version.packageVersion} 已形成不可变模型快照。`, status: "成功", tone: "green", time: version.publishedAt, semanticVersionId: version.id, semanticVersion: version.semanticVersion, scenarioContext: clone(version.scenarioContext), evidenceCode: bundle.pointer.pointerId, formsContract: true },
      { id: "S003-M01-RECORD-C029-MATCH", title: "数据与 Published 模型精确匹配", detail: `${bundle.candidate.dataAssetId}、${version.semanticVersion}、${mappingVersionFor(publishedModel)} 与同一场景运行身份一致。`, status: "成功", tone: "green", time: version.publishedAt, semanticVersionId: version.id, semanticVersion: version.semanticVersion, scenarioContext: clone(version.scenarioContext), dataVersion: bundle.candidate.dataAssetId, contractCode: "C029", evidenceCode: `${bundle.pointer.pointerId}/C029`, formsContract: true },
      { id: "S003-M01-RECORD-T018-ELIGIBLE", title: "候选具备消费验证资格", detail: "质量、成员范围、评估时点与来源映射已锁定，可进入固定题验证。", status: "成功", tone: "green", time: version.publishedAt, semanticVersionId: version.id, semanticVersion: version.semanticVersion, scenarioContext: clone(version.scenarioContext), dataVersion: bundle.candidate.dataAssetId, resourceRef: "T018", evidenceCode: `${bundle.pointer.pointerId}/T018`, formsContract: true },
      { id: "S003-M01-RECORD-C008-VALIDATION", title: "智能问数候选固定题验证通过", detail: `${QUESTION_SET_VERSION} 已对当前精确双版本完成只读验证。`, status: "验证通过", tone: "green", time: validationReference.checkedAt, sourceModule: "智能问数", semanticVersionId: version.id, semanticVersion: version.semanticVersion, scenarioContext: clone(version.scenarioContext), dataVersion: bundle.candidate.dataAssetId, externalValidationContractRef: "C008", externalRunId: validationReference.runId, externalEvidenceRef: validationReference.evidenceLocator, decisionRef: "D064", externalValidationSnapshot: clone(validationReference), evidenceCode: validationReference.evidenceLocator, formsContract: false },
      { id: "S003-M01-RECORD-ADOPT", title: "正式数据组合已锁定", detail: `${bundle.candidate.dataAssetId} · 截至 ${bundle.candidate.assessmentAt}。`, status: "成功", tone: "green", time: version.publishedAt || bundle.pointer.switchedAt, semanticVersionId: version.id, semanticVersion: version.semanticVersion, scenarioContext: clone(version.scenarioContext), dataVersion: bundle.candidate.dataAssetId, candidateKey: `${version.id}|${bundle.candidate.dataAssetId}|${bundle.candidate.assessmentAt}`, resourceRef: "T019", contractCode: "C008", evidenceCode: bundle.pointer.pointerId, formsContract: true }
    ];
  }

  function fingerprint(model) { return `${model.packageId}|${model.packageVersion}|${bundle.pointer.pointerVersion}|${activeContext().scenarioRunId}`; }

  function stableFingerprintValue(value) {
    if (Array.isArray(value)) return value.map(stableFingerprintValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableFingerprintValue(value[key]);
      return result;
    }, {});
  }

  function modelConfigurationFingerprint(model) {
    if (!model?.packageId || !model?.weights || !Array.isArray(model?.factors) || !Array.isArray(model?.riskTiers)) return null;
    const text = JSON.stringify(stableFingerprintValue({
      packageId: model.packageId,
      resourceType: model.resourceType,
      indicatorOrder: model.indicatorOrder,
      weights: model.weights,
      factors: model.factors,
      riskTiers: model.riskTiers,
      formulas: model.formulas,
      scoreAnchors: model.scoreAnchors,
      profitStability: model.profitStability,
      actionTypes: model.actionTypes,
      assessment: model.assessment
    }));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `S003-MODEL-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function registerPublished() {
    const host = window.ONTOLOGY_SCENARIO_HOST;
    if (!host || !bundle || !publishedModel) return false;
    const nextFingerprint = fingerprint(publishedModel);
    if (registeredFingerprint === nextFingerprint) return true;
    const version = buildVersion(publishedModel);
    const registered = host.registerPublishedVersion({ context: activeContext(), version, binding: bindingFor(version), records: recordsFor(version), currentFormal: true });
    if (registered) {
      registeredFingerprint = nextFingerprint;
      host.ensureRefreshTarget?.(version.id);
    }
    scheduleScenarioSurfaceSync();
    return registered;
  }

  function waitForHost() { if (!registerPublished()) window.setTimeout(waitForHost, 20); }

  function currentRoute() {
    return String(location.hash || "#modeling").replace(/^#\/?/, "").split("?")[0] || "modeling";
  }

  function currentHashParams() {
    const query = String(location.hash || "").split("?")[1] || "";
    return new URLSearchParams(query);
  }

  function publishedSummaryFingerprint() {
    return [
      publishedModel?.packageVersion || "loading",
      runtimeMode,
      runtimeError || "",
      bundle?.candidate?.dataAssetId || "",
      bundle?.candidate?.assessmentAt || "",
      activeContext().scenarioRunId
    ].join("|");
  }

  function renderModelingPublishedSummary() {
    const fingerprintValue = publishedSummaryFingerprint();
    if (!publishedModel || !bundle) {
      const blocked = runtimeMode === "read-only-degraded" && runtimeError;
      return `<section class="panel s003-m01-modeling-summary ${blocked ? "is-blocked" : "is-loading"}" data-s003-m01-modeling-summary data-fingerprint="${esc(fingerprintValue)}"><div class="panel-head"><div><h2>当前已发布债务风险本体</h2><p>正在读取已发布模型、资源版本和当前数据绑定。</p></div><span class="status ${blocked ? "red" : "blue"}">${blocked ? "装载失败" : "正在装载"}</span></div><div class="panel-body"><div class="s003-m01-modeling-message"><b>${blocked ? "S003 正式资源未能装入" : "正在读取 Published 指针与模型包"}</b><span>${esc(blocked ? runtimeError : "请稍候。")}</span></div></div></section>`;
    }
    const metricCount = (publishedModel.indicatorOrder || []).length + 1;
    const ruleCount = ruleResources(publishedModel).length;
    const actionCount = (publishedModel.actionTypes || []).length;
    const draftWarning = runtimeMode === "read-only-degraded" && runtimeError;
    return `<section class="panel s003-m01-modeling-summary ${draftWarning ? "has-warning" : ""}" data-s003-m01-modeling-summary data-fingerprint="${esc(fingerprintValue)}"><div class="panel-head"><div><span class="s003-m01-eyebrow">S003 · 当前正式语义资源</span><h2>企业债务风险评估模型</h2><p>已发布模型可用于风险评估、问数、决策和报告消费。</p></div><div class="s003-m01-published-state"><span class="status green">Published</span><b>V${esc(publishedModel.packageVersion)}</b></div></div><div class="panel-body"><div class="s003-m01-published-facts"><div><span>资源构成</span><b>1 Object · ${metricCount} Metric</b><small>${ruleCount} Rule · ${actionCount} Action Type</small></div><div><span>正式数据资产</span><b>${esc(bundle.candidate.dataAssetId)}</b><small>${esc(bundle.candidate.enterpriseCount || 21)} 家企业 · 截至 ${esc(bundle.candidate.assessmentAt)}</small></div><div><span>模型权威指针</span><b>${esc(bundle.pointer.pointerId)}</b><small>当前版本 V${esc(publishedModel.packageVersion)}</small></div><div><span>配置状态</span><b>${draftWarning ? "当前只读" : runtimeMode === "ready" ? "可编辑" : "正在连接"}</b><small>${draftWarning ? "已发布版本仍可正常查看" : "修改后需校验并发布新版本"}</small></div></div>${draftWarning ? `<div class="s003-m01-modeling-warning"><b>当前配置暂不可编辑</b><span>${esc(runtimeError)}。已发布本体、资源、版本和画布仍可查看。</span></div>` : ""}<div class="s003-m01-modeling-actions"><button class="btn" data-s003-m01-open-version="resources">查看已发布资源</button><button class="btn" data-s003-m01-open-version="overview">查看版本详情</button><button class="btn primary" data-s003-m01-open-version="canvas">在画布中查看</button></div></div></section>`;
  }

  function replaceOrInsertAfter(anchor, current, markup) {
    const fragment = document.createRange().createContextualFragment(markup);
    const next = fragment.firstElementChild;
    if (!next) return;
    if (current) current.replaceWith(next);
    else anchor.after(next);
  }

  function syncModelingPublishedSummary() {
    if (currentRoute() !== "modeling") return;
    const home = document.querySelector(".page-scroll.ontology-home");
    const anchor = home?.querySelector(":scope > .lifecycle-tabs");
    if (!home || !anchor) return;
    const current = home.querySelector(":scope > [data-s003-m01-modeling-summary]");
    const fingerprintValue = publishedSummaryFingerprint();
    if (current?.dataset.fingerprint === fingerprintValue) return;
    replaceOrInsertAfter(anchor, current, renderModelingPublishedSummary());
  }

  function publishedCanvasKey(scroll) {
    const versionId = currentHashParams().get("id") || versionIdFor(publishedModel);
    const view = scroll?.closest(".published-canvas-panel")?.querySelector(".published-canvas-switch .active")?.textContent?.includes("沿袭") ? "lineage" : "semantic";
    return `${versionId}|${view}`;
  }

  function publishedCanvasScale(world) {
    const matched = String(world?.style?.transform || "").match(/scale\(([^)]+)\)/);
    const value = Number(matched?.[1] || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function applyPublishedNodePositions(scroll) {
    const world = scroll?.querySelector(".published-canvas-world");
    const saved = canvasNodePositions.get(publishedCanvasKey(scroll));
    if (!world || !saved?.size) return;
    world.querySelectorAll(":scope > .canvas-node").forEach(node => {
      const position = saved.get(node.dataset.node);
      if (!position) return;
      node.style.left = `${position[0]}px`;
      node.style.top = `${position[1]}px`;
    });
    updatePublishedEdges(world);
  }

  function updatePublishedEdges(world) {
    const groups = [...(world?.querySelectorAll(":scope > .edge-layer .edge") || [])];
    const nodes = [...(world?.querySelectorAll(":scope > .canvas-node") || [])];
    groups.forEach(group => {
      const path = group.querySelector(":scope > path");
      const from = nodes.find(node => node.dataset.node === group.dataset.from);
      const to = nodes.find(node => node.dataset.node === group.dataset.to);
      if (!from || !to || !path || from === to) { group.style.display = "none"; return; }
      const a = { left: parseFloat(from.style.left), top: parseFloat(from.style.top), width: from.offsetWidth, height: from.offsetHeight };
      const b = { left: parseFloat(to.style.left), top: parseFloat(to.style.top), width: to.offsetWidth, height: to.offsetHeight };
      if (!Object.values(a).concat(Object.values(b)).every(Number.isFinite) || !a.width || !a.height || !b.width || !b.height) { group.style.display = "none"; return; }
      group.style.display = "";
      a.cx = a.left + a.width / 2; a.cy = a.top + a.height / 2; b.cx = b.left + b.width / 2; b.cy = b.top + b.height / 2;
      const dx = b.cx - a.cx; const dy = b.cy - a.cy;
      let x1; let y1; let x2; let y2; let c1x; let c1y; let c2x; let c2y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const direction = dx >= 0 ? 1 : -1;
        x1 = direction > 0 ? a.left + a.width : a.left; y1 = a.cy; x2 = direction > 0 ? b.left : b.left + b.width; y2 = b.cy;
        const span = Math.max(1, Math.abs(x2 - x1) * .42); c1x = x1 + direction * span; c1y = y1; c2x = x2 - direction * span; c2y = y2;
      } else {
        const direction = dy >= 0 ? 1 : -1;
        x1 = a.cx; y1 = direction > 0 ? a.top + a.height : a.top; x2 = b.cx; y2 = direction > 0 ? b.top : b.top + b.height;
        const span = Math.max(1, Math.abs(y2 - y1) * .42); c1x = x1; c1y = y1 + direction * span; c2x = x2; c2y = y2 - direction * span;
      }
      path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
      const label = group.querySelector(".edge-label");
      if (label) {
        const t = Math.max(.2, Math.min(.8, Number(group.dataset.labelT) || .5)); const mt = 1 - t;
        const x = mt ** 3 * x1 + 3 * mt ** 2 * t * c1x + 3 * mt * t ** 2 * c2x + t ** 3 * x2;
        const y = mt ** 3 * y1 + 3 * mt ** 2 * t * c1y + 3 * mt * t ** 2 * c2y + t ** 3 * y2;
        label.setAttribute("transform", `translate(${x} ${y})`);
      }
    });
  }

  function syncPublishedCanvasEnhancement() {
    if (currentRoute() !== "published/version" || currentHashParams().get("tab") !== "canvas") return;
    const requestedVersion = currentHashParams().get("id");
    if (!publishedModel || requestedVersion !== versionIdFor(publishedModel)) return;
    const panel = document.querySelector(".published-canvas-panel");
    const scroll = panel?.querySelector(".published-canvas-scroll");
    const controls = panel?.querySelector(".published-canvas-zoom");
    if (!panel || !scroll || !controls) return;
    panel.dataset.s003M01CanvasEnhanced = "true";
    if (!controls.querySelector("[data-s003-m01-canvas-fit]")) {
      const fit = document.createElement("button"); fit.type = "button"; fit.dataset.s003M01CanvasFit = "true"; fit.textContent = "适配视图";
      const reset = document.createElement("button"); reset.type = "button"; reset.dataset.s003M01CanvasResetLayout = "true"; reset.textContent = "回到起点";
      controls.append(fit, reset);
    }
    const note = panel.querySelector(".published-canvas-note");
    if (note && !note.querySelector(".s003-m01-canvas-help")) {
      const help = document.createElement("span"); help.className = "s003-m01-canvas-help"; help.textContent = "拖动空白区域平移，滚轮缩放；点击节点查看资源或沿袭详情。视图操作不会改写 Published 快照。"; note.append(help);
    }
    applyPublishedNodePositions(scroll);
  }

  function scheduleScenarioSurfaceSync() {
    if (surfaceSyncFrame) return;
    surfaceSyncFrame = requestAnimationFrame(() => {
      surfaceSyncFrame = 0;
      syncModelingPublishedSummary();
      syncPublishedCanvasEnhancement();
    });
  }

  function fitPublishedCanvas() {
    const scroll = document.querySelector(".published-canvas-scroll");
    const world = scroll?.querySelector(".published-canvas-world");
    const nodes = [...(world?.querySelectorAll(":scope > .canvas-node") || [])];
    if (!scroll || !world || !nodes.length) return;
    const boxes = nodes.map(node => ({ left: parseFloat(node.style.left), top: parseFloat(node.style.top), right: parseFloat(node.style.left) + node.offsetWidth, bottom: parseFloat(node.style.top) + node.offsetHeight })).filter(box => Object.values(box).every(Number.isFinite));
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map(box => box.left)); const minY = Math.min(...boxes.map(box => box.top));
    const maxX = Math.max(...boxes.map(box => box.right)); const maxY = Math.max(...boxes.map(box => box.bottom));
    const desired = Math.max(.5, Math.min(1, (scroll.clientWidth - 70) / Math.max(1, maxX - minX), (scroll.clientHeight - 70) / Math.max(1, maxY - minY)));
    const adjust = () => {
      const nextScroll = document.querySelector(".published-canvas-scroll"); const nextWorld = nextScroll?.querySelector(".published-canvas-world");
      if (!nextScroll || !nextWorld) return;
      const current = publishedCanvasScale(nextWorld);
      const action = current > desired + .04 ? "out" : current < desired - .12 ? "in" : null;
      if (action) {
        nextScroll.closest(".published-canvas-panel")?.querySelector(`[data-action="published-canvas-zoom:${action}"]`)?.click();
        requestAnimationFrame(adjust); return;
      }
      nextScroll.scrollLeft = Math.max(0, ((minX + maxX) / 2) * current - nextScroll.clientWidth / 2);
      nextScroll.scrollTop = Math.max(0, ((minY + maxY) / 2) * current - nextScroll.clientHeight / 2);
    };
    adjust();
  }

  function finishCanvasGesture(event) {
    if (!canvasGesture || (event.pointerId != null && event.pointerId !== canvasGesture.pointerId)) return;
    const gesture = canvasGesture; canvasGesture = null;
    if (gesture.type === "node") {
      gesture.node.classList.remove("s003-m01-node-dragging");
      if (gesture.moved) {
        const positions = canvasNodePositions.get(gesture.key) || new Map();
        positions.set(gesture.node.dataset.node, [parseFloat(gesture.node.style.left), parseFloat(gesture.node.style.top)]);
        canvasNodePositions.set(gesture.key, positions);
        window.setTimeout(() => { if (gesture.action) gesture.node.setAttribute("data-action", gesture.action); }, 0);
      } else if (gesture.action) gesture.node.setAttribute("data-action", gesture.action);
    } else gesture.scroll.classList.remove("s003-m01-canvas-panning");
  }

  function freshDraft(model = publishedModel) {
    return { schemaVersion: "ofw.s003.m01.configuration-draft.v3", proposedVersion: model.packageVersion, weights: clone(model.weights || {}), factors: clone(model.factors || []), riskTiers: clone(model.riskTiers || []), updatedAt: null, validatedAt: null };
  }

  function normalizeModelConfiguration(configuration) {
    const source = clone(configuration || {});
    const configured = new Map((Array.isArray(source.sections) ? source.sections : []).filter(item => item?.sectionId).map(item => [item.sectionId, item]));
    source.sections = MODEL_CONFIG_SECTIONS.map(definition => ({
      ...clone(definition),
      ...clone(configured.get(definition.sectionId) || {}),
      sectionId: definition.sectionId,
      label: definition.label,
      groupId: definition.groupId,
      groupLabel: definition.groupLabel
    }));
    delete source.excludedSubTabs;
    return source;
  }

  function hydrateDraft(snapshot) {
    const source = snapshot?.configDraft;
    const base = freshDraft(snapshot?.publishedModel || publishedModel);
    if (!source) return base;
    return { ...base, ...clone(source), proposedVersion: source.proposedVersion || source.packageVersion || base.proposedVersion, weights: clone(source.weights || base.weights), factors: clone(source.factors || base.factors), riskTiers: clone(source.riskTiers || base.riskTiers), updatedAt: source.changedAt || source.updatedAt || null, validatedAt: snapshot?.configValidation?.ok ? snapshot.configValidation.validatedAt : source.validatedAt || null };
  }

  function weightSum(values) { return (values || []).reduce((sum, value) => sum + Number(value || 0), 0); }
  function readOnly() { return activeContext().status !== "active" || runtimeMode !== "ready"; }
  function noticeHtml() { return notice ? `<div class="s003-m01-notice ${esc(notice.tone || "info")}"><strong>${esc(notice.title)}</strong><span>${esc(notice.detail)}</span></div>` : ""; }

  function renderWeights(disabled) {
    const indicators = publishedModel.indicatorOrder || [];
    return `<div class="s003-m01-weight-grid">${Object.entries(draft.weights || {}).map(([category, weights]) => `<article class="s003-m01-config-card"><header><div><span>评分权重</span><h3>${esc(category)}</h3></div><b class="${Math.abs(weightSum(weights) - 100) < .001 ? "ok" : "bad"}">${weightSum(weights).toFixed(0)}%</b></header><div class="s003-m01-table"><table><thead><tr><th>Metric</th><th>公式</th><th>权重</th></tr></thead><tbody>${indicators.map((indicator, index) => `<tr><td>${esc(indicator)}</td><td>${esc(publishedModel.formulas?.[indicator] || "按 Published 定义")}</td><td><label><input type="number" min="0" max="100" step="1" value="${esc(weights[index] ?? 0)}" data-s003-m01-weight data-category="${esc(category)}" data-index="${index}" ${disabled}/><span>%</span></label></td></tr>`).join("")}</tbody></table></div></article>`).join("")}</div>`;
  }

  function renderFactors(disabled) {
    return `<div class="s003-m01-factor-grid">${(draft.factors || []).map((factor, factorIndex) => `<article class="s003-m01-config-card"><header><div><span>调节因子系数</span><h3>${esc(factor.name)}</h3></div><small>${esc((factor.applicableCategories || []).join(" / "))}</small></header><div class="s003-m01-table compact"><table><thead><tr><th>分档</th><th>标准</th><th>系数</th></tr></thead><tbody>${(factor.tiers || []).map((tier, tierIndex) => `<tr><td>${esc(tier.tierId)}</td><td>${esc(tier.label)}</td><td><input type="number" min="-1" max="1" step="0.01" value="${esc(tier.coefficient)}" data-s003-m01-factor data-factor-index="${factorIndex}" data-tier-index="${tierIndex}" ${disabled}/></td></tr>`).join("")}</tbody></table></div></article>`).join("")}</div>`;
  }

  function renderTiers(disabled) {
    return `<div class="s003-m01-tier-grid">${(draft.riskTiers || []).map((tier, index) => `<article><span>${esc(tier.tierId)}</span><strong>${esc(tier.name)}</strong><label>下界（含）<input type="number" min="0" max="100" value="${esc(tier.minInclusive)}" data-s003-m01-tier data-tier-index="${index}" data-field="minInclusive" ${disabled}/></label><label>上界（不含）<input type="number" min="0" max="101" value="${tier.maxExclusive == null ? "" : esc(tier.maxExclusive)}" placeholder="无上界" data-s003-m01-tier data-tier-index="${index}" data-field="maxExclusive" ${disabled}/></label></article>`).join("")}</div>`;
  }

  // 历史 Action Type 资源仍按原字节保留，当前用户界面统一采用 S003
  // 已确认的两阶段路由语义：亮灯形成预警候选，驾驶舱提交后直达
  // 对应成员单位接口人；接口人确认并选择本单位负责人后才形成待办。
  // 这里仅做展示层归一化，不改写 Published 资源或历史证据。
  function currentActionTypePresentation(item) {
    const source = item || {};
    const trigger = String(source.triggerSummary || "").trim();
    const tier = trigger.match(/黄灯|红灯|黑灯/)?.[0] || "风险分档";
    return {
      ...source,
      description: `${tier}按亮灯形成一条预警候选；集团债务风险管理人员从驾驶舱显式提交后，直接送达对应成员单位债务风险接口人。`,
      managementHint: "接口人核实预警依据并选择本单位负责人后，沿用通用决策中心形成负责人待办；不经过集团管理员统一收件，不启动多级审批。"
    };
  }

  function renderActions() {
    const modelActions = new Map((publishedModel.actionTypes || []).map(item => [item.actionTypeId, item]));
    return `<div class="s003-m01-factor-grid">${(actionTypeCatalog?.actionTypes || []).map(currentActionTypePresentation).map(item => {
      const definition = modelActions.get(item.actionTypeId) || {};
      const modelTrigger = definition.triggerTier || (definition.triggerFactors || []).join("、") || "由当前 Published 模型提供";
      return `<article class="s003-m01-config-card"><header><div><span>Published Action Type</span><h3>${esc(item.displayName)}</h3></div><small>${esc(item.actionTypeId)}</small></header><div class="s003-m01-action-definition"><p>${esc(item.description)}</p><dl><dt>触发口径</dt><dd>${esc(item.triggerSummary)}</dd><dt>模型触发</dt><dd>${esc(modelTrigger)}</dd><dt>人工确认</dt><dd>${item.requiresHumanConfirmation ? "必须" : "否"}</dd><dt>管理提示</dt><dd>${esc(item.managementHint)}</dd></dl></div></article>`;
    }).join("")}</div><div class="s003-m01-invariants"><span><b>权威来源</b>${esc(actionTypeCatalog?.catalogId || "S003-M01-ACTION-TYPE-CATALOG")} · ${esc(actionTypeCatalog?.catalogVersion || "1.0.0")}</span><span><b>消费边界</b>M04 与 M06 只消费当前 Published 名称和说明，不得各自维护另一套展示口径</span></div>`;
  }

  function renderValidation() {
    if (!validation.length) return `<div class="s003-m01-empty">尚未校验当前配置 Draft。校验不运行企业评分，也不修改 M02 数据质量规则。</div>`;
    return `<div class="s003-m01-validation">${validation.map(item => `<div class="${item.pass ? "pass" : "fail"}"><i>${item.pass ? "✓" : "!"}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span></div>`).join("")}</div>`;
  }

  function configSections() {
    const fallback = MODEL_CONFIG_SECTIONS.map(item => [item.sectionId, item.label]);
    const configured = (modelConfiguration?.sections || []).map(item => [item.sectionId, item.label]).filter(item => item[0] && item[1]);
    return configured.length ? configured : fallback;
  }

  function configGroups() {
    const definitions = modelConfiguration?.sections || [];
    const fallbackGroups = {
      overview: ["overview", "配置总览"],
      factors: ["adjustment-factor", "调节因子配置"],
      weights: ["scoring-weight", "评分权重"],
      tiers: ["risk-band", "风险分档配置"]
    };
    const groups = new Map();
    configSections().forEach(([id, label]) => {
      const definition = definitions.find(item => item.sectionId === id) || {};
      const fallback = fallbackGroups[id] || ["other", "其他"];
      const groupId = definition.groupId || fallback[0];
      const groupLabel = definition.groupLabel || definition.group || fallback[1];
      if (!groups.has(groupId)) groups.set(groupId, { id: groupId, label: groupLabel, items: [] });
      groups.get(groupId).items.push({ id, label, definition });
    });
    return [...groups.values()];
  }

  function configSectionGroups() {
    return configGroups().filter(group => group.id !== "overview").map(group => [group.label, group.items]);
  }

  function activeConfigSection() {
    const requested = currentHashParams().get("configTab") || "overview";
    return configSections().some(([id]) => id === requested) ? requested : "overview";
  }

  function modelConfigRoute(sectionId = "overview") {
    const normalized = configSections().some(([id]) => id === sectionId) ? sectionId : "overview";
    const query = new URLSearchParams({ id: versionIdFor(publishedModel), tab: CONFIG_TAB, configTab: normalized });
    const returnTo = currentHashParams().get("returnTo");
    if (returnTo) query.set("returnTo", returnTo);
    return `#published/version?${query}`;
  }

  function configPanel(title, description, body, badgeMarkup = "") {
    return `<section class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${badgeMarkup}</div><div class="panel-body">${body}</div></section>`;
  }

  function renderConfigOverview(disabled) {
    const categories = configSectionGroups().map(([group, items]) => `<section class="s003-m01-config-group"><h3>${esc(group)}</h3><div class="s003-m01-config-index">${items.map(({ id, label, definition }) => {
      const owner = definition.owner || "财务公司";
      return `<a class="s003-m01-config-index-card" href="${modelConfigRoute(id)}"><span>${esc(label)}</span><strong>${esc(owner)}</strong><small>${esc(definition.description || "随 Published 模型版本生效")}</small></a>`;
    }).join("")}</div></section>`).join("");
    return configPanel("模型配置总览", "选择配置卡片进入对应页签；三类配置共用同一 Draft、校验和 Published 生命周期。", `<div class="s003-m01-config-groups">${categories}</div>`);
  }

  function renderVersionLifecycleGuide() {
    const currentVersion = publishedModel?.packageVersion || "—";
    const proposedVersion = draft?.proposedVersion || "系统自动生成下一版本";
    const run = runtimeSnapshot?.activeRun || runtimeSnapshot?.lastSuccessfulRun || null;
    const runVersion = run?.modelVersion || "—";
    const currentFingerprint = modelConfigurationFingerprint(publishedModel);
    const runFingerprint = run?.modelConfigurationFingerprint || null;
    const waitingForRerun = Boolean(currentFingerprint && runFingerprint && currentFingerprint !== runFingerprint);
    const runNote = waitingForRerun
      ? "本次评分尚未使用当前配置内容，需从驾驶舱重跑"
      : runVersion === currentVersion
        ? "与当前 Published 配置一致"
        : "版本号不同，但未检测到有效配置内容变化";
    return `<section class="panel s003-m01-version-guide"><div class="panel-head"><div><h2>版本与生效机制</h2><p>模型版本只通过 Published 指针服务后续运行；历史运行和正式报告不会被原地改写。</p></div><span class="status ${waitingForRerun ? "amber" : "green"}">${waitingForRerun ? "配置变化待重跑" : "当前配置已发布"}</span></div><div class="panel-body"><div class="s003-m01-version-state"><div><span>当前 Published</span><strong>V${esc(currentVersion)}</strong><small>新建运行默认采用</small></div><div><span>下一建议版本</span><strong>V${esc(proposedVersion)}</strong><small>由系统按单调版本号生成</small></div><div><span>当前评分批次</span><strong>V${esc(runVersion)}</strong><small>${esc(runNote)}</small></div></div><div class="s003-m01-version-rules"><div><b>发布</b><span>保存 Draft → 校验 → 发布；发布后新版本成为唯一当前 Published 指针。</span></div><div><b>生效</b><span>只有已发布配置内容发生变化时，仪表盘才提示快速重跑；重跑会创建新的 scenarioRunId。</span></div><div><b>停用 / 回退</b><span>不原地删除或启用旧版本；旧版本保留只读。需要回退时克隆旧版本形成更高版本的新 Draft，再校验、发布并重跑。</span></div></div></div></section>`;
  }

  function renderConfigActionBar(disabled) {
    const returnButton = `<button class="btn" type="button" data-s003-m01-return-dashboard>返回仪表盘</button>`;
    const stateLabel = disabled ? "当前上下文只读" : dirty ? "有未保存修改" : validation.length ? "已完成校验" : "可编辑";
    return `<div class="s003-m01-config-actionbar"><div><strong>模型配置</strong><span>${esc(stateLabel)} · 保存草稿后校验，发布后驾驶舱按新版本快速重跑才会生效 · 模型配置不得写入 Python 管道参数或数据质量规则</span></div><div class="s003-m01-actions"><button class="btn" type="button" data-s003-m01-action="reset" ${disabled}>放弃未发布修改</button><button class="btn" type="button" data-s003-m01-action="save" ${disabled}>保存模型草稿</button><button class="btn" type="button" data-s003-m01-action="validate" ${disabled}>校验模型配置</button><button class="btn primary" type="button" data-s003-m01-action="publish" ${disabled}>发布模型版本</button>${returnButton}</div></div>${runtimeError ? `<div class="s003-m01-runtime-error"><strong>当前配置不可编辑</strong><span>${esc(runtimeError)}；已发布模型与资源仍可查看。</span></div>` : ""}${validation.length ? renderValidation() : ""}`;
  }

  function refreshConfigViewInPlace() {
    const hash = location.hash;
    const page = document.querySelector(".page-scroll");
    const pageTop = page?.scrollTop || 0;
    const windowTop = window.scrollY || 0;
    window.ONTOLOGY_SCENARIO_HOST?.refresh();
    requestAnimationFrame(() => {
      // 配置操作是同页状态切换，不应把用户带到版本概览或页面开头。
      if (location.hash !== hash) return;
      const nextPage = document.querySelector(".page-scroll");
      if (nextPage) nextPage.scrollTop = pageTop;
      window.scrollTo(0, windowTop);
      scheduleScenarioSurfaceSync();
    });
  }

  function renderConfigTab() {
    if (!publishedModel || !draft) return `<section class="panel"><div class="panel-body"><div class="empty"><h3>S003 模型配置正在装载</h3><p>Published 版本目录和资源页仍保持可用。</p></div></div></section>`;
    const disabled = readOnly() ? "disabled" : "";
    const runtimeTone = runtimeMode === "ready" ? "green" : runtimeMode === "loading" ? "blue" : "red";
    const runtimeLabel = runtimeMode === "ready" ? (activeContext().status === "active" ? "Draft 服务可写" : "当前上下文只读") : runtimeMode === "loading" ? "Draft 服务连接中" : "Draft 写操作已关闭";
    const section = activeConfigSection();
    const groups = configGroups();
    const primaryTabs = configSections().map(([id, label]) => `<a class="${section === id ? "active" : ""}" href="${modelConfigRoute(id)}" aria-current="${section === id ? "page" : "false"}">${esc(label)}</a>`).join("");
    const content = section === "weights" ? configPanel("评分权重", "按企业类别维护十五项财务指标权重，每类合计必须为 100%。", `${renderWeights(disabled)}<div class="s003-m01-invariants"><span><b>在建企业</b>财务原始分固定为 60 分，再叠加适用调节因子</span><span><b>盈利历史不足</b>盈利稳定性按 A 档（100 分）参与加权</span></div>`)
      : section === "factors" ? configPanel("调节因子配置", "维护六项调节因子的适用范围、业务档位和系数；这些是模型参数，不生成普通指标 Rule 节点。", `${renderFactors(disabled)}<div class="s003-m01-invariants"><span><b>缺失按 0 档</b>企业适用但当期取值缺失时，运行按 0 档解释；该语义不等于在模型中维护企业取值</span><span><b>业务不适用</b>环保企业电价波动等不适用场景与缺失严格分离，不参与因子调节</span><span><b>输入来源</b>企业当期取值由独立 T053 人工输入快照提供，模型配置只维护定义、档位与系数</span></div>`)
      : section === "tiers" ? configPanel("风险分档配置", "维护绿、黄、红、黑四档阈值；四档必须连续覆盖 0—100，无重叠、无空档。", renderTiers(disabled))
      : renderConfigOverview(disabled);
    return `<div class="s003-m01-native-extension">${noticeHtml()}<section class="panel s003-m01-config-shell"><div class="panel-head"><div><h2>债务风险监测模型配置</h2><p>统一维护调节因子、评分权重和风险分档。</p></div><span class="status ${runtimeTone}">${runtimeLabel}</span></div><div class="panel-body"><div class="s003-m01-config-topbar">${renderConfigActionBar(disabled)}</div><nav class="s003-m01-config-tabs" aria-label="债务风险模型配置分类">${primaryTabs}</nav></div></section>${content}</div>`;
  }

  function captureDraft() {
    document.querySelectorAll("[data-s003-m01-weight]").forEach(input => { const weights = draft.weights?.[input.dataset.category]; if (weights) weights[Number(input.dataset.index)] = Number(input.value); });
    document.querySelectorAll("[data-s003-m01-factor]").forEach(input => { const tier = draft.factors?.[Number(input.dataset.factorIndex)]?.tiers?.[Number(input.dataset.tierIndex)]; if (tier) tier.coefficient = Number(input.value); });
    document.querySelectorAll("[data-s003-m01-tier]").forEach(input => { const tier = draft.riskTiers?.[Number(input.dataset.tierIndex)]; if (tier) tier[input.dataset.field] = input.dataset.field === "maxExclusive" && input.value === "" ? null : Number(input.value); });
  }

  function localValidation() {
    const results = [];
    const indicatorCount = publishedModel.indicatorOrder?.length || 0;
    Object.entries(draft.weights || {}).forEach(([category, weights]) => { const sum = weightSum(weights); results.push({ title: `${category} 权重`, pass: weights.length === indicatorCount && weights.every(value => finite(value) && Number(value) >= 0) && Math.abs(sum - 100) < .001, detail: `${weights.length}/${indicatorCount} 项，合计 ${sum.toFixed(2)}%` }); });
    const factorsValid = (draft.factors || []).every(factor => factor.factorId && factor.tiers?.length && factor.tiers.every(tier => tier.tierId && finite(tier.coefficient) && Number(tier.coefficient) >= -1 && Number(tier.coefficient) <= 1));
    results.push({ title: "调节因子系数", pass: factorsValid, detail: factorsValid ? "所有分档系数均为 -1 至 1 的有限数值" : "存在缺失身份或非法系数" });
    const tiers = clone(draft.riskTiers || []).sort((left, right) => Number(left.minInclusive) - Number(right.minInclusive));
    const tiersValid = tiers.length === 4 && Number(tiers[0]?.minInclusive) === 0 && tiers.at(-1)?.maxExclusive == null && tiers.every((tier, index) => finite(tier.minInclusive) && (tier.maxExclusive == null || finite(tier.maxExclusive)) && (!index || Number(tiers[index - 1].maxExclusive) === Number(tier.minInclusive)));
    results.push({ title: "风险阈值", pass: tiersValid, detail: tiersValid ? "0—100 连续覆盖且无重叠、无空档" : "四档阈值未形成连续覆盖" });
    results.push({ title: "Owner 边界", pass: true, detail: "模型参数归 M01；未写入 M02 管道参数或质量规则" });
    validation = results;
    return results.every(item => item.pass);
  }

  async function persistDraft() {
    captureDraft();
    runtimeSnapshot = await shellRequest("saveS003ConfigurationDraft", { draft: { weights: clone(draft.weights), factors: clone(draft.factors), riskTiers: clone(draft.riskTiers), proposedVersion: draft.proposedVersion } });
    if (runtimeSnapshot?.publishedModel) publishedModel = clone(runtimeSnapshot.publishedModel);
    draft = hydrateDraft(runtimeSnapshot);
    dirty = false;
    registeredFingerprint = null;
    registerPublished();
  }

  async function perform(action) {
    if (action === "reload") {
      await hydrateRuntime();
      notice = runtimeMode === "ready" ? { tone: "info", title: "已重新读取 M01 状态", detail: "Published 与 Draft 状态已刷新，未创建新模型版本。" } : notice;
    } else {
      if (readOnly()) throw new Error(runtimeError || "当前场景上下文为只读，M01 写操作已拒绝");
      if (action === "save") {
        await persistDraft(); validation = []; notice = { tone: "success", title: "模型草稿已保存", detail: "当前 Published 指针和企业评分保持不变；下一步可校验发布条件。" };
      } else if (action === "validate") {
        if (!localValidation()) notice = { tone: "danger", title: "本地配置校验未通过", detail: "请修正权重、系数或风险阈值。" };
        else {
          await persistDraft(); runtimeSnapshot = await shellRequest("validateS003Configuration"); draft = hydrateDraft(runtimeSnapshot);
          const result = runtimeSnapshot.configValidation || { ok: false, errors: ["未取得校验结果"] };
          validation.push({ title: "统一场景运行服务", pass: result.ok === true, detail: result.ok ? "发布条件通过" : (result.errors || ["未通过"]).join("；") });
          notice = { tone: result.ok ? "success" : "danger", title: result.ok ? "模型配置已校验" : "模型配置未通过校验", detail: result.ok ? "草稿已保存且满足发布条件；发布后需从仪表盘快速重跑，当前评分和报告不会改变。" : (result.errors || ["请修正配置"]).join("；") };
        }
      } else if (action === "publish") {
        if (!localValidation()) throw new Error("当前配置未通过本地合同校验");
        await persistDraft(); runtimeSnapshot = await shellRequest("validateS003Configuration");
        if (!runtimeSnapshot.configValidation?.ok) throw new Error((runtimeSnapshot.configValidation?.errors || ["统一校验未通过"]).join("；"));
        runtimeSnapshot = await shellRequest("publishS003Configuration"); publishedModel = clone(runtimeSnapshot.publishedModel || publishedModel); draft = hydrateDraft(runtimeSnapshot); validation = []; registeredFingerprint = null; registerPublished();
        // 发布会生成新的 Published 版本标识。保持当前配置页签和返回语义，
        // 但把 URL 的精确版本同步到新版本，避免刷新后落回旧版本详情而丢失“模型配置”页签。
        const currentConfigTab = currentHashParams().get("configTab") || "overview";
        history.replaceState(history.state, "", modelConfigRoute(currentConfigTab));
        notice = { tone: "success", title: "模型版本已发布", detail: `V${publishedModel.packageVersion} 已成为当前 Published 模型；请返回仪表盘快速重跑后形成新评分、报告和行动候选。` };
      } else if (action === "reset") {
        runtimeSnapshot = await shellRequest("resetS003Configuration"); publishedModel = clone(runtimeSnapshot.publishedModel || publishedModel); draft = hydrateDraft(runtimeSnapshot); validation = []; dirty = false;
        notice = { tone: "info", title: "已恢复当前 Published 配置", detail: "只重置当前运行的 M01 Draft；历史版本、指针和证据未覆盖。" };
      }
    }
    scheduleScenarioSurfaceSync();
  }

  async function hydrateRuntime() {
    runtimeMode = "loading"; runtimeError = null;
    try {
      const snapshot = await shellRequest("getS003RuntimeSnapshot");
      if (snapshot?.context?.scenarioRunId !== activeContext().scenarioRunId) throw new Error("M01 Draft 运行身份与当前 scenarioRunId 不一致");
      runtimeSnapshot = snapshot; if (snapshot.publishedModel) publishedModel = clone(snapshot.publishedModel); draft = hydrateDraft(snapshot); runtimeMode = "ready";
    } catch (error) {
      runtimeMode = "read-only-degraded"; runtimeError = error?.message || String(error); draft = freshDraft(publishedModel);
      notice = { tone: "danger", title: "当前 M01 Draft 投影不可用", detail: `${runtimeError}；Published 版本与资源仍可只读，配置写操作已关闭。` };
    }
    registeredFingerprint = null; registerPublished();
  }

  window.ONTOLOGY_SCENARIO_EXTENSION = {
    scenarioId: "S003",
    getHealth: () => ({
      moduleId: "M01",
      status: runtimeMode === "loading" ? "checking" : !bundle || !publishedModel ? "blocked" : runtimeMode === "ready" ? "healthy" : "warning",
      detail: runtimeMode === "loading" ? "S003 Published 模型和 Draft 服务正在装载。" : !bundle || !publishedModel ? (runtimeError || "S003 Published 模型资源未装载") : runtimeMode === "ready" ? "基线本体管理页已装入 S003 Published 模型和配置扩展。" : `${runtimeError || "M01 Draft 服务不可用"}；Published 资源仍可只读。`,
      projectionIssue: runtimeError ? { reason: runtimeError, readOnlyPublishedAvailable: Boolean(bundle && publishedModel) } : null,
      scenarioContext: clone(activeContext()),
      acceptanceReady: false
    }),
    versionTabs: version => isCurrentS003Version(version) ? [[CONFIG_TAB, "模型配置"]] : [],
    renderVersionTab: (version, tab) => isCurrentS003Version(version) && tab === CONFIG_TAB ? renderConfigTab() : null,
    modelConfigurationRoute: sectionId => modelConfigRoute(sectionId),
    getModelConfiguration: () => ({ configuration: clone(modelConfiguration), publishedModel: clone(publishedModel), inputSnapshotReference: { snapshotId: bundle?.input?.snapshotId || null, snapshotVersion: bundle?.input?.snapshotVersion || null, owner: bundle?.input?.owner || "M02 数据工程", lifecycle: "independent-T053", includedInModelDraft: false }, route: modelConfigRoute("overview") }),
    publishedLineageSourceChain: version => version?.ontologyStableId === ONTOLOGY_ID ? [
      `${bundle?.source?.fileName || "企业债务风险评估模版"} · 财务数据`,
      `${bundle?.pipeline?.pipelineRunId || "M02 管道运行"} · 标准化与质量门`,
      `${bundle?.candidate?.dataAssetId || "正式数据资产"} · ${bundle?.candidate?.assessmentAt || "2025-12-31"}`,
      `模型配置 V${publishedModel?.packageVersion || "—"} · 权重、系数和阈值`,
      `${bundle?.pointer?.pointerId || "S003-M01-PUBLISHED-POINTER"} · M01 正式采用`
    ] : null,
    mappingAssessment: version => version?.ontologyStableId === ONTOLOGY_ID ? { complete: true, label: "S003 数据与模型配置已锁定", tone: "green", detail: `财务工作簿、${bundle?.candidate?.enterpriseCount || 21} 家企业、评估时点 ${bundle?.candidate?.assessmentAt || "2025-12-31"}、独立 T053 输入快照与当前 Published 模型均可精确定位`, issues: [] } : null,
    consumerCompatibility: (version, consumer) => {
      if (consumer !== "智能问数" || version?.ontologyStableId !== ONTOLOGY_ID || !bundle?.queryResults) return null;
      const identity = bundle.queryResults.scenarioIdentity || {};
      if (identity.scenarioId !== "S003" || identity.scenarioVersion !== "S003-v1" || identity.scenarioRunId !== activeContext().scenarioRunId) return null;
      return {
        sourceModule: "智能问数",
        contractCode: "C009",
        configId: "IQ-PLATFORM-S003-PUBLISHED-READONLY",
        configVersion: "IQ-PLATFORM-S003-CFG-1.0",
        consumer: "智能问数",
        semanticVersionId: version.id,
        semanticVersion: version.semanticVersion,
        dataVersion: bundle.candidate.dataAssetId,
        status: "compatible",
        checkedAt: bundle.queryResults.formedAt || bundle.pointer.switchedAt || activeContext().formedAt,
        evidenceLocator: `智能问数/${bundle.queryResults.resultSetId || "S003-M03-QUERY-RESULTS-20260815-001"}/正式配置兼容核验`,
        reason: "S003 固定只读问数运行、Published 事实和 C035 结果均与当前正式运行身份一致。"
      };
    },
    contextAssessment: version => {
      if (version?.ontologyStableId !== ONTOLOGY_ID) return null;
      const identity = bundle?.pointer?.scenarioIdentity || {};
      const current = activeContext();
      const refreshTarget = window.ONTOLOGY_SCENARIO_HOST?.getRefreshTarget?.(version.id) || null;
      const issues = [];
      if (!bundle?.pointer?.activeTarget?.packageId) issues.push("Published 模型权威指针缺失");
      if (!bundle?.candidate?.dataAssetId || !bundle?.candidate?.assessmentAt) issues.push("正式数据版本或评估时点缺失");
      if (version?.dataContract?.mappingVersionId !== mappingVersionFor(publishedModel)) issues.push("Published 来源映射版本与当前模型版本不一致");
      if (!refreshTarget?.allowRefreshSubmission || refreshTarget.sourceMappingVersionId !== mappingVersionFor(publishedModel)) issues.push("T054 刷新目标尚未按当前精确映射版本建立");
      if (identity.scenarioId !== "S003" || identity.scenarioVersion !== "S003-v1" || identity.scenarioRunId !== current.scenarioRunId) issues.push("Published 指针与当前 scenarioRunId 不一致");
      if (issues.length) return { label: "上下文未完整", tone: "amber", complete: false, detail: issues.join("；"), issues };
      return {
        label: "Published 消费上下文完整",
        tone: "green",
        complete: true,
        detail: `稳定资源身份、精确 Published 模型、数据资产 ${bundle.candidate.dataAssetId}、T054/C032 刷新目标与同一 scenarioRunId 均可定位；M03 兼容和问数运行由独立消费方状态展示，不反向阻断 M01/M02 正式只读资源。`,
        issues: []
      };
    }
  };

  document.addEventListener("click", event => {
    const returnDashboard = event.target.closest("[data-s003-m01-return-dashboard]");
    if (returnDashboard) {
      event.preventDefault();
      // 仪表盘在统一场景壳中是 M06 报告模块的 dashboard 运行视图，
      // 不能把虚拟的 dashboard 当作 M01—M06 目标模块发送给壳。
      // 使用专用打开操作可让壳切回 #dashboard，并保留 S003 风险总览入口。
      shellRequest("openS003DashboardCandidate", {}).catch(error => {
        notice = { tone: "danger", title: "无法返回仪表盘", detail: error?.message || String(error) };
        window.ONTOLOGY_SCENARIO_HOST?.refresh();
      });
      return;
    }
    const versionTarget = event.target.closest("[data-s003-m01-open-version]");
    if (versionTarget) {
      event.preventDefault();
      const versionId = versionIdFor(publishedModel);
      if (!publishedModel || !window.ONTOLOGY_SCENARIO_HOST?.openVersion) {
        notice = { tone: "danger", title: "无法打开已发布本体", detail: runtimeError || "S003 Published 模型尚未装入基线版本目录" };
        window.ONTOLOGY_SCENARIO_HOST?.refresh();
        return;
      }
      window.ONTOLOGY_SCENARIO_HOST.openVersion(versionId, versionTarget.dataset.s003M01OpenVersion || "overview");
      return;
    }
    if (event.target.closest("[data-s003-m01-canvas-fit]")) { event.preventDefault(); fitPublishedCanvas(); return; }
    if (event.target.closest("[data-s003-m01-canvas-reset-layout]")) {
      event.preventDefault();
      const scroll = document.querySelector(".published-canvas-scroll");
      if (scroll) { canvasNodePositions.delete(publishedCanvasKey(scroll)); scroll.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }
      return;
    }
    const target = event.target.closest("[data-s003-m01-action]");
    if (!target) return;
    event.preventDefault();
    if (operationInFlight) return;
    operationInFlight = true;
    target.disabled = true;
    perform(target.dataset.s003M01Action)
      .catch(error => { notice = { tone: "danger", title: "M01 场景操作未完成", detail: error?.message || String(error) }; })
      .finally(() => { operationInFlight = false; refreshConfigViewInPlace(); });
  });
  document.addEventListener("input", event => {
    if (event.target.matches("[data-s003-m01-weight],[data-s003-m01-factor],[data-s003-m01-tier]")) { dirty = true; validation = []; }
    scheduleScenarioSurfaceSync();
  });

  document.addEventListener("wheel", event => {
    if (window.ONTOLOGY_SCENARIO_HOST?.supportsPublishedCanvasGestures) return;
    const scroll = event.target.closest?.(".published-canvas-scroll");
    if (!scroll || !scroll.closest("[data-s003-m01-canvas-enhanced='true']") || !event.deltaY) return;
    event.preventDefault();
    const now = Date.now();
    if (now - canvasWheelHandledAt < 70) return;
    canvasWheelHandledAt = now;
    const action = event.deltaY < 0 ? "in" : "out";
    scroll.closest(".published-canvas-panel")?.querySelector(`[data-action="published-canvas-zoom:${action}"]`)?.click();
  }, { passive: false });

  document.addEventListener("pointerdown", event => {
    if (window.ONTOLOGY_SCENARIO_HOST?.supportsPublishedCanvasGestures) return;
    if (event.button !== 0) return;
    const scroll = event.target.closest?.(".published-canvas-scroll");
    if (!scroll || !scroll.closest("[data-s003-m01-canvas-enhanced='true']")) return;
    const node = event.target.closest(".published-canvas-world .canvas-node");
    if (node || event.target.closest("button, a, input, select, textarea")) return;
    canvasGesture = { type: "pan", pointerId: event.pointerId, scroll, startX: event.clientX, startY: event.clientY, left: scroll.scrollLeft, top: scroll.scrollTop, moved: false };
    scroll.classList.add("s003-m01-canvas-panning");
    try { scroll.setPointerCapture(event.pointerId); } catch (_) { /* pointer capture is an enhancement */ }
    event.preventDefault();
  });

  document.addEventListener("pointermove", event => {
    if (!canvasGesture || event.pointerId !== canvasGesture.pointerId) return;
    const dx = event.clientX - canvasGesture.startX; const dy = event.clientY - canvasGesture.startY;
    if (Math.hypot(dx, dy) > 3) canvasGesture.moved = true;
    if (canvasGesture.type === "pan") {
      canvasGesture.scroll.scrollLeft = canvasGesture.left - dx;
      canvasGesture.scroll.scrollTop = canvasGesture.top - dy;
      return;
    }
    const worldWidth = parseFloat(canvasGesture.world.style.width) || 2140;
    const worldHeight = parseFloat(canvasGesture.world.style.height) || 1120;
    const left = canvasGesture.left + dx / canvasGesture.scale; const top = canvasGesture.top + dy / canvasGesture.scale;
    canvasGesture.node.style.left = `${Math.max(18, Math.min(worldWidth - canvasGesture.node.offsetWidth - 18, left))}px`;
    canvasGesture.node.style.top = `${Math.max(18, Math.min(worldHeight - canvasGesture.node.offsetHeight - 18, top))}px`;
    updatePublishedEdges(canvasGesture.world);
  });
  document.addEventListener("pointerup", finishCanvasGesture);
  document.addEventListener("pointercancel", finishCanvasGesture);
  document.addEventListener("click", scheduleScenarioSurfaceSync);
  document.addEventListener("change", scheduleScenarioSurfaceSync);
  window.addEventListener("hashchange", scheduleScenarioSurfaceSync);
  window.addEventListener("pageshow", scheduleScenarioSurfaceSync);
  scheduleScenarioSurfaceSync();

  (async () => {
    try {
      await loadScript(new URL("integration-config.js", scenarioRoot));
      const [pointer, baseModel, configuration, actionCatalog, dataContract, source, candidate, input, quality, pipeline, results, queryRuntime, queryResults] = await Promise.all([
        readJson("resources/m01/published-pointer.v2.json"), readJson("resources/m01/model-package.v2.json"), readJson("resources/m01/model-configuration.v3.json"), readJson("resources/m01/action-type-catalog.v2.json"), readJson("resources/m02/data-contract.v1.1.json"), readJson("resources/m02/source-asset.v1.json"), readJson("resources/m02/formal-candidate-data-asset.v1.json"), readJson("resources/m02/human-input-snapshot.v1.json"), readJson("resources/m02/quality-result.v1.json"), readJson("resources/m02/pipeline-run.v2.json"), readJson("resources/m01/c035-risk-results.v2.json"), readJson("resources/m03/query-runtime.v2.json"), readJson("resources/m03/query-results.v2.json")
      ]);
      const activeTarget = pointer.activeTarget || {};
      if (actionCatalog.lifecycleStatus !== "published" || actionCatalog.publishedModelBinding?.packageId !== activeTarget.packageId || actionCatalog.publishedModelBinding?.packageVersion !== activeTarget.packageVersion) throw new Error("Action Type 展示目录与当前 Published 模型不一致");
      bundle = { config: window.OFW_SCENARIO_CONFIGS?.S003 || {}, pointer, baseModel, configuration, actionTypeCatalog: actionCatalog, model: activeTarget.publishedSnapshot || baseModel, dataContract, source, candidate, input, quality, pipeline, results, queryRuntime, queryResults };
      modelConfiguration = normalizeModelConfiguration(configuration);
      actionTypeCatalog = clone(actionCatalog);
      publishedModel = clone(bundle.model); draft = freshDraft(publishedModel); waitForHost();
      try {
        const formal = await shellRequest("getS003PublishedResources");
        if (formal?.ready && formal.publishedModel) { publishedModel = clone(formal.publishedModel); bundle.pointer = clone(formal.publishedPointer || bundle.pointer); draft = freshDraft(publishedModel); registeredFingerprint = null; registerPublished(); }
      } catch (error) {
        notice = { tone: "warning", title: "Published-only 服务暂不可用", detail: `${error?.message || String(error)}；已使用不可变模型包和指针文件只读装入。` };
      }
      await hydrateRuntime(); window.ONTOLOGY_SCENARIO_HOST?.refresh(); scheduleScenarioSurfaceSync();
    } catch (error) {
      runtimeMode = "read-only-degraded"; runtimeError = error?.message || String(error);
      notice = { tone: "danger", title: "S003 M01 正式资源装载失败", detail: `${runtimeError}；基线本体管理导航、建模和 Published 页面仍保持可用。` };
      window.ONTOLOGY_SCENARIO_HOST?.refresh(); scheduleScenarioSurfaceSync();
    }
  })();
})();
