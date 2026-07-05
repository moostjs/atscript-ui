import { encodeNavigateId, type TDbActionInfo } from "@atscript/db-client";

/**
 * Compute the href a `processor: 'navigate'` action would open — synchronously,
 * at render time. Mirrors the interpolation `Client` performs when the action
 * is invoked (`action.value` with every `$1` replaced by the URL-encoded,
 * `/`-joined `preferredId` fields — see `encodeNavigateId`), so tables can
 * render navigate actions as real `<a href>` anchors and native link behaviour
 * (middle-click → new tab, copy link, hover preview) just works.
 *
 * Returns `undefined` when no link is possible — the caller should fall back to
 * a button and let `Client` handle the invoke:
 *
 * - `action.processor !== 'navigate'` — backend/custom actions stay buttons;
 * - row-level action with `id === undefined` — the row is not identifiable
 *   (note this deliberately differs from `Client`, which navigates to the raw
 *   template in that case; a raw-template href would be a broken link);
 * - row-level action with an empty `preferredId` — `$1` has nothing to encode.
 *
 * Table/rows-level navigate actions carry no `$1` placeholder and return
 * `action.value` verbatim.
 */
export function navigateHrefFor(
  action: TDbActionInfo,
  id: Record<string, unknown> | undefined,
  preferredId: readonly string[],
): string | undefined {
  if (action.processor !== "navigate") return undefined;
  if (action.level !== "row") return action.value;
  if (id === undefined || preferredId.length === 0) return undefined;
  return action.value.replace(/\$1/g, encodeNavigateId(id, preferredId));
}
