import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
