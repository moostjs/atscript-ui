import type { MoostArbac } from "@moostjs/arbac";
import type { DemoScope, DemoUserAttrs } from "./arbac-scope";

type Role = Parameters<MoostArbac<DemoUserAttrs, DemoScope>["registerRole"]>[0];

/**
 * Logical action groups mapped onto the HTTP method names emitted by
 * `AsDbController` / `AsDbReadableController`.
 *
 * NOTE: The ARBAC action defaults to the controller method name
 * (see `useArbac().action` fallback: `mMeta.arbacActionId || cc.getMethod()`).
 * Rather than overriding every CRUD method on the mixin just to apply
 * `@ArbacAction`, we encode action groups as a list of method names and
 * expand them into multiple rules at registration time.
 */
const READ_METHODS = ["query", "pages", "getOne", "getOneComposite", "meta"] as const;
const WRITE_METHODS = ["insert", "replace", "update", "remove", "removeComposite"] as const;

/** Columns the manager role may see / write on `users` (no password, salt, email). */
const MANAGER_USERS_COLS = [
  "id",
  "username",
  "roleId",
  "status",
  "mfaEnabled",
  "lastLoginAt",
  "createdAt",
];

/** Columns the viewer role may read on `users`. */
const VIEWER_USERS_COLS = ["id", "username", "status"];

/** Columns the viewer role may read on `products` (no createdById). */
const VIEWER_PRODUCTS_COLS = [
  "id",
  "name",
  "description",
  "categoryId",
  "sku",
  "price",
  "tags",
  "publishedAt",
  "createdAt",
];

/** Columns the viewer role may read on `customers` (no address, no preferences). */
const VIEWER_CUSTOMERS_COLS = ["id", "name", "email", "createdAt"];

/** Columns the viewer role may read on `orders` (no lines). */
const VIEWER_ORDERS_COLS = [
  "id",
  "customerId",
  "assigneeId",
  "status",
  "total",
  "shippedAt",
  "createdAt",
];

type Rule = Role["rules"][number];

function allowAll(resource: string, actions: readonly string[]): Rule[] {
  return actions.map((action) => ({ resource, action, scope: () => ({}) }));
}

function allowWithColumns(resource: string, actions: readonly string[], columns: string[]): Rule[] {
  return actions.map((action) => ({ resource, action, scope: () => ({ columns }) }));
}

function denyAll(resource: string, actions: readonly string[]): Rule[] {
  return actions.map((action) => ({ resource, action, effect: "deny" as const }));
}

const adminRole: Role = {
  id: "admin",
  rules: [
    // Admin can do any action on any resource; empty scope = no column narrowing.
    { resource: "*", action: "*", scope: () => ({}) },
  ],
};

const managerRole: Role = {
  id: "manager",
  rules: [
    // users: read + write, narrowed to MANAGER_USERS_COLS
    ...allowWithColumns("users", READ_METHODS, MANAGER_USERS_COLS),
    ...allowWithColumns("users", WRITE_METHODS, MANAGER_USERS_COLS),
    // roles: read-only, no narrowing
    ...allowAll("roles", READ_METHODS),
    // categories/products/customers/orders: read + write, no narrowing
    ...allowAll("categories", READ_METHODS),
    ...allowAll("categories", WRITE_METHODS),
    ...allowAll("products", READ_METHODS),
    ...allowAll("products", WRITE_METHODS),
    ...allowAll("customers", READ_METHODS),
    ...allowAll("customers", WRITE_METHODS),
    ...allowAll("orders", READ_METHODS),
    ...allowAll("orders", WRITE_METHODS),
    // audit_log: read-only
    ...allowAll("audit_log", READ_METHODS),
  ],
};

const viewerRole: Role = {
  id: "viewer",
  rules: [
    // users: narrow read only
    ...allowWithColumns("users", READ_METHODS, VIEWER_USERS_COLS),
    // roles, categories: read, no narrowing
    ...allowAll("roles", READ_METHODS),
    ...allowAll("categories", READ_METHODS),
    // products, customers, orders: narrow reads
    ...allowWithColumns("products", READ_METHODS, VIEWER_PRODUCTS_COLS),
    ...allowWithColumns("customers", READ_METHODS, VIEWER_CUSTOMERS_COLS),
    ...allowWithColumns("orders", READ_METHODS, VIEWER_ORDERS_COLS),
    // audit_log: no rule → implicit 403.
    // Any write on any resource: explicit deny.
    ...denyAll("*", WRITE_METHODS),
  ],
};

/**
 * Convenience export: the two action groups. Used by tests that want to
 * assert behaviour for a logical "read" or "write" without pinning to a
 * specific method name.
 */
export const DEMO_ACTION_GROUPS = {
  read: READ_METHODS,
  write: WRITE_METHODS,
} as const;

/**
 * Seeds the three demo roles (admin/manager/viewer) into a MoostArbac instance.
 */
export function registerDemoRoles(arbac: MoostArbac<DemoUserAttrs, DemoScope>) {
  arbac.registerRole(adminRole);
  arbac.registerRole(managerRole);
  arbac.registerRole(viewerRole);
}
