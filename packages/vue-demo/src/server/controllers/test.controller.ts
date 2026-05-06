import { Controller } from "moost";
import { Post, HttpError } from "@moostjs/event-http";
import {
  db,
  usersTable,
  rolesTable,
  categoriesTable,
  productsTable,
  customersTable,
  ordersTable,
  auditLogTable,
  presetsTable,
} from "../db";
import { UsersTable } from "../schemas/users.as";
import {
  seedRoles,
  seedUsers,
  seedCategories,
  seedProducts,
  seedCustomers,
  seedOrders,
  seedAuditLog,
} from "../seed";

/**
 * Test-only controller — only registered when `DEMO_TEST_MODE=1`.
 *
 * Replaces the legacy `pnpm db:setup` shell-out used by the e2e helper
 * `resetSeed()`. The shell-out `rmSync`s `.data/demo.db*` underneath the
 * dev server, which keeps a long-lived better-sqlite3 connection open —
 * the connection's lock state desyncs from the new inode and SQLite
 * flips writes to read-only on the next `INSERT` / `UPDATE`.
 *
 * This endpoint runs the wipe + reseed inside a single transaction on the
 * SAME live connection so writes stay valid across the reset.
 *
 * Auto-increment caveat: `@db.default.increment` columns compile to
 * `INTEGER PRIMARY KEY AUTOINCREMENT`, so the per-table counter lives in
 * `sqlite_sequence`. Plain `DELETE FROM <table>` does NOT reset that
 * counter, so a follow-up `INSERT` would land at `MAX(prev_id) + 1`
 * rather than `1`. The seed factories cross-reference seeded IDs (e.g.
 * `seedUsers` uses `roleId: 1` to point at the first row of `seedRoles`),
 * which only holds when post-reset IDs start at 1. We clear
 * `sqlite_sequence` inside the same transaction.
 */
@Controller("_test")
export class TestController {
  /**
   * Wipe + reseed the demo db on the live dev-server connection.
   *
   * FK-safe delete order (children before parents):
   *   audit_log, presets   — no FK refs in/out
   *   orders               — FK → customers, users
   *   products             — FK → categories, users
   *   customers            — referenced only by orders (now gone)
   *   users                — FK → roles, referenced by orders/products (now gone)
   *   categories           — self-ref (parentId), referenced by products (now gone)
   *   roles                — referenced only by users (now gone)
   */
  @Post("reset-seed")
  async resetSeed(): Promise<{ ok: true; ms: number }> {
    if (process.env.DEMO_TEST_MODE !== "1") {
      // Defence-in-depth — the route is only registered when the env var is
      // set, but a misconfigured run shouldn't be able to wipe the db.
      throw new HttpError(404, "Not found");
    }

    const started = Date.now();

    // Adapter/driver access — every table created via `db.getTable()` shares
    // the same `BetterSqlite3Driver` (the `createAdapter` factory captures one
    // driver and threads it through every adapter instance). So a transaction
    // begun via any one adapter wraps writes issued through the other tables
    // because all of them sit on the same SQLite connection.
    const adapter = db.getAdapter(UsersTable);
    const driver = (adapter as unknown as { driver: { exec(sql: string): void } }).driver;

    await adapter.withTransaction(async () => {
      // Phase 1 — wipe.
      await auditLogTable.deleteMany({});
      await presetsTable.deleteMany({});
      await ordersTable.deleteMany({});
      await productsTable.deleteMany({});
      await customersTable.deleteMany({});
      await usersTable.deleteMany({});
      await categoriesTable.deleteMany({});
      await rolesTable.deleteMany({});

      // Reset AUTOINCREMENT counters so the next inserts start at id=1 and
      // the cross-references in the seed factories (`roleId: 1`, etc.) line
      // up. Done via raw exec on the same driver — no public API exposes
      // `sqlite_sequence` because it's a SQLite-specific implementation
      // detail of AUTOINCREMENT semantics.
      driver.exec("DELETE FROM sqlite_sequence");

      // Phase 2 — reseed (same factories `setup.ts` uses on first boot).
      await rolesTable.insertMany(seedRoles() as Record<string, unknown>[]);
      await usersTable.insertMany((await seedUsers()) as Record<string, unknown>[]);
      await categoriesTable.insertMany(seedCategories() as Record<string, unknown>[]);
      await productsTable.insertMany(seedProducts() as Record<string, unknown>[]);
      await customersTable.insertMany(seedCustomers() as Record<string, unknown>[]);
      await ordersTable.insertMany(seedOrders() as Record<string, unknown>[]);
      await auditLogTable.insertMany(seedAuditLog() as Record<string, unknown>[]);
    });

    return { ok: true, ms: Date.now() - started };
  }
}
