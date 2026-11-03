import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript()],
  test: {
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    // One output module per source module: an app's bundler then pulls only
    // the modules an import reaches (and splits them across chunks), instead
    // of the whole runtime with the first import.
    unbundle: true,
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["@atscript/core", "@atscript/typescript"],
    },
  },
});
