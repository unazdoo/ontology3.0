import { pathToFileURL } from "node:url";
import { start } from '../server.mjs';

export async function startCandidate({ staticPort = 4592, modelingPort = 4593, host = "127.0.0.1", root } = {}) {
  const service = await start({port:0,staticPort,modelingPort});
  const runtime={...service,staticUrl:service.url};
  const entry = new URL("/designs/prototype-work/v1.5/composite/s001-e2e-integration/index.html", runtime.staticUrl);
  entry.searchParams.set("m08ApiBase", runtime.modelingUrl);
  entry.hash = "home";
  return { ...runtime, entryUrl: entry.href };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const runtime = await startCandidate({
    staticPort: Number(process.env.OFW_STATIC_PORT || 4592),
    modelingPort: Number(process.env.M08_PORT || 4593)
  });
  process.stdout.write(`智财问策 v1.5 原型入口 ${runtime.entryUrl}\n模型目标与优化服务 ${runtime.modelingUrl}\n`);
  const stop = async () => { await runtime.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
