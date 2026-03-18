import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["@atscript/typescript"],
    },
  },
});
