import { defineConfig } from "vite";
export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: new URL("./index.html", import.meta.url).pathname,
        workbench: new URL("./workbench.html", import.meta.url).pathname,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/.runtime/**",
        "**/composite/evidence/**",
      ],
    },
  },
});
