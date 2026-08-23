#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const foundation = require("../../../foundation/ofw-scenario-foundation.js");
const configService = require("../domain/config-service.js");
const scoreEngine = require("../domain/score-engine.js");

const packageRoot = path.resolve(__dirname, "..");
const FORMED_AT = "2026-08-15T13:30:00.000Z";
const VALIDATED_AT = "2026-08-15T13:28:00.000Z";
const PUBLISHED_AT = "2026-08-15T13:29:00.000Z";
const FIXED_RANDOM_BYTES = Uint8Array.from([0xc0, 0x35, 0x03, 0x00, 0x00, 0x01]);
const OUTPUT_REFS = Object.freeze([
  "resources/m01/published-pointer.v1.json",
  "resources/m01/evaluation-run.v1.json",
  "resources/m01/c035-risk-results.v1.json",
  "resources/m01/published-risk-facts.v1.json",
  "resources/m01/runtime-export.v1.json"
]);
const EVIDENCE_REF = "evidence/CP03-published-switch-validation.md";

function fail(message) {
  throw new Error(message);
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function jsonSha256(value) {
  return sha256(Buffer.from(serializeJson(value), "utf8"));
}

function resolvePackageRef(ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..")) fail(`非法包内引用: ${String(ref)}`);
  const absolute = path.resolve(packageRoot, ref);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) fail(`引用越出 S003 包: ${ref}`);
  return absolute;
}

function readJson(ref) {
  return JSON.parse(fs.readFileSync(resolvePackageRef(ref), "utf8"));
}

function sha256File(ref) {
  return sha256(fs.readFileSync(resolvePackageRef(ref)));
}

function buildScenarioContext() {
  return foundation.createScenarioContext(
    {scenarioId: "S003", scenarioVersion: "S003-v1", status: "active"},
    {
      now: new Date(FORMED_AT),
      randomBytes(size) {
        if (size !== FIXED_RANDOM_BYTES.length) fail(`unexpected random byte length: ${size}`);
        return Uint8Array.from(FIXED_RANDOM_BYTES);
      }
    }
  );
}

function buildPublishedModel(baseModel) {
  const draft = configService.createDraft(baseModel, {
    draftId: "S003-MODEL-DRAFT-CP03-001",
    proposedVersion: "1.0.1",
    createdAt: "2026-08-15T13:27:00.000Z"
  });
  const marked = configService.markValidated(draft, {validatedAt: VALIDATED_AT});
  if (!marked.validation.ok || marked.draft.lifecycleStatus !== "validated") {
    fail(`CP03模型草稿校验失败: ${JSON.stringify(marked.validation.errors || [])}`);
  }
  const published = configService.publishDraft(marked.draft, baseModel, {publishedAt: PUBLISHED_AT});
  scoreEngine.validateModelPackage(published);
  if (published.lifecycleStatus !== "published") fail("CP03模型配置未进入Published生命周期");
  return {
    draft,
    validatedDraft: marked.draft,
    validation: marked.validation,
    published
  };
}

function joinEvaluationInputs(formalCandidate, humanInput) {
  if (formalCandidate.status !== "quality-passed-candidate") fail("正式候选数据资产未通过质量门");
  if (humanInput.status !== "published-input" || humanInput.immutable !== true) {
    fail("人工输入必须是不可变Published输入快照");
  }
  if (formalCandidate.enterpriseCount !== 21 || humanInput.enterpriseCount !== 21) {
    fail("CP03首次评估必须精确覆盖21家企业");
  }
  const inputsByEnterprise = new Map(humanInput.records.map((record) => [record.enterpriseId, record]));
  const enterprises = formalCandidate.records.map((record) => {
    const input = inputsByEnterprise.get(record.enterpriseId);
    if (!input) fail(`缺少企业因子输入: ${record.enterpriseId}`);
    if (input.category !== record.category || input.assessmentAt !== record.assessmentAt) {
      fail(`企业数据与人工输入上下文错配: ${record.enterpriseId}`);
    }
    const factorInputs = Object.fromEntries(input.values.map((value) => {
      if (value.state === "EXPLICIT_VALUE") return [value.factorName, value.normalizedValue];
      if (value.state === "DEFAULTED_ZERO" || value.state === "NOT_APPLICABLE") return [value.factorName, null];
      fail(`${record.enterpriseId}.${value.factorName}存在未知因子状态: ${value.state}`);
    }));
    return {
      enterpriseId: record.enterpriseId,
      name: record.enterpriseName,
      sector: record.sector,
      category: record.category,
      financialData: record.financialData,
      factorInputs
    };
  });
  if (new Set(enterprises.map((enterprise) => enterprise.enterpriseId)).size !== 21) {
    fail("CP03企业稳定ID必须唯一");
  }
  return enterprises;
}

function compactC035Result(result) {
  return {
    schemaVersion: result.schemaVersion,
    contractId: result.contractId,
    resultId: result.resultId,
    resultVersion: result.resultVersion,
    status: result.status,
    engineVersion: result.engineVersion,
    scenarioIdentity: result.scenarioIdentity,
    enterprise: result.enterprise,
    assessmentAt: result.assessmentAt,
    currency: result.currency,
    amountUnit: result.amountUnit,
    modelIdentity: result.modelIdentity,
    dataIdentity: result.dataIdentity,
    rawScore: result.rawScore,
    factorSum: result.factorSum,
    compositeAdjustment: result.compositeAdjustment,
    finalScore: result.finalScore,
    riskTier: result.riskTier,
    indicatorResults: result.indicatorResults,
    factorResults: result.factorResults,
    factorStates: result.factorStates,
    majorFactorHits: result.majorFactorHits,
    lowestThree: result.lowestThree,
    isUnderConstruction: result.isUnderConstruction,
    markers: result.markers,
    modelWarnings: result.modelWarnings,
    dispositionCandidates: result.dispositionCandidates,
    reportLifecycle: {
      status: "not-generated-at-cp03",
      note: "CP03仅发布评估事实；正式企业报告在后续报告/驾驶舱节点生成。"
    }
  };
}

function assertNoAutomaticDecisionSideEffects(results) {
  const candidates = results.flatMap((result) => result.dispositionCandidates || []);
  for (const candidate of candidates) {
    if (
      candidate.actionRequestId !== null
      || candidate.todoId !== null
      || candidate.autoCreateActionRequest !== false
      || candidate.autoCreateTodo !== false
      || candidate.requiresHumanConfirmation !== true
    ) {
      fail(`处置候选越过人工确认边界: ${candidate.candidateId}`);
    }
  }
  return candidates;
}

function buildPublishedAssets() {
  const refs = {
    baseModel: "resources/m01/model-package.v1.json",
    formalCandidate: "resources/m02/formal-candidate-data-asset.v1.json",
    humanInput: "resources/m02/human-input-snapshot.v1.json",
    qualityResult: "resources/m02/quality-result.v1.json",
    previousCheckpoint: "checkpoints/CP02-data-connected.json"
  };
  const baseModel = readJson(refs.baseModel);
  const formalCandidate = readJson(refs.formalCandidate);
  const humanInput = readJson(refs.humanInput);
  const qualityResult = readJson(refs.qualityResult);
  const previousCheckpoint = readJson(refs.previousCheckpoint);
  if (qualityResult.status !== "passed") fail("M02质量结果未通过，禁止进入CP03");

  const scenarioContext = buildScenarioContext();
  if (scenarioContext.scenarioRunId === previousCheckpoint.scenarioContext.scenarioRunId) {
    fail("首次正式评估必须创建新的scenarioRunId");
  }
  const publication = buildPublishedModel(baseModel);
  const publishedSnapshotSha256 = jsonSha256(publication.published);
  const inputHashes = {
    baseModelSha256: sha256File(refs.baseModel),
    formalCandidateSha256: sha256File(refs.formalCandidate),
    humanInputSha256: sha256File(refs.humanInput),
    qualityResultSha256: sha256File(refs.qualityResult),
    previousCheckpointSha256: sha256File(refs.previousCheckpoint)
  };

  const pointer = {
    schemaVersion: "ofw.s003.m01.published-pointer.v1",
    pointerId: "S003-M01-PUBLISHED-POINTER",
    pointerVersion: "1.0.0",
    status: "active",
    immutable: true,
    switchedAt: FORMED_AT,
    owner: "M01 本体管理",
    businessOwner: "财务公司",
    scenarioIdentity: scenarioContext,
    previousTarget: {
      packageId: baseModel.packageId,
      packageVersion: baseModel.packageVersion,
      lifecycleStatus: baseModel.lifecycleStatus,
      resourceRef: refs.baseModel,
      sha256: inputHashes.baseModelSha256
    },
    activeTarget: {
      packageId: publication.published.packageId,
      packageVersion: publication.published.packageVersion,
      lifecycleStatus: publication.published.lifecycleStatus,
      resourceType: publication.published.resourceType,
      snapshotSha256: publishedSnapshotSha256,
      publishedSnapshot: publication.published
    },
    switchMode: "validated-no-business-parameter-change",
    sourceDraft: {
      draftId: publication.draft.draftId,
      basedOnVersion: publication.draft.basedOnVersion,
      proposedVersion: publication.draft.proposedVersion,
      validationStatus: publication.validation.validationStatus,
      validatedAt: VALIDATED_AT,
      publishedAt: PUBLISHED_AT
    },
    invariants: {
      indicatorCount: 15,
      factorCount: 6,
      riskTierCount: 4,
      businessParametersChanged: false,
      draftRunnable: false,
      owner: "财务公司"
    }
  };
  const pointerSha256 = jsonSha256(pointer);

  const enterprises = joinEvaluationInputs(formalCandidate, humanInput);
  const portfolio = scoreEngine.evaluatePortfolio(
    {
      ...formalCandidate,
      fixtureId: formalCandidate.dataAssetId,
      enterprises
    },
    publication.published,
    {
      ...scenarioContext,
      assessmentAt: formalCandidate.assessmentAt,
      currency: formalCandidate.currency,
      amountUnit: formalCandidate.amountUnit,
      dataVersion: formalCandidate.dataAssetVersion,
      manualInputVersion: humanInput.snapshotVersion,
      publishedVersion: publication.published.packageVersion,
      resultVersion: "1.0.0"
    }
  );
  if (portfolio.enterpriseCount !== 21 || portfolio.results.some((result) => result.indicatorResults.length !== 15)) {
    fail("CP03评分结果不完整");
  }
  const c035Results = portfolio.results.map(compactC035Result);
  const dispositionCandidates = assertNoAutomaticDecisionSideEffects(c035Results);

  const resultSet = {
    schemaVersion: "ofw.s003.c035.risk-result-set.v1",
    contractId: "C035",
    resultSetId: "S003-C035-RISK-RESULTS-20251231-v1",
    resultSetVersion: "1.0.0",
    status: "published-results",
    immutable: true,
    formedAt: FORMED_AT,
    owner: "M01 本体管理",
    businessOwner: "财务公司",
    scenarioIdentity: scenarioContext,
    assessmentAt: formalCandidate.assessmentAt,
    currency: formalCandidate.currency,
    amountUnit: formalCandidate.amountUnit,
    modelPointer: {
      pointerId: pointer.pointerId,
      pointerVersion: pointer.pointerVersion,
      pointerRef: OUTPUT_REFS[0],
      pointerSha256
    },
    inputIdentity: {
      dataAssetId: formalCandidate.dataAssetId,
      dataAssetVersion: formalCandidate.dataAssetVersion,
      humanInputSnapshotId: humanInput.snapshotId,
      humanInputSnapshotVersion: humanInput.snapshotVersion,
      qualityResultId: qualityResult.qualityResultId
    },
    enterpriseCount: c035Results.length,
    summary: portfolio.summary,
    resultIds: c035Results.map((result) => result.resultId),
    results: c035Results
  };
  const resultSetSha256 = jsonSha256(resultSet);

  const factSet = {
    schemaVersion: "ofw.s003.published-risk-fact-set.v1",
    factSetId: "S003-PUBLISHED-RISK-FACTS-20251231-v1",
    factSetVersion: "1.0.0",
    status: "published",
    immutable: true,
    formedAt: FORMED_AT,
    owner: "M01 本体管理",
    scenarioIdentity: scenarioContext,
    assessmentAt: formalCandidate.assessmentAt,
    contracts: {semanticPublication: "C008", authoritativeDistribution: "T019", resultContract: "C035"},
    sourceResultSet: {
      resultSetId: resultSet.resultSetId,
      resultSetVersion: resultSet.resultSetVersion,
      resourceRef: OUTPUT_REFS[2],
      sha256: resultSetSha256
    },
    factCount: portfolio.publishedFacts.length,
    facts: portfolio.publishedFacts
  };
  const factSetSha256 = jsonSha256(factSet);

  const evaluationRun = {
    schemaVersion: "ofw.s003.m01.evaluation-run.v1",
    evaluationRunId: "S003-M01-EVALUATION-RUN-20260815-001",
    evaluationRunVersion: "1.0.0",
    status: "succeeded",
    immutable: true,
    runMode: "first-formal-evaluation",
    startedAt: FORMED_AT,
    completedAt: FORMED_AT,
    owner: "M01 本体管理",
    businessOwner: "财务公司",
    scenarioIdentity: scenarioContext,
    sourceScenarioRunId: previousCheckpoint.scenarioContext.scenarioRunId,
    newScenarioRunCreated: true,
    assessmentAt: formalCandidate.assessmentAt,
    deterministic: true,
    idempotencyKey: sha256(Buffer.from([
      scenarioContext.scenarioRunId,
      pointerSha256,
      inputHashes.formalCandidateSha256,
      inputHashes.humanInputSha256,
      formalCandidate.assessmentAt
    ].join("|"), "utf8")),
    inputs: {
      publishedPointer: {ref: OUTPUT_REFS[0], sha256: pointerSha256},
      formalCandidate: {id: formalCandidate.dataAssetId, version: formalCandidate.dataAssetVersion, ref: refs.formalCandidate, sha256: inputHashes.formalCandidateSha256},
      humanInput: {id: humanInput.snapshotId, version: humanInput.snapshotVersion, ref: refs.humanInput, sha256: inputHashes.humanInputSha256},
      qualityResult: {id: qualityResult.qualityResultId, ref: refs.qualityResult, sha256: inputHashes.qualityResultSha256}
    },
    outputs: {
      c035Results: {id: resultSet.resultSetId, version: resultSet.resultSetVersion, ref: OUTPUT_REFS[2], sha256: resultSetSha256},
      publishedFacts: {id: factSet.factSetId, version: factSet.factSetVersion, ref: OUTPUT_REFS[3], sha256: factSetSha256}
    },
    counts: {
      enterprisesEvaluated: c035Results.length,
      c035Results: c035Results.length,
      publishedFacts: portfolio.publishedFacts.length,
      dispositionCandidates: dispositionCandidates.length,
      actionRequestsCreated: 0,
      todosCreated: 0,
      notificationsDispatched: 0,
      reportsGenerated: 0
    },
    sideEffectPolicy: {
      dispositionCandidatesOnly: true,
      requiresHumanConfirmation: true,
      automaticActionRequestCreation: false,
      automaticTodoCreation: false,
      externalDispatch: false
    }
  };
  const evaluationRunSha256 = jsonSha256(evaluationRun);

  const runtimeExport = {
    schemaVersion: "ofw.s003.m01.runtime-export.v1",
    runtimeExportId: "S003-M01-RUNTIME-EXPORT-20260815-001",
    runtimeExportVersion: "1.0.0",
    status: "published-readonly-projection",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: scenarioContext,
    assessmentAt: formalCandidate.assessmentAt,
    authority: {
      publishedPointer: {ref: OUTPUT_REFS[0], sha256: pointerSha256},
      evaluationRun: {ref: OUTPUT_REFS[1], sha256: evaluationRunSha256},
      c035Results: {ref: OUTPUT_REFS[2], sha256: resultSetSha256},
      publishedFacts: {ref: OUTPUT_REFS[3], sha256: factSetSha256}
    },
    workbenchProjection: {
      summary: portfolio.summary,
      enterpriseRows: c035Results.map((result) => ({
        enterpriseId: result.enterprise.enterpriseId,
        enterpriseName: result.enterprise.name,
        sector: result.enterprise.sector,
        category: result.enterprise.category,
        rawScore: result.rawScore,
        factorSum: result.factorSum,
        finalScore: result.finalScore,
        riskTier: result.riskTier,
        lowestThree: result.lowestThree,
        factorStates: result.factorStates,
        markerCount: result.markers.length,
        dispositionCandidateIds: result.dispositionCandidates.map((candidate) => candidate.candidateId),
        c035ResultId: result.resultId,
        reportStatus: result.reportLifecycle.status
      })),
      dispositionCandidates
    },
    consumptionPolicy: {
      readOnly: true,
      consumers: ["M03 智能问数", "M04 决策中心", "M06 报告中心"],
      directRecalculationForbidden: true,
      actionRequestRequiresHumanConfirmation: true,
      formalReportNotIncludedAtCp03: true
    }
  };
  const runtimeExportSha256 = jsonSha256(runtimeExport);

  const assets = new Map([
    [OUTPUT_REFS[0], pointer],
    [OUTPUT_REFS[1], evaluationRun],
    [OUTPUT_REFS[2], resultSet],
    [OUTPUT_REFS[3], factSet],
    [OUTPUT_REFS[4], runtimeExport]
  ]);
  const digests = Object.fromEntries(Array.from(assets, ([ref, value]) => [ref, jsonSha256(value)]));
  if (digests[OUTPUT_REFS[4]] !== runtimeExportSha256) fail("runtime export哈希计算不一致");

  const evidence = [
    "# CP03 Published 切换与首次正式评估验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 新场景运行：\`${scenarioContext.scenarioRunId}\``,
    `- 来源运行：\`${previousCheckpoint.scenarioContext.scenarioRunId}\``,
    `- Published 模型：\`${publication.published.packageId}@${publication.published.packageVersion}\``,
    `- 评估时点：\`${formalCandidate.assessmentAt}\``,
    "",
    "## Published 生命周期",
    "",
    "- 从既有 Published 1.0.0 创建 Draft，经校验后发布为 1.0.1。",
    "- 本次为正式化切换，不改变15项指标、权重、六项因子、风险阈值和 Action Type 业务参数。",
    `- Published 快照 SHA-256：\`${publishedSnapshotSha256}\`。`,
    "",
    "## 首次正式评估",
    "",
    `- 评估企业：${c035Results.length} 家；C035 结果：${c035Results.length} 条；Published 事实：${portfolio.publishedFacts.length} 条。`,
    `- 风险分布：绿 ${portfolio.summary.riskTierCounts.GREEN}、黄 ${portfolio.summary.riskTierCounts.YELLOW}、红 ${portfolio.summary.riskTierCounts.RED}、黑 ${portfolio.summary.riskTierCounts.BLACK}。`,
    `- 处置候选：${dispositionCandidates.length} 条；Action Request：0；负责人待办：0；通知：0。`,
    "- 所有处置候选均保持待人工确认状态，未触发外部副作用。",
    "- CP03 尚未生成正式企业报告，报告由后续 M06 节点消费 C035/T019 形成。",
    "",
    "## 资源哈希",
    "",
    ...OUTPUT_REFS.map((ref) => `- \`${digests[ref]}  ${ref}\``),
    "",
    "## 恢复与重放边界",
    "",
    "- 本轮使用独立 scenarioRunId，未覆盖 CP01/CP02 运行身份。",
    "- 历史查看只读；恢复或回归必须克隆到新的 scenarioRunId。",
    "- 历史处置候选不得自动重放为 Action Request、通知或待办。",
    ""
  ].join("\n");

  return {
    scenarioContext,
    publication,
    portfolio,
    assets,
    digests,
    evidence,
    evidenceSha256: sha256(Buffer.from(evidence, "utf8"))
  };
}

function sidecarContent(ref, digest) {
  return `${digest}  ${path.basename(ref)}\n`;
}

function writeOrVerifyFile(ref, content, mode) {
  const outputPath = resolvePackageRef(ref);
  const digest = sha256(Buffer.from(content, "utf8"));
  if (mode === "dry-run") return digest;
  if (fs.existsSync(outputPath)) {
    const current = fs.readFileSync(outputPath, "utf8");
    if (current !== content) fail(`不可变资源已存在但内容不同: ${ref}`);
  } else {
    if (mode === "check") fail(`待校验资源不存在: ${ref}`);
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    fs.writeFileSync(outputPath, content, {flag: "wx"});
  }
  const sidecarRef = `${ref}.sha256`;
  const sidecarPath = resolvePackageRef(sidecarRef);
  const expectedSidecar = sidecarContent(ref, digest);
  if (fs.existsSync(sidecarPath)) {
    if (fs.readFileSync(sidecarPath, "utf8") !== expectedSidecar) fail(`SHA sidecar不匹配: ${sidecarRef}`);
  } else {
    if (mode === "check") fail(`SHA sidecar不存在: ${sidecarRef}`);
    fs.writeFileSync(sidecarPath, expectedSidecar, {flag: "wx"});
  }
  return digest;
}

function materializePublishedAssets(mode) {
  const build = buildPublishedAssets();
  for (const [ref, value] of build.assets) {
    const digest = writeOrVerifyFile(ref, serializeJson(value), mode);
    if (digest !== build.digests[ref]) fail(`写入前后哈希不一致: ${ref}`);
  }
  const evidenceDigest = writeOrVerifyFile(EVIDENCE_REF, build.evidence, mode);
  return {...build, evidenceDigest};
}

function main() {
  const flag = process.argv[2];
  const mode = flag === "--dry-run" ? "dry-run" : flag === "--check" ? "check" : "write";
  if (flag && !["--dry-run", "--check"].includes(flag)) fail(`未知参数: ${flag}`);
  const build = materializePublishedAssets(mode);
  process.stdout.write(`${build.scenarioContext.scenarioRunId}\n`);
  for (const ref of OUTPUT_REFS) process.stdout.write(`${build.digests[ref]}  ${ref}\n`);
  process.stdout.write(`${build.evidenceDigest}  ${EVIDENCE_REF}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  FORMED_AT,
  OUTPUT_REFS,
  EVIDENCE_REF,
  serializeJson,
  sha256,
  jsonSha256,
  buildScenarioContext,
  buildPublishedAssets,
  materializePublishedAssets
});
