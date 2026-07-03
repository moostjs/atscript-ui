import type { Component, ShallowRef, Ref, ComputedRef } from "vue";
import type {
  ClientError,
  TDbActionInfo,
  TDbActionProcessor,
  TDbDeleteResult,
} from "@atscript/db-client";

/** UI-side sentinel for the synthesised row-delete processor. */
export const REMOVE_PROCESSOR = "__remove";
/** Column `path` and cell-type for the synthesised row-actions pseudo-column. */
export const ROW_ACTIONS_PATH = "__actions";
export const ROW_ACTIONS_TYPE = "__actions";

/**
 * Action descriptor used everywhere in vue-table. Widens `processor` to admit
 * the UI-side `__remove` sentinel without leaking into db-client.
 */
export type TVueTableActionInfo = Omit<TDbActionInfo, "processor"> & {
  processor: TDbActionProcessor | typeof REMOVE_PROCESSOR;
};

/** Per-call options for `state.actions.invoke`. */
export interface InvokeOpts {
  /**
   * Skip the post-success `state.query()` refresh for this call. Default:
   * respect the `:refreshOnAction` root prop.
   */
  suppressRefresh?: boolean;
  /** Originating user event — bridged to the AsTableRoot @action emit. */
  event?: KeyboardEvent | MouseEvent;
  /**
   * `@InputForm` payload for actions whose `inputForm` field is set. Wrapped
   * by the client into the request envelope's `input` field. Omit for
   * actions without a form.
   */
  input?: unknown;
}

/** Discriminated result returned by `state.actions.invoke`. Never throws. */
export type ActionResult =
  | { ok: true; kind: "backend"; data: unknown; message?: string }
  | { ok: true; kind: "navigate" }
  | { ok: true; kind: "custom"; dispatched: true }
  | { ok: true; kind: "remove"; data: TDbDeleteResult }
  | { ok: false; kind: "error"; error: ClientError | Error };

/** Reactive table-actions namespace exposed under `state.actions`. */
export interface TableActionsState {
  table: TVueTableActionInfo[];
  /** Includes the synthesised `__remove` when `:rowDelete` is opted in. */
  row: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
  default: {
    table?: TVueTableActionInfo;
    /** Never the synthesised `__remove`. */
    row?: TVueTableActionInfo;
    rows?: TVueTableActionInfo;
  };
  /**
   * Per-level lists with the declared default removed. Pre-computed once per
   * `tableDef`/`rowDelete` change so per-row / per-render consumers don't
   * re-filter against the same default action on every read.
   */
  others: {
    table: TVueTableActionInfo[];
    row: TVueTableActionInfo[];
    rows: TVueTableActionInfo[];
  };
  /**
   * Flattened action list rendered by the per-row `<AsRowActions>` cell:
   * `[default?, ...others.row, ...rows]`. Same for every row — pre-built on
   * the state so per-row cells don't re-derive it.
   */
  cellRow: TVueTableActionInfo[];
  /**
   * Invoke an action. `pk` is an identifier object (or array for `'rows'`)
   * built from `preferredId`. Per `@atscript/db-client` invariant #11 the
   * server rejects bare scalars — even single-field PK tables send
   * `{ id: '...' }`.
   */
  invoke: (
    action: TVueTableActionInfo,
    pk?: Record<string, unknown> | Record<string, unknown>[],
    opts?: InvokeOpts,
  ) => Promise<ActionResult>;
  /** Set of action names with an in-flight invoke. */
  invoking: ShallowRef<Set<string>>;
  /** Latest result keyed by action name. */
  lastResult: ShallowRef<Map<string, ActionResult>>;
}

/** Built-in row-delete configuration accepted by `<AsTableRoot :rowDelete>`. */
export interface RowDeleteOpt {
  label?: string;
  icon?: string;
  /**
   * Confirmation prompt shown by the in-app `AsConfirmDialog` (driven by
   * `state.prompt()`) before invoking. Pass `""` to skip the prompt.
   */
  confirm?: string;
  intent?: TDbActionInfo["intent"];
}

/** What Enter does when the keyboard-nav handler sees it. */
export type EnterAction = "main-action" | "toggle-select" | "passthrough";

/**
 * Per-call options for the keyboard-nav handler / bridge. `mode` is passed
 * by the caller because selection mode lives on the renderer's `:select`
 * prop, not on state — the renderer's keydown closes over `props.select`,
 * the search-input bridge passes the mode reader its consumer supplied.
 */
export interface NavKeyOptions {
  enterAction?: EnterAction;
  mode?: SelectionMode;
}

/** Pending request to emit `main-action`, written by handleNavKey and click handlers. */
export interface MainActionRequest {
  row: Record<string, unknown>;
  absIndex: number;
  event: KeyboardEvent | MouseEvent;
}

/**
 * Vunor scope names accepted by `state.prompt()`. The confirm button maps
 * `scope` → `scope-{name}` and the `c8-filled` chrome picks contrasting fg
 * automatically. Mirrors action intent semantics — pass `"error"` for
 * destructive ops, `"good"` for affirmations, etc.
 */
export type ConfirmScope = "primary" | "secondary" | "good" | "warn" | "error" | "neutral";

/**
 * Options for `state.prompt()`. Title is fixed (`"Confirmation"`); only the
 * body text and the two button labels are tunable. `scope` styles the
 * confirm button — destructive prompts pass `"error"`, etc.
 */
export interface ConfirmOptions {
  /** Override the confirm button label. Default: `"Confirm"`. */
  confirmButton?: string;
  /** Override the cancel button label. Default: `"Cancel"`. */
  cancelButton?: string;
  /** Vunor scope applied to the confirm button. Default: `"primary"`. */
  scope?: ConfirmScope;
}

/**
 * Internal pending-request shape held in `state.confirmRequest`. The default
 * `AsConfirmDialog` watches this ref; setting it opens the dialog,
 * resolving (via `state.acceptPrompt` / `state.dismissPrompt`) clears it.
 */
export interface ConfirmRequest extends ConfirmOptions {
  message: string;
  /** Internal — the dialog never calls this directly; use accept/dismiss. */
  resolve: (ok: boolean) => void;
}

/** Internal pending-request shape held in `state.actionFormRequest`. */
export interface ActionFormRequest {
  action: TVueTableActionInfo;
  /** Identifier objects for the targeted rows (used by `$1`/`$N` substitution in dialog copy). */
  identifiers: Record<string, unknown>[];
  preferredId: readonly string[];
  /** Internal — the dialog never calls this directly; use accept/dismiss. */
  resolve: (input: unknown) => void;
}

/**
 * Public bridge object exposed by `state.navBridge` (and by the slot prop
 * on `<AsTableRoot>`). Lets external `<input>`s drive table nav without
 * losing focus. Space, unmodified Home/End, and printable keys pass
 * through; modifier-arrow combinations are consumed.
 */
export interface TableNavBridge {
  onKeydown: (event: KeyboardEvent, opts?: NavKeyOptions) => void;
  activeIndex: Ref<number>;
  setActive: (absIndex: number) => void;
  clearActive: () => void;
}
import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import type {
  AspectMask,
  AsPresetEntryRow,
  ColumnWidthsMap,
  ConfigTab,
  FieldFilters,
  PresetAspect,
  PresetCapabilities,
  PresetSnapshot,
  SelectionMode,
  SystemPreset,
  SystemPresetInput,
  TableStateMethods,
} from "@atscript/ui-table";
export type { ConfigTab };

/**
 * Preset feature configuration passed to `useTable({ preset })` /
 * `<AsTableRoot :preset>`. Presence of this object enables the feature;
 * omit it entirely to disable. `app` defaults to `inject(AS_PRESETS_APP)`.
 */
export interface PresetConfig {
  /** Preset controller URL, e.g. `"/api/db/_presets"`. */
  url: string;
  /** Per-table identifier — scopes preset rows under `(app, tableKey)`. */
  tableKey: string;
  /** Optional override; defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  /** Consumer-supplied synthetic system presets (`sys:*` namespace, never persisted). */
  systemPresets?: SystemPresetInput[];
  /**
   * App-declared aspect set — render gate for picker checkboxes / dialog
   * badges + capture filter. Default `['columns','filters','filterOps','sorters']`.
   * Add `'itemsPerPage'` for paginated tables; drop any aspect this app doesn't use.
   */
  aspects?: PresetAspect[];
  /**
   * Opt-in localStorage overlay for the user's in-flight tweaks (default
   * `false`). Persists `columns` / `filters` / `sorters` / opt-in
   * `itemsPerPage`; `filterOps` / `searchTerm` / pagination are NOT persisted.
   */
  persistDrafts?: boolean;
}

export type QueryErrorKind = "initial" | "query" | "queryNext" | "loadRange";

/** Tri-state for the multi-select header checkbox. Window mode never reaches "all". */
export type SelectAllState = "none" | "some" | "all";

/** Controls which sections appear in the column header dropdown menu. */
export interface ColumnMenuConfig {
  sort?: boolean;
  filters?: boolean;
  hide?: boolean;
  /** Show "Reset width" entry. Renders only when the column's `w !== d`. */
  resetWidth?: boolean;
}

/**
 * Skin-slot override map for table chrome (header cells, column menu, filter
 * dialog, etc.). Unstyled defaults ship out of the box; users replace any
 * piece by passing a partial map via `<AsTableRoot :controls="...">`.
 *
 * For per-cell rendering, use `types` (cell-type dispatch) and `components`
 * (named overrides via `@ui.table.component "name"`) instead — this map
 * intentionally holds only the chrome, not the cell renderer.
 */
export interface TAsTableControls {
  // Cells & headers
  headerCell?: Component;
  columnMenu?: Component;
  /** Per-row actions cell — single button (1 action) or `…` dropdown (≥2 actions). */
  rowActions?: Component;

  // Filters
  filterInput?: Component;
  filterDialog?: Component;
  filterField?: Component;
  filterValueHelp?: Component;

  // Config
  configDialog?: Component;
  fieldsSelector?: Component;
  sortersConfig?: Component;

  /**
   * Prompt dialog rendered in response to `state.prompt()`. Replaces
   * `window.confirm()` for action prompts; the confirm button picks up the
   * caller's `scope` so destructive ops show in the error scope, etc.
   */
  confirmDialog?: Component;

  /**
   * Dialog rendered for actions that declare an `@InputForm` schema. Owns
   * the form-schema fetch + dialog chrome; the consumer fills the body via
   * `<AsTableRoot>`'s `#actionForm` slot (forwarded through to this dialog).
   */
  actionFormDialog?: Component;

  /** Tier-2 management dialog (rename / delete / public-toggle / favorite / default). */
  presetDialog?: Component;
}

/**
 * Cell-type → component dispatch map. Mirrors vue-form's `TAsTypeComponents`:
 * a typed map keyed by built-in cell types, with `Record<string, Component>`
 * to permit user-defined types.
 *
 * Use {@link createDefaultCellTypes} to get a pre-built map seeded with the
 * default `AsTableCellValue` for every built-in type.
 */
export type TAsCellTypeComponents = {
  text: Component;
  number: Component;
  boolean: Component;
  date: Component;
  /** Date + time-of-day. Defaulted to `<AsCellDate>`. */
  datetime?: Component;
  /** Relative time (`"3 hours ago"`). Defaulted to `<AsCellDate>`. */
  relative?: Component;
  array: Component;
  object: Component;
  enum: Component;
  ref: Component;
  /** Synthesised row-actions pseudo-column (`:rowActionsColumn` opt-in). */
  __actions?: Component;
} & Record<string, Component>;

/**
 * Reactive table state — Vue implementation of the framework-agnostic
 * TableStateData + TableStateMethods interfaces.
 *
 * Arrays/objects use ShallowRef (replaced wholesale, no deep reactivity).
 * Scalars use Ref for fine-grained updates.
 */
export interface ReactiveTableState extends TableStateMethods {
  tableDef: ShallowRef<TableDef | null>;
  /** True while the table metadata (TableDef) is being loaded. */
  loadingMetadata: Ref<boolean>;
  columnNames: ShallowRef<string[]>;
  columns: ComputedRef<ColumnDef[]>;
  allColumns: ShallowRef<ColumnDef[]>;
  /**
   * Per-column widths keyed by column path; always populated for every column.
   * Each entry: `{ w: currentRenderedWidth, d: defaultWidth }`. Deep-reactive —
   * writers mutate `entry.w` directly. Default is the `@ui.table.width` annotation
   * when present, otherwise type+`@expect.maxLen`-derived (see `computeDefaultColumnWidth`).
   */
  columnWidths: Ref<ColumnWidthsMap>;
  filterFields: ShallowRef<string[]>;
  filters: ShallowRef<FieldFilters>;
  sorters: ShallowRef<SortControl[]>;
  results: ShallowRef<Record<string, unknown>[]>;
  /** Absolute index where `results[0]` sits. */
  resultsStart: Ref<number>;
  /** Universal cache of every loaded row keyed by absolute index. */
  windowCache: ShallowRef<Map<number, Record<string, unknown>>>;
  /** Block firstIndex values currently being fetched by `loadRange`. */
  windowLoading: ShallowRef<Set<number>>;
  /** Absolute index at the top of a windowed renderer's viewport. */
  topIndex: Ref<number>;
  /** Number of fixed-pool rows a windowed renderer is displaying. */
  viewportRowCount: Ref<number>;
  /**
   * Nav-only viewport row count (standalone `<AsTable>` writes this so
   * PageUp/PageDown step by the visible row count). Window mode keeps
   * writing `viewportRowCount`; `pageStep()` reads `max(viewportRowCount,
   * navViewportRowCount, 10) - 1`.
   */
  navViewportRowCount: Ref<number>;
  querying: Ref<boolean>;
  queryingNext: Ref<boolean>;
  totalCount: Ref<number>;
  loadedCount: ComputedRef<number>;
  pagination: Ref<PaginationControl>;
  queryError: Ref<Error | null>;
  metadataError: Ref<Error | null>;
  /**
   * Most recent fetch error of any kind, tagged with `kind` so consumers
   * can format toasts differently per source. Wrapped in a fresh
   * `{ error, kind }` object on every assignment so watchers fire even
   * when consecutive failures share an Error reference. Fire-and-forget:
   * a successful retry does NOT clear this; it just stops re-firing.
   */
  lastError: Ref<{ error: Error; kind: QueryErrorKind } | null>;
  mustRefresh: Ref<boolean>;
  searchTerm: Ref<string>;
  /**
   * Runtime "preserve search relevance" flag (a model — read/write). While
   * `true` AND `searchTerm` is non-empty, user `sorters` are omitted from the
   * query so the backend's relevance ranking survives; `forceSorters` still
   * apply and `sorters` itself is never mutated (suppression is query-time
   * only). Any write to `sorters` during an active search flips this to
   * `false` for the current search session; a new session (empty →
   * non-empty `searchTerm`) resets it to the configured default.
   */
  ignoreSortersWhenSearched: Ref<boolean>;
  configDialogOpen: Ref<boolean>;
  configTab: Ref<ConfigTab>;
  /** Selected row values (PKs extracted via `rowValueFn`). */
  selectedRows: ShallowRef<unknown[]>;
  selectedCount: ComputedRef<number>;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn: (row: Record<string, unknown>) => unknown;
  /**
   * Row-delete opt-in — writable ref owned by the renderer. `<AsTable>` and
   * `<AsWindowTable>` push their `:row-delete` prop into this ref via a
   * watcher; `createActions` reads `.value` inside its computed `groups`,
   * so the synthesised `__remove` action appears/disappears live without
   * remounting.
   */
  rowDelete: Ref<boolean | RowDeleteOpt>;
  /**
   * `?$actions=true` opt-in — writable ref owned by the renderer.
   * `<AsTable>` / `<AsWindowTable>` flip this on whenever their
   * `:row-actions-column` prop is non-`false` AND the table has at least one
   * row/rows-level action. When on, `buildTableQuery` requests per-row
   * `$actions: string[]` so the dropdown can hide server-disabled actions.
   */
  includeActions: Ref<boolean>;
  /**
   * Whether `pk` is in the current selection set. Mode-independent — the
   * renderer is expected to keep `selectedRows` empty in `select="none"`
   * (its mode-transition watcher handles this), so this returns `false`
   * naturally without consulting mode.
   */
  isPkSelected: (pk: unknown) => boolean;
  /** Column currently open in the filter dialog (null when closed). */
  filterDialogColumn: Ref<ColumnDef | null>;

  /** Absolute index of the keyboard-active row. -1 = nothing active. */
  activeIndex: Ref<number>;
  /**
   * Whether the active renderer caps `activeIndex` by the loaded row count
   * (`"pagination"`, default — only DOM-rendered rows are navigable) or by
   * the backend total (`"window"`, set by `<AsWindowTableBase>` on mount —
   * unloaded rows still navigable, the windowed renderer fetches them in).
   */
  navMode: Ref<"pagination" | "window">;
  /**
   * The currently-active row, resolved correctly for the current nav mode
   * (page-relative into `results` in pagination, absolute via `dataAt` in
   * window). `undefined` when no row is active (`activeIndex < 0`).
   */
  getActiveRow: () => Record<string, unknown> | undefined;
  /** True when at least one of `<AsTableRoot>` / `<AsTable>` / `<AsWindowTable>` has a `main-action` listener bound. */
  hasMainActionListener: Ref<boolean>;
  /** Build a deterministic DOM `id` for the row at `absIndex` (per-state UID). */
  rowId: (absIndex: number) => string;

  /** Set the active-row index (clamped to `[-1, totalCount - 1]`). */
  setActive: (absIndex: number) => void;
  /** Reset the active-row index to `-1`. */
  clearActive: () => void;
  /** Toggle selection of the active row's PK in `selectedRows`. */
  toggleActiveSelection: (mode: SelectionMode) => void;
  /** Ask the rendering component to emit `main-action` for the active row. */
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
  /** Translate a keyboard event into the appropriate downstream mutations. */
  handleNavKey: (event: KeyboardEvent, opts?: NavKeyOptions) => void;
  /** Register a main-action callback; returns a one-shot disposer. */
  registerMainActionListener: (cb: (req: MainActionRequest) => void) => () => void;

  /** Server-declared actions + UI-side `__remove`, with `invoke`/`invoking`/`lastResult`. */
  actions: TableActionsState;

  /**
   * Currently pending prompt request — `null` when no dialog is open. The
   * default `<AsConfirmDialog>` v-binds its open state to this ref. Writes
   * here are owned by `prompt()` / `acceptPrompt()` / `dismissPrompt()`;
   * consumers should not mutate directly.
   */
  confirmRequest: Ref<ConfirmRequest | null>;
  /**
   * Open the in-app confirm dialog with `message` as the body. Resolves
   * `true` on accept, `false` on cancel/dismiss. Public — consumers can
   * reuse this for their own confirmation flows; the dialog is rendered
   * once by `<AsTableRoot>` (or a swap-in via `controls.confirmDialog`).
   *
   * ```ts
   * const ok = await state.prompt("Discard changes?", { scope: "error" });
   * if (ok) discard();
   * ```
   */
  prompt: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  /** Resolve the active prompt with `true`. Internal — used by the dialog. */
  acceptPrompt: () => void;
  /** Resolve the active prompt with `false`. Internal — used by the dialog. */
  dismissPrompt: () => void;

  /**
   * Currently pending action-form request — `null` when no form is open.
   * Writes are owned by `requestActionInput()` / `acceptActionForm()` /
   * `dismissActionForm()`; consumers should not mutate directly.
   */
  actionFormRequest: Ref<ActionFormRequest | null>;
  /**
   * Open the action-form dialog. Resolves with the submitted form payload
   * on accept, or `null` on cancel/dismiss.
   */
  requestActionInput: (
    action: TVueTableActionInfo,
    ctx: { identifiers: Record<string, unknown>[]; preferredId: readonly string[] },
  ) => Promise<unknown>;
  /** Resolve the active form request with `input`. Internal — used by the dialog. */
  acceptActionForm: (input: unknown) => void;
  /** Resolve the active form request with `null`. Internal — used by the dialog. */
  dismissActionForm: () => void;
  /**
   * Hydrate state from a URL query string produced by `stateToUrlQueryString`.
   * Replaces filters / sorters / search / pagination with values decoded from
   * the URL; unions decoded filter fields into `filterFields`. Echo-guarded
   * against the bridge's own emissions. Does NOT call `query()` — root
   * watchers refetch in reaction to the writes.
   */
  applyUrlQuery: (urlString: string) => void;

  /**
   * Preset feature surface. Always present; inert (`available=false`,
   * mutators throw) when `useTable({ preset })` was not configured.
   */
  preset: PresetSurface;
}

/**
 * Preset namespace exposed on `state.preset`. Read-only refs for picker
 * UI; mutators are pure batched writes (never call `query()` — root
 * watchers refetch automatically).
 */
export interface PresetSurface {
  /** Owned + public preset rows for this `(app, tableKey)`. `[]` when feature off. */
  presets: ShallowRef<AsPresetEntryRow[]>;
  /** Lookup table for stored presets — O(1) by id. */
  presetsById: ComputedRef<Map<string, AsPresetEntryRow>>;
  /** This user's userConf row (`type='userConf'`), or null. */
  userConf: ShallowRef<AsPresetEntryRow | null>;
  /** Server-issued capabilities (`canPublish`, `presetLimit`); null when unavailable. */
  capabilities: Ref<PresetCapabilities | null>;
  /** Standard always at index 0; consumer-supplied named presets follow. */
  systemPresets: ComputedRef<SystemPreset[]>;
  /** Lookup table for system presets — O(1) by id. */
  systemPresetsById: ComputedRef<Map<string, SystemPreset>>;
  /**
   * App-declared preset aspect set — render gate for picker checkboxes /
   * dialog badges + capture filter. Static (captured at setup); default
   * `['columns', 'filters', 'filterOps', 'sorters']`.
   */
  availableAspects: PresetAspect[];
  /**
   * False when `preset` config is absent OR the initial load returned
   * 401/403 OR any other error. The picker / dialog should hide their UI.
   */
  available: ComputedRef<boolean>;
  /** Currently active preset id (system `'sys:*'` or stored). null = no active. */
  activeId: Ref<string | null>;
  /** Active preset's snapshot (system presets are aspect-expanded). */
  activeSnapshot: ComputedRef<PresetSnapshot>;
  /** True when the current snapshot ≠ active preset's claimed aspects. */
  isDirty: ComputedRef<boolean>;
  /** True iff the active preset is owned by the current user (gates Save). */
  canSaveActive: ComputedRef<boolean>;
  /** Owner-aware: returns the user id resolved from capabilities or any private row. */
  currentUser: ComputedRef<string | null>;
  /** Open state for `<AsPresetDialog>` — picker's "Manage…" item flips this. */
  dialogOpen: Ref<boolean>;

  /** Capture a snapshot of the current state, gated by `availableAspects`. */
  captureSnapshot: (mask?: AspectMask) => PresetSnapshot;
  /**
   * Apply a preset by id (system `sys:*` or stored) or by raw snapshot.
   * Pure batched mutation — never calls `query()`. The root watcher
   * picks up the changed state arrays and re-fetches automatically.
   */
  apply: (idOrSnapshot: string | PresetSnapshot) => void;
  /** Re-apply the active preset's content; drops local edits to its claimed aspects. */
  resetActive: () => void;
  /** Drop the persisted localStorage draft (no-op when persistence is off). */
  clearLocalDraft: () => void;
  /**
   * Resolve the bootstrap default preset id: pinned `userConf.defaultPresetId`
   * if it still references a known preset, else `STANDARD_PRESET_ID`.
   */
  resolveDefaultId: () => string;

  // Persistence — only meaningful when feature is configured.
  /** Re-capture the active preset's existing aspect mask. Never widens. */
  saveActive: () => Promise<void>;
  /** Create a new preset and switch the active id to it. */
  saveAs: (label: string, opts?: { aspects?: AspectMask; public?: boolean }) => Promise<string>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePublic: (id: string) => Promise<void>;
  /** Pin a preset as default for `(user, app, tableKey)`. */
  setDefault: (id: string | null) => Promise<void>;
  /** Toggle a preset's pinned-as-favorite state. */
  toggleFav: (id: string) => Promise<void>;
  /**
   * Replace the full favorites list in one upsert. Use when a UI batches
   * several toggles (manage dialog) so one round-trip applies the new set.
   */
  setFavorites: (ids: string[]) => Promise<void>;
  /**
   * Run `fn` with the trailing reload of every mutator deferred until `fn`
   * resolves; one coalesced reload fires at the end. Use for batched flows
   * (e.g. dialog Save with N renames + M public flips + K deletes) to
   * collapse N+M+K reload round-trips into 1. Pass-through when the preset
   * feature is off.
   */
  batch: <T>(fn: () => Promise<T>) => Promise<T>;
}
