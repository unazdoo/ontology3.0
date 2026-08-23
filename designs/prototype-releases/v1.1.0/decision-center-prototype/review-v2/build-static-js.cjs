"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Babel = require("./shared/vendor/babel.min.js");

const sharedDir = path.join(__dirname, "shared");
const sources = ["s003-adapter.jsx", "data.jsx", "components.jsx", "app.jsx"];

for (const sourceName of sources) {
  const sourcePath = path.join(sharedDir, sourceName);
  const outputPath = path.join(sharedDir, sourceName.replace(/\.jsx$/, ".compiled.js"));
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = Babel.transform(source, {
    presets: [["react", { runtime: "classic" }]],
    sourceType: "script",
    filename: sourceName,
    comments: false,
    compact: true,
  }).code;
  fs.writeFileSync(outputPath, `${output}\n`, "utf8");
}
