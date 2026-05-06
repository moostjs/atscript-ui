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

Wipes the demo db and re-seeds it inside a single transaction on the live dev-server connection (~100 ms). Call from `test.beforeAll` of mutating files.

- `resetSeed()` is async — `await` the result. It hits `POST /api/_test/reset-seed` (mounted by `packages/vue-demo/src/server/controllers/test.controller.ts` only when `DEMO_TEST_MODE=1`, set in `global-setup.ts`).
- Earlier shell-out version (`pnpm db:setup`) `rmSync`'d the db file underneath the dev server, which kept its long-lived better-sqlite3 connection open — the connection's lock state desynced from the new inode and SQLite flipped writes to read-only on the next mutation. Phase-2 batch F discovered this and worked around it via serial test ordering.

**Does not:** reset per-user state (presets, appConf). Those live in the same sqlite file so `resetSeed()` clears them transitively.

**Phase-2 add via RFC if you need:** a faster narrow-table reset (e.g. `resetTable('orders')`) — would need a sibling test-only endpoint on the demo controller.

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

---

## selection.ts — `toggleSelectMode`, `selectRowByIndex`, `clearSelection`, `selectedRowCellTexts`

Multi-select toggle + checkbox interaction (Section 9 + supporting paths in batches F / G / H). Promoted in Phase-3 after the `toggleSelectMode` + `selectRowByIndex` shapes appeared in 5+ files.

- `toggleSelectMode(page)` — clicks `.as-page-title-toggle` (first match).
- `selectRowByIndex(table, rowIndex)` — clicks `.as-td-select .as-table-checkbox` inside the row at `rowIndex`. Click target is the checkbox cell (NOT the row body) so the gesture stays scoped to the checkbox-toggle path documented in `as-table-base.vue`.
- `clearSelection(page)` — clicks toolbar `Clear` then exits multi-select. Use between sub-tests in serial chains.
- `selectedRowCellTexts(table, columnPath)` — trimmed text of the `columnPath` cell for every `aria-selected="true"` row. Drives 9.2's selection-trim assertion.

**Phase-2 add via RFC if you need:** `selectRowByCellText(table, column, text)`, `selectAllOnPage(page)`. Both are one-liners at the call site today; promote when 3+ specs need them.

---

## pagination.ts — `clickPaginationPage`, `clickPaginationNext`, `setItemsPerPage`

TablePage's `<TablePagination>` — paginated browsing (Section 10). The pagination component is demo-side, not framework-side, so selectors target `.table-pagination*` (no `as-` prefix).

- `clickPaginationPage(page, n)` — clicks `.table-pagination-btn` whose label is exactly `n` (anchored regex).
- `clickPaginationNext(page)` — clicks `.table-pagination-btn[aria-label='Next page']`.
- `setItemsPerPage(page, n)` — `selectOption` on `.table-pagination select.i8-filled`.

**Does not:** assert on the wire (`$page` / `$size`) — compose with `expectSinglePages(page, () => clickPaginationPage(...))` and assert on the captured URL.

---

## rows.ts — `columnCellIndex`, `rowByCellText`, `userRowByName`, `texts`

Row identity + cell access (Sections 2 / 8 / 10). All four were inlined across 6+ specs; the canonical signatures live here.

- `columnCellIndex(table, columnPath)` — `cellIndex` of `<thead th[data-column-path="…"]>`. Asserts exactly one match (loud failure on duplicate / missing column).
- `rowByCellText(table, columnIndex, text)` — `tbody tr` filter via XPath `./td[N][normalize-space(.)="text"]`. Returns the unfiltered Locator; caller chooses `.first()`.
- `userRowByName(table, name)` — `/users` specialization (resolves `username` column index, asserts single match).
- `texts(loc)` — `evaluateAll` → trimmed `textContent` for every match. Fast for large lists.

**Phase-2 add via RFC if you need:** `customerRowById(table, id)` etc. — only if a fourth specialization actually appears across batches. Most specs should compose `columnCellIndex` + `rowByCellText` directly.

---

## actions.ts — `openRowActionsMenu`, `clickRowMenuItem`, `clickToolbarAction`, `awaitActionFormReady`, `dismissActionForm`, `dismissConfirm`, `findToast`

Action surfaces (Section 8). Promoted in Phase-3 from batch F (mutating-actions) + batch E (action-render).

- `openRowActionsMenu(page, row)` — clicks `.as-row-actions-more`, awaits the portalled `.as-row-actions-menu`. Returns the menu Locator.
- `clickRowMenuItem(menu, label)` — clicks `.as-row-actions-menu-item` whose text contains `label`.
- `clickToolbarAction(page, label)` — clicks the toolbar `.as-table-actions-btn` whose label contains `label`.
- `awaitActionFormReady(page)` — waits for `.as-action-form-content` + at least one form input. Returns the form Locator. Specs that need a specific named field add their own `expect(...).toHaveCount(1)` after.
- `dismissActionForm(page)` — clicks `.as-action-form-cancel` and asserts dismount.
- `dismissConfirm(page)` — clicks `.as-confirm-dialog-cancel` and asserts dismount.
- `findToast(page, contains)` — TablePage's `<ToastStack>` is `.fixed.bottom-4.right-4 > div`; filter by text. Asserts visible. Does NOT dismiss the toast.

**Phase-2 add via RFC if you need:** `confirmConfirmDialog(page)` (clicks Confirm), `submitActionForm(page, fields)`. The first is a one-liner today; the second needs a stable field-fill API design (per-type input handling).

---

## columns.ts — `clickColumnHeader`, `pickSort`, `sortIndicator`

Column-header sort menu surface (Sections 6 + 7 + 11). Promoted from batches C / D / H.

- `clickColumnHeader(page, columnPath)` — clicks `<button class="as-th-btn">` inside the matching `<th>`. The `<th>` itself is the drag-reorder surface, so the inner button is the click target. Scoped to `table[data-as-main-table]` so an open value-help dropdown (its own `table.as-table`) doesn't match.
- `pickSort(page, dir)` — clicks `Ascending` / `Descending` in the open `.as-column-menu-content`.
- `sortIndicator(page, columnPath, dir)` — Locator for the `.as-th-sort.i-as-arrow-{up,down}` glyph on the matching column header. Scoped to `table[data-as-main-table]` so it ignores secondary tables (e.g. value-help inside filter dialogs).

**Phase-2 add via RFC if you need:** `clickColumnMenuItem(page, label)` (currently a one-liner with `pickSort` covering the common case), `hideColumn(page, columnPath)` (column-menu Hide entry).

---

## preset.ts — `openPresetPicker`, `openSaveAsPopover`, `openManageDialog`, `dialogRow`, `applyPickerItem`

Preset picker + manager dialog navigation (Section 11). Promoted from batch H — `applyPickerItem` was used 7×, the strongest dedup candidate of the entire RFC slate.

- `openPresetPicker(page)` — clicks `.as-preset-picker-trigger`, asserts `.as-preset-picker-menu` visible. Returns the menu Locator.
- `openSaveAsPopover(page, menu)` — clicks `Save as` action in the open menu, asserts `.as-preset-picker-popover` visible. Returns the popover Locator.
- `openManageDialog(page, menu)` — clicks `Manage presets` action in the open menu, asserts `.as-preset-dialog-content` visible. Returns the dialog Locator.
- `dialogRow(dialog, label)` — Locator for the `.as-preset-dialog-row` whose `.as-preset-dialog-row-label-text` exactly matches `label`. Scoped to the supplied dialog so it ignores any other dialogs in the DOM.
- `applyPickerItem(page, label, opts?)` — opens picker, clicks the named row, awaits menu dismount; with `{ table }` also waits for the `/pages` GET refetch.

**Phase-2 add via RFC if you need:** `setAspectMask(popover, mask)` (Save-as aspect checkboxes — currently inline in 11.5/11.6), `clickDialogRowAction(row, name)` (pin / star / public / trash icons inside a manager-dialog row).

---

## wire.ts — `captureWire`, `captureLastPost`, `capturePresetWire`

Wire-request capture with leak-free `dispose()` (Sections 8 + 11). Promoted in Phase-3 to fix batch F's listener-leak — the original `captureWirePost` attached a `page.on("request")` handler that never detached, so handlers accumulated across the serial chain (each new test added another handler firing on every subsequent request).

- `captureWire(page, { urlSubstring, method? })` — generalised. Returns `{ records, reset, dispose }`. Bodies JSON-parsed when possible, fall back to raw string. ALWAYS call `dispose()` from a `try/finally`.
- `captureLastPost(page, urlSubstring)` — narrow shape mirroring batch F's `captureWirePost` but with `dispose()`. Returns `{ body(), dispose() }` — `body()` returns `null` until the first matching POST fires, then the most-recent POST body string.
- `capturePresetWire(page)` — convenience wrapper for `/api/db/_presets` (batch H's specialisation).

**Does not:** consume the response body. Use `page.waitForResponse(...)` for status / response-body assertions.

**Phase-2 add via RFC if you need:** response capture (`{ records: ResponseRecord[]; … }`), regex-URL match (`urlPattern: RegExp`).
