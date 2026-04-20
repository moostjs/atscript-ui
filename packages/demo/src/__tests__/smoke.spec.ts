import { describe, it, expect } from "vite-plus/test";

describe("demo p0 smoke", () => {
  it("boots server main.ts without errors", async () => {
    const mod = await import("../server/main");
    expect(mod).toBeDefined();
  });

  it("health controller returns ok", async () => {
    const { HealthController } = await import("../server/controllers/health.controller");
    const c = new HealthController();
    expect(c.ping()).toEqual({ ok: true });
  });
});
