# 本轮源码证据摘录

来自本worktree固定快照；只读提取。较长源码行保留完整内容，精确文件/行号见各条。

# R14-001 合成模型评分被展示为“正式事实”

`designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:113`

```text
111: }
112: 
113: function resultSubjects(spec, modelVersionId, shift = 0) {
114:   return spec.subjectNames.map((name, index) => ({
115:     subjectId: `${spec.subjectType}-${String(index + 1).padStart(3, "0")}`,
116:     subjectName: name,
117:     subjectType: spec.subjectType,
118:     resultStatus: index === spec.subjectNames.length - 1 && spec.scenarioVersion === "S005-v1" ? "PARTIAL" : "EVALUATED",
119:     score: Number((62 + index * 6 + shift).toFixed(1)),
120:     confidence: Number((0.91 - index * 0.08).toFixed(2)),
```

`designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:190`

```text
188:     immutable: true
189:   };
190:   const formalBaseline = {
191:     ...baselineModel,
192:     dataVersionId: spec.dataVersionId,
193:     ontologyVersionId: spec.semanticContractVersionId,
194:     publishedPointerMutableByPrototype: false,
195:     resultEnvelope: {
196:       schemaVersion: "ofw.modeling.result-envelope.v2",
197:       resultId: `FACT-${scenarioId}-BASELINE-READONLY`,
```

`designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1700`

```text
1698:       const rows = dashboardRows(dashboardView);
1699:       const activeLabel = views.find(([id]) => id === dashboardView)?.[1] || "模型结果";
1700:       const resultKind = ({ FACT: "正式事实", PREDICTION: "候选预测", SHADOW: "影子观察", SIMULATION: "压力模拟" })[envelope?.resultKind] || "模型结果";
1701:       const body = `<div class="ofw-native-dashboard-tabs">${views.map(([id, label]) => `<button type="button" class="${dashboardView === id ? "active" : ""}" data-ofw-native-action="dashboard-view" data-view="${id}">${label}</button>`).join("")}</div><div class="ofw-native-dashboard-summary"><strong>${esc(activeLabel)}</strong><span>${envelope ? `${rows.length} 个业务对象 · ${esc(resultKind)}` : "当前周期尚未形成该结果，正式结果仍保持只读。"}</span></div>${rows.length ? `<div class="ofw-native-query-table">${rows.map((item) => `<div class="ofw-native-query-row"><strong>${esc(item.name)}</strong><span>${esc(item.primary)}</span><span>${esc(item.secondary)}</span><span>${esc(item.tertiary)}</span></div>`).join("")}</div>` : `<div class="ofw-native-note">${dashboardView === "formal" ? "当前场景没有可读取的正式基线结果。" : "请先在模型目标与优化完成对应运行。"}</div>`}<div class="ofw-native-query-evidence">${esc(envelope?.resultId || state().results?.resultPackage?.resultPackageId || "当前结果包尚未形成")}</div>`;
1702:       const footer = envelope ? `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/report">加入报告</button>` : dashboardView === "formal" ? "" : `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/modeling">进入模型目标与优化</button>`;
1703:       openDrawer(`${context?.ui?.businessName || scenarioId}模型结果`, `${scenarioId} · 仪表盘`, body, footer);
1704:     }
1705: 
1706:     function renderDashboard() {
1707:       syncDashboardWorkspaceContext();
```

# R14-002 未登记企业被当作全部企业或整个产业作答

`designs/prototype-work/v1.4/src/domain.js:344`

```text
342:   parameters: scenarioSchema.optional(),
343: });
344: export function parseQuestion(text, data) {
345:   const q = text.trim();
346:   if (!q) throw new Error("请输入问题");
347:   const matched = data.enterprises.filter((entity) =>
348:     [entity.name, entity.id, ...entity.aliasNames].some((name) =>
349:       new RegExp(
350:         name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])",
351:         "i",
```

`designs/prototype-work/v1.4/src/domain.js:366`

```text
364:     );
365:   if (
366:     /公司|单位\d+|ENT-\d+/i.test(q) &&
367:     !/这家公司|该公司/.test(q) &&
368:     !matched.length
369:   )
370:     throw new Error("没有识别到该企业，请使用对象列表中的企业名称或来源别名。");
371:   if (
372:     /(?:最低|最高|前\d+|同比|环比|预测|美元|季度|去年|明年|成本高于\s*\d.*%)/.test(
373:       q,
```

`designs/prototype-work/v1.4/src/domain.js:434`

```text
432:             rateBps: rate ? Number(rate[2]) * (rate[1] === "降息" ? -1 : 1) : 0,
433:             creditHaircut: credit ? Number(credit[1]) : 0,
434:             extensionDays: extension ? Number(extension[1]) : 0,
435:             bankId: bank?.id || null,
436:           }),
437:         }
438:       : {}),
439:     ...(matched.length ? { objectIds: matched.map((item) => item.id) } : {}),
440:     ...(bank ? { bankId: bank.id } : {}),
441:     ...(["红灯", "黄灯", "绿灯", "黑灯"].find((tier) => q.includes(tier))
```

# R14-003 本体内规则入口与验证结果回到态势均报错

`designs/prototype-work/v1.4/composite/integrations/ontology-owned-rules.js:36`

```text
34:    }catch(caught){if(request===epoch)error=caught.message;}finally{if(request===epoch){busy=false;render();}}
35:   }
36:   doc.addEventListener('click',event=>{const open=event.target.closest('[data-owned-rule-open]');if(open){global.OFW_V14_JOINT.openOntology(open.dataset.ownedRuleOpen);return;}const button=event.target.closest('[data-owned-rule-action]');if(button?.dataset.ownedRuleAction==='validate')void validate();if(button?.dataset.ownedRuleAction==='apply'&&result)global.OFW_V14_JOINT.applyOwnedRule(result);if(event.target.closest('[data-action="open-data-engineering-lineage"]')){event.preventDefault();event.stopImmediatePropagation();global.OFW_V14_JOINT.open('data','resources');}},{signal,capture:true});
37:   doc.addEventListener('change',event=>{if(event.target.matches('[data-owned-rule-window]')){horizon=Number(event.target.value);result=null;epoch++;busy=false;render();}},{signal});
38:   return {render};
39:  }
40:  global.OFW_V14_ONTOLOGY_RULES=Object.freeze({create});
41: })(window);
```

`designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:391`

```text
389:   global.OFW_V120_CATALOG = catalog;
390:   global.OFW_V131_CATALOG = catalog;
391:   global.OFW_V14_JOINT = Object.freeze({
392:     tasks,
393:     source,
394:     isJoint,
395:     taskForFrame,
396:     attach,
397:     open,
398:     activate,
```

`designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:15`

```text
13:       task("joint-reports", "联合分析报告", "file-chart-column", "reports"),
14:     ],
15:     ontology: [task("rule-sandbox", "融资规则验证", "workflow", "ontology")],
16:   });
17:   const owners = {
18:     workbench: ["dashboard", "situation"],
19:     plans: ["decision", "financing-plans"],
20:     tasks: ["decision", "analysis-tasks"],
21:     reports: ["report", "joint-reports"],
22:     ontology: ["ontology", "rule-sandbox"],
```

# R14-004 黄灯事项确认交办使用错误版本，反复重试不能生成待办

`designs/prototype-releases/v1.1.0/scenarios/s003/resources/m04/decision-inbox.v3.json:409`

```text
407:       "loans": [],
408:       "loanCount": 0,
409:       "evidence": {
410:         "semanticVersion": "S003-M01-DEBT-RISK-PKG 1.0.2",
411:         "dataVersion": "1.0.0",
412:         "dataAssetId": "S003-T007-FORMAL-CANDIDATE-20251231-v1",
413:         "resultVersion": "1.1.0",
414:         "cutoff": "2025-12-31",
415:         "quality": "允许推进",
416:         "availability": "完整可用",
```

# R14-005 切换业务域后保留不兼容对象，空结果仍显示成功

`designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1102`

```text
1100: 
1101:     function queryRunWorkspacePatch(snapshot = readCurrentQueryRun()) {
1102:       if (!snapshot?.run) return null;
1103:       const run = snapshot.run;
1104:       const result = run.result || {};
1105:       const rows = result.rows || result.highlights || [];
1106:       const objects = rows.map((item) => ({ id: item.stableId || item.objectId || item.subjectId || item.enterpriseId || item.id || "", label: item.object || item.name || item.label || item.title || "", type: item.objectType || item.type || "业务对象" })).filter((item) => item.id || item.label);
1107:       const first = objects[0] || null;
1108:       const dataAsOf = run.context?.dataAsOf || run.context?.asOf || snapshot.queryState?.scenarioContext?.formedAt?.slice?.(0, 10) || "";
1109:       const resultKind = String(result.resultKind || result.identity || "FACT").toLowerCase();
```

`designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:930`

```text
928:     async function executeQuestion(question, targetScenarioId = scenarioId) {
929:       const baseSpec = questionSpec(question, targetScenarioId);
930:       if (!baseSpec) return;
931:       const spec = { ...baseSpec, resultMode: baseSpec.type === "simulation" ? "simulation" : baseSpec.type === "difference" ? "difference" : /候选/.test(question) || ["probability", "liquidity", "contagion"].includes(baseSpec.type) ? "candidate" : workspaceResultMode().id };
932:       const queryContext = { ...clone(resolvedWorkspaceContext()), scenarioId: targetScenarioId, resultView: spec.resultMode, resultMode: { id: spec.resultMode, label: W.modes[spec.resultMode] } };
933:       cancelQueryRecord("开始新问题后，上一查询已取消。");
934:       pendingQueryRun = { question, spec, queryScenarioId: targetScenarioId, workspaceContext: queryContext };
935:       clearQueryTimers();
936:       const epoch = ++queryEpoch;
937:       queryRunning = true;
```

`designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:838`

```text
836: 
837:     function buildQueryAnswer(spec, question, runtimeContext = context, targetScenarioId = scenarioId, scopeContext = workspaceContext) {
838:       const current = state(runtimeContext);
839:       const subjects = normalizedSubjects(W.envelopeFor(current, spec.resultMode || workspaceResultMode().id), current);
840:       const subjectByName = new Map(subjects.map((item) => [item.name, item]));
841:       const rows = queryRows(spec, runtimeContext, targetScenarioId, scopeContext).map((item) => {
842:         const subject = item.id ? null : subjectByName.get(item.name);
843:         return { ...item, id: item.id || subject?.id || "", objectType: item.objectType || runtimeContext?.ui?.subjectLabel || "业务对象" };
844:       });
845:       const s005Ready = targetScenarioId === "S005" && targetScenarioId === scenarioId && (spec.type === "status" || rows.length > 0);
```

`designs/prototype-work/v1.4/composite/shared/workflow.js:29`

```text
27:   }
28: 
29:   function scopeRows(rows, context = {}, scope = "auto") {
30:     if (scope === "auto" && ["object", "set", "all"].includes(context.analysisScope)) scope = context.analysisScope;
31:     const object = context.activeObjectRef || context.object;
32:     const set = context.objectSetRef || context.objectSet;
33:     if (scope !== "all" && scope !== "set" && object?.id) return rows.filter((item) => subjectId(item) === canonicalId(object.id));
34:     const ids = set?.objectIds || set?.ids;
35:     if (scope !== "all" && Array.isArray(ids) && (ids.length || set?.selectionMode)) {
36:       const selected = new Set(ids.map(canonicalId));
```

# R14-006 小数降息和授信收缩参数被静默改为0

`designs/prototype-work/v1.4/src/domain.js:410`

```text
408:       "当前问题无法映射到已登记业务口径，请指定企业、融资成本、到期本金、银行敞口或担保关系。",
409:     );
410:   const rate = /(降息|加息)\s*(\d+)\s*bp/i.exec(q),
411:     credit = /收缩\s*(\d+)\s*[%％]/.exec(q),
412:     extension = /展期\s*(\d+)\s*天/.exec(q),
413:     threshold = /(?:高于|超过|偏离)\s*(\d+(?:\.\d+)?)\s*bp/i.exec(q);
414:   const horizonText = q.replace(/展期\s*\d+\s*天/g, "");
415:   const dayMatch = /(\d+)\s*天/.exec(horizonText);
416:   if (dayMatch && ![30, 90, 180, 365].includes(Number(dayMatch[1])))
417:     throw new Error("当前展望窗口支持30、90、180或365天。");
```

`designs/prototype-work/v1.4/src/domain.js:428`

```text
426:       ? { gapOnly: true }
427:       : {}),
428:     ...(intent === "simulate"
429:       ? {
430:           parameters: scenarioSchema.parse({
431:             ...defaultParams(),
432:             rateBps: rate ? Number(rate[2]) * (rate[1] === "降息" ? -1 : 1) : 0,
433:             creditHaircut: credit ? Number(credit[1]) : 0,
434:             extensionDays: extension ? Number(extension[1]) : 0,
435:             bankId: bank?.id || null,
```

# R14-007 集团余额推荐问题只回答板块成本，关键请求指标缺失

`designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js:139`

```text
137:   });
138:   const recommendations = Object.freeze([
139:     recommendation("s001-group-cost", "group-overview", "S001", "集团融资盘面", "集团当前融资余额和平均融资成本分别是多少？", "融资成本", ["MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"]),
140:     recommendation("s001-sector-rank", "group-overview", "S001", "板块成本梯度", "哪个产业板块平均融资成本最高，和最低板块相差多少？", "融资成本", ["PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-FINANCING-COST"]),
141:     recommendation("s001-rate-structure", "group-overview", "S001", "利率结构", "集团浮动利率融资占比多高，短期债务占比是多少？", "融资成本", ["MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"]),
142:     recommendation("s001-553-cost", "unit-cost", "S001", "单位553成本", "单位553平均融资成本、融资余额和高成本融资占比分别是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-HIGH-COST-BALANCE-RATIO"]),
143:     recommendation("s001-465-561", "pair-cost", "S001", "两家单位对比", "单位465和单位561谁的平均融资成本更高，相差多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
144:     recommendation("s001-pair", "pair-cost", "S001", "两家综合成本", "单位553和单位465合在一起的融资余额和平均成本是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
145:     recommendation("s001-triple", "triple-cost", "S001", "三家综合成本", "单位553、单位465和单位561合计融资余额和综合平均成本是多少？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"]),
146:     recommendation("s001-unit-rank", "triple-cost", "S001", "三家成本排序", "单位553、单位465和单位561的平均融资成本从高到低怎么排？", "融资成本", ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST"]),
```

`designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/data.jsx:404`

```text
402:       ["去掉单位561后重新计算。", "三家分别命中了哪些规则？"]
403:     ),
404:     "group-overview": result(
405:       "group-overview", "集团融资成本与产业板块对比", ["集团"],
406:       ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "LINK-ENTITY-FINANCING", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"],
407:       "集团融资余额为 21,613.387 亿元，平均融资成本为 2.372%。浮动利率融资占比 95.149%，产业板块之间存在成本差异。",
408:       [
409:         { id: "group-cost", rowId: "group", resourceId: "MET-WAVG-FINANCING-COST", label: "集团平均融资成本", value: "2.372%", exact: "2.372", unit: "%" },
410:         { id: "group-balance", resourceId: "MET-FINANCING-BALANCE", label: "集团融资余额", value: "21,613.387 亿元", exact: "21613.387", unit: "亿元" },
411:         { id: "floating", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", label: "浮动利率融资占比", value: "95.149%", exact: "95.149", unit: "%", tone: "warning" },
```

# R14-008 报告交接把基准标成压力模拟，目录又回退为候选结果

`designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:173`

```text
171:     )
172:       throw new Error("联合分析报告缺少固定依据");
173:     const context = scopeContext({ objectIds: report.evidence.objectIds });
174:     const workspaceContext = {
175:       ...context,
176:       sourceModuleId: "joint-workbench",
177:       resultView: "simulation",
178:       dataVersionRef: { id: report.evidence.dataVersion },
179:       ontologyVersionRef: { id: report.evidence.ontologyVersion },
180:       evidenceRefs: [report.evidence.dataDigest],
```

`designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:225`

```text
223:         resultMode: "simulation",
224:         resultId: identity,
225:         modelVersionId: null,
226:         dataVersionId: report.evidence.dataVersion,
227:         ontologyVersionId: report.evidence.ontologyVersion,
228:         text: `联合态势演示分析，非正式融资事实。${report.evidence.horizon}天窗口；${report.notes || ""}`,
229:         rows: report.rows.map((row) => ({
230:           id: row.id,
231:           name: row.name,
232:           value: row[key] === null ? null : row[key] / scale,
```

`designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1656`

```text
1654:       row.className = "resource-row canonical-ledger-row ofw-native-report-row";
1655:       row.dataset.ofwNativeReport = scenarioId;
1656:       row.innerHTML = `<div class="ledger-primary"><span class="eyebrow">模型监测草稿</span><strong>${esc(reportDraft.title)}</strong><small>${esc(reportDraft.reportId)} · ${esc(context?.ui?.businessName || scenarioId)}</small></div><div class="resource-meta"><span>报告范围</span><strong>${esc(reportDraft.workspaceContext?.objectSet?.label || "当前业务范围")}</strong><small>${esc(reportDraft.workspaceContext?.object?.label || "未聚焦单个对象")}</small></div><div class="resource-meta"><span>时间 / 结果</span><strong>${esc(reportDraft.workspaceContext?.timeRange?.label || state().scenario?.dataAsOf || "当前周期")}</strong><small>${esc(reportDraft.workspaceContext?.resultMode?.label || "候选结果")}</small></div><div class="resource-meta"><span>形成时间</span><strong>${esc(reportDraft.formedAt.replace("T", " ").slice(0, 16))}</strong></div><div class="ledger-state"><span class="badge warning">待复核</span></div><div class="inline-actions"><button class="text-btn" type="button" data-ofw-native-action="report-open">查看详情</button></div>`;
1657:       list.prepend(row);
1658:     }
1659: 
1660:     function dashboardEnvelope(view) {
1661:       if (view === "formal") return state().results?.formalEnvelope || state().formalBaseline?.resultEnvelope || null;
1662:       if (view === "candidate" || view === "difference") return state().results?.candidateEnvelope || null;
1663:       if (view === "shadow") return state().results?.shadowEnvelope || null;
```

# R14-009 问数超过8条后旧答案无入口可回看或继续处理

`designs/prototype-work/v1.4/src/app.js:349`

```text
347:     get().queries.length
348:       ? get()
349:           .queries.slice(0, 8)
350:           .map(
351:             (answer) =>
352:               `<article class="answer"><div class="question-bubble">${esc(answer.question)}</div><header>${icon(answer.status === "failed" ? "circle-alert" : "sparkles")}<strong>${answer.status === "failed" ? "未完成" : answer.status === "cancelled" ? "已取消" : "分析结果"}</strong><span>${answer.evidence?.resultKind === "SIMULATION" ? "模拟" : "固定快照"}</span></header><p>${esc(answer.summary)}</p>${(
353:                 answer.refs || []
354:               )
355:                 .slice(0, 5)
356:                 .map((ref) =>
```

`designs/prototype-work/v1.4/src/app.js:1061`

```text
1059:       createdAt: new Date().toISOString(),
1060:     };
1061:     save({ queries: [saved, ...get().queries].slice(0, 30) });
1062:     if (["filter", "overview"].includes(answer.parsed.intent))
1063:       applyFilters(answer.filters, answer.horizon);
1064:     if (answer.parsed.intent === "simulate")
1065:       notify("分析范围已固定，可打开方案调整参数");
1066:   } catch (error) {
1067:     save({
1068:       queries: [
```

# R14-010 无匹配企业时融资成本显示“暂无%”

`designs/prototype-work/v1.4/src/app.js:248`

```text
246:   document.getElementById("metric-strip").innerHTML = [
247:     ["融资余额", amount(results.totals.balance), "balance"],
248:     ["加权融资成本", `${fmt(results.totals.cost)}%`, "weightedCost"],
249:     [`${get().horizon}天到期`, amount(results.totals.due), "maturity"],
250:     ["测算资金缺口", amount(results.totals.gap), "gap"],
251:     [
252:       "风险关注",
253:       `${results.totals.attention} / ${rows.length} 家`,
254:       "riskScore",
255:     ],
```
