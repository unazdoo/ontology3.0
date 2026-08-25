#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  baseReceipt,
  bindingFromRuntime,
  publicError,
  readJsonSource,
  relativePath,
  writeJson
} from "./lib/quality-probe-common.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/run-accessibility-evidence.mjs [options]

Required:
  --url <url>              Running application URL to inspect
  --runtime <path>         Passed real-runtime receipt
  --focus-path <path>      JSON array (or {steps:[]}) of the exact Tab focus path
  --output <path>          Accessibility receipt JSON

Options:
  --browser <name>         chromium, firefox, or webkit (default: chromium)
  --cdp-endpoint <url>     Connect to an already running Chromium browser
  --timeout-ms <number>    Navigation/action timeout (default: 30000)`);
}

function parse(argv) {
  const result = { browser: "chromium", timeoutMs: 30000 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--url") result.url = argv[++index];
    else if (value === "--runtime") result.runtime = argv[++index];
    else if (value === "--focus-path") result.focusPath = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--browser") result.browser = argv[++index];
    else if (value === "--cdp-endpoint") result.cdpEndpoint = argv[++index];
    else if (value === "--timeout-ms") result.timeoutMs = Number(argv[++index]);
    else if (value === "--help" || value === "-h") result.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  for (const field of ["url", "runtime", "focusPath", "output"]) if (!result[field]) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
  if (!Number.isInteger(result.timeoutMs) || result.timeoutMs < 1000 || result.timeoutMs > 120000) throw new Error("timeout-ms must be between 1000 and 120000");
  return result;
}

function normalizedFocusSteps(value) {
  const steps = Array.isArray(value) ? value : value?.steps;
  if (!Array.isArray(steps) || steps.length === 0) throw new Error("focus-path must contain at least one expected keyboard focus step");
  return steps.map((entry, index) => {
    const step = typeof entry === "string" ? { selector: entry } : entry;
    if (!step || typeof step.selector !== "string" || !step.selector.trim()) throw new Error(`focus-path step ${index + 1} needs selector`);
    return { selector: step.selector, key: step.key || "Tab", label: step.label || null };
  });
}

async function focusProbe(page, steps) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.setAttribute("data-ofw-a11y-probe", "true");
  });
  const results = [];
  for (const step of steps) {
    await page.keyboard.press(step.key);
    const result = await page.evaluate(({ selector }) => {
      const active = document.activeElement;
      const target = document.querySelector(selector);
      const style = active ? getComputedStyle(active) : null;
      const rect = active?.getBoundingClientRect();
      const visible = Boolean(active && rect && rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden" && style?.display !== "none");
      return {
        selector,
        matched: Boolean(active && target && (active === target || active.matches(selector))),
        visible,
        activeTag: active?.tagName || null,
        activeId: active?.id || null,
        activeLabel: active?.getAttribute?.("aria-label") || null
      };
    }, step);
    results.push({ ...step, ...result });
  }
  return results;
}

export async function runAccessibilityProbe(options, dependencies) {
  const binding = bindingFromRuntime(options.runtime, options.env);
  const browserType = dependencies.playwright?.[options.browser || "chromium"];
  if (!browserType) throw new Error(`Playwright browser ${options.browser || "chromium"} is unavailable`);
  if (typeof dependencies.axeSource !== "string" || dependencies.axeSource.length < 100) throw new Error("axe-core source is unavailable");
  let browser;
  let context;
  let ownsContext = false;
  let ownsBrowser = false;
  const consoleErrors = [];
  const pageErrors = [];
  try {
    if (options.cdpEndpoint) {
      if (typeof browserType.connectOverCDP !== "function") throw new Error("selected browser does not support CDP connection");
      browser = await browserType.connectOverCDP(options.cdpEndpoint);
      const existingContext = browser.contexts()[0];
      context = existingContext || await browser.newContext();
      ownsContext = !existingContext;
    } else {
      browser = await browserType.launch({ headless: true });
      ownsBrowser = true;
      context = await browser.newContext();
      ownsContext = true;
    }
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs || 30000);
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(publicError(error)));
    await page.goto(options.url, { waitUntil: "networkidle", timeout: options.timeoutMs || 30000 });
    await page.addScriptTag({ content: dependencies.axeSource });
    const axe = await page.evaluate(async () => await globalThis.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations", "incomplete", "passes"]
    }));
    const focusResults = await focusProbe(page, options.focusSteps);
    const focusFailures = focusResults.filter((entry) => !entry.matched || !entry.visible);
    const violations = axe.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
    }));
    const blocked = violations.length > 0 || focusFailures.length > 0 || consoleErrors.length > 0 || pageErrors.length > 0;
    return baseReceipt("accessibility", binding, {
      status: blocked ? "blocked" : "passed",
      evidence: relativePath(options.output),
      standard: "WCAG 2.2 AA",
      targetUrl: options.url,
      browser: { name: options.browser || "chromium", version: typeof browser.version === "function" ? browser.version() : null, connectedOverCdp: Boolean(options.cdpEndpoint) },
      axe: { executed: true, violations, incompleteCount: axe.incomplete.length, passCount: axe.passes.length },
      violations: violations.length,
      keyboard: focusFailures.length === 0,
      focusPath: focusResults,
      consoleErrors,
      pageErrors,
      blockedReasons: [
        ...(violations.length ? ["axe-violations"] : []),
        ...(focusFailures.length ? ["keyboard-focus-path"] : []),
        ...(consoleErrors.length || pageErrors.length ? ["browser-errors"] : [])
      ],
      sources: options.sources
    });
  } finally {
    if (ownsContext && context) await context.close().catch(() => {});
    if (ownsBrowser && browser) await browser.close().catch(() => {});
  }
}

async function main(options) {
  const runtimeSource = readJsonSource(options.runtime);
  const focusSource = readJsonSource(options.focusPath);
  const runtime = runtimeSource.value;
  const focusSteps = normalizedFocusSteps(focusSource.value);
  let receipt;
  try {
    const [{ default: playwrightDefault, ...playwrightNamed }, axe] = await Promise.all([import("playwright"), import("axe-core")]);
    const playwright = Object.keys(playwrightNamed).length ? playwrightNamed : playwrightDefault;
    receipt = await runAccessibilityProbe({
      ...options,
      runtime,
      focusSteps,
      sources: { runtime: runtimeSource, focusPath: focusSource }
    }, { playwright, axeSource: axe.source || axe.default?.source });
  } catch (error) {
    let binding;
    try { binding = bindingFromRuntime(runtime); }
    catch { binding = { pullRequest: runtime.pullRequest || {}, environmentId: runtime.environmentId || "unknown", implementationRoundId: runtime.implementationRoundId || "unknown", runtimeRunId: runtime.runtimeRunId || "RUN-unknown", traceId: runtime.audit?.traceId || "", correlationId: runtime.audit?.correlationId || "" }; }
    receipt = baseReceipt("accessibility", binding, {
      status: "blocked",
      productionEvidence: false,
      evidence: relativePath(options.output),
      standard: "WCAG 2.2 AA",
      violations: null,
      keyboard: false,
      blockedReasons: ["probe-infrastructure-failed"],
      error: publicError(error),
      sources: { runtime: runtimeSource, focusPath: focusSource }
    });
  }
  writeJson(options.output, receipt);
  if (receipt.status !== "passed") throw new Error(`accessibility evidence blocked: ${receipt.blockedReasons.join(", ")}`);
  console.log(`Accessibility evidence passed: ${options.output}`);
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const options = parse(process.argv.slice(2));
    if (options.help) { usage(); process.exit(0); }
    await main(options);
  } catch (error) {
    console.error(`Accessibility evidence FAILED: ${publicError(error)}`);
    usage();
    process.exit(1);
  }
}
