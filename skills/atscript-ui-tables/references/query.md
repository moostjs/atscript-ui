Query wiring, state contract, mutators, watchers.

## Contents

- [Two wiring paths](#two-wiring-paths)
- [queryFn signature in detail](#queryfn-signature-in-detail)
- [buildTableQuery](#buildtablequery)
- [Force filters and sorters](#force-filters-and-sorters)
- [Meta endpoint](#meta-endpoint)
- [ReactiveTableState](#reactivetablestate)
- [Mutators are pure](#mutators-are-pure)
- [Watcher fires](#watcher-fires)
- [scheduleQuery vs runQuery vs queryImmediate](#schedulequery-vs-runquery-vs-queryimmediate)
- [mustRefresh sentinel](#mustrefresh-sentinel)
- [Static mode](#static-mode)

## Two wiring paths

### Path A — moost-db (default)

```vue
<AsTableRoot url="/api/db/tables/products" :types="types" :controls="controls" />
```

`useTable(url, opts)` resolves a cached `MetaEntry` for the URL (`composables/use-table.ts:143-149`). The entry holds:

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

The Uniquery object (`packages/ui-table/src/query/build-table-query.ts:40-76`) carries:

| Key                                     | Origin                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `filter`                                | `mergeFilters(forceFilters, filtersToUniqueryFilter(state.filters))`               |
| `controls.$select`                      | `state.columnNames` (visible columns)                                              |
| `controls.$sort`                        | `mergeSorters(forceSorters, state.sorters)` → `{ field: 1\|-1 }` map               |
| `controls.$search` or `$search:<index>` | `state.searchTerm` (omitted when empty)                                            |
| `controls.$actions`                     | `true` when at least one row-actions column is rendered AND row/rows actions exist |

`page` is 1-based. Window mode rounds `page` against `blockSize` (`use-table-state.ts:524-526`). Cross-link the atscript-db skill for the `Uniquery` shape and `$with` / relation expansion.

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

- `forceFilters: FilterExpr` is AND'd at the **top level** with the user filter. The user can't override it because `filtersToUniqueryFilter` produces a separate expression that's merged below it (`packages/ui-table/src/query/merge-filters.ts`).
- `forceSorters: SortControl[]` prepends before user sorters and dedupes by field (`merge-sorters.ts`). Forced sorters always run first, then user sorters break ties.

Use these for tenancy filters, soft-delete gates, role-derived defaults — the user-facing `state.filters` / `state.sorters` stay independent and can be saved / shared without leaking the force layer.

## Meta endpoint

`AsTableRoot` calls `getMetaEntry(url, clientFactory)` from `@atscript/ui`. The shape (cross-link atscript-db skill `references/moost-db.md`) returned by `GET <url>/meta`:

```typescript
interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  preferredId: string[];
  versionColumn?: string; // name of the OCC version column (@db.column.version); absent when OCC isn't enabled
  crud: TCrudPermissions; // per-op booleans from @atscript/db-client
  actions: TDbActionInfo[]; // flat list — grouping happens client-side
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>; // FieldMeta = { sortable, filterable }
  type: TSerializedAnnotatedType;
}
```

`versionColumn?: string` is present on tables annotated with `@db.column.version`. `createTableDef` skips the column from `def.columns` so it never appears in column-picker / filter / sort dialogs. Custom `queryFn` implementations just need to preserve the field in the returned `MetaResponse`. The forms side reads it via `createFormDef(type, { versionColumn })` — see the `atscript-ui-forms` skill's OCC edit pattern.

`actions` is a **flat array** on the wire — grouping by level (`default.table` / `default.row` / `default.rows` + `others.*`) is computed client-side by `createTableDef` into the `TableActionsModel` (`TableDef.actions`). The composed `TableDef` widens the response with cell-resolution metadata (`flatMap`, `canRemove`, …). Per invariant 11, `preferredId` is guaranteed populated for every row-returning read so identity is available in every cell / action.

Meta is fetched **once** per URL+factory pair and cached. Remount of `<AsTableRoot>` with the same URL reuses the cache. Use `clearTableCache()` from `@atscript/vue-table` (alias of `resetMetaCache` in `@atscript/ui`) to flush during HMR / tests.

## ReactiveTableState

The full public state surface exposed via the default slot, `useTableContext().state`, and `<AsTableRoot ref>.state` (`packages/vue-table/src/types.ts:319-489`).

### Data refs

| Name                 | Type                            | Notes                                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `tableDef`           | `ShallowRef<TableDef \| null>`  | Composed once on metadata load.                                                 |
| `loadingMetadata`    | `Ref<boolean>`                  | True until `/meta` resolves or fails.                                           |
| `columnNames`        | `ShallowRef<string[]>`          | Visible columns, in render order.                                               |
| `columns`            | `ComputedRef<ColumnDef[]>`      | Derived from `columnNames` × `allColumns`.                                      |
| `allColumns`         | `ShallowRef<ColumnDef[]>`       | Every column from the `TableDef`.                                               |
| `columnWidths`       | `Ref<ColumnWidthsMap>`          | `{ [path]: { w: current, d: default } }`, deep-reactive.                        |
| `filterFields`       | `ShallowRef<string[]>`          | Visible filter input list (display state).                                      |
| `filters`            | `ShallowRef<FieldFilters>`      | Applied filter conditions (applied state). See [filtering.md](filtering.md).    |
| `sorters`            | `ShallowRef<SortControl[]>`     | Multi-sort supported.                                                           |
| `pagination`         | `Ref<{ page, itemsPerPage }>`   | Window mode keeps `page=1`.                                                     |
| `searchTerm`         | `Ref<string>`                   | Empty disables `$search`.                                                       |
| `results`            | `ShallowRef<Row[]>`             | Current page or window island.                                                  |
| `resultsStart`       | `Ref<number>`                   | Absolute offset of `results[0]`.                                                |
| `windowCache`        | `ShallowRef<Map<number, Row>>`  | Window-mode universal cache by absolute index.                                  |
| `windowLoading`      | `ShallowRef<Set<number>>`       | Block firstIndex values in flight via `loadRange`.                              |
| `topIndex`           | `Ref<number>`                   | Absolute index at top of the windowed viewport.                                 |
| `viewportRowCount`   | `Ref<number>`                   | Fixed-pool row count a windowed renderer is displaying.                         |
| `querying`           | `Ref<boolean>`                  | Set synchronously by `scheduleQuery`; cleared in `runQuery` finally.            |
| `queryingNext`       | `Ref<boolean>`                  | Set while `queryNext` is fetching extension blocks.                             |
| `totalCount`         | `Ref<number>`                   | From the last `data.count`.                                                     |
| `loadedCount`        | `ComputedRef<number>`           | `results.value.length`.                                                         |
| `queryError`         | `Ref<Error \| null>`            | Current data fetch error; cleared on success.                                   |
| `metadataError`      | `Ref<Error \| null>`            | `/meta` fetch error.                                                            |
| `lastError`          | `Ref<{ error, kind } \| null>`  | Latest error of any kind. Fresh wrapper per write so watchers fire.             |
| `mustRefresh`        | `Ref<boolean>`                  | Sentinel — set when state changed mid-flight; cleared at next `runQuery` start. |
| `selectedRows`       | `ShallowRef<unknown[]>`         | PKs per `rowValueFn`.                                                           |
| `rowDelete`          | `Ref<boolean \| RowDeleteOpt>`  | Renderer-owned; controls the synthesized `__remove` row action.                 |
| `includeActions`     | `Ref<boolean>`                  | Renderer-owned; controls `?$actions=true` augmentation.                         |
| `configDialogOpen`   | `Ref<boolean>`                  | Bound by `<AsConfigDialog>`.                                                    |
| `configTab`          | `Ref<ConfigTab>`                | `"columns" \| "sorters" \| "filters"`.                                          |
| `filterDialogColumn` | `Ref<ColumnDef \| null>`        | `null` = closed.                                                                |
| `activeIndex`        | `Ref<number>`                   | Keyboard-active row absolute index; `-1` = none.                                |
| `navMode`            | `Ref<"pagination" \| "window">` | Caps `activeIndex` against loaded rows or total.                                |
| `preset`             | `PresetSurface`                 | See [state-persistence.md](state-persistence.md).                               |
| `actions`            | `TableActionsState`             | See [actions-selection.md](actions-selection.md).                               |

### Methods

| Method                                                           | Effect                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `query()`                                                        | User-initiated refresh. Schedules a query through the same scheduler watchers use.        |
| `queryImmediate()`                                               | Awaitable; bypasses the microtask coalescer.                                              |
| `queryNext()`                                                    | Window-mode: extend by one block.                                                         |
| `loadRange(skip, limit)`                                         | Window-mode: fetch a specific block; populates `windowCache`.                             |
| `invalidate()`                                                   | Bump generation, drop results + window cache, recompute `resultsStart` from current page. |
| `resetFilters()`                                                 | Set `state.filters = {}`. Watcher re-fetches.                                             |
| `setFieldFilter(path, conditions)`                               | Replace conditions for one field; empty array removes the entry.                          |
| `removeFieldFilter(path)`                                        | Remove conditions key entirely.                                                           |
| `addFilterField(path)` / `removeFilterField(path)`               | Mutate display list `filterFields`. Independent of `filters`.                             |
| `setColumnWidth(path, width)`                                    | Update `columnWidths[path].w`.                                                            |
| `resetColumnWidth(path)`                                         | `columnWidths[path].w = columnWidths[path].d`.                                            |
| `showConfigDialog(tab?)`                                         | Open `<AsConfigDialog>` on a tab. Tab default `"columns"`.                                |
| `openFilterDialog(column)` / `closeFilterDialog()`               | Drive `<AsFilterDialog>`.                                                                 |
| `setActive(absIndex)` / `clearActive()`                          | Keyboard-active row.                                                                      |
| `toggleActiveSelection(mode)`                                    | Selection toggle helper.                                                                  |
| `registerMainActionListener(cb)`                                 | Returns disposer.                                                                         |
| `handleNavKey(event, opts?)`                                     | Translate keyboard events.                                                                |
| `applyUrlQuery(urlString)`                                       | Hydrate state from URL string (echo-guarded).                                             |
| `prompt(message, opts?)`                                         | Open the in-app confirm dialog. Resolves `boolean`.                                       |
| `requestActionInput(action, ctx)`                                | Open action-form dialog. Resolves with form payload or `null`.                            |
| `dataAt(absIndex)` / `loadingAt(absIndex)` / `errorAt(absIndex)` | Window-mode row accessors.                                                                |
| `actions.invoke(action, pk?, opts?)`                             | See [actions-selection.md](actions-selection.md).                                         |
| `preset.*`                                                       | See [state-persistence.md](state-persistence.md).                                         |

## Mutators are pure

Every mutator touches exactly one entity. Re-querying is a watcher reaction, never inline.

| Mutator                                | Touches                  | Watcher reacts                                  |
| -------------------------------------- | ------------------------ | ----------------------------------------------- |
| `setFieldFilter`                       | `filters[path]`          | `[filters, searchTerm]` (debounced 500ms)       |
| `removeFieldFilter`                    | `filters[path]` (delete) | same                                            |
| `resetFilters`                         | `filters = {}`           | same                                            |
| `addFilterField` / `removeFilterField` | `filterFields`           | (none — display state)                          |
| `setColumnWidth` / `resetColumnWidth`  | `columnWidths[path]`     | (none — visual only)                            |
| `state.sorters.value = next`           | `sorters`                | `sorters` → `requestRefresh()`                  |
| `state.columnNames.value = next`       | `columnNames`            | `columnNames` (set change) → `requestRefresh()` |
| `state.pagination.value = next`        | `pagination`             | `pagination` → `scheduleQuery()`                |
| `state.searchTerm.value = "..."`       | `searchTerm`             | `[filters, searchTerm]` (debounced 500ms)       |
| `state.includeActions.value = on`      | `includeActions`         | `includeActions` → `requestRefresh()`           |

Contract (invariants 1, 2, 3):

- **Programmatic state changes are picked up by the root watcher.** Calling `state.query()` to "apply" a change you just wrote will double-fetch and skip the 500ms search/filter debounce. `state.query()` is reserved for user-initiated refresh (a refresh button, pull-to-refresh, devtools).
- **Custom dialogs assign new arrays; the watcher reconciles.** A custom filter/columns/sorters dialog only needs to write the new arrays to `state.filterFields` / `state.filters` / `state.sorters` / `state.columnNames`. Cleanup loops that mirror display state into applied state (or vice versa) fight the watcher and re-trigger queries.
- **`filterFields` (display) and `filters` (applied) are independent.** Hiding an input never clears conditions; clearing conditions never hides the input. Useful for hydration: preset apply and URL replay can populate `filters` without the user opening the chip.

## Watcher fires

Source: `composables/use-table-state.ts:858-937`.

| Watch source                                 | Reaction                                                                    | Notes                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `[filters, searchTerm]`                      | `mustRefresh=true`; `resetPagination()`; debounce 500ms → `scheduleQuery()` | Debounces noisy keystroke flows.                                        |
| `sorters`                                    | `requestRefresh()` when not equal                                           | Skips `hydratingFromUrl`, skips pre-init.                               |
| `columnNames` (set change)                   | `requestRefresh()`                                                          | Set-equal change is a no-op.                                            |
| `pagination` (page or itemsPerPage)          | `scheduleQuery()`                                                           | `skipPaginationWatch` masks one tick after `resetPagination`.           |
| `[filters, sorters, searchTerm, pagination]` | `emitUrlIfChanged()`                                                        | URL bridge emitter; gated by `urlQueryReady` + echo guard.              |
| `includeActions`                             | `requestRefresh()`                                                          |                                                                         |
| `[tableDef, urlQueryReady, presetGateOpen]`  | first-time `scheduleQuery("initial")`                                       | All three gates open + results empty → fire one composed initial query. |

## scheduleQuery vs runQuery vs queryImmediate

`composables/use-table-state.ts:505-593`.

- `scheduleQuery(kind = "query")` — coalesces N synchronous calls into one `runQuery` via `queueMicrotask`. Sets `querying.value = true` synchronously so consumers checking the flag immediately see the loading state. First-scheduled kind wins.
- `runQuery(kind)` — clears `mustRefresh`, snaps `topIndex` to 0 on non-initial fetches, bumps `generation`, fetches, replaces `windowCache` / `results` / `totalCount`, settles `querying`. Late responses are discarded by generation check.
- `queryImmediate()` — awaitable. Clears any pending scheduled kind and runs `runQuery("query")` immediately. Use for "wait until done" flows (test setup, programmatic post-mutation refresh).
- `query()` — public alias for `scheduleQuery("query")`. User-initiated only.

## mustRefresh sentinel

Set when state mutated during in-flight query. Cleared at the start of the next `runQuery`. Surface in toolbars to show "stale" indicators ("filters changed — refreshing…"). Not a cancel signal.

## Static mode

`createStaticTableState(opts)` synthesizes a `TableDef` from in-memory rows + columns and runs sort / search locally (`composables/use-table-state.ts:984-1019`). Used internally by the enum value-help dialog. Use it for tests or for tables backed by a one-shot REST response that doesn't need server-side pagination.

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
