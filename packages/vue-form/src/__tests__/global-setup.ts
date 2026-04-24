import path from "path";

import uiPlugin from "@atscript/ui/plugin";
import { prepareFixtures } from "@atscript/typescript/test-utils";

export function setup() {
  return prepareFixtures({
    rootDir: path.join(process.cwd(), "src/__tests__/fixtures"),
    plugins: [uiPlugin()],
  });
}
