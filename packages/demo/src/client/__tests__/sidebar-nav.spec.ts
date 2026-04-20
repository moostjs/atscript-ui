import { describe, expect, it } from "vite-plus/test";
import { filterNavByPermissions } from "../domain/nav-filter";
import { DEMO_TABLES } from "../domain/tables";

describe("filterNavByPermissions", () => {
  it("viewer cannot see audit_log", () => {
    const perms = {
      users: { read: true, write: false },
      roles: { read: true, write: false },
      categories: { read: true, write: false },
      products: { read: true, write: false },
      customers: { read: true, write: false },
      orders: { read: true, write: false },
      audit_log: { read: false, write: false },
    };
    const vis = filterNavByPermissions(DEMO_TABLES, perms);
    expect(vis.map((t) => t.path)).not.toContain("audit_log");
    expect(vis).toHaveLength(6);
  });

  it("admin sees everything", () => {
    const perms = Object.fromEntries(
      DEMO_TABLES.map((t) => [t.resource, { read: true, write: true }])
    );
    expect(filterNavByPermissions(DEMO_TABLES, perms)).toHaveLength(7);
  });

  it("no perms → empty", () => {
    expect(filterNavByPermissions(DEMO_TABLES, null)).toEqual([]);
    expect(filterNavByPermissions(DEMO_TABLES, {})).toEqual([]);
  });
});
