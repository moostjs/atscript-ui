import { describe, expect, it } from "vite-plus/test";

import { createSpace, setup } from "./helpers";

/**
 * Coverage for the `appConf` branch — app-wide user prefs stored once per
 * `(user, app)` rather than duplicated per-table.
 *
 *   - all fields optional — partial upserts are normal
 *   - `appearance` / `density` / `dateFormat` / `firstDayOfWeek` are enums
 *     (engine rejects out-of-set values)
 *   - `language` capped at 5 chars (`@expect.maxLength 5`)
 *   - `timezone` capped at 64 chars (`@expect.maxLength 64`)
 *   - `customJson` capped at 1024 chars (`@expect.maxLength 1024`)
 *
 * `appConf` rows have id `${user}:${app}` (no tableKey) and the controller
 * forces `tableKey` out of the row on every write.
 */
describe("appConf branch — app-wide user prefs", () => {
  it("accepts an entirely empty appConf data object (all fields optional)", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "appConf",
      app: "demo",
      data: {},
    })) as { id: string; tableKey?: string };
    expect(out.id).toBe("ac:bob:demo");
    expect(out.tableKey).toBeUndefined();
  });

  it("accepts the full canonical appConf shape", async () => {
    const { table } = await createSpace();
    await table.insertOne({
      id: "ac:bob:demo",
      type: "appConf",
      app: "demo",
      user: "bob",
      data: {
        appearance: "dark",
        language: "en-US",
        timezone: "America/New_York",
        density: "compact",
        dateFormat: "iso",
        firstDayOfWeek: 1,
        customJson: '{"sidebar":"collapsed"}',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const back = (await table.findOne({ filter: { id: "ac:bob:demo" } })) as {
      data: { appearance: string; firstDayOfWeek: number };
    } | null;
    expect(back?.data.appearance).toBe("dark");
    expect(back?.data.firstDayOfWeek).toBe(1);
  });

  it("forces tableKey absent on appConf insert even if client supplies one", async () => {
    const { ctrl } = await setup();
    const out = (await ctrl.callOnWrite("insert", {
      type: "appConf",
      app: "demo",
      tableKey: "products", // bogus — should be ignored
      data: { appearance: "dark" },
    })) as { id: string; tableKey?: string };
    expect(out.id).toBe("ac:bob:demo");
    expect(out.tableKey).toBeUndefined();
  });

  it.each([
    ["an invalid appearance value", { appearance: "hot-pink" }],
    ["an invalid density value", { density: "tight" }],
    ["an invalid firstDayOfWeek (3 — only 0/1/6 allowed)", { firstDayOfWeek: 3 }],
    ["a language tag longer than 5 chars", { language: "en-US-x-long" }],
    ["a timezone string longer than 64 chars", { timezone: "A".repeat(65) }],
    ["a customJson blob longer than 1024 chars", { customJson: "x".repeat(1025) }],
  ])("rejects %s", async (_name, data) => {
    const { table } = await createSpace();
    await expect(
      table.insertOne({
        id: "ac:bob:demo",
        type: "appConf",
        app: "demo",
        user: "bob",
        data: data as never,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("accepts customJson exactly at the 1024 limit", async () => {
    const { table } = await createSpace();
    await table.insertOne({
      id: "ac:bob:demo",
      type: "appConf",
      app: "demo",
      user: "bob",
      data: { customJson: "x".repeat(1024) },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const back = (await table.findOne({ filter: { id: "ac:bob:demo" } })) as {
      data: { customJson: string };
    } | null;
    expect(back?.data.customJson.length).toBe(1024);
  });

  it.each([
    ["preset-only fields (label)", { appearance: "dark", label: "leak" }],
    [
      "userConf-only fields (defaultPresetId)",
      { appearance: "dark", defaultPresetId: "sys:standard" },
    ],
  ])("rejects appConf data carrying %s", async (_name, data) => {
    const { table } = await createSpace();
    await expect(
      table.insertOne({
        id: "ac:bob:demo",
        type: "appConf",
        app: "demo",
        user: "bob",
        data: data as never,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("appConf and userConf rows for the same (user, app) coexist without id collision", async () => {
    const { table, ctrl } = await setup();

    // appConf (id = ac:bob:demo)
    const appOut = await ctrl.callOnWrite("insert", {
      type: "appConf",
      app: "demo",
      data: { appearance: "dark", language: "en" },
    });
    await table.insertOne(appOut as never);

    // userConf for two different tables (id = uc:bob:demo:products, uc:bob:demo:orders)
    for (const tk of ["products", "orders"]) {
      const userOut = await ctrl.callOnWrite("insert", {
        type: "userConf",
        app: "demo",
        tableKey: tk,
        data: { defaultPresetId: "sys:standard" },
      });
      await table.insertOne(userOut as never);
    }

    const allRows = (await table.findMany({
      filter: { app: "demo", user: "bob" },
    })) as Array<{ id: string; type: string }>;
    const ids = allRows.map((r) => r.id).toSorted();
    expect(ids).toEqual(["ac:bob:demo", "uc:bob:demo:orders", "uc:bob:demo:products"]);
  });
});
