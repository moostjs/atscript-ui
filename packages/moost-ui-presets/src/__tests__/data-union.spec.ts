import { describe, expect, it } from "vite-plus/test";

import { createSpace, setup } from "./helpers";

/**
 * The schema models `data` as a discriminated-by-shape union:
 *   - preset branch:   `{ label: string; content?: PresetSnapshotWire }`
 *   - userConf branch: `{ defaultPresetId?: string; favPresetIds?: string[] }`
 *
 * The engine validator picks the matching branch on each write — sending
 * a field that belongs to the OTHER branch is rejected. Inside the preset
 * branch, `content` is structurally validated all the way down: column
 * widths shape, filter operator names, value-array primitive types, sort
 * direction enum.
 */
describe("data union — per-branch + deep snapshot validation", () => {
  it("rejects a preset row whose data carries userConf-only fields", async () => {
    const { table } = await createSpace();
    await expect(
      table.insertOne({
        id: "row-p1",
        type: "preset",
        app: "demo",
        tableKey: "products",
        user: "bob",
        data: { label: "ok", defaultPresetId: "preset-x" } as never,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a userConf row whose data carries preset-only fields", async () => {
    const { table } = await createSpace();
    await expect(
      table.insertOne({
        id: "uc:bob:demo:products",
        type: "userConf",
        app: "demo",
        tableKey: "products",
        user: "bob",
        data: { defaultPresetId: "preset-x", label: "leak" } as never,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("accepts a preset row with the canonical wire-shape snapshot", async () => {
    const { table } = await createSpace();
    await table.insertOne({
      id: "row-p1",
      type: "preset",
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: {
        label: "fine",
        content: {
          columns: {
            columnNames: ["name", "sku"],
            columnWidths: [{ field: "name", width: "200px" }],
          },
          filters: ["name"],
          filterOps: [
            {
              field: "name",
              conditions: [{ type: "contains", value: ["acme"] }],
            },
          ],
          sorters: [{ field: "sku", direction: "asc" }],
          itemsPerPage: 50,
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const back = await table.findOne({ filter: { id: "row-p1" } });
    expect(back).toBeTruthy();
  });

  it.each([
    [
      "an unknown filter operator",
      "row-p2",
      "bad-op",
      { filterOps: [{ field: "name", conditions: [{ type: "fuzzy", value: ["x"] }] }] },
    ],
    [
      "an invalid sort direction",
      "row-p3",
      "bad-sort",
      { sorters: [{ field: "name", direction: "sideways" }] },
    ],
    [
      "a non-primitive filter value (object inside value array)",
      "row-p4",
      "bad-value",
      { filterOps: [{ field: "name", conditions: [{ type: "eq", value: [{ nested: "x" }] }] }] },
    ],
  ])("rejects %s", async (_name, id, label, content) => {
    const { table } = await createSpace();
    await expect(
      table.insertOne({
        id,
        type: "preset",
        app: "demo",
        tableKey: "products",
        user: "bob",
        data: { label, content: content as never },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("accepts a userConf row with the canonical userConf-branch shape", async () => {
    const { ctrl } = await setup();
    await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: "sys:standard", favPresetIds: ["preset-a", "preset-b"] },
    });
  });
});
