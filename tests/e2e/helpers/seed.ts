import { spawnSync } from "node:child_process";

/**
 * Wipe and re-seed the demo sqlite db.
 *
 * Implementation: shells out to `pnpm --filter @atscript/vue-demo run db:setup`,
 * which is the same script `globalSetup` runs once per test session. The
 * script `rmSync`s `.data/demo.db*` and re-runs `syncSchema` + the seed
 * factories under `packages/vue-demo/src/server/seed.ts`.
 *
 * Cost is non-trivial (~2–4 s end-to-end on a warm machine — vite-node has to
 * boot, schemas have to compile, ~7 k rows are inserted across products +
 * audit_log). Phase-2 mutating batches should call this at most once per file
 * via `test.beforeAll`, NOT per test — and wrap the file in
 * `test.describe.serial` so concurrent workers don't trample each other.
 *
 * The dev server keeps its sqlite handle through this rewrite. better-sqlite3
 * tolerates the file being re-created underneath it for read paths but not
 * for mid-flight writes — there are currently no in-flight writes during
 * `resetSeed()` calls (Phase-2 batches always call it from `beforeAll`,
 * never from inside a `test` step), so this works in practice. If a future
 * batch needs in-test reseed, route the wipe through a dedicated test-only
 * HTTP endpoint instead.
 */
export function resetSeed(): void {
  const result = spawnSync("pnpm", ["--filter", "@atscript/vue-demo", "run", "db:setup"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new Error(`resetSeed: db:setup failed (exit ${result.status})\n${stderr}`);
  }
}
