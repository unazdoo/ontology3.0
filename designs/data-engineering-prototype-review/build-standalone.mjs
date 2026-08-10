import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const safeScript = (source) => source.replace(/<\/script/gi, "<\\/script");

const scripts = [
  ["vendor/lucide.min.js", "text/javascript"],
  ["vendor/react.development.js", "text/javascript"],
  ["vendor/react-dom.development.js", "text/javascript"],
  ["vendor/babel.min.js", "text/javascript"],
  ["prototype-b-data.jsx", "text/babel"],
  ["prototype-b-shared.jsx", "text/babel"],
  ["prototype-b-screens-sources.jsx", "text/babel"],
  ["prototype-b-screen-canvas.jsx", "text/babel"],
  ["prototype-b-screens-evidence.jsx", "text/babel"],
  ["prototype-b-app.jsx", "text/babel"],
];

const thumbnail = `
    <template id="__bundler_thumbnail" data-bg-color="#e9eef2">
      <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="数据工程工作台加载预览">
        <rect width="1200" height="800" fill="#e9eef2" />
        <rect width="58" height="800" fill="#17212b" />
        <rect x="58" width="220" height="800" fill="#24323e" />
        <rect x="278" width="922" height="58" fill="#ffffff" />
        <rect x="318" y="118" width="150" height="84" rx="4" fill="#ffffff" stroke="#a26f3a" stroke-width="4" />
        <rect x="500" y="118" width="150" height="84" rx="4" fill="#ffffff" stroke="#536ccf" stroke-width="4" />
        <rect x="682" y="118" width="150" height="84" rx="4" fill="#ffffff" stroke="#168477" stroke-width="4" />
        <rect x="864" y="118" width="150" height="84" rx="4" fill="#ffffff" stroke="#7659b1" stroke-width="4" />
        <path d="M468 160H500M650 160H682M832 160H864" stroke="#778694" stroke-width="4" />
        <rect x="318" y="250" width="844" height="500" fill="#ffffff" stroke="#c8d0d8" />
        <rect x="350" y="286" width="510" height="18" fill="#2457d6" opacity="0.18" />
        <rect x="350" y="330" width="780" height="1" fill="#d8dee4" />
        <rect x="350" y="380" width="780" height="1" fill="#d8dee4" />
      </svg>
    </template>`;

const inlineScripts = scripts.map(([file, type]) => `    <script type="${type}">\n${safeScript(read(file))}\n    </script>`).join("\n");
const output = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>数据工程完整评审原型 · 方案 B · 离线版</title>
    <style>\n${read("prototype-b.css")}\n    </style>${thumbnail}
  </head>
  <body>
    <div id="root"></div>
${inlineScripts}
  </body>
</html>\n`;

fs.writeFileSync(path.join(root, "data-engineering-prototype-b-offline.html"), output);
console.log(`Built data-engineering-prototype-b-offline.html (${Buffer.byteLength(output).toLocaleString()} bytes)`);
