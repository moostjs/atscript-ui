import { request as playwrightRequest } from "@playwright/test";

import { workerUrl } from "../global-setup";

function currentWorkerUrl(): string {
  return workerUrl(Number(process.env.TEST_WORKER_INDEX ?? 0));
}

/**
 * Wipe and re-seed the demo sqlite db.
 *
 * Implementation: hits `POST /api/_test/reset-seed` on the live dev server
 * (mounted by `packages/vue-demo/src/server/controllers/test.controller.ts`
 * when `DEMO_TEST_MODE=1`, set in `tests/e2e/global-setup.ts`). The endpoint
 * runs the wipe + reseed inside a single transaction on the SAME live
 * better-sqlite3 connection the rest of the app uses — no rmSync, no
 * read-only desync.
 *
 * History: an earlier version shelled out to
 * `pnpm --filter @atscript/vue-demo run db:setup`, which `rmSync`'d
 * `.data/demo.db*` underneath the dev server. better-sqlite3 keeps the
 * connection's lock state pinned to the original inode, so the next write
 * after the file is recreated fails with `attempt to write a readonly
 * database`. Phase-2 batch F discovered this and worked around it via
 * serial test ordering. Future mutating batches need a working reset, so
 * this helper now uses the HTTP path.
 *
 * Cost: ~100 ms on a warm machine — one round-trip + ~7 k-row reseed
 * inside one transaction. Phase-2 mutating batches should still call this
 * at most once per file via `test.beforeAll`, NOT per test, and wrap the
 * file in `test.describe.serial` so concurrent workers don't trample each
 * other.
 */
export async function resetSeed(): Promise<void> {
  const ctx = await playwrightRequest.newContext({ baseURL: currentWorkerUrl() });
  try {
    // Explicit JSON content-type so the moost HTTP adapter parses
    // the empty body consistently across runs.
    const res = await ctx.post("/api/_test/reset-seed", {
      headers: { "content-type": "application/json" },
      data: {},
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`resetSeed: POST /api/_test/reset-seed failed (${res.status()})\n${body}`);
    }
  } finally {
    await ctx.dispose();
  }
}
