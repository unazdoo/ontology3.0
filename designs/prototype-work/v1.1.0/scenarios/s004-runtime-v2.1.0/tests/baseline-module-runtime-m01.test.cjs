"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");

function createCanvasFixture() {
  const zoomLabel = { textContent: "72%" };
  const world = { style: { width: "2140px", height: "1120px", transform: "scale(0.72)" }, offsetWidth: 2140, offsetHeight: 1120 };
  const space = { style: { width: "1541px", height: "807px" } };
  const classNames = new Set();
  const viewport = {
    querySelector(selector) {
      if (selector === ".published-canvas-zoom b") return zoomLabel;
      return null;
    }
  };
  const scroll = {
    scrollLeft: 200,
    scrollTop: 100,
    clientWidth: 800,
    clientHeight: 500,
    dataset: { ofwS004Panzoom: "enabled" },
    classList: {
      add(name) { classNames.add(name); },
      remove(name) { classNames.delete(name); },
      contains(name) { return classNames.has(name); }
    },
    closest(selector) { return selector === ".published-canvas-viewport" ? viewport : null; },
    querySelector(selector) {
      if (selector === ".published-canvas-space") return space;
      if (selector === ".published-canvas-world") return world;
      return null;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500 }; },
    setPointerCapture(pointerId) { this.capturedPointerId = pointerId; },
    releasePointerCapture(pointerId) { this.releasedPointerId = pointerId; }
  };
  const backgroundTarget = {
    closest(selector) {
      if (selector.includes("published-canvas-scroll")) return scroll;
      return null;
    }
  };
  return { viewport, scroll, space, world, zoomLabel, backgroundTarget };
}

function createSandbox() {
  const documentListeners = {};
  const windowListeners = {};
  const records = new Map();
  const search = new URLSearchParams({
    moduleId: "M01",
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m01test",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  }).toString();
  const href = `http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?${search}`;
  const document = {
    currentScript: { src: "http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-runtime.js" },
    documentElement: { dataset: {} },
    body: {},
    head: { append() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return { dataset: {}, style: {}, setAttribute() {} }; },
    addEventListener(type, listener) { (documentListeners[type] ||= []).push(listener); }
  };
  const sandbox = {
    document,
    location: { href, search: `?${search}`, hash: "" },
    localStorage: {
      getItem(key) { return records.get(String(key)) ?? null; },
      setItem(key, value) { records.set(String(key), String(value)); },
      removeItem(key) { records.delete(String(key)); }
    },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    URL,
    URLSearchParams,
    setTimeout() { return 0; },
    addEventListener(type, listener) { (windowListeners[type] ||= []).push(listener); },
    __OFW_BASELINE_MODULE_RUNTIME_TEST__: true
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", "MutationObserver", runtimeSource)(sandbox, sandbox, sandbox.MutationObserver);
  return { sandbox, api: sandbox.OFWBaselineModuleRuntimeTestApi, documentListeners };
}

test("M01 Published 只读画布缩放保持 50%—100% 边界并支持恢复比例", () => {
  const { api } = createSandbox();
  assert.equal(api.normalizeM01PublishedCanvasZoom(0.2), 0.5);
  assert.equal(api.normalizeM01PublishedCanvasZoom(1.4), 1);
  assert.equal(api.normalizeM01PublishedCanvasZoom(undefined), 0.72);
  assert.equal(api.nextM01PublishedCanvasZoom(0.72, "in"), 0.82);
  assert.equal(api.nextM01PublishedCanvasZoom(0.5, "out"), 0.5);
  assert.equal(api.nextM01PublishedCanvasZoom(0.9, "reset"), 0.72);
  assert.equal(api.publishedCanvasZoomFromWorld({ style: { transform: "scale(0.63)" } }), 0.63);
});

test("M01 Published 缩放只改变查看变换、空间尺寸和滚动锚点", () => {
  const { sandbox, api } = createSandbox();
  const fixture = createCanvasFixture();
  const zoom = api.applyM01PublishedCanvasZoom(0.82, { scroll: fixture.scroll, clientX: 400, clientY: 250 });
  assert.equal(zoom, 0.82);
  assert.equal(fixture.world.style.transform, "scale(0.82)");
  assert.equal(fixture.space.style.width, "1755px");
  assert.equal(fixture.space.style.height, "919px");
  assert.equal(fixture.zoomLabel.textContent, "82%");
  assert.equal(fixture.scroll.dataset.ofwS004Zoom, "0.82");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M01PublishedCanvasZoom, "0.82");
  assert.equal(fixture.scroll.scrollLeft > 200, true);
  assert.equal(fixture.scroll.scrollTop > 100, true);
});

test("M01 Published 画布用鼠标滚轮缩放并以背景拖动平移", () => {
  const { sandbox, api, documentListeners } = createSandbox();
  const fixture = createCanvasFixture();
  api.applyM01PublishedCanvasZoom(0.72, { scroll: fixture.scroll });

  const wheelEvent = {
    target: fixture.backgroundTarget,
    deltaY: -100,
    clientX: 360,
    clientY: 240,
    timeStamp: 100,
    prevented: false,
    preventDefault() { this.prevented = true; }
  };
  documentListeners.wheel.forEach((listener) => listener(wheelEvent));
  assert.equal(wheelEvent.prevented, true);
  assert.equal(fixture.world.style.transform, "scale(0.82)");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M01PublishedCanvasLastInput, "wheel");

  const pointerDown = {
    target: fixture.backgroundTarget,
    button: 0,
    pointerId: 7,
    clientX: 300,
    clientY: 220,
    preventDefault() {}
  };
  const beforeLeft = fixture.scroll.scrollLeft;
  const beforeTop = fixture.scroll.scrollTop;
  documentListeners.pointerdown.forEach((listener) => listener(pointerDown));
  documentListeners.pointermove.forEach((listener) => listener({ pointerId: 7, clientX: 230, clientY: 160, preventDefault() {} }));
  assert.equal(fixture.scroll.scrollLeft, beforeLeft + 70);
  assert.equal(fixture.scroll.scrollTop, beforeTop + 60);
  assert.equal(fixture.scroll.classList.contains("is-s004-panning"), true);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M01PublishedCanvasLastInput, "drag");
  documentListeners.pointerup.forEach((listener) => listener({ pointerId: 7 }));
  assert.equal(fixture.scroll.classList.contains("is-s004-panning"), false);
  assert.equal(fixture.scroll.releasedPointerId, 7);
});

test("M01 Published 交互适配不写回本体位置或冻结源码", () => {
  assert.match(runtimeSource, /read-only-pan-wheel-zoom/);
  assert.match(runtimeSource, /addEventListener\("wheel"/);
  assert.match(runtimeSource, /addEventListener\("pointerdown"/);
  assert.match(runtimeSource, /passive:\s*false/);
  assert.doesNotMatch(runtimeSource, /draft\.positions\[[^\]]+\]\s*=/);
});

test("M01 保留 v1.0.3 原页面布局，不再插入 S004 私有语义总览卡片", () => {
  assert.match(runtimeSource, /M01:\s*""/);
  assert.match(runtimeSource, /baseline-layout-preserved/);
  assert.match(runtimeSource, /querySelectorAll\?\.\("\[data-ofw-s004-m01-context\], #ofw-s004-m01-context-style, #ofw-s004-module-banner"\)/);
  assert.doesNotMatch(runtimeSource, /anchor\.insertAdjacentHTML\("afterend", contextPanel\.html\)/);
});
