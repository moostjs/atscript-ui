import { formatIdentifier, type TDbActionInfo } from "@atscript/db-client";
import { navigateHrefFor } from "@atscript/ui";
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
 * A row's raw `$disabledReasons` object — action name → the reason its
 * `disabled` predicate returned for that row (`@atscript/db` 0.1.141+) — or
 * `null` when it is missing or not a plain object. Read lazily (no copy): the
 * gates look names up with {@link ownReason}.
 */
function reasonsObjectOf(row: unknown): Record<string, unknown> | null {
  const raw = (row as { $disabledReasons?: unknown } | null | undefined)?.$disabledReasons;
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

/**
 * `raw[name]` when it is an OWN non-empty string, else `undefined` — so an
 * action named after an `Object.prototype` member (`constructor`,
 * `toString`) never reads an inherited function as its verdict, and a
 * malformed value can never surface an action (it only decides between
 * disabled and hidden).
 */
function ownReason(raw: Record<string, unknown>, name: string): string | undefined {
  if (!Object.hasOwn(raw, name)) return undefined;
  const reason = raw[name];
  return typeof reason === "string" && reason !== "" ? reason : undefined;
}

/**
 * Per-action verdict of a gate: `true` keeps the action as is, `false` drops
 * it (hidden), a non-empty string keeps it DISABLED with that string as the
 * reason (`""` counts as `true`).
 */
export type ActionVerdict = boolean | string;
export type ActionGate = (a: TVueTableActionInfo) => ActionVerdict;

/**
 * Apply one verdict to `a`: `false` → `undefined` (dropped), a non-empty
 * string → a COPY carrying `disabledReason` (shared source descriptors are
 * never mutated), anything else → `a` itself.
 */
export function withVerdict(
  a: TVueTableActionInfo,
  verdict: ActionVerdict,
): TVueTableActionInfo | undefined {
  if (verdict === false) return undefined;
  return typeof verdict === "string" && verdict !== "" ? { ...a, disabledReason: verdict } : a;
}

/**
 * Gate factory: an action is available when its name is in `allowed`; one
 * that is not but has a reason (`reasonOf`) is shown disabled with it; any
 * other is hidden (disabled without a reason). The synthesised remove action
 * (`REMOVE_PROCESSOR`) is the sole exemption — it is built client-side and its
 * name never appears in the server's `$actions`, so its visibility is
 * governed by `canRemove` (the server still authorises the actual delete at
 * call time). Shared by the single-row and bulk gates.
 */
function gateFor(allowed: Set<string>, reasonOf: (name: string) => string | undefined): ActionGate {
  return (a) =>
    a.processor === REMOVE_PROCESSOR || allowed.has(a.name) || (reasonOf(a.name) ?? false);
}

const NO_REASON = (): undefined => undefined;

/**
 * Build a per-row availability gate from `row.$actions` + `row.$disabledReasons`.
 * Every server-declared row/rows action — regardless of processor (`backend`,
 * `navigate`, `custom`, …) — is gated by its per-row verdict: the server
 * augmenter evaluates each action's `disabled` predicate for the row and emits
 * the surviving names, plus the reason of each action disabled WITH one.
 * In `$actions` → enabled; in `$disabledReasons` → disabled with the reason;
 * in neither → hidden. Returns `null` when the row carries no `$actions`
 * (see {@link actionNamesOf}).
 */
export function rowActionGate(row: unknown): ActionGate | null {
  const names = actionNamesOf(row);
  if (!names) return null;
  const raw = reasonsObjectOf(row);
  return gateFor(new Set(names), raw ? (name) => ownReason(raw, name) : NO_REASON);
}

/**
 * `true` when `action` is a gated copy kept DISABLED (`disabledReason`) —
 * rendered, never triggered. The one predicate every surface checks.
 */
export function isActionDisabled(action: TVueTableActionInfo): boolean {
  return !!action.disabledReason;
}

export interface ActionBuckets {
  default: TVueTableActionInfo | undefined;
  others: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
}

/**
 * Walk a `{default, others, rows}` triple once: apply `gate`'s verdict to
 * each action ({@link withVerdict}), then run each survivor through `map`.
 * Both are optional. Source references stay stable downstream (no spurious
 * recomputes in consumers that compare array identity): an array whose every
 * action comes back unchanged is returned as is, and so is the whole
 * `buckets` object when nothing changed. Shared by the single-row, bulk
 * (`applyRowsGate`) and per-screen-policy paths.
 */
export function applyGate(
  buckets: ActionBuckets,
  gate: ActionGate | null,
  map?: (a: TVueTableActionInfo) => TVueTableActionInfo,
): ActionBuckets {
  if (!gate && !map) return buckets;
  const admit = (a: TVueTableActionInfo): TVueTableActionInfo | undefined => {
    const kept = gate ? withVerdict(a, gate(a)) : a;
    return kept && map ? map(kept) : kept;
  };
  const walk = (list: TVueTableActionInfo[]): TVueTableActionInfo[] => {
    let out: TVueTableActionInfo[] | null = null;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      const kept = admit(a);
      if (out === null) {
        if (kept === a) continue;
        out = list.slice(0, i);
      }
      if (kept) out.push(kept);
    }
    return out ?? list;
  };
  const def = buckets.default && admit(buckets.default);
  const others = walk(buckets.others);
  const rows = walk(buckets.rows);
  return def === buckets.default && others === buckets.others && rows === buckets.rows
    ? buckets
    : { default: def, others, rows };
}

/** Distinct reasons listed on a bulk surface before the rest collapse into "+N more". */
const MAX_BULK_REASONS = 3;

function joinReasons(reasons: ReadonlySet<string>): string {
  const list = [...reasons];
  if (list.length <= MAX_BULK_REASONS) return list.join("; ");
  const rest = list.length - MAX_BULK_REASONS;
  return `${list.slice(0, MAX_BULK_REASONS).join("; ")}; +${rest} more`;
}

/**
 * Build a BULK availability gate from the UNION of every selected row's
 * server `$actions`: an action is enabled when AT LEAST ONE selected row allows
 * it, even if absent from the rest. The server re-checks every row at invoke
 * time (`onDisabledRows`: `'skip'` runs on the qualifying rows, `'reject'` —
 * the default — answers 409 with the per-row reasons, surfaced as the
 * action's error result), so offering an action part of the selection can use
 * is strictly better UX than hiding it. An action NO selected row allows is
 * shown disabled when at least one row gave a reason (the distinct reasons
 * joined, capped at {@link MAX_BULK_REASONS}), hidden otherwise. The
 * synthesised remove action (`REMOVE_PROCESSOR`) is the sole exemption: it is
 * built client-side and never appears in any server `$actions`. Returns `null`
 * when NO row carries a `$actions` array (legacy server / `?$actions` opt-out)
 * so callers skip the filter pass and keep array identity stable; rows with an
 * empty `$actions: []` still count as "the server spoke" and therefore disable
 * normal actions. Pass only rows that are loaded — see `state.selectedRowObjects`.
 */
export function rowsActionGate(rows: readonly unknown[]): ActionGate | null {
  let union: Set<string> | null = null;
  let reasons: Map<string, Set<string>> | null = null;
  for (const row of rows) {
    const names = actionNamesOf(row);
    if (!names) continue;
    union ??= new Set<string>();
    for (const name of names) union.add(name);
    const raw = reasonsObjectOf(row);
    if (!raw) continue;
    for (const name of Object.keys(raw)) {
      const reason = raw[name];
      if (typeof reason !== "string" || reason === "") continue;
      reasons ??= new Map();
      let set = reasons.get(name);
      if (!set) reasons.set(name, (set = new Set()));
      set.add(reason);
    }
  }
  if (!union) return null;
  if (!reasons) return gateFor(union, NO_REASON);
  // Joined lazily, once per asked name — most names are enabled and never ask.
  const byName = reasons;
  const joined = new Map<string, string>();
  return gateFor(union, (name) => {
    let text = joined.get(name);
    if (text === undefined) {
      const set = byName.get(name);
      if (!set) return undefined;
      joined.set(name, (text = joinReasons(set)));
    }
    return text;
  });
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
 * through `extractIdentifier`. Scalar sources resolve to their loaded row via
 * `state.rowOf` so consumers that override `rowValueFn` to return a scalar
 * can still reconstruct multi-field identifiers; a scalar whose row is not
 * loaded falls back to itself (a single-field `preferredId` wraps it).
 */
export function collectIdentifiers(
  state: ReactiveTableState,
  sources: readonly unknown[],
  preferredId: readonly string[],
): Record<string, unknown>[] {
  if (preferredId.length === 0 || sources.length === 0) return [];
  const out: Record<string, unknown>[] = [];
  for (const s of sources) {
    if (s === undefined || s === null) continue;
    const id = extractIdentifier(state.rowOf(s) ?? s, preferredId);
    if (id) out.push(id);
  }
  return out;
}

/**
 * Accessible name of an action trigger. A disabled action appends its reason
 * (`"Ship, Order already shipped"` — the same `label, reason` shape as the
 * selection checkbox of a non-selectable row), so screen readers announce WHY
 * next to the disabled state.
 */
export function ariaLabelFor(action: TVueTableActionInfo): string {
  const label = action.label || action.name;
  return action.disabledReason ? `${label}, ${action.disabledReason}` : label;
}

/** `aria-disabled` value for a rendered action — `"true"` on a disabled copy, else unset. */
export function ariaDisabled(action: TVueTableActionInfo): "true" | undefined {
  return isActionDisabled(action) ? "true" : undefined;
}

/**
 * Whether a trigger renders as a real anchor: it has a resolved `href` and no
 * `promptText` (a confirm dialog must guard the navigation, so a prompted
 * action stays a button — mod/middle-click on it still confirms → new tab).
 * A disabled action never has an href (see `rowActionHref`), so it is never
 * a link.
 */
export function isLinkTrigger(action: TVueTableActionInfo, href: string | undefined): boolean {
  return href !== undefined && !action.promptText;
}

/**
 * Element + attributes of a primary action trigger (the single row-actions
 * button, the toolbar default) — the one home for anchor-vs-button and the
 * disabled rendering: a disabled action is an `aria-disabled` button (kept
 * focusable so the reason in its accessible name / tooltip stays reachable).
 */
export function triggerBindings(action: TVueTableActionInfo, href: string | undefined) {
  const asLink = isLinkTrigger(action, href);
  const label = ariaLabelFor(action);
  return {
    tag: asLink ? "a" : "button",
    attrs: {
      href: asLink ? href : undefined,
      type: asLink ? undefined : "button",
      "aria-disabled": ariaDisabled(action),
      "aria-label": label,
      title: label,
    },
  } as const;
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
 * `true` for an unmodified main-button click — the only click an anchor-mode
 * navigate action intercepts (preventDefault + SPA invoke path). Modified /
 * middle / right clicks fall through to native anchor behaviour. Mirrors
 * vue-router's `guardEvent`, including the bail on an already-handled event.
 */
export function isPlainLeftClick(e: MouseEvent): boolean {
  return (
    !e.defaultPrevented && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
  );
}

/** `true` for the "open in new tab" chord on a button: cmd/ctrl + main-button click. */
export function isModClick(e: MouseEvent): boolean {
  return e.button === 0 && (e.ctrlKey || e.metaKey);
}

/**
 * Render-time href for a `processor: 'navigate'` action, mapped through
 * `state.resolveHref`. Returns `undefined` when no link is possible —
 * non-navigate processors, actions with an `inputForm` (the dialog IS the
 * interaction), or a row-level action without a computable identifier — so
 * callers keep the plain button + invoke path. Actions WITH `promptText`
 * still get their href (the button's mod/middle-click new-tab path needs
 * it); whether to render an anchor is the call site's `promptText` check.
 */
export function actionHref(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  id: Record<string, unknown> | undefined,
): string | undefined {
  if (action.processor !== "navigate" || action.inputForm) return undefined;
  const href = navigateHrefFor(
    action as TDbActionInfo,
    id,
    state.tableDef.value?.preferredId ?? [],
  );
  return href === undefined ? undefined : state.resolveHref(href);
}

/**
 * "Open in new tab" path for navigate actions: run the action's confirmation
 * (immediate accept when it declares no `promptText`), then hand the already
 * `resolveHref`-mapped `href` to the browser via `window.open`. Never touches
 * `state.actions.invoke` and never reaches the `@action` emit — the browser
 * owns the navigation.
 */
export async function openNavigateInNewTab(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
  href: string,
): Promise<void> {
  if (isActionDisabled(action)) return;
  const ok = await confirmAction(state, action, ctx);
  if (!ok) return;
  // Navigate URLs can be external — sever the opener link so the new tab
  // can't reach back into the app (`window.opener`) and sends no referrer.
  window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * Gesture handler set for the primary trigger (single CTA anchor/button)
 * shared by `<AsRowActions>` and `<AsTableActions>`. Parameterized only by
 * the surface's prompt-context getter and href resolver so the click-dispatch
 * policy — plain left → SPA invoke, cmd/ctrl or middle on a promptText
 * navigate button → confirm → new tab — has a single home. A disabled
 * action needs no guard here: it has no href (`rowActionHref`), and the
 * invoke path ends in `triggerAction`, which refuses it.
 */
export function createNavigateGestures(
  state: ReactiveTableState,
  promptCtx: () => PromptCtx,
  hrefFor: (action: TVueTableActionInfo) => string | undefined,
) {
  return {
    /**
     * Unified primary-trigger click. Anchor mode intercepts ONLY plain left
     * clicks (preventDefault + SPA invoke path) and yields modified clicks
     * to native anchor behaviour; button mode sends cmd/ctrl-click on a
     * promptText navigate action (`href` present while not an anchor)
     * through confirm → new tab, everything else through the invoke path.
     */
    onTriggerClick(action: TVueTableActionInfo, href: string | undefined, event: MouseEvent): void {
      if (isLinkTrigger(action, href)) {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
      } else if (href !== undefined && isModClick(event)) {
        void openNavigateInNewTab(state, action, promptCtx(), href);
        return;
      }
      void triggerAction(state, action, promptCtx(), event);
    },
    /**
     * Middle click on a promptText navigate button → confirm → new tab.
     * Anchors skip this — the browser's native middle-click handles them.
     */
    onTriggerAuxClick(
      action: TVueTableActionInfo,
      href: string | undefined,
      event: MouseEvent,
    ): void {
      if (href === undefined || isLinkTrigger(action, href) || event.button !== 1) return;
      event.preventDefault();
      void openNavigateInNewTab(state, action, promptCtx(), href);
    },
    /** `newtab` from a promptText navigate menu item — confirm → `window.open`. */
    openNewTab(action: TVueTableActionInfo): void {
      const href = hrefFor(action);
      if (href === undefined) return;
      void openNavigateInNewTab(state, action, promptCtx(), href);
    },
  };
}

/** Context for prompt-text substitution. */
export interface PromptCtx {
  /** Identifier objects for the targeted rows (in invocation order). `length` doubles as the row count for `$N` and singular/plural selection. */
  identifiers: Record<string, unknown>[];
  /** Preferred-id field order, used to render `$1`. */
  preferredId: readonly string[];
  /**
   * The row the action was triggered from, forwarded to `invoke` so a
   * client-only row action's `onInvoke(row, pk)` receives it. Since 0.1.134.
   */
  row?: Record<string, unknown>;
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
 * others run `confirmAction()`. Cancelling either dialog short-circuits. A
 * disabled action (`disabledReason`) never runs: this is the choke point
 * every built-in trigger — and a custom slot's `invoke` — funnels through
 * (the other is `rowActionHref`, which gives it no link to follow).
 */
export async function triggerAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
  event?: KeyboardEvent | MouseEvent,
): Promise<void> {
  if (isActionDisabled(action)) return;
  const pk = pkForLevel(action.level, ctx.identifiers);
  if (action.inputForm) {
    const input = await state.requestActionInput(action, ctx);
    if (input === null) return;
    void state.actions.invoke(action, pk, { event, input, row: ctx.row });
    return;
  }
  const ok = await confirmAction(state, action, ctx);
  if (!ok) return;
  void state.actions.invoke(action, pk, { event, row: ctx.row });
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
