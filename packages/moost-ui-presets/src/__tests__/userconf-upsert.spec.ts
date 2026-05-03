import { describe, expect, it } from "vite-plus/test";

import { seedPreset, seedUserConf, setup } from "./helpers";

describe("userConf upsert", () => {
  it("forces id = uc:${user}:${app}:${tableKey} regardless of client-supplied id", async () => {
    const { ctrl } = await setup();

    const out = (await ctrl.callOnWrite("insert", {
      id: "client-supplied-bogus-id",
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: "preset-x" },
    })) as { id: string; user: string };

    expect(out.id).toBe("uc:bob:demo:products");
    expect(out.user).toBe("bob");
  });

  it("silently drops data.defaultPresetId when it references an unreadable preset", async () => {
    const { table, ctrl } = await setup();

    // Seed Alice's PRIVATE preset — bob can't read it.
    const alicePrivate = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: false,
      data: { label: "Alice's" },
    });

    const out = (await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: alicePrivate, favPresetIds: ["preset-a", "preset-b"] },
    })) as { data: { defaultPresetId?: string; favPresetIds?: string[] } };

    expect(out.data.defaultPresetId).toBeUndefined();
    // favPresetIds is opaque — the controller doesn't validate it.
    expect(out.data.favPresetIds).toEqual(["preset-a", "preset-b"]);
  });

  it("preserves data.defaultPresetId when it references the user's own preset", async () => {
    const { table, ctrl } = await setup();

    const myRow = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: { label: "Mine" },
    });

    const out = (await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: myRow },
    })) as { data: { defaultPresetId?: string } };

    expect(out.data.defaultPresetId).toBe(myRow);
  });

  it("preserves data.defaultPresetId when it references a public preset by another user", async () => {
    const { table, ctrl } = await setup();

    const alicePublic = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      public: true,
      data: { label: "Alice public" },
    });

    const out = (await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: alicePublic },
    })) as { data: { defaultPresetId?: string } };

    expect(out.data.defaultPresetId).toBe(alicePublic);
  });

  it("preserves a 'sys:*' defaultPresetId without server-side resolution (Phase 2 owns it)", async () => {
    const { ctrl } = await setup();

    const out = (await ctrl.callOnWrite("insert", {
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: "sys:standard" },
    })) as { data: { defaultPresetId?: string } };

    expect(out.data.defaultPresetId).toBe("sys:standard");
  });

  it("second upsert from same user updates the same row at the deterministic id", async () => {
    const { table, ctrl } = await setup();

    await seedUserConf(table, "bob", "demo", "products", { defaultPresetId: "sys:standard" });

    const out = (await ctrl.callOnWrite("update", {
      id: "uc:bob:demo:products",
      data: { defaultPresetId: "sys:monitoring" },
    })) as { id: string; data: { defaultPresetId?: string } };

    expect(out.id).toBe("uc:bob:demo:products");
    expect(out.data.defaultPresetId).toBe("sys:monitoring");
  });

  // Top-level `public` is a preset-only column (drives `preset_public_idx`).
  // userConf/appConf rows must never carry it — otherwise a malicious client
  // could leak `public: true` into the index and skew picker queries.
  it("strips client-supplied `public` on userConf update", async () => {
    const { table, ctrl } = await setup();
    await seedUserConf(table, "bob", "demo", "products", { defaultPresetId: "sys:standard" });

    const out = (await ctrl.callOnWrite("update", {
      id: "uc:bob:demo:products",
      public: true,
      data: { defaultPresetId: "sys:monitoring" },
    })) as { public?: boolean };

    expect(out.public).toBeUndefined();
  });

  it("strips client-supplied `public` on appConf update", async () => {
    const { table, ctrl } = await setup();
    const inserted = (await ctrl.callOnWrite("insert", {
      type: "appConf",
      app: "demo",
      data: { appearance: "dark" },
    })) as { id: string };
    await table.insertOne(inserted as never);

    const out = (await ctrl.callOnWrite("update", {
      id: inserted.id,
      public: true,
      data: { appearance: "light" },
    })) as { public?: boolean };

    expect(out.public).toBeUndefined();
  });
});
