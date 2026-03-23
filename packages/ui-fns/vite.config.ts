import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["@atscript/core", "@atscript/typescript", "@atscript/ui"],
    },
  },
});
