import { describe, expect, it } from "vite-plus/test";

import { setup } from "./helpers";

describe("identity-and-stamp", () => {
  it("overwrites client-supplied user on insert", async () => {
    const { ctrl } = await setup();

    const result = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      user: "alice", // attempted impersonation
      data: { label: "Bob's preset" },
    })) as { user: string };

    expect(result.user).toBe("bob");
  });

  it("stamps updatedAt on every write", async () => {
    const { table, ctrl } = await setup();

    const t0 = Date.now() - 1; // tolerate 1ms granularity
    const inserted = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: { label: "P" },
      updatedAt: 1, // a sent value is overwritten on insert
    })) as { updatedAt: number; createdAt: number; id: string };

    expect(inserted.createdAt).toBeGreaterThanOrEqual(t0);
    expect(inserted.updatedAt).toBe(inserted.createdAt);

    // Persist + then update — the db (`number.timestamp.updated`) sets
    // updatedAt, ignoring a sent value.
    await table.insertOne(inserted as never);
    await new Promise((r) => setTimeout(r, 2));
    const patch = await ctrl.callOnWrite("update", {
      id: inserted.id,
      data: { label: "P (renamed)" },
      updatedAt: 1,
    });
    await table.updateOne(patch as never);

    const stored = (await table.findOne({ filter: { id: inserted.id } })) as { updatedAt: number };
    expect(stored.updatedAt).toBeGreaterThan(inserted.updatedAt);
  });

  it("auto-generates an id for type='preset' insert when client omits it", async () => {
    const { ctrl } = await setup();

    const result = (await ctrl.callOnWrite("insert", {
      type: "preset",
      app: "demo",
      tableKey: "products",
      data: { label: "auto-id" },
    })) as { id: string };

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.id.startsWith("sys:")).toBe(false);
  });
});
