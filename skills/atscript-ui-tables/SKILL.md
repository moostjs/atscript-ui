---
name: atscript-ui-tables
description: >-
  Searchable, filterable, sortable, paginated or virtualized tables from `.as`
  types with `@atscript/vue-table` + `@atscript/ui-table`. Use for
  `<AsTableRoot>`, `<AsTable>`, `<AsWindowTable>`, `<AsFilters>`,
  `<AsPresetPicker>`, `<AsConfigDialog>`, `<AsTableActions>`; `@ui.table.*` /
  `@ui.table.fn.*` / `@ui.dict.*` annotations; `queryFn` or moost-db URLs;
  custom cells (`@ui.table.component`, `provideCellLocale`); URL state
  (`useTableUrlQuery`, `$snapshot` links, URL filter decoding) and presets
  (`usePresets`, `useLocalDraft`, `useAppPrefs`, `AsPresetsController` from
  `@atscript/moost-ui-presets`); row/table actions (`AsActionFormDialog`),
  selection (`togglePk`, `trimSelection`), `:row-actions`; export
  (`useTableExport`, `downloadExport`, CSV); local rows (`:rows`),
  `:display-columns`; JSON-column filters (`filterOps`); fields hidden by
  role (`@fields-dropped`); virtualization and block fetching. Out of scope: forms (`atscript-ui-forms`), workflow forms
  (`atscript-ui-wf`), styling (`atscript-ui-styles`).
---

# atscript-ui-tables

## Install

```bash
npx skills add moostjs/atscript-ui      # installs all atscript-ui skills (this one + general + forms + wf + styles)
npx skills add moostjs/atscript         # sibling — .as language
npx skills add moostjs/atscript-db      # sibling — moost-db backs most tables
```

```bash
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/ui-table @atscript/vue-table vue
pnpm add @atscript/vue-form                          # required peer (cell dispatch, action forms)
pnpm add @atscript/ui-fns                            # opt-in: dynamic @ui.table.fn.*
pnpm add @atscript/db-client                         # moost-db browser client
pnpm add @atscript/moost-ui-presets                  # server-side preset persistence (optional)
```

## Quick start

```atscript
// src/product.as
@db.table 'products'
@db.depth.limit 0
export interface Product {
    @meta.id @db.default.increment
    id: number

    @meta.label 'SKU'
    @ui.table.width '8em'
    sku: string

    @meta.label 'Name'
    @db.index.fulltext 'name_fts'
    name: string

    @meta.label 'Price'
    @db.column.precision 2
    @db.amount.currency 'USD'
    price: number

    @meta.label 'In stock'
    inStock: boolean
}
```

```vue
<script setup lang="ts">
import { createDefaultCellTypes } from "@atscript/vue-table";

const types = createDefaultCellTypes();
</script>

<template>
  <AsTableRoot url="/api/db/tables/products" :types="types" :limit="20">
    <AsTableActions />
    <AsFilters />
    <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
  </AsTableRoot>
</template>
```

Replace `url=` with `:query-fn="..."` for a custom backend. See [query.md](references/query.md).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Programmatic state changes are picked up by the root watcher automatically.** Each mutator on `state` (e.g. `setFieldFilter`, `setColumnWidth`, `setSearchTerm`) touches exactly one entity; the root watcher on `[filters, sorters, pagination, columnNames]` schedules the next query. Calling `state.query()` to "apply" a programmatic change will double-fetch and skip debouncing.                                                                                                                                                                                                                                                                                                                  |
| 2   | **`state.query()` is reserved for user-initiated refresh.** Wire it to a refresh button, pull-to-refresh, or devtools — not to apply programmatic state changes — except `query({ silent: true })` for timer-driven live refresh (invariant 14).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | **`filterFields` (display) and `filters` (applied) are independent.** Hiding a filter input via `filterFields` does NOT clear `filters[path]`. Clearing `filters[path]` does NOT hide the input. When building your own dialogs, write the new arrays directly — the root watcher reconciles. Cleanup loops that delete `filters` entries because `filterFields` shrank will fight the model and cause double-fetches.                                                                                                                                                                                                                                                                                      |
| 4   | **`@ui.table.type` is for built-in renderer ids only.** Built-ins: `text`, `number`, `boolean`, `date`, `datetime`, `relative`, `array`, `object`, `union`, `enum`, `ref`. Custom cells use `@ui.table.component` + the `:components` map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | **Per-field filter conditions: inclusions OR-merge, exclusions AND-merge.** Inclusion ops (`eq`, `contains`, `starts`, `ends`, `gt`, `gte`, `lt`, `lte`, `bw`, `regex`, `null`) → OR within field. Exclusion ops (`ne`, `notNull`) → AND within field. Across fields → AND. See `filtersToUniqueryFilter` in `ui-table`.                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | **Force filters / sorters AND-merge; user can't remove them.** Pass via `useTable({ forceFilters, forceSorters })`; they always prepend and dedupe by field — user mutations to `filters` / `sorters` never override them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | **Window mode fetches in fixed-size blocks.** `<AsWindowTable>` issues block-aligned fetches (default 100 rows) as the viewport scrolls; tune via `<AsTableRoot :block-size>` and `:drag-release-debounce-ms` (higher = fewer fetches during fast scroll). Custom virtual renderers read rows via `state.dataAt(absIndex)` / `state.loadingAt(absIndex)` / `state.errorAt(absIndex)` — see [query.md](references/query.md).                                                                                                                                                                                                                                                                                 |
| 8   | **Presets opt-in per-aspect.** A `PresetSnapshot` carries any subset of `columns`, `filters`, `filterOps`, `sorters`, `itemsPerPage`. Absent keys leave that slice untouched on apply. Use `toWireSnapshot` / `fromWireSnapshot` when crossing the network — never send the raw runtime dict.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 9   | **Reserved preset id prefixes**: `sys:` (system, client-only, never persisted), `uc:` (user config, deterministic id `uc:<user>:<app>:<tableKey>`), `ac:` (app config, deterministic `ac:<user>:<app>`). Client writes to `sys:*` are rejected by the server controller.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 10  | **Server preset read gate**: `user = current OR (type='preset' AND public=true)`. Once-public-always-public — revoking publish permission doesn't unpublish existing rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | **`/meta` response carries `preferredId` on every row-returning read.** `moost-db` widens `$select` automatically; cells/actions/refs can rely on identity. Aggregate (`$groupBy`) and `$count` responses are NOT widened — see atscript-db skill, invariant 10.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 12  | **`:controls` takes only your overrides.** Every dispatch site falls back internally (`controls[key] ?? default`), so passing `createDefaultControls()` wholesale is redundant AND opts the lazy dialogs into eager bundling+mounting. `rowActions` is not seeded — the `__actions` column resolves `controls.rowActions ?? types.__actions ?? AsRowActions`.                                                                                                                                                                                                                                                                                                                                               |
| 13  | **`$sort` overrides search relevance — opt into `ignoreSortersWhenSearched` to preserve it.** A preset/`v-model`/header sort emitted alongside `$search` replaces relevance ranking on a scored backend (Atlas `$search`), so search returns the right row set in browse order. `<AsTableRoot :ignore-sorters-when-searched>` (default `false`) suppresses user sorters at query time while searching; `forceSorters` still emit. The flag is a model — sorting mid-search flips it off for the session; a new search resets it. Only for relevance-ranked backends. See [sorting-pagination.md](references/sorting-pagination.md#search-relevance-suppression).                                            |
| 14  | **`query({ silent: true })` is the sanctioned timer-driven live-refresh path.** Re-runs the current query (live filters/sorters/search/pagination/`$actions`) with no `querying` flip — no spinner, no skeletons, no query overlay. Loud-wins coalescing: a real (loud) query landing the same tick still shows the spinner. On failure, rows/`totalCount`/error state are left untouched — never blanks or toasts the grid. Preserves scroll position. Rides on keep-rows-until-settle — a stable contract where every query, silent or not, keeps prior rows visible until the response settles, then swaps `results` + `totalCount` atomically. See [query.md](references/query.md#silent-live-refresh). |

| 15 | **An export reuses the table's own query path.** `useTableExport` builds with `state.buildQuery()` and fetches with `state.fetchPage()` (both public since 0.1.134), appends the primary key(s) to `$sort` as a tiebreaker so paging can neither skip nor duplicate rows, and never requests `$actions`. Don't hand-roll the query — it drifts from force-filters, `selectWith` and `alwaysSelected`. CSV STRING cells starting with `=`/`+`/`-`/`@`/TAB/CR are `'`-prefixed by default (CSV-injection defence; numbers stay numeric) — writer settings live under `csv: { bom?, escapeFormulas?, delimiter? }`. One handle runs one export: a second `exportRows()` while one is in flight rejects. See [export.md](references/export.md). |
| 16 | **Display columns never reach the server.** `<AsTableRoot :display-columns>` merges client-owned columns (`ColumnDef.local`) into the column list: they get a label, a width, config-dialog visibility, reordering and preset persistence, but are stripped from `$select`, from `$sort` and from filters. `sortable: 'local'` orders the LOADED page by `sortValue(row)` — or by `row[key]` when none is given — re-sorting by the whole sorter list so the server's ordering survives. An in-memory table (`<AsTableRoot :rows>`) sorts its whole dataset instead, so the affordance also works in `<AsWindowTable>` there; behind a server fetcher `<AsWindowTable>` withholds it, since rows are cached by absolute index. `state.localSortAvailable` (0.1.135) is the one rule both the header and the config dialog read. An unknown key in a stored preset is ignored, and an export's default column set skips display columns unless `formatters[path]` fills them. See [customization.md](references/customization.md#display-only-columns-displaycolumns-since-01134). |
| 17 | **`:row-actions` narrows presentation; the server still authorises.** The per-row `$actions` gate runs BEFORE the policy, so `include` can only narrow what a row was already allowed and `overrides` are cosmetic — neither can surface a gated action. `include` does not apply to `extra` (app-owned) actions; `exclude` and their own `enabled(row)` do, and `include: []` hides every server action while keeping the extras. The compiled policy is read by both `<AsRowActions>` and the `<AsTableActions level="row">` toolbar, so they never disagree. See [actions-selection.md](references/actions-selection.md#per-screen-row-action-policy-rowactions-since-01134). |
| 18 | **Table URLs are snapshots (0.1.139+).** Every URL the table writes ends in bare `$snapshot`; a URL carrying it restores exactly — filters/sorters it omits are cleared on first mount, client-side navigation and Back/Forward (no `$sort` = no sorters), columns untouched. Marker-less app links overlay the table's boot baseline (preset/draft/props) on every pass, Back included. Build exact cross-view links with `stateToUrlQueryString` or `{ query: { …, $snapshot: null } }`; opt out with `urlQuerySync.snapshot: false`. ≤ 0.1.138 reload/share overlaid the preset. See [state-persistence.md](references/state-persistence.md#snapshot-urls-snapshot-since-01139). |
| 19 | **URL → filter decoding never approximates; what the field model can't hold is carried (0.1.140+).** `$in`/`$nin`/same-field `$or`/invertible `$not` map to field filters; a piece they can't hold (cross-field OR, second range on a field, negated range) becomes a residual condition — `state.residualFilters`, a "Custom filter" chip in `<AsFilters>`, AND'd into query/URL/export — so the population stays exact. Don't hand-roll one: use `setResidualFilters` / `decomposeUniqueryFilter(expr, { carry: true })`. Only a piece correlating a server column with a `local` one is dropped as `@unsupported-filter` (`onUnsupportedFilter` / dev `console.warn`); pieces on fields the caller cannot read go to `@fields-dropped` (invariant 21); `urlQuerySync.residual: false` = the 0.1.139 report-only behaviour. Not saved in presets. See [filtering.md](references/filtering.md#residual-filter-conditions). |
| 20 | **Gate filter UIs on `isColumnFilterable(col)`, not `col.filterable` (0.1.139+).** `/meta` `filterOps: ["$exists"]` (JSON storage) makes a non-value-filterable column offer only `null`/`notNull`; `columnFilterConditions(col)` is the per-column list every built-in reads. See [filtering.md](references/filtering.md#existence-only-columns). |
| 21 | **Views naming fields the caller cannot read degrade, never 400 (0.1.141+).** Only `/meta.fields` entries without `writeOnly` become columns / fetchable. Presets (the default one applies only after `/meta`, the local draft included) and restored URLs are pruned on apply (columns keep order, all-gone → every column; `filterOps` per field; a residual naming a hidden field anywhere goes whole — never pruned inside `$or`/`$not`) and reported once via `@fields-dropped` / `onFieldsDropped` (`source: preset \| url`). Direct model writes (`v-model`, `setFieldFilter`, `setResidualFilters`) are kept as written; the memoized query gate leaves hidden fields out (one dev warn per path set, no report). `state.preset.droppedFields` + a picker note; stored preset untouched, not dirty; `saveActive` appends hidden entries back, `saveAs` doesn't. URL not rewritten until the next change. `forceFilters`/`forceSorters` are **never** pruned — keep them to fields every role reads. See [hidden-fields.md](references/hidden-fields.md). |

## Key imports

```ts
// Tier 1 — primary (auto-imported by AsResolver)
import {
  AsTableRoot,
  AsTable,
  AsWindowTable,
  AsTableActions,
  AsFilters,
  AsPresetPicker,
} from "@atscript/vue-table";

// Tier 2 — defaults (swap targets)
import {
  // cells
  AsCellArray,
  AsCellDate,
  AsCellJson,
  AsCellNumber,
  AsCellUnion,
  AsTableCellValue,
  // dialogs
  AsConfigDialog,
  AsFilterDialog,
  AsPresetDialog,
  AsConfirmDialog,
  // filter ui + headers + rows
  AsFilterField,
  AsFilterInput,
  AsTableHeaderCell,
  AsRowActions,
  AsColumnMenu,
} from "@atscript/vue-table";

// AsActionFormDialog is on a dedicated subpath — it pulls in @atscript/vue-form,
// so the table root lazy-mounts it. Import this only to override / eager-load.
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";

// Composables
import {
  useTable,
  useTableContext,
  useTableContextOptional,
  createTableState,
  createStaticTableState,
  useTableSelection,
  useTableNavBridge,
  useTableFilter,
  useTableSearch,
  useTableActions,
  useTableUrlQuery,
  useTableExport,
  downloadExport,
  provideTableContext,
  useTableContext,
  useAppPrefs,
  usePresets,
  useLocalDraft,
  useCellLocale,
  provideCellLocale,
  useTableComponent,
} from "@atscript/vue-table";

// Factories
import { createDefaultControls, createDefaultCellTypes } from "@atscript/vue-table";

// Types (re-exported)
import type {
  TAsTableControls,
  TAsCellTypeComponents,
  ReactiveTableState,
  ColumnMenuConfig,
  ConfigTab,
  TableActionsState,
  ActionResult,
  RowActionsConfig,
  LocalRowAction,
  DisplayColumnDef,
  ExportRowsOptions,
  ExportResult,
  DroppedFieldsReport, // @fields-dropped payload (0.1.141+)
} from "@atscript/vue-table";

// Framework-agnostic table model (filter / preset / query primitives)
import {
  FilterCondition,
  FieldFilters,
  filtersToUniqueryFilter,
  PresetSnapshot,
  toWireSnapshot,
  fromWireSnapshot,
  buildTableQuery,
  mergeFilters,
  mergeSorters,
  stateToUrlQueryString,
  urlQueryStringToState,
  URL_SNAPSHOT_KEY, // "$snapshot" — exact-view URL marker (0.1.139+)
  uniqueryFilterToFieldFilters, // 3rd arg onUnsupportedFilter reports lossy pieces (0.1.139+)
  decomposeUniqueryFilter, // { filters, residual, unsupported, unknown } — carry: true keeps lossy pieces (0.1.140+)
  prunePresetSnapshot, // hidden-field pruning for custom renderers (0.1.141+)
  pruneResidualFilters,
  restoreDroppedEntries,
  formatFilterExpr, // FilterExpr → words, like the filter chips (0.1.140+)
  columnFilterConditions, // per-column filter ops (0.1.139+)
  columnDefaultCondition, // per-column default op (0.1.139+)
  parseColumnFilterInput, // per-column typed-input parser (0.1.139+)
  isColumnFilterable,
  DEV, // dev-build gate for warnings (0.1.139+)
  toCsv,
  collectExportRows,
  withStableOrder,
  resolveExportValue,
  mergeDisplayColumns,
  sortRowsLocally,
} from "@atscript/ui-table";

// Server-side preset controller (Moost)
import { AsPresetsController, AsPresetEntry } from "@atscript/moost-ui-presets";
```

## References — load only what's needed

| Domain                       | File                                                                              | When                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact                | [getting-started.md](references/getting-started.md)                               | Install matrix, `<AsTableRoot>` props, the default `:types` + `:controls` maps, slot binding contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Query / data wiring          | [query.md](references/query.md)                                                   | `url=` (moost-db) vs `queryFn` (custom), `buildTableQuery` Uniquery assembly, force filters/sorters, holding fetches back with a reactive `blockQuery`, meta endpoint, mutators-are-pure principle in detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Filtering                    | [filtering.md](references/filtering.md)                                           | Filter model (`FieldFilters` / `FilterCondition` / 13 condition types), OR/AND semantics, `filtersToUniqueryFilter` translation, inline input coercion (numbers, boolean `true`/`false`), `<AsFilters>` / `<AsFilterField>` / `<AsFilterDialog>`, value-help inside filter dialogs; capping the filter row with an overflow popover (`<AsFilters :max-visible>` / `overflow` / More-filters trigger + active-count badge); decoding a Uniquery/URL filter back (`uniqueryFilterToFieldFilters`, `$in`, lossy-piece reports); residual filter conditions (`state.residualFilters`, `setResidualFilters`, `decomposeUniqueryFilter`, "Custom filter" chips, `AsResidualFilter`); JSON / existence-only columns (`filterOps`, `isColumnFilterable`, `columnFilterConditions`) |
| Sorting + pagination         | [sorting-pagination.md](references/sorting-pagination.md)                         | Sort model + multi-sort, header click semantics, `<AsConfigDialog>` sorters tab, paginated `<AsTable>` vs virtualized `<AsWindowTable>`, block-aligned fetching, `dragReleaseDebounceMs` tuning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Cells                        | [cells.md](references/cells.md)                                                   | Built-in cell components + default type map, `provideCellLocale` (language + timezone), custom cells via `@ui.table.component` + `:components`, slot API (`#header-<path>`, `#cell-<path>`, `#empty`, `#query-loading`, `#error`), per-cell styling via `@ui.table.{classes,styles,attr}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| State persistence            | [state-persistence.md](references/state-persistence.md)                           | `<AsConfigDialog>` tabs (columns/sorters/filters), `useTableUrlQuery` (router two-way bind, host-owned key preservation, `prefix` for two tables on one route), client presets (`PresetSnapshot`, `useLocalDraft` + `draftScope` per-user drafts, `usePresets`, `useAppPrefs`, `<AsPresetPicker>`, system/user/public, `systemAspects`, the single mutator-error channel `lastError`, `dateShortcuts`), server presets via `AsPresetsController`; `$snapshot` URLs — reload/share reproducing the table, exact vs overlay cross-view links, residual conditions carried through URLs, `@unsupported-filter`                                                                                                                                                                |
| Hidden fields                | [hidden-fields.md](references/hidden-fields.md)                                   | When roles see different `/meta` fields: a preset / shared link / draft names a field the caller cannot read, `@fields-dropped` / `onFieldsDropped`, `state.preset.droppedFields`, `writeOnly` fields, `unknown` vs `unsupported` URL pieces, `saveActive` merge-back, why `forceFilters` stays unpruned                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Actions + selection          | [actions-selection.md](references/actions-selection.md)                           | Row / table actions on the `.as` type, `<AsActionFormDialog>` (action input form via vue-form), `state.selectedRows` (`Set<PK>`), `togglePk` / `trimSelection` / `rowsToPks`, `state.actions.invoke(action, pk?, opts?)`, the `__actions` synthetic column; navigate-action links (`navigateHrefFor`, `resolveHref`, anchor vs button, native new-tab silent to `@action`)                                                                                                                                                                                                                                                                                                                                                                                                 |
| Customization                | [customization.md](references/customization.md)                                   | When swapping table chrome: per-column / state slots (`#cell-*`, `#header-*`, `#empty`, `#error`, `#last-row`), `:types` / `:components` cell swap, replacing dialogs via `:controls` (and which control keys actually dispatch), custom row-actions cell, rendering without a header row (`:headless`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Edit form + OCC              | [edit-form-occ.md](references/edit-form-occ.md)                                   | When building a row-edit `<AsForm>` against an OCC table: `@db.column.version`, `meta.versionColumn` → `createFormDef`, catching `VersionMismatchError` / `currentVersion` on submit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Annotation catalog           | [annotations.md](../atscript-ui/references/annotations.md)                        | When writing or looking up any `@ui.table.*` / `@ui.table.fn.*` / `@ui.dict.*` annotation — args, constants, defaults (SSOT lives in the root `atscript-ui` skill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Row hooks + selection a11y   | [customization.md](references/customization.md)                                   | When a row must be un-selectable, decorated or attributed: `:row-selectable` / `:row-class` / `:row-attrs` on `<AsTable>` or `<AsWindowTable>`, the disabled reason, `data-selectable="false"`, selection-cell `role="checkbox"` + Space toggle, and the `aria-busy` / live-region feedback on `<AsTableActions>`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Keyboard inside cells        | [cells.md](references/cells.md)                                                   | When Enter / Space on a button, link or form control inside a custom cell is being swallowed by the table, or must be handed back to it: the interactive-target guard and the `data-as-nav-keys` opt-out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Export                       | [export.md](references/export.md)                                                 | When exporting what the table shows: `useTableExport` / `downloadExport`, CSV quoting + formula escaping, paging with a stable order, cancellation, `format: 'rows'` for XLSX builders                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Local rows / display columns | [query.md](references/query.md) + [customization.md](references/customization.md) | When the rows are already in memory (`<AsTableRoot :rows :columns>`, no client, no `/meta`), or a screen needs a column the server has no field for (`:display-columns`, config dialog + presets, `sortable: 'local'` + `sortValue`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Bundle optimization          | [bundle-optimization.md](../atscript-ui/references/bundle-optimization.md)        | When asked about table bundle size: lazy dialog latches, `controls.X` flipping a dialog eager, `AsActionFormDialog` pulling in vue-form, shedding unused chrome CSS via `excludeComponents` (SSOT lives in the root `atscript-ui` skill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Customization

Full swap-surface reference (slots, maps, dispatched control keys): [customization.md](references/customization.md).

Tables expose three swap surfaces, layered on the tier model:

- **Tier 1** — `<AsTableRoot>`, `<AsTable>`, `<AsWindowTable>`, `<AsFilters>`, `<AsTableActions>`, `<AsPresetPicker>` are the integration surface. Build with `useTable` / `createTableState` directly if you need a custom shell.
- **Tier 2** — default cells (`AsCellArray`, `AsCellDate`, `AsCellJson`, `AsCellNumber`, `AsCellUnion`, `AsTableCellValue`) and default dialogs (`AsConfigDialog`, `AsFilterDialog`, `AsPresetDialog`, `AsConfirmDialog`, `AsRowActions`, `AsColumnMenu`, `AsTableHeaderCell`). These are what you swap.
- **Tier 3** — internal composition (header cells, virtualizer pieces, fields selector, sorter config). Not tagged directly; styles ride with the defaults that use them.

### Swap a built-in cell renderer (`:types`)

`:types` maps built-in cell ids (per invariant 4: `text`, `number`, `boolean`, `date`, `datetime`, `relative`, `array`, `object`, `union`, `enum`, `ref`) to a component:

```vue
<script setup lang="ts">
import { createDefaultCellTypes } from "@atscript/vue-table";
import MyDateCell from "./MyDateCell.vue";

const types = { ...createDefaultCellTypes(), date: MyDateCell, datetime: MyDateCell };
</script>

<template>
  <AsTableRoot url="/api/db/tables/products" :types="types" />
</template>
```

### Swap a specific cell (`:components` + `@ui.table.component`)

For column-specific cells, opt in on the `.as` type and supply the named component:

```atscript
@ui.table.component 'price-tag'
price: number
```

```vue
<script setup lang="ts">
import PriceTag from "./PriceTag.vue";
const components = { "price-tag": PriceTag };
</script>

<template>
  <AsTableRoot url="..." :components="components" />
</template>
```

Wrap a cell in `useCellLocale` / `provideCellLocale` if it needs locale + timezone from `useAppPrefs`.

### Swap a dialog (`controls.*`)

The toolbar, config, filter, and preset dialogs are swappable through `controls`. Pass only the entries you replace — spreading `createDefaultControls()` defeats dialog lazy-loading (see invariant 12):

```vue
<script setup lang="ts">
import MyFilterDialog from "./MyFilterDialog.vue";

const controls = { filterDialog: MyFilterDialog };
</script>

<template>
  <AsTableRoot url="..." :controls="controls" />
</template>
```

Custom dialogs just write the new arrays back to `state.filterFields` / `state.filters` / `state.sorters` / `state.columnNames` — the root watcher reconciles and re-queries (see invariants 1–3 and [query.md](references/query.md)). Don't call `state.query()` or run cleanup loops mirroring display state into applied state; both fight the watcher.

### Style consequence

Replacing `AsFilterDialog` with a custom dialog that doesn't tag the `as-filter-*` shortcuts drops those classes out of your bundle automatically. Keep the default whenever its chrome fits — you'll spend less time on style maintenance. For granular opt-out, `atscript-ui-styles` ships per-domain shortcut groups (`tableShortcuts`, `formShortcuts`, …) you can compose narrower than the default `allShortcuts`.

## See also

Reference docs: https://ui.atscript.dev/tables/. Source: https://github.com/moostjs/atscript-ui.
