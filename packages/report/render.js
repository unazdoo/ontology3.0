"use strict";

const crypto = require("node:crypto");

const identity = require("../identity");
const {
  REPORT_DEFINITION_SCHEMA_VERSION,
  REPORT_TEMPLATE_SCHEMA_VERSION,
  createReportDefinition,
  createReportTemplate
} = require("./template");

const SAME_SOURCE_RENDER_SCHEMA_VERSION = "ofw.m06.same-source-render.v1";
const REPORT_RECORD_SCHEMA_VERSION = "ofw.m06.report-record.v1";
const DASHBOARD_VERSION_SCHEMA_VERSION = "ofw.m06.dashboard-version.v1";
const DASHBOARD_VIEW_SCHEMA_VERSION = "ofw.m06.dashboard-view.v1";

function fail(code, message, details) {
  const error = new Error(message);
  error.name = "ReportRenderError";
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson(value, label) {
  if (value === undefined) fail("INVALID_JSON", `${label || "value"} must not be undefined`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail("INVALID_JSON", `${label || "value"} must be JSON serializable`, error && error.message);
  }
}

function deepFreeze(value, seen) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  const visited = seen || new Set();
  if (visited.has(value)) return value;
  visited.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], visited));
  return Object.freeze(value);
}

function immutableJson(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBlock(value, index, sectionId) {
  if (!isPlainObject(value)) fail("INVALID_BLOCK", `section ${sectionId} block #${index + 1} must be an object`);
  const contentItemId = value.contentItemId || `${sectionId}-content-${index + 1}`;
  const anchorId = value.anchorId || `anchor-${contentItemId}`;
  const text = value.text ?? value.renderedValue ?? value.displayValue;
  if (!nonEmptyString(contentItemId)) fail("MISSING_CONTENT_ITEM_ID", `section ${sectionId} block #${index + 1} requires contentItemId`);
  if (!nonEmptyString(anchorId)) fail("MISSING_ANCHOR_ID", `section ${sectionId} block ${contentItemId} requires anchorId`);
  if (!nonEmptyString(text)) fail("MISSING_BLOCK_TEXT", `section ${sectionId} block ${contentItemId} requires text`);
  return {
    contentItemId: String(contentItemId).trim(),
    anchorId: String(anchorId).trim(),
    text: String(text).trim(),
    factRefs: Array.isArray(value.factRefs) ? cloneJson(value.factRefs, "block factRefs") : [],
    evidenceRefs: Array.isArray(value.evidenceRefs) ? cloneJson(value.evidenceRefs, "block evidenceRefs") : [],
    templateSlot: nonEmptyString(value.templateSlot) ? value.templateSlot.trim() : null
  };
}

function normalizeSectionContent(section, blockSource) {
  const blocks = Array.isArray(blockSource && blockSource.blocks) ? blockSource.blocks.map((item, index) => normalizeBlock(item, index, section.sectionId)) : [];
  return {
    sectionId: section.sectionId,
    title: section.title,
    summary: nonEmptyString(blockSource && blockSource.summary) ? blockSource.summary.trim() : section.summary,
    blocks
  };
}

function defaultManifestFromSections(sections, template) {
  const slotBySection = new Map((template.slots || []).map((slot) => [slot.sectionId, slot]));
  return sections.flatMap((section) => section.blocks.map((block) => ({
    contentItemId: block.contentItemId,
    anchorId: block.anchorId,
    sectionId: section.sectionId,
    templateSlot: block.templateSlot || slotBySection.get(section.sectionId)?.slotId || null,
    location: `${section.sectionId}/${block.contentItemId}`,
    factRefs: cloneJson(block.factRefs, "manifest factRefs"),
    evidenceRefs: cloneJson(block.evidenceRefs, "manifest evidenceRefs"),
    requiresEvidence: true
  })));
}

function normalizeManifest(input, sections, template) {
  const source = isPlainObject(input) ? input : {};
  const items = Array.isArray(source.items) && source.items.length ? source.items.map((item, index) => {
    if (!isPlainObject(item)) fail("INVALID_RENDER_MANIFEST_ITEM", `render manifest item #${index + 1} must be an object`);
    if (!nonEmptyString(item.contentItemId)) fail("MISSING_RENDER_CONTENT_ITEM_ID", `render manifest item #${index + 1} requires contentItemId`);
    if (!nonEmptyString(item.anchorId)) fail("MISSING_RENDER_ANCHOR_ID", `render manifest item ${item.contentItemId} requires anchorId`);
    return {
      contentItemId: item.contentItemId.trim(),
      anchorId: item.anchorId.trim(),
      sectionId: nonEmptyString(item.sectionId) ? item.sectionId.trim() : null,
      templateSlot: nonEmptyString(item.templateSlot) ? item.templateSlot.trim() : null,
      location: nonEmptyString(item.location) ? item.location.trim() : item.anchorId.trim(),
      factRefs: Array.isArray(item.factRefs) ? cloneJson(item.factRefs, "manifest factRefs") : [],
      evidenceRefs: Array.isArray(item.evidenceRefs) ? cloneJson(item.evidenceRefs, "manifest evidenceRefs") : [],
      requiresEvidence: item.requiresEvidence !== false
    };
  }) : defaultManifestFromSections(sections, template);
  return {
    manifestId: nonEmptyString(source.manifestId) ? source.manifestId.trim() : "RM-M06-SAME-SOURCE-v1",
    version: nonEmptyString(source.version) ? source.version.trim() : "1.0.0",
    reportDefinitionId: source.reportDefinitionId || template.reportDefinitionId,
    templateId: source.templateId || template.templateId,
    items
  };
}

function normalizeVerificationPlan(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => {
    if (!isPlainObject(item)) fail("INVALID_VERIFICATION_PLAN_ITEM", `verification plan item #${index + 1} must be an object`);
    return {
      id: nonEmptyString(item.id) ? item.id.trim() : `T049-PLAN-${String(index + 1).padStart(3, "0")}`,
      factId: nonEmptyString(item.factId) ? item.factId.trim() : null,
      contentItemId: nonEmptyString(item.contentItemId) ? item.contentItemId.trim() : null,
      checkType: nonEmptyString(item.checkType) ? item.checkType.trim() : "deterministic-check",
      owner: nonEmptyString(item.owner) ? item.owner.trim() : "报告中心",
      applicability: nonEmptyString(item.applicability) ? item.applicability.trim() : "applicable",
      executionState: nonEmptyString(item.executionState) ? item.executionState.trim() : "planned",
      t044Ids: Array.isArray(item.t044Ids) ? cloneJson(item.t044Ids, "verification plan t044Ids") : []
    };
  });
}

function normalizeSource(input) {
  if (!isPlainObject(input)) fail("INVALID_REPORT_SOURCE", "report source must be an object");
  const definition = createReportDefinition(input.definition);
  const template = createReportTemplate(input.template, { definition });
  const sectionMap = new Map((Array.isArray(input.sections) ? input.sections : []).map((item) => [item.sectionId || item.id, item]));
  const sections = definition.sections.map((section) => normalizeSectionContent(section, sectionMap.get(section.sectionId)));
  const renderManifest = normalizeManifest(input.renderManifest, sections, template);
  const verificationPlan = normalizeVerificationPlan(input.verificationPlan);
  return {
    contentVersionId: nonEmptyString(input.contentVersionId) ? input.contentVersionId.trim() : null,
    title: nonEmptyString(input.title) ? input.title.trim() : definition.title,
    subtitle: nonEmptyString(input.subtitle) ? input.subtitle.trim() : definition.subtitle,
    definition,
    template,
    sections,
    renderManifest,
    verificationPlan,
    contentSnapshot: isPlainObject(input.contentSnapshot) ? cloneJson(input.contentSnapshot, "contentSnapshot") : {}
  };
}

function renderHtmlDocument(model, reportId, sourceHash) {
  const sectionMarkup = model.sections.map((section) => [
    `<section class="report-section" data-section-id="${escapeHtml(section.sectionId)}">`,
    `<h2>${escapeHtml(section.title)}</h2>`,
    section.summary ? `<p class="section-summary">${escapeHtml(section.summary)}</p>` : "",
    ...section.blocks.map((block) => `<p id="${escapeHtml(block.anchorId)}" data-content-item-id="${escapeHtml(block.contentItemId)}">${escapeHtml(block.text)}</p>`),
    "</section>"
  ].join("")).join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"zh-CN\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    `<title>${escapeHtml(model.title)}</title>`,
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<meta name="report-definition-id" content="${escapeHtml(model.definition.reportDefinitionId)}">`,
    `<meta name="report-template-id" content="${escapeHtml(model.template.templateId)}">`,
    `<meta name="report-id" content="${escapeHtml(reportId)}">`,
    model.contentVersionId ? `<meta name="content-version-id" content="${escapeHtml(model.contentVersionId)}">` : "",
    `<meta name="same-source-sha256" content="${escapeHtml(sourceHash)}">`,
    "<style>body{font-family:Arial,Helvetica,sans-serif;margin:32px;color:#1f2937;}article{max-width:900px;margin:0 auto;}h1{margin:0 0 8px;}h2{margin:28px 0 8px;border-top:1px solid #d1d5db;padding-top:20px;}p{line-height:1.65;margin:10px 0;}header{margin-bottom:20px;}footer{margin-top:36px;color:#6b7280;font-size:12px;}</style>",
    "</head>",
    "<body>",
    `<article data-report-id="${escapeHtml(reportId)}" data-render-mode="same-source">`,
    "<header>",
    `<h1>${escapeHtml(model.title)}</h1>`,
    model.subtitle ? `<p>${escapeHtml(model.subtitle)}</p>` : "",
    `</header>`,
    sectionMarkup,
    `<footer>同源固定输出 · ${escapeHtml(model.renderManifest.manifestId)} · ${escapeHtml(model.renderManifest.version)} · SHA-256 ${escapeHtml(sourceHash)}</footer>`,
    "</article>",
    "</body>",
    "</html>"
  ].join("\n");
}

function wrapText(value, width) {
  const text = String(value || "").trim();
  if (!text) return [""];
  const characters = Array.from(text);
  const lines = [];
  let current = "";
  let units = 0;
  characters.forEach((character) => {
    const characterUnits = /[\u0000-\u00ff]/.test(character) ? 0.55 : 1;
    if (current && units + characterUnits > width) {
      lines.push(current);
      current = "";
      units = 0;
    }
    current += character;
    units += characterUnits;
  });
  if (current) lines.push(current);
  return lines;
}

function utf16BeHex(value) {
  const littleEndian = Buffer.from(String(value), "utf16le");
  for (let index = 0; index < littleEndian.length; index += 2) {
    const byte = littleEndian[index];
    littleEndian[index] = littleEndian[index + 1];
    littleEndian[index + 1] = byte;
  }
  return littleEndian.toString("hex").toUpperCase();
}

function createPdfBytes(model, reportId, sourceHash) {
  const elements = [];
  elements.push({ text: model.title, size: 20, leading: 26, before: 0, after: 10 });
  if (model.subtitle) elements.push({ text: model.subtitle, size: 11, leading: 16, before: 0, after: 6 });
  elements.push({ text: `Report ID: ${reportId}`, size: 9, leading: 13, before: 0, after: 0 });
  if (model.contentVersionId) elements.push({ text: `Content Version: ${model.contentVersionId}`, size: 9, leading: 13, before: 0, after: 0 });
  elements.push({ text: `Definition: ${model.definition.reportDefinitionId} / Template: ${model.template.templateId}`, size: 9, leading: 13, before: 0, after: 18 });
  model.sections.forEach((section) => {
    elements.push({ text: section.title, size: 15, leading: 20, before: 10, after: 7 });
    if (section.summary) elements.push({ text: section.summary, size: 10, leading: 15, before: 0, after: 7 });
    section.blocks.forEach((block) => {
      elements.push({ text: `[${block.contentItemId} @ ${block.anchorId}] ${block.text}`, size: 11, leading: 17, before: 0, after: 8 });
    });
  });
  elements.push({ text: `Source SHA-256: ${sourceHash}`, size: 8, leading: 11, before: 12, after: 0 });

  const pages = [[]];
  let y = 778;
  elements.forEach((element) => {
    const lines = wrapText(element.text, element.size >= 15 ? 27 : element.size <= 8 ? 24 : element.size <= 9 ? 58 : 46);
    if (y - element.before < 64 && pages[pages.length - 1].length) {
      pages.push([]);
      y = 778;
    }
    y -= element.before;
    lines.forEach((line) => {
      if (y < 64) {
        pages.push([]);
        y = 778;
      }
      pages[pages.length - 1].push({ text: line, size: element.size, x: 64, y });
      y -= element.leading;
    });
    y -= element.after;
  });

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";
  objects[3] = "<< /Type /Font /Subtype /Type0 /BaseFont /ArialUnicodeMS /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 5 0 R >>";
  objects[4] = "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ArialUnicodeMS /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /CIDToGIDMap /Identity >>";
  const toUnicode = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    "1 beginbfrange",
    "<0000> <FFFF> <0000>",
    "endbfrange",
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end"
  ].join("\n") + "\n";
  objects[5] = `<< /Length ${Buffer.byteLength(toUnicode, "ascii")} >>\nstream\n${toUnicode}endstream`;
  const pageRefs = [];
  let nextObjectId = 6;
  pages.forEach((pageElements, pageIndex) => {
    const contentId = nextObjectId++;
    const pageId = nextObjectId++;
    const streamLines = ["q", "0.12 0.16 0.23 rg"];
    pageElements.forEach((element) => {
      streamLines.push("BT");
      streamLines.push(`/F1 ${element.size} Tf`);
      streamLines.push(`1 0 0 1 ${element.x} ${element.y} Tm`);
      streamLines.push(`<${utf16BeHex(element.text)}> Tj`);
      streamLines.push("ET");
    });
    streamLines.push("0.42 0.46 0.52 rg");
    streamLines.push("BT", "/F1 8 Tf", `1 0 0 1 64 34 Tm`, `<${utf16BeHex(`${pageIndex + 1} / ${pages.length}`)}> Tj`, "ET", "Q");
    const stream = `${streamLines.join("\n")}\n`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageRefs.push(`${pageId} 0 R`);
  });
  objects[2] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [ ${pageRefs.join(" ")} ] >>`;

  const safeReportId = String(reportId).replace(/[^\x20-\x7E]/g, "?");
  const safeDefinitionId = String(model.definition.reportDefinitionId).replace(/[^\x20-\x7E]/g, "?");
  const safeTemplateId = String(model.template.templateId).replace(/[^\x20-\x7E]/g, "?");
  const chunks = [Buffer.from(`%PDF-1.4\n%\xC7\xEC\x8F\xA2\n% Report ID: ${safeReportId}\n% Definition: ${safeDefinitionId} / Template: ${safeTemplateId}\n% Same-Source-SHA256: ${sourceHash}\n`, "binary")];
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = chunks.reduce((total, chunk) => total + chunk.length, 0);
    chunks.push(Buffer.from(`${index} 0 obj\n${objects[index]}\nendobj\n`, "ascii"));
  }
  const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  let trailer = `xref\n0 ${objects.length}\n`;
  trailer += "0000000000 65535 f \n";
  for (let index = 1; index < objects.length; index += 1) {
    trailer += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer, "ascii"));
  return Buffer.concat(chunks);
}

function renderSameSourceBundle(input) {
  const reportId = nonEmptyString(input && input.reportId) ? input.reportId.trim() : fail("MISSING_REPORT_ID", "reportId is required");
  const model = normalizeSource(input);
  const sourceHash = sha256(identity.stableSerialize({
    definition: model.definition,
    template: model.template,
    sections: model.sections,
    renderManifest: model.renderManifest,
    verificationPlan: model.verificationPlan,
    contentSnapshot: model.contentSnapshot,
    contentVersionId: model.contentVersionId
  }));
  const html = renderHtmlDocument(model, reportId, sourceHash);
  const pdfBytes = createPdfBytes(model, reportId, sourceHash);
  const htmlSha256 = sha256(Buffer.from(html, "utf8"));
  const pdfSha256 = sha256(pdfBytes);
  return Object.freeze({
    schemaVersion: SAME_SOURCE_RENDER_SCHEMA_VERSION,
    reportId,
    contentVersionId: model.contentVersionId,
    sourceSchemaVersions: Object.freeze({
      definition: REPORT_DEFINITION_SCHEMA_VERSION,
      template: REPORT_TEMPLATE_SCHEMA_VERSION
    }),
    sourceHash,
    html,
    pdfBytes,
    htmlSha256,
    pdfSha256,
    renderManifest: immutableJson(model.renderManifest, "render manifest"),
    verificationPlan: immutableJson(model.verificationPlan, "verification plan"),
    contentSnapshot: immutableJson(model.contentSnapshot, "content snapshot"),
    definition: model.definition,
    template: model.template,
    title: model.title,
    subtitle: model.subtitle
  });
}

function createFrozenReportRecord(input, options) {
  if (!isPlainObject(input)) fail("INVALID_REPORT_RECORD_INPUT", "report record input must be an object");
  const scenarioContext = identity.assertScenarioContext(input.scenarioContext);
  const reportId = nonEmptyString(input.reportId) ? input.reportId.trim() : fail("MISSING_REPORT_ID", "reportId is required");
  const createdAt = nonEmptyString(input.createdAt) ? new Date(input.createdAt).toISOString() : new Date(options && options.now || Date.now()).toISOString();
  const bundle = renderSameSourceBundle(input);
  const contentVersionId = nonEmptyString(input.contentVersionId)
    ? input.contentVersionId.trim()
    : `CV-${reportId}-${bundle.sourceHash.slice(0, 12)}`;
  const report = {
    schemaVersion: REPORT_RECORD_SCHEMA_VERSION,
    contractId: "C015",
    reportId,
    title: bundle.title,
    subtitle: bundle.subtitle,
    scenarioContext,
    status: nonEmptyString(input.status) ? input.status.trim() : "draft",
    immutable: true,
    sameSource: true,
    sourceHash: bundle.sourceHash,
    createdAt,
    reportDefinitionId: bundle.definition.reportDefinitionId,
    reportTemplateId: bundle.template.templateId,
    contentVersionId,
    contentSnapshotRef: `${reportId}#contentSnapshot`,
    contentSnapshot: bundle.contentSnapshot,
    renderManifest: bundle.renderManifest,
    verificationPlan: bundle.verificationPlan,
    contentVersions: [{
      contentVersionId,
      sourceHash: bundle.sourceHash,
      htmlSha256: bundle.htmlSha256,
      pdfSha256: bundle.pdfSha256,
      frozenAt: createdAt,
      immutable: true
    }],
    frozenHtml: bundle.html,
    frozenPdf: {
      mediaType: "application/pdf",
      byteLength: bundle.pdfBytes.length,
      sha256: bundle.pdfSha256,
      base64: bundle.pdfBytes.toString("base64")
    }
  };
  return immutableJson(report, "report record");
}

function createDashboardVersion(input) {
  if (!isPlainObject(input)) fail("INVALID_DASHBOARD_VERSION_INPUT", "dashboard version input must be an object");
  const report = isPlainObject(input.report) ? input.report : fail("MISSING_REPORT", "dashboard version requires report");
  const dashboardVersionId = nonEmptyString(input.dashboardVersionId)
    ? input.dashboardVersionId.trim()
    : `DASH-${report.reportId}`;
  return immutableJson({
    schemaVersion: DASHBOARD_VERSION_SCHEMA_VERSION,
    dashboardVersionId,
    reportId: report.reportId,
    title: nonEmptyString(input.title) ? input.title.trim() : report.title,
    status: nonEmptyString(input.status) ? input.status.trim() : "published",
    formalReportPublished: input.formalReportPublished === true,
    contentSnapshotRef: report.contentSnapshotRef,
    contentVersionId: report.contentVersionId,
    contentSnapshot: cloneJson(input.contentSnapshot || report.contentSnapshot, "dashboard content snapshot")
  }, "dashboard version");
}

function createDashboardView(input) {
  if (!isPlainObject(input)) fail("INVALID_DASHBOARD_VIEW_INPUT", "dashboard view input must be an object");
  const report = isPlainObject(input.report) ? input.report : fail("MISSING_REPORT", "dashboard view requires report");
  return immutableJson({
    schemaVersion: DASHBOARD_VIEW_SCHEMA_VERSION,
    dashboardVersionId: nonEmptyString(input.dashboardVersionId) ? input.dashboardVersionId.trim() : `DASH-${report.reportId}`,
    reportId: report.reportId,
    contentSnapshotRef: report.contentSnapshotRef,
    contentVersionId: report.contentVersionId,
    contentSnapshot: cloneJson(input.contentSnapshot || report.contentSnapshot, "dashboard view content snapshot")
  }, "dashboard view");
}

module.exports = Object.freeze({
  SAME_SOURCE_RENDER_SCHEMA_VERSION,
  REPORT_RECORD_SCHEMA_VERSION,
  DASHBOARD_VERSION_SCHEMA_VERSION,
  DASHBOARD_VIEW_SCHEMA_VERSION,
  renderSameSourceBundle,
  createFrozenReportRecord,
  createDashboardVersion,
  createDashboardView
});
