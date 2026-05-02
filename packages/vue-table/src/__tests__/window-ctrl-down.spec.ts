import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import AsWindowTableBase from "../components/internal/as-window-table-base.vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import { mockColumn, mockTableDef } from "./helpers";
import type { Client } from "@atscript/db-client";

// Regression for the window-mode Ctrl+Down → batch-load → activated-but-
// off-screen bug. The active class must end up on a real `<tr>` (not a
// skeleton row) once the block lands. Relies on the `[activeIndex,
// viewportRowCount]` watcher in AsWindowTableBase keeping the active row
// inside the rendered window even when viewport metrics change after the
// load; the row mount itself happens via Vue reactivity through
// `state.dataAt` once `windowCache` is replaced.
describe("window: ctrl+down activates last row", () => {
  it("active class applies after block load", async () => {
    const TOTAL = 1000;
    let blockResolver = null as ((rows: any[]) => void) | null;
    let bootstrapResolver = null as ((rows: any[]) => void) | null;

    const pagesFn = (q: any, page: number, size: number) => {
      const skip = (page - 1) * size;
      return new Promise<any>((resolve) => {
        const finish = (rows: any[]) =>
          resolve({
            data: rows,
            count: TOTAL,
            page,
            itemsPerPage: size,
            pages: Math.ceil(TOTAL / size),
          });
        if (skip === 0) bootstrapResolver = finish;
        else blockResolver = finish;
      });
    };

    let stateRef: any = null;
    const Host = defineComponent({
      setup() {
        const { state, internals } = createTableState({
          client: {} as Client,
          query: { fn: pagesFn },
          window: { dragReleaseDebounceMs: 0 },
        });
        provideTableContext({ state, client: {} as Client, controls: {} });
        state.viewportRowCount.value = 10;
        internals.init(mockTableDef([mockColumn("id"), mockColumn("name")]));
        stateRef = state;
        return () => h(AsWindowTableBase, { rowHeight: 32 });
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });

    await flushPromises();
    bootstrapResolver?.(Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Row ${i}` })));
    await flushPromises();

    expect(stateRef.windowCache.value.size).toBe(100);

    const tbody = wrapper.find("tbody");
    await tbody.trigger("keydown", { key: "ArrowDown", ctrlKey: true });
    expect(stateRef.activeIndex.value).toBe(999);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await flushPromises();
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    await flushPromises();

    expect(blockResolver).not.toBeNull();
    blockResolver?.(
      Array.from({ length: 100 }, (_, i) => ({ id: 900 + i, name: `Row ${900 + i}` })),
    );
    await flushPromises();
    await flushPromises();

    expect(stateRef.windowCache.value.has(999)).toBe(true);
    expect(stateRef.activeIndex.value).toBe(999);

    const html = wrapper.html();
    expect(html).toContain("as-table-row-active");
  });
});
