"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const seedSource = fs.readFileSync(path.join(RUNTIME_DIR, "seed-data.js"), "utf8");
const m02Source = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-modules/m02-data-engineering.html"), "utf8");
const baselineM02Path = path.resolve(RUNTIME_DIR, "../../../../prototype-releases/v1.0.3/data-engineering-prototype-review/review-v3/方案B2.html");
const baselineM02Source = fs.readFileSync(baselineM02Path, "utf8");

function seedApi() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", seedSource)(sandbox, sandbox);
  return sandbox.OFW_S004_SeedData;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function c003Fingerprint(value) {
  const snapshot = { ...value };
  delete snapshot.payloadFingerprint;
  const text = JSON.stringify(canonicalValue(snapshot));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `C003-PF-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}-${text.length}`;
}

test("M02 S004 目录使用场景投影而非追加基线业务夹具", () => {
  assert.match(m02Source, /if \(SCENARIO_ID === "S004"\) \{/);
  assert.match(m02Source, /D\.sources = flow\.customSources\.map\(copy\)/);
  assert.match(m02Source, /D\.pipelines = flow\.customPipelines\.map\(copy\)/);
  assert.match(m02Source, /D\.targetAssets = flow\.customAssets\.map\(copy\)/);
  assert.match(m02Source, /else \{\s*flow\.customSources\.forEach/s);
});

test("M02 保留 v1.0.3 数据源详情五页签、路由动作和冻结文件哈希", () => {
  const tabPattern = /const tabs = s\.id==="s003-workbook"\?\[\["overview","概览"\],\["content","内容与字段"\],\["snapshots","快照历史"\],\["references","引用关系"\]\]:\[\["overview","概览"\],\["content","内容与字段"\],\["snapshots","快照历史"\],\["references","引用关系"\],\["settings","设置"\]\];/;
  assert.match(baselineM02Source, tabPattern);
  assert.match(m02Source, tabPattern);
  assert.match(m02Source, /if\(action==="source-detail-tab"\) return go\(withParams\(\{tab:el\.dataset\.value\}\)\)/);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(baselineM02Path)).digest("hex"),
    "cbc0360fc4aeddd1285ddd26c3f5bdbc1b3cf539610779f45bde5f26923ef2d3"
  );
});

test("M02 保留 v1.0.3 数据资源、资产详情和管道工作台的完整操作骨架", () => {
  const structuralSnippets = [
    'const tabs = s.id==="s003-workbook"?[["overview","概览"],["content","内容与字段"],["snapshots","快照历史"],["references","引用关系"]]:[["overview","概览"],["content","内容与字段"],["snapshots","快照历史"],["references","引用关系"],["settings","设置"]];',
    'const tabs=[["overview","版本概览"],["members","包含的数据"],["lineage","如何产生"],["consumption","如何变为可用"]];',
    'const tabs = [["definitions","管道目录",D.pipelines.length],["runs","正式运行历史",flow.runs.length]];',
    'if(action==="source-detail-tab") return go(withParams({tab:el.dataset.value}));',
    'if(action==="asset-detail-tab") return go(withParams({tab:el.dataset.value}));',
    'if(action==="new-pipeline"){ui.pipelineDraft={step:1,name:"新数据管道",assetName:"新数据资产",purpose:"",template:"five",schedule:"manual"};return openModal("new-pipeline");}'
  ];
  for (const snippet of structuralSnippets) {
    assert.equal(baselineM02Source.includes(snippet), true, `冻结基线缺少结构片段：${snippet.slice(0, 48)}`);
    assert.equal(m02Source.includes(snippet), true, `S004 参数化副本丢失结构片段：${snippet.slice(0, 48)}`);
  }
  assert.match(m02Source, /data-s004-current-operations="enabled"/);
  assert.match(m02Source, /进入管道运行工作台/);
  assert.match(m02Source, /重新运行/);
  assert.match(m02Source, /开始正式运行/);
  assert.doesNotMatch(m02Source, /当前只读查看既有制品|不发起新运行或版本变更|当前轮次不可运行/);
});

test("M02 S004 已发布管道可打开只读生产画布并锁定两个来源快照", () => {
  const S = seedApi();
  const flow = S.buildM02Flow({
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m02test",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  });

  assert.deepEqual(flow.customSources.map((item) => item.id), [
    "s004-official-annual-reports",
    "s004-synthetic-demo-pack"
  ]);
  assert.equal(flow.customPipelines.length, 1);
  assert.equal(flow.customAssets.length, 1);

  const pipeline = flow.customPipelines[0];
  assert.equal(pipeline.canOpen, true);
  assert.equal(pipeline.nodeCount, 6);

  const definition = flow.publishedDefinitions.find((item) => item.id === pipeline.definitionVersion);
  assert.ok(definition, "缺少管道已发布定义");
  assert.equal(definition.pipelineId, pipeline.id);
  assert.equal(definition.nodes.length, 6);
  assert.equal(definition.edges.length, 5);
  assert.equal(definition.nodes.filter((item) => item.key === "source").length, 2);
  assert.equal(definition.nodes.some((item) => item.key === "publish"), true);
  assert.equal(definition.nodes.some((item) => item.key === "refresh"), true);

  const run = flow.runs[0];
  assert.equal(run.inputs.length, 2);
  assert.deepEqual(run.inputs.map((item) => item.resourceId), [
    "s004-official-annual-reports",
    "s004-synthetic-demo-pack"
  ]);
  assert.equal(run.inputs.every((item) => item.resourceId !== run.targetAssetId), true);
  assert.deepEqual(run.inputs.map((item) => item.version), [
    "SNAP-S004-AR-2025",
    "SNAP-S004-DEMO-20260815"
  ]);
  assert.equal(run.nodeExecutions.length, definition.nodes.length);
  assert.equal(run.nodeExecutions.every((item) => item.status === "成功"), true);
  assert.equal(flow.candidateVersionId, "");
  assert.equal(typeof flow.assetVersions[0].sourceSnapshot, "string");
  assert.doesNotMatch(flow.assetVersions[0].sourceSnapshot, /\[object Object\]/);
  assert.deepEqual(flow.assetVersions[0].sourceSnapshotIds, [
    "SNAP-S004-AR-2025",
    "SNAP-S004-DEMO-20260815"
  ]);
});

test("M01/M02 共享同轮 C003 v2 冻结载荷、完整回执和真实来源指纹", () => {
  const S = seedApi();
  const context = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-c003",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const shared = S.buildM02DeliveryEvidence(context);
  const m01 = S.buildM01State(context, {});
  const m02 = S.buildM02Flow(context, {});
  const key = `${S.identities.M02_T006}::${S.identities.M02_ASSET_VERSION}`;
  const record = m02.dataAssetDeliveries[0];

  assert.equal(m02.dataAssetDeliveries.length, 1);
  assert.deepEqual(m01.externalDataAssets[key], shared.payload);
  assert.deepEqual(record.payload, shared.payload);
  assert.deepEqual(m01.dataAssetDeliveryReceipts[shared.payload.deliveryId], shared.receipt);
  assert.equal(shared.payload.contractSchemaVersion, 2);
  assert.equal(shared.payload.deliveryStatus, "已发送");
  assert.equal(shared.payload.deliveryId, shared.payload.deliverySeriesId);
  assert.equal(shared.payload.attemptNumber, 1);
  assert.equal(shared.payload.asOf, "2026-08-15");
  assert.equal(shared.payload.t008AsOf, shared.payload.asOf);
  assert.equal(shared.payload.sourceFingerprint.value, "9a6e3502039beef28ebe1fe10bc046cd4bb0e051b35122b2d6aea1c8c235f6d9");
  assert.equal(shared.payload.sourceFingerprint.sizeBytes, 20294);
  assert.equal(shared.payload.t008Confirmation.sizeBytes, 20294);
  assert.equal(shared.payload.payloadFingerprint, c003Fingerprint(shared.payload));
  assert.equal(shared.payload.members.length, 8);
  assert.equal(shared.payload.members.every((member) => member.objectId), true);
  assert.equal(shared.payload.relations.length, 5);
  assert.equal(record.status, "已发送 · 结果待核对");
  assert.equal(record.receiptStatus, "等待 M01 持久化联合证据");
  assert.equal(record.runtimeVerificationId, "");

  const receiptFields = [
    "sourceModule", "contractCode", "deliveryId", "status", "receivedAt", "reason",
    "scenarioContext", "targetDraftId", "targetDraftRevision", "t006Id", "t007Version",
    "t008AsOf", "previousDraftId", "previousAssetVersion", "replacement"
  ];
  receiptFields.forEach((field) => assert.equal(Object.prototype.hasOwnProperty.call(shared.receipt, field), true, `回执缺少 ${field}`));
  assert.equal(shared.receipt.status, "accepted");
  assert.equal(shared.receipt.reason, null);
  assert.equal(shared.receipt.targetDraftId, "draft-S004-0001");
  assert.equal(shared.receipt.targetDraftRevision, 1);
  assert.equal(shared.receipt.previousDraftId, null);
  assert.equal(shared.receipt.previousAssetVersion, null);
  assert.equal(shared.receipt.replacement, null);

  const fields = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
  fields.forEach((field) => {
    assert.equal(shared.payload.scenarioContext[field], context[field]);
    assert.equal(shared.receipt.scenarioContext[field], context[field]);
    assert.equal(record.scenarioContext[field], context[field]);
  });
  const c033 = Object.values(m01.scenarioContextReceipts)[0];
  assert.match(c033.receipt.contextId, new RegExp(context.scenarioRunId));
  fields.forEach((field) => assert.equal(c033.receipt.scenarioContext[field], context[field]));
});

test("M02 已发布版本带完整可信度摘要且精确快照、运行和 C003 指纹一致", () => {
  const S = seedApi();
  const flow = S.buildM02Flow({
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-trust",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  });
  const version = flow.assetVersions[0];
  const run = flow.runs[0];
  const snapshot = flow.uploadedSnapshots.find((entry) => entry.snapshot.snapshotId === S.identities.M02_SNAPSHOT_ID).snapshot;
  const payload = flow.dataAssetDeliveries[0].payload;

  assert.equal(version.sourceHash, S.identities.M02_SOURCE_SHA256);
  assert.equal(run.snapshotHash, S.identities.M02_SOURCE_SHA256);
  assert.equal(snapshot.hash, S.identities.M02_SOURCE_SHA256);
  assert.equal(payload.sourceFingerprint.value, S.identities.M02_SOURCE_SHA256);
  assert.equal(snapshot.sizeBytes, S.identities.M02_SOURCE_SIZE_BYTES);
  assert.equal(payload.sourceFingerprint.sizeBytes, S.identities.M02_SOURCE_SIZE_BYTES);
  assert.equal(version.bindingTrustSummary.assetVersionId, version.id);
  assert.equal(version.bindingTrustSummary.scenarioContext.scenarioRunId, flow.scenarioContext.scenarioRunId);
  assert.equal(version.currentTrustSummaries.length, 1);
  assert.equal(version.currentTrustSummaries[0].currentAuthorityVersionId, version.id);
  assert.deepEqual(version.currentTrustSummaries[0].dimensions, {
    versionLocation: "可定位",
    contentAccess: "可访问",
    evidenceIntegrity: "完整",
    replayCapability: "未执行",
    replayVerification: "未执行"
  });
});

test("M02 重读历史 C003 且不会覆盖 M03/M04/M06 的 S004 消费语义", () => {
  assert.match(m02Source, /candidateVersion\(\)\|\|\[\.\.\.flow\.assetVersions\]\.reverse\(\)\.find/);
  assert.match(m02Source, /deliveryPurpose=SCENARIO_ID==="S004"\?"S004 贷前调查本体映射"/);
  assert.match(m02Source, /applicability:"NOT_APPLICABLE"/);
  assert.match(m02Source, /mayRun:false,maySubmitActionRequest:false,projections:\[\]/);
  assert.match(m02Source, /applicability:"EMPTY_ACTION_REQUEST_QUEUE"/);
  assert.doesNotMatch(m02Source, /C017_REPORT_KEY/);
});

test("M02 S004 数据源详情提供内容字段目录、来源标签和整份资料下载", () => {
  const S = seedApi();
  const flow = S.buildM02Flow({
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m02content",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  });
  const official = flow.customSources.find((item) => item.id === "s004-official-annual-reports");
  const synthetic = flow.customSources.find((item) => item.id === "s004-synthetic-demo-pack");
  assert.equal(official.workbookKey, "s004-official-annual-reports");
  assert.equal(official.name, "财务报告");
  assert.equal(synthetic.workbookKey, "s004-synthetic-demo-pack");
  assert.equal(official.access, "既有权威资料复用");
  assert.equal(official.sourceArtifact.kind, "pdf-bundle");
  assert.equal(official.sourceArtifact.files.length, 3);
  assert.equal(synthetic.sourceArtifact.kind, "xlsx-workbook");
  assert.equal(synthetic.sourceArtifact.files.length, 1);
  assert.match(m02Source, /function sourceArtifactPanel\(s\)/);
  assert.match(m02Source, /data-source-download=/);
  assert.match(m02Source, /sheet\.fieldSources/);
  assert.match(m02Source, /财务报告内容与字段/);
  assert.match(m02Source, /s\.category === "正式财务报告"/);
  assert.match(m02Source, /下载源文件/);
  assert.match(m02Source, /\$\{sourceArtifactPanel\(s\)\}/);
  assert.match(m02Source, /生成阶段不直接联网搜索/);
  assert.doesNotMatch(m02Source, /\$\{s004DataConfigurationBanner\(\)\}/);

  for (const source of [official, synthetic]) {
    for (const file of source.sourceArtifact.files) {
      const localPath = path.resolve(RUNTIME_DIR, "baseline-modules", file.href);
      assert.ok(fs.existsSync(localPath), `下载制品不存在：${localPath}`);
      const digest = crypto.createHash("sha256").update(fs.readFileSync(localPath)).digest("hex");
      assert.equal(digest, file.sha256, `${file.fileName} SHA-256 不匹配`);
      assert.equal(fs.statSync(localPath).size, file.sizeBytes, `${file.fileName} 文件大小不匹配`);
    }
  }
});

test("M02 S004 引用关系把字符串配置解析为可穿透的完整下游链", () => {
  assert.match(m02Source, /function sourcePipelineReferences\(s\)/);
  assert.match(m02Source, /typeof ref==="string"\?\{pipelineId:ref\}/);
  assert.match(m02Source, /function sourceAssetReferences\(s,pipelines\)/);
  assert.match(m02Source, /S004 场景引用链/);
  for (const label of ["1 · 数据源", "2 · 不可变快照", "3 · 管道输入", "4 · 数据资产", "5 · Published \/ C008", "6 · 报告证据"]) {
    assert.match(m02Source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(m02Source, /进入管道画布/);
  assert.match(m02Source, /查看沿袭/);
  assert.match(m02Source, /borrowerKey、applicationId、年度\/截至参数/);
});

test("M02 S004 设置页提供来源模板、借款人参数、更新策略、校验门和跨公司复用", () => {
  for (const marker of [
    "source-setting-borrower-name",
    "source-setting-borrower-key",
    "source-setting-member-id",
    "source-setting-application-id",
    "source-setting-period-policy",
    "source-setting-as-of-policy",
    "source-setting-update-strategy",
    "source-setting-reuse-mode"
  ]) assert.match(m02Source, new RegExp(marker));
  assert.match(m02Source, /SRC-TPL-PUBLIC-ANNUAL-REPORT-v1\.0/);
  assert.match(m02Source, /SRC-TPL-PREFLIGHT-EVIDENCE-PACK-v1\.0/);
  assert.match(m02Source, /进入管道前校验门/);
  assert.match(m02Source, /其他集团成员单位/);
  assert.match(m02Source, /两类动作都不覆盖既有快照、运行和正式版本/);
  assert.match(m02Source, /function s004SourceOperationPanel\(source,profile\)/);
  assert.match(m02Source, /data-s004-current-operations="enabled"/);
  assert.match(m02Source, /进入管道运行工作台/);
  assert.match(m02Source, /当前中国广核实例追加新资料并形成下一运行\/资产版本/);
  assert.doesNotMatch(m02Source, /只读来源边界/);
});

test("M02 S004 明确区分通用模板、当前实例和新借款人隔离预演", () => {
  const S = seedApi();
  const flow = S.buildM02Flow({
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m02generic",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  });
  assert.equal(flow.sourceTemplates.length, 2);
  assert.deepEqual(flow.sourceTemplates.map(item => item.templateId), [
    "SRC-TPL-PUBLIC-ANNUAL-REPORT-v1.0",
    "SRC-TPL-PREFLIGHT-EVIDENCE-PACK-v1.0"
  ]);
  assert.deepEqual(flow.sourceTemplates.map(item => item.instanceScope), ["per-borrower", "per-application"]);
  assert.deepEqual(flow.sourceTemplates.map(item => item.sourceClass), [
    "official-public",
    "synthetic-demo / authorized-external / human-input"
  ]);
  assert.equal(flow.sourceTemplates.every(item => !JSON.stringify(item).includes("中国广核电力股份有限公司")), true);
  assert.equal(flow.sourceTemplates[0].parameterKeys.includes("borrowerId"), true);
  assert.equal(flow.sourceTemplates[1].parameterKeys.includes("applicationId"), true);
  assert.match(flow.sourceTemplates[0].reuseMode, /新借款人创建独立来源实例、快照和 scenarioRunId/);
  assert.match(flow.sourceTemplates[1].reuseMode, /新申请创建独立来源实例、快照和 scenarioRunId/);
  assert.equal(flow.activeBorrowerRun.bindingMode, "IMMUTABLE_CURRENT_INSTANCE");
  assert.equal(flow.activeBorrowerRun.borrowerName, "中国广核电力股份有限公司");
  assert.equal(flow.activeBorrowerRun.scenarioRunId, "S004-RUN-20260816000000000-m02generic");
  assert.equal(flow.activeBorrowerRun.immutable, true);
  assert.equal(flow.borrowerRunInstantiationPolicy.mode, "CLONE_TEMPLATES_TO_NEW_ISOLATED_SCENARIO_RUN");
  assert.match(flow.borrowerRunInstantiationPolicy.formalCreationBoundary, /不创建正式 C033/);
  assert.equal(flow.customSources.every(item => item.templateDefinition?.templateId && item.instanceBinding?.applicationId), true);
  assert.equal(flow.customSources[0].fileName, "中国广核2025年年度报告.pdf");
  assert.deepEqual(flow.customSources.map(item => item.instanceBinding.scope), ["当前借款人", "当前贷款申请"]);
  assert.equal(flow.customSources.every(item => item.instanceBinding.borrowerId === flow.activeBorrowerRun.borrowerId), true);
  assert.equal(flow.customSources.every(item => item.instanceBinding.scenarioRunId === flow.activeBorrowerRun.scenarioRunId), true);
  assert.equal(flow.customAssets[0].templateDefinition.templateId, "ASSET-TPL-S004-PREFLIGHT-v1.0");
  assert.equal(flow.customPipelines[0].templateDefinition.templateId, "PIPE-TPL-S004-PREFLIGHT-v1.0");
  assert.equal(flow.customAssets[0].templateDefinition.parameterKeys.includes("scenarioRunId"), true);
  assert.equal(flow.customPipelines[0].templateDefinition.parameterKeys.includes("sourceInstanceIds[]"), true);
  assert.deepEqual(flow.borrowerRunInstantiationPolicy.requiredNewKeys, [
    "borrowerId", "unifiedSocialCreditCode", "memberId", "applicationId", "scenarioRunId", "reportId"
  ]);
  assert.deepEqual(flow.borrowerRunInstantiationPolicy.isolatedOutputs, [
    "sourceInstanceId", "sourceSnapshotId", "dataAssetVersion", "Published/C008 binding", "evidencePackId", "contentVersion"
  ]);
  assert.equal(flow.borrowerRunPreview, null);
  for (const marker of [
    'data-s004-data-configuration="template-instance-run"',
    'data-s004-current-binding="immutable"',
    'data-s004-current-operations="enabled"',
    'data-s004-new-borrower-run="preview-only"',
    'data-s004-preview-result="true"',
    'preview-borrower-run',
    'clear-borrower-run-preview',
    'source-setting-scenario-run-id',
    'readonly aria-readonly="true" data-s004-immutable-key="true"'
  ]) assert.match(m02Source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const copy of [
    "通用来源模板",
    "当前来源实例",
    "新借款人轮次装配预演",
    "预演入口 · 不创建正式制品",
    "复用模板，重新绑定主体、申请、时点和来源文件"
  ]) assert.match(m02Source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(m02Source, /flow\.borrowerRunPreview=\s*result\.preview/);
  assert.match(m02Source, /does not.*正式 runs|没有写入正式 runs/s);
  assert.match(m02Source, /稳定键不原地改写，但可在当前实例下追加新快照、正式运行和资产版本/);
  assert.match(m02Source, /当前公司的稳定身份保持不变；上传\/登记新来源后/);
  assert.match(m02Source, /settings\.periodPolicy/);
  assert.doesNotMatch(m02Source, /settings\.borrowerName=|settings\.borrowerKey=|settings\.memberId=|settings\.applicationId=/);
});

test("M02 S004 已发布链保留校验、质量、C032/C028/C029、T018 与 T019 历史证据", () => {
  const S = seedApi();
  const context = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-full-chain",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const flow = S.buildM02Flow(context, {});
  const definition = flow.publishedDefinitions[0];
  const run = flow.runs[0];
  const version = flow.assetVersions[0];
  const attempt = flow.refreshAttempts[0];

  assert.equal(definition.validationSeen, true);
  assert.ok(definition.validationFingerprint.length > 100);
  assert.equal(definition.validationAt, "2026-08-16 00:00:00");
  assert.equal(run.qualityChecks.length, 5);
  assert.equal(run.qualityChecks.every((item) => item.failedCount === 0 && item.evidenceLocator), true);
  assert.equal(flow.ontologyDiscoveryStatus, "ready");
  assert.equal(flow.ontologyDiscovery.candidates.length, 1);
  assert.equal(flow.ontologyDiscovery.candidates[0].refreshTargetId, definition.ontologyBindingId);
  assert.equal(attempt.requestId, version.refreshRequestId);
  assert.equal(attempt.resultId, version.refreshResultId);
  assert.equal(attempt.t018Status, "可消费候选");
  assert.equal(attempt.t018EvidenceId, version.t018EvidenceId);
  assert.equal(attempt.t019Status, "已采用");
  assert.equal(attempt.t019EvidenceId, version.t019EvidenceId);
  assert.equal(attempt.t019BindingId, version.t019BindingId);
  assert.equal(version.id, S.identities.DATA_VERSION);
  assert.equal(version.consumptionStatus, "可消费");
  assert.match(m02Source, /function historicalOntologyBindingGate\(canvas=ui\.canvas\)/);
  assert.match(m02Source, /\["消费就绪","可消费"\]\.includes\(version\.consumptionStatus\)/);
  assert.match(m02Source, /!isDraft\(\)&&historicalBindingGate\.okay\?historicalBindingGate:strictBindingGate/);
  assert.match(m02Source, /当前生产运行已锁定 C032\/C028\/C029、T018 和 T019 采用证据/);
  assert.match(m02Source, /下一资产版本提交前必须重新读取目标绑定/);
  assert.match(m02Source, /bindingHistorical:Boolean\(bindingGate\.historical&&bindingGate\.okay\)/);
  assert.match(m02Source, /当前生产链已取得 T019 正式采用证据；下一资产版本仍须重新读取目标绑定/);

  const m01 = S.buildM01State(context, {});
  const semanticVersionId = m01.currentFormalVersionId;
  const targets = m01.refreshTargetBindingsByVersion[semanticVersionId];
  assert.equal(targets.length, 1);
  assert.equal(targets[0].stableId, definition.ontologyBindingId);
  assert.equal(targets[0].dataAssetId, version.targetAssetId);
  assert.equal(targets[0].memberIds.length, version.members.length);
  assert.equal(targets[0].relationIds.length, version.relationships.length);
});

test("M02 S004 不再以空投影覆盖 M04 C017，且精确 T006/T007/T018/T019 可定位", () => {
  const S = seedApi();
  const context = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-c017-owner",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const c008 = S.buildC008Envelope(context, {});
  const decision = S.buildC017DecisionProjection(context, c008, {});
  const item = decision.projections[0];
  assert.equal(decision.applicability, "EMPTY_ACTION_REQUEST_QUEUE");
  assert.equal(decision.actionRequestCount, 0);
  assert.equal(decision.projections.length, 1);
  assert.equal(item.t006Id, S.identities.M02_T006);
  assert.equal(item.t007Version, S.identities.M02_ASSET_VERSION);
  assert.equal(item.dataVersion, S.identities.DATA_VERSION);
  assert.equal(item.t018.status, "可消费候选");
  assert.equal(item.t019.status, "已采用");
  assert.equal(c008.current.dataVersion, S.identities.M02_ASSET_VERSION);
  assert.doesNotMatch(m02Source, /C017_DECISION_PROJECTION_KEY,[^\n]*projections:\[\]/);
  assert.match(m02Source, /精确 T006\/T007\/T018\/T019 数据可信度投影继续保留/);
});

test("M02 S004 管道详情使用贷前调查处理与质量文案，不泄漏 S001 融资脚本语义", () => {
  assert.match(m02Source, /贷前调查数据已可消费/);
  assert.match(m02Source, /贷前调查事实标准化/);
  assert.match(m02Source, /贷前调查数据发布前检查 2\.0\.0/);
  assert.match(m02Source, /s004_preflight_standardize\.py/);
  assert.match(m02Source, /reject_duplicate_financial_facts=True/);
});

test("M02 S004 共用演示时钟并按当前 Origin 给出跨模块恢复路径", () => {
  assert.match(m02Source, /function runtimeClockDate\(\)/);
  assert.match(m02Source, /SCENARIO_ID!=="S004"/);
  assert.match(m02Source, /live\.setFullYear\(2026,7,16\)/);
  assert.match(m02Source, /SCENARIO_ID==="S004"\?"2026-08-16"/);
  assert.match(m02Source, /场景外壳、M01 与 M02 共用当前 Origin（\$\{location\.origin\}）/);
  assert.match(m02Source, /const ONTOLOGY_BASELINE_SOURCE = "\.\.\/\.\.\/\.\.\/\.\.\/prototype-releases\/v1\.0\.3\/ontology-management-review\/canvas-first\/index\.html"/);
  assert.match(m02Source, /function ontologyBridgeEntryUrl\(\)/);
  assert.match(m02Source, /new URL\("\.\/baseline-module-loader\.html",location\.href\)/);
  assert.match(m02Source, /params\.set\("moduleId","M01"\);params\.set\("source",ONTOLOGY_BASELINE_SOURCE\)/);
  assert.match(m02Source, /frame\.src=ontologyBridgeEntryUrl\(\)/);
  assert.match(m02Source, /function waitForOntologyBridgeReady\(frame,finish\)/);
  assert.match(m02Source, /getAttribute\("data-ontology-handoff-ready"\)==="true"/);
  assert.match(m02Source, /setTimeout\(poll,60\)/);
  assert.match(m02Source, /timer=setTimeout\(\(\)=>finish\(null\),6500\)/);
  assert.match(m02Source, /frame\.addEventListener\("load",\(\)=>waitForOntologyBridgeReady\(frame,finish\)/);
  assert.doesNotMatch(m02Source, /127\.0\.0\.1:4311/);
  assert.doesNotMatch(m02Source, /frame\.src=new URL\(ONTOLOGY_ENTRY_PATH/);
  assert.doesNotMatch(m02Source, /frame\.addEventListener\("load",\(\)=>\{frame\.dataset\.ready="true";finish\(frame\);\}/);
});

test("M02 隐藏 M01 桥接地址保留五字段场景上下文且不绑定开发端口", () => {
  const bridgeMatch = m02Source.match(/function ontologyBridgeEntryUrl\(\) \{[\s\S]*?\n  \}\n  const C003_RUNTIME_VERIFICATION_ID/);
  assert.ok(bridgeMatch, "未定位 ontologyBridgeEntryUrl 实现");
  const bridgeFunction = bridgeMatch[0].replace(/\n  const C003_RUNTIME_VERIFICATION_ID[\s\S]*$/, "");
  const buildBridgeUrl = new Function(
    "location", "URL", "URLSearchParams",
    `const ONTOLOGY_BASELINE_SOURCE = "../../../../prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html";${bridgeFunction};return ontologyBridgeEntryUrl();`
  );
  const current = "http://127.0.0.1:4311/designs/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M02&source=.%2Fbaseline-modules%2Fm02-data-engineering.html&scenarioId=S004&scenarioVersion=S004-v2.1.0&scenarioRunId=S004-RUN-20260816080000000-bridge&formedAt=2026-08-16T08%3A00%3A00.000Z&status=active#/resources";
  const currentUrl = new URL(current);
  const result = new URL(buildBridgeUrl({ href: currentUrl.href, search: currentUrl.search }, URL, URLSearchParams));
  assert.equal(result.origin, "http://127.0.0.1:4311");
  assert.match(result.pathname, /\/baseline-module-loader\.html$/);
  assert.equal(result.searchParams.get("moduleId"), "M01");
  assert.equal(result.searchParams.get("source"), "../../../../prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html");
  assert.equal(result.searchParams.get("scenarioId"), "S004");
  assert.equal(result.searchParams.get("scenarioVersion"), "S004-v2.1.0");
  assert.equal(result.searchParams.get("scenarioRunId"), "S004-RUN-20260816080000000-bridge");
  assert.equal(result.searchParams.get("formedAt"), "2026-08-16T08:00:00.000Z");
  assert.equal(result.searchParams.get("status"), "active");
  assert.equal(result.hash, "");
});

test("M02 S004 时钟即使宿主已进入 8 月 17 日也固定显示 8 月 16 日", () => {
  const clockMatch = m02Source.match(/function runtimeClockDate\(\) \{[\s\S]*?\n  \}\n  function nowText\(\) \{[\s\S]*?\n  \}/);
  assert.ok(clockMatch, "未定位 M02 演示时钟实现");
  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-08-17T02:14:10"]));
    }
  }
  const renderNow = new Function("Date", "SCENARIO_ID", `${clockMatch[0]};return nowText();`);
  assert.equal(renderNow(FakeDate, "S004"), "2026-08-16 02:14:10");
  assert.equal(renderNow(FakeDate, "S001"), "2026-08-17 02:14:10");
});

test("M02 内联脚本均可通过 JavaScript 语法编译", () => {
  const scripts = [...m02Source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.ok(scripts.length >= 2);
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(() => new Function(source), `第 ${index + 1} 段脚本语法错误`);
  }
});
