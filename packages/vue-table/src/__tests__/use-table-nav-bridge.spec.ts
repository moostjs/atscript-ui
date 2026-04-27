import { describe, it, expect } from "vitest";
import { createTableState } from "../composables/use-table-state";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import { captureMainActions, kbd as key, mountSetup, seedWindowCache, stubClient } from "./helpers";

function setupState(rows: Record<string, unknown>[]) {
  return mountSetup(() => {
    const { state } = createTableState({
      client: stubClient(),
      query: { queryOnMount: false },
      selection: { mode: "multi", rowValueFn: (r) => r.id },
    });
    seedWindowCache(state, rows);
    return state;
  });
}

describe("useTableNavBridge", () => {
  it("throws when called outside <as-table-root> with no explicit state", () => {
    expect(() => mountSetup(() => useTableNavBridge())).toThrow(
      /useTableNavBridge\(\) called outside of <as-table-root>/,
    );
  });

  it("explicit state binds to that state", () => {
    const stateA = setupState([{ id: "a1" }, { id: "a2" }]);
    const stateB = setupState([{ id: "b1" }, { id: "b2" }, { id: "b3" }]);
    const aIdx = mountSetup(() => {
      const bridge = useTableNavBridge(stateB);
      bridge.onKeydown(key({ key: "ArrowDown" }));
      return stateA.activeIndex.value;
    });
    expect(stateB.activeIndex.value).not.toBe(-1);
    expect(aIdx).toBe(-1);
  });

  it("opts.enterAction defaults to that action when no per-call override", () => {
    const state = setupState([{ id: "x" }, { id: "y" }, { id: "z" }, { id: "w" }]);
    state.setActive(3);
    const { captured, dispose } = captureMainActions(state);
    const bridge = mountSetup(() => useTableNavBridge(state, { enterAction: "toggle-select" }));

    bridge.onKeydown(key({ key: "Enter" }));
    expect(state.selectedRows.value).toEqual(["w"]);
    expect(captured.length).toBe(0);
    dispose();
  });

  it("per-call enterAction wins over default", () => {
    const state = setupState([{ id: "x" }, { id: "y" }]);
    state.setActive(0);
    const { captured, dispose } = captureMainActions(state);
    const bridge = mountSetup(() => useTableNavBridge(state, { enterAction: "toggle-select" }));

    bridge.onKeydown(key({ key: "Enter" }), { enterAction: "main-action" });
    expect(captured.length).toBe(1);
    dispose();
  });

  it("wrapper bridges share the underlying state's activeIndex/setActive references", () => {
    const state = setupState([{ id: "x" }, { id: "y" }]);
    const { bridgeA, bridgeB } = mountSetup(() => ({
      bridgeA: useTableNavBridge(state),
      bridgeB: useTableNavBridge(state, { enterAction: "toggle-select" }),
    }));
    expect(bridgeA).not.toBe(bridgeB);
    expect(bridgeA.activeIndex).toBe(bridgeB.activeIndex);
    expect(bridgeA.setActive).toBe(bridgeB.setActive);
    expect(bridgeA.clearActive).toBe(bridgeB.clearActive);
  });
});
