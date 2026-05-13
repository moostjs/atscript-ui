---
outline: deep
---

# Hello World

The shortest path from a `.as` type to a working, server-driven table.
You write the schema once; the server exposes it; the client mounts two
components. No column definitions, no row mappers, no AJAX glue.

::: info Prerequisites
This guide assumes you have a moost-db backend serving the `/meta` +
CRUD HTTP surface for an `.as` table. If you don't, jump to
[Query Function](/tables/query-function) for the custom `queryFn`
escape hatch — it lets you skip moost-db entirely.
:::

## 1. Define the schema

```atscript
// src/schemas/Product.as
@db.table 'products'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Product Name'
    @db.index.fulltext 'products_search'
    name: string

    @meta.label 'Description'
    @db.index.fulltext 'products_search'
    description?: string

    @meta.label 'Price'
    price: number

    @meta.label 'In Stock'
    @db.default 'true'
    inStock: boolean

    @meta.label 'Category'
    @db.index.plain 'category_idx'
    category: 'electronics' | 'clothing' | 'food' | 'books' | 'toys' | 'other'

    @meta.label 'SKU'
    @db.index.unique 'sku_idx'
    sku: string

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
```

A handful of annotations carry a lot of weight here:

- `@meta.id` — primary key. Surfaces in `/meta.primaryKeys`, drives row
  addressing for actions and `__remove`.
- `@meta.label` — column header text. Falls back to a humanised path
  when omitted.
- `@db.index.fulltext` — server-side `$search` index. Makes the table
  searchable (`tableDef.searchable === true`); the search box wires up
  automatically.
- `@db.index.plain` / `@db.index.unique` — flag the column as
  `filterable` / `sortable` in `/meta.fields[*]`, which in turn enables
  the column menu's filter and sort entries.
- The `'electronics' | 'clothing' | …` literal union becomes a
  preset list of options for the filter dialog without any extra
  wiring.

See [Annotations Reference](/tables/annotations) for the complete list.

## 2. Expose it

With moost-db wired up, the same `.as` file becomes a REST endpoint via
`@db.http.path` (or via your moost-db routing). For the example below
we assume `/db/tables/products` resolves to the standard
`AsDbReadableController` (`/meta`, `/q`, CRUD, actions, value-help).

::: tip
moost-db is documented in detail at
[db.atscript.dev — HTTP CRUD](https://db.atscript.dev/http/crud).
:::

If you don't run moost-db, see
[Query Function — Path B](/tables/query-function#path-b-custom-queryfn).

## 3. Mount the table

```vue
<script setup lang="ts">
import {
  AsTableRoot,
  AsTable,
  createDefaultControls,
  createDefaultCellTypes,
} from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const controls = createDefaultControls();
const types = createDefaultCellTypes();
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/products"
      :controls="controls"
      :types="types"
      :limit="10"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
    >
      <TableToolbar
        title="Products"
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
        <div v-if="loadingMetadata" class="table-loading-overlay" />
      </div>
      <TablePagination mode="pagination" />
    </AsTableRoot>
  </div>
</template>
```

That's the whole client.

## Anatomy of the mount

### `<AsTableRoot>` — the renderless orchestrator

`AsTableRoot` doesn't render any chrome of its own. It fetches `/meta`,
builds the `TableDef`, owns reactive state and exposes everything via a
slot. Key props:

| Prop              | Purpose                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `url`             | The data endpoint. moost-db serves `/meta` and `/q` (paged data) under the same path.                   |
| `limit`           | Default page size. Also the block size for `<AsWindowTable>` fetches.                                   |
| `types`           | Cell-type → component dispatch map. Seed with `createDefaultCellTypes()`, override entries as you go.   |
| `components`      | Named component overrides looked up via `@ui.table.component "name"`.                                   |
| `controls`        | Skin-slot map — header cell, column menu, filter dialog, config dialog, etc.                            |
| `queryFn`         | Replace the built-in moost-db data fetcher with your own. See [Query Function](/tables/query-function). |
| `forceFilters`    | Always-applied `FilterExpr` (Uniquery shape), AND-merged with user filters.                             |
| `forceSorters`    | Always-applied `SortControl[]`, prepended before user sorters; user can't remove them.                  |
| `preset`          | Opt-in preset configuration. Omit to disable presets.                                                   |
| `queryOnMount`    | Default `true`. Set `false` if you want to defer the first fetch.                                       |

The default slot exposes the full reactive state — `tableDef`,
`allColumns`, `columns`, `columnNames`, `columnWidths`,
`filterFields`, `filters`, `sorters`, `results`, `pagination`,
`searchTerm`, `selectedRows`, `selectedCount`, `totalCount`,
`loadedCount`, plus the loading/error flags (`querying`,
`queryingNext`, `loadingMetadata`, `queryError`, `metadataError`,
`mustRefresh`), the keyboard nav bridge (`navBridge`), and the
public methods (`query`, `queryNext`, `resetFilters`,
`showConfigDialog`, `openFilterDialog`, `closeFilterDialog`,
`setFieldFilter`, `removeFieldFilter`, `addFilterField`,
`removeFilterField`, `actions`, `prompt`). External `v-model`s are
supported for `filterFields`, `columnNames`, `columnWidths`,
`sorters`, `selectedRows` and the URL bridge `urlQuery`.

Underneath, `<AsTableRoot>` also mounts its companion dialogs
(`AsFilterDialog`, `AsConfigDialog`, `AsConfirmDialog`, and lazily
`AsActionFormDialog` when actions carry `@InputForm` payloads) so
column-menu and row-action flows work without any extra wiring on
your side.

### `<AsTable>` — the renderer

`<AsTable>` injects the root context and renders the actual `<table>`.
It accepts presentational props only: `:stickyHeader`, `:select`
(selection mode), `:rowActionsColumn` (insert a synthesised actions
column), `:columnMenu` (which entries to show in the header dropdown),
`:reorderable`, `:resizable`, `:columnMinWidth`. State props
(`:rows`, `:columns`) are escape hatches — by default it reads
`state.results` and `state.columns` straight from the context.

`<AsWindowTable>` is the virtualised twin. Same context, different
renderer — see [Pagination & Virtualization](/tables/pagination).

### `createDefaultCellTypes()` and `createDefaultControls()`

Both helpers return fresh maps you can spread to extend or override:

```ts
import {
  createDefaultCellTypes,
  createDefaultControls,
  AsTableCellValue,
} from "@atscript/vue-table";
import StatusBadgeCell from "./StatusBadgeCell.vue";
import MyFilterDialog from "./MyFilterDialog.vue";

const components = {
  status: StatusBadgeCell, // matches @ui.table.component 'status'
};

const controls = {
  ...createDefaultControls(),
  filterDialog: MyFilterDialog,
};
```

The default cell-type map:

| Cell type   | Default component   |
| ----------- | ------------------- |
| `text`      | `AsTableCellValue`  |
| `number`    | `AsCellNumber`      |
| `boolean`   | `AsTableCellValue`  |
| `date`      | `AsCellDate`        |
| `datetime`  | `AsCellDate`        |
| `relative`  | `AsCellDate`        |
| `array`     | `AsCellArray`       |
| `object`    | `AsCellJson`        |
| `union`     | `AsCellUnion`       |
| `enum`      | `AsTableCellValue`  |
| `ref`       | `AsTableCellValue`  |
| `__actions` | `AsRowActions`      |

## Next steps

- [Annotations Reference](/tables/annotations) — every annotation the
  table reads.
- [Query Function](/tables/query-function) — non-moost backends and
  force filters.
- [Filtering](/tables/filtering) — the filter bar, value-help, and how
  filters become Uniquery.
