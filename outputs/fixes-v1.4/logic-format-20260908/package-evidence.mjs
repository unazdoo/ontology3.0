import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const out = new URL('./', import.meta.url), root = new URL('../../../', out);
const source = new URL('designs/prototype-work/v1.4/', root);
const review = new URL('file:///Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/');
const hash = value => createHash('sha256').update(value).digest('hex');
const files = [];
async function visit(relative) {
  for (const entry of await readdir(new URL(relative, source), { withFileTypes: true })) {
    if (['node_modules', 'dist', 'artifacts', 'evidence', '.DS_Store', '.runtime'].includes(entry.name)) continue;
    const path = relative + entry.name;
    if (entry.isDirectory()) await visit(path + '/');
    else { const bytes = await readFile(new URL(path, source)); files.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
  }
}
await visit(''); files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const products = ['src/domain.js', 'composite/shared/report-editor.js'];
let diff = '';
for (const path of products) {
  const result = spawnSync('diff', ['-u', fileURLToPath(new URL('snapshot/designs/prototype-work/v1.4/' + path, review)), fileURLToPath(new URL(path, source))], { encoding: 'utf8' });
  if (result.status > 1) throw new Error(result.stderr);
  diff += result.stdout;
}
await writeFile(new URL('implementation.diff', out), diff);
const browser = JSON.parse(await readFile(new URL('after/result.json', out), 'utf8'));
const unit = await readFile(new URL('unit-final.log', out), 'utf8');
if (browser.status !== 'passed' || !/# pass 120\n# fail 0/.test(unit)) throw new Error('Verification not complete');
const manifest = { at: new Date().toISOString(), sourceRoot: fileURLToPath(source),
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), uncommitted: true,
  inputReview: { path: fileURLToPath(new URL('REVIEW-REPORT.md', review)), sha256: hash(await readFile(new URL('REVIEW-REPORT.md', review))) },
  sourceDigest: hash(JSON.stringify(files)), files };
await writeFile(new URL('source-manifest.json', out), JSON.stringify(manifest, null, 2));
await writeFile(new URL('verification-summary.json', out), JSON.stringify({ at: manifest.at, findings: [
  { id: 'R14-013', resolution: 'Explicitly reject unsupported OR; union is not implemented', verified: true },
  { id: 'R14-014', resolution: 'Shared display precision for editor, preview and HTML; source values unchanged', verified: true },
], unit: { passed: 120, failed: 0 }, browser: { checks: browser.checks, builtWorkbench: browser.builtWorkbench,
  webglUnavailable: browser.webglUnavailable, screenshotsEnabled: browser.screenshotsEnabled },
  limitations: ['Normal WebGL startup timed out; validated in existing fallback mode', 'Full screenshots not completed; DOM values and actual HTML download verified', 'Natural-language inputs are not exhaustively verified'],
  sourceDigest: manifest.sourceDigest, htmlSha256: hash(await readFile(new URL('after/report.html', out))) }, null, 2));
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, files: files.length, checks: browser.checks.length }));
