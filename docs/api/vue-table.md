# @atscript/vue-table

Vue 3 smart table powered by `@atscript/ui` + `@atscript/ui-table`. Tier-1 primary components (`AsTableRoot`, `AsTable`, `AsWindowTable`, `AsFilters`, `AsPresetPicker`, `AsTableActions`) are tagged in templates; Tier-2 defaults (cells, dialogs, header cells, filter UI) are swapped via the `controls` / `types` / `components` prop maps. A single `useTable()` call returns a `ReactiveTableState` that every Vue piece subscribes to.

## Contents

- [Tier 1 — Primary components](#tier-1-primary-components)
- [Tier 2 — Cells](#tier-2-cells)
- [Tier 2 — Dialogs](#tier-2-dialogs)
- [Tier 2 — Filter UI](#tier-2-filter-ui)
- [Tier 2 — Headers & rows](#tier-2-headers-rows)
- [Composables — table root](#composables-table-root)
- [Composables — state contracts](#composables-state-contracts)
- [Composables — features](#composables-features)
- [Composables — presets](#composables-presets)
- [Factories](#factories)
- [Types](#types)
- [Utilities](#utilities)

## Tier 1 — Primary components

### `AsTableRoot`

Sets up `useTable()` once, provides the context, and renders the table chrome. Most apps tag this at the page level.

**Props** (excerpt — see [`UseTableOptions`](#composables-table-root) for the full reactive surface):

```typescript
interface AsTableRootProps {
  /** Required unless `rows` is given (local mode). */
  url?: string;
  /** Local mode: render this array instead of fetching. Reactive — replacing it re-queries locally. Since 0.1.134. See [Local rows](/tables/query-function#path-c-local-rows). */
  rows?: Record<string, unknown>[];
  /** Local mode: the columns to render, read once at setup. Since 0.1.134. */
  columns?: ColumnDef[];
  /** Local mode: field paths the search term matches (substring, case-insensitive). Since 0.1.134. */
  searchPaths?: string[];
  /** Local mode: sort in memory from the active sorters. Default `true`. Since 0.1.134. */
  localSort?: boolean;
  /** Client-owned columns merged into the server's column list — never in `$select`, server sort or filters. Since 0.1.134. See [Display-only columns](/tables/customization#display-only-columns). */
  displayColumns?: DisplayColumnDef[];
  /** Per-screen row-action policy: `include` / `exclude` / `overrides` / `extra`. The server's per-row `$actions` gate still wins. Since 0.1.134. See [Selecting and extending row actions](/tables/actions#selecting-and-extending-row-actions). */
  rowActions?: RowActionsConfig;
  limit?: number;
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  selectionPersistence?: "clear" | "trim" | "persist";
  forceFilters?: FilterExpr;
  forceSorters?: SortControl[];
  /** Opt in to suppressing user sorters while a search is active, to preserve relevance ranking. Default `false`. Also a `v-model`. See [Sorting](/tables/sorting#search-relevance-sort-suppression). */
  ignoreSortersWhenSearched?: boolean;
  /** Leaf paths always added to `$select`, regardless of visible columns — for renderless cell renderers. */
  alwaysSelected?: string[];
  queryFn?: (
    query: Uniquery,
    page: number,
    size: number,
  ) => Promise<PageResult<Record<string, unknown>>>;
  queryOnMount?: boolean;
  /**
   * Suppress every query trigger (`query` / `queryNext` / `loadRange`). The
   * prop stays a plain boolean, but `AsTableRoot` forwards it to `useTable`
   * as a getter, so it is reactive (since 0.1.133): a table mounted while
   * blocked starts fetching the moment the flag clears, and an
   * already-queried table replays one query for whatever state changed while
   * it was blocked.
   */
  blockQuery?: boolean;
  blockSize?: number;
  dragReleaseDebounceMs?: number;
  clientFactory?: ClientFactory;
  controls?: TAsTableControls;
  types?: TAsCellTypeComponents;
  components?: Record<string, Component>;
  formTypes?: TAsTypeComponents;
  formComponents?: Record<string, Component>;
  preset?: PresetConfig;
  refreshOnAction?: boolean;
  /** Base-path href mapping for navigate-action anchors (also a `useTable` option). Applied only to the `href` attribute / new-tab target, never to the invoke path. Default: identity. See [Navigate actions](/tables/actions#navigate-actions). */
  resolveHref?: (url: string) => string;
  urlQuerySync?: UrlQuerySync;
}
```

**v-models**: `urlQuery` (string), `filterFields` (string[]), `columnNames` (string[]), `columnWidths` (ColumnWidthsMap), `sorters` (SortControl[]), `selectedRows` (unknown[]), `ignoreSortersWhenSearched` (boolean).

**Emits**: `action(action, ids, result, event?)`, `main-action(row, absIndex, event)`.

**Slot props** (default slot, bound from `state`): `tableDef`, `loadingMetadata`, `metadataError`, `allColumns`, `columnNames`, `columnWidths`, `columns`, `filterFields`, `filters`, `sorters`, `results`, `querying`, `queryingNext`, `totalCount`, `loadedCount`, `pagination`, `queryError`, `mustRefresh`, `searchTerm`, `selectedRows`, `selectedCount`, `navBridge`, `query`, `queryNext`, `resetFilters`, `showConfigDialog`, `openFilterDialog`, `closeFilterDialog`, `setFieldFilter`, `removeFieldFilter`, `addFilterField`, `removeFilterField`, `actions`, `prompt`.

### `AsTable`

Paginated table renderer. Subscribes to `useTableContext()`. Use inside `<AsTableRoot>` or supply your own context.

```typescript
interface AsTableProps {
  rows?: Record<string, unknown>[];
  columns?: ColumnDef[];
  stickyHeader?: boolean;
  virtualRowHeight?: number;
  virtualOverscan?: number;
  columnMenu?: ColumnMenuConfig;
  reorderable?: boolean;
  resizable?: boolean;
  columnMinWidth?: number;
  /**
   * Render without a header row — omits `<thead>` entirely (not
   * `display:none`). Column widths are carried by a `<colgroup>`, so data
   * columns keep their `@ui.table.width` / seeded widths without a header.
   * Header-driven interactions (sort/filter/reorder/resize) are unavailable.
   * Not to be confused with a *renderless* table (drop `<AsTable>` and build
   * your own UI from `<AsTableRoot>` state).
   */
  headless?: boolean;
  /** Selection mode: "none" | "single" | "multi". */
  select?: SelectionMode;
  /** Row-delete opt-in. */
  rowDelete?: boolean | RowDeleteOpt;
  /**
   * Synthesised row-actions pseudo-column. `'first'` / `'last'` prepend or
   * append a fixed `__actions` column; `'merge-select'` only renders when
   * `select === 'none'` so the row gutter shares space with the multi-select
   * checkbox column. `false` (default) hides the column entirely.
   */
  rowActionsColumn?: "first" | "last" | "merge-select" | false;
  /**
   * Per-row selectability (since 0.1.133). Return `false` — or a string,
   * surfaced as the disabled reason on the row's selection control — to make
   * a row not selectable. Enforced on every path: row click, Space/Enter
   * toggle, and the header select-all, which also stops counting ineligible
   * rows. Example:
   * `:row-selectable="(row) => (row.locked ? 'Locked by another user' : true)"`.
   */
  rowSelectable?: RowSelectableHook;
  /**
   * Extra classes for the row element (since 0.1.133) — string, array, or
   * `{ class: boolean }` map, merged with the framework's own row classes.
   */
  rowClass?: RowClassHook;
  /**
   * Extra attributes for the row element (since 0.1.133). The framework's own
   * `id`, `role`, `aria-*`, `data-*`, `class` and `style` always win, so a
   * hook can decorate a row but never rewrite its accessibility contract.
   */
  rowAttrs?: RowAttrsHook;
}
```

The three hooks are typed under [Row hooks](#row-hooks). `AsWindowTable` accepts the same three props; the gate lives in the selection model (`state.rowSelectable` / `isRowSelectable` / `selectAll`), so click, keyboard, select-all and the header tri-state all share it.

**Emits**: `row-click(row, event)`, `row-dblclick(row, event)`, `main-action(row, absIndex, event)`.

### `AsWindowTable`

Windowed (virtualized) renderer for million-row datasets. Uses `planFetch` / page-aligned blocks under the hood. Same props as `AsTable` plus `rowHeight?: number`.

### `AsFilters`

Renders the active-filters bar. Reads `state.filterFields` and `state.filters`, emits writes through the same refs.

```typescript
interface AsFiltersProps {
  /** Explicit field list; defaults to the displayed `state.filterFields`. */
  filterFields?: string[];
  /**
   * Hard cap on how many filter fields render inline (since 0.1.133).
   * Deterministic and count-based — the component never measures the toolbar,
   * so width-driven responsiveness stays with the host (feed a shorter
   * `filterFields` list, or a smaller `maxVisible`). Omitted (the default)
   * renders every field inline, exactly as before.
   */
  maxVisible?: number;
  /**
   * What happens to the fields past `maxVisible` (since 0.1.133). Ignored
   * when `maxVisible` is omitted.
   *
   * - `'popover'` (the default whenever `maxVisible` is set) — they move into
   *   a popover behind a "More filters" trigger, badged with the number of
   *   ACTIVE hidden filters so nothing silently narrows the table from
   *   off-screen.
   * - `'none'` — they are not rendered at all. Pick this only when the host
   *   surfaces them elsewhere (e.g. its own filter dialog); an active filter
   *   on a dropped field still applies to the query.
   */
  overflow?: "popover" | "none";
}
```

`$attrs` are still forwarded to every filter field: the component sets
`inheritAttrs: false` and renders a multi-root fragment (no wrapper element),
so the fields (and the overflow trigger beside them) stay direct children of
the host's filter row and no existing layout changed.

### `AsTableActions`

Toolbar action row. Reads `state.actions` and renders default/other actions per level. Slot-customizable.

### `AsPresetPicker`

Dropdown picker showing the active preset, the system presets, the user's saved presets, and the favorite row. Backed by `state.preset`.

## Tier 2 — Cells

Default cell renderers — all implement the standard cell-props contract (path, value, row, column, locale).

| Component          | Default cell type                          | Notes                                                     |
| ------------------ | ------------------------------------------ | --------------------------------------------------------- |
| `AsTableCellValue` | `text`, `number`, `boolean`, `enum`, `ref` | Generic value renderer with locale + value-help labels.   |
| `AsCellNumber`     | `number` (when used explicitly)            | Decimal-aware numeric cell.                               |
| `AsCellDate`       | `date`, `datetime`, `relative`             | Locale-aware date renderer.                               |
| `AsCellArray`      | `array`                                    | Pill chips for array values.                              |
| `AsCellJson`       | `object`                                   | Collapsible JSON renderer.                                |
| `AsCellUnion`      | unions                                     | Per-row dispatcher that renders the active union variant. |

Imports:

```typescript
import {
  AsTableCellValue,
  AsCellNumber,
  AsCellDate,
  AsCellArray,
  AsCellJson,
  AsCellUnion,
} from "@atscript/vue-table";
```

## Tier 2 — Dialogs

### `AsConfigDialog`

Tabbed config dialog (columns / filters / sorters). Open via `state.configDialogOpen = true`.

### `AsFilterDialog`

Per-column filter editor. Open via `state.filterDialogColumn = column`.

### `AsPresetDialog`

Manage saved presets — rename, delete, public toggle, favorite, default.

### `AsConfirmDialog`

Pure confirm dialog driven by `state.prompt(message, opts?)`. Replaces `window.confirm()`.

### `AsActionFormDialog`

Dialog for actions that declare an `@InputForm` schema. Opens via `state.requestActionInput(action, ctx)`. Pulls in the full `@atscript/vue-form` runtime, so it is **not** exported from the main entry — `<AsTableRoot>` lazy-mounts it only when an `@InputForm` action is detected. Import from the dedicated subpath when you need to override or eager-load:

```typescript
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";
```

## Tier 2 — Filter UI

### `AsFilterField`

Single column's filter row inside the filter dialog or active-filters bar.

### `AsFilterInput`

Input control for one condition — switches between text / number / date / boolean / ref based on column type.

## Tier 2 — Headers & rows

### `AsTableHeaderCell`

Default header cell — label, sort indicator, resize handle, column menu trigger.

### `AsColumnMenu`

Dropdown menu shown on header click — sort, filter, hide, reset width. Configurable via `ColumnMenuConfig`.

### `AsRowActions`

Per-row actions cell — single button or `…` dropdown.

## Composables — table root

### `useTable(url, opts?)`

Main entry point. Resolves table metadata, builds the `TableDef`, wires presets/drafts/selection, and returns the reactive state.

```typescript
function useTable(url: string, opts?: UseTableOptions): ReactiveTableState;
```

**`UseTableOptions`** (key fields):

```typescript
interface UseTableOptions {
  limit?: number;
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  selectionPersistence?: "clear" | "trim" | "persist";
  filterFields?: Ref<string[]>;
  columnNames?: Ref<string[]>;
  columnWidths?: Ref<ColumnWidthsMap>;
  sorters?: Ref<SortControl[]>;
  selectedRows?: Ref<unknown[]>;
  forceFilters?: FilterExpr;
  forceSorters?: SortControl[];
  /** Suppress user sorters while searching (preserve relevance). `boolean` = configured default; `Ref<boolean>` = external model whose initial value is the default. Default `false`. */
  ignoreSortersWhenSearched?: boolean | Ref<boolean>;
  /** Leaf paths always added to `$select`, regardless of visible columns — see [Custom Cells](/tables/custom-cells). */
  alwaysSelected?: string[];
  queryFn?: QueryFn;
  queryOnMount?: boolean;
  /** When true, all triggers (query/queryNext/loadRange) early-return. Pass a getter (or a ref) to keep it reactive — the held-back query runs once when it flips back to `false` (since 0.1.133). */
  blockQuery?: boolean | (() => boolean);
  blockSize?: number;
  dragReleaseDebounceMs?: number;
  clientFactory?: ClientFactory;
  controls?: TAsTableControls;
  types?: TAsCellTypeComponents;
  components?: Record<string, Component>;
  formTypes?: TAsTypeComponents;
  formComponents?: Record<string, Component>;
  provideContext?: boolean;
  refreshOnAction?: () => boolean;
  onActionResolved?: (action, ids, result, event?) => void;
  urlQueryReady?: Ref<boolean>;
  onUrlQueryChange?: (urlString: string) => void;
  urlQuerySync?: UrlQuerySync;
  preset?: PresetConfig;
}
```

### `clearTableCache()`

Drops the shared `/meta` cache. Use after auth changes that invalidate server metadata.

## Composables — state contracts

### `useTableContext()` / `useTableContextOptional()`

Inject the context provided by `AsTableRoot` (or `provideTableContext`).

```typescript
interface TableContext {
  state: ReactiveTableState;
  client: Client;
  controls: TAsTableControls;
  types?: TAsCellTypeComponents;
  components?: Record<string, Component>;
  formTypes?: TAsTypeComponents;
  formComponents?: Record<string, Component>;
}

function useTableContext(): TableContext;
function useTableContextOptional(): TableContext | undefined;
```

### `createTableState(opts)`

Lower-level factory used by `useTable`. Returns `{ state, internals }`. Reach for this when building a custom root (e.g. a multi-table dashboard).

```typescript
function createTableState(opts: CreateTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
};
```

### `createStaticTableState(opts)`

Builds a `ReactiveTableState` for static / in-memory data (no server, no `/meta`). Useful for stubs, demos, and unit tests. `<AsTableRoot :rows>` uses it for [local mode](/tables/query-function#path-c-local-rows).

```typescript
function createStaticTableState(opts: CreateStaticTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
};

interface CreateStaticTableStateOptions {
  /** The rows. A getter or ref keeps it reactive — each local fetch re-reads it. Since 0.1.134. */
  rows: MaybeRefOrGetter<Record<string, unknown>[]>;
  columns: ColumnDef[];
  searchPaths?: string[];
  selection?: TableSelectionOptions;
  limit?: number;
  /** Sort in memory from the active sorters. Default `true`. Since 0.1.134. */
  localSort?: boolean;
  /** Client-owned columns merged into `columns`. Since 0.1.134. */
  displayColumns?: readonly DisplayColumnDef[];
  /** External refs from `defineModel`. Since 0.1.134. */
  model?: TableModelRefs;
  queryOnMount?: boolean;
  actions?: TableActionsOptions;
}
```

### `provideTableContext(ctx)`

Provide a `TableContext` to the subtree. Exported since 0.1.134 so a custom root can build any state — including `createStaticTableState` — and hand it to `<AsTable>` / `<AsWindowTable>`. Advanced: `<AsTableRoot>` already covers both the fetching and the local case.

```typescript
function provideTableContext(ctx: TableContext): void;
```

## Composables — features

### `useTableSelection(state, opts?)`

Wires the selection persistence policy onto an existing `state`. Called automatically by `useTable`; expose it for `createStaticTableState` consumers.

```typescript
type SelectionPersistence = "clear" | "trim" | "persist";

function useTableSelection(state: ReactiveTableState, opts?: { mode?: SelectionPersistence }): void;
```

### `useTableNavBridge()`

Returns the keyboard nav bridge for binding external inputs (custom search box, command palette).

```typescript
function useTableNavBridge(): TableNavBridge;

interface TableNavBridge {
  onKeydown: (event: KeyboardEvent, opts?: NavKeyOptions) => void;
  activeIndex: Ref<number>;
  setActive: (absIndex: number) => void;
  clearActive: () => void;
}
```

### `useTableFilter()`

Helpers for reading/writing the filter model from outside the dialog (toolbar chips, URL bridge, etc.).

### `useTableSearch()`

Search-term composable — reads/writes `state.searchTerm`, applies debouncing.

### `useTableActions()`

Returns `state.actions` (the full `TableActionsState`) from the closest `<AsTableRoot>` ancestor. Throws when called outside the provider tree.

```typescript
function useTableActions(): TableActionsState;
```

### `useTableUrlQuery(route, router, opts?)`

Bridge `<AsTableRoot v-model:url-query>` to vue-router. Uses type-only imports of `Router` / `RouteLocationNormalizedLoaded` — no runtime dependency on `vue-router` is added to `@atscript/vue-table`.

**Scope (since 0.1.133): the bridge owns only the keys it serializes.** It used
to replace `route.query` wholesale; now every write merges into the current
query. A key is table-owned iff the URL parser consumes it
(`urlQueryConsumesKey(key)` from `@atscript/ui-table`: the `$sort` / `$search` /
`$relevance` / `$skip` controls and operator-bearing filter keys) or the bridge
wrote it before; owned keys are replaced or removed, every other key is left
untouched, in place. Read and write agree: a key the parser ignores is never
deleted.

Without a `prefix` the bridge cannot tell a plain `field=value` filter from a
page-owned flag of the same shape, so a plain key that was already in the URL
when the bridge mounted counts as foreign until the bridge writes it itself.
Pass `prefix` when a route carries a host key that could collide with a column
path, or when it carries two tables.

```typescript
interface UseTableUrlQueryOptions {
  /** `"replace"` (default) or `"push"`. */
  mode?: "replace" | "push";
  /**
   * Namespace for this table's query keys (since 0.1.133). With
   * `prefix: "t1"` every key the bridge writes becomes `t1.<key>`
   * (`t1.$skip`, `t1.status`, `t1.total>100`), and only keys under that
   * prefix are read back or removed — keys with no prefix, or another
   * table's prefix, are foreign and preserved untouched.
   */
  prefix?: string;
}

function useTableUrlQuery(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  opts?: UseTableUrlQueryOptions,
): WritableComputedRef<string>;
```

```vue
<script setup>
import { useRoute, useRouter } from "vue-router";
import { useTableUrlQuery } from "@atscript/vue-table";
const urlQuery = useTableUrlQuery(useRoute(), useRouter());
// Two tables on one route:
// const left = useTableUrlQuery(useRoute(), useRouter(), { prefix: "a" });
// const right = useTableUrlQuery(useRoute(), useRouter(), { prefix: "b" });
</script>
<template>
  <AsTableRoot v-model:url-query="urlQuery" url="/db/products" />
</template>
```

### `useTableExport(ctx?)`

Export the table's data as it is queried right now — same filters, sorters, search and visible column order, paged over every matching row. Since 0.1.134. Full guide: [Export](/tables/export).

```typescript
function useTableExport(ctx?: TableContext): {
  /** Rejects when a run is already in flight — one handle runs one export. */
  exportRows: (opts?: ExportRowsOptions) => Promise<ExportResult>;
  /** `true` while a run is in flight (derived from `progress`). */
  exporting: ComputedRef<boolean>;
  /** Progress of the in-flight run, `null` while idle. */
  progress: Ref<{ done: number; total?: number } | null>;
};

interface ExportRowsOptions {
  /**
   * `"visible"` (default) — the visible columns minus the client-owned ones,
   * unless a `formatters` entry fills them — or an explicit list of column
   * paths, in export order.
   */
  columns?: "visible" | string[];
  /** `"csv"` (default) → `{ csv, filename }`; `"rows"` → `{ rows }`. */
  format?: "csv" | "rows";
  /** Rows per request. Default 500. */
  pageSize?: number;
  /** Aborts between pages; the promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  onProgress?: (done: number, total?: number) => void;
  /** Global cell formatter; `undefined` falls through to the default. */
  formatCell?: ExportCellFormatter;
  /** Per-column formatters keyed by column path. Win over `formatCell`. */
  formatters?: Record<string, ExportCellFormatter>;
  /** `.csv` appended when missing. Default `"export.csv"`. */
  filename?: string;
  /** CSV writer settings — `bom`, `escapeFormulas`, `delimiter`. Ignored by `format: "rows"`. */
  csv?: CsvOptions;
  maxRows?: number;
}

type ExportResult =
  | {
      format: "csv";
      csv: string;
      filename: string;
      columns: string[];
      columnPaths: string[];
      rowCount: number;
      total?: number;
    }
  | {
      format: "rows";
      rows: ExportScalar[][];
      columns: string[];
      columnPaths: string[];
      rowCount: number;
      total?: number;
    };
```

The query is built by `state.buildQuery()` and run through `state.fetchPage()`, so a custom `:query-fn` is honoured. The primary key(s) are appended to `$sort` as a tiebreaker so paging can neither skip nor duplicate rows; `$actions` is never requested; client-owned display columns are stripped from `$select`.

### `downloadExport(result)`

Hand a finished CSV export to the browser as a file download. Returns `false` without doing anything when there is no DOM (SSR / worker), so it is safe to call unguarded. Throws on a `format: "rows"` result. Since 0.1.134.

```typescript
function downloadExport(result: ExportResult): boolean;
```

### `useTableComponent(key, fallback)`

Resolve a single chrome skin-slot from the injected `controls` map, falling back to the supplied component when the consumer left that entry unset. `key` is one of the `TAsTableControls` keys (`headerCell`, `columnMenu`, `filterDialog`, etc.) — this is for chrome, not cell-type dispatch.

```typescript
function useTableComponent<K extends keyof TAsTableControls>(
  key: K,
  fallback: Component,
): Component;
```

### `provideCellLocale(source)` / `useCellLocale()`

Locale source for date / number cells. The provider takes a `MaybeRefOrGetter` so apps can wire it to `useAppPrefs` or to a global store without re-providing. The consumer side returns computed `locale` (falls back to `navigator.language`, then `"en-US"`) and `timezone` (`undefined` lets `Intl` pick the browser TZ).

```typescript
interface CellLocale {
  language?: string;
  timezone?: string;
}

function provideCellLocale(source: MaybeRefOrGetter<CellLocale | undefined>): void;
function useCellLocale(): {
  locale: ComputedRef<string>;
  timezone: ComputedRef<string | undefined>;
};
```

## Composables — presets

### `usePresets(options)`

Manages preset rows, userConf, capabilities, and the apply/save plumbing. `useTable` instantiates this internally when `preset` is configured; expose it for advanced consumers.

```typescript
interface UsePresetsOptions {
  url: string;
  /** Defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  tableKey: string;
  clientFactory?: ClientFactory;
  systemPresets?: SystemPresetInput[];
  /** Auto-load on setup. Default `true`. */
  autoLoad?: boolean;
}

interface UsePresetsReturn {
  presets: ShallowRef<AsPresetEntryRow[]>;
  presetsById: ComputedRef<Map<string, AsPresetEntryRow>>;
  userConf: ShallowRef<AsPresetEntryRow | null>;
  capabilities: Ref<PresetCapabilities | null>;
  systemPresets: ComputedRef<SystemPreset[]>;
  systemPresetsById: ComputedRef<Map<string, SystemPreset>>;
  /** False when the initial load returned 401/403/404 — UI hides itself. */
  available: ComputedRef<boolean>;
  loading: Ref<boolean>;
  /** Last failure. Since 0.1.133 the mutators write here as well as rethrowing. */
  error: Ref<unknown>;
  currentUser: ComputedRef<string | null>;
  activePresetId: Ref<string | null>;
  activePreset: ComputedRef<ActivePresetView | null>;
  isOwned(id: string): boolean;
  reload(): Promise<void>;
  batch<T>(fn: () => Promise<T>): Promise<T>;
  savePreset(snapshot: PresetSnapshot): Promise<void>;
  savePresetAs(
    label: string,
    snapshot: PresetSnapshot,
    opts?: { public?: boolean },
  ): Promise<string>;
  renamePreset(id: string, label: string): Promise<void>;
  deletePreset(id: string): Promise<void>;
  togglePublic(id: string): Promise<void>;
  setDefault(id: string | null): Promise<void>;
  toggleFav(id: string): Promise<void>;
  setFavorites(ids: string[]): Promise<void>;
}
```

Every mutator rethrows on failure; `error` here is the **load** channel only.
Mutation failures are recorded on the wired `state.preset.lastError`
(since 0.1.133), so a UI that only needs to render the failure can watch that
ref instead of wrapping each call.

`apply` is not on `usePresets` — it lives on the wired `state.preset` surface (`PresetSurface`) and accepts a system id (`sys:*`), a stored row id, or a raw `PresetSnapshot`. Bypassing it and writing the underlying model arrays directly works too — the root watcher reacts either way.

### `useAppPrefs(options)`

Manages the `appConf` row (app-wide user prefs: appearance, density, locale). Calls with the same `(app, url)` share a single underlying instance — duplicate widgets make one `/query?type=appConf` request total. Cross-tab sync rides BroadcastChannel; in-window sync rides a `useEventBus`.

```typescript
interface UseAppPrefsOptions {
  /** App namespace; defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  /** Presets controller URL, e.g. `"/db/_presets"`. */
  url: string;
  clientFactory?: ClientFactory;
  /** Auto-load on setup. Default `true`. */
  autoLoad?: boolean;
  /** Cache most recent prefs in `localStorage` keyed by app. Default `true`. */
  cache?: boolean;
}

interface UseAppPrefsReturn {
  /** Reactive prefs. Always non-null; defaults to `{}` until first load resolves. */
  prefs: WritableComputedRef<AppConfData>;
  loading: Ref<boolean>;
  /** Last error, or `null`. Unavailable responses flip `available` instead. */
  error: Ref<unknown>;
  /** False on 401/403/404 from initial load — hide pref-bound controls. */
  available: ComputedRef<boolean>;
  reload(): Promise<void>;
  /** Optimistic shallow-merge save; rolls back on error. */
  save(patch: Partial<AppConfData>): Promise<void>;
  reset(): void;
}
```

### `useLocalDraft(options)`

localStorage overlay manager for table preset drafts. One overlay per `(app, scope, tableKey)`; switching presets clears it (the caller decides when to call `clear()`).

```typescript
interface UseLocalDraftOptions {
  app: string;
  tableKey: string;
  enabled: Ref<boolean> | boolean;
  availableAspects: readonly PresetAspect[];
  /**
   * Identity the draft is keyed under (since 0.1.133) — pass the signed-in
   * user's id so a shared browser never restores the previous user's draft.
   * Reactive: when it changes, reads and writes move to the new key and the
   * old scope's draft is neither read nor overwritten. Omitted (or
   * `undefined`) keeps the pre-0.1.133 unscoped key.
   */
  scope?: MaybeRefOrGetter<string | undefined>;
  debounceMs?: number;
  storage?: StorageLike | null;
}

interface UseLocalDraftReturn {
  /** Layer the persisted draft (if any) on top of `applied`. */
  hydrate(applied: PresetSnapshot): PresetSnapshot;
  /**
   * Wire a debounced watcher that mirrors persisted aspects to localStorage.
   * Returns the unwatch handle.
   */
  watchAndPersist(
    currentSnapshot: () => PresetSnapshot,
    activePresetSnapshot: () => PresetSnapshot,
  ): () => void;
  clear(): void;
  readDraft(): PresetDraft | null;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

### `injectPresetsApp(override?)` / `AS_PRESETS_APP`

```typescript
const AS_PRESETS_APP: InjectionKey<string>;
function injectPresetsApp(override?: string): string;
```

`AS_PRESETS_APP` lets a parent component declare the active "app" id (multi-app deployments). `injectPresetsApp(override)` returns the override when provided, else falls back to the injected value or `'default'`.

## Factories

### `createDefaultControls()`

Returns a fresh `TAsTableControls` map pre-filled with the seven always-on Tier-2 defaults: `headerCell`, `columnMenu`, `filterInput`, `filterDialog`, `filterField`, `configDialog`, `confirmDialog`. The other six slots are intentionally **not** seeded: `rowActions` already falls back to the `types` map's `__actions` entry and then the built-in `AsRowActions` (set `controls.rowActions` only to override explicitly — it wins over the `types` entry); `fieldsSelector`, `sortersConfig`, and `filterValueHelp` default to internal (unexported) components resolved at their mount sites; `presetDialog` is lazy-mounted on first open; and `actionFormDialog` is lazy-loaded so it only pulls in `@atscript/vue-form` when an `@InputForm` action is detected.

You rarely need this helper for `:controls` — every dispatch site falls back to its built-in internally, and passing defaults wholesale statically bundles (and eager-mounts) the lazy dialogs. Pass only the entries you replace:

```typescript
function createDefaultControls(): TAsTableControls;

const controls = {
  filterDialog: MyFilterDialog,
};
```

### `createDefaultCellTypes()`

Returns a pre-built `TAsCellTypeComponents` map with `AsTableCellValue` for every built-in type.

```typescript
function createDefaultCellTypes(): TAsCellTypeComponents;
```

## Types

### `TAsTableControls`

Skin-slot override map for table chrome. Set any subset — unset slots fall back to defaults.

```typescript
interface TAsTableControls {
  headerCell?: Component;
  columnMenu?: Component;
  rowActions?: Component;
  filterInput?: Component;
  filterDialog?: Component;
  filterField?: Component;
  filterValueHelp?: Component;
  configDialog?: Component;
  fieldsSelector?: Component;
  sortersConfig?: Component;
  confirmDialog?: Component;
  actionFormDialog?: Component;
  presetDialog?: Component;
}
```

### `TAsCellTypeComponents`

```typescript
type TAsCellTypeComponents = {
  text: Component;
  number: Component;
  boolean: Component;
  date: Component;
  datetime?: Component;
  relative?: Component;
  array: Component;
  object: Component;
  enum: Component;
  ref: Component;
  __actions?: Component;
} & Record<string, Component>;
```

### `ReactiveTableState`

The full reactive state object. See the canonical definition in `packages/vue-table/src/types.ts`; the main slots are:

- **Metadata**: `tableDef`, `loadingMetadata`, `metadataError`.
- **Columns**: `columns`, `allColumns`, `columnNames`, `columnWidths`.
- **Filters / sorters / search**: `filters`, `filterFields`, `sorters`, `searchTerm`, `ignoreSortersWhenSearched` (`Ref<boolean>` — suppress user sorters while searching; see [Sorting](/tables/sorting#search-relevance-sort-suppression)).
- **Results**: `results`, `windowCache`, `windowLoading`, `topIndex`, `viewportRowCount`, `totalCount`, `loadedCount`, `resultsStart`.
- **Pagination**: `pagination`.
- **Selection**: `selectedRows`, `selectedCount`, `rowValueFn`, `isPkSelected`; since 0.1.133 `rowSelectable` (renderer-pushed hook ref), `isRowSelectable(row, index)`, `selectableRows(rows)`, `selectableCount(rows)`, `selectAll(rows, indexOf?)` — pre-selected ineligible pks survive select-all and the header tri-state counts eligible rows only.
- **Active row / nav**: `activeIndex`, `navMode`, `navViewportRowCount`, `hasMainActionListener`, `rowId`, `getActiveRow`, `setActive`, `clearActive`, `toggleActiveSelection`, `requestMainAction`, `handleNavKey`, `registerMainActionListener`.

  `getActiveRow(): Record<string, unknown> | undefined` resolves the currently-active row — nav-mode-aware: page-relative into `results` for paginated `<AsTable>`, absolute via `windowCache` for `<AsWindowTable>`. Returns `undefined` when no row is active (`activeIndex < 0`). It is the single resolver shared by selection, the `@main-action` emit, and the `level="row"` toolbar.

- **Errors**: `queryError`, `lastError`, `mustRefresh`.
- **Dialog exit retention** (since 0.1.133): `confirmDisplay` / `actionFormDisplay` keep the last non-null request while the dialog animates out; `releaseConfirm()` / `releaseActionForm()` clear them (bound to the content's `after-leave`) and are no-ops when a new request was raised meanwhile.
- **Querying flags**: `querying`, `queryingNext`.
- **Actions namespace**: `actions: TableActionsState`.
- **Prompt / action-form**: `confirmRequest`, `prompt`, `acceptPrompt`, `dismissPrompt`, `actionFormRequest`, `requestActionInput`, `acceptActionForm`, `dismissActionForm`.
- **Presets namespace**: `preset: PresetSurface` — see [`PresetSurface`](#presetsurface).
- **Row-action policy** (since 0.1.134): `rowActions: Ref<RowActionsConfig | undefined>` — renderer-pushed by `<AsTableRoot :row-actions>` — and `rowActionsPolicy`, the compiled view of it. Both `<AsRowActions>` and `<AsTableActions>` read the compiled policy, so the row cell and the selection toolbar always agree.
- **Query surface** (since 0.1.134): `buildQuery(opts?)` returns the `Uniquery` the table's own fetch would send right now (`{ columnPaths?, includeActions? }` overrides); `fetchPage(query, page, size)` runs one page through the configured `queryFn` / client. These are the two seams `useTableExport` builds on.
- **Local sorting** (since 0.1.134): `localColumnPaths` (paths of the client-owned columns) and `applyLocalSort(rows)` — `<AsTable>` runs the loaded page through it, sorting by the FULL sorter list so the server's ordering survives and a local sorter lands at its real priority. Inert without [display columns](/tables/customization#display-only-columns), in window mode, and for an in-memory table (its query function sorts the dataset itself, which is also what lets a window-mode in-memory table keep the affordance). `localSortAvailable` (since 0.1.135) is the single rule every sort affordance reads, so the header and the config dialog cannot offer different sets.
- **URL bridge**: `applyUrlQuery(urlString, opts?)`. Since 0.1.137 `opts.mode` picks how filters and sorters the URL omits are treated: `"merge"` (default) keeps them — mount-time deep-link hydration overlaying a preset baseline — and `"replace"` clears them within the `urlQuerySync` gates, which is what history navigation needs. `<AsTableRoot>` merges on the first pass and replaces on every later one.
- **Query methods**: `query(opts?: { silent?: boolean })` (microtask-coalesced refresh; `{ silent: true }` runs the current query with no `querying` flip and leaves rows as-is on failure — for timer-driven live refresh), `queryImmediate(opts?: { silent?: boolean })` (awaitable form, same `silent` semantics), `queryNext()`, `loadRange()`, `invalidate()`. Every query keeps prior rows until the response settles, then swaps `results` + `totalCount` atomically (keep-rows-until-settle contract).

### `TableActionsState`

```typescript
interface TableActionsState {
  table: TVueTableActionInfo[];
  row: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
  default: {
    table?: TVueTableActionInfo;
    row?: TVueTableActionInfo;
    rows?: TVueTableActionInfo;
  };
  others: {
    table: TVueTableActionInfo[];
    row: TVueTableActionInfo[];
    rows: TVueTableActionInfo[];
  };
  cellRow: TVueTableActionInfo[];
  invoke: (
    action: TVueTableActionInfo,
    pk?: Record<string, unknown> | Record<string, unknown>[],
    opts?: InvokeOpts,
  ) => Promise<ActionResult>;
  invoking: ShallowRef<Set<string>>;
  lastResult: ShallowRef<Map<string, ActionResult>>;
}
```

### `ActionResult`

```typescript
type ActionResult =
  | { ok: true; kind: "backend"; data: unknown; message?: string }
  | { ok: true; kind: "navigate" }
  | { ok: true; kind: "custom"; dispatched: true }
  | { ok: true; kind: "remove"; data: TDbDeleteResult }
  | { ok: false; kind: "error"; error: ClientError | Error };
```

### `RowActionsConfig` / `LocalRowAction`

Per-screen row-action policy. Since 0.1.134 — see [Selecting and extending row actions](/tables/actions#selecting-and-extending-row-actions).

```typescript
interface RowActionsConfig {
  /** Allowlist of server action names. Omitted = every eligible action. */
  include?: string[];
  /** Denylist, applied after `include`. Also removes an `extra` of the same name. */
  exclude?: string[];
  /** Presentation patches keyed by server action name. */
  overrides?: Record<
    string,
    Partial<Pick<TVueTableActionInfo, "label" | "icon" | "intent" | "promptText">>
  >;
  /** App-owned actions, appended after the server ones. */
  extra?: LocalRowAction[];
}

interface LocalRowAction {
  name: string;
  label: string;
  icon?: string;
  intent?: TDbActionInfo["intent"];
  promptText?: string | [string, string];
  /** Renders a real anchor, mapped through `state.resolveHref`. */
  href?: (row: Record<string, unknown>) => string;
  /** Awaited locally, then settled as an `@action` emit with `kind: 'custom'`. */
  onInvoke?: (row: Record<string, unknown>, pk?: Record<string, unknown>) => void | Promise<void>;
  /** Per-row gate. */
  enabled?: (row: Record<string, unknown>) => boolean;
}
```

The server's per-row `$actions` gate runs **before** this policy, so `include` can only narrow what a row was already allowed and `overrides` never re-enable a gated action. `include` does not apply to `extra` — being listed there is the opt-in; `include: []` therefore hides every server action and keeps the extras. The policy applies wherever row actions render: the row-actions cell and the `level="row"` selection toolbar.

### `ColumnMenuConfig`

```typescript
interface ColumnMenuConfig {
  sort?: boolean;
  filters?: boolean;
  hide?: boolean;
  /** "Reset width" entry — shown only when current ≠ default. */
  resetWidth?: boolean;
}
```

### Row hooks

Exported types behind `<AsTable>`'s `rowSelectable` / `rowClass` / `rowAttrs`
props. All new in 0.1.133.

```typescript
/** Context handed to every per-row hook. */
interface RowHookContext {
  /** Position of the row in the rows the renderer is currently rendering. */
  index: number;
  /** Whether the row's pk is in `state.selectedRows` right now. */
  selected: boolean;
}

/**
 * Per-row selectability predicate. Return `false` — or a string, surfaced as
 * the disabled reason on the selection control — to make the row not
 * selectable; `true` (or omitting the prop) keeps it selectable.
 */
type RowSelectableHook = (row: Record<string, unknown>, ctx: RowHookContext) => boolean | string;

/** Extra classes for the row element. */
type RowClassHook = (
  row: Record<string, unknown>,
  ctx: RowHookContext,
) => string | string[] | Record<string, boolean> | undefined;

/**
 * Extra attributes for the row element. The framework's own `id`, `role`,
 * `aria-*`, `data-*`, `class` and `style` always win.
 */
type RowAttrsHook = (
  row: Record<string, unknown>,
  ctx: RowHookContext,
) => Record<string, unknown> | undefined;

/** Normalised `RowSelectableHook` verdict. */
interface RowSelectableVerdict {
  ok: boolean;
  /** Disabled reason, when the predicate returned a string. */
  reason?: string;
}
```

A rejected row's selection control renders with `as-table-checkbox-disabled`
(see [@atscript/ui-styles](/api/ui-styles)), carries `aria-disabled`, and puts
the reason in its accessible name.

### `PresetConfig`

Preset feature configuration passed to `useTable({ preset })` / `<AsTableRoot :preset>`. Presence of the object enables the feature; omit it entirely to disable.

```typescript
interface PresetConfig {
  /** Preset controller URL, e.g. `"/api/db/_presets"`. */
  url: string;
  /** Per-table identifier — scopes preset rows under `(app, tableKey)`. */
  tableKey: string;
  /** Optional override; defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  /** Consumer-supplied synthetic system presets (`sys:*`, never persisted). */
  systemPresets?: SystemPresetInput[];
  /** App-declared aspect set. Default `['columns','filters','filterOps','sorters']`. */
  aspects?: PresetAspect[];
  /**
   * Aspects a SYSTEM preset owns (since 0.1.133). Intersected with `aspects`;
   * defaults to all of them. Narrow it to e.g. `['filterOps']` when system
   * presets are filter-only views that must not reset the user's columns,
   * displayed filters, sorters or page size.
   */
  systemAspects?: PresetAspect[];
  /** Opt-in localStorage overlay for in-flight tweaks. Default `false`. */
  persistDrafts?: boolean;
  /**
   * Identity the draft is stored under (since 0.1.133) — pass the signed-in
   * user's id whenever `persistDrafts` is on, so a shared browser never
   * restores the previous user's draft. Reactive. Omitted keeps the
   * pre-0.1.133 unscoped key.
   */
  draftScope?: MaybeRefOrGetter<string | undefined>;
}
```

### `PresetSurface`

The preset namespace on `state.preset`. Always present; inert (`available` is `false`, mutators throw) when `preset` was not configured. Read-only refs for picker UI; mutators are pure batched writes and never call `query()` — the root watchers refetch.

- **Rows**: `presets`, `presetsById`, `userConf`, `capabilities`, `systemPresets`, `systemPresetsById`.
- **Aspects**: `availableAspects` (app-declared; static), and `systemAspects` (since 0.1.133) — the subset a SYSTEM preset owns, equal to `availableAspects` unless `preset.systemAspects` narrowed it. It drives apply/reset, the dirty baseline, the picker/dialog badges, and the Save-As defaults for system presets.
- **Status**: `available` (false when `preset` is absent, the initial load returned 401/403/404, or any other error — the picker / dialog hide themselves), `activeId`, `activeSnapshot`, `isDirty`, `canSaveActive`, `currentUser`, `dialogOpen`.
- **Mutation status** (since 0.1.133): `lastError: Ref<Error | null>` — the error thrown by the most recent outermost mutator, cleared when the next outermost mutator starts (a `batch()` is one frame: the last failure inside it wins); mutators still rethrow, so a caller can handle a single call and this ref is for UI that only renders the failure.
- **Aspect ownership** (since 0.1.133): `ownedAspects(id: string | null): PresetAspect[]` — `systemAspects` for a system id, the stored row's own `aspects` for a saved preset, `availableAspects` otherwise. Apply, dirty baseline, badges and Save-as defaults all use it.
- **Methods**: `captureSnapshot`, `apply`, `resetActive`, `clearLocalDraft`, `resolveDefaultId`, `saveActive`, `saveAs`, `rename`, `remove`, `togglePublic`, `setDefault`, `toggleFav`, `setFavorites`, `batch`.

### `RowDeleteOpt` / `InvokeOpts` / `NavKeyOptions` / `MainActionRequest` / `QueryErrorKind` / `TVueTableActionInfo`

```typescript
interface RowDeleteOpt {
  label?: string;
  icon?: string;
  confirm?: string;
  intent?: TDbActionInfo["intent"];
}

interface InvokeOpts {
  suppressRefresh?: boolean;
  event?: KeyboardEvent | MouseEvent;
  input?: unknown;
}

interface NavKeyOptions {
  enterAction?: "main-action" | "toggle-select" | "passthrough";
  mode?: SelectionMode;
}

Since 0.1.133 Enter and Space are always left to native handling when the
event target (or an ancestor inside the cell) is interactive — `button`,
`a[href]`, form controls, `summary`, `[contenteditable]`, or a widget `role` —
and the row is not activated. An interactive element hands the keys back to
table navigation with the `data-as-nav-keys` attribute. Arrow and paging keys
are unaffected. The search-input bridge is not affected: its handler is bound
on the input itself.

interface MainActionRequest {
  /** Active row, resolved nav-mode-aware via `state.getActiveRow()` — the reliable field on every page. */
  row: Record<string, unknown>;
  absIndex: number;
  event: KeyboardEvent | MouseEvent;
}

type QueryErrorKind = "initial" | "query" | "queryNext" | "loadRange";

type TVueTableActionInfo = Omit<TDbActionInfo, "processor"> & {
  processor: TDbActionProcessor | "__remove";
};
```

### Re-exports from `@atscript/ui-table`

`ConfigTab`, `UrlQuerySync`, `AppConfData`, `AsPresetEntryRow`, `PresetAspect`, `PresetCapabilities`, `PresetData`, `PresetSnapshot`, `PresetSnapshotWire`, `SystemPreset`, `SystemPresetInput`, `UserConfData`, `PRESET_ASPECTS`, `STANDARD_PRESET_ID`, `SYSTEM_PRESET_PREFIX`, `isSystemPresetId`, `resolveSystemPresets`. See [@atscript/ui-table](/api/ui-table) for definitions.

### Re-exports from `@atscript/ui`

`setDefaultClientFactory`, `getDefaultClientFactory`, `resetDefaultClientFactory`, `ClientFactory`.

## Utilities

```typescript
function getColumnWidth(column: ColumnDef, widths: ColumnWidthsMap): string;
function getCellValue(row: Record<string, unknown>, path: string): unknown;
function formatCellValue(value: unknown, column: ColumnDef, opts?: { locale?: CellLocale }): string;
function extractIdentifier(
  row: Record<string, unknown>,
  preferredId: readonly string[],
): Record<string, unknown>;
```

`extractIdentifier` builds the identifier object sent with action invocations and URL `$1` substitution. Per `@atscript/db-client` invariant #11 the server rejects bare scalars — even single-field PK tables send `{ id: '...' }`.

## Cross-links

- [Tables — Hello World](/tables/hello-world)
- [Tables — Annotations Reference](/tables/annotations)
- [Tables — Query Function](/tables/query-function)
- [Tables — Filtering](/tables/filtering), [Sorting](/tables/sorting)
- [Tables — Pagination & Virtualization](/tables/pagination)
- [Tables — Cells](/tables/cells), [Custom Cells](/tables/custom-cells)
- [Tables — Config Dialog](/tables/config-dialog)
- [Tables — URL State](/tables/url-state)
- [Tables — Presets](/tables/presets), [Server-Side Presets](/tables/server-presets)
- [Tables — Actions & Selection](/tables/actions)
- [Tables — Slot Overrides & Swaps](/tables/customization)
- [@atscript/ui](/api/ui), [@atscript/ui-table](/api/ui-table)
- [@atscript/moost-ui-presets](/api/moost-ui-presets)
