import { describe, expect, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, setup } from "./helpers";

async function fillUpToLimit(
  table: Awaited<ReturnType<typeof setup>>["table"],
  user: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user,
      data: { label: `seed-${i}` },
    });
  }
}

describe("per-user preset cap", () => {
  it("11th create returns 409 with structured body when default cap (10) reached", async () => {
    const { table, ctrl } = await setup();
    await fillUpToLimit(table, "bob", 10);

    const err = await expectHttpRejection<{ limit: number; count: number }>(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          data: { label: "the-one-too-many" },
        }),
      409,
      "preset_limit_reached",
    );
    expect(err.body.limit).toBe(10);
    expect(err.body.count).toBe(10);
  });

  it("honors a static maxPresetsPerUser override", async () => {
    const { table, ctrl } = await setup("bob", { maxPresetsPerUser: 3 });

    await fillUpToLimit(table, "bob", 3);

    const err = await expectHttpRejection<{ limit: number }>(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          data: { label: "fourth" },
        }),
      409,
      "preset_limit_reached",
    );
    expect(err.body.limit).toBe(3);
  });

  it("honors an async getMaxPresetsPerUser override", async () => {
    const { ctrl, table } = await setup("admin", {
      maxPresetsResolver: async (_app, _tableKey, user) => (user === "admin" ? 100 : 5),
    });
    await fillUpToLimit(table, "admin", 50);

    // 51st should still pass (admin tier).
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: { label: "still room" },
    });
  });

  it("grandfathers existing rows when cap is lowered — they stay readable, only new creates blocked", async () => {
    const { table, ctrl } = await setup("bob", { maxPresetsPerUser: 3 });
    await fillUpToLimit(table, "bob", 5);

    const err = await expectHttpRejection<{ count: number }>(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          data: { label: "blocked" },
        }),
      409,
      "preset_limit_reached",
    );
    expect(err.body.count).toBe(5);
  });

  it("blocks 'insertMany' as unsupported (picker writes one row at a time)", async () => {
    const { table, ctrl } = await setup("bob", { maxPresetsPerUser: 3 });
    await fillUpToLimit(table, "bob", 2);

    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("insertMany", [
          { type: "preset", app: "demo", tableKey: "products", data: { label: "a" } },
          { type: "preset", app: "demo", tableKey: "products", data: { label: "b" } },
          { type: "preset", app: "demo", tableKey: "products", data: { label: "c" } },
        ]),
      405,
      "action_unsupported",
    );
  });

  it("only counts owned preset rows in the same (app, tableKey)", async () => {
    const { table, ctrl } = await setup("bob", { maxPresetsPerUser: 2 });

    // Bob has 2 in scope-A — at the cap.
    await fillUpToLimit(table, "bob", 2);
    // Bob has 1 in scope-B — well under the cap there.
    await seedPreset(table, {
      app: "demo",
      tableKey: "orders",
      user: "bob",
      data: { label: "b-0" },
    });
    // Alice has many in scope-A — irrelevant (different owner).
    for (let i = 0; i < 5; i++) {
      await seedPreset(table, {
        app: "demo",
        tableKey: "products",
        user: "alice",
        data: { label: `a-${i}` },
      });
    }

    // Bob inserting another in scope-B succeeds (different scope).
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "orders",
      data: { label: "scope-B is fine" },
    });

    // Bob inserting another in scope-A blocked (his own cap).
    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          data: { label: "blocked" },
        }),
      409,
      "preset_limit_reached",
    );
  });
});
