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

Multi-sort. Earlier entries win for equal keys; later entries break ties. The array is mapped to `$sort: { [field]: 1 | -1 }` by `buildTableQuery`, so order is preserved per JS dict insertion order across V8 / WebKit / Firefox.

The watcher uses `sortersEqual(prev, next)` for change detection — reassigning the same logical sorters is a no-op.

## Header click semantics

Built into `<AsTableHeaderCell>` via `useTableColumnHandlers`. Default click cycle on a sortable column:

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

`mergeSorters` semantics:

- Force sorters come first.
- User sorters whose `field` collides with a force sorter are dropped (force always wins).
- Empty force list → user sorters untouched.

Force sorters are typically a tenancy or createdAt tiebreaker so paged queries are stable. The user can't remove them; `state.sorters` only holds the user's chain.

## AsTableHeaderCell

Renders one `<th>` with label, sort indicator, and column menu trigger. Override via `controls.headerCell`.

| Prop / slot  | Notes                                                           |
| ------------ | --------------------------------------------------------------- |
| `column`     | `ColumnDef`                                                     |
| `direction`  | Current sort direction for this column, or `undefined`.         |
| `multiIndex` | Index in the multi-sort chain (or `-1` if single / not sorted). |
| `columnMenu` | `ColumnMenuConfig` — which menu sections to expose.             |
| `selectAll`  | Tri-state checkbox state for the leading multi-select column.   |

## AsConfigDialog sorters tab

`<AsConfigDialog>` has three tabs (see [state-persistence.md](state-persistence.md)). The **Sorters** tab uses `<AsSortersConfig>` internally:

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

Renders an HTML `<table>` with a fixed set of rows per `state.results`.

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

Same prop shape as `<AsTable>` plus window controls:

| Prop                  | Default                 | Notes                                                                                     |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `rowHeight`           | `DEFAULT_ROW_HEIGHT_PX` | Fixed-height row (window mode uses fixed-height for predictable scroll math).             |
| `wheelRowsPerTick`    | `1`                     | Native `deltaY` is already quantized; usually leave at 1.                                 |
| `rows`                | —                       | Force exactly N rows tall (overrides `minRows` and `maxRows`).                            |
| `minRows` / `maxRows` | —                       | Bounds on the auto-sized row count.                                                       |
| `enterAction`         | `"main-action"`         | `"main-action" \| "toggle-select" \| "passthrough"` — what Enter does for the active row. |

Plus the shared props above (`select`, `rowDelete`, `columnMenu`, `reorderable`, `resizable`, `columnMinWidth`).

Pagination is replaced by **block-aligned fetching**: the table fetches fixed-size blocks (default 100 rows) as the viewport scrolls into them and caches them keyed by absolute index. You don't drive this directly — `<AsWindowTable>` reads rows via `state.dataAt(absIndex)` / `state.loadingAt(absIndex)` / `state.errorAt(absIndex)` (see [query.md](query.md)). Tune the fetch behavior via the props below.

Tunables for `<AsTableRoot>` in window-mode tables:

| Prop                    | Default | Effect                                                                                                                                     |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `blockSize`             | `100`   | Block alignment unit. Larger = fewer fetches but bigger payloads.                                                                          |
| `dragReleaseDebounceMs` | `300`   | How long to wait after scroll velocity settles before issuing fetches. Lower = snappier; higher = fewer wasted fetches during fast scroll. |
| `limit`                 | `25`    | Reserved for `<AsTable>`. In window mode the initial fetch uses `blockSize` instead.                                                       |

Emits — same as `<AsTable>` plus:

| Event   | Args                                   | When                                                                                            |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `error` | `(error: Error, kind: QueryErrorKind)` | Any data fetch failure (initial load, refresh, scroll-driven block fetch, or window extension). |

## Invalidation

```typescript
state.invalidate();
```

Clears the current results and window cache and discards any in-flight responses so they can't paint stale data. Does NOT refire the query — pair with `state.query()` if you want to immediately re-fetch:

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
