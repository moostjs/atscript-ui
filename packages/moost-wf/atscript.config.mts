import { defineConfig } from "@atscript/core";
import dbPlugin from "@atscript/db/plugin";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";
import wfPlugin from "./src/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), dbPlugin(), uiPlugin(), uiFnsPlugin(), wfPlugin()],
  format: "dts",
});
