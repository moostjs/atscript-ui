// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
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

describe("<AsTableRoot> URL restoration — hydrate once, then replace", () => {
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
