# Table Packages Spec

Spec for `@atscript/ui-table` (framework-agnostic) and `@atscript/vue-table` (Vue 3 components), based on `not-sap/packages/ui` SmartTable architecture adapted for atscript metadata.

---

## Performance Requirements

Performance is a first-class priority. Tables render large datasets and every unnecessary re-render or allocation matters.

**Vue reactivity:**
- Prefer `shallowRef` over `ref` for arrays/objects that are replaced wholesale (e.g. `results`, `columns`). Avoid deep reactivity on large data.
- Use `computed` with stable dependencies — avoid computed that depend on entire reactive objects when only a single property is needed.
- Use `triggerRef` / manual triggering over replacing large reactive structures when only a subset changed.
- Avoid watchers on deep objects. Watch specific keys or use `watchEffect` with narrow access patterns.
- Debounce query triggers (filter/sort/column changes) to batch rapid user interactions into a single fetch.

**Rendering:**
- Virtual scrolling by default for any non-trivial row count. The virtualizer must be the happy path, not an opt-in.
- Avoid `v-for` over full row arrays without virtualization.
- Use `v-memo` or keyed caching for cells that depend only on row data + column def (no reactive dependencies that change on every frame).
- Header cells and filter tokens should not re-render when row data changes.
- Minimize slot prop objects — avoid creating new objects on every render. Reuse stable references where possible.

**Data flow:**
- Never copy the full results array for derived computations — use index-based access or computed slices.
- Filter-to-Uniquery conversion must be allocation-light — avoid intermediate array/object copies per filter condition.
- Column width calculations, sort comparisons, and cell formatting should be cached or memoized, not recomputed per render cycle.

---

## Ecosystem Unity: Reuse ui-core

Tables and forms are two views of the same underlying type metadata. They must share as much infrastructure as possible through `@atscript/ui-core`.

**Already shared (must stay shared):**
- **Annotation keys** (`ui.placeholder`, `ui.hidden`, `ui.component`, `meta.label`, etc.) — one definition for both form fields and table columns.
- **FieldResolver** — the pluggable resolver (`resolveFieldProp`, `resolveFormProp`, `hasComputedAnnotations`) works identically for column and field metadata. ui-table must use the same resolver, not a parallel one.
- **Path utilities** (`getByPath`, `setByPath`) — cell value access in tables and field value access in forms use the same helpers.
- **Table types** — `ColumnDef`, `TableDef`, `MetaResponse`, etc. already live in `ui-core/src/table/` (see Existing Foundation below).

**Form ↔ Table integration points:**
- When a table row is opened for editing, the form's `FormDef` and the table's `ColumnDef` derive from the same atscript type. Column labels, visibility, ordering, and component overrides should be consistent without re-specifying them.
- Inline cell editing should reuse form field components (from the types map) — not a parallel set of "table editor" components.
- Validation (`getFormValidator`, `createFieldValidator`) is shared — inline edits and full-form edits use the same validation pipeline.

**Rule:** Before adding a new utility, type, or resolver to ui-table or vue-table, check whether it belongs in ui-core. If both form and table would benefit, it goes in ui-core.

---

## Reference: not-sap SmartTable Architecture

### Component Hierarchy

```
ODataEntitySet (renderless — provides metadata)
  └─ SmartTableRoot (renderless — provides all table state via useSmartTablePI)
       ├─ SmartTable (entry point — selection wrapper via radix ListboxRoot)
       │    └─ SmartTableBase (HTML <table> rendering)
       │         ├─ SmartTableHeaderCell (column header + dropdown menu)
       │         ├─ SmartTableVirtualizer (@tanstack/vue-virtual)
       │         ├─ SmartFieldValue (cell value formatting)
       │         └─ F4Dialog (inline filter dialog, opened from header)
       ├─ SmartTableConfigDialog (columns/filters/sorters config modal)
       │    ├─ SmartTableConfigFieldsSelector (orderable field list)
       │    └─ SmartTableConfigSorters (sort direction list)
       ├─ SmartTableFilters (filter bar)
       │    └─ SmartTableFilter (per-field filter token + F4Dialog)
       │         ├─ SmartTableFavFiltersList
       │         ├─ SmartTableFavFiltersMenu
       │         ├─ SmartTableSaveFavFiltersDialog
       │         └─ SmartTableLoadFavFiltersDialog
       ├─ SmartTableCreatePreset
       └─ SmartTableManagePresets
```

### Key Techniques

| Technique | How not-sap does it |
|-----------|---------------------|
| **State management** | Provide/Inject composable (`useSmartTablePI`) — single source of truth for columns, filters, sorters, results, selection, pagination |
| **Metadata → columns** | OData `EntitySet` fields with `$label`, `$sortable`, `$filterable`, `$MaxLength` |
| **Query execution** | Watches `[columnsNames, sorters, fieldsFilters]` → debounced `query()` → `model.read()` with OData params |
| **Filter system** | Per-field typed filters (`TODataTypedFilterValue`) with conditions: eq, ne, lt, le, gt, ge, starts, ends, contains, bw, empty, etc. |
| **Filter conversion** | `fieldsFiltersToODataFilters()` → positive conditions OR'd, negative AND'd |
| **Virtual scrolling** | `@tanstack/vue-virtual` via `SmartTableVirtualizer` wrapper |
| **Selection** | Radix `ListboxRoot` for single/multi select with `selectAll` toggle |
| **Pagination** | Strategies: hard-limit, pagination, load-more-btn, scroll-to-load |
| **Column config** | Dialog with orderable list, dialog model is a copy (cancel-safe) |
| **Presets/variants** | Save/load full table state (columns, filters, sorters) to backend |
| **Cell rendering** | Named slots `#cell-{fieldName}` for custom cells, default uses SmartFieldValue |
| **Column reorder** | Drag-and-drop in header |
| **Column width** | Computed from `$MaxLength`: `min(max(len * 0.6, 12), 22) + 'em'` |

---

## Existing Foundation

### ui-core (`packages/ui-core/src/table/`)

- **`types.ts`** — `TableDef`, `ColumnDef`, `MetaResponse`, `SortControl`, `PaginationControl`, `TableQueryState`
- **`create-table-def.ts`** — `createTableDef(meta)` deserializes atscript type, flattens fields, builds `ColumnDef[]` from annotations
- **`column-resolver.ts`** — `getVisibleColumns()`, `getSortableColumns()`, `getFilterableColumns()`, `getColumn()`

This is the equivalent of not-sap's `ODataEntitySet.pi.ts` metadata layer — already done.

### @atscript/db-client (external — `../atscript-db/packages/db-client`)

HTTP client with built-in query builder. **No need to duplicate query building.**

- `Client.meta()` — fetches + caches `/meta` endpoint → `MetaResponse`
- `Client.findMany(query)` — GET /query with Uniquery filter/sort/pagination
- `Client.findManyWithCount(query)` — GET /pages → `{ data, count }`
- `Client.pages(query)` — GET /pages → `PagesResponse` with full pagination metadata
- `Client.search(text, query?, indexName?)` — full-text search with `$search`
- `Client.aggregate(query)` — groupBy with aggregate functions
- `Client.count(query)` — count only

Query is expressed via **Uniquery** objects from `@uniqu/core`:
```ts
{
  filter: { status: "active", age: { $gt: 18 } },
  controls: { $sort: { name: 1 }, $limit: 50, $skip: 0 }
}
```

The vue-table composables will use `Client` directly — they build `Uniquery` objects from UI filter state and pass them to client methods.

---

## Package Structure

### `@atscript/ui-table` (framework-agnostic)

Extends `ui-core/table/` with filter model, filter-to-Uniquery conversion, and preset serialization — no Vue dependency, no query builder (db-client handles that).

```
packages/ui-table/
├── src/
│   ├── filters/
│   │   ├── filter-types.ts         # FilterCondition, FilterValue, FieldFilters — typed filter model
│   │   ├── filter-conditions.ts    # condition helpers: isFilled, has2ndValue, conditionLabel, conditionsList
│   │   ├── filter-conditions-map.ts # available conditions per column type (text, number, date, boolean)
│   │   ├── filters-to-uniquery.ts  # filtersToUniqueryFilter() — converts FieldFilters → Uniquery FilterExpr
│   │   ├── escape-regex.ts         # escapeRegex() — escapes user input for $regex conversion
│   │   └── date-shortcuts.ts       # date range shortcuts (Last 7 Days, Month to Date, etc.)
│   ├── presets/
│   │   ├── preset-types.ts         # Preset, PresetSnapshot
│   │   └── preset-serializer.ts    # serialize/deserialize table state for storage
│   └── index.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### `@atscript/vue-table` (Vue 3 components)

Vue composables + default components. Same pattern as vue-form: provides unstyled default components (plain HTML table, inputs, buttons) that work out of the box. User overrides via types map to plug in their design system (vunor, radix, etc.).

```
packages/vue-table/
├── src/
│   ├── composables/
│   │   ├── use-table.ts            # useTable(client) → { tableDef, state, query, ... }
│   │   ├── use-table-state.ts      # provide/inject — core table state (columns, sorters, filters, results, selection)
│   │   ├── use-table-query.ts      # query execution — watches state, builds Uniquery, calls client
│   │   ├── use-table-filter.ts     # per-field filter state, favorite filters
│   │   ├── use-table-selection.ts  # single/multi select, selectAll
│   │   └── use-table-presets.ts    # preset CRUD, apply/save/delete
│   ├── components/
│   │   ├── as-table-root.vue       # renderless — provides table state + manages dialogs
│   │   ├── as-table.vue            # entry point — wraps table with selection context
│   │   ├── as-table-base.vue       # HTML <table> renderer with sticky headers, column highlight
│   │   ├── as-table-header-cell.vue  # column header with sort/filter/hide dropdown menu
│   │   ├── as-table-virtualizer.vue  # @tanstack/vue-virtual wrapper
│   │   ├── as-table-cell-value.vue   # default cell value renderer (type-aware formatting)
│   │   ├── defaults/
│   │   │   ├── as-table-default.vue             # default table layout (toolbar + table + pagination)
│   │   │   ├── as-table-toolbar.vue             # default toolbar (search input, filter bar, config button)
│   │   │   ├── as-table-pagination.vue          # default pagination controls (page size, prev/next, load more)
│   │   │   ├── as-filter-input.vue              # default filter value input (text/number/date by column type)
│   │   │   ├── as-filter-token.vue              # default filter chip/tag
│   │   │   ├── as-column-menu.vue               # default column header dropdown (sort/filter/hide)
│   │   │   ├── as-config-dialog.vue             # default config dialog (columns/filters/sorters tabs)
│   │   │   ├── as-fields-selector.vue           # default orderable checkbox list
│   │   │   ├── as-sorters-config.vue            # default sorter list with direction toggle
│   │   │   └── index.ts                         # createDefaultTableComponents() — type→component map
│   │   ├── filters/
│   │   │   ├── as-table-filters.vue             # filter bar (shows active filter tokens)
│   │   │   ├── as-table-filter.vue              # single field filter with dialog trigger
│   │   │   └── as-filter-conditions.vue         # condition rows (operator select + value inputs)
│   │   ├── presets/
│   │   │   ├── as-table-create-preset.vue
│   │   │   └── as-table-manage-presets.vue
│   │   └── internal/
│   │       ├── as-orderable-list.vue            # generic drag-and-drop reorderable list
│   │       └── as-drag-scroll.vue               # horizontal drag-to-scroll helper
│   ├── types.ts                    # TAsTableComponents (types map), TAsTableSlots
│   └── index.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Key Differences from not-sap

| Aspect | not-sap | atscript |
|--------|---------|----------|
| **Metadata source** | OData `$metadata` XML → `EntitySet` fields | moost-db `/meta` JSON → `TableDef` via `createTableDef()` |
| **Query execution** | `model.read(entitySet, params)` with OData URL | `Client.findManyWithCount(uniquery)` via db-client |
| **Filter conversion** | `fieldsFiltersToODataFilters()` → OData $filter | `filtersToUniqueryFilter()` → Uniquery FilterExpr |
| **Value help (F4)** | OData `ValueList` annotation → separate entity set query | Open question — requires "dictionary" concept design (see below) |
| **UI components** | Hardcoded vunor (buttons, inputs, dialogs, tabs) | Unstyled HTML defaults + types map override (same as vue-form) |
| **Presets storage** | SAP LRep Flex service | Pluggable — localStorage default, custom backend via adapter |
| **Type info** | OData EDM types (Edm.String, Edm.DateTime, etc.) | atscript designType + tags (string, number, boolean, date, email, etc.) |

### Open Question: Value Help / Dictionaries

In not-sap, the F4 (Value Help) dialog is a major feature: a full sub-table dialog for selecting filter values, powered by OData `Common.ValueList` annotation that points to another entity set with parameter mappings (In/Out/DisplayOnly).

For atscript, this requires designing a **"dictionary" concept** end-to-end:
- **Annotation layer** — how to annotate a field as having value help (e.g. `@ui.dictionary` pointing to a relation, or referencing another atscript type)
- **moost-db layer** — a distinct values endpoint (or reuse `Client.aggregate` with `$groupBy`) + relation-based value help queries
- **UI layer** — a value help dialog component (types map entry `valueHelpDialog`), integrated into the filter dialog

This is deferred to a future design pass. The filter system works without value help — users type values manually. Value help adds convenience for enum-like and relational fields but is not blocking.

---

## Filter Condition Types

UI filter conditions mapped to Uniquery filter expressions:

| Condition | Label | Uniquery expr | Example |
|-----------|-------|---------------|---------|
| `eq` | equals | `{ field: value }` | `{ status: "active" }` |
| `ne` | not equals | `{ field: { $ne: value } }` | `{ status: { $ne: "active" } }` |
| `gt` | greater than | `{ field: { $gt: value } }` | `{ age: { $gt: 18 } }` |
| `gte` | greater or equal | `{ field: { $gte: value } }` | `{ age: { $gte: 18 } }` |
| `lt` | less than | `{ field: { $lt: value } }` | `{ price: { $lt: 100 } }` |
| `lte` | less or equal | `{ field: { $lte: value } }` | `{ price: { $lte: 100 } }` |
| `contains` | contains | `{ field: { $regex: value } }` | `{ name: { $regex: "john" } }` |
| `starts` | starts with | `{ field: { $regex: "^" + value } }` | `{ name: { $regex: "^Jo" } }` |
| `ends` | ends with | `{ field: { $regex: value + "$" } }` | `{ email: { $regex: "gmail\\.com$" } }` |
| `bw` | between | `{ field: { $gte: lo, $lte: hi } }` | `{ price: { $gte: 10, $lte: 100 } }` |
| `in` | in set | `{ field: { $in: [...] } }` | `{ status: { $in: ["a", "b"] } }` |
| `nin` | not in set | `{ field: { $nin: [...] } }` | `{ status: { $nin: ["a", "b"] } }` |
| `null` | is empty | `{ field: { $exists: false } }` | `{ deletedAt: { $exists: false } }` |
| `notNull` | is not empty | `{ field: { $exists: true } }` | `{ deletedAt: { $exists: true } }` |
| `regex` | matches pattern | `{ field: { $regex: pattern } }` | `{ code: { $regex: "^[A-Z]{3}" } }` |

**Regex conversion note:** Uniquery's `ComparisonOp` does not include `$contains`, `$starts`, or `$ends` natively. `filtersToUniqueryFilter()` converts these UI conditions to `$regex`:
- `contains` → `$regex: escaped(value)`
- `starts` → `$regex: "^" + escaped(value)`
- `ends` → `$regex: escaped(value) + "$"`

User input must be regex-escaped before embedding (e.g. `.` → `\\.`, `(` → `\\(`). The `escapeRegex(input: string): string` helper in `ui-table/src/filters/` handles this.

**`$exists` for null checks:** `null` and `notNull` conditions map to `{ $exists: false }` and `{ $exists: true }`. A null value is treated as "field does not exist" — there is no distinction between null and absent.

### Filter Combination Logic

Multiple conditions are combined following the same logic as not-sap:

1. **Per field:** conditions are split into **inclusion** (positive) and **exclusion** (negative, prefixed with `not`).
   - Inclusion conditions are **OR'd** — e.g. `eq "A"` OR `eq "B"` → match either.
   - Exclusion conditions are **AND'd** — e.g. `ne "X"` AND `ne "Y"` → must exclude both.
2. **Across fields:** all field groups are **AND'd** at the top level.

Example with two fields:
```ts
// UI state:
//   status: [{ type: "eq", value: ["active"] }, { type: "eq", value: ["pending"] }]
//   name:   [{ type: "contains", value: ["john"] }, { type: "ne", value: ["admin"] }]
//
// Converts to:
{
  $and: [
    { $or: [{ status: "active" }, { status: "pending" }] },          // inclusion OR'd
    { $or: [{ name: { $regex: "john" } }] },                         // inclusion OR'd (single)
    { $and: [{ name: { $ne: "admin" } }] },                          // exclusion AND'd
  ]
}
```

### Date Filter Shortcuts

For date-type columns, the filter dialog offers quick-action shortcut buttons that insert a pre-filled `bw` (between) condition:

| Shortcut | Range |
|----------|-------|
| Last 7 Days | 7 days ago → today |
| Last 30 Days | 30 days ago → today |
| Month to Date | 1st of current month → today |
| Last 90 Days | 90 days ago → today |
| Last 6 Months | 6 months ago → today |
| Last 12 Months | 12 months ago → today |
| Year to Date | Jan 1 of current year → today |

Shortcuts calculate relative to the current date at click time. When applied, they replace existing conditions for that field with a single `bw` condition using ISO date strings (`YYYY-MM-DD`).

### Available Conditions per Column Type

| Column type | Available conditions |
|-------------|---------------------|
| `text` (string) | eq, ne, contains, starts, ends, bw, in, nin, null, notNull, regex |
| `number` | eq, ne, gt, gte, lt, lte, bw, in, nin, null, notNull |
| `boolean` | eq, ne, null, notNull |
| `date` | eq, ne, gt, gte, lt, lte, bw, null, notNull + date shortcuts |

---

## Default Components (vue-table)

Same philosophy as vue-form: ship unstyled HTML defaults that render a functional table with zero config. Users override any piece via a **types map**.

### Types Map (`TAsTableComponents`)

```ts
interface TAsTableComponents {
  // Layout
  table?: Component        // wraps <table> element
  toolbar?: Component      // search + filter bar + config button
  pagination?: Component   // page controls / load-more button

  // Cells & headers
  headerCell?: Component   // column header (label + sort indicator)
  cellValue?: Component    // default cell renderer
  columnMenu?: Component   // dropdown menu on header click

  // Filters
  filterBar?: Component    // horizontal filter tokens bar
  filterToken?: Component  // single filter chip
  filterInput?: Component  // value input inside filter dialog (type-aware)
  filterDialog?: Component // filter condition builder dialog

  // Config
  configDialog?: Component // columns/filters/sorters config dialog
  fieldsSelector?: Component // orderable checkbox list
  sortersConfig?: Component  // sorter list with direction toggle

  // Presets
  createPreset?: Component
  managePresets?: Component

  // Primitives (shared with vue-form where possible)
  input?: Component        // text input
  select?: Component       // dropdown select
  checkbox?: Component     // boolean checkbox
  button?: Component       // action button
  dialog?: Component       // modal dialog shell
  icon?: Component         // icon renderer
}
```

### Defaults provided

| Component | Default implementation |
|-----------|----------------------|
| `table` | Plain `<table>` with sticky header CSS |
| `toolbar` | `<div>` with search `<input>`, filter tokens, config `<button>` |
| `pagination` | `<div>` with page info text, prev/next `<button>`, items-per-page `<select>` |
| `headerCell` | `<th>` with label + sort arrow (▲/▼) + click-to-sort |
| `cellValue` | `<td>` with type-aware formatting (numbers right-aligned, booleans as ✓/✗, dates formatted) |
| `columnMenu` | Native `<details>/<summary>` dropdown with sort/filter/hide actions |
| `filterBar` | `<div>` row of filter tokens |
| `filterToken` | `<span>` chip with field:value text + × remove button |
| `filterInput` | `<input>` with type=text/number/date based on column type |
| `filterDialog` | `<dialog>` with condition rows |
| `configDialog` | `<dialog>` with three fieldsets (columns, filters, sorters) |
| `fieldsSelector` | `<ul>` with checkboxes, drag-to-reorder via native drag API |
| `sortersConfig` | `<ul>` with asc/desc toggle buttons |

All defaults use semantic HTML, minimal inline styles for layout (sticky, flex), no external CSS framework.

---

## Phases

### Phase 1 — ui-table: Filter Model & Preset Serialization

Create `@atscript/ui-table` with framework-agnostic filter logic.

**Scope:**
- Filter model types (`FilterCondition`, `FilterValue`, `FieldFilters`)
- Filter condition helpers (isFilled, has2ndValue, conditionLabel, available conditions per column type)
- Available conditions map per column type (text/number/date/boolean — see Available Conditions per Column Type)
- `filtersToUniqueryFilter(fieldFilters)` — converts UI filter model to Uniquery `FilterExpr`, with:
  - `$regex` conversion for `contains`/`starts`/`ends` conditions
  - `escapeRegex()` helper for safe user input embedding
  - Combination logic: inclusion OR'd, exclusion AND'd, fields AND'd (see Filter Combination Logic)
- Date shortcuts (`dateShortcuts()` → array of `{ label, dates: [start, end] }` — see Date Filter Shortcuts)
- Preset serializer — snapshot/restore table state (visible columns, sorters, filters) as JSON

**No query builder** — db-client's `Client` handles query construction and HTTP.

**Tests:**
- Filter condition helpers
- Filter-to-Uniquery conversion for all condition types (including regex conversion + escaping)
- Filter combination logic (inclusion OR, exclusion AND, multi-field AND)
- Date shortcuts produce correct date ranges
- Preset serialize/deserialize roundtrip

**Dependencies:** `@atscript/ui-core` (workspace), `@uniqu/core` (types only)

---

### Phase 2 — vue-table: Composables & Renderless Root

Create `@atscript/vue-table` with core composables and renderless provider.

**Scope:**
- `useTable(client)` — calls `client.meta()`, then `createTableDef()`, creates reactive state
- `useTableState()` — provide/inject pattern (like not-sap's `useSmartTablePI`)
  - Provides: `tableDef`, `columns`, `filters`, `sorters`, `results`, `querying`, `queryingNext`, `totalCount`, `loadedCount`, `selection`, `pagination`, `queryError`, `metadataError`, `mustRefresh`
  - `queryError: Ref<Error | null>` — last query error, cleared on successful query
  - `metadataError: Ref<Error | null>` — metadata loading error
  - `mustRefresh: Ref<boolean>` — true when state changed during an in-flight query (results are stale). UI should show a refresh indicator. Cleared on next successful query.
  - Methods: `query()`, `queryNext()`, `resetFilters()`, `showConfigDialog()`
- `useTableQuery(client, state)` — watches state changes → debounced (200ms) → builds Uniquery → calls `client.findManyWithCount()` or `client.pages()` → updates results
  - Builds `controls: { $select: visibleColumnPaths }` to only fetch displayed fields (payload optimization)
  - Merges `forceSorters` (first) with user sorters (after) — force sorters always take priority
  - Handles append (load-more) vs replace
  - Sets `mustRefresh = true` if state changes while a query is in flight
  - Tracks `queryError` — set on failure, cleared on success
  - Accepts optional `queryFn` override for custom queries
- `useTableSelection()` — single/multi select, selectAll, rowValueFn, `keepSelectedAfterRefresh` option (preserves selection across queries)
- `as-table-root.vue` — renderless component that provides state via slot props (like SmartTableRoot)

**Tests:**
- `useTable` creates correct tableDef from mock meta
- `useTableState` provide/inject works
- `useTableQuery` triggers on state change, debounces
- Selection modes

**Dependencies:** `@atscript/ui-core`, `@atscript/ui-table` (workspace), `@atscript/db-client` (peer), `vue` (peer)

---

### Phase 3 — vue-table: Base Table Rendering + Default Components

Add the table rendering components with unstyled defaults.

**Scope:**
- `as-table.vue` — entry point, accepts `components` types map (like as-form)
- `as-table-base.vue` — `<table>` with sticky header, column highlight on hover, row click/double-click handlers, named slots (`#cell-{path}`, `#empty`, `#last-row`)
- `as-table-header-cell.vue` — column name + sort indicator + click handler
- `as-table-virtualizer.vue` — `@tanstack/vue-virtual` wrapper
- `as-table-cell-value.vue` — default cell renderer with type-aware formatting
- Default components for this phase: table, toolbar, pagination, headerCell, cellValue, columnMenu (see Default Components section for specs)
- `createDefaultTableComponents()` — returns default types map
- Column width calculation from `ColumnDef.width` (via `@ui.width` annotation) or type-based defaults:
  - `boolean` → `5em`
  - `number` → `10em`
  - `date` → `12em`
  - `text` → `15em`
  - `array` / `object` → `18em`
- Pagination modes: hard-limit, load-more-btn, scroll-to-load, page-based

**Dependencies add:** `@tanstack/vue-virtual` (peer), `@vueuse/core` (peer)

---

### Phase 4 — vue-table: Filters

Add the filter system with default filter UI.

**Scope:**
- Filter components: `as-table-filters.vue`, `as-table-filter.vue`, `as-filter-conditions.vue` (see Package Structure for full layout)
- Default components for this phase: filterBar, filterToken, filterInput, filterDialog (see Default Components section for specs)
- `useTableFilter()` — per-field filter state composable
- Type-aware filter inputs: text input for strings, number input for numbers, date input for dates, checkbox for booleans
- Available condition types per column type (see Available Conditions per Column Type)
- Date filter shortcuts in filter dialog for date columns (see Date Filter Shortcuts)

---

### Phase 5 — vue-table: Config Dialog & Column Management

Add table configuration UI with defaults.

**Scope:**
- Default components for this phase: configDialog, fieldsSelector, sortersConfig (see Default Components section for specs)
- Dialog model copies (cancel-safe, apply on confirm) — same pattern as not-sap
- Column reorder via drag-and-drop in table header
- `as-orderable-list.vue` — generic drag-and-drop reorderable list (native HTML drag API, shared utility)

---

### Phase 6 — vue-table: Search

Add full-text and vector search integration.

**Scope:**
- Full-text search integration via `client.search()`
- Vector search support when `tableDef.vectorSearchable`
- Search input in toolbar with debounced query trigger
- `v-model:searchTerm` on `as-table-root` for two-way binding

---

### Phase 7 — vue-table: Presets (frontend)

Add table state persistence UI.

**Scope:**
- `useTablePresets()` — CRUD for saved table configurations
- `PresetAdapter` interface — pluggable storage backend
  - `LocalStoragePresetAdapter` — default, stores per `tableKey` in localStorage
  - `HttpPresetAdapter` — calls the presets-server HTTP endpoints (see Phase 8)
- Default components: createPreset, managePresets (see Default Components section)
- Preset snapshot includes: visible columns + order, sorters, filters, page size

---

### Phase 8 — presets-server: Backend for Presets

Create `@atscript/presets-server` — a Moost-based controller + atscript schema for storing table presets server-side.

**Scope:**
- `.as` schema defining the presets DB table (see Presets Schema below)
- A Moost controller with REST endpoints for preset CRUD
- The controller is extensible — users subclass or compose it to add auth guards, tenant scoping, etc.
- Uses `@atscript/moost-db` internally for DB access (limited to simple CRUD — no complex queries)

**User integration:**
```ts
// User imports the .as schema and adds it to their DB
import { PresetsController } from '@atscript/presets-server'

@Controller('/presets')
class MyPresetsController extends PresetsController {
  // Override to add auth
  @Override()
  getUserId() { return this.authService.currentUserId }
}
```

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:tableKey` | List presets for table (user's own + shared) |
| `POST` | `/:tableKey` | Create preset |
| `PATCH` | `/:tableKey/:id` | Update preset (label, content, shared flag) |
| `DELETE` | `/:tableKey/:id` | Delete preset (own only) |

**Dependencies:** `@atscript/moost-db`, `moost` (peer)

---

### Phase 9 — Playground: Moost Server + SQLite

Add a real backend to `vue-playground` so table components can be tested against live data.

**Scope:**
- Add a moost server to the playground package (separate entry point, e.g. `server/main.ts`)
- SQLite as DB layer via `@atscript/moost-db` + `better-sqlite3`
- Define several `.as` table schemas with varied field types:
  - **Products** — text, number, boolean, date fields; filterable/sortable columns; text search index
  - **Orders** — relations (to products, to customers), date ranges, status enum, aggregation-friendly
  - **Customers** — nested address object, email/phone tags, optional fields
- Seed scripts to populate tables with realistic sample data
- Vite dev proxy from playground frontend → moost server (e.g. `/api/*` → `localhost:3100`)
- Playground views for each table scenario:
  - Basic table (products, default columns)
  - Table with filters + sorters
  - Table with custom cell slots
  - Table with selection (single/multi)
  - Table with search
  - Table with relations (`$with`)

**Dependencies add:** `@atscript/moost-db`, `better-sqlite3`, `moost` (dev)

---

## Presets Schema

The `@atscript/presets-server` package ships a `.as` atscript definition for the presets table:

```ts
// Preset record structure
interface TablePreset {
  id: string                    // auto-generated UUID
  tableKey: string              // identifies the table view (e.g. "products", "orders")
  userId: string                // owner — provided by controller's getUserId()
  label: string                 // user-visible preset name
  shared: boolean               // visible to all users (default: false)
  isDefault: boolean            // auto-apply on table mount for this user
  content: {                    // serialized table state snapshot
    columns?: string[]          // visible column paths in order
    sorters?: SortControl[]     // active sorters
    filters?: FieldFilters      // active filter state
    itemsPerPage?: number       // page size
  }
  createdAt: Date
  updatedAt: Date
}
```

The `PresetAdapter` interface (used by `useTablePresets()` in vue-table) abstracts storage:

```ts
interface PresetAdapter {
  list(tableKey: string): Promise<TablePreset[]>       // user's own + shared presets
  create(tableKey: string, preset: Omit<TablePreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<TablePreset>
  update(tableKey: string, id: string, patch: Partial<TablePreset>): Promise<TablePreset>
  delete(tableKey: string, id: string): Promise<void>
}
```

Two adapters ship out of the box:
- `LocalStoragePresetAdapter` — stores JSON in `localStorage` keyed by `as-presets:{tableKey}`, no auth, good for prototyping
- `HttpPresetAdapter` — calls the `presets-server` REST endpoints, used in production

---

## Dependency Graph

```
@atscript/ui-core           (existing — TableDef, ColumnDef, createTableDef)
       ↓
@atscript/ui-table           (Phase 1 — filter model, filter→Uniquery, presets)
       ↓
@atscript/vue-table          (Phase 2-7 — Vue composables + components + defaults)
  peers: vue, @atscript/db-client, @tanstack/vue-virtual, @vueuse/core
       ↓
@atscript/presets-server     (Phase 8 — Moost controller + .as schema for preset storage)
  peers: moost, @atscript/moost-db
       ↓
vue-playground               (Phase 9 — moost server + SQLite + demo views)
  deps: @atscript/vue-table, @atscript/db-client
  dev:  @atscript/moost-db, @atscript/presets-server, better-sqlite3, moost
```

## Component Props Overview (vue-table)

### as-table-root
```ts
{
  client: Client               // @atscript/db-client instance
  components?: TAsTableComponents  // types map for UI overrides
  limit?: number               // default page size (default: 50)
  forceFilters?: FilterExpr    // always-applied filters (Uniquery)
  forceSorters?: SortControl[] // always-applied sorts (prepended before user sorters)
  queryOnMount?: boolean       // auto-query when mounted (default: true)
  queryFn?: (uniquery: Uniquery) => Promise<{ data: any[]; count: number }>  // override query
  blockQuery?: boolean         // prevent queries
  blockQueryReason?: string    // reason string for UI display when blockQuery is true
  presetAdapter?: PresetAdapter  // pluggable preset storage
}

// v-model bindings:
v-model:searchTerm?: string    // two-way search input — toolbar writes, parent can read/set
```

### as-table
```ts
{
  rows?: Record<string, unknown>[]  // override rows (if not using built-in query)
  columns?: ColumnDef[]             // override visible columns
  select?: 'none' | 'single' | 'multi'
  keepSelectedAfterRefresh?: boolean  // preserve selection across queries (default: false)
  stretch?: boolean
  stickyHeader?: boolean
  rowsControl?: 'hard-limit' | 'pagination' | 'load-more-btn' | 'scroll-to-load'
  virtualRowHeight?: number
  virtualOverscan?: number
  columnMenu?: { sort?: boolean; filters?: boolean; hide?: boolean; config?: boolean }
  onRowClick?: (row: Record<string, unknown>, event: MouseEvent) => void
  onRowDblClick?: (row: Record<string, unknown>, event: MouseEvent) => void
}

// Slots:
#cell-{path}="{ row, value, column }"   // custom cell renderer
#header-{path}="{ column }"             // custom header cell
#empty                                   // no data state
#last-row                                // row appended after data
#loading                                 // loading state
#error="{ error, retry }"               // query error state
```

### as-table-filters
```ts
// No props — reads from injected table state
// Slots:
#filter="{ field, filters, remove, clear }"     // custom filter token
#add-filter="{ availableFields, addFilter }"     // custom "add filter" button
```
