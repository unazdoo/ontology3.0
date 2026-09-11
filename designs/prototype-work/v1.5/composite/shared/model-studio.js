export const MODEL_STORE_KEY = 'ofw.v15.model-studio.v1';
const copy = value => structuredClone(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
export async function fingerprint(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function costAlgorithm(input, p) {
  const start = new Date(input.asOf + 'T00:00:00Z');
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + p.months + 1, 0));
  const days = (end - start) / 86400000;
  const rows = input.companies.map(company => {
    const loans = input.loans.filter(loan => loan.enterpriseId === company.id);
    const balance = loans.reduce((sum, loan) => sum + loan.principalYuan, 0);
    const baselineRate = balance ? loans.reduce((sum, loan) => sum + loan.principalYuan * loan.rate, 0) / balance : 0;
    let predictedInterest = 0, exposureYears = 0;
    const details = loans.map(loan => {
      const remaining = Math.min(days, Math.max(0, (new Date(loan.maturityDate + 'T00:00:00Z') - start) / 86400000));
      const rate = Math.max(0, loan.rate + (loan.rateType === 'FLOATING' ? p.rateShockBps / 100 : 0));
      const refinanceRate = Math.max(0, rate + p.refinanceSpreadBps / 100);
      const renewal = loan.principalYuan * p.rolloverPct / 100;
      const interest = loan.principalYuan * rate / 100 * remaining / 365 + renewal * refinanceRate / 100 * (days - remaining) / 365;
      predictedInterest += interest;
      exposureYears += (loan.principalYuan * remaining + renewal * (days - remaining)) / 365;
      return { loanId: loan.id, principalYuan: loan.principalYuan, currentRate: loan.rate, forecastRate: rate, refinanceRate, interestYuan: interest };
    });
    const baselineInterest = balance * baselineRate / 100 * days / 365;
    return { enterpriseId: company.id, name: company.name, balanceYuan: balance, baselineRate, predictedRate: exposureYears ? predictedInterest / exposureYears * 100 : 0, baselineInterest, predictedInterest, deltaInterest: predictedInterest - baselineInterest, averageBalance: exposureYears * 365 / days, details, conclusion: `按利率情景与${p.rolloverPct}%续作比例计算，未假设新增借款。` };
  });
  return { kind: 'COST_FORECAST', asOf: input.asOf, horizonEnd: end.toISOString().slice(0, 10), rows };
}

function structureAlgorithm(input, p) {
  const start = new Date(input.asOf + 'T00:00:00Z');
  const end = new Date(start.valueOf() + p.horizonDays * 86400000);
  const rows = input.companies.map(company => {
    const loans = input.loans.filter(loan => loan.enterpriseId === company.id);
    const balance = loans.reduce((sum, loan) => sum + loan.principalYuan, 0);
    const baselineRate = balance ? loans.reduce((sum, loan) => sum + loan.principalYuan * loan.rate, 0) / balance : 0;
    const shortLoans = loans.filter(loan => loan.maturityDate <= end.toISOString().slice(0, 10)).sort((a, b) => a.maturityDate.localeCompare(b.maturityDate) || b.rate - a.rate);
    const due = shortLoans.reduce((sum, loan) => sum + loan.principalYuan, 0);
    const needed = Math.max(0, due - balance * p.targetShortPct / 100);
    let remaining = Math.min(needed, balance * p.maxRefinancePct / 100), annualCostDelta = 0;
    const decisions = [];
    for (const loan of shortLoans) {
      if (remaining <= 0.000001) break;
      const newRate = Math.max(0, loan.rate + p.termPremiumBps / 100);
      const extraRate = newRate - loan.rate;
      const costRoom = balance * p.maxExtraCostBps / 10000 - annualCostDelta;
      const amount = Math.max(0, Math.min(loan.principalYuan, remaining, extraRate > 0 ? costRoom * 100 / extraRate : remaining));
      if (amount <= 0) continue;
      const date = new Date(loan.maturityDate + 'T00:00:00Z');
      const newDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + p.tenorMonths + 1, 0)).toISOString().slice(0, 10);
      annualCostDelta += amount * extraRate / 100; remaining -= amount;
      decisions.push({ loanId: loan.id, amountYuan: amount, fromDate: loan.maturityDate, toDate: newDate, currentRate: loan.rate, proposedRate: newRate });
    }
    const refinanceAmount = decisions.reduce((sum, decision) => sum + decision.amountYuan, 0);
    const optimizedShortRatio = balance ? (due - refinanceAmount) / balance * 100 : 0;
    const achieved = optimizedShortRatio <= p.targetShortPct + 0.000001;
    return { enterpriseId: company.id, name: company.name, balanceYuan: balance, baselineRate, projectedRate: balance ? baselineRate + annualCostDelta / balance * 100 : 0, baselineShortRatio: balance ? due / balance * 100 : 0, optimizedShortRatio, refinanceAmount, annualCostDelta, achieved, decisions, conclusion: !needed ? '当前已达到期限结构目标，无需调整。' : achieved ? '在调整额度和成本约束内达到目标；建议仍需业务复核。' : '形成约束内的部分调整建议，当前限额不足以达到全部目标。' };
  });
  return { kind: 'DEBT_OPTIMIZATION', asOf: input.asOf, horizonEnd: end.toISOString().slice(0, 10), rows };
}

function riskAlgorithm(input, p) {
  const end = new Date(Date.parse(input.asOf + 'T00:00:00Z') + p.horizonDays * 86400000).toISOString().slice(0, 10);
  const rows = input.companies.map(company => {
    const loans = input.loans.filter(loan => loan.enterpriseId === company.id);
    const balance = loans.reduce((sum, loan) => sum + loan.principalYuan, 0);
    const due = loans.filter(loan => loan.maturityDate <= end).reduce((sum, loan) => sum + loan.principalYuan, 0);
    const credit = input.facilities.filter(facility => facility.enterpriseId === company.id && facility.validUntil >= end).reduce((sum, facility) => sum + facility.undrawnYuan, 0);
    const gap = Math.max(0, due - company.cashYuan - credit), gapRatio = balance ? gap / balance * 100 : 0;
    const cost = balance ? loans.reduce((sum, loan) => sum + loan.principalYuan * loan.rate, 0) / balance : 0;
    const premium = (cost - company.benchmarkRate) * 100;
    let severity = 0; const reasons = [];
    if (company.riskScore < p.redScore) { severity = 2; reasons.push({ label: '历史评分关注', value: company.riskScore, unit: '分', condition: `低于 ${p.redScore} 分` }); }
    else if (company.riskScore < p.amberScore) { severity = 1; reasons.push({ label: '历史评分关注', value: company.riskScore, unit: '分', condition: `低于 ${p.amberScore} 分` }); }
    if (gapRatio >= p.redGapPct && gap > 0) { severity = 2; reasons.push({ label: '测算资金缺口', value: gapRatio, unit: '%', condition: `缺口占本金至少 ${p.redGapPct}%` }); }
    else if (gap > 0) { severity = Math.max(severity, 1); reasons.push({ label: '测算资金缺口', value: gap, unit: '元', condition: '窗口内资金覆盖不足' }); }
    if (premium > p.costPremiumBps) { severity = Math.max(severity, 1); reasons.push({ label: '融资成本偏离', value: premium, unit: 'bp', condition: `高于产业演示基准 ${p.costPremiumBps}bp` }); }
    return { enterpriseId: company.id, name: company.name, historicalScore: company.riskScore, historicalTier: company.riskTier, level: ['GREEN', 'AMBER', 'RED'][severity], severity, gapYuan: gap, dueYuan: due, reasons, conclusion: reasons.length ? '模型监控提示，供业务复核；不改写历史评分，也不代表已发生违约。' : '本次输入未触发所选监控条件。' };
  });
  return { kind: 'MONITOR_ALERT', asOf: input.asOf, horizonEnd: end, rows };
}

const parameter = (key, label, value, min, max, unit, help) => ({ key, label, value, min, max, unit, help });
export const MODEL_TEMPLATES = Object.freeze({
  cost: { name: '融资成本预测', question: '给定利率与续作假设，企业未来融资成本和利息支出如何变化？', method: '按借款现金流进行利率情景预测', resultLabel: '成本预测', outputKind: 'COST_FORECAST', algorithm: costAlgorithm, inputs: ['企业与借款身份', '本金（元）', '当前年利率（%）', '利率类型', '到期日期'], parameters: [parameter('months', '预测期', 12, 1, 36, '月', '从数据观察日开始'), parameter('rateShockBps', '浮息利率变化', 50, -300, 500, 'bp', '100bp = 1个百分点；固定利率不随该参数变化'), parameter('refinanceSpreadBps', '到期续作利差', 0, -200, 500, 'bp', '相对于续作时的预测利率'), parameter('rolloverPct', '到期本金续作比例', 100, 0, 100, '%', '剩余部分视作偿还；不假设新增借款')] },
  structure: { name: '债务结构优化', question: '在调整额度和成本约束内，如何降低窗口内集中到期比例？', method: '按到期顺序与成本优先的约束调整算法', resultLabel: '结构调整建议', outputKind: 'DEBT_OPTIMIZATION', algorithm: structureAlgorithm, inputs: ['企业与借款身份', '本金（元）', '当前年利率（%）', '到期日期'], parameters: [parameter('horizonDays', '到期分析窗口', 365, 30, 365, '天', '判断哪些借款属于当前短期到期范围'), parameter('targetShortPct', '目标到期本金占比上限', 30, 0, 100, '%', '在当前分析窗口内'), parameter('maxRefinancePct', '最大调整额度占比', 50, 0, 100, '%', '相对于当前存续融资本金'), parameter('tenorMonths', '新增期限', 36, 13, 120, '月', '从原到期日延长'), parameter('termPremiumBps', '期限调整利差', 20, -200, 500, 'bp', '长期化可能增加成本'), parameter('maxExtraCostBps', '允许的整体成本增加', 25, 0, 500, 'bp', '约束整体余额加权成本增加')] },
  risk: { name: '债务风险监测', question: '哪些企业需要因历史评分、偿债缺口或成本偏离进一步复核？', method: '历史风险基线与资金压力联合监控', resultLabel: '模型监控提示', outputKind: 'MONITOR_ALERT', algorithm: riskAlgorithm, inputs: ['历史评分与分档', '借款本金与到期日', '企业现金', '授信及有效期', '产业演示基准利率'], parameters: [parameter('horizonDays', '监控展望窗口', 90, 30, 365, '天', '结合到期本金与有效授信'), parameter('amberScore', '评分关注界限', 40, 0, 100, '分', '模板默认沿用既有关注界限，可维护'), parameter('redScore', '评分重点关注界限', 25, 0, 100, '分', '必须低于或等于关注界限'), parameter('redGapPct', '重点关注缺口占比', 10, 0, 100, '%', '新监控策略的示例参数'), parameter('costPremiumBps', '成本偏离关注界限', 25, 0, 500, 'bp', '相对于产业演示基准')] }
});
export const defaultParameters = type => Object.fromEntries(MODEL_TEMPLATES[type].parameters.map(p => [p.key, p.value]));
export const runtimeParameterSpecs = type => MODEL_TEMPLATES[type].parameters.filter(spec=>type!=='risk'||spec.key==='horizonDays');
export const defaultCode = type => `// ${MODEL_TEMPLATES[type].method}\n// input 已固定为本次运行的数据；金额统一为元。\nreturn (${MODEL_TEMPLATES[type].algorithm.toString()})(input, parameters);`;
export function validateParameters(type, parameters) {
  const template = MODEL_TEMPLATES[type]; if (!template) throw Error('不支持的目标类型');
  for (const spec of template.parameters) if (!finite(parameters[spec.key]) || parameters[spec.key] < spec.min || parameters[spec.key] > spec.max) throw Error(`${spec.label}须在 ${spec.min}–${spec.max}${spec.unit} 之间`);
  for (const key of ['months', 'horizonDays', 'tenorMonths']) if (key in parameters && !Number.isInteger(parameters[key])) throw Error('预测期、窗口和期限须填写整数');
  if (type === 'risk' && parameters.redScore > parameters.amberScore) throw Error('重点关注评分界限不能高于关注界限');
}
export function normalizeModelInput(data, objectIds) {
  const ids = [...new Set(objectIds)];
  if (!ids.length || ids.some(id => !data.enterprises.some(company => company.id === id))) throw Error('请选择当前数据版本范围内的企业');
  return { asOf: data.asOf, dataVersion: data.dataVersion, ontologyVersion: data.ontologyVersion, sourceDigest: data.digest, moneyUnit: '元', companies: data.enterprises.filter(company => ids.includes(company.id)).map(company => ({ id: company.id, name: company.name, cashYuan: company.cash * 1e6, benchmarkRate: company.benchmarkRate, riskScore: company.riskScore, riskTier: company.riskTier })), loans: data.loans.filter(loan => ids.includes(loan.enterpriseId) && loan.startDate <= data.asOf && loan.maturityDate > data.asOf).map(loan => ({ ...loan, principalYuan: loan.principal * 1e6 })), facilities: data.facilities.filter(facility => ids.includes(facility.enterpriseId)).map(facility => ({ ...facility, undrawnYuan: facility.undrawn * 1e6 })) };
}
export function validateModelOutput(type, output, input, parameters) {
  if (!output || output.kind !== MODEL_TEMPLATES[type].outputKind || !Array.isArray(output.rows)) throw Error('算法输出不符合当前目标的结果结构');
  const expected = input.companies.map(c => c.id).sort(), actual = output.rows.map(row => row.enterpriseId).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error('输出企业范围不一致、重复或遗漏');
  if (output.asOf !== input.asOf) throw Error('算法不能更改输入观察日');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(output.horizonEnd || '') || !Number.isFinite(Date.parse(output.horizonEnd)) || output.horizonEnd <= input.asOf) throw Error('算法须返回有效的预测或监控期末');
  const startDate=new Date(input.asOf+'T00:00:00Z'),expectedEnd=type==='cost'?new Date(Date.UTC(startDate.getUTCFullYear(),startDate.getUTCMonth()+parameters.months+1,0)).toISOString().slice(0,10):new Date(startDate.valueOf()+parameters.horizonDays*86400000).toISOString().slice(0,10);
  if(output.horizonEnd!==expectedEnd)throw Error('结果期限与本次运行参数不一致');
  const checks = [{ label: '对象范围与观察日', passed: true }, { label: '结果结构与有限数值', passed: true }];
  for (const row of output.rows) {
    const keys = type === 'cost' ? ['balanceYuan', 'baselineRate', 'predictedRate', 'baselineInterest', 'predictedInterest', 'deltaInterest', 'averageBalance'] : type === 'structure' ? ['balanceYuan', 'baselineRate', 'projectedRate', 'baselineShortRatio', 'optimizedShortRatio', 'refinanceAmount', 'annualCostDelta'] : ['historicalScore', 'gapYuan', 'dueYuan', 'severity'];
    if (keys.some(key => !finite(row[key]))) throw Error(`${row.name || row.enterpriseId} 的结果包含空值或无效数值`);
    const company = input.companies.find(c => c.id === row.enterpriseId), loans = input.loans.filter(loan => loan.enterpriseId === company.id);
    const total = loans.reduce((sum, loan) => sum + loan.principalYuan, 0);
    if (type !== 'risk') {
      const rate = total ? loans.reduce((sum, loan) => sum + loan.principalYuan * loan.rate, 0) / total : 0;
      if (Math.abs(row.balanceYuan - total) > .01 || Math.abs(row.baselineRate - rate) > .00001) throw Error('算法更改了基准本金或历史融资成本');
    }
    if (type === 'cost' && (row.predictedInterest < 0 || row.predictedRate < 0 || row.predictedRate > 100 || row.averageBalance < 0 || row.averageBalance > total + .01 || Math.abs(row.predictedInterest - row.baselineInterest - row.deltaInterest) > .01)) throw Error('预测结果未通过金额、成本或差额校验');
    if (type === 'cost') {
      const years = (Date.parse(output.horizonEnd) - Date.parse(input.asOf)) / 86400000 / 365;
      if (Math.abs(row.baselineInterest - total * row.baselineRate / 100 * years) > .01 || Math.abs(row.predictedInterest - row.averageBalance * row.predictedRate / 100 * years) > .01) throw Error('预测利息、占用本金与成本率不一致');
      if (!Array.isArray(row.details) || JSON.stringify(row.details.map(detail => detail.loanId).sort()) !== JSON.stringify(loans.map(loan => loan.id).sort()) || row.details.some(detail => !finite(detail.interestYuan) || detail.interestYuan < 0) || Math.abs(row.details.reduce((sum, detail) => sum + detail.interestYuan, 0) - row.predictedInterest) > .01) throw Error('逐笔预测明细与汇总不一致');
    }
    if (type === 'structure') {
      if (!Array.isArray(row.decisions) || row.refinanceAmount < 0 || row.refinanceAmount > total * parameters.maxRefinancePct / 100 + .01 || row.optimizedShortRatio > row.baselineShortRatio + .00001 || row.annualCostDelta > total * parameters.maxExtraCostBps / 10000 + .01) throw Error('结构调整违反额度、成本或到期约束');
      const used = new Map();
      for (const decision of row.decisions) { const loan = loans.find(loan => loan.id === decision.loanId); if (!loan || !finite(decision.amountYuan) || decision.amountYuan < 0 || !Number.isFinite(Date.parse(decision.toDate)) || decision.toDate <= loan.maturityDate || decision.toDate <= output.horizonEnd || !finite(decision.proposedRate) || decision.proposedRate < 0 || decision.currentRate !== loan.rate) throw Error('调整明细的借款、金额或期限无效'); used.set(loan.id, (used.get(loan.id) || 0) + decision.amountYuan); if (used.get(loan.id) > loan.principalYuan + .01) throw Error('同一借款的调整额超过本金'); }
      if (Math.abs(row.decisions.reduce((sum, d) => sum + d.amountYuan, 0) - row.refinanceAmount) > .01) throw Error('调整明细与汇总金额不一致');
      const due = loans.filter(loan => loan.maturityDate <= output.horizonEnd).reduce((sum, loan) => sum + loan.principalYuan, 0);
      const moved = row.decisions.filter(decision => loans.find(loan => loan.id === decision.loanId).maturityDate <= output.horizonEnd).reduce((sum, decision) => sum + decision.amountYuan, 0);
      if (Math.abs(row.annualCostDelta - row.decisions.reduce((sum, d) => sum + d.amountYuan * (d.proposedRate - d.currentRate) / 100, 0)) > .01 || Math.abs(row.optimizedShortRatio - (total ? (due - moved) / total * 100 : 0)) > .00001) throw Error('调整后的到期占比或成本差额与逐笔方案不一致');
    }
    if (type === 'risk' && (row.historicalScore !== company.riskScore || row.historicalTier !== company.riskTier || !['GREEN', 'AMBER', 'RED'].includes(row.level) || !Array.isArray(row.reasons))) throw Error('监控不能改写历史评分，且须提供有效提示等级和触发依据');
    if (type === 'risk' && (row.severity !== ['GREEN', 'AMBER', 'RED'].indexOf(row.level) || row.reasons.some(reason => !reason.label || !reason.condition || !finite(reason.value)) || row.level !== 'GREEN' && !row.reasons.length)) throw Error('监控等级与触发依据不完整');
  }
  checks.push({ label: type === 'structure' ? '额度、成本与借款明细约束' : type === 'cost' ? '基准本金、成本与预测差额' : '历史风险不变与提示依据', passed: true });
  return checks;
}

export function executeModel(code, input, parameters, { timeout = 4000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([`self.fetch=()=>Promise.reject(Error('算法只能使用本次绑定输入'));self.importScripts=()=>{throw Error('算法不能加载外部脚本')};self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.onmessage=async({data})=>{try{const run=new Function('input','parameters',data.code);const output=await run(data.input,data.parameters);self.postMessage({ok:true,output});}catch(error){self.postMessage({ok:false,error:error.message});}};`], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob), worker = new Worker(url);
    const finish = (error, value) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
    const abort = () => finish(Error('运行已取消'));
    const timer = setTimeout(() => finish(Error('算法运行超时，已停止本次计算')), timeout);
    worker.onmessage = event => finish(event.data.ok ? null : Error(event.data.error), event.data.output);
    worker.onerror = event => finish(Error(event.message || '算法执行失败'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ code, input, parameters });
  });
}

export function readModelStore(storage = localStorage) {
  try { const saved = JSON.parse(storage.getItem(MODEL_STORE_KEY) || 'null'); if (saved?.schemaVersion === 1) { for(const run of saved.runs)if(run.status==='RUNNING'&&run.expiresAt&&Date.now()>run.expiresAt)Object.assign(run,{status:'FAILED',error:'页面离开或运行超时，本次未形成结果',completedAt:new Date(run.expiresAt).toISOString()});return saved; } } catch (_) {}
  return { schemaVersion: 1, revision: 0, datasets: {}, goals: [], versions: [], runs: [], availability: {}, bindings: {}, audit: [] };
}
export function createModelStudio({ storage = localStorage, executor = executeModel, locks = globalThis.navigator?.locks } = {}) {
  const read = () => readModelStore(storage);
  const transaction = async action => {
    const change = () => { const state = read(), value = action(state); state.revision++; storage.setItem(MODEL_STORE_KEY, JSON.stringify(state)); globalThis.dispatchEvent?.(new CustomEvent('ofw-model-studio-change')); return copy(value); };
    return locks ? locks.request(MODEL_STORE_KEY, change) : change();
  };
  const audit = (state, action, goalId, detail) => { state.audit.unshift({ id: id('audit'), at: now(), action, goalId, detail }); state.audit = state.audit.slice(0, 150); };
  const draftSignature = draft => fingerprint({ goalDefinition:draft.goalDefinition||null,code: draft.code, parameters: draft.parameters, dataKey: draft.dataKey, objectIds: [...draft.objectIds].sort() });
  async function initialize(data) {
    const dataKey = await fingerprint(data);
    if (!data.enterprises?.length || !data.loans?.length || !data.ontologyVersion) throw Error('模型输入数据未通过结构检查');
    const prepared = [];
    for (const [type, template] of Object.entries(MODEL_TEMPLATES)) {
      const goalId = `builtin-${type}`; if (read().goals.some(goal => goal.id === goalId)) continue;
      const draft = { revision: 0, goalDefinition:{name:template.name,question:template.question,type},code: defaultCode(type), parameters: defaultParameters(type), dataKey, objectIds: data.enterprises.map(company => company.id), note: '内置参考算法，可复制草稿后维护' };
      const input = normalizeModelInput(data, draft.objectIds), output = template.algorithm(input, draft.parameters), checks = validateModelOutput(type, output, input, draft.parameters), signature = await draftSignature(draft);
      const versionId = `reference-${type}-1`, at = now(), goal = { id: goalId, type, name: template.name, question: template.question, owner: '示例模型维护组', createdAt: at, updatedAt: at, builtin: true, draft: { ...draft, signature, validatedSignature: signature } };
      const run = { id: id('validation'), goalId, purpose: 'VALIDATION', status: 'SUCCEEDED', at, completedAt: at, source: '内置参考初始化', signature, dataKey, objectIds: draft.objectIds, parameters: draft.parameters, checks, output };
      goal.draft.validationRunId = run.id;
      prepared.push({ goal, run, version: { id: versionId, goalId, goalDefinition: { name: goal.name, question: goal.question, owner: goal.owner, type }, type, name: '1.0.0', origin: 'BUILTIN_REFERENCE', publishedAt: at, publisher: '原型内置参考', note: template.method, code: draft.code, parameters: draft.parameters, dataKey, objectIds: draft.objectIds, signature, validationRunId: run.id } });
    }
    await transaction(state => { state.datasets[dataKey] ||= copy(data); for (const entry of prepared) if (!state.goals.some(goal => goal.id === entry.goal.id)) { state.goals.push(entry.goal); state.versions.push(entry.version); state.runs.unshift(entry.run); state.bindings[entry.goal.id] = entry.version.id; state.availability[entry.version.id] = true; audit(state, '初始化参考版本', entry.goal.id, entry.version.name); } return dataKey; });
    return dataKey;
  }
  async function createGoal(fields, dataKey) {
    if (!MODEL_TEMPLATES[fields.type] || !fields.name?.trim() || !fields.owner?.trim() || !fields.question?.trim()) throw Error('请填写目标名称、业务问题和负责人');
    return transaction(state => { if (!state.datasets[dataKey]) throw Error('请选择已登记的数据版本'); if (state.goals.some(goal => goal.name === fields.name.trim())) throw Error('同名目标已存在'); const goal = { id: id('goal'), type: fields.type, name: fields.name.trim(), question: fields.question.trim(), owner: fields.owner.trim(), createdAt: now(), updatedAt: now(), builtin: false, draft: { revision: 0, goalDefinition:{name:fields.name.trim(),question:fields.question.trim(),type:fields.type},code: defaultCode(fields.type), parameters: defaultParameters(fields.type), dataKey, objectIds: [], note: '' } }; state.goals.push(goal); audit(state, '创建目标', goal.id, goal.name); return goal; });
  }
  async function saveDraft(goalId, patch, expectedRevision) {
    const before = read().goals.find(goal => goal.id === goalId); if (!before) throw Error('目标不存在');
    const draft = { ...before.draft, ...copy(patch), revision: before.draft.revision + 1 };
    validateParameters(before.type, draft.parameters);
    if (!draft.code.trim()) throw Error('算法代码不能为空');
    if (draft.objectIds.length) normalizeModelInput(read().datasets[draft.dataKey], draft.objectIds);
    draft.signature = await draftSignature(draft); draft.validatedSignature = null; draft.validationRunId = null;
    return transaction(state => { const goal = state.goals.find(goal => goal.id === goalId); if (goal.draft.revision !== expectedRevision) throw Error('草稿已在其他页面更新，请重新读取后再保存'); goal.draft = draft; goal.updatedAt = now(); audit(state, '保存算法草稿', goalId, `修订 ${draft.revision}`); return goal; });
  }
  async function updateGoal(goalId, fields) {
    if (!fields.name?.trim() || !fields.owner?.trim() || !fields.question?.trim()) throw Error('请填写目标名称、业务问题和负责人');
    return transaction(state => {
      const goal=state.goals.find(goal=>goal.id===goalId);if(!goal)throw Error('目标不存在');
      if(state.goals.some(other=>other.id!==goalId&&other.name===fields.name.trim()))throw Error('同名目标已存在');
      if(goal.name!==fields.name.trim()||goal.question!==fields.question.trim()){goal.draft.revision++;goal.draft.goalDefinition={name:fields.name.trim(),question:fields.question.trim(),type:goal.type};goal.draft.validatedSignature=null;goal.draft.validationRunId=null;}
      Object.assign(goal,{name:fields.name.trim(),question:fields.question.trim(),owner:fields.owner.trim(),updatedAt:now()});audit(state,'更新目标定义',goalId,goal.name);return goal;
    });
  }
  async function run(goalId, { purpose = 'VALIDATION', versionId, objectIds, parameterOverrides = {}, source = '模型与算法', signal } = {}) {
    const state = read(), goal = state.goals.find(goal => goal.id === goalId); if (!goal) throw Error('目标不存在');
    if (goal.archived) throw Error('目标已归档，恢复后才能运行');
    const version = versionId && state.versions.find(version => version.id === versionId && version.goalId === goalId);
    if (purpose === 'USE' && (!version || !state.availability[versionId])) throw Error('请选择已发布且启用的版本');
    const config = version || goal.draft, ids = objectIds || config.objectIds;
    if (ids.some(id => !config.objectIds.includes(id))) throw Error('运行对象超出了模型版本的适用范围');
    if(purpose!=='USE'&&Object.keys(parameterOverrides).length)throw Error('核验必须使用当前草稿参数');
    const allowedOverrides=runtimeParameterSpecs(goal.type).map(spec=>spec.key);
    if(Object.keys(parameterOverrides).some(key=>!allowedOverrides.includes(key)))throw Error('该参数属于模型策略，请修改草稿并发布新版本');
    const parameters={...config.parameters,...parameterOverrides};
    validateParameters(goal.type, parameters);
    const input = normalizeModelInput(state.datasets[config.dataKey], ids), signature = config.signature || await draftSignature(config);
    const executionSignature=await fingerprint({signature,objectIds:[...ids].sort(),parameters});
    const record = { id: id('run'), goalId, goalDefinition:version?.goalDefinition||{name:goal.name,question:goal.question,type:goal.type},type: goal.type, purpose, versionId: version?.id || null, versionName: version?.name || null, status: 'RUNNING', at: now(), expiresAt:Date.now()+4500,source, signature, executionSignature, dataKey: config.dataKey, objectIds: [...ids], parameters: copy(parameters), checks: [] };
    await transaction(current => { current.runs.unshift(record); return record; });
    try {
      const output = await executor(config.code, input, parameters, { signal });
      if(Date.now()>record.expiresAt)throw Error('运行响应超时，本次结果未被应用');
      const checks = validateModelOutput(goal.type, output, input, parameters);
      return await transaction(current => { const target = current.runs.find(run => run.id === record.id); Object.assign(target, { status: 'SUCCEEDED', completedAt: now(), output, checks }); const live = current.goals.find(goal => goal.id === goalId); if (purpose === 'VALIDATION' && live.draft.revision === goal.draft.revision) Object.assign(live.draft, { signature, validatedSignature: signature, validationRunId: record.id }); audit(current, purpose === 'VALIDATION' ? '算法核验通过' : '使用发布版本', goalId, record.id); return target; });
    } catch (error) { await transaction(current => { Object.assign(current.runs.find(run => run.id === record.id), { status: signal?.aborted ? 'CANCELLED' : 'FAILED', error: error.message, completedAt: now() }); audit(current, '运行未完成', goalId, error.message); return null; }); throw error; }
  }
  async function publish(goalId, { name, note, publisher }) {
    return transaction(state => { const goal = state.goals.find(goal => goal.id === goalId), draft = goal?.draft; if(goal?.archived)throw Error('归档目标不能发布');if (!draft?.validationRunId || draft.signature !== draft.validatedSignature) throw Error('请先核验当前草稿；修改后需要重新核验'); if (!/^\d+\.\d+\.\d+$/.test(name) || !note.trim() || !publisher.trim()) throw Error('请填写语义版本号、发布说明和发布人'); if (state.versions.some(version => version.goalId === goalId && version.name === name)) throw Error('该版本号已存在，发布版本不能覆盖'); const version = { id: id('version'), goalId, goalDefinition: { name: goal.name, question: goal.question, owner: goal.owner, type: goal.type }, type: goal.type, name, note: note.trim(), publisher: publisher.trim(), publishedAt: now(), origin: 'USER_PUBLISHED', code: draft.code, parameters: copy(draft.parameters), dataKey: draft.dataKey, objectIds: [...draft.objectIds], signature: draft.signature, validationRunId: draft.validationRunId }; state.versions.push(version); state.availability[version.id] = true; state.bindings[goalId] = version.id; audit(state, '发布并设为当前应用版本', goalId, name); return version; });
  }
  async function bind(goalId, versionId) { return transaction(state => { if (!state.versions.some(version => version.id === versionId && version.goalId === goalId) || !state.availability[versionId]) throw Error('该版本不可用'); if(state.goals.find(goal=>goal.id===goalId)?.archived)throw Error('归档目标不能切换应用版本');state.bindings[goalId] = versionId; audit(state, '切换应用版本', goalId, versionId); return versionId; }); }
  async function setAvailability(versionId, enabled) { return transaction(state => { const version = state.versions.find(version => version.id === versionId); if (!version) throw Error('版本不存在'); state.availability[versionId] = enabled; if (!enabled && state.bindings[version.goalId] === versionId) delete state.bindings[version.goalId]; audit(state, enabled ? '启用版本' : '停用版本', version.goalId, version.name); return version; }); }
  async function removeGoal(goalId) { return transaction(state => { if (state.versions.some(version => version.goalId === goalId) || state.runs.some(run => run.goalId === goalId)) throw Error('已有版本或运行记录的目标需保留追溯，不能删除'); state.goals = state.goals.filter(goal => goal.id !== goalId); audit(state, '删除未使用草稿目标', goalId, ''); return null; }); }
  async function archiveGoal(goalId, archived) { return transaction(state=>{const goal=state.goals.find(goal=>goal.id===goalId);if(!goal)throw Error('目标不存在');goal.archived=archived;audit(state,archived?'归档目标':'恢复目标',goalId,goal.name);return goal;}); }
  return { read, initialize, createGoal, updateGoal, saveDraft, run, publish, bind, setAvailability, removeGoal, archiveGoal };
}

export function studioSignals(state) {
  const latest = new Map();
  for (const run of state.runs.filter(run => run.purpose === 'USE' && run.type === 'risk' && run.status === 'SUCCEEDED')) {
    for (const row of run.output.rows) { const key = `${run.goalId}:${row.enterpriseId}`; if (!latest.has(key)) latest.set(key, { run, row }); }
  }
  return [...latest.values()].filter(({ run,row }) => row.level !== 'GREEN'&&state.availability[run.versionId]&&!state.goals.find(goal=>goal.id===run.goalId)?.archived).map(({ run, row }) => ({ id: `studio:${run.id}:${row.enterpriseId}`, objectId: row.enterpriseId, source: 'model', origin: 'studio', category: '模型监控提示', title: `${run.goalDefinition?.name || state.goals.find(goal => goal.id === run.goalId)?.name || '债务风险监测'} · ${row.level === 'RED' ? '重点关注' : '关注'}`, severity: row.level === 'RED' ? 'danger' : 'warning', date: run.output.asOf, timeLabel: '输入观察日', condition: row.reasons.map(reason => `${reason.label}：${reason.condition}`).join('；'), observed: row.reasons.map(reason => `${reason.label} ${Number(reason.value.toFixed(4))}${reason.unit}`).join('；'), sourceName: '模型与算法 · 本地发布版本', sourceVersion: run.versionName, definitionId: run.goalId, goalId: run.goalId, versionId: run.versionId, runId: run.id, formedAt: run.completedAt, sourceDetail: row.conclusion+' 本次窗口截至 '+run.output.horizonEnd,evidenceRefs: [run.dataKey, run.signature,run.executionSignature, run.id].filter(Boolean) }));
}
