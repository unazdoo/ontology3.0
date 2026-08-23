(function () {
  "use strict";

  // 报告中心只提交请求并读取回执；Session、Run 与 Result 始终由本文件
  // 提供的 Agent 应用运行服务创建和持久化。
  function installReportRuntime() {
    if (window.AGENT_REPORT_RUNTIME) return window.AGENT_REPORT_RUNTIME;
    const STORAGE_KEY = "ontology3.agent-application.report-runtime.v1";
    const timers = new Map();
    const cloneValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    const now = () => new Date().toLocaleString("zh-CN", { hour12: false });
    const safeParse = (value, fallback) => {
      try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
    };
    const emptyStore = () => ({ schemaVersion: 1, sequence: 0, requests: [], sessions: [], runs: [], results: [], receipts: [] });
    const compactStore = (store) => ({
      ...store,
      requests: (store.requests || []).slice(0, 16),
      sessions: (store.sessions || []).slice(0, 16),
      runs: (store.runs || []).slice(0, 16),
      results: (store.results || []).slice(0, 16),
      receipts: (store.receipts || []).slice(0, 16)
    });
    const read = () => {
      const stored = safeParse(sessionStorage.getItem(STORAGE_KEY), null) || safeParse(localStorage.getItem(STORAGE_KEY), null);
      return stored && stored.schemaVersion === 1 ? stored : emptyStore();
    };
    const write = (store) => {
      const compacted = compactStore(store);
      const serialized = JSON.stringify(compacted);
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        sessionStorage.setItem(STORAGE_KEY, serialized);
      }
      try { window.dispatchEvent(new CustomEvent("ontology3:agent-report-runtime-updated", { detail: { storageKey: STORAGE_KEY } })); } catch (_) {}
      return compacted;
    };
    const hash = (value) => {
      let output = 2166136261;
      for (const char of String(value || "")) {
        output ^= char.charCodeAt(0);
        output = Math.imul(output, 16777619);
      }
      return (output >>> 0).toString(36).toUpperCase();
    };
    const scenarioDefaults = {
      S001: { scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-20260816081748567-705ac89fb83a", formedAt: "2026-08-16T08:17:48.567Z" },
      S002: { scenarioVersion: "S002-v1", scenarioRunId: "S002-RUN-20260815080000000-6ef5d0ef82f9", formedAt: "2026-08-15T08:00:00.000Z" },
      S003: { scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-20260817163000000-c02200000001", formedAt: "2026-08-17T16:30:00.000Z" },
      S004: { scenarioVersion: "S004-v2.1.0", scenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6", formedAt: "2026-08-15T23:30:00.000Z" }
    };
    const scenarioNames = { S001: "集团融资成本与债务结构优化", S002: "预算监督管理", S003: "债务风险监测", S004: "财务公司贷款贷前调查" };
    const normalizeContext = (payload = {}) => {
      const scenarioId = payload.scenarioId || payload.scenarioContext?.scenarioId || "S001";
      const defaults = scenarioDefaults[scenarioId] || scenarioDefaults.S001;
      return {
        scenarioId,
        scenarioVersion: payload.scenarioVersion || payload.scenarioContext?.scenarioVersion || defaults.scenarioVersion,
        scenarioRunId: payload.scenarioRunId || payload.scenarioContext?.scenarioRunId || defaults.scenarioRunId,
        formedAt: payload.formedAt || payload.scenarioContext?.formedAt || defaults.formedAt,
        status: "active"
      };
    };
    const credibilityFor = (request) => {
      const checkedAt = request.startedAt || request.receivedAt;
      return {
        contract: "报告固定输入可信度",
        contextStatus: "normal",
        lastReadAt: checkedAt,
        versionBindingSummary: { id: `M05-BINDING-${hash(request.id)}`, version: "1.0", status: "ready", label: "精确版本已固定", formedAt: checkedAt, observedAt: checkedAt },
        currentStateSummary: { id: `M05-CURRENT-${hash(request.id)}`, version: "1.0", status: "ready", label: "固定输入核验通过", formedAt: checkedAt, observedAt: checkedAt },
        historyDimensions: [
          { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "报告、语义、数据和证据身份完整。", checkedAt },
          { id: "content-access", name: "内容访问", status: "available", label: "固定内容可访问", reason: "本次只读取报告中心固定的内容与证据。", checkedAt },
          { id: "evidence-completeness", name: "证据完整", status: "complete", label: "完整", reason: "结果引用均可回到本次固定证据。", checkedAt },
          { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "不在本次运行", reason: "本次运行不重新执行数据工程历史任务。", checkedAt },
          { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "报告生成与伴读不等于数据重放。", checkedAt }
        ],
        agentGates: [
          { id: "report-question", name: "报告伴读", status: "ready", label: "允许", reason: "报告版本、稳定锚点和固定证据上下文完整。", recovery: "上下文变化时由报告中心提交新请求。" },
          { id: "report-verification", name: "报告自动核验抽取", status: "ready", label: "允许", reason: "报告内容、稳定锚点、核验定义与固定证据上下文完整。", recovery: "身份或证据变化时创建新抽取运行。" },
          { id: "report-draft-transfer", name: "报告草稿移交", status: "ready", label: "允许", reason: "固定报告定义、模板和证据输入完整。", recovery: "身份变化时创建新生成请求。" }
        ],
        useFlags: { isCurrentAuthoritative: true, canStartNewRun: true, canConfirmNewResult: true, canPrepareActionRequest: false, historyDisclosureRequired: false }
      };
    };
    const receiptFor = (store, requestId) => store.receipts.find((item) => item.requestId === requestId) || null;
    const replaceById = (items, item) => {
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) items[index] = item;
      else items.unshift(item);
    };
    const runtimeProfileFor = (kind) => ({
      "report-reading": {
        requestCode: "READ",
        agentId: "report-copilot",
        inputContract: "Report Reading Request v1",
        outputContract: "Report Copilot Result v1",
        prompt: { id: "prompt-report-reading", name: "报告固定上下文伴读", version: "1.0" },
        skill: { id: "skill-report-reading", name: "报告证据伴读", version: "1.0" },
        tools: ["tool-report-context", "tool-evidence-reader", "tool-output-validator"],
        processLabel: "证据解释",
        waitingDetail: "正在解释报告固定内容"
      },
      "report-generation": {
        requestCode: "DRAFT",
        agentId: "report-draft",
        inputContract: "Report Generation Request v1",
        outputContract: "Agent Report Draft v1",
        prompt: { id: "prompt-report-draft", name: "报告草稿生成", version: "1.0" },
        skill: { id: "skill-report-organization", name: "报告证据组织", version: "1.0" },
        tools: ["tool-evidence-reader", "tool-citation-validator", "tool-report-draft-handoff"],
        processLabel: "结构化草稿生成",
        waitingDetail: "正在组织结构化报告草稿"
      },
      "report-verification": {
        requestCode: "VERIFY",
        agentId: "report-verification-agent",
        inputContract: "Report Verification Request v1",
        outputContract: "Report Verification Extraction v1",
        prompt: { id: "prompt-report-verification-extraction", name: "报告自动核验抽取边界", version: "1.0" },
        skill: { id: "skill-report-verification-extraction", name: "报告声明与证据映射", version: "1.0" },
        tools: ["tool-report-context", "tool-evidence-reader", "tool-citation-validator", "tool-output-validator", "tool-verification-extraction-return"],
        processLabel: "声明与证据映射",
        waitingDetail: "正在抽取报告声明并准备证据比对请求"
      }
    }[kind] || null);
    const verificationExtractionFor = (request, run, generatedAt) => {
      const payload = request.payload;
      const sourceClaims = Array.isArray(payload.reportContent?.items)
        ? payload.reportContent.items
        : Array.isArray(payload.reportContentItems)
          ? payload.reportContentItems
          : Array.isArray(payload.claims)
            ? payload.claims
            : Array.isArray(payload.verificationItems)
              ? payload.verificationItems
              : [];
      const claims = sourceClaims.map((item, index) => {
        const anchorId = item.anchorId || item.anchor?.id || `ANCHOR-${hash(`${request.id}:${item.section || item.anchorLabel || index + 1}`)}`;
        const evidenceRef = item.evidenceRef || item.evidenceId || payload.evidenceRefs?.[index] || payload.evidencePackageId;
        return {
          id: item.id || `CLAIM-${hash(`${request.id}:${anchorId}:${index + 1}`)}`,
          claimType: item.claimType || item.type || "报告事实声明",
          label: item.label || item.name || item.claim || `待核验声明 ${index + 1}`,
          reportedValue: item.reportedValue ?? item.reportValue ?? item.value ?? null,
          unit: item.unit || null,
          period: item.period || payload.dataAsOf || null,
          subject: item.subject || payload.subject || payload.reportTitle || null,
          sourceText: item.sourceText || item.reportText || item.text || null,
          anchorId,
          anchorLabel: item.anchorLabel || item.section || item.anchor?.label || "报告正文",
          evidenceRef,
          comparisonMethod: item.comparisonMethod || item.compareMethod || "exact-or-rule-defined",
          extractionStatus: evidenceRef ? "mapped" : "evidence-unresolved",
          extractionNote: item.extractionNote || (evidenceRef ? "声明与固定证据引用已建立映射，等待确定性规则引擎判定。" : "固定证据引用不可定位，未推测替代证据。")
        };
      });
      const anchorsById = new Map();
      ([...(payload.reportContent?.anchors || []), ...(payload.anchors || [])]).forEach((anchor, index) => {
        const id = anchor.id || `ANCHOR-${hash(`${request.id}:provided:${index + 1}`)}`;
        anchorsById.set(id, { id, label: anchor.label || anchor.name || `报告位置 ${index + 1}`, location: anchor.location || anchor.path || null, textDigest: anchor.textDigest || anchor.digest || null });
      });
      claims.forEach((claim) => {
        if (!anchorsById.has(claim.anchorId)) anchorsById.set(claim.anchorId, { id: claim.anchorId, label: claim.anchorLabel, location: null, textDigest: claim.sourceText ? hash(claim.sourceText) : null });
      });
      const evidenceRefs = [...new Set([...(payload.evidenceRefs || []), ...(payload.evidenceDirectory || []).map((item) => item.id || item.ref), ...claims.map((claim) => claim.evidenceRef)].filter(Boolean))];
      const comparisonRequests = claims.map((claim, index) => ({
        id: `COMPARE-${hash(`${request.id}:${claim.id}:${index + 1}`)}`,
        claimId: claim.id,
        reportValue: claim.reportedValue,
        unit: claim.unit,
        period: claim.period,
        evidenceRef: claim.evidenceRef,
        comparisonMethod: claim.comparisonMethod,
        determinationStatus: "not-evaluated",
        determinationOwner: "报告中心确定性规则引擎"
      }));
      const resultId = `M05-RESULT-VERIFY-${hash(`${request.id}:${generatedAt}`)}`;
      return {
        id: resultId,
        requestId: request.id,
        runId: run.id,
        type: "Report Verification Extraction",
        resultContract: "Report Verification Extraction v1",
        title: `${payload.reportTitle || "正式报告"}自动核验抽取结果`,
        summary: `已从固定报告内容中抽取 ${claims.length} 项声明、${anchorsById.size} 个稳定锚点，并形成 ${comparisonRequests.length} 项待执行证据比对请求。`,
        claims,
        anchors: [...anchorsById.values()],
        evidenceRefs,
        comparisonRequests,
        sections: claims.length
          ? claims.map((claim) => ({ title: claim.label, body: `${claim.reportedValue ?? "待识别"}${claim.unit || ""} · ${claim.anchorLabel} · 等待确定性判定`, refs: [claim.evidenceRef].filter(Boolean) }))
          : [{ title: "未形成可判定声明", body: "固定上下文中没有提供可抽取的结构化声明；结果不携带通过或失败判断。", refs: [] }],
        limitations: "本结果只负责报告声明抽取、锚点定位和证据映射；不读取业务明细、不重算指标，也不决定核验通过或失败。",
        destination: "报告中心确定性核验引擎",
        returnReceipt: "核验抽取结果已回传报告中心",
        owner: "Agent 应用",
        determinationOwner: "报告中心确定性规则引擎",
        confidence: claims.every((claim) => claim.extractionStatus === "mapped") ? "声明、锚点与证据引用完整" : "部分声明仍缺少可定位证据",
        confirmation: "not-required",
        generatedAt,
        scenarioContext: cloneValue(request.scenarioContext),
        reportNumber: payload.reportNumber,
        contentVersion: payload.contentVersion
      };
    };
    const resultForRequest = (request, run) => {
      const payload = request.payload;
      const generatedAt = now();
      if (request.kind === "report-verification") return verificationExtractionFor(request, run, generatedAt);
      if (request.kind === "report-reading") {
        const resultId = `M05-RESULT-READ-${hash(`${request.id}:${generatedAt}`)}`;
        return {
          id: resultId,
          requestId: request.id,
          runId: run.id,
          sessionId: run.sessionId,
          type: "Report Copilot Result",
          resultContract: "Report Copilot Result v1",
          title: `${payload.reportTitle || "正式报告"}伴读结果`,
          summary: payload.answerBasis || `已依据${payload.reportTitle || "正式报告"}的固定内容和证据完成回答。`,
          answer: payload.answerBasis || `根据${payload.reportTitle || "本报告"}内容版本 ${payload.contentVersion || "当前版本"}，当前问题可由报告固定结论直接回答。`,
          question: payload.question,
          evidenceRefs: [...(payload.evidenceRefs || [payload.evidencePackageId]).filter(Boolean)],
          sections: [{ title: "回答", body: payload.answerBasis || "已依据报告固定内容完成解释。", refs: [...(payload.evidenceRefs || [payload.evidencePackageId]).filter(Boolean)] }],
          limitations: "只解释本次固定报告内容和证据，不重新计算业务数据。",
          destination: "报告中心伴读界面",
          returnReceipt: "伴读结果已回传报告中心",
          owner: "Agent 应用",
          confidence: "固定内容与证据引用完整",
          confirmation: "not-required",
          generatedAt,
          scenarioContext: cloneValue(request.scenarioContext),
          reportNumber: payload.reportNumber,
          contentVersion: payload.contentVersion
        };
      }
      const sections = (payload.chapters || ["报告摘要"]).map((title, index) => ({
        title,
        body: payload.sectionBodies?.[index] || (index === 0
          ? payload.summary || `${payload.subject || "报告对象"}的关键经营事实、变化与关注事项已按固定证据完成组织。`
          : `${title}所需事实已按${payload.templateName || "当前模板"}组织，并保留到固定证据包的逐项引用。`),
        refs: [...(payload.evidenceRefs || [payload.evidencePackageId]).filter(Boolean)]
      }));
      const resultId = `M05-RESULT-DRAFT-${hash(`${request.id}:${generatedAt}`)}`;
      const sourceDraftId = `DRAFT-${hash(`${request.id}:${payload.targetContentRevision || "next"}`)}`;
      return {
        id: resultId,
        requestId: request.id,
        runId: run.id,
        type: "Agent Report Draft",
        resultContract: "Agent Report Draft v1",
        title: `${payload.subject || "报告对象"} · ${payload.definitionName || "报告"}源草稿`,
        summary: payload.summary || `${payload.subject || "报告对象"}的报告内容已按固定定义、模板和证据完成结构化组织。`,
        sections,
        limitations: "源草稿不代表人工复核或正式发布结果。",
        destination: "报告中心待复核草稿",
        returnReceipt: "报告源草稿已回传报告中心",
        owner: "Agent 应用",
        confidence: "固定定义、模板与证据引用完整",
        confirmation: "unconfirmed",
        generatedAt,
        scenarioContext: cloneValue(request.scenarioContext),
        sourceDraft: {
          id: sourceDraftId,
          title: `${payload.subject || "报告对象"} · ${payload.definitionName || "报告"}草稿`,
          definitionId: payload.definitionId,
          templateId: payload.templateId,
          targetContentRevision: payload.targetContentRevision,
          sections
        }
      };
    };
    const setReceipt = (store, requestId, patch) => {
      const existing = receiptFor(store, requestId) || { id: `M05-RECEIPT-${hash(requestId)}`, requestId };
      const next = { ...existing, ...patch, updatedAt: now() };
      const index = store.receipts.findIndex((item) => item.requestId === requestId);
      if (index >= 0) store.receipts[index] = next;
      else store.receipts.unshift(next);
      return next;
    };
    const advanceToRunning = (requestId) => {
      const store = read();
      const request = store.requests.find((item) => item.id === requestId);
      if (!request || !["queued", "processing"].includes(request.status)) return;
      request.status = "processing";
      request.startedAt = request.startedAt || now();
      const profile = runtimeProfileFor(request.kind);
      const sessionId = request.kind === "report-reading" ? `M05-SESSION-${hash(request.id)}` : null;
      const run = store.runs.find((item) => item.requestId === request.id) || {
        id: `M05-RUN-${hash(request.id)}`,
        requestId: request.id,
        sessionId,
        bindingId: sessionId ? `M05-BIND-${hash(request.id)}` : null,
        status: "running",
        createdAt: request.startedAt,
        finishedAt: null,
        source: "报告中心请求",
        currentProjection: true,
        projectionStatus: "current",
        portfolioRecord: true,
        scenarioContext: cloneValue(request.scenarioContext),
        attempt: request.attempt,
        retryOf: request.retryOf || null,
        snapshot: {
          agentId: request.payload.agentId,
          agentName: request.payload.agentName,
          agentRelease: request.payload.agentVersion,
          outputContract: profile.outputContract,
          evidenceId: request.payload.evidencePackageId,
          evidenceName: request.payload.evidenceName || "报告固定证据",
          evidencePackageId: request.payload.evidencePackageId,
          evidencePackageVersion: request.payload.evidencePackageVersion || "1.0",
          ontologyVersion: request.payload.semanticVersion,
          semanticVersionId: request.payload.semanticVersionId,
          dataVersion: request.payload.dataVersion,
          dataAssetVersionId: request.payload.dataVersion,
          dataAsOf: request.payload.dataAsOf,
          ontology: request.payload.semanticVersion,
          quality: request.payload.verification || "确定性核验通过",
          freshness: "运行时固定",
          requestContext: { id: request.id, version: "1.0", sourceOwner: "报告中心", requestedAt: request.receivedAt },
          objectScope: request.payload.subject || request.payload.reportTitle,
          inputContract: profile.inputContract,
          expectedOutput: profile.outputContract,
          scenarioBinding: { id: `AG-SB-${request.scenarioContext.scenarioId}`, version: request.payload.agentVersion, scenarioId: request.scenarioContext.scenarioId, status: "ready" },
          prompt: { id: profile.prompt.id, version: profile.prompt.version },
          promptBinding: cloneValue(profile.prompt),
          skills: [{ id: profile.skill.id, version: profile.skill.version }],
          skillBindings: [cloneValue(profile.skill)],
          tools: [...profile.tools],
          scenarioId: request.scenarioContext.scenarioId,
          scenarioVersion: request.scenarioContext.scenarioVersion,
          scenarioRunId: request.scenarioContext.scenarioRunId,
          scenarioFormedAt: request.scenarioContext.formedAt,
          scenarioStatus: request.scenarioContext.status,
          scenarioContext: cloneValue(request.scenarioContext),
          scenario: `${request.scenarioContext.scenarioId} · ${scenarioNames[request.scenarioContext.scenarioId] || "业务场景"}`,
          reportNumber: request.payload.reportNumber || null,
          contentVersion: request.payload.contentVersion || null,
          question: request.payload.question || (request.kind === "report-verification" ? "抽取报告声明并准备证据比对请求" : "生成结构化报告草稿"),
          credibility: credibilityFor(request)
        },
        steps: [
          { id: "input", name: "固定输入与版本校验", status: "complete", detail: "报告、语义、数据和证据身份完整" },
          { id: "tools", name: "受控证据读取", status: "running", detail: "只读取报告中心提供的固定内容与证据" },
          { id: "generate", name: profile.processLabel, status: "waiting", detail: "等待固定证据读取完成" },
          { id: "output", name: "输出合同校验", status: "waiting", detail: profile.outputContract }
        ],
        toolCalls: profile.tools.map((toolId, index) => ({ id: `${request.id}-TC-${index + 1}`, toolId, toolVersion: "1.0", toolName: toolId, toolOwner: toolId === "tool-report-context" ? "报告中心" : "Agent 应用", status: index === 0 ? "running" : "waiting", duration: null, input: "固定报告上下文", output: null })),
        result: null,
        error: null,
        recovery: null
      };
      replaceById(store.runs, run);
      if (sessionId) replaceById(store.sessions, {
        id: sessionId,
        bindingId: run.bindingId,
        latestRunId: run.id,
        latestResultId: null,
        status: "active",
        currentProjection: true,
        projectionStatus: "current",
        portfolioRecord: true,
        scenarioContext: cloneValue(request.scenarioContext),
        scenarioId: request.scenarioContext.scenarioId,
        scenarioVersion: request.scenarioContext.scenarioVersion,
        scenarioRunId: request.scenarioContext.scenarioRunId,
        scenarioFormedAt: request.scenarioContext.formedAt,
        scenarioStatus: request.scenarioContext.status,
        reportNumber: request.payload.reportNumber,
        contentVersion: request.payload.contentVersion,
        reportVersion: `${request.payload.reportTitle || "正式报告"} · ${request.payload.contentVersion || "当前版本"}`,
        anchor: request.payload.anchor || "报告全文",
        evidencePackageId: request.payload.evidencePackageId,
        evidencePackageVersion: request.payload.evidencePackageVersion || "1.0",
        semanticVersionId: request.payload.semanticVersionId,
        ontologyVersion: request.payload.semanticVersion,
        dataAssetVersionId: request.payload.dataVersion,
        dataVersion: request.payload.dataVersion,
        requestContext: { id: request.id, version: "1.0", sourceOwner: "报告中心", requestedAt: request.receivedAt },
        verificationSummary: request.payload.verification || "确定性核验通过",
        verificationRunRef: request.payload.verificationRunId || `M06-VERIFY-${hash(request.id)}`,
        currentComparisonRef: request.payload.comparisonRecordId || null,
        regenerationStatus: "尚未请求",
        regenerationRef: null,
        resultReturnStatus: "处理中"
      });
      setReceipt(store, request.id, { status: "processing", runId: run.id, sessionId, message: profile.waitingDetail });
      write(store);
    };
    const finish = (requestId) => {
      const store = read();
      const request = store.requests.find((item) => item.id === requestId);
      const run = store.runs.find((item) => item.requestId === requestId);
      if (!request || !run || request.status !== "processing") return;
      if (request.payload.simulateFailure) {
        const reason = request.payload.failureReason || "固定证据读取超时";
        request.status = "failed";
        request.finishedAt = now();
        run.status = "failed";
        run.finishedAt = request.finishedAt;
        run.error = reason;
        run.recovery = "重新读取报告固定上下文后重试；原请求和失败记录保持不变。";
        run.steps = (run.steps || []).map((step) => step.status === "complete" ? step : { ...step, status: step.id === "tools" ? "failed" : "blocked", detail: step.id === "tools" ? reason : "上一步未完成" });
        run.toolCalls = (run.toolCalls || []).map((call, index) => index === 0 ? { ...call, status: "failed", duration: "1.1 s", output: reason } : { ...call, status: "blocked", output: "上一步未完成" });
        setReceipt(store, request.id, { status: "failed", runId: run.id, reason, recovery: run.recovery, message: "本次处理未完成" });
      } else {
        const result = resultForRequest(request, run);
        request.status = "complete";
        request.finishedAt = result.generatedAt;
        request.resultId = result.id;
        run.status = "complete";
        run.finishedAt = result.generatedAt;
        run.result = cloneValue(result);
        run.steps = (run.steps || []).map((step) => ({ ...step, status: "complete", detail: step.id === "output" ? "输出合同校验通过并形成结果回执" : step.detail }));
        run.toolCalls = (run.toolCalls || []).map((call, index) => ({ ...call, status: "complete", duration: `${0.3 + index * 0.2} s`, output: index === run.toolCalls.length - 1 ? "结果合同校验通过" : "固定证据读取完成" }));
        replaceById(store.results, result);
        if (run.sessionId) {
          const session = store.sessions.find((item) => item.id === run.sessionId);
          if (session) {
            session.status = "complete";
            session.latestResultId = result.id;
            session.resultReturnStatus = "已回传报告中心";
            session.resultReturnedAt = result.generatedAt;
          }
        }
        setReceipt(store, request.id, { status: "complete", runId: run.id, sessionId: run.sessionId, resultId: result.id, result: cloneValue(result), message: result.returnReceipt });
      }
      write(store);
      timers.delete(requestId);
    };
    const schedule = (requestId) => {
      if (timers.has(requestId)) return;
      const runningTimer = window.setTimeout(() => advanceToRunning(requestId), 360);
      const finishTimer = window.setTimeout(() => finish(requestId), 1450);
      timers.set(requestId, [runningTimer, finishTimer]);
    };
    const submit = (payload = {}) => {
      const kind = ["report-generation", "report-verification"].includes(payload.kind) ? payload.kind : "report-reading";
      const profile = runtimeProfileFor(kind);
      const required = kind === "report-generation"
        ? ["definitionId", "templateId", "subject", "dataVersion", "evidencePackageId", "agentId"]
        : kind === "report-verification"
          ? ["reportNumber", "contentVersion", "evidencePackageId", "agentId", "verificationDefinitionId"]
          : ["reportNumber", "contentVersion", "question", "evidencePackageId", "agentId"];
      const missing = required.filter((field) => !payload[field]);
      if (missing.length) throw new Error(`请求缺少：${missing.join("、")}`);
      if (kind === "report-verification" && payload.agentId !== profile.agentId) throw new Error(`报告自动核验必须使用 ${profile.agentId}`);
      if (kind === "report-verification" && !payload.reportContent && !Array.isArray(payload.reportContentItems) && !Array.isArray(payload.claims) && !Array.isArray(payload.verificationItems)) {
        throw new Error("报告自动核验缺少固定报告内容");
      }
      const store = read();
      const context = normalizeContext(payload);
      const id = payload.requestId || `M05-REQ-${profile.requestCode}-${hash(`${Date.now()}:${store.sequence}:${payload.retryOf || "root"}:${payload.attempt || 1}:${payload.reportNumber || payload.definitionId}:${payload.question || payload.subject || payload.verificationDefinitionId}`)}`;
      const existing = store.requests.find((item) => item.id === id);
      if (existing) return cloneValue(receiptFor(store, id));
      const request = {
        id,
        kind,
        status: "queued",
        source: "报告中心",
        receivedAt: now(),
        startedAt: null,
        finishedAt: null,
        attempt: payload.attempt || 1,
        retryOf: payload.retryOf || null,
        scenarioContext: context,
        payload: { ...cloneValue(payload), scenarioContext: context }
      };
      store.sequence += 1;
      store.requests.unshift(request);
      const receipt = setReceipt(store, id, { status: "accepted", message: "请求已由 Agent 应用接收", attempt: request.attempt, retryOf: request.retryOf });
      write(store);
      schedule(id);
      return cloneValue(receipt);
    };
    const retry = (requestId) => {
      const store = read();
      const source = store.requests.find((item) => item.id === requestId);
      if (!source || source.status !== "failed") throw new Error("仅失败请求可以重试");
      return submit({ ...cloneValue(source.payload), requestId: undefined, retryOf: source.id, attempt: (source.attempt || 1) + 1, simulateFailure: false, failureReason: undefined });
    };
    const mergeIntoModel = (model = {}) => {
      const output = cloneValue(model);
      const store = read();
      const merge = (current = [], additions = []) => {
        const byId = new Map(additions.map((item) => [item.id, cloneValue(item)]));
        current.forEach((item) => { if (!byId.has(item.id)) byId.set(item.id, item); });
        return [...byId.values()];
      };
      const evidence = store.requests.map((request) => ({
        id: request.payload.evidencePackageId,
        name: request.payload.evidenceName || `${request.payload.reportTitle || request.payload.definitionName || "报告"}固定证据`,
        kind: request.kind === "report-reading" ? "report" : request.kind === "report-verification" ? "report-verification" : "report-generation",
        version: request.payload.evidencePackageVersion || "1.0",
        status: "ready",
        statusLabel: "固定输入可用",
        quality: request.payload.verification || "确定性核验通过",
        freshness: "运行时固定",
        ontologyVersion: request.payload.semanticVersion,
        semanticVersionId: request.payload.semanticVersionId,
        dataVersion: request.payload.dataVersion,
        dataAssetVersionId: request.payload.dataVersion,
        dataAsOf: request.payload.dataAsOf,
        authority: "报告中心固定报告上下文",
        formedAt: request.startedAt || request.receivedAt,
        requestContext: { id: request.id, version: "1.0", sourceOwner: "报告中心", requestedAt: request.receivedAt, scenarioId: request.scenarioContext.scenarioId, scenarioLabel: scenarioNames[request.scenarioContext.scenarioId], objectScope: request.payload.subject || request.payload.reportTitle, expectedOutput: runtimeProfileFor(request.kind).outputContract },
        scenarioContext: cloneValue(request.scenarioContext),
        report: ["report-reading", "report-verification"].includes(request.kind) ? { number: request.payload.reportNumber, name: request.payload.reportTitle, contentVersion: request.payload.contentVersion, anchor: request.payload.anchor || "报告全文", verification: request.payload.verification } : null,
        credibility: credibilityFor(request),
        currentProjection: true,
        projectionStatus: "current",
        portfolioRecord: true,
        items: (request.payload.evidenceRefs || [request.payload.evidencePackageId]).filter(Boolean).map((ref, index) => ({ id: `${request.id}-EV-${index + 1}`, type: "报告固定证据", name: ref, value: "已固定", source: request.payload.reportNumber || request.payload.definitionId }))
      }));
      const inboundRequests = store.requests.map((request) => ({
        id: request.id,
        sourceRequestId: request.id,
        type: request.kind === "report-reading" ? "report-copilot" : request.kind === "report-verification" ? "report-verification" : "report-draft",
        source: "报告中心",
        title: request.kind === "report-reading" ? `${request.payload.reportTitle}伴读请求` : request.kind === "report-verification" ? `${request.payload.reportTitle}自动核验请求` : `${request.payload.definitionName}生成请求`,
        question: request.payload.question || (request.kind === "report-verification" ? "抽取报告声明并准备证据比对请求" : `为${request.payload.subject}生成报告草稿`),
        status: request.status === "queued" ? "pending" : request.status,
        receivedAt: request.receivedAt,
        agentId: request.payload.agentId,
        evidenceId: request.payload.evidencePackageId,
        scenarioContext: cloneValue(request.scenarioContext),
        currentProjection: true,
        projectionStatus: "current",
        portfolioRecord: true,
        runId: store.runs.find((run) => run.requestId === request.id)?.id || null,
        resultId: request.resultId || null,
        blockedReason: request.status === "failed" ? receiptFor(store, request.id)?.reason : null,
        recovery: request.status === "failed" ? receiptFor(store, request.id)?.recovery : null,
        reportNumber: request.payload.reportNumber || null,
        contentVersion: request.payload.contentVersion || null
      }));
      output.evidencePackages = merge(output.evidencePackages, evidence);
      output.inboundRequests = merge(output.inboundRequests, inboundRequests);
      output.runs = merge(output.runs, store.runs);
      output.sessions = merge(output.sessions, store.sessions);
      return output;
    };
    const resume = () => read().requests.filter((item) => ["queued", "processing"].includes(item.status)).forEach((item) => schedule(item.id));
    const api = Object.freeze({
      storageKey: STORAGE_KEY,
      read,
      submit,
      submitVerification: (payload = {}) => submit({ ...payload, kind: "report-verification", agentId: payload.agentId || "report-verification-agent" }),
      retry,
      getReceipt: (requestId) => cloneValue(receiptFor(read(), requestId)),
      mergeIntoModel,
      resume
    });
    window.AGENT_REPORT_RUNTIME = api;
    window.OFW_REPORT_VERIFICATION_AGENT = Object.freeze({
      id: "report-verification-agent",
      name: "报告自动核验 Agent",
      version: "1.0",
      configuration: "report-verification-agent@1.0",
      extraction: "抽取报告主体、期间、关键声明、数值、单位和引用关系",
      anchorPolicy: "只定位报告中心固定内容与固定证据目录中的稳定锚点",
      judgement: "不返回正式通过或失败；由报告中心确定性规则引擎逐项判定",
      inputContract: "Report Verification Request v1",
      outputContract: "Report Verification Extraction v1"
    });
    resume();
    return api;
  }

  installReportRuntime();

  const registry = window.OFW_COMPOSITE_REGISTRY;
  const initial = window.AGENT_APP_INITIAL_STATE;
  if (!registry || !initial) return;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const formedAt = "2026-08-22 09:00:00";
  const sourceRefs = Object.freeze({
    S002: "scenarios/s002/checkpoints/runs/S002-RUN-20260815080000000-6ef5d0ef82f9/evidence/CP06-agent-report-dashboard-completed/M05-state-export.json",
    S003: "scenarios/s003/resources/m05/agent-position.v7.json",
    S004: "scenarios/s004-runtime-v2.1.0/seed-data.js#buildM05State"
  });

  const contextFor = (scenarioId) => {
    const scene = registry.scene(scenarioId);
    return {
      scenarioId: scene.scenarioId,
      scenarioVersion: scene.scenarioVersion,
      scenarioRunId: scene.scenarioRunId,
      formedAt: scenarioId === "S003" ? "2026-08-17T16:30:00.000Z" : scenarioId === "S004" ? "2026-08-15T23:30:00.000Z" : "2026-08-15T08:00:00.000Z",
      status: "active"
    };
  };

  function addCatalogResource(target, resource) {
    if (!target.some((item) => item.id === resource.id)) target.push(resource);
  }

  addCatalogResource(window.AGENT_PROMPTS, {
    id: "prompt-budget-anomaly",
    name: "预算异常证据解释边界",
    owner: "Agent 应用",
    versions: [{
      version: "1.0",
      status: "published",
      validatedAt: "2026-08-15 08:00",
      change: "接入预算固定视图、Rule命中和证据引用",
      variables: ["预算异常事实", "固定问数视图", "Published语义引用", "输出合同"],
      contextBoundary: "只解释S002同轮C018固定结果和Published Rule，不读取预算源表，不创建行动申请。",
      outputContracts: ["AI Insight v1"],
      sections: [
        { title: "角色与任务", body: "解释预算执行、项目余额、采购占用、成本费用和差旅等固定结果，帮助业务人员判断异常集中在哪个主体、项目或费用类别；只形成可复核洞察，不替代预算调整审批。" },
        { title: "开始前核对", body: "先核对S002场景轮次、C018固定视图、Published语义版本、数据截至时间、对象范围和质量状态；身份错配、视图陈旧或正式用途受限时停止分析并返回恢复位置。" },
        { title: "证据与口径", body: "每个数值、偏差、占用或Rule命中都回指C018结果、Metric或Rule稳定身份；不得直接读取预算源表，也不得把不同期间、单位或项目范围的结果拼接比较。" },
        { title: "分析方式", body: "先说明预算执行与余额全貌，再按异常程度、影响金额和业务紧迫性排序；区分超预算、执行偏慢、采购占用、跨年趋势和资料缺失，不把相关性写成因果。" },
        { title: "输出要求", body: "按“结论、关键数字、影响对象、口径与时点、建议核对、证据引用、限制”返回；证据不足时只回答获准范围并列出缺口。" },
        { title: "禁止事项", body: "不得修改预算、生成审批结论、创建Action Request、触发外部系统或用LLM计算替代Published Metric和Rule。" }
      ]
    }]
  });
  addCatalogResource(window.AGENT_PROMPTS, {
    id: "prompt-budget-report",
    name: "预算专题报告草稿组织边界",
    owner: "Agent 应用",
    versions: [{
      version: "1.0",
      status: "published",
      validatedAt: "2026-08-15 08:00",
      change: "接入预算固定视图和异常分析结果",
      variables: ["报告章节", "C018固定视图", "异常分析结果", "证据引用"],
      contextBoundary: "只使用S002同轮固定视图和异常分析结果形成源草稿。",
      outputContracts: ["Agent Report Draft v1"],
      sections: [
        { title: "角色与任务", body: "按照预算专题报告定义，把预算执行、项目余额、采购占用、差旅和跨年趋势的固定结果组织成结构化源草稿，供报告中心人工复核和编排。" },
        { title: "开始前核对", body: "核对场景轮次、报告定义、章节与模板槽位、C018固定视图、异常分析结果、Published语义版本和截至时间；任一精确身份缺失时不创建草稿。" },
        { title: "内容组织", body: "保持原单位、期间、主体和项目范围，先写整体结论，再写偏差较大的对象和原因线索；人工判断、整改意见和审批结论保留为空或明确标记待人工填写。" },
        { title: "证据绑定", body: "每个内容项绑定C018结果、Metric、Rule或异常分析结果；缺少证据时保留缺口，不补猜数值、不套用其他专题结论。" },
        { title: "输出要求", body: "返回章节、槽位、内容项、事实与证据绑定、覆盖情况、缺口、限制和精确场景版本，供报告中心生成独立复核副本。" },
        { title: "禁止事项", body: "不得发布正式报告、执行确定性核验、修改预算、形成审批决定或创建决策事项。" }
      ]
    }]
  });
  addCatalogResource(window.AGENT_PROMPTS, {
    id: "prompt-report-reading-s003",
    name: "债务风险报告固定上下文伴读边界",
    owner: "Agent 应用",
    versions: [{
      version: "1.4",
      status: "published",
      validatedAt: "2026-08-17 19:41",
      change: "绑定S003正式企业债务风险报告和13项确定性核验摘要",
      variables: ["问题", "报告内容版本", "稳定章节锚点", "固定证据包", "Published模型身份", "确定性核验摘要"],
      contextBoundary: "只解释报告中心通过同轮C024提供的企业风险报告和固定证据。",
      outputContracts: ["Report Copilot Answer v1"],
      sections: [
        { title: "角色与任务", body: "解释正式企业债务风险报告中的评分、风险分档、低分指标、调节因子和核验结论，帮助用户理解风险来自哪里、哪些是模型事实、哪些仍需人工判断。" },
        { title: "开始前核对", body: "核对企业、报告编号与内容版本、稳定章节锚点、C024请求、固定证据包、C035模型运行、Published模型版本和13项核验摘要均属于同一S003运行轮次。" },
        { title: "证据使用", body: "风险等级、原始评分、调节结果、指标得分和核验状态分别回指精确证据。不得使用其他企业、其他模型版本或当前重跑结果覆盖报告形成时事实。" },
        { title: "解释方式", body: "先回答当前风险等级和得分，再说明贡献最大的低分指标及调节因子影响，最后说明核验是否通过、建议关注事项和人工判断边界；不把模型相关性写成确定因果。" },
        { title: "输出要求", body: "按“直接结论、主要风险来源、调节影响、核验状态、建议关注、证据引用、限制”返回，并保留精确企业、报告、模型和运行身份。" },
        { title: "失败与边界", body: "证据、模型或运行身份不可定位时拒绝解释具体数值；只能说明缺失项和恢复位置。不得重算评分、修改模型或调节因子、发起行动申请、确认决策或创建待办。" }
      ]
    }]
  });

  addCatalogResource(window.AGENT_SKILLS, {
    id: "skill-budget-anomaly",
    name: "预算异常证据解释",
    versions: [{ version: "1.0", status: "published", purpose: "解释预算固定视图和Rule命中。", prerequisites: "C018-S002-v1与T019-S002-v1。", inputContract: "预算异常固定证据", outputContract: "AI Insight v1", evidenceRule: "逐项引用C018、Metric或Rule。", toolIds: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator"], compatibleTypes: ["洞察 Agent"], dependencies: "S002 Published预算语义", failureLimits: "证据缺失时阻断，不补猜。", validatedAt: "2026-08-15 08:00", change: "初始发布" }]
  });
  addCatalogResource(window.AGENT_SKILLS, {
    id: "skill-budget-report",
    name: "预算报告证据组织",
    versions: [{ version: "1.0", status: "published", purpose: "把预算固定结果组织成专题报告源草稿。", prerequisites: "C018固定视图和异常分析结果。", inputContract: "预算专题证据包", outputContract: "Agent Report Draft v1", evidenceRule: "每个内容项引用固定证据。", toolIds: ["tool-evidence-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"], compatibleTypes: ["报告草稿 Agent"], dependencies: "S002预算报告定义", failureLimits: "不发布报告，不触发决策。", validatedAt: "2026-08-15 08:00", change: "初始发布" }]
  });

  const scenarioBinding = (scenarioId, label, version) => ({
    id: `AG-SB-${scenarioId}`,
    version,
    mode: scenarioId === "S002" ? "fixed-scenario" : "request-context",
    scenarioId,
    scenarioLabel: label,
    objectScope: scenarioId === "S002" ? "预算执行、项目余额与采购占用" : null,
    status: "ready"
  });

  const agents = [
    {
      id: "budget-anomaly-analyst",
      name: "预算异常分析 Agent",
      shortName: "预算异常分析",
      type: "洞察 Agent",
      purpose: "聚合预算固定问数结果和Published Rule命中，输出异常事实、口径和证据定位。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "S002 · 预算监督管理",
      releases: [{ version: "1.0", releasedAt: "2026-08-15 08:00", validationAt: "2026-08-15 08:00", inputContract: "Budget Evidence Package v1", outputContract: "AI Insight v1", prompt: { id: "prompt-budget-anomaly", version: "1.0" }, skills: [{ id: "skill-budget-anomaly", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator"], ontology: "预算管理本体 · Published S002-ONTO-v1", ontologyScope: "预算对象、9项Metric和5项Rule", scenarioBinding: scenarioBinding("S002", "预算监督管理", "1.0"), change: "S002预算异常分析初始发布" }]
    },
    {
      id: "budget-report-drafter",
      name: "预算报告草稿 Agent",
      shortName: "预算报告草稿",
      type: "报告草稿 Agent",
      purpose: "只读消费预算固定视图和异常分析结果，形成专题报告结构化源草稿。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "S002 · 预算监督管理",
      releases: [{ version: "1.0", releasedAt: "2026-08-15 08:00", validationAt: "2026-08-15 08:00", inputContract: "Budget Report Evidence v1", outputContract: "Agent Report Draft v1", prompt: { id: "prompt-budget-report", version: "1.0" }, skills: [{ id: "skill-budget-report", version: "1.0" }], tools: ["tool-evidence-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"], ontology: "预算管理本体 · Published S002-ONTO-v1", ontologyScope: "预算固定视图、专题指标和异常证据", scenarioBinding: scenarioBinding("S002", "预算监督管理", "1.0"), change: "S002预算报告草稿初始发布" }]
    },
    {
      id: "report-copilot-s003-profile",
      name: "债务风险报告伴读配置",
      shortName: "债务风险伴读",
      type: "报告伴读 Agent",
      purpose: "复用通用报告伴读能力，解释S003正式企业债务风险报告、Published评分事实和确定性核验摘要。",
      status: "enabled",
      activeRelease: "1.5",
      scenario: "S003 · 债务风险监测",
      releases: []
    },
    {
      id: "preflight-report-draft",
      name: "贷前调查报告生成 Agent",
      shortName: "贷前报告生成",
      type: "报告草稿 Agent",
      purpose: "依据报告中心固定的贷前调查证据包，生成结构化源草稿；授信结论和风险可控性保留人工确认。",
      status: "enabled",
      activeRelease: "2.0.0",
      scenario: "S004 · 财务公司贷款贷前调查",
      releases: []
    },
    {
      id: "preflight-report-copilot",
      name: "贷前调查报告伴读 Agent",
      shortName: "贷前报告伴读",
      type: "报告伴读 Agent",
      purpose: "只解释已发布的贷前调查报告和固定证据，不重算正式指标、不形成授信决定。",
      status: "enabled",
      activeRelease: "2.0.0",
      scenario: "S004 · 财务公司贷款贷前调查",
      releases: []
    }
  ];

  const s003Release = {
    version: "1.5",
    releasedAt: "2026-08-17 19:41",
    validationAt: "2026-08-17 19:41",
    inputContract: "Report Context Binding v1",
    outputContract: "Report Copilot Answer v1",
    prompt: { id: "prompt-report-reading-s003", version: "1.4" },
    skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-semantic-rule-explain", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }],
    tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"],
    ontology: "债务风险评估模型 · Published 1.0.2",
    ontologyScope: "正式企业债务风险报告、Published风险事实和13项确定性核验摘要",
    scenarioBinding: scenarioBinding("S003", "债务风险报告伴读", "1.5"),
    change: "增加S003债务风险正式报告伴读配置；不预造Evidence、Session、Run或Result"
  };
  const s004CopilotRelease = {
    version: "2.0.0",
    releasedAt: "2026-08-15 23:30",
    validationAt: "2026-08-16 09:30",
    inputContract: "Report Reading Request v1",
    outputContract: "Report Copilot Result v1",
    prompt: { id: "prompt-report-reading", version: "1.0" },
    skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-semantic-rule-explain", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }],
    tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"],
    ontology: "贷前调查本体 · Published V1",
    ontologyScope: "S004已发布贷前调查报告与固定证据范围",
    scenarioBinding: scenarioBinding("S004", "财务公司贷款贷前调查报告伴读", "2.0.0"),
    change: "接入S004贷前调查报告伴读"
  };
  const s004DraftRelease = {
    version: "2.0.0",
    releasedAt: "2026-08-15 23:30",
    validationAt: "2026-08-16 09:30",
    inputContract: "Generation Evidence Package v1",
    outputContract: "Agent Report Draft v1",
    prompt: { id: "prompt-report-draft", version: "1.0" },
    skills: [{ id: "skill-report-organization", version: "1.0" }],
    tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"],
    ontology: "贷前调查本体 · Published V1",
    ontologyScope: "贷前调查报告定义、模板槽位和固定事实项",
    scenarioBinding: scenarioBinding("S004", "财务公司贷款贷前调查报告生成", "2.0.0"),
    change: "接入S004贷前调查报告结构化草稿生成"
  };

  agents.find((item) => item.id === "report-copilot-s003-profile").releases = [clone(s003Release)];
  agents.find((item) => item.id === "preflight-report-draft").releases = [clone(s004DraftRelease)];
  agents.find((item) => item.id === "preflight-report-copilot").releases = [clone(s004CopilotRelease)];

  function mergeAgents(baseAgents) {
    const result = clone(baseAgents || []);
    const baselineIds = new Set(["financing-insight", "report-copilot", "report-verification-agent", "report-draft"]);
    initial.agents.filter((item) => baselineIds.has(item.id)).forEach((baseline) => {
      const index = result.findIndex((item) => item.id === baseline.id);
      if (index >= 0) result[index] = clone(baseline);
      else result.push(clone(baseline));
    });
    agents.forEach((agent) => {
      const index = result.findIndex((item) => item.id === agent.id);
      if (index >= 0) result[index] = clone(agent);
      else result.push(clone(agent));
    });
    return result;
  }

  const credibility = (scenarioId) => ({
    contract: "C017 Agent安全投影",
    contextStatus: "normal",
    lastReadAt: formedAt,
    versionBindingSummary: { id: `C017-${scenarioId}-BINDING`, version: "1.0", status: "ready", label: "精确绑定已固定", formedAt, observedAt: formedAt },
    currentStateSummary: { id: `C017-${scenarioId}-CURRENT`, version: "1.0", status: "ready", label: "历史固定输入", formedAt, observedAt: formedAt },
    historyDimensions: [
      { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "运行绑定精确场景、语义和数据版本。", checkedAt: formedAt },
      { id: "content-access", name: "内容访问", status: "available", label: "固定证据可访问", reason: "只读访问运行固定证据。", checkedAt: formedAt },
      { id: "evidence-completeness", name: "证据完整", status: "complete", label: "完整", reason: "结果引用可定位。", checkedAt: formedAt },
      { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "历史只读", reason: "组合目录不重放历史副作用。", checkedAt: formedAt },
      { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "保留原运行结果。", checkedAt: formedAt }
    ],
    useFlags: { isCurrentAuthoritative: false, canStartNewRun: false, canConfirmNewResult: false, canPrepareActionRequest: false, historyDisclosureRequired: true }
  });

  const historicalEvidence = [
    {
      id: "EVID-S001-FINANCE-PORTFOLIO-v2",
      evidencePackageId: "EVID-S001-FINANCE-20251231-v2",
      evidencePackageVersion: "2.0.0",
      name: "集团融资经营分析固定证据",
      kind: "finance",
      portfolioRecord: true,
      currentProjection: false,
      projectionStatus: "history",
      status: "ready",
      statusLabel: "已完成运行的固定证据",
      dataVersion: "FIN-ASSET-20251231-v02",
      dataAssetVersionId: "FIN-ASSET-20251231-v02",
      dataAsOf: "2025-12-31",
      semanticVersionId: "T019-S001-v1",
      semanticVersion: "semantic-MSVJM48O-VJC6 / V1",
      ontologyVersion: "企业融资语义 · 已发布 V1",
      quality: "质量检查通过",
      freshness: "运行时固定",
      authority: "已发布本体与权威数据组合",
      formedAt: "2026-08-16 09:26",
      scenarioContext: contextFor("S001"),
      credibility: credibility("S001"),
      items: [
        { id: "S001-EV-COST", type: "Metric", name: "集团余额加权融资成本", value: "2.372231%", object: "集团合并范围", source: "MET-WAVG-FINANCING-COST" },
        { id: "S001-EV-BALANCE", type: "Metric", name: "集团融资余额", value: "21,613.387 亿元", object: "集团合并范围", source: "MET-FINANCING-BALANCE" },
        { id: "S001-EV-RULE", type: "Rule", name: "融资成本偏高", value: "单位553命中", object: "单位553", source: "RULE-HIGH-FINANCING-COST" },
        { id: "S001-EV-BANK", type: "业务归因", name: "优先协商机构", value: "欧陆银行、寰宇银行、海联银行", object: "单位553融资明细", source: "固定机构贡献结果" },
        { id: "S001-EV-REPORT", type: "报告", name: "集团融资经营分析报告", value: "RPT-20260816-092626-010 / 2.0.0", object: "集团融资经营分析", source: "报告中心正式报告" }
      ]
    },
    {
      id: "EVID-S002-BUDGET-PORTFOLIO-v1",
      evidencePackageId: "C018-S002-v1",
      evidencePackageVersion: "1.0.0",
      name: "S002预算固定问数与异常证据",
      kind: "budget",
      portfolioRecord: true,
      currentProjection: false,
      projectionStatus: "history",
      status: "ready",
      statusLabel: "历史固定证据",
      dataVersion: "S002-DATA-v1",
      dataAssetVersionId: "S002-BUDGET-EXEC-v1",
      dataAsOf: "2025-12-31",
      semanticVersionId: "T019-S002-v1",
      semanticVersion: "S002-ONTO-v1",
      ontologyVersion: "预算管理本体 · Published S002-ONTO-v1",
      quality: "426项适用检查完成",
      freshness: "历史固定",
      authority: "S002同轮C018和T019只读引用",
      formedAt: "2026-08-15 08:00",
      scenarioContext: contextFor("S002"),
      credibility: credibility("S002"),
      items: [
        { id: "S002-EV-EXEC", type: "Metric", name: "费用预算执行率", value: "安全运行部98.86%", object: "2025年部门预算", source: "C018-S002-v1" },
        { id: "S002-EV-BALANCE", type: "Rule", name: "项目预算覆盖风险", value: "-20.5038万元", object: "概率安全分析项目", source: "RULE-001 / MET-006" },
        { id: "S002-EV-OCC", type: "Metric", name: "年末采购预算占用集中度", value: "14.3530%", object: "2025年项目预算占用", source: "C018-S002-v1" }
      ]
    },
    {
      id: "EVID-S003-RISK-REPORT-v1",
      evidencePackageId: "企业风险证据包 · S003-ENT-020",
      evidencePackageVersion: "1.0.0",
      name: "企业债务风险报告固定证据",
      kind: "report",
      portfolioRecord: true,
      currentProjection: false,
      projectionStatus: "history",
      status: "ready",
      statusLabel: "已完成运行的固定证据",
      dataVersion: "S003-T007-DEBT-RISK-20251231-v1",
      dataAssetVersionId: "S003-T007-DEBT-RISK-20251231-v1",
      dataAsOf: "2025-12-31",
      semanticVersionId: "T019-S003-v1",
      semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.2",
      ontologyVersion: "企业债务风险本体 · 已发布 1.0.2",
      quality: "13项报告核验通过",
      freshness: "运行时固定",
      authority: "正式风险结果与报告固定证据",
      formedAt: "2026-08-17 19:41",
      scenarioContext: contextFor("S003"),
      report: { number: "RISK-020-2025", name: "环保测试公司4债务风险评估报告", contentVersion: "1.7.0", anchor: "风险诊断", verification: "13 / 13 通过" },
      credibility: credibility("S003"),
      items: [
        { id: "S003-EV-SCORE", type: "Metric", name: "最终风险评分", value: "23.05分", object: "环保测试公司4", source: "S003-MET-FINAL-RISK-SCORE" },
        { id: "S003-EV-TIER", type: "Rule", name: "风险亮灯分档", value: "红灯", object: "环保测试公司4", source: "S003-RULE-RISK-TIER" },
        { id: "S003-EV-FACTOR", type: "固定事实", name: "调节因子合计", value: "-0.45", object: "环保测试公司4", source: "正式风险评估结果" },
        { id: "S003-EV-REPORT", type: "报告", name: "企业债务风险评估报告", value: "RISK-020-2025 / 1.7.0", object: "环保测试公司4", source: "报告中心正式报告" }
      ]
    },
    {
      id: "EVID-S004-20260815-0002@generation",
      evidencePackageId: "EVID-S004-20260815-0002",
      evidencePackageVersion: "2.0.0",
      name: "S004贷前调查固定证据包",
      kind: "report-generation",
      portfolioRecord: true,
      currentProjection: false,
      projectionStatus: "history",
      status: "ready",
      statusLabel: "历史固定证据",
      dataVersion: "DATA-ASSET-S004-20260815-V01",
      dataAssetVersionId: "DATA-ASSET-S004-20260815-V01",
      dataAsOf: "2026-08-15",
      semanticVersionId: "SEM-S004-PREFLIGHT-V1",
      semanticVersion: "V1",
      ontologyVersion: "贷前调查本体 · Published V1",
      quality: "18项确定性核验通过",
      freshness: "历史固定",
      authority: "Published本体与C008权威事实包",
      formedAt: "2026-08-15 23:30",
      scenarioContext: contextFor("S004"),
      credibility: credibility("S004"),
      items: [
        { id: "S004-EV-DEBT", type: "Metric", name: "资产负债率", value: "65.15%", object: "借款人", source: "MET-DEBT-ASSET-RATIO" },
        { id: "S004-EV-CURRENT", type: "Metric", name: "流动比率", value: "0.66", object: "借款人", source: "MET-CURRENT-RATIO" },
        { id: "S004-EV-REPORT", type: "报告", name: "贷前调查报告", value: "S004-PLR-2026-0001", object: "贷款申请", source: "RPT-S004-20260815-0001" }
      ]
    }
  ];

  const completeSteps = (names) => names.map((name, index) => ({ id: `step-${index + 1}`, name, status: "complete", detail: "已按原运行固定证据完成" }));
  const runSnapshot = (options) => ({
    agentId: options.agentId,
    agentName: options.agentName,
    agentRelease: options.release,
    scenarioBinding: scenarioBinding(options.scenarioId, options.scenarioLabel, options.release),
    scenarioId: options.scenarioId,
    scenarioVersion: contextFor(options.scenarioId).scenarioVersion,
    scenarioRunId: contextFor(options.scenarioId).scenarioRunId,
    scenario: `${options.scenarioId} · ${options.scenarioLabel}`,
    requestContext: options.requestContext || (options.scenarioId === "S004" ? {
      id: options.agentId === "preflight-report-copilot" ? "C024-S004-20260815-0001" : "C022-S004-20260815-0001",
      version: "1.0",
      sourceOwner: "报告中心",
      requestedAt: options.agentId === "preflight-report-copilot" ? "2026-08-15 23:30" : "2026-08-15 14:56"
    } : {
      id: "C018-S002-v1",
      version: "1.0.0",
      sourceOwner: "智能问数",
      requestedAt: "2026-08-15 08:00"
    }),
    objectScope: options.objectScope,
    inputContract: options.inputContract,
    outputContract: options.outputContract,
    expectedOutput: options.outputContract,
    evidenceId: options.evidenceId,
    evidencePackageId: options.evidencePackageId,
    evidencePackageVersion: options.evidencePackageVersion || "1.0.0",
    evidenceName: options.evidenceName,
    semanticVersionId: options.semanticVersionId,
    semanticVersion: options.semanticVersion,
    dataAssetVersionId: options.dataVersion,
    dataVersion: options.dataVersion,
    consumableVersionId: options.dataVersion,
    dataAsOf: options.dataAsOf,
    ontologyVersion: options.ontology,
    ontology: options.ontology,
    quality: options.quality,
    freshness: "历史固定",
    credibility: credibility(options.scenarioId),
    evidenceStatus: "ready",
    prompt: options.prompt,
    promptBinding: { ...options.prompt, name: options.promptName },
    skills: options.skills,
    skillBindings: options.skills.map((item) => ({ ...item, name: item.id })),
    tools: options.tools,
    toolBindings: options.tools.map((id) => ({ id, version: "1.0", name: id, owner: "Agent 应用" }))
  });

  function historicalRun(options) {
    return {
      id: options.id,
      status: "complete",
      createdAt: options.createdAt,
      finishedAt: options.finishedAt || options.createdAt,
      source: options.source || "场景运行归档",
      portfolioRecord: true,
      currentProjection: false,
      projectionStatus: "history",
      attempt: 1,
      scenarioContext: contextFor(options.scenarioId),
      question: options.question,
      steps: completeSteps(options.steps || ["固定输入校验", "受控工具调用", "结构化生成", "输出合同校验"]),
      sessionId: options.sessionId || null,
      bindingId: options.bindingId || null,
      toolCalls: (options.snapshot.tools || []).map((toolId, index) => ({
        id: `${options.id}-TOOL-${index + 1}`,
        toolId,
        toolName: ({
          "tool-evidence-reader": "固定证据读取器",
          "tool-ontology-reader": "已发布语义读取器",
          "tool-verification-reader": "核验结果读取器",
          "tool-citation-validator": "证据引用校验器",
          "tool-output-validator": "输出结构校验器",
          "tool-report-draft-handoff": "报告草稿移交器",
          "tool-report-result-return": "伴读结果回传器",
          "tool-action-discovery": "行动类型发现器",
          "tool-action-submit": "行动申请提交器"
        }[toolId] || toolId),
        toolVersion: "1.0",
        toolOwner: ["tool-ontology-reader", "tool-action-discovery"].includes(toolId) ? "本体管理" : ["tool-verification-reader", "tool-report-draft-handoff", "tool-report-result-return"].includes(toolId) ? "报告中心与Agent应用" : "Agent应用",
        status: "complete",
        duration: `${180 + index * 47} ms`,
        input: index === 0 ? "运行固定输入摘要" : "前一步已验证的结构化结果",
        output: index === (options.snapshot.tools || []).length - 1 ? "结果结构与引用已核对" : "获准结构化摘要"
      })),
      snapshot: runSnapshot(options.snapshot),
      result: {
        id: options.resultId,
        type: options.resultType,
        contract: options.resultContract,
        title: options.title,
        summary: options.summary,
        sections: options.sections,
        limitations: options.limitations,
        confidence: "固定证据引用完整",
        generatedAt: options.finishedAt || options.createdAt,
        owner: "Agent 应用（M05）",
        destination: options.destination,
        returnReceipt: options.returnReceipt || null,
        freshness: "历史固定",
        confirmation: options.confirmation || "unconfirmed",
        scenarioContext: contextFor(options.scenarioId),
        reportNumber: options.reportNumber,
        contentVersion: options.contentVersion,
        evidencePackageId: options.snapshot.evidencePackageId,
        evidencePackageVersion: options.snapshot.evidencePackageVersion,
        semanticVersionId: options.snapshot.semanticVersionId,
        semanticVersion: options.snapshot.semanticVersion,
        dataAssetVersionId: options.snapshot.dataVersion,
        dataVersion: options.snapshot.dataVersion,
        dataAsOf: options.snapshot.dataAsOf
      },
      error: null,
      recovery: null,
      sourceRef: sourceRefs[options.scenarioId]
    };
  }

  const historicalRuns = [
    historicalRun({
      id: "AG-RUN-S001-FINANCE-INSIGHT-001", scenarioId: "S001", createdAt: "2026-08-16 09:18", finishedAt: "2026-08-16 09:19", agentId: "financing-insight", resultId: "RES-S001-FINANCE-INSIGHT-001", resultType: "AI Insight", resultContract: "AI Insight v1", title: "融资成本与机构协商建议", summary: "单位553融资成本偏高，优先协商机构为欧陆银行、寰宇银行和海联银行；洞察已形成行动申请并由决策中心接收。", question: "解释单位553融资成本偏高的原因，并给出优先协商机构。", sections: [{ title: "融资成本", body: "单位553平均融资成本2.880984%，高于集团平均水平。", refs: ["S001-EV-COST", "S001-EV-RULE"] }, { title: "协商机构", body: "按余额和成本贡献，优先与欧陆银行、寰宇银行和海联银行协商。", refs: ["S001-EV-BANK"] }], limitations: "洞察只解释固定融资事实；人工确认与负责人待办由决策中心维护。", destination: "决策中心行动申请", returnReceipt: "AR-S001-FIN-553 已接收", confirmation: "confirmed", snapshot: { agentId: "financing-insight", agentName: "融资洞察与行动协作 Agent", release: "1.2", scenarioId: "S001", scenarioLabel: "集团融资成本与债务结构优化", objectScope: "单位553", inputContract: "融资经营分析固定证据", outputContract: "AI Insight v1", evidenceId: "EVID-S001-FINANCE-PORTFOLIO-v2", evidencePackageId: "EVID-S001-FINANCE-20251231-v2", evidenceName: "集团融资经营分析固定证据", semanticVersionId: "T019-S001-v1", semanticVersion: "semantic-MSVJM48O-VJC6 / V1", dataVersion: "FIN-ASSET-20251231-v02", dataAsOf: "2025-12-31", ontology: "企业融资语义 · 已发布 V1", quality: "质量检查通过", prompt: { id: "prompt-finance-evidence", version: "1.2" }, promptName: "融资证据解释", skills: [{ id: "skill-finance-explain", version: "1.1" }, { id: "skill-action-collaboration", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-action-discovery", "tool-action-submit"] } }),
    historicalRun({
      id: "AG-RUN-S001-REPORT-DRAFT-001", scenarioId: "S001", createdAt: "2026-08-16 09:22", finishedAt: "2026-08-16 09:24", agentId: "report-draft", resultId: "RES-S001-REPORT-DRAFT-001", resultType: "Agent Report Draft", resultContract: "Agent Report Draft v1", title: "集团融资经营分析报告源草稿", summary: "融资规模、成本、债务结构、机构贡献和优化建议均已绑定固定证据。", question: "生成集团融资经营分析报告源草稿。", sections: [{ title: "经营概览", body: "集团融资余额21,613.387亿元，余额加权融资成本2.372231%。", refs: ["S001-EV-BALANCE", "S001-EV-COST"] }, { title: "优化建议", body: "单位553进入融资成本优化关注范围。", refs: ["S001-EV-RULE", "S001-EV-BANK"] }], limitations: "源草稿由报告中心复核后形成正式报告。", destination: "报告中心复核副本", returnReceipt: "报告中心已接收源草稿", snapshot: { agentId: "report-draft", agentName: "融资经营分析报告生成 Agent", release: "1.0", scenarioId: "S001", scenarioLabel: "集团融资成本与债务结构优化", objectScope: "集团融资经营分析", inputContract: "报告生成固定输入", outputContract: "Agent Report Draft v1", evidenceId: "EVID-S001-FINANCE-PORTFOLIO-v2", evidencePackageId: "EVID-S001-FINANCE-20251231-v2", evidenceName: "集团融资经营分析固定证据", semanticVersionId: "T019-S001-v1", semanticVersion: "semantic-MSVJM48O-VJC6 / V1", dataVersion: "FIN-ASSET-20251231-v02", dataAsOf: "2025-12-31", ontology: "企业融资语义 · 已发布 V1", quality: "质量检查通过", prompt: { id: "prompt-report-draft", version: "1.0" }, promptName: "报告内容组织", skills: [{ id: "skill-report-organization", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"] } }),
    historicalRun({
      id: "AG-RUN-S001-REPORT-COPILOT-001", scenarioId: "S001", createdAt: "2026-08-16 09:27", finishedAt: "2026-08-16 09:28", agentId: "report-copilot", sessionId: "AG-SESSION-S001-REPORT-001", bindingId: "AG-BIND-S001-REPORT-001", resultId: "RES-S001-REPORT-COPILOT-001", resultType: "Report Copilot Result", resultContract: "Report Copilot Result v1", title: "集团融资报告伴读结果", summary: "解释单位553融资成本偏高及优先协商银行，全部回答回指正式报告和固定证据。", question: "为什么单位553需要优先与欧陆银行、寰宇银行和海联银行协商？", sections: [{ title: "原因", body: "单位553融资成本2.880984%，高于集团平均水平。", refs: ["S001-EV-COST", "S001-EV-RULE"] }, { title: "机构归因", body: "欧陆银行、寰宇银行和海联银行是本轮成本贡献靠前机构。", refs: ["S001-EV-BANK", "S001-EV-REPORT"] }], limitations: "只解释报告固定内容，不重算当前数据。", destination: "报告中心伴读界面", returnReceipt: "伴读结果已回传报告中心", reportNumber: "RPT-20260816-092626-010", contentVersion: "2.0", confirmation: "not-required", snapshot: { agentId: "report-copilot", agentName: "报告伴读与数据核验助手", release: "1.0", scenarioId: "S001", scenarioLabel: "集团融资成本与债务结构优化", objectScope: "正式融资报告", inputContract: "报告固定上下文", outputContract: "Report Copilot Result v1", evidenceId: "EVID-S001-FINANCE-PORTFOLIO-v2", evidencePackageId: "EVID-S001-FINANCE-20251231-v2", evidenceName: "集团融资经营分析固定证据", semanticVersionId: "T019-S001-v1", semanticVersion: "semantic-MSVJM48O-VJC6 / V1", dataVersion: "FIN-ASSET-20251231-v02", dataAsOf: "2025-12-31", ontology: "企业融资语义 · 已发布 V1", quality: "质量检查通过", prompt: { id: "prompt-report-reading", version: "1.0" }, promptName: "报告固定上下文伴读", skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }], tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"] } }),
    historicalRun({
      id: "AG-RUN-S002-1786780800000-ANOMALY", scenarioId: "S002", createdAt: "2026-08-15 08:00", agentId: "budget-anomaly-analyst", resultId: "RES-S002-ANOMALY-001", resultType: "AI Insight", resultContract: "AI Insight v1", title: "预算异常分析结果", summary: "聚合6条Published Rule命中，输出异常事实、口径和证据定位；未生成Action候选。", question: "解释本轮预算异常及其证据。", sections: [{ title: "预算执行", body: "安全运行部2025费用预算执行率98.86%，接近上限。", refs: ["S002-EV-EXEC"] }, { title: "项目余额", body: "概率安全分析项目可用立项余额-20.5038万元。", refs: ["S002-EV-BALANCE"] }], limitations: "只解释固定结果，不创建行动申请。", destination: "预算报告草稿输入", snapshot: { agentId: "budget-anomaly-analyst", agentName: "预算异常分析 Agent", release: "1.0", scenarioId: "S002", scenarioLabel: "预算监督管理", objectScope: "预算执行、项目余额与采购占用", inputContract: "Budget Evidence Package v1", outputContract: "AI Insight v1", evidenceId: "EVID-S002-BUDGET-PORTFOLIO-v1", evidencePackageId: "C018-S002-v1", evidenceName: "S002预算固定问数与异常证据", semanticVersionId: "T019-S002-v1", semanticVersion: "S002-ONTO-v1", dataVersion: "S002-DATA-v1", dataAsOf: "2025-12-31", ontology: "预算管理本体 · Published S002-ONTO-v1", quality: "426项适用检查完成", prompt: { id: "prompt-budget-anomaly", version: "1.0" }, promptName: "预算异常证据解释边界", skills: [{ id: "skill-budget-anomaly", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator"] } }),
    historicalRun({
      id: "AG-RUN-S002-1786780800000-REPORT", scenarioId: "S002", createdAt: "2026-08-15 08:00", agentId: "budget-report-drafter", resultId: "RES-S002-REPORT-001", resultType: "Agent Report Draft", resultContract: "Agent Report Draft v1", title: "预算监督专题报告草稿", summary: "按预算执行、项目余额、采购占用、差旅与跨年趋势形成结构化源草稿。", question: "基于固定预算证据生成专题报告草稿。", sections: [{ title: "预算执行", body: "三部门执行率与差异额已按最终批准预算口径组织。", refs: ["S002-EV-EXEC"] }, { title: "项目与采购", body: "项目余额不足和年末占用集中度已绑定固定证据。", refs: ["S002-EV-BALANCE", "S002-EV-OCC"] }], limitations: "草稿不是正式报告，不触发决策中心。", destination: "报告中心预算报告复核副本", snapshot: { agentId: "budget-report-drafter", agentName: "预算报告草稿 Agent", release: "1.0", scenarioId: "S002", scenarioLabel: "预算监督管理", objectScope: "六专题预算报告", inputContract: "Budget Report Evidence v1", outputContract: "Agent Report Draft v1", evidenceId: "EVID-S002-BUDGET-PORTFOLIO-v1", evidencePackageId: "C018-S002-v1", evidenceName: "S002预算固定问数与异常证据", semanticVersionId: "T019-S002-v1", semanticVersion: "S002-ONTO-v1", dataVersion: "S002-DATA-v1", dataAsOf: "2025-12-31", ontology: "预算管理本体 · Published S002-ONTO-v1", quality: "426项适用检查完成", prompt: { id: "prompt-budget-report", version: "1.0" }, promptName: "预算专题报告草稿组织边界", skills: [{ id: "skill-budget-report", version: "1.0" }], tools: ["tool-evidence-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"] } }),
    historicalRun({
      id: "AG-RUN-S003-REPORT-COPILOT-001", scenarioId: "S003", createdAt: "2026-08-17 19:41", finishedAt: "2026-08-17 19:42", agentId: "report-copilot-s003-profile", sessionId: "AG-SESSION-S003-REPORT-001", bindingId: "AG-BIND-S003-REPORT-001", resultId: "RES-S003-REPORT-COPILOT-001", resultType: "Report Copilot Result", resultContract: "Report Copilot Result v1", title: "债务风险报告伴读结果", summary: "环保测试公司4最终评分23.05分、风险等级红灯；回答解释评分、调节因子和行动边界，不重新计算风险结果。", question: "这家企业为什么是红灯，主要风险来自哪里？", sections: [{ title: "风险等级", body: "最终评分23.05分，依据已发布风险分档进入红灯。", refs: ["S003-EV-SCORE", "S003-EV-TIER"] }, { title: "影响因素", body: "调节因子合计-0.45，对原始评分形成下调。", refs: ["S003-EV-FACTOR", "S003-EV-REPORT"] }], limitations: "不重算评分、不修改因子、不创建行动申请。", destination: "报告中心债务风险报告伴读", returnReceipt: "伴读结果已回传报告中心", reportNumber: "S003-RPT-ENT-020", contentVersion: "1.4.0", confirmation: "not-required", snapshot: { agentId: "report-copilot-s003-profile", agentName: "债务风险报告伴读配置", release: "1.5", scenarioId: "S003", scenarioLabel: "债务风险监测", objectScope: "环保测试公司4正式风险报告", inputContract: "报告固定上下文", outputContract: "Report Copilot Result v1", evidenceId: "EVID-S003-RISK-REPORT-v1", evidencePackageId: "EVID-S003-RISK-20251231-v1", evidenceName: "企业债务风险报告固定证据", semanticVersionId: "T019-S003-v1", semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.2", dataVersion: "S003-T007-DEBT-RISK-20251231-v1", dataAsOf: "2025-12-31", ontology: "企业债务风险本体 · 已发布 1.0.2", quality: "13项报告核验通过", prompt: { id: "prompt-report-reading-s003", version: "1.4" }, promptName: "债务风险报告伴读", skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }], tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"] } }),
    historicalRun({
      id: "ARUN-S004-20260815-0002", scenarioId: "S004", createdAt: "2026-08-15 14:56", finishedAt: "2026-08-15 14:58", resultId: "RES-S004-20260815-002", resultType: "Agent Report Draft", resultContract: "ofw.s004.agent-draft.v2", title: "S004贷前调查报告结构化草稿", summary: "覆盖借款人评价、经营、财务和风险分析；风险与授信结论保留人工确认。", question: "按固定报告定义、模板槽位和证据包生成贷前调查报告草稿。", sections: [{ title: "借款人经营与财务", body: "已绑定借款人身份、经营事实、资产负债率和流动比率。", refs: ["S004-EV-DEBT", "S004-EV-CURRENT"] }, { title: "风险与授信边界", body: "Agent只形成建议草稿，正式授信决定、额度、期限、利率和条件必须人工确认。", refs: ["S004-EV-REPORT"] }], limitations: "草稿不是正式报告；不含Agent作出的正式授信决定。", destination: "报告中心人工复核副本", reportNumber: "S004-PLR-2026-0001", contentVersion: "2.0.0", snapshot: { agentId: "preflight-report-draft", agentName: "贷前调查报告生成 Agent", release: "2.0.0", scenarioId: "S004", scenarioLabel: "财务公司贷款贷前调查", objectScope: "贷前调查固定证据范围", inputContract: "Generation Evidence Package v1", outputContract: "Agent Report Draft v1", evidenceId: "EVID-S004-20260815-0002@generation", evidencePackageId: "EVID-S004-20260815-0002", evidencePackageVersion: "2.0.0", evidenceName: "S004贷前调查固定证据包", semanticVersionId: "SEM-S004-PREFLIGHT-V1", semanticVersion: "V1", dataVersion: "DATA-ASSET-S004-20260815-V01", dataAsOf: "2026-08-15", ontology: "贷前调查本体 · Published V1", quality: "18项确定性核验通过", prompt: { id: "prompt-report-draft", version: "1.0" }, promptName: "报告草稿生成边界", skills: [{ id: "skill-report-organization", version: "1.0" }], tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"] } }),
    historicalRun({
      id: "ARUN-S004-20260815-0002-COPILOT", scenarioId: "S004", createdAt: "2026-08-15 23:30", sessionId: "AG-SESSION-S004-REPORT-001", bindingId: "AG-BIND-S004-REPORT-001", resultId: "RES-S004-20260815-002-COPILOT", resultType: "Report Copilot Result", resultContract: "Report Copilot Result v1", title: "贷前调查报告伴读结果", summary: "解释财务情况、风险分析的固定证据和人工判断边界。", question: "请解释本报告第三部分财务情况与第四部分风险分析的主要证据、核验状态和人工判断边界。", sections: [{ title: "财务情况", body: "资产负债率65.15%、流动比率0.66均来自报告固定证据包。", refs: ["S004-EV-DEBT", "S004-EV-CURRENT"] }, { title: "人工判断边界", body: "风险分析和授信结论必须人工确认；Agent不生成授信决定。", refs: ["S004-EV-REPORT"] }], limitations: "只解释已发布报告，不重算指标。", destination: "报告中心伴读界面", returnReceipt: "伴读结果已回传报告中心", confirmation: "not-required", reportNumber: "S004-PLR-2026-0001", contentVersion: "2.0.0", snapshot: { agentId: "preflight-report-copilot", agentName: "贷前调查报告伴读 Agent", release: "2.0.0", scenarioId: "S004", scenarioLabel: "财务公司贷款贷前调查", objectScope: "S004已发布贷前调查报告", inputContract: "Report Reading Request v1", outputContract: "Report Copilot Result v1", evidenceId: "EVID-S004-20260815-0002@generation", evidencePackageId: "EVID-S004-20260815-0002", evidencePackageVersion: "2.0.0", evidenceName: "S004贷前调查固定证据包", semanticVersionId: "SEM-S004-PREFLIGHT-V1", semanticVersion: "V1", dataVersion: "DATA-ASSET-S004-20260815-V01", dataAsOf: "2026-08-15", ontology: "贷前调查本体 · Published V1", quality: "18项确定性核验通过", prompt: { id: "prompt-report-reading", version: "1.0" }, promptName: "报告固定上下文伴读边界", skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-semantic-rule-explain", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }], tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"] } })
  ];

  const s003CopilotRun = historicalRuns.find((item) => item.id === "AG-RUN-S003-REPORT-COPILOT-001");
  if (s003CopilotRun) {
    s003CopilotRun.reportNumber = "RISK-020-2025";
    s003CopilotRun.contentVersion = "1.7.0";
    s003CopilotRun.snapshot.evidencePackageId = "企业风险证据包 · S003-ENT-020";
    s003CopilotRun.result.reportNumber = "RISK-020-2025";
    s003CopilotRun.result.contentVersion = "1.7.0";
    s003CopilotRun.result.evidencePackageId = "企业风险证据包 · S003-ENT-020";
  }
  const s001CopilotRun = historicalRuns.find((item) => item.id === "AG-RUN-S001-REPORT-COPILOT-001");
  if (s001CopilotRun) {
    s001CopilotRun.contentVersion = "2.0.0";
    s001CopilotRun.snapshot.agentName = "报告伴读助手";
    s001CopilotRun.result.contentVersion = "2.0.0";
    if (s001CopilotRun.result.snapshot) s001CopilotRun.result.snapshot.agentName = "报告伴读助手";
  }

  const historicalSessions = [
    {
      id: "AG-SESSION-S001-REPORT-001", bindingId: "AG-BIND-S001-REPORT-001", portfolioRecord: true,
      currentProjection: false, projectionStatus: "history", status: "complete",
      scenarioId: "S001", scenarioVersion: contextFor("S001").scenarioVersion, scenarioRunId: contextFor("S001").scenarioRunId,
      reportVersion: "集团融资经营分析报告 · 2.0.0", reportNumber: "RPT-20260816-092626-010", contentVersion: "2.0.0",
      anchor: "融资成本与机构归因", evidencePackageId: "EVID-S001-FINANCE-20251231-v2", evidencePackageVersion: "2.0.0",
      semanticVersionId: "T019-S001-v1", ontologyVersion: "企业融资语义 · 已发布 V1", dataAssetVersionId: "FIN-ASSET-20251231-v02", dataVersion: "FIN-ASSET-20251231-v02",
      latestRunId: "AG-RUN-S001-REPORT-COPILOT-001", latestResultId: "RES-S001-REPORT-COPILOT-001", resultReturnStatus: "已回传报告中心", resultReturnedAt: "2026-08-16 09:28"
    },
    {
      id: "AG-SESSION-S003-REPORT-001", bindingId: "AG-BIND-S003-REPORT-001", portfolioRecord: true,
      currentProjection: false, projectionStatus: "history", status: "complete",
      scenarioId: "S003", scenarioVersion: contextFor("S003").scenarioVersion, scenarioRunId: contextFor("S003").scenarioRunId,
      reportVersion: "环保测试公司4债务风险评估报告 · 1.7.0", reportNumber: "RISK-020-2025", contentVersion: "1.7.0",
      anchor: "风险诊断", evidencePackageId: "企业风险证据包 · S003-ENT-020", evidencePackageVersion: "1.0.0",
      semanticVersionId: "T019-S003-v1", ontologyVersion: "企业债务风险本体 · 已发布 1.0.2", dataAssetVersionId: "S003-T007-DEBT-RISK-20251231-v1", dataVersion: "S003-T007-DEBT-RISK-20251231-v1",
      latestRunId: "AG-RUN-S003-REPORT-COPILOT-001", latestResultId: "RES-S003-REPORT-COPILOT-001", resultReturnStatus: "已回传报告中心", resultReturnedAt: "2026-08-17 19:42"
    },
    {
      id: "AG-SESSION-S004-REPORT-001", bindingId: "AG-BIND-S004-REPORT-001", portfolioRecord: true,
      currentProjection: false, projectionStatus: "history", status: "complete",
      scenarioId: "S004", scenarioVersion: contextFor("S004").scenarioVersion, scenarioRunId: contextFor("S004").scenarioRunId,
      reportVersion: "财务公司贷款贷前调查报告 · 2.0.0", reportNumber: "S004-PLR-2026-0001", contentVersion: "2.0.0",
      anchor: "财务情况与风险分析", evidencePackageId: "EVID-S004-20260815-0002", evidencePackageVersion: "2.0.0",
      semanticVersionId: "SEM-S004-PREFLIGHT-V1", ontologyVersion: "贷前调查本体 · 已发布 V1", dataAssetVersionId: "DATA-ASSET-S004-20260815-V01", dataVersion: "DATA-ASSET-S004-20260815-V01",
      latestRunId: "ARUN-S004-20260815-0002-COPILOT", latestResultId: "RES-S004-20260815-002-COPILOT", resultReturnStatus: "已回传报告中心", resultReturnedAt: "2026-08-15 23:30"
    }
  ];

  const historicalHandoffs = [{
    id: "AH-S001-FIN-553", actionRequestId: "AR-S001-FIN-553", portfolioRecord: true,
    scenarioContext: contextFor("S001"), actionType: "发起融资优化建议", actionTypeId: "ACTION-FINANCING-OPTIMIZATION", actionTypeVersion: "V1",
    target: "单位553", targetId: "UNIT-553", status: "received", submittedAt: "2026-08-16 09:19", receivedAt: "2026-08-16 09:19",
    runId: "AG-RUN-S001-FINANCE-INSIGHT-001", resultId: "RES-S001-FINANCE-INSIGHT-001",
    evidenceRefs: ["S001-EV-COST", "S001-EV-RULE", "S001-EV-BANK"], ontologyVersion: "企业融资语义 · 已发布 V1",
    dataVersion: "FIN-ASSET-20251231-v02", dataAsOf: "2025-12-31", quality: "质量检查通过", freshness: "运行时固定",
    requestRef: { targetId: "AR-S001-FIN-553", stableDetailEntry: "#module/decision" }, reminderRef: { targetId: "REM-S001-FIN-553" }, taskRef: { targetId: "TODO-S001-FIN-553" }, traceRef: { targetId: "TRACE-S001-FIN-553" }
  }];

  function hydrateState(value) {
    const state = clone(value || initial);
    state.agents = mergeAgents(state.agents || []);
    state.evidencePackages = [...(state.evidencePackages || [])];
    historicalEvidence.forEach((evidence) => {
      const index = state.evidencePackages.findIndex((item) => item.id === evidence.id);
      if (index >= 0) state.evidencePackages[index] = clone(evidence);
      else state.evidencePackages.push(clone(evidence));
    });
    state.runs = [...(state.runs || [])];
    historicalRuns.forEach((run) => {
      const index = state.runs.findIndex((item) => item.id === run.id);
      if (index >= 0) state.runs[index] = clone(run);
      else state.runs.push(clone(run));
    });
    const scenarioOrder = { S001: 1, S002: 2, S003: 3, S004: 4 };
    state.runs.sort((left, right) => {
      const leftScenario = left.snapshot?.scenarioId || left.scenarioContext?.scenarioId;
      const rightScenario = right.snapshot?.scenarioId || right.scenarioContext?.scenarioId;
      return (scenarioOrder[leftScenario] || 99) - (scenarioOrder[rightScenario] || 99) || String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });
    state.sessions = [...(state.sessions || [])];
    historicalSessions.forEach((session) => {
      const index = state.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) state.sessions[index] = clone(session);
      else state.sessions.push(clone(session));
    });
    state.sessions.sort((left, right) => (scenarioOrder[left.scenarioId] || 99) - (scenarioOrder[right.scenarioId] || 99));
    state.handoffs = [...(state.handoffs || [])];
    historicalHandoffs.forEach((handoff) => {
      const index = state.handoffs.findIndex((item) => item.id === handoff.id);
      if (index >= 0) state.handoffs[index] = clone(handoff);
      else state.handoffs.push(clone(handoff));
    });
    state.portfolioIntegration = {
      version: "1.1.0",
      domains: ["S001", "S002", "S003", "S004"],
      sourceRefs,
      note: "四个业务场景的Agent配置、历史运行、固定证据、结果和下游回执已按场景身份归档。"
    };
    return window.AGENT_REPORT_RUNTIME?.mergeIntoModel(state) || state;
  }

  window.AGENT_APP_INITIAL_STATE = hydrateState(initial);
  window.AGENT_PORTFOLIO = Object.freeze({
    version: "1.0.0",
    sourceRefs,
    contextFor,
    hydrateState,
    historicalRuns: Object.freeze(historicalRuns.map(Object.freeze)),
    historicalSessions: Object.freeze(historicalSessions.map(Object.freeze))
  });
})();
