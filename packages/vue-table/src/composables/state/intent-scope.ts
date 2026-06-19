import { formatIdentifier, type TDbActionInfo } from "@atscript/db-client";
import {
  REMOVE_PROCESSOR,
  type ConfirmScope,
  type ReactiveTableState,
  type TVueTableActionInfo,
} from "../../types";

type ActionLevel = TVueTableActionInfo["level"];

/**
 * Read a row's server-evaluated `$actions: string[]` — the names of NOT-disabled
 * row/rows-level actions for that row. Returns `null` when the row carries no
 * `$actions` (legacy server, `?$actions` opt-out, or table-level surfaces) so
 * callers can skip the filter pass and keep the source-array reference stable.
 */
function actionNamesOf(row: unknown): string[] | null {
  const raw = (row as { $actions?: unknown } | null | undefined)?.$actions;
  return Array.isArray(raw) ? (raw as string[]) : null;
}

/**
 * Predicate factory: an action is available when its name is in `allowed`. The
 * synthesised remove action (`REMOVE_PROCESSOR`) is the sole exemption — it is
 * built client-side and its name never appears in the server's `$actions`, so
 * its visibility is governed by `canRemove` (the server still authorises the
 * actual delete at call time). Shared by the single-row and bulk gates.
 */
function gateFor(allowed: Set<string>): (a: TVueTableActionInfo) => boolean {
  return (a) => a.processor === REMOVE_PROCESSOR || allowed.has(a.name);
}

/**
 * Build a per-row availability predicate from `row.$actions`. Every
 * server-declared row/rows action — regardless of processor (`backend`,
 * `navigate`, `custom`, …) — is gated by its per-row `$actions` verdict: the
 * server augmenter evaluates each action's `disabled` predicate for the row and
 * emits the surviving names. Returns `null` when the row carries no `$actions`
 * (see {@link actionNamesOf}).
 */
export function rowActionGate(row: unknown): ((a: TVueTableActionInfo) => boolean) | null {
  const names = actionNamesOf(row);
  return names ? gateFor(new Set(names)) : null;
}

export interface ActionBuckets {
  default: TVueTableActionInfo | undefined;
  others: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
}

/**
 * Filter a `{default, others, rows}` triple through an availability `gate`.
 * When `gate` is `null`, returns the input `buckets` reference unchanged so
 * source-array references stay stable downstream (no spurious recomputes in
 * consumers that compare array identity). Shared by the single-row
 * (`applyRowGate`) and bulk (`applyRowsGate`) paths.
 */
function applyGate(
  buckets: ActionBuckets,
  gate: ((a: TVueTableActionInfo) => boolean) | null,
): ActionBuckets {
  if (!gate) return buckets;
  return {
    default: buckets.default && gate(buckets.default) ? buckets.default : undefined,
    others: buckets.others.filter(gate),
    rows: buckets.rows.filter(gate),
  };
}

/**
 * Apply the single-row {@link rowActionGate} to a `{default, others, rows}`
 * triple; identity-stable when the row carries no `$actions` (see {@link applyGate}).
 */
export function applyRowGate(buckets: ActionBuckets, row: unknown): ActionBuckets {
  return applyGate(buckets, rowActionGate(row));
}

/**
 * Build a BULK availability predicate from the UNION of every selected row's
 * server `$actions`: an action is shown when AT LEAST ONE selected row allows
 * it, even if absent from the rest. This is safe because the `@atscript/db`
 * layer re-filters each row server-side at invoke time, so a subset-enabled
 * action simply no-ops on the rows that don't qualify — strictly better UX
 * than hiding an action a portion of the selection can use. The synthesised
 * remove action (`REMOVE_PROCESSOR`) is the sole exemption: it is built
 * client-side and never appears in any server `$actions`. Returns `null` when
 * NO selected row carries a `$actions` array (legacy server / `?$actions`
 * opt-out) so callers skip the filter pass and keep array identity stable;
 * rows with an empty `$actions: []` still count as "the server spoke" and
 * therefore disable normal actions.
 */
export function rowsActionGate(
  rows: readonly unknown[],
): ((a: TVueTableActionInfo) => boolean) | null {
  let union: Set<string> | null = null;
  for (const row of rows) {
    const names = actionNamesOf(row);
    if (!names) continue;
    if (union === null) union = new Set<string>();
    for (const name of names) union.add(name);
  }
  return union ? gateFor(union) : null;
}

/**
 * Apply the BULK union gate to a `{default, others, rows}` triple. See
 * {@link rowsActionGate} for the union semantics; identity-stable (returns
 * the input `buckets` reference) when no selected row carries `$actions`.
 */
export function applyRowsGate(buckets: ActionBuckets, rows: readonly unknown[]): ActionBuckets {
  return applyGate(buckets, rowsActionGate(rows));
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
 * Map a list of sources (full row objects or scalar `rowValueFn` values)
 * through `extractIdentifier`. Scalar sources rehydrate from
 * `state.windowCache` via `state.rowValueFn` so consumers that override
 * `rowValueFn` to return a scalar can still reconstruct multi-field
 * identifiers; the lookup `Map` is built lazily so all-object source
 * lists pay nothing.
 */
export function collectIdentifiers(
  state: ReactiveTableState,
  sources: readonly unknown[],
  preferredId: readonly string[],
): Record<string, unknown>[] {
  if (preferredId.length === 0 || sources.length === 0) return [];
  const out: Record<string, unknown>[] = [];
  let lookup: Map<unknown, Record<string, unknown>> | null = null;
  for (const s of sources) {
    if (s === undefined || s === null) continue;
    let row: Record<string, unknown> | undefined;
    if (typeof s === "object") {
      row = s as Record<string, unknown>;
    } else {
      if (lookup === null) {
        const fn = state.rowValueFn;
        lookup = new Map();
        for (const r of state.windowCache.value.values()) lookup.set(fn(r), r);
      }
      row = lookup.get(s);
    }
    const id = extractIdentifier(row ?? s, preferredId);
    if (id) out.push(id);
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
 * Dispatch user-initiated invocation: actions with `inputForm` open the form
 * dialog (the form IS the confirm surface, so `promptText` is ignored);
 * others run `confirmAction()`. Cancelling either dialog short-circuits.
 */
export async function triggerAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
  event?: KeyboardEvent | MouseEvent,
): Promise<void> {
  const pk = pkForLevel(action.level, ctx.identifiers);
  if (action.inputForm) {
    const input = await state.requestActionInput(action, ctx);
    if (input === null) return;
    void state.actions.invoke(action, pk, { event, input });
    return;
  }
  const ok = await confirmAction(state, action, ctx);
  if (!ok) return;
  void state.actions.invoke(action, pk, { event });
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
