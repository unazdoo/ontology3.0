#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "resources/s005-research-fixture.json"), "utf8"));

function replay(input) {
  const final = (values) => values[values.length - 1];
  const scopeCounts = Object.fromEntries(["符合范围", "需复核", "无法判断"].map((status) => [status, input.products.filter((product) => product.scopeStatus === status).length]));
  return {
    scenarioId: input.scenarioId,
    scenarioVersion: input.scenarioVersion,
    snapshots: input.sourceSummary.snapshotCount,
    candidates: input.sourceSummary.candidateCount,
    scopeCounts,
    marketExcess: Number((final(input.marketSeries.pool) - final(input.marketSeries.peerMedian)).toFixed(2)),
    selectionSpread: Number((final(input.selectionSeries.selected) - final(input.selectionSeries.eligibleUnselected)).toFixed(2)),
    resultStatus: input.kpis.find((item) => item.label === "结论状态").value
  };
}

assert.equal(fixture.scenarioId, "S005");
assert.equal(fixture.scenarioVersion, "S005-v1");
assert.equal(fixture.namespace, "ofw.s005.research.v1");
assert.equal(fixture.sourceSummary.snapshotCount, 79);
assert.equal(fixture.sourceSummary.sheetInstanceCount, 393);
assert.equal(fixture.sourceSummary.candidateCount, 15);
assert.equal(fixture.sourceSummary.rawIdentitiesIncluded, false);
assert.equal(fixture.products.length, 5);
assert.deepEqual(new Set(fixture.products.map((product) => product.category)), new Set(["利率债", "短期纯债基金", "中长期纯债基金", "混合一级债基", "混合二级债基"]));
assert.ok(fixture.products.every((product) => /^PRD-[A-F0-9]{16}$/.test(product.objectRef.id)));

const first = replay(fixture);
const second = replay(JSON.parse(JSON.stringify(fixture)));
assert.deepEqual(second, first, "research replay must be deterministic");
assert.equal(first.marketExcess, 1.2);
assert.equal(first.selectionSpread, fixture.selectionSeries.expectedSpreadPct);
assert.deepEqual(first.scopeCounts, { "符合范围": 3, "需复核": 1, "无法判断": 1 });
assert.equal(first.resultStatus, "部分评价");

console.log(JSON.stringify({ status: "ok", check: "research-replay", ...first }));
