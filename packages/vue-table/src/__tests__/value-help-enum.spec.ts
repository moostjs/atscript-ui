import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref, nextTick } from "vue";
import AsFilterValueHelp from "../components/internal/as-filter-value-help.vue";
import type { ColumnDef } from "@atscript/ui";

// Regression for the "filter dialog for enums shows always loading" bug:
// `createStaticTableState` synthesizes a TableDef with `type: undefined`,
// and `useCellResolver`'s WeakMap-keyed cache used to throw on `.set` —
// which aborted the per-cell `v-bind` template branch in AsWindowTableBase
// and left the dialog rendering an empty tbody forever. The guard in
// `getColumnMetaMap` (skip cache when `def.type` isn't an object) keeps
// this test green.
describe("AsFilterValueHelp - enum mode", () => {
  it("renders rows from offline data without throwing in cell resolver", async () => {
    const enumColumn: ColumnDef = {
      path: "status",
      label: "Status",
      type: "enum",
      sortable: true,
      filterable: true,
      visible: true,
      order: 0,
      options: [
        { key: "pending", label: "Pending" },
        { key: "shipped", label: "Shipped" },
        { key: "delivered", label: "Delivered" },
      ],
    };

    const Wrapper = defineComponent({
      setup() {
        const conditions = ref([]);
        return () =>
          h(AsFilterValueHelp as any, {
            column: enumColumn,
            modelValue: conditions.value,
          });
      },
    });

    const wrapper = mount(Wrapper, { attachTo: document.body });
    const valueHelpComp = wrapper.findComponent(AsFilterValueHelp as any);

    await flushPromises();
    await nextTick();
    await flushPromises();

    const ss = (valueHelpComp.vm.$ as any).setupState;
    const innerState = ss.innerState;
    expect(innerState).toBeDefined();

    // Force-trigger viewport metrics manually (happy-dom doesn't fire ResizeObserver).
    innerState.viewportRowCount.value = 10;
    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(innerState.querying.value).toBe(false);
    expect(innerState.totalCount.value).toBe(3);
    expect(innerState.windowCache.value.size).toBe(3);

    const html = wrapper.html();
    // 3 data rows must render in tbody (one <tr> per enum value).
    const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    const trCount = (tbody.match(/<tr/g) ?? []).length;
    expect(trCount).toBe(3);
    expect(tbody).toContain("Pending");
    expect(tbody).toContain("Shipped");
    expect(tbody).toContain("Delivered");
  });
});
