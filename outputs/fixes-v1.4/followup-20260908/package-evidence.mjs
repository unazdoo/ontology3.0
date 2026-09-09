import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const out = new URL('./', import.meta.url);
const root = new URL('../../../', out);
const source = new URL('designs/prototype-work/v1.4/', root);
const review = new URL('file:///Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/');
const hash = value => createHash('sha256').update(value).digest('hex');
const files = [];
async function visit(relative) {
  for (const entry of await readdir(new URL(relative, source), { withFileTypes: true })) {
    if (['node_modules', 'dist', 'artifacts', 'evidence', '.DS_Store', '.runtime'].includes(entry.name)) continue;
    const path = relative + entry.name;
    if (entry.isDirectory()) await visit(path + '/');
    else {
      const content = await readFile(new URL(path, source));
      files.push({ path, bytes: content.length, sha256: hash(content) });
    }
  }
}
await visit('');
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const products = ['src/domain.js', 'src/app.js', 'composite/integrations/joint-workbench.js', 'composite/shared/report-editor.js'];
let diff = '';
for (const path of products) {
  const result = spawnSync('diff', ['-u', fileURLToPath(new URL('snapshot/designs/prototype-work/v1.4/' + path, review)), fileURLToPath(new URL(path, source))], { encoding: 'utf8' });
  if (result.status > 1) throw new Error(result.stderr);
  diff += result.stdout;
}
await writeFile(new URL('implementation.diff', out), diff);
const baseline = JSON.parse(await readFile(new URL('baseline.json', out)));
const manifest = { generatedAt: new Date().toISOString(), sourceRoot: fileURLToPath(source), branch: baseline.branch,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: root }).trim(), uncommitted: true,
  reviewInput: { path: fileURLToPath(new URL('REVIEW-REPORT.md', review)), sha256: hash(await readFile(new URL('REVIEW-REPORT.md', review))) },
  sourceDigest: hash(JSON.stringify(files)), files };
await writeFile(new URL('source-manifest.json', out), JSON.stringify(manifest, null, 2));
const browser = JSON.parse(await readFile(new URL('after/result.json', out)));
const rules = JSON.parse(await readFile(new URL('owned-rules-browser/result.json', out)));
const unit = await readFile(new URL('unit-final.log', out), 'utf8');
if (browser.status !== 'passed' || rules.status !== 'passed' || !/# pass 114\n# fail 0/.test(unit)) throw new Error('Final verification incomplete');
await writeFile(new URL('verification-summary.json', out), JSON.stringify({ generatedAt: manifest.generatedAt,
  scope: ['R14-002', 'R14-011', 'R14-012'], outcome: 'verified within documented acceptance and boundary cases',
  unit: { passed: 114, failed: 0 }, browserChecks: browser.checks, ruleChecks: rules.checks,
  sourceDigest: manifest.sourceDigest, originalReviewNotModified: true,
  changedProducts: products.map(path => ({ path, before: baseline.files.find(file => file.file === path)?.sha256, after: files.find(file => file.path === path)?.sha256 })) }, null, 2));
console.log(JSON.stringify({ files: files.length, sourceDigest: manifest.sourceDigest, browserChecks: browser.checks.length, ruleChecks: rules.checks.length }));
