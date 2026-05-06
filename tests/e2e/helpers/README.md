# tests/e2e/helpers

Phase-1 helper barrel for the table-e2e suite. Cross-link: [../PLAN.md](../PLAN.md), [../../../TABLE_SCENARIOS.md](../../../TABLE_SCENARIOS.md).

## Ground rules for Phase-2 agents

- **Import from the barrel only.** Never reach into a submodule directly. The barrel is the contract.
- **Don't extend the barrel without a chat RFC.** Every Phase-2 batch will hit a "I need a helper for X" moment — post in chat, get alignment, then touch [`index.ts`](./index.ts). The TODO sketches at the bottom of `index.ts` are the design notes; implement them when the first batch needs them, not pre-emptively.
- **Helpers do one thing.** A helper that "applies a filter and asserts a single query" is wrong — compose `expectSinglePages(page, () => addFilterPill(...))` in the spec instead. This keeps the barrel surface tight and the assertions readable.
- **Mutating tests own their reset.** Call [`resetSeed()`](#seedts) in `beforeAll` and wrap the file in `test.describe.serial`. Don't reset per-test (it costs 2–4 s).
- **Server latency is OFF in tests.** `global-setup.ts` exports `DEMO_NO_LATENCY=1` to bypass the 50/100 ms latency interceptor at [packages/vue-demo/src/server/interceptors/latency.ts](../../../packages/vue-demo/src/server/interceptors/latency.ts). Specs that need to observe loading states must opt in per-route via `page.route("**/api/db/tables/<x>/<endpoint>", async (r) => { await new Promise(rs => setTimeout(rs, MS)); await r.continue() })` — see [smoke/loading-skeleton.spec.ts](../smoke/loading-skeleton.spec.ts) for the canonical pattern. Per-route is more deterministic than the natural latency (which is tighter than Playwright's locator polling cadence).

---

## auth.ts — `DEMO_PASSWORD`, `DEMO_ROLES`, `authFileFor`, `performLogin`

Login plumbing for the four demo roles (`admin` / `manager` / `viewer` / `alice`). All seeded with password `demo-password`; `alice` has `mfaEnabled: true`.

- `performLogin(request, role)` runs the `api/auth/login` workflow handshake against the demo and leaves a `demo.sid` cookie on the supplied `APIRequestContext`. For `alice` it pulls the OTP from [outlet.ts](#outletts).
- `authFileFor(role)` returns the storage-state JSON path. Use it when a spec needs to switch role mid-file (write a fresh context with the file as `storageState`).

**Does not:** drive the login UI. Specs should re-use the storage state generated once at `auth.setup.ts` time, not re-login per test.

**Phase-2 add via RFC if you need:** parameterised role-mixing helpers, multi-tab session tests.

---

## seed.ts — `resetSeed()`

Wipes `.data/demo.db*` and re-seeds via the demo's `db:setup` script (~2–4 s). Call from `test.beforeAll` of mutating files.

- `resetSeed()` shells out to `pnpm --filter @atscript/vue-demo run db:setup`. Same script `globalSetup` runs once per session.

**Does not:** reset per-user state (presets, appConf). Those live in the same sqlite file so `resetSeed()` clears them transitively.

**Phase-2 add via RFC if you need:** a faster narrow-table reset (e.g. `resetTable('orders')`) — would need a test-only HTTP endpoint on the demo.

---

## network.ts — `expectSinglePages(page, fn, opts)`, `expectNoPages(page, fn, opts)`

The "1 query" Conventions baseline (TABLE_SCENARIOS.md preamble) and the URL-bridge echo regression (Scenario 6.4).

- `expectSinglePages(page, fn, { table?, quietWindowMs?, timeoutMs? })` — runs `fn`, waits 700 ms past the last `/pages` request, asserts EXACTLY one fired. Default table filter is unscoped; pass `{ table: 'users' }` to narrow.
- `expectNoPages(page, fn, opts)` — assertion-mate for "this mutation must NOT trigger a query" (Scenario 5.3).

**Does not:** use `page.waitForRequest` — that resolves on the first match and would silently miss a double-fire. The implementation collects requests in an array and fires once the quiet window closes.

**Phase-2 add via RFC if you need:** observers for `/meta`, mutation endpoints, or `/wf` workflows. Same pattern, different URL regex — but each gets its own helper, don't make one polymorphic monster.

---

## url.ts — `expectUrlQuery(page, fragments, opts?)`

Decoded-equivalence URL assertion. Compares on `decodeURIComponent(page.url())` against `decodeURIComponent(fragment)` so `URLSearchParams`-encoded operator chars (`~`, `'`, `/`) round-trip cleanly. This is the regression at Scenario 6.4.

- `expectUrlQuery(page, fragments)` — every fragment must appear, decoded.
- `expectUrlQuery(page, fragments, { not: true })` — every fragment must NOT appear.

**Does not:** parse Uniquery semantics. If a Phase-2 spec needs to assert a structured filter ("status equals shipped"), parse `page.url()` itself in the spec.

---

## viewport.ts — `setMobileViewport(page)`, `setDesktopViewport(page)`

Phone-portrait + desktop sizes. Section 18 mobile-fullscreen branch needs the mobile breakpoint.

- `MOBILE_VIEWPORT` = `{ width: 390, height: 844 }`
- `DESKTOP_VIEWPORT` = `{ width: 1280, height: 800 }`

**Phase-2 add via RFC if you need:** tablet breakpoint, landscape, or per-batch viewport overrides via Playwright projects.

---

## clipboard.ts — `installClipboardSink(page)`, `getClipboardWrites(page)`, `getLastClipboardWrite(page)`

Patch `navigator.clipboard.writeText` so tests can assert what was copied without an OS prompt. Used by Scenario 8.3 (row action `copy`).

- `installClipboardSink(page)` — call from `test.beforeEach`. Idempotent.
- `getClipboardWrites(page)` — array of every text write so far on the page.
- `getLastClipboardWrite(page)` — convenience for the common "what did the last action copy" assertion.

**Does not:** patch `readText`. It's stubbed to return the last write — Phase-2 batches that need a real read flow can extend the init script.

---

## outlet.ts — `waitForOtp({ email, sinceMs })`, `waitForOutletEntry(opts)`

Reads the dev server's stdout log (`tests/e2e/.tmp/server.log`) and matches `📧 [<template>] → <target>` headers + their `context: {...}` payload + optional `link: ...` line.

- `waitForOtp({ email, sinceMs })` — Phase-1 MFA login uses this to read alice's OTP. Capture `Date.now()` BEFORE the request that triggers the OTP and pass it as `sinceMs` so a stale entry from a previous test cannot satisfy the wait.
- `waitForOutletEntry({ template, email, sinceMs })` — same but returns the full entry (`{ template, target, code?, link?, contextLine? }`) so Phase-2 batch K can pull magic-link tokens for invite/password-reset workflows.

**Does not:** reset the log. The log accumulates across the test session; the `sinceMs` anchor is what guarantees freshness.

**Phase-2 add via RFC if you need:** websocket / SSE outlets, or replacing the file-tail with a real HTTP outlet sink (the latter would require demo-source changes).

---

## request.ts — `newRequestContext(role)`, `newAnonRequestContext()`

Thin wrappers around `playwright.request.newContext({ baseURL, storageState })` for raw-HTTP testing (Section 20).

- `newRequestContext('admin')` — session cookie pre-loaded; requests sail past `SessionGuard`.
- `newAnonRequestContext()` — empty storage state.

Always pair with `await ctx.dispose()` in a `try/finally` or fixture teardown.

---

## table.ts — `gotoTable(page, slug, opts?)`

Single helper — navigates to the route and waits for `/meta` + initial `/pages` to settle, plus the Loading… overlay to clear.

- `gotoTable(page, 'users')` — common case.
- `gotoTable(page, 'orders-cancelled', { apiPath: 'orders' })` — when route slug ≠ API path (sticky-filter aliases).

**Phase-2 add via RFC if you need:** `getRow`, `getCell`, `openColumnMenu`, etc. The shape sketches live as TODO comments at the bottom of [`index.ts`](./index.ts).

---

## filter.ts — `addFilterPill(page, label)`, `pillByLabel(page, label)`

Toolbar Filters-dialog pill helpers (Section 4). Hoisted from batch B after the inlined `addFilterPill` shape stabilised across four spec files.

- `pillByLabel(page, label)` — locator for a filter pill by its column label (exact match).
- `addFilterPill(page, label)` — opens the toolbar Filters dialog, toggles the named row, applies, and returns the pill locator. **Idempotent** — short-circuits when the named pill already exists (the Standard preset can auto-render pills on first paint, e.g. `/users` ships Status + Role pre-rendered).

**Does not:** type into the pill input or commit a value. Compose with the spec's own input interaction so the assertion ("typing X fires one /pages") stays readable.

**Phase-2 add via RFC if you need:** `setPillValue` (type + Enter), `removeFilterPill` (× on chip), `openFilterDialog` (per-column dialog via F4). The per-column dialog is a different surface from the toolbar dialog and lives in `<AsFilterDialog>` (`.as-filter-dialog-content`), not `<AsConfigDialog>` (`.as-config-dialog-content`).

---

## dialog.ts — `<AsConfigDialog>` helpers (toolbar Columns / Filters / Sorters tabs)

The toolbar's three buttons (Columns / Filters / Sorters) all open the same `<AsConfigDialog>` with three tabs. Hoisted from batch C after the inlined helpers stabilised across three spec files.

- `configDialog(page)` — root locator (`.as-config-dialog-content`).
- `configTabTrigger(dialog, tab)` — tab trigger by name; matched by canonical-order index for stability against label-text drift.
- `configActivePanel(dialog)` — active `[role='tabpanel']` inside the dialog.
- `configListRow(dialog, label)` — row in the active tabpanel by visible label. Handles both label classes (`.as-orderable-list-item-label` for Columns/Sorters, `.as-config-field-label-text` for Filters).
- `openConfigDialog(page, tab)` — clicks the toolbar entry button (`title="Columns" | "Filters" | "Sorters"`) and asserts the named tab is active. Returns the dialog locator.
- `applyConfig(dialog)` / `cancelConfig(dialog)` — clicks the footer button and asserts the dialog dismissed.
- `toggleConfigListRow(dialog, label)` — toggles a row's checkbox via row click.
- `moveConfigListRowDown(dialog, label)` — moves a row down one slot via its hover-revealed Move-down arrow. Hovers first since `.as-orderable-list-item-actions` is `opacity-0 pointer-events-none` until group-hover.

**Does not:** drag-reorder via HTML5 drag events (Playwright's `dragTo` flakes on Reka-style overlays). Use the click-arrow path instead — same effect, deterministic.

**Phase-2 add via RFC if you need:** `searchConfigList(dialog, term)`, `clearAllSorters(dialog)`, `setSorterDirection(dialog, label, dir)`. The first two are likely; the third was inlined-and-then-removed during batch C's simplify pass since it's a one-liner at the call site.
