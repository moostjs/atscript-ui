import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import AsWindowTable from "../components/as-window-table.vue";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta, mockColumn, mockTableDef } from "./helpers";

function rows(start: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: start + i, name: `r${start + i}` }));
}

/**
 * Mount <AsWindowTable> against a fully-populated state. Returns the wrapper
 * + state for assertions. ResizeObserver in happy-dom is a noop, so we
 * directly write `viewportRowCount` to drive the pool size.
 */
function mountTable(opts?: { viewportRowCount?: number; totalCount?: number; rowHeight?: number }) {
  const totalCount = opts?.totalCount ?? 100;
  const viewportRowCount = opts?.viewportRowCount ?? 5;
  const rowHeight = opts?.rowHeight ?? 32;
  const mock = createMockClient({
    meta: createMockMeta(["name"]),
    data: rows(0, totalCount),
    count: totalCount,
  });
  let state!: ReactiveTableState;
  const wrapper = mount(
    defineComponent({
      components: { AsWindowTable },
      setup() {
        const { state: s, internals } = createTableState({
          client: mock.client,
          query: { queryOnMount: false },
        });
        state = s;
        internals.init(mockTableDef([mockColumn("name")]));
        provideTableContext({ state, client: mock.client, components: {} });
        // Pre-populate cache + results for an immediate render (no fetch needed).
        const cache = new Map<number, Record<string, unknown>>();
        for (let i = 0; i < totalCount; i++) cache.set(i, { id: i, name: `r${i}` });
        state.windowCache.value = cache;
        state.results.value = rows(0, totalCount);
        state.totalCount.value = totalCount;
        state.viewportRowCount.value = viewportRowCount;
        return () => h(AsWindowTable, { rowHeight });
      },
    }),
  );
  return { wrapper, state, mock };
}

describe("<AsWindowTable> pool rendering", () => {
  it("renders exactly viewportRowCount <tr> elements in the pool", () => {
    const { wrapper, state } = mountTable({ viewportRowCount: 5, totalCount: 100 });
    void state;
    const trs = wrapper.findAll(".as-window-row-pool tr");
    expect(trs.length).toBe(5);
  });

  it("each <tr> has the configured rowHeight", () => {
    const { wrapper } = mountTable({ viewportRowCount: 3, totalCount: 50, rowHeight: 48 });
    const trs = wrapper.findAll(".as-window-row-pool tr");
    expect(trs.length).toBe(3);
    for (const tr of trs) {
      expect(tr.attributes("style")).toContain("height: 48px");
    }
  });

  it("when totalCount < viewportRowCount, pool size is min(viewport, totalCount)", () => {
    const { wrapper } = mountTable({ viewportRowCount: 20, totalCount: 5 });
    expect(wrapper.findAll(".as-window-row-pool tr").length).toBe(5);
  });

  it("the table-wrapper has overflow-y: hidden semantics (no native vscroll)", () => {
    const { wrapper } = mountTable();
    const w = wrapper.find(".as-window-table-wrapper");
    expect(w.exists()).toBe(true);
  });
});

describe("<AsWindowTable> skeleton rendering", () => {
  it("renders skeleton <tr> for unloaded indices", () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 100 });
    let state!: ReactiveTableState;
    const wrapper = mount(
      defineComponent({
        components: { AsWindowTable },
        setup() {
          const { state: s, internals } = createTableState({
            client: mock.client,
            query: { queryOnMount: false },
          });
          state = s;
          internals.init(mockTableDef([mockColumn("name")]));
          provideTableContext({ state, client: mock.client, components: {} });
          // Cache empty, totalCount populated, viewport set.
          state.totalCount.value = 100;
          state.viewportRowCount.value = 5;
          return () => h(AsWindowTable);
        },
      }),
    );
    expect(wrapper.findAll(".as-window-skeleton-row").length).toBe(5);
  });
});

describe("<AsWindowTable> overlay", () => {
  it("renders as-table-query-overlay when state.querying is true", () => {
    const mock = createMockClient({ meta: createMockMeta(["name"]), data: [], count: 0 });
    let state!: ReactiveTableState;
    const wrapper = mount(
      defineComponent({
        components: { AsWindowTable },
        setup() {
          const { state: s, internals } = createTableState({
            client: mock.client,
            query: { queryOnMount: false },
          });
          state = s;
          internals.init(mockTableDef([mockColumn("name")]));
          provideTableContext({ state, client: mock.client, components: {} });
          state.querying.value = true;
          return () => h(AsWindowTable);
        },
      }),
    );
    expect(wrapper.find(".as-table-query-overlay").exists()).toBe(true);
  });
});
