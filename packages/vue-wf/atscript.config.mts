import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import wfPlugin from "@atscript/moost-wf/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), uiPlugin(), wfPlugin()],
  format: "dts",
});
