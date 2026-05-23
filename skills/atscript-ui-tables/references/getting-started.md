Mounting a table, prop and slot surface, tier rules.

## Contents

- [Minimal mount](#minimal-mount)
- [AsTableRoot props summary](#astableroot-props-summary)
- [AsTableRoot v-models](#astableroot-v-models)
- [AsTableRoot emits](#astableroot-emits)
- [AsTableRoot slot binding](#astableroot-slot-binding)
- [Default control + cell-type factories](#default-control--cell-type-factories)
- [Tier 1 / 2 / 3](#tier-1--2--3)
- [Reading list](#reading-list)

## Minimal mount

Schema (`.as`) declares the row shape with `@db.table`, `@meta.id`, and `@ui.table.*`:

```atscript
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

    inStock: boolean
}
```

Vue mount:

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

- `url=` activates the moost-db path; `:query-fn=` activates the custom path. See [query.md](query.md).
- `<AsTable>` is paginated. Swap for `<AsWindowTable>` for virtualized scrolling. See [sorting-pagination.md](sorting-pagination.md).
- `<AsFilters>` renders the configured filter chips (`state.filterFields`). See [filtering.md](filtering.md).

## AsTableRoot props summary

| Prop                    | Type                                                               | Default        | Purpose                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `url`                   | `string`                                                           | (required\*)   | moost-db endpoint, e.g. `/api/db/tables/products`. \*Still required even with `queryFn` — drives `/meta`.                          |
| `queryFn`               | `(q: Uniquery, page: number, size: number) => Promise<PageResult>` | —              | Bypass moost-db `client.pages`; provide your own backend. See [query.md](query.md).                                                |
| `clientFactory`         | `ClientFactory`                                                    | app default    | Override how the underlying `Client` is built. Falls back to `getDefaultClientFactory()`.                                          |
| `controls`              | `TAsTableControls`                                                 | `{}`           | Skin-slot override map (header cell, filter dialog, config dialog, preset picker/dialog, row actions, etc.).                       |
| `types`                 | `TAsCellTypeComponents`                                            | —              | Cell-type → component map. Seed with `createDefaultCellTypes()`.                                                                   |
| `components`            | `Record<string, Component>`                                        | —              | Named cell overrides for `@ui.table.component "name"`.                                                                             |
| `formTypes`             | `TAsTypeComponents`                                                | —              | Form-type map for the action-form dialog (`@InputForm`).                                                                           |
| `formComponents`        | `Record<string, Component>`                                        | —              | Named form overrides for the action-form dialog.                                                                                   |
| `limit`                 | `number`                                                           | `25`           | Initial `pagination.itemsPerPage`.                                                                                                 |
| `forceFilters`          | `FilterExpr`                                                       | —              | Always-AND'd Uniquery filter expression; user mutations can't remove it.                                                           |
| `forceSorters`          | `SortControl[]`                                                    | —              | Prepended before user sorters and dedup'd by field.                                                                                |
| `queryOnMount`          | `boolean`                                                          | `true`         | When `false`, the initial fetch never fires.                                                                                       |
| `blockQuery`            | `boolean`                                                          | `false`        | When truthy, suppresses all data fetches (refresh, scroll-driven, extension). Use as a gate while a dependency is still resolving. |
| `rowValueFn`            | `(row) => unknown`                                                 | identity-by-PK | Extracts the unique key per row for the selection model.                                                                           |
| `selectionPersistence`  | `"clear" \| "trim" \| "persist"`                                   | `"trim"`       | What happens to `selectedRows` on every results replacement.                                                                       |
| `blockSize`             | `number`                                                           | `100`          | Window-mode fetch block size. Larger = fewer fetches but bigger payloads.                                                          |
| `dragReleaseDebounceMs` | `number`                                                           | `300`          | Window-mode scroll debounce. Higher values issue fewer fetches during fast scroll.                                                 |
| `refreshOnAction`       | `boolean`                                                          | `true`         | Refetch after successful `backend` / `__remove` action invokes.                                                                    |
| `urlQuerySync`          | `UrlQuerySync`                                                     | full sync      | Per-aspect URL bridge gate (`filters`, `sorters`, `search`, `pagination`).                                                         |
| `preset`                | `PresetConfig`                                                     | —              | Opt-in preset feature; requires `url` and `tableKey`. See [state-persistence.md](state-persistence.md).                            |

`PresetConfig`:

| Field           | Type                  | Notes                                                                                  |
| --------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `url`           | `string`              | Preset controller URL, e.g. `"/api/db/_presets"`.                                      |
| `tableKey`      | `string`              | Scopes preset rows under `(app, tableKey)`.                                            |
| `app`           | `string`              | Defaults to `inject(AS_PRESETS_APP)`.                                                  |
| `systemPresets` | `SystemPresetInput[]` | Consumer-supplied `sys:*` entries (never persisted).                                   |
| `aspects`       | `PresetAspect[]`      | Default `['columns','filters','filterOps','sorters']`. Add `'itemsPerPage'` if needed. |
| `persistDrafts` | `boolean`             | Opt-in localStorage overlay. Default `false`.                                          |

## AsTableRoot v-models

| v-model                 | Initial     | Purpose                                                                             |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `v-model:filter-fields` | `[]`        | Visible filter input list. Display state — independent of applied conditions.       |
| `v-model:column-names`  | `[]`        | Visible columns, in render order. Seeded from `getVisibleColumns(tableDef)`.        |
| `v-model:column-widths` | `{}`        | `ColumnWidthsMap` — `{ [path]: { w, d } }`. Defaults reconciled against the schema. |
| `v-model:sorters`       | `[]`        | `SortControl[]` — multi-sort supported.                                             |
| `v-model:selected-rows` | `[]`        | PK list per `rowValueFn`. Persistence policy controlled by `selectionPersistence`.  |
| `v-model:url-query`     | `undefined` | Two-way string bridge. Bind via `useTableUrlQuery(useRoute(), useRouter())`.        |

## AsTableRoot emits

| Event         | Args                            | Trigger                                                                                               |
| ------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `main-action` | `(row, absIndex, event)`        | Row activated (double-click, Enter when no default row action, programmatic).                         |
| `action`      | `(action, ids, result, event?)` | Any action settle (`success` / `error` / `custom`). See [actions-selection.md](actions-selection.md). |

## AsTableRoot slot binding

Default slot receives the public state surface:

```typescript
v-slot="{
  tableDef, loadingMetadata,
  allColumns, columnNames, columnWidths, columns,
  filterFields, filters, sorters,
  results, querying, totalCount, loadedCount,
  pagination, queryError, metadataError, searchTerm,
  selectedRows, selectedCount,
  // methods
  query, resetFilters,
  showConfigDialog, openFilterDialog, closeFilterDialog,
  setFieldFilter, removeFieldFilter,
  addFilterField, removeFilterField,
  actions, prompt,
}"
```

Beyond the slot, the full `ReactiveTableState` is exposed via `useTableContext()` from any descendant. Components rendered outside the default slot (Tier-2 dialogs `<AsFilterDialog>`, `<AsConfigDialog>`, `<AsConfirmDialog>`, `<AsPresetDialog>`, lazy `<AsActionFormDialog>`) are mounted by `<AsTableRoot>` itself — placing them inside the slot will double-mount and break the dialog's open-state binding. Swap via the `controls` map instead.

## Default control + cell-type factories

`createDefaultControls()`:

| Slot key           | Default component        |
| ------------------ | ------------------------ |
| `headerCell`       | `AsTableHeaderCell`      |
| `columnMenu`       | `AsColumnMenu`           |
| `filterDialog`     | `AsFilterDialog`         |
| `filterInput`      | `AsFilterInput`          |
| `filterField`      | `AsFilterField`          |
| `configDialog`     | `AsConfigDialog`         |
| `confirmDialog`    | `AsConfirmDialog`        |
| `rowActions`       | `AsRowActions`           |
| `actionFormDialog` | (lazy-mounted on demand) |

`createDefaultCellTypes()`:

| Cell type   | Default component  |
| ----------- | ------------------ |
| `text`      | `AsTableCellValue` |
| `number`    | `AsCellNumber`     |
| `boolean`   | `AsTableCellValue` |
| `date`      | `AsCellDate`       |
| `datetime`  | `AsCellDate`       |
| `relative`  | `AsCellDate`       |
| `array`     | `AsCellArray`      |
| `object`    | `AsCellJson`       |
| `union`     | `AsCellUnion`      |
| `enum`      | `AsTableCellValue` |
| `ref`       | `AsTableCellValue` |
| `__actions` | `AsRowActions`     |

Both factories return fresh maps — spread to override:

```typescript
const types = { ...createDefaultCellTypes(), status: StatusBadgeCell };
const controls = { ...createDefaultControls(), filterDialog: MyFilterDialog };
```

## Tier 1 / 2 / 3

| Tier         | Auto-resolver | Subpath import | Use                                                                                                                                                                                                                                                                                                |
| ------------ | ------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — primary  | yes           | yes            | Tags user writes: `AsTableRoot`, `AsTable`, `AsWindowTable`, `AsTableActions`, `AsFilters`, `AsPresetPicker`.                                                                                                                                                                                      |
| 2 — defaults | no            | yes            | Swap targets: cell types (`AsCellNumber`, `AsCellDate`, …), dialogs (`AsConfigDialog`, `AsFilterDialog`, `AsPresetDialog`, lazy `AsActionFormDialog`), row chrome (`AsRowActions`, `AsTableHeaderCell`, `AsColumnMenu`, `AsFilterField`, `AsFilterInput`).                                         |
| 3 — internal | no            | no             | Composition helpers (`AsTableBase`, `AsTableVirtualizer`, `AsFilterConditions`, `AsFilterValueHelp`, `AsOrderableList`, `AsFieldsSelector`, `AsSortersConfig`, `AsActionMenuContent`, …). Not part of the public API surface — no subpath export, may move or change shape between minor releases. |

`AsActionFormDialog` is intentionally not exported from the defaults barrel — re-exporting bundles `@atscript/vue-form` into every consumer. Subpath import: `@atscript/vue-table/as-action-form-dialog`. To eager-mount, assign it to `controls.actionFormDialog`.

## Reading list

- Wiring + state — [query.md](query.md)
- Filter model + dialogs — [filtering.md](filtering.md)
- Sort + pagination + window — [sorting-pagination.md](sorting-pagination.md)
- Cell components + locale — [cells.md](cells.md)
- URL bridge + presets + drafts — [state-persistence.md](state-persistence.md)
- Actions + selection — [actions-selection.md](actions-selection.md)
