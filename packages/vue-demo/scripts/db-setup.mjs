// Seeds the demo SQLite database (`src/server/setup.ts`, which imports `.as`
// schemas) through the workspace's own Vite: every module is SSR-transformed
// and the dependency optimizer is off, so no prebundle in `node_modules/.vite`
// can go stale and nothing is fetched at run time.
import { createServer } from "vite";

const server = await createServer({
  configFile: "vite.setup.config.ts",
  appType: "custom",
  logLevel: "warn",
  cacheDir: "node_modules/.vite-db-setup",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
try {
  await server.ssrLoadModule("/src/server/setup.ts");
} finally {
  await server.close();
}
