import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";
import { dbAnnotationsPlugin } from "./src/__tests__/fixtures/db-annotations-plugin";

export default defineConfig({
  rootDir: "src",
  // `dbAnnotationsPlugin` only declares `@db.*` so the change-tracking test
  // fixtures (`patch-forms.as`) parse — vue-form has no runtime db dependency.
  plugins: [ts(), uiPlugin(), uiFnsPlugin(), dbAnnotationsPlugin()],
  format: "dts",
});
