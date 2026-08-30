(function (root) {
  "use strict";

  const MODULES = new Set(["M01", "M02", "M03", "M04", "M05", "M06"]);
  const ALLOWED = new Set(["moduleId", "source", "scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status", "contextCreatedAt", "contextStatus", "scenarioFormedAt", "scenarioStatus", "resetRoute", "resetViewAt", "loaderVersion"]);
  const CONTENT_HASH = "579678694c709741328fa60d60fcc3fa3e3066a219e15af6575fd156ef48ba12";
  const BASELINE_SOURCES = {
    M01: "./baseline-v110/ontology-management-review/canvas-first/index.html",
    M02: "./baseline-v110/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html",
    M03: "./baseline-v110/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    M04: "./baseline-v110/decision-center-prototype/review-v2/action-portfolio.html",
    M05: "./baseline-v110/agent-application/Agent%E5%BA%94%E7%94%A8.html",
    M06: "./baseline-v110/report-center/review-lifecycle/index.html"
  };

  const showError = (message) => { root.document.body.innerHTML = `<main style="font-family:system-ui,sans-serif;padding:24px;color:#991b1b"><h2>S005 基线模块加载失败</h2><p>${String(message || "未知错误").replace(/[<&>]/g, "")}</p></main>`; };
  const params = new URLSearchParams(root.location.search || "");
  const one = (key, required = false) => {
    const values = params.getAll(key);
    if (values.length > 1) throw new Error(`参数 ${key} 不得重复`);
    if (required && !values[0]) throw new Error(`缺少 ${key}`);
    return values[0] || null;
  };
  const context = {
    scenarioId: one("scenarioId"), scenarioVersion: one("scenarioVersion"), scenarioRunId: one("scenarioRunId"),
    formedAt: one("formedAt") || one("contextCreatedAt") || one("scenarioFormedAt"),
    status: one("status") || one("contextStatus") || one("scenarioStatus") || "active"
  };
  function validate() {
    for (const key of params.keys()) if (!ALLOWED.has(key)) throw new Error(`不允许的加载参数 ${key}`);
    const moduleId = one("moduleId", true);
    const source = one("source", true);
    if (!MODULES.has(moduleId)) throw new Error(`未登记模块 ${moduleId}`);
    if (context.scenarioId && (!context.scenarioVersion || !context.scenarioRunId || !context.formedAt)) throw new Error("场景上下文参数必须完整提供");
    if (context.scenarioId && context.scenarioId !== "S005") throw new Error("S005 模块拒绝其他场景身份");
    if (context.scenarioVersion && context.scenarioVersion !== "S005-v1") throw new Error("scenarioVersion 与 S005 不一致");
    const parentContext = root.parent?.OFW_ACTIVE_SCENARIO_ADAPTER?.context?.();
    if (parentContext && context.scenarioId) ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].forEach((field) => { if (String(parentContext[field]) !== String(context[field])) throw new Error(`场景上下文 ${field} 与父窗口不一致`); });
    if (source !== BASELINE_SOURCES[moduleId]) throw new Error("模块入口未登记或不是 v1.1.0 冻结入口");
    return { moduleId, source };
  }
  async function digest(text) {
    if (!root.crypto?.subtle || !root.TextEncoder) return null;
    const bytes = new root.TextEncoder().encode(text);
    const hash = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
  }
  async function boot() {
    const request = validate();
    const sourceUrl = new URL(request.source, root.location.href);
    const response = await root.fetch(sourceUrl.href, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const actual = await digest(html);
    const localRoot = new URL("./", root.location.href);
    const proxyUrl = new URL("scenario-storage-proxy.js?v=s005-v110-real", localRoot).href;
    const bridgeUrl = new URL("s005-real-module-bridge.js?v=s005-v110-real-2", localRoot).href;
    const base = `<base data-s005-baseline-base="true" href="${sourceUrl.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"><script src="${proxyUrl}"></script><script>window.S005_MODULE_ID=${JSON.stringify(request.moduleId)};window.S005_MODULE_CONTEXT=${JSON.stringify(context)};window.S005_BASELINE_SOURCE=${JSON.stringify(sourceUrl.href)};</script>`;
    const withoutBase = html.replace(/<base\b[^>]*>/gi, "");
    const withHead = withoutBase.replace(/<head\b[^>]*>/i, (match) => `${match}${base}`);
    const rewritten = withHead.replace(/<\/body>/i, `<script data-s005-real-bridge="true" src="${bridgeUrl}"></script></body>`);
    root.document.open();
    root.document.write(rewritten);
    root.document.close();
    root.document.documentElement.dataset.s005BaselineModule = request.moduleId;
    root.document.documentElement.dataset.s005BaselineSourceSha256 = actual || "unverified-runtime";
  }
  root.OFW_S005_MODULE_LOADER = Object.freeze({ validate, boot });
  boot().catch(showError);
})(typeof window !== "undefined" ? window : globalThis);
