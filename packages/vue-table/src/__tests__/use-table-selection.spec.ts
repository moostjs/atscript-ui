import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableSelection, type SelectionPersistence } from "../composables/use-table-selection";
import type { ReactiveTableState } from "../types";
import { stubClient } from "./helpers";

function setup(mode: "none" | "single" | "multi", persistence: SelectionPersistence = "trim") {
  let state!: ReactiveTableState;

  mount(
    defineComponent({
      setup() {
        ({ state } = createTableState({
          client: stubClient(),
          query: { queryOnMount: false },
          selection: { mode, rowValueFn: (r) => r.id },
        }));
        useTableSelection(state, { mode: persistence });
        return () => h("div");
      },
    }),
  );

  return state;
}

describe("useTableSelection", () => {
  it("selectedRows is a plain shallowRef array", () => {
    const state = setup("multi");
    expect(state.selectedRows.value).toEqual([]);
    expect(state.selectedCount.value).toBe(0);
  });

  it("setting selectedRows updates selectedCount", () => {
    const state = setup("multi");
    state.selectedRows.value = [1, 2, 3];
    expect(state.selectedCount.value).toBe(3);
  });

  it("trim default keeps surviving PKs", async () => {
    const state = setup("multi", "trim");

    state.selectedRows.value = [1, 2];
    expect(state.selectedCount.value).toBe(2);

    state.results.value = [{ id: 1 }, { id: 3 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([1]);
  });

  it("clear mode drops everything on results replacement", async () => {
    const state = setup("multi", "clear");

    state.selectedRows.value = [1, 2];
    state.results.value = [{ id: 1 }, { id: 3 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([]);
  });

  it("persist mode never writes to selectedRows on replacement", async () => {
    const state = setup("multi", "persist");

    state.selectedRows.value = [1, 2];
    state.results.value = [{ id: 100 }, { id: 200 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([1, 2]);
  });

  it("rowValueFn extracts value for trim reconciliation", async () => {
    const state = setup("multi", "trim");

    state.selectedRows.value = [10, 20, 30];
    state.results.value = [{ id: 20 }, { id: 30 }, { id: 40 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([20, 30]);
  });

  describe("results-replacement vs results-extension", () => {
    it("forward extension does NOT trim selection (clear mode)", async () => {
      const state = setup("multi", "clear");
      const original = [{ id: 1 }, { id: 2 }];
      state.results.value = original;
      state.resultsStart.value = 0;
      await nextTick();
      state.selectedRows.value = [1, 2];

      // Forward extension: same first-row reference, same resultsStart, length grows.
      state.results.value = [...original, { id: 3 }];
      await nextTick();
      expect(state.selectedRows.value).toEqual([1, 2]);
    });

    it("backward extension does NOT trim selection (regression)", async () => {
      const state = setup("multi", "clear");
      const original = [{ id: 200 }, { id: 201 }];
      state.results.value = original;
      state.resultsStart.value = 200;
      await nextTick();
      state.selectedRows.value = [200, 201];

      const prepended = [{ id: 198 }, { id: 199 }, ...original];
      state.results.value = prepended;
      state.resultsStart.value = 198;
      await nextTick();
      expect(state.selectedRows.value).toEqual([200, 201]);
    });

    it("clear mode DOES drop selection on replacement", async () => {
      const state = setup("multi", "clear");
      state.results.value = [{ id: 1 }, { id: 2 }];
      state.resultsStart.value = 0;
      await nextTick();
      state.selectedRows.value = [1, 2];

      state.results.value = [{ id: 100 }, { id: 101 }];
      await nextTick();
      expect(state.selectedRows.value).toEqual([]);
    });
  });
});
