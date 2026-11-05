import path from "path";

import { prepareFixtures } from "@atscript/typescript/test-utils";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "../plugin";

export function setup() {
  return prepareFixtures({
    rootDir: path.join(process.cwd(), "src/__tests__/fixtures"),
    plugins: [uiPlugin(), uiFnsPlugin()],
  });
}
