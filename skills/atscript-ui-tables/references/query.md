Query wiring, state contract, mutators.

## Contents

- [Two wiring paths](#two-wiring-paths)
- [queryFn signature in detail](#queryfn-signature-in-detail)
- [buildTableQuery](#buildtablequery)
- [Force filters and sorters](#force-filters-and-sorters)
- [Meta endpoint](#meta-endpoint)
- [ReactiveTableState](#reactivetablestate)
- [Mutators are pure](#mutators-are-pure)
- [Static mode](#static-mode)

## Two wiring paths

### Path A — moost-db (default)

```vue
<AsTableRoot url="/api/db/tables/products" :types="types" :controls="controls" />
```

`useTable(url, opts)` resolves a cached `MetaEntry` for the URL. The entry holds:

- `entry.meta` — `MetaResponse` (`/meta` endpoint)
- `entry.type` — atscript runtime type
- `entry.tableDef` — composed `TableDef` (promise)
- `entry.client` — `@atscript/db-client` `Client` instance

Internal dispatch when `queryFn` is absent:

```typescript
(q, page, size) => client.pages(q, page, size);
```

See the atscript-db skill for the moost-db URL syntax and `Client` API.

### Path B — custom

```vue
<AsTableRoot :query-fn="qf" url="/api/db/tables/products" ... />
```

```typescript
const qf: QueryFn = async (query, page, size) => {
  const res = await myBackend(query, page, size);
  return {
    data: res.rows,
    count: res.total,
    page,
    itemsPerPage: size,
    pages: Math.ceil(res.total / size),
  };
};
```

`url=` is still required even with `queryFn` — it drives the `/meta` fetch that builds the `TableDef`. To bypass `/meta` entirely, use `createStaticTableState` (see [Static mode](#static-mode)).

## queryFn signature in detail

```typescript
export type QueryFn = (
  query: Uniquery,
  page: number,
  size: number,
) => Promise<PageResult<Record<string, unknown>>>;

interface PageResult<T> {
  data: T[];
  count: number;
  page: number;
  itemsPerPage: number;
  pages: number;
}
```

The Uniquery object carries:

| Key                                     | Origin                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`                                | `mergeFilters(forceFilters, filtersToUniqueryFilter(state.filters))`                                                                                                                        |
| `controls.$select`                      | `state.columnNames` (visible columns) + `@ui.table.selectWith` deps of visible columns + `alwaysSelected`, all gated by available meta — see [cells.md](cells.md) (fetching sibling fields) |
| `controls.$sort`                        | `mergeSorters(forceSorters, state.sorters)` → `{ field: 1\|-1 }` map                                                                                                                        |
| `controls.$search` or `$search:<index>` | `state.searchTerm` (omitted when empty)                                                                                                                                                     |
| `controls.$actions`                     | `true` when at least one row-actions column is rendered AND row/rows actions exist                                                                                                          |

`page` is 1-based. Window mode rounds `page` against `blockSize`. Cross-link the atscript-db skill for the `Uniquery` shape and `$with` / relation expansion.

## buildTableQuery

```typescript
import { buildTableQuery } from "@atscript/ui-table";

const q = buildTableQuery({
  visibleColumnPaths: state.columnNames.value,
  sorters: state.sorters.value,
  forceSorters: opts.forceSorters,
  filters: state.filters.value,
  forceFilters: opts.forceFilters,
  search: state.searchTerm.value || undefined,
  includeActions: state.includeActions.value,
});
```

Pure function, no framework dependencies. Returns a `Uniquery` ready for `client.pages` (or any `queryFn`). Use it from custom toolbars that need to show "current query" without re-fetching.

## Force filters and sorters

- `forceFilters: FilterExpr` is AND'd at the **top level** with the user filter. The user can't override it because `filtersToUniqueryFilter` produces a separate expression that's merged below it.
- `forceSorters: SortControl[]` prepends before user sorters and dedupes by field. Forced sorters always run first, then user sorters break ties.

Use these for tenancy filters, soft-delete gates, role-derived defaults — the user-facing `state.filters` / `state.sorters` stay independent and can be saved / shared without leaking the force layer.

## Meta endpoint

`AsTableRoot` calls `getMetaEntry(url, clientFactory)` from `@atscript/ui`. The shape returned by `GET <url>/meta` (cross-link atscript-db skill `references/moost-db.md`):

```typescript
interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  preferredId: string[];
  versionColumn?: string; // name of the OCC version column (@db.column.version); absent when OCC isn't enabled
  crud: TCrudPermissions; // per-op booleans from @atscript/db-client
  actions: TDbActionInfo[]; // flat array on the wire; the table groups it client-side by level
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>; // FieldMeta = { sortable, filterable }
  type: TSerializedAnnotatedType;
}
```

`versionColumn?: string` is present on tables annotated with `@db.column.version`. `createTableDef` skips the column from `def.columns` so it never appears in column-picker / filter / sort dialogs. Custom `queryFn` implementations just need to preserve the field in the returned `MetaResponse`. The forms side reads it via `createFormDef(type, { versionColumn })` — see the `atscript-ui-forms` skill's OCC edit pattern.

Meta is fetched **once** per URL+factory pair and cached. Remount of `<AsTableRoot>` with the same URL reuses the cache. Use `clearTableCache()` from `@atscript/vue-table` (alias of `resetMetaCache` in `@atscript/ui`) to flush during HMR / tests.

## ReactiveTableState

The public state surface exposed via the default slot, `useTableContext().state`, and `<AsTableRoot ref>.state`.

### Data refs

| Name              | Type                           | Notes                                                                        |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `tableDef`        | `ShallowRef<TableDef \| null>` | Composed once on metadata load.                                              |
| `loadingMetadata` | `Ref<boolean>`                 | True until `/meta` resolves or fails.                                        |
| `columnNames`     | `ShallowRef<string[]>`         | Visible columns, in render order.                                            |
| `columns`         | `ComputedRef<ColumnDef[]>`     | Derived from `columnNames` × `allColumns`.                                   |
| `allColumns`      | `ShallowRef<ColumnDef[]>`      | Every column from the `TableDef`.                                            |
| `columnWidths`    | `Ref<ColumnWidthsMap>`         | `{ [path]: { w: current, d: default } }`, deep-reactive.                     |
| `filterFields`    | `ShallowRef<string[]>`         | Visible filter input list (display state).                                   |
| `filters`         | `ShallowRef<FieldFilters>`     | Applied filter conditions (applied state). See [filtering.md](filtering.md). |
| `sorters`         | `ShallowRef<SortControl[]>`    | Multi-sort supported.                                                        |
| `pagination`      | `Ref<{ page, itemsPerPage }>`  | Window mode keeps `page=1`.                                                  |
| `searchTerm`      | `Ref<string>`                  | Empty disables `$search`.                                                    |
| `results`         | `ShallowRef<Row[]>`            | Current page or window island.                                               |
| `totalCount`      | `Ref<number>`                  | From the last `data.count`.                                                  |
| `loadedCount`     | `ComputedRef<number>`          | `results.value.length`.                                                      |
| `queryError`      | `Ref<Error \| null>`           | Current data fetch error; cleared on success.                                |
| `metadataError`   | `Ref<Error \| null>`           | `/meta` fetch error.                                                         |
| `selectedRows`    | `ShallowRef<unknown[]>`        | PKs per `rowValueFn`.                                                        |
| `preset`          | `PresetSurface`                | See [state-persistence.md](state-persistence.md).                            |
| `actions`         | `TableActionsState`            | See [actions-selection.md](actions-selection.md).                            |

### Methods

| Method                                                           | Effect                                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `query()`                                                        | User-initiated refresh. Schedules a query through the same scheduler watchers use.                                         |
| `queryImmediate()`                                               | Awaitable refresh. Use when you need to `await` the next fetch (tests, programmatic flows).                                |
| `resetFilters()`                                                 | Set `state.filters = {}`. Watcher re-fetches.                                                                              |
| `setFieldFilter(path, conditions)`                               | Replace conditions for one field; empty array removes the entry.                                                           |
| `removeFieldFilter(path)`                                        | Remove conditions key entirely.                                                                                            |
| `addFilterField(path)` / `removeFilterField(path)`               | Mutate display list `filterFields`. Independent of `filters`.                                                              |
| `setColumnWidth(path, width)`                                    | Update `columnWidths[path].w`.                                                                                             |
| `resetColumnWidth(path)`                                         | `columnWidths[path].w = columnWidths[path].d`.                                                                             |
| `showConfigDialog(tab?)`                                         | Open `<AsConfigDialog>` on a tab. Tab default `"columns"`.                                                                 |
| `openFilterDialog(column)` / `closeFilterDialog()`               | Drive `<AsFilterDialog>`.                                                                                                  |
| `applyUrlQuery(urlString)`                                       | Hydrate state from URL string (echo-guarded).                                                                              |
| `prompt(message, opts?)`                                         | Open the in-app confirm dialog. Resolves `boolean`.                                                                        |
| `requestActionInput(action, ctx)`                                | Open action-form dialog. Resolves with form payload or `null`.                                                             |
| `actions.invoke(action, pk?, opts?)`                             | See [actions-selection.md](actions-selection.md).                                                                          |
| `preset.*`                                                       | See [state-persistence.md](state-persistence.md).                                                                          |
| `dataAt(absIndex)` / `loadingAt(absIndex)` / `errorAt(absIndex)` | Window-mode row accessors. Use these from a custom virtual renderer; the built-in `<AsWindowTable>` calls them internally. |

## Mutators are pure

When you build a custom filter dialog, columns dialog, or toolbar, just write the new arrays to the model — `state.filterFields` / `state.filters` / `state.sorters` / `state.columnNames` / `state.pagination` / `state.searchTerm`. The root watcher picks up the change and re-queries. Two things to avoid:

- **Don't call `state.query()` to apply your change.** That's reserved for user-initiated refresh (a refresh button, pull-to-refresh, devtools). Calling it after a model write double-fetches and skips the 500ms search/filter debounce.
- **Don't run cleanup loops that mirror display state into applied state.** A "removed from `filterFields`, now delete from `filters`" loop fights the watcher and re-triggers queries.

Public independence guarantee: `filterFields` (display) and `filters` (applied) are independent. Hiding a chip never clears its conditions; clearing conditions never hides the chip. The same rule applies to any future display/applied pair on columns or sorters. Hydration flows (preset apply, URL replay) take advantage of this: they can populate `filters` without forcing the user to open the chip first.

## Static mode

`createStaticTableState(opts)` synthesizes a `TableDef` from in-memory rows + columns and runs sort / search locally. Used internally by the enum value-help dialog. Use it for tests or for tables backed by a one-shot REST response that doesn't need server-side pagination.

```typescript
import { createStaticTableState } from "@atscript/vue-table";

const { state } = createStaticTableState({
  rows: [...],
  columns: [...],
  searchPaths: ["name", "sku"],
  limit: 25,
});
```

Cannot host server actions (no `client`); `client.pages` is replaced with an in-memory filter+sort.
