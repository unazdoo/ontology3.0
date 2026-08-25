(function (root) {
  "use strict";

  // v1.1.0 runtime adapter for the frozen v1.0.3 modules.  The published
  // modules still use their legacy localStorage names, so this adapter maps
  // only those names to the active scenarioRunId namespace.  The v1.0.3
  // files remain byte-for-byte read-only.
  const RUNTIME_PREFIX = "ofw:v1.1.0:runtime:";
  const OVERFLOW_PREFIX = "ofw:v1.1.0:runtime-overflow:";
  const STATE_KEY = "__OFW_RUNTIME_STORAGE_PROXY_STATE__";
  const ORIGINALS_KEY = "__OFW_RUNTIME_STORAGE_PROXY_ORIGINALS__";
  const INSTALLED_KEY = "__OFW_RUNTIME_STORAGE_PROXY_INSTALLED__";
  const LEGACY_EXACT_KEYS = Object.freeze([
    "ontology3-canvas-first-review-v16",
    "ontology3-canvas-first-review-v17",
    "ontology3.data-engineering.workspace.v5-handoff",
    "ontology3.intelligent-query.workspace.v1",
    "ontology3.iq.review.conversation.v1",
    "ontology3.iq.review.default.v1",
    "ontology3.iq.review.analysis.v1",
    "ontology3.iq.review.semantic.v1",
    "ontology3.iq.review.identity-counter.v1",
    "ontology3.c017.intelligent-query.projection.v1",
    "ontology3.decision-center.c011.inbox.v1",
    "ontology3-decision-center-state-v1",
    "ontology3-decision-center-review-v2-portfolio-state-v6",
    "ontology3-decision-center-review-v2-continuous-state-v6",
    "ontology3-decision-center-review-v2-queue-state-v6",
    "ontology3-decision-center-view-v2-portfolio",
    "ontology3.c017.decision-center.projection.v1",
    "ontology3.decision-center.c019.projection.v1",
    "ontology3.agent-application.catalog.v7",
    "ontology3.agent-application.catalog.v8",
    "ontology3.agent-application.owner-records.v1",
    "ontology3.agent-application.c022-inbox.v1",
    "ontology3.agent-application.c024-inbox.v1",
    "ontology3.report-center.lifecycle-review.v1",
    "ontology3.report-center.review-evidence.v1",
    "ontology3.report-center.review-workspace.v2",
    "ontology3.report-center.state.v1",
    "ontology3.report-center.lifecycle-review.v1.active-tab",
    "ontology3.c017.report-center.projection.v1",
    "ontology3.platform.scenario-runtime.v1",
    "ontology3-c008-authoritative-projection-v1",
    "ontology3.0-s001-handoff-v1:scenario-context",
    "ofw:v1.1.0:s004-runtime:native-seed"
  ]);
  const LEGACY_PREFIXES = Object.freeze([
    "ontology3.0-s001-handoff-v1:",
    "ontology3-c003-delivery-"
  ]);

  function safe(value) {
    return encodeURIComponent(String(value == null ? "" : value));
  }

  function queryContext() {
    const params = new URLSearchParams(root.location?.search || "");
    return {
      scenarioId: params.get("scenarioId") || null,
      scenarioVersion: params.get("scenarioVersion") || null,
      scenarioRunId: params.get("scenarioRunId") || null,
      formedAt: params.get("formedAt") || params.get("contextCreatedAt") || params.get("scenarioFormedAt") || null,
      status: params.get("status") || params.get("contextStatus") || params.get("scenarioStatus") || "active"
    };
  }

  function contextFrom(input) {
    const supplied = input?.context || {};
    const query = queryContext();
    return {
      scenarioId: supplied.scenarioId || query.scenarioId || "S000",
      scenarioVersion: supplied.scenarioVersion || query.scenarioVersion || "S000-v0",
      scenarioRunId: supplied.scenarioRunId || query.scenarioRunId || "S000-RUN-00000000000000000-000000000000",
      formedAt: supplied.formedAt || query.formedAt || new Date().toISOString(),
      status: supplied.status || query.status || "active"
    };
  }

  function prefixFor(context) {
    return `${RUNTIME_PREFIX}${safe(context.scenarioId)}:${safe(context.scenarioVersion)}:${safe(context.scenarioRunId)}:`;
  }

  function overflowPrefixFor(context) {
    return `${OVERFLOW_PREFIX}${safe(context.scenarioId)}:${safe(context.scenarioVersion)}:${safe(context.scenarioRunId)}:`;
  }

  function isLegacyKey(key) {
    const value = String(key == null ? "" : key);
    return LEGACY_EXACT_KEYS.includes(value) || LEGACY_PREFIXES.some((prefix) => value.startsWith(prefix));
  }

  function isRuntimeKey(key) {
    const value = String(key == null ? "" : key);
    return value.startsWith(RUNTIME_PREFIX) || value.startsWith(OVERFLOW_PREFIX);
  }

  function mappedKey(key, state) {
    const value = String(key == null ? "" : key);
    return isLegacyKey(value) ? `${state.prefix}${encodeURIComponent(value)}` : value;
  }

  function overflowKey(key, state) {
    const value = String(key == null ? "" : key);
    return isLegacyKey(value) ? `${state.overflowPrefix}${encodeURIComponent(value)}` : null;
  }

  function logicalKey(key, state) {
    const value = String(key == null ? "" : key);
    if (!value.startsWith(state.prefix)) return null;
    try { return decodeURIComponent(value.slice(state.prefix.length)); } catch (_) { return null; }
  }

  function logicalOverflowKey(key, state) {
    const value = String(key == null ? "" : key);
    if (!value.startsWith(state.overflowPrefix)) return null;
    try { return decodeURIComponent(value.slice(state.overflowPrefix.length)); } catch (_) { return null; }
  }

  function nativeLength(originals, storage) {
    try { return originals.length.get.call(storage); } catch (_) { return 0; }
  }

  function physicalKeys(originals, storage) {
    const keys = [];
    const length = nativeLength(originals, storage);
    for (let index = 0; index < length; index += 1) {
      const key = originals.key.call(storage, index);
      if (typeof key === "string") keys.push(key);
    }
    return keys;
  }

  function visibleKeys(originals, storage, state, overflowStorage = null) {
    const result = [];
    const seen = new Set();
    physicalKeys(originals, storage).forEach((physical) => {
      const logical = logicalKey(physical, state);
      if (logical) {
        if (!seen.has(logical)) { seen.add(logical); result.push(logical); }
        return;
      }
      // Hide another scenario's runtime namespace and any unscoped legacy key
      // so a frozen module cannot accidentally read S001/S002/S003 state.
      if (isRuntimeKey(physical) || isLegacyKey(physical)) return;
      if (!seen.has(physical)) { seen.add(physical); result.push(physical); }
    });
    if (overflowStorage) {
      physicalKeys(originals, overflowStorage).forEach((physical) => {
        const logical = logicalOverflowKey(physical, state);
        if (logical && !seen.has(logical)) { seen.add(logical); result.push(logical); }
      });
    }
    return result;
  }

  function isTargetStorage(storage, target) {
    return storage === target.localStorage || storage === target.sessionStorage;
  }

  function sharedOverflowStorage(target) {
    // Large v1.0.3 states can exhaust localStorage while a cross-module
    // contract (for example C022) is being appended.  Falling back to the
    // child iframe's own sessionStorage is not portable: some embedded
    // browsers isolate that storage per frame, so M06 can write a request
    // that M05 cannot read.  The same-origin scenario shell is the shared
    // runtime owner, therefore use its sessionStorage as the overflow broker
    // for every module iframe.  The physical key still contains the complete
    // scenario identity, so parallel scenarios and runs remain isolated.
    try {
      const parent = target.parent;
      if (parent && parent !== target
        && parent.location?.origin === target.location?.origin
        && parent.sessionStorage) return parent.sessionStorage;
    } catch (_) {
      // Cross-origin or unavailable parent: retain the existing local-frame
      // fallback rather than weakening the scenario boundary.
    }
    return target.sessionStorage || null;
  }

  function sharedScenarioStorage(target) {
    // Treat the same-origin scenario shell as the physical storage owner.
    // Standards-based browsers normally share localStorage across these
    // frames, but embedded browser implementations may expose per-frame
    // wrappers whose writes are not immediately visible to sibling modules.
    // Reading and writing the shell's Storage object by physical namespaced
    // key keeps C022/C023/C024 and module state on one canonical surface.
    try {
      const parent = target.parent;
      if (parent && parent !== target
        && parent.location?.origin === target.location?.origin
        && parent.localStorage) return parent.localStorage;
    } catch (_) {
      // Cross-origin or unavailable parent: stay inside the current frame.
    }
    return target.localStorage || null;
  }

  function install(input) {
    const options = input || {};
    const target = options.root || root;
    const context = contextFrom(options);
    const state = {
      context,
      prefix: prefixFor(context),
      overflowPrefix: overflowPrefixFor(context),
      moduleId: options.moduleId || null,
      installedAt: new Date().toISOString()
    };
    target[STATE_KEY] = state;

    const storage = target.localStorage;
    if (!storage) return Object.freeze({ ...state, active: false });
    const canonicalStorage = sharedScenarioStorage(target);
    const overflowStorage = sharedOverflowStorage(target);
    const proto = target.Storage?.prototype || Object.getPrototypeOf(storage);
    if (!proto) return Object.freeze({ ...state, active: false });

    if (!proto[ORIGINALS_KEY]) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(proto, "length") ||
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(storage), "length");
      proto[ORIGINALS_KEY] = {
        getItem: proto.getItem,
        setItem: proto.setItem,
        removeItem: proto.removeItem,
        key: proto.key,
        clear: proto.clear,
        length: lengthDescriptor?.get ? lengthDescriptor : { get: function () { return this._records?.size || 0; } }
      };
    }
    const originals = proto[ORIGINALS_KEY];
    if (!proto[INSTALLED_KEY]) {
      proto.getItem = function (key) {
        const active = target[STATE_KEY];
        if (this === target.localStorage && isLegacyKey(key) && overflowStorage) {
          const fallback = originals.getItem.call(overflowStorage, overflowKey(key, active));
          if (fallback !== null) return fallback;
          return originals.getItem.call(canonicalStorage, mappedKey(key, active));
        }
        if (this === target.localStorage && isLegacyKey(key)) return originals.getItem.call(canonicalStorage, mappedKey(key, active));
        return originals.getItem.call(this, isTargetStorage(this, target) ? mappedKey(key, active) : key);
      };
      proto.setItem = function (key, value) {
        const active = target[STATE_KEY];
        if (this === target.localStorage && isLegacyKey(key) && overflowStorage) {
          const physical = mappedKey(key, active);
          const fallback = overflowKey(key, active);
          try {
            const result = originals.setItem.call(canonicalStorage, physical, value);
            originals.removeItem.call(overflowStorage, fallback);
            return result;
          } catch (error) {
            if (error?.name !== "QuotaExceededError") throw error;
            originals.setItem.call(overflowStorage, fallback, value);
            return undefined;
          }
        }
        if (this === target.localStorage && isLegacyKey(key)) return originals.setItem.call(canonicalStorage, mappedKey(key, active), value);
        return originals.setItem.call(this, isTargetStorage(this, target) ? mappedKey(key, active) : key, value);
      };
      proto.removeItem = function (key) {
        const active = target[STATE_KEY];
        if (this === target.localStorage && isLegacyKey(key) && overflowStorage) {
          originals.removeItem.call(overflowStorage, overflowKey(key, active));
        }
        if (this === target.localStorage && isLegacyKey(key)) return originals.removeItem.call(canonicalStorage, mappedKey(key, active));
        return originals.removeItem.call(this, isTargetStorage(this, target) ? mappedKey(key, active) : key);
      };
      proto.key = function (index) {
        const active = target[STATE_KEY];
        if (!isTargetStorage(this, target)) return originals.key.call(this, index);
        const source = this === target.localStorage ? canonicalStorage : this;
        return visibleKeys(originals, source, active, this === target.localStorage ? overflowStorage : null)[index] ?? null;
      };
      proto.clear = function () {
        const active = target[STATE_KEY];
        if (!isTargetStorage(this, target)) return originals.clear.call(this);
        const source = this === target.localStorage ? canonicalStorage : this;
        physicalKeys(originals, source).filter((key) => key.startsWith(active.prefix)).forEach((key) => originals.removeItem.call(source, key));
        if (overflowStorage) {
          physicalKeys(originals, overflowStorage)
            .filter((key) => key.startsWith(active.overflowPrefix) || (this === target.sessionStorage && key.startsWith(active.prefix)))
            .forEach((key) => originals.removeItem.call(overflowStorage, key));
        }
      };
      if (Object.getOwnPropertyDescriptor(proto, "length")?.configurable !== false) {
        try {
          Object.defineProperty(proto, "length", {
            configurable: true,
            enumerable: true,
            get() {
              const active = target[STATE_KEY];
              const source = this === target.localStorage ? canonicalStorage : this;
              return isTargetStorage(this, target)
                ? visibleKeys(originals, source, active, this === target.localStorage ? overflowStorage : null).length
                : nativeLength(originals, this);
            }
          });
        } catch (_) { /* Some Storage implementations expose a non-configurable length. */ }
      }
      proto[INSTALLED_KEY] = true;
    }

    if (!target.__OFW_RUNTIME_STORAGE_EVENT_BRIDGE__ && typeof target.addEventListener === "function") {
      target.__OFW_RUNTIME_STORAGE_EVENT_BRIDGE__ = true;
      const translatedEvents = new WeakSet();
      target.addEventListener("storage", (event) => {
        if (translatedEvents.has(event)) return;
        const active = target[STATE_KEY];
        const physicalKey = typeof event.key === "string" ? event.key : null;
        const storageAreaIsTarget = !event.storageArea || isTargetStorage(event.storageArea, target);
        if (!storageAreaIsTarget) return;
        const key = physicalKey == null ? null : logicalKey(physicalKey, active) || logicalOverflowKey(physicalKey, active);
        if (!key) {
          // A null key is a native clear event and cannot be attributed to one
          // scenario.  Runtime keys for another scenario and unscoped legacy
          // keys must likewise never reach the frozen module.
          if (physicalKey == null || isRuntimeKey(physicalKey) || isLegacyKey(physicalKey)) {
            try { event.stopImmediatePropagation(); } catch (_) {}
          }
          return;
        }
        try { event.stopImmediatePropagation(); } catch (_) {}
        try {
          const translated = new target.StorageEvent("storage", {
            key,
            oldValue: event.oldValue,
            newValue: event.newValue,
            storageArea: event.storageArea,
            url: event.url
          });
          translatedEvents.add(translated);
          target.dispatchEvent(translated);
        } catch (_) {
          // Older embedded browsers may not expose StorageEvent constructors;
          // module state remains correct on direct reads in that case.
        }
      }, true);
    }
    target.OFW_RUNTIME_STORAGE = Object.freeze({
      context: () => ({ ...target[STATE_KEY].context }),
      prefix: () => target[STATE_KEY].prefix,
      overflowPrefix: () => target[STATE_KEY].overflowPrefix,
      toPhysicalKey: (key) => mappedKey(key, target[STATE_KEY]),
      toOverflowKey: (key) => overflowKey(key, target[STATE_KEY]),
      toLogicalKey: (key) => logicalKey(key, target[STATE_KEY]),
      canonicalStorageScope: () => canonicalStorage === target.localStorage ? "frame" : "scenario-shell",
      overflowStorageScope: () => overflowStorage === target.sessionStorage ? "frame" : "scenario-shell",
      visibleKeys: () => visibleKeys(originals, canonicalStorage, target[STATE_KEY], overflowStorage)
    });
    return Object.freeze({ ...state, active: true });
  }

  root.OFWRuntimeStorage = Object.freeze({ install, isLegacyKey, prefixFor, overflowPrefixFor });
  if (root.OFW_ACTIVE_SCENARIO_ADAPTER) {
    install({ context: root.OFW_ACTIVE_SCENARIO_ADAPTER.context() });
  }
})(typeof window !== "undefined" ? window : globalThis);
