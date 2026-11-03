import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `@atscript/ui-table/csv` — the CSV writer on its own, for a server that
 * writes CSV without the table engine. Reads the build output: run the
 * package build first (workspace tests read `dist/`).
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  exports: Record<string, Record<string, string>>;
};
const csv = pkg.exports["./csv"] ?? {};
const file = (condition: string) => path.join(root, csv[condition] ?? `<no ${condition}>`);

describe("the ./csv subpath", () => {
  it("ships types, ESM and CJS builds that import nothing", () => {
    for (const condition of ["types", "import", "require"]) {
      expect(existsSync(file(condition)), `${condition} (run the build first)`).toBe(true);
      // No dependency is loaded with it.
      expect(readFileSync(file(condition), "utf8"), condition).not.toMatch(
        /\bfrom\s+["']|\brequire\(|\bimport\(/,
      );
    }
  });

  it("writes CSV from both module formats", async () => {
    const esm = (await import(pathToFileURL(file("import")).href)) as typeof import("./csv");
    const cjs = createRequire(import.meta.url)(file("require")) as typeof import("./csv");
    for (const { toCsv, csvCell } of [esm, cjs]) {
      expect(toCsv(["name", "total"], [["=SUM(A1)", -5]])).toBe("name,total\r\n'=SUM(A1),-5\r\n");
      expect(csvCell('a "b"')).toBe('"a ""b"""');
    }
  });
});
