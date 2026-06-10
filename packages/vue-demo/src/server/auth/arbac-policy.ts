import { allowTableAction, allowTableRead, allowTableWrite, defineRole } from "@aooth/arbac";
import type { TProjection } from "@aooth/arbac";
import type { ArbacDbScope, MoostArbac } from "@aooth/arbac-moost";
import type { DemoUserAttrs } from "./arbac-scope";

/**
 * Logical action groups mapped onto the HTTP method names emitted by
 * `AsDbController` / `AsDbReadableController`.
 *
 * NOTE: The ARBAC action defaults to the controller method name
 * (see `useArbac().action` fallback: `mMeta.arbacActionId || cc.getMethod()`).
 * `allowTableRead` / `allowTableWrite` expand to one rule per method name;
 * these groups stay exported so tests and `/me` can probe one representative
 * method per group.
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

/** Column whitelist → inclusion-mode `TProjection` (`{ col: 1, ... }`). */
function proj(columns: readonly string[]): TProjection {
  const p: TProjection = {};
  for (const c of columns) p[c] = 1;
  return p;
}

/**
 * Class-level `@DbTableActions` / `@DbRowActions` entries (`invite-user`,
 * `export-csv`, `edit`, …) carry no method handler and no `@ArbacAction`, so
 * `AsArbacDbController.applyMetaOverlay` evaluates them by their declared
 * name. Grant them to every non-admin role: they are navigate/custom
 * client-side processors whose destination routes enforce their own ARBAC.
 */
const DECLARATIVE_ACTIONS = [
  allowTableAction<DemoUserAttrs, ArbacDbScope>("users", [
    "invite-user",
    "export-csv",
    "edit",
    "copy-invite-link",
  ]),
  allowTableAction<DemoUserAttrs, ArbacDbScope>("orders", ["export-csv", "open"]),
  allowTableAction<DemoUserAttrs, ArbacDbScope>("products", ["export-csv", "edit"]),
  allowTableAction<DemoUserAttrs, ArbacDbScope>("customers", ["view-orders"]),
];

const adminRole = defineRole<DemoUserAttrs, ArbacDbScope>()
  .id("admin")
  // Admin can do any action on any resource; scope-less allow contributes the
  // `{}` universe sentinel = no row/column narrowing.
  .allow("*", "**")
  .build();

const managerRole = defineRole<DemoUserAttrs, ArbacDbScope>()
  .id("manager")
  .use(
    // users: read + write, narrowed to MANAGER_USERS_COLS — `projection`
    // narrows reads + /meta fields, `allowedFields` strips write payloads.
    allowTableWrite("users", {
      scope: () => ({
        projection: proj(MANAGER_USERS_COLS),
        allowedFields: [...MANAGER_USERS_COLS],
      }),
    }),
    // roles: read-only, no narrowing
    allowTableRead("roles"),
    // categories/products/customers/orders: read + write, no narrowing
    allowTableWrite("categories"),
    allowTableWrite("products"),
    allowTableWrite("customers"),
    allowTableWrite("orders"),
    // audit_log: read-only
    allowTableRead("audit_log"),
    // wf_states intentionally omitted — admin-only via the admin wildcard.
    ...DECLARATIVE_ACTIONS,
  )
  .build();

const viewerBuilder = defineRole<DemoUserAttrs, ArbacDbScope>()
  .id("viewer")
  .use(
    // users: narrow read only
    allowTableRead("users", { scope: () => ({ projection: proj(VIEWER_USERS_COLS) }) }),
    // roles, categories: read, no narrowing
    allowTableRead("roles"),
    allowTableRead("categories"),
    // products, customers, orders: narrow reads
    allowTableRead("products", { scope: () => ({ projection: proj(VIEWER_PRODUCTS_COLS) }) }),
    allowTableRead("customers", { scope: () => ({ projection: proj(VIEWER_CUSTOMERS_COLS) }) }),
    allowTableRead("orders", { scope: () => ({ projection: proj(VIEWER_ORDERS_COLS) }) }),
    // audit_log: no rule → implicit 403.
    ...DECLARATIVE_ACTIONS,
  );
// Any write on any resource: explicit deny.
for (const action of WRITE_METHODS) viewerBuilder.deny("*", action);
const viewerRole = viewerBuilder.build();

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
export function registerDemoRoles(arbac: MoostArbac<DemoUserAttrs, ArbacDbScope>) {
  arbac.registerRole(adminRole);
  arbac.registerRole(managerRole);
  arbac.registerRole(viewerRole);
}
