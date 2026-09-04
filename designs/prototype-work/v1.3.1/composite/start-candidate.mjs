import { pathToFileURL } from "node:url";
import { startCandidate as startParentCandidate } from "../../v1.3.0/composite/start-candidate.mjs";

export async function startCandidate({ staticPort = 4372, modelingPort = 4373, host = "127.0.0.1", root } = {}) {
  const runtime = await startParentCandidate({ staticPort, modelingPort, host, root });
  const entry = new URL("/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/index.html", runtime.staticUrl);
  entry.searchParams.set("m08ApiBase", runtime.modelingUrl);
  entry.hash = "home";
  return { ...runtime, entryUrl: entry.href };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const runtime = await startCandidate({
    staticPort: Number(process.env.OFW_STATIC_PORT || 4372),
    modelingPort: Number(process.env.M08_PORT || 4373)
  });
  process.stdout.write(`智财问策 v1.3.1 候选入口 ${runtime.entryUrl}\n模型目标与优化服务 ${runtime.modelingUrl}\n`);
  const stop = async () => { await runtime.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
