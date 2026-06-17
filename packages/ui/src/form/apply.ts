import type { FormDef } from "./types";
import type { FormFieldChange } from "./diff";
import { deleteByPath, setByPath } from "./path-utils";

// ── Apply a change list onto form data ───────────────────────

/**
 * Applies a {@link FormFieldChange} list onto a WRAPPED form-data container
 * (`{ value: domainData }`), mutating it in place and returning the same
 * reference. The inverse direction of {@link buildFormDiff}: where the diff
 * READS `(baseline, current)` into changes, this WRITES changes onto data.
 *
 * IMPORTANT: pass a CLONE, never the live fetched row — every write mutates
 * `data` directly. Callers that need the original intact should
 * `deepClone(data)` first (see {@link deepClone}).
 *
 * Per-change semantics (the single place the apply rules live, so
 * {@link buildFormRebase} stays consistent):
 *
 * - `kind: 'set'`:
 *   - `change.after === undefined` → DELETE the own key at `change.path` (walk
 *     to parent, `delete`). A cleared field must read as ABSENT, not as a
 *     present `undefined` own-key — otherwise a re-diff sees a structural
 *     mismatch where the form intends "no value". `setByPath(…, undefined)`
 *     leaves an own key behind, so we use {@link deleteByPath} instead.
 *   - otherwise → `setByPath(data, change.path, change.after)`.
 * - `kind: 'array'`: whole-array set via `setByPath(data, change.path,
 *   change.after)` (LOCKED Option A — no per-element merge; the diff already
 *   carried the full after-array).
 *
 * The `def` is currently unused by the apply walk (paths fully describe the
 * write target) but is part of the signature for parity with
 * `buildFormDiff`/`buildFormRebase`, so the rebase engine threads one `def`
 * uniformly through diff + apply.
 */
export function applyFormChanges(
  _def: FormDef,
  data: Record<string, unknown>,
  changes: FormFieldChange[],
): Record<string, unknown> {
  for (const change of changes) {
    if (change.kind === "set" && change.after === undefined) {
      deleteByPath(data, change.path);
    } else {
      setByPath(data, change.path, change.after);
    }
  }
  return data;
}
