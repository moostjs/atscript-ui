import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import {
  DB_HTTP_PATH,
  DB_TABLE,
  DB_VIEW,
  DB_VIEW_FOR,
  META_LABEL,
  UI_NAV_GROUP,
  UI_NAV_HIDDEN,
  UI_NAV_ORDER,
} from "../shared/annotation-keys";
import { getFieldMeta, hasFieldMeta } from "../shared/field-resolver";
import { humanizePath } from "../shared/str";

/** A navigable route derived from a DB-backed model's metadata. */
export interface TModelRoute {
  model: TAtscriptAnnotatedType;
  /** Route path without leading/trailing slashes — mountable anywhere. */
  path: string;
  /** Display label — from @meta.label or humanized last path segment. */
  label: string;
  kind: "table" | "view";
  /** Nav section from @ui.nav.group — grouping is the consumer's job. */
  group?: string;
  /** Position from @ui.nav.order — lower first, undefined last. */
  order?: number;
  /** From @ui.nav.hidden — hidden routes are still returned; consumers filter. */
  hidden?: boolean;
}

/**
 * Derives navigable routes from DB-backed models' metadata.
 *
 * A model is included only when it is a DB entity (`@db.table`, `@db.view`,
 * or `@db.view.for`) AND a path can be derived: `@db.http.path` first, then
 * the string value of `@db.table` / `@db.view`, then the type's own id
 * as-is. Models where none of these yield a non-empty path are omitted.
 *
 * Routes are sorted by `order` ascending (undefined last, ties keep input
 * order). Hidden models are returned with `hidden: true` — filtering and
 * grouping are left to the consumer.
 */
export function buildModelRoutes(models: readonly TAtscriptAnnotatedType[]): TModelRoute[] {
  const routes: TModelRoute[] = [];
  for (const model of models) {
    const table = getFieldMeta(model, DB_TABLE);
    const view = getFieldMeta(model, DB_VIEW);
    const isView = view !== undefined || hasFieldMeta(model, DB_VIEW_FOR);
    if (table === undefined && !isView) continue;

    const path = resolvePath(model, table, view);
    if (path === undefined) continue;

    const label =
      getFieldMeta(model, META_LABEL) ?? humanizePath(path.slice(path.lastIndexOf("/") + 1));
    const route: TModelRoute = { model, path, label, kind: isView ? "view" : "table" };

    const group = getFieldMeta(model, UI_NAV_GROUP);
    if (typeof group === "string") route.group = group;
    const order = getFieldMeta(model, UI_NAV_ORDER);
    if (typeof order === "number") route.order = order;
    if (getFieldMeta(model, UI_NAV_HIDDEN) === true) route.hidden = true;

    routes.push(route);
  }
  routes.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    return ao === bo ? 0 : ao - bo;
  });
  return routes;
}

/** `db.http.path` > string `db.table`/`db.view` name > type id — mirrors moost-db's controller prefix resolution, so the path matches the HTTP mount of a token-bound controller. */
function resolvePath(
  model: TAtscriptAnnotatedType,
  table: string | true | undefined,
  view: string | true | undefined,
): string | undefined {
  const http = getFieldMeta(model, DB_HTTP_PATH);
  let raw: string | undefined;
  if (typeof http === "string") raw = http;
  else if (typeof table === "string") raw = table;
  else if (typeof view === "string") raw = view;
  else if (typeof model.id === "string") raw = model.id;
  if (!raw) return undefined;
  const path = raw.replace(/^\/+|\/+$/g, "");
  return path.length > 0 ? path : undefined;
}
