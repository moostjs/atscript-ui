import { describe, expect, it } from "vite-plus/test";

// Relative import — proves the in-package barrel works.
import { AsWfStateRecord, AsWfStore } from "../store";
// Type-only import — proves the type re-export compiles.
import type { JsonValue } from "../store";

import { setupTable } from "./helpers";

describe("./store barrel", () => {
  it("re-exports the AsWfStore class with a usable constructor", async () => {
    const { table } = await setupTable();
    const store = new AsWfStore({
      // biome-ignore lint/suspicious/noExplicitAny: subtype generic — store only touches base columns
      table: table as any,
    });
    expect(store).toBeInstanceOf(AsWfStore);
    // Smoke-test the runtime: round-trip a single record through set → get.
    await store.set("h-export", {
      schemaId: "Export",
      context: { ok: true },
      indexes: [0],
    } as never);
    const result = await store.get("h-export");
    expect(result?.state.schemaId).toBe("Export");
  });

  it("re-exports the AsWfStateRecord class with intact atscript metadata", () => {
    expect(AsWfStateRecord).toBeTypeOf("function");
    // biome-ignore lint/suspicious/noExplicitAny: runtime metadata access for sanity check
    const meta = (AsWfStateRecord as any).metadata;
    expect(meta).toBeInstanceOf(Map);
    // biome-ignore lint/suspicious/noExplicitAny: runtime atscript marker
    expect((AsWfStateRecord as any).__is_atscript_annotated_type).toBe(true);
  });

  it("type-only re-exports compile (JsonValue)", () => {
    // Type-level smoke — assignability proves `JsonValue` is a valid type.
    const value: JsonValue = { a: 1, b: [true, null, "x"] };
    expect(value).toBeTruthy();
  });

  it("resolves the published `@atscript/moost-wf/store` subpath at runtime", async () => {
    // Hits the package.json `./store` exports entry against `dist/store.mjs`.
    // Requires the package to be built — tests run with workspace-resolved
    // paths, so node's ESM resolver follows package.json/exports → dist.
    const mod = await import("@atscript/moost-wf/store");
    expect(mod.AsWfStore).toBeTypeOf("function");
    expect(mod.AsWfStateRecord).toBeTypeOf("function");
    expect(Object.keys(mod).toSorted()).toEqual(["AsWfStateRecord", "AsWfStore"]);
  });
});
