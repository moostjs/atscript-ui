import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import { dbPlugin } from "@atscript/db/plugin";
import uiPlugin from "./src/plugin.ts";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), dbPlugin(), uiPlugin()],
  format: "dts",
});
