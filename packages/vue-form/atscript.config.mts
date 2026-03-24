import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), uiPlugin()],
  format: "dts",
});
