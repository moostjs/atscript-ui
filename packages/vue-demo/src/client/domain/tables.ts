import type { SystemPresetInput, UrlQuerySync } from "@atscript/vue-table";

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
}

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
