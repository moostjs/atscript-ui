import { describe, it, expect } from "vite-plus/test";
import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import { OrdersTable } from "../server/schemas/orders.as";
import { CustomersTable } from "../server/schemas/customers.as";
import { UsersTable } from "../server/schemas/users.as";
import { RolesTable } from "../server/schemas/roles.as";
import { ProductsTable } from "../server/schemas/products.as";
import { CategoriesTable } from "../server/schemas/categories.as";

describe("bulk-cancel trigger", () => {
  async function prep() {
    const space = createAdapter(":memory:");
    await syncSchema(
      space,
      [RolesTable, UsersTable, CustomersTable, CategoriesTable, ProductsTable, OrdersTable],
      { force: true },
    );
    const orders = space.getTable(OrdersTable);
    const customers = space.getTable(CustomersTable);
    await customers.insertOne({
      name: "c",
      email: "c@d.test",
      address: { street: "x", city: "y", state: "z", zip: "0", country: "u" },
      preferences: { newsletter: false, channel: "none" as const },
    });
    return { orders, customers };
  }

  it("detects delivered in selection", async () => {
    const { orders } = await prep();
    await orders.insertMany([
      { customerId: 1, status: "pending", lines: [], total: 0 },
      { customerId: 1, status: "delivered", lines: [], total: 0 },
    ]);
    const selected = await orders.findMany({ filter: { id: { $in: [1, 2] } } });
    expect(selected.some((o) => o.status === "delivered")).toBe(true);
  });

  it("all non-delivered → cancellable", async () => {
    const { orders } = await prep();
    await orders.insertMany([
      { customerId: 1, status: "pending", lines: [], total: 0 },
      { customerId: 1, status: "processing", lines: [], total: 0 },
    ]);
    const selected = await orders.findMany({ filter: { id: { $in: [1, 2] } } });
    expect(selected.some((o) => o.status === "delivered")).toBe(false);
  });
});
