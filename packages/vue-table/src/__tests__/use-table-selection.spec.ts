import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableSelection } from "../composables/use-table-selection";
import type { ReactiveTableState } from "../types";

function setup(mode: "none" | "single" | "multi", keepAfterRefresh = false) {
  let state!: ReactiveTableState;

  mount(
    defineComponent({
      setup() {
        ({ state } = createTableState({
          select: mode,
          rowValueFn: (r) => r.id,
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
});
