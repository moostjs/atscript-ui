import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta, mockColumn, mockTableDef } from "./helpers";

function setup() {
  const mock = createMockClient({
    meta: createMockMeta(["name"]),
    data: [{ id: 1 }],
    count: 100,
  });
  let state!: ReactiveTableState;
  mount(
    defineComponent({
      setup() {
        const { state: s, internals } = createTableState({
          client: mock.client,
          query: { queryOnMount: false },
        });
        state = s;
        internals.init(mockTableDef([mockColumn("name")]));
        return () => h("div");
      },
    }),
  );
  return { state, pagesFn: mock.pagesFn };
}

describe("state.invalidate()", () => {
  it("clears all data immediately and resets resultsStart from pagination", async () => {
    const { state } = setup();
    state.results.value = [{ id: 1 }, { id: 2 }];
    state.resultsStart.value = 0;
    state.windowCache.value = new Map([
      [0, { id: 1 }],
      [1, { id: 2 }],
    ]);
    state.windowLoading.value = new Set([2, 3]);
    state.totalCount.value = 100;
    state.pagination.value = { page: 5, itemsPerPage: 50 };

    state.invalidate();

    expect(state.results.value).toEqual([]);
    expect(state.windowCache.value.size).toBe(0);
    expect(state.windowLoading.value.size).toBe(0);
    expect(state.resultsStart.value).toBe(200);
    expect(state.totalCount.value).toBe(0);
  });

  it("does NOT auto-refetch", async () => {
    const { state, pagesFn } = setup();
    state.invalidate();
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("subsequent stale responses are discarded", async () => {
    let resolveFetch!: (v: {
      data: unknown[];
      count: number;
      page: number;
      itemsPerPage: number;
      pages: number;
    }) => void;
    const slow = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolveFetch = res;
        }),
    );
    const mock = createMockClient({ meta: createMockMeta(["name"]) });
    mock.client.pages = slow as never;
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          const { state: s, internals } = createTableState({
            client: mock.client,
            query: { queryOnMount: false },
          });
          state = s;
          internals.init(mockTableDef([mockColumn("name")]));
          return () => h("div");
        },
      }),
    );
    const promise = state.loadRange(0, 100);
    state.invalidate();
    resolveFetch({ data: [{ id: 1 }], count: 1, page: 1, itemsPerPage: 100, pages: 1 });
    await promise;
    expect(state.windowCache.value.size).toBe(0);
  });
});
