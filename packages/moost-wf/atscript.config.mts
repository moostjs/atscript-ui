import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import wfPlugin from "./src/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), uiPlugin(), wfPlugin()],
  format: "dts",
});
