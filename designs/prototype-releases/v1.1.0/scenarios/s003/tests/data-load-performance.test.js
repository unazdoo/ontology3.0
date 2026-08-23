const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_SOURCE = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
const checkpointProjection = require(path.join(ROOT, "domain/checkpoint-projection.js"));

function createDataRuntime() {
  const requests = [];
  const window = {
    crypto: webcrypto,
    S003ScoreEngine: {},
    S003ConfigService: {},
    S003QueryService: {},
    S003DecisionService: {},
    S003ReportService: {},
    S003CheckpointService: {},
    S003CheckpointProjection: checkpointProjection,
  };
  const context = {
    URL,
    URLSearchParams,
    TextDecoder,
    console,
    window,
    document: {
      currentScript: { src: "http://s003.local/scenarios/s003/data.js?v=test" },
    },
    fetch: async (input) => {
      const url = new URL(String(input));
      const relative = decodeURIComponent(url.pathname.replace(/^\/scenarios\/s003\//, ""));
      const file = path.resolve(ROOT, relative);
      requests.push(relative);
      if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file)) {
        return new Response("missing", { status: 404, statusText: "Not Found" });
      }
      return new Response(fs.readFileSync(file), { status: 200 });
    },
    Response,
    setTimeout,
    clearTimeout,
  };
  window.window = window;
  Object.assign(window, context);
  vm.createContext(context);
  vm.runInContext(DATA_SOURCE, context, { filename: "data.js" });
  return { data: window.S003Data, requests };
}

test("S003 首屏只读取当前资源和 Checkpoint manifest，锁定工件按需校验", async () => {
  const runtime = createDataRuntime();
  const bundle = await runtime.data.load();

  assert.equal(bundle.checkpoints.length, runtime.data.CHECKPOINT_FILES.length);
  assert.equal(Object.keys(bundle.checkpointArtifacts).length, 0, "首屏不得预取历史 Checkpoint 工件");
  assert.equal(bundle.checkpoints.every((entry) => entry.integrity === null), true);
  assert.equal(runtime.requests.some((request) => request.startsWith("runtime/")), false);

  const before = runtime.requests.length;
  const loaded = await bundle.ensureCheckpointArtifacts("CP37");
  const after = runtime.requests.length;
  assert.equal(loaded.code, "CP37");
  assert.equal(Object.keys(bundle.checkpointArtifacts).length > 0, true);
  assert.equal(after - before < 30, true, "单一快照不得扩展成全目录工件抓取");
  assert.notEqual(bundle.checkpoints.find((entry) => entry.code === "CP37").integrity, null);

  await bundle.ensureCheckpointArtifacts("CP37");
  assert.equal(runtime.requests.length, after, "已校验工件应复用内存与浏览器缓存");
});
