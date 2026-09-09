import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function runtime() {
  const sandbox = {}; sandbox.window = sandbox;
  vm.createContext(sandbox); vm.runInContext(read("shared/readability.js"), sandbox);
  return sandbox.OFW_READABILITY;
}
function style(size, priority = "") {
  const properties = new Map([["font-size", size], ["line-height", "1.5"]]);
  return { getPropertyValue: (key) => properties.get(key) || "", getPropertyPriority: () => priority, setProperty: (key, value) => properties.set(key, value) };
}
function documentFor(rules) {
  return { body: { isConnected: true }, styleSheets: [{ cssRules: rules }], querySelectorAll: () => [] };
}

test("readability distinguishes regular controls, headings and technical identifiers", () => {
  const layout = runtime();
  assert.equal(layout.minimumFor(".text-button"), 13);
  assert.equal(layout.minimumFor(".card small"), 13);
  assert.equal(layout.minimumFor(".identity code"), 12);
  assert.equal(layout.minimumFor("body"), 14);
  assert.equal(layout.minimumFor(".page h2"), 16);
});

test("small CSS fonts are raised without reducing metric values or changing visibility", () => {
  const small = style("8px", "important"), large = style("28px"), hidden = style("0px");
  const layout = runtime();
  layout.refresh(documentFor([{ style: small, selectorText: ".caption" }, { style: large, selectorText: ".metric" }, { style: hidden, selectorText: ".icon-only" }]));
  assert.equal(small.getPropertyValue("font-size"), "max(13px, 8px)");
  assert.equal(small.getPropertyPriority("font-size"), "important");
  assert.equal(large.getPropertyValue("font-size"), "28px");
  assert.equal(hidden.getPropertyValue("font-size"), "0px");
});

test("responsive rules retain their font expression and newly loaded sheets are handled", () => {
  const first = style("var(--ofw-type-10)"), next = style("10px");
  const doc = documentFor([{ cssRules: [{ selectorText: ".caption", style: first }] }]);
  const layout = runtime(); layout.refresh(doc); layout.refresh(doc);
  assert.equal(first.getPropertyValue("font-size"), "max(13px, var(--ofw-type-10))");
  doc.styleSheets.push({ cssRules: [{ selectorText: ".caption", style: next }] });
  layout.refresh(doc);
  assert.equal(next.getPropertyValue("font-size"), "max(13px, 10px)");
});

test("supplementary data content is placed inside the scrolling page, never before a full-height app", () => {
  const source = read("integrations/native-module-integrations.js");
  const lineage = source.slice(source.indexOf("function renderDataLineage"), source.indexOf("function semanticPortfolioSummary"));
  assert.match(lineage, /main\.prepend\(root\)/);
  assert.doesNotMatch(lineage, /doc\.body\.firstElementChild/);
  const bar = source.slice(source.indexOf("function renderWorkspaceContextBar"), source.indexOf("function renderQueryScope"));
  assert.doesNotMatch(bar, /createElement|insertBefore|innerHTML/);
});
