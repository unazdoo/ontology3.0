(function installComparison(global) {
  'use strict';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
  const generic = new Set(['ruleMetricValue', 'observedValue', 'threshold', 'priorityRank']);
  function create({ seriesFor, resources, labelFor }) {
    const resourceFor = (item, value) => {
      const domain = value.sourceScenarioId || value.scenarioId || item.scenarioId;
      return resources.find(source => source.scenarioId === domain) || {};
    };
    function definition(item, kind, key, value) {
      const source = resourceFor(item, value);
      const domain = value.sourceScenarioId || value.scenarioId || item.scenarioId;
      // Generic containers do not imply a metric. Labels alone cannot establish compatibility.
      const metricId = value.metricId || value.propertyId || (kind === 'property' && !generic.has(key) ? `${domain}:${item.objectTypeId}:${key}` : null);
      if (!metricId || !domain) return null;
      const ontology = value.ontologyVersionId || source.ontologyVersionId || item.canonicalObjectRef?.ontologyVersionId;
      if (!ontology) return null;
      const version = value.dataVersionId || value.versionRef || value.timeSeriesRef?.dataVersion || source.dataVersionId || '';
      const unit = value.unit || '';
      const aggregation = kind === 'property' ? 'static' : value.aggregationSemantics;
      const grain = kind === 'property' ? item.objectTypeId : value.granularity;
      if (!aggregation || !grain) return null;
      const id = JSON.stringify([kind, metricId, domain, ontology, version, unit, aggregation, grain, value.calendar || '', value.definitionVersion || '']);
      return { id, kind, key, metricId, domain, ontologyVersionId: ontology, dataVersionId: version, unit,
        label: kind === 'property' ? generic.has(key) ? value.metricLabel || item.properties?.ruleMetricLabel?.value || labelFor(key) : labelFor(key) : value.label,
        aggregation, grain, coverage: 0 };
    }
    function propertyDate(item, property) {
      const domain = property.sourceScenarioId || item.scenarioId;
      const ownDate = item.sourceFacets?.[domain]?.properties?.dataAsOf?.value;
      return date(property.asOf || property.dataAsOf) || date(ownDate) || date(resourceFor(item, property).dataAsOf);
    }
    function observation(item, metric, range) {
      if (metric.kind === 'property') {
        const property = item.properties?.[metric.key];
        if (!property || definition(item, 'property', metric.key, property)?.id !== metric.id) return { value: null, asOf: null, reason: '指标定义或版本不兼容' };
        return { value: numeric(property.value) ? property.value : null, asOf: propertyDate(item, property), reason: numeric(property.value) ? '' : '未提供快照值' };
      }
      const series = seriesFor(item).filter(s => definition(item, 'series', s.propertyId, s)?.id === metric.id);
      if (series.length !== 1) return { value: null, asOf: null, reason: series.length ? '同一指标存在重复序列，需核对来源' : '没有同口径序列' };
      const points = (series[0].points || []).filter(point => point.t >= range.start && point.t <= range.end && numeric(point.v) && !['missing', 'not_observed', 'quality_blocked', 'redacted'].includes(point.state));
      points.sort((a, b) => a.t.localeCompare(b.t));
      const latest = points.at(-1);
      return latest ? { value: latest.v, asOf: latest.t, reason: '', seriesId: series[0].id } : { value: null, asOf: null, reason: '所选区间无观测' };
    }
    function candidates(items, range) {
      const definitions = new Map();
      for (const item of items) {
        const seen = new Set();
        const entries = [
          ...Object.entries(item.properties || {}).filter(([, value]) => numeric(value.value)).map(([key, value]) => definition(item, 'property', key, value)),
          ...seriesFor(item).map(series => definition(item, 'series', series.propertyId, series)),
        ];
        for (const metric of entries.filter(Boolean)) {
          if (seen.has(metric.id)) continue;
          seen.add(metric.id);
          if (!definitions.has(metric.id)) definitions.set(metric.id, metric);
          definitions.get(metric.id).coverage++;
        }
      }
      return [...definitions.values()].filter(metric => metric.coverage >= 2).map(metric => ({ ...metric,
        available: items.filter(item => observation(item, metric, range).value !== null).length,
      })).sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label, 'zh-CN') || a.kind.localeCompare(b.kind));
    }
    function timeNote(items, metric, range) {
      const observations = items.map(item => observation(item, metric, range));
      const dates = [...new Set(observations.filter(o => o.value !== null).map(o => o.asOf || '截至日未提供'))].sort();
      if (metric.kind === 'property') return `静态快照 · 截至 ${dates.join('、') || '未提供'} · 不受区间筛选影响${dates.some(d => d < range.start || d > range.end) ? ' · 快照不在所选区间' : ''}`;
      return `区间最新观测 · ${range.start} 至 ${range.end} · ${dates.length ? `实际观测 ${dates.join('、')}` : '无观测'}`;
    }
    function excluded(items) {
      return items.flatMap(item => [...generic].filter(key => numeric(item.properties?.[key]?.value) && !definition(item, 'property', key, item.properties[key]))
        .map(key => `${item.title} · ${item.properties.ruleMetricLabel?.value || labelFor(key)}：缺少稳定指标身份，不参与共同指标比较`));
    }
    function aligned(items, metric, range) {
      const observations = items.map(item => observation(item, metric, range));
      return observations.every(o => o.value !== null && o.asOf) && new Set(observations.map(o => o.asOf)).size === 1;
    }
    return Object.freeze({ candidates, observation, timeNote, excluded, aligned, propertyDate });
  }
  global.OFW_M07_COMPARISON = Object.freeze({ create });
})(window);
