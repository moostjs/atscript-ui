import { describe, it, expect, vi } from "vitest";
import { nextTick, reactive, ref, watch } from "vue";
import { flushPromises } from "@vue/test-utils";
import type { SortControl } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";
import AsTable from "../components/as-table.vue";
import { mockColumn, mountTableState, mountWithTableContext } from "./helpers";

const columns = [mockColumn("name"), mockColumn("status"), mockColumn("total")];

function lastQuery(pagesFn: ReturnType<typeof vi.fn>) {
  return pagesFn.mock.calls.at(-1)![0] as {
    filter?: unknown;
    controls: { $sort?: Record<string, number>; $select?: string[] };
  };
}

describe("reactive forceFilters / forceSorters / alwaysSelected", () => {
  it("(a) a changed ref sends one fetch on page 1 and keeps user state", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
    });
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);

    state.setFieldFilter("total", [{ type: "gt", value: [100] }]);
    state.searchTerm.value = "zed";
    state.sorters.value = [{ field: "name", direction: "desc" }];
    state.columnNames.value = ["name", "status"];
    await new Promise((r) => setTimeout(r, 600));
    state.pagination.value = { ...state.pagination.value, page: 3 };
    await flushPromises();
    pagesFn.mockClear();

    scope.value = { status: "shipped" };
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    const q = lastQuery(pagesFn);
    expect(JSON.stringify(q.filter)).toContain("shipped");
    expect(JSON.stringify(q.filter)).not.toContain("pending");
    expect(JSON.stringify(q.filter)).toContain("100");
    expect(pagesFn.mock.calls[0][1]).toBe(1);
    expect(state.pagination.value.page).toBe(1);
    expect(state.searchTerm.value).toBe("zed");
    expect(state.sorters.value).toEqual([{ field: "name", direction: "desc" }]);
    expect(state.columnNames.value).toEqual(["name", "status"]);
    expect(state.filters.value.total).toBeTruthy();
  });

  it("(b) a structurally equal new object sends no fetch", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending", total: { $gt: 1 } });
    const { pagesFn } = mountTableState({ columns, queryOnMount: true, forceFilters: scope });
    await flushPromises();
    pagesFn.mockClear();
    scope.value = { total: { $gt: 1 }, status: "pending" };
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("(c) an in-place mutation of a reactive filter sends one fetch", async () => {
    const scope = reactive<Record<string, unknown>>({ status: "pending" });
    const { pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: () => scope as FilterExpr,
    });
    await flushPromises();
    pagesFn.mockClear();
    scope.status = "shipped";
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
  });

  it("(d) a change while blocked sends nothing; unblocking sends one fetch with the new filter", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const blocked = ref(false);
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
      blockQuery: () => blocked.value,
    });
    await flushPromises();
    blocked.value = true;
    await flushPromises();
    pagesFn.mockClear();
    state.pagination.value = { ...state.pagination.value, page: 2 };
    await flushPromises();
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
    expect(state.pagination.value.page).toBe(1);

    blocked.value = false;
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
  });

  it("(e) mounting with a forced filter sends exactly one fetch", async () => {
    const { pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: { status: "pending" },
    });
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("(f) a change before the first query costs no extra fetch and uses the latest value", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const gate = ref(false);
    const { pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
      urlQueryReady: gate,
    });
    await flushPromises();
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
    gate.value = true;
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
  });

  it("(g) a change from page 3 lands on page 1, and window mode scrolls back to the top", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
    });
    await flushPromises();
    state.pagination.value = { ...state.pagination.value, page: 3 };
    await flushPromises();
    expect(state.pagination.value.page).toBe(3);
    pagesFn.mockClear();
    state.topIndex.value = 120;
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(state.pagination.value.page).toBe(1);
    expect(state.topIndex.value).toBe(0);
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("(h) a held query selection is reset and onSelectionReset fires", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const onSelectionReset = vi.fn();
    const rows = [
      { id: 1, name: "Ann" },
      { id: 2, name: "Bob" },
    ];
    const { state } = mountWithTableContext(AsTable, {
      columns,
      seedRows: rows,
      totalCount: 10,
      forceFilters: scope,
      selection: { rowValueFn: (row) => row.id, onSelectionReset },
      decorateDef: ((def: { actions: unknown }) => {
        def.actions = {
          table: [],
          row: [],
          rows: [
            {
              name: "archive",
              label: "Archive",
              level: "rows",
              processor: "backend",
              value: "/t/actions/archive",
              queryTarget: { maxRows: 500 },
            },
          ],
          default: {},
        };
      }) as never,
      props: { columns, rows, select: "multi" },
      onReady: (s) => {
        s.allowSelectAllMatching.value = true;
      },
    });
    await nextTick();
    state.selectAllMatching();
    await nextTick();
    expect(state.querySelection.value).not.toBeNull();
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(state.querySelection.value).toBeNull();
    expect(onSelectionReset).toHaveBeenCalledWith({ reason: "scope" });
  });

  it("(i) a forceSorters change sends one fetch and keeps the page", async () => {
    const forced = ref<SortControl[]>([{ field: "name", direction: "asc" }]);
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceSorters: forced,
    });
    await flushPromises();
    state.pagination.value = { ...state.pagination.value, page: 3 };
    await flushPromises();
    pagesFn.mockClear();
    forced.value = [{ field: "total", direction: "desc" }];
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(lastQuery(pagesFn).controls.$sort).toEqual({ total: -1 });
    expect(state.pagination.value.page).toBe(3);
    expect(state.forceSorters.value).toEqual([{ field: "total", direction: "desc" }]);
  });

  it("(j) an alwaysSelected change sends one fetch with the new $select", async () => {
    const always = ref<string[]>(["status"]);
    const { pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      fetchableExtra: ["status", "total"],
      queryOnMount: true,
      alwaysSelected: always,
    });
    await flushPromises();
    expect(lastQuery(pagesFn).controls.$select ?? []).toContain("status");
    pagesFn.mockClear();
    always.value = ["total"];
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    const select = lastQuery(pagesFn).controls.$select ?? [];
    expect(select).toContain("total");
    expect(select).not.toContain("status");
  });

  it("(k) a URL change plus a forced-filter change in one tick send one fetch; the URL's page wins", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
      limit: 50,
    });
    await flushPromises();
    pagesFn.mockClear();
    scope.value = { status: "shipped" };
    state.applyUrlQuery("name=bob&$skip=100");
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.pagination.value.page).toBe(3);
    expect(pagesFn.mock.calls[0][1]).toBe(3);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
  });

  it("(m) several scope props changing in one tick send one request; only the filter resets the page", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const forced = ref<SortControl[]>([{ field: "name", direction: "asc" }]);
    const always = ref<string[]>(["status"]);
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      fetchableExtra: ["status", "total"],
      queryOnMount: true,
      forceFilters: scope,
      forceSorters: forced,
      alwaysSelected: always,
    });
    await flushPromises();
    state.pagination.value = { ...state.pagination.value, page: 3 };
    await flushPromises();
    pagesFn.mockClear();

    forced.value = [{ field: "total", direction: "desc" }];
    always.value = ["total"];
    await flushPromises();
    // sorters + selection alone: one request, the page is kept
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.pagination.value.page).toBe(3);
    pagesFn.mockClear();

    scope.value = { status: "shipped" };
    forced.value = [{ field: "name", direction: "asc" }];
    always.value = ["status"];
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(pagesFn.mock.calls[0][1]).toBe(1);
    const q = lastQuery(pagesFn);
    expect(JSON.stringify(q.filter)).toContain("shipped");
    expect(q.controls.$sort).toEqual({ name: 1 });
    expect(q.controls.$select ?? []).toContain("status");
  });

  it("(n) a scope change in the same tick as a URL change is one request with the URL's page", async () => {
    const forced = ref<SortControl[]>([{ field: "name", direction: "asc" }]);
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
      forceSorters: forced,
      limit: 50,
    });
    await flushPromises();
    pagesFn.mockClear();
    // applied first, then the scope changes: the hydration owns the page and the request
    state.applyUrlQuery("$skip=100");
    forced.value = [{ field: "total", direction: "desc" }];
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(pagesFn.mock.calls[0][1]).toBe(3);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
    expect(lastQuery(pagesFn).controls.$sort).toEqual({ total: -1 });
  });

  it("(o) a URL applied by a later watcher in the same flush still gives one request with its page", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const route = ref("");
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      forceFilters: scope,
      limit: 50,
    });
    await flushPromises();
    // like the root's route watcher: created after the state's own watchers, so it runs after them
    watch(route, (url) => state.applyUrlQuery(url));
    pagesFn.mockClear();
    scope.value = { status: "shipped" };
    route.value = "$skip=100";
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(pagesFn.mock.calls[0][1]).toBe(3);
    expect(JSON.stringify(lastQuery(pagesFn).filter)).toContain("shipped");
  });

  it("(l) buildQuery() reads the live value", async () => {
    const scope = ref<FilterExpr | undefined>({ status: "pending" });
    const { state } = mountTableState({ columns, queryOnMount: true, forceFilters: scope });
    await flushPromises();
    expect(JSON.stringify(state.buildQuery().filter)).toContain("pending");
    scope.value = { status: "shipped" };
    expect(JSON.stringify(state.buildQuery().filter)).toContain("shipped");
    expect(state.forceFilters.value).toEqual({ status: "shipped" });
  });
});
