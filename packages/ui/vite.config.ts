import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript()],
  test: {
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["@atscript/core", "@atscript/typescript"],
    },
  },
});
