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
      await use(`http://localhost:${BASE_PORT + workerInfo.parallelIndex}`);
    },
    { scope: "worker" },
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
