// Per-worker `baseURL` fixture. Overrides Playwright's built-in `baseURL`
// (set as `undefined` in `playwright.config.ts`) with `http://localhost:
// ${BASE_PORT + parallelIndex}` so each worker routes to its own demo-server
// replica spawned in `global-setup.ts`.
//
// This file also re-exports the Playwright types specs use (Locator, Page,
// BrowserContext, …) so a spec only needs ONE import line:
//
//   import { test, expect, type Page } from "../fixtures";
//
// The auth-setup project is intentionally pinned to replica 0 — `auth.setup.ts`
// imports `test` from `@playwright/test` directly and uses `SERVER_URL`.

import { test as base, expect } from "@playwright/test";

import { BASE_PORT } from "./global-setup";

export const test = base.extend<object, { workerBaseURL: string }>({
  workerBaseURL: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
    async ({}, use, workerInfo) => {
      // `TEST_WORKER_INDEX` (= Playwright's `workerIndex`) is unbounded —
      // it increments every time a worker process restarts (e.g. between
      // test files for isolation), so it can exceed `workers - 1`. Helpers
      // (`request.ts`, `seed.ts`, `outlet.ts`) need the bounded
      // `parallelIndex` to map to one of the spawned replicas, so we stamp
      // it onto `process.env` here. Worker-scoped fixtures fire once per
      // worker process before any test runs, so by the time a helper is
      // invoked the env var is already set in the same process.
      process.env.TEST_PARALLEL_INDEX = String(workerInfo.parallelIndex);
      await use(`http://localhost:${BASE_PORT + workerInfo.parallelIndex}`);
    },
    // `auto: true` so the fixture (and the env-var stamp) fires for every
    // test, even tests whose signature doesn't destructure `baseURL` /
    // `workerBaseURL` (e.g. raw-HTTP probes that build their own
    // `APIRequestContext` via `newAnonRequestContext()`).
    { scope: "worker", auto: true },
  ],
  baseURL: async ({ workerBaseURL }, use) => {
    await use(workerBaseURL);
  },
});

export { expect };

export type {
  APIRequestContext,
  Browser,
  BrowserContext,
  ConsoleMessage,
  Locator,
  Page,
} from "@playwright/test";
