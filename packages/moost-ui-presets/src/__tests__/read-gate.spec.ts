import { describe, expect, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, seedUserConf, setup } from "./helpers";

/**
 * Security-critical specs. The read gate is the multi-tenant boundary: a
 * crafted client filter must NEVER widen visibility, only narrow it. Every
 * read goes through `transformFilter`, which AND-merges
 * `(user = currentUser OR (type='preset' AND public=true))` with the
 * client filter and then reads from the underlying table.
 */
describe("read-gate", () => {
  it("rejects reads that don't supply both app and tableKey", async () => {
    const { ctrl } = await setup();

    for (const filter of [{ app: "demo" }, { tableKey: "products" }, {}]) {
      await expectHttpRejection(
        () => ctrl.callTransformFilter(filter as never),
        400,
        "missing_scope",
      );
    }
  });

  it("accepts scope inside one level of $and", async () => {
    const { ctrl } = await setup();
    const out = await ctrl.callTransformFilter({
      $and: [{ app: "demo" }, { tableKey: "products" }],
    } as never);
    expect(out).toMatchObject({ $and: expect.any(Array) });
  });

  it("accepts appConf reads with only 'app' (no tableKey required)", async () => {
    const { ctrl } = await setup();
    // No tableKey — but pinning type='appConf' relaxes the rule.
    const out = await ctrl.callTransformFilter({
      app: "demo",
      type: "appConf",
    } as never);
    expect(out).toMatchObject({ $and: expect.any(Array) });
  });

  it("rejects appConf reads that omit 'app'", async () => {
    const { ctrl } = await setup();
    await expectHttpRejection(
      () => ctrl.callTransformFilter({ type: "appConf" } as never),
      400,
      "missing_scope",
    );
  });

  it("still requires tableKey for non-appConf reads (preset / userConf)", async () => {
    const { ctrl } = await setup();
    await expectHttpRejection(
      () => ctrl.callTransformFilter({ app: "demo", type: "userConf" } as never),
      400,
      "missing_scope",
    );
  });

  it("AND-merges the gate so a crafted user-impersonation filter does NOT widen visibility", async () => {
    const { space, table, ctrl } = await setup();

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: { label: "Bob private" },
    });
    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "Alice private" },
    });
    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Alice public Q1" },
    });
    await seedUserConf(table, "bob", "demo", "products", { defaultPresetId: "preset-x" });
    await seedUserConf(table, "alice", "demo", "products", { defaultPresetId: "preset-y" });

    // Bob crafts a filter that asks "show me Alice's rows".
    const crafted = await ctrl.callTransformFilter({
      $and: [{ app: "demo" }, { tableKey: "products" }, { user: "alice" }],
    } as never);

    const rows = await table.findMany({ filter: crafted } as never);
    // Expectation: bob sees Alice's PUBLIC preset AND nothing else (his own
    // rows excluded by `user='alice'`, alice's private excluded by gate).
    expect(rows).toHaveLength(1);
    expect((rows[0] as { user: string }).user).toBe("alice");
    expect((rows[0] as { public?: boolean }).public).toBe(true);

    void space;
  });

  it("returns owned rows + public presets across all owners when no user constraint", async () => {
    const { space, table, ctrl } = await setup();

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: { label: "Bob's view" },
    });
    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "Alice private" },
    });
    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Alice public" },
    });
    await seedUserConf(table, "bob", "demo", "products", { defaultPresetId: "preset-x" });
    await seedUserConf(table, "alice", "demo", "products", {});

    const filter = await ctrl.callTransformFilter({
      app: "demo",
      tableKey: "products",
    } as never);
    const rows = await table.findMany({ filter } as never);

    // Bob sees: his own preset, his own userConf, alice's public preset.
    // Bob does NOT see: alice's private preset, alice's userConf.
    const labels = rows.map((r) => (r as { user: string }).user).toSorted();
    expect(labels).toEqual(["alice", "bob", "bob"]);

    void space;
  });

  it("scopes to (app, tableKey) — does not bleed across apps or tables", async () => {
    const { space, table, ctrl } = await setup();

    await seedPreset(table, {
      app: "app-a",
      tableKey: "products",
      user: "bob",
      data: { label: "A.products" },
    });
    await seedPreset(table, {
      app: "app-b",
      tableKey: "products",
      user: "bob",
      data: { label: "B.products" },
    });
    await seedPreset(table, {
      app: "app-a",
      tableKey: "orders",
      user: "bob",
      data: { label: "A.orders" },
    });

    const filter = await ctrl.callTransformFilter({
      app: "app-a",
      tableKey: "products",
    } as never);
    const rows = await table.findMany({ filter } as never);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { data: { label: string } }).data.label).toBe("A.products");

    void space;
  });
});
