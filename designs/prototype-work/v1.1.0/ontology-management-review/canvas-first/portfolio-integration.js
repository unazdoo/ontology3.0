(function () {
  "use strict";

  const STORAGE_KEY = "ontology3-canvas-first-review-v17";
  const registry = window.OFW_COMPOSITE_REGISTRY;
  const s001Seed = window.OFW_M01_S001_SEED;
  const s002Seed = window.OFW_M01_S002_SEED;
  const s004SeedApi = window.OFW_S004_SeedData;
  if (!registry || !s001Seed || !s002Seed || !s004SeedApi) return;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sceneById = Object.fromEntries(registry.scenes.map((scene) => [scene.scenarioId, scene]));
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const fingerprint = (value) => JSON.stringify(canonical(value));
  const contextOf = (scenarioId) => {
    const scene = sceneById[scenarioId];
    return { scenarioId, scenarioVersion: scene.scenarioVersion, scenarioRunId: scene.scenarioRunId, scenarioName: scene.name, formedAt: scenarioId === "S003" ? "2026-08-17T16:30:00.000Z" : scenarioId === "S004" ? "2026-08-15T23:30:00.000Z" : "2026-08-15T08:00:00.000Z", status: "active" };
  };
  const lifecycle = (scenarioId, evidence) => ({ owner: "本体管理", publicationState: "Published", lifecycleState: "Published", businessValidityState: "有效", bindability: "可新绑定", effectiveFrom: contextOf(scenarioId).formedAt, effectiveTo: null, changeType: "新增", changeReason: "场景首版发布", lastChangedAt: contextOf(scenarioId).formedAt, controlledEvidenceLocator: evidence, applicableScenario: `${scenarioId} ${sceneById[scenarioId].name}` });
  const property = (id, name, fieldId, dataType = "文本", role = "普通属性") => ({ id, name, dataType, unit: dataType === "十进制数" ? "按字段口径" : "—", definition: name, sourceFieldId: fieldId, sourceField: name, role, linkEndpoint: false, nullable: "否", status: "已映射", owner: "本体管理", terms: [] });
  const object = (id, name, memberId, properties) => ({ id, name, definition: `${name}的稳定业务语义。`, identity: properties[0].id, title: properties[1]?.id || properties[0].id, memberId, count: 21, objectKind: "业务实体", linkEndpointFields: [], owner: "本体管理", terms: [], properties });
  const field = (name, type, fieldId) => [name, type, null, fieldId];

  function buildS003State() {
    const scenario = contextOf("S003");
    const publishedAt = "2026-08-17 16:30:00";
    const evidence = "CP-S003-20260819141420000-c03838000038";
    const members = [
      { id: "S003-MEMBER-FINANCIAL", name: "财务数据", grain: "一行一企业评估时点财务事实", identity: "单位名称", identityFieldId: "S003-FIELD-ENTITY", rows: 21, identityCheckStatus: "通过", identityMissingCount: 0, identityDuplicateCount: 0, identityEvidenceLocator: `${evidence}/financial-identity`, fields: [field("单位名称", "文本标识", "S003-FIELD-ENTITY"), field("资产总计_期末余额", "十进制数", "S003-FIELD-ASSET"), field("负债合计_期末余额", "十进制数", "S003-FIELD-LIABILITY"), field("净利润_本年累计数", "十进制数", "S003-FIELD-PROFIT")] },
      { id: "S003-MEMBER-FACTOR", name: "调节因子", grain: "一行一企业评估时点因子输入", identity: "单位名称", identityFieldId: "S003-FIELD-FACTOR-ENTITY", rows: 21, identityCheckStatus: "通过", identityMissingCount: 0, identityDuplicateCount: 0, identityEvidenceLocator: `${evidence}/factor-identity`, fields: [field("单位名称", "文本标识", "S003-FIELD-FACTOR-ENTITY"), field("公司类别", "文本", "S003-FIELD-CATEGORY"), field("融资能力", "文本", "S003-FIELD-CREDIT"), field("资金余缺预警", "文本", "S003-FIELD-FUND-GAP")] }
    ];
    const objects = [
      object("OBJ-S003-ENTERPRISE-FINANCIAL", "企业财务风险事实", members[0].id, [property("PROP-S003-ENTITY", "单位名称", "S003-FIELD-ENTITY", "文本", "身份"), property("PROP-S003-ASSET", "资产总额", "S003-FIELD-ASSET", "十进制数", "标题"), property("PROP-S003-LIABILITY", "负债总额", "S003-FIELD-LIABILITY", "十进制数"), property("PROP-S003-PROFIT", "净利润", "S003-FIELD-PROFIT", "十进制数")]),
      object("OBJ-S003-FACTOR-INPUT", "企业调节因子输入", members[1].id, [property("PROP-S003-FACTOR-ENTITY", "单位名称", "S003-FIELD-FACTOR-ENTITY", "文本", "身份"), property("PROP-S003-CATEGORY", "公司类别", "S003-FIELD-CATEGORY", "文本", "标题"), property("PROP-S003-CREDIT", "融资能力", "S003-FIELD-CREDIT"), property("PROP-S003-FUND-GAP", "资金余缺预警", "S003-FIELD-FUND-GAP")])
    ];
    const relation = { id: "REL-S003-FINANCIAL-FACTOR", name: "企业财务事实关联调节因子", sourceMemberId: members[0].id, sourceFieldId: "S003-FIELD-ENTITY", targetMemberId: members[1].id, targetFieldId: "S003-FIELD-FACTOR-ENTITY", cardinality: "一对一", endpointCheckStatus: "通过", unmatchedSourceCount: 0, unmatchedTargetCount: 0, endpointEvidenceLocator: `${evidence}/relation` };
    const links = [{ id: relation.id, name: relation.name, reverseName: "调节因子对应企业财务事实", allowedDirection: "双向导航", coverage: "21/21", source: objects[0].id, target: objects[1].id, cardinality: "一对一", sourceEndpoint: { kind: "property", id: "PROP-S003-ENTITY" }, targetEndpoint: { kind: "property", id: "PROP-S003-FACTOR-ENTITY" }, sourceEndpointLabel: "单位名称", targetEndpointLabel: "单位名称", definition: "通过稳定单位名称关联同一评估时点的双成员输入。", owner: "本体管理", terms: [] }];
    const indicatorNames = ["总资产", "净利润", "经营活动产生的现金流入", "现金比率", "资产负债率", "利息保障倍数", "现金流动负债比率", "应收账款周转率", "总资产周转率", "总资产收益率", "净资产收益率", "销售毛利率", "营业利润率", "盈利稳定性", "股东权益同比增长率"];
    const metrics = indicatorNames.map((name, index) => ({ id: `MET-S003-${String(index + 1).padStart(2, "0")}`, name, code: `S003-M${String(index + 1).padStart(2, "0")}`, unit: /率|比率/.test(name) ? "%" : /倍数|周转率/.test(name) ? "倍" : "元", scope: "企业", definition: `${name}的 Published 确定性指标。`, calculation: name === "资产负债率" ? "负债合计 ÷ 资产总计" : name === "净利润" ? "净利润_本年累计数" : "按已发布风险指标公式计算", dependencyIds: ["PROP-S003-ASSET"], sourceObjectId: objects[0].id, subjectObjectId: objects[0].id, time: "2025-12-31", zeroHandling: "分母为零或输入缺失时返回无法计算", type: "Metric", owner: "本体管理" }));
    const rules = [
      ["RULE-S003-GREEN", "绿灯企业", "最终得分大于等于40", "无需形成行动申请"],
      ["RULE-S003-YELLOW", "黄灯风险跟踪", "最终得分大于等于25且小于40", "形成风险跟踪行动候选"],
      ["RULE-S003-RED", "红灯专项处置", "最终得分大于等于10且小于25", "形成专项处置行动候选"],
      ["RULE-S003-BLACK", "黑灯应急响应", "最终得分小于10", "形成应急响应行动候选"]
    ].map(([id, name, condition, conclusion], index) => ({ id, name, code: `S003-R${index + 1}`, appliesTo: "企业", objectId: objects[0].id, metricIds: metrics.map((item) => item.id), dependency: "最终风险得分", conclusion, evidence: evidence, type: "Rule", owner: "本体管理", condition, definition: `${name}的风险分档判断。`, validity: "随当前 Published 语义版本生效", testSample: "21 家企业风险评估结果", bankRanking: "不适用", businessBasis: "confirmed", decisionRefs: [] }));
    const actions = [["S003_RISK_FOLLOW_UP", "风险跟踪", "黄灯", "RULE-S003-YELLOW"], ["S003_SPECIAL_DISPOSAL", "专项处置", "红灯", "RULE-S003-RED"], ["S003_EMERGENCY_RESPONSE", "应急响应", "黑灯", "RULE-S003-BLACK"]].map(([id, name, tier, ruleId]) => ({ id, name, code: id, objectId: objects[0].id, targetObjectId: objects[0].id, target: objects[0].name, requirement: `${tier} Rule 命中且证据完整`, inputs: "企业、风险分档、弱项指标和成员单位接口人", parameters: "企业、风险分档、弱项指标和成员单位接口人", prerequisite: `${tier} Rule 命中并由用户显式提交`, result: "形成标准 Action Request", confirmation: "必须人工确认", definition: `${tier}企业的受控行动类型。`, failure: "证据或接口人缺失时阻断提交", defaultDue: "人工确认后 5 个工作日", ruleIds: [ruleId], linkIds: [], type: "Action Type", owner: "本体管理", businessBasis: "confirmed", decisionRefs: [] }));
    const publishFields = lifecycle("S003", evidence);
    const decorate = (item, kind, type) => ({ ...clone(item), ...publishFields, kind, type });
    const publishedObjects = objects.map((item) => ({ ...decorate(item, "object", "Object Type"), properties: item.properties.map((propertyItem) => decorate(propertyItem, "property", "Property")) }));
    const publishedLinks = links.map((item) => decorate(item, "link", "Link Type"));
    const publishedMetrics = metrics.map((item) => decorate(item, "metric", "Metric"));
    const publishedRules = rules.map((item) => decorate(item, "rule", "Rule"));
    const publishedActions = actions.map((item) => decorate(item, "action", "Action Type"));
    const properties = publishedObjects.flatMap((item) => item.properties.map((propertyItem) => ({ ...propertyItem, parentId: item.id, parentName: item.name })));
    const delivery = { sourceModule: "数据工程", contractCode: "C003", deliveryId: "C003-S003-T007-v1", deliveryStatus: "已交付", deliveredAt: scenario.formedAt, scenarioContext: scenario, evidenceLocator: `${evidence}/C003`, assetId: "S003-RISK-DATA", assetName: "债务风险评估输入数据资产", assetVersion: "S003-T007-DEBT-RISK-20251231-v1", asOf: "2025-12-31", sourceSnapshotId: "S003-SNAPSHOT-20251231-v1", processingModuleVersion: "S003-DEFINITION-v1", publishedAt, versionDescription: "企业债务风险正式数据资产", source: "企业债务风险评估数据", publicationState: "已发布", purpose: "债务风险本体映射", consumptionRestriction: "供债务风险正式链路使用", lineageCheckStatus: "通过", lineageEvidenceLocator: `${evidence}/lineage`, mappingEligibility: { status: "可供本体映射", evidenceLocator: `${evidence}/mapping` }, qualitySummary: { status: "通过", resultId: "S003-QUALITY-v1", checkedAt: scenario.formedAt, evidenceLocator: `${evidence}/quality` }, sourceChain: ["S003-SNAPSHOT-20251231-v1", "S003-DEFINITION-v1", "RUN-S003-DATA-20251231-v1", "S003-QUALITY-v1", "S003-T007-DEBT-RISK-20251231-v1"], members, relations: [relation] };
    const sourceFingerprint = fingerprint(delivery);
    const objectMappings = objects.map((item) => ({ objectId: item.id, memberId: item.memberId, identityPropertyId: item.identity, titlePropertyId: item.title, propertyMappings: item.properties.map((propertyItem) => ({ propertyId: propertyItem.id, sourceFieldId: propertyItem.sourceFieldId, dataType: propertyItem.dataType })) }));
    const linkMappings = links.map((item) => ({ linkId: item.id, sourceObjectId: item.source, targetObjectId: item.target, sourceEndpoint: item.sourceEndpoint, targetEndpoint: item.targetEndpoint, assetRelationId: relation.id }));
    const contract = { ...clone(delivery), sourceContractFingerprint: sourceFingerprint, mappingVersionId: "S003-MAPPING-v1", objectMappings, linkMappings };
    const versionId = "SEM-S003-DEBT-RISK-v1";
    const semanticVersion = "S003-M01-DEBT-RISK-PKG 1.0.2";
    const resources = [...publishedObjects, ...properties, ...publishedLinks, ...publishedMetrics, ...publishedRules, ...publishedActions];
    const positions = {};
    [...objects, ...links, ...metrics, ...rules, ...actions].forEach((item, index) => { positions[item.id] = [80 + (index % 6) * 320, 70 + Math.floor(index / 6) * 145]; });
    const version = { id: versionId, ontologyStableId: "ONT-S003-DEBT-RISK", name: "企业债务风险本体", definition: "维护企业财务风险事实、调节因子、15 项指标、风险分档 Rule 和受控行动类型。", scenario: "S003 债务风险监测", scenarioContext: scenario, semanticVersion, status: "Published", publicationState: "Published", lifecycleState: "Published", owner: "本体管理", bindability: "可新绑定", effectiveFrom: scenario.formedAt, effectiveTo: null, replacementDeclaration: "替代 1.0.1", publishedAt, lastChangedAt: publishedAt, sourceDraftId: "DRAFT-S003-DEBT-RISK-v1", sourceDraftName: "债务风险本体初始 Draft", sourceDeliveryId: delivery.deliveryId, sourceDeliverySnapshot: delivery, sourceDeliveryReceiptSnapshot: { sourceModule: "本体管理", contractCode: "C003", receiptId: "RECEIPT-C003-S003-v1", deliveryId: delivery.deliveryId, status: "accepted", receivedAt: scenario.formedAt, t006Id: delivery.assetId, t007Version: delivery.assetVersion, targetDraftId: "DRAFT-S003-DEBT-RISK-v1", targetDraftRevision: 1, scenarioContext: scenario }, sourceDeliveryFingerprint: sourceFingerprint, draftRevision: 1, changeSummary: "发布 15 项风险指标、4 个风险分档 Rule 与 3 类行动类型。", validationSnapshot: { status: "passed", checkedAt: publishedAt, scopeSummary: `${resources.length} 项语义资源`, groups: [], mapping: { complete: true, detail: "双成员与稳定单位身份关系已冻结" }, resourceManifest: resources.map((item) => item.id) }, dataContract: contract, positions, objects: publishedObjects, properties, links: publishedLinks, metrics: publishedMetrics, rules: publishedRules, actions: publishedActions, publishRecordId: "T019-S003-v1", publishEvidenceRef: evidence, controlledEvidenceLocator: evidence, resourceManifestSnapshot: { versionId, semanticVersion, capturedAt: publishedAt, resources: resources.map((item) => ({ id: item.id, name: item.name, kind: item.kind, type: item.type, publicationState: "Published", businessValidityAtPublish: "有效", owner: "本体管理", effectiveFrom: scenario.formedAt, effectiveTo: null, bindability: "可新绑定", changeType: "新增", changeReason: "S003 风险语义发布", lastChangedAt: publishedAt, applicableScenario: "S003 债务风险监测", controlledEvidenceLocator: evidence, capturedAt: publishedAt })) } };
    const binding = { semanticVersion, dataVersion: delivery.assetVersion, asOf: delivery.asOf, switchedAt: publishedAt, scenarioContext: scenario, adoptionRecordId: "T019-S003-v1", adoptionEvidenceLocator: evidence };
    const contextId = `C033-${scenario.scenarioRunId}`;
    return { publishedVersions: [version], drafts: [], selectedVersionId: versionId, bindingsByVersion: { [versionId]: { current: binding, previous: null } }, recordsByVersion: { [versionId]: [{ id: "T019-S003-v1", title: "已切换为正式语义与数据组合", detail: "风险指标、分档和数据版本已形成当前正式组合。", status: "成功", tone: "green", time: publishedAt, semanticVersionId: versionId, semanticVersion, dataVersion: delivery.assetVersion, scenarioContext: scenario, evidenceCode: evidence, resourceRef: "T019", sourceModule: "本体管理", formsContract: true }] }, externalDataAssets: { [`${delivery.assetId}::${delivery.assetVersion}`]: delivery }, dataAssetDeliveryReceipts: { [delivery.deliveryId]: version.sourceDeliveryReceiptSnapshot }, dataAssetDeliveryFingerprints: { [delivery.deliveryId]: sourceFingerprint }, scenarioContexts: { S003: scenario }, scenarioContextReceipts: { [contextId]: { envelope: { sourceModule: "平台公共层", contractCode: "C033", contextId, deliveredAt: scenario.formedAt, evidenceLocator: evidence, scenarioContext: scenario }, receipt: { sourceModule: "本体管理", contractCode: "C033", contextId, status: "accepted", receivedAt: scenario.formedAt, scenarioContext: scenario } } }, currentFormalVersionIdsByOntology: { "ONT-S003-DEBT-RISK": versionId }, currentFormalVersionId: versionId };
  }

  function mergeById(left = [], right = []) {
    return [...new Map([...left, ...right].filter(Boolean).map((item) => [item.id || item.ontologyStableId, clone(item)])).values()];
  }
  function mergeState(target, source) {
    target.drafts = mergeById(target.drafts, source.drafts);
    target.publishedVersions = mergeById(target.publishedVersions, source.publishedVersions);
    ["updatesByVersion", "bindingsByVersion", "recordsByVersion", "externalDataAssets", "externalComponentAssetReferences", "externalRefreshRequests", "externalQualityFacts", "externalConsumerCompatibility", "dataAssetDeliveryReceipts", "dataAssetDeliveryFingerprints", "scenarioContexts", "scenarioContextReceipts", "refreshTargetBindingsByVersion", "refreshTargetDiscoveries", "currentFormalVersionIdsByOntology"].forEach((key) => { target[key] = { ...(target[key] || {}), ...(clone(source[key] || {})) }; });
    target.externalDeliveryIssues = [...(target.externalDeliveryIssues || []), ...(clone(source.externalDeliveryIssues || []))];
    target.formalHistory = [...(target.formalHistory || []), ...(clone(source.formalHistory || []))];
    return target;
  }

  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { stored = null; }
  const hasS001 = stored?.publishedVersions?.some((version) => version.scenarioContext?.scenarioId === "S001");
  const state = clone(hasS001 ? stored : s001Seed);
  const s003State = buildS003State();
  const s004Context = contextOf("S004");
  const s004State = s004SeedApi.buildM01State(s004Context, {});
  mergeState(state, s002Seed);
  mergeState(state, s003State);
  mergeState(state, s004State);
  const requestedScene = new URLSearchParams(location.search).get("portfolioScene");
  state.activeScenarioId = ["S001", "S002", "S003", "S004"].includes(requestedScene)
    ? requestedScene
    : ["S001", "S002", "S003", "S004"].includes(state.activeScenarioId) ? state.activeScenarioId : "S001";
  state.selectedVersionId = state.publishedVersions.find((version) => version.scenarioContext?.scenarioId === state.activeScenarioId)?.id || state.selectedVersionId;
  window.OFW_M01_PORTFOLIO_STATE = clone(state);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#published`);

  const FILTER_KEY = "ofw.m01.portfolio-filter.v1";
  const ontologyScenes = Object.fromEntries(state.publishedVersions.map((version) => [version.ontologyStableId, version.scenarioContext?.scenarioId]));
  let currentFilter = "ALL";
  try { localStorage.setItem(FILTER_KEY, "ALL"); } catch (_) {}
  let scheduled = false;
  function addBadge(node, scenarioId) {
    if (!node || !/^S00[1-4]$/.test(scenarioId) || node.querySelector(":scope > .ontology-scene-badge")) return;
    const badge = document.createElement("span");
    badge.className = "ontology-scene-badge";
    badge.dataset.scene = scenarioId;
    badge.textContent = scenarioId;
    node.append(badge);
  }
  function selectScene(value) {
    currentFilter = value;
    try { localStorage.setItem(FILTER_KEY, value); } catch (_) {}
    const nextActive = value === "ALL" ? "S001" : value;
    const url = new URL(location.href);
    if (value === "ALL") url.searchParams.delete("portfolioScene");
    else url.searchParams.set("portfolioScene", nextActive);
    location.replace(url.toString());
  }
  function installFilter() {
    const existing = document.querySelector("[data-ontology-portfolio-filter]");
    if (existing) existing.remove();
  }
  function applyProjection() {
    scheduled = false;
    installFilter();
    const foot = document.querySelector(".product-nav-foot");
    if (foot && !foot.dataset.portfolio) { foot.dataset.portfolio = "true"; foot.innerHTML = `<strong>语义资产</strong><span>融资 · 预算 · 债务风险 · 贷前调查</span>`; }
    document.querySelectorAll(".published-ontology-card").forEach((card) => {
      const ontologyId = card.querySelector("small.mono")?.textContent?.trim();
      const scenarioId = ontologyScenes[ontologyId];
      card.dataset.ofwScene = scenarioId || "";
      card.dataset.ofwPortfolioHidden = currentFilter !== "ALL" && scenarioId !== currentFilter ? "true" : "false";
      addBadge(card.querySelector("h2")?.parentElement || card, scenarioId);
      const formalLabel = [...card.querySelectorAll("dt")].find((node) => node.textContent.trim() === "当前正式版本");
      const published = registry.ontology[scenarioId]?.publishedVersion;
      if (formalLabel?.nextElementSibling && published) formalLabel.nextElementSibling.textContent = published;
    });
    document.querySelectorAll(".draft-card").forEach((card) => {
      const text = card.textContent || "";
      const scenarioId = registry.scenes.find((scene) => text.includes(scene.scenarioId) || text.includes(scene.name))?.scenarioId;
      if (scenarioId) addBadge(card.querySelector("h2")?.parentElement || card, scenarioId);
    });
    const pageId = new URLSearchParams(location.hash.split("?")[1] || "").get("id");
    const versionId = new URLSearchParams(location.hash.split("?")[1] || "").get("version");
    const version = state.publishedVersions.find((item) => item.ontologyStableId === pageId || item.id === pageId || item.id === versionId);
    if (version) addBadge(document.querySelector(".page-head h1")?.parentElement, version.scenarioContext?.scenarioId);
  }
  function scheduleProjection() { if (scheduled) return; scheduled = true; requestAnimationFrame(applyProjection); }
  function startProjection() {
    const target = document.body || document.documentElement;
    if (target && target.nodeType === 1 && target.ownerDocument === document && typeof window.MutationObserver === "function") {
      try {
        const observer = new window.MutationObserver(scheduleProjection);
        observer.observe(target, { childList: true, subtree: true });
      } catch (_) {
        // Initial projection and route refresh remain available in restricted iframe contexts.
      }
    }
    addEventListener("hashchange", scheduleProjection);
    scheduleProjection();
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", startProjection, { once: true });
  else startProjection();
})();
