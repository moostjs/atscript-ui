import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mountTableState, mockColumn } from "./helpers";

describe("URL query bridge — state↔URL integration", () => {
  it("does not call onUrlQueryChange when callback is not wired (zero overhead)", async () => {
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("status"), mockColumn("name")],
      queryOnMount: true,
    });
    await nextTick();
    await nextTick();
    pagesFn.mockClear();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    // No URL emit happened (we'd see no spy) — and the existing query path still works
    expect(pagesFn).toHaveBeenCalled();
  });

  it("emits URL on filter change with the encoded Uniquery shape", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await nextTick();

    expect(onUrlQueryChange).toHaveBeenCalledWith("status=active");
  });

  it("emits URL on sorter change", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("createdAt")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.sorters.value = [{ field: "createdAt", direction: "desc" }];
    await nextTick();

    expect(onUrlQueryChange).toHaveBeenCalledWith("$sort=-createdAt");
  });

  it("emits URL on pagination change", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
      limit: 50,
    });
    await nextTick();

    state.pagination.value = { page: 3, itemsPerPage: 50 };
    await nextTick();

    expect(onUrlQueryChange).toHaveBeenCalledWith("$skip=100");
  });

  it("emits URL on searchTerm change (after debounce)", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.searchTerm.value = "foo";
    await nextTick();

    // Watcher fires synchronously on the next tick — emit happens immediately,
    // it's only the actual fetch that's debounced.
    expect(onUrlQueryChange).toHaveBeenCalledWith("$search=foo");
  });

  it("does NOT re-emit on echo (loop guard via lastEmittedUrl)", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await nextTick();
    expect(onUrlQueryChange).toHaveBeenCalledTimes(1);

    // Identical mutation — same encoded URL — must not re-fire.
    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await nextTick();
    expect(onUrlQueryChange).toHaveBeenCalledTimes(1);
  });

  it("hydrates state from a URL via state.applyUrlQuery", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status"), mockColumn("createdAt")],
      queryOnMount: false,
    });
    await nextTick();

    state.applyUrlQuery("status=active&$sort=-createdAt&$search=foo");
    await nextTick();

    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
    });
    expect(state.sorters.value).toEqual([{ field: "createdAt", direction: "desc" }]);
    expect(state.searchTerm.value).toBe("foo");
  });

  it("hydrating populates filterFields (union, not replace)", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status"), mockColumn("name")],
      queryOnMount: false,
    });
    state.filterFields.value = ["name"];
    await nextTick();

    state.applyUrlQuery("status=active");
    await nextTick();

    expect(state.filterFields.value).toContain("name");
    expect(state.filterFields.value).toContain("status");
  });

  it("hydrating with $skip preserves the URL's page (does not resetPagination)", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      limit: 50,
    });
    await nextTick();

    state.applyUrlQuery("status=active&$skip=100");
    await nextTick();
    await nextTick();

    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
    });
    expect(state.pagination.value.page).toBe(3);
  });

  it("does NOT emit URL during hydration (lastEmittedUrl primed)", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.applyUrlQuery("status=active");
    await nextTick();
    await nextTick();

    // Hydration writes state but must not re-emit the same URL we just received.
    expect(onUrlQueryChange).not.toHaveBeenCalled();
  });

  it("emits URL after hydrate when state diverges from the hydrated baseline", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.applyUrlQuery("status=active");
    await nextTick();
    await nextTick();
    expect(onUrlQueryChange).not.toHaveBeenCalled();

    // User toggles filter off — URL diverges, must emit.
    state.setFieldFilter("status", []);
    await nextTick();

    expect(onUrlQueryChange).toHaveBeenCalledWith("");
  });

  it("ignores cross-encoder echo (URLSearchParams %24 vs buildUrl $) — no spurious refetch", async () => {
    // Reproduces the production bug where typing 'bob' in search fired 4
    // queries instead of one debounced fetch. The outbound emit serializes
    // via `buildUrl` (`$search=b`) but `useTableUrlQuery`'s vue-router getter
    // re-encodes via URLSearchParams (`%24search=b`). Without an encoder-
    // tolerant echo check, applyUrlQuery would treat its own write as a
    // foreign URL change and re-hydrate + scheduleQuery on every keystroke.
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
    });
    await nextTick();

    state.searchTerm.value = "bob";
    await nextTick();
    expect(onUrlQueryChange).toHaveBeenLastCalledWith("$search=bob");
    pagesFn.mockClear();

    // Simulate the percent-encoded round-trip vue-router would deliver.
    state.applyUrlQuery("%24search=bob");
    await nextTick();
    await nextTick();

    // No re-hydration write storm, no immediate fetch — the debounced
    // filter watcher is the single source of refetch.
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("hydrating drops filter conditions on unknown fields", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
    });
    await nextTick();

    state.applyUrlQuery("status=active&bogus=42");
    await nextTick();

    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
    });
    expect(state.filters.value.bogus).toBeUndefined();
  });
});

describe("URL query bridge — first-query gate via urlQueryReady", () => {
  it("skips initial query while urlQueryReady is false", async () => {
    const urlQueryReady = ref(false);
    const { pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: true,
      urlQueryReady,
    });

    await nextTick();
    await nextTick();
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("fires initial query when urlQueryReady flips to true", async () => {
    const urlQueryReady = ref(false);
    const { pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: true,
      urlQueryReady,
    });
    await nextTick();
    expect(pagesFn).not.toHaveBeenCalled();

    urlQueryReady.value = true;
    await nextTick();
    await nextTick();

    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("composes hydrate + initial query into a single fetch", async () => {
    const urlQueryReady = ref(false);
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: true,
      urlQueryReady,
      onUrlQueryChange,
    });
    await nextTick();

    // Caller does this in onMounted: hydrate then open the gate.
    state.applyUrlQuery("status=active");
    urlQueryReady.value = true;
    await nextTick();
    await nextTick();

    // Exactly one fetch — no "defaults then URL" double-fetch.
    expect(pagesFn).toHaveBeenCalledTimes(1);
    // The fetch body carries the hydrated filter, not defaults.
    const [query] = pagesFn.mock.calls[0];
    expect(query).toMatchObject({ filter: { status: "active" } });
  });
});

describe("urlQuerySync — emit gating", () => {
  it("sorters: false omits $sort from emitted URL", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("createdAt")],
      queryOnMount: false,
      onUrlQueryChange,
      urlQuerySync: { sorters: false },
    });
    await nextTick();

    state.sorters.value = [{ field: "createdAt", direction: "desc" }];
    await nextTick();

    // Sorter mutation produced no URL change → no emit (URL stayed "").
    expect(onUrlQueryChange).not.toHaveBeenCalled();
  });

  it("pagination: false omits $skip from emitted URL but still triggers refetch", async () => {
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: true,
      onUrlQueryChange,
      limit: 50,
      urlQuerySync: { pagination: false },
    });
    await nextTick();
    await nextTick();
    pagesFn.mockClear();

    state.pagination.value = { page: 3, itemsPerPage: 50 };
    await nextTick();
    await nextTick();

    // Pagination is gated OUT of the URL — no emit, but the refetch still fires
    // (gating affects URL only, not query scheduling).
    expect(onUrlQueryChange).not.toHaveBeenCalled();
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("filters: ['status'] only emits status entries to URL", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("status"), mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
      urlQuerySync: { filters: ["status"] },
    });
    await nextTick();

    state.setFieldFilter("name", [{ type: "eq", value: ["foo"] }]);
    await nextTick();
    expect(onUrlQueryChange).not.toHaveBeenCalled();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await nextTick();
    expect(onUrlQueryChange).toHaveBeenCalledWith("status=active");
  });

  it("search: false omits $search from emitted URL", async () => {
    const onUrlQueryChange = vi.fn();
    const { state } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
      urlQuerySync: { search: false },
    });
    await nextTick();

    state.searchTerm.value = "foo";
    await nextTick();

    expect(onUrlQueryChange).not.toHaveBeenCalled();
  });
});

describe("urlQuerySync — hydrate gating", () => {
  it("filters: false leaves state.filters untouched on applyUrlQuery", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      urlQuerySync: { filters: false },
    });
    await nextTick();

    state.applyUrlQuery("status=active");
    await nextTick();
    await nextTick();

    expect(state.filters.value).toEqual({});
  });

  it("sorters: false leaves state.sorters untouched on applyUrlQuery", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("createdAt")],
      queryOnMount: false,
      urlQuerySync: { sorters: false },
    });
    await nextTick();

    state.applyUrlQuery("$sort=-createdAt");
    await nextTick();
    await nextTick();

    expect(state.sorters.value).toEqual([]);
  });

  it("search: false leaves state.searchTerm at empty on applyUrlQuery", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("name")],
      queryOnMount: false,
      urlQuerySync: { search: false },
    });
    await nextTick();

    state.applyUrlQuery("$search=foo");
    await nextTick();
    await nextTick();

    expect(state.searchTerm.value).toBe("");
  });

  it("pagination: false leaves state.pagination at default on applyUrlQuery", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      limit: 50,
      urlQuerySync: { pagination: false },
    });
    await nextTick();

    state.applyUrlQuery("status=active&$skip=100");
    await nextTick();
    await nextTick();

    expect(state.pagination.value.page).toBe(1);
    // Filter still hydrated — only pagination was gated.
    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
    });
  });

  it("filters: ['status'] preserves non-allowlist filter state on hydrate", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("status"), mockColumn("name")],
      queryOnMount: false,
      urlQuerySync: { filters: ["status"] },
    });
    await nextTick();

    // Consumer programmatically set a non-allowlist filter.
    state.setFieldFilter("name", [{ type: "contains", value: ["foo"] }]);
    await nextTick();

    state.applyUrlQuery("status=active");
    await nextTick();
    await nextTick();

    // status replaced from URL; name preserved (private to consumer).
    expect(state.filters.value.status).toEqual([{ type: "eq", value: ["active"] }]);
    expect(state.filters.value.name).toEqual([{ type: "contains", value: ["foo"] }]);
  });

  it("sorters: ['createdAt'] replaces allowlist sorter; preserves non-allowlist", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("createdAt"), mockColumn("name")],
      queryOnMount: false,
      urlQuerySync: { sorters: ["createdAt"] },
    });
    await nextTick();

    state.sorters.value = [
      { field: "name", direction: "asc" },
      { field: "createdAt", direction: "desc" },
    ];
    await nextTick();

    state.applyUrlQuery("$sort=createdAt");
    await nextTick();
    await nextTick();

    expect(state.sorters.value).toEqual([
      { field: "name", direction: "asc" },
      { field: "createdAt", direction: "asc" },
    ]);
  });
});

describe("urlQuerySync — echo guard symmetry (no spurious refetch)", () => {
  // The encoder + decoder must use the same `sync` config so the canonical
  // re-serialization in `applyUrlQuery` matches `lastEmittedUrl` and the echo
  // is dropped. Mirrors the existing cross-encoder echo test pattern.

  it("sorters: false — feeding back emitted URL doesn't refetch", async () => {
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("createdAt"), mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
      urlQuerySync: { sorters: false },
    });
    await nextTick();

    state.sorters.value = [{ field: "createdAt", direction: "desc" }];
    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await nextTick();
    expect(onUrlQueryChange).toHaveBeenLastCalledWith("status=active");
    pagesFn.mockClear();

    // Feed the emitted URL back (simulating a vue-router echo).
    state.applyUrlQuery("status=active");
    await nextTick();
    await nextTick();

    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("filters: ['status'] — feeding back emitted URL doesn't refetch", async () => {
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("status"), mockColumn("name")],
      queryOnMount: false,
      onUrlQueryChange,
      urlQuerySync: { filters: ["status"] },
    });
    await nextTick();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    state.setFieldFilter("name", [{ type: "contains", value: ["bar"] }]);
    await nextTick();

    const emitted = onUrlQueryChange.mock.calls.at(-1)?.[0];
    expect(emitted).toBe("status=active");
    pagesFn.mockClear();

    state.applyUrlQuery(emitted as string);
    await nextTick();
    await nextTick();

    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("pagination: false — feeding back emitted URL doesn't refetch", async () => {
    const onUrlQueryChange = vi.fn();
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("status")],
      queryOnMount: false,
      onUrlQueryChange,
      limit: 50,
      urlQuerySync: { pagination: false },
    });
    await nextTick();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    state.pagination.value = { page: 3, itemsPerPage: 50 };
    await nextTick();
    await nextTick();

    const emitted = onUrlQueryChange.mock.calls.at(-1)?.[0];
    expect(emitted).toBe("status=active");
    pagesFn.mockClear();

    state.applyUrlQuery(emitted as string);
    await nextTick();
    await nextTick();

    expect(pagesFn).not.toHaveBeenCalled();
  });
});
