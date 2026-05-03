import { describe, expect, it } from "vite-plus/test";

import { setup } from "./helpers";

/**
 * Aspect column behaviour. The picker UI lists presets *without* loading
 * `data` (which can carry a heavy snapshot), and renders one icon per aspect
 * (columns / filters / filterOps / sorters / itemsPerPage) so the user sees
 * what an apply will affect.
 *
 * The controller stamps `aspects` on every preset write, derived from
 * `data.content` keys — clients cannot override this. UserConf rows never
 * carry aspects (they don't have `content`).
 */
describe("aspects column", () => {
  it("derives aspects from content keys on insert", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: {
        label: "P1",
        content: {
          columns: { columnNames: ["name"] },
          sorters: [{ field: "name", direction: "asc" }],
        },
      },
    })) as { aspects?: string[] };
    expect(out.aspects).toEqual(["columns", "sorters"]);
  });

  it("returns empty aspects when content is absent", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: { label: "label-only" },
    })) as { aspects?: string[] };
    expect(out.aspects).toEqual([]);
  });

  it("aspects render in canonical order regardless of input key order", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: {
        label: "scrambled",
        // Intentionally out of canonical order.
        content: {
          itemsPerPage: 50,
          sorters: [{ field: "x", direction: "asc" }],
          filters: ["x"],
          columns: { columnNames: ["x"] },
        },
      },
    })) as { aspects?: string[] };
    // Canonical order from PRESET_ASPECTS:
    //   columns, filters, filterOps, sorters, itemsPerPage
    expect(out.aspects).toEqual(["columns", "filters", "sorters", "itemsPerPage"]);
  });

  it("ignores client-supplied aspects — server is the source of truth", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      aspects: ["filterOps", "filters", "columns", "sorters", "itemsPerPage"], // bogus
      data: {
        label: "P",
        content: { sorters: [{ field: "x", direction: "asc" }] },
      },
    })) as { aspects?: string[] };
    expect(out.aspects).toEqual(["sorters"]);
  });

  it("re-derives aspects on update when content changes", async () => {
    const { table, ctrl } = await setup();
    const inserted = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: {
        label: "P",
        content: { columns: { columnNames: ["a"] } },
      },
    })) as { id: string; aspects?: string[] };
    expect(inserted.aspects).toEqual(["columns"]);
    await table.insertOne(inserted as never);

    const updated = (await ctrl.callOnWrite("update", {
      id: inserted.id,
      data: {
        label: "P",
        content: {
          columns: { columnNames: ["a"] },
          filters: ["a"],
          sorters: [{ field: "a", direction: "asc" }],
        },
      },
    })) as { aspects?: string[] };
    expect(updated.aspects).toEqual(["columns", "filters", "sorters"]);
  });

  it("rename-only update preserves content (and therefore aspects)", async () => {
    const { table, ctrl } = await setup();
    const inserted = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: {
        label: "before",
        content: {
          columns: { columnNames: ["a"] },
          sorters: [{ field: "a", direction: "asc" }],
        },
      },
    })) as { id: string; aspects?: string[] };
    await table.insertOne(inserted as never);

    // PATCH-like: client sends only the new label.
    const renamed = (await ctrl.callOnWrite("update", {
      id: inserted.id,
      data: { label: "after" },
    })) as {
      aspects?: string[];
      data?: { label: string; content?: { columns?: unknown; sorters?: unknown } };
    };
    expect(renamed.data?.label).toBe("after");
    // Content survives the merge.
    expect(renamed.data?.content?.columns).toBeDefined();
    expect(renamed.data?.content?.sorters).toBeDefined();
    expect(renamed.aspects).toEqual(["columns", "sorters"]);
  });

  it("userConf rows never carry aspects", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      aspects: ["columns"], // bogus client input
      data: { defaultPresetId: "sys:standard" },
    })) as { aspects?: string[] };
    expect(out.aspects).toBeUndefined();
  });

  it("picker can read aspects from row without parsing the data blob", async () => {
    const { table, ctrl } = await setup();

    // Seed three presets with different aspect mixes (all owned by bob,
    // so the read gate returns them without further setup).
    for (const seed of [
      {
        label: "Cols only",
        content: { columns: { columnNames: ["name"] } },
      },
      {
        label: "Sort + filterOps",
        content: {
          sorters: [{ field: "name", direction: "asc" }],
          filterOps: [{ field: "name", conditions: [{ type: "contains", value: ["x"] }] }],
        },
      },
      { label: "Empty" },
    ]) {
      const data: Record<string, unknown> = { label: seed.label };
      if ((seed as { content?: unknown }).content !== undefined) {
        data.content = (seed as { content: unknown }).content;
      }
      const built = await ctrl.callOnWrite("insert", {
        type: "preset",
        app: "demo",
        tableKey: "products",
        data,
      });
      await table.insertOne(built as never);
    }

    // Picker fetches the list and reads `aspects` from each row directly —
    // no need to walk into `data.content` to figure out which icons to show.
    const rows = (await table.findMany({
      filter: { type: "preset", app: "demo", tableKey: "products" },
    })) as Array<{ aspects?: string[]; data: { label: string } }>;

    const byLabel = new Map(rows.map((r) => [r.data.label, r.aspects ?? []]));
    expect(byLabel.get("Cols only")).toEqual(["columns"]);
    expect(byLabel.get("Sort + filterOps")).toEqual(["filterOps", "sorters"]);
    expect(byLabel.get("Empty")).toEqual([]);
  });
});
