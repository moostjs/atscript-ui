import { describe, expect, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, setup } from "./helpers";

/**
 * Publish permission gate. `canPublishPresets(app, tableKey, user)` defaults
 * to `true` (any authenticated user can publish), but can be overridden to
 * scope publishing per role / app / table. Enforced by the write path AND
 * surfaced via `GET /capabilities` so the picker UI can hide "Save as
 * public" before the user even submits.
 *
 * Mirroring the per-user cap, already-public rows are grandfathered when
 * permission is later revoked — only the transition private→public is gated.
 */
describe("publish permission", () => {
  it("default policy allows any user to create a public preset", async () => {
    const { ctrl } = await setup("alice");
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: true,
      data: { label: "shared" },
    });
  });

  it("rejects creating a public preset when canPublishPresets returns false", async () => {
    const { ctrl } = await setup("viewer", { canPublishResolver: async () => false });
    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          public: true,
          data: { label: "shared" },
        }),
      403,
      "publish_forbidden",
    );
  });

  it("still permits private preset creation when canPublishPresets returns false", async () => {
    const { ctrl } = await setup("viewer", { canPublishResolver: async () => false });
    // Only the `public` flag is gated — private presets are unaffected.
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: false,
      data: { label: "private" },
    });
  });

  it("rejects toggling private→public when canPublishPresets returns false", async () => {
    const { table, ctrl } = await setup("alice", { canPublishResolver: async () => false });
    const id = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "draft" },
    });
    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id, public: true }),
      403,
      "publish_forbidden",
    );
  });

  it("grandfathers already-public rows — updating an existing public preset still works after permission is revoked", async () => {
    const { table, ctrl } = await setup("alice", { canPublishResolver: async () => false });
    const id = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Already shared" },
    });
    // Renaming an already-public preset must NOT trip the publish gate —
    // permission is checked only at the private→public transition.
    await ctrl.callOnWrite("update", {
      id,
      data: { label: "Already shared (v2)" },
    });
  });

  it("calls canPublishPresets with (app, tableKey, user) so policies can scope per resource", async () => {
    const calls: { app: string; tableKey: string; user: string }[] = [];
    const { ctrl } = await setup("alice", {
      canPublishResolver: async (app, tableKey, user) => {
        calls.push({ app, tableKey, user });
        return tableKey === "products"; // can publish on products, not orders
      },
    });
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: true,
      data: { label: "ok" },
    });
    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "orders",
          public: true,
          data: { label: "blocked" },
        }),
      403,
      "publish_forbidden",
    );
    expect(calls).toEqual([
      { app: "demo", tableKey: "products", user: "alice" },
      { app: "demo", tableKey: "orders", user: "alice" },
    ]);
  });
});

describe("GET /capabilities", () => {
  it("returns canPublish=true and the configured limit for the default policy", async () => {
    const { ctrl } = await setup("alice", { maxPresetsPerUser: 7 });
    const caps = await ctrl.callCapabilities("demo", "products");
    expect(caps).toEqual({ canPublish: true, presetLimit: 7, userId: "alice" });
  });

  it("reflects canPublishPresets policy per (app, tableKey, user)", async () => {
    const { ctrl } = await setup("viewer", {
      canPublishResolver: async (_app, tableKey, _user) => tableKey === "products",
    });
    const onProducts = await ctrl.callCapabilities("demo", "products");
    const onOrders = await ctrl.callCapabilities("demo", "orders");
    expect(onProducts.canPublish).toBe(true);
    expect(onOrders.canPublish).toBe(false);
  });

  it("reflects tiered presetLimit from getMaxPresetsPerUser", async () => {
    const { ctrl } = await setup("admin", {
      maxPresetsResolver: async (_app, _tableKey, user) => (user === "admin" ? 100 : 5),
    });
    const caps = await ctrl.callCapabilities("demo", "products");
    expect(caps.presetLimit).toBe(100);
  });

  it("rejects with 400 missing_scope when 'app' is absent", async () => {
    const { ctrl } = await setup("alice");
    await expectHttpRejection(
      () => ctrl.callCapabilities(undefined, "products"),
      400,
      "missing_scope",
    );
  });

  it("rejects with 400 missing_scope when 'tableKey' is absent", async () => {
    const { ctrl } = await setup("alice");
    await expectHttpRejection(() => ctrl.callCapabilities("demo", undefined), 400, "missing_scope");
  });
});
