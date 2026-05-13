Sort model, pagination vs virtualization, window-mode tuning.

## Contents

- [Sort model](#sort-model)
- [Header click semantics](#header-click-semantics)
- [mergeSorters](#mergesorters)
- [AsTableHeaderCell](#astableheadercell)
- [AsConfigDialog sorters tab](#asconfigdialog-sorters-tab)
- [v-model:sorters](#v-modelsorters)
- [Paginated mode AsTable](#paginated-mode-astable)
- [Virtualized mode AsWindowTable](#virtualized-mode-aswindowtable)
- [windowCache + island contract](#windowcache--island-contract)
- [Invalidation](#invalidation)
- [When to pick paginated vs window](#when-to-pick-paginated-vs-window)

## Sort model

```typescript
export interface SortControl {
  field: string;
  direction: "asc" | "desc";
}

state.sorters: ShallowRef<SortControl[]>;
```

Multi-sort. Earlier entries win for equal keys; later entries break ties. The array is mapped to `$sort: { [field]: 1 | -1 }` by `buildTableQuery` (`packages/ui-table/src/query/build-table-query.ts:48-52`), so order is preserved per JS dict insertion order across V8 / WebKit / Firefox.

The watcher uses `sortersEqual(prev, next)` for change detection — reassigning the same logical sorters is a no-op.

## Header click semantics

Built into `<AsTableHeaderCell>` via `useTableColumnHandlers` (`composables/use-table-column-handlers.ts`). Default click cycle on a sortable column:

| Current state | Plain click    | Shift-click          |
| ------------- | -------------- | -------------------- |
| no entry      | append `asc`   | append `asc` (multi) |
| `asc`         | flip to `desc` | flip in place        |
| `desc`        | remove entry   | remove entry         |

Plain click without shift **clears** other sorters before applying — single-column sort. Shift-click preserves the existing chain and appends / mutates the entry for that column.

Override via the column menu's "Sort ascending" / "Sort descending" items (`columnMenu.sort: true` on `<AsTable>` / `<AsWindowTable>`).

## mergeSorters

```typescript
import { mergeSorters } from "@atscript/ui-table";

mergeSorters(forceSorters, userSorters);
```

`packages/ui-table/src/query/merge-sorters.ts:9-19`:

- Force sorters come first.
- User sorters whose `field` collides with a force sorter are dropped (force always wins).
- Empty force list → user sorters untouched.

Force sorters are typically a tenancy or createdAt tiebreaker so paged queries are stable. The user can't remove them; `state.sorters` only holds the user's chain.

## AsTableHeaderCell

`packages/vue-table/src/components/defaults/as-table-header-cell.vue`. Renders one `<th>` with label, sort indicator, and column menu trigger. Override via `controls.headerCell`.

| Prop / slot  | Notes                                                           |
| ------------ | --------------------------------------------------------------- |
| `column`     | `ColumnDef`                                                     |
| `direction`  | Current sort direction for this column, or `undefined`.         |
| `multiIndex` | Index in the multi-sort chain (or `-1` if single / not sorted). |
| `columnMenu` | `ColumnMenuConfig` — which menu sections to expose.             |
| `selectAll`  | Tri-state checkbox state for the leading multi-select column.   |

## AsConfigDialog sorters tab

`<AsConfigDialog>` (`components/defaults/as-config-dialog.vue`) has three tabs (see [state-persistence.md](state-persistence.md)). The **Sorters** tab uses `<AsSortersConfig>` (Tier-3) internally:

- Add a sorter: pick field + direction from the dropdown.
- Reorder: drag-drop the rows (orderable list).
- Remove: click the delete glyph per row.
- Clear all: bulk remove.

Apply commits the array via `state.sorters.value = next`; the watcher re-fetches.

Open programmatically:

```typescript
state.showConfigDialog("sorters");
```

## v-model:sorters

`<AsTableRoot v-model:sorters>` exposes the sorters array externally. Identity is preserved — the framework reads from and writes to your ref.

```vue
<script setup>
const sorters = ref<SortControl[]>([{ field: "createdAt", direction: "desc" }]);
</script>

<template>
  <AsTableRoot v-model:sorters="sorters" url="..." />
</template>
```

Same applies to `filterFields`, `columnNames`, `columnWidths`, `selectedRows`.

## Paginated mode AsTable

`packages/vue-table/src/components/as-table.vue`. Renders an HTML `<table>` with a fixed set of rows per `state.results`.

| Prop               | Default               | Notes                                                                                |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `rows`             | `state.results.value` | Override input rows (rare).                                                          |
| `columns`          | `state.columns.value` | Override visible columns (rare).                                                     |
| `stickyHeader`     | `true`                | `<thead>` sticky on scroll.                                                          |
| `select`           | `"none"`              | `"none" \| "single" \| "multi"`. Multi adds leading checkbox column.                 |
| `rowDelete`        | `false`               | `true \| RowDeleteOpt` — opt in to the synthesized `__remove` row action.            |
| `rowActionsColumn` | `false`               | `"first" \| "last" \| "merge-select"` — synthesized actions pseudo-column placement. |
| `columnMenu`       | —                     | `ColumnMenuConfig` `{ sort?, filters?, hide?, resetWidth? }`.                        |
| `reorderable`      | `true`                | Header drag-and-drop reorder.                                                        |
| `resizable`        | `true`                | Header drag-resize.                                                                  |
| `columnMinWidth`   | `48`                  | Pixel floor for the resize clamp.                                                    |
| `virtualRowHeight` | —                     | Optional row-height hint for the internal tanstack virtualizer (DOM virtualization). |
| `virtualOverscan`  | `5`                   | Rows rendered above/below the viewport.                                              |

Pagination is **always read from `state.pagination`** (`{ page, itemsPerPage }`). The default `<AsTableRoot>` does NOT ship pagination chrome — render your own page selector (or use a Tier-2 toolbar component if you build one) that mutates `state.pagination.value = { page: nextPage, itemsPerPage }`. The watcher reacts and refetches automatically.

Emits:

| Event          | Args                     | When                                                |
| -------------- | ------------------------ | --------------------------------------------------- |
| `row-click`    | `(row, event)`           | Single-click on a body row (modulo selection mode). |
| `row-dblclick` | `(row, event)`           | Double-click — typically the default main action.   |
| `main-action`  | `(row, absIndex, event)` | Enter / programmatic main-action trigger.           |

## Virtualized mode AsWindowTable

`packages/vue-table/src/components/as-window-table.vue`. Same prop shape as `<AsTable>` plus window controls:

| Prop                  | Default                 | Notes                                                                                     |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `rowHeight`           | `DEFAULT_ROW_HEIGHT_PX` | Fixed-height row (window mode uses fixed-height for predictable scroll math).             |
| `wheelRowsPerTick`    | `1`                     | Native `deltaY` is already quantized; usually leave at 1.                                 |
| `rows`                | —                       | Force exactly N rows tall (overrides `minRows` and `maxRows`).                            |
| `minRows` / `maxRows` | —                       | Bounds on the auto-sized row count.                                                       |
| `enterAction`         | `"main-action"`         | `"main-action" \| "toggle-select" \| "passthrough"` — what Enter does for the active row. |

Plus the shared props above (`select`, `rowDelete`, `columnMenu`, `reorderable`, `resizable`, `columnMinWidth`).

Pagination is replaced by **block-aligned fetching**:

1. Scroll updates `state.topIndex` and `state.viewportRowCount`.
2. A debounced watcher (interval = `dragReleaseDebounceMs`, default 300ms) computes the blocks intersecting the viewport via `pageAlignedBlocksFor(topIndex, viewportRowCount, blockSize)`.
3. Blocks not in `windowCache` and not in `windowLoading` are fetched via `loadRange(skip, limit)`.
4. Each `loadRange` issues `client.pages(query, blockPage, blockSize)` and merges into `windowCache` by absolute index.

Block size defaults to `100` and is tunable per `<AsTableRoot :block-size>`.

Tunables for `<AsTableRoot>` in window-mode tables:

| Prop                    | Default | Effect                                                                                                                                     |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `blockSize`             | `100`   | Block alignment unit. Larger = fewer fetches but bigger payloads.                                                                          |
| `dragReleaseDebounceMs` | `300`   | How long to wait after scroll velocity settles before issuing fetches. Lower = snappier; higher = fewer wasted fetches during fast scroll. |
| `limit`                 | `25`    | Reserved for `<AsTable>`. In window mode the initial fetch uses `blockSize` instead.                                                       |

Emits — same as `<AsTable>` plus:

| Event   | Args                                   | When                                                                                                 |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `error` | `(error: Error, kind: QueryErrorKind)` | Initial / refresh / `loadRange` / `queryNext` failure. One emit per new error via `state.lastError`. |

## windowCache + island contract

| Field           | Type                           | Role                                                                                |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `windowCache`   | `ShallowRef<Map<number, Row>>` | Universal cache keyed by absolute index. Populated by `runQuery` and `loadRange`.   |
| `windowLoading` | `ShallowRef<Set<number>>`      | Block firstIndex values currently in flight.                                        |
| `results`       | `ShallowRef<Row[]>`            | Contiguous "island" the consumer is currently rendering (for the `AsTable` branch). |
| `resultsStart`  | `Ref<number>`                  | Absolute offset of `results[0]`.                                                    |

Window-mode renderers read rows via `state.dataAt(absIndex)` / `state.loadingAt(absIndex)` / `state.errorAt(absIndex)`. The paginated `<AsTable>` reads `state.results.value` directly.

`results` and `windowCache` are kept in sync by `runQuery`: a fresh fetch replaces `results`, clears `windowCache`, and re-seeds it with the new page contents. `loadRange` only mutates `windowCache` (the "island" stays anchored).

## Invalidation

```typescript
state.invalidate();
```

Bumps `generation` (in-flight responses for the old gen are discarded), drops `results = []`, calls `resetWindow()` (clear `windowCache` / `windowLoading` / `errors`), recomputes `resultsStart` from the current page.

Does NOT refire the query. Pair with `state.query()` if you want to immediately re-fetch:

```typescript
state.invalidate();
state.query();
```

Use cases:

- After a mutation outside the action loop (manual `fetch` then re-render).
- After switching between two query feeds without remounting the table.
- After receiving a server push that says "your dataset changed".

## When to pick paginated vs window

| Dataset size          | Use               | Why                                                                                            |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| < 1k rows             | `<AsTable>`       | Pagination chrome is more discoverable; window mode wastes setup.                              |
| 1k–10k rows           | either            | Window mode if users frequently scroll long stretches; pagination if jumps are by page number. |
| 10k+ rows             | `<AsWindowTable>` | Pagination chrome breaks down for hundreds of pages; window absorbs unbounded sets.            |
| Read-many, write-rare | `<AsWindowTable>` | Cache reuse is bigger; refetch on mutation is rare.                                            |
| Frequent mutations    | `<AsTable>`       | `refreshOnAction` reloads the current page; window mode pays a bigger reload cost.             |

Both modes share filter / sort / search / preset / URL plumbing — switching modes is a one-line component swap, not a state migration.
