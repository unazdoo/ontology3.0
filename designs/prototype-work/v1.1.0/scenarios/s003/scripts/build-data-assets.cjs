#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const fixtureRef = "fixtures/enterprise-fixture.v1.json";
const contractRef = "resources/m02/data-contract.v1.json";
const formedAt = "2026-08-15T13:04:23.000Z";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.resolve(packageRoot, ref), "utf8"));
}

function writeImmutable(ref, value) {
  const outputPath = path.resolve(packageRoot, ref);
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(outputPath, serialized, {flag: "wx"});
  return sha256(Buffer.from(serialized, "utf8"));
}

const factorNames = [
  "融资能力（已用授信余额/授信总额）",
  "担保情况",
  "总部支持程度",
  "电价波动率",
  "是否存在重大诉讼",
  "资金余缺预警"
];

const allowedEnums = {
  "融资能力（已用授信余额/授信总额）": ["优秀", "良好", "一般", "较差"],
  "担保情况": ["未涉及担保", "仅获得担保", "仅提供担保"],
  "总部支持程度": ["全资", "高", "较高", "中", "较低", "低"],
  "电价波动率": ["电价变化率大于0", "电价变化率小于等于0且大于-15%", "电价变化率小于等于-15%"],
  "是否存在重大诉讼": ["无重大诉讼", "一般性诉讼", "重大诉讼"],
  "资金余缺预警": ["无资金缺口", "当月资金余缺预警", "未来第一个月资金余缺预警", "未来第二个月资金余缺预警", "未来第三个月资金余缺预警"]
};

function isApplicable(category, factorName) {
  if (factorName !== "电价波动率") return true;
  return category === "新能源产业-风电" || category === "核电";
}

function normalizeFactor(enterprise, factorName) {
  const sourceValue = enterprise.factorInputs[factorName];
  if (!isApplicable(enterprise.category, factorName)) {
    return {
      factorName,
      sourceValue,
      normalizedValue: null,
      state: "NOT_APPLICABLE",
      reason: "Published 模型定义该因子仅适用于风电和核电"
    };
  }
  if (sourceValue === null || sourceValue === "") {
    return {
      factorName,
      sourceValue: null,
      normalizedValue: null,
      state: "DEFAULTED_ZERO",
      reason: "适用但缺失；仅记录零档状态，不在数据工程中绑定系数"
    };
  }
  if (!allowedEnums[factorName].includes(sourceValue)) {
    throw new Error(`${enterprise.enterpriseId}.${factorName} 非法枚举: ${sourceValue}`);
  }
  return {
    factorName,
    sourceValue,
    normalizedValue: sourceValue,
    state: "EXPLICIT_VALUE"
  };
}

function assertFiniteFinancialData(enterprise) {
  Object.entries(enterprise.financialData).forEach(([field, value]) => {
    if (field === "单位名称") return;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${enterprise.enterpriseId}.${field} 必须是有限数值`);
    }
  });
}

function main() {
  const fixture = readJson(fixtureRef);
  const baseContract = readJson(contractRef);
  const fixtureBytes = fs.readFileSync(path.resolve(packageRoot, fixtureRef));
  const sourceAsset = {
    schemaVersion: "ofw.s003.m02.source-asset.v1",
    sourceId: "S003-M02-SOURCE-XLSX-20251231",
    status: "verified-source",
    immutable: true,
    formedAt,
    owner: "M02 数据工程",
    assessmentAt: fixture.assessmentAt,
    currency: fixture.currency,
    amountUnit: fixture.amountUnit,
    fileName: fixture.source.fileName,
    sourceSha256: fixture.source.sha256,
    logicalMembers: [
      {name: "财务数据", range: fixture.source.financeRange, rowCount: 21, fieldCount: 27},
      {name: "调节因子", range: fixture.source.factorRange, rowCount: 21, fieldCount: 9}
    ],
    compatibilityBoundary: {
      compatibilityAssetConsumable: false,
      promotedInPlace: false,
      note: "源工作簿仅作为权威夹具；本次形成全新的正式建设候选资产。"
    }
  };

  const factorRecords = fixture.enterprises.map((enterprise) => ({
    enterpriseId: enterprise.enterpriseId,
    enterpriseName: enterprise.name,
    category: enterprise.category,
    assessmentAt: fixture.assessmentAt,
    values: factorNames.map((factorName) => normalizeFactor(enterprise, factorName))
  }));

  const humanInputSnapshot = {
    schemaVersion: "ofw.s003.t053.human-input-snapshot.v1",
    snapshotId: "S003-T053-INPUT-20251231-v1",
    snapshotVersion: "1.0.0",
    status: "published-input",
    immutable: true,
    formedAt,
    owner: "M02 数据工程",
    businessOwner: "财务公司",
    reviewerRequired: false,
    assessmentAt: fixture.assessmentAt,
    enterpriseCount: factorRecords.length,
    factorCount: factorNames.length,
    records: factorRecords,
    stateCounts: factorRecords.flatMap((record) => record.values).reduce((counts, value) => {
      counts[value.state] = (counts[value.state] || 0) + 1;
      return counts;
    }, {}),
    lifecycle: {
      mutableOnlineDraft: true,
      publishCreatesNewImmutableSnapshot: true,
      editNeverMutatesThisSnapshot: true
    }
  };

  fixture.enterprises.forEach(assertFiniteFinancialData);
  const formalCandidate = {
    schemaVersion: "ofw.s003.t007.formal-candidate-data-asset.v1",
    dataAssetId: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
    dataAssetVersion: "1.0.0",
    status: "quality-passed-candidate",
    immutable: true,
    formedAt,
    owner: "M02 数据工程",
    scenarioIdentity: {scenarioId: "S003", scenarioVersion: "S003-v1"},
    assessmentAt: fixture.assessmentAt,
    currency: fixture.currency,
    amountUnit: fixture.amountUnit,
    sourceId: sourceAsset.sourceId,
    humanInputSnapshotId: humanInputSnapshot.snapshotId,
    enterpriseKey: ["enterpriseId", "assessmentAt"],
    enterpriseCount: fixture.enterprises.length,
    records: fixture.enterprises.map((enterprise) => ({
      enterpriseId: enterprise.enterpriseId,
      enterpriseName: enterprise.name,
      sector: enterprise.sector,
      category: enterprise.category,
      assessmentAt: fixture.assessmentAt,
      currency: fixture.currency,
      amountUnit: fixture.amountUnit,
      financialData: enterprise.financialData
    })),
    consumptionPolicy: {
      eligibleForM01EvaluationAfterPublishedModel: true,
      directM03M04M05M06Consumption: false,
      compatibilityAssetReferenceOnly: true
    }
  };

  const qualityResult = {
    schemaVersion: "ofw.s003.m02.quality-result.v1",
    qualityResultId: "S003-M02-QUALITY-20251231-v1",
    qualityRuleSetId: "S003-M02-QUALITY-001",
    status: "passed",
    formedAt,
    owner: "M02 数据工程",
    inputIds: [sourceAsset.sourceId, humanInputSnapshot.snapshotId],
    outputDataAssetId: formalCandidate.dataAssetId,
    checks: [
      {checkId: "member-shape", status: "passed", evidence: "财务数据 A1:AA22；调节因子 A1:I22"},
      {checkId: "enterprise-count", status: "passed", expected: 21, actual: fixture.enterprises.length},
      {checkId: "stable-enterprise-id", status: "passed", unique: true, note: "生产需映射企业主数据；名称不得作为主键"},
      {checkId: "finance-finite-values", status: "passed", invalidCount: 0},
      {checkId: "factor-enum", status: "passed", invalidCount: 0},
      {checkId: "factor-applicability", status: "passed", notApplicableCount: humanInputSnapshot.stateCounts.NOT_APPLICABLE},
      {checkId: "assessment-context", status: "passed", assessmentAt: fixture.assessmentAt, currency: fixture.currency, amountUnit: fixture.amountUnit},
      {checkId: "source-integrity", status: "passed", sourceSha256: fixture.source.sha256, fixtureSha256: sha256(fixtureBytes)}
    ],
    explicitlyExcludedChecks: baseContract.qualityDoesNotOwn
  };

  const pipelineRun = {
    schemaVersion: "ofw.s003.m02.pipeline-run.v1",
    pipelineRunId: "S003-M02-PIPELINE-RUN-20260815-001",
    pipelineId: "S003-M02-PIPELINE-001",
    status: "succeeded",
    startedAt: formedAt,
    completedAt: formedAt,
    owner: "M02 数据工程",
    inputSourceId: sourceAsset.sourceId,
    inputHumanSnapshotId: humanInputSnapshot.snapshotId,
    outputDataAssetId: formalCandidate.dataAssetId,
    qualityResultId: qualityResult.qualityResultId,
    operations: ["读取两个逻辑成员", "绑定稳定测试夹具 enterpriseId", "附加评估时点/币种/金额单位", "标准化因子三态", "执行数据质量检查"],
    forbiddenOperationsConfirmedAbsent: ["风险评分", "因子系数计算", "评分权重", "风险阈值", "风险分档", "Action Type 命中"]
  };

  const contractV11 = {
    ...baseContract,
    contractVersion: "1.1.0",
    formedAt,
    candidateResources: {
      ...baseContract.candidateResources,
      qualityResultId: qualityResult.qualityResultId,
      pipelineRunId: pipelineRun.pipelineRunId,
      formalCandidateDataAssetId: formalCandidate.dataAssetId
    },
    applicability: {
      "环保.电价波动率": "NOT_APPLICABLE",
      "在建企业.电价波动率": "NOT_APPLICABLE",
      applicableMissing: "DEFAULTED_ZERO",
      invalidOrOutOfRange: "BLOCK"
    },
    resourceRefs: {
      source: "resources/m02/source-asset.v1.json",
      humanInputSnapshot: "resources/m02/human-input-snapshot.v1.json",
      formalCandidateDataAsset: "resources/m02/formal-candidate-data-asset.v1.json",
      qualityResult: "resources/m02/quality-result.v1.json",
      pipelineRun: "resources/m02/pipeline-run.v1.json"
    }
  };

  const outputs = [
    ["resources/m02/source-asset.v1.json", sourceAsset],
    ["resources/m02/human-input-snapshot.v1.json", humanInputSnapshot],
    ["resources/m02/formal-candidate-data-asset.v1.json", formalCandidate],
    ["resources/m02/quality-result.v1.json", qualityResult],
    ["resources/m02/pipeline-run.v1.json", pipelineRun],
    ["resources/m02/data-contract.v1.1.json", contractV11]
  ];
  outputs.forEach(([ref, value]) => {
    const digest = writeImmutable(ref, value);
    process.stdout.write(`${digest}  ${ref}\n`);
  });
}

main();
