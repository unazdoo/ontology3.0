"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Babel = require("../../vendor/babel.min.js");

for (const sourceName of ["data.jsx", "components.jsx", "app.jsx"]) {
  const sourcePath = path.join(__dirname, sourceName);
  const outputPath = path.join(__dirname, sourceName.replace(/\.jsx$/, ".compiled.js"));
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = Babel.transform(source, {
    presets: [["react", { runtime: "classic" }]],
    sourceType: "script",
    filename: sourceName,
    comments: false,
    compact: true
  }).code;
  fs.writeFileSync(outputPath, `(function () {\n${output}\n})();\n`, "utf8");
}
