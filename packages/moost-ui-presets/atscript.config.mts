import { defineConfig } from "@atscript/core";
import dbPlugin from "@atscript/db/plugin";
import ts from "@atscript/typescript";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), dbPlugin()],
  format: "dts",
});
