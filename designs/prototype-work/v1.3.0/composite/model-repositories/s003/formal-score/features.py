"""Shared deterministic feature helpers for this model repository."""

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
