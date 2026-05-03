import { describe, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, setup } from "./helpers";

describe("type and identity immutability", () => {
  it("rejects update that mutates type", async () => {
    const { table, ctrl } = await setup();
    const id = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: { label: "P" },
    });

    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id, type: "userConf" }),
      400,
      "type_immutable",
    );
  });

  it("rejects update that mutates app / tableKey / user / id", async () => {
    const { table, ctrl } = await setup();
    const id = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "bob",
      data: { label: "P" },
    });

    for (const patch of [
      { id, app: "other-app" },
      { id, tableKey: "orders" },
      { id, user: "alice" },
    ]) {
      await expectHttpRejection(() => ctrl.callOnWrite("update", patch), 400, "identity_immutable");
    }
  });

  it("rejects update without an id", async () => {
    const { ctrl } = await setup();
    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { data: { label: "x" } }),
      400,
      "missing_id",
    );
  });

  it("rejects insert with neither type nor scope", async () => {
    const { ctrl } = await setup();
    await expectHttpRejection(
      () => ctrl.callOnWrite("insert", { data: { label: "x" } }),
      400,
      "invalid_type",
    );
  });
});
