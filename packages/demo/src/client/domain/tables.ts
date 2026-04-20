export interface DemoTable {
  path: string;
  label: string;
  resource: string;
}

export const DEMO_TABLES: DemoTable[] = [
  { path: "users", label: "Users", resource: "users" },
  { path: "roles", label: "Roles", resource: "roles" },
  { path: "categories", label: "Categories", resource: "categories" },
  { path: "products", label: "Products", resource: "products" },
  { path: "customers", label: "Customers", resource: "customers" },
  { path: "orders", label: "Orders", resource: "orders" },
  { path: "audit_log", label: "Audit Log", resource: "audit_log" },
];
