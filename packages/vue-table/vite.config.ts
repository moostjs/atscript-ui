import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { getEntries } from "../../scripts/gen-exports.mjs";

export default defineConfig({
  plugins: [vue() as never],
  test: {
    environment: "happy-dom",
    // Node >= 25 ships its own `localStorage` global (undefined without
    // `--localstorage-file`), which shadows happy-dom's — turn it off.
    execArgv: ["--no-experimental-webstorage"],
  },
  pack: {
    entry: getEntries(),
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
