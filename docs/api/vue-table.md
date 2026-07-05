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
  url: string;
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
}
```

**Emits**: `row-click(row, event)`, `row-dblclick(row, event)`, `main-action(row, absIndex, event)`.

### `AsWindowTable`

Windowed (virtualized) renderer for million-row datasets. Uses `planFetch` / page-aligned blocks under the hood. Same props as `AsTable` plus `rowHeight?: number`.

### `AsFilters`

Renders the active-filters bar. Reads `state.filterFields` and `state.filters`, emits writes through the same refs.

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
  blockQuery?: boolean;
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

Builds a `ReactiveTableState` for static / in-memory data (no server, no `/meta`). Useful for stubs, demos, and unit tests.

```typescript
function createStaticTableState(opts: CreateStaticTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
};
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

Bridge `<AsTableRoot v-model:url-query>` to vue-router. Owns the whole query string. Uses type-only imports of `Router` / `RouteLocationNormalizedLoaded` — no runtime dependency on `vue-router` is added to `@atscript/vue-table`.

```typescript
interface UseTableUrlQueryOptions {
  /** `"replace"` (default) or `"push"`. */
  mode?: "replace" | "push";
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
</script>
<template>
  <AsTableRoot v-model:url-query="urlQuery" url="/db/products" />
</template>
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
  app?: string;
  tableKey: string;
  clientFactory?: ClientFactory;
  systemPresets?: SystemPresetInput[];
}

interface UsePresetsReturn {
  presets: ShallowRef<AsPresetEntryRow[]>;
  userConf: ShallowRef<AsPresetEntryRow | null>;
  capabilities: Ref<PresetCapabilities | null>;
  systemPresets: ComputedRef<SystemPreset[]>;
  available: ComputedRef<boolean>;
  saveActive: () => Promise<void>;
  saveAs: (label: string, opts?: { aspects?: AspectMask; public?: boolean }) => Promise<string>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePublic: (id: string) => Promise<void>;
  setDefault: (id: string | null) => Promise<void>;
  toggleFav: (id: string) => Promise<void>;
  setFavorites: (ids: string[]) => Promise<void>;
  batch: <T>(fn: () => Promise<T>) => Promise<T>;
}
```

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
  /** Last non-auth error, or `null`. Auth errors flip `available` instead. */
  error: Ref<unknown>;
  /** False on 401/403 from initial load — hide pref-bound controls. */
  available: ComputedRef<boolean>;
  reload(): Promise<void>;
  /** Optimistic shallow-merge save; rolls back on error. */
  save(patch: Partial<AppConfData>): Promise<void>;
  reset(): void;
}
```

### `useLocalDraft(options)`

localStorage overlay manager for table preset drafts. One overlay per `(app, tableKey)`; switching presets clears it (the caller decides when to call `clear()`).

```typescript
interface UseLocalDraftOptions {
  app: string;
  tableKey: string;
  enabled: Ref<boolean> | boolean;
  availableAspects: readonly PresetAspect[];
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
- **Selection**: `selectedRows`, `selectedCount`, `rowValueFn`, `isPkSelected`.
- **Active row / nav**: `activeIndex`, `navMode`, `navViewportRowCount`, `hasMainActionListener`, `rowId`, `getActiveRow`, `setActive`, `clearActive`, `toggleActiveSelection`, `requestMainAction`, `handleNavKey`, `registerMainActionListener`.

  `getActiveRow(): Record<string, unknown> | undefined` resolves the currently-active row — nav-mode-aware: page-relative into `results` for paginated `<AsTable>`, absolute via `windowCache` for `<AsWindowTable>`. Returns `undefined` when no row is active (`activeIndex < 0`). It is the single resolver shared by selection, the `@main-action` emit, and the `level="row"` toolbar.

- **Errors**: `queryError`, `lastError`, `mustRefresh`.
- **Querying flags**: `querying`, `queryingNext`.
- **Actions namespace**: `actions: TableActionsState`.
- **Prompt / action-form**: `confirmRequest`, `prompt`, `acceptPrompt`, `dismissPrompt`, `actionFormRequest`, `requestActionInput`, `acceptActionForm`, `dismissActionForm`.
- **Presets namespace**: `preset: PresetSurface`.
- **URL bridge**: `applyUrlQuery`.

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
