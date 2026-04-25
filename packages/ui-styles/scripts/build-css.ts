// Uses createAsBaseUnoConfig() (Decision 13 cycle-breaker) so this script
// does not depend on the extractor that imports componentClasses.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGenerator } from "unocss";

import { componentClasses, componentPackages } from "../src/generated/component-classes";
import { createAsBaseUnoConfig } from "../src/preset";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../dist/css");

type Pkg = (typeof componentPackages)[string];

const cmpEn = (a: string, b: string) => a.localeCompare(b, "en");

const allComponents = Object.keys(componentClasses).toSorted(cmpEn);
const byPkg: Record<Pkg, string[]> = { form: [], table: [], wf: [] };
for (const c of allComponents) byPkg[componentPackages[c]]?.push(c);

const baseConfig = createAsBaseUnoConfig({});

async function build(name: string, components: string[]) {
  const safelist = [...new Set(components.flatMap((c) => componentClasses[c] ?? []))].toSorted(
    cmpEn,
  );

  const uno = await createGenerator({
    presets: baseConfig.presets,
    shortcuts: baseConfig.shortcuts,
    safelist,
  });

  // Pass the safelist as the input source so every class is matched in
  // a deterministic order. Preflights stay on — vunor's palette CSS
  // variables ride in there and the components depend on them.
  const { css } = await uno.generate(safelist.join(" "));

  const target = path.join(outDir, `${name}.css`);
  await fs.writeFile(target, css);
  return { target, bytes: Buffer.byteLength(css), classes: safelist.length };
}

await fs.mkdir(outDir, { recursive: true });

const targets: Array<[string, string[]]> = [
  ["all", allComponents],
  ["form", byPkg.form],
  ["table", byPkg.table],
  ["wf", byPkg.wf],
];

const results = await Promise.all(targets.map(([n, c]) => build(n, c)));

for (const r of results) {
  const rel = path.relative(path.resolve(here, ".."), r.target);
  process.stdout.write(
    `  ${rel.padEnd(20)}  ${r.classes.toString().padStart(4)} classes  ${(r.bytes / 1024).toFixed(1)} KB\n`,
  );
}
