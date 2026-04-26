import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { ListboxRoot } from "reka-ui";
import AsTableBase from "../components/internal/as-table-base.vue";
import { dragEvent, mockColumn, stubRect, thByPath } from "./helpers";

const cols = [mockColumn("a"), mockColumn("b"), mockColumn("c")];
const rows = [
  { a: "1", b: "2", c: "3" },
  { a: "4", b: "5", c: "6" },
];

describe("<AsTableBase> column drag-reorder", () => {
  it("emits reorder with 'before' when cursor is on the left half of the target", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    // Left half: clientX < left + width/2
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toEqual([["a", "c", "before"]]);
  });

  it("emits reorder with 'after' when cursor is on the right half of the target", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 280 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 280 }));

    expect(wrapper.emitted("reorder")).toEqual([["a", "c", "after"]]);
  });

  it("does not emit reorder when source and target paths are identical", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    stubRect(thA, 0, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thA.dispatchEvent(dragEvent("dragover", { clientX: 30 }));
    thA.dispatchEvent(dragEvent("drop", { clientX: 30 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });

  it("does not emit reorder when dropped on the select column", async () => {
    const Host = defineComponent({
      emits: ["reorder"],
      setup(_, { emit }) {
        return () =>
          h(
            ListboxRoot as unknown as Parameters<typeof h>[0],
            { multiple: true },
            {
              default: () =>
                h(AsTableBase, {
                  columns: cols,
                  rows,
                  sorters: [],
                  stretch: false,
                  select: "multi",
                  selectedRows: [],
                  onReorder: (...args: unknown[]) => emit("reorder", ...args),
                }),
            },
          );
      },
    });
    const wrapper = mount(Host);
    const thA = thByPath(wrapper.element, "a");
    const selectTh = wrapper.element.querySelector("th.as-th-select") as HTMLElement | null;
    expect(selectTh).not.toBeNull();
    expect(selectTh!.hasAttribute("draggable")).toBe(false);

    thA.dispatchEvent(dragEvent("dragstart"));
    selectTh!.dispatchEvent(dragEvent("dragover", { clientX: 5 }));
    selectTh!.dispatchEvent(dragEvent("drop", { clientX: 5 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });

  it("does not start a drag when dragstart originates inside the column-menu trigger button", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const button = thA.querySelector("button.as-th-btn") as HTMLElement | null;
    expect(button).not.toBeNull();

    button!.dispatchEvent(dragEvent("dragstart"));
    // Button has @dragstart.stop — drag never reaches the th, so source path is not set.
    // A subsequent drop on a different th must not emit reorder.
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });

  it("clears drag state on dragend even if no drop occurred", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thA.dispatchEvent(dragEvent("dragend"));
    await wrapper.vm.$nextTick();

    expect(thA.classList.contains("as-th-dragging")).toBe(false);
    expect(thC.classList.contains("as-th-drop-indicator-before")).toBe(false);
    expect(thC.classList.contains("as-th-drop-indicator-after")).toBe(false);
  });

  it("applies drop indicator classes during drag", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    stubRect(thC, 200, 100);

    thA.dispatchEvent(dragEvent("dragstart"));
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    await wrapper.vm.$nextTick();

    expect(thA.classList.contains("as-th-dragging")).toBe(true);
    expect(thC.classList.contains("as-th-drop-indicator-before")).toBe(true);
    expect(thC.classList.contains("as-th-drop-indicator-after")).toBe(false);
  });

  it("with reorderable=false, headers are not draggable and synthetic drag emits nothing", async () => {
    const wrapper = mount(AsTableBase, {
      props: { columns: cols, rows, sorters: [], stretch: false, reorderable: false },
    });
    const thA = thByPath(wrapper.element, "a");
    const thC = thByPath(wrapper.element, "c");
    expect(thA.hasAttribute("draggable")).toBe(false);
    expect(thC.hasAttribute("draggable")).toBe(false);

    thA.dispatchEvent(dragEvent("dragstart"));
    stubRect(thC, 200, 100);
    thC.dispatchEvent(dragEvent("dragover", { clientX: 220 }));
    thC.dispatchEvent(dragEvent("drop", { clientX: 220 }));

    expect(wrapper.emitted("reorder")).toBeUndefined();
  });
});
