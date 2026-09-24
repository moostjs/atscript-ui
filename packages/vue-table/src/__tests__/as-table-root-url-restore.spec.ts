// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client } from "@atscript/db-client";
import AsTableRoot from "../components/as-table-root.vue";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta } from "./helpers";

afterEach(() => {
  clearTableCache();
  document.body.innerHTML = "";
});

/**
 * Mount a server-mode root with `v-model:url-query` and hand back a setter that
 * drives the bound query the way the router does on back/forward navigation.
 */
function mountWithUrlQuery(initialQuery: string) {
  const urlQuery = ref(initialQuery);
  const { client, pagesFn } = createMockClient({
    meta: createMockMeta(["id", "status", "customer"]),
    data: [],
  });
  let state!: ReactiveTableState;
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            AsTableRoot as unknown as Parameters<typeof h>[0],
            {
              url: "/orders",
              clientFactory: () => client as Client,
              urlQuery: urlQuery.value,
              "onUpdate:urlQuery": (v: string) => {
                urlQuery.value = v;
              },
            },
            { default: () => [] },
          );
      },
    }),
  );
  state = (wrapper.findComponent(AsTableRoot).vm as unknown as { state: ReactiveTableState }).state;
  return { wrapper, state, urlQuery, pagesFn };
}

describe("<AsTableRoot> URL restoration — every URL is re-applied", () => {
  it("navigating to a URL without a filter clears it (Back undoes the filter)", async () => {
    const { state, urlQuery } = mountWithUrlQuery("status=active");
    await flushPromises();
    await flushPromises();

    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });

    // The user adds a second filter; the bridge writes it to the URL.
    state.setFieldFilter("customer", [{ type: "eq", value: ["5"] }]);
    await flushPromises();
    expect(urlQuery.value).toContain("customer=");

    // Back: the router restores the previous entry. `customer` is gone from the
    // URL, so it must be gone from state — the whole point of the fix.
    urlQuery.value = "status=active";
    await flushPromises();

    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });
  });

  it("navigating to an empty URL clears the table instead of being ignored", async () => {
    const { state, urlQuery } = mountWithUrlQuery("status=active");
    await flushPromises();
    await flushPromises();
    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });

    // An empty query used to be skipped outright (`q !== ""`), so Back to the
    // unfiltered entry left the filter on screen.
    urlQuery.value = "";
    await flushPromises();

    expect(state.filters.value).toEqual({});
  });

  it("re-fetches after a restore so the grid matches the restored URL", async () => {
    const { state, urlQuery, pagesFn } = mountWithUrlQuery("status=active");
    await flushPromises();
    await flushPromises();

    state.setFieldFilter("customer", [{ type: "eq", value: ["5"] }]);
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 600));
    pagesFn.mockClear();

    urlQuery.value = "status=active";
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(pagesFn).toHaveBeenCalled();
    const [query] = pagesFn.mock.calls.at(-1) as [{ filter?: unknown }];
    expect(query.filter).toEqual({ status: "active" });
  });
});

/**
 * Like `mountWithUrlQuery`, plus a destination baseline written before URL
 * hydration — the way a preset or a saved default lands — and a columns model
 * to prove presentation state is left alone.
 */
function mountWithBaseline(initialQuery: string, listeners: Record<string, unknown> = {}) {
  const urlQuery = ref(initialQuery);
  const columnNames = ref(["id", "status", "customer"]);
  const sorters = ref([{ field: "id", direction: "desc" as const }]);
  const { client, pagesFn } = createMockClient({
    meta: createMockMeta(["id", "status", "customer"]),
    data: [],
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            AsTableRoot as unknown as Parameters<typeof h>[0],
            {
              url: "/orders",
              clientFactory: () => client as Client,
              urlQuery: urlQuery.value,
              "onUpdate:urlQuery": (v: string) => {
                urlQuery.value = v;
              },
              columnNames: columnNames.value,
              "onUpdate:columnNames": (v: string[]) => {
                columnNames.value = v;
              },
              sorters: sorters.value,
              "onUpdate:sorters": (v: typeof sorters.value) => {
                sorters.value = v;
              },
              ...listeners,
            },
            { default: () => [] },
          );
      },
    }),
  );
  const state = (wrapper.findComponent(AsTableRoot).vm as unknown as { state: ReactiveTableState })
    .state;
  // Baseline filter, written before tableDef loads (so before hydration).
  state.filters.value = { status: [{ type: "eq", value: ["active"] }] };
  return { wrapper, state, urlQuery, columnNames, pagesFn };
}

async function settle() {
  await flushPromises();
  await flushPromises();
}

describe("<AsTableRoot> $snapshot URLs", () => {
  it("initial mount: a marked URL replaces the baseline filters and sorters", async () => {
    const { state, columnNames } = mountWithBaseline("customer=acme&$sort=status&$snapshot");
    await settle();

    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
    expect(state.sorters.value).toEqual([{ field: "status", direction: "asc" }]);
    expect(columnNames.value).toEqual(["id", "status", "customer"]);
  });

  it("initial mount: an unmarked deep link still overlays the baseline", async () => {
    const { state } = mountWithBaseline("customer=acme&$sort=status");
    await settle();

    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    });
    expect(state.sorters.value).toEqual([
      { field: "id", direction: "desc" },
      { field: "status", direction: "asc" },
    ]);
  });

  it("a marked URL without $sort clears the baseline sorters", async () => {
    const { state } = mountWithBaseline("customer=acme&$snapshot");
    await settle();

    expect(state.sorters.value).toEqual([]);
    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
  });

  it("the bare marker restores an empty table", async () => {
    const { state, pagesFn } = mountWithBaseline("$snapshot");
    await settle();

    expect(state.filters.value).toEqual({});
    expect(state.sorters.value).toEqual([]);
    const [query] = pagesFn.mock.calls.at(-1) as [{ filter?: unknown; controls?: unknown }];
    expect(query.filter).toBeUndefined();
  });

  it("writes the marker on every URL it emits, including the empty view", async () => {
    const { state, urlQuery } = mountWithUrlQuery("");
    await settle();

    state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
    await flushPromises();
    expect(urlQuery.value).toBe("status=active&$snapshot");

    state.removeFieldFilter("status");
    await flushPromises();
    expect(urlQuery.value).toBe("$snapshot");
  });

  it("client-side navigation to another marked URL replaces the state", async () => {
    const { state, urlQuery } = mountWithBaseline("status=active&$snapshot");
    await settle();

    urlQuery.value = "customer=beta&$sort=-customer&$snapshot";
    await flushPromises();

    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["beta"] }] });
    expect(state.sorters.value).toEqual([{ field: "customer", direction: "desc" }]);
  });

  it("Back / Forward re-apply the URLs the table wrote", async () => {
    const { state, urlQuery } = mountWithBaseline("");
    await settle();
    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });

    state.setFieldFilter("customer", [{ type: "eq", value: ["acme"] }]);
    await flushPromises();
    const first = urlQuery.value;
    expect(first).toBe("status=active&customer=acme&$sort=-id&$snapshot");

    state.sorters.value = [];
    state.removeFieldFilter("status");
    await flushPromises();
    const second = urlQuery.value;
    expect(second).toBe("customer=acme&$snapshot");

    urlQuery.value = first; // Back
    await flushPromises();
    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    });
    expect(state.sorters.value).toEqual([{ field: "id", direction: "desc" }]);

    urlQuery.value = second; // Forward
    await flushPromises();
    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
    expect(state.sorters.value).toEqual([]);
  });
});

describe("<AsTableRoot> marker-less URLs overlay the boot baseline", () => {
  it("Back to a marker-less deep link restores the baseline criteria plus the link's", async () => {
    const { state, urlQuery } = mountWithBaseline("customer=acme");
    await settle();
    const opened = {
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    };
    expect(state.filters.value).toEqual(opened);

    // The user drops the baseline filter and the sorter, and edits the link's.
    state.sorters.value = [];
    state.removeFieldFilter("status");
    state.setFieldFilter("customer", [{ type: "eq", value: ["beta"] }]);
    await flushPromises();
    const edited = urlQuery.value;
    expect(edited).toBe("customer=beta&$snapshot");

    urlQuery.value = "customer=acme"; // Back to the deep link
    await flushPromises();
    expect(state.filters.value).toEqual(opened);
    expect(state.sorters.value).toEqual([{ field: "id", direction: "desc" }]);

    urlQuery.value = edited; // Forward: a marked URL still replaces
    await flushPromises();
    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["beta"] }] });
    expect(state.sorters.value).toEqual([]);
  });

  it("an empty URL restores the baseline, not an unfiltered table", async () => {
    const { state, urlQuery } = mountWithBaseline("");
    await settle();

    state.setFieldFilter("customer", [{ type: "eq", value: ["acme"] }]);
    state.removeFieldFilter("status");
    await flushPromises();

    urlQuery.value = "";
    await flushPromises();
    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });
    expect(state.sorters.value).toEqual([{ field: "id", direction: "desc" }]);
  });

  it("the boot baseline wins over a preset applied after mount", async () => {
    const { state, urlQuery } = mountWithBaseline("");
    await settle();

    state.preset.apply({
      filterOps: { customer: [{ type: "eq", value: ["beta"] }] },
      sorters: [{ field: "customer", direction: "asc" }],
    });
    await flushPromises();

    urlQuery.value = "customer=acme";
    await flushPromises();
    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    });
    expect(state.sorters.value).toEqual([{ field: "id", direction: "desc" }]);
  });

  it("an explicit mode overrides the marker", async () => {
    const { state } = mountWithBaseline("");
    await settle();

    state.applyUrlQuery("customer=acme&$snapshot", { mode: "merge" });
    await flushPromises();
    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    });

    state.applyUrlQuery("customer=beta", { mode: "replace" });
    await flushPromises();
    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["beta"] }] });
    expect(state.sorters.value).toEqual([]);
  });
});

describe("<AsTableRoot> unsupported URL filters", () => {
  it("with residual sync off, emits unsupported-filter for a cross-field OR and keeps the rest", async () => {
    const onUnsupportedFilter = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { state } = mountWithBaseline("customer=acme&(status=a^id=2)&$snapshot", {
        onUnsupportedFilter,
        urlQuerySync: { residual: false },
      });
      await settle();

      expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
      expect(state.residualFilters.value).toEqual([]);
      expect(onUnsupportedFilter).toHaveBeenCalledTimes(1);
      expect(onUnsupportedFilter.mock.calls[0][0]).toMatchObject({
        reason: "cross-field",
        fields: ["status", "id"],
      });
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("left out"));
    } finally {
      warn.mockRestore();
    }
  });

  it("reports a piece that touches an unknown field (dev warning when nothing listens)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { state } = mountWithBaseline("(status=a^ghost=2)&$snapshot");
      await settle();
      expect(state.residualFilters.value).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("[vue-table] URL filter left out"));
    } finally {
      warn.mockRestore();
    }
  });
});

describe("<AsTableRoot> residual filter conditions", () => {
  const OR = { $or: [{ status: "a" }, { id: 2 }] };

  it("carries a cross-field OR as a residual condition — applied, not reported", async () => {
    const onUnsupportedFilter = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { state, pagesFn } = mountWithBaseline("customer=acme&(status=a^id=2)&$snapshot", {
        onUnsupportedFilter,
      });
      await settle();

      expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
      expect(state.residualFilters.value).toEqual([OR]);
      expect(onUnsupportedFilter).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      const [query] = pagesFn.mock.calls.at(-1) as [{ filter?: unknown }];
      expect(query.filter).toEqual({ $and: [{ customer: "acme" }, OR] });
    } finally {
      warn.mockRestore();
    }
  });

  it("writes it back into the URL and drops it on Back to a URL without it", async () => {
    const { state, urlQuery, pagesFn } = mountWithBaseline("");
    await settle();

    state.setResidualFilters([OR]);
    await flushPromises();
    const withResidual = urlQuery.value;
    expect(withResidual).toBe("status=active&(status=a^id=2)&$sort=-id&$snapshot");

    state.removeResidualFilter(0);
    await flushPromises();
    const without = urlQuery.value;
    expect(without).toBe("status=active&$sort=-id&$snapshot");

    urlQuery.value = withResidual; // Back
    await flushPromises();
    expect(state.residualFilters.value).toEqual([OR]);
    expect(state.filters.value).toEqual({ status: [{ type: "eq", value: ["active"] }] });

    urlQuery.value = without; // Forward
    await flushPromises();
    expect(state.residualFilters.value).toEqual([]);

    await settle();
    const [query] = pagesFn.mock.calls.at(-1) as [{ filter?: unknown }];
    expect(query.filter).toEqual({ status: "active" });
  });

  it("does not echo its own URL into a second fetch", async () => {
    const { state, pagesFn } = mountWithBaseline("");
    await settle();
    const before = pagesFn.mock.calls.length;

    state.setResidualFilters([OR]);
    await new Promise((r) => setTimeout(r, 600)); // past the filter debounce
    await flushPromises();
    expect(pagesFn.mock.calls.length).toBe(before + 1);
  });

  it("resetFilters clears field filters and residual conditions", async () => {
    const { state, urlQuery } = mountWithBaseline("(status=a^id=2)&$snapshot");
    await settle();
    expect(state.residualFilters.value).toEqual([OR]);

    state.resetFilters();
    await flushPromises();
    expect(state.filters.value).toEqual({});
    expect(state.residualFilters.value).toEqual([]);
    expect(urlQuery.value).toBe("$snapshot");
  });

  it("an overlay deep link owns every path it mentions, inside a residual too", async () => {
    // Baseline: status=active. The link talks about `status` only inside its OR.
    const { state } = mountWithBaseline("customer=acme&(status=a^id=2)");
    await settle();

    expect(state.filters.value).toEqual({ customer: [{ type: "eq", value: ["acme"] }] });
    expect(state.residualFilters.value).toEqual([OR]);
  });

  it("an overlay deep link that does not mention it keeps a baseline residual", async () => {
    const { state, urlQuery } = mountWithBaseline("");
    await settle();
    // An app-seeded condition present at boot is part of the baseline.
    state.applyUrlQuery("(status=a^id=2)", { mode: "merge" });
    await flushPromises();
    expect(state.residualFilters.value).toEqual([OR]);

    urlQuery.value = "customer=acme";
    await flushPromises();
    // Baseline had no residual — a merge starts from the baseline.
    expect(state.residualFilters.value).toEqual([]);
    expect(state.filters.value).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      customer: [{ type: "eq", value: ["acme"] }],
    });
  });

  it("applying a preset that owns the applied filters clears residual conditions", async () => {
    const { state } = mountWithBaseline("(status=a^id=2)&$snapshot");
    await settle();

    state.preset.apply({ sorters: [] });
    expect(state.residualFilters.value).toEqual([OR]);

    state.preset.apply({ filterOps: { customer: [{ type: "eq", value: ["beta"] }] } });
    expect(state.residualFilters.value).toEqual([]);
  });

  it("keeps a condition on a private field out of the URL and across URL restores", async () => {
    const { state, urlQuery } = mountWithBaseline("", { urlQuerySync: { filters: ["status"] } });
    await settle();

    const PRIVATE = { $or: [{ status: "a" }, { customer: "x" }] };
    const before = urlQuery.value;
    state.setResidualFilters([PRIVATE]);
    await flushPromises();
    // Nothing the URL owns changed, so nothing is written.
    expect(urlQuery.value).toBe(before);
    expect(state.buildQuery().filter).toEqual({ $and: [{ status: "active" }, PRIVATE] });

    urlQuery.value = "status=b&$snapshot";
    await flushPromises();
    expect(state.residualFilters.value).toEqual([PRIVATE]);
  });
});
