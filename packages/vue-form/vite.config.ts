import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [vue(), atscript()],
  test: {
    environment: "happy-dom",
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    entry: ["src/index.ts"],
    dts: { vue: true },
    format: ["esm", "cjs"],
    plugins: [vue()],
    deps: {
      neverBundle: ["vue", "@atscript/ui", "@atscript/ui-fns", "@atscript/typescript"],
    },
  },
});
