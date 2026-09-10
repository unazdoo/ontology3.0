(function installObjectExperience(global) {
  'use strict';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const value = (item, key) => item?.properties?.[key]?.value;
  const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6 });
  const shortNumber = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
  const textValue = (v, unit = '') => numeric(v) ? `${['%','分'].includes(unit)?shortNumber.format(v):number.format(v)}${unit ? ` ${unit}` : ''}` : String(v ?? '—');
  const detailedTypes = new Set(['OBJ-FINANCING-DETAIL', 'OBJ-HOLDING-OBSERVATION', 'OBJ-ENTERPRISE-BUDGET-DETAIL']);
  const bridgeTypes = new Set(['OBJ-FINANCING-DETAIL', 'OBJ-FINANCING-ENTITY', 'OBJ-INVESTMENT-HOLDING']);
  const eventSources = Object.freeze([
    { id: 'rule', label: '本体规则', description: '业务指标命中已发布规则，保留规则版本、条件和命中值。' },
    { id: 'model', label: '模型监控', description: '模型输出满足已发布的预警条件，保留模型版本、运行批次和评估时点。' },
    { id: 'business', label: '业务事实', description: '业务系统记录的逾期、违约、评级调整等已发生事实，保留原始事件编号。' }
  ]);

  function create(resource) {
    const byId = new Map(resource.objects.map(item => [item.id, item]));
    const links = new Map();
    for (const link of resource.links) for (const id of [link.from, link.to]) {
      if (!links.has(id)) links.set(id, []);
      links.get(id).push(link);
    }
    const other = (link, id) => byId.get(link.from === id ? link.to : link.from);
    const linkLabel = (link, id) => link.from === id ? link.label : link.reverseLabel || link.label;
    const relationCache = new Map();
    function relations(item) {
      if (relationCache.has(item.id)) return relationCache.get(item.id);
      const found = new Map();
      for (const link of links.get(item.id) || []) {
        const target = other(link, item.id);
        if (!target) continue;
        if (!detailedTypes.has(target.objectTypeId) && target.objectTypeId !== 'OBJ-FINANCING-ENTITY') {
          found.set(target.id, { item: target, label: linkLabel(link, item.id), path: [link.id], via: [] });
        }
        if (!bridgeTypes.has(target.objectTypeId)) continue;
        for (const next of links.get(target.id) || []) {
          const end = other(next, target.id);
          if (!end || end.id === item.id || detailedTypes.has(end.objectTypeId) || end.objectTypeId === 'OBJ-FINANCING-ENTITY') continue;
          const existing = found.get(end.id);
          if (existing && existing.path.length === 1) continue;
          if (existing) { if (!existing.via.includes(target.id)) existing.via.push(target.id); continue; }
          found.set(end.id, { item: end, label: `${linkLabel(link, item.id)} · ${linkLabel(next, target.id)}`, path: [link.id, next.id], via: [target.id] });
        }
      }
      const result = [...found.values()].sort((a, b) => a.path.length - b.path.length || a.item.title.localeCompare(b.item.title, 'zh-CN'));
      relationCache.set(item.id, result);
      return result;
    }
    function relationSummary(item) {
      const groups = new Map();
      for (const relation of relations(item)) {
        const type = relation.item.objectTypeId;
        if (!groups.has(type)) groups.set(type, { type, label: resource.typeMetadata[type]?.label || type, count: 0 });
        groups.get(type).count++;
      }
      const financing = resource.collections.find(collection => collection.id === `financing:${item.id}`);
      return [...(financing ? [{ type: 'OBJ-FINANCING-DETAIL', label: '融资借据', count: financing.memberIds.length, collectionId: financing.id }] : []), ...groups.values()];
    }
    function ruleEvents(item) {
      return (resource.businessRules || []).filter(rule => rule.ownerId === item.id && ['命中', 'triggered'].includes(value(rule, 'status'))).map(rule => ({
        id: rule.id, objectId: item.id, title: rule.title, source: 'rule', category: '本体规则命中',
        severity: 'warning', date: value(rule, 'evaluatedAt'), timeLabel: '评估截至',
        condition: value(rule, 'condition'), observed: `${value(rule, 'metricLabel')}：${textValue(value(rule, 'observedValue'), rule.properties.observedValue?.unit)}`,
        note: value(rule, 'condition'), definitionId: value(rule, 'ruleId'),
        sourceVersion: rule.canonicalObjectRef?.ontologyVersionId, sourceName: '集团融资本体',
        evidenceRefs: rule.sourceRefs || [], sourceDetail: '已发布规则的既有求值结果'
      }));
    }
    function modelEvents(item, monitor) {
      const envelope = monitor?.context?.state?.results?.formalEnvelope;
      const baseline = monitor?.context?.state?.formalBaseline;
      const modelPackage = monitor?.modelPackage;
      if (!envelope || envelope.resultKind !== 'FACT' || !envelope.actionSourceAllowed || !modelPackage || envelope.modelVersionId !== baseline?.modelVersionId) return [];
      const row = envelope.subjects.find(subject => subject.enterpriseId === `S003-${item.id}`);
      const tier = modelPackage.riskTiers.find(entry => entry.name === row?.tier);
      const action = modelPackage.actionTypes.find(entry => entry.triggerTier === tier?.tierId);
      if (!row || !tier || !action) return [];
      return [{
        id: `model-alert:${envelope.resultId}:${row.enterpriseId}`, objectId: item.id, source: 'model', category: '模型监控预警',
        title: `债务风险${row.tier}预警`, severity: tier.tierId === 'YELLOW' ? 'warning' : 'danger', date: envelope.asOf, timeLabel: '评估截至',
        condition: `正式评分落入${row.tier}区间：${tier.minInclusive} ≤ 评分${tier.maxExclusive == null ? '' : ` < ${tier.maxExclusive}`}`,
        observed: `综合评分 ${textValue(row.score, '分')} · ${row.tier}`,
        note: (row.topContributors || []).slice(0, 3).map(entry => entry.name).join('、'),
        sourceName: baseline.name, sourceVersion: envelope.modelVersionId, definitionId: envelope.modelId,
        dataVersionId: envelope.dataVersionId, ontologyVersionId: envelope.ontologyVersionId,
        runId: envelope.runId, resultId: row.formalResultId, formedAt: envelope.formedAt,
        evidenceRefs: [...envelope.evidenceRefs, ...(row.topContributors || []).map(entry => entry.evidenceRef)],
        sourceDetail: '按已发布模型包的风险分档和预警行动条件读取正式评估结果', actionTypeId: action.actionTypeId
      }];
    }
    function events(item, monitor) {
      const facts = (resource.businessEvents || []).filter(event => event.objectId === item.id && event.source === 'business' && event.originEventId && event.evidenceRefs?.length);
      return [...ruleEvents(item), ...modelEvents(item, monitor), ...(global.OFW_STUDIO_SIGNALS?.forObject(item.id)||[]), ...facts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    function suggestedQuestions(item) {
      return [
        '这个对象的基本情况如何？',
        ...(item.budgetOwnership || item.objectTypeId.includes('BUDGET') ? ['预算执行情况如何？'] : []),
        ...(['OBJ-INVESTMENT-PRODUCT', 'OBJ-INVESTMENT-HOLDING'].includes(item.objectTypeId) ? ['持仓发生了什么变化？'] : ['有哪些风险事件？']),
        '与哪些对象有关联？', '当前办理进展如何？'
      ];
    }
    function answer(item, question, { monitor, records = [], series = [], previousIntent } = {}) {
      const q = question.trim();
      const relationIds = new Set(relations(item).map(entry => entry.item.id));
      const foreign = resource.objects.find(candidate => candidate.id !== item.id && !relationIds.has(candidate.id) && candidate.title.length > 3 && q.includes(candidate.title));
      const base = { objectId: item.id, question: q, asOf: item.dataAsOf, evidenceRefs: [...item.sourceRefs], facts: [], relatedIds: [], paragraphs: [] };
      if (foreign) return { ...base, intent: 'scope', paragraphs: [`当前对话围绕${item.title}。请打开${foreign.title}的画像后提问，或通过“对照查看”比较两个对象。`] };
      let intent = /预算|费用|收入|执行率|超支/.test(q) ? 'budget' : /风险|预警|事件|命中|规则/.test(q) ? 'events' : /关联|关系|机构|银行|部门/.test(q) ? 'relations' : /持仓|走势|变化|损益|市值|现价/.test(q) ? 'history' : /办理|行动|进展|待办/.test(q) ? 'actions' : /情况|概览|基本|介绍|概况|多少|余额|利率|成本|位置|在哪|哪里/.test(q) ? 'overview' : /为什么|原因|依据|解释/.test(q) ? previousIntent || 'events' : 'unsupported';
      if(/风险评分|综合评分/.test(q)&&/多少|几分|是多少/.test(q))intent='overview';
      if (/实时|预测|明天|下月|买入|卖出/.test(q)) intent = 'unsupported';
      const result = { ...base, intent };
      const addProperty = (target, key, label) => {
        const property = target.properties[key];
        if (property?.value == null || typeof property.value === 'object') return;
        result.facts.push({ label: label || property.propertyLabel || key, value: textValue(property.value, property.unit), asOf: property.asOf || target.dataAsOf });
        result.evidenceRefs.push(...(property.sourceRefs || []));
      };
      if (intent === 'overview') {
        if(item.location?.city)result.facts.push({label:'所在城市',value:item.location.city,asOf:item.dataAsOf});
        for (const key of ['industry', 'category', 'riskScore', 'riskTier', 'balance', 'averageFinancingCost', 'value', 'cost', 'pnl', 'price', 'budgetAmount', 'actualAmount', 'executionRate', 'rate', 'balanceYuan']) addProperty(item, key);
        if(!result.facts.length){result.facts.push({label:'业务身份',value:resource.typeMetadata[item.objectTypeId]?.label||item.title,asOf:item.dataAsOf});result.facts.push(...relationSummary(item).map(group=>({label:group.label,value:`${group.count} 个`,asOf:item.dataAsOf})));}
        result.paragraphs.push(`${item.title}的当前业务信息如下，各项保留其实际数据截至日。`);
      } else if (intent === 'events') {
        const list = events(item, monitor);
        result.paragraphs.push(list.length ? `当前有${list.length}项风险事件，来源和触发依据如下。` : '当前已读取的结果没有触发风险事件。日常评分属于对象状态，办理日志在“行动与进展”查看。');
        for (const event of list) {
          result.facts.push({ label: `${event.category} · ${event.title}`, value: `${event.observed}；${event.condition}`, asOf: event.date });
          result.evidenceRefs.push(...event.evidenceRefs);
          if (event.note && event.source === 'model') result.paragraphs.push(`本次评分的主要贡献项：${event.note}。`);
        }
      } else if (intent === 'relations') {
        const related = relations(item);
        result.paragraphs.push(`${item.title}的业务关系按本体中已发布的关系连接。`);
        result.facts = relationSummary(item).map(group => ({ label: group.label, value: `${group.count} 个`, asOf: item.dataAsOf }));
        result.relatedIds = related.slice(0, 12).map(entry => entry.item.id);
        result.evidenceRefs.push(...related.flatMap(entry => entry.path));
      } else if (intent === 'budget') {
        const years=[...new Set(q.match(/20\d{2}/g)||[])];
        if(years.length>1)return {...result,intent:'unsupported',paragraphs:['请指定一个年度查看预算执行；不同年度可从关联部门的历史观测中并排查看。']};
        const year=Number(years[0]||2025);
        const annuals = resource.objects.filter(o => o.objectTypeId === 'OBJ-ENTERPRISE-BUDGET-ANNUAL' && (item.budgetOwnership ? o.parentEnterpriseId === item.id : o.departmentId === item.departmentId || o.id === item.id) && value(o, 'year') === year);
        if (!annuals.length) result.paragraphs.push('当前对象没有适用的企业预算分析范围，可询问其基本情况、关联对象或风险事件。');
        else {
          const total = key => annuals.reduce((sum, row) => sum + (numeric(value(row, key)) ? value(row, key) : 0), 0);
          const budget = total('budgetAmount'), actual = total('actualAmount');
          result.asOf=[...new Set(annuals.map(row=>row.dataAsOf))].join("、");
          result.paragraphs.push(`${year}年纳入${annuals.length}个部门年度预算。`);
          result.facts = [{ label: '费用预算', value: textValue(budget, '万元') }, { label: '实际费用', value: textValue(actual, '万元') }, { label: '执行率', value: budget ? textValue(actual / budget * 100, '%') : '不适用' }];
          result.relatedIds = annuals.map(row => row.id); result.evidenceRefs.push(...annuals.flatMap(row => row.sourceRefs));
        }
      } else if (intent === 'history') {
        const requested = /投资金额|成本/.test(q) ? '投资金额' : /损益|盈亏/.test(q) ? '损益' : /现价|价格/.test(q) ? '现价' : '市值';
        const selected = series.find(s => s.label.includes(requested)) || series[0];
        const points = (selected?.points || []).filter(p => numeric(p.v)).sort((a, b) => a.t.localeCompare(b.t));
        if (!points.length) result.paragraphs.push('当前对象按静态业务快照展示，可以询问基本情况或关联业务。');
        else {
          const first = points[0], last = points.at(-1);
          result.paragraphs.push(`${selected.relatedTitle ? `关联汇总持仓的${selected.label}` : selected.label}，共有${points.length}个实际观测。`);
          result.facts = [{ label: '首个观测', value: textValue(first.v, selected.unit), asOf: first.t }, { label: '最近观测', value: textValue(last.v, selected.unit), asOf: last.t }];
          if (points.length > 1) result.facts.push({ label: '区间变化', value: textValue(last.v - first.v, selected.unit), asOf: `${first.t} 至 ${last.t}` });
          result.paragraphs.push('市值变化同时受持仓规模和价格影响，不等于产品收益率。');
          result.evidenceRefs.push(selected.id, ...(first.sourceRefs || []), ...(last.sourceRefs || []));
        }
      } else if (intent === 'actions') {
        result.paragraphs.push(records.length ? `当前有${records.length}项相关办理事项。` : '当前没有已登记的办理事项。');
        result.facts = records.map(record => ({ label: record.request.actionType?.name || '业务事项', value: `${record.stage} · ${record.task?.owner || record.request.owner || record.request.recipientName || '按事项分办'}`, asOf: record.task?.dueDate ? `期限 ${record.task.dueDate}` : '' }));
        result.evidenceRefs.push(...records.map(record => record.request.id));
      } else result.paragraphs.push('当前可回答经营指标、风险事件、关联业务、历史观测和办理进展。请指定其中一个主题或点击建议问题；尚不支持开放式预测和交易建议。');
      result.evidenceRefs = [...new Set(result.evidenceRefs.filter(Boolean))];
      return result;
    }
    return { relations, relationSummary, events, answer, suggestedQuestions };
  }
  global.OFW_OBJECT_EXPERIENCE = Object.freeze({ create, eventSources });
})(typeof window === 'undefined' ? globalThis : window);
