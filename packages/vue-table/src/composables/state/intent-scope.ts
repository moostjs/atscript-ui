import { formatIdentifier, type TDbActionInfo } from "@atscript/db-client";
import { getCellValue } from "../../utils/get-cell-value";
import { navigateHrefFor, setByPath, type TableDef } from "@atscript/ui";
import type { SelectionQuery } from "@atscript/ui-table";
import {
  REMOVE_PROCESSOR,
  type ActionQueryTarget,
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

/** Disabled reason of a non-query-target action in a query selection. Since 0.1.147. */
export const QUERY_TARGET_UNSUPPORTED_REASON =
  "Not available for all matching rows — select rows individually";

/**
 * The gate a query selection ("every row matching the query") puts on the
 * `'rows'` actions: enabled iff the action takes a query target
 * (`queryTarget`) of at least `count` rows; otherwise kept DISABLED with the
 * reason ({@link QUERY_TARGET_UNSUPPORTED_REASON}, or "At most {max} rows").
 * The loaded rows' `$actions` are deliberately not consulted — a sample of
 * the matching rows cannot speak for the rest; the server gates every row
 * when the action runs. Since 0.1.147.
 */
export function queryTargetGate(count: number): ActionGate {
  return (a) => {
    if (!a.queryTarget) return QUERY_TARGET_UNSUPPORTED_REASON;
    const max = a.queryTarget.maxRows;
    return count > max ? `At most ${rowsLabel(max)}` : true;
  };
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

/** The value at a dot `path` of `row` (a flat dotted key wins). */
function valueAt(row: Record<string, unknown>, path: string): unknown {
  return Object.hasOwn(row, path) ? row[path] : getCellValue(row, path);
}

/** Write `value` at a dot `path` of `out`, creating the nested objects. */
function setAt(out: Record<string, unknown>, path: string, value: unknown): void {
  setByPath({ value: out }, path, value);
}

/**
 * The fields an action identifier is built from — `tableDef.identifierFields`
 * (`preferredId` plus every delegated action's `idMap` path), falling back to
 * `preferredId` for a hand-built `TableDef` without it. Since 0.1.147.
 */
export function identifierFieldsOf(def: TableDef | null | undefined): readonly string[] {
  return def?.identifierFields ?? def?.preferredId ?? [];
}

/**
 * Build the identifier object to forward to `client.action` / `client.remove`.
 *
 * Per `@atscript/db-client` invariant #11, identifier bodies are object-only
 * — never bare scalars, even for single-field PK tables. This helper accepts:
 * - a row-shaped object (default `rowValueFn`) → picks the `fields` (a dot
 *   path keeps the row's nesting: `ref.key` → `{ ref: { key } }`);
 * - a scalar value when `fields` has exactly one entry (consumers that
 *   override `rowValueFn` to return the PK scalar) → wraps it.
 *
 * `fields` is usually `identifierFields` (see {@link identifierFieldsOf}), so
 * the identifier carries what a delegated action maps from; each action then
 * takes the part it needs ({@link actionIdentifiers}).
 *
 * Returns `undefined` when `fields` is empty, the source is
 * `null`/`undefined`, or a scalar can't be paired with a single field.
 */
export function extractIdentifier(
  source: unknown,
  fields: readonly string[],
): Record<string, unknown> | undefined {
  if (source === undefined || source === null) return undefined;
  if (fields.length === 0) return undefined;

  if (typeof source === "object" && !Array.isArray(source)) {
    const row = source as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of fields) setAt(out, k, valueAt(row, k));
    return out;
  }

  if (fields.length === 1) {
    return { [fields[0]!]: source };
  }

  return undefined;
}

/**
 * Map a list of sources (full row objects or scalar `rowValueFn` values)
 * through `extractIdentifier`. Scalar sources resolve to their loaded row via
 * `state.rowOf` so consumers that override `rowValueFn` to return a scalar
 * can still reconstruct multi-field identifiers; a scalar whose row is not
 * loaded falls back to itself (a single field wraps it — or, when `fields`
 * has several, the table's single-field `preferredId` does).
 */
export function collectIdentifiers(
  state: ReactiveTableState,
  sources: readonly unknown[],
  fields: readonly string[],
): Record<string, unknown>[] {
  if (fields.length === 0 || sources.length === 0) return [];
  const out: Record<string, unknown>[] = [];
  for (const s of sources) {
    if (s === undefined || s === null) continue;
    const row = state.rowOf(s);
    const id =
      extractIdentifier(row ?? s, fields) ??
      (row ? undefined : extractIdentifier(s, preferredIdOf(state)));
    if (id) out.push(id);
  }
  return out;
}

/** The fields `action` is addressed by: its `idMap` paths, else `preferredId`. */
function actionFields(
  action: Pick<TVueTableActionInfo, "idMap">,
  preferredId: readonly string[],
): readonly string[] {
  return action.idMap ? Object.values(action.idMap) : preferredId;
}

/**
 * The identifiers `action` is sent, from the table's identifiers (built
 * from `identifierFields`): a delegated action (`idMap`) keeps exactly its
 * map's paths — the client maps them to the owner's identification — any
 * other action exactly the `preferredId` fields, the identification the
 * server validates. No fields → no identifiers. Identifiers already in that
 * shape come back as the same array. Since 0.1.147.
 */
export function actionIdentifiers(
  action: Pick<TVueTableActionInfo, "idMap">,
  ids: Record<string, unknown>[],
  preferredId: readonly string[],
): Record<string, unknown>[] {
  const fields = actionFields(action, preferredId);
  if (fields.length === 0) return [];
  const flat = !fields.some((f) => f.includes("."));
  const exact = (id: Record<string, unknown>) => {
    const keys = Object.keys(id);
    return keys.length === fields.length && fields.every((f) => f in id);
  };
  if (flat && ids.every(exact)) return ids;
  return project(ids, fields, setAt);
}

/** `ids` cut down to `fields`, each written with `write`. */
function project(
  ids: Record<string, unknown>[],
  fields: readonly string[],
  write: (out: Record<string, unknown>, field: string, value: unknown) => void,
): Record<string, unknown>[] {
  return ids.map((id) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) write(out, f, valueAt(id, f));
    return out;
  });
}

/**
 * A query target's `exclude` for `action`: like {@link actionIdentifiers},
 * but keyed by the flat (dotted) field names — the shape the server matches
 * exclusions by.
 */
function excludeIdentifiers(
  action: Pick<TVueTableActionInfo, "idMap">,
  ids: Record<string, unknown>[],
  preferredId: readonly string[],
): Record<string, unknown>[] {
  const fields = actionFields(action, preferredId);
  if (fields.length === 0) return [];
  return project(ids, fields, (out, f, v) => {
    out[f] = v;
  });
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
  const href = navigateHrefFor(action as TDbActionInfo, id, preferredIdOf(state));
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

/** The table's `preferredId` (empty before its definition loads). */
function preferredIdOf(state: ReactiveTableState): readonly string[] {
  return state.tableDef.value?.preferredId ?? [];
}

/**
 * The query a query selection targets, with the excluded rows' identifiers
 * (built from `identifierFields`) — see `PromptCtx.target`. Since 0.1.147.
 */
export type PromptTarget = SelectionQuery & { exclude: Record<string, unknown>[] };

/** Context for prompt-text substitution. */
export interface PromptCtx {
  /** Identifier objects for the targeted rows (in invocation order). `length` doubles as the row count for `$N` and singular/plural selection (unless `count` is set). */
  identifiers: Record<string, unknown>[];
  /** Preferred-id field order, used to render `$1`. */
  preferredId: readonly string[];
  /**
   * The row the action was triggered from, forwarded to `invoke` so a
   * client-only row action's `onInvoke(row, pk)` receives it. Since 0.1.134.
   */
  row?: Record<string, unknown>;
  /**
   * The selection is a query selection: run the action on every row matching
   * this query instead of on `identifiers` (empty then). `triggerAction`
   * counts the rows first and confirms with that count. Since 0.1.147.
   */
  target?: PromptTarget;
  /** Row count for `$N` and singular/plural when it is not `identifiers.length` (a query target). Since 0.1.147. */
  count?: number;
}

/** Row count a prompt speaks about — `count` when set, else the identifiers. */
function countOf(ctx: PromptCtx): number {
  return ctx.count ?? ctx.identifiers.length;
}

/**
 * Run `state.prompt()` if the action declares a `promptText`. Resolves
 * `true` on accept, or `true` immediately when no prompt is needed.
 *
 * `promptText` may be a string or `[singular, plural]` tuple. Tuple form
 * picks `singular` when there is at most one identifier, `plural` otherwise.
 * Substitutions:
 * - `$1` → `formatIdentifier(ctx.identifiers[0], ctx.preferredId)`
 * - `$N` → the row count (`ctx.count`, else `ctx.identifiers.length`)
 *
 * A query-targeted run (`ctx.target`) is always confirmed: an action without
 * a `promptText` asks "Run “{label}” on {N} rows?".
 */
export async function confirmAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
): Promise<boolean> {
  const raw = action.promptText;
  const count = countOf(ctx);
  if (!raw) {
    if (!ctx.target) return true;
    return state.prompt(targetPrompt(action, count), { scope: intentToScope(action.intent) });
  }
  const template = Array.isArray(raw) ? (count <= 1 ? raw[0]! : raw[1]!) : raw;
  const message = substitute(template, ctx);
  return state.prompt(message, { scope: intentToScope(action.intent) });
}

/** Substitute `$1` and `$N` into a prompt-text template. */
export function substitute(template: string, ctx: PromptCtx): string {
  return template
    .replace(/\$1/g, () => formatIdentifier(ctx.identifiers[0], ctx.preferredId))
    .replace(/\$N/g, () => String(countOf(ctx)));
}

/** `N row(s)`. */
export function rowsLabel(count: number): string {
  return `${count} ${count === 1 ? "row" : "rows"}`;
}

/** Default confirmation of a query-targeted run without a `promptText`. */
function targetPrompt(action: TVueTableActionInfo, count: number): string {
  return `Run “${action.label || action.name}” on ${rowsLabel(count)}?`;
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
  if (ctx.target) {
    await triggerTargetAction(state, action, ctx, ctx.target, event);
    return;
  }
  const pk = pkForLevel(action.level, actionIdentifiers(action, ctx.identifiers, ctx.preferredId));
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
 * The query-target path of {@link triggerAction}: count the matching rows
 * (`state.actions.countTarget` — a failure settles as the action's error
 * result), confirm with that count (the input form, which shows it, or the
 * prompt), then run with `expectCount` so a set that changed in between is
 * re-confirmed once with its new count instead of silently run.
 */
async function triggerTargetAction(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  ctx: PromptCtx,
  selection: PromptTarget,
  event?: KeyboardEvent | MouseEvent,
): Promise<void> {
  if (action.level !== "rows" || !action.queryTarget) return;
  const exclude = excludeIdentifiers(action, selection.exclude, ctx.preferredId);
  const target: ActionQueryTarget = {
    filter: selection.filter as ActionQueryTarget["filter"],
    search: selection.search,
    index: selection.index,
    exclude: exclude.length > 0 ? exclude : undefined,
  };
  const matched = await state.actions.countTarget(action, target, event);
  if (matched === undefined) return;
  const counted: PromptCtx = { ...ctx, identifiers: [], count: matched };
  let input: unknown;
  if (action.inputForm) {
    input = await state.requestActionInput(action, counted);
    if (input === null) return;
  } else if (!(await confirmAction(state, action, counted))) {
    return;
  }
  void state.actions.invoke(action, undefined, {
    event,
    input,
    target,
    expectCount: matched,
    confirmTargetChange: (now) =>
      state.prompt(`The rows matching the query changed. ${targetPrompt(action, now)}`, {
        scope: intentToScope(action.intent),
      }),
  });
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
