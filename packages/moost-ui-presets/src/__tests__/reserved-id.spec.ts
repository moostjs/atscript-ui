import { describe, expect, it } from "vite-plus/test";

import { expectHttpRejection, setup } from "./helpers";

describe("reserved id prefixes ('sys:', 'uc:', 'ac:')", () => {
  it.each(["sys:my-baseline", "uc:hijack:demo:products", "ac:hijack:demo"])(
    "rejects insert when client supplies id with reserved prefix (%s)",
    async (id) => {
      const { ctrl } = await setup();

      await expectHttpRejection(
        () =>
          ctrl.callOnWrite("insert", {
            id,
            type: "preset",
            app: "demo",
            tableKey: "products",
            data: { label: "x" },
          }),
        400,
        "reserved_id",
      );
    },
  );

  it("rejects update where the patch id starts with a reserved prefix", async () => {
    const { ctrl } = await setup();

    await expectHttpRejection(
      () => ctrl.callOnWrite("update", { id: "sys:foo", data: { label: "x" } }),
      400,
      "reserved_id",
    );
  });

  it("rejects remove where id starts with a reserved prefix", async () => {
    const { ctrl } = await setup();

    await expectHttpRejection(() => ctrl.callOnRemove("sys:standard"), 400, "reserved_id");
  });

  it("auto-generated preset ids never collide with reserved prefixes", async () => {
    const { ctrl } = await setup();

    for (let i = 0; i < 25; i++) {
      const out = (await ctrl.callOnWrite("insert", {
        type: "preset",
        app: "demo",
        tableKey: "products",
        data: { label: `auto-${i}` },
      })) as { id: string };
      expect(out.id.startsWith("sys:")).toBe(false);
      expect(out.id.startsWith("uc:")).toBe(false);
      expect(out.id.startsWith("ac:")).toBe(false);
    }
  });
});
