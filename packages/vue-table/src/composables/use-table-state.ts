import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  toValue,
  watch,
  type Component,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import {
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
  resolveAspectGate,
  sameColumnSet,
  sortersEqual,
  stateToUrlQueryString,
  urlQueryStringToState,
  type ColumnWidthsMap,
  type FieldFilters,
  type FilterCondition,
  type UrlQuerySync,
} from "@atscript/ui-table";
import type { Client, PageResult } from "@atscript/db-client";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type {
  ActionFormRequest,
  ActionResult,
  ConfigTab,
  ConfirmOptions,
  ConfirmRequest,
  MainActionRequest,
  QueryErrorKind,
  ReactiveTableState,
  RowDeleteOpt,
  TAsCellTypeComponents,
  TAsTableControls,
  TVueTableActionInfo,
} from "../types";
import { createActions } from "./state/create-actions";
import { createSelectionApi, type SelectionApiOptions } from "./state/create-selection";
import { createMainActionRegistry } from "./state/create-main-action-registry";
import { createNavController } from "./state/create-nav-controller";
import { createPresetState } from "./state/create-preset-state";
import { createWindowFetcher } from "./state/create-window-fetcher";
import { collectIdentifiers, triggerAction, type PromptCtx } from "./state/intent-scope";
import type { UseLocalDraftReturn } from "./use-local-draft";
import type { UsePresetsReturn } from "./use-presets";
import type { PresetAspect, SystemPreset } from "@atscript/ui-table";

const TABLE_KEY = "__as_table";
const FILTER_DEBOUNCE_MS = 500;
const DEFAULT_BLOCK_SIZE = 100;
const DEFAULT_DRAG_RELEASE_DEBOUNCE_MS = 300;
const DEFAULT_ITEMS_PER_PAGE = 25;

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
  /** Skin-slot overrides for table chrome (header cells, filter dialog, etc.). */
  controls: TAsTableControls;
  /** Cell-type → component dispatch map. */
  types?: TAsCellTypeComponents;
  /** Named cell-component overrides — looked up by `@ui.table.component "name"`. */
  components?: Record<string, Component>;
  /** Form-type → component dispatch map for the action-form dialog. */
  formTypes?: TAsTypeComponents;
  /** Named form-component overrides for the action-form dialog. */
  formComponents?: Record<string, Component>;
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
  /**
   * Runtime "preserve search relevance" flag (see
   * `ReactiveTableState.ignoreSortersWhenSearched`). Its initial value is the
   * configured default the flag resets to on every new search session.
   */
  ignoreSortersWhenSearched?: Ref<boolean>;
}

export type TableSelectionOptions = SelectionApiOptions;

export interface TableQueryOptions {
  /** Override the default query function. */
  fn?: QueryFn;
  /** Always-applied Uniquery filter expression (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /**
   * Leaf field paths always added to `$select` (deduped, gated by available
   * meta), regardless of which columns are visible. Additive only.
   */
  alwaysSelected?: string[];
  /** When true, all triggers (query/queryNext/loadRange) early-return. */
  blockQuery?: boolean;
  /**
   * Configured default for the runtime `ignoreSortersWhenSearched` flag
   * (default `false`). Opt-in for relevance-ranked backends: while the
   * runtime flag is true AND a search term is active, user `sorters` are
   * omitted from the query (`forceSorters` still apply). Ignored when a
   * `model.ignoreSortersWhenSearched` ref is wired — the ref's initial
   * value is the default then.
   */
  ignoreSortersWhenSearched?: boolean;
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
  /**
   * Gate the initial `scheduleQuery("initial")` until this ref flips to
   * `true`. Used by `<AsTableRoot>` when `v-model:urlQuery` is bound, to
   * defer the first fetch until URL hydration has run so the table fires one
   * composed query on mount instead of two. Implicitly open when omitted.
   */
  urlQueryReady?: Ref<boolean>;
  /**
   * Called when a state mutation produces a new URL query string. Self-emits
   * are echo-suppressed by `lastEmittedUrl` so `applyUrlQuery(s)` followed
   * by mutations that re-encode to the same `s` will not re-fire this
   * callback. Opt-in: omitting disables the URL emitter entirely.
   */
  onUrlQueryChange?: (urlString: string) => void;
  /**
   * Per-aspect opt-in/out for the URL bridge. Defaults to full sync (current
   * behaviour). Static — captured at setup; to change sync, re-mount.
   */
  urlQuerySync?: UrlQuerySync;
}

export interface TableWindowOptions {
  /** Page-alignment unit for `loadRange` and the `queryNext` extension. */
  blockSize?: number;
  /** Debounce window for the topIndex/viewportRowCount watcher. */
  dragReleaseDebounceMs?: number;
}

export interface TableActionsOptions {
  /** Refetch policy: when `true` (default), successful backend / __remove invocations call `state.query()`. */
  refreshOnAction?: () => boolean;
  /**
   * Maps a navigate action's href before it lands in an anchor's `href` /
   * a mod-click `window.open` target (e.g. router base-path resolution).
   * Plain function passthrough — see `ReactiveTableState.resolveHref`.
   */
  resolveHref?: (url: string) => string;
  /**
   * Bridge for `<AsTableRoot>`'s `@action` emit. Called once per settled
   * `invoke` (success, error, custom). `ids` is the level-derived list:
   * `'row'` → `[pk]`, `'rows'` → `pk` if array else `[pk]`, `'table'` → `[]`.
   */
  onResolved?: (
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
  ) => void;
}

export interface TablePresetOptions {
  /** `usePresets` handle. When omitted, the preset surface degrades to a
   * permanently-unavailable shape (`state.preset.available=false`). */
  presetsHandle?: UsePresetsReturn | null;
  /** `useLocalDraft` handle for opt-in localStorage persistence. */
  draftHandle?: UseLocalDraftReturn | null;
  /** App-declared aspect set; default `['columns','filters','filterOps','sorters']`. */
  availableAspects?: PresetAspect[];
  /** Static fallback for system presets when no `presetsHandle` is wired. */
  fallbackSystemPresets?: SystemPreset[];
  /** Whether localStorage drafts should be hydrated + persisted on bootstrap. */
  persistDrafts?: boolean;
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
  /** Action settings (built-in row delete + refetch policy). */
  actions?: TableActionsOptions;
  /** Preset settings. */
  preset?: TablePresetOptions;
}

/** Internal handles returned alongside the public state. */
export interface TableStateInternals {
  /** Initialize state from a loaded table definition. */
  init(def: TableDef): void;
  /** Reset pagination to page 1 (suppresses the pagination watcher). */
  resetPagination(): void;
}

type Row = Record<string, unknown>;

interface RequestSlot<TBody, TResolved> {
  ref: Ref<(TBody & { resolve: (value: TResolved) => void }) | null>;
  request: (body: TBody) => Promise<TResolved>;
  accept: (value: TResolved) => void;
  dismiss: () => void;
}

/**
 * Promise-based dialog slot. A second `request()` while one is open
 * auto-resolves the prior one with `cancelValue` (the user couldn't have
 * answered both). `dismiss()` is the same path; `accept(v)` resolves with `v`.
 */
function createRequestSlot<TBody, TResolved>(
  cancelValue: TResolved,
): RequestSlot<TBody, TResolved> {
  type Req = TBody & { resolve: (value: TResolved) => void };
  // `shallowRef`: every writer replaces the value wholesale and the slot can
  // hold large `identifiers[]` arrays for `rows`-level actions — deep-tracking
  // each identifier object would be wasted reactive overhead.
  const r = shallowRef<Req | null>(null) as Ref<Req | null>;
  function request(body: TBody): Promise<TResolved> {
    if (r.value) {
      r.value.resolve(cancelValue);
      r.value = null;
    }
    return new Promise<TResolved>((resolve) => {
      r.value = { ...body, resolve } as Req;
    });
  }
  function accept(value: TResolved) {
    const req = r.value;
    if (!req) return;
    r.value = null;
    req.resolve(value);
  }
  function dismiss() {
    const req = r.value;
    if (!req) return;
    r.value = null;
    req.resolve(cancelValue);
  }
  return { ref: r, request, accept, dismiss };
}

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

  // Renderer-owned: pushed in by `<AsTable>` / `<AsWindowTable>` watchers.
  const rowDelete = ref<boolean | RowDeleteOpt>(false);
  const includeActions = ref(false);

  const filters = shallowRef<FieldFilters>({});
  const results = shallowRef<Row[]>([]);
  const resultsStart = ref(0);
  const querying = ref(false);
  const queryingNext = ref(false);
  const totalCount = ref(0);
  const loadedCount = computed(() => results.value.length);
  const pagination = ref<PaginationControl>({
    page: 1,
    itemsPerPage: opts.limit ?? DEFAULT_ITEMS_PER_PAGE,
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

  // Runtime "preserve search relevance" flag — a model like `sorters`.
  // Suppression is query-time only: `sorters` itself is never mutated, so
  // preset-dirty comparisons and restore-on-clear stay untouched.
  const ignoreSortersDefault =
    modelOpts?.ignoreSortersWhenSearched?.value ?? queryOpts?.ignoreSortersWhenSearched ?? false;
  const ignoreSortersWhenSearched =
    modelOpts?.ignoreSortersWhenSearched ?? ref(ignoreSortersDefault);
  // Rule-driven flips happen inside watchers/appliers whose triggering
  // mutation already schedules the query, so the flag watcher must not
  // double-fire for them. A tick-scoped boolean, NOT a counter: Vue coalesces
  // ref writes per flush, so two internal writes that net out (e.g. rule-4
  // reset followed by a URL-carried `$relevance` in `applyUrlQuery`) fire the
  // watcher zero or one time — a counter would strand increments and silently
  // eat later external v-model writes.
  let internalIgnoreSortersWrite = false;
  function setIgnoreSortersInternal(v: boolean) {
    if (ignoreSortersWhenSearched.value === v) return;
    if (!internalIgnoreSortersWrite) {
      internalIgnoreSortersWrite = true;
      // Clear after the watcher flush this write triggers.
      void nextTick(() => {
        internalIgnoreSortersWrite = false;
      });
    }
    ignoreSortersWhenSearched.value = v;
  }

  const configDialogOpen = ref(false);
  const configTab = ref<ConfigTab>("columns");
  const filterDialogColumn = ref<ColumnDef | null>(null);

  const { slice: presetSlice, internals: presetInternals } = createPresetState({
    columnNames,
    columnWidths,
    filterFields,
    filters,
    sorters,
    pagination,
    allColumns,
    presetsHandle: opts.preset?.presetsHandle,
    draftHandle: opts.preset?.draftHandle,
    availableAspects: opts.preset?.availableAspects,
    persistDrafts: opts.preset?.persistDrafts,
    fallbackSystemPresets: opts.preset?.fallbackSystemPresets,
  });
  presetInternals.bootstrap();

  // ── Request slots: prompt + action-form dialogs ─────────────────────────
  const promptSlot = createRequestSlot<Omit<ConfirmRequest, "resolve">, boolean>(false);
  const confirmRequest = promptSlot.ref;
  function promptFn(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return promptSlot.request({ ...opts, message });
  }
  const acceptPrompt = () => promptSlot.accept(true);
  const dismissPrompt = promptSlot.dismiss;

  const formSlot = createRequestSlot<Omit<ActionFormRequest, "resolve">, unknown>(null);
  const actionFormRequest = formSlot.ref;
  function requestActionInput(action: TVueTableActionInfo, ctx: PromptCtx): Promise<unknown> {
    return formSlot.request({
      action,
      identifiers: ctx.identifiers,
      preferredId: ctx.preferredId,
    });
  }
  const acceptActionForm = formSlot.accept;
  const dismissActionForm = formSlot.dismiss;

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
    // narrowed-meta gate over the server-returnable field set (`fetchableFields`,
    // includes `@ui.table.exclude` fields that are never columns). Falls back to
    // the column paths when a synthetic def carries no `fetchableFields`.
    const available =
      tableDef.value?.fetchableFields ?? new Set(allColumns.value.map((c) => c.path));
    const extra = new Set<string>();
    for (const c of columns.value) // selectWith: VISIBLE columns only
      for (const p of c.selectWith ?? []) if (available.has(p)) extra.add(p);
    if (queryOpts?.alwaysSelected)
      // alwaysSelected: same gate
      for (const p of queryOpts.alwaysSelected) if (available.has(p)) extra.add(p);
    return buildTableQuery({
      visibleColumnPaths: columnNames.value,
      extraSelect: extra.size ? [...extra] : undefined,
      sorters: sorters.value,
      forceSorters: queryOpts?.forceSorters,
      filters: filters.value,
      forceFilters: queryOpts?.forceFilters,
      search: searchTerm.value || undefined,
      ignoreSorters: ignoreSortersWhenSearched.value && !!searchTerm.value,
      includeActions: includeActions.value,
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
  // Owned here too (not inside the nav controller) so `getActiveRow` below can
  // read it: the nav mode is what tells `activeIndex` apart as an absolute
  // (window) vs page-relative (pagination) index. Renderers flip it on mount.
  const navMode = ref<"pagination" | "window">("pagination");

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
  // `activeIndex` lives in two different index spaces depending on nav mode, so
  // it must be resolved differently:
  //   • window  → ABSOLUTE row index (the window renderer sets it to
  //     `topIndex + offset`); rows live in the absolute-keyed window cache,
  //     so resolve via `dataAt`.
  //   • pagination → PAGE-RELATIVE index (the paginated renderer sets it to the
  //     row's position within the page); the current page lives in `results`,
  //     so index straight into it.
  // Resolving both through `dataAt(abs)` silently broke pagination past page 1:
  // there `resultsStart > 0` shifts the cache keys, so a page-relative index
  // hit an empty slot and selection / main-action no-opped on every page but
  // the first.
  function getActiveRow(): Row | undefined {
    const idx = activeIndex.value;
    if (idx < 0) return undefined;
    return navMode.value === "window" ? dataAt(idx) : results.value[idx];
  }

  // 3. Selection.
  const selection = createSelectionApi(selectionOpts, getActiveRow);
  const { selectedRows, selectedCount, rowValueFn, isPkSelected, toggleActiveSelection } =
    selection;

  // 4. Actions namespace. Built before `mainAction` so the registry's fallback
  // path can resolve `actions.default.row` and call `actions.invoke`. Refetch
  // policy is honored inline inside `invoke` — `createActions` calls
  // `scheduleQuery` directly when the per-call + root-prop gates allow it.
  const actionsNs = createActions({
    tableDef,
    client,
    rowDelete: () => rowDelete.value,
    scheduleQuery,
    refreshOnAction: () => opts.actions?.refreshOnAction?.(),
    onResolved: opts.actions?.onResolved,
  });
  const { actions } = actionsNs;

  // 5. Main-action registry — falls back to `actions.default.row` when no
  // listener is registered. Routes through `triggerAction` so keyboard-Enter
  // honours `promptText` / `inputForm` exactly like a click on the action.
  // `stateRef` is patched after `state` is built below; the guard turns the
  // construction-order hazard into a typed early-return.
  let stateRef: ReactiveTableState | null = null;
  const mainAction = createMainActionRegistry({
    getActiveIndex: () => activeIndex.value,
    getActiveRow,
    getDefaultRowAction: () => actions.default.row,
    invokeFallback: (action, row, event) => {
      if (!stateRef) return;
      const preferredId = tableDef.value?.preferredId ?? [];
      const identifiers = collectIdentifiers(stateRef, [row], preferredId);
      void triggerAction(stateRef, action, { identifiers, preferredId }, event);
    },
  });
  const {
    hasMainActionListener,
    hasMainActionAvailable,
    registerMainActionListener,
    requestMainAction,
  } = mainAction;

  // 6. Nav controller — reads/writes the orchestrator-owned `navMode` passed in.
  const nav = createNavController({
    activeIndex,
    navMode,
    totalCount,
    results,
    viewportRowCount,
    topIndex,
    hasMainActionAvailable,
    requestMainAction,
    toggleActiveSelection,
  });
  const { navViewportRowCount, setActive, clearActive, handleNavKey } = nav;

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

  function requestRefresh(): void {
    mustRefresh.value = true;
    scheduleQuery();
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
    ignoreSortersWhenSearched,
    configDialogOpen,
    configTab,
    filterDialogColumn,
    selectedRows,
    selectedCount,
    rowValueFn,
    resolveHref: opts.actions?.resolveHref ?? ((url: string) => url),
    isPkSelected,
    rowDelete,
    includeActions,
    activeIndex,
    navMode,
    getActiveRow,
    hasMainActionListener,
    rowId,

    setActive,
    clearActive,
    toggleActiveSelection,
    requestMainAction,
    handleNavKey,
    registerMainActionListener,
    actions,
    confirmRequest,
    prompt: promptFn,
    acceptPrompt,
    dismissPrompt,
    actionFormRequest,
    requestActionInput,
    acceptActionForm,
    dismissActionForm,

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
    applyUrlQuery,

    /** Preset feature surface. Inert when no `presetsHandle` is wired. */
    preset: presetSlice,
  };
  stateRef = state;

  // ── URL query bridge ────────────────────────────────────────────────────
  // Echo guard for both directions — skip emit when state re-serializes to
  // the same string, skip apply when called with our own echo.
  let lastEmittedUrl: string = "";
  let hydratingFromUrl = false;
  const urlDefaultItemsPerPage = opts.limit ?? DEFAULT_ITEMS_PER_PAGE;
  const urlQuerySync = queryOpts?.urlQuerySync;

  function serializeStateForUrl(): string {
    return stateToUrlQueryString(
      {
        filters: filters.value,
        sorters: sorters.value,
        page: pagination.value.page,
        itemsPerPage: pagination.value.itemsPerPage,
        searchTerm: searchTerm.value,
        ignoreSorters: ignoreSortersWhenSearched.value,
      },
      {
        defaultItemsPerPage: urlDefaultItemsPerPage,
        defaultIgnoreSorters: ignoreSortersDefault,
        sync: urlQuerySync,
      },
    );
  }

  // Bridges that round-trip via `URLSearchParams` (e.g. the vue-router bridge
  // in `useTableUrlQuery`) re-encode characters that `buildUrl` from
  // `@uniqu/url` emits raw — `~` (operator marker in keys), `/`, `'` — so the
  // string we emit and the string we receive back differ byte-wise even
  // though they represent the same URL. Compare on decoded form so the echo
  // guard catches the round-trip; without this every state mutation produces
  // a duplicate query (one immediate from `applyUrlQuery`, one debounced from
  // the filter watcher).
  function urlsEquivalent(a: string, b: string): boolean {
    if (a === b) return true;
    try {
      return decodeURIComponent(a) === decodeURIComponent(b);
    } catch {
      return false;
    }
  }

  function emitUrlIfChanged(): void {
    if (!queryOpts?.onUrlQueryChange) return;
    if (hydratingFromUrl) return;
    // Suppress emits until the bootstrap gate releases — otherwise preset
    // baseline writes would ricochet through the router and overwrite the
    // user's deep-link query before `applyUrlQuery` overlays on top of it.
    if (queryOpts.urlQueryReady && !queryOpts.urlQueryReady.value) return;
    const next = serializeStateForUrl();
    if (next === lastEmittedUrl) return;
    lastEmittedUrl = next;
    queryOpts.onUrlQueryChange(next);
  }

  function applyUrlQuery(urlString: string): void {
    if (urlsEquivalent(urlString, lastEmittedUrl)) return;
    const cols = allColumns.value;
    const parsed = urlQueryStringToState(urlString, {
      knownFields: cols.length > 0 ? cols.map((c) => c.path) : undefined,
      sync: urlQuerySync,
    });

    // Round-trip stability when user changed page size locally: divide raw
    // `$skip` by the consumer's CURRENT `itemsPerPage`, not the default.
    const currentItemsPerPage = pagination.value.itemsPerPage;
    const skip = parsed.skip ?? 0;
    const nextPage =
      skip > 0 && currentItemsPerPage > 0 ? Math.floor(skip / currentItemsPerPage) + 1 : 1;

    const wasQueryDetected = queryDetected;
    hydratingFromUrl = true;

    // Per-field overlay: URL fields override, others (preset/local) survive.
    // Allowlist gating is already applied by the parser (parsed.filters only
    // contains allowlisted paths in that mode), so the merge step is the
    // same shape for "all" and allowlist.
    const filtersGate = resolveAspectGate(urlQuerySync?.filters);
    if (filtersGate !== "none") {
      const next: FieldFilters = { ...filters.value };
      for (const path in parsed.filters) next[path] = parsed.filters[path];
      filters.value = next;
    }

    // Sorters merge field-level: drop existing sorters whose field URL
    // re-specifies, then append URL's. Preserves preset sorters whose field
    // URL is silent on.
    const sortersGate = resolveAspectGate(urlQuerySync?.sorters);
    let urlSortersChanged = false;
    if (sortersGate !== "none") {
      const urlFields = new Set<string>();
      for (const s of parsed.sorters) urlFields.add(s.field);
      const survivors = sorters.value.filter((s) => !urlFields.has(s.field));
      const merged = [...survivors, ...parsed.sorters];
      if (!sortersEqual(sorters.value, merged)) {
        sorters.value = merged;
        urlSortersChanged = true;
      }
    }

    const searchWasActive = !!searchTerm.value;
    if (urlQuerySync?.search !== false) {
      if (searchTerm.value !== parsed.searchTerm) searchTerm.value = parsed.searchTerm;
    }
    const searchNowActive = !!searchTerm.value;

    // Relevance flag — the sorters/searchTerm rule watchers are guarded by
    // `hydratingFromUrl`, so rules 3/4 are applied explicitly here, then the
    // URL's explicit `$relevance` (when present) wins over both.
    if (!searchWasActive && searchNowActive) {
      // New search session → reset to the configured default (rule 4).
      setIgnoreSortersInternal(ignoreSortersDefault);
    } else if (urlSortersChanged && searchWasActive && searchNowActive) {
      // Sorter write during an active search = explicit intent (rule 3).
      setIgnoreSortersInternal(false);
    }
    if (parsed.ignoreSorters !== undefined) {
      setIgnoreSortersInternal(parsed.ignoreSorters);
    }

    if (urlQuerySync?.pagination !== false) {
      // itemsPerPage is private (recipient's preference) and preserved here.
      if (pagination.value.page !== nextPage) {
        pagination.value = { ...pagination.value, page: nextPage };
      }
    }

    // Display-state union — `filterFields` is per-user UI prefs and must not
    // narrow on hydrate (a shared link reveals filters but never hides them).
    // Skipped when filter sync is off — no parsed paths to reveal.
    if (filtersGate !== "none") {
      const present = new Set(filterFields.value);
      let merged: string[] | null = null;
      for (const f in parsed.filters) {
        if (present.has(f)) continue;
        (merged ??= filterFields.value.slice()).push(f);
        present.add(f);
      }
      if (merged) filterFields.value = merged;
    }

    lastEmittedUrl = serializeStateForUrl();

    // Release after flush so per-mutator watchers see the guard. Mount path
    // doesn't schedule — the urlQueryReady-gate watcher owns the initial query.
    void nextTick(() => {
      hydratingFromUrl = false;
      if (wasQueryDetected && !queryOpts?.blockQuery && tableDef.value !== null) {
        scheduleQuery();
      }
    });
  }

  // ── Watchers that schedule queries ──────────────────────────────────────
  // Filter / search are noisy — debounce the actual query but flag mustRefresh
  // + reset pagination synchronously so the pagination watcher doesn't double-fire.
  const debouncedFilterQuery = debounce(() => {
    if (queryDetected) scheduleQuery();
  }, FILTER_DEBOUNCE_MS);

  watch([() => filters.value, () => searchTerm.value], () => {
    if (hydratingFromUrl) return;
    if (!queryDetected) return;
    mustRefresh.value = true;
    resetPagination();
    debouncedFilterQuery();
  });

  watch(
    () => sorters.value,
    (next, prev) => {
      if (hydratingFromUrl) return;
      if (sortersEqual(prev, next)) return;
      // Rule 3: ANY sorter write during an active search is explicit intent —
      // stop suppressing sorters for the current search session. Uniform for
      // header click / config dialog / preset apply / programmatic writes.
      if (searchTerm.value) setIgnoreSortersInternal(false);
      if (!queryDetected) return;
      requestRefresh();
    },
    { immediate: false },
  );

  // Rule 4: a NEW search session (empty → non-empty) resets the runtime
  // relevance flag to the configured default. Clearing the search just ends
  // the session — sorters resume being emitted, the flag is left as-is.
  watch(
    () => searchTerm.value,
    (next, prev) => {
      if (hydratingFromUrl) return;
      if (!prev && next) setIgnoreSortersInternal(ignoreSortersDefault);
    },
  );

  // The runtime flag is a model — an external writer (v-model, devtools,
  // toolbar toggle) re-queries through this watcher. Rule-driven internal
  // flips are counter-suppressed: their triggering mutation already schedules
  // the query with the flipped flag visible (queries build state at run time).
  watch(
    () => ignoreSortersWhenSearched.value,
    () => {
      if (internalIgnoreSortersWrite) return;
      if (hydratingFromUrl) return;
      if (!queryDetected) return;
      if (!searchTerm.value) return; // no query effect without an active search
      requestRefresh();
    },
  );

  watch(
    () => columnNames.value,
    (next, prev) => {
      if (!queryDetected) return;
      if (sameColumnSet(prev, next)) return;
      requestRefresh();
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
      if (hydratingFromUrl) return;
      if (next.page === prev.page && next.itemsPerPage === prev.itemsPerPage) return;
      if (!queryDetected) return;
      scheduleQuery();
    },
  );

  // URL emitter runs regardless of `queryDetected` so pre-query mutations
  // (bootstrap / hydration) still reflect in the URL.
  watch(
    [
      () => filters.value,
      () => sorters.value,
      () => searchTerm.value,
      () => pagination.value,
      () => ignoreSortersWhenSearched.value,
    ],
    () => emitUrlIfChanged(),
  );

  watch(
    () => includeActions.value,
    () => {
      if (!queryDetected) return;
      requestRefresh();
    },
  );

  // Each gate falls open (`?? true`) when its feature isn't wired, so the
  // bootstrap fires as soon as tableDef has loaded.
  const presetGateOpen = () => (opts.preset?.presetsHandle ? presetInternals.gate.value : true);
  watch(
    [() => tableDef.value, () => queryOpts?.urlQueryReady?.value ?? true, presetGateOpen],
    ([def, urlReady, presetReady]) => {
      if (queryDetected) return;
      if (def === null || !urlReady || !presetReady) return;
      if (queryOpts?.queryOnMount === false) return;
      if (allColumns.value.length === 0) return;
      if (results.value.length !== 0) return;
      queryDetected = true;
      scheduleQuery("initial");
    },
  );

  onScopeDispose(() => {
    debouncedFilterQuery.cancel();
    disposeDebounces();
    // Resolve any pending dialog so awaiters don't hang on teardown.
    promptSlot.dismiss();
    formSlot.dismiss();
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
        columnNames.value = def.columns.map((c) => c.path);
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
    flatMap: new Map(),
    fetchableFields: new Set(opts.columns.map((c) => c.path)),
    primaryKeys: [],
    preferredId: [],
    crud: { query: [], pages: [], one: [] },
    canRemove: false,
    actions: { table: [], row: [], rows: [], default: {} },
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
