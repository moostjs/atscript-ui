import type { Component, ShallowRef, Ref, ComputedRef } from "vue";

/** What Enter does when the keyboard-nav handler sees it. */
export type EnterAction = "main-action" | "toggle-select" | "passthrough";

/** Per-call options for the keyboard-nav handler / bridge. */
export interface NavKeyOptions {
  enterAction?: EnterAction;
}

/** Pending request to emit `main-action`, written by handleNavKey and click handlers. */
export interface MainActionRequest {
  row: Record<string, unknown>;
  absIndex: number;
  event: KeyboardEvent | MouseEvent;
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
  ColumnWidthsMap,
  ConfigTab,
  FieldFilters,
  SelectionMode,
  TableStateMethods,
} from "@atscript/ui-table";
export type { ConfigTab };

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
 * Component override map for table UI.
 *
 * Same pattern as vue-form's TAsTypeComponents: unstyled defaults
 * ship out of the box, user overrides any piece via this map.
 *
 * Only contains deep sub-components that are rendered inside other
 * components and cannot be composed directly by the user.
 * Layout components (toolbar, pagination, filter bar) are standalone
 * — users import and place them in their template.
 */
export interface TAsTableComponents {
  // Cells & headers
  headerCell?: Component;
  cellValue?: Component;
  columnMenu?: Component;

  // Filters
  filterInput?: Component;
  filterDialog?: Component;
  filterField?: Component;
  filterValueHelp?: Component;

  // Config
  configDialog?: Component;
  fieldsSelector?: Component;
  sortersConfig?: Component;

  // Presets
  createPreset?: Component;
  managePresets?: Component;
}

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
   * writers mutate `entry.w` directly. Default is the @ui.field.width annotation
   * when present, otherwise type+@expect.maxLen-derived (see `computeDefaultColumnWidth`).
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
  configDialogOpen: Ref<boolean>;
  configTab: Ref<ConfigTab>;
  /** Selected row values (PKs extracted via `rowValueFn`). */
  selectedRows: ShallowRef<unknown[]>;
  selectedCount: ComputedRef<number>;
  /** Selection mode. */
  selectionMode: SelectionMode;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn: (row: Record<string, unknown>) => unknown;
  /** True when `pk` is selected. Always false in `selectionMode: "none"`. */
  isPkSelected: (pk: unknown) => boolean;
  /** ARIA `aria-selected` value for a PK. `undefined` in `selectionMode: "none"`. */
  ariaSelectedFor: (pk: unknown) => "true" | "false" | undefined;
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
  /** True when at least one of `<AsTableRoot>` / `<AsTable>` / `<AsWindowTable>` has a `main-action` listener bound. */
  hasMainActionListener: Ref<boolean>;
  /** Build a deterministic DOM `id` for the row at `absIndex` (per-state UID). */
  rowId: (absIndex: number) => string;

  /** Set the active-row index (clamped to `[-1, totalCount - 1]`). */
  setActive: (absIndex: number) => void;
  /** Reset the active-row index to `-1`. */
  clearActive: () => void;
  /** Toggle selection of the active row's PK in `selectedRows`. */
  toggleActiveSelection: () => void;
  /** Ask the rendering component to emit `main-action` for the active row. */
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
  /** Translate a keyboard event into the appropriate downstream mutations. */
  handleNavKey: (event: KeyboardEvent, opts?: NavKeyOptions) => void;
  /** Register a main-action callback; returns a one-shot disposer. */
  registerMainActionListener: (cb: (req: MainActionRequest) => void) => () => void;
}
