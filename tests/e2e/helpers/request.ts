import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";

import { workerUrl } from "../global-setup";
import { authFileFor, type DemoRole } from "./auth";

/** URL of the replica owning the current Playwright worker process.
 *  `TEST_PARALLEL_INDEX` is stamped by `tests/e2e/fixtures.ts`'s
 *  `workerBaseURL` fixture (Playwright's own `TEST_WORKER_INDEX` is
 *  unbounded across worker restarts and would route past the spawned
 *  replicas). Falls back to 0 for contexts created outside a fixture-aware
 *  test (e.g. `auth.setup.ts`, which always pins to replica 0). */
function currentWorkerUrl(): string {
  return workerUrl(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
}

/**
 * Spawn an `APIRequestContext` pre-loaded with the storage state for a demo
 * role — i.e. one that already carries `demo.sid` so requests sail past the
 * SessionGuard without redoing the workflow handshake.
 *
 * Useful for Section 20 (raw HTTP / framework-rigidity tests) where the DOM
 * isn't involved and we want a thin client that hits `/api/...` directly.
 *
 * Always pair with `await ctx.dispose()` in a `try/finally` (or a fixture
 * teardown) to release the cookie store.
 */
export async function newRequestContext(role: DemoRole): Promise<APIRequestContext> {
  return await playwrightRequest.newContext({
    baseURL: currentWorkerUrl(),
    storageState: authFileFor(role),
    extraHTTPHeaders: { "content-type": "application/json" },
  });
}

/**
 * Anonymous APIRequestContext — no storage state, no `demo.sid` cookie.
 * The explicit empty `storageState` is load-bearing: without it Playwright
 * silently inherits the project-level `use.storageState` (admin's cookie),
 * so 401 probes would pass for the wrong reason.
 */
export async function newAnonRequestContext(): Promise<APIRequestContext> {
  return await playwrightRequest.newContext({
    baseURL: currentWorkerUrl(),
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "content-type": "application/json" },
  });
}
