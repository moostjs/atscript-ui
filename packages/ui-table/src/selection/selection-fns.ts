import type { FilterExpr, Uniquery } from "@uniqu/core";

/** Selection mode. */
export type SelectionMode = "none" | "single" | "multi";

/**
 * Toggle a single PK in the selection.
 *
 * - `"none"`: no-op (returns the same array reference).
 * - `"single"`: replaces the selection. Toggling the already-selected PK clears it.
 * - `"multi"`: adds when absent, removes when present. Order preserved on add (append).
 *
 * `keyOf` compares by a stable identity instead of by reference — a query
 * selection's `excluded` list holds row objects, replaced on every refetch
 * (since 0.1.147).
 *
 * Always returns a new array on actual mutation; returns the same reference for `"none"`.
 */
export function togglePk(
  selection: readonly unknown[],
  pk: unknown,
  mode: SelectionMode,
  keyOf?: (value: unknown) => unknown,
): unknown[] {
  if (mode === "none") return selection as unknown[];
  const same = keyOf ? (v: unknown) => keyOf(v) === keyOf(pk) : (v: unknown) => v === pk;
  if (mode === "single") {
    if (selection.length === 1 && same(selection[0])) return [];
    return [pk];
  }
  const idx = selection.findIndex(same);
  if (idx === -1) return [...selection, pk];
  const next = selection.slice();
  next.splice(idx, 1);
  return next;
}

/**
 * Drop every PK in `selection` that's not in `presentPks`.
 *
 * Returns the same `selection` reference when nothing was dropped, so callers
 * can rely on identity comparison to detect a no-op without an explicit
 * length check.
 */
export function trimSelection(
  selection: readonly unknown[],
  presentPks: ReadonlySet<unknown>,
): unknown[] {
  if (selection.length === 0) return selection as unknown[];
  let removedAny = false;
  const kept: unknown[] = [];
  for (const v of selection) {
    if (presentPks.has(v)) kept.push(v);
    else removedAny = true;
  }
  return removedAny ? kept : (selection as unknown[]);
}

/** Map rows to their PKs via `rowValueFn`. */
export function rowsToPks(
  rows: readonly Record<string, unknown>[],
  rowValueFn: (row: Record<string, unknown>) => unknown,
): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < rows.length; i++) out.push(rowValueFn(rows[i]));
  return out;
}

// ── Query selection (since 0.1.147) ─────────────────────────────────────────

/**
 * The scope of a "select every row matching the query" selection: the
 * filter, search term and search index of the table's query — never its
 * sorting, columns or paging, which do not change WHICH rows match.
 */
export interface SelectionQuery {
  filter?: FilterExpr;
  search?: string;
  index?: string;
}

const SEARCH_INDEX_PREFIX = "$search:";

/**
 * The {@link SelectionQuery} of a table query: its filter and its `$search`
 * term — `$search:<index>` carries the index — with sorting, projection and
 * paging left out.
 */
export function selectionQueryOf(query: Uniquery): SelectionQuery {
  const out: SelectionQuery = {};
  if (query.filter && Object.keys(query.filter).length > 0) out.filter = query.filter;
  const controls = (query.controls ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(controls)) {
    if (key !== "$search" && !key.startsWith(SEARCH_INDEX_PREFIX)) continue;
    const term = controls[key];
    if (typeof term !== "string" && typeof term !== "number") continue;
    if (term === "") continue;
    out.search = `${term}`;
    if (key.length > SEARCH_INDEX_PREFIX.length) out.index = key.slice(SEARCH_INDEX_PREFIX.length);
  }
  return out;
}

/**
 * A stable string for a {@link SelectionQuery}: object keys sorted at every
 * depth, `undefined` / empty parts left out, `RegExp` and `Date` values
 * spelled out (plain `JSON.stringify` would collapse every regex to `{}`).
 * Two queries that match the same rows by construction produce the same
 * string, so a change of it is what invalidates a query selection.
 */
export function selectionSignature(query: SelectionQuery): string {
  const out: Record<string, unknown> = {};
  if (query.filter && Object.keys(query.filter).length > 0) out.filter = query.filter;
  if (query.search) out.search = query.search;
  if (query.index) out.index = query.index;
  return JSON.stringify(out, function (key, val: unknown) {
    // `this[key]` is the raw value — `Date#toJSON` has already run on `val`.
    const raw = (this as Record<string, unknown>)[key];
    if (raw instanceof RegExp) return { $re: raw.source, flags: raw.flags };
    if (raw instanceof Date) return { $date: raw.toISOString() };
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val).toSorted()) sorted[k] = (val as Record<string, unknown>)[k];
      return sorted;
    }
    return val;
  });
}
