/**
 * Generates packages/ui-styles/src/generated/baked-icons.ts.
 *
 * Pipeline:
 *   1. Read defaultAsIconAliases from src/preset.ts (the single source of truth
 *      for which icons we ship).
 *   2. Use createIconsLoader to resolve each alias — loader handles transitive
 *      alias chains, Iconify API fetch + .icons/ caching for `prefix:name` ids,
 *      and bare-token lookup against `.icons/<name>.svg` for local custom SVGs
 *      (e.g. `loading`, `value-help`, `sorters`).
 *   3. Emit a deterministic, LF-newline file mapping kebab-name → full SVG
 *      string, sorted alphabetically. Fail loudly if any alias doesn't resolve.
 *
 * Run via: pnpm --filter @atscript/ui-styles run bake-icons
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createIconsLoader } from "../src/icon-loader";
import { defaultAsIconAliases } from "../src/preset";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

const cmpEn = (a: string, b: string) => a.localeCompare(b, "en");

async function main() {
  const iconsDir = path.join(PKG_ROOT, ".icons");
  if (!fs.existsSync(iconsDir)) {
    throw new Error(`[bake-icons] .icons/ directory not found at ${iconsDir}`);
  }

  const loader = createIconsLoader({
    aliases: defaultAsIconAliases,
    iconsDir,
  });

  const aliasNames = Object.keys(defaultAsIconAliases).toSorted(cmpEn);
  const baked: Record<string, string> = {};
  const missing: string[] = [];

  // Parallel fetch — cold CI runs hit the Iconify API ~30 times; warm runs read
  // the local cache. Output is reordered deterministically below.
  const resolved = await Promise.all(
    aliasNames.map(async (name) => [name, await loader(name)] as const),
  );

  for (const [name, svg] of resolved) {
    if (!svg || typeof svg !== "string" || !svg.trim().startsWith("<svg")) {
      missing.push(name);
      continue;
    }
    baked[name] = svg;
  }

  if (missing.length > 0) {
    throw new Error(
      `[bake-icons] Failed to resolve ${missing.length} icon(s): ${missing.join(", ")}\n` +
        "  Either the Iconify API is unreachable, or a local SVG is missing from .icons/.\n" +
        "  Bake step refuses to emit a partial map.",
    );
  }

  const lines: string[] = [
    "// GENERATED — DO NOT EDIT BY HAND.",
    "// Run `pnpm --filter @atscript/ui-styles run bake-icons` to regenerate.",
    "//",
    "// Maps each public semantic icon name (used as `i-as-<name>`) to its full",
    "// SVG string. The map is sealed at our publish time; consumers can override",
    "// individual entries via `asPresetVunor({ iconOverrides })`.",
    "",
    "export const bakedIcons: Record<string, string> = {",
  ];

  for (const name of Object.keys(baked).toSorted(cmpEn)) {
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(baked[name])},`);
  }

  lines.push("};", "");

  const outDir = path.join(PKG_ROOT, "src", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "baked-icons.ts");
  const content = lines.join("\n").replace(/\r\n/g, "\n");
  fs.writeFileSync(outFile, content, "utf8");

  // Match `vp fmt` output exactly so regenerations stay byte-stable.
  execFileSync("vp", ["fmt", path.relative(PKG_ROOT, outFile)], {
    cwd: PKG_ROOT,
    stdio: "inherit",
  });

  // biome-ignore lint/suspicious/noConsole: build-time diagnostic
  console.log(
    `[bake-icons] Wrote ${path.relative(PKG_ROOT, outFile)} — ${aliasNames.length} icons.`,
  );
}

await main();
