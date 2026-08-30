import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const shared=path.join(here,"shared");
const manifest=JSON.parse(fs.readFileSync(path.join(shared,"manifest.json"),"utf8"));
const appCss=fs.readFileSync(path.join(shared,"app.css"),"utf8");
const appJs=fs.readFileSync(path.join(shared,"fixtures.js"),"utf8")+"\n"+fs.readFileSync(path.join(shared,"app.js"),"utf8");
const compareCss=fs.readFileSync(path.join(shared,"compare.css"),"utf8");
const compareJs=fs.readFileSync(path.join(shared,"compare.js"),"utf8");
const manifestJson=JSON.stringify(manifest).replace(/</g,"\\u003c");

for(const entry of manifest.entries){
  const source=fs.readFileSync(path.join(here,entry.source),"utf8");
  let output;
  if(entry.variant==="COMPARE"){
    output=source.replace("{{COMPARE_CSS}}",compareCss).replace("{{MANIFEST_JSON}}",manifestJson).replace("{{COMPARE_JS}}",compareJs);
  }else{
    const meta=manifest.variants.find(v=>v.key===entry.variant);
    output=source.replace("{{VARIANT_TITLE}}",meta.title).replace("{{APP_CSS}}",appCss).replace("{{VARIANT}}",entry.variant).replace("{{VARIANT_JSON}}",JSON.stringify(entry.variant)).replace("{{MANIFEST_JSON}}",manifestJson).replace("{{APP_JS}}",appJs);
  }
  fs.writeFileSync(path.join(here,entry.output),output);
  const hash=crypto.createHash("sha256").update(output).digest("hex").slice(0,12);
  console.log(`${entry.output}  ${hash}  ${(Buffer.byteLength(output)/1024).toFixed(1)} KiB`);
}
