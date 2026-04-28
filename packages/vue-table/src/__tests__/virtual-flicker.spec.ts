import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import AsTable from "../components/as-table.vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import { mockColumn, mockTableDef } from "./helpers";
import type { Client } from "@atscript/db-client";

// Regression for the Ctrl+End → last-row jitter. Two pieces have to stay in
// place for this to behave: the JS side (alignActiveRow lands the last row at
// `maxScrollTop` exactly once, with no per-watcher rewrite) AND the CSS side
// (`[overflow-anchor:none]` on `.as-table-scroll-container`). happy-dom can't
// exercise CSS scroll anchoring, so this test only verifies the JS half — but
// that half is what regresses if someone simplifies `alignActiveRow` away.
describe("virtual scroll: ctrl+down to last row stable", () => {
  it("scrollTop settles to maxScrollTop and doesn't drift", async () => {
    const TOTAL = 5000;
    const pagesFn = async (_q: unknown, page: number, size: number) => {
      const data = Array.from({ length: TOTAL }, (_, i) => ({ id: i, name: `Row ${i}` }));
      return { data, count: TOTAL, page, itemsPerPage: size, pages: 1 };
    };

    let stateRef: ReturnType<typeof createTableState>["state"] | null = null;
    const Host = defineComponent({
      setup() {
        const { state, internals } = createTableState({
          client: {} as Client,
          query: { fn: pagesFn },
          limit: TOTAL,
        });
        provideTableContext({ state, client: {} as Client, controls: {} });
        internals.init(mockTableDef([mockColumn("id"), mockColumn("name")]));
        stateRef = state;
        return () =>
          h("div", { style: "height: 600px;" }, [
            h(AsTable, { virtualRowHeight: 36, virtualOverscan: 10 }),
          ]);
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await flushPromises();
    await flushPromises();

    expect(stateRef!.results.value.length).toBe(TOTAL);

    const container = document.querySelector("[data-virtual-scroll]") as HTMLElement;
    expect(container).toBeTruthy();

    // Stub layout — happy-dom doesn't compute table heights.
    const SCROLL_HEIGHT = 38 + TOTAL * 36;
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "scrollHeight", { value: SCROLL_HEIGHT, configurable: true });
    const thead = container.querySelector("thead") as HTMLElement;
    Object.defineProperty(thead, "offsetHeight", { value: 38, configurable: true });

    const tbody = wrapper.find("tbody");
    await tbody.trigger("keydown", { key: "ArrowDown", ctrlKey: true });
    expect(stateRef!.activeIndex.value).toBe(TOTAL - 1);

    await flushPromises();
    await nextTick();

    const expected = SCROLL_HEIGHT - 600;
    const tick1 = container.scrollTop;
    expect(tick1).toBe(expected);

    // Multiple subsequent ticks must not re-touch scrollTop.
    await flushPromises();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await flushPromises();
    expect(container.scrollTop).toBe(expected);

    // No-op write to activeIndex must not re-trigger any scrollTop write
    // either — the watcher only fires on actual `setActive` value changes.
    stateRef!.activeIndex.value = TOTAL - 1;
    await flushPromises();
    expect(container.scrollTop).toBe(expected);
  });
});
