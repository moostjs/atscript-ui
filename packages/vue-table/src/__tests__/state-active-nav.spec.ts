import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import type { ReactiveTableState, TableNavBridge } from "../types";
import { captureMainActions, kbd as key, mountSetup, seedWindowCache, stubClient } from "./helpers";

function bridgeFor(state: ReactiveTableState): TableNavBridge {
  return mountSetup(() => useTableNavBridge(state));
}

/**
 * Test convenience: state no longer tracks selection mode (mode is owned by
 * the renderer's `:select` prop). Tests close over mode and pass it to the
 * mode-aware state methods (`toggleActiveSelection`, `handleNavKey`). The
 * returned `state` is augmented with `toggle()` and `nav()` shortcuts that
 * forward mode automatically — keeps test bodies short.
 */
function setup(
  mode: "none" | "single" | "multi",
  rows: Record<string, unknown>[] = [],
  totalCount = rows.length,
) {
  return mountSetup(() => {
    const { state } = createTableState({
      client: stubClient(),
      query: { queryOnMount: false },
      selection: { rowValueFn: (r) => r.id },
    });
    seedWindowCache(state, rows, totalCount);
    const enriched = state as ReactiveTableState & {
      toggle: () => void;
      nav: (
        ev: KeyboardEvent,
        opts?: { enterAction?: "main-action" | "toggle-select" | "passthrough" },
      ) => void;
    };
    enriched.toggle = () => state.toggleActiveSelection(mode);
    enriched.nav = (ev, opts) => state.handleNavKey(ev, { ...opts, mode });
    return enriched;
  });
}

describe("Active-row state", () => {
  it("initial activeIndex is -1", () => {
    const state = setup("none");
    expect(state.activeIndex.value).toBe(-1);
  });

  it("setActive clamps to dataset bounds", () => {
    const state = setup("none", [], 50);
    state.setActive(100);
    expect(state.activeIndex.value).toBe(49);
  });

  it("activeIndex auto-clamps when totalCount shrinks", async () => {
    const state = setup("none", [], 100);
    state.setActive(75);
    state.totalCount.value = 50;
    await nextTick();
    expect(state.activeIndex.value).toBe(49);
  });

  it("activeIndex resets to -1 when totalCount becomes 0", async () => {
    const state = setup("none", [{ id: "x" }], 10);
    state.setActive(5);
    state.totalCount.value = 0;
    await nextTick();
    expect(state.activeIndex.value).toBe(-1);
  });

  it("pagination mode caps active by loaded row count, not totalCount", () => {
    // Pagination is the default. Server says 200 rows total but only 5 are
    // in `results` — keyboard nav must stop at the last loaded row.
    const state = setup(
      "none",
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }],
      200,
    );
    state.setActive(150);
    expect(state.activeIndex.value).toBe(4);
  });

  it("window mode caps active by totalCount (skeleton rows allowed)", () => {
    const state = setup("none", [{ id: "a" }], 200);
    state.navMode.value = "window";
    state.setActive(150);
    expect(state.activeIndex.value).toBe(150);
  });

  it("active-row reclamps when results shrink", async () => {
    const state = setup("none", [{ id: "a" }, { id: "b" }, { id: "c" }], 100);
    state.setActive(2);
    expect(state.activeIndex.value).toBe(2);
    state.results.value = [{ id: "a" }];
    await nextTick();
    expect(state.activeIndex.value).toBe(0);
  });

  it("flipping navMode to 'window' raises the cap to totalCount", async () => {
    const state = setup("none", [{ id: "a" }, { id: "b" }], 50);
    state.setActive(40);
    expect(state.activeIndex.value).toBe(1); // pagination cap
    state.navMode.value = "window";
    await nextTick();
    state.setActive(40);
    expect(state.activeIndex.value).toBe(40); // window cap
  });
});

describe("toggleActiveSelection", () => {
  it("single mode adds the active row's PK", () => {
    const state = setup("single", [{ id: "x" }, { id: "y" }, { id: "z" }, { id: "w" }]);
    state.setActive(3);
    state.toggle();
    expect(state.selectedRows.value).toEqual(["w"]);
  });

  it("single mode toggles off when same row already selected", () => {
    const state = setup("single", [{ id: "a" }, { id: "x" }]);
    state.setActive(1);
    state.selectedRows.value = ["x"];
    state.toggle();
    expect(state.selectedRows.value).toEqual([]);
  });

  it("single mode replaces a previously-selected different row", () => {
    const state = setup("single", [{ id: "a" }, { id: "b" }]);
    state.selectedRows.value = ["a"];
    state.setActive(1);
    state.toggle();
    expect(state.selectedRows.value).toEqual(["b"]);
  });

  it("multi mode toggles membership", () => {
    const state = setup("multi", [{ id: "a" }, { id: "b" }, { id: "x" }, { id: "y" }]);
    state.selectedRows.value = ["a", "b"];
    state.setActive(2);
    state.toggle();
    expect(state.selectedRows.value).toEqual(["a", "b", "x"]);
  });

  it("resolves the active row on a page past the first (page-relative index vs absolute cache)", () => {
    // Regression: paginated tables key the window cache by ABSOLUTE row index
    // (`resultsStart + i`), but the paginated renderer sets `activeIndex`
    // PAGE-RELATIVE. On page 2 (`resultsStart = 4`) the old `getActiveRow` did
    // `dataAt(0)` → an empty cache slot → `toggleActiveSelection` silently
    // no-opped, so rows were untickable on every page but the first.
    const state = setup("multi");
    // Page 2 of an 8-row, 4-per-page dataset: the page slice lives in
    // `results`, the cache is keyed at the ABSOLUTE indices 4..7 (NOT 0..3).
    const pageRows = [{ id: "e" }, { id: "f" }, { id: "g" }, { id: "h" }];
    const cache = new Map<number, Record<string, unknown>>();
    pageRows.forEach((r, i) => cache.set(4 + i, r));
    state.windowCache.value = cache;
    state.results.value = pageRows;
    state.resultsStart.value = 4;
    state.totalCount.value = 8;

    state.setActive(0); // page-relative → first row of page 2 ("e")
    state.toggle();
    expect(state.selectedRows.value).toEqual(["e"]);

    state.setActive(2); // "g"
    state.toggle();
    expect(state.selectedRows.value).toEqual(["e", "g"]);
  });

  it("window mode resolves the active row by ABSOLUTE index via the cache", () => {
    // Mirror of the page-2 regression for the OTHER nav branch: in window mode
    // `activeIndex` is ABSOLUTE and rows live in the absolute-keyed
    // `windowCache`, so `getActiveRow` must resolve via `dataAt(idx)` — not
    // index into the page-relative `results`.
    const state = setup("multi");
    state.navMode.value = "window";
    const cache = new Map<number, Record<string, unknown>>();
    const rows = [{ id: "p100" }, { id: "p101" }, { id: "p102" }];
    rows.forEach((r, i) => cache.set(100 + i, r));
    state.windowCache.value = cache;
    state.resultsStart.value = 100;
    state.totalCount.value = 200;

    state.setActive(102); // absolute index → "p102"
    state.toggle();
    expect(state.selectedRows.value).toEqual(["p102"]);
  });
});

describe("handleNavKey — three-mode keyboard contract", () => {
  it("ArrowDown advances active by one and consumes", () => {
    const state = setup("none", [], 10);
    state.setActive(4);
    const ev = key({ key: "ArrowDown" });
    state.nav(ev);
    expect(state.activeIndex.value).toBe(5);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowDown from -1 starts at topIndex", () => {
    const state = setup("none", [], 100);
    state.topIndex.value = 20;
    state.nav(key({ key: "ArrowDown" }));
    expect(state.activeIndex.value).toBe(20);
  });

  it("Cmd+ArrowDown jumps to last row", () => {
    const state = setup("none", [], 50);
    state.setActive(5);
    const ev = key({ key: "ArrowDown", metaKey: true });
    state.nav(ev);
    expect(state.activeIndex.value).toBe(49);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("Ctrl+ArrowUp jumps to first row", () => {
    const state = setup("none", [], 50);
    state.setActive(30);
    state.nav(key({ key: "ArrowUp", ctrlKey: true }));
    expect(state.activeIndex.value).toBe(0);
  });

  it("Opt+ArrowDown is page-step", () => {
    const state = setup("none", [], 100);
    state.viewportRowCount.value = 20;
    state.setActive(0);
    state.nav(key({ key: "ArrowDown", altKey: true }));
    expect(state.activeIndex.value).toBe(19);
  });

  it("PageDown falls back to step 9 when viewportRowCount=0", () => {
    const state = setup("none", [], 100);
    state.setActive(0);
    state.nav(key({ key: "PageDown" }));
    expect(state.activeIndex.value).toBe(9);
  });

  it("PageUp from a row near the top lands on row 0, not the no-active sentinel", () => {
    const state = setup("none", [], 100);
    state.setActive(2);
    state.nav(key({ key: "PageUp" }));
    expect(state.activeIndex.value).toBe(0);
  });

  it("setActive with a large negative value clamps to row 0", () => {
    const state = setup("none", [], 100);
    state.setActive(-50);
    expect(state.activeIndex.value).toBe(0);
  });

  it("setActive(-1) keeps the no-active sentinel", () => {
    const state = setup("none", [], 100);
    state.setActive(-1);
    expect(state.activeIndex.value).toBe(-1);
  });

  it("Home / End jump to first / last", () => {
    const state = setup("none", [], 50);
    state.setActive(20);
    state.nav(key({ key: "Home" }));
    expect(state.activeIndex.value).toBe(0);
    state.nav(key({ key: "End" }));
    expect(state.activeIndex.value).toBe(49);
  });

  it("Shift modifier ignored on ArrowDown", () => {
    const state = setup("none", [], 100);
    state.setActive(5);
    state.nav(key({ key: "ArrowDown", shiftKey: true }));
    expect(state.activeIndex.value).toBe(6);
  });

  it("Space passes through in select=none", () => {
    const state = setup("none", [], 10);
    const ev = key({ key: " " });
    state.nav(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("Space toggles selection in multi", () => {
    const state = setup("multi", [{ id: "x" }, { id: "y" }]);
    state.setActive(1);
    const ev = key({ key: " " });
    state.nav(ev);
    expect(state.selectedRows.value).toEqual(["y"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("Space toggles the correct row when active is on a page past the first", () => {
    // The reported keystroke: on page 2, pressing Space must select the row
    // under the page-relative `activeIndex`, not no-op against an empty
    // absolute-cache slot. Page 2 of an 8-row, 4-per-page dataset: cache is
    // keyed at the ABSOLUTE indices 4..7, the page slice lives in `results`.
    const state = setup("multi");
    const pageRows = [{ id: "e" }, { id: "f" }, { id: "g" }, { id: "h" }];
    const cache = new Map<number, Record<string, unknown>>();
    pageRows.forEach((r, i) => cache.set(4 + i, r));
    state.windowCache.value = cache;
    state.results.value = pageRows;
    state.resultsStart.value = 4;
    state.totalCount.value = 8;

    state.setActive(0); // page-relative → first row of page 2 ("e")
    const ev = key({ key: " " });
    state.nav(ev);
    expect(state.selectedRows.value).toEqual(["e"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("handleNavKey is a no-op on empty dataset", () => {
    const state = setup("none", [], 0);
    const ev = key({ key: "ArrowDown" });
    state.nav(ev);
    expect(state.activeIndex.value).toBe(-1);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe("main-action firing rules", () => {
  it("Enter without listener falls back to toggle in selection modes", () => {
    const state = setup("multi", [{ id: "a" }, { id: "b" }]);
    state.setActive(1);
    state.nav(key({ key: "Enter" }));
    expect(state.selectedRows.value).toEqual(["b"]);
  });

  it("Enter in single mode toggles selection — does NOT fire main-action even with listener", () => {
    // Per the renderer-driven keyboard contract: any select mode (single OR
    // multi) treats Enter as a selection-toggle, mirroring Space. Main-action
    // is reserved for `select="none"`. The test asserts the contract — the
    // listener should NOT fire when mode === "single".
    const state = setup("single", [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    const { captured, dispose } = captureMainActions(state);
    state.setActive(3);
    state.nav(key({ key: "Enter" }));
    expect(captured.length).toBe(0);
    expect(state.selectedRows.value).toEqual(["d"]);
    dispose();
  });

  it("enterAction='toggle-select' overrides default fallback rule", () => {
    const state = setup("multi", [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    const { captured, dispose } = captureMainActions(state);
    state.setActive(3);
    state.nav(key({ key: "Enter" }), { enterAction: "toggle-select" });
    expect(state.selectedRows.value).toEqual(["d"]);
    expect(captured.length).toBe(0);
    dispose();
  });

  it("enterAction='passthrough' does not consume Enter", () => {
    const state = setup("multi", [{ id: "x" }]);
    const ev = key({ key: "Enter" });
    state.nav(ev, { enterAction: "passthrough" });
    expect(ev.defaultPrevented).toBe(false);
  });

  it("requestMainAction emits a fresh object each call", () => {
    const state = setup("none", [{ id: "x" }]);
    const { captured, dispose } = captureMainActions(state);
    state.setActive(0);
    state.requestMainAction(new MouseEvent("click"));
    state.requestMainAction(new MouseEvent("click"));
    expect(captured.length).toBe(2);
    expect(captured[0]).not.toBe(captured[1]);
    dispose();
  });

  it("requestMainAction is a silent no-op when no listener is registered", () => {
    const state = setup("none", [{ id: "x" }]);
    state.setActive(0);
    expect(() => state.requestMainAction(new MouseEvent("click"))).not.toThrow();
  });

  it("hasMainActionListener tracks register/dispose pairs", () => {
    const state = setup("none", [], 10);
    expect(state.hasMainActionListener.value).toBe(false);
    const d1 = state.registerMainActionListener(() => {});
    const d2 = state.registerMainActionListener(() => {});
    expect(state.hasMainActionListener.value).toBe(true);
    d1();
    expect(state.hasMainActionListener.value).toBe(true);
    d2();
    expect(state.hasMainActionListener.value).toBe(false);
  });
});

describe("Skeleton-row Enter and Space are no-ops", () => {
  // Skeleton rows only happen in window mode — pagination caps active at
  // `loadedCount`, so navigating onto an unloaded row is a window-only
  // scenario. Each test flips `navMode` before exercising clampActive.

  it("Enter on a skeleton row consumes the key but does not emit main-action", () => {
    const state = setup("multi", [{ id: "x" }]);
    state.navMode.value = "window";
    state.totalCount.value = 200;
    const { captured, dispose } = captureMainActions(state);
    state.setActive(100); // beyond loaded data
    const ev = key({ key: "Enter" });
    state.nav(ev);
    expect(captured.length).toBe(0);
    expect(ev.defaultPrevented).toBe(true);
    dispose();
  });

  it("Space on a skeleton row consumes the key but does not toggle", () => {
    const state = setup("multi", [{ id: "x" }]);
    state.navMode.value = "window";
    state.totalCount.value = 200;
    state.setActive(100);
    const ev = key({ key: " " });
    state.nav(ev);
    expect(state.selectedRows.value).toEqual([]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowDown still moves over skeleton rows", () => {
    const state = setup("none", [{ id: "x" }]);
    state.navMode.value = "window";
    state.totalCount.value = 200;
    state.setActive(100);
    state.nav(key({ key: "ArrowDown" }));
    expect(state.activeIndex.value).toBe(101);
  });
});

describe("navBridge", () => {
  it("Space NEVER consumed via bridge (typing)", () => {
    const state = setup("multi", [{ id: "a" }]);
    const bridge = bridgeFor(state);
    const ev = key({ key: " " });
    bridge.onKeydown(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("printable character keys NEVER consumed via bridge", () => {
    const state = setup("none", [{ id: "x" }]);
    const bridge = bridgeFor(state);
    const ev = key({ key: "a" });
    bridge.onKeydown(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("unmodified Home / End NEVER consumed via bridge", () => {
    const state = setup("none", [], 50);
    const bridge = bridgeFor(state);
    const evHome = key({ key: "Home" });
    bridge.onKeydown(evHome);
    expect(evHome.defaultPrevented).toBe(false);
    expect(state.activeIndex.value).toBe(-1);

    const evEnd = key({ key: "End" });
    bridge.onKeydown(evEnd);
    expect(evEnd.defaultPrevented).toBe(false);
  });

  it("Cmd+ArrowDown IS consumed via bridge (jump to last)", () => {
    const state = setup("none", [], 50);
    const bridge = bridgeFor(state);
    const ev = key({ key: "ArrowDown", metaKey: true });
    bridge.onKeydown(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(state.activeIndex.value).toBe(49);
  });

  it("ArrowDown IS consumed via bridge", () => {
    const state = setup("none", [], 50);
    state.setActive(5);
    const bridge = bridgeFor(state);
    const ev = key({ key: "ArrowDown" });
    bridge.onKeydown(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(state.activeIndex.value).toBe(6);
  });
});
