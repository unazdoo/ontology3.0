(function installWorkflow(global) {
  "use strict";

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
  const modes = Object.freeze({ formal: "正式结果", demo: "演示基准", candidate: "候选试算", shadow: "影子观察", simulation: "压力模拟", difference: "版本差异" });
  const normalizeMode = (mode) => ({ fact: "formal", prediction: "candidate", diff: "difference" })[String(mode).toLowerCase()] || (Object.hasOwn(modes, String(mode).toLowerCase()) ? String(mode).toLowerCase() : "formal");
  const aliases = Object.freeze({
    "FinancingEntity-001": "s001.group", "FinancingEntity-002": "s001.entity.553", "FinancingEntity-003": "s001.entity.465", "FinancingEntity-004": "s001.entity.561",
    "UNIT-553": "s001.entity.553", "UNIT-465": "s001.entity.465", "UNIT-561": "s001.entity.561", "单位553": "s001.entity.553", "单位465": "s001.entity.465", "单位561": "s001.entity.561",
    "InvestmentProduct-001": "PRD-223C00000000A5FB", "InvestmentProduct-002": "PRD-40A100000000B2C7", "InvestmentProduct-003": "PRD-62D200000000C1A9", "InvestmentProduct-004": "portfolio-01"
  });
  const canonicalId = (id) => global.OFW_ENTERPRISE_MASTER?.canonicalId(aliases[id] || id) || aliases[id] || id;
  const enterpriseFor = (value) => global.OFW_ENTERPRISE_MASTER?.resolve(typeof value === "string" ? canonicalId(value) : canonicalId(value?.id || value?.enterpriseId || value?.subjectId)) || null;
  function normalizeObjectRef(ref) {
    if (!ref || !ref.id) return ref;
    const enterprise = enterpriseFor(ref);
    if (!enterprise) return ref;
    return { ...ref, id: enterprise.id, enterpriseId: enterprise.id, title: enterprise.name, name: enterprise.name, label: enterprise.name, type: "Enterprise", objectTypeRef: "Enterprise", sourceObjectId: ref.sourceObjectId || ref.id, identityVersionId: global.OFW_ENTERPRISE_MASTER.version };
  }
  const subjectId = (item) => canonicalId(item?.enterpriseId || item?.subjectId || item?.objectId || item?.objectRef?.id || item?.id || "");

  function contextIssue(state, context = {}) {
    const scenarioId = state?.scenario?.scenarioId;
    if (scenarioId && context.scenarioId && scenarioId !== context.scenarioId) return "范围错误：来源业务域与目标业务域不兼容，请重新选择目标范围。";
    const set = context.objectSetRef || context.objectSet;
    const object = context.activeObjectRef || context.object;
    const ids = [...(set?.objectIds || set?.ids || []), ...(object?.id ? [object.id] : [])];
    const envelopes = [state?.formalBaseline?.resultEnvelope, ...Object.values(state?.results || {})].filter((entry) => Array.isArray(entry?.subjects));
    const known = new Set(envelopes.flatMap((entry) => entry.subjects.map(subjectId)));
    if (ids.length && known.size && ids.some((id) => !known.has(canonicalId(id)))) return "范围错误：存在目标业务域未登记的对象，不能扩大为全部对象。";
    const envelope = envelopeFor(state, context.resultView || context.resultMode?.id);
    const version = context.dataVersionRef?.id;
    if (version && envelope && ![envelope.dataVersionId, envelope.inputSnapshot?.dataVersionId].includes(version)) return "版本不兼容：固定数据版本与当前结果不一致，请返回来源或重新选择版本。";
    const ontology = context.ontologyVersionRef?.id;
    const actualOntology = envelope?.semanticContractVersionId || envelope?.ontologyVersionId || envelope?.inputSnapshot?.ontologyVersionId;
    if (ontology && actualOntology && ontology !== actualOntology) return "版本不兼容：本体版本与结果口径不一致。";
    const asOf = envelope?.asOf || state?.scenario?.dataAsOf;
    if (asOf && context.timeRange?.end && context.timeRange.end !== asOf) return `时间不兼容：当前结果截至${asOf}，所选窗口没有对应结果。`;
    return "";
  }

  function envelopeFor(state, mode) {
    const key = normalizeMode(mode);
    if (key === "formal" || key === "demo") return state?.results?.formalEnvelope || state?.formalBaseline?.resultEnvelope || null;
    return state?.results?.[`${key === "difference" ? "candidate" : key}Envelope`] || null;
  }

  function scopeRows(rows, context = {}, scope = "auto") {
    if (scope === "auto" && ["object", "set", "all"].includes(context.analysisScope)) scope = context.analysisScope;
    const object = context.activeObjectRef || context.object;
    const set = context.objectSetRef || context.objectSet;
    if (scope !== "all" && scope !== "set" && object?.id) return rows.filter((item) => subjectId(item) === canonicalId(object.id));
    const ids = set?.objectIds || set?.ids;
    if (scope !== "all" && Array.isArray(ids) && (ids.length || set?.selectionMode)) {
      const selected = new Set(ids.map(canonicalId));
      return rows.filter((item) => selected.has(subjectId(item)));
    }
    return rows;
  }

  function resultSnapshot(state, context = {}, scope = "auto") {
    let mode = normalizeMode(context.resultView || context.resultMode?.id || context.resultMode);
    const envelope = envelopeFor(state, mode);
    if (envelope?.resultKind === "DEMO_BASELINE") mode = "demo";
    const issue = contextIssue(state, context);
    const rows = issue ? [] : scopeRows(envelope?.subjects || [], context, scope);
    const range = context.timeRange || {};
    return {
      mode, envelope, rows,
      resultId: envelope?.resultId || null,
      modelVersionId: envelope?.modelVersionId || null,
      dataVersionId: envelope?.dataVersionId || envelope?.inputSnapshot?.dataVersionId || (mode === "formal" ? state?.formalBaseline?.dataVersionId : null),
      ontologyVersionId: envelope?.semanticContractVersionId || envelope?.ontologyVersionId || envelope?.inputSnapshot?.ontologyVersionId || null,
      timeNote: range.start && range.end && range.start !== range.end ? "当前结果为固定时点快照，未按观察区间重新计算。" : "",
      emptyReason: issue || (!envelope ? `当前尚未形成${modes[mode]}` : !rows.length ? "当前对象范围没有对应结果" : "")
    };
  }

  const reportKey = (scenarioId) => `ofw.v15.report.${scenarioId}`;
  function readReport(scenarioId) {
    try { return JSON.parse(global.localStorage.getItem(reportKey(scenarioId)) || "null"); } catch (_) { return null; }
  }
  function saveReport(scenarioId, draft) {
    const saved = { ...clone(draft), updatedAt: new Date().toISOString(), status: "DRAFT_READY_FOR_REVIEW" };
    global.localStorage.setItem(reportKey(scenarioId), JSON.stringify(saved));
    return saved;
  }
  function appendBlock(scenarioId, block) {
    const draft = readReport(scenarioId) || { reportId: `RPT-${scenarioId}-${Date.now().toString(36)}`, title: "业务分析报告", formedAt: new Date().toISOString(), contentBlocks: [] };
    const blocks = draft.contentBlocks || [];
    const fingerprint = JSON.stringify([block.sourceModuleId, block.title, block.resultId, block.rows, block.text, block.workspaceContext]);
    if (blocks.some((item) => item.fingerprint === fingerprint)) return draft;
    blocks.push({ ...clone(block), id: global.crypto?.randomUUID?.() || `BLOCK-${Date.now()}-${blocks.length}`, fingerprint, createdAt: new Date().toISOString() });
    return saveReport(scenarioId, { ...draft, contentBlocks: blocks, workspaceContext: clone(block.workspaceContext), resultMode: block.resultMode, summary: block.text || draft.summary || "" });
  }

  function snapshotBlock(state, context, sourceModuleId, title) {
    const result = resultSnapshot(state, context);
    const rows = result.rows.map((item) => ({
      id: subjectId(item), name: enterpriseFor(subjectId(item))?.name || item.name || item.subjectName || item.enterpriseName || item.objectRef?.title || subjectId(item),
      value: number(item.candidate?.score ?? item.score ?? item.riskScore), unit: "分",
      status: item.candidate?.tier || item.tier || item.resultStatus || "",
      missingReason: (item.missingReasons || item.confidence?.missingReasons || []).join("；"),
      evidenceRefs: [...new Set([...(item.evidenceRefs || []), item.formalResultId, ...(item.topContributors || []).map((entry) => entry.evidenceRef)].filter(Boolean))]
    }));
    return {
      type: "result-summary", title: title || modes[result.mode], sourceModuleId,
      resultMode: result.mode, resultId: result.resultId, modelVersionId: result.modelVersionId,
      dataVersionId: result.dataVersionId, ontologyVersionId: result.ontologyVersionId,
      dataOrigin: result.envelope?.dataOrigin || null,
      provenance: clone(result.envelope?.provenance || null),
      text: result.emptyReason || `${modes[result.mode]}${result.envelope?.dataOrigin === "SYNTHETIC" ? " · 合成演示数据，不代表正式评价" : ""}，${rows.length} 个对象。${result.timeNote}`,
      rows, workspaceContext: clone(context), evidenceRefs: [...new Set([result.resultId, ...(context.evidenceRefs || []), ...rows.flatMap((item) => item.evidenceRefs)].filter(Boolean))]
    };
  }

  const queryHistoryKey = "ofw.v15.query-history";
  function readQueryHistory() {
    try {
      const value = JSON.parse(global.localStorage.getItem(queryHistoryKey) || "[]");
      return Array.isArray(value) ? value.filter((item) => item.id && item.answer?.question && Array.isArray(item.answer.rows)).slice(0, 30) : [];
    } catch (_) { return []; }
  }

  function saveQueryAnswer(answer, workspaceContext) {
    if (!answer?.question || !Array.isArray(answer.rows)) return null;
    const state = answer.runtimeContext?.state || {};
    const mode = normalizeMode(answer.spec?.resultMode);
    const source = envelopeFor(state, mode);
    const resultKey = `${mode === "difference" ? "candidate" : mode === "demo" ? "formal" : mode}Envelope`;
    const identity = source ? Object.fromEntries(["resultId", "runId", "modelVersionId", "dataVersionId", "ontologyVersionId", "semanticContractVersionId", "resultKind", "dataOrigin", "provenance", "formedAt", "asOf"].map((key) => [key, source[key] ?? null])) : null;
    const history = readQueryHistory();
    const saved = {
      id: global.crypto?.randomUUID?.() || `QUERY-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(), scenarioId: answer.queryScenarioId,
      status: answer.cancelled ? "cancelled" : answer.ready ? "success" : "failed",
      workspaceContext: clone(workspaceContext),
      answer: {
        ...Object.fromEntries(["question", "spec", "queryScenarioId", "ready", "title", "summary", "rows", "kpis"].map((key) => [key, clone(answer[key])])),
        workspaceContext: clone(workspaceContext),
        runtimeContext: { ui: clone(answer.runtimeContext?.ui || {}), state: {
          scenario: clone(state.scenario || {}), data: { dataVersionId: identity?.dataVersionId || state.data?.dataVersionId || null },
          results: { [resultKey]: identity, resultPackage: { resultPackageId: state.results?.resultPackage?.resultPackageId || null } }
        } }
      }
    };
    global.localStorage.setItem(queryHistoryKey, JSON.stringify([saved, ...history].slice(0, 30)));
    return clone(saved);
  }

  function queryResultCsv(answer) {
    const source = envelopeFor(answer.runtimeContext?.state, answer.spec?.resultMode);
    const quote = (value) => {
      let text = String(value ?? "");
      if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [["对象", "结果", "补充指标", "说明", "业务域", "结果身份", "结果编号", "模型版本", "数据版本", "证据"], ...(answer.rows || []).map((row) => [row.name, row.primary, row.secondary, row.tertiary, answer.queryScenarioId, modes[normalizeMode(answer.spec?.resultMode)], source?.resultId, source?.modelVersionId, source?.dataVersionId, (row.evidence || []).join("; ")])];
    return "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n");
  }

  global.OFW_WORKFLOW = Object.freeze({ clone, number, modes, normalizeMode, canonicalId, enterpriseFor, normalizeObjectRef, subjectId, envelopeFor, scopeRows, contextIssue, resultSnapshot, readReport, saveReport, appendBlock, snapshotBlock, readQueryHistory, saveQueryAnswer, queryResultCsv });
})(typeof window === "undefined" ? globalThis : window);
