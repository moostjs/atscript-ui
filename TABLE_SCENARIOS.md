# Table E2E Scenarios

User-story coverage of the smart-table layer (`@atscript/ui-table` + `@atscript/vue-table`) as exercised through the `vue-demo` app. Each scenario walks a single user flow and lists the rendering + behavioural assertions that should hold at every step.

Scenarios assume the demo dev server is running on `http://localhost:3200`, the SQLite db has been freshly seeded (`pnpm --filter @atscript/vue-demo run db:setup`), and the user has signed in as `admin` / `demo-password` unless stated otherwise.

Server-injected latency for visible loading states: `/meta` and `/capabilities` ≈ **50 ms**, all other endpoints (queries, mutations, actions) ≈ **100 ms**.

---

## Conventions

- **Validation bullets** (`✓ …`) describe what must be true at the moment the step completes.
- **Network bullets** (`→ GET …`) describe HTTP traffic that must (or must not) fire.
- "1 query" means **exactly one** call to `/pages` (or `/query`) — no echo, no duplicate, no thrash. Most filter/state mutations flow through a 500 ms debounce; the assertion is "after the debounce window closes, ONE call fires." This contract is **assumed for every filter / sort / pagination mutation** in Sections 4–7; per-scenario re-statements are dropped to keep the prose lean. The dedicated regression for the URL-bridge encoder echo path lives in Scenario 6.4.
- Composite-PK identifiers are passed as `{field: value}` objects per moost-db invariant #11. `$1` substitution renders them as a `/`-joined string (raw form for prompts, URL-encoded for navigate).
- **Scenario numbers are stable.** Cleanup passes that delete a redundant scenario leave a numbering gap rather than renumber siblings, so cross-references like "see Scenario 8.17" stay valid across edits.

---

## Section 1 — Sign-in and navigation

### Scenario 1.1: Sign in and land on dashboard

**As a** demo admin
**I want** to authenticate and reach the dashboard
**So that** I can browse the demo tables

1. Open `/` while not authenticated.
   - ✓ Sign-in form renders (Username, Password, Sign In button).
2. Fill `admin` / `demo-password` and submit.
   - → POST `/api/auth/login`
   - ✓ Redirects to `/` (dashboard).
   - ✓ Sidebar shows "Signed in as **admin** (admin)".
   - ✓ Sidebar lists Users, Roles, Categories, Products, Customers, Orders, Cancelled orders, Audit Log.

### Scenario 1.2: Navigate between tables

1. Click sidebar `Users`.
   - ✓ URL becomes `/users`.
   - → GET `/api/db/tables/users/meta` (~50 ms)
   - → GET `/api/db/tables/users/pages?...` (~100 ms)
   - ✓ Page heading reads `Users`.
   - ✓ Loading skeleton during in-flight requests — see Scenario 12.1.
2. Click sidebar `Orders`.
   - ✓ URL `/orders`. New `/meta` + `/pages` round-trip fires (cached `/meta` is per-table).
   - ✓ Sidebar highlights `Orders` (active class), un-highlights `Users`.

---

## Section 2 — Cell rendering by type

### Scenario 2.1: Users table — every cell type

1. Visit `/users`.
2. Inspect column headers, in declared order.
   - ✓ Columns: `Id`, `Username`, `Email`, `Role`, `Status`, `MFA Enabled`, `First Name`, `Last Name`, `Last Login`, `Birthday`, `Password`, `Salt`, `Created`.
   - ✓ NO `Profile` column — `profile` is a flat-flattened parent (no `@db.json`); only its leaves (`First Name`, `Last Name`) become columns. Synthetic-parent JSON column is suppressed.
3. Inspect `admin` row cells.
   - ✓ `Id` numeric right-aligned tabular-nums (`as-cell-decimal`).
   - ✓ `Status` rendered as a coloured pill via the custom `@ui.table.type 'status'` renderer (green for `active`, red for `suspended`, yellow for `pending`/`invited`).
   - ✓ `MFA Enabled` shows `✗` for false, `✓` for true.
   - ✓ `First Name` / `Last Name` text cells (separate columns, NOT a JSON popup).
   - ✓ `Last Login` reads "5 minutes ago" (or similar) — relative cell with a `title` attribute carrying the ISO instant.
   - ✓ `Birthday` reads `Mar 14, 1985` — date-only (no `hh:mm`), because `@ui.table.type 'date'` overrides the `number.timestamp → datetime` inference.
   - ✓ `Created` reads `<Month> DD, YYYY, hh:mm AM/PM` — datetime cell.
4. Inspect `bob` row.
   - ✓ `Last Login` cell is empty (he has never logged in — null timestamp branch).
   - ✓ `Birthday` cell is empty (null `birthday` branch on the `date` cell).

### Scenario 2.2: Products — currency literal + unit + precision

1. Visit `/products`.
2. Inspect any row.
   - ✓ `Price` renders as `$19.99` style — locale-formatted currency via `@db.amount.currency 'USD'`.
   - ✓ `Weight` renders as `2.50 kg` — `@db.unit 'kg'` suffix, `@db.column.precision 6, 2` enforces two fraction digits.
   - ✓ `Tags` renders as a horizontal strip of chip pills (one per tag).

### Scenario 2.3: Tags chips — horizontal overflow, hidden scrollbar

1. On `/products`, find a row whose `Tags` array overflows the cell width.
   - ✓ Chips do NOT wrap to a second line.
   - ✓ Excess chips are reachable by horizontal scroll inside the cell.
   - ✓ Scrollbar is hidden (no visible scrollbar handle) — `scrollbar-width: none` + `::-webkit-scrollbar { height: 0 }`.

### Scenario 2.4: Orders — per-row currency via `@db.amount.currency.ref`

1. Visit `/orders`.
2. Inspect rows whose `Currency` column shows `USD`, `EUR`, `GBP`.
   - ✓ `Total` cell on a `USD` row reads `$42.00`.
   - ✓ `Total` cell on a `EUR` row reads `€42.50` (or locale equivalent).
   - ✓ `Total` cell on a `GBP` row reads `£95.00`.
   - ✓ Each row's currency comes from the sibling field named in `@db.amount.currency.ref 'currency'`.
3. Inspect `Lines` column.
   - ✓ Cell shows `{}` glyph and `[N]` count (`View 2 items`).
   - ✓ Click the cell button.
   - ✓ Popover opens with pretty-printed JSON `[{...}, {...}]` of the order line items.
   - ✓ Popover surface uses the `popup-card` styling (visible background, rounded corners, shadow).
4. Inspect `Status` column.
   - ✓ Coloured badge per status (green for `delivered`/`shipped`, yellow for `pending`/`processing`, red for `cancelled`). The badge is rendered via the named-component override `@ui.table.component 'status-badge'`, distinct from the `@ui.table.type 'status'` route used by Users.

### Scenario 2.5: Customers — `@db.json` opaque objects

1. Visit `/customers`.
2. Inspect `Address` and `Preferences` cells.
   - ✓ Each cell shows a `{}` glyph button.
   - ✓ Click — popover opens with pretty JSON of the whole sub-document.
   - ✓ Popover background is opaque (regression: `popup-card` styling, not transparent).

### Scenario 2.6: Audit Log — window-mode rendering

1. Visit `/audit_log`.
2. Inspect the table.
   - ✓ `<AsWindowTable>` is used (synthesised scrollbar, pool-based row recycling).
   - ✓ Initial fetch returns up to `limit: 100` rows.
   - ✓ Scrolling down past the loaded window triggers a follow-up fetch (block-aligned).
   - ✓ NO `Rows per page` pagination control (window mode disables paged UI).

---

## Section 3 — Schema-driven flags

### Scenario 3.1: Flat-flattened parents are not synthetic columns

1. Visit `/users`.
   - ✓ `Profile` column does NOT exist.
   - ✓ `First Name`, `Last Name` columns DO exist.
2. Open the column-config dialog (Columns toolbar button).
   - ✓ The selectable column list contains `First Name`, `Last Name` — not `Profile`.

### Scenario 3.2: `@db.json` columns are NOT filterable / sortable

1. Visit `/customers`.
2. Open the column-header menu on `Address`.
   - ✓ Sort options are absent (or disabled).
   - ✓ Filter option is absent (or disabled).
3. Open the Filters dialog from the toolbar.
   - ✓ The footer reads "0 of **4** filterable columns shown as filter pills" — out of 6 columns, `Address` and `Preferences` (both `@db.json`) are excluded; `Id`, `Name`, `Email`, `Created` remain.
4. Open the Sorters dialog.
   - ✓ Neither `Address` nor `Preferences` appear as available sort fields.

### Scenario 3.3: `@ui.table.type` overrides type inference

1. Visit `/users`.
   - ✓ `Birthday` (a `number.timestamp`) renders as date-only, NOT datetime — because `@ui.table.type 'date'` wins over the `timestamp` tag inference.
   - ✓ `Last Login` (also `number.timestamp`) renders as relative time — because `@ui.table.type 'relative'` wins.
   - ✓ `Created` (no override) renders as datetime — default inference.

---

## Section 4 — Filtering

### Scenario 4.1: Add a filter via the Filters dialog

1. Visit `/users`.
2. Click the toolbar `Filters` button.
   - ✓ Filters dialog opens.
   - ✓ Available column list excludes `Password`, `Salt` (both `@meta.sensitive`?) and any non-filterable cols.
3. Click `First Name` in the available list to add it as a pill, then click `Apply`.
   - ✓ Dialog closes.
   - ✓ A filter pill labelled `First Name` appears in the toolbar.
   - ✓ NO query has fired yet — adding a pill does not start filtering until a value is entered.
4. Type `bob` into the pill input and press `Enter`.
   - ✓ After the 500 ms debounce window: → GET `/api/db/tables/users/pages?profile.firstName~='/bob/i'&...`
   - ✓ **Exactly one** `/pages` call fires (per the Conventions baseline; regression at 6.4).
   - ✓ Table rebuilds with rows whose `First Name` contains `bob` case-insensitively.

### Scenario 4.2: Filter pills shown by the Standard preset

1. Visit `/users`.
   - ✓ Filter pills `Status`, `Role` render in the toolbar by default (per the demo's Standard system-preset content `filters: ['status', 'roleId']`).
   - ✓ Each pill is empty-valued; no pre-applied filter; no query has been narrowed.
2. Visit `/orders`.
   - ✓ Filter pills `Customer`, `Status` render by default (Standard `filters: ['customerId', 'status']`).
3. Visit `/products`.
   - ✓ Filter pill `Category` renders by default (Standard `filters: ['categoryId']`).
4. Visit `/customers`.
   - ✓ No pills render — customers ships no `systemPresets`, so the empty Standard expands to factory defaults.

### Scenario 4.3: Operator coverage

For each operator below, confirm the operator appears in the per-pill operator picker (or column-menu submenu) for an appropriate column type, and applying it sends the right Uniquery shape to `/pages`.

| Op                            | Where to test                                           | URL fragment                  |
| ----------------------------- | ------------------------------------------------------- | ----------------------------- |
| `eq`                          | `/users` Status pill, pick `active`                     | `status='active'`             |
| `ne`                          | `/users` Status pill, switch to "is not", pick `active` | `status!='active'`            |
| `contains` (default for text) | `/users` First Name = `bob`                             | `profile.firstName~='/bob/i'` |
| `starts`                      | `/users` Username starts with `ad`                      | `username~='/^ad/i'`          |
| `ends`                        | `/users` Email ends with `@demo.test`                   | `email~='/@demo.test$/i'`     |
| `gt` / `gte` / `lt` / `lte`   | `/orders` Total > 50                                    | `total>'50'`                  |
| `bw` (between)                | `/orders` Total between 50 and 100                      | `total>='50'&total<='100'`    |
| `null`                        | `/users` Last Login is null                             | `lastLoginAt='null'`          |
| `notNull`                     | `/users` Birthday is not null                           | `birthday!='null'`            |
| `regex`                       | `/users` Username regex `/^[abm]/`                      | `username~='/^[abm]/'`        |

For each:

- ✓ Single `/pages` call fires (debounced).
- ✓ Result rows match the filter semantics.
- ✓ Empty-result branch is reachable by impossible filters (e.g. `Username = zzzzzz`) — table renders an empty-state message instead of throwing.

### Scenario 4.4: Null/Not-null on a real nullable column

1. Visit `/users` with default seed (admin, manager, viewer, alice, bob).
2. Add a filter for `Birthday`, operator `is null`.
   - ✓ Result rows: `viewer` and `bob` (the two without birthdays).
3. Switch the same pill to `is not null`.
   - ✓ Result rows: `admin`, `manager`, `alice`.
4. Apply to `Last Login`, operator `is null`.
   - ✓ Result rows: just `bob` (never logged in).

### Scenario 4.5: Forced (sticky) filter via `forceFilters`

1. Visit `/orders-cancelled`.
   - → GET `/meta` for `orders` (note: `apiPath: 'orders'`).
   - → GET `/pages?status='cancelled'` — server-side forced filter applied.
   - ✓ Page heading reads `Cancelled orders`.
   - ✓ Every visible row has `Status = cancelled`.
2. Try to remove or change the `status` filter.
   - ✓ There is NO UI surface to do so — `forceFilters` is server-only and not represented in `state.filters` or any pill.
3. Add a user-side filter (e.g. `Total > 100`).
   - → GET `/pages?status='cancelled'&total>'100'` — user filter ANDs with the forced one.

### Scenario 4.6: Removing a chip clears its predicate

1. With a `Status = shipped` filter applied on `/orders`.
2. Click the chip's `×` button.
   - ✓ Chip is removed; the filter field stays in the toolbar (display state
     is independent of applied state — see Scenario 4.7 for the field-removal path).
   - ✓ After debounce: → GET `/pages` with no `status` predicate — full result restored.
   - ✓ `state.filters` no longer has the `status` entry.

Note: filter fields themselves have no `×` / close affordance. They stay in the toolbar until removed via the Filters dialog (Scenario 4.7) or replaced by a preset.

### Scenario 4.7: `filterFields` (display) vs `filters` (applied) are independent

1. Add `Status = active` via the Filters dialog.
2. Open the dialog again, uncheck `Status`, click `Apply`.
   - ✓ Pill is removed from the toolbar.
   - ✓ But the filter VALUE is preserved internally (the dialog only mutates `filterFields`, never `filters` — display vs applied state are independent).
   - ✓ Re-checking `Status` and re-applying restores the same `active` value with no extra typing.

### Scenario 4.8: Per-column filter dialog — `Values` + `Conditions` tabs

The per-column filter dialog (`AsFilterDialog`) opens when the user clicks a column-header filter affordance, the F4 key inside a pill, or the "Open filter dialog" button on a pill. For columns with value help (FK or union/enum), the dialog shows two tabs:

- **Values** — chip-list selector backed by `AsFilterValueHelp` (FK rows from related table OR static enum options).
- **Conditions** — operator-driven entries (`AsFilterConditions`) for ad-hoc operators that don't map to a single value (`contains`, `bw`, `null`, `notNull`, `regex`, etc.).

Both tabs feed independent state arrays — `valueHelpConditions` + `freeConditions` — that the dialog merges on Apply. The combined filter is the union of both.

For columns without value help (plain text, number, date), only the conditions UI is rendered (no tabs). See Scenario 4.11.

1. On `/orders`, open the filter dialog for the `Customer` column (F4 inside the pill, or click the column-header filter glyph).
   - ✓ Header reads `Customer` (the column label).
   - ✓ Two tabs visible: `Values` (active by default) and `Conditions`.
   - ✓ Both tab triggers show a count badge — `0` initially.

### Scenario 4.9: Value-help — FK column (`Customer`)

Customers has `@db.index.fulltext`, so its FK value-help is searchable.

1. Continue from 4.8 with the dialog open on `Customer`.
2. The `Values` tab body renders an inline window-table of customer rows.
   - → GET `/api/db/tables/customers/meta` and `/api/db/tables/customers/pages` for the inner table.
   - ✓ Search input visible (because the inner table is searchable).
   - ✓ A few rows pre-loaded (e.g. first window of 50/100).
   - ✓ Header columns clamped to value-help whitelist (e.g. `id`, `name`, `email` — not every customer column).
3. Type `alice` in the value-help search box.
   - → Single (debounced) `/pages?$search=alice` to the customers endpoint.
   - ✓ List filters to matching rows.
4. Click a row to select it.
   - ✓ Row gains `data-state="checked"`.
   - ✓ A chip appears in the chips strip above the list with the row's display label.
   - ✓ `Values` tab badge increments to `1`.
5. Click the same row again to deselect.
   - ✓ Row uncheck; chip removed; badge `0`.
6. Re-select.
7. Clear search; scroll the value-help list past the loaded window.
   - → Next-window fetch fires (block-aligned). New rows append; chip from step 6 stays.
8. Switch to the `Conditions` tab (header).
   - ✓ List/chip view replaced by the conditions composer.
   - ✓ Dialog headline still names the same column.
9. Add a `contains` condition with value `acme` (or pick `is null` if the column allows).
   - ✓ `Conditions` tab badge increments.
10. Switch back to the `Values` tab.
    - ✓ The chip from step 6 is still selected (state preserved across tab switches).
11. Click `Apply`.
    - ✓ Dialog closes.
    - ✓ The toolbar pill summary reflects BOTH tabs' contributions (e.g. "1 selection + 1 condition" — exact wording is implementation; the assertion is "non-zero count from each tab is represented").
    - → Single `/pages` query whose Uniquery filter expression is the union/AND of both contributions.

### Scenario 4.10: Value-help — union/enum column (`Status`)

Status is a static literal union — no inner FK table; options come from the schema. Search box is shown only when the static table-def declares `searchable`.

1. On `/users`, open the filter dialog for the `Status` column.
   - ✓ Two tabs: `Values` and `Conditions`.
   - ✓ NO inner-table HTTP fetch — options are static (no `/pages` to a related endpoint).
   - ✓ Rows in the Values tab list the four enum literals: `active`, `suspended`, `pending`, `invited`.
   - ✓ Search input visible only if `searchable: true` is set on the static table-def — otherwise absent.
2. (If searchable.) Type `su` in search.
   - ✓ List narrows to `suspended`.
3. Clear search. Click `active` and `pending` to select both.
   - ✓ Two chips in the strip; tab badge `2`.
4. Switch to `Conditions` tab. Add `is not 'invited'` (operator: `ne`, value: `invited`).
   - ✓ Tab badge increments.
5. Apply.
   - → Single `/pages` with combined filter.
   - ✓ Result rows: any user with status `active` OR `pending` AND status NOT `invited` (the exact set semantics depend on the merge — assertion: result honours both contributions).

### Scenario 4.11: Conditions tab only — text / number / date / boolean / nullable

For non-value-help columns the dialog renders the conditions composer directly (no tabs).

For each row below, open the filter dialog on the named column and confirm:

- ✓ The operator picker exposes the listed operators (no others).
- ✓ The value input matches the column's data type.
- ✓ Applying produces the expected wire shape.

| Column (table)        | Type              | Operators in picker                                         | Value input                     |
| --------------------- | ----------------- | ----------------------------------------------------------- | ------------------------------- |
| `username` (users)    | text              | `contains` (default), `starts`, `ends`, `eq`, `ne`, `regex` | text input                      |
| `email` (users)       | text              | same as above                                               | text input                      |
| `total` (orders)      | number/decimal    | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `bw`                  | number input(s); `bw` shows two |
| `weight` (products)   | number/decimal    | same as `total`                                             | number input(s)                 |
| `createdAt` (any)     | datetime          | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `bw`                  | date-time picker                |
| `birthday` (users)    | date              | same as datetime                                            | date picker (no time)           |
| `mfaEnabled` (users)  | boolean           | `eq`                                                        | toggle (true/false)             |
| `lastLoginAt` (users) | nullable datetime | datetime ops + `null`, `notNull`                            | none for null/notNull           |
| `birthday` (users)    | nullable date     | date ops + `null`, `notNull`                                | none for null/notNull           |

For each, also confirm:

- ✓ Single `/pages` call after the 500 ms debounce (Conventions baseline; regression at 6.4).

### Scenario 4.12: Pill-input fast path (no dialog)

The toolbar pill input accepts a default-operator value without opening the dialog (`contains` for text, `eq` for FK / enum / number, etc.).

1. On `/users`, click into the `Status` pill input.
2. Pick `active` from the inline dropdown (no dialog needed).
   - → Single `/pages?status='active'` after debounce.
3. Click the `Open filter dialog` icon next to the pill.
   - ✓ Dialog opens with `Values` tab pre-populated showing `active` selected.

### Scenario 4.13: Pill-input special prefix / wildcard syntax

When the user types a string into a free-text pill input, the parser
([`parseFilterInput`](packages/ui-table/src/filters/filter-input-format.ts))
maps prefixes / wrappers to the underlying operator without forcing the
user to open the dialog. Each format below should be tested on a column
where the chosen operator is in `conditionsForType(columnType)` — invalid
combos (e.g. `>=foo` on a text column) parse to `undefined` and the input
clears with no filter applied.

| Typed input   | Operator         | Notes                                                      |
| ------------- | ---------------- | ---------------------------------------------------------- |
| `*bob*`       | `contains`       | text/enum/ref                                              |
| `bob*`        | `starts`         | text                                                       |
| `*bob`        | `ends`           | text                                                       |
| `=acme`       | `eq` (explicit)  | any                                                        |
| `!=cancelled` | `ne`             | any with ne available                                      |
| `>=10`        | `gte`            | number / date                                              |
| `>10`         | `gt`             | number / date                                              |
| `<=100`       | `lte`            | number / date                                              |
| `<5`          | `lt`             | number / date                                              |
| `10...20`     | `bw` (between)   | number / date / text — split on first `...`                |
| `<empty>`     | `null`           | case-insensitive; only on nullable cols                    |
| `!<empty>`    | `notNull`        | case-insensitive                                           |
| `/^[A-Z]/`    | `regex`          | text only                                                  |
| `acme`        | default per type | `contains` for text/enum/ref, `eq` for number/date/boolean |

For each row:

1. Click into the relevant pill input.
2. Type the format, press Enter (or wait for debounce).
   - ✓ Pill chip displays the parsed condition in canonical form.
   - → Single `/pages` request fires after the 500 ms debounce.
   - ✓ Result rows match the expected operator semantics.
3. For an INVALID combo (e.g. `>foo` on text — `gt` not in text's conditions):
   - ✓ Pill shows no chip; nothing applied.
   - → NO request fires.

Also confirm `formatFilterCondition` round-trips: applying a parsed condition then re-rendering the pill produces the same input text.

### Scenario 4.14: Filter pill hotkeys

The pill input is a focusable text input. While focused:

| Key                 | Behaviour                                                            |
| ------------------- | -------------------------------------------------------------------- |
| `Enter`             | Commit the current input as a filter (parse via Scenario 4.13).      |
| `Escape`            | Clear the input (and revert any uncommitted typing).                 |
| `F4`                | Open the per-column filter dialog (`AsFilterDialog`) on this column. |
| `Tab` / `Shift+Tab` | Move focus to the next / previous filter pill input.                 |

For each:

1. Focus the `Customer` pill input on `/orders`. Type `2`.
2. Press `F4`.
   - ✓ Filter dialog opens for the `Customer` column.
   - ✓ The dialog title reads `Customer`.
3. Close the dialog (Esc or Cancel).
4. Press `Tab` repeatedly with no modifiers.
   - ✓ Focus moves through the visible filter pills in toolbar order, then to the next focusable element.
5. Press `Enter` with text `2` in the input.
   - → Single `/pages?customer~='2'` after debounce.
6. Press `Escape`.
   - ✓ Input clears; previously committed chip stays.

The "Open filter dialog (F4)" affordance also renders as a button next to the input — clicking it must do the same thing the F4 keypress does.

### Scenario 4.15: Pill input dropdown — value-help (FK + union)

For columns with value help (FK or union), focusing the pill input opens an inline dropdown (the same `AsFilterValueHelp` body without a wrapping dialog). Inner behaviour — search, select / deselect, multi-page scroll — matches the `Values` tab from Scenarios 4.9 (FK) and 4.10 (enum). Only the inline-specific deltas below need separate coverage.

1. On `/orders`, click into the `Customer` pill input (FK).
   - ✓ Dropdown opens below the input — no wrapping dialog, no tab chrome.
   - → Single `/api/db/tables/customers/meta` + single `/api/db/tables/customers/pages` for the dropdown's first window.
2. Apply a selection, then close the dropdown (click outside / Escape).
   - ✓ Dropdown closes; selections persist in the pill state.
3. Re-open the dropdown.
   - → NO refetch — the inner-table state survives a close/open cycle (per-pill cache).
4. Click into the `Status` pill (union/enum).
   - → ZERO HTTP requests for the dropdown — options come from schema literals.

**No-redundant-calls assertion**: across the whole walk, the customers endpoint fires exactly **one `/meta`** + one `/pages` per fresh inner-table mount, plus one `/pages` per typed search keyword (debounced). Static enums fire **zero** HTTP requests for the dropdown itself.

### Scenario 4.16: Chip strip — remove, scroll, Backspace, Clear

The pill input renders applied conditions as a horizontal chip strip embedded in the field. Each chip carries an `×` (remove) button; the strip itself is horizontally scrollable when chips overflow the available width; Backspace in an empty input pops the last filled chip; the value-help dropdown exposes a `Clear all` action when at least one selection exists; and the field surfaces a `Reset` button when any chip is present.

#### Removing a single chip

1. On `/users`, focus the `Status` pill input. Select `active` and `pending` from the dropdown.
   - ✓ Two chips appear inside the input field — labels read `active` and `pending`.
   - ✓ Each chip has a visible `×` (`as-filter-field-chip-remove`) button.
2. Click the `×` on the `active` chip.
   - ✓ Only `active` chip removed; `pending` chip stays.
   - → Single `/pages?status='pending'` after debounce.
   - ✓ `state.filters.users.status` array now has exactly one filled condition.
3. Click the `×` on the remaining `pending` chip.
   - ✓ Last chip removed.
   - ✓ Pill is now empty (no chips).
   - → Single `/pages` with NO `status` predicate.
   - ✓ `state.filters` no longer has a `status` entry — `removeFieldFilter` collapsed it because the remaining-after-remove list had no `isFilled` items.

#### Scrollable chip strip (overflow)

1. On `/orders`, focus the `Status` pill input. Select `active`, `pending`, `processing`, `shipped`, `delivered`, `cancelled` (or as many as available).
   - ✓ Chip strip width is constrained to the pill width; chips overflow horizontally.
   - ✓ `chipsScrollEl` (the chip-strip container) has `scrollWidth > clientWidth`.
   - ✓ The text input is positioned AFTER the chips — focusing it scrolls the strip to its end (`scrollChipsToEnd` runs on focus).
2. Drag (or shift-scroll) horizontally inside the chip strip.
   - ✓ Chips off-screen come into view.
   - ✓ Strip's scrollbar handle is hidden (consistent with `as-cell-chips` styling) — overflow is reachable but the visual gutter is suppressed.
3. Add another chip via the dropdown.
   - ✓ Strip auto-scrolls to the end (a watcher on `chips.length` triggers `scrollChipsToEnd` when length grew).

#### Backspace in empty input pops chips

1. With several chips applied, focus the input. Make sure the input text is **empty** (`searchTerm === ""`).
2. Press `Backspace`.
   - ✓ The LAST filled chip pops off the strip.
   - → Single `/pages` with that chip's predicate removed.
   - ✓ Other chips remain in their original order.
3. Press `Backspace` repeatedly.
   - ✓ Each press pops one more chip from the end (LIFO).
4. After all filled chips are gone, press `Backspace` once more.
   - ✓ NO state change — the handler short-circuits when `existing.filter(isFilled).length === 0`.
   - → NO HTTP fires.
5. Type `a` into the input. Press `Backspace`.
   - ✓ The character is deleted (standard input behaviour); chips are NOT touched. `onBackspace` short-circuits when `searchTerm.value !== ""`.
6. Now with `searchTerm` non-empty AND chips present, press `Backspace` until the input becomes empty. The next `Backspace` pops a chip.
   - ✓ The transition is clean — there's no "off by one" where the same keypress both clears the last char AND pops a chip.

#### `Clear all` in the value-help dropdown

Available on FK columns when the inner table is searchable AND has filterable fields (toolbar shows the Clear-all action button next to the count).

1. With a few selections in the `Customer` pill, focus the input to re-open the dropdown.
   - ✓ Toolbar of the dropdown shows a "Clear all" button (next to the count chip / filter toggle).
2. Click `Clear all`.
   - ✓ All selected rows in the dropdown un-check.
   - ✓ All chips on the pill disappear in one go.
   - → Single `/pages` (or no call at all if the pill state collapse takes the field out of `filters` and the watcher sees no diff worth refetching).

#### `Reset` button on the field

1. With one or more chips in any pill, look at the pill's footer / inline actions.
   - ✓ A `Reset` button is visible (only when `chips.length > 0`).
2. Click `Reset`.
   - ✓ Calls `clearAll` → `state.removeFieldFilter(column.path)`.
   - ✓ All chips removed for THIS column (other columns' chips untouched).
   - → Single `/pages` with this column's predicate dropped.
3. With NO chips, the `Reset` button is absent.

#### Combined regression — chip operations don't double-query

Across all of the above (remove single chip, remove via Backspace, Clear all, Reset), each user action that mutates `state.filters` produces exactly **one** `/pages` after the 500 ms debounce — never two. This is the same echo-guard contract from Scenario 6.4.

---

## Section 5 — Table Settings dialog (Columns / Filters / Sorters tabs)

The toolbar's `Columns`, `Filters`, and `Sorters` buttons all open the same `<AsConfigDialog>` — a single dialog with three tabs that manages **display state** for each surface. The Filters tab manages WHICH filter pills are shown in the toolbar (not their values); the Sorters tab manages active sorters; the Columns tab manages visible columns. The contract that matters most: **only changes that affect the wire query trigger a re-fetch**. Display-only mutations (e.g. column reorder, pill add/remove with no value) do not.

### Scenario 5.1: Three-tab layout

1. Visit any table; click the toolbar `Columns` button.
   - ✓ Dialog opens, title `Table Settings`.
   - ✓ Three tab triggers in order: `Columns`, `Filters`, `Sorters`. Each carries an `as-config-tab-icon` glyph + count badge.
   - ✓ Active tab is `Columns` (because the user clicked that toolbar button).
   - ✓ Count badges reflect current state — e.g. `Columns 13`, `Filters 0`, `Sorters 0` on initial visit.
2. Click the toolbar `Filters` button.
   - ✓ Same dialog opens with `Filters` tab active.
3. Click the toolbar `Sorters` button.
   - ✓ Same dialog opens with `Sorters` tab active.
4. Click each tab header inside the dialog to switch.
   - ✓ Active tab highlights; content swaps.
   - → NO `/pages` call fires from tab switching alone.

### Scenario 5.2: Each tab has search + reorder + select/unselect

The list inside each tab is `AsFieldsSelector` — a draggable, checkable, searchable list.

1. On the `Columns` tab, type a substring in the search input (e.g. `email`).
   - ✓ List filters to matching column labels.
   - ✓ Drag handles still work on the filtered subset.
   - ✓ NO HTTP traffic.
2. Clear search.
3. Drag a column row to a different position.
   - ✓ Visual reorder applies inside the dialog (pending state).
   - → No query yet — pending until Apply.
4. Toggle the checkbox on a column row.
   - ✓ Row checked/unchecked reflects in the list.
   - → Still no query.
5. Repeat the same checks on the `Filters` and `Sorters` tabs (each is the same selector against its own model).

### Scenario 5.3: Apply — only query-affecting changes trigger a query

This is the load-bearing assertion. Display-only changes (reorder, pill toggle without value) must not trigger a fetch; query-shape changes (visible-column set, sorter add/remove, sorter reorder) must.

For each row, open the dialog, make the listed change, click `Apply`, and check whether `/pages` fires.

| Change                                   | Tab     | Triggers `/pages`? | Why                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reorder columns (same set)               | Columns | **NO**             | Visible-column set unchanged; `$select` stable. The `sameColumnSet` watcher in `use-table-state` short-circuits.                                                                                                                                                |
| Hide a column (uncheck)                  | Columns | **YES**            | `$select` shrinks.                                                                                                                                                                                                                                              |
| Show a previously hidden column (check)  | Columns | **YES**            | `$select` widens; new field needed.                                                                                                                                                                                                                             |
| Add a filter pill (no value entered yet) | Filters | **NO**             | Adds the pill to `filterFields` (display state); `filters` map untouched.                                                                                                                                                                                       |
| Remove a filter pill that had a value    | Filters | **YES**            | The pill's value WAS in `filters`; removal would clear it ONLY via the explicit "remove value" affordance. Adding/removing the pill alone does NOT clear values (Scenario 4.7) — but this row applies when the user explicitly clears the value via the dialog. |
| Reorder filter pills                     | Filters | **NO**             | `filterFields` array order is display only; `filters` map keys are unordered.                                                                                                                                                                                   |
| Add a sorter                             | Sorters | **YES**            | `$sort` gains a new field.                                                                                                                                                                                                                                      |
| Remove a sorter                          | Sorters | **YES**            | `$sort` shrinks.                                                                                                                                                                                                                                                |
| Reorder sorters (priority swap)          | Sorters | **YES**            | `$sort` field order reflects priority — order matters.                                                                                                                                                                                                          |

For each row, after Apply:

- ✓ Dialog closes.
- ✓ Visual state updates (column order, pills shown, sort glyphs).
- → Exactly the documented `/pages` behaviour (one call after the 500 ms debounce, or none at all).

### Scenario 5.4: Cancel discards pending changes

1. Open the dialog. Reorder columns + hide one column + add a sorter.
2. Click `Cancel` (or close via Esc / overlay).
   - ✓ Dialog closes.
   - ✓ Table column order unchanged; visible columns unchanged; sorters unchanged.
   - → NO `/pages` fires.

### Scenario 5.5: Tab badges update live as user mutates inside

1. Open the dialog on the `Filters` tab.
   - ✓ Badge reads the current `filterFields.length`.
2. Toggle a few rows on the `Filters` tab (without leaving).
   - ✓ Badge increments / decrements live as each row toggles.
3. Switch to `Sorters`, add one.
   - ✓ Sorters badge increments live.
4. Cancel.
   - ✓ Badges next time the dialog opens reflect committed state, not the discarded preview.

---

## Section 6 — URL bridge

**Wire-format note:** `@uniqu/url`'s `serializeValue` emits values unquoted unless they carry reserved chars / leading-digit / null/true/false-lookalikes — so plain alphabetic values like `shipped` round-trip as `status=shipped`, not `status='shipped'`. Numeric values default to `eq` and emit as bare keys (`customerId=2`). The `/pages` endpoint paginates via `$page=N&$size=M` (1-based), NOT `$skip`/`$limit` — those are the `/query` endpoint's encoding. Both `$page`/`$size` and `$skip`/`$limit` sit in the same `urlQuerySync.pagination` aspect gate.

### Scenario 6.1: Direct deep-link load — single fetch

1. Open a fresh tab to `http://localhost:3200/orders?customerId=2`.
   - → GET `/api/db/tables/orders/meta`
   - → GET `/api/db/tables/orders/pages?customerId=2&...` — composed from URL hydration + initial query, **not two separate fetches**.
   - ✓ Filter pill `Customer = 2` is pre-populated.
   - ✓ Result rows all have `Customer = 2`.

### Scenario 6.2: Outbound URL emit on filter change

1. Visit `/orders` (no query string).
2. Add a `Status = shipped` filter.
   - ✓ After debounce, browser URL becomes `/orders?status=shipped`.
   - ✓ History updates via `router.replace` (no new entry — back button doesn't hop through every keystroke; `history.length` is unchanged).
3. Switch tabs, paste `/orders?status=shipped` in another tab.
   - ✓ Recipient sees the same filtered view in a single fetch (Scenario 6.1 contract).

### Scenario 6.3: `urlQuerySync` allowlist (orders)

`/orders` declares `urlQuerySync: { pagination: false, filters: ['status', 'customerId'] }`. So:

1. Apply a `Status = shipped` filter.
   - ✓ URL contains `status=shipped` (allowlisted).
2. Add a `Total > 100` filter as well.
   - ✓ URL still ONLY shows `status=shipped` — `total` is not in the allowlist; it's applied locally but not shareable.
   - ✓ The Total filter IS active (result rows reflect it); just its presence is private to the linker.
3. Sort by `Total`.
   - ✓ URL gains `$sort=-total` (sorters NOT gated, so they round-trip).
4. Click page 2.
   - ✓ Wire `/pages?` carries `$page=2&$size=...` for the next-page fetch.
   - ✓ URL bar does NOT gain `$page` / `$size` (pagination off — recipient lands on page 1).

### Scenario 6.4: URL bridge echo — no spurious refetch

This is the regression caught earlier in this session: `URLSearchParams` re-encodes operator chars (`~`, `'`, `/`) that `buildUrl` from `@uniqu/url` emits raw, so the round-trip URL string differs byte-wise from `lastEmittedUrl`. The echo guard must compare on decoded form.

1. Visit `/users`.
2. Add filter `First Name contains bob` and press Enter.
   - ✓ **Exactly one** `/pages` call fires (after the 500 ms debounce).
   - ✓ NO immediate `/pages` call before the debounce — that would mean `applyUrlQuery`'s `nextTick` scheduleQuery fired, indicating echo guard miss.
3. Repeat with deep-nested + regex chars: `Email contains @demo.test`.
   - ✓ Single query.

### Scenario 6.5: `urlQuerySync.sorters: false` (users)

`/users` declares `urlQuerySync: { sorters: false }`.

1. Visit `/users`.
2. Open the column-header menu on `Username` (a `@db.index.unique` field — sortable on the wire) and pick `Descending`.
   - ✓ Table re-orders.
   - ✓ Wire `/pages?` carries `$sort=-username`.
   - ✓ URL bar does NOT contain `$sort` — sorters are private.
3. Apply a filter.
   - ✓ URL contains the filter (filters are NOT gated — they round-trip).

### Scenario 6.6: Filter operator change updates URL

Each filter mutation — adding a chip, changing an operator on an existing chip, removing a chip — re-emits the URL. Operator-flip on an enum (Values-tab pick) requires removing the existing chip first, then switching to the Conditions tab to set the new operator and re-applying — the per-column dialog doesn't expose an in-place operator switch on a Values-picked chip.

1. On `/orders`, apply `Status = shipped`.
   - ✓ URL: `?status=shipped`.
2. Open the per-column filter dialog on `Status`, remove the existing chip, switch to the `Conditions` tab, set operator to `is not`, value `shipped`, Apply.
   - ✓ URL becomes `?status!=shipped`.
   - → Single `/pages` for the new operator.
3. Open the dialog again, repeat the flip back to `is`.
   - ✓ URL flips back to `?status=shipped`.
4. Add a `Customer = 2` filter.
   - ✓ URL becomes `?status=shipped&customerId=2`.
5. Remove the `Status` chip.
   - ✓ URL becomes `?customerId=2`.
6. Throughout, no duplicate `/pages` calls fire.

### Scenario 6.7: Copy URL + paste in new tab — full state recovery

The end-to-end shareability assertion. Anything in the URL must restore in a fresh tab. **Note:** `/orders` is not full-text-searchable (no `@db.index.fulltext` on its schema), so `$search` is not part of this scenario — only filters + sort + pagination round-trip on /orders.

1. On `/orders`, build a non-trivial state:
   - Filter `Status = shipped`
   - Filter `Customer = 2`
   - Sort `Total` desc
2. Read `location.href` from the browser bar.
   - ✓ URL contains `status=shipped`, `customerId=2`, `$sort=-total`.
   - ✓ URL does NOT contain `$page` / `$size` (orders has `pagination: false`) or any filter on un-allowlisted columns (Scenario 6.3).
3. Open a fresh context (`browser.newContext({ storageState: authFileFor('admin') })` reuses auth without sharing the linker's history) and navigate to the captured URL.
   - → GET `/api/db/tables/orders/meta`
   - → ONE `/pages` call carrying all three restored aspects.
   - ✓ Filter pills `Status`, `Customer` pre-populated with the values; `Status` chip renders `shipped`, `Customer` chip renders `2`.
   - ✓ Header `Total` shows the desc-sort indicator.
   - ✓ Result rows match the combined predicate.
4. Verify the recipient's URL matches the linker's exactly (no decode/encode mismatch over the round-trip).

---

## Section 7 — Sorting

### Scenario 7.1: Single-column sort cycle

`atscript-db`'s default sortable mode reports `sortable: false` for columns without a database index (`!!fd.isIndexed` gate at `as-db-readable.controller.ts:764`), so the column under test must carry `@db.index.*`. `orders.total` declares `@db.index.plain 'orders_total_idx'`.

1. On `/orders`, open the column-header menu on `Total` and pick `Ascending`.
   - ✓ Asc indicator appears next to `Total`.
   - → Single `/pages` call with `$sort=+total` (or bare `$sort=total` — `@uniqu/url`'s `buildUrl` only signs `desc` deterministically).
   - ✓ Rows ordered by `total` ascending (string-decimal-aware order — `'9.00'` < `'42.00'` etc., assuming server sorts as decimal not string).
2. Open the menu again, pick `Descending`.
   - ✓ Indicator flips to desc, single `/pages` with `$sort=-total`.
3. Open the menu, pick `Descending` again — `emitSort('desc')` matches the current `props.order === 'desc'` and emits `null`, clearing the sorter (no separate "Clear sort" affordance).
   - ✓ Sort cleared, single `/pages` with no `$sort`.

### Scenario 7.2: Sortable=false columns can't be sorted

`@db.json` columns force `sortable=false` (Scenario 3.2). Verify by clicking the `Address` column header on `/customers` — no sort indicator appears, no `/pages` call fires.

### Scenario 7.3: Multi-sort via Sorters dialog

1. Visit `/users`.
2. Open Sorters dialog, add `Status` desc + `Username` asc, apply.
   - → Single `/pages` with `$sort=-status,username` (regex-tolerant: `@uniqu/url`'s `buildUrl` may emit either `+username` or bare `username` — only `desc` carries a deterministic `-` prefix).
   - ✓ Rows grouped by status (descending — `suspended` first, then `pending`, `active`, `invited`), within each group ascending by username.

---

## Section 8 — Actions

### Scenario 8.1: Default row action via dblclick / Enter

Covered by Scenario 8.17 (default action interaction with row main-action), which walks both the users `edit` default and the customers `view-orders` default.

### Scenario 8.2: Navigate action with `$1` substitution

1. Visit `/customers`.
2. Open the row action menu on a customer row (or click "View orders" if rendered inline).
   - ✓ Menu shows a single "View orders" entry (label-only, no icon — exercises the text-only render path).
3. Click `View orders`.
   - ✓ Navigates to `/orders?customerId=<that customer's id>`.
   - ✓ Orders table loads, filtered to that customer (single fetch via Scenario 6.1).

### Scenario 8.3: Custom row action — clipboard via `@action` event

1. Visit `/users`.
2. Open the row action menu on `admin`.
   - ✓ Menu lists `Edit`, `Copy invite link`, `Delete`, `Suspend`, etc.
3. Click `Copy invite link`.
   - ✓ NO server request fires (`processor: 'custom'`).
   - ✓ Clipboard contains `http://localhost:3200/invite/admin`.
   - ✓ A toast appears: `Copied invite link for admin`.

### Scenario 8.4: Custom table action — Export CSV

1. On `/users`, click toolbar `Export CSV` (table-level custom action).
   - ✓ NO `/actions/...` server hit on the action-name path.
   - → GET `/pages?$limit=5000` (the demo's CSV exporter pulls up to 5000 rows).
   - ✓ A `users-<timestamp>.csv` file downloads.
   - ✓ A toast appears: `Exporting users (all rows)…`.
2. Toggle multi-select, select 2 rows, click `Export CSV` again.
   - ✓ `Exporting users (2 rows)…` toast.
   - ✓ CSV contains only the 2 selected rows.

### Scenario 8.5: Backend action with `@InputForm` (form is the confirm surface)

When an action declares `@InputForm`, `triggerAction` (`packages/vue-table/src/composables/state/intent-scope.ts:208-224`) short-circuits the prompt path — `confirmAction()` is never called and `promptText` is ignored. The form dialog IS the confirm surface; its title / submit-text / description copy is sourced from the form schema's `@meta.label` / `@ui.form.submit.text` (and any `description` field on the form). `promptText` is mutually exclusive with `@InputForm` and only fires for actions that have no form (canonical `confirmAction` flow).

1. On `/users`, ensure multi-select is on.
2. Select `manager` and `alice` (both `active`).
3. Click toolbar `Suspend`.
   - ✓ NO confirmation modal — `triggerAction` skips `confirmAction()` because `action.inputForm` is set, so the `promptText: [singular, plural]` tuple on the action is never read.
   - ✓ The `@InputForm(SuspendUsersInput)` form dialog opens directly (reason textarea, `notifyUser` checkbox).
   - ✓ Dialog title reflects the form schema's `@meta.label` (e.g. `Suspend users`); submit button label reflects the schema's submit text.
4. Type `policy review` in the reason field, leave `notifyUser` checked, click Confirm.
   - → POST `/api/db/tables/users/actions/suspend` with `{ ids: [{username:'manager'}, {username:'alice'}], input: { reason: 'policy review', notifyUser: true } }`.
   - ✓ Server returns `{ ok: true, message: 'Suspended 2 users: policy review. They were notified by email.' }`.
   - ✓ Toast renders that message (green/positive intent).
   - ✓ Table refetches automatically (`refresh-on-action` default true). After refresh, both rows show `Status = suspended`.

### Scenario 8.6: Action gate via `disabled` predicate

End-to-end invocation of a gated action. Gate semantics live in Scenario 8.7.

1. On `/users`, find a `pending` user (e.g. `bob`). Open its row action menu.
   - ✓ `Activate` IS available (predicate `disabled: perRow((u) => u.status === 'active')` returns false for non-active rows).
2. Click `Activate`.
   - → POST `.../actions/activate`
   - ✓ Toast: `User bob activated`.
   - ✓ Row refetches, `Status` flips to `active`.

### Scenario 8.7: Per-row `$actions` evaluation (canonical gate semantics)

When the row-actions column is mounted, the table sends `?$actions=true`. For every action present in `/meta.actions[]` (i.e. the role HAS permission to invoke it — see 8.10), the server runs each action's `disabled: perRow(...)` predicate against that row's projected fields (union of `requiredFields` across gated actions) and emits each row's `$actions: string[]` as the names that are NOT disabled. The client menu filters accordingly.

1. Sign in as `admin`. Visit `/users`.
   - → GET `/pages?...&$actions=true`.
2. Inspect the response body.
   - ✓ Each row has `$actions: string[]`.
   - ✓ Row `admin` (status `active`): `$actions` excludes `activate` (`disabled` when status === `active`).
   - ✓ Row `bob` (status `pending`): `$actions` includes `activate`, excludes `resend-invite` (`disabled` when status !== `invited`).
   - ✓ A `suspended` row excludes `suspend`.
3. Open `admin`'s row menu — `Activate` hidden / disabled.
4. Open `bob`'s row menu — `Activate` available; `Resend invite` hidden.
5. **Bulk path** — multi-select `admin` + `bob`. Click toolbar `Activate`.
   - ✓ `onDisabledRows: 'skip'` (Scenario 8.8) silently drops `admin` from the request payload server-side; only `bob` is activated.
   - ✓ Toast confirms `1 user activated`.

### Scenario 8.8: `onDisabledRows: 'skip'` for bulk actions

1. On `/users`, multi-select `admin` (active), `bob` (pending), `alice` (suspended in scenario 7.5).
2. Click `Suspend` toolbar.
   - ✓ Form dialog opens directly (no prompt — `Suspend` declares `@InputForm`; see Scenario 8.5 for why `promptText` is ignored).
   - ✓ Header chip strip lists exactly two ids: `admin`, `bob`. The already-suspended `alice` was filtered out (`onDisabledRows: 'skip'`), so only the two eligible rows are passed downstream — verify against `view.idTotal === 2` and the form's title/header copy.
3. Submit the form.
   - ✓ Server receives `ids: [{username:'admin'}, {username:'bob'}]` only.

### Scenario 8.9: Synthetic `__remove` row action

`db-client.remove(id)` (`packages/db-client/src/client.ts:215-223`) branches on `typeof id`: object → `DELETE /?k1=v1&k2=v2` (composite / preferredId form), scalar → `DELETE /:id` (PK form). Synth `__remove` calls `extractIdentifier(row, preferredId)` (`packages/vue-table/src/composables/state/intent-scope.ts:95-114`) which always returns an object, so it always takes the composite branch. Both wire forms exist in the framework — synth `__remove` is the composite one.

**FK-references caveat.** `__remove` requires a row with no FK references. Every seeded `user` is referenced via `products.createdById` / `orders.assigneeId`, so any test exercising synth `__remove` against `/users` must first insert a fresh orphan user (no products, no orders). This is a feature (server-side referential integrity), not a bug — the rejection surfaces as a server error toast.

1. Pre-insert a throwaway orphan user (no FK references). Visit `/users`.
2. Open the orphan row's action menu.
   - ✓ Menu contains `Delete` (built-in `__remove`, hidden when the user lacks write permission).
3. Click `Delete`.
   - ✓ Confirm dialog with default prompt (e.g. `Delete item <username>?`).
4. Confirm.
   - → DELETE `/api/db/tables/users?username=<preferredId-value>` (composite / preferredId form via `db-client.remove(row)` → `extractIdentifier`). For `/users`, the preferredId column is `username`, so the wire is `?username=<value>`.
   - ✓ Toast: `Deleted 1 row(s).`
   - ✓ Row removed from table.

### Scenario 8.10: Role-side filtering — actions absent from `/meta` envelope

The ARBAC overlay (post commit `197afad`) filters per-method
`@ArbacAction(...)` decoration. Method-level handlers gated by ARBAC
(e.g. `activate` / `suspend` / `resend-invite`) drop out of
`/meta.actions[]` for users without the matching permission. Class-level
`@DbTableActions` declarations carry NO method-level metadata, so they
are NOT filtered by the overlay — they survive on the wire and must be
gated by other means (controller routing, custom processors, or
client-side checks).

1. Sign in as `viewer` (read-only role; no `update` permission for any
   table).
2. Visit `/users`.
   - → GET `/api/db/tables/users/meta`. Empirical wire shape (post
     `197afad`):
     - `actions[].name` = `["edit", "copy-invite-link", "invite-user", "export-csv"]`.
       `edit` and `copy-invite-link` are navigate / custom (no ARBAC);
       `invite-user` and `export-csv` are class-level `@DbTableActions`
       so the overlay leaves them in place.
     - `crud` = `{ query, pages, one }` only — `insert` / `update` /
       `remove` stripped.
     - `fields` is column-narrowed per ARBAC `columns` allow set.
3. Inspect any row's action menu.
   - ✓ `Edit` (navigate, no ARBAC) appears.
   - ✓ `Copy invite link` (custom processor, no ARBAC) appears.
   - ✓ `Delete` (synthetic `__remove`) is hidden because `crud.remove`
     was stripped from `/meta.crud` — synth `__remove` only mounts when
     `crud.remove` is present.
   - ✓ `Suspend` / `Activate` / `Resend invite` are absent (method-level
     `@ArbacAction` filtered by the overlay).
4. Inspect the toolbar.
   - ✓ `Invite user` table-level action **survives** on the wire
     (class-level `@DbTableActions`, not method-level — overlay does not
     filter it). It still navigates client-side. Server-side gating
     (e.g. `users:create` on the target route) enforces actual
     authorization when the user follows the link.
   - ✓ `Export CSV` table-level action MAY remain (custom processor;
     gated differently — per demo wiring).
5. Sign in as `admin`. Re-load `/users`.
   - → GET `/meta` — response now lists every action.
   - ✓ Row menu shows all entries.

### Scenario 8.11: Per-row backend predicate — server narrows `$actions[]`

Merged into Scenario 8.7 (canonical gate semantics).

### Scenario 8.12: Action invocation respects the gate (server-side)

Even if a UI bug somehow lets a disabled action be invoked, the server
re-evaluates the gate and rejects with `ActionDisabledError`
(`packages/moost-db/src/actions/action-disabled-error.ts:22+52` — HTTP
status hardcoded to 409 Conflict).

1. Manually issue `POST /api/db/tables/users/actions/activate` with
   `{ ids: { username: 'admin' } }` — `admin` is already `active`.
   - → **HTTP 409** (Conflict) with body shape:
     ```ts
     {
       name: "ActionDisabledError",
       message: string,
       statusCode: 409,
       action: string,
       id?: Record<string, unknown>,    // 'row'-level rejection
       ids?: Record<string, unknown>[], // 'rows'-level rejection
     }
     ```
   - ✓ The handler's `disabled` predicate fires server-side and blocks
     the call before any mutation runs.
   - ✓ No state change in the database.

### Scenario 8.13: Row-actions column placement — `first` / `last` / `merge-select`

The synthesised row-actions column placement is controlled per table via the consumer's `:row-actions-column` prop (mapped from `DemoTable.actionsColumn`). The demo uses all three modes:

| Table       | Placement        | Demo wiring                                                                                                      |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `users`     | `last`           | actions column appended **after** every data column                                                              |
| `products`  | `first`          | actions column **prepended** before all data columns (and after the leading select-checkbox column when present) |
| `orders`    | `merge-select`   | actions column shares the leading gutter with the multi-select checkbox — visible only when `select === "none"`  |
| `customers` | (default `last`) | falls back to last when not specified                                                                            |

#### `last` placement (Users)

1. Visit `/users`.
   - ✓ Last column (rightmost) is the synthesised `__actions` column.
   - ✓ Header for the column reads (or is aria-labelled) `Actions`.
   - ✓ Each data row's last `<td>` carries the row-actions cell (`as-row-actions`).
2. Toggle multi-select on. The checkbox column appears as the FIRST column.
   - ✓ Actions column stays at the right edge.

#### `first` placement (Products)

1. Visit `/products`.
   - ✓ Order is: actions column, then data columns (`Id`, `Name`, …).
2. Toggle multi-select on.
   - ✓ Order becomes: select-checkbox column, actions column, then data columns.
   - ✓ Two leading columns side by side (gutter splits between checkbox and actions).

#### `merge-select` placement (Orders)

1. Visit `/orders`. Default `select === "none"`.
   - ✓ ONE leading column carries the row-actions cell (no separate checkbox column).
   - ✓ Header for that column is empty (or only labels for actions).
2. Toggle multi-select on.
   - ✓ The leading column flips to the select-checkbox; the actions column is **NOT rendered** (the merge-select contract says actions yield to the checkbox).
   - ✓ Bulk actions (Suspend / Cancel / etc.) reach rows via toolbar buttons; per-row actions are unreachable in this mode (intentional — user is selecting, not acting per row).
3. Toggle multi-select off.
   - ✓ Leading column reverts to row-actions.

For each mode, applying any state change (filter, sort, page) must NOT shift the actions column placement — placement is config-driven and reactive to `selectMode` only on `merge-select`.

### Scenario 8.14: Row-actions cell rendering — empty / single / many

The `<AsRowActions>` cell uses one of three render branches based on `view.total` (count of NOT-disabled row + rows-level actions, after `applyRowGate` against the row's `$actions[]`):

#### `total === 0` — empty placeholder cell

1. Configure a table where the row has NO eligible actions (e.g. all schema actions are disabled for this row, no `__remove`, no default).
2. Inspect the row's actions cell.
   - ✓ Cell renders as an empty `<td class="as-row-actions">` (no button content).
   - ✓ `table-layout: fixed` keeps the column widths aligned with header (the placeholder is required).
   - ✓ Click on the empty cell is a no-op.

#### `total === 1` — single button

When exactly one action survives the gate:

- **With icon** → icon-only button (square shape via `c8-*` / `btn-square`).
- **Without icon** → labelled text button (carries `as-row-actions-btn-labelled`).
- The single button gets `data-default` attribute when the action is the default (so click/dblclick/Enter on the row also fires it via the main-action path).

##### Single + icon (square button)

1. On `/roles` (or any table with read-only role for current user where only `Delete` survives — `__remove` ships with the trash icon).
   - ✓ Row's actions cell shows an icon-only square button (no label visible).
   - ✓ Hover title / aria-label reads the action name (`Delete`).
   - ✓ Clicking fires the action (Scenario 8.9).

##### Single + no icon (labelled button)

1. Visit `/customers` (configured with `noRowDelete: true` so `__remove` is suppressed; `View orders` row action has NO `icon` field).
   - ✓ Each row's actions cell shows a button labelled `View orders` (text only, no icon).
   - ✓ Click fires the navigate action (Scenario 8.2 — navigates to `/orders?customerId=$1`).
   - ✓ The single labelled button mode is the result of:
     - exactly one action survives the gate AND
     - `noRowDelete: true` blocks the synthetic Delete from joining (otherwise `total` would be 2 → dropdown).

#### `total > 1` — dropdown menu

1. Visit `/users` (multiple row actions: `Edit`, `Copy invite link`, `Delete`, `Suspend`, conditionally `Activate` / `Resend invite`).
   - ✓ Each row's actions cell shows a single trigger button (`as-row-actions-more` with `i-as-menu` glyph) — square, icon-only.
   - ✓ Aria label / title reads `Row actions`.
2. Click the trigger.
   - ✓ Dropdown opens listing every surviving action.
   - ✓ The default action's row carries an indicator (e.g. `data-default` or a star/dot).
   - ✓ Menu items render via `AsActionMenuContent`; each entry shows icon (if any) + label.
3. Group order in the dropdown is: `default → row-level → rows-level`.

### Scenario 8.15: Per-row gating drops actions out of the menu

The action set is filtered against the row's server-evaluated `$actions[]` (Scenario 8.7). When the gate excludes enough actions to drop `total` below 2, the cell automatically downgrades from dropdown to single-button mode.

1. Visit `/users`. Open the row menu on `bob` (status `pending` — `Activate` and `Resend invite` are eligible; `Suspend` is too because bob isn't already suspended).
   - ✓ Dropdown lists `Edit`, `Copy invite link`, `Delete`, `Activate`, `Resend invite`, `Suspend`.
2. Open the row menu on a `suspended` user (alice, after Scenario 8.5).
   - ✓ `Suspend` excluded; `Activate` included; `Resend invite` excluded (status !== invited).

When per-row gating drops a row's surviving action count below 2, the cell automatically downgrades from dropdown to single-button (rendering covered by Scenario 8.14).

### Scenario 8.16: Synthetic `__remove` (Delete) action — when present, when absent

`__remove` is added to the row-actions list automatically by the framework when:

- The current user has write permission for the resource (ARBAC `delete` permission), AND
- The consumer has NOT set `noRowDelete: true` for this table, AND
- The CRUD permissions in `/meta` include `remove`.

When any of these is false, `Delete` does NOT appear at all.

#### Present case

1. Sign in as `admin`. Visit `/users`.
2. Open any row's menu.
   - ✓ Menu contains `Delete`.
   - ✓ Click → confirm dialog → DELETE `/api/db/tables/users/<pk>` → row removed (Scenario 8.9).

#### Absent — `noRowDelete: true`

1. On `/customers` (configured `noRowDelete: true`).
   - ✓ Row actions cell shows the labelled `View orders` button — NOT a dropdown.
   - ✓ NO `Delete` anywhere — proving `noRowDelete` short-circuits both the menu and any single-button collapse including delete.

#### Absent — no write permission

1. Sign in as `viewer` (read-only). Visit `/users`.
2. Open any row's menu.
   - ✓ Only `Edit` (navigate) appears — `Delete` absent because the user has no `delete` permission on `users` (gated server-side via ARBAC; `crud.remove` is stripped from `/meta.crud`).

#### Re-orders `total` count

1. Visit `/customers` (1 declared action + `noRowDelete`).
   - ✓ `total === 1` → labelled-button render (Scenario 8.15).
2. Hypothetically remove `noRowDelete` for this table.
   - ✓ `total === 2` (`View orders` + `Delete`) → render flips to dropdown.

### Scenario 8.17: Default action interaction with row main-action

The `default: true` row action is also the row's "main" action — invoked by dblclick / Enter on the row body (not the actions cell).

1. Visit `/users`. The default row action is `edit` (`processor: 'navigate'`, `value: '/users/$1/edit'`).
2. Double-click anywhere on a data cell of `admin`'s row.
   - ✓ Navigates to `/users/admin/edit` (the default action fires; clicked the row, not the actions button).
3. Click the row-actions trigger to open the menu.
   - ✓ `Edit` appears in the menu with the default-marker indicator (e.g. star icon, "default" badge, or `data-default` attribute).
4. On `/customers`, the only row action `View orders` is also `default: true`.
   - ✓ Double-clicking a row navigates to `/orders?customerId=<that customer>`.
   - ✓ Single-click on the labelled `View orders` button does the same thing (the button has `data-default`).

### Scenario 8.18: Action intent → scope/color across all action surfaces

Each action declares an `intent: 'positive' | 'negative' | 'warning' | 'primary' | 'secondary'`. The `intentToScope` mapping turns it into a vunor `scope-*` token applied uniformly to every surface that renders the action:

| Intent      | vunor scope       | Used by demo for                                           |
| ----------- | ----------------- | ---------------------------------------------------------- |
| `positive`  | `scope-good`      | `Activate` (green)                                         |
| `negative`  | `scope-error`     | `Suspend`, `Cancel` (red)                                  |
| `warning`   | `scope-warn`      | (forward-compat — none in demo today)                      |
| `primary`   | `scope-primary`   | `Invite user`, `Resend invite` (the brand-blue affordance) |
| `secondary` | `scope-secondary` | `Edit`, `Copy invite link`, `Export CSV` (subdued)         |
| (unset)     | none              | leaves chrome at default `c8-filled` primary               |

The same `action.intent` value drives all three rendering surfaces below — single-button cell render is also intent-aware but the demo declares no explicit intent on its single-button paths today (`view-orders` stays default), so it's listed in the future-coverage gaps. Verify each by walking the demo:

#### Surface 1 — Multi-action dropdown (menu items)

1. Visit `/users`. Open `bob`'s row-actions dropdown.
2. Inspect each menu item's hover / `data-highlighted=""` state colour:
   - ✓ Hovering `Activate` (positive) tints the row green (`scope-good !bg-current-hl/10`).
   - ✓ Hovering `Suspend` (negative) tints the row red (`scope-error`).
   - ✓ Hovering `Edit` / `Copy invite link` / `Delete` (no intent / secondary) — neutral row tint.
   - ✓ The icon picks up `text-current-hl` only on the highlighted/hovered row (not at rest).
3. Walk the items via keyboard (arrow keys); each item's `[data-highlighted='']` triggers the same colour as hover.

#### Surface 2 — Confirm dialog confirm button

When an action with `confirm: true` (or a `__remove` synthetic) opens the confirm dialog, the `Confirm` button paints with the action's intent scope. The cancel button stays neutral.

1. Trigger `Suspend` on a single user.
   - ✓ Confirm dialog opens. Confirm button reads `Suspend` and paints **red** (`!scope-error`).
2. Trigger `Activate`.
   - ✓ Confirm dialog (if `confirm: true` is set; demo's `activate` doesn't confirm — adapt to a primary/positive action that does).
   - ✓ Confirm button paints green.
3. Trigger `Delete` (synthetic `__remove`).
   - ✓ Confirm button paints red.
4. The cancel button stays `scope-neutral` regardless.

#### Surface 3 — Action input form submit button

When an action ships an `@InputForm`, the Submit button in the action-form dialog also takes the action's intent.

1. Trigger `Suspend` (action with `@InputForm(SuspendUsersInput)`, `intent: 'negative'`).
   - ✓ Form dialog opens. Submit button paints red.
2. Trigger `Resend invite` (action with `@InputForm(ResendInviteInput)`, `intent: 'primary'`).
   - ✓ Submit button paints `scope-primary`.

For each surface, no other ARIA / keyboard / disabled state changes — only paint differs based on intent.

### Scenario 8.19: Action input form — header chips for target ids + "+N more…" overflow

The action-form dialog's header surfaces the identifier(s) of the rows being acted on as a chip strip. When the strip overflows, non-fitting chips collapse into a single `+N more…` chip rendered last; the off-screen-measurement element (`data-id-more`) keeps the count accurate even before any measurement pass runs.

1. Visit `/users`. Toggle multi-select on. Select `manager`.
2. Click toolbar `Suspend`.
   - ✓ Form dialog opens.
   - ✓ Header carries a chip strip showing `manager` (the row's preferredId / display label).
   - ✓ NO `+N more…` chip — single chip fits comfortably.
3. Cancel. Re-select `manager`, `viewer`, `alice`, `bob`.
4. Click `Suspend` (or trigger any bulk action with `@InputForm`).
   - ✓ Header chips render as many of `manager`, `viewer`, `alice`, `bob` as fit.
   - ✓ When chips overflow, the trailing visible chips are followed by `+N more…` showing the remaining count.
   - ✓ The visible-chip count + the `+N more…` count = total selected rows (`view.idTotal`).
5. Resize the dialog narrower (drag if resizable, or use mobile viewport per Section 18).
   - ✓ Visible-chip count drops as available width shrinks.
   - ✓ `+N more…` count grows accordingly.
6. Hypothetically: 1 selection.
   - ✓ Single chip; no `+N more…`.
   - ✓ Header reads as a single-row prompt (e.g. `Suspend user manager?`).
7. The hidden measurement node (`data-id-more`) is rendered off-screen with the same chip styling so its `offsetWidth` correctly accounts for any future intent / scope tinting.

Validate the count math:

- Each `+N more…` displayed value === `view.idTotal - visibleIdsCount`.
- Last visible chip does NOT reserve space for the `+N more` (`isLast ? 0 : gap + moreWidth`) — when the strip happens to fit ALL chips, the "more" element is hidden and no width is reserved.

### Scenario 8.20: `@DbInputForm` payload validation

The `@InputForm(SuspendUsersInput)` payload is validated against its
compiled `.as` schema before the handler runs. Bad input yields HTTP 400
with field-level errors that the action-form dialog renders inline.

1. On `/users`, multi-select 1–2 users. Click toolbar `Suspend`.
2. In the action-form dialog, leave `reason` empty (or shorter than
   `@expect.minLength`) and submit.
   - → POST `/actions/suspend` returns 400 with `ClientValidationError`
     listing `reason` field error.
   - ✓ Dialog stays open; `reason` field shows the inline error message.
   - ✓ Submit button still enabled — user can correct and re-submit.
3. Fill `reason: "policy review"`, click Submit.
   - ✓ Dialog closes. Suspend completes (Scenario 8.5).

---

## Section 9 — Selection

### Scenario 9.1: Toggle multi-select

1. On `/users`, click the toolbar `Show selection checkboxes` button.
   - ✓ A leading checkbox column appears.
   - ✓ Header has a "select all on page" checkbox.
2. Click 2 rows.
   - ✓ Each row gains `data-state="checked"`.
   - ✓ Bulk action buttons (e.g. `Suspend`) become enabled in the toolbar.
3. Click the toggle button again.
   - ✓ Checkbox column hides.
   - ✓ `selectedRows` model is cleared (the multi → none transition auto-clears per the demo's design contract).

### Scenario 9.2: Selection trim mode (default)

1. Multi-select 3 orders on page 1.
2. Apply a filter that excludes 2 of them.
   - ✓ After refetch, only the surviving row remains in `selectedRows`. The others are trimmed (`selectionPersistence: 'trim'` is the default).

---

## Section 10 — Pagination

### Scenario 10.1: Page navigation

1. On `/orders`, click `Page 2` (or `>` if rendered).
   - → Single `/pages?$page=2&$size=25` call.
   - ✓ Table rebuilds; pagination indicator highlights page 2.
   - ✓ Selection (if any) is trimmed per Scenario 9.2.

### Scenario 10.2: Rows-per-page change

1. On `/orders`, change `Rows per page` from 25 to 50.
   - → Single `/pages?$size=50` call.
   - ✓ Table now displays up to 50 rows.

### Scenario 10.3: Window-mode infinite scroll (Audit Log)

1. Visit `/audit_log`.
   - → Initial `/pages` for first window (limit 100).
2. Scroll the table to the end of the loaded window.
   - → Next `/pages` for the next window (block-aligned to `blockSize`).
   - ✓ Rows append seamlessly; no page-number UI.

---

## Section 11 — Presets

### Scenario 11.1: Standard preset on first load

1. Visit any data table for the first time.
   - ✓ Preset trigger reads `Standard` (the built-in system preset).
   - ✓ Initial `/pages` call has no preset-specific overrides — server schema defaults apply.

### Scenario 11.2: Save preset

1. On `/orders`, apply a `Status = shipped` filter and sort by `Total` desc.
2. Click the preset trigger and choose `Save as…`.
   - ✓ Save-as popover appears with checkboxes for aspect inclusion (filters, sorters, columns, pagination).
3. Enter name `Open shipments`, mark "Make public" off, save.
   - → POST `/api/db/_presets/`
   - ✓ Picker now shows `Open shipments` in the "My presets" section.

### Scenario 11.3: Apply, favorite, public, delete a preset

1. With the preset created in 11.2, switch back to Standard, then click `Open shipments`.
   - → PATCH `/api/db/_presets/` (active preset id update) + `/pages` refetch.
   - ✓ Filter/sort restored to the saved snapshot.
2. In the preset picker, click the favorite (star) icon next to `Open shipments`.
   - ✓ Star fills (active state), preset moves to the Favorites section.
3. Open the Manage Presets dialog (gear icon in picker).
   - ✓ `Open shipments` row visible. Toggle the `public` icon — confirm only owner can publish.
   - ✓ Save flushes a single PATCH with the diff.
4. Mark for delete + Save.
   - → DELETE `/api/db/_presets/<id>`.
   - ✓ Preset disappears from the picker.

### Scenario 11.4: Preset bootstrap doesn't clobber URL filters (regression)

This is the regression around `preset.ready` gating `applyUrlQuery`.

1. Save a preset on `/orders` that includes `Status = pending`.
2. Open a fresh tab to `/orders?status='shipped'` (deep link with a different status).
   - ✓ Preset bootstrap writes its baseline (`status='pending'`).
   - ✓ Then URL hydration overlays — URL wins on conflict — final state has `status='shipped'`.
   - ✓ Table loads in a SINGLE fetch (no preset-then-URL double query).

### Scenario 11.5: Save preset — selective aspects

The Save-as popover offers per-aspect checkboxes. Only checked aspects are persisted; unchecked ones are absent from the snapshot, so applying that preset later leaves them alone.

1. On `/users`, set up state: filter `Status = active`, sort by `Username` asc, hide the `Created` column, set rows-per-page = 50.
2. Click the preset trigger → `Save as…`.
3. **Filters-only**: tick `filters` only, untick the rest. Name `Active filter`. Save.
   - → POST `/api/db/_presets/` with snapshot containing `filters` (+ `filterOps`) only — `columns`, `sorters`, `itemsPerPage` are absent.
   - ✓ Picker lists the new preset under "My presets".
4. **All aspects**: from the same state, save again as `Active full`. Tick every aspect.
   - → POST with all aspects in snapshot.
5. **Columns-only**: from the same state, save as `Compact view` with only `columns` ticked.
   - → POST with `columns: { columnNames, columnWidths }` only.

For each save, validate the wire payload:

- ✓ The `data.content` snapshot's keys exactly match the ticked aspect set.
- ✓ Server returns the new preset id; picker shows it under "My presets".

### Scenario 11.6: Apply preset — only the saved aspects mutate state

Aspects absent from the snapshot must NOT touch the corresponding state. This is the per-aspect opt-in design.

1. Continuing Scenario 11.5, set state to a known baseline: filter `Status = pending`, sort by `Email` desc, all columns visible, rows-per-page = 25.
2. Click `Active filter` (filters-only preset).
   - → PATCH `/api/db/_presets/` (active preset id) + single `/pages` refetch.
   - ✓ Filter changes to `Status = active`.
   - ✓ Sorter UNCHANGED (still `Email` desc) — sorters absent from snapshot.
   - ✓ Column visibility UNCHANGED.
   - ✓ Pagination UNCHANGED (`size=25`).
3. Click `Compact view` (columns-only preset).
   - ✓ Column set / order changes to the saved one.
   - ✓ Filter UNCHANGED (still `Status = active` from previous apply).
   - ✓ Sorter UNCHANGED.
4. Click `Active full`.
   - ✓ Filter, sorter, columns, pagination ALL change to the saved snapshot.

### Scenario 11.7: Manage Presets dialog — batched mutations

The Manage dialog opens via the gear icon in the preset picker. All mutations (rename / set-default / toggle-public / mark-for-delete / select-active) are PENDING until Save flushes them as a batch. Save runs `setFavorites → setDefault → renames → public-toggles → deletes → applyPreset` in that order.

1. Save a few presets so the list has variety: `My A`, `My B`, `Shared C` (public toggled on by another user, owned by current user).
2. Open the Manage dialog.
   - ✓ Sectioned by group: System / My / Shared.
   - ✓ Each row has icons for: pin-as-default, favorite (star), public (eye), delete (trash), and an editable label.
   - ✓ Toolbar has a search input + counter chip (`5` matching of `12`).
3. **Search by name** — type `My`. List filters to `My A` + `My B`. Type `bob`. List filters to presets owned by `bob` (matching by owner field, not just label).
4. **Set as default** — click the pin icon on `My A`.
   - ✓ Pin gains active state (filled), all other pin icons un-fill (only one default per user × app × tableKey).
   - ✓ Save button enables (Unsaved-changes indicator appears in footer).
   - → No HTTP yet — pending batch.
5. **Rename inline** — click `My A`'s label.
   - ✓ Input becomes editable; focus is placed at end of text.
   - Type ` v2` so label reads `My A v2`. Pending state captures it (live-write on `@input`).
   - ✓ Save remains enabled.
6. **Toggle public** — click eye icon on `My B`. Pending toggle. Click again to revert. Repeat.
7. **Mark for delete** — click trash on `Shared C`.
   - ✓ Row visually struck through.
   - ✓ Inline rename on a delete-marked row is disabled (rename gated off).
   - ✓ Clicking the trash again UN-marks (and re-enables rename).
8. **Select-active** — click somewhere on `My A v2`'s row (not on icons).
   - ✓ Row gains a "will-apply" indicator.
9. Click `Save`.
   - → Sequence of HTTP calls in the documented order: setFavorites, setDefault, rename(s), public-toggle(s), delete(s).
   - → After all complete, the apply step PATCHes active preset and triggers `/pages` refetch.
   - ✓ Picker reflects the new state: `My A v2` is default + active; `Shared C` gone; etc.
10. **Cancel button** — repeat steps 4–8, then click `Cancel`.
    - ✓ Dialog closes; NO HTTP fires; picker unchanged.

### Scenario 11.8: `forceFilters` overlay survives preset apply

A preset may carry filters that conflict with a `forceFilters` view. The forced filter is server-only and always wins; user-side preset filters AND with it.

1. On `/orders-cancelled` (forces `status='cancelled'`), save a preset that includes `status='shipped'` (e.g. user typed `shipped` then saved before navigating).
2. Reload `/orders-cancelled`. Apply that preset.
   - ✓ User-side filter becomes `status='shipped'`.
   - → `/pages` request carries BOTH: `forceFilters` (`status='cancelled'`) AND user filter (`status='shipped'`).
   - ✓ Server ANDs them — result is empty (no row is both `cancelled` AND `shipped`). The empty-state is the test of the contract.

### Scenario 11.9: Capabilities gate publish action

`canPublish: false` (per ARBAC) hides the public toggle in the Manage dialog.

1. Sign in as a user with no publish permission (e.g. `viewer`).
2. Open the Manage dialog.
   - ✓ Eye icons are absent / disabled on rows the user could otherwise own.
3. Sign in as a user with publish permission (e.g. `admin`).
   - ✓ Eye icons render on owned rows.

---

## Section 12 — Loading states + latency

### Scenario 12.1: Loading skeleton during `/meta` + `/pages`

1. Visit any table (latency injected: 50 ms `/meta`, 100 ms `/pages`).
   - ✓ A loading skeleton or "Loading…" text is visible for ~150 ms.
   - ✓ It hides as soon as both responses settle and the first frame paints.

### Scenario 12.2: Refresh button

1. Click the toolbar `Refresh` button on any table.
   - → Single `/pages` call (fresh fetch, no debounce).
   - ✓ Briefly shows a `querying` indicator (e.g. `Refresh` button spins, or the rows show a spinner overlay).

---

## Section 13 — Edge states

### Scenario 13.1: Empty result set

1. Visit `/users`. Apply filter `Username contains zzzzz`.
   - ✓ After debounced fetch, table renders an empty-state message.
   - ✓ NO console errors. Pagination disabled or shows `0 of 0`.

### Scenario 13.2: Query error

1. (Manually patch) Force the server to return 500 on `/orders/pages` for one request.
2. Trigger any state mutation that refetches.
   - ✓ Table renders an error-state message (`queryError` slot value populated).
   - ✓ Toolbar `Refresh` button remains usable.
3. Restore the server, click `Refresh`.
   - ✓ Error state clears, rows render normally.

### Scenario 13.3: No-permission visibility

1. Sign out and sign in as `viewer` / `demo-password`.
   - ✓ Sidebar lists only the tables the role can read (e.g. no Audit Log if scope blocks it).
2. Mutating-action visibility on rows is covered by Scenario 8.10 (`@ArbacAction` strips actions from `/meta` server-side).

### Scenario 13.4: Maintenance / write-locked column

1. Visit `/products`. The `price` column is write-only-by-admin (per ARBAC scope).
   - ✓ Cell renders normally for read.
   - ✓ Inline edit (if exposed) is disabled.

---

## Section 14 — Composite contracts

A condensed end-to-end smoke walk of the Phase-1 demo additions lives in the referenced scenarios — no unique assertions are kept here. Walk in order: Scenario 2.1 (Birthday cell rendering) → 8.3 (Copy invite link, custom row action) → 4.5 (`forceFilters` on `/orders-cancelled`) → 6.3 (URL allowlist on `/orders`).

---

## Section 15 — Form / Edit page (out of table scope but adjacent)

These are referenced because row actions navigate to them.

### Scenario 15.1: Edit row via default action

Default-action navigation is covered in Scenario 8.17. After landing on `/users/<username>/edit`:

- → GET `/api/db/tables/users/one/<id>` (or `/one?<preferredId>=<value>`).
- ✓ Form renders with row values pre-filled.
- ✓ Editing a field and saving fires PATCH `/api/db/tables/users/`.
- ✓ Server validates the payload; failures surface as inline errors.

---

## Section 16 — Column header (menu, drag-reorder, resize)

Every interactive surface attached to a column header — the dropdown menu, the resize handle, and the drag-reorder handle — has its own keyboard + mouse contract.

### Scenario 16.1: Menu items are gated by column capability + config

The column-header dropdown menu (`AsColumnMenu`) is built from the column's capabilities (`sortable`, `filterable`) AND the consumer's `column-menu` config (`{ sort, filters, hide, resetWidth }`). When NO items are eligible, the menu trigger is suppressed entirely.

1. On `/users`, click the chevron / menu trigger on `Username` (sortable + filterable + non-default width).
   - ✓ Menu opens with sections / items: `Sort` (Asc / Desc), `Filter`, `Hide`, `Reset width` (only if width has been resized).
2. Click the menu trigger on `Address` (`@db.json`, scenario 3.2 forces both flags off).
   - ✓ The `Address` column header has NO menu trigger at all (`hasAnyItem` = false → fallback slot rendered).
3. Configure `column-menu="{ sort: false, filters: false, hide: true, resetWidth: false }"` on a table consumer.
   - ✓ Each column's menu shows only `Hide` (where applicable).

### Scenario 16.2: Sort items + hotkeys (`a`, `d`)

1. Open the menu on `Total` (sortable column).
   - ✓ Items `Asc` and `Desc` visible.
2. Press the `a` key (no modifiers) while menu is open.
   - ✓ Sort applies asc; menu closes.
   - → Single `/pages` with `$sort=total:1`.
3. Re-open menu, press `d`.
   - ✓ Sort flips to desc; menu closes.
4. Re-open menu, press `d` again.
   - ✓ Sort cycles off (clicking the active direction toggles it off — same contract as Scenario 7.1).
5. Open menu, click `Asc` directly with mouse.
   - ✓ Same outcome as the `a` hotkey.
6. Try modifier-prefixed keys (`Cmd+a`, `Ctrl+d`, `Alt+a`).
   - ✓ Hotkey handler ignores them (browser default behaviour passes through — e.g. Cmd+A selects).

### Scenario 16.3: Filter items + hotkeys (`f`, `c`)

1. Open the menu on `Username` (filterable).
   - ✓ Item `Filter` opens the per-column filter dialog (Scenario 4.8) on click.
   - ✓ If the column has any filled filter conditions, an extra `Clear filters` (or equivalent) item appears.
2. Press `f` while menu open.
   - ✓ Filter dialog opens; column-menu closes.
3. Apply a filter, close the dialog, re-open the column menu.
   - ✓ Now the `Clear filters` item is present.
4. Press `c` while menu open.
   - ✓ All filter conditions on this column clear.
   - → Single `/pages` after debounce with that column's filter dropped.
5. Re-open menu after clear.
   - ✓ `Clear filters` item is gone (filledCount=0).

### Scenario 16.4: Hide column hotkey (`h`)

1. Open the menu on a non-required column. Press `h`.
   - ✓ Column hides.
   - ✓ Visible-column set changes → query refetches with new `$select` (Scenario 5.3).
   - ✓ Settings dialog Columns tab now shows the column unchecked.
2. Restore via Settings dialog.

### Scenario 16.5: Reset width hotkey (`w`)

1. Resize a column manually (Scenario 16.6).
2. Open the menu on the resized column.
   - ✓ `Reset width` item is present (only because `widthEntry.w !== widthEntry.d`).
3. Press `w`.
   - ✓ Column width snaps back to default; menu closes.
4. Re-open menu — `Reset width` item is gone (no diff).

### Scenario 16.6: Resize via drag

1. Hover the right edge of a column header.
   - ✓ Cursor changes to `col-resize`.
2. Drag the resize handle 80 px to the right.
   - ✓ Column widens live during drag.
   - ✓ Adjacent columns reflow.
   - ✓ NO `/pages` call fires during drag (resize is display-only).
3. Release.
   - ✓ Width persists in `columnWidths` model — visible immediately on Settings dialog or via the column-menu `Reset width` becoming available.
   - ✓ Width round-trips into a saved preset's `columns.columnWidths` snapshot.

### Scenario 16.7: Auto-fit via double-click on resize handle

1. On any column with truncated content (e.g. a long `Email` value), double-click the right-edge resize handle.
   - ✓ Column auto-sizes to fit the widest visible cell content (or a configured cap).
   - ✓ Update goes through the same `columnWidths` write path as drag-resize.
   - ✓ `Reset width` becomes available in the column menu (since the new width differs from default).
2. Double-click the resize handle a second time on a column whose content fits.
   - ✓ Column may snap to default — verify against the actual contract.

### Scenario 16.8: Drag-reorder columns

1. Press-and-hold a column header (not on the resize handle, the menu trigger, or a checkbox).
2. Drag horizontally to a new position.
   - ✓ A drop indicator renders between target columns.
   - ✓ Original column shows a dragging visual.
3. Release over a different column position.
   - ✓ `columnNames` model reorders.
   - ✓ NO `/pages` call fires (column reorder is display-only — the visible-column SET is unchanged, only its order — see Scenario 5.3).
   - ✓ Settings dialog Columns tab reflects the new order.
4. Drag a "locked" column (declared via `column.locked` or schema flag).
   - ✓ Drag is rejected — no drop indicator, no reorder.

### Scenario 16.9: Header keyboard nav (arrow keys / Enter)

1. Tab through the page until a column header receives focus.
   - ✓ Header has visible focus ring.
2. Press `Enter` on the focused header.
   - ✓ The column-menu opens (or, if the column has no menu, the sort cycle advances per the click-to-sort contract).
3. With menu open, press `Esc`.
   - ✓ Menu closes; focus restored to the trigger.

---

## Section 17 — App-level config (`useAppPrefs`)

`useAppPrefs` is a per-`(user, app)` preferences store backed by the same `_presets` controller (rows of `type: 'appConf'`). The composable is mounted ONCE at the app root in `<AppShell>`; cells inject the resulting reactive `prefs` ref via `provideCellLocale`/`useCellLocale`. This avoids per-cell client allocations.

The schema-validated shape ([`AppConfData`](packages/moost-ui-presets/src/as-preset-entry.as)):

```
appearance?: 'system' | 'light' | 'dark'
language?: string         // BCP-47 locale
timezone?: string         // IANA zone id
density?: 'compact' | 'cozy' | 'comfortable'
dateFormat?: 'iso' | 'us' | 'eu'
firstDayOfWeek?: 0 | 1 | 6
customJson?: string
```

### Scenario 17.1: First-load reads existing prefs

1. Sign in as a user with NO existing app-conf row.
2. Visit `/`.
   - → GET `/api/db/_presets/query?app=vuedemo&type=appConf`
   - ✓ Empty result; `prefs.value` resolves to defaults (e.g. `{}` or schema defaults).
3. Sign out and sign in as a user whose app-conf was previously written.
   - → Same GET; result has the row.
   - ✓ `prefs.value` reflects the saved state synchronously after first paint (no flash) — `useStorage` cache primes from local storage on mount.
4. Inspect the network panel.
   - ✓ The composable fires the `/_presets/query` exactly once per app-mount, regardless of how many cells `inject` the prefs ref.

### Scenario 17.2: Theme — `appearance` toggles light/dark/system

1. Visit `/preferences`. Confirm `appearance: 'system'` initially.
2. Verify the document's `<html>` element gets `class="dark"` matching the OS preference (`usePreferredDark`).
3. Switch `appearance` to `dark`.
   - → POST `/api/db/_presets/` (or PUT) with `data: { appearance: 'dark' }`.
   - ✓ `<html class="dark">` regardless of OS.
   - ✓ Bus `useEventBus`-broadcast notifies other open tabs / instances; sidebar's dark-mode button updates label live.
4. Switch back to `light`.
   - ✓ `<html>` loses `dark` class.
5. Switch to `system`.
   - ✓ Class follows the OS pref again.

### Scenario 17.3: Other prefs save / read

For each prop, change the value on the `/preferences` page, refresh, and confirm persistence:

| Prop             | Test value      | Verification                                                                     |
| ---------------- | --------------- | -------------------------------------------------------------------------------- |
| `language`       | `de-DE`         | `<AsCellNumber>` formats `42.50 → 42,50` (German locale grouping).               |
| `timezone`       | `Europe/Berlin` | A datetime cell of a row whose UTC instant is known shows the Berlin-local time. |
| `density`        | `compact`       | Table row height tightens; vunor density tokens collapse.                        |
| `dateFormat`     | `eu`            | A `date`-typed cell renders `DD.MM.YYYY` (or whichever the demo wires for `eu`). |
| `firstDayOfWeek` | `1` (Monday)    | A date-picker mounted on a filter input or edit form shows weeks starting Mon.   |
| `customJson`     | `{"foo":"bar"}` | Round-trip through textarea; reload page; field still shows it.                  |

For each:

1. Change value, confirm save fires.
   - → POST/PATCH `/api/db/_presets/`.
2. Reload page.
   - → GET `/_presets/query?...&type=appConf` returns the updated row.
   - ✓ UI reflects the saved value with no flash to default.
3. Open a second tab to the same app.
   - ✓ Second tab receives the broadcast and reflects the change without a manual refresh.

### Scenario 17.4: Locale / timezone actually drive cell rendering

1. Set `language: 'en-US'`, `timezone: 'America/New_York'`.
2. On `/users`, inspect `Birthday` for `admin` (a known UTC instant — `1985-03-14`).
   - ✓ Cell reads `Mar 14, 1985` (US format; date-only because `@ui.table.type 'date'`).
3. On `/users`, inspect `Last Login` for `admin`.
   - ✓ Datetime renders in NYC time — e.g. `4:55 AM` if the underlying UTC was `08:55Z`.
4. Switch to `language: 'de-DE'`, `timezone: 'Europe/Berlin'`.
   - ✓ `Birthday` reformats to e.g. `14. März 1985`.
   - ✓ `Last Login` shifts hours to Berlin.
   - ✓ Number cells (e.g. `Total` in orders) reformat with German grouping (`42,50` not `42.50`).
5. Each switch fires no extra `/pages` request — the change is purely a prefs broadcast; cell renderers are reactive on the injected `prefs` ref.

### Scenario 17.5: Reset / clear-cache

1. The `/preferences` page exposes a "Clear cache" button.
2. Click it.
   - ✓ Local storage entry for `useAppPrefs` is removed.
   - ✓ Next reload re-fetches from the server (no stale local copy).

### Scenario 17.6: Validation rejects bad payloads

1. (Programmatically) POST `/api/db/_presets/` with `data: { appearance: 'invalid' }`.
   - → 400 with field error from the `AsPresetEntry` validator.
2. Inspect the table UI — appearance still reflects last valid value.

---

## Section 18 — Mobile / responsive dialog layout

All action / settings / preset / per-column-filter dialogs share a `dialogBase` ([`packages/ui-styles/src/shortcuts/table/_shared.ts`](packages/ui-styles/src/shortcuts/table/_shared.ts)) that's mobile-first edge-to-edge full-screen by default and switches to centered chrome at the `sm` breakpoint (vunor's `sm` = 640px). The contract:

```
dialogBase = layer-0 fixed z-[101] flex flex-col outline-none
             inset-0 size-full                              // mobile (default)
             sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
             sm:rounded-r3 sm:shadow-popup sm:border-1
```

Per-dialog overrides only restore desktop chrome (`sm:` prefixed widths / heights). On mobile the dialog covers the full viewport — no rounded corners, no shadow, no border, edge-to-edge content.

| Dialog                                                | Mobile                       | Desktop (≥ sm)                                                  |
| ----------------------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| Per-column filter dialog (`as-filter-dialog-content`) | Full-screen                  | `560px` × `clamp(500px, 70vh, 600px)` centered                  |
| Table Settings (`as-config-dialog-content`)           | Full-screen                  | `640px` × `clamp(500px, 70vh, 600px)` centered                  |
| Action input form (`as-action-form-content`)          | Full-screen                  | `min(560px, 92vw)` × `auto` (`max-h: 90vh`) centered            |
| Manage Presets (`as-preset-dialog-content`)           | Full-screen                  | `min-w 560px` / `max 820px` × `max-h min(80vh, 720px)` centered |
| Confirm dialog (`as-confirm-dialog-content`)          | **Compact, NOT full-screen** | `min-w 320px` / `max 520px` centered                            |

The confirm dialog is intentionally NOT full-screen on mobile — it's a quick yes/no prompt, so it stays as a compact card at the centre of the viewport regardless of breakpoint (the `!`-prefixed overrides in its shortcut explicitly defeat the `dialogBase` mobile path).

### Scenario 18.1: All `dialogBase` dialogs go full-screen below `sm` (parametrized)

The four full-screen dialogs (per-column filter, Table Settings, action input form, Manage Presets) all share the same mobile contract — the per-dialog narrative was redundant, so the walk is parametrized below. The confirm dialog is the deliberate exception (Scenario 18.5).

**Setup:** Set viewport to mobile width (e.g. 390 × 844, iPhone 14 size).

**For each row in the dialog table at the top of this section** — open the dialog as listed and assert:

- ✓ Dialog covers the entire viewport — no visible padding around it.
- ✓ NO `border-radius` (square corners), NO `box-shadow`, NO outer `border` (flush against viewport edge).
- ✓ Header / tabs (where present) / footer arrange vertically; body fills the available space and scrolls when content overflows.
- ✓ Close button (`×`) is touch-sized (`size-fingertip-s`) and reachable.
- ✓ Footer actions (Submit / Cancel / Save / Apply, as relevant) are sticky at the bottom — reachable without scrolling past the body.

**Then resize to desktop (e.g. 1024 × 768) and confirm:**

- ✓ Dialog snaps to its desktop dimensions per the table at the top of Section 18 (centered, rounded corners, shadow, border).

**Per-dialog deltas worth a separate check:**

| Dialog            | Mobile entry point                        | Per-dialog detail                                                                                                      |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Per-column filter | open on `Username` from `/users`          | tabs (`Values` / `Conditions`) keep full-width on mobile                                                               |
| Table Settings    | toolbar `Columns` / `Filters` / `Sorters` | switching tabs does not trigger chrome animation                                                                       |
| Action input form | multi-select 5+ rows, click `Suspend`     | header chips strip stays horizontally scrollable (Scenario 8.19 overflow contract still holds inside the mobile shell) |
| Manage Presets    | gear icon in preset picker                | section headers (System / My / Shared) and inline rename input both fit dialog width with no horizontal overflow       |

### Scenario 18.5: Confirm dialog — stays compact on mobile

1. On a mobile viewport, trigger any action that opens the confirm dialog (e.g. `Delete` on a row).
   - ✓ Confirm dialog renders as a compact card at the viewport centre.
   - ✓ Dialog DOES have `border`, `border-radius`, `shadow` (intentional override of `dialogBase`'s mobile no-chrome path).
   - ✓ Width is `min-w-0 sm:min-w-[320px] max-w-[min(520px,92vw)]` — narrow viewports may render below 320px.
   - ✓ Overlay covers the rest of the viewport (greyed / dimmed background).
2. Verify the dialog is intentionally NOT mobile-full-screen even on the smallest tested viewport — confirm dialogs are short prompts, not workflows.

### Scenario 18.6: Density preference interacts with mobile layout

1. Set `prefs.density = 'compact'` (Scenario 17.3).
2. On a mobile viewport, open any of the full-screen dialogs.
   - ✓ Internal padding / row heights tighten per the density token.
   - ✓ More rows fit in the same viewport; behaviour is otherwise identical.

### Scenario 18.7: Touch interactions inside dialogs

1. On a mobile viewport, in any dialog with scrollable body:
   - ✓ Vertical touch-scroll inside the body works.
   - ✓ Horizontal swipe on a chip strip (Scenario 4.16) inside a filter pill scrolls chips, not the dialog.
   - ✓ Tapping outside the dialog (overlay) closes it (when `modal: false`) OR is blocked (when modal).

---

## Section 19 — Workflows (login / register / invite)

The demo wires three Moost workflows on top of the table layer: `auth/login`, `auth/register`, and `users/invite`. These are the entry/exit boundaries of the system — every other scenario assumes "signed in as admin", but the workflows themselves need their own coverage. The workflow engine pauses on `httpInputRequired` (form input needed), persists state on `outletEmail` (resumable later via the magic link), and finalizes by setting the session cookie via `useWfFinished`.

### Scenario 19.1: Login — happy path (no MFA)

1. Visit `/login` (or `/` while signed-out).
   - ✓ Sign-in form renders (Username + Password).
2. POST to `WF_FLOW api/auth/login` with `{ username: "admin", password: "demo-password" }`.
   - → Step `login-credentials` runs server-side.
   - → User found, password verified, status not suspended, role looked up.
   - → MFA NOT needed (`admin.mfaEnabled === false`) → workflow advances directly to `login-issue-session`.
   - ✓ Response: `{ finished: true, ok: true, user: { username: 'admin', roleName: 'admin' } }`.
   - ✓ Set-Cookie header includes `SESSION_COOKIE` with `httpOnly`, `SameSite=Lax`, `path=/`, `Max-Age=…`.
3. Subsequent navigation reads the cookie via `useSession` — sidebar shows "Signed in as admin (admin)".

### Scenario 19.2: Login — wrong credentials

1. POST `auth/login` with `{ username: "admin", password: "WRONG" }`.
   - ✓ `login-credentials` returns `httpInputRequired(LoginForm, ctx, { password: "Invalid username or password" })`.
   - ✓ Response: `{ finished: false, inputRequired: { ..., errors: { password: "..." } } }`.
   - ✓ NO session cookie set.
   - ✓ UI re-renders the form with the inline error on the password field.
2. Same response shape for unknown username (no info leak — same generic message).

### Scenario 19.3: Login — suspended account is rejected

1. As admin, suspend `bob` (Scenario 8.5).
2. Sign out. Try to sign in as `bob` / `demo-password`.
   - ✓ `login-credentials` validates password successfully BUT then checks `user.status === "suspended"` and returns `httpInputRequired(LoginForm, ctx, { __form: "Account is suspended" })`.
   - ✓ UI renders a form-level error banner: `Account is suspended`.
   - ✓ NO session cookie set.
   - ✓ Even after the workflow's persisted state expires, the gate re-evaluates on every login attempt — un-suspending `bob` (Scenario 8.6 `Activate`) makes login succeed again immediately.

### Scenario 19.4: Login — MFA flow (alice)

`alice` has `mfaEnabled: true` in the seed.

1. POST `auth/login` with `{ username: "alice", password: "demo-password" }`.
   - → `login-credentials` succeeds; sets `ctx.mfaEnabled = true` and `ctx.otpCode = '123456'` (or whatever was generated); logs OTP to server console (`📧 [auth-otp] → alice@demo.test`).
   - → Workflow pauses at `login-verify-otp` since `needsMfa(ctx)` returned true.
   - ✓ Response: `{ finished: false, inputRequired: <MfaPincodeForm> }` — the form schema is the OTP-entry form.
2. Read the OTP from the server console (or test env mock) and POST to the same workflow endpoint with `{ code: "123456" }` and the workflow's resumption token.
   - ✓ `login-verify-otp` matches the code and continues to `login-issue-session`.
   - ✓ Session cookie set.
3. Submit a wrong OTP first.
   - ✓ Response: `httpInputRequired(MfaPincodeForm, ctx, { code: "Invalid code" })`.
   - ✓ Workflow stays at `login-verify-otp` for re-entry — `ctx.otpCode` is preserved.

### Scenario 19.5: Register — self-registration

1. Visit `/register`. Fill `username`, `email`, `password`, submit.
   - → `register-details` checks for username + email collisions; rejects with field error if either taken.
   - → On success, generates OTP, logs to console (`📧 [register-otp]`).
2. Read OTP from console; submit code.
   - → `register-verify-otp` accepts; `register-create-user` creates row with `roleId: viewer`, `status: 'active'`, hashed password.
   - → `register-issue-session` sets cookie.
3. Navigate to `/users` (after sign-in).
   - ✓ The new user appears in the table with `Status: active`, `Role: viewer`.

### Scenario 19.6: Register — duplicate username / email

1. Try to register with `username: "admin"`.
   - ✓ `register-details` returns `httpInputRequired(RegisterForm, ctx, { username: "Username already taken" })`.
2. Try with a unique username but `email: "admin@demo.test"`.
   - ✓ Returns `{ email: "Email already registered" }`.

### Scenario 19.7: Invite — admin creates invitation row

1. Sign in as `admin`. Click toolbar `Invite user` on `/users` (`navigate` action to `/users/invite`).
2. Fill `email: "newuser@demo.test"`, pick a role, submit.
   - → `invite-start` runs. Asserts session role is `admin`; otherwise throws 403.
   - → Checks for an existing user with that email; throws 409 if exists.
   - → Inserts a pending row: `{ username: "pending-<base36>", email, roleId, status: "invited", mfaEnabled: false, password: "", salt: "" }`.
   - → Sets `ctx.userId / ctx.email / ctx.roleId / ctx.roleName`.
   - → Workflow continues to `invite-send`.
3. Visit `/users` and confirm the new pending row.
   - ✓ Row visible with `Status: invited`, `Username: pending-…` (placeholder).

### Scenario 19.8: Invite — magic link → accept → activated

The `invite-send` step calls `outletEmail(ctx.email, "user-invite", { userId, roleId })`. The outlet pauses the workflow (`StepTTL(ONE_DAY_MS)`) and the email sender logs / sends a link of shape `/invite/<token>` (or the consumer's own pattern). The token references the persisted workflow state.

1. Continuing from 19.7 — read the magic link from the email-sender's log (in dev: stdout, in tests: a captured outlet sink).
2. Open an incognito session (or sign out as admin first). Visit the magic link `/invite/<token>`.
   - ✓ Page renders the `InviteAcceptForm` (username + password fields).
   - ✓ Email is shown read-only ("you're accepting an invite for `newuser@demo.test`").
3. Submit `{ username: "newuser", password: "secure-pass" }`.
   - → POST resumes the workflow at `invite-accept`.
   - → Username collision check — rejected with field error if `username` is taken (and the row is NOT this invitee's).
   - → On success: hashes password, updates the pending row to `{ username, password, salt, status: 'active' }`.
   - → `invite-issue-session` sets the session cookie.
4. New user is now signed in. Sidebar reads "Signed in as newuser (viewer)" (or whichever role).
5. Sign out + sign in as admin. Visit `/users`.
   - ✓ The previously-pending row now reads `Status: active`, `Username: newuser`, role as configured.
   - ✓ The placeholder `pending-…` username is gone — replaced by the chosen one in `invite-accept`.

### Scenario 19.9: Invite — duplicate email blocked

1. As admin, try to invite an email that already exists in the users table (e.g. `admin@demo.test`).
   - ✓ `invite-start` throws `HttpError(409, "A user with that email already exists")`.
   - ✓ UI surfaces the 409 as a form-level error.

### Scenario 19.10: Invite — non-admin blocked (server-side)

1. Sign in as `manager` (non-admin). Manually POST to `WF_FLOW api/users/invite` with valid input.
   - ✓ `invite-start` throws `HttpError(403, "Admin only")` — the role assertion is INSIDE the step, not just on the controller, so even a workflow resume can't bypass it.

### Scenario 19.11: Invite — magic link expiry (`StepTTL(ONE_DAY_MS)`)

1. Trigger an invite, get the magic link.
2. Wait beyond `ONE_DAY_MS` (or fast-forward server clock in tests).
3. Open the magic link.
   - ✓ Workflow state is gone; the resume request fails (404 / "expired" / similar).
   - ✓ The pending user row remains in `Status: invited` but unreachable via this invite — admin must re-invite or delete the placeholder.

---

## Section 20 — Framework rigidity / security

Every gate the framework applies on the client must also apply on the server. These scenarios attempt to bypass the client-side affordances and confirm the server independently rejects. **All assertions test the server's response, not just the UI.** Where indicated, the test simulates an attacker by issuing raw HTTP requests with `curl`-style payloads or `fetch` from a forged session.

### Scenario 20.1: Disabled action — direct POST is rejected

The client hides actions whose `disabled: perRow(...)` predicate returns true (Scenario 8.7), but a malicious client could still POST to the action endpoint with the disabled row's id.

1. As admin, find an `active` user (e.g. `manager`). The `Activate` action is disabled for this row (already active).
2. Manually POST `/api/db/tables/users/actions/activate` with `{ ids: { username: "manager" } }`.
   - → Server re-runs the gate predicate (`perRow((u) => u.status === 'active')`), receives `disabled === true`, rejects with `ActionDisabledError`.
   - ✓ Response: HTTP 400 (or 403) with `{ error: "ActionDisabledError", ... }`.
   - ✓ Database state unchanged.
3. Same for `Suspend` against an already-suspended user, `Resend invite` against an active user, etc.

### Scenario 20.2: ARBAC — role can't invoke action stripped from `/meta`

1. As `viewer` (no `update` permission for `users`), attempt to POST `/api/db/tables/users/actions/suspend` with valid ids.
   - → ARBAC interceptor evaluates the controller's `@ArbacAction("update")` requirement, rejects.
   - ✓ Response: HTTP 403.
   - ✓ Database unchanged.
2. The action is also absent from `viewer`'s `/meta.actions[]` (Scenario 8.10) — these two checks are independent (UI strip + server gate). Either alone would suffice; both apply.

### Scenario 20.3: ARBAC — column-level narrow on `$select`

The demo's ARBAC scopes restrict which columns `viewer` can read on certain tables (e.g. `users.password` and `users.salt` are admin-only).

1. As `viewer`, query `/api/db/tables/users/pages?$select=id,username,password,salt`.
   - → `transformProjection` overlay narrows `$select` server-side, dropping `password` + `salt`.
   - ✓ Response rows do NOT include `password` or `salt` keys.
2. As admin, the same projection succeeds with all fields.
3. The narrow is applied per-request (not per-controller), so role changes during a session take effect on next request.

### Scenario 20.4: Schema validation — bad `@InputForm` payload

1. Manually POST `/api/db/tables/users/actions/suspend` with `{ ids: [{username:"alice"}], input: { reason: 42 } }` (wrong type).
   - → `validatorPipe` validates `input` against `SuspendUsersInput.as`; rejects with `ClientValidationError`.
   - ✓ Response: HTTP 400 with field error.
2. Submit `{ input: { reason: "x" } }` (length below `@expect.minLength`).
   - ✓ Same rejection.
3. Submit completely unknown fields (`{ input: { sneakyAdmin: true } }`).
   - ✓ Schema validator rejects unknown keys.
4. UI reflects this as Scenario 8.20.

### Scenario 20.5: `forceFilters` cannot be bypassed via raw query

`/orders-cancelled` carries `forceFilters: { status: "cancelled" }` on the client.

1. The client builds the request URL — but the actual `forceFilters` lives in the controller too (or in the demo's `<AsTableRoot>` config with the server-side forced wherever the client controller ANDs them). In the demo's design, `forceFilters` is a CLIENT helper that ANDs into every request — so an attacker bypassing the client could send `?status='shipped'` directly to `/api/db/tables/orders/pages`.
2. **Note**: this is the demo's split — `forceFilters` is currently client-only. For server-enforced forcing, controllers should override `applyMetaOverlay` (see moost-db patterns) to strip / re-AND the filter on every read. The demo doesn't do this for `/orders-cancelled` — assertions here are about the contract WHEN the server enforces it.
3. In a server-enforced setup, raw GET `/api/db/tables/orders/pages` returns rows for the natural query; admin can still fetch cancelled-only via `/orders-cancelled` UI, but no one (admin or otherwise) can hit the route configured with forceFilters and skip the AND.

### Scenario 20.6: Preset isolation — can't read another user's private preset

The presets controller enforces a read gate `$or: [{ user: <self> }, { public: true, preset: true }]` (`AsPresetsController`).

1. As `manager`, save a private preset `Manager view`.
2. Sign in as `viewer`. GET `/api/db/_presets/query?app=vuedemo&tableKey=users&type{preset,userConf}`.
   - ✓ `Manager view` is NOT in the response. `viewer` only sees own + public rows.
3. Try to GET `/_presets/one/<manager's preset id>` directly.
   - → Server `findOne` filtered by the same gate; returns 404.
   - ✓ No identifier leak (404, not 403).

### Scenario 20.7: Preset edit — can't modify another user's preset

1. Sign in as `viewer`. PATCH `/_presets/` with `{ id: "<manager's private preset id>", data: { label: "Hacked" } }`.
   - → Owner-check fails server-side (the row's `user` field doesn't match session); 403 / 404.
   - ✓ Database unchanged.
2. Same for DELETE — `viewer` cannot delete `manager`'s preset.

### Scenario 20.8: Preset public toggle requires `canPublish` capability

1. As a user without publish permission, POST `/_presets/` with `{ data: { public: true, ... } }`.
   - → Server checks `canPublish` capability; rejects.
   - ✓ Response: 403.
2. The Manage dialog's eye icon is also hidden for this user (Scenario 11.9) — both the UI hide AND the server reject must hold.
3. Public-label uniqueness on `(app, tableKey, label)` — try to publish a preset with a duplicate public label.
   - ✓ Server rejects with 409 (label conflict).

### Scenario 20.9: Reserved-id namespace — system rows are immutable

`AsPresetsController` reserves id namespaces (`sys:`, `uconf:`, `aconf:`) for system / per-user / per-app rows.

1. Try to POST `{ id: "sys:standard", ... }` to override the standard system preset.
   - ✓ Server rejects (reserved namespace).
2. Try to PATCH or DELETE `sys:standard`.
   - ✓ Same rejection — system rows are immutable from the public API.

### Scenario 20.10: Identity scrubbing on `userConf` / `appConf` writes

`appConf` / `userConf` rows live in the same table as presets but should never carry preset-shape identity fields.

1. POST to write an `appConf` with `{ data: { appearance: 'dark', public: true, label: "evil" } }`.
   - → `sanitiseUserConfData` (or equivalent) strips `public` / `label` / `publicLabel` / `aspects` from the wire payload before insert.
   - ✓ Database row stores only `{ appearance: 'dark' }`.
   - ✓ Reading the row back returns the sanitised shape.

### Scenario 20.11: Per-user preset cap — can't bypass via insertMany

The controller declares a per-user cap; `insertMany` and `replaceMany` are explicitly rejected to close the cap-bypass path.

1. POST `/_presets/insert-many` with an array of 100 preset rows.
   - ✓ Server rejects (`insertMany` not supported).
2. POST single inserts up to the cap, then POST one more.
   - ✓ The (cap+1)-th request is rejected with a quota error.
3. When the cap is reduced after rows already exist (grandfathered), existing rows are accepted on update; new inserts beyond the new cap are still rejected.

### Scenario 20.12: Anonymous access — `@Authenticate(SessionGuard)` rejects

1. With NO session cookie, GET `/api/db/tables/users/meta`.
   - ✓ Response: HTTP 401.
2. POST `/api/db/tables/users/actions/suspend` without auth.
   - ✓ HTTP 401.
3. The login + register endpoints are the only public-readable surfaces.

### Scenario 20.13: Session tampering — bad signature rejected

1. Decode the session cookie's payload, modify `roleName: "admin"`, re-encode (without re-signing — attacker doesn't have the secret).
   - ✓ `SessionService.decode` HMAC check fails; treated as no session → 401.
2. Replay an old session for a deleted user.
   - → `useSession` returns the payload (HMAC valid), but downstream queries fail to find the user — controller-level checks (e.g. `usersTable.findOne({ id: userId })`) return null → 401 / 403 cascade.
3. Session expires after `SESSION_MAX_AGE_SEC` — old cookie is rejected (`Set-Cookie` `Max-Age` semantics + server-side `issuedAt` check if implemented).

### Scenario 20.14: Filter values are escaped — no SQL/NoSQL injection

The Uniquery parser produces a typed AST; the SQL adapter parameterizes every value (`?` placeholders / pg `$N`).

1. Apply a filter `Username = 'admin'; DROP TABLE users; --`.
   - ✓ The single quotes inside the value are encoded; the SQL adapter binds the whole string as one parameter.
   - ✓ No table dropped; query result is empty (no user with that literal name).
2. Try `Username ~ '/admin' OR 1=1/'` (regex injection).
   - ✓ Parsed as a regex value, applied via the dialect's REGEXP function with the value as a parameter.
   - ✓ Result is filtered against the literal pattern, not arbitrary SQL.

### Scenario 20.15: Cross-table action invocation — wrong endpoint rejected

1. Take a valid action payload for `users.suspend`.
2. POST it to `/api/db/tables/orders/actions/suspend`.
   - ✓ Server returns 404 (`orders` has no `suspend` action) — actions are scoped per controller.
3. Take a valid `id` for `users` and POST to `users.activate` with that id.
   - → `id` (e.g. `{ username: "alice" }`) goes through; activation runs — this is a legitimate request, not a hack.
4. Identifier-shape tampering (extra unknown fields, heterogeneous shapes, bare scalars) is covered by Scenario 20.17.

### Scenario 20.16: TOCTOU — action gate re-evaluates per-call

The gate runs on the row's CURRENT state, not a stale snapshot.

1. As admin, open `bob`'s row menu (status `pending`); see `Activate` available.
2. In another tab, suspend `bob` (admin can do both since the predicate fires on `status === 'active'` for activate, which is false for both pending AND suspended — actually re-check). Use a different scenario where one admin's action invalidates another's.
3. Alice (admin in another tab) has a stale `$actions[]` showing `Activate` available; she clicks it.
   - → Server re-evaluates the predicate with bob's CURRENT row data (now `suspended`). If the rule says activate-from-pending only, server rejects.
   - ✓ Response: `ActionDisabledError`.
   - ✓ Alice's UI re-fetches the row; the action becomes unavailable in her menu.

### Scenario 20.17: Identifier object strict-mode — extra fields rejected

Per moost-db invariant #11, action `ids` payload must EXACTLY match a legitimate identification (PK or any `@db.index.unique` group); unknown fields are rejected.

1. Send `{ ids: { username: "alice", "; DROP TABLE users; --": 1 } }`.
   - ✓ Server rejects: 400 (unknown field).
2. Send `{ ids: { id: 5, username: "alice" }}` when neither `id` alone NOR `username` alone matches.
   - ✓ 400 — not a legitimate single-identifier shape.
3. Send `{ ids: "alice" }` (bare scalar, not an object).
   - ✓ 400 — body root must be an object envelope.
4. Send `{ ids: [{ username: "alice" }, { id: 5 }] }` (heterogeneous identifier shapes in one bulk call).
   - ✓ Either rejected or normalised — server enforces a single identifier shape per bulk.

### Scenario 20.18: `@db.depth.limit` blocks nested writes

The default `@db.depth.limit 0` server-rejects any nested write.

1. Try to PATCH `/api/db/tables/orders/` with `{ id: 1, customer: { id: 2, name: "evil" }}` (nested write into the customer relation).
   - → Server checks the table's `@db.depth.limit`; default is `0` → rejects nested payload.
   - ✓ Response: HTTP 400.
2. Even with `depth.limit ≥ 1`, the nested target's column-level ARBAC still applies — viewer can't write to a related table they don't own.

### Scenario 20.19: `@db.json` columns aren't filterable / sortable server-side either

The client forces these flags off (Scenario 3.2), but a malicious client could still send a sort or filter on a JSON column.

1. Manually GET `/api/db/tables/customers/pages?$sort=address:1`.
   - → Adapter rejects sorting on a JSON column (or the SQL layer fails) — atscript-db emits a 400 (`sort not supported on @db.json field`).
   - ✓ Database unchanged; rows not sorted.
2. Same for filtering: `/customers/pages?address~='/foo/'`.
   - ✓ Rejected.

### Scenario 20.20: CSRF — same-site cookie semantics

The session cookie is set with `SameSite=Lax`. Cross-site POSTs (e.g. an attacker's malicious page POSTing to `/api/db/tables/users/actions/suspend`) won't carry the cookie.

1. Open an attacker page on a different origin; have it POST a forged action.
   - ✓ Browser does not include `SESSION_COOKIE` (Lax blocks unsafe cross-site requests).
   - ✓ Server returns 401.
2. Top-level GET navigation DOES carry the cookie (Lax permits same-site GET) — but actions are POST/PATCH/DELETE, which are blocked.

### Scenario 20.21: Audit log — every mutation is recorded

Mutating actions are persisted to the audit log via the demo's `auditInterceptor`.

1. Suspend a user.
   - ✓ A new row appears in `audit_log` with `action: "suspend"`, `userId: <admin's>`, `entityType: "users"`, `entityId: <suspended>`, `createdAt` = now.
2. The audit row's `userId` reflects the ACTOR (admin), not the affected user — this is the test for log integrity (an attacker cannot redirect blame).
3. Sign in as `admin` and visit `/audit_log` to confirm the audit entry is present.
4. Failed actions (rejected at gate / validator) MAY also be audited — verify the demo's policy.

---

## Coverage summary

| Surface                                                                                                                                                                                                                                                  | Status                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Cell types: text, number, decimal/currency literal + ref, decimal/unit, date, datetime, relative, boolean (✓/✗), enum (custom-type), enum (named-component), array of primitives (chips), array of objects (JSON popover), object (JSON popover), FK ref | **Covered**                                                                         |
| Empty cells (null branch) on date / relative / object                                                                                                                                                                                                    | **Covered**                                                                         |
| Flat-flattened nested objects → leaves only                                                                                                                                                                                                              | **Covered**                                                                         |
| `@db.json` columns NOT filterable / sortable                                                                                                                                                                                                             | **Covered**                                                                         |
| `@ui.table.type` / `@ui.table.component` overrides                                                                                                                                                                                                       | **Covered**                                                                         |
| Filter operators eq/ne/contains/starts/ends/gt/gte/lt/lte/bw/null/notNull/regex                                                                                                                                                                          | **Covered**                                                                         |
| Per-column filter dialog: `Values` + `Conditions` tabs, multi-tab chips                                                                                                                                                                                  | **Covered**                                                                         |
| Value-help on FK column — search, scroll, select / deselect, multi-page                                                                                                                                                                                  | **Covered**                                                                         |
| Value-help on union/enum column — static options, optional search                                                                                                                                                                                        | **Covered**                                                                         |
| `forceFilters` (sticky) — server-only, AND with user filters and presets                                                                                                                                                                                 | **Covered**                                                                         |
| Pill-input fast path (no dialog)                                                                                                                                                                                                                         | **Covered**                                                                         |
| Pill-input prefix/wildcard syntax (`*x*`, `>=`, `lo...hi`, `<empty>`, `/regex/`, …)                                                                                                                                                                      | **Covered**                                                                         |
| Pill-input hotkeys (`Enter`, `Esc`, `F4` opens dialog, `Tab` between pills)                                                                                                                                                                              | **Covered**                                                                         |
| Pill dropdown — single-load contract (no redundant calls), search FK + union, select/unselect, scroll-to-load                                                                                                                                            | **Covered**                                                                         |
| Chip strip — remove via `×`, horizontal scroll on overflow, auto-scroll-to-end, Backspace pops chips, dropdown `Clear all`, field `Reset`                                                                                                                | **Covered**                                                                         |
| Table Settings dialog: 3 tabs, search, reorder, select/unselect, only query-affecting changes refetch                                                                                                                                                    | **Covered**                                                                         |
| URL bridge — direct load, outbound emit, allowlist, encoding round-trip                                                                                                                                                                                  | **Covered**                                                                         |
| URL bridge — filter operator change updates URL, copy-paste full state recovery                                                                                                                                                                          | **Covered**                                                                         |
| Sort cycle, multi-sort, sortable=false                                                                                                                                                                                                                   | **Covered**                                                                         |
| Actions: navigate (`$1`), backend (`@InputForm`), custom (table + row), `__remove`, `disabled` predicate, `onDisabledRows: 'skip'`, `promptText` tuple, `$actions=true` per-row                                                                          | **Covered**                                                                         |
| Actions: ARBAC role-side filtering (`@ArbacAction` strips from `/meta`)                                                                                                                                                                                  | **Covered**                                                                         |
| Actions: server-side gate re-evaluation on invocation                                                                                                                                                                                                    | **Covered**                                                                         |
| Actions: `@InputForm` payload validation surfacing inline errors                                                                                                                                                                                         | **Covered**                                                                         |
| Actions: column placement modes (`first` / `last` / `merge-select`, with select-mode interaction)                                                                                                                                                        | **Covered**                                                                         |
| Actions: cell rendering by count (empty / single labelled / single icon-square / dropdown)                                                                                                                                                               | **Covered**                                                                         |
| Actions: synthetic `__remove` presence rules (write perm + `noRowDelete` + `crud.remove`)                                                                                                                                                                | **Covered**                                                                         |
| Actions: default action interaction with row main-action (dblclick / Enter)                                                                                                                                                                              | **Covered**                                                                         |
| Actions: `intent` → vunor scope across single-button cell, dropdown menu items, confirm dialog button, action-form submit button                                                                                                                         | **Covered**                                                                         |
| Actions: input form header — target id chips with `+N more…` overflow                                                                                                                                                                                    | **Covered**                                                                         |
| Mobile / responsive: filter / settings / action-form / preset-manager dialogs go full-screen below `sm`                                                                                                                                                  | **Covered**                                                                         |
| Mobile: confirm dialog stays compact (NOT full-screen)                                                                                                                                                                                                   | **Covered**                                                                         |
| Mobile: density token interacts with full-screen layout; touch-scroll + chip swipe inside dialog                                                                                                                                                         | **Covered**                                                                         |
| Selection: multi-toggle, trim default                                                                                                                                                                                                                    | **Covered** (persist mode covered by value-help dialog suite — not duplicated here) |
| Pagination: page nav, rows-per-page, window-mode infinite scroll                                                                                                                                                                                         | **Covered**                                                                         |
| Presets: standard preset on first load                                                                                                                                                                                                                   | **Covered**                                                                         |
| Presets: save with selective aspects (filters-only / columns-only / all)                                                                                                                                                                                 | **Covered**                                                                         |
| Presets: apply — only saved aspects mutate state                                                                                                                                                                                                         | **Covered**                                                                         |
| Presets: Manage dialog — set-default, rename inline, public toggle, mark-for-delete, search by name + owner, batched Save                                                                                                                                | **Covered**                                                                         |
| Presets: bootstrap-vs-URL race regression                                                                                                                                                                                                                | **Covered**                                                                         |
| Presets: `forceFilters` overlay survives preset apply                                                                                                                                                                                                    | **Covered**                                                                         |
| Presets: `canPublish` capability gates the public toggle                                                                                                                                                                                                 | **Covered**                                                                         |
| Column header — menu items gated by capability + config (`hasAnyItem`)                                                                                                                                                                                   | **Covered**                                                                         |
| Column header — menu hotkeys (`a`/`d` sort, `f` filter, `c` clear, `w` reset width, `h` hide)                                                                                                                                                            | **Covered**                                                                         |
| Column header — drag-resize, double-click auto-fit, drag-reorder                                                                                                                                                                                         | **Covered**                                                                         |
| App-level config (`useAppPrefs`) — single-mount load, broadcast across instances                                                                                                                                                                         | **Covered**                                                                         |
| App-level config — appearance / language / timezone / density / dateFormat / firstDayOfWeek / customJson save & reload                                                                                                                                   | **Covered**                                                                         |
| App-level config — locale + timezone actually reformat date/datetime/number cells                                                                                                                                                                        | **Covered**                                                                         |
| Workflows: login happy path / wrong creds / suspended blocked / MFA OTP step                                                                                                                                                                             | **Covered**                                                                         |
| Workflows: register self-service + duplicate username/email rejection                                                                                                                                                                                    | **Covered**                                                                         |
| Workflows: invite (admin) → magic link → accept → user activated end-to-end                                                                                                                                                                              | **Covered**                                                                         |
| Workflows: invite duplicate-email + non-admin gate + magic-link expiry (`StepTTL`)                                                                                                                                                                       | **Covered**                                                                         |
| Security: disabled action — direct POST rejected (server re-evaluates `disabled` predicate)                                                                                                                                                              | **Covered**                                                                         |
| Security: ARBAC role gate independent on `/meta` strip + invocation reject                                                                                                                                                                               | **Covered**                                                                         |
| Security: column-level `$select` narrow per scope (`transformProjection`)                                                                                                                                                                                | **Covered**                                                                         |
| Security: `@InputForm` schema validation rejects bad/unknown payloads                                                                                                                                                                                    | **Covered**                                                                         |
| Security: `forceFilters` server-enforced contract (where the controller wires it)                                                                                                                                                                        | **Covered** (with note on demo split)                                               |
| Security: preset isolation — read / edit / delete owner-gated; reserved-id namespaces immutable                                                                                                                                                          | **Covered**                                                                         |
| Security: `canPublish` capability + public-label uniqueness                                                                                                                                                                                              | **Covered**                                                                         |
| Security: identity scrubbing on `userConf` / `appConf` writes                                                                                                                                                                                            | **Covered**                                                                         |
| Security: per-user preset cap; `insertMany` / `replaceMany` rejected                                                                                                                                                                                     | **Covered**                                                                         |
| Security: anonymous access blocked; session signature tampering / expiry rejected                                                                                                                                                                        | **Covered**                                                                         |
| Security: filter values parameterized (no SQL/NoSQL injection); cross-table action endpoint isolation                                                                                                                                                    | **Covered**                                                                         |
| Security: TOCTOU — action gate re-runs per-call; identifier strict-mode rejects unknown fields                                                                                                                                                           | **Covered**                                                                         |
| Security: `@db.depth.limit` blocks nested writes by default                                                                                                                                                                                              | **Covered**                                                                         |
| Security: `@db.json` not sortable/filterable server-side (defense in depth)                                                                                                                                                                              | **Covered**                                                                         |
| Security: SameSite=Lax cookie blocks cross-site action POSTs                                                                                                                                                                                             | **Covered**                                                                         |
| Security: audit log records mutations with actor (not affected user)                                                                                                                                                                                     | **Covered**                                                                         |
| Loading skeletons via injected latency (50 ms / 100 ms)                                                                                                                                                                                                  | **Covered**                                                                         |
| Empty result, query error, ARBAC permission gating                                                                                                                                                                                                       | **Covered** (skeleton; flesh out as needed)                                         |

### Known coverage gaps (future scenarios)

- `selectionPersistence: 'clear'` route — no demo path; covered indirectly by tests.
- `queryOnMount: false` / `blockQuery: true` — no demo path.
- `forceSorters` — no demo path.
- Slot overrides on `<AsTableRoot>` (`#empty-state`, `#error-state`, custom `#default` toolbar) — no demo path.
- `controls={…}` skin overrides for `filterDialog`, `configDialog`, `presetDialog`, `confirmDialog`, `actionFormDialog` — only defaults exercised.
- `@db.patch.strategy 'merge'`, `@db.column.collate`, `@db.default.uuid`, `@db.search.*` — no schema in demo uses these.
