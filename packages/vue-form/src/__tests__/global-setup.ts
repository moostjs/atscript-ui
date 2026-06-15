import path from "path";

import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";
import { prepareFixtures } from "@atscript/typescript/test-utils";
import { dbAnnotationsPlugin } from "./fixtures/db-annotations-plugin";

export function setup() {
  return prepareFixtures({
    rootDir: path.join(process.cwd(), "src/__tests__/fixtures"),
    // `dbAnnotationsPlugin` declares the `@db.*` annotations used by the
    // change-tracking fixtures; vue-form has no runtime db dependency.
    plugins: [uiPlugin(), uiFnsPlugin(), dbAnnotationsPlugin()],
  });
}
