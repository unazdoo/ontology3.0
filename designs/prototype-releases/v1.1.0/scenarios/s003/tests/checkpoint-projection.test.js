const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const projectionService = require(path.join(scenarioRoot, "domain", "checkpoint-projection.js"));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(scenarioRoot, relativePath), "utf8"));
}

function manifestFor(code) {
  const filename = fs.readdirSync(path.join(scenarioRoot, "checkpoints"))
    .find((name) => name.startsWith(`${code}-`) && name.endsWith(".json"));
  assert.ok(filename, `${code} manifest missing`);
  return readJson(path.join("checkpoints", filename));
}

function artifactCatalog(manifests) {
  const catalog = {};
  for (const manifest of manifests) {
    for (const reference of projectionService.collectReferences(manifest)) {
      if (catalog[reference.ref]) continue;
      const absolutePath = path.join(scenarioRoot, reference.ref);
      const bytes = fs.readFileSync(absolutePath);
      catalog[reference.ref] = {
        ref: reference.ref,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        document: reference.ref.endsWith(".json") ? JSON.parse(bytes.toString("utf8")) : null,
        error: null
      };
    }
  }
  return catalog;
}

const manifests = Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
  const code = `CP${String(index + 1).padStart(2, "0")}`;
  return [code, manifestFor(code)];
}));
const artifacts = artifactCatalog(Object.values(manifests));

function resolve(code, manifest = manifests[code], catalog = artifacts) {
  return projectionService.resolveCheckpointProjection({ code, manifest, artifacts: catalog });
}

test("CP01—CP06 state comes from manifest references and reports post-checkpoint source drift", () => {
  const cp01 = resolve("CP01");
  assert.equal(cp01.exact, true);
  assert.equal(cp01.model.packageVersion, "1.0.0");
  assert.equal(cp01.inputSnapshot, null);
  assert.equal(cp01.c035Results, null);
  assert.equal(cp01.hasPublished, false);
  assert.equal(cp01.runnable, false);

  const cp02 = resolve("CP02");
  assert.equal(cp02.exact, false);
  assert.equal(cp02.model.packageVersion, "1.0.0");
  assert.equal(cp02.inputSnapshot.snapshotId, "S003-T053-INPUT-20251231-v1");
  assert.equal(cp02.c035Results, null);
  assert.equal(cp02.hasPublished, false);
  assert.equal(cp02.runnable, false);
  assert.ok(cp02.issues.some((issue) => issue.code === "ARTIFACT_HASH_MISMATCH" && issue.ref === "resources/m02/source-asset.v1.json"));
  assert.ok(cp02.issues.some((issue) => issue.code === "ARTIFACT_HASH_MISMATCH" && issue.ref === "resources/m02/pipeline-run.v1.json"));

  const cp03 = resolve("CP03");
  assert.equal(cp03.exact, false);
  assert.equal(cp03.model.packageVersion, "1.0.1");
  assert.equal(cp03.c035Results.scenarioIdentity.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.equal(cp03.hasPublished, true);
  assert.equal(cp03.runnable, false);
  assert.equal(cp03.reportCount, 0);
  assert.equal(cp03.decisionResults, null);
  assert.ok(cp03.issues.some((issue) => issue.code === "ARTIFACT_HASH_MISMATCH" && issue.ref === "resources/m02/source-asset.v1.json"));

  const cp04 = resolve("CP04");
  assert.equal(cp04.queryResults.scenarioIdentity.scenarioRunId, cp04.sourceContext.scenarioRunId);
  assert.equal(cp04.decisionResults, null);

  const cp05 = resolve("CP05");
  assert.equal(cp05.decisionResults.confirmations.length, 1);
  assert.equal(cp05.decisionResults.scenarioIdentity.scenarioRunId, cp05.sourceContext.scenarioRunId);
  assert.equal(cp05.fixture.fixtureId, "S003-FIXTURE-20251231-v1");
  assert.equal(cp05.data.formalDataAsset.dataAssetId, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  assert.equal(cp05.reportCount, 0);

  const cp06 = resolve("CP06");
  assert.equal(cp06.reportCount, 21);
  assert.equal(cp06.reportManifest.scenarioIdentity.scenarioRunId, cp06.sourceContext.scenarioRunId);

  const cp07 = resolve("CP07");
  assert.equal(cp07.exact, false);
  assert.equal(cp07.restorable, false);
  assert.ok(cp07.issues.some((issue) => issue.ref === "domain/checkpoint-service.js"));
  assert.deepEqual(cp07.moduleVersions, {
    M01: "1.0.1",
    M02: "1.1.0",
    M03: "1.0.0",
    M04: "1.0.0",
    M05: "1.0.0",
    M06: "1.0.0"
  });
});

test("changing the display code cannot manufacture later-stage state", () => {
  const projection = resolve("CP99", manifests.CP02);
  assert.equal(projection.code, "CP99");
  assert.equal(projection.inputSnapshot.snapshotId, "S003-T053-INPUT-20251231-v1");
  assert.equal(projection.c035Results, null);
  assert.equal(projection.hasPublished, false);
  assert.equal(projection.runnable, false);
});

test("hash drift blocks clone restore and isolated regression while preserving evidence metadata", () => {
  const tampered = structuredClone(artifacts);
  tampered["resources/m01/published-pointer.v1.json"].sha256 = "0".repeat(64);
  const projection = resolve("CP05", manifests.CP05, tampered);
  assert.equal(projection.exact, false);
  assert.equal(projection.restorable, false);
  assert.equal(projection.runnable, false);
  assert.equal(projection.restoreMode, "evidence-only");
  assert.ok(projection.issues.some((issue) => issue.code === "ARTIFACT_HASH_MISMATCH"));
  assert.ok(projection.evidenceRefs.includes("evidence/CP05-decision-chain-validation.md"));
});

test("CP08 historical manifest remains immutable and reports post-checkpoint source drift", () => {
  const projection = resolve("CP08");
  assert.equal(projection.exact, false);
  assert.equal(projection.restorable, false);
  assert.equal(projection.runnable, false);
  assert.equal(projection.restoreMode, "evidence-only");
  assert.ok(projection.issues.some((issue) => issue.ref === "data.js"));
  assert.equal(projection.sourceContext.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.equal(projection.c035Results.scenarioIdentity.scenarioRunId, projection.sourceContext.scenarioRunId);
});

test("incomplete input snapshot cannot be used for regression", () => {
  const tampered = structuredClone(artifacts);
  const ref = "resources/m02/human-input-snapshot.v1.json";
  tampered[ref].document.records = tampered[ref].document.records.slice(1);
  const projection = resolve("CP05", manifests.CP05, tampered);
  assert.equal(projection.runnable, false);
  assert.ok(projection.issues.some((issue) => issue.code === "INPUT_SNAPSHOT_INCOMPLETE"));
});
