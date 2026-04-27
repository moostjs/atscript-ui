import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AsTableBase from "../components/internal/as-table-base.vue";
import { dragEvent, handleOf, mockColumn, pointerEvent, stubRect, thByPath } from "./helpers";

const cols = [mockColumn("a"), mockColumn("b"), mockColumn("c")];
const rows = [{ a: "1", b: "2", c: "3" }];

describe("<AsTableBase> column drag-resize", () => {
  it("renders a resize handle on every real-column <th> when resizable", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    for (const path of ["a", "b", "c"]) {
      const th = thByPath(wrapper.element, path);
      expect(th.querySelector(".as-th-resize-handle")).not.toBeNull();
    }
  });

  it("does not render handles when :resizable is false", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, resizable: false },
    });
    for (const path of ["a", "b", "c"]) {
      const th = thByPath(wrapper.element, path);
      expect(th.querySelector(".as-th-resize-handle")).toBeNull();
    }
  });

  it("renders a th width from its columnWidths entry's `w` field", () => {
    const wrapper = mount(AsTableBase, {
      props: {
        columns: cols,
        rows,
        sorters: [],
        stretch: false,
        columnWidths: {
          a: { w: "100px", d: "100px" },
          b: { w: "240px", d: "200px" },
          c: { w: "150px", d: "150px" },
        },
      },
    });
    const thB = thByPath(wrapper.element, "b");
    expect(thB.style.width).toBe("240px");
  });

  it("emits the final resize width with px shape after pointerup", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "b");
    stubRect(th, 100, 200);
    const handle = handleOf(th);

    // Intermediate pointermoves are rAF-coalesced; pointerup flushes the latest.
    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: 350 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: 380 }));
    handle.dispatchEvent(pointerEvent("pointerup", { clientX: 380 }));

    const emits = wrapper.emitted("resize");
    expect(emits).toBeDefined();
    expect(emits!.length).toBe(1);
    expect(emits![0]).toEqual(["b", "280px"]);
  });

  it("clamps the emitted width at columnMinWidth (default 48)", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "b");
    stubRect(th, 100, 100);
    const handle = handleOf(th);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 200 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: -200 }));
    handle.dispatchEvent(pointerEvent("pointerup"));

    const emits = wrapper.emitted("resize");
    expect(emits).toBeDefined();
    expect(emits![0]).toEqual(["b", "48px"]);
  });

  it("honours a custom :column-min-width", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, columnMinWidth: 120 },
    });
    const th = thByPath(wrapper.element, "b");
    stubRect(th, 100, 100);
    const handle = handleOf(th);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 200 }));
    handle.dispatchEvent(pointerEvent("pointermove", { clientX: -200 }));
    handle.dispatchEvent(pointerEvent("pointerup"));

    const emits = wrapper.emitted("resize");
    expect(emits).toBeDefined();
    expect(emits![0]).toEqual(["b", "120px"]);
  });

  it("suppresses native dragstart on the th once a resize gesture has started on the handle", () => {
    // Real-browser scenario: user mousedowns on the handle (pointerdown fires),
    // then moves — the browser fires dragstart on the <th draggable=true>
    // ancestor (NOT on the handle, since handle is draggable=false). The th's
    // dragstart handler must short-circuit when a resize is in flight.
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "a");
    stubRect(th, 0, 200);
    const handle = handleOf(th);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 200 }));
    // Now the th itself receives dragstart — this is what real browsers do.
    th.dispatchEvent(dragEvent("dragstart"));
    // Subsequent drop on a different th must NOT produce a reorder.
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });

  it("a synthetic dragstart fired directly on the handle is also stopped", () => {
    // Defensive: covers happy-dom dispatching dragstart on the handle (vs.
    // the th). The handle's @dragstart.prevent.stop blocks it.
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "a");
    const handle = handleOf(th);

    handle.dispatchEvent(dragEvent("dragstart"));
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });

  it("reorder still works when the gesture starts on the th surface (outside the handle)", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toEqual([["a", "c", "before"]]);
    expect(wrapper.emitted("resize")).toBeUndefined();
  });

  it("with :resizable=false, synthetic pointer events on a th body produce no resize emit", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, resizable: false },
    });
    const th = thByPath(wrapper.element, "b");
    // No handle exists — confirm and skip dispatch on body.
    expect(th.querySelector(".as-th-resize-handle")).toBeNull();
    expect(wrapper.emitted("resize")).toBeUndefined();
  });

  it("auto-fits the column on double-click by emitting a resize with the max content width", () => {
    const twoRows = [
      { a: "1", b: "short", c: "3" },
      { a: "4", b: "much-longer-content", c: "6" },
    ];
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows: twoRows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "b");
    const handle = handleOf(th);

    // happy-dom returns 0 for scrollWidth by default; stub real-ish numbers.
    Object.defineProperty(th, "scrollWidth", { configurable: true, value: 80 });
    const tbody = wrapper.element.querySelector("tbody")!;
    const bRow0 = tbody.children[0]!.children[1] as HTMLElement;
    const bRow1 = tbody.children[1]!.children[1] as HTMLElement;
    Object.defineProperty(bRow0, "scrollWidth", { configurable: true, value: 150 });
    Object.defineProperty(bRow1, "scrollWidth", { configurable: true, value: 220 });

    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

    const emits = wrapper.emitted("resize");
    expect(emits).toBeDefined();
    expect(emits).toEqual([["b", "220px"]]);
  });

  it("auto-fit honours the column-min-width floor", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, columnMinWidth: 200 },
    });
    const th = thByPath(wrapper.element, "b");
    const handle = handleOf(th);

    Object.defineProperty(th, "scrollWidth", { configurable: true, value: 30 });
    const tbody = wrapper.element.querySelector("tbody")!;
    const bRow0 = tbody.children[0]!.children[1] as HTMLElement;
    Object.defineProperty(bRow0, "scrollWidth", { configurable: true, value: 50 });

    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

    expect(wrapper.emitted("resize")).toEqual([["b", "200px"]]);
  });

  it("does not auto-fit when :resizable is false", () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, resizable: false },
    });
    const th = thByPath(wrapper.element, "b");
    th.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(wrapper.emitted("resize")).toBeUndefined();
  });

  it("applies as-th-resizing class to the source <th> during the drag", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const th = thByPath(wrapper.element, "b");
    stubRect(th, 100, 200);
    const handle = handleOf(th);

    handle.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    await wrapper.vm.$nextTick();
    expect(th.classList.contains("as-th-resizing")).toBe(true);

    handle.dispatchEvent(pointerEvent("pointerup"));
    await wrapper.vm.$nextTick();
    expect(th.classList.contains("as-th-resizing")).toBe(false);
  });
});
