export type TableMode = "pagination" | "infinite";
export type TableKind = "virtual" | "window";
export type ActionsColumn = "first" | "last" | "merge-select";

export interface DemoTable {
  path: string;
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
   * append-only tables (audit logs, events).
   */
  kind?: TableKind;
  /**
   * Placement of the synthesised `__actions` column. `last` (default) appends
   * after data columns; `first` prepends; `merge-select` shares the leading
   * gutter with the multi-select checkbox — visible only in `select="none"`
   * mode. Demo configures different placements per resource for showcase.
   */
  actionsColumn?: ActionsColumn;
  /** Filter pills to show in the toolbar on first render (empty-valued — user still has to pick). */
  defaultFilterFields?: string[];
  /**
   * Opt out of the built-in synthetic `__remove` row action even when the
   * user has write permission. Useful when a table has exactly one declared
   * row action (e.g. customers' "View orders") and we want it to render as
   * a labelled single button instead of collapsing into a `…` menu next to
   * Delete. Default: false (delete enabled when `canWrite`).
   */
  noRowDelete?: boolean;
}

export const DEMO_TABLES: DemoTable[] = [
  {
    path: "users",
    label: "Users",
    resource: "users",
    icon: "i-ph:users",
    actionsColumn: "last",
    defaultFilterFields: ["status", "roleId"],
  },
  { path: "roles", label: "Roles", resource: "roles", icon: "i-ph:shield-check" },
  { path: "categories", label: "Categories", resource: "categories", icon: "i-ph:folders" },
  {
    path: "products",
    label: "Products",
    resource: "products",
    icon: "i-ph:package",
    actionsColumn: "first",
    defaultFilterFields: ["categoryId"],
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
    defaultFilterFields: ["customerId", "status"],
  },
  {
    path: "audit_log",
    label: "Audit Log",
    resource: "audit_log",
    icon: "i-ph:list-magnifying-glass",
    kind: "window",
    limit: 100,
    defaultFilterFields: ["action", "entityType"],
  },
];

export function getDemoTable(path: string): DemoTable | undefined {
  return DEMO_TABLES.find((t) => t.path === path);
}
