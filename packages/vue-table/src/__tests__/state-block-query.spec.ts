import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockColumn, mountTableState } from "./helpers";

// Regression: `blockQuery` used to be read once at setup, so a table mounted
// while blocked stayed empty forever — the bootstrap watcher marked the query
// as detected and the blocked `scheduleQuery` never retried.
describe("blockQuery reactivity", () => {
  function setup(blocked: { value: boolean }) {
    return mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: true,
      blockQuery: () => blocked.value,
    });
  }

  it("does not fetch while blocked, fetches once on unblock, and stays quiet when re-blocked", async () => {
    const blocked = ref(true);
    const { state, pagesFn } = setup(blocked);

    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
    expect(state.results.value).toEqual([]);

    blocked.value = false;
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.results.value.length).toBe(2);

    const callsAfterUnblock = pagesFn.mock.calls.length;
    blocked.value = true;
    await flushPromises();
    state.query();
    await flushPromises();
    expect(pagesFn.mock.calls.length).toBe(callsAfterUnblock);
  });

  it("replays state changed while blocked on the next unblock", async () => {
    const blocked = ref(false);
    const { state, pagesFn } = setup(blocked);

    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);

    blocked.value = true;
    await flushPromises();
    state.searchTerm.value = "abc";
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);

    blocked.value = false;
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(2);
  });

  it("still accepts a plain boolean", async () => {
    const { pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: true,
      blockQuery: true,
    });
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
  });
});
