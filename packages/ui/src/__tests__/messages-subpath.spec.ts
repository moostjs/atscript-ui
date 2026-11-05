import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `@atscript/ui/messages` — the text catalog on its own, for a server that
 * registers it (`registerMessages(AS_UI_MESSAGES)`) without the UI runtime,
 * Vue or a DOM. Reads the build output: run the package build first.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  exports: Record<string, Record<string, string>>;
};
const entry = pkg.exports["./messages"] ?? {};
const file = (condition: string) => path.join(root, entry[condition] ?? `<no ${condition}>`);
/** The file's code without its comments (the doc example shows imports). */
const code = (condition: string) =>
  readFileSync(file(condition), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("the ./messages subpath", () => {
  it("ships types, ESM and CJS builds that import nothing", () => {
    for (const condition of ["types", "import", "require"]) {
      expect(existsSync(file(condition)), `${condition} (run the build first)`).toBe(true);
      expect(code(condition), condition).not.toMatch(/\bfrom\s+["']|\brequire\(|\bimport\(/);
    }
  });

  it("loads in Node without a DOM, from both module formats", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
    const esm = (await import(pathToFileURL(file("import")).href)) as typeof import("../messages");
    const cjs = createRequire(import.meta.url)(file("require")) as typeof import("../messages");
    for (const { AS_UI_MESSAGES } of [esm, cjs]) {
      expect(AS_UI_MESSAGES.UI_CANCEL).toBe("Cancel");
      expect(AS_UI_MESSAGES.UI_FORM_ADD).toBe("Add {item}");
      expect(Object.isFrozen(AS_UI_MESSAGES)).toBe(true);
    }
  });
});
