import { rmSync, mkdirSync } from "node:fs";

rmSync(".data/demo.db", { force: true });
rmSync(".data/demo.db-wal", { force: true });
rmSync(".data/demo.db-shm", { force: true });
mkdirSync(".data", { recursive: true });
console.log("🗑️  Removed existing database");

const { syncSchema } = await import("@atscript/db/sync");
const { db } = await import("./db");

// P1 will push UsersTable, RolesTable, ... here.
const schemas: unknown[] = [];

const result = await syncSchema(db, schemas as never, { force: true });
console.log(`✅ Schema synced: ${result.status}  (${schemas.length} tables)`);
