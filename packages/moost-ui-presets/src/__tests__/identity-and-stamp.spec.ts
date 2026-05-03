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
    })) as { updatedAt: number; createdAt: number; id: string };

    expect(inserted.createdAt).toBeGreaterThanOrEqual(t0);
    expect(inserted.updatedAt).toBeGreaterThanOrEqual(t0);

    // Persist + then update — updatedAt should advance.
    await table.insertOne(inserted as never);

    const updated = (await ctrl.callOnWrite("update", {
      id: inserted.id,
      data: { label: "P (renamed)" },
    })) as { updatedAt: number };

    expect(updated.updatedAt).toBeGreaterThanOrEqual(inserted.updatedAt);
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
