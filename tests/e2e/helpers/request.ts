import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";

import { SERVER_URL } from "../global-setup";
import { authFileFor, type DemoRole } from "./auth";

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
    baseURL: SERVER_URL,
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
    baseURL: SERVER_URL,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "content-type": "application/json" },
  });
}
