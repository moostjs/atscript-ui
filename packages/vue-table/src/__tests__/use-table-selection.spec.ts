import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableSelection } from "../composables/use-table-selection";
import type { ReactiveTableState } from "../types";

function setupSelection(mode: "none" | "single" | "multi") {
  let state!: ReactiveTableState;
  let api!: ReturnType<typeof useTableSelection>;

  mount(
    defineComponent({
      setup() {
        ({ state } = createTableState({
          selection: {
            mode,
            rowValueFn: (r) => r.id,
          },
        }));
        api = useTableSelection(state);
        return () => h("div");
      },
    }),
  );

  return { state, api };
}

describe("useTableSelection", () => {
  it("toggle adds and removes items (multi mode)", () => {
    const { state, api } = setupSelection("multi");

    api.toggle({ id: 1 });
    expect(state.selectedCount.value).toBe(1);
    expect(state.selectedValues.value).toEqual([1]);

    api.toggle({ id: 2 });
    expect(state.selectedCount.value).toBe(2);

    api.toggle({ id: 1 });
    expect(state.selectedCount.value).toBe(1);
    expect(state.selectedValues.value).toEqual([2]);
  });

  it("single mode keeps only one selection", () => {
    const { state, api } = setupSelection("single");

    api.toggle({ id: 1 });
    api.toggle({ id: 2 });

    expect(state.selectedCount.value).toBe(1);
    expect(state.selectedValues.value).toEqual([2]);
  });

  it("selectAll works in multi mode", () => {
    const { state, api } = setupSelection("multi");

    state.results.value = [{ id: 1 }, { id: 2 }, { id: 3 }];
    api.selectAll();

    expect(state.selectedCount.value).toBe(3);
  });

  it("deselectAll clears selection", () => {
    const { state, api } = setupSelection("multi");

    api.toggle({ id: 1 });
    api.toggle({ id: 2 });
    api.deselectAll();

    expect(state.selectedCount.value).toBe(0);
  });

  it("isSelected returns correct state", () => {
    const { api } = setupSelection("multi");

    api.toggle({ id: 1 });
    expect(api.isSelected({ id: 1 })).toBe(true);
    expect(api.isSelected({ id: 2 })).toBe(false);
  });

  it("none mode ignores all operations", () => {
    const { state, api } = setupSelection("none");

    api.toggle({ id: 1 });
    api.select({ id: 2 });

    expect(state.selectedCount.value).toBe(0);
    expect(api.isSelected({ id: 1 })).toBe(false);
  });
});
