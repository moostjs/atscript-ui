import { writeFileSync } from "fs";
import path from "path";

import { build } from "@atscript/core";
import dbPlugin from "@atscript/db/plugin";
import { tsPlugin as ts } from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import wfPlugin from "../plugin";

export async function setup() {
  const wd = path.join(process.cwd(), "src/__tests__/fixtures");
  const repo = await build({
    rootDir: wd,
    include: ["**/*.as"],
    plugins: [ts(), dbPlugin(), uiPlugin(), wfPlugin()],
  });
  const out = await repo.generate({ outDir: ".", format: "js" });
  const outDts = await repo.generate({ outDir: ".", format: "dts" });
  for (const file of [...out, ...outDts]) {
    writeFileSync(file.target, file.content);
  }
}
