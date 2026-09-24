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
  cellAsString,
  debounce,
  DEV,
  arraysEqual,
  filterExprFields,
  filterExprKey,
  isFilled,
  mergeDisplayColumns,
  mergeSorters,
  normalizeResidualFilters,
  prunePresetSnapshot,
  pruneResidualFilters,
  reconcileColumnWidthDefaults,
  gateOwns,
  residualGateOwns,
  resolveAspectGate,
  sameColumnSet,
  sortRowsLocally,
  sortersEqual,
  stateToUrlQueryString,
  urlQueryStringToState,
  type ColumnWidthsMap,
  type DisplayColumnDef,
  type FieldFilters,
  type FilterCondition,
  type KnownFields,
  type QueryOptions,
  type UnsupportedFilter,
  type UrlQuerySync,
} from "@atscript/ui-table";
import type { Client, PageResult } from "@atscript/db-client";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type {
  ActionFormRequest,
  ActionResult,
  ApplyUrlQueryOptions,
  ConfigTab,
  ConfirmOptions,
  ConfirmRequest,
  DroppedFieldsReport,
  MainActionRequest,
  QueryErrorKind,
  ReactiveTableState,
  RowActionsConfig,
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
import { compileRowActionsConfig } from "./state/row-actions-config";
import { collectIdentifiers, triggerAction, type PromptCtx } from "./state/intent-scope";
import { getCellValue } from "../utils/get-cell-value";
import type { UseLocalDraftReturn } from "./use-local-draft";
import type { UsePresetsReturn } from "./use-presets";
import type { PresetAspect, SystemPreset } from "@atscript/ui-table";

const TABLE_KEY = "__as_table";
const FILTER_DEBOUNCE_MS = 500;
const DEFAULT_BLOCK_SIZE = 100;
const DEFAULT_DRAG_RELEASE_DEBOUNCE_MS = 300;
const DEFAULT_ITEMS_PER_PAGE = 25;

let _tblUid = 0;

/** Shared empty sorter list — keeps `splitSorters` identity-stable. */
const EMPTY_SORTERS: SortControl[] = Object.freeze([]) as unknown as SortControl[];

/**
 * Build the value reader used for in-memory sorting: a display column's
 * `sortValue(row)` wins for its own key, everything else reads the row by
 * path. Returns `getCellValue` itself when no display column defines one.
 */
function createSortValueReader(
  display?: readonly DisplayColumnDef[],
): (row: Record<string, unknown>, field: string) => unknown {
  const map = new Map<string, (row: Record<string, unknown>) => unknown>();
  for (const d of display ?? []) if (d.sortValue) map.set(d.key, d.sortValue);
  if (map.size === 0) return getCellValue;
  return (row, field) => {
    const fn = map.get(field);
    return fn ? fn(row) : getCellValue(row, field);
  };
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

/** Per-call overrides for `state.buildQuery()`. Since 0.1.134. */
export interface BuildQueryOptions {
  /**
   * Column paths to project instead of the visible ones. Client-owned
   * (`local`) columns are dropped from the result either way.
   */
  columnPaths?: string[];
  /** Override the `$actions` opt-in (default: whatever the renderer asked for). */
  includeActions?: boolean;
}

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
  /**
   * Always-applied Uniquery filter expression (AND'd with user filters).
   * App-authored, so never pruned of fields the caller cannot see — keep it
   * to fields every role reads, or the query is rejected.
   */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). Never pruned, like `forceFilters`. */
  forceSorters?: SortControl[];
  /**
   * Leaf field paths always added to `$select` (deduped, gated by available
   * meta), regardless of which columns are visible. Additive only.
   */
  alwaysSelected?: string[];
  /**
   * When true, all triggers (query/queryNext/loadRange) early-return. Pass a
   * getter (or a ref) to keep it reactive: when it flips back to `false` the
   * table runs the query it was holding back, once. Since 0.1.133.
   */
  blockQuery?: boolean | (() => boolean);
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
   * The query function already returns its rows ordered by every active
   * sorter, so `applyLocalSort` must not re-order the page on top of it. Set
   * by the in-memory (`createStaticTableState`) path. Since 0.1.134.
   */
  preSorted?: boolean;
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
  /**
   * Receives each piece of a restored URL's filter that field filters cannot
   * express (a cross-field OR, an unknown operator, …) and that was left out
   * of the restored state — the table then shows a broader result than the
   * link described. When omitted, each one is reported with a dev-mode
   * `console.warn`. Since 0.1.139.
   *
   * Since 0.1.140 such pieces are carried as `residualFilters` instead
   * whenever every field they reference is a server-backed column (and
   * `urlQuerySync.residual` is not `false`); only the rest are reported.
   */
  onUnsupportedFilter?: (issue: UnsupportedFilter) => void;
  /**
   * Receives what the table left out because it names a field outside the
   * columns this caller can use — a column hidden from their role, or gone
   * from the schema. Presets (with the local draft) and restored URLs are
   * pruned instead of failing the query; one report per apply, only when
   * something was dropped. Anything else the query leaves out without a
   * report. When omitted, each report is a dev-mode `console.warn`.
   * Since 0.1.141.
   */
  onFieldsDropped?: (report: DroppedFieldsReport) => void;
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
  /** Aspects a system preset owns; intersected with `availableAspects`, default all. */
  systemAspects?: PresetAspect[];
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
  /**
   * Client-owned columns merged into the server's column list. Captured once
   * at setup — to change the set, re-mount. Since 0.1.134.
   */
  displayColumns?: readonly DisplayColumnDef[];
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
  /**
   * The request a dialog SURFACE renders: the last non-null `ref` value, kept
   * alive after `ref` is nulled. `ref` empties the instant the user answers,
   * but the dialog stays mounted until its exit animation ends — rendering
   * `ref` there blanks the copy while the dialog is still visibly fading out.
   */
  display: Ref<(TBody & { resolve: (value: TResolved) => void }) | null>;
  request: (body: TBody) => Promise<TResolved>;
  accept: (value: TResolved) => void;
  dismiss: () => void;
  /**
   * Drop the retained `display` once the surface has left. A no-op while a
   * request is pending, so a late release from a previous exit cycle can
   * never wipe a request raised while the old surface was still leaving.
   */
  release: () => void;
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
  const display = shallowRef<Req | null>(null) as Ref<Req | null>;
  function request(body: TBody): Promise<TResolved> {
    if (r.value) {
      r.value.resolve(cancelValue);
      r.value = null;
    }
    const promise = new Promise<TResolved>((resolve) => {
      r.value = { ...body, resolve } as Req;
    });
    display.value = r.value;
    return promise;
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
  function release() {
    if (r.value === null) display.value = null;
  }
  return { ref: r, display, request, accept, dismiss, release };
}

// The URL baseline is copied in and out, so a caller that edits a model entry
// in place cannot reach it.
const cloneConditions = (conds: FilterCondition[]): FilterCondition[] =>
  conds.map((c) => ({ type: c.type, value: [...c.value] }));
const cloneSorter = (s: SortControl): SortControl => ({ field: s.field, direction: s.direction });

/** Same residual conditions, in the same (canonical) order. */
function sameResidualFilters(a: FilterExpr[], b: FilterExpr[]): boolean {
  return arraysEqual(a.map(filterExprKey), b.map(filterExprKey));
}

/**
 * The report for a restored URL's filter piece when nobody handles it
 * (`onUnsupportedFilter` / `@unsupported-filter`): a dev-mode warning.
 */
export function warnUnsupportedFilter(issue: UnsupportedFilter): void {
  if (!DEV) return;
  console.warn(
    `[vue-table] URL filter left out (${issue.reason}): ${JSON.stringify(issue.expr)}. ` +
      "Field filters cannot express it, so the table shows more rows than the URL described.",
  );
}

/**
 * The report for fields the table left out when nobody handles it
 * (`onFieldsDropped` / `@fields-dropped`): a dev-mode warning.
 */
export function warnFieldsDropped(report: DroppedFieldsReport): void {
  if (!DEV) return;
  const from = report.presetId ? `${report.source} "${report.presetId}"` : report.source;
  console.warn(
    `[vue-table] Left out fields this table cannot use (${from}): ${report.fields.join(", ")}.`,
  );
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
  const rowActions = ref<RowActionsConfig | undefined>(undefined);
  /**
   * The per-screen row-action policy, compiled once per config change instead
   * of once per row per render — and read by every surface that renders row
   * actions, so the cell and the selection toolbar can't drift apart.
   */
  const rowActionsPolicy = computed(() => compileRowActionsConfig(rowActions.value));

  const filters = shallowRef<FieldFilters>({});
  const residualFilters = shallowRef<FilterExpr[]>([]);
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

  /**
   * The paths the table can use, from its column list: every column, and the
   * server-backed ones. `null` until the table definition loads. Presets,
   * drafts, URLs and the query itself are all pruned against it.
   */
  const knownFields = computed<KnownFields | null>(() => {
    const all = allColumns.value;
    if (all.length === 0) return null;
    const columns = new Set<string>();
    const server = new Set<string>();
    for (const c of all) {
      columns.add(c.path);
      if (!c.local) server.add(c.path);
    }
    return { columns, server };
  });

  function reportFieldsDropped(report: DroppedFieldsReport): void {
    (queryOpts?.onFieldsDropped ?? warnFieldsDropped)(report);
  }

  const { slice: presetSlice, internals: presetInternals } = createPresetState({
    columnNames,
    columnWidths,
    filterFields,
    filters,
    residualFilters,
    sorters,
    pagination,
    allColumns,
    presetsHandle: opts.preset?.presetsHandle,
    draftHandle: opts.preset?.draftHandle,
    availableAspects: opts.preset?.availableAspects,
    systemAspects: opts.preset?.systemAspects,
    persistDrafts: opts.preset?.persistDrafts,
    fallbackSystemPresets: opts.preset?.fallbackSystemPresets,
    knownFields,
    onFieldsDropped: reportFieldsDropped,
  });
  presetInternals.bootstrap();

  // ── Request slots: prompt + action-form dialogs ─────────────────────────
  const promptSlot = createRequestSlot<Omit<ConfirmRequest, "resolve">, boolean>(false);
  const confirmRequest = promptSlot.ref;
  function promptFn(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return promptSlot.request({ ...opts, message });
  }
  const confirmDisplay = promptSlot.display;
  const acceptPrompt = () => promptSlot.accept(true);
  const dismissPrompt = promptSlot.dismiss;
  const releaseConfirm = promptSlot.release;

  const formSlot = createRequestSlot<Omit<ActionFormRequest, "resolve">, unknown>(null);
  const actionFormRequest = formSlot.ref;
  function requestActionInput(action: TVueTableActionInfo, ctx: PromptCtx): Promise<unknown> {
    return formSlot.request({
      action,
      identifiers: ctx.identifiers,
      preferredId: ctx.preferredId,
    });
  }
  const actionFormDisplay = formSlot.display;
  const acceptActionForm = formSlot.accept;
  const dismissActionForm = formSlot.dismiss;
  const releaseActionForm = formSlot.release;

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

  /**
   * Paths of client-owned columns — they have no server field behind them, so
   * they are stripped from `$select` and from `$sort`. Recomputed only when
   * the column set changes.
   */
  const localColumnPaths = computed(() => {
    const out = new Set<string>();
    const known = knownFields.value;
    if (known) for (const p of known.columns) if (!known.server.has(p)) out.add(p);
    return out;
  });

  /**
   * The active sorters split by who applies them: `server` goes into `$sort`,
   * `local` targets a client-owned column and is applied in memory. One pass,
   * one dependency — the two halves are complements.
   */
  const splitSorters = computed<{ local: SortControl[]; server: SortControl[] }>(() => {
    const paths = localColumnPaths.value;
    if (paths.size === 0) return { local: EMPTY_SORTERS, server: sorters.value };
    const local: SortControl[] = [];
    const server: SortControl[] = [];
    for (const s of sorters.value) (paths.has(s.field) ? local : server).push(s);
    return { local, server };
  });

  /** `true` while the query deliberately drops user sorters to keep search relevance. */
  function sortersIgnored(): boolean {
    return ignoreSortersWhenSearched.value && !!searchTerm.value;
  }

  /** Reads the value a sorter orders by — a display column's `sortValue` wins. */
  const sortValueOf = createSortValueReader(opts.displayColumns);

  function applyLocalSort<T extends Record<string, unknown>>(rows: T[]): T[] {
    // A query function that owns its ordering (static/local mode) has already
    // sorted the whole dataset by every sorter — re-sorting the page here
    // would repeat the work and, past page 1, contradict it.
    if (queryOpts?.preSorted) return rows;
    if (splitSorters.value.local.length === 0 || sortersIgnored()) return rows;
    // Sort by the FULL sorter list, in the same merge order the query uses:
    // the server already ordered the page by its own fields, so those are a
    // no-op tiebreak here, and a local sorter slots in at its real priority
    // instead of overriding everything before it.
    const merged = queryOpts?.forceSorters?.length
      ? mergeSorters(queryOpts.forceSorters, sorters.value)
      : sorters.value;
    return sortRowsLocally(rows, merged, sortValueOf);
  }

  /**
   * The query's view of the model, gated to the fields this caller can use.
   * This is the guarantee that no table state sends a field the server does
   * not expose: presets and URLs are pruned on apply, but `setFieldFilter`,
   * `addFilterField`, `v-model` writes, `setResidualFilters` and the like
   * write straight to the model. `$select` is gated by the column list
   * (`knownFields.columns`, then client-owned columns are stripped); filters
   * and residual conditions by the server-backed columns. `forceFilters` /
   * `forceSorters` are app-authored and never gated. Memoized: pages,
   * window blocks and exports reuse it.
   */
  const queryModel = computed(() => {
    const model = {
      columnNames: columnNames.value,
      filters: filters.value,
      sorters: splitSorters.value.server,
      residual: residualFilters.value,
      stripped: [] as string[],
    };
    const known = knownFields.value;
    if (!known) return model;
    const { snapshot, dropped } = prunePresetSnapshot(
      {
        columns: { columnNames: model.columnNames },
        filterOps: model.filters,
        sorters: model.sorters,
      },
      known,
    );
    const residual = pruneResidualFilters(model.residual, known.server);
    return {
      // Gated in `buildCurrentQuery` with any `columnPaths` override, and
      // never widened to every column the way a preset's names are.
      columnNames: model.columnNames,
      filters: snapshot.filterOps!,
      sorters: snapshot.sorters!,
      residual: residual.kept,
      stripped: [...new Set([...(dropped?.fields ?? []), ...(residual.dropped?.fields ?? [])])],
    };
  });

  /** Stripped path sets already warned about — one dev warning per set. */
  const warnedStripped = new Set<string>();

  function buildCurrentQuery(buildOpts?: BuildQueryOptions): Uniquery {
    // narrowed-meta gate over the server-returnable field set (`fetchableFields`,
    // includes `@ui.table.exclude` fields that are never columns). Falls back to
    // the column paths when a synthetic def carries no `fetchableFields`.
    const available: ReadonlySet<string> =
      tableDef.value?.fetchableFields ?? knownFields.value?.columns ?? new Set<string>();
    const extra = new Set<string>();
    for (const c of columns.value) // selectWith: VISIBLE columns only
      for (const p of c.selectWith ?? []) if (available.has(p)) extra.add(p);
    if (queryOpts?.alwaysSelected)
      // alwaysSelected: same gate
      for (const p of queryOpts.alwaysSelected) if (available.has(p)) extra.add(p);
    const model = queryModel.value;
    if (DEV && model.stripped.length > 0) {
      const key = model.stripped.join(",");
      if (!warnedStripped.has(key)) {
        warnedStripped.add(key);
        console.warn(
          `[vue-table] Query leaves out fields this table cannot use: ${model.stripped.join(", ")}.`,
        );
      }
    }
    const known = knownFields.value;
    const localPaths = localColumnPaths.value;
    const requested = buildOpts?.columnPaths ?? model.columnNames;
    const visibleColumnPaths = requested.filter(
      (p) => !localPaths.has(p) && (!known || known.columns.has(p)),
    );
    return buildTableQuery({
      visibleColumnPaths,
      extraSelect: extra.size ? [...extra] : undefined,
      sorters: model.sorters,
      forceSorters: queryOpts?.forceSorters,
      filters: model.filters,
      residualFilters: model.residual,
      forceFilters: queryOpts?.forceFilters,
      search: searchTerm.value || undefined,
      ignoreSorters: sortersIgnored(),
      includeActions: buildOpts?.includeActions ?? includeActions.value,
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

  /**
   * Whether a sorter on a client-owned column does anything right now — the
   * one rule every surface that renders a sort affordance reads, so the
   * header and the config dialog cannot disagree about it.
   *
   * Sorting a client-owned column happens in memory over the loaded page.
   * Window mode has no page: it caches rows by absolute index and drops them
   * as the viewport moves, so behind a server fetcher the order would shift
   * under the user as they scrolled. `preSorted` is the case where it would
   * not — the in-memory provider orders the whole dataset before it slices,
   * so every absolute index arrives already in place.
   */
  const localSortAvailable = computed(() => navMode.value !== "window" || !!queryOpts?.preSorted);

  // ── Sub-factories (constructed in dependency order) ─────────────────────
  // `blockQuery` is reactive — a table mounted while blocked must run its
  // first query as soon as the host unblocks it.
  const isQueryBlocked = computed(() => {
    const blocked = queryOpts?.blockQuery;
    return typeof blocked === "function" ? !!blocked() : !!blocked;
  });

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
    isQueryBlocked: () => isQueryBlocked.value,
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
  const selection = createSelectionApi(selectionOpts, getActiveRow, activeIndex);
  const {
    selectedRows,
    selectedCount,
    rowValueFn,
    isPkSelected,
    rowSelectable,
    isRowSelectable,
    selectableRows,
    selectableCount,
    selectAll,
    toggleActiveSelection,
  } = selection;

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
  async function runQuery(kind: QueryErrorKind, silent = false) {
    if (isQueryBlocked.value) return;
    mustRefresh.value = false;
    // Snap viewport back to top on a non-initial query so we don't render
    // past the new dataset's end after the cache wipe. Skipped for a silent
    // refresh — it must not disturb the user's current scroll position.
    if (!silent && kind !== "initial" && topIndex.value !== 0) {
      topIndex.value = 0;
    }
    const thisGen = ++generation;
    clearSettlements();
    if (!silent) querying.value = true;
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
      if (silent) return;
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
  // A coalesced batch is silent only while EVERY scheduled query in it is
  // silent; the first loud schedule flips it false ("loud wins"), so a user
  // query landing in the same tick as a silent refresh still shows its spinner.
  let pendingSilent = true;
  let queryFlushScheduled = false;

  function scheduleQuery(kind: QueryErrorKind = "query", opts?: QueryOptions): void {
    if (isQueryBlocked.value) return;
    if (tableDef.value === null) return;
    pendingScheduledKind = pendingScheduledKind ?? kind;
    // `opts?.silent ?? false` (NOT `if (opts)`): `query` may be wired straight
    // to `@click`, which passes a MouseEvent as `opts` — its absent `silent`
    // correctly reads as a loud query.
    if (!(opts?.silent ?? false)) {
      pendingSilent = false;
      querying.value = true;
    }
    if (queryFlushScheduled) return;
    queryFlushScheduled = true;
    queueMicrotask(() => {
      queryFlushScheduled = false;
      const k = pendingScheduledKind;
      const s = pendingSilent;
      pendingScheduledKind = null;
      pendingSilent = true;
      if (k === null) return;
      if (tableDef.value === null) return;
      void runQuery(k, s);
    });
  }

  function query(opts?: QueryOptions): void {
    scheduleQuery("query", opts);
  }

  function requestRefresh(): void {
    mustRefresh.value = true;
    scheduleQuery();
  }

  async function queryImmediate(opts?: QueryOptions): Promise<void> {
    pendingScheduledKind = null;
    pendingSilent = true;
    if (isQueryBlocked.value) return;
    if (tableDef.value === null) return;
    await runQuery("query", opts?.silent ?? false);
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

  function setResidualFilters(exprs: FilterExpr[]): void {
    const next = normalizeResidualFilters(exprs);
    if (!sameResidualFilters(next, residualFilters.value)) residualFilters.value = next;
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
    residualFilters,
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
    rowSelectable,
    isRowSelectable,
    selectableRows,
    selectableCount,
    selectAll,
    rowDelete,
    rowActions,
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
    confirmDisplay,
    prompt: promptFn,
    acceptPrompt,
    dismissPrompt,
    releaseConfirm,
    actionFormRequest,
    actionFormDisplay,
    requestActionInput,
    acceptActionForm,
    dismissActionForm,
    releaseActionForm,

    query,
    queryImmediate,
    queryNext,
    loadRange,
    invalidate,
    buildQuery: buildCurrentQuery,
    fetchPage: dispatchPages,
    localColumnPaths,
    applyLocalSort,
    localSortAvailable,
    rowActionsPolicy,
    dataAt,
    loadingAt,
    errorAt,
    resetFilters() {
      if (Object.keys(filters.value).length > 0) filters.value = {};
      if (residualFilters.value.length > 0) residualFilters.value = [];
    },
    setResidualFilters,
    removeResidualFilter(index: number) {
      const list = residualFilters.value;
      if (index < 0 || index >= list.length) return;
      residualFilters.value = list.filter((_, i) => i !== index);
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
        residualFilters: residualFilters.value,
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

  const filtersGate = resolveAspectGate(urlQuerySync?.filters);
  const sortersGate = resolveAspectGate(urlQuerySync?.sorters);
  // Residual conditions the URL owns — written and restored with it. The rest
  // (a private field inside, or residual sync off) never leave the table.
  const residualSync = urlQuerySync?.residual !== false;
  const urlOwnsResidual = (expr: FilterExpr) => residualSync && residualGateOwns(filtersGate, expr);

  // What a marker-less URL overlays: the URL-owned filters and sorters the
  // table booted with (preset, persisted drafts, props), captured once before
  // the first URL lands on them. Each such URL starts from here, not from the
  // current state — so Back to an app deep link restores the link as it was
  // opened, not the link plus whatever the user changed since. A preset the
  // user switches to later does not move it.
  let urlBaseline: {
    filters: FieldFilters;
    residual: FilterExpr[];
    sorters: SortControl[];
  } | null = null;
  function captureUrlBaseline(): void {
    if (urlBaseline) return;
    const owned: FieldFilters = {};
    for (const path in filters.value) {
      if (!gateOwns(filtersGate, path)) continue;
      owned[path] = cloneConditions(filters.value[path]);
    }
    urlBaseline = {
      filters: owned,
      residual: residualFilters.value.filter(urlOwnsResidual),
      sorters: sorters.value.filter((s) => gateOwns(sortersGate, s.field)).map(cloneSorter),
    };
  }

  // The URL the table starts from stands for its starting state — an empty
  // query overlays nothing — so that state is the echo baseline. Without it the
  // first mutation of an aspect the URL does not carry (an unsynced sorter)
  // would still write the bare `$snapshot` marker. Primed once the bootstrap
  // gate opens (a deep link has primed it already by then, to the same value);
  // the overlay baseline is taken there too when no URL came in first.
  if (queryOpts?.onUrlQueryChange) {
    const gate = queryOpts.urlQueryReady;
    if (!gate || gate.value) lastEmittedUrl = serializeStateForUrl();
    else {
      const stop = watch(
        () => gate.value,
        () => {
          captureUrlBaseline();
          lastEmittedUrl = serializeStateForUrl();
          stop();
        },
        { flush: "sync" },
      );
    }
  }

  function applyUrlQuery(urlString: string, opts?: ApplyUrlQueryOptions): void {
    captureUrlBaseline();
    if (urlsEquivalent(urlString, lastEmittedUrl)) return;
    // Client-owned columns are not the URL's: no server query can filter on
    // them, so a piece correlating one with a server column is reported.
    const known = knownFields.value;
    const parsed = urlQueryStringToState(urlString, {
      knownFields: known?.server,
      localFields: known ? localColumnPaths.value : undefined,
      sync: urlQuerySync,
    });
    // Pieces field filters cannot hold arrive as `residual`; the rest of the
    // left-out ones are lost — the table shows more rows than the link says.
    for (const issue of parsed.unsupported ?? []) {
      (queryOpts?.onUnsupportedFilter ?? warnUnsupportedFilter)(issue);
    }
    // Pieces on fields this caller cannot use are dropped and reported, never
    // sent. The address bar keeps the link as it came until the next change.
    if (parsed.unknown || parsed.unknownSorters) {
      const residual = parsed.unknown?.map((u) => u.expr) ?? [];
      const sorters = parsed.unknownSorters ?? [];
      const fields = new Set(parsed.unknown?.flatMap((u) => u.fields));
      for (const s of sorters) fields.add(s.field);
      reportFieldsDropped({
        source: "url",
        fields: [...fields],
        columns: [],
        filterFields: [],
        filters: {},
        residual,
        sorters,
      });
    }
    const urlResidual = parsed.residual ?? [];
    // A URL owns every path it mentions, in a field filter or inside a
    // residual condition — on overlay, the baseline's say on those goes.
    const residualPaths = new Set(urlResidual.flatMap((expr) => filterExprFields(expr)));
    // A `$snapshot` URL is complete: it replaces. Any other URL overlays the
    // baseline. An explicit `mode` overrides the marker either way.
    const replace = opts?.mode ? opts.mode === "replace" : parsed.snapshot === true;
    const base = replace ? null : urlBaseline!;

    // Round-trip stability when user changed page size locally: divide raw
    // `$skip` by the consumer's CURRENT `itemsPerPage`, not the default.
    const currentItemsPerPage = pagination.value.itemsPerPage;
    const skip = parsed.skip ?? 0;
    const nextPage =
      skip > 0 && currentItemsPerPage > 0 ? Math.floor(skip / currentItemsPerPage) + 1 : 1;

    const wasQueryDetected = queryDetected;
    hydratingFromUrl = true;

    // Both aspects start from the entries the URL does not own (the current
    // state's private ones) plus, on overlay, the baseline's owned ones; the
    // URL's entries go on top. So an owned entry the URL omits is cleared on
    // replace and falls back to the baseline on overlay.
    if (filtersGate !== "none") {
      const next: FieldFilters = {};
      // Current keys first, so a key that stays keeps its slot — the order of
      // filter keys is observable (it sets the `$and` clause order of the
      // built query and of the emitted URL).
      const fromBase = (path: string) => !!base?.filters[path] && !residualPaths.has(path);
      for (const path in filters.value) {
        if (!gateOwns(filtersGate, path)) next[path] = filters.value[path];
        else if (fromBase(path)) next[path] = cloneConditions(base!.filters[path]);
      }
      if (base) {
        for (const path in base.filters) {
          if (fromBase(path)) next[path] ??= cloneConditions(base.filters[path]);
        }
      }
      for (const path in parsed.filters) next[path] = parsed.filters[path];
      filters.value = next;
    }

    // Residual conditions: the private ones stay, the baseline's (on overlay,
    // minus any on a path the URL mentions) and the URL's are laid on top.
    if (residualSync) {
      const mentioned = new Set([...Object.keys(parsed.filters), ...residualPaths]);
      const next = residualFilters.value.filter((expr) => !urlOwnsResidual(expr));
      if (base) {
        for (const expr of base.residual) {
          if (!filterExprFields(expr).some((f) => mentioned.has(f))) next.push(expr);
        }
      }
      next.push(...urlResidual);
      setResidualFilters(next);
    }

    // Same, keyed on `SortControl.field`. Appending the URL's sorters last
    // means its ordering wins over the entries it starts from.
    let urlSortersChanged = false;
    if (sortersGate !== "none") {
      const urlSortFields = new Set(parsed.sorters.map((s) => s.field));
      const start = sorters.value.filter((s) => !gateOwns(sortersGate, s.field));
      if (base) start.push(...base.sorters.map(cloneSorter));
      const merged = [...start.filter((s) => !urlSortFields.has(s.field)), ...parsed.sorters];
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
      if (wasQueryDetected && !isQueryBlocked.value && tableDef.value !== null) {
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

  watch([() => filters.value, () => residualFilters.value, () => searchTerm.value], () => {
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
      // A sorter that only targets a client-owned column never reaches the
      // server — `applyLocalSort` re-orders the loaded page instead, so a
      // refetch would send the identical query.
      const paths = localColumnPaths.value;
      if (paths.size > 0) {
        const keep = (s: SortControl) => !paths.has(s.field);
        if (sortersEqual(prev.filter(keep), next.filter(keep))) return;
      }
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
      () => residualFilters.value,
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
    [
      () => tableDef.value,
      () => queryOpts?.urlQueryReady?.value ?? true,
      presetGateOpen,
      () => isQueryBlocked.value,
    ],
    ([def, urlReady, presetReady, blocked]) => {
      if (queryDetected) return;
      // Stay un-detected while blocked, so unblocking re-runs this bootstrap
      // instead of leaving the table empty forever.
      if (blocked) return;
      if (def === null || !urlReady || !presetReady) return;
      if (queryOpts?.queryOnMount === false) return;
      if (allColumns.value.length === 0) return;
      if (results.value.length !== 0) return;
      queryDetected = true;
      scheduleQuery("initial");
    },
  );

  // Unblocking a table that already ran at least one query replays the query
  // for whatever state changed while it was blocked. `scheduleQuery` coalesces
  // with the bootstrap watcher above, so an unblock costs exactly one fetch.
  watch(
    () => isQueryBlocked.value,
    (blocked) => {
      if (blocked || !queryDetected) return;
      if (tableDef.value === null) return;
      scheduleQuery();
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
      // Client-owned columns are merged in here so every downstream consumer
      // (widths, config dialog, presets, `columns`) sees one column list.
      const merged = mergeDisplayColumns(def.columns, opts.displayColumns ?? []);
      allColumns.value = merged;
      const reconciled = reconcileColumnWidthDefaults(merged, columnWidths.value);
      if (reconciled !== columnWidths.value) columnWidths.value = reconciled;
      if (columnNames.value.length === 0) {
        columnNames.value = merged.map((c) => c.path);
      }
      tableDef.value = def;
    },
    resetPagination,
  };

  return { state, internals };
}

export interface CreateStaticTableStateOptions {
  /**
   * All rows in the dataset. Sorting/searching is applied locally. Pass a
   * getter (or a ref) to keep it reactive — every local "fetch" re-reads it,
   * so replacing the array and calling `state.query()` re-renders the table.
   */
  rows: MaybeRefOrGetter<Record<string, unknown>[]>;
  /** Columns to render. Used to synthesize a minimal `TableDef`. */
  columns: ColumnDef[];
  /** Field paths matched (substring, case-insensitive) by `searchTerm`. */
  searchPaths?: string[];
  /** Selection settings. */
  selection?: TableSelectionOptions;
  /** Default page size (`pagination.itemsPerPage`). */
  limit?: number;
  /**
   * Sort `rows` in memory from the active sorters (default `true`). Set
   * `false` when `rows` already arrives in the order it should render and the
   * header's sort affordance is purely cosmetic. Since 0.1.134.
   */
  localSort?: boolean;
  /** Client-owned columns merged into `columns`. Since 0.1.134. */
  displayColumns?: readonly DisplayColumnDef[];
  /** External refs from `defineModel` — same contract as `createTableState`. Since 0.1.134. */
  model?: TableModelRefs;
  /** Auto-query once the synthetic definition is in place (default: true). Since 0.1.134. */
  queryOnMount?: boolean;
  /**
   * Action settings. Only the client-free parts apply — there is no client to
   * invoke a server action with. Since 0.1.134.
   */
  actions?: TableActionsOptions;
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
  // The real fetcher is built once, on first use — it memoizes the sorted
  // dataset, which a per-call rebuild would throw away.
  let _state: ReactiveTableState | null = null;
  let fetcher: QueryFn | null = null;
  const queryFn: QueryFn = (q, page, size) => {
    if (!_state) {
      return Promise.resolve({ data: [], count: 0, page, itemsPerPage: size, pages: 1 });
    }
    fetcher ??= buildStaticQueryFn(opts, _state);
    return fetcher(q, page, size);
  };
  const result = createTableState({
    client: {} as Client,
    selection: opts.selection,
    limit: opts.limit,
    displayColumns: opts.displayColumns,
    model: opts.model,
    actions: opts.actions,
    // `preSorted`: the query function below sorts the whole dataset by every
    // sorter, so the renderer must not re-sort the page on top of it.
    query: { fn: queryFn, queryOnMount: opts.queryOnMount, preSorted: true },
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
  const sortValueOf = createSortValueReader(opts.displayColumns);

  // Sorting the whole dataset is the expensive half, and it only changes when
  // the row array or the sorter list is replaced — so a keystroke re-filters
  // but never re-sorts.
  let sortedFrom: Row[] | null = null;
  let sortedBy: readonly SortControl[] | null = null;
  let sorted: Row[] = [];
  function sortedRows(all: Row[]): Row[] {
    const by = state.sorters.value;
    if (all !== sortedFrom || by !== sortedBy) {
      sorted = sortRowsLocally(all, by, sortValueOf);
      sortedFrom = all;
      sortedBy = by;
    }
    return sorted;
  }

  return (_query, page, size) => {
    const all: Row[] = toValue(opts.rows);
    // Sort first, filter second — filtering preserves order, so the sorted
    // array survives every keystroke.
    let filtered = opts.localSort === false ? all : sortedRows(all);
    const term = state.searchTerm.value.trim().toLowerCase();
    if (term && searchPaths.length > 0) {
      filtered = filtered.filter((row) =>
        searchPaths.some((p) => cellAsString(getCellValue(row, p)).toLowerCase().includes(term)),
      );
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
