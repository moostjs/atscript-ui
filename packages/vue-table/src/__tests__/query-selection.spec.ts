// @vitest-environment happy-dom
//
// "Select all N matching" — the symbolic query selection (since 0.1.147):
// entering / leaving it, excluded toggles, the header tri-state, the
// invalidation rules (filter / search change it, sort / paging / columns do
// not), the match-count refresh, the banner, and the toolbar's query-target
// path (dry-run count → confirm → run with `expectCount`, TARGET_CHANGED
// re-prompt, unsupported / too-large reasons).
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import type { Client, TDbActionInfo } from "@atscript/db-client";
import AsTable from "../components/as-table.vue";
import AsWindowTable from "../components/as-window-table.vue";
import AsTableActions from "../components/as-table-actions.vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import { toSelectAllState } from "../composables/state/create-selection";
import {
  actionIdentifiers,
  extractIdentifier,
  queryTargetGate,
  QUERY_TARGET_UNSUPPORTED_REASON,
} from "../composables/state/intent-scope";
import type { ActionResult, ReactiveTableState, TVueTableActionInfo } from "../types";
import { mockColumn, mockTableDef, mountWithTableContext } from "./helpers";

const columns = [mockColumn("name")];
const rows = [
  { id: 1, name: "Ann" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cid" },
];

const archive: TDbActionInfo = {
  name: "archive",
  label: "Archive",
  level: "rows",
  processor: "backend",
  value: "/t/actions/archive",
  queryTarget: { maxRows: 500 },
};
const smallCap: TDbActionInfo = {
  name: "reopen",
  label: "Reopen",
  level: "rows",
  processor: "backend",
  value: "/t/actions/reopen",
  queryTarget: { maxRows: 5 },
};
const notify: TDbActionInfo = {
  name: "notify",
  label: "Notify",
  level: "rows",
  processor: "backend",
  value: "/t/actions/notify",
};

afterEach(() => {
  document.body.innerHTML = "";
});

function withActions(rowsActions: TDbActionInfo[]) {
  return (def: { actions: unknown }) => {
    def.actions = { table: [], row: [], rows: rowsActions, default: {} };
  };
}

/** A `pages()` mock serving `rows` as the first block of `count` and nothing after. */
function firstBlockOnly(count: number) {
  return vi.fn(async (_q: unknown, page: number) => ({
    data: page === 1 ? rows : [],
    count,
    page,
    itemsPerPage: 100,
    pages: 1,
  }));
}

/** `<AsTable select="multi">` over 3 loaded rows of `total` matching. */
function setupTable(
  opts: { total?: number; actions?: TDbActionInfo[]; allow?: boolean; component?: unknown } = {},
) {
  const mounted = mountWithTableContext(opts.component ?? AsTable, {
    columns,
    seedRows: rows,
    totalCount: opts.total ?? 10,
    // A window renderer fetches on mount: answer with the same first block.
    pages: firstBlockOnly(opts.total ?? 10),
    selection: { rowValueFn: (row) => row.id },
    decorateDef: withActions(opts.actions ?? [archive]) as never,
    props: reactive(
      opts.component === AsWindowTable
        ? { rowHeight: 32, select: "multi" }
        : { columns, rows, select: "multi" },
    ),
    onReady: (s) => {
      s.allowSelectAllMatching.value = opts.allow ?? true;
    },
  });
  if (opts.component === AsWindowTable) mounted.state.viewportRowCount.value = rows.length;
  return mounted;
}

describe("query selection — state", () => {
  it("enters with the current filter / search and the match count, emptying selectedRows", async () => {
    const { state } = setupTable();
    await nextTick();
    state.setFieldFilter("name", [{ type: "eq", value: ["Ann"] }]);
    state.searchTerm.value = "a";
    state.selectedRows.value = [1, 2, 3];
    state.selectAllMatching();
    const q = state.querySelection.value!;
    expect(q).not.toBeNull();
    expect(q.query.search).toBe("a");
    expect(q.query.filter).toBeTruthy();
    expect(q.excluded).toEqual([]);
    expect(q.total).toBe(10);
    expect(state.selectedRows.value).toEqual([]);
    expect(state.selectedCount.value).toBe(10);
    expect(state.selection.value).toMatchObject({ mode: "query", count: 10, total: 10 });
  });

  it("row toggles edit `excluded`; selectAll / deselectAll / clearSelection", async () => {
    const { state } = setupTable();
    await nextTick();
    state.selectAllMatching();
    state.setActive(1);
    state.toggleActiveSelection("multi");
    expect(state.querySelection.value!.excluded).toEqual([2]);
    expect(state.isPkSelected(2)).toBe(false);
    expect(state.isPkSelected(1)).toBe(true);
    expect(state.selectedCount.value).toBe(9);
    expect(state.selectedRowObjects.value.map((r) => r.id)).toEqual([1, 3]);
    state.deselectAll(rows);
    expect(state.querySelection.value!.excluded).toEqual([2, 1, 3]);
    state.selectAll(rows);
    expect(state.querySelection.value!.excluded).toEqual([]);
    state.clearSelection();
    expect(state.querySelection.value).toBeNull();
    expect(state.selectedCount.value).toBe(0);
  });

  it("the header toggle re-selects excluded rows, and ends a fully selected query selection", async () => {
    const { state } = setupTable();
    await nextTick();
    state.selectAllMatching();
    state.deselectAll([rows[0]!]);
    state.toggleAll(rows);
    expect(state.querySelection.value!.excluded).toEqual([]);
    state.toggleAll(rows);
    expect(state.querySelection.value).toBeNull();
  });

  it("the header tri-state never reads `none` in query mode", () => {
    expect(toSelectAllState(0, 3, true)).toBe("some");
    expect(toSelectAllState(3, 3, true)).toBe("all");
    expect(toSelectAllState(0, 3)).toBe("none");
  });

  it("a filter or search change drops it with `selection-reset`; sort / paging / columns keep it", async () => {
    const onSelectionReset = vi.fn();
    const mounted = mountWithTableContext(AsTable, {
      columns: [mockColumn("name"), mockColumn("other")],
      seedRows: rows,
      totalCount: 10,
      selection: { rowValueFn: (row) => row.id, onSelectionReset },
      decorateDef: withActions([archive]) as never,
      props: { columns, rows, select: "multi" },
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    const { state } = mounted;
    await nextTick();
    state.selectAllMatching();
    state.sorters.value = [{ field: "name", direction: "desc" }];
    state.pagination.value = { ...state.pagination.value, page: 2 };
    state.columnNames.value = ["name"];
    await nextTick();
    expect(state.querySelection.value).not.toBeNull();
    expect(onSelectionReset).not.toHaveBeenCalled();

    state.searchTerm.value = "zz";
    await nextTick();
    expect(state.querySelection.value).toBeNull();
    expect(onSelectionReset).toHaveBeenCalledWith({ reason: "scope" });

    state.searchTerm.value = "";
    await nextTick();
    state.selectAllMatching();
    state.setFieldFilter("name", [{ type: "eq", value: ["Bob"] }]);
    await nextTick();
    expect(state.querySelection.value).toBeNull();
    expect(onSelectionReset).toHaveBeenCalledTimes(2);
  });

  it("a same-scope refetch refreshes `total` and keeps `excluded`", async () => {
    const { state } = setupTable();
    await nextTick();
    state.selectAllMatching();
    state.deselectAll([rows[0]!]);
    state.totalCount.value = 12;
    await nextTick();
    expect(state.querySelection.value).toMatchObject({ total: 12, excluded: [1] });
    expect(state.selectedCount.value).toBe(11);
  });

  it("an explicit selection written from outside ends it", async () => {
    const { state } = setupTable();
    await nextTick();
    state.selectAllMatching();
    state.selectedRows.value = [1];
    await nextTick();
    expect(state.querySelection.value).toBeNull();
  });

  it("switching the renderer to select='none' ends it", async () => {
    const props = reactive({ columns, rows, select: "multi" });
    const { state } = mountWithTableContext(AsTable, {
      columns,
      seedRows: rows,
      totalCount: 10,
      selection: { rowValueFn: (row) => row.id },
      decorateDef: withActions([archive]) as never,
      props,
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    await nextTick();
    state.selectAllMatching();
    expect(state.querySelection.value).not.toBeNull();
    props.select = "none";
    await nextTick();
    expect(state.querySelection.value).toBeNull();
  });

  describe("canSelectAllMatching", () => {
    it("needs the opt-in, multi select, more matching than loaded rows and a query-target action", async () => {
      expect((await ready(setupTable())).canSelectAllMatching.value).toBe(true);
      expect((await ready(setupTable({ allow: false }))).canSelectAllMatching.value).toBe(false);
      expect((await ready(setupTable({ total: 3 }))).canSelectAllMatching.value).toBe(false);
      expect((await ready(setupTable({ actions: [notify] }))).canSelectAllMatching.value).toBe(
        false,
      );
    });

    it("is off for a custom query function", async () => {
      const mounted = mountWithTableContext(AsTable, {
        columns,
        seedRows: rows,
        totalCount: 10,
        queryFn: vi.fn(async () => ({ data: rows, count: 10, page: 1, itemsPerPage: 3, pages: 4 })),
        decorateDef: withActions([archive]) as never,
        props: { columns, rows, select: "multi" },
        onReady: (s) => {
          s.allowSelectAllMatching.value = true;
        },
      });
      await nextTick();
      expect(mounted.state.canSelectAllMatching.value).toBe(false);
      mounted.state.selectAllMatching();
      expect(mounted.state.querySelection.value).toBeNull();
    });
  });
});

async function ready(m: { state: ReactiveTableState }) {
  await nextTick();
  return m.state;
}

const banner = (root: Element) => root.querySelector<HTMLElement>("[role=status][aria-live]");

describe.each([
  { name: "AsTable", component: AsTable, where: "on this page" },
  { name: "AsWindowTable", component: AsWindowTable, where: "loaded" },
])("<$name> selection banner", ({ component, where }) => {
  it("offers 'Select all N matching' once every loaded row is picked, then 'Clear selection'", async () => {
    const { state, wrapper } = setupTable({ component });
    await nextTick();
    expect(wrapper.find(".as-selection-banner").exists()).toBe(false);
    state.selectAll(rows);
    await nextTick();
    const offer = wrapper.get("[data-select-all-matching]");
    expect(wrapper.get(".as-selection-banner").text()).toContain(
      `All 3 rows ${where} are selected.`,
    );
    expect(offer.text()).toBe("Select all 10 matching");
    await offer.trigger("click");
    expect(state.querySelection.value).not.toBeNull();
    expect(wrapper.get(".as-selection-banner").text()).toContain(
      "All 10 matching rows are selected.",
    );
    // Every rendered row reads as selected; the live region stays mounted.
    expect(banner(wrapper.element)).not.toBeNull();
    for (const box of wrapper.findAll("tbody .as-td-select .as-table-checkbox")) {
      expect(box.attributes("aria-checked")).toBe("true");
    }
    await wrapper.get("[data-clear-selection]").trigger("click");
    expect(state.querySelection.value).toBeNull();
    expect(wrapper.find(".as-selection-banner").exists()).toBe(false);
    expect(banner(wrapper.element)).not.toBeNull();
  });

  it("the header checkbox reads 'some' after an exclusion in query mode", async () => {
    const { state, wrapper } = setupTable({ component });
    await nextTick();
    state.selectAll(rows);
    state.selectAllMatching();
    state.deselectAll([rows[1]!]);
    await nextTick();
    expect(wrapper.get(".as-th-select .as-table-checkbox").attributes("aria-checked")).toBe(
      "mixed",
    );
  });

  it("stays hidden without the opt-in", async () => {
    const { state, wrapper } = setupTable({ component, allow: false });
    await nextTick();
    state.selectAll(rows);
    await nextTick();
    expect(wrapper.find(".as-selection-banner").exists()).toBe(false);
  });

  it("#selection-banner replaces the content", async () => {
    const mounted = mountWithTableContext(component, {
      columns,
      seedRows: rows,
      totalCount: 10,
      pages: firstBlockOnly(10),
      selection: { rowValueFn: (row) => row.id },
      decorateDef: withActions([archive]) as never,
      props:
        component === AsWindowTable
          ? { rowHeight: 32, select: "multi" }
          : { columns, rows, select: "multi" },
      slots: {
        "selection-banner": ((p: { selection: { mode: string }; selectAllMatching: () => void }) =>
          h(
            "button",
            { class: "custom-banner", onClick: p.selectAllMatching },
            p.selection.mode,
          )) as never,
      },
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    if (component === AsWindowTable) mounted.state.viewportRowCount.value = rows.length;
    await nextTick();
    mounted.state.selectAll(rows);
    await nextTick();
    const custom = mounted.wrapper.get(".custom-banner");
    expect(custom.text()).toBe("ids");
    await custom.trigger("click");
    expect(mounted.wrapper.get(".custom-banner").text()).toBe("query");
  });
});

describe("queryTargetGate", () => {
  it("enables query-target actions within their cap; disables the rest with the reason", () => {
    const gate = queryTargetGate(10);
    expect(gate(archive as TVueTableActionInfo)).toBe(true);
    expect(gate(smallCap as TVueTableActionInfo)).toBe("At most 5 rows");
    expect(gate(notify as TVueTableActionInfo)).toBe(QUERY_TARGET_UNSUPPORTED_REASON);
  });
});

// ── Toolbar: count → confirm → run ─────────────────────────────────────────

function targetChanged(matched: number) {
  return Object.assign(new Error("changed"), {
    name: "ActionTargetError",
    code: "TARGET_CHANGED",
    matched,
  });
}

function setupToolbar(
  opts: {
    actions?: TDbActionInfo[];
    count?: () => Promise<{ matched: number }>;
    run?: (...args: unknown[]) => Promise<unknown>;
    preferredId?: string[];
    slot?: (scope: Record<string, unknown>) => unknown;
  } = {},
) {
  const countFn = vi.fn<(name: string, target: unknown) => Promise<{ matched: number }>>(
    opts.count ?? (async () => ({ matched: 7 })),
  );
  const runFn = vi.fn(
    opts.run ??
      (async () => ({
        matched: 7,
        processed: 6,
        skipped: [{ id: { id: 4 }, reason: "stale" }],
        failed: [],
      })),
  );
  const actionFn = vi.fn(async () => ({ ok: true }));
  const client = {
    meta: () => Promise.resolve({} as never),
    pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
    action: actionFn,
    countActionTarget: countFn,
    actionOnQuery: runFn,
  } as unknown as Client;
  const resolved: { action: string; ids: unknown[]; result: ActionResult }[] = [];
  let state!: ReactiveTableState;
  const Host = defineComponent({
    setup() {
      const { state: s, internals } = createTableState({
        client,
        query: { queryOnMount: false },
        selection: { rowValueFn: (row) => row.id },
        actions: {
          // Keep the seeded page: the mock serves no rows on a refetch.
          refreshOnAction: () => false,
          onResolved: (action, ids, result) => resolved.push({ action: action.name, ids, result }),
        },
      });
      state = s;
      const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
      if (opts.preferredId) {
        def.preferredId = opts.preferredId;
        def.identifierFields = [...opts.preferredId];
      }
      def.actions = {
        table: [],
        row: [],
        rows: opts.actions ?? [archive, smallCap, notify],
        default: {},
      };
      const fields = [...(def.identifierFields ?? def.preferredId)];
      for (const a of def.actions.rows) {
        if (!a.idMap) continue;
        for (const p of Object.values(a.idMap)) if (!fields.includes(p)) fields.push(p);
      }
      def.identifierFields = fields;
      internals.init(def);
      const cache = new Map<number, Record<string, unknown>>();
      rows.forEach((r, i) => cache.set(i, { ...r, taskId: r.id * 100 }));
      s.windowCache.value = cache;
      s.results.value = [...cache.values()];
      s.totalCount.value = 10;
      s.selectMode.value = "multi";
      s.allowSelectAllMatching.value = true;
      provideTableContext({ state: s, client, controls: {} });
      return () => h(AsTableActions, null, opts.slot ? { default: opts.slot } : undefined);
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  return { wrapper, state: state!, countFn, runFn, actionFn, resolved };
}

async function enterQuery(state: ReactiveTableState, exclude: number[] = []) {
  state.searchTerm.value = "x";
  state.selectAllMatching();
  state.deselectAll(rows.filter((r) => exclude.includes(r.id)));
  await nextTick();
}

function menuItems() {
  return Array.from(document.querySelectorAll<HTMLElement>("[role=menuitem]"));
}

async function openMenu(wrapper: ReturnType<typeof mount>) {
  const more = wrapper.get(".as-table-actions-more");
  await more.trigger("pointerdown", { button: 0, pointerType: "mouse" });
  await more.trigger("keydown", { key: "Enter" });
  await flushPromises();
}

describe("<AsTableActions> in a query selection", () => {
  it("resolves to the rows level with no ids, gating by queryTarget and the count", async () => {
    let scope: Record<string, unknown> = {};
    const { state } = setupToolbar();
    await enterQuery(state, [2]);
    const Host = defineComponent({
      setup() {
        provideTableContext({ state, client: {} as Client, controls: {} });
        return () =>
          h(AsTableActions, null, {
            default: (s: Record<string, unknown>) => {
              scope = s;
              return null;
            },
          });
      },
    });
    mount(Host);
    await nextTick();
    expect(scope.level).toBe("rows");
    expect(scope.ids).toEqual([]);
    expect(scope.count).toBe(9);
    expect(scope.target).toMatchObject({ search: "x", exclude: [{ id: 2 }] });
    const actions = [scope.defaultAction, ...(scope.otherActions as TVueTableActionInfo[])].filter(
      Boolean,
    ) as TVueTableActionInfo[];
    const byName = Object.fromEntries(actions.map((a) => [a.name, a.disabledReason]));
    expect(byName).toEqual({
      archive: undefined,
      reopen: "At most 5 rows",
      notify: QUERY_TARGET_UNSUPPORTED_REASON,
    });
  });

  it("counts, confirms with the count, then runs with expectCount and clears the selection", async () => {
    const { state, wrapper, countFn, runFn, resolved } = setupToolbar({ actions: [archive] });
    await enterQuery(state, [2]);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    expect(countFn).toHaveBeenCalledWith("archive", {
      filter: undefined,
      search: "x",
      index: undefined,
      exclude: [{ id: 2 }],
    });
    expect(state.confirmRequest.value?.message).toBe("Run “Archive” on 7 rows?");
    state.acceptPrompt();
    await flushPromises();
    expect(runFn).toHaveBeenCalledWith(
      "archive",
      expect.objectContaining({ search: "x", exclude: [{ id: 2 }], expectCount: 7 }),
      undefined,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.ids).toEqual([]);
    const result = resolved[0]!.result;
    expect(result.ok && result.kind === "backend" && result.target).toEqual({
      matched: 7,
      summary: {
        matched: 7,
        processed: 6,
        skipped: [{ id: { id: 4 }, reason: "stale" }],
        failed: [],
      },
    });
    expect(state.querySelection.value).toBeNull();
  });

  it("uses the action's promptText with $N = the matched count", async () => {
    const { state, wrapper } = setupToolbar({
      actions: [{ ...archive, promptText: ["Archive one?", "Archive $N tasks?"] }],
    });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    expect(state.confirmRequest.value?.message).toBe("Archive 7 tasks?");
    state.dismissPrompt();
    await flushPromises();
  });

  it("cancelling the confirmation runs nothing and keeps the selection", async () => {
    const { state, wrapper, runFn } = setupToolbar({ actions: [archive] });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    state.dismissPrompt();
    await flushPromises();
    expect(runFn).not.toHaveBeenCalled();
    expect(state.querySelection.value).not.toBeNull();
  });

  it("TARGET_CHANGED re-prompts once with the new count and runs again on yes", async () => {
    const runFn = vi
      .fn()
      .mockRejectedValueOnce(targetChanged(8))
      .mockResolvedValueOnce({ message: "done" });
    const { state, wrapper, resolved } = setupToolbar({ actions: [archive], run: runFn });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    state.acceptPrompt();
    await flushPromises();
    expect(state.confirmRequest.value?.message).toBe(
      "The rows matching the query changed. Run “Archive” on 8 rows?",
    );
    state.acceptPrompt();
    await flushPromises();
    expect(runFn).toHaveBeenCalledTimes(2);
    expect(runFn.mock.calls[1]![1]).toMatchObject({ expectCount: 8 });
    expect(resolved[0]!.result).toMatchObject({
      ok: true,
      message: "done",
      target: { matched: 8 },
    });
  });

  it("declining the TARGET_CHANGED re-prompt settles the action as that error", async () => {
    const runFn = vi.fn().mockRejectedValue(targetChanged(8));
    const { state, wrapper, resolved } = setupToolbar({ actions: [archive], run: runFn });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    state.acceptPrompt();
    await flushPromises();
    state.dismissPrompt();
    await flushPromises();
    expect(runFn).toHaveBeenCalledTimes(1);
    expect(resolved[0]!.result).toMatchObject({ ok: false, kind: "error" });
    expect(state.querySelection.value).not.toBeNull();
  });

  it("a failed count settles as the action's error result without prompting", async () => {
    const tooLarge = Object.assign(new Error("too large"), {
      name: "ActionTargetError",
      code: "TARGET_TOO_LARGE",
      cap: 500,
    });
    const { state, wrapper, runFn, resolved } = setupToolbar({
      actions: [archive],
      count: () => Promise.reject(tooLarge),
    });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    expect(state.confirmRequest.value).toBeNull();
    expect(runFn).not.toHaveBeenCalled();
    expect(resolved[0]!.result).toMatchObject({ ok: false, kind: "error", error: tooLarge });
    expect(state.actions.lastResult.value.get("archive")?.ok).toBe(false);
  });

  it("an input-form action shows the count in the form request, then runs with the input", async () => {
    const { state, wrapper, runFn } = setupToolbar({
      actions: [{ ...archive, inputForm: "ArchiveInput" }],
    });
    await enterQuery(state);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    expect(state.confirmRequest.value).toBeNull();
    expect(state.actionFormRequest.value).toMatchObject({ count: 7, identifiers: [] });
    state.acceptActionForm({ reason: "old" });
    await flushPromises();
    expect(runFn).toHaveBeenCalledWith("archive", expect.objectContaining({ expectCount: 7 }), {
      reason: "old",
    });
  });

  it("a delegated action's exclusions use its idMap paths", async () => {
    const delegated: TDbActionInfo = {
      ...archive,
      owner: "/src",
      idMap: { id: "taskId" },
      queryTarget: { maxRows: 500, url: "/view/delegated-actions/archive" },
    };
    const { state, wrapper, countFn } = setupToolbar({ actions: [delegated], preferredId: [] });
    await enterQuery(state, [1]);
    await wrapper.get(".as-table-actions-btn").trigger("click");
    await flushPromises();
    expect(countFn.mock.calls[0]![1]).toMatchObject({ exclude: [{ taskId: 100 }] });
    state.dismissPrompt();
    await flushPromises();
  });

  it("menu entries of a query selection carry their disabled reasons", async () => {
    const { state, wrapper } = setupToolbar();
    await enterQuery(state);
    await openMenu(wrapper);
    const labels = menuItems().map((el) => el.getAttribute("aria-label"));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Reopen, At most 5 rows",
        `Notify, ${QUERY_TARGET_UNSUPPORTED_REASON}`,
      ]),
    );
  });
});

// ── Delegated actions (R2): identifiers carry identifierFields ──────────────

describe("action identifiers (since 0.1.147)", () => {
  it("extractIdentifier keeps a dot path's nesting", () => {
    expect(extractIdentifier({ id: 1, ref: { key: "K", x: 1 } }, ["id", "ref.key"])).toEqual({
      id: 1,
      ref: { key: "K" },
    });
  });

  it("actionIdentifiers: a delegated action keeps its idMap paths, others the preferredId", () => {
    const ids = [{ id: 1, taskId: 100 }];
    expect(actionIdentifiers({ idMap: { id: "taskId" } }, ids, ["id"])).toEqual([{ taskId: 100 }]);
    expect(actionIdentifiers({}, ids, ["id"])).toEqual([{ id: 1 }]);
    const exact = [{ id: 1 }];
    expect(actionIdentifiers({}, exact, ["id"])).toBe(exact);
  });

  it("the toolbar sends a delegated bulk action its idMap paths and an own one its preferredId", async () => {
    const delegated: TDbActionInfo = {
      ...notify,
      name: "close",
      owner: "/src",
      idMap: { id: "taskId" },
    };
    let scope: Record<string, unknown> = {};
    const { state, actionFn } = setupToolbar({
      actions: [delegated, notify],
      slot: (s) => {
        scope = s;
        return null;
      },
    });
    state.selectedRows.value = [1, 3];
    await nextTick();
    const invoke = scope.invoke as (a: TVueTableActionInfo) => Promise<void>;
    const list = scope.otherActions as TVueTableActionInfo[];
    await invoke(list.find((a) => a.name === "notify")!);
    await flushPromises();
    expect(actionFn).toHaveBeenLastCalledWith("notify", [{ id: 1 }, { id: 3 }], undefined);
    await invoke(list.find((a) => a.name === "close")!);
    await flushPromises();
    expect(actionFn).toHaveBeenLastCalledWith(
      "close",
      [{ taskId: 100 }, { taskId: 300 }],
      undefined,
    );
  });
});

// ── Review follow-ups ──────────────────────────────────────────────────────

describe("query selection — identity and edge cases", () => {
  it("exclusions survive a refetch with the default rowValueFn (row objects)", async () => {
    const mounted = mountWithTableContext(AsTable, {
      columns,
      seedRows: rows,
      totalCount: 10,
      decorateDef: withActions([archive]) as never,
      props: { columns, rows, select: "multi" },
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    const { state } = mounted;
    await nextTick();
    state.selectAllMatching();
    state.deselectAll([rows[1]!]);
    // A refetch replaces every row object.
    const clones = rows.map((r) => ({ ...r }));
    state.windowCache.value = new Map(clones.map((r, i) => [i, r]));
    expect(state.isPkSelected(clones[1])).toBe(false);
    expect(state.isPkSelected(clones[0])).toBe(true);
    state.deselectAll([clones[1]!]);
    expect(state.querySelection.value!.excluded).toHaveLength(1);
    expect(state.selectedCount.value).toBe(9);
    state.selectAll([clones[1]!]);
    expect(state.querySelection.value!.excluded).toEqual([]);
  });

  it("is not offered when every row is loaded, ineligible ones included", async () => {
    const mounted = mountWithTableContext(AsTable, {
      columns,
      seedRows: rows,
      totalCount: 3,
      selection: { rowValueFn: (row) => row.id },
      decorateDef: withActions([archive]) as never,
      props: { columns, rows, select: "multi", rowSelectable: (r: { id: number }) => r.id !== 2 },
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    await nextTick();
    expect(mounted.state.loadedEligiblePks.value).toEqual([1, 3]);
    expect(mounted.state.canSelectAllMatching.value).toBe(false);
  });

  it("switching multi → single ends it", async () => {
    const props = reactive({ columns, rows, select: "multi" });
    const { state } = mountWithTableContext(AsTable, {
      columns,
      seedRows: rows,
      totalCount: 10,
      selection: { rowValueFn: (row) => row.id },
      decorateDef: withActions([archive]) as never,
      props,
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    await nextTick();
    state.selectAllMatching();
    props.select = "single";
    await nextTick();
    expect(state.querySelection.value).toBeNull();
  });

  it("<AsWindowTable> offers the header checkbox over the cached rows while partly loaded", async () => {
    const { state, wrapper } = setupTable({ component: AsWindowTable });
    await nextTick();
    const header = wrapper.get(".as-th-select .as-table-checkbox");
    await header.trigger("click");
    expect(state.selectedRows.value).toEqual([1, 2, 3]);
    expect(wrapper.find("[data-select-all-matching]").exists()).toBe(true);
  });
});

describe("delegated identifiers — follow-ups", () => {
  it("$select carries the idMap columns", () => {
    const { state } = mountWithTableContext(AsTable, {
      columns: [mockColumn("name")],
      fetchableExtra: ["taskId"],
      decorateDef: ((def: { identifierFields?: string[] }) => {
        def.identifierFields = ["id", "taskId"];
      }) as never,
      props: { columns, rows: [] },
    });
    expect(state.buildQuery().controls?.$select).toContain("taskId");
  });

  it("a scalar key whose row is not loaded still wraps into the single-field preferredId", async () => {
    let scope: Record<string, unknown> = {};
    const { state, actionFn } = setupToolbar({
      actions: [notify],
      slot: (s) => {
        scope = s;
        return null;
      },
    });
    state.selectedRows.value = [1, 99];
    await nextTick();
    // identifierFields = ["id"] here; widen it like a table with a delegated action.
    state.tableDef.value = { ...state.tableDef.value!, identifierFields: ["id", "taskId"] };
    await nextTick();
    expect(scope.ids).toEqual([{ id: 1, taskId: 100 }, { id: 99 }]);
    const invoke = scope.invoke as (a: TVueTableActionInfo) => Promise<void>;
    await invoke(scope.defaultAction as TVueTableActionInfo);
    await flushPromises();
    expect(actionFn).toHaveBeenLastCalledWith("notify", [{ id: 1 }, { id: 99 }], undefined);
  });

  it("actionIdentifiers keeps a dotted idMap path nested, and returns [] without fields", () => {
    expect(
      actionIdentifiers({ idMap: { id: "ref.key" } }, [{ id: 1, ref: { key: "K" } }], ["id"]),
    ).toEqual([{ ref: { key: "K" } }]);
    expect(actionIdentifiers({}, [{ taskId: 1 }], [])).toEqual([]);
  });
});
