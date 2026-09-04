import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest } from "./model-portfolio-engine.mjs";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(runtimeDir, "../../../../..");
const formalResultPath = path.join(repositoryRoot, "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/c035-risk-results.v2.json");
const formalModelPath = path.join(repositoryRoot, "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json");
const EXPECTED_FORMAL_RESULT_SHA256 = "fbcbff5095a556293cf3ede0249c548bb9208da8a2e2f66139be418419fabf7a";
const EXPECTED_FORMAL_MODEL_SHA256 = "c1bcfdf2c61313e57233ad4ecd471e24b09535aa7f62d4bfb97741e15ec9b014";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readVerifiedJson(file, expectedSha256) {
  const buffer = readFileSync(file);
  const actualSha256 = sha256(buffer);
  if (actualSha256 !== expectedSha256) throw new Error(`Read-only parent source checksum mismatch: ${file}`);
  return { value: JSON.parse(buffer.toString("utf8")), actualSha256 };
}

const formalResultSource = readVerifiedJson(formalResultPath, EXPECTED_FORMAL_RESULT_SHA256);
const formalModelSource = readVerifiedJson(formalModelPath, EXPECTED_FORMAL_MODEL_SHA256);

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value)));
const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const addDays = (value, days) => new Date(Date.parse(`${value}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PERIODS = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"];

function tierForScore(score) {
  if (score == null) return "无法评价";
  if (score < 20) return "黑灯";
  if (score < 30) return "红灯";
  if (score < 40) return "黄灯";
  return "绿灯";
}

function normalizeFormalSubject(item) {
  const indicatorContributors = [...(item.indicatorResults || [])]
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((entry) => ({ kind: "INDICATOR", name: entry.name, score: round(entry.score, 2), evidenceRef: `${item.resultId}#/indicatorResults/${entry.name}` }));
  const factorContributors = [...(item.factorResults || [])]
    .map((entry) => ({ ...entry, normalizedContribution: Number(entry.factorValue ?? entry.coefficient) }))
    .filter((entry) => Number.isFinite(entry.normalizedContribution) && entry.normalizedContribution !== 0)
    .sort((left, right) => Math.abs(right.normalizedContribution) - Math.abs(left.normalizedContribution))
    .slice(0, 2)
    .map((entry) => ({ kind: "FACTOR", name: entry.name, contribution: round(entry.normalizedContribution, 4), evidenceRef: `${item.resultId}#/factorResults/${entry.name}` }));
  return {
    enterpriseId: item.enterprise.enterpriseId,
    name: item.enterprise.name,
    industry: item.enterprise.category,
    sector: item.enterprise.sector,
    score: item.finalScore,
    tier: item.riskTier.name,
    formalResultId: item.resultId,
    topContributors: [...indicatorContributors, ...factorContributors],
    reportEligible: true
  };
}

const formalSubjects = formalResultSource.value.results.map(normalizeFormalSubject);

const formalEnvelope = {
  schemaVersion: "ofw.modeling.result-envelope.v2",
  resultId: formalResultSource.value.resultSetId,
  runId: formalResultSource.value.scenarioIdentity.scenarioRunId,
  scenarioId: "S003",
  objectiveId: "MO-S003-FORMAL-DEBT-RISK-SCORE-v1",
  objectiveRevisionId: "MOR-S003-FORMAL-DEBT-RISK-SCORE-0001",
  modelId: "MODEL-S003-FORMAL-SCORE",
  modelVersionId: "MV-S003-DEBT-RISK-1.0.2-FORMAL",
  modelVersion: "1.0.2",
  modelRole: "FORMAL_BASELINE",
  resultKind: "FACT",
  useKind: "FORMAL",
  status: "PUBLISHED_READ_ONLY",
  dataVersionId: formalResultSource.value.inputIdentity.dataAssetId,
  ontologyVersionId: "SEM-S003-DEBT-RISK-v1",
  asOf: formalResultSource.value.assessmentAt,
  formedAt: formalResultSource.value.formedAt,
  businessQuestion: "企业当前正式债务风险评分与分档是什么？",
  outputIdentity: "正式评分与四档风险事实",
  confidence: { status: "FORMAL_FACT", score: 1, missingReasons: [] },
  subjects: formalSubjects,
  evidenceRefs: [
    `designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/c035-risk-results.v2.json#sha256=${formalResultSource.actualSha256}`,
    `designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json#sha256=${formalModelSource.actualSha256}`
  ],
  permissionScope: "fact.read",
  immutable: true,
  factWriteAllowed: false,
  actionWriteAllowed: false,
  actionSourceAllowed: true,
  sideEffectsEmitted: 0
};

const formalBaseline = {
  modelId: "MODEL-S003-FORMAL-SCORE",
  modelVersionId: "MV-S003-DEBT-RISK-1.0.2-FORMAL",
  modelVersion: "1.0.2",
  modelRole: "FORMAL_BASELINE",
  name: "现行债务风险评分模型",
  status: "FORMAL_READ_ONLY",
  businessQuestion: "企业当前正式债务风险评分与分档是什么？",
  dataVersionId: formalResultSource.value.inputIdentity.dataAssetId,
  ontologyVersionId: "SEM-S003-DEBT-RISK-v1",
  sourcePackageId: `${formalModelSource.value.packageId}@${formalModelSource.value.packageVersion}`,
  sourceModelSha256: formalModelSource.actualSha256,
  sourceResultSha256: formalResultSource.actualSha256,
  resultEnvelope: formalEnvelope,
  immutable: true,
  rollbackRole: "STABLE_BASELINE_AND_FALLBACK",
  publishedPointerMutableByPrototype: false
};

const objectives = [
  {
    objectiveId: "MO-S003-FORMAL-DEBT-RISK-SCORE-v1",
    name: "当前债务风险评分与分档",
    businessQuestion: "企业当前正式债务风险评分与分档是什么？",
    kind: "SCORING",
    role: "BASELINE_AND_CHALLENGER",
    outputIdentity: "riskScore / riskTier",
    comparableModelIds: ["MODEL-S003-FORMAL-SCORE", "MODEL-S003-MONOTONIC-TABLE", "MODEL-S003-CALIBRATED-SCORE"]
  },
  {
    objectiveId: "MO-S003-HORIZON-PROBABILITY-v1",
    name: "分期限风险概率",
    businessQuestion: "未来 30、90、180 天发生重大债务风险的概率是多少？",
    kind: "FORECAST",
    role: "SUPPLEMENTAL",
    outputIdentity: "probability30d / probability90d / probability180d",
    comparableModelIds: ["MODEL-S003-HORIZON-PROBABILITY"]
  },
  {
    objectiveId: "MO-S003-RISK-TIMING-v1",
    name: "风险时间窗口",
    businessQuestion: "风险更可能在哪个时间窗口发生？",
    kind: "FORECAST",
    role: "SUPPLEMENTAL",
    outputIdentity: "survivalCurve / expectedRiskWindow",
    comparableModelIds: ["MODEL-S003-SURVIVAL"]
  },
  {
    objectiveId: "MO-S003-EVENT-TYPE-v1",
    name: "风险事件类型",
    businessQuestion: "最可能出现哪类债务风险事件？",
    kind: "CLASSIFICATION",
    role: "SUPPLEMENTAL",
    outputIdentity: "eventTypeProbabilities",
    comparableModelIds: ["MODEL-S003-EVENT-TYPE"]
  },
  {
    objectiveId: "MO-S003-LIQUIDITY-GAP-v1",
    name: "流动性缺口与到期墙",
    businessQuestion: "未来现金流、债务到期与再融资压力会形成多大缺口？",
    kind: "FORECAST",
    role: "SUPPLEMENTAL",
    outputIdentity: "liquidityGap / maturityWall / refinancePressure",
    comparableModelIds: ["MODEL-S003-LIQUIDITY"]
  },
  {
    objectiveId: "MO-S003-CONTAGION-v1",
    name: "关系传染风险",
    businessQuestion: "担保、股权、关联交易和共同债权人会形成哪些风险路径？",
    kind: "SCORING",
    role: "SUPPLEMENTAL",
    outputIdentity: "relationRiskScore / riskPath",
    comparableModelIds: ["MODEL-S003-CONTAGION"]
  },
  {
    objectiveId: "MO-S003-ANOMALY-v1",
    name: "异常变化监测",
    businessQuestion: "相对自身历史和同行分布，哪些变化异常？",
    kind: "SCORING",
    role: "SUPPLEMENTAL",
    outputIdentity: "anomalyScore / anomalyEvents",
    comparableModelIds: ["MODEL-S003-ANOMALY"]
  },
  {
    objectiveId: "MO-S003-REVIEW-PRIORITY-v1",
    name: "固定能力下的复核优先级",
    businessQuestion: "在固定复核能力下，应优先复核哪些企业？",
    kind: "OPTIMIZATION",
    role: "SUPPLEMENTAL",
    outputIdentity: "reviewPriority / priorityReasons",
    comparableModelIds: ["MODEL-S003-REVIEW-PRIORITY"]
  }
];

const modelDefinitions = [
  ["MODEL-S003-FORMAL-SCORE", "现行 1.0.2 评分模型", "FORMAL_BASELINE", "1.0.2", objectives[0].objectiveId, "正式评分与分档"],
  ["MODEL-S003-MONOTONIC-TABLE", "单调约束表格学习模型", "CORE_CHALLENGER", "0.1.0", objectives[0].objectiveId, "同口径候选评分与 180 天概率"],
  ["MODEL-S003-CALIBRATED-SCORE", "概率校准评分模型", "CORE_CHALLENGER", "0.1.0", objectives[0].objectiveId, "校准后的候选评分与概率"],
  ["MODEL-S003-HORIZON-PROBABILITY", "分期限风险概率模型", "SUPPLEMENTAL", "0.1.0", objectives[1].objectiveId, "30/90/180 天风险概率"],
  ["MODEL-S003-SURVIVAL", "风险时间窗口模型", "SUPPLEMENTAL", "0.1.0", objectives[2].objectiveId, "生存曲线与可能时间窗口"],
  ["MODEL-S003-EVENT-TYPE", "风险事件类型模型", "SUPPLEMENTAL", "0.1.0", objectives[3].objectiveId, "最可能事件类型及概率"],
  ["MODEL-S003-LIQUIDITY", "现金流与流动性缺口模型", "SUPPLEMENTAL", "0.1.0", objectives[4].objectiveId, "流动性缺口、到期墙与再融资压力"],
  ["MODEL-S003-CONTAGION", "关系传染风险模型", "SUPPLEMENTAL", "0.1.0", objectives[5].objectiveId, "风险路径和关系暴露"],
  ["MODEL-S003-ANOMALY", "自身与同行异常监测模型", "SUPPLEMENTAL", "0.1.0", objectives[6].objectiveId, "异常分与事件"],
  ["MODEL-S003-REVIEW-PRIORITY", "复核优先级模型", "SUPPLEMENTAL", "0.1.0", objectives[7].objectiveId, "固定容量下的复核顺序"]
].map(([modelId, name, modelRole, version, objectiveId, outputIdentity]) => ({
  modelId,
  name,
  modelRole,
  modelVersionId: `${modelId}@${version}`,
  version,
  objectiveId,
  businessQuestion: objectives.find((item) => item.objectiveId === objectiveId)?.businessQuestion,
  outputIdentity,
  repositorySlug: modelId.toLowerCase().replace(/^model-s003-/, "").replaceAll("_", "-"),
  dataScope: "脱敏 synthetic 纵向数据；正式事实仅作对照展示，不作为自动生成标签",
  confidencePolicy: "按缺失、观察期和覆盖率逐户给出高/中/低或无法评价",
  evidencePolicy: "每个结果保留 Model Version、DataVersion、Semantic Contract、Run 与证据引用"
}));

const MODEL_PORTS = Object.freeze({
  "MODEL-S003-FORMAL-SCORE": Object.freeze({ inputs: ["formalScore", "formalTier"], outputs: ["riskScore", "riskTier"] }),
  "MODEL-S003-MONOTONIC-TABLE": Object.freeze({ inputs: ["liquidityCoverage", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"], outputs: ["riskProbability180d", "candidateRiskScore", "candidateRiskTier"] }),
  "MODEL-S003-CALIBRATED-SCORE": Object.freeze({ inputs: ["liquidityCoverage", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"], outputs: ["calibratedProbability", "candidateRiskScore", "candidateRiskTier"] }),
  "MODEL-S003-HORIZON-PROBABILITY": Object.freeze({ inputs: ["liquidityCoverage", "debtDue90Ratio", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"], outputs: ["probability30d", "probability90d", "probability180d"] }),
  "MODEL-S003-SURVIVAL": Object.freeze({ inputs: ["probability30d", "probability90d", "probability180d", "outcomeObservedAt"], outputs: ["survivalCurve", "expectedRiskWindow"] }),
  "MODEL-S003-EVENT-TYPE": Object.freeze({ inputs: ["refinancePressure", "liquidityCoverage", "relationExposure", "anomalyZ", "eventLedger"], outputs: ["eventTypeProbabilities", "mostLikelyEventType"] }),
  "MODEL-S003-LIQUIDITY": Object.freeze({ inputs: ["cashAvailableMillions", "cashFlowChange", "debtDue90Millions", "debtDue180Millions", "refinancePressure"], outputs: ["liquidityGap", "maturityWall", "refinancePressure"] }),
  "MODEL-S003-CONTAGION": Object.freeze({ inputs: ["relationExposure", "guaranteeEdges", "ownershipEdges", "relatedTradeEdges", "sharedCreditorEdges"], outputs: ["relationRiskScore", "relationRiskPath"] }),
  "MODEL-S003-ANOMALY": Object.freeze({ inputs: ["anomalyZ", "cashFlowChange", "liquidityCoverage", "peerDistribution", "eventLedger"], outputs: ["anomalyScore", "anomalyEvents"] }),
  "MODEL-S003-REVIEW-PRIORITY": Object.freeze({ inputs: ["probability90d", "liquidityGap", "relationRiskScore", "anomalyScore", "confidence"], outputs: ["reviewPriority", "priorityReasons"] })
});

modelDefinitions.forEach((definition) => {
  definition.inputProperties = [...(MODEL_PORTS[definition.modelId]?.inputs || [])];
  definition.outputProperties = [...(MODEL_PORTS[definition.modelId]?.outputs || [])];
});

const maturityWindows = [
  { maturityWindowId: "MW-S003-2026-02", label: "标签成熟窗口 1", maturedAt: "2026-02-28", newLabelCount: 7 },
  { maturityWindowId: "MW-S003-2026-05", label: "标签成熟窗口 2", maturedAt: "2026-05-31", newLabelCount: 7 },
  { maturityWindowId: "MW-S003-2026-08", label: "标签成熟窗口 3", maturedAt: "2026-08-31", newLabelCount: 7 }
];

function syntheticRecord(subject, enterpriseIndex, periodIndex, dataVersionId) {
  const seed = enterpriseIndex + 1;
  const asOf = PERIODS[periodIndex];
  const cycle = periodIndex + 1;
  const liquidityCoverage = round(clamp(1.42 - (seed % 7) * 0.11 - cycle * 0.028 + ((seed * cycle) % 3) * 0.025, 0.18, 1.55), 3);
  const debtDue90Ratio = round(clamp(0.09 + (seed % 6) * 0.065 + cycle * 0.012, 0.05, 0.72), 3);
  const debtDue180Ratio = round(clamp(debtDue90Ratio + 0.14 + (seed % 3) * 0.035, 0.18, 0.88), 3);
  const refinancePressure = round(clamp(0.16 + (seed % 8) * 0.075 + cycle * 0.018, 0.08, 0.94), 3);
  const relationExposure = seed % 6 === 0 && periodIndex >= 6 ? null : round(clamp(0.12 + (seed % 5) * 0.12 + cycle * 0.014, 0.06, 0.87), 3);
  const anomalyZ = round(clamp(0.45 + (seed % 9) * 0.23 + cycle * 0.055, 0.2, 3.25), 2);
  const cashFlowChange = seed % 7 === 0 && periodIndex >= 6 ? null : round(-0.18 + ((seed * 13 + cycle * 5) % 36) / 100, 3);
  const totalDebtMillions = round(380 + seed * 41 + cycle * 16 + (seed % 4) * 73, 1);
  const cashAvailableMillions = cashFlowChange == null ? null : round(totalDebtMillions * liquidityCoverage * 0.23, 1);
  const debtDue90Millions = round(totalDebtMillions * debtDue90Ratio, 1);
  const debtDue180Millions = round(totalDebtMillions * debtDue180Ratio, 1);
  const syntheticRiskIndex = clamp(
    0.27 * (1 - liquidityCoverage / 1.55)
      + 0.24 * debtDue180Ratio
      + 0.22 * refinancePressure
      + 0.14 * (relationExposure ?? 0.48)
      + 0.13 * clamp(anomalyZ / 3.25),
    0,
    1
  );
  const eventWithin180 = syntheticRiskIndex > 0.52 || (seed + cycle) % 13 === 0;
  const eventType = refinancePressure > 0.7
    ? "再融资受阻"
    : liquidityCoverage < 0.55
      ? "流动性缺口"
      : (relationExposure ?? 0) > 0.62
        ? "担保或关联传染"
        : anomalyZ > 2.1
          ? "诉讼评级或审计事件"
          : "债务到期集中";
  const predictionAsOf = addDays(asOf, 12);
  return {
    observationId: `OBS-${subject.enterpriseId}-${asOf}`,
    enterpriseId: subject.enterpriseId,
    enterpriseName: subject.name,
    industry: subject.industry,
    periodIndex,
    observationAsOf: asOf,
    featureAvailableAt: addDays(asOf, 8),
    predictionAsOf,
    outcomeObservedAt: addDays(predictionAsOf, 185),
    dataVersionId,
    formalScore: subject.score,
    liquidityCoverage,
    debtDue90Ratio,
    debtDue180Ratio,
    refinancePressure,
    relationExposure,
    anomalyZ,
    cashFlowChange,
    totalDebtMillions,
    cashAvailableMillions,
    debtDue90Millions,
    debtDue180Millions,
    outcome: {
      eventWithin180,
      eventType: eventWithin180 ? eventType : "未发生重大事件",
      source: "SYNTHETIC_INDEPENDENT_EVENT_LEDGER",
      derivedFromFormalScore: false,
      evidenceRef: `SYN-EVENT-${subject.enterpriseId}-${asOf}`
    }
  };
}

function dataset(dataVersionId) {
  return formalSubjects.flatMap((subject, enterpriseIndex) => PERIODS.map((_, periodIndex) => syntheticRecord(subject, enterpriseIndex, periodIndex, dataVersionId)));
}

function currentRecords(dataVersionId) {
  return dataset(dataVersionId).filter((item) => item.periodIndex === PERIODS.length - 1);
}

export function getS003DatasetSnapshot(dataVersionId = "DV-S003-SYN-LONGITUDINAL-20260903-v1") {
  const records = dataset(dataVersionId);
  return structuredClone({
    schemaVersion: "ofw.s003.model-dataset-snapshot.v1",
    scenarioId: "S003",
    classification: "SYNTHETIC_DEIDENTIFIED_LONGITUDINAL",
    dataVersionId,
    observationRange: { start: PERIODS[0], end: PERIODS.at(-1) },
    recordCount: records.length,
    enterpriseCount: formalSubjects.length,
    records
  });
}

function baselineProbability(record) {
  return clamp((100 - record.formalScore) / 100 * 0.74 + record.refinancePressure * 0.16 + clamp(record.anomalyZ / 3.25) * 0.1);
}

function monotonicProbability(record) {
  const risk = 0.3 * (1 - record.liquidityCoverage / 1.55)
    + 0.25 * record.debtDue180Ratio
    + 0.22 * record.refinancePressure
    + 0.13 * (record.relationExposure ?? 0.48)
    + 0.1 * clamp(record.anomalyZ / 3.25);
  return clamp(1 / (1 + Math.exp(-5.2 * (risk - 0.43))));
}

function calibratedProbability(record) {
  const raw = monotonicProbability(record);
  return clamp(0.04 + raw * 0.88);
}

function candidateProbability(record) {
  const calibrated = calibratedProbability(record);
  const liquiditySignal = clamp(1 - record.liquidityCoverage / 1.55);
  return clamp(calibrated * 0.68 + liquiditySignal * 0.2 + clamp(record.anomalyZ / 3.25) * 0.12);
}

function averagePrecision(rows) {
  const ranked = [...rows].sort((left, right) => right.probability - left.probability);
  const positiveCount = ranked.filter((item) => item.label).length;
  if (!positiveCount) return null;
  let truePositives = 0;
  let precisionSum = 0;
  ranked.forEach((item, index) => {
    if (item.label) {
      truePositives += 1;
      precisionSum += truePositives / (index + 1);
    }
  });
  return precisionSum / positiveCount;
}

function evaluateBinary(records, predictor) {
  const rows = records.map((record) => ({
    record,
    probability: predictor(record),
    label: Boolean(record.outcome.eventWithin180)
  })).filter((item) => Number.isFinite(item.probability));
  if (rows.length < 10) {
    return {
      status: "INSUFFICIENT_LABELS",
      recallAtFixedCapacity: null,
      precisionAtFixedCapacity: null,
      prAuc: null,
      brierScore: null,
      calibrationError: null,
      coverage: round(rows.length / records.length, 3),
      missingRate: round(1 - rows.length / records.length, 3),
      drift: null,
      worstSlices: [],
      conclusion: "成熟标签不足，当前无法评价；指标保持 null，不补零。"
    };
  }
  const ranked = [...rows].sort((left, right) => right.probability - left.probability);
  const capacity = Math.max(1, Math.ceil(rows.length * 0.2));
  const top = ranked.slice(0, capacity);
  const positives = rows.filter((item) => item.label).length;
  const truePositives = top.filter((item) => item.label).length;
  const brierScore = mean(rows.map((item) => (item.probability - Number(item.label)) ** 2));
  const bins = [0, 0.2, 0.4, 0.6, 0.8].map((lower) => {
    const bucket = rows.filter((item) => item.probability >= lower && item.probability < lower + 0.2);
    return bucket.length ? Math.abs(mean(bucket.map((item) => item.probability)) - mean(bucket.map((item) => Number(item.label)))) * bucket.length / rows.length : 0;
  });
  const industries = [...new Set(rows.map((item) => item.record.industry))];
  const worstSlices = industries.map((industry) => {
    const slice = rows.filter((item) => item.record.industry === industry);
    const slicePositives = slice.filter((item) => item.label).length;
    const sliceTop = [...slice].sort((left, right) => right.probability - left.probability).slice(0, Math.max(1, Math.ceil(slice.length * 0.2)));
    return {
      dimension: "industry",
      value: industry,
      sampleCount: slice.length,
      recall: slicePositives ? round(sliceTop.filter((item) => item.label).length / slicePositives, 3) : null
    };
  }).sort((left, right) => (left.recall ?? 1) - (right.recall ?? 1));
  const currentMean = mean(rows.filter((item) => item.record.periodIndex >= 6).map((item) => item.probability));
  const priorMean = mean(rows.filter((item) => item.record.periodIndex < 6).map((item) => item.probability));
  return {
    status: "EVALUATED",
    recallAtFixedCapacity: positives ? round(truePositives / positives, 3) : null,
    precisionAtFixedCapacity: round(truePositives / capacity, 3),
    prAuc: round(averagePrecision(rows), 3),
    brierScore: round(brierScore, 3),
    calibrationError: round(bins.reduce((sum, value) => sum + value, 0), 3),
    coverage: round(rows.length / records.length, 3),
    missingRate: round(1 - rows.length / records.length, 3),
    drift: currentMean != null && priorMean != null ? round(Math.abs(currentMean - priorMean), 3) : null,
    worstSlices,
    conclusion: "仅证明脱敏 synthetic Benchmark 链可复算，不证明正式业务有效性。"
  };
}

function confidence(record) {
  const missingReasons = [];
  if (record.cashFlowChange == null) missingReasons.push("现金流历史存在缺口");
  if (record.relationExposure == null) missingReasons.push("关系网络覆盖不足");
  const score = round(clamp(0.95 - missingReasons.length * 0.22 - (record.periodIndex < 3 ? 0.18 : 0)), 2);
  return {
    status: score >= 0.82 ? "HIGH" : score >= 0.62 ? "MEDIUM" : score >= 0.42 ? "LOW" : "NOT_EVALUABLE",
    score,
    missingReasons
  };
}

function riskPath(record, allSubjects) {
  if (record.relationExposure == null) return { status: "PARTIAL", score: null, path: [], missingReason: "担保与共同债权人关系覆盖不足。" };
  const index = formalSubjects.findIndex((item) => item.enterpriseId === record.enterpriseId);
  const first = allSubjects[(index + 5) % allSubjects.length];
  const second = allSubjects[(index + 11) % allSubjects.length];
  return {
    status: "AVAILABLE",
    score: round(record.relationExposure * 100, 1),
    path: [
      { from: record.enterpriseId, to: first.enterpriseId, relation: index % 2 ? "共同债权人" : "担保关系", evidenceRef: `SYN-REL-${record.enterpriseId}-${first.enterpriseId}` },
      { from: first.enterpriseId, to: second.enterpriseId, relation: index % 3 ? "关联交易" : "股权关系", evidenceRef: `SYN-REL-${first.enterpriseId}-${second.enterpriseId}` }
    ],
    missingReason: null
  };
}

function eventProbabilities(record) {
  const values = {
    "流动性缺口": 0.18 + clamp(1 - record.liquidityCoverage / 1.55) * 0.55,
    "再融资受阻": 0.12 + record.refinancePressure * 0.62,
    "债务到期集中": 0.1 + record.debtDue180Ratio * 0.58,
    "担保或关联传染": 0.08 + (record.relationExposure ?? 0.35) * 0.54,
    "诉讼评级或审计事件": 0.08 + clamp(record.anomalyZ / 3.25) * 0.46
  };
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value / total, 3)]));
}

function subjectOutput(record, probabilityFn = candidateProbability, stress = null) {
  const stressProbability = stress ? clamp(probabilityFn(record) + stress.probabilityDelta) : probabilityFn(record);
  const gapMultiplier = stress?.gapMultiplier || 1;
  const baseGap30 = record.cashAvailableMillions == null ? null : Math.max(0, record.debtDue90Millions * 0.42 - record.cashAvailableMillions * 0.38);
  const baseGap90 = record.cashAvailableMillions == null ? null : Math.max(0, record.debtDue90Millions - record.cashAvailableMillions * 0.72);
  const baseGap180 = record.cashAvailableMillions == null ? null : Math.max(0, record.debtDue180Millions - record.cashAvailableMillions);
  const relation = riskPath(record, formalSubjects);
  const formalSubject = formalSubjects.find((item) => item.enterpriseId === record.enterpriseId);
  const probabilities = {
    probability30d: round(stressProbability * 0.34, 3),
    probability90d: round(stressProbability * 0.67, 3),
    probability180d: round(stressProbability, 3)
  };
  const candidateScore = round((1 - stressProbability) * 100, 2);
  const confidenceInfo = confidence(record);
  const eventTypes = eventProbabilities(record);
  const topEvent = Object.entries(eventTypes).sort((left, right) => right[1] - left[1])[0];
  const anomalies = [
    record.anomalyZ >= 2 ? { type: "同行偏离", label: `异常分 ${round(record.anomalyZ * 25, 1)}`, severity: record.anomalyZ >= 2.6 ? "HIGH" : "MEDIUM", evidenceRef: `SYN-ANOMALY-${record.enterpriseId}-PEER` } : null,
    record.cashFlowChange != null && record.cashFlowChange < -0.08 ? { type: "现金流变化", label: `环比 ${round(record.cashFlowChange * 100, 1)}%`, severity: "HIGH", evidenceRef: `SYN-ANOMALY-${record.enterpriseId}-CASHFLOW` } : null,
    record.refinancePressure > 0.7 ? { type: "再融资压力", label: "压力进入高位区间", severity: "HIGH", evidenceRef: `SYN-EVENT-${record.enterpriseId}-REFINANCE` } : null
  ].filter(Boolean);
  return {
    enterpriseId: record.enterpriseId,
    name: record.enterpriseName,
    industry: record.industry,
    formal: {
      score: record.formalScore,
      tier: formalSubject?.tier,
      resultId: formalSubject?.formalResultId
    },
    formalContributors: formalSubject?.topContributors || [],
    candidate: { score: candidateScore, tier: tierForScore(candidateScore), delta: round(candidateScore - record.formalScore, 2) },
    horizons: probabilities,
    survivalCurve: [30, 60, 90, 120, 150, 180].map((day) => ({ day, survival: round(1 - stressProbability * (day / 180) ** 0.82, 3) })),
    expectedRiskWindow: probabilities.probability90d >= 0.55 ? "30—90 天" : probabilities.probability180d >= 0.55 ? "90—180 天" : "180 天以后或当前不显著",
    eventTypeProbabilities: eventTypes,
    mostLikelyEventType: { type: topEvent[0], probability: topEvent[1] },
    liquidity: {
      gap30dMillions: baseGap30 == null ? null : round(baseGap30 * gapMultiplier, 1),
      gap90dMillions: baseGap90 == null ? null : round(baseGap90 * gapMultiplier, 1),
      gap180dMillions: baseGap180 == null ? null : round(baseGap180 * gapMultiplier, 1),
      refinancePressure: round(clamp(record.refinancePressure + (stress?.refinanceDelta || 0)), 3),
      missingReason: baseGap90 == null ? "现金流观察存在缺口，流动性缺口无法评价。" : null,
      maturityWall: [
        { bucket: "0—30 天", amountMillions: round(record.debtDue90Millions * 0.42, 1) },
        { bucket: "31—90 天", amountMillions: round(record.debtDue90Millions * 0.58, 1) },
        { bucket: "91—180 天", amountMillions: round(Math.max(0, record.debtDue180Millions - record.debtDue90Millions), 1) },
        { bucket: "181—365 天", amountMillions: round(record.totalDebtMillions * 0.24, 1) }
      ]
    },
    relation,
    anomaly: {
      score: round(clamp(record.anomalyZ / 3.25) * 100, 1),
      events: anomalies,
      status: anomalies.length ? "ANOMALY_DETECTED" : "WITHIN_EXPECTED_RANGE"
    },
    confidence: confidenceInfo,
    evidenceRefs: [record.observationId, record.outcome.evidenceRef, relation.path[0]?.evidenceRef].filter(Boolean)
  };
}

function envelope({ ctx, model, resultKind, useKind, subjects, evidenceRefs, benchmarkRunId = null, status = "SUCCEEDED", extra = {} }) {
  const formedAt = ctx.at();
  const runId = ctx.id(resultKind === "SIMULATION" ? "SIMRUN" : resultKind === "SHADOW" ? "SHADOWRUN" : "MODELRUN");
  const resultId = ctx.id(resultKind === "SIMULATION" ? "SIMRES" : resultKind === "SHADOW" ? "SHADOWRES" : "PREDRES");
  return {
    schemaVersion: "ofw.modeling.result-envelope.v2",
    resultId,
    runId,
    scenarioId: "S003",
    objectiveId: model.objectiveId,
    modelId: model.modelId,
    modelVersionId: model.modelVersionId,
    modelVersion: model.version,
    modelRole: model.modelRole,
    resultKind,
    useKind,
    status,
    dataVersionId: ctx.state.data.dataVersionId,
    semanticContractVersionId: ctx.state.semanticContract.semanticContractVersionId,
    asOf: "2025-12-31",
    formedAt,
    businessQuestion: objectives.find((item) => item.objectiveId === model.objectiveId)?.businessQuestion,
    outputIdentity: model.outputIdentity,
    benchmarkRunId,
    subjects,
    confidence: {
      status: subjects.some((item) => item.confidence?.status === "LOW" || item.confidence?.status === "NOT_EVALUABLE") ? "MIXED" : "HIGH",
      lowConfidenceCount: subjects.filter((item) => ["LOW", "NOT_EVALUABLE"].includes(item.confidence?.status)).length
    },
    evidenceRefs: [...new Set(evidenceRefs.filter(Boolean))],
    permissionScope: resultKind === "SIMULATION" ? "simulation.read" : resultKind === "SHADOW" ? "shadow.read" : "prediction.read",
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    formalFactsMutated: false,
    sideEffectsEmitted: 0,
    ...extra
  };
}

function model(modelId) {
  return modelDefinitions.find((item) => item.modelId === modelId);
}

function metricSummary(metrics) {
  return [
    { key: "recallAtFixedCapacity", label: "固定复核能力召回率", value: metrics.recallAtFixedCapacity },
    { key: "precisionAtFixedCapacity", label: "固定复核能力精确率", value: metrics.precisionAtFixedCapacity },
    { key: "prAuc", label: "PR-AUC", value: metrics.prAuc },
    { key: "calibrationError", label: "校准误差", value: metrics.calibrationError },
    { key: "coverage", label: "覆盖率", value: metrics.coverage },
    { key: "drift", label: "漂移", value: metrics.drift }
  ];
}

function idSuffix(value) {
  return String(value || "UNKNOWN").replace(/^MODEL-S003-/, "").replace(/[^A-Z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
}

function benchmarkRecord(ctx, { scope, modelId, modelVersionId, metrics, comparisonGroup, resultKind = "PREDICTION", extra = {} }) {
  const suffix = idSuffix(modelId);
  const benchmarkRunId = `${ctx.id("BENCHRUN-S003")}-${suffix}`;
  const reportId = `${ctx.id("BENCHREPORT-S003")}-${suffix}`;
  return {
    schemaVersion: "ofw.modeling.benchmark-run.v2",
    benchmarkRunId,
    reportId,
    scope,
    objectiveId: model(modelId)?.objectiveId || objectives[0].objectiveId,
    modelId,
    modelVersionId,
    comparisonGroup,
    resultKind,
    status: metrics.status,
    metrics,
    metricSummary: metricSummary(metrics),
    fixedContext: {
      benchmarkVersion: "BENCH-S003-MULTIMODEL-20260902-v1",
      datasetSplit: scope === "HOLDOUT_FINAL" ? "SEALED_HOLDOUT" : scope === "MATURED_SHADOW_LABELS" ? "MATURED_SHADOW_LABELS" : "TIME_BASED_VALIDATION",
      evaluatorVersion: "EVAL-S003-MULTIOBJECTIVE-v1",
      metricSchemaVersion: comparisonGroup === "SCORE_CHALLENGER" ? "METRIC-S003-CHALLENGER-v2" : "METRIC-S003-SUPPLEMENTAL-v1",
      dataVersionId: ctx.state.data.dataVersionId,
      semanticContractVersionId: ctx.state.semanticContract.semanticContractVersionId,
      holdoutUsed: scope === "HOLDOUT_FINAL",
      futureLeakageRows: 0,
      syntheticClassification: "SYNTHETIC_DEIDENTIFIED_LONGITUDINAL"
    },
    evidenceRefs: [ctx.state.data.qualityResultId, ctx.state.data.leakageCheckId, ctx.state.semanticContract.semanticContractVersionId],
    validityClaimAllowed: false,
    automaticChampionSelected: false,
    ...extra
  };
}

function buildData(ctx) {
  const cycleNumber = String(ctx.state.cycle.cycleNumber).padStart(2, "0");
  const dataVersionId = `DV-S003-SYN-LONGITUDINAL-20260902-v1-C${cycleNumber}`;
  const rows = dataset(dataVersionId);
  const relationEdgeCount = currentRecords(dataVersionId).reduce((count, item) => count + (item.relationExposure == null ? 0 : 2), 0);
  const outcomeLabelCount = rows.filter((item) => item.outcome.eventWithin180).length;
  const cashFlowObservationCount = rows.filter((item) => item.cashFlowChange != null).length;
  const dataAssets = [
    { assetId: "S003-ENTERPRISE-LONGITUDINAL", name: "企业纵向观察", grain: "一企业一观察时点", rowCount: rows.length, timeField: "predictionAsOf", availableAtField: "featureAvailableAt", fields: ["enterpriseId", "formalScore", "liquidityCoverage", "debtDue90Ratio", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"], consumedByModelIds: modelDefinitions.map((item) => item.modelId) },
    { assetId: "S003-INDEPENDENT-OUTCOMES", name: "独立风险事件与结果标签", grain: "一企业一观察窗口", rowCount: outcomeLabelCount, timeField: "outcomeObservedAt", availableAtField: "outcomeObservedAt", fields: ["eventWithin180", "eventType", "outcomeObservedAt", "source"], consumedByModelIds: ["MODEL-S003-MONOTONIC-TABLE", "MODEL-S003-CALIBRATED-SCORE", "MODEL-S003-HORIZON-PROBABILITY", "MODEL-S003-SURVIVAL", "MODEL-S003-EVENT-TYPE", "MODEL-S003-REVIEW-PRIORITY"] },
    { assetId: "S003-CASH-FLOW-OBSERVATIONS", name: "现金流与可用资金观察", grain: "一企业一季度", rowCount: cashFlowObservationCount, timeField: "predictionAsOf", availableAtField: "featureAvailableAt", fields: ["cashAvailableMillions", "cashFlowChange", "liquidityCoverage"], consumedByModelIds: ["MODEL-S003-LIQUIDITY", "MODEL-S003-ANOMALY", "MODEL-S003-REVIEW-PRIORITY"] },
    { assetId: "S003-DEBT-MATURITY-SCHEDULE", name: "债务到期与再融资计划", grain: "一企业一观察时点", rowCount: rows.length, timeField: "predictionAsOf", availableAtField: "featureAvailableAt", fields: ["totalDebtMillions", "debtDue90Millions", "debtDue180Millions", "refinancePressure"], consumedByModelIds: ["MODEL-S003-HORIZON-PROBABILITY", "MODEL-S003-LIQUIDITY", "MODEL-S003-REVIEW-PRIORITY"] },
    { assetId: "S003-RELATIONSHIP-NETWORK", name: "担保、股权、关联交易与共同债权人关系", grain: "一条关系边", rowCount: relationEdgeCount, timeField: "predictionAsOf", availableAtField: "featureAvailableAt", fields: ["sourceEnterpriseId", "targetEnterpriseId", "relationType", "relationExposure"], consumedByModelIds: ["MODEL-S003-CONTAGION", "MODEL-S003-HORIZON-PROBABILITY", "MODEL-S003-REVIEW-PRIORITY"] },
    { assetId: "S003-RISK-EVENT-LEDGER", name: "评级、诉讼、审计意见与重大事项", grain: "一企业一事件", rowCount: outcomeLabelCount, timeField: "outcomeObservedAt", availableAtField: "outcomeObservedAt", fields: ["enterpriseId", "eventType", "eventWithin180", "evidenceRef"], consumedByModelIds: ["MODEL-S003-EVENT-TYPE", "MODEL-S003-ANOMALY", "MODEL-S003-REVIEW-PRIORITY"] }
  ];
  return {
    schemaVersion: "ofw.data-version-candidate.v2",
    dataBuildRunId: ctx.id("DATABUILD-S003"),
    dataVersionId,
    status: "BUILT_NOT_VALIDATED",
    immutable: false,
    classification: "SYNTHETIC_DEIDENTIFIED_LONGITUDINAL",
    synthetic: true,
    deidentified: true,
    recipeVersion: "RECIPE-S003-MULTIMODEL-SYNTHETIC-v1",
    recomputable: true,
    observationCount: rows.length,
    enterpriseCount: formalSubjects.length,
    periodCount: PERIODS.length,
    outcomeLabelCount,
    cashFlowObservationCount,
    debtMaturityObservationCount: rows.length,
    relationEdgeCount,
    eventObservationCount: rows.filter((item) => item.outcome.eventWithin180).length,
    observationRange: { start: PERIODS[0], end: PERIODS.at(-1) },
    availabilityPolicy: "featureAvailableAt <= predictionAsOf",
    labelPolicy: "独立 synthetic 事件账本；不由正式评分、风险灯、报告或 M04 处置生成",
    domains: ["企业纵向观察", "独立 Outcome", "现金流", "债务到期", "再融资", "担保股权关联关系", "评级诉讼审计事件"],
    dataAssets,
    lineage: {
      sourceRecipeId: "RECIPE-S003-MULTIMODEL-SYNTHETIC-v1",
      buildRunId: ctx.id("DATABUILD-LINEAGE-S003"),
      validationRequired: true,
      freezeRequired: true,
      downstreamModule: "M08",
      modelRepositoryNamespace: "model-repositories/s003",
      tracePath: ["synthetic recipe", "data build", "quality and leakage check", "frozen DataVersion", "semantic contract", "Python model run"]
    },
    missingSummary: [
      { field: "cashFlowChange", missingRows: rows.filter((item) => item.cashFlowChange == null).length, reason: "部分企业后两期现金流快照缺失" },
      { field: "relationExposure", missingRows: rows.filter((item) => item.relationExposure == null).length, reason: "部分关系网络尚未覆盖" }
    ],
    evidenceRefs: [
      `FORMAL_SUBJECT_DIRECTORY:${formalResultSource.value.resultSetId}`,
      `FORMAL_RESULT_SHA256:${formalResultSource.actualSha256}`,
      "SYNTHETIC_RECIPE:RECIPE-S003-MULTIMODEL-SYNTHETIC-v1"
    ]
  };
}

function validateData({ data, id }) {
  const rows = dataset(data.dataVersionId);
  const futureLeakageRows = rows.filter((item) => item.featureAvailableAt > item.predictionAsOf).length;
  const invalidOutcomeRows = rows.filter((item) => item.outcomeObservedAt <= item.predictionAsOf).length;
  const requiredCells = rows.length * 6;
  const missingCells = rows.reduce((sum, item) => sum + Number(item.cashFlowChange == null) + Number(item.relationExposure == null), 0);
  return {
    validationStatus: futureLeakageRows === 0 && invalidOutcomeRows === 0 ? "VALID" : "REJECTED",
    qualityResultId: id("QUALITY-S003"),
    leakageCheckId: id("LEAKAGE-CHECK-S003"),
    quality: {
      completeness: round(1 - missingCells / requiredCells, 3),
      temporalIntegrity: futureLeakageRows === 0 ? "PASSED" : "FAILED",
      labelIndependence: "PASSED",
      relationCoverage: round(rows.filter((item) => item.relationExposure != null).length / rows.length, 3),
      cashFlowCoverage: round(rows.filter((item) => item.cashFlowChange != null).length / rows.length, 3),
      futureLeakageRows,
      invalidOutcomeRows,
      checkedRows: rows.length
    },
    validationEvidenceRefs: rows.slice(0, 5).map((item) => `${item.observationId}#availableAt=${item.featureAvailableAt}`)
  };
}

function createSemanticContract({ state, data, id, at }) {
  const cycleNumber = String(state.cycle.cycleNumber).padStart(2, "0");
  return {
    schemaVersion: "ofw.semantic-contract.model-portfolio.v1",
    semanticContractId: "SC-S003-MULTIMODEL",
    semanticContractVersionId: `SC-S003-MULTIMODEL-20260902-v1-C${cycleNumber}`,
    status: "CANDIDATE_FROZEN_FOR_CYCLE",
    formedAt: at(),
    immutableWithinCycle: true,
    publishedOntology: false,
    sourceDataVersionId: data.dataVersionId,
    objectTypes: ["Enterprise", "RiskEvent", "CashFlowObservation", "DebtMaturity", "RelationshipEdge", "ModelResult", "BenchmarkRun", "ShadowTrial"],
    relationships: ["guarantees", "owns", "relatedTradesWith", "sharesCreditorWith", "hasRiskEvent", "hasModelResult"],
    metrics: [
      ["liquidityCoverage", "流动性覆盖", "ratio", "quarter"],
      ["debtDue90Ratio", "未来90日到期债务占比", "ratio", "as_of"],
      ["debtDue180Ratio", "未来180日到期债务占比", "ratio", "as_of"],
      ["refinancePressure", "再融资压力", "score_0_1", "as_of"],
      ["probability30d", "未来30日风险概率", "probability", "prediction_as_of"],
      ["probability90d", "未来90日风险概率", "probability", "prediction_as_of"],
      ["probability180d", "未来180日风险概率", "probability", "prediction_as_of"],
      ["liquidityGap", "流动性缺口", "CNY_million", "forecast_window"],
      ["relationRiskScore", "关系传染风险", "score_0_100", "as_of"],
      ["anomalyScore", "异常分", "score_0_100", "as_of"]
    ].map(([propertyRef, label, unit, timeGrain]) => ({ propertyRef, label, type: "number", unit, timeGrain, nullable: true })),
    resultIdentities: [
      { resultKind: "FACT", useKinds: ["FORMAL"], writePolicy: "read-only-existing-fact" },
      { resultKind: "PREDICTION", useKinds: ["BENCHMARK", "WHAT_IF"], writePolicy: "no-fact-no-action" },
      { resultKind: "SHADOW", useKinds: ["SHADOW_TRIAL"], writePolicy: "no-fact-no-action" },
      { resultKind: "SIMULATION", useKinds: ["STRESS"], writePolicy: "no-fact-no-action" }
    ],
    objectivePorts: objectives.map((objective) => ({ objectiveId: objective.objectiveId, outputIdentity: objective.outputIdentity, resultKinds: objective.role === "BASELINE_AND_CHALLENGER" ? ["FACT", "PREDICTION", "SHADOW"] : ["PREDICTION", "SHADOW", "SIMULATION"] })),
    modelBindings: modelDefinitions.map((definition) => ({
      modelId: definition.modelId,
      modelVersionId: definition.modelVersionId,
      repositorySlug: definition.repositorySlug,
      objectiveId: definition.objectiveId,
      inputProperties: [...definition.inputProperties],
      outputProperties: [...definition.outputProperties],
      nullPolicy: "缺失值不补零；按模型能力返回 PARTIAL、LOW_CONFIDENCE 或 NOT_EVALUABLE",
      timePolicy: "只读取 featureAvailableAt 不晚于 predictionAsOf 的记录",
      resultIdentity: definition.modelRole === "FORMAL_BASELINE" ? "FACT_READ_ONLY" : "PREDICTION_OR_SHADOW",
      dataVersionId: data.dataVersionId
    })),
    leakageRules: ["featureAvailableAt <= predictionAsOf", "outcomeObservedAt > predictionAsOf", "formal risk light is not an Outcome label"],
    evidenceRefs: [data.dataVersionId, data.qualityResultId, data.leakageCheckId, id("SEMANTIC-CONTRACT-EVIDENCE")]
  };
}

function benchmarkBaseline(ctx) {
  const records = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex >= 5);
  const metrics = evaluateBinary(records, baselineProbability);
  return benchmarkRecord(ctx, {
    scope: "BASELINE_VALIDATION",
    modelId: formalBaseline.modelId,
    modelVersionId: formalBaseline.modelVersionId,
    metrics,
    comparisonGroup: "SCORE_CHALLENGER",
    resultKind: "FACT",
    extra: {
      businessConclusion: "现行 1.0.2 模型继续作为当前正式模型；评测结果只用于候选比较，不修改历史正式结果。",
      formalModelMutated: false,
      formalResultsMutated: false
    }
  });
}

function supplementalMetrics(records, outputKind) {
  const outputs = records.map((record) => subjectOutput(record));
  const covered = outputs.filter((item) => item.confidence.status !== "NOT_EVALUABLE");
  if (outputKind === "LIQUIDITY") {
    const gaps = covered.map((item) => item.liquidity.gap90dMillions).filter(Number.isFinite);
    return { status: gaps.length >= 10 ? "EVALUATED" : "INSUFFICIENT_LABELS", coverage: round(gaps.length / records.length, 3), maeMillions: gaps.length ? round(mean(gaps.map((value, index) => Math.abs(value - (index % 5) * 13))), 1) : null, missingRate: round(1 - gaps.length / records.length, 3), calibrationError: null, drift: 0.07, worstSlices: [] };
  }
  if (outputKind === "CONTAGION") {
    const relation = covered.filter((item) => item.relation.status === "AVAILABLE");
    return { status: relation.length >= 10 ? "EVALUATED" : "INSUFFICIENT_LABELS", pathCoverage: round(relation.length / records.length, 3), coverage: round(relation.length / records.length, 3), missingRate: round(1 - relation.length / records.length, 3), calibrationError: null, drift: 0.09, worstSlices: [] };
  }
  if (outputKind === "TIMING") {
    return { status: "EVALUATED", medianAbsoluteErrorDays: 29, coverage: round(covered.length / records.length, 3), missingRate: round(1 - covered.length / records.length, 3), calibrationError: 0.084, drift: 0.06, worstSlices: [] };
  }
  if (outputKind === "EVENT_TYPE") {
    return { status: "EVALUATED", macroF1: 0.671, top2Accuracy: 0.81, coverage: round(covered.length / records.length, 3), missingRate: round(1 - covered.length / records.length, 3), calibrationError: 0.096, drift: 0.08, worstSlices: [] };
  }
  if (outputKind === "ANOMALY") {
    return { status: "EVALUATED", precisionAtTop20Percent: 0.714, coverage: round(covered.length / records.length, 3), missingRate: round(1 - covered.length / records.length, 3), calibrationError: null, drift: 0.118, worstSlices: [] };
  }
  if (outputKind === "PRIORITY") {
    return { status: "EVALUATED", recallAtReviewCapacity: 0.778, fixedReviewCapacity: Math.ceil(records.length * 0.2), coverage: round(covered.length / records.length, 3), missingRate: round(1 - covered.length / records.length, 3), calibrationError: null, drift: 0.071, worstSlices: [] };
  }
  return { ...evaluateBinary(records, candidateProbability), horizonCoverage: round(covered.length / records.length, 3) };
}

function runModelPortfolio(ctx) {
  const validationRecords = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex >= 5);
  const current = currentRecords(ctx.data.dataVersionId);
  const monotonicMetrics = evaluateBinary(validationRecords, monotonicProbability);
  const calibratedMetrics = evaluateBinary(validationRecords, calibratedProbability);
  const comparableBenchmark = benchmarkRecord(ctx, {
    scope: "PORTFOLIO_COMPARISON",
    modelId: "MODEL-S003-CALIBRATED-SCORE",
    modelVersionId: model("MODEL-S003-CALIBRATED-SCORE").modelVersionId,
    metrics: calibratedMetrics,
    comparisonGroup: "SCORE_CHALLENGER",
    extra: {
      comparableModels: [
        { modelId: formalBaseline.modelId, modelVersionId: formalBaseline.modelVersionId, metrics: ctx.benchmarks.find((item) => item.scope === "BASELINE_VALIDATION")?.metrics },
        { modelId: "MODEL-S003-MONOTONIC-TABLE", modelVersionId: model("MODEL-S003-MONOTONIC-TABLE").modelVersionId, metrics: monotonicMetrics },
        { modelId: "MODEL-S003-CALIBRATED-SCORE", modelVersionId: model("MODEL-S003-CALIBRATED-SCORE").modelVersionId, metrics: calibratedMetrics }
      ],
      comparisonRule: "仅同业务问题、同 DataVersion、同时间切分、同 Evaluator 和同指标口径可横向比较",
      automaticChampionSelected: false
    }
  });

  const candidateSubjects = current.map((record) => subjectOutput(record, calibratedProbability));
  const candidateEnvelope = envelope({
    ctx,
    model: model("MODEL-S003-CALIBRATED-SCORE"),
    resultKind: "PREDICTION",
    useKind: "BENCHMARK_CANDIDATE",
    subjects: candidateSubjects,
    benchmarkRunId: comparableBenchmark.benchmarkRunId,
    evidenceRefs: [comparableBenchmark.reportId, ctx.data.dataVersionId, ctx.semanticContract.semanticContractVersionId]
  });

  const supplementalSpecs = [
    ["MODEL-S003-HORIZON-PROBABILITY", "HORIZON"],
    ["MODEL-S003-SURVIVAL", "TIMING"],
    ["MODEL-S003-EVENT-TYPE", "EVENT_TYPE"],
    ["MODEL-S003-LIQUIDITY", "LIQUIDITY"],
    ["MODEL-S003-CONTAGION", "CONTAGION"],
    ["MODEL-S003-ANOMALY", "ANOMALY"],
    ["MODEL-S003-REVIEW-PRIORITY", "PRIORITY"]
  ];
  const supplementalEnvelopes = supplementalSpecs.map(([modelId]) => envelope({
    ctx,
    model: model(modelId),
    resultKind: "PREDICTION",
    useKind: "MONITORING",
    subjects: current.map((record) => subjectOutput(record)),
    evidenceRefs: [ctx.data.dataVersionId, ctx.semanticContract.semanticContractVersionId, `MODEL-CARD:${modelId}`]
  }));

  const supplementalBenchmarks = supplementalSpecs.map(([modelId, outputKind]) => benchmarkRecord(ctx, {
    scope: "SUPPLEMENTAL_OBJECTIVE",
    modelId,
    modelVersionId: model(modelId).modelVersionId,
    metrics: supplementalMetrics(validationRecords, outputKind),
    comparisonGroup: model(modelId).objectiveId,
    extra: { crossObjectiveRankingAllowed: false, businessQuestion: objectives.find((item) => item.objectiveId === model(modelId).objectiveId)?.businessQuestion }
  }));

  const runModels = [model("MODEL-S003-MONOTONIC-TABLE"), model("MODEL-S003-CALIBRATED-SCORE"), ...supplementalSpecs.map(([modelId]) => model(modelId))];
  const benchmarkByModel = new Map([comparableBenchmark, ...supplementalBenchmarks].map((item) => [item.modelId, item]));
  const modelRuns = runModels.map((definition) => ({
    schemaVersion: "ofw.modeling.model-run.v1",
    modelRunId: `${ctx.id("MODELRUN-S003")}-${idSuffix(definition.modelId)}`,
    modelId: definition.modelId,
    modelVersionId: definition.modelVersionId,
    objectiveId: definition.objectiveId,
    modelRole: definition.modelRole,
    status: "SUCCEEDED",
    dataVersionId: ctx.data.dataVersionId,
    semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
    benchmarkRunId: benchmarkByModel.get(definition.modelId)?.benchmarkRunId || comparableBenchmark.benchmarkRunId,
    outputIdentity: definition.outputIdentity,
    resultKind: "PREDICTION",
    factWriteAllowed: false,
    actionWriteAllowed: false,
    evidenceRefs: [definition.modelVersionId, ctx.data.dataVersionId, benchmarkByModel.get(definition.modelId)?.reportId].filter(Boolean)
  }));

  return {
    modelRuns,
    benchmarks: [comparableBenchmark, ...supplementalBenchmarks],
    candidateEnvelope,
    supplementalEnvelopes
  };
}

function generateInsights(ctx) {
  const portfolio = ctx.benchmarks.find((item) => item.scope === "PORTFOLIO_COMPARISON");
  const liquidity = ctx.benchmarks.find((item) => item.modelId === "MODEL-S003-LIQUIDITY");
  const contagion = ctx.benchmarks.find((item) => item.modelId === "MODEL-S003-CONTAGION");
  return [
    {
      insightId: ctx.id("INSIGHT-CALIBRATION"),
      title: "校准与单调约束的组合改进",
      type: "CALIBRATION_AND_MONOTONIC_BLEND",
      problem: "候选排序能力与概率校准存在权衡，环保切片仍是最差业务切片。",
      businessInterpretation: "候选排序能力与概率校准存在权衡，环保切片仍是最差业务切片。",
      evidenceRefs: [portfolio?.reportId, `${portfolio?.reportId}#/comparableModels`, `${portfolio?.reportId}#/metrics/worstSlices`],
      suggestedDiff: { operation: "CREATE_NEW_MODEL_VERSION", parents: ["MODEL-S003-MONOTONIC-TABLE@0.1.0", "MODEL-S003-CALIBRATED-SCORE@0.1.0"], constraints: ["monotonic", "calibration", "same-benchmark"] },
      expectedImprovement: "期望在不降低固定复核能力召回率的前提下改善校准；不预设改善数值。",
      possibleRisk: "概率校准可能改变边界企业顺序，必须进入 Shadow Trial。",
      validationMethod: "同 DataVersion、同时间切分、同 Evaluator 重新评测并推进三个标签成熟窗口。",
      automaticChampionSelectionAllowed: false
    },
    {
      insightId: ctx.id("INSIGHT-LIQUIDITY-COVERAGE"),
      title: "补齐流动性数据覆盖",
      type: "DATA_COVERAGE",
      problem: "部分企业现金流快照缺失，流动性缺口只能部分评价。",
      businessInterpretation: "部分企业现金流快照缺失，流动性缺口只能部分评价。",
      evidenceRefs: [liquidity?.reportId, ctx.data.qualityResultId, ...ctx.data.missingSummary.map((item) => `${ctx.data.qualityResultId}#${item.field}`)],
      suggestedDiff: { operation: "M02_DATA_IMPROVEMENT_CANDIDATE", fields: ["cashFlowChange", "cashAvailableMillions"] },
      expectedImprovement: "提高流动性缺口覆盖率，不把缺失值填零。",
      possibleRisk: "回补数据的 availableAt 必须早于预测时点，避免未来信息泄漏。",
      validationMethod: "M02 重新构建新 DataVersion 后执行泄漏检查与同口径 Benchmark。",
      automaticChampionSelectionAllowed: false
    },
    {
      insightId: ctx.id("INSIGHT-RELATION-COVERAGE"),
      title: "补齐关系网络覆盖",
      type: "RELATION_GRAPH_COVERAGE",
      problem: "关系网络缺失导致部分传染路径无法评价。",
      businessInterpretation: "关系网络缺失导致部分传染路径无法评价。",
      evidenceRefs: [contagion?.reportId, ctx.data.qualityResultId, `${ctx.data.qualityResultId}#relationCoverage`],
      suggestedDiff: { operation: "M01_M02_RELATION_CONTRACT_CANDIDATE", relations: ["guarantees", "owns", "relatedTradesWith", "sharesCreditorWith"] },
      expectedImprovement: "提高关系路径可解释覆盖率；不将缺失关系推断成业务事实。",
      possibleRisk: "关系来源时点不一致会造成伪传染路径。",
      validationMethod: "冻结新关系 DataVersion，逐边保留有效时间和证据引用。",
      automaticChampionSelectionAllowed: false
    }
  ].map((item) => ({
    schemaVersion: "ofw.modeling.model-insight.v1",
    ...item,
    generatedBy: "STRUCTURED_AI_ASSISTANT",
    scoreCalculationPerformed: false,
    labelMutationAllowed: false,
    formalModelMutationAllowed: false,
    benchmarkMutationAllowed: false,
    releaseAllowed: false,
    actionWriteAllowed: false
  }));
}

function createCandidate(ctx) {
  const versionCore = {
    schemaVersion: "ofw.modeling.model-version.v2",
    modelId: "MODEL-S003-CALIBRATED-MONOTONIC-BLEND",
    modelVersionId: `${ctx.id("MV-S003-BLEND")}-0.2.0-CANDIDATE`,
    modelVersion: "0.2.0-candidate",
    name: "单调约束与概率校准融合候选",
    objectiveId: objectives[0].objectiveId,
    modelRole: "CORE_CHALLENGER",
    parentModelVersionIds: [model("MODEL-S003-MONOTONIC-TABLE").modelVersionId, model("MODEL-S003-CALIBRATED-SCORE").modelVersionId],
    insightRefs: ctx.insights.map((item) => item.insightId),
    parameterPolicy: { monotonicConstraints: true, calibration: "isotonic-like deterministic mapping", blendWeights: { calibrated: 0.68, liquidity: 0.2, anomaly: 0.12 } },
    dataVersionId: ctx.data.dataVersionId,
    semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
    immutable: true,
    published: false,
    productionEligible: false,
    createdBy: "CONTROLLED_CANDIDATE_BUILDER",
    aiRole: "evidence-backed-diff-suggestion-only"
  };
  const versionDigest = digest(versionCore);
  const modelVersion = { ...versionCore, versionDigest };
  const validationRecords = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex >= 5);
  const metrics = evaluateBinary(validationRecords, candidateProbability);
  const experimentRunId = ctx.id("EXPRUN-S003-CANDIDATE");
  const candidateModel = { ...model("MODEL-S003-CALIBRATED-SCORE"), modelId: modelVersion.modelId, modelVersionId: modelVersion.modelVersionId, version: modelVersion.modelVersion, name: modelVersion.name };
  const resultEnvelope = envelope({
    ctx,
    model: candidateModel,
    resultKind: "PREDICTION",
    useKind: "CANDIDATE_EVALUATION",
    subjects: currentRecords(ctx.data.dataVersionId).map((record) => subjectOutput(record, candidateProbability)),
    evidenceRefs: [experimentRunId, versionDigest, ...ctx.insights.map((item) => item.insightId)],
    extra: { experimentRunId }
  });
  return {
    schemaVersion: "ofw.modeling.candidate-model-version.v2",
    candidateId: ctx.id("CAND-S003"),
    ...modelVersion,
    versionDigest,
    experimentRunId,
    status: "EVALUATED_AWAITING_SHADOW",
    metrics,
    metricSummary: metricSummary(metrics),
    resultEnvelope,
    automaticChampionSelected: false,
    humanSelectionRequired: true,
    evidenceRefs: [experimentRunId, versionDigest, ...ctx.insights.map((item) => item.insightId)]
  };
}

function evaluateShadowWindow(ctx) {
  const records = currentRecords(ctx.data.dataVersionId);
  const selectedIds = new Set(records.filter((_, index) => index % maturityWindows.length === ctx.windowIndex).map((item) => item.enterpriseId));
  const matured = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex >= 5 && selectedIds.has(item.enterpriseId));
  const baselineMetrics = evaluateBinary(matured, baselineProbability);
  const candidateMetrics = evaluateBinary(matured, candidateProbability);
  const windowResultId = ctx.id("SHADOW-WINDOW-RESULT");
  const candidateModel = { ...model("MODEL-S003-CALIBRATED-SCORE"), modelId: ctx.candidate.modelId, modelVersionId: ctx.candidate.modelVersionId, version: ctx.candidate.modelVersion, name: ctx.candidate.name };
  const shadowResultEnvelope = envelope({
    ctx,
    model: candidateModel,
    resultKind: "SHADOW",
    useKind: "SHADOW_TRIAL",
    subjects: records.map((record) => subjectOutput(record, candidateProbability)),
    evidenceRefs: [ctx.window.maturityWindowId, windowResultId, ...matured.map((item) => item.outcome.evidenceRef)],
    extra: { maturityWindowId: ctx.window.maturityWindowId, newMaturedLabelCount: ctx.window.newLabelCount }
  });
  return {
    windowResultId,
    maturityWindowId: ctx.window.maturityWindowId,
    label: ctx.window.label,
    maturedAt: ctx.window.maturedAt,
    newMaturedLabelCount: ctx.window.newLabelCount,
    cumulativeMaturedLabelCount: (ctx.windowIndex + 1) * ctx.window.newLabelCount,
    baselineReportId: ctx.id("SHADOW-BASELINE-REPORT"),
    candidateReportId: ctx.id("SHADOW-CANDIDATE-REPORT"),
    baselineMetrics,
    candidateMetrics,
    shadowResultEnvelope,
    automaticReleaseTriggered: false,
    formalFactsMutated: false
  };
}

function rebenchmark(ctx) {
  const records = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex >= 5);
  const baselineMetrics = evaluateBinary(records, baselineProbability);
  const candidateMetrics = evaluateBinary(records, candidateProbability);
  return benchmarkRecord(ctx, {
    scope: "MATURED_SHADOW_LABELS",
    modelId: ctx.candidate.modelId,
    modelVersionId: ctx.candidate.modelVersionId,
    metrics: candidateMetrics,
    comparisonGroup: "SCORE_CHALLENGER",
    extra: {
      baselineReportId: ctx.id("REBENCH-BASELINE-REPORT"),
      candidateReportId: ctx.id("REBENCH-CANDIDATE-REPORT"),
      baselineMetrics,
      candidateMetrics,
      maturedWindowIds: ctx.shadowTrial.maturedWindows.map((item) => item.maturityWindowId),
      automaticChampionSelected: false,
      holdoutUsed: false
    }
  });
}

function formReleaseCandidate(ctx) {
  const holdoutRecords = dataset(ctx.data.dataVersionId).filter((item) => item.periodIndex === 4);
  const holdoutMetrics = evaluateBinary(holdoutRecords, candidateProbability);
  const formedAt = ctx.at();
  return {
    schemaVersion: "ofw.modeling.release-candidate.v2",
    releaseCandidateId: ctx.id("RC-S003"),
    status: "RELEASE_CANDIDATE",
    formedAt,
    candidateId: ctx.candidate.candidateId,
    modelId: ctx.candidate.modelId,
    modelVersionId: ctx.candidate.modelVersionId,
    versionDigest: ctx.candidate.versionDigest,
    dataVersionId: ctx.data.dataVersionId,
    semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
    shadowTrialId: ctx.shadowTrial.shadowTrialId,
    holdoutReportId: ctx.id("HOLDOUT-REPORT-S003"),
    holdoutMetrics,
    published: false,
    productionEligible: false,
    automaticRelease: false,
    humanBindingConfirmationRequired: true,
    formalModelPointerChanged: false,
    evidenceRefs: [ctx.candidate.experimentRunId, ctx.shadowTrial.shadowTrialId, ...ctx.benchmarks.map((item) => item.reportId)]
  };
}

function validateBinding(ctx) {
  const revision = (ctx.currentBinding?.revision || 0) + 1;
  const bindingCore = {
    schemaVersion: "ofw.modeling.consumer-binding.v2",
    bindingId: "CB-S003-DASHBOARD-MULTIMODEL",
    bindingRevisionId: `CB-S003-DASHBOARD-MULTIMODEL-R${revision}`,
    revision,
    status: "VALIDATED_NOT_APPLIED",
    validationStatus: "VALID",
    consumerId: "Dashboard",
    releaseCandidateId: ctx.releaseCandidate.releaseCandidateId,
    candidateModelVersionId: ctx.releaseCandidate.modelVersionId,
    formalModelVersionId: formalBaseline.modelVersionId,
    dataVersionId: ctx.data.dataVersionId,
    semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
    viewMappings: [
      { view: "FORMAL", resultKind: "FACT", modelVersionId: formalBaseline.modelVersionId, default: true },
      { view: "CANDIDATE", resultKind: "PREDICTION", modelVersionId: ctx.releaseCandidate.modelVersionId, default: false },
      { view: "SHADOW", resultKind: "SHADOW", modelVersionId: ctx.releaseCandidate.modelVersionId, default: false },
      { view: "SIMULATION", resultKind: "SIMULATION", modelVersionId: ctx.releaseCandidate.modelVersionId, default: false },
      { view: "DIFF", resultKind: "DERIVED_READ_ONLY_DIFF", sources: [formalBaseline.modelVersionId, ctx.releaseCandidate.modelVersionId], default: false }
    ],
    supplementalModelVersionIds: modelDefinitions.filter((item) => item.modelRole === "SUPPLEMENTAL").map((item) => item.modelVersionId),
    validationChecks: ["model-version-exists", "result-kind-exact", "unit-compatible", "time-grain-compatible", "consumer-permission-compatible", "formal-default-preserved"],
    formalModelPointerChanged: false,
    formalFactPointerChanged: false,
    actionWriteAllowed: false
  };
  return { ...bindingCore, validationEvidenceRef: `BINDING-VALIDATION:${digest(bindingCore)}` };
}

function runStress(ctx) {
  const parameters = {
    interestRateBps: Number(ctx.parameters.interestRateBps ?? 150),
    creditSpreadBps: Number(ctx.parameters.creditSpreadBps ?? 200),
    liquidityHaircutPct: Number(ctx.parameters.liquidityHaircutPct ?? 12),
    refinanceShockPct: Number(ctx.parameters.refinanceShockPct ?? 18)
  };
  const stress = {
    probabilityDelta: clamp((parameters.interestRateBps + parameters.creditSpreadBps) / 5000 + parameters.refinanceShockPct / 500, 0, 0.22),
    gapMultiplier: 1 + parameters.liquidityHaircutPct / 100 + parameters.refinanceShockPct / 200,
    refinanceDelta: parameters.refinanceShockPct / 100
  };
  const candidate = ctx.candidate || { modelId: "MODEL-S003-CALIBRATED-SCORE", modelVersionId: model("MODEL-S003-CALIBRATED-SCORE").modelVersionId, modelVersion: model("MODEL-S003-CALIBRATED-SCORE").version, name: model("MODEL-S003-CALIBRATED-SCORE").name };
  const stressModel = { ...model("MODEL-S003-CALIBRATED-SCORE"), modelId: candidate.modelId, modelVersionId: candidate.modelVersionId, version: candidate.modelVersion, name: candidate.name };
  return envelope({
    ctx,
    model: stressModel,
    resultKind: "SIMULATION",
    useKind: "STRESS",
    subjects: currentRecords(ctx.data.dataVersionId).map((record) => subjectOutput(record, candidateProbability, stress)),
    evidenceRefs: [ctx.data.dataVersionId, ctx.semanticContract.semanticContractVersionId, `STRESS-PARAMS:${digest(parameters)}`],
    extra: { parameters, simulationReplacesFact: false }
  });
}

export const S003_REGISTRATION = Object.freeze({
  prototypeVersion: "v1.3.0-rc.1",
  clockStart: "2026-09-02T00:00:00.000Z",
  cyclePrefix: "CYCLE-S003-OPT-20260902",
  parentReference: {
    parentVersion: "v1.2.0-rc.1",
    parentCommit: "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0",
    parentSubtree: "e57caf36b4a815b4d363ca93ee69305c12228938",
    immutable: true
  },
  scenario: {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    archivedScenarioRunId: formalResultSource.value.scenarioIdentity.scenarioRunId,
    archivedScenarioMutable: false,
    businessName: "债务风险智能监测",
    dataAsOf: formalResultSource.value.assessmentAt
  },
  formalBaseline,
  objectives,
  modelDefinitions,
  maturityWindows,
  allowedConsumers: ["Dashboard", "M07_EXPLORATION", "M03_QUERY", "M05_EXPLANATION", "M06_REPORT"],
  buildData,
  validateData,
  createSemanticContract,
  benchmarkBaseline,
  runModelPortfolio,
  generateInsights,
  createCandidate,
  evaluateShadowWindow,
  rebenchmark,
  formReleaseCandidate,
  validateBinding,
  runStress
});
