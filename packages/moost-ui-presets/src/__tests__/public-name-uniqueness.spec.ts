import { describe, expect, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, setup } from "./helpers";

describe("public preset name uniqueness", () => {
  it("rejects a second public preset with the same label in the same (app, tableKey)", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Q1 report" },
    });

    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("insert", {
          type: "preset",
          app: "demo",
          tableKey: "products",
          public: true,
          data: { label: "Q1 report" },
        }),
      409,
      "public_name_conflict",
    );
  });

  it("allows the same label across different tableKey scopes", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Q1 report" },
    });

    // Should not throw — different tableKey.
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "orders",
      public: true,
      data: { label: "Q1 report" },
    });
  });

  it("allows the same label across different apps", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "app-a",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Shared" },
    });

    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "app-b",
      tableKey: "products",
      public: true,
      data: { label: "Shared" },
    });
  });

  it("does not constrain private presets — same label OK while one or both are private", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "Working set" },
    });

    // Private + private — fine.
    await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: false,
      data: { label: "Working set" },
    });
  });

  it("re-checks uniqueness on rename-while-public", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Q1 report" },
    });
    const myRow = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Working draft" },
    });

    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id: myRow, data: { label: "Q1 report" } }),
      409,
      "public_name_conflict",
    );
  });

  it("update keeping its own public label does not falsely conflict against itself", async () => {
    const { table, ctrl } = await setup("alice");

    const a = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Foo" },
    });

    // The uniqueness scan must honour `excludingId` so a row's own label
    // doesn't conflict with itself on a no-op rename.
    await ctrl.callOnWrite("update", { id: a, data: { label: "Foo" } });
  });

  // The composite unique index over `(app, tableKey, publicLabel)` is the
  // race-safety backstop for `assertPublicLabelFree`'s read-then-write window.
  // Insert a row directly (bypassing the controller's pre-check) and confirm
  // the DB rejects the duplicate.
  it("DB unique index catches a public-label collision that bypasses the pre-check", async () => {
    const { table } = await setup("alice");
    await table.insertOne({
      id: "preset-1",
      type: "preset",
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      label: "Q1 report",
      publicLabel: "Q1 report",
      data: { label: "Q1 report" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    let err: unknown;
    try {
      await table.insertOne({
        id: "preset-2",
        type: "preset",
        app: "demo",
        tableKey: "products",
        user: "bob",
        public: true,
        label: "Q1 report",
        publicLabel: "Q1 report",
        data: { label: "Q1 report" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect((err as { code?: string }).code).toBe("CONFLICT");
  });

  it("transitions public→private release the public-name slot", async () => {
    const { table, ctrl } = await setup("alice");
    const inserted = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: true,
      data: { label: "Reusable" },
    })) as { id: string; publicLabel?: string };
    expect(inserted.publicLabel).toBe("Reusable");
    await table.insertOne(inserted as never);

    const flipped = (await ctrl.callOnWrite("update", {
      id: inserted.id,
      public: false,
    })) as { id: string; publicLabel?: string };
    expect(flipped.publicLabel).toBeUndefined();
    await table.updateOne(flipped as never);

    // The DB-level slot is now free — a different user can claim "Reusable"
    // as a public label without colliding with the now-private row.
    ctrl.setCurrentUser("bob");
    const reused = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: true,
      data: { label: "Reusable" },
    })) as { publicLabel?: string };
    expect(reused.publicLabel).toBe("Reusable");
    await table.insertOne(reused as never);
  });

  it("re-checks uniqueness on togglePublic-to-true", async () => {
    const { table, ctrl } = await setup("alice");

    await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Already public" },
    });
    const draftId = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "Already public" },
    });

    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id: draftId, public: true }),
      409,
      "public_name_conflict",
    );
  });
});
