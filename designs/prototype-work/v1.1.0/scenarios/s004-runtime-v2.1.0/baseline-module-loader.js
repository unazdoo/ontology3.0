(function (root) {
  "use strict";

  const MODULE_IDS = Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]);
  const QUERY_KEYS = Object.freeze(new Set([
    "moduleId", "source",
    "scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status",
    "contextCreatedAt", "contextStatus", "scenarioFormedAt", "scenarioStatus"
  ]));
  const runtimeBase = new URL("./", root.location.href);
  const designsRoot = new URL("../../../../", runtimeBase);
  const allowlistUrl = new URL("./scenario.manifest.json", runtimeBase).href;
  const runtimeStorageUrl = new URL("./scenario-storage-proxy.js?v=20260816-05", runtimeBase).href;
  const moduleRuntimeUrl = new URL("./baseline-module-runtime.js?v=20260817-85", runtimeBase).href;

  function showError(message) {
    root.document.body.innerHTML = `<div style="font-family:system-ui,sans-serif;padding:24px;color:#991b1b"><h2>基线模块加载失败</h2><p>${String(message || "未知错误").replace(/[<&>]/g, "")}</p></div>`;
  }

  function routeFragmentInPlace(fragment) {
    if (typeof fragment !== "string" || !fragment.startsWith("#/")) return false;
    root.location.hash = fragment;
    return true;
  }

  function injectRuntime(html, baselineUrl, moduleId = "") {
    const baseHref = new URL(baselineUrl).href;
    const fragmentRouter = moduleId === "M02"
      ? `<script data-ofw-fragment-router="M02">document.addEventListener("DOMContentLoaded",function(){document.addEventListener("click",function(event){var anchor=event.target&&event.target.closest?event.target.closest('a[href^="#/"]'):null;if(!anchor||event.defaultPrevented)return;if(window.OFWBaselineModuleLoader&&window.OFWBaselineModuleLoader.routeFragmentInPlace(anchor.getAttribute("href")))event.preventDefault();});});</script>`
      : "";
    const marker = `<base data-ofw-baseline-base="true" href="${baseHref.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"><script src="${runtimeStorageUrl}"></script><script src="${moduleRuntimeUrl}"></script>${fragmentRouter}`;
    const withoutBase = html.replace(/<base\b[^>]*>/gi, "");
    if (/<head\b[^>]*>/i.test(withoutBase)) return withoutBase.replace(/<head\b[^>]*>/i, (match) => `${match}${marker}`);
    return withoutBase.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${marker}</head>`);
  }

  function singleQueryValue(params, name, required) {
    const values = params.getAll(name);
    if (values.length > 1) throw new Error(`参数 ${name} 不得重复`);
    const value = values[0] || null;
    if (required && !value) throw new Error(`缺少 ${name} 参数`);
    return value;
  }

  function assertAliasConsistency(params, names) {
    const values = names.map((name) => singleQueryValue(params, name, false)).filter(Boolean);
    if (new Set(values).size > 1) throw new Error(`${names.join("/")} 参数不一致`);
  }

  function parentScenarioContext() {
    try {
      if (!root.parent || root.parent === root) return null;
      return root.parent.OFW_ACTIVE_SCENARIO_ADAPTER?.context?.() || null;
    } catch (_) {
      return null;
    }
  }

  function validateScenarioQuery(params) {
    assertAliasConsistency(params, ["formedAt", "contextCreatedAt", "scenarioFormedAt"]);
    assertAliasConsistency(params, ["status", "contextStatus", "scenarioStatus"]);
    const supplied = {
      scenarioId: singleQueryValue(params, "scenarioId", false),
      scenarioVersion: singleQueryValue(params, "scenarioVersion", false),
      scenarioRunId: singleQueryValue(params, "scenarioRunId", false),
      formedAt: singleQueryValue(params, "formedAt", false) || singleQueryValue(params, "contextCreatedAt", false) || singleQueryValue(params, "scenarioFormedAt", false),
      status: singleQueryValue(params, "status", false) || singleQueryValue(params, "contextStatus", false) || singleQueryValue(params, "scenarioStatus", false)
    };
    const hasAny = Object.values(supplied).some(Boolean);
    if (hasAny && Object.values(supplied).some((value) => !value)) throw new Error("场景上下文参数必须完整提供");
    if (supplied.scenarioId && !/^S\d{3}$/.test(supplied.scenarioId)) throw new Error("scenarioId 格式非法");
    if (supplied.scenarioVersion && !new RegExp(`^${supplied.scenarioId}-v\\d+(?:\\.\\d+)*$`).test(supplied.scenarioVersion)) throw new Error("scenarioVersion 格式非法");
    if (supplied.scenarioRunId && !supplied.scenarioRunId.startsWith(`${supplied.scenarioId}-RUN-`)) throw new Error("scenarioRunId 与 scenarioId 不一致");
    const expected = parentScenarioContext();
    if (expected && hasAny) {
      ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].forEach((field) => {
        if (String(supplied[field]) !== String(expected[field])) throw new Error(`场景上下文 ${field} 与父窗口不一致`);
      });
    }
    return supplied;
  }

  function validateQuery() {
    const params = new URLSearchParams(root.location.search || "");
    for (const key of params.keys()) {
      if (!QUERY_KEYS.has(key)) throw new Error(`不允许的加载参数 ${key}`);
    }
    const moduleId = singleQueryValue(params, "moduleId", true);
    const sourceRef = singleQueryValue(params, "source", true);
    if (!MODULE_IDS.includes(moduleId)) throw new Error(`未登记模块 ${moduleId}`);
    validateScenarioQuery(params);
    return { moduleId, sourceRef };
  }

  function validateAllowlist(manifest) {
    if (manifest?.baselineVersion !== "v1.0.3" || manifest?.baselineSnapshotId !== "BSL-S001-V103-DE0119608E26") {
      throw new Error("基线允许清单身份不匹配");
    }
    const allowlist = manifest?.moduleEntryAllowlist;
    if (allowlist?.algorithm !== "SHA-256") throw new Error("基线允许清单缺少 SHA-256 策略");
    const entries = allowlist.entries || {};
    const entryIds = Object.keys(entries).sort();
    if (JSON.stringify(entryIds) !== JSON.stringify([...MODULE_IDS].sort())) throw new Error("基线允许清单必须且只能登记 M01—M06");
    MODULE_IDS.forEach((id) => {
      const entry = entries[id] || {};
      if (typeof entry.sourceRef !== "string" || typeof entry.releasePath !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256 || "")) {
        throw new Error(`基线允许清单 ${id} 不完整`);
      }
      if (manifest.moduleEntries?.[id] !== entry.releasePath) throw new Error(`基线允许清单 ${id} 与 moduleEntries 不一致`);
      if (id === "M02") {
        if (entry.entryType !== "registered-parameterization"
          || !entry.originReleasePath?.startsWith("prototype-releases/v1.0.3/")
          || !/^[a-f0-9]{64}$/.test(entry.originSha256 || "")
          || !entry.patchRegistryPath?.endsWith("/baseline-modules/PATCH-REGISTRY.md")
          || !Number.isInteger(entry.patchCount) || entry.patchCount < 1) {
          throw new Error("M02 参数化副本缺少原件、摘要或 PATCH-REGISTRY 登记");
        }
      } else if (entry.entryType !== "frozen-release" || !entry.releasePath.startsWith("prototype-releases/v1.0.3/")) {
        throw new Error(`${id} 必须直接使用 v1.0.3 冻结入口`);
      }
    });
    if (!entries.M04.releasePath.endsWith("/decision-center-prototype/review-v2/action-portfolio.html")) {
      throw new Error("M04 未登记最终 action-portfolio 入口");
    }
    return entries;
  }

  async function loadAllowlist() {
    const response = await root.fetch(allowlistUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`允许清单 HTTP ${response.status}`);
    return validateAllowlist(await response.json());
  }

  function resolveAllowedEntry(request, entries) {
    const entry = entries[request.moduleId];
    if (!entry || request.sourceRef !== entry.sourceRef) throw new Error(`${request.moduleId} source 未登记或已被篡改`);
    const baselineUrl = new URL(request.sourceRef, root.location.href);
    const registeredUrl = new URL(entry.releasePath, designsRoot);
    if (baselineUrl.origin !== registeredUrl.origin || baselineUrl.pathname !== registeredUrl.pathname || baselineUrl.search || baselineUrl.hash) {
      throw new Error(`${request.moduleId} 基线入口不匹配或携带了 query/hash`);
    }
    return { entry, baselineUrl: baselineUrl.href };
  }

  async function sha256Hex(text) {
    if (!root.crypto?.subtle || !root.TextEncoder) throw new Error("当前环境不支持基线 SHA-256 核验");
    const bytes = new root.TextEncoder().encode(text);
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function boot() {
    const request = validateQuery();
    const entries = await loadAllowlist();
    const { entry, baselineUrl } = resolveAllowedEntry(request, entries);
    const response = await root.fetch(baselineUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status} · ${baselineUrl}`);
    if (response.redirected || (response.url && new URL(response.url, baselineUrl).href !== baselineUrl)) throw new Error("冻结基线入口发生未登记重定向");
    const html = await response.text();
    const actualDigest = await sha256Hex(html);
    if (actualDigest !== entry.sha256) throw new Error(`${request.moduleId} 冻结入口 SHA-256 不匹配`);
    const rewritten = injectRuntime(html, baselineUrl, request.moduleId);
    root.document.open();
    root.document.write(rewritten);
    root.document.close();
    root.document.documentElement.dataset.ofwBaselineModule = request.moduleId;
    root.document.documentElement.dataset.ofwBaselineSource = baselineUrl;
    root.document.documentElement.dataset.ofwBaselineSha256 = actualDigest;
  }

  root.OFWBaselineModuleLoader = Object.freeze({
    boot,
    validateQuery,
    validateAllowlist,
    resolveAllowedEntry,
    sha256Hex,
    injectRuntime,
    routeFragmentInPlace
  });
  if (!root.__OFW_BASELINE_MODULE_LOADER_DISABLE_AUTOBOOT__) boot().catch(showError);
})(typeof window !== "undefined" ? window : globalThis);
