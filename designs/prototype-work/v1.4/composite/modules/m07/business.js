(function installBusiness(global) {
  'use strict';
  const storageKey = 'ontology3-decision-center-review-v2-portfolio-state-v8';
  const fields = new Set(('industry riskScore riskTier balance averageFinancingCost loanCount dataAsOf assessmentAsOf financingBalance weightedAverageCost floatingRateRatio shortTermDebtRatio budgetAmount actualAmount executionRate reviewStatus debtRatio reviewPriority categoryLevel1 categoryLevel2 validFrom validTo snapshotCount recordCount currency rateType termType displayName candidateRole priorityRank metricLabel observedValue threshold condition evaluatedAt status').split(' '));
  const excluded = new Set(['preloan::LoanApplicant-002', 'preloan::LoanApplicant-004', 'investment::product-03', 'investment::holding-03']);
  const primaryTypes = new Set(['enterprise', 'financing-group', 'budget-unit', 'loan-applicant', 'financial-product', 'investment-holding', 'investment-portfolio'].map(type => `m01.object-type.${type}`));
  const directory = resource => resource.objects.filter(item => resource.typeMetadata ? resource.typeMetadata[item.objectTypeId]?.primary : primaryTypes.has(item.objectTypeId));
  function project(source) {
    // A presentation boundary: preserve source facts and identities, select prepared business cases.
    const objects = source.objects.filter(item => !excluded.has(item.id) && !/issuer-candidate|manager-candidate|validation-location|report-evidence/.test(item.objectTypeId));
    const ids = new Set(objects.map(item => item.id));
    return { ...source, objects, links: source.links.filter(link => ids.has(link.from) && ids.has(link.to)),
      series: source.series.filter(series => ids.has(series.ownerObjectId) && series.propertyId !== 'm01.property.data-completeness'),
      events: source.events.filter(event => ids.has(event.objectId || event.ownerObjectId)) };
  }
  function entries(item) {
    return Object.entries(item?.properties || {}).filter(([key, property]) => (fields.has(key) || ["sector", "year", "period", "asOf", "account", "category", "actualRevenue", "costToRevenue", "loanId", "balanceYuan", "rate", "guaranteeType", "value", "price", "cost", "pnl"].includes(key)) && property.value != null && typeof property.value !== 'object');
  }
  function status(item) {
    const p = item.properties || {};
    if (p.riskTier?.value) return p.riskTier.value;
    if (p.executionRate?.value > 100) return '预算超支';
    if (p.reviewStatus?.value) return p.reviewStatus.value;
    if (p.candidateRole?.value) return '协商备选';
    if (p.status?.value === 'triggered') return '规则命中';
    return '';
  }
  function records(item, seed, storage) {
    let saved;
    try { saved = JSON.parse(storage.getItem(storageKey) || 'null'); } catch (_) {}
    const live = saved?.portfolioIntegrationVersion === 'ofw.decision.portfolio.v3';
    const snapshot = live ? saved : seed;
    const subjects = new Set([item.id, item.canonicalObjectRef?.id, ...(item.aliases || []), item.properties?.unitRef?.value]);
    if (item.enterpriseId || /^ENT-/.test(item.id)) subjects.add(`S003-${item.enterpriseId || item.id}`);
    const tasks = new Map((snapshot.tasks || []).map(task => [task.id, task]));
    return (snapshot.requests || []).filter(request => subjects.has(request.subjectId)).map(request => {
      const task = tasks.get(request.taskId) || null;
      const s = task?.status || request.status;
      const stage = ({ pending: '待开始', assigned: '待承接', accepted: '已承接', in_progress: '办理中', completed: '已完成', awaiting: '待审批', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', correcting: '纠正中', corrected: '已纠正', blocked: '办理受阻', failed: '办理受阻', execution_failed: '执行失败', create_failed: '待办创建失败', submitting: '提交中', decision_saved: '审批已保存', task_creating: '待办创建中', rejected_by_gate: '申请未接收', supplement_requested: '待业务反馈', c017_blocked: '办理受阻', validating: '接收核对中', withdrawn: '已撤回' })[s] || '查看事项状态';
      return { request, task, stage, live, route: task ? `task/${encodeURIComponent(task.id)}` : `request/${encodeURIComponent(request.id)}` };
    });
  }
  global.OFW_M07_BUSINESS = Object.freeze({ project, directory, entries, status, records, storageKey });
})(typeof window === 'undefined' ? globalThis : window);
