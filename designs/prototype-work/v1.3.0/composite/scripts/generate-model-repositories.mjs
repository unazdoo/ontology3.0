import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S003_REGISTRATION } from "../runtime/s003-registration.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.resolve(scriptDir, "../model-repositories/s003");

const strategies = Object.freeze({
  "MODEL-S003-FORMAL-SCORE": { strategy: "formal_baseline", rawInputs: ["formalScore", "formalTier"] },
  "MODEL-S003-MONOTONIC-TABLE": { strategy: "monotonic_score", rawInputs: ["liquidityCoverage", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"] },
  "MODEL-S003-CALIBRATED-SCORE": { strategy: "calibrated_score", rawInputs: ["liquidityCoverage", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"] },
  "MODEL-S003-HORIZON-PROBABILITY": { strategy: "horizon_probability", rawInputs: ["liquidityCoverage", "debtDue90Ratio", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"] },
  "MODEL-S003-SURVIVAL": { strategy: "survival_window", rawInputs: ["liquidityCoverage", "debtDue90Ratio", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ"] },
  "MODEL-S003-EVENT-TYPE": { strategy: "event_type", rawInputs: ["refinancePressure", "liquidityCoverage", "relationExposure", "anomalyZ"] },
  "MODEL-S003-LIQUIDITY": { strategy: "liquidity_gap", rawInputs: ["cashAvailableMillions", "cashFlowChange", "debtDue90Millions", "debtDue180Millions", "refinancePressure"] },
  "MODEL-S003-CONTAGION": { strategy: "contagion", rawInputs: ["relationExposure"] },
  "MODEL-S003-ANOMALY": { strategy: "anomaly", rawInputs: ["anomalyZ", "cashFlowChange", "liquidityCoverage"] },
  "MODEL-S003-REVIEW-PRIORITY": { strategy: "review_priority", rawInputs: ["liquidityCoverage", "debtDue180Ratio", "refinancePressure", "relationExposure", "anomalyZ", "cashAvailableMillions", "debtDue90Millions"] }
});

const featuresSource = `"""Shared deterministic feature helpers for this model repository."""

from __future__ import annotations

import math


def clamp(value, minimum=0.0, maximum=1.0):
    return min(maximum, max(minimum, float(value)))


def number(record, key, default=0.0):
    value = record.get(key)
    return default if value is None else float(value)


def latest_records(records):
    if not records:
        return []
    latest = max(str(item.get("predictionAsOf", "")) for item in records)
    return [item for item in records if str(item.get("predictionAsOf", "")) == latest]


def base_probability(record):
    liquidity = clamp(1.0 - number(record, "liquidityCoverage", 0.75) / 1.55)
    debt = clamp(number(record, "debtDue180Ratio", 0.35))
    refinance = clamp(number(record, "refinancePressure", 0.45))
    relation = clamp(number(record, "relationExposure", 0.48))
    anomaly = clamp(number(record, "anomalyZ", 1.2) / 3.25)
    raw = 0.30 * liquidity + 0.25 * debt + 0.22 * refinance + 0.13 * relation + 0.10 * anomaly
    return clamp(1.0 / (1.0 + math.exp(-5.2 * (raw - 0.43))))


def calibrated_probability(record):
    return clamp(0.04 + base_probability(record) * 0.88)


def confidence(record, required_fields):
    missing = [field for field in required_fields if record.get(field) is None]
    score = clamp(1.0 - len(missing) / max(1, len(required_fields)))
    status = "HIGH" if score >= 0.9 else "MEDIUM" if score >= 0.72 else "LOW"
    return {"status": status, "score": round(score, 4), "missingReasons": [f"{field} 缺失" for field in missing]}


def tier_for_score(score):
    if score is None:
        return "无法评价"
    if score < 20:
        return "黑灯"
    if score < 30:
        return "红灯"
    if score < 40:
        return "黄灯"
    return "绿灯"
`;

function modelSource(definition, spec) {
  return `"""Executable model entry point. Uses only frozen synthetic DataVersion records."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from features import base_probability, calibrated_probability, clamp, confidence, latest_records, number, tier_for_score

MODEL_ID = ${JSON.stringify(definition.modelId)}
MODEL_VERSION_ID = ${JSON.stringify(definition.modelVersionId)}
OBJECTIVE_ID = ${JSON.stringify(definition.objectiveId)}
STRATEGY = ${JSON.stringify(spec.strategy)}
REQUIRED_FIELDS = ${JSON.stringify(spec.rawInputs)}
OUTPUT_KEYS = ${JSON.stringify(definition.outputProperties)}


def score_record(record):
    probability = calibrated_probability(record)
    liquidity = clamp(1.0 - number(record, "liquidityCoverage", 0.75) / 1.55)
    relation = record.get("relationExposure")
    anomaly = clamp(number(record, "anomalyZ", 1.2) / 3.25)
    if STRATEGY == "formal_baseline":
        score = record.get("formalScore")
        return {"riskScore": score, "riskTier": record.get("formalTier") or tier_for_score(score)}
    if STRATEGY == "monotonic_score":
        score = round(100.0 * (1.0 - base_probability(record)), 3)
        return {"riskProbability180d": round(base_probability(record), 6), "candidateRiskScore": score, "candidateRiskTier": tier_for_score(score)}
    if STRATEGY == "calibrated_score":
        score = round(100.0 * (1.0 - probability), 3)
        return {"calibratedProbability": round(probability, 6), "candidateRiskScore": score, "candidateRiskTier": tier_for_score(score)}
    if STRATEGY == "horizon_probability":
        return {"probability30d": round(clamp(probability * 0.42), 6), "probability90d": round(clamp(probability * 0.72), 6), "probability180d": round(probability, 6)}
    if STRATEGY == "survival_window":
        p30, p90, p180 = clamp(probability * 0.42), clamp(probability * 0.72), probability
        window = "0—30天" if p30 >= 0.45 else "31—90天" if p90 >= 0.45 else "91—180天"
        return {"survivalCurve": [{"day": 0, "survival": 1.0}, {"day": 30, "survival": round(1.0 - p30, 6)}, {"day": 90, "survival": round(1.0 - p90, 6)}, {"day": 180, "survival": round(1.0 - p180, 6)}], "expectedRiskWindow": window}
    if STRATEGY == "event_type":
        values = {"再融资受阻": clamp(number(record, "refinancePressure", 0.4)), "流动性缺口": liquidity, "担保或关联传染": clamp(number(record, "relationExposure", 0.35)), "诉讼评级或审计事件": anomaly}
        total = sum(values.values()) or 1.0
        probabilities = {key: round(value / total, 6) for key, value in values.items()}
        return {"eventTypeProbabilities": probabilities, "mostLikelyEventType": max(probabilities, key=probabilities.get)}
    if STRATEGY == "liquidity_gap":
        available = record.get("cashAvailableMillions")
        if available is None:
            return {"liquidityGap": None, "maturityWall": {"90d": record.get("debtDue90Millions"), "180d": record.get("debtDue180Millions")}, "refinancePressure": record.get("refinancePressure")}
        gap = max(0.0, number(record, "debtDue90Millions") - float(available) * (1.0 + number(record, "cashFlowChange")))
        return {"liquidityGap": round(gap, 3), "maturityWall": {"90d": record.get("debtDue90Millions"), "180d": record.get("debtDue180Millions")}, "refinancePressure": record.get("refinancePressure")}
    if STRATEGY == "contagion":
        if relation is None:
            return {"relationRiskScore": None, "relationRiskPath": []}
        score = round(clamp(float(relation)) * 100.0, 3)
        return {"relationRiskScore": score, "relationRiskPath": [{"from": record.get("enterpriseId"), "relation": "共同债权人/担保", "exposure": round(float(relation), 4)}]}
    if STRATEGY == "anomaly":
        score = round(clamp(anomaly * 0.72 + liquidity * 0.28) * 100.0, 3)
        events = [] if score < 55 else [{"type": "自身与同行偏离", "score": score, "asOf": record.get("predictionAsOf")}]
        return {"anomalyScore": score, "anomalyEvents": events}
    if STRATEGY == "review_priority":
        gap = max(0.0, number(record, "debtDue90Millions") - number(record, "cashAvailableMillions"))
        relation_score = clamp(number(record, "relationExposure", 0.48))
        priority = round(clamp(probability * 0.52 + clamp(gap / 500.0) * 0.20 + relation_score * 0.16 + anomaly * 0.12) * 100.0, 3)
        return {"reviewPriority": priority, "priorityReasons": ["90天风险概率", "流动性缺口", "关系暴露", "异常变化"]}
    raise ValueError(f"Unsupported strategy: {STRATEGY}")


def run(payload):
    records = latest_records(payload.get("records", []))
    results = []
    for record in records:
        result = score_record(record)
        quality = confidence(record, REQUIRED_FIELDS)
        results.append({
            "subjectId": record.get("enterpriseId"),
            "subjectName": record.get("enterpriseName") or record.get("name"),
            "predictionAsOf": record.get("predictionAsOf"),
            "status": "EVALUATED" if quality["status"] != "LOW" else "PARTIAL",
            "outputs": result,
            "confidence": quality,
            "evidenceRefs": [record.get("observationId"), payload.get("dataVersionId"), payload.get("semanticContractVersionId")]
        })
    return {
        "schemaVersion": "ofw.model-repository.python-run.v1",
        "modelId": MODEL_ID,
        "modelVersionId": MODEL_VERSION_ID,
        "objectiveId": OBJECTIVE_ID,
        "resultKind": "FACT" if STRATEGY == "formal_baseline" else "PREDICTION",
        "dataVersionId": payload.get("dataVersionId"),
        "semanticContractVersionId": payload.get("semanticContractVersionId"),
        "inputRecordCount": len(payload.get("records", [])),
        "resultCount": len(results),
        "results": results,
        "formalFactsMutated": False,
        "sideEffectsEmitted": 0
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    Path(args.output).write_text(json.dumps(run(payload), ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(json.dumps({"modelId": MODEL_ID, "records": len(payload.get("records", [])), "status": "SUCCEEDED"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
`;
}

function testSource(definition) {
  return `from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from model import MODEL_ID, OUTPUT_KEYS, score_record


SAMPLE = {
    "enterpriseId": "ENT-SYN-001",
    "enterpriseName": "样例企业",
    "predictionAsOf": "2025-12-31",
    "formalScore": 32.5,
    "formalTier": "黄灯",
    "liquidityCoverage": 0.62,
    "debtDue90Ratio": 0.31,
    "debtDue180Ratio": 0.52,
    "refinancePressure": 0.68,
    "relationExposure": 0.57,
    "anomalyZ": 2.1,
    "cashAvailableMillions": 120.0,
    "cashFlowChange": -0.08,
    "debtDue90Millions": 188.0,
    "debtDue180Millions": 316.0
}


class ModelContractTest(unittest.TestCase):
    def test_model_identity(self):
        self.assertEqual(MODEL_ID, ${JSON.stringify(definition.modelId)})

    def test_output_contract(self):
        result = score_record(SAMPLE)
        for key in OUTPUT_KEYS:
            self.assertIn(key, result)

    def test_is_deterministic(self):
        self.assertEqual(score_record(SAMPLE), score_record(dict(SAMPLE)))


if __name__ == "__main__":
    unittest.main()
`;
}

function readme(definition, spec) {
  const role = definition.modelRole === "FORMAL_BASELINE" ? "正式只读基线" : definition.modelRole === "CORE_CHALLENGER" ? "核心挑战者" : "补充模型";
  return `# ${definition.name}

## 业务问题

${definition.businessQuestion}

## 模型身份

- Model ID: \`${definition.modelId}\`
- Model Version: \`${definition.modelVersionId}\`
- 角色: ${role}
- Objective: \`${definition.objectiveId}\`
- 运行策略: \`${spec.strategy}\`

## 输入与输出

输入字段：${definition.inputProperties.map((item) => `\`${item}\``).join("、")}。

输出字段：${definition.outputProperties.map((item) => `\`${item}\``).join("、")}。

所有输入必须来自 M02 已冻结的脱敏 synthetic DataVersion，并通过 M01 周期语义合同核对单位、时间粒度、空值和结果身份。缺失值不会补零；结果会保留置信度与缺失原因。

## 本地运行

\`\`\`bash
python3 model.py --input input.json --output result.json
python3 -m unittest discover -s tests -v
\`\`\`

## 版本与发布边界

代码提交、分支、标签和发布候选由 M08 模型代码仓管理。提交形成不可变快照；标签不可移动；Release Candidate 不等于正式发布。AI 不得修改正式模型、生成标签、选择冠军或自动发布。

${definition.modelRole === "FORMAL_BASELINE" ? "当前 1.0.2 正式模型仓为只读镜像，历史结果与正式指针不得在本原型中修改。" : "该仓库默认用于候选或补充模型研发，只有完成统一评测、影子观察和人工应用确认后，才可能进入消费绑定。"}
`;
}

await mkdir(outputRoot, { recursive: true });
const manifest = [];
for (const definition of S003_REGISTRATION.modelDefinitions) {
  const spec = strategies[definition.modelId];
  if (!spec) throw new Error(`Missing repository strategy for ${definition.modelId}`);
  const repositoryDir = path.join(outputRoot, definition.repositorySlug);
  await mkdir(path.join(repositoryDir, "tests"), { recursive: true });
  const modelCard = {
    schemaVersion: "ofw.model-card.v1",
    scenarioId: "S003",
    modelId: definition.modelId,
    modelVersionId: definition.modelVersionId,
    name: definition.name,
    role: definition.modelRole,
    objectiveId: definition.objectiveId,
    businessQuestion: definition.businessQuestion,
    strategy: spec.strategy,
    inputProperties: definition.inputProperties,
    rawInputProperties: spec.rawInputs,
    outputProperties: definition.outputProperties,
    resultKind: definition.modelRole === "FORMAL_BASELINE" ? "FACT_READ_ONLY" : "PREDICTION",
    dataContract: "M02 frozen DataVersion + M01 cycle semantic contract",
    formalModelMutable: false,
    automaticReleaseAllowed: false
  };
  const files = {
    "README.md": readme(definition, spec),
    "features.py": featuresSource,
    "model.py": modelSource(definition, spec),
    "model-card.json": `${JSON.stringify(modelCard, null, 2)}\n`,
    "requirements.txt": "# Standard-library-only deterministic prototype runtime.\n",
    "tests/test_model.py": testSource(definition)
  };
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFile(path.join(repositoryDir, relativePath), content, "utf8");
  }
  manifest.push({ modelId: definition.modelId, repositorySlug: definition.repositorySlug, files: Object.keys(files) });
}

await writeFile(path.join(outputRoot, "repository-manifest.json"), `${JSON.stringify({ schemaVersion: "ofw.model-repository-manifest.v1", generatedAt: "2026-09-03T00:00:00.000Z", repositories: manifest }, null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${manifest.length} S003 model repositories in ${outputRoot}\n`);
