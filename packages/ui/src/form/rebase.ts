import type { FormDef } from "./types";
import { type FormDiffOptions, type FormFieldChange, buildFormDiff, deepEqual } from "./diff";
import { applyFormChanges } from "./apply";
import { deepClone } from "./clone";
import { getByPath, setByPath } from "./path-utils";

// ── Public contract ──────────────────────────────────────────

/** Options for {@link buildFormRebase}. */
export interface FormRebaseOptions {
  /**
   * How to resolve a field changed on BOTH sides (local edit vs. upstream
   * edit) to a different value:
   * - `'ours'` (default) — keep the local edit, discard upstream's value.
   * - `'theirs'` — take upstream's value, discard the local edit.
   *
   * A field changed on both sides to the SAME value is never a conflict.
   */
  conflict?: "ours" | "theirs";
}

/** Result of {@link buildFormRebase}. */
export interface FormRebaseResult {
  /**
   * The rebased WRAPPED form-data container (`{ value }`). Always a fresh deep
   * clone of `upstream` with the local diff reapplied — never aliases any
   * input container.
   */
  next: Record<string, unknown>;
  /**
   * Paths that were changed on both sides to different values (same-path
   * conflicts), plus ancestor paths whose subtree upstream cleared while local
   * still edited a leaf under it (ancestor-clear conflicts). De-duplicated.
   */
  conflicts: string[];
  /**
   * The diff of `next` against the NEW baseline (`upstream`) — i.e. exactly the
   * changes that survive on top of upstream. Empty `[]` when the rebased form
   * equals upstream (a fully clean / fully reverted rebase).
   *
   * The returned `reapplied` does NOT alias the returned `next`, so installing
   * `next` as live form data never retroactively mutates the returned change set.
   */
  reapplied: FormFieldChange[];
}

// ── Entry point ──────────────────────────────────────────────

/**
 * Pure 3-way rebase for a change-tracked form. Given the current baseline `B0`,
 * the live form `C`, and a fresh upstream `U`, produces the form rewritten as
 * `U` + the local diff (`C` vs `B0`) reapplied on top:
 *
 * - Fields the user never touched adopt upstream's value.
 * - Local edits survive (reapplied onto the upstream clone).
 * - Fields changed on BOTH sides to different values are conflicts, resolved by
 *   `opts.conflict` (`'ours'` keeps local, `'theirs'` takes upstream).
 *
 * All inputs are WRAPPED form-data containers (`{ value: domainData }`). The
 * result `next` is a fresh container; no input is mutated.
 *
 * `diffOptions` are forwarded to BOTH internal `buildFormDiff` passes so the
 * same field exclusions apply (notably the `@db.column.version` column and the
 * `$cas` policy) on the local and upstream sides — keep them identical to the
 * options the caller uses for its own change tracking.
 */
export function buildFormRebase(
  def: FormDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  upstream: Record<string, unknown>,
  opts?: FormRebaseOptions,
  diffOptions?: FormDiffOptions,
): FormRebaseResult {
  const conflictMode = opts?.conflict ?? "ours";

  // a. Local edits (revert-aware): B0 → C.
  const local = buildFormDiff(def, baseline, current, diffOptions).changes;

  // b. Upstream edits (revert-aware): B0 → U, indexed by path.
  const upstreamChanges = buildFormDiff(def, baseline, upstream, diffOptions).changes;
  const upstreamByPath = new Map<string, FormFieldChange>();
  for (const uc of upstreamChanges) upstreamByPath.set(uc.path, uc);

  // c. Start from a clone of upstream — untouched fields already carry U's value.
  const next = deepClone(upstream);

  // Collected WITH duplicates (one cleared ancestor is hit once per leaf beneath
  // it); de-duplicated in a single pass at the return (insertion order kept).
  const conflicts: string[] = [];

  // d. Reapply each local change onto `next`, classifying conflicts.
  for (const lc of local) {
    // ANCESTOR-CLEAR (checked FIRST): upstream nulled a parent object/array that
    // local edited a leaf under. This DOMINATES any same-path upstream entry,
    // because a wholesale parent clear in `buildFormDiff` ALSO emits per-leaf
    // `set → undefined` changes (the recursion records each leaf even though the
    // patch is a single `parent: null`). Treating those as same-path conflicts
    // would mis-record the conflict at the leaf and try to set a leaf into a
    // cleared parent — forging a partial object. Conflict at the cleared
    // ANCESTOR instead (the whole subtree), recorded once per ancestor.
    const clearedAncestor = findClearedAncestor(lc.path, baseline, upstream);
    if (clearedAncestor !== undefined) {
      conflicts.push(clearedAncestor);
      if (conflictMode === "ours") {
        // Restore the WHOLE local subtree (no partials).
        setByPath(next, clearedAncestor, deepClone(getByPath(current, clearedAncestor)));
      }
      // 'theirs' → leave upstream's null. Either way, skip the per-leaf reapply.
      continue;
    }

    const uc = upstreamByPath.get(lc.path);

    // SAME-PATH: only a CONFLICT when the two sides landed DIFFERENT values.
    // Identical after-values on both sides are NOT a conflict — `next` already
    // holds that value from the upstream clone, so nothing to reapply.
    if (uc !== undefined) {
      if (deepEqual(lc.after, uc.after)) continue;
      conflicts.push(lc.path);
      if (conflictMode === "ours") reapply(def, next, lc);
      // 'theirs' → leave `next` at upstream's value (already in the clone).
      continue;
    }

    // OTHERWISE: local-only change with parent intact — reapply onto `next`.
    reapply(def, next, lc);
  }

  // (e) The surviving diff on top of the new baseline (== upstream). Diff against
  // a CLONE of `next` so `reapplied` never aliases the returned `next`: the caller
  // installs `next` as live form data, and a later edit would otherwise mutate the
  // already-returned change set. This mirrors vue-form's `getChanges()`, which
  // de-aliases by diffing against a frozen clone of current. (`before` values still
  // reference `upstream` — the new baseline — exactly like `getChanges()[].before`
  // references the baseline; that shared, read-only aliasing is the accepted contract.)
  const reapplied = buildFormDiff(def, upstream, deepClone(next), diffOptions).changes;

  return { next, conflicts: [...new Set(conflicts)], reapplied };
}

/**
 * Reapplies a single local change onto `next`, DEEP-CLONING its `after` value
 * first. `lc.after` is a LIVE reference into `current` (buildFormDiff holds live
 * refs), so for a `kind:'array'` or whole-object/union `set` change a raw apply
 * would make `next.value`'s node `===` `current.value`'s node — violating the
 * `FormRebaseResult.next` contract ("never aliases any input container"). The
 * ancestor-clear branch already deep-clones before writing; this keeps the two
 * leaf-reapply sites consistent.
 */
function reapply(def: FormDef, next: Record<string, unknown>, lc: FormFieldChange): void {
  applyFormChanges(def, next, [{ ...lc, after: deepClone(lc.after) }]);
}

/**
 * Returns the SHALLOWEST strict ancestor of `leafPath` that was an object/array
 * in `baseline` but is `null`/`undefined` in `upstream` (upstream cleared the
 * subtree), or `undefined` when no ancestor was cleared. The leaf path itself is
 * never considered an ancestor.
 */
function findClearedAncestor(
  leafPath: string,
  baseline: Record<string, unknown>,
  upstream: Record<string, unknown>,
): string | undefined {
  if (!leafPath.includes(".")) return undefined;
  const segs = leafPath.split(".");
  let acc = "";
  // Walk ancestors shallowest-first (`a`, `a.b`, … but NOT the leaf), so a
  // wholesale-cleared outer object is recorded once for every leaf beneath it.
  for (let i = 0; i < segs.length - 1; i++) {
    acc = acc ? `${acc}.${segs[i]}` : segs[i]!;
    const base = getByPath(baseline, acc);
    // Object OR array — a cleared subtree of either kind counts as an ancestor.
    if (typeof base !== "object" || base === null) continue;
    const up = getByPath(upstream, acc);
    if (up === null || up === undefined) return acc;
  }
  return undefined;
}
