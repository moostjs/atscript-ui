import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, shallowRef } from "vue";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
import { useTableContext } from "../composables/use-table-state";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import {
  createMockMeta,
  createMockClient,
  handleOf,
  pointerEvent,
  stubRect,
  thByPath,
} from "./helpers";

afterEach(() => {
  clearTableCache();
});

function buildHost(opts: { url: string; resizable?: boolean; columnMinWidth?: number }) {
  const meta = createMockMeta(["a", "b", "c"]);
  const data = [{ a: "1", b: "2", c: "3" }];
  const { client, pagesFn } = createMockClient({ meta, data, count: 1 });

  const stateRef = shallowRef<ReactiveTableState | null>(null);

  const Capture = defineComponent({
    setup() {
      stateRef.value = useTableContext().state;
      return () =>
        h(AsTable, {
          resizable: opts.resizable ?? true,
          columnMinWidth: opts.columnMinWidth ?? 48,
        });
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

describe("<AsTable> resize via state", () => {
  it("seeds state.columnWidths with `{ w: d, d }` for every column on TableDef load", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-seed" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    expect(Object.keys(state.columnWidths.value).toSorted()).toEqual(["a", "b", "c"]);
    for (const path of ["a", "b", "c"]) {
      const entry = state.columnWidths.value[path];
      expect(entry).toBeDefined();
      expect(entry!.w).toBe(entry!.d);
      expect(/^\d+px$/.test(entry!.w)).toBe(true);
    }
    void wrapper;
  });

  it("rewrites only the dragged column's `w` on header drag-resize; preserves `d` and other columns", async () => {
    const { Host, stateRef, pagesFn } = buildHost({ url: "/resize-1" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    const initialA = state.columnWidths.value.a!;
    const initialC = state.columnWidths.value.c!;
    const initialB = state.columnWidths.value.b!;

    const initialQueryCalls = pagesFn.mock.calls.length;

    const thB = thByPath(wrapper.element, "b");
    stubRect(thB, 100, 200);
    const handle = handleOf(thB);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: 350 }));
    handle.dispatchEvent(pointerEvent("pointerup"));
    await wrapper.vm.$nextTick();

    expect(state.columnWidths.value.a).toEqual(initialA);
    expect(state.columnWidths.value.c).toEqual(initialC);
    expect(state.columnWidths.value.b).toEqual({ w: "250px", d: initialB.d });
    expect(state.querying.value).toBe(false);
    expect(pagesFn.mock.calls.length).toBe(initialQueryCalls);
  });

  it("preserves user-set widths across subsequent resizes", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-2" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    const initialB = state.columnWidths.value.b!;

    stubRect(thByPath(wrapper.element, "a"), 0, 200);
    stubRect(thByPath(wrapper.element, "c"), 300, 100);

    const handleA = handleOf(thByPath(wrapper.element, "a"));
    handleA.dispatchEvent(pointerEvent("pointerdown", { clientX: 200 }));
    handleA.dispatchEvent(pointerEvent("pointermove", { clientX: 250 }));
    handleA.dispatchEvent(pointerEvent("pointerup"));
    await wrapper.vm.$nextTick();
    expect(state.columnWidths.value.a.w).toBe("250px");

    const handleC = handleOf(thByPath(wrapper.element, "c"));
    handleC.dispatchEvent(pointerEvent("pointerdown", { clientX: 400 }));
    handleC.dispatchEvent(pointerEvent("pointermove", { clientX: 500 }));
    handleC.dispatchEvent(pointerEvent("pointerup"));
    await wrapper.vm.$nextTick();
    expect(state.columnWidths.value.a.w).toBe("250px");
    expect(state.columnWidths.value.c.w).toBe("200px");
    // Unrelated `b` is untouched (default still in place).
    expect(state.columnWidths.value.b).toEqual(initialB);
  });

  it("with :resizable=false, no handles render and no state mutation occurs", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-3", resizable: false });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;
    const before = state.columnWidths.value;

    for (const path of ["a", "b", "c"]) {
      const th = thByPath(wrapper.element, path);
      expect(th.querySelector(".as-th-resize-handle")).toBeNull();
    }
    expect(state.columnWidths.value).toBe(before);
  });

  it(":column-min-width is forwarded to AsTableBase", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-4", columnMinWidth: 120 });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;

    const thB = thByPath(wrapper.element, "b");
    stubRect(thB, 80, 100);
    const handle = handleOf(thB);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 200 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: -300 }));
    handle.dispatchEvent(pointerEvent("pointerup"));
    await wrapper.vm.$nextTick();

    expect(state.columnWidths.value.b.w).toBe("120px");
  });

  it("double-click on a resize handle auto-fits the column to its max content width", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-dblclick-1" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;

    const thB = thByPath(wrapper.element, "b");
    Object.defineProperty(thB, "scrollWidth", { configurable: true, value: 90 });
    const tbody = wrapper.element.querySelector("tbody")!;
    const bRow = tbody.children[0]!.children[1] as HTMLElement;
    Object.defineProperty(bRow, "scrollWidth", { configurable: true, value: 175 });

    const initialB = state.columnWidths.value.b!;
    const handle = handleOf(thB);
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    await wrapper.vm.$nextTick();

    expect(state.columnWidths.value.b).toEqual({ w: "175px", d: initialB.d });
  });

  it("th width binding reads from the entry's `w` field", async () => {
    const { Host, stateRef } = buildHost({ url: "/resize-5" });
    const wrapper = mount(Host);
    await flushPromises();
    const state = stateRef.value!;

    state.columnWidths.value = {
      ...state.columnWidths.value,
      a: { w: "300px", d: state.columnWidths.value.a!.d },
    };
    await wrapper.vm.$nextTick();

    const thA = thByPath(wrapper.element, "a");
    expect(thA.style.width).toBe("300px");
  });
});
