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
    },
    dts: true,
    // ESM-only because the `./store` subpath re-exports atscript-generated
    // classes (`AsWfStateRecord`) from `as-wf-state.as`, and vite-plus does
    // not propagate user plugins into the cjs-dts emit pass — the .as parser
    // would crash. Mirrors `@atscript/moost-ui-presets` for the same reason.
    format: ["esm"],
    plugins: [atscript()],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
