import path from "path";

import dbPlugin from "@atscript/db/plugin";
import uiPlugin from "@atscript/ui/plugin";
import { prepareFixtures } from "@atscript/typescript/test-utils";
import wfPlugin from "../plugin";

export function setup() {
  return prepareFixtures({
    rootDir: path.join(process.cwd(), "src/__tests__/fixtures"),
    plugins: [dbPlugin(), uiPlugin(), wfPlugin()],
  });
}
