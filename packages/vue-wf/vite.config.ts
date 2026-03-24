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
    dts: { vue: true },
    format: ["esm"],
    plugins: [vue()],
    deps: {
      neverBundle: ["vue", "@atscript/ui", "@atscript/vue-form", "@atscript/typescript"],
    },
  },
});
