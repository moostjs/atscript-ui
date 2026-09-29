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

describe("selection → loaded rows (rowByValue / rowOf / selectedRowObjects)", () => {
  const a = { id: 1, name: "A" };
  const b = { id: 2, name: "B" };

  it("rowByValue keys the window cache by rowValueFn and is memoised per cache instance", () => {
    const state = setup({});
    state.windowCache.value = new Map([
      [0, a],
      [1, b],
    ]);
    const first = state.rowByValue.value;
    expect(first.get(1)).toBe(a);
    expect(first.get(2)).toBe(b);
    // Same cache → same map (no rebuild per read).
    expect(state.rowByValue.value).toBe(first);
    // A fetch replaces the cache wholesale → one rebuild.
    const c = { id: 3, name: "C" };
    state.windowCache.value = new Map([[0, c]]);
    const next = state.rowByValue.value;
    expect(next).not.toBe(first);
    expect(next.get(3)).toBe(c);
    expect(next.has(1)).toBe(false);
  });

  it("rowOf: an object value is the row; a scalar resolves through the cache", () => {
    const state = setup({});
    state.windowCache.value = new Map([[0, a]]);
    const obj = { id: 9 };
    expect(state.rowOf(obj)).toBe(obj);
    expect(state.rowOf(1)).toBe(a);
    expect(state.rowOf(42)).toBeUndefined();
    expect(state.rowOf(null)).toBeUndefined();
    expect(state.rowOf(undefined)).toBeUndefined();
  });

  it("selectedRowObjects keeps selection order and leaves unloaded values out", () => {
    const state = setup({ selectedRows: ref<unknown[]>([2, 42, 1]), persistence: "persist" });
    state.windowCache.value = new Map([
      [0, a],
      [1, b],
    ]);
    expect(state.selectedRowObjects.value).toEqual([b, a]);
  });
});
