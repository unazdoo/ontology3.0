"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");

function loadConfig() {
  let captured = null;
  const window = {
    OFWBaselineModuleAdapter: {
      createAdapter(config) {
        captured = config;
        return {
          config: { foundationBaselineVersion: "1.0.3" },
          context: () => ({ scenarioRunId: "S004-RUN-TEST" })
        };
      },
      install() {}
    }
  };
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "scenario-config.js"), "utf8"))(window);
  return captured;
}

test("S004 报告名称包含借款人、报告年度和出具日期", () => {
  const config = loadConfig();
  assert.equal(
    config.report.title,
    "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）"
  );
  assert.equal(config.report.borrowerName, "中国广核电力股份有限公司");
  assert.equal(config.report.reportingYear, 2025);
  assert.equal(config.report.issueDate, "2026-08-15");
  assert.equal(config.report.namingPolicyId, config.runtimeConfig.reportNamingPolicy.policyId);
  assert.match(config.runtimeConfig.reportNamingPolicy.pattern, /borrowerLegalName/);
  assert.match(config.runtimeConfig.reportNamingPolicy.pattern, /reportingYear/);
  assert.match(config.runtimeConfig.reportNamingPolicy.pattern, /issueDateZh/);
});

test("S004 运行配置将场景与六模块演示时钟硬锁到 2026-08-16", () => {
  const config = loadConfig();
  const clock = config.runtimeConfig.demoClock;
  assert.equal(config.runtimeConfig.configVersion, "S004-RUNTIME-CONFIG-2.1.4");
  assert.equal(clock.enabled, true);
  assert.equal(clock.scenarioId, "S004");
  assert.equal(clock.mode, "FIXED");
  assert.equal(clock.date, "2026-08-16");
  assert.equal(clock.now, "2026-08-16T08:00:00.000Z");
  assert.deepEqual(clock.appliesTo, ["scenario-context", "directional-reset", "M01", "M02", "M03", "M04", "M05", "M06"]);
  assert.match(clock.rule, /S001 .*v1\.0\.3.*默认时钟不变/);
});

test("正式 HTML 和 PDF 绑定到存在的不可变历史制品", () => {
  const config = loadConfig();
  const binding = config.runtimeConfig.formalOutputBinding;
  const outputs = [binding.controlledHtml, binding.sameSourcePdf];
  assert.deepEqual(outputs.map((item) => item.format), ["CONTROLLED_HTML", "SAME_SOURCE_PDF"]);
  assert.equal(binding.controlledHtml.viewMode, "new-tab");
  assert.equal(binding.sameSourcePdf.viewMode, "in-page-rendered-preview");
  outputs.forEach((item) => {
    assert.equal(item.downloadable, true);
    const filePath = path.resolve(RUNTIME_DIR, binding.baseRef, item.file);
    assert.equal(fs.existsSync(filePath), true, `正式产物不存在：${filePath}`);
    assert.ok(fs.statSync(filePath).size > 0, `正式产物为空：${filePath}`);
  });
  assert.equal(config.report.outputs.html, `${binding.baseRef}${binding.controlledHtml.file}`);
  assert.equal(config.report.outputs.pdf, `${binding.baseRef}${binding.sameSourcePdf.file}`);
  assert.equal(binding.sameSourcePdf.preview.mode, "RASTERIZED_IMMUTABLE_PDF_PAGES");
  assert.equal(binding.sameSourcePdf.preview.pageCount, 11);
  assert.equal(binding.sameSourcePdf.preview.authoritative, false);
  for (let page = 1; page <= binding.sameSourcePdf.preview.pageCount; page += 1) {
    const file = `${binding.sameSourcePdf.preview.fileStem}${String(page).padStart(2, "0")}.png`;
    const previewPath = path.resolve(RUNTIME_DIR, binding.sameSourcePdf.preview.baseRef, file);
    assert.ok(fs.existsSync(previewPath), `PDF 兼容预览页不存在：${previewPath}`);
    assert.ok(fs.statSync(previewPath).size > 0, `PDF 兼容预览页为空：${previewPath}`);
  }
});

test("配置以通用借款人、来源槽、本体实例绑定和报告定义支撑多成员单位", () => {
  const config = loadConfig();
  const runtime = config.runtimeConfig;
  const borrower = runtime.borrowerProfiles.profiles.find((item) => item.borrowerId === runtime.borrowerProfiles.activeBorrowerId);
  const application = runtime.applicationProfiles.applications.find((item) => item.applicationId === runtime.applicationProfiles.activeApplicationId);
  assert.ok(borrower);
  assert.ok(application);
  assert.equal(application.borrowerId, borrower.borrowerId);
  assert.equal(runtime.sourceSlotDefinitions.every((slot) => slot.scope.startsWith("per-")), true);
  assert.equal(runtime.sourceSlotDefinitions.some((slot) => slot.sourceClass === "official-public"), true);
  assert.equal(runtime.sourceSlotDefinitions.some((slot) => slot.sourceClass.includes("synthetic-demo")), true);
  assert.equal(runtime.sourceSlotDefinitions.find((slot) => slot.slotId === "SRC-SLOT-LOAN-INVESTIGATION-PACK").sourceClass, "synthetic-demo / authorized-external / human-input");
  assert.equal(runtime.ontologyInstanceBindings.instanceKeys.borrowerId, borrower.borrowerId);
  assert.equal(runtime.ontologyInstanceBindings.instanceKeys.applicationId, application.applicationId);
  assert.equal(runtime.reportDefinitionBinding.reusableAcrossBorrowers, true);
  assert.equal(runtime.reportRunSelection.selectionMode, "BORROWER_AND_APPLICATION");
  assert.equal(runtime.reportRunSelection.currentBorrowerId, borrower.borrowerId);
  assert.equal(runtime.reportRunSelection.options[0].readiness, "READY");
  assert.equal(runtime.reportRunSelection.options[0].applicationId, application.applicationId);
  assert.equal(runtime.reportRunSelection.options.filter((item) => item.readiness === "REQUIRES_DATA_PREPARATION").length >= 3, true);
  assert.equal(runtime.reportRunSelection.options.some((item) => item.legalName === "中广核工程有限公司"), true);
  assert.equal(runtime.reportRunSelection.options.some((item) => item.legalName === "岭澳核电有限公司"), true);
  assert.equal(runtime.reportRunSelection.options.some((item) => item.borrowerId === "__OTHER_GROUP_MEMBER__"), true);
  assert.equal(runtime.reportRunSelection.preparationRoute, "#module/data");
  assert.match(runtime.ontologyInstanceBindings.reusePolicy, /通用对象、关系、Metric、Rule/);
  assert.match(runtime.borrowerProfiles.selectionPolicy, /新的数据快照、固定证据包和报告内容版本/);
  assert.deepEqual(runtime.sourceTemplateDefinitions.map((item) => item.templateId), [
    "SRC-TPL-PUBLIC-ANNUAL-REPORT-v1.0",
    "SRC-TPL-PREFLIGHT-EVIDENCE-PACK-v1.0"
  ]);
  assert.equal(runtime.sourceTemplateDefinitions.every((item) => item.currentBinding), true);
  assert.equal(runtime.sourceTemplateDefinitions[1].currentBinding, "s004-synthetic-demo-pack");
  assert.equal(runtime.borrowerRunInstantiation.currentBindingMode, "IMMUTABLE_CURRENT_INSTANCE");
  assert.deepEqual(runtime.borrowerRunInstantiation.requiredNewKeys, [
    "borrowerId", "unifiedSocialCreditCode", "memberId", "applicationId", "scenarioRunId", "reportId"
  ]);
  assert.match(runtime.borrowerRunInstantiation.m02Role, /不在当前页面创建正式 C033/);
});

test("运行配置复用权威制品身份，不另造 RUNTIME Published 或 C008 标识", () => {
  const config = loadConfig();
  const runtime = config.runtimeConfig;
  const identities = runtime.authoritativeContractIdentities;
  assert.equal(config.dataVersion, identities.dataAssetVersionId);
  assert.equal(config.ontologyVersion, identities.publishedPointer);
  assert.equal(config.trustedOntologyVersion, identities.publishedPointer);
  assert.equal(config.bindingId, identities.c008BundleId);
  assert.equal(runtime.ontologyInstanceBindings.publishedPointer, identities.publishedPointer);
  assert.equal(runtime.ontologyInstanceBindings.c008BindingId, identities.c008BundleId);
  assert.equal(runtime.semanticResources.publishedPointer, identities.publishedPointer);
  assert.equal(runtime.semanticResources.c008, identities.c008BundleId);
  assert.equal(identities.dataAssetId, "DATA-ASSET-S004");
  assert.equal(identities.dataAssetVersionId, "DATA-ASSET-S004-20260815-V01");
  assert.equal(identities.t019EvidenceId, "EVID-T019-S004-001");
  assert.equal(identities.evidencePackageId, "EVID-S004-20260815-0002");
  assert.doesNotMatch(JSON.stringify(config), /PUBLISHED-RUNTIME|C008-S004-RUNTIME|DA-S004-RUNTIME/);
});

test("历史正式制品来源上下文与当前运行投影显式分离", () => {
  const config = loadConfig();
  const projection = config.runtimeConfig.historicalArtifactProjection;
  assert.equal(projection.mode, "EXPLICIT_IMMUTABLE_ARTIFACT_PROJECTION");
  assert.equal(projection.deliveryVersionLabel, "S004-v2.0.1");
  assert.equal(projection.sourceScenarioContext.scenarioVersion, "S004-v2");
  assert.equal(projection.sourceScenarioContext.scenarioRunId, "S004-RUN-20260815233000000-7f3c8e42a1b6");
  assert.match(projection.identityPolicy, /原始业务标识保持不变/);
  assert.match(projection.mutationPolicy, /禁止覆盖/);
});

test("M05 报告请求入口只在同一 S004 轮次深链到 M06 创建与生成页", () => {
  const listeners = {};
  const scheduled = [];
  const frameLocation = { href: "http://127.0.0.1:4311/loader?moduleId=M06#/reports/view", hash: "#/reports/view" };
  const frame = {
    src: "http://127.0.0.1:4311/loader?moduleId=M06",
    contentWindow: { location: frameLocation },
    getAttribute(name) { return name === "src" ? this.src : null; },
    setAttribute(name, value) { if (name === "src") this.src = value; }
  };
  const documentElement = { dataset: {} };
  const document = {
    documentElement,
    getElementById(id) { return id === "module-frame" ? frame : null; }
  };
  class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} }
  const context = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-nav",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const window = {
    document,
    MutationObserver,
    URL,
    location: { origin: "http://127.0.0.1:4311", href: "http://127.0.0.1:4311/index.html", hash: "#module/agent" },
    setTimeout(callback) { scheduled.push(callback); return scheduled.length; },
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
    OFW_ACTIVE_SCENARIO_ADAPTER: { context: () => ({ ...context }) },
    OFWBaselineModuleAdapter: {
      createAdapter(config) { return { config: { foundationBaselineVersion: "1.0.3" }, context: () => ({ ...context }) }; },
      install() {}
    }
  };
  new Function("window", "document", fs.readFileSync(path.join(RUNTIME_DIR, "scenario-config.js"), "utf8"))(window, document);
  const c022Envelope = { contractCode: "C022", scenarioContext: { ...context }, requests: [{ requestId: "RGEN-S004-001" }] };
  assert.equal(window.OFW_S004_RUNTIME_RELAY.publish({ kind: "C022", context, payload: c022Envelope }), true);
  c022Envelope.requests[0].requestId = "MUTATED";
  assert.equal(window.OFW_S004_RUNTIME_RELAY.read({ kind: "C022", context }).requests[0].requestId, "RGEN-S004-001");
  assert.equal(window.OFW_S004_RUNTIME_RELAY.publish({ kind: "C022", context: { ...context, scenarioRunId: "S004-RUN-WRONG" }, payload: c022Envelope }), false);
  const m06Runtime = { scenarioContext: { ...context }, report: { stage: "generating", requestId: "RGEN-S004-001" } };
  assert.equal(window.OFW_S004_RUNTIME_RELAY.allowedKinds.includes("M06_RUNTIME_STATE"), true);
  assert.equal(window.OFW_S004_RUNTIME_RELAY.publish({ kind: "M06_RUNTIME_STATE", context, payload: m06Runtime }), true);
  assert.equal(window.OFW_S004_RUNTIME_RELAY.read({ kind: "M06_RUNTIME_STATE", context }).report.stage, "generating");
  listeners.message[0]({
    origin: window.location.origin,
    data: { type: "OFW_S004_NAVIGATE", route: "#module/report", moduleFragment: "#/reports/generate", ...context }
  });
  scheduled.forEach((callback) => callback());
  assert.equal(window.location.hash, "#module/report");
  assert.equal(frameLocation.hash, "#/reports/generate");
  assert.equal(documentElement.dataset.ofwS004NavigationBridgeFragment, "#/reports/generate");

  frame.src = "http://127.0.0.1:4311/loader?moduleId=M02";
  frameLocation.href = frame.src;
  frameLocation.hash = "";
  listeners.message[0]({
    origin: window.location.origin,
    data: { type: "OFW_S004_NAVIGATE", route: "#module/data", moduleFragment: "#/resources", ...context }
  });
  scheduled.splice(0).forEach((callback) => callback());
  assert.equal(window.location.hash, "#module/data");
  assert.equal(frameLocation.hash, "#/resources");
  assert.equal(documentElement.dataset.ofwS004NavigationBridgeFragment, "#/resources");

  frameLocation.hash = "#/reports/view";
  listeners.message[0]({
    origin: window.location.origin,
    data: { type: "OFW_S004_NAVIGATE", route: "#module/report", moduleFragment: "#/reports/generate", ...context, scenarioRunId: "S004-RUN-WRONG" }
  });
  scheduled.splice(0).forEach((callback) => callback());
  assert.equal(frameLocation.hash, "#/reports/view");
});

test("M05 跨模块深链不会把新建 M06 iframe 截停在 about:blank", () => {
  const listeners = {};
  const scheduled = [];
  const frameLocation = { href: "about:blank", hash: "" };
  const frame = {
    src: "http://127.0.0.1:4311/loader?moduleId=M06",
    contentWindow: { location: frameLocation },
    dataset: {},
    getAttribute(name) { return name === "src" ? this.src : null; },
    setAttribute(name, value) { if (name === "src") this.src = value; },
    addEventListener() {}
  };
  const documentElement = { dataset: {} };
  const document = {
    documentElement,
    getElementById(id) { return id === "module-frame" ? frame : null; }
  };
  class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} }
  const context = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-nav-blank",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const window = {
    document,
    MutationObserver,
    URL,
    location: { origin: "http://127.0.0.1:4311", href: "http://127.0.0.1:4311/index.html", hash: "#module/agent" },
    setTimeout(callback) { scheduled.push(callback); return scheduled.length; },
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
    OFW_ACTIVE_SCENARIO_ADAPTER: { context: () => ({ ...context }) },
    OFWBaselineModuleAdapter: {
      createAdapter(config) { return { config: { foundationBaselineVersion: "1.0.3" }, context: () => ({ ...context }) }; },
      install() {}
    }
  };
  new Function("window", "document", fs.readFileSync(path.join(RUNTIME_DIR, "scenario-config.js"), "utf8"))(window, document);
  listeners.message[0]({
    origin: window.location.origin,
    data: { type: "OFW_S004_NAVIGATE", route: "#module/report", moduleFragment: "#/reports/generate", ...context }
  });
  const firstDeliveryAttempt = scheduled.shift();
  firstDeliveryAttempt();
  assert.equal(window.location.hash, "#module/report");
  assert.equal(frameLocation.href, "about:blank");
  assert.equal(frameLocation.hash, "");
  assert.equal(new URL(frame.src).hash, "#/reports/generate");
  assert.equal(documentElement.dataset.ofwS004NavigationBridgeState, "fragment-bound-before-module-ready");

  frameLocation.href = frame.src;
  frameLocation.hash = "#/reports/generate";
  scheduled.splice(0).forEach((callback) => callback());
  assert.equal(frameLocation.hash, "#/reports/generate");
  assert.equal(documentElement.dataset.ofwS004NavigationBridgeFragment, "#/reports/generate");
  assert.equal(documentElement.dataset.ofwS004NavigationBridgeState, "delivered-to-ready-module");
});
