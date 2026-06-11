import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), uiPlugin(), uiFnsPlugin()],
  format: "dts",
});
