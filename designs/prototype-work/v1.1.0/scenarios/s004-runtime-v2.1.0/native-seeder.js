(function (root) {
  "use strict";

  // S004 native state seeder. Runs after the scenario adapter installed
  // window.S001_DATA / window.S001_STORE and BEFORE the shared shell app.js
  // is injected, so every v1.0.3 module iframe finds S004 as native state in
  // its own storage keys. HTTP same-origin only (port 4339, `designs` root);
  // file:// is not a supported review mode for native integration.

  // Bump when the raw-key projection schema or a baseline module's expected
  // state shape changes.  The marker is only a cache guard; every projected
  // record is still checked against the active scenario run before reuse.
  // Keep the native seed marker compact.  The previous marker duplicated the
  // complete M05 and M06 state (including the report evidence payload), which
  // could push a same-origin browser's storage over quota when a frozen module
  // persisted its own state.  Recovery now asks the parent shell to re-seed
  // from the immutable HTTP artifacts instead of retaining a second copy.
  const SEED_VERSION = 22;
  const RECOVERY_VERSION = 2;
  const MARKER_KEY = "ofw:v1.1.0:s004-runtime:native-seed";
  const VERIFICATION_CONTEXT_KEY = "ofw:v1.1.0:s004-runtime:verification-context.v1";
  const REPORT_HTML_REF = "../s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.html";
  const SHELL_SCRIPT = "../../s001-e2e-integration/app.js?v=20260815-10";
  const FALLBACK_REPORT_HTML = [
    "<article class=\"report-paper s004-formal-report\" aria-label=\"贷前调查报告正文\">",
    "<header class=\"report-cover\"><h1>中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）</h1>",
    "<p>报告编号 S004-PLR-2026-0001 · 内容版本 2.0.0（降级正文：正式 HTML 制品读取失败，请通过 HTTP 同源方式访问）</p></header></article>"
  ].join("");

  const status = { phase: "idle", seededKeys: [], note: "" };
  let loadedArtifacts = null;
  const ARTIFACT_NAMES = Object.freeze([
    "sourceSnapshot", "publishedResources", "c008Facts", "quality", "c017",
    "agentConfig", "reportDefinition", "evidencePackage", "draftOutput", "reportData",
    "deterministicVerification", "humanConfirmation", "publicationManifest"
  ]);

  function encodeUtf8(value) {
    const Encoder = root.TextEncoder || (typeof TextEncoder !== "undefined" ? TextEncoder : null);
    if (!Encoder) throw new Error("当前环境缺少 TextEncoder，无法形成制品 SHA-256 指纹");
    return new Encoder().encode(String(value));
  }

  async function sha256Hex(value) {
    const subtle = root.crypto?.subtle;
    if (!subtle) throw new Error("当前环境缺少 Web Crypto，无法形成制品 SHA-256 指纹");
    const bytes = value instanceof Uint8Array ? value : encodeUtf8(value);
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function fingerprintArtifacts(rawArtifacts, refs, mode) {
    const items = {};
    for (const name of ARTIFACT_NAMES) {
      const raw = rawArtifacts[name];
      const bytes = encodeUtf8(raw);
      items[name] = {
        ref: refs[name] || null,
        bytes: bytes.byteLength,
        sha256: await sha256Hex(bytes)
      };
    }
    const manifestText = ARTIFACT_NAMES.map((name) => {
      const item = items[name];
      return `${name}\0${item.ref || "inline-demo"}\0${item.bytes}\0${item.sha256}`;
    }).join("\n");
    return {
      algorithm: "SHA-256",
      mode,
      itemCount: ARTIFACT_NAMES.length,
      items,
      manifestSha256: await sha256Hex(manifestText)
    };
  }

  function formalIntegrityPolicy(config, runtimeConfig) {
    const policy = runtimeConfig.artifactIntegrity || config.artifactIntegrity;
    if (!policy || policy.required !== true) {
      throw new Error("正式 HTTP 制品缺少必需的 SHA-256 预期摘要清单");
    }
    if (String(policy.algorithm || "").toUpperCase() !== "SHA-256") {
      throw new Error(`正式 HTTP 制品摘要算法不受支持：${policy.algorithm || "缺失"}`);
    }
    const expected = policy.expected || {};
    const missing = ARTIFACT_NAMES.filter((name) => !/^[a-f0-9]{64}$/i.test(String(expected[name] || "")));
    const unknown = Object.keys(expected).filter((name) => !ARTIFACT_NAMES.includes(name));
    if (missing.length || unknown.length) {
      throw new Error(`正式 HTTP 制品预期摘要清单无效：${missing.length ? `缺失或非法 ${missing.join("、")}` : ""}${missing.length && unknown.length ? "；" : ""}${unknown.length ? `未知项 ${unknown.join("、")}` : ""}`);
    }
    return { algorithm: "SHA-256", expected };
  }

  function verifyFormalIntegrity(integrity, policy) {
    const mismatches = ARTIFACT_NAMES.filter((name) =>
      integrity.items[name].sha256.toLowerCase() !== String(policy.expected[name]).toLowerCase());
    if (mismatches.length) {
      const details = mismatches.map((name) => `${name}：期望 ${policy.expected[name]}，实际 ${integrity.items[name].sha256}`);
      throw new Error(`正式 HTTP 制品 SHA-256 校验失败：${details.join("；")}`);
    }
    return {
      ...integrity,
      required: true,
      verified: true,
      expected: Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, String(policy.expected[name]).toLowerCase()]))
    };
  }

  function seed(storage, context, reportHtml, artifacts) {
    const S = root.OFW_S004_SeedData;
    const c008 = S.buildC008Envelope(context, artifacts);
    const reportEvidence = S.buildReportFactPackage(context, artifacts);
    const c022 = S.buildC022Request(context, reportEvidence, artifacts?.c017 || null);
    const c024 = S.buildC024Request(context, reportEvidence, artifacts);
    const m05State = S.buildM05State(context, artifacts);
    const m06State = S.buildM06State(context, reportHtml, artifacts);
    const writes = [
      [S.keys.C033_PLATFORM_KEY, S.ctx5(context)],
      [S.keys.SCENARIO_RUNTIME_KEY, S.ctx5(context)],
      [S.keys.C008_PROJECTION_KEY, c008],
      [S.keys.C017_REPORT_KEY, S.buildC017ReportProjection(context, c008, artifacts)],
      [S.keys.M01_STATE_KEY, S.buildM01State(context, artifacts)],
      [S.keys.M02_FLOW_KEY, S.buildM02Flow(context, artifacts)],
      [S.keys.M03_STATE_KEY, S.buildM03State(context, artifacts)],
      [S.keys.M03_WORKSPACE_KEY, S.buildM03State(context, artifacts)],
      [S.keys.M03_C017_KEY, S.buildC017QueryProjection(context, c008, artifacts)],
      [S.keys.M04_STATE_KEY, S.buildM04State(context, artifacts)],
      [S.keys.M04_INBOX_KEY, S.buildM04Inbox(context, artifacts)],
      [S.keys.M04_C017_KEY, S.buildC017DecisionProjection(context, c008, artifacts)],
      [S.keys.M04_C019_KEY, S.buildC019DecisionProjection(context, artifacts)],
      [S.keys.M05_STATE_KEY, m05State],
      [S.keys.M06_STATE_KEY, m06State],
      [S.keys.C022_INBOX_KEY, [c022]],
      [S.keys.C024_INBOX_KEY, [c024]],
      [S.keys.REPORT_OWNER_RECORD_KEY, { questions: [{ requestId: c024.requestId, submittedAt: c024.receivedAt, runId: c024.requestId, payload: c024 }] }]
    ];
    const marker = {
      seedVersion: SEED_VERSION, scenarioRunId: context.scenarioRunId,
      seededAt: new Date().toISOString(), keys: writes.map(([key]) => key),
      artifactRefs: root.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.artifactRefs || root.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig?.artifactRefs || null,
      artifactSource: artifacts?.source || "inline-fallback",
      // Keep the verified per-artifact digest inventory in the runtime marker.
      // The deterministic verifier must be able to prove that the Published
      // ontology and C008 files it consumes are the exact files accepted by
      // the formal-http integrity gate.  A manifest hash alone cannot answer
      // that question, so store the immutable integrity record and retain its
      // aggregate digest as a separate convenience field.
      artifactFingerprint: artifacts?.integrity || null,
      artifactManifestSha256: artifacts?.fingerprint || artifacts?.integrity?.manifestSha256 || null,
      // The frozen report module may compact its legacy state after first
      // render. Do not duplicate the complete M05/M06 projections in this
      // marker: the parent shell can re-seed the same scenario run from the
      // immutable HTTP artifacts when a later iframe load needs recovery.
      recovery: {
        version: RECOVERY_VERSION,
        scenarioContext: S.ctx5(context),
        mode: "PARENT_NATIVE_RESEED",
        source: "immutable-http-artifacts",
        stateKeys: writes.map(([key]) => key)
      }
    };
    // Replace an older, oversized marker before writing the module states so
    // the migration itself can free storage capacity instead of failing on
    // the first module write.  An interrupted marker never counts as seeded.
    storage.setItem(MARKER_KEY, JSON.stringify({ ...marker, phase: "seeding" }));
    writes.forEach(([key, value]) => storage.setItem(key, JSON.stringify(value)));
    storage.setItem(MARKER_KEY, JSON.stringify({ ...marker, phase: "seeded" }));
    status.phase = "seeded";
    status.seededKeys = writes.map(([key]) => key);
    status.note = `scenarioRunId=${context.scenarioRunId}`;
    return status;
  }

  function writeVerificationContext(storage, context, artifacts) {
    const S = root.OFW_S004_SeedData;
    const reportEvidence = S.buildReportFactPackage(context, artifacts);
    const packageValue = reportEvidence.packageValue;
    const definitionArtifact = artifacts?.reportDefinition || {};
    const value = {
      schemaVersion: "ofw.s004.verification-context.v1",
      sourceMode: "derived-from-verified-immutable-artifacts",
      scenarioContext: S.ctx5(context),
      evidencePackId: packageValue.packageId,
      evidencePackageVersion: packageValue.packageVersion,
      semanticVersionId: packageValue.semanticVersionId,
      semanticVersion: packageValue.semanticVersion,
      dataAssetVersionId: packageValue.dataAssetVersionId,
      dataVersion: packageValue.dataVersion,
      consumableVersionId: packageValue.consumableVersionId,
      asOf: packageValue.asOf,
      deterministicInputs: packageValue.deterministicInputs,
      artifactIntegrity: artifacts?.integrity || null,
      definition: {
        id: reportEvidence.definition.id,
        version: reportEvidence.definition.version,
        formalPageSystem: definitionArtifact.formalPageSystem || "A4_PORTRAIT",
        sections: definitionArtifact.sections || reportEvidence.definition.sections || []
      },
      formedAt: new Date().toISOString()
    };
    try {
      storage.setItem(VERIFICATION_CONTEXT_KEY, JSON.stringify(value));
      if (root.document?.documentElement?.dataset) {
        root.document.documentElement.dataset.ofwS004VerificationContextSeed = "ready";
        root.document.documentElement.dataset.ofwS004VerificationContextMetrics = String(value.deterministicInputs?.metricResults?.length || 0);
      }
      return value;
    } catch (error) {
      if (root.document?.documentElement?.dataset) {
        root.document.documentElement.dataset.ofwS004VerificationContextSeed = "write-failed";
        root.document.documentElement.dataset.ofwS004VerificationContextError = String(error?.name || error || "unknown");
      }
      return null;
    }
  }

  function shouldSeed(storage, context) {
    let marker = null;
    try { marker = JSON.parse(storage.getItem(MARKER_KEY) || "null"); } catch (_) { marker = null; }
    if (!marker || marker.seedVersion !== SEED_VERSION || marker.phase !== "seeded" || marker.scenarioRunId !== context.scenarioRunId) return true;
    const S = root.OFW_S004_SeedData;
    const parse = (key) => {
      try { return JSON.parse(storage.getItem(key) || "null"); } catch (_) { return null; }
    };
    const m06 = parse(S.keys.M06_STATE_KEY);
    const evidencePack = m06?.report?.evidencePacks?.[0];
    const reportProjectionReady = Boolean(
      m06?.customDefinitions?.[0]?.id
      && evidencePack?.authoritativeFactPackage?.packageId
      && evidencePack?.template?.id
    );
    const m05 = parse(S.keys.M05_STATE_KEY);
    const requestRef = m06?.assistant?.requestRef || {};
    const requestId = requestRef.requestId;
    const contextMatches = (value) => {
      const candidate = value?.scenarioContext || value?.reportContext?.scenarioContext || value || {};
      return ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) =>
        candidate?.[field] && String(candidate[field]) === String(context[field]));
    };
    const inboxState = parse(S.keys.C024_INBOX_KEY);
    const inboxRequests = Array.isArray(inboxState) ? inboxState : (inboxState?.requests || []);
    const modelRequest = (m05?.inboundRequests || []).find((item) =>
      (item?.id === requestId || item?.sourceRequestId === requestId)
      && item?.type === "report-copilot"
      && contextMatches(item));
    const inboxRequest = inboxRequests.find((item) =>
      item?.requestId === requestId && contextMatches(item));
    const request = modelRequest || inboxRequest;
    const candidateRuns = (m05?.runs || []).filter((item) =>
      item?.requestId === requestId && contextMatches(item));
    const run = requestRef.runId
      ? candidateRuns.find((item) => item?.id === requestRef.runId) || candidateRuns[0]
      : candidateRuns[0];
    const inFlightStatuses = new Set(["received", "pending", "queued", "running", "blocked", "failed", "run_failed", "cancelled", "rejected"]);
    const requestStatus = String(request?.status || "received").toLowerCase();
    const runStatus = String(run?.status || "").toLowerCase();
    const inFlightLifecycle = Boolean(request && (!run || runStatus !== "complete")
      && (inboxRequest || inFlightStatuses.has(requestStatus) || inFlightStatuses.has(runStatus)));
    const session = (m05?.sessions || []).find((item) =>
      contextMatches(item)
      && item?.latestRunId === run?.id
      && item?.latestResultId === run?.result?.id);
    const completedLifecycle = Boolean(request && run?.status === "complete" && run?.result?.id && session?.id);
    // Pending/failed lifecycle records are legitimate current state.  They
    // must not be mistaken for projection corruption and replaced by the
    // immutable seed result.  Only a missing core report projection or an
    // unrecognised C024 lifecycle triggers a same-run recovery seed.
    const copilotProjectionReady = Boolean(requestId && (completedLifecycle || inFlightLifecycle));
    return !reportProjectionReady || !copilotProjectionReady;
  }

  async function loadArtifacts(adapter) {
    const config = adapter?.config || {};
    const runtimeConfig = config.runtimeConfig || {};
    const refs = config.artifactRefs || runtimeConfig.artifactRefs || {};
    const inline = config.inlineArtifacts || runtimeConfig.inlineArtifacts || {};
    const mode = runtimeConfig.artifactMode || config.artifactMode || "formal-http";

    if (mode === "inline-demo") {
      const missing = ARTIFACT_NAMES.filter((name) => inline[name] == null);
      if (missing.length) throw new Error(`inline-demo 制品包不完整：${missing.join("、")}`);
      const rawArtifacts = Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, JSON.stringify(inline[name])]));
      const integrity = await fingerprintArtifacts(rawArtifacts, {}, mode);
      return {
        source: "inline-demo-artifacts",
        formalEligible: false,
        refs: {},
        integrity,
        fingerprint: integrity.manifestSha256,
        ...Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, inline[name]]))
      };
    }

    if (mode !== "formal-http") throw new Error(`未知制品加载模式：${mode}`);
    if (!/^https?:$/.test(root.location?.protocol || "")) {
      throw new Error("formal-http 制品模式只允许在 HTTP(S) 同源运行环境中使用");
    }
    const integrityPolicy = formalIntegrityPolicy(config, runtimeConfig);

    const missingRefs = ARTIFACT_NAMES.filter((name) => !refs[name]);
    if (missingRefs.length) throw new Error(`正式 HTTP 制品引用不完整：${missingRefs.join("、")}`);

    const result = { source: "http-artifacts", formalEligible: true, refs: { ...refs } };
    const rawArtifacts = {};
    const failures = [];
    for (const name of ARTIFACT_NAMES) {
      const ref = refs[name];
      try {
        const response = await root.fetch(ref, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();
        rawArtifacts[name] = raw;
        result[name] = JSON.parse(raw);
      } catch (error) {
        failures.push(`${name}(${ref})：${error?.message || error}`);
      }
    }
    if (failures.length) {
      throw new Error(`正式 HTTP 制品包读取失败，禁止与 inline 混用：${failures.join("；")}`);
    }
    result.integrity = verifyFormalIntegrity(
      await fingerprintArtifacts(rawArtifacts, refs, mode),
      integrityPolicy
    );
    result.fingerprint = result.integrity.manifestSha256;
    return result;
  }

  function prepareReportHtmlForReader(rawHtml) {
    const raw = String(rawHtml || "");
    if (!raw) return FALLBACK_REPORT_HTML;
    const mainMatch = raw.match(/<main\b[^>]*class=(['\"])report\1[^>]*>([\s\S]*?)<\/main>/i);
    let body = mainMatch ? mainMatch[2] : raw;
    body = body
      .replace(/<div\b[^>]*class=(['\"])no-print\1[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/\bhuman-input\b/g, "s004-human-confirmation")
      .replace(/【人工输入】/g, "【需人工确认】")
      .replace(/(<span>【需人工确认】<\/span>)(?!\s*<b\b[^>]*class=(['\"])s004-ai-suggestion-label\2)/g,
        '$1<b class="s004-ai-suggestion-label">AI 建议（基于已固化资料与系统事实生成）：</b>')
      .replace(/行业与政策信息源自演示合成上传节点；/g, "行业与政策信息来自已登记的演示合成资料节点；报告生成阶段未执行实时联网搜索；")
      .replace(/演示合成上传节点只补充报告所需的外部资料和内部业务资料。/g, "演示合成资料节点只补充报告所需的外部公开信息采集结果和内部业务资料；当前报告生成未直接联网检索外部信息。");
    return [
      '<article class="report-paper s004-formal-report" aria-label="财务公司贷款贷前调查报告正文" data-source-artifact="RPT-S004-CGNPC-20260815-v2.0.html">',
      '<div class="s004-report-presentation-note"><strong>历史已发布制品保持不可变</strong><span>来源场景 S004-v2 / S004-RUN-20260815233000000-7f3c8e42a1b6 作为原始证据保留；本阅读层属于 v2.1.0 显式运行投影，当前隔离轮次仍可追加新的报告问答、Agent 运行、内容版本与确定性核验记录。</span></div>',
      body,
      "</article>"
    ].join("");
  }

  async function loadReportHtml(cache) {
    if (cache.html !== undefined) return cache.html;
    try {
      const response = await root.fetch(REPORT_HTML_REF, { cache: "no-store" });
      cache.html = response.ok ? prepareReportHtmlForReader(await response.text()) : FALLBACK_REPORT_HTML;
    } catch (_) {
      cache.html = FALLBACK_REPORT_HTML;
    }
    return cache.html;
  }

  function reloadModuleFrame() {
    const frame = root.document.getElementById("module-frame");
    if (frame && frame.src) frame.src = frame.src;
  }

  function patchAgentFrame(frame) {
    const doc = frame?.contentDocument;
    if (!doc || frame.__s004AgentPatch) return;
    const observeBody = () => {
      if (frame.__s004AgentPatch || !doc.body) return;
      frame.__s004AgentPatch = true;
    };
    if (doc.body) {
      observeBody();
      return;
    }
    if (!frame.__s004AgentPatchPending) {
      frame.__s004AgentPatchPending = true;
      doc.addEventListener?.("DOMContentLoaded", () => {
        frame.__s004AgentPatchPending = false;
        observeBody();
      }, { once: true });
    }
  }

  function setText(node, value) {
    if (node && value != null && node.textContent !== String(value)) node.textContent = String(value);
  }

  function outputUrl(file) {
    return file ? new URL(`../s004/artifacts/report/${file}`, root.location.href).href : null;
  }

  function currentReportTitle() {
    return root.OFW_ACTIVE_SCENARIO_ADAPTER?.config?.runtimeConfig?.reportNamingPolicy?.currentTitle
      || "集团成员单位贷款贷前调查报告";
  }

  function patchReportDom(doc, projection, definition, artifacts) {
    if (!doc?.body) return;
    const reportData = artifacts?.reportData || {};
    const publicationManifest = artifacts?.publicationManifest || {};
    const reportNo = reportData.reportNumber || reportData.reportNo || "S004-PLR-2026-0001";
    const reportTitle = currentReportTitle();

    const workspace = doc.querySelector(".product-nav-foot");
    const workspaceLabels = workspace ? workspace.querySelectorAll("span") : [];
    setText(workspaceLabels[0], "财务公司授信审批与调查岗");

    doc.querySelectorAll(".resource-row").forEach((row) => {
      if (!row.textContent?.includes(reportNo)) return;
      setText(row.querySelector("div > strong"), reportTitle);
    });

    const liveCard = [...doc.querySelectorAll(".ledger-row, .ledger-card")].find((card) =>
      card.querySelector('[data-action="navigate"][data-route="/reports/view"]')
      && !card.querySelector('[data-action="open-scene-readiness"]'));
    if (liveCard) {
      setText(liveCard.querySelector(".scene-code"), "S004");
      setText(liveCard.querySelector(".ledger-title strong, h3"), reportTitle);
      setText(liveCard.querySelector(".ledger-title small, :scope > p"), "正式报告 · 财务公司");
    }

    doc.querySelectorAll('[data-action="open-scene-readiness"][data-scene="S004"]').forEach((button) => {
      button.closest(".ledger-row, .ledger-card")?.remove();
    });
    const blockerSummary = doc.querySelector('[data-action="set-catalog-status"][data-status="阻断"]');
    if (blockerSummary) {
      setText(blockerSummary.querySelector("strong"), "2");
      setText(blockerSummary.querySelector("small"), "S002—S003 等待业务资料");
    }

    doc.querySelectorAll(".choice-card").forEach((card) => {
      if (!card.textContent?.includes("财务公司贷款贷前调查报告") && !card.textContent?.includes(reportTitle)) return;
      const description = [...card.children].find((node) => node.tagName === "SPAN" && !node.classList.contains("icon") && !node.classList.contains("badge"));
      setText(description, "S004 · 已装配报告定义、固定证据、Agent、核验、复核与发布链；新公司或新时点使用独立身份和版本运行");
      const badge = card.querySelector(".badge");
      if (badge && !badge.textContent?.includes("已装配")) badge.innerHTML = '<span class="status-dot"></span>已装配';
      card.classList.remove("disabled");
      card.removeAttribute("disabled");
      card.removeAttribute("aria-disabled");
    });

    const chapterMap = [
      ["sec-01-borrower-evaluation", "借款人评价"],
      ["sec-02-operations", "借款人经营情况"],
      ["sec-03-financial", "借款人财务情况"],
      ["sec-04-risk", "借款风险分析"],
      ["sec-05-credit-conclusion", "授信结论"],
      ["sec-06-data-sources", "数据来源"]
    ];
    doc.querySelectorAll(".reader-toc .toc-link").forEach((button, index) => {
      const mapped = chapterMap[index];
      if (!mapped) return;
      button.dataset.section = mapped[0];
      setText(button.querySelector("span"), mapped[1]);
    });
    const suggestionMap = [
      "借款人财务指标的主要证据是什么？",
      "哪些风险判断必须由人工确认？",
      "本报告的数据版本和证据包是什么？"
    ];
    doc.querySelectorAll(".suggestion-list .suggestion-chip").forEach((button, index) => {
      if (!suggestionMap[index]) return;
      button.dataset.question = suggestionMap[index];
      setText(button, suggestionMap[index]);
    });

    const traceDefinition = [...doc.querySelectorAll(".timeline-row")].find((row) => row.querySelector("strong")?.textContent?.includes("报告定义与模板"));
    setText(traceDefinition?.querySelector("small"), `${definition.id} ${definition.version} · ${projection.template.id} ${projection.template.version}`);

    const outputs = publicationManifest.formalOutputs || [];
    const toolbar = doc.querySelector(".reader-toolbar .header-actions");
    if (toolbar && !toolbar.querySelector(".s004-formal-output-links")) {
      const links = doc.createElement("span");
      links.className = "s004-formal-output-links";
      links.style.display = "contents";
      [
        ["CONTROLLED_HTML", "受控 HTML"],
        ["SAME_SOURCE_PDF", "正式 PDF"]
      ].forEach(([format, label]) => {
        const output = outputs.find((item) => item.format === format);
        const href = outputUrl(output?.file);
        if (!href) return;
        const link = doc.createElement("a");
        link.className = "btn";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = label;
        link.dataset.s004FormalOutput = format;
        links.append(link);
      });
      if (links.childElementCount) toolbar.prepend(links);
    }
  }

  function patchReportFrame(frame, adapter, artifacts) {
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!win || !doc) return;
    const S = root.OFW_S004_SeedData;
    const context = adapter.context();
    // Reuse the exact artifact set loaded by the native seeder.  The report
    // center is a frozen v1.0.3 module, so the S004 adapter must inject the
    // scenario's Published/C008/data/report artifacts at runtime rather than
    // allowing the frame patch to fall back to inline constants.
    const projection = S.buildReportFactPackage(context, artifacts);
    const definition = {
      id: projection.definition.id,
      name: "贷前调查报告（财务公司）",
      scene: "S004",
      purpose: "对集团成员借款人流动资金贷款申请形成正式贷前调查报告。",
      audience: "财务公司授信审批与调查岗",
      version: projection.definition.version,
      template: "贷前调查权威示例结构（六部分）",
      evidence: `固定证据包 ${EVIDENCE_PACK_ID_SAFE(projection.packageValue)} · Published ${projection.packageValue.semanticVersion} · ${projection.packageValue.dataVersion}`,
      agent: "S004 贷前调查报告 Agent 2.0.0",
      validation: "确定性核验 VERIFY 后人工复核",
      review: "风险与授信章节形成基于已固化资料与系统事实的 AI 建议；调查意见、风险判断、授信结论和发布授权均须人工确认",
      publish: "同源 HTML/PDF，发布后不原地更新",
      status: "已启用"
    };
    if (win.RC_DATA && !frame.__s004ReportDataInjected) {
      frame.__s004ReportDataInjected = true;
      // The S004 definition is owned by seeded state.customDefinitions. Keep
      // the frozen S001 definition in RC_DATA and remove any earlier runtime
      // duplicate instead of registering the same S004 definition twice.
      win.RC_DATA.definitions = (win.RC_DATA.definitions || []).filter((item) => item.id !== definition.id);
      const s004Template = {
        id: projection.template.id,
        name: "贷前调查权威示例模板",
        version: projection.template.version,
        status: "已启用",
        chapters: (projection.definition.sections || []).map((item) => item.title),
        formats: ["HTML", "JSON"],
        downloads: { ...(projection.template.downloads || {}) },
        confirmationLabel: projection.template.confirmationLabel || "【需人工确认】",
        aiSuggestionLabel: projection.template.aiSuggestionLabel || "AI 建议（基于已固化资料与系统事实生成）"
      };
      win.RC_DATA.templates = [...(win.RC_DATA.templates || []).filter((item) => item.id !== s004Template.id), s004Template];
      win.RC_DATA.scenes = (win.RC_DATA.scenes || []).map((item) => item.id === "S004" ? {
        ...item,
        status: "全链路已装配",
        description: "财务公司集团成员单位贷款贷前调查已接入报告定义、固定证据、Agent、确定性核验、人工复核、HTML/PDF 和报告伴读；历史正式制品保持不可变，当前隔离轮次可追加新运行。"
      } : item);
      win.RC_DATA.reportEvidence = {
        ...win.RC_DATA.reportEvidence,
        factPackages: { ...(win.RC_DATA.reportEvidence?.factPackages || {}), [projection.packageValue.dataVersion]: projection.packageValue }
      };
    }
    patchReportDom(doc, projection, definition, artifacts);
    if (!frame.__s004ReportPatch) {
      frame.__s004ReportPatch = true;
      doc.addEventListener("click", (event) => {
        const button = event.target.closest?.('[data-action="open-template"][data-id]');
        if (!button || !win.RC_DATA?.templates) return;
        const selected = win.RC_DATA.templates.find((item) => item.id === button.dataset.id);
        if (!selected) return;
        win.RC_DATA.templates = [selected, ...win.RC_DATA.templates.filter((item) => item.id !== selected.id)];
      }, true);
      const observer = root.MutationObserver ? new root.MutationObserver(() => patchReportDom(doc, projection, definition, artifacts)) : null;
      if (doc.body) observer?.observe(doc.body, { childList: true, subtree: true, characterData: true });
      frame.__s004ReportObserver = observer;
    }
    if (!frame.__s004ReportInitialRender) {
      frame.__s004ReportInitialRender = true;
      win.dispatchEvent(new win.Event("hashchange"));
    }
  }

  function EVIDENCE_PACK_ID_SAFE(packageValue) {
    return packageValue?.packageId || "EVID-S004";
  }

  function installModuleRuntimeAdapters(adapter, artifacts) {
    const schedule = (fn, delay = 0) => {
      if (typeof root.setTimeout === "function") return root.setTimeout(fn, delay);
      if (typeof setTimeout === "function") return setTimeout(fn, delay);
      return fn();
    };
    const installFrame = (frame) => {
      if (!frame || frame.__s004LoadHook) return;
      frame.__s004LoadHook = true;
      const apply = () => {
        const src = String(frame.src || "");
        // M06 is adapted inside baseline-module-runtime.js, in the same window
        // as RC_DATA and the frozen app's closure. Cross-frame DOM rewriting is
        // intentionally limited to M05 until its own exact adapter replaces it.
        const work = () => src.includes("agent-application") ? patchAgentFrame(frame) : null;
        schedule(work, 0);
        schedule(work, 220);
      };
      frame.addEventListener("load", apply);
      if (frame.contentDocument?.readyState === "complete") apply();
    };
    const scan = () => installFrame(root.document.getElementById("module-frame"));
    scan();
    if (root.MutationObserver && root.document.body) {
      const observer = new root.MutationObserver(scan);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    schedule(scan, 120);
  }

  async function reseedCurrent(adapter, options) {
    const opts = options || {};
    const activeAdapter = adapter || root.OFW_ACTIVE_SCENARIO_ADAPTER;
    if (!activeAdapter) throw new Error("缺少当前 S004 场景适配器，无法恢复原生投影");
    const storage = opts.storage || root.localStorage;
    const context = activeAdapter.context();
    // A directional reset changes scenarioRunId after the shell storage
    // proxy has already been installed. Move that proxy to the new namespace
    // before writing any native M01-M06 state; otherwise the re-seed lands in
    // the previous run while the reloaded module reads an empty new run.
    root.OFWRuntimeStorage?.install?.({ context });
    const artifacts = loadedArtifacts || await loadArtifacts(activeAdapter);
    loadedArtifacts = artifacts;
    const reportHtml = cacheForReseed.html !== undefined
      ? cacheForReseed.html
      : await loadReportHtml(cacheForReseed);
    writeVerificationContext(root.sessionStorage || storage, context, artifacts);
    seed(storage, context, reportHtml, artifacts);
    status.phase = "seeded";
    status.note = `reseeded scenarioRunId=${context.scenarioRunId}`;
    return status;
  }

  function currentProjection(adapter) {
    const activeAdapter = adapter || root.OFW_ACTIVE_SCENARIO_ADAPTER;
    if (!activeAdapter || !loadedArtifacts) return null;
    const S = root.OFW_S004_SeedData;
    const context = activeAdapter.context();
    const reportHtml = cacheForReseed.html || FALLBACK_REPORT_HTML;
    return {
      scenarioContext: S.ctx5(context),
      artifactIntegrity: loadedArtifacts.integrity
        ? JSON.parse(JSON.stringify(loadedArtifacts.integrity))
        : null,
      m06: S.buildM06State(context, reportHtml, loadedArtifacts)
    };
  }

  const cacheForReseed = { html: undefined };

  async function boot(adapter, options) {
    const opts = options || {};
    const storage = opts.storage || root.localStorage;
    const context = adapter.context();
    const cache = { html: undefined };

    if (root.location?.protocol === "file:") {
      root.document.body.innerHTML = [
        "<div style=\"font-family:system-ui;padding:40px;line-height:1.8;color:#1d2b3a\">",
        "<h2>S004 场景运行时需要 HTTP 同源模式</h2>",
        "<p>原生模块接入依赖同源 localStorage 与 postMessage，file:// 直开不再作为评审方式。</p>",
        "<p>请执行：<code>python3 -m http.server 4339 --directory designs</code> 后访问 ",
        "<code>http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/index.html#home</code></p></div>"
      ].join("");
      status.phase = "blocked-file-protocol";
      return status;
    }

    const artifacts = await loadArtifacts(adapter);
    loadedArtifacts = artifacts;
    // This compact, derived runtime context is refreshed even when the same
    // scenarioRunId already has legitimate in-flight or failed Run records.
    // It upgrades deterministic inputs and verified hashes without replaying
    // or overwriting M05/M06 lifecycle state.
    writeVerificationContext(root.sessionStorage || storage, context, artifacts);
    if (shouldSeed(storage, context)) {
      const reportHtml = await loadReportHtml(cache);
      cacheForReseed.html = reportHtml;
      seed(storage, context, reportHtml, artifacts);
    } else {
      cacheForReseed.html = cache.html;
      status.phase = "seeded";
      status.note = "marker matched current scenarioRunId; native seeds preserved";
    }

    // Scenario reset creates a new scenarioRunId: re-seed natively and reload
    // any live module frame so it boots from the fresh storage state.
    root.addEventListener("ofw:scenario-registry:S004:reset", async () => {
      await reseedCurrent(adapter, { storage });
      reloadModuleFrame();
    });

    const script = root.document.createElement("script");
    script.src = SHELL_SCRIPT;
    root.document.body.appendChild(script);
    installModuleRuntimeAdapters(adapter, artifacts);
    status.phase = status.phase === "seeded" ? "booted" : status.phase;
    return status;
  }

  const adapter = root.OFW_ACTIVE_SCENARIO_ADAPTER;
  if (!adapter || !root.OFW_S004_SeedData) {
    root.document.body.innerHTML = "<div style=\"font-family:system-ui;padding:40px\">S004 运行时装配失败：适配器或种子构建器未加载。</div>";
    throw new Error("OFW_ACTIVE_SCENARIO_ADAPTER / OFW_S004_SeedData missing");
  }
  root.OFW_S004_NativeSeeder = Object.freeze({
    seed,
    shouldSeed,
    boot,
    reseedCurrent,
    currentProjection,
    writeVerificationContext,
    loadArtifacts,
    prepareReportHtmlForReader,
    status: () => ({ ...status })
  });
  if (!root.__OFW_S004_NATIVE_SEEDER_DISABLE_AUTOBOOT__) {
    boot(adapter).catch((error) => {
      status.phase = "error";
      status.note = String(error?.message || error);
      const script = root.document.createElement("script");
      script.src = SHELL_SCRIPT;
      root.document.body.appendChild(script);
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
