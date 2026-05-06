import type { TAtscriptAnnotatedType, TProcessAnnotationContext } from "@atscript/typescript/utils";
import { AsDbController } from "@atscript/moost-db";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_UNIT,
  DB_UNIT_REF,
} from "@atscript/ui";
import { useArbac } from "@moostjs/arbac";
import { Inherit, getInstanceOwnMethods, getMoostMate } from "moost";
import type { TCrudOp, TMetaResponse, UniqueryControls } from "@atscript/db";
import type { DemoScope } from "./arbac-scope";

const UI_QUANTITY_ANNOTATION_KEYS = new Set<string>([
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_UNIT,
  DB_UNIT_REF,
  DB_COLUMN_PRECISION,
]);

/**
 * Internal moost-db method-metadata key written by `@DbAction(name, opts)`.
 *
 * Mirrors `MOOST_DB_ACTION` from `@atscript/moost-db/src/actions/keys.ts` —
 * not re-exported from the package's public barrel, so we duplicate the
 * literal here. Keep in sync with upstream if the constant changes (low
 * risk: it's part of the wire shape between decorator + discoverer and
 * tracked by the moost-db internal contract). Re-used by `audit.ts`.
 */
export const MOOST_DB_ACTION = "atscript_db_action";

/** Write-side CRUD ops we gate via ARBAC. Reads pass through unchanged — the per-request column scope already narrows their projections. */
const WRITE_CRUD_OPS: readonly TCrudOp[] = ["insert", "update", "replace", "remove"] as const;

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
 * Per-controller-class memo of `actionName → arbacActionId` derived from
 * `@DbAction(name, ...)` + `@ArbacAction(arbacActionId)` co-decoration on
 * the same handler method.
 *
 * Method-level metadata is static for the controller class — same lookup
 * on every request — so we cache by ctor. `WeakMap` lets the entry be
 * GC'd if the controller class is itself collected (test isolation).
 *
 * Class-level entries declared via `@DbTableActions` / `@DbRowActions`
 * (`invite-user`, `export-csv`, `edit`, `copy-invite-link`) carry NO
 * method-level metadata, so they never appear in this map and the
 * overlay leaves them visible — see option (a) note below.
 */
const arbacActionMapCache = new WeakMap<Function, Map<string, string>>();

function getArbacActionMap(instance: object): Map<string, string> {
  const ctor = instance.constructor as Function;
  let cached = arbacActionMapCache.get(ctor);
  if (cached) return cached;
  cached = new Map<string, string>();
  const mate = getMoostMate();
  for (const methodName of getInstanceOwnMethods(instance) as string[]) {
    if (typeof methodName !== "string") continue;
    const meta = mate.read(ctor, methodName) as
      | {
          arbacActionId?: string;
          [MOOST_DB_ACTION]?: { name?: string };
        }
      | undefined;
    const dbAction = meta?.[MOOST_DB_ACTION];
    const arbacActionId = meta?.arbacActionId;
    if (dbAction?.name && arbacActionId) {
      cached.set(dbAction.name, arbacActionId);
    }
  }
  arbacActionMapCache.set(ctor, cached);
  return cached;
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
  /**
   * Extend the inherited annotation whitelist (which strips most `db.*` keys
   * for cleanliness) so the cell renderers receive the quantity-tagging
   * metadata they need: money (`db.amount.currency` / `.ref`), unit
   * (`db.unit` / `.ref`), and decimal scale (`db.column.precision`). Allow-
   * list stays narrow — we don't leak indexes, collation, gate modes, etc.
   */
  protected override getSerializeOptions() {
    const base = super.getSerializeOptions();
    const baseProcess = base.processAnnotation;
    return {
      ...base,
      processAnnotation: (entry: TProcessAnnotationContext) => {
        if (UI_QUANTITY_ANNOTATION_KEYS.has(entry.key)) {
          return { key: entry.key, value: entry.value };
        }
        return baseProcess?.(entry);
      },
    };
  }

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
    action: "insert" | "insertMany" | "replace" | "replaceMany" | "update" | "updateMany",
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

  /**
   * Per-request meta-envelope overlay: narrows `fields` by allowed columns,
   * gates `actions[]` by per-method `@ArbacAction(<id>)`, and gates write
   * `crud` keys (`insert`/`update`/`replace`/`remove`) by the principal.
   * Reads in `crud` pass through — column scoping in
   * {@link transformProjection} already narrows their results.
   *
   * Overriding this hook also flips the framework's `_overlayIsNoOp` flag,
   * threading the same gating into `/pages?$actions=true` row augmentation
   * via `_resolveAugmentEnvelopes` — no separate hook needed.
   *
   * **Sub-decision — class-level `@DbTableActions` / `@DbRowActions` pass
   * through unfiltered.** Their declarative dict entries (`invite-user`,
   * `export-csv`, `edit`, `copy-invite-link`) have no method handler and
   * therefore no `@ArbacAction(...)` to read; the destination route
   * enforces its own ARBAC (401/403 on click-through). Extending
   * `@DbTableActions` with an `arbacAction?` hint would close the gap but
   * requires a moost-db type change — out of scope: the framework must
   * stay ARBAC-agnostic.
   *
   * **No "empty-scopes-as-admin" branch on actions/crud.** Field narrowing
   * returns the envelope unchanged when no scopes are present (a
   * test-direct-instantiation accommodation). DO NOT carry that over for
   * actions/crud — without scopes the gated envelope would falsely appear
   * unrestricted. We use `useArbac().evaluate(...)`, which works whenever
   * an event context exists.
   */
  protected override async applyMetaOverlay(meta: TMetaResponse): Promise<TMetaResponse> {
    const arbac = useArbac<DemoScope>();
    if (arbac.isPublic) return meta;

    const resource = arbac.resource;
    const next: TMetaResponse = { ...meta };

    // 1. Field narrowing.
    const allowed = this.allowedColumns();
    if (allowed) {
      const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
      for (const k of Object.keys(meta.fields)) {
        if (allowed.includes(k)) fields[k] = meta.fields[k];
      }
      next.fields = fields;
    }

    // 2. Action gating — only method-level @DbAction handlers carrying @ArbacAction.
    const arbacActionMap = getArbacActionMap(this);
    if (arbacActionMap.size > 0) {
      // Dedupe: one evaluate per unique arbacActionId per request.
      const verdicts = new Map<string, boolean>();
      const filteredActions = [];
      for (const action of meta.actions) {
        const arbacActionId = arbacActionMap.get(action.name);
        if (!arbacActionId) {
          filteredActions.push(action);
          continue;
        }
        let allowedAction = verdicts.get(arbacActionId);
        if (allowedAction === undefined) {
          const result = await arbac.evaluate({ resource, action: arbacActionId });
          allowedAction = result.allowed;
          verdicts.set(arbacActionId, allowedAction);
        }
        if (allowedAction) filteredActions.push(action);
      }
      next.actions = filteredActions;
    }

    // 3. CRUD gating — only the four write ops are gated; reads pass through.
    const crudKeys = Object.keys(meta.crud) as TCrudOp[];
    let crudChanged = false;
    const filteredCrud: TMetaResponse["crud"] = {};
    for (const op of crudKeys) {
      if (!WRITE_CRUD_OPS.includes(op)) {
        filteredCrud[op] = meta.crud[op];
        continue;
      }
      const result = await arbac.evaluate({ resource, action: op });
      if (result.allowed) {
        filteredCrud[op] = meta.crud[op];
      } else {
        crudChanged = true;
      }
    }
    if (crudChanged) next.crud = filteredCrud;

    return next;
  }
}
