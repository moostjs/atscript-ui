import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // `csv` is its own entry: the CSV writer imports nothing, so a server can
    // load `@atscript/ui-table/csv` without the table engine.
    entry: { index: "src/index.ts", csv: "src/export/csv.ts" },
    dts: true,
    format: ["esm", "cjs"],
    deps: {
      // Nothing from node_modules is inlined, code or declarations: an import of
      // a package missing from dependencies/peerDependencies fails the build.
      onlyBundle: [],
    },
  },
});
