import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listen as listenModeling } from "./runtime/server.mjs";

const compositeRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(compositeRoot, "../../../..");
const parentM07HtmlSuffix = path.join("designs", "prototype-work", "v1.2.0", "composite", "modules", "m07", "module", "workspace-v2.html");
const staleLeafletCssIntegrity = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";
const verifiedLeafletCssIntegrity = "sha384-Eg+NzzpxiHf8n8FR0ootH/p/s0a33ljAFe4AqhcVbsQfR/WmVsHNIR1Uh37E0omq";
const m07OverlayScript = '<script src="/designs/prototype-work/v1.3.0/composite/integrations/m07-type-overlays.js?v=20260902-01"></script>';
const types = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"],
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".woff2", "font/woff2"]
]);

function staticServer(root = repositoryRoot) {
  const resolvedRoot = path.resolve(root);
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      let target = path.resolve(resolvedRoot, `.${pathname}`);
      if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("PATH_OUTSIDE_ROOT");
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, "index.html");
      const fileInfo = await stat(target);
      if (!fileInfo.isFile()) throw new Error("NOT_A_FILE");
      if (target.endsWith(parentM07HtmlSuffix)) {
        const source = await readFile(target, "utf8");
        const body = source
          .replace(staleLeafletCssIntegrity, verifiedLeafletCssIntegrity)
          .replace('<script src="workspace-v2.js?v=20260831-05"></script>', `${m07OverlayScript}\n  <script src="workspace-v2.js?v=20260831-05"></script>`);
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store",
          "x-ofw-parent-compatibility-fix": "m07-leaflet-css-sri"
        });
        response.end(body);
        return;
      }
      response.writeHead(200, { "content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store" });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Not found");
    }
  });
}

async function bind(server, { port, host }) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

export async function startCandidate({ staticPort = 4362, modelingPort = 4359, host = "127.0.0.1", root = repositoryRoot } = {}) {
  const staticHttp = await bind(staticServer(root), { port: staticPort, host });
  let modeling;
  try {
    modeling = await listenModeling({ port: modelingPort, host });
  } catch (error) {
    await new Promise((resolve) => staticHttp.close(resolve));
    throw error;
  }
  const staticAddress = staticHttp.address();
  const modelingAddress = modeling.address();
  return {
    staticServer: staticHttp,
    modelingServer: modeling,
    staticUrl: `http://${host}:${staticAddress.port}`,
    modelingUrl: `http://${host}:${modelingAddress.port}`,
    entryUrl: `http://${host}:${staticAddress.port}/designs/prototype-work/v1.3.0/composite/s001-e2e-integration/index.html?m08ApiBase=http%3A%2F%2F${host}%3A${modelingAddress.port}#home`,
    async close() {
      await Promise.all([
        new Promise((resolve) => staticHttp.close(resolve)),
        new Promise((resolve) => modeling.close(resolve))
      ]);
    }
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const runtime = await startCandidate({
    staticPort: Number(process.env.OFW_STATIC_PORT || 4362),
    modelingPort: Number(process.env.M08_PORT || 4359)
  });
  process.stdout.write(`智财问策 v1.3.0 候选入口 ${runtime.entryUrl}\n持续优化服务 ${runtime.modelingUrl}\n`);
  const stop = async () => { await runtime.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
