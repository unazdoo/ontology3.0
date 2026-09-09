import { readFile } from 'node:fs/promises';

const modules = new Map([
  ['/designs/prototype-releases/v1.1.0/data-engineering-prototype-review/review-v3/方案B2.html', 'data'],
  ['/designs/prototype-work/v1.4/composite/ontology/index.html', 'ontology'],
  ['/designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/index.html', 'query'],
  ['/designs/prototype-releases/v1.1.0/decision-center-prototype/review-v2/action-portfolio.html', 'decision'],
  ['/designs/prototype-releases/v1.1.0/agent-application/Agent应用.html', 'agent'],
  ['/designs/prototype-releases/v1.1.0/report-center/review-lifecycle/index.html', 'report'],
  ['/designs/prototype-work/v1.4/composite/modules/m07/index.html', 'm07'],
  ['/designs/prototype-work/v1.4/composite/model-center/index.html', 'modeling'],
  ['/designs/prototype-work/v1.4/composite/dashboard/index.html', 'dashboard'],
]);

export function embeddedModule(pathname) { return modules.get(pathname); }

export async function presentFrame(html, moduleId) {
  if (!moduleId || html.includes('id="ofw-v14-frame-presentation"')) return html;
  const css = await readFile(new URL('../composite/shared/frame-presentation.css', import.meta.url), 'utf8');
  // The mode and its inline stylesheet are parsed before any business UI can paint.
  // Standalone pages do not acquire the embedding attribute and retain their navigation.
  const presentation = `<script>if(window.parent!==window)document.documentElement.dataset.ofwEmbeddedModule=${JSON.stringify(moduleId)};</script><style id="ofw-v14-frame-presentation">${css}</style>`;
  return html.replace(/<head\b[^>]*>/i, head => head + presentation);
}
