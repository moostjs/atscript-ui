import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountTableState, rows } from "./helpers";

/**
 * Mounts <AsTableRoot>-equivalent (createTableState + init) WITHOUT any
 * built-in table child. Asserts every universal trigger / accessor is
 * callable and behaves identically to when a built-in is mounted.
 */
function mountCustomConsumer() {
  return mountTableState({ data: rows(0, 50), count: 1000 });
}

describe("Custom consumer (no built-in table) — universal toolset", () => {
  it("state.query() populates results", async () => {
    const { state } = mountCustomConsumer();
    state.query();
    await flushPromises();
    expect(state.results.value.length).toBe(50);
  });

  it("state.loadRange() populates windowCache", async () => {
    const { state } = mountCustomConsumer();
    await state.loadRange(0, 50);
    // Mock returns 50 rows; loadRange writes them into the cache at indices [0..49].
    expect(state.windowCache.value.size).toBe(50);
  });

  it("state.invalidate() wipes both", async () => {
    const { state } = mountCustomConsumer();
    state.query();
    await flushPromises();
    expect(state.results.value.length).toBe(50);
    expect(state.windowCache.value.size).toBe(50);
    state.invalidate();
    expect(state.results.value).toEqual([]);
    expect(state.windowCache.value.size).toBe(0);
  });

  it("state.dataAt / loadingAt / errorAt return sane values", async () => {
    const { state } = mountCustomConsumer();
    state.query();
    await flushPromises();
    expect(state.dataAt(0)).toEqual({ id: 0 });
    expect(state.dataAt(999)).toBeUndefined();
    expect(state.loadingAt(0)).toBe(false);
    expect(state.errorAt(0)).toBeNull();
  });
});
