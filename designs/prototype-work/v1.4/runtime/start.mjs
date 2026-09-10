import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createV14ModelServer } from './model-runtime.mjs';
import { embeddedModule, presentFrame } from './frame-presentation.mjs';
import { idleProjection } from './idle-projection.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'};
export async function startCandidate({staticPort=0,modelingPort=0}) {
  const staticServer = createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/designs/prototype-work/v1.4/composite/ontology/native-app.js') {
        const native = await readFile(path.join(root, 'designs/prototype-releases/v1.1.0/ontology-management-review/canvas-first/app.js'), 'utf8');
        const boundary = 'if (contract?.scenarioContext?.scenarioId === "S001") {';
        if (native.split(boundary).length !== 2) throw new Error('Native ontology boundary changed');
        // The legacy four-member constraint describes FIN-ASSET, not the new composite asset.
        res.setHeader('content-type', 'text/javascript; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        const target = 'return openDrafts.find(item => item.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION")';
        if (native.split(target).length !== 2) throw new Error('Native ontology intake changed');
        res.end(native
          .replace(boundary, 'if (contract?.scenarioContext?.scenarioId === "S001" && contract?.assetId !== "V14-ENTERPRISE-VIEW") {')
          .replace(target, 'if (contract?.assetId === "V14-ENTERPRISE-VIEW") return openDrafts.find(item => item.sourceDataContract?.assetVersion === contract.assetVersion) || null;\n    ' + target)
          .replace('if (version?.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION") {', 'if (version?.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION" && contract?.assetId !== "V14-ENTERPRISE-VIEW") {'));
        return;
      }
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root)) throw new Error('Outside repository');
      if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
      if (!(await stat(file)).isFile()) throw new Error('Not a file');
      res.setHeader('cache-control','no-store');
      res.setHeader('content-type',types[path.extname(file)] || 'application/octet-stream');
      if (pathname.endsWith('/ontology-management-review/canvas-first/portfolio-integration.js') || pathname.endsWith('/data-engineering-prototype-review/review-v3/portfolio-integration.js')) {
        res.end(idleProjection(await readFile(file, 'utf8'), pathname.includes('ontology-management-review') ? 'ontology' : 'data'));
        return;
      }
      const moduleId = embeddedModule(pathname);
      // Assemble the original approval screen with a version-local input migration.
      if (pathname.endsWith('/decision-center-prototype/review-v2/action-portfolio.html')) {
        const body = (await readFile(file,'utf8')).replace('await window.OFW_DECISION_PORTFOLIO.bootstrap();', 'await window.OFW_DECISION_PORTFOLIO.bootstrap();\n          await load("/designs/prototype-work/v1.4/composite/integrations/decision-identity.js");');
        res.end(await presentFrame(body, moduleId));
      } else if (pathname.endsWith('/v1.2.0/composite/modules/m07/module/workspace-v2.html')) {
        const body = (await readFile(file,'utf8'))
          .replace('sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H','sha384-Eg+NzzpxiHf8n8FR0ootH/p/s0a33ljAFe4AqhcVbsQfR/WmVsHNIR1Uh37E0omq')
          .replace('<script src="workspace-v2.js?v=20260831-05"></script>','<script src="/designs/prototype-work/v1.3.0/composite/integrations/m07-type-overlays.js?v=20260902-01"></script>\n<script src="workspace-v2.js?v=20260831-05"></script>');
        res.end(body);
      } else if (moduleId) {
        res.end(await presentFrame(await readFile(file, 'utf8'), moduleId));
      } else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  const modelingServer = createV14ModelServer();
  const bind = (server,port) => new Promise((resolve,reject) => {server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  try { await bind(staticServer,staticPort); await bind(modelingServer,modelingPort); }
  catch(error) { staticServer.close(); modelingServer.close(); throw error; }
  return {staticUrl:`http://127.0.0.1:${staticServer.address().port}`,modelingUrl:`http://127.0.0.1:${modelingServer.address().port}`,async close(){await new Promise(r=>staticServer.close(r));await new Promise(r=>modelingServer.close(r));}};
}
