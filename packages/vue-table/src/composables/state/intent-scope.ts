import type { TDbActionInfo } from "@atscript/db-client";
import type { ConfirmScope, ReactiveTableState, TVueTableActionInfo } from "../../types";

type ActionLevel = TVueTableActionInfo["level"];

/**
 * Map `TDbActionInfo['intent']` (positive/negative/warning/primary/secondary)
 * onto a vunor scope name accepted by `state.prompt()`. Used by row-actions
 * and table-actions cells when surfacing an action's confirmation dialog —
 * `negative → error`, `positive → good`, `warning → warn`, the rest pass
 * through verbatim. Undefined intent → undefined scope (button stays default
 * primary via the dialog's `c8-filled` chrome).
 */
export function intentToScope(intent: TDbActionInfo["intent"]): ConfirmScope | undefined {
  // Cast to widen for `"warning"` — forward-compat with @atscript/db's
  // pending intent expansion; remove the cast once the field lands.
  switch (intent as string | undefined) {
    case "positive":
      return "good";
    case "negative":
      return "error";
    case "warning":
      return "warn";
    case "primary":
      return "primary";
    case "secondary":
      return "secondary";
    default:
      return undefined;
  }
}

/**
 * Extract the primary-key value to pass to `client.action` / `client.remove`.
 * Single-PK tables forward the field value; composite-PK tables forward a
 * `{ key: value }` map; tables with no declared PKs (or no row) return
 * `undefined` (table-level / synthetic actions).
 */
export function extractPk(
  row: Record<string, unknown> | undefined,
  primaryKeys: string[],
): unknown {
  if (!row) return undefined;
  if (primaryKeys.length === 0) return undefined;
  if (primaryKeys.length === 1) return row[primaryKeys[0]!];
  return Object.fromEntries(primaryKeys.map((k) => [k, row[k]]));
}

/**
 * Format a row's primary key for substitution into prompt text. Composite
 * PKs render as `k1=v1, k2=v2` (readable in a sentence); scalar PKs
 * stringify directly. `undefined`/`null` becomes the empty string.
 */
export function formatPk(pk: unknown): string {
  if (pk === undefined || pk === null) return "";
  if (typeof pk === "object") {
    return Object.entries(pk as Record<string, unknown>)
      .map(([k, v]) => `${k}=${formatScalar(v)}`)
      .join(", ");
  }
  return formatScalar(pk);
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  return JSON.stringify(v);
}

/** Aria-label / title text for an action button. */
export function ariaLabelFor(action: TVueTableActionInfo): string {
  return action.label || action.name;
}

/**
 * Compose the runtime intent class — `as-{prefix}-intent-{intent}` — applied
 * by both `<AsRowActions>` and `<AsTableActions>` on buttons + menu items.
 * Returns `undefined` when the action declares no intent so callers can
 * spread the result into a class array without conditional plumbing.
 */
export function intentClass(prefix: string, action: TVueTableActionInfo): string | undefined {
  return action.intent ? `${prefix}-intent-${action.intent}` : undefined;
}

/**
 * Run `state.prompt()` if the action declares a `promptText`. Resolves
 * `true` on accept, or `true` immediately when no prompt is needed. The
 * optional `substitute` callback transforms the raw `promptText` so callers
 * can inject e.g. `{pk}` substitutions before the dialog renders.
 */
export async function confirmAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  substitute?: (text: string) => string,
): Promise<boolean> {
  if (!action.promptText) return true;
  const message = substitute ? substitute(action.promptText) : action.promptText;
  return state.prompt(message, { scope: intentToScope(action.intent) });
}

/**
 * Pick the `pk` argument to forward to `state.actions.invoke` based on the
 * action's level. `'table'` → no pk, `'row'` → first id, `'rows'` → full array.
 */
export function pkForLevel(level: ActionLevel, ids: unknown[]): unknown {
  if (level === "table") return undefined;
  if (level === "row") return ids[0];
  return ids;
}

/**
 * Inverse of `pkForLevel`: shape the `ids[]` surfaced by the `@action` emit
 * from the `pk` value passed to `invoke`.
 */
export function idsForAction(level: ActionLevel, pk: unknown): unknown[] {
  if (level === "table") return [];
  if (level === "rows") return Array.isArray(pk) ? pk : pk === undefined ? [] : [pk];
  return pk === undefined ? [] : [pk];
}
