import { computed, inject, onScopeDispose, provide, ref, shallowRef, watch, type Ref } from "vue";
import {
  getVisibleColumns,
  type ColumnDef,
  type PaginationControl,
  type SortControl,
  type TableDef,
} from "@atscript/ui";
import {
  blockStartFor,
  buildTableQuery,
  debounce,
  isFilled,
  pageAlignedBlocksFor,
  planFetch,
  reconcileColumnWidthDefaults,
  sameColumnSet,
  sortersEqual,
  walkBackwardAbsorb,
  walkForwardAbsorb,
  type ColumnWidthsMap,
  type FetchPlan,
  type FieldFilters,
  type FilterCondition,
  type SelectionMode,
} from "@atscript/ui-table";
import type { Client, PageResult } from "@atscript/db-client";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { ConfigTab, ReactiveTableState, TAsTableComponents } from "../types";

const TABLE_KEY = "__as_table";
const FILTER_DEBOUNCE_MS = 500;
const DEFAULT_BLOCK_SIZE = 100;
const DEFAULT_DRAG_RELEASE_DEBOUNCE_MS = 300;

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

export interface TableSelectionOptions {
  mode?: SelectionMode;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /** Preserve selection across data refreshes. */
  keepAfterRefresh?: boolean;
}

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
  /** Data-layer client used for `client.pages` calls. Required. */
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

export type QueryErrorKind = "initial" | "query" | "queryNext" | "loadRange";

type Settlement =
  | { kind: "ok"; gen: number; firstIndex: number; rows: Row[]; count: number }
  | { kind: "err"; gen: number; firstIndex: number; error: Error; sourceKind: QueryErrorKind };

export function createTableState(opts: CreateTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
} {
  const client = opts.client;
  const queryOpts = opts.query;
  const modelOpts = opts.model;
  const selectionOpts = opts.selection;
  const windowOpts = opts.window;
  const blockSize = windowOpts?.blockSize ?? DEFAULT_BLOCK_SIZE;
  const dragReleaseDebounceMs =
    windowOpts?.dragReleaseDebounceMs ?? DEFAULT_DRAG_RELEASE_DEBOUNCE_MS;

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
  const windowCache = shallowRef<Map<number, Row>>(new Map());
  /** Per-block firstIndex values currently in flight. `loadingAt(absIdx)`
   * derives membership via `blockStartFor(absIdx, blockSize)`. */
  const windowLoading = shallowRef<Set<number>>(new Set());
  const topIndex = ref(0);
  const viewportRowCount = ref(0);
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

  const selectedRows = shallowRef<unknown[]>([]);
  const selectedCount = computed(() => selectedRows.value.length);
  const selectionMode: SelectionMode = selectionOpts?.mode ?? "none";
  const rowValueFn = selectionOpts?.rowValueFn ?? ((row: Row) => row);

  let generation = 0;
  let queryDetected = false;
  let skipPaginationWatch = 0;
  // Per-block errors keyed by `block.firstIndex`. shallowRef so reactive readers
  // (`errorAt` inside computeds) re-run on retry success / new failure.
  const errors = shallowRef<Map<number, Error>>(new Map());

  // Coalesce per-block settlements: with M parallel blocks landing in the
  // same microtask, one Map/Set clone replaces M independent clones.
  const settlements: Settlement[] = [];
  let flushScheduled = false;

  function writeColumnWidth(path: string, width: string) {
    const entry = columnWidths.value[path];
    if (!entry || entry.w === width) return;
    columnWidths.value = {
      ...columnWidths.value,
      [path]: { ...entry, w: width },
    };
  }

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

  async function runQuery(kind: QueryErrorKind) {
    if (queryOpts?.blockQuery) return;
    mustRefresh.value = false;
    // Snap viewport back to top on a non-initial query so we don't render
    // past the new dataset's end after the cache wipe.
    if (kind !== "initial" && topIndex.value !== 0) {
      topIndex.value = 0;
    }
    const thisGen = ++generation;
    settlements.length = 0;
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

  // Drain the settlements queue into a single Map/Set/Map clone trio. Without
  // this batching, M parallel blocks → M independent O(cacheSize) clones; with
  // it, one set of clones absorbs every settlement that landed in the same
  // microtask. Stale-generation entries are filtered here.
  function flushSettlements() {
    flushScheduled = false;
    if (settlements.length === 0) return;
    const currentGen = generation;
    const nextCache = new Map(windowCache.value);
    const nextLoading = new Set(windowLoading.value);
    const nextErrors = new Map(errors.value);
    let totalCountChanged = false;
    let nextTotal = totalCount.value;

    for (const s of settlements) {
      if (s.gen !== currentGen) continue;
      nextLoading.delete(s.firstIndex);
      if (s.kind === "ok") {
        for (let i = 0; i < s.rows.length; i++) nextCache.set(s.firstIndex + i, s.rows[i]);
        nextErrors.delete(s.firstIndex);
        nextTotal = s.count;
        totalCountChanged = true;
      } else {
        nextErrors.set(s.firstIndex, s.error);
        reportError(s.error, s.sourceKind);
      }
    }
    settlements.length = 0;

    windowCache.value = nextCache;
    windowLoading.value = nextLoading;
    errors.value = nextErrors;
    if (totalCountChanged && nextTotal !== totalCount.value) totalCount.value = nextTotal;

    // Walk-and-absorb with the freshly populated cache extends the results
    // island in either direction by any contiguous newly-arrived rows.
    const fwd = walkForwardAbsorb(results.value, resultsStart.value, nextCache);
    const bwd = walkBackwardAbsorb(fwd.newResults, fwd.newResultsStart, nextCache);
    if (bwd.newResults !== results.value) {
      results.value = bwd.newResults;
      resultsStart.value = bwd.newResultsStart;
    }
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flushSettlements);
  }

  function loadRangeInternal(skip: number, limit: number, kind: QueryErrorKind): Promise<void> {
    if (queryOpts?.blockQuery) return Promise.resolve();

    const blocks = pageAlignedBlocksFor(skip, limit, blockSize);
    if (blocks.length === 0) return Promise.resolve();

    const cache = windowCache.value;
    const loading = windowLoading.value;
    const missing: typeof blocks = [];
    for (const b of blocks) {
      if (loading.has(b.firstIndex)) continue;
      const end = b.firstIndex + blockSize;
      for (let idx = b.firstIndex; idx < end; idx++) {
        if (!cache.has(idx)) {
          missing.push(b);
          break;
        }
      }
    }
    if (missing.length === 0) return Promise.resolve();

    const thisGen = generation;
    const baseQuery = buildCurrentQuery();

    // Mark blocks as in-flight and clear any prior error so the cell renders
    // as a fresh skeleton instead of a permanent "errored" tile on retry.
    const nextLoading = new Set(windowLoading.value);
    const nextErrors = new Map(errors.value);
    for (const b of missing) {
      nextLoading.add(b.firstIndex);
      nextErrors.delete(b.firstIndex);
    }
    windowLoading.value = nextLoading;
    errors.value = nextErrors;

    const promises = missing.map(async (b) => {
      try {
        const { data, count } = await dispatchPages(baseQuery, b.page, blockSize);
        if (thisGen !== generation) return;
        settlements.push({
          kind: "ok",
          gen: thisGen,
          firstIndex: b.firstIndex,
          rows: data as Row[],
          count,
        });
        scheduleFlush();
      } catch (err) {
        if (thisGen !== generation) return;
        const error = err instanceof Error ? err : new Error(String(err));
        settlements.push({
          kind: "err",
          gen: thisGen,
          firstIndex: b.firstIndex,
          error,
          sourceKind: kind,
        });
        scheduleFlush();
      }
    });

    // Never reject — allSettled guarantees the aggregate promise resolves
    // regardless of individual outcomes (errors are surfaced via errorAt).
    return Promise.allSettled(promises).then(() => undefined);
  }

  function loadRange(skip: number, limit: number): Promise<void> {
    return loadRangeInternal(skip, limit, "loadRange");
  }

  function queryNext(): void {
    if (queryingNext.value) return;
    if (queryOpts?.blockQuery) return;
    queryingNext.value = true;
    const skip = resultsStart.value + results.value.length;
    void loadRangeInternal(skip, blockSize, "queryNext").finally(() => {
      queryingNext.value = false;
    });
  }

  function invalidate(): void {
    generation++;
    settlements.length = 0;
    results.value = [];
    windowCache.value = new Map();
    windowLoading.value = new Set();
    errors.value = new Map();
    resultsStart.value = (pagination.value.page - 1) * pagination.value.itemsPerPage;
    totalCount.value = 0;
  }

  function dataAt(absIdx: number): Row | undefined {
    return windowCache.value.get(absIdx);
  }
  function loadingAt(absIdx: number): boolean {
    if (blockSize <= 0) return false;
    return windowLoading.value.has(blockStartFor(absIdx, blockSize));
  }
  function errorAt(absIdx: number): Error | null {
    if (blockSize <= 0) return null;
    return errors.value.get(blockStartFor(absIdx, blockSize)) ?? null;
  }

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

    query,
    queryImmediate,
    queryNext,
    loadRange,
    invalidate,
    dataAt,
    loadingAt,
    errorAt,
    resetFilters() {
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
      const filled = conditions.filter((c) => isFilled(c));
      if (filled.length === 0) {
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

  // Viewport watcher gates on tableDef (not queryDetected) because a window-mode
  // renderer's mount-time ResizeObserver may write `viewportRowCount` before
  // auto-bootstrap fires. `jump` plans debounce on the user's drag-release settle
  // position; `steady` plans dispatch immediately and rely on cache+in-flight dedupe.
  let pendingJumpPlan: FetchPlan | null = null;
  const debouncedJumpDispatch = debounce(() => {
    const plan = pendingJumpPlan;
    pendingJumpPlan = null;
    if (plan) void loadRange(plan.skip, plan.limit);
  }, dragReleaseDebounceMs);
  const prefetchBuffer = Math.max(1, Math.floor(blockSize / 4));

  watch([() => topIndex.value, () => viewportRowCount.value], () => {
    if (tableDef.value === null) return;
    if (viewportRowCount.value <= 0) return;
    const plan = planFetch({
      top: topIndex.value,
      viewport: viewportRowCount.value,
      totalCount: totalCount.value,
      cache: windowCache.value,
      blockSize,
      buffer: prefetchBuffer,
    });
    if (plan === null) return;
    if (plan.mode === "jump") {
      pendingJumpPlan = plan;
      debouncedJumpDispatch();
    } else {
      // The block-keyed loading set already dedupes in `loadRangeInternal`,
      // but bailing here also avoids rebuilding `baseQuery` on every tick.
      if (windowLoading.value.has(blockStartFor(plan.skip, blockSize))) return;
      void loadRange(plan.skip, plan.limit);
    }
  });

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
    debouncedJumpDispatch.cancel();
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
