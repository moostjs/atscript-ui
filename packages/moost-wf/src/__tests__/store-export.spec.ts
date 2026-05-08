import { describe, expect, it } from "vite-plus/test";

import { setupTable } from "./helpers";

describe("./store barrel", () => {
  it("resolves the published `@atscript/moost-wf/store` subpath and round-trips a record", async () => {
    // Hits the package.json `./store` exports entry against `dist/store.mjs`.
    // Requires the package to be built — node's ESM resolver follows
    // package.json/exports → dist for workspace-resolved paths.
    const mod = await import("@atscript/moost-wf/store");
    expect(Object.keys(mod).toSorted()).toEqual(["AsWfStateRecord", "AsWfStore"]);

    const { table } = await setupTable();
    const store = new mod.AsWfStore({
      // biome-ignore lint/suspicious/noExplicitAny: subtype generic — store only touches base columns
      table: table as any,
    });
    await store.set("h-export", {
      schemaId: "Export",
      context: { ok: true },
      indexes: [0],
    } as never);
    const result = await store.get("h-export");
    expect(result?.state.schemaId).toBe("Export");
  });
});
