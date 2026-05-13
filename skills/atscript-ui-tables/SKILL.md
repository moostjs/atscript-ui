---
name: atscript-ui-tables
description: >-
  Render searchable, filterable, sortable, paginated, or virtualized tables
  from `.as` annotated types with `@atscript/vue-table` + `@atscript/ui-table`.
  Use when working with `<AsTableRoot>`, `<AsTable>`, `<AsWindowTable>`,
  `<AsFilters>`, `<AsPresetPicker>`, `<AsConfigDialog>`, or `<AsTableActions>`;
  when writing `.as` types with `@ui.table.*` / `@ui.table.fn.*` / `@ui.dict.*`
  annotations; when wiring a `queryFn` (custom) or a `moost-db` URL (default);
  when implementing custom cells via `@ui.table.component` and the `:components`
  map (with `provideCellLocale` for locale/timezone); when persisting state to
  URL (`useTableUrlQuery`) or to presets (`PresetSnapshot`, `useLocalDraft`,
  `usePresets`, `useAppPrefs`, `AsPresetPicker`) — including server-side via
  `AsPresetsController` from `@atscript/moost-ui-presets`; when wiring row /
  table actions (`AsActionFormDialog`) and selection (`state.selectedRows`,
  `togglePk`, `trimSelection`); or when tuning virtualization (`AsWindowTable`,
  block-aligned `loadRange`). Out of scope: forms (use `atscript-ui-forms`),
  HTTP workflow forms (use `atscript-ui-wf`), styling (use `atscript-ui-styles`).
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
import { createDefaultCellTypes, createDefaultControls } from "@atscript/vue-table";

const types = createDefaultCellTypes();
const controls = createDefaultControls();
</script>

<template>
  <AsTableRoot url="/api/db/tables/products" :types="types" :controls="controls" :limit="20">
    <AsTableActions />
    <AsFilters />
    <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
  </AsTableRoot>
</template>
```

Replace `url=` with `:query-fn="..."` for a custom backend. See [query.md](references/query.md).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Programmatic state changes are picked up by the root watcher automatically.** Each mutator on `state` (e.g. `setFieldFilter`, `setColumnWidth`, `setSearchTerm`) touches exactly one entity; the root watcher on `[filters, sorters, pagination, columnNames]` schedules the next query. Calling `state.query()` to "apply" a programmatic change will double-fetch and skip debouncing.                                       |
| 2   | **`state.query()` is reserved for user-initiated refresh.** Wire it to a refresh button, pull-to-refresh, or devtools — not to apply programmatic state changes.                                                                                                                                                                                                          |
| 3   | **`filterFields` (display) and `filters` (applied) are independent.** Hiding a filter input via `filterFields` does NOT clear `filters[path]`. Clearing `filters[path]` does NOT hide the input. When building your own dialogs, write the new arrays directly — the root watcher reconciles. Cleanup loops that delete `filters` entries because `filterFields` shrank will fight the model and cause double-fetches.                                                              |
| 4   | **`@ui.table.type` is for built-in renderer ids only.** Built-ins: `text`, `number`, `boolean`, `date`, `datetime`, `relative`, `array`, `object`, `union`, `enum`, `ref`. Custom cells use `@ui.table.component` + the `:components` map.                                                                                                                  |
| 5   | **Per-field filter conditions: inclusions OR-merge, exclusions AND-merge.** Inclusion ops (`eq`, `contains`, `starts`, `ends`, `gt`, `gte`, `lt`, `lte`, `bw`, `regex`, `null`) → OR within field. Exclusion ops (`ne`, `notNull`) → AND within field. Across fields → AND. See `filtersToUniqueryFilter` in `ui-table`.                                   |
| 6   | **Force filters / sorters AND-merge; user can't remove them.** Pass via `useTable({ forceFilters, forceSorters })`; they always prepend and dedupe by field — user mutations to `filters` / `sorters` never override them.                                                                                                                                |
| 7   | **Window mode loads block-aligned ranges.** `<AsWindowTable>` calls `loadRange(skip, limit)` rounded to the `blockSize`. Scroll updates `topIndex` + `viewportRowCount`; the debounced watcher (controlled by `dragReleaseDebounceMs`) absorbs scroll velocity before fetching.                                                                              |
| 8   | **Presets opt-in per-aspect.** A `PresetSnapshot` carries any subset of `columns`, `filters`, `filterOps`, `sorters`, `itemsPerPage`. Absent keys leave that slice untouched on apply. Use `toWireSnapshot` / `fromWireSnapshot` when crossing the network — never send the raw runtime dict.                                                              |
| 9   | **Reserved preset id prefixes**: `sys:` (system, client-only, never persisted), `uc:` (user config, deterministic id `uc:<user>:<app>:<tableKey>`), `ac:` (app config, deterministic `ac:<user>:<app>`). Client writes to `sys:*` are rejected by the server controller.                                                                                  |
| 10  | **Server preset read gate**: `user = current OR (type='preset' AND public=true)`. Once-public-always-public — revoking publish permission doesn't unpublish existing rows.                                                                                                                                                                                |
| 11  | **`/meta` response carries `preferredId` on every row-returning read.** `moost-db` widens `$select` automatically; cells/actions/refs can rely on identity. Aggregate (`$groupBy`) and `$count` responses are NOT widened — see atscript-db skill, invariant 10.                                                                                            |

## Key imports

```ts
// Tier 1 — primary (auto-imported by AsResolver)
import {
  AsTableRoot, AsTable, AsWindowTable, AsTableActions, AsFilters, AsPresetPicker,
} from "@atscript/vue-table";

// Tier 2 — defaults (swap targets)
import {
  // cells
  AsCellArray, AsCellDate, AsCellJson, AsCellNumber, AsCellUnion, AsTableCellValue,
  // dialogs
  AsConfigDialog, AsFilterDialog, AsPresetDialog, AsConfirmDialog,
  // filter ui + headers + rows
  AsFilterField, AsFilterInput, AsTableHeaderCell, AsRowActions, AsColumnMenu,
} from "@atscript/vue-table";

// AsActionFormDialog is on a dedicated subpath — it pulls in @atscript/vue-form,
// so the table root lazy-mounts it. Import this only to override / eager-load.
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";

// Composables
import {
  useTable, useTableContext, useTableContextOptional,
  createTableState, createStaticTableState,
  useTableSelection, useTableNavBridge, useTableFilter, useTableSearch, useTableActions,
  useTableUrlQuery, useAppPrefs, usePresets, useLocalDraft,
  useCellLocale, provideCellLocale, useTableComponent,
} from "@atscript/vue-table";

// Factories
import { createDefaultControls, createDefaultCellTypes } from "@atscript/vue-table";

// Types (re-exported)
import type {
  TAsTableControls, TAsCellTypeComponents, ReactiveTableState,
  ColumnMenuConfig, ConfigTab, TableActionsState, ActionResult,
} from "@atscript/vue-table";

// Framework-agnostic table model (filter / preset / query primitives)
import {
  FilterCondition, FieldFilters, filtersToUniqueryFilter,
  PresetSnapshot, toWireSnapshot, fromWireSnapshot,
  buildTableQuery, mergeFilters, mergeSorters,
  stateToUrlQueryString, urlQueryStringToState,
} from "@atscript/ui-table";

// Server-side preset controller (Moost)
import { AsPresetsController, AsPresetEntry } from "@atscript/moost-ui-presets";
```

## References — load only what's needed

| Domain                  | File                                                                  | When                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact           | [getting-started.md](references/getting-started.md)                   | Install matrix, `<AsTableRoot>` props, the default `:types` + `:controls` maps, slot binding contract                                                                                                                                                                          |
| Query / data wiring     | [query.md](references/query.md)                                       | `url=` (moost-db) vs `queryFn` (custom), `buildTableQuery` Uniquery assembly, force filters/sorters, meta endpoint, mutators-are-pure principle in detail                                                                                                                       |
| Filtering               | [filtering.md](references/filtering.md)                               | Filter model (`FieldFilters` / `FilterCondition` / 13 condition types), OR/AND semantics, `filtersToUniqueryFilter` translation, `<AsFilters>` / `<AsFilterField>` / `<AsFilterDialog>`, value-help inside filter dialogs                                                       |
| Sorting + pagination    | [sorting-pagination.md](references/sorting-pagination.md)             | Sort model + multi-sort, header click semantics, `<AsConfigDialog>` sorters tab, paginated `<AsTable>` vs virtualized `<AsWindowTable>`, block-aligned `loadRange`, `dragReleaseDebounceMs` tuning                                                                              |
| Cells                   | [cells.md](references/cells.md)                                       | Built-in cell components + default type map, `provideCellLocale` (language + timezone), custom cells via `@ui.table.component` + `:components`, slot API (`#header-<path>`, `#cell-<path>`, `#empty`, `#query-loading`, `#error`), per-cell styling via `@ui.table.{classes,styles,attr}` |
| State persistence       | [state-persistence.md](references/state-persistence.md)               | `<AsConfigDialog>` tabs (columns/sorters/filters), `useTableUrlQuery` (router two-way bind), client presets (`PresetSnapshot`, `useLocalDraft`, `usePresets`, `useAppPrefs`, `<AsPresetPicker>`, system/user/public, `dateShortcuts`), server presets via `AsPresetsController` |
| Actions + selection     | [actions-selection.md](references/actions-selection.md)               | Row / table actions on the `.as` type, `<AsActionFormDialog>` (action input form via vue-form), `state.selectedRows` (`Set<PK>`), `togglePk` / `trimSelection` / `rowsToPks`, `state.actions.invoke(action, pk?, opts?)`, the `__actions` synthetic column                     |

## See also

Reference docs: https://ui.atscript.dev/tables/. Source: https://github.com/moostjs/atscript-ui.
