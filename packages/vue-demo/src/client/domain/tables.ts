export type TableMode = "pagination" | "infinite";

export interface DemoTable {
  path: string;
  label: string;
  resource: string;
  icon: string;
  /** Default page size. Larger for infinite-scroll tables. */
  limit?: number;
  /** UI mode: numbered pagination or scroll-to-load. Default: pagination. */
  mode?: TableMode;
  /** Filter pills to show in the toolbar on first render (empty-valued — user still has to pick). */
  defaultFilterFields?: string[];
}

export const DEMO_TABLES: DemoTable[] = [
  {
    path: "users",
    label: "Users",
    resource: "users",
    icon: "i-ph:users",
    defaultFilterFields: ["status", "roleId"],
  },
  { path: "roles", label: "Roles", resource: "roles", icon: "i-ph:shield-check" },
  { path: "categories", label: "Categories", resource: "categories", icon: "i-ph:folders" },
  {
    path: "products",
    label: "Products",
    resource: "products",
    icon: "i-ph:package",
    defaultFilterFields: ["categoryId"],
  },
  { path: "customers", label: "Customers", resource: "customers", icon: "i-ph:user-circle" },
  {
    path: "orders",
    label: "Orders",
    resource: "orders",
    icon: "i-ph:shopping-cart",
    mode: "pagination",
    defaultFilterFields: ["customerId", "status"],
  },
  {
    path: "audit_log",
    label: "Audit Log",
    resource: "audit_log",
    icon: "i-ph:list-magnifying-glass",
    mode: "infinite",
    limit: 50,
    defaultFilterFields: ["action", "resource"],
  },
];

export function getDemoTable(path: string): DemoTable | undefined {
  return DEMO_TABLES.find((t) => t.path === path);
}
