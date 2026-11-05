import atscript from "unplugin-atscript/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript()],
  test: {
    globalSetup: "src/__tests__/global-setup.ts",
  },
  pack: {
    // `messages` is its own entry: the text catalog imports nothing, so a
    // server registers it (`@atscript/ui/messages`) without the UI runtime.
    entry: ["src/index.ts", "src/plugin.ts", "src/messages.ts"],
    // One output module per source module: an app's bundler then pulls only
    // the modules an import reaches (and splits them across chunks), instead
    // of the whole runtime with the first import.
    unbundle: true,
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
