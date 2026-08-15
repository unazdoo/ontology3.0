import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export const CHECKPOINT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SCENARIO_ROOT = path.resolve(CHECKPOINT_DIR, "..");
export const WORKSPACE_ROOT = path.resolve(SCENARIO_ROOT, "../..");
export const PROJECT_ROOT = path.resolve(WORKSPACE_ROOT, "../../..");
export const FOUNDATION_PATH = path.join(WORKSPACE_ROOT, "foundation/ofw-scenario-foundation.js");
export const FOUNDATION = require(FOUNDATION_PATH);

export const BASELINE_VERSION = "1.0.3";
export const BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";
export const SCENARIO_ID = "S004";
export const SCENARIO_VERSION = "S004-v1";

export const PHASES = Object.freeze([
  {
    alias: "CP-S004-00",
    code: "CP00",
    node: "initial-configured",
    minimumReferencedSections: ["configurations", "featureFlags", "evidence"]
  },
  {
    alias: "CP-S004-10",
    code: "CP10",
    node: "data-connected",
    minimumReferencedSections: ["data", "configurations", "evidence"]
  },
  {
    alias: "CP-S004-20",
    code: "CP20",
    node: "published-switched",
    minimumReferencedSections: ["data", "semantics", "configurations", "evidence"]
  },
  {
    alias: "CP-S004-30",
    code: "CP30",
    node: "query-integrated",
    minimumReferencedSections: ["data", "semantics", "configurations", "evidence"]
  },
  {
    alias: "CP-S004-40",
    code: "CP40",
    node: "decision-chain-completed",
    minimumReferencedSections: ["data", "semantics", "configurations", "evidence"]
  },
  {
    alias: "CP-S004-50",
    code: "CP50",
    node: "agent-report-dashboard-completed",
    minimumReferencedSections: ["data", "semantics", "configurations", "results", "reports", "evidence"]
  },
  {
    alias: "CP-S004-60",
    code: "CP60",
    node: "e2e-integrated",
    minimumReferencedSections: [
      "data",
      "semantics",
      "configurations",
      "results",
      "reports",
      "testFixtures",
      "featureFlags",
      "evidence"
    ]
  }
]);

const CODE_EXCLUDED_DIRECTORIES = new Set([
  "artifacts",
  "checkpoints",
  "evidence",
  "fixtures",
  "module-exports",
  "tests",
  "tmp",
  "tools"
]);

export function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

export function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableSort(value[key]);
      return result;
    }, {});
}

export function stableJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeImmutable(filePath, content) {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath);
    const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (!current.equals(next)) {
      throw new Error(`拒绝覆盖不可变文件：${path.relative(PROJECT_ROOT, filePath)}`);
    }
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return true;
}

export function walkFiles(root, options = {}) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const excludedDirectories = options.excludedDirectories || new Set();
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      if (excludedDirectories.has(name)) continue;
      const absolute = path.join(directory, name);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) files.push(absolute);
    }
  }
  walk(root);
  return files;
}

export function codeTreeDigest() {
  const files = walkFiles(SCENARIO_ROOT, { excludedDirectories: CODE_EXCLUDED_DIRECTORIES });
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(SCENARIO_ROOT, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

export function projectRef(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

export function resolveProjectRef(ref) {
  if (typeof ref !== "string" || !ref.trim() || path.isAbsolute(ref) || ref.includes("..")) {
    throw new Error(`非法或不稳定的仓内引用：${String(ref)}`);
  }
  const absolute = path.resolve(PROJECT_ROOT, ref);
  const relative = path.relative(PROJECT_ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`引用越出项目根目录：${ref}`);
  return absolute;
}

export function phaseByAlias(alias) {
  const phase = PHASES.find((item) => item.alias === alias);
  if (!phase) throw new Error(`未知 S004 Checkpoint 阶段：${alias}`);
  return phase;
}

export function checkpointManifestPath(alias, outputRoot = CHECKPOINT_DIR) {
  return path.join(outputRoot, alias, "manifest.json");
}

export function checkpointDigestPath(alias, outputRoot = CHECKPOINT_DIR) {
  return path.join(outputRoot, alias, "manifest.sha256");
}

export function assertS004Context(context) {
  FOUNDATION.assertScenarioContext(context);
  if (context.scenarioId !== SCENARIO_ID || context.scenarioVersion !== SCENARIO_VERSION) {
    throw new Error("Checkpoint 场景身份必须固定为 S004 / S004-v1");
  }
  return context;
}

export function inferModuleId(filePath, payload) {
  const explicit = payload?.moduleId || payload?.module || payload?.ownerModule;
  if (FOUNDATION.MODULE_IDS.includes(explicit)) return explicit;
  const normalized = filePath.split(path.sep).join("/");
  return FOUNDATION.MODULE_IDS.find((moduleId) => new RegExp(`(?:^|[/_.-])${moduleId}(?:[/_.-]|$)`, "i").test(normalized));
}

export function discoverModuleExportFiles() {
  const root = path.join(SCENARIO_ROOT, "module-exports");
  return walkFiles(root)
    .filter((file) => file.endsWith(".json") && path.basename(file) !== "index.json")
    .map((file) => {
      const payload = readJson(file);
      return { file, payload, moduleId: inferModuleId(file, payload) };
    })
    .filter((item) => FOUNDATION.MODULE_IDS.includes(item.moduleId));
}

function phaseAliasesFromPayload(payload) {
  const values = [payload?.checkpointAlias, payload?.phaseAlias, payload?.checkpointCode, payload?.phase];
  if (payload?.checkpointStates && typeof payload.checkpointStates === "object") {
    values.push(...Object.keys(payload.checkpointStates));
  }
  return values.filter((value) => typeof value === "string");
}

export function selectModuleExport(moduleId, phase) {
  const candidates = discoverModuleExportFiles().filter((item) => item.moduleId === moduleId);
  const exact = candidates.filter((item) => {
    const normalized = item.file.toUpperCase();
    return (
      normalized.includes(phase.alias.toUpperCase()) ||
      normalized.includes(phase.code.toUpperCase()) ||
      phaseAliasesFromPayload(item.payload).some(
        (value) => value.toUpperCase() === phase.alias.toUpperCase() || value.toUpperCase() === phase.code.toUpperCase()
      )
    );
  });
  if (exact.length !== 1) {
    throw new Error(
      `${moduleId}/${phase.alias} 必须且只能定位一个阶段导出；当前命中 ${exact.length} 个：${exact
        .map((item) => projectRef(item.file))
        .join("、")}`
    );
  }
  return exact[0];
}

export function moduleStateForPhase(selection, phase) {
  const states = selection.payload?.checkpointStates;
  if (!states || typeof states !== "object") return selection.payload;
  return states[phase.alias] || states[phase.code] || selection.payload;
}

export function assertModuleExport(selection, moduleId, phase, context) {
  const state = moduleStateForPhase(selection, phase);
  if (state?.scenarioContext) FOUNDATION.assertScenarioContextMatch(context, state.scenarioContext);
  else if (selection.payload?.scenarioContext) FOUNDATION.assertScenarioContextMatch(context, selection.payload.scenarioContext);
  const statedModule = state?.moduleId || selection.payload?.moduleId || selection.moduleId;
  if (statedModule !== moduleId) throw new Error(`${moduleId}/${phase.alias} 导出 moduleId 错配：${statedModule}`);
  if (phase.code === "CP30" && moduleId === "M03") {
    const applicability = state?.applicability || state?.status;
    if (!/not[-_ ]?applicable|不适用/i.test(String(applicability))) {
      throw new Error("CP-S004-30 的 M03 必须提供明确 not-applicable 回执");
    }
  }
  if (phase.code === "CP40" && moduleId === "M04") {
    const actionCount = Number(state?.actionRequestCount ?? state?.counts?.actionRequests ?? 0);
    const applicability = state?.applicability || state?.status;
    if (actionCount === 0 && !/not[-_ ]?applicable|不适用|no[-_ ]?action/i.test(String(applicability))) {
      throw new Error("CP-S004-40 无 Action Request 时，M04 必须提供明确 not-applicable/no-action 回执");
    }
  }
  return state;
}

export function createStateRef({ owner, resourceId, version, file, formedAt }) {
  return {
    owner,
    resourceId,
    version,
    ref: projectRef(file),
    sha256: sha256File(file),
    formedAt
  };
}

export function emptySection(reason) {
  return { status: "empty", reason, items: [] };
}

export function referencedSection(items) {
  return { status: "referenced", reason: "", items };
}

export function unavailableSection(reason) {
  return { status: "unavailable", reason, items: [] };
}

export function validateDetachedDigest(manifestPath, digestPath) {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(digestPath)) {
    throw new Error(`Checkpoint 文件不完整：${projectRef(manifestPath)}`);
  }
  const expected = fs.readFileSync(digestPath, "utf8").trim().split(/\s+/)[0];
  const actual = sha256File(manifestPath);
  if (actual !== expected) throw new Error(`Checkpoint detached SHA-256 不匹配：${projectRef(manifestPath)}`);
  return actual;
}

export function validateReferencedFiles(manifest, options = {}) {
  const historicalDrift = new Map(
    (options.allowedHistoricalDrift || []).map((item) => [item.ref, item.sha256Before])
  );
  for (const moduleId of FOUNDATION.MODULE_IDS) {
    const entry = manifest.modules[moduleId];
    const file = resolveProjectRef(entry.exportRef.split("#")[0]);
    if (!fs.existsSync(file)) throw new Error(`${moduleId} 导出不存在：${entry.exportRef}`);
    if (sha256File(file) !== entry.exportSha256) throw new Error(`${moduleId} 导出哈希不匹配：${entry.exportRef}`);
    const validationFile = resolveProjectRef(entry.validation.evidenceRef);
    if (!fs.existsSync(validationFile)) throw new Error(`${moduleId} 校验回执不存在：${entry.validation.evidenceRef}`);
  }
  for (const [sectionName, section] of Object.entries(manifest.stateSections)) {
    for (const item of section.items || []) {
      const file = resolveProjectRef(item.ref.split("#")[0]);
      const allowedSha = historicalDrift.get(item.ref.split("#")[0]);
      const historicalProofMatches = allowedSha && allowedSha === item.sha256;
      if (!fs.existsSync(file)) {
        if (!historicalProofMatches) throw new Error(`${sectionName} 状态引用不存在：${item.ref}`);
        continue;
      }
      if (sha256File(file) !== item.sha256 && !historicalProofMatches) {
        throw new Error(`${sectionName} 状态引用哈希不匹配：${item.ref}`);
      }
    }
  }
  const restoreEvidence = resolveProjectRef(manifest.restoreReadiness.evidenceRef);
  if (!fs.existsSync(restoreEvidence)) throw new Error(`恢复证据不存在：${manifest.restoreReadiness.evidenceRef}`);
}

export function validateS004Phase(manifest, alias) {
  const phase = phaseByAlias(alias);
  const generic = FOUNDATION.validateCheckpointManifest(manifest);
  if (!generic.ok) throw new Error(`Foundation 清单校验失败：${JSON.stringify(generic.errors)}`);
  assertS004Context(manifest.scenarioContext);
  if (manifest.checkpointNode !== phase.node) {
    throw new Error(`${alias} checkpointNode 必须是 ${phase.node}`);
  }
  if (manifest.baselineVersion !== BASELINE_VERSION || manifest.baselineSnapshotId !== BASELINE_SNAPSHOT_ID) {
    throw new Error(`${alias} 基线绑定错误`);
  }
  const codeEvidence = manifest.stateSections.evidence?.items?.find((item) =>
    String(item.resourceId || "").includes("VERIFICATION")
  );
  if (!codeEvidence) throw new Error(`${alias} 缺少代码树校验证据`);
  const codeEvidencePayload = readJson(resolveProjectRef(codeEvidence.ref));
  if (codeEvidencePayload.code?.treeSha256 !== manifest.code.treeSha256) {
    throw new Error(`${alias} manifest 与形成时代码树证据不一致`);
  }
  for (const sectionName of phase.minimumReferencedSections) {
    if (manifest.stateSections[sectionName]?.status !== "referenced") {
      throw new Error(`${alias} 的 ${sectionName} 必须为 referenced`);
    }
  }
  if (phase.code === "CP30" && manifest.stateSections.results.status !== "empty") {
    throw new Error("CP-S004-30 不得伪造智能问数结果，results 必须为 empty");
  }
  if (phase.code === "CP40") {
    const m04Ref = manifest.modules.M04.exportRef;
    const m04 = readJson(resolveProjectRef(m04Ref.split("#")[0]));
    const m04State = moduleStateForPhase({ payload: m04 }, phase);
    const actionCount = Number(m04State?.actionRequestCount ?? m04State?.counts?.actionRequests ?? 0);
    if (actionCount === 0 && manifest.stateSections.decisions.status !== "empty") {
      throw new Error("CP-S004-40 无 Action Request 时 decisions 必须为 empty");
    }
  }
  validateReferencedFiles(manifest);
  return true;
}

export function validateS004PreRisk(manifest, entry) {
  const generic = FOUNDATION.validateCheckpointManifest(manifest);
  if (!generic.ok) throw new Error(`PRE Foundation 清单校验失败：${JSON.stringify(generic.errors)}`);
  assertS004Context(manifest.scenarioContext);
  if (manifest.checkpointNode !== "pre-risk-change") throw new Error("PRE checkpointNode 必须是 pre-risk-change");
  if (manifest.baselineVersion !== BASELINE_VERSION || manifest.baselineSnapshotId !== BASELINE_SNAPSHOT_ID) {
    throw new Error("PRE 基线绑定错误");
  }
  for (const sectionName of ["configurations", "reports", "evidence"]) {
    if (manifest.stateSections[sectionName]?.status !== "referenced") {
      throw new Error(`PRE 的 ${sectionName} 必须为 referenced`);
    }
  }
  const riskEvidence = manifest.stateSections.evidence.items.find((item) =>
    String(item.resourceId || "").startsWith("S004-PRE-RISK-")
  );
  if (!riskEvidence) throw new Error("PRE 缺少风险修改证据");
  const evidencePayload = readJson(resolveProjectRef(riskEvidence.ref));
  if (evidencePayload.riskLevel !== "medium") throw new Error("PRE 风险级别必须锁定为 medium");
  if (evidencePayload.rollbackTarget?.phaseAlias !== "CP-S004-60") {
    throw new Error("PRE 回退目标必须是 CP-S004-60");
  }
  if (!Array.isArray(evidencePayload.changeScope) || evidencePayload.changeScope.length === 0) {
    throw new Error("PRE 必须锁定明确的修改范围");
  }
  const changeType = evidencePayload.changeType || "pdf-cover-header";
  if (changeType === "pdf-cover-header" && evidencePayload.changeScope.length !== 3) {
    throw new Error("PDF 修复 PRE 必须精确锁定构建脚本、同源 HTML 和 PDF 三个修改目标");
  }
  if (changeType === "publication-pointer-promotion") {
    const scopeRefs = new Set(evidencePayload.changeScope.map((item) => item.ref));
    for (const suffix of ["data.js", "module-exports/M06.json", "module-exports/index.json", "artifacts/index.json"]) {
      if (![...scopeRefs].some((ref) => ref.endsWith(suffix))) {
        throw new Error(`发布指针 PRE 缺少修改前锁定项：${suffix}`);
      }
    }
  }
  if (entry && entry.rollbackTargetCheckpointId !== evidencePayload.rollbackTarget.checkpointId) {
    throw new Error("PRE catalog 回退目标与风险证据不一致");
  }
  const rollbackManifest = readJson(resolveProjectRef(evidencePayload.rollbackTarget.manifestRef));
  const expectedCodeSha = evidencePayload.codeTreeSha256Before || rollbackManifest.code?.treeSha256;
  if (expectedCodeSha !== manifest.code.treeSha256) {
    throw new Error("PRE manifest 与修改前代码树证据不一致");
  }
  validateReferencedFiles(manifest, { allowedHistoricalDrift: evidencePayload.changeScope });
  return true;
}

export function validateS004PostFix(manifest, entry) {
  const generic = FOUNDATION.validateCheckpointManifest(manifest);
  if (!generic.ok) throw new Error(`POST-FIX Foundation 清单校验失败：${JSON.stringify(generic.errors)}`);
  assertS004Context(manifest.scenarioContext);
  if (manifest.baselineVersion !== BASELINE_VERSION || manifest.baselineSnapshotId !== BASELINE_SNAPSHOT_ID) {
    throw new Error("POST-FIX 基线绑定错误");
  }
  const match = entry?.phaseAlias?.match(/^CP-S004-(50|60)-POSTFIX-\d{17}$/);
  if (!match) throw new Error(`非法 POST-FIX 阶段别名：${entry?.phaseAlias}`);
  const expectedNode = match[1] === "50" ? "agent-report-dashboard-completed" : "e2e-integrated";
  if (manifest.checkpointNode !== expectedNode || entry.checkpointNode !== expectedNode) {
    throw new Error(`${entry.phaseAlias} checkpointNode 错配`);
  }
  const evidenceItem = manifest.stateSections.evidence.items.find(
    (item) => item.resourceId === "S004-POST-FIX-PUBLICATION-V1.0.1"
  );
  if (!evidenceItem) throw new Error(`${entry.phaseAlias} 缺少 post-fix 发布证据`);
  const evidence = readJson(resolveProjectRef(evidenceItem.ref));
  if (evidence.status !== "verified" || evidence.currentPublication?.contentVersion !== "1.0.1") {
    throw new Error(`${entry.phaseAlias} post-fix 发布证据状态无效`);
  }
  if (evidence.code?.treeSha256 !== manifest.code.treeSha256) {
    throw new Error(`${entry.phaseAlias} manifest 与 post-fix 代码树证据不一致`);
  }
  if (!manifest.modules.M06.exportRef.startsWith(
    "designs/prototype-work/v1.1.0/scenarios/s004/module-exports/M06-publication-v1.0.1.json#"
  )) {
    throw new Error(`${entry.phaseAlias} 未绑定新的 M06 v1.0.1 Owner 导出`);
  }
  if (manifest.modules.M06.exportSha256 !== evidence.m06OwnerExport.sha256) {
    throw new Error(`${entry.phaseAlias} M06 Owner 导出哈希与发布证据不一致`);
  }
  const reportRefs = new Set(manifest.stateSections.reports.items.map((item) => item.ref));
  for (const suffix of [
    "RPT-S004-CGNPC-20260815-v1.0.1.html",
    "RPT-S004-CGNPC-20260815-v1.0.1.pdf",
    "publication-manifest-v1.0.1.json",
    "PTR-S004-PUBLICATION-CURRENT-001-v1.0.1.json"
  ]) {
    if (![...reportRefs].some((ref) => ref.endsWith(suffix))) {
      throw new Error(`${entry.phaseAlias} 报告状态缺少 ${suffix}`);
    }
  }
  if (!entry.supersedesCheckpointId) throw new Error(`${entry.phaseAlias} 缺少 supersedesCheckpointId`);
  validateReferencedFiles(manifest);
  return true;
}

export function validateS004FinalDelivery(manifest, entry) {
  const generic = FOUNDATION.validateCheckpointManifest(manifest);
  if (!generic.ok) throw new Error(`FINAL-DELIVERY Foundation 清单校验失败：${JSON.stringify(generic.errors)}`);
  assertS004Context(manifest.scenarioContext);
  if (!/^CP-S004-DELIVERY-\d{17}$/.test(entry?.phaseAlias)) {
    throw new Error(`非法 FINAL-DELIVERY 阶段别名：${entry?.phaseAlias}`);
  }
  if (manifest.checkpointNode !== "e2e-integrated" || entry.checkpointNode !== "e2e-integrated") {
    throw new Error("FINAL-DELIVERY 必须复用合法 e2e-integrated 节点语义");
  }
  if (entry.deliveryStage !== "delivery-handoff-completed" || entry.deliveryStatus !== "final-delivery-ready") {
    throw new Error("FINAL-DELIVERY catalog 状态不完整");
  }
  const evidenceItem = manifest.stateSections.evidence.items.find(
    (item) => item.resourceId === "S004-FINAL-DELIVERY-READY"
  );
  if (!evidenceItem) throw new Error("FINAL-DELIVERY 缺少最终交付证据");
  const evidence = readJson(resolveProjectRef(evidenceItem.ref));
  if (
    evidence.deliveryStage !== "delivery-handoff-completed" ||
    evidence.deliveryStatus !== "final-delivery-ready" ||
    evidence.status !== "verified"
  ) {
    throw new Error("FINAL-DELIVERY 证据状态无效");
  }
  if (evidence.code?.treeSha256 !== manifest.code.treeSha256) {
    throw new Error("FINAL-DELIVERY manifest 与最终代码树证据不一致");
  }
  for (const moduleId of FOUNDATION.MODULE_IDS) {
    const expected = evidence.moduleOwnerExports[moduleId];
    const actual = manifest.modules[moduleId];
    if (!expected || actual.exportRef.split("#")[0] !== expected.ref || actual.exportSha256 !== expected.sha256) {
      throw new Error(`FINAL-DELIVERY ${moduleId} Owner 导出绑定错误`);
    }
  }
  if (evidence.currentPublication.contentVersion !== "1.0.1") {
    throw new Error("FINAL-DELIVERY 当前报告指针必须是 v1.0.1");
  }
  if (evidence.verification.checkpointContract.result !== "28/28 passed") {
    throw new Error("FINAL-DELIVERY 未绑定交接时 28/28 合同测试证据");
  }
  for (const gate of ["browser", "workbook", "pdf"]) {
    if (evidence.verification[gate]?.result !== "PASS") throw new Error(`FINAL-DELIVERY ${gate} 验证未通过`);
  }
  if (!evidence.boundaries.integrationReady || evidence.boundaries.platformAcceptanceReady !== false) {
    throw new Error("FINAL-DELIVERY 验收边界声明错误");
  }
  if (!entry.supersedesCheckpointId) throw new Error("FINAL-DELIVERY 缺少来源 post-fix CP60");
  validateReferencedFiles(manifest, {
    allowedHistoricalDrift: (evidence.deliveryDocuments || []).map((item) => ({
      ref: item.sourceRef || item.ref,
      sha256Before: item.sha256
    }))
  });
  return true;
}

export function validateCheckpointCatalog(catalog, outputRoot = CHECKPOINT_DIR) {
  if (catalog.schemaVersion !== 1 || catalog.scenarioId !== SCENARIO_ID || catalog.scenarioVersion !== SCENARIO_VERSION) {
    throw new Error("Checkpoint catalog 身份或 schemaVersion 无效");
  }
  if (!Array.isArray(catalog.checkpoints) || catalog.checkpoints.length < PHASES.length) {
    throw new Error(`Checkpoint catalog 至少必须包含 ${PHASES.length} 个固定阶段`);
  }
  const ids = new Set();
  for (const phase of PHASES) {
    const entry = catalog.checkpoints.find((item) => item.phaseAlias === phase.alias);
    if (!entry) throw new Error(`Checkpoint catalog 缺少 ${phase.alias}`);
    if (entry.checkpointNode !== phase.node) throw new Error(`${phase.alias} catalog 节点错配`);
    if (ids.has(entry.checkpointId)) throw new Error(`Checkpoint ID 重复：${entry.checkpointId}`);
    ids.add(entry.checkpointId);
    const manifestPath = checkpointManifestPath(phase.alias, outputRoot);
    const digestPath = checkpointDigestPath(phase.alias, outputRoot);
    const digest = validateDetachedDigest(manifestPath, digestPath);
    const manifest = readJson(manifestPath);
    if (manifest.checkpointId !== entry.checkpointId || digest !== entry.manifestSha256) {
      throw new Error(`${phase.alias} catalog 与 manifest/digest 不一致`);
    }
    validateS004Phase(manifest, phase.alias);
  }
  const fixedAliases = new Set(PHASES.map((phase) => phase.alias));
  const preRiskEntries = catalog.checkpoints.filter((item) => !fixedAliases.has(item.phaseAlias));
  for (const entry of preRiskEntries) {
    const isPreRisk = /^CP-S004-PRE-\d{17}$/.test(entry.phaseAlias) && entry.checkpointNode === "pre-risk-change";
    const isPostFix = /^CP-S004-(50|60)-POSTFIX-\d{17}$/.test(entry.phaseAlias);
    const isFinalDelivery = /^CP-S004-DELIVERY-\d{17}$/.test(entry.phaseAlias);
    if (!isPreRisk && !isPostFix && !isFinalDelivery) {
      throw new Error(`Checkpoint catalog 存在非法追加节点：${entry.phaseAlias}`);
    }
    if (ids.has(entry.checkpointId)) throw new Error(`Checkpoint ID 重复：${entry.checkpointId}`);
    ids.add(entry.checkpointId);
    const manifestPath = checkpointManifestPath(entry.phaseAlias, outputRoot);
    const digestPath = checkpointDigestPath(entry.phaseAlias, outputRoot);
    const digest = validateDetachedDigest(manifestPath, digestPath);
    const manifest = readJson(manifestPath);
    if (manifest.checkpointId !== entry.checkpointId || digest !== entry.manifestSha256) {
      throw new Error(`${entry.phaseAlias} catalog 与 manifest/digest 不一致`);
    }
    if (isPreRisk) validateS004PreRisk(manifest, entry);
    else if (isPostFix) validateS004PostFix(manifest, entry);
    else validateS004FinalDelivery(manifest, entry);
  }
  return true;
}
