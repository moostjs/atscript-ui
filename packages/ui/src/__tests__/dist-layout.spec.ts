import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The published `dist/` keeps one module per source module, so an app's
 * bundler pulls only what an import reaches. Reads the build output: run the
 * package build first (workspace tests read `dist/`).
 */
const dist = path.join(process.cwd(), "dist");

/** Every dist module `entry` reaches through relative imports. */
function reached(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(dist, file), "utf8");
    for (const [, spec] of source.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec!)));
    }
  };
  visit(entry);
  return seen;
}

describe("dist layout", () => {
  it("is built", () => {
    expect(existsSync(path.join(dist, "index.mjs")), "run the build first").toBe(true);
  });

  it("the entry only re-exports: each feature is its own module", () => {
    const entry = readFileSync(path.join(dist, "index.mjs"), "utf8");
    expect(entry).not.toMatch(/\bfunction\b/);
    expect(existsSync(path.join(dist, "form/error-utils.mjs"))).toBe(true);
  });

  it("the error-map helpers do not reach the form, table or value-help builders", () => {
    const modules = [...reached("form/error-utils.mjs")];
    expect(modules).toEqual(["form/error-utils.mjs"]);
    const formDef = [...reached("form/create-form-def.mjs")];
    expect(formDef.some((m) => m.startsWith("table/"))).toBe(false);
  });
});
