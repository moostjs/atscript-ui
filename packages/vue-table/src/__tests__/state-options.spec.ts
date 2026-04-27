import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta, mockColumn, mockTableDef } from "./helpers";

function setup(options: Parameters<typeof createTableState>[0]) {
  let state!: ReactiveTableState;
  mount(
    defineComponent({
      setup() {
        const { state: s, internals } = createTableState(options);
        state = s;
        internals.init(mockTableDef([mockColumn("name")]));
        return () => h("div");
      },
    }),
  );
  return state;
}

describe("createTableState options", () => {
  it("forceFilters AND-merged into every fetch", async () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 0 });
    const state = setup({
      client: mock.client,
      query: {
        queryOnMount: false,
        forceFilters: { status: { $eq: "active" } },
      },
    });
    state.filters.value = { name: [{ type: "eq", value: ["alice"] }] };
    state.query();
    await flushPromises();
    const query = mock.pagesFn.mock.calls[0][0];
    expect(query.filter).toBeTruthy();
  });

  it("forceSorters prepended", async () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 0 });
    const state = setup({
      client: mock.client,
      query: {
        queryOnMount: false,
        forceSorters: [{ field: "id", direction: "asc" }],
      },
    });
    state.sorters.value = [{ field: "name", direction: "desc" }];
    state.query();
    await flushPromises();
    const query = mock.pagesFn.mock.calls[0][0];
    expect(query.controls.$sort).toEqual({ id: 1, name: -1 });
  });

  it("queryFn override used in place of client.pages", async () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 0 });
    const customFn = vi
      .fn()
      .mockResolvedValue({ data: [{ id: 1 }], count: 1, page: 1, itemsPerPage: 50, pages: 1 });
    const state = setup({
      client: mock.client,
      query: { queryOnMount: false, fn: customFn },
    });
    state.query();
    await flushPromises();
    expect(customFn).toHaveBeenCalled();
    expect(mock.pagesFn).not.toHaveBeenCalled();
    expect(state.results.value).toEqual([{ id: 1 }]);
  });

  it("blockQuery suppresses query/queryNext/loadRange", async () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 0 });
    const state = setup({
      client: mock.client,
      query: { queryOnMount: false, blockQuery: true },
    });
    state.query();
    state.queryNext();
    await state.loadRange(0, 100);
    await flushPromises();
    expect(mock.pagesFn).not.toHaveBeenCalled();
  });
});
