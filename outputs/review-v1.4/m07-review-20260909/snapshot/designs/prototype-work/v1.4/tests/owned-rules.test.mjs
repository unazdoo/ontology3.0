import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { query, ruleEvidence } from "../src/domain.js";
import { defaultFilters, reportSnapshot } from "../src/store.js";
import { reportHtml } from "../src/ui.js";
const data = JSON.parse(
  readFileSync(new URL("../public/data/portfolio.json", import.meta.url)),
);
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(
  readFileSync(
    new URL("../composite/ontology/rules-bootstrap.js", import.meta.url),
    "utf8",
  ),
  sandbox,
);
const registry = sandbox.OFW_V14_OWNED_RULES;
const state = () => ({
  drafts: [],
  publishedVersions: Object.entries(registry.owners).map(([id, owner]) => ({
    id: `VERSION-${id}`,
    ontologyStableId: owner.ontologyId,
    name: `本体${id}`,
    definition: "原本体定义",
    semanticVersion: "1.0.2",
    objects: [{ id: `OBJ-${id}`, name: "企业", properties: [] }],
    links: [],
    metrics: [{ id: `MET-${id}`, name: "原指标" }],
    rules: [{ id: `RULE-${id}`, name: "原规则", condition: "原条件" }],
    actions: [],
    positions: {},
    scenarioContext: { scenarioId: id },
    dataContract: { assetVersion: `ASSET-${id}` },
  })),
  currentFormalVersionIdsByOntology: {
    "ONT-GROUP-FINANCING-OPTIMIZATION": "VERSION-S001",
    "ONT-S003-DEBT-RISK": "VERSION-S003",
  },
});
test("native rule bootstrap attaches revisions to the existing ontologies without modifying published versions", () => {
  const original = state(),
    before = JSON.stringify(original),
    result = registry.prepare(original, data);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.state.publishedVersions)),
    original.publishedVersions,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.state.currentFormalVersionIdsByOntology)),
    original.currentFormalVersionIdsByOntology,
  );
  assert.equal(result.created.length, 2);
  for (const draft of result.state.drafts) {
    const owner = registry.owners[draft.operationsOwner];
    assert.equal(draft.ontologyStableId, owner.ontologyId);
    assert.equal(draft.basedOnVersionId, `VERSION-${draft.operationsOwner}`);
    assert.equal(draft.publishedVersionId, null);
    assert.equal(draft.release.confirmed, false);
    assert.equal(
      draft.metrics.filter((item) => item.operationsDefinitionId).length,
      owner.definitions.length,
    );
    assert.equal(
      draft.rules.find((rule) => rule.operationsRuleKey).id,
      owner.ruleId,
    );
    assert.equal(draft.rules[0].condition, "原条件");
  }
});
test("bootstrap is idempotent and never overwrites edited native rule drafts", () => {
  const first = registry.prepare(state(), data);
  first.state.drafts[0].rules.find((rule) => rule.operationsRuleKey).condition =
    "融资成本偏离 > 70 bp";
  const second = registry.prepare(first.state, data);
  assert.equal(second.created.length, 0);
  assert.equal(second.state.drafts.length, 2);
  assert.equal(
    second.state.drafts[0].rules.find((rule) => rule.operationsRuleKey)
      .condition,
    "融资成本偏离 > 70 bp",
  );
});
test("legacy threshold drafts migrate into the owning financing draft without losing their evidence", () => {
  const legacy = [
    {
      id: "legacy-1",
      threshold: 65,
      dataDigest: data.digest,
      objectIds: ["ENT-001"],
    },
  ];
  const result = registry.prepare(state(), data, legacy);
  const draft = result.state.drafts.find(
    (item) => item.operationsOwner === "S001",
  );
  assert.equal(
    draft.rules.find((item) => item.operationsRuleKey).condition,
    "融资成本偏离 > 65 bp",
  );
  assert.equal(draft.operationsHistory[0].id, "legacy-1");
  assert.equal(legacy[0].threshold, 65);
});
test("the generated metric catalogue is identical to the workbench source definitions", () => {
  const context = {};
  context.window = context;
  vm.runInNewContext(
    readFileSync(
      new URL("../public/data/business-definitions.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(context.OFW_V14_BUSINESS_DEFINITIONS.definitions),
    ),
    data.definitions,
  );
  assert.equal(context.OFW_V14_BUSINESS_DEFINITIONS.digest, data.digest);
});
test("question and report evidence retain the owning ontology and native rule revision", () => {
  const ref = {
    id: "RULE-OPS-DEBT-LIQUIDITY-GAP",
    ontologyId: "ONT-S003-DEBT-RISK",
    draftId: "DRAFT-V14-OPERATIONS-S003",
    draftRevision: 2,
    condition: "偿债资金缺口 > 0 百万元",
    premiumThreshold: null,
  };
  const filters = { ...defaultFilters(), gapOnly: true, ruleRef: ref };
  const answer = query(data, "未来90天到期多少", { filters, horizon: 90 });
  assert.deepEqual(answer.evidence.rule, ref);
  const report = reportSnapshot(answer.result, { evidence: answer.evidence });
  assert.match(reportHtml(report), /偿债资金缺口 &gt; 0 百万元/);
  assert.match(reportHtml(report), /ONT-S003-DEBT-RISK/);
  assert.equal(ruleEvidence(defaultFilters()), null);
});
test("an explicit new query threshold does not claim the previous native rule identity", () => {
  const filters = {
    ...defaultFilters(),
    highCost: true,
    premiumThreshold: 25,
    ruleRef: { id: "RULE-OPS-FINANCING-PREMIUM", premiumThreshold: 25 },
  };
  const answer = query(data, "找出融资成本偏离高于50bp的企业", {
    filters,
    horizon: 90,
  });
  assert.equal(answer.evidence.rule.id, "baseline");
  assert.equal(answer.evidence.rule.premiumThreshold, 50);
});
