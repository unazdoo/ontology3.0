import test from "node:test";
import assert from "node:assert/strict";
import {
  findCompatibleObjectives,
  getObjective,
  listObjectives,
  projectObjectiveForConsumer,
  validateObjectiveBinding
} from "../src/objective-registry.mjs";

test("objective registry covers four reusable objective kinds", () => {
  const objectives = listObjectives();
  assert.equal(objectives.length, 6);
  assert.deepEqual(
    [...new Set(objectives.map((item) => item.kind))].sort(),
    ["CLASSIFICATION", "FORECAST", "OPTIMIZATION", "SCORING"]
  );
  assert.ok(objectives.every((item) => item.inputCount > 0 && item.outputCount > 0));
  assert.ok(objectives.every((item) => item.businessQuestion.length > 0));
});

test("objective detail separates input, output, release, binding and consumers", () => {
  const objective = getObjective("MO-S001-COST-FORECAST-v1");
  assert.equal(objective.kind, "FORECAST");
  assert.equal(objective.bindingDraft.objectiveId, objective.objectiveId);
  assert.equal(objective.bindingDraft.inputMappings.length, objective.inputContract.length);
  assert.equal(objective.bindingDraft.outputMappings.length, objective.outputContract.length);
  assert.equal(objective.bindingDraft.concreteEndpointExposed, false);
  assert.equal(objective.release.published, false);
  assert.ok(objective.consumers.some((item) => item.consumerId === "M04_DECISION" && item.allowed === false));
  const s005 = getObjective("MO-S005-POST-INVESTMENT-RESEARCH-v1");
  assert.deepEqual(s005.scenarioIds, ["S005"]);
  assert.deepEqual(s005.acceptedObjectTypes, ["InvestmentProduct"]);
  assert.deepEqual(s005.resultKinds, ["PREDICTION", "SIMULATION"]);
  const s003 = getObjective("MO-S003-DEBT-RISK-EARLY-WARNING-v1");
  assert.equal(s003.kind, "SCORING");
  assert.deepEqual(s003.acceptedObjectTypes, ["Enterprise", "EnterpriseAssessmentContext"]);
  assert.equal(s003.baselineModelSource.sourceRef, "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json");
  assert.match(s003.baselineModelSource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(s003.baselineModelSource.copiedIntoM08, false);
  assert.equal(s003.sampleResult.outputs.riskScore, null);
});

test("compatible objective lookup uses the requested Object Type instead of a scenario constant", () => {
  const financingEntity = findCompatibleObjectives({ objectTypeRef: "FinancingEntity@ONT-SYN-S001-FINANCING-v1", useKind: "SIMULATION" });
  assert.deepEqual(financingEntity.map((item) => item.objectiveId), ["MO-S001-COST-FORECAST-v1"]);
  const budget = findCompatibleObjectives({ objectTypeRef: "BudgetUnit" });
  assert.deepEqual(budget.map((item) => item.objectiveId), ["MO-S002-BUDGET-OVERRUN-v1"]);
  const s005 = findCompatibleObjectives({ objectTypeRef: "InvestmentProduct", useKind: "SIMULATION", scenarioId: "S005" });
  assert.deepEqual(s005.map((item) => item.objectiveId), ["MO-S005-POST-INVESTMENT-RESEARCH-v1"]);
  assert.deepEqual(findCompatibleObjectives({ objectTypeRef: "InvestmentProduct", useKind: "PREDICTION", scenarioId: "S005" }).map((item) => item.objectiveId), ["MO-S005-POST-INVESTMENT-RESEARCH-v1"]);
  assert.deepEqual(findCompatibleObjectives({ objectTypeRef: "InvestmentProduct", useKind: "SIMULATION", scenarioId: "S001" }), []);
  const s003 = findCompatibleObjectives({ objectTypeRef: "Enterprise", useKind: "SCORING", scenarioId: "S003" });
  assert.deepEqual(s003.map((item) => item.objectiveId), ["MO-S003-DEBT-RISK-EARLY-WARNING-v1"]);
});

test("generic binding validation passes exact Objective schema and hides runtime topology", () => {
  const validated = validateObjectiveBinding({ objectiveId: "MO-S004-PRELOAN-RISK-v1" });
  assert.equal(validated.compatibility, "VALIDATED");
  assert.equal(validated.concreteEndpointExposed, false);
  assert.equal(validated.t019WriteAllowed, false);
  assert.match(validated.validationFingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(validated), /https?:\/\/|"(?:endpoint|url|credential|secret|token)"\s*:/i);
});

test("generic binding validation rejects unit drift", () => {
  const objective = getObjective("MO-S002-BUDGET-OVERRUN-v1");
  const bad = structuredClone(objective.bindingDraft);
  bad.inputMappings[0].unit = "percent";
  assert.throws(
    () => validateObjectiveBinding({ objectiveId: objective.objectiveId, binding: bad }),
    (error) => error.code === "BINDING_FIELD_MISMATCH"
  );
});

test("consumer projections adapt one result contract to M07, M06, M03 and M05", () => {
  const objectiveId = "MO-S001-COST-FORECAST-v1";
  const m07 = projectObjectiveForConsumer({ objectiveId, consumerId: "M07_EXPLORATION" });
  const m06 = projectObjectiveForConsumer({ objectiveId, consumerId: "M06_REPORT" });
  const m03 = projectObjectiveForConsumer({ objectiveId, consumerId: "M03_QUERY" });
  const m05 = projectObjectiveForConsumer({ objectiveId, consumerId: "M05_AGENT" });
  assert.equal(m07.displayMode, "TIMELINE_OVERLAY");
  assert.equal(getObjective(objectiveId).consumers.find((item) => item.consumerId === "M07_EXPLORATION").moduleId, "m07");
  assert.equal(m06.displayMode, "REPORT_EVIDENCE_TABLE");
  assert.equal(m03.displayMode, "ANSWER_EVIDENCE_CARD");
  assert.equal(m05.displayMode, "EXPLANATION_PANEL");
  assert.ok(m03.outputContract.length < m06.outputContract.length);
  for (const projection of [m07, m06, m03, m05]) {
    assert.equal(projection.concreteEndpointExposed, false);
    assert.equal(projection.factWriteAllowed, false);
    assert.equal(projection.actionWriteAllowed, false);
  }
});

test("M04 consumer projection rejects every non-fact objective result", () => {
  for (const objective of listObjectives()) {
    const projection = projectObjectiveForConsumer({ objectiveId: objective.objectiveId, consumerId: "M04_DECISION" });
    assert.equal(projection.status, "BLOCKED");
    assert.equal(projection.code, "NON_FACT_SOURCE_REJECTED");
    assert.equal(projection.actionWriteAllowed, false);
  }
});
