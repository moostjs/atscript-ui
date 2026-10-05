// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client } from "@atscript/db-client";
import type { FilterExpr } from "@uniqu/core";
import AsTableRoot from "../components/as-table-root.vue";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta } from "./helpers";

afterEach(() => {
  clearTableCache();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function mountRoot(extra: () => Record<string, unknown> = () => ({})) {
  const scope = ref<FilterExpr | undefined>({ status: "pending" });
  const url = ref("/orders");
  const { client, pagesFn } = createMockClient({
    meta: createMockMeta(["id", "status"]),
    data: [],
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            AsTableRoot as unknown as Parameters<typeof h>[0],
            {
              url: url.value,
              forceFilters: scope.value,
              clientFactory: () => client as Client,
              ...extra(),
            },
            { default: () => [] },
          );
      },
    }),
  );
  const state = () =>
    (wrapper.findComponent(AsTableRoot).vm as unknown as { state: ReactiveTableState }).state;
  return { wrapper, state, scope, url, pagesFn };
}

describe("<AsTableRoot> live forceFilters", () => {
  it("re-queries on the same mounted instance — no remount", async () => {
    const { state, scope, pagesFn } = mountRoot();
    await flushPromises();
    await flushPromises();
    const before = state();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    scope.value = { status: "shipped" };
    await flushPromises();
    expect(state()).toBe(before);
    expect(pagesFn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(pagesFn.mock.calls[1][0].filter)).toContain("shipped");
  });

  it("warns once when a setup-only prop (url) changes after mount", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { url } = mountRoot();
    await flushPromises();
    url.value = "/other";
    await nextTick();
    url.value = "/third";
    await nextTick();
    const msgs = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(":url changed"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("key the component");
  });

  it("does not warn for props that only churn: inline functions and equal object literals", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { scope } = mountRoot(() => ({
      queryFn: undefined,
      urlQuerySync: { pagination: false },
      displayColumns: [{ key: "x", label: "X", render: () => "x" }],
    }));
    await flushPromises();
    // every change re-renders the host: new clientFactory arrow, new literals
    scope.value = { status: "a" };
    await nextTick();
    scope.value = { status: "b" };
    await nextTick();
    expect(
      warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("after mount")),
    ).toEqual([]);
  });

  it("says provided/removed when a function prop appears after mount", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const queryFn = ref<undefined | (() => Promise<never>)>(undefined);
    const { scope } = mountRoot(() => ({ queryFn: queryFn.value }));
    await flushPromises();
    queryFn.value = () => Promise.reject(new Error("unused"));
    scope.value = { status: "x" };
    await nextTick();
    const msgs = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(":queryFn"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("provided/removed after mount");
  });
});
