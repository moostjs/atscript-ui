import type {
  LocalRowAction,
  ReactiveTableState,
  ResolvedRowActions,
  RowActionsConfig,
  TVueTableActionInfo,
} from "../../types";
import {
  actionHref,
  applyGate,
  isActionDisabled,
  rowActionGate,
  type ActionBuckets,
  type ActionGate,
} from "./intent-scope";

/**
 * A synthesised action for one `RowActionsConfig.extra` entry. It walks the
 * same rendering path as a server action; `$local` carries the app's
 * definition so the href / invoke paths can reach it.
 */
export type LocalActionInfo = TVueTableActionInfo & { $local: LocalRowAction };

/** The app definition behind a client-only action, or `undefined` for a server action. */
export function localActionOf(action: TVueTableActionInfo): LocalRowAction | undefined {
  return (action as Partial<LocalActionInfo>).$local;
}

/** Wrap an app-owned action in the descriptor shape the row-actions cell renders. */
export function toLocalActionInfo(local: LocalRowAction): LocalActionInfo {
  return {
    name: local.name,
    label: local.label,
    level: "row",
    processor: "custom",
    value: "",
    icon: local.icon,
    intent: local.intent,
    promptText: local.promptText,
    $local: local,
  };
}

/**
 * Render-time href for a row action, whichever kind it is: a client-only
 * action builds its own from the row — still mapped through
 * `state.resolveHref`, so router base paths apply exactly as they do for a
 * server `navigate` action — and a server action goes through
 * {@link actionHref}. A disabled action has none — one of the two disabled
 * choke points (the other is `triggerAction`): no href means no anchor, no
 * new-tab gesture, nothing to follow.
 */
export function rowActionHref(
  state: ReactiveTableState,
  action: TVueTableActionInfo,
  id: Record<string, unknown> | undefined,
  row: Record<string, unknown> | undefined,
): string | undefined {
  if (isActionDisabled(action)) return undefined;
  const local = localActionOf(action);
  if (local) {
    return local.href && row !== undefined ? state.resolveHref(local.href(row)) : undefined;
  }
  return actionHref(state, action, id);
}

/**
 * A {@link RowActionsConfig} compiled into the two passes a surface runs per
 * row. Built once per config change (not once per row per render), so the
 * `include` / `exclude` sets, the override lookups and the app-owned action
 * descriptors exist once. Surfaces call {@link resolveRowActions}, not this.
 */
export interface RowActionsPolicy {
  /**
   * Gate + narrow + relabel in ONE pass: the row's server verdict
   * (`rowGate`, from `rowActionGate`) first, then `include` / `exclude`, then
   * `overrides`. That order is the whole safety story: `include` can only
   * narrow what the server allowed for the row, and `overrides`
   * (presentation only) cannot resurrect an action the server gated away.
   * Returns the input reference when nothing changes.
   */
  apply: (buckets: ActionBuckets, rowGate?: ActionGate | null) => ActionBuckets;
  /**
   * The app-owned actions for `row`. `include` lists SERVER action names —
   * being listed in `extra` IS an app action's opt-in — so only `exclude` and
   * the action's own `enabled(row)` apply here: `false` hides it, a non-empty
   * string keeps it disabled with that reason. Pass no row to skip the
   * per-row gate (a surface with no row in hand).
   */
  extra: (row?: Record<string, unknown>) => TVueTableActionInfo[];
}

const EMPTY: TVueTableActionInfo[] = Object.freeze([]) as unknown as TVueTableActionInfo[];

/** The identity policy — used when no `RowActionsConfig` is wired. */
const PASS_THROUGH: RowActionsPolicy = {
  apply: (buckets, rowGate) => applyGate(buckets, rowGate ?? null),
  extra: () => EMPTY,
};

/** Compile a per-screen {@link RowActionsConfig} into a {@link RowActionsPolicy}. */
export function compileRowActionsConfig(config: RowActionsConfig | undefined): RowActionsPolicy {
  if (!config) return PASS_THROUGH;

  const include = config.include ? new Set(config.include) : null;
  const exclude = config.exclude ? new Set(config.exclude) : null;
  const overrides = config.overrides;
  const allowed = (a: TVueTableActionInfo) =>
    (!include || include.has(a.name)) && !exclude?.has(a.name);
  const decorate = overrides
    ? (action: TVueTableActionInfo): TVueTableActionInfo => {
        const patch = overrides[action.name];
        if (!patch) return action;
        const next = { ...action };
        // Skip `undefined` values so a partial override never erases a
        // label/icon the server declared.
        for (const key of ["label", "icon", "intent", "promptText"] as const) {
          const value = patch[key];
          if (value !== undefined) (next as Record<string, unknown>)[key] = value;
        }
        return next;
      }
    : undefined;

  const locals = (config.extra ?? [])
    .filter((local) => !exclude?.has(local.name))
    .map(toLocalActionInfo);

  return {
    apply: (buckets, rowGate) =>
      applyGate(
        buckets,
        rowGate
          ? (a) => {
              const verdict = rowGate(a);
              return verdict !== false && allowed(a) ? verdict : false;
            }
          : allowed,
        decorate,
      ),
    extra: (row) => {
      if (locals.length === 0) return EMPTY;
      if (row === undefined) return locals;
      return applyGate(
        { default: undefined, others: locals, rows: EMPTY },
        (a) => (a as LocalActionInfo).$local.enabled?.(row) ?? true,
      ).others;
    },
  };
}

/**
 * The row actions a surface renders for `row` — the one shared per-row
 * pipeline behind `<AsRowActions>`, the `<AsTableActions>` row level and the
 * Enter / double-click main-action fallback: the row's server gate
 * (`$actions` / `$disabledReasons`) and the root's `:row-actions` policy in a
 * single pass, plus the policy's app-owned `extra` actions. Pass
 * `withRows: false` to leave out the rows-level bucket.
 */
export function resolveRowActions(
  state: ReactiveTableState,
  row: Record<string, unknown> | undefined,
  opts?: { withRows?: boolean },
): ResolvedRowActions {
  const policy = state.rowActionsPolicy.value;
  const { actions } = state;
  const gated = policy.apply(
    {
      default: actions.default.row,
      others: actions.others.row,
      rows: opts?.withRows === false ? EMPTY : actions.rows,
    },
    rowActionGate(row),
  );
  return {
    default: gated.default,
    others: gated.others,
    rows: gated.rows,
    extra: policy.extra(row),
  };
}
