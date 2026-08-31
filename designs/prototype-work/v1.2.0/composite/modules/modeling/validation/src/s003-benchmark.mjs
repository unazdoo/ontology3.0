import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertContract } from "./errors.mjs";
import { sha256 } from "./hash.mjs";
import {
  S003_BASELINE_SOURCE,
  S003_FIXED_RESULT_SOURCE,
  S003_OBJECTIVE_ID
} from "./s003-contract.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const WORKTREE_ROOT = fileURLToPath(new URL("../../../../../../../../", import.meta.url));
const FIXTURE_URL = new URL("../fixtures/s003-longitudinal-benchmark.v1.json", import.meta.url);

function clone(value) {
  return structuredClone(value);
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function readVerifiedJson(descriptor) {
  const absolutePath = path.resolve(WORKTREE_ROOT, descriptor.sourceRef);
  const source = readFileSync(absolutePath, "utf8");
  const actualSha256 = sha256(source);
  assertContract(
    actualSha256 === descriptor.sha256,
    "SOURCE_SHA256_MISMATCH",
    `Read-only source fingerprint mismatch: ${descriptor.sourceRef}`,
    { expected: descriptor.sha256, actual: actualSha256 }
  );
  return { value: JSON.parse(source), absolutePath, actualSha256 };
}

export function loadS003BenchmarkSources() {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL, "utf8"));
  const baseline = readVerifiedJson(S003_BASELINE_SOURCE);
  const fixedResults = readVerifiedJson(S003_FIXED_RESULT_SOURCE);
  assertContract(
    baseline.value.packageId === S003_BASELINE_SOURCE.packageId
      && baseline.value.packageVersion === S003_BASELINE_SOURCE.packageVersion,
    "BASELINE_SOURCE_IDENTITY_MISMATCH",
    "The read-only M01 package does not match the registered S003 baseline identity."
  );
  assertContract(
    fixedResults.value.resultSetId === S003_FIXED_RESULT_SOURCE.resultSetId,
    "FIXED_RESULT_SOURCE_IDENTITY_MISMATCH",
    "The read-only S003 fixed result set does not match its registered identity."
  );
  return {
    fixture,
    baselinePackage: baseline.value,
    fixedResultSet: fixedResults.value,
    sourceVerification: {
      baselinePackage: { ...S003_BASELINE_SOURCE, verified: true, actualSha256: baseline.actualSha256 },
      fixedResultSet: { ...S003_FIXED_RESULT_SOURCE, verified: true, actualSha256: fixedResults.actualSha256 }
    }
  };
}

function maturityForEnterprise(fixture, enterpriseId) {
  return fixture.maturityWindows.find((item) => item.enterpriseIds.includes(enterpriseId)) || null;
}

function shiftedSignals(values, shift, profileIndex, windowIndex) {
  return values.map((value, featureIndex) => {
    if (value === null) return null;
    const deterministicOffset = (((profileIndex + featureIndex + windowIndex) % 5) - 2) * 0.003;
    return round(clamp(value + shift + deterministicOffset), 4);
  });
}

export function materializeS003Observations(fixture, baselinePackage) {
  assertContract(
    fixture.classification === "SYNTHETIC_DEIDENTIFIED_RESEARCH_ONLY"
      && fixture.containsSourceBusinessValues === false,
    "BENCHMARK_CLASSIFICATION_INVALID",
    "S003 supervised benchmark must remain explicitly synthetic and de-identified."
  );
  assertContract(
    fixture.labelsDerivedFromModelOutput === false
      && fixture.labelsDerivedFromRiskLights === false
      && fixture.labelsDerivedFromReports === false
      && fixture.labelsDerivedFromM04Disposition === false,
    "LABEL_INDEPENDENCE_INVALID",
    "Supervised outcomes cannot be derived from model scores, risk lights, reports or M04 disposition."
  );
  const metricCount = baselinePackage.indicatorOrder.length;
  const factorCount = baselinePackage.factors.length;
  const observations = [];
  fixture.enterpriseProfiles.forEach((profile, profileIndex) => {
    assertContract(profile.metricRiskSignals.length === metricCount, "METRIC_CARDINALITY_INVALID", "Every synthetic enterprise profile must contain the current 15 metric observations.", { enterpriseId: profile.enterpriseId });
    assertContract(profile.factorRiskSignals.length === factorCount, "FACTOR_CARDINALITY_INVALID", "Every synthetic enterprise profile must contain the current 6 factor observations.", { enterpriseId: profile.enterpriseId });
    assertContract(profile.outcomes.length === fixture.observationWindows.length, "OUTCOME_CARDINALITY_INVALID", "Each enterprise requires an independent outcome for every observation window.", { enterpriseId: profile.enterpriseId });
    fixture.observationWindows.forEach((window, windowIndex) => {
      const maturity = window.split === "SHADOW" ? maturityForEnterprise(fixture, profile.enterpriseId) : null;
      const observedAt = maturity?.maturedAt || window.defaultOutcomeObservedAt;
      observations.push({
        sampleId: `${profile.enterpriseId}@${window.windowId}`,
        enterpriseId: profile.enterpriseId,
        enterpriseName: profile.enterpriseName,
        industry: profile.industry,
        operatingStage: profile.operatingStage,
        split: window.split,
        windowId: window.windowId,
        predictionAsOf: window.predictionAsOf,
        assessmentAsOf: window.predictionAsOf,
        availableAt: window.availableAt,
        featureAvailableAt: window.availableAt,
        dataVersion: fixture.benchmark.dataVersion,
        outcomeDataVersion: fixture.benchmark.outcomeDataVersion,
        ontologyVersion: `${S003_BASELINE_SOURCE.packageId}@${S003_BASELINE_SOURCE.packageVersion}`,
        metricRiskSignals: shiftedSignals(profile.metricRiskSignals, window.featureShift, profileIndex, windowIndex),
        factorRiskSignals: shiftedSignals(profile.factorRiskSignals, window.featureShift / 2, profileIndex, windowIndex),
        outcome: {
          adverseOutcome: profile.outcomes[windowIndex],
          outcomeType: profile.outcomes[windowIndex] ? profile.outcomeType : "NONE",
          observedAt,
          evidenceRef: `SYN-EVID-${window.windowId}-${profile.enterpriseId}`,
          labelMatured: true,
          interventionFlag: profile.interventionFlags[windowIndex],
          maturityWindowId: maturity?.maturityWindowId || null
        }
      });
    });
  });
  validateS003TemporalIntegrity(observations, fixture.benchmark.horizonDays);
  return observations;
}

export function validateS003TemporalIntegrity(observations, horizonDays = 180) {
  for (const observation of observations) {
    const availableAt = Date.parse(observation.availableAt);
    const predictionAsOf = Date.parse(`${observation.predictionAsOf}T23:59:59.999Z`);
    const observedAt = Date.parse(observation.outcome.observedAt);
    assertContract(Number.isFinite(availableAt) && availableAt <= predictionAsOf, "FUTURE_INFORMATION_LEAKAGE", "Every feature must be available no later than predictionAsOf.", { sampleId: observation.sampleId, availableAt: observation.availableAt, predictionAsOf: observation.predictionAsOf });
    assertContract(Number.isFinite(observedAt) && observedAt > predictionAsOf, "OUTCOME_NOT_POST_PREDICTION", "The supervised outcome must be observed after predictionAsOf.", { sampleId: observation.sampleId });
    assertContract(observedAt <= predictionAsOf + horizonDays * DAY_MS, "OUTCOME_OUTSIDE_HORIZON", "The supervised outcome must be confirmed within the 180-day horizon.", { sampleId: observation.sampleId, observedAt: observation.outcome.observedAt });
  }
  return { status: "VALID", checkedRows: observations.length, futureLeakageRows: 0 };
}

export function createS003BaselineModelVersion(sourceVerification) {
  return deepFreeze({
    resourceKind: "ModelVersion",
    objectiveId: S003_OBJECTIVE_ID,
    modelVersionId: "MV-S003-DEBT-RISK-1.0.2-REFERENCE",
    modelVersion: "1.0.2",
    name: "当前正式模型 1.0.2（只读基线）",
    immutable: true,
    sourceRef: S003_BASELINE_SOURCE.sourceRef,
    sourceVersion: S003_BASELINE_SOURCE.packageVersion,
    sourceSha256: sourceVerification.baselinePackage.actualSha256,
    sourceOwnerModuleId: "M01",
    sourceConfigurationCopied: false,
    m08Role: "BASELINE_REFERENCE",
    productionEligible: false,
    publishedByM08: false,
    t019WriteAllowed: false,
    definitionFingerprint: sha256({ objectiveId: S003_OBJECTIVE_ID, source: S003_BASELINE_SOURCE })
  });
}

function candidateVersion({ id, version, name, branchType, diff, dependencies = [] }) {
  return deepFreeze({
    resourceKind: "ModelVersion",
    objectiveId: S003_OBJECTIVE_ID,
    modelVersionId: id,
    modelVersion: version,
    name,
    immutable: true,
    basedOnModelVersionId: "MV-S003-DEBT-RISK-1.0.2-REFERENCE",
    sourceRef: S003_BASELINE_SOURCE.sourceRef,
    sourceVersion: S003_BASELINE_SOURCE.packageVersion,
    sourceSha256: S003_BASELINE_SOURCE.sha256,
    sourceConfigurationCopied: false,
    branchType,
    diff: clone(diff),
    dependencies: clone(dependencies),
    generatedBy: "BOUNDED_DETERMINISTIC_SCORECARD_SEARCH-v1",
    aiCalculatedScore: false,
    immutableDefinition: true,
    productionEligible: false,
    publishedByM08: false,
    t019WriteAllowed: false,
    definitionFingerprint: sha256({ id, version, branchType, diff, dependencies, source: S003_BASELINE_SOURCE })
  });
}

function boundedConfigurationSearch({ searchId, dimensions, isValid }) {
  const entries = Object.entries(dimensions);
  const configurations = entries.reduce(
    (items, [name, values]) => items.flatMap((item) => values.map((value) => ({ ...item, [name]: value }))),
    [{}]
  );
  const valid = configurations.filter(isValid);
  assertContract(valid.length > 0, "DETERMINISTIC_SEARCH_EMPTY", `No constraint-valid configuration exists for ${searchId}.`);
  const baselineValue = (name) => name === "scoreScale" || name.startsWith("factor") ? 1 : 0;
  const perturbation = (configuration) => entries.reduce((sum, [name]) => sum + Math.abs(configuration[name] - baselineValue(name)), 0);
  valid.sort((left, right) => perturbation(left) - perturbation(right) || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const selected = valid[0];
  return {
    selected,
    trace: {
      searchId,
      engine: "BOUNDED_DETERMINISTIC_SCORECARD_SEARCH-v1",
      evaluatedConfigurationCount: configurations.length,
      validConfigurationCount: valid.length,
      selectionRule: "MINIMUM_PARAMETER_PERTURBATION_THEN_CANONICAL_ORDER",
      dimensions: Object.fromEntries(entries.map(([name, values]) => [name, { minimum: Math.min(...values), maximum: Math.max(...values), choices: values.length }])),
      selectedConfigurationFingerprint: sha256(selected),
      benchmarkMetricUsedForSelection: false,
      automaticChampionSelection: false
    }
  };
}

export function createDeterministicS003Candidates() {
  const reweightSearch = boundedConfigurationSearch({
    searchId: "SEARCH-S003-A-REWEIGHT-v1",
    dimensions: {
      operatingCashInflow: [1, 1.1, 1.2],
      cashRatio: [1, 1.2, 1.35],
      debtRatio: [1, 1.1, 1.15],
      interestCoverage: [1, 1.2, 1.35],
      cashCurrentLiability: [1, 1.2, 1.35]
    },
    isValid: (item) => item.operatingCashInflow >= 1.2 && item.cashRatio >= 1.35 && item.debtRatio >= 1.15 && item.interestCoverage >= 1.35 && item.cashCurrentLiability >= 1.35
  });
  const reweightMultipliers = {
    "经营活动产生的现金流入": reweightSearch.selected.operatingCashInflow,
    "现金比率": reweightSearch.selected.cashRatio,
    "资产负债率": reweightSearch.selected.debtRatio,
    "利息保障倍数": reweightSearch.selected.interestCoverage,
    "现金流动负债比率": reweightSearch.selected.cashCurrentLiability
  };
  const calibrationSearch = boundedConfigurationSearch({
    searchId: "SEARCH-S003-B-CALIBRATION-v1",
    dimensions: {
      scoreScale: [0.95, 0.97, 1],
      scoreOffset: [0, 1.5, 3],
      factorCreditUtilization: [1, 1.1],
      factorLitigation: [1, 1.15],
      factorFundGap: [1, 1.2],
      greenShift: [1, 2],
      yellowShift: [0, 1],
      redShift: [0, 1]
    },
    isValid: (item) => item.scoreScale >= 0.96 && item.scoreScale <= 0.99 && item.scoreOffset >= 1 && item.factorCreditUtilization >= 1.1 && item.factorLitigation >= 1.15 && item.factorFundGap >= 1.2 && item.greenShift >= 2 && item.yellowShift >= 1 && item.redShift >= 1
  });
  const calibrationDiff = {
    scoreScale: calibrationSearch.selected.scoreScale,
    scoreOffset: calibrationSearch.selected.scoreOffset,
    factorCoefficientMultipliers: {
      "credit-utilization": calibrationSearch.selected.factorCreditUtilization,
      litigation: calibrationSearch.selected.factorLitigation,
      "fund-gap": calibrationSearch.selected.factorFundGap
    },
    tierMinimumShift: {
      GREEN: calibrationSearch.selected.greenShift,
      YELLOW: calibrationSearch.selected.yellowShift,
      RED: calibrationSearch.selected.redShift,
      BLACK: 0
    }
  };
  const candidates = [
    {
      id: "CAND-S003-A-REWEIGHT-v1",
      candidateId: "CAND-S003-A-REWEIGHT-v1",
      name: "候选 A：流动性与偿债覆盖权重再平衡",
      type: "REWEIGHT",
      status: "PENDING_EVALUATION",
      blockedReason: null,
      primaryMetric: null,
      metrics: null,
      evidenceRefs: ["INSIGHT-S003-LIQUIDITY-COVERAGE-v1"],
      branchCreatedBy: "AI_ASSISTED_STRUCTURED_INSIGHT",
      numericParametersGeneratedBy: "BOUNDED_DETERMINISTIC_SCORECARD_SEARCH-v1",
      parameterSearch: reweightSearch.trace,
      diff: {
        operation: "REWEIGHT",
        weightMultipliers: reweightMultipliers,
        normalization: "PER_INDUSTRY_SUM_100_PERCENT",
        fixedSemanticOrderPreserved: true
      },
      modelVersion: candidateVersion({
        id: "MV-S003-CAND-A-REWEIGHT-0001",
        version: "candidate-a.1",
        name: "流动性与偿债覆盖权重再平衡",
        branchType: "REWEIGHT",
        diff: {
          weightMultipliers: reweightMultipliers,
          normalization: "PER_INDUSTRY_SUM_100_PERCENT"
        }
      })
    },
    {
      id: "CAND-S003-B-CALIBRATION-v1",
      candidateId: "CAND-S003-B-CALIBRATION-v1",
      name: "候选 B：锚点、阈值与因子系数校准",
      type: "ANCHOR_ADJUST",
      status: "PENDING_EVALUATION",
      blockedReason: null,
      primaryMetric: null,
      metrics: null,
      evidenceRefs: ["INSIGHT-S003-CALIBRATION-v1"],
      branchCreatedBy: "AI_ASSISTED_STRUCTURED_INSIGHT",
      numericParametersGeneratedBy: "BOUNDED_DETERMINISTIC_SCORECARD_SEARCH-v1",
      parameterSearch: calibrationSearch.trace,
      diff: {
        operations: ["ANCHOR_ADJUST", "THRESHOLD_ADJUST", "FACTOR_MODIFY"],
        ...calibrationDiff,
        fixedSemanticOrderPreserved: true
      },
      modelVersion: candidateVersion({
        id: "MV-S003-CAND-B-CALIBRATION-0001",
        version: "candidate-b.1",
        name: "锚点、阈值与因子系数校准",
        branchType: "CALIBRATION",
        diff: calibrationDiff
      })
    },
    {
      id: "CAND-S003-C-MATURITY-CONCENTRATION-v1",
      candidateId: "CAND-S003-C-MATURITY-CONCENTRATION-v1",
      name: "候选 C：未来90日到期债务集中度",
      type: "FACTOR_ADD",
      status: "DATA_REQUIRED",
      blockedReason: "M01 尚无该因子语义定义，M02 尚无可回溯历史观测。",
      primaryMetric: null,
      metrics: null,
      evidenceRefs: ["INSIGHT-S003-MATURITY-CONCENTRATION-v1"],
      branchCreatedBy: "AI_ASSISTED_STRUCTURED_INSIGHT",
      numericParametersGeneratedBy: "BLOCKED_UNTIL_DATA_AND_SEMANTICS_AVAILABLE",
      parameterSearch: {
        searchId: "SEARCH-S003-C-BLOCKED-v1",
        engine: "BOUNDED_DETERMINISTIC_SCORECARD_SEARCH-v1",
        evaluatedConfigurationCount: 0,
        validConfigurationCount: 0,
        status: "DATA_REQUIRED",
        benchmarkMetricUsedForSelection: false,
        automaticChampionSelection: false
      },
      diff: {
        operation: "FACTOR_ADD",
        factorId: "future90dMaturityConcentration",
        companionSuggestion: "删除低增益或重复因子前先完成消融验证",
        executionAllowed: false
      },
      modelVersion: candidateVersion({
        id: "MV-S003-CAND-C-DATA-REQUIRED-0001",
        version: "candidate-c.1",
        name: "未来90日到期债务集中度",
        branchType: "FACTOR_ADD",
        diff: { factorId: "future90dMaturityConcentration" },
        dependencies: [
          { ownerModuleId: "M01", dependency: "SEMANTIC_DEFINITION", status: "MISSING" },
          { ownerModuleId: "M02", dependency: "HISTORICAL_OBSERVATIONS", status: "MISSING" }
        ]
      })
    }
  ];
  return candidates;
}

function diffFor(modelVersion) {
  return modelVersion?.diff || {};
}

function weightsForIndustry(modelVersion, industry, baselinePackage) {
  const source = baselinePackage.weights[industry];
  assertContract(Array.isArray(source), "INDUSTRY_WEIGHT_SET_MISSING", `No source weight set exists for ${industry}.`);
  const multipliers = diffFor(modelVersion).weightMultipliers || {};
  const weighted = source.map((weight, index) => weight * (multipliers[baselinePackage.indicatorOrder[index]] || 1));
  const total = weighted.reduce((sum, value) => sum + value, 0);
  const normalized = weighted.map((value) => (value / total) * 100);
  assertContract(Math.abs(normalized.reduce((sum, value) => sum + value, 0) - 100) < 1e-9, "WEIGHTS_NOT_NORMALIZED", "Candidate metric weights must sum to 100%.", { industry });
  return normalized;
}

function factorMultiplier(modelVersion, factorId) {
  return diffFor(modelVersion).factorCoefficientMultipliers?.[factorId] || 1;
}

function factorRiskCoefficient(factor, modelVersion) {
  const minimum = Math.min(...factor.tiers.map((tier) => Number(tier.coefficient) || 0));
  return minimum * factorMultiplier(modelVersion, factor.factorId);
}

function tierForScore(score, modelVersion, baselinePackage) {
  const shifts = diffFor(modelVersion).tierMinimumShift || {};
  const tiers = baselinePackage.riskTiers.map((tier) => ({ ...tier, effectiveMinimum: tier.minInclusive + (shifts[tier.tierId] || 0) }));
  return tiers.find((tier) => score >= tier.effectiveMinimum) || tiers[tiers.length - 1];
}

function modelIdentity(modelVersion) {
  return {
    modelVersionId: modelVersion.modelVersionId,
    modelVersion: modelVersion.modelVersion,
    immutable: modelVersion.immutable,
    definitionFingerprint: modelVersion.definitionFingerprint
  };
}

function scoreSyntheticObservation(observation, modelVersion, baselinePackage) {
  const missingMetricIndexes = observation.metricRiskSignals.map((value, index) => value === null ? index : null).filter((value) => value !== null);
  const missingFactorIndexes = observation.factorRiskSignals.map((value, index) => value === null ? index : null).filter((value) => value !== null);
  const available = baselinePackage.indicatorOrder.length + baselinePackage.factors.length - missingMetricIndexes.length - missingFactorIndexes.length;
  const coverage = round(available / (baselinePackage.indicatorOrder.length + baselinePackage.factors.length), 4);
  if (missingMetricIndexes.length || missingFactorIndexes.length) {
    return { status: "DATA_INSUFFICIENT", riskScore: null, riskIndex: null, predictedRiskTier: null, coverage, topContributors: [], missingMetricIndexes, missingFactorIndexes };
  }
  const weights = weightsForIndustry(modelVersion, observation.industry, baselinePackage);
  const rawScore = observation.metricRiskSignals.reduce((sum, riskSignal, index) => sum + (1 - riskSignal) * weights[index], 0);
  const factorSum = observation.factorRiskSignals.reduce((sum, riskSignal, index) => {
    const factor = baselinePackage.factors[index];
    if (!factor.applicableCategories.includes("ALL") && !factor.applicableCategories.includes(observation.industry)) return sum;
    return sum + factorRiskCoefficient(factor, modelVersion) * riskSignal;
  }, 0);
  const scoreScale = diffFor(modelVersion).scoreScale || 1;
  const scoreOffset = diffFor(modelVersion).scoreOffset || 0;
  const riskScore = round(clamp(((rawScore * scoreScale) + scoreOffset) * (1 + factorSum), 0, 100), 4);
  const riskIndex = round(100 - riskScore, 4);
  const tier = tierForScore(riskScore, modelVersion, baselinePackage);
  const metricContributions = observation.metricRiskSignals.map((riskSignal, index) => ({
    id: `METRIC-${index + 1}`,
    name: baselinePackage.indicatorOrder[index],
    kind: "METRIC",
    value: riskSignal,
    contribution: round(riskSignal * weights[index], 4)
  }));
  const factorContributions = observation.factorRiskSignals.map((riskSignal, index) => ({
    id: baselinePackage.factors[index].factorId,
    name: baselinePackage.factors[index].name,
    kind: "FACTOR",
    value: riskSignal,
    contribution: round(Math.abs(factorRiskCoefficient(baselinePackage.factors[index], modelVersion) * riskSignal * 100), 4)
  }));
  return {
    status: "SUCCEEDED",
    riskScore,
    riskIndex,
    predictedRiskTier: tier.tierId,
    predictedRiskTierName: tier.name,
    coverage,
    topContributors: [...metricContributions, ...factorContributions].sort((a, b) => b.contribution - a.contribution).slice(0, 5),
    missingMetricIndexes: [],
    missingFactorIndexes: [],
    modelIdentity: modelIdentity(modelVersion)
  };
}

function averagePrecision(ranked) {
  const positives = ranked.filter((item) => item.outcome.adverseOutcome).length;
  if (!positives) return null;
  let seenPositive = 0;
  let sumPrecision = 0;
  ranked.forEach((item, index) => {
    if (!item.outcome.adverseOutcome) return;
    seenPositive += 1;
    sumPrecision += seenPositive / (index + 1);
  });
  return round(sumPrecision / positives, 6);
}

function sliceMetrics(scoredRows, dimension, capacityRatio) {
  const values = [...new Set(scoredRows.map((item) => item[dimension]))];
  return values.map((value) => {
    const rows = scoredRows.filter((item) => item[dimension] === value);
    const positiveCount = rows.filter((item) => item.outcome.adverseOutcome).length;
    const capacity = Math.max(1, Math.ceil(rows.length * capacityRatio));
    const selected = [...rows].sort((a, b) => b.result.riskIndex - a.result.riskIndex).slice(0, capacity);
    const truePositive = selected.filter((item) => item.outcome.adverseOutcome).length;
    return {
      dimension,
      value,
      sampleCount: rows.length,
      positiveCount,
      recallAtFixedCapacity: positiveCount ? round(truePositive / positiveCount, 6) : null,
      status: positiveCount ? "EVALUATED" : "NO_POSITIVE_LABELS"
    };
  });
}

function distributionDiagnostics({ observations, modelVersion, baselinePackage, referenceObservations = [] }) {
  const currentResults = observations.map((observation) => scoreSyntheticObservation(observation, modelVersion, baselinePackage));
  const referenceResults = referenceObservations.map((observation) => scoreSyntheticObservation(observation, modelVersion, baselinePackage));
  const currentScores = currentResults.map((item) => item.riskIndex).filter(Number.isFinite);
  const referenceScores = referenceResults.map((item) => item.riskIndex).filter(Number.isFinite);
  const currentMean = mean(currentScores);
  const referenceMean = mean(referenceScores);
  const meanShift = Number.isFinite(currentMean) && Number.isFinite(referenceMean) ? round((currentMean - referenceMean) / 100, 6) : null;
  const featureShifts = baselinePackage.indicatorOrder.map((name, index) => {
    const current = mean(observations.map((row) => row.metricRiskSignals[index]).filter(Number.isFinite));
    const reference = mean(referenceObservations.map((row) => row.metricRiskSignals[index]).filter(Number.isFinite));
    return { id: `METRIC-${index + 1}`, name, meanShift: Number.isFinite(current) && Number.isFinite(reference) ? round(current - reference, 6) : null };
  });
  const finiteShifts = featureShifts.map((item) => Math.abs(item.meanShift)).filter(Number.isFinite);
  const totalCells = observations.length * (baselinePackage.indicatorOrder.length + baselinePackage.factors.length);
  const missingCells = observations.reduce((sum, row) => sum + row.metricRiskSignals.filter((value) => value === null).length + row.factorRiskSignals.filter((value) => value === null).length, 0);
  return {
    stability: {
      scoreMeanShift: meanShift,
      status: meanShift === null ? "REFERENCE_UNAVAILABLE" : Math.abs(meanShift) <= 0.05 ? "STABLE" : "WATCH"
    },
    missingRate: totalCells ? round(missingCells / totalCells, 6) : null,
    drift: {
      maximumAbsoluteFeatureMeanShift: finiteShifts.length ? round(Math.max(...finiteShifts), 6) : null,
      status: finiteShifts.length ? Math.max(...finiteShifts) <= 0.08 ? "STABLE" : "WATCH" : "REFERENCE_UNAVAILABLE",
      worstFeatures: featureShifts.filter((item) => item.meanShift !== null).sort((a, b) => Math.abs(b.meanShift) - Math.abs(a.meanShift)).slice(0, 3)
    }
  };
}

export function evaluateS003Model({ observations, referenceObservations = [], modelVersion, baselinePackage, benchmark }) {
  const scored = observations.map((observation) => ({ ...observation, result: scoreSyntheticObservation(observation, modelVersion, baselinePackage) }));
  const matured = scored.filter((item) => item.outcome.labelMatured);
  const censoredInterventionCount = matured.filter((item) => !item.outcome.adverseOutcome && item.outcome.interventionFlag).length;
  const eligible = matured.filter((item) => item.outcome.adverseOutcome || !item.outcome.interventionFlag);
  const scoredEligible = eligible.filter((item) => Number.isFinite(item.result.riskIndex));
  const positiveCount = scoredEligible.filter((item) => item.outcome.adverseOutcome).length;
  const labelSufficient = scoredEligible.length >= benchmark.minimumMaturedLabels && positiveCount >= 3;
  const ranked = [...scoredEligible].sort((a, b) => b.result.riskIndex - a.result.riskIndex || a.sampleId.localeCompare(b.sampleId));
  const capacity = scoredEligible.length ? Math.max(1, Math.ceil(scoredEligible.length * benchmark.fixedCapacityRatio)) : 0;
  const selected = ranked.slice(0, capacity);
  const truePositive = selected.filter((item) => item.outcome.adverseOutcome).length;
  const falsePositive = selected.length - truePositive;
  const missedCount = positiveCount - truePositive;
  const leadTimes = selected.filter((item) => item.outcome.adverseOutcome).map((item) => (Date.parse(item.outcome.observedAt) - Date.parse(`${item.predictionAsOf}T00:00:00.000Z`)) / DAY_MS);
  const diagnostics = distributionDiagnostics({ observations, modelVersion, baselinePackage, referenceObservations });
  const metrics = {
    recallAtFixedCapacity: labelSufficient && positiveCount ? round(truePositive / positiveCount, 6) : null,
    prAuc: labelSufficient ? averagePrecision(ranked) : null,
    precisionAtTop20Percent: labelSufficient && selected.length ? round(truePositive / selected.length, 6) : null,
    missedAdverseOutcomeCount: labelSufficient ? missedCount : null,
    medianLeadTimeDays: labelSufficient ? round(median(leadTimes), 2) : null,
    coverage: observations.length ? round(scored.length / observations.length, 6) : null,
    scoredCoverage: observations.length ? round(scored.filter((item) => Number.isFinite(item.result.riskIndex)).length / observations.length, 6) : null,
    worstSlices: labelSufficient
      ? [...sliceMetrics(scoredEligible, "industry", benchmark.fixedCapacityRatio), ...sliceMetrics(scoredEligible, "operatingStage", benchmark.fixedCapacityRatio)]
          .filter((item) => item.recallAtFixedCapacity !== null)
          .sort((a, b) => a.recallAtFixedCapacity - b.recallAtFixedCapacity)
          .slice(0, 4)
      : [],
    stability: diagnostics.stability,
    missingRate: diagnostics.missingRate,
    drift: diagnostics.drift
  };
  return {
    resourceKind: "BenchmarkReport",
    reportId: `BR-${modelVersion.modelVersionId}-${sha256({ sampleIds: observations.map((item) => item.sampleId), benchmark: benchmark.benchmarkVersion }).slice(0, 12)}`,
    objectiveId: S003_OBJECTIVE_ID,
    modelVersionId: modelVersion.modelVersionId,
    modelVersion: modelVersion.modelVersion,
    status: labelSufficient ? "EVALUATED" : "INSUFFICIENT_LABELS",
    conclusion: labelSufficient ? "仅形成 synthetic 研究评测结果，不证明正式模型有效性。" : "成熟独立标签不足，无法评价模型有效性。",
    fixedContext: {
      benchmarkVersion: benchmark.benchmarkVersion,
      datasetSplitVersion: benchmark.datasetSplitVersion,
      datasetSplits: [...new Set(observations.map((item) => item.split))],
      evaluatorVersion: benchmark.evaluatorVersion,
      metricSchemaVersion: benchmark.metricSchemaVersion,
      dataVersion: benchmark.dataVersion,
      outcomeDataVersion: benchmark.outcomeDataVersion,
      fixedCapacityRatio: benchmark.fixedCapacityRatio,
      holdoutUsed: observations.some((item) => item.split === "HOLDOUT")
    },
    labels: {
      maturedCount: matured.length,
      eligibleCount: eligible.length,
      positiveCount,
      negativeCount: scoredEligible.length - positiveCount,
      censoredInterventionCount,
      minimumRequired: benchmark.minimumMaturedLabels,
      status: labelSufficient ? "SUFFICIENT_FOR_SYNTHETIC_EVALUATION" : "INSUFFICIENT_LABELS"
    },
    fixedCapacity: { ratio: benchmark.fixedCapacityRatio, count: capacity, truePositive, falsePositive },
    metrics,
    metricSchema: [
      { id: "recallAtFixedCapacity", name: "固定处置容量下重大事件召回率", role: "PRIMARY", higherIsBetter: true },
      { id: "prAuc", name: "PR-AUC", role: "SECONDARY", higherIsBetter: true },
      { id: "precisionAtTop20Percent", name: "Precision@Top20%", role: "SECONDARY", higherIsBetter: true },
      { id: "missedAdverseOutcomeCount", name: "漏报数量", role: "RISK", higherIsBetter: false },
      { id: "medianLeadTimeDays", name: "中位提前预警时间", role: "SECONDARY", higherIsBetter: true },
      { id: "coverage", name: "覆盖率", role: "QUALITY", higherIsBetter: true }
    ],
    rankedSampleEvidence: ranked.map((item, index) => ({ sampleId: item.sampleId, rank: index + 1, selectedAtFixedCapacity: index < capacity, adverseOutcome: item.outcome.adverseOutcome, interventionFlag: item.outcome.interventionFlag, riskIndex: item.result.riskIndex, evidenceRef: item.outcome.evidenceRef })),
    validityClaimAllowed: false,
    sourceFactsCopied: false,
    benchmarkClassification: "SYNTHETIC_DEIDENTIFIED_RESEARCH_ONLY"
  };
}

function fixedSubjectWeights(modelVersion, subject, baselinePackage) {
  if (subject.isUnderConstruction) return subject.indicatorResults.map(() => 0);
  return weightsForIndustry(modelVersion, subject.enterprise.category, baselinePackage);
}

function scoreFixedSubject(subject, modelVersion, baselinePackage) {
  const weights = fixedSubjectWeights(modelVersion, subject, baselinePackage);
  const baselineWeights = subject.indicatorResults.map((item) => Number(item.weight) * 100);
  const indicatorAvailable = subject.isUnderConstruction
    ? 15
    : subject.indicatorResults.filter((item) => Number.isFinite(item.score) && item.status === "EVALUATED").length;
  const factorAvailable = subject.factorResults.filter((item) => item.state === "APPLIED" || item.state === "NOT_APPLICABLE").length;
  const coverage = round((indicatorAvailable + factorAvailable) / 21, 4);
  if (indicatorAvailable < 15 || factorAvailable < 6) {
    return { status: "DATA_INSUFFICIENT", riskScore: null, riskIndex: null, predictedRiskTier: null, coverage, topContributors: [] };
  }
  const rawScore = subject.isUnderConstruction
    ? Number(baselinePackage.assessment.underConstructionRawScore)
    : subject.indicatorResults.reduce((sum, item, index) => sum + Number(item.score) * (weights[index] / 100), 0);
  const factorSum = subject.factorResults.reduce((sum, item) => sum + Number(item.coefficient || 0) * factorMultiplier(modelVersion, item.factorId), 0);
  const scoreScale = diffFor(modelVersion).scoreScale || 1;
  const scoreOffset = diffFor(modelVersion).scoreOffset || 0;
  const riskScore = round(clamp(((rawScore * scoreScale) + scoreOffset) * (1 + factorSum), 0, 100), 2);
  const riskIndex = round(100 - riskScore, 2);
  const tier = tierForScore(riskScore, modelVersion, baselinePackage);
  const metricContributors = subject.indicatorResults.map((item, index) => {
    const baselineContribution = round((100 - Number(item.score)) * (baselineWeights[index] / 100), 4);
    const contribution = round((100 - Number(item.score)) * (weights[index] / 100), 4);
    return { id: `METRIC-${index + 1}`, name: item.name, kind: "METRIC", value: item.actualValue, contribution, baselineContribution, delta: round(contribution - baselineContribution, 4) };
  });
  const factorContributors = subject.factorResults.map((item) => {
    const baselineContribution = round(-Number(item.coefficient || 0) * rawScore, 4);
    const contribution = round(-Number(item.coefficient || 0) * factorMultiplier(modelVersion, item.factorId) * rawScore, 4);
    return { id: item.factorId, name: item.name, kind: "FACTOR", value: item.inputValue, contribution, baselineContribution, delta: round(contribution - baselineContribution, 4) };
  });
  return {
    status: "SUCCEEDED",
    riskScore,
    riskIndex,
    predictedRiskTier: tier.tierId,
    predictedRiskTierName: tier.name,
    coverage,
    topContributors: [...metricContributors, ...factorContributors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 6)
  };
}

function groupedSummary(subjects, key) {
  return [...new Set(subjects.map((item) => item[key]))].map((value) => {
    const rows = subjects.filter((item) => item[key] === value);
    const tierCounts = Object.fromEntries(["GREEN", "YELLOW", "RED", "BLACK"].map((tier) => [tier, rows.filter((item) => item.predictedRiskTier === tier).length]));
    return { value, count: rows.length, averageRiskScore: round(mean(rows.map((item) => item.riskScore).filter(Number.isFinite)), 2), averageRiskIndex: round(mean(rows.map((item) => item.riskIndex).filter(Number.isFinite)), 2), tierCounts };
  });
}

export function createS003ResultEnvelope({ fixedResultSet, baselinePackage, candidate, benchmarkReport = null, shadowTrial = null, usageIntent = "WHAT_IF", enterpriseIds = null, formedAt = "2026-08-31T00:00:00.000Z" }) {
  assertContract(candidate && candidate.status !== "DATA_REQUIRED", "DATA_REQUIRED", "A runnable evaluated candidate is required for fixed-data recalculation.");
  assertContract(["WHAT_IF", "SHADOW"].includes(usageIntent), "USAGE_INTENT_INVALID", "S003 candidate results must use WHAT_IF or SHADOW intent.");
  const selected = Array.isArray(enterpriseIds) && enterpriseIds.length
    ? fixedResultSet.results.filter((item) => enterpriseIds.includes(item.enterprise.enterpriseId))
    : fixedResultSet.results;
  assertContract(selected.length > 0, "ENTERPRISE_SCOPE_EMPTY", "The requested enterprise scope contains no fixed S003 subjects.");
  const subjects = selected.map((subject) => {
    const result = scoreFixedSubject(subject, candidate.modelVersion, baselinePackage);
    return {
      objectId: subject.enterprise.enterpriseId,
      enterpriseId: subject.enterprise.enterpriseId,
      objectName: subject.enterprise.name,
      enterpriseName: subject.enterprise.name,
      industry: subject.enterprise.category,
      operatingStage: subject.isUnderConstruction ? "建设阶段" : "经营阶段",
      riskScore: result.riskScore,
      riskIndex: result.riskIndex,
      predictedRiskTier: result.predictedRiskTier,
      predictedRiskTierName: result.predictedRiskTierName,
      topContributors: result.topContributors,
      coverage: result.coverage,
      baseline: {
        resultKind: "FACT",
        resultId: subject.resultId,
        riskScore: subject.finalScore,
        riskIndex: round(100 - subject.finalScore, 2),
        predictedRiskTier: subject.riskTier.tierId,
        predictedRiskTierName: subject.riskTier.name,
        scenarioRunId: subject.scenarioIdentity.scenarioRunId
      },
      evidenceRefs: [subject.resultId, S003_FIXED_RESULT_SOURCE.sourceRef],
      formalFactMutated: false
    };
  });
  const riskDistribution = Object.fromEntries(["GREEN", "YELLOW", "RED", "BLACK"].map((tier) => [tier, subjects.filter((item) => item.predictedRiskTier === tier).length]));
  const migrationRows = [];
  for (const from of ["GREEN", "YELLOW", "RED", "BLACK"]) {
    for (const to of ["GREEN", "YELLOW", "RED", "BLACK"]) {
      migrationRows.push({ from, to, count: subjects.filter((item) => item.baseline.predictedRiskTier === from && item.predictedRiskTier === to).length });
    }
  }
  const resultId = `PRED-S003-${candidate.modelVersion.modelVersionId}-${sha256({ enterpriseIds: subjects.map((item) => item.enterpriseId), usageIntent, dataVersion: S003_FIXED_RESULT_SOURCE.dataVersion, formedAt }).slice(0, 12)}`;
  const researchRunId = `M08-S003-RECALC-${sha256({ resultId, formedAt }).slice(0, 12)}`;
  return {
    schemaVersion: "ofw.modeling.result-envelope.v1",
    resourceKind: "ModelingResultEnvelope",
    resultId,
    resultKind: "PREDICTION",
    usageIntent,
    objectiveId: S003_OBJECTIVE_ID,
    modelVersionId: candidate.modelVersion.modelVersionId,
    modelVersion: candidate.modelVersion.modelVersion,
    modelVersionFingerprint: candidate.modelVersion.definitionFingerprint,
    baselineModelVersion: "1.0.2",
    baselineModelVersionId: "MV-S003-DEBT-RISK-1.0.2-REFERENCE",
    bindingId: "MB-S003-DEBT-RISK-v1",
    bindingRevision: 1,
    dataVersion: S003_FIXED_RESULT_SOURCE.dataVersion,
    assessmentAsOf: fixedResultSet.assessmentAt,
    asOf: fixedResultSet.assessmentAt,
    benchmarkRunId: benchmarkReport?.benchmarkRunId || benchmarkReport?.reportId || null,
    shadowTrialId: shadowTrial?.shadowTrialId || null,
    formedAt,
    runId: researchRunId,
    researchRunId,
    scenarioRunId: null,
    inputSnapshot: {
      scenarioContext: clone(fixedResultSet.scenarioIdentity),
      scenarioId: fixedResultSet.scenarioIdentity.scenarioId,
      scenarioVersion: fixedResultSet.scenarioIdentity.scenarioVersion,
      scenarioRunId: fixedResultSet.scenarioIdentity.scenarioRunId,
      formedAt: fixedResultSet.scenarioIdentity.formedAt,
      status: fixedResultSet.scenarioIdentity.status,
      dataVersion: S003_FIXED_RESULT_SOURCE.dataVersion,
      assessmentAsOf: fixedResultSet.assessmentAt,
      sourceMode: "READ_ONLY_FIXED_RESULT_INPUT"
    },
    permissions: { reportAccess: false, actionAccess: false, factWriteAllowed: false },
    subjects,
    summaries: {
      riskDistribution,
      industrySlices: groupedSummary(subjects, "industry"),
      stageSlices: groupedSummary(subjects, "operatingStage"),
      migrationMatrix: { tiers: ["GREEN", "YELLOW", "RED", "BLACK"], rows: migrationRows },
      benchmark: benchmarkReport ? { reportId: benchmarkReport.reportId, status: benchmarkReport.status, metrics: clone(benchmarkReport.metrics) } : null
    },
    sourceLineage: {
      fixedResultSource: clone(S003_FIXED_RESULT_SOURCE),
      baselineModelSource: clone(S003_BASELINE_SOURCE),
      fixedResultSetId: fixedResultSet.resultSetId,
      archivedScenarioRunId: fixedResultSet.scenarioIdentity.scenarioRunId,
      archivedScenarioRunReadOnly: true
    },
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    simulationSubstitutesFact: false,
    formalFactsMutated: false,
    archivedScenarioRunMutated: false,
    sideEffectsEmitted: 0
  };
}

export function candidateWeightAudit(candidate, baselinePackage) {
  return Object.keys(baselinePackage.weights).map((industry) => ({
    industry,
    totalPercent: round(weightsForIndustry(candidate.modelVersion, industry, baselinePackage).reduce((sum, value) => sum + value, 0), 8),
    semanticOrderPreserved: true
  }));
}
