(function installPortraitModel(global) {
  'use strict';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  function selectionActions(items, { comparable = false, trends = false } = {}) {
    if (!items.length) return [];
    if (items.length === 1) return [{ view: 'object', label: '打开画像', primary: true }];
    const sameType = new Set(items.map(item => item.objectTypeId)).size === 1;
    const type = sameType ? items[0].objectTypeId : null;
    const name = type === 'OBJ-ENTERPRISE' ? '企业' : type === 'OBJ-INVESTMENT-PRODUCT' ? '产品' : type === 'OBJ-INVESTMENT-HOLDING' ? '持仓' : '指标';
    const actions = [];
    if (sameType && comparable) actions.push({ view: 'compare', label: items.length > 4 ? '查看对照表' : `对比${name}`, primary: true });
    if (sameType && trends) actions.push({ view: 'trends', label: ['OBJ-INVESTMENT-PRODUCT', 'OBJ-INVESTMENT-HOLDING'].includes(type) ? '查看持仓走势' : '查看走势', primary: !actions.length });
    actions.push({ view: items.length > 4 && !actions.length ? 'list' : 'cards', label: items.length > 4 && !actions.length ? '查看对照表' : '并排查看', primary: !actions.length });
    return actions;
  }
  function create(resource) {
    const byId = new Map(resource.objects.map(item => [item.id, item]));
    const links = new Map(), histories = new Map();
    for (const link of resource.links) for (const id of [link.from, link.to]) {
      if (!links.has(id)) links.set(id, []);
      links.get(id).push(link);
    }
    for (const series of resource.series) {
      if (!histories.has(series.ownerObjectId)) histories.set(series.ownerObjectId, []);
      histories.get(series.ownerObjectId).push(series);
    }
    const historyCache = new Map();
    function seriesFor(item) {
      if (!item) return [];
      if (historyCache.has(item.id)) return historyCache.get(item.id);
      const direct = histories.get(item.id) || [];
      const holdingLinks = item.objectTypeId === 'OBJ-INVESTMENT-PRODUCT'
        ? (links.get(item.id) || []).filter(link => link.linkTypeId === 'LINK-V14-HOLDING-PRODUCT') : [];
      const related = holdingLinks.flatMap(link => {
        const holding = byId.get(link.from);
        return (histories.get(holding?.id) || []).map(series => ({ ...series, displayObjectId: item.id, relatedTitle: holding.title }));
      });
      const result = [...direct, ...related];
      historyCache.set(item.id, result);
      return result;
    }
    const signature = series => JSON.stringify([series.propertyId, series.unit || '', series.ontologyVersionId, series.dataVersionId || series.versionRef, series.relatedTitle ? 'linked-holding' : 'direct']);
    function dimensions(items) {
      if (items.length < 2 || new Set(items.map(item => item.objectTypeId)).size !== 1) return [];
      const counts = new Map();
      for (const item of items) {
        const unique = new Map();
        for (const series of seriesFor(item)) if (series.propertyId && series.points?.some(p => numeric(p.v))) {
          const id = signature(series);
          if (unique.has(id)) unique.set(id, null); else unique.set(id, series);
        }
        for (const [id, series] of unique) if (series) {
          if (!counts.has(id)) counts.set(id, { id, label: series.label, unit: series.unit, linked: Boolean(series.relatedTitle), count: 0 });
          counts.get(id).count++;
        }
      }
      return [...counts.values()].filter(d => d.count === items.length);
    }
    function observation(item, dimension, range) {
      const series = seriesFor(item).find(series => signature(series) === dimension.id);
      return { series, points: (series?.points || []).filter(point => point.t >= range.start && point.t <= range.end).map(point => ({ ...point, v: numeric(point.v) ? point.v : null })).sort((a,b) => a.t.localeCompare(b.t)) };
    }
    return { seriesFor, dimensions, observation };
  }
  global.OFW_M07_PORTRAIT = Object.freeze({ create, selectionActions });
})(typeof window === 'undefined' ? globalThis : window);
