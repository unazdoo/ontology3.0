const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("./vendor/babel.min.js");

const ROOT = path.resolve(__dirname, "..");
const SHARED = __dirname;
const SOURCES = ["s003-adapter.jsx", "data.jsx", "components.jsx", "app.jsx"];

test("M04 运行入口使用预编译脚本，不在浏览器内加载 Babel", () => {
  const html = fs.readFileSync(path.join(ROOT, "action-portfolio.html"), "utf8");
  assert.doesNotMatch(html, /babel\.min\.js|type=["']text\/babel["']/);
  SOURCES.forEach((source) => {
    assert.match(html, new RegExp(source.replace(".jsx", "\\.compiled\\.js")));
  });
});

test("M04 预编译产物与当前 JSX 源精确同步", () => {
  SOURCES.forEach((sourceName) => {
    const source = fs.readFileSync(path.join(SHARED, sourceName), "utf8");
    const expected = `${Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
      sourceType: "script",
      filename: sourceName,
      comments: false,
      compact: true,
    }).code}\n`;
    const actual = fs.readFileSync(path.join(SHARED, sourceName.replace(/\.jsx$/, ".compiled.js")), "utf8");
    assert.equal(actual, expected, `${sourceName} 修改后必须重新执行 build-static-js.cjs`);
  });
});
