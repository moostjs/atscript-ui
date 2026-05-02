import { formatIdentifier, type TDbActionInfo, type TDbActionProcessor } from "@atscript/db-client";
import {
  REMOVE_PROCESSOR,
  type ConfirmScope,
  type ReactiveTableState,
  type TVueTableActionInfo,
} from "../../types";

type ActionLevel = TVueTableActionInfo["level"];

/**
 * Processors exempt from the per-row `$actions` gate: `navigate`/`custom`
 * have no backend to ask, and `__remove` is synthesised client-side.
 */
const EXEMPT_PROCESSORS = new Set<TDbActionProcessor | typeof REMOVE_PROCESSOR>([
  "navigate",
  "custom",
  REMOVE_PROCESSOR,
]);

/**
 * Build a per-row availability predicate from `row.$actions: string[]`
 * (server-evaluated names of NOT-disabled row/rows-level actions for that
 * row). Returns `null` when the row carries no `$actions` (legacy server,
 * `?$actions` opt-out, or table-level surfaces) so callers can skip the
 * filter pass and keep the source-array reference stable.
 */
export function rowActionGate(row: unknown): ((a: TVueTableActionInfo) => boolean) | null {
  const raw = (row as { $actions?: unknown } | null | undefined)?.$actions;
  if (!Array.isArray(raw)) return null;
  const allowed = raw as string[];
  return (a) => EXEMPT_PROCESSORS.has(a.processor) || allowed.includes(a.name);
}

export interface ActionBuckets {
  default: TVueTableActionInfo | undefined;
  others: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
}

/**
 * Apply the per-row `$actions` gate to a `{default, others, rows}` triple.
 * When the row carries no `$actions`, returns the input unchanged so
 * source-array references stay stable downstream (no spurious recomputes
 * in consumers that compare array identity).
 */
export function applyRowGate(buckets: ActionBuckets, row: unknown): ActionBuckets {
  const gate = rowActionGate(row);
  if (!gate) return buckets;
  return {
    default: buckets.default && gate(buckets.default) ? buckets.default : undefined,
    others: buckets.others.filter(gate),
    rows: buckets.rows.filter(gate),
  };
}

/**
 * Map `TDbActionInfo['intent']` (positive/negative/warning/primary/secondary)
 * onto a vunor scope name accepted by `state.prompt()`. Used by row-actions
 * and table-actions cells when surfacing an action's confirmation dialog —
 * `negative → error`, `positive → good`, `warning → warn`, the rest pass
 * through verbatim. Undefined intent → undefined scope (button stays default
 * primary via the dialog's `c8-filled` chrome).
 */
export function intentToScope(intent: TDbActionInfo["intent"]): ConfirmScope | undefined {
  switch (intent) {
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
 * Build the identifier object to forward to `client.action` / `client.remove`.
 *
 * Per `@atscript/db-client` invariant #11, identifier bodies are object-only
 * — never bare scalars, even for single-field PK tables. This helper accepts:
 * - a row-shaped object (default `rowValueFn`) → picks `preferredId` fields;
 * - a scalar value when `preferredId` has exactly one field (consumers that
 *   override `rowValueFn` to return the PK scalar) → wraps it.
 *
 * Returns `undefined` when no `preferredId` is declared, the source is
 * `null`/`undefined`, or a scalar can't be paired with a single-field
 * identifier.
 */
export function extractIdentifier(
  source: unknown,
  preferredId: readonly string[],
): Record<string, unknown> | undefined {
  if (source === undefined || source === null) return undefined;
  if (preferredId.length === 0) return undefined;

  if (typeof source === "object" && !Array.isArray(source)) {
    const row = source as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of preferredId) out[k] = row[k];
    return out;
  }

  if (preferredId.length === 1) {
    return { [preferredId[0]!]: source };
  }

  return undefined;
}

/**
 * Map a list of sources (rows or row-shaped values) through `extractIdentifier`,
 * dropping any that resolve to `undefined`.
 */
export function collectIdentifiers(
  sources: readonly unknown[],
  preferredId: readonly string[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const s of sources) {
    const id = extractIdentifier(s, preferredId);
    if (id !== undefined) out.push(id);
  }
  return out;
}

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

/** Context for prompt-text substitution. */
export interface PromptCtx {
  /** Identifier objects for the targeted rows (in invocation order). `length` doubles as the row count for `$N` and singular/plural selection. */
  identifiers: Record<string, unknown>[];
  /** Preferred-id field order, used to render `$1`. */
  preferredId: readonly string[];
}

/**
 * Run `state.prompt()` if the action declares a `promptText`. Resolves
 * `true` on accept, or `true` immediately when no prompt is needed.
 *
 * `promptText` may be a string or `[singular, plural]` tuple. Tuple form
 * picks `singular` when there is at most one identifier, `plural` otherwise.
 * Substitutions:
 * - `$1` → `formatIdentifier(ctx.identifiers[0], ctx.preferredId)`
 * - `$N` → `String(ctx.identifiers.length)`
 */
export async function confirmAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
): Promise<boolean> {
  const raw = action.promptText;
  if (!raw) return true;
  const count = ctx.identifiers.length;
  const template = Array.isArray(raw) ? (count <= 1 ? raw[0]! : raw[1]!) : raw;
  const message = substitute(template, ctx);
  return state.prompt(message, { scope: intentToScope(action.intent) });
}

/** Substitute `$1` and `$N` into a prompt-text template. */
export function substitute(template: string, ctx: PromptCtx): string {
  return template
    .replace(/\$1/g, () => formatIdentifier(ctx.identifiers[0], ctx.preferredId))
    .replace(/\$N/g, () => String(ctx.identifiers.length));
}

/**
 * Pick the `pk` argument to forward to `state.actions.invoke` based on the
 * action's level. `'table'` → `undefined`; `'row'` → first identifier;
 * `'rows'` → full array.
 */
export function pkForLevel(
  level: ActionLevel,
  ids: Record<string, unknown>[],
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  if (level === "table") return undefined;
  if (level === "row") return ids[0];
  return ids;
}

/**
 * Inverse of `pkForLevel`: shape the `ids[]` surfaced by the `@action` emit
 * from the `pk` value passed to `invoke`.
 */
export function idsForAction(
  level: ActionLevel,
  pk: Record<string, unknown> | Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  if (level === "table") return [];
  if (level === "rows") return Array.isArray(pk) ? pk : pk === undefined ? [] : [pk];
  return pk === undefined ? [] : [pk as Record<string, unknown>];
}
