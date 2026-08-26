import { readFile } from "node:fs/promises";
import { ContractError } from "./errors.mjs";

const fixtureUrl = new URL("../fixtures/s005-synthetic.v1.json", import.meta.url);

function adaptScenario(fixture, scenarioId) {
  if (!scenarioId || scenarioId === "S005") return fixture;
  if (!/^[A-Z][A-Z0-9]{1,15}$/.test(scenarioId)) {
    throw new ContractError("SCENARIO_ID_INVALID", `Invalid research scenario identity: ${scenarioId}`);
  }
  const serialized = JSON.stringify(fixture).replaceAll("S005", scenarioId);
  const adapted = JSON.parse(serialized);
  adapted.sourceContext = {
    ...adapted.sourceContext,
    scenarioId,
    sourceResearch: `m08-${scenarioId.toLowerCase()}-integration`,
    sourceFactsCopied: false,
    note: "字段角色沿用研究夹具，数值、身份和轨迹为合成验证数据。"
  };
  adapted.fixtureId = `FIX-${scenarioId}-SYNTHETIC-v1`;
  adapted.objective.objectiveId = `MO-${scenarioId}-FINANCING-v1`;
  adapted.objective.name = `${scenarioId} 融资模型工程适配（合成验证）`;
  adapted.objective.featureSchemaVersion = `FINANCING-FEATURE-${scenarioId}-v1`;
  adapted.objective.trainingDataVersionId = `DATA-SYN-${scenarioId}-TRAIN-v1`;
  adapted.objective.evaluationDataVersionId = `DATA-SYN-${scenarioId}-EVAL-v1`;
  adapted.objective.evaluationTransactionId = `TX-SYN-${scenarioId}-EVAL-0001`;
  adapted.simulationBaseline.asOf = "2025-12-31";
  adapted.simulationBaseline.sourceSnapshotRef = `DATA-SYN-${scenarioId}-EVAL-v1@TX-SYN-${scenarioId}-EVAL-0001`;
  adapted.candidates.forEach((candidate) => {
    candidate.objectiveId = adapted.objective.objectiveId;
    candidate.modelVersion.featureSchemaVersion = adapted.objective.featureSchemaVersion;
  });
  adapted.ontologyBindingDraft.objectiveId = adapted.objective.objectiveId;
  return adapted;
}

export async function loadFixture({ scenarioId = "S005" } = {}) {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  return structuredClone(adaptScenario(fixture, scenarioId));
}
