import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript()],
  test: {
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    entry: {
      index: "src/index.ts",
      plugin: "src/plugin.ts",
      store: "src/store/index.ts",
      "ssr-adapter": "src/ssr-adapter.ts",
    },
    dts: true,
    // ESM-only because the `./store` subpath re-exports atscript-generated
    // classes (`AsWfStateRecord`) from `as-wf-state.as`, and vite-plus does
    // not propagate user plugins into the cjs-dts emit pass — the .as parser
    // would crash. Mirrors `@atscript/moost-ui-presets` for the same reason.
    format: ["esm"],
    plugins: [atscript()],
    deps: {
      neverBundle: [
        "@atscript/core",
        "@atscript/db",
        "@atscript/typescript",
        "moost",
        "@moostjs/event-wf",
        "@wooksjs/event-core",
        "@wooksjs/event-http",
        "@wooksjs/event-wf",
      ],
    },
  },
});
