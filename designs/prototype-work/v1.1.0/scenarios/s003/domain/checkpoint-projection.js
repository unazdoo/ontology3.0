(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003CheckpointProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCENARIO_ID = "S003";
  const SCENARIO_VERSION = "S003-v1";
  const BASELINE_VERSION = "1.0.3";
  const BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function collectReferences(manifest) {
    const references = [];
    Object.entries(manifest?.stateSections || {}).forEach(function ([section, value]) {
      (value?.items || []).forEach(function (item) {
        if (!item?.ref || !item?.sha256) return;
        references.push({
          kind: "state-section",
          section,
          ref: item.ref,
          sha256: item.sha256,
          resourceId: item.resourceId || null,
          version: item.version || null
        });
      });
    });
    Object.entries(manifest?.modules || {}).forEach(function ([moduleId, module]) {
      if (!module?.exportRef || !module?.exportSha256) return;
      references.push({
        kind: "module-export",
        moduleId,
        ref: module.exportRef,
        sha256: module.exportSha256,
        resourceId: module.exportId || null,
        version: module.moduleVersion || null
      });
    });
    return references;
  }

  function validateManifest(manifest) {
    const issues = [];
    if (!isObject(manifest)) return [{ code: "MANIFEST_MISSING", message: "Checkpoint 清单缺失。" }];
    if (manifest.scenarioContext?.scenarioId !== SCENARIO_ID || manifest.scenarioContext?.scenarioVersion !== SCENARIO_VERSION) {
      issues.push({ code: "SCENARIO_IDENTITY_MISMATCH", message: "Checkpoint 不属于 S003 · S003-v1。" });
    }
    if (
      manifest.baselineVersion !== BASELINE_VERSION
      || manifest.parentVersion !== BASELINE_VERSION
      || manifest.baselineSnapshotId !== BASELINE_SNAPSHOT_ID
    ) {
      issues.push({ code: "BASELINE_MISMATCH", message: "Checkpoint 未锁定 S001 v1.0.3 最终冻结基线。" });
    }
    if (manifest.sourceScenarioRunId !== manifest.scenarioContext?.scenarioRunId) {
      issues.push({ code: "SOURCE_RUN_MISMATCH", message: "Checkpoint sourceScenarioRunId 与场景身份不一致。" });
    }
    return issues;
  }

  function validateArtifacts(manifest, artifacts) {
    const issues = validateManifest(manifest);
    const catalog = artifacts || {};
    collectReferences(manifest).forEach(function (reference) {
      const artifact = catalog[reference.ref];
      if (!artifact || artifact.error) {
        issues.push({
          code: "ARTIFACT_UNAVAILABLE",
          ref: reference.ref,
          expectedSha256: reference.sha256,
          message: `${reference.ref} 无法读取，当前只能查看 Checkpoint 清单证据。`
        });
        return;
      }
      if (artifact.sha256 !== reference.sha256) {
        issues.push({
          code: "ARTIFACT_HASH_MISMATCH",
          ref: reference.ref,
          expectedSha256: reference.sha256,
          actualSha256: artifact.sha256 || null,
          message: `${reference.ref} 已偏离 Checkpoint 锁定哈希。`
        });
      }
    });
    return issues;
  }

  function sectionItems(manifest, section) {
    return manifest?.stateSections?.[section]?.items || [];
  }

  function artifactDocument(artifacts, item) {
    if (!item?.ref) return null;
    const artifact = artifacts?.[item.ref];
    if (!artifact || artifact.error || artifact.sha256 !== item.sha256) return null;
    return clone(artifact.document);
  }

  function findDocument(manifest, artifacts, section, predicate) {
    for (const item of sectionItems(manifest, section)) {
      const document = artifactDocument(artifacts, item);
      if (!document) continue;
      if (predicate(item, document)) return document;
    }
    return null;
  }

  function moduleDocument(manifest, artifacts, moduleId) {
    const module = manifest?.modules?.[moduleId];
    if (!module?.exportRef) return null;
    return artifactDocument(artifacts, { ref: module.exportRef, sha256: module.exportSha256 });
  }

  function resourceIdIncludes(item, token) {
    return String(item?.resourceId || "").toUpperCase().includes(token);
  }

  function schemaIncludes(document, token) {
    return String(document?.schemaVersion || "").toLowerCase().includes(token);
  }

  function resolveCheckpointProjection(options) {
    const manifest = options?.manifest;
    const artifacts = options?.artifacts || {};
    const code = options?.code || null;
    const issues = validateArtifacts(manifest, artifacts);

    const modelPackage = findDocument(manifest, artifacts, "semantics", function (item, document) {
      return resourceIdIncludes(item, "DEBT-RISK-PKG") || schemaIncludes(document, "model-package");
    });
    const publishedPointer = findDocument(manifest, artifacts, "semantics", function (item, document) {
      return resourceIdIncludes(item, "PUBLISHED-POINTER") || Boolean(document?.activeTarget?.publishedSnapshot);
    });
    const inputSnapshot = findDocument(manifest, artifacts, "data", function (item, document) {
      return resourceIdIncludes(item, "T053-INPUT") || schemaIncludes(document, "human-input-snapshot");
    });
    const c035Results = findDocument(manifest, artifacts, "results", function (item, document) {
      return resourceIdIncludes(item, "C035-RISK-RESULTS") || document?.contractId === "C035";
    });
    const publishedFacts = findDocument(manifest, artifacts, "results", function (item, document) {
      return resourceIdIncludes(item, "PUBLISHED-RISK-FACTS") || schemaIncludes(document, "published-risk-facts");
    });
    const queryResults = findDocument(manifest, artifacts, "results", function (item, document) {
      return resourceIdIncludes(item, "M03-QUERY-RESULTS") || schemaIncludes(document, "query-results");
    });
    const decisionResults = findDocument(manifest, artifacts, "decisions", function (item, document) {
      return resourceIdIncludes(item, "M04-DECISION-RESULTS") || schemaIncludes(document, "decision-results");
    });
    const reportManifest = findDocument(manifest, artifacts, "reports", function (item, document) {
      return resourceIdIncludes(item, "REPORT-MANIFEST") || schemaIncludes(document, "report-manifest");
    });
    const reportContents = findDocument(manifest, artifacts, "reports", function (item, document) {
      return resourceIdIncludes(item, "REPORT-CONTENTS") || schemaIncludes(document, "report-contents");
    });
    const reportArtifacts = findDocument(manifest, artifacts, "reports", function (item, document) {
      return resourceIdIncludes(item, "REPORT-ARTIFACTS") || schemaIncludes(document, "report-artifacts");
    });
    const sourceAsset = findDocument(manifest, artifacts, "data", function (item, document) {
      return resourceIdIncludes(item, "SOURCE-XLSX") || schemaIncludes(document, "source-asset");
    });
    const pipelineRun = findDocument(manifest, artifacts, "data", function (item, document) {
      return resourceIdIncludes(item, "PIPELINE-RUN") || schemaIncludes(document, "pipeline-run");
    });
    const formalDataAsset = findDocument(manifest, artifacts, "data", function (item, document) {
      return resourceIdIncludes(item, "T007-FORMAL-CANDIDATE") || schemaIncludes(document, "formal-candidate-data-asset");
    });
    const qualityResult = findDocument(manifest, artifacts, "data", function (item, document) {
      return resourceIdIncludes(item, "QUALITY") || schemaIncludes(document, "quality-result");
    });
    const fixture = findDocument(manifest, artifacts, "testFixtures", function (item, document) {
      return resourceIdIncludes(item, "FIXTURE-") || schemaIncludes(document, "enterprise-fixture");
    });

    const model = clone(publishedPointer?.activeTarget?.publishedSnapshot || modelPackage);
    const hasPublished = Boolean(
      publishedPointer
      && String(publishedPointer.activeTarget?.lifecycleStatus || "").toUpperCase() === "PUBLISHED"
      && c035Results
      && String(c035Results.status || "").toUpperCase() === "PUBLISHED-RESULTS"
    );
    const inputShapeValid = !inputSnapshot || (
      Array.isArray(inputSnapshot.records)
      && inputSnapshot.records.length === Number(inputSnapshot.enterpriseCount)
      && inputSnapshot.records.every(function (record) {
        return Array.isArray(record.values) && record.values.length === Number(inputSnapshot.factorCount);
      })
    );
    if (!inputShapeValid) {
      issues.push({ code: "INPUT_SNAPSHOT_INCOMPLETE", message: "人工输入快照未锁定完整企业×因子记录。" });
    }
    const fixtureShapeValid = !fixture || (
      Array.isArray(fixture.enterprises)
      && fixture.enterprises.length === Number(fixture.enterpriseCount)
    );
    if (hasPublished && (!fixture || !fixtureShapeValid)) {
      issues.push({ code: "TEST_FIXTURE_INCOMPLETE", message: "Checkpoint 未锁定可执行的完整企业测试夹具。" });
    }
    if (hasPublished && !formalDataAsset) {
      issues.push({ code: "FORMAL_DATA_ASSET_MISSING", message: "Checkpoint 未锁定正式候选数据资产。" });
    }

    const finalExact = issues.length === 0;
    return {
      code,
      checkpointId: manifest?.checkpointId || null,
      sourceContext: clone(manifest?.scenarioContext || null),
      exact: finalExact,
      restoreMode: finalExact && manifest?.restoreReadiness?.status === "verified" ? "isolated-clone" : "evidence-only",
      restorable: finalExact && manifest?.restoreReadiness?.status === "verified",
      hasPublished,
      runnable: finalExact && hasPublished && Boolean(inputSnapshot) && inputShapeValid && Boolean(fixture) && fixtureShapeValid && Boolean(formalDataAsset),
      issues,
      model,
      modelPackage,
      publishedPointer,
      inputSnapshot,
      c035Results,
      publishedFacts,
      queryResults,
      decisionResults,
      reportManifest,
      reportContents,
      reportArtifacts,
      fixture,
      reportCount: Number(reportManifest?.reportCount || reportManifest?.summary?.reportCount || 0),
      moduleVersions: Object.fromEntries(Object.entries(manifest?.modules || {}).map(function ([moduleId, module]) {
        return [moduleId, module.moduleVersion];
      })),
      moduleStates: Object.fromEntries(Object.keys(manifest?.modules || {}).map(function (moduleId) {
        return [moduleId, moduleDocument(manifest, artifacts, moduleId)];
      })),
      data: {
        sourceAsset,
        pipelineRun,
        formalDataAsset,
        qualityResult,
        dataContract: moduleDocument(manifest, artifacts, "M02"),
        logicalMembers: clone(sourceAsset?.logicalMembers || [])
      },
      evidenceRefs: sectionItems(manifest, "evidence").map(function (item) { return item.ref; }),
      sectionRefs: Object.fromEntries(Object.keys(manifest?.stateSections || {}).map(function (section) {
        return [section, sectionItems(manifest, section).map(function (item) { return item.ref; })];
      }))
    };
  }

  return Object.freeze({
    collectReferences,
    validateArtifacts,
    resolveCheckpointProjection
  });
});
