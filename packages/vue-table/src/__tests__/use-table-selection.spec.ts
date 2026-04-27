import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableSelection } from "../composables/use-table-selection";
import type { ReactiveTableState } from "../types";
import { stubClient } from "./helpers";

function setup(mode: "none" | "single" | "multi", keepAfterRefresh = false) {
  let state!: ReactiveTableState;

  mount(
    defineComponent({
      setup() {
        ({ state } = createTableState({
          client: stubClient(),
          query: { queryOnMount: false },
          selection: { mode, rowValueFn: (r) => r.id },
        }));
        useTableSelection(state, { keepAfterRefresh });
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

  it("clears selection on results change (keepAfterRefresh=false)", async () => {
    const state = setup("multi", false);

    state.selectedRows.value = [1, 2];
    expect(state.selectedCount.value).toBe(2);

    // Simulate results refresh
    state.results.value = [{ id: 1 }, { id: 3 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([]);
  });

  it("keeps matching selection on results change (keepAfterRefresh=true)", async () => {
    const state = setup("multi", true);

    state.selectedRows.value = [1, 2];
    expect(state.selectedCount.value).toBe(2);

    // Simulate results refresh — id=2 is gone
    state.results.value = [{ id: 1 }, { id: 3 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([1]);
  });

  it("rowValueFn extracts value for reconciliation", async () => {
    const state = setup("multi", true);

    state.selectedRows.value = [10, 20, 30];
    state.results.value = [{ id: 20 }, { id: 30 }, { id: 40 }];
    await nextTick();

    expect(state.selectedRows.value).toEqual([20, 30]);
  });

  describe("results-replacement vs results-extension", () => {
    it("forward extension does NOT trim selection", async () => {
      const state = setup("multi", false);
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
      const state = setup("multi", false);
      const original = [{ id: 200 }, { id: 201 }];
      state.results.value = original;
      state.resultsStart.value = 200;
      await nextTick();
      state.selectedRows.value = [200, 201];

      // Backward extension: prepend rows AND decrement resultsStart by delta.
      // Last-row reference stays identical; resultsStart shifts by -delta.
      const prepended = [{ id: 198 }, { id: 199 }, ...original];
      state.results.value = prepended;
      state.resultsStart.value = 198;
      await nextTick();
      // Selection must be untouched.
      expect(state.selectedRows.value).toEqual([200, 201]);
    });

    it("replacement DOES clear selection (default keepAfterRefresh=false)", async () => {
      const state = setup("multi", false);
      state.results.value = [{ id: 1 }, { id: 2 }];
      state.resultsStart.value = 0;
      await nextTick();
      state.selectedRows.value = [1, 2];

      // Replacement: first-row reference changes (and resultsStart same).
      state.results.value = [{ id: 100 }, { id: 101 }];
      await nextTick();
      expect(state.selectedRows.value).toEqual([]);
    });
  });
});
