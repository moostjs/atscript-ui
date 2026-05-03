import { describe, it } from "vite-plus/test";

import { expectHttpRejection, seedPreset, setup } from "./helpers";

describe("ownership gate", () => {
  it("403 on update of another user's row", async () => {
    const { table, ctrl } = await setup();
    const aliceRow = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { label: "Alice's" },
    });

    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id: aliceRow, data: { label: "hijack" } }),
      403,
      "identity_immutable",
    );
  });

  it("403 on remove of another user's row", async () => {
    const { table, ctrl } = await setup();
    const aliceRow = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { label: "Alice's" },
    });

    await expectHttpRejection(() => ctrl.callOnRemove(aliceRow), 403, "identity_immutable");
  });

  it("blocks 'replace' as unsupported (would otherwise bypass cap + identity checks)", async () => {
    const { table, ctrl } = await setup();
    const aliceRow = await seedPreset(table, {
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { label: "Alice's" },
    });

    await expectHttpRejection(
      () =>
        ctrl.callOnWrite("replace", {
          id: aliceRow,
          type: "preset",
          app: "demo",
          tableKey: "products",
          data: { label: "hijack" },
        }),
      405,
      "action_unsupported",
    );
  });
});
