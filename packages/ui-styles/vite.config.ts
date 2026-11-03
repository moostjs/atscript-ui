import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", vite: "src/vite.ts" },
    format: ["esm", "cjs"],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
  test: {
    environment: "node",
  },
});
