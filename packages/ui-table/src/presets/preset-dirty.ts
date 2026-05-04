import { PRESET_ASPECTS } from "./preset-aspects";
import type { PresetSnapshot } from "./preset-types";

/**
 * JSON-stringify with object keys sorted alphabetically at every depth so
 * dict-shaped values (`columnWidths`, `filterOps` after deserialisation)
 * compare structurally regardless of insertion order. Arrays preserve order.
 *
 * Used by the localStorage draft serializer (where a stable string is
 * needed for storage); dirty detection prefers `isDirtyAgainst` (no
 * stringify, short-circuits on first mismatch).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val).toSorted()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

// Recursive structural equality that short-circuits on first mismatch and
// avoids allocations on the no-change path. Order-insensitive for plain
// objects, order-sensitive for arrays — matches `stableStringify` semantics
// without ever stringifying on the hot path (called per column-drag tick
// + per filter keystroke via `isDirty`).
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;
  if (aIsArr) {
    const aArr = a as unknown[];
    const bArr = b as unknown[];
    if (aArr.length !== bArr.length) return false;
    for (let i = 0; i < aArr.length; i++) {
      if (!deepEqual(aArr[i], bArr[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  if (aKeys.length !== Object.keys(bObj).length) return false;
  for (const k of aKeys) {
    if (!Object.hasOwn(bObj, k)) return false;
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

/**
 * Per-aspect dirty check: only aspects the active preset claims (key
 * present) are compared. A column-only preset stays clean while filters
 * change; a filter-ops-only preset doesn't dirty when columns reorder.
 *
 * `current` should be the full snapshot of all available aspects (i.e.
 * `captureSnapshot()` output) so each claimed aspect on the active preset
 * has something to compare against.
 */
export function isDirtyAgainst(active: PresetSnapshot, current: PresetSnapshot): boolean {
  for (const aspect of PRESET_ASPECTS) {
    const a = (active as Record<string, unknown>)[aspect];
    if (a === undefined) continue;
    const c = (current as Record<string, unknown>)[aspect];
    if (!deepEqual(a, c)) return true;
  }
  return false;
}
