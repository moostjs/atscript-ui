import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", vite: "src/vite.ts" },
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["unocss", "vunor", "@iconify/utils", "unplugin-vue-components"],
    },
  },
  test: {
    environment: "node",
  },
});
