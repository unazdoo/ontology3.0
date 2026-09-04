"""Executable model entry point. Uses only frozen synthetic DataVersion records."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from features import base_probability, calibrated_probability, clamp, confidence, latest_records, number, tier_for_score

MODEL_ID = "MODEL-S003-MONOTONIC-TABLE"
MODEL_VERSION_ID = "MODEL-S003-MONOTONIC-TABLE@0.1.0"
OBJECTIVE_ID = "MO-S003-FORMAL-DEBT-RISK-SCORE-v1"
STRATEGY = "monotonic_score"
REQUIRED_FIELDS = ["liquidityCoverage","debtDue180Ratio","refinancePressure","relationExposure","anomalyZ"]
OUTPUT_KEYS = ["riskProbability180d","candidateRiskScore","candidateRiskTier"]


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
    Path(args.output).write_text(json.dumps(run(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"modelId": MODEL_ID, "records": len(payload.get("records", [])), "status": "SUCCEEDED"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
