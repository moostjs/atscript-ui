import { describe, it, expect } from "vite-plus/test";
import { MoostArbac } from "@moostjs/arbac";
import { DEMO_ACTION_GROUPS, registerDemoRoles } from "../server/auth/arbac-policy";
import type { DemoScope, DemoUserAttrs } from "../server/auth/arbac-scope";

function arbacFor(roleName: DemoUserAttrs["roleName"]) {
  const a = new MoostArbac<DemoUserAttrs, DemoScope>();
  registerDemoRoles(a);
  const attrs: DemoUserAttrs = { userId: 1, username: "x", roleName };
  return {
    a,
    user: { id: "1", roles: [roleName], attrs },
  };
}

// Representative action names. Because the demo policy maps actions to
// controller method names (read = query/pages/getOne/…/meta, write = insert/…),
// we pick one method per group; any member of the group yields the same scope.
const READ = DEMO_ACTION_GROUPS.read[0];
const WRITE = DEMO_ACTION_GROUPS.write[0];

describe("p3 arbac policy", () => {
  it("admin sees all columns on users (no columns narrowing)", async () => {
    const { a, user } = arbacFor("admin");
    const res = await a.evaluate({ resource: "users", action: READ }, user);
    expect(res.allowed).toBe(true);
    expect(res.scopes?.length).toBeGreaterThan(0);
    // admin rule returns an empty scope object: {} → columns undefined
    expect(res.scopes?.[0]?.columns).toBeUndefined();
  });

  it("viewer sees only a narrow column set on users", async () => {
    const { a, user } = arbacFor("viewer");
    const res = await a.evaluate({ resource: "users", action: READ }, user);
    expect(res.allowed).toBe(true);
    expect(res.scopes?.[0]?.columns).toEqual(["id", "username", "status"]);
  });

  it("viewer cannot write to products (explicit deny on *:write methods)", async () => {
    const { a, user } = arbacFor("viewer");
    const res = await a.evaluate({ resource: "products", action: WRITE }, user);
    expect(res.allowed).toBe(false);
  });

  it("viewer cannot read audit_log (no matching allow rule)", async () => {
    const { a, user } = arbacFor("viewer");
    const res = await a.evaluate({ resource: "audit_log", action: READ }, user);
    expect(res.allowed).toBe(false);
  });
});
