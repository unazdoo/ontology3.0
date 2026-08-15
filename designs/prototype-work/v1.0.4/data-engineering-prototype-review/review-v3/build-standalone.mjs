import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(here, "shared");
const manifest = JSON.parse(fs.readFileSync(path.join(shared, "manifest.json"), "utf8"));
const entry = manifest.entries[0];

if (manifest.currentVariant !== "B2" || manifest.entries.length !== 1 || entry.variant !== "B2" || entry.output !== "方案B2.html") {
  throw new Error("当前构建只能更新唯一评审原型 方案B2.html");
}

const css = fs.readFileSync(path.join(shared, "app.css"), "utf8");
const js = fs.readFileSync(path.join(shared, "fixtures.js"), "utf8") + "\n" + fs.readFileSync(path.join(shared, "app.js"), "utf8");
const shell = fs.readFileSync(path.join(here, entry.source), "utf8");
const meta = manifest.variants[0];
const manifestJson = JSON.stringify(manifest).replace(/</g, "\\u003c");
const output = shell
  .replace("{{VARIANT_TITLE}}", () => meta.title)
  .replace("{{APP_CSS}}", () => css)
  .replace("{{VARIANT}}", () => "B2")
  .replace("{{VARIANT_JSON}}", () => JSON.stringify("B2"))
  .replace("{{MANIFEST_JSON}}", () => manifestJson)
  .replace("{{APP_JS}}", () => js);

fs.writeFileSync(path.join(here, entry.output), output);
const hash = crypto.createHash("sha256").update(output).digest("hex").slice(0, 12);
console.log(entry.output + "  " + hash + "  " + (Buffer.byteLength(output) / 1024).toFixed(1) + " KiB");
