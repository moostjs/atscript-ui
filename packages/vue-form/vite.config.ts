import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";
import { getEntries } from "../../scripts/gen-exports.mjs";

export default defineConfig({
  plugins: [vue() as never, atscript() as never],
  test: {
    environment: "happy-dom",
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    entry: getEntries(),
    dts: { vue: true },
    format: ["esm", "cjs"],
    plugins: [vue() as never],
    deps: {
      neverBundle: ["vue", "@atscript/ui", "@atscript/ui-fns", "@atscript/typescript"],
    },
  },
});
