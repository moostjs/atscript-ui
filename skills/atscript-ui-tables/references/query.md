Query wiring, state contract, mutators.

## Contents

- [Two wiring paths](#two-wiring-paths)
- [queryFn signature in detail](#queryfn-signature-in-detail)
- [buildTableQuery](#buildtablequery)
- [Force filters and sorters](#force-filters-and-sorters)
- [Meta endpoint](#meta-endpoint)
- [ReactiveTableState](#reactivetablestate)
- [Mutators are pure](#mutators-are-pure)
- [Path C — local rows](#path-c-local-rows-since-01134)
- [Path C — local rows](#path-c-local-rows-since-01134)
- [Static mode](#static-mode-custom-roots)

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

`url=` is still required even with `queryFn` — it drives the `/meta` fetch that builds the `TableDef`. To bypass `/meta` entirely, pass `:rows` + `:columns` (see [Path C — local rows](#path-c-local-rows-since-01134)).

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
| `filter`                                | `mergeFilters(forceFilters, filtersToUniqueryFilter(state.filters), ...residualFilters)`                                                                                                    |
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

Force filters and sorters are **never pruned** of fields the caller cannot read (0.1.141+ prunes presets, drafts and URLs — [hidden-fields.md](hidden-fields.md)). Name only fields every role reads, or the query 400s for the narrower roles.

## blockQuery

`<AsTableRoot :block-query>` / `useTable(url, { blockQuery })` short-circuits every fetch trigger: the bootstrap query, `query()`, `queryNext()` and `loadRange()`.

Reactive since 0.1.133 — the component prop is passed as a getter, and `useTable` accepts `boolean | (() => boolean)`. A table mounted while blocked stays empty and runs its first query the moment the flag clears (exactly once, coalesced); re-blocking stops everything again, and state changed while blocked is replayed on the next unblock. Before 0.1.133 the value was captured once at setup, so a table mounted with `blockQuery: true` never fetched.

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

| Method                                                           | Effect                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query(opts?)`                                                   | User-initiated refresh through the shared scheduler. Pass `{ silent: true }` for timer-driven live refresh — see [Silent live refresh](#silent-live-refresh). |
| `queryImmediate(opts?)`                                          | Awaitable refresh (fires now, cancels the coalesced query, resolves after the response/error is processed). Also accepts `{ silent: true }`.                  |
| `resetFilters()`                                                 | Set `state.filters = {}` and `state.residualFilters = []` (0.1.140+). Watcher re-fetches.                                                                     |
| `setResidualFilters(exprs)` / `removeResidualFilter(i)`          | 0.1.140+. Replace / remove AND-ed conditions the field model can't hold — see [filtering.md](filtering.md#residual-filter-conditions).                        |
| `setFieldFilter(path, conditions)`                               | Replace conditions for one field; empty array removes the entry.                                                                                              |
| `removeFieldFilter(path)`                                        | Remove conditions key entirely.                                                                                                                               |
| `addFilterField(path)` / `removeFilterField(path)`               | Mutate display list `filterFields`. Independent of `filters`.                                                                                                 |
| `setColumnWidth(path, width)`                                    | Update `columnWidths[path].w`.                                                                                                                                |
| `resetColumnWidth(path)`                                         | `columnWidths[path].w = columnWidths[path].d`.                                                                                                                |
| `showConfigDialog(tab?)`                                         | Open `<AsConfigDialog>` on a tab. Tab default `"columns"`.                                                                                                    |
| `openFilterDialog(column)` / `closeFilterDialog()`               | Drive `<AsFilterDialog>`.                                                                                                                                     |
| `applyUrlQuery(urlString, opts?)`                                | Hydrate from a URL (echo-guarded). `$snapshot` replaces, else overlays the boot baseline; `opts.mode` overrides. [More](state-persistence.md).                |
| `prompt(message, opts?)`                                         | Open the in-app confirm dialog. Resolves `boolean`.                                                                                                           |
| `requestActionInput(action, ctx)`                                | Open action-form dialog. Resolves with form payload or `null`.                                                                                                |
| `actions.invoke(action, pk?, opts?)`                             | See [actions-selection.md](actions-selection.md).                                                                                                             |
| `preset.*`                                                       | See [state-persistence.md](state-persistence.md).                                                                                                             |
| `dataAt(absIndex)` / `loadingAt(absIndex)` / `errorAt(absIndex)` | Window-mode row accessors. Use these from a custom virtual renderer; the built-in `<AsWindowTable>` calls them internally.                                    |

### Silent live refresh

`query({ silent: true })` / `queryImmediate({ silent: true })` re-run the **current** query (live filters, sorters, search, pagination, `$actions` — all respected) without any loading affordance. Use it for timer-driven refresh of "ops" grids.

```ts
import { useIntervalFn } from "@vueuse/core";

useIntervalFn(() => state.query({ silent: true }), 15_000);
```

Guarantees:

- Never flips `state.querying` — no toolbar spinner, no skeletons, no query overlay.
- **Loud-wins coalescing** — if a user-initiated (loud) query lands in the same tick as a silent one, the spinner still shows.
- **Fails safe** — on error, displayed rows / cache / `totalCount` / error state are left untouched; a silent refresh never blanks or toasts the grid.
- Preserves scroll position — the viewport is never snapped back to top.
- Relies on **keep-rows-until-settle**: every query (silent or not) keeps prior rows visible until the response settles, then swaps `results` + `totalCount` atomically — results are never pre-wiped. This is what makes silent refresh flicker-free.
- `QueryOptions` (the `{ silent?: boolean }` shape) is exported from both `@atscript/vue-table` and `@atscript/ui-table`.

## Mutators are pure

When you build a custom filter dialog, columns dialog, or toolbar, just write the new arrays to the model — `state.filterFields` / `state.filters` / `state.sorters` / `state.columnNames` / `state.pagination` / `state.searchTerm`. The root watcher picks up the change and re-queries. Two things to avoid:

- **Don't call `state.query()` to apply your change.** That's reserved for user-initiated refresh (a refresh button, pull-to-refresh, devtools). Calling it after a model write double-fetches and skips the 500ms search/filter debounce. The one sanctioned exception: re-running the _current_ query on a timer via `query({ silent: true })` — see [Silent live refresh](#silent-live-refresh).
- **Don't run cleanup loops that mirror display state into applied state.** A "removed from `filterFields`, now delete from `filters`" loop fights the watcher and re-triggers queries.

Public independence guarantee: `filterFields` (display) and `filters` (applied) are independent. Hiding a chip never clears its conditions; clearing conditions never hides the chip. The same rule applies to any future display/applied pair on columns or sorters. Hydration flows (preset apply, URL replay) take advantage of this: they can populate `filters` without forcing the user to open the chip first.

## Path C — local rows (since 0.1.134)

Rows already in hand? Give `<AsTableRoot>` `:rows` + `:columns` instead of a `:url`. No client is constructed, no `/meta` request is made, no entry lands in the URL-keyed metadata cache.

```vue
<AsTableRoot :rows="rows" :columns="columns" :search-paths="['name']">
  <AsTable select="multi" />
</AsTableRoot>
```

| Prop          | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `rows`        | The dataset. REACTIVE — replacing the array re-queries locally.                    |
| `columns`     | `ColumnDef[]`, read ONCE at setup (not reactive).                                  |
| `searchPaths` | Paths `searchTerm` matches (substring, case-insensitive). Omit to disable search.  |
| `localSort`   | In-memory sort from the active sorters. Default `true`; `false` keeps array order. |

Cells, keyboard nav, header/cell slots, selection, the config dialog and pagination all work unchanged; sort / search / paging run in memory.

Inert in local mode, each warning once on the console: `:preset`, `v-model:url-query`, `:query-fn`, and `:url` itself (ignored when `:rows` is present). There are no server actions either — use [`:row-actions` `extra`](actions-selection.md#per-screen-row-action-policy-rowactions-since-01134) for app-owned row actions.

## Static mode (custom roots)

`createStaticTableState(opts)` is the factory behind local mode: it synthesizes a `TableDef` from in-memory rows + columns and runs sort / search locally. Reach for it directly only when writing a custom root; otherwise use `<AsTableRoot :rows>`.

```typescript
import { createStaticTableState, provideTableContext } from "@atscript/vue-table";

const { state } = createStaticTableState({
  rows: () => props.rows, // getter/ref = reactive; a plain array is a snapshot
  columns: [...],
  searchPaths: ["name", "sku"],
  localSort: true,
  limit: 25,
});
provideTableContext({ state, client: {} as Client, controls: {} });
```

`provideTableContext` / `useTableContext` + the `TableContext` type are exported (since 0.1.134) precisely so a custom root can do this. Cannot host server actions (no `client`); `client.pages` is replaced with an in-memory filter+sort.
