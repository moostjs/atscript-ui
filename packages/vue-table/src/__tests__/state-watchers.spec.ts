import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import {
  createMockClient,
  createMockMeta,
  mockColumn,
  mockTableDef,
  mountTableStateDeferred,
  rows,
} from "./helpers";

function setup(opts?: {
  queryOnMount?: boolean;
  initialFilters?: Record<string, never>;
  blockSize?: number;
}) {
  return mountTableStateDeferred({
    data: rows(0, 50),
    count: 1000,
    queryOnMount: opts?.queryOnMount,
    blockSize: opts?.blockSize,
  });
}

const FILTER_DEBOUNCE_MS = 500;

describe("createTableState watchers", () => {
  describe("auto-bootstrap", () => {
    it("fires query exactly once when tableDef + columnNames non-empty AND queryOnMount !== false", async () => {
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      expect(pagesFn).toHaveBeenCalledOnce();
      expect(state.results.value.length).toBe(50);
    });

    it("queryOnMount=false suppresses auto-bootstrap", async () => {
      const { init, pagesFn } = setup({ queryOnMount: false });
      init();
      await flushPromises();
      expect(pagesFn).not.toHaveBeenCalled();
    });

    it("does NOT re-fire on subsequent metadata reloads when results are populated", async () => {
      const { init, pagesFn } = setup();
      init();
      await flushPromises();
      expect(pagesFn).toHaveBeenCalledOnce();
      // Re-init with same def — results.length > 0 guard prevents re-bootstrap.
      init();
      await flushPromises();
      expect(pagesFn).toHaveBeenCalledOnce();
    });
  });

  describe("queryDetected gate", () => {
    it("pre-mount filter mutation does NOT fire a fetch", async () => {
      const { state, init, pagesFn } = setup({ queryOnMount: false });
      // Pre-mutate filters BEFORE metadata loads.
      state.filters.value = { name: [{ type: "eq", value: ["x"] }] };
      vi.useFakeTimers();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 100);
      vi.useRealTimers();
      await flushPromises();
      expect(pagesFn).not.toHaveBeenCalled();

      // Switching queryOnMount on metadata-load: the spec says the FIRST
      // auto-bootstrap fetch uses pre-populated filters. Here we verify the
      // gate suppresses the fetch.
      void init;
    });

    it("immediate columnNames watcher does NOT fire query during init seeding", async () => {
      const { init, pagesFn } = setup({ queryOnMount: false });
      init();
      await flushPromises();
      // queryOnMount=false → no auto-bootstrap, AND the immediate columnNames
      // watcher firing during init is gated by queryDetected (still false).
      expect(pagesFn).not.toHaveBeenCalled();
    });
  });

  describe("filter / search watcher", () => {
    it("sets mustRefresh synchronously, fires query after debounce", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      pagesFn.mockClear();

      state.filters.value = { name: [{ type: "eq", value: ["x"] }] };
      // The watcher fires AFTER the next tick (filter watcher is non-immediate).
      await nextTick();
      expect(state.mustRefresh.value).toBe(true);
      expect(pagesFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
      vi.useRealTimers();
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
    });

    it("filter change in pure-pagination resets pagination.page to 1", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      pagesFn.mockClear();

      state.pagination.value = { page: 5, itemsPerPage: 50 };
      await flushPromises();
      // pagination jump fires a query.
      expect(pagesFn.mock.calls.length).toBeGreaterThan(0);
      pagesFn.mockClear();

      state.filters.value = { name: [{ type: "eq", value: ["x"] }] };
      await nextTick();
      // Synchronously reset to page 1.
      expect(state.pagination.value.page).toBe(1);

      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
      vi.useRealTimers();
      await flushPromises();
      // Exactly one query fires (the debounced one), NOT a separate pagination-watcher fire.
      expect(pagesFn.mock.calls.length).toBe(1);
    });

    it("filter change in pure-window mode (page already 1) is a no-op for pagination", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      pagesFn.mockClear();

      state.viewportRowCount.value = 30;
      state.filters.value = { name: [{ type: "eq", value: ["x"] }] };
      await nextTick();
      expect(state.pagination.value.page).toBe(1);

      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
      vi.useRealTimers();
      await flushPromises();
      expect(pagesFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("sorter watcher", () => {
    it("immediate fire (no debounce)", async () => {
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      pagesFn.mockClear();

      state.sorters.value = [{ field: "name", direction: "asc" }];
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
    });

    it("does NOT reset pagination", async () => {
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      state.pagination.value = { page: 5, itemsPerPage: 50 };
      await flushPromises();
      pagesFn.mockClear();

      state.sorters.value = [{ field: "name", direction: "asc" }];
      await flushPromises();
      expect(state.pagination.value.page).toBe(5);
    });
  });

  describe("ignoreSortersWhenSearched", () => {
    function setupRel(opts?: {
      ignoreSortersWhenSearched?: boolean;
      forceSorters?: { field: string; direction: "asc" | "desc" }[];
    }) {
      const mounted = mountTableStateDeferred({
        data: rows(0, 50),
        count: 1000,
        ignoreSortersWhenSearched: opts?.ignoreSortersWhenSearched,
        forceSorters: opts?.forceSorters,
      });
      return mounted;
    }

    /** Last dispatched Uniquery. */
    function lastQuery(pagesFn: ReturnType<typeof vi.fn>) {
      return pagesFn.mock.calls[pagesFn.mock.calls.length - 1]?.[0];
    }

    async function typeSearch(state: ReactiveTableState, term: string) {
      state.searchTerm.value = term;
      await nextTick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS + 50);
      vi.useRealTimers();
      await flushPromises();
      vi.useFakeTimers();
    }

    it("suppresses user sorters in the query while flag + search are active", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      state.sorters.value = [{ field: "name", direction: "desc" }];
      init();
      await flushPromises();
      // Browse mode (no search): sorters emitted.
      expect(lastQuery(pagesFn).controls.$sort).toEqual({ name: -1 });

      await typeSearch(state, "foo");
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBe("foo");
      expect(q.controls.$sort).toBeUndefined();
      // Suppression is query-time only — state.sorters is untouched.
      expect(state.sorters.value).toEqual([{ field: "name", direction: "desc" }]);
      vi.useRealTimers();
    });

    it("still emits forceSorters while suppressing user sorters", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({
        ignoreSortersWhenSearched: true,
        forceSorters: [{ field: "id", direction: "asc" }],
      });
      state.sorters.value = [{ field: "name", direction: "desc" }];
      init();
      await flushPromises();

      await typeSearch(state, "foo");
      expect(lastQuery(pagesFn).controls.$sort).toEqual({ id: 1 });
      vi.useRealTimers();
    });

    it("a sorter write during an active search flips the flag; query then includes $sort", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      expect(state.ignoreSortersWhenSearched.value).toBe(true);

      vi.useRealTimers();
      state.sorters.value = [{ field: "name", direction: "asc" }];
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(false);
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBe("foo");
      expect(q.controls.$sort).toEqual({ name: 1 });
    });

    it("clearing the search resumes emitting sorters", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      state.sorters.value = [{ field: "name", direction: "desc" }];
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      expect(lastQuery(pagesFn).controls.$sort).toBeUndefined();

      await typeSearch(state, "");
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBeUndefined();
      expect(q.controls.$sort).toEqual({ name: -1 });
      vi.useRealTimers();
    });

    it("a NEW search session resets the flag to the configured default", async () => {
      vi.useFakeTimers();
      const { state, init } = setupRel({ ignoreSortersWhenSearched: true });
      init();
      await flushPromises();
      await typeSearch(state, "foo");

      // User sorts mid-search → flag flips off for the session.
      vi.useRealTimers();
      state.sorters.value = [{ field: "name", direction: "asc" }];
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(false);
      vi.useFakeTimers();

      // End the session, start a new one → flag back to default (true).
      await typeSearch(state, "");
      await typeSearch(state, "bar");
      expect(state.ignoreSortersWhenSearched.value).toBe(true);
      vi.useRealTimers();
    });

    it("default false → behavior unchanged ($sort rides along with $search)", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel();
      state.sorters.value = [{ field: "name", direction: "desc" }];
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBe("foo");
      expect(q.controls.$sort).toEqual({ name: -1 });
      vi.useRealTimers();
    });

    it("URL sorter-merge arriving mid-search flips the flag off (rule 3 via applyUrlQuery)", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      expect(state.ignoreSortersWhenSearched.value).toBe(true);

      // URL carries a sorter while the same search stays active — a sorter
      // write during an active session is explicit intent, flag flips off.
      vi.useRealTimers();
      state.applyUrlQuery("$sort=-name&$search=foo");
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(false);
      expect(state.sorters.value).toEqual([{ field: "name", direction: "desc" }]);
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBe("foo");
      expect(q.controls.$sort).toEqual({ name: -1 });
    });

    it("URL-carried explicit $relevance wins over the sorter-merge flip rule", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      expect(state.ignoreSortersWhenSearched.value).toBe(true);

      // Same mid-search sorter merge, but the URL says $relevance=1 — it is
      // applied AFTER the merge, so the sharer's suppression is reproduced.
      vi.useRealTimers();
      state.applyUrlQuery("$sort=-name&$search=foo&$relevance=1");
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(true);
      expect(state.sorters.value).toEqual([{ field: "name", direction: "desc" }]);
      const q = lastQuery(pagesFn);
      expect(q.controls.$search).toBe("foo");
      expect(q.controls.$sort).toBeUndefined();
    });

    it("URL-applied $relevance never strands suppression — later external toggles still re-query", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      state.sorters.value = [{ field: "name", direction: "asc" }];
      init();
      await flushPromises();
      await typeSearch(state, "foo");

      // Sorter write mid-search flips the flag off; clearing keeps it off.
      vi.useRealTimers();
      state.sorters.value = [{ field: "name", direction: "desc" }];
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(false);
      vi.useFakeTimers();
      await typeSearch(state, "");

      // URL starts a new search with explicit $relevance=0: internally the
      // flag resets to the default (true) then applies the URL's false —
      // a net no-op the flag watcher never observes.
      vi.useRealTimers();
      state.applyUrlQuery("$search=bar&$relevance=0");
      await flushPromises();
      expect(state.ignoreSortersWhenSearched.value).toBe(false);
      expect(state.searchTerm.value).toBe("bar");

      // External v-model toggles after that must still re-query.
      pagesFn.mockClear();
      state.ignoreSortersWhenSearched.value = true;
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
      expect(lastQuery(pagesFn).controls.$sort).toBeUndefined();

      pagesFn.mockClear();
      state.ignoreSortersWhenSearched.value = false;
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
      expect(lastQuery(pagesFn).controls.$sort).toEqual({ name: -1 });
    });

    it("external flag toggle mid-search re-queries (model-driven)", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setupRel({ ignoreSortersWhenSearched: true });
      state.sorters.value = [{ field: "name", direction: "desc" }];
      init();
      await flushPromises();
      await typeSearch(state, "foo");
      pagesFn.mockClear();

      vi.useRealTimers();
      state.ignoreSortersWhenSearched.value = false;
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
      expect(lastQuery(pagesFn).controls.$sort).toEqual({ name: -1 });
    });
  });

  describe("columnNames watcher", () => {
    it("reorder (same set) is a no-op — does not fire query", async () => {
      const mock = createMockClient({
        meta: createMockMeta(["a", "b"]),
        data: rows(0, 50),
        count: 1000,
      });
      let state2!: ReactiveTableState;
      mount(
        defineComponent({
          setup() {
            const { state: s, internals } = createTableState({
              client: mock.client,
              query: { queryOnMount: true },
            });
            state2 = s;
            internals.init(mockTableDef([mockColumn("a"), mockColumn("b")]));
            return () => h("div");
          },
        }),
      );
      await flushPromises();
      mock.pagesFn.mockClear();
      // Reorder — same set, different order.
      state2.columnNames.value = ["b", "a"];
      await flushPromises();
      expect(mock.pagesFn).not.toHaveBeenCalled();
    });

    it("column add fires query", async () => {
      // Set up state with two cols, then change to three.
      const mock = createMockClient({
        meta: createMockMeta(["a", "b", "c"]),
        data: rows(0, 50),
        count: 1000,
      });
      let state2!: ReactiveTableState;
      mount(
        defineComponent({
          setup() {
            const { state: s, internals } = createTableState({
              client: mock.client,
              query: { queryOnMount: true },
            });
            state2 = s;
            // External columnNames seeding to start with "a","b" only.
            s.columnNames.value = ["a", "b"];
            internals.init(mockTableDef([mockColumn("a"), mockColumn("b"), mockColumn("c")]));
            return () => h("div");
          },
        }),
      );
      await flushPromises();
      mock.pagesFn.mockClear();
      state2.columnNames.value = ["a", "b", "c"];
      await flushPromises();
      expect(mock.pagesFn).toHaveBeenCalled();
    });
  });

  describe("pagination watcher", () => {
    it("pagination jump fires query and re-anchors resultsStart", async () => {
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      pagesFn.mockClear();

      state.pagination.value = { page: 5, itemsPerPage: 50 };
      await flushPromises();
      expect(pagesFn).toHaveBeenCalled();
      expect(state.resultsStart.value).toBe(200);
    });
  });

  describe("fetchSize gate", () => {
    it("pure-pagination consumer (viewportRowCount=0) dispatches with size=itemsPerPage", async () => {
      const { state, init, pagesFn } = setup();
      init();
      await flushPromises();
      const lastCall = pagesFn.mock.calls[pagesFn.mock.calls.length - 1];
      // Args: (query, page, size). With no `limit:` override, the framework
      // default `DEFAULT_ITEMS_PER_PAGE = 25` flows through.
      expect(lastCall?.[2]).toBe(25);
      void state;
    });

    it("pure-window consumer dispatches with size === blockSize", async () => {
      vi.useFakeTimers();
      const { state, init, pagesFn } = setup({ blockSize: 100 });
      // Set viewportRowCount BEFORE init so the auto-bootstrap query sees
      // window mode active and picks `blockSize` instead of `itemsPerPage`.
      state.viewportRowCount.value = 30;
      init();
      vi.useRealTimers();
      await flushPromises();
      const firstCall = pagesFn.mock.calls[0];
      expect(firstCall?.[2]).toBe(100);
    });
  });

  describe("viewport prefetch", () => {
    // Returns `size` rows starting at (page-1)*100 — simulates a real server.
    function setupRealistic(opts?: { blockSize?: number }) {
      const pagesFn = vi.fn().mockImplementation((_q, page: number, size: number) =>
        Promise.resolve({
          data: rows((page - 1) * 100, size),
          count: 1_000_000,
          page,
          itemsPerPage: size,
          pages: Math.ceil(1_000_000 / size),
        }),
      );
      const client = {
        meta: () => Promise.resolve(createMockMeta(["name"])),
        pages: pagesFn,
      } as never;
      let state!: ReactiveTableState;
      let initRef!: () => void;
      mount(
        defineComponent({
          setup() {
            const { state: s, internals } = createTableState({
              client,
              window: { blockSize: opts?.blockSize },
            });
            state = s;
            initRef = () => internals.init(mockTableDef([mockColumn("name")]));
            return () => h("div");
          },
        }),
      );
      return { state, init: initRef, pagesFn };
    }

    it("scroll within fully-cached viewport with healthy buffers does NOT dispatch", async () => {
      const { state, init, pagesFn } = setupRealistic({ blockSize: 100 });
      state.viewportRowCount.value = 30;
      init();
      await flushPromises();
      // Auto-bootstrap loaded block 1 (rows 0..99 — full 100 rows).
      pagesFn.mockClear();
      state.topIndex.value = 10;
      await flushPromises();
      // viewport [10, 40); fwdBuffer = 60 (> 25) → no prefetch.
      expect(pagesFn).not.toHaveBeenCalled();
    });

    it("scroll past forward-buffer threshold DOES dispatch one block forward", async () => {
      const { state, init, pagesFn } = setupRealistic({ blockSize: 100 });
      state.viewportRowCount.value = 30;
      init();
      await flushPromises();
      pagesFn.mockClear();
      // viewport [50, 80); fwdBuffer = 20 (< 25) → forward prefetch for page 2 (rows 100..199).
      state.topIndex.value = 50;
      await flushPromises();
      expect(pagesFn).toHaveBeenCalledTimes(1);
      const call = pagesFn.mock.calls[0];
      expect(call?.[1]).toBe(2);
      expect(call?.[2]).toBe(100);
    });

    it("jumping to far-from-cache topIndex debounces, then dispatches parallel block requests", async () => {
      const { state, init, pagesFn } = setupRealistic({ blockSize: 100 });
      state.viewportRowCount.value = 30;
      init();
      await flushPromises();
      pagesFn.mockClear();
      vi.useFakeTimers();

      // Jump deep into the dataset — viewport not cached anywhere near.
      state.topIndex.value = 5000;
      await Promise.resolve();
      // Before debounce window elapses, no fetch.
      vi.advanceTimersByTime(100);
      expect(pagesFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      vi.useRealTimers();
      await flushPromises();
      // Jump plan: skip=4950, limit=130 → page-aligned blocks 50,51 (rows 4900..5099).
      // Two PARALLEL single-block requests at size=blockSize.
      expect(pagesFn).toHaveBeenCalledTimes(2);
      const sizes = pagesFn.mock.calls.map((c) => c[2]);
      expect(sizes).toEqual([100, 100]);
      const dispatched = pagesFn.mock.calls.map((c) => c[1]).toSorted((a, b) => a - b);
      expect(dispatched).toEqual([50, 51]);
    });
  });
});
