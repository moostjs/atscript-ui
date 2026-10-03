import type {
  ColumnMenuConfig,
  RowSelectableHook,
  SelectionPersistence,
  SelectOn,
  SystemPresetInput,
  UrlQuerySync,
} from "@atscript/vue-table";

export type TableMode = "pagination" | "infinite";
export type TableKind = "virtual" | "window" | "infinite-scroll";
export type ActionsColumn = "first" | "last" | "merge-select";

export interface DemoTable {
  /** URL slug. Defaults to `apiPath` and `tableKey` unless overridden. */
  path: string;
  /**
   * Override the controller path when the route slug differs from the API
   * path — e.g. `orders-cancelled` is a UI alias of the `orders` API table
   * with a sticky `status === 'cancelled'` filter. Defaults to `path`.
   */
  apiPath?: string;
  /**
   * Server-side sticky filter merged into every query. Users see the filter
   * applied but cannot remove it (no UI surface). Use for permission-locked
   * views (e.g. cancelled-only orders) where the URL slug encodes the slice.
   * Shape is the `@uniqu/core` `FilterExpr` JSON form (typed loosely here to
   * keep the demo free of the `@uniqu/core` dep — `<AsTableRoot>` widens to
   * the real type at the boundary).
   */
  forceFilters?: Record<string, unknown>;
  label: string;
  resource: string;
  icon: string;
  /** Default page size. Larger for infinite-scroll/window tables. */
  limit?: number;
  /** `<AsTableRoot :block-size>` — rows per window-mode fetch. Default 100. */
  blockSize?: number;
  /** UI mode: numbered pagination or scroll-to-load. Default: pagination. Ignored when `kind === "window"`. */
  mode?: TableMode;
  /**
   * Render strategy. `virtual` (default) = `<AsTable>` with virtual rows;
   * `window` = `<AsWindowTable>` with pool-based rendering and synthesised
   * scrollbar (block-aligned async fetcher). Pick `window` for high-volume,
   * append-only tables (audit logs, events). `infinite-scroll` = `<AsTable>`
   * (paginated) + `<InfiniteScroll>` listener that auto-advances pages on
   * near-bottom scroll. Rows accumulate (no replacement) and no
   * `<TablePagination>` UI is rendered. Set `limit: 100` (matching
   * `DEFAULT_BLOCK_SIZE`) so the first paint fills a full block — partial
   * blocks would re-fetch on the first `queryNext`.
   */
  kind?: TableKind;
  /**
   * Placement of the synthesised `__actions` column. `last` (default) appends
   * after data columns; `first` prepends; `merge-select` shares the leading
   * gutter with the multi-select checkbox — visible only in `select="none"`
   * mode. Demo configures different placements per resource for showcase.
   */
  actionsColumn?: ActionsColumn;
  /**
   * Synthetic system presets injected into the picker (`sys:*` namespace,
   * never persisted). The `Standard` preset is the source of first-paint
   * baseline state — set `content.filters` here to render filter pills by
   * default, or `content.sorters` for a default sort, etc. Tables that omit
   * this fall back to the empty Standard (no pills, no sorters).
   */
  systemPresets?: SystemPresetInput[];
  /**
   * Opt out of the built-in synthetic `__remove` row action even when the
   * user has write permission. Useful when a table has exactly one declared
   * row action (e.g. customers' "View orders") and we want it to render as
   * a labelled single button instead of collapsing into a `…` menu next to
   * Delete. Default: false (delete enabled when `canWrite`).
   */
  noRowDelete?: boolean;
  /**
   * Per-aspect URL bridge gating. Default (omitted): full sync. Useful for
   * tables where pasting a deep link should restore filters/sort but not
   * the recipient's page (`{ pagination: false }`), or where some private
   * UI state shouldn't leak to the URL.
   */
  urlQuerySync?: UrlQuerySync;
  /**
   * Per-table override for `<AsTable>` / `<AsWindowTable>`'s `column-menu`
   * prop. Defaults to all four gates on. The `orders-no-menu` route turns
   * `hide` + `resetWidth` off so a `@db.json` column collapses every gate
   * and exercises the no-DropdownMenu fallback in `as-column-menu.vue`.
   */
  columnMenu?: ColumnMenuConfig;
  /**
   * Selection showcase. When set, the table always renders `select="multi"`
   * (no title toggle) and a strip above it switches `select-on` and the
   * custom `#header-__select` / `#cell-__select` controls live.
   */
  selection?: {
    /** Initial `select-on`. Default `"row"`. */
    on?: SelectOn;
    /** `<AsTableRoot :selection-persistence>`. Default `"trim"`. */
    persistence?: SelectionPersistence;
    rowSelectable?: RowSelectableHook;
  };
  /**
   * `<AsFilters>` overflow showcase: `:max-visible` plus a strip of controls
   * for `v-model:overflow-open`, the auto-focus events, the `#overflow`
   * body slot and the close-on-filter-dialog recipe.
   */
  filtersOverflow?: { maxVisible: number };
  /**
   * Enables the "Select all N matching" banner (`<AsTableRoot
   * :select-all-matching>`): once every loaded row is selected, the user can
   * widen the selection to every row matching the current filter/search and
   * run `queryTarget` actions on the server-side query instead of ids.
   */
  selectAllMatching?: boolean;
  /**
   * Row field the selection keys on (`rowValueFn`). Default `"id"`. Views
   * that expose their id under another name (e.g. `task-board`'s `taskId`)
   * set it so rows stay distinct.
   */
  rowKey?: string;
}

/** Cancelled orders are not selectable in the selection showcases. */
const notCancelled: RowSelectableHook = (row) =>
  row.status === "cancelled" ? "Cancelled orders cannot be picked" : true;

/** Columns the `orders-presets` system presets name (a subset of the table). */
const PRESET_COLUMNS = ["id", "customerId", "status", "total", "createdAt"];
const PRESET_FILTERS = ["customerId", "status"];

export const DEMO_TABLES: DemoTable[] = [
  {
    path: "users",
    label: "Users",
    resource: "users",
    icon: "i-ph:users",
    actionsColumn: "last",
    systemPresets: [
      { id: "standard", label: "Standard", content: { filters: ["status", "roleId"] } },
    ],
    urlQuerySync: { sorters: false },
  },
  { path: "roles", label: "Roles", resource: "roles", icon: "i-ph:shield-check" },
  { path: "categories", label: "Categories", resource: "categories", icon: "i-ph:folders" },
  {
    path: "products",
    label: "Products",
    resource: "products",
    icon: "i-ph:package",
    actionsColumn: "first",
    systemPresets: [{ id: "standard", label: "Standard", content: { filters: ["categoryId"] } }],
  },
  {
    path: "customers",
    label: "Customers",
    resource: "customers",
    icon: "i-ph:user-circle",
    noRowDelete: true,
  },
  {
    path: "orders",
    label: "Orders",
    resource: "orders",
    icon: "i-ph:shopping-cart",
    mode: "pagination",
    actionsColumn: "merge-select",
    systemPresets: [
      { id: "standard", label: "Standard", content: { filters: ["customerId", "status"] } },
    ],
    // Shareable filtered view: recipients see filters but land on page 1
    // (no `pagination` round-trip). The `filters` allowlist also exercises
    // the `string[]` form of `urlQuerySync.filters` — only `status` and
    // `customerId` round-trip; other filters (e.g. ad-hoc `total` ranges)
    // stay private to the linker.
    urlQuerySync: { pagination: false, filters: ["status", "customerId"] },
  },
  // Sticky-filter alias of `orders` — `forceFilters` pins `status =
  // 'cancelled'` server-side. Users see the filter applied but cannot remove
  // it (no UI surface). Demonstrates the `forceFilters` contract end-to-end.
  // `apiPath: 'orders'` re-uses the orders controller; the route slug
  // `orders-cancelled` doubles as the preset scope (per-`(user, app, tableKey)`).
  {
    path: "orders-cancelled",
    apiPath: "orders",
    label: "Cancelled orders",
    resource: "orders",
    icon: "i-ph:prohibit",
    mode: "pagination",
    actionsColumn: "last",
    forceFilters: { status: "cancelled" },
  },
  // Sticky-config alias of `orders` — disables Hide + Reset width so the
  // `@db.json` `lines` column collapses all four column-menu gates and
  // exercises the no-DropdownMenu fallback in `as-column-menu.vue`.
  {
    path: "orders-no-menu",
    apiPath: "orders",
    label: "Orders (no menu)",
    resource: "orders",
    icon: "i-ph:dots-three",
    mode: "pagination",
    actionsColumn: "last",
    columnMenu: { sort: true, filters: true, hide: false, resetWidth: false },
  },
  // Preset "what counts as a change" showcase. System presets that spell out
  // default widths (`id` 96px, `status` 128px — plus a width on `notAColumn`),
  // a non-default width, an empty filter and a filled one. Own `tableKey`, so
  // saved presets stay here.
  {
    path: "orders-presets",
    apiPath: "orders",
    label: "Orders (presets)",
    resource: "orders",
    icon: "i-ph:bookmarks",
    systemPresets: [
      { id: "standard", label: "Standard", content: { filters: PRESET_FILTERS } },
      {
        id: "default-widths",
        label: "Default widths",
        content: {
          columns: {
            columnNames: PRESET_COLUMNS,
            columnWidths: { id: "96px", status: "128px", notAColumn: "50px" },
          },
          filters: PRESET_FILTERS,
        },
      },
      {
        id: "wide-status",
        label: "Wide status",
        content: {
          columns: { columnNames: PRESET_COLUMNS, columnWidths: { status: "240px" } },
          filters: PRESET_FILTERS,
        },
      },
      {
        id: "empty-status-filter",
        label: "Empty status filter",
        content: { filters: PRESET_FILTERS, filterOps: { status: [] } },
      },
      {
        id: "shipped-only",
        label: "Shipped only",
        content: {
          filters: PRESET_FILTERS,
          filterOps: { status: [{ type: "eq", value: ["shipped"] }] },
        },
      },
    ],
  },
  // Selection showcase: `select-on="control"`, persisted selection across
  // pages, cancelled orders ineligible, custom selection controls on demand.
  {
    path: "orders-selection",
    apiPath: "orders",
    label: "Orders (selection)",
    resource: "orders",
    icon: "i-ph:check-square",
    limit: 10,
    selection: { on: "control", persistence: "persist", rowSelectable: notCancelled },
  },
  // `<AsWindowTable>` over the 15 orders — the whole dataset loads in one
  // block, so the header select-all is available (audit_log's is not).
  {
    path: "orders-window",
    apiPath: "orders",
    label: "Orders (window)",
    resource: "orders",
    icon: "i-ph:rows",
    kind: "window",
    selection: { rowSelectable: notCancelled },
  },
  // `<AsFilters :max-visible="1">` — Customer inline, the rest in the popover.
  {
    path: "orders-filters",
    apiPath: "orders",
    label: "Orders (more filters)",
    resource: "orders",
    icon: "i-ph:funnel",
    systemPresets: [
      {
        id: "standard",
        label: "Standard",
        content: { filters: ["customerId", "status", "total"] },
      },
    ],
    filtersOverflow: { maxVisible: 1 },
  },
  // Query-target showcase: `selectAllMatching` adds the "Select all N
  // matching" banner; `archive` / `set-priority` / `reopen` accept a query
  // target (`reopen` caps it at 25 rows), `notify` does not.
  {
    path: "tasks",
    label: "Tasks",
    resource: "tasks",
    icon: "i-ph:check-circle",
    limit: 10,
    selection: {},
    selectAllMatching: true,
  },
  {
    path: "tasks-window",
    apiPath: "tasks",
    label: "Tasks (window)",
    resource: "tasks",
    icon: "i-ph:list-checks",
    kind: "window",
    // Small blocks: the 60 tasks must NOT load in one block, otherwise every
    // row is already loaded and "Select all N matching" has nothing to add.
    blockSize: 15,
    selection: {},
    selectAllMatching: true,
  },
  // `@db.view` over tasks + assignee with the task actions delegated through
  // `@DbActionsFrom` (`idMap: { id: "taskId" }`). No ARBAC on the view
  // itself; nav visibility follows the `tasks` read grant.
  {
    path: "task-board",
    label: "Task board",
    resource: "tasks",
    icon: "i-ph:kanban",
    limit: 10,
    rowKey: "taskId",
    selection: {},
    selectAllMatching: true,
  },
  {
    path: "audit_log",
    label: "Audit Log",
    resource: "audit_log",
    icon: "i-ph:list-magnifying-glass",
    kind: "window",
    limit: 100,
    systemPresets: [
      { id: "standard", label: "Standard", content: { filters: ["action", "entityType"] } },
    ],
  },
  // Workflow state store — admin-only listing of paused workflow rows;
  // demo for `@wf.store.fromContext` shadow columns and `@ui.table.exclude`.
  {
    path: "wf_states",
    label: "Workflow States",
    resource: "wf_states",
    icon: "i-ph:flow-arrow",
  },
  // Infinite-scroll alias of `audit_log` — `<AsTable>` (paginated) +
  // `<InfiniteScroll>` listener. Same controller (`apiPath: 'audit_log'`)
  // so both routes share the dataset; `limit: 100` keeps the initial
  // block aligned with `DEFAULT_BLOCK_SIZE` (see `kind` doc above).
  {
    path: "audit_log_infinite",
    apiPath: "audit_log",
    label: "Audit Log (infinite)",
    resource: "audit_log",
    icon: "i-ph:scroll",
    kind: "infinite-scroll",
    limit: 100,
    systemPresets: [
      { id: "standard", label: "Standard", content: { filters: ["action", "entityType"] } },
    ],
  },
];

export function getDemoTable(path: string): DemoTable | undefined {
  return DEMO_TABLES.find((t) => t.path === path);
}
