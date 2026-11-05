import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";
import { getEntries } from "../../scripts/gen-exports.mjs";

export default defineConfig({
  plugins: [vue() as never, atscript() as never],
  test: {
    environment: "happy-dom",
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    // `locale` is its own entry: other packages read the app's UI texts
    // without reaching the form components.
    entry: { ...getEntries(), locale: "src/locale.ts" },
    dts: { vue: true, eager: true },
    format: ["esm", "cjs"],
    plugins: [vue() as never],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
