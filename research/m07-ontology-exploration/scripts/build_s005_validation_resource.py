#!/usr/bin/env python3
"""Build a de-identified M07 validation resource from read-only S005 snapshots."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from statistics import median
from typing import Any

from openpyxl import load_workbook


NAMESPACE = "ofw.m07.research.v1"
SHEET_NAME = "投资项目每周简报"
DATE_RE = re.compile(r"(20\d{6})")
FIELD_NAMES = {
    "code": "证券代码",
    "name": "证券名称",
    "category1": "投资分类I级",
    "category2": "投资分类II级",
    "region": "区域",
    "branch": "分支机构",
    "quantity": "持仓数量",
    "investmentAmount": "投资金额",
    "yearIncome": "本年度投资收益",
    "marketValue": "当前市值",
    "unrealizedPnl": "浮动盈亏",
    "price": "现价",
    "costPrice": "成本单价",
    "realizedPnl": "本年已实现盈亏",
}
SERIES_FIELDS = ["marketValue", "investmentAmount", "unrealizedPnl", "price"]


def fingerprint(value: str, length: int = 16) -> str:
    return hashlib.sha256(f"{NAMESPACE}|{value}".encode("utf-8")).hexdigest()[:length]


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return None


def iso_date(filename: str) -> str:
    match = DATE_RE.search(filename)
    if not match:
        raise ValueError(f"Snapshot date not found in {filename}")
    raw = match.group(1)
    return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"


def normalized_header(value: Any) -> str:
    return str(value).strip().replace("\n", "") if value not in (None, "") else ""


def read_snapshot(path: Path) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    if SHEET_NAME not in workbook.sheetnames:
        raise ValueError(f"{path.name}: missing sheet {SHEET_NAME}")
    worksheet = workbook[SHEET_NAME]
    header = next(worksheet.iter_rows(min_row=2, max_row=2, values_only=True))
    columns = {normalized_header(value): index for index, value in enumerate(header) if value not in (None, "")}
    missing = [label for label in FIELD_NAMES.values() if label not in columns]
    if missing:
        raise ValueError(f"{path.name}: missing columns {missing}")
    rows: dict[str, dict[str, Any]] = {}
    for values in worksheet.iter_rows(min_row=3, values_only=True):
        code_value = values[columns[FIELD_NAMES["code"]]] if columns[FIELD_NAMES["code"]] < len(values) else None
        if code_value in (None, ""):
            continue
        code = str(code_value).strip()
        if not code or code.lower() == "none":
            continue
        record: dict[str, Any] = {"code": code}
        for key, label in FIELD_NAMES.items():
            if key == "code":
                continue
            index = columns[label]
            value = values[index] if index < len(values) else None
            if isinstance(value, (datetime, date)):
                value = value.isoformat()
            record[key] = value
        rows[code] = record
    workbook.close()
    return {
        "date": iso_date(path.name),
        "file": path.name,
        "sha256": file_sha256(path),
        "rows": rows,
    }


def select_codes(snapshots: list[dict[str, Any]]) -> list[str]:
    stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"seen": 0, "fund": False, "bond": False, "values": []})
    for snapshot in snapshots:
        for code, row in snapshot["rows"].items():
            item = stats[code]
            item["seen"] += 1
            category = str(row.get("category2") or "")
            item["fund"] = item["fund"] or "基金" in category
            item["bond"] = item["bond"] or ("债" in category and "基金" not in category)
            value = as_number(row.get("marketValue"))
            if value is not None:
                item["values"].append(value)

    def variability(item: dict[str, Any]) -> float:
        values = item["values"]
        return (max(values) - min(values)) if values else 0.0

    bond_codes = [code for code, item in stats.items() if item["bond"]]
    fund_codes = [code for code, item in stats.items() if item["fund"]]
    bond_codes.sort(key=lambda code: (-stats[code]["seen"], -variability(stats[code]), fingerprint(code)))
    fund_codes.sort(key=lambda code: (-stats[code]["seen"], -variability(stats[code]), fingerprint(code)))
    selected = bond_codes[:1] + fund_codes[:3]
    if len(selected) < 4:
        remaining = [code for code in stats if code not in selected]
        remaining.sort(key=lambda code: (-stats[code]["seen"], -variability(stats[code]), fingerprint(code)))
        selected.extend(remaining[: 4 - len(selected)])
    return selected


def point_state(row: dict[str, Any] | None, key: str) -> tuple[float | None, str, str]:
    if row is None:
        return None, "not_observed", "unknown"
    value = as_number(row.get(key))
    if value is None:
        return None, "missing", "warning"
    return value, "observed", "passed"


def series_for(code: str, product_index: int, snapshots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    units = {
        "marketValue": "CNY",
        "investmentAmount": "CNY",
        "unrealizedPnl": "CNY",
        "price": "source-price-unit",
    }
    labels = {
        "marketValue": "当前市值",
        "investmentAmount": "投资金额",
        "unrealizedPnl": "浮动盈亏",
        "price": "现价",
    }
    for key in SERIES_FIELDS:
        points = []
        observed_values = []
        for snapshot in snapshots:
            value, state, quality = point_state(snapshot["rows"].get(code), key)
            if value is not None:
                observed_values.append(value)
            points.append(
                {
                    "t": snapshot["date"],
                    "v": value,
                    "state": state,
                    "quality": quality,
                    "snapshotRef": f"snapshot:{snapshot['date']}",
                }
            )
        threshold = median(observed_values) if observed_values else None
        result.append(
            {
                "id": f"series:holding-{product_index:02d}:{key}",
                "ownerObjectId": f"holding-{product_index:02d}",
                "propertyId": f"m01.property.{key}",
                "label": labels[key],
                "unit": units[key],
                "valueType": "number",
                "granularity": "P1W-irregular",
                "calendar": "snapshot-business-date",
                "timezone": "Asia/Shanghai",
                "aggregationSemantics": "stock" if key != "unrealizedPnl" else "signed-stock",
                "missingSemantics": ["not_observed", "missing", "redacted", "quality_blocked", "not_applicable"],
                "researchThreshold": threshold,
                "points": points,
            }
        )
    return result


def first_nonempty(records: list[dict[str, Any]], key: str) -> Any:
    for record in records:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def build_resource(snapshot_dir: Path) -> dict[str, Any]:
    paths = sorted(snapshot_dir.glob("*.xlsx"))
    snapshots = [read_snapshot(path) for path in paths]
    selected_codes = select_codes(snapshots)
    objects: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    series: list[dict[str, Any]] = []
    alias_events: list[dict[str, Any]] = []

    objects.append(
        {
            "id": "portfolio-01",
            "objectTypeId": "m01.object-type.investment-portfolio",
            "title": "投资组合 A",
            "subtitle": "S005 脱敏验证组合",
            "scenarioId": "S005",
            "properties": {
                "sourceScope": {"value": "79 份周期间快照", "quality": "passed"},
                "spatialApplicability": {"value": None, "state": "not_applicable", "quality": "passed"},
            },
            "quality": "passed",
            "permissions": ["m07.analyst", "m07.auditor", "m07.restricted"],
        }
    )

    for index, code in enumerate(selected_codes, start=1):
        records = [snapshot["rows"][code] for snapshot in snapshots if code in snapshot["rows"]]
        names = []
        for record in records:
            name = str(record.get("name") or "").strip()
            if name and name not in names:
                names.append(name)
        category1 = str(first_nonempty(records, "category1") or "未分类")
        category2 = str(first_nonempty(records, "category2") or "未分类")
        is_fund = "基金" in category2
        product_id = f"product-{index:02d}"
        holding_id = f"holding-{index:02d}"
        relation_target_id = f"manager-{index:02d}" if is_fund else f"issuer-{index:02d}"
        relation_type = "managedByCandidate" if is_fund else "issuedByCandidate"
        relation_title = f"管理人候选 {index}" if is_fund else f"发行人候选 {index}"
        observed_dates = [snapshot["date"] for snapshot in snapshots if code in snapshot["rows"]]
        source_fingerprint = fingerprint(code)

        objects.extend(
            [
                {
                    "id": product_id,
                    "objectTypeId": "m01.object-type.financial-product",
                    "title": f"金融产品 {chr(64 + index)}",
                    "subtitle": category2,
                    "scenarioId": "S005",
                    "stableKeyFingerprint": f"sha256:{source_fingerprint}",
                    "aliasesObserved": len(names),
                    "properties": {
                        "categoryLevel1": {"value": category1, "quality": "passed"},
                        "categoryLevel2": {"value": category2, "quality": "passed"},
                        "region": {"value": "境内（源字段，仅粗粒度）", "quality": "warning"},
                        "geometry": {"value": None, "state": "not_applicable", "quality": "passed"},
                        "sourceCode": {"value": None, "state": "redacted", "quality": "passed"},
                    },
                    "quality": "warning" if len(names) > 1 else "passed",
                    "qualityNotes": ["跨期名称别名已归并到同一稳定代码"] if len(names) > 1 else [],
                    "permissions": ["m07.analyst", "m07.auditor"] + (["m07.restricted"] if index < 4 else []),
                },
                {
                    "id": holding_id,
                    "objectTypeId": "m01.object-type.investment-holding",
                    "title": f"持仓 {chr(64 + index)}",
                    "subtitle": f"{observed_dates[0]} 至 {observed_dates[-1]}",
                    "scenarioId": "S005",
                    "stableKeyFingerprint": f"sha256:{fingerprint('holding|' + code)}",
                    "properties": {
                        "validFrom": {"value": observed_dates[0], "quality": "passed"},
                        "validTo": {"value": observed_dates[-1], "quality": "passed"},
                        "snapshotCount": {"value": len(observed_dates), "quality": "passed"},
                        "geometry": {"value": None, "state": "not_applicable", "quality": "passed"},
                    },
                    "quality": "passed",
                    "permissions": ["m07.analyst", "m07.auditor"] + (["m07.restricted"] if index < 4 else []),
                },
                {
                    "id": relation_target_id,
                    "objectTypeId": "m01.object-type.manager-candidate" if is_fund else "m01.object-type.issuer-candidate",
                    "title": relation_title,
                    "subtitle": "仅由现有台账名称模式派生，非权威关系",
                    "scenarioId": "S005",
                    "stableKeyFingerprint": f"sha256:{fingerprint(relation_type + '|' + code)}",
                    "properties": {
                        "derivation": {"value": "name-pattern", "quality": "warning"},
                        "authorityStatus": {"value": None, "state": "quality_blocked", "quality": "blocked"},
                        "geometry": {"value": None, "state": "missing", "quality": "warning"},
                    },
                    "quality": "blocked",
                    "qualityNotes": ["需要权威管理人或发行人主数据后才能发布关系"],
                    "permissions": ["m07.analyst", "m07.auditor"],
                },
            ]
        )
        links.extend(
            [
                {
                    "id": f"link:portfolio-holding-{index:02d}",
                    "linkTypeId": "m01.link-type.portfolio-has-holding",
                    "from": "portfolio-01",
                    "to": holding_id,
                    "quality": "passed",
                },
                {
                    "id": f"link:holding-product-{index:02d}",
                    "linkTypeId": "m01.link-type.holding-refers-product",
                    "from": holding_id,
                    "to": product_id,
                    "quality": "passed",
                },
                {
                    "id": f"link:product-owner-candidate-{index:02d}",
                    "linkTypeId": f"m01.link-type.{relation_type}",
                    "from": product_id,
                    "to": relation_target_id,
                    "quality": "blocked",
                    "failureCode": "AUTHORITATIVE_RELATION_REQUIRED",
                },
            ]
        )
        series.extend(series_for(code, index, snapshots))
        if len(names) > 1:
            alias_events.append(
                {
                    "id": f"event:alias-{index:02d}",
                    "objectId": product_id,
                    "type": "alias-observed",
                    "date": observed_dates[-1],
                    "label": "检测到跨期名称别名",
                    "quality": "warning",
                }
            )

    objects.extend(
        [
            {
                "id": "geo-fixture-01",
                "objectTypeId": "m01.object-type.validation-location",
                "title": "空间技术夹具 A",
                "subtitle": "仅验证图层、框选与深链，不代表 S005 业务事实",
                "scenarioId": "S005",
                "technicalFixture": True,
                "properties": {
                    "geometry": {"value": {"type": "Point", "coordinates": [121.4737, 31.2304]}, "quality": "passed"},
                    "crs": {"value": "EPSG:4326", "quality": "passed"},
                    "validFrom": {"value": "2026-01-01", "quality": "passed"},
                },
                "quality": "passed",
                "permissions": ["m07.analyst", "m07.auditor", "m07.restricted"],
            },
            {
                "id": "geo-fixture-02",
                "objectTypeId": "m01.object-type.validation-location",
                "title": "空间技术夹具 B",
                "subtitle": "仅验证关系展开与范围筛选",
                "scenarioId": "S005",
                "technicalFixture": True,
                "properties": {
                    "geometry": {"value": {"type": "Point", "coordinates": [116.4074, 39.9042]}, "quality": "passed"},
                    "crs": {"value": "EPSG:4326", "quality": "passed"},
                    "validFrom": {"value": "2026-01-01", "quality": "passed"},
                },
                "quality": "passed",
                "permissions": ["m07.analyst", "m07.auditor", "m07.restricted"],
            },
        ]
    )
    links.append(
        {
            "id": "link:geo-fixture-related",
            "linkTypeId": "m01.link-type.validation-related-location",
            "from": "geo-fixture-01",
            "to": "geo-fixture-02",
            "quality": "passed",
            "technicalFixture": True,
        }
    )

    return {
        "schemaVersion": "ofw.m07.validation-resource.v1",
        "namespace": NAMESPACE,
        "researchOnly": True,
        "scenarioContext": {
            "scenarioId": "S005",
            "scenarioVersion": "S005-research-v1",
            "scenarioRunId": "S005-M07-VALIDATION-20260824",
            "baselineStatus": "pending-formal-freeze",
        },
        "ontologyContext": {
            "publishedSemanticVersionId": "M01-PUBLISHED-RESEARCH-REF",
            "authoritativeBindingId": "T019-RESEARCH-REF",
            "definitionMode": "reference-only",
            "warning": "占位引用用于合同验证，不代表已创建 Published 资源或 T019",
        },
        "source": {
            "root": "deidentified-snapshot-series:S005-investment-ledger",
            "workbookCount": len(snapshots),
            "dateRange": {"from": snapshots[0]["date"], "to": snapshots[-1]["date"]},
            "deidentification": "原证券代码、名称、人员与机构名称未写入验证资源；稳定性仅保留命名空间哈希指纹",
            "snapshots": [
                {"id": f"snapshot:{snapshot['date']}", "date": snapshot["date"], "file": snapshot["file"], "sha256": snapshot["sha256"]}
                for snapshot in snapshots
            ],
        },
        "roles": [
            {"id": "m07.analyst", "label": "研究分析员", "policyVersion": "research-policy-v1"},
            {"id": "m07.auditor", "label": "证据审计员", "policyVersion": "research-policy-v1"},
            {"id": "m07.restricted", "label": "受限观察员", "policyVersion": "research-policy-v1"},
        ],
        "objects": objects,
        "links": links,
        "series": series,
        "events": alias_events,
        "lensDefinitions": [
            {"id": "lens.catalog.v1", "kind": "catalog", "owner": "M07", "version": "draft-1"},
            {"id": "lens.object360.v1", "kind": "object360", "owner": "M07", "version": "draft-1"},
            {"id": "lens.graph.v1", "kind": "graph", "owner": "M07", "version": "draft-1", "maxHops": 2},
            {"id": "lens.temporal.v1", "kind": "temporal", "owner": "M07", "version": "draft-1"},
            {"id": "lens.spatial.v1", "kind": "spatial", "owner": "M07", "version": "draft-1"},
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot_dir", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    resource = build_resource(args.snapshot_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "objects": len(resource["objects"]),
                "links": len(resource["links"]),
                "series": len(resource["series"]),
                "snapshots": len(resource["source"]["snapshots"]),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
