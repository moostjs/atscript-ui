---
outline: deep
---

# Pagination & Virtualization

`vue-table` ships two renderers that share the same `<AsTableRoot>`
context: classic page-by-page `<AsTable>`, and the virtualised
`<AsWindowTable>` that streams blocks as the user scrolls. The state
contract is identical — only the chrome and the fetch strategy differ.

## Choosing a mode

|                            | `<AsTable>` (paginated)                             | `<AsWindowTable>` (virtual)                                |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Row count it scales to     | hundreds to low thousands per page                  | tens of thousands or unbounded                             |
| Visible rows               | the whole page is in the DOM                        | only the viewport window (+ overscan)                      |
| Fetch unit                 | one page at a time                                  | block-aligned slices of `:limit` rows                      |
| Pagination control         | external (you pair `state.pagination`)              | none — scroll is the controller                            |
| Best for                   | CRUD admin, value-help, lists you act on row-by-row | logs, ledgers, analytics drilldowns, infinite-scroll feels |
| Mounts the loading overlay | yes (`querying`)                                    | yes (`querying`) + per-row skeleton (`windowLoading`)      |

If you're not sure, start with `<AsTable>`. Swap to `<AsWindowTable>`
once you actually hit row counts where loading every page is wasteful.

## `<AsTable>` — paginated

The renderer itself doesn't draw the pagination control — you pair it
with whatever UI you like, bound to `state.pagination`.

```vue
<AsTableRoot url="/db/tables/products" :limit="10" v-slot="slot">
  <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
  <TablePagination mode="pagination" />
</AsTableRoot>
```

`state.pagination` is a `Ref<PaginationControl>`:

```typescript
interface PaginationControl {
  page: number; // 1-based
  itemsPerPage: number;
}
```

Writing to it triggers the root watcher; a new query fires
automatically. Filter / sort / search changes reset
`state.pagination.page` back to 1 (debounced ~500ms for filters so the
user can type freely before the page reset costs them a re-fetch).

::: details Build your own pagination
A `TablePagination.vue` that wraps Reka UI's `PaginationRoot` +
page-size selector is a one-pager:

```vue
const currentPage = computed({ get: () => state.pagination.value.page, set: (page) => {
state.pagination.value = { ...state.pagination.value, page }; }, });
```

Use any pagination component; you only need to write to
`state.pagination.value`.
:::

The `<AsTable>` renderer accepts presentational props for the chrome:

- **`:select="multi"`** — render a leading checkbox column. The full
  multi-select wire (`Space`, `Shift+click`, `select all` from
  `<AsTableActions>`) is automatic.
- **`:rowActionsColumn="first" | "last" | "merge-select"`** — synthesise
  a locked `__actions` pseudo-column from `state.actions.row`. See
  [Actions & Selection](/tables/actions).
- **`:columnMenu="{ sort, filters, hide, resetWidth }"`** — toggle each
  entry of the header dropdown.
- **`:reorderable`** / **`:resizable`** — column drag and resize. Default
  `true`.
- **`:rowDelete`** — opt into the synthesised `__remove` action. Only
  surfaces when `tableDef.canRemove === true`.

## `<AsWindowTable>` — virtualised

Same root, different renderer. A windowed table view typically looks
like this:

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

const controls = createDefaultControls();
const types = createDefaultCellTypes();
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/products"
      :controls="controls"
      :types="types"
      :limit="5000"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
    >
      <TableToolbar
        title="Virtual Scroll — 5,000 Products"
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsTable sticky-header :virtual-row-height="36" :virtual-overscan="10" />
        <div v-if="loadingMetadata" class="table-loading-overlay" />
      </div>
    </AsTableRoot>
  </div>
</template>
```

Notice the example uses `<AsTable>` with `:virtual-row-height` set —
that's the `<AsTable>` path doing TanStack-Vue-Virtual rendering when a
row height is provided. For the dedicated windowed renderer with
block-aligned scroll-driven fetches, use `<AsWindowTable>`:

```vue
<AsTableRoot url="/db/tables/big_logs" :limit="200" :block-size="200">
  <AsWindowTable :row-height="32" :min-rows="20" />
</AsTableRoot>
```

### How fetching works

`<AsWindowTable>` watches its viewport top and row count. When either
changes (after a debounce — `dragReleaseDebounceMs`, default 300ms),
the state computes the set of block-aligned slices needed to cover the
visible range and calls `state.loadRange(skip, limit)`:

- Blocks are aligned to multiples of `blockSize` (default `:limit`).
- Rows land in `state.windowCache: Map<absIdx, row>`.
- Block fetches in flight populate `state.windowLoading` — the per-row
  skeleton uses this for placeholder rendering.
- Successive viewport changes that already have cached rows DON'T
  refetch; the cache is the single source of truth until
  `state.invalidate()` is called.

`state.results` and `state.windowCache` share row references — when a
forward / backward scroll reveals contiguous already-loaded rows, the
state merges them into `results` so existing UI bindings stay stable.

### Tunables on `<AsWindowTable>`

| Prop              | Default                      | Purpose                                                                         |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `:row-height`     | `DEFAULT_ROW_HEIGHT_PX` (32) | Fixed row height in pixels. Virtual scroll requires this.                       |
| `:rows`           | undefined                    | Force exactly N rows of height (overrides min/max).                             |
| `:min-rows`       | undefined                    | Floor; useful for value-help dialogs that should never collapse.                |
| `:max-rows`       | undefined                    | Cap; useful for embedded tables on dashboard cards.                             |
| `:select="multi"` | `"none"`                     | Multi-select checkbox column.                                                   |
| `:row-delete`     | `false`                      | Synthesised `__remove` action.                                                  |
| `:column-menu`    | (full set)                   | Column-menu entries.                                                            |
| `:enter-action`   | `"main-action"`              | `"toggle-select"` for value-help tables where Enter shouldn't fire main action. |

### Tunables on `<AsTableRoot>` for windowed mode

| Prop                        | Default | Purpose                                                                                    |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `:limit`                    | 25      | Default page size + block size for `loadRange`.                                            |
| `:block-size`               | 100     | Override the page-alignment unit independently of `:limit`.                                |
| `:drag-release-debounce-ms` | 300     | How long the viewport watcher waits after the user stops scrolling before issuing fetches. |

## State changes that invalidate

Both renderers share one rule: any change that affects the result set
re-queries from page 1 (paginated mode) or invalidates the window cache
and re-fetches the visible range (windowed mode):

- `state.filters` / `state.filterFields` (filter-change watcher,
  debounced 500ms).
- `state.sorters`.
- `state.searchTerm`.
- `state.columnNames` only when the underlying projection (`$select`)
  changes.

`state.pagination.itemsPerPage` change resets to page 1 as well.

`state.mustRefresh` flips to `true` when a state mutation lands while a
query is in flight — surfaces a "results are stale, refresh to apply"
indicator in toolbars. The next watcher tick will fire the refetch
automatically; the flag is there for UI.

## Manual refresh

`state.query()` is reserved for user-initiated refresh. Wire it to a
toolbar button or pull-to-refresh gesture:

```vue
<button :disabled="state.querying.value" @click="state.query">Refresh</button>
```

It's the contract for the table state machine: programmatic changes
(filters, sorters, pagination, column changes) re-fetch automatically
through internal watchers — you don't call `state.query()` to apply
them. If you find yourself reaching for it after a mutation, the
watcher is what you actually want.

## Next steps

- [URL State](/tables/url-state) — pagination is included in the URL
  bridge by default; you can opt it out per-aspect.
- [Actions & Selection](/tables/actions) — `state.selectedRows`
  survives a `selectionPersistence` policy across re-queries.
- [Cells](/tables/cells) — per-cell render cost is the main driver of
  windowed-mode performance; the defaults are tuned to be cheap.
