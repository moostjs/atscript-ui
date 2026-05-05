import { computed, shallowRef, watch, type ComputedRef, type ShallowRef } from "vue";
import type { Client } from "@atscript/db-client";
import type { TableDef } from "@atscript/ui";
import {
  REMOVE_PROCESSOR,
  type ActionResult,
  type InvokeOpts,
  type RowDeleteOpt,
  type TableActionsState,
  type TVueTableActionInfo,
} from "../../types";
import { idsForAction } from "./intent-scope";

const REMOVE_NAME = REMOVE_PROCESSOR;

const REMOVE_DEFAULTS = {
  label: "Delete",
  icon: "i-as-trash",
  intent: "negative" as const,
  promptText: ["Delete item $1?", "Delete $N items?"] as [string, string],
};

interface CreateActionsOpts {
  /** Source table definition (server-declared actions live here). */
  tableDef: ShallowRef<TableDef | null>;
  /** Data-layer client used by `'backend'` / `'navigate'` / `'__remove'`. */
  client: Client;
  /** Row-delete opt-in: `false` (off, default), `true` (on with defaults), or an options object. */
  rowDelete: () => boolean | RowDeleteOpt;
  /**
   * Schedule a post-action refetch. Called inline after a settled `'backend'`
   * or `'__remove'` invoke when (a) the call did not pass `suppressRefresh`
   * and (b) `refreshOnAction()` did not return `false`.
   */
  scheduleQuery: (kind: "query") => void;
  /** Refetch policy reader; returning `false` suppresses the post-action refetch. */
  refreshOnAction: () => boolean | undefined;
  /**
   * Bridge for `<AsTableRoot>`'s `@action` emit. Called once per settled
   * `invoke` (success, error, custom). `ids` is derived from `pk` according
   * to `action.level`: `'row'` → `[pk]`, `'rows'` → `pk` if array else `[pk]`,
   * `'table'` → `[]`.
   */
  onResolved?: (
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
  ) => void;
}

interface GroupsValue {
  table: TVueTableActionInfo[];
  row: TVueTableActionInfo[];
  rows: TVueTableActionInfo[];
  default: TableActionsState["default"];
  /** Per-level lists with the declared default removed — pre-computed once per groups rebuild. */
  others: {
    table: TVueTableActionInfo[];
    row: TVueTableActionInfo[];
    rows: TVueTableActionInfo[];
  };
  /**
   * Flattened row-cell action list `[default?, ...otherRow, ...rows]`. Same
   * for every row in the table — pre-built here so per-row `<AsRowActions>`
   * cells don't re-derive it.
   */
  cellRow: TVueTableActionInfo[];
}

interface CreateActionsResult {
  actions: TableActionsState;
  /** Computed source for `<AsTableRoot>` slot props. */
  groups: ComputedRef<GroupsValue>;
}

export function createActions(opts: CreateActionsOpts): CreateActionsResult {
  const invoking = shallowRef<Set<string>>(new Set());
  const lastResult = shallowRef<Map<string, ActionResult>>(new Map());

  const groups = computed(() => buildGroups(opts.tableDef.value, opts.rowDelete()));

  // Reset on tableDef swap so long sessions with rotating action sets don't
  // accumulate entries for actions no longer present.
  watch(opts.tableDef, () => {
    if (lastResult.value.size > 0) lastResult.value = new Map();
  });

  function setInvoking(name: string, on: boolean) {
    const next = new Set(invoking.value);
    if (on) next.add(name);
    else next.delete(name);
    invoking.value = next;
  }

  function setLastResult(name: string, result: ActionResult) {
    const next = new Map(lastResult.value);
    next.set(name, result);
    lastResult.value = next;
  }

  async function invoke(
    action: TVueTableActionInfo,
    pk?: Record<string, unknown> | Record<string, unknown>[],
    callOpts?: InvokeOpts,
  ): Promise<ActionResult> {
    const name = action.name;
    setInvoking(name, true);

    let result: ActionResult;
    try {
      switch (action.processor) {
        case "custom": {
          result = { ok: true, kind: "custom", dispatched: true };
          break;
        }
        case "navigate": {
          await opts.client.action(action.name, pk);
          result = { ok: true, kind: "navigate" };
          break;
        }
        case REMOVE_PROCESSOR: {
          const data = await opts.client.remove(pk as never);
          result = { ok: true, kind: "remove", data };
          break;
        }
        case "backend":
        default: {
          const data = await opts.client.action(action.name, pk, callOpts?.input);
          const message =
            typeof data === "object" && data !== null && "message" in data
              ? ((data as { message?: unknown }).message as string | undefined)
              : undefined;
          result = { ok: true, kind: "backend", data, message };
          break;
        }
      }
    } catch (err) {
      result = {
        ok: false,
        kind: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }

    setLastResult(name, result);
    setInvoking(name, false);

    // Refetch only for ops that mutated the dataset, gated by per-call
    // `suppressRefresh` and the root-prop `refreshOnAction`.
    if (
      callOpts?.suppressRefresh !== true &&
      opts.refreshOnAction() !== false &&
      result.ok &&
      (result.kind === "backend" || result.kind === "remove")
    ) {
      opts.scheduleQuery("query");
    }

    if (opts.onResolved) {
      opts.onResolved(action, idsForAction(action.level, pk), result, callOpts?.event);
    }

    return result;
  }

  const actions: TableActionsState = {
    get table() {
      return groups.value.table;
    },
    get row() {
      return groups.value.row;
    },
    get rows() {
      return groups.value.rows;
    },
    get default() {
      return groups.value.default;
    },
    get others() {
      return groups.value.others;
    },
    get cellRow() {
      return groups.value.cellRow;
    },
    invoke,
    invoking,
    lastResult,
  };

  return { actions, groups };
}

const EMPTY_GROUPS: GroupsValue = Object.freeze({
  table: [],
  row: [],
  rows: [],
  default: {},
  others: { table: [], row: [], rows: [] },
  cellRow: [],
}) as GroupsValue;

function buildGroups(def: TableDef | null, rowDelete: boolean | RowDeleteOpt): GroupsValue {
  if (def === null) return EMPTY_GROUPS;

  const srcActions = def.actions ?? { table: [], row: [], rows: [], default: {} };
  const table = srcActions.table as TVueTableActionInfo[];
  const row = (srcActions.row as TVueTableActionInfo[]).slice();
  const rows = srcActions.rows as TVueTableActionInfo[];

  if (rowDelete && def.canRemove) {
    row.push(buildRemoveAction(rowDelete === true ? {} : rowDelete));
  }

  const defTable = srcActions.default.table as TVueTableActionInfo | undefined;
  const defRow = srcActions.default.row as TVueTableActionInfo | undefined;
  const defRows = srcActions.default.rows as TVueTableActionInfo | undefined;

  const othersTable = defTable ? table.filter((a) => a !== defTable) : table;
  const othersRow = defRow ? row.filter((a) => a !== defRow) : row;
  const othersRows = defRows ? rows.filter((a) => a !== defRows) : rows;

  // rows-level actions are appended to the per-row cell list — they accept
  // arrays, so a single row's PK still drives the bulk handler.
  const cellRow = defRow
    ? [defRow, ...othersRow, ...rows]
    : othersRow.length > 0 || rows.length > 0
      ? [...othersRow, ...rows]
      : [];

  return {
    table,
    row,
    rows,
    default: { table: defTable, row: defRow, rows: defRows },
    others: { table: othersTable, row: othersRow, rows: othersRows },
    cellRow,
  };
}

function buildRemoveAction(opts: RowDeleteOpt): TVueTableActionInfo {
  return {
    name: REMOVE_NAME,
    label: opts.label ?? REMOVE_DEFAULTS.label,
    level: "row",
    processor: REMOVE_PROCESSOR,
    value: "",
    icon: opts.icon ?? REMOVE_DEFAULTS.icon,
    intent: opts.intent ?? REMOVE_DEFAULTS.intent,
    promptText: opts.confirm ?? REMOVE_DEFAULTS.promptText,
  };
}
