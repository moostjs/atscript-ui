import {
  computed,
  inject,
  onBeforeUnmount,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import {
  getVisibleColumns,
  type ColumnDef,
  type PaginationControl,
  type SortControl,
  type TableDef,
} from "@atscript/ui";
import {
  buildTableQuery,
  debounce,
  isFilled,
  reconcileColumnWidthDefaults,
  sameColumnSet,
  sortersEqual,
  type ColumnWidthsMap,
  type FieldFilters,
  type FilterCondition,
} from "@atscript/ui-table";
import type { Client, PageResult } from "@atscript/db-client";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type {
  ConfigTab,
  MainActionRequest,
  QueryErrorKind,
  ReactiveTableState,
  TAsTableComponents,
} from "../types";
import { createSelectionApi, type SelectionApiOptions } from "./state/create-selection";
import { createMainActionRegistry } from "./state/create-main-action-registry";
import { createNavController } from "./state/create-nav-controller";
import { createWindowFetcher } from "./state/create-window-fetcher";

const TABLE_KEY = "__as_table";
const FILTER_DEBOUNCE_MS = 500;
const DEFAULT_BLOCK_SIZE = 100;
const DEFAULT_DRAG_RELEASE_DEBOUNCE_MS = 300;

let _tblUid = 0;

/**
 * Coerce a primitive cell value to a string for the static-mode query
 * function's substring search and locale-aware sort. Objects fall back to
 * `""` so `'[object Object]'` never leaks into the search index. Module
 * scope so it's not recreated on every fetch.
 */
function cellAsString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return v.toString();
  return "";
}

/** Everything provided by as-table-root to its subtree. */
export interface TableContext {
  state: ReactiveTableState;
  client: Client;
  components: TAsTableComponents;
}

export type QueryFn = (
  query: Uniquery,
  page: number,
  size: number,
) => Promise<PageResult<Record<string, unknown>>>;

/** External refs the consumer wires up via `defineModel` (or otherwise). */
export interface TableModelRefs {
  filterFields?: Ref<string[]>;
  columnNames?: Ref<string[]>;
  columnWidths?: Ref<ColumnWidthsMap>;
  sorters?: Ref<SortControl[]>;
}

export type TableSelectionOptions = SelectionApiOptions;

export interface TableQueryOptions {
  /** Override the default query function. */
  fn?: QueryFn;
  /** Always-applied Uniquery filter expression (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** When true, all triggers (query/queryNext/loadRange) early-return. */
  blockQuery?: boolean;
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
}

export interface TableWindowOptions {
  /** Page-alignment unit for `loadRange` and the `queryNext` extension. */
  blockSize?: number;
  /** Debounce window for the topIndex/viewportRowCount watcher. */
  dragReleaseDebounceMs?: number;
}

export interface CreateTableStateOptions {
  /** Data-layer client used for `client.pages` calls. */
  client: Client;
  /** Default page size (`pagination.itemsPerPage`). */
  limit?: number;
  /** External refs from `defineModel`. */
  model?: TableModelRefs;
  /** Selection settings. */
  selection?: TableSelectionOptions;
  /** Query/fetch settings. */
  query?: TableQueryOptions;
  /** Windowed-mode (virtualized) settings. */
  window?: TableWindowOptions;
}

/** Internal handles returned alongside the public state. */
export interface TableStateInternals {
  /** Initialize state from a loaded table definition. */
  init(def: TableDef): void;
  /** Reset pagination to page 1 (suppresses the pagination watcher). */
  resetPagination(): void;
}

type Row = Record<string, unknown>;

export function createTableState(opts: CreateTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
} {
  const client = opts.client;
  const modelOpts = opts.model;
  const selectionOpts = opts.selection;
  const windowOpts = opts.window;
  const queryOpts = opts.query;
  const blockSize = windowOpts?.blockSize ?? DEFAULT_BLOCK_SIZE;
  const dragReleaseDebounceMs =
    windowOpts?.dragReleaseDebounceMs ?? DEFAULT_DRAG_RELEASE_DEBOUNCE_MS;

  // ── Reactive state owned by the orchestrator ────────────────────────────
  const tableDef = shallowRef<TableDef | null>(null);
  const loadingMetadata = ref(true);
  const allColumns = shallowRef<ColumnDef[]>([]);

  const filterFields = modelOpts?.filterFields ?? shallowRef<string[]>([]);
  const columnNames = modelOpts?.columnNames ?? shallowRef<string[]>([]);
  const columnWidths = modelOpts?.columnWidths ?? ref<ColumnWidthsMap>({});
  const sorters = modelOpts?.sorters ?? shallowRef<SortControl[]>([]);

  // columns is DERIVED from columnNames + allColumns
  const columns = computed<ColumnDef[]>(() => {
    const all = allColumns.value;
    if (all.length === 0 || columnNames.value.length === 0) return [];
    const map = new Map(all.map((c) => [c.path, c]));
    const result: ColumnDef[] = [];
    for (const name of columnNames.value) {
      const col = map.get(name);
      if (col) result.push(col);
    }
    return result;
  });

  const filters = shallowRef<FieldFilters>({});
  const results = shallowRef<Row[]>([]);
  const resultsStart = ref(0);
  const querying = ref(false);
  const queryingNext = ref(false);
  const totalCount = ref(0);
  const loadedCount = computed(() => results.value.length);
  const pagination = ref<PaginationControl>({
    page: 1,
    itemsPerPage: opts.limit ?? 50,
  });
  const queryError = ref<Error | null>(null);
  const metadataError = ref<Error | null>(null);
  // Wrapped in a fresh `{ error, kind }` object on every assignment so deep-equal
  // consecutive failures still fire watchers; a successful retry does NOT clear it.
  const lastError = ref<{ error: Error; kind: QueryErrorKind } | null>(null);

  function reportError(error: Error, kind: QueryErrorKind) {
    lastError.value = { error, kind };
  }
  const mustRefresh = ref(false);
  const searchTerm = ref("");

  const configDialogOpen = ref(false);
  const configTab = ref<ConfigTab>("columns");
  const filterDialogColumn = ref<ColumnDef | null>(null);

  // Stable per-state UID so deterministic row IDs survive remount of consuming
  // components without colliding across multi-table pages.
  const stateUid = `tbl-${++_tblUid}`;
  function rowId(absIndex: number): string {
    return `${stateUid}-row-${absIndex}`;
  }

  // ── Query lifecycle (orchestrator-owned) ───────────────────────────────
  let generation = 0;
  let queryDetected = false;
  let skipPaginationWatch = 0;

  function buildCurrentQuery(): Uniquery {
    return buildTableQuery({
      visibleColumnPaths: columnNames.value,
      sorters: sorters.value,
      forceSorters: queryOpts?.forceSorters,
      filters: filters.value,
      forceFilters: queryOpts?.forceFilters,
      search: searchTerm.value || undefined,
    });
  }

  function dispatchPages(query: Uniquery, page: number, size: number) {
    const fetcher =
      queryOpts?.fn ??
      ((q: Uniquery, p: number, s: number) =>
        client.pages(q as Parameters<typeof client.pages>[0], p, s));
    return fetcher(query, page, size);
  }

  function resetPagination() {
    if (pagination.value.page !== 1) {
      skipPaginationWatch++;
      pagination.value = { ...pagination.value, page: 1 };
    }
  }

  // ── Shared cursor: orchestrator owns activeIndex so all four factories
  // read/write the same ref ───────────────────────────────────────────────
  /** -1 == nothing active. */
  const activeIndex = ref(-1);

  // ── Sub-factories (constructed in dependency order) ─────────────────────
  // 1. Window fetcher: independent of selection/nav/main-action.
  const windowFetcher = createWindowFetcher({
    blockSize,
    dragReleaseDebounceMs,
    tableDef,
    totalCount,
    results,
    resultsStart,
    queryingNext,
    getGeneration: () => generation,
    isQueryBlocked: () => !!queryOpts?.blockQuery,
    buildCurrentQuery,
    dispatchPages,
    reportError,
  });
  const {
    windowCache,
    windowLoading,
    errors,
    topIndex,
    viewportRowCount,
    dataAt,
    loadingAt,
    errorAt,
    loadRange,
    queryNext,
    clearSettlements,
    resetWindow,
    disposeDebounces,
  } = windowFetcher;

  // 2. Shared accessor used by selection + main-action.
  function getActiveRow(): Row | undefined {
    const abs = activeIndex.value;
    if (abs < 0) return undefined;
    return dataAt(abs);
  }

  // 3. Selection.
  const selection = createSelectionApi(selectionOpts, getActiveRow);
  const {
    selectedRows,
    selectedCount,
    selectionMode,
    rowValueFn,
    isPkSelected,
    ariaSelectedFor,
    toggleActiveSelection,
  } = selection;

  // 4. Main-action registry.
  const mainAction = createMainActionRegistry(() => activeIndex.value, getActiveRow);
  const { hasMainActionListener, registerMainActionListener, requestMainAction } = mainAction;

  // 5. Nav controller.
  const nav = createNavController({
    activeIndex,
    totalCount,
    results,
    viewportRowCount,
    topIndex,
    selectionMode,
    hasMainActionListener,
    requestMainAction,
    toggleActiveSelection,
  });
  const { navMode, navViewportRowCount, setActive, clearActive, handleNavKey } = nav;

  // ── Query engine ────────────────────────────────────────────────────────
  async function runQuery(kind: QueryErrorKind) {
    if (queryOpts?.blockQuery) return;
    mustRefresh.value = false;
    // Snap viewport back to top on a non-initial query so we don't render
    // past the new dataset's end after the cache wipe.
    if (kind !== "initial" && topIndex.value !== 0) {
      topIndex.value = 0;
    }
    const thisGen = ++generation;
    clearSettlements();
    querying.value = true;
    queryDetected = true;

    try {
      const query = buildCurrentQuery();
      const { page, itemsPerPage } = pagination.value;
      const newResultsStart = (page - 1) * itemsPerPage;
      // Window mode fetches one block; loadRange streams more as the viewport
      // scrolls. Pure-pagination uses the user-configured page size.
      const fetchSize = viewportRowCount.value > 0 ? blockSize : itemsPerPage;
      const fetchPage =
        fetchSize === itemsPerPage ? page : Math.floor(newResultsStart / fetchSize) + 1;

      const { data, count } = await dispatchPages(query, fetchPage, fetchSize);
      if (thisGen !== generation) return;

      const fresh = new Map<number, Row>();
      for (let i = 0; i < data.length; i++) fresh.set(newResultsStart + i, data[i] as Row);
      windowCache.value = fresh;
      windowLoading.value = new Set();
      errors.value = new Map();
      results.value = data as Row[];
      resultsStart.value = newResultsStart;
      totalCount.value = count;
      queryError.value = null;
    } catch (err) {
      if (thisGen !== generation) return;
      const error = err instanceof Error ? err : new Error(String(err));
      queryError.value = error;
      results.value = [];
      windowCache.value = new Map();
      windowLoading.value = new Set();
      totalCount.value = 0;
      reportError(error, kind);
    } finally {
      if (thisGen === generation) querying.value = false;
    }
  }

  // Microtask-coalesced query scheduler. Multiple `scheduleQuery` calls in
  // the same synchronous block (whether from watchers or from `query()`)
  // collapse into one `runQuery` invocation. The first scheduled kind wins.
  // Set `querying.value = true` synchronously so consumers checking the flag
  // right after `query()` see the loading state immediately.
  let pendingScheduledKind: QueryErrorKind | null = null;
  let queryFlushScheduled = false;

  function scheduleQuery(kind: QueryErrorKind = "query"): void {
    if (queryOpts?.blockQuery) return;
    if (tableDef.value === null) return;
    pendingScheduledKind = pendingScheduledKind ?? kind;
    querying.value = true;
    if (queryFlushScheduled) return;
    queryFlushScheduled = true;
    queueMicrotask(() => {
      queryFlushScheduled = false;
      const k = pendingScheduledKind;
      pendingScheduledKind = null;
      if (k === null) return;
      if (tableDef.value === null) return;
      void runQuery(k);
    });
  }

  function query(): void {
    scheduleQuery("query");
  }

  async function queryImmediate(): Promise<void> {
    pendingScheduledKind = null;
    if (queryOpts?.blockQuery) return;
    if (tableDef.value === null) return;
    await runQuery("query");
  }

  function invalidate(): void {
    generation++;
    results.value = [];
    resetWindow();
    resultsStart.value = (pagination.value.page - 1) * pagination.value.itemsPerPage;
    totalCount.value = 0;
  }

  // ── Mutators ────────────────────────────────────────────────────────────
  function writeColumnWidth(path: string, width: string) {
    const entry = columnWidths.value[path];
    if (!entry || entry.w === width) return;
    columnWidths.value = {
      ...columnWidths.value,
      [path]: { ...entry, w: width },
    };
  }

  // ── Public state object ─────────────────────────────────────────────────
  const state: ReactiveTableState = {
    tableDef,
    loadingMetadata,
    columnNames,
    columns,
    allColumns,
    columnWidths,
    filterFields,
    filters,
    sorters,
    results,
    resultsStart,
    windowCache,
    windowLoading,
    topIndex,
    viewportRowCount,
    navViewportRowCount,
    querying,
    queryingNext,
    totalCount,
    loadedCount,
    pagination,
    queryError,
    metadataError,
    lastError,
    mustRefresh,
    searchTerm,
    configDialogOpen,
    configTab,
    filterDialogColumn,
    selectedRows,
    selectedCount,
    selectionMode,
    rowValueFn,
    isPkSelected,
    ariaSelectedFor,
    activeIndex,
    navMode,
    hasMainActionListener,
    rowId,

    setActive,
    clearActive,
    toggleActiveSelection,
    requestMainAction,
    handleNavKey,
    registerMainActionListener,

    query,
    queryImmediate,
    queryNext,
    loadRange,
    invalidate,
    dataAt,
    loadingAt,
    errorAt,
    resetFilters() {
      if (Object.keys(filters.value).length === 0) return;
      filters.value = {};
    },
    showConfigDialog(tab?: ConfigTab) {
      configTab.value = tab ?? "columns";
      configDialogOpen.value = true;
    },
    addFilterField(path: string) {
      if (!filterFields.value.includes(path)) {
        filterFields.value = [...filterFields.value, path];
      }
    },
    removeFilterField(path: string) {
      if (!filterFields.value.includes(path)) return;
      filterFields.value = filterFields.value.filter((f) => f !== path);
    },
    setFieldFilter(path: string, conditions: FilterCondition[]) {
      if (!conditions.some(isFilled)) {
        if (!(path in filters.value)) return;
        const { [path]: _, ...rest } = filters.value;
        filters.value = rest;
      } else {
        filters.value = { ...filters.value, [path]: conditions };
      }
    },
    setColumnWidth(path: string, width: string) {
      writeColumnWidth(path, width);
    },
    resetColumnWidth(path: string) {
      const entry = columnWidths.value[path];
      if (entry) writeColumnWidth(path, entry.d);
    },
    removeFieldFilter(path: string) {
      const { [path]: _, ...rest } = filters.value;
      filters.value = rest;
    },
    openFilterDialog(column: ColumnDef) {
      filterDialogColumn.value = column;
    },
    closeFilterDialog() {
      filterDialogColumn.value = null;
    },
  };

  // ── Watchers that schedule queries ──────────────────────────────────────
  // Filter / search are noisy — debounce the actual query but flag mustRefresh
  // + reset pagination synchronously so the pagination watcher doesn't double-fire.
  const debouncedFilterQuery = debounce(() => {
    if (queryDetected) scheduleQuery();
  }, FILTER_DEBOUNCE_MS);

  watch([() => filters.value, () => searchTerm.value], () => {
    if (!queryDetected) return;
    mustRefresh.value = true;
    resetPagination();
    debouncedFilterQuery();
  });

  watch(
    () => sorters.value,
    (next, prev) => {
      if (!queryDetected) return;
      if (sortersEqual(prev, next)) return;
      mustRefresh.value = true;
      scheduleQuery();
    },
    { immediate: false },
  );

  watch(
    () => columnNames.value,
    (next, prev) => {
      if (!queryDetected) return;
      if (sameColumnSet(prev, next)) return;
      mustRefresh.value = true;
      scheduleQuery();
    },
    { immediate: false },
  );

  watch(
    () => pagination.value,
    (next, prev) => {
      if (skipPaginationWatch > 0) {
        skipPaginationWatch--;
        return;
      }
      if (!queryDetected) return;
      if (next.page === prev.page && next.itemsPerPage === prev.itemsPerPage) return;
      scheduleQuery();
    },
  );

  watch(
    () => tableDef.value,
    (def) => {
      if (def === null) return;
      if (queryOpts?.queryOnMount === false) return;
      if (allColumns.value.length === 0) return;
      if (results.value.length !== 0) return;
      // Flip the gate synchronously so any columnNames watcher queued during
      // init() sees `queryDetected = true` and joins the same coalesce window
      // — the microtask scheduled by scheduleQuery("initial") absorbs both.
      queryDetected = true;
      scheduleQuery("initial");
    },
  );

  onScopeDispose(() => {
    debouncedFilterQuery.cancel();
    disposeDebounces();
  });

  const internals: TableStateInternals = {
    init(def: TableDef) {
      // Order matters: tableDef LAST so the auto-bootstrap watcher fires after
      // columnNames is seeded; allColumns FIRST so the `columns` computed has
      // both halves ready. Vue flushes watchers in source-mutation order.
      allColumns.value = def.columns;
      const reconciled = reconcileColumnWidthDefaults(def.columns, columnWidths.value);
      if (reconciled !== columnWidths.value) columnWidths.value = reconciled;
      if (columnNames.value.length === 0) {
        columnNames.value = getVisibleColumns(def).map((c) => c.path);
      }
      tableDef.value = def;
    },
    resetPagination,
  };

  return { state, internals };
}

export interface CreateStaticTableStateOptions {
  /** All rows in the dataset. Sorting/searching is applied locally. */
  rows: Record<string, unknown>[];
  /** Columns to render. Used to synthesize a minimal `TableDef`. */
  columns: ColumnDef[];
  /** Field paths matched (substring, case-insensitive) by `searchTerm`. */
  searchPaths?: string[];
  /** Selection settings. */
  selection?: TableSelectionOptions;
  /** Default page size (`pagination.itemsPerPage`). */
  limit?: number;
}

/**
 * Build a `ReactiveTableState` backed by an in-memory row list. Used by the
 * enum value-help branch (`column.options`) where there's no client and no
 * metadata fetch — sorting/searching/pagination run locally against `rows`.
 */
export function createStaticTableState(opts: CreateStaticTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
} {
  // queryFn captures `_state` by closure before `createTableState` returns.
  let _state: ReactiveTableState | null = null;
  const queryFn: QueryFn = (q, page, size) => {
    if (!_state) {
      return Promise.resolve({ data: [], count: 0, page, itemsPerPage: size, pages: 1 });
    }
    return buildStaticQueryFn(opts, _state)(q, page, size);
  };
  const result = createTableState({
    client: {} as Client,
    selection: opts.selection,
    limit: opts.limit,
    query: { fn: queryFn },
  });
  _state = result.state;
  result.state.loadingMetadata.value = false;
  result.internals.init({
    type: undefined as unknown as TableDef["type"],
    columns: opts.columns,
    primaryKeys: [],
    readOnly: false,
    searchable: (opts.searchPaths?.length ?? 0) > 0,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  });
  return result;
}

function buildStaticQueryFn(
  opts: CreateStaticTableStateOptions,
  state: ReactiveTableState,
): QueryFn {
  const searchPaths = opts.searchPaths ?? [];
  return (_query, page, size) => {
    let filtered: Row[] = opts.rows;
    const term = state.searchTerm.value.trim().toLowerCase();
    if (term && searchPaths.length > 0) {
      filtered = filtered.filter((row) =>
        searchPaths.some((p) => cellAsString(row[p]).toLowerCase().includes(term)),
      );
    }
    const active = state.sorters.value;
    if (active.length > 0) {
      filtered = filtered.toSorted((a, b) => {
        for (const s of active) {
          const dir = s.direction === "desc" ? -1 : 1;
          const av = a[s.field];
          const bv = b[s.field];
          if (typeof av === "number" && typeof bv === "number") {
            if (av < bv) return -dir;
            if (av > bv) return dir;
          } else {
            const cmp = cellAsString(av).localeCompare(cellAsString(bv));
            if (cmp !== 0) return cmp * dir;
          }
        }
        return 0;
      });
    }
    const start = (page - 1) * size;
    return Promise.resolve({
      data: filtered.slice(start, start + size),
      count: filtered.length,
      page,
      itemsPerPage: size,
      pages: Math.max(1, Math.ceil(filtered.length / size)),
    });
  };
}

/** Provide the full table context to the component subtree. */
export function provideTableContext(ctx: TableContext): void {
  provide(TABLE_KEY, ctx);
}

/** Inject the full table context (throws if used outside as-table-root). */
export function useTableContext(): TableContext {
  const ctx = inject<TableContext>(TABLE_KEY);
  if (!ctx) {
    throw new Error("[vue-table] useTableContext() called outside of <as-table-root>.");
  }
  return ctx;
}

/**
 * Inject the table context if present; return undefined when no
 * `<as-table-root>` ancestor provided one. Use from components that may mount
 * inside or outside a table subtree (`<AsTableBase>` in combobox/listbox modes,
 * external composables that probe for context).
 */
export function useTableContextOptional(): TableContext | undefined {
  return inject<TableContext>(TABLE_KEY);
}

/**
 * Register `listener` as a main-action handler whenever `enabled` is truthy.
 * Reactive — toggling `enabled` registers / disposes live. Skipping
 * registration when `enabled` is false is what lets `handleNavKey` fall
 * back to `toggle-select` semantics; see `requestMainAction` early-return
 * gate. Callers detect "did the parent bind `@main-action`?" via
 * `useHasEmitListener("onMainAction")`.
 */
export function useRegisterMainActionListener(
  state: ReactiveTableState,
  listener: (req: MainActionRequest) => void,
  enabled: MaybeRefOrGetter<boolean>,
): void {
  let dispose: (() => void) | null = null;
  const stop = watch(
    () => toValue(enabled),
    (on) => {
      if (on && !dispose) dispose = state.registerMainActionListener(listener);
      else if (!on && dispose) {
        dispose();
        dispose = null;
      }
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    stop();
    dispose?.();
    dispose = null;
  });
}
