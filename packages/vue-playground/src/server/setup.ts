import { rmSync, mkdirSync } from "node:fs";

// Remove existing database BEFORE opening any SQLite connection
rmSync(".data/playground.db", { force: true });
rmSync(".data/playground.db-wal", { force: true });
rmSync(".data/playground.db-shm", { force: true });
mkdirSync(".data", { recursive: true });
console.log("🗑️  Removed existing database");

// Dynamic import so db.ts opens a fresh connection
const { syncSchema } = await import("@atscript/db/sync");
const { db } = await import("./db");
const { ProductsTable } = await import("./schemas/products.as");
const { CustomersTable } = await import("./schemas/customers.as");
const { seedProducts, seedCustomers } = await import("./seed");

// Sync schema (creates tables + indexes)
const result = await syncSchema(db, [ProductsTable, CustomersTable], { force: true });
console.log(`✅ Schema synced: ${result.status}`);

// Seed data
const productsTable = db.getTable(ProductsTable);
const customersTable = db.getTable(CustomersTable);

const products = seedProducts();
await productsTable.insertMany(products);
console.log(`📦 Seeded ${products.length} products`);

const customers = seedCustomers();
await customersTable.insertMany(customers);
console.log(`👥 Seeded ${customers.length} customers`);

console.log("\n✅ Database ready at .data/playground.db\n");
