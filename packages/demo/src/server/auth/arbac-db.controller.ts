import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { AsDbController } from "@atscript/moost-db";
import { useArbac } from "@moostjs/arbac";
import { Inherit } from "moost";
import type { UniqueryControls } from "@atscript/db";
import type { DemoScope } from "./arbac-scope";

/**
 * Resolve the union of `columns` whitelists from a list of scopes.
 * - Empty list → `undefined` (no restriction; should only happen when the
 *   `ArbacAuthorize` interceptor did not run — treated as admin-ish).
 * - Any scope with `columns === undefined` → `undefined` (all columns allowed).
 * - Otherwise, return the union of all whitelists.
 */
export function unionAllowedColumns(scopes: DemoScope[]): string[] | undefined {
  if (!scopes.length) return undefined;
  if (scopes.some((s) => !s.columns)) return undefined;
  const set = new Set<string>();
  for (const s of scopes) {
    if (s.columns) {
      for (const c of s.columns) set.add(c);
    }
  }
  return Array.from(set);
}

/**
 * Narrow a `$select` projection against the union of scope column whitelists.
 * - No whitelist → passthrough.
 * - Undefined / empty-array projection → return the whitelist (client asked
 *   for "all fields" → narrow to what this user can see).
 * - Array projection (inclusion list) → drop string entries not in the
 *   whitelist; aggregate expressions pass through unchanged.
 * - Object projection (0/1 inclusion/exclusion map) → drop keys not in the
 *   whitelist.
 */
export function narrowProjection(
  scopes: DemoScope[],
  projection?: UniqueryControls["$select"],
): UniqueryControls["$select"] | undefined {
  const allowed = unionAllowedColumns(scopes);
  if (!allowed) return projection;

  if (projection === undefined || (Array.isArray(projection) && projection.length === 0)) {
    return allowed as unknown as UniqueryControls["$select"];
  }

  if (Array.isArray(projection)) {
    const kept: Array<string | { $fn: string; $field: string; $as?: string }> = [];
    for (const item of projection as Array<
      string | { $fn: string; $field: string; $as?: string }
    >) {
      if (typeof item === "string") {
        if (allowed.includes(item)) kept.push(item);
      } else {
        // Aggregate expressions pass through; arbac column scoping does not
        // reason about computed columns.
        kept.push(item);
      }
    }
    return kept as unknown as UniqueryControls["$select"];
  }

  // Object inclusion/exclusion map form
  const obj = projection as Record<string, 0 | 1>;
  const out: Record<string, 0 | 1> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.includes(key)) out[key] = obj[key];
  }
  return out as unknown as UniqueryControls["$select"];
}

/**
 * `AsDbController` mixin that enforces ARBAC column scopes on reads, writes,
 * and meta responses. Apply `@ArbacAuthorize()` + `@ArbacResource("<table>")`
 * at the class level; the interceptor populates scopes per request which
 * this mixin then applies to the controller's CRUD hooks.
 *
 * Action mapping is handled in the policy (`arbac-policy.ts`): the arbac
 * `action` defaults to the controller method name, so the policy registers
 * one rule per logical-method (`query`, `pages`, `getOne`, `getOneComposite`,
 * `meta`, `insert`, `replace`, `update`, `remove`, `removeComposite`).
 */
@Inherit()
export class AsArbacDbController<
  T extends TAtscriptAnnotatedType = TAtscriptAnnotatedType,
> extends AsDbController<T> {
  /** Current request's scopes (as set by `arbackAuthorizeInterceptor`). */
  protected scopes(): DemoScope[] {
    const scopes = useArbac<DemoScope>().getScopes?.();
    return (scopes ?? []) as DemoScope[];
  }

  /** Union of allowed columns across scopes; `undefined` = unrestricted. */
  protected allowedColumns(): string[] | undefined {
    return unionAllowedColumns(this.scopes());
  }

  protected override transformProjection(
    projection?: UniqueryControls["$select"],
  ): UniqueryControls["$select"] | undefined {
    return narrowProjection(this.scopes(), projection);
  }

  protected override onWrite(
    action:
      | "insert"
      | "insertMany"
      | "replace"
      | "replaceMany"
      | "update"
      | "updateMany",
    data: unknown,
  ): unknown {
    const allowed = this.allowedColumns();
    if (!allowed) return data;
    const filterRow = (row: Record<string, unknown>) => {
      const kept: Record<string, unknown> = {};
      for (const k of Object.keys(row)) {
        if (allowed.includes(k)) kept[k] = row[k];
      }
      return kept;
    };
    if (Array.isArray(data)) {
      return (data as Array<Record<string, unknown>>).map(filterRow);
    }
    if (data && typeof data === "object") {
      return filterRow(data as Record<string, unknown>);
    }
    return data;
  }

  override meta() {
    const raw = super.meta();
    const allowed = this.allowedColumns();
    if (!allowed) return raw;
    const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
    for (const k of Object.keys(raw.fields)) {
      if (allowed.includes(k)) fields[k] = raw.fields[k];
    }
    return { ...raw, fields };
  }
}
