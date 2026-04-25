/**
 * Generates packages/ui-styles/src/generated/component-classes.ts.
 *
 * Pipeline:
 *   1. Discover public components across vue-form, vue-table, vue-wf
 *      (root + defaults; internal/ are reachable but not keys).
 *   2. Build a module graph via rolldown's experimental scan().
 *   3. For each public entry, walk the graph to collect every reachable
 *      .vue file, concatenate their source, run UnoCSS, capture matched
 *      classes.
 *   4. Parse each helper at <pkg>/src/composables/create-*.ts to derive
 *      helperAliases (Decision 17).
 *   5. Emit a deterministic, LF-newline file with three maps + two helpers.
 *
 * Run via: pnpm --filter @atscript/ui-styles run extract-classes
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import type { Plugin } from "rolldown";
import { scan } from "rolldown/experimental";
import { globSync } from "tinyglobby";
import { createGenerator } from "unocss";

import { kebabize } from "../src/kebab";
import { createAsBaseUnoConfig } from "../src/preset";

const PKG_KEYS = ["form", "table", "wf"] as const;
type PkgKey = (typeof PKG_KEYS)[number];

type Tier = "primary" | "default";

interface ComponentEntry {
  file: string;
  pkg: PkgKey;
  tier: Tier;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const REPO_PACKAGES = path.resolve(PKG_ROOT, "..");

const PKG_DIRS: Record<PkgKey, string> = {
  form: path.join(REPO_PACKAGES, "vue-form"),
  table: path.join(REPO_PACKAGES, "vue-table"),
  wf: path.join(REPO_PACKAGES, "vue-wf"),
};

const cmpEn = (a: string, b: string) => a.localeCompare(b, "en");
const stripQueryParams = (id: string) => {
  const idx = id.indexOf("?");
  return idx >= 0 ? id.slice(0, idx) : id;
};
const ASSET_RE =
  /\.(css|scss|less|styl|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp[34]|webm|ogg|pdf)(\?.*)?$/;

async function main() {
  // 1. Discover components --------------------------------------------------

  const entries: Record<string, ComponentEntry> = {};
  let internalCount = 0;

  for (const pkg of PKG_KEYS) {
    const root = PKG_DIRS[pkg];
    const tieredGlobs: Array<{ glob: string; tier: Tier }> = [
      { glob: "src/components/*.vue", tier: "primary" },
      { glob: "src/components/defaults/*.vue", tier: "default" },
    ];
    for (const { glob, tier } of tieredGlobs) {
      const files = globSync(glob, { cwd: root, absolute: true }).toSorted(cmpEn);
      for (const file of files) {
        const name = path.basename(file, ".vue");
        if (entries[name]) {
          throw new Error(
            `[extract-classes] Naming collision for "${name}": ${entries[name].file} vs ${file}`,
          );
        }
        entries[name] = { file, pkg, tier };
      }
    }
    internalCount += globSync("src/components/internal/*.vue", {
      cwd: root,
      absolute: true,
    }).length;
  }

  const publicNames = Object.keys(entries).toSorted(cmpEn);

  const counts: Record<PkgKey, number> = { form: 0, table: 0, wf: 0 };
  for (const n of publicNames) counts[entries[n].pkg]++;
  console.log(
    `[extract-classes] Discovered ${publicNames.length} public components (` +
      PKG_KEYS.map((k) => `${k}=${counts[k]}`).join(", ") +
      `) and ${internalCount} internal components.`,
  );

  // 2. Build module graph ---------------------------------------------------

  const moduleGraph = new Map<string, string[]>();
  const entryIdMap = new Map<string, string>();

  const stubAssetsPlugin: Plugin = {
    name: "stub-assets",
    resolveId(source) {
      if (ASSET_RE.test(source)) {
        return { id: `\0stub:${source}`, external: true };
      }
    },
  };

  const collectModuleGraphPlugin: Plugin = {
    name: "collect-module-graph",
    moduleParsed(info) {
      moduleGraph.set(info.id, [...info.importedIds, ...info.dynamicallyImportedIds]);
      if (info.isEntry) {
        const cleanPath = stripQueryParams(info.id);
        for (const name of publicNames) {
          if (cleanPath === entries[name].file) {
            entryIdMap.set(name, info.id);
            break;
          }
        }
      }
    },
  };

  // rolldown's package.json doesn't expose types for `./experimental`, so
  // `scan()` resolves to `void` at the type level. `await` recursively
  // unwraps thenables, so a single `await` is sufficient regardless of
  // whether scan returns Promise<void> or Promise<Promise<void>>.
  const runScan = scan as (opts: unknown) => Promise<unknown>;
  await runScan({
    input: Object.fromEntries(publicNames.map((n) => [n, entries[n].file])),
    external: [
      "vue",
      "vue-router",
      "reka-ui",
      "@vueuse/core",
      "@atscript/ui",
      "@atscript/ui-fns",
      "@atscript/ui-table",
      "@atscript/typescript",
      "@atscript/core",
      "vunor",
      /^vunor\//,
      "unocss",
      "defu",
      /^node:/,
    ],
    plugins: [stubAssetsPlugin, vue(), collectModuleGraphPlugin],
  });

  console.log(
    `[extract-classes] Module graph: ${moduleGraph.size} modules, ${entryIdMap.size} entries resolved.`,
  );

  for (const name of publicNames) {
    if (!entryIdMap.has(name)) {
      console.warn(`[extract-classes] WARNING: ${name} was not resolved as an entry`);
    }
  }

  // 3. Walk per entry to find reachable .vue files -------------------------

  function collectVueFiles(entryId: string): Set<string> {
    const visited = new Set<string>();
    const vueFiles = new Set<string>();
    const stack = [entryId];

    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (visited.has(id)) continue;
      visited.add(id);

      const cleanId = stripQueryParams(id);
      if (cleanId.endsWith(".vue") && !cleanId.includes("\0")) {
        vueFiles.add(cleanId);
      }

      const importedIds = moduleGraph.get(id);
      if (importedIds) {
        for (const importedId of importedIds) {
          if (!visited.has(importedId)) stack.push(importedId);
        }
      }
    }

    return vueFiles;
  }

  // 4. Run UnoCSS generator → componentClasses -----------------------------

  const { presets, shortcuts } = createAsBaseUnoConfig();
  const uno = await createGenerator({ presets, shortcuts });

  // Internals are typically shared across many entries; cache to avoid
  // re-reading the same file from disk per entry.
  const fileCache = new Map<string, string>();
  const readVue = (f: string) => {
    let s = fileCache.get(f);
    if (s === undefined) {
      s = fs.readFileSync(f, "utf8");
      fileCache.set(f, s);
    }
    return s;
  };

  const componentClasses: Record<string, string[]> = {};

  // UnoCSS's generator is stateful; concurrent generate() calls on the
  // same instance are not documented as safe. Keep sequential.
  for (const name of publicNames) {
    const entryId = entryIdMap.get(name);
    if (!entryId) {
      componentClasses[name] = [];
      continue;
    }
    const vueFiles = [...collectVueFiles(entryId)].toSorted(cmpEn);
    const code = vueFiles.map(readVue).join("\n");
    const { matched } = await uno.generate(code, { preflights: false });
    componentClasses[name] = [...matched].toSorted(cmpEn);
  }

  // 5. Helper-alias parsing (Decision 17) ----------------------------------

  const helperAliases: Record<string, string[]> = {};

  const HELPER_IMPORT_RE =
    /import\s*\{\s*([^}]+?)\s*\}\s*from\s*["']\.\.\/components\/defaults["'][;\s]/;
  const VUE_FILE_IMPORT_RE = /from\s*["'](?:\.\.?\/[^"']*)\.vue["']/;
  const PASCAL_AS_RE = /\bAs[A-Z]\w*/g;

  function deriveHelperName(filename: string): string {
    const base = path.basename(filename, ".ts");
    return base.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  for (const pkg of PKG_KEYS) {
    const helperFiles = globSync("src/composables/create-*.ts", {
      cwd: PKG_DIRS[pkg],
      absolute: true,
    }).toSorted(cmpEn);

    for (const file of helperFiles) {
      const rel = path.relative(REPO_PACKAGES, file);
      const violation = (msg: string) =>
        new Error(`[extract-classes] Decision 17 violation in ${rel}: ${msg}`);

      const src = fs.readFileSync(file, "utf8");
      const m = src.match(HELPER_IMPORT_RE);
      if (!m) {
        throw violation('missing canonical `import { ... } from "../components/defaults"` line.');
      }
      if (VUE_FILE_IMPORT_RE.test(src)) {
        throw violation(
          'helpers must import only from "../components/defaults", not from individual .vue files.',
        );
      }

      const importedIds = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.split(/\s+as\s+/)[0].trim())
        .filter((s) => /^As[A-Z]\w*$/.test(s));

      if (importedIds.length === 0) {
        throw violation("defaults import contains no As* identifiers.");
      }

      const importedSet = new Set(importedIds);
      // Sanity: every As* identifier referenced in the file body must appear
      // in the canonical import set.
      const bodyAfterImports = src.replace(HELPER_IMPORT_RE, "");
      const referenced = new Set(bodyAfterImports.match(PASCAL_AS_RE) ?? []);
      for (const ref of referenced) {
        if (!importedSet.has(ref)) {
          throw violation(
            `identifier "${ref}" is referenced but not in the canonical defaults import.`,
          );
        }
      }

      helperAliases[deriveHelperName(file)] = importedIds.map(kebabize).toSorted(cmpEn);
    }
  }

  // 6. Emit generated module ------------------------------------------------

  const lines: string[] = [];
  lines.push(
    "// GENERATED — DO NOT EDIT BY HAND.",
    "// Run `pnpm --filter @atscript/ui-styles run extract-classes` to regenerate.",
    "",
    "export const componentClasses: Record<string, readonly string[]> = {",
  );

  for (const name of Object.keys(componentClasses).toSorted(cmpEn)) {
    const list = componentClasses[name];
    if (list.length === 0) {
      lines.push(`  ${JSON.stringify(name)}: [],`);
    } else {
      lines.push(`  ${JSON.stringify(name)}: [`);
      for (const cls of list) lines.push(`    ${JSON.stringify(cls)},`);
      lines.push("  ],");
    }
  }

  lines.push("};", "");
  lines.push("export const helperAliases: Record<string, readonly string[]> = {");
  for (const name of Object.keys(helperAliases).toSorted(cmpEn)) {
    lines.push(`  ${JSON.stringify(name)}: [`);
    for (const cls of helperAliases[name]) lines.push(`    ${JSON.stringify(cls)},`);
    lines.push("  ],");
  }
  lines.push("};", "");

  const pkgUnion = PKG_KEYS.map((k) => JSON.stringify(k)).join(" | ");
  lines.push(`export const componentPackages: Record<string, ${pkgUnion}> = {`);
  for (const name of publicNames) {
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(entries[name].pkg)},`);
  }
  lines.push("};", "");

  // Tier 1 (user-tagged primaries) only — used by AsResolver to gate
  // auto-imports. Tier 2 swap-target defaults stay out: users import them
  // explicitly when composing custom defaults; the resolver doesn't
  // auto-magic implementation details.
  lines.push("export const primaryComponents: ReadonlySet<string> = new Set([");
  for (const name of publicNames) {
    if (entries[name].tier === "primary") {
      lines.push(`  ${JSON.stringify(name)},`);
    }
  }
  lines.push("]);", "");

  lines.push(
    "export function getComponentClasses(...names: string[]): string[] {",
    "  const set = new Set<string>();",
    "  for (const name of names) {",
    "    for (const cls of componentClasses[name] ?? []) set.add(cls);",
    "  }",
    "  return [...set];",
    "}",
    "",
    "export function getHelperClasses(...helpers: string[]): string[] {",
    "  return getComponentClasses(",
    "    ...helpers.flatMap((h) => helperAliases[h] ?? []),",
    "  );",
    "}",
    "",
  );

  const outDir = path.join(PKG_ROOT, "src", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "component-classes.ts");
  const content = lines.join("\n").replace(/\r\n/g, "\n");
  fs.writeFileSync(outFile, content, "utf8");

  // Run the workspace formatter so the file shape matches `vp fmt` output
  // exactly — keeps regenerations stable across runs even if the emitter's
  // whitespace drifts from the formatter's preferences.
  execFileSync("vp", ["fmt", path.relative(PKG_ROOT, outFile)], {
    cwd: PKG_ROOT,
    stdio: "inherit",
  });

  console.log(
    `[extract-classes] Wrote ${path.relative(PKG_ROOT, outFile)} — ${
      Object.keys(componentClasses).length
    } components, ${Object.keys(helperAliases).length} helpers.`,
  );

  for (const name of Object.keys(componentClasses).toSorted(cmpEn)) {
    console.log(`  ${name}: ${componentClasses[name].length} classes`);
  }
  for (const name of Object.keys(helperAliases).toSorted(cmpEn)) {
    console.log(`  helper ${name}: ${helperAliases[name].length} aliases`);
  }
}

await main();
