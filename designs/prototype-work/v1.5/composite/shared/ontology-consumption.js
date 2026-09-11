(function installOntologyConsumption(global) {
  'use strict';

  // Validate explicit M01 bindings before constructing a business directory.
  function validate({ publishedVersions = [], bindings = [], instances = [], links = [] } = {}) {
    const issues = [];
    const issue = (code, path, message) => issues.push({ code, path, message });
    function index(items, path) {
      const result = new Map();
      items.forEach((item, position) => {
        if (!item?.id || result.has(item.id)) issue('INVALID_IDENTITY', `${path}[${position}]`, 'A unique stable ID is required.');
        else result.set(item.id, item);
      });
      return result;
    }
    const versions = index(publishedVersions, 'publishedVersions');
    const bindingById = index(bindings, 'bindings');
    const instanceById = index(instances, 'instances');
    const definitions = new Map();

    function publishedVersion(id, path) {
      const version = versions.get(id);
      if (!version) { issue('UNKNOWN_SEMANTIC_VERSION', path, 'The exact M01 version does not exist.'); return null; }
      if ((version.publicationState || version.status) !== 'Published') {
        issue('UNPUBLISHED_SEMANTIC_VERSION', path, 'Draft and candidate definitions cannot supply published business objects.');
        return null;
      }
      return version;
    }

    for (const binding of bindingById.values()) {
      const path = `bindings.${binding.id}`;
      const version = publishedVersion(binding.semanticVersionId, path);
      if (!version) continue;
      const type = (version.objects || []).find(object => object.id === binding.objectTypeId);
      if (!type) { issue('UNKNOWN_OBJECT_TYPE', path, 'A name, prefix, rule or metric cannot substitute for an M01 Object Type.'); continue; }
      definitions.set(binding.id, type);
      if (!binding.dataVersionId) issue('MISSING_DATA_VERSION', path, 'The binding must identify its source data version.');
      const identities = Array.isArray(type.identity) ? type.identity : [type.identity].filter(Boolean);
      if (!identities.length || identities.some(id => !binding.identityMap?.[id])) {
        issue('INCOMPLETE_IDENTITY_MAPPING', path, 'Every M01 identity property requires an explicit source-field mapping.');
      }
    }

    const identityKeys = new Set();
    for (const instance of instanceById.values()) {
      const path = `instances.${instance.id}`;
      if (instance.kind !== 'object') { issue('COLLECTION_IS_NOT_INSTANCE', path, 'Collections and aggregate views must not occupy business instance identities.'); continue; }
      const binding = bindingById.get(instance.bindingId);
      const type = definitions.get(instance.bindingId);
      if (!binding || !type) { issue('UNRESOLVED_INSTANCE_BINDING', path, 'The instance has no resolved M01 object binding.'); continue; }
      const properties = Array.isArray(type.identity) ? type.identity : [type.identity].filter(Boolean);
      const fields = properties.map(id => binding.identityMap?.[id]);
      const values = fields.map(field => instance.sourceIdentity?.[field]);
      if (fields.some(field => !field) || values.some(value => value == null || String(value).trim() === '')) {
        issue('MISSING_SOURCE_IDENTITY', path, 'A collection label or row count cannot replace the source business key.');
        continue;
      }
      const key = JSON.stringify([binding.semanticVersionId, binding.objectTypeId, binding.dataVersionId, values]);
      if (identityKeys.has(key)) issue('DUPLICATE_BUSINESS_IDENTITY', path, 'The same source business identity appears more than once.');
      identityKeys.add(key);
    }

    for (const link of links) {
      const path = `links.${link.id}`;
      const version = publishedVersion(link.semanticVersionId, path);
      if (!version) continue;
      const definition = (version.links || []).find(item => item.id === link.linkTypeId);
      if (!definition) { issue('UNKNOWN_LINK_TYPE', path, 'The exact M01 Link Type does not exist.'); continue; }
      for (const [endpoint, expected] of [['sourceId', definition.source], ['targetId', definition.target]]) {
        const instance = instanceById.get(link[endpoint]);
        const type = definitions.get(instance?.bindingId);
        if (instance?.kind !== 'object' || !type || type.id !== expected) {
          issue('LINK_ENDPOINT_TYPE_MISMATCH', `${path}.${endpoint}`, 'The business instance must match the declared M01 relationship endpoint.');
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  global.OFW_ONTOLOGY_CONSUMPTION = Object.freeze({ validate });
})(typeof window === 'undefined' ? globalThis : window);
