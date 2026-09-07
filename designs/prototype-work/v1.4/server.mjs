import { createServer } from "vite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer as createPortProbe } from "node:net";
import { startCandidate as startLegacy } from "../v1.3.0/composite/start-candidate.mjs";
export async function start({
  port = 4394,
  staticPort = 4392,
  modelingPort = 4393,
} = {}) {
  if (port === 0) {
    const probe = createPortProbe();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", resolve);
    });
    port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
  }
  const legacy = await startLegacy({ staticPort, modelingPort });
  let vite;
  try {
    vite = await createServer({
      root: fileURLToPath(new URL(".", import.meta.url)),
      server: {
        port,
        strictPort: true,
        host: "127.0.0.1",
        proxy: {
          "/designs": legacy.staticUrl,
          "/model-api": {
            target: legacy.modelingUrl,
            rewrite: (path) => path.replace(/^\/model-api/, ""),
          },
        },
      },
    });
    await vite.listen();
    const address = vite.httpServer.address();
    return {
      url: `http://127.0.0.1:${address.port}`,
      modelingUrl: legacy.modelingUrl,
      async close() {
        await vite.close();
        await legacy.close();
      },
    };
  } catch (error) {
    await vite?.close();
    await legacy.close();
    throw error;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const runtime = await start({
    port: Number(process.env.PORT || 4394),
    staticPort: Number(process.env.STATIC_PORT || 4392),
    modelingPort: Number(process.env.MODEL_PORT || 4393),
  });
  console.log(`v1.4 workbench: ${runtime.url}`);
  const stop = async () => {
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
