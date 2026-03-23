import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
  },
  pack: {
    dts: { vue: true },
    format: ["esm", "cjs"],
    plugins: [vue()],
    deps: {
      neverBundle: [
        "vue",
        "@atscript/ui",
        "@atscript/ui-table",
        "@atscript/db-client",
        "@uniqu/core",
      ],
    },
  },
});
