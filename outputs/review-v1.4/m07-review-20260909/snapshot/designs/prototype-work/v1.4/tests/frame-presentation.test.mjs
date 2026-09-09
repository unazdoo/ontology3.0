import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { startCandidate } from '../runtime/start.mjs';
import { embeddedModule, presentFrame } from '../runtime/frame-presentation.mjs';

test('Embedded presentation is emitted before business scripts and leaves standalone mode untouched', async () => {
  const html = '<html><head><script src="app.js"></script></head><body><nav>module</nav></body></html>';
  const rendered = await presentFrame(html, 'query');
  assert.ok(rendered.indexOf('ofw-v14-frame-presentation') < rendered.indexOf('src="app.js"'));
  const bootstrap = rendered.match(/<script>(.*?)<\/script>/s)[1];
  for (const embedded of [true, false]) {
    const window = {}, document = { documentElement: { dataset: {} } };
    window.parent = embedded ? {} : window;
    vm.runInNewContext(bootstrap, { window, document });
    assert.equal(document.documentElement.dataset.ofwEmbeddedModule, embedded ? 'query' : undefined);
  }
  assert.equal(await presentFrame(rendered, 'query'), rendered);
  assert.equal(await presentFrame(html, undefined), html);
});

test('Every Shell module is served with early shared presentation, including the original approval assembly', async () => {
  const global = {}; global.window = global;
  vm.runInNewContext(await readFile(new URL('../composite/s001-e2e-integration/data.js', import.meta.url), 'utf8'), global);
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  try {
    for (const module of [...global.OFW_V131_DATA.modules, global.OFW_V131_DATA.dashboard]) {
      const url = new URL(module.source, runtime.staticUrl + '/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html');
      assert.equal(embeddedModule(decodeURIComponent(url.pathname)), module.id);
      const response = await fetch(url), html = await response.text();
      assert.equal(response.status, 200);
      assert.equal(html.match(/id="ofw-v14-frame-presentation"/g)?.length, 1);
      assert.ok(html.indexOf('ofw-v14-frame-presentation') < html.indexOf('<body'));
      if (module.id === 'decision') assert.match(html, /decision-identity\.js/);
    }
  } finally { await runtime.close(); }
});
