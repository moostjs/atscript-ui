import { describe, it, expect } from "vitest";
import { nextTick, ref, type Ref } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableSelection, type SelectionPersistence } from "../composables/use-table-selection";
import type { ReactiveTableState } from "../types";
import { mountSetup, stubClient } from "./helpers";

function setup(opts: { selectedRows?: Ref<unknown[]>; persistence?: SelectionPersistence }) {
  return mountSetup<ReactiveTableState>(() => {
    const { state } = createTableState({
      client: stubClient(),
      query: { queryOnMount: false },
      selection: {
        mode: "multi",
        rowValueFn: (r) => r.id,
        selectedRows: opts.selectedRows,
      },
    });
    useTableSelection(state, { mode: opts.persistence ?? "trim" });
    return state;
  });
}

describe("selectedRows external ref", () => {
  it("preserves identity when externally provided", () => {
    const myRef = ref<unknown[]>([]);
    const state = setup({ selectedRows: myRef });
    expect(state.selectedRows).toBe(myRef);
  });

  it("framework writes flow through to external ref under trim", async () => {
    const myRef = ref<unknown[]>([1, 2, 3]);
    const state = setup({ selectedRows: myRef, persistence: "trim" });
    state.results.value = [{ id: 1 }, { id: 4 }];
    await nextTick();
    expect(myRef.value).toEqual([1]);
  });

  it("persist mode never touches the consumer's ref", async () => {
    const myRef = ref<unknown[]>(["a", "b"]);
    const state = setup({ selectedRows: myRef, persistence: "persist" });
    state.results.value = [{ id: 100 }, { id: 200 }];
    await nextTick();
    expect(myRef.value).toEqual(["a", "b"]);
    expect(state.selectedRows).toBe(myRef);
  });

  it("clear mode drops everything on results-replacement", async () => {
    const myRef = ref<unknown[]>([1, 2]);
    const state = setup({ selectedRows: myRef, persistence: "clear" });
    state.results.value = [{ id: 9 }];
    await nextTick();
    expect(myRef.value).toEqual([]);
  });

  it("local backing ref when none provided", () => {
    const state = setup({});
    expect(state.selectedRows.value).toEqual([]);
  });
});
