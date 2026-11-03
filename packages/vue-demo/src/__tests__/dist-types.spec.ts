// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { prepareFixtures } from "@atscript/typescript/test-utils";
import { describe, expect, it } from "vite-plus/test";

/**
 * The published declarations, read the way an app reads them. Both checks
 * read the build output: run the package builds first (workspace tests read
 * `dist/`).
 */
const packagesDir = path.resolve(process.cwd(), "..");
// Every package folder that is not `private`, so a new package is covered too.
const published = readdirSync(packagesDir).filter((dir) => {
  const manifest = path.join(packagesDir, dir, "package.json");
  return existsSync(manifest) && !JSON.parse(readFileSync(manifest, "utf8")).private;
});

function declarationFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.d\.(m|c)?ts$/.test(file))
    .map((file) => path.join(dir, file));
}

describe("published declarations", () => {
  it.each(published)("%s imports third-party types instead of inlining a copy", (pkg) => {
    const dist = path.join(packagesDir, pkg, "dist");
    expect(existsSync(dist), `build ${pkg} first`).toBe(true);
    const files = declarationFiles(dist);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const where = path.relative(packagesDir, file);
      // The bundler marks a module copied in from a dependency with its path.
      expect(source, where).not.toMatch(/\/\/#region [^\n]*node_modules/);
      // A private copy of the atscript types is incompatible with the app's
      // generated types (`Validator` has private members, so it is nominal).
      expect(source, where).not.toMatch(
        /\b(interface|type|class) (TAtscriptAnnotatedType|TAtscriptTypeDef|TAtscriptTypeObject|TMetadataMap|Validator)\b/,
      );
    }
  });

  it("an app type-checks against the built packages", async () => {
    const fixtures = path.join(process.cwd(), "dist-types");
    await prepareFixtures({ rootDir: fixtures, formats: ["dts"] });
    const require = createRequire(import.meta.url);
    const vueTsc = path.join(
      path.dirname(require.resolve("vue-tsc/package.json")),
      "bin/vue-tsc.js",
    );
    const run = spawnSync(process.execPath, [vueTsc, "-p", path.join(fixtures, "tsconfig.json")], {
      encoding: "utf8",
    });
    expect(run.stdout + run.stderr).toBe("");
    expect(run.status).toBe(0);
  }, 60_000);
});
