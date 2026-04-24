import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import type { Client } from "@atscript/db-client";
import { createTableState, type TableStateInternals } from "../composables/use-table-state";
import { useTableQuery } from "../composables/use-table-query";
import type { ReactiveTableState } from "../types";
import { createMockMeta, createMockClient, mockColumn, mockTableDef } from "./helpers";

function setupQuery(opts?: { client?: Client }) {
  const mock = createMockClient({
    meta: createMockMeta(["name", "age"]),
    data: [{ id: 1 }, { id: 2 }],
    count: 10,
  });

  const client = opts?.client ?? mock.client;
  const pagesFn = opts?.client ? vi.fn() : mock.pagesFn;
  let state!: ReactiveTableState;

  mount(
    defineComponent({
      setup() {
        let internals: TableStateInternals;
        ({ state, internals } = createTableState());
        const cols = [mockColumn("name"), mockColumn("age")];
        internals.init(mockTableDef(cols));
        state.columnNames.value = ["name", "age"];

        useTableQuery(client, state, internals);
        return () => h("div");
      },
    }),
  );

  return { state, pagesFn };
}

describe("useTableQuery", () => {
  it("state.query() triggers a fetch", async () => {
    const { state, pagesFn } = setupQuery();

    state.query();
    await flushPromises();

    expect(pagesFn).toHaveBeenCalledOnce();
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(state.totalCount.value).toBe(10);
    expect(state.loadedCount.value).toBe(2);
  });

  it("sets queryError on fetch failure", async () => {
    const { client } = createMockClient({ meta: createMockMeta([]) });
    client.pages = vi.fn().mockRejectedValue(new Error("fetch failed")) as never;
    const { state } = setupQuery({ client });

    state.query();
    await flushPromises();

    expect(state.queryError.value).toBeInstanceOf(Error);
    expect(state.queryError.value!.message).toBe("fetch failed");
  });

  it("clears queryError on successful fetch", async () => {
    const { client } = createMockClient({ meta: createMockMeta([]) });
    client.pages = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }) as never;

    const { state } = setupQuery({ client });

    state.query();
    await flushPromises();
    expect(state.queryError.value).not.toBeNull();

    state.query();
    await flushPromises();
    expect(state.queryError.value).toBeNull();
  });

  it("passes visible column paths as $select", async () => {
    const { state, pagesFn } = setupQuery();

    state.query();
    await flushPromises();

    const query = pagesFn.mock.calls[0][0];
    expect(query.controls.$select).toEqual(["name", "age"]);
  });

  it("passes sorters as $sort", async () => {
    const { state, pagesFn } = setupQuery();

    state.sorters.value = [{ field: "name", direction: "asc" as const }];
    state.query();
    await flushPromises();

    const query = pagesFn.mock.calls[0][0];
    expect(query.controls.$sort).toEqual({ name: 1 });
  });

  it("flags mustRefresh on filter change", async () => {
    const { state } = setupQuery();

    state.filters.value = { name: [{ type: "eq", value: ["test"] }] };
    await nextTick();

    expect(state.mustRefresh.value).toBe(true);
  });

  it("resets pagination to page 1 on any filter mutation", async () => {
    const { state } = setupQuery();

    state.pagination.value = { page: 3, itemsPerPage: 50 };
    state.setFieldFilter("name", [{ type: "eq", value: ["test"] }]);
    await nextTick();
    expect(state.pagination.value.page).toBe(1);

    state.pagination.value = { page: 4, itemsPerPage: 50 };
    state.filters.value = {};
    await nextTick();
    expect(state.pagination.value.page).toBe(1);
  });

  it("resets pagination on searchTerm change", async () => {
    const { state } = setupQuery();

    state.pagination.value = { page: 5, itemsPerPage: 50 };
    state.searchTerm.value = "hello";
    await nextTick();

    expect(state.pagination.value.page).toBe(1);
  });
});
