import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript(), swc.vite()],
  oxc: false,
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    plugins: [atscript()],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
