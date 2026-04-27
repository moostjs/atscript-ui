/** Selection mode. */
export type SelectionMode = "none" | "single" | "multi";

/**
 * Toggle a single PK in the selection.
 *
 * - `"none"`: no-op (returns the same array reference).
 * - `"single"`: replaces the selection. Toggling the already-selected PK clears it.
 * - `"multi"`: adds when absent, removes when present. Order preserved on add (append).
 *
 * Always returns a new array on actual mutation; returns the same reference for `"none"`.
 */
export function togglePk(
  selection: readonly unknown[],
  pk: unknown,
  mode: SelectionMode,
): unknown[] {
  if (mode === "none") return selection as unknown[];
  if (mode === "single") {
    if (selection.length === 1 && selection[0] === pk) return [];
    return [pk];
  }
  const idx = selection.indexOf(pk);
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
