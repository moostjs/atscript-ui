import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { mountTableState, rows } from "./helpers";

function mountCustomConsumer() {
  // queryOnMount=true to exercise the auto-bootstrap watcher.
  return mountTableState({ data: rows(0, 50), count: 1000, queryOnMount: true });
}

const FILTER_DEBOUNCE_MS = 500;

describe("Custom consumer (no built-in table) — unified watchers fire", () => {
  it("filter mutation triggers a fetch after debounce", async () => {
    vi.useFakeTimers();
    const { state, pagesFn } = mountCustomConsumer();
    // Auto-bootstrap fires immediately on mount; advance fake timers for that.
    vi.useRealTimers();
    await flushPromises();
    pagesFn.mockClear();

    vi.useFakeTimers();
    state.filters.value = { name: [{ type: "eq", value: ["x"] }] };
    await nextTick();
    expect(state.mustRefresh.value).toBe(true);
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
    vi.useRealTimers();
    await flushPromises();
    expect(pagesFn).toHaveBeenCalled();
  });

  it("searchTerm mutation triggers a fetch after debounce", async () => {
    const { state, pagesFn } = mountCustomConsumer();
    await flushPromises();
    pagesFn.mockClear();

    vi.useFakeTimers();
    state.searchTerm.value = "alpha";
    await nextTick();
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
    vi.useRealTimers();
    await flushPromises();
    expect(pagesFn).toHaveBeenCalled();
  });
});
