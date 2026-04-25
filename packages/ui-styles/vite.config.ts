import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    format: ["esm", "cjs"],
    deps: {
      neverBundle: ["unocss", "vunor", "@iconify/utils"],
    },
  },
  test: {
    environment: "node",
  },
});
