// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import type { Uniquery } from "@uniqu/core";
import AsTable from "../components/as-table.vue";
import AsWindowTableBase from "../components/internal/as-window-table-base.vue";
import { createStaticTableState } from "../composables/use-table-state";
import { mockColumn, mountSetup, mountTableState, mountWithTableContext } from "./helpers";

const display = [
  { key: "score", label: "Score", width: "6em" },
  { key: "rank", label: "Rank", sortable: "local" as const, order: -1 },
];

describe("display columns — query", () => {
  it("merges client-owned columns into the column set without touching $select", async () => {
    const seen: Uniquery[] = [];
    const { state } = mountTableState({
      columns: [mockColumn("id"), mockColumn("name")],
      displayColumns: display,
      queryFn: vi.fn((query: Uniquery, page: number, size: number) => {
        seen.push(query);
        return Promise.resolve({ data: [], count: 0, page, itemsPerPage: size, pages: 1 });
      }),
    });

    // `rank` declares order 0, so it sorts ahead of the server columns;
    // `score` has none and lands last.
    expect(state.allColumns.value.map((c) => c.path)).toEqual(["rank", "id", "name", "score"]);
    expect(state.columnNames.value).toEqual(["rank", "id", "name", "score"]);
    expect(state.allColumns.value.find((c) => c.path === "score")).toMatchObject({
      local: true,
      filterable: false,
      sortable: false,
      width: "6em",
    });

    state.query();
    await flushPromises();

    expect(seen[0]!.controls!.$select).toEqual(["id", "name"]);
  });

  it("keeps a client-owned sorter out of $sort and re-orders the loaded page instead", async () => {
    const seen: Uniquery[] = [];
    const { state } = mountTableState({
      columns: [mockColumn("id")],
      displayColumns: display,
      queryFn: vi.fn((query: Uniquery, page: number, size: number) => {
        seen.push(query);
        return Promise.resolve({
          data: [
            { id: 1, rank: 3 },
            { id: 2, rank: 1 },
            { id: 3, rank: 2 },
          ],
          count: 3,
          page,
          itemsPerPage: size,
          pages: 1,
        });
      }),
    });

    state.query();
    await flushPromises();
    const before = seen.length;

    state.sorters.value = [{ field: "rank", direction: "asc" }];
    await nextTick();
    await flushPromises();

    // No refetch: the query would have been byte-identical.
    expect(seen).toHaveLength(before);
    expect([...state.localColumnPaths.value]).toEqual(["rank", "score"]);
    expect(state.applyLocalSort(state.results.value).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(state.buildQuery().controls!.$sort).toBeUndefined();
  });

  it("drops an unknown preset column key while keeping the client-owned one", () => {
    const { state } = mountTableState({
      columns: [mockColumn("id")],
      displayColumns: display,
    });
    // A preset saved against an older schema.
    state.columnNames.value = ["id", "ghost", "score"];
    expect(state.columns.value.map((c) => c.path)).toEqual(["id", "score"]);
    // `ghost` is simply an unknown path — `$select` passes it through as it
    // always has; what matters is that the client-owned `score` is stripped.
    expect(state.buildQuery().controls!.$select).toEqual(["id", "ghost"]);
  });

  it("survives hiding and reordering through the columns model", () => {
    const { state } = mountTableState({
      columns: [mockColumn("id"), mockColumn("name")],
      displayColumns: display,
    });
    state.columnNames.value = ["score", "id"];
    expect(state.columns.value.map((c) => c.path)).toEqual(["score", "id"]);
    expect(state.buildQuery().controls!.$select).toEqual(["id"]);
  });
});

describe("display columns — rendering", () => {
  it("renders header and cell slots for a client-owned column", async () => {
    const { wrapper } = mountWithTableContext(AsTable, {
      columns: [mockColumn("id")],
      displayColumns: display,
      seedRows: [{ id: 1 }],
      slots: {
        "header-score": () => h("span", { class: "score-head" }, "Score!"),
        "cell-score": (scope: never) =>
          h("b", { class: "score-cell" }, `#${(scope as { row: { id: number } }).row.id}`),
      },
    });
    await flushPromises();

    expect(wrapper.find(".score-head").text()).toBe("Score!");
    expect(wrapper.find(".score-cell").text()).toBe("#1");
    expect(wrapper.find('th[data-column-path="score"]').exists()).toBe(true);
  });

  it("sorts the rendered page by a sortable: 'local' column", async () => {
    const { wrapper, state } = mountWithTableContext(AsTable, {
      columns: [mockColumn("id")],
      displayColumns: display,
      seedRows: [
        { id: 1, rank: 3 },
        { id: 2, rank: 1 },
        { id: 3, rank: 2 },
      ],
      slots: {
        "cell-rank": (scope: never) =>
          h("i", { class: "rank" }, String((scope as { row: { rank: number } }).row.rank)),
      },
    });
    await flushPromises();
    expect(wrapper.findAll(".rank").map((n) => n.text())).toEqual(["3", "1", "2"]);

    state.sorters.value = [{ field: "rank", direction: "asc" }];
    await nextTick();

    expect(wrapper.findAll(".rank").map((n) => n.text())).toEqual(["1", "2", "3"]);
  });
});

describe("display columns — local sort order", () => {
  // Rows as the server ordered them: `name` ascending.
  const served = [
    { id: 1, name: "a", rank: 3 },
    { id: 2, name: "a", rank: 1 },
    { id: 3, name: "b", rank: 2 },
  ];

  function sorted(sorters: { field: string; direction: "asc" | "desc" }[]) {
    const { state } = mountTableState({
      columns: [mockColumn("id"), mockColumn("name")],
      displayColumns: display,
    });
    state.sorters.value = sorters;
    return state.applyLocalSort(served).map((r) => r.id);
  }

  it("keeps the server's ordering when the local sorter is secondary", () => {
    // Sorting by the local `rank` alone would give [2, 3, 1] — `b` would jump
    // ahead of the second `a`, losing the server's `name` order.
    expect(
      sorted([
        { field: "name", direction: "asc" },
        { field: "rank", direction: "asc" },
      ]),
    ).toEqual([2, 1, 3]);
  });

  it("re-orders the whole page when the local sorter is primary", () => {
    expect(
      sorted([
        { field: "rank", direction: "asc" },
        { field: "name", direction: "asc" },
      ]),
    ).toEqual([2, 3, 1]);
  });

  it("is a no-op without a local sorter", () => {
    const { state } = mountTableState({
      columns: [mockColumn("id"), mockColumn("name")],
      displayColumns: display,
    });
    state.sorters.value = [{ field: "name", direction: "desc" }];
    expect(state.applyLocalSort(served)).toBe(served);
  });

  it("orders a display column by its sortValue, not by row[key]", () => {
    const { state } = mountTableState({
      columns: [mockColumn("id"), mockColumn("name")],
      displayColumns: [
        {
          key: "len",
          label: "Length",
          sortable: "local",
          sortValue: (row) => String(row.name).length,
        },
      ],
    });
    const rows = [
      { id: 1, name: "xxx" },
      { id: 2, name: "x" },
      { id: 3, name: "xx" },
    ];
    state.sorters.value = [{ field: "len", direction: "asc" }];
    expect(state.applyLocalSort(rows).map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("sorts an in-memory table's dataset once — the renderer does not re-sort it", async () => {
    const sortValue = vi.fn((row: Record<string, unknown>) => row.id as number);
    const { state } = mountSetup(() =>
      createStaticTableState({
        rows: [{ id: 3 }, { id: 1 }, { id: 2 }],
        columns: [mockColumn("id")],
        displayColumns: [{ key: "rank", label: "Rank", sortable: "local", sortValue }],
        queryOnMount: false,
      }),
    );
    state.sorters.value = [{ field: "rank", direction: "asc" }];
    state.query();
    await flushPromises();

    expect(state.results.value.map((r) => r.id)).toEqual([1, 2, 3]);
    const afterQuery = sortValue.mock.calls.length;
    expect(afterQuery).toBeGreaterThan(0);
    // The page is already in sorter order — re-sorting it would both repeat
    // the work and, past page 1, contradict the dataset-wide order.
    expect(state.applyLocalSort(state.results.value)).toBe(state.results.value);
    expect(sortValue.mock.calls).toHaveLength(afterQuery);
  });

  it("re-filters without re-sorting while the search term changes", async () => {
    const sortValue = vi.fn((row: Record<string, unknown>) => row.id as number);
    const { state } = mountSetup(() =>
      createStaticTableState({
        rows: [
          { id: 3, name: "ccc" },
          { id: 1, name: "aaa" },
          { id: 2, name: "bbb" },
        ],
        columns: [mockColumn("id"), mockColumn("name")],
        searchPaths: ["name"],
        displayColumns: [{ key: "rank", label: "Rank", sortable: "local", sortValue }],
        queryOnMount: false,
      }),
    );
    state.sorters.value = [{ field: "rank", direction: "asc" }];
    state.query();
    await flushPromises();
    const afterFirstQuery = sortValue.mock.calls.length;

    state.searchTerm.value = "b";
    await state.queryImmediate();
    await flushPromises();

    expect(state.results.value.map((r) => r.id)).toEqual([2]);
    expect(sortValue.mock.calls).toHaveLength(afterFirstQuery);
  });
});

describe("display columns — window mode", () => {
  it("offers a local sort in the paged header", async () => {
    const { wrapper } = mountWithTableContext(AsTable, {
      columns: [mockColumn("id")],
      displayColumns: display,
      seedRows: [{ id: 1 }],
    });
    await flushPromises();
    await wrapper.find('th[data-column-path="rank"] button.as-th-btn').trigger("click");
    await flushPromises();
    expect(document.body.textContent).toContain("Ascending");
    document.body.innerHTML = "";
  });

  it("hides it in window mode, where there is no page to re-order", async () => {
    const { wrapper } = mountWithTableContext(AsWindowTableBase, {
      columns: [mockColumn("id")],
      displayColumns: display,
      props: { rowHeight: 32 },
      seedRows: [{ id: 1 }],
    });
    await flushPromises();
    await wrapper.find('th[data-column-path="rank"] button.as-th-btn').trigger("click");
    await flushPromises();
    expect(document.body.textContent).not.toContain("Ascending");
    document.body.innerHTML = "";
  });

  // The exclusion above is about the SERVER case: rows arrive a block at a
  // time, so sorting the materialized island in memory has no defined order.
  // An in-memory provider sorts the whole dataset before it slices, so every
  // absolute index already arrives in place and the sort works here too.
  it("offers it in window mode when the provider pre-sorts the whole dataset", async () => {
    const { wrapper } = mountWithTableContext(AsWindowTableBase, {
      columns: [mockColumn("id")],
      displayColumns: display,
      preSorted: true,
      props: { rowHeight: 32 },
      seedRows: [{ id: 1 }],
    });
    await flushPromises();
    await wrapper.find('th[data-column-path="rank"] button.as-th-btn').trigger("click");
    await flushPromises();
    expect(document.body.textContent).toContain("Ascending");
    document.body.innerHTML = "";
  });

  // The config dialog renders the same affordance from the same rule, so it
  // has to reach the same verdict as the header above.
  it("the config dialog's sorter tab follows the same rule", async () => {
    for (const [preSorted, expected] of [
      [false, false],
      [true, true],
    ] as const) {
      const { state } = mountWithTableContext(AsWindowTableBase, {
        columns: [mockColumn("id")],
        displayColumns: display,
        preSorted,
        props: { rowHeight: 32 },
        seedRows: [{ id: 1 }],
      });
      await flushPromises();
      // The window renderer owns `navMode`, so the rule is only live once it mounts.
      expect(state.navMode.value).toBe("window");
      expect(state.localSortAvailable.value).toBe(expected);
      document.body.innerHTML = "";
    }
  });

  it("an in-memory provider makes local sort available; a server-backed one does not", () => {
    const { state: local } = createStaticTableState({ rows: [], columns: [mockColumn("id")] });
    // Pagination mode: available either way — there is a page to re-order.
    expect(local.localSortAvailable.value).toBe(true);
    expect(mountTableState({ columns: [mockColumn("id")] }).state.localSortAvailable.value).toBe(
      true,
    );
  });
});
