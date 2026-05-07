// Phase-1 bootstrap. See `tests/e2e/PLAN.md` ("Coordination rules for parallel
// agents") before changing anything in this file — Phase-2 batches must NOT
// add per-batch state here. New projects belong in their own config slice or
// behind an env-var gate.

import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SERVER_URL } from "./global-setup";

const E2E_ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: E2E_ROOT,
  // Smoke specs only for Phase 1. Phase-2 batches add their own `testMatch`s.
  fullyParallel: false,

  // Serialise the whole suite. Mutating batches (F/H/J/K/L) write to shared
  // SQLite tables (`users`, `_presets`, `audit_log`); cross-file parallelism
  // produces transaction-conflict flakes. Trade-off: ~1m20s → ~4m40s wall time
  // for bulletproof signal.
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [["list"], ["html", { outputFolder: resolve(E2E_ROOT, ".tmp/report"), open: "never" }]],

  // We manage the dev server ourselves in `global-setup.ts` so we can:
  //   1. Run `db:setup` BEFORE the server starts (sqlite file is wiped + re-seeded).
  //   2. Pipe stdout into `tests/e2e/.tmp/server.log` so the OTP outlet sink
  //      (`helpers/outlet.ts`) can tail it for MFA login of `alice`.
  // Playwright's `webServer` option doesn't expose stdout to user code, so we
  // skip it here.
  globalSetup: resolve(E2E_ROOT, "global-setup.ts"),
  globalTeardown: resolve(E2E_ROOT, "global-teardown.ts"),

  use: {
    baseURL: SERVER_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      // Run once before everything else: log each demo role in via the
      // workflow handshake, persist cookies to `playwright/.auth/<role>.json`.
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      // Picks up every spec under `tests/e2e/smoke/` and per-batch dirs that
      // match the PLAN.md naming convention `<a-l>-<topic>/...spec.ts`
      // (e.g. `a-cells/`, `b-filtering/`). Phase-2 batch agents drop their
      // specs into a new dir matching this regex; no config edit required.
      name: "tests",
      testMatch: /(smoke|[a-l]-[a-z][a-z-]*)\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        storageState: resolve(E2E_ROOT, "../../playwright/.auth/admin.json"),
      },
    },
  ],
});
