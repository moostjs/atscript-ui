import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, shallowRef } from "vue";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
import { useTableContext } from "../composables/use-table-state";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import { createMockMeta, createMockClient, dragEvent, stubRect, thByPath } from "./helpers";

afterEach(() => {
  clearTableCache();
});

function buildHost(opts: { url: string; reorderable?: boolean }) {
  const meta = createMockMeta(["a", "b", "c"]);
  const data = [{ a: "1", b: "2", c: "3" }];
  const { client, pagesFn } = createMockClient({ meta, data, count: 1 });

  const stateRef = shallowRef<ReactiveTableState | null>(null);

  const Capture = defineComponent({
    setup() {
      stateRef.value = useTableContext().state;
      return () => h(AsTable, { reorderable: opts.reorderable ?? true });
    },
  });

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          AsTableRoot as unknown as Parameters<typeof h>[0],
          { url: opts.url, clientFactory: () => client },
          { default: () => h(Capture) },
        );
    },
  });

  return { Host, stateRef, pagesFn };
}

describe("<AsTable> reorder via state", () => {
  it("rewrites state.columnNames per reorderColumnNames on header drop", async () => {
    const { Host, stateRef, pagesFn } = buildHost({ url: "/reorder-1" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    expect(state.columnNames.value).toEqual(["a", "b", "c"]);

    const initialQueryCalls = pagesFn.mock.calls.length;

    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 280 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 280 }));
    await wrapper.vm.$nextTick();

    expect(state.columnNames.value).toEqual(["b", "c", "a"]);
    expect(state.querying.value).toBe(false);
    // No additional fetch beyond the initial mount-time query.
    expect(pagesFn.mock.calls.length).toBe(initialQueryCalls);
  });

  it("with reorderable=false, drop does not mutate columnNames and emits no event", async () => {
    const { Host, stateRef, pagesFn } = buildHost({ url: "/reorder-2", reorderable: false });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    expect(state.columnNames.value).toEqual(["a", "b", "c"]);

    const initialQueryCalls = pagesFn.mock.calls.length;

    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    expect(thA.hasAttribute("draggable")).toBe(false);
    expect(thC.hasAttribute("draggable")).toBe(false);
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 280 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 280 }));
    await wrapper.vm.$nextTick();

    expect(state.columnNames.value).toEqual(["a", "b", "c"]);
    expect(pagesFn.mock.calls.length).toBe(initialQueryCalls);
  });
});
