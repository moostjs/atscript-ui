import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { buildModelRoutes } from "./model-routes";

async function loadModels() {
  const { NavUsers, NavOrders, NavSalesReport, NavAudit, NavProducts, NavPlain } =
    await import("../__tests__/fixtures/model-routes.as");
  return { NavUsers, NavOrders, NavSalesReport, NavAudit, NavProducts, NavPlain } as Record<
    string,
    TAtscriptAnnotatedType
  >;
}

describe("buildModelRoutes", () => {
  it("derives paths from db.http.path, db.table/db.view names, and type id fallback", async () => {
    const { NavUsers, NavOrders, NavSalesReport, NavAudit, NavProducts } = await loadModels();
    const routes = buildModelRoutes([NavUsers, NavOrders, NavSalesReport, NavAudit, NavProducts]);
    const byModel = new Map(routes.map((r) => [r.model, r]));

    expect(byModel.get(NavUsers)?.path).toBe("users");
    // db.http.path wins over the db.table name
    expect(byModel.get(NavOrders)?.path).toBe("db/tables/orders");
    expect(byModel.get(NavSalesReport)?.path).toBe("sales_report");
    // leading/trailing slashes are stripped
    expect(byModel.get(NavAudit)?.path).toBe("db/tables/audit");
    // bare @db.table → type id as-is (mirrors moost-db's controller prefix resolution)
    expect(byModel.get(NavProducts)?.path).toBe("NavProducts");
  });

  it("labels from @meta.label with humanized path-segment fallback", async () => {
    const { NavUsers, NavOrders, NavProducts } = await loadModels();
    const routes = buildModelRoutes([NavUsers, NavOrders, NavProducts]);

    expect(routes.find((r) => r.model === NavUsers)?.label).toBe("People");
    expect(routes.find((r) => r.model === NavOrders)?.label).toBe("Orders");
    expect(routes.find((r) => r.model === NavProducts)?.label).toBe("Nav Products");
  });

  it('marks db.view models as kind "view", tables as "table"', async () => {
    const { NavUsers, NavSalesReport } = await loadModels();
    const routes = buildModelRoutes([NavUsers, NavSalesReport]);

    expect(routes.find((r) => r.model === NavUsers)?.kind).toBe("table");
    expect(routes.find((r) => r.model === NavSalesReport)?.kind).toBe("view");
  });

  it("carries group / order and keeps hidden models with hidden: true", async () => {
    const { NavOrders, NavAudit } = await loadModels();
    const routes = buildModelRoutes([NavAudit, NavOrders]);

    const orders = routes.find((r) => r.model === NavOrders)!;
    expect(orders.group).toBe("Sales");
    expect(orders.order).toBe(1);
    expect(orders.hidden).toBeUndefined();

    const audit = routes.find((r) => r.model === NavAudit)!;
    expect(audit.hidden).toBe(true);
  });

  it("skips models without db.table / db.view annotations", async () => {
    const { NavUsers, NavPlain } = await loadModels();
    const routes = buildModelRoutes([NavUsers, NavPlain]);

    expect(routes).toHaveLength(1);
    expect(routes[0].model).toBe(NavUsers);
  });

  it("sorts by order ascending, undefined orders last in input order", async () => {
    const { NavUsers, NavOrders, NavSalesReport, NavAudit, NavProducts, NavPlain } =
      await loadModels();
    const routes = buildModelRoutes([
      NavUsers,
      NavSalesReport,
      NavAudit,
      NavOrders,
      NavProducts,
      NavPlain,
    ]);

    expect(routes.map((r) => r.model)).toEqual([
      NavOrders, // order 1
      NavSalesReport, // order 2
      NavUsers, // no order — input order preserved
      NavAudit,
      NavProducts,
    ]);
  });
});
