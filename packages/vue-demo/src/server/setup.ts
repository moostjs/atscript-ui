import { rmSync, mkdirSync } from "node:fs";

rmSync(".data/demo.db", { force: true });
rmSync(".data/demo.db-wal", { force: true });
rmSync(".data/demo.db-shm", { force: true });
mkdirSync(".data", { recursive: true });
console.log("🗑️  Removed existing database");

const { syncSchema } = await import("@atscript/db/sync");
const { db } = await import("./db");
const { UsersTable } = await import("./schemas/users.as");
const { RolesTable } = await import("./schemas/roles.as");
const { CategoriesTable } = await import("./schemas/categories.as");
const { ProductsTable } = await import("./schemas/products.as");
const { CustomersTable } = await import("./schemas/customers.as");
const { OrdersTable } = await import("./schemas/orders.as");
const { AuditLogTable } = await import("./schemas/audit-log.as");
const { seedRoles, seedUsers, seedCategories, seedProducts, seedCustomers, seedOrders } =
  await import("./seed");

const result = await syncSchema(
  db,
  [
    RolesTable,
    UsersTable,
    CategoriesTable,
    ProductsTable,
    CustomersTable,
    OrdersTable,
    AuditLogTable,
  ],
  { force: true },
);
console.log(`✅ Schema synced: ${result.status}`);

const rolesT = db.getTable(RolesTable);
const usersT = db.getTable(UsersTable);
const categoriesT = db.getTable(CategoriesTable);
const productsT = db.getTable(ProductsTable);
const customersT = db.getTable(CustomersTable);
const ordersT = db.getTable(OrdersTable);

await rolesT.insertMany(seedRoles() as Record<string, unknown>[]);
await usersT.insertMany((await seedUsers()) as Record<string, unknown>[]);
await categoriesT.insertMany(seedCategories() as Record<string, unknown>[]);
await productsT.insertMany(seedProducts() as Record<string, unknown>[]);
await customersT.insertMany(seedCustomers() as Record<string, unknown>[]);
await ordersT.insertMany(seedOrders() as Record<string, unknown>[]);
console.log("✅ Demo DB ready at .data/demo.db");
