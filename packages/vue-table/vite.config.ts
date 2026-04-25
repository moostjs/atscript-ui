import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { getEntries } from "../../scripts/gen-exports.mjs";

export default defineConfig({
  plugins: [vue() as never],
  test: {
    environment: "happy-dom",
  },
  pack: {
    entry: getEntries(),
    dts: { vue: true },
    format: ["esm", "cjs"],
    plugins: [vue() as never],
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
