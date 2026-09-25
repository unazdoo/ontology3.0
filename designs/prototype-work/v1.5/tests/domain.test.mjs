import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  validateDataset,
  metrics,
  facilityUndrawn,
  createPlan,
  comparePlan,
  projectLoans,
  defaultParams,
  filterEnterprises,
  bankExposure,
  query,
  parseQuestion,
  dateOffset,
  transitionTask,
  pointInBounds,
  clone,
} from "../src/domain.js";
import {
  createStore,
  defaultFilters,
  initialState,
  validateRestoredState,
  newTask,
  reportSnapshot,
  reassignTask,
  KEY,
} from "../src/store.js";
import { reportHtml, resultCsv, esc } from "../src/ui.js";
const data = JSON.parse(
  readFileSync(new URL("../public/data/portfolio.json", import.meta.url)),
);
const context = () => ({ filters: defaultFilters(), horizon: 90 });
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
};
const plan = (ids = ["ENT-020"], params = {}, horizon = 90) =>
  createPlan(data, ids, { ...defaultParams(), ...params }, "测试方案", horizon);
const evidence = (ids = ["ENT-020"], p = null) => ({
  dataVersion: data.dataVersion,
  dataDigest: data.digest,
  ontologyVersion: data.ontologyVersion,
  objectIds: ids,
  planId: p?.id || null,
  horizon: 90,
  asOf: data.asOf,
  resultKind: p ? "SIMULATION" : "DEMO_BASELINE",
});
const task = (overrides = {}) =>
  newTask({
    title: "融资复核",
    owner: "风险管理部",
    dueDate: "2099-01-01",
    objectIds: ["ENT-020"],
    evidence: evidence(),
    ...overrides,
  });

test("dataset identities, foreign keys and digest are valid", () => {
  assert.equal(validateDataset(data), data);
  assert.equal(data.enterprises.length, 21);
  assert.equal(data.loans.length, 84);
  const { digest, ...body } = data;
  assert.equal(
    createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    digest,
  );
  assert.equal(
    new Set(data.enterprises.map((row) => row.coordinates.join(","))).size,
    21,
  );
});
test("invalid identity, dates, locations and ownership are rejected", () => {
  for (const change of [
    (d) => (d.enterprises[0].id = ""),
    (d) => (d.loans[0].bankId = "UNKNOWN"),
    (d) => (d.enterprises[0].coordinates = [999, 20]),
    (d) => (d.loans[0].maturityDate = "2026-02-30"),
    (d) => (d.facilities[0].validUntil = "invalid"),
    (d) => (d.guarantees[0].amount = -1),
    (d) => (d.projects[0].enterpriseId = "UNKNOWN"),
  ]) {
    const d = clone(data);
    change(d);
    assert.throws(() => validateDataset(d));
  }
});
test("all three source financing aggregates reconcile exactly", () => {
  for (const row of metrics(data).rows.filter((row) => row.sourceFinance)) {
    assert.ok(
      Math.abs(row.balance - row.sourceFinance.balanceMillions) < 0.00001,
    );
    assert.ok(Math.abs(row.cost - row.sourceFinance.cost) < 0.000001);
  }
  assert.equal(metrics(data, ["ENT-007"]).totals.balance, 77000);
});
test("cost is principal weighted, not average of enterprises", () => {
  const result = metrics(data);
  const weighted =
    result.rows.reduce((sum, row) => sum + row.balance * row.cost, 0) /
    result.totals.balance;
  assert.ok(Math.abs(result.totals.cost - weighted) < 0.000001);
  const average = result.rows.reduce((sum, row) => sum + row.cost, 0) / 21;
  assert.ok(Math.abs(average - weighted) > 0.05);
});
test("unique loan IDs counted once; guarantees and unused facilities not principal", () => {
  const d = clone(data);
  d.loans.push(clone(d.loans[0]));
  assert.equal(metrics(d).totals.balance, metrics(data).totals.balance);
  d.guarantees[0].amount = 9999999;
  d.facilities[0].undrawn = 9999999;
  assert.equal(metrics(d).totals.balance, metrics(data).totals.balance);
});
test("empty object scope never becomes all; zero principal means no available cost", () => {
  assert.equal(metrics(data, []).totals.count, 0);
  assert.equal(
    filterEnterprises(data, { ...defaultFilters(), objectIds: [] }).length,
    0,
  );
  const d = clone(data);
  d.loans.forEach((loan) => (loan.principal = 0));
  assert.equal(metrics(d).totals.cost, null);
});
test("maturity window excludes asOf and includes the exact horizon endpoint", () => {
  const d = clone(data);
  d.loans = d.loans.slice(0, 4);
  d.loans[0].maturityDate = data.asOf;
  d.loans[1].maturityDate = dateOffset(data.asOf, 90);
  d.loans[2].maturityDate = dateOffset(data.asOf, 91);
  d.loans[3].startDate = dateOffset(data.asOf, 1);
  const result = metrics(d, ["ENT-001"]);
  assert.equal(result.totals.due, d.loans[1].principal);
  assert.equal(result.loans.length, 2);
});
test("facilities must remain valid through the end of the selected window", () => {
  const d = clone(data);
  const facility = d.facilities[0];
  facility.validUntil = dateOffset(d.asOf, 89);
  const before = metrics(d, ["ENT-001"]).rows[0].credit;
  facility.validUntil = dateOffset(d.asOf, 90);
  assert.equal(
    metrics(d, ["ENT-001"]).rows[0].credit - before,
    facility.undrawn,
  );
});
test("cash from a surplus enterprise cannot cancel another enterprise gap", () => {
  const d = clone(data);
  d.enterprises[0].cash = 1e9;
  const r = metrics(d);
  assert.ok(r.totals.gap > 0);
  assert.equal(
    r.totals.gap,
    r.rows.reduce((sum, row) => sum + row.gap, 0),
  );
});
test("scenario changes only scoped floating rates; input data and risk scores remain immutable", () => {
  const original = JSON.stringify(data),
    p = plan(["ENT-001"], { rateBps: -100 });
  const loans = projectLoans(data, p);
  for (const loan of loans) {
    const base = data.loans.find((item) => item.id === loan.id),
      expected =
        loan.enterpriseId === "ENT-001" && loan.rateType === "FLOATING"
          ? Math.max(0, base.rate - 1)
          : base.rate;
    assert.ok(Math.abs(loan.rate - expected) < 1e-10);
  }
  assert.equal(JSON.stringify(data), original);
  assert.ok(
    comparePlan(data, p).changes.every((row) => row.riskScoreUnchanged),
  );
});
test("bank scoped scenario preserves every other bank and enterprise", () => {
  const p = plan(["ENT-001"], {
      rateBps: 100,
      creditHaircut: 50,
      bankId: "BANK-01",
    }),
    c = comparePlan(data, p);
  assert.equal(
    c.before.rows[0].credit - c.after.rows[0].credit,
    data.facilities[0].undrawn * 0.5,
  );
  assert.ok(
    projectLoans(data, p).every(
      (loan, index) =>
        (loan.bankId === "BANK-01" && loan.enterpriseId === "ENT-001") ||
        JSON.stringify(loan) === JSON.stringify(data.loans[index]),
    ),
  );
});
test("extension never resurrects expired or future-start loans", () => {
  const d = clone(data);
  d.loans[0].maturityDate = d.asOf;
  const p = createPlan(d, ["ENT-001"], {
    ...defaultParams(),
    extensionDays: 90,
  });
  assert.equal(projectLoans(d, p)[0].maturityDate, d.asOf);
  assert.ok(
    !metrics(d, ["ENT-001"], 90, p).loans.some(
      (loan) => loan.id === d.loans[0].id,
    ),
  );
});
test("scenario rejects data, ontology, parameters, scope and horizon mismatches", () => {
  for (const change of [
    (p) => (p.dataDigest = "old"),
    (p) => (p.ontologyVersion = "old"),
    (p) => (p.parameters.creditHaircut = 101),
    (p) => (p.parameters.bankId = "missing"),
    (p) => (p.objectIds = ["unknown"]),
  ]) {
    const p = plan();
    change(p);
    assert.throws(() => comparePlan(data, p));
  }
  assert.throws(() => plan([], {}));
  assert.throws(() => plan(["ENT-001"], {}, 130.5));
});
test("query preserves explicit empty and existing scopes; named aliases resolve canonical identities", () => {
  assert.equal(
    query(data, "未来90天到期多少？", {
      ...context(),
      filters: { ...defaultFilters(), objectIds: [] },
    }).result.rows.length,
    0,
  );
  assert.deepEqual(
    query(data, "解释单位553", context()).result.rows.map((row) => row.id),
    ["ENT-020"],
  );
  assert.deepEqual(
    query(data, "解释ENT-007", context()).result.rows.map((row) => row.id),
    ["ENT-007"],
  );
});
test("query rejects unknown subjects, unsupported windows and unregistered financial requests", () => {
  for (const text of [
    "虚构未知公司融资多少",
    "单位999融资多少",
    "未来130天到期多少",
    "未来90天和180天到期多少",
    "去年融资同比多少",
    "成本高于3%的企业",
    "星星银行融资多少",
    "讲个笑话",
  ])
    assert.throws(() => query(data, text, context()), undefined, text);
});
test("metric query does not silently narrow to enterprises with a gap", () => {
  const answer = query(data, "资金缺口总额多少", context());
  assert.equal(answer.result.rows.length, 21);
  assert.equal(answer.result.totals.gap, metrics(data).totals.gap);
  assert.ok(
    query(data, "找出高成本且有资金缺口的企业", context()).result.rows.every(
      (row) => row.premium > 0 && row.gap > 0,
    ),
  );
});
test("selected enterprise is used only for an explicit singular reference", () => {
  assert.equal(
    query(data, "未来90天到期多少", { ...context(), selectedId: "ENT-020" })
      .result.rows.length,
    21,
  );
  assert.deepEqual(
    query(data, "这家企业融资成本多少", {
      ...context(),
      selectedId: "ENT-020",
    }).result.rows.map((row) => row.id),
    ["ENT-020"],
  );
  assert.throws(() => query(data, "这家企业融资成本多少", context()));
});
test("named bank returns only its actual loan exposure", () => {
  const bank = data.banks[0],
    answer = query(data, `${bank.name}融资余额多少`, context());
  assert.equal(answer.refs.length, 1);
  assert.equal(answer.refs[0].id, bank.id);
  assert.ok(
    bankExposure(data, answer.result).find((item) => item.id === bank.id)
      .balance < answer.result.totals.balance,
  );
});
test("query extracts independent rate, credit, extension and horizon parameters", () => {
  const parsed = parseQuestion(
    "未来90天如果降息50bp，授信收缩30%，展期180天",
    data,
  );
  assert.equal(parsed.horizon, 90);
  assert.deepEqual(parsed.parameters, {
    rateBps: -50,
    creditHaircut: 30,
    extensionDays: 180,
    bankId: null,
  });
});
test("semantic threshold applies identically to query and filter rows", () => {
  const f = {
    ...defaultFilters(),
    highCost: true,
    premiumThreshold: 25,
    ruleId: "draft",
  };
  const answer = query(data, "找出高成本企业", { ...context(), filters: f });
  assert.deepEqual(
    answer.result.rows.map((row) => row.id).sort(),
    filterEnterprises(data, f)
      .map((row) => row.id)
      .sort(),
  );
  assert.equal(answer.evidence.rule.premiumThreshold, 25);
  const explicit = query(data, "找出成本偏离高于50bp的企业", context());
  assert.ok(explicit.result.rows.every((row) => row.premium > 50));
});
test("task validation, deduplication and complete/reopen audit trail", () => {
  const first = task();
  assert.equal(first.externalSideEffects, 0);
  assert.throws(() => task({ existing: [first] }));
  assert.throws(() => task({ owner: "" }));
  assert.throws(() => task({ dueDate: "2099-02-30" }));
  assert.throws(() => task({ evidence: evidence(["ENT-001"]) }));
  assert.throws(() => transitionTask(first, "COMPLETED", "处理完毕"));
  assert.throws(() => transitionTask(first, "IN_PROGRESS", " "));
  const progress = transitionTask(first, "IN_PROGRESS", "已联系负责人"),
    done = transitionTask(progress, "COMPLETED", "已核验演示证据"),
    reopened = transitionTask(done, "OPEN", "需要补充材料");
  assert.equal(reopened.history.length, 4);
  assert.equal(first.status, "OPEN");
});
test("task requires the exact source plan identity and retains a deep snapshot", () => {
  const p = plan(),
    source = evidence(p.objectIds, p),
    result = task({ plan: p, evidence: source });
  p.parameters.rateBps = 500;
  assert.equal(result.plan.parameters.rateBps, 0);
  assert.throws(() => task({ plan: p }));
});
test("report uses the recorded plan and cannot attach a different active plan", () => {
  const p = plan(["ENT-020"], { rateBps: -50 }),
    r = metrics(data, p.objectIds, 90, p),
    saved = reportSnapshot(r, { plan: p });
  assert.throws(() => reportSnapshot(r));
  assert.throws(() => reportSnapshot(r, { plan: plan() }));
  p.parameters.rateBps = 200;
  r.rows[0].name = "changed";
  assert.notEqual(saved.rows[0].name, "changed");
  assert.equal(saved.plan.parameters.rateBps, -50);
});
test("reports and CSV escape user controlled strings", () => {
  const report = reportSnapshot(metrics(data), {
    title: "<script>alert(1)</script>",
    notes: "<img src=x onerror=alert(1)>",
  });
  const html = reportHtml(report);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;img"));
  assert.equal(esc('"<&'), "&quot;&lt;&amp;");
  report.rows[0].name = "=1+1";
  assert.ok(
    resultCsv({ ...report, dataVersion: data.dataVersion }).includes("'=1+1"),
  );
});
test("store persists, restores and undoes filters without changing records", () => {
  const storage = memory(),
    s = createStore(storage);
  s.update(
    { filters: { ...defaultFilters(), objectIds: ["ENT-001"] } },
    { undoable: true },
  );
  s.update({ tasks: [task()] });
  assert.equal(createStore(storage).get().tasks.length, 1);
  s.undo();
  assert.equal(s.get().filters.objectIds, null);
  assert.equal(s.get().tasks.length, 1);
});
test("storage failure leaves a usable session and emits a persistence warning", () => {
  let warnings = 0;
  const s = createStore(
    {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    },
    () => warnings++,
  );
  s.update({ mode: "cost" });
  s.update({ horizon: 180 });
  assert.equal(s.get().mode, "cost");
  assert.equal(warnings, 1);
  assert.equal(s.isPersistent(), false);
});
test("facility drilldown uses exactly the same scenario values as enterprise credit totals", () => {
  const p = plan(["ENT-001"], { creditHaircut: 50 }),
    facilities = data.facilities.filter(
      (item) => item.enterpriseId === "ENT-001",
    );
  assert.equal(
    metrics(data, ["ENT-001"], 90, p).rows[0].credit,
    facilities.reduce((sum, facility) => sum + facilityUndrawn(facility, p), 0),
  );
  assert.equal(
    facilityUndrawn(data.facilities[0], p),
    data.facilities[0].undrawn * 0.5,
  );
});
test("entity suffix boundaries and ambiguous condition groups never silently select a different scope", () => {
  for (const text of [
    "解释环保测试公司10",
    "解释单位5530",
    "ent-0010融资成本多少",
    "找出红灯和黄灯企业",
    "风电和环保企业融资成本多少",
  ])
    assert.throws(() => query(data, text, context()), undefined, text);
  assert.equal(
    query(data, "解释ent-020", context()).result.rows[0].id,
    "ENT-020",
  );
});
test("task reassignment preserves execution status and original history", () => {
  const initial = task(),
    updated = reassignTask(initial, "复核人", "2099-06-01", "业务分办调整");
  assert.equal(updated.status, "OPEN");
  assert.equal(updated.history.length, 2);
  assert.equal(initial.owner, "风险管理部");
  assert.equal(updated.owner, "复核人");
  assert.throws(() => reassignTask(updated, "", "2099-06-01", ""));
});
test("report evidence must match the exact result scope and horizon", () => {
  const result = metrics(data, ["ENT-020"]);
  assert.throws(() =>
    reportSnapshot(result, { evidence: evidence(["ENT-001"]) }),
  );
  assert.throws(() =>
    reportSnapshot(result, { evidence: { ...evidence(), horizon: 180 } }),
  );
});
test("risk explanation separates historical scoring from synthetic financing", () => {
  const answer = query(data, "为什么环保测试公司4需要关注", context());
  assert.match(answer.summary, /历史评分/);
  assert.match(answer.summary, /不能由本次合成借款反推/);
  assert.match(answer.summary, /最大借款银行/);
});
test("corrupted storage falls back; invalid historical plans cannot be active", () => {
  const storage = memory();
  storage.setItem(KEY, "broken");
  assert.equal(createStore(storage).get().horizon, 90);
  const p = plan();
  p.parameters.rateBps = 999;
  const state = validateRestoredState(
    { ...initialState(), plans: [p], activePlanId: p.id },
    data,
  );
  assert.equal(state.activePlanId, null);
});
test("geographic bounds support antimeridian crossing and include boundaries", () => {
  assert.equal(
    pointInBounds([179, 0], { west: 170, east: -170, south: -10, north: 10 }),
    true,
  );
  assert.equal(
    pointInBounds([0, 0], { west: 170, east: -170, south: -10, north: 10 }),
    false,
  );
  assert.equal(
    pointInBounds([10, 10], { west: 0, east: 10, south: 0, north: 10 }),
    true,
  );
});
