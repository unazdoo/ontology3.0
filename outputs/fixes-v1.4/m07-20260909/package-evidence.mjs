import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const out = new URL('./', import.meta.url), root = new URL('../../../', out);
const source = new URL('designs/prototype-work/v1.4/', root);
const review = new URL('file:///Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/');
const digest = value => createHash('sha256').update(value).digest('hex');
const files=[];
async function visit(relative){for(const entry of await readdir(new URL(relative,source),{withFileTypes:true})){
  if(['node_modules','dist','artifacts','evidence','.runtime','.DS_Store'].includes(entry.name))continue;
  const file=relative+entry.name;if(entry.isDirectory())await visit(file+'/');else{const bytes=await readFile(new URL(file,source));files.push({file,bytes:bytes.length,sha256:digest(bytes)});}
}}
await visit('');files.sort((a,b)=>a.file.localeCompare(b.file,'en'));
const baseline=JSON.parse(await readFile(new URL('baseline.json',out)));
if(files.find(f=>f.file==='composite/modules/m07/resources/portfolio.json').sha256!==baseline.dataSha256)throw Error('Source resource changed');
let diff='';
for(const name of ['app.js','styles.css','index.html','comparison.js']){
  const before=name==='comparison.js'?'/dev/null':fileURLToPath(new URL('snapshot/designs/prototype-work/v1.4/composite/modules/m07/'+name,review));
  const result=spawnSync('diff',['-u',before,fileURLToPath(new URL('composite/modules/m07/'+name,source))],{encoding:'utf8'});
  if(result.status>1)throw Error(result.stderr);diff+=result.stdout;
}
await writeFile(new URL('implementation.diff',out),diff);
const browser=JSON.parse(await readFile(new URL('browser/result.json',out))),layout=JSON.parse(await readFile(new URL('final-layout/result.json',out)));
const unit=await readFile(new URL('unit-final.log',out),'utf8');
if(browser.status!=='passed'||layout.status!=='passed'||!/# pass 125\n# fail 0/.test(unit))throw Error('Verification incomplete');
const manifest={at:new Date().toISOString(),sourceRoot:fileURLToPath(source),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),uncommitted:true,
  inputReview:{file:fileURLToPath(new URL('REVIEW-REPORT.md',review)),sha256:digest(await readFile(new URL('REVIEW-REPORT.md',review)))},sourceDigest:digest(JSON.stringify(files)),files};
await writeFile(new URL('source-manifest.json',out),JSON.stringify(manifest,null,2));
await writeFile(new URL('verification-summary.json',out),JSON.stringify({at:manifest.at,findings:['R14-015','R14-016','R14-017'],status:'verified within documented acceptance',unit:{passed:125,failed:0},browserChecks:browser.checks,layoutChecks:layout.checks,sourceResourceUnchanged:true,sourceDigest:manifest.sourceDigest,limitations:['M07 uses SVG; no dashboard WebGL conclusion','Static snapshot policy retained with explicit dates','No exhaustive permission or multi-user validation']},null,2));
console.log(JSON.stringify({files:files.length,sourceDigest:manifest.sourceDigest,browserChecks:browser.checks.length,layoutChecks:layout.checks.length}));
